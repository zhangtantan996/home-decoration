package cron

import (
	"fmt"
	"log"
	"time"

	"home-decoration-server/internal/repository"
	"home-decoration-server/internal/service"
)

// StartReconciliationAlertCron 启动对账差异告警升级定时任务
func StartReconciliationAlertCron() {
	go func() {
		ticker := time.NewTicker(1 * time.Hour)
		defer ticker.Stop()

		log.Println("[ReconciliationAlert] Reconciliation alert cron started, checking overdue differences every hour")

		// 立即执行一次
		if err := checkOverdueDifferences(); err != nil {
			log.Printf("[ReconciliationAlert] Failed to check overdue differences: %v", err)
		}

		for range ticker.C {
			if err := checkOverdueDifferences(); err != nil {
				log.Printf("[ReconciliationAlert] Failed to check overdue differences: %v", err)
			}
		}
	}()
}

// checkOverdueDifferences 检查超时未处理的差异并发送告警
func checkOverdueDifferences() error {
	reconciliationService := service.NewReconciliationService(repository.DB)

	// 查询超过24小时未处理的差异
	diffs, err := reconciliationService.GetPendingDifferencesOverdue(24)
	if err != nil {
		return fmt.Errorf("查询超时差异失败: %w", err)
	}

	if len(diffs) == 0 {
		log.Println("[ReconciliationAlert] No overdue differences found")
		return nil
	}

	log.Printf("[ReconciliationAlert] Found %d overdue differences", len(diffs))

	// 发送告警
	alertService := &service.SystemAlertService{}
	for _, diff := range diffs {
		description := fmt.Sprintf(
			"对账差异超过24小时未处理 - 类型: %s, 订单号: %s, 金额差异: %.2f元, 创建时间: %s",
			diff.DifferenceType,
			diff.OutTradeNo,
			diff.PlatformAmount-diff.ChannelAmount,
			diff.CreatedAt.Format(time.RFC3339),
		)

		actionURL := fmt.Sprintf("/admin/reconciliation/%d/differences?differenceId=%d",
			diff.ReconciliationID, diff.ID)

		_, _, err := alertService.UpsertAlert(&service.CreateSystemAlertInput{
			Type:        service.SystemAlertTypePaymentReconciliationDifference,
			Level:       "high",
			Scope:       fmt.Sprintf("对账差异-%d", diff.ID),
			ProjectID:   0,
			Description: description,
			ActionURL:   actionURL,
		})

		if err != nil {
			log.Printf("[ReconciliationAlert] Failed to create alert for difference %d: %v", diff.ID, err)
			continue
		}

		log.Printf("[ReconciliationAlert] Alert created for overdue difference %d", diff.ID)
	}

	return nil
}
