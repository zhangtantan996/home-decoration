package cron

import (
	"fmt"
	"log"
	"math"
	"time"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	"home-decoration-server/internal/service"

	"gorm.io/gorm"
)

// StartSettlementReconciliationCron 启动结算对账定时任务
func StartSettlementReconciliationCron() {
	go func() {
		ticker := time.NewTicker(24 * time.Hour)
		defer ticker.Stop()

		now := time.Now()
		next := time.Date(now.Year(), now.Month(), now.Day(), 3, 0, 0, 0, now.Location())
		if !next.After(now) {
			next = next.Add(24 * time.Hour)
		}
		delay := next.Sub(now)

		log.Printf("[Cron] Settlement reconciliation will start at %s (in %v)", next.Format("2006-01-02 15:04:05"), delay)
		time.Sleep(delay)

		runSettlementReconciliation()

		for range ticker.C {
			runSettlementReconciliation()
		}
	}()
}

func runSettlementReconciliation() {
	targetDate := time.Now().AddDate(0, 0, -1)
	scope := "结算对账/" + targetDate.Format("2006-01-02")
	log.Printf("[Cron] Starting settlement reconciliation for %s", targetDate.Format("2006-01-02"))

	job := &SettlementReconciliationJob{}
	result, err := job.Run(targetDate)
	if err != nil {
		log.Printf("[Cron] Settlement reconciliation failed: %v", err)
		_, _, _ = (&service.SystemAlertService{}).UpsertAlert(&service.CreateSystemAlertInput{
			Type:        service.SystemAlertTypeSettlementReconciliationFailed,
			Level:       "critical",
			Scope:       scope,
			Description: err.Error(),
			ActionURL:   "/risk/warnings",
		})
		return
	}

	if result.DifferenceCount > 0 {
		_, _, _ = (&service.SystemAlertService{}).UpsertAlert(&service.CreateSystemAlertInput{
			Type:        service.SystemAlertTypeSettlementReconciliationFailed,
			Level:       "high",
			Scope:       scope,
			Description: fmt.Sprintf("结算对账发现 %d 条差异，检查笔数=%d", result.DifferenceCount, result.TotalCount),
			ActionURL:   "/risk/warnings",
		})
	} else {
		_, _ = (&service.SystemAlertService{}).ResolveAlert(service.SystemAlertTypeSettlementReconciliationFailed, scope, "对账恢复正常")
	}

	log.Printf("[Cron] Settlement reconciliation finished: date=%s total=%d differences=%d", targetDate.Format("2006-01-02"), result.TotalCount, result.DifferenceCount)
}

// SettlementReconciliationJob 结算对账任务
type SettlementReconciliationJob struct{}

// SettlementReconciliationResult 对账结果
type SettlementReconciliationResult struct {
	TotalCount      int
	DifferenceCount int
	RecordID        uint64
}

// Run 执行结算对账
func (j *SettlementReconciliationJob) Run(targetDate time.Time) (*SettlementReconciliationResult, error) {
	db := repository.GetDB()
	startOfDay := time.Date(targetDate.Year(), targetDate.Month(), targetDate.Day(), 0, 0, 0, 0, targetDate.Location())
	endOfDay := startOfDay.Add(24 * time.Hour)

	// 创建对账记录
	record := &model.ReconciliationRecord{
		ReconcileDate:   targetDate,
		ReconcileType:   "settlement",
		Channel:         "internal",
		Status:          "processing",
		TotalCount:      0,
		MatchedCount:    0,
		DifferenceCount: 0,
		TotalAmount:     0,
	}
	if err := db.Create(record).Error; err != nil {
		return nil, fmt.Errorf("failed to create reconciliation record: %w", err)
	}

	// 查询状态为 paid 的结算单
	var settlements []model.SettlementOrder
	if err := db.Where("status = ? AND updated_at >= ? AND updated_at < ?",
		model.SettlementStatusPaid, startOfDay, endOfDay).
		Find(&settlements).Error; err != nil {
		record.Status = "failed"
		record.ErrorMessage = err.Error()
		db.Save(record)
		return nil, fmt.Errorf("failed to query settlement orders: %w", err)
	}

	result := &SettlementReconciliationResult{
		TotalCount:      len(settlements),
		DifferenceCount: 0,
		RecordID:        record.ID,
	}

	log.Printf("[SettlementReconciliation] Found %d paid settlement orders for %s", len(settlements), targetDate.Format("2006-01-02"))

	// 检查每个结算单
	for _, settlement := range settlements {
		if err := j.checkSettlement(db, record.ID, &settlement); err != nil {
			log.Printf("[SettlementReconciliation] Error checking settlement %d: %v", settlement.ID, err)
			result.DifferenceCount++
		}
	}

	// 更新对账记录
	now := time.Now()
	record.Status = "completed"
	record.TotalCount = result.TotalCount
	record.DifferenceCount = result.DifferenceCount
	record.MatchedCount = result.TotalCount - result.DifferenceCount
	record.CompletedAt = &now
	if err := db.Save(record).Error; err != nil {
		log.Printf("[SettlementReconciliation] Failed to update reconciliation record: %v", err)
	}

	return result, nil
}

// checkSettlement 检查单个结算单的一致性
func (j *SettlementReconciliationJob) checkSettlement(db *gorm.DB, reconciliationID uint64, settlement *model.SettlementOrder) error {
	// 检查结算单 vs 出款单
	if settlement.PayoutOrderID > 0 {
		var payout model.PayoutOrder
		if err := db.Where("id = ?", settlement.PayoutOrderID).First(&payout).Error; err != nil {
			// 出款单不存在
			j.recordDifference(db, reconciliationID, "settlement_payout_missing", settlement, nil, nil)
			return fmt.Errorf("payout order %d not found", settlement.PayoutOrderID)
		}

		// 检查出款单状态
		if payout.Status != model.PayoutStatusPaid {
			j.recordDifference(db, reconciliationID, "settlement_payout_status_mismatch", settlement, &payout, nil)
			return fmt.Errorf("payout order %d status mismatch: expected paid, got %s", payout.ID, payout.Status)
		}

		// 检查金额一致性（考虑浮点数精度）
		if math.Abs(settlement.MerchantNetAmount-payout.Amount) >= 0.01 {
			j.recordDifference(db, reconciliationID, "settlement_payout_amount_mismatch", settlement, &payout, nil)
			return fmt.Errorf("payout order %d amount mismatch: settlement=%.2f, payout=%.2f", payout.ID, settlement.MerchantNetAmount, payout.Amount)
		}
	}

	// 检查结算单 vs 商家收入
	var income model.MerchantIncome
	if err := db.Where("settlement_order_id = ?", settlement.ID).First(&income).Error; err != nil {
		// 商家收入记录不存在
		j.recordDifference(db, reconciliationID, "settlement_income_missing", settlement, nil, nil)
		return fmt.Errorf("merchant income for settlement %d not found", settlement.ID)
	}

	// 检查商家收入金额一致性
	if math.Abs(settlement.MerchantNetAmount-income.NetAmount) >= 0.01 {
		j.recordDifference(db, reconciliationID, "settlement_income_amount_mismatch", settlement, nil, &income)
		return fmt.Errorf("merchant income %d amount mismatch: settlement=%.2f, income=%.2f", income.ID, settlement.MerchantNetAmount, income.NetAmount)
	}

	// 检查商家收入状态（status=2 表示已出款）
	if income.Status != 2 {
		j.recordDifference(db, reconciliationID, "settlement_income_status_mismatch", settlement, nil, &income)
		return fmt.Errorf("merchant income %d status mismatch: expected 2 (paid), got %d", income.ID, income.Status)
	}

	return nil
}

// recordDifference 记录对账差异
func (j *SettlementReconciliationJob) recordDifference(
	db *gorm.DB,
	reconciliationID uint64,
	differenceType string,
	settlement *model.SettlementOrder,
	payout *model.PayoutOrder,
	income *model.MerchantIncome,
) {
	diff := &model.ReconciliationDifference{
		ReconciliationID: reconciliationID,
		DifferenceType:   differenceType,
		OutTradeNo:       fmt.Sprintf("settlement_%d", settlement.ID),
		PlatformAmount:   settlement.MerchantNetAmount,
		PlatformStatus:   settlement.Status,
		Resolved:         false,
	}

	if payout != nil {
		diff.ProviderTradeNo = payout.OutPayoutNo
		diff.ChannelAmount = payout.Amount
		diff.ChannelStatus = payout.Status
	}

	if income != nil {
		diff.ChannelAmount = income.NetAmount
		diff.ChannelStatus = fmt.Sprintf("status_%d", income.Status)
	}

	if err := db.Create(diff).Error; err != nil {
		log.Printf("[SettlementReconciliation] Failed to record difference: %v", err)
	}
}


