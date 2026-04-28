package service

import (
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"strings"
	"time"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	imgutil "home-decoration-server/internal/utils/image"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type ChangeOrderItemInput struct {
	Title        string  `json:"title"`
	Description  string  `json:"description"`
	AmountImpact float64 `json:"amountImpact"`
}

type ChangeOrderCreateInput struct {
	ChangeType     string                 `json:"changeType"`
	Title          string                 `json:"title"`
	Reason         string                 `json:"reason"`
	Description    string                 `json:"description"`
	AmountImpact   float64                `json:"amountImpact"`
	TimelineImpact int                    `json:"timelineImpact"`
	EvidenceURLs   []string               `json:"evidenceUrls"`
	Items          []ChangeOrderItemInput `json:"items"`
}

type ChangeOrderDecisionInput struct {
	Reason string `json:"reason"`
}

type ChangeOrderSettleInput struct {
	Reason string `json:"reason"`
}

type ChangeOrderView struct {
	ID               uint64                 `json:"id"`
	ProjectID        uint64                 `json:"projectId"`
	InitiatorType    string                 `json:"initiatorType"`
	InitiatorID      uint64                 `json:"initiatorId"`
	ChangeType       string                 `json:"changeType"`
	Title            string                 `json:"title"`
	Reason           string                 `json:"reason"`
	Description      string                 `json:"description"`
	AmountImpact     float64                `json:"amountImpact"`
	TimelineImpact   int                    `json:"timelineImpact"`
	Status           string                 `json:"status"`
	EvidenceURLs     []string               `json:"evidenceUrls"`
	Items            []ChangeOrderItemInput `json:"items"`
	CreatedAt        time.Time              `json:"createdAt"`
	UpdatedAt        time.Time              `json:"updatedAt"`
	UserConfirmedAt  *time.Time             `json:"userConfirmedAt,omitempty"`
	UserRejectedAt   *time.Time             `json:"userRejectedAt,omitempty"`
	UserRejectReason string                 `json:"userRejectReason,omitempty"`
	SettledAt        *time.Time             `json:"settledAt,omitempty"`
	SettlementReason string                 `json:"settlementReason,omitempty"`
	ResolvedBy       uint64                 `json:"resolvedBy,omitempty"`
	PayablePlanID    uint64                 `json:"payablePlanId,omitempty"`
}

type ChangeOrderService struct{}

func (s *ChangeOrderService) ListForOwner(projectID, userID uint64) ([]ChangeOrderView, error) {
	project, err := (&ProjectService{}).getOwnedProject(projectID, userID)
	if err != nil {
		return nil, err
	}
	return s.listByProject(project.ID)
}

func (s *ChangeOrderService) ListForProvider(projectID, providerID uint64) ([]ChangeOrderView, error) {
	project, err := (&ProjectService{}).getProviderProject(projectID, providerID)
	if err != nil {
		return nil, err
	}
	return s.listByProject(project.ID)
}

func (s *ChangeOrderService) ListForAdmin(projectID uint64) ([]ChangeOrderView, error) {
	if projectID == 0 {
		return nil, errors.New("项目不存在")
	}
	return s.listByProject(projectID)
}

func (s *ChangeOrderService) CreateByProvider(projectID, providerID uint64, input *ChangeOrderCreateInput) (*ChangeOrderView, error) {
	if input == nil {
		return nil, errors.New("参数不能为空")
	}
	view, _, _, err := s.create(projectID, "provider", providerID, 0, func(tx *gorm.DB) (*model.Project, error) {
		return (&ProjectService{}).getProviderProjectForUpdate(tx, projectID, providerID)
	}, input)
	if err != nil {
		return nil, err
	}
	return view, nil
}

func (s *ChangeOrderService) CreateByAdmin(projectID, adminID uint64, input *ChangeOrderCreateInput) (*ChangeOrderView, error) {
	if input == nil {
		return nil, errors.New("参数不能为空")
	}
	view, _, _, err := s.create(projectID, "admin", adminID, adminID, func(tx *gorm.DB) (*model.Project, error) {
		var project model.Project
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&project, projectID).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return nil, errors.New("项目不存在")
			}
			return nil, err
		}
		return &project, nil
	}, input)
	if err != nil {
		return nil, err
	}
	return view, nil
}

func (s *ChangeOrderService) ConfirmByOwner(changeOrderID, userID uint64) (*ChangeOrderView, error) {
	var (
		view           *ChangeOrderView
		providerUserID uint64
		ownerUserID    uint64
		projectID      uint64
		orderID        uint64
		planToNotify   *model.PaymentPlan
		title          string
	)
	err := repository.DB.Transaction(func(tx *gorm.DB) error {
		changeOrder, project, order, err := s.lockOwnedChangeOrderTx(tx, changeOrderID, userID)
		if err != nil {
			return err
		}
		if changeOrder.Status != model.ChangeOrderStatusPendingUserConfirm {
			return errors.New("当前变更单不可确认")
		}
		now := time.Now()
		updates := map[string]any{
			"status":             model.ChangeOrderStatusUserConfirmed,
			"user_confirmed_at":  &now,
			"user_rejected_at":   nil,
			"user_reject_reason": "",
		}
		if err := tx.Model(&model.ChangeOrder{}).Where("id = ?", changeOrder.ID).Updates(updates).Error; err != nil {
			return err
		}
		changeOrder.Status = model.ChangeOrderStatusUserConfirmed
		changeOrder.UserConfirmedAt = &now
		changeOrder.UserRejectedAt = nil
		changeOrder.UserRejectReason = ""

		if changeOrder.AmountImpact > 0 {
			plan, err := s.createChangeOrderPaymentPlanTx(tx, order, changeOrder.ID, changeOrder.Title, changeOrder.AmountImpact, now)
			if err != nil {
				return err
			}
			view, err = s.toViewTx(tx, changeOrder)
			if err != nil {
				return err
			}
			view.PayablePlanID = plan.ID
			planToNotify = plan
			providerUserID = getProviderUserIDTx(tx, effectiveProjectProviderID(project))
			ownerUserID = project.OwnerID
			projectID = project.ID
			orderID = order.ID
			title = changeOrder.Title
			if err := enqueueChangeOrderOutboxTx(tx, OutboxEventChangeOrderConfirmed, changeOrder, project, ownerUserID, providerUserID, "", plan, orderID); err != nil {
				return err
			}
			return nil
		}

		if changeOrder.AmountImpact < 0 {
			changeOrder.Status = model.ChangeOrderStatusAdminSettlementRequired
			if err := tx.Model(&model.ChangeOrder{}).Where("id = ?", changeOrder.ID).Update("status", model.ChangeOrderStatusAdminSettlementRequired).Error; err != nil {
				return err
			}
		}
		if changeOrder.TimelineImpact != 0 {
			expectedEnd := time.Now()
			if project.ExpectedEnd != nil {
				expectedEnd = *project.ExpectedEnd
			}
			nextExpectedEnd := expectedEnd.AddDate(0, 0, changeOrder.TimelineImpact)
			if err := tx.Model(&model.Project{}).Where("id = ?", project.ID).Update("expected_end", &nextExpectedEnd).Error; err != nil {
				return err
			}
		}
		providerUserID = getProviderUserIDTx(tx, effectiveProjectProviderID(project))
		ownerUserID = project.OwnerID
		projectID = project.ID
		title = changeOrder.Title
		view, err = s.toViewTx(tx, changeOrder)
		if err != nil {
			return err
		}
		if err := enqueueChangeOrderOutboxTx(tx, OutboxEventChangeOrderConfirmed, changeOrder, project, ownerUserID, providerUserID, "", nil, 0); err != nil {
			return err
		}
		if changeOrder.Status == model.ChangeOrderStatusAdminSettlementRequired {
			if err := enqueueChangeOrderOutboxTx(tx, OutboxEventChangeOrderSettlementRequired, changeOrder, project, ownerUserID, providerUserID, "", nil, 0); err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	_ = planToNotify
	_ = ownerUserID
	_ = projectID
	_ = orderID
	_ = title
	return view, nil
}

func (s *ChangeOrderService) RejectByOwner(changeOrderID, userID uint64, input *ChangeOrderDecisionInput) (*ChangeOrderView, error) {
	reason := ""
	if input != nil {
		reason = strings.TrimSpace(input.Reason)
	}
	var (
		view           *ChangeOrderView
		providerUserID uint64
		projectID      uint64
	)
	err := repository.DB.Transaction(func(tx *gorm.DB) error {
		changeOrder, project, _, err := s.lockOwnedChangeOrderTx(tx, changeOrderID, userID)
		if err != nil {
			return err
		}
		if changeOrder.Status != model.ChangeOrderStatusPendingUserConfirm {
			return errors.New("当前变更单不可拒绝")
		}
		now := time.Now()
		if err := tx.Model(&model.ChangeOrder{}).Where("id = ?", changeOrder.ID).Updates(map[string]any{
			"status":             model.ChangeOrderStatusUserRejected,
			"user_rejected_at":   &now,
			"user_reject_reason": reason,
		}).Error; err != nil {
			return err
		}
		changeOrder.Status = model.ChangeOrderStatusUserRejected
		changeOrder.UserRejectedAt = &now
		changeOrder.UserRejectReason = reason
		providerUserID = getProviderUserIDTx(tx, effectiveProjectProviderID(project))
		projectID = project.ID
		view, err = s.toViewTx(tx, changeOrder)
		if err != nil {
			return err
		}
		return enqueueChangeOrderOutboxTx(tx, OutboxEventChangeOrderRejected, changeOrder, project, userID, providerUserID, reason, nil, 0)
	})
	if err != nil {
		return nil, err
	}
	_ = projectID
	return view, nil
}

func (s *ChangeOrderService) CancelByProvider(changeOrderID, providerID uint64, input *ChangeOrderDecisionInput) (*ChangeOrderView, error) {
	err := repository.DB.Transaction(func(tx *gorm.DB) error {
		_, _, err := s.lockProviderChangeOrderTx(tx, changeOrderID, providerID)
		if err != nil {
			return err
		}
		return errors.New("当前阶段未开放商家端变更单操作")
	})
	if err != nil {
		return nil, err
	}
	return nil, nil
}

func (s *ChangeOrderService) SettleByAdmin(changeOrderID, adminID uint64, input *ChangeOrderSettleInput) (*ChangeOrderView, error) {
	reason := ""
	if input != nil {
		reason = strings.TrimSpace(input.Reason)
	}
	if reason == "" {
		return nil, errors.New("请填写结算说明")
	}
	var view *ChangeOrderView
	err := repository.DB.Transaction(func(tx *gorm.DB) error {
		var changeOrder model.ChangeOrder
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&changeOrder, changeOrderID).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return errors.New("变更单不存在")
			}
			return err
		}
		if changeOrder.Status != model.ChangeOrderStatusAdminSettlementRequired {
			return errors.New("当前变更单无需人工结算")
		}
		now := time.Now()
		if err := tx.Model(&model.ChangeOrder{}).Where("id = ?", changeOrder.ID).Updates(map[string]any{
			"status":            model.ChangeOrderStatusSettled,
			"settled_at":        &now,
			"settlement_reason": reason,
			"resolved_by":       adminID,
		}).Error; err != nil {
			return err
		}
		changeOrder.Status = model.ChangeOrderStatusSettled
		changeOrder.SettledAt = &now
		changeOrder.SettlementReason = reason
		changeOrder.ResolvedBy = adminID
		viewResult, viewErr := s.toViewTx(tx, &changeOrder)
		if viewErr != nil {
			return viewErr
		}
		view = viewResult
		return enqueueChangeOrderOutboxTx(tx, OutboxEventChangeOrderSettled, &changeOrder, nil, 0, 0, reason, nil, 0)
	})
	if err != nil {
		return nil, err
	}
	return view, nil
}

func (s *ChangeOrderService) create(projectID uint64, initiatorType string, initiatorID, resolvedBy uint64, projectLoader func(tx *gorm.DB) (*model.Project, error), input *ChangeOrderCreateInput) (*ChangeOrderView, uint64, uint64, error) {
	if err := validateChangeOrderCreateInput(input); err != nil {
		return nil, 0, 0, err
	}
	var (
		view           *ChangeOrderView
		providerUserID uint64
		ownerUserID    uint64
	)
	err := repository.DB.Transaction(func(tx *gorm.DB) error {
		project, err := projectLoader(tx)
		if err != nil {
			return err
		}
		ownerUserID = project.OwnerID
		providerUserID = getProviderUserIDTx(tx, effectiveProjectProviderID(project))
		itemsJSON, err := json.Marshal(input.Items)
		if err != nil {
			return fmt.Errorf("序列化变更项失败: %w", err)
		}
		evidenceJSON, err := json.Marshal(normalizeStoredAssetSlice(input.EvidenceURLs))
		if err != nil {
			return fmt.Errorf("序列化附件失败: %w", err)
		}
		changeOrder := &model.ChangeOrder{
			ProjectID:      project.ID,
			InitiatorType:  initiatorType,
			InitiatorID:    initiatorID,
			ChangeType:     normalizeChangeType(input.ChangeType),
			Title:          strings.TrimSpace(input.Title),
			Reason:         strings.TrimSpace(input.Reason),
			Description:    strings.TrimSpace(input.Description),
			AmountImpact:   normalizeChangeOrderAmount(input.AmountImpact),
			TimelineImpact: input.TimelineImpact,
			EvidenceURLs:   string(evidenceJSON),
			Items:          string(itemsJSON),
			Status:         model.ChangeOrderStatusPendingUserConfirm,
			ResolvedBy:     resolvedBy,
		}
		if err := tx.Create(changeOrder).Error; err != nil {
			return err
		}
		view, err = s.toViewTx(tx, changeOrder)
		if err != nil {
			return err
		}
		return enqueueChangeOrderOutboxTx(tx, OutboxEventChangeOrderCreated, changeOrder, project, ownerUserID, providerUserID, input.Reason, nil, 0)
	})
	if err != nil {
		return nil, 0, 0, err
	}
	return view, providerUserID, ownerUserID, nil
}

func (s *ChangeOrderService) listByProject(projectID uint64) ([]ChangeOrderView, error) {
	var items []model.ChangeOrder
	if err := repository.DB.Where("project_id = ?", projectID).Order("created_at DESC, id DESC").Find(&items).Error; err != nil {
		return nil, err
	}
	result := make([]ChangeOrderView, 0, len(items))
	for idx := range items {
		view, err := s.toViewTx(repository.DB, &items[idx])
		if err != nil {
			return nil, err
		}
		result = append(result, *view)
	}
	return result, nil
}

func (s *ChangeOrderService) toViewTx(tx *gorm.DB, changeOrder *model.ChangeOrder) (*ChangeOrderView, error) {
	if changeOrder == nil {
		return nil, nil
	}
	items := []ChangeOrderItemInput{}
	if strings.TrimSpace(changeOrder.Items) != "" {
		if err := json.Unmarshal([]byte(changeOrder.Items), &items); err != nil {
			return nil, fmt.Errorf("解析变更项失败: %w", err)
		}
	}
	evidenceURLs := []string{}
	if strings.TrimSpace(changeOrder.EvidenceURLs) != "" {
		if err := json.Unmarshal([]byte(changeOrder.EvidenceURLs), &evidenceURLs); err != nil {
			return nil, fmt.Errorf("解析变更附件失败: %w", err)
		}
		evidenceURLs = imgutil.GetFullImageURLs(evidenceURLs)
	}
	view := &ChangeOrderView{
		ID:               changeOrder.ID,
		ProjectID:        changeOrder.ProjectID,
		InitiatorType:    changeOrder.InitiatorType,
		InitiatorID:      changeOrder.InitiatorID,
		ChangeType:       changeOrder.ChangeType,
		Title:            changeOrder.Title,
		Reason:           changeOrder.Reason,
		Description:      changeOrder.Description,
		AmountImpact:     changeOrder.AmountImpact,
		TimelineImpact:   changeOrder.TimelineImpact,
		Status:           changeOrder.Status,
		EvidenceURLs:     evidenceURLs,
		Items:            items,
		CreatedAt:        changeOrder.CreatedAt,
		UpdatedAt:        changeOrder.UpdatedAt,
		UserConfirmedAt:  changeOrder.UserConfirmedAt,
		UserRejectedAt:   changeOrder.UserRejectedAt,
		UserRejectReason: changeOrder.UserRejectReason,
		SettledAt:        changeOrder.SettledAt,
		SettlementReason: changeOrder.SettlementReason,
		ResolvedBy:       changeOrder.ResolvedBy,
	}
	var payablePlan model.PaymentPlan
	if err := tx.
		Where("change_order_id = ?", changeOrder.ID).
		Order("id DESC").
		First(&payablePlan).Error; err == nil {
		view.PayablePlanID = payablePlan.ID
	}
	return view, nil
}

func (s *ChangeOrderService) lockOwnedChangeOrderTx(tx *gorm.DB, changeOrderID, userID uint64) (*model.ChangeOrder, *model.Project, *model.Order, error) {
	var changeOrder model.ChangeOrder
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&changeOrder, changeOrderID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil, nil, errors.New("变更单不存在")
		}
		return nil, nil, nil, err
	}
	var project model.Project
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&project, changeOrder.ProjectID).Error; err != nil {
		return nil, nil, nil, errors.New("项目不存在")
	}
	if project.OwnerID != userID {
		return nil, nil, nil, errors.New("无权操作此变更单")
	}
	order, err := s.lockConstructionOrderTx(tx, project.ID)
	if err != nil {
		return nil, nil, nil, err
	}
	return &changeOrder, &project, order, nil
}

func (s *ChangeOrderService) lockProviderChangeOrderTx(tx *gorm.DB, changeOrderID, providerID uint64) (*model.ChangeOrder, *model.Project, error) {
	var changeOrder model.ChangeOrder
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&changeOrder, changeOrderID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil, errors.New("变更单不存在")
		}
		return nil, nil, err
	}
	project, err := (&ProjectService{}).getProviderProjectForUpdate(tx, changeOrder.ProjectID, providerID)
	if err != nil {
		return nil, nil, err
	}
	return &changeOrder, project, nil
}

func (s *ChangeOrderService) lockConstructionOrderTx(tx *gorm.DB, projectID uint64) (*model.Order, error) {
	var order model.Order
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
		Where("project_id = ? AND order_type = ?", projectID, model.OrderTypeConstruction).
		Order("id DESC").
		First(&order).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("施工订单不存在")
		}
		return nil, err
	}
	return &order, nil
}

func (s *ChangeOrderService) createChangeOrderPaymentPlanTx(tx *gorm.DB, order *model.Order, changeOrderID uint64, title string, amount float64, activatedAt time.Time) (*model.PaymentPlan, error) {
	if order == nil || order.ID == 0 {
		return nil, errors.New("施工订单不存在")
	}
	var maxSeq int
	if err := tx.Model(&model.PaymentPlan{}).Where("order_id = ?", order.ID).Select("COALESCE(MAX(seq), 0)").Scan(&maxSeq).Error; err != nil {
		return nil, err
	}
	plan := &model.PaymentPlan{
		OrderID:       order.ID,
		Type:          "change_order",
		Seq:           maxSeq + 1,
		Name:          strings.TrimSpace(title),
		Amount:        normalizeAmount(amount),
		Status:        model.PaymentPlanStatusPending,
		ActivatedAt:   &activatedAt,
		ChangeOrderID: &changeOrderID,
	}
	dueAt := activatedAt.Add(constructionPaymentPlanActiveWindow)
	plan.DueAt = &dueAt
	if err := tx.Create(plan).Error; err != nil {
		return nil, err
	}
	totalAmount := normalizeAmount(order.TotalAmount + plan.Amount)
	updates := map[string]any{
		"total_amount": totalAmount,
		"status":       model.OrderStatusPending,
		"expire_at":    plan.DueAt,
	}
	if err := tx.Model(&model.Order{}).Where("id = ?", order.ID).Updates(updates).Error; err != nil {
		return nil, err
	}
	order.TotalAmount = totalAmount
	order.Status = model.OrderStatusPending
	order.ExpireAt = plan.DueAt
	return plan, nil
}

func validateChangeOrderCreateInput(input *ChangeOrderCreateInput) error {
	if input == nil {
		return errors.New("参数不能为空")
	}
	if strings.TrimSpace(input.Title) == "" {
		return errors.New("请填写变更标题")
	}
	if strings.TrimSpace(input.Reason) == "" {
		return errors.New("请填写变更原因")
	}
	if len(strings.TrimSpace(input.Description)) > 1000 {
		return errors.New("变更说明不能超过 1000 字符")
	}
	if len(strings.TrimSpace(input.Reason)) > 500 {
		return errors.New("变更原因不能超过 500 字符")
	}
	if input.TimelineImpact < -365 || input.TimelineImpact > 365 {
		return errors.New("工期影响超出合理范围")
	}
	if normalizeChangeOrderAmount(input.AmountImpact) == 0 && input.TimelineImpact == 0 && strings.TrimSpace(input.Description) == "" {
		return errors.New("请至少填写金额、工期或说明中的一项")
	}
	return nil
}

func normalizeChangeType(value string) string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return "scope"
	}
	return trimmed
}

func normalizeChangeOrderAmount(amount float64) float64 {
	rounded := math.Round(amount*100) / 100
	if math.Abs(rounded) < 0.005 {
		return 0
	}
	return rounded
}
