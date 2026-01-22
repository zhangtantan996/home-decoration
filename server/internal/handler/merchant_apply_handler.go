package handler

import (
	"encoding/json"
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	"home-decoration-server/internal/service"
	"home-decoration-server/internal/utils/tencentim"
	"home-decoration-server/pkg/response"
	"home-decoration-server/pkg/utils"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// ==================== 商家入驻 Handler ====================

var regionService = &service.RegionService{}

// MerchantApplyInput 入驻申请输入
type MerchantApplyInput struct {
	Phone         string `json:"phone" binding:"required"`
	Code          string `json:"code" binding:"required"`
	ApplicantType string `json:"applicantType" binding:"required,oneof=personal studio company"`
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
	// 通用
	ServiceArea  []string `json:"serviceArea" binding:"required,min=1"`
	Styles       []string `json:"styles" binding:"required,min=1"`
	Introduction string   `json:"introduction"`
	// 作品集
	PortfolioCases []PortfolioCaseInput `json:"portfolioCases" binding:"required,min=3"`
}

// PortfolioCaseInput 作品集输入
type PortfolioCaseInput struct {
	Title  string   `json:"title" binding:"required"`
	Images []string `json:"images" binding:"required,min=1"`
	Style  string   `json:"style"`
	Area   string   `json:"area"`
}

// MerchantApply 提交商家入驻申请
func MerchantApply(c *gin.Context) {
	var input MerchantApplyInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.Error(c, 400, "参数错误: "+err.Error())
		return
	}

	// 1. 验证短信验证码（测试环境固定123456）
	if input.Code != "123456" {
		response.Error(c, 400, "验证码错误")
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

	// 4. 根据类型校验必填字段
	if input.ApplicantType == "company" {
		if input.LicenseNo == "" {
			response.Error(c, 400, "公司类型必须提供营业执照号")
			return
		}
		if len(input.LicenseNo) > 18 {
			response.Error(c, 400, "营业执照号长度不正确")
			return
		}
	}
	if input.ApplicantType == "studio" || input.ApplicantType == "company" {
		if !utils.ValidateCompanyName(input.CompanyName) {
			response.Error(c, 400, "名称长度应在2-100个字符之间")
			return
		}
	}

	// 5. 简介长度限制
	if len([]rune(input.Introduction)) > 500 {
		response.Error(c, 400, "个人/公司简介不能超过500个字符")
		return
	}

	// 6. 验证作品集数量
	if len(input.PortfolioCases) < 3 {
		response.Error(c, 400, "请至少添加3个作品案例")
		return
	}

	// 7. 验证服务区域代码是否有效（支持自动转换名称为代码）
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

	// 8. 序列化 JSON 字段
	serviceAreaJSON, _ := json.Marshal(serviceAreaCodes)
	stylesJSON, _ := json.Marshal(input.Styles)
	portfolioJSON, _ := json.Marshal(input.PortfolioCases)

	// 9. 创建申请记录
	application := model.MerchantApplication{
		Phone:          input.Phone,
		ApplicantType:  input.ApplicantType,
		RealName:       input.RealName,
		IDCardNo:       input.IDCardNo, // TODO: 生产环境需要加密
		IDCardFront:    input.IDCardFront,
		IDCardBack:     input.IDCardBack,
		CompanyName:    input.CompanyName,
		LicenseNo:      input.LicenseNo,
		LicenseImage:   input.LicenseImage,
		TeamSize:       input.TeamSize,
		OfficeAddress:  input.OfficeAddress,
		ServiceArea:    string(serviceAreaJSON),
		Styles:         string(stylesJSON),
		Introduction:   input.Introduction,
		PortfolioCases: string(portfolioJSON),
		Status:         0, // 待审核
	}

	if err := repository.DB.Create(&application).Error; err != nil {
		response.Error(c, 500, "提交失败: "+err.Error())
		return
	}

	// 10. TODO: 发送短信通知
	// sendSMS(input.Phone, "您的商家入驻申请已提交，预计1-3个工作日内完成审核")

	response.Success(c, gin.H{
		"applicationId": application.ID,
		"message":       "申请已提交，请等待审核",
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
	portfolioJSON, _ := json.Marshal(input.PortfolioCases)

	app.ApplicantType = input.ApplicantType
	app.RealName = input.RealName
	app.IDCardNo = input.IDCardNo
	app.IDCardFront = input.IDCardFront
	app.IDCardBack = input.IDCardBack
	app.CompanyName = input.CompanyName
	app.LicenseNo = input.LicenseNo
	app.LicenseImage = input.LicenseImage
	app.TeamSize = input.TeamSize
	app.OfficeAddress = input.OfficeAddress
	app.ServiceArea = string(serviceAreaJSON)
	app.Styles = string(stylesJSON)
	app.Introduction = input.Introduction
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
		query = query.Where("applicant_type = ?", appType)
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
	var serviceAreaCodes, styles []string
	var portfolioCases []PortfolioCaseInput
	json.Unmarshal([]byte(app.ServiceArea), &serviceAreaCodes)
	json.Unmarshal([]byte(app.Styles), &styles)
	json.Unmarshal([]byte(app.PortfolioCases), &portfolioCases)

	// 将服务区域代码转换为名称（用于前端展示）
	serviceAreaNames, _ := regionService.ConvertCodesToNames(serviceAreaCodes)

	response.Success(c, gin.H{
		"id":             app.ID,
		"phone":          app.Phone,
		"applicantType":  app.ApplicantType,
		"realName":       app.RealName,
		"idCardFront":    app.IDCardFront,
		"idCardBack":     app.IDCardBack,
		"companyName":    app.CompanyName,
		"licenseNo":      app.LicenseNo,
		"licenseImage":   app.LicenseImage,
		"teamSize":       app.TeamSize,
		"officeAddress":  app.OfficeAddress,
		"serviceArea":    serviceAreaNames, // 返回名称数组，方便前端展示
		"serviceAreaCodes": serviceAreaCodes, // 同时返回代码数组
		"styles":         styles,
		"introduction":   app.Introduction,
		"portfolioCases": portfolioCases,
		"status":         app.Status,
		"rejectReason":   app.RejectReason,
		"createdAt":      app.CreatedAt,
		"auditedAt":      app.AuditedAt,
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

	// 1. 创建 User
	user := model.User{
		Phone:    app.Phone,
		Nickname: app.RealName,
		UserType: 2, // 服务商
		Status:   1,
	}
	if err := tx.Create(&user).Error; err != nil {
		tx.Rollback()
		response.Error(c, 500, "创建用户失败: "+err.Error())
		return
	}

	// 2. 确定 ProviderType
	providerType := int8(1) // 默认设计师
	if app.ApplicantType == "company" {
		providerType = 2 // 公司
	}

	// 3. 创建 Provider
	provider := model.Provider{
		UserID:       user.ID,
		ProviderType: providerType,
		SubType:      app.ApplicantType,
		CompanyName:  app.CompanyName,
		LicenseNo:    app.LicenseNo,
		ServiceArea:  app.ServiceArea,
		Specialty:    app.Styles,
		ServiceIntro: app.Introduction,
		TeamSize:     app.TeamSize,
		Status:       1,
		Verified:     true,
	}
	if err := tx.Create(&provider).Error; err != nil {
		tx.Rollback()
		response.Error(c, 500, "创建服务商失败: "+err.Error())
		return
	}

	// 4. 迁移作品集到 ProviderCase
	var portfolioCases []PortfolioCaseInput
	json.Unmarshal([]byte(app.PortfolioCases), &portfolioCases)

	// 作品风格若未填写，回退到商家擅长风格的第一个选项，保证灵感库筛选字段有值。
	var fallbackStyles []string
	_ = json.Unmarshal([]byte(app.Styles), &fallbackStyles)
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
		tx.Create(&providerCase)
	}

	// 5. 创建服务设置
	serviceSetting := model.MerchantServiceSetting{
		ProviderID:    provider.ID,
		AcceptBooking: true,
	}
	tx.Create(&serviceSetting)

	// 6. 更新申请状态
	now := time.Now()
	app.Status = 1
	app.AuditedBy = adminID
	app.AuditedAt = &now
	app.UserID = user.ID
	app.ProviderID = provider.ID
	tx.Save(&app)

	tx.Commit()

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
