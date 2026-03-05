package handler

import (
	"home-decoration-server/internal/service"
	"home-decoration-server/pkg/response"

	"github.com/gin-gonic/gin"
)

var userSettingsService = &service.UserSettingsService{}

// ========== 修改密码 ==========

// ChangePassword 修改登录密码
func ChangePassword(c *gin.Context) {
	userID := c.GetUint64("userId")
	if userID == 0 {
		response.Unauthorized(c, "请先登录")
		return
	}

	var req struct {
		OldPassword string `json:"oldPassword"`
		NewPassword string `json:"newPassword" binding:"required,min=6"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "新密码不能少于6位")
		return
	}

	if err := userSettingsService.ChangePassword(userID, req.OldPassword, req.NewPassword); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.SuccessWithMessage(c, "密码修改成功", nil)
}

// ========== 修改手机号 ==========

// ChangePhone 修改手机号
func ChangePhone(c *gin.Context) {
	userID := c.GetUint64("userId")
	if userID == 0 {
		response.Unauthorized(c, "请先登录")
		return
	}

	var req struct {
		NewPhone string `json:"newPhone" binding:"required"`
		Code     string `json:"code" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请输入新手机号和验证码")
		return
	}

	// 验证短信验证码
	if err := service.VerifySMSCode(req.NewPhone, service.SMSPurposeChangePhone, req.Code); err != nil {
		response.BadRequest(c, "验证码错误或已过期")
		return
	}

	if err := userSettingsService.ChangePhone(userID, req.NewPhone); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.SuccessWithMessage(c, "手机号修改成功", nil)
}

// ========== 注销账号 ==========

// DeleteAccount 注销账号
func DeleteAccount(c *gin.Context) {
	userID := c.GetUint64("userId")
	if userID == 0 {
		response.Unauthorized(c, "请先登录")
		return
	}

	var req struct {
		Code string `json:"code" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请输入验证码")
		return
	}

	// 获取用户手机号进行验证
	user, err := userService.GetUserByID(userID)
	if err != nil {
		response.NotFound(c, "用户不存在")
		return
	}

	// 验证短信验证码
	if err := service.VerifySMSCode(user.Phone, service.SMSPurposeDeleteAccount, req.Code); err != nil {
		response.BadRequest(c, "验证码错误或已过期")
		return
	}

	if err := userSettingsService.DeleteAccount(userID); err != nil {
		response.ServerError(c, "注销失败")
		return
	}

	response.SuccessWithMessage(c, "账号已注销", nil)
}

// ========== 实名认证 ==========

// GetVerification 获取实名认证状态
func GetVerification(c *gin.Context) {
	userID := c.GetUint64("userId")
	if userID == 0 {
		response.Unauthorized(c, "请先登录")
		return
	}

	v, err := userSettingsService.GetVerification(userID)
	if err != nil {
		response.ServerError(c, "查询失败")
		return
	}

	if v == nil {
		response.Success(c, gin.H{
			"status":  -1, // 未提交
			"message": "未提交实名认证",
		})
		return
	}

	response.Success(c, v)
}

// SubmitVerification 提交实名认证
func SubmitVerification(c *gin.Context) {
	userID := c.GetUint64("userId")
	if userID == 0 {
		response.Unauthorized(c, "请先登录")
		return
	}

	var req struct {
		RealName     string `json:"realName" binding:"required"`
		IDCard       string `json:"idCard" binding:"required"`
		IDFrontImage string `json:"idFrontImage" binding:"required"`
		IDBackImage  string `json:"idBackImage" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请填写完整的认证信息")
		return
	}

	if err := userSettingsService.SubmitVerification(userID, req.RealName, req.IDCard, req.IDFrontImage, req.IDBackImage); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.SuccessWithMessage(c, "实名认证已提交，请耐心等待审核", nil)
}

// ========== 登录设备管理 ==========

// GetDevices 获取登录设备列表
func GetDevices(c *gin.Context) {
	userID := c.GetUint64("userId")
	if userID == 0 {
		response.Unauthorized(c, "请先登录")
		return
	}

	devices, err := userSettingsService.GetDevices(userID)
	if err != nil {
		response.ServerError(c, "查询失败")
		return
	}

	response.Success(c, gin.H{"devices": devices})
}

// RemoveDevice 移除单个设备
func RemoveDevice(c *gin.Context) {
	userID := c.GetUint64("userId")
	if userID == 0 {
		response.Unauthorized(c, "请先登录")
		return
	}

	deviceID := parseUint64(c.Param("id"))
	if deviceID == 0 {
		response.BadRequest(c, "设备ID无效")
		return
	}

	if err := userSettingsService.RemoveDevice(userID, deviceID); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.SuccessWithMessage(c, "设备已移除", nil)
}

// RemoveAllDevices 移除所有其他设备
func RemoveAllDevices(c *gin.Context) {
	userID := c.GetUint64("userId")
	if userID == 0 {
		response.Unauthorized(c, "请先登录")
		return
	}

	if err := userSettingsService.RemoveAllOtherDevices(userID); err != nil {
		response.ServerError(c, "操作失败")
		return
	}

	response.SuccessWithMessage(c, "已移除所有其他设备", nil)
}

// ========== 用户偏好设置 ==========

// GetUserSettings 获取用户偏好设置
func GetUserSettings(c *gin.Context) {
	userID := c.GetUint64("userId")
	if userID == 0 {
		response.Unauthorized(c, "请先登录")
		return
	}

	settings, err := userSettingsService.GetSettings(userID)
	if err != nil {
		response.ServerError(c, "查询失败")
		return
	}

	response.Success(c, settings)
}

// UpdateUserSettings 更新用户偏好设置
func UpdateUserSettings(c *gin.Context) {
	userID := c.GetUint64("userId")
	if userID == 0 {
		response.Unauthorized(c, "请先登录")
		return
	}

	var updates map[string]interface{}
	if err := c.ShouldBindJSON(&updates); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}

	// 移除不允许更新的字段
	delete(updates, "id")
	delete(updates, "userId")
	delete(updates, "user_id")
	delete(updates, "createdAt")
	delete(updates, "created_at")

	if err := userSettingsService.UpdateSettings(userID, updates); err != nil {
		response.ServerError(c, "更新失败")
		return
	}

	response.SuccessWithMessage(c, "设置已更新", nil)
}

// ========== 意见反馈 ==========

// SubmitFeedback 提交意见反馈
func SubmitFeedback(c *gin.Context) {
	userID := c.GetUint64("userId")
	if userID == 0 {
		response.Unauthorized(c, "请先登录")
		return
	}

	var req struct {
		Type    string `json:"type" binding:"required"`
		Content string `json:"content" binding:"required"`
		Contact string `json:"contact"`
		Images  string `json:"images"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请填写反馈类型和内容")
		return
	}

	if err := userSettingsService.SubmitFeedback(userID, req.Type, req.Content, req.Contact, req.Images); err != nil {
		response.ServerError(c, "提交失败")
		return
	}

	response.SuccessWithMessage(c, "反馈已提交，感谢您的反馈", nil)
}
