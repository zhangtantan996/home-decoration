package repository

import (
	"strings"
	"testing"
)

func TestSmokeWriteMerchantApplicationSuccess(t *testing.T) {
	setupSchemaHealthDB(t)
	if err := DB.Exec(`
		CREATE TABLE merchant_applications (
			id INTEGER PRIMARY KEY,
			phone TEXT,
			role TEXT,
			entity_type TEXT,
			created_at DATETIME,
			updated_at DATETIME,
			team_size INTEGER,
			service_area TEXT,
			user_id INTEGER,
			provider_id INTEGER
		)
	`).Error; err != nil {
		t.Fatalf("create merchant_applications table: %v", err)
	}

	result := RunSmokeWrite(SmokeOpMerchantApplicationWrite)
	if !result.Success {
		t.Fatalf("expected merchant_application_write to succeed, got error: %s", result.Error)
	}
}

func TestSmokeWriteMaterialShopProductSuccess(t *testing.T) {
	setupSchemaHealthDB(t)
	if err := DB.Exec(`
		CREATE TABLE material_shop_products (
			id INTEGER PRIMARY KEY,
			shop_id INTEGER,
			name TEXT,
			unit TEXT,
			description TEXT,
			price REAL,
			created_at DATETIME,
			updated_at DATETIME
		)
	`).Error; err != nil {
		t.Fatalf("create material_shop_products table: %v", err)
	}

	result := RunSmokeWrite(SmokeOpMaterialShopProductWrite)
	if !result.Success {
		t.Fatalf("expected material_shop_product_write to succeed, got error: %s", result.Error)
	}
}

func TestSmokeWriteSMSAuditLogSuccess(t *testing.T) {
	setupSchemaHealthDB(t)
	if err := DB.Exec(`
		CREATE TABLE sms_audit_logs (
			id INTEGER PRIMARY KEY,
			request_id TEXT,
			purpose TEXT,
			phone_hash TEXT,
			client_ip TEXT,
			provider TEXT,
			message_id TEXT,
			provider_request_id TEXT,
			status TEXT,
			error_code TEXT,
			error_message TEXT,
			risk_tier TEXT,
			template_key TEXT,
			template_code TEXT,
			created_at DATETIME,
			updated_at DATETIME
		)
	`).Error; err != nil {
		t.Fatalf("create sms_audit_logs table: %v", err)
	}

	result := RunSmokeWrite(SmokeOpSMSAuditLogWrite)
	if !result.Success {
		t.Fatalf("expected sms_audit_log_write to succeed, got error: %s", result.Error)
	}
}

func TestCheckHighRiskTableColumnsUnknownTable(t *testing.T) {
	setupSchemaHealthDB(t)
	result := CheckHighRiskTableColumns("unknown_table")
	if result.Exists {
		t.Fatalf("expected unknown table to not exist")
	}
	if len(result.Missing) == 0 {
		t.Fatalf("expected missing to contain table name")
	}
}

func TestCheckHighRiskTableColumnsWithMissingColumns(t *testing.T) {
	setupSchemaHealthDB(t)
	if err := DB.Exec(`CREATE TABLE merchant_applications (id INTEGER PRIMARY KEY, phone TEXT)`).Error; err != nil {
		t.Fatalf("create merchant_applications table: %v", err)
	}

	result := CheckHighRiskTableColumns("merchant_applications")
	if !result.Exists {
		t.Fatalf("expected table to exist")
	}
	if len(result.Missing) == 0 {
		t.Fatalf("expected missing columns, got %+v", result.Missing)
	}
	if !strings.Contains(strings.Join(result.Missing, ","), "team_size") {
		t.Fatalf("expected team_size in missing columns")
	}
}

func TestCheckAllHighRiskTables(t *testing.T) {
	setupSchemaHealthDB(t)
	results := CheckAllHighRiskTables()
	if len(results) == 0 {
		t.Fatalf("expected results, got none")
	}
}

func TestCheckHighRiskTableColumnsDBNotInitialized(t *testing.T) {
	oldDB := DB
	DB = nil
	t.Cleanup(func() { DB = oldDB })

	result := CheckHighRiskTableColumns("merchant_applications")
	if len(result.Missing) == 0 {
		t.Fatalf("expected missing columns when DB not initialized")
	}
}

func TestSmokeOperationUnknownOperation(t *testing.T) {
	setupSchemaHealthDB(t)
	result := RunSmokeWrite("unknown_operation")
	if result.Success {
		t.Fatalf("expected unknown operation to fail")
	}
	if result.Error == "" {
		t.Fatalf("expected error message")
	}
}

func TestSchemaGuardMigrationPath(t *testing.T) {
	if SchemaGuardMigrationPath != "server/migrations/v1.6.9_reconcile_high_risk_schema_guard.sql" {
		t.Fatalf("unexpected migration path: %s", SchemaGuardMigrationPath)
	}
}

func TestHighRiskTablesCount(t *testing.T) {
	expectedTables := []string{
		"merchant_applications",
		"providers",
		"material_shop_applications",
		"material_shops",
		"material_shop_application_products",
		"material_shop_products",
		"sms_audit_logs",
	}
	if len(HighRiskTables) != len(expectedTables) {
		t.Fatalf("expected %d high risk tables, got %d", len(expectedTables), len(HighRiskTables))
	}
}

func TestSmokeOperationConstants(t *testing.T) {
	expected := map[string]string{
		SmokeOpMerchantApplicationWrite:            "merchant_application_write",
		SmokeOpProviderWrite:                       "provider_write",
		SmokeOpMaterialShopApplicationWrite:        "material_shop_application_write",
		SmokeOpMaterialShopApplicationProductWrite: "material_shop_application_product_write",
		SmokeOpMaterialShopProductWrite:            "material_shop_product_write",
		SmokeOpSMSAuditLogWrite:                    "sms_audit_log_write",
	}
	for got, want := range expected {
		if got != want {
			t.Fatalf("expected %s, got %s", want, got)
		}
	}
}
