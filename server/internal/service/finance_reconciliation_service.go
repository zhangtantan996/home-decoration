package service

import (
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
			return nil
		}

		if err := tx.Model(&current).Updates(updates).Error; err != nil {
			return err
		}
		if err := tx.First(&current, current.ID).Error; err != nil {
			return err
		}
		result = current
		return nil
	})
	if err != nil {
		return nil, err
	}

	return buildFinanceReconciliationView(&result), nil
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
