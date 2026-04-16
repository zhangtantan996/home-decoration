package service

import (
	"time"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	"home-decoration-server/pkg/timeutil"
)

type DashboardMetricValue struct {
	Key   string  `json:"key"`
	Label string  `json:"label"`
	Value float64 `json:"value"`
}

type DashboardSectionSummary struct {
	Key     string                 `json:"key"`
	Title   string                 `json:"title"`
	Metrics []DashboardMetricValue `json:"metrics"`
}

type DashboardFunnelStep struct {
	Key   string  `json:"key"`
	Label string  `json:"label"`
	Value float64 `json:"value"`
}

type DashboardOverview struct {
	NorthStar         DashboardMetricValue      `json:"northStar"`
	CoreMetrics       []DashboardMetricValue    `json:"coreMetrics"`
	DashboardSections []DashboardSectionSummary `json:"dashboardSections"`
	UserFunnel        []DashboardFunnelStep     `json:"userFunnel"`
	MerchantFunnel    []DashboardFunnelStep     `json:"merchantFunnel"`
	TodayNewUsers     int64                     `json:"todayNewUsers"`
	ProviderCount     int64                     `json:"providerCount"`
	MaterialShopCount int64                     `json:"materialShopCount"`
}

type DashboardTrendItem struct {
	Date                  string  `json:"date"`
	EffectiveBookings     float64 `json:"effectiveBookings"`
	DesignConfirmed       float64 `json:"designConfirmed"`
	ConstructionConfirmed float64 `json:"constructionConfirmed"`
	CompletedProjects     float64 `json:"completedProjects"`
	DisputeRate           float64 `json:"disputeRate"`
	RefundRate            float64 `json:"refundRate"`
}

type DashboardDistribution struct {
	ProviderTiers []DashboardMetricValue `json:"providerTiers"`
	ServiceTypes  []DashboardMetricValue `json:"serviceTypes"`
	ProjectStages []DashboardMetricValue `json:"projectStages"`
}

type AdminDashboardService struct{}

func (s *AdminDashboardService) GetOverview() (*DashboardOverview, error) {
	today := timeutil.StartOfDay(timeutil.Now())
	monthStart := time.Date(today.Year(), today.Month(), 1, 0, 0, 0, 0, today.Location())
	providerGovernance := &ProviderGovernanceService{}

	var todayNewUsers, providerCount, materialShopCount int64
	_ = repository.DB.Model(&model.User{}).Where("created_at >= ?", today).Count(&todayNewUsers).Error
	_ = repository.DB.Model(&model.Provider{}).Count(&providerCount).Error
	_ = repository.DB.Model(&model.MaterialShop{}).Count(&materialShopCount).Error

	effectiveBookings := countBookingsWithStatusAtLeast(2)
	designConfirmed := countConfirmedProposals()
	constructionConfirmed := countProjects()
	completedProjects := countCompletedProjects()
	majorDisputes := countOpenDisputesAndComplaints()
	refundRate := computeRefundRate()
	disputeRate := ratio(majorDisputes, maxInt64(constructionConfirmed, 1))
	northStar := float64(maxInt64(completedProjects-int64(majorDisputes), 0))

	var monthlyDesignRevenue, monthlyConstructionRevenue float64
	_ = repository.DB.Model(&model.Order{}).Where("status = ? AND order_type = ? AND paid_at >= ?", model.OrderStatusPaid, model.OrderTypeDesign, monthStart).Select("COALESCE(SUM(total_amount),0)").Scan(&monthlyDesignRevenue).Error
	_ = repository.DB.Model(&model.Order{}).Where("status = ? AND order_type = ? AND paid_at >= ?", model.OrderStatusPaid, model.OrderTypeConstruction, monthStart).Select("COALESCE(SUM(total_amount),0)").Scan(&monthlyConstructionRevenue).Error

	providerTierCounts := map[string]float64{}
	var providerIDs []uint64
	_ = repository.DB.Model(&model.Provider{}).Pluck("id", &providerIDs).Error
	for _, providerID := range providerIDs {
		summary := providerGovernance.BuildSummary(providerID)
		if summary == nil {
			continue
		}
		providerTierCounts[summary.GovernanceTier] += 1
	}

	overview := &DashboardOverview{
		NorthStar: DashboardMetricValue{Key: "north_star", Label: "完工且无重大争议项目数", Value: northStar},
		CoreMetrics: []DashboardMetricValue{
			{Key: "effective_bookings", Label: "有效预约数", Value: float64(effectiveBookings)},
			{Key: "design_confirmed", Label: "设计确认数", Value: float64(designConfirmed)},
			{Key: "construction_confirmed", Label: "工长确认数", Value: float64(constructionConfirmed)},
			{Key: "completed_projects", Label: "完工项目数", Value: float64(completedProjects)},
			{Key: "dispute_rate", Label: "争议率", Value: disputeRate},
			{Key: "refund_rate", Label: "退款率", Value: refundRate},
		},
		DashboardSections: []DashboardSectionSummary{
			{Key: "acquisition", Title: "拉新看板", Metrics: []DashboardMetricValue{{Key: "today_new_users", Label: "今日新增用户", Value: float64(todayNewUsers)}, {Key: "effective_bookings", Label: "有效预约", Value: float64(effectiveBookings)}}},
			{Key: "design", Title: "设计成交看板", Metrics: []DashboardMetricValue{{Key: "design_confirmed", Label: "设计确认", Value: float64(designConfirmed)}, {Key: "monthly_design_revenue", Label: "本月设计成交额", Value: monthlyDesignRevenue}}},
			{Key: "construction", Title: "施工成交看板", Metrics: []DashboardMetricValue{{Key: "construction_confirmed", Label: "工长确认", Value: float64(constructionConfirmed)}, {Key: "monthly_construction_revenue", Label: "本月施工成交额", Value: monthlyConstructionRevenue}}},
			{Key: "delivery", Title: "履约质量看板", Metrics: []DashboardMetricValue{{Key: "completed_projects", Label: "完工项目", Value: float64(completedProjects)}, {Key: "dispute_rate", Label: "争议率", Value: disputeRate}}},
			{Key: "supply", Title: "供给质量看板", Metrics: []DashboardMetricValue{{Key: "provider_count", Label: "服务商数", Value: float64(providerCount)}, {Key: "support_tier", Label: "重点扶持商家", Value: providerTierCounts["重点扶持期"]}}},
			{Key: "after_sales", Title: "售后治理看板", Metrics: []DashboardMetricValue{{Key: "refund_rate", Label: "退款率", Value: refundRate}, {Key: "major_disputes", Label: "争议/投诉量", Value: float64(majorDisputes)}}},
		},
		UserFunnel:        []DashboardFunnelStep{{Key: "enter", Label: "进入/留资", Value: float64(todayNewUsers)}, {Key: "booking", Label: "预约", Value: float64(effectiveBookings)}, {Key: "design", Label: "设计确认", Value: float64(designConfirmed)}, {Key: "construction", Label: "工长确认", Value: float64(constructionConfirmed)}, {Key: "completed", Label: "完工", Value: float64(completedProjects)}},
		MerchantFunnel:    []DashboardFunnelStep{{Key: "approved", Label: "审核通过", Value: float64(providerCount)}, {Key: "proposal", Label: "首次提案", Value: float64(countProvidersWithProposal())}, {Key: "deal", Label: "首次成交", Value: float64(countProvidersWithProject())}, {Key: "completed", Label: "首次完工", Value: float64(countProvidersWithCompletedProject())}},
		TodayNewUsers:     todayNewUsers,
		ProviderCount:     providerCount,
		MaterialShopCount: materialShopCount,
	}
	return overview, nil
}

func (s *AdminDashboardService) GetTrends(days int) ([]DashboardTrendItem, error) {
	if days != 30 {
		days = 7
	}
	today := timeutil.StartOfDay(timeutil.Now())
	items := make([]DashboardTrendItem, 0, days)
	for i := days - 1; i >= 0; i-- {
		day := today.AddDate(0, 0, -i)
		nextDay := day.AddDate(0, 0, 1)
		effectiveBookings := countBookingsBetween(day, nextDay, 2)
		designConfirmed := countConfirmedProposalsBetween(day, nextDay)
		constructionConfirmed := countProjectsBetween(day, nextDay)
		completedProjects := countCompletedProjectsBetween(day, nextDay)
		refunds := countRefundsBetween(day, nextDay)
		disputes := countComplaintsBetween(day, nextDay)
		items = append(items, DashboardTrendItem{
			Date:                  day.Format("01-02"),
			EffectiveBookings:     float64(effectiveBookings),
			DesignConfirmed:       float64(designConfirmed),
			ConstructionConfirmed: float64(constructionConfirmed),
			CompletedProjects:     float64(completedProjects),
			DisputeRate:           ratio(disputes, maxInt64(constructionConfirmed, 1)),
			RefundRate:            ratio(refunds, maxInt64(designConfirmed, constructionConfirmed, 1)),
		})
	}
	return items, nil
}

func (s *AdminDashboardService) GetDistribution() (*DashboardDistribution, error) {
	providerGovernance := &ProviderGovernanceService{}
	result := &DashboardDistribution{}
	var providerIDs []uint64
	_ = repository.DB.Model(&model.Provider{}).Pluck("id", &providerIDs).Error
	providerTiers := map[string]float64{}
	for _, providerID := range providerIDs {
		summary := providerGovernance.BuildSummary(providerID)
		if summary == nil {
			continue
		}
		providerTiers[summary.GovernanceTier] += 1
	}
	for _, key := range []string{"新入驻观察期", "成交培育期", "稳定履约期", "重点扶持期", "风险观察期"} {
		result.ProviderTiers = append(result.ProviderTiers, DashboardMetricValue{Key: key, Label: key, Value: providerTiers[key]})
	}

	var designerCount, companyCount, foremanCount int64
	_ = repository.DB.Model(&model.Provider{}).Where("provider_type = ?", 1).Count(&designerCount).Error
	_ = repository.DB.Model(&model.Provider{}).Where("provider_type = ?", 2).Count(&companyCount).Error
	_ = repository.DB.Model(&model.Provider{}).Where("provider_type = ?", 3).Count(&foremanCount).Error
	result.ServiceTypes = []DashboardMetricValue{{Key: "designer", Label: "设计师", Value: float64(designerCount)}, {Key: "company", Label: "装修公司", Value: float64(companyCount)}, {Key: "foreman", Label: "工长", Value: float64(foremanCount)}}

	var readyToStart, inProgress, completed, archived int64
	_ = repository.DB.Model(&model.Project{}).Where("current_phase = ? OR business_status = ?", "ready_to_start", model.ProjectBusinessStatusConstructionQuoteConfirmed).Count(&readyToStart).Error
	_ = repository.DB.Model(&model.Project{}).Where("business_status = ?", model.ProjectBusinessStatusInProgress).Count(&inProgress).Error
	_ = repository.DB.Model(&model.Project{}).Where("business_status = ?", model.ProjectBusinessStatusCompleted).Count(&completed).Error
	_ = repository.DB.Model(&model.Project{}).Where("current_phase = ?", "archived").Count(&archived).Error
	result.ProjectStages = []DashboardMetricValue{{Key: "ready_to_start", Label: "待监理协调开工", Value: float64(readyToStart)}, {Key: "in_progress", Label: "施工中", Value: float64(inProgress)}, {Key: "completed", Label: "已完工", Value: float64(completed)}, {Key: "archived", Label: "已归档", Value: float64(archived)}}
	return result, nil
}

func countBookingsWithStatusAtLeast(status int8) int64 {
	var count int64
	_ = repository.DB.Model(&model.Booking{}).Where("status >= ?", status).Count(&count).Error
	return count
}

func countConfirmedProposals() int64 {
	var count int64
	_ = repository.DB.Model(&model.Proposal{}).Where("status = ?", model.ProposalStatusConfirmed).Count(&count).Error
	return count
}

func countProjects() int64 {
	var count int64
	_ = repository.DB.Model(&model.Project{}).Count(&count).Error
	return count
}

func countCompletedProjects() int64 {
	var count int64
	_ = repository.DB.Model(&model.Project{}).Where("status = ? OR business_status = ?", model.ProjectStatusCompleted, model.ProjectBusinessStatusCompleted).Count(&count).Error
	return count
}

func countOpenDisputesAndComplaints() int64 {
	var complaints int64
	_ = repository.DB.Model(&model.Complaint{}).Where("status NOT IN ?", []string{"resolved", "closed", "completed"}).Count(&complaints).Error
	return complaints
}

func computeRefundRate() float64 {
	var refunds int64
	_ = repository.DB.Model(&model.RefundApplication{}).Where("status IN ?", []string{"pending", "approved", "completed"}).Count(&refunds).Error
	denominator := maxInt64(countConfirmedProposals(), countProjects(), 1)
	return ratio(refunds, denominator)
}

func countProvidersWithProposal() int64 {
	var count int64
	_ = repository.DB.Model(&model.Proposal{}).Distinct("designer_id").Count(&count).Error
	return count
}

func countProvidersWithProject() int64 {
	var count int64
	_ = repository.DB.Model(&model.Project{}).Distinct("provider_id").Count(&count).Error
	return count
}

func countProvidersWithCompletedProject() int64 {
	var count int64
	_ = repository.DB.Model(&model.Project{}).Where("status = ? OR business_status = ?", model.ProjectStatusCompleted, model.ProjectBusinessStatusCompleted).Distinct("provider_id").Count(&count).Error
	return count
}

func countBookingsBetween(start, end time.Time, minStatus int8) int64 {
	var count int64
	_ = repository.DB.Model(&model.Booking{}).Where("created_at >= ? AND created_at < ? AND status >= ?", start, end, minStatus).Count(&count).Error
	return count
}

func countConfirmedProposalsBetween(start, end time.Time) int64 {
	var count int64
	_ = repository.DB.Model(&model.Proposal{}).Where("confirmed_at >= ? AND confirmed_at < ? AND status = ?", start, end, model.ProposalStatusConfirmed).Count(&count).Error
	return count
}

func countProjectsBetween(start, end time.Time) int64 {
	var count int64
	_ = repository.DB.Model(&model.Project{}).Where("created_at >= ? AND created_at < ?", start, end).Count(&count).Error
	return count
}

func countCompletedProjectsBetween(start, end time.Time) int64 {
	var count int64
	_ = repository.DB.Model(&model.Project{}).Where("updated_at >= ? AND updated_at < ? AND (status = ? OR business_status = ?)", start, end, model.ProjectStatusCompleted, model.ProjectBusinessStatusCompleted).Count(&count).Error
	return count
}

func countRefundsBetween(start, end time.Time) int64 {
	var count int64
	_ = repository.DB.Model(&model.RefundApplication{}).Where("created_at >= ? AND created_at < ?", start, end).Count(&count).Error
	return count
}

func countComplaintsBetween(start, end time.Time) int64 {
	var count int64
	_ = repository.DB.Model(&model.Complaint{}).Where("created_at >= ? AND created_at < ?", start, end).Count(&count).Error
	return count
}

func ratio(numerator, denominator int64) float64 {
	if denominator <= 0 {
		return 0
	}
	return float64(numerator) / float64(denominator)
}
