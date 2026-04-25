package cron

import (
	"context"
	"log"
	"time"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/service"
)

// PaymentReconciliationJob 支付对账定时任务
type PaymentReconciliationJob struct {
	reconciliationService *service.ReconciliationService
	wechatGateway         *service.WechatPayGateway
}

// NewPaymentReconciliationJob 创建支付对账任务实例
func NewPaymentReconciliationJob() *PaymentReconciliationJob {
	return &PaymentReconciliationJob{
		reconciliationService: service.NewReconciliationService(nil),
		wechatGateway:         service.NewWechatPayGateway(),
	}
}

// Run 执行支付对账任务
func (j *PaymentReconciliationJob) Run() {
	log.Println("[Cron] Starting payment reconciliation job")

	// 对账日期：T-1日（昨天）
	yesterday := time.Now().AddDate(0, 0, -1)
	reconcileDate := time.Date(yesterday.Year(), yesterday.Month(), yesterday.Day(), 0, 0, 0, 0, time.Local)
	billDateStr := reconcileDate.Format("2006-01-02")

	log.Printf("[Cron] Reconciling payment orders for date: %s", billDateStr)

	// 创建对账记录
	record, err := j.reconciliationService.CreateReconciliationRecord(
		reconcileDate,
		"payment",
		model.PaymentChannelWechat,
	)
	if err != nil {
		log.Printf("[Cron] Failed to create reconciliation record: %v", err)
		return
	}

	log.Printf("[Cron] Created reconciliation record ID=%d", record.ID)

	// 执行对账
	if err := j.reconcile(context.Background(), record, billDateStr); err != nil {
		log.Printf("[Cron] Reconciliation failed: %v", err)
		// 更新记录为失败状态
		_ = j.reconciliationService.UpdateReconciliationRecord(
			record.ID, 0, 0, 0, 0, 0, "failed", err.Error(),
		)
		return
	}

	log.Printf("[Cron] Payment reconciliation completed for %s", billDateStr)
}

// reconcile 执行对账逻辑
func (j *PaymentReconciliationJob) reconcile(ctx context.Context, record *model.ReconciliationRecord, billDateStr string) error {
	// 1. 下载微信账单
	log.Printf("[Cron] Downloading Wechat bill for %s", billDateStr)
	billData, err := j.wechatGateway.DownloadBill(ctx, billDateStr, "ALL")
	if err != nil {
		// 如果是"暂未实现"错误，记录日志并等待下次执行
		if err.Error() == "微信支付账单下载功能暂未实现" {
			log.Printf("[Cron] Wechat bill download not implemented yet, skipping reconciliation")
			return j.reconciliationService.UpdateReconciliationRecord(
				record.ID, 0, 0, 0, 0, 0, "failed",
				"微信支付账单下载功能暂未实现，等待功能开发完成",
			)
		}
		return err
	}

	log.Printf("[Cron] Downloaded bill data: %d bytes", len(billData))

	// 2. 解析账单CSV
	billRecords, err := j.reconciliationService.ParseWechatBill(billData)
	if err != nil {
		return err
	}

	log.Printf("[Cron] Parsed %d bill records", len(billRecords))

	// 3. 对比订单数据
	diffs, err := j.reconciliationService.CompareOrders(ctx, record.ReconcileDate, billRecords)
	if err != nil {
		return err
	}

	log.Printf("[Cron] Found %d differences", len(diffs))

	// 4. 记录差异明细
	var totalAmount float64
	var differenceAmount float64

	for _, billRecord := range billRecords {
		totalAmount += billRecord.OrderAmount
	}

	for _, diff := range diffs {
		if err := j.reconciliationService.AddDifference(record.ID, &diff); err != nil {
			log.Printf("[Cron] Failed to add difference: %v", err)
			continue
		}
		// 累计差异金额
		if diff.DifferenceType == "missing_in_platform" {
			differenceAmount += diff.ChannelAmount
		} else if diff.DifferenceType == "missing_in_channel" {
			differenceAmount += diff.PlatformAmount
		} else if diff.DifferenceType == "amount_mismatch" {
			differenceAmount += abs(diff.PlatformAmount - diff.ChannelAmount)
		}
	}

	// 5. 更新对账记录
	totalCount := len(billRecords)
	matchedCount := totalCount - len(diffs)
	differenceCount := len(diffs)

	if err := j.reconciliationService.UpdateReconciliationRecord(
		record.ID,
		totalCount,
		matchedCount,
		differenceCount,
		totalAmount,
		differenceAmount,
		"completed",
		"",
	); err != nil {
		return err
	}

	// 6. 如果发现差异，记录告警日志
	if differenceCount > 0 {
		log.Printf("[Cron] ⚠️ ALERT: Found %d reconciliation differences, total difference amount: %.2f",
			differenceCount, differenceAmount)
		// TODO: 调用告警服务（如果存在）
	}

	return nil
}

// abs 返回浮点数的绝对值
func abs(x float64) float64 {
	if x < 0 {
		return -x
	}
	return x
}

// StartPaymentReconciliationCron 启动支付对账定时任务
func StartPaymentReconciliationCron() {
	job := NewPaymentReconciliationJob()

	go func() {
		// 每日凌晨2点执行
		ticker := time.NewTicker(24 * time.Hour)
		defer ticker.Stop()

		log.Println("[Cron] Payment reconciliation cron job started, running daily at 2:00 AM")

		// 计算下次执行时间（今天或明天的凌晨2点）
		now := time.Now()
		next := time.Date(now.Year(), now.Month(), now.Day(), 2, 0, 0, 0, time.Local)
		if now.After(next) {
			next = next.Add(24 * time.Hour)
		}

		// 等待到下次执行时间
		waitDuration := next.Sub(now)
		log.Printf("[Cron] Next reconciliation scheduled at: %s (in %v)", next.Format("2006-01-02 15:04:05"), waitDuration)
		time.Sleep(waitDuration)

		// 立即执行一次
		job.Run()

		// 之后每24小时执行一次
		for range ticker.C {
			job.Run()
		}
	}()
}
