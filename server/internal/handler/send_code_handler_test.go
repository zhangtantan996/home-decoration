package handler

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

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
