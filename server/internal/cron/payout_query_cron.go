package cron

import (
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	"home-decoration-server/internal/service"
	"log"
	"time"
)

// StartPayoutQueryCron 启动出款查询定时任务
func StartPayoutQueryCron() {
	go func() {
		// 每10分钟执行一次
		ticker := time.NewTicker(10 * time.Minute)
		defer ticker.Stop()

		log.Println("[Cron] Payout query cron job started (interval: 10 minutes)")

		// 立即执行一次
		queryProcessingPayouts()

		// 然后按固定间隔执行
		for range ticker.C {
			queryProcessingPayouts()
		}
	}()
}

// queryProcessingPayouts 查询处理中的出款单
func queryProcessingPayouts() {
	log.Println("[Cron] Starting payout query task...")

	// 查询状态为 processing 的出款单
	var payouts []model.PayoutOrder
	if err := repository.DB.Where("status = ?", model.PayoutStatusProcessing).
		Order("created_at ASC").
		Find(&payouts).Error; err != nil {
		log.Printf("[Cron] Failed to query processing payouts: %v", err)
		return
	}

	if len(payouts) == 0 {
		log.Println("[Cron] No processing payouts found")
		return
	}

	log.Printf("[Cron] Found %d processing payouts", len(payouts))

	payoutService := service.NewPayoutRoutingService()
	successCount := 0
	failedCount := 0

	for _, payout := range payouts {
		result, err := payoutService.QueryPayoutStatus(payout.ID)
		if err != nil {
			log.Printf("[Cron] Failed to query payout #%d: %v", payout.ID, err)
			continue
		}

		if result.Status == model.PayoutStatusPaid {
			successCount++
			log.Printf("[Cron] Payout #%d succeeded", payout.ID)
		} else if result.Status == model.PayoutStatusFailed {
			failedCount++
			log.Printf("[Cron] Payout #%d failed: %s", payout.ID, result.FailureReason)
		}
	}

	log.Printf("[Cron] Payout query task completed: queried=%d, succeeded=%d, failed=%d",
		len(payouts), successCount, failedCount)
}
