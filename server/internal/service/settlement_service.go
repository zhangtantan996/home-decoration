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

type SettlementService struct{}

type ReleaseMilestoneInput struct {
	ProjectID    uint64
	MilestoneID  uint64
	OperatorType string
	OperatorID   uint64
	Reason       string
	Source       string
}

type ReleaseMilestoneResult struct {
	Project        *model.Project
	Escrow         *model.EscrowAccount
	Milestone      *model.Milestone
	Transaction    *model.Transaction
	MerchantIncome *model.MerchantIncome
}

func (s *SettlementService) ReleaseMilestone(input *ReleaseMilestoneInput) (*ReleaseMilestoneResult, error) {
	var result *ReleaseMilestoneResult
	err := repository.DB.Transaction(func(tx *gorm.DB) error {
		released, err := s.ReleaseMilestoneTx(tx, input)
		if err != nil {
			return err
		}
		result = released
		return nil
	})
	if err != nil {
		return nil, err
	}
	return result, nil
}

func (s *SettlementService) ReleaseMilestoneTx(tx *gorm.DB, input *ReleaseMilestoneInput) (*ReleaseMilestoneResult, error) {
	if tx == nil {
		return nil, errors.New("事务不能为空")
	}
	if input == nil || input.ProjectID == 0 || input.MilestoneID == 0 {
		return nil, errors.New("项目和节点不能为空")
	}
	operatorType := strings.TrimSpace(input.OperatorType)
	if operatorType == "" {
		return nil, errors.New("操作主体不能为空")
	}

	var project model.Project
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&project, input.ProjectID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("项目不存在")
		}
		return nil, err
	}
	if operatorType == "user" && project.OwnerID != input.OperatorID {
		return nil, errors.New("无权释放此项目款项")
	}

	var milestone model.Milestone
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&milestone, input.MilestoneID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("验收节点不存在")
		}
		return nil, err
	}
	if milestone.ProjectID != input.ProjectID {
		return nil, errors.New("验收节点不属于当前项目")
	}
	if milestone.Status != model.MilestoneStatusAccepted {
		return nil, errors.New("节点未通过验收，无法放款")
	}
	if milestone.PaidAt != nil || milestone.ReleasedAt != nil {
		return nil, errors.New("当前节点已完成放款")
	}

	var escrow model.EscrowAccount
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("project_id = ?", input.ProjectID).First(&escrow).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("托管账户不存在")
		}
		return nil, err
	}
	if escrow.ProjectID != input.ProjectID {
		return nil, errors.New("托管账户与当前项目不匹配")
	}
	if escrow.Status == escrowStatusFrozen {
		return nil, errors.New("项目资金当前已冻结，无法放款")
	}
	if escrow.Status == escrowStatusClosed {
		return nil, errors.New("托管账户已关闭")
	}

	amount := milestone.Amount
	if amount <= 0 {
		return nil, errors.New("节点金额无效")
	}
	if escrow.AvailableAmount < amount {
		return nil, errors.New("可释放资金不足")
	}

	providerID := project.ConstructionProviderID
	if providerID == 0 {
		providerID = project.ProviderID
	}
	if providerID == 0 {
		return nil, errors.New("项目未绑定施工服务方")
	}
	receiverUserID := getProviderUserIDTx(tx, providerID)
	if receiverUserID == 0 {
		receiverUserID = providerID
	}

	now := time.Now()
	escrow.AvailableAmount -= amount
	escrow.ReleasedAmount += amount
	escrow.Status = reconcileEscrowStatus(&escrow)
	if err := tx.Save(&escrow).Error; err != nil {
		return nil, err
	}

	transaction := &model.Transaction{
		OrderID:     fmt.Sprintf("REL-%d-%d", input.ProjectID, now.UnixNano()),
		EscrowID:    escrow.ID,
		MilestoneID: milestone.ID,
		Type:        "release",
		Amount:      amount,
		FromUserID:  settlementFromUserID(operatorType, input.OperatorID),
		ToUserID:    receiverUserID,
		Status:      1,
		Remark:      buildSettlementRemark(input),
		CompletedAt: &now,
	}
	if err := tx.Create(transaction).Error; err != nil {
		return nil, err
	}

	orderID, bookingID := loadSettlementOrderMetaTx(tx, project.ID)
	platformFee, netAmount := calculateConstructionSettlement(amount)
	income := &model.MerchantIncome{
		ProviderID:  providerID,
		OrderID:     orderID,
		BookingID:   bookingID,
		Type:        "construction",
		Amount:      amount,
		PlatformFee: platformFee,
		NetAmount:   netAmount,
		Status:      1,
		SettledAt:   &now,
	}
	if err := tx.Create(income).Error; err != nil {
		return nil, err
	}

	if err := tx.Model(&milestone).Updates(map[string]interface{}{
		"status":      model.MilestoneStatusPaid,
		"paid_at":     now,
		"released_at": now,
	}).Error; err != nil {
		return nil, err
	}
	if err := tx.First(&milestone, milestone.ID).Error; err != nil {
		return nil, err
	}

	return &ReleaseMilestoneResult{
		Project:        &project,
		Escrow:         &escrow,
		Milestone:      &milestone,
		Transaction:    transaction,
		MerchantIncome: income,
	}, nil
}

func settlementFromUserID(operatorType string, operatorID uint64) uint64 {
	if strings.TrimSpace(operatorType) == "system" {
		return 0
	}
	return operatorID
}

func buildSettlementRemark(input *ReleaseMilestoneInput) string {
	if input == nil {
		return ""
	}
	parts := make([]string, 0, 2)
	if source := strings.TrimSpace(input.Source); source != "" {
		parts = append(parts, "source="+source)
	}
	if reason := strings.TrimSpace(input.Reason); reason != "" {
		parts = append(parts, reason)
	}
	return strings.Join(parts, " | ")
}

func calculateConstructionSettlement(amount float64) (float64, float64) {
	feeRate, err := (&ConfigService{}).GetConfigFloat(model.ConfigKeyConstructionFeeRate)
	if err != nil || feeRate <= 0 {
		feeRate = 0.10
	}
	platformFee := amount * feeRate
	netAmount := amount - platformFee
	if netAmount < 0 {
		netAmount = 0
		platformFee = amount
	}
	return platformFee, netAmount
}

func loadSettlementOrderMetaTx(tx *gorm.DB, projectID uint64) (uint64, uint64) {
	var order model.Order
	if err := tx.Where("project_id = ? AND order_type = ?", projectID, model.OrderTypeConstruction).
		Order("id DESC").First(&order).Error; err == nil {
		return order.ID, order.BookingID
	}
	if err := tx.Where("project_id = ?", projectID).Order("id DESC").First(&order).Error; err == nil {
		return order.ID, order.BookingID
	}
	return 0, 0
}
