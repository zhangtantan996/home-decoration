package handler

import (
	"fmt"
	"net/http"

	"home-decoration-server/internal/service"
	"home-decoration-server/internal/utils/tencentim"

	"github.com/gin-gonic/gin"
)

// GetIMUserSig 获取腾讯云 IM 登录签名
// GET /api/v1/im/usersig
func GetIMUserSig(c *gin.Context) {
	userID := uint64(c.GetFloat64("userId"))
	if userID == 0 {
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

	// 用户ID转字符串
	userIDStr := fmt.Sprintf("%d", userID)

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
