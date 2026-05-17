package handler

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"

	"github.com/gin-gonic/gin"
	gormsqlite "gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupAdminAuthRBACTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(gormsqlite.Open("file:admin_auth_rbac?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(
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

func TestAdminLoginRBACPayloadIgnoresDisabledRoles(t *testing.T) {
	db := setupAdminAuthRBACTestDB(t)
	roles := []model.SysRole{
		{ID: 701, Name: "财务", Key: "finance", Status: 1},
		{ID: 702, Name: "停用角色", Key: "disabled_finance", Status: 0},
	}
	if err := db.Create(&roles).Error; err != nil {
		t.Fatalf("seed roles: %v", err)
	}
	if err := db.Model(&model.SysRole{}).Where("id = ?", 702).Update("status", 0).Error; err != nil {
		t.Fatalf("disable role: %v", err)
	}
	roles[1].Status = 0
	menus := []model.SysMenu{
		{ID: 801, Title: "资金中心", Type: 1, Permission: "", Path: "/finance", Status: 1, Visible: true, Sort: 1},
		{ID: 802, ParentID: 801, Title: "交易流水", Type: 2, Permission: "finance:transaction:list", Path: "/finance/transactions", Status: 1, Visible: true, Sort: 2},
		{ID: 803, ParentID: 801, Title: "冻结资金", Type: 3, Permission: "finance:escrow:freeze", Status: 1, Visible: true, Sort: 3},
	}
	if err := db.Create(&menus).Error; err != nil {
		t.Fatalf("seed menus: %v", err)
	}
	roleMenus := []model.SysRoleMenu{
		{RoleID: 701, MenuID: 801},
		{RoleID: 701, MenuID: 802},
		{RoleID: 702, MenuID: 803},
	}
	if err := db.Create(&roleMenus).Error; err != nil {
		t.Fatalf("seed role menus: %v", err)
	}

	admin := &model.SysAdmin{ID: 901, Username: "finance", Status: 1, Roles: roles}
	permissions := getAdminPermissions(admin)
	if !containsString(permissions, "finance:transaction:list") {
		t.Fatalf("expected active role permission in login payload, got %+v", permissions)
	}
	if containsString(permissions, "finance:escrow:freeze") {
		t.Fatalf("disabled role permission leaked into login payload: %+v", permissions)
	}

	menuTree := getAdminMenuTree(admin)
	if !containsMenuPath(menuTree, "/finance/transactions") {
		t.Fatalf("expected active role menu in login tree, got %+v", menuTree)
	}
	if containsMenuPermission(menuTree, "finance:escrow:freeze") {
		t.Fatalf("disabled role menu leaked into login tree: %+v", menuTree)
	}

	profileRoles, ok := buildAdminProfile(admin)["roles"].([]string)
	if !ok {
		t.Fatalf("expected profile roles to be []string")
	}
	if containsString(profileRoles, "disabled_finance") {
		t.Fatalf("disabled role leaked into login profile roles: %+v", profileRoles)
	}
	if !containsString(profileRoles, "finance") {
		t.Fatalf("expected active role in login profile roles: %+v", profileRoles)
	}
}

func TestAdminHasOpsWorkspaceAccess(t *testing.T) {
	tests := []struct {
		name  string
		admin *model.SysAdmin
		want  bool
	}{
		{
			name: "operations_allowed",
			admin: &model.SysAdmin{Roles: []model.SysRole{
				{ID: 1, Key: "operations", Status: 1},
			}},
			want: true,
		},
		{
			name: "product_manager_allowed",
			admin: &model.SysAdmin{Roles: []model.SysRole{
				{ID: 2, Key: "product_manager", Status: 1},
			}},
			want: true,
		},
		{
			name: "system_admin_allowed",
			admin: &model.SysAdmin{Roles: []model.SysRole{
				{ID: 3, Key: "system_admin", Status: 1},
			}},
			want: true,
		},
		{
			name: "super_admin_flag_allowed",
			admin: &model.SysAdmin{
				IsSuperAdmin: true,
				Roles:        []model.SysRole{{ID: 4, Key: "viewer", Status: 1}},
			},
			want: true,
		},
		{
			name: "disabled_operations_denied",
			admin: &model.SysAdmin{Roles: []model.SysRole{
				{ID: 5, Key: "operations", Status: 0},
			}},
			want: false,
		},
		{
			name: "viewer_without_ops_permissions_denied",
			admin: &model.SysAdmin{Roles: []model.SysRole{
				{ID: 6, Key: "viewer", Status: 1},
			}},
			want: false,
		},
		{
			name:  "nil_denied",
			admin: nil,
			want:  false,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if got := adminHasOpsWorkspaceAccess(tc.admin); got != tc.want {
				t.Fatalf("adminHasOpsWorkspaceAccess() = %v, want %v", got, tc.want)
			}
		})
	}
}

func TestAdminHasOpsWorkspaceAccessAllowsOpsPermissionRole(t *testing.T) {
	db := setupAdminAuthRBACTestDB(t)
	role := model.SysRole{ID: 911, Name: "管理员", Key: "admin", Status: 1}
	menu := model.SysMenu{ID: 912, Title: "设计师管理", Permission: "provider:designer:list", Status: 1}
	if err := db.Create(&role).Error; err != nil {
		t.Fatalf("seed role: %v", err)
	}
	if err := db.Create(&menu).Error; err != nil {
		t.Fatalf("seed menu: %v", err)
	}
	if err := db.Create(&model.SysRoleMenu{RoleID: role.ID, MenuID: menu.ID}).Error; err != nil {
		t.Fatalf("seed role menu: %v", err)
	}

	admin := &model.SysAdmin{Roles: []model.SysRole{role}}
	if !adminHasOpsWorkspaceAccess(admin) {
		t.Fatal("expected role with ops workspace permission to access Ops")
	}
}

func TestAdminUpdateRolePreservesStatusWhenOmitted(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupAdminAuthRBACTestDB(t)
	if err := db.AutoMigrate(&model.AuditLog{}); err != nil {
		t.Fatalf("auto migrate audit logs: %v", err)
	}
	role := model.SysRole{ID: 910, Name: "运营", Key: "operations", Remark: "old", Sort: 1, Status: 1}
	if err := db.Create(&role).Error; err != nil {
		t.Fatalf("seed role: %v", err)
	}

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPut, "/admin/roles/910", bytes.NewBufferString(`{"name":"运营管理","key":"operations","sort":2,"remark":"更新说明"}`))
	ctx.Request.Header.Set("Content-Type", "application/json")
	ctx.Params = gin.Params{{Key: "id", Value: "910"}}
	ctx.Set("admin_id", uint64(7001))

	AdminUpdateRole(ctx)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}
	var updated model.SysRole
	if err := db.First(&updated, role.ID).Error; err != nil {
		t.Fatalf("load updated role: %v", err)
	}
	if updated.Status != 1 {
		t.Fatalf("expected omitted status to preserve active role, got %d", updated.Status)
	}
}

func containsString(items []string, target string) bool {
	for _, item := range items {
		if item == target {
			return true
		}
	}
	return false
}

func containsMenuPath(items []*model.SysMenu, target string) bool {
	for _, item := range items {
		if item.Path == target || containsMenuPath(item.Children, target) {
			return true
		}
	}
	return false
}

func containsMenuPermission(items []*model.SysMenu, target string) bool {
	for _, item := range items {
		if item.Permission == target || containsMenuPermission(item.Children, target) {
			return true
		}
	}
	return false
}

func TestAdminListRolesExcludesDeprecatedProjectSupervisor(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupAdminAuthRBACTestDB(t)
	roles := []model.SysRole{
		{ID: 921, Name: "运营管理", Key: "operations", Status: 1, Sort: 1},
		{ID: 922, Name: "监理专员", Key: "project_supervisor", Status: 0, Sort: 2},
	}
	if err := db.Create(&roles).Error; err != nil {
		t.Fatalf("seed roles: %v", err)
	}

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/admin/roles", nil)

	AdminListRoles(ctx)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}
	body := recorder.Body.String()
	if bytes.Contains([]byte(body), []byte("project_supervisor")) {
		t.Fatalf("deprecated project supervisor role leaked into role list: %s", body)
	}
	if !bytes.Contains([]byte(body), []byte("operations")) {
		t.Fatalf("expected operations role in role list: %s", body)
	}
}

func TestAdminCreateRoleRejectsDeprecatedProjectSupervisorKey(t *testing.T) {
	gin.SetMode(gin.TestMode)
	setupAdminAuthRBACTestDB(t)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/admin/roles", bytes.NewBufferString(`{"name":"监理专员","key":"project_supervisor"}`))
	ctx.Request.Header.Set("Content-Type", "application/json")
	ctx.Set("admin_id", uint64(7001))

	AdminCreateRole(ctx)

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d body=%s", recorder.Code, recorder.Body.String())
	}
}
