package handler

import (
	"home-decoration-server/internal/repository"

	"github.com/gin-gonic/gin"
)

func MerchantRequireCompletedOnboarding() gin.HandlerFunc {
	return func(c *gin.Context) {
		providerID := c.GetUint64("providerId")
		userID := c.GetUint64("userId")
		if providerID == 0 {
			c.Next()
			return
		}

		state, err := loadProviderOnboardingState(repository.DB, providerID, userID)
		if err != nil {
			c.JSON(500, gin.H{
				"code":    500,
				"message": "校验商家补全状态失败",
			})
			c.Abort()
			return
		}
		if state.CompletionRequired {
			respondMerchantOnboardingIncomplete(c, state)
			c.Abort()
			return
		}

		c.Next()
	}
}
