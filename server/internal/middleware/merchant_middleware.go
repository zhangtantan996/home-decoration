package middleware

import (
	"strings"

	"home-decoration-server/pkg/response"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

// MerchantJWT 商家专用JWT中间件
func MerchantJWT(secret string) gin.HandlerFunc {
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

		// 验证是商家 Token
		role, _ := claims["role"].(string)
		if role != "merchant" {
			response.Forbidden(c, "无权访问商家接口")
			c.Abort()
			return
		}

		// 存储商家信息到上下文
		if providerID, ok := claims["providerId"]; ok {
			c.Set("providerId", uint64(providerID.(float64)))
		}
		if providerType, ok := claims["providerType"]; ok {
			c.Set("providerType", int8(providerType.(float64)))
		}
		if userId, ok := claims["userId"]; ok {
			c.Set("userId", uint64(userId.(float64)))
		}
		if phone, ok := claims["phone"]; ok {
			c.Set("phone", phone)
		}

		c.Next()
	}
}
