package service

import (
	"fmt"
	"sort"
	"strings"
	"time"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
)

type MerchantFlowPrimaryAction struct {
	Kind      string `json:"kind"`
	Label     string `json:"label,omitempty"`
	ModalType string `json:"modalType,omitempty"`
	Path      string `json:"path,omitempty"`
}

type MerchantFlowStep struct {
	Key           string                     `json:"key"`
	Title         string                     `json:"title"`
	Status        string                     `json:"status"`
	MerchantTodo  string                     `json:"merchantTodo"`
	UserState     string                     `json:"userState"`
	Summary       string                     `json:"summary"`
	BlockedReason string                     `json:"blockedReason,omitempty"`
	PrimaryAction *MerchantFlowPrimaryAction `json:"primaryAction,omitempty"`
}

type MerchantFlowConstructionHandoff struct {
	QuoteListID                uint64                   `json:"quoteListId,omitempty"`
	QuoteListStatus            string                   `json:"quoteListStatus,omitempty"`
	InvitedForemanCount        int64                    `json:"invitedForemanCount,omitempty"`
	AwardedProviderID          uint64                   `json:"awardedProviderId,omitempty"`
	ProjectID                  uint64                   `json:"projectId,omitempty"`
	Summary                    string                   `json:"summary,omitempty"`
	BaselineStatus             string                   `json:"baselineStatus,omitempty"`
	BaselineSubmittedAt        *time.Time               `json:"baselineSubmittedAt,omitempty"`
	ConstructionSubjectType    string                   `json:"constructionSubjectType,omitempty"`
	ConstructionSubjectID      uint64                   `json:"constructionSubjectId,omitempty"`
	ConstructionSubjectDisplay string                   `json:"constructionSubjectDisplayName,omitempty"`
	KickoffStatus              string                   `json:"kickoffStatus,omitempty"`
	PlannedStartDate           *time.Time               `json:"plannedStartDate,omitempty"`
	SupervisorSummary          *BridgeSupervisorSummary `json:"supervisorSummary,omitempty"`
	BridgeConversionSummary    *BridgeConversionSummary `json:"bridgeConversionSummary,omitempty"`
}

type MerchantFlowConstructionPreparation struct {
	QuoteListID          uint64                        `json:"quoteListId,omitempty"`
	PrerequisiteStatus   string                        `json:"prerequisiteStatus,omitempty"`
	PrerequisiteSnapshot QuoteTaskPrerequisiteSnapshot `json:"prerequisiteSnapshot"`
	QuantityBase         *model.QuantityBase           `json:"quantityBase,omitempty"`
	QuantityItems        []model.QuantityBaseItem      `json:"quantityItems,omitempty"`
	MissingFields        []string                      `json:"missingFields,omitempty"`
	TemplateID           uint64                        `json:"templateId,omitempty"`
	TemplateError        string                        `json:"templateError,omitempty"`
	TemplateSections     []MerchantTemplateSection     `json:"templateSections,omitempty"`
	SelectedForemanID    uint64                        `json:"selectedForemanId,omitempty"`
	RecommendedForemen   []RecommendedForeman          `json:"recommendedForemen,omitempty"`
}

type MerchantFlowEvent struct {
	Date  string `json:"date"`
	Label string `json:"label"`
	Type  string `json:"type"`
}

type MerchantDesignerFlowWorkspace struct {
	Booking                 BookingLifecycleView                 `json:"booking"`
	CurrentStage            string                               `json:"currentStage"`
	CurrentStepKey          string                               `json:"currentStepKey"`
	FlowSummary             string                               `json:"flowSummary"`
	Steps                   []MerchantFlowStep                   `json:"steps"`
	SiteSurveySummary       *SiteSurveyDetail                    `json:"siteSurveySummary,omitempty"`
	BudgetConfirmSummary    *BudgetConfirmationDetail            `json:"budgetConfirmSummary,omitempty"`
	DesignFeeQuote          *model.DesignFeeQuote                `json:"designFeeQuote,omitempty"`
	DesignDeliverable       *model.DesignDeliverable             `json:"designDeliverable,omitempty"`
	Proposal                *model.Proposal                      `json:"proposal,omitempty"`
	ConstructionPreparation *MerchantFlowConstructionPreparation `json:"constructionPreparation,omitempty"`
	ConstructionHandoff     *MerchantFlowConstructionHandoff     `json:"constructionHandoff,omitempty"`
	Events                  []MerchantFlowEvent                  `json:"events,omitempty"`
}

func (s *BookingService) GetMerchantDesignerFlowWorkspace(providerID, bookingID uint64) (*MerchantDesignerFlowWorkspace, error) {
	booking, err := s.getBookingForProvider(providerID, bookingID)
	if err != nil {
		return nil, err
	}

	var latestProposal model.Proposal
	latestProposalFound := repository.DB.Where("booking_id = ?", booking.ID).Order("version DESC, id DESC").First(&latestProposal).Error == nil

	var confirmedProposal model.Proposal
	confirmedProposalFound := repository.DB.
		Where("booking_id = ? AND designer_id = ? AND status = ?", booking.ID, providerID, model.ProposalStatusConfirmed).
		Order("confirmed_at DESC, id DESC").
		First(&confirmedProposal).Error == nil

	p0Summary, _ := s.GetBookingP0Summary(booking.ID)
	flow, _ := businessFlowSvc.GetBySource(model.BusinessFlowSourceBooking, booking.ID)
	flowSummary := businessFlowSvc.BuildSummary(flow)

	var quote *model.DesignFeeQuote
	if q, err := (&DesignPaymentService{}).GetDesignFeeQuote(booking.ID); err == nil {
		quote = q
	}

	var quoteOrder *model.Order
	if quote != nil && quote.OrderID > 0 {
		var order model.Order
		if err := repository.DB.First(&order, quote.OrderID).Error; err == nil {
			quoteOrder = &order
		}
	}

	var deliverable *model.DesignDeliverable
	var rawDeliverable model.DesignDeliverable
	if err := repository.DB.Where("booking_id = ? AND provider_id = ?", booking.ID, providerID).Order("created_at DESC, id DESC").First(&rawDeliverable).Error; err == nil {
		hydrateDesignDeliverable(&rawDeliverable)
		deliverable = &rawDeliverable
	}
	proposalID := uint64(0)
	if latestProposalFound {
		proposalID = latestProposal.ID
	}
	confirmedProposalID := uint64(0)
	if confirmedProposalFound {
		confirmedProposalID = confirmedProposal.ID
	}
	bookingView := buildBookingLifecycleView(booking, p0Summary, proposalID, deliverable)

	handoff := resolveConstructionHandoff(flow, confirmedProposalID)
	preparation := resolveConstructionPreparation(providerID, flow, confirmedProposalID)
	steps := buildDesignerFlowSteps(booking, p0Summary, quote, quoteOrder, deliverable, valueOrNilProposal(latestProposalFound, &latestProposal), confirmedProposalFound, preparation, handoff)
	currentStepKey := resolveCurrentDesignerStepKey(steps)
	events := buildDesignerFlowEvents(booking, p0Summary, quote, quoteOrder, deliverable, valueOrNilProposal(latestProposalFound, &latestProposal), confirmedProposalFound, preparation, handoff)

	workspace := &MerchantDesignerFlowWorkspace{
		Booking:                 bookingView,
		CurrentStage:            flowSummary.CurrentStage,
		CurrentStepKey:          currentStepKey,
		FlowSummary:             firstNonBlank(bookingView.FlowSummary, flowSummary.FlowSummary),
		Steps:                   steps,
		SiteSurveySummary:       valueOrEmptySiteSurvey(p0Summary),
		BudgetConfirmSummary:    valueOrEmptyBudgetConfirm(p0Summary),
		DesignFeeQuote:          quote,
		DesignDeliverable:       deliverable,
		ConstructionPreparation: preparation,
		ConstructionHandoff:     handoff,
		Events:                  events,
	}
	if latestProposalFound {
		workspace.Proposal = &latestProposal
	}
	return workspace, nil
}

func valueOrNilProposal(found bool, proposal *model.Proposal) *model.Proposal {
	if !found || proposal == nil {
		return nil
	}
	return proposal
}

func resolveConstructionPreparation(providerID uint64, flow *model.BusinessFlow, proposalID uint64) *MerchantFlowConstructionPreparation {
	var quoteList model.QuoteList
	query := repository.DB.Order("updated_at DESC, id DESC")
	if flow != nil && flow.SelectedQuoteTaskID > 0 {
		query = query.Where("id = ?", flow.SelectedQuoteTaskID)
	} else if proposalID > 0 {
		query = query.Where("proposal_id = ? AND designer_provider_id = ?", proposalID, providerID)
	} else {
		return nil
	}
	if err := query.First(&quoteList).Error; err != nil {
		return nil
	}
	detail, err := (&QuoteService{}).buildMerchantQuotePreparation(&quoteList)
	if err != nil {
		return nil
	}
	return &MerchantFlowConstructionPreparation{
		QuoteListID:          detail.QuoteListID,
		PrerequisiteStatus:   detail.PrerequisiteStatus,
		PrerequisiteSnapshot: detail.PrerequisiteSnapshot,
		QuantityBase:         detail.QuantityBase,
		QuantityItems:        detail.QuantityItems,
		MissingFields:        detail.MissingFields,
		TemplateID:           detail.TemplateID,
		TemplateError:        detail.TemplateError,
		TemplateSections:     detail.TemplateSections,
		SelectedForemanID:    detail.SelectedForemanID,
		RecommendedForemen:   detail.RecommendedForemen,
	}
}

func resolveConstructionHandoff(flow *model.BusinessFlow, proposalID uint64) *MerchantFlowConstructionHandoff {
	var quoteList model.QuoteList
	query := repository.DB.Order("updated_at DESC, id DESC")
	if proposalID > 0 {
		query = query.Where("proposal_id = ?", proposalID)
	} else if flow != nil && flow.SelectedQuoteTaskID > 0 {
		query = query.Where("id = ?", flow.SelectedQuoteTaskID)
	}
	if err := query.First(&quoteList).Error; err != nil {
		if flow == nil {
			return nil
		}
		if normalized := model.NormalizeBusinessFlowStage(flow.CurrentStage); normalized != model.BusinessFlowStageConstructionPartyPending &&
			normalized != model.BusinessFlowStageConstructionQuotePending &&
			normalized != model.BusinessFlowStageReadyToStart &&
			normalized != model.BusinessFlowStageInConstruction {
			return nil
		}
		bridgeSummary := BridgeReadModel{}
		var conversionSummary *BridgeConversionSummary
		if flow.ProjectID > 0 {
			var project model.Project
			if projectErr := repository.DB.First(&project, flow.ProjectID).Error; projectErr == nil {
				bridgeSummary = BuildBridgeReadModelByProject(&project)
				conversionSummary = BuildBridgeConversionSummaryByProject(&project)
			}
		}
		return &MerchantFlowConstructionHandoff{
			Summary:                    resolveConstructionStageSummary(flow, nil, 0),
			ProjectID:                  flow.ProjectID,
			BaselineStatus:             bridgeSummary.BaselineStatus,
			BaselineSubmittedAt:        bridgeSummary.BaselineSubmittedAt,
			ConstructionSubjectType:    bridgeSummary.ConstructionSubjectType,
			ConstructionSubjectID:      bridgeSummary.ConstructionSubjectID,
			ConstructionSubjectDisplay: bridgeSummary.ConstructionSubjectDisplayName,
			KickoffStatus:              bridgeSummary.KickoffStatus,
			PlannedStartDate:           bridgeSummary.PlannedStartDate,
			SupervisorSummary:          bridgeSummary.SupervisorSummary,
			BridgeConversionSummary:    conversionSummary,
		}
	}

	var invitationCount int64
	_ = repository.DB.Model(&model.QuoteInvitation{}).Where("quote_list_id = ?", quoteList.ID).Count(&invitationCount).Error

	projectID := quoteList.ProjectID
	if projectID == 0 && flow != nil {
		projectID = flow.ProjectID
	}
	bridgeSummary := BuildBridgeReadModelByQuoteList(&quoteList)
	conversionSummary := BuildBridgeConversionSummaryByQuoteList(&quoteList)

	return &MerchantFlowConstructionHandoff{
		QuoteListID:                quoteList.ID,
		QuoteListStatus:            quoteList.Status,
		InvitedForemanCount:        invitationCount,
		AwardedProviderID:          quoteList.AwardedProviderID,
		ProjectID:                  projectID,
		Summary:                    resolveConstructionStageSummary(flow, &quoteList, invitationCount),
		BaselineStatus:             bridgeSummary.BaselineStatus,
		BaselineSubmittedAt:        bridgeSummary.BaselineSubmittedAt,
		ConstructionSubjectType:    bridgeSummary.ConstructionSubjectType,
		ConstructionSubjectID:      bridgeSummary.ConstructionSubjectID,
		ConstructionSubjectDisplay: bridgeSummary.ConstructionSubjectDisplayName,
		KickoffStatus:              bridgeSummary.KickoffStatus,
		PlannedStartDate:           bridgeSummary.PlannedStartDate,
		SupervisorSummary:          bridgeSummary.SupervisorSummary,
		BridgeConversionSummary:    conversionSummary,
	}
}

func resolveConstructionStageSummary(flow *model.BusinessFlow, quoteList *model.QuoteList, invitationCount int64) string {
	stage := ""
	if flow != nil {
		stage = model.NormalizeBusinessFlowStage(flow.CurrentStage)
	}
	if quoteList != nil {
		switch quoteList.Status {
		case model.QuoteListStatusPricingInProgress:
			return "已选择施工主体，施工报价进行中。"
		case model.QuoteListStatusSubmittedToUser:
			return "施工报价已提交，待用户确认。"
		case model.QuoteListStatusUserConfirmed, model.QuoteListStatusAwarded:
			return "施工报价已确认，项目待监理协调开工。"
		case model.QuoteListStatusReadyForSelection:
			return "报价基线已整理完成，待选择施工主体。"
		}
	}
	switch stage {
	case model.BusinessFlowStageReadyToStart, model.BusinessFlowStageInConstruction, model.BusinessFlowStageCompleted, model.BusinessFlowStageCasePendingGeneration, model.BusinessFlowStageArchived:
		return "施工移交已完成，项目待监理协调开工或已进入执行阶段。"
	case model.BusinessFlowStageConstructionQuotePending:
		return "施工报价已形成，待用户最终确认后进入待监理协调开工。"
	case model.BusinessFlowStageConstructionPartyPending:
		if quoteList != nil && invitationCount > 0 {
			return "已选择施工主体，施工报价进行中。"
		}
		return "设计师正在整理报价基线与施工桥接资料。"
	default:
		if quoteList != nil && invitationCount > 0 {
			return "已选择施工主体，施工报价进行中。"
		}
		return "待用户确认正式方案后，才进入施工桥接。"
	}
}

func buildDesignerFlowSteps(
	booking *model.Booking,
	p0Summary *BookingP0Summary,
	quote *model.DesignFeeQuote,
	quoteOrder *model.Order,
	deliverable *model.DesignDeliverable,
	proposal *model.Proposal,
	proposalConfirmed bool,
	preparation *MerchantFlowConstructionPreparation,
	handoff *MerchantFlowConstructionHandoff,
) []MerchantFlowStep {
	siteSurvey := valueOrEmptySiteSurvey(p0Summary)
	budgetConfirm := valueOrEmptyBudgetConfirm(p0Summary)

	steps := []MerchantFlowStep{
		resolveDesignerBookingStep(booking),
		resolveDesignerSurveyStep(booking, siteSurvey),
		resolveDesignerBudgetStep(siteSurvey, budgetConfirm),
		resolveDesignerQuoteStep(budgetConfirm, quote, quoteOrder),
		resolveDesignerDeliverableStep(quote, quoteOrder, deliverable),
		resolveDesignerUserConfirmStep(deliverable, proposal, proposalConfirmed),
		resolveDesignerConstructionPrepStep(booking, proposalConfirmed, preparation),
		resolveDesignerConstructionStep(proposalConfirmed, preparation, handoff),
	}
	return steps
}

func resolveDesignerBookingStep(booking *model.Booking) MerchantFlowStep {
	step := MerchantFlowStep{
		Key:          "booking",
		Title:        "接单确认",
		UserState:    "用户已提交预约，等待商家确认是否承接。",
		MerchantTodo: "先确认是否接单，确认后再进入后续设计流程。",
	}
	if booking == nil {
		step.Status = "not_started"
		step.BlockedReason = "预约数据不存在"
		return step
	}
	if booking.Status == 1 {
		step.Status = "pending_submit"
		step.Summary = "当前预约仍待商家确认。"
		return step
	}
	if booking.Status == 4 {
		step.Status = "returned"
		step.Summary = "预约已关闭。"
		return step
	}
	step.Status = "completed"
	step.Summary = "商家已确认接单。"
	return step
}

func resolveDesignerSurveyStep(booking *model.Booking, siteSurvey *SiteSurveyDetail) MerchantFlowStep {
	step := MerchantFlowStep{
		Key:          "survey",
		Title:        "量房资料",
		UserState:    "设计师上传量房资料后，流程直接进入沟通确认。",
		MerchantTodo: "上传量房图片或文件，并补充必要备注。",
		PrimaryAction: &MerchantFlowPrimaryAction{
			Kind:      "modal",
			Label:     "去提交",
			ModalType: "survey_upload",
		},
	}
	if booking == nil || booking.Status == 1 {
		step.Status = "not_started"
		step.BlockedReason = "需先完成接单确认"
		return step
	}
	if !booking.SurveyDepositPaid {
		step.Status = "not_started"
		step.BlockedReason = "需等待用户先支付量房费"
		return step
	}
	if siteSurvey == nil {
		step.Status = "pending_submit"
		step.Summary = "量房费已支付，待上传量房资料。"
		return step
	}
	switch siteSurvey.Status {
	case model.SiteSurveyStatusRevisionRequested:
		step.Status = "returned"
		step.Summary = firstNonBlank(strings.TrimSpace(siteSurvey.RevisionRequestReason), "量房资料已被退回，待重新提交。")
	case model.SiteSurveyStatusSubmitted, model.SiteSurveyStatusConfirmed:
		step.Status = "completed"
		step.Summary = "量房资料已上传。"
	default:
		step.Status = "pending_submit"
	}
	return step
}

func resolveDesignerBudgetStep(siteSurvey *SiteSurveyDetail, budget *BudgetConfirmationDetail) MerchantFlowStep {
	step := MerchantFlowStep{
		Key:          "budget",
		Title:        "沟通确认",
		UserState:    "用户会在这里确认预算范围和设计意向。",
		MerchantTodo: "根据沟通结果整理预算区间、包含项和设计意向。",
		PrimaryAction: &MerchantFlowPrimaryAction{
			Kind:      "modal",
			Label:     "去提交",
			ModalType: "budget_confirm",
		},
	}
	if siteSurvey == nil || siteSurvey.Status == model.SiteSurveyStatusRevisionRequested {
		step.Status = "not_started"
		step.BlockedReason = "需先完成量房资料上传"
		return step
	}
	if budget == nil {
		step.Status = "pending_submit"
		step.Summary = "量房资料已上传，待提交沟通确认结果。"
		return step
	}
	switch budget.Status {
	case model.BudgetConfirmationStatusRejected:
		step.Status = "returned"
		step.Summary = firstNonBlank(
			strings.TrimSpace(budget.RejectionReason),
			"沟通确认结果已被退回。",
		)
		if budget.RejectLimit > 0 {
			step.Summary = fmt.Sprintf("%s（已驳回 %d/%d）", step.Summary, budget.RejectCount, budget.RejectLimit)
		}
	case model.BudgetConfirmationStatusSubmitted:
		step.Status = "pending_user"
		step.Summary = "沟通确认结果已提交，等待用户确认。"
	case model.BudgetConfirmationStatusAccepted:
		step.Status = "completed"
		step.Summary = "沟通确认已完成。"
	default:
		step.Status = "pending_submit"
	}
	return step
}

func resolveDesignerQuoteStep(budget *BudgetConfirmationDetail, quote *model.DesignFeeQuote, order *model.Order) MerchantFlowStep {
	step := MerchantFlowStep{
		Key:          "quote",
		Title:        "设计费报价",
		UserState:    "用户需确认并支付设计费后，才能进入设计交付。",
		MerchantTodo: "整理设计费报价并发给用户确认。",
		PrimaryAction: &MerchantFlowPrimaryAction{
			Kind:      "modal",
			Label:     "去报价",
			ModalType: "design_fee_quote",
		},
	}
	if budget == nil || budget.Status != model.BudgetConfirmationStatusAccepted {
		step.Status = "not_started"
		step.BlockedReason = "需先完成沟通确认并由用户接受"
		return step
	}
	if quote == nil {
		step.Status = "pending_submit"
		step.Summary = "沟通确认完成，待发送设计费报价。"
		return step
	}
	switch quote.Status {
	case model.DesignFeeQuoteStatusRejected, model.DesignFeeQuoteStatusExpired:
		step.Status = "returned"
		step.Summary = firstNonBlank(strings.TrimSpace(quote.RejectionReason), "设计费报价已被退回，待重新发送。")
	case model.DesignFeeQuoteStatusPending:
		step.Status = "pending_user"
		step.Summary = "设计费报价已发送，等待用户确认。"
	case model.DesignFeeQuoteStatusConfirmed:
		if order != nil && order.Status == model.OrderStatusPaid {
			step.Status = "completed"
			step.Summary = "设计费已支付。"
		} else {
			step.Status = "pending_user"
			step.Summary = "报价已确认，待用户支付设计费。"
		}
	default:
		step.Status = "pending_submit"
	}
	return step
}

func resolveDesignerDeliverableStep(quote *model.DesignFeeQuote, order *model.Order, deliverable *model.DesignDeliverable) MerchantFlowStep {
	step := MerchantFlowStep{
		Key:          "design",
		Title:        "设计交付",
		UserState:    "用户会在收到设计交付后查看并准备确认。",
		MerchantTodo: "上传彩平、效果图、CAD、附件和设计说明。",
		PrimaryAction: &MerchantFlowPrimaryAction{
			Kind:      "modal",
			Label:     "去提交",
			ModalType: "design_deliverable",
		},
	}
	if quote == nil || quote.Status != model.DesignFeeQuoteStatusConfirmed {
		step.Status = "not_started"
		step.BlockedReason = "需先完成设计费报价确认"
		return step
	}
	if order == nil || order.Status != model.OrderStatusPaid {
		step.Status = "not_started"
		step.BlockedReason = "需等待用户支付设计费"
		return step
	}
	if deliverable == nil {
		step.Status = "pending_submit"
		step.Summary = "设计费已支付，待提交设计交付件。"
		return step
	}
	switch deliverable.Status {
	case model.DesignDeliverableStatusRejected:
		step.Status = "returned"
		step.Summary = firstNonBlank(strings.TrimSpace(deliverable.RejectionReason), "设计交付已被退回，待重新提交。")
	case model.DesignDeliverableStatusSubmitted:
		step.Status = "pending_user"
		step.Summary = "设计交付已提交，等待用户查看。"
	case model.DesignDeliverableStatusAccepted:
		step.Status = "completed"
		step.Summary = "设计交付已被用户接受。"
	default:
		step.Status = "pending_submit"
	}
	return step
}

func resolveDesignerUserConfirmStep(deliverable *model.DesignDeliverable, proposal *model.Proposal, proposalConfirmed bool) MerchantFlowStep {
	step := MerchantFlowStep{
		Key:          "confirm",
		Title:        "用户确认",
		UserState:    "用户需要确认最终设计方案，确认后才进入施工报价准备。",
		MerchantTodo: "确认前不要进入施工报价准备；若被退回则回到设计交付继续修改。",
		PrimaryAction: &MerchantFlowPrimaryAction{
			Kind:      "modal",
			Label:     "提交正式方案",
			ModalType: "proposal_confirm",
		},
	}
	if deliverable == nil && proposal == nil {
		step.Status = "not_started"
		step.BlockedReason = "需先提交设计交付"
		return step
	}
	if proposal != nil {
		switch proposal.Status {
		case model.ProposalStatusRejected:
			step.Status = "returned"
			step.Summary = firstNonBlank(strings.TrimSpace(proposal.RejectionReason), "正式方案已被用户退回。")
			return step
		case model.ProposalStatusPending:
			step.Status = "pending_user"
			step.Summary = "正式方案已提交，等待用户最终确认。"
			return step
		case model.ProposalStatusConfirmed:
			step.Status = "completed"
			step.Summary = "用户已确认正式方案。"
			return step
		}
	}
	if deliverable == nil {
		step.Status = "not_started"
		step.BlockedReason = "需先完成设计交付"
		return step
	}
	switch deliverable.Status {
	case model.DesignDeliverableStatusAccepted:
		if proposalConfirmed {
			step.Status = "completed"
			step.Summary = "用户已确认正式方案。"
			return step
		}
		step.Status = "pending_submit"
		step.Summary = "设计交付已确认，待提交正式方案给用户最终确认。"
		return step
	case model.DesignDeliverableStatusSubmitted:
		step.Status = "not_started"
		step.BlockedReason = "需先完成设计交付确认"
		return step
	case model.DesignDeliverableStatusRejected:
		step.Status = "not_started"
		step.BlockedReason = "需先重新提交设计交付"
		return step
	}
	step.Status = "not_started"
	return step
}

func resolveDesignerConstructionPrepStep(booking *model.Booking, proposalConfirmed bool, preparation *MerchantFlowConstructionPreparation) MerchantFlowStep {
	path := ""
	if booking != nil && booking.ID > 0 {
		path = fmt.Sprintf("/proposals/flow/%d/construction-prep", booking.ID)
	}
	step := MerchantFlowStep{
		Key:          "construction_prep",
		Title:        "施工报价准备",
		UserState:    "设计师会先整理施工报价基础，再进入施工主体选择。",
		MerchantTodo: "补齐施工前置参数和施工基线清单。",
		PrimaryAction: &MerchantFlowPrimaryAction{
			Kind:  "link",
			Label: "去整理",
			Path:  path,
		},
	}
	if !proposalConfirmed {
		step.Status = "not_started"
		step.BlockedReason = "需先完成正式方案确认"
		return step
	}
	if preparation == nil || preparation.QuoteListID == 0 {
		step.Status = "pending_submit"
		step.Summary = "待创建施工报价准备并补齐施工基础。"
		return step
	}
	if strings.TrimSpace(preparation.TemplateError) != "" {
		step.Status = "pending_submit"
		step.Summary = preparation.TemplateError
		return step
	}
	if len(preparation.MissingFields) > 0 {
		step.Status = "pending_submit"
		step.Summary = "施工报价基础未补齐，需继续完善。"
		return step
	}
	step.Status = "completed"
	step.Summary = "施工报价基础已整理完成。"
	if step.PrimaryAction != nil {
		step.PrimaryAction.Label = "查看详情"
	}
	return step
}

func resolveDesignerConstructionStep(proposalConfirmed bool, preparation *MerchantFlowConstructionPreparation, handoff *MerchantFlowConstructionHandoff) MerchantFlowStep {
	step := MerchantFlowStep{
		Key:          "construction",
		Title:        "施工主体选择 / 施工移交",
		UserState:    "设计师确认 1 个施工主体后，会进入施工报价推进。",
		MerchantTodo: "选择 1 个施工主体进入施工报价链，并跟进报价状态。",
		PrimaryAction: &MerchantFlowPrimaryAction{
			Kind:      "modal",
			Label:     "选择施工主体",
			ModalType: "construction_handoff",
		},
	}
	if !proposalConfirmed {
		step.Status = "not_started"
		step.BlockedReason = "需先完成正式方案确认"
		return step
	}
	if preparation == nil || preparation.QuoteListID == 0 || len(preparation.MissingFields) > 0 {
		step.Status = "not_started"
		step.BlockedReason = "需先完成施工报价准备"
		return step
	}
	step.Status = "pending_submit"
	step.Summary = "施工报价基础已就绪，待选择施工主体。"
	if handoff != nil {
		step.Summary = firstNonBlank(strings.TrimSpace(handoff.Summary), step.Summary)
		switch handoff.QuoteListStatus {
		case model.QuoteListStatusPricingInProgress:
			step.Status = "pending_other"
			step.PrimaryAction = &MerchantFlowPrimaryAction{Kind: "modal", Label: "查看进度", ModalType: "construction_handoff"}
		case model.QuoteListStatusSubmittedToUser:
			step.Status = "pending_user"
			step.PrimaryAction = &MerchantFlowPrimaryAction{Kind: "modal", Label: "查看进度", ModalType: "construction_handoff"}
		case model.QuoteListStatusRejected:
			step.Status = "returned"
			step.PrimaryAction = &MerchantFlowPrimaryAction{Kind: "modal", Label: "查看施工主体", ModalType: "construction_handoff"}
		}
		if handoff.ProjectID > 0 || handoff.QuoteListStatus == model.QuoteListStatusUserConfirmed || handoff.QuoteListStatus == model.QuoteListStatusAwarded {
			step.Status = "completed"
			step.PrimaryAction = &MerchantFlowPrimaryAction{Kind: "modal", Label: "查看进度", ModalType: "construction_handoff"}
		}
	}
	return step
}

func resolveCurrentDesignerStepKey(steps []MerchantFlowStep) string {
	for _, step := range steps {
		if step.Status == "returned" || step.Status == "pending_submit" || step.Status == "pending_user" || step.Status == "pending_other" {
			return step.Key
		}
	}
	for _, step := range steps {
		if step.Status == "not_started" {
			return step.Key
		}
	}
	if len(steps) == 0 {
		return "booking"
	}
	return steps[len(steps)-1].Key
}

func buildDesignerFlowEvents(
	booking *model.Booking,
	p0Summary *BookingP0Summary,
	quote *model.DesignFeeQuote,
	order *model.Order,
	deliverable *model.DesignDeliverable,
	proposal *model.Proposal,
	proposalConfirmed bool,
	preparation *MerchantFlowConstructionPreparation,
	handoff *MerchantFlowConstructionHandoff,
) []MerchantFlowEvent {
	type rawEvent struct {
		at    time.Time
		label string
		kind  string
	}
	raw := make([]rawEvent, 0, 8)
	if booking != nil && booking.SurveyDepositPaidAt != nil {
		raw = append(raw, rawEvent{at: *booking.SurveyDepositPaidAt, label: "用户已支付量房费", kind: "success"})
	}
	if p0Summary != nil && p0Summary.SiteSurvey != nil && p0Summary.SiteSurvey.SubmittedAt != nil {
		raw = append(raw, rawEvent{at: *p0Summary.SiteSurvey.SubmittedAt, label: "设计师已提交量房资料", kind: "info"})
	}
	if p0Summary != nil && p0Summary.BudgetConfirm != nil && p0Summary.BudgetConfirm.SubmittedAt != nil {
		raw = append(raw, rawEvent{at: *p0Summary.BudgetConfirm.SubmittedAt, label: "设计师已提交沟通确认", kind: "info"})
	}
	if quote != nil && quote.CreatedAt != (time.Time{}) {
		raw = append(raw, rawEvent{at: quote.CreatedAt, label: "设计费报价已创建", kind: "info"})
	}
	if order != nil && order.PaidAt != nil {
		raw = append(raw, rawEvent{at: *order.PaidAt, label: "用户已支付设计费", kind: "success"})
	}
	if deliverable != nil && deliverable.SubmittedAt != nil {
		raw = append(raw, rawEvent{at: *deliverable.SubmittedAt, label: "设计交付件已提交", kind: "info"})
	}
	if deliverable != nil && deliverable.AcceptedAt != nil {
		raw = append(raw, rawEvent{at: *deliverable.AcceptedAt, label: "用户已确认设计方案", kind: "success"})
	}
	if proposal != nil {
		if proposal.SubmittedAt != nil {
			raw = append(raw, rawEvent{at: *proposal.SubmittedAt, label: "正式方案已提交", kind: "info"})
		} else if proposal.CreatedAt != (time.Time{}) {
			raw = append(raw, rawEvent{at: proposal.CreatedAt, label: "正式方案已生成", kind: "info"})
		}
		if proposal.ConfirmedAt != nil {
			raw = append(raw, rawEvent{at: *proposal.ConfirmedAt, label: "用户已确认正式方案", kind: "success"})
		}
	}
	if preparation != nil && preparation.QuoteListID > 0 {
		raw = append(raw, rawEvent{at: time.Now(), label: "施工报价准备已创建", kind: "info"})
	}
	if preparation != nil && preparation.SelectedForemanID > 0 {
		raw = append(raw, rawEvent{at: time.Now(), label: "已确认施工主体进入施工报价", kind: "info"})
	}
	if handoff != nil && handoff.ProjectID > 0 {
		raw = append(raw, rawEvent{at: time.Now(), label: "施工移交已完成，项目待监理协调开工", kind: "success"})
	} else if handoff != nil && handoff.QuoteListID > 0 {
		raw = append(raw, rawEvent{at: time.Now(), label: "施工移交已进入施工报价阶段", kind: "info"})
	} else if proposalConfirmed {
		raw = append(raw, rawEvent{at: time.Now(), label: "已进入施工桥接阶段", kind: "info"})
	}

	sort.Slice(raw, func(i, j int) bool { return raw[i].at.After(raw[j].at) })
	events := make([]MerchantFlowEvent, 0, len(raw))
	for _, item := range raw {
		events = append(events, MerchantFlowEvent{
			Date:  item.at.Format("2006-01-02 15:04"),
			Label: item.label,
			Type:  item.kind,
		})
	}
	return events
}
