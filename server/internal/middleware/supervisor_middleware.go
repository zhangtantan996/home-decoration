package middleware

import (
	"errors"
	"strings"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	"home-decoration-server/internal/service"
	"home-decoration-server/pkg/response"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

// SupervisorJWT 监理端专用JWT中间件 — 校验 token 签名、session 存活、账号状态
func SupervisorJWT(secret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			response.Unauthorized(c, "请先登录")
			c.Abort()
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" {
			response.Unauthorized(c, "Token格式错误")
			c.Abort()
			return
		}

		tokenString := parts[1]
		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, errors.New("invalid signing method")
			}
			return []byte(secret), nil
		})

		if err != nil || !token.Valid {
			response.Unauthorized(c, "Token无效或已过期")
			c.Abort()
			return
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			response.Unauthorized(c, "Token解析失败")
			c.Abort()
			return
		}

		audience, _ := claims["aud"].(string)
		if audience != "supervisor" {
			response.Forbidden(c, "无权访问监理接口")
			c.Abort()
			return
		}

		// 校验 token 类型
		tokenType, _ := claims["token_type"].(string)
		if tokenType != "supervisor" {
			response.Forbidden(c, "无权访问监理接口")
			c.Abort()
			return
		}

		// 拒绝 refresh token
		tokenUse, _ := claims["token_use"].(string)
		if tokenUse != "access" {
			response.Unauthorized(c, "请使用访问令牌")
			c.Abort()
			return
		}

		// 提取必要 claims
		sessionID, _ := claims["sid"].(string)
		jti, _ := claims["jti"].(string)
		if strings.TrimSpace(sessionID) == "" || strings.TrimSpace(jti) == "" {
			response.Unauthorized(c, "Token缺少会话信息")
			c.Abort()
			return
		}

		accountID, _ := claimToUint64(claims["accountId"])
		if accountID == 0 {
			response.Unauthorized(c, "Token缺少账号信息")
			c.Abort()
			return
		}

		supervisorID, _ := claimToUint64(claims["supervisorId"])
		phone, _ := claims["phone"].(string)

		// 校验 Redis session 存活（access token 在 session 中存在）
		if !service.IsSupervisorSessionValid(sessionID, jti, "access") {
			response.Unauthorized(c, "会话已失效，请重新登录")
			c.Abort()
			return
		}

		// 校验监理账号状态（不允许禁用账号的 token 继续使用）
		var account model.SupervisorAccount
		if err := repository.DB.First(&account, accountID).Error; err != nil {
			response.Unauthorized(c, "账号不存在")
			c.Abort()
			return
		}
		if account.Status != 1 {
			response.Forbidden(c, "账号已被禁用")
			c.Abort()
			return
		}

		if supervisorID > 0 {
			var profile model.SupervisorProfile
			if err := repository.DB.First(&profile, supervisorID).Error; err != nil {
				response.Unauthorized(c, "监理资料不存在")
				c.Abort()
				return
			}
			if profile.Status != 1 {
				response.Forbidden(c, "监理资料已禁用")
				c.Abort()
				return
			}
		}

		// 注入上下文
		c.Set("activeRole", "supervisor")
		if accountID > 0 {
			c.Set("supervisorAccountId", accountID)
		}
		if supervisorID > 0 {
			c.Set("supervisorId", supervisorID)
		}
		if phone != "" {
			c.Set("phone", phone)
		}
		c.Set("sessionId", sessionID)

		c.Next()
	}
}
