package handler

import (
	"testing"

	"home-decoration-server/internal/model"
)

func TestResolveAdminUserRoleUsesMaterialIdentityFallback(t *testing.T) {
	user := model.User{UserType: 2}
	provider := model.Provider{ProviderType: 1}
	identities := []model.UserIdentity{
		{IdentityType: "provider"},
		{IdentityType: "material_shop"},
	}

	roleType, roleLabel := resolveAdminUserRole(user, provider, model.MaterialShop{}, identities)
	if roleType != "material_shop" || roleLabel != "主材商" {
		t.Fatalf("expected material shop fallback, got roleType=%s roleLabel=%s", roleType, roleLabel)
	}
}

func TestResolveAdminUserRoleFallsBackToIdentityWhenEntityNotBound(t *testing.T) {
	user := model.User{UserType: 2}
	identities := []model.UserIdentity{
		{IdentityType: "company"},
	}

	roleType, roleLabel := resolveAdminUserRole(user, model.Provider{}, model.MaterialShop{}, identities)
	if roleType != "company" || roleLabel != "装修公司" {
		t.Fatalf("expected company identity fallback, got roleType=%s roleLabel=%s", roleType, roleLabel)
	}
}

func TestResolveAdminUserRolePrefersConcreteProviderEntity(t *testing.T) {
	user := model.User{UserType: 2}
	provider := model.Provider{Base: model.Base{ID: 1}, ProviderType: 3}
	identities := []model.UserIdentity{
		{IdentityType: "designer"},
	}

	roleType, roleLabel := resolveAdminUserRole(user, provider, model.MaterialShop{}, identities)
	if roleType != "foreman" || roleLabel != "工长" {
		t.Fatalf("expected concrete provider entity to win, got roleType=%s roleLabel=%s", roleType, roleLabel)
	}
}
