package handler

import (
	"encoding/json"
	"errors"
	"fmt"
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	"home-decoration-server/internal/service"
	"home-decoration-server/internal/utils/tencentim"
	"home-decoration-server/pkg/response"
	"home-decoration-server/pkg/utils"
	"log"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// ==================== 商家入驻 Handler ====================

var regionService = &service.RegionService{}

// MerchantApplyInput 入驻申请输入
type MerchantApplyInput struct {
	Phone         string `json:"phone" binding:"required"`
	Code          string `json:"code" binding:"required"`
	ApplicantType string `json:"applicantType"` // 兼容旧字段
	Role          string `json:"role"`          // designer, foreman, company
	EntityType    string `json:"entityType"`    // personal, company
	RealName      string `json:"realName" binding:"required"`
	IDCardNo      string `json:"idCardNo" binding:"required"`
	IDCardFront   string `json:"idCardFront" binding:"required"`
	IDCardBack    string `json:"idCardBack" binding:"required"`
	// 工作室/公司专属
	CompanyName   string `json:"companyName"`
	LicenseNo     string `json:"licenseNo"`
	LicenseImage  string `json:"licenseImage"`
	TeamSize      int    `json:"teamSize"`
	OfficeAddress string `json:"officeAddress"`
	// 工长专属
	YearsExperience int      `json:"yearsExperience"`
	WorkTypes       []string `json:"workTypes"`
	// 通用
	ServiceArea      []string           `json:"serviceArea" binding:"required,min=1"`
	Styles           []string           `json:"styles"`
	HighlightTags    []string           `json:"highlightTags"`
	Pricing          map[string]float64 `json:"pricing"`
	Introduction     string             `json:"introduction"`
	GraduateSchool   string             `json:"graduateSchool"`
	DesignPhilosophy string             `json:"designPhilosophy"`
	// 作品集
	PortfolioCases []PortfolioCaseInput `json:"portfolioCases" binding:"required,min=1"`
}

// PortfolioCaseInput 作品集输入
type PortfolioCaseInput struct {
	Title  string   `json:"title" binding:"required"`
	Images []string `json:"images" binding:"required,min=1"`
	Style  string   `json:"style"`
	Area   string   `json:"area"`
}

func normalizeApplyRoleAndEntity(input *MerchantApplyInput) error {
	role := strings.ToLower(strings.TrimSpace(input.Role))
	entityType := strings.ToLower(strings.TrimSpace(input.EntityType))
	applicantType := strings.ToLower(strings.TrimSpace(input.ApplicantType))

	if role == "" {
		switch applicantType {
		case "personal":
			role = "designer"
			entityType = "personal"
		case "studio":
			role = "designer"
			entityType = "company"
		case "company":
			role = "company"
			entityType = "company"
		case "foreman":
			role = "foreman"
		}
	}

	if role != "designer" && role != "foreman" && role != "company" {
		return fmt.Errorf("入驻角色无效")
	}

	if entityType == "" {
		if role == "company" {
			entityType = "company"
		} else {
			entityType = "personal"
		}
	}

	if entityType != "personal" && entityType != "company" {
		return fmt.Errorf("主体类型无效")
	}

	if role == "company" {
		entityType = "company"
	}

	compatApplicantType := "personal"
	switch role {
	case "designer":
		if entityType == "company" {
			compatApplicantType = "studio"
		} else {
			compatApplicantType = "personal"
		}
	case "foreman":
		compatApplicantType = "foreman"
	case "company":
		compatApplicantType = "company"
	}

	input.Role = role
	input.EntityType = entityType
	input.ApplicantType = compatApplicantType
	return nil
}

func validatePricingValue(pricing map[string]float64, key string) bool {
	if pricing == nil {
		return false
	}
	value, ok := pricing[key]
	return ok && value > 0
}

func parseJSONOrDelimitedSlice(raw string) []string {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return []string{}
	}

	var values []string
	if strings.HasPrefix(trimmed, "[") && strings.HasSuffix(trimmed, "]") {
		if err := json.Unmarshal([]byte(trimmed), &values); err == nil {
			return normalizeStringSlice(values)
		}
	}

	if strings.Contains(trimmed, " · ") {
		return normalizeStringSlice(strings.Split(trimmed, " · "))
	}
	if strings.Contains(trimmed, ",") {
		return normalizeStringSlice(strings.Split(trimmed, ","))
	}

	return normalizeStringSlice([]string{trimmed})
}

func parsePricingObject(raw string) map[string]float64 {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return map[string]float64{}
	}

	var pricing map[string]float64
	if err := json.Unmarshal([]byte(trimmed), &pricing); err != nil {
		return map[string]float64{}
	}
	return pricing
}

func getPricingRange(pricing map[string]float64) (float64, float64) {
	minVal := 0.0
	maxVal := 0.0

	for _, value := range pricing {
		if value <= 0 {
			continue
		}
		if minVal == 0 || value < minVal {
			minVal = value
		}
		if value > maxVal {
			maxVal = value
		}
	}

	return minVal, maxVal
}

func normalizeApprovedApplicationMeta(app *model.MerchantApplication) (int8, string, string, string, error) {
	role := strings.ToLower(strings.TrimSpace(app.Role))
	entityType := strings.ToLower(strings.TrimSpace(app.EntityType))
	applicantType := strings.ToLower(strings.TrimSpace(app.ApplicantType))

	if role == "" {
		switch applicantType {
		case "studio":
			role = "designer"
			entityType = "company"
		case "company":
			role = "company"
			entityType = "company"
		case "foreman":
			role = "foreman"
		default:
			role = "designer"
			entityType = "personal"
		}
	}

	if entityType == "" {
		if role == "company" {
			entityType = "company"
		} else if applicantType == "studio" {
			entityType = "company"
		} else {
			entityType = "personal"
		}
	}

	if entityType != "personal" && entityType != "company" {
		return 0, "", "", "", fmt.Errorf("主体类型无效")
	}

	var (
		providerType int8
		subType      string
		compatType   string
	)

	switch role {
	case "designer":
		providerType = 1
		if entityType == "company" {
			subType = "studio"
			compatType = "studio"
		} else {
			subType = "personal"
			compatType = "personal"
		}
	case "foreman":
		providerType = 3
		subType = "foreman"
		compatType = "foreman"
	case "company":
		providerType = 2
		entityType = "company"
		subType = "company"
		compatType = "company"
	default:
		return 0, "", "", "", fmt.Errorf("入驻角色无效")
	}

	return providerType, subType, entityType, compatType, nil
}

func encryptSensitiveOrPlain(raw string) string {
	value := strings.TrimSpace(raw)
	if value == "" {
		return ""
	}

	if strings.TrimSpace(os.Getenv("ENCRYPTION_KEY")) == "" {
		return value
	}

	encrypted, err := utils.Encrypt(value)
	if err != nil {
		log.Printf("[MerchantApply] encrypt failed, fallback plain value: %v", err)
		return value
	}
	return encrypted
}

func normalizeStringSlice(values []string) []string {
	result := make([]string, 0, len(values))
	seen := make(map[string]struct{}, len(values))

	for _, item := range values {
		trimmed := strings.TrimSpace(item)
		if trimmed == "" {
			continue
		}
		if _, exists := seen[trimmed]; exists {
			continue
		}
		seen[trimmed] = struct{}{}
		result = append(result, trimmed)
	}

	return result
}

func validatePortfolioCases(role string, cases []PortfolioCaseInput) error {
	if len(cases) == 0 {
		return fmt.Errorf("请至少添加1个案例")
	}

	for index := range cases {
		cases[index].Title = strings.TrimSpace(cases[index].Title)
		cases[index].Style = strings.TrimSpace(cases[index].Style)
		cases[index].Area = strings.TrimSpace(cases[index].Area)
		cases[index].Images = normalizeStringSlice(cases[index].Images)

		if cases[index].Title == "" {
			return fmt.Errorf("第%d个案例缺少标题", index+1)
		}
		if len(cases[index].Images) == 0 {
			return fmt.Errorf("第%d个案例至少上传1张图片", index+1)
		}

		switch role {
		case "designer":
			if len(cases[index].Images) < 3 || len(cases[index].Images) > 6 {
				return fmt.Errorf("设计师第%d个案例需上传3-6张图片", index+1)
			}
		case "foreman":
			if len(cases[index].Images) < 8 || len(cases[index].Images) > 12 {
				return fmt.Errorf("工长第%d个施工案例需上传8-12张图片", index+1)
			}
		case "company":
			if len(cases[index].Images) < 3 {
				return fmt.Errorf("装修公司第%d个案例至少上传3张图片", index+1)
			}
		}
	}

	return nil
}

func validateMerchantApplyBusinessFields(input *MerchantApplyInput) error {
	if err := normalizeApplyRoleAndEntity(input); err != nil {
		return err
	}

	input.Styles = normalizeStringSlice(input.Styles)
	input.WorkTypes = normalizeStringSlice(input.WorkTypes)
	input.HighlightTags = normalizeStringSlice(input.HighlightTags)
	input.GraduateSchool = strings.TrimSpace(input.GraduateSchool)
	input.DesignPhilosophy = strings.TrimSpace(input.DesignPhilosophy)
	input.Introduction = strings.TrimSpace(input.Introduction)

	if len([]rune(input.Introduction)) > 5000 {
		return fmt.Errorf("个人/公司简介不能超过5000个字符")
	}

	if len([]rune(input.DesignPhilosophy)) > 5000 {
		return fmt.Errorf("设计理念不能超过5000个字符")
	}

	if err := validatePortfolioCases(input.Role, input.PortfolioCases); err != nil {
		return err
	}

	if input.EntityType == "company" {
		if strings.TrimSpace(input.LicenseNo) == "" {
			return fmt.Errorf("公司主体必须提供营业执照号")
		}
		if len(strings.TrimSpace(input.LicenseNo)) > 18 {
			return fmt.Errorf("营业执照号长度不正确")
		}
		if strings.TrimSpace(input.LicenseImage) == "" {
			return fmt.Errorf("公司主体必须上传营业执照图片")
		}
	}

	if input.EntityType == "company" || input.Role == "company" {
		if !utils.ValidateCompanyName(input.CompanyName) {
			return fmt.Errorf("名称长度应在2-100个字符之间")
		}
	}

	switch input.Role {
	case "designer":
		if len(input.Styles) < 1 || len(input.Styles) > 3 {
			return fmt.Errorf("设计师擅长风格需选择1-3个")
		}
		if len(input.PortfolioCases) < 3 {
			return fmt.Errorf("设计师请至少添加3个作品案例")
		}
		if !validatePricingValue(input.Pricing, "flat") || !validatePricingValue(input.Pricing, "duplex") || !validatePricingValue(input.Pricing, "other") {
			return fmt.Errorf("设计师需填写平层/复式/其他三个报价（元/㎡）")
		}
	case "foreman":
		if input.YearsExperience <= 0 || input.YearsExperience > 50 {
			return fmt.Errorf("工长类型需要填写1-50年的施工经验")
		}
		if len(input.WorkTypes) < 1 {
			return fmt.Errorf("工长类型至少选择1个工种")
		}
		if len(input.HighlightTags) < 1 || len(input.HighlightTags) > 3 {
			return fmt.Errorf("工长施工亮点需选择1-3个")
		}
		if len(input.PortfolioCases) < 3 {
			return fmt.Errorf("工长类型请至少添加3个施工案例")
		}
		if !validatePricingValue(input.Pricing, "perSqm") {
			return fmt.Errorf("工长需填写施工报价（元/㎡）")
		}
	case "company":
		if len(input.PortfolioCases) < 3 {
			return fmt.Errorf("装修公司请至少添加3个案例")
		}
		if !validatePricingValue(input.Pricing, "fullPackage") || !validatePricingValue(input.Pricing, "halfPackage") {
			return fmt.Errorf("装修公司需填写全包/半包报价（元/㎡）")
		}
	}

	return nil
}

// MerchantApply 提交商家入驻申请
func MerchantApply(c *gin.Context) {
	var input MerchantApplyInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.Error(c, 400, "参数错误: "+err.Error())
		return
	}

	// 1. 验证短信验证码
	if err := service.VerifySMSCode(input.Phone, service.SMSPurposeIdentityApply, input.Code); err != nil {
		response.Error(c, 400, err.Error())
		return
	}

	// 2. 严格校验输入格式
	if !utils.ValidatePhone(input.Phone) {
		response.Error(c, 400, "手机号格式不正确")
		return
	}
	if !utils.ValidateRealName(input.RealName) {
		response.Error(c, 400, "姓名长度应在2-20个字符之间")
		return
	}
	if !utils.ValidateIDCard(input.IDCardNo) {
		response.Error(c, 400, "身份证号格式不正确")
		return
	}

	if err := validateMerchantApplyBusinessFields(&input); err != nil {
		response.Error(c, 400, err.Error())
		return
	}

	// 3. 检查是否已有申请
	var existingApp model.MerchantApplication
	if err := repository.DB.Where("phone = ? AND status IN (0, 1)", input.Phone).First(&existingApp).Error; err == nil {
		if existingApp.Status == 0 {
			response.Error(c, 400, "您已提交申请，请等待审核")
		} else {
			response.Error(c, 400, "您已是入驻商家，请直接登录")
		}
		return
	}

	// 4. 验证服务区域代码是否有效（支持自动转换名称为代码）
	var serviceAreaCodes []string
	if err := regionService.ValidateRegionCodes(input.ServiceArea); err != nil {
		// 如果验证失败，尝试将名称转换为代码（兼容旧数据）
		codes, convertErr := regionService.ConvertNamesToCodes(input.ServiceArea)
		if convertErr != nil {
			response.Error(c, 400, "服务区域验证失败: "+err.Error())
			return
		}
		// 转换成功后再次验证代码
		if err := regionService.ValidateRegionCodes(codes); err != nil {
			response.Error(c, 400, "服务区域代码验证失败: "+err.Error())
			return
		}
		serviceAreaCodes = codes
	} else {
		// 如果是代码格式，直接使用
		serviceAreaCodes = input.ServiceArea
	}

	// 5. 序列化 JSON 字段
	serviceAreaJSON, _ := json.Marshal(serviceAreaCodes)
	stylesJSON, _ := json.Marshal(input.Styles)
	workTypesJSON, _ := json.Marshal(input.WorkTypes)
	highlightTagsJSON, _ := json.Marshal(input.HighlightTags)
	pricingJSON, _ := json.Marshal(input.Pricing)
	portfolioJSON, _ := json.Marshal(input.PortfolioCases)

	tx := repository.DB.Begin()

	// 6. 入驻内隐式建号（或复用已有用户）
	var user model.User
	if err := tx.Where("phone = ?", input.Phone).First(&user).Error; err != nil {
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			tx.Rollback()
			response.Error(c, 500, "提交失败: 查询用户异常")
			return
		}

		user = model.User{
			Phone:    input.Phone,
			Nickname: input.RealName,
			UserType: 1,
			Status:   1,
		}
		if err := tx.Create(&user).Error; err != nil {
			tx.Rollback()
			response.Error(c, 500, "提交失败: 创建账号失败")
			return
		}
	}

	// 7. 单一商家身份限制：已有商家身份需走变更申请
	var existingProvider model.Provider
	if err := tx.Where("user_id = ?", user.ID).First(&existingProvider).Error; err == nil {
		tx.Rollback()
		c.JSON(200, response.Response{
			Code:    409,
			Message: "您已拥有商家身份，如需切换角色请提交角色变更申请",
			Data: gin.H{
				"nextAction": "CHANGE_ROLE",
				"userId":     user.ID,
			},
		})
		return
	}

	// 8. 创建申请记录
	application := model.MerchantApplication{
		UserID:           user.ID,
		Phone:            input.Phone,
		ApplicantType:    input.ApplicantType,
		Role:             input.Role,
		EntityType:       input.EntityType,
		RealName:         input.RealName,
		IDCardNo:         encryptSensitiveOrPlain(input.IDCardNo),
		IDCardFront:      input.IDCardFront,
		IDCardBack:       input.IDCardBack,
		CompanyName:      input.CompanyName,
		LicenseNo:        encryptSensitiveOrPlain(input.LicenseNo),
		LicenseImage:     input.LicenseImage,
		TeamSize:         input.TeamSize,
		OfficeAddress:    input.OfficeAddress,
		YearsExperience:  input.YearsExperience,
		WorkTypes:        string(workTypesJSON),
		ServiceArea:      string(serviceAreaJSON),
		Styles:           string(stylesJSON),
		HighlightTags:    string(highlightTagsJSON),
		PricingJSON:      string(pricingJSON),
		Introduction:     input.Introduction,
		GraduateSchool:   input.GraduateSchool,
		DesignPhilosophy: input.DesignPhilosophy,
		PortfolioCases:   string(portfolioJSON),
		Status:           0, // 待审核
	}

	if err := tx.Create(&application).Error; err != nil {
		tx.Rollback()
		response.Error(c, 500, "提交失败: "+err.Error())
		return
	}

	tx.Commit()

	// 9. TODO: 发送短信通知
	// sendSMS(input.Phone, "您的商家入驻申请已提交，预计1-3个工作日内完成审核")

	response.Success(c, gin.H{
		"applicationId": application.ID,
		"userCreated":   true,
		"message":       "申请已提交，账号已创建，审核通过后可登录商家中心",
	})
}

// MerchantApplyStatus 查询入驻申请状态
func MerchantApplyStatus(c *gin.Context) {
	phone := c.Param("phone")
	if phone == "" {
		response.Error(c, 400, "手机号不能为空")
		return
	}

	var app model.MerchantApplication
	if err := repository.DB.Where("phone = ?", phone).Order("created_at DESC").First(&app).Error; err != nil {
		response.Error(c, 404, "未找到申请记录")
		return
	}

	statusText := map[int8]string{
		0: "待审核",
		1: "审核通过",
		2: "审核拒绝",
	}

	response.Success(c, gin.H{
		"applicationId": app.ID,
		"applicantType": app.ApplicantType,
		"role":          app.Role,
		"entityType":    app.EntityType,
		"status":        app.Status,
		"statusText":    statusText[app.Status],
		"rejectReason":  app.RejectReason,
		"createdAt":     app.CreatedAt,
		"auditedAt":     app.AuditedAt,
	})
}

// MerchantResubmit 重新提交入驻申请
func MerchantResubmit(c *gin.Context) {
	appID := parseUint64(c.Param("id"))

	var input MerchantApplyInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.Error(c, 400, "参数错误: "+err.Error())
		return
	}

	// 查找原申请
	var app model.MerchantApplication
	if err := repository.DB.First(&app, appID).Error; err != nil {
		response.Error(c, 404, "申请不存在")
		return
	}

	// 只有被拒绝的申请可以重新提交
	if app.Status != 2 {
		response.Error(c, 400, "该申请状态不允许重新提交")
		return
	}

	// 验证手机号一致
	if app.Phone != input.Phone {
		response.Error(c, 400, "手机号与原申请不一致")
		return
	}

	if err := normalizeApplyRoleAndEntity(&input); err != nil {
		response.Error(c, 400, err.Error())
		return
	}

	if err := validateMerchantApplyBusinessFields(&input); err != nil {
		response.Error(c, 400, err.Error())
		return
	}

	// 验证服务区域代码（支持自动转换名称为代码）
	var serviceAreaCodes []string
	if err := regionService.ValidateRegionCodes(input.ServiceArea); err != nil {
		// 如果验证失败，尝试将名称转换为代码（兼容旧数据）
		codes, convertErr := regionService.ConvertNamesToCodes(input.ServiceArea)
		if convertErr != nil {
			response.Error(c, 400, "服务区域验证失败: "+err.Error())
			return
		}
		// 转换成功后再次验证代码
		if err := regionService.ValidateRegionCodes(codes); err != nil {
			response.Error(c, 400, "服务区域代码验证失败: "+err.Error())
			return
		}
		serviceAreaCodes = codes
	} else {
		// 如果是代码格式，直接使用
		serviceAreaCodes = input.ServiceArea
	}

	// 更新申请信息
	serviceAreaJSON, _ := json.Marshal(serviceAreaCodes)
	stylesJSON, _ := json.Marshal(input.Styles)
	workTypesJSON, _ := json.Marshal(input.WorkTypes)
	highlightTagsJSON, _ := json.Marshal(input.HighlightTags)
	pricingJSON, _ := json.Marshal(input.Pricing)
	portfolioJSON, _ := json.Marshal(input.PortfolioCases)

	app.Role = input.Role
	app.EntityType = input.EntityType
	app.ApplicantType = input.ApplicantType
	app.RealName = input.RealName
	app.IDCardNo = encryptSensitiveOrPlain(input.IDCardNo)
	app.IDCardFront = input.IDCardFront
	app.IDCardBack = input.IDCardBack
	app.CompanyName = input.CompanyName
	app.LicenseNo = encryptSensitiveOrPlain(input.LicenseNo)
	app.LicenseImage = input.LicenseImage
	app.TeamSize = input.TeamSize
	app.OfficeAddress = input.OfficeAddress
	app.YearsExperience = input.YearsExperience
	app.WorkTypes = string(workTypesJSON)
	app.ServiceArea = string(serviceAreaJSON)
	app.Styles = string(stylesJSON)
	app.HighlightTags = string(highlightTagsJSON)
	app.PricingJSON = string(pricingJSON)
	app.Introduction = input.Introduction
	app.GraduateSchool = input.GraduateSchool
	app.DesignPhilosophy = input.DesignPhilosophy
	app.PortfolioCases = string(portfolioJSON)
	app.Status = 0 // 重置为待审核
	app.RejectReason = ""
	app.AuditedBy = 0
	app.AuditedAt = nil

	if err := repository.DB.Save(&app).Error; err != nil {
		response.Error(c, 500, "重新提交失败")
		return
	}

	response.Success(c, gin.H{
		"applicationId": app.ID,
		"message":       "已重新提交，请等待审核",
	})
}

// ==================== Admin 审核入驻申请 ====================

// AdminListApplications 获取入驻申请列表
func AdminListApplications(c *gin.Context) {
	var apps []model.MerchantApplication

	query := repository.DB.Order("created_at DESC")

	// 筛选状态
	if status := c.Query("status"); status != "" {
		query = query.Where("status = ?", status)
	}

	// 筛选类型
	if appType := c.Query("type"); appType != "" {
		appType = strings.ToLower(strings.TrimSpace(appType))
		switch appType {
		case "designer", "foreman", "company":
			query = query.Where("role = ?", appType)
		default:
			query = query.Where("applicant_type = ?", appType)
		}
	}

	// 筛选角色
	if role := c.Query("role"); role != "" {
		query = query.Where("role = ?", strings.ToLower(strings.TrimSpace(role)))
	}

	// 筛选主体
	if entityType := c.Query("entityType"); entityType != "" {
		query = query.Where("entity_type = ?", strings.ToLower(strings.TrimSpace(entityType)))
	}

	// 搜索
	if keyword := c.Query("keyword"); keyword != "" {
		query = query.Where("phone LIKE ? OR real_name LIKE ? OR company_name LIKE ?",
			"%"+keyword+"%", "%"+keyword+"%", "%"+keyword+"%")
	}

	if err := query.Find(&apps).Error; err != nil {
		response.Error(c, 500, "查询失败")
		return
	}

	response.Success(c, gin.H{
		"list":  apps,
		"total": len(apps),
	})
}

// AdminGetApplication 获取入驻申请详情
func AdminGetApplication(c *gin.Context) {
	appID := parseUint64(c.Param("id"))

	var app model.MerchantApplication
	if err := repository.DB.First(&app, appID).Error; err != nil {
		response.Error(c, 404, "申请不存在")
		return
	}

	// 解析 JSON 字段
	var serviceAreaCodes, styles, workTypes, highlightTags []string
	var pricing map[string]float64
	var portfolioCases []PortfolioCaseInput
	json.Unmarshal([]byte(app.ServiceArea), &serviceAreaCodes)
	json.Unmarshal([]byte(app.Styles), &styles)
	json.Unmarshal([]byte(app.WorkTypes), &workTypes)
	json.Unmarshal([]byte(app.HighlightTags), &highlightTags)
	json.Unmarshal([]byte(app.PricingJSON), &pricing)
	json.Unmarshal([]byte(app.PortfolioCases), &portfolioCases)

	// 将服务区域代码转换为名称（用于前端展示）
	serviceAreaNames, _ := regionService.ConvertCodesToNames(serviceAreaCodes)

	response.Success(c, gin.H{
		"id":               app.ID,
		"phone":            app.Phone,
		"applicantType":    app.ApplicantType,
		"role":             app.Role,
		"entityType":       app.EntityType,
		"realName":         app.RealName,
		"idCardFront":      app.IDCardFront,
		"idCardBack":       app.IDCardBack,
		"companyName":      app.CompanyName,
		"licenseNo":        app.LicenseNo,
		"licenseImage":     app.LicenseImage,
		"teamSize":         app.TeamSize,
		"yearsExperience":  app.YearsExperience,
		"workTypes":        workTypes,
		"officeAddress":    app.OfficeAddress,
		"serviceArea":      serviceAreaNames, // 返回名称数组，方便前端展示
		"serviceAreaCodes": serviceAreaCodes, // 同时返回代码数组
		"styles":           styles,
		"highlightTags":    highlightTags,
		"pricing":          pricing,
		"introduction":     app.Introduction,
		"graduateSchool":   app.GraduateSchool,
		"designPhilosophy": app.DesignPhilosophy,
		"portfolioCases":   portfolioCases,
		"status":           app.Status,
		"rejectReason":     app.RejectReason,
		"createdAt":        app.CreatedAt,
		"auditedAt":        app.AuditedAt,
	})
}

// AdminApproveApplication 审核通过入驻申请
func AdminApproveApplication(c *gin.Context) {
	appID := parseUint64(c.Param("id"))
	adminID := c.GetUint64("adminId")

	var app model.MerchantApplication
	if err := repository.DB.First(&app, appID).Error; err != nil {
		response.Error(c, 404, "申请不存在")
		return
	}

	if app.Status != 0 {
		response.Error(c, 400, "该申请已处理")
		return
	}

	tx := repository.DB.Begin()

	// 1. 查询现有 User（优先按 user_id，兼容按手机号兜底）
	var user model.User
	userQueryErr := gorm.ErrRecordNotFound
	if app.UserID > 0 {
		userQueryErr = tx.First(&user, app.UserID).Error
	}
	if errors.Is(userQueryErr, gorm.ErrRecordNotFound) {
		userQueryErr = tx.Where("phone = ?", app.Phone).First(&user).Error
	}
	if userQueryErr != nil {
		tx.Rollback()
		response.Error(c, 400, "用户不存在，请先使用该手机号注册账号")
		return
	}

	// 检查用户状态
	if user.Status != 1 {
		tx.Rollback()
		response.Error(c, 400, "该账号已被禁用")
		return
	}

	// 2. 解析申请角色映射
	providerType, subType, entityType, compatApplicantType, normalizeErr := normalizeApprovedApplicationMeta(&app)
	if normalizeErr != nil {
		tx.Rollback()
		response.Error(c, 400, normalizeErr.Error())
		return
	}

	// 2.1 单一商家身份限制（防止重复创建）
	var existingProvider model.Provider
	if err := tx.Where("user_id = ?", user.ID).First(&existingProvider).Error; err == nil {
		tx.Rollback()
		response.Error(c, 409, "该用户已拥有商家身份，无法重复审核通过")
		return
	}

	workTypes := parseJSONOrDelimitedSlice(app.WorkTypes)
	styles := parseJSONOrDelimitedSlice(app.Styles)
	highlightTags := normalizeStringSlice(parseJSONOrDelimitedSlice(app.HighlightTags))
	pricing := parsePricingObject(app.PricingJSON)
	priceMin, priceMax := getPricingRange(pricing)

	workTypesJSON, _ := json.Marshal(workTypes)
	highlightTagsJSON, _ := json.Marshal(highlightTags)
	pricingJSON, _ := json.Marshal(pricing)

	specialty := strings.Join(styles, " · ")
	if providerType == 3 && len(workTypes) > 0 {
		specialty = strings.Join(workTypes, " · ")
	}

	// 3. 创建 Provider
	provider := model.Provider{
		UserID:           user.ID,
		ProviderType:     providerType,
		SubType:          subType,
		EntityType:       entityType,
		CompanyName:      app.CompanyName,
		LicenseNo:        app.LicenseNo,
		ServiceArea:      app.ServiceArea,
		Specialty:        specialty,
		WorkTypes:        string(workTypesJSON),
		HighlightTags:    string(highlightTagsJSON),
		PricingJSON:      string(pricingJSON),
		GraduateSchool:   app.GraduateSchool,
		DesignPhilosophy: app.DesignPhilosophy,
		YearsExperience:  app.YearsExperience,
		ServiceIntro:     app.Introduction,
		TeamSize:         app.TeamSize,
		OfficeAddress:    app.OfficeAddress,
		PriceMin:         priceMin,
		PriceMax:         priceMax,
		Status:           1,
		Verified:         true,
	}
	if err := tx.Create(&provider).Error; err != nil {
		tx.Rollback()
		response.Error(c, 500, "创建服务商失败: "+err.Error())
		return
	}

	// 3.1. 创建 user_identities 记录（多身份系统）
	now := time.Now()
	var identity model.UserIdentity
	if err := tx.Where("user_id = ? AND identity_type = ?", user.ID, "provider").First(&identity).Error; err != nil {
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			tx.Rollback()
			response.Error(c, 500, "创建身份记录失败: "+err.Error())
			return
		}

		identity = model.UserIdentity{
			UserID:        user.ID,
			IdentityType:  "provider",
			IdentityRefID: &provider.ID,
			Status:        1,
			Verified:      true,
			VerifiedAt:    &now,
			VerifiedBy:    &adminID,
		}
		if err := tx.Create(&identity).Error; err != nil {
			tx.Rollback()
			response.Error(c, 500, "创建身份记录失败: "+err.Error())
			return
		}
	} else {
		identity.IdentityRefID = &provider.ID
		identity.Status = 1
		identity.Verified = true
		identity.VerifiedAt = &now
		identity.VerifiedBy = &adminID
		if err := tx.Save(&identity).Error; err != nil {
			tx.Rollback()
			response.Error(c, 500, "更新身份记录失败: "+err.Error())
			return
		}
	}

	// 4. 迁移作品集到 ProviderCase
	var portfolioCases []PortfolioCaseInput
	json.Unmarshal([]byte(app.PortfolioCases), &portfolioCases)

	// 作品风格若未填写，回退到商家擅长风格的第一个选项，保证灵感库筛选字段有值。
	fallbackStyles := styles
	fallbackStyle := ""
	if len(fallbackStyles) > 0 {
		fallbackStyle = strings.TrimSpace(fallbackStyles[0])
	}

	for i, pc := range portfolioCases {
		imagesJSON, _ := json.Marshal(pc.Images)
		coverImage := ""
		if len(pc.Images) > 0 {
			coverImage = pc.Images[0]
		}

		style := strings.TrimSpace(pc.Style)
		if style == "" {
			style = fallbackStyle
		}
		if style == "" {
			// 保底，避免出现空风格导致灵感库筛选无效。
			style = "现代简约"
		}
		layout := "其他"

		providerCase := model.ProviderCase{
			ProviderID: provider.ID,
			Title:      pc.Title,
			CoverImage: coverImage,
			Style:      style,
			Layout:     layout,
			Area:       pc.Area,
			Price:      0,
			Images:     string(imagesJSON),
			SortOrder:  i,
			// 审核通过后生成的作品默认可在灵感库展示。
			ShowInInspiration: true,
		}
		if err := tx.Create(&providerCase).Error; err != nil {
			tx.Rollback()
			response.Error(c, 500, "迁移案例失败: "+err.Error())
			return
		}
	}

	// 5. 创建服务设置
	serviceSetting := model.MerchantServiceSetting{
		ProviderID:    provider.ID,
		AcceptBooking: true,
	}
	if err := tx.Create(&serviceSetting).Error; err != nil {
		tx.Rollback()
		response.Error(c, 500, "创建服务设置失败: "+err.Error())
		return
	}

	// 6. 更新申请状态
	normalizedRole := "designer"
	if providerType == 3 {
		normalizedRole = "foreman"
	} else if providerType == 2 {
		normalizedRole = "company"
	}
	app.Role = normalizedRole
	app.EntityType = entityType
	app.ApplicantType = compatApplicantType
	app.Status = 1
	app.AuditedBy = adminID
	app.AuditedAt = &now
	app.UserID = user.ID
	app.ProviderID = provider.ID
	if err := tx.Save(&app).Error; err != nil {
		tx.Rollback()
		response.Error(c, 500, "更新申请状态失败: "+err.Error())
		return
	}

	if err := tx.Commit().Error; err != nil {
		response.Error(c, 500, "审核提交失败: "+err.Error())
		return
	}

	// 同步商家到腾讯云 IM（异步）
	go func() {
		displayName := provider.CompanyName
		if displayName == "" {
			displayName = user.Nickname
		}
		if err := tencentim.SyncUserToIM(user.ID, displayName, ""); err != nil {
			// 仅记录日志，不影响主流程
			// log.Printf("[TencentIM] 商家同步失败: userID=%d, err=%v", user.ID, err)
		}
	}()

	// TODO: 发送短信通知
	// sendSMS(app.Phone, "恭喜！您的商家入驻申请已通过审核，请使用手机号登录商家中心")

	response.Success(c, gin.H{
		"message":    "审核通过",
		"userId":     user.ID,
		"providerId": provider.ID,
	})
}

// AdminRejectApplication 拒绝入驻申请
func AdminRejectApplication(c *gin.Context) {
	appID := parseUint64(c.Param("id"))
	adminID := c.GetUint64("adminId")

	var input struct {
		Reason string `json:"reason" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		response.Error(c, 400, "请填写拒绝原因")
		return
	}

	var app model.MerchantApplication
	if err := repository.DB.First(&app, appID).Error; err != nil {
		response.Error(c, 404, "申请不存在")
		return
	}

	if app.Status != 0 {
		response.Error(c, 400, "该申请已处理")
		return
	}

	now := time.Now()
	app.Status = 2
	app.RejectReason = input.Reason
	app.AuditedBy = adminID
	app.AuditedAt = &now

	if err := repository.DB.Save(&app).Error; err != nil {
		response.Error(c, 500, "操作失败")
		return
	}

	// TODO: 发送短信通知
	// sendSMS(app.Phone, "您的商家入驻申请未通过审核，原因："+input.Reason)

	response.Success(c, gin.H{"message": "已拒绝"})
}
