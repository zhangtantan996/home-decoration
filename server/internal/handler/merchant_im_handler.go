package handler

// Package handler provides Tencent Cloud IM integration for merchants.
//
// STATUS: BACKUP SOLUTION (Not currently used in production)
//
// Primary IM System: Tinode
// This code is kept as a backup solution for potential future migration
// or emergency fallback scenarios.
//
// Maintenance Policy:
// - Code is preserved but not actively maintained
// - No new features will be added
// - Critical security fixes only
// - Scheduled for review: 2026-07-24 (6 months)
//
// Last Updated: 2026-01-24
// Maintainer: Backend Team

import (
	"fmt"
	"log"
	"net/http"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	"home-decoration-server/internal/service"
	"home-decoration-server/internal/utils/image"
	"home-decoration-server/internal/utils/tencentim"

	"github.com/gin-gonic/gin"
)

// MerchantGetIMUserSig 商家获取腾讯云 IM 登录签名
// GET /api/v1/merchant/im/usersig
func MerchantGetIMUserSig(c *gin.Context) {
	// 从中间件获取 providerID
	var providerID uint64
	if val, exists := c.Get("providerId"); exists {
		switch v := val.(type) {
		case uint64:
			providerID = v
		case float64:
			providerID = uint64(v)
		case int:
			providerID = uint64(v)
		}
	}
	if providerID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"code": 1001, "message": "未登录"})
		return
	}

	configSvc := &service.ConfigService{}
	imConfig, err := configSvc.GetTencentIMConfig()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 1002, "message": "获取IM配置失败"})
		return
	}

	if !imConfig.Enabled || imConfig.SDKAppID == 0 || imConfig.SecretKey == "" {
		c.JSON(http.StatusBadRequest, gin.H{"code": 1003, "message": "IM服务未配置或未启用"})
		return
	}

	// 获取商家信息
	var provider model.Provider
	if err := repository.DB.First(&provider, providerID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 1005, "message": "获取商家信息失败"})
		return
	}

	// 获取关联的用户信息（昵称和头像）
	var user model.User
	if err := repository.DB.First(&user, provider.UserID).Error; err != nil {
		log.Printf("[IM] 获取用户信息失败: userID=%d, err=%v", provider.UserID, err)
		// 继续执行，使用默认值
	}

	// ✅ 使用关联的用户ID作为 IM 账号 (全局唯一，无需前缀)
	userIDStr := fmt.Sprintf("%d", provider.UserID)

	// 自动导入商家到腾讯云 IM（使用关联的用户ID）
	nickname := service.ResolveProviderDisplayName(provider, &user)
	fullAvatar := image.GetFullImageURL(service.ResolveProviderAvatarPathWithUser(provider, &user))
	if err := tencentim.SyncUserToIM(provider.UserID, nickname, fullAvatar); err != nil {
		log.Printf("[IM] 导入商家失败: userID=%d, err=%v", provider.UserID, err)
		// 不阻止继续，只记录日志
	}

	// 生成 UserSig，有效期 7 天
	userSig, err := tencentim.GenUserSig(imConfig.SDKAppID, imConfig.SecretKey, userIDStr, 86400*7)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 1004, "message": "生成签名失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"data": gin.H{
			"sdkAppId": imConfig.SDKAppID,
			"userId":   userIDStr,
			"userSig":  userSig,
		},
	})
}
