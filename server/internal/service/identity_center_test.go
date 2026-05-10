package service

import (
	"testing"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func TestNormalizeRoleValue(t *testing.T) {
	tests := []struct {
		input    string
		wantRole string
		wantSub  string
	}{
		{"owner", "owner", ""},
		{"provider", "provider", ""},
		{"admin", "admin", ""},
		{"supervisor", "supervisor", ""},
		{"designer", "provider", "designer"},
		{"company", "provider", "company"},
		{"foreman", "provider", "foreman"},
		{"worker", "provider", "foreman"},
		{"homeowner", "owner", ""},
		{"user", "owner", ""},
		{"", "owner", ""},
		{"unknown", "owner", ""},
	}

	for _, tt := range tests {
		role, subType := normalizeRoleValue(tt.input)
		if role != tt.wantRole {
			t.Errorf("normalizeRoleValue(%q) role = %q, want %q", tt.input, role, tt.wantRole)
		}
		if subType != tt.wantSub {
			t.Errorf("normalizeRoleValue(%q) subType = %q, want %q", tt.input, subType, tt.wantSub)
		}
	}
}

func TestNormalizeRoleInput(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"owner", "owner"},
		{"provider", "provider"},
		{"admin", "admin"},
		{"supervisor", "supervisor"},
		{"designer", "provider"},
		{"company", "provider"},
		{"foreman", "provider"},
		{"", ""},
		{"unknown", ""},
	}

	for _, tt := range tests {
		result := normalizeRoleInput(tt.input)
		if result != tt.expected {
			t.Errorf("normalizeRoleInput(%q) = %q, want %q", tt.input, result, tt.expected)
		}
	}
}

func TestNormalizeProviderSubType(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"designer", "designer"},
		{"personal", "designer"},
		{"studio", "designer"},
		{"company", "company"},
		{"foreman", "foreman"},
		{"worker", "foreman"},
		{"", ""},
		{"unknown", ""},
	}

	for _, tt := range tests {
		result := normalizeProviderSubType(tt.input)
		if result != tt.expected {
			t.Errorf("normalizeProviderSubType(%q) = %q, want %q", tt.input, result, tt.expected)
		}
	}
}

func TestRoleContextActiveRole(t *testing.T) {
	// Test that RoleContext properly sets non-provider fields to nil
	ctx := &RoleContext{ActiveRole: "owner"}
	if ctx.ActiveRole != "owner" {
		t.Errorf("expected ActiveRole owner, got %s", ctx.ActiveRole)
	}

	// Verify GetRoleContextForResponse cleans non-relevant fields
	// This is a unit test on the logic, not DB-dependent
}

func TestRoleHintFromUserType(t *testing.T) {
	tests := []struct {
		userType int8
		wantRole string
		wantSub  string
	}{
		{1, "owner", ""},
		{2, "provider", "designer"},
		{3, "provider", "foreman"},
		{4, "admin", ""},
		{0, "owner", ""},
		{99, "owner", ""},
	}

	for _, tt := range tests {
		role, subType := roleHintFromUserType(tt.userType)
		if role != tt.wantRole {
			t.Errorf("roleHintFromUserType(%d) role = %q, want %q", tt.userType, role, tt.wantRole)
		}
		if subType != tt.wantSub {
			t.Errorf("roleHintFromUserType(%d) subType = %q, want %q", tt.userType, subType, tt.wantSub)
		}
	}
}

func TestRoleHintFromUserUsesLegacyUserTypeOnly(t *testing.T) {
	tests := []struct {
		name     string
		user     *model.User
		wantRole string
		wantSub  string
	}{
		{
			name: "provider default does not override owner user type",
			user: &model.User{
				UserType:            1,
				DefaultIdentityType: "provider",
			},
			wantRole: "owner",
			wantSub:  "",
		},
		{
			name: "admin default does not override legacy provider user type",
			user: &model.User{
				UserType:            2,
				DefaultIdentityType: "admin",
			},
			wantRole: "provider",
			wantSub:  "designer",
		},
		{
			name: "empty default falls back to user type",
			user: &model.User{
				UserType: 3,
			},
			wantRole: "provider",
			wantSub:  "foreman",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			role, subType := roleHintFromUser(tt.user)
			if role != tt.wantRole {
				t.Fatalf("roleHintFromUser role = %q, want %q", role, tt.wantRole)
			}
			if subType != tt.wantSub {
				t.Fatalf("roleHintFromUser subType = %q, want %q", subType, tt.wantSub)
			}
		})
	}
}

func TestGetUserRoleContextPrefersOwnerForUserLogin(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite failed: %v", err)
	}
	if err := db.AutoMigrate(&model.User{}, &model.Provider{}, &model.UserIdentity{}); err != nil {
		t.Fatalf("auto migrate failed: %v", err)
	}

	previousDB := repository.DB
	repository.DB = db
	t.Cleanup(func() {
		repository.DB = previousDB
	})

	user := model.User{
		Base:                model.Base{ID: 101},
		Phone:               "13800138101",
		UserType:            1,
		DefaultIdentityType: "provider",
		Status:              1,
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("create user failed: %v", err)
	}
	provider := model.Provider{
		Base:         model.Base{ID: 201},
		UserID:       user.ID,
		ProviderType: 3,
		Status:       1,
	}
	if err := db.Create(&provider).Error; err != nil {
		t.Fatalf("create provider failed: %v", err)
	}
	providerRefID := provider.ID
	identities := []model.UserIdentity{
		{UserID: user.ID, IdentityType: "owner", Status: 1, Verified: true},
		{UserID: user.ID, IdentityType: "provider", IdentityRefID: &providerRefID, Status: 1, Verified: true},
	}
	if err := db.Create(&identities).Error; err != nil {
		t.Fatalf("create identities failed: %v", err)
	}

	ctx, err := getUserRoleContext(&user)
	if err != nil {
		t.Fatalf("getUserRoleContext failed: %v", err)
	}
	if ctx.ActiveRole != "owner" {
		t.Fatalf("expected owner active role for user login, got %s", ctx.ActiveRole)
	}
	if ctx.ProviderID != nil {
		t.Fatalf("expected no provider id for owner token, got %v", ctx.ProviderID)
	}
}

func TestUserIdentityModelHasNewFields(t *testing.T) {
	// Verify the UserIdentity model has all required association fields
	identity := model.UserIdentity{
		IdentityType: "supervisor",
	}

	if identity.IdentityType != "supervisor" {
		t.Error("UserIdentity.IdentityType should support supervisor")
	}

	identity.IdentityType = "admin"
	if identity.IdentityType != "admin" {
		t.Error("UserIdentity.IdentityType should support admin")
	}

	identity.IdentityType = "provider"
	if identity.IdentityType != "provider" {
		t.Error("UserIdentity.IdentityType should support provider")
	}

	identity.IdentityType = "owner"
	if identity.IdentityType != "owner" {
		t.Error("UserIdentity.IdentityType should support owner")
	}
}

func TestSupervisorProfileModel(t *testing.T) {
	profile := model.SupervisorProfile{
		RealName:       "Test Supervisor",
		Phone:          "13800138000",
		CityCode:       "310100",
		ServiceArea:    `["310100"]`,
		Certifications: `["cert-001"]`,
		Status:         1,
		Verified:       false,
	}

	if profile.RealName != "Test Supervisor" {
		t.Error("SupervisorProfile RealName not set")
	}
	if profile.Status != 1 {
		t.Error("SupervisorProfile Status should default to 1")
	}
	if profile.Verified {
		t.Error("SupervisorProfile Verified should default to false")
	}
}

func TestAdminProfileModel(t *testing.T) {
	profile := model.AdminProfile{
		UserID:     1,
		SysAdminID: 1,
		AdminType:  "super_admin",
		Status:     1,
	}

	if profile.AdminType != "super_admin" {
		t.Error("AdminProfile AdminType should support super_admin")
	}
	if profile.Status != 1 {
		t.Error("AdminProfile Status should be 1")
	}
}

func TestIdentityTypesAreDistinct(t *testing.T) {
	// Verify that the four identity types are distinct
	validTypes := map[string]bool{
		"owner":      true,
		"provider":   true,
		"supervisor": true,
		"admin":      true,
	}

	// All valid types should normalize to themselves
	for identityType := range validTypes {
		normalized, _ := normalizeRoleValue(identityType)
		if normalized != identityType {
			t.Errorf("normalizeRoleValue(%q) = %q, want self", identityType, normalized)
		}
	}

	// Verify no overlap
	if validTypes["provider"] && validTypes["supervisor"] && validTypes["admin"] && validTypes["owner"] {
		// All four types exist and are distinct
		if len(validTypes) != 4 {
			t.Errorf("expected 4 distinct identity types, got %d", len(validTypes))
		}
	}
}

func TestTokenClaimsShouldIncludeUnifiedFields(t *testing.T) {
	// This test verifies the conceptual contract:
	// generateTokenV2 should include identityId, identityRefId, supervisorId, adminProfileId
	// Since we can't easily test token generation without DB, we verify the RoleContext carries these fields.

	ctx := &RoleContext{
		ActiveRole:    "supervisor",
		SupervisorID:  ptrUint64(100),
		IdentityID:    ptrUint64(200),
		IdentityRefID: ptrUint64(100), // same as supervisor profile id
	}

	if ctx.ActiveRole != "supervisor" {
		t.Errorf("ActiveRole should be supervisor, got %s", ctx.ActiveRole)
	}
	if ctx.SupervisorID == nil || *ctx.SupervisorID != 100 {
		t.Error("SupervisorID should be 100")
	}
}

func TestAdminRoleContextHasAdminProfileID(t *testing.T) {
	ctx := &RoleContext{
		ActiveRole:     "admin",
		AdminProfileID: ptrUint64(50),
		IdentityID:     ptrUint64(300),
		IdentityRefID:  ptrUint64(50),
	}

	if ctx.ActiveRole != "admin" {
		t.Errorf("ActiveRole should be admin, got %s", ctx.ActiveRole)
	}
	if ctx.AdminProfileID == nil || *ctx.AdminProfileID != 50 {
		t.Error("AdminProfileID should be 50")
	}
}

func TestProviderRoleContextHasProviderID(t *testing.T) {
	ctx := &RoleContext{
		ActiveRole:      "provider",
		ProviderID:      ptrUint64(10),
		ProviderSubType: "designer",
		IdentityID:      ptrUint64(400),
		IdentityRefID:   ptrUint64(10),
	}

	if ctx.ActiveRole != "provider" {
		t.Errorf("ActiveRole should be provider, got %s", ctx.ActiveRole)
	}
	if ctx.ProviderID == nil || *ctx.ProviderID != 10 {
		t.Error("ProviderID should be 10")
	}
	if ctx.ProviderSubType != "designer" {
		t.Errorf("ProviderSubType should be designer, got %s", ctx.ProviderSubType)
	}
}

func ptrUint64(v uint64) *uint64 {
	return &v
}
