package cron

import (
	"home-decoration-server/internal/service"
	"log"
	"time"
)

// StartEscrowReleaseCron 启动托管资金T+N自动放款定时任务
func StartEscrowReleaseCron() {
	go func() {
		// 每小时执行一次
		ticker := time.NewTicker(1 * time.Hour)
		defer ticker.Stop()

		// 首次启动延迟5分钟，等待系统就绪
		time.Sleep(5 * time.Minute)

		log.Println("[Cron] Escrow release cron started, running every hour")

		// 立即执行一次
		processEscrowReleases()

		// 然后按固定间隔执行
		for range ticker.C {
			processEscrowReleases()
		}
	}()
}

// processEscrowReleases 处理到期的托管资金释放
func processEscrowReleases() {
	// P1修复：添加错误恢复机制，防止单次失败导致整个定时任务停止
	defer func() {
		if r := recover(); r != nil {
			log.Printf("[Cron] Panic in processEscrowReleases: %v", r)
		}
	}()

	log.Println("[Cron] Starting escrow release task...")

	escrowSvc := &service.EscrowService{}
	count, err := escrowSvc.ProcessScheduledReleases()

	if err != nil {
		log.Printf("[Cron] Escrow release failed: %v", err)
		_, _, _ = (&service.SystemAlertService{}).UpsertAlert(&service.CreateSystemAlertInput{
			Type:        service.SystemAlertTypeEscrowReleaseFailure,
			Level:       "critical",
			Scope:       "自动放款/全局",
			Description: err.Error(),
			ActionURL:   "/risk/warnings",
		})
		return
	}
	_, _ = (&service.SystemAlertService{}).ResolveAlert(service.SystemAlertTypeEscrowReleaseFailure, "自动放款/全局", "自动放款任务恢复正常")

	if count > 0 {
		log.Printf("[Cron] Successfully released %d milestone payments", count)
	} else {
		log.Println("[Cron] No milestone payments due for release")
	}
}
