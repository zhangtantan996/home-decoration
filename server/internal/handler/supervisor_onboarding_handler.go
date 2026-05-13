package handler

import (
	"encoding/json"
	"strings"
	"time"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	"home-decoration-server/internal/service"
	"home-decoration-server/pkg/response"
	"home-decoration-server/pkg/utils"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// ==================== 监理入驻申请（公网，未登录） ====================

const (
	supervisorApplicationStatusPending  = 0
	supervisorApplicationStatusApproved = 1
	supervisorApplicationStatusRejected = 2
)

type supervisorOnboardingForm struct {
	RealName           string   `json:"realName"`
	CityCode           string   `json:"cityCode"`
	ServiceArea        []string `json:"serviceArea"`
	Certifications     []string `json:"certifications"`
	IDNo               string   `json:"idNo"`
	OrgName            string   `json:"orgName"`
	AgreementConfirmed bool     `json:"agreementConfirmed"`
}

func normalizeSupervisorStringSlice(values []string) []string {
	out := make([]string, 0, len(values))
	seen := make(map[string]struct{}, len(values))
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed == "" {
			continue
		}
		if _, ok := seen[trimmed]; ok {
			continue
		}
		seen[trimmed] = struct{}{}
		out = append(out, trimmed)
	}
	return out
}

func parseAndValidateSupervisorOnboardingForm(raw json.RawMessage) (*supervisorOnboardingForm, string, string) {
	if len(raw) == 0 || !json.Valid(raw) {
		return nil, "", "提交资料格式错误"
	}

	var form supervisorOnboardingForm
	if err := json.Unmarshal(raw, &form); err != nil {
		return nil, "", "提交资料格式错误"
	}

	form.RealName = strings.TrimSpace(form.RealName)
	form.CityCode = strings.TrimSpace(form.CityCode)
	form.IDNo = strings.TrimSpace(form.IDNo)
	form.OrgName = strings.TrimSpace(form.OrgName)
	form.ServiceArea = normalizeSupervisorStringSlice(form.ServiceArea)
	form.Certifications = normalizeSupervisorStringSlice(form.Certifications)

	if form.RealName == "" {
		return nil, "", "请填写真实姓名"
	}
	if form.CityCode == "" {
		return nil, "", "请选择主要服务城市"
	}
	if form.IDNo == "" || len(form.IDNo) < 15 || len(form.IDNo) > 18 {
		return nil, "", "请填写有效证件号码"
	}
	if len(form.ServiceArea) == 0 {
		return nil, "", "请选择可服务城市"
	}
	if len(form.Certifications) == 0 {
		return nil, "", "请填写至少一项资质材料"
	}
	if !form.AgreementConfirmed {
		return nil, "", "请确认并同意监理入驻规则"
	}

	normalized, err := json.Marshal(form)
	if err != nil {
		return nil, "", "提交资料格式错误"
	}
	return &form, string(normalized), ""
}

func hasApprovedSupervisorOnboarding(phone string) (bool, uint64, error) {
	phone = strings.TrimSpace(phone)
	if phone == "" {
		return false, 0, nil
	}

	var accountCount int64
	if err := repository.DB.Model(&model.SupervisorAccount{}).Where("phone = ?", phone).Count(&accountCount).Error; err != nil {
		return false, 0, err
	}
	if accountCount > 0 {
		var approvedApp model.SupervisorApplication
		if err := repository.DB.Where("phone = ? AND status = ?", phone, supervisorApplicationStatusApproved).Order("id DESC").First(&approvedApp).Error; err == nil {
			return true, approvedApp.ID, nil
		}
		return true, 0, nil
	}

	var approvedApp model.SupervisorApplication
	if err := repository.DB.Where("phone = ? AND status = ?", phone, supervisorApplicationStatusApproved).Order("id DESC").First(&approvedApp).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return false, 0, nil
		}
		return false, 0, err
	}
	return true, approvedApp.ID, nil
}

// SendSupervisorOnboardingCode 发送监理入驻验证码
func SendSupervisorOnboardingCode(c *gin.Context) {
	var req struct {
		Phone string `json:"phone" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请输入手机号")
		return
	}

	phone := strings.TrimSpace(req.Phone)
	if !utils.ValidatePhone(phone) {
		response.BadRequest(c, "手机号格式不正确")
		return
	}

	// 检验是否在白名单
	var whitelist model.SupervisorPhoneWhitelist
	if err := repository.DB.Where("phone = ? AND status = 1", phone).First(&whitelist).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			response.Error(c, 403, "该手机号暂无监理入驻资格，请联系管理员")
			return
		}
		response.ServerError(c, "校验失败")
		return
	}

	// 检查白名单是否过期
	if whitelist.ExpiresAt != nil && time.Now().After(*whitelist.ExpiresAt) {
		response.Error(c, 403, "该手机号的监理入驻资格已过期")
		return
	}

	if approved, _, err := hasApprovedSupervisorOnboarding(phone); err != nil {
		response.ServerError(c, "校验失败")
		return
	} else if approved {
		response.Error(c, 409, "该手机号已通过监理入驻审核，请直接登录或联系管理员")
		return
	}

	// 检查是否已有 pending 申请（禁止重复提交）
	var pendingApp model.SupervisorApplication
	if err := repository.DB.Where("phone = ? AND status = ?", phone, supervisorApplicationStatusPending).First(&pendingApp).Error; err == nil {
		response.Error(c, 409, "您已提交过监理入驻申请，正在审核中，请勿重复提交")
		return
	}

	clientIP := c.ClientIP()
	if _, err := service.SendSMSCode(phone, service.SMSPurposeSupervisorApply, clientIP, ""); err != nil {
		response.Error(c, 429, "验证码发送失败: "+err.Error())
		return
	}

	response.Success(c, gin.H{"message": "验证码已发送"})
}

// CheckSupervisorOnboardingEligibility 检查入驻资格（白名单）
func CheckSupervisorOnboardingEligibility(c *gin.Context) {
	phone := strings.TrimSpace(c.Query("phone"))
	if !utils.ValidatePhone(phone) {
		response.BadRequest(c, "手机号格式不正确")
		return
	}

	// 检验是否在白名单
	var whitelist model.SupervisorPhoneWhitelist
	if err := repository.DB.Where("phone = ? AND status = 1", phone).First(&whitelist).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			response.Error(c, 403, "该手机号暂无监理入驻资格，请联系管理员")
			return
		}
		response.ServerError(c, "校验失败")
		return
	}

	// 检查白名单是否过期
	if whitelist.ExpiresAt != nil && time.Now().After(*whitelist.ExpiresAt) {
		response.Error(c, 403, "该手机号的监理入驻资格已过期")
		return
	}

	if approved, _, err := hasApprovedSupervisorOnboarding(phone); err != nil {
		response.ServerError(c, "校验失败")
		return
	} else if approved {
		response.Error(c, 409, "该手机号已通过监理入驻审核，请直接登录或联系管理员")
		return
	}

	// 检查是否已有 pending 申请（禁止重复提交）
	var pendingApp model.SupervisorApplication
	if err := repository.DB.Where("phone = ? AND status = ?", phone, supervisorApplicationStatusPending).First(&pendingApp).Error; err == nil {
		response.Error(c, 409, "您已提交过监理入驻申请，正在审核中，请勿重复提交")
		return
	}

	response.Success(c, gin.H{"status": "eligible"})
}

// GetSupervisorOnboardingStatus 查询入驻申请状态
func GetSupervisorOnboardingStatus(c *gin.Context) {
	phone := strings.TrimSpace(c.Query("phone"))
	if phone == "" || !utils.ValidatePhone(phone) {
		response.BadRequest(c, "手机号格式不正确")
		return
	}

	if approved, applicationID, err := hasApprovedSupervisorOnboarding(phone); err != nil {
		response.ServerError(c, "查询失败")
		return
	} else if approved {
		resp := gin.H{
			"status":  "approved",
			"message": "申请已通过，请使用验证码登录",
		}
		if applicationID > 0 {
			resp["applicationId"] = applicationID
		}
		response.Success(c, resp)
		return
	}

	var app model.SupervisorApplication
	if err := repository.DB.Where("phone = ?", phone).Order("id DESC").First(&app).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			response.Success(c, gin.H{"status": "required", "message": "未找到申请记录，请先提交申请"})
			return
		}
		response.ServerError(c, "查询失败")
		return
	}

	resp := gin.H{
		"applicationId": app.ID,
		"submittedAt":   app.SubmittedAt,
		"reviewedAt":    app.ReviewedAt,
	}

	switch app.Status {
	case supervisorApplicationStatusPending:
		resp["status"] = "pending_review"
		resp["message"] = "申请正在审核中，请耐心等待"
	case supervisorApplicationStatusApproved:
		resp["status"] = "approved"
		resp["message"] = "申请已通过，请使用验证码登录"
	case supervisorApplicationStatusRejected:
		resp["status"] = "rejected"
		resp["message"] = "申请未通过"
		resp["rejectReason"] = app.RejectReason
	}

	response.Success(c, resp)
}

// SubmitSupervisorOnboardingApplication 提交监理入驻申请
func SubmitSupervisorOnboardingApplication(c *gin.Context) {
	var req struct {
		Phone string          `json:"phone" binding:"required"`
		Code  string          `json:"code" binding:"required"`
		Form  json.RawMessage `json:"form" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请填写完整信息")
		return
	}
	if service.ContainsWhitespace(req.Phone) {
		response.BadRequest(c, "手机号不能包含空格")
		return
	}
	if service.ContainsWhitespace(req.Code) {
		response.BadRequest(c, "验证码不能包含空格")
		return
	}

	phone := strings.TrimSpace(req.Phone)
	if !utils.ValidatePhone(phone) {
		response.BadRequest(c, "手机号格式不正确")
		return
	}

	// 校验验证码
	if err := service.VerifySMSCode(phone, service.SMSPurposeSupervisorApply, strings.TrimSpace(req.Code)); err != nil {
		response.BadRequest(c, "验证码错误或已过期")
		return
	}

	// 检验白名单
	var whitelist model.SupervisorPhoneWhitelist
	if err := repository.DB.Where("phone = ? AND status = 1", phone).First(&whitelist).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			response.Error(c, 403, "该手机号暂无监理入驻资格")
			return
		}
		response.ServerError(c, "校验失败")
		return
	}

	if whitelist.ExpiresAt != nil && time.Now().After(*whitelist.ExpiresAt) {
		response.Error(c, 403, "该手机号的监理入驻资格已过期")
		return
	}

	if approved, _, err := hasApprovedSupervisorOnboarding(phone); err != nil {
		response.ServerError(c, "校验失败")
		return
	} else if approved {
		response.Error(c, 409, "该手机号已通过监理入驻审核，请直接登录或联系管理员")
		return
	}

	// 检查是否有 pending 申请
	var pendingApp model.SupervisorApplication
	if err := repository.DB.Where("phone = ? AND status = ?", phone, supervisorApplicationStatusPending).First(&pendingApp).Error; err == nil {
		response.Success(c, gin.H{
			"status":        "pending_review",
			"applicationId": pendingApp.ID,
			"message":       "您已提交过申请，正在审核中",
		})
		return
	}

	_, formStr, formErr := parseAndValidateSupervisorOnboardingForm(req.Form)
	if formErr != "" {
		response.BadRequest(c, formErr)
		return
	}

	// 创建申请
	now := time.Now()
	app := model.SupervisorApplication{
		Phone:       phone,
		WhitelistID: whitelist.ID,
		Status:      supervisorApplicationStatusPending,
		FormJSON:    formStr,
		SubmittedAt: now,
	}

	if err := repository.DB.Create(&app).Error; err != nil {
		response.ServerError(c, "提交失败，请稍后重试")
		return
	}

	response.Success(c, gin.H{
		"status":        "pending_review",
		"applicationId": app.ID,
		"message":       "申请已提交，请等待管理员审核",
	})
}
