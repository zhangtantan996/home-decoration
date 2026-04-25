package service

import (
	"context"
	"crypto/rsa"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/wechatpay-apiv3/wechatpay-go/core"
	"github.com/wechatpay-apiv3/wechatpay-go/core/auth"
	"github.com/wechatpay-apiv3/wechatpay-go/core/auth/verifiers"
	"github.com/wechatpay-apiv3/wechatpay-go/core/consts"
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

func (g *WechatPayGateway) ParseRefundNotifyRequest(ctx context.Context, request *http.Request) (*PaymentChannelRefundResult, error) {
	if request == nil {
		return nil, errors.New("微信退款回调请求不能为空")
	}
	if err := g.ensureInitialized(ctx); err != nil {
		return nil, err
	}
	refund := new(refunddomestic.Refund)
	notifyReq, err := g.notifyHandler.ParseNotifyRequest(ctx, request, refund)
	if err != nil {
		return nil, err
	}
	status := strings.TrimSpace(refundStatusValue(refund.Status))
	return &PaymentChannelRefundResult{
		ProviderTradeNo: stringValue(refund.TransactionId),
		OutTradeNo:      stringValue(refund.OutTradeNo),
		OutRefundNo:     stringValue(refund.OutRefundNo),
		Success:         status == string(refunddomestic.STATUS_SUCCESS),
		Pending:         status == string(refunddomestic.STATUS_PROCESSING),
		RawJSON:         strings.TrimSpace(notifyReq.Resource.Plaintext),
		FailureReason:   wechatRefundFailureReason(status),
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

		clientOption, notifyVerifier, err := buildWechatPayClientOptions(cfg, privateKey)
		if err != nil {
			g.initErr = err
			return
		}

		client, err := core.NewClient(ctx, clientOption)
		if err != nil {
			g.initErr = err
			return
		}
		g.client = client

		handler, err := notify.NewRSANotifyHandler(strings.TrimSpace(cfg.WechatPay.APIv3Key), notifyVerifier)
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
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return nil, errors.New("微信支付未配置商户私钥")
	}
	if _, err := os.Stat(trimmed); err == nil {
		return wxutils.LoadPrivateKeyWithPath(trimmed)
	}
	normalized := strings.ReplaceAll(trimmed, `\n`, "\n")
	if strings.Contains(normalized, "BEGIN") {
		return wxutils.LoadPrivateKey(normalized)
	}
	return wxutils.LoadPrivateKey(normalized)
}

func loadWechatPayPublicKey(raw string) (*rsa.PublicKey, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return nil, errors.New("微信支付未配置平台公钥")
	}
	if _, err := os.Stat(trimmed); err == nil {
		return wxutils.LoadPublicKeyWithPath(trimmed)
	}
	normalized := strings.ReplaceAll(trimmed, `\n`, "\n")
	if strings.Contains(normalized, "BEGIN") {
		return wxutils.LoadPublicKey(normalized)
	}
	return wxutils.LoadPublicKey(normalized)
}

func buildWechatPayClientOptions(cfg *config.Config, privateKey *rsa.PrivateKey) (core.ClientOption, auth.Verifier, error) {
	mchID := strings.TrimSpace(cfg.WechatPay.MchID)
	serialNo := strings.TrimSpace(cfg.WechatPay.SerialNo)
	apiV3Key := strings.TrimSpace(cfg.WechatPay.APIv3Key)
	publicKeyID := strings.TrimSpace(cfg.WechatPay.PlatformPublicKeyID)
	publicKeyRaw := strings.TrimSpace(cfg.WechatPay.PlatformPublicKey)

	if publicKeyID != "" && publicKeyRaw != "" {
		publicKey, err := loadWechatPayPublicKey(publicKeyRaw)
		if err != nil {
			return nil, nil, err
		}
		return option.WithWechatPayPublicKeyAuthCipher(
				mchID,
				serialNo,
				privateKey,
				publicKeyID,
				publicKey,
			),
			verifiers.NewSHA256WithRSAPubkeyVerifier(publicKeyID, *publicKey),
			nil
	}

	certificateVisitor := downloader.MgrInstance().GetCertificateVisitor(mchID)
	return option.WithWechatPayAutoAuthCipher(
			mchID,
			serialNo,
			privateKey,
			apiV3Key,
		),
		verifiers.NewSHA256WithRSAVerifier(certificateVisitor),
		nil
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
	return floatToCents(amount)
}

func amountFenToYuan(amount int64) float64 {
	return float64(amount) / 100
}

func (g *WechatPayGateway) QueryOrderByOutTradeNo(ctx context.Context, outTradeNo string) (*PaymentChannelQueryResult, error) {
	if strings.TrimSpace(outTradeNo) == "" {
		return nil, errors.New("商户订单号不能为空")
	}
	if err := g.ensureInitialized(ctx); err != nil {
		return nil, err
	}
	cfg := config.GetConfig()
	svc := jsapi.JsapiApiService{Client: g.client}
	resp, _, err := svc.QueryOrderByOutTradeNo(ctx, jsapi.QueryOrderByOutTradeNoRequest{
		OutTradeNo: core.String(strings.TrimSpace(outTradeNo)),
		Mchid:      core.String(strings.TrimSpace(cfg.WechatPay.MchID)),
	})
	if err != nil {
		return nil, fmt.Errorf("查询支付单失败: %w", err)
	}
	amount := float64(0)
	if resp.Amount != nil && resp.Amount.Total != nil {
		amount = amountFenToYuan(*resp.Amount.Total)
	}
	return &PaymentChannelQueryResult{
		OutTradeNo:      stringValue(resp.OutTradeNo),
		ProviderTradeNo: stringValue(resp.TransactionId),
		TradeStatus:     stringValue(resp.TradeState),
		Amount:          amount,
		RawJSON:         mustMarshalJSON(resp),
	}, nil
}

func (g *WechatPayGateway) CloseOrder(ctx context.Context, outTradeNo string) error {
	if strings.TrimSpace(outTradeNo) == "" {
		return errors.New("商户订单号不能为空")
	}
	if err := g.ensureInitialized(ctx); err != nil {
		return err
	}
	cfg := config.GetConfig()
	svc := jsapi.JsapiApiService{Client: g.client}
	_, err := svc.CloseOrder(ctx, jsapi.CloseOrderRequest{
		OutTradeNo: core.String(strings.TrimSpace(outTradeNo)),
		Mchid:      core.String(strings.TrimSpace(cfg.WechatPay.MchID)),
	})
	if err != nil {
		return fmt.Errorf("关闭订单失败: %w", err)
	}
	return nil
}

func (g *WechatPayGateway) QueryRefund(ctx context.Context, outRefundNo string) (*RefundQueryResult, error) {
	if strings.TrimSpace(outRefundNo) == "" {
		return nil, errors.New("商户退款单号不能为空")
	}
	if err := g.ensureInitialized(ctx); err != nil {
		return nil, err
	}
	svc := refunddomestic.RefundsApiService{Client: g.client}
	resp, _, err := svc.QueryByOutRefundNo(ctx, refunddomestic.QueryByOutRefundNoRequest{
		OutRefundNo: core.String(strings.TrimSpace(outRefundNo)),
	})
	if err != nil {
		return nil, fmt.Errorf("查询退款失败: %w", err)
	}
	status := strings.TrimSpace(refundStatusValue(resp.Status))
	refundAmount := float64(0)
	if resp.Amount != nil && resp.Amount.Refund != nil {
		refundAmount = amountFenToYuan(*resp.Amount.Refund)
	}
	return &RefundQueryResult{
		OutRefundNo:     stringValue(resp.OutRefundNo),
		ProviderTradeNo: stringValue(resp.TransactionId),
		OutTradeNo:      stringValue(resp.OutTradeNo),
		RefundStatus:    status,
		RefundAmount:    refundAmount,
		Success:         status == string(refunddomestic.STATUS_SUCCESS),
		Pending:         status == string(refunddomestic.STATUS_PROCESSING),
		FailureReason:   wechatRefundFailureReason(status),
		RawJSON:         mustMarshalJSON(resp),
	}, nil
}

func (g *WechatPayGateway) DownloadBill(ctx context.Context, billDate string, billType string) ([]byte, error) {
	if strings.TrimSpace(billDate) == "" {
		return nil, errors.New("账单日期不能为空")
	}
	if strings.TrimSpace(billType) == "" {
		billType = "ALL"
	}
	validBillTypes := map[string]bool{"ALL": true, "SUCCESS": true, "REFUND": true}
	if !validBillTypes[strings.ToUpper(billType)] {
		return nil, fmt.Errorf("账单类型无效，可选值: ALL/SUCCESS/REFUND")
	}
	if err := g.ensureInitialized(ctx); err != nil {
		return nil, err
	}
	query := url.Values{}
	query.Set("bill_date", strings.TrimSpace(billDate))
	query.Set("bill_type", strings.ToUpper(strings.TrimSpace(billType)))
	result, err := g.client.Request(ctx, http.MethodGet, consts.WechatPayAPIServer+"/v3/bill/tradebill", nil, query, nil, "")
	if err != nil {
		return nil, fmt.Errorf("获取微信支付账单下载地址失败: %w", err)
	}
	var downloadResp struct {
		DownloadURL string `json:"download_url"`
	}
	if err := core.UnMarshalResponse(result.Response, &downloadResp); err != nil {
		return nil, fmt.Errorf("解析微信支付账单下载地址失败: %w", err)
	}
	downloadURL := strings.TrimSpace(downloadResp.DownloadURL)
	if downloadURL == "" {
		return nil, errors.New("微信支付账单下载地址为空")
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, downloadURL, nil)
	if err != nil {
		return nil, fmt.Errorf("创建微信支付账单下载请求失败: %w", err)
	}
	req.Header.Set("Accept", "text/plain, text/csv, */*")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("下载微信支付账单失败: %w", err)
	}
	defer resp.Body.Close()
	body, readErr := io.ReadAll(resp.Body)
	if readErr != nil {
		return nil, fmt.Errorf("读取微信支付账单失败: %w", readErr)
	}
	if resp.StatusCode < 200 || resp.StatusCode > 299 {
		return nil, fmt.Errorf("下载微信支付账单失败: HTTP %d %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}
	return body, nil
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

type TransferToBankCardInput struct {
	OutBatchNo      string // 商户批次单号
	BatchName       string // 批次名称
	BatchRemark     string // 批次备注
	TransferSceneID string // 转账场景ID
	OutDetailNo     string // 商户明细单号
	TransferAmount  int64  // 转账金额（分）
	TransferRemark  string // 转账备注
	UserName        string // 收款人姓名（需加密）
	BankCardNumber  string // 银行卡号（需加密）
}

type TransferToBankCardResult struct {
	BatchID     string    // 微信批次单号
	CreateTime  time.Time // 批次创建时间
	BatchStatus string    // 批次状态
	RawJSON     string    // 原始响应JSON
}

func (g *WechatPayGateway) TransferToBankCard(ctx context.Context, input *TransferToBankCardInput) (*TransferToBankCardResult, error) {
	if input == nil {
		return nil, errors.New("转账参数不能为空")
	}
	if strings.TrimSpace(input.OutBatchNo) == "" {
		return nil, errors.New("商户批次单号不能为空")
	}
	if strings.TrimSpace(input.BatchName) == "" {
		return nil, errors.New("批次名称不能为空")
	}
	if strings.TrimSpace(input.OutDetailNo) == "" {
		return nil, errors.New("商户明细单号不能为空")
	}
	if input.TransferAmount <= 0 {
		return nil, errors.New("转账金额必须大于0")
	}
	if input.TransferAmount > 1000000 {
		return nil, errors.New("单笔转账金额不能超过10万元")
	}
	if strings.TrimSpace(input.UserName) == "" {
		return nil, errors.New("收款人姓名不能为空")
	}
	if strings.TrimSpace(input.BankCardNumber) == "" {
		return nil, errors.New("银行卡号不能为空")
	}

	if err := g.ensureInitialized(ctx); err != nil {
		return nil, err
	}

	return nil, errors.New("微信商家转账到银行卡功能暂未实现：需要对接微信支付SDK的转账到银行卡API，并实现RSA加密功能")
}
