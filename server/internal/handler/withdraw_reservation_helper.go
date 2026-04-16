package handler

import (
	"errors"

	"home-decoration-server/internal/model"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

func reserveWithdrawIncomesTx(tx *gorm.DB, providerID uint64, withdrawOrderNo string, amount float64) error {
	if tx == nil {
		return errors.New("提现占用上下文无效")
	}
	if providerID == 0 || withdrawOrderNo == "" {
		return errors.New("提现占用参数无效")
	}
	remaining := roundMoney(amount)
	if remaining <= 0 {
		return errors.New("提现金额无效")
	}

	var incomes []model.MerchantIncome
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
		Where("provider_id = ? AND status = ? AND COALESCE(withdraw_order_no, '') = ''", providerID, 1).
		Order("created_at ASC, id ASC").
		Find(&incomes).Error; err != nil {
		return err
	}

	for _, income := range incomes {
		if remaining <= 0 {
			break
		}
		available := roundMoney(income.NetAmount)
		if available <= 0 {
			continue
		}

		if available <= remaining {
			if err := tx.Model(&income).Update("withdraw_order_no", withdrawOrderNo).Error; err != nil {
				return err
			}
			remaining = roundMoney(remaining - available)
			continue
		}

		if err := splitReservedIncomeTx(tx, &income, withdrawOrderNo, remaining); err != nil {
			return err
		}
		remaining = 0
	}

	if remaining > 0 {
		return errors.New("可提现收入不足")
	}
	return nil
}

func releaseWithdrawIncomesTx(tx *gorm.DB, withdrawOrderNo string) error {
	if tx == nil {
		return errors.New("提现释放上下文无效")
	}
	if withdrawOrderNo == "" {
		return errors.New("提现单号无效")
	}
	return tx.Model(&model.MerchantIncome{}).
		Where("status = ? AND withdraw_order_no = ?", 1, withdrawOrderNo).
		Update("withdraw_order_no", "").Error
}

func splitReservedIncomeTx(tx *gorm.DB, income *model.MerchantIncome, withdrawOrderNo string, reservedNetAmount float64) error {
	if tx == nil || income == nil {
		return errors.New("收入拆分上下文无效")
	}
	reservedNetAmount = roundMoney(reservedNetAmount)
	if reservedNetAmount <= 0 || reservedNetAmount >= roundMoney(income.NetAmount) {
		return errors.New("收入拆分金额无效")
	}

	ratio := reservedNetAmount / income.NetAmount
	reservedAmount := roundMoney(income.Amount * ratio)
	reservedPlatformFee := roundMoney(income.PlatformFee * ratio)

	reservedIncome := *income
	reservedIncome.Base = model.Base{}
	reservedIncome.Amount = reservedAmount
	reservedIncome.PlatformFee = reservedPlatformFee
	reservedIncome.NetAmount = reservedNetAmount
	reservedIncome.Status = 1
	reservedIncome.WithdrawOrderNo = withdrawOrderNo
	if err := tx.Create(&reservedIncome).Error; err != nil {
		return err
	}

	remainingAmount := roundMoney(income.Amount - reservedAmount)
	remainingPlatformFee := roundMoney(income.PlatformFee - reservedPlatformFee)
	remainingNetAmount := roundMoney(income.NetAmount - reservedNetAmount)
	if remainingNetAmount <= 0 {
		return errors.New("收入拆分后剩余金额无效")
	}

	return tx.Model(income).Updates(map[string]any{
		"amount":            remainingAmount,
		"platform_fee":      remainingPlatformFee,
		"net_amount":        remainingNetAmount,
		"withdraw_order_no": "",
	}).Error
}
