package cron

import (
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	"home-decoration-server/internal/service"
	"log"
	"time"

	"gorm.io/gorm"
)

// StartOrderCron 启动订单相关定时任务
func StartOrderCron() {
	go func() {
		ticker := time.NewTicker(1 * time.Minute)
		defer ticker.Stop()

		log.Println("[Cron] Order cron job started, checking expired orders every minute")

		for range ticker.C {
			notifyExpiringOrders()
			cancelExpiredOrders()
			syncPendingRefundOrders()
		}
	}()
}

func notifyExpiringOrders() {
	now := time.Now()
	horizon := now.Add(30 * time.Minute)

	var orders []model.Order
	if err := repository.DB.
		Where("status = ? AND expire_at IS NOT NULL AND expire_at >= ? AND expire_at < ?", model.OrderStatusPending, now, horizon).
		Find(&orders).Error; err != nil {
		log.Printf("[Cron] Failed to query expiring orders: %v", err)
		return
	}
	if len(orders) == 0 {
		return
	}

	dispatcher := service.NewNotificationDispatcher()
	for _, order := range orders {
		plan := loadCurrentPendingPaymentPlan(order.ID)
		ownerUserID := resolveOrderOwnerUserID(&order)
		providerUserID := resolveOrderProviderUserID(&order)
		if ownerUserID > 0 {
			if !hasNotificationForOrderRecipient(order.ID, model.NotificationTypeOrderExpiring, "user", ownerUserID) {
				dispatcher.NotifyOrderExpiring(ownerUserID, order.ID, order.OrderType, payableOrderAmount(&order))
			}
		}
		if order.OrderType == model.OrderTypeConstruction && plan != nil {
			userMissing := ownerUserID > 0 && !hasNotificationForOrderRecipient(order.ID, "payment.construction.expiring", "user", ownerUserID)
			providerMissing := providerUserID > 0 && !hasNotificationForOrderRecipient(order.ID, "payment.construction.expiring", "provider", providerUserID)
			if userMissing || providerMissing {
				dispatcher.NotifyConstructionPaymentExpiring(ownerUserID, providerUserID, order.ProjectID, order.ID, *plan)
			}
		}
	}
}

// cancelExpiredOrders 自动取消过期订单
func cancelExpiredOrders() {
	now := time.Now()

	var orders []model.Order
	if err := repository.DB.
		Where("status = ? AND expire_at IS NOT NULL AND expire_at < ?", model.OrderStatusPending, now).
		Find(&orders).Error; err != nil {
		log.Printf("[Cron] Failed to query expired orders: %v", err)
		return
	}
	if len(orders) == 0 {
		return
	}

	dispatcher := service.NewNotificationDispatcher()
	for idx := range orders {
		order := orders[idx]
		var expiredPlans []model.PaymentPlan
		err := repository.DB.Transaction(func(tx *gorm.DB) error {
			if err := tx.Model(&model.Order{}).
				Where("id = ?", order.ID).
				Update("status", model.OrderStatusCancelled).Error; err != nil {
				return err
			}
			var err error
			expiredPlans, err = service.ExpirePendingPaymentPlansForCron(tx, order.ID)
			return err
		})
		if err != nil {
			log.Printf("[Cron] Failed to cancel expired order %d: %v", order.ID, err)
			continue
		}
		ownerUserID := resolveOrderOwnerUserID(&order)
		providerUserID := resolveOrderProviderUserID(&order)
		if ownerUserID > 0 && !hasNotificationForOrderRecipient(order.ID, model.NotificationTypeOrderExpired, "user", ownerUserID) {
			dispatcher.NotifyOrderExpired(ownerUserID, order.ID, order.OrderType, payableOrderAmount(&order))
		}
		if order.OrderType == model.OrderTypeConstruction && len(expiredPlans) > 0 {
			userMissing := ownerUserID > 0 && !hasNotificationForOrderRecipient(order.ID, "payment.construction.expired", "user", ownerUserID)
			providerMissing := providerUserID > 0 && !hasNotificationForOrderRecipient(order.ID, "payment.construction.expired", "provider", providerUserID)
			if userMissing || providerMissing {
				dispatcher.NotifyConstructionPaymentExpired(ownerUserID, providerUserID, order.ProjectID, order.ID, expiredPlans[0])
			}
		}
	}

	if len(orders) > 0 {
		log.Printf("[Cron] Cancelled %d expired orders", len(orders))
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

func hasNotificationForOrderRecipient(orderID uint64, notificationType, userType string, userID uint64) bool {
	if orderID == 0 || notificationType == "" || userID == 0 || userType == "" {
		return false
	}
	var count int64
	if err := repository.DB.Model(&model.Notification{}).
		Where("related_type = ? AND related_id = ? AND type = ? AND user_type = ? AND user_id = ?", "order", orderID, notificationType, userType, userID).
		Count(&count).Error; err != nil {
		return false
	}
	return count > 0
}

func resolveOrderOwnerUserID(order *model.Order) uint64 {
	if order == nil {
		return 0
	}
	if order.BookingID > 0 {
		var booking model.Booking
		if err := repository.DB.Select("user_id").First(&booking, order.BookingID).Error; err == nil {
			return booking.UserID
		}
	}
	if order.ProjectID > 0 {
		var project model.Project
		if err := repository.DB.Select("owner_id").First(&project, order.ProjectID).Error; err == nil {
			return project.OwnerID
		}
	}
	if order.ProposalID > 0 {
		var proposal model.Proposal
		if err := repository.DB.Select("booking_id").First(&proposal, order.ProposalID).Error; err == nil && proposal.BookingID > 0 {
			var booking model.Booking
			if err := repository.DB.Select("user_id").First(&booking, proposal.BookingID).Error; err == nil {
				return booking.UserID
			}
		}
	}
	return 0
}

func resolveOrderProviderUserID(order *model.Order) uint64 {
	if order == nil || order.ProjectID == 0 {
		return 0
	}
	var project model.Project
	if err := repository.DB.Select("provider_id", "construction_provider_id").First(&project, order.ProjectID).Error; err != nil {
		return 0
	}
	providerID := project.ConstructionProviderID
	if providerID == 0 {
		providerID = project.ProviderID
	}
	if providerID == 0 {
		return 0
	}
	var provider model.Provider
	if err := repository.DB.Select("user_id").First(&provider, providerID).Error; err != nil {
		return 0
	}
	return provider.UserID
}

func loadCurrentPendingPaymentPlan(orderID uint64) *model.PaymentPlan {
	if orderID == 0 {
		return nil
	}
	var plan model.PaymentPlan
	if err := repository.DB.
		Where("order_id = ? AND status = ?", orderID, model.PaymentPlanStatusPending).
		Order("seq ASC, id ASC").
		First(&plan).Error; err != nil {
		return nil
	}
	return &plan
}

func payableOrderAmount(order *model.Order) float64 {
	if order == nil {
		return 0
	}
	amount := order.TotalAmount - order.Discount
	if amount < 0 {
		return 0
	}
	return amount
}
