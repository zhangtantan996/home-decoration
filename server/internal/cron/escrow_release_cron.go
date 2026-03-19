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
	log.Println("[Cron] Starting escrow release task...")

	escrowSvc := &service.EscrowService{}
	count, err := escrowSvc.ProcessScheduledReleases()

	if err != nil {
		log.Printf("[Cron] Escrow release failed: %v", err)
		return
	}

	if count > 0 {
		log.Printf("[Cron] Successfully released %d milestone payments", count)
	} else {
		log.Println("[Cron] No milestone payments due for release")
	}
}
