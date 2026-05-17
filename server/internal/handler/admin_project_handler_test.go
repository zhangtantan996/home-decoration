package handler

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func setupAdminProjectHandlerDB(t *testing.T) *gorm.DB {
	t.Helper()
	t.Setenv("ENCRYPTION_KEY", base64.StdEncoding.EncodeToString([]byte("12345678901234567890123456789012")))

	db := setupSQLiteDB(t)
	migrateHandlerRuntimeTestSchema(t, db,
		&model.Milestone{},
		&model.WorkLog{},
		&model.ProjectPhase{},
		&model.PhaseTask{},
		&model.BusinessFlow{},
		&model.EscrowAccount{},
		&model.Transaction{},
		&model.MerchantIncome{},
		&model.PaymentPlan{},
		&model.SupervisorAccount{},
		&model.SupervisorProfile{},
		&model.ProjectSupervisorAssignment{},
	)

	oldDB := repository.DB
	repository.DB = db
	t.Cleanup(func() {
		repository.DB = oldDB
	})
	return db
}

func newAdminJSONContext(method, path string, body []byte, params gin.Params) (*gin.Context, *httptest.ResponseRecorder) {
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(method, path, bytes.NewReader(body))
	ctx.Request.Header.Set("Content-Type", "application/json")
	ctx.Params = params
	ctx.Set("adminId", uint64(9001))
	ctx.Set("admin_reason", "测试原因")
	return ctx, recorder
}

func decodeHandlerEnvelope[T any](t *testing.T, recorder *httptest.ResponseRecorder) T {
	t.Helper()
	var envelope struct {
		Code int `json:"code"`
		Data T   `json:"data"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &envelope); err != nil {
		t.Fatalf("decode response: %v body=%s", err, recorder.Body.String())
	}
	if envelope.Code != 0 {
		t.Fatalf("unexpected business code=%d body=%s", envelope.Code, recorder.Body.String())
	}
	return envelope.Data
}

func TestAdminCreateProjectPrefillsFromBookingAndWritesAudit(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupAdminProjectHandlerDB(t)

	owner := model.User{Base: model.Base{ID: 601}, Phone: "13800138601", Status: 1, Nickname: "预约业主"}
	provider := model.Provider{Base: model.Base{ID: 602}, ProviderType: 2, CompanyName: "预约装修公司"}
	booking := model.Booking{
		Base:           model.Base{ID: 603},
		UserID:         owner.ID,
		ProviderID:     provider.ID,
		ProviderType:   "company",
		Address:        "西安市雁塔区丈八东路 66 号",
		Area:           132,
		PreferredDate:  "2026-05-18",
		Phone:          "13800138601",
		HouseLayout:    "3室2厅",
		RenovationType: "旧房翻新",
		BudgetRange:    "20-30万",
	}
	for _, record := range []any{&owner, &provider, &booking} {
		if err := db.Create(record).Error; err != nil {
			t.Fatalf("seed record: %v", err)
		}
	}

	body := []byte(`{
		"bookingId": 603,
		"name": "预约转项目",
		"coverImage": "/uploads/projects/booking-cover.png",
		"budget": 268000,
		"materialMethod": "platform",
		"entryStartDate": "2026-05-20",
		"entryEndDate": "2026-05-30"
	}`)
	ctx, recorder := newAdminJSONContext(http.MethodPost, "/api/v1/admin/projects", body, nil)

	AdminCreateProject(ctx)

	data := decodeHandlerEnvelope[map[string]any](t, recorder)
	projectID, ok := data["id"].(float64)
	if !ok || projectID <= 0 {
		t.Fatalf("expected created project id, got %#v", data["id"])
	}

	var project model.Project
	if err := db.First(&project, uint64(projectID)).Error; err != nil {
		t.Fatalf("load created project: %v", err)
	}
	if project.OwnerID != owner.ID || project.ProviderID != provider.ID {
		t.Fatalf("expected booking owner/provider prefills, got owner=%d provider=%d", project.OwnerID, project.ProviderID)
	}
	if project.Area != booking.Area {
		t.Fatalf("expected booking area carried over, got %.2f", project.Area)
	}
	if project.EntryStartDate == nil || project.EntryStartDate.Format("2006-01-02") != "2026-05-20" {
		t.Fatalf("expected entryStartDate stored, got %#v", project.EntryStartDate)
	}
	if project.EntryEndDate == nil || project.EntryEndDate.Format("2006-01-02") != "2026-05-30" {
		t.Fatalf("expected entryEndDate stored, got %#v", project.EntryEndDate)
	}
	if project.CoverImage != "/uploads/projects/booking-cover.png" {
		t.Fatalf("expected coverImage persisted, got %q", project.CoverImage)
	}

	var audit model.AuditLog
	if err := db.Where("operation_type = ? AND resource_type = ? AND resource_id = ?", "project_create", "project", uint64(projectID)).
		Order("id DESC").
		First(&audit).Error; err != nil {
		t.Fatalf("expected project create audit: %v", err)
	}
	if audit.Reason == "" {
		t.Fatalf("expected audit reason to be recorded")
	}
	if audit.Metadata == "" || audit.Metadata == "{}" {
		t.Fatalf("expected audit metadata with creation source, got %q", audit.Metadata)
	}
}

func TestAdminListProjectsReturnsCurrentSupervisorAndCreationSource(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupAdminProjectHandlerDB(t)

	owner := model.User{Base: model.Base{ID: 701}, Phone: "13800138701", Status: 1, Nickname: "项目业主"}
	providerUser := model.User{Base: model.Base{ID: 702}, Phone: "13800138702", Status: 1, Nickname: "装修公司联系人"}
	provider := model.Provider{Base: model.Base{ID: 703}, UserID: providerUser.ID, ProviderType: 2, CompanyName: "测试装修公司"}
	account := model.SupervisorAccount{Base: model.Base{ID: 704}, Phone: "13800138704", Status: 1}
	profile := model.SupervisorProfile{
		Base:                model.Base{ID: 705},
		UserID:              1705,
		SupervisorAccountID: &account.ID,
		Phone:               account.Phone,
		RealName:            "张监理",
		Status:              1,
		Verified:            true,
	}
	project := model.Project{
		Base:           model.Base{ID: 706, CreatedAt: time.Now(), UpdatedAt: time.Now()},
		OwnerID:        owner.ID,
		ProviderID:     provider.ID,
		Name:           "监理分配项目",
		Address:        "西安市高新区丈八五路 88 号",
		Status:         model.ProjectStatusActive,
		CurrentPhase:   "待监理协调开工",
		BusinessStatus: model.ProjectBusinessStatusConstructionQuoteConfirmed,
	}
	assignment := model.ProjectSupervisorAssignment{
		Base:         model.Base{ID: 707},
		ProjectID:    project.ID,
		SupervisorID: profile.ID,
		AssignedBy:   9001,
		Status:       1,
		AssignedAt:   time.Date(2026, 5, 10, 9, 0, 0, 0, time.UTC),
	}
	metadata, _ := json.Marshal(map[string]any{
		"source":    "booking_prefill",
		"bookingId": 603,
	})
	audit := model.AuditLog{
		Base:          model.Base{ID: 708},
		RecordKind:    "business",
		OperatorType:  "admin",
		OperatorID:    9001,
		OperationType: "project_create",
		ResourceType:  "project",
		ResourceID:    project.ID,
		Reason:        "预约转项目",
		Result:        "success",
		Metadata:      string(metadata),
	}

	for _, record := range []any{&owner, &providerUser, &provider, &account, &profile, &project, &assignment, &audit} {
		if err := db.Create(record).Error; err != nil {
			t.Fatalf("seed record: %v", err)
		}
	}

	ctx, recorder := newAdminJSONContext(http.MethodGet, "/api/v1/admin/projects?page=1&pageSize=10", nil, nil)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/v1/admin/projects?page=1&pageSize=10", nil)

	AdminListProjects(ctx)

	data := decodeHandlerEnvelope[map[string]any](t, recorder)
	list, ok := data["list"].([]any)
	if !ok || len(list) != 1 {
		t.Fatalf("expected paged list payload, got %#v", data["list"])
	}
	row, ok := list[0].(map[string]any)
	if !ok {
		t.Fatalf("expected row map, got %#v", list[0])
	}
	currentSupervisor, ok := row["currentSupervisor"].(map[string]any)
	if !ok {
		t.Fatalf("expected currentSupervisor summary, got %#v", row["currentSupervisor"])
	}
	if currentSupervisor["name"] != "张监理" {
		t.Fatalf("expected current supervisor name, got %#v", currentSupervisor["name"])
	}
	if row["creationSource"] != "booking_prefill" {
		t.Fatalf("expected creationSource from audit metadata, got %#v", row["creationSource"])
	}
}
