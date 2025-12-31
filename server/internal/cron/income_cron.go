package cron

import (
	"home-decoration-server/internal/service"
	"log"
	"time"
)

// StartIncomeCron 启动收入自动结算定时任务
func StartIncomeCron() {
	go func() {
		// 每天凌晨2点执行一次
		ticker := time.NewTicker(24 * time.Hour)
		defer ticker.Stop()

		// 首次启动时，延迟到凌晨2点
		now := time.Now()
		next := time.Date(now.Year(), now.Month(), now.Day(), 2, 0, 0, 0, now.Location())
		if next.Before(now) {
			next = next.Add(24 * time.Hour)
		}
		delay := next.Sub(now)

		log.Printf("[Cron] Income settlement will start at %s (in %v)", next.Format("2006-01-02 15:04:05"), delay)

		time.Sleep(delay)

		// 立即执行一次
		settleExpiredIncomes()

		// 然后按固定间隔执行
		for range ticker.C {
			settleExpiredIncomes()
		}
	}()
}

// settleExpiredIncomes 结算到期的商家收入
func settleExpiredIncomes() {
	log.Println("[Cron] Starting income settlement task...")

	incomeSvc := &service.MerchantIncomeService{}
	count, err := incomeSvc.BatchSettleExpiredIncomes()

	if err != nil {
		log.Printf("[Cron] Income settlement failed: %v", err)
		return
	}

	if count > 0 {
		log.Printf("[Cron] Successfully settled %d income records", count)
	} else {
		log.Println("[Cron] No income records to settle")
	}
}
