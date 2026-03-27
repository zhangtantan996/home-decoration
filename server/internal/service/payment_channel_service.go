package service

import (
	"context"
	"net/url"

	"home-decoration-server/internal/model"
)

type PaymentChannelTradeResult struct {
	ProviderTradeNo string
	TradeStatus     string
	BuyerAmount     float64
	RawJSON         string
}

type PaymentChannelRefundResult struct {
	ProviderTradeNo string
	OutTradeNo      string
	OutRefundNo     string
	Success         bool
	Pending         bool
	RawJSON         string
	FailureReason   string
}

type PaymentChannelService interface {
	CreateCollectOrder(ctx context.Context, order *model.PaymentOrder) (string, error)
	VerifyNotify(values url.Values) (map[string]string, error)
	QueryCollectOrder(ctx context.Context, order *model.PaymentOrder) (*PaymentChannelTradeResult, error)
	RefundCollectOrder(ctx context.Context, order *model.PaymentOrder, refund *model.RefundOrder) (*PaymentChannelRefundResult, error)
	QueryRefundOrder(ctx context.Context, order *model.PaymentOrder, refund *model.RefundOrder) (*PaymentChannelRefundResult, error)
}

type AlipayPaymentChannelService struct {
	gateway paymentGateway
}

func NewPaymentChannelService() PaymentChannelService {
	return &AlipayPaymentChannelService{gateway: NewAlipayGateway()}
}

func (s *AlipayPaymentChannelService) CreateCollectOrder(_ context.Context, order *model.PaymentOrder) (string, error) {
	return s.gateway.BuildLaunchHTML(order)
}

func (s *AlipayPaymentChannelService) VerifyNotify(values url.Values) (map[string]string, error) {
	return s.gateway.VerifyNotify(values)
}

func (s *AlipayPaymentChannelService) QueryCollectOrder(ctx context.Context, order *model.PaymentOrder) (*PaymentChannelTradeResult, error) {
	result, err := s.gateway.QueryTrade(ctx, order)
	if err != nil {
		return nil, err
	}
	return &PaymentChannelTradeResult{
		ProviderTradeNo: result.TradeNo,
		TradeStatus:     result.TradeStatus,
		BuyerAmount:     result.BuyerAmount,
		RawJSON:         result.RawJSON,
	}, nil
}

func (s *AlipayPaymentChannelService) RefundCollectOrder(ctx context.Context, order *model.PaymentOrder, refund *model.RefundOrder) (*PaymentChannelRefundResult, error) {
	result, err := s.gateway.Refund(ctx, order, refund)
	if err != nil {
		return nil, err
	}
	return &PaymentChannelRefundResult{
		ProviderTradeNo: result.TradeNo,
		OutTradeNo:      result.OutTradeNo,
		OutRefundNo:     result.OutRefundNo,
		Success:         result.Success,
		Pending:         result.Pending,
		RawJSON:         result.RawJSON,
		FailureReason:   result.FailureReason,
	}, nil
}

func (s *AlipayPaymentChannelService) QueryRefundOrder(ctx context.Context, order *model.PaymentOrder, refund *model.RefundOrder) (*PaymentChannelRefundResult, error) {
	result, err := s.gateway.QueryRefund(ctx, order, refund)
	if err != nil {
		return nil, err
	}
	return &PaymentChannelRefundResult{
		ProviderTradeNo: result.TradeNo,
		OutTradeNo:      result.OutTradeNo,
		OutRefundNo:     result.OutRefundNo,
		Success:         result.Success,
		Pending:         result.Pending,
		RawJSON:         result.RawJSON,
		FailureReason:   result.FailureReason,
	}, nil
}
