package middleware

import (
	"home-decoration-server/internal/service"
	"home-decoration-server/pkg/response"

	"github.com/gin-gonic/gin"
)

func RequireMerchantPortalEnabled() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !(&service.ConfigService{}).IsMerchantPortalEnabled() {
			response.Forbidden(c, "商家端暂未开放")
			c.Abort()
			return
		}
		c.Next()
	}
}

func RequireSupervisorPortalEnabled() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !(&service.ConfigService{}).IsSupervisorPortalEnabled() {
			response.Forbidden(c, "监理端暂未开放")
			c.Abort()
			return
		}
		c.Next()
	}
}

func RequireTransactionFlowEnabled() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !(&service.ConfigService{}).IsTransactionFlowEnabled() {
			response.Forbidden(c, "当前仅开放预约咨询，交易履约功能暂未开放")
			c.Abort()
			return
		}
		c.Next()
	}
}
