package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"

	"github.com/gin-gonic/gin"
	gormsqlite "gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupSupervisorWhitelistHandlerDB(t *testing.T) *gorm.DB {
	t.Helper()

	db, err := gorm.Open(gormsqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite db: %v", err)
	}
	if err := db.AutoMigrate(&model.SupervisorPhoneWhitelist{}); err != nil {
		t.Fatalf("auto migrate whitelist: %v", err)
	}

	oldDB := repository.DB
	repository.DB = db
	t.Cleanup(func() {
		repository.DB = oldDB
	})
	return db
}

func TestAdminUpdateSupervisorWhitelistStatusAllowsZero(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupSupervisorWhitelistHandlerDB(t)

	item := model.SupervisorPhoneWhitelist{
		Base:             model.Base{ID: 1},
		Phone:            "13800138000",
		Status:           1,
		CreatedByAdminID: 9,
	}
	if err := db.Create(&item).Error; err != nil {
		t.Fatalf("create whitelist: %v", err)
	}

	body := bytes.NewBufferString(`{"status":0,"reason":"禁用测试"}`)
	rec := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(rec)
	ctx.Request = httptest.NewRequest(http.MethodPatch, "/api/v1/admin/supervisor-whitelists/1/status", body)
	ctx.Request.Header.Set("Content-Type", "application/json")
	ctx.Params = gin.Params{{Key: "id", Value: "1"}}
	ctx.Set("adminId", uint64(9))

	AdminUpdateSupervisorWhitelistStatus(ctx)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", rec.Code, rec.Body.String())
	}

	var envelope struct {
		Code int `json:"code"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &envelope); err != nil {
		t.Fatalf("decode response: %v body=%s", err, rec.Body.String())
	}
	if envelope.Code != 0 {
		t.Fatalf("expected business success, got code=%d body=%s", envelope.Code, rec.Body.String())
	}

	var updated model.SupervisorPhoneWhitelist
	if err := db.First(&updated, item.ID).Error; err != nil {
		t.Fatalf("reload whitelist: %v", err)
	}
	if updated.Status != 0 {
		t.Fatalf("expected status 0, got %d", updated.Status)
	}
}
