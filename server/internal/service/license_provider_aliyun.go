package service

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

type aliyunLicenseVerifier struct {
	accessKeyID     string
	accessKeySecret string
	authCode        string
	endpoint        string
	client          *http.Client
}

type aliyunCompanyTwoElementsResponse struct {
	RequestID string `json:"RequestId"`
	Code      string `json:"Code"`
	Message   string `json:"Message"`
	Data      struct {
		VerifyResult bool `json:"VerifyResult"`
		ReasonCode   any  `json:"ReasonCode"`
		ResultCode   any  `json:"ResultCode"`
		VerifyCode   any  `json:"VerifyCode"`
	} `json:"Data"`
}

func newAliyunLicenseVerifier() LicenseVerifier {
	accessKeyID := strings.TrimSpace(firstNonEmptyString(os.Getenv("ALIYUN_VERIFY_ACCESS_KEY_ID"), os.Getenv("ALIYUN_ENTERPRISE_VERIFY_ACCESS_KEY_ID")))
	accessKeySecret := strings.TrimSpace(firstNonEmptyString(os.Getenv("ALIYUN_VERIFY_ACCESS_KEY_SECRET"), os.Getenv("ALIYUN_ENTERPRISE_VERIFY_ACCESS_KEY_SECRET")))
	if accessKeyID == "" || accessKeySecret == "" {
		return unavailableLicenseVerifier{provider: "aliyun"}
	}
	authCode := strings.TrimSpace(os.Getenv("ALIYUN_ENTERPRISE_VERIFY_AUTH_CODE"))
	if authCode == "" {
		return unavailableLicenseVerifier{provider: "aliyun"}
	}
	endpoint := strings.TrimSpace(os.Getenv("ALIYUN_ENTERPRISE_VERIFY_ENDPOINT"))
	if endpoint == "" {
		endpoint = "dytnsapi.aliyuncs.com"
	}
	endpoint = strings.TrimPrefix(strings.TrimPrefix(endpoint, "https://"), "http://")
	return aliyunLicenseVerifier{
		accessKeyID:     accessKeyID,
		accessKeySecret: accessKeySecret,
		authCode:        authCode,
		endpoint:        endpoint,
		client:          &http.Client{Timeout: 8 * time.Second},
	}
}

type unavailableLicenseVerifier struct {
	provider string
}

func (v unavailableLicenseVerifier) Verify(_, _ string) VerificationResult {
	return VerificationResult{
		Provider:    strings.TrimSpace(v.provider),
		Reason:      "核验服务暂不可用，请稍后再试",
		Unavailable: true,
	}
}

func (v aliyunLicenseVerifier) Verify(licenseNo, companyName string) VerificationResult {
	params := map[string]string{
		"AccessKeyId":      v.accessKeyID,
		"Action":           "CompanyTwoElementsVerification",
		"AuthCode":         v.authCode,
		"EpCertName":       companyName,
		"EpCertNo":         licenseNo,
		"Format":           "JSON",
		"RegionId":         "cn-hangzhou",
		"SignatureMethod":  "HMAC-SHA1",
		"SignatureNonce":   mustNonce(),
		"SignatureVersion": "1.0",
		"Timestamp":        time.Now().UTC().Format("2006-01-02T15:04:05Z"),
		"Version":          "2020-02-17",
	}
	canonical := canonicalizeRPCQuery(params)
	stringToSign := "GET&" + percentEncode("/") + "&" + percentEncode(canonical)
	params["Signature"] = signHmacSha1(v.accessKeySecret+"&", stringToSign)

	reqURL := "https://" + v.endpoint + "/?" + canonicalizeRPCQuery(params)
	resp, err := v.client.Get(reqURL)
	if err != nil {
		return VerificationResult{Provider: "aliyun", Reason: "核验服务暂不可用，请稍后再试", Unavailable: true}
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return VerificationResult{Provider: "aliyun", Reason: "核验服务暂不可用，请稍后再试", Unavailable: true}
	}
	if resp.StatusCode != http.StatusOK {
		return VerificationResult{Provider: "aliyun", Reason: "核验服务暂不可用，请稍后再试", Unavailable: true}
	}

	var parsed aliyunCompanyTwoElementsResponse
	if err := json.Unmarshal(body, &parsed); err != nil {
		return VerificationResult{Provider: "aliyun", Reason: "核验服务暂不可用，请稍后再试", Unavailable: true}
	}
	requestID := strings.TrimSpace(parsed.RequestID)
	resultCode := normalizeAliyunCode(parsed.Data.ReasonCode, parsed.Data.ResultCode, parsed.Data.VerifyCode)
	if strings.EqualFold(strings.TrimSpace(parsed.Code), "OK") && parsed.Data.VerifyResult && resultCode == "0" {
		return VerificationResult{Passed: true, Provider: "aliyun", ProviderRequestID: requestID}
	}
	if strings.EqualFold(strings.TrimSpace(parsed.Code), "OK") {
		return VerificationResult{Provider: "aliyun", ProviderRequestID: requestID, Reason: "认证信息不一致，请核对后重试"}
	}
	return VerificationResult{Provider: "aliyun", ProviderRequestID: requestID, Reason: "核验服务暂不可用，请稍后再试", Unavailable: true}
}

func normalizeAliyunCode(values ...any) string {
	for _, value := range values {
		switch v := value.(type) {
		case nil:
			continue
		case string:
			if trimmed := strings.TrimSpace(v); trimmed != "" {
				return trimmed
			}
		case float64:
			return fmt.Sprintf("%.0f", v)
		default:
			if text := strings.TrimSpace(fmt.Sprint(v)); text != "" && text != "<nil>" {
				return text
			}
		}
	}
	return ""
}
