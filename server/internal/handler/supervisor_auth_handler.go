package handler

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"home-decoration-server/internal/config"
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	"home-decoration-server/internal/service"
	"home-decoration-server/pkg/response"
	"home-decoration-server/pkg/utils"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"gorm.io/gorm"
)

// ==================== 监理登录（白名单→申请通过→登录） ====================

const (
	supervisorErrOnboardingRequired = "SUPERVISOR_ONBOARDING_REQUIRED"
	supervisorErrOnboardingPending  = "SUPERVISOR_ONBOARDING_PENDING"
	supervisorErrOnboardingRejected = "SUPERVISOR_ONBOARDING_REJECTED"
	supervisorErrAccountDisabled    = "SUPERVISOR_ACCOUNT_DISABLED"
	supervisorErrAccountLocked      = "SUPERVISOR_ACCOUNT_LOCKED"
)

// SupervisorLogin 监理登录（手机号+验证码，白名单→申请通过→可登录）
func SupervisorLogin(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		var input struct {
			Phone string `json:"phone" binding:"required"`
			Code  string `json:"code" binding:"required"`
		}
		if err := c.ShouldBindJSON(&input); err != nil {
			response.BadRequest(c, "请输入手机号和验证码")
			return
		}
		if service.ContainsWhitespace(input.Phone) {
			response.BadRequest(c, "手机号不能包含空格")
			return
		}
		if service.ContainsWhitespace(input.Code) {
			response.BadRequest(c, "验证码不能包含空格")
			return
		}

		phone := strings.TrimSpace(input.Phone)
		if !utils.ValidatePhone(phone) {
			response.BadRequest(c, "手机号格式不正确")
			return
		}

		// 账号是登录主链。申请状态只用于账号未生成时解释为什么不能登录，
		// 避免历史已通过账号被后续 pending/rejected 申请挡住。
		var account model.SupervisorAccount
		if err := repository.DB.Where("phone = ?", phone).First(&account).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				var app model.SupervisorApplication
				if err := repository.DB.Where("phone = ?", phone).Order("id DESC").First(&app).Error; err != nil {
					if errors.Is(err, gorm.ErrRecordNotFound) {
						response.Error(c, 403, "该手机号无监理入驻记录，请联系管理员")
						return
					}
					response.ServerError(c, "登录失败")
					return
				}

				switch app.Status {
				case supervisorApplicationStatusPending:
					response.Error(c, 403, "您的监理申请正在审核中，请耐心等待")
					return
				case supervisorApplicationStatusRejected:
					msg := "您的监理申请未通过审核"
					if app.RejectReason != "" {
						msg = msg + "：" + app.RejectReason
					}
					response.Error(c, 403, msg)
					return
				case supervisorApplicationStatusApproved:
					response.Error(c, 403, "监理账号尚未创建，请联系管理员")
					return
				default:
					response.Error(c, 403, "该手机号无可用监理账号")
					return
				}
			} else {
				response.ServerError(c, "登录失败")
				return
			}
		}

		// 检查账号状态
		if account.Status != 1 {
			response.Error(c, 403, "账号已被禁用")
			return
		}

		// 检查账号锁定
		if account.LockedUntil != nil && time.Now().Before(*account.LockedUntil) {
			remainingMinutes := int(time.Until(*account.LockedUntil).Minutes())
			response.Error(c, 403, fmt.Sprintf("账号已被锁定，请在 %d 分钟后重试", remainingMinutes))
			return
		}

		// 锁定已过期则重置
		if account.LockedUntil != nil && time.Now().After(*account.LockedUntil) {
			repository.DB.Model(&account).Updates(map[string]interface{}{
				"login_failed_count": 0,
				"locked_until":       nil,
			})
			account.LoginFailedCount = 0
			account.LockedUntil = nil
		}

		// 消费短信验证码
		if err := service.VerifySMSCode(phone, service.SMSPurposeSupervisorLogin, strings.TrimSpace(input.Code)); err != nil {
			// 记录失败
			account.LoginFailedCount++
			updates := map[string]interface{}{
				"login_failed_count": account.LoginFailedCount,
			}
			if account.LoginFailedCount >= 10 {
				lockedUntil := time.Now().Add(30 * time.Minute)
				updates["locked_until"] = lockedUntil
			}
			repository.DB.Model(&account).Updates(updates)

			if account.LoginFailedCount >= 10 {
				response.Error(c, 403, "验证码错误次数过多，账号已锁定30分钟")
				return
			}
			response.BadRequest(c, "验证码错误或已过期")
			return
		}

		// 验证成功 — 重置失败计数 + 更新登录审计
		repository.DB.Model(&account).Updates(map[string]interface{}{
			"login_failed_count": 0,
			"locked_until":       nil,
			"last_login_at":      time.Now(),
			"last_login_ip":      c.ClientIP(),
		})

		// 查找 supervisor_profile
		var profile model.SupervisorProfile
		if err := repository.DB.Where("supervisor_account_id = ?", account.ID).First(&profile).Error; err != nil {
			// 降级：用 phone 查
			if err2 := repository.DB.Where("phone = ?", phone).First(&profile).Error; err2 != nil {
				response.ServerError(c, "监理资料缺失")
				return
			}
		}
		if profile.Status != 1 {
			response.Forbidden(c, "监理资料已禁用")
			return
		}

		// 签发 token pair
		tokenPair, err := service.IssueSupervisorTokenPair(account.ID, phone, profile.ID, c.ClientIP(), c.Request.UserAgent(), c.GetHeader("X-Device-ID"))
		if err != nil {
			response.ServerError(c, "生成Token失败")
			return
		}

		// 注册持久设备信息
		_ = service.RegisterSupervisorDeviceMetadata(account.ID, c.GetHeader("X-Device-ID"), c.ClientIP(), c.Request.UserAgent())

		response.Success(c, gin.H{
			"accessToken":  tokenPair.AccessToken,
			"refreshToken": tokenPair.RefreshToken,
			"expiresIn":    tokenPair.AccessExpiresIn,
			"sessionId":    tokenPair.SessionID,
			"supervisor": gin.H{
				"accountId":      account.ID,
				"supervisorId":   profile.ID,
				"phone":          phone,
				"realName":       profile.RealName,
				"cityCode":       profile.CityCode,
				"serviceArea":    profile.ServiceArea,
				"certifications": profile.Certifications,
				"status":         profile.Status,
				"verified":       profile.Verified,
			},
		})
	}
}

// SupervisorRefreshToken 刷新 access token（rotation + replay 保护）
func SupervisorRefreshToken(c *gin.Context) {
	var input struct {
		RefreshToken string `json:"refreshToken" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, "请提供 refreshToken")
		return
	}

	// 解析 token 获取 claims
	token, err := jwt.Parse(strings.TrimSpace(input.RefreshToken), func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("invalid signing method")
		}
		return jwtSecret(), nil
	})
	if err != nil || !token.Valid {
		response.Unauthorized(c, "refresh token 无效或已过期")
		return
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		response.Unauthorized(c, "token 格式错误")
		return
	}

	tokenType, _ := claims["token_type"].(string)
	tokenUse, _ := claims["token_use"].(string)
	audience, _ := claims["aud"].(string)
	if audience != "supervisor" || tokenType != "supervisor" || tokenUse != "refresh" {
		response.Unauthorized(c, "刷新令牌类型错误")
		return
	}

	accountID, _ := claimToUint64FromClaims(claims["accountId"])
	if accountID == 0 {
		response.Unauthorized(c, "token 缺少账号信息")
		return
	}

	sessionID, _ := claims["sid"].(string)
	jti, _ := claims["jti"].(string)
	if strings.TrimSpace(sessionID) == "" || strings.TrimSpace(jti) == "" {
		response.Unauthorized(c, "refresh token 缺少会话信息")
		return
	}

	// Refresh token rotation + replay 保护
	ok, err = service.ConsumeSupervisorRefreshToken(sessionID, jti)
	if err != nil || !ok {
		response.Unauthorized(c, "refresh token 无效或已被使用，请重新登录")
		return
	}

	// 检查账号状态
	var account model.SupervisorAccount
	if err := repository.DB.First(&account, accountID).Error; err != nil {
		response.Unauthorized(c, "账号不存在")
		return
	}
	if account.Status != 1 {
		response.Forbidden(c, "账号已被禁用")
		return
	}

	// 查找 supervisor_profile
	var profile model.SupervisorProfile
	if err := repository.DB.Where("supervisor_account_id = ?", accountID).First(&profile).Error; err != nil {
		response.Unauthorized(c, "监理资料不存在")
		return
	}
	if profile.Status != 1 {
		response.Forbidden(c, "监理资料已禁用")
		return
	}

	// 签发新 token pair（复用同一 sessionID）
	newPair, err := service.IssueSupervisorTokenPairWithSession(accountID, account.Phone, profile.ID, sessionID, c.ClientIP(), c.Request.UserAgent(), c.GetHeader("X-Device-ID"))
	if err != nil {
		response.ServerError(c, "刷新失败")
		return
	}

	// 注册持久设备信息
	_ = service.RegisterSupervisorDeviceMetadata(accountID, c.GetHeader("X-Device-ID"), c.ClientIP(), c.Request.UserAgent())

	response.Success(c, gin.H{
		"accessToken":  newPair.AccessToken,
		"refreshToken": newPair.RefreshToken,
		"expiresIn":    newPair.AccessExpiresIn,
		"sessionId":    newPair.SessionID,
	})
}

// SupervisorLogout 登出（撤销当前 session）
func SupervisorLogout(c *gin.Context) {
	sessionID := c.GetString("sessionId")
	if sessionID == "" {
		response.BadRequest(c, "缺少会话信息")
		return
	}

	if err := service.RevokeSupervisorSession(sessionID); err != nil {
		response.ServerError(c, "登出失败")
		return
	}

	response.Success(c, gin.H{"message": "已登出"})
}

// SupervisorLogoutAll 登出所有设备（撤销该账号所有 session）
func SupervisorLogoutAll(c *gin.Context) {
	accountID := c.GetUint64("supervisorAccountId")
	if accountID == 0 {
		response.BadRequest(c, "缺少账号信息")
		return
	}

	if err := service.RevokeAllSupervisorSessions(accountID); err != nil {
		response.ServerError(c, "登出失败")
		return
	}

	response.Success(c, gin.H{"message": "所有设备已登出"})
}

// SupervisorListSessions 列出当前账号所有 session
func SupervisorListSessions(c *gin.Context) {
	accountID := c.GetUint64("supervisorAccountId")
	if accountID == 0 {
		response.BadRequest(c, "缺少账号信息")
		return
	}

	redisClient := repository.GetRedis()
	if redisClient == nil {
		response.Success(c, gin.H{"sessions": []gin.H{}, "total": 0})
		return
	}

	ctx, cancel := repository.RedisContext()
	defer cancel()

	currentSessionID := c.GetString("sessionId")
	deviceMappingKey := fmt.Sprintf("session_device:supervisor:%d", accountID)
	deviceSessions, _ := redisClient.HGetAll(ctx, deviceMappingKey).Result()

	sessions := make([]gin.H, 0, len(deviceSessions))
	for deviceID, sid := range deviceSessions {
		active := service.IsSupervisorSessionActive(sid)
		// 优先取当前会话元数据，取不到取持久设备元数据
		var meta map[string]string
		sMeta, _ := service.GetSupervisorSessionMetadata(sid)
		if sMeta != nil {
			meta = map[string]string{
				"ip":           sMeta.IP,
				"user_agent":   sMeta.UserAgent,
				"last_used_at": sMeta.LastUsedAt,
				"created_at":   sMeta.CreatedAt,
			}
		} else {
			meta, _ = service.GetSupervisorDeviceMetadata(accountID, deviceID)
		}

		s := gin.H{
			"deviceId":  deviceID,
			"sessionId": sid,
			"active":    active,
			"isCurrent": sid == currentSessionID,
		}
		if len(meta) > 0 {
			s["ip"] = meta["ip"]
			s["userAgent"] = meta["user_agent"]
			s["lastUsedAt"] = meta["last_used_at"]
			s["createdAt"] = meta["created_at"]

			ua := meta["user_agent"]
			if strings.Contains(strings.ToLower(ua), "mobile") || strings.Contains(strings.ToLower(ua), "android") || strings.Contains(strings.ToLower(ua), "iphone") {
				s["deviceInfo"] = "移动端设备"
			} else {
				s["deviceInfo"] = "PC桌面端"
			}
		} else {
			s["deviceInfo"] = "未知设备"
		}
		sessions = append(sessions, s)
	}

	response.Success(c, gin.H{"sessions": sessions, "total": len(sessions)})
}

// SupervisorRevokeSession 撤销指定 session
func SupervisorRevokeSession(c *gin.Context) {
	accountID := c.GetUint64("supervisorAccountId")
	if accountID == 0 {
		response.BadRequest(c, "缺少账号信息")
		return
	}

	sessionID := c.Param("sid")
	if sessionID == "" {
		response.BadRequest(c, "缺少会话ID")
		return
	}

	if repository.GetRedis() == nil {
		currentSessionID := strings.TrimSpace(c.GetString("sessionId"))
		if currentSessionID == "" || currentSessionID != strings.TrimSpace(sessionID) {
			response.Forbidden(c, "无权撤销该会话")
			return
		}
		if err := service.RevokeSupervisorSession(sessionID); err != nil {
			response.ServerError(c, "撤销失败")
			return
		}
		response.Success(c, gin.H{"message": "会话已撤销"})
		return
	}

	if err := service.RevokeSupervisorSessionForAccount(accountID, sessionID); err != nil {
		if strings.Contains(err.Error(), "不属于当前账号") {
			response.Forbidden(c, "无权撤销该会话")
			return
		}
		response.ServerError(c, "撤销失败")
		return
	}

	response.Success(c, gin.H{"message": "会话已撤销"})
}

// SupervisorGetInfo 获取当前监理信息
func SupervisorGetInfo(c *gin.Context) {
	supervisorID := c.GetUint64("supervisorId")
	if supervisorID == 0 {
		response.Unauthorized(c, "请先登录")
		return
	}

	var profile model.SupervisorProfile
	if err := repository.DB.Where("id = ?", supervisorID).First(&profile).Error; err != nil {
		response.Error(c, 500, "获取监理信息失败")
		return
	}

	response.Success(c, gin.H{
		"id":             profile.ID,
		"realName":       profile.RealName,
		"phone":          profile.Phone,
		"cityCode":       profile.CityCode,
		"serviceArea":    profile.ServiceArea,
		"certifications": profile.Certifications,
		"status":         profile.Status,
		"verified":       profile.Verified,
	})
}

// ==================== helpers ====================

func jwtSecret() []byte {
	cfg := config.GetConfig()
	return []byte(cfg.JWT.Secret)
}

func claimToUint64FromClaims(val interface{}) (uint64, bool) {
	switch v := val.(type) {
	case float64:
		return uint64(v), true
	case uint64:
		return v, true
	case int64:
		if v < 0 {
			return 0, false
		}
		return uint64(v), true
	default:
		return 0, false
	}
}
