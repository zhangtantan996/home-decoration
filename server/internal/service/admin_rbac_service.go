package service

import (
	"fmt"
	"strings"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
)

const (
	ReservedRoleSystemAdmin   = "system_admin"
	ReservedRoleSecurityAdmin = "security_admin"
	ReservedRoleSecurityAudit = "security_auditor"
)

var reservedSeparationRoleKeys = map[string]struct{}{
	ReservedRoleSystemAdmin:   {},
	ReservedRoleSecurityAdmin: {},
	ReservedRoleSecurityAudit: {},
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
	for _, role := range roles {
		if role.Status != 1 {
			return nil, fmt.Errorf("角色 %s 已禁用，不能分配", role.Name)
		}
		if IsReservedSeparationRoleKey(role.Key) {
			exclusiveRoleCount++
		}
	}

	if exclusiveRoleCount > 1 {
		return nil, fmt.Errorf("三员分立角色不能同时分配给同一管理员")
	}
	if exclusiveRoleCount == 1 && len(roles) > 1 {
		return nil, fmt.Errorf("三员分立角色必须独立分配，不能与其他角色混用")
	}

	return roles, nil
}

func ValidateRoleMenuAssignment(roleID uint64, menuIDs []uint64) (*model.SysRole, []model.SysMenu, error) {
	var role model.SysRole
	if err := repository.DB.First(&role, roleID).Error; err != nil {
		return nil, nil, fmt.Errorf("角色不存在")
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
