package service

import (
	"errors"
	"fmt"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"

	"gorm.io/gorm"
)

type MilestonePaymentService struct{}

// MilestonePaymentPlan 节点付款计划
type MilestonePaymentPlan struct {
	Name       string  `json:"name"`
	Seq        int8    `json:"seq"`
	Percentage float32 `json:"percentage"`
	Criteria   string  `json:"criteria"`
}

// DefaultMilestonePaymentPlans 默认4节点付款计划
var DefaultMilestonePaymentPlans = []MilestonePaymentPlan{
	{Name: "开工节点", Seq: 1, Percentage: 30, Criteria: "施工队进场，材料到位，开工交底完成"},
	{Name: "水电节点", Seq: 2, Percentage: 30, Criteria: "水电改造完成，隐蔽工程验收通过"},
	{Name: "中期节点", Seq: 3, Percentage: 30, Criteria: "泥木工程完成，墙面基层处理完成"},
	{Name: "验收节点", Seq: 4, Percentage: 10, Criteria: "全部施工完成，竣工验收通过"},
}

// CreateMilestonePaymentPlanInput 创建节点付款计划输入
type CreateMilestonePaymentPlanInput struct {
	ProjectID         uint64
	ConstructionQuote float64
	CustomPlans       []MilestonePaymentPlan // 可选：自定义计划
}

// PayMilestoneInput 支付节点款项输入
type PayMilestoneInput struct {
	ProjectID   uint64
	MilestoneID uint64
	UserID      uint64
	PaymentType string // wechat, alipay, balance
}

// CreateMilestonePaymentPlan 创建节点付款计划
func (s *MilestonePaymentService) CreateMilestonePaymentPlan(input *CreateMilestonePaymentPlanInput) ([]model.Milestone, error) {
	if input == nil || input.ProjectID == 0 {
		return nil, errors.New("项目ID不能为空")
	}
	if input.ConstructionQuote <= 0 {
		return nil, errors.New("施工报价必须大于0")
	}

	var milestones []model.Milestone
	err := repository.DB.Transaction(func(tx *gorm.DB) error {
		// 验证项目存在
		var project model.Project
		if err := tx.First(&project, input.ProjectID).Error; err != nil {
			return fmt.Errorf("项目不存在: %w", err)
		}

		// 检查是否已创建节点
		var existingCount int64
		if err := tx.Model(&model.Milestone{}).Where("project_id = ?", input.ProjectID).Count(&existingCount).Error; err != nil {
			return err
		}
		if existingCount > 0 {
			return errors.New("该项目已创建节点付款计划")
		}

		// 使用自定义计划或默认计划
		plans := input.CustomPlans
		if len(plans) == 0 {
			plans = DefaultMilestonePaymentPlans
		}

		// 验证百分比总和为100%
		var totalPercentage float32
		for _, plan := range plans {
			totalPercentage += plan.Percentage
		}
		if totalPercentage != 100 {
			return fmt.Errorf("节点百分比总和必须为100%%，当前为%.2f%%", totalPercentage)
		}

		// 创建节点
		for _, plan := range plans {
			milestone := model.Milestone{
				ProjectID:  input.ProjectID,
				Name:       plan.Name,
				Seq:        plan.Seq,
				Percentage: plan.Percentage,
				Amount:     input.ConstructionQuote * float64(plan.Percentage) / 100,
				Criteria:   plan.Criteria,
				Status:     0, // 0:待支付
			}
			if err := tx.Create(&milestone).Error; err != nil {
				return fmt.Errorf("创建节点失败: %w", err)
			}
			milestones = append(milestones, milestone)
		}

		return nil
	})

	if err != nil {
		return nil, err
	}
	return milestones, nil
}

// PayMilestone 用户支付节点款项到托管账户
func (s *MilestonePaymentService) PayMilestone(input *PayMilestoneInput) (*model.Transaction, error) {
	return nil, errors.New("节点直付入口已停用，请通过订单中心发起支付")
}

// ReleaseMilestonePayment 用户确认节点完成后平台放款给商家
func (s *MilestonePaymentService) ReleaseMilestonePayment(projectID, milestoneID, userID uint64) (*ReleaseMilestoneResult, error) {
	if projectID == 0 || milestoneID == 0 || userID == 0 {
		return nil, errors.New("参数不能为空")
	}

	// 验证用户权限
	var project model.Project
	if err := repository.DB.First(&project, projectID).Error; err != nil {
		return nil, fmt.Errorf("项目不存在: %w", err)
	}
	if project.OwnerID != userID {
		return nil, errors.New("只有项目所有者可以确认节点完成")
	}

	// 验证节点状态
	var milestone model.Milestone
	if err := repository.DB.Where("id = ? AND project_id = ?", milestoneID, projectID).First(&milestone).Error; err != nil {
		return nil, fmt.Errorf("节点不存在: %w", err)
	}
	if milestone.Status != model.MilestoneStatusAccepted {
		return nil, errors.New("节点未通过验收，无法结算")
	}
	if milestone.ReleasedAt != nil {
		return nil, errors.New("节点已完成结算")
	}

	// 调用结算服务进行放款
	settlementService := &SettlementService{}
	input := &ReleaseMilestoneInput{
		ProjectID:    projectID,
		MilestoneID:  milestoneID,
		OperatorType: "user",
		OperatorID:   userID,
		Reason:       "用户确认节点完成",
		Source:       "milestone_payment",
	}

	result, err := settlementService.ReleaseMilestone(input)
	if err != nil {
		return nil, fmt.Errorf("放款失败: %w", err)
	}

	return result, nil
}

// GetMilestonePaymentStatus 获取项目节点付款状态
func (s *MilestonePaymentService) GetMilestonePaymentStatus(projectID uint64) (map[string]interface{}, error) {
	if projectID == 0 {
		return nil, errors.New("项目ID不能为空")
	}

	// 获取项目信息
	var project model.Project
	if err := repository.DB.First(&project, projectID).Error; err != nil {
		return nil, fmt.Errorf("项目不存在: %w", err)
	}

	// 获取托管账户
	var escrow model.EscrowAccount
	if err := repository.DB.Where("project_id = ?", projectID).First(&escrow).Error; err != nil && err != gorm.ErrRecordNotFound {
		return nil, fmt.Errorf("获取托管账户失败: %w", err)
	}

	// 获取所有节点
	var milestones []model.Milestone
	if err := repository.DB.Where("project_id = ?", projectID).Order("seq ASC").Find(&milestones).Error; err != nil {
		return nil, fmt.Errorf("获取节点列表失败: %w", err)
	}

	var constructionOrder model.Order
	var paymentPlans []model.PaymentPlan
	constructionOrderID := uint64(0)
	constructionOrderEntryKey := ""
	if err := repository.DB.
		Where("project_id = ? AND order_type = ?", projectID, model.OrderTypeConstruction).
		Order("id DESC").
		First(&constructionOrder).Error; err == nil {
		constructionOrderID = constructionOrder.ID
		constructionOrderEntryKey = fmt.Sprintf("construction_order:%d", constructionOrder.ID)
		paymentPlans, _ = (&OrderService{}).GetPaymentPlansByOrder(constructionOrder.ID)
	} else if err != gorm.ErrRecordNotFound {
		return nil, fmt.Errorf("获取施工订单失败: %w", err)
	}

	// 统计付款情况
	var totalAmount, paidAmount, releasedAmount float64
	var paidCount, releasedCount int
	for _, m := range milestones {
		totalAmount += m.Amount
		if m.PaidAt != nil {
			paidAmount += m.Amount
			paidCount++
		}
		if m.ReleasedAt != nil {
			releasedAmount += m.Amount
			releasedCount++
		}
	}

	return map[string]interface{}{
		"projectId":                 project.ID,
		"projectName":               project.Name,
		"totalAmount":               totalAmount,
		"paidAmount":                paidAmount,
		"releasedAmount":            releasedAmount,
		"milestoneCount":            len(milestones),
		"paidCount":                 paidCount,
		"releasedCount":             releasedCount,
		"milestones":                milestones,
		"paymentPlans":              paymentPlans,
		"constructionOrderId":       constructionOrderID,
		"constructionOrderEntryKey": constructionOrderEntryKey,
		"escrowAccount":             escrow,
		"constructionQuote":         project.ConstructionQuote,
	}, nil
}
