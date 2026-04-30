package service

import (
	"encoding/json"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

type aliyunRealNameVerifier struct {
	accessKeyID     string
	accessKeySecret string
	authCode        string
	endpoint        string
	client          *http.Client
}

type aliyunCertNoTwoElementResponse struct {
	RequestID string `json:"RequestId"`
	Code      string `json:"Code"`
	Message   string `json:"Message"`
	Data      struct {
		IsConsistent any `json:"IsConsistent"`
		ResultCode   any `json:"ResultCode"`
	} `json:"Data"`
}

func newAliyunRealNameVerifier() RealNameVerifier {
	accessKeyID := strings.TrimSpace(firstNonEmptyString(os.Getenv("ALIYUN_VERIFY_ACCESS_KEY_ID"), os.Getenv("ALIYUN_ID_VERIFY_ACCESS_KEY_ID")))
	accessKeySecret := strings.TrimSpace(firstNonEmptyString(os.Getenv("ALIYUN_VERIFY_ACCESS_KEY_SECRET"), os.Getenv("ALIYUN_ID_VERIFY_ACCESS_KEY_SECRET")))
	if accessKeyID == "" || accessKeySecret == "" {
		return unavailableRealNameVerifier{provider: "aliyun"}
	}
	authCode := strings.TrimSpace(firstNonEmptyString(os.Getenv("ALIYUN_PERSON_VERIFY_AUTH_CODE"), os.Getenv("ALIYUN_ID_VERIFY_AUTH_CODE")))
	if authCode == "" {
		return unavailableRealNameVerifier{provider: "aliyun"}
	}
	endpoint := strings.TrimSpace(os.Getenv("ALIYUN_PERSON_VERIFY_ENDPOINT"))
	if endpoint == "" {
		endpoint = "dytnsapi.aliyuncs.com"
	}
	endpoint = strings.TrimPrefix(strings.TrimPrefix(endpoint, "https://"), "http://")
	return aliyunRealNameVerifier{
		accessKeyID:     accessKeyID,
		accessKeySecret: accessKeySecret,
		authCode:        authCode,
		endpoint:        endpoint,
		client:          &http.Client{Timeout: 8 * time.Second},
	}
}

func (v aliyunRealNameVerifier) Verify(realName, idCard string) RealNameVerificationResult {
	params := map[string]string{
		"AccessKeyId":      v.accessKeyID,
		"Action":           "CertNoTwoElementVerification",
		"AuthCode":         v.authCode,
		"CertName":         realName,
		"CertNo":           idCard,
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
		return RealNameVerificationResult{Provider: "aliyun", Reason: "实名核验服务暂不可用，请稍后重试", Unavailable: true}
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return RealNameVerificationResult{Provider: "aliyun", Reason: "实名核验服务暂不可用，请稍后重试", Unavailable: true}
	}
	if resp.StatusCode != http.StatusOK {
		return RealNameVerificationResult{Provider: "aliyun", Reason: "实名核验服务暂不可用，请稍后重试", Unavailable: true}
	}

	var parsed aliyunCertNoTwoElementResponse
	if err := json.Unmarshal(body, &parsed); err != nil {
		return RealNameVerificationResult{Provider: "aliyun", Reason: "实名核验服务暂不可用，请稍后重试", Unavailable: true}
	}
	requestID := strings.TrimSpace(parsed.RequestID)
	resultCode := normalizeAliyunCode(parsed.Data.IsConsistent, parsed.Data.ResultCode)
	if strings.EqualFold(strings.TrimSpace(parsed.Code), "OK") && resultCode == "1" {
		return RealNameVerificationResult{Passed: true, Provider: "aliyun", ProviderRequestID: requestID}
	}
	if strings.EqualFold(strings.TrimSpace(parsed.Code), "OK") {
		return RealNameVerificationResult{
			Provider:          "aliyun",
			ProviderRequestID: requestID,
			Reason:            "认证信息不一致，请核对后重试",
		}
	}
	return RealNameVerificationResult{
		Provider:          "aliyun",
		ProviderRequestID: requestID,
		Reason:            "实名核验服务暂不可用，请稍后重试",
		Unavailable:       true,
	}
}
