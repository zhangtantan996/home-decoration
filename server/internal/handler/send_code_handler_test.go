package handler

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"home-decoration-server/internal/model"

	"github.com/gin-gonic/gin"
)

func TestSendCodeRejectsInvalidPurpose(t *testing.T) {
	gin.SetMode(gin.TestMode)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/api/v1/auth/send-code", strings.NewReader(`{"phone":"13800138000","purpose":"reset_password"}`))
	c.Request.Header.Set("Content-Type", "application/json")

	SendCode(c)

	resp := decodeResponse(t, w)
	if w.Code != http.StatusBadRequest || resp.Code != 400 {
		t.Fatalf("expected bad request, status=%d resp=%+v", w.Code, resp)
	}
	if !strings.Contains(resp.Message, "验证码业务场景无效") {
		t.Fatalf("expected invalid purpose message, got=%q", resp.Message)
	}
}

func TestSendCodeRejectsMerchantLoginPurpose(t *testing.T) {
	gin.SetMode(gin.TestMode)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/api/v1/auth/send-code", strings.NewReader(`{"phone":"13800138000","purpose":"merchant_login"}`))
	c.Request.Header.Set("Content-Type", "application/json")

	SendCode(c)

	resp := decodeResponse(t, w)
	if w.Code != http.StatusBadRequest || resp.Code != 400 {
		t.Fatalf("expected bad request, status=%d resp=%+v", w.Code, resp)
	}
	if !strings.Contains(resp.Message, "商家登录页") {
		t.Fatalf("expected merchant login redirect message, got=%q", resp.Message)
	}
}

func TestSendCodeRejectsDeleteAccountWithoutLogin(t *testing.T) {
	gin.SetMode(gin.TestMode)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/api/v1/auth/send-code", strings.NewReader(`{"phone":"13800138000","purpose":"delete_account"}`))
	c.Request.Header.Set("Content-Type", "application/json")

	SendCode(c)

	resp := decodeResponse(t, w)
	if w.Code != http.StatusUnauthorized || resp.Code != 401 {
		t.Fatalf("expected unauthorized, status=%d resp=%+v", w.Code, resp)
	}
	if !strings.Contains(resp.Message, "请先登录") {
		t.Fatalf("expected login required message, got=%q", resp.Message)
	}
}

func TestSendCodeRejectsDeleteAccountPhoneMismatch(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupUserSettingsHandlerDB(t)

	user := model.User{
		Phone:    "13800138000",
		Nickname: "delete-code-phone-test",
		UserType: 1,
		Status:   1,
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/api/v1/auth/send-code", strings.NewReader(`{"phone":"13900139000","purpose":"delete_account"}`))
	c.Request.Header.Set("Content-Type", "application/json")
	c.Set("userId", user.ID)

	SendCode(c)

	resp := decodeResponse(t, w)
	if w.Code != http.StatusBadRequest || resp.Code != 400 {
		t.Fatalf("expected bad request, status=%d resp=%+v", w.Code, resp)
	}
	if !strings.Contains(resp.Message, "当前账号绑定手机号") {
		t.Fatalf("expected bound phone message, got=%q", resp.Message)
	}
}
