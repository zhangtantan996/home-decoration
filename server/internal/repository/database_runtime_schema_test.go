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
		"user_settings":              &model.UserSettings{},
		"user_verifications":         &model.UserVerification{},
		"user_login_devices":         &model.UserLoginDevice{},
		"user_feedbacks":             &model.UserFeedback{},
		"quantity_bases":             &model.QuantityBase{},
		"quantity_base_items":        &model.QuantityBaseItem{},
		"quote_categories":           &model.QuoteCategory{},
		"quote_library_items":        &model.QuoteLibraryItem{},
		"quote_price_books":          &model.QuotePriceBook{},
		"quote_price_book_items":     &model.QuotePriceBookItem{},
		"quote_price_tiers":          &model.QuotePriceTier{},
		"quote_category_rules":       &model.QuoteCategoryRule{},
		"quote_templates":            &model.QuoteTemplate{},
		"quote_template_items":       &model.QuoteTemplateItem{},
		"quote_lists":                &model.QuoteList{},
		"quote_list_items":           &model.QuoteListItem{},
		"quote_invitations":          &model.QuoteInvitation{},
		"quote_submissions":          &model.QuoteSubmission{},
		"quote_submission_items":     &model.QuoteSubmissionItem{},
		"quote_submission_revisions": &model.QuoteSubmissionRevision{},
	} {
		if !DB.Migrator().HasTable(runtimeModel) {
			t.Fatalf("expected table %s to exist", name)
		}
	}
}

func TestEnsureRuntimeSchemaColumnsAlignsLegacyQuoteWorkflowTables(t *testing.T) {
	setupSchemaHealthDB(t)

	for _, statement := range []string{
		`CREATE TABLE quote_lists (
			id INTEGER PRIMARY KEY,
			project_id INTEGER,
			customer_id INTEGER,
			house_id INTEGER,
			owner_user_id INTEGER,
			scenario_type TEXT,
			title TEXT,
			status TEXT,
			currency TEXT,
			deadline_at DATETIME,
			awarded_provider_id INTEGER,
			awarded_quote_submission_id INTEGER,
			extensions_json TEXT,
			created_at DATETIME,
			updated_at DATETIME
		)`,
		`CREATE TABLE quote_list_items (
			id INTEGER PRIMARY KEY,
			quote_list_id INTEGER,
			standard_item_id INTEGER,
			line_no INTEGER,
			name TEXT,
			unit TEXT,
			quantity REAL,
			pricing_note TEXT,
			category_l1 TEXT,
			category_l2 TEXT,
			sort_order INTEGER,
			extensions_json TEXT,
			created_at DATETIME,
			updated_at DATETIME
		)`,
		`CREATE TABLE quote_submissions (
			id INTEGER PRIMARY KEY,
			quote_list_id INTEGER,
			provider_id INTEGER,
			provider_type INTEGER,
			provider_sub_type TEXT,
			status TEXT,
			currency TEXT,
			total_cent INTEGER,
			estimated_days INTEGER,
			remark TEXT,
			attachments_json TEXT,
			team_size INTEGER,
			work_types TEXT,
			construction_method_note TEXT,
			site_visit_required BOOLEAN,
			created_at DATETIME,
			updated_at DATETIME
		)`,
		`CREATE TABLE quote_submission_items (
			id INTEGER PRIMARY KEY,
			quote_submission_id INTEGER,
			quote_list_item_id INTEGER,
			unit_price_cent INTEGER,
			amount_cent INTEGER,
			remark TEXT,
			created_at DATETIME,
			updated_at DATETIME
		)`,
		`CREATE TABLE payment_plans (
			id INTEGER PRIMARY KEY,
			order_id INTEGER,
			type TEXT,
			seq INTEGER,
			name TEXT,
			amount REAL,
			status TEXT,
			created_at DATETIME,
			updated_at DATETIME
		)`,
	} {
		if err := DB.Exec(statement).Error; err != nil {
			t.Fatalf("create legacy quote table: %v", err)
		}
	}

	if err := ensureRuntimeSchemaColumns(); err != nil {
		t.Fatalf("ensure runtime schema columns: %v", err)
	}

	for _, check := range []struct {
		model  interface{}
		column string
		label  string
	}{
		{model: &model.QuoteList{}, column: "QuantityBaseID", label: "quote_lists.quantity_base_id"},
		{model: &model.QuoteList{}, column: "QuantityBaseVersion", label: "quote_lists.quantity_base_version"},
		{model: &model.QuoteList{}, column: "PaymentPlanGeneratedFlag", label: "quote_lists.payment_plan_generated_flag"},
		{model: &model.QuoteListItem{}, column: "MatchedStandardItemID", label: "quote_list_items.matched_standard_item_id"},
		{model: &model.QuoteListItem{}, column: "QuantityBaseItemID", label: "quote_list_items.quantity_base_item_id"},
		{model: &model.QuoteSubmission{}, column: "TaskStatus", label: "quote_submissions.task_status"},
		{model: &model.QuoteSubmission{}, column: "ReviewStatus", label: "quote_submissions.review_status"},
		{model: &model.QuoteSubmissionItem{}, column: "GeneratedUnitPriceCent", label: "quote_submission_items.generated_unit_price_cent"},
		{model: &model.QuoteSubmissionItem{}, column: "QuotedQuantity", label: "quote_submission_items.quoted_quantity"},
		{model: &model.QuoteSubmissionItem{}, column: "QuantityChangeReason", label: "quote_submission_items.quantity_change_reason"},
		{model: &model.PaymentPlan{}, column: "ChangeOrderID", label: "payment_plans.change_order_id"},
	} {
		if !DB.Migrator().HasColumn(check.model, check.column) {
			t.Fatalf("expected %s to exist", check.label)
		}
	}
}

func TestEnsureRuntimeSchemaColumnsRenamesLegacyQuoteInquiryOpenIDColumn(t *testing.T) {
	setupSchemaHealthDB(t)

	if err := DB.Exec(`
		CREATE TABLE quote_inquiries (
			id INTEGER PRIMARY KEY,
			created_at DATETIME,
			updated_at DATETIME,
			openid TEXT
		)
	`).Error; err != nil {
		t.Fatalf("create legacy quote_inquiries table: %v", err)
	}

	if err := DB.Exec(`INSERT INTO quote_inquiries (id, created_at, updated_at, openid) VALUES (1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'legacy-open-id')`).Error; err != nil {
		t.Fatalf("seed legacy quote_inquiries row: %v", err)
	}

	if err := ensureRuntimeSchemaColumns(); err != nil {
		t.Fatalf("ensure runtime schema columns: %v", err)
	}

	if !DB.Migrator().HasColumn(&model.QuoteInquiry{}, "OpenID") {
		t.Fatalf("expected quote_inquiries.open_id to exist")
	}

	type quoteInquiryRow struct {
		OpenID string
	}
	var row quoteInquiryRow
	if err := DB.Raw(`SELECT open_id FROM quote_inquiries WHERE id = 1`).Scan(&row).Error; err != nil {
		t.Fatalf("load renamed open_id: %v", err)
	}
	if row.OpenID != "legacy-open-id" {
		t.Fatalf("expected legacy openid value preserved, got %q", row.OpenID)
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
	if !DB.Migrator().HasColumn(&model.Provider{}, "DisplayName") {
		t.Fatalf("expected providers.display_name to exist")
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

func TestEnsureRuntimeSchemaColumnsBackfillsDisplayNameOnLegacyProviderTable(t *testing.T) {
	setupSchemaHealthDB(t)

	if err := DB.Exec(`
		CREATE TABLE users (
			id INTEGER PRIMARY KEY,
			nickname TEXT
		)
	`).Error; err != nil {
		t.Fatalf("create users table: %v", err)
	}

	if err := DB.Exec(`
		CREATE TABLE providers (
			id INTEGER PRIMARY KEY,
			user_id INTEGER,
			provider_type INTEGER,
			company_name TEXT
		)
	`).Error; err != nil {
		t.Fatalf("create providers table: %v", err)
	}

	if err := DB.Exec(`INSERT INTO users (id, nickname) VALUES (1, '设计师老张')`).Error; err != nil {
		t.Fatalf("seed users: %v", err)
	}
	if err := DB.Exec(`INSERT INTO providers (id, user_id, provider_type, company_name) VALUES (1, 1, 1, '老张工作室')`).Error; err != nil {
		t.Fatalf("seed providers: %v", err)
	}

	if err := ensureRuntimeSchemaColumns(); err != nil {
		t.Fatalf("ensure runtime schema columns: %v", err)
	}

	type providerRow struct {
		DisplayName string
	}
	var row providerRow
	if err := DB.Raw(`SELECT display_name FROM providers WHERE id = 1`).Scan(&row).Error; err != nil {
		t.Fatalf("load display_name: %v", err)
	}
	if row.DisplayName != "设计师老张" {
		t.Fatalf("expected display_name backfilled from user nickname, got %q", row.DisplayName)
	}
}
