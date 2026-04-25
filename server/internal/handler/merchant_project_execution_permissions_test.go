package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"
	"time"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func setupMerchantProjectExecutionTestDB(t *testing.T, extraModels ...any) *gorm.DB {
	t.Helper()

	db := setupSQLiteDB(t)
	if len(extraModels) > 0 {
		if err := db.AutoMigrate(extraModels...); err != nil {
			t.Fatalf("auto migrate extra models: %v", err)
		}
	}

	previousDB := repository.DB
	repository.DB = db
	t.Cleanup(func() {
		repository.DB = previousDB
	})
	return db
}

func seedMerchantProjectExecutionActors(t *testing.T, db *gorm.DB, ownerID, providerUserID, providerID uint64) {
	t.Helper()

	records := []any{
		&model.User{Base: model.Base{ID: ownerID}, Phone: "13800138001", Nickname: "业主测试"},
		&model.User{Base: model.Base{ID: providerUserID}, Phone: "13800138002", Nickname: "工长测试"},
		&model.Provider{Base: model.Base{ID: providerID}, UserID: providerUserID, ProviderType: 3, CompanyName: "测试工长"},
	}
	for _, record := range records {
		if err := db.Create(record).Error; err != nil {
			t.Fatalf("seed actor: %v", err)
		}
	}
}

func requestMerchantProjectExecutionJSON(
	t *testing.T,
	method string,
	path string,
	payload any,
	projectID uint64,
	providerID uint64,
	handlerFunc gin.HandlerFunc,
	extraParams ...gin.Param,
) responseEnvelope {
	t.Helper()

	var body []byte
	if payload != nil {
		var err error
		body, err = json.Marshal(payload)
		if err != nil {
			t.Fatalf("marshal payload: %v", err)
		}
	}

	req := httptest.NewRequest(method, path, bytes.NewReader(body))
	if payload != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = req
	params := gin.Params{{Key: "projectId", Value: strconv.FormatUint(projectID, 10)}}
	params = append(params, extraParams...)
	c.Params = params
	c.Set("providerId", providerID)

	handlerFunc(c)

	return decodeResponse(t, w)
}

func containsAction(actions []string, target string) bool {
	for _, action := range actions {
		if action == target {
			return true
		}
	}
	return false
}

func TestMerchantGetProjectDetail_HidesStartProjectAction(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db := setupMerchantProjectExecutionTestDB(t,
		&model.Milestone{},
		&model.ProjectPhase{},
		&model.PhaseTask{},
		&model.BusinessFlow{},
		&model.ChangeOrder{},
	)
	ownerID := uint64(4101)
	providerUserID := uint64(4102)
	providerID := uint64(4103)
	seedMerchantProjectExecutionActors(t, db, ownerID, providerUserID, providerID)

	plannedStart := time.Date(2026, 4, 28, 0, 0, 0, 0, time.UTC)
	project := model.Project{
		Base:                   model.Base{ID: 4104},
		OwnerID:                ownerID,
		ProviderID:             providerID,
		ConstructionProviderID: providerID,
		Name:                   "待开工项目",
		Address:                "西安市测试路 88 号",
		Status:                 model.ProjectStatusActive,
		BusinessStatus:         model.ProjectBusinessStatusConstructionQuoteConfirmed,
		CurrentPhase:           "待监理协调开工",
		EntryStartDate:         &plannedStart,
		ConstructionQuote:      68000,
	}
	if err := db.Create(&project).Error; err != nil {
		t.Fatalf("seed project: %v", err)
	}

	resp := requestMerchantProjectExecutionJSON(
		t,
		http.MethodGet,
		"/api/v1/merchant/projects/4104",
		nil,
		project.ID,
		providerID,
		MerchantGetProjectDetail,
	)
	if resp.Code != 0 {
		t.Fatalf("unexpected code: %d message=%s", resp.Code, resp.Message)
	}

	var data struct {
		BusinessStage    string   `json:"businessStage"`
		AvailableActions []string `json:"availableActions"`
	}
	if err := json.Unmarshal(resp.Data, &data); err != nil {
		t.Fatalf("decode response data: %v", err)
	}

	if data.BusinessStage != model.BusinessFlowStageReadyToStart {
		t.Fatalf("expected business stage ready_to_start, got %s", data.BusinessStage)
	}
	if containsAction(data.AvailableActions, "start_project") {
		t.Fatalf("merchant detail should hide start_project action, got %+v", data.AvailableActions)
	}
}

func TestMerchantStartProject_BlockedForMerchant(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db := setupMerchantProjectExecutionTestDB(t,
		&model.Milestone{},
		&model.ProjectPhase{},
		&model.PhaseTask{},
		&model.BusinessFlow{},
	)
	ownerID := uint64(4201)
	providerUserID := uint64(4202)
	providerID := uint64(4203)
	seedMerchantProjectExecutionActors(t, db, ownerID, providerUserID, providerID)

	plannedStart := time.Date(2026, 4, 29, 0, 0, 0, 0, time.UTC)
	project := model.Project{
		Base:                   model.Base{ID: 4204},
		OwnerID:                ownerID,
		ProviderID:             providerID,
		ConstructionProviderID: providerID,
		Name:                   "待开工项目",
		Address:                "西安市测试路 99 号",
		Status:                 model.ProjectStatusActive,
		BusinessStatus:         model.ProjectBusinessStatusConstructionQuoteConfirmed,
		CurrentPhase:           "待监理协调开工",
		EntryStartDate:         &plannedStart,
		ConstructionQuote:      50000,
	}
	if err := db.Create(&project).Error; err != nil {
		t.Fatalf("seed project: %v", err)
	}
	if err := db.Create(&model.Milestone{
		Base:      model.Base{ID: 4205},
		ProjectID: project.ID,
		Name:      "开工交底",
		Seq:       1,
		Amount:    10000,
		Status:    model.MilestoneStatusPending,
	}).Error; err != nil {
		t.Fatalf("seed milestone: %v", err)
	}
	if err := db.Create(&model.ProjectPhase{
		Base:      model.Base{ID: 4206},
		ProjectID: project.ID,
		PhaseType: "preparation",
		Seq:       1,
		Status:    "pending",
	}).Error; err != nil {
		t.Fatalf("seed phase: %v", err)
	}

	resp := requestMerchantProjectExecutionJSON(
		t,
		http.MethodPost,
		"/api/v1/merchant/projects/4204/start",
		map[string]any{},
		project.ID,
		providerID,
		MerchantStartProject,
	)
	if resp.Code != http.StatusBadRequest {
		t.Fatalf("expected bad request code, got %d message=%s", resp.Code, resp.Message)
	}
	if resp.Message != "当前阶段开工由监理发起" {
		t.Fatalf("unexpected message: %s", resp.Message)
	}
}

func TestMerchantCreateProjectChangeOrder_BlockedForMerchant(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db := setupMerchantProjectExecutionTestDB(t, &model.ChangeOrder{})
	ownerID := uint64(4301)
	providerUserID := uint64(4302)
	providerID := uint64(4303)
	seedMerchantProjectExecutionActors(t, db, ownerID, providerUserID, providerID)

	project := model.Project{
		Base:                   model.Base{ID: 4304},
		OwnerID:                ownerID,
		ProviderID:             providerID,
		ConstructionProviderID: providerID,
		Name:                   "施工中项目",
		Address:                "西安市测试路 66 号",
		Status:                 model.ProjectStatusActive,
		BusinessStatus:         model.ProjectBusinessStatusInProgress,
		CurrentPhase:           "水电施工中",
	}
	if err := db.Create(&project).Error; err != nil {
		t.Fatalf("seed project: %v", err)
	}

	resp := requestMerchantProjectExecutionJSON(
		t,
		http.MethodPost,
		"/api/v1/merchant/projects/4304/change-orders",
		map[string]any{
			"title":       "新增柜体",
			"reason":      "现场收纳需求变化",
			"description": "补充玄关柜",
		},
		project.ID,
		providerID,
		MerchantCreateProjectChangeOrder,
	)
	if resp.Code != http.StatusBadRequest {
		t.Fatalf("expected bad request code, got %d message=%s", resp.Code, resp.Message)
	}
	if resp.Message != "当前阶段未开放商家端变更单操作" {
		t.Fatalf("unexpected message: %s", resp.Message)
	}
}

func TestMerchantCancelChangeOrder_BlockedForMerchant(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db := setupMerchantProjectExecutionTestDB(t, &model.ChangeOrder{})
	ownerID := uint64(4401)
	providerUserID := uint64(4402)
	providerID := uint64(4403)
	seedMerchantProjectExecutionActors(t, db, ownerID, providerUserID, providerID)

	project := model.Project{
		Base:                   model.Base{ID: 4404},
		OwnerID:                ownerID,
		ProviderID:             providerID,
		ConstructionProviderID: providerID,
		Name:                   "施工中项目",
		Address:                "西安市测试路 77 号",
		Status:                 model.ProjectStatusActive,
		BusinessStatus:         model.ProjectBusinessStatusInProgress,
		CurrentPhase:           "木作施工中",
	}
	if err := db.Create(&project).Error; err != nil {
		t.Fatalf("seed project: %v", err)
	}
	changeOrder := model.ChangeOrder{
		Base:          model.Base{ID: 4405},
		ProjectID:     project.ID,
		InitiatorType: "provider",
		InitiatorID:   providerID,
		Title:         "调整木作范围",
		Reason:        "现场结构变化",
		Status:        model.ChangeOrderStatusPendingUserConfirm,
	}
	if err := db.Create(&changeOrder).Error; err != nil {
		t.Fatalf("seed change order: %v", err)
	}

	resp := requestMerchantProjectExecutionJSON(
		t,
		http.MethodPost,
		"/api/v1/merchant/change-orders/4405/cancel",
		map[string]any{"reason": "商家主动取消"},
		project.ID,
		providerID,
		MerchantCancelChangeOrder,
		gin.Param{Key: "id", Value: "4405"},
	)
	if resp.Code != http.StatusBadRequest {
		t.Fatalf("expected bad request code, got %d message=%s", resp.Code, resp.Message)
	}
	if resp.Message != "当前阶段未开放商家端变更单操作" {
		t.Fatalf("unexpected message: %s", resp.Message)
	}
}
