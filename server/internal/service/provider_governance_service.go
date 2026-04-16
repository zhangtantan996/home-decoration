package service

import (
	"fmt"
	"strings"
	"time"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
)

type ProviderGovernanceScoreSummary struct {
	ResponseRate            float64 `json:"responseRate"`
	ProposalRate            float64 `json:"proposalRate"`
	DesignConfirmRate       float64 `json:"designConfirmRate"`
	ConstructionConfirmRate float64 `json:"constructionConfirmRate"`
	CompletionRate          float64 `json:"completionRate"`
	AcceptancePassRate      float64 `json:"acceptancePassRate"`
	ComplaintRate           float64 `json:"complaintRate"`
	RefundRate              float64 `json:"refundRate"`
	CaseCount               int64   `json:"caseCount"`
	OfficialReviewCount     int64   `json:"officialReviewCount"`
}

type ProviderGovernanceFunnelMetrics struct {
	BookingsTotal              int64 `json:"bookingsTotal"`
	RespondedBookings          int64 `json:"respondedBookings"`
	ProposalSubmittedCount     int64 `json:"proposalSubmittedCount"`
	DesignConfirmedCount       int64 `json:"designConfirmedCount"`
	ConstructionConfirmedCount int64 `json:"constructionConfirmedCount"`
	CompletedProjectCount      int64 `json:"completedProjectCount"`
}

type ProviderGovernanceSummary struct {
	GovernanceTier    string                          `json:"governanceTier,omitempty"`
	ScoreSummary      ProviderGovernanceScoreSummary  `json:"scoreSummary"`
	RiskFlags         []string                        `json:"riskFlags,omitempty"`
	RecommendedAction string                          `json:"recommendedAction,omitempty"`
	FunnelMetrics     ProviderGovernanceFunnelMetrics `json:"funnelMetrics"`
}

type ProviderGovernanceService struct{}

func (s *ProviderGovernanceService) BuildSummary(providerID uint64) *ProviderGovernanceSummary {
	if providerID == 0 {
		return nil
	}
	windowStart := time.Now().AddDate(0, 0, -30)
	summary := &ProviderGovernanceSummary{}
	var bookingTotal, respondedBookings int64
	_ = repository.DB.Model(&model.Booking{}).Where("provider_id = ?", providerID).Count(&bookingTotal).Error
	_ = repository.DB.Model(&model.Booking{}).Where("provider_id = ? AND status >= ?", providerID, 2).Count(&respondedBookings).Error

	var proposalSubmitted, designConfirmed int64
	_ = repository.DB.Model(&model.Proposal{}).Where("designer_id = ? AND submitted_at IS NOT NULL", providerID).Count(&proposalSubmitted).Error
	_ = repository.DB.Model(&model.Proposal{}).Where("designer_id = ? AND status = ?", providerID, model.ProposalStatusConfirmed).Count(&designConfirmed).Error

	var constructionConfirmed int64
	_ = repository.DB.Model(&model.Project{}).Where("provider_id = ?", providerID).Count(&constructionConfirmed).Error

	var completedProjects int64
	_ = repository.DB.Model(&model.Project{}).Where("provider_id = ? AND (status = ? OR business_status = ?)", providerID, model.ProjectStatusCompleted, model.ProjectBusinessStatusCompleted).Count(&completedProjects).Error

	projectScope := repository.DB.Model(&model.Project{}).Select("id").Where("provider_id = ?", providerID)

	var acceptedMilestones, submittedMilestones int64
	_ = repository.DB.Model(&model.Milestone{}).Where("project_id IN (?) AND submitted_at IS NOT NULL", projectScope).Count(&submittedMilestones).Error
	_ = repository.DB.Model(&model.Milestone{}).Where("project_id IN (?) AND accepted_at IS NOT NULL", projectScope).Count(&acceptedMilestones).Error

	var complaints, refunds, cases, officialReviews int64
	_ = repository.DB.Model(&model.Complaint{}).Where("provider_id = ? AND created_at >= ?", providerID, windowStart).Count(&complaints).Error
	_ = repository.DB.Model(&model.RefundApplication{}).
		Where("created_at >= ? AND (project_id IN (?) OR booking_id IN (?))", windowStart,
			projectScope,
			repository.DB.Model(&model.Booking{}).Select("id").Where("provider_id = ?", providerID),
		).Count(&refunds).Error
	_ = repository.DB.Model(&model.ProviderCase{}).Where("provider_id = ?", providerID).Count(&cases).Error
	_ = validOfficialProviderReviewScope(repository.DB).Where("provider_id = ?", providerID).Count(&officialReviews).Error

	summary.FunnelMetrics = ProviderGovernanceFunnelMetrics{
		BookingsTotal:              bookingTotal,
		RespondedBookings:          respondedBookings,
		ProposalSubmittedCount:     proposalSubmitted,
		DesignConfirmedCount:       designConfirmed,
		ConstructionConfirmedCount: constructionConfirmed,
		CompletedProjectCount:      completedProjects,
	}
	summary.ScoreSummary = ProviderGovernanceScoreSummary{
		ResponseRate:            safeDivide(respondedBookings, bookingTotal),
		ProposalRate:            safeDivide(proposalSubmitted, bookingTotal),
		DesignConfirmRate:       safeDivide(designConfirmed, proposalSubmitted),
		ConstructionConfirmRate: safeDivide(constructionConfirmed, designConfirmed),
		CompletionRate:          safeDivide(completedProjects, constructionConfirmed),
		AcceptancePassRate:      safeDivide(acceptedMilestones, submittedMilestones),
		ComplaintRate:           safeDivide(complaints, maxInt64(completedProjects, constructionConfirmed, 1)),
		RefundRate:              safeDivide(refunds, maxInt64(designConfirmed, constructionConfirmed, 1)),
		CaseCount:               cases,
		OfficialReviewCount:     officialReviews,
	}
	summary.RiskFlags = buildProviderRiskFlags(summary.ScoreSummary, summary.FunnelMetrics)
	summary.GovernanceTier = resolveGovernanceTier(summary.ScoreSummary, summary.FunnelMetrics, len(summary.RiskFlags) > 0)
	summary.RecommendedAction = resolveGovernanceAction(summary.GovernanceTier, summary.RiskFlags)
	return summary
}

func safeDivide(numerator, denominator int64) float64 {
	if denominator <= 0 {
		return 0
	}
	return float64(numerator) / float64(denominator)
}

func maxInt64(values ...int64) int64 {
	var max int64
	for _, value := range values {
		if value > max {
			max = value
		}
	}
	if max == 0 {
		return 1
	}
	return max
}

func buildProviderRiskFlags(score ProviderGovernanceScoreSummary, funnel ProviderGovernanceFunnelMetrics) []string {
	flags := make([]string, 0, 4)
	if funnel.BookingsTotal >= 3 && score.ResponseRate < 0.5 {
		flags = append(flags, "低响应")
	}
	if funnel.ProposalSubmittedCount >= 3 && score.DesignConfirmRate < 0.3 {
		flags = append(flags, "设计确认偏低")
	}
	if funnel.ConstructionConfirmedCount >= 3 && score.CompletionRate < 0.5 {
		flags = append(flags, "履约完成偏低")
	}
	if score.ComplaintRate >= 0.2 {
		flags = append(flags, "投诉偏高")
	}
	if score.RefundRate >= 0.15 {
		flags = append(flags, "退款偏高")
	}
	return flags
}

func resolveGovernanceTier(score ProviderGovernanceScoreSummary, funnel ProviderGovernanceFunnelMetrics, hasRisk bool) string {
	switch {
	case hasRisk:
		return "风险观察期"
	case funnel.BookingsTotal == 0 && funnel.ProposalSubmittedCount == 0:
		return "新入驻观察期"
	case funnel.DesignConfirmedCount == 0 || funnel.ConstructionConfirmedCount == 0:
		return "成交培育期"
	case funnel.CompletedProjectCount >= 3 && score.ComplaintRate < 0.1 && score.RefundRate < 0.08 && score.AcceptancePassRate >= 0.7:
		return "重点扶持期"
	case funnel.CompletedProjectCount >= 1:
		return "稳定履约期"
	default:
		return "成交培育期"
	}
}

func resolveGovernanceAction(tier string, riskFlags []string) string {
	switch tier {
	case "新入驻观察期":
		return "扶持：优先补齐资料、案例与首次响应动作"
	case "成交培育期":
		return "扶持：盯首单、首个设计确认与首个工长确认"
	case "稳定履约期":
		return "扶持：增加优质流量，持续跟踪投诉与退款波动"
	case "重点扶持期":
		return "扶持：纳入重点曝光与样板项目池"
	case "风险观察期":
		return fmt.Sprintf("预警/限流：%s", strings.Join(riskFlags, "、"))
	default:
		return "继续观察并按主链指标调整分发"
	}
}
