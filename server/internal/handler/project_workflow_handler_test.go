package handler

import (
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

func setupProjectWorkflowHandlerTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	db, err := gorm.Open(gormsqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite db: %v", err)
	}
	if err := db.AutoMigrate(&model.User{}, &model.Provider{}, &model.Notification{}, &model.AuditLog{}, &model.Project{}, &model.Milestone{}, &model.BusinessFlow{}, &model.Order{}, &model.PaymentPlan{}); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}

	previousDB := repository.DB
	repository.DB = db
	t.Cleanup(func() {
		repository.DB = previousDB
	})
	return db
}

func TestProjectMilestoneHandlers(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupProjectWorkflowHandlerTestDB(t)

	owner := model.User{Base: model.Base{ID: 7}, Phone: "13800138007", Status: 1}
	provider := model.Provider{Base: model.Base{ID: 88}, ProviderType: 2, CompanyName: "施工公司"}
	project := model.Project{
		Base:                   model.Base{ID: 21},
		OwnerID:                owner.ID,
		ProviderID:             provider.ID,
		ConstructionProviderID: provider.ID,
		ConstructionQuote:      12000,
		Status:                 model.ProjectStatusActive,
		BusinessStatus:         model.ProjectBusinessStatusInProgress,
		CurrentPhase:           "开工交底施工中",
	}
	milestone := model.Milestone{
		Base:      model.Base{ID: 101},
		ProjectID: project.ID,
		Name:      "开工交底",
		Seq:       1,
		Status:    model.MilestoneStatusInProgress,
	}
	for _, record := range []interface{}{&owner, &provider, &project, &milestone} {
		if err := db.Create(record).Error; err != nil {
			t.Fatalf("seed workflow record: %v", err)
		}
	}

	submitReq := httptest.NewRequest(http.MethodPost, "/api/v1/projects/21/milestones/101/submit", nil)
	submitW := httptest.NewRecorder()
	submitCtx, _ := gin.CreateTestContext(submitW)
	submitCtx.Request = submitReq
	submitCtx.Params = gin.Params{
		{Key: "id", Value: "21"},
		{Key: "milestoneId", Value: "101"},
	}
	submitCtx.Set("providerId", uint64(88))

	SubmitMilestone(submitCtx)

	if submitW.Code != http.StatusOK {
		t.Fatalf("expected submit 200, got %d body=%s", submitW.Code, submitW.Body.String())
	}

	var submitted model.Milestone
	if err := db.First(&submitted, milestone.ID).Error; err != nil {
		t.Fatalf("reload submitted milestone: %v", err)
	}
	if submitted.Status != model.MilestoneStatusSubmitted {
		t.Fatalf("expected submitted status, got %d", submitted.Status)
	}

	acceptReq := httptest.NewRequest(http.MethodPost, "/api/v1/projects/21/milestones/101/accept", nil)
	acceptW := httptest.NewRecorder()
	acceptCtx, _ := gin.CreateTestContext(acceptW)
	acceptCtx.Request = acceptReq
	acceptCtx.Params = gin.Params{
		{Key: "id", Value: "21"},
		{Key: "milestoneId", Value: "101"},
	}
	acceptCtx.Set("userId", uint64(7))

	AcceptMilestone(acceptCtx)

	if acceptW.Code != http.StatusOK {
		t.Fatalf("expected accept 200, got %d body=%s", acceptW.Code, acceptW.Body.String())
	}

	var completedProject model.Project
	if err := db.First(&completedProject, project.ID).Error; err != nil {
		t.Fatalf("reload project: %v", err)
	}
	if completedProject.BusinessStatus != model.ProjectBusinessStatusInProgress {
		t.Fatalf("expected in-progress business status before completion submission, got %q", completedProject.BusinessStatus)
	}
	if completedProject.CurrentPhase != "待提交完工材料" {
		t.Fatalf("expected current phase 待提交完工材料, got %q", completedProject.CurrentPhase)
	}
}

func TestLegacyCompleteProjectEndpointDisabled(t *testing.T) {
	gin.SetMode(gin.TestMode)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/projects/21/complete", nil)
	w := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(w)
	ctx.Request = req
	ctx.Params = gin.Params{{Key: "id", Value: "21"}}
	ctx.Set("userId", uint64(7))

	CompleteProject(ctx)

	if w.Code != http.StatusConflict {
		t.Fatalf("expected 409, got %d body=%s", w.Code, w.Body.String())
	}

	var payload map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &payload); err != nil {
		t.Fatalf("parse response: %v", err)
	}
	if int(payload["code"].(float64)) != 409 {
		t.Fatalf("expected business code 409, got %+v", payload)
	}
	data, _ := payload["data"].(map[string]any)
	if data["errorCode"] != "PROJECT_COMPLETE_LEGACY_DISABLED" {
		t.Fatalf("expected errorCode PROJECT_COMPLETE_LEGACY_DISABLED, got %+v", payload)
	}
}
