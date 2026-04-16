package service

import (
	"strings"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
)

const (
	NotificationKindInfo       = "info"
	NotificationKindTodo       = "todo"
	NotificationKindRisk       = "risk"
	NotificationKindResult     = "result"
	NotificationKindGovernance = "governance"

	NotificationPriorityNormal = "normal"
	NotificationPriorityHigh   = "high"
	NotificationPriorityUrgent = "urgent"

	NotificationActionStatusNone      = "none"
	NotificationActionStatusPending   = "pending"
	NotificationActionStatusProcessed = "processed"
	NotificationActionStatusExpired   = "expired"

	NotificationTypeSiteSurveySubmitted           = "booking.site_survey_submitted"
	NotificationTypeBudgetConfirmationSubmitted   = "booking.budget_confirmation_submitted"
	NotificationTypeBudgetConfirmationResubmitted = "booking.budget_confirmation_resubmitted"
	NotificationTypeBudgetConfirmationRejected    = "booking.budget_confirmation_rejected"
	NotificationTypeDesignFeeQuoteCreated         = "proposal.design_fee_quote_created"
	NotificationTypeDeliverableSubmitted          = "proposal.deliverable_submitted"
	NotificationTypeContractPendingConfirm        = "project.contract_pending_confirm"
	NotificationTypeConstructionBridgePending     = "project.construction_bridge_pending"
	NotificationTypeProjectPlannedStartUpdated    = "project.planned_start_updated"
	NotificationTypeSupervisionRiskEscalated      = "project.supervision_risk_escalated"
	NotificationTypeProjectSettlementScheduled    = "project.settlement.scheduled"
	NotificationTypeProjectPayoutProcessing       = "project.payout.processing"
	NotificationTypeProjectPayoutPaid             = "project.payout.paid"
	NotificationTypeProjectPayoutFailed           = "project.payout.failed"
	NotificationTypeProjectCaseDraftGenerated     = "project.case_draft.generated"
	NotificationTypeCaseAuditCreated              = "case_audit.created"
	NotificationTypePaymentBookingSurveyPaid      = "payment.booking.survey_paid"
	NotificationTypePaymentOrderPaid              = "payment.order.paid"
)

type NotificationSpec struct {
	Type               string
	Category           string
	Kind               string
	Priority           string
	ActionRequired     bool
	ActionLabel        string
	CanonicalActionURL string
	SupportsWeb        bool
	SupportsMini       bool
}

type NotificationListItem struct {
	model.Notification
	Category       string `json:"category"`
	Kind           string `json:"kind"`
	Priority       string `json:"priority"`
	ActionRequired bool   `json:"actionRequired"`
	ActionStatus   string `json:"actionStatus"`
	ActionLabel    string `json:"actionLabel,omitempty"`
	SupportsWeb    bool   `json:"supportsWeb"`
	SupportsMini   bool   `json:"supportsMini"`
}

var notificationSpecs = map[string]NotificationSpec{
	model.NotificationTypeBookingConfirmed: {
		Type:               model.NotificationTypeBookingConfirmed,
		Category:           NotificationCategoryProject,
		Kind:               NotificationKindInfo,
		Priority:           NotificationPriorityHigh,
		CanonicalActionURL: "/bookings/:id",
		SupportsWeb:        true,
		SupportsMini:       true,
	},
	model.NotificationTypeBookingCancelled: {
		Type:               model.NotificationTypeBookingCancelled,
		Category:           NotificationCategoryProject,
		Kind:               NotificationKindResult,
		Priority:           NotificationPriorityHigh,
		CanonicalActionURL: "/bookings/:id",
		SupportsWeb:        true,
		SupportsMini:       true,
	},
	NotificationTypeSiteSurveySubmitted: {
		Type:               NotificationTypeSiteSurveySubmitted,
		Category:           NotificationCategoryProject,
		Kind:               NotificationKindInfo,
		Priority:           NotificationPriorityNormal,
		CanonicalActionURL: "/bookings/:id/site-survey",
		SupportsWeb:        true,
		SupportsMini:       true,
	},
	NotificationTypeBudgetConfirmationSubmitted: {
		Type:               NotificationTypeBudgetConfirmationSubmitted,
		Category:           NotificationCategoryProject,
		Kind:               NotificationKindTodo,
		Priority:           NotificationPriorityHigh,
		ActionRequired:     true,
		ActionLabel:        "去确认",
		CanonicalActionURL: "/bookings/:id/budget-confirm",
		SupportsWeb:        true,
		SupportsMini:       true,
	},
	NotificationTypeBudgetConfirmationResubmitted: {
		Type:               NotificationTypeBudgetConfirmationResubmitted,
		Category:           NotificationCategoryProject,
		Kind:               NotificationKindTodo,
		Priority:           NotificationPriorityHigh,
		ActionRequired:     true,
		ActionLabel:        "去确认",
		CanonicalActionURL: "/bookings/:id/budget-confirm",
		SupportsWeb:        true,
		SupportsMini:       true,
	},
	NotificationTypeBudgetConfirmationRejected: {
		Type:               NotificationTypeBudgetConfirmationRejected,
		Category:           NotificationCategoryProject,
		Kind:               NotificationKindResult,
		Priority:           NotificationPriorityHigh,
		CanonicalActionURL: "/bookings/:id/flow",
		SupportsWeb:        true,
		SupportsMini:       false,
	},
	NotificationTypeDesignFeeQuoteCreated: {
		Type:               NotificationTypeDesignFeeQuoteCreated,
		Category:           NotificationCategoryProject,
		Kind:               NotificationKindTodo,
		Priority:           NotificationPriorityHigh,
		ActionRequired:     true,
		ActionLabel:        "查看报价",
		CanonicalActionURL: "/bookings/:id/design-quote",
		SupportsWeb:        true,
		SupportsMini:       true,
	},
	model.NotificationTypeOrderCreated: {
		Type:               model.NotificationTypeOrderCreated,
		Category:           NotificationCategoryPayment,
		Kind:               NotificationKindTodo,
		Priority:           NotificationPriorityHigh,
		ActionRequired:     true,
		ActionLabel:        "去支付",
		CanonicalActionURL: "/orders/:id",
		SupportsWeb:        true,
		SupportsMini:       true,
	},
	"payment.construction.pending": {
		Type:               "payment.construction.pending",
		Category:           NotificationCategoryPayment,
		Kind:               NotificationKindTodo,
		Priority:           NotificationPriorityHigh,
		ActionRequired:     true,
		ActionLabel:        "去支付",
		CanonicalActionURL: "/orders/:id",
		SupportsWeb:        true,
		SupportsMini:       true,
	},
	"payment.construction.stage_pending": {
		Type:               "payment.construction.stage_pending",
		Category:           NotificationCategoryPayment,
		Kind:               NotificationKindTodo,
		Priority:           NotificationPriorityHigh,
		ActionRequired:     true,
		ActionLabel:        "去支付",
		CanonicalActionURL: "/orders/:id",
		SupportsWeb:        true,
		SupportsMini:       true,
	},
	"payment.construction.final_pending": {
		Type:               "payment.construction.final_pending",
		Category:           NotificationCategoryPayment,
		Kind:               NotificationKindTodo,
		Priority:           NotificationPriorityHigh,
		ActionRequired:     true,
		ActionLabel:        "去支付",
		CanonicalActionURL: "/orders/:id",
		SupportsWeb:        true,
		SupportsMini:       true,
	},
	"change_order.payment_pending": {
		Type:               "change_order.payment_pending",
		Category:           NotificationCategoryPayment,
		Kind:               NotificationKindTodo,
		Priority:           NotificationPriorityHigh,
		ActionRequired:     true,
		ActionLabel:        "去支付",
		CanonicalActionURL: "/orders/:id",
		SupportsWeb:        true,
		SupportsMini:       true,
	},
	NotificationTypePaymentBookingSurveyPaid: {
		Type:               NotificationTypePaymentBookingSurveyPaid,
		Category:           NotificationCategoryPayment,
		Kind:               NotificationKindResult,
		Priority:           NotificationPriorityNormal,
		CanonicalActionURL: "/bookings/:id",
		SupportsWeb:        true,
		SupportsMini:       true,
	},
	NotificationTypePaymentOrderPaid: {
		Type:               NotificationTypePaymentOrderPaid,
		Category:           NotificationCategoryPayment,
		Kind:               NotificationKindResult,
		Priority:           NotificationPriorityNormal,
		CanonicalActionURL: "/orders/:id",
		SupportsWeb:        true,
		SupportsMini:       true,
	},
	model.NotificationTypeProposalSubmitted: {
		Type:               model.NotificationTypeProposalSubmitted,
		Category:           NotificationCategoryProject,
		Kind:               NotificationKindTodo,
		Priority:           NotificationPriorityHigh,
		ActionRequired:     true,
		ActionLabel:        "查看方案",
		CanonicalActionURL: "/proposals/:id",
		SupportsWeb:        true,
		SupportsMini:       true,
	},
	NotificationTypeDeliverableSubmitted: {
		Type:               NotificationTypeDeliverableSubmitted,
		Category:           NotificationCategoryProject,
		Kind:               NotificationKindTodo,
		Priority:           NotificationPriorityHigh,
		ActionRequired:     true,
		ActionLabel:        "查看交付",
		CanonicalActionURL: "/bookings/:id/design-deliverable",
		SupportsWeb:        true,
		SupportsMini:       true,
	},
	NotificationTypeContractPendingConfirm: {
		Type:               NotificationTypeContractPendingConfirm,
		Category:           NotificationCategoryProject,
		Kind:               NotificationKindTodo,
		Priority:           NotificationPriorityHigh,
		ActionRequired:     true,
		ActionLabel:        "确认合同",
		CanonicalActionURL: "/projects/:id/contract",
		SupportsWeb:        true,
		SupportsMini:       true,
	},
	NotificationTypeConstructionBridgePending: {
		Type:               NotificationTypeConstructionBridgePending,
		Category:           NotificationCategoryProject,
		Kind:               NotificationKindInfo,
		Priority:           NotificationPriorityNormal,
		ActionLabel:        "查看进度",
		CanonicalActionURL: "/progress",
		SupportsWeb:        true,
		SupportsMini:       true,
	},
	NotificationTypeProjectPlannedStartUpdated: {
		Type:               NotificationTypeProjectPlannedStartUpdated,
		Category:           NotificationCategoryProject,
		Kind:               NotificationKindInfo,
		Priority:           NotificationPriorityHigh,
		CanonicalActionURL: "/projects/:id",
		SupportsWeb:        true,
		SupportsMini:       true,
	},
	NotificationTypeSupervisionRiskEscalated: {
		Type:               NotificationTypeSupervisionRiskEscalated,
		Category:           NotificationCategoryProject,
		Kind:               NotificationKindRisk,
		Priority:           NotificationPriorityUrgent,
		CanonicalActionURL: "/supervision/:id",
		SupportsWeb:        true,
		SupportsMini:       false,
	},
	NotificationTypeProjectSettlementScheduled: {
		Type:               NotificationTypeProjectSettlementScheduled,
		Category:           NotificationCategoryPayment,
		Kind:               NotificationKindInfo,
		Priority:           NotificationPriorityHigh,
		CanonicalActionURL: "/income",
		SupportsWeb:        true,
		SupportsMini:       false,
	},
	NotificationTypeProjectPayoutProcessing: {
		Type:               NotificationTypeProjectPayoutProcessing,
		Category:           NotificationCategoryPayment,
		Kind:               NotificationKindInfo,
		Priority:           NotificationPriorityHigh,
		CanonicalActionURL: "/income",
		SupportsWeb:        true,
		SupportsMini:       false,
	},
	NotificationTypeProjectPayoutPaid: {
		Type:               NotificationTypeProjectPayoutPaid,
		Category:           NotificationCategoryPayment,
		Kind:               NotificationKindResult,
		Priority:           NotificationPriorityNormal,
		CanonicalActionURL: "/income",
		SupportsWeb:        true,
		SupportsMini:       false,
	},
	NotificationTypeProjectPayoutFailed: {
		Type:               NotificationTypeProjectPayoutFailed,
		Category:           NotificationCategoryPayment,
		Kind:               NotificationKindRisk,
		Priority:           NotificationPriorityUrgent,
		ActionRequired:     true,
		ActionLabel:        "查看资金",
		CanonicalActionURL: "/income",
		SupportsWeb:        true,
		SupportsMini:       false,
	},
	NotificationTypeProjectCaseDraftGenerated: {
		Type:               NotificationTypeProjectCaseDraftGenerated,
		Category:           NotificationCategoryProject,
		Kind:               NotificationKindResult,
		Priority:           NotificationPriorityNormal,
		CanonicalActionURL: "/cases",
		SupportsWeb:        true,
		SupportsMini:       false,
	},
	NotificationTypeCaseAuditCreated: {
		Type:               NotificationTypeCaseAuditCreated,
		Category:           NotificationCategoryProject,
		Kind:               NotificationKindGovernance,
		Priority:           NotificationPriorityHigh,
		ActionRequired:     true,
		ActionLabel:        "去审核",
		CanonicalActionURL: "/cases/manage",
		SupportsWeb:        true,
		SupportsMini:       false,
	},
	"quote.submitted": {
		Type:               "quote.submitted",
		Category:           NotificationCategoryProject,
		Kind:               NotificationKindTodo,
		Priority:           NotificationPriorityHigh,
		ActionRequired:     true,
		ActionLabel:        "确认报价",
		CanonicalActionURL: "/quote-tasks/:id",
		SupportsWeb:        true,
		SupportsMini:       true,
	},
	"change_order.created": {
		Type:               "change_order.created",
		Category:           NotificationCategoryProject,
		Kind:               NotificationKindTodo,
		Priority:           NotificationPriorityHigh,
		ActionRequired:     true,
		ActionLabel:        "处理变更",
		CanonicalActionURL: "/projects/:id/change-request",
		SupportsWeb:        true,
		SupportsMini:       true,
	},
	"project.milestone.submitted": {
		Type:               "project.milestone.submitted",
		Category:           NotificationCategoryProject,
		Kind:               NotificationKindTodo,
		Priority:           NotificationPriorityHigh,
		ActionRequired:     true,
		ActionLabel:        "去验收",
		CanonicalActionURL: "/projects/:id",
		SupportsWeb:        true,
		SupportsMini:       true,
	},
	"project.completion.submitted": {
		Type:               "project.completion.submitted",
		Category:           NotificationCategoryProject,
		Kind:               NotificationKindTodo,
		Priority:           NotificationPriorityHigh,
		ActionRequired:     true,
		ActionLabel:        "查看完工",
		CanonicalActionURL: "/projects/:id/completion",
		SupportsWeb:        true,
		SupportsMini:       true,
	},
	"payment.construction.expiring": {
		Type:               "payment.construction.expiring",
		Category:           NotificationCategoryPayment,
		Kind:               NotificationKindRisk,
		Priority:           NotificationPriorityHigh,
		ActionRequired:     true,
		ActionLabel:        "去支付",
		CanonicalActionURL: "/orders/:id",
		SupportsWeb:        true,
		SupportsMini:       true,
	},
	"payment.construction.expired": {
		Type:               "payment.construction.expired",
		Category:           NotificationCategoryPayment,
		Kind:               NotificationKindRisk,
		Priority:           NotificationPriorityUrgent,
		ActionRequired:     true,
		ActionLabel:        "查看订单",
		CanonicalActionURL: "/orders/:id",
		SupportsWeb:        true,
		SupportsMini:       true,
	},
	"refund.application.approved": {
		Type:         "refund.application.approved",
		Category:     NotificationCategoryPayment,
		Kind:         NotificationKindResult,
		Priority:     NotificationPriorityNormal,
		SupportsWeb:  true,
		SupportsMini: true,
	},
	"refund.application.rejected": {
		Type:         "refund.application.rejected",
		Category:     NotificationCategoryPayment,
		Kind:         NotificationKindResult,
		Priority:     NotificationPriorityNormal,
		SupportsWeb:  true,
		SupportsMini: true,
	},
	"refund.completed": {
		Type:         "refund.completed",
		Category:     NotificationCategoryPayment,
		Kind:         NotificationKindResult,
		Priority:     NotificationPriorityNormal,
		SupportsWeb:  true,
		SupportsMini: true,
	},
}

func resolveNotificationSpec(notification *model.Notification) NotificationSpec {
	if notification == nil {
		return NotificationSpec{
			Category:    NotificationCategorySystem,
			Kind:        NotificationKindInfo,
			Priority:    NotificationPriorityNormal,
			SupportsWeb: true,
		}
	}

	typeKey := strings.TrimSpace(notification.Type)
	if spec, ok := notificationSpecs[typeKey]; ok {
		if spec.CanonicalActionURL == "" {
			spec.CanonicalActionURL = strings.TrimSpace(notification.ActionURL)
		}
		if !spec.SupportsMini {
			spec.SupportsMini = notificationRouteSupportedInMini(notification.ActionURL)
		}
		return spec
	}

	category := resolveNotificationCategory(&CreateNotificationInput{
		Type:        notification.Type,
		RelatedType: notification.RelatedType,
		ActionURL:   notification.ActionURL,
	})
	spec := NotificationSpec{
		Type:               typeKey,
		Category:           category,
		Kind:               NotificationKindInfo,
		Priority:           NotificationPriorityNormal,
		CanonicalActionURL: strings.TrimSpace(notification.ActionURL),
		SupportsWeb:        true,
		SupportsMini:       notificationRouteSupportedInMini(notification.ActionURL),
	}

	switch {
	case strings.HasPrefix(typeKey, "payment.") && strings.Contains(typeKey, "pending"):
		spec.Kind = NotificationKindTodo
		spec.Priority = NotificationPriorityHigh
		spec.ActionRequired = true
		spec.ActionLabel = "去支付"
	case strings.HasPrefix(typeKey, "payment.") && strings.Contains(typeKey, "expiring"):
		spec.Kind = NotificationKindRisk
		spec.Priority = NotificationPriorityHigh
		spec.ActionRequired = true
		spec.ActionLabel = "去支付"
	case strings.HasPrefix(typeKey, "payment.") && strings.Contains(typeKey, "expired"):
		spec.Kind = NotificationKindRisk
		spec.Priority = NotificationPriorityUrgent
		spec.ActionRequired = true
		spec.ActionLabel = "查看订单"
	case strings.HasSuffix(typeKey, ".submitted"):
		spec.Kind = NotificationKindTodo
		spec.Priority = NotificationPriorityHigh
		spec.ActionRequired = true
		spec.ActionLabel = "查看详情"
	case strings.HasSuffix(typeKey, ".created") && category == NotificationCategoryPayment:
		spec.Kind = NotificationKindTodo
		spec.Priority = NotificationPriorityHigh
		spec.ActionRequired = true
		spec.ActionLabel = "去处理"
	case strings.HasSuffix(typeKey, ".approved") || strings.HasSuffix(typeKey, ".rejected") || strings.HasSuffix(typeKey, ".confirmed") || strings.HasSuffix(typeKey, ".paid"):
		spec.Kind = NotificationKindResult
		if category == NotificationCategoryProject {
			spec.Kind = NotificationKindInfo
		}
	case category == NotificationCategoryPayment:
		spec.Kind = NotificationKindResult
	case strings.HasPrefix(typeKey, "audit.") || strings.Contains(typeKey, "dispute"):
		spec.Kind = NotificationKindGovernance
	}

	return spec
}

func notificationRouteSupportedInMini(actionURL string) bool {
	normalized := strings.TrimSpace(actionURL)
	switch {
	case normalized == "":
		return false
	case normalized == "/progress":
		return true
	case strings.HasPrefix(normalized, "/bookings/"),
		strings.HasPrefix(normalized, "/orders/"),
		strings.HasPrefix(normalized, "/projects/"),
		strings.HasPrefix(normalized, "/proposals/"),
		strings.HasPrefix(normalized, "/quote-tasks/"),
		strings.HasPrefix(normalized, "/me/notifications"):
		return true
	default:
		return false
	}
}

func (s *NotificationService) buildNotificationListItem(notification model.Notification) NotificationListItem {
	spec := resolveNotificationSpec(&notification)
	return NotificationListItem{
		Notification:   notification,
		Category:       spec.Category,
		Kind:           spec.Kind,
		Priority:       spec.Priority,
		ActionRequired: spec.ActionRequired,
		ActionStatus:   s.resolveNotificationActionStatus(notification, spec),
		ActionLabel:    spec.ActionLabel,
		SupportsWeb:    spec.SupportsWeb,
		SupportsMini:   spec.SupportsMini,
	}
}

func (s *NotificationService) resolveNotificationActionStatus(notification model.Notification, spec NotificationSpec) string {
	if !spec.ActionRequired {
		return NotificationActionStatusNone
	}

	switch notification.Type {
	case NotificationTypeBudgetConfirmationSubmitted:
		return resolveBudgetConfirmationActionStatus(notification.RelatedID)
	case NotificationTypeDesignFeeQuoteCreated:
		return resolveDesignFeeQuoteActionStatus(notification.RelatedID)
	case model.NotificationTypeOrderCreated,
		"payment.construction.pending",
		"payment.construction.stage_pending",
		"payment.construction.final_pending",
		"change_order.payment_pending":
		return resolveOrderActionStatus(notification.RelatedID, false)
	case "payment.construction.expiring":
		return resolveOrderActionStatus(notification.RelatedID, false)
	case "payment.construction.expired":
		return resolveOrderActionStatus(notification.RelatedID, true)
	case NotificationTypeDeliverableSubmitted:
		return resolveDesignDeliverableActionStatus(notification.RelatedID)
	case model.NotificationTypeProposalSubmitted:
		return resolveProposalActionStatus(notification.RelatedID)
	case NotificationTypeContractPendingConfirm:
		return resolveContractActionStatus(notification.RelatedID)
	case "quote.submitted":
		return resolveQuoteListActionStatus(notification.RelatedID)
	case "project.milestone.submitted":
		return resolveMilestoneActionStatus(notification.RelatedID)
	case "project.completion.submitted":
		return resolveProjectCompletionActionStatus(notification.RelatedID)
	case "change_order.created":
		return resolveChangeOrderActionStatus(notification.RelatedID)
	default:
		return NotificationActionStatusPending
	}
}

func resolveBudgetConfirmationActionStatus(relatedID uint64) string {
	if relatedID == 0 {
		return NotificationActionStatusPending
	}
	var confirmation model.BudgetConfirmation
	if err := repository.DB.Select("status").First(&confirmation, relatedID).Error; err != nil {
		return NotificationActionStatusPending
	}
	if confirmation.Status == model.BudgetConfirmationStatusSubmitted {
		return NotificationActionStatusPending
	}
	return NotificationActionStatusProcessed
}

func resolveDesignFeeQuoteActionStatus(relatedID uint64) string {
	if relatedID == 0 {
		return NotificationActionStatusPending
	}
	var quote model.DesignFeeQuote
	if err := repository.DB.Select("status").First(&quote, relatedID).Error; err != nil {
		return NotificationActionStatusPending
	}
	switch quote.Status {
	case model.DesignFeeQuoteStatusPending:
		return NotificationActionStatusPending
	case model.DesignFeeQuoteStatusExpired:
		return NotificationActionStatusExpired
	default:
		return NotificationActionStatusProcessed
	}
}

func resolveOrderActionStatus(relatedID uint64, expired bool) string {
	if relatedID == 0 {
		if expired {
			return NotificationActionStatusExpired
		}
		return NotificationActionStatusPending
	}
	var order model.Order
	if err := repository.DB.Select("status").First(&order, relatedID).Error; err != nil {
		if expired {
			return NotificationActionStatusExpired
		}
		return NotificationActionStatusPending
	}
	switch order.Status {
	case model.OrderStatusPending:
		if expired {
			return NotificationActionStatusExpired
		}
		return NotificationActionStatusPending
	default:
		return NotificationActionStatusProcessed
	}
}

func resolveDesignDeliverableActionStatus(relatedID uint64) string {
	if relatedID == 0 {
		return NotificationActionStatusPending
	}
	var deliverable model.DesignDeliverable
	if err := repository.DB.Select("status").First(&deliverable, relatedID).Error; err != nil {
		return NotificationActionStatusPending
	}
	if deliverable.Status == model.DesignDeliverableStatusSubmitted {
		return NotificationActionStatusPending
	}
	return NotificationActionStatusProcessed
}

func resolveProposalActionStatus(relatedID uint64) string {
	if relatedID == 0 {
		return NotificationActionStatusPending
	}
	var proposal model.Proposal
	if err := repository.DB.Select("status").First(&proposal, relatedID).Error; err != nil {
		return NotificationActionStatusPending
	}
	if proposal.Status == model.ProposalStatusPending {
		return NotificationActionStatusPending
	}
	return NotificationActionStatusProcessed
}

func resolveContractActionStatus(relatedID uint64) string {
	if relatedID == 0 {
		return NotificationActionStatusPending
	}
	var contract model.Contract
	if err := repository.DB.Select("status").First(&contract, relatedID).Error; err != nil {
		return NotificationActionStatusPending
	}
	if contract.Status == model.ContractStatusDraft || contract.Status == model.ContractStatusPendingConfirm {
		return NotificationActionStatusPending
	}
	return NotificationActionStatusProcessed
}

func resolveQuoteListActionStatus(relatedID uint64) string {
	if relatedID == 0 {
		return NotificationActionStatusPending
	}
	var quoteList model.QuoteList
	if err := repository.DB.Select("user_confirmation_status").First(&quoteList, relatedID).Error; err != nil {
		return NotificationActionStatusPending
	}
	if quoteList.UserConfirmationStatus == model.QuoteUserConfirmationPending {
		return NotificationActionStatusPending
	}
	return NotificationActionStatusProcessed
}

func resolveMilestoneActionStatus(relatedID uint64) string {
	if relatedID == 0 {
		return NotificationActionStatusPending
	}
	var milestone model.Milestone
	if err := repository.DB.Select("status").First(&milestone, relatedID).Error; err != nil {
		return NotificationActionStatusPending
	}
	switch milestone.Status {
	case model.MilestoneStatusAccepted, model.MilestoneStatusRejected, model.MilestoneStatusPaid:
		return NotificationActionStatusProcessed
	default:
		return NotificationActionStatusPending
	}
}

func resolveProjectCompletionActionStatus(relatedID uint64) string {
	if relatedID == 0 {
		return NotificationActionStatusPending
	}
	var project model.Project
	if err := repository.DB.Select("completion_submitted_at", "completion_rejected_at", "inspiration_case_draft_id").First(&project, relatedID).Error; err != nil {
		return NotificationActionStatusPending
	}
	if project.CompletionRejectedAt != nil || project.InspirationCaseDraftID > 0 {
		return NotificationActionStatusProcessed
	}
	if project.CompletionSubmittedAt != nil {
		return NotificationActionStatusPending
	}
	return NotificationActionStatusProcessed
}

func resolveChangeOrderActionStatus(relatedID uint64) string {
	if relatedID == 0 {
		return NotificationActionStatusPending
	}
	var changeOrder model.ChangeOrder
	if err := repository.DB.Select("status").First(&changeOrder, relatedID).Error; err != nil {
		return NotificationActionStatusPending
	}
	if changeOrder.Status == model.ChangeOrderStatusPendingUserConfirm {
		return NotificationActionStatusPending
	}
	return NotificationActionStatusProcessed
}
