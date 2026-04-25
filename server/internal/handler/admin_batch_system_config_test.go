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

func TestAdminBatchUpdateSystemConfigsFailsAtomically(t *testing.T) {
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

	body, err := json.Marshal(map[string]string{
		"booking.intent_fee": "199",
		model.ConfigKeyMiniHomePopup: `{
			"enabled": true,
			"theme": "sunrise",
			"kicker": "免费预估",
			"title": "30 秒生成装修报价",
			"subtitle": "填写几项信息，快速拿到装修预算参考。",
			"primaryAction": {"text": "立即生成", "path": "https://bad.example.com"},
			"secondaryAction": {"enabled": false, "text": "", "path": ""},
			"frequency": "daily_once"
		}`,
	})
	if err != nil {
		t.Fatalf("marshal request body: %v", err)
	}

	req := httptest.NewRequest(http.MethodPut, "/api/v1/admin/system-configs/batch", strings.NewReader(string(body)))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(rec)
	c.Request = req
	c.Set("admin_id", uint64(9))
	c.Set("admin_reason", "校验首页弹窗非法配置不能假成功")

	AdminBatchUpdateSystemConfigs(c)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 envelope, got %d body=%s", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), `"code":400`) {
		t.Fatalf("expected business error code 400, got %s", rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), "更新配置 mini.home_popup.config 失败") {
		t.Fatalf("expected popup config failure message, got %s", rec.Body.String())
	}

	var updated model.SystemConfig
	if err := db.Where("key = ?", "booking.intent_fee").First(&updated).Error; err != nil {
		t.Fatalf("query updated config: %v", err)
	}
	if updated.Value != "99" {
		t.Fatalf("expected booking.intent_fee rollback to 99, got %s", updated.Value)
	}

	var logs []model.AuditLog
	if err := db.Find(&logs).Error; err != nil {
		t.Fatalf("query audit logs: %v", err)
	}
	if len(logs) != 0 {
		t.Fatalf("expected no audit log on failed batch update, got %d", len(logs))
	}
}
