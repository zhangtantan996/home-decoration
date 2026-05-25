package router

import (
	"bufio"
	"database/sql"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
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

func TestSupervisorAccountMutationsRequireReasonAndReauth(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := setupAdminSecurityRouter(t)

	if err := repository.DB.AutoMigrate(
		&model.User{},
		&model.SupervisorPhoneWhitelist{},
		&model.SupervisorApplication{},
		&model.SupervisorAccount{},
		&model.SupervisorProfile{},
	); err != nil {
		t.Fatalf("auto migrate supervisor mutation models: %v", err)
	}

	if err := repository.DB.Create(&model.SysMenu{ID: 2001, Title: "监理编辑", Type: 3, Permission: "supervision:supervisor:edit", Status: 1}).Error; err != nil {
		t.Fatalf("seed supervisor edit permission: %v", err)
	}
	role := model.SysRole{ID: 2002, Name: "监理管理员", Key: "supervisor_admin", Status: 1}
	if err := repository.DB.Create(&role).Error; err != nil {
		t.Fatalf("seed role: %v", err)
	}
	if err := repository.DB.Create(&model.SysRoleMenu{RoleID: role.ID, MenuID: 2001}).Error; err != nil {
		t.Fatalf("seed role menu: %v", err)
	}
	if err := repository.DB.Create(&model.SysAdminRole{AdminID: 1, RoleID: role.ID}).Error; err != nil {
		t.Fatalf("seed admin role: %v", err)
	}

	whitelist := model.SupervisorPhoneWhitelist{Base: model.Base{ID: 3001}, Phone: "13800139111", Status: 1, CreatedByAdminID: 1}
	if err := repository.DB.Create(&whitelist).Error; err != nil {
		t.Fatalf("seed whitelist: %v", err)
	}
	for _, application := range []model.SupervisorApplication{
		{Base: model.Base{ID: 3002}, Phone: whitelist.Phone, WhitelistID: whitelist.ID, Status: 0, FormJSON: `{"realName":"张监理","cityCode":"610100","serviceArea":["610100"],"certifications":["/uploads/cases/cert.jpg"],"idNo":"110101199001011234","orgName":"监理机构","agreementConfirmed":true}`, SubmittedAt: time.Now()},
		{Base: model.Base{ID: 3004}, Phone: "13800139112", WhitelistID: whitelist.ID, Status: 0, FormJSON: `{"realName":"李监理","cityCode":"610100","serviceArea":["610100"],"certifications":["/uploads/cases/cert.jpg"],"idNo":"110101199001011235","orgName":"监理机构","agreementConfirmed":true}`, SubmittedAt: time.Now()},
	} {
		if err := repository.DB.Create(&application).Error; err != nil {
			t.Fatalf("seed supervisor application: %v", err)
		}
	}
	account := model.SupervisorAccount{Base: model.Base{ID: 3003}, Phone: "13800139222", Status: 1}
	if err := repository.DB.Create(&account).Error; err != nil {
		t.Fatalf("seed supervisor account: %v", err)
	}
	profile := model.SupervisorProfile{Base: model.Base{ID: 3005}, UserID: 9001, RealName: "王监理", Phone: "13800139333", Status: 1}
	if err := repository.DB.Create(&profile).Error; err != nil {
		t.Fatalf("seed supervisor profile: %v", err)
	}

	token := signAdminToken(t, config.GetConfig().JWT.Secret, jwt.MapClaims{
		"admin_id":    float64(1),
		"username":    "sec-admin",
		"is_super":    false,
		"token_type":  "admin",
		"token_use":   "access",
		"login_stage": "active",
		"sid":         "admin-test-session",
		"exp":         time.Now().Add(time.Hour).Unix(),
	})

	testCases := []struct {
		name string
		path string
		body string
	}{
		{name: "approve application", path: "/api/v1/admin/supervisor-applications/3002/approve", body: `{"reason":"审核通过"}`},
		{name: "reject application", path: "/api/v1/admin/supervisor-applications/3004/reject", body: `{"rejectReason":"资料不全","reason":"审核拒绝"}`},
		{name: "update account status", path: "/api/v1/admin/supervisor-accounts/3003/status", body: `{"status":0,"reason":"禁用账号"}`},
		{name: "update supervisor profile", path: "/api/v1/admin/supervisors/3005", body: `{"realName":"王监理新","reason":"更新资料"}`},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			req := newSupervisorMutationRequest(tc.path, tc.body)
			req.Header.Set("Authorization", "Bearer "+token)
			req.Header.Set("Content-Type", "application/json")
			rec := httptest.NewRecorder()

			r.ServeHTTP(rec, req)

			if rec.Code != http.StatusOK {
				t.Fatalf("expected middleware business error over http 200, got %d body=%s", rec.Code, rec.Body.String())
			}
			if !strings.Contains(rec.Body.String(), `"code":403`) || !strings.Contains(rec.Body.String(), "缺少有效的再认证凭证") {
				t.Fatalf("expected reauth guard for %s, got %s", tc.name, rec.Body.String())
			}
		})
	}

	reasonReq := newSupervisorMutationRequest("/api/v1/admin/supervisors/3005", `{"realName":"无原因更新"}`)
	reasonReq.Header.Set("Authorization", "Bearer "+token)
	reasonReq.Header.Set("Content-Type", "application/json")
	reasonRec := httptest.NewRecorder()
	r.ServeHTTP(reasonRec, reasonReq)
	if reasonRec.Code != http.StatusBadRequest {
		t.Fatalf("expected reason guard http 400, got %d body=%s", reasonRec.Code, reasonRec.Body.String())
	}
	if !strings.Contains(reasonRec.Body.String(), `"code":400`) || !strings.Contains(reasonRec.Body.String(), "请填写操作原因") {
		t.Fatalf("expected reason guard before mutation, got %s", reasonRec.Body.String())
	}
}

func newSupervisorMutationRequest(path string, body string) *http.Request {
	method := http.MethodPost
	if strings.Contains(path, "/status") {
		method = http.MethodPatch
	} else if strings.Contains(path, "/supervisors/") && !strings.Contains(path, "/supervisor-") {
		method = http.MethodPut
	}
	return httptest.NewRequest(method, path, strings.NewReader(body))
}

func TestReleaseKnownMigrationsIncludesV151RuntimeMigrations(t *testing.T) {
	repoRoot, err := filepath.Abs(filepath.Join("..", "..", ".."))
	if err != nil {
		t.Fatalf("resolve repo root: %v", err)
	}
	file, err := os.Open(filepath.Join(repoRoot, "deploy", "scripts", "lib", "release_common.sh"))
	if err != nil {
		t.Fatalf("open release_common.sh: %v", err)
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	content := ""
	for scanner.Scan() {
		content += scanner.Text() + "\n"
	}
	if err := scanner.Err(); err != nil {
		t.Fatalf("read release_common.sh: %v", err)
	}

	for _, migration := range []string{
		"server/migrations/v1.15.1_add_admin_phone_view_permission.sql",
		"server/migrations/v1.15.1_add_supervisor_runtime_schema.sql",
		"server/migrations/v1.15.10_rehome_supervisor_management_menu.sql",
	} {
		if !strings.Contains(content, migration) {
			t.Fatalf("release_apply_known_migrations must include %s", migration)
		}
	}
}

func TestSupervisorRuntimeMigrationSeedsAdminMenus(t *testing.T) {
	repoRoot, err := filepath.Abs(filepath.Join("..", "..", ".."))
	if err != nil {
		t.Fatalf("resolve repo root: %v", err)
	}
	contentBytes, err := os.ReadFile(filepath.Join(repoRoot, "server", "migrations", "v1.15.1_add_supervisor_runtime_schema.sql"))
	if err != nil {
		t.Fatalf("read supervisor runtime migration: %v", err)
	}
	content := string(contentBytes)

	for _, expected := range []string{
		"监理管理",
		"/supervisors/list",
		"/supervisors/whitelist",
		"/supervisors/applications",
		"/supervisors/assignments",
		"pages/supervisors/SupervisorList",
		"pages/supervisors/WhitelistManager",
		"pages/supervisors/ApplicationReview",
		"pages/supervisors/SupervisorAssignment",
		"supervision:supervisor:list",
		"supervision:supervisor:edit",
		"supervision:assignment:manage",
	} {
		if !strings.Contains(content, expected) {
			t.Fatalf("supervisor runtime migration must seed admin menu/permission %s", expected)
		}
	}
}

func TestSupervisorManagementMenuRehomeMigrationMatchesSidebarGrouping(t *testing.T) {
	repoRoot, err := filepath.Abs(filepath.Join("..", "..", ".."))
	if err != nil {
		t.Fatalf("resolve repo root: %v", err)
	}
	contentBytes, err := os.ReadFile(filepath.Join(repoRoot, "server", "migrations", "v1.15.10_rehome_supervisor_management_menu.sql"))
	if err != nil {
		t.Fatalf("read supervisor management menu rehome migration: %v", err)
	}
	content := string(contentBytes)

	for _, expected := range []string{
		"'/supervisors'",
		"'监理管理'",
		"sort = 35",
		"'/supervisors/list'",
		"'/supervisors/whitelist'",
		"'/supervisors/applications'",
		"'/supervisors/assignments'",
	} {
		if !strings.Contains(content, expected) {
			t.Fatalf("supervisor management menu rehome migration must contain %s", expected)
		}
	}
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

func TestAdminPayoutRetryRequiresReasonBeforeReauth(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := setupAdminSecurityRouter(t)

	if err := repository.DB.Create(&model.SysMenu{ID: 7101, Title: "出款审批", Type: 3, Permission: "finance:transaction:approve", Status: 1}).Error; err != nil {
		t.Fatalf("seed finance approve permission: %v", err)
	}
	role := model.SysRole{ID: 7102, Name: "财务审批", Key: "finance_approve", Status: 1}
	if err := repository.DB.Create(&role).Error; err != nil {
		t.Fatalf("seed finance role: %v", err)
	}
	if err := repository.DB.Create(&model.SysRoleMenu{RoleID: role.ID, MenuID: 7101}).Error; err != nil {
		t.Fatalf("seed role menu: %v", err)
	}
	if err := repository.DB.Create(&model.SysAdminRole{AdminID: 1, RoleID: role.ID}).Error; err != nil {
		t.Fatalf("seed admin role: %v", err)
	}

	token := signAdminToken(t, config.GetConfig().JWT.Secret, jwt.MapClaims{
		"admin_id":    float64(1),
		"username":    "sec-admin",
		"is_super":    false,
		"token_type":  "admin",
		"token_use":   "access",
		"login_stage": "active",
		"sid":         "admin-payout-test-session",
		"exp":         time.Now().Add(time.Hour).Unix(),
	})

	req := httptest.NewRequest(http.MethodPost, "/api/v1/admin/payout/1/retry", strings.NewReader(`{}`))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected reason guard http 400, got %d body=%s", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), "请填写操作原因") {
		t.Fatalf("expected missing reason response, got %s", rec.Body.String())
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

func TestAdminNetworkGateBlocksDisallowedIP(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := setupAdminSecurityRouter(t)

	cfg := config.GetConfig()
	cfg.AdminAuth.APIIPEnforced = true
	cfg.AdminAuth.AllowedCIDRs = "10.0.0.0/8"

	token := signAdminToken(t, config.GetConfig().JWT.Secret, jwt.MapClaims{
		"admin_id":    float64(1),
		"username":    "sec-admin",
		"is_super":    true,
		"token_type":  "admin",
		"token_use":   "access",
		"login_stage": "active",
		"exp":         time.Now().Add(time.Hour).Unix(),
	})

	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/info", nil)
	req.RemoteAddr = "203.0.113.10:12345"
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()

	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected middleware business error over http 200, got %d body=%s", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), `"code":403`) || !strings.Contains(rec.Body.String(), "当前网络不允许访问管理接口") {
		t.Fatalf("expected network gate error, got %s", rec.Body.String())
	}
}

func TestAdminNetworkGateAllowsConfiguredCIDR(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := setupAdminSecurityRouter(t)

	cfg := config.GetConfig()
	cfg.AdminAuth.APIIPEnforced = true
	cfg.AdminAuth.AllowedCIDRs = "10.0.0.0/8"

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
	req.RemoteAddr = "10.2.3.4:12345"
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()

	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected allowed cidr to pass through admin network gate, got %d body=%s", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), "\"loginStage\":\"setup_required\"") {
		t.Fatalf("expected downstream handler response, got %s", rec.Body.String())
	}
}
