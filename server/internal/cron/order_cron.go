package cron

import (
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	"home-decoration-server/internal/service"
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
			syncPendingRefundOrders()
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

func syncPendingRefundOrders() {
	count, err := service.NewPaymentService(nil).SyncPendingRefundOrders(20)
	if err != nil {
		log.Printf("[Cron] Failed to sync pending refunds: %v", err)
		_, _, _ = (&service.SystemAlertService{}).UpsertAlert(&service.CreateSystemAlertInput{
			Type:        service.SystemAlertTypeRefundSyncFailure,
			Level:       "critical",
			Scope:       "退款同步/全局",
			Description: err.Error(),
			ActionURL:   "/risk/warnings",
		})
		return
	}
	_, _ = (&service.SystemAlertService{}).ResolveAlert(service.SystemAlertTypeRefundSyncFailure, "退款同步/全局", "退款同步任务恢复正常")
	if count > 0 {
		log.Printf("[Cron] Synced %d pending refund orders", count)
	}
}
