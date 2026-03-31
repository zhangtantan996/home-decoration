package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

type handlerErrorEnvelope struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

func decodeHandlerErrorEnvelope(t *testing.T, recorder *httptest.ResponseRecorder) handlerErrorEnvelope {
	t.Helper()
	var envelope handlerErrorEnvelope
	if err := json.Unmarshal(recorder.Body.Bytes(), &envelope); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	return envelope
}

func TestRespondScopedAccessErrorSemantics(t *testing.T) {
	gin.SetMode(gin.TestMode)

	testCases := []struct {
		name       string
		err        error
		wantStatus int
		wantCode   int
	}{
		{name: "forbidden", err: errors.New("无权查看该合同"), wantStatus: http.StatusForbidden, wantCode: 403},
		{name: "not_found", err: errors.New("项目未找到"), wantStatus: http.StatusNotFound, wantCode: 404},
		{name: "server_error", err: errors.New("数据库连接失败"), wantStatus: http.StatusInternalServerError, wantCode: 500},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			ctx, _ := gin.CreateTestContext(recorder)

			respondScopedAccessError(ctx, tc.err, "fallback")

			if recorder.Code != tc.wantStatus {
				t.Fatalf("unexpected http status: got=%d want=%d body=%s", recorder.Code, tc.wantStatus, recorder.Body.String())
			}
			envelope := decodeHandlerErrorEnvelope(t, recorder)
			if envelope.Code != tc.wantCode {
				t.Fatalf("unexpected business code: got=%d want=%d body=%s", envelope.Code, tc.wantCode, recorder.Body.String())
			}
		})
	}
}

func TestRespondDomainMutationErrorSemantics(t *testing.T) {
	gin.SetMode(gin.TestMode)

	testCases := []struct {
		name       string
		err        error
		wantStatus int
		wantCode   int
	}{
		{name: "forbidden", err: errors.New("无权操作该项目"), wantStatus: http.StatusForbidden, wantCode: 403},
		{name: "not_found", err: errors.New("报价单不存在"), wantStatus: http.StatusNotFound, wantCode: 404},
		{name: "conflict_current_status", err: errors.New("当前状态不可提交"), wantStatus: http.StatusConflict, wantCode: 409},
		{name: "conflict_duplicate", err: errors.New("不能重复确认"), wantStatus: http.StatusConflict, wantCode: 409},
		{name: "conflict_locked", err: errors.New("报价已锁定，如需调整请发起变更单或重报价"), wantStatus: http.StatusConflict, wantCode: 409},
		{name: "bad_request", err: errors.New("参数格式错误"), wantStatus: http.StatusBadRequest, wantCode: 400},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			ctx, _ := gin.CreateTestContext(recorder)

			respondDomainMutationError(ctx, tc.err, "fallback")

			if recorder.Code != tc.wantStatus {
				t.Fatalf("unexpected http status: got=%d want=%d body=%s", recorder.Code, tc.wantStatus, recorder.Body.String())
			}
			envelope := decodeHandlerErrorEnvelope(t, recorder)
			if envelope.Code != tc.wantCode {
				t.Fatalf("unexpected business code: got=%d want=%d body=%s", envelope.Code, tc.wantCode, recorder.Body.String())
			}
		})
	}
}

func TestRespondAdminRBACMutationErrorSemantics(t *testing.T) {
	gin.SetMode(gin.TestMode)

	testCases := []struct {
		name       string
		err        error
		wantStatus int
		wantCode   int
	}{
		{name: "not_found", err: errors.New("角色不存在"), wantStatus: http.StatusNotFound, wantCode: 404},
		{name: "conflict_reserved_roles", err: errors.New("三员分立角色不能同时分配给同一管理员"), wantStatus: http.StatusConflict, wantCode: 409},
		{name: "conflict_disabled_role", err: errors.New("角色 审计员 已禁用，不能分配"), wantStatus: http.StatusConflict, wantCode: 409},
		{name: "conflict_auditor_write", err: errors.New("审计员角色只能分配只读权限，当前权限 finance:transaction:approve 不允许"), wantStatus: http.StatusConflict, wantCode: 409},
		{name: "bad_request_invalid_menu", err: errors.New("存在无效菜单，无法完成授权"), wantStatus: http.StatusBadRequest, wantCode: 400},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			ctx, _ := gin.CreateTestContext(recorder)

			respondAdminRBACMutationError(ctx, tc.err, "fallback")

			if recorder.Code != tc.wantStatus {
				t.Fatalf("unexpected http status: got=%d want=%d body=%s", recorder.Code, tc.wantStatus, recorder.Body.String())
			}
			envelope := decodeHandlerErrorEnvelope(t, recorder)
			if envelope.Code != tc.wantCode {
				t.Fatalf("unexpected business code: got=%d want=%d body=%s", envelope.Code, tc.wantCode, recorder.Body.String())
			}
		})
	}
}
