package cron

import (
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	"home-decoration-server/internal/service"
	"log"
	"time"
)

// PaymentCompensationJob 支付查单补偿定时任务
type PaymentCompensationJob struct{}

// NewPaymentCompensationJob 创建支付查单补偿任务实例
func NewPaymentCompensationJob() *PaymentCompensationJob {
	return &PaymentCompensationJob{}
}

// Run 执行支付查单补偿任务
func (j *PaymentCompensationJob) Run() {
	// 查询状态为 pending 且创建时间超过5分钟的支付单
	fiveMinutesAgo := time.Now().Add(-5 * time.Minute)
	var payments []model.PaymentOrder

	if err := repository.DB.
		Where("status = ? AND created_at < ?", model.PaymentStatusPending, fiveMinutesAgo).
		Order("created_at ASC").
		Limit(100).
		Find(&payments).Error; err != nil {
		log.Printf("[Cron] Failed to query pending payments: %v", err)
		return
	}

	if len(payments) == 0 {
		return
	}

	log.Printf("[Cron] Found %d pending payments to compensate", len(payments))

	// 统计执行结果
	queryCount := 0
	updateCount := 0
	failCount := 0

	// 遍历每个支付单进行查单补偿
	for idx := range payments {
		payment := payments[idx]
		queryCount++

		if err := j.compensatePayment(&payment); err != nil {
			log.Printf("[Cron] Failed to compensate payment %d (out_trade_no=%s): %v",
				payment.ID, payment.OutTradeNo, err)
			failCount++
			continue
		}

		updateCount++
	}

	log.Printf("[Cron] Payment compensation completed: queried=%d, updated=%d, failed=%d",
		queryCount, updateCount, failCount)
}

// compensatePayment 对单个支付单进行查单补偿
func (j *PaymentCompensationJob) compensatePayment(payment *model.PaymentOrder) error {
	// 使用 PaymentService 的 SyncPaymentState 方法进行查单补偿
	paymentService := service.NewPaymentService(nil)

	updatedPayment, err := paymentService.SyncPaymentState(payment.ID)
	if err != nil {
		return err
	}

	// 如果状态发生变化，记录日志
	if updatedPayment.Status != payment.Status {
		log.Printf("[Cron] Payment %d status changed: %s -> %s (out_trade_no=%s)",
			payment.ID, payment.Status, updatedPayment.Status, payment.OutTradeNo)
	}

	return nil
}

// StartPaymentCompensationCron 启动支付查单补偿定时任务
func StartPaymentCompensationCron() {
	job := NewPaymentCompensationJob()

	go func() {
		ticker := time.NewTicker(5 * time.Minute)
		defer ticker.Stop()

		log.Println("[Cron] Payment compensation cron job started, checking every 5 minutes")

		// 立即执行一次
		job.Run()

		for range ticker.C {
			job.Run()
		}
	}()
}
