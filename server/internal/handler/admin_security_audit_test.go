package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
)

func TestAdminUpdateSystemConfigWritesAuditReason(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db := setupSQLiteDB(t)
	if err := db.AutoMigrate(&model.SystemConfig{}, &model.AuditLog{}); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}

	previousDB := repository.DB
	repository.DB = db
	t.Cleanup(func() { repository.DB = previousDB })

	if err := db.Create(&model.SystemConfig{
		Key:         "booking.intent_fee",
		Value:       "99",
		Description: "旧说明",
		Editable:    true,
	}).Error; err != nil {
		t.Fatalf("seed system config: %v", err)
	}

	body := `{"value":"199","description":"新说明"}`
	req := httptest.NewRequest(http.MethodPut, "/api/v1/admin/system-configs/booking.intent_fee", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(rec)
	c.Request = req
	c.Params = gin.Params{{Key: "key", Value: "booking.intent_fee"}}
	c.Set("admin_id", uint64(9))
	c.Set("admin_reason", "安全加固回写审计")

	AdminUpdateSystemConfig(c)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", rec.Code, rec.Body.String())
	}

	var updated model.SystemConfig
	if err := db.Where("key = ?", "booking.intent_fee").First(&updated).Error; err != nil {
		t.Fatalf("query updated config: %v", err)
	}
	if updated.Value != "199" {
		t.Fatalf("expected updated value 199, got %s", updated.Value)
	}

	var logs []model.AuditLog
	if err := db.Order("id ASC").Find(&logs).Error; err != nil {
		t.Fatalf("query audit logs: %v", err)
	}
	if len(logs) != 1 {
		t.Fatalf("expected 1 audit log, got %d", len(logs))
	}
	if logs[0].Reason != "安全加固回写审计" {
		t.Fatalf("unexpected audit reason: %s", logs[0].Reason)
	}
	if logs[0].OperationType != "update_system_config" {
		t.Fatalf("unexpected operation type: %s", logs[0].OperationType)
	}

	var afterState map[string]interface{}
	if err := json.Unmarshal([]byte(logs[0].AfterState), &afterState); err != nil {
		t.Fatalf("decode after state: %v", err)
	}
	if afterState["value"] != "199" {
		t.Fatalf("unexpected after state value: %#v", afterState["value"])
	}
}
