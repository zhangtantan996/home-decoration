package model

import "time"

const (
	BusinessFlowSourceBooking = "booking"
	BusinessFlowSourceDemand  = "demand"
)

const (
	BusinessFlowStageLeadPending              = "lead_pending"
	BusinessFlowStageNegotiating              = "negotiating"
	BusinessFlowStageConsulting               = "consulting"
	BusinessFlowStageDesignPendingSubmission  = "design_pending_submission"
	BusinessFlowStageDesignPendingConfirmation = "design_pending_confirmation"
	BusinessFlowStageProposalPending          = "proposal_pending"
	BusinessFlowStageConstructionPartyPending = "construction_party_pending"
	BusinessFlowStageProposalConfirmed        = "proposal_confirmed"
	BusinessFlowStageConstructorPending       = "constructor_pending"
	BusinessFlowStageConstructionQuotePending = "construction_quote_pending"
	BusinessFlowStageReadyToStart             = "ready_to_start"
	BusinessFlowStageInConstruction           = "in_construction"
	BusinessFlowStageInProgress               = "in_progress"
	BusinessFlowStageNodeAcceptanceInProgress = "node_acceptance_in_progress"
	BusinessFlowStageMilestoneReview          = "milestone_review"
	BusinessFlowStageCompleted                = "completed"
	BusinessFlowStageCasePendingGeneration    = "case_pending_generation"
	BusinessFlowStageArchived                 = "archived"
	BusinessFlowStageDisputed                 = "disputed"
	BusinessFlowStageCancelled                = "cancelled"

	// 设计阶段新增
	BusinessFlowStageSurveyDepositPending    = "survey_deposit_pending"
	BusinessFlowStageDesignQuotePending      = "design_quote_pending"
	BusinessFlowStageDesignFeePaying         = "design_fee_paying"
	BusinessFlowStageDesignDeliveryPending   = "design_delivery_pending"
	BusinessFlowStageDesignAcceptancePending = "design_acceptance_pending"
	BusinessFlowStagePaymentPaused           = "payment_paused"
)

func NormalizeBusinessFlowStage(stage string) string {
	switch stage {
	case "", BusinessFlowStageLeadPending:
		return BusinessFlowStageLeadPending
	case BusinessFlowStageConsulting:
		return BusinessFlowStageNegotiating
	case BusinessFlowStageNegotiating:
		return BusinessFlowStageNegotiating
	case BusinessFlowStageDesignPendingSubmission:
		return BusinessFlowStageDesignPendingSubmission
	case BusinessFlowStageProposalPending:
		return BusinessFlowStageDesignPendingConfirmation
	case BusinessFlowStageDesignPendingConfirmation:
		return BusinessFlowStageDesignPendingConfirmation
	case BusinessFlowStageProposalConfirmed, BusinessFlowStageConstructorPending:
		return BusinessFlowStageConstructionPartyPending
	case BusinessFlowStageConstructionPartyPending:
		return BusinessFlowStageConstructionPartyPending
	case BusinessFlowStageConstructionQuotePending:
		return BusinessFlowStageConstructionQuotePending
	case BusinessFlowStageReadyToStart:
		return BusinessFlowStageReadyToStart
	case BusinessFlowStageInProgress:
		return BusinessFlowStageInConstruction
	case BusinessFlowStageInConstruction:
		return BusinessFlowStageInConstruction
	case BusinessFlowStageMilestoneReview:
		return BusinessFlowStageNodeAcceptanceInProgress
	case BusinessFlowStageNodeAcceptanceInProgress:
		return BusinessFlowStageNodeAcceptanceInProgress
	case BusinessFlowStageCompleted:
		return BusinessFlowStageCompleted
	case BusinessFlowStageCasePendingGeneration:
		return BusinessFlowStageCasePendingGeneration
	case BusinessFlowStageArchived:
		return BusinessFlowStageArchived
	case BusinessFlowStageDisputed:
		return BusinessFlowStageDisputed
	case BusinessFlowStageCancelled:
		return BusinessFlowStageCancelled
	case BusinessFlowStageSurveyDepositPending:
		return BusinessFlowStageSurveyDepositPending
	case BusinessFlowStageDesignQuotePending:
		return BusinessFlowStageDesignQuotePending
	case BusinessFlowStageDesignFeePaying:
		return BusinessFlowStageDesignFeePaying
	case BusinessFlowStageDesignDeliveryPending:
		return BusinessFlowStageDesignDeliveryPending
	case BusinessFlowStageDesignAcceptancePending:
		return BusinessFlowStageDesignAcceptancePending
	case BusinessFlowStagePaymentPaused:
		return BusinessFlowStagePaymentPaused
	default:
		return stage
	}
}

type BusinessFlow struct {
	Base
	SourceType               string     `json:"sourceType" gorm:"size:20;index:idx_business_flow_source,priority:1"`
	SourceID                 uint64     `json:"sourceId" gorm:"index:idx_business_flow_source,priority:2"`
	CustomerUserID           uint64     `json:"customerUserId" gorm:"index"`
	DesignerProviderID       uint64     `json:"designerProviderId" gorm:"index"`
	ConfirmedProposalID      uint64     `json:"confirmedProposalId" gorm:"index"`
	SelectedForemanProviderID uint64    `json:"selectedForemanProviderId" gorm:"index"`
	SelectedQuoteTaskID      uint64     `json:"selectedQuoteTaskId" gorm:"index"`
	SelectedQuoteSubmissionID uint64    `json:"selectedQuoteSubmissionId" gorm:"index"`
	ProjectID                uint64     `json:"projectId" gorm:"index"`
	InspirationCaseDraftID   uint64     `json:"inspirationCaseDraftId" gorm:"index"`
	CurrentStage             string     `json:"currentStage" gorm:"size:40;default:'lead_pending';index"`
	StageChangedAt           *time.Time `json:"stageChangedAt"`
	ClosedReason             string     `json:"closedReason" gorm:"size:255"`
}

func (BusinessFlow) TableName() string {
	return "business_flows"
}
