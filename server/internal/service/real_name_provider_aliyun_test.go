package service

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestAliyunRealNameVerifierUsesDytnsCertNoTwoElementVerification(t *testing.T) {
	var query map[string]string
	server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		query = map[string]string{}
		for key, values := range r.URL.Query() {
			if len(values) > 0 {
				query[key] = values[0]
			}
		}
		_ = json.NewEncoder(w).Encode(map[string]any{
			"RequestId": "req-person-1",
			"Code":      "OK",
			"Message":   "OK",
			"Data": map[string]any{
				"IsConsistent": "1",
			},
		})
	}))
	defer server.Close()

	verifier := aliyunRealNameVerifier{
		accessKeyID:     "ak-test",
		accessKeySecret: "sk-test",
		authCode:        "auth-person",
		endpoint:        strings.TrimPrefix(server.URL, "https://"),
		client:          server.Client(),
	}

	result := verifier.Verify("张三", "11010519491231002X")
	if !result.Passed || result.Provider != "aliyun" || result.ProviderRequestID != "req-person-1" {
		t.Fatalf("expected aliyun verification pass, got %+v", result)
	}
	if query["Action"] != "CertNoTwoElementVerification" {
		t.Fatalf("expected dytns personal action, got %q", query["Action"])
	}
	if query["AuthCode"] != "auth-person" || query["CertName"] != "张三" || query["CertNo"] != "11010519491231002X" {
		t.Fatalf("unexpected dytns query: %+v", query)
	}
	if query["Version"] != "2020-02-17" || query["RegionId"] != "cn-hangzhou" {
		t.Fatalf("unexpected dytns version/region: %+v", query)
	}
}

func TestNewAliyunRealNameVerifierRequiresPersonAuthCode(t *testing.T) {
	t.Setenv("ALIYUN_VERIFY_ACCESS_KEY_ID", "ak-test")
	t.Setenv("ALIYUN_VERIFY_ACCESS_KEY_SECRET", "sk-test")
	t.Setenv("ALIYUN_PERSON_VERIFY_AUTH_CODE", "")

	result := newAliyunRealNameVerifier().Verify("张三", "11010519491231002X")
	if !result.Unavailable || result.Provider != "aliyun" {
		t.Fatalf("expected unavailable aliyun verifier without person auth code, got %+v", result)
	}
}
