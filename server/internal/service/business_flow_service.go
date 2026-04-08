package service

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"

	"gorm.io/gorm"
)

type BusinessFlowService struct{}

type BusinessFlowSummary struct {
	CurrentStage              string   `json:"currentStage"`
	FlowSummary               string   `json:"flowSummary"`
	AvailableActions          []string `json:"availableActions"`
	SelectedQuoteTaskID       uint64   `json:"selectedQuoteTaskId,omitempty"`
	SelectedForemanProviderID uint64   `json:"selectedForemanProviderId,omitempty"`
	SelectedQuoteSubmissionID uint64   `json:"selectedQuoteSubmissionId,omitempty"`
	InspirationCaseDraftID    uint64   `json:"inspirationCaseDraftId,omitempty"`
}

func (s *BusinessFlowService) EnsureLeadFlow(tx *gorm.DB, sourceType string, sourceID, customerUserID, designerProviderID uint64) (*model.BusinessFlow, error) {
	now := time.Now()
	flow := &model.BusinessFlow{}
	queryDB := repository.DB
	if tx != nil {
		queryDB = tx
	}
	err := queryDB.Where("source_type = ? AND source_id = ?", sourceType, sourceID).First(flow).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		flow = &model.BusinessFlow{
			SourceType:         sourceType,
			SourceID:           sourceID,
			CustomerUserID:     customerUserID,
			DesignerProviderID: designerProviderID,
			CurrentStage:       model.BusinessFlowStageLeadPending,
			StageChangedAt:     &now,
		}
		if err := queryDB.Create(flow).Error; err != nil {
			return nil, fmt.Errorf("create business flow: %w", err)
		}
		return flow, nil
	}
	if err != nil {
		return nil, fmt.Errorf("load business flow: %w", err)
	}
	updates := map[string]interface{}{}
	if flow.CustomerUserID == 0 && customerUserID > 0 {
		updates["customer_user_id"] = customerUserID
	}
	if flow.DesignerProviderID == 0 && designerProviderID > 0 {
		updates["designer_provider_id"] = designerProviderID
	}
	if len(updates) > 0 {
		if err := queryDB.Model(flow).Updates(updates).Error; err != nil {
			return nil, fmt.Errorf("update business flow identities: %w", err)
		}
		if err := queryDB.First(flow, flow.ID).Error; err != nil {
			return nil, fmt.Errorf("reload business flow: %w", err)
		}
	}
	return flow, nil
}

func (s *BusinessFlowService) AdvanceBySource(tx *gorm.DB, sourceType string, sourceID uint64, updates map[string]interface{}) error {
	if sourceType == "" || sourceID == 0 {
		return nil
	}
	queryDB := repository.DB
	if tx != nil {
		queryDB = tx
	}
	updates = withStageChangedAt(updates)
	if err := queryDB.Model(&model.BusinessFlow{}).
		Where("source_type = ? AND source_id = ?", sourceType, sourceID).
		Updates(updates).Error; err != nil {
		return fmt.Errorf("advance business flow by source: %w", err)
	}
	return nil
}

func (s *BusinessFlowService) AdvanceByProject(tx *gorm.DB, projectID uint64, updates map[string]interface{}) error {
	if projectID == 0 {
		return nil
	}
	queryDB := repository.DB
	if tx != nil {
		queryDB = tx
	}
	updates = withStageChangedAt(updates)
	if err := queryDB.Model(&model.BusinessFlow{}).
		Where("project_id = ?", projectID).
		Updates(updates).Error; err != nil {
		return fmt.Errorf("advance business flow by project: %w", err)
	}
	return nil
}

func (s *BusinessFlowService) BindProject(tx *gorm.DB, sourceType string, sourceID, projectID uint64) error {
	if sourceType == "" || sourceID == 0 || projectID == 0 {
		return nil
	}
	queryDB := repository.DB
	if tx != nil {
		queryDB = tx
	}
	if err := queryDB.Model(&model.BusinessFlow{}).
		Where("source_type = ? AND source_id = ?", sourceType, sourceID).
		Updates(map[string]interface{}{
			"project_id":       projectID,
			"stage_changed_at": time.Now(),
		}).Error; err != nil {
		return fmt.Errorf("bind project to business flow: %w", err)
	}
	return nil
}

func (s *BusinessFlowService) GetByProjectID(projectID uint64) (*model.BusinessFlow, error) {
	return s.GetByProjectIDTx(repository.DB, projectID)
}

func (s *BusinessFlowService) GetByProjectIDTx(queryDB *gorm.DB, projectID uint64) (*model.BusinessFlow, error) {
	if projectID == 0 {
		return nil, nil
	}
	if queryDB == nil {
		queryDB = repository.DB
	}
	var flow model.BusinessFlow
	if err := queryDB.Where("project_id = ?", projectID).First(&flow).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, fmt.Errorf("get business flow by project: %w", err)
	}
	return &flow, nil
}

func (s *BusinessFlowService) GetBySource(sourceType string, sourceID uint64) (*model.BusinessFlow, error) {
	if sourceType == "" || sourceID == 0 {
		return nil, nil
	}
	var flow model.BusinessFlow
	if err := repository.DB.Where("source_type = ? AND source_id = ?", sourceType, sourceID).First(&flow).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, fmt.Errorf("get business flow by source: %w", err)
	}
	return &flow, nil
}

func (s *BusinessFlowService) ResolveSourceFromProposal(tx *gorm.DB, proposalID uint64) (string, uint64, error) {
	if proposalID == 0 {
		return "", 0, nil
	}
	queryDB := repository.DB
	if tx != nil {
		queryDB = tx
	}
	var proposal model.Proposal
	if err := queryDB.First(&proposal, proposalID).Error; err != nil {
		return "", 0, fmt.Errorf("load proposal for business flow source: %w", err)
	}
	if proposal.SourceType == model.ProposalSourceDemand {
		return model.BusinessFlowSourceDemand, proposal.DemandID, nil
	}
	return model.BusinessFlowSourceBooking, proposal.BookingID, nil
}

func (s *BusinessFlowService) BuildSummary(flow *model.BusinessFlow) BusinessFlowSummary {
	if flow == nil {
		return BusinessFlowSummary{
			CurrentStage:     model.BusinessFlowStageLeadPending,
			FlowSummary:      "业务主链待初始化",
			AvailableActions: []string{},
		}
	}

	stage := model.NormalizeBusinessFlowStage(flow.CurrentStage)
	flowSummary := map[string]string{
		model.BusinessFlowStageLeadPending:               "线索已进入平台，待继续推进沟通",
		model.BusinessFlowStageSurveyDepositPending:      "量房费已支付，待安排量房与前期沟通",
		model.BusinessFlowStageNegotiating:               "沟通进行中，待形成正式方案",
		model.BusinessFlowStageDesignPendingSubmission:   "待设计师提交方案",
		model.BusinessFlowStageDesignPendingConfirmation: "设计方案已提交，待用户确认",
		model.BusinessFlowStageDesignQuotePending:        "待商家提交设计报价",
		model.BusinessFlowStageDesignFeePaying:           "设计费待支付",
		model.BusinessFlowStageDesignDeliveryPending:     "待交付设计成果",
		model.BusinessFlowStageDesignAcceptancePending:   "设计成果待验收",
		model.BusinessFlowStageConstructionPartyPending:  "待确认施工方并锁定施工负责人",
		model.BusinessFlowStageConstructionQuotePending:  "施工报价待用户确认",
		model.BusinessFlowStageReadyToStart:              "施工条件已确认，项目待开工",
		model.BusinessFlowStageInConstruction:            "项目施工中，按节点推进与验收",
		model.BusinessFlowStageNodeAcceptanceInProgress:  "节点已提交，待用户验收",
		model.BusinessFlowStageCompleted:                 "施工方已提交完工材料，待业主整体验收",
		model.BusinessFlowStageCasePendingGeneration:     "项目已完工，待沉淀案例草稿",
		model.BusinessFlowStageArchived:                  "项目已归档，案例资产已沉淀",
		model.BusinessFlowStageDisputed:                  "项目存在争议，需先处理争议",
		model.BusinessFlowStageCancelled:                 "业务流已取消",
	}

	if stage == model.BusinessFlowStageConstructionPartyPending {
		switch {
		case flow.SelectedQuoteTaskID > 0:
			flowSummary[stage] = "施工报价任务已创建，待施工方提交正式报价"
		case flow.SelectedForemanProviderID > 0:
			flowSummary[stage] = "施工负责人已锁定，待确认施工报价"
		}
	}
	if stage == model.BusinessFlowStageCasePendingGeneration && flow.InspirationCaseDraftID > 0 {
		flowSummary[stage] = "案例草稿已生成，待平台审核后归档"
	}

	availableActions := []string{}
	switch stage {
	case model.BusinessFlowStageLeadPending:
		availableActions = []string{}
	case model.BusinessFlowStageSurveyDepositPending:
		availableActions = []string{}
	case model.BusinessFlowStageNegotiating, model.BusinessFlowStageDesignPendingSubmission:
		availableActions = []string{"create_proposal"}
	case model.BusinessFlowStageDesignQuotePending, model.BusinessFlowStageDesignFeePaying, model.BusinessFlowStageDesignDeliveryPending, model.BusinessFlowStageDesignAcceptancePending:
		availableActions = []string{}
	case model.BusinessFlowStageDesignPendingConfirmation:
		availableActions = []string{"confirm_proposal", "reject_proposal"}
	case model.BusinessFlowStageConstructionPartyPending:
		availableActions = []string{"create_quote_task", "select_constructor"}
		if flow.SelectedQuoteTaskID > 0 || flow.SelectedForemanProviderID > 0 {
			availableActions = []string{"submit_construction_quote"}
		}
	case model.BusinessFlowStageConstructionQuotePending:
		availableActions = []string{"confirm_construction_quote", "reject_construction_quote"}
	case model.BusinessFlowStageReadyToStart:
		availableActions = []string{"start_project"}
	case model.BusinessFlowStageInConstruction:
		availableActions = []string{"submit_milestone"}
	case model.BusinessFlowStageNodeAcceptanceInProgress:
		availableActions = []string{"approve_milestone", "reject_milestone"}
	case model.BusinessFlowStageCompleted:
		availableActions = []string{"approve_completion", "reject_completion"}
	case model.BusinessFlowStageCasePendingGeneration:
		if flow.InspirationCaseDraftID == 0 {
			availableActions = []string{"generate_inspiration_draft"}
		}
	}

	summary := map[string]string{
		model.BusinessFlowStageLeadPending:               flowSummary[model.BusinessFlowStageLeadPending],
		model.BusinessFlowStageSurveyDepositPending:      flowSummary[model.BusinessFlowStageSurveyDepositPending],
		model.BusinessFlowStageNegotiating:               flowSummary[model.BusinessFlowStageNegotiating],
		model.BusinessFlowStageDesignPendingSubmission:   flowSummary[model.BusinessFlowStageDesignPendingSubmission],
		model.BusinessFlowStageDesignPendingConfirmation: flowSummary[model.BusinessFlowStageDesignPendingConfirmation],
		model.BusinessFlowStageDesignQuotePending:        flowSummary[model.BusinessFlowStageDesignQuotePending],
		model.BusinessFlowStageDesignFeePaying:           flowSummary[model.BusinessFlowStageDesignFeePaying],
		model.BusinessFlowStageDesignDeliveryPending:     flowSummary[model.BusinessFlowStageDesignDeliveryPending],
		model.BusinessFlowStageDesignAcceptancePending:   flowSummary[model.BusinessFlowStageDesignAcceptancePending],
		model.BusinessFlowStageConstructionPartyPending:  flowSummary[model.BusinessFlowStageConstructionPartyPending],
		model.BusinessFlowStageConstructionQuotePending:  flowSummary[model.BusinessFlowStageConstructionQuotePending],
		model.BusinessFlowStageReadyToStart:              flowSummary[model.BusinessFlowStageReadyToStart],
		model.BusinessFlowStageInConstruction:            flowSummary[model.BusinessFlowStageInConstruction],
		model.BusinessFlowStageNodeAcceptanceInProgress:  flowSummary[model.BusinessFlowStageNodeAcceptanceInProgress],
		model.BusinessFlowStageCompleted:                 flowSummary[model.BusinessFlowStageCompleted],
		model.BusinessFlowStageCasePendingGeneration:     flowSummary[model.BusinessFlowStageCasePendingGeneration],
		model.BusinessFlowStageArchived:                  flowSummary[model.BusinessFlowStageArchived],
		model.BusinessFlowStageDisputed:                  flowSummary[model.BusinessFlowStageDisputed],
		model.BusinessFlowStageCancelled:                 flowSummary[model.BusinessFlowStageCancelled],
	}

	return BusinessFlowSummary{
		CurrentStage:              stage,
		FlowSummary:               summary[stage],
		AvailableActions:          availableActions,
		SelectedQuoteTaskID:       flow.SelectedQuoteTaskID,
		SelectedForemanProviderID: flow.SelectedForemanProviderID,
		SelectedQuoteSubmissionID: flow.SelectedQuoteSubmissionID,
		InspirationCaseDraftID:    flow.InspirationCaseDraftID,
	}
}

func (s *BusinessFlowService) BuildProjectFallbackSummary(project *model.Project, milestones []model.Milestone) BusinessFlowSummary {
	if project == nil {
		return BusinessFlowSummary{
			CurrentStage:     model.BusinessFlowStageLeadPending,
			FlowSummary:      "业务主链待初始化",
			AvailableActions: []string{},
		}
	}

	hasSubmitted := false
	hasInProgress := false
	allAccepted := len(milestones) > 0
	for _, milestone := range milestones {
		if milestone.Status == model.MilestoneStatusSubmitted {
			hasSubmitted = true
		}
		if milestone.Status == model.MilestoneStatusInProgress {
			hasInProgress = true
		}
		if milestone.Status != model.MilestoneStatusAccepted && milestone.Status != model.MilestoneStatusPaid {
			allAccepted = false
		}
	}

	currentPhase := strings.TrimSpace(project.CurrentPhase)
	stage := model.BusinessFlowStageLeadPending
	switch {
	case project.InspirationCaseDraftID > 0:
		stage = model.BusinessFlowStageArchived
	case project.BusinessStatus == model.ProjectBusinessStatusCancelled || project.Status == model.ProjectStatusClosed:
		stage = model.BusinessFlowStageCancelled
	case project.DisputedAt != nil:
		stage = model.BusinessFlowStageDisputed
	case project.BusinessStatus == model.ProjectBusinessStatusCompleted || project.Status == model.ProjectStatusCompleted || currentPhase == "已完工":
		stage = model.BusinessFlowStageCompleted
	case hasSubmitted || strings.Contains(currentPhase, "待验收"):
		stage = model.BusinessFlowStageNodeAcceptanceInProgress
	case project.BusinessStatus == model.ProjectBusinessStatusInProgress || hasInProgress || strings.Contains(currentPhase, "施工中") || strings.Contains(currentPhase, "待整改") || strings.Contains(currentPhase, "工程"):
		stage = model.BusinessFlowStageInConstruction
	case project.BusinessStatus == model.ProjectBusinessStatusConstructionQuoteConfirmed || strings.Contains(currentPhase, "待开工"):
		stage = model.BusinessFlowStageReadyToStart
	case project.BusinessStatus == model.ProjectBusinessStatusConstructionConfirmed || project.BusinessStatus == model.ProjectBusinessStatusProposalConfirmed:
		stage = model.BusinessFlowStageConstructionPartyPending
	}

	summary := s.BuildSummary(&model.BusinessFlow{
		CurrentStage:              stage,
		SelectedForemanProviderID: coalesceUint64(project.ForemanID, project.ConstructionProviderID),
		SelectedQuoteSubmissionID: project.SelectedQuoteSubmissionID,
		InspirationCaseDraftID:    project.InspirationCaseDraftID,
	})
	if stage == model.BusinessFlowStageInConstruction && allAccepted && project.CompletionSubmittedAt == nil {
		summary.FlowSummary = "全部节点已验收，待施工方提交完工材料"
		summary.AvailableActions = []string{"submit_completion"}
	}
	if stage == model.BusinessFlowStageInConstruction && project.CompletionRejectedAt != nil {
		summary.FlowSummary = "业主已驳回完工，请整改后重新提交完工材料"
		summary.AvailableActions = []string{"submit_completion"}
	}
	return summary
}

func (s *BusinessFlowService) BuildQuoteFallbackSummary(quoteList *model.QuoteList) BusinessFlowSummary {
	if quoteList == nil {
		return BusinessFlowSummary{
			CurrentStage:     model.BusinessFlowStageLeadPending,
			FlowSummary:      "业务主链待初始化",
			AvailableActions: []string{},
		}
	}

	stage := model.BusinessFlowStageLeadPending
	switch quoteList.Status {
	case model.QuoteListStatusSubmittedToUser, model.QuoteListStatusRejected:
		stage = model.BusinessFlowStageConstructionQuotePending
	case model.QuoteListStatusUserConfirmed, model.QuoteListStatusAwarded, model.QuoteListStatusLocked, model.QuoteListStatusClosed:
		stage = model.BusinessFlowStageReadyToStart
	case model.QuoteListStatusDraft, model.QuoteListStatusReadyForSelection, model.QuoteListStatusPricingInProgress:
		stage = model.BusinessFlowStageConstructionPartyPending
	}

	return s.BuildSummary(&model.BusinessFlow{
		CurrentStage:              stage,
		SelectedQuoteTaskID:       quoteList.ID,
		SelectedForemanProviderID: quoteList.AwardedProviderID,
		SelectedQuoteSubmissionID: quoteList.ActiveSubmissionID,
	})
}

func coalesceUint64(values ...uint64) uint64 {
	for _, value := range values {
		if value > 0 {
			return value
		}
	}
	return 0
}

func withStageChangedAt(updates map[string]interface{}) map[string]interface{} {
	next := map[string]interface{}{}
	for key, value := range updates {
		next[key] = value
	}
	if _, ok := next["stage_changed_at"]; !ok {
		next["stage_changed_at"] = time.Now()
	}
	return next
}
