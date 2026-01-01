package handler

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

// GetIMUserSig 获取腾讯云 IM 登录签名
// GET /api/v1/im/usersig
func GetIMUserSig(c *gin.Context) {
	// 从 JWT 中间件获取 userId（中间件存储为 uint64 类型）
	var userID uint64
	if val, exists := c.Get("userId"); exists {
		switch v := val.(type) {
		case uint64:
			userID = v
		case float64:
			userID = uint64(v)
		case int:
			userID = uint64(v)
		}
	}
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

	// 获取用户信息
	var user model.User
	if err := repository.DB.First(&user, userID).Error; err == nil {
		// 自动将用户导入腾讯云 IM（幂等操作，重复导入不会报错）
		// 处理昵称：若为空则使用默认格式
		nickname := user.Nickname
		if nickname == "" {
			// 脱敏显示手机号后四位
			suffix := ""
			if len(user.Phone) >= 4 {
				suffix = user.Phone[len(user.Phone)-4:]
			}
			nickname = fmt.Sprintf("用户%s", suffix)
		}

		// 使用完整的头像URL
		fullAvatar := image.GetFullImageURL(user.Avatar)

		if err := tencentim.SyncUserToIM(userID, nickname, fullAvatar); err != nil {
			log.Printf("[IM] 导入用户失败: userID=%d, err=%v", userID, err)
			// 不阻止继续，只记录日志
		}
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
