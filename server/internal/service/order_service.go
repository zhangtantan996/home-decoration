package service

import (
	"errors"
	"fmt"
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	"time"

	"gorm.io/gorm"
)

// OrderService 订单服务
type OrderService struct{}

// UserOrderListItem 用户端订单列表项
type UserOrderListItem struct {
	ID            uint64     `json:"id"`
	OrderNo       string     `json:"orderNo"`
	Status        int8       `json:"status"`
	Amount        float64    `json:"amount"`
	ProviderName  string     `json:"providerName"`
	Address       string     `json:"address"`
	NextPayableAt *time.Time `json:"nextPayableAt"`
	ProposalID    uint64     `json:"proposalId"`
	ProjectID     uint64     `json:"projectId"`
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

	designOrder := &model.Order{
		ProjectID:   input.ProjectID,
		BookingID:   booking.ID,
		OrderNo:     s.generateOrderNo("D"),
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
	constructionOrder := &model.Order{
		ProjectID:   input.ProjectID,
		BookingID:   booking.ID,
		OrderNo:     s.generateOrderNo("C"),
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

// PayOrder 支付订单
func (s *OrderService) PayOrder(userID, orderID uint64) (*model.Order, error) {
	var order model.Order
	if err := repository.DB.First(&order, orderID).Error; err != nil {
		return nil, errors.New("订单不存在")
	}

	// 验证归属
	if order.ProjectID > 0 {
		var project model.Project
		if err := repository.DB.First(&project, order.ProjectID).Error; err != nil {
			return nil, errors.New("项目不存在")
		}
		if project.OwnerID != userID {
			return nil, errors.New("无权操作此订单")
		}
	} else {
		// 如果没有项目ID（如设计费订单），通过 Proposal -> Booking 验证
		var proposal model.Proposal
		if err := repository.DB.First(&proposal, order.ProposalID).Error; err != nil {
			return nil, errors.New("关联方案不存在")
		}
		var booking model.Booking
		if err := repository.DB.First(&booking, proposal.BookingID).Error; err != nil {
			return nil, errors.New("关联预约不存在")
		}
		if booking.UserID != userID {
			return nil, errors.New("无权操作此订单")
		}
	}

	if order.Status != model.OrderStatusPending {
		return nil, errors.New("订单状态不正确")
	}

	// 模拟支付成功
	now := time.Now()
	order.Status = model.OrderStatusPaid
	order.PaidAmount = order.TotalAmount - order.Discount
	order.PaidAt = &now

	if err := repository.DB.Save(&order).Error; err != nil {
		return nil, err
	}

	// 发送通知给商家 + 创建收入记录
	notifService := &NotificationService{}
	incomeService := &MerchantIncomeService{}
	orderData := map[string]interface{}{
		"id":     order.ID,
		"amount": order.TotalAmount - order.Discount,
	}

	// Get provider's user ID through booking
	if order.ProposalID > 0 {
		var proposal model.Proposal
		if err := repository.DB.First(&proposal, order.ProposalID).Error; err == nil {
			var booking model.Booking
			if err := repository.DB.First(&booking, proposal.BookingID).Error; err == nil {
				var provider model.Provider
				if err := repository.DB.First(&provider, booking.ProviderID).Error; err == nil {
					_ = notifService.NotifyOrderPaid(orderData, provider.UserID)

					// 施工订单不预创建收入，等里程碑验收后T+3释放
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
			}
		}
	} else if order.ProjectID > 0 {
		var project model.Project
		if err := repository.DB.First(&project, order.ProjectID).Error; err == nil {
			var provider model.Provider
			if err := repository.DB.First(&provider, project.ProviderID).Error; err == nil {
				_ = notifService.NotifyOrderPaid(orderData, provider.UserID)

				// 施工订单不预创建收入，等里程碑验收后T+3释放
				if order.OrderType != model.OrderTypeConstruction {
					_, _ = incomeService.CreateIncome(&CreateIncomeInput{
						ProviderID:  provider.ID,
						OrderID:     order.ID,
						BookingID:   0, // 无关联预约
						Type:        order.OrderType,
						Amount:      order.TotalAmount - order.Discount,
						Description: "订单支付",
					})
				}
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

	// 验证归属
	if order.ProjectID > 0 {
		var project model.Project
		if err := repository.DB.First(&project, order.ProjectID).Error; err != nil {
			return errors.New("项目不存在")
		}
		if project.OwnerID != userID {
			return errors.New("无权操作此订单")
		}
	} else {
		var proposal model.Proposal
		if err := repository.DB.First(&proposal, order.ProposalID).Error; err != nil {
			return errors.New("关联方案不存在")
		}
		var booking model.Booking
		if err := repository.DB.First(&booking, proposal.BookingID).Error; err != nil {
			return errors.New("关联预约不存在")
		}
		if booking.UserID != userID {
			return errors.New("无权操作此订单")
		}
	}

	if order.Status != model.OrderStatusPending {
		return errors.New("只能取消待支付订单")
	}

	order.Status = model.OrderStatusCancelled
	return repository.DB.Save(&order).Error
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

// GetPaymentPlansByOrder 获取订单的支付计划
func (s *OrderService) GetPaymentPlansByOrder(orderID uint64) ([]model.PaymentPlan, error) {
	var plans []model.PaymentPlan
	if err := repository.DB.Where("order_id = ?", orderID).Order("seq ASC").Find(&plans).Error; err != nil {
		return nil, err
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

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var orders []model.Order
	if err := query.Order("created_at DESC").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Find(&orders).Error; err != nil {
		return nil, 0, err
	}

	items := make([]UserOrderListItem, 0, len(orders))
	for _, order := range orders {
		providerName, address, err := s.resolveOrderContext(&order)
		if err != nil {
			return nil, 0, err
		}

		items = append(items, UserOrderListItem{
			ID:            order.ID,
			OrderNo:       order.OrderNo,
			Status:        order.Status,
			Amount:        order.TotalAmount - order.Discount,
			ProviderName:  providerName,
			Address:       address,
			NextPayableAt: order.ExpireAt,
			ProposalID:    order.ProposalID,
			ProjectID:     order.ProjectID,
		})
	}

	return items, total, nil
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
	} else if order.ProposalID > 0 {
		var proposal model.Proposal
		if err := repository.DB.First(&proposal, order.ProposalID).Error; err != nil {
			return nil, errors.New("关联方案不存在")
		}

		var booking model.Booking
		if err := repository.DB.First(&booking, proposal.BookingID).Error; err != nil {
			return nil, errors.New("关联预约不存在")
		}
		if booking.UserID != userID {
			return nil, errors.New("无权查看此订单")
		}
	} else {
		return nil, errors.New("订单数据异常")
	}

	return s.GetPaymentPlansByOrder(order.ID)
}

// generateOrderNo 生成订单号
func (s *OrderService) generateOrderNo(prefix string) string {
	return fmt.Sprintf("%s%d", prefix, time.Now().UnixNano())
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
	if err := repository.DB.First(&user, provider.UserID).Error; err == nil && user.Nickname != "" {
		return user.Nickname, nil
	}

	return provider.CompanyName, nil
}
