package model

import (
	"math"

	"gorm.io/gorm"
)

func moneyAmountCent(amount float64) int64 {
	return int64(math.Round(amount * 100))
}

func moneyAmountFromCent(amountCent int64) float64 {
	return float64(amountCent) / 100
}

func normalizeMoneyAmount(amount float64) float64 {
	return moneyAmountFromCent(moneyAmountCent(amount))
}

func normalizeRefundStatus(status string) string {
	switch status {
	case PaymentRefundStatusPartialRefunded, PaymentRefundStatusRefunded:
		return status
	default:
		return PaymentRefundStatusNone
	}
}

func (p *PaymentOrder) BeforeSave(*gorm.DB) error {
	p.Amount = normalizeMoneyAmount(p.Amount)
	p.AmountCent = moneyAmountCent(p.Amount)
	p.RefundedAmount = normalizeMoneyAmount(p.RefundedAmount)
	p.RefundedAmountCent = moneyAmountCent(p.RefundedAmount)
	p.RefundStatus = normalizeRefundStatus(p.RefundStatus)
	return nil
}

func (r *RefundOrder) BeforeSave(*gorm.DB) error {
	r.Amount = normalizeMoneyAmount(r.Amount)
	r.AmountCent = moneyAmountCent(r.Amount)
	return nil
}

func (p *PaymentPlan) BeforeSave(*gorm.DB) error {
	p.Amount = normalizeMoneyAmount(p.Amount)
	p.AmountCent = moneyAmountCent(p.Amount)
	p.RefundedAmount = normalizeMoneyAmount(p.RefundedAmount)
	p.RefundedAmountCent = moneyAmountCent(p.RefundedAmount)
	p.RefundStatus = normalizeRefundStatus(p.RefundStatus)
	return nil
}

func (s *SettlementOrder) BeforeSave(*gorm.DB) error {
	s.GrossAmount = normalizeMoneyAmount(s.GrossAmount)
	s.GrossAmountCent = moneyAmountCent(s.GrossAmount)
	s.PlatformFee = normalizeMoneyAmount(s.PlatformFee)
	s.PlatformFeeCent = moneyAmountCent(s.PlatformFee)
	s.MerchantNetAmount = normalizeMoneyAmount(s.MerchantNetAmount)
	s.MerchantNetAmountCent = moneyAmountCent(s.MerchantNetAmount)
	s.RecoveryAmount = normalizeMoneyAmount(s.RecoveryAmount)
	s.RecoveryAmountCent = moneyAmountCent(s.RecoveryAmount)
	return nil
}

func (p *PayoutOrder) BeforeSave(*gorm.DB) error {
	p.Amount = normalizeMoneyAmount(p.Amount)
	p.AmountCent = moneyAmountCent(p.Amount)
	return nil
}

func (m *MerchantIncome) BeforeSave(*gorm.DB) error {
	m.Amount = normalizeMoneyAmount(m.Amount)
	m.AmountCent = moneyAmountCent(m.Amount)
	m.PlatformFee = normalizeMoneyAmount(m.PlatformFee)
	m.PlatformFeeCent = moneyAmountCent(m.PlatformFee)
	m.NetAmount = normalizeMoneyAmount(m.NetAmount)
	m.NetAmountCent = moneyAmountCent(m.NetAmount)
	return nil
}

func (m *MerchantWithdraw) BeforeSave(*gorm.DB) error {
	m.Amount = normalizeMoneyAmount(m.Amount)
	m.AmountCent = moneyAmountCent(m.Amount)
	return nil
}
