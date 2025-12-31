package cron

import (
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	"log"
	"time"
)

// StartOrderCron 启动订单相关定时任务
func StartOrderCron() {
	go func() {
		ticker := time.NewTicker(1 * time.Minute)
		defer ticker.Stop()

		log.Println("[Cron] Order cron job started, checking expired orders every minute")

		for range ticker.C {
			cancelExpiredOrders()
		}
	}()
}

// cancelExpiredOrders 自动取消过期订单
func cancelExpiredOrders() {
	now := time.Now()

	result := repository.DB.Model(&model.Order{}).
		Where("status = ? AND expire_at IS NOT NULL AND expire_at < ?", model.OrderStatusPending, now).
		Update("status", model.OrderStatusCancelled)

	if result.Error != nil {
		log.Printf("[Cron] Failed to cancel expired orders: %v", result.Error)
		return
	}

	if result.RowsAffected > 0 {
		log.Printf("[Cron] Cancelled %d expired orders", result.RowsAffected)
	}
}
