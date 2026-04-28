package repository

import (
	"strings"
	"testing"

	"home-decoration-server/internal/model"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupSchemaHealthDB(t *testing.T, migrateModels ...interface{}) *gorm.DB {
	t.Helper()
	dsn := "file:" + strings.ReplaceAll(t.Name(), "/", "_") + "?mode=memory&cache=shared"
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite db: %v", err)
	}
	if len(migrateModels) > 0 {
		if err := db.AutoMigrate(migrateModels...); err != nil {
			t.Fatalf("auto migrate: %v", err)
		}
	}
	oldDB := DB
	DB = db
	t.Cleanup(func() { DB = oldDB })
	return db
}

func TestRefreshUserAuthSchemaHealthReportsMissingColumns(t *testing.T) {
	setupSchemaHealthDB(t)
	if err := DB.Exec(`CREATE TABLE users (id INTEGER PRIMARY KEY, created_at DATETIME, updated_at DATETIME, phone TEXT)`).Error; err != nil {
		t.Fatalf("create users table: %v", err)
	}

	snapshot := RefreshUserAuthSchemaHealth()
	if snapshot.Status != SMSAuditHealthStatusDegraded {
		t.Fatalf("expected degraded status, got %s", snapshot.Status)
	}
	for _, required := range []string{"users.last_login_at", "users.last_login_ip", "users.public_id"} {
		if !containsString(snapshot.Missing, required) {
			t.Fatalf("expected missing to contain %s, got %+v", required, snapshot.Missing)
		}
	}
	if snapshot.RequiredMigration != CanonicalSchemaReconcileMigrationPath {
		t.Fatalf("unexpected migration path: %s", snapshot.RequiredMigration)
	}
}

func TestRefreshBookingP0SchemaHealthReportsMissingTables(t *testing.T) {
	setupSchemaHealthDB(t)

	snapshot := RefreshBookingP0SchemaHealth()
	if snapshot.Status != SMSAuditHealthStatusDegraded {
		t.Fatalf("expected degraded status, got %s", snapshot.Status)
	}
	for _, required := range []string{"site_surveys", "budget_confirmations"} {
		if !containsString(snapshot.Missing, required) {
			t.Fatalf("expected missing to contain %s, got %+v", required, snapshot.Missing)
		}
	}
	if snapshot.RequiredMigration != BookingP0MigrationPath {
		t.Fatalf("unexpected migration path: %s", snapshot.RequiredMigration)
	}
}

func TestRefreshProjectRiskSchemaHealthReportsMissingTables(t *testing.T) {
	setupSchemaHealthDB(t, &model.Project{})

	snapshot := RefreshProjectRiskSchemaHealth()
	if snapshot.Status != SMSAuditHealthStatusDegraded {
		t.Fatalf("expected degraded status, got %s", snapshot.Status)
	}
	for _, required := range []string{"project_audits", "refund_applications"} {
		if !containsString(snapshot.Missing, required) {
			t.Fatalf("expected missing to contain %s, got %+v", required, snapshot.Missing)
		}
	}
	if snapshot.RequiredMigration != ProjectRiskMigrationPath {
		t.Fatalf("unexpected migration path: %s", snapshot.RequiredMigration)
	}
}

func TestRefreshCommerceRuntimeSchemaHealthReportsMissingTables(t *testing.T) {
	setupSchemaHealthDB(t)

	snapshot := RefreshCommerceRuntimeSchemaHealth()
	if snapshot.Status != SMSAuditHealthStatusDegraded {
		t.Fatalf("expected degraded status, got %s", snapshot.Status)
	}
	for _, required := range []string{"providers", "bookings", "design_working_docs", "quantity_bases", "quantity_base_items"} {
		if !containsString(snapshot.Missing, required) {
			t.Fatalf("expected missing to contain %s, got %+v", required, snapshot.Missing)
		}
	}
	expectedMigration := CommerceRuntimeBaseMigrationPath + "," + QuoteRuntimeMigrationPath + "," + FinancialRuntimeMigrationPath
	if snapshot.RequiredMigration != expectedMigration {
		t.Fatalf("unexpected migration path: %s", snapshot.RequiredMigration)
	}
}

func TestRefreshOutboxRuntimeSchemaHealthReportsMissingTable(t *testing.T) {
	setupSchemaHealthDB(t)

	snapshot := RefreshOutboxRuntimeSchemaHealth()
	if snapshot.Status != SMSAuditHealthStatusDegraded {
		t.Fatalf("expected degraded status, got %s", snapshot.Status)
	}
	if !containsString(snapshot.Missing, "outbox_events") {
		t.Fatalf("expected missing outbox_events, got %+v", snapshot.Missing)
	}
	if snapshot.RequiredMigration != OutboxRuntimeMigrationPath {
		t.Fatalf("unexpected migration path: %s", snapshot.RequiredMigration)
	}
}

func TestRefreshOutboxRuntimeSchemaHealthPassesWithTableAndIndexes(t *testing.T) {
	setupSchemaHealthDB(t, &model.OutboxEvent{})

	snapshot := RefreshOutboxRuntimeSchemaHealth()
	if snapshot.Status != SMSAuditHealthStatusOK {
		t.Fatalf("expected ok status, got %+v", snapshot)
	}
}

func TestResolveCommerceRuntimeMigrationPath(t *testing.T) {
	if got := resolveCommerceRuntimeMigrationPath([]string{"providers.is_settled"}); got != CommerceRuntimeBaseMigrationPath {
		t.Fatalf("expected base runtime migration path, got %s", got)
	}
	if got := resolveCommerceRuntimeMigrationPath([]string{"quote_lists.quantity_base_id"}); got != QuoteRuntimeMigrationPath {
		t.Fatalf("expected quote runtime migration path, got %s", got)
	}
	if got := resolveCommerceRuntimeMigrationPath([]string{"payment_plans.change_order_id"}); got != ChangeOrderLinkMigrationPath {
		t.Fatalf("expected change-order link migration path, got %s", got)
	}
	expectedCombined := CommerceRuntimeBaseMigrationPath + "," + QuoteRuntimeMigrationPath + "," + ChangeOrderLinkMigrationPath
	if got := resolveCommerceRuntimeMigrationPath([]string{"providers.is_settled", "quote_lists.quantity_base_id", "payment_plans.change_order_id"}); got != expectedCombined {
		t.Fatalf("expected base quote change-order runtime migration path, got %s", got)
	}
	if got := resolveCommerceRuntimeMigrationPath([]string{"settlement_orders.status", "payout_orders.status"}); got != FinancialRuntimeMigrationPath {
		t.Fatalf("expected financial runtime migration path, got %s", got)
	}
}

func TestQuotePKTablesRemainLegacyOutsideCommerceRuntimeTruth(t *testing.T) {
	if _, ok := quoteRuntimeTables["quote_tasks"]; ok {
		t.Fatalf("quote_tasks should remain legacy and stay outside quote runtime truth tables")
	}
	if _, ok := quoteRuntimeTables["quote_pk_submissions"]; ok {
		t.Fatalf("quote_pk_submissions should remain legacy and stay outside quote runtime truth tables")
	}
	if _, ok := commerceRuntimeRequirements["quote_tasks"]; ok {
		t.Fatalf("quote_tasks should not be part of current commerce runtime requirements")
	}
	if _, ok := commerceRuntimeRequirements["quote_pk_submissions"]; ok {
		t.Fatalf("quote_pk_submissions should not be part of current commerce runtime requirements")
	}
}

func TestEnsureCriticalSchemaReleaseFailsOnMissingMerchantSchema(t *testing.T) {
	setupSchemaHealthDB(t, &model.User{}, &model.SMSAuditLog{})
	if err := EnsureCriticalSchema("release"); err == nil {
		t.Fatalf("expected release preflight failure when merchant onboarding schema missing")
	}
}

func TestEnsureCriticalSchemaNonReleaseAllowsDegradedSchema(t *testing.T) {
	setupSchemaHealthDB(t, &model.User{}, &model.SMSAuditLog{})
	if err := EnsureCriticalSchema("debug"); err != nil {
		t.Fatalf("expected non-release preflight to allow degraded schema, got %v", err)
	}
}

func TestIsSchemaMismatchError(t *testing.T) {
	for _, errText := range []string{
		`ERROR: column "public_id" of relation "users" does not exist`,
		`no such column: last_login_at`,
		`table sms_audit_logs does not exist`,
	} {
		if !IsSchemaMismatchError(assertErrString(errText)) {
			t.Fatalf("expected schema mismatch for %q", errText)
		}
	}
}

type errString string

func (e errString) Error() string { return string(e) }

func assertErrString(message string) error {
	return errString(message)
}

func containsString(values []string, want string) bool {
	for _, value := range values {
		if value == want {
			return true
		}
	}
	return false
}
