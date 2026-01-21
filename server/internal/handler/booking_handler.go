package handler

import (
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	imgutil "home-decoration-server/internal/utils/image"
	"home-decoration-server/pkg/response"
	"log"

	"github.com/gin-gonic/gin"
)

// GetBooking 获取预约详情
func GetBooking(c *gin.Context) {
	bookingID := c.Param("id")
	userID := c.GetUint64("userId")

	booking, err := bookingService.GetByID(userID, bookingID)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	// 查询服务商信息
	var provider model.Provider
	var providerInfo gin.H
	if err := repository.DB.First(&provider, booking.ProviderID).Error; err == nil {
		// 查询关联的用户信息获取头像
		var user model.User
		repository.DB.First(&user, provider.UserID)

		// 获取显示名称
		displayName := provider.CompanyName
		if provider.ProviderType == 1 || displayName == "" {
			displayName = user.Nickname
		}
		if displayName == "" && len(user.Phone) >= 4 {
			displayName = "用户" + user.Phone[len(user.Phone)-4:]
		}

		providerInfo = gin.H{
			"id":              provider.ID,
			"name":            displayName,
			"avatar":          imgutil.GetFullImageURL(user.Avatar),
			"rating":          provider.Rating,
			"completedCnt":    provider.CompletedCnt,
			"yearsExperience": provider.YearsExperience,
			"specialty":       provider.Specialty,
			"verified":        provider.Verified,
			"providerType":    provider.ProviderType,
		}
	}

	// 查询关联的方案ID
	var proposal model.Proposal
	var proposalID uint64
	if err := repository.DB.Where("booking_id = ?", booking.ID).First(&proposal).Error; err == nil {
		proposalID = proposal.ID
	}

	response.Success(c, gin.H{
		"booking":    booking,
		"provider":   providerInfo,
		"proposalId": proposalID,
	})
}

// PayIntentFee 支付预约意向金（模拟支付）
func PayIntentFee(c *gin.Context) {
	bookingID := c.Param("id")
	userID := c.GetUint64("userId")

	booking, err := bookingService.PayIntentFee(userID, bookingID)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.SuccessWithMessage(c, "支付成功", booking)
}

// GetUserBookings 获取用户预约列表
func GetUserBookings(c *gin.Context) {
	userID := c.GetUint64("userId")

	// 可选过滤：paid=true/false
	var paid *bool
	if paidStr := c.Query("paid"); paidStr != "" {
		p := paidStr == "true"
		paid = &p
	}

	bookings, err := bookingService.GetUserBookings(userID, paid)
	if err != nil {
		response.ServerError(c, "获取预约列表失败")
		return
	}

	response.Success(c, bookings)
}

// CancelBooking 取消预约
func CancelBooking(c *gin.Context) {
	bookingID := c.Param("id")
	userID := c.GetUint64("userId")

	log.Printf("[CancelBooking] Received request - userID: %d, bookingID: %s", userID, bookingID)

	if err := bookingService.CancelBooking(userID, bookingID); err != nil {
		log.Printf("[CancelBooking] Error: %s", err.Error())
		response.BadRequest(c, err.Error())
		return
	}

	log.Printf("[CancelBooking] Success - booking %s cancelled", bookingID)
	response.SuccessWithMessage(c, "订单已取消", nil)
}

// DeleteBooking 删除预约
func DeleteBooking(c *gin.Context) {
	bookingID := c.Param("id")
	userID := c.GetUint64("userId")

	log.Printf("[DeleteBooking] Received request - userID: %d, bookingID: %s", userID, bookingID)

	if err := bookingService.DeleteBooking(userID, bookingID); err != nil {
		log.Printf("[DeleteBooking] Error: %s", err.Error())
		response.BadRequest(c, err.Error())
		return
	}

	log.Printf("[DeleteBooking] Success - booking %s deleted", bookingID)
	response.SuccessWithMessage(c, "订单已删除", nil)
}
