package repository

import (
	"fmt"
	"time"

	"gorm.io/gorm"
)

const (
	SchemaGuardMigrationPath = "server/migrations/v1.9.14_add_claimed_completion_onboarding_columns.sql"
)

const (
	SmokeOpMerchantApplicationWrite            = "merchant_application_write"
	SmokeOpProviderWrite                       = "provider_write"
	SmokeOpMaterialShopApplicationWrite        = "material_shop_application_write"
	SmokeOpMaterialShopApplicationProductWrite = "material_shop_application_product_write"
	SmokeOpMaterialShopProductWrite            = "material_shop_product_write"
	SmokeOpSMSAuditLogWrite                    = "sms_audit_log_write"
)

var HighRiskTables = map[string][]string{
	"merchant_applications":              {"team_size", "office_address", "service_area", "styles", "introduction", "portfolio_cases", "user_id", "provider_id", "application_scene"},
	"providers":                          {"service_area", "service_intro", "team_size", "office_address", "followers_count", "established_year", "certifications", "cover_image", "needs_onboarding_completion"},
	"sys_admins":                         {"must_reset_password", "password_changed_at", "two_factor_enabled", "two_factor_secret", "two_factor_bound_at", "disabled_reason"},
	"material_shop_applications":         {"business_hours_json", "brand_logo", "application_scene"},
	"material_shops":                     {"business_hours_json", "needs_onboarding_completion"},
	"material_shop_application_products": {"unit"},
	"material_shop_products":             {"unit", "description"},
	"sms_audit_logs":                     {"risk_tier", "template_key", "template_code"},
}

type SchemaGuardCheckResult struct {
	Table     string   `json:"table"`
	Columns   []string `json:"columns"`
	Missing   []string `json:"missing"`
	Exists    bool     `json:"exists"`
	CheckTime string   `json:"checkTime"`
}

type SchemaGuardSmokeResult struct {
	Operation string `json:"operation"`
	Success   bool   `json:"success"`
	Error     string `json:"error,omitempty"`
	CheckTime string `json:"checkTime"`
}

func CheckHighRiskTableColumns(table string) SchemaGuardCheckResult {
	result := SchemaGuardCheckResult{
		Table:     table,
		CheckTime: time.Now().Format(time.RFC3339),
	}

	columns, ok := HighRiskTables[table]
	if !ok {
		result.Exists = false
		result.Missing = []string{table}
		return result
	}

	result.Exists = true
	result.Columns = columns

	if DB == nil {
		result.Missing = columns
		return result
	}

	if !DB.Migrator().HasTable(table) {
		result.Exists = false
		result.Missing = append([]string{table}, columns...)
		return result
	}

	for _, col := range columns {
		if !DB.Migrator().HasColumn(table, col) {
			result.Missing = append(result.Missing, fmt.Sprintf("%s.%s", table, col))
		}
	}

	return result
}

func CheckAllHighRiskTables() []SchemaGuardCheckResult {
	results := make([]SchemaGuardCheckResult, 0, len(HighRiskTables))
	for table := range HighRiskTables {
		results = append(results, CheckHighRiskTableColumns(table))
	}
	return results
}

func RunSmokeWrite(op string) SchemaGuardSmokeResult {
	result := SchemaGuardSmokeResult{
		Operation: op,
		CheckTime: time.Now().Format(time.RFC3339),
	}

	if DB == nil {
		result.Success = false
		result.Error = "database not initialized"
		return result
	}

	tx := DB.Begin()
	if tx.Error != nil {
		result.Success = false
		result.Error = fmt.Sprintf("failed to begin transaction: %v", tx.Error)
		return result
	}

	smokeErr := runSmokeOperation(tx, op)

	if smokeErr != nil {
		tx.Rollback()
		result.Success = false
		result.Error = smokeErr.Error()
		return result
	}

	tx.Rollback()
	result.Success = true
	return result
}

func runSmokeOperation(tx *gorm.DB, op string) error {
	now := time.Now()
	switch op {
	case SmokeOpMerchantApplicationWrite:
		return tx.Exec(`
			INSERT INTO merchant_applications (phone, role, entity_type, created_at, updated_at, team_size, service_area, user_id, provider_id, application_scene)
			VALUES ('13800138000', 'designer', 'personal', ?, ?, 1, '[]', 0, 0, 'new_onboarding')
			ON CONFLICT DO NOTHING
		`, now, now).Error

	case SmokeOpProviderWrite:
		return tx.Exec(`
			INSERT INTO providers (user_id, provider_type, company_name, created_at, updated_at, service_area, service_intro, team_size, needs_onboarding_completion)
			VALUES (0, 1, 'smoke_test_provider', ?, ?, '[]', 'smoke test', 1, FALSE)
			ON CONFLICT DO NOTHING
		`, now, now).Error

	case SmokeOpMaterialShopApplicationWrite:
		return tx.Exec(`
			INSERT INTO material_shop_applications (user_id, phone, entity_type, shop_name, created_at, updated_at, business_hours_json)
			VALUES (0, '13800138000', 'company', 'smoke_test_shop', ?, ?, '[]')
			ON CONFLICT DO NOTHING
		`, now, now).Error

	case SmokeOpMaterialShopApplicationProductWrite:
		return tx.Exec(`
			INSERT INTO material_shop_application_products (application_id, name, unit, price, created_at, updated_at)
			VALUES (0, 'smoke_test_product', '件', 0, ?, ?)
			ON CONFLICT DO NOTHING
		`, now, now).Error

	case SmokeOpMaterialShopProductWrite:
		return tx.Exec(`
			INSERT INTO material_shop_products (shop_id, name, unit, description, price, created_at, updated_at)
			VALUES (0, 'smoke_test_product', '件', 'smoke test description', 0, ?, ?)
			ON CONFLICT DO NOTHING
		`, now, now).Error

	case SmokeOpSMSAuditLogWrite:
		requestID := fmt.Sprintf("smoke_test_%d", time.Now().UnixNano())
		return tx.Exec(`
			INSERT INTO sms_audit_logs (request_id, purpose, phone_hash, client_ip, provider, status, risk_tier, template_key, template_code, created_at, updated_at)
			VALUES (?, 'test', '', '', '', '', 'low', 'test', 'test', ?, ?)
			ON CONFLICT DO NOTHING
		`, requestID, now, now).Error

	default:
		return fmt.Errorf("unknown smoke operation: %s", op)
	}
}

func RunAllSmokeTests() []SchemaGuardSmokeResult {
	operations := []string{
		SmokeOpMerchantApplicationWrite,
		SmokeOpProviderWrite,
		SmokeOpMaterialShopApplicationWrite,
		SmokeOpMaterialShopApplicationProductWrite,
		SmokeOpMaterialShopProductWrite,
		SmokeOpSMSAuditLogWrite,
	}

	results := make([]SchemaGuardSmokeResult, 0, len(operations))
	for _, op := range operations {
		results = append(results, RunSmokeWrite(op))
	}
	return results
}
