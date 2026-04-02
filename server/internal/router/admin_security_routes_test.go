package router

import (
	"database/sql"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"home-decoration-server/internal/config"
	"home-decoration-server/internal/handler"
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/mattn/go-sqlite3"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

var routerSQLiteRegisterOnce sync.Once

func setupRouterSQLiteDB(t *testing.T) *gorm.DB {
	t.Helper()

	routerSQLiteRegisterOnce.Do(func() {
		sql.Register("router_sqlite3_with_now", &sqlite3.SQLiteDriver{
			ConnectHook: func(conn *sqlite3.SQLiteConn) error {
				return conn.RegisterFunc("now", func() string {
					return time.Now().UTC().Format("2006-01-02 15:04:05")
				}, false)
			},
		})
	})

	dsn := fmt.Sprintf("file:router_memdb_%d?mode=memory&cache=shared", time.Now().UnixNano())
	sqlDB, err := sql.Open("router_sqlite3_with_now", dsn)
	if err != nil {
		t.Fatalf("open sqlite db: %v", err)
	}
	sqlDB.SetMaxOpenConns(1)
	sqlDB.SetMaxIdleConns(1)

	db, err := gorm.Open(sqlite.New(sqlite.Config{Conn: sqlDB}), &gorm.Config{})
	if err != nil {
		t.Fatalf("open gorm db: %v", err)
	}
	t.Cleanup(func() {
		_ = sqlDB.Close()
	})
	return db
}

func signAdminToken(t *testing.T, secret string, claims jwt.MapClaims) string {
	t.Helper()

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString([]byte(secret))
	if err != nil {
		t.Fatalf("sign admin token: %v", err)
	}
	return signed
}

func setupAdminSecurityRouter(t *testing.T) *gin.Engine {
	t.Helper()
	t.Setenv("APP_ENV", config.AppEnvProduction)

	db := setupRouterSQLiteDB(t)
	if err := db.AutoMigrate(
		&model.SysAdmin{},
		&model.SysRole{},
		&model.SysMenu{},
		&model.SysAdminRole{},
		&model.SysRoleMenu{},
		&model.AuditLog{},
	); err != nil {
		t.Fatalf("auto migrate admin security router models: %v", err)
	}

	previousDB := repository.DB
	previousRedis := repository.RedisClient
	repository.DB = db
	repository.RedisClient = nil
	t.Cleanup(func() {
		repository.DB = previousDB
		repository.RedisClient = previousRedis
	})

	cfg := config.GetConfig()
	previousCfg := *cfg
	cfg.JWT.Secret = "router-test-secret"
	cfg.Server.Mode = "debug"
	cfg.AdminAuth.APIIPEnforced = false
	cfg.AdminAuth.RequiredRoleKeys = "*"
	cfg.AdminAuth.TOTPEnabled = true
	t.Cleanup(func() {
		*cfg = previousCfg
	})

	admin := model.SysAdmin{
		ID:                1,
		Username:          "sec-admin",
		Password:          "$2a$10$dummy",
		Nickname:          "安全管理员",
		Status:            1,
		MustResetPassword: true,
	}
	if err := db.Create(&admin).Error; err != nil {
		t.Fatalf("seed admin: %v", err)
	}

	return Setup(cfg, handler.NewDictionaryHandler(nil))
}

func TestAdminInfoAllowsSetupRequiredSession(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := setupAdminSecurityRouter(t)

	token := signAdminToken(t, config.GetConfig().JWT.Secret, jwt.MapClaims{
		"admin_id":    float64(1),
		"username":    "sec-admin",
		"is_super":    true,
		"token_type":  "admin",
		"token_use":   "access",
		"login_stage": "setup_required",
		"exp":         time.Now().Add(time.Hour).Unix(),
	})

	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/info", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()

	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected /api/v1/admin/info to allow setup_required session, got %d body=%s", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), "\"loginStage\":\"setup_required\"") {
		t.Fatalf("expected setup_required loginStage in response, got %s", rec.Body.String())
	}
}

func TestAdminSecuritySessionRevokeRequiresReasonAndReauth(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := setupAdminSecurityRouter(t)

	token := signAdminToken(t, config.GetConfig().JWT.Secret, jwt.MapClaims{
		"admin_id":    float64(1),
		"username":    "sec-admin",
		"is_super":    true,
		"token_type":  "admin",
		"token_use":   "access",
		"login_stage": "active",
		"exp":         time.Now().Add(time.Hour).Unix(),
	})

	testCases := []struct {
		name         string
		body         string
		wantHTTPCode int
		wantText     string
	}{
		{
			name:         "missing reason",
			body:         `{}`,
			wantHTTPCode: http.StatusBadRequest,
			wantText:     "请填写操作原因",
		},
		{
			name:         "missing reauth proof",
			body:         `{"reason":"撤销会话"}`,
			wantHTTPCode: http.StatusOK,
			wantText:     "\"code\":403",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodPost, "/api/v1/admin/security/sessions/test-session/revoke", strings.NewReader(tc.body))
			req.Header.Set("Authorization", "Bearer "+token)
			req.Header.Set("Content-Type", "application/json")
			rec := httptest.NewRecorder()

			r.ServeHTTP(rec, req)

			if rec.Code != tc.wantHTTPCode {
				t.Fatalf("expected http %d, got %d body=%s", tc.wantHTTPCode, rec.Code, rec.Body.String())
			}
			if !strings.Contains(rec.Body.String(), tc.wantText) {
				t.Fatalf("expected response to contain %q, got %s", tc.wantText, rec.Body.String())
			}
		})
	}
}

func TestBuildAllowedOriginsRejectsWildcardInRelease(t *testing.T) {
	origins := buildAllowedOrigins("release", "*,https://admin.example.com")
	if len(origins) != 1 || origins[0] != "https://admin.example.com" {
		t.Fatalf("expected explicit release origin only, got %#v", origins)
	}

	fallback := buildAllowedOrigins("release", "*")
	if len(fallback) != 1 || fallback[0] != defaultReleaseAllowedOrigin {
		t.Fatalf("expected default release origin fallback, got %#v", fallback)
	}
}
