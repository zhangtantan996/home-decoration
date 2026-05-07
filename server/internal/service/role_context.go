package service

import (
	"errors"
	"strings"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"

	"github.com/golang-jwt/jwt/v5"
	"gorm.io/gorm"
)

// RoleContext 统一身份上下文 — 从 token claims 或 DB 解析得出
type RoleContext struct {
	ActiveRole      string  // owner / provider / supervisor / admin
	ProviderID      *uint64 // 仅 provider 有效
	ProviderSubType string  // designer / company / foreman（仅 provider 有效）
	SupervisorID    *uint64 // 仅 supervisor 有效
	AdminProfileID  *uint64 // 仅 admin 有效
	IdentityID      *uint64 // user_identities.id
	IdentityRefID   *uint64 // 指向 profiles 表的 ref id（按 identity_type 区分）
}

// UnifiedIdentityContext 统一身份中心claims — 用于 token 签发和中间件解析
type UnifiedIdentityContext struct {
	UserID          uint64
	UserPublicID    string
	ActiveRole      string
	IdentityID      *uint64
	IdentityRefID   *uint64
	ProviderID      *uint64
	ProviderSubType string
	SupervisorID    *uint64
	AdminProfileID  *uint64
}

func NormalizeRoleForResponse(raw string) (string, string) {
	return normalizeRoleValue(raw)
}

func NormalizeProviderSubTypeForResponse(raw string) string {
	return normalizeProviderSubType(raw)
}

func GetRoleContextForResponse(user *model.User) (RoleContext, bool) {
	ctx := RoleContext{ActiveRole: "owner"}
	if user == nil {
		return ctx, false
	}

	resolved, err := getUserRoleContext(user)
	if err != nil || resolved == nil {
		resolved = getLegacyRoleContext(user)
	}
	if resolved == nil {
		return ctx, false
	}

	ctx.ActiveRole = resolved.ActiveRole
	ctx.ProviderSubType = resolved.ProviderSubType
	if resolved.ProviderID != nil {
		providerID := *resolved.ProviderID
		ctx.ProviderID = &providerID
	}
	if resolved.SupervisorID != nil {
		svID := *resolved.SupervisorID
		ctx.SupervisorID = &svID
	}
	if resolved.AdminProfileID != nil {
		apID := *resolved.AdminProfileID
		ctx.AdminProfileID = &apID
	}
	if resolved.IdentityID != nil {
		idID := *resolved.IdentityID
		ctx.IdentityID = &idID
	}
	if resolved.IdentityRefID != nil {
		refID := *resolved.IdentityRefID
		ctx.IdentityRefID = &refID
	}

	if ctx.ActiveRole != "provider" {
		ctx.ProviderID = nil
		ctx.ProviderSubType = ""
	}
	if ctx.ActiveRole != "supervisor" {
		ctx.SupervisorID = nil
	}
	if ctx.ActiveRole != "admin" {
		ctx.AdminProfileID = nil
	}
	if ctx.ActiveRole == "provider" && ctx.ProviderSubType == "" {
		ctx.ProviderSubType = "designer"
	}

	return ctx, true
}

func normalizeRoleValue(raw string) (string, string) {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "owner", "homeowner", "user", "":
		return "owner", ""
	case "admin":
		return "admin", ""
	case "provider":
		return "provider", ""
	case "supervisor":
		return "supervisor", ""
	case "designer":
		return "provider", "designer"
	case "company":
		return "provider", "company"
	case "foreman", "worker":
		return "provider", "foreman"
	default:
		return "owner", ""
	}
}

func normalizeProviderSubType(raw string) string {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "designer", "personal", "studio":
		return "designer"
	case "company":
		return "company"
	case "foreman", "worker":
		return "foreman"
	default:
		return ""
	}
}

func providerSubTypeFromProvider(provider *model.Provider) string {
	if provider == nil {
		return ""
	}

	switch provider.ProviderType {
	case 1:
		return "designer"
	case 2:
		return "company"
	case 3:
		return "foreman"
	}

	return normalizeProviderSubType(provider.SubType)
}

func roleHintFromUserType(userType int8) (string, string) {
	switch userType {
	case 1:
		return "owner", ""
	case 2:
		return "provider", "designer"
	case 3:
		return "provider", "foreman"
	case 4:
		return "admin", ""
	default:
		return "owner", ""
	}
}

func roleHintFromUser(user *model.User) (string, string) {
	if user == nil {
		return "owner", ""
	}
	return roleHintFromUserType(user.UserType)
}

func coerceUint64(raw interface{}) (*uint64, bool) {
	switch v := raw.(type) {
	case uint64:
		value := v
		return &value, true
	case uint:
		value := uint64(v)
		return &value, true
	case int:
		if v < 0 {
			return nil, false
		}
		value := uint64(v)
		return &value, true
	case int64:
		if v < 0 {
			return nil, false
		}
		value := uint64(v)
		return &value, true
	case float64:
		if v < 0 {
			return nil, false
		}
		value := uint64(v)
		return &value, true
	default:
		return nil, false
	}
}

func coerceInt8(raw interface{}) (int8, bool) {
	switch v := raw.(type) {
	case int8:
		return v, true
	case int:
		return int8(v), true
	case int64:
		return int8(v), true
	case float64:
		return int8(v), true
	default:
		return 0, false
	}
}

func getRoleContextFromClaims(claims jwt.MapClaims) (*RoleContext, bool) {
	activeRoleRaw, hasActiveRole := claims["activeRole"]
	if !hasActiveRole {
		if userTypeRaw, ok := claims["userType"]; ok {
			userType, converted := coerceInt8(userTypeRaw)
			if !converted {
				return nil, false
			}
			activeRole, subType := roleHintFromUserType(userType)
			ctx := &RoleContext{ActiveRole: activeRole, ProviderSubType: subType}
			if providerID, ok := coerceUint64(claims["providerId"]); ok {
				ctx.ProviderID = providerID
			}
			if ctx.ActiveRole != "provider" {
				ctx.ProviderID = nil
				ctx.ProviderSubType = ""
			} else if ctx.ProviderSubType == "" {
				ctx.ProviderSubType = "designer"
			}
			return ctx, true
		}
		return nil, false
	}

	activeRole, _ := activeRoleRaw.(string)
	normalizedRole, roleDerivedSubType := normalizeRoleValue(activeRole)

	providerSubType, _ := claims["providerSubType"].(string)
	providerSubType = normalizeProviderSubType(providerSubType)
	if providerSubType == "" {
		providerSubType = roleDerivedSubType
	}

	var providerID *uint64
	if v, ok := coerceUint64(claims["providerId"]); ok {
		providerID = v
	}

	var supervisorID *uint64
	if v, ok := coerceUint64(claims["supervisorId"]); ok {
		supervisorID = v
	}

	var adminProfileID *uint64
	if v, ok := coerceUint64(claims["adminProfileId"]); ok {
		adminProfileID = v
	}

	var identityID *uint64
	if v, ok := coerceUint64(claims["identityId"]); ok {
		identityID = v
	}

	var identityRefID *uint64
	if v, ok := coerceUint64(claims["identityRefId"]); ok {
		identityRefID = v
	}

	ctx := &RoleContext{
		ActiveRole:      normalizedRole,
		ProviderID:      providerID,
		ProviderSubType: providerSubType,
		SupervisorID:    supervisorID,
		AdminProfileID:  adminProfileID,
		IdentityID:      identityID,
		IdentityRefID:   identityRefID,
	}

	if ctx.ActiveRole != "provider" {
		ctx.ProviderID = nil
		ctx.ProviderSubType = ""
	} else if ctx.ProviderSubType == "" {
		ctx.ProviderSubType = "designer"
	}

	if ctx.ActiveRole != "supervisor" {
		ctx.SupervisorID = nil
	}

	if ctx.ActiveRole != "admin" {
		ctx.AdminProfileID = nil
	}

	return ctx, true
}

func getUserRoleContext(user *model.User) (*RoleContext, error) {
	if user == nil {
		return nil, errors.New("user is nil")
	}

	desiredRole, desiredSubType := roleHintFromUser(user)

	var identities []model.UserIdentity
	err := repository.DB.Where("user_id = ? AND status = ?", user.ID, 1).
		Order("id ASC").
		Find(&identities).Error
	if err != nil {
		if isMissingTableError(err) {
			return getLegacyRoleContext(user), nil
		}
		return nil, err
	}

	if len(identities) > 0 {
		var first *RoleContext
		var ownerCandidate *RoleContext

		for idx := range identities {
			candidate, resolveErr := resolveRoleContextFromIdentity(user.ID, &identities[idx])
			if resolveErr != nil {
				continue
			}

			// 设置身份ID
			idID := identities[idx].ID
			candidate.IdentityID = &idID
			candidate.IdentityRefID = identities[idx].IdentityRefID

			if first == nil {
				first = candidate
			}

			if candidate.ActiveRole == "owner" && ownerCandidate == nil {
				ownerCandidate = candidate
				return candidate, nil
			}

			if candidate.ActiveRole == desiredRole {
				if desiredRole != "provider" || desiredSubType == "" || candidate.ProviderSubType == desiredSubType {
					return candidate, nil
				}
			}
		}

		if ownerCandidate != nil {
			return ownerCandidate, nil
		}

		if first != nil {
			return first, nil
		}
	}

	legacy := getLegacyRoleContext(user)
	return legacy, nil
}

func resolveRoleContextFromIdentity(userID uint64, identity *model.UserIdentity) (*RoleContext, error) {
	if identity == nil {
		return nil, errors.New("identity is nil")
	}

	activeRole, derivedSubType := normalizeRoleValue(identity.IdentityType)
	ctx := &RoleContext{ActiveRole: activeRole}

	switch activeRole {
	case "provider":
		ctx.ProviderSubType = derivedSubType

		var provider model.Provider
		providerLoaded := false

		if identity.IdentityRefID != nil {
			if err := repository.DB.First(&provider, *identity.IdentityRefID).Error; err == nil {
				providerLoaded = true
				providerID := provider.ID
				ctx.ProviderID = &providerID
			} else if isMissingTableError(err) {
				return ctx, nil
			}
		}

		if !providerLoaded {
			if err := repository.DB.Where("user_id = ?", userID).Order("id ASC").First(&provider).Error; err == nil {
				providerLoaded = true
				providerID := provider.ID
				ctx.ProviderID = &providerID
			} else if isMissingTableError(err) {
				return ctx, nil
			} else if !errors.Is(err, gorm.ErrRecordNotFound) {
				return nil, err
			}
		}

		if providerLoaded {
			subType := providerSubTypeFromProvider(&provider)
			if subType != "" {
				ctx.ProviderSubType = subType
			}
			if ctx.ProviderID == nil {
				providerID := provider.ID
				ctx.ProviderID = &providerID
			}
		}

		if ctx.ProviderSubType == "" {
			ctx.ProviderSubType = "designer"
		}

	case "supervisor":
		var profile model.SupervisorProfile
		if identity.IdentityRefID != nil {
			if err := repository.DB.First(&profile, *identity.IdentityRefID).Error; err == nil {
				svID := profile.ID
				ctx.SupervisorID = &svID
			} else if !isMissingTableError(err) && !errors.Is(err, gorm.ErrRecordNotFound) {
				return nil, err
			}
		}

		if ctx.SupervisorID == nil {
			if err := repository.DB.Where("user_id = ?", userID).Order("id ASC").First(&profile).Error; err == nil {
				svID := profile.ID
				ctx.SupervisorID = &svID
			} else if !isMissingTableError(err) && !errors.Is(err, gorm.ErrRecordNotFound) {
				return nil, err
			}
		}

	case "admin":
		var profile model.AdminProfile
		if identity.IdentityRefID != nil {
			if err := repository.DB.First(&profile, *identity.IdentityRefID).Error; err == nil {
				apID := profile.ID
				ctx.AdminProfileID = &apID
			} else if !isMissingTableError(err) && !errors.Is(err, gorm.ErrRecordNotFound) {
				return nil, err
			}
		}

		if ctx.AdminProfileID == nil {
			if err := repository.DB.Where("user_id = ?", userID).Order("id ASC").First(&profile).Error; err == nil {
				apID := profile.ID
				ctx.AdminProfileID = &apID
			} else if !isMissingTableError(err) && !errors.Is(err, gorm.ErrRecordNotFound) {
				return nil, err
			}
		}
	}

	return ctx, nil
}

func getLegacyRoleContext(user *model.User) *RoleContext {
	activeRole, desiredSubType := roleHintFromUser(user)
	ctx := &RoleContext{ActiveRole: activeRole, ProviderSubType: desiredSubType}

	if activeRole != "provider" {
		ctx.ProviderSubType = ""
		return ctx
	}

	var provider model.Provider
	if err := repository.DB.Where("user_id = ?", user.ID).Order("id ASC").First(&provider).Error; err == nil {
		providerID := provider.ID
		ctx.ProviderID = &providerID
		if providerSubType := providerSubTypeFromProvider(&provider); providerSubType != "" {
			ctx.ProviderSubType = providerSubType
		}
	} else if isMissingTableError(err) {
		ctx.ProviderSubType = desiredSubType
		return ctx
	}

	if ctx.ProviderSubType == "" {
		ctx.ProviderSubType = "designer"
	}

	return ctx
}

func isMissingTableError(err error) bool {
	if err == nil {
		return false
	}

	message := strings.ToLower(err.Error())
	return strings.Contains(message, "no such table") ||
		strings.Contains(message, "does not exist")
}

func GetRoleContextFromClaimsForResponse(tokenString string) (*RoleContext, bool) {
	if strings.TrimSpace(tokenString) == "" {
		return nil, false
	}

	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("invalid signing method")
		}
		return jwtSecret, nil
	})
	if err != nil || !token.Valid {
		return nil, false
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return nil, false
	}

	return getRoleContextFromClaims(claims)
}
