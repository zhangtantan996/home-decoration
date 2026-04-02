package handler

import (
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	"home-decoration-server/internal/service"
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

		displayName := service.ResolveProviderDisplayName(provider, &user)

		providerInfo = gin.H{
			"id":              provider.ID,
			"name":            displayName,
			"avatar":          imgutil.GetFullImageURL(service.ResolveProviderAvatarPathWithUser(provider, &user)),
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
	p0Summary, _ := bookingService.GetBookingP0Summary(booking.ID)
	refundSummary, _ := refundApplicationService.BuildBookingRefundSummary(booking.ID)
	var siteSurveySummary interface{}
	var budgetConfirmSummary interface{}
	var availableActions []string
	var flowSummary string
	var currentStage string
	surveyDepositPaymentOptions := paymentService.GetSurveyDepositPaymentOptions(booking)
	if p0Summary != nil {
		siteSurveySummary = p0Summary.SiteSurvey
		budgetConfirmSummary = p0Summary.BudgetConfirm
		availableActions = p0Summary.AvailableActions
		flowSummary = p0Summary.FlowSummary
		currentStage = p0Summary.CurrentStage
	}

	response.Success(c, gin.H{
		"booking":                     booking,
		"provider":                    providerInfo,
		"proposalId":                  proposalID,
		"siteSurveySummary":           siteSurveySummary,
		"budgetConfirmSummary":        budgetConfirmSummary,
		"availableActions":            availableActions,
		"flowSummary":                 flowSummary,
		"currentStage":                currentStage,
		"refundSummary":               refundSummary,
		"surveyDepositPaymentOptions": surveyDepositPaymentOptions,
	})
}

// PayIntentFee 创建预约意向金支付单
func PayIntentFee(c *gin.Context) {
	bookingID := parseUint64(c.Param("id"))
	userID := c.GetUint64("userId")
	if bookingID == 0 {
		response.BadRequest(c, "无效的预约ID")
		return
	}
	req, err := bindPaymentLaunchRequest(c)
	if err != nil {
		response.BadRequest(c, "支付参数错误")
		return
	}

	result, err := paymentService.StartBookingIntentPayment(userID, bookingID, req.TerminalType)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Success(c, result)
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
