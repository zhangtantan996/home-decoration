package handler

import (
	"log"

	"home-decoration-server/internal/service"
	"home-decoration-server/pkg/response"

	"github.com/gin-gonic/gin"
)

// ========== 预约相关 ==========

// CreateBooking 创建预约
func CreateBooking(c *gin.Context) {
	var req service.CreateBookingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误: "+err.Error())
		return
	}

	userID := c.GetUint64("userId")
	booking, err := bookingService.Create(userID, &req)
	if err != nil {
		log.Printf("[booking] create failed user_id=%d provider_id=%d provider_type=%s: %v", userID, req.ProviderID, req.ProviderType, err)
		response.ServerError(c, "预约失败")
		return
	}

	response.SuccessWithMessage(c, "预约成功", booking)
}
