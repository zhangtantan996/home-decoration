package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	"home-decoration-server/internal/service"
)

func TestMerchantSendLoginCode_RejectsUnregisteredPhoneBeforeSMS(t *testing.T) {
	gin.SetMode(gin.TestMode)
	t.Setenv("APP_ENV", "local")
	t.Setenv("SMS_FIXED_CODE_MODE", "1")

	db := setupSQLiteDB(t)
	previousDB := repository.DB
	repository.DB = db
	t.Cleanup(func() { repository.DB = previousDB })

	resp := requestMerchantSendLoginCode(t, "13800001111")
	if resp.Code != 409 {
		t.Fatalf("unexpected code: got=%d message=%s", resp.Code, resp.Message)
	}
	if !strings.Contains(resp.Message, "尚未入驻") {
		t.Fatalf("expected unregistered message, got=%q", resp.Message)
	}

	var auditCount int64
	if err := db.Model(&model.SMSAuditLog{}).Count(&auditCount).Error; err != nil {
		t.Fatalf("count sms audit logs: %v", err)
	}
	if auditCount != 0 {
		t.Fatalf("unauthorized login code request should not reach SMS sending, auditCount=%d", auditCount)
	}
}

func TestMerchantSendLoginCode_RejectsDisabledProviderBeforeSMS(t *testing.T) {
	gin.SetMode(gin.TestMode)
	t.Setenv("APP_ENV", "local")
	t.Setenv("SMS_FIXED_CODE_MODE", "1")

	db := setupSQLiteDB(t)
	previousDB := repository.DB
	repository.DB = db
	t.Cleanup(func() { repository.DB = previousDB })

	user := model.User{Phone: "13800002222", Nickname: "异常商家", Status: 1}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("seed user: %v", err)
	}
	provider := model.Provider{UserID: user.ID, ProviderType: 1, CompanyName: "异常商家", Status: 0, Verified: true, IsSettled: true}
	if err := db.Create(&provider).Error; err != nil {
		t.Fatalf("seed provider: %v", err)
	}
	if err := db.Model(&model.Provider{}).Where("id = ?", provider.ID).Update("status", 0).Error; err != nil {
		t.Fatalf("disable provider: %v", err)
	}

	resp := requestMerchantSendLoginCode(t, user.Phone)
	if resp.Code != 403 {
		t.Fatalf("unexpected code: got=%d message=%s", resp.Code, resp.Message)
	}
	if !strings.Contains(resp.Message, "账号状态异常") {
		t.Fatalf("expected abnormal account message, got=%q", resp.Message)
	}

	var auditCount int64
	if err := db.Model(&model.SMSAuditLog{}).Count(&auditCount).Error; err != nil {
		t.Fatalf("count sms audit logs: %v", err)
	}
	if auditCount != 0 {
		t.Fatalf("disabled merchant should not reach SMS sending, auditCount=%d", auditCount)
	}
}

func TestMerchantSendLoginCode_AllowsActiveProvider(t *testing.T) {
	gin.SetMode(gin.TestMode)
	t.Setenv("APP_ENV", "local")
	t.Setenv("SMS_FIXED_CODE_MODE", "1")

	db := setupSQLiteDB(t)
	previousDB := repository.DB
	repository.DB = db
	t.Cleanup(func() { repository.DB = previousDB })

	user := model.User{Phone: "13800003333", Nickname: "正常商家", Status: 1}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("seed user: %v", err)
	}
	provider := model.Provider{UserID: user.ID, ProviderType: 1, CompanyName: "正常商家", Status: 1, Verified: true, IsSettled: true}
	if err := db.Create(&provider).Error; err != nil {
		t.Fatalf("seed provider: %v", err)
	}

	resp := requestMerchantSendLoginCode(t, user.Phone)
	if resp.Code != 0 {
		t.Fatalf("unexpected code: got=%d message=%s", resp.Code, resp.Message)
	}

	var data struct {
		DebugCode string `json:"debugCode"`
		DebugOnly bool   `json:"debugOnly"`
	}
	if err := json.Unmarshal(resp.Data, &data); err != nil {
		t.Fatalf("decode response data: %v", err)
	}
	if !data.DebugOnly || data.DebugCode == "" {
		t.Fatalf("expected fixed-code debug payload in local mode, got %+v", data)
	}

	var audit model.SMSAuditLog
	if err := db.First(&audit).Error; err != nil {
		t.Fatalf("load sms audit log: %v", err)
	}
	if audit.Purpose != string(service.SMSPurposeMerchantLogin) {
		t.Fatalf("expected merchant login SMS purpose, got %s", audit.Purpose)
	}
}

func TestMerchantSendLoginCode_TrimsPhoneBeforeLookupAndSending(t *testing.T) {
	gin.SetMode(gin.TestMode)
	t.Setenv("APP_ENV", "local")
	t.Setenv("SMS_FIXED_CODE_MODE", "1")

	db := setupSQLiteDB(t)
	previousDB := repository.DB
	repository.DB = db
	t.Cleanup(func() { repository.DB = previousDB })

	user := model.User{Phone: "13800004444", Nickname: "空格商家", Status: 1}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("seed user: %v", err)
	}
	provider := model.Provider{UserID: user.ID, ProviderType: 1, CompanyName: "空格商家", Status: 1, Verified: true, IsSettled: true}
	if err := db.Create(&provider).Error; err != nil {
		t.Fatalf("seed provider: %v", err)
	}

	resp := requestMerchantSendLoginCode(t, " 13800004444 ")
	if resp.Code != 0 {
		t.Fatalf("unexpected code: got=%d message=%s", resp.Code, resp.Message)
	}

	var audit model.SMSAuditLog
	if err := db.First(&audit).Error; err != nil {
		t.Fatalf("load sms audit log: %v", err)
	}
	if audit.Purpose != string(service.SMSPurposeMerchantLogin) || strings.TrimSpace(audit.RequestID) == "" {
		t.Fatalf("expected merchant login SMS audit with request id, got %+v", audit)
	}
}

func requestMerchantSendLoginCode(t *testing.T, phone string) responseEnvelope {
	t.Helper()

	raw, err := json.Marshal(map[string]string{"phone": phone})
	if err != nil {
		t.Fatalf("marshal payload: %v", err)
	}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/api/v1/merchant/login/send-code", bytes.NewReader(raw))
	c.Request.Header.Set("Content-Type", "application/json")

	MerchantSendLoginCode(c)
	return decodeResponse(t, w)
}
