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

func TestMerchantLogin_ClaimedProviderRedirectsToCompletion(t *testing.T) {
	gin.SetMode(gin.TestMode)
	setupMerchantRound4TestDB(t)

	user := model.User{
		Base:     model.Base{ID: 1001},
		Phone:    "13800138111",
		Nickname: "星河装饰",
		Status:   1,
	}
	if err := repository.DB.Create(&user).Error; err != nil {
		t.Fatalf("seed user failed: %v", err)
	}

	provider := model.Provider{
		Base:                      model.Base{ID: 2001},
		UserID:                    user.ID,
		ProviderType:              2,
		SubType:                   "company",
		EntityType:                "company",
		CompanyName:               "星河装饰",
		Status:                    1,
		IsSettled:                 true,
		NeedsOnboardingCompletion: true,
	}
	if err := repository.DB.Create(&provider).Error; err != nil {
		t.Fatalf("seed provider failed: %v", err)
	}

	raw, err := json.Marshal(map[string]string{
		"phone": user.Phone,
		"code":  "123456",
	})
	if err != nil {
		t.Fatalf("marshal login payload failed: %v", err)
	}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/api/v1/merchant/login", bytes.NewReader(raw))
	c.Request.Header.Set("Content-Type", "application/json")

	cfg := &config.Config{JWT: config.JWTConfig{Secret: "test_merchant_completion_secret"}}
	MerchantLogin(cfg)(c)

	resp := decodeResponse(t, w)
	if resp.Code != 0 {
		t.Fatalf("unexpected login response: code=%d message=%s body=%s", resp.Code, resp.Message, w.Body.String())
	}

	var data struct {
		CompletionRequired   bool   `json:"completionRequired"`
		OnboardingStatus     string `json:"onboardingStatus"`
		RedirectToCompletion bool   `json:"redirectToCompletion"`
		Provider             struct {
			CompletionRequired bool   `json:"completionRequired"`
			OnboardingStatus   string `json:"onboardingStatus"`
		} `json:"provider"`
	}
	if err := json.Unmarshal(resp.Data, &data); err != nil {
		t.Fatalf("decode login data failed: %v", err)
	}
	if !data.CompletionRequired || !data.RedirectToCompletion {
		t.Fatalf("expected login to require completion: %+v", data)
	}
	if data.OnboardingStatus != merchantOnboardingStatusRequired {
		t.Fatalf("unexpected onboarding status: %s", data.OnboardingStatus)
	}
	if !data.Provider.CompletionRequired || data.Provider.OnboardingStatus != merchantOnboardingStatusRequired {
		t.Fatalf("provider session should carry completion flags: %+v", data.Provider)
	}
}

func TestMerchantLogin_LegacyClaimedProviderWithoutCompletionFlagRedirectsToCompletion(t *testing.T) {
	gin.SetMode(gin.TestMode)
	setupMerchantRound4TestDB(t)

	user := model.User{
		Base:     model.Base{ID: 1011},
		Phone:    "13800138131",
		Nickname: "老认领装修公司",
		Status:   1,
	}
	if err := repository.DB.Create(&user).Error; err != nil {
		t.Fatalf("seed user failed: %v", err)
	}

	provider := model.Provider{
		Base:         model.Base{ID: 2011},
		UserID:       user.ID,
		ProviderType: 2,
		SubType:      "company",
		EntityType:   "company",
		CompanyName:  "老认领装修公司",
		Status:       1,
		IsSettled:    false,
		Verified:     false,
	}
	if err := repository.DB.Create(&provider).Error; err != nil {
		t.Fatalf("seed provider failed: %v", err)
	}

	raw, err := json.Marshal(map[string]string{
		"phone": user.Phone,
		"code":  "123456",
	})
	if err != nil {
		t.Fatalf("marshal login payload failed: %v", err)
	}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/api/v1/merchant/login", bytes.NewReader(raw))
	c.Request.Header.Set("Content-Type", "application/json")

	cfg := &config.Config{JWT: config.JWTConfig{Secret: "test_legacy_provider_completion_secret"}}
	MerchantLogin(cfg)(c)

	resp := decodeResponse(t, w)
	if resp.Code != 0 {
		t.Fatalf("unexpected login response: code=%d message=%s body=%s", resp.Code, resp.Message, w.Body.String())
	}

	var data struct {
		CompletionRequired   bool   `json:"completionRequired"`
		OnboardingStatus     string `json:"onboardingStatus"`
		RedirectToCompletion bool   `json:"redirectToCompletion"`
	}
	if err := json.Unmarshal(resp.Data, &data); err != nil {
		t.Fatalf("decode login data failed: %v", err)
	}
	if !data.CompletionRequired || !data.RedirectToCompletion || data.OnboardingStatus != merchantOnboardingStatusRequired {
		t.Fatalf("legacy claimed provider should be promoted to completion flow: %+v", data)
	}

	var updatedProvider model.Provider
	if err := repository.DB.First(&updatedProvider, provider.ID).Error; err != nil {
		t.Fatalf("reload provider failed: %v", err)
	}
	if !updatedProvider.NeedsOnboardingCompletion || !updatedProvider.IsSettled {
		t.Fatalf("legacy claimed provider should auto-enable completion requirement and settlement, got %+v", updatedProvider)
	}
}

func TestMerchantGetOnboardingCompletion_ReturnsRejectedState(t *testing.T) {
	gin.SetMode(gin.TestMode)
	setupMerchantRound4TestDB(t)

	user := model.User{
		Base:     model.Base{ID: 1002},
		Phone:    "13800138222",
		Nickname: "已认领装修公司",
		Status:   1,
	}
	if err := repository.DB.Create(&user).Error; err != nil {
		t.Fatalf("seed user failed: %v", err)
	}

	provider := model.Provider{
		Base:                      model.Base{ID: 2002},
		UserID:                    user.ID,
		ProviderType:              2,
		SubType:                   "company",
		EntityType:                "company",
		CompanyName:               "已认领装修公司",
		Status:                    1,
		IsSettled:                 true,
		NeedsOnboardingCompletion: true,
	}
	if err := repository.DB.Create(&provider).Error; err != nil {
		t.Fatalf("seed provider failed: %v", err)
	}

	app := model.MerchantApplication{
		Base:             model.Base{ID: 3002},
		UserID:           user.ID,
		ProviderID:       provider.ID,
		Phone:            user.Phone,
		ApplicantType:    "company",
		Role:             "company",
		EntityType:       "company",
		RealName:         "李四",
		CompanyName:      "已认领装修公司",
		OfficeAddress:    "西安市高新区软件新城",
		ApplicationScene: model.MerchantApplicationSceneClaimedCompletion,
		Status:           2,
		RejectReason:     "营业执照图片不清晰",
	}
	if err := repository.DB.Create(&app).Error; err != nil {
		t.Fatalf("seed completion application failed: %v", err)
	}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("providerId", provider.ID)
	c.Set("userId", user.ID)
	c.Request = httptest.NewRequest(http.MethodGet, "/api/v1/merchant/onboarding/completion", nil)

	MerchantGetOnboardingCompletion(c)

	resp := decodeResponse(t, w)
	if resp.Code != 0 {
		t.Fatalf("unexpected completion status response: code=%d message=%s body=%s", resp.Code, resp.Message, w.Body.String())
	}

	var data struct {
		OnboardingStatus   string `json:"onboardingStatus"`
		CompletionRequired bool   `json:"completionRequired"`
		ApplicationID      uint64 `json:"applicationId"`
		RejectReason       string `json:"rejectReason"`
		Readonly           bool   `json:"readonly"`
	}
	if err := json.Unmarshal(resp.Data, &data); err != nil {
		t.Fatalf("decode completion status data failed: %v", err)
	}
	if data.OnboardingStatus != merchantOnboardingStatusRejected {
		t.Fatalf("unexpected onboarding status: %s", data.OnboardingStatus)
	}
	if !data.CompletionRequired || data.ApplicationID != app.ID {
		t.Fatalf("unexpected completion status payload: %+v", data)
	}
	if data.RejectReason != app.RejectReason {
		t.Fatalf("unexpected reject reason: %s", data.RejectReason)
	}
	if data.Readonly {
		t.Fatalf("rejected completion page should stay editable")
	}
}

func TestMerchantSubmitOnboardingCompletion_ReusesRejectedApplication(t *testing.T) {
	gin.SetMode(gin.TestMode)
	setupMerchantRound4TestDB(t)

	user := model.User{
		Base:     model.Base{ID: 1003},
		Phone:    "13800138333",
		Nickname: "待补全设计师",
		Status:   1,
	}
	if err := repository.DB.Create(&user).Error; err != nil {
		t.Fatalf("seed user failed: %v", err)
	}

	provider := model.Provider{
		Base:                      model.Base{ID: 2003},
		UserID:                    user.ID,
		ProviderType:              1,
		SubType:                   "designer",
		EntityType:                "personal",
		Status:                    1,
		IsSettled:                 true,
		NeedsOnboardingCompletion: true,
	}
	if err := repository.DB.Create(&provider).Error; err != nil {
		t.Fatalf("seed provider failed: %v", err)
	}

	rejectedApp := model.MerchantApplication{
		Base:             model.Base{ID: 3003},
		UserID:           user.ID,
		ProviderID:       provider.ID,
		Phone:            user.Phone,
		ApplicantType:    "personal",
		Role:             "designer",
		EntityType:       "personal",
		RealName:         "老资料",
		ApplicationScene: model.MerchantApplicationSceneClaimedCompletion,
		Status:           2,
		RejectReason:     "请更新资料",
	}
	if err := repository.DB.Create(&rejectedApp).Error; err != nil {
		t.Fatalf("seed rejected completion app failed: %v", err)
	}

	input := newValidDesignerApplyInput()
	input.Phone = user.Phone

	payload := MerchantCompletionSubmitInput{
		Role:             input.Role,
		EntityType:       input.EntityType,
		ApplicantType:    input.ApplicantType,
		RealName:         input.RealName,
		Avatar:           input.Avatar,
		IDCardNo:         input.IDCardNo,
		IDCardFront:      input.IDCardFront,
		IDCardBack:       input.IDCardBack,
		OfficeAddress:    input.OfficeAddress,
		YearsExperience:  input.YearsExperience,
		ServiceArea:      input.ServiceArea,
		Styles:           input.Styles,
		Pricing:          input.Pricing,
		Introduction:     input.Introduction,
		PortfolioCases:   input.PortfolioCases,
		LegalAcceptance:  input.LegalAcceptance,
		GraduateSchool:   input.GraduateSchool,
		DesignPhilosophy: input.DesignPhilosophy,
	}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("providerId", provider.ID)
	c.Set("userId", user.ID)
	c.Request = newJSONRequest(t, http.MethodPost, payload)

	MerchantSubmitOnboardingCompletion(c)

	resp := decodeResponse(t, w)
	if resp.Code != 0 {
		t.Fatalf("unexpected submit response: code=%d message=%s body=%s", resp.Code, resp.Message, w.Body.String())
	}

	var data struct {
		ApplicationID      uint64 `json:"applicationId"`
		CompletionRequired bool   `json:"completionRequired"`
		OnboardingStatus   string `json:"onboardingStatus"`
	}
	if err := json.Unmarshal(resp.Data, &data); err != nil {
		t.Fatalf("decode submit response failed: %v", err)
	}
	if data.ApplicationID != rejectedApp.ID {
		t.Fatalf("expected rejected application to be reused: got=%d want=%d", data.ApplicationID, rejectedApp.ID)
	}
	if !data.CompletionRequired || data.OnboardingStatus != merchantOnboardingStatusPendingReview {
		t.Fatalf("unexpected completion submit payload: %+v", data)
	}

	var appCount int64
	if err := repository.DB.Model(&model.MerchantApplication{}).
		Where("provider_id = ? AND application_scene = ?", provider.ID, model.MerchantApplicationSceneClaimedCompletion).
		Count(&appCount).Error; err != nil {
		t.Fatalf("count completion apps failed: %v", err)
	}
	if appCount != 1 {
		t.Fatalf("expected one claimed completion app, got=%d", appCount)
	}

	var updatedApp model.MerchantApplication
	if err := repository.DB.First(&updatedApp, rejectedApp.ID).Error; err != nil {
		t.Fatalf("reload application failed: %v", err)
	}
	if updatedApp.Status != 0 || updatedApp.ProviderID != provider.ID || updatedApp.RejectReason != "" {
		t.Fatalf("unexpected updated application: %+v", updatedApp)
	}

	var providerCount int64
	if err := repository.DB.Model(&model.Provider{}).Count(&providerCount).Error; err != nil {
		t.Fatalf("count providers failed: %v", err)
	}
	if providerCount != 1 {
		t.Fatalf("submit completion should not create new provider, got=%d", providerCount)
	}
}

func TestMerchantRequireCompletedOnboarding_BlocksWrites(t *testing.T) {
	gin.SetMode(gin.TestMode)
	setupMerchantRound4TestDB(t)

	user := model.User{
		Base:     model.Base{ID: 1004},
		Phone:    "13800138444",
		Nickname: "受限商家",
		Status:   1,
	}
	if err := repository.DB.Create(&user).Error; err != nil {
		t.Fatalf("seed user failed: %v", err)
	}

	provider := model.Provider{
		Base:                      model.Base{ID: 2004},
		UserID:                    user.ID,
		ProviderType:              1,
		SubType:                   "designer",
		EntityType:                "personal",
		Status:                    1,
		IsSettled:                 true,
		NeedsOnboardingCompletion: true,
	}
	if err := repository.DB.Create(&provider).Error; err != nil {
		t.Fatalf("seed provider failed: %v", err)
	}

	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("providerId", provider.ID)
		c.Set("userId", user.ID)
		c.Next()
	})
	router.Use(MerchantRequireCompletedOnboarding())
	router.POST("/guarded", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/guarded", nil)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusConflict {
		t.Fatalf("unexpected guarded status: got=%d want=%d body=%s", w.Code, http.StatusConflict, w.Body.String())
	}

	var resp struct {
		Code int `json:"code"`
		Data struct {
			ErrorCode          string `json:"errorCode"`
			CompletionRequired bool   `json:"completionRequired"`
			OnboardingStatus   string `json:"onboardingStatus"`
		} `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode guard response failed: %v", err)
	}
	if resp.Code != http.StatusConflict {
		t.Fatalf("unexpected business code: %d", resp.Code)
	}
	if resp.Data.ErrorCode != merchantOnboardingIncompleteCode {
		t.Fatalf("unexpected business error code: %s", resp.Data.ErrorCode)
	}
	if !resp.Data.CompletionRequired || resp.Data.OnboardingStatus != merchantOnboardingStatusRequired {
		t.Fatalf("unexpected guard data: %+v", resp.Data)
	}
}
