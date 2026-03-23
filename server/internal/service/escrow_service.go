package service

import (
	"errors"
	"fmt"
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
	var milestones []model.Milestone
	now := time.Now()

	// 查询所有到期且未放款的里程碑
	if err := repository.DB.Where(
		"status = ? AND release_scheduled_at IS NOT NULL AND release_scheduled_at <= ? AND released_at IS NULL",
		model.MilestoneStatusAccepted, now,
	).Find(&milestones).Error; err != nil {
		return 0, fmt.Errorf("查询到期里程碑失败: %w", err)
	}

	if len(milestones) == 0 {
		return 0, nil
	}

	successCount := 0
	settlementSvc := &SettlementService{}
	alertSvc := &SystemAlertService{}

	for _, ms := range milestones {
		released := false
		scope := fmt.Sprintf("自动放款/项目%d/节点%d", ms.ProjectID, ms.ID)
		err := repository.DB.Transaction(func(tx *gorm.DB) error {
			// 查询关联项目
			var project model.Project
			if err := tx.First(&project, ms.ProjectID).Error; err != nil {
				return fmt.Errorf("项目不存在: %w", err)
			}

			// 暂停中的项目跳过
			if project.PaymentPaused {
				return nil
			}

			if _, err := settlementSvc.ReleaseMilestoneTx(tx, &ReleaseMilestoneInput{
				ProjectID:    ms.ProjectID,
				MilestoneID:  ms.ID,
				OperatorType: "system",
				OperatorID:   0,
				Reason:       "定时自动放款",
				Source:       "scheduled.release",
			}); err != nil {
				return fmt.Errorf("释放资金失败: %w", err)
			}
			released = true
			return nil
		})

		if err != nil {
			log.Printf("[ProcessScheduledReleases] milestone %d 放款失败: %v", ms.ID, err)
			_, _, _ = alertSvc.UpsertAlert(&CreateSystemAlertInput{
				Type:        SystemAlertTypeEscrowReleaseFailure,
				Level:       "high",
				Scope:       scope,
				ProjectID:   ms.ProjectID,
				Description: err.Error(),
				ActionURL:   "/risk/warnings",
			})
			continue
		}

		if released {
			successCount++
			_, _ = alertSvc.ResolveAlert(SystemAlertTypeEscrowReleaseFailure, scope, "自动放款恢复成功")
		}
	}

	return successCount, nil
}
