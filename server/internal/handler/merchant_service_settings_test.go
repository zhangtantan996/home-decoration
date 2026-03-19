package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
)

func TestMerchantServiceSettings_GetAndUpdate(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db := setupSQLiteDB(t)
	if err := db.AutoMigrate(&model.MerchantServiceSetting{}); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}

	previousDB := repository.DB
	repository.DB = db
	t.Cleanup(func() {
		repository.DB = previousDB
	})

	providerID := uint64(303)

	getResp := requestServiceSettingJSON(t, http.MethodGet, "/api/v1/merchant/service-settings", nil, providerID, MerchantGetServiceSettings)
	if getResp.Code != 0 {
		t.Fatalf("unexpected get code: %d message=%s", getResp.Code, getResp.Message)
	}

	var initialData struct {
		AcceptBooking    bool `json:"acceptBooking"`
		AutoConfirmHours int  `json:"autoConfirmHours"`
	}
	if err := json.Unmarshal(getResp.Data, &initialData); err != nil {
		t.Fatalf("decode get response data: %v", err)
	}
	if !initialData.AcceptBooking || initialData.AutoConfirmHours != 24 {
		t.Fatalf("unexpected default service setting: %+v", initialData)
	}

	updatePayload := map[string]any{
		"acceptBooking":    false,
		"autoConfirmHours": 48,
		"responseTimeDesc": "6小时内回复",
		"priceRangeMin":    8000,
		"priceRangeMax":    32000,
		"serviceStyles":    []string{"现代简约", "工业风"},
		"servicePackages": []map[string]any{
			{"name": "半包", "price": 16888},
		},
	}
	updateResp := requestServiceSettingJSON(t, http.MethodPut, "/api/v1/merchant/service-settings", updatePayload, providerID, MerchantUpdateServiceSettings)
	if updateResp.Code != 0 {
		t.Fatalf("unexpected update code: %d message=%s", updateResp.Code, updateResp.Message)
	}

	var setting model.MerchantServiceSetting
	if err := db.Where("provider_id = ?", providerID).First(&setting).Error; err != nil {
		t.Fatalf("query updated service setting: %v", err)
	}

	if setting.AcceptBooking {
		t.Fatalf("acceptBooking should be false")
	}
	if setting.AutoConfirmHours != 48 {
		t.Fatalf("autoConfirmHours mismatch: got=%d want=48", setting.AutoConfirmHours)
	}
	if setting.ResponseTimeDesc != "6小时内回复" {
		t.Fatalf("responseTimeDesc mismatch: got=%s", setting.ResponseTimeDesc)
	}
}

func TestMerchantServiceSettings_InvalidAutoConfirmHours(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db := setupSQLiteDB(t)
	if err := db.AutoMigrate(&model.MerchantServiceSetting{}); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}

	previousDB := repository.DB
	repository.DB = db
	t.Cleanup(func() {
		repository.DB = previousDB
	})

	providerID := uint64(304)
	invalidPayload := map[string]any{
		"acceptBooking":    true,
		"autoConfirmHours": 0,
		"responseTimeDesc": "12小时内回复",
		"priceRangeMin":    0,
		"priceRangeMax":    1000,
		"serviceStyles":    []string{},
		"servicePackages":  []map[string]any{},
	}

	resp := requestServiceSettingJSON(t, http.MethodPut, "/api/v1/merchant/service-settings", invalidPayload, providerID, MerchantUpdateServiceSettings)
	if resp.Code != 400 {
		t.Fatalf("unexpected code: got=%d want=400", resp.Code)
	}
}

func requestServiceSettingJSON(
	t *testing.T,
	method string,
	path string,
	payload any,
	providerID uint64,
	handlerFunc gin.HandlerFunc,
) responseEnvelope {
	t.Helper()

	var bodyBytes []byte
	if payload != nil {
		encoded, err := json.Marshal(payload)
		if err != nil {
			t.Fatalf("marshal payload: %v", err)
		}
		bodyBytes = encoded
	}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(method, path, bytes.NewReader(bodyBytes))
	c.Request.Header.Set("Content-Type", "application/json")
	c.Set("providerId", providerID)

	handlerFunc(c)
	return decodeResponse(t, w)
}

func requestMaterialShopServiceSettingJSON(
	t *testing.T,
	method string,
	path string,
	payload any,
	materialShopID uint64,
	handlerFunc gin.HandlerFunc,
) responseEnvelope {
	t.Helper()

	var bodyBytes []byte
	if payload != nil {
		encoded, err := json.Marshal(payload)
		if err != nil {
			t.Fatalf("marshal payload: %v", err)
		}
		bodyBytes = encoded
	}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(method, path, bytes.NewReader(bodyBytes))
	c.Request.Header.Set("Content-Type", "application/json")
	c.Set("materialShopId", materialShopID)

	handlerFunc(c)
	return decodeResponse(t, w)
}

func TestMaterialShopServiceSettings_GetAndUpdate(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db := setupSQLiteDB(t)
	if err := db.AutoMigrate(&model.MaterialShopServiceSetting{}); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}

	previousDB := repository.DB
	repository.DB = db
	t.Cleanup(func() {
		repository.DB = previousDB
	})

	shopID := uint64(909)
	getResp := requestMaterialShopServiceSettingJSON(t, http.MethodGet, "/api/v1/material-shop/service-settings", nil, shopID, MerchantGetServiceSettings)
	if getResp.Code != 0 {
		t.Fatalf("unexpected get code: %d message=%s", getResp.Code, getResp.Message)
	}

	updatePayload := map[string]any{
		"acceptBooking":          false,
		"autoConfirmHours":       36,
		"responseTimeDesc":       "4小时内回复",
		"priceRangeMin":          1000,
		"priceRangeMax":          5000,
		"serviceStyles":          []string{"现代简约"},
		"servicePackages":        []map[string]any{{"name": "标准包"}},
		"serviceArea":            []string{"西安市雁塔区", "西安市高新区"},
		"mainBrands":             []string{"东鹏", "马可波罗"},
		"mainCategories":         []string{"瓷砖", "卫浴"},
		"deliveryCapability":     "支持市内配送",
		"installationCapability": "支持安装",
		"afterSalesPolicy":       "7天问题响应",
		"invoiceCapability":      "支持专票",
	}
	updateResp := requestMaterialShopServiceSettingJSON(t, http.MethodPut, "/api/v1/material-shop/service-settings", updatePayload, shopID, MerchantUpdateServiceSettings)
	if updateResp.Code != 0 {
		t.Fatalf("unexpected update code: %d message=%s", updateResp.Code, updateResp.Message)
	}

	var setting model.MaterialShopServiceSetting
	if err := db.Where("shop_id = ?", shopID).First(&setting).Error; err != nil {
		t.Fatalf("query updated material shop service setting: %v", err)
	}
	if setting.DeliveryCapability != "支持市内配送" {
		t.Fatalf("deliveryCapability mismatch: got=%s", setting.DeliveryCapability)
	}
	if setting.InvoiceCapability != "支持专票" {
		t.Fatalf("invoiceCapability mismatch: got=%s", setting.InvoiceCapability)
	}
}
