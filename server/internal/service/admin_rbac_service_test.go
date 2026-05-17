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
	if err := db.AutoMigrate(&model.SysAdmin{}, &model.SysAdminRole{}, &model.SysRoleMenu{}); err != nil {
		t.Fatalf("auto migrate admin rbac relation models: %v", err)
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
		{ID: 6, Name: "运营", Key: "operations", Status: 1},
		{ID: 7, Name: "自定义A", Key: "custom_a", Status: 1},
		{ID: 8, Name: "自定义B", Key: "custom_b", Status: 1},
		{ID: 9, Name: "监理专员", Key: DeprecatedRoleProjectSupervisor, Status: 0},
	}
	if err := db.Create(&roles).Error; err != nil {
		t.Fatalf("seed roles: %v", err)
	}
	if err := db.Model(&model.SysRole{}).Where("id = ?", 5).Update("status", 0).Error; err != nil {
		t.Fatalf("disable role: %v", err)
	}

	return map[string]uint64{
		"system":     1,
		"security":   2,
		"audit":      3,
		"finance":    4,
		"disabled":   5,
		"ops":        6,
		"customA":    7,
		"customB":    8,
		"deprecated": 9,
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

func TestValidateAdminRoleAssignmentRejectsPresetRoleMixedAssignment(t *testing.T) {
	db := setupAdminRBACGuardDB(t)
	ids := seedAdminRBACRoles(t, db)

	if _, err := ValidateAdminRoleAssignment([]uint64{ids["ops"], ids["customA"]}); err == nil {
		t.Fatal("expected preset role standalone assignment restriction")
	}
	if _, err := ValidateAdminRoleAssignment([]uint64{ids["finance"], ids["customA"]}); err == nil {
		t.Fatal("expected finance standalone assignment restriction")
	}
}

func TestValidateAdminRoleAssignmentAllowsCustomRoleCombination(t *testing.T) {
	db := setupAdminRBACGuardDB(t)
	ids := seedAdminRBACRoles(t, db)

	if _, err := ValidateAdminRoleAssignment([]uint64{ids["customA"], ids["customB"]}); err != nil {
		t.Fatalf("expected custom role combination to pass, got %v", err)
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

func seedOperatorScopedRBAC(t *testing.T, db *gorm.DB) {
	t.Helper()

	roles := []model.SysRole{
		{ID: 101, Name: "超级管理员", Key: "super_admin", Status: 1},
		{ID: 102, Name: "运营", Key: "operations", Status: 1},
		{ID: 103, Name: "财务", Key: "finance", Status: 1},
		{ID: 104, Name: "客服", Key: "customer_service", Status: 1},
	}
	if err := db.Create(&roles).Error; err != nil {
		t.Fatalf("seed operator roles: %v", err)
	}

	menus := []model.SysMenu{
		{ID: 201, Title: "用户查看", Permission: "system:user:list", Status: 1},
		{ID: 202, Title: "管理员编辑", Permission: "system:admin:edit", Status: 1},
		{ID: 203, Title: "财务审批", Permission: "finance:transaction:approve", Status: 1},
	}
	if err := db.Create(&menus).Error; err != nil {
		t.Fatalf("seed operator menus: %v", err)
	}

	roleMenus := []model.SysRoleMenu{
		{RoleID: 102, MenuID: 201},
		{RoleID: 102, MenuID: 202},
		{RoleID: 103, MenuID: 203},
		{RoleID: 104, MenuID: 201},
	}
	if err := db.Create(&roleMenus).Error; err != nil {
		t.Fatalf("seed operator role menus: %v", err)
	}

	admins := []model.SysAdmin{
		{ID: 301, Username: "super", Status: 1, IsSuperAdmin: true},
		{ID: 302, Username: "ops", Status: 1},
		{ID: 303, Username: "finance", Status: 1},
	}
	if err := db.Create(&admins).Error; err != nil {
		t.Fatalf("seed operator admins: %v", err)
	}

	adminRoles := []model.SysAdminRole{
		{AdminID: 301, RoleID: 101},
		{AdminID: 302, RoleID: 102},
		{AdminID: 303, RoleID: 103},
	}
	if err := db.Create(&adminRoles).Error; err != nil {
		t.Fatalf("seed operator admin roles: %v", err)
	}
}

func TestValidateAdminRoleAssignmentForOperatorRejectsPrivilegeEscalation(t *testing.T) {
	db := setupAdminRBACGuardDB(t)
	seedOperatorScopedRBAC(t, db)

	if _, err := ValidateAdminRoleAssignmentForOperator(302, 0, []uint64{103}); err == nil {
		t.Fatal("expected operator-scoped role assignment to reject finance escalation")
	}
}

func TestValidateAdminRoleAssignmentForOperatorRejectsSelfRoleChange(t *testing.T) {
	db := setupAdminRBACGuardDB(t)
	seedOperatorScopedRBAC(t, db)

	if _, err := ValidateAdminRoleAssignmentForOperator(302, 302, []uint64{104}); err == nil {
		t.Fatal("expected self role assignment to be rejected")
	}
}

func TestValidateAdminRoleAssignmentForOperatorAllowsSubsetRole(t *testing.T) {
	db := setupAdminRBACGuardDB(t)
	seedOperatorScopedRBAC(t, db)

	if _, err := ValidateAdminRoleAssignmentForOperator(302, 0, []uint64{104}); err != nil {
		t.Fatalf("expected subset role assignment to pass, got %v", err)
	}
}

func TestValidateAdminTargetManageableForOperatorRejectsHigherPrivilegeTarget(t *testing.T) {
	db := setupAdminRBACGuardDB(t)
	seedOperatorScopedRBAC(t, db)

	if err := ValidateAdminTargetManageableForOperator(302, 303); err == nil {
		t.Fatal("expected managing a higher-privilege target admin to be rejected")
	}
}

func TestValidateRoleMenuAssignmentForOperatorRejectsOwnRoleMutation(t *testing.T) {
	db := setupAdminRBACGuardDB(t)
	seedOperatorScopedRBAC(t, db)

	if _, _, err := ValidateRoleMenuAssignmentForOperator(302, 102, []uint64{201, 202}); err == nil {
		t.Fatal("expected own role menu mutation to be rejected")
	}
}

func TestValidateRoleMenuAssignmentForOperatorRejectsPermissionOutsideScope(t *testing.T) {
	db := setupAdminRBACGuardDB(t)
	seedOperatorScopedRBAC(t, db)

	if _, _, err := ValidateRoleMenuAssignmentForOperator(302, 104, []uint64{201, 203}); err == nil {
		t.Fatal("expected menu assignment outside operator scope to be rejected")
	}
}

func TestValidateProtectedRoleSourceMutationForOperatorRequiresSuperAdmin(t *testing.T) {
	db := setupAdminRBACGuardDB(t)
	seedOperatorScopedRBAC(t, db)

	if err := ValidateProtectedRoleSourceMutationForOperator(302, ReservedRoleSecurityAdmin); err == nil {
		t.Fatal("expected non-super operator to be rejected for protected role source mutation")
	}
	if err := ValidateProtectedRoleSourceMutationForOperator(301, ReservedRoleSecurityAdmin); err != nil {
		t.Fatalf("expected super admin to mutate protected role source, got %v", err)
	}
	if err := ValidateProtectedRoleSourceMutationForOperator(302, "customer_service"); err != nil {
		t.Fatalf("expected ordinary role source mutation to pass, got %v", err)
	}
}

func TestValidateDeprecatedAdminRoleMutationRejectsProjectSupervisorRole(t *testing.T) {
	if err := ValidateDeprecatedAdminRoleMutation(DeprecatedRoleProjectSupervisor); err == nil {
		t.Fatal("expected deprecated project supervisor role mutation to be rejected")
	}
	if err := ValidateDeprecatedAdminRoleMutation("operations"); err != nil {
		t.Fatalf("expected ordinary role mutation to pass, got %v", err)
	}
}

func TestValidateRoleMenuAssignmentRejectsDeprecatedRole(t *testing.T) {
	db := setupAdminRBACGuardDB(t)
	ids := seedAdminRBACRoles(t, db)

	menus := []model.SysMenu{{ID: 31, Title: "监理工作台", Permission: "supervision:workspace:view", Status: 1}}
	if err := db.Create(&menus).Error; err != nil {
		t.Fatalf("seed menus: %v", err)
	}

	if _, _, err := ValidateRoleMenuAssignment(ids["deprecated"], []uint64{31}); err == nil {
		t.Fatal("expected deprecated role menu assignment to be rejected")
	}
}
