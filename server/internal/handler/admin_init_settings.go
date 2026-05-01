package handler

import (
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	"home-decoration-server/pkg/response"

	"github.com/gin-gonic/gin"
)

// AdminInitSettings 初始化系统设置（调试接口）
func AdminInitSettings(c *gin.Context) {
	// 定义默认系统设置
	settings := []model.SystemSettings{
		// 基本设置
		{Key: "site_name", Value: "禾泽云", Description: "网站名称", Category: "basic"},
		{Key: "site_description", Value: "家装服务撮合、交易流程管理与履约协同平台", Description: "网站描述", Category: "basic"},
		{Key: "contact_email", Value: "", Description: "联系邮箱", Category: "basic"},
		{Key: "contact_phone", Value: "17764774797", Description: "联系电话", Category: "basic"},
		{Key: "icp", Value: "陕ICP备2026004441号", Description: "ICP备案号", Category: "basic"},
		// 功能开关
		{Key: "enable_registration", Value: "true", Description: "是否允许用户注册", Category: "security"},
		{Key: "enable_sms_verify", Value: "true", Description: "是否开启短信验证", Category: "security"},
		{Key: "enable_email_verify", Value: "false", Description: "是否开启邮箱验证", Category: "security"},
		// 微信支付配置
		{Key: "wechat_app_id", Value: "", Description: "微信支付AppID", Category: "payment"},
		{Key: "wechat_mch_id", Value: "", Description: "微信支付商户号", Category: "payment"},
		// 支付宝配置
		{Key: "alipay_app_id", Value: "", Description: "支付宝AppID", Category: "payment"},
		{Key: "alipay_public_key", Value: "", Description: "支付宝公钥", Category: "payment"},
		// 短信配置
		{Key: "sms_provider", Value: "", Description: "短信服务商", Category: "sms"},
		{Key: "sms_sign_name", Value: "", Description: "短信签名", Category: "sms"},
		{Key: "sms_template_id", Value: "", Description: "短信模板ID", Category: "sms"},
		// 腾讯云 IM 配置
		{Key: "im_tencent_enabled", Value: "false", Description: "是否启用腾讯云IM", Category: "im"},
		{Key: "im_tencent_sdk_app_id", Value: "", Description: "腾讯云IM SDKAppID", Category: "im"},
	}

	// 删除已有数据
	repository.DB.Where("1=1").Delete(&model.SystemSettings{})

	// 批量插入
	if err := repository.DB.Create(&settings).Error; err != nil {
		response.ServerError(c, "初始化失败: "+err.Error())
		return
	}

	response.Success(c, gin.H{
		"message": "系统设置初始化成功",
		"count":   len(settings),
	})
}
