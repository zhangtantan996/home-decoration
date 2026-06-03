package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"

	"github.com/gin-gonic/gin"
)

func TestAdminListCasesExcludeProviderType(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db := setupRawSQLiteDB(t)
	migrateHandlerRuntimeTestSchema(t, db, &model.ProviderCase{})
	previousDB := repository.DB
	repository.DB = db
	t.Cleanup(func() { repository.DB = previousDB })

	designer := model.Provider{CompanyName: "设计师案例", ProviderType: 1}
	foreman := model.Provider{CompanyName: "工长工艺", ProviderType: 3}
	if err := db.Create(&designer).Error; err != nil {
		t.Fatalf("create designer provider: %v", err)
	}
	if err := db.Create(&foreman).Error; err != nil {
		t.Fatalf("create foreman provider: %v", err)
	}

	cases := []model.ProviderCase{
		{ProviderID: 0, Title: "官方灵感", Style: "现代简约", Layout: "两居", ShowInInspiration: true, Images: "[]"},
		{ProviderID: designer.ID, Title: "设计案例", Style: "现代简约", Layout: "三居", ShowInInspiration: true, Images: "[]"},
		{ProviderID: foreman.ID, Title: "工长工艺", Style: "现代简约", Layout: "工艺", ShowInInspiration: false, Images: "[]"},
	}
	if err := db.Create(&cases).Error; err != nil {
		t.Fatalf("create provider cases: %v", err)
	}

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/v1/admin/cases?page=1&pageSize=10&excludeProviderType=3", nil)

	AdminListCases(ctx)

	resp := decodeResponse(t, recorder)
	if resp.Code != 0 {
		t.Fatalf("unexpected response: code=%d message=%s", resp.Code, resp.Message)
	}

	var payload struct {
		List []struct {
			ID           uint64 `json:"id"`
			ProviderID   uint64 `json:"providerId"`
			ProviderType int    `json:"providerType"`
			Title        string `json:"title"`
		} `json:"list"`
		Total int `json:"total"`
	}
	if err := json.Unmarshal(resp.Data, &payload); err != nil {
		t.Fatalf("decode payload: %v", err)
	}

	if payload.Total != 2 {
		t.Fatalf("expected filtered total=2, got %+v", payload)
	}
	if len(payload.List) != 2 {
		t.Fatalf("expected 2 visible cases after filtering, got %+v", payload.List)
	}
	for _, item := range payload.List {
		if item.ProviderType == 3 || item.ProviderID == foreman.ID {
			t.Fatalf("expected foreman case excluded, got %+v", payload.List)
		}
	}
}
