package service

import (
	"strings"

	"home-decoration-server/internal/model"
)

const (
	BookingStatusGroupPendingConfirmation = "pending_confirmation"
	BookingStatusGroupPendingPayment      = "pending_payment"
	BookingStatusGroupInService           = "in_service"
	BookingStatusGroupCompleted           = "completed"
	BookingStatusGroupCancelled           = "cancelled"
)

type BookingLifecycleView struct {
	model.Booking
	StatusGroup         string   `json:"statusGroup"`
	StatusText          string   `json:"statusText"`
	CurrentStage        string   `json:"currentStage,omitempty"`
	CurrentStageText    string   `json:"currentStageText,omitempty"`
	FlowSummary         string   `json:"flowSummary,omitempty"`
	AvailableActions    []string `json:"availableActions,omitempty"`
	SurveyDepositAmount float64  `json:"surveyDepositAmount"`
	ProposalID          uint64   `json:"proposalId,omitempty"`
}

func BuildBookingLifecycleView(booking model.Booking, p0Summary *BookingP0Summary, proposalID uint64) BookingLifecycleView {
	return buildBookingLifecycleView(&booking, p0Summary, proposalID)
}

func buildBookingLifecycleView(booking *model.Booking, p0Summary *BookingP0Summary, proposalID uint64) BookingLifecycleView {
	if booking == nil {
		return BookingLifecycleView{}
	}

	currentStage := strings.TrimSpace(firstNonBlank(
		valueOrEmpty(p0Summary, func(summary *BookingP0Summary) string { return summary.CurrentStage }),
	))
	flowSummary := strings.TrimSpace(firstNonBlank(
		valueOrEmpty(p0Summary, func(summary *BookingP0Summary) string { return summary.FlowSummary }),
	))
	statusGroup := resolveBookingStatusGroup(booking, currentStage, proposalID)
	statusText := resolveBookingStatusText(statusGroup)
	currentStageText := resolveBookingCurrentStageText(booking, p0Summary, proposalID, statusGroup, currentStage)
	if flowSummary == "" {
		flowSummary = resolveBookingFlowSummary(booking, p0Summary, proposalID, statusGroup, currentStageText)
	}
	availableActions := resolveUserBookingAvailableActions(
		statusGroup,
		valueOrEmptySlice(p0Summary, func(summary *BookingP0Summary) []string { return summary.AvailableActions }),
	)

	return BookingLifecycleView{
		Booking:              *booking,
		StatusGroup:          statusGroup,
		StatusText:           statusText,
		CurrentStage:         currentStage,
		CurrentStageText:     currentStageText,
		FlowSummary:          flowSummary,
		AvailableActions:     availableActions,
		SurveyDepositAmount:  normalizeAmount(booking.SurveyDeposit),
		ProposalID:           proposalID,
	}
}

func resolveUserBookingAvailableActions(statusGroup string, downstreamActions []string) []string {
	switch strings.TrimSpace(statusGroup) {
	case BookingStatusGroupPendingConfirmation:
		return []string{"cancel"}
	case BookingStatusGroupPendingPayment:
		return []string{"cancel", "pay_survey_deposit"}
	case BookingStatusGroupCancelled:
		return nil
	default:
		if len(downstreamActions) == 0 {
			return nil
		}
		return append([]string(nil), downstreamActions...)
	}
}

func resolveBookingStatusGroup(booking *model.Booking, currentStage string, proposalID uint64) string {
	if booking == nil {
		return ""
	}
	if booking.Status == 4 || model.NormalizeBusinessFlowStage(currentStage) == model.BusinessFlowStageCancelled {
		return BookingStatusGroupCancelled
	}
	if proposalID > 0 || booking.Status == 3 || isBookingCompletedStage(currentStage) {
		return BookingStatusGroupCompleted
	}
	if booking.Status == 2 && !booking.SurveyDepositPaid {
		return BookingStatusGroupPendingPayment
	}
	if booking.SurveyDepositPaid {
		return BookingStatusGroupInService
	}
	return BookingStatusGroupPendingConfirmation
}

func resolveBookingStatusText(statusGroup string) string {
	switch strings.TrimSpace(statusGroup) {
	case BookingStatusGroupPendingConfirmation:
		return "待商家确认"
	case BookingStatusGroupPendingPayment:
		return "待支付量房费"
	case BookingStatusGroupInService:
		return "服务推进中"
	case BookingStatusGroupCompleted:
		return "已进入后续阶段"
	case BookingStatusGroupCancelled:
		return "已取消"
	default:
		return "处理中"
	}
}

func resolveBookingCurrentStageText(
	booking *model.Booking,
	p0Summary *BookingP0Summary,
	proposalID uint64,
	statusGroup string,
	currentStage string,
) string {
	if booking == nil {
		return ""
	}
	if statusGroup == BookingStatusGroupCancelled {
		return "已取消"
	}
	if statusGroup == BookingStatusGroupPendingConfirmation {
		return "待商家确认"
	}
	if statusGroup == BookingStatusGroupPendingPayment {
		return "待支付量房费"
	}
	if proposalID > 0 {
		return "已进入方案阶段"
	}

	siteSurvey := valueOrEmptySiteSurvey(p0Summary)
	budgetConfirm := valueOrEmptyBudgetConfirm(p0Summary)

	switch {
	case budgetConfirm != nil && budgetConfirm.Status == model.BudgetConfirmationStatusRejected:
		return "待重新提交预算"
	case budgetConfirm != nil && budgetConfirm.Status == model.BudgetConfirmationStatusSubmitted:
		return "待用户确认预算"
	case budgetConfirm != nil && budgetConfirm.Status == model.BudgetConfirmationStatusAccepted:
		return "待商家提交方案"
	case siteSurvey != nil && siteSurvey.Status == model.SiteSurveyStatusRevisionRequested:
		return "待重新量房"
	case siteSurvey != nil && siteSurvey.Status == model.SiteSurveyStatusSubmitted:
		return "待用户确认量房记录"
	case siteSurvey != nil && siteSurvey.Status == model.SiteSurveyStatusConfirmed:
		return "待提交预算确认"
	case booking.SurveyDepositPaid:
		return "待安排量房"
	default:
		return resolveBusinessStageText(currentStage)
	}
}

func resolveBookingFlowSummary(
	booking *model.Booking,
	p0Summary *BookingP0Summary,
	proposalID uint64,
	statusGroup string,
	currentStageText string,
) string {
	if booking == nil {
		return ""
	}
	siteSurvey := valueOrEmptySiteSurvey(p0Summary)
	budgetConfirm := valueOrEmptyBudgetConfirm(p0Summary)

	switch statusGroup {
	case BookingStatusGroupPendingConfirmation:
		return "预约已提交，待商家确认是否接单。"
	case BookingStatusGroupPendingPayment:
		return "商家已确认预约，请先支付量房费后再继续推进。"
	case BookingStatusGroupCancelled:
		return "当前预约已取消，如需继续服务请重新发起预约。"
	}

	switch {
	case proposalID > 0:
		return "预约前置阶段已完成，已进入方案与后续订单阶段。"
	case budgetConfirm != nil && budgetConfirm.Status == model.BudgetConfirmationStatusRejected:
		return firstNonBlank(strings.TrimSpace(budgetConfirm.RejectionReason), "预算已被退回，待商家重新整理后提交。")
	case budgetConfirm != nil && budgetConfirm.Status == model.BudgetConfirmationStatusSubmitted:
		return "预算确认已提交，待你确认后进入方案阶段。"
	case budgetConfirm != nil && budgetConfirm.Status == model.BudgetConfirmationStatusAccepted:
		return "预算确认已接受，待商家继续提交方案。"
	case siteSurvey != nil && siteSurvey.Status == model.SiteSurveyStatusRevisionRequested:
		return firstNonBlank(strings.TrimSpace(siteSurvey.RevisionRequestReason), "量房记录已退回，待商家重新量房。")
	case siteSurvey != nil && siteSurvey.Status == model.SiteSurveyStatusSubmitted:
		return "量房记录已提交，待你确认后继续推进预算确认。"
	case siteSurvey != nil && siteSurvey.Status == model.SiteSurveyStatusConfirmed:
		return "量房记录已确认，待商家提交预算确认。"
	case booking.SurveyDepositPaid:
		return "量房费已支付，待商家安排量房并继续推进。"
	default:
		return currentStageText
	}
}

func resolveBusinessStageText(stage string) string {
	switch model.NormalizeBusinessFlowStage(strings.TrimSpace(stage)) {
	case model.BusinessFlowStageLeadPending:
		return "待商家确认"
	case model.BusinessFlowStageSurveyDepositPending:
		return "待安排量房"
	case model.BusinessFlowStageNegotiating:
		return "沟通中"
	case model.BusinessFlowStageDesignPendingSubmission:
		return "待商家提交方案"
	case model.BusinessFlowStageDesignPendingConfirmation:
		return "待确认设计方案"
	case model.BusinessFlowStageConstructionPartyPending:
		return "待确认施工方"
	case model.BusinessFlowStageConstructionQuotePending:
		return "待确认施工报价"
	case model.BusinessFlowStageReadyToStart:
		return "待开工"
	case model.BusinessFlowStageInConstruction:
		return "施工中"
	case model.BusinessFlowStageNodeAcceptanceInProgress:
		return "节点验收中"
	case model.BusinessFlowStageCompleted:
		return "已完工待验收"
	case model.BusinessFlowStageArchived:
		return "已归档"
	case model.BusinessFlowStageDisputed:
		return "争议中"
	case model.BusinessFlowStageCancelled:
		return "已取消"
	default:
		return "处理中"
	}
}

func isBookingCompletedStage(stage string) bool {
	switch model.NormalizeBusinessFlowStage(strings.TrimSpace(stage)) {
	case model.BusinessFlowStageDesignPendingConfirmation,
		model.BusinessFlowStageConstructionPartyPending,
		model.BusinessFlowStageConstructionQuotePending,
		model.BusinessFlowStageReadyToStart,
		model.BusinessFlowStageInConstruction,
		model.BusinessFlowStageNodeAcceptanceInProgress,
		model.BusinessFlowStageCompleted,
		model.BusinessFlowStageArchived,
		model.BusinessFlowStageDisputed,
		model.BusinessFlowStageDesignQuotePending,
		model.BusinessFlowStageDesignFeePaying,
		model.BusinessFlowStageDesignDeliveryPending,
		model.BusinessFlowStageDesignAcceptancePending,
		model.BusinessFlowStagePaymentPaused:
		return true
	default:
		return false
	}
}

func firstNonBlank(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}

func valueOrEmpty[T any](input *BookingP0Summary, selector func(*BookingP0Summary) T) T {
	var zero T
	if input == nil {
		return zero
	}
	return selector(input)
}

func valueOrEmptySlice(input *BookingP0Summary, selector func(*BookingP0Summary) []string) []string {
	if input == nil {
		return nil
	}
	return selector(input)
}

func valueOrEmptySiteSurvey(input *BookingP0Summary) *SiteSurveyDetail {
	if input == nil {
		return nil
	}
	return input.SiteSurvey
}

func valueOrEmptyBudgetConfirm(input *BookingP0Summary) *BudgetConfirmationDetail {
	if input == nil {
		return nil
	}
	return input.BudgetConfirm
}

func matchesBookingStatusGroup(view BookingLifecycleView, statusGroup string) bool {
	if strings.TrimSpace(statusGroup) == "" {
		return true
	}
	return strings.TrimSpace(statusGroup) == view.StatusGroup
}
