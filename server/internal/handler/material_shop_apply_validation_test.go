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

func materialProductImages(count int) []string {
	images := make([]string, 0, count)
	for i := 0; i < count; i++ {
		images = append(images, "https://img.example.com/p"+string(rune('a'+i))+".jpg")
	}
	return images
}

func newValidMaterialShopApplyInput() materialShopApplyInput {
	return materialShopApplyInput{
		Phone:                  "13800138001",
		Code:                   "123456",
		EntityType:             "company",
		ShopName:               "优选主材馆",
		ShopDescription:        "主营瓷砖、地板与卫浴主材",
		CompanyName:            "上海优选主材有限公司",
		BusinessLicenseNo:      "110105000000123",
		BusinessLicense:        "https://img.example.com/license.jpg",
		LegalPersonName:        "王五",
		LegalPersonIDCardNo:    "11010519491231002X",
		LegalPersonIDCardFront: "https://img.example.com/id-front.jpg",
		LegalPersonIDCardBack:  "https://img.example.com/id-back.jpg",
		BusinessHoursRanges: []BusinessHoursRangeInput{{
			Day:   1,
			Start: "09:00",
			End:   "18:00",
		}},
		ContactPhone: "13800138001",
		ContactName:  "王五",
		Address:      "上海市浦东新区XX路88号",
		Products: []materialShopApplyProductInput{
			{Name: "产品1", Unit: "平方米", Price: 100, Images: []string{"https://img.example.com/p1.jpg"}},
			{Name: "产品2", Unit: "平方米", Price: 120, Images: []string{"https://img.example.com/p2.jpg"}},
			{Name: "产品3", Unit: "平方米", Price: 130, Images: []string{"https://img.example.com/p3.jpg"}},
			{Name: "产品4", Unit: "平方米", Price: 140, Images: []string{"https://img.example.com/p4.jpg"}},
			{Name: "产品5", Unit: "平方米", Price: 150, Images: []string{"https://img.example.com/p5.jpg"}},
		},
		LegalAcceptance: LegalAcceptanceInput{
			Accepted:                     true,
			OnboardingAgreementVersion:   "v1.0.0-20260305",
			PlatformRulesVersion:         "v1.0.0-20260305",
			PrivacyDataProcessingVersion: "v1.0.0-20260305",
		},
	}
}

func TestValidateMaterialShopApply_RequireBusinessHoursRanges(t *testing.T) {
	input := newValidMaterialShopApplyInput()
	input.BusinessHoursRanges = nil

	err := validateMaterialShopApply(&input)
	if err == nil || !strings.Contains(err.Error(), "营业时间") {
		t.Fatalf("expected business hours validation error, got=%v", err)
	}

	input = newValidMaterialShopApplyInput()
	input.BusinessHoursRanges = []BusinessHoursRangeInput{{Day: 1, Start: "18:00", End: "09:00"}}
	err = validateMaterialShopApply(&input)
	if err == nil || !strings.Contains(err.Error(), "开始时间必须早于结束时间") {
		t.Fatalf("expected invalid range error, got=%v", err)
	}
}

func TestValidateMaterialShopApply_RequireProductUnitAndImageLimit(t *testing.T) {
	input := newValidMaterialShopApplyInput()
	input.Products[0].Unit = ""

	err := validateMaterialShopApply(&input)
	if err == nil || !strings.Contains(err.Error(), "商品单位不能为空") {
		t.Fatalf("expected unit validation error, got=%v", err)
	}

	input = newValidMaterialShopApplyInput()
	input.Products[0].Images = []string{
		"1", "2", "3", "4", "5", "6", "7",
	}
	err = validateMaterialShopApply(&input)
	if err == nil || !strings.Contains(err.Error(), "1-6张图片") {
		t.Fatalf("expected image limit error, got=%v", err)
	}
}

func TestValidateMaterialShopApply_ProductPriceLimitAndPrecision(t *testing.T) {
	input := newValidMaterialShopApplyInput()
	input.Products[0].Price = 1000000

	err := validateMaterialShopApply(&input)
	if err == nil || !strings.Contains(err.Error(), "价格不能超过") {
		t.Fatalf("expected price max validation error, got=%v", err)
	}

	input = newValidMaterialShopApplyInput()
	input.Products[0].Price = 12.345
	err = validateMaterialShopApply(&input)
	if err == nil || !strings.Contains(err.Error(), "最多保留两位小数") {
		t.Fatalf("expected price precision validation error, got=%v", err)
	}
}

func TestValidateMaterialShopApply_ValidInputSummarizesBusinessHours(t *testing.T) {
	input := newValidMaterialShopApplyInput()
	input.ContactName = ""
	input.BusinessHours = ""
	input.BusinessHoursRanges = []BusinessHoursRangeInput{
		{Day: 7, Start: "10:00", End: "19:00"},
		{Day: 1, Start: "09:00", End: "18:00"},
		{Day: 7, Start: "10:00", End: "19:00"},
	}

	if err := validateMaterialShopApply(&input); err != nil {
		t.Fatalf("expected valid input, got error: %v", err)
	}
	if input.ContactName != input.LegalPersonName {
		t.Fatalf("expected contact name to default to legal person name")
	}
	if input.BusinessHours == "" || !strings.Contains(input.BusinessHours, "周一 09:00-18:00") || !strings.Contains(input.BusinessHours, "周日 10:00-19:00") {
		t.Fatalf("expected summarized business hours, got=%q", input.BusinessHours)
	}
	if strings.Index(input.BusinessHours, "周一 09:00-18:00") > strings.Index(input.BusinessHours, "周日 10:00-19:00") {
		t.Fatalf("expected business hours sorted by day, got=%q", input.BusinessHours)
	}
	parsedRanges := parseBusinessHoursRanges(marshalBusinessHoursRanges(input.BusinessHoursRanges))
	if len(parsedRanges) != 2 || parsedRanges[1].Day != 7 {
		t.Fatalf("expected normalized business hours ranges to keep sunday as day=7, got=%+v", parsedRanges)
	}
}

func TestResolveMaterialProductUnit_FallsBackToLegacyParams(t *testing.T) {
	unit := resolveMaterialProductUnit("", `{"单位":"套","颜色":"白色"}`)
	if unit != "套" {
		t.Fatalf("unexpected unit: %q", unit)
	}

	product := parseMaterialProduct(model.MaterialShopProduct{
		Unit:       "",
		ParamsJSON: `{"unit":"平方米"}`,
		ImagesJSON: `[]`,
	})
	if product["unit"] != "平方米" {
		t.Fatalf("expected legacy unit fallback, got=%v", product["unit"])
	}
}

func TestResolveMaterialProductDescription_FallsBackToParams(t *testing.T) {
	desc := resolveMaterialProductDescription("", `{"description":"防滑耐磨，适用客餐厅"}`)
	if desc != "防滑耐磨，适用客餐厅" {
		t.Fatalf("unexpected description: %q", desc)
	}

	product := parseMaterialProduct(model.MaterialShopProduct{
		Description: "",
		ParamsJSON:  `{"description":"哑光岩板，防污易清洁"}`,
		ImagesJSON:  `[]`,
	})
	if product["description"] != "哑光岩板，防污易清洁" {
		t.Fatalf("expected legacy description fallback, got=%v", product["description"])
	}
}

func TestMaterialShopUpdateProduct_PersistsDescriptionAndStatus(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db := setupSQLiteDB(t)
	if err := db.AutoMigrate(&model.MaterialShopProduct{}); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}

	previousDB := repository.DB
	repository.DB = db
	t.Cleanup(func() { repository.DB = previousDB })

	product := model.MaterialShopProduct{
		Base:        model.Base{ID: 301},
		ShopID:      88,
		Name:        "旧商品",
		Unit:        "件",
		Description: "旧描述",
		Price:       99,
		ImagesJSON:  `["https://img.example.com/old.jpg"]`,
		CoverImage:  "https://img.example.com/old.jpg",
		Status:      1,
	}
	if err := db.Create(&product).Error; err != nil {
		t.Fatalf("create product: %v", err)
	}

	payload := `{"name":"新商品","unit":"套","description":"新描述","price":199,"images":["https://img.example.com/new.jpg"],"status":0}`
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("materialShopId", uint64(88))
	c.Params = []gin.Param{{Key: "id", Value: "301"}}
	c.Request = httptest.NewRequest(http.MethodPut, "/api/v1/material-shop/me/products/301", strings.NewReader(payload))
	c.Request.Header.Set("Content-Type", "application/json")
	MaterialShopUpdateProduct(c)

	resp := decodeResponse(t, w)
	if resp.Code != 0 {
		t.Fatalf("unexpected response: %+v", resp)
	}

	var updated model.MaterialShopProduct
	if err := db.First(&updated, product.ID).Error; err != nil {
		t.Fatalf("query updated product: %v", err)
	}
	if updated.Description != "新描述" {
		t.Fatalf("description mismatch: got=%s", updated.Description)
	}
	if updated.Status != 0 {
		t.Fatalf("status mismatch: got=%d", updated.Status)
	}
}

func TestMaterialShopStatusAndMe_ReturnBusinessHoursRanges(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db := setupSQLiteDB(t)
	if err := db.AutoMigrate(&model.MaterialShop{}, &model.MaterialShopApplication{}, &model.MaterialShopApplicationProduct{}); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}

	previousDB := repository.DB
	repository.DB = db
	t.Cleanup(func() { repository.DB = previousDB })

	app := model.MaterialShopApplication{
		Phone:             "13800138009",
		EntityType:        "company",
		ShopName:          "状态测试主材店",
		BusinessHours:     "周一 09:00-18:00",
		BusinessHoursJSON: `[{"day":1,"start":"09:00","end":"18:00"}]`,
		Status:            2,
	}
	if err := db.Create(&app).Error; err != nil {
		t.Fatalf("create app: %v", err)
	}
	if err := db.Create(&model.MaterialShopApplicationProduct{ApplicationID: app.ID, Name: "瓷砖", Unit: "平方米", Price: 99, ImagesJSON: `[]`}).Error; err != nil {
		t.Fatalf("create app product: %v", err)
	}

	shop := model.MaterialShop{
		Base:              model.Base{ID: 88},
		UserID:            66,
		Name:              "我的主材店",
		CompanyName:       "上海优选主材有限公司",
		OpenTime:          "周一 09:00-18:00",
		BusinessHoursJSON: `[{"day":1,"start":"09:00","end":"18:00"}]`,
		Address:           "上海",
	}
	if err := db.Create(&shop).Error; err != nil {
		t.Fatalf("create shop: %v", err)
	}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Params = []gin.Param{{Key: "phone", Value: app.Phone}}
	c.Request = httptest.NewRequest(http.MethodGet, "/api/v1/material-shops/apply/status/"+app.Phone, nil)
	MaterialShopApplyStatus(c)

	statusResp := decodeResponse(t, w)
	if statusResp.Code != 0 {
		t.Fatalf("unexpected status response: %+v", statusResp)
	}
	var statusData struct {
		BusinessHoursRanges []BusinessHoursRangeInput `json:"businessHoursRanges"`
	}
	if err := json.Unmarshal(statusResp.Data, &statusData); err != nil {
		t.Fatalf("decode status data: %v", err)
	}
	if len(statusData.BusinessHoursRanges) != 1 || statusData.BusinessHoursRanges[0].Day != 1 {
		t.Fatalf("unexpected status business hours ranges: %+v", statusData.BusinessHoursRanges)
	}

	w = httptest.NewRecorder()
	c, _ = gin.CreateTestContext(w)
	c.Set("materialShopId", shop.ID)
	c.Request = httptest.NewRequest(http.MethodGet, "/api/v1/material-shops/me", nil)
	MaterialShopGetMe(c)

	meResp := decodeResponse(t, w)
	if meResp.Code != 0 {
		t.Fatalf("unexpected me response: %+v", meResp)
	}
	var meData struct {
		BusinessHoursRanges []BusinessHoursRangeInput `json:"businessHoursRanges"`
	}
	if err := json.Unmarshal(meResp.Data, &meData); err != nil {
		t.Fatalf("decode me data: %v", err)
	}
	if len(meData.BusinessHoursRanges) != 1 || meData.BusinessHoursRanges[0].Start != "09:00" {
		t.Fatalf("unexpected me business hours ranges: %+v", meData.BusinessHoursRanges)
	}
}
