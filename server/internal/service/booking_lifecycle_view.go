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

func BuildBookingLifecycleView(booking model.Booking, p0Summary *BookingP0Summary, proposalID uint64, deliverable *model.DesignDeliverable) BookingLifecycleView {
	return buildBookingLifecycleView(&booking, p0Summary, proposalID, deliverable)
}

func buildBookingLifecycleView(booking *model.Booking, p0Summary *BookingP0Summary, proposalID uint64, deliverable *model.DesignDeliverable) BookingLifecycleView {
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
	currentStageText := resolveBookingCurrentStageText(booking, p0Summary, proposalID, deliverable, statusGroup, currentStage)
	if flowSummary == "" {
		flowSummary = resolveBookingFlowSummary(booking, p0Summary, proposalID, deliverable, statusGroup, currentStage, currentStageText)
	}
	availableActions := resolveUserBookingAvailableActions(
		statusGroup,
		valueOrEmptySlice(p0Summary, func(summary *BookingP0Summary) []string { return summary.AvailableActions }),
	)

	return BookingLifecycleView{
		Booking:             *booking,
		StatusGroup:         statusGroup,
		StatusText:          statusText,
		CurrentStage:        currentStage,
		CurrentStageText:    currentStageText,
		FlowSummary:         flowSummary,
		AvailableActions:    availableActions,
		SurveyDepositAmount: normalizeAmount(booking.SurveyDeposit),
		ProposalID:          proposalID,
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
	normalizedStage := model.NormalizeBusinessFlowStage(strings.TrimSpace(currentStage))
	if booking.Status == 4 || model.NormalizeBusinessFlowStage(currentStage) == model.BusinessFlowStageCancelled {
		return BookingStatusGroupCancelled
	}
	if booking.Status == 3 || isBookingCompletedStage(normalizedStage) {
		return BookingStatusGroupCompleted
	}
	if booking.Status == 2 && !booking.SurveyDepositPaid {
		return BookingStatusGroupPendingPayment
	}
	if proposalID > 0 {
		return BookingStatusGroupInService
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
	deliverable *model.DesignDeliverable,
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
	normalizedStage := model.NormalizeBusinessFlowStage(strings.TrimSpace(currentStage))
	if isConstructionBridgeStarted(normalizedStage) {
		if normalizedStage == model.BusinessFlowStageConstructionPartyPending {
			return "施工桥接中"
		}
		return resolveBusinessStageText(normalizedStage)
	}
	if proposalID > 0 {
		return "待确认正式方案"
	}
	if deliverable != nil {
		switch deliverable.Status {
		case model.DesignDeliverableStatusRejected:
			return "待重新提交设计交付"
		case model.DesignDeliverableStatusSubmitted:
			return "待确认设计交付"
		case model.DesignDeliverableStatusAccepted:
			return "待生成正式方案"
		}
	}
	switch normalizedStage {
	case model.BusinessFlowStageDesignQuotePending:
		return "待发起设计费报价"
	case model.BusinessFlowStageDesignFeePaying:
		return "待继续支付设计费"
	case model.BusinessFlowStageDesignDeliveryPending:
		return "待设计师提交设计交付"
	case model.BusinessFlowStageDesignAcceptancePending:
		return "待确认设计交付"
	case model.BusinessFlowStageDesignPendingConfirmation:
		return "待确认正式方案"
	}

	siteSurvey := valueOrEmptySiteSurvey(p0Summary)
	budgetConfirm := valueOrEmptyBudgetConfirm(p0Summary)

	switch {
	case budgetConfirm != nil && budgetConfirm.Status == model.BudgetConfirmationStatusRejected:
		return "待重新提交沟通确认"
	case budgetConfirm != nil && budgetConfirm.Status == model.BudgetConfirmationStatusSubmitted:
		return "待用户确认沟通结果"
	case budgetConfirm != nil && budgetConfirm.Status == model.BudgetConfirmationStatusAccepted:
		return "待发起设计费报价"
	case siteSurvey != nil && siteSurvey.Status == model.SiteSurveyStatusRevisionRequested:
		return "待重新上传量房资料"
	case siteSurvey != nil && (siteSurvey.Status == model.SiteSurveyStatusSubmitted || siteSurvey.Status == model.SiteSurveyStatusConfirmed):
		return "待提交沟通确认"
	case booking.SurveyDepositPaid:
		return "待上传量房资料"
	default:
		return resolveBusinessStageText(currentStage)
	}
}

func resolveBookingFlowSummary(
	booking *model.Booking,
	p0Summary *BookingP0Summary,
	proposalID uint64,
	deliverable *model.DesignDeliverable,
	statusGroup string,
	currentStage string,
	currentStageText string,
) string {
	if booking == nil {
		return ""
	}
	siteSurvey := valueOrEmptySiteSurvey(p0Summary)
	budgetConfirm := valueOrEmptyBudgetConfirm(p0Summary)

	normalizedStage := model.NormalizeBusinessFlowStage(strings.TrimSpace(currentStage))

	switch statusGroup {
	case BookingStatusGroupPendingConfirmation:
		return "预约已提交，待商家确认是否接单。"
	case BookingStatusGroupPendingPayment:
		return "商家已确认预约，请先支付量房费后再继续推进。"
	case BookingStatusGroupCancelled:
		return "当前预约已取消，如需继续服务请重新发起预约。"
	}

	switch {
	case isConstructionBridgeStarted(normalizedStage):
		if normalizedStage == model.BusinessFlowStageConstructionPartyPending {
			return "正式方案已确认，待提交报价基线、选择施工主体并进入施工报价。"
		}
		return currentStageText
	case proposalID > 0:
		return "正式方案已提交，待你确认后进入施工桥接。"
	case deliverable != nil && deliverable.Status == model.DesignDeliverableStatusRejected:
		return firstNonBlank(strings.TrimSpace(deliverable.RejectionReason), "设计交付已退回，待设计师重新提交。")
	case deliverable != nil && deliverable.Status == model.DesignDeliverableStatusSubmitted:
		return "设计交付已提交，待你确认后继续进入正式方案确认。"
	case deliverable != nil && deliverable.Status == model.DesignDeliverableStatusAccepted:
		return "设计交付已确认，待设计师生成正式方案。"
	case normalizedStage == model.BusinessFlowStageDesignDeliveryPending:
		return "设计费已支付，待设计师提交设计交付。"
	case normalizedStage == model.BusinessFlowStageDesignAcceptancePending:
		return "设计交付已提交，待你确认。"
	case normalizedStage == model.BusinessFlowStageDesignPendingConfirmation:
		return "正式方案已提交，待你确认。"
	case budgetConfirm != nil && budgetConfirm.Status == model.BudgetConfirmationStatusRejected:
		return firstNonBlank(strings.TrimSpace(budgetConfirm.RejectionReason), "沟通确认已被退回，待商家重新整理后提交。")
	case budgetConfirm != nil && budgetConfirm.Status == model.BudgetConfirmationStatusSubmitted:
		return "沟通确认已提交，待你确认后进入设计费报价阶段。"
	case budgetConfirm != nil && budgetConfirm.Status == model.BudgetConfirmationStatusAccepted:
		return "沟通确认已接受，待商家发起设计费报价。"
	case siteSurvey != nil && siteSurvey.Status == model.SiteSurveyStatusRevisionRequested:
		return firstNonBlank(strings.TrimSpace(siteSurvey.RevisionRequestReason), "历史量房资料曾被退回，待商家重新提交最新资料。")
	case siteSurvey != nil && (siteSurvey.Status == model.SiteSurveyStatusSubmitted || siteSurvey.Status == model.SiteSurveyStatusConfirmed):
		return "量房资料已提交，待商家继续提交沟通确认。"
	case booking.SurveyDepositPaid:
		return "量房费已支付，待商家上传量房资料并继续推进。"
	default:
		return currentStageText
	}
}

func isConstructionBridgeStarted(stage string) bool {
	switch model.NormalizeBusinessFlowStage(strings.TrimSpace(stage)) {
	case model.BusinessFlowStageConstructionPartyPending,
		model.BusinessFlowStageConstructionQuotePending,
		model.BusinessFlowStageReadyToStart,
		model.BusinessFlowStageInConstruction,
		model.BusinessFlowStageNodeAcceptanceInProgress,
		model.BusinessFlowStageCompleted,
		model.BusinessFlowStageArchived,
		model.BusinessFlowStageDisputed,
		model.BusinessFlowStagePaymentPaused:
		return true
	default:
		return false
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
		return "施工桥接中"
	case model.BusinessFlowStageConstructionQuotePending:
		return "待确认施工报价"
	case model.BusinessFlowStageReadyToStart:
		return "待监理协调开工"
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
	case model.BusinessFlowStageConstructionPartyPending,
		model.BusinessFlowStageConstructionQuotePending,
		model.BusinessFlowStageReadyToStart,
		model.BusinessFlowStageInConstruction,
		model.BusinessFlowStageNodeAcceptanceInProgress,
		model.BusinessFlowStageCompleted,
		model.BusinessFlowStageArchived,
		model.BusinessFlowStageDisputed,
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
