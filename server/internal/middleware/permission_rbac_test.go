package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"

	"github.com/gin-gonic/gin"
	gormsqlite "gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupPermissionRBACDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(gormsqlite.Open("file::memory:?cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(
		&model.SysAdmin{},
		&model.SysRole{},
		&model.SysMenu{},
		&model.SysAdminRole{},
		&model.SysRoleMenu{},
	); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}
	previousDB := repository.DB
	repository.DB = db
	t.Cleanup(func() { repository.DB = previousDB })
	return db
}

func seedAdminPermission(t *testing.T, db *gorm.DB, adminID, roleID, menuID uint64, roleKey, permission string) {
	t.Helper()
	if err := db.Create(&model.SysAdmin{ID: adminID, Username: roleKey + "_admin", Password: "x", Status: 1}).Error; err != nil {
		t.Fatalf("seed admin: %v", err)
	}
	if err := db.Create(&model.SysRole{ID: roleID, Name: roleKey, Key: roleKey, Status: 1}).Error; err != nil {
		t.Fatalf("seed role: %v", err)
	}
	if err := db.Create(&model.SysMenu{ID: menuID, Title: permission, Type: 2, Permission: permission, Status: 1, Visible: true}).Error; err != nil {
		t.Fatalf("seed menu: %v", err)
	}
	if err := db.Create(&model.SysAdminRole{AdminID: adminID, RoleID: roleID}).Error; err != nil {
		t.Fatalf("seed admin role: %v", err)
	}
	if err := db.Create(&model.SysRoleMenu{RoleID: roleID, MenuID: menuID}).Error; err != nil {
		t.Fatalf("seed role menu: %v", err)
	}
}

func performPermissionRequest(adminID uint64, isSuper bool, permission string) *httptest.ResponseRecorder {
	router := gin.New()
	router.GET("/protected",
		func(c *gin.Context) {
			c.Set("admin_id", adminID)
			c.Set("is_super", isSuper)
			c.Next()
		},
		RequirePermission(permission),
		func(c *gin.Context) {
			c.String(http.StatusOK, "ok")
		},
	)
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/protected", nil)
	router.ServeHTTP(w, req)
	return w
}

func TestRequirePermissionUsesRoleMenuJoinColumns(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupPermissionRBACDB(t)
	seedAdminPermission(t, db, 1001, 2001, 3001, "finance", "finance:transaction:list")

	w := performPermissionRequest(1001, false, "finance:transaction:list")

	if w.Code != http.StatusOK {
		t.Fatalf("expected finance role to pass assigned permission, got %d body=%s", w.Code, w.Body.String())
	}
}

func TestRequirePermissionRejectsUnassignedPermission(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupPermissionRBACDB(t)
	seedAdminPermission(t, db, 1002, 2002, 3002, "viewer", "finance:transaction:view")

	w := performPermissionRequest(1002, false, "finance:escrow:freeze")

	if w.Code != http.StatusForbidden {
		t.Fatalf("expected viewer to be rejected for unassigned freeze permission, got %d body=%s", w.Code, w.Body.String())
	}
}

func TestRequirePermissionAllowsSuperAdmin(t *testing.T) {
	gin.SetMode(gin.TestMode)
	setupPermissionRBACDB(t)

	w := performPermissionRequest(9999, true, "finance:transaction:approve")

	if w.Code != http.StatusOK {
		t.Fatalf("expected super admin bypass, got %d body=%s", w.Code, w.Body.String())
	}
}
