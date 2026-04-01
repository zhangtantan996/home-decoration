package repository

import (
	"testing"

	"home-decoration-server/internal/model"
)

func TestEnsureRuntimeSchemaColumnsCreatesUserRuntimeTables(t *testing.T) {
	setupSchemaHealthDB(t)

	if err := ensureRuntimeSchemaColumns(); err != nil {
		t.Fatalf("ensure runtime schema columns: %v", err)
	}

	for name, runtimeModel := range map[string]interface{}{
		"user_settings":      &model.UserSettings{},
		"user_verifications": &model.UserVerification{},
		"user_login_devices": &model.UserLoginDevice{},
		"user_feedbacks":     &model.UserFeedback{},
	} {
		if !DB.Migrator().HasTable(runtimeModel) {
			t.Fatalf("expected table %s to exist", name)
		}
	}
}

func TestEnsureRuntimeSchemaColumnsAlignsOnboardingTables(t *testing.T) {
	setupSchemaHealthDB(t)

	if err := DB.Exec(`
		CREATE TABLE merchant_applications (
			id INTEGER PRIMARY KEY,
			phone TEXT,
			created_at DATETIME,
			updated_at DATETIME
		)
	`).Error; err != nil {
		t.Fatalf("create merchant_applications table: %v", err)
	}

	if err := DB.Exec(`
		CREATE TABLE material_shop_applications (
			id INTEGER PRIMARY KEY,
			phone TEXT,
			created_at DATETIME,
			updated_at DATETIME
		)
	`).Error; err != nil {
		t.Fatalf("create material_shop_applications table: %v", err)
	}

	if err := ensureRuntimeSchemaColumns(); err != nil {
		t.Fatalf("ensure runtime schema columns: %v", err)
	}

	if !DB.Migrator().HasColumn(&model.MerchantApplication{}, "LegalPersonName") {
		t.Fatalf("expected merchant_applications.legal_person_name to exist")
	}
	if !DB.Migrator().HasColumn(&model.MerchantApplication{}, "OfficeAddress") {
		t.Fatalf("expected merchant_applications.office_address to exist")
	}
	if !DB.Migrator().HasColumn(&model.MerchantApplication{}, "ApplicationScene") {
		t.Fatalf("expected merchant_applications.application_scene to exist")
	}
	if !DB.Migrator().HasColumn(&model.MaterialShopApplication{}, "LegalPersonName") {
		t.Fatalf("expected material_shop_applications.legal_person_name to exist")
	}
	if !DB.Migrator().HasColumn(&model.MaterialShopApplication{}, "BusinessHoursJSON") {
		t.Fatalf("expected material_shop_applications.business_hours_json to exist")
	}
	if !DB.Migrator().HasColumn(&model.MaterialShopApplication{}, "BrandLogo") {
		t.Fatalf("expected material_shop_applications.brand_logo to exist")
	}
	if !DB.Migrator().HasColumn(&model.MaterialShopApplication{}, "ApplicationScene") {
		t.Fatalf("expected material_shop_applications.application_scene to exist")
	}
	if !DB.Migrator().HasColumn(&model.Provider{}, "NeedsOnboardingCompletion") {
		t.Fatalf("expected providers.needs_onboarding_completion to exist")
	}
	if !DB.Migrator().HasColumn(&model.Provider{}, "PlatformDisplayEnabled") {
		t.Fatalf("expected providers.platform_display_enabled to exist")
	}
	if !DB.Migrator().HasColumn(&model.Provider{}, "MerchantDisplayEnabled") {
		t.Fatalf("expected providers.merchant_display_enabled to exist")
	}
	if !DB.Migrator().HasColumn(&model.MaterialShop{}, "NeedsOnboardingCompletion") {
		t.Fatalf("expected material_shops.needs_onboarding_completion to exist")
	}
	if !DB.Migrator().HasColumn(&model.MaterialShop{}, "PlatformDisplayEnabled") {
		t.Fatalf("expected material_shops.platform_display_enabled to exist")
	}
	if !DB.Migrator().HasColumn(&model.MaterialShop{}, "MerchantDisplayEnabled") {
		t.Fatalf("expected material_shops.merchant_display_enabled to exist")
	}
}
