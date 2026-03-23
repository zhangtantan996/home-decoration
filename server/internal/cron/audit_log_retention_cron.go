package cron

import (
	"log"
	"time"

	"home-decoration-server/internal/service"
)

// StartAuditLogRetentionCron 启动审计日志保留策略清理任务
func StartAuditLogRetentionCron(retentionDays int) {
	effectiveRetentionDays := service.ResolveAuditRetentionDays(retentionDays)

	go func() {
		ticker := time.NewTicker(24 * time.Hour)
		defer ticker.Stop()

		now := time.Now()
		next := time.Date(now.Year(), now.Month(), now.Day(), 4, 0, 0, 0, now.Location())
		if !next.After(now) {
			next = next.Add(24 * time.Hour)
		}
		delay := next.Sub(now)

		log.Printf("[Cron] Audit log retention will start at %s (in %v), keep=%d day(s)", next.Format("2006-01-02 15:04:05"), delay, effectiveRetentionDays)
		time.Sleep(delay)

		cleanupExpiredAuditLogs(effectiveRetentionDays)

		for range ticker.C {
			cleanupExpiredAuditLogs(effectiveRetentionDays)
		}
	}()
}

func cleanupExpiredAuditLogs(retentionDays int) {
	log.Printf("[Cron] Starting audit log retention cleanup, keep=%d day(s)", retentionDays)

	auditLogSvc := &service.AuditLogService{}
	count, err := auditLogSvc.CleanupExpiredAuditLogs(retentionDays)
	if err != nil {
		log.Printf("[Cron] Audit log retention cleanup failed: %v", err)
		return
	}

	if count > 0 {
		log.Printf("[Cron] Audit log retention cleanup removed %d expired records", count)
	} else {
		log.Println("[Cron] Audit log retention cleanup found no expired records")
	}
}
