package handler

import (
	"encoding/json"
	"strings"
	"time"

	"home-decoration-server/pkg/response"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"

	"github.com/gin-gonic/gin"
)

type MerchantCompletionSubmitInput struct {
	ApplicantType          string               `json:"applicantType"`
	Role                   string               `json:"role"`
	EntityType             string               `json:"entityType"`
	RealName               string               `json:"realName"`
	Avatar                 string               `json:"avatar" binding:"required"`
	IDCardNo               string               `json:"idCardNo"`
	IDCardFront            string               `json:"idCardFront"`
	IDCardBack             string               `json:"idCardBack"`
	LegalPersonName        string               `json:"legalPersonName"`
	LegalPersonIDCardNo    string               `json:"legalPersonIdCardNo"`
	LegalPersonIDCardFront string               `json:"legalPersonIdCardFront"`
	LegalPersonIDCardBack  string               `json:"legalPersonIdCardBack"`
	CompanyName            string               `json:"companyName"`
	LicenseNo              string               `json:"licenseNo"`
	LicenseImage           string               `json:"licenseImage"`
	TeamSize               int                  `json:"teamSize"`
	OfficeAddress          string               `json:"officeAddress"`
	CompanyAlbum           []string             `json:"companyAlbum"`
	YearsExperience        int                  `json:"yearsExperience"`
	ServiceArea            []string             `json:"serviceArea" binding:"required,min=1"`
	Styles                 []string             `json:"styles"`
	HighlightTags          []string             `json:"highlightTags"`
	Pricing                map[string]float64   `json:"pricing"`
	Introduction           string               `json:"introduction"`
	GraduateSchool         string               `json:"graduateSchool"`
	DesignPhilosophy       string               `json:"designPhilosophy"`
	PortfolioCases         []PortfolioCaseInput `json:"portfolioCases" binding:"required,min=1"`
	LegalAcceptance        LegalAcceptanceInput `json:"legalAcceptance" binding:"required"`
}

func (input MerchantCompletionSubmitInput) toMerchantApplyInput(phone string) MerchantApplyInput {
	return MerchantApplyInput{
		Phone:                  strings.TrimSpace(phone),
		ApplicantType:          input.ApplicantType,
		Role:                   input.Role,
		EntityType:             input.EntityType,
		RealName:               strings.TrimSpace(input.RealName),
		Avatar:                 strings.TrimSpace(input.Avatar),
		IDCardNo:               strings.TrimSpace(input.IDCardNo),
		IDCardFront:            strings.TrimSpace(input.IDCardFront),
		IDCardBack:             strings.TrimSpace(input.IDCardBack),
		LegalPersonName:        strings.TrimSpace(input.LegalPersonName),
		LegalPersonIDCardNo:    strings.TrimSpace(input.LegalPersonIDCardNo),
		LegalPersonIDCardFront: strings.TrimSpace(input.LegalPersonIDCardFront),
		LegalPersonIDCardBack:  strings.TrimSpace(input.LegalPersonIDCardBack),
		CompanyName:            strings.TrimSpace(input.CompanyName),
		LicenseNo:              strings.TrimSpace(input.LicenseNo),
		LicenseImage:           strings.TrimSpace(input.LicenseImage),
		TeamSize:               input.TeamSize,
		OfficeAddress:          strings.TrimSpace(input.OfficeAddress),
		CompanyAlbum:           normalizeStringSlice(input.CompanyAlbum),
		YearsExperience:        input.YearsExperience,
		ServiceArea:            input.ServiceArea,
		Styles:                 normalizeStringSlice(input.Styles),
		HighlightTags:          normalizeStringSlice(input.HighlightTags),
		Pricing:                input.Pricing,
		Introduction:           strings.TrimSpace(input.Introduction),
		GraduateSchool:         strings.TrimSpace(input.GraduateSchool),
		DesignPhilosophy:       strings.TrimSpace(input.DesignPhilosophy),
		PortfolioCases:         input.PortfolioCases,
		LegalAcceptance:        input.LegalAcceptance,
	}
}

func MerchantGetOnboardingCompletion(c *gin.Context) {
	providerID := c.GetUint64("providerId")
	userID := c.GetUint64("userId")
	if providerID == 0 {
		response.Forbidden(c, "当前账号不是服务类商家")
		return
	}

	state, err := loadProviderOnboardingState(repository.DB, providerID, userID)
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
		"form":               buildMerchantCompletionFormSnapshot(state),
	})
}

func MerchantSubmitOnboardingCompletion(c *gin.Context) {
	providerID := c.GetUint64("providerId")
	userID := c.GetUint64("userId")
	if providerID == 0 {
		response.Forbidden(c, "当前账号不是服务类商家")
		return
	}

	state, err := loadProviderOnboardingState(repository.DB, providerID, userID)
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

	var input MerchantCompletionSubmitInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, "参数错误: "+err.Error())
		return
	}

	applyInput := input.toMerchantApplyInput(state.User.Phone)
	expectedApplicantType := normalizeMerchantApplicantType(state.Provider.SubType, state.Provider.ProviderType)
	expectedProviderSubType := normalizeMerchantProviderSubType(expectedApplicantType, state.Provider.ProviderType)
	applyInput.Role = providerRoleFromSubType(expectedProviderSubType)
	applyInput.EntityType = normalizeProviderEntityType(state.Provider.EntityType, expectedApplicantType)
	applyInput.ApplicantType = expectedApplicantType

	if err := validateMerchantApplyBusinessFields(&applyInput); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	serviceAreaCodes, err := regionService.NormalizeServiceCityCodes(applyInput.ServiceArea)
	if err != nil {
		response.BadRequest(c, "服务城市验证失败: "+err.Error())
		return
	}

	serviceAreaJSON, _ := json.Marshal(serviceAreaCodes)
	stylesJSON, _ := json.Marshal(applyInput.Styles)
	highlightTagsJSON, _ := json.Marshal(applyInput.HighlightTags)
	pricingJSON, _ := json.Marshal(applyInput.Pricing)
	portfolioCases := applyInput.PortfolioCases
	if applyInput.Role == "foreman" {
		portfolioCases = normalizeForemanPortfolioCases(applyInput.PortfolioCases)
	}
	portfolioJSON, _ := json.Marshal(portfolioCases)
	companyAlbumJSON, _ := json.Marshal(applyInput.CompanyAlbum)
	submittedAt := time.Now()

	tx := repository.DB.Begin()
	targetApp := model.MerchantApplication{}
	switch {
	case state.Application != nil && state.Application.Status == 2:
		targetApp = *state.Application
	case state.Application != nil && state.Application.Status == 0:
		tx.Rollback()
		response.Conflict(c, "补全资料已提交，请等待审核")
		return
	default:
		targetApp = model.MerchantApplication{
			UserID:           state.User.ID,
			ProviderID:       state.Provider.ID,
			Phone:            state.User.Phone,
			ApplicationScene: model.MerchantApplicationSceneClaimedCompletion,
		}
	}

	targetApp.UserID = state.User.ID
	targetApp.ProviderID = state.Provider.ID
	targetApp.Phone = state.User.Phone
	targetApp.ApplicantType = applyInput.ApplicantType
	targetApp.Role = applyInput.Role
	targetApp.EntityType = applyInput.EntityType
	targetApp.RealName = applyInput.RealName
	targetApp.Avatar = applyInput.Avatar
	targetApp.IDCardNo = encryptSensitiveOrPlain(applyInput.IDCardNo)
	targetApp.IDCardFront = applyInput.IDCardFront
	targetApp.IDCardBack = applyInput.IDCardBack
	targetApp.CompanyName = applyInput.CompanyName
	targetApp.LicenseNo = encryptSensitiveOrPlain(applyInput.LicenseNo)
	targetApp.LicenseImage = applyInput.LicenseImage
	targetApp.LegalPersonName = applyInput.LegalPersonName
	targetApp.LegalPersonIDCardNo = encryptSensitiveOrPlain(applyInput.LegalPersonIDCardNo)
	targetApp.LegalPersonIDCardFront = applyInput.LegalPersonIDCardFront
	targetApp.LegalPersonIDCardBack = applyInput.LegalPersonIDCardBack
	targetApp.TeamSize = applyInput.TeamSize
	targetApp.OfficeAddress = applyInput.OfficeAddress
	targetApp.CompanyAlbumJSON = string(companyAlbumJSON)
	targetApp.YearsExperience = applyInput.YearsExperience
	targetApp.ServiceArea = string(serviceAreaJSON)
	targetApp.Styles = string(stylesJSON)
	targetApp.HighlightTags = string(highlightTagsJSON)
	targetApp.PricingJSON = string(pricingJSON)
	targetApp.Introduction = applyInput.Introduction
	targetApp.GraduateSchool = applyInput.GraduateSchool
	targetApp.DesignPhilosophy = applyInput.DesignPhilosophy
	targetApp.PortfolioCases = string(portfolioJSON)
	targetApp.LegalAcceptanceJSON = buildLegalAcceptanceJSON(applyInput.LegalAcceptance)
	targetApp.LegalAcceptedAt = &submittedAt
	targetApp.LegalAcceptSource = "merchant_web"
	targetApp.ApplicationScene = model.MerchantApplicationSceneClaimedCompletion
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

	if err := tx.Model(&model.Provider{}).
		Where("id = ?", state.Provider.ID).
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
