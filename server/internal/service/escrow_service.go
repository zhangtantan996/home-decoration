package service

import (
	"errors"
	"log"
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

func (s *EscrowService) GetEscrowDetailForOwner(projectID, userID uint64) (*EscrowDetail, error) {
	var project model.Project
	if err := repository.DB.Select("id, owner_id").First(&project, projectID).Error; err != nil {
		return nil, errors.New("项目不存在")
	}
	if project.OwnerID != userID {
		return nil, errors.New("无权查看此项目托管账户")
	}
	return s.GetEscrowDetail(projectID)
}

// Deposit 充值/存入托管
func (s *EscrowService) Deposit(projectID, userID uint64, amount float64, milestoneID uint64) error {
	return s.DepositForOwner(projectID, userID, amount, milestoneID)
}

func (s *EscrowService) DepositForOwner(projectID, userID uint64, amount float64, milestoneID uint64) error {
	if amount <= 0 {
		return errors.New("金额必须大于0")
	}

	return repository.DB.Transaction(func(tx *gorm.DB) error {
		var project model.Project
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Select("id, owner_id").First(&project, projectID).Error; err != nil {
			return errors.New("项目不存在")
		}
		if project.OwnerID != userID {
			return errors.New("无权为该项目充值")
		}

		var escrow model.EscrowAccount
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("project_id = ?", projectID).First(&escrow).Error; err != nil {
			return errors.New("托管账户不存在")
		}
		if escrow.ProjectID != projectID {
			return errors.New("托管账户与当前项目不匹配")
		}

		if milestoneID > 0 {
			var milestone model.Milestone
			if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Select("id, project_id").First(&milestone, milestoneID).Error; err != nil {
				return errors.New("验收节点不存在")
			}
			if milestone.ProjectID != projectID {
				return errors.New("验收节点不属于当前项目")
			}
		}

		// 更新账户余额
		escrow.TotalAmount += amount
		escrow.AvailableAmount += amount
		escrow.Status = reconcileEscrowStatus(&escrow)
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

		return nil
	})
}

// ReleaseFunds 释放资金给服务商
func (s *EscrowService) ReleaseFunds(projectID, userID uint64, milestoneID uint64) error {
	_, err := (&SettlementService{}).ReleaseMilestone(&ReleaseMilestoneInput{
		ProjectID:    projectID,
		MilestoneID:  milestoneID,
		OperatorType: "user",
		OperatorID:   userID,
		Reason:       "业主主动放款",
		Source:       "project.release",
	})
	return err
}

func nowTime() *time.Time {
	t := time.Now()
	return &t
}

func (s *EscrowService) releaseFundsTx(tx *gorm.DB, projectID, userID uint64, milestoneID uint64) (*model.EscrowAccount, *model.Transaction, *model.Milestone, *model.Project, error) {
	operatorType := "user"
	if userID == 0 {
		operatorType = "system"
	}
	result, err := (&SettlementService{}).ReleaseMilestoneTx(tx, &ReleaseMilestoneInput{
		ProjectID:    projectID,
		MilestoneID:  milestoneID,
		OperatorType: operatorType,
		OperatorID:   userID,
		Reason:       "托管账户放款",
		Source:       "escrow.release_tx",
	})
	if err != nil {
		return nil, nil, nil, nil, err
	}
	return result.Escrow, result.Transaction, result.Milestone, result.Project, nil
}

// ProcessScheduledReleases 定时任务: 处理已到期的 T+N 自动放款
// 由 cron job 定期调用（建议每小时一次）
func (s *EscrowService) ProcessScheduledReleases() (int, error) {
	count, err := (&SettlementService{}).ProcessDueSettlements(100)
	if err != nil {
		log.Printf("[ProcessScheduledReleases] 处理结算单失败: %v", err)
		_, _, _ = (&SystemAlertService{}).UpsertAlert(&CreateSystemAlertInput{
			Type:        SystemAlertTypeEscrowReleaseFailure,
			Level:       "high",
			Scope:       "自动放款/结算单批处理",
			Description: err.Error(),
			ActionURL:   "/risk/warnings",
		})
		return 0, err
	}
	_, _ = (&SystemAlertService{}).ResolveAlert(SystemAlertTypeEscrowReleaseFailure, "自动放款/结算单批处理", "自动放款恢复成功")
	return count, nil
}
