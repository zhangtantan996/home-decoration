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
	"home-decoration-server/pkg/utils"

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
		&model.QuoteInquiry{},
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

func TestAdminUpdateBookingStatusRequiresInvalidReason(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupAdminProjectHandlerDB(t)

	booking := model.Booking{
		Base:          model.Base{ID: 610},
		UserID:        601,
		ProviderID:    602,
		ProviderType:  "company",
		Address:       "西安市雁塔区科技路 99 号",
		Area:          120,
		PreferredDate: "2026-05-18",
		Phone:         "13800138610",
		Status:        1,
		FollowStatus:  model.LeadFollowStatusPendingContact,
		LeadQuality:   model.LeadQualityUnknown,
	}
	if err := db.Create(&booking).Error; err != nil {
		t.Fatalf("create booking: %v", err)
	}

	body := []byte(`{"followStatus":"invalid"}`)
	ctx, recorder := newAdminJSONContext(http.MethodPatch, "/api/v1/admin/bookings/610/status", body, gin.Params{{Key: "id", Value: "610"}})

	AdminUpdateBookingStatus(ctx)

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("unexpected http status: %d body=%s", recorder.Code, recorder.Body.String())
	}
	var envelope struct {
		Code int    `json:"code"`
		Msg  string `json:"msg"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &envelope); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if envelope.Code == 0 {
		t.Fatalf("expected invalid lead without reason to be rejected")
	}
}

func TestAdminUpdateBookingStatusEncryptsFollowUpNotes(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupAdminProjectHandlerDB(t)

	booking := model.Booking{
		Base:          model.Base{ID: 611},
		UserID:        601,
		ProviderID:    602,
		ProviderType:  "company",
		Address:       "西安市雁塔区科技路 99 号",
		Area:          120,
		PreferredDate: "2026-05-18",
		Phone:         "13800138611",
		Status:        1,
		FollowStatus:  model.LeadFollowStatusPendingContact,
		LeadQuality:   model.LeadQualityUnknown,
	}
	if err := db.Create(&booking).Error; err != nil {
		t.Fatalf("create booking: %v", err)
	}

	body := []byte(`{"notes":"业主晚上八点后方便接电话"}`)
	ctx, recorder := newAdminJSONContext(http.MethodPatch, "/api/v1/admin/bookings/611/status", body, gin.Params{{Key: "id", Value: "611"}})

	AdminUpdateBookingStatus(ctx)
	decodeHandlerEnvelope[any](t, recorder)

	var raw struct {
		Notes          string
		NotesEncrypted string
	}
	if err := db.Table("bookings").
		Select("notes, notes_encrypted").
		Where("id = ?", booking.ID).
		Scan(&raw).Error; err != nil {
		t.Fatalf("scan booking notes: %v", err)
	}
	if raw.NotesEncrypted == "" || raw.Notes == "业主晚上八点后方便接电话" {
		t.Fatalf("expected follow-up notes encrypted at rest, got %+v", raw)
	}
}

func TestAdminGetBookingRestoresEncryptedFollowUpNotes(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupAdminProjectHandlerDB(t)

	encryptedNotes, err := utils.Encrypt("业主晚上八点后方便接电话")
	if err != nil {
		t.Fatalf("encrypt notes: %v", err)
	}
	booking := model.Booking{
		Base:           model.Base{ID: 612},
		UserID:         601,
		ProviderID:     602,
		ProviderType:   "company",
		Address:        "西安市雁塔区科技路 99 号",
		Area:           120,
		PreferredDate:  "2026-05-18",
		Phone:          "13800138612",
		Notes:          "[encrypted]",
		NotesEncrypted: encryptedNotes,
		Status:         1,
		FollowStatus:   model.LeadFollowStatusPendingContact,
		LeadQuality:    model.LeadQualityUnknown,
	}
	if err := db.Create(&booking).Error; err != nil {
		t.Fatalf("create booking: %v", err)
	}

	ctx, recorder := newAdminJSONContext(http.MethodGet, "/api/v1/admin/bookings/612", nil, gin.Params{{Key: "id", Value: "612"}})

	AdminGetBooking(ctx)

	data := decodeHandlerEnvelope[map[string]any](t, recorder)
	if data["notes"] != "业主晚上八点后方便接电话" {
		t.Fatalf("expected decrypted notes in detail, got %#v", data["notes"])
	}
}

func TestAdminConvertBookingToProjectBackfillsBookingLeadStatus(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupAdminProjectHandlerDB(t)

	owner := model.User{Base: model.Base{ID: 621}, Phone: "13800138621", Status: 1, Nickname: "预约业主"}
	provider := model.Provider{Base: model.Base{ID: 622}, ProviderType: 2, CompanyName: "预约装修公司"}
	booking := model.Booking{
		Base:          model.Base{ID: 623},
		UserID:        owner.ID,
		ProviderID:    provider.ID,
		ProviderType:  "company",
		Address:       "西安市雁塔区丈八东路 88 号",
		Area:          108,
		PreferredDate: "2026-05-18",
		Phone:         "13800138623",
		Status:        1,
		FollowStatus:  model.LeadFollowStatusInterested,
		LeadQuality:   model.LeadQualityHighIntent,
	}
	for _, record := range []any{&owner, &provider, &booking} {
		if err := db.Create(record).Error; err != nil {
			t.Fatalf("seed record: %v", err)
		}
	}

	body := []byte(`{
		"name": "预约转项目",
		"coverImage": "/uploads/projects/booking-convert-cover.png",
		"budget": 188000,
		"materialMethod": "platform",
		"entryStartDate": "2026-05-20",
		"entryEndDate": "2026-05-30"
	}`)
	ctx, recorder := newAdminJSONContext(http.MethodPost, "/api/v1/admin/bookings/623/convert-project", body, gin.Params{{Key: "id", Value: "623"}})

	AdminConvertBookingToProject(ctx)

	data := decodeHandlerEnvelope[map[string]any](t, recorder)
	projectID, ok := data["id"].(float64)
	if !ok || projectID <= 0 {
		t.Fatalf("expected created project id, got %#v", data["id"])
	}
	var updated model.Booking
	if err := db.First(&updated, booking.ID).Error; err != nil {
		t.Fatalf("load updated booking: %v", err)
	}
	if updated.ConvertedProjectID != uint64(projectID) || updated.FollowStatus != model.LeadFollowStatusConvertedProject {
		t.Fatalf("expected booking converted to project, got convertedProjectId=%d followStatus=%q", updated.ConvertedProjectID, updated.FollowStatus)
	}
	var audit model.AuditLog
	if err := db.Where("operation_type = ? AND resource_id = ?", "booking_convert_project", booking.ID).First(&audit).Error; err != nil {
		t.Fatalf("expected booking convert audit: %v", err)
	}
}

func TestAdminConvertBookingToProjectRestoresEncryptedBookingAddress(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupAdminProjectHandlerDB(t)

	owner := model.User{Base: model.Base{ID: 631}, Phone: "13800138631", Status: 1, Nickname: "加密预约业主"}
	provider := model.Provider{Base: model.Base{ID: 632}, ProviderType: 2, CompanyName: "加密预约装修公司"}
	encryptedAddress, err := utils.Encrypt("西安市雁塔区真实地址 100 号")
	if err != nil {
		t.Fatalf("encrypt address: %v", err)
	}
	booking := model.Booking{
		Base:             model.Base{ID: 633},
		UserID:           owner.ID,
		ProviderID:       provider.ID,
		ProviderType:     "company",
		Address:          "西安市***号",
		AddressEncrypted: encryptedAddress,
		Area:             108,
		PreferredDate:    "2026-05-18",
		Phone:            "13800138633",
		Status:           1,
		FollowStatus:     model.LeadFollowStatusInterested,
		LeadQuality:      model.LeadQualityHighIntent,
	}
	for _, record := range []any{&owner, &provider, &booking} {
		if err := db.Create(record).Error; err != nil {
			t.Fatalf("seed record: %v", err)
		}
	}

	body := []byte(`{
		"name": "加密预约转项目",
		"coverImage": "/uploads/projects/booking-encrypted-cover.png",
		"budget": 188000,
		"materialMethod": "platform",
		"entryStartDate": "2026-05-20",
		"entryEndDate": "2026-05-30"
	}`)
	ctx, recorder := newAdminJSONContext(http.MethodPost, "/api/v1/admin/bookings/633/convert-project", body, gin.Params{{Key: "id", Value: "633"}})

	AdminConvertBookingToProject(ctx)

	data := decodeHandlerEnvelope[map[string]any](t, recorder)
	if data["address"] != "西安市雁塔区真实地址 100 号" {
		t.Fatalf("expected converted project to use decrypted booking address, got %#v", data["address"])
	}
}

func TestAdminConvertQuoteInquiryToBookingRejectsMissingOwnerWithoutOrphanBooking(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupAdminProjectHandlerDB(t)

	inquiry := model.QuoteInquiry{
		Base:           model.Base{ID: 701},
		Phone:          "13800138701",
		Address:        "西安市雁塔区科技路 101 号",
		Area:           98,
		HouseLayout:    "三室两厅",
		RenovationType: "新房装修",
		BudgetRange:    "15-20万",
		FollowStatus:   model.LeadFollowStatusPendingBooking,
	}
	provider := model.Provider{Base: model.Base{ID: 702}, ProviderType: 2, CompanyName: "报价转化装修公司"}
	for _, record := range []any{&inquiry, &provider} {
		if err := db.Create(record).Error; err != nil {
			t.Fatalf("seed record: %v", err)
		}
	}

	body := []byte(`{
		"ownerId": 799,
		"providerId": 702,
		"providerType": "company",
		"preferredDate": "2026-05-20"
	}`)
	ctx, recorder := newAdminJSONContext(http.MethodPost, "/api/v1/admin/quote-inquiries/701/convert-booking", body, gin.Params{{Key: "id", Value: "701"}})

	AdminConvertQuoteInquiryToBooking(ctx)

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("unexpected http status: %d body=%s", recorder.Code, recorder.Body.String())
	}
	var bookingCount int64
	if err := db.Model(&model.Booking{}).Where("source_type = ? AND source_id = ?", "quote_inquiry", inquiry.ID).Count(&bookingCount).Error; err != nil {
		t.Fatalf("count bookings: %v", err)
	}
	if bookingCount != 0 {
		t.Fatalf("expected no orphan booking, got %d", bookingCount)
	}
}

func TestAdminConvertQuoteInquiryToBookingIsAtomicAndBackfillsSource(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupAdminProjectHandlerDB(t)

	owner := model.User{Base: model.Base{ID: 711}, Phone: "13800138711", Status: 1, Nickname: "报价业主"}
	provider := model.Provider{Base: model.Base{ID: 712}, ProviderType: 2, CompanyName: "报价转化装修公司"}
	inquiry := model.QuoteInquiry{
		Base:           model.Base{ID: 713},
		UserID:         &owner.ID,
		Phone:          "13800138713",
		Address:        "西安市雁塔区科技路 102 号",
		Area:           118,
		HouseLayout:    "三室两厅",
		RenovationType: "旧房翻新",
		BudgetRange:    "20-30万",
		FollowStatus:   model.LeadFollowStatusPendingBooking,
	}
	for _, record := range []any{&owner, &provider, &inquiry} {
		if err := db.Create(record).Error; err != nil {
			t.Fatalf("seed record: %v", err)
		}
	}

	body := []byte(`{
		"providerId": 712,
		"providerType": "company",
		"preferredDate": "2026-05-20",
		"notes": "报价线索已电话确认"
	}`)
	ctx, recorder := newAdminJSONContext(http.MethodPost, "/api/v1/admin/quote-inquiries/713/convert-booking", body, gin.Params{{Key: "id", Value: "713"}})

	AdminConvertQuoteInquiryToBooking(ctx)

	data := decodeHandlerEnvelope[map[string]any](t, recorder)
	bookingID, ok := data["id"].(float64)
	if !ok || bookingID <= 0 {
		t.Fatalf("expected created booking id, got %#v", data["id"])
	}

	var booking model.Booking
	if err := db.First(&booking, uint64(bookingID)).Error; err != nil {
		t.Fatalf("load booking: %v", err)
	}
	if booking.SourceType != "quote_inquiry" || booking.SourceID != inquiry.ID || booking.UserID != owner.ID {
		t.Fatalf("expected booking source backfilled, got sourceType=%q sourceId=%d owner=%d", booking.SourceType, booking.SourceID, booking.UserID)
	}
	var updated model.QuoteInquiry
	if err := db.First(&updated, inquiry.ID).Error; err != nil {
		t.Fatalf("load inquiry: %v", err)
	}
	if updated.ConvertedToBookingID == nil || *updated.ConvertedToBookingID != booking.ID || updated.FollowStatus != model.LeadFollowStatusConvertedBooking {
		t.Fatalf("expected quote inquiry converted, got converted=%v followStatus=%q", updated.ConvertedToBookingID, updated.FollowStatus)
	}
}

func TestAdminConvertQuoteInquiryToBookingRestoresEncryptedContactFields(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupAdminProjectHandlerDB(t)

	owner := model.User{Base: model.Base{ID: 721}, Phone: "13800138721", Status: 1, Nickname: "加密报价业主"}
	provider := model.Provider{Base: model.Base{ID: 722}, ProviderType: 2, CompanyName: "加密报价装修公司"}
	encryptedPhone, err := utils.Encrypt("13800138723")
	if err != nil {
		t.Fatalf("encrypt phone: %v", err)
	}
	encryptedAddress, err := utils.Encrypt("西安市雁塔区报价真实地址 102 号")
	if err != nil {
		t.Fatalf("encrypt address: %v", err)
	}
	inquiry := model.QuoteInquiry{
		Base:             model.Base{ID: 723},
		UserID:           &owner.ID,
		Phone:            "138****8723",
		PhoneEncrypted:   encryptedPhone,
		Address:          "西安市***号",
		AddressEncrypted: encryptedAddress,
		Area:             118,
		HouseLayout:      "三室两厅",
		RenovationType:   "旧房翻新",
		BudgetRange:      "20-30万",
		FollowStatus:     model.LeadFollowStatusPendingBooking,
	}
	for _, record := range []any{&owner, &provider, &inquiry} {
		if err := db.Create(record).Error; err != nil {
			t.Fatalf("seed record: %v", err)
		}
	}

	body := []byte(`{
		"providerId": 722,
		"providerType": "company",
		"preferredDate": "2026-05-20"
	}`)
	ctx, recorder := newAdminJSONContext(http.MethodPost, "/api/v1/admin/quote-inquiries/723/convert-booking", body, gin.Params{{Key: "id", Value: "723"}})

	AdminConvertQuoteInquiryToBooking(ctx)

	data := decodeHandlerEnvelope[map[string]any](t, recorder)
	if data["phone"] != "13800138723" || data["address"] != "西安市雁塔区报价真实地址 102 号" {
		t.Fatalf("expected converted booking to use decrypted contact fields, got phone=%#v address=%#v", data["phone"], data["address"])
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
