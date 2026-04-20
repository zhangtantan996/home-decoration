package service

import (
	"errors"
	"fmt"
	"time"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
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
	if input == nil || input.ProjectID == 0 || input.MilestoneID == 0 || input.UserID == 0 {
		return nil, errors.New("参数不能为空")
	}

	var transaction *model.Transaction
	err := repository.DB.Transaction(func(tx *gorm.DB) error {
		// 验证项目和节点
		var project model.Project
		if err := tx.First(&project, input.ProjectID).Error; err != nil {
			return fmt.Errorf("项目不存在: %w", err)
		}

		var milestone model.Milestone
		if err := tx.Where("id = ? AND project_id = ?", input.MilestoneID, input.ProjectID).First(&milestone).Error; err != nil {
			return fmt.Errorf("节点不存在: %w", err)
		}

		// 验证节点状态
		if milestone.Status != 0 {
			return errors.New("节点已支付或已完成")
		}

		// 验证用户是项目所有者
		if project.OwnerID != input.UserID {
			return errors.New("只有项目所有者可以支付节点款项")
		}

		// 获取或创建托管账户（使用悲观锁）
		var escrow model.EscrowAccount
		err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("project_id = ?", input.ProjectID).
			First(&escrow).Error

		if err == gorm.ErrRecordNotFound {
			// 创建托管账户
			escrow = model.EscrowAccount{
				ProjectID:       input.ProjectID,
				UserID:          input.UserID,
				ProjectName:     project.Name,
				UserName:        "", // 需要从User表获取
				TotalAmount:     0,
				FrozenAmount:    0,
				AvailableAmount: 0,
				ReleasedAmount:  0,
				Status:          1, // 1:正常
			}
			if err := tx.Create(&escrow).Error; err != nil {
				return fmt.Errorf("创建托管账户失败: %w", err)
			}
		} else if err != nil {
			return fmt.Errorf("获取托管账户失败: %w", err)
		}

		// 验证托管账户状态
		if escrow.Status == 2 {
			return errors.New("托管账户已冻结")
		}
		if escrow.Status == 3 {
			return errors.New("托管账户已关闭")
		}

		// 更新托管账户余额
		escrow.TotalAmount += milestone.Amount
		escrow.AvailableAmount += milestone.Amount
		if err := tx.Save(&escrow).Error; err != nil {
			return fmt.Errorf("更新托管账户失败: %w", err)
		}

		// 更新节点状态
		now := time.Now()
		milestone.Status = 1 // 1:已支付待验收
		milestone.PaidAt = &now
		if err := tx.Save(&milestone).Error; err != nil {
			return fmt.Errorf("更新节点状态失败: %w", err)
		}

		// 创建交易记录
		orderID := fmt.Sprintf("MP%d%d%d", input.ProjectID, input.MilestoneID, time.Now().Unix())
		transaction = &model.Transaction{
			OrderID:     orderID,
			EscrowID:    escrow.ID,
			MilestoneID: input.MilestoneID,
			Type:        "deposit",
			Amount:      milestone.Amount,
			FromUserID:  input.UserID,
			FromAccount: input.PaymentType,
			ToUserID:    0, // 托管账户
			ToAccount:   "escrow",
			Status:      1, // 1:成功
			Remark:      fmt.Sprintf("支付%s款项", milestone.Name),
			CompletedAt: &now,
		}
		if err := tx.Create(transaction).Error; err != nil {
			return fmt.Errorf("创建交易记录失败: %w", err)
		}

		return nil
	})

	if err != nil {
		return nil, err
	}
	return transaction, nil
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
	if milestone.Status != 1 {
		return nil, errors.New("节点未支付或已完成")
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
		"projectId":         project.ID,
		"projectName":       project.Name,
		"totalAmount":       totalAmount,
		"paidAmount":        paidAmount,
		"releasedAmount":    releasedAmount,
		"milestoneCount":    len(milestones),
		"paidCount":         paidCount,
		"releasedCount":     releasedCount,
		"milestones":        milestones,
		"escrowAccount":     escrow,
		"constructionQuote": project.ConstructionQuote,
	}, nil
}
