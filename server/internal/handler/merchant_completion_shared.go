package handler

import (
	"encoding/json"
	"errors"
	"fmt"
	imgutil "home-decoration-server/internal/utils/image"
	"strings"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const (
	merchantOnboardingStatusRequired      = "required"
	merchantOnboardingStatusPendingReview = "pending_review"
	merchantOnboardingStatusRejected      = "rejected"
	merchantOnboardingStatusApproved      = "approved"

	merchantOnboardingIncompleteCode = "MERCHANT_ONBOARDING_INCOMPLETE"
)

type merchantProviderOnboardingState struct {
	Provider           model.Provider
	User               model.User
	Application        *model.MerchantApplication
	CompletionRequired bool
	OnboardingStatus   string
	CompletionAppID    uint64
	RejectReason       string
}

type providerApprovalSnapshot struct {
	ProviderType        int8
	SubType             string
	EntityType          string
	CompatApplicantType string
	Specialty           string
	HighlightTagsJSON   string
	PricingJSON         string
	CompanyAlbumJSON    string
	PriceMin            float64
	PriceMax            float64
	Styles              []string
	PortfolioCases      []PortfolioCaseInput
}

func normalizeMerchantApplicationScene(scene string) string {
	if strings.TrimSpace(scene) == model.MerchantApplicationSceneClaimedCompletion {
		return model.MerchantApplicationSceneClaimedCompletion
	}
	return model.MerchantApplicationSceneNewOnboarding
}

func findLatestClaimedCompletionApplication(tx *gorm.DB, providerID, userID uint64) (*model.MerchantApplication, error) {
	query := tx.Model(&model.MerchantApplication{}).
		Where("application_scene = ?", model.MerchantApplicationSceneClaimedCompletion)

	switch {
	case providerID > 0:
		query = query.Where("provider_id = ?", providerID)
	case userID > 0:
		query = query.Where("user_id = ?", userID)
	default:
		return nil, nil
	}

	var app model.MerchantApplication
	if err := query.Order("updated_at DESC, id DESC").First(&app).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &app, nil
}

func resolveProviderOnboardingStatus(provider model.Provider, app *model.MerchantApplication) string {
	if !provider.NeedsOnboardingCompletion {
		return merchantOnboardingStatusApproved
	}
	if app == nil {
		return merchantOnboardingStatusRequired
	}
	switch app.Status {
	case 0:
		return merchantOnboardingStatusPendingReview
	case 2:
		return merchantOnboardingStatusRejected
	case 1:
		return merchantOnboardingStatusApproved
	default:
		return merchantOnboardingStatusRequired
	}
}

func loadProviderOnboardingState(tx *gorm.DB, providerID, userID uint64) (*merchantProviderOnboardingState, error) {
	if providerID == 0 {
		return nil, fmt.Errorf("provider id is required")
	}

	var provider model.Provider
	if err := tx.First(&provider, providerID).Error; err != nil {
		return nil, err
	}

	resolvedUserID := provider.UserID
	if resolvedUserID == 0 {
		resolvedUserID = userID
	}
	if resolvedUserID == 0 {
		return nil, fmt.Errorf("provider user is missing")
	}

	var user model.User
	if err := tx.First(&user, resolvedUserID).Error; err != nil {
		return nil, err
	}

	app, err := findLatestClaimedCompletionApplication(tx, provider.ID, resolvedUserID)
	if err != nil {
		return nil, err
	}

	status := resolveProviderOnboardingStatus(provider, app)
	state := &merchantProviderOnboardingState{
		Provider:           provider,
		User:               user,
		Application:        app,
		CompletionRequired: provider.NeedsOnboardingCompletion,
		OnboardingStatus:   status,
	}
	if app != nil {
		state.CompletionAppID = app.ID
		state.RejectReason = strings.TrimSpace(app.RejectReason)
	}
	return state, nil
}

func listProviderPortfolioCases(providerID uint64) []PortfolioCaseInput {
	if providerID == 0 {
		return []PortfolioCaseInput{}
	}

	var cases []model.ProviderCase
	if err := repository.DB.Where("provider_id = ?", providerID).Order("sort_order ASC, id ASC").Find(&cases).Error; err != nil {
		return []PortfolioCaseInput{}
	}

	result := make([]PortfolioCaseInput, 0, len(cases))
	for _, item := range cases {
		images := parseJSONStringSlice(item.Images)
		if len(images) == 0 && strings.TrimSpace(item.CoverImage) != "" {
			images = []string{item.CoverImage}
		}
		result = append(result, PortfolioCaseInput{
			Title:       item.Title,
			Description: item.Description,
			Images:      imgutil.GetFullImageURLs(images),
			Style:       strings.TrimSpace(item.Style),
			Area:        strings.TrimSpace(item.Area),
		})
	}
	return result
}

func buildMerchantCompletionFormSnapshot(state *merchantProviderOnboardingState) gin.H {
	if state == nil {
		return gin.H{}
	}

	if state.Application != nil {
		app := state.Application
		var serviceAreaCodes, styles, highlightTags, companyAlbum []string
		var pricing map[string]float64
		var portfolioCases []PortfolioCaseInput
		_ = json.Unmarshal([]byte(app.ServiceArea), &serviceAreaCodes)
		_ = json.Unmarshal([]byte(app.Styles), &styles)
		_ = json.Unmarshal([]byte(app.HighlightTags), &highlightTags)
		_ = json.Unmarshal([]byte(app.CompanyAlbumJSON), &companyAlbum)
		_ = json.Unmarshal([]byte(app.PricingJSON), &pricing)
		_ = json.Unmarshal([]byte(app.PortfolioCases), &portfolioCases)
		if app.Role == "foreman" {
			portfolioCases = normalizeForemanPortfolioCases(portfolioCases)
		}
		serviceAreaCodes, serviceAreaNames, _ := regionService.ResolveServiceAreaInputsToCityDisplay(serviceAreaCodes)

		return gin.H{
			"phone":                  firstNonEmpty(app.Phone, state.User.Phone),
			"applicantType":          app.ApplicantType,
			"role":                   app.Role,
			"entityType":             app.EntityType,
			"realName":               app.RealName,
			"avatar":                 imgutil.GetFullImageURL(app.Avatar),
			"idCardNo":               displayReadableSensitive(app.IDCardNo),
			"idCardFront":            imgutil.GetFullImageURL(app.IDCardFront),
			"idCardBack":             imgutil.GetFullImageURL(app.IDCardBack),
			"companyName":            app.CompanyName,
			"licenseNo":              displayReadableSensitive(app.LicenseNo),
			"licenseImage":           imgutil.GetFullImageURL(app.LicenseImage),
			"legalPersonName":        app.LegalPersonName,
			"legalPersonIdCardNo":    displayReadableSensitive(app.LegalPersonIDCardNo),
			"legalPersonIdCardFront": imgutil.GetFullImageURL(app.LegalPersonIDCardFront),
			"legalPersonIdCardBack":  imgutil.GetFullImageURL(app.LegalPersonIDCardBack),
			"teamSize":               app.TeamSize,
			"officeAddress":          app.OfficeAddress,
			"companyAlbum":           imgutil.GetFullImageURLs(companyAlbum),
			"yearsExperience":        app.YearsExperience,
			"serviceArea":            serviceAreaNames,
			"serviceAreaCodes":       serviceAreaCodes,
			"styles":                 styles,
			"highlightTags":          highlightTags,
			"pricing":                pricing,
			"introduction":           app.Introduction,
			"graduateSchool":         app.GraduateSchool,
			"designPhilosophy":       app.DesignPhilosophy,
			"portfolioCases":         normalizePortfolioCaseDisplays(portfolioCases),
		}
	}

	provider := state.Provider
	user := state.User
	var serviceAreaCodes, styles, highlightTags, companyAlbum []string
	var pricing map[string]float64
	_ = json.Unmarshal([]byte(provider.ServiceArea), &serviceAreaCodes)
	styles = parseJSONOrDelimitedSlice(provider.Specialty)
	highlightTags = normalizeStringSlice(parseJSONOrDelimitedSlice(provider.HighlightTags))
	companyAlbum = parseJSONStringSlice(provider.CompanyAlbumJSON)
	pricing = parsePricingObject(provider.PricingJSON)
	serviceAreaCodes, serviceAreaNames, _ := regionService.ResolveServiceAreaInputsToCityDisplay(serviceAreaCodes)

	applicantType := normalizeMerchantApplicantType(provider.SubType, provider.ProviderType)
	providerSubType := normalizeMerchantProviderSubType(applicantType, provider.ProviderType)
	role := providerRoleFromSubType(providerSubType)
	entityType := normalizeProviderEntityType(provider.EntityType, applicantType)
	avatar := strings.TrimSpace(provider.Avatar)
	if avatar == "" {
		avatar = user.Avatar
	}

	return gin.H{
		"phone":            user.Phone,
		"applicantType":    applicantType,
		"role":             role,
		"entityType":       entityType,
		"realName":         user.Nickname,
		"avatar":           imgutil.GetFullImageURL(avatar),
		"companyName":      provider.CompanyName,
		"teamSize":         provider.TeamSize,
		"officeAddress":    provider.OfficeAddress,
		"companyAlbum":     imgutil.GetFullImageURLs(companyAlbum),
		"yearsExperience":  provider.YearsExperience,
		"serviceArea":      serviceAreaNames,
		"serviceAreaCodes": serviceAreaCodes,
		"styles":           styles,
		"highlightTags":    highlightTags,
		"pricing":          pricing,
		"introduction":     provider.ServiceIntro,
		"graduateSchool":   provider.GraduateSchool,
		"designPhilosophy": provider.DesignPhilosophy,
		"portfolioCases":   normalizePortfolioCaseDisplays(listProviderPortfolioCases(provider.ID)),
	}
}

func respondMerchantOnboardingIncomplete(c *gin.Context, state *merchantProviderOnboardingState) {
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

func buildProviderApprovalSnapshot(app *model.MerchantApplication) (*providerApprovalSnapshot, error) {
	providerType, subType, entityType, compatApplicantType, normalizeErr := normalizeApprovedApplicationMeta(app)
	if normalizeErr != nil {
		return nil, normalizeErr
	}

	styles := parseJSONOrDelimitedSlice(app.Styles)
	highlightTags := normalizeStringSlice(parseJSONOrDelimitedSlice(app.HighlightTags))
	companyAlbum := parseJSONStringSlice(app.CompanyAlbumJSON)
	pricing := parsePricingObject(app.PricingJSON)
	priceMin, priceMax := getPricingRange(pricing)

	highlightTagsJSON, _ := json.Marshal(highlightTags)
	pricingJSON, _ := json.Marshal(pricing)
	companyAlbumJSON, _ := json.Marshal(companyAlbum)

	specialty := strings.Join(styles, " · ")
	if providerType == 3 {
		specialty = "全工种施工"
	}

	var portfolioCases []PortfolioCaseInput
	_ = json.Unmarshal([]byte(app.PortfolioCases), &portfolioCases)
	if app.Role == "foreman" {
		portfolioCases = normalizeForemanPortfolioCases(portfolioCases)
	}

	return &providerApprovalSnapshot{
		ProviderType:        providerType,
		SubType:             subType,
		EntityType:          entityType,
		CompatApplicantType: compatApplicantType,
		Specialty:           specialty,
		HighlightTagsJSON:   string(highlightTagsJSON),
		PricingJSON:         string(pricingJSON),
		CompanyAlbumJSON:    string(companyAlbumJSON),
		PriceMin:            priceMin,
		PriceMax:            priceMax,
		Styles:              styles,
		PortfolioCases:      portfolioCases,
	}, nil
}

func replaceProviderCasesFromApplication(tx *gorm.DB, providerID uint64, app *model.MerchantApplication, snapshot *providerApprovalSnapshot) error {
	if providerID == 0 || app == nil || snapshot == nil {
		return nil
	}

	if err := tx.Where("provider_id = ?", providerID).Delete(&model.ProviderCase{}).Error; err != nil {
		return fmt.Errorf("clear provider cases failed: %w", err)
	}

	fallbackStyle := ""
	if len(snapshot.Styles) > 0 {
		fallbackStyle = strings.TrimSpace(snapshot.Styles[0])
	}

	for i, pc := range snapshot.PortfolioCases {
		imagesJSON, _ := json.Marshal(pc.Images)
		coverImage := ""
		if len(pc.Images) > 0 {
			coverImage = pc.Images[0]
		}

		style := strings.TrimSpace(pc.Style)
		if app.Role != "foreman" {
			if style == "" {
				style = fallbackStyle
			}
			if style == "" {
				style = "现代简约"
			}
		}
		layout := "其他"
		title := pc.Title
		area := pc.Area
		if app.Role == "foreman" {
			title = foremanCategoryDisplayNames[normalizeForemanCategory(firstNonEmpty(pc.Category, pc.Title))]
			style = ""
			area = ""
		}

		providerCase := model.ProviderCase{
			ProviderID:        providerID,
			Title:             title,
			Description:       pc.Description,
			CoverImage:        coverImage,
			Style:             style,
			Layout:            layout,
			Area:              area,
			Price:             0,
			Images:            string(imagesJSON),
			SortOrder:         i,
			ShowInInspiration: false,
		}
		if err := tx.Create(&providerCase).Error; err != nil {
			return fmt.Errorf("create provider case failed: %w", err)
		}
	}

	return nil
}

func ensureMerchantServiceSettingExists(tx *gorm.DB, providerID uint64) error {
	if providerID == 0 {
		return nil
	}

	var setting model.MerchantServiceSetting
	if err := tx.Where("provider_id = ?", providerID).First(&setting).Error; err != nil {
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return fmt.Errorf("load merchant service setting failed: %w", err)
		}
		setting = model.MerchantServiceSetting{
			ProviderID:    providerID,
			AcceptBooking: true,
		}
		if err := tx.Create(&setting).Error; err != nil {
			return fmt.Errorf("create merchant service setting failed: %w", err)
		}
		return nil
	}

	if !setting.AcceptBooking {
		setting.AcceptBooking = true
		if err := tx.Save(&setting).Error; err != nil {
			return fmt.Errorf("save merchant service setting failed: %w", err)
		}
	}

	return nil
}
