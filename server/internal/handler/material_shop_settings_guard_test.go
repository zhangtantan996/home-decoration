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

func TestMaterialShopUpdateMe_AllowsBusinessProfileFields(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db := setupSQLiteDB(t)
	if err := db.AutoMigrate(&model.MaterialShop{}); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}

	previousDB := repository.DB
	repository.DB = db
	t.Cleanup(func() { repository.DB = previousDB })

	enabled := int8(1)
	shop := model.MaterialShop{
		Base:                   model.Base{ID: 501},
		Name:                   "旧店铺名",
		CompanyName:            "旧公司名",
		BrandLogo:              "/old-logo.jpg",
		ContactName:            "张三",
		ContactPhone:           "13800000000",
		Address:                "旧地址",
		OpenTime:               "周一至周五 09:00-18:00",
		MerchantDisplayEnabled: true,
		Status:                 &enabled,
	}
	if err := db.Create(&shop).Error; err != nil {
		t.Fatalf("seed shop: %v", err)
	}

	payload := map[string]any{
		"avatar":                 "/new-logo.jpg",
		"shopName":               "新店铺名",
		"shopDescription":        "新店铺描述",
		"companyName":            "新公司名",
		"contactName":            "李四",
		"contactPhone":           "13900000000",
		"address":                "新地址",
		"merchantDisplayEnabled": false,
		"businessHoursRanges": []map[string]any{
			{"day": 1, "start": "09:00", "end": "18:00"},
		},
	}

	resp := requestMaterialShopSettingsJSON(t, http.MethodPut, "/api/v1/material-shop/me", payload, shop.ID)
	if resp.Code != 0 {
		t.Fatalf("unexpected code: got=%d message=%s", resp.Code, resp.Message)
	}

	var updated model.MaterialShop
	if err := db.First(&updated, shop.ID).Error; err != nil {
		t.Fatalf("query shop: %v", err)
	}
	if updated.Name != "新店铺名" || updated.CompanyName != "新公司名" {
		t.Fatalf("unexpected shop names: %#v", updated)
	}
	if updated.Description != "新店铺描述" {
		t.Fatalf("unexpected description: %s", updated.Description)
	}
	if updated.ContactName != "李四" || updated.ContactPhone != "13900000000" {
		t.Fatalf("unexpected contact fields: %#v", updated)
	}
	if updated.Address != "新地址" {
		t.Fatalf("unexpected address: %s", updated.Address)
	}
	if updated.BrandLogo != "/new-logo.jpg" {
		t.Fatalf("expected brand logo updated, got=%q", updated.BrandLogo)
	}
	if updated.MerchantDisplayEnabled {
		t.Fatalf("expected merchant display to be disabled")
	}
	if updated.OpenTime == "" || updated.BusinessHoursJSON == "" {
		t.Fatalf("expected business hours saved, got openTime=%q json=%q", updated.OpenTime, updated.BusinessHoursJSON)
	}
}

func TestMaterialShopUpdateMe_ToggleMerchantDisplayOnly(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db := setupSQLiteDB(t)
	if err := db.AutoMigrate(&model.MaterialShop{}); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}

	previousDB := repository.DB
	repository.DB = db
	t.Cleanup(func() { repository.DB = previousDB })

	enabled := int8(1)
	shop := model.MaterialShop{
		Base:                   model.Base{ID: 503},
		Name:                   "潜水艇",
		MerchantDisplayEnabled: true,
		Status:                 &enabled,
	}
	if err := db.Create(&shop).Error; err != nil {
		t.Fatalf("seed shop: %v", err)
	}

	payload := map[string]any{
		"merchantDisplayEnabled": false,
	}

	resp := requestMaterialShopSettingsJSON(t, http.MethodPut, "/api/v1/material-shop/me", payload, shop.ID)
	if resp.Code != 0 {
		t.Fatalf("unexpected code: got=%d message=%s", resp.Code, resp.Message)
	}

	var updated model.MaterialShop
	if err := db.First(&updated, shop.ID).Error; err != nil {
		t.Fatalf("query shop: %v", err)
	}
	if updated.MerchantDisplayEnabled {
		t.Fatalf("expected merchant display disabled")
	}
}

func TestMaterialShopUpdateMe_RejectsQualificationFields(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db := setupSQLiteDB(t)
	if err := db.AutoMigrate(&model.MaterialShop{}); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}

	previousDB := repository.DB
	repository.DB = db
	t.Cleanup(func() { repository.DB = previousDB })

	enabled := int8(1)
	shop := model.MaterialShop{
		Base:              model.Base{ID: 502},
		Name:              "潜水艇",
		CompanyName:       "潜水艇建材",
		BusinessLicenseNo: "old-license",
		BusinessLicense:   "/old-license.jpg",
		LegalPersonName:   "张飞",
		Status:            &enabled,
	}
	if err := db.Create(&shop).Error; err != nil {
		t.Fatalf("seed shop: %v", err)
	}

	payload := map[string]any{
		"businessLicenseNo": "new-license",
		"businessLicense":   "/new-license.jpg",
		"legalPersonName":   "李四",
	}

	resp := requestMaterialShopSettingsJSON(t, http.MethodPut, "/api/v1/material-shop/me", payload, shop.ID)
	if resp.Code != 400 {
		t.Fatalf("unexpected code: got=%d message=%s", resp.Code, resp.Message)
	}
	if resp.Message != "主体资质信息不可在店铺设置中修改" {
		t.Fatalf("unexpected message: %s", resp.Message)
	}

	var updated model.MaterialShop
	if err := db.First(&updated, shop.ID).Error; err != nil {
		t.Fatalf("query shop: %v", err)
	}
	if updated.BusinessLicenseNo != "old-license" || updated.BusinessLicense != "/old-license.jpg" || updated.LegalPersonName != "张飞" {
		t.Fatalf("qualification fields should remain unchanged: %#v", updated)
	}
}

func requestMaterialShopSettingsJSON(
	t *testing.T,
	method string,
	path string,
	payload any,
	shopID uint64,
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
	c.Set("materialShopId", shopID)

	MaterialShopUpdateMe(c)
	return decodeResponse(t, w)
}
