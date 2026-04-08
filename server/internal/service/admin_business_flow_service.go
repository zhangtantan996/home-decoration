package service

import (
	"errors"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"time"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"

	"gorm.io/gorm"
)

type AdminBusinessFlowFilter struct {
	Keyword           string
	CurrentStage      string
	OwnerUserID       uint64
	ProviderID        uint64
	BookingID         uint64
	ProjectID         uint64
	OrderStatus       string
	PaymentPlanStatus string
	RefundStatus      string
	RiskStatus        string
	PaymentPaused     *bool
	Page              int
	PageSize          int
}

type AdminBusinessFlowActor struct {
	UserID       uint64 `json:"userId,omitempty"`
	ProviderID   uint64 `json:"providerId,omitempty"`
	DisplayName  string `json:"displayName"`
	Phone        string `json:"phone,omitempty"`
	ProviderType int8   `json:"providerType,omitempty"`
	Role         string `json:"role,omitempty"`
}

type AdminBusinessFlowAction struct {
	Key            string                 `json:"key"`
	Label          string                 `json:"label"`
	Kind           string                 `json:"kind"`
	Permission     string                 `json:"permission,omitempty"`
	Method         string                 `json:"method,omitempty"`
	APIPath        string                 `json:"apiPath,omitempty"`
	Route          string                 `json:"route,omitempty"`
	Payload        map[string]interface{} `json:"payload,omitempty"`
	Danger         bool                   `json:"danger,omitempty"`
	RequiresReason bool                   `json:"requiresReason"`
}

type AdminBusinessFlowOrderSnapshot struct {
	ID          uint64              `json:"id"`
	OrderNo     string              `json:"orderNo"`
	OrderType   string              `json:"orderType"`
	Status      string              `json:"status"`
	TotalAmount float64             `json:"totalAmount"`
	PaidAmount  float64             `json:"paidAmount"`
	Discount    float64             `json:"discount"`
	ProjectID   uint64              `json:"projectId,omitempty"`
	ProposalID  uint64              `json:"proposalId,omitempty"`
	BookingID   uint64              `json:"bookingId,omitempty"`
	ExpireAt    *time.Time          `json:"expireAt,omitempty"`
	PaidAt      *time.Time          `json:"paidAt,omitempty"`
	PaymentPlan []model.PaymentPlan `json:"paymentPlans,omitempty"`
}

type AdminBusinessFlowRiskSnapshot struct {
	Status              string   `json:"status"`
	PaymentPaused       bool     `json:"paymentPaused"`
	PaymentPausedReason string   `json:"paymentPausedReason,omitempty"`
	HasDispute          bool     `json:"hasDispute"`
	HasOpenWarning      bool     `json:"hasOpenWarning"`
	HasOpenArbitration  bool     `json:"hasOpenArbitration"`
	HasOpenAudit        bool     `json:"hasOpenAudit"`
	HasPendingRefund    bool     `json:"hasPendingRefund"`
	Summary             string   `json:"summary"`
	WarningTypes        []string `json:"warningTypes,omitempty"`
}

type AdminBusinessFlowListItem struct {
	FlowID                string                    `json:"flowId"`
	SourceType            string                    `json:"sourceType"`
	SourceID              uint64                    `json:"sourceId"`
	CurrentStage          string                    `json:"currentStage"`
	FlowSummary           string                    `json:"flowSummary"`
	OwnerUser             *AdminBusinessFlowActor   `json:"ownerUser,omitempty"`
	Provider              *AdminBusinessFlowActor   `json:"provider,omitempty"`
	BookingID             uint64                    `json:"bookingId,omitempty"`
	ProposalID            uint64                    `json:"proposalId,omitempty"`
	QuoteTaskID           uint64                    `json:"quoteTaskId,omitempty"`
	ProjectID             uint64                    `json:"projectId,omitempty"`
	PrimaryOrderNo        string                    `json:"primaryOrderNo,omitempty"`
	OrderStatus           string                    `json:"orderStatus"`
	PaymentPlanStatus     string                    `json:"paymentPlanStatus"`
	RefundStatus          string                    `json:"refundStatus"`
	RiskStatus            string                    `json:"riskStatus"`
	PaymentPaused         bool                      `json:"paymentPaused"`
	StageChangedAt        *time.Time                `json:"stageChangedAt,omitempty"`
	AvailableAdminActions []AdminBusinessFlowAction `json:"availableAdminActions"`
}

type AdminBusinessFlowDetail struct {
	FlowID                  string                           `json:"flowId"`
	SourceType              string                           `json:"sourceType"`
	SourceID                uint64                           `json:"sourceId"`
	CurrentStage            string                           `json:"currentStage"`
	FlowSummary             string                           `json:"flowSummary"`
	StageChangedAt          *time.Time                       `json:"stageChangedAt,omitempty"`
	OwnerUser               *AdminBusinessFlowActor          `json:"ownerUser,omitempty"`
	Provider                *AdminBusinessFlowActor          `json:"provider,omitempty"`
	DesignerProvider        *AdminBusinessFlowActor          `json:"designerProvider,omitempty"`
	ConstructionProvider    *AdminBusinessFlowActor          `json:"constructionProvider,omitempty"`
	Booking                 *model.Booking                   `json:"booking,omitempty"`
	Demand                  *model.Demand                    `json:"demand,omitempty"`
	Proposal                *model.Proposal                  `json:"proposal,omitempty"`
	QuoteTask               *model.QuoteList                 `json:"quoteTask,omitempty"`
	SelectedQuoteSubmission *model.QuoteSubmission           `json:"selectedQuoteSubmission,omitempty"`
	Project                 *model.Project                   `json:"project,omitempty"`
	Milestones              []model.Milestone                `json:"milestones,omitempty"`
	Orders                  []AdminBusinessFlowOrderSnapshot `json:"orders,omitempty"`
	EscrowAccount           *model.EscrowAccount             `json:"escrowAccount,omitempty"`
	Transactions            []model.Transaction              `json:"transactions,omitempty"`
	RefundApplications      []RefundApplicationView          `json:"refundApplications,omitempty"`
	ProjectAudits           []ProjectAuditView               `json:"projectAudits,omitempty"`
	RiskWarnings            []model.RiskWarning              `json:"riskWarnings,omitempty"`
	Arbitrations            []model.Arbitration              `json:"arbitrations,omitempty"`
	Risk                    *AdminBusinessFlowRiskSnapshot   `json:"risk,omitempty"`
	AuditLogs               []AdminAuditLogItem              `json:"auditLogs,omitempty"`
	AvailableAdminActions   []AdminBusinessFlowAction        `json:"availableAdminActions"`
}

type adminBusinessFlowContext struct {
	flow                  *model.BusinessFlow
	flowID                string
	sourceType            string
	sourceID              uint64
	booking               *model.Booking
	demand                *model.Demand
	proposal              *model.Proposal
	quoteTask             *model.QuoteList
	quoteSubmission       *model.QuoteSubmission
	project               *model.Project
	milestones            []model.Milestone
	orders                []model.Order
	paymentPlans          []model.PaymentPlan
	escrow                *model.EscrowAccount
	transactions          []model.Transaction
	refundApplications    []RefundApplicationView
	projectAudits         []ProjectAuditView
	riskWarnings          []model.RiskWarning
	arbitrations          []model.Arbitration
	auditLogs             []AdminAuditLogItem
	owner                 *AdminBusinessFlowActor
	provider              *AdminBusinessFlowActor
	designerProvider      *AdminBusinessFlowActor
	constructionProvider  *AdminBusinessFlowActor
	summary               BusinessFlowSummary
	orderStatus           string
	paymentPlanStatus     string
	refundStatus          string
	riskStatus            string
	paymentPaused         bool
	stageChangedAt        *time.Time
	availableAdminActions []AdminBusinessFlowAction
	riskSnapshot          *AdminBusinessFlowRiskSnapshot
}

type sourceRef struct {
	sourceType string
	sourceID   uint64
}

type AdminBusinessFlowService struct {
	refundService *RefundApplicationService
	auditService  *AuditLogService
}

func NewAdminBusinessFlowService() *AdminBusinessFlowService {
	return &AdminBusinessFlowService{
		refundService: &RefundApplicationService{},
		auditService:  &AuditLogService{},
	}
}

func (s *AdminBusinessFlowService) List(filter AdminBusinessFlowFilter) ([]AdminBusinessFlowListItem, int64, error) {
	if filter.Page <= 0 {
		filter.Page = 1
	}
	if filter.PageSize <= 0 {
		filter.PageSize = 20
	}

	contexts, err := s.loadAllContexts()
	if err != nil {
		return nil, 0, err
	}

	items := make([]AdminBusinessFlowListItem, 0, len(contexts))
	for _, ctx := range contexts {
		item := ctx.toListItem()
		if !matchesBusinessFlowFilter(ctx, item, filter) {
			continue
		}
		items = append(items, item)
	}

	sort.SliceStable(items, func(i, j int) bool {
		left := time.Time{}
		right := time.Time{}
		if items[i].StageChangedAt != nil {
			left = *items[i].StageChangedAt
		}
		if items[j].StageChangedAt != nil {
			right = *items[j].StageChangedAt
		}
		if left.Equal(right) {
			return items[i].FlowID < items[j].FlowID
		}
		return left.After(right)
	})

	total := int64(len(items))
	start := (filter.Page - 1) * filter.PageSize
	if start >= len(items) {
		return []AdminBusinessFlowListItem{}, total, nil
	}
	end := start + filter.PageSize
	if end > len(items) {
		end = len(items)
	}
	return items[start:end], total, nil
}

func (s *AdminBusinessFlowService) GetDetail(flowID string) (*AdminBusinessFlowDetail, error) {
	ctx, err := s.resolveContext(flowID)
	if err != nil {
		return nil, err
	}
	if ctx == nil {
		return nil, errors.New("业务链路不存在")
	}
	return ctx.toDetail(), nil
}

func (s *AdminBusinessFlowService) resolveContext(flowID string) (*adminBusinessFlowContext, error) {
	flowID = strings.TrimSpace(flowID)
	if flowID == "" {
		return nil, errors.New("无效链路ID")
	}
	if sourceType, sourceID, ok := parseLegacyFlowID(flowID); ok {
		return s.buildContext(nil, sourceType, sourceID)
	}
	flowNumericID, err := strconv.ParseUint(flowID, 10, 64)
	if err != nil {
		return nil, errors.New("无效链路ID")
	}
	var flow model.BusinessFlow
	if err := repository.DB.First(&flow, flowNumericID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("业务链路不存在")
		}
		return nil, err
	}
	return s.buildContext(&flow, flow.SourceType, flow.SourceID)
}

func (s *AdminBusinessFlowService) loadAllContexts() ([]*adminBusinessFlowContext, error) {
	var flows []model.BusinessFlow
	if err := repository.DB.Order("stage_changed_at DESC NULLS LAST, id DESC").Find(&flows).Error; err != nil {
		return nil, err
	}

	existing := make(map[string]struct{}, len(flows))
	contexts := make([]*adminBusinessFlowContext, 0, len(flows))
	for i := range flows {
		flow := flows[i]
		existing[sourceKey(flow.SourceType, flow.SourceID)] = struct{}{}
		ctx, err := s.buildContext(&flow, flow.SourceType, flow.SourceID)
		if err != nil {
			return nil, err
		}
		if ctx != nil {
			contexts = append(contexts, ctx)
		}
	}

	legacyRefs, err := s.loadLegacySourceRefs(existing)
	if err != nil {
		return nil, err
	}
	for _, ref := range legacyRefs {
		ctx, err := s.buildContext(nil, ref.sourceType, ref.sourceID)
		if err != nil {
			return nil, err
		}
		if ctx != nil {
			contexts = append(contexts, ctx)
		}
	}
	return contexts, nil
}

func (s *AdminBusinessFlowService) loadLegacySourceRefs(existing map[string]struct{}) ([]sourceRef, error) {
	refs := make([]sourceRef, 0)

	var bookings []model.Booking
	if err := repository.DB.Select("id").Find(&bookings).Error; err != nil {
		return nil, err
	}
	for _, booking := range bookings {
		key := sourceKey(model.BusinessFlowSourceBooking, booking.ID)
		if _, ok := existing[key]; ok {
			continue
		}
		refs = append(refs, sourceRef{sourceType: model.BusinessFlowSourceBooking, sourceID: booking.ID})
	}

	var demands []model.Demand
	if err := repository.DB.Select("id").Find(&demands).Error; err != nil {
		return nil, err
	}
	for _, demand := range demands {
		key := sourceKey(model.BusinessFlowSourceDemand, demand.ID)
		if _, ok := existing[key]; ok {
			continue
		}
		refs = append(refs, sourceRef{sourceType: model.BusinessFlowSourceDemand, sourceID: demand.ID})
	}

	return refs, nil
}

func (s *AdminBusinessFlowService) buildContext(flow *model.BusinessFlow, sourceType string, sourceID uint64) (*adminBusinessFlowContext, error) {
	if strings.TrimSpace(sourceType) == "" || sourceID == 0 {
		return nil, nil
	}
	ctx := &adminBusinessFlowContext{
		flow:       flow,
		sourceType: sourceType,
		sourceID:   sourceID,
		flowID:     buildFlowID(flow, sourceType, sourceID),
	}

	if err := s.loadSourceObjects(ctx); err != nil {
		return nil, err
	}
	if ctx.booking == nil && ctx.demand == nil && ctx.proposal == nil && ctx.project == nil && len(ctx.orders) == 0 {
		return nil, nil
	}
	if err := s.loadRelatedObjects(ctx); err != nil {
		return nil, err
	}

	ctx.owner = s.resolveOwnerActor(ctx)
	ctx.designerProvider = s.resolveDesignerActor(ctx)
	ctx.constructionProvider = s.resolveConstructionActor(ctx)
	ctx.provider = choosePrimaryProviderActor(ctx.designerProvider, ctx.constructionProvider)
	ctx.summary = s.resolveSummary(ctx)
	ctx.stageChangedAt = s.resolveStageChangedAt(ctx)
	ctx.orderStatus = summarizeOrderStatus(ctx.orders)
	ctx.paymentPlanStatus = summarizePaymentPlanStatus(ctx.paymentPlans)
	ctx.refundStatus = summarizeRefundStatus(ctx.refundApplications)
	ctx.paymentPaused = ctx.project != nil && ctx.project.PaymentPaused
	ctx.riskSnapshot = summarizeRiskSnapshot(ctx)
	ctx.riskStatus = ctx.riskSnapshot.Status
	ctx.availableAdminActions = s.resolveAvailableAdminActions(ctx)
	ctx.auditLogs = filterAuditLogs(ctx.auditLogs)
	return ctx, nil
}

func (s *AdminBusinessFlowService) loadSourceObjects(ctx *adminBusinessFlowContext) error {
	switch ctx.sourceType {
	case model.BusinessFlowSourceBooking:
		var booking model.Booking
		if err := repository.DB.First(&booking, ctx.sourceID).Error; err == nil {
			ctx.booking = &booking
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
	case model.BusinessFlowSourceDemand:
		var demand model.Demand
		if err := repository.DB.First(&demand, ctx.sourceID).Error; err == nil {
			ctx.demand = &demand
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
	}

	proposal, err := s.loadPrimaryProposal(ctx)
	if err != nil {
		return err
	}
	ctx.proposal = proposal

	project, err := s.loadPrimaryProject(ctx)
	if err != nil {
		return err
	}
	ctx.project = project

	quoteTask, err := s.loadPrimaryQuoteTask(ctx)
	if err != nil {
		return err
	}
	ctx.quoteTask = quoteTask

	quoteSubmission, err := s.loadPrimaryQuoteSubmission(ctx)
	if err != nil {
		return err
	}
	ctx.quoteSubmission = quoteSubmission
	return nil
}

func (s *AdminBusinessFlowService) loadRelatedObjects(ctx *adminBusinessFlowContext) error {
	orders, err := s.loadOrders(ctx)
	if err != nil {
		return err
	}
	ctx.orders = orders

	orderIDs := make([]uint64, 0, len(orders))
	for _, order := range orders {
		orderIDs = append(orderIDs, order.ID)
	}
	if len(orderIDs) > 0 {
		if err := repository.DB.Where("order_id IN ?", orderIDs).Order("seq ASC, id ASC").Find(&ctx.paymentPlans).Error; err != nil {
			return err
		}
	}

	if ctx.project != nil {
		if err := repository.DB.Where("project_id = ?", ctx.project.ID).Order("seq ASC, id ASC").Find(&ctx.milestones).Error; err != nil {
			return err
		}
		var escrow model.EscrowAccount
		if err := repository.DB.Where("project_id = ?", ctx.project.ID).First(&escrow).Error; err == nil {
			ctx.escrow = &escrow
		} else if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		if err := repository.DB.Where("project_id = ?", ctx.project.ID).Order("created_at DESC").Find(&ctx.riskWarnings).Error; err != nil {
			return err
		}
		if err := repository.DB.Where("project_id = ?", ctx.project.ID).Order("created_at DESC").Find(&ctx.arbitrations).Error; err != nil {
			return err
		}
		projectAudits, err := s.loadProjectAudits(ctx.project.ID)
		if err != nil {
			return err
		}
		ctx.projectAudits = projectAudits
	}

	if ctx.escrow != nil {
		if err := repository.DB.Where("escrow_id = ?", ctx.escrow.ID).Order("created_at DESC").Find(&ctx.transactions).Error; err != nil {
			return err
		}
	}

	refundApplications, err := s.loadRefundApplications(ctx)
	if err != nil {
		return err
	}
	ctx.refundApplications = refundApplications

	auditLogs, err := s.loadAuditLogs(ctx)
	if err != nil {
		return err
	}
	ctx.auditLogs = auditLogs
	return nil
}

func (s *AdminBusinessFlowService) loadPrimaryProposal(ctx *adminBusinessFlowContext) (*model.Proposal, error) {
	if ctx.flow != nil && ctx.flow.ConfirmedProposalID > 0 {
		var proposal model.Proposal
		if err := repository.DB.First(&proposal, ctx.flow.ConfirmedProposalID).Error; err == nil {
			return &proposal, nil
		} else if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, err
		}
	}

	query := repository.DB.Model(&model.Proposal{})
	switch ctx.sourceType {
	case model.BusinessFlowSourceBooking:
		query = query.Where("booking_id = ?", ctx.sourceID)
	case model.BusinessFlowSourceDemand:
		query = query.Where("demand_id = ?", ctx.sourceID)
	default:
		return nil, nil
	}
	var proposal model.Proposal
	err := query.Order("status ASC, version DESC, id DESC").First(&proposal).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &proposal, nil
}

func (s *AdminBusinessFlowService) loadPrimaryProject(ctx *adminBusinessFlowContext) (*model.Project, error) {
	if ctx.flow != nil && ctx.flow.ProjectID > 0 {
		var project model.Project
		if err := repository.DB.First(&project, ctx.flow.ProjectID).Error; err == nil {
			return &project, nil
		} else if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, err
		}
	}
	if ctx.proposal != nil && ctx.proposal.ID > 0 {
		var project model.Project
		if err := repository.DB.Where("proposal_id = ?", ctx.proposal.ID).Order("id DESC").First(&project).Error; err == nil {
			return &project, nil
		} else if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, err
		}
	}
	var order model.Order
	query := repository.DB.Where("project_id > 0")
	switch ctx.sourceType {
	case model.BusinessFlowSourceBooking:
		query = query.Where("booking_id = ?", ctx.sourceID)
	case model.BusinessFlowSourceDemand:
		if ctx.proposal != nil {
			query = query.Where("proposal_id = ?", ctx.proposal.ID)
		} else {
			return nil, nil
		}
	default:
		return nil, nil
	}
	if err := query.Order("id DESC").First(&order).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	var project model.Project
	if err := repository.DB.First(&project, order.ProjectID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &project, nil
}

func (s *AdminBusinessFlowService) loadPrimaryQuoteTask(ctx *adminBusinessFlowContext) (*model.QuoteList, error) {
	if ctx.flow != nil && ctx.flow.SelectedQuoteTaskID > 0 {
		var quoteTask model.QuoteList
		if err := repository.DB.First(&quoteTask, ctx.flow.SelectedQuoteTaskID).Error; err == nil {
			return &quoteTask, nil
		} else if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, err
		}
	}
	query := repository.DB.Model(&model.QuoteList{})
	hasCondition := false
	if ctx.project != nil && ctx.project.ID > 0 {
		query = query.Where("project_id = ?", ctx.project.ID)
		hasCondition = true
	}
	if !hasCondition && ctx.proposal != nil && ctx.proposal.ID > 0 {
		query = query.Where("proposal_id = ?", ctx.proposal.ID)
		hasCondition = true
	}
	if !hasCondition {
		return nil, nil
	}
	var quoteTask model.QuoteList
	err := query.Order("updated_at DESC, id DESC").First(&quoteTask).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &quoteTask, nil
}

func (s *AdminBusinessFlowService) loadPrimaryQuoteSubmission(ctx *adminBusinessFlowContext) (*model.QuoteSubmission, error) {
	candidateID := uint64(0)
	if ctx.flow != nil && ctx.flow.SelectedQuoteSubmissionID > 0 {
		candidateID = ctx.flow.SelectedQuoteSubmissionID
	}
	if candidateID == 0 && ctx.project != nil && ctx.project.SelectedQuoteSubmissionID > 0 {
		candidateID = ctx.project.SelectedQuoteSubmissionID
	}
	if candidateID == 0 && ctx.quoteTask != nil && ctx.quoteTask.ActiveSubmissionID > 0 {
		candidateID = ctx.quoteTask.ActiveSubmissionID
	}
	if candidateID > 0 {
		var submission model.QuoteSubmission
		if err := repository.DB.First(&submission, candidateID).Error; err == nil {
			return &submission, nil
		} else if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, err
		}
	}
	if ctx.quoteTask == nil {
		return nil, nil
	}
	var submission model.QuoteSubmission
	err := repository.DB.Where("quote_list_id = ?", ctx.quoteTask.ID).Order("updated_at DESC, id DESC").First(&submission).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &submission, nil
}

func (s *AdminBusinessFlowService) loadOrders(ctx *adminBusinessFlowContext) ([]model.Order, error) {
	clauses := make([]string, 0, 3)
	args := make([]interface{}, 0, 3)
	if ctx.project != nil && ctx.project.ID > 0 {
		clauses = append(clauses, "project_id = ?")
		args = append(args, ctx.project.ID)
	}
	if ctx.proposal != nil && ctx.proposal.ID > 0 {
		clauses = append(clauses, "proposal_id = ?")
		args = append(args, ctx.proposal.ID)
	}
	if ctx.booking != nil && ctx.booking.ID > 0 {
		clauses = append(clauses, "booking_id = ?")
		args = append(args, ctx.booking.ID)
	}
	if len(clauses) == 0 {
		return nil, nil
	}
	var orders []model.Order
	if err := repository.DB.Where(strings.Join(clauses, " OR "), args...).Order("created_at DESC, id DESC").Find(&orders).Error; err != nil {
		return nil, err
	}
	return orders, nil
}

func (s *AdminBusinessFlowService) loadRefundApplications(ctx *adminBusinessFlowContext) ([]RefundApplicationView, error) {
	query := repository.DB.Model(&model.RefundApplication{})
	clauses := make([]string, 0, 2)
	args := make([]interface{}, 0, 2)
	if ctx.project != nil && ctx.project.ID > 0 {
		clauses = append(clauses, "project_id = ?")
		args = append(args, ctx.project.ID)
	}
	if ctx.booking != nil && ctx.booking.ID > 0 {
		clauses = append(clauses, "booking_id = ?")
		args = append(args, ctx.booking.ID)
	}
	if len(clauses) == 0 {
		return nil, nil
	}
	query = query.Where(strings.Join(clauses, " OR "), args...)
	var items []model.RefundApplication
	if err := query.Order("created_at DESC").Find(&items).Error; err != nil {
		return nil, err
	}
	views := make([]RefundApplicationView, 0, len(items))
	for i := range items {
		view, err := s.refundService.buildRefundApplicationViewTx(repository.DB, &items[i])
		if err != nil {
			return nil, err
		}
		views = append(views, *view)
	}
	return views, nil
}

func (s *AdminBusinessFlowService) loadProjectAudits(projectID uint64) ([]ProjectAuditView, error) {
	if projectID == 0 {
		return nil, nil
	}
	var audits []model.ProjectAudit
	if err := repository.DB.Where("project_id = ?", projectID).Order("created_at DESC").Find(&audits).Error; err != nil {
		return nil, err
	}
	result := make([]ProjectAuditView, 0, len(audits))
	projectAuditService := &ProjectAuditService{}
	for i := range audits {
		view, err := projectAuditService.buildProjectAuditViewTx(repository.DB, &audits[i])
		if err != nil {
			return nil, err
		}
		result = append(result, *view)
	}
	return result, nil
}

func (s *AdminBusinessFlowService) loadAuditLogs(ctx *adminBusinessFlowContext) ([]AdminAuditLogItem, error) {
	query := repository.DB.Model(&model.AuditLog{}).Where("record_kind = ?", auditRecordKindBusiness)
	clauses := make([]string, 0)
	args := make([]interface{}, 0)
	appendClause := func(resourceType string, ids []uint64) {
		if len(ids) == 0 {
			return
		}
		clauses = append(clauses, "(resource_type = ? AND resource_id IN ?)")
		args = append(args, resourceType, ids)
	}

	appendClause("proposal", collectIDs(func() []uint64 {
		if ctx.proposal != nil {
			return []uint64{ctx.proposal.ID}
		}
		return nil
	}()))
	appendClause("project", collectIDs(func() []uint64 {
		if ctx.project != nil {
			return []uint64{ctx.project.ID}
		}
		return nil
	}()))
	appendClause("milestone", milestoneIDs(ctx.milestones))
	appendClause("quote_list", collectIDs(func() []uint64 {
		if ctx.quoteTask != nil {
			return []uint64{ctx.quoteTask.ID}
		}
		return nil
	}()))
	appendClause("refund_application", refundIDs(ctx.refundApplications))
	appendClause("project_audit", projectAuditIDs(ctx.projectAudits))

	if len(clauses) == 0 {
		return nil, nil
	}
	query = query.Where(strings.Join(clauses, " OR "), args...)
	var logs []model.AuditLog
	if err := query.Order("created_at DESC").Limit(200).Find(&logs).Error; err != nil {
		return nil, err
	}
	return buildAdminAuditLogItems(logs), nil
}

func (s *AdminBusinessFlowService) resolveOwnerActor(ctx *adminBusinessFlowContext) *AdminBusinessFlowActor {
	userID := uint64(0)
	switch {
	case ctx.booking != nil:
		userID = ctx.booking.UserID
	case ctx.demand != nil:
		userID = ctx.demand.UserID
	case ctx.project != nil:
		userID = ctx.project.OwnerID
	case ctx.flow != nil:
		userID = ctx.flow.CustomerUserID
	}
	if userID == 0 {
		return nil
	}
	return loadUserActor(userID, "owner")
}

func (s *AdminBusinessFlowService) resolveDesignerActor(ctx *adminBusinessFlowContext) *AdminBusinessFlowActor {
	providerID := uint64(0)
	switch {
	case ctx.booking != nil && ctx.booking.ProviderID > 0:
		providerID = ctx.booking.ProviderID
	case ctx.proposal != nil && ctx.proposal.DesignerID > 0:
		providerID = ctx.proposal.DesignerID
	case ctx.flow != nil && ctx.flow.DesignerProviderID > 0:
		providerID = ctx.flow.DesignerProviderID
	}
	if providerID == 0 {
		return nil
	}
	return loadProviderActor(providerID, "designer")
}

func (s *AdminBusinessFlowService) resolveConstructionActor(ctx *adminBusinessFlowContext) *AdminBusinessFlowActor {
	providerID := uint64(0)
	switch {
	case ctx.project != nil && ctx.project.ConstructionProviderID > 0:
		providerID = ctx.project.ConstructionProviderID
	case ctx.project != nil && ctx.project.ForemanID > 0:
		providerID = ctx.project.ForemanID
	case ctx.quoteSubmission != nil && ctx.quoteSubmission.ProviderID > 0:
		providerID = ctx.quoteSubmission.ProviderID
	case ctx.flow != nil && ctx.flow.SelectedForemanProviderID > 0:
		providerID = ctx.flow.SelectedForemanProviderID
	}
	if providerID == 0 {
		return nil
	}
	return loadProviderActor(providerID, "construction")
}

func (s *AdminBusinessFlowService) resolveSummary(ctx *adminBusinessFlowContext) BusinessFlowSummary {
	if ctx.flow != nil {
		summary := businessFlowSvc.BuildSummary(ctx.flow)
		if strings.TrimSpace(summary.FlowSummary) != "" {
			return summary
		}
	}

	if ctx.project != nil {
		summary := businessFlowSvc.BuildProjectFallbackSummary(ctx.project, ctx.milestones)
		if ctx.project.PaymentPaused {
			summary.CurrentStage = model.BusinessFlowStagePaymentPaused
			summary.FlowSummary = ctx.project.PaymentPausedReason
			summary.AvailableActions = []string{"manual_release_funds", "unfreeze_funds"}
		}
		return summary
	}
	if ctx.quoteTask != nil {
		return businessFlowSvc.BuildQuoteFallbackSummary(ctx.quoteTask)
	}
	if ctx.proposal != nil {
		stage := model.BusinessFlowStageDesignPendingConfirmation
		switch ctx.proposal.Status {
		case model.ProposalStatusConfirmed:
			stage = model.BusinessFlowStageConstructionPartyPending
			for _, order := range ctx.orders {
				if order.OrderType == model.OrderTypeDesign && order.Status == model.OrderStatusPending {
					stage = model.BusinessFlowStageDesignFeePaying
					break
				}
			}
		case model.ProposalStatusRejected:
			stage = model.BusinessFlowStageNegotiating
		}
		return s.buildSyntheticSummary(stage)
	}
	if ctx.demand != nil {
		return s.buildSyntheticSummary(resolveDemandStage(ctx.demand))
	}
	if ctx.booking != nil {
		return s.buildSyntheticSummary(resolveBookingStage(ctx.booking))
	}
	return businessFlowSvc.BuildSummary(nil)
}

func (s *AdminBusinessFlowService) buildSyntheticSummary(stage string) BusinessFlowSummary {
	flow := &model.BusinessFlow{CurrentStage: stage}
	summary := businessFlowSvc.BuildSummary(flow)
	if strings.TrimSpace(summary.FlowSummary) != "" {
		return summary
	}
	flowSummary := map[string]string{
		model.BusinessFlowStageSurveyDepositPending:    "待支付量房费",
		model.BusinessFlowStageDesignQuotePending:      "待商家提交设计报价",
		model.BusinessFlowStageDesignFeePaying:         "设计费待支付，支付后进入下一阶段",
		model.BusinessFlowStageDesignDeliveryPending:   "待交付设计成果",
		model.BusinessFlowStageDesignAcceptancePending: "设计成果待验收",
		model.BusinessFlowStagePaymentPaused:           "分期待支付，施工推进已暂停",
		model.BusinessFlowStageNegotiating:             "预约已进入沟通中，待形成正式方案",
		model.BusinessFlowStageLeadPending:             "预约已进入平台，待进一步跟进",
	}
	actions := map[string][]string{
		model.BusinessFlowStageDesignPendingConfirmation: {"confirm_proposal", "reject_proposal"},
		model.BusinessFlowStageDesignFeePaying:           {},
		model.BusinessFlowStageConstructionPartyPending:  {"confirm_construction"},
		model.BusinessFlowStageConstructionQuotePending:  {"confirm_construction_quote", "reject_construction_quote"},
		model.BusinessFlowStageReadyToStart:              {"start_project"},
	}
	return BusinessFlowSummary{CurrentStage: stage, FlowSummary: flowSummary[stage], AvailableActions: actions[stage]}
}

func (s *AdminBusinessFlowService) resolveStageChangedAt(ctx *adminBusinessFlowContext) *time.Time {
	if ctx.flow != nil && ctx.flow.StageChangedAt != nil {
		return ctx.flow.StageChangedAt
	}
	candidates := make([]time.Time, 0, 8)
	appendCreatedAt := func(tm time.Time) {
		if !tm.IsZero() {
			candidates = append(candidates, tm)
		}
	}
	if ctx.booking != nil {
		appendCreatedAt(ctx.booking.UpdatedAt)
	}
	if ctx.demand != nil {
		appendCreatedAt(ctx.demand.UpdatedAt)
	}
	if ctx.proposal != nil {
		appendCreatedAt(ctx.proposal.UpdatedAt)
	}
	if ctx.quoteTask != nil {
		appendCreatedAt(ctx.quoteTask.UpdatedAt)
	}
	if ctx.project != nil {
		appendCreatedAt(ctx.project.UpdatedAt)
	}
	for _, order := range ctx.orders {
		appendCreatedAt(order.UpdatedAt)
	}
	for _, refund := range ctx.refundApplications {
		appendCreatedAt(refund.UpdatedAt)
	}
	if len(candidates) == 0 {
		return nil
	}
	sort.Slice(candidates, func(i, j int) bool { return candidates[i].After(candidates[j]) })
	latest := candidates[0]
	return &latest
}

func (s *AdminBusinessFlowService) resolveAvailableAdminActions(ctx *adminBusinessFlowContext) []AdminBusinessFlowAction {
	actions := make([]AdminBusinessFlowAction, 0)
	appendAction := func(action AdminBusinessFlowAction) {
		for _, existing := range actions {
			if existing.Key == action.Key && existing.APIPath == action.APIPath && existing.Route == action.Route {
				return
			}
		}
		actions = append(actions, action)
	}

	for _, key := range ctx.summary.AvailableActions {
		switch key {
		case "confirm_proposal":
			if ctx.proposal != nil {
				appendAction(AdminBusinessFlowAction{Key: key, Label: "方案确认", Kind: "mutation", Permission: "proposal:review", Method: "POST", APIPath: fmt.Sprintf("/admin/proposals/%d/confirm", ctx.proposal.ID), Payload: map[string]interface{}{"proposalId": ctx.proposal.ID}, RequiresReason: true})
			}
		case "reject_proposal":
			if ctx.proposal != nil {
				appendAction(AdminBusinessFlowAction{Key: key, Label: "方案驳回", Kind: "mutation", Permission: "proposal:review", Method: "POST", APIPath: fmt.Sprintf("/admin/proposals/%d/reject", ctx.proposal.ID), Payload: map[string]interface{}{"proposalId": ctx.proposal.ID}, Danger: true, RequiresReason: true})
			}
		case "confirm_construction_quote":
			if ctx.project != nil {
				payload := map[string]interface{}{"projectId": ctx.project.ID}
				if ctx.quoteTask != nil {
					payload["quoteTaskId"] = ctx.quoteTask.ID
				}
				if ctx.quoteSubmission != nil {
					payload["submissionId"] = ctx.quoteSubmission.ID
				}
				appendAction(AdminBusinessFlowAction{Key: key, Label: "施工报价确认", Kind: "mutation", Permission: "project:edit", Method: "POST", APIPath: fmt.Sprintf("/admin/projects/%d/construction/quote/confirm", ctx.project.ID), Payload: payload, RequiresReason: true})
			} else if ctx.quoteTask != nil {
				appendAction(AdminBusinessFlowAction{Key: key, Label: "施工报价确认", Kind: "navigate", Permission: "project:edit", Route: fmt.Sprintf("/projects/quotes/compare/%d", ctx.quoteTask.ID), Payload: map[string]interface{}{"quoteTaskId": ctx.quoteTask.ID}, RequiresReason: false})
			}
		case "reject_construction_quote":
			if ctx.quoteTask != nil {
				appendAction(AdminBusinessFlowAction{Key: key, Label: "施工报价处理", Kind: "navigate", Permission: "project:edit", Route: fmt.Sprintf("/projects/quotes/compare/%d", ctx.quoteTask.ID), Payload: map[string]interface{}{"quoteTaskId": ctx.quoteTask.ID}, Danger: true, RequiresReason: false})
			}
		case "start_project":
			if ctx.project != nil {
				appendAction(AdminBusinessFlowAction{Key: key, Label: "项目开始", Kind: "mutation", Permission: "project:edit", Method: "POST", APIPath: fmt.Sprintf("/admin/projects/%d/start", ctx.project.ID), Payload: map[string]interface{}{"projectId": ctx.project.ID}, RequiresReason: true})
			}
		case "approve_milestone":
			if milestone := currentSubmittedMilestone(ctx.milestones); milestone != nil && ctx.project != nil {
				appendAction(AdminBusinessFlowAction{Key: key, Label: "节点验收通过", Kind: "mutation", Permission: "project:edit", Method: "POST", APIPath: fmt.Sprintf("/admin/projects/%d/milestones/%d/approve", ctx.project.ID, milestone.ID), Payload: map[string]interface{}{"projectId": ctx.project.ID, "milestoneId": milestone.ID}, RequiresReason: true})
			}
		case "reject_milestone":
			if milestone := currentSubmittedMilestone(ctx.milestones); milestone != nil && ctx.project != nil {
				appendAction(AdminBusinessFlowAction{Key: key, Label: "节点验收驳回", Kind: "mutation", Permission: "project:edit", Method: "POST", APIPath: fmt.Sprintf("/admin/projects/%d/milestones/%d/reject", ctx.project.ID, milestone.ID), Payload: map[string]interface{}{"projectId": ctx.project.ID, "milestoneId": milestone.ID}, Danger: true, RequiresReason: true})
			}
		case "approve_completion":
			if ctx.project != nil {
				appendAction(AdminBusinessFlowAction{Key: key, Label: "完工通过", Kind: "mutation", Permission: "project:edit", Method: "POST", APIPath: fmt.Sprintf("/admin/projects/%d/completion/approve", ctx.project.ID), Payload: map[string]interface{}{"projectId": ctx.project.ID}, RequiresReason: true})
			}
		case "reject_completion":
			if ctx.project != nil {
				appendAction(AdminBusinessFlowAction{Key: key, Label: "完工驳回", Kind: "mutation", Permission: "project:edit", Method: "POST", APIPath: fmt.Sprintf("/admin/projects/%d/completion/reject", ctx.project.ID), Payload: map[string]interface{}{"projectId": ctx.project.ID}, Danger: true, RequiresReason: true})
			}
		case "submit_completion":
			if ctx.project != nil {
				appendAction(AdminBusinessFlowAction{Key: key, Label: "查看完工材料", Kind: "navigate", Permission: "project:view", Route: fmt.Sprintf("/projects/detail/%d", ctx.project.ID), Payload: map[string]interface{}{"projectId": ctx.project.ID}, RequiresReason: false})
			}
		}
	}

	if ctx.project != nil {
		if !hasConfirmedConstructionParty(ctx.project) {
			appendAction(AdminBusinessFlowAction{Key: "confirm_construction", Label: "施工方确认", Kind: "mutation", Permission: "project:edit", Method: "POST", APIPath: fmt.Sprintf("/admin/projects/%d/construction/confirm", ctx.project.ID), Payload: map[string]interface{}{"projectId": ctx.project.ID}, RequiresReason: true})
		}
		if ctx.project.BusinessStatus == model.ProjectBusinessStatusConstructionQuoteConfirmed {
			appendAction(AdminBusinessFlowAction{Key: "start_project", Label: "项目开始", Kind: "mutation", Permission: "project:edit", Method: "POST", APIPath: fmt.Sprintf("/admin/projects/%d/start", ctx.project.ID), Payload: map[string]interface{}{"projectId": ctx.project.ID}, RequiresReason: true})
		}
		if ctx.project.BusinessStatus == model.ProjectBusinessStatusInProgress && !isProjectPaused(ctx.project) {
			appendAction(AdminBusinessFlowAction{Key: "pause_project", Label: "项目暂停", Kind: "mutation", Permission: "project:edit", Method: "POST", APIPath: fmt.Sprintf("/admin/projects/%d/pause", ctx.project.ID), Payload: map[string]interface{}{"projectId": ctx.project.ID}, Danger: true, RequiresReason: true})
		}
		if isProjectPaused(ctx.project) {
			appendAction(AdminBusinessFlowAction{Key: "resume_project", Label: "项目恢复", Kind: "mutation", Permission: "project:edit", Method: "POST", APIPath: fmt.Sprintf("/admin/projects/%d/resume", ctx.project.ID), Payload: map[string]interface{}{"projectId": ctx.project.ID}, RequiresReason: true})
		}
	}

	if ctx.escrow != nil && ctx.project != nil {
		appendAction(AdminBusinessFlowAction{Key: "freeze_funds", Label: "资金冻结", Kind: "mutation", Permission: "finance:escrow:freeze", Method: "POST", APIPath: "/admin/finance/freeze", Payload: map[string]interface{}{"projectId": ctx.project.ID}, Danger: true, RequiresReason: true})
		appendAction(AdminBusinessFlowAction{Key: "unfreeze_funds", Label: "资金解冻", Kind: "mutation", Permission: "finance:escrow:unfreeze", Method: "POST", APIPath: "/admin/finance/unfreeze", Payload: map[string]interface{}{"projectId": ctx.project.ID}, RequiresReason: true})
		appendAction(AdminBusinessFlowAction{Key: "manual_release_funds", Label: "人工放款", Kind: "mutation", Permission: "finance:transaction:approve", Method: "POST", APIPath: "/admin/finance/manual-release", Payload: map[string]interface{}{"projectId": ctx.project.ID}, RequiresReason: true})
	}
	if len(ctx.refundApplications) > 0 {
		appendAction(AdminBusinessFlowAction{Key: "review_refund", Label: "退款审核入口", Kind: "navigate", Permission: "finance:transaction:view", Route: fmt.Sprintf("/refunds/%d", ctx.refundApplications[0].ID), Payload: map[string]interface{}{"refundApplicationId": ctx.refundApplications[0].ID}, RequiresReason: false})
	}
	if len(ctx.projectAudits) > 0 {
		appendAction(AdminBusinessFlowAction{Key: "handle_dispute", Label: "争议处理入口", Kind: "navigate", Permission: "risk:arbitration:list", Route: fmt.Sprintf("/project-audits/%d", ctx.projectAudits[0].ID), Payload: map[string]interface{}{"projectAuditId": ctx.projectAudits[0].ID}, RequiresReason: false})
	} else if ctx.project != nil && (len(ctx.arbitrations) > 0 || len(ctx.riskWarnings) > 0 || isProjectDisputed(ctx.project)) {
		appendAction(AdminBusinessFlowAction{Key: "handle_dispute", Label: "争议处理入口", Kind: "navigate", Permission: "risk:arbitration:list", Route: "/project-audits", Payload: map[string]interface{}{"projectId": ctx.project.ID}, RequiresReason: false})
	}

	return actions
}

func (ctx *adminBusinessFlowContext) toListItem() AdminBusinessFlowListItem {
	return AdminBusinessFlowListItem{
		FlowID:                ctx.flowID,
		SourceType:            ctx.sourceType,
		SourceID:              ctx.sourceID,
		CurrentStage:          ctx.summary.CurrentStage,
		FlowSummary:           ctx.summary.FlowSummary,
		OwnerUser:             ctx.owner,
		Provider:              ctx.provider,
		BookingID:             sourceBookingID(ctx),
		ProposalID:            sourceProposalID(ctx),
		QuoteTaskID:           sourceQuoteTaskID(ctx),
		ProjectID:             sourceProjectID(ctx),
		PrimaryOrderNo:        primaryOrderNo(ctx.orders),
		OrderStatus:           ctx.orderStatus,
		PaymentPlanStatus:     ctx.paymentPlanStatus,
		RefundStatus:          ctx.refundStatus,
		RiskStatus:            ctx.riskStatus,
		PaymentPaused:         ctx.paymentPaused,
		StageChangedAt:        ctx.stageChangedAt,
		AvailableAdminActions: ctx.availableAdminActions,
	}
}

func (ctx *adminBusinessFlowContext) toDetail() *AdminBusinessFlowDetail {
	orderSnapshots := make([]AdminBusinessFlowOrderSnapshot, 0, len(ctx.orders))
	for _, order := range ctx.orders {
		orderSnapshots = append(orderSnapshots, buildOrderSnapshot(order, ctx.paymentPlans))
	}
	return &AdminBusinessFlowDetail{
		FlowID:                  ctx.flowID,
		SourceType:              ctx.sourceType,
		SourceID:                ctx.sourceID,
		CurrentStage:            ctx.summary.CurrentStage,
		FlowSummary:             ctx.summary.FlowSummary,
		StageChangedAt:          ctx.stageChangedAt,
		OwnerUser:               ctx.owner,
		Provider:                ctx.provider,
		DesignerProvider:        ctx.designerProvider,
		ConstructionProvider:    ctx.constructionProvider,
		Booking:                 ctx.booking,
		Demand:                  ctx.demand,
		Proposal:                ctx.proposal,
		QuoteTask:               ctx.quoteTask,
		SelectedQuoteSubmission: ctx.quoteSubmission,
		Project:                 ctx.project,
		Milestones:              ctx.milestones,
		Orders:                  orderSnapshots,
		EscrowAccount:           ctx.escrow,
		Transactions:            ctx.transactions,
		RefundApplications:      ctx.refundApplications,
		ProjectAudits:           ctx.projectAudits,
		RiskWarnings:            ctx.riskWarnings,
		Arbitrations:            ctx.arbitrations,
		Risk:                    ctx.riskSnapshot,
		AuditLogs:               ctx.auditLogs,
		AvailableAdminActions:   ctx.availableAdminActions,
	}
}

func buildOrderSnapshot(order model.Order, paymentPlans []model.PaymentPlan) AdminBusinessFlowOrderSnapshot {
	plans := make([]model.PaymentPlan, 0)
	for _, plan := range paymentPlans {
		if plan.OrderID == order.ID {
			plans = append(plans, plan)
		}
	}
	return AdminBusinessFlowOrderSnapshot{
		ID:          order.ID,
		OrderNo:     order.OrderNo,
		OrderType:   order.OrderType,
		Status:      normalizeOrderStatus(order.Status),
		TotalAmount: order.TotalAmount,
		PaidAmount:  order.PaidAmount,
		Discount:    order.Discount,
		ProjectID:   order.ProjectID,
		ProposalID:  order.ProposalID,
		BookingID:   order.BookingID,
		ExpireAt:    order.ExpireAt,
		PaidAt:      order.PaidAt,
		PaymentPlan: plans,
	}
}

func loadUserActor(userID uint64, role string) *AdminBusinessFlowActor {
	if userID == 0 {
		return nil
	}
	var user model.User
	if err := repository.DB.First(&user, userID).Error; err != nil {
		return &AdminBusinessFlowActor{UserID: userID, DisplayName: fmt.Sprintf("用户#%d", userID), Role: role}
	}
	displayName := strings.TrimSpace(user.Nickname)
	if displayName == "" {
		displayName = strings.TrimSpace(user.Phone)
	}
	if displayName == "" {
		displayName = fmt.Sprintf("用户#%d", userID)
	}
	return &AdminBusinessFlowActor{UserID: userID, DisplayName: displayName, Phone: user.Phone, Role: role}
}

func loadProviderActor(providerID uint64, role string) *AdminBusinessFlowActor {
	if providerID == 0 {
		return nil
	}
	var provider model.Provider
	if err := repository.DB.First(&provider, providerID).Error; err != nil {
		return &AdminBusinessFlowActor{ProviderID: providerID, DisplayName: fmt.Sprintf("服务商#%d", providerID), Role: role}
	}
	var providerUser *model.User
	if provider.UserID > 0 {
		var user model.User
		if err := repository.DB.First(&user, provider.UserID).Error; err == nil {
			providerUser = &user
		}
	}
	actor := &AdminBusinessFlowActor{
		UserID:       provider.UserID,
		ProviderID:   provider.ID,
		DisplayName:  ResolveProviderDisplayName(provider, providerUser),
		ProviderType: provider.ProviderType,
		Role:         role,
	}
	if providerUser != nil {
		actor.Phone = providerUser.Phone
	}
	return actor
}

func choosePrimaryProviderActor(designer, construction *AdminBusinessFlowActor) *AdminBusinessFlowActor {
	if construction != nil {
		return construction
	}
	return designer
}

func summarizeOrderStatus(orders []model.Order) string {
	if len(orders) == 0 {
		return "none"
	}
	hasPending := false
	hasPaid := false
	hasRefunded := false
	hasCancelled := false
	for _, order := range orders {
		switch order.Status {
		case model.OrderStatusPending:
			hasPending = true
		case model.OrderStatusPaid:
			hasPaid = true
		case model.OrderStatusRefunded:
			hasRefunded = true
		case model.OrderStatusCancelled:
			hasCancelled = true
		}
	}
	switch {
	case hasPending:
		return "pending"
	case hasRefunded:
		return "refunded"
	case hasPaid && (hasCancelled || hasRefunded):
		return "mixed"
	case hasPaid:
		return "paid"
	case hasCancelled:
		return "cancelled"
	default:
		return normalizeOrderStatus(orders[0].Status)
	}
}

func summarizePaymentPlanStatus(paymentPlans []model.PaymentPlan) string {
	if len(paymentPlans) == 0 {
		return "none"
	}
	hasPending := false
	hasPaid := false
	hasOverdue := false
	now := time.Now()
	for _, plan := range paymentPlans {
		if plan.Status == 1 {
			hasPaid = true
			continue
		}
		hasPending = true
		if plan.DueAt != nil && plan.DueAt.Before(now) {
			hasOverdue = true
		}
	}
	switch {
	case hasOverdue:
		return "overdue"
	case hasPending && hasPaid:
		return "partial"
	case hasPending:
		return "pending"
	case hasPaid:
		return "paid"
	default:
		return "none"
	}
}

func summarizeRefundStatus(refunds []RefundApplicationView) string {
	if len(refunds) == 0 {
		return "none"
	}
	priority := map[string]int{
		model.RefundApplicationStatusPending:   5,
		model.RefundApplicationStatusApproved:  4,
		model.RefundApplicationStatusCompleted: 3,
		model.RefundApplicationStatusRejected:  2,
	}
	selected := "none"
	best := 0
	for _, refund := range refunds {
		status := strings.TrimSpace(refund.Status)
		if priority[status] > best {
			best = priority[status]
			selected = status
		}
	}
	return selected
}

func summarizeRiskSnapshot(ctx *adminBusinessFlowContext) *AdminBusinessFlowRiskSnapshot {
	snapshot := &AdminBusinessFlowRiskSnapshot{
		Status:        "normal",
		PaymentPaused: ctx.project != nil && ctx.project.PaymentPaused,
		PaymentPausedReason: func() string {
			if ctx.project != nil {
				return ctx.project.PaymentPausedReason
			}
			return ""
		}(),
		HasDispute:         ctx.project != nil && isProjectDisputed(ctx.project),
		HasOpenWarning:     false,
		HasOpenArbitration: false,
		HasOpenAudit:       false,
		HasPendingRefund:   summarizeRefundStatus(ctx.refundApplications) == model.RefundApplicationStatusPending,
		Summary:            "链路当前无高风险异常",
		WarningTypes:       make([]string, 0),
	}
	for _, warning := range ctx.riskWarnings {
		if warning.Status == 0 || warning.Status == 1 {
			snapshot.HasOpenWarning = true
			snapshot.WarningTypes = append(snapshot.WarningTypes, warning.Type)
		}
	}
	for _, arbitration := range ctx.arbitrations {
		if arbitration.Status == 0 || arbitration.Status == 1 {
			snapshot.HasOpenArbitration = true
		}
	}
	for _, audit := range ctx.projectAudits {
		if audit.Status == model.ProjectAuditStatusPending || audit.Status == model.ProjectAuditStatusInProgress {
			snapshot.HasOpenAudit = true
		}
	}
	switch {
	case snapshot.HasDispute || snapshot.HasOpenArbitration || snapshot.HasOpenAudit:
		snapshot.Status = "disputed"
		snapshot.Summary = "项目存在争议/仲裁/审计流程，需优先人工介入"
	case snapshot.PaymentPaused:
		snapshot.Status = "payment_paused"
		snapshot.Summary = coalesceString(strings.TrimSpace(snapshot.PaymentPausedReason), "存在待支付施工分期，施工推进暂停")
	case snapshot.HasPendingRefund:
		snapshot.Status = "refund_pending"
		snapshot.Summary = "存在待审核退款申请"
	case snapshot.HasOpenWarning:
		snapshot.Status = "warning"
		snapshot.Summary = "存在待处理风险预警"
	}
	return snapshot
}

func filterAuditLogs(logs []AdminAuditLogItem) []AdminAuditLogItem {
	if len(logs) == 0 {
		return logs
	}
	sort.SliceStable(logs, func(i, j int) bool { return logs[i].CreatedAt.After(logs[j].CreatedAt) })
	return logs
}

func matchesBusinessFlowFilter(ctx *adminBusinessFlowContext, item AdminBusinessFlowListItem, filter AdminBusinessFlowFilter) bool {
	if stage := strings.TrimSpace(filter.CurrentStage); stage != "" {
		if model.NormalizeBusinessFlowStage(item.CurrentStage) != model.NormalizeBusinessFlowStage(stage) {
			return false
		}
	}
	if filter.OwnerUserID > 0 {
		if item.OwnerUser == nil || item.OwnerUser.UserID != filter.OwnerUserID {
			return false
		}
	}
	if filter.ProviderID > 0 {
		matched := false
		for _, actor := range []*AdminBusinessFlowActor{ctx.provider, ctx.designerProvider, ctx.constructionProvider} {
			if actor != nil && actor.ProviderID == filter.ProviderID {
				matched = true
				break
			}
		}
		if !matched {
			return false
		}
	}
	if filter.BookingID > 0 && item.BookingID != filter.BookingID {
		return false
	}
	if filter.ProjectID > 0 && item.ProjectID != filter.ProjectID {
		return false
	}
	if filter.OrderStatus != "" && item.OrderStatus != strings.TrimSpace(filter.OrderStatus) {
		return false
	}
	if filter.PaymentPlanStatus != "" && item.PaymentPlanStatus != strings.TrimSpace(filter.PaymentPlanStatus) {
		return false
	}
	if filter.RefundStatus != "" && item.RefundStatus != strings.TrimSpace(filter.RefundStatus) {
		return false
	}
	if filter.RiskStatus != "" && item.RiskStatus != strings.TrimSpace(filter.RiskStatus) {
		return false
	}
	if filter.PaymentPaused != nil && item.PaymentPaused != *filter.PaymentPaused {
		return false
	}
	if keyword := strings.ToLower(strings.TrimSpace(filter.Keyword)); keyword != "" {
		if !matchesKeyword(ctx, item, keyword) {
			return false
		}
	}
	return true
}

func matchesKeyword(ctx *adminBusinessFlowContext, item AdminBusinessFlowListItem, keyword string) bool {
	candidates := make([]string, 0, 12)
	appendString := func(value string) {
		if strings.TrimSpace(value) != "" {
			candidates = append(candidates, strings.ToLower(strings.TrimSpace(value)))
		}
	}
	appendString(item.FlowSummary)
	appendString(item.PrimaryOrderNo)
	if item.OwnerUser != nil {
		appendString(item.OwnerUser.DisplayName)
		appendString(item.OwnerUser.Phone)
	}
	if item.Provider != nil {
		appendString(item.Provider.DisplayName)
		appendString(item.Provider.Phone)
	}
	if ctx.booking != nil {
		appendString(ctx.booking.Address)
		appendString(ctx.booking.Phone)
		appendString(strconv.FormatUint(ctx.booking.ID, 10))
	}
	if ctx.demand != nil {
		appendString(ctx.demand.Title)
		appendString(ctx.demand.Address)
		appendString(strconv.FormatUint(ctx.demand.ID, 10))
	}
	if ctx.project != nil {
		appendString(ctx.project.Name)
		appendString(ctx.project.Address)
		appendString(strconv.FormatUint(ctx.project.ID, 10))
	}
	if ctx.proposal != nil {
		appendString(strconv.FormatUint(ctx.proposal.ID, 10))
	}
	for _, candidate := range candidates {
		if strings.Contains(candidate, keyword) {
			return true
		}
	}
	return false
}

func buildFlowID(flow *model.BusinessFlow, sourceType string, sourceID uint64) string {
	if flow != nil && flow.ID > 0 {
		return strconv.FormatUint(flow.ID, 10)
	}
	return fmt.Sprintf("legacy-%s-%d", sourceType, sourceID)
}

func parseLegacyFlowID(flowID string) (string, uint64, bool) {
	parts := strings.Split(flowID, "-")
	if len(parts) != 3 || parts[0] != "legacy" {
		return "", 0, false
	}
	sourceID, err := strconv.ParseUint(parts[2], 10, 64)
	if err != nil || sourceID == 0 {
		return "", 0, false
	}
	return parts[1], sourceID, true
}

func sourceKey(sourceType string, sourceID uint64) string {
	return fmt.Sprintf("%s:%d", sourceType, sourceID)
}

func sourceBookingID(ctx *adminBusinessFlowContext) uint64 {
	if ctx.booking != nil {
		return ctx.booking.ID
	}
	if ctx.proposal != nil {
		return ctx.proposal.BookingID
	}
	for _, order := range ctx.orders {
		if order.BookingID > 0 {
			return order.BookingID
		}
	}
	return 0
}

func sourceProposalID(ctx *adminBusinessFlowContext) uint64 {
	if ctx.proposal != nil {
		return ctx.proposal.ID
	}
	if ctx.flow != nil {
		return ctx.flow.ConfirmedProposalID
	}
	return 0
}

func sourceQuoteTaskID(ctx *adminBusinessFlowContext) uint64 {
	if ctx.quoteTask != nil {
		return ctx.quoteTask.ID
	}
	if ctx.flow != nil {
		return ctx.flow.SelectedQuoteTaskID
	}
	return 0
}

func sourceProjectID(ctx *adminBusinessFlowContext) uint64 {
	if ctx.project != nil {
		return ctx.project.ID
	}
	if ctx.flow != nil {
		return ctx.flow.ProjectID
	}
	return 0
}

func primaryOrderNo(orders []model.Order) string {
	if len(orders) == 0 {
		return ""
	}
	preferred := []string{model.OrderTypeConstruction, model.OrderTypeDesign, model.OrderTypeMaterial}
	for _, orderType := range preferred {
		for _, order := range orders {
			if order.OrderType == orderType {
				return order.OrderNo
			}
		}
	}
	return orders[0].OrderNo
}

func currentSubmittedMilestone(milestones []model.Milestone) *model.Milestone {
	for i := range milestones {
		if milestones[i].Status == model.MilestoneStatusSubmitted {
			return &milestones[i]
		}
	}
	return nil
}

func milestoneIDs(milestones []model.Milestone) []uint64 {
	ids := make([]uint64, 0, len(milestones))
	for _, milestone := range milestones {
		ids = append(ids, milestone.ID)
	}
	return ids
}

func refundIDs(refunds []RefundApplicationView) []uint64 {
	ids := make([]uint64, 0, len(refunds))
	for _, refund := range refunds {
		ids = append(ids, refund.ID)
	}
	return ids
}

func projectAuditIDs(audits []ProjectAuditView) []uint64 {
	ids := make([]uint64, 0, len(audits))
	for _, audit := range audits {
		ids = append(ids, audit.ID)
	}
	return ids
}

func collectIDs(ids []uint64) []uint64 {
	result := make([]uint64, 0, len(ids))
	for _, id := range ids {
		if id > 0 {
			result = append(result, id)
		}
	}
	return result
}

func normalizeOrderStatus(status int8) string {
	switch status {
	case model.OrderStatusPending:
		return "pending"
	case model.OrderStatusPaid:
		return "paid"
	case model.OrderStatusCancelled:
		return "cancelled"
	case model.OrderStatusRefunded:
		return "refunded"
	default:
		return "unknown"
	}
}

func resolveDemandStage(demand *model.Demand) string {
	if demand == nil {
		return model.BusinessFlowStageLeadPending
	}
	switch demand.Status {
	case model.DemandStatusMatched:
		return model.BusinessFlowStageNegotiating
	case model.DemandStatusApproved, model.DemandStatusMatching:
		return model.BusinessFlowStageNegotiating
	case model.DemandStatusClosed:
		return model.BusinessFlowStageCancelled
	default:
		return model.BusinessFlowStageLeadPending
	}
}

func resolveBookingStage(booking *model.Booking) string {
	if booking == nil {
		return model.BusinessFlowStageLeadPending
	}
	if booking.IntentFeePaid || booking.SurveyDepositPaid {
		return model.BusinessFlowStageNegotiating
	}
	if booking.Status == 4 {
		return model.BusinessFlowStageCancelled
	}
	return model.BusinessFlowStageLeadPending
}

func coalesceString(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}
