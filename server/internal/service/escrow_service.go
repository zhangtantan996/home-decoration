package service

import (
	"errors"
	"time"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type EscrowService struct{}

// EscrowDetail 托管账户详情
type EscrowDetail struct {
	model.EscrowAccount
	Transactions []model.Transaction `json:"transactions"`
}

// GetEscrowDetail 获取托管详情
func (s *EscrowService) GetEscrowDetail(projectID uint64) (*EscrowDetail, error) {
	var escrow model.EscrowAccount
	if err := repository.DB.Where("project_id = ?", projectID).First(&escrow).Error; err != nil {
		return nil, errors.New("托管账户不存在")
	}

	var transactions []model.Transaction
	repository.DB.Where("escrow_id = ?", escrow.ID).Order("created_at DESC").Find(&transactions)

	return &EscrowDetail{
		EscrowAccount: escrow,
		Transactions:  transactions,
	}, nil
}

// Deposit 充值/存入托管
func (s *EscrowService) Deposit(projectID, userID uint64, amount float64, milestoneID uint64) error {
	if amount <= 0 {
		return errors.New("金额必须大于0")
	}

	return repository.DB.Transaction(func(tx *gorm.DB) error {
		var escrow model.EscrowAccount
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("project_id = ?", projectID).First(&escrow).Error; err != nil {
			return errors.New("托管账户不存在")
		}

		// 更新账户余额
		escrow.TotalAmount += amount
		escrow.FrozenAmount += amount
		if err := tx.Save(&escrow).Error; err != nil {
			return err
		}

		// 创建交易记录
		trx := &model.Transaction{
			EscrowID:    escrow.ID,
			MilestoneID: milestoneID,
			Type:        "deposit",
			Amount:      amount,
			FromUserID:  userID,
			ToUserID:    0, // 0表示系统托管账户
			Status:      1, // 成功
			CompletedAt: nowTime(),
		}
		if err := tx.Create(trx).Error; err != nil {
			return err
		}

		// 如果关联了节点，更新节点状态为"待验收"（假设存入即开工）
		if milestoneID > 0 {
			tx.Model(&model.Milestone{}).Where("id = ?", milestoneID).Update("status", 1) // 1施工中
		}

		return nil
	})
}

// ReleaseFunds 释放资金给服务商
func (s *EscrowService) ReleaseFunds(projectID, userID uint64, milestoneID uint64) error {
	return repository.DB.Transaction(func(tx *gorm.DB) error {
		var escrow model.EscrowAccount
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("project_id = ?", projectID).First(&escrow).Error; err != nil {
			return errors.New("托管账户不存在")
		}

		// 获取节点信息
		var milestone model.Milestone
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&milestone, milestoneID).Error; err != nil {
			return errors.New("验收节点不存在")
		}

		if milestone.Status != 3 { // 3已通过
			return errors.New("节点未通过验收，无法释放资金")
		}

		amount := milestone.Amount
		if escrow.FrozenAmount < amount {
			return errors.New("冻结资金不足")
		}

		// 获取接收方(项目服务商)
		var project model.Project
		tx.First(&project, projectID)

		// 更新账户
		escrow.FrozenAmount -= amount
		escrow.ReleasedAmount += amount
		if err := tx.Save(&escrow).Error; err != nil {
			return err
		}

		// 创建交易记录
		trx := &model.Transaction{
			EscrowID:    escrow.ID,
			MilestoneID: milestoneID,
			Type:        "release",
			Amount:      amount,
			FromUserID:  0, // 系统
			ToUserID:    project.ProviderID,
			Status:      1,
			CompletedAt: nowTime(),
		}
		if err := tx.Create(trx).Error; err != nil {
			return err
		}

		// 更新节点状态
		tx.Model(&milestone).Updates(map[string]interface{}{
			"status":  4, // 已支付
			"paid_at": time.Now(),
		})

		return nil
	})
}

func nowTime() *time.Time {
	t := time.Now()
	return &t
}
