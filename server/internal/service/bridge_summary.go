package service

import (
	"strings"
	"time"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
)

type BridgeSupervisorSummary struct {
	PlannedStartDate   *time.Time `json:"plannedStartDate,omitempty"`
	LatestLogAt        *time.Time `json:"latestLogAt,omitempty"`
	LatestLogTitle     string     `json:"latestLogTitle,omitempty"`
	UnhandledRiskCount int64      `json:"unhandledRiskCount"`
}

type BridgeReadModel struct {
	BaselineStatus                 string                   `json:"baselineStatus"`
	BaselineSubmittedAt            *time.Time               `json:"baselineSubmittedAt,omitempty"`
	ConstructionSubjectType        string                   `json:"constructionSubjectType"`
	ConstructionSubjectID          uint64                   `json:"constructionSubjectId,omitempty"`
	ConstructionSubjectDisplayName string                   `json:"constructionSubjectDisplayName,omitempty"`
	KickoffStatus                  string                   `json:"kickoffStatus"`
	PlannedStartDate               *time.Time               `json:"plannedStartDate,omitempty"`
	SupervisorSummary              *BridgeSupervisorSummary `json:"supervisorSummary,omitempty"`
}

type bridgeContext struct {
	flow             *model.BusinessFlow
	quoteList        *model.QuoteList
	quantityBase     *model.QuantityBase
	project          *model.Project
	provider         *model.Provider
	providerUser     *model.User
	latestLogAt      *time.Time
	latestLogTitle   string
	unhandledRiskCnt int64
}

func BuildBridgeReadModelByBookingID(bookingID uint64) BridgeReadModel {
	return buildBridgeReadModel(loadBridgeContext(bookingID, 0, 0, 0))
}

func BuildBridgeReadModelByProposalID(proposalID uint64) BridgeReadModel {
	return buildBridgeReadModel(loadBridgeContext(0, proposalID, 0, 0))
}

func BuildBridgeReadModelByQuoteList(quoteList *model.QuoteList) BridgeReadModel {
	if quoteList == nil {
		return defaultBridgeReadModel()
	}
	return buildBridgeReadModel(loadBridgeContext(0, quoteList.ProposalID, quoteList.ID, quoteList.ProjectID))
}

func BuildBridgeReadModelByProject(project *model.Project) BridgeReadModel {
	if project == nil {
		return defaultBridgeReadModel()
	}
	return buildBridgeReadModel(loadBridgeContext(0, 0, 0, project.ID))
}

func filterProjectStartAction(project *model.Project, actions []string) []string {
	if project == nil || project.EntryStartDate != nil || len(actions) == 0 {
		return actions
	}
	filtered := make([]string, 0, len(actions))
	for _, action := range actions {
		if strings.TrimSpace(action) == "start_project" {
			continue
		}
		filtered = append(filtered, action)
	}
	return filtered
}

func defaultBridgeReadModel() BridgeReadModel {
	return BridgeReadModel{
		BaselineStatus:          "pending_submission",
		ConstructionSubjectType: "",
		KickoffStatus:           "pending_supervisor_schedule",
	}
}

func buildBridgeReadModel(ctx bridgeContext) BridgeReadModel {
	result := defaultBridgeReadModel()
	result.BaselineStatus = resolveBaselineStatus(ctx)
	result.BaselineSubmittedAt = resolveBaselineSubmittedAt(ctx)
	result.ConstructionSubjectType = resolveConstructionSubjectType(ctx.provider)
	if ctx.provider != nil {
		result.ConstructionSubjectID = ctx.provider.ID
		result.ConstructionSubjectDisplayName = ResolveProviderDisplayName(*ctx.provider, ctx.providerUser)
	}
	result.KickoffStatus = resolveKickoffStatus(ctx)
	if ctx.project != nil {
		result.PlannedStartDate = ctx.project.EntryStartDate
		result.SupervisorSummary = &BridgeSupervisorSummary{
			PlannedStartDate:   ctx.project.EntryStartDate,
			LatestLogAt:        ctx.latestLogAt,
			LatestLogTitle:     strings.TrimSpace(ctx.latestLogTitle),
			UnhandledRiskCount: ctx.unhandledRiskCnt,
		}
	}
	return result
}

func resolveBaselineStatus(ctx bridgeContext) string {
	if ctx.quantityBase == nil {
		return "pending_submission"
	}
	if ctx.quoteList == nil {
		return "submitted"
	}
	switch strings.TrimSpace(ctx.quoteList.Status) {
	case model.QuoteListStatusReadyForSelection,
		model.QuoteListStatusPricingInProgress,
		model.QuoteListStatusSubmittedToUser,
		model.QuoteListStatusUserConfirmed,
		model.QuoteListStatusAwarded,
		model.QuoteListStatusRejected,
		model.QuoteListStatusSuperseded,
		model.QuoteListStatusLocked,
		model.QuoteListStatusClosed:
		return "ready_for_selection"
	default:
		if ctx.quoteList.AwardedProviderID > 0 || ctx.quoteList.ActiveSubmissionID > 0 {
			return "ready_for_selection"
		}
		if ctx.flow != nil && ctx.flow.SelectedForemanProviderID > 0 {
			return "ready_for_selection"
		}
		return "submitted"
	}
}

func resolveBaselineSubmittedAt(ctx bridgeContext) *time.Time {
	if ctx.quantityBase != nil {
		if ctx.quantityBase.ActivatedAt != nil {
			return ctx.quantityBase.ActivatedAt
		}
		updatedAt := ctx.quantityBase.UpdatedAt
		if !updatedAt.IsZero() {
			copyTime := updatedAt
			return &copyTime
		}
	}
	if ctx.quoteList != nil {
		updatedAt := ctx.quoteList.UpdatedAt
		if !updatedAt.IsZero() {
			copyTime := updatedAt
			return &copyTime
		}
	}
	return nil
}

func resolveConstructionSubjectType(provider *model.Provider) string {
	if provider == nil {
		return ""
	}
	subType := strings.ToLower(strings.TrimSpace(provider.SubType))
	switch {
	case provider.ProviderType == 2 || subType == "company":
		return "company"
	case provider.ProviderType == 3 || subType == "foreman":
		return "foreman"
	default:
		return ""
	}
}

func resolveKickoffStatus(ctx bridgeContext) string {
	if ctx.project == nil {
		return "pending_supervisor_schedule"
	}
	stage := ""
	if ctx.flow != nil {
		stage = model.NormalizeBusinessFlowStage(ctx.flow.CurrentStage)
	}
	switch {
	case ctx.project.StartedAt != nil,
		ctx.project.BusinessStatus == model.ProjectBusinessStatusInProgress,
		stage == model.BusinessFlowStageInConstruction,
		stage == model.BusinessFlowStageNodeAcceptanceInProgress,
		stage == model.BusinessFlowStageCompleted,
		stage == model.BusinessFlowStageCasePendingGeneration,
		stage == model.BusinessFlowStageArchived,
		stage == model.BusinessFlowStageDisputed:
		return "started"
	case ctx.project.EntryStartDate != nil && (stage == model.BusinessFlowStageReadyToStart || ctx.project.BusinessStatus == model.ProjectBusinessStatusConstructionQuoteConfirmed):
		return "scheduled"
	default:
		return "pending_supervisor_schedule"
	}
}

func loadBridgeContext(bookingID, proposalID, quoteListID, projectID uint64) bridgeContext {
	ctx := bridgeContext{}

	if proposalID == 0 && bookingID > 0 {
		var proposal model.Proposal
		if err := repository.DB.Where("booking_id = ?", bookingID).Order("confirmed_at DESC, updated_at DESC, id DESC").First(&proposal).Error; err == nil {
			proposalID = proposal.ID
		}
	}

	if projectID > 0 {
		var project model.Project
		if err := repository.DB.First(&project, projectID).Error; err == nil {
			ctx.project = &project
		}
	}

	if ctx.flow == nil {
		switch {
		case projectID > 0:
			ctx.flow, _ = businessFlowSvc.GetByProjectID(projectID)
		case bookingID > 0:
			ctx.flow, _ = businessFlowSvc.GetBySource(model.BusinessFlowSourceBooking, bookingID)
		case proposalID > 0:
			if sourceType, sourceID, err := businessFlowSvc.ResolveSourceFromProposal(nil, proposalID); err == nil && sourceID > 0 {
				ctx.flow, _ = businessFlowSvc.GetBySource(sourceType, sourceID)
			}
		}
	}

	if ctx.project == nil && ctx.flow != nil && ctx.flow.ProjectID > 0 {
		var project model.Project
		if err := repository.DB.First(&project, ctx.flow.ProjectID).Error; err == nil {
			ctx.project = &project
			projectID = project.ID
		}
	}

	if quoteListID == 0 && ctx.flow != nil && ctx.flow.SelectedQuoteTaskID > 0 {
		quoteListID = ctx.flow.SelectedQuoteTaskID
	}
	if quoteListID == 0 && projectID > 0 {
		var quoteList model.QuoteList
		if err := repository.DB.Where("project_id = ?", projectID).Order("updated_at DESC, id DESC").First(&quoteList).Error; err == nil {
			quoteListID = quoteList.ID
		}
	}
	if quoteListID == 0 && proposalID > 0 {
		var quoteList model.QuoteList
		if err := repository.DB.Where("proposal_id = ?", proposalID).Order("updated_at DESC, id DESC").First(&quoteList).Error; err == nil {
			quoteListID = quoteList.ID
		}
	}
	if quoteListID > 0 {
		var quoteList model.QuoteList
		if err := repository.DB.First(&quoteList, quoteListID).Error; err == nil {
			ctx.quoteList = &quoteList
			if ctx.project == nil && quoteList.ProjectID > 0 {
				var project model.Project
				if err := repository.DB.First(&project, quoteList.ProjectID).Error; err == nil {
					ctx.project = &project
					projectID = project.ID
				}
			}
		}
	}

	quantityBaseID := uint64(0)
	if ctx.quoteList != nil {
		quantityBaseID = ctx.quoteList.QuantityBaseID
	}
	if quantityBaseID > 0 {
		var base model.QuantityBase
		if err := repository.DB.First(&base, quantityBaseID).Error; err == nil {
			ctx.quantityBase = &base
		}
	}

	selectedProviderID := uint64(0)
	if ctx.project != nil {
		if ctx.project.ConstructionProviderID > 0 {
			selectedProviderID = ctx.project.ConstructionProviderID
		} else if ctx.project.ForemanID > 0 {
			selectedProviderID = ctx.project.ForemanID
		}
	}
	if selectedProviderID == 0 && ctx.quoteList != nil && ctx.quoteList.AwardedProviderID > 0 {
		selectedProviderID = ctx.quoteList.AwardedProviderID
	}
	if selectedProviderID == 0 && ctx.flow != nil && ctx.flow.SelectedForemanProviderID > 0 {
		selectedProviderID = ctx.flow.SelectedForemanProviderID
	}
	if selectedProviderID > 0 {
		var provider model.Provider
		if err := repository.DB.Select("id", "user_id", "company_name", "provider_type", "sub_type", "avatar").First(&provider, selectedProviderID).Error; err == nil {
			ctx.provider = &provider
			if provider.UserID > 0 {
				var user model.User
				if err := repository.DB.Select("nickname", "phone", "avatar").First(&user, provider.UserID).Error; err == nil {
					ctx.providerUser = &user
				}
			}
		}
	}

	if ctx.project != nil {
		var workLog model.WorkLog
		if err := repository.DB.Where("project_id = ?", ctx.project.ID).Order("log_date DESC, created_at DESC, id DESC").First(&workLog).Error; err == nil {
			logAt := workLog.LogDate
			if logAt.IsZero() {
				logAt = workLog.CreatedAt
			}
			if !logAt.IsZero() {
				ctx.latestLogAt = &logAt
			}
			ctx.latestLogTitle = strings.TrimSpace(workLog.Title)
		}
		_ = repository.DB.Model(&model.RiskWarning{}).
			Where("project_id = ? AND status IN ?", ctx.project.ID, []int8{0, 1}).
			Count(&ctx.unhandledRiskCnt).Error
	}

	return ctx
}
