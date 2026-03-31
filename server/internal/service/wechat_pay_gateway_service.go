package service

import (
	"context"
	"crypto/rsa"
	"errors"
	"fmt"
	"net/http"
	"os"
	"strings"
	"sync"

	"github.com/wechatpay-apiv3/wechatpay-go/core"
	"github.com/wechatpay-apiv3/wechatpay-go/core/auth/verifiers"
	"github.com/wechatpay-apiv3/wechatpay-go/core/downloader"
	"github.com/wechatpay-apiv3/wechatpay-go/core/notify"
	"github.com/wechatpay-apiv3/wechatpay-go/core/option"
	"github.com/wechatpay-apiv3/wechatpay-go/services/payments"
	"github.com/wechatpay-apiv3/wechatpay-go/services/payments/jsapi"
	"github.com/wechatpay-apiv3/wechatpay-go/services/refunddomestic"
	wxutils "github.com/wechatpay-apiv3/wechatpay-go/utils"

	"home-decoration-server/internal/config"
	"home-decoration-server/internal/model"
)

type WechatPayGateway struct {
	once          sync.Once
	client        *core.Client
	notifyHandler *notify.Handler
	privateKey    *rsa.PrivateKey
	initErr       error
}

func NewWechatPayGateway() *WechatPayGateway {
	return &WechatPayGateway{}
}

func (g *WechatPayGateway) CreateMiniProgramPayment(ctx context.Context, order *model.PaymentOrder, openID string) (*PaymentChannelMiniProgramResult, error) {
	if order == nil || order.ID == 0 {
		return nil, errors.New("支付单不存在")
	}
	if strings.TrimSpace(openID) == "" {
		return nil, errors.New("当前账号未绑定小程序 OpenID")
	}
	if err := g.ensureInitialized(ctx); err != nil {
		return nil, err
	}

	cfg := config.GetConfig()
	svc := jsapi.JsapiApiService{Client: g.client}
	resp, _, err := svc.PrepayWithRequestPayment(ctx, jsapi.PrepayRequest{
		Appid:       core.String(g.appID()),
		Mchid:       core.String(strings.TrimSpace(cfg.WechatPay.MchID)),
		Description: core.String(strings.TrimSpace(order.Subject)),
		OutTradeNo:  core.String(strings.TrimSpace(order.OutTradeNo)),
		NotifyUrl:   core.String(strings.TrimSpace(cfg.WechatPay.NotifyURL)),
		Attach:      core.String(fmt.Sprintf("%s:%d", order.BizType, order.BizID)),
		TimeExpire:  core.Time(paymentExpiresAt(order)),
		Amount: &jsapi.Amount{
			Currency: core.String("CNY"),
			Total:    core.Int64(amountYuanToFen(order.Amount)),
		},
		Payer: &jsapi.Payer{Openid: core.String(strings.TrimSpace(openID))},
	})
	if err != nil {
		return nil, err
	}

	return &PaymentChannelMiniProgramResult{
		AppID:     stringValue(resp.Appid),
		TimeStamp: stringValue(resp.TimeStamp),
		NonceStr:  stringValue(resp.NonceStr),
		Package:   stringValue(resp.Package),
		SignType:  stringValue(resp.SignType),
		PaySign:   stringValue(resp.PaySign),
		RawJSON:   mustMarshalJSON(resp),
	}, nil
}

func (g *WechatPayGateway) ParseNotifyRequest(ctx context.Context, request *http.Request) (*PaymentChannelNotifyResult, error) {
	if request == nil {
		return nil, errors.New("微信支付回调请求不能为空")
	}
	if err := g.ensureInitialized(ctx); err != nil {
		return nil, err
	}
	transaction := new(payments.Transaction)
	notifyReq, err := g.notifyHandler.ParseNotifyRequest(ctx, request, transaction)
	if err != nil {
		return nil, err
	}
	return &PaymentChannelNotifyResult{
		NotifyID:        notifyReq.ID,
		EventType:       notifyReq.EventType,
		OutTradeNo:      stringValue(transaction.OutTradeNo),
		ProviderTradeNo: stringValue(transaction.TransactionId),
		TradeStatus:     stringValue(transaction.TradeState),
		RawJSON:         strings.TrimSpace(notifyReq.Resource.Plaintext),
	}, nil
}

func (g *WechatPayGateway) QueryCollectOrder(ctx context.Context, order *model.PaymentOrder) (*PaymentChannelTradeResult, error) {
	if order == nil {
		return nil, errors.New("支付单不存在")
	}
	if err := g.ensureInitialized(ctx); err != nil {
		return nil, err
	}
	cfg := config.GetConfig()
	svc := jsapi.JsapiApiService{Client: g.client}
	resp, _, err := svc.QueryOrderByOutTradeNo(ctx, jsapi.QueryOrderByOutTradeNoRequest{
		OutTradeNo: core.String(strings.TrimSpace(order.OutTradeNo)),
		Mchid:      core.String(strings.TrimSpace(cfg.WechatPay.MchID)),
	})
	if err != nil {
		return nil, err
	}
	amount := float64(0)
	if resp.Amount != nil && resp.Amount.Total != nil {
		amount = amountFenToYuan(*resp.Amount.Total)
	}
	return &PaymentChannelTradeResult{
		ProviderTradeNo: stringValue(resp.TransactionId),
		TradeStatus:     strings.TrimSpace(stringValue(resp.TradeState)),
		BuyerAmount:     amount,
		RawJSON:         mustMarshalJSON(resp),
	}, nil
}

func (g *WechatPayGateway) RefundCollectOrder(ctx context.Context, order *model.PaymentOrder, refund *model.RefundOrder) (*PaymentChannelRefundResult, error) {
	if order == nil || refund == nil {
		return nil, errors.New("退款参数不完整")
	}
	if err := g.ensureInitialized(ctx); err != nil {
		return nil, err
	}
	svc := refunddomestic.RefundsApiService{Client: g.client}
	resp, _, err := svc.Create(ctx, refunddomestic.CreateRequest{
		OutTradeNo:  core.String(strings.TrimSpace(order.OutTradeNo)),
		OutRefundNo: core.String(strings.TrimSpace(refund.OutRefundNo)),
		Reason:      optionalCoreString(refund.Reason),
		Amount: &refunddomestic.AmountReq{
			Currency: core.String("CNY"),
			Refund:   core.Int64(amountYuanToFen(refund.Amount)),
			Total:    core.Int64(amountYuanToFen(order.Amount)),
		},
	})
	if err != nil {
		return nil, err
	}
	status := strings.TrimSpace(refundStatusValue(resp.Status))
	return &PaymentChannelRefundResult{
		ProviderTradeNo: stringValue(resp.TransactionId),
		OutTradeNo:      stringValue(resp.OutTradeNo),
		OutRefundNo:     stringValue(resp.OutRefundNo),
		Success:         status == string(refunddomestic.STATUS_SUCCESS),
		Pending:         status == string(refunddomestic.STATUS_PROCESSING),
		RawJSON:         mustMarshalJSON(resp),
		FailureReason:   wechatRefundFailureReason(status),
	}, nil
}

func (g *WechatPayGateway) QueryRefundOrder(ctx context.Context, order *model.PaymentOrder, refund *model.RefundOrder) (*PaymentChannelRefundResult, error) {
	if order == nil || refund == nil {
		return nil, errors.New("退款参数不完整")
	}
	if err := g.ensureInitialized(ctx); err != nil {
		return nil, err
	}
	svc := refunddomestic.RefundsApiService{Client: g.client}
	resp, _, err := svc.QueryByOutRefundNo(ctx, refunddomestic.QueryByOutRefundNoRequest{
		OutRefundNo: core.String(strings.TrimSpace(refund.OutRefundNo)),
	})
	if err != nil {
		return nil, err
	}
	status := strings.TrimSpace(refundStatusValue(resp.Status))
	return &PaymentChannelRefundResult{
		ProviderTradeNo: stringValue(resp.TransactionId),
		OutTradeNo:      stringValue(resp.OutTradeNo),
		OutRefundNo:     stringValue(resp.OutRefundNo),
		Success:         status == string(refunddomestic.STATUS_SUCCESS),
		Pending:         status == string(refunddomestic.STATUS_PROCESSING),
		RawJSON:         mustMarshalJSON(resp),
		FailureReason:   wechatRefundFailureReason(status),
	}, nil
}

func (g *WechatPayGateway) ensureInitialized(ctx context.Context) error {
	g.once.Do(func() {
		cfg := config.GetConfig()
		if err := (&ConfigService{}).ValidatePaymentChannelRuntimeConfig(model.PaymentChannelWechat); err != nil {
			g.initErr = err
			return
		}

		privateKey, err := loadWechatPayPrivateKey(strings.TrimSpace(cfg.WechatPay.PrivateKey))
		if err != nil {
			g.initErr = err
			return
		}
		g.privateKey = privateKey

		client, err := core.NewClient(ctx, option.WithWechatPayAutoAuthCipher(
			strings.TrimSpace(cfg.WechatPay.MchID),
			strings.TrimSpace(cfg.WechatPay.SerialNo),
			privateKey,
			strings.TrimSpace(cfg.WechatPay.APIv3Key),
		))
		if err != nil {
			g.initErr = err
			return
		}
		g.client = client

		certificateVisitor := downloader.MgrInstance().GetCertificateVisitor(strings.TrimSpace(cfg.WechatPay.MchID))
		handler, err := notify.NewRSANotifyHandler(strings.TrimSpace(cfg.WechatPay.APIv3Key), verifiers.NewSHA256WithRSAVerifier(certificateVisitor))
		if err != nil {
			g.initErr = err
			return
		}
		g.notifyHandler = handler
	})
	return g.initErr
}

func (g *WechatPayGateway) appID() string {
	cfg := config.GetConfig()
	if value := strings.TrimSpace(cfg.WechatPay.AppID); value != "" {
		return value
	}
	return strings.TrimSpace(cfg.WechatMini.AppID)
}

func loadWechatPayPrivateKey(raw string) (*rsa.PrivateKey, error) {
	if raw == "" {
		return nil, errors.New("微信支付未配置商户私钥")
	}
	if strings.Contains(raw, "BEGIN") {
		return wxutils.LoadPrivateKey(raw)
	}
	if _, err := os.Stat(raw); err == nil {
		return wxutils.LoadPrivateKeyWithPath(raw)
	}
	return wxutils.LoadPrivateKey(strings.ReplaceAll(raw, `\n`, "\n"))
}

func optionalCoreString(value string) *string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}
	return core.String(trimmed)
}

func stringValue(value *string) string {
	if value == nil {
		return ""
	}
	return strings.TrimSpace(*value)
}

func refundStatusValue(status *refunddomestic.Status) string {
	if status == nil {
		return ""
	}
	return string(*status)
}

func amountYuanToFen(amount float64) int64 {
	return int64(normalizeAmount(amount)*100 + 0.5)
}

func amountFenToYuan(amount int64) float64 {
	return float64(amount) / 100
}

func wechatRefundFailureReason(status string) string {
	switch status {
	case string(refunddomestic.STATUS_CLOSED):
		return "退款已关闭"
	case string(refunddomestic.STATUS_ABNORMAL):
		return "退款异常，请前往微信商户平台处理"
	default:
		return ""
	}
}
