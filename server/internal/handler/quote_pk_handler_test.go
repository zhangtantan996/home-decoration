package handler

import (
	"bytes"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

type legacyQuotePKEnvelope struct {
	Code int `json:"code"`
	Data struct {
		ErrorCode string `json:"errorCode"`
	} `json:"data"`
	Message string `json:"message"`
}

func decodeLegacyQuotePKEnvelope(t *testing.T, recorder *httptest.ResponseRecorder) legacyQuotePKEnvelope {
	t.Helper()
	var envelope legacyQuotePKEnvelope
	if err := json.Unmarshal(recorder.Body.Bytes(), &envelope); err != nil {
		t.Fatalf("decode legacy quote-pk response: %v", err)
	}
	return envelope
}

func performLegacyQuotePKMutation(
	t *testing.T,
	method string,
	path string,
	payload string,
	ctxValues map[string]any,
	params gin.Params,
	handlerFunc gin.HandlerFunc,
) legacyQuotePKEnvelope {
	t.Helper()
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(method, path, bytes.NewBufferString(payload))
	c.Request.Header.Set("Content-Type", "application/json")
	c.Params = params
	for key, value := range ctxValues {
		c.Set(key, value)
	}

	handlerFunc(c)

	if recorder.Code != http.StatusConflict {
		t.Fatalf("unexpected http status: got=%d want=%d", recorder.Code, http.StatusConflict)
	}
	return decodeLegacyQuotePKEnvelope(t, recorder)
}

func TestLegacyQuotePKMutationEndpointsRetired(t *testing.T) {
	gin.SetMode(gin.TestMode)

	cases := []struct {
		name        string
		method      string
		path        string
		payload     string
		ctxValues   map[string]any
		params      gin.Params
		handlerFunc gin.HandlerFunc
	}{
		{
			name:        "create task",
			method:      http.MethodPost,
			path:        "/api/v1/quote-pk/tasks",
			payload:     `{"bookingId":1,"area":88,"style":"现代","region":"上海","budget":300000}`,
			ctxValues:   map[string]any{"userId": uint64(1001)},
			handlerFunc: CreateQuoteTask,
		},
		{
			name:        "select quote",
			method:      http.MethodPost,
			path:        "/api/v1/quote-pk/tasks/8/select",
			payload:     `{"submissionId":5}`,
			ctxValues:   map[string]any{"userId": uint64(1001)},
			params:      gin.Params{{Key: "id", Value: "8"}},
			handlerFunc: SelectQuote,
		},
		{
			name:        "merchant submit quote",
			method:      http.MethodPost,
			path:        "/api/v1/merchant/quote-pk/tasks/8/submit",
			payload:     `{"totalPrice":10000,"duration":7}`,
			ctxValues:   map[string]any{"providerId": uint64(2001)},
			params:      gin.Params{{Key: "id", Value: "8"}},
			handlerFunc: MerchantSubmitQuote,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			envelope := performLegacyQuotePKMutation(t, tc.method, tc.path, tc.payload, tc.ctxValues, tc.params, tc.handlerFunc)
			if envelope.Code != http.StatusConflict {
				t.Fatalf("unexpected business code: got=%d want=%d", envelope.Code, http.StatusConflict)
			}
			if envelope.Data.ErrorCode != legacyQuotePKRetiredCode {
				t.Fatalf("unexpected error code: got=%q want=%q", envelope.Data.ErrorCode, legacyQuotePKRetiredCode)
			}
		})
	}
}

func TestRespondQuotePKErrorDoesNotExposeInternalError(t *testing.T) {
	gin.SetMode(gin.TestMode)

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	respondQuotePKError(c, "test quote pk", errors.New("查询报价任务失败: ERROR: relation quote_tasks does not exist"), "获取报价任务失败，请稍后重试")

	if recorder.Code != http.StatusInternalServerError {
		t.Fatalf("unexpected http status: got=%d want=%d", recorder.Code, http.StatusInternalServerError)
	}
	if strings.Contains(recorder.Body.String(), "relation quote_tasks") || strings.Contains(recorder.Body.String(), "查询报价任务失败") {
		t.Fatalf("response exposes internal error: %s", recorder.Body.String())
	}
	if !strings.Contains(recorder.Body.String(), "获取报价任务失败，请稍后重试") {
		t.Fatalf("response missing safe fallback message: %s", recorder.Body.String())
	}
}
