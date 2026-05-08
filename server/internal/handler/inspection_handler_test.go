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
	"gorm.io/gorm"
)

type inspectionHandlerFixture struct {
	ownerID        uint64
	providerUserID uint64
	providerID     uint64
	project        model.Project
	milestone      model.Milestone
}

func setupInspectionHandlerDB(t *testing.T) *gorm.DB {
	t.Helper()

	db := setupRawSQLiteDB(t)
	migrateHandlerRuntimeTestSchema(t, db, &model.Milestone{}, &model.InspectionChecklist{})

	previousDB := repository.DB
	repository.DB = db
	t.Cleanup(func() {
		repository.DB = previousDB
	})

	return db
}

func seedInspectionHandlerFixture(t *testing.T, db *gorm.DB) inspectionHandlerFixture {
	t.Helper()

	fixture := inspectionHandlerFixture{
		ownerID:        1101,
		providerUserID: 2202,
		providerID:     3303,
	}

	if err := db.Create(&model.User{
		Base:     model.Base{ID: fixture.ownerID},
		Phone:    "13800001101",
		Nickname: "业主",
		Status:   1,
	}).Error; err != nil {
		t.Fatalf("seed owner user: %v", err)
	}
	if err := db.Create(&model.User{
		Base:     model.Base{ID: fixture.providerUserID},
		Phone:    "13800002202",
		Nickname: "商家用户",
		Status:   1,
	}).Error; err != nil {
		t.Fatalf("seed provider user: %v", err)
	}

	fixture.project = model.Project{
		Base:       model.Base{ID: 4404},
		OwnerID:    fixture.ownerID,
		ProviderID: fixture.providerID,
		Name:       "验收项目",
		Status:     model.ProjectStatusActive,
	}
	if err := db.Create(&fixture.project).Error; err != nil {
		t.Fatalf("seed project: %v", err)
	}

	fixture.milestone = model.Milestone{
		Base:      model.Base{ID: 5505},
		ProjectID: fixture.project.ID,
		Name:      "泥木节点",
		Seq:       1,
		Amount:    2000,
		Status:    model.MilestoneStatusInProgress,
	}
	if err := db.Create(&fixture.milestone).Error; err != nil {
		t.Fatalf("seed milestone: %v", err)
	}

	return fixture
}

func TestSubmitInspection_UsesProviderIDFromContext(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db := setupInspectionHandlerDB(t)
	fixture := seedInspectionHandlerFixture(t, db)

	router := gin.New()
	router.POST("/api/v1/milestones/:id/submit-inspection", func(c *gin.Context) {
		c.Set("userId", fixture.providerUserID)
		c.Set("providerId", fixture.providerID)
		SubmitInspection(c)
	})

	req := httptest.NewRequest(http.MethodPost, "/api/v1/milestones/5505/submit-inspection", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", rec.Code, rec.Body.String())
	}

	resp := decodeResponse(t, rec)
	if resp.Code != 0 {
		t.Fatalf("expected success code, got=%d message=%s", resp.Code, resp.Message)
	}

	var milestone model.Milestone
	if err := db.First(&milestone, fixture.milestone.ID).Error; err != nil {
		t.Fatalf("reload milestone: %v", err)
	}
	if milestone.Status != model.MilestoneStatusSubmitted {
		t.Fatalf("expected milestone submitted, got status=%d", milestone.Status)
	}

	var checklist model.InspectionChecklist
	if err := db.Where("milestone_id = ?", fixture.milestone.ID).First(&checklist).Error; err != nil {
		t.Fatalf("load checklist: %v", err)
	}
	if checklist.SubmittedBy != fixture.providerID {
		t.Fatalf("expected checklist submittedBy=%d, got=%d", fixture.providerID, checklist.SubmittedBy)
	}

	var notification model.Notification
	if err := db.Where("user_id = ? AND related_id = ? AND type = ?", fixture.ownerID, fixture.milestone.ID, "project.milestone.submitted").First(&notification).Error; err != nil {
		t.Fatalf("expected owner notification persisted: %v", err)
	}
}

func TestSubmitInspection_MapsForbiddenErrorSafely(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db := setupInspectionHandlerDB(t)
	fixture := seedInspectionHandlerFixture(t, db)

	router := gin.New()
	router.POST("/api/v1/milestones/:id/submit-inspection", func(c *gin.Context) {
		c.Set("userId", fixture.providerUserID)
		c.Set("providerId", uint64(9999))
		SubmitInspection(c)
	})

	req := httptest.NewRequest(http.MethodPost, "/api/v1/milestones/5505/submit-inspection", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d body=%s", rec.Code, rec.Body.String())
	}
	resp := decodeResponse(t, rec)
	if resp.Message != "无权操作此节点" {
		t.Fatalf("expected safe forbidden message, got %q", resp.Message)
	}
}

func TestResubmitInspection_MapsConflictErrorSafely(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db := setupInspectionHandlerDB(t)
	fixture := seedInspectionHandlerFixture(t, db)

	checklist := model.InspectionChecklist{
		Base:        model.Base{ID: 6607},
		MilestoneID: fixture.milestone.ID,
		ProjectID:   fixture.project.ID,
		Category:    "泥木节点",
		Status:      "pending",
		SubmittedBy: fixture.providerID,
	}
	if err := db.Create(&checklist).Error; err != nil {
		t.Fatalf("seed checklist: %v", err)
	}

	router := gin.New()
	router.POST("/api/v1/milestones/:id/resubmit-inspection", func(c *gin.Context) {
		c.Set("userId", fixture.providerUserID)
		c.Set("providerId", fixture.providerID)
		ResubmitInspection(c)
	})

	req := httptest.NewRequest(http.MethodPost, "/api/v1/milestones/5505/resubmit-inspection", bytes.NewReader([]byte(`{"notes":"已整改"}`)))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusConflict {
		t.Fatalf("expected 409, got %d body=%s", rec.Code, rec.Body.String())
	}
	resp := decodeResponse(t, rec)
	if resp.Message != "当前节点暂不能重新提交验收" {
		t.Fatalf("expected safe conflict message, got %q", resp.Message)
	}
}

func TestResubmitInspection_UsesProviderIDFromContext(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db := setupInspectionHandlerDB(t)
	fixture := seedInspectionHandlerFixture(t, db)

	checklist := model.InspectionChecklist{
		Base:          model.Base{ID: 6606},
		MilestoneID:   fixture.milestone.ID,
		ProjectID:     fixture.project.ID,
		Category:      "泥木节点",
		Status:        "failed",
		SubmittedBy:   fixture.providerID,
		ResubmitCount: 0,
	}
	if err := db.Create(&checklist).Error; err != nil {
		t.Fatalf("seed checklist: %v", err)
	}
	if err := db.Model(&fixture.milestone).Updates(map[string]any{
		"status":           model.MilestoneStatusRejected,
		"rejection_reason": "请整改后重提",
	}).Error; err != nil {
		t.Fatalf("mark milestone rejected: %v", err)
	}

	router := gin.New()
	router.POST("/api/v1/milestones/:id/resubmit-inspection", func(c *gin.Context) {
		c.Set("userId", fixture.providerUserID)
		c.Set("providerId", fixture.providerID)
		ResubmitInspection(c)
	})

	body, err := json.Marshal(map[string]string{"notes": "已按要求整改"})
	if err != nil {
		t.Fatalf("marshal request body: %v", err)
	}
	req := httptest.NewRequest(http.MethodPost, "/api/v1/milestones/5505/resubmit-inspection", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", rec.Code, rec.Body.String())
	}

	resp := decodeResponse(t, rec)
	if resp.Code != 0 {
		t.Fatalf("expected success code, got=%d message=%s", resp.Code, resp.Message)
	}

	var updatedChecklist model.InspectionChecklist
	if err := db.First(&updatedChecklist, checklist.ID).Error; err != nil {
		t.Fatalf("reload checklist: %v", err)
	}
	if updatedChecklist.Status != "resubmitted" {
		t.Fatalf("expected checklist status resubmitted, got=%s", updatedChecklist.Status)
	}
	if updatedChecklist.ResubmitCount != 1 {
		t.Fatalf("expected resubmit count 1, got=%d", updatedChecklist.ResubmitCount)
	}
	if updatedChecklist.RectificationNotes != "已按要求整改" {
		t.Fatalf("expected rectification notes persisted, got=%s", updatedChecklist.RectificationNotes)
	}

	var milestone model.Milestone
	if err := db.First(&milestone, fixture.milestone.ID).Error; err != nil {
		t.Fatalf("reload milestone: %v", err)
	}
	if milestone.Status != model.MilestoneStatusSubmitted {
		t.Fatalf("expected milestone submitted after resubmit, got status=%d", milestone.Status)
	}

	var audit model.AuditLog
	if err := db.Where("operation_type = ? AND resource_id = ?", "resubmit_inspection", fixture.milestone.ID).First(&audit).Error; err != nil {
		t.Fatalf("load audit log: %v", err)
	}
	if audit.OperatorID != fixture.providerID {
		t.Fatalf("expected audit operator=%d, got=%d", fixture.providerID, audit.OperatorID)
	}

	var notification model.Notification
	if err := db.Where("user_id = ? AND related_id = ? AND type = ?", fixture.ownerID, fixture.milestone.ID, "project.milestone.resubmitted").First(&notification).Error; err != nil {
		t.Fatalf("expected owner resubmitted notification persisted: %v", err)
	}
}
