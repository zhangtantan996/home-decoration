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
