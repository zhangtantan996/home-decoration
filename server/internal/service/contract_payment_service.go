package service

import (
	"errors"
	"fmt"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
)

// StartContractDepositPayment 发起合同定金支付
func (s *PaymentService) StartContractDepositPayment(userID, contractID uint64, channel, terminalType string) (*PaymentLaunchResponse, error) {
	channel, terminalType, err := normalizePaymentChannelAndTerminal(channel, terminalType)
	if err != nil {
		return nil, err
	}

	if channel == model.PaymentChannelAlipay && terminalType == model.PaymentTerminalMobileH5 {
		if err := validateMiniAlipayH5Runtime(); err != nil {
			return nil, err
		}
	}

	var payment *model.PaymentOrder
	var miniProgramPay *PaymentChannelMiniProgramResult

	err = repository.DB.Transaction(func(tx *gorm.DB) error {
		var contract model.Contract
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&contract, contractID).Error; err != nil {
			return errors.New("合同不存在")
		}

		if contract.UserID != userID {
			return errors.New("无权操作此合同")
		}

		if contract.Status != model.ContractStatusSigned {
			return errors.New("合同尚未签署完成")
		}

		if contract.DepositPaid {
			return errors.New("定金已支付")
		}

		if contract.DepositAmount <= 0 {
			return errors.New("定金金额无效")
		}

		// 创建支付订单
		payment, err = s.createOrReusePaymentOrderTx(tx, &paymentCreateSpec{
			BizType:      model.PaymentBizTypeContractDeposit,
			BizID:        contract.ID,
			PayerUserID:  userID,
			Channel:      channel,
			Scene:        model.PaymentBizTypeContractDeposit,
			FundScene:    model.FundSceneContractDeposit,
			TerminalType: terminalType,
			Subject:      fmt.Sprintf("合同定金 #%s", contract.ContractNo),
			Amount:       contract.DepositAmount,
			ReturnCtx: map[string]any{
				"successPath": fmt.Sprintf("/contracts/%d", contract.ID),
				"cancelPath":  fmt.Sprintf("/contracts/%d", contract.ID),
				"bizType":     model.PaymentBizTypeContractDeposit,
				"bizId":       contract.ID,
				"contractNo":  contract.ContractNo,
			},
		})
		return err
	})

	if err != nil {
		return nil, err
	}

	// 微信小程序支付
	if channel == model.PaymentChannelWechat && terminalType == model.PaymentTerminalMiniWechatJSAPI {
		openID, openIDErr := s.resolveMiniWechatOpenID(userID)
		if openIDErr != nil {
			return nil, openIDErr
		}
		miniProgramPay, err = s.createMiniProgramLaunch(payment, openID)
		if err != nil {
			return nil, err
		}
	}

	return s.buildLaunchResponse(payment, miniProgramPay), nil
}

// HandleContractDepositPaymentSuccess 处理合同定金支付成功回调
func (s *PaymentService) HandleContractDepositPaymentSuccess(payment *model.PaymentOrder) error {
	if payment.BizType != model.PaymentBizTypeContractDeposit {
		return nil
	}

	return repository.DB.Transaction(func(tx *gorm.DB) error {
		var contract model.Contract
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&contract, payment.BizID).Error; err != nil {
			return fmt.Errorf("合同不存在: %w", err)
		}

		if contract.DepositPaid {
			return nil // 已处理
		}

		now := time.Now()
		updates := map[string]interface{}{
			"deposit_paid":       true,
			"deposit_paid_at":    now,
			"deposit_payment_id": payment.ID,
			"status":             model.ContractStatusConfirmed,
		}

		if err := tx.Model(&contract).Updates(updates).Error; err != nil {
			return fmt.Errorf("更新合同状态失败: %w", err)
		}

		// 如果有关联项目，更新项目状态
		if contract.ProjectID > 0 {
			if err := s.updateProjectAfterDepositPaid(tx, contract.ProjectID); err != nil {
				return err
			}
		}

		// 发送通知
		NewNotificationDispatcher().NotifyContractDepositPaid(contract.UserID, contract.ID, contract.ProjectID)
		NewNotificationDispatcher().NotifyContractDepositPaid(contract.ProviderID, contract.ID, contract.ProjectID)

		return nil
	})
}

// updateProjectAfterDepositPaid 定金支付后更新项目状态
func (s *PaymentService) updateProjectAfterDepositPaid(tx *gorm.DB, projectID uint64) error {
	var project model.Project
	if err := tx.First(&project, projectID).Error; err != nil {
		return nil // 项目不存在不影响支付流程
	}

	// 根据合同类型更新项目状态
	// 这里可以根据业务需求调整
	updates := map[string]interface{}{}
	if project.BusinessStatus == model.ProjectBusinessStatusDraft {
		updates["business_status"] = model.ProjectBusinessStatusProposalConfirmed
	}

	if len(updates) > 0 {
		return tx.Model(&project).Updates(updates).Error
	}

	return nil
}
