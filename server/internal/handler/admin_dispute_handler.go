package handler

import (
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	"home-decoration-server/internal/service"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

// ==================== Admin 争议预约管理 ====================

// AdminListDisputedBookings 获取争议预约列表
func AdminListDisputedBookings(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))

	var bookings []model.Booking
	var total int64

	// status=5 表示争议中
	db := repository.DB.Model(&model.Booking{}).Where("status = ?", 5)

	db.Count(&total)

	offset := (page - 1) * pageSize
	if err := db.Order("updated_at DESC").Offset(offset).Limit(pageSize).Find(&bookings).Error; err != nil {
		c.JSON(http.StatusOK, gin.H{"code": 1, "error": "获取争议预约列表失败"})
		return
	}

	// 补充关联信息
	type DisputedBookingItem struct {
		model.Booking
		UserName       string `json:"userName"`
		UserPhone      string `json:"userPhone"`
		ProviderName   string `json:"providerName"`
		RejectionCount int    `json:"rejectionCount"`
		LastReason     string `json:"lastReason"`
	}

	var result []DisputedBookingItem
	for _, b := range bookings {
		item := DisputedBookingItem{Booking: b}

		// 获取用户信息
		var user model.User
		if err := repository.DB.Select("nickname, phone").First(&user, b.UserID).Error; err == nil {
			item.UserName = user.Nickname
			item.UserPhone = user.Phone
		}

		// 获取商家信息
		var provider model.Provider
		if err := repository.DB.Select("id", "user_id", "company_name").First(&provider, b.ProviderID).Error; err == nil {
			var providerUser model.User
			if provider.UserID > 0 {
				_ = repository.DB.Select("nickname", "phone").First(&providerUser, provider.UserID).Error
				item.ProviderName = service.ResolveProviderDisplayName(provider, &providerUser)
			} else {
				item.ProviderName = service.ResolveProviderDisplayName(provider, nil)
			}
		}

		// 获取最新的被拒绝方案信息
		var latestProposal model.Proposal
		if err := repository.DB.Where("booking_id = ?", b.ID).
			Order("version DESC").First(&latestProposal).Error; err == nil {
			item.RejectionCount = latestProposal.RejectionCount
			item.LastReason = latestProposal.RejectionReason
		}

		result = append(result, item)
	}

	c.JSON(http.StatusOK, gin.H{
		"code":     0,
		"data":     result,
		"total":    total,
		"page":     page,
		"pageSize": pageSize,
	})
}

// AdminGetDisputedBooking 获取争议预约详情
func AdminGetDisputedBooking(c *gin.Context) {
	id := c.Param("id")

	var booking model.Booking
	if err := repository.DB.First(&booking, id).Error; err != nil {
		c.JSON(http.StatusOK, gin.H{"code": 1, "error": "预约不存在"})
		return
	}

	// 获取用户信息
	var user model.User
	repository.DB.Select("id, nickname, phone, avatar").First(&user, booking.UserID)

	// 获取商家信息
	var provider model.Provider
	repository.DB.Select("id, company_name, user_id").First(&provider, booking.ProviderID)
	var providerUser model.User
	if provider.UserID > 0 {
		_ = repository.DB.Select("nickname", "phone").First(&providerUser, provider.UserID).Error
	}
	providerName := service.ResolveProviderDisplayName(provider, func() *model.User {
		if provider.UserID > 0 {
			return &providerUser
		}
		return nil
	}())

	// 获取所有方案版本历史
	var proposals []model.Proposal
	repository.DB.Where("booking_id = ?", booking.ID).Order("version DESC").Find(&proposals)

	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"data": gin.H{
			"booking": booking,
			"user":    user,
			"provider": gin.H{
				"id":          provider.ID,
				"userId":      provider.UserID,
				"companyName": provider.CompanyName,
				"displayName": providerName,
			},
			"proposals": proposals,
		},
	})
}

// AdminResolveDispute 处理争议
func AdminResolveDispute(c *gin.Context) {
	id := c.Param("id")

	var req struct {
		Resolution string  `json:"resolution" binding:"required"` // refund_user, refund_partial, cancel_no_refund, reassign
		Reason     string  `json:"reason"`
		RefundRate float64 `json:"refundRate"` // 部分退款比例 (0-1)
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"code": 1, "error": "参数错误"})
		return
	}

	var booking model.Booking
	if err := repository.DB.First(&booking, id).Error; err != nil {
		c.JSON(http.StatusOK, gin.H{"code": 1, "error": "预约不存在"})
		return
	}

	if booking.Status != 5 {
		c.JSON(http.StatusOK, gin.H{"code": 1, "error": "该预约不在争议状态"})
		return
	}

	adminID, _ := c.Get("adminId")

	switch req.Resolution {
	case "refund_user":
		// 全额退还量房费给用户
		now := time.Now()
		refundAmount := booking.SurveyDeposit
		if refundAmount <= 0 {
			refundAmount = booking.IntentFee
		}
		booking.Status = 4 // Cancelled
		booking.IntentFeeRefunded = true
		booking.IntentFeeRefundReason = "平台裁定：全额退款 - " + req.Reason
		booking.IntentFeeRefundedAt = &now
		booking.SurveyDepositRefunded = true
		booking.SurveyDepositRefundAmt = refundAmount
		booking.SurveyDepositRefundAt = &now
		repository.DB.Save(&booking)

		// 发送通知
		notification := &model.Notification{
			UserID:  booking.UserID,
			Type:    "dispute_resolved",
			Title:   "争议处理结果",
			Content: "您的预约争议已处理，量房费将全额退还。",
			IsRead:  false,
		}
		repository.DB.Create(notification)

	case "refund_partial":
		// 部分退款
		now := time.Now()
		booking.Status = 4 // Cancelled
		booking.IntentFeeRefunded = true
		baseAmount := booking.SurveyDeposit
		if baseAmount <= 0 {
			baseAmount = booking.IntentFee
		}
		refundAmount := baseAmount * req.RefundRate
		booking.IntentFeeRefundReason = "平台裁定：部分退款 " + strconv.FormatFloat(refundAmount, 'f', 2, 64) + "元 - " + req.Reason
		booking.IntentFeeRefundedAt = &now
		booking.SurveyDepositRefunded = true
		booking.SurveyDepositRefundAmt = refundAmount
		booking.SurveyDepositRefundAt = &now
		repository.DB.Save(&booking)

	case "cancel_no_refund":
		// 取消预约，不退款（用户责任）
		booking.Status = 4 // Cancelled
		booking.IntentFeeRefunded = false
		booking.IntentFeeRefundReason = "平台裁定：不予退款 - " + req.Reason
		repository.DB.Save(&booking)

		// 发送通知
		notification := &model.Notification{
			UserID:  booking.UserID,
			Type:    "dispute_resolved",
			Title:   "争议处理结果",
			Content: "您的预约争议已处理，根据平台裁定量房费不予退还。原因：" + req.Reason,
			IsRead:  false,
		}
		repository.DB.Create(notification)

	case "reassign":
		// 重新分配商家（暂不实现复杂逻辑）
		c.JSON(http.StatusOK, gin.H{"code": 1, "error": "重新分配功能暂未开放"})
		return

	default:
		c.JSON(http.StatusOK, gin.H{"code": 1, "error": "无效的处理方式"})
		return
	}

	// 记录操作日志
	_ = adminID // 可用于记录是哪个管理员处理的

	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "处理成功"})
}
