package service

import (
	"context"
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"errors"
	"fmt"
	"html"
	"io"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"

	"home-decoration-server/internal/config"
	"home-decoration-server/internal/model"
	qrcode "home-decoration-server/internal/third_party/goqrcode"
)

const (
	alipayMethodPagePay     = "alipay.trade.page.pay"
	alipayMethodWapPay      = "alipay.trade.wap.pay"
	alipayMethodPrecreate   = "alipay.trade.precreate"
	alipayMethodTradeQuery  = "alipay.trade.query"
	alipayMethodRefund      = "alipay.trade.refund"
	alipayMethodRefundQuery = "alipay.trade.fastpay.refund.query"
	alipayTradeSuccess      = "TRADE_SUCCESS"
	alipayTradeFinished     = "TRADE_FINISHED"
	alipayTradeClosed       = "TRADE_CLOSED"
)

type paymentGateway interface {
	BuildLaunchHTML(order *model.PaymentOrder) (string, error)
	BuildQRCodeImage(ctx context.Context, order *model.PaymentOrder) ([]byte, error)
	VerifyNotify(values url.Values) (map[string]string, error)
	QueryTrade(ctx context.Context, order *model.PaymentOrder) (*AlipayTradeQueryResult, error)
	Refund(ctx context.Context, order *model.PaymentOrder, refund *model.RefundOrder) (*AlipayRefundResult, error)
	QueryRefund(ctx context.Context, order *model.PaymentOrder, refund *model.RefundOrder) (*AlipayRefundResult, error)
}

type AlipayTradeQueryResult struct {
	TradeNo     string
	OutTradeNo  string
	TradeStatus string
	BuyerAmount float64
	RawJSON     string
}

type AlipayRefundResult struct {
	TradeNo       string
	OutTradeNo    string
	OutRefundNo   string
	Success       bool
	Pending       bool
	RawJSON       string
	FailureReason string
}

type AlipayGateway struct {
	cfg        config.AlipayConfig
	serverCfg  config.ServerConfig
	httpClient *http.Client
}

func NewAlipayGateway() *AlipayGateway {
	cfg := config.GetConfig()
	gatewayCfg := cfg.Alipay
	if gatewayCfg.Sandbox && strings.TrimSpace(gatewayCfg.GatewayURL) == "" {
		gatewayCfg.GatewayURL = "https://openapi-sandbox.dl.alipaydev.com/gateway.do"
	}
	if strings.TrimSpace(gatewayCfg.GatewayURL) == "" {
		gatewayCfg.GatewayURL = "https://openapi.alipay.com/gateway.do"
	}
	return &AlipayGateway{
		cfg:        gatewayCfg,
		serverCfg:  cfg.Server,
		httpClient: &http.Client{Timeout: 12 * time.Second},
	}
}

func (g *AlipayGateway) BuildLaunchHTML(order *model.PaymentOrder) (string, error) {
	if order == nil || order.ID == 0 {
		return "", errors.New("支付单不存在")
	}
	method := alipayMethodPagePay
	productCode := "FAST_INSTANT_TRADE_PAY"
	if order.TerminalType == model.PaymentTerminalMobileH5 {
		method = alipayMethodWapPay
		productCode = "QUICK_WAP_WAY"
	}
	params, err := g.signedRequestParams(method, map[string]any{
		"out_trade_no":    order.OutTradeNo,
		"product_code":    productCode,
		"subject":         order.Subject,
		"total_amount":    formatAmount(order.Amount),
		"timeout_express": fmt.Sprintf("%dm", maxInt(g.cfg.TimeoutMinutes, 1)),
	}, order)
	if err != nil {
		return "", err
	}

	var builder strings.Builder
	builder.WriteString("<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>Redirecting</title></head><body>")
	builder.WriteString("<form id=\"alipay-submit\" method=\"post\" action=\"")
	builder.WriteString(html.EscapeString(g.cfg.GatewayURL))
	builder.WriteString("\">")
	for _, key := range sortedKeys(params) {
		builder.WriteString("<input type=\"hidden\" name=\"")
		builder.WriteString(html.EscapeString(key))
		builder.WriteString("\" value=\"")
		builder.WriteString(html.EscapeString(params[key]))
		builder.WriteString("\" />")
	}
	builder.WriteString("</form><script>document.getElementById('alipay-submit').submit();</script></body></html>")
	return builder.String(), nil
}

func (g *AlipayGateway) BuildQRCodeImage(ctx context.Context, order *model.PaymentOrder) ([]byte, error) {
	if order == nil || order.ID == 0 {
		return nil, errors.New("支付单不存在")
	}
	payload, err := g.callJSONAPI(ctx, alipayMethodPrecreate, map[string]any{
		"out_trade_no":    order.OutTradeNo,
		"subject":         order.Subject,
		"total_amount":    formatAmount(order.Amount),
		"timeout_express": fmt.Sprintf("%dm", maxInt(g.cfg.TimeoutMinutes, 1)),
	})
	if err != nil {
		return nil, err
	}
	resp, err := extractAlipayResponse(payload, "alipay_trade_precreate_response")
	if err != nil {
		return nil, err
	}
	qrCode := stringField(resp, "qr_code")
	if qrCode == "" {
		return nil, errors.New("支付宝预下单未返回二维码")
	}
	png, err := qrcode.Encode(qrCode, qrcode.Medium, 320)
	if err != nil {
		return nil, fmt.Errorf("生成支付宝二维码失败: %w", err)
	}
	return png, nil
}

func (g *AlipayGateway) VerifyNotify(values url.Values) (map[string]string, error) {
	flat := flattenValues(values)
	sign := flat["sign"]
	if sign == "" {
		return nil, errors.New("支付宝回调缺少签名")
	}
	if err := g.verifySign(flat); err != nil {
		return nil, err
	}
	return flat, nil
}

func (g *AlipayGateway) QueryTrade(ctx context.Context, order *model.PaymentOrder) (*AlipayTradeQueryResult, error) {
	if order == nil {
		return nil, errors.New("支付单不存在")
	}
	payload, err := g.callJSONAPI(ctx, alipayMethodTradeQuery, map[string]any{
		"out_trade_no": order.OutTradeNo,
	})
	if err != nil {
		return nil, err
	}
	resp, err := extractAlipayResponse(payload, "alipay_trade_query_response")
	if err != nil {
		return nil, err
	}
	return &AlipayTradeQueryResult{
		TradeNo:     stringField(resp, "trade_no"),
		OutTradeNo:  stringField(resp, "out_trade_no"),
		TradeStatus: stringField(resp, "trade_status"),
		BuyerAmount: floatField(resp, "buyer_pay_amount"),
		RawJSON:     mustMarshalJSON(resp),
	}, nil
}

func (g *AlipayGateway) Refund(ctx context.Context, order *model.PaymentOrder, refund *model.RefundOrder) (*AlipayRefundResult, error) {
	if order == nil || refund == nil {
		return nil, errors.New("退款参数不完整")
	}
	payload, err := g.callJSONAPI(ctx, alipayMethodRefund, map[string]any{
		"out_trade_no":   order.OutTradeNo,
		"trade_no":       order.ProviderTradeNo,
		"refund_amount":  formatAmount(refund.Amount),
		"refund_reason":  refund.Reason,
		"out_request_no": refund.OutRefundNo,
	})
	if err != nil {
		return nil, err
	}
	resp, err := extractAlipayResponse(payload, "alipay_trade_refund_response")
	if err != nil {
		return nil, err
	}
	fundChange := strings.EqualFold(stringField(resp, "fund_change"), "Y")
	failure := stringField(resp, "sub_msg")
	if failure == "" {
		failure = stringField(resp, "msg")
	}
	return &AlipayRefundResult{
		TradeNo:       firstNonEmpty(stringField(resp, "trade_no"), order.ProviderTradeNo),
		OutTradeNo:    order.OutTradeNo,
		OutRefundNo:   refund.OutRefundNo,
		Success:       fundChange,
		Pending:       !fundChange && failure == "",
		RawJSON:       mustMarshalJSON(resp),
		FailureReason: failure,
	}, nil
}

func (g *AlipayGateway) QueryRefund(ctx context.Context, order *model.PaymentOrder, refund *model.RefundOrder) (*AlipayRefundResult, error) {
	if order == nil || refund == nil {
		return nil, errors.New("退款参数不完整")
	}
	payload, err := g.callJSONAPI(ctx, alipayMethodRefundQuery, map[string]any{
		"out_trade_no":   order.OutTradeNo,
		"trade_no":       order.ProviderTradeNo,
		"out_request_no": refund.OutRefundNo,
	})
	if err != nil {
		return nil, err
	}
	resp, err := extractAlipayResponse(payload, "alipay_trade_fastpay_refund_query_response")
	if err != nil {
		return nil, err
	}
	refundAmount := floatField(resp, "refund_amount")
	failure := stringField(resp, "sub_msg")
	if failure == "" {
		failure = stringField(resp, "msg")
	}
	return &AlipayRefundResult{
		TradeNo:       firstNonEmpty(stringField(resp, "trade_no"), order.ProviderTradeNo),
		OutTradeNo:    order.OutTradeNo,
		OutRefundNo:   refund.OutRefundNo,
		Success:       refundAmount > 0,
		Pending:       refundAmount == 0 && failure == "",
		RawJSON:       mustMarshalJSON(resp),
		FailureReason: failure,
	}, nil
}

func (g *AlipayGateway) signedRequestParams(method string, bizContent map[string]any, order *model.PaymentOrder) (map[string]string, error) {
	params := map[string]string{
		"app_id":     strings.TrimSpace(g.cfg.AppID),
		"method":     method,
		"format":     "JSON",
		"charset":    "utf-8",
		"sign_type":  "RSA2",
		"timestamp":  time.Now().Format("2006-01-02 15:04:05"),
		"version":    "1.0",
		"notify_url": strings.TrimSpace(g.resolveNotifyURL()),
	}
	if order != nil {
		params["return_url"] = g.resolveLaunchReturnURL(order)
	}
	encodedBiz, err := json.Marshal(bizContent)
	if err != nil {
		return nil, err
	}
	params["biz_content"] = string(encodedBiz)
	if params["app_id"] == "" || params["notify_url"] == "" {
		return nil, errors.New("支付宝配置不完整")
	}
	signature, err := g.sign(params)
	if err != nil {
		return nil, err
	}
	params["sign"] = signature
	return params, nil
}

func (g *AlipayGateway) callJSONAPI(ctx context.Context, method string, bizContent map[string]any) (map[string]json.RawMessage, error) {
	params, err := g.signedRequestParams(method, bizContent, nil)
	if err != nil {
		return nil, err
	}
	form := url.Values{}
	for key, value := range params {
		form.Set(key, value)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, g.cfg.GatewayURL, strings.NewReader(form.Encode()))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	resp, err := g.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("支付宝请求失败(%d): %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}
	var payload map[string]json.RawMessage
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, fmt.Errorf("解析支付宝响应失败: %w", err)
	}
	return payload, nil
}

func (g *AlipayGateway) sign(params map[string]string) (string, error) {
	privateKey, err := parseRSAPrivateKey(g.cfg.AppPrivateKey)
	if err != nil {
		return "", err
	}
	content := buildSignContent(params)
	hash := sha256.Sum256([]byte(content))
	signature, err := rsa.SignPKCS1v15(rand.Reader, privateKey, crypto.SHA256, hash[:])
	if err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(signature), nil
}

func (g *AlipayGateway) verifySign(params map[string]string) error {
	publicKey, err := parseRSAPublicKey(g.cfg.PublicKey)
	if err != nil {
		return err
	}
	signature, err := base64.StdEncoding.DecodeString(params["sign"])
	if err != nil {
		return err
	}
	content := buildSignContent(params)
	hash := sha256.Sum256([]byte(content))
	if err := rsa.VerifyPKCS1v15(publicKey, crypto.SHA256, hash[:], signature); err != nil {
		return errors.New("支付宝回调验签失败")
	}
	return nil
}

func (g *AlipayGateway) resolveNotifyURL() string {
	if strings.TrimSpace(g.cfg.NotifyURL) != "" {
		return strings.TrimSpace(g.cfg.NotifyURL)
	}
	if strings.TrimSpace(g.serverCfg.PublicURL) == "" {
		return ""
	}
	return strings.TrimRight(g.serverCfg.PublicURL, "/") + "/api/v1/payments/alipay/notify"
}

func (g *AlipayGateway) resolveLaunchReturnURL(order *model.PaymentOrder) string {
	base := strings.TrimRight(g.serverCfg.PublicURL, "/") + "/api/v1/payments/alipay/return"
	query := url.Values{}
	query.Set("paymentId", fmt.Sprintf("%d", order.ID))
	query.Set("terminalType", order.TerminalType)
	return base + "?" + query.Encode()
}

func parseRSAPrivateKey(raw string) (*rsa.PrivateKey, error) {
	block, _ := pem.Decode([]byte(raw))
	if block == nil {
		return nil, errors.New("支付宝应用私钥格式无效")
	}
	if key, err := x509.ParsePKCS8PrivateKey(block.Bytes); err == nil {
		if rsaKey, ok := key.(*rsa.PrivateKey); ok {
			return rsaKey, nil
		}
	}
	if key, err := x509.ParsePKCS1PrivateKey(block.Bytes); err == nil {
		return key, nil
	}
	return nil, errors.New("解析支付宝应用私钥失败")
}

func parseRSAPublicKey(raw string) (*rsa.PublicKey, error) {
	block, _ := pem.Decode([]byte(raw))
	if block == nil {
		return nil, errors.New("支付宝公钥格式无效")
	}
	if pub, err := x509.ParsePKIXPublicKey(block.Bytes); err == nil {
		if rsaKey, ok := pub.(*rsa.PublicKey); ok {
			return rsaKey, nil
		}
	}
	if cert, err := x509.ParseCertificate(block.Bytes); err == nil {
		if rsaKey, ok := cert.PublicKey.(*rsa.PublicKey); ok {
			return rsaKey, nil
		}
	}
	return nil, errors.New("解析支付宝公钥失败")
}

func buildSignContent(params map[string]string) string {
	keys := make([]string, 0, len(params))
	for key, value := range params {
		if value == "" || key == "sign" {
			continue
		}
		keys = append(keys, key)
	}
	sort.Strings(keys)
	parts := make([]string, 0, len(keys))
	for _, key := range keys {
		parts = append(parts, fmt.Sprintf("%s=%s", key, params[key]))
	}
	return strings.Join(parts, "&")
}

func extractAlipayResponse(payload map[string]json.RawMessage, key string) (map[string]any, error) {
	raw, ok := payload[key]
	if !ok {
		return nil, errors.New("支付宝响应缺少业务体")
	}
	var body map[string]any
	if err := json.Unmarshal(raw, &body); err != nil {
		return nil, err
	}
	if code := stringField(body, "code"); code != "10000" {
		msg := firstNonEmpty(stringField(body, "sub_msg"), stringField(body, "msg"), "支付宝接口调用失败")
		return nil, errors.New(msg)
	}
	return body, nil
}

func flattenValues(values url.Values) map[string]string {
	flat := make(map[string]string, len(values))
	for key, items := range values {
		if len(items) == 0 {
			continue
		}
		flat[key] = items[0]
	}
	return flat
}

func stringField(m map[string]any, key string) string {
	value, ok := m[key]
	if !ok || value == nil {
		return ""
	}
	switch typed := value.(type) {
	case string:
		return strings.TrimSpace(typed)
	default:
		return strings.TrimSpace(fmt.Sprint(typed))
	}
}

func floatField(m map[string]any, key string) float64 {
	value := stringField(m, key)
	if value == "" {
		return 0
	}
	amount, _ := strconv.ParseFloat(value, 64)
	return normalizeAmount(amount)
}

func mustMarshalJSON(value any) string {
	encoded, err := json.Marshal(value)
	if err != nil {
		return "{}"
	}
	return string(encoded)
}

func formatAmount(amount float64) string {
	return fmt.Sprintf("%.2f", normalizeAmount(amount))
}

func sortedKeys(m map[string]string) []string {
	keys := make([]string, 0, len(m))
	for key := range m {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	return keys
}

func maxInt(value, fallback int) int {
	if value > 0 {
		return value
	}
	return fallback
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}
