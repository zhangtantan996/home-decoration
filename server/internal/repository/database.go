package repository

import (
	"fmt"
	"home-decoration-server/internal/config"
	"home-decoration-server/internal/model"
	"log"
	"strings"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

// InitDB 初始化数据库连接
func InitDB(cfg *config.DatabaseConfig) error {
	var err error

	DB, err = gorm.Open(postgres.Open(cfg.GetDSN()), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})

	if err != nil {
		return err
	}

	// Configure sql.DB connection pool (production safety default; configurable via config/env).
	sqlDB, err := DB.DB()
	if err != nil {
		return err
	}

	maxOpenConns := cfg.MaxOpenConns
	if maxOpenConns <= 0 {
		maxOpenConns = 25
	}
	maxIdleConns := cfg.MaxIdleConns
	if maxIdleConns < 0 {
		maxIdleConns = 0
	}
	if maxIdleConns > maxOpenConns {
		maxIdleConns = maxOpenConns
	}

	sqlDB.SetMaxOpenConns(maxOpenConns)
	sqlDB.SetMaxIdleConns(maxIdleConns)

	if cfg.ConnMaxLifetimeMinutes > 0 {
		sqlDB.SetConnMaxLifetime(time.Duration(cfg.ConnMaxLifetimeMinutes) * time.Minute)
	}
	if cfg.ConnMaxIdleTimeMinutes > 0 {
		sqlDB.SetConnMaxIdleTime(time.Duration(cfg.ConnMaxIdleTimeMinutes) * time.Minute)
	}

	log.Printf("Database pool configured: max_open_conns=%d max_idle_conns=%d conn_max_lifetime_minutes=%d conn_max_idle_time_minutes=%d",
		maxOpenConns,
		maxIdleConns,
		cfg.ConnMaxLifetimeMinutes,
		cfg.ConnMaxIdleTimeMinutes,
	)

	// 自动迁移表结构
	// FIXME: GORM 1.30.0 与 PostgreSQL 驱动存在兼容性问题
	// 错误信息："insufficient arguments" 发生在检查表结构时
	// 临时解决方案：默认禁用 AutoMigrate，通过配置开关控制
	//
	// 迁移策略：
	// 1. 开发环境：可以启用 AutoMigrate（设置 database.auto_migrate=true）
	// 2. 生产环境：使用手动迁移脚本或迁移工具（如 golang-migrate）
	// 3. 新环境部署：先手动执行 SQL 脚本创建表结构
	if cfg.AutoMigrate {
		log.Println("AutoMigrate enabled, running database migrations...")
		if err := autoMigrate(); err != nil {
			log.Printf("AutoMigrate failed: %v", err)
			log.Println("Continuing without AutoMigrate. Please ensure database schema is up to date.")
			// 不阻塞启动，但记录警告
		} else {
			log.Println("AutoMigrate completed successfully")
		}
	} else {
		log.Println("AutoMigrate disabled. Please ensure database schema is up to date manually.")
	}

	if err := ensureRuntimeSchemaColumns(); err != nil {
		log.Printf("Runtime schema alignment failed: %v", err)
	}

	log.Println("Database connected successfully")
	return nil
}

// autoMigrate 自动迁移数据库表
func autoMigrate() error {
	return DB.AutoMigrate(
		&model.User{},
		&model.UserWechatBinding{},
		&model.Provider{},
		&model.ProviderCase{},
		&model.ProviderReview{},
		&model.Worker{},
		&model.Project{},
		&model.Milestone{},
		&model.MilestoneSubmission{},
		&model.MilestoneAcceptance{},
		&model.WorkLog{},
		&model.EscrowAccount{},
		&model.Transaction{},
		&model.Booking{},
		&model.SiteSurvey{},
		&model.BudgetConfirmation{},
		&model.ProjectPhase{},
		&model.PhaseTask{},
		&model.UserFollow{},
		&model.UserFavorite{},
		// MaterialShop
		&model.MaterialShop{},
		// RBAC 权限系统
		&model.SysAdmin{},
		&model.SysRole{},
		&model.SysMenu{},
		&model.SysAdminRole{},
		&model.SysRoleMenu{},
		&model.SysOperationLog{},
		// 管理后台新增
		&model.Admin{},
		&model.ProviderAudit{},
		&model.MaterialShopAudit{},
		&model.RiskWarning{},
		&model.Arbitration{},
		&model.SystemSettings{},
		&model.AdminLog{},
		// 业务流程扩展 (2025-12-28)
		&model.SystemConfig{},
		&model.Demand{},
		&model.DemandMatch{},
		&model.Contract{},
		&model.Proposal{},
		&model.Order{},
		&model.PaymentPlan{},
		&model.ChangeOrder{},
		&model.Complaint{},
		&model.Evaluation{},
		&model.ProjectAudit{},
		&model.RefundApplication{},
		&model.PaymentOrder{},
		&model.PaymentCallback{},
		&model.RefundOrder{},
		&model.SettlementOrder{},
		&model.PayoutOrder{},
		&model.LedgerAccount{},
		&model.LedgerEntry{},
		&model.BusinessFlow{},
		// 商家中心 (2025-12-29)
		&model.MerchantApplication{},
		&model.MerchantIncome{},
		&model.MerchantBondRule{},
		&model.MerchantBondAccount{},
		&model.FinanceReconciliation{},
		&model.FinanceReconciliationItem{},
		&model.MerchantWithdraw{},
		&model.MerchantBankAccount{},
		&model.MerchantServiceSetting{},
		&model.MaterialShopServiceSetting{},
		&model.MaterialShopApplication{},
		&model.MaterialShopApplicationProduct{},
		&model.MaterialShopProduct{},
		&model.MerchantIdentityChangeApplication{},
		// 售后
		&model.AfterSales{},
		// 安全审计 (2025-12-29)
		&model.AuditLog{},
		&model.SMSAuditLog{},
		// 社交功能 (2026-01-21)
		&model.UserLike{},
		&model.CaseComment{},
		&model.SensitiveWord{},
		&model.UserSettings{},
		&model.UserVerification{},
		&model.UserLoginDevice{},
		&model.UserFeedback{},
		&model.QuoteLibraryItem{},
		&model.QuoteCategory{},
		&model.QuantityBase{},
		&model.QuantityBaseItem{},
		&model.QuoteList{},
		&model.QuoteListItem{},
		&model.QuoteInvitation{},
		&model.QuoteSubmission{},
		&model.QuoteSubmissionItem{},
		&model.QuoteSubmissionRevision{},
		&model.QuotePriceBook{},
		&model.QuotePriceBookItem{},
		&model.QuotePriceTier{},
		&model.QuoteCategoryRule{},
		&model.QuoteTemplate{},
		&model.QuoteTemplateItem{},
		&model.QuoteEstimateTemplate{},
		// 设计服务支付体系 (v1.12.0)
		&model.DesignWorkingDoc{},
		&model.DesignFeeQuote{},
		&model.DesignDeliverable{},
		// 验收清单系统 (v1.13.0)
		&model.InspectionChecklist{},
		&model.InspectionTemplate{},
		// 对账系统
		&model.ReconciliationRecord{},
		&model.ReconciliationDifference{},
	)
}

func ensureRuntimeSchemaColumns() error {
	if DB == nil {
		return nil
	}

	runtimeTables := []struct {
		name  string
		model interface{}
	}{
		{name: "user_settings", model: &model.UserSettings{}},
		{name: "user_verifications", model: &model.UserVerification{}},
		{name: "user_login_devices", model: &model.UserLoginDevice{}},
		{name: "user_feedbacks", model: &model.UserFeedback{}},
		{name: "quote_inquiries", model: &model.QuoteInquiry{}},
		{name: "quantity_bases", model: &model.QuantityBase{}},
		{name: "quantity_base_items", model: &model.QuantityBaseItem{}},
		{name: "quote_categories", model: &model.QuoteCategory{}},
		{name: "quote_library_items", model: &model.QuoteLibraryItem{}},
		{name: "quote_price_books", model: &model.QuotePriceBook{}},
		{name: "quote_price_book_items", model: &model.QuotePriceBookItem{}},
		{name: "quote_price_tiers", model: &model.QuotePriceTier{}},
		{name: "quote_category_rules", model: &model.QuoteCategoryRule{}},
		{name: "quote_templates", model: &model.QuoteTemplate{}},
		{name: "quote_template_items", model: &model.QuoteTemplateItem{}},
		{name: "quote_lists", model: &model.QuoteList{}},
		{name: "quote_list_items", model: &model.QuoteListItem{}},
		{name: "quote_invitations", model: &model.QuoteInvitation{}},
		{name: "quote_submissions", model: &model.QuoteSubmission{}},
		{name: "quote_submission_items", model: &model.QuoteSubmissionItem{}},
		{name: "quote_submission_revisions", model: &model.QuoteSubmissionRevision{}},
	}

	if err := alignLegacyQuoteInquirySchema(); err != nil {
		return err
	}

	for _, runtimeTable := range runtimeTables {
		if err := ensureTableColumns(runtimeTable.name, runtimeTable.model); err != nil {
			return err
		}
	}

	if DB.Migrator().HasTable(&model.MaterialShop{}) && !DB.Migrator().HasColumn(&model.MaterialShop{}, "Status") {
		if err := DB.Migrator().AddColumn(&model.MaterialShop{}, "Status"); err != nil {
			return fmt.Errorf("add material_shops.status: %w", err)
		}
	}

	if DB.Migrator().HasTable(&model.MaterialShop{}) {
		if DB.Migrator().HasColumn(&model.MaterialShop{}, "PlatformDisplayEnabled") {
			if err := DB.Exec(`UPDATE material_shops SET platform_display_enabled = true WHERE platform_display_enabled IS NULL`).Error; err != nil {
				return err
			}
		}
		if DB.Migrator().HasColumn(&model.MaterialShop{}, "MerchantDisplayEnabled") {
			if err := DB.Exec(`UPDATE material_shops SET merchant_display_enabled = true WHERE merchant_display_enabled IS NULL`).Error; err != nil {
				return err
			}
		}
		if err := DB.Exec(`UPDATE material_shops SET status = 1 WHERE status IS NULL`).Error; err != nil {
			return err
		}
		if DB.Dialector.Name() == "postgres" {
			if err := DB.Exec(`ALTER TABLE material_shops ALTER COLUMN open_time TYPE TEXT`).Error; err != nil {
				return fmt.Errorf("expand material_shops.open_time: %w", err)
			}
		}
	}

	if DB.Migrator().HasTable(&model.Provider{}) {
		if !DB.Migrator().HasColumn(&model.Provider{}, "DisplayName") {
			if err := DB.Migrator().AddColumn(&model.Provider{}, "DisplayName"); err != nil {
				return fmt.Errorf("add providers.display_name: %w", err)
			}
		}
		if DB.Migrator().HasColumn(&model.Provider{}, "PlatformDisplayEnabled") {
			if err := DB.Exec(`UPDATE providers SET platform_display_enabled = true WHERE platform_display_enabled IS NULL`).Error; err != nil {
				return err
			}
		}
		if DB.Migrator().HasColumn(&model.Provider{}, "MerchantDisplayEnabled") {
			if err := DB.Exec(`UPDATE providers SET merchant_display_enabled = true WHERE merchant_display_enabled IS NULL`).Error; err != nil {
				return err
			}
		}
		type providerDisplayNameBackfillRow struct {
			ID           uint64
			UserID       uint64
			ProviderType int8
			CompanyName  string
		}
		var providers []providerDisplayNameBackfillRow
		if err := DB.Model(&model.Provider{}).
			Select("id", "user_id", "provider_type", "company_name").
			Where("COALESCE(display_name, '') = ''").
			Find(&providers).Error; err != nil {
			return fmt.Errorf("load providers for display_name backfill: %w", err)
		}
		for _, provider := range providers {
			displayName := ""
			if provider.UserID > 0 {
				var user model.User
				if err := DB.Select("id", "nickname").First(&user, provider.UserID).Error; err == nil {
					if provider.ProviderType == 2 {
						displayName = strings.TrimSpace(provider.CompanyName)
						if displayName == "" {
							displayName = strings.TrimSpace(user.Nickname)
						}
					} else {
						displayName = strings.TrimSpace(user.Nickname)
						if displayName == "" {
							displayName = strings.TrimSpace(provider.CompanyName)
						}
					}
				}
			}
			if displayName == "" {
				displayName = strings.TrimSpace(provider.CompanyName)
			}
			if displayName == "" {
				continue
			}
			if err := DB.Model(&model.Provider{}).Where("id = ?", provider.ID).UpdateColumn("display_name", displayName).Error; err != nil {
				return fmt.Errorf("backfill providers.display_name for %d: %w", provider.ID, err)
			}
		}
	}

	if DB.Migrator().HasTable(&model.MaterialShopApplication{}) {
		if !DB.Migrator().HasColumn(&model.MaterialShopApplication{}, "BrandLogo") {
			if err := DB.Migrator().AddColumn(&model.MaterialShopApplication{}, "BrandLogo"); err != nil {
				return fmt.Errorf("add material_shop_applications.brand_logo: %w", err)
			}
		}
		if !DB.Migrator().HasColumn(&model.MaterialShopApplication{}, "BusinessHoursJSON") {
			if err := DB.Migrator().AddColumn(&model.MaterialShopApplication{}, "BusinessHoursJSON"); err != nil {
				return fmt.Errorf("add material_shop_applications.business_hours_json: %w", err)
			}
		}
		if DB.Dialector.Name() == "postgres" {
			if err := DB.Exec(`ALTER TABLE material_shop_applications ALTER COLUMN business_hours TYPE TEXT`).Error; err != nil {
				return fmt.Errorf("expand material_shop_applications.business_hours: %w", err)
			}
		}
	}

	if DB.Dialector.Name() == "postgres" {
		type textColumnAlignment struct {
			model  interface{}
			column string
			sql    string
			label  string
		}
		for _, alignment := range []textColumnAlignment{
			{
				model:  &model.MerchantApplication{},
				column: "LicenseNo",
				sql:    `ALTER TABLE merchant_applications ALTER COLUMN license_no TYPE TEXT`,
				label:  "merchant_applications.license_no",
			},
			{
				model:  &model.Provider{},
				column: "LicenseNo",
				sql:    `ALTER TABLE providers ALTER COLUMN license_no TYPE TEXT`,
				label:  "providers.license_no",
			},
			{
				model:  &model.MaterialShop{},
				column: "BusinessLicenseNo",
				sql:    `ALTER TABLE material_shops ALTER COLUMN business_license_no TYPE TEXT`,
				label:  "material_shops.business_license_no",
			},
			{
				model:  &model.MaterialShopApplication{},
				column: "BusinessLicenseNo",
				sql:    `ALTER TABLE material_shop_applications ALTER COLUMN business_license_no TYPE TEXT`,
				label:  "material_shop_applications.business_license_no",
			},
		} {
			if !DB.Migrator().HasTable(alignment.model) || !DB.Migrator().HasColumn(alignment.model, alignment.column) {
				continue
			}
			if err := DB.Exec(alignment.sql).Error; err != nil {
				return fmt.Errorf("expand %s: %w", alignment.label, err)
			}
		}
	}

	type runtimeColumnAlignment struct {
		model interface{}
		field string
		label string
		index string
	}

	for _, alignment := range []runtimeColumnAlignment{
		{model: &model.PaymentOrder{}, field: "FundScene", label: "payment_orders.fund_scene", index: "CREATE INDEX IF NOT EXISTS idx_payment_orders_fund_scene ON payment_orders(fund_scene)"},
		{model: &model.RefundOrder{}, field: "FundScene", label: "refund_orders.fund_scene", index: "CREATE INDEX IF NOT EXISTS idx_refund_orders_fund_scene ON refund_orders(fund_scene)"},
		{model: &model.QuoteList{}, field: "QuantityBaseID", label: "quote_lists.quantity_base_id", index: "CREATE INDEX IF NOT EXISTS idx_quote_lists_quantity_base_id ON quote_lists(quantity_base_id)"},
		{model: &model.QuoteLibraryItem{}, field: "CategoryID", label: "quote_library_items.category_id", index: "CREATE INDEX IF NOT EXISTS idx_quote_library_items_category_id ON quote_library_items(category_id)"},
		{model: &model.QuoteLibraryItem{}, field: "StandardCode", label: "quote_library_items.standard_code", index: "CREATE INDEX IF NOT EXISTS idx_quote_library_items_standard_code ON quote_library_items(standard_code)"},
		{model: &model.QuoteLibraryItem{}, field: "CategoryL3", label: "quote_library_items.category_l3", index: "CREATE INDEX IF NOT EXISTS idx_quote_library_items_category_l3 ON quote_library_items(category_l3)"},
		{model: &model.QuotePriceBookItem{}, field: "PriceTierID", label: "quote_price_book_items.price_tier_id", index: "CREATE INDEX IF NOT EXISTS idx_quote_price_book_items_tier ON quote_price_book_items(price_tier_id)"},
		{model: &model.QuoteListItem{}, field: "MatchedStandardItemID", label: "quote_list_items.matched_standard_item_id", index: "CREATE INDEX IF NOT EXISTS idx_quote_list_items_matched_standard_item_id ON quote_list_items(matched_standard_item_id)"},
		{model: &model.QuoteListItem{}, field: "SelectedTierID", label: "quote_list_items.selected_tier_id", index: "CREATE INDEX IF NOT EXISTS idx_quote_list_items_tier ON quote_list_items(selected_tier_id)"},
		{model: &model.QuoteSubmission{}, field: "TaskStatus", label: "quote_submissions.task_status", index: "CREATE INDEX IF NOT EXISTS idx_quote_submissions_task_status ON quote_submissions(task_status)"},
		{model: &model.QuoteSubmission{}, field: "GenerationStatus", label: "quote_submissions.generation_status", index: "CREATE INDEX IF NOT EXISTS idx_quote_submissions_generation_status ON quote_submissions(generation_status)"},
		{model: &model.QuoteSubmission{}, field: "GeneratedFromPriceBookID", label: "quote_submissions.generated_from_price_book_id", index: "CREATE INDEX IF NOT EXISTS idx_quote_submissions_generated_from_price_book_id ON quote_submissions(generated_from_price_book_id)"},
		{model: &model.QuoteSubmission{}, field: "SupersededBy", label: "quote_submissions.superseded_by", index: "CREATE INDEX IF NOT EXISTS idx_quote_submissions_superseded_by ON quote_submissions(superseded_by)"},
		{model: &model.QuoteSubmissionItem{}, field: "PriceTierID", label: "quote_submission_items.price_tier_id", index: "CREATE INDEX IF NOT EXISTS idx_quote_submission_items_tier ON quote_submission_items(price_tier_id)"},
	} {
		if !DB.Migrator().HasTable(alignment.model) {
			continue
		}
		if !DB.Migrator().HasColumn(alignment.model, alignment.field) {
			if err := DB.Migrator().AddColumn(alignment.model, alignment.field); err != nil {
				return fmt.Errorf("add %s: %w", alignment.label, err)
			}
		}
		if strings.TrimSpace(alignment.index) != "" {
			if err := DB.Exec(alignment.index).Error; err != nil {
				return fmt.Errorf("ensure index for %s: %w", alignment.label, err)
			}
		}
	}
	onboardingTables := []struct {
		name  string
		model interface{}
	}{
		{name: "merchant_applications", model: &model.MerchantApplication{}},
		{name: "providers", model: &model.Provider{}},
		{name: "material_shop_applications", model: &model.MaterialShopApplication{}},
		{name: "material_shop_application_products", model: &model.MaterialShopApplicationProduct{}},
		{name: "material_shops", model: &model.MaterialShop{}},
		{name: "material_shop_products", model: &model.MaterialShopProduct{}},
		{name: "merchant_service_settings", model: &model.MerchantServiceSetting{}},
		{name: "material_shop_service_settings", model: &model.MaterialShopServiceSetting{}},
	}

	for _, onboardingTable := range onboardingTables {
		if err := ensureTableColumns(onboardingTable.name, onboardingTable.model); err != nil {
			return fmt.Errorf("align onboarding runtime schema %s: %w", onboardingTable.name, err)
		}
	}

	return nil
}

func alignLegacyQuoteInquirySchema() error {
	if DB == nil || !DB.Migrator().HasTable(&model.QuoteInquiry{}) {
		return nil
	}

	if DB.Migrator().HasColumn(&model.QuoteInquiry{}, "OpenID") {
		return nil
	}

	if !DB.Migrator().HasColumn("quote_inquiries", "openid") {
		return nil
	}

	if err := DB.Exec(`ALTER TABLE quote_inquiries RENAME COLUMN openid TO open_id`).Error; err != nil {
		return fmt.Errorf("rename quote_inquiries.openid to open_id: %w", err)
	}

	return nil
}

func ensureTableColumns(tableName string, runtimeModel interface{}) error {
	if DB == nil {
		return nil
	}

	if !DB.Migrator().HasTable(runtimeModel) {
		log.Printf("Runtime schema table missing, creating: %s", tableName)
		if err := DB.AutoMigrate(runtimeModel); err != nil {
			return fmt.Errorf("create runtime schema table %s: %w", tableName, err)
		}
		return nil
	}

	stmt := &gorm.Statement{DB: DB}
	if err := stmt.Parse(runtimeModel); err != nil {
		return fmt.Errorf("parse runtime schema %s: %w", tableName, err)
	}

	for _, field := range stmt.Schema.Fields {
		if field == nil || field.DBName == "" || field.IgnoreMigration {
			continue
		}
		if DB.Migrator().HasColumn(runtimeModel, field.Name) {
			continue
		}
		if err := DB.Migrator().AddColumn(runtimeModel, field.Name); err != nil {
			return fmt.Errorf("add %s.%s: %w", tableName, field.DBName, err)
		}
	}

	return nil
}

// GetDB 获取数据库实例
func GetDB() *gorm.DB {
	return DB
}

// CloseDB 关闭数据库连接
func CloseDB() {
	if DB != nil {
		sqlDB, err := DB.DB()
		if err == nil {
			sqlDB.Close()
		}
		DB = nil
	}
}
