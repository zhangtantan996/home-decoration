package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
)

func TestMerchantDashboardStats_FlatFields(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db := setupSQLiteDB(t)
	if err := db.AutoMigrate(
		&model.User{},
		&model.Provider{},
		&model.Booking{},
		&model.Proposal{},
		&model.Order{},
		&model.Project{},
		&model.BusinessFlow{},
		&model.MerchantIncome{},
	); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}

	previousDB := repository.DB
	repository.DB = db
	t.Cleanup(func() {
		repository.DB = previousDB
	})

	providerID := uint64(101)
	userID := uint64(1001)

	if err := db.Create(&model.User{Base: model.Base{ID: userID}, Phone: "13800000001", Nickname: "测试商家"}).Error; err != nil {
		t.Fatalf("seed user: %v", err)
	}
	if err := db.Create(&model.Provider{Base: model.Base{ID: providerID}, UserID: userID, ProviderType: 3, SubType: "foreman", Status: 1}).Error; err != nil {
		t.Fatalf("seed provider: %v", err)
	}

	oldDate := time.Now().AddDate(0, -1, 0)

	bookings := []model.Booking{
		{ProviderID: providerID, Status: 1},
		{ProviderID: providerID, Status: 2},
		{Base: model.Base{CreatedAt: oldDate, UpdatedAt: oldDate}, ProviderID: providerID, Status: 1},
	}
	for _, booking := range bookings {
		if err := db.Create(&booking).Error; err != nil {
			t.Fatalf("seed booking: %v", err)
		}
	}

	proposal1 := model.Proposal{BookingID: 1, DesignerID: providerID, Status: 1}
	proposal2 := model.Proposal{BookingID: 2, DesignerID: providerID, Status: 2}
	if err := db.Create(&proposal1).Error; err != nil {
		t.Fatalf("seed proposal1: %v", err)
	}
	if err := db.Create(&proposal2).Error; err != nil {
		t.Fatalf("seed proposal2: %v", err)
	}

	order1 := model.Order{BookingID: 1, OrderNo: "T-ORDER-1", Status: 0}
	order2 := model.Order{BookingID: 2, OrderNo: "T-ORDER-2", Status: 1}
	if err := db.Create(&order1).Error; err != nil {
		t.Fatalf("seed order1: %v", err)
	}
	if err := db.Create(&order2).Error; err != nil {
		t.Fatalf("seed order2: %v", err)
	}

	project := model.Project{
		Base:           model.Base{ID: 9001},
		OwnerID:        userID,
		ProposalID:     proposal2.ID,
		ProviderID:     providerID,
		Status:         model.ProjectStatusActive,
		BusinessStatus: model.ProjectBusinessStatusConstructionQuoteConfirmed,
		CurrentPhase:   "待监理协调开工",
	}
	if err := db.Create(&project).Error; err != nil {
		t.Fatalf("seed project: %v", err)
	}
	flow := model.BusinessFlow{
		Base:                      model.Base{ID: 9901},
		SourceType:                model.BusinessFlowSourceBooking,
		SourceID:                  2,
		CustomerUserID:            userID,
		DesignerProviderID:        providerID,
		SelectedForemanProviderID: providerID,
		ProjectID:                 project.ID,
		CurrentStage:              model.BusinessFlowStageReadyToStart,
	}
	if err := db.Create(&flow).Error; err != nil {
		t.Fatalf("seed business flow: %v", err)
	}

	incomes := []model.MerchantIncome{
		{ProviderID: providerID, NetAmount: 1000, Status: 1},
		{Base: model.Base{CreatedAt: oldDate, UpdatedAt: oldDate}, ProviderID: providerID, NetAmount: 500, Status: 1},
	}
	for _, income := range incomes {
		if err := db.Create(&income).Error; err != nil {
			t.Fatalf("seed income: %v", err)
		}
	}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/api/v1/merchant/dashboard", bytes.NewReader(nil))
	c.Set("providerId", providerID)

	MerchantDashboardStats(c)

	resp := decodeResponse(t, w)
	if resp.Code != 0 {
		t.Fatalf("unexpected code: %d, message=%s", resp.Code, resp.Message)
	}

	var data struct {
		TodayBookings    int64   `json:"todayBookings"`
		PendingProposals int64   `json:"pendingProposals"`
		ActiveProjects   int64   `json:"activeProjects"`
		TotalRevenue     float64 `json:"totalRevenue"`
		MonthRevenue     float64 `json:"monthRevenue"`
		Bookings         struct {
			Pending   int64 `json:"pending"`
			Confirmed int64 `json:"confirmed"`
		} `json:"bookings"`
		Proposals struct {
			Pending   int64 `json:"pending"`
			Confirmed int64 `json:"confirmed"`
		} `json:"proposals"`
		Orders struct {
			Pending int64 `json:"pending"`
			Paid    int64 `json:"paid"`
		} `json:"orders"`
	}
	if err := json.Unmarshal(resp.Data, &data); err != nil {
		t.Fatalf("decode data: %v", err)
	}

	if data.TodayBookings != 2 {
		t.Fatalf("todayBookings mismatch: got=%d want=2", data.TodayBookings)
	}
	if data.PendingProposals != 1 {
		t.Fatalf("pendingProposals mismatch: got=%d want=1", data.PendingProposals)
	}
	if data.ActiveProjects != 1 {
		t.Fatalf("activeProjects mismatch: got=%d want=1", data.ActiveProjects)
	}
	if data.TotalRevenue != 1500 {
		t.Fatalf("totalRevenue mismatch: got=%v want=1500", data.TotalRevenue)
	}
	if data.MonthRevenue != 1000 {
		t.Fatalf("monthRevenue mismatch: got=%v want=1000", data.MonthRevenue)
	}

	if data.Bookings.Pending != 2 || data.Bookings.Confirmed != 1 {
		t.Fatalf("bookings grouped mismatch: %+v", data.Bookings)
	}
	if data.Proposals.Pending != 1 || data.Proposals.Confirmed != 1 {
		t.Fatalf("proposals grouped mismatch: %+v", data.Proposals)
	}
	if data.Orders.Pending != 1 || data.Orders.Paid != 1 {
		t.Fatalf("orders grouped mismatch: %+v", data.Orders)
	}
}

func TestMerchantDashboardStats_ActiveProjectsIgnorePaidOrdersWithoutProject(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db := setupSQLiteDB(t)
	if err := db.AutoMigrate(
		&model.User{},
		&model.Provider{},
		&model.Booking{},
		&model.Proposal{},
		&model.Order{},
		&model.Project{},
		&model.BusinessFlow{},
		&model.MerchantIncome{},
	); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}

	previousDB := repository.DB
	repository.DB = db
	t.Cleanup(func() {
		repository.DB = previousDB
	})

	providerID := uint64(301)
	userID := uint64(3001)

	if err := db.Create(&model.User{Base: model.Base{ID: userID}, Phone: "13800000002", Nickname: "测试设计师"}).Error; err != nil {
		t.Fatalf("seed user: %v", err)
	}
	if err := db.Create(&model.Provider{Base: model.Base{ID: providerID}, UserID: userID, ProviderType: 1, SubType: "designer", Status: 1}).Error; err != nil {
		t.Fatalf("seed provider: %v", err)
	}

	booking := model.Booking{Base: model.Base{ID: 11}, ProviderID: providerID, Status: 2}
	if err := db.Create(&booking).Error; err != nil {
		t.Fatalf("seed booking: %v", err)
	}
	proposal := model.Proposal{Base: model.Base{ID: 21}, BookingID: booking.ID, DesignerID: providerID, Status: 2}
	if err := db.Create(&proposal).Error; err != nil {
		t.Fatalf("seed proposal: %v", err)
	}
	order := model.Order{BookingID: booking.ID, OrderNo: "T-ORDER-3", Status: 1}
	if err := db.Create(&order).Error; err != nil {
		t.Fatalf("seed order: %v", err)
	}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/api/v1/merchant/dashboard", bytes.NewReader(nil))
	c.Set("providerId", providerID)

	MerchantDashboardStats(c)

	resp := decodeResponse(t, w)
	if resp.Code != 0 {
		t.Fatalf("unexpected code: %d, message=%s", resp.Code, resp.Message)
	}

	var data struct {
		ActiveProjects int64 `json:"activeProjects"`
	}
	if err := json.Unmarshal(resp.Data, &data); err != nil {
		t.Fatalf("decode data: %v", err)
	}
	if data.ActiveProjects != 0 {
		t.Fatalf("activeProjects mismatch: got=%d want=0", data.ActiveProjects)
	}
}

func TestMerchantDashboardStats_CompanyConstructionProjectsCountSelectedSubject(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db := setupSQLiteDB(t)
	if err := db.AutoMigrate(
		&model.User{},
		&model.Provider{},
		&model.Booking{},
		&model.Proposal{},
		&model.Order{},
		&model.Project{},
		&model.BusinessFlow{},
		&model.MerchantIncome{},
	); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}

	previousDB := repository.DB
	repository.DB = db
	t.Cleanup(func() {
		repository.DB = previousDB
	})

	designerProviderID := uint64(401)
	companyProviderID := uint64(402)
	userID := uint64(4001)

	if err := db.Create(&model.User{Base: model.Base{ID: userID}, Phone: "13800000003", Nickname: "测试装修公司"}).Error; err != nil {
		t.Fatalf("seed user: %v", err)
	}
	if err := db.Create(&model.Provider{Base: model.Base{ID: designerProviderID}, ProviderType: 1, SubType: "designer", Status: 1, CompanyName: "设计师A"}).Error; err != nil {
		t.Fatalf("seed designer provider: %v", err)
	}
	if err := db.Create(&model.Provider{Base: model.Base{ID: companyProviderID}, UserID: userID, ProviderType: 2, SubType: "company", Status: 1, CompanyName: "施工公司A"}).Error; err != nil {
		t.Fatalf("seed company provider: %v", err)
	}

	project := model.Project{
		Base:                   model.Base{ID: 9101},
		OwnerID:                userID,
		ProviderID:             companyProviderID,
		ConstructionProviderID: companyProviderID,
		Status:                 model.ProjectStatusActive,
		BusinessStatus:         model.ProjectBusinessStatusConstructionQuoteConfirmed,
		CurrentPhase:           "待监理协调开工",
	}
	if err := db.Create(&project).Error; err != nil {
		t.Fatalf("seed project: %v", err)
	}

	flow := model.BusinessFlow{
		Base:                      model.Base{ID: 9902},
		SourceType:                model.BusinessFlowSourceBooking,
		SourceID:                  88,
		CustomerUserID:            userID,
		DesignerProviderID:        designerProviderID,
		SelectedForemanProviderID: companyProviderID,
		ProjectID:                 project.ID,
		CurrentStage:              model.BusinessFlowStageReadyToStart,
	}
	if err := db.Create(&flow).Error; err != nil {
		t.Fatalf("seed business flow: %v", err)
	}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/api/v1/merchant/dashboard", bytes.NewReader(nil))
	c.Set("providerId", companyProviderID)

	MerchantDashboardStats(c)

	resp := decodeResponse(t, w)
	if resp.Code != 0 {
		t.Fatalf("unexpected code: %d, message=%s", resp.Code, resp.Message)
	}

	var data struct {
		ActiveProjects int64 `json:"activeProjects"`
	}
	if err := json.Unmarshal(resp.Data, &data); err != nil {
		t.Fatalf("decode data: %v", err)
	}
	if data.ActiveProjects != 1 {
		t.Fatalf("activeProjects mismatch for company construction subject: got=%d want=1", data.ActiveProjects)
	}
}
