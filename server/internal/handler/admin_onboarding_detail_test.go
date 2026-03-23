package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"

	"github.com/gin-gonic/gin"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

type adminAuditDetailEnvelope struct {
	Code int                    `json:"code"`
	Data map[string]interface{} `json:"data"`
}

func setupAdminOnboardingDetailDB(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := "file:" + strings.ReplaceAll(t.Name(), "/", "_") + "?mode=memory&cache=shared"
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite db: %v", err)
	}
	if err := db.AutoMigrate(
		&model.MerchantApplication{},
		&model.MaterialShopApplication{},
		&model.MaterialShopApplicationProduct{},
	); err != nil {
		t.Fatalf("auto migrate onboarding audit models: %v", err)
	}
	oldDB := repository.DB
	repository.DB = db
	t.Cleanup(func() {
		repository.DB = oldDB
	})
	return db
}

func decodeAdminAuditDetailEnvelope(t *testing.T, recorder *httptest.ResponseRecorder) adminAuditDetailEnvelope {
	t.Helper()
	var envelope adminAuditDetailEnvelope
	if err := json.Unmarshal(recorder.Body.Bytes(), &envelope); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	return envelope
}

func performAdminAuditDetailRequest(t *testing.T, method, path string, params gin.Params, handlerFunc gin.HandlerFunc) adminAuditDetailEnvelope {
	t.Helper()
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(method, path, nil)
	ctx.Params = params
	handlerFunc(ctx)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected http 200, got %d, body=%s", recorder.Code, recorder.Body.String())
	}
	return decodeAdminAuditDetailEnvelope(t, recorder)
}

func TestAdminGetApplicationIncludesAuditDocuments(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupAdminOnboardingDetailDB(t)

	app := model.MerchantApplication{
		Phone:                  "13800138000",
		ApplicantType:          "company",
		Role:                   "company",
		EntityType:             "company",
		RealName:               "申请人张三",
		Avatar:                 "/merchant-avatar.jpg",
		IDCardNo:               "110101199001011234",
		IDCardFront:            "/id-front.jpg",
		IDCardBack:             "/id-back.jpg",
		CompanyName:            "测试装饰公司",
		LicenseNo:              "91350100MA12345678",
		LicenseImage:           "/license.jpg",
		LegalPersonName:        "法人李四",
		LegalPersonIDCardNo:    "110101199202021234",
		LegalPersonIDCardFront: "/legal-front.jpg",
		LegalPersonIDCardBack:  "/legal-back.jpg",
		CompanyAlbumJSON:       `["/album-1.jpg","/album-2.jpg"]`,
		Status:                 0,
		Base: model.Base{
			CreatedAt: time.Date(2026, 3, 22, 15, 53, 44, 0, time.Local),
			UpdatedAt: time.Date(2026, 3, 22, 15, 53, 44, 0, time.Local),
		},
	}
	auditedAt := time.Date(2026, 3, 23, 10, 8, 9, 0, time.Local)
	app.AuditedAt = &auditedAt
	if err := db.Create(&app).Error; err != nil {
		t.Fatalf("create merchant application: %v", err)
	}

	envelope := performAdminAuditDetailRequest(
		t,
		http.MethodGet,
		fmt.Sprintf("/api/v1/admin/merchant-applications/%d", app.ID),
		gin.Params{{Key: "id", Value: fmt.Sprintf("%d", app.ID)}},
		AdminGetApplication,
	)

	if envelope.Code != 0 {
		t.Fatalf("unexpected business code: %d", envelope.Code)
	}
	if got := fmt.Sprint(envelope.Data["idCardNo"]); got != app.IDCardNo {
		t.Fatalf("expected readable idCardNo %q, got %q", app.IDCardNo, got)
	}
	if got := fmt.Sprint(envelope.Data["legalPersonName"]); got != app.LegalPersonName {
		t.Fatalf("expected legalPersonName %q, got %q", app.LegalPersonName, got)
	}
	if got := fmt.Sprint(envelope.Data["legalPersonIdCardNo"]); got != app.LegalPersonIDCardNo {
		t.Fatalf("expected readable legalPersonIdCardNo %q, got %q", app.LegalPersonIDCardNo, got)
	}
	if got := fmt.Sprint(envelope.Data["createdAt"]); got != formatServerDateTime(app.CreatedAt) {
		t.Fatalf("expected formatted createdAt %q, got %q", formatServerDateTime(app.CreatedAt), got)
	}
	if got := fmt.Sprint(envelope.Data["auditedAt"]); got != formatServerDateTimePtr(app.AuditedAt) {
		t.Fatalf("expected formatted auditedAt %q, got %q", formatServerDateTimePtr(app.AuditedAt), got)
	}
	if !strings.HasSuffix(fmt.Sprint(envelope.Data["avatar"]), app.Avatar) {
		t.Fatalf("expected avatar url to end with %q, got %v", app.Avatar, envelope.Data["avatar"])
	}
	if !strings.HasSuffix(fmt.Sprint(envelope.Data["legalPersonIdCardFront"]), app.LegalPersonIDCardFront) {
		t.Fatalf("expected legalPersonIdCardFront to end with %q, got %v", app.LegalPersonIDCardFront, envelope.Data["legalPersonIdCardFront"])
	}
	companyAlbum, ok := envelope.Data["companyAlbum"].([]interface{})
	if !ok || len(companyAlbum) != 2 {
		t.Fatalf("expected 2 company album images, got %#v", envelope.Data["companyAlbum"])
	}
}

func TestAdminGetMaterialShopApplicationIncludesReadableIdentityAndProducts(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupAdminOnboardingDetailDB(t)

	app := model.MaterialShopApplication{
		Phone:                  "13900139000",
		EntityType:             "company",
		ShopName:               "瓷砖旗舰店",
		ShopDescription:        "主营瓷砖与岩板",
		CompanyName:            "测试建材有限公司",
		BusinessLicenseNo:      "91500123MA76543210",
		BusinessLicense:        "/business-license.jpg",
		LegalPersonName:        "王五",
		LegalPersonIDCardNo:    "110101199303031234",
		LegalPersonIDCardFront: "/material-legal-front.jpg",
		LegalPersonIDCardBack:  "/material-legal-back.jpg",
		BusinessHours:          "周一至周日 09:00-18:00",
		ContactPhone:           "029-88886666",
		ContactName:            "门店负责人",
		Address:                "西安市高新区测试路 88 号",
		Status:                 0,
		Base: model.Base{
			CreatedAt: time.Date(2026, 3, 22, 17, 1, 2, 0, time.Local),
			UpdatedAt: time.Date(2026, 3, 22, 17, 1, 2, 0, time.Local),
		},
	}
	auditedAt := time.Date(2026, 3, 24, 9, 30, 31, 0, time.Local)
	app.AuditedAt = &auditedAt
	if err := db.Create(&app).Error; err != nil {
		t.Fatalf("create material shop application: %v", err)
	}

	product := model.MaterialShopApplicationProduct{
		ApplicationID: app.ID,
		Name:          "800x800 防滑地砖",
		Unit:          "片",
		ParamsJSON:    `{"description":"防滑耐磨，适合客餐厅"}`,
		Price:         128.5,
		ImagesJSON:    `["/tile-1.jpg"]`,
		SortOrder:     1,
	}
	if err := db.Create(&product).Error; err != nil {
		t.Fatalf("create material product: %v", err)
	}

	envelope := performAdminAuditDetailRequest(
		t,
		http.MethodGet,
		fmt.Sprintf("/api/v1/admin/material-shop-applications/%d", app.ID),
		gin.Params{{Key: "id", Value: fmt.Sprintf("%d", app.ID)}},
		AdminGetMaterialShopApplication,
	)

	if envelope.Code != 0 {
		t.Fatalf("unexpected business code: %d", envelope.Code)
	}
	if got := fmt.Sprint(envelope.Data["legalPersonIdCardNo"]); got != app.LegalPersonIDCardNo {
		t.Fatalf("expected readable legalPersonIdCardNo %q, got %q", app.LegalPersonIDCardNo, got)
	}
	if got := fmt.Sprint(envelope.Data["businessLicenseNo"]); got != app.BusinessLicenseNo {
		t.Fatalf("expected readable businessLicenseNo %q, got %q", app.BusinessLicenseNo, got)
	}
	if got := fmt.Sprint(envelope.Data["createdAt"]); got != formatServerDateTime(app.CreatedAt) {
		t.Fatalf("expected formatted createdAt %q, got %q", formatServerDateTime(app.CreatedAt), got)
	}
	if got := fmt.Sprint(envelope.Data["auditedAt"]); got != formatServerDateTimePtr(app.AuditedAt) {
		t.Fatalf("expected formatted auditedAt %q, got %q", formatServerDateTimePtr(app.AuditedAt), got)
	}

	products, ok := envelope.Data["products"].([]interface{})
	if !ok || len(products) != 1 {
		t.Fatalf("expected 1 product, got %#v", envelope.Data["products"])
	}
	firstProduct, ok := products[0].(map[string]interface{})
	if !ok {
		t.Fatalf("expected product object, got %#v", products[0])
	}
	if got := fmt.Sprint(firstProduct["unit"]); got != product.Unit {
		t.Fatalf("expected product unit %q, got %q", product.Unit, got)
	}
	if got := fmt.Sprint(firstProduct["description"]); got != "防滑耐磨，适合客餐厅" {
		t.Fatalf("expected product description to be returned, got %q", got)
	}
}
