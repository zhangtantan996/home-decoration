package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"

	"github.com/gin-gonic/gin"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

type adminRiskWarningListResponse struct {
	Code int `json:"code"`
	Data struct {
		List []model.RiskWarning `json:"list"`
	} `json:"data"`
}

func setupAdminRiskWarningHandlerTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	dsn := "file:" + t.Name() + "?mode=memory&cache=shared"
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite db: %v", err)
	}
	if err := db.AutoMigrate(&model.RiskWarning{}); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}

	oldDB := repository.DB
	repository.DB = db
	t.Cleanup(func() {
		repository.DB = oldDB
	})
	return db
}

func TestAdminListRiskWarningsFiltersByStatus(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupAdminRiskWarningHandlerTestDB(t)
	now := time.Now()
	warnings := []model.RiskWarning{
		{Base: model.Base{ID: 1, CreatedAt: now, UpdatedAt: now}, ProjectID: 11, ProjectName: "项目A", Type: "refund", Level: "high", Description: "待处理", Status: 0},
		{Base: model.Base{ID: 2, CreatedAt: now, UpdatedAt: now}, ProjectID: 12, ProjectName: "项目B", Type: "refund", Level: "high", Description: "已处理", Status: 2},
	}
	for i := range warnings {
		if err := db.Create(&warnings[i]).Error; err != nil {
			t.Fatalf("seed warning: %v", err)
		}
	}

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/risk/warnings?status=0", nil)
	ctx.Request = req

	AdminListRiskWarnings(ctx)

	if recorder.Code != http.StatusOK {
		t.Fatalf("unexpected status: got=%d body=%s", recorder.Code, recorder.Body.String())
	}
	var payload adminRiskWarningListResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if len(payload.Data.List) != 1 || payload.Data.List[0].ID != 1 {
		t.Fatalf("unexpected list payload: %+v", payload.Data.List)
	}
}

func TestAdminHandleRiskWarningReturnsConflictWhenAlreadyHandled(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupAdminRiskWarningHandlerTestDB(t)
	now := time.Now()
	if err := db.Create(&model.RiskWarning{
		Base:         model.Base{ID: 9, CreatedAt: now, UpdatedAt: now},
		ProjectID:    22,
		ProjectName:  "项目冲突",
		Type:         "payment",
		Level:        "high",
		Description:  "已处理预警",
		Status:       2,
		HandleResult: "已处理",
	}).Error; err != nil {
		t.Fatalf("seed warning: %v", err)
	}

	body := bytes.NewBufferString(`{"status":2,"result":"再次处理"}`)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/admin/risk/warnings/9/handle", body)
	req.Header.Set("Content-Type", "application/json")
	ctx.Request = req
	ctx.Params = gin.Params{{Key: "id", Value: "9"}}
	ctx.Set("admin_id", uint64(7001))

	AdminHandleRiskWarning(ctx)

	if recorder.Code != http.StatusConflict {
		t.Fatalf("unexpected status: got=%d body=%s", recorder.Code, recorder.Body.String())
	}
	envelope := decodeHandlerErrorEnvelope(t, recorder)
	if envelope.Code != 409 {
		t.Fatalf("unexpected code: %+v", envelope)
	}
}

func TestAdminHandleRiskWarningUpdatesRecord(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupAdminRiskWarningHandlerTestDB(t)
	now := time.Now()
	if err := db.Create(&model.RiskWarning{
		Base:        model.Base{ID: 18, CreatedAt: now, UpdatedAt: now},
		ProjectID:   33,
		ProjectName: "项目处理",
		Type:        "delay",
		Level:       "medium",
		Description: "待处理预警",
		Status:      0,
	}).Error; err != nil {
		t.Fatalf("seed warning: %v", err)
	}

	body := bytes.NewBufferString(`{"status":1,"result":"已升级人工跟进"}`)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/admin/risk/warnings/18/handle", body)
	req.Header.Set("Content-Type", "application/json")
	ctx.Request = req
	ctx.Params = gin.Params{{Key: "id", Value: "18"}}
	ctx.Set("admin_id", uint64(7002))

	AdminHandleRiskWarning(ctx)

	if recorder.Code != http.StatusOK {
		t.Fatalf("unexpected status: got=%d body=%s", recorder.Code, recorder.Body.String())
	}

	var warning model.RiskWarning
	if err := db.First(&warning, 18).Error; err != nil {
		t.Fatalf("reload warning: %v", err)
	}
	if warning.Status != 1 || warning.HandleResult != "已升级人工跟进" {
		t.Fatalf("unexpected warning: %+v", warning)
	}
	if warning.HandledBy == nil || *warning.HandledBy != 7002 {
		t.Fatalf("unexpected handler admin: %+v", warning.HandledBy)
	}
}
