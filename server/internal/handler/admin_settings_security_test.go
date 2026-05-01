package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"

	"github.com/gin-gonic/gin"
)

func setupSettingsSecurityDB(t *testing.T) {
	t.Helper()
	db := setupRawSQLiteDB(t)
	if err := db.AutoMigrate(&model.SystemSettings{}, &model.SystemConfig{}, &model.AuditLog{}); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}
	previousDB := repository.DB
	repository.DB = db
	t.Cleanup(func() { repository.DB = previousDB })
}

func TestAdminGetSettingsOmitsSecretKeys(t *testing.T) {
	gin.SetMode(gin.TestMode)
	setupSettingsSecurityDB(t)

	if err := repository.DB.Create(&[]model.SystemSettings{
		{Key: "site_name", Value: "禾泽云"},
		{Key: "sms_access_key", Value: "ak"},
		{Key: "sms_secret_key", Value: "sk"},
		{Key: "im_tencent_secret_key", Value: "im-secret"},
	}).Error; err != nil {
		t.Fatalf("seed settings: %v", err)
	}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	AdminGetSettings(c)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", w.Code, w.Body.String())
	}
	body := w.Body.String()
	for _, forbidden := range []string{"sms_access_key", "sms_secret_key", "im_tencent_secret_key", "ak", "sk", "im-secret"} {
		if strings.Contains(body, forbidden) {
			t.Fatalf("settings response leaked %q: %s", forbidden, body)
		}
	}
	if !strings.Contains(body, "site_name") {
		t.Fatalf("settings response should keep non-secret settings: %s", body)
	}
}

func TestAdminUpdateSettingsRejectsSecretKeys(t *testing.T) {
	gin.SetMode(gin.TestMode)
	setupSettingsSecurityDB(t)

	if err := repository.DB.Create(&model.SystemSettings{Key: "sms_secret_key", Value: "old"}).Error; err != nil {
		t.Fatalf("seed setting: %v", err)
	}

	req := httptest.NewRequest(http.MethodPut, "/api/v1/admin/settings", strings.NewReader(`{"sms_secret_key":"new"}`))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = req

	AdminUpdateSettings(c)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d body=%s", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), `"code":400`) {
		t.Fatalf("expected business error code 400, got %s", w.Body.String())
	}
	var setting model.SystemSettings
	if err := repository.DB.Where("\"key\" = ?", "sms_secret_key").First(&setting).Error; err != nil {
		t.Fatalf("query setting: %v", err)
	}
	if setting.Value != "old" {
		t.Fatalf("secret key should not be mutated, got %q", setting.Value)
	}
}

func TestAdminUpdateSystemConfigRejectsUnknownAndDeprecatedKeys(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupSQLiteDB(t)
	previousDB := repository.DB
	repository.DB = db
	t.Cleanup(func() { repository.DB = previousDB })

	for _, tc := range []struct {
		name string
		key  string
	}{
		{name: "unknown", key: "typo.unknown_config"},
		{name: "deprecated construction fee stages", key: "order.construction_fee_stages"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			body, _ := json.Marshal(map[string]string{"value": "123"})
			req := httptest.NewRequest(http.MethodPut, "/api/v1/admin/system-configs/"+tc.key, strings.NewReader(string(body)))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			c.Request = req
			c.Params = gin.Params{{Key: "key", Value: tc.key}}
			c.Set("admin_id", uint64(7))
			c.Set("admin_reason", "配置校验")

			AdminUpdateSystemConfig(c)

			if w.Code != http.StatusOK {
				t.Fatalf("expected 200 envelope, got %d body=%s", w.Code, w.Body.String())
			}
			if !strings.Contains(w.Body.String(), `"code":400`) {
				t.Fatalf("expected business error, got %s", w.Body.String())
			}
		})
	}
}

func TestAdminSetProviderAvailabilityWritesAudit(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupSQLiteDB(t)
	previousDB := repository.DB
	repository.DB = db
	t.Cleanup(func() { repository.DB = previousDB })

	provider := model.Provider{
		DisplayName:               "服务商A",
		Status:                    merchantProviderStatusActive,
		PlatformDisplayEnabled:    true,
		MerchantDisplayEnabled:    true,
		NeedsOnboardingCompletion: false,
	}
	if err := db.Create(&provider).Error; err != nil {
		t.Fatalf("seed provider: %v", err)
	}

	req := httptest.NewRequest(http.MethodPatch, "/api/v1/admin/providers/1/availability", strings.NewReader(`{"enabled":false}`))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = req
	c.Params = gin.Params{{Key: "id", Value: "1"}}
	c.Set("adminId", uint64(9))
	c.Set("admin_reason", "违规内容下线")

	AdminSetProviderAvailability(c)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", w.Code, w.Body.String())
	}
	var updated model.Provider
	if err := db.First(&updated, provider.ID).Error; err != nil {
		t.Fatalf("query provider: %v", err)
	}
	if updated.Status != merchantProviderStatusFrozen || updated.PlatformDisplayEnabled {
		t.Fatalf("provider availability not updated: status=%d display=%v", updated.Status, updated.PlatformDisplayEnabled)
	}
	var audit model.AuditLog
	if err := db.Where("operation_type = ?", "set_provider_availability").First(&audit).Error; err != nil {
		t.Fatalf("expected provider availability audit: %v", err)
	}
	if audit.Reason != "违规内容下线" {
		t.Fatalf("unexpected audit reason: %q", audit.Reason)
	}
	if !strings.Contains(audit.BeforeState, `"platformDisplayEnabled":true`) || !strings.Contains(audit.AfterState, `"platformDisplayEnabled":false`) {
		t.Fatalf("audit should include before/after display state: before=%s after=%s", audit.BeforeState, audit.AfterState)
	}
}

func TestAdminSetMaterialShopAvailabilityWritesAudit(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupSQLiteDB(t)
	previousDB := repository.DB
	repository.DB = db
	t.Cleanup(func() { repository.DB = previousDB })

	status := merchantProviderStatusActive
	shop := model.MaterialShop{
		Name:                   "主材门店A",
		Status:                 &status,
		PlatformDisplayEnabled: true,
		MerchantDisplayEnabled: true,
	}
	if err := db.Create(&shop).Error; err != nil {
		t.Fatalf("seed material shop: %v", err)
	}

	req := httptest.NewRequest(http.MethodPatch, "/api/v1/admin/material-shops/1/availability", strings.NewReader(`{"enabled":false}`))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = req
	c.Params = gin.Params{{Key: "id", Value: "1"}}
	c.Set("adminId", uint64(9))
	c.Set("admin_reason", "暂停经营")

	AdminSetMaterialShopAvailability(c)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", w.Code, w.Body.String())
	}
	var updated model.MaterialShop
	if err := db.First(&updated, shop.ID).Error; err != nil {
		t.Fatalf("query material shop: %v", err)
	}
	if materialShopStatusValue(updated.Status) != merchantProviderStatusFrozen || updated.PlatformDisplayEnabled {
		t.Fatalf("material shop availability not updated: status=%d display=%v", materialShopStatusValue(updated.Status), updated.PlatformDisplayEnabled)
	}
	var audit model.AuditLog
	if err := db.Where("operation_type = ?", "set_material_shop_availability").First(&audit).Error; err != nil {
		t.Fatalf("expected material shop availability audit: %v", err)
	}
	if audit.Reason != "暂停经营" {
		t.Fatalf("unexpected audit reason: %q", audit.Reason)
	}
	if !strings.Contains(audit.BeforeState, `"platformDisplayEnabled":true`) || !strings.Contains(audit.AfterState, `"platformDisplayEnabled":false`) {
		t.Fatalf("audit should include before/after display state: before=%s after=%s", audit.BeforeState, audit.AfterState)
	}
}
