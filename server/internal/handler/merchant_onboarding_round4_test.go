package handler

import (
	"encoding/json"
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

func setupMerchantRound4TestDB(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := "file:" + strings.ReplaceAll(t.Name(), "/", "_") + "?mode=memory&cache=shared"
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("open db failed: %v", err)
	}
	if err := db.AutoMigrate(
		&model.User{},
		&model.Provider{},
		&model.MaterialShop{},
		&model.MerchantApplication{},
		&model.MaterialShopApplication{},
		&model.MaterialShopApplicationProduct{},
		&model.MaterialShopProduct{},
		&model.Region{},
		&model.UserIdentity{},
		&model.MerchantServiceSetting{},
		&model.ProviderCase{},
	); err != nil {
		t.Fatalf("auto migrate failed: %v", err)
	}
	repository.DB = db
	return db
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
		product := model.MaterialShopApplicationProduct{ApplicationID: app.ID, Name: "商品", ParamsJSON: `{"k":"v"}`, Price: 100, ImagesJSON: `["/p.jpg"]`, SortOrder: i}
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

	portfolio, _ := json.Marshal([]PortfolioCaseInput{{Title: "案例A", Description: "说明", Images: []string{"/case-a.jpg"}, Area: "80㎡"}})
	serviceArea, _ := json.Marshal([]string{"310101"})
	styles, _ := json.Marshal([]string{"现代", "奶油"})
	workTypes, _ := json.Marshal([]string{"mason", "plumber"})
	highlightTags, _ := json.Marshal([]string{"快响应", "不增项"})
	pricing, _ := json.Marshal(map[string]float64{"halfDay": 600, "fullDay": 1200})
	app := model.MerchantApplication{
		UserID:              user.ID,
		Phone:               user.Phone,
		ApplicantType:       "team",
		Role:                "foreman",
		EntityType:          "company",
		RealName:            "王五",
		Avatar:              "/new-avatar.jpg",
		CompanyName:         "新工长团队",
		LicenseNo:           "91310101MA1BBBBB2B",
		LicenseImage:        "/license.jpg",
		ServiceArea:         string(serviceArea),
		Styles:              string(styles),
		WorkTypes:           string(workTypes),
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
	if newProvider.Specialty != "mason · plumber" {
		t.Fatalf("unexpected foreman specialty: %s", newProvider.Specialty)
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
	if cases[0].Style != "现代" {
		t.Fatalf("unexpected fallback style: %s", cases[0].Style)
	}
}
