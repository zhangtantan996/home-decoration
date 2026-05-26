package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
)

func requestAdminCreateMaterialShop(t *testing.T, path string, payload string) responseEnvelope {
	t.Helper()

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, path, strings.NewReader(payload))
	ctx.Request.Header.Set("Content-Type", "application/json")
	AdminCreateMaterialShop(ctx)

	var envelope responseEnvelope
	if err := json.Unmarshal(recorder.Body.Bytes(), &envelope); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	return envelope
}

func requestAdminUpdateMaterialShop(t *testing.T, path string, payload string) responseEnvelope {
	t.Helper()

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPut, path, strings.NewReader(payload))
	ctx.Request.Header.Set("Content-Type", "application/json")
	ctx.Params = gin.Params{{Key: "id", Value: "93001"}}
	AdminUpdateMaterialShop(ctx)

	var envelope responseEnvelope
	if err := json.Unmarshal(recorder.Body.Bytes(), &envelope); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	return envelope
}

func TestAdminCreateMaterialShop_PersistsExtendedFormFields(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db := setupSQLiteDB(t)
	if err := db.AutoMigrate(&model.MaterialShop{}); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}

	previousDB := repository.DB
	repository.DB = db
	t.Cleanup(func() { repository.DB = previousDB })

	resp := requestAdminCreateMaterialShop(t, "/api/v1/admin/material-shops", `{
		"name":"测试主材门店",
		"type":"brand",
		"companyName":"测试主材公司",
		"address":"西安市雁塔区科技路 1 号",
		"cover":"/uploads/material-shops/cover.jpg",
		"brandLogo":"/uploads/material-shops/logo.jpg",
		"mainProducts":"[\"全屋定制\",\"整体橱柜\"]",
		"productCategories":"柜体,木门",
		"latitude":34.231,
		"longitude":108.934,
		"openTime":"09:00-21:00",
		"tags":"[\"免费设计\",\"送货上门\"]",
		"collectedSource":"线下拜访",
		"isSettled":false
	}`)
	if resp.Code != 0 {
		t.Fatalf("expected create material shop success, got code=%d message=%s", resp.Code, resp.Message)
	}

	var stored model.MaterialShop
	if err := db.Where("name = ?", "测试主材门店").First(&stored).Error; err != nil {
		t.Fatalf("load material shop: %v", err)
	}
	if stored.Cover != "/uploads/material-shops/cover.jpg" {
		t.Fatalf("expected cover persisted, got %q", stored.Cover)
	}
	if stored.BrandLogo != "/uploads/material-shops/logo.jpg" {
		t.Fatalf("expected brand logo persisted, got %q", stored.BrandLogo)
	}
	if stored.ProductCategories != "柜体,木门" {
		t.Fatalf("expected product categories persisted, got %q", stored.ProductCategories)
	}
	if stored.OpenTime != "09:00-21:00" {
		t.Fatalf("expected open time persisted, got %q", stored.OpenTime)
	}
	if stored.Tags != `["免费设计","送货上门"]` {
		t.Fatalf("expected tags persisted, got %q", stored.Tags)
	}
	if stored.MainProducts != `["全屋定制","整体橱柜"]` {
		t.Fatalf("expected main products persisted, got %q", stored.MainProducts)
	}
	if stored.Latitude != 34.231 || stored.Longitude != 108.934 {
		t.Fatalf("expected coordinates persisted, got (%v,%v)", stored.Latitude, stored.Longitude)
	}
}

func TestAdminUpdateMaterialShop_OnlyUpdatesEditableFields(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db := setupSQLiteDB(t)
	if err := db.AutoMigrate(&model.MaterialShop{}); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}

	previousDB := repository.DB
	repository.DB = db
	t.Cleanup(func() { repository.DB = previousDB })

	active := int8(1)
	shop := model.MaterialShop{
		Base:                   model.Base{ID: 93001},
		UserID:                 88,
		Type:                   "showroom",
		Name:                   "旧门店",
		CompanyName:            "旧公司",
		Cover:                  "https://example.com/old-cover.jpg",
		BrandLogo:              "https://example.com/old-logo.jpg",
		MainProducts:           `["旧产品"]`,
		ProductCategories:      "旧分类",
		Address:                "旧地址",
		Latitude:               30.1,
		Longitude:              120.2,
		OpenTime:               "08:00-18:00",
		Tags:                   `["旧标签"]`,
		IsSettled:              true,
		PlatformDisplayEnabled: true,
		Status:                 &active,
	}
	if err := db.Create(&shop).Error; err != nil {
		t.Fatalf("seed material shop: %v", err)
	}

	resp := requestAdminUpdateMaterialShop(t, "/api/v1/admin/material-shops/93001", `{
		"name":"新门店",
		"companyName":"新公司",
		"address":"新地址",
		"isSettled":false,
		"platformDisplayEnabled":false,
		"status":0,
		"userId":999999
	}`)
	if resp.Code != 0 {
		t.Fatalf("expected update material shop success, got code=%d message=%s", resp.Code, resp.Message)
	}

	var stored model.MaterialShop
	if err := db.First(&stored, shop.ID).Error; err != nil {
		t.Fatalf("load material shop: %v", err)
	}
	if stored.Name != "新门店" || stored.CompanyName != "新公司" || stored.Address != "新地址" {
		t.Fatalf("expected editable fields updated, got %+v", stored)
	}
	if stored.IsSettled {
		t.Fatalf("expected isSettled updated to false")
	}
	if !stored.PlatformDisplayEnabled {
		t.Fatalf("platform display should not be editable via generic update")
	}
	if stored.Status == nil || *stored.Status != 1 {
		t.Fatalf("status should remain unchanged, got %+v", stored.Status)
	}
	if stored.UserID != 88 {
		t.Fatalf("user id should remain unchanged, got %d", stored.UserID)
	}
	if stored.Cover != "https://example.com/old-cover.jpg" {
		t.Fatalf("omitted cover should remain unchanged, got %q", stored.Cover)
	}
}

func TestAdminUpdateMaterialShop_RejectsOverlongTextAndKeepsExistingValue(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db := setupSQLiteDB(t)
	if err := db.AutoMigrate(&model.MaterialShop{}); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}

	previousDB := repository.DB
	repository.DB = db
	t.Cleanup(func() { repository.DB = previousDB })

	shop := model.MaterialShop{
		Base:        model.Base{ID: 93001},
		Type:        "showroom",
		Name:        "旧门店",
		Description: "旧介绍",
	}
	if err := db.Create(&shop).Error; err != nil {
		t.Fatalf("seed material shop: %v", err)
	}

	resp := requestAdminUpdateMaterialShop(t, "/api/v1/admin/material-shops/93001", `{
		"description":"`+strings.Repeat("超", adminTextLongMax+1)+`"
	}`)
	if resp.Code == 0 {
		t.Fatalf("expected overlong description to be rejected")
	}

	var stored model.MaterialShop
	if err := db.First(&stored, shop.ID).Error; err != nil {
		t.Fatalf("load material shop: %v", err)
	}
	if stored.Description != "旧介绍" {
		t.Fatalf("description should remain unchanged, got %q", stored.Description)
	}
}

func TestAdminCreateMaterialShop_RejectsInvalidJSONArrayFields(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db := setupSQLiteDB(t)
	if err := db.AutoMigrate(&model.MaterialShop{}); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}

	previousDB := repository.DB
	repository.DB = db
	t.Cleanup(func() { repository.DB = previousDB })

	resp := requestAdminCreateMaterialShop(t, "/api/v1/admin/material-shops", `{
		"name":"测试主材门店",
		"type":"brand",
		"address":"西安市雁塔区科技路 1 号",
		"cover":"https://example.com/cover.jpg",
		"mainProducts":"全屋定制,整体橱柜",
		"tags":"免费设计,送货上门",
		"isSettled":false
	}`)
	if resp.Code == 0 {
		t.Fatalf("expected invalid json array fields to be rejected")
	}
}
