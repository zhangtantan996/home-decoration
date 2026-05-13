package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	"home-decoration-server/internal/service"

	"github.com/gin-gonic/gin"
)

func TestRedactAdminAuditLogDetailsHidesSensitivePayloads(t *testing.T) {
	items := []service.AdminAuditLogItem{
		{
			RequestBody: `{"phone":"13800000000"}`,
			BeforeState: map[string]interface{}{
				"status": "old",
			},
			AfterState: map[string]interface{}{
				"status": "new",
			},
			Metadata: map[string]interface{}{
				"ip": "127.0.0.1",
			},
			ClientIP:  "127.0.0.1",
			UserAgent: "test-agent",
		},
	}

	redacted := redactAdminAuditLogDetails(items)

	if redacted[0].RequestBody != "" || redacted[0].ClientIP != "" || redacted[0].UserAgent != "" {
		t.Fatalf("expected sensitive audit fields to be hidden, got %+v", redacted[0])
	}
	if redacted[0].BeforeState["restricted"] != true || redacted[0].AfterState["restricted"] != true || redacted[0].Metadata["restricted"] != true {
		t.Fatalf("expected detail payloads to be restricted, got before=%+v after=%+v meta=%+v", redacted[0].BeforeState, redacted[0].AfterState, redacted[0].Metadata)
	}
	if items[0].ClientIP == "" || items[0].RequestBody == "" {
		t.Fatalf("redaction should not mutate source slice, got %+v", items[0])
	}
}

func TestAdminCanViewFullAuditPayloadRequiresPrivilegedRole(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupSQLiteDB(t)
	oldDB := repository.DB
	repository.DB = db
	t.Cleanup(func() { repository.DB = oldDB })

	roles := []model.SysRole{
		{ID: 9101, Name: "运营管理", Key: "operations", Status: 1},
		{ID: 9102, Name: "系统管理员", Key: service.ReservedRoleSystemAdmin, Status: 1},
	}
	if err := db.Create(&roles).Error; err != nil {
		t.Fatalf("seed roles: %v", err)
	}
	if err := db.Create(&model.SysAdminRole{AdminID: 9201, RoleID: 9101}).Error; err != nil {
		t.Fatalf("seed operations admin role: %v", err)
	}
	if err := db.Create(&model.SysAdminRole{AdminID: 9202, RoleID: 9102}).Error; err != nil {
		t.Fatalf("seed system admin role: %v", err)
	}

	opsCtx, _ := gin.CreateTestContext(httptest.NewRecorder())
	opsCtx.Set("admin_id", uint64(9201))
	if adminCanViewFullAuditPayload(opsCtx) {
		t.Fatal("operations role should not view full audit payloads")
	}

	systemCtx, _ := gin.CreateTestContext(httptest.NewRecorder())
	systemCtx.Set("admin_id", uint64(9202))
	if !adminCanViewFullAuditPayload(systemCtx) {
		t.Fatal("system admin role should view full audit payloads")
	}

	superCtx, _ := gin.CreateTestContext(httptest.NewRecorder())
	superCtx.Set("is_super", true)
	if !adminCanViewFullAuditPayload(superCtx) {
		t.Fatal("super admin flag should view full audit payloads")
	}
}

func TestAdminExportAuditLogsRejectsNonPrivilegedAdmin(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupSQLiteDB(t)
	oldDB := repository.DB
	repository.DB = db
	t.Cleanup(func() { repository.DB = oldDB })

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/v1/admin/audit-logs/export", nil)
	ctx.Set("admin_id", uint64(9301))

	AdminExportAuditLogs(ctx)

	if recorder.Code != http.StatusForbidden {
		t.Fatalf("expected 403 for non-privileged audit export, got %d body=%s", recorder.Code, recorder.Body.String())
	}
}
