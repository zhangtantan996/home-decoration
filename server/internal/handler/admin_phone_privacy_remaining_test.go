package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	"home-decoration-server/internal/service"

	"github.com/gin-gonic/gin"
	gormsqlite "gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupAdminPhonePrivacyRemainingDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(gormsqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite db: %v", err)
	}
	if err := db.AutoMigrate(
		&model.User{},
		&model.Provider{},
		&model.MaterialShop{},
		&model.MaterialShopApplication{},
		&model.MaterialShopProduct{},
		&model.Booking{},
		&model.Project{},
		&model.ProjectAudit{},
		&model.ProjectSupervisorAssignment{},
		&model.Proposal{},
		&model.QuoteInquiry{},
		&model.SupervisorAccount{},
		&model.SupervisorApplication{},
		&model.SupervisorPhoneWhitelist{},
		&model.SupervisorProfile{},
	); err != nil {
		t.Fatalf("auto migrate admin phone privacy models: %v", err)
	}
	oldDB := repository.DB
	repository.DB = db
	oldQuoteInquiryService := quoteInquiryService
	quoteInquiryService = &service.QuoteInquiryService{}
	t.Cleanup(func() {
		repository.DB = oldDB
		quoteInquiryService = oldQuoteInquiryService
	})
	return db
}

func decodeBusinessEnvelope(t *testing.T, recorder *httptest.ResponseRecorder) map[string]any {
	t.Helper()
	var envelope struct {
		Code int            `json:"code"`
		Data map[string]any `json:"data"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &envelope); err != nil {
		t.Fatalf("decode response: %v body=%s", err, recorder.Body.String())
	}
	if envelope.Code != 0 {
		t.Fatalf("unexpected business code %d body=%s", envelope.Code, recorder.Body.String())
	}
	return envelope.Data
}

func requestWithAdminFlags(method, path string, params gin.Params, isSuper bool) (*gin.Context, *httptest.ResponseRecorder) {
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(method, path, nil)
	ctx.Params = params
	if isSuper {
		ctx.Set("is_super", true)
	}
	return ctx, recorder
}

func TestAdminGetQuoteInquiryMasksPhoneWithoutPrivilege(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupAdminPhonePrivacyRemainingDB(t)

	inquiry := model.QuoteInquiry{
		Base:             model.Base{ID: 11},
		Phone:            "13800138000",
		Address:          "杭州市西湖区测试路 1 号",
		CityCode:         "330100",
		Area:             89,
		RenovationType:   "新房装修",
		Style:            "现代简约",
		ConversionStatus: "pending",
	}
	if err := db.Create(&inquiry).Error; err != nil {
		t.Fatalf("create inquiry: %v", err)
	}

	ctx, recorder := requestWithAdminFlags(http.MethodGet, "/api/v1/admin/quote-inquiries/11", gin.Params{{Key: "id", Value: "11"}}, false)
	AdminGetQuoteInquiry(ctx)
	data := decodeBusinessEnvelope(t, recorder)
	if got := data["phone"]; got != "138****8000" {
		t.Fatalf("expected masked inquiry phone, got %#v", got)
	}

	fullCtx, fullRecorder := requestWithAdminFlags(http.MethodGet, "/api/v1/admin/quote-inquiries/11", gin.Params{{Key: "id", Value: "11"}}, true)
	AdminGetQuoteInquiry(fullCtx)
	fullData := decodeBusinessEnvelope(t, fullRecorder)
	if got := fullData["phone"]; got != inquiry.Phone {
		t.Fatalf("expected full inquiry phone, got %#v", got)
	}
}

func TestAdminBookingPhoneVisibilityRespectsPrivilege(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupAdminPhonePrivacyRemainingDB(t)

	booking := model.Booking{
		Base:           model.Base{ID: 21},
		UserID:         301,
		ProviderID:     401,
		ProviderType:   "company",
		Address:        "南京市建邺区测试路 9 号",
		Area:           120,
		RenovationType: "旧房翻新",
		BudgetRange:    "20-30万",
		PreferredDate:  "周末",
		Phone:          "13900139000",
		Status:         1,
	}
	if err := db.Create(&booking).Error; err != nil {
		t.Fatalf("create booking: %v", err)
	}

	listCtx, listRecorder := requestWithAdminFlags(http.MethodGet, "/api/v1/admin/bookings", nil, false)
	AdminListBookings(listCtx)
	listData := decodeBusinessEnvelope(t, listRecorder)
	items, _ := listData["list"].([]any)
	first, _ := items[0].(map[string]any)
	if got := first["phone"]; got != "139****9000" {
		t.Fatalf("expected masked booking phone in list, got %#v", got)
	}

	detailCtx, detailRecorder := requestWithAdminFlags(http.MethodGet, "/api/v1/admin/bookings/21", gin.Params{{Key: "id", Value: "21"}}, false)
	AdminGetBooking(detailCtx)
	detailData := decodeBusinessEnvelope(t, detailRecorder)
	if got := detailData["phone"]; got != "139****9000" {
		t.Fatalf("expected masked booking phone in detail, got %#v", got)
	}

	fullCtx, fullRecorder := requestWithAdminFlags(http.MethodGet, "/api/v1/admin/bookings/21", gin.Params{{Key: "id", Value: "21"}}, true)
	AdminGetBooking(fullCtx)
	fullData := decodeBusinessEnvelope(t, fullRecorder)
	if got := fullData["phone"]; got != booking.Phone {
		t.Fatalf("expected full booking phone, got %#v", got)
	}
}

func TestAdminDisputedBookingPhoneVisibilityRespectsPrivilege(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupAdminPhonePrivacyRemainingDB(t)

	user := model.User{Base: model.Base{ID: 501}, Nickname: "客户甲", Phone: "13700137000", Status: 1}
	provider := model.Provider{Base: model.Base{ID: 601}, CompanyName: "测试装修公司"}
	booking := model.Booking{
		Base:         model.Base{ID: 31},
		UserID:       user.ID,
		ProviderID:   provider.ID,
		ProviderType: "company",
		Address:      "上海市浦东新区测试路 6 号",
		Phone:        "13700137000",
		Status:       5,
	}
	proposal := model.Proposal{Base: model.Base{ID: 701}, BookingID: booking.ID, Version: 2, RejectionCount: 2, RejectionReason: "多次改价"}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}
	if err := db.Create(&provider).Error; err != nil {
		t.Fatalf("create provider: %v", err)
	}
	if err := db.Create(&booking).Error; err != nil {
		t.Fatalf("create disputed booking: %v", err)
	}
	if err := db.Create(&proposal).Error; err != nil {
		t.Fatalf("create proposal: %v", err)
	}

	listCtx, listRecorder := requestWithAdminFlags(http.MethodGet, "/api/v1/admin/disputed-bookings", nil, false)
	AdminListDisputedBookings(listCtx)
	var listEnvelope struct {
		Code int `json:"code"`
		Data []struct {
			UserPhone string `json:"userPhone"`
		} `json:"data"`
	}
	if err := json.Unmarshal(listRecorder.Body.Bytes(), &listEnvelope); err != nil {
		t.Fatalf("decode disputed list: %v body=%s", err, listRecorder.Body.String())
	}
	if listEnvelope.Code != 0 || len(listEnvelope.Data) != 1 {
		t.Fatalf("unexpected disputed list payload: %+v", listEnvelope)
	}
	if got := listEnvelope.Data[0].UserPhone; got != "137****7000" {
		t.Fatalf("expected masked disputed list phone, got %q", got)
	}

	detailCtx, detailRecorder := requestWithAdminFlags(http.MethodGet, "/api/v1/admin/disputed-bookings/31", gin.Params{{Key: "id", Value: "31"}}, false)
	AdminGetDisputedBooking(detailCtx)
	detailData := decodeBusinessEnvelope(t, detailRecorder)
	userMap, _ := detailData["user"].(map[string]any)
	if got := userMap["phone"]; got != "137****7000" {
		t.Fatalf("expected masked disputed detail phone, got %#v", got)
	}

	fullCtx, fullRecorder := requestWithAdminFlags(http.MethodGet, "/api/v1/admin/disputed-bookings/31", gin.Params{{Key: "id", Value: "31"}}, true)
	AdminGetDisputedBooking(fullCtx)
	fullData := decodeBusinessEnvelope(t, fullRecorder)
	fullUserMap, _ := fullData["user"].(map[string]any)
	if got := fullUserMap["phone"]; got != user.Phone {
		t.Fatalf("expected full disputed detail phone, got %#v", got)
	}
}

func TestAdminMaterialShopPhoneVisibilityRespectsPrivilege(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupAdminPhonePrivacyRemainingDB(t)

	user := model.User{Base: model.Base{ID: 801}, Nickname: "门店账号", Phone: "13600136000", Status: 1}
	shopStatus := int8(1)
	shop := model.MaterialShop{
		Base:         model.Base{ID: 41},
		UserID:       user.ID,
		Name:         "测试主材店",
		CompanyName:  "测试主材公司",
		ContactPhone: "13600999000",
		IsSettled:    true,
		Status:       &shopStatus,
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}
	if err := db.Create(&shop).Error; err != nil {
		t.Fatalf("create material shop: %v", err)
	}

	listCtx, listRecorder := requestWithAdminFlags(http.MethodGet, "/api/v1/admin/material-shops", nil, false)
	AdminListMaterialShops(listCtx)
	listData := decodeBusinessEnvelope(t, listRecorder)
	items, _ := listData["list"].([]any)
	first, _ := items[0].(map[string]any)
	if got := first["userPhone"]; got != "136****6000" {
		t.Fatalf("expected masked material shop phone in list, got %#v", got)
	}

	detailCtx, detailRecorder := requestWithAdminFlags(http.MethodGet, "/api/v1/admin/material-shops/41", gin.Params{{Key: "id", Value: "41"}}, false)
	AdminGetMaterialShop(detailCtx)
	detailData := decodeBusinessEnvelope(t, detailRecorder)
	if got := detailData["userPhone"]; got != "136****6000" {
		t.Fatalf("expected masked material detail phone, got %#v", got)
	}
	if got := detailData["contactPhone"]; got != "136****9000" {
		t.Fatalf("expected masked material contact phone, got %#v", got)
	}

	fullCtx, fullRecorder := requestWithAdminFlags(http.MethodGet, "/api/v1/admin/material-shops/41", gin.Params{{Key: "id", Value: "41"}}, true)
	AdminGetMaterialShop(fullCtx)
	fullData := decodeBusinessEnvelope(t, fullRecorder)
	if got := fullData["userPhone"]; got != user.Phone {
		t.Fatalf("expected full material detail phone, got %#v", got)
	}
	if got := fullData["contactPhone"]; got != shop.ContactPhone {
		t.Fatalf("expected full material contact phone, got %#v", got)
	}
}

func TestAdminProjectAuditPhoneVisibilityRespectsPrivilege(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupAdminPhonePrivacyRemainingDB(t)

	user := model.User{Base: model.Base{ID: 901}, Nickname: "项目业主", Phone: "13500135000", Status: 1}
	provider := model.Provider{Base: model.Base{ID: 902}, CompanyName: "测试服务商"}
	project := model.Project{Base: model.Base{ID: 903}, OwnerID: user.ID, ProviderID: provider.ID, Name: "测试项目"}
	audit := model.ProjectAudit{
		Base:      model.Base{ID: 904},
		ProjectID: project.ID,
		AuditType: model.ProjectAuditTypeClose,
		Status:    model.ProjectAuditStatusPending,
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("create project owner: %v", err)
	}
	if err := db.Create(&provider).Error; err != nil {
		t.Fatalf("create project provider: %v", err)
	}
	if err := db.Create(&project).Error; err != nil {
		t.Fatalf("create project: %v", err)
	}
	if err := db.Create(&audit).Error; err != nil {
		t.Fatalf("create audit: %v", err)
	}

	listCtx, listRecorder := requestWithAdminFlags(http.MethodGet, "/api/v1/admin/project-audits", nil, false)
	AdminListProjectAudits(listCtx)
	listData := decodeBusinessEnvelope(t, listRecorder)
	listItems, _ := listData["list"].([]any)
	first, _ := listItems[0].(map[string]any)
	firstUser, _ := first["user"].(map[string]any)
	if got := firstUser["phone"]; got != "135****5000" {
		t.Fatalf("expected masked project audit list phone, got %#v", got)
	}

	detailCtx, detailRecorder := requestWithAdminFlags(http.MethodGet, "/api/v1/admin/project-audits/904", gin.Params{{Key: "id", Value: "904"}}, false)
	AdminGetProjectAudit(detailCtx)
	detailData := decodeBusinessEnvelope(t, detailRecorder)
	auditData, _ := detailData["audit"].(map[string]any)
	detailUser, _ := auditData["user"].(map[string]any)
	if got := detailUser["phone"]; got != "135****5000" {
		t.Fatalf("expected masked project audit detail phone, got %#v", got)
	}

	fullCtx, fullRecorder := requestWithAdminFlags(http.MethodGet, "/api/v1/admin/project-audits/904", gin.Params{{Key: "id", Value: "904"}}, true)
	AdminGetProjectAudit(fullCtx)
	fullData := decodeBusinessEnvelope(t, fullRecorder)
	fullAudit, _ := fullData["audit"].(map[string]any)
	fullUser, _ := fullAudit["user"].(map[string]any)
	if got := fullUser["phone"]; got != user.Phone {
		t.Fatalf("expected full project audit detail phone, got %#v", got)
	}
}

func TestAdminSupervisorPhoneVisibilityRespectsPrivilege(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupAdminPhonePrivacyRemainingDB(t)

	account := model.SupervisorAccount{Base: model.Base{ID: 1001}, Phone: "13400134000", Status: 1}
	if err := db.Create(&account).Error; err != nil {
		t.Fatalf("create supervisor account: %v", err)
	}
	profile := model.SupervisorProfile{
		Base:                model.Base{ID: 1002},
		UserID:              1003,
		SupervisorAccountID: &account.ID,
		RealName:            "监理甲",
		Phone:               account.Phone,
		Status:              1,
		Verified:            true,
	}
	if err := db.Create(&profile).Error; err != nil {
		t.Fatalf("create supervisor profile: %v", err)
	}
	project := model.Project{Base: model.Base{ID: 1004}, Name: "监理测试项目"}
	if err := db.Create(&project).Error; err != nil {
		t.Fatalf("create supervisor project: %v", err)
	}
	assignment := model.ProjectSupervisorAssignment{
		Base:         model.Base{ID: 1005},
		ProjectID:    project.ID,
		SupervisorID: profile.ID,
		AssignedBy:   9,
		Status:       1,
	}
	if err := db.Create(&assignment).Error; err != nil {
		t.Fatalf("create supervisor assignment: %v", err)
	}

	listCtx, listRecorder := requestWithAdminFlags(http.MethodGet, "/api/v1/admin/supervisors", nil, true)
	AdminListSupervisors(listCtx)
	listData := decodeBusinessEnvelope(t, listRecorder)
	listItems, _ := listData["list"].([]any)
	first, _ := listItems[0].(map[string]any)
	if got := first["phone"]; got != "134****4000" {
		t.Fatalf("expected masked supervisor list phone, got %#v", got)
	}

	detailCtx, detailRecorder := requestWithAdminFlags(http.MethodGet, "/api/v1/admin/supervisors/1002", gin.Params{{Key: "id", Value: "1002"}}, false)
	AdminGetSupervisor(detailCtx)
	detailData := decodeBusinessEnvelope(t, detailRecorder)
	if got := detailData["phone"]; got != "134****4000" {
		t.Fatalf("expected masked supervisor detail phone, got %#v", got)
	}

	fullCtx, fullRecorder := requestWithAdminFlags(http.MethodGet, "/api/v1/admin/supervisors/1002", gin.Params{{Key: "id", Value: "1002"}}, true)
	AdminGetSupervisor(fullCtx)
	fullData := decodeBusinessEnvelope(t, fullRecorder)
	if got := fullData["phone"]; got != profile.Phone {
		t.Fatalf("expected full supervisor detail phone, got %#v", got)
	}

	availableCtx, availableRecorder := requestWithAdminFlags(http.MethodGet, "/api/v1/admin/supervisors/available", nil, true)
	AdminListAvailableSupervisors(availableCtx)
	availableData := decodeBusinessEnvelope(t, availableRecorder)
	availableItems, _ := availableData["list"].([]any)
	availableFirst, _ := availableItems[0].(map[string]any)
	if got := availableFirst["phone"]; got != "134****4000" {
		t.Fatalf("expected masked available supervisor phone, got %#v", got)
	}

	assignmentCtx, assignmentRecorder := requestWithAdminFlags(http.MethodGet, "/api/v1/admin/supervisor-assignments", nil, true)
	AdminListSupervisorAssignments(assignmentCtx)
	assignmentData := decodeBusinessEnvelope(t, assignmentRecorder)
	assignmentItems, _ := assignmentData["list"].([]any)
	assignmentFirst, _ := assignmentItems[0].(map[string]any)
	if got := assignmentFirst["supervisorPhone"]; got != "134****4000" {
		t.Fatalf("expected masked supervisor assignment phone, got %#v", got)
	}
}

func TestAdminSupervisorApplicationAndWhitelistListMaskPhones(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupAdminPhonePrivacyRemainingDB(t)

	whitelist := model.SupervisorPhoneWhitelist{
		Base:             model.Base{ID: 1101},
		Phone:            "13300133000",
		Status:           1,
		CreatedByAdminID: 9,
	}
	if err := db.Create(&whitelist).Error; err != nil {
		t.Fatalf("create supervisor whitelist: %v", err)
	}
	application := model.SupervisorApplication{
		Base:        model.Base{ID: 1102},
		Phone:       "13200132000",
		WhitelistID: whitelist.ID,
		Status:      0,
		FormJSON:    `{"realName":"监理乙","cityCode":"330100","idNo":"110101199001011234","certifications":["/uploads/cases/cert.jpg"]}`,
		SubmittedAt: time.Now(),
	}
	if err := db.Create(&application).Error; err != nil {
		t.Fatalf("create supervisor application: %v", err)
	}

	whitelistCtx, whitelistRecorder := requestWithAdminFlags(http.MethodGet, "/api/v1/admin/supervisor-whitelists", nil, true)
	AdminListSupervisorWhitelists(whitelistCtx)
	whitelistData := decodeBusinessEnvelope(t, whitelistRecorder)
	whitelistItems, _ := whitelistData["list"].([]any)
	whitelistFirst, _ := whitelistItems[0].(map[string]any)
	if got := whitelistFirst["phone"]; got != "133****3000" {
		t.Fatalf("expected masked supervisor whitelist phone, got %#v", got)
	}

	applicationCtx, applicationRecorder := requestWithAdminFlags(http.MethodGet, "/api/v1/admin/supervisor-applications", nil, false)
	AdminListSupervisorApplications(applicationCtx)
	applicationData := decodeBusinessEnvelope(t, applicationRecorder)
	applicationItems, _ := applicationData["list"].([]any)
	applicationFirst, _ := applicationItems[0].(map[string]any)
	if got := applicationFirst["phone"]; got != "132****2000" {
		t.Fatalf("expected masked supervisor application phone, got %#v", got)
	}
	formJSON, _ := applicationFirst["formJson"].(string)
	if strings.Contains(formJSON, "110101199001011234") || strings.Contains(formJSON, "idNo") {
		t.Fatalf("list-only supervisor application response must not expose idNo, got %s", formJSON)
	}

	reviewerCtx, reviewerRecorder := requestWithAdminFlags(http.MethodGet, "/api/v1/admin/supervisor-applications", nil, false)
	reviewerCtx.Set("is_super", true)
	AdminListSupervisorApplications(reviewerCtx)
	reviewerData := decodeBusinessEnvelope(t, reviewerRecorder)
	reviewerItems, _ := reviewerData["list"].([]any)
	reviewerFirst, _ := reviewerItems[0].(map[string]any)
	reviewerFormJSON, _ := reviewerFirst["formJson"].(string)
	if !strings.Contains(reviewerFormJSON, "110101199001011234") {
		t.Fatalf("supervisor reviewer should receive full application form, got %s", reviewerFormJSON)
	}
}
