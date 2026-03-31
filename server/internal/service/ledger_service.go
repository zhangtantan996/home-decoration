package service

import (
	"errors"
	"strings"
	"time"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type LedgerService struct{}

type ledgerEntryRecord struct {
	FundScene       string
	DebitAccountID  uint64
	CreditAccountID uint64
	Amount          float64
	BizType         string
	BizID           uint64
	RuntimeType     string
	RuntimeID       uint64
	Remark          string
	Metadata        map[string]any
}

func (s *LedgerService) ensureAccountTx(tx *gorm.DB, accountType string, providerID, projectID uint64) (*model.LedgerAccount, error) {
	if tx == nil {
		tx = repository.DB
	}
	var account model.LedgerAccount
	err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
		Where("account_type = ? AND provider_id = ? AND project_id = ?", accountType, providerID, projectID).
		First(&account).Error
	if err == nil {
		return &account, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	account = model.LedgerAccount{
		AccountType: accountType,
		ProviderID:  providerID,
		ProjectID:   projectID,
		Currency:    "CNY",
	}
	if err := tx.Create(&account).Error; err != nil {
		return nil, err
	}
	return &account, nil
}

func (s *LedgerService) adjustBalanceTx(tx *gorm.DB, accountType string, providerID, projectID uint64, delta float64) (*model.LedgerAccount, error) {
	account, err := s.ensureAccountTx(tx, accountType, providerID, projectID)
	if err != nil {
		return nil, err
	}
	account.Balance = normalizeAmount(account.Balance + delta)
	now := time.Now()
	account.LastEntryAt = &now
	if err := tx.Model(account).Updates(map[string]any{
		"balance":       account.Balance,
		"last_entry_at": account.LastEntryAt,
	}).Error; err != nil {
		return nil, err
	}
	return account, nil
}

func (s *LedgerService) appendEntryTx(tx *gorm.DB, input ledgerEntryRecord) error {
	if tx == nil {
		tx = repository.DB
	}
	entry := &model.LedgerEntry{
		FundScene:       input.FundScene,
		DebitAccountID:  input.DebitAccountID,
		CreditAccountID: input.CreditAccountID,
		Amount:          normalizeAmount(input.Amount),
		BizType:         input.BizType,
		BizID:           input.BizID,
		RuntimeType:     input.RuntimeType,
		RuntimeID:       input.RuntimeID,
		Remark:          input.Remark,
		MetadataJSON:    mustMarshalJSON(input.Metadata),
		OccurredAt:      time.Now(),
	}
	return tx.Create(entry).Error
}

func (s *LedgerService) RecordPaymentReceivedTx(tx *gorm.DB, payment *model.PaymentOrder, projectID, providerID uint64) error {
	if payment == nil || stringsTrim(payment.FundScene) == "" || payment.Amount <= 0 {
		return nil
	}
	switch payment.FundScene {
	case model.FundSceneEntryFee:
		account, err := s.adjustBalanceTx(tx, model.LedgerAccountTypePlatformRevenue, 0, 0, payment.Amount)
		if err != nil {
			return err
		}
		return s.appendEntryTx(tx, ledgerEntryRecord{
			FundScene:       payment.FundScene,
			CreditAccountID: account.ID,
			Amount:          payment.Amount,
			BizType:         payment.BizType,
			BizID:           payment.BizID,
			RuntimeType:     "payment_order",
			RuntimeID:       payment.ID,
			Remark:          "支付成功入平台收入账",
			Metadata:        map[string]any{"providerId": providerID, "projectId": projectID},
		})
	case model.FundSceneMerchantDeposit:
		account, err := s.adjustBalanceTx(tx, model.LedgerAccountTypeMerchantDeposit, providerID, 0, payment.Amount)
		if err != nil {
			return err
		}
		return s.appendEntryTx(tx, ledgerEntryRecord{
			FundScene:       payment.FundScene,
			CreditAccountID: account.ID,
			Amount:          payment.Amount,
			BizType:         payment.BizType,
			BizID:           payment.BizID,
			RuntimeType:     "payment_order",
			RuntimeID:       payment.ID,
			Remark:          "支付成功入商家保证金账",
			Metadata:        map[string]any{"providerId": providerID},
		})
	case model.FundSceneSurveyDeposit, model.FundSceneDesignFee, model.FundSceneConstructionStage:
		if projectID == 0 {
			return nil
		}
		account, err := s.adjustBalanceTx(tx, model.LedgerAccountTypeProjectEscrow, 0, projectID, payment.Amount)
		if err != nil {
			return err
		}
		return s.appendEntryTx(tx, ledgerEntryRecord{
			FundScene:       payment.FundScene,
			CreditAccountID: account.ID,
			Amount:          payment.Amount,
			BizType:         payment.BizType,
			BizID:           payment.BizID,
			RuntimeType:     "payment_order",
			RuntimeID:       payment.ID,
			Remark:          "支付成功入项目托管账",
			Metadata:        map[string]any{"projectId": projectID, "providerId": providerID},
		})
	default:
		return nil
	}
}

func (s *LedgerService) RecordRefundTx(tx *gorm.DB, refund *model.RefundOrder, projectID, providerID uint64) error {
	if refund == nil || refund.Amount <= 0 {
		return nil
	}
	switch refund.FundScene {
	case model.FundSceneEntryFee:
		account, err := s.adjustBalanceTx(tx, model.LedgerAccountTypePlatformRevenue, 0, 0, -refund.Amount)
		if err != nil {
			return err
		}
		return s.appendEntryTx(tx, ledgerEntryRecord{
			FundScene:      model.FundSceneRefund,
			DebitAccountID: account.ID,
			Amount:         refund.Amount,
			BizType:        refund.BizType,
			BizID:          refund.BizID,
			RuntimeType:    "refund_order",
			RuntimeID:      refund.ID,
			Remark:         "退款冲减平台收入账",
			Metadata:       map[string]any{"projectId": projectID, "providerId": providerID},
		})
	case model.FundSceneMerchantDeposit:
		account, err := s.adjustBalanceTx(tx, model.LedgerAccountTypeMerchantDeposit, providerID, 0, -refund.Amount)
		if err != nil {
			return err
		}
		return s.appendEntryTx(tx, ledgerEntryRecord{
			FundScene:      model.FundSceneRefund,
			DebitAccountID: account.ID,
			Amount:         refund.Amount,
			BizType:        refund.BizType,
			BizID:          refund.BizID,
			RuntimeType:    "refund_order",
			RuntimeID:      refund.ID,
			Remark:         "退款冲减商家保证金账",
			Metadata:       map[string]any{"providerId": providerID},
		})
	case model.FundSceneSurveyDeposit, model.FundSceneDesignFee, model.FundSceneConstructionStage:
		if projectID == 0 {
			return nil
		}
		account, err := s.adjustBalanceTx(tx, model.LedgerAccountTypeProjectEscrow, 0, projectID, -refund.Amount)
		if err != nil {
			return err
		}
		return s.appendEntryTx(tx, ledgerEntryRecord{
			FundScene:      model.FundSceneRefund,
			DebitAccountID: account.ID,
			Amount:         refund.Amount,
			BizType:        refund.BizType,
			BizID:          refund.BizID,
			RuntimeType:    "refund_order",
			RuntimeID:      refund.ID,
			Remark:         "退款冲减项目托管账",
			Metadata:       map[string]any{"projectId": projectID, "providerId": providerID},
		})
	default:
		return nil
	}
}

func (s *LedgerService) RecordSettlementPendingTx(tx *gorm.DB, providerID, projectID uint64, grossAmount, netAmount, platformFee float64, bizType string, bizID uint64, runtimeType string, runtimeID uint64, remark string) error {
	if netAmount > 0 {
		account, err := s.adjustBalanceTx(tx, model.LedgerAccountTypeMerchantSettlementPending, providerID, projectID, netAmount)
		if err != nil {
			return err
		}
		if err := s.appendEntryTx(tx, ledgerEntryRecord{
			FundScene:       model.FundSceneSettlementPayout,
			CreditAccountID: account.ID,
			Amount:          netAmount,
			BizType:         bizType,
			BizID:           bizID,
			RuntimeType:     runtimeType,
			RuntimeID:       runtimeID,
			Remark:          remark,
			Metadata:        map[string]any{"providerId": providerID, "projectId": projectID, "grossAmount": grossAmount, "component": "merchant_settlement_pending"},
		}); err != nil {
			return err
		}
	}
	if platformFee > 0 {
		account, err := s.adjustBalanceTx(tx, model.LedgerAccountTypePlatformRevenue, 0, projectID, platformFee)
		if err != nil {
			return err
		}
		if err := s.appendEntryTx(tx, ledgerEntryRecord{
			FundScene:       model.FundSceneSettlementPayout,
			CreditAccountID: account.ID,
			Amount:          platformFee,
			BizType:         bizType,
			BizID:           bizID,
			RuntimeType:     runtimeType,
			RuntimeID:       runtimeID,
			Remark:          "结算投影入平台收入账",
			Metadata:        map[string]any{"providerId": providerID, "projectId": projectID, "grossAmount": grossAmount, "component": "platform_revenue"},
		}); err != nil {
			return err
		}
	}
	return nil
}

func (s *LedgerService) RecordSettlementPayoutTx(tx *gorm.DB, providerID, projectID uint64, grossAmount, netAmount float64, bizType string, bizID uint64, runtimeType string, runtimeID uint64, remark string) error {
	if projectID > 0 && grossAmount > 0 {
		account, err := s.adjustBalanceTx(tx, model.LedgerAccountTypeProjectEscrow, 0, projectID, -grossAmount)
		if err != nil {
			return err
		}
		if err := s.appendEntryTx(tx, ledgerEntryRecord{
			FundScene:      model.FundSceneSettlementPayout,
			DebitAccountID: account.ID,
			Amount:         grossAmount,
			BizType:        bizType,
			BizID:          bizID,
			RuntimeType:    runtimeType,
			RuntimeID:      runtimeID,
			Remark:         remark,
			Metadata:       map[string]any{"providerId": providerID, "projectId": projectID, "component": "project_escrow"},
		}); err != nil {
			return err
		}
	}
	if netAmount > 0 {
		pendingAccount, err := s.adjustBalanceTx(tx, model.LedgerAccountTypeMerchantSettlementPending, providerID, projectID, -netAmount)
		if err != nil {
			return err
		}
		if err := s.appendEntryTx(tx, ledgerEntryRecord{
			FundScene:      model.FundSceneSettlementPayout,
			DebitAccountID: pendingAccount.ID,
			Amount:         netAmount,
			BizType:        bizType,
			BizID:          bizID,
			RuntimeType:    runtimeType,
			RuntimeID:      runtimeID,
			Remark:         "出款核销待出款账",
			Metadata:       map[string]any{"providerId": providerID, "projectId": projectID, "component": "merchant_settlement_pending"},
		}); err != nil {
			return err
		}
		paidAccount, err := s.adjustBalanceTx(tx, model.LedgerAccountTypeMerchantSettlementPaid, providerID, projectID, netAmount)
		if err != nil {
			return err
		}
		if err := s.appendEntryTx(tx, ledgerEntryRecord{
			FundScene:       model.FundSceneSettlementPayout,
			CreditAccountID: paidAccount.ID,
			Amount:          netAmount,
			BizType:         bizType,
			BizID:           bizID,
			RuntimeType:     runtimeType,
			RuntimeID:       runtimeID,
			Remark:          "出款入已出款账",
			Metadata:        map[string]any{"providerId": providerID, "projectId": projectID, "component": "merchant_settlement_paid"},
		}); err != nil {
			return err
		}
	}
	return nil
}

func stringsTrim(value string) string {
	return strings.TrimSpace(value)
}
