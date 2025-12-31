package middleware

import (
	"net/http"
	"strings"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	"home-decoration-server/pkg/response"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

// Cors 跨域中间件（白名单模式）
func Cors(allowedOrigins []string) gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")

		// 白名单验证
		allowed := false
		for _, allowedOrigin := range allowedOrigins {
			if origin == allowedOrigin {
				allowed = true
				break
			}
		}

		if allowed {
			c.Header("Access-Control-Allow-Origin", origin)
			c.Header("Access-Control-Allow-Credentials", "true") // 允许携带凭证
		}

		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH")
		c.Header("Access-Control-Allow-Headers", "Origin, Content-Type, Authorization, X-CSRF-Token")
		c.Header("Access-Control-Max-Age", "86400")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		if !allowed && origin != "" {
			c.AbortWithStatus(http.StatusForbidden)
			return
		}

		c.Next()
	}
}

// Logger 日志中间件
func Logger() gin.HandlerFunc {
	return gin.Logger()
}

// Recovery 恢复中间件
func Recovery() gin.HandlerFunc {
	return gin.Recovery()
}

// JWT 认证中间件
func JWT(secret string) gin.HandlerFunc {
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

		// 将用户ID存入上下文（支持普通用户和管理员）
		if adminID, ok := claims["admin_id"]; ok {
			// 管理员 Token
			c.Set("admin_id", uint64(adminID.(float64)))
			c.Set("username", claims["username"])
			c.Set("is_super", claims["is_super"])
		}
		if userID, ok := claims["userId"]; ok {
			// 普通用户 Token - 转换为 uint64
			c.Set("userId", uint64(userID.(float64)))
			if userType, ok := claims["userType"]; ok {
				c.Set("userType", userType)
			}
		}
		c.Next()
	}
}

// AdminJWT 管理员专用JWT中间件（验证token类型）
func AdminJWT(secret string) gin.HandlerFunc {
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

		// ✅ 验证token类型（必须是admin）
		tokenType, _ := claims["token_type"].(string)
		if tokenType != "admin" {
			response.Forbidden(c, "无权访问管理接口")
			c.Abort()
			return
		}

		// 存储管理员信息到上下文
		if adminID, ok := claims["admin_id"]; ok {
			c.Set("admin_id", uint64(adminID.(float64)))
		}
		if username, ok := claims["username"]; ok {
			c.Set("username", username)
		}
		if isSuper, ok := claims["is_super"]; ok {
			c.Set("is_super", isSuper)
		}

		c.Next()
	}
}

// RequirePermission RBAC权限验证中间件
func RequirePermission(permission string) gin.HandlerFunc {
	return func(c *gin.Context) {
		// 获取管理员ID和超管标志
		adminID, exists := c.Get("admin_id")
		if !exists {
			response.Unauthorized(c, "未登录")
			c.Abort()
			return
		}

		isSuperAdmin, _ := c.Get("is_super")
		if isSuperAdmin == true {
			// 超级管理员拥有所有权限
			c.Next()
			return
		}

		// 查询管理员权限
		var admin model.SysAdmin
		if err := repository.DB.Preload("Roles.Menus").First(&admin, adminID).Error; err != nil {
			response.Forbidden(c, "无权限")
			c.Abort()
			return
		}

		// 检查是否有该权限
		hasPermission := false
		for _, role := range admin.Roles {
			for _, menu := range role.Menus {
				if menu.Permission == permission || menu.Permission == "*:*:*" {
					hasPermission = true
					break
				}
			}
			if hasPermission {
				break
			}
		}

		if !hasPermission {
			response.Forbidden(c, "无权限执行此操作")
			c.Abort()
			return
		}

		c.Next()
	}
}

// AdminLog 管理员操作日志中间件
func AdminLog() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 只记录修改操作
		if c.Request.Method != "POST" && c.Request.Method != "PUT" &&
			c.Request.Method != "DELETE" && c.Request.Method != "PATCH" {
			c.Next()
			return
		}

		adminID, exists := c.Get("admin_id")
		if !exists {
			c.Next()
			return
		}

		// 执行请求
		c.Next()

		// 记录日志
		log := model.AdminLog{
			AdminID: adminID.(uint64),
			Action:  c.Request.Method + " " + c.Request.URL.Path,
			IP:      c.ClientIP(),
			Status:  c.Writer.Status(),
		}
		repository.DB.Create(&log)
	}
}
