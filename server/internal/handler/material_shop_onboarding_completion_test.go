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

func TestMerchantLogin_ClaimedMaterialShopRedirectsToCompletion(t *testing.T) {
	gin.SetMode(gin.TestMode)
	setupMerchantRound4TestDB(t)

	user := model.User{
		Base:     model.Base{ID: 1101},
		Phone:    "13800138121",
		Nickname: "主材待补全",
		Status:   1,
	}
	if err := repository.DB.Create(&user).Error; err != nil {
		t.Fatalf("seed user failed: %v", err)
	}

	shop := model.MaterialShop{
		Base:                      model.Base{ID: 2101},
		UserID:                    user.ID,
		Name:                      "主材待补全门店",
		CompanyName:               "西安主材待补全有限公司",
		IsSettled:                 true,
		NeedsOnboardingCompletion: true,
	}
	if err := repository.DB.Create(&shop).Error; err != nil {
		t.Fatalf("seed shop failed: %v", err)
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

	cfg := &config.Config{JWT: config.JWTConfig{Secret: "test_material_completion_secret"}}
	MerchantLogin(cfg)(c)

	resp := decodeResponse(t, w)
	if resp.Code != 0 {
		t.Fatalf("unexpected login response: code=%d message=%s body=%s", resp.Code, resp.Message, w.Body.String())
	}

	var data struct {
		MerchantKind         string `json:"merchantKind"`
		CompletionRequired   bool   `json:"completionRequired"`
		OnboardingStatus     string `json:"onboardingStatus"`
		RedirectToCompletion bool   `json:"redirectToCompletion"`
		Provider             struct {
			MerchantKind       string `json:"merchantKind"`
			CompletionRequired bool   `json:"completionRequired"`
			OnboardingStatus   string `json:"onboardingStatus"`
		} `json:"provider"`
	}
	if err := json.Unmarshal(resp.Data, &data); err != nil {
		t.Fatalf("decode login data failed: %v", err)
	}
	if data.MerchantKind != "material_shop" {
		t.Fatalf("unexpected merchant kind: %s", data.MerchantKind)
	}
	if !data.CompletionRequired || !data.RedirectToCompletion {
		t.Fatalf("expected login to require completion: %+v", data)
	}
	if data.OnboardingStatus != merchantOnboardingStatusRequired {
		t.Fatalf("unexpected onboarding status: %s", data.OnboardingStatus)
	}
	if data.Provider.MerchantKind != "material_shop" || !data.Provider.CompletionRequired || data.Provider.OnboardingStatus != merchantOnboardingStatusRequired {
		t.Fatalf("material shop session should carry completion flags: %+v", data.Provider)
	}
}

func TestMerchantLogin_LegacyClaimedMaterialShopWithoutCompletionFlagRedirectsToCompletion(t *testing.T) {
	gin.SetMode(gin.TestMode)
	setupMerchantRound4TestDB(t)

	user := model.User{
		Base:     model.Base{ID: 1111},
		Phone:    "13800138141",
		Nickname: "老认领主材门店",
		Status:   1,
	}
	if err := repository.DB.Create(&user).Error; err != nil {
		t.Fatalf("seed user failed: %v", err)
	}

	shop := model.MaterialShop{
		Base:        model.Base{ID: 2111},
		UserID:      user.ID,
		Name:        "老认领主材门店",
		CompanyName: "西安老认领主材有限公司",
		IsSettled:   false,
		IsVerified:  false,
	}
	if err := repository.DB.Create(&shop).Error; err != nil {
		t.Fatalf("seed shop failed: %v", err)
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

	cfg := &config.Config{JWT: config.JWTConfig{Secret: "test_legacy_material_completion_secret"}}
	MerchantLogin(cfg)(c)

	resp := decodeResponse(t, w)
	if resp.Code != 0 {
		t.Fatalf("unexpected login response: code=%d message=%s body=%s", resp.Code, resp.Message, w.Body.String())
	}

	var data struct {
		MerchantKind         string `json:"merchantKind"`
		CompletionRequired   bool   `json:"completionRequired"`
		OnboardingStatus     string `json:"onboardingStatus"`
		RedirectToCompletion bool   `json:"redirectToCompletion"`
	}
	if err := json.Unmarshal(resp.Data, &data); err != nil {
		t.Fatalf("decode login data failed: %v", err)
	}
	if data.MerchantKind != "material_shop" || !data.CompletionRequired || !data.RedirectToCompletion || data.OnboardingStatus != merchantOnboardingStatusRequired {
		t.Fatalf("legacy claimed material shop should be promoted to completion flow: %+v", data)
	}

	var updatedShop model.MaterialShop
	if err := repository.DB.First(&updatedShop, shop.ID).Error; err != nil {
		t.Fatalf("reload shop failed: %v", err)
	}
	if !updatedShop.NeedsOnboardingCompletion || !updatedShop.IsSettled {
		t.Fatalf("legacy claimed material shop should auto-enable completion requirement and settlement, got %+v", updatedShop)
	}
}

func TestMaterialShopGetOnboardingCompletion_ReturnsRejectedState(t *testing.T) {
	gin.SetMode(gin.TestMode)
	setupMerchantRound4TestDB(t)

	user := model.User{
		Base:     model.Base{ID: 1102},
		Phone:    "13800138122",
		Nickname: "主材驳回账号",
		Status:   1,
	}
	if err := repository.DB.Create(&user).Error; err != nil {
		t.Fatalf("seed user failed: %v", err)
	}

	shop := model.MaterialShop{
		Base:                      model.Base{ID: 2102},
		UserID:                    user.ID,
		Name:                      "主材驳回门店",
		CompanyName:               "西安主材驳回有限公司",
		IsSettled:                 true,
		NeedsOnboardingCompletion: true,
	}
	if err := repository.DB.Create(&shop).Error; err != nil {
		t.Fatalf("seed shop failed: %v", err)
	}

	app := model.MaterialShopApplication{
		Base:             model.Base{ID: 3102},
		UserID:           user.ID,
		ShopID:           shop.ID,
		Phone:            user.Phone,
		ApplicationScene: model.MerchantApplicationSceneClaimedCompletion,
		EntityType:       "company",
		ShopName:         "主材驳回门店",
		CompanyName:      "西安主材驳回有限公司",
		Status:           2,
		RejectReason:     "营业执照不清晰",
	}
	if err := repository.DB.Create(&app).Error; err != nil {
		t.Fatalf("seed completion application failed: %v", err)
	}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("materialShopId", shop.ID)
	c.Set("userId", user.ID)
	c.Request = httptest.NewRequest(http.MethodGet, "/api/v1/material-shop/onboarding/completion", nil)

	MaterialShopGetOnboardingCompletion(c)

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
		t.Fatalf("unexpected completion payload: %+v", data)
	}
	if data.RejectReason != app.RejectReason {
		t.Fatalf("unexpected reject reason: %s", data.RejectReason)
	}
	if data.Readonly {
		t.Fatalf("rejected material shop completion should stay editable")
	}
}

func TestMaterialShopSubmitOnboardingCompletion_ReusesRejectedApplication(t *testing.T) {
	gin.SetMode(gin.TestMode)
	setupMerchantRound4TestDB(t)

	user := model.User{
		Base:     model.Base{ID: 1103},
		Phone:    "13800138123",
		Nickname: "主材待重提",
		Status:   1,
	}
	if err := repository.DB.Create(&user).Error; err != nil {
		t.Fatalf("seed user failed: %v", err)
	}

	shop := model.MaterialShop{
		Base:                      model.Base{ID: 2103},
		UserID:                    user.ID,
		Name:                      "主材待重提门店",
		CompanyName:               "西安主材待重提有限公司",
		IsSettled:                 true,
		NeedsOnboardingCompletion: true,
	}
	if err := repository.DB.Create(&shop).Error; err != nil {
		t.Fatalf("seed shop failed: %v", err)
	}

	rejectedApp := model.MaterialShopApplication{
		Base:             model.Base{ID: 3103},
		UserID:           user.ID,
		ShopID:           shop.ID,
		Phone:            user.Phone,
		ApplicationScene: model.MerchantApplicationSceneClaimedCompletion,
		EntityType:       "company",
		ShopName:         "老门店资料",
		CompanyName:      "老公司名",
		Status:           2,
		RejectReason:     "请补齐资料",
	}
	if err := repository.DB.Create(&rejectedApp).Error; err != nil {
		t.Fatalf("seed rejected completion app failed: %v", err)
	}

	input := newValidMaterialShopApplyInput()
	input.Phone = user.Phone

	payload := MaterialShopCompletionSubmitInput{
		EntityType:             input.EntityType,
		Avatar:                 input.Avatar,
		ShopName:               input.ShopName,
		ShopDescription:        input.ShopDescription,
		CompanyName:            input.CompanyName,
		BusinessLicenseNo:      input.BusinessLicenseNo,
		BusinessLicense:        input.BusinessLicense,
		LegalPersonName:        input.LegalPersonName,
		LegalPersonIDCardNo:    input.LegalPersonIDCardNo,
		LegalPersonIDCardFront: input.LegalPersonIDCardFront,
		LegalPersonIDCardBack:  input.LegalPersonIDCardBack,
		BusinessHours:          input.BusinessHours,
		BusinessHoursRanges:    input.BusinessHoursRanges,
		ContactPhone:           input.ContactPhone,
		ContactName:            input.ContactName,
		Address:                input.Address,
		Products:               input.Products,
		LegalAcceptance:        input.LegalAcceptance,
	}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("materialShopId", shop.ID)
	c.Set("userId", user.ID)
	c.Request = newJSONRequest(t, http.MethodPost, payload)

	MaterialShopSubmitOnboardingCompletion(c)

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
	if err := repository.DB.Model(&model.MaterialShopApplication{}).
		Where("shop_id = ? AND application_scene = ?", shop.ID, model.MerchantApplicationSceneClaimedCompletion).
		Count(&appCount).Error; err != nil {
		t.Fatalf("count completion apps failed: %v", err)
	}
	if appCount != 1 {
		t.Fatalf("expected one claimed completion app, got=%d", appCount)
	}

	var updatedApp model.MaterialShopApplication
	if err := repository.DB.First(&updatedApp, rejectedApp.ID).Error; err != nil {
		t.Fatalf("reload application failed: %v", err)
	}
	if updatedApp.Status != 0 || updatedApp.ShopID != shop.ID || updatedApp.RejectReason != "" {
		t.Fatalf("unexpected updated application: %+v", updatedApp)
	}

	var shopCount int64
	if err := repository.DB.Model(&model.MaterialShop{}).Count(&shopCount).Error; err != nil {
		t.Fatalf("count shops failed: %v", err)
	}
	if shopCount != 1 {
		t.Fatalf("submit completion should not create new shop, got=%d", shopCount)
	}
}

func TestMaterialShopRequireCompletedOnboarding_BlocksWrites(t *testing.T) {
	gin.SetMode(gin.TestMode)
	setupMerchantRound4TestDB(t)

	user := model.User{
		Base:     model.Base{ID: 1104},
		Phone:    "13800138124",
		Nickname: "受限主材商",
		Status:   1,
	}
	if err := repository.DB.Create(&user).Error; err != nil {
		t.Fatalf("seed user failed: %v", err)
	}

	shop := model.MaterialShop{
		Base:                      model.Base{ID: 2104},
		UserID:                    user.ID,
		Name:                      "受限主材门店",
		IsSettled:                 true,
		NeedsOnboardingCompletion: true,
	}
	if err := repository.DB.Create(&shop).Error; err != nil {
		t.Fatalf("seed shop failed: %v", err)
	}

	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("materialShopId", shop.ID)
		c.Set("userId", user.ID)
		c.Next()
	})
	router.Use(MaterialShopRequireCompletedOnboarding())
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

func TestAdminApproveMaterialShopApplication_ClaimedCompletionUpdatesExistingShop(t *testing.T) {
	gin.SetMode(gin.TestMode)
	setupMerchantRound4TestDB(t)

	adminID := uint64(9101)
	user := model.User{
		Base:     model.Base{ID: 1105},
		Phone:    "13800138125",
		Nickname: "主材认领账号",
		Status:   1,
	}
	if err := repository.DB.Create(&user).Error; err != nil {
		t.Fatalf("seed user failed: %v", err)
	}

	shop := model.MaterialShop{
		Base:                      model.Base{ID: 2105},
		UserID:                    user.ID,
		Type:                      "brand",
		Name:                      "旧门店名称",
		CompanyName:               "旧公司名",
		ContactPhone:              "13800130000",
		ContactName:               "旧联系人",
		IsSettled:                 true,
		NeedsOnboardingCompletion: true,
	}
	if err := repository.DB.Create(&shop).Error; err != nil {
		t.Fatalf("seed shop failed: %v", err)
	}
	if err := repository.DB.Create(&model.MaterialShopProduct{
		ShopID:      shop.ID,
		Name:        "旧商品",
		Unit:        "件",
		Description: "旧描述",
		Price:       99,
		ImagesJSON:  `["/legacy.jpg"]`,
		CoverImage:  "/legacy.jpg",
		Status:      1,
		SortOrder:   0,
	}).Error; err != nil {
		t.Fatalf("seed old product failed: %v", err)
	}

	app := model.MaterialShopApplication{
		Base:                   model.Base{ID: 3105},
		UserID:                 user.ID,
		ShopID:                 shop.ID,
		Phone:                  user.Phone,
		ApplicationScene:       model.MerchantApplicationSceneClaimedCompletion,
		EntityType:             "company",
		ShopName:               "新门店名称",
		ShopDescription:        "新的门店介绍",
		BrandLogo:              "https://img.example.com/new-logo.jpg",
		CompanyName:            "新公司名",
		BusinessLicenseNo:      "110105000000123",
		BusinessLicense:        "https://img.example.com/new-license.jpg",
		LegalPersonName:        "张三",
		LegalPersonIDCardNo:    "11010519491231002X",
		LegalPersonIDCardFront: "https://img.example.com/new-id-front.jpg",
		LegalPersonIDCardBack:  "https://img.example.com/new-id-back.jpg",
		BusinessHours:          "周一 09:00-18:00",
		BusinessHoursJSON:      `[{"day":1,"start":"09:00","end":"18:00"}]`,
		ContactPhone:           "13800138125",
		ContactName:            "张三",
		Address:                "西安市雁塔区科技路 1 号",
		Status:                 0,
	}
	if err := repository.DB.Create(&app).Error; err != nil {
		t.Fatalf("seed completion app failed: %v", err)
	}
	for i := 0; i < 5; i++ {
		product := model.MaterialShopApplicationProduct{
			ApplicationID: app.ID,
			Name:          "新商品" + string(rune('A'+i)),
			Unit:          "平方米",
			ParamsJSON:    `{"description":"新商品描述"}`,
			Price:         float64(100 + i),
			ImagesJSON:    `["/new-product.jpg"]`,
			SortOrder:     i,
		}
		if err := repository.DB.Create(&product).Error; err != nil {
			t.Fatalf("seed application product failed: %v", err)
		}
	}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("adminId", adminID)
	c.Params = gin.Params{{Key: "id", Value: "3105"}}
	c.Request = httptest.NewRequest(http.MethodPost, "/admin/material-shop-applications/3105/approve", nil)

	AdminApproveMaterialShopApplication(c)

	resp := decodeResponse(t, w)
	if resp.Code != 0 {
		t.Fatalf("unexpected approve response: code=%d message=%s body=%s", resp.Code, resp.Message, w.Body.String())
	}

	var shopCount int64
	if err := repository.DB.Model(&model.MaterialShop{}).Count(&shopCount).Error; err != nil {
		t.Fatalf("count shops failed: %v", err)
	}
	if shopCount != 1 {
		t.Fatalf("approve claimed completion should not create new shop, got=%d", shopCount)
	}

	var updatedShop model.MaterialShop
	if err := repository.DB.First(&updatedShop, shop.ID).Error; err != nil {
		t.Fatalf("reload shop failed: %v", err)
	}
	if updatedShop.Name != app.ShopName || updatedShop.CompanyName != app.CompanyName {
		t.Fatalf("shop fields not updated from completion app: %+v", updatedShop)
	}
	if updatedShop.NeedsOnboardingCompletion || !updatedShop.IsVerified || !updatedShop.IsSettled {
		t.Fatalf("shop onboarding flags not released: %+v", updatedShop)
	}

	var liveProducts []model.MaterialShopProduct
	if err := repository.DB.Where("shop_id = ?", shop.ID).Order("sort_order ASC, id ASC").Find(&liveProducts).Error; err != nil {
		t.Fatalf("load live products failed: %v", err)
	}
	if len(liveProducts) != 5 {
		t.Fatalf("expected replaced live products count=5, got=%d", len(liveProducts))
	}
	if liveProducts[0].Name == "旧商品" {
		t.Fatalf("old live products should be replaced")
	}

	var updatedApp model.MaterialShopApplication
	if err := repository.DB.First(&updatedApp, app.ID).Error; err != nil {
		t.Fatalf("reload application failed: %v", err)
	}
	if updatedApp.Status != 1 || updatedApp.ShopID != shop.ID || updatedApp.UserID != user.ID {
		t.Fatalf("unexpected updated application: %+v", updatedApp)
	}

	var identity model.UserIdentity
	if err := repository.DB.Where("user_id = ? AND identity_type = ?", user.ID, merchantIdentityTypeMaterial).First(&identity).Error; err != nil {
		t.Fatalf("load material identity failed: %v", err)
	}
	if identity.Status != merchantIdentityStatusActive || !identity.Verified {
		t.Fatalf("material identity not activated: %+v", identity)
	}
	if identity.IdentityRefID == nil || *identity.IdentityRefID != shop.ID {
		t.Fatalf("material identity ref mismatch: %+v", identity)
	}
}
