package handler

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/gin-gonic/gin"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
)

func TestMerchantLogin_StudioDesignerCompanyEntity_KeepsDesignerIdentity(t *testing.T) {
	gin.SetMode(gin.TestMode)
	t.Setenv("APP_ENV", "local")
	t.Setenv("SMS_FIXED_CODE_MODE", "1")

	db := setupSQLiteDB(t)
	if err := db.AutoMigrate(&model.User{}, &model.Provider{}, &model.MerchantApplication{}); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}

	previousDB := repository.DB
	repository.DB = db
	t.Cleanup(func() { repository.DB = previousDB })

	user := model.User{
		Base:     model.Base{ID: 90003},
		Phone:    "13800000003",
		Nickname: "普通用户昵称",
		Avatar:   "/uploads/user-avatar.png",
		Status:   1,
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("seed user: %v", err)
	}

	provider := model.Provider{
		Base:         model.Base{ID: 90003},
		UserID:       user.ID,
		ProviderType: 1,
		DisplayName:  "王建国",
		SubType:      "studio",
		EntityType:   "company",
		CompanyName:  "华美装饰设计公司",
		Avatar:       "/uploads/provider-avatar.png",
		Status:       1,
		Verified:     true,
	}
	if err := db.Create(&provider).Error; err != nil {
		t.Fatalf("seed provider: %v", err)
	}

	resp := requestMerchantLogin(t, map[string]string{
		"phone": user.Phone,
		"code":  "123456",
	})
	if resp.Code != 0 {
		t.Fatalf("unexpected code: got=%d message=%s", resp.Code, resp.Message)
	}

	var data struct {
		Role     string `json:"role"`
		Provider struct {
			Name            string `json:"name"`
			Avatar          string `json:"avatar"`
			Role            string `json:"role"`
			ApplicantType   string `json:"applicantType"`
			ProviderSubType string `json:"providerSubType"`
			EntityType      string `json:"entityType"`
		} `json:"provider"`
	}
	if err := json.Unmarshal(resp.Data, &data); err != nil {
		t.Fatalf("decode response data: %v", err)
	}

	if data.Role != "designer" {
		t.Fatalf("unexpected role: got=%s want=designer", data.Role)
	}
	if data.Provider.Name != "王建国" {
		t.Fatalf("unexpected provider name: got=%s want=王建国", data.Provider.Name)
	}
	if data.Provider.Avatar != "http://localhost:8080/uploads/provider-avatar.png" {
		t.Fatalf("unexpected provider avatar: got=%s", data.Provider.Avatar)
	}
	if data.Provider.Role != "designer" {
		t.Fatalf("unexpected provider.role: got=%s want=designer", data.Provider.Role)
	}
	if data.Provider.ProviderSubType != "designer" {
		t.Fatalf("unexpected providerSubType: got=%s want=designer", data.Provider.ProviderSubType)
	}
	if data.Provider.ApplicantType != "studio" {
		t.Fatalf("unexpected applicantType: got=%s want=studio", data.Provider.ApplicantType)
	}
	if data.Provider.EntityType != "company" {
		t.Fatalf("unexpected entityType: got=%s want=company", data.Provider.EntityType)
	}
}

func TestMerchantGetInfo_StudioDesignerCompanyEntity_KeepsDesignerIdentity(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db := setupSQLiteDB(t)
	if err := db.AutoMigrate(&model.User{}, &model.Provider{}); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}

	previousDB := repository.DB
	repository.DB = db
	t.Cleanup(func() { repository.DB = previousDB })

	providerID := uint64(90003)
	userID := uint64(90003)
	if err := db.Create(&model.User{Base: model.Base{ID: userID}, Phone: "13800000003", Nickname: "普通用户昵称", Avatar: "/uploads/user-avatar.png"}).Error; err != nil {
		t.Fatalf("seed user: %v", err)
	}
	if err := db.Create(&model.Provider{
		Base:         model.Base{ID: providerID},
		UserID:       userID,
		ProviderType: 1,
		DisplayName:  "王建国",
		SubType:      "studio",
		EntityType:   "company",
		CompanyName:  "华美装饰设计公司",
		Avatar:       "/uploads/provider-avatar.png",
		Status:       1,
		Verified:     true,
	}).Error; err != nil {
		t.Fatalf("seed provider: %v", err)
	}

	getResp := requestMerchantJSON(t, http.MethodGet, "/api/v1/merchant/info", nil, providerID, userID, MerchantGetInfo)
	if getResp.Code != 0 {
		t.Fatalf("unexpected get info code: %d message=%s", getResp.Code, getResp.Message)
	}

	var data struct {
		Name            string `json:"name"`
		Avatar          string `json:"avatar"`
		Role            string `json:"role"`
		ApplicantType   string `json:"applicantType"`
		ProviderSubType string `json:"providerSubType"`
		EntityType      string `json:"entityType"`
		CompanyName     string `json:"companyName"`
	}
	if err := json.Unmarshal(getResp.Data, &data); err != nil {
		t.Fatalf("decode get info data: %v", err)
	}

	if data.Name != "王建国" {
		t.Fatalf("unexpected name: got=%s want=王建国", data.Name)
	}
	if data.Avatar != "http://localhost:8080/uploads/provider-avatar.png" {
		t.Fatalf("unexpected avatar: got=%s", data.Avatar)
	}
	if data.Role != "designer" {
		t.Fatalf("unexpected role: got=%s want=designer", data.Role)
	}
	if data.ProviderSubType != "designer" {
		t.Fatalf("unexpected providerSubType: got=%s want=designer", data.ProviderSubType)
	}
	if data.ApplicantType != "studio" {
		t.Fatalf("unexpected applicantType: got=%s want=studio", data.ApplicantType)
	}
	if data.EntityType != "company" {
		t.Fatalf("unexpected entityType: got=%s want=company", data.EntityType)
	}
	if data.CompanyName != "华美装饰设计公司" {
		t.Fatalf("unexpected companyName: got=%s want=华美装饰设计公司", data.CompanyName)
	}
}

func TestMerchantUpdateInfo_DoesNotOverwriteUserProfile(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db := setupSQLiteDB(t)
	if err := db.AutoMigrate(&model.User{}, &model.Provider{}); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}

	previousDB := repository.DB
	repository.DB = db
	t.Cleanup(func() { repository.DB = previousDB })

	providerID := uint64(91001)
	userID := uint64(91001)
	if err := db.Create(&model.User{Base: model.Base{ID: userID}, Phone: "13800001001", Nickname: "用户原昵称", Avatar: "/uploads/user-avatar.png"}).Error; err != nil {
		t.Fatalf("seed user: %v", err)
	}
	if err := db.Create(&model.Provider{
		Base:          model.Base{ID: providerID},
		UserID:        userID,
		ProviderType:  1,
		DisplayName:   "服务商原名称",
		CompanyName:   "测试设计工作室",
		OfficeAddress: "西安市高新区",
		Status:        1,
		Verified:      true,
	}).Error; err != nil {
		t.Fatalf("seed provider: %v", err)
	}

	updatePayload := map[string]any{
		"name":          "新的服务商品牌名",
		"officeAddress": "西安市雁塔区",
		"teamSize":      3,
		"introduction":  "新的服务介绍",
	}
	updateResp := requestMerchantJSON(t, http.MethodPut, "/api/v1/merchant/info", updatePayload, providerID, userID, MerchantUpdateInfo)
	if updateResp.Code != 0 {
		t.Fatalf("unexpected update code: %d message=%s", updateResp.Code, updateResp.Message)
	}

	var user model.User
	if err := db.First(&user, userID).Error; err != nil {
		t.Fatalf("load user: %v", err)
	}
	if user.Nickname != "用户原昵称" {
		t.Fatalf("expected user nickname unchanged, got %s", user.Nickname)
	}
	if user.Avatar != "/uploads/user-avatar.png" {
		t.Fatalf("expected user avatar unchanged, got %s", user.Avatar)
	}

	var provider model.Provider
	if err := db.First(&provider, providerID).Error; err != nil {
		t.Fatalf("load provider: %v", err)
	}
	if provider.DisplayName != "新的服务商品牌名" {
		t.Fatalf("expected provider display name updated, got %s", provider.DisplayName)
	}
}

func TestMerchantUpdateInfo_RejectsEmptyServiceAreaAndKeepsExistingValue(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db := setupSQLiteDB(t)
	if err := db.AutoMigrate(&model.User{}, &model.Provider{}); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}

	previousDB := repository.DB
	repository.DB = db
	t.Cleanup(func() { repository.DB = previousDB })

	providerID := uint64(91002)
	userID := uint64(91002)
	if err := db.Create(&model.User{Base: model.Base{ID: userID}, Phone: "13800001002", Nickname: "服务商用户"}).Error; err != nil {
		t.Fatalf("seed user: %v", err)
	}
	if err := db.Create(&model.Provider{
		Base:          model.Base{ID: providerID},
		UserID:        userID,
		ProviderType:  1,
		DisplayName:   "服务商名称",
		OfficeAddress: "西安市高新区",
		ServiceArea:   `["610100"]`,
		Status:        1,
		Verified:      true,
	}).Error; err != nil {
		t.Fatalf("seed provider: %v", err)
	}

	updatePayload := map[string]any{
		"name":          "服务商名称",
		"officeAddress": "西安市高新区",
		"serviceArea":   []string{},
	}
	updateResp := requestMerchantJSON(t, http.MethodPut, "/api/v1/merchant/info", updatePayload, providerID, userID, MerchantUpdateInfo)
	if updateResp.Code == 0 {
		t.Fatalf("expected empty service area to be rejected")
	}

	var provider model.Provider
	if err := db.First(&provider, providerID).Error; err != nil {
		t.Fatalf("load provider: %v", err)
	}
	if provider.ServiceArea != `["610100"]` {
		t.Fatalf("service area should remain unchanged, got %s", provider.ServiceArea)
	}
}

func TestMerchantUpdateInfo_DoesNotResetOmittedProfileFields(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db := setupSQLiteDB(t)
	if err := db.AutoMigrate(&model.User{}, &model.Provider{}); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}

	previousDB := repository.DB
	repository.DB = db
	t.Cleanup(func() { repository.DB = previousDB })

	providerID := uint64(91003)
	userID := uint64(91003)
	if err := db.Create(&model.User{Base: model.Base{ID: userID}, Phone: "13800001003", Nickname: "设计师用户"}).Error; err != nil {
		t.Fatalf("seed user: %v", err)
	}
	if err := db.Create(&model.Provider{
		Base:               model.Base{ID: providerID},
		UserID:             userID,
		ProviderType:       1,
		DisplayName:        "设计师原名",
		CompanyName:        "设计工作室",
		YearsExperience:    9,
		Specialty:          "现代简约 · 北欧",
		TeamSize:           6,
		ServiceIntro:       "原简介",
		OfficeAddress:      "西安市高新区",
		SurveyDepositPrice: 399,
		Status:             1,
		Verified:           true,
	}).Error; err != nil {
		t.Fatalf("seed provider: %v", err)
	}

	updateResp := requestMerchantJSON(t, http.MethodPut, "/api/v1/merchant/info", map[string]any{
		"name":          "设计师新名",
		"officeAddress": "西安市高新区",
	}, providerID, userID, MerchantUpdateInfo)
	if updateResp.Code != 0 {
		t.Fatalf("unexpected update code: %d message=%s", updateResp.Code, updateResp.Message)
	}

	var provider model.Provider
	if err := db.First(&provider, providerID).Error; err != nil {
		t.Fatalf("load provider: %v", err)
	}
	if provider.YearsExperience != 9 {
		t.Fatalf("expected years experience unchanged, got %d", provider.YearsExperience)
	}
	if provider.Specialty != "现代简约 · 北欧" {
		t.Fatalf("expected specialty unchanged, got %q", provider.Specialty)
	}
	if provider.TeamSize != 6 {
		t.Fatalf("expected team size unchanged, got %d", provider.TeamSize)
	}
	if provider.ServiceIntro != "原简介" {
		t.Fatalf("expected introduction unchanged, got %q", provider.ServiceIntro)
	}
	if provider.SurveyDepositPrice != 399 {
		t.Fatalf("expected survey deposit price unchanged, got %v", provider.SurveyDepositPrice)
	}
}

func TestMerchantUpdateInfo_AllowsPricingOnlyUpdateWithoutOfficeAddress(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db := setupSQLiteDB(t)
	if err := db.AutoMigrate(&model.User{}, &model.Provider{}); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}

	previousDB := repository.DB
	repository.DB = db
	t.Cleanup(func() { repository.DB = previousDB })

	providerID := uint64(91004)
	userID := uint64(91004)
	if err := db.Create(&model.User{Base: model.Base{ID: userID}, Phone: "13800001004", Nickname: "设计师用户"}).Error; err != nil {
		t.Fatalf("seed user: %v", err)
	}
	if err := db.Create(&model.Provider{
		Base:               model.Base{ID: providerID},
		UserID:             userID,
		ProviderType:       1,
		DisplayName:        "设计师原名",
		CompanyName:        "设计工作室",
		Specialty:          "现代简约 · 北欧",
		OfficeAddress:      "西安市高新区",
		SurveyDepositPrice: 399,
		PriceMin:           120,
		PriceMax:           180,
		Status:             1,
		Verified:           true,
	}).Error; err != nil {
		t.Fatalf("seed provider: %v", err)
	}

	updateResp := requestMerchantJSON(t, http.MethodPut, "/api/v1/merchant/info", map[string]any{
		"pricing": map[string]float64{
			"flat": 150,
		},
		"surveyDepositPrice": 499,
	}, providerID, userID, MerchantUpdateInfo)
	if updateResp.Code != 0 {
		t.Fatalf("unexpected update code: %d message=%s", updateResp.Code, updateResp.Message)
	}

	var provider model.Provider
	if err := db.First(&provider, providerID).Error; err != nil {
		t.Fatalf("load provider: %v", err)
	}
	if provider.OfficeAddress != "西安市高新区" {
		t.Fatalf("expected office address unchanged, got %q", provider.OfficeAddress)
	}
	if provider.Specialty != "现代简约 · 北欧" {
		t.Fatalf("expected specialty unchanged, got %q", provider.Specialty)
	}
	if provider.SurveyDepositPrice != 499 {
		t.Fatalf("expected survey deposit updated, got %v", provider.SurveyDepositPrice)
	}
	if provider.PriceMin != 150 || provider.PriceMax != 150 {
		t.Fatalf("expected pricing range updated to 150, got min=%v max=%v", provider.PriceMin, provider.PriceMax)
	}
}
