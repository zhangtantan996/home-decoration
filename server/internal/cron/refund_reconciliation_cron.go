package cron

import (
	"context"
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	"home-decoration-server/internal/service"
	"log"
	"time"

	"gorm.io/gorm"
)

// RefundReconciliationJob 退款对账定时任务
type RefundReconciliationJob struct{}

// NewRefundReconciliationJob 创建退款对账任务实例
func NewRefundReconciliationJob() *RefundReconciliationJob {
	return &RefundReconciliationJob{}
}

// Run 执行退款对账任务
func (j *RefundReconciliationJob) Run() {
	ctx := context.Background()

	// 查询状态为 processing 且创建时间超过1小时的退款单
	oneHourAgo := time.Now().Add(-1 * time.Hour)
	var refunds []model.RefundOrder

	if err := repository.DB.
		Where("status = ? AND created_at < ?", model.RefundOrderStatusProcessing, oneHourAgo).
		Order("created_at ASC").
		Limit(100).
		Find(&refunds).Error; err != nil {
		log.Printf("[Cron] Failed to query processing refunds: %v", err)
		return
	}

	if len(refunds) == 0 {
		return
	}

	log.Printf("[Cron] Found %d processing refunds to reconcile", len(refunds))

	// 统计执行结果
	queryCount := 0
	updateCount := 0
	failCount := 0

	// 遍历每个退款单进行对账
	for idx := range refunds {
		refund := refunds[idx]
		queryCount++

		if err := j.reconcileRefund(ctx, &refund); err != nil {
			log.Printf("[Cron] Failed to reconcile refund %d (out_refund_no=%s): %v",
				refund.ID, refund.OutRefundNo, err)
			failCount++
			continue
		}

		updateCount++
	}

	log.Printf("[Cron] Refund reconciliation completed: queried=%d, updated=%d, failed=%d",
		queryCount, updateCount, failCount)
}

// reconcileRefund 对单个退款单进行对账
func (j *RefundReconciliationJob) reconcileRefund(ctx context.Context, refund *model.RefundOrder) error {
	// 查询关联的支付单
	var paymentOrder model.PaymentOrder
	if err := repository.DB.First(&paymentOrder, refund.PaymentOrderID).Error; err != nil {
		return err
	}

	// 调用微信/支付宝退款查询API
	var result *service.RefundQueryResult
	var err error

	switch paymentOrder.Channel {
	case model.PaymentChannelWechat:
		gateway := service.NewWechatPayGateway()
		result, err = gateway.QueryRefund(ctx, refund.OutRefundNo)
	case model.PaymentChannelAlipay:
		gateway := service.NewAlipayGateway()
		alipayResult, queryErr := gateway.QueryRefund(ctx, &paymentOrder, refund)
		if queryErr != nil {
			err = queryErr
		} else {
			// 转换支付宝结果为统一格式
			result = &service.RefundQueryResult{
				OutRefundNo:     alipayResult.OutRefundNo,
				ProviderTradeNo: alipayResult.TradeNo,
				OutTradeNo:      alipayResult.OutTradeNo,
				RefundStatus:    j.mapAlipayRefundStatus(alipayResult),
				Success:         alipayResult.Success,
				Pending:         alipayResult.Pending,
				FailureReason:   alipayResult.FailureReason,
				RawJSON:         alipayResult.RawJSON,
			}
		}
	default:
		log.Printf("[Cron] Unsupported payment channel: %s", paymentOrder.Channel)
		return nil
	}

	if err != nil {
		log.Printf("[Cron] Failed to query refund from gateway: %v", err)
		return err
	}

	// 根据查询结果更新退款单状态
	return j.updateRefundStatus(refund, result)
}

// updateRefundStatus 根据网关查询结果更新退款单状态
func (j *RefundReconciliationJob) updateRefundStatus(refund *model.RefundOrder, result *service.RefundQueryResult) error {
	if result == nil {
		return nil
	}

	// 记录原始状态
	oldStatus := refund.Status

	// 根据微信返回状态映射平台状态
	newStatus := j.mapRefundStatus(result.RefundStatus)

	// 如果状态未变化，跳过更新
	if newStatus == oldStatus {
		return nil
	}

	// 使用事务更新状态
	return repository.DB.Transaction(func(tx *gorm.DB) error {
		// 更新退款单状态
		updates := map[string]interface{}{
			"status": newStatus,
		}

		if newStatus == model.RefundOrderStatusSucceeded {
			now := time.Now()
			updates["succeeded_at"] = &now
		} else if newStatus == model.RefundOrderStatusFailed {
			updates["failure_reason"] = result.FailureReason
		}

		if err := tx.Model(refund).Updates(updates).Error; err != nil {
			return err
		}

		// 如果状态不一致，记录到对账差异表
		if j.shouldRecordDifference(oldStatus, newStatus) {
			difference := &model.ReconciliationDifference{
				DifferenceType:  "status_mismatch",
				OutTradeNo:      result.OutTradeNo,
				ProviderTradeNo: result.ProviderTradeNo,
				PlatformStatus:  oldStatus,
				ChannelStatus:   result.RefundStatus,
				Resolved:        true,
			}
			now := time.Now()
			difference.ResolvedAt = &now

			if err := tx.Create(difference).Error; err != nil {
				log.Printf("[Cron] Failed to record reconciliation difference: %v", err)
			}
		}

		log.Printf("[Cron] Refund %d status updated: %s -> %s (out_refund_no=%s)",
			refund.ID, oldStatus, newStatus, refund.OutRefundNo)

		return nil
	})
}

// mapRefundStatus 映射微信退款状态到平台状态
func (j *RefundReconciliationJob) mapRefundStatus(wechatStatus string) string {
	switch wechatStatus {
	case "SUCCESS":
		return model.RefundOrderStatusSucceeded
	case "CLOSED", "ABNORMAL":
		return model.RefundOrderStatusFailed
	case "PROCESSING":
		return model.RefundOrderStatusProcessing
	default:
		return model.RefundOrderStatusProcessing
	}
}

// shouldRecordDifference 判断是否需要记录对账差异
func (j *RefundReconciliationJob) shouldRecordDifference(oldStatus, newStatus string) bool {
	// 只有状态发生实质性变化时才记录差异
	if oldStatus == newStatus {
		return false
	}

	// processing -> succeeded/failed 是正常流程，不记录差异
	if oldStatus == model.RefundOrderStatusProcessing {
		return false
	}

	return true
}

// mapAlipayRefundStatus 映射支付宝退款状态到统一格式
func (j *RefundReconciliationJob) mapAlipayRefundStatus(result *service.AlipayRefundResult) string {
	if result.Success {
		return "SUCCESS"
	}
	if result.Pending {
		return "PROCESSING"
	}
	return "CLOSED"
}

// StartRefundReconciliationCron 启动退款对账定时任务
func StartRefundReconciliationCron() {
	job := NewRefundReconciliationJob()

	go func() {
		ticker := time.NewTicker(1 * time.Hour)
		defer ticker.Stop()

		log.Println("[Cron] Refund reconciliation cron job started, checking every 1 hour")

		// 立即执行一次
		job.Run()

		for range ticker.C {
			job.Run()
		}
	}()
}
