package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"

	"home-decoration-server/internal/config"
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
)

func TestMerchantLogin_UnregisteredReturnsApplyGuide(t *testing.T) {
	gin.SetMode(gin.TestMode)
	t.Setenv("APP_ENV", "local")
	t.Setenv("SMS_DEBUG_BYPASS", "1")

	db := setupSQLiteDB(t)
	if err := db.AutoMigrate(&model.User{}, &model.Provider{}, &model.MaterialShop{}, &model.MerchantApplication{}, &model.MaterialShopApplication{}); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}

	previousDB := repository.DB
	repository.DB = db
	t.Cleanup(func() {
		repository.DB = previousDB
	})

	resp := requestMerchantLogin(t, map[string]string{
		"phone": "13800009999",
		"code":  "123456",
	})

	if resp.Code != 409 {
		t.Fatalf("unexpected code: got=%d want=409", resp.Code)
	}

	var data struct {
		NextAction string `json:"nextAction"`
	}
	if err := json.Unmarshal(resp.Data, &data); err != nil {
		t.Fatalf("decode response data: %v", err)
	}
	if data.NextAction != "APPLY" {
		t.Fatalf("unexpected nextAction: got=%s want=APPLY", data.NextAction)
	}
}

func TestMerchantLogin_PendingApplicationReturnsPendingGuide(t *testing.T) {
	gin.SetMode(gin.TestMode)
	t.Setenv("APP_ENV", "local")
	t.Setenv("SMS_DEBUG_BYPASS", "1")

	db := setupSQLiteDB(t)
	if err := db.AutoMigrate(&model.User{}, &model.Provider{}, &model.MaterialShop{}, &model.MerchantApplication{}, &model.MaterialShopApplication{}); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}

	previousDB := repository.DB
	repository.DB = db
	t.Cleanup(func() {
		repository.DB = previousDB
	})

	user := model.User{
		Base:     model.Base{ID: 8001},
		Phone:    "13800008888",
		Nickname: "待审核用户",
		Status:   1,
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("seed user: %v", err)
	}
	app := model.MerchantApplication{
		UserID:         user.ID,
		Phone:          user.Phone,
		Role:           "designer",
		EntityType:     "personal",
		ApplicantType:  "personal",
		RealName:       "张三",
		IDCardNo:       "encrypted",
		IDCardFront:    "front",
		IDCardBack:     "back",
		ServiceArea:    "[]",
		Styles:         "[]",
		PortfolioCases: "[]",
		Status:         0,
	}
	if err := db.Create(&app).Error; err != nil {
		t.Fatalf("seed application: %v", err)
	}

	resp := requestMerchantLogin(t, map[string]string{
		"phone": user.Phone,
		"code":  "123456",
	})
	if resp.Code != 409 {
		t.Fatalf("unexpected code: got=%d want=409", resp.Code)
	}

	var data struct {
		NextAction string `json:"nextAction"`
	}
	if err := json.Unmarshal(resp.Data, &data); err != nil {
		t.Fatalf("decode response data: %v", err)
	}
	if data.NextAction != "PENDING" {
		t.Fatalf("unexpected nextAction: got=%s want=PENDING", data.NextAction)
	}
}

func TestMerchantLogin_MaterialShopSuccess(t *testing.T) {
	gin.SetMode(gin.TestMode)
	t.Setenv("APP_ENV", "local")
	t.Setenv("SMS_DEBUG_BYPASS", "1")

	db := setupSQLiteDB(t)
	if err := db.AutoMigrate(&model.User{}, &model.Provider{}, &model.MaterialShop{}, &model.MerchantApplication{}, &model.MaterialShopApplication{}); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}

	previousDB := repository.DB
	repository.DB = db
	t.Cleanup(func() {
		repository.DB = previousDB
	})

	user := model.User{
		Base:     model.Base{ID: 9001},
		Phone:    "13800007777",
		Nickname: "主材商户",
		Status:   1,
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("seed user: %v", err)
	}
	shop := model.MaterialShop{
		Base:       model.Base{ID: 9101},
		UserID:     user.ID,
		Name:       "优品主材馆",
		IsVerified: true,
	}
	if err := db.Create(&shop).Error; err != nil {
		t.Fatalf("seed material shop: %v", err)
	}

	resp := requestMerchantLogin(t, map[string]string{
		"phone": user.Phone,
		"code":  "123456",
	})
	if resp.Code != 0 {
		t.Fatalf("unexpected code: got=%d message=%s", resp.Code, resp.Message)
	}

	var data struct {
		MerchantKind string `json:"merchantKind"`
		Role         string `json:"role"`
		Provider     struct {
			MerchantKind string `json:"merchantKind"`
		} `json:"provider"`
	}
	if err := json.Unmarshal(resp.Data, &data); err != nil {
		t.Fatalf("decode response data: %v", err)
	}
	if data.MerchantKind != "material_shop" {
		t.Fatalf("unexpected merchantKind: got=%s want=material_shop", data.MerchantKind)
	}
	if data.Role != "material_shop" {
		t.Fatalf("unexpected role: got=%s want=material_shop", data.Role)
	}
	if data.Provider.MerchantKind != "material_shop" {
		t.Fatalf("unexpected provider merchantKind: got=%s want=material_shop", data.Provider.MerchantKind)
	}
}

func requestMerchantLogin(t *testing.T, payload map[string]string) responseEnvelope {
	t.Helper()

	raw, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("marshal payload: %v", err)
	}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/api/v1/merchant/login", bytes.NewReader(raw))
	c.Request.Header.Set("Content-Type", "application/json")

	cfg := &config.Config{
		JWT: config.JWTConfig{
			Secret: "test_merchant_login_secret",
		},
	}
	MerchantLogin(cfg)(c)
	return decodeResponse(t, w)
}
