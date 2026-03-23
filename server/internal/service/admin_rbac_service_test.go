package service

import (
	"testing"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"

	gormsqlite "gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupAdminRBACGuardDB(t *testing.T) *gorm.DB {
	t.Helper()

	db, err := gorm.Open(gormsqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite db: %v", err)
	}

	if err := db.AutoMigrate(&model.SysRole{}, &model.SysMenu{}); err != nil {
		t.Fatalf("auto migrate rbac models: %v", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		t.Fatalf("get sql db: %v", err)
	}
	sqlDB.SetMaxOpenConns(1)
	sqlDB.SetMaxIdleConns(1)

	previousDB := repository.DB
	repository.DB = db
	t.Cleanup(func() {
		repository.DB = previousDB
		_ = sqlDB.Close()
	})

	return db
}

func seedAdminRBACRoles(t *testing.T, db *gorm.DB) map[string]uint64 {
	t.Helper()

	roles := []model.SysRole{
		{ID: 1, Name: "系统管理员", Key: ReservedRoleSystemAdmin, Status: 1},
		{ID: 2, Name: "安全管理员", Key: ReservedRoleSecurityAdmin, Status: 1},
		{ID: 3, Name: "审计员", Key: ReservedRoleSecurityAudit, Status: 1},
		{ID: 4, Name: "普通财务", Key: "finance", Status: 1},
		{ID: 5, Name: "禁用角色", Key: "disabled_role", Status: 1},
	}
	if err := db.Create(&roles).Error; err != nil {
		t.Fatalf("seed roles: %v", err)
	}
	if err := db.Model(&model.SysRole{}).Where("id = ?", 5).Update("status", 0).Error; err != nil {
		t.Fatalf("disable role: %v", err)
	}

	return map[string]uint64{
		"system":   1,
		"security": 2,
		"audit":    3,
		"finance":  4,
		"disabled": 5,
	}
}

func TestValidateAdminRoleAssignmentRejectsMixedSeparationRoles(t *testing.T) {
	db := setupAdminRBACGuardDB(t)
	ids := seedAdminRBACRoles(t, db)

	if _, err := ValidateAdminRoleAssignment([]uint64{ids["system"], ids["security"]}); err == nil {
		t.Fatal("expected mutual exclusion error")
	}
	if _, err := ValidateAdminRoleAssignment([]uint64{ids["audit"], ids["finance"]}); err == nil {
		t.Fatal("expected standalone separation role error")
	}
}

func TestValidateAdminRoleAssignmentRejectsDisabledRole(t *testing.T) {
	db := setupAdminRBACGuardDB(t)
	ids := seedAdminRBACRoles(t, db)

	if _, err := ValidateAdminRoleAssignment([]uint64{ids["disabled"]}); err == nil {
		t.Fatal("expected disabled role error")
	}
}

func TestValidateAdminRoleAssignmentAcceptsStandaloneReservedRole(t *testing.T) {
	db := setupAdminRBACGuardDB(t)
	ids := seedAdminRBACRoles(t, db)

	roles, err := ValidateAdminRoleAssignment([]uint64{ids["audit"]})
	if err != nil {
		t.Fatalf("validate role assignment: %v", err)
	}
	if len(roles) != 1 || roles[0].Key != ReservedRoleSecurityAudit {
		t.Fatalf("unexpected roles: %+v", roles)
	}
}

func TestValidateRoleMenuAssignmentRejectsWritePermissionForAuditor(t *testing.T) {
	db := setupAdminRBACGuardDB(t)
	ids := seedAdminRBACRoles(t, db)

	menus := []model.SysMenu{
		{ID: 11, Title: "日志查看", Permission: "system:log:list", Status: 1},
		{ID: 12, Title: "退款审批", Permission: "finance:transaction:approve", Status: 1},
	}
	if err := db.Create(&menus).Error; err != nil {
		t.Fatalf("seed menus: %v", err)
	}

	if _, _, err := ValidateRoleMenuAssignment(ids["audit"], []uint64{11, 12}); err == nil {
		t.Fatal("expected read-only permission restriction")
	}
}

func TestValidateRoleMenuAssignmentAllowsReadOnlyForAuditor(t *testing.T) {
	db := setupAdminRBACGuardDB(t)
	ids := seedAdminRBACRoles(t, db)

	menus := []model.SysMenu{
		{ID: 21, Title: "日志查看", Permission: "system:log:list", Status: 1},
		{ID: 22, Title: "交易详情", Permission: "finance:transaction:view", Status: 1},
	}
	if err := db.Create(&menus).Error; err != nil {
		t.Fatalf("seed menus: %v", err)
	}

	role, assignedMenus, err := ValidateRoleMenuAssignment(ids["audit"], []uint64{21, 22})
	if err != nil {
		t.Fatalf("validate role menu assignment: %v", err)
	}
	if role == nil || role.Key != ReservedRoleSecurityAudit {
		t.Fatalf("unexpected role: %+v", role)
	}
	if len(assignedMenus) != 2 {
		t.Fatalf("unexpected menu count: %d", len(assignedMenus))
	}
}
