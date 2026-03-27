package service

import (
	"context"
	"encoding/json"
	"errors"
	"math"
	"strings"
	"time"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	"home-decoration-server/pkg/timeutil"

	"gorm.io/gorm"
)

type FinanceReconciliationService struct{}

type FinanceReconciliationFilter struct {
	Status    string
	StartDate string
	EndDate   string
	Page      int
	PageSize  int
}

type FinanceReconciliationView struct {
	ID                uint64                   `json:"id"`
	ReconcileDate     string                   `json:"reconcileDate"`
	Status            string                   `json:"status"`
	FindingCount      int                      `json:"findingCount"`
	OwnerAdminID      uint64                   `json:"ownerAdminId"`
	OwnerNote         string                   `json:"ownerNote"`
	ResolvedByAdminID uint64                   `json:"resolvedByAdminId"`
	ResolutionNote    string                   `json:"resolutionNote"`
	ResolvedAt        *time.Time               `json:"resolvedAt,omitempty"`
	LastRunAt         time.Time                `json:"lastRunAt"`
	CreatedAt         time.Time                `json:"createdAt"`
	UpdatedAt         time.Time                `json:"updatedAt"`
	Summary           map[string]interface{}   `json:"summary"`
	Findings          []map[string]interface{} `json:"findings"`
}

type FinanceReconciliationItemView struct {
	ID               uint64                 `json:"id"`
	ReconciliationID uint64                 `json:"reconciliationId"`
	ItemType         string                 `json:"itemType"`
	Code             string                 `json:"code"`
	Level            string                 `json:"level"`
	ReferenceType    string                 `json:"referenceType"`
	ReferenceID      uint64                 `json:"referenceId"`
	Message          string                 `json:"message"`
	ExpectedCount    int64                  `json:"expectedCount"`
	ActualCount      int64                  `json:"actualCount"`
	ExpectedAmount   float64                `json:"expectedAmount"`
	ActualAmount     float64                `json:"actualAmount"`
	Detail           map[string]interface{} `json:"detail"`
	CreatedAt        time.Time              `json:"createdAt"`
}

type financeAggregate struct {
	Count  int64
	Amount float64
}

type financeReconciliationSummary struct {
	Date                     string  `json:"date"`
	DepositCount             int64   `json:"depositCount"`
	DepositAmount            float64 `json:"depositAmount"`
	ReleaseCount             int64   `json:"releaseCount"`
	ReleaseAmount            float64 `json:"releaseAmount"`
	ConstructionIncomeCount  int64   `json:"constructionIncomeCount"`
	ConstructionIncomeAmount float64 `json:"constructionIncomeAmount"`
	RefundTransactionCount   int64   `json:"refundTransactionCount"`
	RefundTransactionAmount  float64 `json:"refundTransactionAmount"`
	RefundOrderCount         int64   `json:"refundOrderCount"`
	RefundOrderAmount        float64 `json:"refundOrderAmount"`
	WithdrawCount            int64   `json:"withdrawCount"`
	WithdrawAmount           float64 `json:"withdrawAmount"`
	WithdrawIncomeCount      int64   `json:"withdrawIncomeCount"`
	WithdrawIncomeAmount     float64 `json:"withdrawIncomeAmount"`
	EscrowBalancedCount      int64   `json:"escrowBalancedCount"`
	EscrowUnbalancedCount    int64   `json:"escrowUnbalancedCount"`
}

type financeReconciliationFinding struct {
	Code           string                 `json:"code"`
	Level          string                 `json:"level"`
	Message        string                 `json:"message"`
	ExpectedCount  int64                  `json:"expectedCount,omitempty"`
	ActualCount    int64                  `json:"actualCount,omitempty"`
	ExpectedAmount float64                `json:"expectedAmount,omitempty"`
	ActualAmount   float64                `json:"actualAmount,omitempty"`
	Details        map[string]interface{} `json:"details,omitempty"`
}

func (s *FinanceReconciliationService) RunDailyReconciliation(targetDate time.Time) (*FinanceReconciliationView, error) {
	reconcileDate, startAt, endAt := normalizeFinanceReconciliationDate(targetDate)

	summary, findings, err := s.collectDailyReconciliation(startAt, endAt)
	if err != nil {
		return nil, err
	}
	externalFindings, err := s.collectExternalBillFindings(reconcileDate, startAt, endAt)
	if err != nil {
		return nil, err
	}
	findings = append(findings, externalFindings...)
	summary.Date = reconcileDate.Format("2006-01-02")

	var result model.FinanceReconciliation
	now := time.Now()
	err = repository.DB.Transaction(func(tx *gorm.DB) error {
		var current model.FinanceReconciliation
		err := tx.Where("reconcile_date = ?", reconcileDate).First(&current).Error
		if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}

		nextStatus := deriveFinanceReconciliationStatus(findings, &current)
		updates := map[string]interface{}{
			"status":        nextStatus,
			"finding_count": len(findings),
			"summary_json":  marshalFinanceReconciliationSummary(summary),
			"findings_json": marshalFinanceReconciliationFindings(findings),
			"last_run_at":   now,
		}
		if nextStatus == model.FinanceReconciliationStatusSuccess {
			updates["resolved_at"] = nil
			updates["resolved_by_admin_id"] = uint64(0)
			updates["resolution_note"] = ""
		}
		if nextStatus == model.FinanceReconciliationStatusWarning {
			updates["resolved_at"] = nil
			updates["resolved_by_admin_id"] = uint64(0)
			updates["resolution_note"] = ""
		}

		if errors.Is(err, gorm.ErrRecordNotFound) {
			record := model.FinanceReconciliation{
				ReconcileDate: reconcileDate,
				Status:        nextStatus,
				FindingCount:  len(findings),
				SummaryJSON:   marshalFinanceReconciliationSummary(summary),
				FindingsJSON:  marshalFinanceReconciliationFindings(findings),
				LastRunAt:     now,
			}
			if err := tx.Create(&record).Error; err != nil {
				return err
			}
			result = record
		} else {
			if err := tx.Model(&current).Updates(updates).Error; err != nil {
				return err
			}
			if err := tx.First(&current, current.ID).Error; err != nil {
				return err
			}
			result = current
		}
		if err := tx.Where("reconciliation_id = ?", result.ID).Delete(&model.FinanceReconciliationItem{}).Error; err != nil {
			return err
		}
		items := buildFinanceReconciliationItemModels(result.ID, findings)
		if len(items) > 0 {
			if err := tx.Create(&items).Error; err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return nil, err
	}

	return buildFinanceReconciliationView(&result), nil
}

func (s *FinanceReconciliationService) ListFinanceReconciliationItems(id uint64) ([]FinanceReconciliationItemView, error) {
	if id == 0 {
		return nil, errors.New("对账记录不存在")
	}
	var items []model.FinanceReconciliationItem
	if err := repository.DB.Where("reconciliation_id = ?", id).Order("id ASC").Find(&items).Error; err != nil {
		return nil, err
	}
	result := make([]FinanceReconciliationItemView, 0, len(items))
	for i := range items {
		result = append(result, FinanceReconciliationItemView{
			ID:               items[i].ID,
			ReconciliationID: items[i].ReconciliationID,
			ItemType:         items[i].ItemType,
			Code:             items[i].Code,
			Level:            items[i].Level,
			ReferenceType:    items[i].ReferenceType,
			ReferenceID:      items[i].ReferenceID,
			Message:          items[i].Message,
			ExpectedCount:    items[i].ExpectedCount,
			ActualCount:      items[i].ActualCount,
			ExpectedAmount:   roundFinanceAmount(items[i].ExpectedAmount),
			ActualAmount:     roundFinanceAmount(items[i].ActualAmount),
			Detail:           parseJSONObject(items[i].DetailJSON),
			CreatedAt:        items[i].CreatedAt,
		})
	}
	return result, nil
}

func (s *FinanceReconciliationService) ListFinanceReconciliations(filter FinanceReconciliationFilter) ([]FinanceReconciliationView, int64, error) {
	page := filter.Page
	if page <= 0 {
		page = 1
	}
	pageSize := filter.PageSize
	if pageSize <= 0 {
		pageSize = 20
	}

	query := repository.DB.Model(&model.FinanceReconciliation{})
	if status := strings.TrimSpace(filter.Status); status != "" {
		query = query.Where("status = ?", status)
	}
	if startDate, err := parseFinanceReconciliationDate(filter.StartDate); err == nil && !startDate.IsZero() {
		query = query.Where("reconcile_date >= ?", startDate)
	}
	if endDate, err := parseFinanceReconciliationDate(filter.EndDate); err == nil && !endDate.IsZero() {
		query = query.Where("reconcile_date <= ?", endDate)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var items []model.FinanceReconciliation
	if err := query.Order("reconcile_date DESC, id DESC").Offset((page - 1) * pageSize).Limit(pageSize).Find(&items).Error; err != nil {
		return nil, 0, err
	}

	result := make([]FinanceReconciliationView, 0, len(items))
	for i := range items {
		result = append(result, *buildFinanceReconciliationView(&items[i]))
	}
	return result, total, nil
}

func (s *FinanceReconciliationService) ClaimFinanceReconciliation(id, adminID uint64, note string) (*FinanceReconciliationView, error) {
	if id == 0 || adminID == 0 {
		return nil, errors.New("认领参数无效")
	}

	var result model.FinanceReconciliation
	err := repository.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.First(&result, id).Error; err != nil {
			return errors.New("对账记录不存在")
		}
		if result.FindingCount <= 0 {
			return errors.New("当前对账无异常，无需认领")
		}
		if result.Status == model.FinanceReconciliationStatusResolved {
			return errors.New("当前对账已处理完成")
		}
		updates := map[string]interface{}{
			"status":         model.FinanceReconciliationStatusProcessing,
			"owner_admin_id": adminID,
			"owner_note":     strings.TrimSpace(note),
		}
		if err := tx.Model(&result).Updates(updates).Error; err != nil {
			return err
		}
		return tx.First(&result, result.ID).Error
	})
	if err != nil {
		return nil, err
	}
	return buildFinanceReconciliationView(&result), nil
}

func (s *FinanceReconciliationService) ResolveFinanceReconciliation(id, adminID uint64, note string) (*FinanceReconciliationView, error) {
	if id == 0 || adminID == 0 {
		return nil, errors.New("处理参数无效")
	}
	if strings.TrimSpace(note) == "" {
		return nil, errors.New("请填写处理结果")
	}

	var result model.FinanceReconciliation
	err := repository.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.First(&result, id).Error; err != nil {
			return errors.New("对账记录不存在")
		}
		if result.FindingCount <= 0 {
			return errors.New("当前对账无异常，无需处理")
		}

		now := time.Now()
		updates := map[string]interface{}{
			"status":               model.FinanceReconciliationStatusResolved,
			"owner_admin_id":       firstNonZeroUint64(result.OwnerAdminID, adminID),
			"resolved_by_admin_id": adminID,
			"resolution_note":      strings.TrimSpace(note),
			"resolved_at":          now,
		}
		if err := tx.Model(&result).Updates(updates).Error; err != nil {
			return err
		}
		return tx.First(&result, result.ID).Error
	})
	if err != nil {
		return nil, err
	}
	return buildFinanceReconciliationView(&result), nil
}

func (s *FinanceReconciliationService) collectDailyReconciliation(startAt, endAt time.Time) (*financeReconciliationSummary, []financeReconciliationFinding, error) {
	summary := &financeReconciliationSummary{}
	findings := make([]financeReconciliationFinding, 0, 4)

	depositAgg, err := queryTransactionAggregate("deposit", startAt, endAt)
	if err != nil {
		return nil, nil, err
	}
	releaseAgg, err := queryTransactionAggregate("release", startAt, endAt)
	if err != nil {
		return nil, nil, err
	}
	refundTxAgg, err := queryTransactionAggregate("refund", startAt, endAt)
	if err != nil {
		return nil, nil, err
	}
	constructionIncomeAgg, err := queryConstructionIncomeAggregate(startAt, endAt)
	if err != nil {
		return nil, nil, err
	}
	refundOrderAgg, err := queryRefundOrderAggregate(startAt, endAt)
	if err != nil {
		return nil, nil, err
	}
	withdrawAgg, withdrawIncomeAgg, err := queryWithdrawAggregate(startAt, endAt)
	if err != nil {
		return nil, nil, err
	}
	settlementAgg, err := querySettlementAggregate(startAt, endAt)
	if err != nil {
		return nil, nil, err
	}
	settlementProjectionAgg, err := querySettlementProjectionAggregate(startAt, endAt)
	if err != nil {
		return nil, nil, err
	}
	settlementLedgerAgg, err := querySettlementPendingLedgerAggregate(startAt, endAt)
	if err != nil {
		return nil, nil, err
	}
	payoutLedgerAgg, err := querySettlementPaidLedgerAggregate(startAt, endAt)
	if err != nil {
		return nil, nil, err
	}
	paidPayoutAgg, err := queryPayoutAggregate(startAt, endAt)
	if err != nil {
		return nil, nil, err
	}
	orphanSettlementCount, err := queryOrphanSettlementCount()
	if err != nil {
		return nil, nil, err
	}
	orphanPayoutCount, err := queryOrphanPayoutCount()
	if err != nil {
		return nil, nil, err
	}
	statusMismatchCount, err := querySettlementStatusMismatchCount()
	if err != nil {
		return nil, nil, err
	}
	escrowBalancedCount, escrowUnbalancedCount, escrowExamples, err := queryEscrowBalanceSummary()
	if err != nil {
		return nil, nil, err
	}

	summary.DepositCount = depositAgg.Count
	summary.DepositAmount = roundFinanceAmount(depositAgg.Amount)
	summary.ReleaseCount = releaseAgg.Count
	summary.ReleaseAmount = roundFinanceAmount(releaseAgg.Amount)
	summary.ConstructionIncomeCount = constructionIncomeAgg.Count
	summary.ConstructionIncomeAmount = roundFinanceAmount(constructionIncomeAgg.Amount)
	summary.RefundTransactionCount = refundTxAgg.Count
	summary.RefundTransactionAmount = roundFinanceAmount(refundTxAgg.Amount)
	summary.RefundOrderCount = refundOrderAgg.Count
	summary.RefundOrderAmount = roundFinanceAmount(refundOrderAgg.Amount)
	summary.WithdrawCount = withdrawAgg.Count
	summary.WithdrawAmount = roundFinanceAmount(withdrawAgg.Amount)
	summary.WithdrawIncomeCount = withdrawIncomeAgg.Count
	summary.WithdrawIncomeAmount = roundFinanceAmount(withdrawIncomeAgg.Amount)
	summary.EscrowBalancedCount = escrowBalancedCount
	summary.EscrowUnbalancedCount = escrowUnbalancedCount

	if releaseAgg.Count != constructionIncomeAgg.Count || amountDiffers(releaseAgg.Amount, constructionIncomeAgg.Amount) {
		findings = append(findings, financeReconciliationFinding{
			Code:           "release_income_mismatch",
			Level:          "warning",
			Message:        "节点放款流水与商家收入入账不一致",
			ExpectedCount:  releaseAgg.Count,
			ActualCount:    constructionIncomeAgg.Count,
			ExpectedAmount: roundFinanceAmount(releaseAgg.Amount),
			ActualAmount:   roundFinanceAmount(constructionIncomeAgg.Amount),
		})
	}

	if amountDiffers(refundOrderAgg.Amount, refundTxAgg.Amount) {
		findings = append(findings, financeReconciliationFinding{
			Code:           "refund_mismatch",
			Level:          "warning",
			Message:        "退款成功金额与内部退款流水不一致",
			ExpectedCount:  refundOrderAgg.Count,
			ActualCount:    refundTxAgg.Count,
			ExpectedAmount: roundFinanceAmount(refundOrderAgg.Amount),
			ActualAmount:   roundFinanceAmount(refundTxAgg.Amount),
		})
	}

	if withdrawAgg.Count != withdrawIncomeAgg.Count || amountDiffers(withdrawAgg.Amount, withdrawIncomeAgg.Amount) {
		findings = append(findings, financeReconciliationFinding{
			Code:           "withdraw_income_mismatch",
			Level:          "warning",
			Message:        "已打款提现金额与已核销商家收入不一致",
			ExpectedCount:  withdrawAgg.Count,
			ActualCount:    withdrawIncomeAgg.Count,
			ExpectedAmount: roundFinanceAmount(withdrawAgg.Amount),
			ActualAmount:   roundFinanceAmount(withdrawIncomeAgg.Amount),
		})
	}

	if settlementAgg.Count != settlementProjectionAgg.Count {
		findings = append(findings, financeReconciliationFinding{
			Code:          "missing_runtime",
			Level:         "warning",
			Message:       "结算单与商家结算投影数量不一致",
			ExpectedCount: settlementAgg.Count,
			ActualCount:   settlementProjectionAgg.Count,
			Details:       map[string]interface{}{"scope": "settlement_projection"},
		})
	}
	if amountDiffers(settlementAgg.Amount, settlementProjectionAgg.Amount) {
		findings = append(findings, financeReconciliationFinding{
			Code:           "amount_mismatch",
			Level:          "warning",
			Message:        "结算单金额与商家结算投影金额不一致",
			ExpectedAmount: roundFinanceAmount(settlementAgg.Amount),
			ActualAmount:   roundFinanceAmount(settlementProjectionAgg.Amount),
			Details:        map[string]interface{}{"scope": "settlement_projection"},
		})
	}
	if settlementAgg.Count != settlementLedgerAgg.Count {
		findings = append(findings, financeReconciliationFinding{
			Code:          "missing_ledger",
			Level:         "warning",
			Message:       "结算单与待结算账务分录数量不一致",
			ExpectedCount: settlementAgg.Count,
			ActualCount:   settlementLedgerAgg.Count,
			Details:       map[string]interface{}{"scope": "settlement_pending_ledger"},
		})
	}
	if amountDiffers(settlementProjectionAgg.Amount, settlementLedgerAgg.Amount) {
		findings = append(findings, financeReconciliationFinding{
			Code:           "amount_mismatch",
			Level:          "warning",
			Message:        "结算净额与待结算账务分录金额不一致",
			ExpectedAmount: roundFinanceAmount(settlementProjectionAgg.Amount),
			ActualAmount:   roundFinanceAmount(settlementLedgerAgg.Amount),
			Details:        map[string]interface{}{"scope": "settlement_pending_ledger"},
		})
	}
	if paidPayoutAgg.Count != payoutLedgerAgg.Count {
		findings = append(findings, financeReconciliationFinding{
			Code:          "missing_ledger",
			Level:         "warning",
			Message:       "出款运行时与已出款账务分录数量不一致",
			ExpectedCount: paidPayoutAgg.Count,
			ActualCount:   payoutLedgerAgg.Count,
			Details:       map[string]interface{}{"scope": "payout_paid_ledger"},
		})
	}
	if amountDiffers(paidPayoutAgg.Amount, payoutLedgerAgg.Amount) {
		findings = append(findings, financeReconciliationFinding{
			Code:           "amount_mismatch",
			Level:          "warning",
			Message:        "出款运行时与已出款账务分录金额不一致",
			ExpectedAmount: roundFinanceAmount(paidPayoutAgg.Amount),
			ActualAmount:   roundFinanceAmount(payoutLedgerAgg.Amount),
			Details:        map[string]interface{}{"scope": "payout_paid_ledger"},
		})
	}
	if orphanSettlementCount > 0 {
		findings = append(findings, financeReconciliationFinding{
			Code:        "orphan_settlement",
			Level:       "warning",
			Message:     "存在未关联商家结算投影的结算单",
			ActualCount: orphanSettlementCount,
		})
	}
	if orphanPayoutCount > 0 {
		findings = append(findings, financeReconciliationFinding{
			Code:        "orphan_payout",
			Level:       "warning",
			Message:     "存在未关联结算单的出款运行时",
			ActualCount: orphanPayoutCount,
		})
	}
	if statusMismatchCount > 0 {
		findings = append(findings, financeReconciliationFinding{
			Code:        "status_mismatch",
			Level:       "warning",
			Message:     "结算单状态与出款运行时状态不一致",
			ActualCount: statusMismatchCount,
		})
	}

	if escrowUnbalancedCount > 0 {
		details := map[string]interface{}{"examples": escrowExamples}
		findings = append(findings, financeReconciliationFinding{
			Code:          "escrow_balance_broken",
			Level:         "warning",
			Message:       "托管账户总额与冻结/可放款/已放款金额不守恒",
			ExpectedCount: 0,
			ActualCount:   escrowUnbalancedCount,
			Details:       details,
		})
	}

	return summary, findings, nil
}

func (s *FinanceReconciliationService) collectExternalBillFindings(reconcileDate, startAt, endAt time.Time) ([]financeReconciliationFinding, error) {
	bills, err := NewCustodyGateway().PullBill(context.Background(), reconcileDate)
	if err != nil {
		return nil, err
	}
	externalInbound := financeAggregate{}
	externalRefund := financeAggregate{}
	externalPayout := financeAggregate{}
	for _, item := range bills {
		switch item.Direction {
		case "inbound":
			externalInbound.Count++
			externalInbound.Amount += item.Amount
		case "refund":
			externalRefund.Count++
			externalRefund.Amount += item.Amount
		case "payout":
			externalPayout.Count++
			externalPayout.Amount += item.Amount
		}
	}

	internalInbound, err := queryPaidPaymentOrderAggregate(startAt, endAt)
	if err != nil {
		return nil, err
	}
	internalRefund, err := queryRefundOrderAggregate(startAt, endAt)
	if err != nil {
		return nil, err
	}
	internalPayout, err := queryPayoutAggregate(startAt, endAt)
	if err != nil {
		return nil, err
	}

	findings := make([]financeReconciliationFinding, 0, 3)
	if internalInbound.Count != externalInbound.Count || amountDiffers(internalInbound.Amount, externalInbound.Amount) {
		findings = append(findings, financeReconciliationFinding{
			Code:           "external_inbound_mismatch",
			Level:          "warning",
			Message:        "托管外部入金账单与内部支付成功记录不一致",
			ExpectedCount:  internalInbound.Count,
			ActualCount:    externalInbound.Count,
			ExpectedAmount: roundFinanceAmount(internalInbound.Amount),
			ActualAmount:   roundFinanceAmount(externalInbound.Amount),
			Details:        map[string]interface{}{"source": "custody_bill"},
		})
	}
	if internalRefund.Count != externalRefund.Count || amountDiffers(internalRefund.Amount, externalRefund.Amount) {
		findings = append(findings, financeReconciliationFinding{
			Code:           "external_refund_mismatch",
			Level:          "warning",
			Message:        "托管外部退款账单与内部退款单不一致",
			ExpectedCount:  internalRefund.Count,
			ActualCount:    externalRefund.Count,
			ExpectedAmount: roundFinanceAmount(internalRefund.Amount),
			ActualAmount:   roundFinanceAmount(externalRefund.Amount),
			Details:        map[string]interface{}{"source": "custody_bill"},
		})
	}
	if internalPayout.Count != externalPayout.Count || amountDiffers(internalPayout.Amount, externalPayout.Amount) {
		findings = append(findings, financeReconciliationFinding{
			Code:           "external_payout_mismatch",
			Level:          "warning",
			Message:        "托管外部出款账单与内部自动出款记录不一致",
			ExpectedCount:  internalPayout.Count,
			ActualCount:    externalPayout.Count,
			ExpectedAmount: roundFinanceAmount(internalPayout.Amount),
			ActualAmount:   roundFinanceAmount(externalPayout.Amount),
			Details:        map[string]interface{}{"source": "custody_bill"},
		})
	}
	return findings, nil
}

func buildFinanceReconciliationItemModels(reconciliationID uint64, findings []financeReconciliationFinding) []model.FinanceReconciliationItem {
	if reconciliationID == 0 || len(findings) == 0 {
		return nil
	}
	items := make([]model.FinanceReconciliationItem, 0, len(findings))
	for _, finding := range findings {
		items = append(items, model.FinanceReconciliationItem{
			ReconciliationID: reconciliationID,
			ItemType:         deriveReconciliationItemType(finding.Code),
			Code:             finding.Code,
			Level:            finding.Level,
			Message:          finding.Message,
			ExpectedCount:    finding.ExpectedCount,
			ActualCount:      finding.ActualCount,
			ExpectedAmount:   roundFinanceAmount(finding.ExpectedAmount),
			ActualAmount:     roundFinanceAmount(finding.ActualAmount),
			DetailJSON:       mustMarshalJSON(finding.Details),
		})
	}
	return items
}

func deriveReconciliationItemType(code string) string {
	if strings.HasPrefix(strings.TrimSpace(code), "external_") {
		return "external_bill"
	}
	return "internal"
}

func queryTransactionAggregate(txType string, startAt, endAt time.Time) (*financeAggregate, error) {
	var row financeAggregate
	err := repository.DB.Model(&model.Transaction{}).
		Where("type = ? AND status = ? AND COALESCE(completed_at, created_at) >= ? AND COALESCE(completed_at, created_at) < ?", txType, 1, startAt, endAt).
		Select("COUNT(*) AS count, COALESCE(SUM(amount), 0) AS amount").
		Scan(&row).Error
	if err != nil {
		return nil, err
	}
	return &row, nil
}

func queryPaidPaymentOrderAggregate(startAt, endAt time.Time) (*financeAggregate, error) {
	var row financeAggregate
	err := repository.DB.Model(&model.PaymentOrder{}).
		Where("status = ? AND COALESCE(paid_at, created_at) >= ? AND COALESCE(paid_at, created_at) < ?", model.PaymentStatusPaid, startAt, endAt).
		Select("COUNT(*) AS count, COALESCE(SUM(amount), 0) AS amount").
		Scan(&row).Error
	if err != nil {
		return nil, err
	}
	return &row, nil
}

func queryConstructionIncomeAggregate(startAt, endAt time.Time) (*financeAggregate, error) {
	var row financeAggregate
	err := repository.DB.Model(&model.MerchantIncome{}).
		Where("type = ? AND settled_at IS NOT NULL AND settled_at >= ? AND settled_at < ?", "construction", startAt, endAt).
		Select("COUNT(*) AS count, COALESCE(SUM(amount), 0) AS amount").
		Scan(&row).Error
	if err != nil {
		return nil, err
	}
	return &row, nil
}

func queryRefundOrderAggregate(startAt, endAt time.Time) (*financeAggregate, error) {
	var row financeAggregate
	err := repository.DB.Model(&model.RefundOrder{}).
		Where("status = ? AND COALESCE(succeeded_at, created_at) >= ? AND COALESCE(succeeded_at, created_at) < ?", model.RefundOrderStatusSucceeded, startAt, endAt).
		Select("COUNT(*) AS count, COALESCE(SUM(amount), 0) AS amount").
		Scan(&row).Error
	if err != nil {
		return nil, err
	}
	return &row, nil
}

func queryWithdrawAggregate(startAt, endAt time.Time) (*financeAggregate, *financeAggregate, error) {
	var withdrawAgg financeAggregate
	err := repository.DB.Model(&model.MerchantWithdraw{}).
		Where("status = ? AND COALESCE(completed_at, created_at) >= ? AND COALESCE(completed_at, created_at) < ?", model.MerchantWithdrawStatusPaid, startAt, endAt).
		Select("COUNT(*) AS count, COALESCE(SUM(amount), 0) AS amount").
		Scan(&withdrawAgg).Error
	if err != nil {
		return nil, nil, err
	}

	if withdrawAgg.Count == 0 {
		return &withdrawAgg, &financeAggregate{}, nil
	}

	var orderNos []string
	if err := repository.DB.Model(&model.MerchantWithdraw{}).
		Where("status = ? AND COALESCE(completed_at, created_at) >= ? AND COALESCE(completed_at, created_at) < ?", model.MerchantWithdrawStatusPaid, startAt, endAt).
		Pluck("order_no", &orderNos).Error; err != nil {
		return nil, nil, err
	}
	orderNos = compactNonEmptyStrings(orderNos)
	if len(orderNos) == 0 {
		return &withdrawAgg, &financeAggregate{}, nil
	}

	var incomeAgg financeAggregate
	err = repository.DB.Model(&model.MerchantIncome{}).
		Where("status = ? AND withdraw_order_no IN ?", 2, orderNos).
		Select("COUNT(DISTINCT withdraw_order_no) AS count, COALESCE(SUM(net_amount), 0) AS amount").
		Scan(&incomeAgg).Error
	if err != nil {
		return nil, nil, err
	}
	return &withdrawAgg, &incomeAgg, nil
}

func queryPayoutAggregate(startAt, endAt time.Time) (*financeAggregate, error) {
	var row financeAggregate
	err := repository.DB.Model(&model.PayoutOrder{}).
		Where("status = ? AND COALESCE(paid_at, created_at) >= ? AND COALESCE(paid_at, created_at) < ?", model.PayoutStatusPaid, startAt, endAt).
		Select("COUNT(*) AS count, COALESCE(SUM(amount), 0) AS amount").
		Scan(&row).Error
	if err != nil {
		return nil, err
	}
	return &row, nil
}

func querySettlementAggregate(startAt, endAt time.Time) (*financeAggregate, error) {
	var row financeAggregate
	err := repository.DB.Model(&model.SettlementOrder{}).
		Where("COALESCE(accepted_at, created_at) >= ? AND COALESCE(accepted_at, created_at) < ?", startAt, endAt).
		Select("COUNT(*) AS count, COALESCE(SUM(gross_amount), 0) AS amount").
		Scan(&row).Error
	if err != nil {
		return nil, err
	}
	return &row, nil
}

func querySettlementProjectionAggregate(startAt, endAt time.Time) (*financeAggregate, error) {
	var row financeAggregate
	err := repository.DB.Model(&model.MerchantIncome{}).
		Where("settlement_order_id > 0 AND COALESCE(settled_at, created_at) >= ? AND COALESCE(settled_at, created_at) < ?", startAt, endAt).
		Select("COUNT(DISTINCT settlement_order_id) AS count, COALESCE(SUM(amount), 0) AS amount").
		Scan(&row).Error
	if err != nil {
		return nil, err
	}
	return &row, nil
}

func querySettlementPendingLedgerAggregate(startAt, endAt time.Time) (*financeAggregate, error) {
	var row financeAggregate
	err := repository.DB.Model(&model.LedgerEntry{}).
		Where("runtime_type = ? AND occurred_at >= ? AND occurred_at < ? AND CAST(metadata_json AS TEXT) LIKE ?", "settlement_order", startAt, endAt, "%merchant_settlement_pending%").
		Select("COUNT(DISTINCT runtime_id) AS count, COALESCE(SUM(amount), 0) AS amount").
		Scan(&row).Error
	if err != nil {
		return nil, err
	}
	return &row, nil
}

func querySettlementPaidLedgerAggregate(startAt, endAt time.Time) (*financeAggregate, error) {
	var row financeAggregate
	err := repository.DB.Model(&model.LedgerEntry{}).
		Where("runtime_type = ? AND occurred_at >= ? AND occurred_at < ? AND CAST(metadata_json AS TEXT) LIKE ?", "payout_order", startAt, endAt, "%merchant_settlement_paid%").
		Select("COUNT(DISTINCT runtime_id) AS count, COALESCE(SUM(amount), 0) AS amount").
		Scan(&row).Error
	if err != nil {
		return nil, err
	}
	return &row, nil
}

func queryOrphanSettlementCount() (int64, error) {
	var count int64
	err := repository.DB.Table("settlement_orders AS so").
		Joins("LEFT JOIN merchant_incomes AS mi ON mi.settlement_order_id = so.id").
		Where("mi.id IS NULL").
		Count(&count).Error
	return count, err
}

func queryOrphanPayoutCount() (int64, error) {
	var count int64
	err := repository.DB.Table("payout_orders AS po").
		Joins("LEFT JOIN settlement_orders AS so ON po.biz_type = ? AND po.biz_id = so.id", model.PayoutBizTypeSettlementOrder).
		Where("po.biz_type = ? AND so.id IS NULL", model.PayoutBizTypeSettlementOrder).
		Count(&count).Error
	return count, err
}

func querySettlementStatusMismatchCount() (int64, error) {
	var count int64
	err := repository.DB.Table("payout_orders AS po").
		Joins("JOIN settlement_orders AS so ON po.biz_type = ? AND po.biz_id = so.id", model.PayoutBizTypeSettlementOrder).
		Where(`(po.status = ? AND so.status <> ?)
			OR (po.status = ? AND so.status <> ?)
			OR (po.status = ? AND so.status <> ?)`,
			model.PayoutStatusPaid, model.SettlementStatusPaid,
			model.PayoutStatusProcessing, model.SettlementStatusPayoutProcessing,
			model.PayoutStatusFailed, model.SettlementStatusPayoutFailed).
		Count(&count).Error
	return count, err
}

type financeEscrowGapExample struct {
	ProjectID       uint64  `json:"projectId"`
	EscrowID        uint64  `json:"escrowId"`
	TotalAmount     float64 `json:"totalAmount"`
	FrozenAmount    float64 `json:"frozenAmount"`
	AvailableAmount float64 `json:"availableAmount"`
	ReleasedAmount  float64 `json:"releasedAmount"`
	GapAmount       float64 `json:"gapAmount"`
}

func queryEscrowBalanceSummary() (int64, int64, []financeEscrowGapExample, error) {
	var totalCount int64
	if err := repository.DB.Model(&model.EscrowAccount{}).Count(&totalCount).Error; err != nil {
		return 0, 0, nil, err
	}

	const gapTolerance = 0.01
	var unbalancedCount int64
	if err := repository.DB.Model(&model.EscrowAccount{}).
		Where("ABS(total_amount - frozen_amount - available_amount - released_amount) > ?", gapTolerance).
		Count(&unbalancedCount).Error; err != nil {
		return 0, 0, nil, err
	}

	examples := make([]financeEscrowGapExample, 0)
	if unbalancedCount > 0 {
		if err := repository.DB.Model(&model.EscrowAccount{}).
			Select("project_id, id AS escrow_id, total_amount, frozen_amount, available_amount, released_amount, ABS(total_amount - frozen_amount - available_amount - released_amount) AS gap_amount").
			Where("ABS(total_amount - frozen_amount - available_amount - released_amount) > ?", gapTolerance).
			Order("gap_amount DESC, id DESC").
			Limit(10).
			Scan(&examples).Error; err != nil {
			return 0, 0, nil, err
		}
		for i := range examples {
			examples[i].GapAmount = roundFinanceAmount(examples[i].GapAmount)
		}
	}

	return totalCount - unbalancedCount, unbalancedCount, examples, nil
}

func normalizeFinanceReconciliationDate(targetDate time.Time) (time.Time, time.Time, time.Time) {
	if targetDate.IsZero() {
		targetDate = timeutil.Now().AddDate(0, 0, -1)
	}
	normalized := timeutil.StartOfDay(targetDate)
	return normalized, normalized, normalized.Add(24 * time.Hour)
}

func parseFinanceReconciliationDate(raw string) (time.Time, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return time.Time{}, nil
	}
	return timeutil.ParseDate(raw)
}

func deriveFinanceReconciliationStatus(findings []financeReconciliationFinding, current *model.FinanceReconciliation) string {
	if len(findings) == 0 {
		return model.FinanceReconciliationStatusSuccess
	}
	if current != nil && current.OwnerAdminID > 0 && current.Status == model.FinanceReconciliationStatusProcessing {
		return model.FinanceReconciliationStatusProcessing
	}
	return model.FinanceReconciliationStatusWarning
}

func buildFinanceReconciliationView(item *model.FinanceReconciliation) *FinanceReconciliationView {
	if item == nil {
		return nil
	}
	return &FinanceReconciliationView{
		ID:                item.ID,
		ReconcileDate:     timeutil.FormatDate(item.ReconcileDate),
		Status:            item.Status,
		FindingCount:      item.FindingCount,
		OwnerAdminID:      item.OwnerAdminID,
		OwnerNote:         item.OwnerNote,
		ResolvedByAdminID: item.ResolvedByAdminID,
		ResolutionNote:    item.ResolutionNote,
		ResolvedAt:        item.ResolvedAt,
		LastRunAt:         item.LastRunAt,
		CreatedAt:         item.CreatedAt,
		UpdatedAt:         item.UpdatedAt,
		Summary:           parseJSONObject(item.SummaryJSON),
		Findings:          parseFinanceReconciliationFindings(item.FindingsJSON),
	}
}

func marshalFinanceReconciliationSummary(summary *financeReconciliationSummary) string {
	if summary == nil {
		return "{}"
	}
	payload, err := json.Marshal(summary)
	if err != nil {
		return "{}"
	}
	return string(payload)
}

func marshalFinanceReconciliationFindings(findings []financeReconciliationFinding) string {
	if len(findings) == 0 {
		return "[]"
	}
	payload, err := json.Marshal(findings)
	if err != nil {
		return "[]"
	}
	return string(payload)
}

func parseFinanceReconciliationFindings(raw string) []map[string]interface{} {
	if strings.TrimSpace(raw) == "" {
		return []map[string]interface{}{}
	}
	var result []map[string]interface{}
	if err := json.Unmarshal([]byte(raw), &result); err != nil {
		return []map[string]interface{}{}
	}
	if result == nil {
		return []map[string]interface{}{}
	}
	return result
}

func amountDiffers(left, right float64) bool {
	return math.Abs(roundFinanceAmount(left)-roundFinanceAmount(right)) > 0.01
}

func roundFinanceAmount(value float64) float64 {
	return math.Round(value*100) / 100
}

func compactNonEmptyStrings(values []string) []string {
	result := make([]string, 0, len(values))
	seen := make(map[string]struct{}, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" {
			continue
		}
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		result = append(result, value)
	}
	return result
}

func firstNonZeroUint64(primary, fallback uint64) uint64 {
	if primary > 0 {
		return primary
	}
	return fallback
}
