package service

import (
	"errors"
	"fmt"
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	"sort"
	"strings"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// OrderService 订单服务
type OrderService struct{}

// UserOrderListItem 用户端订单列表项
type UserOrderListItem struct {
	ID            uint64     `json:"id"`
	RecordType    string     `json:"recordType"`
	OrderNo       string     `json:"orderNo"`
	OrderType     string     `json:"orderType,omitempty"`
	Status        int8       `json:"status"`
	Amount        float64    `json:"amount"`
	TotalAmount   float64    `json:"totalAmount"`
	PaidAmount    float64    `json:"paidAmount"`
	Discount      float64    `json:"discount"`
	CreatedAt     *time.Time `json:"createdAt,omitempty"`
	PaidAt        *time.Time `json:"paidAt,omitempty"`
	ProviderName  string     `json:"providerName"`
	Address       string     `json:"address"`
	NextPayableAt *time.Time `json:"nextPayableAt"`
	BookingID     uint64     `json:"bookingId,omitempty"`
	ProposalID    uint64     `json:"proposalId"`
	ProjectID     uint64     `json:"projectId"`
	ActionPath    string     `json:"actionPath,omitempty"`
}

type userOrderAggregateRecord struct {
	item      UserOrderListItem
	createdAt time.Time
}

var configService = &ConfigService{}

// GenerateBillInput 生成账单入参
type GenerateBillInput struct {
	ProjectID       uint64  `json:"projectId" binding:"required"`
	DesignFee       float64 `json:"designFee" binding:"required"`
	ConstructionFee float64 `json:"constructionFee"`
	MaterialFee     float64 `json:"materialFee"`
	PaymentType     string  `json:"paymentType"` // milestone | onetime
}

// BillResult 账单生成结果
type BillResult struct {
	DesignOrder       *model.Order        `json:"designOrder"`
	ConstructionOrder *model.Order        `json:"constructionOrder"`
	PaymentPlans      []model.PaymentPlan `json:"paymentPlans"`
}

type ConstructionOrderPlanBundle struct {
	Order *model.Order
	Plans []model.PaymentPlan
}

type ProjectBillItem struct {
	Order        model.Order         `json:"order"`
	PaymentPlans []model.PaymentPlan `json:"paymentPlans"`
}

// GenerateBill 生成项目账单（设计费订单 + 施工费订单）
func (s *OrderService) GenerateBill(userID uint64, input *GenerateBillInput) (*BillResult, error) {
	// 1. 验证 Project 归属和状态
	var project model.Project
	if err := repository.DB.First(&project, input.ProjectID).Error; err != nil {
		return nil, errors.New("项目不存在")
	}
	if project.OwnerID != userID {
		return nil, errors.New("无权操作此项目")
	}
	if project.CurrentPhase != "selecting" {
		return nil, errors.New("项目当前阶段不正确")
	}

	// 2. 查找关联的 Booking 以获取意向金
	var proposal model.Proposal
	// 通过 designerID 和 project 关联找到 proposal
	if err := repository.DB.Where("designer_id = ?", project.ProviderID).
		Order("created_at DESC").First(&proposal).Error; err != nil {
		return nil, errors.New("未找到关联的设计方案")
	}

	var booking model.Booking
	if err := repository.DB.First(&booking, proposal.BookingID).Error; err != nil {
		return nil, errors.New("未找到关联的预约")
	}

	// 开启事务
	tx := repository.DB.Begin()

	// 3. 创建设计费订单（扣除意向金）
	intentFeeDiscount := float64(0)
	if booking.IntentFeePaid && !booking.IntentFeeDeducted {
		intentFeeDiscount = booking.IntentFee
	}

	designOrderNo, err := s.generateOrderNo(model.OrderTypeDesign)
	if err != nil {
		tx.Rollback()
		return nil, err
	}
	designOrder := &model.Order{
		ProjectID:   input.ProjectID,
		BookingID:   booking.ID,
		OrderNo:     designOrderNo,
		OrderType:   model.OrderTypeDesign,
		TotalAmount: input.DesignFee,
		Discount:    intentFeeDiscount,
		Status:      model.OrderStatusPending,
	}
	if err := tx.Create(designOrder).Error; err != nil {
		tx.Rollback()
		return nil, err
	}

	// 4. 标记意向金已抵扣
	if intentFeeDiscount > 0 {
		booking.IntentFeeDeducted = true
		if err := tx.Save(&booking).Error; err != nil {
			tx.Rollback()
			return nil, err
		}
	}

	// 5. 创建施工费订单
	constructionOrderNo, err := s.generateOrderNo(model.OrderTypeConstruction)
	if err != nil {
		tx.Rollback()
		return nil, err
	}
	constructionOrder := &model.Order{
		ProjectID:   input.ProjectID,
		BookingID:   booking.ID,
		OrderNo:     constructionOrderNo,
		OrderType:   model.OrderTypeConstruction,
		TotalAmount: input.ConstructionFee + input.MaterialFee,
		Status:      model.OrderStatusPending,
	}
	if err := tx.Create(constructionOrder).Error; err != nil {
		tx.Rollback()
		return nil, err
	}

	// 6. 生成支付计划
	var paymentPlans []model.PaymentPlan
	paymentType := input.PaymentType
	if paymentType == "" {
		paymentType = configService.GetConstructionPaymentMode()
	}

	if paymentType == "milestone" {
		milestones, err := configService.GetConstructionMilestones()
		if err != nil {
			// 使用默认分期
			milestones = []MilestoneConfig{
				{Name: "开工款", Percentage: 30},
				{Name: "水电款", Percentage: 35},
				{Name: "中期款", Percentage: 30},
				{Name: "尾款", Percentage: 5},
			}
		}

		for i, ms := range milestones {
			plan := model.PaymentPlan{
				OrderID:    constructionOrder.ID,
				Type:       "milestone",
				Seq:        i + 1,
				Name:       ms.Name,
				Percentage: ms.Percentage,
				Amount:     constructionOrder.TotalAmount * float64(ms.Percentage) / 100,
				Status:     0,
			}
			if err := tx.Create(&plan).Error; err != nil {
				tx.Rollback()
				return nil, err
			}
			paymentPlans = append(paymentPlans, plan)
		}
	} else {
		// 一次性付款
		plan := model.PaymentPlan{
			OrderID:    constructionOrder.ID,
			Type:       "onetime",
			Seq:        1,
			Name:       "全款",
			Percentage: 100,
			Amount:     constructionOrder.TotalAmount,
			Status:     0,
		}
		if err := tx.Create(&plan).Error; err != nil {
			tx.Rollback()
			return nil, err
		}
		paymentPlans = append(paymentPlans, plan)
	}

	// 7. 更新项目阶段为 billing
	project.CurrentPhase = "billing"
	if err := tx.Save(&project).Error; err != nil {
		tx.Rollback()
		return nil, err
	}

	tx.Commit()

	return &BillResult{
		DesignOrder:       designOrder,
		ConstructionOrder: constructionOrder,
		PaymentPlans:      paymentPlans,
	}, nil
}

func (s *OrderService) EnsureConstructionOrderAndPaymentPlansTx(tx *gorm.DB, projectID uint64, quoteList *model.QuoteList, submission *model.QuoteSubmission) (*ConstructionOrderPlanBundle, error) {
	if tx == nil {
		return nil, errors.New("事务不能为空")
	}
	if projectID == 0 {
		return nil, errors.New("项目不存在")
	}

	var project model.Project
	if err := tx.First(&project, projectID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("项目不存在")
		}
		return nil, fmt.Errorf("查询项目失败: %w", err)
	}

	var existingOrder model.Order
	orderErr := tx.
		Where("project_id = ? AND order_type = ?", projectID, model.OrderTypeConstruction).
		Order("id DESC").
		First(&existingOrder).Error
	if orderErr == nil {
		var plans []model.PaymentPlan
		if err := tx.Where("order_id = ?", existingOrder.ID).Order("seq ASC").Find(&plans).Error; err != nil {
			return nil, fmt.Errorf("查询施工支付计划失败: %w", err)
		}
		if len(plans) > 0 {
			return &ConstructionOrderPlanBundle{
				Order: &existingOrder,
				Plans: plans,
			}, nil
		}
	} else if !errors.Is(orderErr, gorm.ErrRecordNotFound) {
		return nil, fmt.Errorf("查询施工订单失败: %w", orderErr)
	}

	totalAmount := project.ConstructionQuote
	if submission != nil && submission.TotalCent > 0 {
		totalAmount = float64(submission.TotalCent) / 100
	}
	totalAmount = normalizeAmount(totalAmount)
	if totalAmount <= 0 {
		return nil, errors.New("施工报价金额无效，无法创建施工订单")
	}

	proposalID := project.ProposalID
	if proposalID == 0 && quoteList != nil {
		proposalID = quoteList.ProposalID
	}
	var bookingID uint64
	if proposalID > 0 {
		var proposal model.Proposal
		if err := tx.Select("id", "booking_id").First(&proposal, proposalID).Error; err == nil {
			bookingID = proposal.BookingID
		}
	}

	now := time.Now()
	expireAt := now.Add(48 * time.Hour)
	orderNo, err := s.generateOrderNo(model.OrderTypeConstruction)
	if err != nil {
		return nil, err
	}
	order := &model.Order{
		ProjectID:   project.ID,
		ProposalID:  proposalID,
		BookingID:   bookingID,
		OrderNo:     orderNo,
		OrderType:   model.OrderTypeConstruction,
		TotalAmount: totalAmount,
		Status:      model.OrderStatusPending,
		ExpireAt:    &expireAt,
	}
	if orderErr == nil {
		order.ID = existingOrder.ID
		if err := tx.Model(&existingOrder).Updates(map[string]interface{}{
			"proposal_id":  proposalID,
			"booking_id":   bookingID,
			"total_amount": totalAmount,
			"status":       model.OrderStatusPending,
			"expire_at":    &expireAt,
			"paid_amount":  existingOrder.PaidAmount,
			"discount":     existingOrder.Discount,
		}).Error; err != nil {
			return nil, fmt.Errorf("更新施工订单失败: %w", err)
		}
		order = &existingOrder
		order.ProposalID = proposalID
		order.BookingID = bookingID
		order.TotalAmount = totalAmount
		order.Status = model.OrderStatusPending
		order.ExpireAt = &expireAt
	} else {
		if err := tx.Create(order).Error; err != nil {
			return nil, fmt.Errorf("创建施工订单失败: %w", err)
		}
	}

	plans, err := s.createConstructionPaymentPlansTx(tx, &project, order, totalAmount, expireAt)
	if err != nil {
		return nil, err
	}

	return &ConstructionOrderPlanBundle{
		Order: order,
		Plans: plans,
	}, nil
}

func (s *OrderService) createConstructionPaymentPlansTx(tx *gorm.DB, project *model.Project, order *model.Order, totalAmount float64, firstDueAt time.Time) ([]model.PaymentPlan, error) {
	if tx == nil || project == nil || order == nil {
		return nil, errors.New("支付计划生成参数错误")
	}

	var milestones []model.Milestone
	if err := tx.Where("project_id = ?", project.ID).Order("seq ASC").Find(&milestones).Error; err != nil {
		return nil, fmt.Errorf("查询项目里程碑失败: %w", err)
	}

	plans := make([]model.PaymentPlan, 0)
	activatedAt := time.Now()
	if len(milestones) > 0 {
		for idx, milestone := range milestones {
			planType := "milestone"
			switch idx {
			case 0:
				planType = "down_payment"
			case len(milestones) - 1:
				planType = "final_payment"
			}
			plan := model.PaymentPlan{
				OrderID:     order.ID,
				MilestoneID: milestone.ID,
				Type:        planType,
				Seq:         idx + 1,
				Name:        milestone.Name,
				Amount:      normalizeAmount(milestone.Amount),
				Percentage:  milestone.Percentage,
				Status:      0,
			}
			if idx == 0 {
				plan.ActivatedAt = &activatedAt
				plan.DueAt = &firstDueAt
			}
			plans = append(plans, plan)
		}
	} else {
		milestoneConfigs, err := configService.GetConstructionMilestones()
		if err != nil || len(milestoneConfigs) == 0 {
			milestoneConfigs = []MilestoneConfig{
				{Name: "首付款", Percentage: 30},
				{Name: "节点进度款", Percentage: 50},
				{Name: "尾款", Percentage: 20},
			}
		}
		for idx, cfg := range milestoneConfigs {
			planType := "milestone"
			switch idx {
			case 0:
				planType = "down_payment"
			case len(milestoneConfigs) - 1:
				planType = "final_payment"
			}
			plan := model.PaymentPlan{
				OrderID:    order.ID,
				Type:       planType,
				Seq:        idx + 1,
				Name:       cfg.Name,
				Amount:     SafeMoneyPercentage(totalAmount, float64(cfg.Percentage)),
				Percentage: cfg.Percentage,
				Status:     0,
			}
			if idx == 0 {
				plan.ActivatedAt = &activatedAt
				plan.DueAt = &firstDueAt
			}
			plans = append(plans, plan)
		}
	}

	if len(plans) == 0 {
		return nil, errors.New("未生成有效支付计划")
	}
	if err := tx.Create(&plans).Error; err != nil {
		return nil, fmt.Errorf("创建施工支付计划失败: %w", err)
	}
	return plans, nil
}

func syncPaidOrderPlansTx(tx *gorm.DB, order *model.Order) error {
	if tx == nil || order == nil || order.ID == 0 || order.Status != model.OrderStatusPaid {
		return nil
	}

	paidAt := time.Now()
	if order.PaidAt != nil && !order.PaidAt.IsZero() {
		paidAt = *order.PaidAt
	}

	if err := tx.Model(&model.PaymentPlan{}).
		Where("order_id = ? AND status = ?", order.ID, model.PaymentPlanStatusPending).
		Updates(map[string]any{
			"status":  model.PaymentPlanStatusPaid,
			"paid_at": paidAt,
		}).Error; err != nil {
		return fmt.Errorf("同步订单支付计划状态失败: %w", err)
	}

	return nil
}

func repairPaidOrderPlansIfNeeded(order *model.Order, plans []model.PaymentPlan) error {
	if order == nil || order.ID == 0 || order.Status != model.OrderStatusPaid || len(plans) == 0 {
		return nil
	}

	needsRepair := false
	for _, plan := range plans {
		if plan.Status == model.PaymentPlanStatusPending {
			needsRepair = true
			break
		}
	}
	if !needsRepair {
		return nil
	}

	if err := repository.DB.Transaction(func(tx *gorm.DB) error {
		var latest model.Order
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&latest, order.ID).Error; err != nil {
			return err
		}
		if latest.Status != model.OrderStatusPaid {
			return nil
		}
		return syncPaidOrderPlansTx(tx, &latest)
	}); err != nil {
		return err
	}

	paidAt := time.Now()
	if order.PaidAt != nil && !order.PaidAt.IsZero() {
		paidAt = *order.PaidAt
	}
	for idx := range plans {
		if plans[idx].Status == model.PaymentPlanStatusPending {
			plans[idx].Status = model.PaymentPlanStatusPaid
			plans[idx].PaidAt = &paidAt
		}
	}

	return nil
}

// PayOrder 支付订单
func (s *OrderService) PayOrder(userID, orderID uint64) (*model.Order, error) {
	var order model.Order
	if err := repository.DB.First(&order, orderID).Error; err != nil {
		return nil, errors.New("订单不存在")
	}

	booking, project, err := s.resolveBookingAndProject(&order)
	if err != nil {
		return nil, err
	}
	if project != nil {
		if project.OwnerID != userID {
			return nil, errors.New("无权操作此订单")
		}
	} else if booking != nil {
		if booking.UserID != userID {
			return nil, errors.New("无权操作此订单")
		}
	} else {
		return nil, errors.New("订单数据异常")
	}

	if order.Status != model.OrderStatusPending {
		return nil, errors.New("订单状态不正确")
	}

	paidAt := time.Now()
	if err := repository.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&order, orderID).Error; err != nil {
			return errors.New("订单不存在")
		}
		if order.Status != model.OrderStatusPending {
			return errors.New("订单状态不正确")
		}

		order.Status = model.OrderStatusPaid
		order.PaidAmount = order.TotalAmount - order.Discount
		order.PaidAt = &paidAt

		if err := tx.Model(&order).Updates(map[string]any{
			"status":      order.Status,
			"paid_amount": order.PaidAmount,
			"paid_at":     order.PaidAt,
		}).Error; err != nil {
			return err
		}

		return syncPaidOrderPlansTx(tx, &order)
	}); err != nil {
		return nil, err
	}

	// 发送通知给商家 + 创建收入记录
	notifService := &NotificationService{}
	incomeService := &MerchantIncomeService{}
	orderData := map[string]interface{}{
		"id":     order.ID,
		"amount": order.TotalAmount - order.Discount,
	}

	if booking != nil {
		var provider model.Provider
		if err := repository.DB.First(&provider, booking.ProviderID).Error; err == nil {
			_ = notifService.NotifyOrderPaid(orderData, provider.UserID)
			if order.OrderType != model.OrderTypeConstruction {
				_, _ = incomeService.CreateIncome(&CreateIncomeInput{
					ProviderID:  provider.ID,
					OrderID:     order.ID,
					BookingID:   booking.ID,
					Type:        order.OrderType,
					Amount:      order.TotalAmount - order.Discount,
					Description: "订单支付",
				})
			}
		}
	} else if project != nil {
		var provider model.Provider
		if err := repository.DB.First(&provider, project.ProviderID).Error; err == nil {
			_ = notifService.NotifyOrderPaid(orderData, provider.UserID)
			if order.OrderType != model.OrderTypeConstruction {
				_, _ = incomeService.CreateIncome(&CreateIncomeInput{
					ProviderID:  provider.ID,
					OrderID:     order.ID,
					BookingID:   0,
					Type:        order.OrderType,
					Amount:      order.TotalAmount - order.Discount,
					Description: "订单支付",
				})
			}
		}
	}

	// 如果是设计费订单，且已关联项目（如果有），更新项目阶段
	if order.OrderType == model.OrderTypeDesign && order.ProjectID > 0 {
		repository.DB.Model(&model.Project{}).Where("id = ?", order.ProjectID).Update("current_phase", "design_paid")
	}

	return &order, nil
}

// CancelOrder 取消订单
func (s *OrderService) CancelOrder(userID, orderID uint64) error {
	var order model.Order
	if err := repository.DB.First(&order, orderID).Error; err != nil {
		return errors.New("订单不存在")
	}

	booking, project, err := s.resolveBookingAndProject(&order)
	if err != nil {
		return err
	}
	if project != nil {
		if project.OwnerID != userID {
			return errors.New("无权操作此订单")
		}
	} else if booking != nil {
		if booking.UserID != userID {
			return errors.New("无权操作此订单")
		}
	} else {
		return errors.New("订单数据异常")
	}

	canCancel, err := canCancelOrderTx(repository.DB, &order)
	if err != nil {
		return err
	}
	if !canCancel {
		return errors.New("当前订单不可取消")
	}

	order.Status = model.OrderStatusCancelled
	return repository.DB.Save(&order).Error
}

func canCancelOrderTx(tx *gorm.DB, order *model.Order) (bool, error) {
	if tx == nil || order == nil || order.ID == 0 {
		return false, nil
	}
	if order.Status != model.OrderStatusPending {
		return false, nil
	}
	if order.OrderType != model.OrderTypeConstruction {
		return true, nil
	}

	var paidCount int64
	if err := tx.Model(&model.PaymentPlan{}).
		Where("order_id = ? AND status = ?", order.ID, 1).
		Count(&paidCount).Error; err != nil {
		return false, err
	}
	if paidCount > 0 {
		return false, nil
	}
	return true, nil
}

// PayPaymentPlan 支付分期款项
func (s *OrderService) PayPaymentPlan(userID uint64, planID uint64) (*model.PaymentPlan, error) {
	var updatedPlan model.PaymentPlan
	err := repository.DB.Transaction(func(tx *gorm.DB) error {
		var plan model.PaymentPlan
		if err := tx.First(&plan, planID).Error; err != nil {
			return errors.New("支付计划不存在")
		}

		var order model.Order
		if err := tx.First(&order, plan.OrderID).Error; err != nil {
			return errors.New("订单不存在")
		}

		var project model.Project
		if err := tx.First(&project, order.ProjectID).Error; err != nil {
			return errors.New("项目不存在")
		}
		if project.OwnerID != userID {
			return errors.New("无权操作")
		}

		if plan.Status != 0 {
			return errors.New("该期款项已支付")
		}

		if plan.Seq > 1 {
			var prevPlan model.PaymentPlan
			if err := tx.Where("order_id = ? AND seq = ?", plan.OrderID, plan.Seq-1).First(&prevPlan).Error; err == nil && prevPlan.Status == 0 {
				return errors.New("请先支付上一期款项")
			}
		}

		now := time.Now()
		plan.Status = 1
		plan.PaidAt = &now
		if err := tx.Save(&plan).Error; err != nil {
			return err
		}

		order.PaidAmount += plan.Amount
		if order.PaidAmount >= order.TotalAmount {
			order.Status = model.OrderStatusPaid
			order.PaidAt = &now
		}
		if err := tx.Save(&order).Error; err != nil {
			return err
		}

		if order.OrderType == model.OrderTypeConstruction && project.PaymentPaused {
			if err := (&ProjectService{}).resumeProjectExecutionAfterPaymentTx(tx, &project); err != nil {
				return err
			}
		}

		return tx.First(&updatedPlan, plan.ID).Error
	})
	if err != nil {
		return nil, err
	}

	return &updatedPlan, nil
}

// GetOrdersByProject 获取项目的所有订单
func (s *OrderService) GetOrdersByProject(projectID uint64) ([]model.Order, error) {
	var orders []model.Order
	if err := repository.DB.Where("project_id = ?", projectID).Find(&orders).Error; err != nil {
		return nil, err
	}
	return orders, nil
}

func (s *OrderService) GetProjectBillForOwner(projectID, userID uint64) ([]ProjectBillItem, error) {
	var project model.Project
	if err := repository.DB.Select("id, owner_id").First(&project, projectID).Error; err != nil {
		return nil, errors.New("项目不存在")
	}
	if project.OwnerID != userID {
		return nil, errors.New("无权查看此项目账单")
	}

	orders, err := s.GetOrdersByProject(projectID)
	if err != nil {
		return nil, err
	}

	result := make([]ProjectBillItem, 0, len(orders))
	for _, order := range orders {
		plans, err := s.GetPaymentPlansByOrder(order.ID)
		if err != nil {
			return nil, err
		}
		result = append(result, ProjectBillItem{
			Order:        order,
			PaymentPlans: plans,
		})
	}

	return result, nil
}

// GetPaymentPlansByOrder 获取订单的支付计划
func (s *OrderService) GetPaymentPlansByOrder(orderID uint64) ([]model.PaymentPlan, error) {
	var plans []model.PaymentPlan
	if err := repository.DB.Where("order_id = ?", orderID).Order("seq ASC").Find(&plans).Error; err != nil {
		return nil, err
	}
	if len(plans) == 0 {
		return plans, nil
	}
	var order model.Order
	if err := repository.DB.First(&order, orderID).Error; err == nil {
		if err := repairPaidOrderPlansIfNeeded(&order, plans); err != nil {
			return nil, err
		}
		var project model.Project
		var projectRef *model.Project
		if order.ProjectID > 0 {
			if err := repository.DB.First(&project, order.ProjectID).Error; err == nil {
				projectRef = &project
			}
		}
		milestones := make(map[uint64]model.Milestone)
		for idx := range plans {
			var milestoneRef *model.Milestone
			if plans[idx].MilestoneID > 0 {
				if cached, ok := milestones[plans[idx].MilestoneID]; ok {
					milestoneRef = &cached
				} else {
					var milestone model.Milestone
					if err := repository.DB.First(&milestone, plans[idx].MilestoneID).Error; err == nil {
						milestones[milestone.ID] = milestone
						milestoneRef = &milestone
					}
				}
			}
			applyPaymentPlanState(&plans[idx], projectRef, milestoneRef)
		}
	}
	return plans, nil
}

// ListOrdersForUser 获取用户订单列表
func (s *OrderService) ListOrdersForUser(userID uint64, status *int8, page, pageSize int) ([]UserOrderListItem, int64, error) {
	if userID == 0 {
		return nil, 0, errors.New("无效用户")
	}
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 10
	}

	var bookingIDs []uint64
	if err := repository.DB.Model(&model.Booking{}).
		Where("user_id = ?", userID).
		Pluck("id", &bookingIDs).Error; err != nil {
		return nil, 0, err
	}

	var projectIDs []uint64
	if err := repository.DB.Model(&model.Project{}).
		Where("owner_id = ?", userID).
		Pluck("id", &projectIDs).Error; err != nil {
		return nil, 0, err
	}

	var proposalIDs []uint64
	if len(bookingIDs) > 0 {
		if err := repository.DB.Model(&model.Proposal{}).
			Where("booking_id IN ?", bookingIDs).
			Pluck("id", &proposalIDs).Error; err != nil {
			return nil, 0, err
		}
	}

	query := repository.DB.Model(&model.Order{})
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
		return []UserOrderListItem{}, 0, nil
	}

	if status != nil {
		query = query.Where("status = ?", *status)
	}

	var orders []model.Order
	if err := query.Order("created_at DESC").Find(&orders).Error; err != nil {
		return nil, 0, err
	}

	records := make([]userOrderAggregateRecord, 0, len(orders))
	for _, order := range orders {
		providerName, address, err := s.resolveOrderContext(&order)
		if err != nil {
			return nil, 0, err
		}

		records = append(records, userOrderAggregateRecord{
			item: UserOrderListItem{
				ID:            order.ID,
				RecordType:    "order",
				OrderNo:       order.OrderNo,
				OrderType:     order.OrderType,
				Status:        order.Status,
				Amount:        order.TotalAmount - order.Discount,
				TotalAmount:   order.TotalAmount,
				PaidAmount:    order.PaidAmount,
				Discount:      order.Discount,
				CreatedAt:     &order.CreatedAt,
				PaidAt:        order.PaidAt,
				ProviderName:  providerName,
				Address:       address,
				NextPayableAt: order.ExpireAt,
				BookingID:     order.BookingID,
				ProposalID:    order.ProposalID,
				ProjectID:     order.ProjectID,
			},
			createdAt: order.CreatedAt,
		})
	}

	if status == nil || *status == model.OrderStatusPending {
		var pendingSurveyBookings []model.Booking
		if err := repository.DB.
			Where("user_id = ? AND survey_deposit_paid = ? AND status = ?", userID, false, 2).
			Order("created_at DESC").
			Find(&pendingSurveyBookings).Error; err != nil {
			return nil, 0, err
		}

		for _, booking := range pendingSurveyBookings {
			item, err := s.buildPendingSurveyDepositListItem(&booking)
			if err != nil {
				return nil, 0, err
			}
			records = append(records, userOrderAggregateRecord{
				item:      item,
				createdAt: booking.CreatedAt,
			})
		}
	}

	if status == nil || *status == model.OrderStatusPaid {
		var paymentOrders []model.PaymentOrder
		if err := repository.DB.
			Where("payer_user_id = ? AND biz_type IN ? AND status = ?",
				userID,
				[]string{model.PaymentBizTypeBookingIntent, model.PaymentBizTypeBookingSurveyDeposit},
				model.PaymentStatusPaid,
			).
			Order("created_at DESC").
			Find(&paymentOrders).Error; err != nil {
			return nil, 0, err
		}

		for _, payment := range paymentOrders {
			item, err := s.buildPaymentListItem(&payment)
			if err != nil {
				return nil, 0, err
			}
			recordTime := payment.CreatedAt
			if payment.PaidAt != nil {
				recordTime = *payment.PaidAt
			}
			records = append(records, userOrderAggregateRecord{
				item:      item,
				createdAt: recordTime,
			})
		}
	}

	sort.SliceStable(records, func(i, j int) bool {
		return records[i].createdAt.After(records[j].createdAt)
	})

	total := int64(len(records))
	start := (page - 1) * pageSize
	if start >= len(records) {
		return []UserOrderListItem{}, total, nil
	}
	end := start + pageSize
	if end > len(records) {
		end = len(records)
	}

	items := make([]UserOrderListItem, 0, end-start)
	for _, record := range records[start:end] {
		items = append(items, record.item)
	}

	return items, total, nil
}

// GetOrderForUser 获取用户可访问的订单详情
func (s *OrderService) GetOrderForUser(userID, orderID uint64) (*model.Order, error) {
	var order model.Order
	if err := repository.DB.First(&order, orderID).Error; err != nil {
		return nil, errors.New("订单不存在")
	}

	if order.ProjectID > 0 {
		var project model.Project
		if err := repository.DB.First(&project, order.ProjectID).Error; err != nil {
			return nil, errors.New("关联项目不存在")
		}
		if project.OwnerID != userID {
			return nil, errors.New("无权查看此订单")
		}
		return &order, nil
	}

	booking, _, err := s.resolveBookingAndProject(&order)
	if err != nil {
		return nil, err
	}
	if booking == nil {
		return nil, errors.New("订单不存在")
	}
	if booking.UserID != userID {
		return nil, errors.New("无权查看此订单")
	}

	return &order, nil
}

// GetPaymentPlansForUser 获取用户可访问订单的支付计划
func (s *OrderService) GetPaymentPlansForUser(userID, orderID uint64) ([]model.PaymentPlan, error) {
	var order model.Order
	if err := repository.DB.First(&order, orderID).Error; err != nil {
		return nil, errors.New("订单不存在")
	}

	if order.ProjectID > 0 {
		var project model.Project
		if err := repository.DB.First(&project, order.ProjectID).Error; err != nil {
			return nil, errors.New("项目不存在")
		}
		if project.OwnerID != userID {
			return nil, errors.New("无权查看此订单")
		}
	} else {
		booking, _, err := s.resolveBookingAndProject(&order)
		if err != nil {
			return nil, err
		}
		if booking == nil {
			return nil, errors.New("订单数据异常")
		}
		if booking.UserID != userID {
			return nil, errors.New("无权查看此订单")
		}
	}

	return s.GetPaymentPlansByOrder(order.ID)
}

// generateOrderNo 生成订单号
func (s *OrderService) generateOrderNo(orderType string) (string, error) {
	return generateBusinessOrderNo(orderType)
}

// CanAccessDesignFiles 检查用户是否有权限访问设计文件
func (s *OrderService) CanAccessDesignFiles(userID, projectID uint64) (bool, error) {
	// 1. 验证项目归属
	var project model.Project
	if err := repository.DB.First(&project, projectID).Error; err != nil {
		return false, errors.New("项目不存在")
	}
	if project.OwnerID != userID {
		return false, errors.New("无权访问此项目")
	}

	// 2. 检查设计费是否已支付
	var designOrder model.Order
	if err := repository.DB.Where("project_id = ? AND order_type = ?", projectID, model.OrderTypeDesign).
		First(&designOrder).Error; err != nil {
		return false, nil // 没有设计费订单
	}

	return designOrder.Status == model.OrderStatusPaid, nil
}

func (s *OrderService) resolveOrderContext(order *model.Order) (string, string, error) {
	booking, project, err := s.resolveBookingAndProject(order)
	if err != nil {
		return "", "", err
	}

	var providerID uint64
	address := ""
	if booking != nil {
		providerID = booking.ProviderID
		address = booking.Address
	}
	if project != nil {
		if providerID == 0 {
			providerID = project.ProviderID
		}
		if address == "" {
			address = project.Address
		}
	}

	providerName, err := s.getProviderName(providerID)
	if err != nil {
		return "", "", err
	}

	return providerName, address, nil
}

func (s *OrderService) resolveBookingAndProject(order *model.Order) (*model.Booking, *model.Project, error) {
	var booking *model.Booking
	var project *model.Project

	if order.BookingID > 0 {
		record := &model.Booking{}
		if err := repository.DB.First(record, order.BookingID).Error; err != nil {
			return nil, nil, errors.New("关联预约不存在")
		}
		booking = record
	}

	if order.ProjectID > 0 {
		record := &model.Project{}
		if err := repository.DB.First(record, order.ProjectID).Error; err != nil {
			return nil, nil, errors.New("关联项目不存在")
		}
		project = record
	}

	if booking == nil && order.ProposalID > 0 {
		var proposal model.Proposal
		if err := repository.DB.First(&proposal, order.ProposalID).Error; err != nil {
			return nil, nil, errors.New("关联方案不存在")
		}

		record := &model.Booking{}
		if err := repository.DB.First(record, proposal.BookingID).Error; err != nil {
			return nil, nil, errors.New("关联预约不存在")
		}
		booking = record
	}

	return booking, project, nil
}

func (s *OrderService) getProviderName(providerID uint64) (string, error) {
	if providerID == 0 {
		return "", nil
	}

	var provider model.Provider
	if err := repository.DB.First(&provider, providerID).Error; err != nil {
		return "", errors.New("关联服务商不存在")
	}

	var user model.User
	if err := repository.DB.First(&user, provider.UserID).Error; err == nil {
		return ResolveProviderDisplayName(provider, &user), nil
	}

	return ResolveProviderDisplayName(provider, nil), nil
}

func (s *OrderService) buildPaymentListItem(payment *model.PaymentOrder) (UserOrderListItem, error) {
	if payment == nil {
		return UserOrderListItem{}, errors.New("支付记录不存在")
	}

	providerName, address, err := s.resolvePaymentContext(payment)
	if err != nil {
		return UserOrderListItem{}, err
	}

	title := strings.TrimSpace(payment.Subject)
	if title == "" {
		title = fmt.Sprintf("支付记录 #%d", payment.ID)
	}

	orderType := "survey_deposit"
	bookingID := uint64(0)
	switch payment.BizType {
	case model.PaymentBizTypeBookingIntent, model.PaymentBizTypeBookingSurveyDeposit:
		bookingID = payment.BizID
	}

	createdAt := payment.CreatedAt
	paidAt := payment.PaidAt

	return UserOrderListItem{
		ID:           payment.ID,
		RecordType:   "payment",
		OrderNo:      title,
		OrderType:    orderType,
		Status:       model.OrderStatusPaid,
		Amount:       payment.Amount,
		TotalAmount:  payment.Amount,
		PaidAmount:   payment.Amount,
		Discount:     0,
		CreatedAt:    &createdAt,
		PaidAt:       paidAt,
		ProviderName: providerName,
		Address:      address,
		BookingID:    bookingID,
		ActionPath:   fmt.Sprintf("/payments/%d", payment.ID),
	}, nil
}

func (s *OrderService) buildPendingSurveyDepositListItem(booking *model.Booking) (UserOrderListItem, error) {
	if booking == nil {
		return UserOrderListItem{}, errors.New("预约不存在")
	}

	providerName, err := s.getProviderName(booking.ProviderID)
	if err != nil {
		return UserOrderListItem{}, err
	}

	amount := booking.SurveyDeposit
	if amount <= 0 {
		amount = booking.IntentFee
	}
	createdAt := booking.CreatedAt

	return UserOrderListItem{
		ID:           booking.ID,
		RecordType:   "payment",
		OrderNo:      fmt.Sprintf("BK%08d", booking.ID),
		OrderType:    "survey_deposit",
		Status:       model.OrderStatusPending,
		Amount:       amount,
		TotalAmount:  amount,
		PaidAmount:   0,
		Discount:     0,
		CreatedAt:    &createdAt,
		ProviderName: providerName,
		Address:      booking.Address,
		BookingID:    booking.ID,
	}, nil
}

func (s *OrderService) resolvePaymentContext(payment *model.PaymentOrder) (string, string, error) {
	if payment == nil {
		return "", "", errors.New("支付记录不存在")
	}

	switch payment.BizType {
	case model.PaymentBizTypeBookingIntent, model.PaymentBizTypeBookingSurveyDeposit:
		var booking model.Booking
		if err := repository.DB.First(&booking, payment.BizID).Error; err != nil {
			return "", "", errors.New("关联预约不存在")
		}
		providerName, err := s.getProviderName(booking.ProviderID)
		if err != nil {
			return "", "", err
		}
		return providerName, booking.Address, nil
	default:
		return "", "", nil
	}
}
