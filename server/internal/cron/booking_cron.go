package cron

import (
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	"home-decoration-server/internal/service"
	"log"
	"strconv"
	"time"
)

// StartBookingCron 启动预约相关定时任务
func StartBookingCron() {
	log.Println("[Cron] Starting booking timeout monitoring...")

	go func() {
		// 每5分钟检查一次
		ticker := time.NewTicker(5 * time.Minute)
		defer ticker.Stop()

		for range ticker.C {
			handleMerchantTimeout()
			handleUserConfirmTimeout()
		}
	}()
}

// handleMerchantTimeout 处理商家48小时超时未响应
func handleMerchantTimeout() {
	// P1修复：添加错误恢复机制，防止单次失败导致整个定时任务停止
	defer func() {
		if r := recover(); r != nil {
			log.Printf("[Cron] Panic in handleMerchantTimeout: %v", r)
		}
	}()

	refundSvc := &service.RefundService{}

	// 批量退款超时预约
	count, err := refundSvc.BatchRefundTimeoutBookings()
	if err != nil {
		log.Printf("[Cron] Failed to process merchant timeout: %v", err)
		return
	}

	if count > 0 {
		log.Printf("[Cron] Processed %d merchant timeout bookings", count)
	}
}

// handleUserConfirmTimeout 处理用户14天超时未确认方案
func handleUserConfirmTimeout() {
	// P1修复：添加错误恢复机制，防止单次失败导致整个定时任务停止
	defer func() {
		if r := recover(); r != nil {
			log.Printf("[Cron] Panic in handleUserConfirmTimeout: %v", r)
		}
	}()

	now := time.Now()

	// 查询超时的待确认方案
	var proposals []model.Proposal
	if err := repository.DB.Where(
		"status = ? AND user_response_deadline IS NOT NULL AND user_response_deadline < ?",
		model.ProposalStatusPending, now,
	).Find(&proposals).Error; err != nil {
		log.Printf("[Cron] Failed to query timeout proposals: %v", err)
		return
	}

	if len(proposals) == 0 {
		return
	}

	log.Printf("[Cron] Found %d timeout proposals", len(proposals))

	notifSvc := &service.NotificationService{}
	successCount := 0

	for _, proposal := range proposals {
		// 标记方案为已拒绝（用户超时视为拒绝）
		timeout := now
		proposal.Status = model.ProposalStatusRejected
		proposal.RejectionReason = "用户超时未确认（14天期限）"
		proposal.RejectedAt = &timeout

		if err := repository.DB.Save(&proposal).Error; err != nil {
			log.Printf("[Cron] Failed to update proposal %d: %v", proposal.ID, err)
			continue
		}

		// 更新预约状态为已取消（用户超时不退款）
		var booking model.Booking
		if err := repository.DB.First(&booking, proposal.BookingID).Error; err == nil {
			booking.Status = 4 // Cancelled
			repository.DB.Save(&booking)

			// 通知用户超时
			notifData := map[string]interface{}{
				"bookingId":  booking.ID,
				"proposalId": proposal.ID,
			}
			_ = notifSvc.Create(&service.CreateNotificationInput{
				UserID:      booking.UserID,
				UserType:    "user",
				Title:       "方案确认超时",
				Content:     "您的方案确认已超时（14天期限），预约已自动取消。量房费已扣除，不予退还。",
				Type:        "proposal.timeout",
				RelatedID:   proposal.ID,
				RelatedType: "proposal",
				ActionURL:   "/bookings/" + strconv.FormatUint(booking.ID, 10),
				Extra:       notifData,
			})

			// 通知商家
			var provider model.Provider
			if err := repository.DB.First(&provider, booking.ProviderID).Error; err == nil {
				_ = notifSvc.Create(&service.CreateNotificationInput{
					UserID:      provider.UserID,
					UserType:    "provider",
					Title:       "用户确认超时",
					Content:     "用户方案确认已超时（14天期限），预约已取消",
					Type:        "proposal.timeout",
					RelatedID:   proposal.ID,
					RelatedType: "proposal",
					ActionURL:   "/proposals",
					Extra:       notifData,
				})
			}
		}

		successCount++
	}

	log.Printf("[Cron] Processed %d/%d timeout proposals", successCount, len(proposals))
}
