package service

import (
	"fmt"
	"strings"
	"time"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
)

type ProjectClosureSummary struct {
	CompletionStatus       string `json:"completionStatus,omitempty"`
	ArchiveStatus          string `json:"archiveStatus,omitempty"`
	SettlementStatus       string `json:"settlementStatus,omitempty"`
	PayoutStatus           string `json:"payoutStatus,omitempty"`
	CaseDraftStatus        string `json:"caseDraftStatus,omitempty"`
	FinancialClosureStatus string `json:"financialClosureStatus,omitempty"`
	NextPendingAction      string `json:"nextPendingAction,omitempty"`
}

func BuildProjectClosureSummary(project *model.Project) *ProjectClosureSummary {
	if project == nil {
		return nil
	}
	summary := &ProjectClosureSummary{
		CompletionStatus:       resolveCompletionStatus(project),
		ArchiveStatus:          resolveArchiveStatus(project),
		CaseDraftStatus:        resolveCaseDraftStatus(project),
		SettlementStatus:       "not_scheduled",
		PayoutStatus:           "not_started",
		FinancialClosureStatus: "pending_settlement",
		NextPendingAction:      "等待完工审批或后续结算动作",
	}

	var settlementRows []struct {
		Status string
	}
	_ = repository.DB.Table("settlement_orders").Select("status").Where("project_id = ?", project.ID).Order("id DESC").Limit(1).Scan(&settlementRows).Error
	if len(settlementRows) > 0 {
		summary.SettlementStatus = strings.TrimSpace(settlementRows[0].Status)
	}

	var incomeRows []model.MerchantIncome
	_ = repository.DB.Where("order_id IN (?)", repository.DB.Model(&model.Order{}).Select("id").Where("project_id = ?", project.ID)).Find(&incomeRows).Error
	payoutStatus := "not_started"
	settlableCount := 0
	payoutDoneCount := 0
	for _, row := range incomeRows {
		if strings.TrimSpace(row.SettlementStatus) != "" {
			summary.SettlementStatus = normalizeSettlementStatus(summary.SettlementStatus, row.SettlementStatus)
		}
		if strings.TrimSpace(row.PayoutStatus) != "" {
			payoutStatus = normalizePayoutStatus(payoutStatus, row.PayoutStatus)
		}
		if row.Status >= 1 || strings.TrimSpace(row.SettlementStatus) == "scheduled" || strings.TrimSpace(row.SettlementStatus) == "settled" {
			settlableCount++
		}
		if row.Status == 2 || strings.TrimSpace(row.PayoutStatus) == "paid" {
			payoutDoneCount++
		}
	}
	summary.PayoutStatus = payoutStatus
	summary.FinancialClosureStatus = resolveFinancialClosureStatus(summary.SettlementStatus, summary.PayoutStatus, len(incomeRows), payoutDoneCount)
	summary.NextPendingAction = resolveClosureNextPendingAction(summary, project)
	if len(incomeRows) == 0 && summary.ArchiveStatus == "archived" {
		summary.FinancialClosureStatus = "pending_income_sync"
	}
	if settlableCount == 0 && summary.CompletionStatus != "approved" {
		summary.NextPendingAction = "先完成完工审批，结算与出款链才会继续推进"
	}
	return summary
}

func resolveCompletionStatus(project *model.Project) string {
	switch {
	case project.CompletionSubmittedAt == nil:
		return "not_submitted"
	case project.CompletionRejectedAt != nil:
		return "rejected"
	case project.CompletionSubmittedAt != nil && (project.BusinessStatus == model.ProjectBusinessStatusCompleted || project.Status == model.ProjectStatusCompleted || project.InspirationCaseDraftID > 0):
		return "approved"
	default:
		return "pending_review"
	}
}

func resolveArchiveStatus(project *model.Project) string {
	if project.InspirationCaseDraftID > 0 {
		return "archived"
	}
	if strings.TrimSpace(project.CurrentPhase) == "archived" || strings.TrimSpace(project.BusinessStatus) == model.ProjectBusinessStatusCompleted && project.Status == model.ProjectStatusCompleted {
		return "completion_ready"
	}
	return "not_archived"
}

func resolveCaseDraftStatus(project *model.Project) string {
	if project.InspirationCaseDraftID > 0 {
		return "generated"
	}
	if project.CompletionSubmittedAt != nil {
		return "pending_generation"
	}
	return "not_ready"
}

func normalizeSettlementStatus(current, candidate string) string {
	order := map[string]int{"not_scheduled": 0, "pending": 1, "scheduled": 2, "settled": 3, "closed": 4}
	candidate = strings.TrimSpace(candidate)
	if candidate == "" {
		return current
	}
	if order[candidate] > order[current] {
		return candidate
	}
	return current
}

func normalizePayoutStatus(current, candidate string) string {
	order := map[string]int{"not_started": 0, "pending": 1, "processing": 2, "paid": 3}
	candidate = strings.TrimSpace(candidate)
	if candidate == "failed" {
		return candidate
	}
	if order[candidate] > order[current] {
		return candidate
	}
	return current
}

func resolveFinancialClosureStatus(settlementStatus, payoutStatus string, incomeCount, payoutDoneCount int) string {
	switch {
	case payoutStatus == "failed":
		return "payout_failed"
	case incomeCount == 0:
		return "pending_settlement"
	case payoutDoneCount == incomeCount && incomeCount > 0:
		return "closed"
	case settlementStatus == "scheduled" || settlementStatus == "settled":
		return "awaiting_payout"
	default:
		return "pending_settlement"
	}
}

func resolveClosureNextPendingAction(summary *ProjectClosureSummary, project *model.Project) string {
	if summary == nil || project == nil {
		return "等待主链继续推进"
	}
	switch {
	case summary.CompletionStatus == "not_submitted":
		return "等待商家提交完工材料并发起完工审批"
	case summary.CompletionStatus == "pending_review":
		return "等待用户处理完工审批"
	case summary.CompletionStatus == "rejected":
		return firstNonBlank(project.CompletionRejectionReason, "完工审批被驳回，等待商家补充资料后重新提交")
	case summary.ArchiveStatus != "archived":
		return "等待案例草稿生成并完成项目归档"
	case summary.SettlementStatus == "not_scheduled" || summary.SettlementStatus == "pending":
		return "项目已归档，但资金侧仍待排结算"
	case summary.PayoutStatus == "pending" || summary.PayoutStatus == "processing":
		return "结算已进入出款链，等待实际出款完成"
	case summary.PayoutStatus == "failed":
		return "出款失败，需后台补偿或重试"
	case summary.FinancialClosureStatus == "closed":
		return "项目资料与资金都已完成收口"
	default:
		return fmt.Sprintf("当前结算状态：%s，出款状态：%s", summary.SettlementStatus, summary.PayoutStatus)
	}
}

func buildOrderClosureSummary(project *model.Project) *ProjectClosureSummary {
	return BuildProjectClosureSummary(project)
}

func formatClosureDate(value *time.Time) string {
	if value == nil {
		return "-"
	}
	return value.Format("2006-01-02 15:04")
}
