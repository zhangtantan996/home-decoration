package handler

import (
	"testing"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"

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
