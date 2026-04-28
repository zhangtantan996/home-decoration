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

// PaymentTimeoutJob 超时支付单自动关闭定时任务
type PaymentTimeoutJob struct{}

var syncPaymentStateForTimeout = func(paymentID uint64) (*model.PaymentOrder, error) {
	return (&service.PaymentService{}).SyncPaymentState(paymentID)
}

// NewPaymentTimeoutJob 创建超时支付单关闭任务实例
func NewPaymentTimeoutJob() *PaymentTimeoutJob {
	return &PaymentTimeoutJob{}
}

// Run 执行超时支付单关闭任务
func (j *PaymentTimeoutJob) Run() {
	// P1修复：添加错误恢复机制，防止单次失败导致整个定时任务停止
	defer func() {
		if r := recover(); r != nil {
			log.Printf("[Cron] Panic in PaymentTimeoutJob.Run: %v", r)
		}
	}()

	now := time.Now()

	// 查询状态为 pending 或 launching 且已过期的支付单
	var payments []model.PaymentOrder
	if err := repository.DB.
		Where("(status = ? OR status = ?) AND expired_at IS NOT NULL AND expired_at < ?",
			model.PaymentStatusPending, model.PaymentStatusLaunching, now).
		Order("expired_at ASC").
		Limit(100).
		Find(&payments).Error; err != nil {
		log.Printf("[Cron] Failed to query expired payments: %v", err)
		return
	}

	if len(payments) == 0 {
		return
	}

	log.Printf("[Cron] Found %d expired payments to close", len(payments))

	// 统计执行结果
	closedCount := 0
	failedCount := 0

	// 遍历每个支付单进行关单处理
	for idx := range payments {
		payment := payments[idx]

		if err := j.closeExpiredPayment(&payment); err != nil {
			log.Printf("[Cron] Failed to close expired payment %d (out_trade_no=%s): %v",
				payment.ID, payment.OutTradeNo, err)
			failedCount++
			continue
		}

		closedCount++
	}

	log.Printf("[Cron] Payment timeout job completed: closed=%d, failed=%d", closedCount, failedCount)
}

// closeExpiredPayment 关闭单个过期支付单
func (j *PaymentTimeoutJob) closeExpiredPayment(payment *model.PaymentOrder) error {
	ctx := context.Background()

	// 调用微信关单API
	if err := j.callCloseOrderAPI(ctx, payment); err != nil {
		// 如果关单失败，查单确认真实状态
		if queryErr := j.verifyPaymentStatus(ctx, payment); queryErr != nil {
			return err // 返回原始关单错误
		}
		// 查单后发现已支付或已关闭，无需继续处理
		return nil
	}

	// 使用事务更新支付单状态为 closed
	return repository.DB.Transaction(func(tx *gorm.DB) error {
		// 更新支付单状态
		if err := tx.Model(payment).Updates(map[string]any{
			"status": model.PaymentStatusClosed,
		}).Error; err != nil {
			return err
		}
		payment.Status = model.PaymentStatusClosed
		if err := service.EnqueuePaymentClosedOutboxTx(tx, payment, "timeout"); err != nil {
			return err
		}

		// 释放关联业务对象的锁定状态（如果有的话）
		if err := j.releaseBusinessLock(tx, payment); err != nil {
			log.Printf("[Cron] Failed to release business lock for payment %d: %v", payment.ID, err)
			// 不阻断主流程，仅记录日志
		}

		log.Printf("[Cron] Closed expired payment %d (out_trade_no=%s)", payment.ID, payment.OutTradeNo)
		return nil
	})
}

// callCloseOrderAPI 调用微信关单API
func (j *PaymentTimeoutJob) callCloseOrderAPI(ctx context.Context, payment *model.PaymentOrder) error {
	// 根据支付渠道选择对应的网关
	switch payment.Channel {
	case model.PaymentChannelWechat:
		gateway := service.NewWechatPayGateway()
		return gateway.CloseOrder(ctx, payment.OutTradeNo)
	case model.PaymentChannelAlipay:
		// 支付宝暂不支持关单，直接返回成功
		log.Printf("[Cron] Alipay does not support close order, skip payment %d", payment.ID)
		return nil
	default:
		log.Printf("[Cron] Unsupported payment channel: %s for payment %d", payment.Channel, payment.ID)
		return nil
	}
}

// verifyPaymentStatus 查单确认支付单真实状态
func (j *PaymentTimeoutJob) verifyPaymentStatus(ctx context.Context, payment *model.PaymentOrder) error {
	// 根据支付渠道选择对应的网关
	switch payment.Channel {
	case model.PaymentChannelWechat:
		gateway := service.NewWechatPayGateway()
		result, err := gateway.QueryCollectOrder(ctx, payment)
		if err != nil {
			return err
		}
		return j.handleQueryResult(payment, result)
	case model.PaymentChannelAlipay:
		// 支付宝暂不支持，跳过
		return nil
	default:
		return nil
	}
}

// handleQueryResult 处理查单结果
func (j *PaymentTimeoutJob) handleQueryResult(payment *model.PaymentOrder, result *service.PaymentChannelTradeResult) error {
	// 解释交易状态
	newStatus := j.interpretTradeStatus(payment.Channel, result.TradeStatus)
	if newStatus == "" || newStatus == payment.Status {
		return nil
	}

	// 如果查单发现已支付，触发补偿逻辑
	if newStatus == model.PaymentStatusPaid {
		log.Printf("[Cron] Payment %d is actually paid, trigger compensation (out_trade_no=%s)",
			payment.ID, payment.OutTradeNo)
		_, err := syncPaymentStateForTimeout(payment.ID)
		return err
	}

	// 更新为真实状态
	return repository.DB.Model(payment).Update("status", newStatus).Error
}

// interpretTradeStatus 解释支付渠道的交易状态
func (j *PaymentTimeoutJob) interpretTradeStatus(channel, tradeStatus string) string {
	switch channel {
	case model.PaymentChannelWechat:
		switch tradeStatus {
		case "SUCCESS":
			return model.PaymentStatusPaid
		case "CLOSED", "REVOKED":
			return model.PaymentStatusClosed
		case "PAYERROR":
			return model.PaymentStatusFailed
		default:
			return model.PaymentStatusPending
		}
	case model.PaymentChannelAlipay:
		switch tradeStatus {
		case "TRADE_SUCCESS", "TRADE_FINISHED":
			return model.PaymentStatusPaid
		case "TRADE_CLOSED":
			return model.PaymentStatusClosed
		default:
			return model.PaymentStatusPending
		}
	default:
		return ""
	}
}

// releaseBusinessLock 释放关联业务对象的锁定状态
func (j *PaymentTimeoutJob) releaseBusinessLock(tx *gorm.DB, payment *model.PaymentOrder) error {
	// 根据业务类型释放对应的锁定状态
	switch payment.BizType {
	case model.PaymentBizTypeBookingIntent:
		// 预约意向金：释放预约锁定
		return tx.Model(&model.Booking{}).
			Where("id = ? AND payment_status = ?", payment.BizID, "pending").
			Update("payment_status", "cancelled").Error

	case model.PaymentBizTypeBookingSurveyDeposit:
		// 量房定金：释放预约锁定
		return tx.Model(&model.Booking{}).
			Where("id = ? AND survey_deposit_status = ?", payment.BizID, "pending").
			Update("survey_deposit_status", "cancelled").Error

	case model.PaymentBizTypeOrder:
		// 订单支付：订单状态由 order_cron 处理，这里不做处理
		return nil

	case model.PaymentBizTypePaymentPlan:
		// 分期支付计划：由 order_cron 处理，这里不做处理
		return nil

	case model.PaymentBizTypeMerchantBond:
		// 商户保证金：释放保证金账户锁定
		return tx.Model(&model.MerchantBondAccount{}).
			Where("provider_id IN (SELECT provider_id FROM payment_orders WHERE id = ?)", payment.ID).
			Update("status", model.MerchantBondAccountStatusDisabled).Error

	default:
		// 未知业务类型，不做处理
		return nil
	}
}

// StartPaymentTimeoutCron 启动超时支付单关闭定时任务
func StartPaymentTimeoutCron() {
	job := NewPaymentTimeoutJob()

	go func() {
		ticker := time.NewTicker(10 * time.Minute)
		defer ticker.Stop()

		log.Println("[Cron] Payment timeout cron job started, checking every 10 minutes")

		// 立即执行一次
		job.Run()

		for range ticker.C {
			job.Run()
		}
	}()
}
