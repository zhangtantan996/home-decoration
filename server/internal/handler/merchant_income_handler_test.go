package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
)

func TestMerchantIncomeListFiltersByProjectID(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db := setupSQLiteDB(t)
	if err := db.AutoMigrate(&model.Order{}, &model.MerchantIncome{}); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}

	previousDB := repository.DB
	repository.DB = db
	t.Cleanup(func() {
		repository.DB = previousDB
	})

	const providerID = uint64(88)
	orderA := model.Order{
		Base:      model.Base{ID: 101},
		ProjectID: 9001,
		OrderNo:   "MI-ORDER-101",
		Status:    model.OrderStatusPaid,
	}
	orderB := model.Order{
		Base:      model.Base{ID: 102},
		ProjectID: 9002,
		OrderNo:   "MI-ORDER-102",
		Status:    model.OrderStatusPaid,
	}
	if err := db.Create(&orderA).Error; err != nil {
		t.Fatalf("create orderA: %v", err)
	}
	if err := db.Create(&orderB).Error; err != nil {
		t.Fatalf("create orderB: %v", err)
	}

	incomes := []model.MerchantIncome{
		{
			Base:        model.Base{ID: 201},
			ProviderID:  providerID,
			OrderID:     orderA.ID,
			Type:        "construction",
			Amount:      1200,
			PlatformFee: 120,
			NetAmount:   1080,
			Status:      1,
		},
		{
			Base:        model.Base{ID: 202},
			ProviderID:  providerID,
			OrderID:     orderB.ID,
			Type:        "construction",
			Amount:      2400,
			PlatformFee: 240,
			NetAmount:   2160,
			Status:      1,
		},
	}
	for _, income := range incomes {
		if err := db.Create(&income).Error; err != nil {
			t.Fatalf("create income %d: %v", income.ID, err)
		}
	}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/api/v1/merchant/income/list?projectId=9002", nil)
	c.Set("providerId", providerID)

	MerchantIncomeList(c)

	resp := decodeResponse(t, w)
	if resp.Code != 0 {
		t.Fatalf("unexpected code: %d, message=%s", resp.Code, resp.Message)
	}

	var data struct {
		List []struct {
			ID        uint64 `json:"id"`
			OrderID   uint64 `json:"orderId"`
			ProjectID uint64 `json:"projectId"`
		} `json:"list"`
		Total int64 `json:"total"`
	}
	if err := json.Unmarshal(resp.Data, &data); err != nil {
		t.Fatalf("decode data: %v", err)
	}

	if data.Total != 1 || len(data.List) != 1 {
		t.Fatalf("expected one filtered income record, got total=%d len=%d", data.Total, len(data.List))
	}
	if data.List[0].OrderID != orderB.ID || data.List[0].ProjectID != orderB.ProjectID {
		t.Fatalf("expected filtered income to stay bound to project 9002, got %+v", data.List[0])
	}
}

func TestMerchantIncomeSummaryIncludesFrozenAndAbnormalFunds(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db := setupSQLiteDB(t)
	if err := db.AutoMigrate(&model.MerchantIncome{}, &model.MerchantWithdraw{}); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}

	previousDB := repository.DB
	repository.DB = db
	t.Cleanup(func() {
		repository.DB = previousDB
	})

	const providerID = uint64(188)
	incomes := []model.MerchantIncome{
		{ProviderID: providerID, NetAmount: 100, Amount: 100, Status: 0},
		{ProviderID: providerID, NetAmount: 200, Amount: 200, Status: 1},
		{ProviderID: providerID, NetAmount: 50, Amount: 50, Status: 1, WithdrawOrderNo: "W-FROZEN"},
		{ProviderID: providerID, NetAmount: 80, Amount: 80, Status: 1, PayoutStatus: model.PayoutStatusFailed, SettlementStatus: model.SettlementStatusException, PayoutFailedReason: "银行卡异常"},
		{ProviderID: providerID, NetAmount: 300, Amount: 300, Status: 2},
	}
	for i := range incomes {
		if err := db.Create(&incomes[i]).Error; err != nil {
			t.Fatalf("create income %d: %v", i, err)
		}
	}
	if err := db.Create(&model.MerchantWithdraw{
		ProviderID: providerID,
		OrderNo:    "W-REJECTED",
		Amount:     30,
		Status:     model.MerchantWithdrawStatusRejected,
		FailReason: "账户信息不完整",
	}).Error; err != nil {
		t.Fatalf("create rejected withdraw: %v", err)
	}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/api/v1/merchant/income/summary", nil)
	c.Set("providerId", providerID)

	MerchantIncomeSummary(c)

	resp := decodeResponse(t, w)
	if resp.Code != 0 {
		t.Fatalf("unexpected code: %d, message=%s", resp.Code, resp.Message)
	}

	var data struct {
		TotalIncome            float64 `json:"totalIncome"`
		PendingSettle          float64 `json:"pendingSettle"`
		AvailableAmount        float64 `json:"availableAmount"`
		FrozenAmount           float64 `json:"frozenAmount"`
		AbnormalAmount         float64 `json:"abnormalAmount"`
		RejectedWithdrawAmount float64 `json:"rejectedWithdrawAmount"`
		LatestRejectReason     string  `json:"latestRejectReason"`
	}
	if err := json.Unmarshal(resp.Data, &data); err != nil {
		t.Fatalf("decode data: %v", err)
	}

	if data.TotalIncome != 730 || data.PendingSettle != 100 || data.AvailableAmount != 200 {
		t.Fatalf("unexpected regular summary: %+v", data)
	}
	if data.FrozenAmount != 50 || data.AbnormalAmount != 80 {
		t.Fatalf("expected frozen=50 abnormal=80, got %+v", data)
	}
	if data.RejectedWithdrawAmount != 30 || data.LatestRejectReason != "账户信息不完整" {
		t.Fatalf("expected rejected withdraw projection, got %+v", data)
	}
}
