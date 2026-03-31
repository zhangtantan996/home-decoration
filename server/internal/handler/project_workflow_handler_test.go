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
	if err := db.AutoMigrate(
		&model.User{},
		&model.Provider{},
		&model.Notification{},
		&model.AuditLog{},
		&model.Project{},
		&model.Milestone{},
		&model.BusinessFlow{},
		&model.ProjectPhase{},
		&model.EscrowAccount{},
		&model.Transaction{},
		&model.Order{},
		&model.PaymentPlan{},
		&model.MerchantIncome{},
		&model.SystemConfig{},
		&model.SettlementOrder{},
		&model.PayoutOrder{},
		&model.LedgerAccount{},
		&model.LedgerEntry{},
	); err != nil {
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
		Name:                   "测试项目",
		Address:                "测试地址",
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
		Amount:    5000,
		Status:    model.MilestoneStatusInProgress,
	}
	flow := model.BusinessFlow{
		Base:         model.Base{ID: 151},
		ProjectID:    project.ID,
		CurrentStage: model.BusinessFlowStageInProgress,
	}
	escrow := model.EscrowAccount{
		Base:            model.Base{ID: 161},
		ProjectID:       project.ID,
		UserID:          owner.ID,
		TotalAmount:     30000,
		AvailableAmount: 30000,
		Status:          1,
	}
	constructionFeeRate := model.SystemConfig{
		Base:  model.Base{ID: 171},
		Key:   model.ConfigKeyConstructionFeeRate,
		Value: "0.1",
		Type:  "number",
	}
	releaseDelayDays := model.SystemConfig{
		Base:  model.Base{ID: 172},
		Key:   model.ConfigKeyPaymentReleaseDelayDays,
		Value: "3",
		Type:  "number",
	}
	for _, record := range []interface{}{&owner, &provider, &project, &milestone, &flow, &escrow, &constructionFeeRate, &releaseDelayDays} {
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
	if data["errorCode"] != projectCompleteLegacyDisabledCode {
		t.Fatalf("expected errorCode %s, got %+v", projectCompleteLegacyDisabledCode, payload)
	}
}

func TestLegacyCreateProjectEndpointDisabled(t *testing.T) {
	gin.SetMode(gin.TestMode)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/projects", nil)
	w := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(w)
	ctx.Request = req
	ctx.Set("userId", uint64(7))

	CreateProject(ctx)

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
	if data["errorCode"] != projectCreateLegacyDisabledCode {
		t.Fatalf("expected errorCode %s, got %+v", projectCreateLegacyDisabledCode, payload)
	}
}

func TestLegacyGenerateBillEndpointDisabled(t *testing.T) {
	gin.SetMode(gin.TestMode)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/projects/21/bill", nil)
	w := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(w)
	ctx.Request = req
	ctx.Params = gin.Params{{Key: "id", Value: "21"}}
	ctx.Set("userId", uint64(7))

	GenerateBill(ctx)

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
	if data["errorCode"] != projectBillLegacyDisabledCode {
		t.Fatalf("expected errorCode %s, got %+v", projectBillLegacyDisabledCode, payload)
	}
}

func TestLegacyConstructionConfirmEndpointDisabled(t *testing.T) {
	gin.SetMode(gin.TestMode)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/projects/21/construction/confirm", nil)
	w := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(w)
	ctx.Request = req
	ctx.Params = gin.Params{{Key: "id", Value: "21"}}
	ctx.Set("userId", uint64(7))

	ConfirmProjectConstruction(ctx)

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
	if data["errorCode"] != projectConstructionConfirmLegacyCode {
		t.Fatalf("expected errorCode %s, got %+v", projectConstructionConfirmLegacyCode, payload)
	}
}

func TestLegacyConstructionQuoteConfirmEndpointDisabled(t *testing.T) {
	gin.SetMode(gin.TestMode)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/projects/21/construction/quote/confirm", nil)
	w := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(w)
	ctx.Request = req
	ctx.Params = gin.Params{{Key: "id", Value: "21"}}
	ctx.Set("userId", uint64(7))

	ConfirmProjectConstructionQuote(ctx)

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
	if data["errorCode"] != projectConstructionQuoteConfirmLegacyCode {
		t.Fatalf("expected errorCode %s, got %+v", projectConstructionQuoteConfirmLegacyCode, payload)
	}
}
