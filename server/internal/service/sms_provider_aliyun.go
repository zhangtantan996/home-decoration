package service

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha1"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"sort"
	"strings"
	"time"

	"home-decoration-server/internal/config"
)

// AliyunSMSProvider implements Aliyun Dysmsapi SendSms (RPC style) without external dependencies.
// Docs reference: https://help.aliyun.com/product/44282.html (not fetched here).
type AliyunSMSProvider struct {
	accessKeyID     string
	accessKeySecret string
	signName        string
	templateCode    string
	regionID        string
	httpClient      *http.Client
}

type aliyunSendSMSResponse struct {
	Message   string `json:"Message"`
	RequestID string `json:"RequestId"`
	BizID     string `json:"BizId"`
	Code      string `json:"Code"`
}

func NewAliyunSMSProvider(cfg config.SMSConfig) (*AliyunSMSProvider, error) {
	if strings.TrimSpace(cfg.AccessKeyID) == "" ||
		strings.TrimSpace(cfg.AccessKeySecret) == "" ||
		strings.TrimSpace(cfg.SignName) == "" ||
		strings.TrimSpace(cfg.TemplateCode) == "" {
		return nil, errors.New("短信服务未配置：缺少 SMS_ACCESS_KEY_ID / SMS_ACCESS_KEY_SECRET / SMS_SIGN_NAME / SMS_TEMPLATE_CODE")
	}
	regionID := strings.TrimSpace(cfg.RegionID)
	if regionID == "" {
		regionID = "cn-hangzhou"
	}

	return &AliyunSMSProvider{
		accessKeyID:     strings.TrimSpace(cfg.AccessKeyID),
		accessKeySecret: strings.TrimSpace(cfg.AccessKeySecret),
		signName:        strings.TrimSpace(cfg.SignName),
		templateCode:    strings.TrimSpace(cfg.TemplateCode),
		regionID:        regionID,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}, nil
}

func (p *AliyunSMSProvider) SendVerificationCode(phone, code string) (SMSProviderResult, error) {
	templateParamBytes, err := json.Marshal(map[string]string{"code": code})
	if err != nil {
		return SMSProviderResult{Provider: "aliyun"}, fmt.Errorf("encode sms template param: %w", err)
	}

	params := map[string]string{
		"AccessKeyId":      p.accessKeyID,
		"Action":           "SendSms",
		"Format":           "JSON",
		"PhoneNumbers":     phone,
		"RegionId":         p.regionID,
		"SignName":         p.signName,
		"SignatureMethod":  "HMAC-SHA1",
		"SignatureNonce":   mustNonce(),
		"SignatureVersion": "1.0",
		"TemplateCode":     p.templateCode,
		"TemplateParam":    string(templateParamBytes),
		"Timestamp":        time.Now().UTC().Format("2006-01-02T15:04:05Z"),
		"Version":          "2017-05-25",
	}

	// Signature is calculated without Signature itself.
	canonical := canonicalizeRPCQuery(params)
	stringToSign := "GET&" + percentEncode("/") + "&" + percentEncode(canonical)
	signature := signHmacSha1(p.accessKeySecret+"&", stringToSign)

	params["Signature"] = signature
	finalQuery := canonicalizeRPCQuery(params)

	endpoint := "https://dysmsapi.aliyuncs.com/"
	reqURL := endpoint + "?" + finalQuery

	resp, err := p.httpClient.Get(reqURL)
	if err != nil {
		return SMSProviderResult{Provider: "aliyun"}, fmt.Errorf("aliyun sms request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return SMSProviderResult{Provider: "aliyun"}, fmt.Errorf("read aliyun sms response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		// Do not leak secrets; include only status + minimal body prefix.
		msg := strings.TrimSpace(string(body))
		if len(msg) > 256 {
			msg = msg[:256]
		}
		return SMSProviderResult{Provider: "aliyun"}, &SMSProviderError{
			Code:    fmt.Sprintf("HTTP_%d", resp.StatusCode),
			Message: msg,
		}
	}

	var parsed aliyunSendSMSResponse
	if err := json.Unmarshal(body, &parsed); err != nil {
		return SMSProviderResult{Provider: "aliyun"}, fmt.Errorf("parse aliyun sms response: %w", err)
	}

	if strings.ToUpper(strings.TrimSpace(parsed.Code)) != "OK" {
		return SMSProviderResult{Provider: "aliyun"}, &SMSProviderError{
			Code:    strings.TrimSpace(parsed.Code),
			Message: strings.TrimSpace(parsed.Message),
		}
	}

	return SMSProviderResult{
		Provider:  "aliyun",
		MessageID: strings.TrimSpace(parsed.BizID),
		RequestID: strings.TrimSpace(parsed.RequestID),
	}, nil
}

func mustNonce() string {
	// 16 bytes -> ~22 chars base64, then trim padding.
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		// Extremely unlikely; fall back to timestamp.
		return fmt.Sprintf("%d", time.Now().UnixNano())
	}
	return strings.TrimRight(base64.StdEncoding.EncodeToString(b), "=")
}

func signHmacSha1(secret, stringToSign string) string {
	mac := hmac.New(sha1.New, []byte(secret))
	_, _ = mac.Write([]byte(stringToSign))
	return base64.StdEncoding.EncodeToString(mac.Sum(nil))
}

func canonicalizeRPCQuery(params map[string]string) string {
	keys := make([]string, 0, len(params))
	for k := range params {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	pairs := make([]string, 0, len(keys))
	for _, k := range keys {
		pairs = append(pairs, percentEncode(k)+"="+percentEncode(params[k]))
	}
	return strings.Join(pairs, "&")
}

func isUnreserved(b byte) bool {
	if b >= 'A' && b <= 'Z' {
		return true
	}
	if b >= 'a' && b <= 'z' {
		return true
	}
	if b >= '0' && b <= '9' {
		return true
	}
	switch b {
	case '-', '_', '.', '~':
		return true
	default:
		return false
	}
}

// percentEncode implements Aliyun RPC percent-encoding rules:
// - UTF-8 bytes
// - unreserved: A-Z a-z 0-9 - _ . ~
// - space encoded as %20 (not +)
// - * encoded as %2A (handled by generic encoding)
func percentEncode(s string) string {
	if s == "" {
		return ""
	}
	var b strings.Builder
	b.Grow(len(s) + 8)
	for i := 0; i < len(s); i++ {
		c := s[i]
		if isUnreserved(c) {
			_ = b.WriteByte(c)
			continue
		}
		b.WriteString(fmt.Sprintf("%%%02X", c))
	}
	return b.String()
}
