package handler

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	imgutil "home-decoration-server/internal/utils/image"
	"home-decoration-server/pkg/response"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type materialShopOnboardingState struct {
	Shop               model.MaterialShop
	User               model.User
	Application        *model.MaterialShopApplication
	CompletionRequired bool
	OnboardingStatus   string
	CompletionAppID    uint64
	RejectReason       string
}

type MaterialShopCompletionSubmitInput struct {
	EntityType             string                          `json:"entityType"`
	Avatar                 string                          `json:"avatar" binding:"required"`
	ShopName               string                          `json:"shopName" binding:"required"`
	ShopDescription        string                          `json:"shopDescription"`
	CompanyName            string                          `json:"companyName"`
	BusinessLicenseNo      string                          `json:"businessLicenseNo" binding:"required"`
	BusinessLicense        string                          `json:"businessLicense" binding:"required"`
	LegalPersonName        string                          `json:"legalPersonName"`
	LegalPersonIDCardNo    string                          `json:"legalPersonIdCardNo"`
	LegalPersonIDCardFront string                          `json:"legalPersonIdCardFront"`
	LegalPersonIDCardBack  string                          `json:"legalPersonIdCardBack"`
	BusinessHours          string                          `json:"businessHours"`
	BusinessHoursRanges    []BusinessHoursRangeInput       `json:"businessHoursRanges"`
	ContactPhone           string                          `json:"contactPhone"`
	ContactName            string                          `json:"contactName"`
	Address                string                          `json:"address"`
	Products               []materialShopApplyProductInput `json:"products" binding:"required,min=1"`
	LegalAcceptance        LegalAcceptanceInput            `json:"legalAcceptance" binding:"required"`
}

func (input MaterialShopCompletionSubmitInput) toApplyInput(phone string) materialShopApplyInput {
	return materialShopApplyInput{
		Phone:                  strings.TrimSpace(phone),
		EntityType:             input.EntityType,
		Avatar:                 strings.TrimSpace(input.Avatar),
		ShopName:               strings.TrimSpace(input.ShopName),
		ShopDescription:        strings.TrimSpace(input.ShopDescription),
		CompanyName:            strings.TrimSpace(input.CompanyName),
		BusinessLicenseNo:      strings.TrimSpace(input.BusinessLicenseNo),
		BusinessLicense:        strings.TrimSpace(input.BusinessLicense),
		LegalPersonName:        strings.TrimSpace(input.LegalPersonName),
		LegalPersonIDCardNo:    strings.TrimSpace(input.LegalPersonIDCardNo),
		LegalPersonIDCardFront: strings.TrimSpace(input.LegalPersonIDCardFront),
		LegalPersonIDCardBack:  strings.TrimSpace(input.LegalPersonIDCardBack),
		BusinessHours:          strings.TrimSpace(input.BusinessHours),
		BusinessHoursRanges:    normalizeBusinessHoursRanges(input.BusinessHoursRanges),
		ContactPhone:           strings.TrimSpace(input.ContactPhone),
		ContactName:            strings.TrimSpace(input.ContactName),
		Address:                strings.TrimSpace(input.Address),
		Products:               input.Products,
		LegalAcceptance:        input.LegalAcceptance,
	}
}

func loadMaterialShopOnboardingState(tx *gorm.DB, shopID, userID uint64) (*materialShopOnboardingState, error) {
	if shopID == 0 {
		return nil, fmt.Errorf("material shop id is required")
	}

	var shop model.MaterialShop
	if err := tx.First(&shop, shopID).Error; err != nil {
		return nil, err
	}

	resolvedUserID := shop.UserID
	if resolvedUserID == 0 {
		resolvedUserID = userID
	}
	if resolvedUserID == 0 {
		return nil, fmt.Errorf("material shop user is missing")
	}

	var user model.User
	if err := tx.First(&user, resolvedUserID).Error; err != nil {
		return nil, err
	}

	app, err := findLatestClaimedMaterialShopCompletionApplication(tx, shop.ID, resolvedUserID)
	if err != nil {
		return nil, err
	}

	status := resolveMaterialShopOnboardingStatus(shop, app)
	state := &materialShopOnboardingState{
		Shop:               shop,
		User:               user,
		Application:        app,
		CompletionRequired: shop.NeedsOnboardingCompletion,
		OnboardingStatus:   status,
	}
	if app != nil {
		state.CompletionAppID = app.ID
		state.RejectReason = strings.TrimSpace(app.RejectReason)
	}
	return state, nil
}

func listMaterialShopApplicationProducts(applicationID uint64) []gin.H {
	if applicationID == 0 {
		return []gin.H{}
	}

	var products []model.MaterialShopApplicationProduct
	if err := repository.DB.Where("application_id = ?", applicationID).Order("sort_order ASC, id ASC").Find(&products).Error; err != nil {
		return []gin.H{}
	}

	result := make([]gin.H, 0, len(products))
	for _, product := range products {
		var images []string
		_ = json.Unmarshal([]byte(product.ImagesJSON), &images)
		result = append(result, gin.H{
			"id":          product.ID,
			"name":        product.Name,
			"unit":        resolveMaterialProductUnit(product.Unit, product.ParamsJSON),
			"description": resolveMaterialProductDescription("", product.ParamsJSON),
			"price":       product.Price,
			"images":      imgutil.GetFullImageURLs(images),
			"sortOrder":   product.SortOrder,
		})
	}
	return result
}

func listLiveMaterialShopProducts(shopID uint64) []gin.H {
	if shopID == 0 {
		return []gin.H{}
	}

	var products []model.MaterialShopProduct
	if err := repository.DB.Where("shop_id = ? AND status >= 0", shopID).Order("sort_order ASC, id ASC").Find(&products).Error; err != nil {
		return []gin.H{}
	}

	result := make([]gin.H, 0, len(products))
	for _, product := range products {
		var images []string
		_ = json.Unmarshal([]byte(product.ImagesJSON), &images)
		result = append(result, gin.H{
			"id":          product.ID,
			"name":        product.Name,
			"unit":        resolveMaterialProductUnit(product.Unit, product.ParamsJSON),
			"description": resolveMaterialProductDescription(product.Description, product.ParamsJSON),
			"price":       product.Price,
			"images":      imgutil.GetFullImageURLs(images),
			"sortOrder":   product.SortOrder,
		})
	}
	return result
}

func buildMaterialShopCompletionFormSnapshot(state *materialShopOnboardingState) gin.H {
	if state == nil {
		return gin.H{}
	}

	if state.Application != nil {
		app := state.Application
		return gin.H{
			"phone":                  firstNonEmpty(app.Phone, state.User.Phone),
			"entityType":             app.EntityType,
			"avatar":                 imgutil.GetFullImageURL(app.BrandLogo),
			"shopName":               app.ShopName,
			"shopDescription":        app.ShopDescription,
			"companyName":            app.CompanyName,
			"businessLicenseNo":      displayReadableSensitive(app.BusinessLicenseNo),
			"businessLicense":        imgutil.GetFullImageURL(app.BusinessLicense),
			"legalPersonName":        app.LegalPersonName,
			"legalPersonIdCardNo":    displayReadableSensitive(app.LegalPersonIDCardNo),
			"legalPersonIdCardFront": imgutil.GetFullImageURL(app.LegalPersonIDCardFront),
			"legalPersonIdCardBack":  imgutil.GetFullImageURL(app.LegalPersonIDCardBack),
			"businessHours":          app.BusinessHours,
			"businessHoursRanges":    parseBusinessHoursRanges(app.BusinessHoursJSON),
			"contactPhone":           app.ContactPhone,
			"contactName":            app.ContactName,
			"address":                app.Address,
			"products":               listMaterialShopApplicationProducts(app.ID),
		}
	}

	shop := state.Shop
	return gin.H{
		"phone":                  state.User.Phone,
		"entityType":             resolveMaterialShopEntityType(shop.ID, state.User.ID),
		"avatar":                 imgutil.GetFullImageURL(firstNonEmpty(shop.BrandLogo, shop.Cover)),
		"shopName":               shop.Name,
		"shopDescription":        shop.Description,
		"companyName":            shop.CompanyName,
		"businessLicenseNo":      displayReadableSensitive(shop.BusinessLicenseNo),
		"businessLicense":        imgutil.GetFullImageURL(shop.BusinessLicense),
		"legalPersonName":        shop.LegalPersonName,
		"legalPersonIdCardNo":    displayReadableSensitive(shop.LegalPersonIDCardNo),
		"legalPersonIdCardFront": imgutil.GetFullImageURL(shop.LegalPersonIDCardFront),
		"legalPersonIdCardBack":  imgutil.GetFullImageURL(shop.LegalPersonIDCardBack),
		"businessHours":          shop.OpenTime,
		"businessHoursRanges":    parseBusinessHoursRanges(shop.BusinessHoursJSON),
		"contactPhone":           shop.ContactPhone,
		"contactName":            shop.ContactName,
		"address":                shop.Address,
		"products":               listLiveMaterialShopProducts(shop.ID),
	}
}

func respondMaterialShopOnboardingIncomplete(c *gin.Context, state *materialShopOnboardingState) {
	status := merchantOnboardingStatusRequired
	completionRequired := true
	applicationID := uint64(0)
	rejectReason := ""
	if state != nil {
		status = state.OnboardingStatus
		completionRequired = state.CompletionRequired
		applicationID = state.CompletionAppID
		rejectReason = state.RejectReason
	}

	c.JSON(409, gin.H{
		"code":    409,
		"message": "资料待补全或待审核，暂不可执行经营操作",
		"data": gin.H{
			"errorCode":               merchantOnboardingIncompleteCode,
			"completionRequired":      completionRequired,
			"onboardingStatus":        status,
			"completionApplicationId": applicationID,
			"rejectReason":            rejectReason,
			"redirectToCompletion":    true,
		},
	})
}

func MaterialShopRequireCompletedOnboarding() gin.HandlerFunc {
	return func(c *gin.Context) {
		shopID := c.GetUint64("materialShopId")
		userID := c.GetUint64("userId")
		if shopID == 0 {
			c.Next()
			return
		}

		state, err := loadMaterialShopOnboardingState(repository.DB, shopID, userID)
		if err != nil {
			c.JSON(500, gin.H{
				"code":    500,
				"message": "校验主材商补全状态失败",
			})
			c.Abort()
			return
		}
		if state.CompletionRequired {
			respondMaterialShopOnboardingIncomplete(c, state)
			c.Abort()
			return
		}

		c.Next()
	}
}

func MaterialShopGetOnboardingCompletion(c *gin.Context) {
	shopID := c.GetUint64("materialShopId")
	userID := c.GetUint64("userId")
	if shopID == 0 {
		response.Forbidden(c, "当前账号不是主材商家")
		return
	}

	state, err := loadMaterialShopOnboardingState(repository.DB, shopID, userID)
	if err != nil {
		response.ServerError(c, "获取补全状态失败")
		return
	}

	readonly := state.OnboardingStatus == merchantOnboardingStatusPendingReview || state.OnboardingStatus == merchantOnboardingStatusApproved
	response.Success(c, gin.H{
		"onboardingStatus":   state.OnboardingStatus,
		"completionRequired": state.CompletionRequired,
		"applicationId":      state.CompletionAppID,
		"rejectReason":       state.RejectReason,
		"readonly":           readonly,
		"form":               buildMaterialShopCompletionFormSnapshot(state),
	})
}

func MaterialShopSubmitOnboardingCompletion(c *gin.Context) {
	shopID := c.GetUint64("materialShopId")
	userID := c.GetUint64("userId")
	if shopID == 0 {
		response.Forbidden(c, "当前账号不是主材商家")
		return
	}

	state, err := loadMaterialShopOnboardingState(repository.DB, shopID, userID)
	if err != nil {
		response.ServerError(c, "提交补全资料失败")
		return
	}
	if !state.CompletionRequired {
		response.Conflict(c, "当前账号无需补全资料")
		return
	}
	if state.OnboardingStatus == merchantOnboardingStatusPendingReview {
		response.Conflict(c, "补全资料已提交，请等待审核")
		return
	}

	var input MaterialShopCompletionSubmitInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, "参数错误: "+err.Error())
		return
	}

	applyInput := input.toApplyInput(state.User.Phone)
	if err := validateMaterialShopApply(&applyInput); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	tx := repository.DB.Begin()
	targetApp := model.MaterialShopApplication{}
	switch {
	case state.Application != nil && state.Application.Status == 2:
		targetApp = *state.Application
	case state.Application != nil && state.Application.Status == 0:
		tx.Rollback()
		response.Conflict(c, "补全资料已提交，请等待审核")
		return
	default:
		targetApp = model.MaterialShopApplication{
			UserID:           state.User.ID,
			ShopID:           state.Shop.ID,
			Phone:            state.User.Phone,
			ApplicationScene: model.MerchantApplicationSceneClaimedCompletion,
		}
	}

	targetApp.UserID = state.User.ID
	targetApp.ShopID = state.Shop.ID
	targetApp.Phone = state.User.Phone
	targetApp.ApplicationScene = model.MerchantApplicationSceneClaimedCompletion
	targetApp.EntityType = applyInput.EntityType
	targetApp.ShopName = applyInput.ShopName
	targetApp.ShopDescription = applyInput.ShopDescription
	targetApp.BrandLogo = applyInput.Avatar
	targetApp.CompanyName = applyInput.CompanyName
	targetApp.BusinessLicenseNo = encryptSensitiveOrPlain(applyInput.BusinessLicenseNo)
	targetApp.BusinessLicense = applyInput.BusinessLicense
	targetApp.LegalPersonName = applyInput.LegalPersonName
	targetApp.LegalPersonIDCardNo = encryptSensitiveOrPlain(applyInput.LegalPersonIDCardNo)
	targetApp.LegalPersonIDCardFront = applyInput.LegalPersonIDCardFront
	targetApp.LegalPersonIDCardBack = applyInput.LegalPersonIDCardBack
	targetApp.BusinessHours = applyInput.BusinessHours
	targetApp.BusinessHoursJSON = marshalBusinessHoursRanges(applyInput.BusinessHoursRanges)
	targetApp.ContactPhone = applyInput.ContactPhone
	targetApp.ContactName = applyInput.ContactName
	targetApp.Address = applyInput.Address
	targetApp.LegalAcceptanceJSON = buildLegalAcceptanceJSON(applyInput.LegalAcceptance)
	submittedAt := time.Now()
	targetApp.LegalAcceptedAt = &submittedAt
	targetApp.LegalAcceptSource = "merchant_web"
	targetApp.Status = 0
	targetApp.RejectReason = ""
	targetApp.AuditedBy = 0
	targetApp.AuditedAt = nil

	var saveErr error
	if targetApp.ID > 0 {
		saveErr = tx.Save(&targetApp).Error
	} else {
		saveErr = tx.Create(&targetApp).Error
	}
	if saveErr != nil {
		tx.Rollback()
		response.ServerError(c, "提交补全资料失败")
		return
	}

	if err := tx.Where("application_id = ?", targetApp.ID).Delete(&model.MaterialShopApplicationProduct{}).Error; err != nil {
		tx.Rollback()
		response.ServerError(c, "提交补全资料失败")
		return
	}
	if err := persistMaterialApplyProducts(tx, targetApp.ID, applyInput.Products); err != nil {
		tx.Rollback()
		response.ServerError(c, "提交补全资料失败")
		return
	}

	if err := tx.Model(&model.MaterialShop{}).
		Where("id = ?", state.Shop.ID).
		Update("needs_onboarding_completion", true).Error; err != nil {
		tx.Rollback()
		response.ServerError(c, "提交补全资料失败")
		return
	}

	if err := tx.Commit().Error; err != nil {
		response.ServerError(c, "提交补全资料失败")
		return
	}

	response.Success(c, gin.H{
		"applicationId":      targetApp.ID,
		"completionRequired": true,
		"onboardingStatus":   merchantOnboardingStatusPendingReview,
		"message":            "补全资料已提交，请等待审核",
	})
}
