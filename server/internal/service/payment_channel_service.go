package service

import (
	"context"
	"errors"
	"net/http"
	"net/url"
	"time"

	"home-decoration-server/internal/model"
)

type PaymentChannelTradeResult struct {
	ProviderTradeNo string
	TradeStatus     string
	BuyerLogonID    string
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

type PaymentChannelMiniProgramResult struct {
	AppID     string
	TimeStamp string
	NonceStr  string
	Package   string
	SignType  string
	PaySign   string
	RawJSON   string
}

type PaymentChannelNotifyResult struct {
	NotifyID        string
	EventType       string
	OutTradeNo      string
	ProviderTradeNo string
	TradeStatus     string
	RawJSON         string
}

type PaymentChannelQueryResult struct {
	OutTradeNo      string
	ProviderTradeNo string
	TradeStatus     string
	Amount          float64
	RawJSON         string
}

type RefundQueryResult struct {
	OutRefundNo     string
	ProviderTradeNo string
	OutTradeNo      string
	RefundStatus    string
	RefundAmount    float64
	Success         bool
	Pending         bool
	FailureReason   string
	RawJSON         string
}

type PaymentChannelService interface {
	Channel() string
	CreateCollectOrder(ctx context.Context, order *model.PaymentOrder) (string, error)
	CreateCollectQRCode(ctx context.Context, order *model.PaymentOrder) ([]byte, error)
	CreateMiniProgramPayment(ctx context.Context, order *model.PaymentOrder, openID string) (*PaymentChannelMiniProgramResult, error)
	VerifyNotify(values url.Values) (map[string]string, error)
	ParseNotifyRequest(ctx context.Context, request *http.Request) (*PaymentChannelNotifyResult, error)
	QueryCollectOrder(ctx context.Context, order *model.PaymentOrder) (*PaymentChannelTradeResult, error)
	RefundCollectOrder(ctx context.Context, order *model.PaymentOrder, refund *model.RefundOrder) (*PaymentChannelRefundResult, error)
	QueryRefundOrder(ctx context.Context, order *model.PaymentOrder, refund *model.RefundOrder) (*PaymentChannelRefundResult, error)
}

type AlipayPaymentChannelService struct {
	gateway paymentGateway
}

type WechatPaymentChannelService struct {
	gateway *WechatPayGateway
}

func NewPaymentChannels() map[string]PaymentChannelService {
	return map[string]PaymentChannelService{
		model.PaymentChannelAlipay: &AlipayPaymentChannelService{gateway: NewAlipayGateway()},
		model.PaymentChannelWechat: &WechatPaymentChannelService{gateway: NewWechatPayGateway()},
	}
}

func NewPaymentChannelService() PaymentChannelService {
	return &AlipayPaymentChannelService{gateway: NewAlipayGateway()}
}

func (s *AlipayPaymentChannelService) Channel() string {
	return model.PaymentChannelAlipay
}

func (s *AlipayPaymentChannelService) CreateCollectOrder(_ context.Context, order *model.PaymentOrder) (string, error) {
	return s.gateway.BuildLaunchHTML(order)
}

func (s *AlipayPaymentChannelService) CreateCollectQRCode(ctx context.Context, order *model.PaymentOrder) ([]byte, error) {
	return s.gateway.BuildQRCodeImage(ctx, order)
}

func (s *AlipayPaymentChannelService) CreateMiniProgramPayment(context.Context, *model.PaymentOrder, string) (*PaymentChannelMiniProgramResult, error) {
	return nil, errors.New("支付宝不支持小程序内拉起支付")
}

func (s *AlipayPaymentChannelService) VerifyNotify(values url.Values) (map[string]string, error) {
	return s.gateway.VerifyNotify(values)
}

func (s *AlipayPaymentChannelService) ParseNotifyRequest(_ context.Context, request *http.Request) (*PaymentChannelNotifyResult, error) {
	if request == nil {
		return nil, errors.New("支付宝回调请求不能为空")
	}
	if err := request.ParseForm(); err != nil {
		return nil, err
	}
	payload, err := s.VerifyNotify(request.PostForm)
	if err != nil {
		return nil, err
	}
	return &PaymentChannelNotifyResult{
		NotifyID:        payload["notify_id"],
		EventType:       payload["trade_status"],
		OutTradeNo:      payload["out_trade_no"],
		ProviderTradeNo: payload["trade_no"],
		TradeStatus:     payload["trade_status"],
		RawJSON:         mustMarshalJSON(payload),
	}, nil
}

func (s *AlipayPaymentChannelService) QueryCollectOrder(ctx context.Context, order *model.PaymentOrder) (*PaymentChannelTradeResult, error) {
	result, err := s.gateway.QueryTrade(ctx, order)
	if err != nil {
		return nil, err
	}
	return &PaymentChannelTradeResult{
		ProviderTradeNo: result.TradeNo,
		TradeStatus:     result.TradeStatus,
		BuyerLogonID:    result.BuyerLogonID,
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

func (s *WechatPaymentChannelService) Channel() string {
	return model.PaymentChannelWechat
}

func (s *WechatPaymentChannelService) CreateCollectOrder(context.Context, *model.PaymentOrder) (string, error) {
	return "", errors.New("微信支付不支持网页表单拉起")
}

func (s *WechatPaymentChannelService) CreateCollectQRCode(context.Context, *model.PaymentOrder) ([]byte, error) {
	return nil, errors.New("微信支付当前未启用二维码支付")
}

func (s *WechatPaymentChannelService) CreateMiniProgramPayment(ctx context.Context, order *model.PaymentOrder, openID string) (*PaymentChannelMiniProgramResult, error) {
	if s.gateway == nil {
		return nil, errors.New("微信支付网关未初始化")
	}
	return s.gateway.CreateMiniProgramPayment(ctx, order, openID)
}

func (s *WechatPaymentChannelService) VerifyNotify(url.Values) (map[string]string, error) {
	return nil, errors.New("微信支付不使用表单回调验签")
}

func (s *WechatPaymentChannelService) ParseNotifyRequest(ctx context.Context, request *http.Request) (*PaymentChannelNotifyResult, error) {
	if s.gateway == nil {
		return nil, errors.New("微信支付网关未初始化")
	}
	return s.gateway.ParseNotifyRequest(ctx, request)
}

func (s *WechatPaymentChannelService) QueryCollectOrder(ctx context.Context, order *model.PaymentOrder) (*PaymentChannelTradeResult, error) {
	if s.gateway == nil {
		return nil, errors.New("微信支付网关未初始化")
	}
	return s.gateway.QueryCollectOrder(ctx, order)
}

func (s *WechatPaymentChannelService) RefundCollectOrder(ctx context.Context, order *model.PaymentOrder, refund *model.RefundOrder) (*PaymentChannelRefundResult, error) {
	if s.gateway == nil {
		return nil, errors.New("微信支付网关未初始化")
	}
	return s.gateway.RefundCollectOrder(ctx, order, refund)
}

func (s *WechatPaymentChannelService) QueryRefundOrder(ctx context.Context, order *model.PaymentOrder, refund *model.RefundOrder) (*PaymentChannelRefundResult, error) {
	if s.gateway == nil {
		return nil, errors.New("微信支付网关未初始化")
	}
	return s.gateway.QueryRefundOrder(ctx, order, refund)
}

func paymentExpiresAt(order *model.PaymentOrder) time.Time {
	if order != nil && order.ExpiredAt != nil {
		return *order.ExpiredAt
	}
	return time.Now().Add(15 * time.Minute)
}
