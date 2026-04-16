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
	imgutil "home-decoration-server/internal/utils/image"
)

const (
	OrderCenterEntryKindPayable = "payable"
	OrderCenterEntryKindRefund  = "refund"
)

const (
	OrderCenterSourceSurveyDeposit = "survey_deposit"
	OrderCenterSourceDesignOrder   = "design_order"
	OrderCenterSourceConstruction  = "construction_order"
	OrderCenterSourceMaterial      = "material_order"
	OrderCenterSourceRefundRecord  = "refund_record"
	OrderCenterSourceMerchantBond  = "merchant_bond"
)

const (
	OrderCenterStatusPendingPayment = "pending_payment"
	OrderCenterStatusPaid           = "paid"
	OrderCenterStatusRefund         = "refund"
	OrderCenterStatusCancelled      = "cancelled"
)

type OrderCenterQuery struct {
	StatusGroup string
	EntryKind   string
	SourceKind  string
	Page        int
	PageSize    int
}

type OrderCenterProviderSummary struct {
	ID           uint64 `json:"id"`
	Name         string `json:"name"`
	ProviderType string `json:"providerType,omitempty"`
	Avatar       string `json:"avatar,omitempty"`
	Verified     bool   `json:"verified"`
}

type OrderCenterProjectSummary struct {
	ID                             uint64                   `json:"id"`
	Name                           string                   `json:"name"`
	Address                        string                   `json:"address,omitempty"`
	BusinessStage                  string                   `json:"businessStage,omitempty"`
	FlowSummary                    string                   `json:"flowSummary,omitempty"`
	BaselineStatus                 string                   `json:"baselineStatus,omitempty"`
	BaselineSubmittedAt            *time.Time               `json:"baselineSubmittedAt,omitempty"`
	ConstructionSubjectType        string                   `json:"constructionSubjectType,omitempty"`
	ConstructionSubjectID          uint64                   `json:"constructionSubjectId,omitempty"`
	ConstructionSubjectDisplayName string                   `json:"constructionSubjectDisplayName,omitempty"`
	KickoffStatus                  string                   `json:"kickoffStatus,omitempty"`
	PlannedStartDate               *time.Time               `json:"plannedStartDate,omitempty"`
	SupervisorSummary              *BridgeSupervisorSummary `json:"supervisorSummary,omitempty"`
	BridgeConversionSummary        *BridgeConversionSummary `json:"bridgeConversionSummary,omitempty"`
	ClosureSummary                 *ProjectClosureSummary   `json:"closureSummary,omitempty"`
	RiskSummary                    *ProjectRiskSummary      `json:"riskSummary,omitempty"`
}

type OrderCenterBookingSummary struct {
	ID                    uint64     `json:"id"`
	ProviderID            uint64     `json:"providerId,omitempty"`
	Address               string     `json:"address,omitempty"`
	PreferredDate         string     `json:"preferredDate,omitempty"`
	Status                int8       `json:"status"`
	IntentFee             float64    `json:"intentFee,omitempty"`
	SurveyDeposit         float64    `json:"surveyDeposit,omitempty"`
	SurveyDepositPaid     bool       `json:"surveyDepositPaid"`
	SurveyDepositPaidAt   *time.Time `json:"surveyDepositPaidAt,omitempty"`
	SurveyDepositRefunded bool       `json:"surveyDepositRefunded"`
	SurveyRefundNotice    string     `json:"surveyRefundNotice,omitempty"`
	ProposalID            uint64     `json:"proposalId,omitempty"`
	CreatedAt             *time.Time `json:"createdAt,omitempty"`
}

type OrderCenterPaymentPlanItem struct {
	ID            uint64     `json:"id"`
	OrderID       uint64     `json:"orderId"`
	Seq           int        `json:"seq"`
	Name          string     `json:"name"`
	Amount        float64    `json:"amount"`
	DueAt         *time.Time `json:"dueAt,omitempty"`
	ActivatedAt   *time.Time `json:"activatedAt,omitempty"`
	ExpiresAt     *time.Time `json:"expiresAt,omitempty"`
	Status        string     `json:"status"`
	PaidAt        *time.Time `json:"paidAt,omitempty"`
	PlanType      string     `json:"planType,omitempty"`
	Payable       bool       `json:"payable"`
	PayableReason string     `json:"payableReason,omitempty"`
}

type OrderCenterTimelineItem struct {
	Title       string     `json:"title"`
	Description string     `json:"description,omitempty"`
	Status      string     `json:"status,omitempty"`
	At          *time.Time `json:"at,omitempty"`
}

type OrderCenterDescriptionSectionItem struct {
	Label string `json:"label"`
	Value string `json:"value"`
}

type OrderCenterDescriptionSection struct {
	Key   string                              `json:"key"`
	Title string                              `json:"title"`
	Items []OrderCenterDescriptionSectionItem `json:"items,omitempty"`
}

type OrderCenterOrderRecord struct {
	ID          uint64     `json:"id"`
	OrderNo     string     `json:"orderNo"`
	OrderType   string     `json:"orderType"`
	Status      int8       `json:"status"`
	TotalAmount float64    `json:"totalAmount"`
	PaidAmount  float64    `json:"paidAmount"`
	Discount    float64    `json:"discount"`
	ExpireAt    *time.Time `json:"expireAt,omitempty"`
	PaidAt      *time.Time `json:"paidAt,omitempty"`
	CreatedAt   time.Time  `json:"createdAt"`
	BookingID   uint64     `json:"bookingId,omitempty"`
	ProposalID  uint64     `json:"proposalId,omitempty"`
	ProjectID   uint64     `json:"projectId,omitempty"`
}

type OrderCenterEntrySummary struct {
	EntryKey                string                       `json:"entryKey"`
	EntryKind               string                       `json:"entryKind"`
	SourceKind              string                       `json:"sourceKind"`
	StatusGroup             string                       `json:"statusGroup"`
	StatusText              string                       `json:"statusText"`
	Title                   string                       `json:"title"`
	Subtitle                string                       `json:"subtitle,omitempty"`
	ReferenceNo             string                       `json:"referenceNo,omitempty"`
	Amount                  float64                      `json:"amount"`
	PayableAmount           float64                      `json:"payableAmount"`
	CreatedAt               *time.Time                   `json:"createdAt,omitempty"`
	ExpireAt                *time.Time                   `json:"expireAt,omitempty"`
	Provider                *OrderCenterProviderSummary  `json:"provider,omitempty"`
	Project                 *OrderCenterProjectSummary   `json:"project,omitempty"`
	Booking                 *OrderCenterBookingSummary   `json:"booking,omitempty"`
	AvailablePaymentOptions []SurveyDepositPaymentOption `json:"availablePaymentOptions,omitempty"`
	CanCancel               bool                         `json:"canCancel"`
}

type OrderCenterEntryDetail struct {
	OrderCenterEntrySummary
	BusinessStage                  string                          `json:"businessStage,omitempty"`
	FlowSummary                    string                          `json:"flowSummary,omitempty"`
	BaselineStatus                 string                          `json:"baselineStatus,omitempty"`
	BaselineSubmittedAt            *time.Time                      `json:"baselineSubmittedAt,omitempty"`
	ConstructionSubjectType        string                          `json:"constructionSubjectType,omitempty"`
	ConstructionSubjectID          uint64                          `json:"constructionSubjectId,omitempty"`
	ConstructionSubjectDisplayName string                          `json:"constructionSubjectDisplayName,omitempty"`
	KickoffStatus                  string                          `json:"kickoffStatus,omitempty"`
	PlannedStartDate               *time.Time                      `json:"plannedStartDate,omitempty"`
	SupervisorSummary              *BridgeSupervisorSummary        `json:"supervisorSummary,omitempty"`
	BridgeConversionSummary        *BridgeConversionSummary        `json:"bridgeConversionSummary,omitempty"`
	ClosureSummary                 *ProjectClosureSummary          `json:"closureSummary,omitempty"`
	DescriptionSections            []OrderCenterDescriptionSection `json:"descriptionSections,omitempty"`
	PaymentPlans                   []OrderCenterPaymentPlanItem    `json:"paymentPlans,omitempty"`
	NextPayablePlan                *OrderCenterPaymentPlanItem     `json:"nextPayablePlan,omitempty"`
	RefundSummary                  *BookingRefundSummary           `json:"refundSummary,omitempty"`
	Timeline                       []OrderCenterTimelineItem       `json:"timeline,omitempty"`
	LegacyActionPath               string                          `json:"legacyActionPath,omitempty"`
	Order                          *OrderCenterOrderRecord         `json:"order,omitempty"`
}

type orderCenterSource interface {
	Kind() string
	VisibleToUser() bool
	ListEntriesForUser(userID uint64, statusGroup string) ([]OrderCenterEntrySummary, error)
	GetEntryDetailForUser(userID, primaryID uint64) (*OrderCenterEntryDetail, error)
	StartPaymentForUser(userID, primaryID uint64, channel, terminalType string) (*PaymentLaunchResponse, error)
	CancelEntryForUser(userID, primaryID uint64) error
}

type OrderCenterService struct {
	paymentService *PaymentService
	orderService   *OrderService
	refundService  *RefundApplicationService
	sources        map[string]orderCenterSource
	visibleKinds   []string
}

func NewOrderCenterService(paymentSvc *PaymentService) *OrderCenterService {
	svc := &OrderCenterService{
		paymentService: paymentSvc,
		orderService:   &OrderService{},
		refundService:  &RefundApplicationService{},
		sources:        make(map[string]orderCenterSource),
	}
	svc.register(&surveyDepositOrderCenterSource{baseOrderCenterSource{svc: svc}})
	svc.register(&businessOrderCenterSource{baseOrderCenterSource: baseOrderCenterSource{svc: svc}, sourceKind: OrderCenterSourceDesignOrder, orderType: model.OrderTypeDesign})
	svc.register(&businessOrderCenterSource{baseOrderCenterSource: baseOrderCenterSource{svc: svc}, sourceKind: OrderCenterSourceConstruction, orderType: model.OrderTypeConstruction})
	svc.register(&businessOrderCenterSource{baseOrderCenterSource: baseOrderCenterSource{svc: svc}, sourceKind: OrderCenterSourceMaterial, orderType: model.OrderTypeMaterial})
	svc.register(&refundOrderCenterSource{baseOrderCenterSource{svc: svc}})
	return svc
}

func (s *OrderCenterService) register(source orderCenterSource) {
	if source == nil {
		return
	}
	s.sources[source.Kind()] = source
	if source.VisibleToUser() {
		s.visibleKinds = append(s.visibleKinds, source.Kind())
	}
}

func (s *OrderCenterService) ListEntriesForUser(userID uint64, query OrderCenterQuery) ([]OrderCenterEntrySummary, int64, error) {
	if userID == 0 {
		return nil, 0, errors.New("无效用户")
	}
	page := query.Page
	if page <= 0 {
		page = 1
	}
	pageSize := query.PageSize
	if pageSize <= 0 {
		pageSize = 10
	}

	kinds := s.visibleKinds
	if strings.TrimSpace(query.SourceKind) != "" {
		kinds = []string{strings.TrimSpace(query.SourceKind)}
	}

	aggregated := make([]OrderCenterEntrySummary, 0)
	for _, kind := range kinds {
		source, ok := s.sources[kind]
		if !ok || source == nil || !source.VisibleToUser() {
			continue
		}
		entries, err := source.ListEntriesForUser(userID, strings.TrimSpace(query.StatusGroup))
		if err != nil {
			return nil, 0, err
		}
		for _, entry := range entries {
			if query.EntryKind != "" && entry.EntryKind != query.EntryKind {
				continue
			}
			aggregated = append(aggregated, entry)
		}
	}

	sort.SliceStable(aggregated, func(i, j int) bool {
		return orderCenterSortTime(aggregated[i]).After(orderCenterSortTime(aggregated[j]))
	})

	total := int64(len(aggregated))
	start := (page - 1) * pageSize
	if start >= len(aggregated) {
		return []OrderCenterEntrySummary{}, total, nil
	}
	end := start + pageSize
	if end > len(aggregated) {
		end = len(aggregated)
	}
	return aggregated[start:end], total, nil
}

func (s *OrderCenterService) GetEntryDetailForUser(userID uint64, entryKey string) (*OrderCenterEntryDetail, error) {
	source, primaryID, err := s.parseSource(entryKey)
	if err != nil {
		return nil, err
	}
	return source.GetEntryDetailForUser(userID, primaryID)
}

func (s *OrderCenterService) StartEntryPaymentForUser(userID uint64, entryKey, channel, terminalType string) (*PaymentLaunchResponse, error) {
	source, primaryID, err := s.parseSource(entryKey)
	if err != nil {
		return nil, err
	}
	return source.StartPaymentForUser(userID, primaryID, channel, terminalType)
}

func (s *OrderCenterService) CancelEntryForUser(userID uint64, entryKey string) error {
	source, primaryID, err := s.parseSource(entryKey)
	if err != nil {
		return err
	}
	return source.CancelEntryForUser(userID, primaryID)
}

func (s *OrderCenterService) parseSource(entryKey string) (orderCenterSource, uint64, error) {
	parts := strings.SplitN(strings.TrimSpace(entryKey), ":", 2)
	if len(parts) != 2 || strings.TrimSpace(parts[0]) == "" || strings.TrimSpace(parts[1]) == "" {
		return nil, 0, errors.New("无效订单中心条目")
	}
	source, ok := s.sources[strings.TrimSpace(parts[0])]
	if !ok || source == nil || !source.VisibleToUser() {
		return nil, 0, errors.New("订单中心条目不存在")
	}
	primaryID, err := strconv.ParseUint(strings.TrimSpace(parts[1]), 10, 64)
	if err != nil || primaryID == 0 {
		return nil, 0, errors.New("订单中心条目不存在")
	}
	return source, primaryID, nil
}

func (s *OrderCenterService) entryKey(sourceKind string, primaryID uint64) string {
	return fmt.Sprintf("%s:%d", strings.TrimSpace(sourceKind), primaryID)
}

type baseOrderCenterSource struct {
	svc *OrderCenterService
}

func (b baseOrderCenterSource) VisibleToUser() bool {
	return true
}

func (b baseOrderCenterSource) providerSummary(providerID uint64) (*OrderCenterProviderSummary, error) {
	if providerID == 0 {
		return nil, nil
	}
	var provider model.Provider
	if err := repository.DB.First(&provider, providerID).Error; err != nil {
		return nil, err
	}
	var user model.User
	_ = repository.DB.First(&user, provider.UserID).Error
	return &OrderCenterProviderSummary{
		ID:           provider.ID,
		Name:         ResolveProviderDisplayName(provider, &user),
		ProviderType: orderCenterProviderType(provider.ProviderType, provider.SubType),
		Avatar:       imgutil.GetFullImageURL(ResolveProviderAvatarPathWithUser(provider, &user)),
		Verified:     provider.Verified,
	}, nil
}

func (b baseOrderCenterSource) bookingSummary(booking *model.Booking, proposalID uint64) *OrderCenterBookingSummary {
	if booking == nil || booking.ID == 0 {
		return nil
	}
	createdAt := booking.CreatedAt
	return &OrderCenterBookingSummary{
		ID:                    booking.ID,
		ProviderID:            booking.ProviderID,
		Address:               booking.Address,
		PreferredDate:         booking.PreferredDate,
		Status:                booking.Status,
		IntentFee:             booking.IntentFee,
		SurveyDeposit:         booking.SurveyDeposit,
		SurveyDepositPaid:     booking.SurveyDepositPaid,
		SurveyDepositPaidAt:   booking.SurveyDepositPaidAt,
		SurveyDepositRefunded: booking.SurveyDepositRefunded,
		SurveyRefundNotice:    booking.SurveyRefundNotice,
		ProposalID:            proposalID,
		CreatedAt:             &createdAt,
	}
}

func (b baseOrderCenterSource) projectSummary(project *ProjectDetail) *OrderCenterProjectSummary {
	if project == nil {
		return nil
	}
	return &OrderCenterProjectSummary{
		ID:                             project.ID,
		Name:                           project.Name,
		Address:                        project.Address,
		BusinessStage:                  project.BusinessStage,
		FlowSummary:                    project.FlowSummary,
		BaselineStatus:                 project.BaselineStatus,
		BaselineSubmittedAt:            project.BaselineSubmittedAt,
		ConstructionSubjectType:        project.ConstructionSubjectType,
		ConstructionSubjectID:          project.ConstructionSubjectID,
		ConstructionSubjectDisplayName: project.ConstructionSubjectDisplayName,
		KickoffStatus:                  project.KickoffStatus,
		PlannedStartDate:               project.PlannedStartDate,
		SupervisorSummary:              project.SupervisorSummary,
		BridgeConversionSummary:        project.BridgeConversionSummary,
		ClosureSummary:                 project.ClosureSummary,
		RiskSummary:                    project.RiskSummary,
	}
}

func (b baseOrderCenterSource) orderRecord(order *model.Order) *OrderCenterOrderRecord {
	if order == nil || order.ID == 0 {
		return nil
	}
	return &OrderCenterOrderRecord{
		ID:          order.ID,
		OrderNo:     order.OrderNo,
		OrderType:   order.OrderType,
		Status:      order.Status,
		TotalAmount: order.TotalAmount,
		PaidAmount:  order.PaidAmount,
		Discount:    order.Discount,
		ExpireAt:    order.ExpireAt,
		PaidAt:      order.PaidAt,
		CreatedAt:   order.CreatedAt,
		BookingID:   order.BookingID,
		ProposalID:  order.ProposalID,
		ProjectID:   order.ProjectID,
	}
}

func (b baseOrderCenterSource) nextPayablePlan(orderID uint64) (*OrderCenterPaymentPlanItem, []OrderCenterPaymentPlanItem, error) {
	if orderID == 0 {
		return nil, nil, nil
	}
	plans, err := b.svc.orderService.GetPaymentPlansByOrder(orderID)
	if err != nil {
		return nil, nil, err
	}
	items := make([]OrderCenterPaymentPlanItem, 0, len(plans))
	var nextPlan *OrderCenterPaymentPlanItem
	for _, plan := range plans {
		item := mapPaymentPlanItem(plan)
		items = append(items, item)
		if nextPlan == nil && item.Payable {
			copyItem := item
			nextPlan = &copyItem
		}
	}
	return nextPlan, items, nil
}

func (b baseOrderCenterSource) bookingProposalID(bookingID uint64) uint64 {
	if bookingID == 0 {
		return 0
	}
	var proposal model.Proposal
	if err := repository.DB.Where("booking_id = ?", bookingID).Order("id DESC").First(&proposal).Error; err == nil {
		return proposal.ID
	}
	return 0
}

func (b baseOrderCenterSource) orderProjectDetail(projectID, userID uint64) *ProjectDetail {
	if projectID == 0 || userID == 0 {
		return nil
	}
	project, err := (&ProjectService{}).GetProjectDetailForOwner(projectID, userID)
	if err != nil {
		return nil
	}
	return project
}

func (b baseOrderCenterSource) flowForBooking(bookingID uint64) (string, string, []string) {
	if bookingID == 0 {
		return "", "", nil
	}
	p0Summary, err := (&BookingService{}).GetBookingP0Summary(bookingID)
	if err != nil || p0Summary == nil {
		return "", "", nil
	}
	return p0Summary.CurrentStage, p0Summary.FlowSummary, p0Summary.AvailableActions
}

type surveyDepositOrderCenterSource struct {
	baseOrderCenterSource
}

func (s *surveyDepositOrderCenterSource) Kind() string {
	return OrderCenterSourceSurveyDeposit
}

func (s *surveyDepositOrderCenterSource) ListEntriesForUser(userID uint64, statusGroup string) ([]OrderCenterEntrySummary, error) {
	var bookings []model.Booking
	if err := repository.DB.Where("user_id = ?", userID).Order("created_at DESC").Find(&bookings).Error; err != nil {
		return nil, err
	}
	result := make([]OrderCenterEntrySummary, 0)
	for i := range bookings {
		entry, ok, err := s.buildSummaryForBooking(userID, &bookings[i], statusGroup)
		if err != nil {
			return nil, err
		}
		if ok {
			result = append(result, entry)
		}
	}
	return result, nil
}

func (s *surveyDepositOrderCenterSource) GetEntryDetailForUser(userID, primaryID uint64) (*OrderCenterEntryDetail, error) {
	var booking model.Booking
	if err := repository.DB.First(&booking, primaryID).Error; err != nil {
		return nil, errors.New("量房费订单不存在")
	}
	if booking.UserID != userID {
		return nil, errors.New("无权查看此订单")
	}
	summary, ok, err := s.buildSummaryForBooking(userID, &booking, "")
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, errors.New("量房费订单不存在")
	}
	refundSummary, _ := s.svc.refundService.BuildBookingRefundSummary(booking.ID)
	businessStage, flowSummary, _ := s.flowForBooking(booking.ID)
	project := s.loadProjectByBooking(userID, booking.ID)
	bridgeSummary := BuildBridgeReadModelByBookingID(booking.ID)
	proposalID := s.bookingProposalID(booking.ID)
	detail := &OrderCenterEntryDetail{
		OrderCenterEntrySummary:        summary,
		BusinessStage:                  businessStage,
		FlowSummary:                    flowSummary,
		BaselineStatus:                 bridgeSummary.BaselineStatus,
		BaselineSubmittedAt:            bridgeSummary.BaselineSubmittedAt,
		ConstructionSubjectType:        bridgeSummary.ConstructionSubjectType,
		ConstructionSubjectID:          bridgeSummary.ConstructionSubjectID,
		ConstructionSubjectDisplayName: bridgeSummary.ConstructionSubjectDisplayName,
		KickoffStatus:                  bridgeSummary.KickoffStatus,
		PlannedStartDate:               bridgeSummary.PlannedStartDate,
		SupervisorSummary:              bridgeSummary.SupervisorSummary,
		RefundSummary:                  refundSummary,
		LegacyActionPath:               fmt.Sprintf("/bookings/%d", booking.ID),
	}
	detail.Project = s.projectSummary(project)
	detail.Booking = s.bookingSummary(&booking, proposalID)
	detail.DescriptionSections = []OrderCenterDescriptionSection{
		{
			Key:   "order_info",
			Title: "订单信息",
			Items: []OrderCenterDescriptionSectionItem{
				{Label: "订单编号", Value: summary.ReferenceNo},
				{Label: "预约量房时间", Value: safeStringOrDash(booking.PreferredDate)},
				{Label: "项目地址", Value: safeStringOrDash(booking.Address)},
			},
		},
		{
			Key:   "service_info",
			Title: "服务进展",
			Items: []OrderCenterDescriptionSectionItem{
				{Label: "当前阶段", Value: safeStringOrDash(resolveBusinessStageText(businessStage))},
				{Label: "进度说明", Value: safeStringOrDash(flowSummary)},
			},
		},
	}
	detail.Timeline = buildSurveyDepositTimeline(&booking, refundSummary)
	return detail, nil
}

func (s *surveyDepositOrderCenterSource) StartPaymentForUser(userID, primaryID uint64, channel, terminalType string) (*PaymentLaunchResponse, error) {
	return s.svc.paymentService.StartSurveyDepositPayment(userID, primaryID, channel, terminalType)
}

func (s *surveyDepositOrderCenterSource) CancelEntryForUser(userID, primaryID uint64) error {
	return (&BookingService{}).CancelBooking(userID, strconv.FormatUint(primaryID, 10))
}

func (s *surveyDepositOrderCenterSource) buildSummaryForBooking(userID uint64, booking *model.Booking, statusGroup string) (OrderCenterEntrySummary, bool, error) {
	if booking == nil || booking.ID == 0 {
		return OrderCenterEntrySummary{}, false, nil
	}
	amount := surveyDepositAmount(booking)
	if amount <= 0 {
		return OrderCenterEntrySummary{}, false, nil
	}
	entryStatusGroup, statusText := resolveSurveyDepositStatus(booking)
	if entryStatusGroup == "" {
		return OrderCenterEntrySummary{}, false, nil
	}
	if statusGroup != "" && entryStatusGroup != statusGroup {
		return OrderCenterEntrySummary{}, false, nil
	}
	provider, err := s.providerSummary(booking.ProviderID)
	if err != nil {
		return OrderCenterEntrySummary{}, false, err
	}
	project := s.loadProjectByBooking(userID, booking.ID)
	proposalID := s.bookingProposalID(booking.ID)
	payableAmount := 0.0
	if entryStatusGroup == OrderCenterStatusPendingPayment {
		payableAmount = amount
	}
	createdAt := booking.CreatedAt
	return OrderCenterEntrySummary{
		EntryKey:                s.svc.entryKey(s.Kind(), booking.ID),
		EntryKind:               OrderCenterEntryKindPayable,
		SourceKind:              s.Kind(),
		StatusGroup:             entryStatusGroup,
		StatusText:              statusText,
		Title:                   "量房费",
		Subtitle:                formatSurveyDepositReferenceNo(booking.ID),
		ReferenceNo:             formatSurveyDepositReferenceNo(booking.ID),
		Amount:                  amount,
		PayableAmount:           payableAmount,
		CreatedAt:               &createdAt,
		Provider:                provider,
		Project:                 s.projectSummary(project),
		Booking:                 s.bookingSummary(booking, proposalID),
		AvailablePaymentOptions: s.svc.paymentService.GetSurveyDepositPaymentOptions(booking),
		CanCancel:               canCancelSurveyDepositBooking(booking),
	}, true, nil
}

func (s *surveyDepositOrderCenterSource) loadProjectByBooking(userID, bookingID uint64) *ProjectDetail {
	project, err := findProjectByBookingTx(repository.DB, bookingID)
	if err != nil || project == nil || project.ID == 0 {
		return nil
	}
	return s.orderProjectDetail(project.ID, userID)
}

type businessOrderCenterSource struct {
	baseOrderCenterSource
	sourceKind string
	orderType  string
}

func (s *businessOrderCenterSource) Kind() string {
	return s.sourceKind
}

func (s *businessOrderCenterSource) ListEntriesForUser(userID uint64, statusGroup string) ([]OrderCenterEntrySummary, error) {
	orders, err := s.listOrdersForUser(userID)
	if err != nil {
		return nil, err
	}
	result := make([]OrderCenterEntrySummary, 0, len(orders))
	for i := range orders {
		entry, ok, err := s.buildSummaryForOrder(userID, &orders[i], statusGroup)
		if err != nil {
			return nil, err
		}
		if ok {
			result = append(result, entry)
		}
	}
	return result, nil
}

func (s *businessOrderCenterSource) GetEntryDetailForUser(userID, primaryID uint64) (*OrderCenterEntryDetail, error) {
	order, err := s.svc.orderService.GetOrderForUser(userID, primaryID)
	if err != nil {
		return nil, err
	}
	if order.OrderType != s.orderType {
		return nil, errors.New("订单不存在")
	}
	summary, ok, err := s.buildSummaryForOrder(userID, order, "")
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, errors.New("订单不存在")
	}
	var booking *model.Booking
	var projectDetail *ProjectDetail
	if order.BookingID > 0 {
		booking = &model.Booking{}
		if dbErr := repository.DB.First(booking, order.BookingID).Error; dbErr != nil {
			booking = nil
		}
	}
	if order.ProjectID > 0 {
		projectDetail = s.orderProjectDetail(order.ProjectID, userID)
	}
	var refundSummary *BookingRefundSummary
	proposalID := order.ProposalID
	if booking != nil {
		refundSummary, _ = s.svc.refundService.BuildBookingRefundSummary(booking.ID)
		if proposalID == 0 {
			proposalID = s.bookingProposalID(booking.ID)
		}
	}
	nextPlan, plans, err := s.nextPayablePlan(order.ID)
	if err != nil {
		return nil, err
	}
	detail := &OrderCenterEntryDetail{
		OrderCenterEntrySummary: summary,
		Order:                   s.orderRecord(order),
		RefundSummary:           refundSummary,
		PaymentPlans:            plans,
		NextPayablePlan:         nextPlan,
		LegacyActionPath:        fmt.Sprintf("/orders/%d", order.ID),
	}
	detail.Project = s.projectSummary(projectDetail)
	if booking != nil {
		detail.Booking = s.bookingSummary(booking, proposalID)
	}
	if projectDetail != nil {
		detail.BusinessStage = projectDetail.BusinessStage
		detail.FlowSummary = projectDetail.FlowSummary
		detail.BaselineStatus = projectDetail.BaselineStatus
		detail.BaselineSubmittedAt = projectDetail.BaselineSubmittedAt
		detail.ConstructionSubjectType = projectDetail.ConstructionSubjectType
		detail.ConstructionSubjectID = projectDetail.ConstructionSubjectID
		detail.ConstructionSubjectDisplayName = projectDetail.ConstructionSubjectDisplayName
		detail.KickoffStatus = projectDetail.KickoffStatus
		detail.PlannedStartDate = projectDetail.PlannedStartDate
		detail.SupervisorSummary = projectDetail.SupervisorSummary
		detail.BridgeConversionSummary = projectDetail.BridgeConversionSummary
		detail.ClosureSummary = projectDetail.ClosureSummary
	}
	detail.DescriptionSections = buildBusinessOrderSections(order, detail, nextPlan)
	detail.Timeline = buildBusinessOrderTimeline(order, nextPlan)
	return detail, nil
}

func (s *businessOrderCenterSource) StartPaymentForUser(userID, primaryID uint64, channel, terminalType string) (*PaymentLaunchResponse, error) {
	order, err := s.svc.orderService.GetOrderForUser(userID, primaryID)
	if err != nil {
		return nil, err
	}
	if order.OrderType != s.orderType {
		return nil, errors.New("订单不存在")
	}
	if order.OrderType == model.OrderTypeConstruction {
		if nextPlan, _, err := s.nextPayablePlan(order.ID); err == nil && nextPlan != nil {
			return s.svc.paymentService.StartPaymentPlanPayment(userID, nextPlan.ID, channel, terminalType)
		}
	}
	return s.svc.paymentService.StartOrderPayment(userID, primaryID, channel, terminalType)
}

func (s *businessOrderCenterSource) CancelEntryForUser(userID, primaryID uint64) error {
	return s.svc.orderService.CancelOrder(userID, primaryID)
}

func (s *businessOrderCenterSource) listOrdersForUser(userID uint64) ([]model.Order, error) {
	var bookingIDs []uint64
	if err := repository.DB.Model(&model.Booking{}).Where("user_id = ?", userID).Pluck("id", &bookingIDs).Error; err != nil {
		return nil, err
	}
	var projectIDs []uint64
	if err := repository.DB.Model(&model.Project{}).Where("owner_id = ?", userID).Pluck("id", &projectIDs).Error; err != nil {
		return nil, err
	}
	var proposalIDs []uint64
	if len(bookingIDs) > 0 {
		if err := repository.DB.Model(&model.Proposal{}).Where("booking_id IN ?", bookingIDs).Pluck("id", &proposalIDs).Error; err != nil {
			return nil, err
		}
	}
	query := repository.DB.Model(&model.Order{}).Where("order_type = ?", s.orderType)
	switch {
	case len(bookingIDs) > 0 && len(projectIDs) > 0 && len(proposalIDs) > 0:
		query = query.Where("booking_id IN ? OR project_id IN ? OR proposal_id IN ?", bookingIDs, projectIDs, proposalIDs)
	case len(bookingIDs) > 0 && len(projectIDs) > 0:
		query = query.Where("booking_id IN ? OR project_id IN ?", bookingIDs, projectIDs)
	case len(bookingIDs) > 0 && len(proposalIDs) > 0:
		query = query.Where("booking_id IN ? OR proposal_id IN ?", bookingIDs, proposalIDs)
	case len(projectIDs) > 0 && len(proposalIDs) > 0:
		query = query.Where("project_id IN ? OR proposal_id IN ?", projectIDs, proposalIDs)
	case len(bookingIDs) > 0:
		query = query.Where("booking_id IN ?", bookingIDs)
	case len(projectIDs) > 0:
		query = query.Where("project_id IN ?", projectIDs)
	case len(proposalIDs) > 0:
		query = query.Where("proposal_id IN ?", proposalIDs)
	default:
		return []model.Order{}, nil
	}
	var orders []model.Order
	if err := query.Order("created_at DESC").Find(&orders).Error; err != nil {
		return nil, err
	}
	return orders, nil
}

func (s *businessOrderCenterSource) buildSummaryForOrder(userID uint64, order *model.Order, statusGroup string) (OrderCenterEntrySummary, bool, error) {
	if order == nil || order.ID == 0 {
		return OrderCenterEntrySummary{}, false, nil
	}
	entryStatusGroup, statusText := resolveBusinessOrderStatus(order.Status)
	if entryStatusGroup == "" {
		return OrderCenterEntrySummary{}, false, nil
	}
	if statusGroup != "" && entryStatusGroup != statusGroup {
		return OrderCenterEntrySummary{}, false, nil
	}
	providerName, address, err := s.svc.orderService.resolveOrderContext(order)
	if err != nil {
		return OrderCenterEntrySummary{}, false, err
	}
	_ = address
	var booking *model.Booking
	if order.BookingID > 0 {
		booking = &model.Booking{}
		if dbErr := repository.DB.First(booking, order.BookingID).Error; dbErr != nil {
			booking = nil
		}
	}
	project := s.orderProjectDetail(order.ProjectID, userID)
	proposalID := order.ProposalID
	if proposalID == 0 && booking != nil {
		proposalID = s.bookingProposalID(booking.ID)
	}
	payableAmount := normalizeAmount(order.TotalAmount - order.Discount - order.PaidAmount)
	var expireAt *time.Time = order.ExpireAt
	availablePaymentOptions := []SurveyDepositPaymentOption(nil)
	canCancel := false
	if order.OrderType == model.OrderTypeConstruction {
		nextPlan, plans, nextErr := s.nextPayablePlan(order.ID)
		if nextErr == nil && nextPlan != nil {
			payableAmount = nextPlan.Amount
			expireAt = nextPlan.DueAt
			availablePaymentOptions = s.svc.paymentService.GetOrderCenterPaymentOptions()
		}
		if nextErr == nil {
			canCancel = canCancelConstructionOrder(order, plans)
		}
	} else if entryStatusGroup == OrderCenterStatusPendingPayment {
		availablePaymentOptions = s.svc.paymentService.GetOrderCenterPaymentOptions()
		canCancel = true
	}
	if payableAmount < 0 {
		payableAmount = 0
	}
	provider := &OrderCenterProviderSummary{Name: providerName}
	if project != nil && project.ProviderID > 0 {
		provider, _ = s.providerSummary(project.ProviderID)
	} else if booking != nil && booking.ProviderID > 0 {
		provider, _ = s.providerSummary(booking.ProviderID)
	}
	if provider == nil && providerName != "" {
		provider = &OrderCenterProviderSummary{Name: providerName}
	}
	createdAt := order.CreatedAt
	return OrderCenterEntrySummary{
		EntryKey:                s.svc.entryKey(s.Kind(), order.ID),
		EntryKind:               OrderCenterEntryKindPayable,
		SourceKind:              s.Kind(),
		StatusGroup:             entryStatusGroup,
		StatusText:              statusText,
		Title:                   orderCenterOrderTitle(order.OrderType),
		Subtitle:                order.OrderNo,
		ReferenceNo:             order.OrderNo,
		Amount:                  normalizeAmount(order.TotalAmount - order.Discount),
		PayableAmount:           payableAmount,
		CreatedAt:               &createdAt,
		ExpireAt:                expireAt,
		Provider:                provider,
		Project:                 s.projectSummary(project),
		Booking:                 s.bookingSummary(booking, proposalID),
		AvailablePaymentOptions: availablePaymentOptions,
		CanCancel:               canCancel,
	}, true, nil
}

type refundOrderCenterSource struct {
	baseOrderCenterSource
}

func (s *refundOrderCenterSource) Kind() string {
	return OrderCenterSourceRefundRecord
}

func (s *refundOrderCenterSource) ListEntriesForUser(userID uint64, statusGroup string) ([]OrderCenterEntrySummary, error) {
	if statusGroup != "" && statusGroup != OrderCenterStatusRefund {
		return []OrderCenterEntrySummary{}, nil
	}
	var items []model.RefundApplication
	if err := repository.DB.Where("user_id = ?", userID).Order("created_at DESC").Find(&items).Error; err != nil {
		return nil, err
	}
	result := make([]OrderCenterEntrySummary, 0, len(items))
	for i := range items {
		entry, err := s.buildSummary(&items[i])
		if err != nil {
			return nil, err
		}
		result = append(result, entry)
	}
	return result, nil
}

func (s *refundOrderCenterSource) GetEntryDetailForUser(userID, primaryID uint64) (*OrderCenterEntryDetail, error) {
	view, err := s.svc.refundService.GetApplicationDetail(primaryID)
	if err != nil {
		return nil, err
	}
	if view.UserID != userID {
		return nil, errors.New("无权查看此退款记录")
	}
	summary, err := s.buildSummaryView(view)
	if err != nil {
		return nil, err
	}
	detail := &OrderCenterEntryDetail{
		OrderCenterEntrySummary: summary,
		LegacyActionPath:        fmt.Sprintf("/refunds/%d", view.ID),
		DescriptionSections: []OrderCenterDescriptionSection{
			{
				Key:   "refund_info",
				Title: "退款信息",
				Items: []OrderCenterDescriptionSectionItem{
					{Label: "退款类型", Value: refundTypeLabel(view.RefundType)},
					{Label: "申请金额", Value: formatCurrencyValue(view.RequestedAmount)},
					{Label: "申请原因", Value: safeStringOrDash(view.Reason)},
				},
			},
		},
		Timeline: buildRefundTimeline(view),
	}
	return detail, nil
}

func (s *refundOrderCenterSource) StartPaymentForUser(userID, primaryID uint64, channel, terminalType string) (*PaymentLaunchResponse, error) {
	return nil, errors.New("退款记录不支持支付")
}

func (s *refundOrderCenterSource) CancelEntryForUser(userID, primaryID uint64) error {
	return errors.New("当前条目不支持取消")
}

func (s *refundOrderCenterSource) buildSummary(item *model.RefundApplication) (OrderCenterEntrySummary, error) {
	if item == nil || item.ID == 0 {
		return OrderCenterEntrySummary{}, errors.New("退款记录不存在")
	}
	view, err := s.svc.refundService.buildRefundApplicationViewTx(repository.DB, item)
	if err != nil {
		return OrderCenterEntrySummary{}, err
	}
	return s.buildSummaryView(view)
}

func (s *refundOrderCenterSource) buildSummaryView(view *RefundApplicationView) (OrderCenterEntrySummary, error) {
	if view == nil {
		return OrderCenterEntrySummary{}, errors.New("退款记录不存在")
	}
	provider := &OrderCenterProviderSummary{Name: stringMapValue(view.Project, "providerName")}
	if provider.Name == "" {
		provider = nil
	}
	booking := &OrderCenterBookingSummary{ID: view.BookingID, Address: stringMapValue(view.Booking, "address")}
	if booking.ID == 0 {
		booking = nil
	}
	project := &OrderCenterProjectSummary{ID: view.ProjectID, Name: stringMapValue(view.Project, "name")}
	if project.ID == 0 && project.Name == "" {
		project = nil
	}
	createdAt := view.CreatedAt
	return OrderCenterEntrySummary{
		EntryKey:      s.svc.entryKey(s.Kind(), view.ID),
		EntryKind:     OrderCenterEntryKindRefund,
		SourceKind:    s.Kind(),
		StatusGroup:   OrderCenterStatusRefund,
		StatusText:    refundStatusText(view.Status),
		Title:         firstNonEmpty(stringMapValue(view.Project, "name"), stringMapValue(view.Order, "orderNo"), fmt.Sprintf("退款申请 #%d", view.ID)),
		Subtitle:      refundTypeLabel(view.RefundType),
		ReferenceNo:   fmt.Sprintf("RF%08d", view.ID),
		Amount:        view.RequestedAmount,
		PayableAmount: 0,
		CreatedAt:     &createdAt,
		Provider:      provider,
		Project:       project,
		Booking:       booking,
	}, nil
}

func mapPaymentPlanItem(plan model.PaymentPlan) OrderCenterPaymentPlanItem {
	status := OrderCenterStatusPendingPayment
	if plan.Status == 1 {
		status = OrderCenterStatusPaid
	} else if plan.Status == model.PaymentPlanStatusExpired || (plan.DueAt != nil && plan.DueAt.Before(time.Now())) {
		status = "expired"
	}
	return OrderCenterPaymentPlanItem{
		ID:            plan.ID,
		OrderID:       plan.OrderID,
		Seq:           plan.Seq,
		Name:          plan.Name,
		Amount:        plan.Amount,
		DueAt:         plan.DueAt,
		ActivatedAt:   plan.ActivatedAt,
		ExpiresAt:     plan.ExpiresAt,
		Status:        status,
		PaidAt:        plan.PaidAt,
		PlanType:      plan.Type,
		Payable:       plan.Payable,
		PayableReason: plan.PayableReason,
	}
}

func resolveSurveyDepositStatus(booking *model.Booking) (string, string) {
	if booking == nil {
		return "", ""
	}
	if booking.Status == 4 {
		return OrderCenterStatusCancelled, "已取消"
	}
	if booking.SurveyDepositPaid {
		return OrderCenterStatusPaid, "已支付"
	}
	if ensureBookingReadyForDepositPayment(booking) == nil {
		return OrderCenterStatusPendingPayment, "待支付"
	}
	return "", ""
}

func resolveBusinessOrderStatus(status int8) (string, string) {
	switch status {
	case model.OrderStatusPending:
		return OrderCenterStatusPendingPayment, "待支付"
	case model.OrderStatusPaid:
		return OrderCenterStatusPaid, "已支付"
	case model.OrderStatusCancelled:
		return OrderCenterStatusCancelled, "已取消"
	case model.OrderStatusRefunded:
		return OrderCenterStatusRefund, "已退款"
	default:
		return "", ""
	}
}

func canCancelSurveyDepositBooking(booking *model.Booking) bool {
	return booking != nil && !booking.SurveyDepositPaid && !booking.IntentFeePaid && ensureBookingReadyForDepositPayment(booking) == nil
}

func canCancelConstructionOrder(order *model.Order, plans []OrderCenterPaymentPlanItem) bool {
	if order == nil || order.Status != model.OrderStatusPending {
		return false
	}
	for _, plan := range plans {
		if plan.Status == OrderCenterStatusPaid {
			return false
		}
	}
	return true
}

func orderCenterSortTime(item OrderCenterEntrySummary) time.Time {
	if item.CreatedAt != nil {
		return *item.CreatedAt
	}
	return time.Time{}
}

func surveyDepositAmount(booking *model.Booking) float64 {
	if booking == nil {
		return 0
	}
	return booking.SurveyDeposit
}

func formatSurveyDepositReferenceNo(bookingID uint64) string {
	return fmt.Sprintf("BK%08d", bookingID)
}

func orderCenterOrderTitle(orderType string) string {
	switch strings.TrimSpace(orderType) {
	case model.OrderTypeDesign:
		return "设计费订单"
	case model.OrderTypeConstruction:
		return "施工订单"
	case model.OrderTypeMaterial:
		return "主材费订单"
	default:
		return "订单"
	}
}

func orderCenterProviderType(providerType int8, subType string) string {
	switch providerType {
	case 1:
		return "designer"
	case 2:
		if strings.TrimSpace(subType) == "foreman" {
			return "foreman"
		}
		return "company"
	case 3:
		return "foreman"
	default:
		return ""
	}
}

func refundTypeLabel(refundType string) string {
	switch strings.TrimSpace(refundType) {
	case model.RefundTypeIntentFee:
		return "量房费退款"
	case model.RefundTypeDesignFee:
		return "设计费退款"
	case model.RefundTypeConstructionFee:
		return "施工费退款"
	case model.RefundTypeFull:
		return "整单退款"
	default:
		return "退款申请"
	}
}

func refundStatusText(status string) string {
	switch strings.TrimSpace(status) {
	case model.RefundApplicationStatusPending:
		return "待审核"
	case model.RefundApplicationStatusApproved:
		return "处理中"
	case model.RefundApplicationStatusCompleted:
		return "已完成"
	case model.RefundApplicationStatusRejected:
		return "已驳回"
	default:
		return "退款中"
	}
}

func buildSurveyDepositTimeline(booking *model.Booking, refundSummary *BookingRefundSummary) []OrderCenterTimelineItem {
	items := make([]OrderCenterTimelineItem, 0, 3)
	if booking == nil {
		return items
	}
	createdAt := booking.CreatedAt
	items = append(items, OrderCenterTimelineItem{Title: "预约创建", Status: "completed", At: &createdAt})
	if booking.SurveyDepositPaidAt != nil {
		items = append(items, OrderCenterTimelineItem{Title: "量房费已支付", Status: "completed", At: booking.SurveyDepositPaidAt})
	}
	if refundSummary != nil && refundSummary.LatestRefundID > 0 {
		items = append(items, OrderCenterTimelineItem{Title: "退款申请", Description: refundStatusText(refundSummary.LatestRefundStatus), Status: strings.TrimSpace(refundSummary.LatestRefundStatus)})
	}
	return items
}

func buildBusinessOrderSections(order *model.Order, detail *OrderCenterEntryDetail, nextPlan *OrderCenterPaymentPlanItem) []OrderCenterDescriptionSection {
	if order == nil {
		return nil
	}
	sections := []OrderCenterDescriptionSection{
		{
			Key:   "amount_info",
			Title: "金额信息",
			Items: []OrderCenterDescriptionSectionItem{
				{Label: "订单总额", Value: formatCurrencyValue(order.TotalAmount)},
				{Label: "优惠金额", Value: formatCurrencyValue(order.Discount)},
				{Label: "实付金额", Value: formatCurrencyValue(order.PaidAmount)},
			},
		},
		{
			Key:   "order_info",
			Title: "订单信息",
			Items: []OrderCenterDescriptionSectionItem{
				{Label: "订单编号", Value: safeStringOrDash(order.OrderNo)},
				{Label: "订单类型", Value: orderCenterOrderTitle(order.OrderType)},
				{Label: "下单时间", Value: formatTimePointer(&order.CreatedAt)},
			},
		},
	}
	if nextPlan != nil {
		nextItems := []OrderCenterDescriptionSectionItem{
			{Label: "应付期数", Value: fmt.Sprintf("第 %d 期", nextPlan.Seq)},
			{Label: "应付名称", Value: safeStringOrDash(nextPlan.Name)},
			{Label: "应付金额", Value: formatCurrencyValue(nextPlan.Amount)},
			{Label: "当前状态", Value: safeStringOrDash(nextPlan.Status)},
		}
		if nextPlan.ExpiresAt != nil {
			nextItems = append(nextItems, OrderCenterDescriptionSectionItem{Label: "到期时间", Value: formatTimePointer(nextPlan.ExpiresAt)})
		}
		if strings.TrimSpace(nextPlan.PayableReason) != "" {
			nextItems = append(nextItems, OrderCenterDescriptionSectionItem{Label: "不可支付原因", Value: nextPlan.PayableReason})
		}
		sections = append(sections, OrderCenterDescriptionSection{
			Key:   "next_payment",
			Title: "当前应付",
			Items: nextItems,
		})
	}
	if detail != nil && detail.Project != nil {
		sections = append(sections, OrderCenterDescriptionSection{
			Key:   "project_info",
			Title: "关联项目",
			Items: []OrderCenterDescriptionSectionItem{
				{Label: "项目名称", Value: safeStringOrDash(detail.Project.Name)},
				{Label: "项目地址", Value: safeStringOrDash(detail.Project.Address)},
			},
		})
	}
	return sections
}

func buildBusinessOrderTimeline(order *model.Order, nextPlan *OrderCenterPaymentPlanItem) []OrderCenterTimelineItem {
	if order == nil {
		return nil
	}
	items := []OrderCenterTimelineItem{{Title: "订单创建", Status: "completed", At: &order.CreatedAt}}
	if order.PaidAt != nil {
		items = append(items, OrderCenterTimelineItem{Title: "订单已支付", Status: "completed", At: order.PaidAt})
	}
	if nextPlan != nil {
		items = append(items, OrderCenterTimelineItem{Title: fmt.Sprintf("待支付第 %d 期", nextPlan.Seq), Description: nextPlan.Name, Status: nextPlan.Status, At: nextPlan.DueAt})
	}
	return items
}

func buildRefundTimeline(view *RefundApplicationView) []OrderCenterTimelineItem {
	if view == nil {
		return nil
	}
	items := []OrderCenterTimelineItem{{Title: "提交退款申请", Status: "completed", At: &view.CreatedAt}}
	if view.ApprovedAt != nil {
		items = append(items, OrderCenterTimelineItem{Title: "退款审核通过", Status: "completed", At: view.ApprovedAt})
	}
	if view.CompletedAt != nil {
		items = append(items, OrderCenterTimelineItem{Title: "退款完成", Status: "completed", At: view.CompletedAt})
	}
	if view.RejectedAt != nil {
		items = append(items, OrderCenterTimelineItem{Title: "退款已驳回", Description: safeStringOrDash(view.AdminNotes), Status: "rejected", At: view.RejectedAt})
	}
	return items
}

func formatCurrencyValue(amount float64) string {
	return fmt.Sprintf("¥%.2f", normalizeAmount(amount))
}

func formatTimePointer(value *time.Time) string {
	if value == nil || value.IsZero() {
		return "-"
	}
	return value.Format(time.RFC3339)
}

func safeStringOrDash(value string) string {
	if strings.TrimSpace(value) == "" {
		return "-"
	}
	return strings.TrimSpace(value)
}
