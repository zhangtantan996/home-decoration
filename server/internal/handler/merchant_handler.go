package handler

import (
	"errors"
	"fmt"
	"home-decoration-server/internal/config"
	"home-decoration-server/internal/dto"
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/monitor"
	"home-decoration-server/internal/repository"
	"home-decoration-server/internal/service"
	"home-decoration-server/internal/tinode"
	imgutil "home-decoration-server/internal/utils/image"
	"home-decoration-server/pkg/response"
	"log"
	"os"
	"path/filepath"
	"time"

	"encoding/json"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"gorm.io/gorm"
)

// ========== 商家端 Handler ==========

var merchantProposalService = &service.ProposalService{}
var merchantRegionService = &service.RegionService{}

func normalizeMerchantApplicantType(raw string, providerType int8) string {
	normalized := strings.ToLower(strings.TrimSpace(raw))

	// 兼容历史数据：部分老数据 provider_type 已是工长/公司，但 sub_type 仍是默认 personal。
	if providerType == 3 && (normalized == "" || normalized == "personal" || normalized == "studio" || normalized == "worker" || normalized == "designer") {
		return "foreman"
	}
	if providerType == 2 && (normalized == "" || normalized == "personal" || normalized == "studio" || normalized == "designer") {
		return "company"
	}

	switch normalized {
	case "personal", "studio", "company", "foreman":
		return normalized
	case "designer":
		return "personal"
	case "worker":
		return "foreman"
	default:
		switch providerType {
		case 2:
			return "company"
		case 3:
			return "foreman"
		default:
			return "personal"
		}
	}
}

func normalizeMerchantProviderSubType(applicantType string, providerType int8) string {
	switch strings.ToLower(strings.TrimSpace(applicantType)) {
	case "company":
		return "company"
	case "foreman":
		return "foreman"
	case "personal", "studio":
		return "designer"
	default:
		mapped := strings.ToLower(strings.TrimSpace(mapProviderTypeToSubType(providerType)))
		if mapped == "designer" || mapped == "company" || mapped == "foreman" {
			return mapped
		}
		if providerType == 2 {
			return "company"
		}
		if providerType == 3 {
			return "foreman"
		}
		return "designer"
	}
}

func providerRoleFromSubType(providerSubType string) string {
	switch providerSubType {
	case "company":
		return "company"
	case "foreman":
		return "foreman"
	default:
		return "designer"
	}
}

func normalizeProviderEntityType(raw string, applicantType string) string {
	entityType := strings.ToLower(strings.TrimSpace(raw))
	if entityType == "personal" || entityType == "company" {
		return entityType
	}
	if applicantType == "studio" || applicantType == "company" {
		return "company"
	}
	return "personal"
}

type merchantApplyGuide struct {
	kind          string
	applicationID uint64
	status        int8
	rejectReason  string
	createdAt     time.Time
	role          string
	entityType    string
	applicantType string
}

func resolveMaterialShopEntityType(shopID, userID uint64) string {
	var app model.MaterialShopApplication
	query := repository.DB.Where("status = ?", 1).Order("audited_at DESC, created_at DESC")

	if shopID > 0 && userID > 0 {
		query = query.Where("shop_id = ? OR user_id = ?", shopID, userID)
	} else if shopID > 0 {
		query = query.Where("shop_id = ?", shopID)
	} else if userID > 0 {
		query = query.Where("user_id = ?", userID)
	} else {
		return "company"
	}

	if err := query.First(&app).Error; err != nil {
		return "company"
	}

	return normalizeMaterialEntityType(app.EntityType)
}

func latestMerchantApplyGuide(userID uint64, phone string) (*merchantApplyGuide, error) {
	phone = strings.TrimSpace(phone)

	var providerApp model.MerchantApplication
	providerQuery := repository.DB.Order("created_at DESC")
	if userID > 0 && phone != "" {
		providerQuery = providerQuery.Where("user_id = ? OR phone = ?", userID, phone)
	} else if userID > 0 {
		providerQuery = providerQuery.Where("user_id = ?", userID)
	} else if phone != "" {
		providerQuery = providerQuery.Where("phone = ?", phone)
	}
	providerErr := providerQuery.First(&providerApp).Error

	var materialApp model.MaterialShopApplication
	materialQuery := repository.DB.Order("created_at DESC")
	if userID > 0 && phone != "" {
		materialQuery = materialQuery.Where("user_id = ? OR phone = ?", userID, phone)
	} else if userID > 0 {
		materialQuery = materialQuery.Where("user_id = ?", userID)
	} else if phone != "" {
		materialQuery = materialQuery.Where("phone = ?", phone)
	}
	materialErr := materialQuery.First(&materialApp).Error

	if providerErr != nil && !errors.Is(providerErr, gorm.ErrRecordNotFound) {
		return nil, providerErr
	}
	if materialErr != nil && !errors.Is(materialErr, gorm.ErrRecordNotFound) {
		return nil, materialErr
	}

	providerExists := providerErr == nil
	materialExists := materialErr == nil
	if !providerExists && !materialExists {
		return nil, nil
	}

	if providerExists && (!materialExists || !materialApp.CreatedAt.After(providerApp.CreatedAt)) {
		providerType, _, normalizedEntityType, compatApplicantType, normalizeErr := normalizeApprovedApplicationMeta(&providerApp)
		if normalizeErr != nil {
			return nil, normalizeErr
		}
		role := "designer"
		if providerType == 3 {
			role = "foreman"
		} else if providerType == 2 {
			role = "company"
		}

		return &merchantApplyGuide{
			kind:          "provider",
			applicationID: providerApp.ID,
			status:        providerApp.Status,
			rejectReason:  providerApp.RejectReason,
			createdAt:     providerApp.CreatedAt,
			role:          role,
			entityType:    normalizedEntityType,
			applicantType: compatApplicantType,
		}, nil
	}

	return &merchantApplyGuide{
		kind:          "material_shop",
		applicationID: materialApp.ID,
		status:        materialApp.Status,
		rejectReason:  materialApp.RejectReason,
		createdAt:     materialApp.CreatedAt,
		role:          "material_shop",
		entityType:    normalizeMaterialEntityType(materialApp.EntityType),
	}, nil
}

func merchantLoginDenied(c *gin.Context, messageText string, nextAction string, guide *merchantApplyGuide) {
	data := gin.H{
		"nextAction": nextAction,
	}
	if guide != nil {
		data["applyStatus"] = gin.H{
			"kind":          guide.kind,
			"applicationId": guide.applicationID,
			"status":        guide.status,
			"rejectReason":  guide.rejectReason,
			"role":          guide.role,
			"entityType":    guide.entityType,
			"applicantType": guide.applicantType,
		}
	}

	c.JSON(200, response.Response{
		Code:    409,
		Message: messageText,
		Data:    data,
	})
}

// MerchantLogin 商家登录（手机号+验证码）
func MerchantLogin(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		var input struct {
			Phone string `json:"phone" binding:"required"`
			Code  string `json:"code" binding:"required"`
		}
		if err := c.ShouldBindJSON(&input); err != nil {
			response.Error(c, 400, "参数错误")
			return
		}

		if err := service.VerifySMSCode(input.Phone, service.SMSPurposeLogin, input.Code); err != nil {
			response.Error(c, 400, err.Error())
			return
		}

		var user model.User
		if err := repository.DB.Where("phone = ?", input.Phone).First(&user).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				merchantLoginDenied(c, "该手机号尚未入驻，请先完成入驻申请", "APPLY", nil)
				return
			}
			response.Error(c, 500, "登录失败，请稍后重试")
			return
		}

		var provider model.Provider
		providerErr := repository.DB.Where("user_id = ?", user.ID).First(&provider).Error

		if providerErr == nil {
			if provider.Status != 1 {
				response.Error(c, 403, "账号已被禁用")
				return
			}

			claims := jwt.MapClaims{
				"providerId":   provider.ID,
				"providerType": provider.ProviderType,
				"merchantKind": "provider",
				"userId":       user.ID,
				"phone":        input.Phone,
				"token_type":   "merchant",
				"token_use":    "access",
				"role":         "merchant",
				"exp":          time.Now().Add(24 * time.Hour).Unix(),
			}
			token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
			tokenString, err := token.SignedString([]byte(cfg.JWT.Secret))
			if err != nil {
				response.Error(c, 500, "生成Token失败")
				return
			}

			// 获取显示名称：个人设计师优先显示昵称，工作室/公司显示公司名
			displayName := user.Nickname
			if provider.ProviderType != 1 || provider.SubType == "company" || provider.SubType == "studio" {
				if provider.CompanyName != "" {
					displayName = provider.CompanyName
				}
			}
			// 兜底：如果昵称也为空，使用手机号后4位
			if displayName == "" {
				displayName = "用户" + input.Phone[len(input.Phone)-4:]
			}

			// 生成 Tinode token（失败不阻塞商家登录）
			tinodeToken := ""
			if tokenValue, err := tinode.GenerateTinodeToken(user.ID, displayName); err != nil {
				log.Printf("[Tinode] Token generation failed (merchant login): userID=%d, err=%v", user.ID, err)
			} else {
				tinodeToken = tokenValue
				// Ensure this merchant exists in Tinode DB with a usable public profile.
				u := user
				if u.Nickname == "" {
					u.Nickname = displayName
				}
				if err := tinode.SyncUserToTinode(&u); err != nil {
					log.Printf("[Tinode] Sync merchant user failed: userID=%d, err=%v", user.ID, err)
				}
			}

			applicantType := normalizeMerchantApplicantType(provider.SubType, provider.ProviderType)
			providerSubType := normalizeMerchantProviderSubType(applicantType, provider.ProviderType)
			role := providerRoleFromSubType(providerSubType)
			entityType := normalizeProviderEntityType(provider.EntityType, applicantType)
			avatar := strings.TrimSpace(provider.Avatar)
			if avatar == "" {
				avatar = user.Avatar
			}

			response.Success(c, gin.H{
				"token":        tokenString,
				"tinodeToken":  tinodeToken,
				"merchantKind": "provider",
				"role":         role,
				"entityType":   entityType,
				"provider": gin.H{
					"id":              provider.ID,
					"name":            displayName,
					"avatar":          imgutil.GetFullImageURL(avatar),
					"providerType":    provider.ProviderType,
					"applicantType":   applicantType,
					"providerSubType": providerSubType,
					"merchantKind":    "provider",
					"role":            role,
					"entityType":      entityType,
					"phone":           input.Phone,
					"verified":        provider.Verified,
				},
			})
			return
		}

		if providerErr != nil && !errors.Is(providerErr, gorm.ErrRecordNotFound) {
			response.Error(c, 500, "登录失败，请稍后重试")
			return
		}

		var materialShop model.MaterialShop
		materialErr := repository.DB.Where("user_id = ?", user.ID).Order("id DESC").First(&materialShop).Error
		if materialErr == nil && materialShop.IsVerified {
			entityType := resolveMaterialShopEntityType(materialShop.ID, user.ID)

			claims := jwt.MapClaims{
				"materialShopId": materialShop.ID,
				"merchantKind":   "material_shop",
				"userId":         user.ID,
				"phone":          input.Phone,
				"token_type":     "merchant",
				"token_use":      "access",
				"role":           "merchant",
				"exp":            time.Now().Add(24 * time.Hour).Unix(),
			}
			token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
			tokenString, err := token.SignedString([]byte(cfg.JWT.Secret))
			if err != nil {
				response.Error(c, 500, "生成Token失败")
				return
			}

			displayName := strings.TrimSpace(materialShop.Name)
			if displayName == "" {
				displayName = user.Nickname
			}
			if displayName == "" {
				displayName = "商家" + input.Phone[len(input.Phone)-4:]
			}

			tinodeToken := ""
			if tokenValue, err := tinode.GenerateTinodeToken(user.ID, displayName); err != nil {
				log.Printf("[Tinode] Token generation failed (material login): userID=%d, err=%v", user.ID, err)
			} else {
				tinodeToken = tokenValue
				u := user
				if u.Nickname == "" {
					u.Nickname = displayName
				}
				if err := tinode.SyncUserToTinode(&u); err != nil {
					log.Printf("[Tinode] Sync material merchant user failed: userID=%d, err=%v", user.ID, err)
				}
			}

			avatar := materialShop.BrandLogo
			if strings.TrimSpace(avatar) == "" {
				avatar = materialShop.Cover
			}

			response.Success(c, gin.H{
				"token":        tokenString,
				"tinodeToken":  tinodeToken,
				"merchantKind": "material_shop",
				"role":         "material_shop",
				"entityType":   entityType,
				"provider": gin.H{
					"id":              materialShop.ID,
					"name":            displayName,
					"avatar":          imgutil.GetFullImageURL(avatar),
					"providerType":    4,
					"applicantType":   "company",
					"providerSubType": "company",
					"merchantKind":    "material_shop",
					"role":            "material_shop",
					"entityType":      entityType,
					"phone":           input.Phone,
					"verified":        materialShop.IsVerified,
				},
			})
			return
		}

		if materialErr != nil && !errors.Is(materialErr, gorm.ErrRecordNotFound) {
			response.Error(c, 500, "登录失败，请稍后重试")
			return
		}

		guide, err := latestMerchantApplyGuide(user.ID, input.Phone)
		if err != nil {
			response.Error(c, 500, "登录失败，请稍后重试")
			return
		}
		if guide == nil {
			merchantLoginDenied(c, "该手机号尚未入驻，请先完成入驻申请", "APPLY", nil)
			return
		}

		hasApprovedIdentity := providerErr == nil || (materialErr == nil && materialShop.IsVerified)
		nextAction := resolveMerchantNextAction(guide.status, hasApprovedIdentity)
		switch nextAction {
		case "PENDING":
			merchantLoginDenied(c, "入驻申请审核中，请耐心等待审核结果", nextAction, guide)
		case "RESUBMIT":
			merchantLoginDenied(c, "入驻申请未通过，请修改后重新提交", nextAction, guide)
		default:
			merchantLoginDenied(c, "该手机号尚未入驻，请先完成入驻申请", "APPLY", guide)
		}
	}
}

// MerchantGetInfo 获取当前商家信息
func MerchantGetInfo(c *gin.Context) {
	providerID := c.GetUint64("providerId")

	var provider model.Provider
	if err := repository.DB.First(&provider, providerID).Error; err != nil {
		response.Error(c, 404, "商家不存在")
		return
	}

	// 获取关联用户信息
	var user model.User
	repository.DB.First(&user, provider.UserID)

	displayName := provider.CompanyName
	// 特殊处理：如果是个人设计师，显示名称优先使用用户昵称/真实姓名
	if provider.ProviderType == 1 {
		displayName = user.Nickname
	} else if displayName == "" {
		displayName = user.Nickname
	}

	// 解析 ServiceArea (JSON数组) - 存储的是区域代码
	var serviceAreaCodes []string
	if provider.ServiceArea != "" {
		json.Unmarshal([]byte(provider.ServiceArea), &serviceAreaCodes)
	}

	// 将区域代码转换为名称（用于前端展示）
	serviceAreaNames, _ := merchantRegionService.ConvertCodesToNames(serviceAreaCodes)

	// 解析 Specialty (逗号或点分隔)
	var specialty []string
	if provider.Specialty != "" {
		if strings.Contains(provider.Specialty, " · ") {
			specialty = strings.Split(provider.Specialty, " · ")
		} else {
			specialty = strings.Split(provider.Specialty, ",")
		}
	}

	applicantType := normalizeMerchantApplicantType(provider.SubType, provider.ProviderType)
	providerSubType := normalizeMerchantProviderSubType(applicantType, provider.ProviderType)
	role := providerRoleFromSubType(providerSubType)
	entityType := normalizeProviderEntityType(provider.EntityType, applicantType)
	highlightTags := parseJSONOrDelimitedSlice(provider.HighlightTags)
	companyAlbum := parseJSONStringSlice(provider.CompanyAlbumJSON)
	pricing := parsePricingObject(provider.PricingJSON)
	avatar := strings.TrimSpace(provider.Avatar)
	if avatar == "" {
		avatar = user.Avatar
	}

	response.Success(c, gin.H{
		"id":                  provider.ID,
		"sourceApplicationId": provider.SourceApplicationID,
		"name":                displayName,
		"avatar":              imgutil.GetFullImageURL(avatar),
		"providerType":        provider.ProviderType,
		"applicantType":       applicantType,
		"providerSubType":     providerSubType,
		"role":                role,
		"entityType":          entityType,
		"companyName":         provider.CompanyName,
		"rating":              provider.Rating,
		"completedCnt":        provider.CompletedCnt,
		"verified":            provider.Verified,
		"yearsExperience":     provider.YearsExperience,
		"specialty":           specialty,
		"highlightTags":       highlightTags,
		"pricing":             pricing,
		"graduateSchool":      provider.GraduateSchool,
		"designPhilosophy":    provider.DesignPhilosophy,
		"serviceArea":         serviceAreaNames, // 返回区域名称数组
		"serviceAreaCodes":    serviceAreaCodes, // 返回区域代码数组（用于编辑）
		"introduction":        provider.ServiceIntro,
		"teamSize":            provider.TeamSize,
		"officeAddress":       provider.OfficeAddress,
		"companyAlbum":        imgutil.GetFullImageURLs(companyAlbum),
	})
}

// MerchantUpdateInfo 更新商家信息
func MerchantUpdateInfo(c *gin.Context) {
	providerID := c.GetUint64("providerId")
	userID := c.GetUint64("userId")

	var input struct {
		Name             string             `json:"name"` // 显示名称
		CompanyName      string             `json:"companyName"`
		CompanyAlbum     []string           `json:"companyAlbum"`
		YearsExperience  int                `json:"yearsExperience"`
		Specialty        []string           `json:"specialty"`
		HighlightTags    []string           `json:"highlightTags"`
		Pricing          map[string]float64 `json:"pricing"`
		GraduateSchool   string             `json:"graduateSchool"`
		DesignPhilosophy string             `json:"designPhilosophy"`
		ServiceArea      []string           `json:"serviceArea"` // 区域代码数组
		Introduction     string             `json:"introduction"`
		TeamSize         int                `json:"teamSize"`
		OfficeAddress    string             `json:"officeAddress"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		response.Error(c, 400, "参数错误")
		return
	}

	// 验证服务区域代码（如果提供）
	var serviceAreaCodes []string
	if len(input.ServiceArea) > 0 {
		// 先尝试验证是否为代码格式
		if err := merchantRegionService.ValidateRegionCodes(input.ServiceArea); err != nil {
			// 如果验证失败，尝试将名称转换为代码（兼容旧数据）
			codes, convertErr := merchantRegionService.ConvertNamesToCodes(input.ServiceArea)
			if convertErr != nil {
				response.Error(c, 400, "服务区域验证失败: "+err.Error())
				return
			}
			// 转换成功后再次验证代码
			if err := merchantRegionService.ValidateRegionCodes(codes); err != nil {
				response.Error(c, 400, "服务区域代码验证失败: "+err.Error())
				return
			}
			serviceAreaCodes = codes
		} else {
			// 如果是代码格式，直接使用
			serviceAreaCodes = input.ServiceArea
		}
	}

	tx := repository.DB.Begin()

	// 更新 Provider 信息
	var provider model.Provider
	if err := tx.First(&provider, providerID).Error; err != nil {
		tx.Rollback()
		response.Error(c, 404, "商家不存在")
		return
	}

	updates := map[string]interface{}{}
	if input.CompanyName != "" {
		updates["company_name"] = input.CompanyName
	}
	updates["years_experience"] = input.YearsExperience

	applicantType := normalizeMerchantApplicantType(provider.SubType, provider.ProviderType)
	providerSubType := normalizeMerchantProviderSubType(applicantType, provider.ProviderType)

	if providerSubType == "foreman" {
		updates["work_types"] = ""
		updates["specialty"] = "全工种施工"
	} else {
		if len(input.Specialty) > 0 {
			updates["specialty"] = strings.Join(normalizeStringSlice(input.Specialty), " · ")
		} else {
			updates["specialty"] = ""
		}
		updates["work_types"] = ""
	}

	if input.HighlightTags != nil {
		highlightTags := normalizeStringSlice(input.HighlightTags)
		highlightTagsJSON, _ := json.Marshal(highlightTags)
		updates["highlight_tags"] = string(highlightTagsJSON)
	}
	if input.Pricing != nil {
		pricingJSON, _ := json.Marshal(input.Pricing)
		priceMin, priceMax := getPricingRange(input.Pricing)
		updates["pricing_json"] = string(pricingJSON)
		updates["price_min"] = priceMin
		updates["price_max"] = priceMax
	}
	if input.GraduateSchool != "" {
		updates["graduate_school"] = strings.TrimSpace(input.GraduateSchool)
	}
	if input.DesignPhilosophy != "" {
		updates["design_philosophy"] = strings.TrimSpace(input.DesignPhilosophy)
	}
	if input.CompanyAlbum != nil {
		normalizedCompanyAlbum := normalizeStringSlice(input.CompanyAlbum)
		if providerSubType == "company" && (len(normalizedCompanyAlbum) < 3 || len(normalizedCompanyAlbum) > 8) {
			tx.Rollback()
			response.Error(c, 400, "装修公司企业相册需上传3-8张图片")
			return
		}
		albumJSON, _ := json.Marshal(normalizedCompanyAlbum)
		updates["company_album_json"] = string(albumJSON)
	}

	if len(serviceAreaCodes) > 0 {
		jsonBytes, _ := json.Marshal(serviceAreaCodes)
		updates["service_area"] = string(jsonBytes)
	} else {
		updates["service_area"] = "[]"
	}

	if len([]rune(input.Introduction)) > 5000 {
		tx.Rollback()
		response.Error(c, 400, "简介不能超过5000个字符")
		return
	}
	if len([]rune(input.DesignPhilosophy)) > 5000 {
		tx.Rollback()
		response.Error(c, 400, "设计理念不能超过5000个字符")
		return
	}

	updates["service_intro"] = input.Introduction
	updates["team_size"] = input.TeamSize
	if strings.TrimSpace(input.OfficeAddress) == "" {
		tx.Rollback()
		response.Error(c, 400, "办公地址不能为空")
		return
	}
	updates["office_address"] = input.OfficeAddress

	if err := tx.Model(&provider).Updates(updates).Error; err != nil {
		tx.Rollback()
		response.Error(c, 500, "更新失败")
		return
	}

	// 更新 User 昵称 (如果 Name 字段通过且是设计师类型，或者作为备用)
	if input.Name != "" {
		// 1. 更新 User 昵称
		if err := tx.Model(&model.User{}).Where("id = ?", userID).Update("nickname", input.Name).Error; err != nil {
			tx.Rollback()
			response.Error(c, 500, "更新用户信息失败")
			return
		}
	}

	tx.Commit()
	response.Success(c, gin.H{"status": "ok"})
}

// MerchantListBookings 获取我的预约列表
func MerchantListBookings(c *gin.Context) {
	providerID := c.GetUint64("providerId")

	var bookings []model.Booking
	if err := repository.DB.Where("provider_id = ?", providerID).
		Order("created_at DESC").Find(&bookings).Error; err != nil {
		response.Error(c, 500, "查询失败")
		return
	}

	// 批量查询用户信息
	userIDs := make([]uint64, 0, len(bookings))
	bookingIDs := make([]uint64, 0, len(bookings))
	for _, b := range bookings {
		userIDs = append(userIDs, b.UserID)
		bookingIDs = append(bookingIDs, b.ID)
	}

	var users []model.User
	userMap := make(map[uint64]model.User)
	if len(userIDs) > 0 {
		repository.DB.Where("id IN ?", userIDs).Find(&users)
		for _, u := range users {
			userMap[u.ID] = u
		}
	}

	// 批量查询哪些预约已有方案
	var proposals []model.Proposal
	proposalMap := make(map[uint64]bool)
	if len(bookingIDs) > 0 {
		repository.DB.Where("booking_id IN ?", bookingIDs).Find(&proposals)
		for _, p := range proposals {
			proposalMap[p.BookingID] = true
		}
	}

	// 构建返回结果，包含用户昵称和是否已有方案
	type BookingWithUser struct {
		model.Booking
		UserNickname string `json:"userNickname"`
		UserPhone    string `json:"userPhone"`
		UserPublicID string `json:"userPublicId,omitempty"`
		HasProposal  bool   `json:"hasProposal"`
	}

	result := make([]BookingWithUser, 0, len(bookings))
	for _, b := range bookings {
		item := BookingWithUser{Booking: b}
		if u, ok := userMap[b.UserID]; ok {
			identity := dto.NewUserIdentity(&u)
			item.UserPublicID = identity.UserPublicID
			if item.UserPublicID == "" {
				monitor.RecordPublicIDMissing("merchant_booking_list", identity.UserID, "merchant_list_bookings")
			}
			item.UserNickname = u.Nickname
			if item.UserNickname == "" {
				// 兜底：使用手机号后4位
				if len(u.Phone) >= 4 {
					item.UserNickname = "用户" + u.Phone[len(u.Phone)-4:]
				} else {
					item.UserNickname = "用户"
				}
			}
			item.UserPhone = u.Phone
		}
		item.HasProposal = proposalMap[b.ID]
		result = append(result, item)
	}

	response.Success(c, gin.H{
		"list":  result,
		"total": len(result),
	})
}

// MerchantGetBookingDetail 获取预约详情
func MerchantGetBookingDetail(c *gin.Context) {
	providerID := c.GetUint64("providerId")
	bookingID := parseUint64(c.Param("id"))

	var booking model.Booking
	if err := repository.DB.First(&booking, bookingID).Error; err != nil {
		response.Error(c, 404, "预约不存在")
		return
	}

	if booking.ProviderID != providerID {
		response.Error(c, 403, "无权查看此预约")
		return
	}

	// 检查是否已有方案
	var proposal model.Proposal
	hasProposal := repository.DB.Where("booking_id = ?", bookingID).First(&proposal).Error == nil

	var bookingUser model.User
	_ = repository.DB.Select("id", "public_id").First(&bookingUser, booking.UserID).Error
	bookingIdentity := dto.NewUserIdentity(&bookingUser)
	if bookingIdentity.UserPublicID == "" {
		monitor.RecordPublicIDMissing("merchant_booking_detail", bookingIdentity.UserID, "merchant_booking_detail")
	}

	type BookingDetailWithIdentity struct {
		model.Booking
		UserPublicID string `json:"userPublicId,omitempty"`
	}

	response.Success(c, gin.H{
		"booking": BookingDetailWithIdentity{
			Booking:      booking,
			UserPublicID: bookingIdentity.UserPublicID,
		},
		"hasProposal": hasProposal,
		"proposal":    proposal,
	})
}

// MerchantHandleBooking 处理预约（接单/拒单）
func MerchantHandleBooking(c *gin.Context) {
	providerID := c.GetUint64("providerId")
	bookingID := parseUint64(c.Param("id"))

	var input struct {
		Action string `json:"action" binding:"required,oneof=confirm reject"` // confirm: 接单, reject: 拒单
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		response.Error(c, 400, "参数错误")
		return
	}

	var booking model.Booking
	if err := repository.DB.First(&booking, bookingID).Error; err != nil {
		response.Error(c, 404, "预约不存在")
		return
	}

	if booking.ProviderID != providerID {
		response.Error(c, 403, "无权操作此预约")
		return
	}

	if booking.Status != 1 {
		response.Error(c, 400, "当前状态不可操作")
		return
	}

	updates := map[string]interface{}{}
	if input.Action == "confirm" {
		updates["status"] = 2 // 已确认
	} else if input.Action == "reject" {
		updates["status"] = 4 // 已取消/已拒绝
	}

	if err := repository.DB.Model(&booking).Updates(updates).Error; err != nil {
		response.Error(c, 500, "操作失败")
		return
	}

	response.Success(c, gin.H{"status": "ok"})
}

// MerchantSubmitProposal 提交设计方案
func MerchantSubmitProposal(c *gin.Context) {
	providerID := c.GetUint64("providerId")

	var input service.SubmitProposalInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.Error(c, 400, "参数错误: "+err.Error())
		return
	}

	proposal, err := merchantProposalService.SubmitProposal(providerID, &input)
	if err != nil {
		response.Error(c, 400, err.Error())
		return
	}

	response.Success(c, proposal)
}

// MerchantListProposals 获取我的方案列表
func MerchantListProposals(c *gin.Context) {
	providerID := c.GetUint64("providerId")

	proposals, err := merchantProposalService.ListProposalsByDesigner(providerID)
	if err != nil {
		response.Error(c, 500, err.Error())
		return
	}

	response.Success(c, gin.H{
		"list":  proposals,
		"total": len(proposals),
	})
}

// MerchantListOrders 获取我的订单列表
func MerchantListOrders(c *gin.Context) {
	providerID := c.GetUint64("providerId")

	// 通过 Proposal 找关联的 booking_id
	var bookingIDs []uint64
	repository.DB.Model(&model.Proposal{}).
		Where("designer_id = ?", providerID).
		Pluck("booking_id", &bookingIDs)

	var orders []model.Order
	if len(bookingIDs) > 0 {
		repository.DB.Where("booking_id IN ?", bookingIDs).
			Order("created_at DESC").Find(&orders)
	}

	response.Success(c, gin.H{
		"list":  orders,
		"total": len(orders),
	})
}

// MerchantDashboardStats 商家首页统计
func MerchantDashboardStats(c *gin.Context) {
	providerID := c.GetUint64("providerId")

	// 预约统计
	var pendingBookings, confirmedBookings int64
	repository.DB.Model(&model.Booking{}).Where("provider_id = ? AND status = 1", providerID).Count(&pendingBookings)
	repository.DB.Model(&model.Booking{}).Where("provider_id = ? AND status = 2", providerID).Count(&confirmedBookings)

	// 方案统计
	var pendingProposals, confirmedProposals int64
	repository.DB.Model(&model.Proposal{}).Where("designer_id = ? AND status = 1", providerID).Count(&pendingProposals)
	repository.DB.Model(&model.Proposal{}).Where("designer_id = ? AND status = 2", providerID).Count(&confirmedProposals)
	var pendingLeads int64
	repository.DB.Model(&model.DemandMatch{}).Where("provider_id = ? AND status = ?", providerID, model.DemandMatchStatusPending).Count(&pendingLeads)

	// 订单统计
	var bookingIDs []uint64
	repository.DB.Model(&model.Proposal{}).Where("designer_id = ?", providerID).Pluck("booking_id", &bookingIDs)

	var pendingOrders, paidOrders int64
	if len(bookingIDs) > 0 {
		repository.DB.Model(&model.Order{}).Where("booking_id IN ? AND status = 0", bookingIDs).Count(&pendingOrders)
		repository.DB.Model(&model.Order{}).Where("booking_id IN ? AND status = 1", bookingIDs).Count(&paidOrders)
	}

	now := time.Now()
	dayStart := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	monthStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())

	var todayBookings int64
	repository.DB.Model(&model.Booking{}).
		Where("provider_id = ? AND created_at >= ?", providerID, dayStart).
		Count(&todayBookings)

	var totalRevenue, monthRevenue float64
	repository.DB.Model(&model.MerchantIncome{}).
		Where("provider_id = ?", providerID).
		Select("COALESCE(SUM(net_amount), 0)").
		Scan(&totalRevenue)

	repository.DB.Model(&model.MerchantIncome{}).
		Where("provider_id = ? AND created_at >= ?", providerID, monthStart).
		Select("COALESCE(SUM(net_amount), 0)").
		Scan(&monthRevenue)

	activeProjects := paidOrders

	response.Success(c, gin.H{
		"pendingLeads":     pendingLeads,
		"todayBookings":    todayBookings,
		"pendingProposals": pendingProposals,
		"activeProjects":   activeProjects,
		"totalRevenue":     totalRevenue,
		"monthRevenue":     monthRevenue,
		"bookings": gin.H{
			"pending":   pendingBookings,
			"confirmed": confirmedBookings,
		},
		"proposals": gin.H{
			"pending":   pendingProposals,
			"confirmed": confirmedProposals,
		},
		"orders": gin.H{
			"pending": pendingOrders,
			"paid":    paidOrders,
		},
	})
}

// MerchantUploadAvatar 上传商家头像
func MerchantUploadAvatar(c *gin.Context) {
	userID := c.GetUint64("userId")

	file, err := c.FormFile("file")
	if err != nil {
		response.Error(c, 400, "请选择要上传的文件")
		return
	}

	// 文件大小限制 2MB
	if file.Size > 2*1024*1024 {
		response.Error(c, 400, "文件大小不能超过2MB")
		return
	}

	// 验证文件类型
	ext := strings.ToLower(filepath.Ext(file.Filename))
	if ext != ".jpg" && ext != ".jpeg" && ext != ".png" && ext != ".gif" {
		response.Error(c, 400, "只支持 jpg, png, gif 格式的图片")
		return
	}

	// 生成唯一文件名
	filename := fmt.Sprintf("avatar_%d_%d%s", userID, time.Now().UnixNano(), ext)
	uploadDir := "./uploads/avatars"

	// 确保目录存在
	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		response.Error(c, 500, "创建目录失败")
		return
	}

	// 保存文件
	dst := filepath.Join(uploadDir, filename)
	if err := c.SaveUploadedFile(file, dst); err != nil {
		response.Error(c, 500, "保存文件失败")
		return
	}

	// 生成访问URL (根据实际部署配置)
	avatarURL := fmt.Sprintf("/uploads/avatars/%s", filename)

	// 更新用户头像
	if err := repository.DB.Model(&model.User{}).Where("id = ?", userID).Update("avatar", avatarURL).Error; err != nil {
		response.Error(c, 500, "更新头像失败")
		return
	}

	response.Success(c, gin.H{
		"url":  imgutil.GetFullImageURL(avatarURL),
		"path": avatarURL,
	})
}

// MerchantUploadImage 上传通用图片 (案例/封面等)
func MerchantUploadImage(c *gin.Context) {
	providerID := c.GetUint64("providerId")

	file, err := c.FormFile("file")
	if err != nil {
		response.Error(c, 400, "请选择要上传的文件")
		return
	}

	// 文件大小限制 20MB
	if file.Size > 20*1024*1024 {
		response.Error(c, 400, "文件大小不能超过20MB")
		return
	}

	// 验证文件类型
	ext := strings.ToLower(filepath.Ext(file.Filename))
	if ext != ".jpg" && ext != ".jpeg" && ext != ".png" && ext != ".webp" &&
		ext != ".pdf" && ext != ".doc" && ext != ".docx" && ext != ".xls" && ext != ".xlsx" &&
		ext != ".ppt" && ext != ".pptx" && ext != ".txt" && ext != ".zip" && ext != ".rar" {
		response.Error(c, 400, "不支持的文件格式")
		return
	}

	// 生成唯一文件名
	filename := fmt.Sprintf("case_%d_%d%s", providerID, time.Now().UnixNano(), ext)
	uploadDir := "./uploads/cases"

	// 确保目录存在
	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		response.Error(c, 500, "创建目录失败")
		return
	}

	// 保存文件
	dst := filepath.Join(uploadDir, filename)
	if err := c.SaveUploadedFile(file, dst); err != nil {
		response.Error(c, 500, "保存文件失败")
		return
	}

	// 生成访问URL
	imageURL := fmt.Sprintf("/uploads/cases/%s", filename)

	response.Success(c, gin.H{
		"url":  imgutil.GetFullImageURL(imageURL),
		"path": imageURL,
	})
}

// MerchantGetProposal 获取方案详情
func MerchantGetProposal(c *gin.Context) {
	providerID := c.GetUint64("providerId")
	proposalID := parseUint64(c.Param("id"))

	var proposal model.Proposal
	if err := repository.DB.First(&proposal, proposalID).Error; err != nil {
		response.Error(c, 404, "方案不存在")
		return
	}

	if proposal.DesignerID != providerID {
		response.Error(c, 403, "无权查看此方案")
		return
	}

	type BookingWithUser struct {
		model.Booking
		UserNickname string `json:"userNickname"`
		UserPhone    string `json:"userPhone"`
		UserPublicID string `json:"userPublicId,omitempty"`
	}
	var bookingWithUser BookingWithUser
	if proposal.SourceType == model.ProposalSourceDemand {
		var demand model.Demand
		if err := repository.DB.First(&demand, proposal.DemandID).Error; err == nil {
			var user model.User
			_ = repository.DB.First(&user, demand.UserID).Error
			userNickname := user.Nickname
			if userNickname == "" && len(user.Phone) >= 4 {
				userNickname = "用户" + user.Phone[len(user.Phone)-4:]
			}
			bookingWithUser = BookingWithUser{
				Booking: model.Booking{
					Base:           model.Base{ID: demand.ID},
					Address:        demand.Address,
					Area:           demand.Area,
					HouseLayout:    "",
					RenovationType: demand.DemandType,
					BudgetRange:    fmt.Sprintf("%.0f-%.0f", demand.BudgetMin, demand.BudgetMax),
				},
				UserNickname: userNickname,
				UserPhone:    user.Phone,
				UserPublicID: user.PublicID,
			}
		}
	} else {
		var booking model.Booking
		repository.DB.First(&booking, proposal.BookingID)
		var user model.User
		repository.DB.First(&user, booking.UserID)
		userNickname := user.Nickname
		if userNickname == "" && len(user.Phone) >= 4 {
			userNickname = "用户" + user.Phone[len(user.Phone)-4:]
		}
		bookingIdentity := dto.NewUserIdentity(&user)
		if bookingIdentity.UserPublicID == "" {
			monitor.RecordPublicIDMissing("merchant_proposal_detail", bookingIdentity.UserID, "merchant_get_proposal")
		}
		bookingWithUser = BookingWithUser{
			Booking:      booking,
			UserNickname: userNickname,
			UserPhone:    user.Phone,
			UserPublicID: bookingIdentity.UserPublicID,
		}
	}

	response.Success(c, gin.H{
		"proposal": proposal,
		"booking":  bookingWithUser,
	})
}

// MerchantUpdateProposal 更新方案
func MerchantUpdateProposal(c *gin.Context) {
	providerID := c.GetUint64("providerId")
	proposalID := parseUint64(c.Param("id"))

	var proposal model.Proposal
	if err := repository.DB.First(&proposal, proposalID).Error; err != nil {
		response.Error(c, 404, "方案不存在")
		return
	}

	if proposal.DesignerID != providerID {
		response.Error(c, 403, "无权操作此方案")
		return
	}

	// 允许待确认或已拒绝状态的方案进行修改
	if proposal.Status != model.ProposalStatusPending && proposal.Status != model.ProposalStatusRejected {
		response.Error(c, 400, "只有待确认或已拒绝状态的方案才能修改")
		return
	}

	var input struct {
		Summary         string  `json:"summary"`
		DesignFee       float64 `json:"designFee"`
		ConstructionFee float64 `json:"constructionFee"`
		MaterialFee     float64 `json:"materialFee"`
		EstimatedDays   int     `json:"estimatedDays"`
		Attachments     string  `json:"attachments"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		response.Error(c, 400, "参数错误")
		return
	}

	updates := map[string]interface{}{
		"summary":          input.Summary,
		"design_fee":       input.DesignFee,
		"construction_fee": input.ConstructionFee,
		"material_fee":     input.MaterialFee,
		"estimated_days":   input.EstimatedDays,
		"attachments":      input.Attachments,
		"status":           model.ProposalStatusPending, // 重新提交后状态改为待确认
	}

	if err := repository.DB.Model(&proposal).Updates(updates).Error; err != nil {
		response.Error(c, 500, "更新失败")
		return
	}

	response.Success(c, gin.H{"status": "ok", "message": "方案已重新提交"})
}

// MerchantCancelProposal 取消/删除方案
func MerchantCancelProposal(c *gin.Context) {
	providerID := c.GetUint64("providerId")
	proposalID := parseUint64(c.Param("id"))

	var proposal model.Proposal
	if err := repository.DB.First(&proposal, proposalID).Error; err != nil {
		response.Error(c, 404, "方案不存在")
		return
	}

	if proposal.DesignerID != providerID {
		response.Error(c, 403, "无权操作此方案")
		return
	}

	// 只有待确认状态才能取消
	if proposal.Status != model.ProposalStatusPending {
		response.Error(c, 400, "只有待确认状态的方案才能取消")
		return
	}
	if err := repository.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Delete(&proposal).Error; err != nil {
			return err
		}
		if proposal.SourceType == model.ProposalSourceDemand && proposal.DemandMatchID > 0 {
			return tx.Model(&model.DemandMatch{}).
				Where("id = ?", proposal.DemandMatchID).
				Updates(map[string]interface{}{
					"status":      model.DemandMatchStatusAccepted,
					"proposal_id": 0,
				}).Error
		}
		return nil
	}); err != nil {
		response.Error(c, 500, "删除失败")
		return
	}

	response.Success(c, gin.H{"status": "ok"})
}
