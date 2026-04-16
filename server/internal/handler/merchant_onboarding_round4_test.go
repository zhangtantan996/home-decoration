package handler

import (
	"bytes"
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
	"gorm.io/gorm"
)

func setupMerchantRound4TestDB(t *testing.T) *gorm.DB {
	t.Helper()
	t.Setenv("SMS_FIXED_CODE_MODE", "true")
	t.Setenv("SMS_FIXED_CODE", "123456")
	db := setupSQLiteDB(t)
	if err := db.AutoMigrate(
		&model.Region{},
		&model.ProviderCase{},
		&model.DictionaryCategory{},
		&model.SystemDictionary{},
	); err != nil {
		t.Fatalf("auto migrate failed: %v", err)
	}
	seedRecords := []interface{}{
		&model.Region{Code: "610000", Name: "陕西省", Level: 1, Enabled: true, SortOrder: 1},
		&model.Region{Code: "610100", Name: "西安市", Level: 2, ParentCode: "610000", Enabled: true, SortOrder: 1},
		&model.Region{Code: "610113", Name: "雁塔区", Level: 3, ParentCode: "610100", Enabled: true, SortOrder: 1},
		&model.Region{Code: "610133", Name: "曲江新区", Level: 3, ParentCode: "610100", Enabled: true, SortOrder: 2},
		&model.Region{Code: "510000", Name: "四川省", Level: 1, Enabled: true, SortOrder: 2},
		&model.Region{Code: "510100", Name: "成都市", Level: 2, ParentCode: "510000", Enabled: true, SortOrder: 1},
		&model.DictionaryCategory{Code: "open_service_provinces", Name: "开放服务省份", Enabled: true},
		&model.DictionaryCategory{Code: "open_service_cities", Name: "开放服务城市", Enabled: true},
		&model.SystemDictionary{CategoryCode: "open_service_provinces", Value: "610000", Label: "陕西省", Enabled: true, SortOrder: 1},
		&model.SystemDictionary{CategoryCode: "open_service_cities", Value: "510100", Label: "成都市", Enabled: true, SortOrder: 1},
	}
	for _, record := range seedRecords {
		if err := db.Create(record).Error; err != nil {
			t.Fatalf("seed merchant round4 test data failed: %v", err)
		}
	}
	repository.DB = db
	return db
}

func newJSONRequest(t *testing.T, method string, payload interface{}) *http.Request {
	t.Helper()
	body, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("marshal payload failed: %v", err)
	}
	req := httptest.NewRequest(method, "/", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	return req
}

func TestResolveMerchantNextAction_WithApprovedIdentity(t *testing.T) {
	if got := resolveMerchantNextAction(2, true); got != merchantNextActionReapply {
		t.Fatalf("unexpected nextAction: got=%s want=%s", got, merchantNextActionReapply)
	}
	if got := resolveMerchantNextAction(1, true); got != merchantNextActionLogin {
		t.Fatalf("unexpected nextAction: got=%s want=%s", got, merchantNextActionLogin)
	}
}

func TestResolveMerchantNextAction_StableAcrossStatuses(t *testing.T) {
	tests := []struct {
		name                string
		status              int8
		hasApprovedIdentity bool
		want                string
	}{
		{name: "pending application always pending", status: 0, hasApprovedIdentity: false, want: merchantNextActionPending},
		{name: "approved without identity still pending", status: 1, hasApprovedIdentity: false, want: merchantNextActionPending},
		{name: "approved with identity login", status: 1, hasApprovedIdentity: true, want: merchantNextActionLogin},
		{name: "rejected without identity resubmit", status: 2, hasApprovedIdentity: false, want: merchantNextActionResubmit},
		{name: "rejected with active identity reapply", status: 2, hasApprovedIdentity: true, want: merchantNextActionReapply},
		{name: "unknown falls back apply", status: 9, hasApprovedIdentity: false, want: merchantNextActionApply},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := resolveMerchantNextAction(tt.status, tt.hasApprovedIdentity); got != tt.want {
				t.Fatalf("unexpected nextAction: got=%s want=%s", got, tt.want)
			}
		})
	}
}

func TestMerchantApplyDetailForResubmit(t *testing.T) {
	setupMerchantRound4TestDB(t)

	portfolio, _ := json.Marshal([]PortfolioCaseInput{{Title: "案例1", Description: "说明", Images: []string{"/a.jpg"}, Style: "现代", Area: "90㎡"}})
	serviceArea, _ := json.Marshal([]string{"310101"})
	styles, _ := json.Marshal([]string{"现代"})
	pricing, _ := json.Marshal(map[string]float64{"flat": 300})
	acceptedAt := time.Now()
	app := model.MerchantApplication{
		Phone:               "13800138000",
		ApplicantType:       "personal",
		Role:                "designer",
		EntityType:          "personal",
		RealName:            "张三",
		Avatar:              "/avatar.jpg",
		IDCardNo:            "310101199001011234",
		IDCardFront:         "/front.jpg",
		IDCardBack:          "/back.jpg",
		ServiceArea:         string(serviceArea),
		Styles:              string(styles),
		PricingJSON:         string(pricing),
		PortfolioCases:      string(portfolio),
		LegalAcceptanceJSON: `{"accepted":true,"onboardingAgreementVersion":"v1","platformRulesVersion":"v1","privacyDataProcessingVersion":"v1"}`,
		LegalAcceptedAt:     &acceptedAt,
		Status:              2,
		RejectReason:        "资料不清晰",
	}
	if err := repository.DB.Create(&app).Error; err != nil {
		t.Fatalf("create app failed: %v", err)
	}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Params = []gin.Param{{Key: "id", Value: "1"}}
	c.Request = newJSONRequest(t, http.MethodPost, map[string]string{"phone": app.Phone, "code": "123456"})
	MerchantApplyDetailForResubmit(c)

	if w.Code != http.StatusOK {
		t.Fatalf("unexpected status: %d", w.Code)
	}
	var resp struct {
		Code int `json:"code"`
		Data struct {
			RejectReason string `json:"rejectReason"`
			Form         struct {
				Phone string `json:"phone"`
				Role  string `json:"role"`
			} `json:"form"`
			ResubmitToken    string `json:"resubmitToken"`
			ResubmitEditable struct {
				Phone bool `json:"phone"`
				Role  bool `json:"role"`
			} `json:"resubmitEditable"`
		} `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode resp failed: %v", err)
	}
	if resp.Data.Form.Phone != "13800138000" || resp.Data.Form.Role != "designer" {
		t.Fatalf("unexpected form payload: %+v", resp.Data.Form)
	}
	if strings.TrimSpace(resp.Data.ResubmitToken) == "" {
		t.Fatalf("expected resubmit token to be returned")
	}
	if resp.Data.ResubmitEditable.Phone || resp.Data.ResubmitEditable.Role {
		t.Fatalf("phone/role should be readonly: %+v", resp.Data.ResubmitEditable)
	}
	if resp.Data.RejectReason != "资料不清晰" {
		t.Fatalf("unexpected reject reason: %s", resp.Data.RejectReason)
	}
}

func TestMerchantApplyDetailForResubmit_StatusValidation(t *testing.T) {
	setupMerchantRound4TestDB(t)

	app := model.MerchantApplication{Phone: "13800138009", Role: "designer", Status: 0}
	if err := repository.DB.Create(&app).Error; err != nil {
		t.Fatalf("create app failed: %v", err)
	}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Params = []gin.Param{{Key: "id", Value: "1"}}
	c.Request = newJSONRequest(t, http.MethodPost, map[string]string{"phone": app.Phone, "code": "123456"})
	MerchantApplyDetailForResubmit(c)

	var resp struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode resp failed: %v", err)
	}
	if resp.Code != 400 {
		t.Fatalf("unexpected code: got=%d want=400 body=%s", resp.Code, w.Body.String())
	}
	if !strings.Contains(resp.Message, "当前申请状态不支持") {
		t.Fatalf("unexpected message: %s", resp.Message)
	}
}

func TestMerchantApplyDetailForResubmit_NotFound(t *testing.T) {
	setupMerchantRound4TestDB(t)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Params = []gin.Param{{Key: "id", Value: "999"}}
	c.Request = newJSONRequest(t, http.MethodPost, map[string]string{"phone": "13800138000", "code": "123456"})
	MerchantApplyDetailForResubmit(c)

	var resp struct {
		Code int `json:"code"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode resp failed: %v", err)
	}
	if resp.Code != 404 {
		t.Fatalf("unexpected code: got=%d want=404 body=%s", resp.Code, w.Body.String())
	}
}

func TestMerchantApplyDetailForResubmit_PhoneMismatch(t *testing.T) {
	setupMerchantRound4TestDB(t)
	app := model.MerchantApplication{Phone: "13800138000", Role: "designer", Status: 2}
	if err := repository.DB.Create(&app).Error; err != nil {
		t.Fatalf("create app failed: %v", err)
	}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Params = []gin.Param{{Key: "id", Value: "1"}}
	c.Request = newJSONRequest(t, http.MethodPost, map[string]string{"phone": "13800138001", "code": "123456"})
	MerchantApplyDetailForResubmit(c)

	var resp struct{ Code int }
	_ = json.Unmarshal(w.Body.Bytes(), &resp)
	if resp.Code != 403 {
		t.Fatalf("unexpected code: got=%d want=403 body=%s", resp.Code, w.Body.String())
	}
}

func TestMerchantResubmit_WithResubmitToken(t *testing.T) {
	setupMerchantRound4TestDB(t)
	input := newValidDesignerApplyInput()
	oldCreatedAt := time.Date(2025, 3, 1, 9, 30, 0, 0, time.Local)
	app := model.MerchantApplication{
		Phone:         input.Phone,
		ApplicantType: input.ApplicantType,
		Role:          input.Role,
		EntityType:    input.EntityType,
		Status:        2,
		Base: model.Base{
			CreatedAt: oldCreatedAt,
			UpdatedAt: oldCreatedAt,
		},
	}
	if err := repository.DB.Create(&app).Error; err != nil {
		t.Fatalf("create app failed: %v", err)
	}
	token, err := issueResubmitToken(merchantIdentityTypeProvider, app.ID, input.Phone)
	if err != nil {
		t.Fatalf("issue token failed: %v", err)
	}
	input.Code = ""
	input.ResubmitToken = token

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Params = []gin.Param{{Key: "id", Value: "1"}}
	c.Request = newJSONRequest(t, http.MethodPost, input)
	MerchantResubmit(c)

	if w.Code != http.StatusOK {
		t.Fatalf("unexpected status: %d body=%s", w.Code, w.Body.String())
	}
	var updated model.MerchantApplication
	if err := repository.DB.First(&updated, app.ID).Error; err != nil {
		t.Fatalf("reload app failed: %v", err)
	}
	if updated.Status != 0 {
		t.Fatalf("expected resubmitted app to reset to pending, got=%d", updated.Status)
	}
	if !updated.CreatedAt.After(oldCreatedAt) {
		t.Fatalf("expected resubmitted app createdAt to refresh, old=%s new=%s", oldCreatedAt, updated.CreatedAt)
	}
}

func TestMerchantResubmit_RequireAuthorization(t *testing.T) {
	setupMerchantRound4TestDB(t)
	input := newValidDesignerApplyInput()
	app := model.MerchantApplication{Phone: input.Phone, ApplicantType: input.ApplicantType, Role: input.Role, EntityType: input.EntityType, Status: 2}
	if err := repository.DB.Create(&app).Error; err != nil {
		t.Fatalf("create app failed: %v", err)
	}
	input.Code = ""
	input.ResubmitToken = ""

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Params = []gin.Param{{Key: "id", Value: "1"}}
	c.Request = newJSONRequest(t, http.MethodPost, input)
	MerchantResubmit(c)

	var resp struct {
		Code int    `json:"code"`
		Msg  string `json:"message"`
	}
	_ = json.Unmarshal(w.Body.Bytes(), &resp)
	if resp.Code != 400 || !strings.Contains(resp.Msg, "授权") {
		t.Fatalf("unexpected response: %+v body=%s", resp, w.Body.String())
	}
}

func TestMaterialShopApplyDetailForResubmit_WithSMS(t *testing.T) {
	setupMerchantRound4TestDB(t)
	app := model.MaterialShopApplication{Phone: "13800138000", EntityType: "company", ShopName: "店铺", Status: 2, ContactPhone: "13800138000"}
	if err := repository.DB.Create(&app).Error; err != nil {
		t.Fatalf("create app failed: %v", err)
	}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Params = []gin.Param{{Key: "id", Value: "1"}}
	c.Request = newJSONRequest(t, http.MethodPost, map[string]string{"phone": app.Phone, "code": "123456"})
	MaterialShopApplyDetailForResubmit(c)

	if w.Code != http.StatusOK {
		t.Fatalf("unexpected status: %d body=%s", w.Code, w.Body.String())
	}
	var resp struct {
		Code int `json:"code"`
		Data struct {
			ResubmitToken string `json:"resubmitToken"`
			Form          struct {
				Phone string `json:"phone"`
			} `json:"form"`
		} `json:"data"`
	}
	_ = json.Unmarshal(w.Body.Bytes(), &resp)
	if resp.Data.Form.Phone != app.Phone || strings.TrimSpace(resp.Data.ResubmitToken) == "" {
		t.Fatalf("unexpected response body=%s", w.Body.String())
	}
}

func TestMaterialShopResubmit_WithResubmitToken(t *testing.T) {
	setupMerchantRound4TestDB(t)
	input := newValidMaterialShopApplyInput()
	oldCreatedAt := time.Date(2025, 4, 2, 11, 0, 0, 0, time.Local)
	app := model.MaterialShopApplication{
		Phone:        input.Phone,
		EntityType:   input.EntityType,
		ShopName:     input.ShopName,
		CompanyName:  input.CompanyName,
		ContactPhone: input.ContactPhone,
		ContactName:  input.ContactName,
		Status:       2,
		RejectReason: "资料待补充",
		Base: model.Base{
			CreatedAt: oldCreatedAt,
			UpdatedAt: oldCreatedAt,
		},
	}
	if err := repository.DB.Create(&app).Error; err != nil {
		t.Fatalf("create app failed: %v", err)
	}
	token, err := issueResubmitToken(merchantIdentityTypeMaterial, app.ID, input.Phone)
	if err != nil {
		t.Fatalf("issue token failed: %v", err)
	}
	input.Code = ""
	input.ResubmitToken = token

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Params = []gin.Param{{Key: "id", Value: "1"}}
	c.Request = newJSONRequest(t, http.MethodPost, input)
	MaterialShopApplyResubmit(c)

	if w.Code != http.StatusOK {
		t.Fatalf("unexpected status: %d body=%s", w.Code, w.Body.String())
	}
	var updated model.MaterialShopApplication
	if err := repository.DB.First(&updated, app.ID).Error; err != nil {
		t.Fatalf("reload app failed: %v", err)
	}
	if updated.Status != 0 {
		t.Fatalf("expected resubmitted material app to reset to pending, got=%d", updated.Status)
	}
	if !updated.CreatedAt.After(oldCreatedAt) {
		t.Fatalf("expected resubmitted material app createdAt to refresh, old=%s new=%s", oldCreatedAt, updated.CreatedAt)
	}
}

func TestAdminApproveMaterialShopApplication_FreezePreviousProvider(t *testing.T) {
	setupMerchantRound4TestDB(t)

	user := model.User{Phone: "13800138001", Nickname: "商家用户", Status: 1}
	if err := repository.DB.Create(&user).Error; err != nil {
		t.Fatalf("create user failed: %v", err)
	}
	provider := model.Provider{UserID: user.ID, ProviderType: 1, Status: 1, Verified: true, SubType: "personal"}
	provider.CreatedAt = time.Now().Add(-time.Hour)
	if err := repository.DB.Create(&provider).Error; err != nil {
		t.Fatalf("create provider failed: %v", err)
	}
	if err := repository.DB.Model(&provider).Update("is_settled", false).Error; err != nil {
		t.Fatalf("set provider unsettled failed: %v", err)
	}
	if err := repository.DB.Model(&provider).Update("is_settled", false).Error; err != nil {
		t.Fatalf("set provider unsettled failed: %v", err)
	}
	refID := provider.ID
	identity := model.UserIdentity{UserID: user.ID, IdentityType: merchantIdentityTypeProvider, IdentityRefID: &refID, Status: 1, Verified: true}
	if err := repository.DB.Create(&identity).Error; err != nil {
		t.Fatalf("create identity failed: %v", err)
	}
	app := model.MaterialShopApplication{
		UserID:                 user.ID,
		Phone:                  user.Phone,
		EntityType:             "company",
		ShopName:               "新主材店",
		CompanyName:            "新主材公司",
		BusinessLicenseNo:      "91310101MA1AAAAA1A",
		BusinessLicense:        "/license.jpg",
		LegalPersonName:        "李四",
		LegalPersonIDCardNo:    "310101199001011234",
		LegalPersonIDCardFront: "/front.jpg",
		LegalPersonIDCardBack:  "/back.jpg",
		BusinessHours:          "9:00-18:00",
		ContactPhone:           user.Phone,
		ContactName:            "李四",
		Address:                "上海",
		Status:                 0,
	}
	if err := repository.DB.Create(&app).Error; err != nil {
		t.Fatalf("create material app failed: %v", err)
	}
	for i := 0; i < 5; i++ {
		paramsJSON := `{"description":"测试商品描述"}`
		product := model.MaterialShopApplicationProduct{ApplicationID: app.ID, Name: "商品", Unit: "件", ParamsJSON: paramsJSON, Price: 100, ImagesJSON: `["/p.jpg"]`, SortOrder: i}
		if err := repository.DB.Create(&product).Error; err != nil {
			t.Fatalf("create app product failed: %v", err)
		}
	}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Params = []gin.Param{{Key: "id", Value: "1"}}
	c.Set("adminId", uint64(99))
	AdminApproveMaterialShopApplication(c)
	if w.Code != http.StatusOK {
		t.Fatalf("unexpected status: %d, body=%s", w.Code, w.Body.String())
	}

	var updatedProvider model.Provider
	if err := repository.DB.First(&updatedProvider, provider.ID).Error; err != nil {
		t.Fatalf("reload provider failed: %v", err)
	}
	if updatedProvider.Status != 0 || updatedProvider.Verified {
		t.Fatalf("provider should be frozen, got status=%d verified=%v", updatedProvider.Status, updatedProvider.Verified)
	}

	var updatedProviderIdentity model.UserIdentity
	if err := repository.DB.Where("user_id = ? AND identity_type = ?", user.ID, merchantIdentityTypeProvider).First(&updatedProviderIdentity).Error; err != nil {
		t.Fatalf("reload provider identity failed: %v", err)
	}
	if updatedProviderIdentity.Status != merchantIdentityStatusFrozen {
		t.Fatalf("provider identity should be frozen, got=%d", updatedProviderIdentity.Status)
	}

	var materialIdentity model.UserIdentity
	if err := repository.DB.Where("user_id = ? AND identity_type = ?", user.ID, merchantIdentityTypeMaterial).First(&materialIdentity).Error; err != nil {
		t.Fatalf("material identity missing: %v", err)
	}
	if materialIdentity.Status != merchantIdentityStatusActive || !materialIdentity.Verified {
		t.Fatalf("material identity not activated: %+v", materialIdentity)
	}

	var createdShop model.MaterialShop
	if err := repository.DB.Where("user_id = ?", user.ID).First(&createdShop).Error; err != nil {
		t.Fatalf("created shop missing: %v", err)
	}
	if createdShop.SourceApplicationID != app.ID {
		t.Fatalf("expected material shop source application id=%d got=%d", app.ID, createdShop.SourceApplicationID)
	}

	var createdProducts []model.MaterialShopProduct
	if err := repository.DB.Where("shop_id = ?", createdShop.ID).Order("sort_order ASC").Find(&createdProducts).Error; err != nil {
		t.Fatalf("query created products failed: %v", err)
	}
	if len(createdProducts) != 5 {
		t.Fatalf("unexpected created products count: %d", len(createdProducts))
	}
	if createdProducts[0].Description != "测试商品描述" {
		t.Fatalf("expected description to be mapped from application params, got=%q", createdProducts[0].Description)
	}
}

func TestAdminCompleteMaterialShopAccount_CreatesAndBindsUser(t *testing.T) {
	setupMerchantRound4TestDB(t)
	gin.SetMode(gin.TestMode)

	shop := model.MaterialShop{
		Name:        "测试主材店",
		ContactName: "王五",
		IsVerified:  true,
	}
	if err := repository.DB.Create(&shop).Error; err != nil {
		t.Fatalf("create shop failed: %v", err)
	}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Params = []gin.Param{{Key: "id", Value: fmt.Sprintf("%d", shop.ID)}}
	c.Set("adminId", uint64(99))
	c.Request = newJSONRequest(t, http.MethodPost, gin.H{
		"phone":       "13800138009",
		"contactName": "王五",
		"nickname":    "王五主材",
	})
	AdminCompleteMaterialShopAccount(c)

	if w.Code != http.StatusOK {
		t.Fatalf("unexpected status: %d body=%s", w.Code, w.Body.String())
	}

	var updatedShop model.MaterialShop
	if err := repository.DB.First(&updatedShop, shop.ID).Error; err != nil {
		t.Fatalf("reload shop failed: %v", err)
	}
	if updatedShop.UserID == 0 {
		t.Fatalf("expected shop to bind user")
	}
	if updatedShop.ContactPhone != "13800138009" {
		t.Fatalf("expected contact phone synced, got %s", updatedShop.ContactPhone)
	}

	var user model.User
	if err := repository.DB.First(&user, updatedShop.UserID).Error; err != nil {
		t.Fatalf("load user failed: %v", err)
	}
	if user.Phone != "13800138009" {
		t.Fatalf("unexpected user phone: %s", user.Phone)
	}

	var identity model.UserIdentity
	if err := repository.DB.Where("user_id = ? AND identity_type = ?", user.ID, merchantIdentityTypeMaterial).First(&identity).Error; err != nil {
		t.Fatalf("load identity failed: %v", err)
	}
	if identity.Status != merchantIdentityStatusActive || !identity.Verified {
		t.Fatalf("unexpected identity: %+v", identity)
	}
}

func TestAdminCompleteMaterialShopAccount_RejectsActiveProviderUser(t *testing.T) {
	setupMerchantRound4TestDB(t)
	gin.SetMode(gin.TestMode)

	user := model.User{Phone: "13800138008", Nickname: "设计师张三", Status: 1}
	if err := repository.DB.Create(&user).Error; err != nil {
		t.Fatalf("create user failed: %v", err)
	}
	provider := model.Provider{UserID: user.ID, ProviderType: 1, CompanyName: "设计师A", Status: merchantProviderStatusActive, Verified: true}
	if err := repository.DB.Create(&provider).Error; err != nil {
		t.Fatalf("create provider failed: %v", err)
	}
	if err := repository.DB.Model(&provider).Update("is_settled", false).Error; err != nil {
		t.Fatalf("set provider unsettled failed: %v", err)
	}
	if err := repository.DB.Model(&provider).Update("is_settled", false).Error; err != nil {
		t.Fatalf("set provider unsettled failed: %v", err)
	}
	shop := model.MaterialShop{Name: "待补全店", IsVerified: true}
	if err := repository.DB.Create(&shop).Error; err != nil {
		t.Fatalf("create shop failed: %v", err)
	}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Params = []gin.Param{{Key: "id", Value: fmt.Sprintf("%d", shop.ID)}}
	c.Set("adminId", uint64(99))
	c.Request = newJSONRequest(t, http.MethodPost, gin.H{
		"phone": "13800138008",
	})
	AdminCompleteMaterialShopAccount(c)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("unexpected http status: %d body=%s", w.Code, w.Body.String())
	}
	var resp responseEnvelope
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode response failed: %v", err)
	}
	if !strings.Contains(resp.Message, "其他生效中的服务商身份") {
		t.Fatalf("unexpected error message: %s", resp.Message)
	}
}

func TestAdminCompleteProviderSettlement_ActivatesBoundUser(t *testing.T) {
	setupMerchantRound4TestDB(t)
	gin.SetMode(gin.TestMode)

	app := model.MerchantApplication{Phone: "13800138019", CompanyName: "测试装修公司"}
	if err := repository.DB.Create(&app).Error; err != nil {
		t.Fatalf("create application failed: %v", err)
	}

	user := model.User{Phone: "13800138019", Nickname: "测试装修公司", Status: 1}
	if err := repository.DB.Create(&user).Error; err != nil {
		t.Fatalf("create user failed: %v", err)
	}

	provider := model.Provider{
		UserID:              user.ID,
		ProviderType:        2,
		CompanyName:         "测试装修公司",
		Status:              merchantProviderStatusActive,
		Verified:            true,
		SourceApplicationID: app.ID,
	}
	if err := repository.DB.Create(&provider).Error; err != nil {
		t.Fatalf("create provider failed: %v", err)
	}
	if err := repository.DB.Model(&provider).Update("is_settled", false).Error; err != nil {
		t.Fatalf("set provider unsettled failed: %v", err)
	}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Params = []gin.Param{{Key: "id", Value: fmt.Sprintf("%d", provider.ID)}}
	c.Set("adminId", uint64(99))
	c.Request = httptest.NewRequest(http.MethodPost, "/", nil)

	AdminCompleteProviderSettlement(c)

	if w.Code != http.StatusOK {
		t.Fatalf("unexpected status: %d body=%s", w.Code, w.Body.String())
	}

	var updatedProvider model.Provider
	if err := repository.DB.First(&updatedProvider, provider.ID).Error; err != nil {
		t.Fatalf("reload provider failed: %v", err)
	}
	if !updatedProvider.IsSettled {
		t.Fatalf("expected provider to be settled")
	}

	var updatedApp model.MerchantApplication
	if err := repository.DB.First(&updatedApp, app.ID).Error; err != nil {
		t.Fatalf("reload application failed: %v", err)
	}
	if updatedApp.UserID != user.ID {
		t.Fatalf("expected application user id=%d got=%d", user.ID, updatedApp.UserID)
	}

	var identity model.UserIdentity
	if err := repository.DB.Where("user_id = ? AND identity_type = ?", user.ID, merchantIdentityTypeProvider).First(&identity).Error; err != nil {
		t.Fatalf("load provider identity failed: %v", err)
	}
	if identity.Status != merchantIdentityStatusActive || !identity.Verified {
		t.Fatalf("provider identity should be active, got=%+v", identity)
	}
}

func TestAdminClaimProviderAccount_BindsExistingUser(t *testing.T) {
	setupMerchantRound4TestDB(t)
	gin.SetMode(gin.TestMode)

	app := model.MerchantApplication{Phone: "13800138029", CompanyName: "复用账号装修公司"}
	if err := repository.DB.Create(&app).Error; err != nil {
		t.Fatalf("create application failed: %v", err)
	}

	user := model.User{Phone: "13800138029", Nickname: "已有手机号用户", Status: 1}
	if err := repository.DB.Create(&user).Error; err != nil {
		t.Fatalf("create user failed: %v", err)
	}

	provider := model.Provider{
		ProviderType:        2,
		CompanyName:         "复用账号装修公司",
		Status:              merchantProviderStatusActive,
		Verified:            true,
		IsSettled:           false,
		SourceApplicationID: app.ID,
	}
	if err := repository.DB.Create(&provider).Error; err != nil {
		t.Fatalf("create provider failed: %v", err)
	}
	if err := repository.DB.Model(&provider).Update("is_settled", false).Error; err != nil {
		t.Fatalf("set provider unsettled failed: %v", err)
	}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Params = []gin.Param{{Key: "id", Value: fmt.Sprintf("%d", provider.ID)}}
	c.Set("adminId", uint64(99))
	c.Request = newJSONRequest(t, http.MethodPost, gin.H{
		"phone":       user.Phone,
		"contactName": "联系人甲",
		"nickname":    "复用账号装修公司",
	})

	AdminClaimProviderAccount(c)

	if w.Code != http.StatusOK {
		t.Fatalf("unexpected status: %d body=%s", w.Code, w.Body.String())
	}

	var resp struct {
		Code int `json:"code"`
		Data struct {
			UserID      uint64 `json:"userId"`
			CreatedUser bool   `json:"createdUser"`
		} `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode response failed: %v", err)
	}
	if resp.Code != 0 {
		t.Fatalf("unexpected response code: %d body=%s", resp.Code, w.Body.String())
	}
	if resp.Data.UserID != user.ID {
		t.Fatalf("expected bound user id=%d got=%d", user.ID, resp.Data.UserID)
	}
	if resp.Data.CreatedUser {
		t.Fatalf("expected existing user to be reused")
	}

	var updatedProvider model.Provider
	if err := repository.DB.First(&updatedProvider, provider.ID).Error; err != nil {
		t.Fatalf("reload provider failed: %v", err)
	}
	if updatedProvider.UserID != user.ID || !updatedProvider.IsSettled {
		t.Fatalf("unexpected provider after claim: %+v", updatedProvider)
	}

	var updatedApp model.MerchantApplication
	if err := repository.DB.First(&updatedApp, app.ID).Error; err != nil {
		t.Fatalf("reload application failed: %v", err)
	}
	if updatedApp.UserID != user.ID {
		t.Fatalf("expected application user id=%d got=%d", user.ID, updatedApp.UserID)
	}
}

func TestAdminClaimProviderAccount_RejectsUserBoundToOtherProvider(t *testing.T) {
	setupMerchantRound4TestDB(t)
	gin.SetMode(gin.TestMode)

	user := model.User{Phone: "13800138030", Nickname: "冲突手机号用户", Status: 1}
	if err := repository.DB.Create(&user).Error; err != nil {
		t.Fatalf("create user failed: %v", err)
	}

	otherProvider := model.Provider{
		UserID:       user.ID,
		ProviderType: 2,
		CompanyName:  "已绑定装修公司",
		Status:       merchantProviderStatusActive,
		Verified:     true,
		IsSettled:    true,
	}
	if err := repository.DB.Create(&otherProvider).Error; err != nil {
		t.Fatalf("create other provider failed: %v", err)
	}

	provider := model.Provider{
		ProviderType: 2,
		CompanyName:  "待认领装修公司",
		Status:       merchantProviderStatusActive,
		Verified:     true,
		IsSettled:    false,
	}
	if err := repository.DB.Create(&provider).Error; err != nil {
		t.Fatalf("create provider failed: %v", err)
	}
	if err := repository.DB.Model(&provider).Update("is_settled", false).Error; err != nil {
		t.Fatalf("set provider unsettled failed: %v", err)
	}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Params = []gin.Param{{Key: "id", Value: fmt.Sprintf("%d", provider.ID)}}
	c.Set("adminId", uint64(99))
	c.Request = newJSONRequest(t, http.MethodPost, gin.H{
		"phone": user.Phone,
	})

	AdminClaimProviderAccount(c)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("unexpected http status: %d body=%s", w.Code, w.Body.String())
	}

	var resp responseEnvelope
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode response failed: %v", err)
	}
	if !strings.Contains(resp.Message, "已绑定其他服务商账号") {
		t.Fatalf("unexpected error message: %s", resp.Message)
	}

	var updatedProvider model.Provider
	if err := repository.DB.First(&updatedProvider, provider.ID).Error; err != nil {
		t.Fatalf("reload provider failed: %v", err)
	}
	if updatedProvider.UserID != 0 || updatedProvider.IsSettled {
		t.Fatalf("provider should remain unbound, got %+v", updatedProvider)
	}
}

func TestAdminCompleteProviderSettlement_RejectsUnboundProvider(t *testing.T) {
	setupMerchantRound4TestDB(t)
	gin.SetMode(gin.TestMode)

	provider := model.Provider{
		ProviderType: 2,
		CompanyName:  "未绑定账号公司",
		Status:       merchantProviderStatusActive,
		Verified:     true,
	}
	if err := repository.DB.Create(&provider).Error; err != nil {
		t.Fatalf("create provider failed: %v", err)
	}
	if err := repository.DB.Model(&provider).Update("is_settled", false).Error; err != nil {
		t.Fatalf("set provider unsettled failed: %v", err)
	}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Params = []gin.Param{{Key: "id", Value: fmt.Sprintf("%d", provider.ID)}}
	c.Set("adminId", uint64(99))
	c.Request = httptest.NewRequest(http.MethodPost, "/", nil)

	AdminCompleteProviderSettlement(c)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("unexpected status: %d body=%s", w.Code, w.Body.String())
	}
}

func TestAdminApproveProviderApplication_FreezePreviousMaterialShop(t *testing.T) {
	setupMerchantRound4TestDB(t)

	user := model.User{Phone: "13800138002", Nickname: "原主材商", Status: 1}
	if err := repository.DB.Create(&user).Error; err != nil {
		t.Fatalf("create user failed: %v", err)
	}

	shop := model.MaterialShop{
		UserID:      user.ID,
		Name:        "老主材店",
		CompanyName: "老主材公司",
		IsVerified:  true,
	}
	shop.CreatedAt = time.Now().Add(-2 * time.Hour)
	if err := repository.DB.Create(&shop).Error; err != nil {
		t.Fatalf("create material shop failed: %v", err)
	}
	shopRefID := shop.ID
	if err := repository.DB.Create(&model.UserIdentity{UserID: user.ID, IdentityType: merchantIdentityTypeMaterial, IdentityRefID: &shopRefID, Status: merchantIdentityStatusActive, Verified: true}).Error; err != nil {
		t.Fatalf("create material identity failed: %v", err)
	}

	portfolio, _ := json.Marshal([]PortfolioCaseInput{{Category: "water", Description: "说明", Images: []string{"/case-a.jpg", "/case-b.jpg"}}})
	serviceArea, _ := json.Marshal([]string{"310101"})
	styles, _ := json.Marshal([]string{"现代", "奶油"})
	highlightTags, _ := json.Marshal([]string{"快响应", "不增项"})
	pricing, _ := json.Marshal(map[string]float64{"halfDay": 600, "fullDay": 1200})
	app := model.MerchantApplication{
		UserID:              user.ID,
		Phone:               user.Phone,
		ApplicantType:       "foreman",
		Role:                "foreman",
		EntityType:          "company",
		RealName:            "王五",
		Avatar:              "/new-avatar.jpg",
		CompanyName:         "新工长团队",
		LicenseNo:           "91310101MA1BBBBB2B",
		LicenseImage:        "/license.jpg",
		ServiceArea:         string(serviceArea),
		Styles:              string(styles),
		HighlightTags:       string(highlightTags),
		PricingJSON:         string(pricing),
		Introduction:        "靠谱施工",
		PortfolioCases:      string(portfolio),
		LegalAcceptanceJSON: `{"accepted":true}`,
		Status:              0,
	}
	if err := repository.DB.Create(&app).Error; err != nil {
		t.Fatalf("create provider app failed: %v", err)
	}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Params = []gin.Param{{Key: "id", Value: "1"}}
	c.Set("adminId", uint64(66))
	AdminApproveApplication(c)
	if w.Code != http.StatusOK {
		t.Fatalf("unexpected status: %d, body=%s", w.Code, w.Body.String())
	}

	var updatedShop model.MaterialShop
	if err := repository.DB.First(&updatedShop, shop.ID).Error; err != nil {
		t.Fatalf("reload shop failed: %v", err)
	}
	if updatedShop.IsVerified {
		t.Fatalf("material shop should be frozen: %+v", updatedShop)
	}

	var frozenMaterialIdentity model.UserIdentity
	if err := repository.DB.Where("user_id = ? AND identity_type = ?", user.ID, merchantIdentityTypeMaterial).First(&frozenMaterialIdentity).Error; err != nil {
		t.Fatalf("reload material identity failed: %v", err)
	}
	if frozenMaterialIdentity.Status != merchantIdentityStatusFrozen || frozenMaterialIdentity.Verified {
		t.Fatalf("material identity should be frozen: %+v", frozenMaterialIdentity)
	}

	var newProvider model.Provider
	if err := repository.DB.Where("user_id = ?", user.ID).First(&newProvider).Error; err != nil {
		t.Fatalf("new provider missing: %v", err)
	}
	if newProvider.Status != merchantProviderStatusActive || !newProvider.Verified {
		t.Fatalf("provider not activated: %+v", newProvider)
	}
	if newProvider.ProviderType != 3 {
		t.Fatalf("unexpected provider type: %d", newProvider.ProviderType)
	}
	if newProvider.SourceApplicationID != app.ID {
		t.Fatalf("expected provider source application id=%d got=%d", app.ID, newProvider.SourceApplicationID)
	}
	if newProvider.Specialty != "全工种施工" {
		t.Fatalf("unexpected foreman specialty: %s", newProvider.Specialty)
	}
	if newProvider.PriceUnit != model.ProviderPriceUnitPerSquareMeter {
		t.Fatalf("unexpected provider price unit: %s", newProvider.PriceUnit)
	}

	var providerIdentity model.UserIdentity
	if err := repository.DB.Where("user_id = ? AND identity_type = ?", user.ID, merchantIdentityTypeProvider).First(&providerIdentity).Error; err != nil {
		t.Fatalf("provider identity missing: %v", err)
	}
	if providerIdentity.Status != merchantIdentityStatusActive || !providerIdentity.Verified {
		t.Fatalf("provider identity not activated: %+v", providerIdentity)
	}
	if providerIdentity.IdentityRefID == nil || *providerIdentity.IdentityRefID != newProvider.ID {
		t.Fatalf("provider identity ref mismatch: %+v provider=%d", providerIdentity, newProvider.ID)
	}

	var serviceSetting model.MerchantServiceSetting
	if err := repository.DB.Where("provider_id = ?", newProvider.ID).First(&serviceSetting).Error; err != nil {
		t.Fatalf("service setting missing: %v", err)
	}

	var cases []model.ProviderCase
	if err := repository.DB.Where("provider_id = ?", newProvider.ID).Order("sort_order ASC, id ASC").Find(&cases).Error; err != nil {
		t.Fatalf("query provider cases failed: %v", err)
	}
	if len(cases) != 1 {
		t.Fatalf("unexpected case count: %d", len(cases))
	}
	if cases[0].Title != "水工施工展示" {
		t.Fatalf("unexpected foreman case title: %s", cases[0].Title)
	}
	if cases[0].Style != "" || cases[0].Area != "" {
		t.Fatalf("foreman case style/area should be empty: %+v", cases[0])
	}
}

func TestMerchantVerifyOnboardingPhone_ApplyMode(t *testing.T) {
	setupMerchantRound4TestDB(t)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = newJSONRequest(t, http.MethodPost, onboardingVerifyPhoneInput{
		Phone:        "13800138000",
		Code:         "123456",
		MerchantKind: merchantIdentityTypeProvider,
		Mode:         merchantVerificationModeApply,
	})
	MerchantVerifyOnboardingPhone(c)

	var resp struct {
		Code int `json:"code"`
		Data struct {
			VerificationToken string `json:"verificationToken"`
			VerifiedPhone     string `json:"verifiedPhone"`
			OK                bool   `json:"ok"`
		} `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode resp failed: %v", err)
	}
	if resp.Code != 0 || !resp.Data.OK || strings.TrimSpace(resp.Data.VerificationToken) == "" || resp.Data.VerifiedPhone != "13800138000" {
		t.Fatalf("unexpected response: %+v body=%s", resp, w.Body.String())
	}
}

func TestMerchantVerifyOnboardingPhone_ApplyModeRejectsPendingProviderApplication(t *testing.T) {
	setupMerchantRound4TestDB(t)

	app := model.MerchantApplication{
		Phone:  "13800138000",
		Status: 0,
	}
	if err := repository.DB.Create(&app).Error; err != nil {
		t.Fatalf("create app failed: %v", err)
	}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = newJSONRequest(t, http.MethodPost, onboardingVerifyPhoneInput{
		Phone:        "13800138000",
		Code:         "123456",
		MerchantKind: merchantIdentityTypeProvider,
		Mode:         merchantVerificationModeApply,
	})
	MerchantVerifyOnboardingPhone(c)

	var resp struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode resp failed: %v", err)
	}
	if resp.Code != 400 || !strings.Contains(resp.Message, "已提交申请") {
		t.Fatalf("unexpected response: %+v body=%s", resp, w.Body.String())
	}
}

func TestMerchantVerifyOnboardingPhone_ApplyModeRequiresExplicitReapplyConfirmation(t *testing.T) {
	setupMerchantRound4TestDB(t)

	user := model.User{Phone: "13800138066", Nickname: "老主材商", Status: 1}
	if err := repository.DB.Create(&user).Error; err != nil {
		t.Fatalf("create user failed: %v", err)
	}
	shop := model.MaterialShop{
		UserID:      user.ID,
		Name:        "老店铺",
		CompanyName: "老店铺公司",
		IsVerified:  true,
	}
	if err := repository.DB.Create(&shop).Error; err != nil {
		t.Fatalf("create shop failed: %v", err)
	}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = newJSONRequest(t, http.MethodPost, onboardingVerifyPhoneInput{
		Phone:        user.Phone,
		Code:         "123456",
		MerchantKind: merchantIdentityTypeProvider,
		Mode:         merchantVerificationModeApply,
	})
	MerchantVerifyOnboardingPhone(c)

	var conflictResp struct {
		Code int `json:"code"`
		Data struct {
			NextAction string `json:"nextAction"`
		} `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &conflictResp); err != nil {
		t.Fatalf("decode conflict resp failed: %v", err)
	}
	if conflictResp.Code != 409 || conflictResp.Data.NextAction != merchantNextActionReapply {
		t.Fatalf("unexpected conflict response: %+v body=%s", conflictResp, w.Body.String())
	}

	w = httptest.NewRecorder()
	c, _ = gin.CreateTestContext(w)
	c.Request = newJSONRequest(t, http.MethodPost, onboardingVerifyPhoneInput{
		Phone:        user.Phone,
		Code:         "123456",
		MerchantKind: merchantIdentityTypeProvider,
		Mode:         merchantVerificationModeApply,
		AllowReapply: true,
	})
	MerchantVerifyOnboardingPhone(c)

	var successResp struct {
		Code int `json:"code"`
		Data struct {
			VerificationToken string `json:"verificationToken"`
		} `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &successResp); err != nil {
		t.Fatalf("decode success resp failed: %v", err)
	}
	if successResp.Code != 0 || strings.TrimSpace(successResp.Data.VerificationToken) == "" {
		t.Fatalf("unexpected success response: %+v body=%s", successResp, w.Body.String())
	}
	if !verificationTokenAllowsReapply(merchantVerificationModeApply, merchantIdentityTypeProvider, 0, user.Phone, successResp.Data.VerificationToken) {
		t.Fatalf("expected verification token to carry allowReapply flag")
	}
}

func TestMerchantVerifyOnboardingPhone_ResubmitModeReturnsForm(t *testing.T) {
	setupMerchantRound4TestDB(t)
	portfolio, _ := json.Marshal([]PortfolioCaseInput{{Title: "案例1", Description: "说明", Images: []string{"/a.jpg"}}})
	serviceArea, _ := json.Marshal([]string{"610113"})
	app := model.MerchantApplication{
		Phone:          "13800138000",
		ApplicantType:  "personal",
		Role:           "designer",
		EntityType:     "personal",
		RealName:       "张三",
		Avatar:         "/avatar.jpg",
		IDCardNo:       "11010519491231002X",
		IDCardFront:    "/front.jpg",
		IDCardBack:     "/back.jpg",
		ServiceArea:    string(serviceArea),
		PortfolioCases: string(portfolio),
		Status:         2,
		RejectReason:   "资料不清晰",
	}
	if err := repository.DB.Create(&app).Error; err != nil {
		t.Fatalf("create app failed: %v", err)
	}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = newJSONRequest(t, http.MethodPost, onboardingVerifyPhoneInput{
		Phone:         app.Phone,
		Code:          "123456",
		MerchantKind:  merchantIdentityTypeProvider,
		Mode:          merchantVerificationModeResubmit,
		ApplicationID: app.ID,
	})
	MerchantVerifyOnboardingPhone(c)

	var resp struct {
		Code int `json:"code"`
		Data struct {
			VerificationToken string `json:"verificationToken"`
			RejectReason      string `json:"rejectReason"`
			Form              struct {
				Phone string `json:"phone"`
				Role  string `json:"role"`
			} `json:"form"`
		} `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode resp failed: %v", err)
	}
	if resp.Code != 0 || strings.TrimSpace(resp.Data.VerificationToken) == "" || resp.Data.Form.Phone != app.Phone || resp.Data.Form.Role != app.Role || resp.Data.RejectReason != app.RejectReason {
		t.Fatalf("unexpected response: %+v body=%s", resp, w.Body.String())
	}
}
