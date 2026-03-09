package handler

import (
	"encoding/json"
	"net/http/httptest"
	"strings"
	"testing"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"

	"github.com/gin-gonic/gin"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

type healthCheckResponse struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Data    struct {
		Status     string `json:"status"`
		Service    string `json:"service"`
		AlertCount int    `json:"alertCount"`
		Alerts     []struct {
			Code      string            `json:"code"`
			Severity  string            `json:"severity"`
			Component string            `json:"component"`
			Summary   string            `json:"summary"`
			Action    string            `json:"action"`
			Metadata  map[string]string `json:"metadata"`
		} `json:"alerts"`
		Checks struct {
			SMSAuditLog struct {
				Status            string `json:"status"`
				Table             string `json:"table"`
				TableExists       bool   `json:"tableExists"`
				MigrationRequired bool   `json:"migrationRequired"`
				RequiredMigration string `json:"requiredMigration"`
			} `json:"smsAuditLog"`
			UserAuthSchema struct {
				Status            string   `json:"status"`
				Component         string   `json:"component"`
				MigrationRequired bool     `json:"migrationRequired"`
				RequiredMigration string   `json:"requiredMigration"`
				Missing           []string `json:"missing"`
			} `json:"userAuthSchema"`
			MerchantOnboardingSchema struct {
				Status            string   `json:"status"`
				Component         string   `json:"component"`
				MigrationRequired bool     `json:"migrationRequired"`
				RequiredMigration string   `json:"requiredMigration"`
				Missing           []string `json:"missing"`
			} `json:"merchantOnboardingSchema"`
		} `json:"checks"`
	} `json:"data"`
}

func newHealthTestDB(t *testing.T, withSMSAudit bool) *gorm.DB {
	t.Helper()
	dsn := "file:" + strings.ReplaceAll(t.Name(), "/", "_") + "?mode=memory&cache=shared"
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite db: %v", err)
	}
	models := []interface{}{
		&model.User{},
		&model.MerchantApplication{},
		&model.Provider{},
		&model.MaterialShop{},
		&model.MaterialShopApplication{},
		&model.MaterialShopApplicationProduct{},
		&model.MaterialShopProduct{},
		&model.MerchantIdentityChangeApplication{},
	}
	if withSMSAudit {
		models = append(models, &model.SMSAuditLog{})
	}
	if err := db.AutoMigrate(models...); err != nil {
		t.Fatalf("auto migrate health schema: %v", err)
	}
	return db
}

func withHealthRepositoryDB(t *testing.T, db *gorm.DB) {
	t.Helper()
	oldDB := repository.DB
	repository.DB = db
	t.Cleanup(func() {
		repository.DB = oldDB
	})
}

func decodeHealthResponse(t *testing.T, body []byte) healthCheckResponse {
	t.Helper()
	var payload healthCheckResponse
	if err := json.Unmarshal(body, &payload); err != nil {
		t.Fatalf("decode health response: %v", err)
	}
	return payload
}

func TestHealthCheckReportsDegradedWhenSMSAuditTableMissing(t *testing.T) {
	gin.SetMode(gin.TestMode)
	withHealthRepositoryDB(t, newHealthTestDB(t, false))

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	HealthCheck(c)

	if w.Code != 200 {
		t.Fatalf("expected status code 200, got %d", w.Code)
	}
	payload := decodeHealthResponse(t, w.Body.Bytes())
	if payload.Data.Status != "degraded" {
		t.Fatalf("expected degraded health status, got %s", payload.Data.Status)
	}
	if payload.Data.Checks.SMSAuditLog.TableExists {
		t.Fatalf("expected sms_audit_logs to be missing")
	}
	if !payload.Data.Checks.SMSAuditLog.MigrationRequired {
		t.Fatalf("expected migrationRequired=true when table is missing")
	}
	if payload.Data.Checks.UserAuthSchema.Status != "ok" {
		t.Fatalf("expected user auth schema ok, got %s", payload.Data.Checks.UserAuthSchema.Status)
	}
	if payload.Data.Checks.MerchantOnboardingSchema.Status != "ok" {
		t.Fatalf("expected merchant onboarding schema ok, got %s", payload.Data.Checks.MerchantOnboardingSchema.Status)
	}
	if payload.Data.AlertCount != 1 {
		t.Fatalf("expected alertCount=1, got %d", payload.Data.AlertCount)
	}
	if payload.Data.Alerts[0].Code != "sms_audit_log_table_missing" {
		t.Fatalf("unexpected alert code: %s", payload.Data.Alerts[0].Code)
	}
	if payload.Data.Alerts[0].Metadata["requiredMigration"] != repository.CanonicalSchemaReconcileMigrationPath {
		t.Fatalf("unexpected migration metadata: %s", payload.Data.Alerts[0].Metadata["requiredMigration"])
	}
}

func TestHealthCheckReportsOKWhenSMSAuditTableExists(t *testing.T) {
	gin.SetMode(gin.TestMode)
	withHealthRepositoryDB(t, newHealthTestDB(t, true))

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	HealthCheck(c)

	if w.Code != 200 {
		t.Fatalf("expected status code 200, got %d", w.Code)
	}
	payload := decodeHealthResponse(t, w.Body.Bytes())
	if payload.Data.Status != "ok" {
		t.Fatalf("expected ok health status, got %s", payload.Data.Status)
	}
	if !payload.Data.Checks.SMSAuditLog.TableExists {
		t.Fatalf("expected sms_audit_logs to exist")
	}
	if payload.Data.Checks.SMSAuditLog.MigrationRequired {
		t.Fatalf("expected migrationRequired=false when table exists")
	}
	if payload.Data.Checks.SMSAuditLog.RequiredMigration != repository.CanonicalSchemaReconcileMigrationPath {
		t.Fatalf("unexpected migration path: %s", payload.Data.Checks.SMSAuditLog.RequiredMigration)
	}
	if payload.Data.Checks.UserAuthSchema.Status != "ok" {
		t.Fatalf("expected user auth schema ok, got %s", payload.Data.Checks.UserAuthSchema.Status)
	}
	if payload.Data.Checks.MerchantOnboardingSchema.Status != "ok" {
		t.Fatalf("expected merchant onboarding schema ok, got %s", payload.Data.Checks.MerchantOnboardingSchema.Status)
	}
	if payload.Data.AlertCount != 0 {
		t.Fatalf("expected alertCount=0, got %d", payload.Data.AlertCount)
	}
	if len(payload.Data.Alerts) != 0 {
		t.Fatalf("expected no alerts, got %d", len(payload.Data.Alerts))
	}
}
