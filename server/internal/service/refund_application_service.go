package service

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type RefundApplicationView struct {
	ID              uint64                 `json:"id"`
	BookingID       uint64                 `json:"bookingId"`
	ProjectID       uint64                 `json:"projectId,omitempty"`
	OrderID         uint64                 `json:"orderId,omitempty"`
	UserID          uint64                 `json:"userId"`
	RefundType      string                 `json:"refundType"`
	RefundAmount    float64                `json:"refundAmount"`
	RequestedAmount float64                `json:"requestedAmount"`
	ApprovedAmount  float64                `json:"approvedAmount"`
	Reason          string                 `json:"reason"`
	Evidence        []string               `json:"evidence"`
	Status          string                 `json:"status"`
	AdminID         uint64                 `json:"adminId,omitempty"`
	AdminNotes      string                 `json:"adminNotes"`
	ApprovedAt      *time.Time             `json:"approvedAt,omitempty"`
	RejectedAt      *time.Time             `json:"rejectedAt,omitempty"`
	CompletedAt     *time.Time             `json:"completedAt,omitempty"`
	CreatedAt       time.Time              `json:"createdAt"`
	UpdatedAt       time.Time              `json:"updatedAt"`
	Booking         map[string]interface{} `json:"booking,omitempty"`
	Project         map[string]interface{} `json:"project,omitempty"`
	Order           map[string]interface{} `json:"order,omitempty"`
	User            map[string]interface{} `json:"user,omitempty"`
}

type CreateRefundApplicationInput struct {
	RefundType string   `json:"refundType"`
	Reason     string   `json:"reason"`
	Evidence   []string `json:"evidence"`
}

type ListMyRefundApplicationsQuery struct {
	BookingID uint64
	Status    string
	Page      int
	PageSize  int
}

type RefundTypeEstimate struct {
	Type    string  `json:"type"`
	Label   string  `json:"label"`
	Amount  float64 `json:"amount"`
	OrderID uint64  `json:"orderId,omitempty"`
}

type BookingRefundSummary struct {
	CanApplyRefund     bool                 `json:"canApplyRefund"`
	LatestRefundID     uint64               `json:"latestRefundId,omitempty"`
	LatestRefundStatus string               `json:"latestRefundStatus,omitempty"`
	RefundableAmount   float64              `json:"refundableAmount"`
	RefundableTypes    []RefundTypeEstimate `json:"refundableTypes"`
}

type ReviewRefundApplicationInput struct {
	ApprovedAmount float64 `json:"approvedAmount"`
	AdminNotes     string  `json:"adminNotes"`
}

type RejectRefundApplicationInput struct {
	AdminNotes string `json:"adminNotes"`
}

type refundBreakdown struct {
	ProjectID           uint64
	DesignOrderID       uint64
	ConstructionOrderID uint64
	IntentFee           float64
	DesignFee           float64
	ConstructionFee     float64
}

type RefundApplicationService struct{}

func (s *RefundApplicationService) CreateApplication(bookingID, userID uint64, input *CreateRefundApplicationInput) (*RefundApplicationView, error) {
	if input == nil {
		return nil, errors.New("参数不能为空")
	}
	refundType := normalizeRefundType(strings.TrimSpace(input.RefundType))
	if refundType == "" {
		return nil, errors.New("无效的退款类型")
	}
	reason := strings.TrimSpace(input.Reason)
	if reason == "" {
		return nil, errors.New("请填写退款原因")
	}

	var view *RefundApplicationView
	err := repository.DB.Transaction(func(tx *gorm.DB) error {
		var booking model.Booking
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&booking, bookingID).Error; err != nil {
			return errors.New("预约不存在")
		}
		if booking.UserID != userID {
			return errors.New("无权申请该预约退款")
		}
		var openCount int64
		if err := tx.Model(&model.RefundApplication{}).
			Where("booking_id = ? AND user_id = ? AND status IN ?", bookingID, userID, []string{model.RefundApplicationStatusPending, model.RefundApplicationStatusApproved}).
			Count(&openCount).Error; err != nil {
			return err
		}
		if openCount > 0 {
			return errors.New("该预约已有处理中退款申请")
		}

		project, err := findProjectByBookingTx(tx, bookingID)
		if err != nil {
			return err
		}
		breakdown, err := calculateRefundBreakdownTx(tx, &booking, project)
		if err != nil {
			return err
		}
		requestedAmount, orderID, err := requestedRefundAmountFromBreakdown(refundType, breakdown)
		if err != nil {
			return err
		}
		application := &model.RefundApplication{
			BookingID:       booking.ID,
			ProjectID:       breakdown.ProjectID,
			OrderID:         orderID,
			UserID:          userID,
			RefundType:      refundType,
			RequestedAmount: requestedAmount,
			ApprovedAmount:  0,
			Reason:          reason,
			Evidence:        marshalStringList(input.Evidence),
			Status:          model.RefundApplicationStatusPending,
		}
		if err := tx.Create(application).Error; err != nil {
			return err
		}
		if err := markRefundLifecycleDisputedTx(tx, &booking, project, "退款申请："+reason); err != nil {
			return err
		}
		loaded, err := s.buildRefundApplicationViewTx(tx, application)
		if err != nil {
			return err
		}
		view = loaded
		return nil
	})
	if err != nil {
		return nil, err
	}

	dispatcher := NewNotificationDispatcher()
	dispatcher.NotifyAdminRefundApplicationCreated(view.ID, view.BookingID, view.ProjectID)
	dispatcher.NotifyProviderRefundApplicationCreated(resolveRefundProviderUserID(view), view.ID, view.ProjectID, view.BookingID)

	return view, nil
}

func (s *RefundApplicationService) ListMyApplications(userID uint64, query *ListMyRefundApplicationsQuery) ([]RefundApplicationView, int64, error) {
	page := 1
	pageSize := 20
	bookingID := uint64(0)
	status := ""
	if query != nil {
		if query.Page > 0 {
			page = query.Page
		}
		if query.PageSize > 0 {
			pageSize = query.PageSize
		}
		bookingID = query.BookingID
		status = strings.TrimSpace(query.Status)
	}

	db := repository.DB.Model(&model.RefundApplication{}).Where("user_id = ?", userID)
	if bookingID > 0 {
		db = db.Where("booking_id = ?", bookingID)
	}
	if status != "" {
		db = db.Where("status = ?", status)
	}

	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var items []model.RefundApplication
	if err := db.Order("created_at DESC").Offset((page - 1) * pageSize).Limit(pageSize).Find(&items).Error; err != nil {
		return nil, 0, err
	}
	result := make([]RefundApplicationView, 0, len(items))
	for i := range items {
		view, err := s.buildRefundApplicationViewTx(repository.DB, &items[i])
		if err != nil {
			return nil, 0, err
		}
		result = append(result, *view)
	}
	return result, total, nil
}

func (s *RefundApplicationService) ListAdminApplications(status string, page, pageSize int) ([]RefundApplicationView, int64, error) {
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 20
	}
	query := repository.DB.Model(&model.RefundApplication{})
	if strings.TrimSpace(status) != "" {
		query = query.Where("status = ?", strings.TrimSpace(status))
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var items []model.RefundApplication
	if err := query.Order("created_at DESC").Offset((page - 1) * pageSize).Limit(pageSize).Find(&items).Error; err != nil {
		return nil, 0, err
	}
	result := make([]RefundApplicationView, 0, len(items))
	for i := range items {
		view, err := s.buildRefundApplicationViewTx(repository.DB, &items[i])
		if err != nil {
			return nil, 0, err
		}
		result = append(result, *view)
	}
	return result, total, nil
}

func (s *RefundApplicationService) GetApplicationDetail(id uint64) (*RefundApplicationView, error) {
	var item model.RefundApplication
	if err := repository.DB.First(&item, id).Error; err != nil {
		return nil, errors.New("退款申请不存在")
	}
	return s.buildRefundApplicationViewTx(repository.DB, &item)
}

func (s *RefundApplicationService) ApproveApplication(id, adminID uint64, input *ReviewRefundApplicationInput) (*RefundApplicationView, error) {
	if input == nil {
		input = &ReviewRefundApplicationInput{}
	}
	var (
		view         *RefundApplicationView
		refundOrders []model.RefundOrder
	)
	auditService := &AuditLogService{}
	paymentService := NewPaymentService(nil)
	err := repository.DB.Transaction(func(tx *gorm.DB) error {
		var application model.RefundApplication
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&application, id).Error; err != nil {
			return errors.New("退款申请不存在")
		}
		if application.Status != model.RefundApplicationStatusPending {
			return errors.New("当前退款申请不可审核")
		}
		approvedAmount := application.RequestedAmount
		if input != nil && input.ApprovedAmount > 0 {
			approvedAmount = normalizeAmount(input.ApprovedAmount)
		}
		if approvedAmount <= 0 || approvedAmount > application.RequestedAmount {
			return errors.New("批准金额无效")
		}
		beforeState := map[string]interface{}{
			"refundApplication": map[string]interface{}{
				"id":              application.ID,
				"status":          application.Status,
				"requestedAmount": application.RequestedAmount,
				"approvedAmount":  application.ApprovedAmount,
			},
		}
		createdRefundOrders, createErr := paymentService.CreateRefundOrdersForApplicationTx(tx, &application, approvedAmount)
		if createErr != nil {
			return createErr
		}
		refundOrders = createdRefundOrders
		now := time.Now()
		if err := tx.Model(&application).Updates(map[string]interface{}{
			"status":          model.RefundApplicationStatusApproved,
			"admin_id":        adminID,
			"admin_notes":     strings.TrimSpace(input.AdminNotes),
			"approved_amount": approvedAmount,
			"approved_at":     now,
		}).Error; err != nil {
			return err
		}
		application.Status = model.RefundApplicationStatusApproved
		application.AdminID = adminID
		application.AdminNotes = strings.TrimSpace(input.AdminNotes)
		application.ApprovedAmount = approvedAmount
		application.ApprovedAt = &now
		if err := auditService.CreateBusinessRecordTx(tx, &CreateAuditRecordInput{
			OperatorType:  "admin",
			OperatorID:    adminID,
			OperationType: "approve_refund_application",
			ResourceType:  "refund_application",
			ResourceID:    application.ID,
			Reason:        strings.TrimSpace(input.AdminNotes),
			Result:        "success",
			BeforeState:   beforeState,
			AfterState: map[string]interface{}{
				"refundApplication": map[string]interface{}{
					"id":             application.ID,
					"status":         model.RefundApplicationStatusApproved,
					"approvedAmount": approvedAmount,
					"approvedAt":     now,
					"refundOrderCnt": len(refundOrders),
				},
			},
			Metadata: map[string]interface{}{
				"bookingId": application.BookingID,
				"projectId": application.ProjectID,
				"userId":    application.UserID,
			},
		}); err != nil {
			return err
		}
		var err error
		view, err = s.buildRefundApplicationViewTx(tx, &application)
		return err
	})
	if err != nil {
		return nil, err
	}

	hasFailed := false
	hasProcessing := false
	for _, refundOrder := range refundOrders {
		updated, execErr := paymentService.ExecuteRefundOrder(refundOrder.ID)
		switch {
		case updated == nil && execErr != nil:
			hasProcessing = true
		case updated == nil:
			continue
		case updated.Status == model.RefundOrderStatusFailed:
			hasFailed = true
		case updated.Status != model.RefundOrderStatusSucceeded:
			hasProcessing = true
		}
	}

	if !hasFailed {
		completed, finalizeErr := paymentService.FinalizeRefundApplicationIfReady(id)
		if finalizeErr != nil {
			if strings.Contains(finalizeErr.Error(), "存在退款失败记录") {
				hasFailed = true
			} else {
				return nil, finalizeErr
			}
		}
		if completed {
			hasProcessing = false
		}
	}

	view, err = s.GetApplicationDetail(id)
	if err != nil {
		return nil, err
	}
	dispatcher := NewNotificationDispatcher()
	dispatcher.NotifyUserRefundApplicationDecision(view.UserID, view.ID, view.BookingID, true, refundApprovedNotificationText(view))
	dispatcher.NotifyProviderRefundApplicationDecision(resolveRefundProviderUserID(view), view.ID, view.ProjectID, view.BookingID, true)
	if hasFailed {
		return view, errors.New("退款执行存在失败记录，请继续跟进处理")
	}
	if hasProcessing {
		return view, nil
	}
	return view, nil
}

func (s *RefundApplicationService) RejectApplication(id, adminID uint64, input *RejectRefundApplicationInput) (*RefundApplicationView, error) {
	if input == nil {
		input = &RejectRefundApplicationInput{}
	}
	var view *RefundApplicationView
	auditService := &AuditLogService{}
	err := repository.DB.Transaction(func(tx *gorm.DB) error {
		var application model.RefundApplication
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&application, id).Error; err != nil {
			return errors.New("退款申请不存在")
		}
		if application.Status != model.RefundApplicationStatusPending {
			return errors.New("当前退款申请不可驳回")
		}
		beforeState := map[string]interface{}{
			"refundApplication": map[string]interface{}{
				"id":              application.ID,
				"status":          application.Status,
				"requestedAmount": application.RequestedAmount,
			},
		}
		now := time.Now()
		if err := tx.Model(&application).Updates(map[string]interface{}{
			"status":      model.RefundApplicationStatusRejected,
			"admin_id":    adminID,
			"admin_notes": strings.TrimSpace(input.AdminNotes),
			"rejected_at": now,
		}).Error; err != nil {
			return err
		}
		if err := auditService.CreateBusinessRecordTx(tx, &CreateAuditRecordInput{
			OperatorType:  "admin",
			OperatorID:    adminID,
			OperationType: "reject_refund_application",
			ResourceType:  "refund_application",
			ResourceID:    application.ID,
			Reason:        strings.TrimSpace(input.AdminNotes),
			Result:        "success",
			BeforeState:   beforeState,
			AfterState: map[string]interface{}{
				"refundApplication": map[string]interface{}{
					"id":         application.ID,
					"status":     model.RefundApplicationStatusRejected,
					"rejectedAt": now,
				},
			},
			Metadata: map[string]interface{}{
				"bookingId": application.BookingID,
				"projectId": application.ProjectID,
				"userId":    application.UserID,
			},
		}); err != nil {
			return err
		}
		var err error
		view, err = s.buildRefundApplicationViewTx(tx, &application)
		return err
	})
	if err != nil {
		return nil, err
	}
	dispatcher := NewNotificationDispatcher()
	dispatcher.NotifyUserRefundApplicationDecision(view.UserID, view.ID, view.BookingID, false, fmt.Sprintf("您的退款申请被驳回，原因：%s", view.AdminNotes))
	dispatcher.NotifyProviderRefundApplicationDecision(resolveRefundProviderUserID(view), view.ID, view.ProjectID, view.BookingID, false)
	return view, nil
}

func refundApprovedNotificationText(view *RefundApplicationView) string {
	if view == nil {
		return "您的退款申请已进入处理流程"
	}
	switch view.Status {
	case model.RefundApplicationStatusCompleted:
		return fmt.Sprintf("您的退款申请已完成，退款金额 %.2f 元", view.ApprovedAmount)
	case model.RefundApplicationStatusApproved:
		return fmt.Sprintf("您的退款申请已审核通过，退款金额 %.2f 元，当前正在处理退款", view.ApprovedAmount)
	default:
		return fmt.Sprintf("您的退款申请状态已更新为 %s", view.Status)
	}
}

func resolveRefundProviderUserID(view *RefundApplicationView) uint64 {
	if view == nil {
		return 0
	}
	if view.ProjectID > 0 {
		var project model.Project
		if err := repository.DB.Select("provider_id", "construction_provider_id").First(&project, view.ProjectID).Error; err == nil {
			return providerUserIDFromProvider(effectiveProjectProviderID(&project))
		}
	}
	if view.BookingID > 0 {
		var booking model.Booking
		if err := repository.DB.Select("provider_id").First(&booking, view.BookingID).Error; err == nil {
			return providerUserIDFromProvider(booking.ProviderID)
		}
	}
	return 0
}

func normalizeRefundType(refundType string) string {
	switch refundType {
	case model.RefundTypeIntentFee, model.RefundTypeDesignFee, model.RefundTypeConstructionFee, model.RefundTypeFull:
		return refundType
	default:
		return ""
	}
}

func pickAbnormalRefundType(breakdown *refundBreakdown) string {
	if breakdown == nil {
		return ""
	}
	switch {
	case breakdown.IntentFee > 0 && breakdown.DesignFee > 0:
		return model.RefundTypeFull
	case breakdown.DesignFee > 0:
		return model.RefundTypeDesignFee
	case breakdown.IntentFee > 0:
		return model.RefundTypeIntentFee
	case breakdown.ConstructionFee > 0:
		return model.RefundTypeConstructionFee
	default:
		return ""
	}
}

func ensurePendingAbnormalRefundApplicationTx(tx *gorm.DB, booking *model.Booking, project *model.Project, userID uint64, reason string) (*model.RefundApplication, error) {
	if tx == nil {
		tx = repository.DB
	}
	if booking == nil || booking.ID == 0 || userID == 0 {
		return nil, nil
	}

	var existing model.RefundApplication
	if err := tx.
		Where("booking_id = ? AND user_id = ? AND status IN ?", booking.ID, userID, []string{model.RefundApplicationStatusPending, model.RefundApplicationStatusApproved}).
		Order("id DESC").
		First(&existing).Error; err == nil {
		return &existing, nil
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	breakdown, err := calculateRefundBreakdownTx(tx, booking, project)
	if err != nil {
		return nil, err
	}
	refundType := pickAbnormalRefundType(breakdown)
	if refundType == "" {
		return nil, nil
	}

	requestedAmount, orderID, err := requestedRefundAmountFromBreakdown(refundType, breakdown)
	if err != nil {
		return nil, err
	}

	application := &model.RefundApplication{
		BookingID:       booking.ID,
		ProjectID:       breakdown.ProjectID,
		OrderID:         orderID,
		UserID:          userID,
		RefundType:      refundType,
		RequestedAmount: requestedAmount,
		Reason:          strings.TrimSpace(reason),
		Status:          model.RefundApplicationStatusPending,
	}
	if err := tx.Create(application).Error; err != nil {
		return nil, err
	}
	return application, nil
}

func markRefundLifecycleDisputedTx(tx *gorm.DB, booking *model.Booking, project *model.Project, reason string) error {
	if tx == nil {
		tx = repository.DB
	}
	now := time.Now()
	reason = strings.TrimSpace(reason)

	if booking != nil && booking.ID > 0 {
		if err := tx.Model(&model.Booking{}).Where("id = ?", booking.ID).Update("status", 5).Error; err != nil {
			return err
		}
		if _, err := businessFlowSvc.EnsureLeadFlow(tx, model.BusinessFlowSourceBooking, booking.ID, booking.UserID, booking.ProviderID); err != nil {
			return err
		}
		if err := businessFlowSvc.AdvanceBySource(tx, model.BusinessFlowSourceBooking, booking.ID, map[string]interface{}{
			"current_stage": model.BusinessFlowStageDisputed,
		}); err != nil {
			return err
		}
	}

	if project != nil && project.ID > 0 {
		if err := tx.Model(&model.Project{}).Where("id = ?", project.ID).Updates(map[string]interface{}{
			"disputed_at":    now,
			"dispute_reason": reason,
		}).Error; err != nil {
			return err
		}
	}

	return nil
}

func calculateRefundBreakdownTx(tx *gorm.DB, booking *model.Booking, project *model.Project) (*refundBreakdown, error) {
	if booking == nil {
		return nil, errors.New("预约不存在")
	}
	breakdown := &refundBreakdown{}
	if project != nil {
		breakdown.ProjectID = project.ID
	}
	refundSvc := &RefundService{}
	if canRefund, _ := refundSvc.CanRefundIntentFee(booking); canRefund {
		breakdown.IntentFee = booking.SurveyDeposit
		if breakdown.IntentFee <= 0 {
			breakdown.IntentFee = booking.IntentFee
		}
	}
	order, err := findLatestPaidOrderTx(tx, booking.ID, breakdown.ProjectID, model.OrderTypeDesign)
	if err != nil {
		return nil, err
	}
	if order != nil && order.Status != model.OrderStatusRefunded {
		breakdown.DesignOrderID = order.ID
		breakdown.DesignFee = order.PaidAmount
	}
	constructionOrder, err := findLatestPaidOrderTx(tx, 0, breakdown.ProjectID, model.OrderTypeConstruction)
	if err != nil {
		return nil, err
	}
	if constructionOrder != nil && constructionOrder.Status != model.OrderStatusRefunded {
		breakdown.ConstructionOrderID = constructionOrder.ID
	}
	constructionAmount, _, err := refundableConstructionAmountTx(tx, breakdown.ProjectID)
	if err != nil {
		return nil, err
	}
	breakdown.ConstructionFee = constructionAmount
	return breakdown, nil
}

func requestedRefundAmountFromBreakdown(refundType string, breakdown *refundBreakdown) (float64, uint64, error) {
	if breakdown == nil {
		return 0, 0, errors.New("退款金额计算失败")
	}
	switch refundType {
	case model.RefundTypeIntentFee:
		if breakdown.IntentFee <= 0 {
			return 0, 0, errors.New("当前预约没有可退量房费")
		}
		return breakdown.IntentFee, 0, nil
	case model.RefundTypeDesignFee:
		if breakdown.DesignFee <= 0 {
			return 0, 0, errors.New("当前预约没有可退设计费")
		}
		return breakdown.DesignFee, breakdown.DesignOrderID, nil
	case model.RefundTypeConstructionFee:
		if breakdown.ConstructionFee <= 0 {
			return 0, 0, errors.New("当前项目没有可退施工费")
		}
		if breakdown.ConstructionOrderID == 0 {
			return 0, 0, errors.New("当前项目缺少可退施工订单")
		}
		return breakdown.ConstructionFee, breakdown.ConstructionOrderID, nil
	case model.RefundTypeFull:
		total := breakdown.IntentFee + breakdown.DesignFee + breakdown.ConstructionFee
		if total <= 0 {
			return 0, 0, errors.New("当前没有可退金额")
		}
		orderID := breakdown.DesignOrderID
		if orderID == 0 {
			orderID = breakdown.ConstructionOrderID
		}
		return total, orderID, nil
	default:
		return 0, 0, errors.New("无效的退款类型")
	}
}

func applyRefundApplicationTx(tx *gorm.DB, application *model.RefundApplication, approvedAmount float64) error {
	var booking model.Booking
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&booking, application.BookingID).Error; err != nil {
		return errors.New("预约不存在")
	}
	var project *model.Project
	if application.ProjectID > 0 {
		loadedProject, err := lockProjectByID(tx, application.ProjectID)
		if err != nil {
			return err
		}
		project = loadedProject
	}
	breakdown, err := calculateRefundBreakdownTx(tx, &booking, project)
	if err != nil {
		return err
	}
	remaining := approvedAmount

	if application.RefundType == model.RefundTypeIntentFee {
		if remaining != breakdown.IntentFee {
			return errors.New("量房费退款金额必须等于可退金额")
		}
		return applyIntentFeeRefundTx(tx, &booking, "退款申请审核通过")
	}

	if application.RefundType == model.RefundTypeDesignFee {
		if remaining > breakdown.DesignFee {
			return errors.New("设计费退款金额超过可退范围")
		}
		return applyDesignFeeRefundTx(tx, breakdown.DesignOrderID, booking.UserID, remaining)
	}

	if application.RefundType == model.RefundTypeConstructionFee {
		if remaining > breakdown.ConstructionFee {
			return errors.New("施工费退款金额超过可退范围")
		}
		if breakdown.ConstructionOrderID == 0 {
			return errors.New("当前项目缺少可退施工订单")
		}
		if application.OrderID == 0 || application.OrderID != breakdown.ConstructionOrderID {
			return errors.New("退款申请未绑定合法施工订单")
		}
		return applyConstructionRefundTx(tx, application.ProjectID, booking.UserID, application.OrderID, application.ID, remaining)
	}

	if application.RefundType == model.RefundTypeFull {
		if remaining > breakdown.IntentFee+breakdown.DesignFee+breakdown.ConstructionFee {
			return errors.New("全额退款金额超过可退范围")
		}
		if breakdown.IntentFee > 0 && remaining > 0 {
			if remaining < breakdown.IntentFee {
				return errors.New("全额退款不能对量房费做部分退款")
			}
			if err := applyIntentFeeRefundTx(tx, &booking, "全额退款申请审核通过"); err != nil {
				return err
			}
			remaining -= breakdown.IntentFee
		}
		if breakdown.DesignFee > 0 && remaining > 0 {
			if remaining < breakdown.DesignFee {
				return errors.New("全额退款不能对设计费做部分退款")
			}
			if err := applyDesignFeeRefundTx(tx, breakdown.DesignOrderID, booking.UserID, breakdown.DesignFee); err != nil {
				return err
			}
			remaining -= breakdown.DesignFee
		}
		if remaining > 0 {
			if breakdown.ConstructionOrderID == 0 {
				return errors.New("当前项目缺少可退施工订单")
			}
			if err := applyConstructionRefundTx(tx, application.ProjectID, booking.UserID, breakdown.ConstructionOrderID, application.ID, remaining); err != nil {
				return err
			}
		}
		return nil
	}

	return errors.New("不支持的退款类型")
}

func applyIntentFeeRefundTx(tx *gorm.DB, booking *model.Booking, reason string) error {
	if booking == nil {
		return errors.New("预约不存在")
	}
	refundSvc := &RefundService{}
	if canRefund, message := refundSvc.CanRefundIntentFee(booking); !canRefund {
		return errors.New(message)
	}
	now := time.Now()
	refundAmount := booking.SurveyDeposit
	if refundAmount <= 0 {
		refundAmount = booking.IntentFee
	}
	return tx.Model(booking).Updates(map[string]interface{}{
		"intent_fee_refunded":       true,
		"intent_fee_refund_reason":  strings.TrimSpace(reason),
		"intent_fee_refunded_at":    now,
		"survey_deposit_refunded":   true,
		"survey_deposit_refund_amt": refundAmount,
		"survey_deposit_refund_at":  now,
	}).Error
}

func applyDesignFeeRefundTx(tx *gorm.DB, orderID, userID uint64, amount float64) error {
	if orderID == 0 {
		return errors.New("设计费订单不存在")
	}
	var order model.Order
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&order, orderID).Error; err != nil {
		return errors.New("设计费订单不存在")
	}
	if order.Status == model.OrderStatusRefunded {
		return errors.New("设计费订单已退款")
	}
	if amount <= 0 {
		return errors.New("设计费退款金额无效")
	}
	if amount > order.PaidAmount {
		return errors.New("设计费退款金额超过剩余可退余额")
	}
	remaining := order.PaidAmount - amount
	updates := map[string]interface{}{
		"paid_amount": remaining,
	}
	if remaining <= 0 {
		updates["paid_amount"] = 0
		updates["status"] = model.OrderStatusRefunded
	}
	if err := tx.Model(&order).Updates(updates).Error; err != nil {
		return err
	}
	if err := applySettlementRefundByOrderTx(tx, orderID, amount); err != nil {
		return err
	}
	return createRefundTransactionTx(tx, order.ProjectID, userID, order.ID, amount, "设计费退款")
}

func applyConstructionRefundTx(tx *gorm.DB, projectID, userID, orderID, refundApplicationID uint64, amount float64) error {
	if projectID == 0 {
		return errors.New("项目不存在")
	}
	if orderID == 0 {
		return errors.New("施工费订单不存在")
	}
	var escrow model.EscrowAccount
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("project_id = ?", projectID).First(&escrow).Error; err != nil {
		return errors.New("项目托管账户不存在")
	}
	if amount <= 0 {
		return errors.New("施工费退款金额无效")
	}
	amount = normalizeAmount(amount)
	availableAmount := normalizeAmount(escrow.AvailableAmount)
	frozenAmount := normalizeAmount(escrow.FrozenAmount)
	unreleasedAmount := normalizeAmount(availableAmount + frozenAmount)
	if amount > unreleasedAmount {
		return errors.New("施工费退款金额超过未放款余额")
	}
	fromAvailable := amount
	if fromAvailable > availableAmount {
		fromAvailable = availableAmount
	}
	fromFrozen := normalizeAmount(amount - fromAvailable)
	escrow.TotalAmount = normalizeAmount(escrow.TotalAmount - amount)
	escrow.AvailableAmount = normalizeAmount(availableAmount - fromAvailable)
	escrow.FrozenAmount = normalizeAmount(frozenAmount - fromFrozen)
	escrow.Status = reconcileEscrowStatus(&escrow)
	if err := tx.Save(&escrow).Error; err != nil {
		return err
	}
	if err := applySettlementRefundByProjectTx(tx, projectID, amount); err != nil {
		return err
	}
	return createRefundTransactionTx(tx, projectID, userID, orderID, amount, buildRefundTransactionRemark("施工费退款", projectID, orderID, refundApplicationID))
}

func (s *RefundApplicationService) BuildBookingRefundSummary(bookingID uint64) (*BookingRefundSummary, error) {
	if bookingID == 0 {
		return nil, errors.New("预约不存在")
	}

	var summary *BookingRefundSummary
	err := repository.DB.Transaction(func(tx *gorm.DB) error {
		var booking model.Booking
		if err := tx.First(&booking, bookingID).Error; err != nil {
			return errors.New("预约不存在")
		}

		project, err := findProjectByBookingTx(tx, bookingID)
		if err != nil {
			return err
		}
		breakdown, err := calculateRefundBreakdownTx(tx, &booking, project)
		if err != nil {
			return err
		}

		latest := model.RefundApplication{}
		if err := tx.
			Where("booking_id = ?", bookingID).
			Order("id DESC").
			First(&latest).Error; err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}

		refundableTypes := make([]RefundTypeEstimate, 0, 4)
		appendRefundType := func(refundType, label string, amount float64, orderID uint64) {
			if amount <= 0 {
				return
			}
			refundableTypes = append(refundableTypes, RefundTypeEstimate{
				Type:    refundType,
				Label:   label,
				Amount:  amount,
				OrderID: orderID,
			})
		}
		appendRefundType(model.RefundTypeIntentFee, "量房费", breakdown.IntentFee, 0)
		appendRefundType(model.RefundTypeDesignFee, "设计费", breakdown.DesignFee, breakdown.DesignOrderID)
		appendRefundType(model.RefundTypeConstructionFee, "施工费", breakdown.ConstructionFee, breakdown.ConstructionOrderID)
		total := normalizeAmount(breakdown.IntentFee + breakdown.DesignFee + breakdown.ConstructionFee)
		if total > 0 {
			orderID := breakdown.DesignOrderID
			if orderID == 0 {
				orderID = breakdown.ConstructionOrderID
			}
			appendRefundType(model.RefundTypeFull, "全部可退金额", total, orderID)
		}

		latestID := uint64(0)
		latestStatus := ""
		if latest.ID > 0 {
			latestID = latest.ID
			latestStatus = latest.Status
		}

		canApply := total > 0
		if latestStatus == model.RefundApplicationStatusPending || latestStatus == model.RefundApplicationStatusApproved {
			canApply = false
		}

		summary = &BookingRefundSummary{
			CanApplyRefund:     canApply,
			LatestRefundID:     latestID,
			LatestRefundStatus: latestStatus,
			RefundableAmount:   total,
			RefundableTypes:    refundableTypes,
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return summary, nil
}

func applySettlementRefundByOrderTx(tx *gorm.DB, orderID uint64, amount float64) error {
	if orderID == 0 || amount <= 0 {
		return nil
	}
	var settlements []model.SettlementOrder
	if err := tx.Table("settlement_orders AS so").
		Joins("JOIN merchant_incomes AS mi ON mi.settlement_order_id = so.id").
		Where("mi.order_id = ?", orderID).
		Order("so.id DESC").
		Find(&settlements).Error; err != nil {
		return err
	}
	return applyRefundToSettlementsTx(tx, settlements, amount)
}

func applySettlementRefundByProjectTx(tx *gorm.DB, projectID uint64, amount float64) error {
	if projectID == 0 || amount <= 0 {
		return nil
	}
	var settlements []model.SettlementOrder
	if err := tx.Where("project_id = ?", projectID).
		Order("CASE WHEN status = 'paid' THEN 2 WHEN status = 'payout_processing' THEN 1 ELSE 0 END ASC, id DESC").
		Find(&settlements).Error; err != nil {
		return err
	}
	return applyRefundToSettlementsTx(tx, settlements, amount)
}

func applyRefundToSettlementsTx(tx *gorm.DB, settlements []model.SettlementOrder, amount float64) error {
	remaining := normalizeAmount(amount)
	for i := range settlements {
		if remaining <= 0 {
			break
		}
		settlement := settlements[i]
		if settlement.ID == 0 || settlement.Status == model.SettlementStatusRefunded {
			continue
		}
		scopeAmount := normalizeAmount(settlement.GrossAmount)
		if scopeAmount <= 0 {
			continue
		}
		used := scopeAmount
		if remaining < scopeAmount {
			used = remaining
		}
		remaining = normalizeAmount(remaining - used)

		updates := map[string]any{}
		incomeUpdates := map[string]any{}
		switch settlement.Status {
		case model.SettlementStatusPaid:
			updates["status"] = model.SettlementStatusException
			updates["recovery_status"] = model.SettlementRecoveryStatusPending
			recoveryAmount := normalizeAmount(settlement.RecoveryAmount + used)
			updates["recovery_amount"] = recoveryAmount
			updates["recovery_amount_cent"] = floatToCents(recoveryAmount)
			updates["failure_reason"] = "已出款后发生退款，待追偿"
			incomeUpdates["settlement_status"] = model.SettlementStatusException
			incomeUpdates["payout_failed_reason"] = "已出款后发生退款，待追偿"
		default:
			nextStatus := model.SettlementStatusRefunded
			if used+0.01 < scopeAmount {
				nextStatus = model.SettlementStatusRefundFrozen
			}
			updates["status"] = nextStatus
			updates["failure_reason"] = "退款已完成"
			incomeUpdates["status"] = 0
			incomeUpdates["settlement_status"] = nextStatus
			if settlement.PayoutOrderID == 0 {
				incomeUpdates["payout_status"] = ""
				incomeUpdates["payout_failed_reason"] = ""
			}
		}
		if len(updates) > 0 {
			if err := tx.Model(&model.SettlementOrder{}).Where("id = ?", settlement.ID).Updates(updates).Error; err != nil {
				return err
			}
		}
		if len(incomeUpdates) > 0 {
			if err := tx.Model(&model.MerchantIncome{}).Where("settlement_order_id = ?", settlement.ID).Updates(incomeUpdates).Error; err != nil {
				return err
			}
		}
	}
	return nil
}

func (s *RefundApplicationService) buildRefundApplicationViewTx(db *gorm.DB, item *model.RefundApplication) (*RefundApplicationView, error) {
	if item == nil {
		return nil, errors.New("退款申请不存在")
	}
	view := &RefundApplicationView{
		ID:              item.ID,
		BookingID:       item.BookingID,
		ProjectID:       item.ProjectID,
		OrderID:         item.OrderID,
		UserID:          item.UserID,
		RefundType:      item.RefundType,
		RefundAmount:    item.RequestedAmount,
		RequestedAmount: item.RequestedAmount,
		ApprovedAmount:  item.ApprovedAmount,
		Reason:          item.Reason,
		Evidence:        ParseStringList(item.Evidence),
		Status:          item.Status,
		AdminID:         item.AdminID,
		AdminNotes:      item.AdminNotes,
		ApprovedAt:      item.ApprovedAt,
		RejectedAt:      item.RejectedAt,
		CompletedAt:     item.CompletedAt,
		CreatedAt:       item.CreatedAt,
		UpdatedAt:       item.UpdatedAt,
	}
	var booking model.Booking
	if err := db.First(&booking, item.BookingID).Error; err == nil {
		view.Booking = map[string]interface{}{
			"id":        booking.ID,
			"address":   booking.Address,
			"status":    booking.Status,
			"intentFee": booking.IntentFee,
		}
	}
	if item.ProjectID > 0 {
		var project model.Project
		if err := db.First(&project, item.ProjectID).Error; err == nil {
			view.Project = map[string]interface{}{
				"id":           project.ID,
				"name":         project.Name,
				"status":       project.Status,
				"currentPhase": project.CurrentPhase,
			}
		}
	}
	if item.OrderID > 0 {
		var order model.Order
		if err := db.First(&order, item.OrderID).Error; err == nil {
			view.Order = map[string]interface{}{
				"id":          order.ID,
				"orderNo":     order.OrderNo,
				"orderType":   order.OrderType,
				"totalAmount": order.TotalAmount,
				"status":      order.Status,
			}
		}
	}
	var user model.User
	if err := db.Select("id, nickname, phone").First(&user, item.UserID).Error; err == nil {
		view.User = map[string]interface{}{
			"id":       user.ID,
			"nickname": user.Nickname,
			"phone":    user.Phone,
		}
	}
	return view, nil
}
