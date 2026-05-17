package service

import (
	"fmt"
	"strings"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
)

const (
	ReservedRoleSystemAdmin         = "system_admin"
	ReservedRoleSecurityAdmin       = "security_admin"
	ReservedRoleSecurityAudit       = "security_auditor"
	DeprecatedRoleProjectSupervisor = "project_supervisor"
)

var reservedSeparationRoleKeys = map[string]struct{}{
	ReservedRoleSystemAdmin:   {},
	ReservedRoleSecurityAdmin: {},
	ReservedRoleSecurityAudit: {},
}

var standaloneAssignmentRoleKeys = map[string]struct{}{
	"super_admin":      {},
	"operations":       {},
	"product_manager":  {},
	"finance":          {},
	"risk":             {},
	"customer_service": {},
	"viewer":           {},
}

var readOnlyPermissionActions = map[string]struct{}{
	"list":   {},
	"view":   {},
	"detail": {},
	"export": {},
}

func IsReservedSeparationRoleKey(roleKey string) bool {
	_, ok := reservedSeparationRoleKeys[strings.TrimSpace(roleKey)]
	return ok
}

func IsProtectedAdminRoleKey(roleKey string) bool {
	return isBreakGlassRole(roleKey) || IsReservedSeparationRoleKey(roleKey)
}

func IsDeprecatedAdminRoleKey(roleKey string) bool {
	return strings.TrimSpace(roleKey) == DeprecatedRoleProjectSupervisor
}

func ValidateDeprecatedAdminRoleMutation(roleKeys ...string) error {
	for _, roleKey := range roleKeys {
		if IsDeprecatedAdminRoleKey(roleKey) {
			return fmt.Errorf("监理专员后台角色已废弃，请使用运营、产品或管理员角色承接相关治理权限")
		}
	}
	return nil
}

func ValidateProtectedRoleSourceMutationForOperator(operatorID uint64, roleKeys ...string) error {
	protected := false
	for _, roleKey := range roleKeys {
		if IsProtectedAdminRoleKey(roleKey) {
			protected = true
			break
		}
	}
	if !protected {
		return nil
	}

	operator, err := loadAdminRBACSubject(operatorID)
	if err != nil {
		return fmt.Errorf("操作管理员不存在: %w", err)
	}
	if operator.IsSuperAdmin {
		return nil
	}
	return fmt.Errorf("无权调整高权限保留角色")
}

func ValidateAdminRoleAssignment(roleIDs []uint64) ([]model.SysRole, error) {
	uniqueRoleIDs := uniqueUint64s(roleIDs)
	if len(uniqueRoleIDs) == 0 {
		return nil, fmt.Errorf("管理员至少需要分配一个角色")
	}

	var roles []model.SysRole
	if err := repository.DB.Where("id IN ?", uniqueRoleIDs).Find(&roles).Error; err != nil {
		return nil, fmt.Errorf("查询角色失败: %w", err)
	}
	if len(roles) != len(uniqueRoleIDs) {
		return nil, fmt.Errorf("存在无效角色，无法完成分配")
	}

	exclusiveRoleCount := 0
	standaloneRoleCount := 0
	for _, role := range roles {
		if role.Status != 1 {
			return nil, fmt.Errorf("角色 %s 已禁用，不能分配", role.Name)
		}
		if IsReservedSeparationRoleKey(role.Key) {
			exclusiveRoleCount++
		}
		if IsStandaloneAssignmentRoleKey(role.Key) {
			standaloneRoleCount++
		}
	}

	if exclusiveRoleCount > 1 {
		return nil, fmt.Errorf("三员分立角色不能同时分配给同一管理员")
	}
	if exclusiveRoleCount == 1 && len(roles) > 1 {
		return nil, fmt.Errorf("三员分立角色必须独立分配，不能与其他角色混用")
	}
	if standaloneRoleCount > 0 && len(roles) > 1 {
		return nil, fmt.Errorf("预置岗位角色必须独立分配，不能与其他角色混用")
	}

	return roles, nil
}

func IsStandaloneAssignmentRoleKey(roleKey string) bool {
	_, ok := standaloneAssignmentRoleKeys[strings.TrimSpace(roleKey)]
	return ok
}

func ValidateAdminRoleAssignmentForOperator(operatorID, targetAdminID uint64, roleIDs []uint64) ([]model.SysRole, error) {
	roles, err := ValidateAdminRoleAssignment(roleIDs)
	if err != nil {
		return nil, err
	}

	operator, err := loadAdminRBACSubject(operatorID)
	if err != nil {
		return nil, fmt.Errorf("操作管理员不存在: %w", err)
	}
	if operator.IsSuperAdmin {
		return roles, nil
	}
	if targetAdminID != 0 {
		if targetAdminID == operatorID {
			return nil, fmt.Errorf("无权修改当前登录账号的角色绑定")
		}
		if err := ValidateAdminTargetManageableForOperator(operatorID, targetAdminID); err != nil {
			return nil, err
		}
	}
	if err := validateRolesManageableByOperator(operator, roles); err != nil {
		return nil, err
	}

	return roles, nil
}

func ValidateAdminTargetManageableForOperator(operatorID, targetAdminID uint64) error {
	if targetAdminID == 0 {
		return nil
	}
	operator, err := loadAdminRBACSubject(operatorID)
	if err != nil {
		return fmt.Errorf("操作管理员不存在: %w", err)
	}
	if operator.IsSuperAdmin {
		return nil
	}
	target, err := loadAdminRBACSubject(targetAdminID)
	if err != nil {
		return fmt.Errorf("目标管理员不存在: %w", err)
	}
	if target.IsSuperAdmin {
		return fmt.Errorf("无权管理超级管理员账号")
	}
	return validateRolesManageableByOperator(operator, target.Roles)
}

func ValidateRoleMenuAssignment(roleID uint64, menuIDs []uint64) (*model.SysRole, []model.SysMenu, error) {
	var role model.SysRole
	if err := repository.DB.First(&role, roleID).Error; err != nil {
		return nil, nil, fmt.Errorf("角色不存在")
	}
	if err := ValidateDeprecatedAdminRoleMutation(role.Key); err != nil {
		return nil, nil, err
	}

	uniqueMenuIDs := uniqueUint64s(menuIDs)
	if len(uniqueMenuIDs) == 0 {
		return &role, nil, nil
	}

	var menus []model.SysMenu
	if err := repository.DB.Where("id IN ?", uniqueMenuIDs).Find(&menus).Error; err != nil {
		return nil, nil, fmt.Errorf("查询菜单失败: %w", err)
	}
	if len(menus) != len(uniqueMenuIDs) {
		return nil, nil, fmt.Errorf("存在无效菜单，无法完成授权")
	}

	if role.Key == ReservedRoleSecurityAudit {
		for _, menu := range menus {
			if !isReadOnlyMenuPermission(menu.Permission) {
				return nil, nil, fmt.Errorf("审计员角色只能分配只读权限，当前权限 %s 不允许", menu.Permission)
			}
		}
	}

	return &role, menus, nil
}

func ValidateRoleMenuAssignmentForOperator(operatorID, roleID uint64, menuIDs []uint64) (*model.SysRole, []model.SysMenu, error) {
	role, menus, err := ValidateRoleMenuAssignment(roleID, menuIDs)
	if err != nil {
		return nil, nil, err
	}

	operator, err := loadAdminRBACSubject(operatorID)
	if err != nil {
		return nil, nil, fmt.Errorf("操作管理员不存在: %w", err)
	}
	if operator.IsSuperAdmin {
		return role, menus, nil
	}
	if IsProtectedAdminRoleKey(role.Key) {
		return nil, nil, fmt.Errorf("无权调整高权限保留角色")
	}
	if adminHasRole(operator, roleID) {
		return nil, nil, fmt.Errorf("无权修改当前登录账号持有角色的菜单权限")
	}

	operatorPerms, err := permissionSetForRoles(operator.Roles)
	if err != nil {
		return nil, nil, err
	}
	currentPerms, err := permissionSetForRoleIDs([]uint64{roleID})
	if err != nil {
		return nil, nil, err
	}
	if err := ensurePermissionSubset(operatorPerms, currentPerms); err != nil {
		return nil, nil, fmt.Errorf("无权调整超出自身范围的角色权限: %w", err)
	}
	requestedPerms := make(map[string]struct{})
	for _, menu := range menus {
		permission := strings.TrimSpace(menu.Permission)
		if permission == "" {
			continue
		}
		requestedPerms[permission] = struct{}{}
	}
	if err := ensurePermissionSubset(operatorPerms, requestedPerms); err != nil {
		return nil, nil, fmt.Errorf("无权授予超出自身范围的菜单权限: %w", err)
	}

	return role, menus, nil
}

func isReadOnlyMenuPermission(permission string) bool {
	trimmed := strings.TrimSpace(permission)
	if trimmed == "" {
		return true
	}

	parts := strings.Split(trimmed, ":")
	if len(parts) == 0 {
		return false
	}

	action := strings.TrimSpace(parts[len(parts)-1])
	_, ok := readOnlyPermissionActions[action]
	return ok
}

func loadAdminRBACSubject(adminID uint64) (*model.SysAdmin, error) {
	if adminID == 0 {
		return nil, fmt.Errorf("管理员ID无效")
	}
	var admin model.SysAdmin
	if err := repository.DB.Preload("Roles").First(&admin, adminID).Error; err != nil {
		return nil, err
	}
	return &admin, nil
}

func validateRolesManageableByOperator(operator *model.SysAdmin, roles []model.SysRole) error {
	if operator == nil {
		return fmt.Errorf("操作管理员不存在")
	}
	operatorPerms, err := permissionSetForRoles(operator.Roles)
	if err != nil {
		return err
	}

	managedRoleIDs := make([]uint64, 0, len(roles))
	for _, role := range roles {
		if role.ID == 0 || role.Status != 1 {
			continue
		}
		if IsProtectedAdminRoleKey(role.Key) {
			return fmt.Errorf("无权分配或管理高权限保留角色 %s", role.Name)
		}
		managedRoleIDs = append(managedRoleIDs, role.ID)
	}
	rolePerms, err := permissionSetForRoleIDs(managedRoleIDs)
	if err != nil {
		return err
	}
	if err := ensurePermissionSubset(operatorPerms, rolePerms); err != nil {
		return fmt.Errorf("无权分配或管理超出自身范围的角色: %w", err)
	}
	return nil
}

func permissionSetForRoles(roles []model.SysRole) (map[string]struct{}, error) {
	roleIDs := make([]uint64, 0, len(roles))
	for _, role := range roles {
		if role.ID > 0 && role.Status == 1 {
			roleIDs = append(roleIDs, role.ID)
		}
	}
	return permissionSetForRoleIDs(roleIDs)
}

func permissionSetForRoleIDs(roleIDs []uint64) (map[string]struct{}, error) {
	result := make(map[string]struct{})
	roleIDs = uniqueUint64s(roleIDs)
	if len(roleIDs) == 0 {
		return result, nil
	}

	var menus []model.SysMenu
	if err := repository.DB.
		Joins("JOIN sys_role_menus ON sys_role_menus.menu_id = sys_menus.id").
		Where("sys_role_menus.role_id IN ? AND sys_menus.status = 1 AND sys_menus.permission <> ''", roleIDs).
		Find(&menus).Error; err != nil {
		return nil, fmt.Errorf("查询角色权限失败: %w", err)
	}
	for _, menu := range menus {
		permission := strings.TrimSpace(menu.Permission)
		if permission != "" {
			result[permission] = struct{}{}
		}
	}
	return result, nil
}

func ensurePermissionSubset(operatorPerms, requestedPerms map[string]struct{}) error {
	for permission := range requestedPerms {
		if permission == "*:*:*" {
			return fmt.Errorf("不能授予超级权限")
		}
		if _, ok := operatorPerms[permission]; !ok {
			return fmt.Errorf("缺少权限 %s", permission)
		}
	}
	return nil
}

func isBreakGlassRole(roleKey string) bool {
	return strings.TrimSpace(roleKey) == "super_admin"
}

func adminHasRole(admin *model.SysAdmin, roleID uint64) bool {
	if admin == nil || roleID == 0 {
		return false
	}
	for _, role := range admin.Roles {
		if role.ID == roleID && role.Status == 1 {
			return true
		}
	}
	return false
}

func uniqueUint64s(values []uint64) []uint64 {
	if len(values) == 0 {
		return nil
	}

	result := make([]uint64, 0, len(values))
	seen := make(map[uint64]struct{}, len(values))
	for _, value := range values {
		if value == 0 {
			continue
		}
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		result = append(result, value)
	}

	return result
}
