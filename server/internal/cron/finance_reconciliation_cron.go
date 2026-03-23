package cron

import (
	"fmt"
	"log"
	"time"

	"home-decoration-server/internal/service"
)

// StartFinanceReconciliationCron 启动资金日对账任务
func StartFinanceReconciliationCron() {
	go func() {
		ticker := time.NewTicker(24 * time.Hour)
		defer ticker.Stop()

		now := time.Now()
		next := time.Date(now.Year(), now.Month(), now.Day(), 5, 30, 0, 0, now.Location())
		if !next.After(now) {
			next = next.Add(24 * time.Hour)
		}
		delay := next.Sub(now)

		log.Printf("[Cron] Finance reconciliation will start at %s (in %v)", next.Format("2006-01-02 15:04:05"), delay)
		time.Sleep(delay)

		runFinanceReconciliation()

		for range ticker.C {
			runFinanceReconciliation()
		}
	}()
}

func runFinanceReconciliation() {
	targetDate := time.Now().AddDate(0, 0, -1)
	scope := "资金对账/" + targetDate.Format("2006-01-02")
	log.Printf("[Cron] Starting finance reconciliation for %s", targetDate.Format("2006-01-02"))

	result, err := (&service.FinanceReconciliationService{}).RunDailyReconciliation(targetDate)
	if err != nil {
		log.Printf("[Cron] Finance reconciliation failed: %v", err)
		_, _, _ = (&service.SystemAlertService{}).UpsertAlert(&service.CreateSystemAlertInput{
			Type:        service.SystemAlertTypeFinanceReconciliationFailed,
			Level:       "critical",
			Scope:       scope,
			Description: err.Error(),
			ActionURL:   "/risk/warnings",
		})
		return
	}

	if result.FindingCount > 0 {
		_, _, _ = (&service.SystemAlertService{}).UpsertAlert(&service.CreateSystemAlertInput{
			Type:        service.SystemAlertTypeFinanceReconciliationFailed,
			Level:       "high",
			Scope:       "资金对账/" + result.ReconcileDate,
			Description: logFinanceReconciliationFinding(result),
			ActionURL:   "/risk/warnings",
		})
	} else {
		_, _ = (&service.SystemAlertService{}).ResolveAlert(service.SystemAlertTypeFinanceReconciliationFailed, "资金对账/"+result.ReconcileDate, "对账恢复正常")
	}

	log.Printf("[Cron] Finance reconciliation finished: date=%s status=%s findings=%d", result.ReconcileDate, result.Status, result.FindingCount)
}

func logFinanceReconciliationFinding(result *service.FinanceReconciliationView) string {
	if result == nil {
		return "资金对账失败"
	}
	return fmt.Sprintf("资金对账发现 %d 条异常，状态=%s", result.FindingCount, result.Status)
}
