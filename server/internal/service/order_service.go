package service

import (
	"errors"
	"fmt"
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	"time"
)

// OrderService 订单服务
type OrderService struct{}

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
		paymentType = "milestone" // 默认分期
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

					// 创建收入记录
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
	} else if order.ProjectID > 0 {
		var project model.Project
		if err := repository.DB.First(&project, order.ProjectID).Error; err == nil {
			var provider model.Provider
			if err := repository.DB.First(&provider, project.ProviderID).Error; err == nil {
				_ = notifService.NotifyOrderPaid(orderData, provider.UserID)

				// 创建收入记录
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
	var plan model.PaymentPlan
	if err := repository.DB.First(&plan, planID).Error; err != nil {
		return nil, errors.New("支付计划不存在")
	}

	var order model.Order
	if err := repository.DB.First(&order, plan.OrderID).Error; err != nil {
		return nil, errors.New("订单不存在")
	}

	// 验证项目归属
	var project model.Project
	if err := repository.DB.First(&project, order.ProjectID).Error; err != nil {
		return nil, errors.New("项目不存在")
	}
	if project.OwnerID != userID {
		return nil, errors.New("无权操作")
	}

	if plan.Status != 0 {
		return nil, errors.New("该期款项已支付")
	}

	// 检查前置期是否已支付
	if plan.Seq > 1 {
		var prevPlan model.PaymentPlan
		if err := repository.DB.Where("order_id = ? AND seq = ?", plan.OrderID, plan.Seq-1).First(&prevPlan).Error; err == nil {
			if prevPlan.Status == 0 {
				return nil, errors.New("请先支付上一期款项")
			}
		}
	}

	// 模拟支付成功
	now := time.Now()
	plan.Status = 1
	plan.PaidAt = &now

	if err := repository.DB.Save(&plan).Error; err != nil {
		return nil, err
	}

	// 更新订单已付金额
	order.PaidAmount += plan.Amount
	if order.PaidAmount >= order.TotalAmount {
		order.Status = model.OrderStatusPaid
		order.PaidAt = &now
	}
	repository.DB.Save(&order)

	return &plan, nil
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
