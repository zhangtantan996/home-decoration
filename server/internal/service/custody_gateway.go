package service

import (
	"context"
	"time"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	"home-decoration-server/pkg/timeutil"
)

type CustodyInboundPaymentResult struct {
	ProviderTradeNo string `json:"providerTradeNo"`
	Status          string `json:"status"`
	RawJSON         string `json:"rawJson"`
}

type CustodyPayoutResult struct {
	ProviderPayoutNo string     `json:"providerPayoutNo"`
	Status           string     `json:"status"`
	PaidAt           *time.Time `json:"paidAt"`
	FailureReason    string     `json:"failureReason"`
	RawJSON          string     `json:"rawJson"`
}

type CustodyBillItem struct {
	Direction  string    `json:"direction"`
	FundScene  string    `json:"fundScene"`
	OutNo      string    `json:"outNo"`
	ProviderNo string    `json:"providerNo"`
	BizType    string    `json:"bizType"`
	BizID      uint64    `json:"bizId"`
	Amount     float64   `json:"amount"`
	Status     string    `json:"status"`
	OccurredAt time.Time `json:"occurredAt"`
}

type CustodyGateway interface {
	EnsureAccount(ctx context.Context, providerID uint64) error
	CreateInboundPayment(ctx context.Context, payment *model.PaymentOrder) (*CustodyInboundPaymentResult, error)
	QueryPayment(ctx context.Context, payment *model.PaymentOrder) (*CustodyInboundPaymentResult, error)
	Refund(ctx context.Context, payment *model.PaymentOrder, refund *model.RefundOrder) (*CustodyInboundPaymentResult, error)
	CreatePayout(ctx context.Context, payout *model.PayoutOrder) (*CustodyPayoutResult, error)
	QueryPayout(ctx context.Context, payout *model.PayoutOrder) (*CustodyPayoutResult, error)
	PullBill(ctx context.Context, targetDate time.Time) ([]CustodyBillItem, error)
}

type LocalCustodyGateway struct{}

func NewCustodyGateway() CustodyGateway {
	return &LocalCustodyGateway{}
}

func (g *LocalCustodyGateway) EnsureAccount(_ context.Context, _ uint64) error {
	return nil
}

func (g *LocalCustodyGateway) CreateInboundPayment(_ context.Context, payment *model.PaymentOrder) (*CustodyInboundPaymentResult, error) {
	if payment == nil {
		return nil, nil
	}
	return &CustodyInboundPaymentResult{
		ProviderTradeNo: payment.ProviderTradeNo,
		Status:          payment.Status,
		RawJSON:         mustMarshalJSON(map[string]any{"mode": "local", "outTradeNo": payment.OutTradeNo}),
	}, nil
}

func (g *LocalCustodyGateway) QueryPayment(ctx context.Context, payment *model.PaymentOrder) (*CustodyInboundPaymentResult, error) {
	return g.CreateInboundPayment(ctx, payment)
}

func (g *LocalCustodyGateway) Refund(_ context.Context, payment *model.PaymentOrder, refund *model.RefundOrder) (*CustodyInboundPaymentResult, error) {
	if payment == nil || refund == nil {
		return nil, nil
	}
	return &CustodyInboundPaymentResult{
		ProviderTradeNo: firstNonEmpty(payment.ProviderTradeNo, refund.OutRefundNo),
		Status:          refund.Status,
		RawJSON:         mustMarshalJSON(map[string]any{"mode": "local", "outRefundNo": refund.OutRefundNo}),
	}, nil
}

func (g *LocalCustodyGateway) CreatePayout(_ context.Context, payout *model.PayoutOrder) (*CustodyPayoutResult, error) {
	if payout == nil {
		return nil, nil
	}
	now := time.Now()
	return &CustodyPayoutResult{
		ProviderPayoutNo: "SIM-" + payout.OutPayoutNo,
		Status:           model.PayoutStatusPaid,
		PaidAt:           &now,
		RawJSON:          mustMarshalJSON(map[string]any{"mode": "local", "outPayoutNo": payout.OutPayoutNo, "status": model.PayoutStatusPaid}),
	}, nil
}

func (g *LocalCustodyGateway) QueryPayout(_ context.Context, payout *model.PayoutOrder) (*CustodyPayoutResult, error) {
	if payout == nil {
		return nil, nil
	}
	return &CustodyPayoutResult{
		ProviderPayoutNo: firstNonEmpty(payout.ProviderPayoutNo, "SIM-"+payout.OutPayoutNo),
		Status:           payout.Status,
		PaidAt:           payout.PaidAt,
		FailureReason:    payout.FailureReason,
		RawJSON:          mustMarshalJSON(map[string]any{"mode": "local", "outPayoutNo": payout.OutPayoutNo, "status": payout.Status}),
	}, nil
}

func (g *LocalCustodyGateway) PullBill(_ context.Context, targetDate time.Time) ([]CustodyBillItem, error) {
	start := timeutil.StartOfDay(targetDate)
	end := start.Add(24 * time.Hour)
	items := make([]CustodyBillItem, 0, 16)

	var payments []model.PaymentOrder
	if err := repository.DB.Where("paid_at >= ? AND paid_at < ? AND status = ?", start, end, model.PaymentStatusPaid).Find(&payments).Error; err != nil {
		return nil, err
	}
	for _, payment := range payments {
		if payment.PaidAt == nil {
			continue
		}
		items = append(items, CustodyBillItem{
			Direction:  "inbound",
			FundScene:  payment.FundScene,
			OutNo:      payment.OutTradeNo,
			ProviderNo: payment.ProviderTradeNo,
			BizType:    payment.BizType,
			BizID:      payment.BizID,
			Amount:     payment.Amount,
			Status:     payment.Status,
			OccurredAt: *payment.PaidAt,
		})
	}

	var refunds []model.RefundOrder
	if err := repository.DB.Where("succeeded_at >= ? AND succeeded_at < ? AND status = ?", start, end, model.RefundOrderStatusSucceeded).Find(&refunds).Error; err != nil {
		return nil, err
	}
	for _, refund := range refunds {
		if refund.SucceededAt == nil {
			continue
		}
		items = append(items, CustodyBillItem{
			Direction:  "refund",
			FundScene:  refund.FundScene,
			OutNo:      refund.OutRefundNo,
			BizType:    refund.BizType,
			BizID:      refund.BizID,
			Amount:     refund.Amount,
			Status:     refund.Status,
			OccurredAt: *refund.SucceededAt,
		})
	}

	var payouts []model.PayoutOrder
	if err := repository.DB.Where("paid_at >= ? AND paid_at < ? AND status = ?", start, end, model.PayoutStatusPaid).Find(&payouts).Error; err != nil {
		return nil, err
	}
	for _, payout := range payouts {
		if payout.PaidAt == nil {
			continue
		}
		items = append(items, CustodyBillItem{
			Direction:  "payout",
			FundScene:  payout.FundScene,
			OutNo:      payout.OutPayoutNo,
			ProviderNo: payout.ProviderPayoutNo,
			BizType:    payout.BizType,
			BizID:      payout.BizID,
			Amount:     payout.Amount,
			Status:     payout.Status,
			OccurredAt: *payout.PaidAt,
		})
	}

	return items, nil
}
