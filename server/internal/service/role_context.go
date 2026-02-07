package service

import (
	"errors"
	"strings"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"

	"github.com/golang-jwt/jwt/v5"
	"gorm.io/gorm"
)

type RoleContext struct {
	ActiveRole      string
	ProviderID      *uint64
	ProviderSubType string
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

	if ctx.ActiveRole != "provider" {
		ctx.ProviderID = nil
		ctx.ProviderSubType = ""
	} else if ctx.ProviderSubType == "" {
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

	ctx := &RoleContext{
		ActiveRole:      normalizedRole,
		ProviderID:      providerID,
		ProviderSubType: providerSubType,
	}

	if ctx.ActiveRole != "provider" {
		ctx.ProviderID = nil
		ctx.ProviderSubType = ""
	} else if ctx.ProviderSubType == "" {
		ctx.ProviderSubType = "designer"
	}

	return ctx, true
}

func getUserRoleContext(user *model.User) (*RoleContext, error) {
	if user == nil {
		return nil, errors.New("user is nil")
	}

	desiredRole, desiredSubType := roleHintFromUserType(user.UserType)

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

			if first == nil {
				first = candidate
			}

			if candidate.ActiveRole == "owner" && ownerCandidate == nil {
				ownerCandidate = candidate
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
	if activeRole != "provider" {
		return ctx, nil
	}

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

	return ctx, nil
}

func getLegacyRoleContext(user *model.User) *RoleContext {
	activeRole, desiredSubType := roleHintFromUserType(user.UserType)
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
