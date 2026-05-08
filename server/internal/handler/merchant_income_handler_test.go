package handler

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	"home-decoration-server/pkg/utils"
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

func TestGenerateWithdrawOrderNoFormat(t *testing.T) {
	orderNo, err := generateWithdrawOrderNo()
	if err != nil {
		t.Fatalf("expected order number, got %v", err)
	}
	if len(orderNo) != 21 {
		t.Fatalf("expected order length 21, got %d (%s)", len(orderNo), orderNo)
	}
	if orderNo[0] != 'W' {
		t.Fatalf("expected W prefix, got %s", orderNo)
	}
}

func TestMerchantBankAccountListMasksEncryptedAccountNo(t *testing.T) {
	gin.SetMode(gin.TestMode)
	t.Setenv("ENCRYPTION_KEY", base64.StdEncoding.EncodeToString([]byte("12345678901234567890123456789012")))
	if err := utils.InitCrypto(); err != nil {
		t.Fatalf("init crypto: %v", err)
	}

	db := setupSQLiteDB(t)
	if err := db.AutoMigrate(&model.MerchantBankAccount{}); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}

	previousDB := repository.DB
	repository.DB = db
	t.Cleanup(func() {
		repository.DB = previousDB
	})

	const providerID = uint64(288)
	const plainAccountNo = "6222021234567890123"
	account := model.MerchantBankAccount{
		ProviderID:  providerID,
		AccountName: "测试商家",
		AccountNo:   plainAccountNo,
		BankName:    "建设银行",
		BranchName:  "杭州西湖支行",
		IsDefault:   true,
		Status:      1,
	}
	if err := db.Create(&account).Error; err != nil {
		t.Fatalf("create bank account: %v", err)
	}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/api/v1/merchant/bank-accounts", nil)
	c.Set("providerId", providerID)

	MerchantBankAccountList(c)

	resp := decodeResponse(t, w)
	if resp.Code != 0 {
		t.Fatalf("unexpected code: %d, message=%s", resp.Code, resp.Message)
	}

	var data struct {
		List []struct {
			AccountNo string `json:"accountNo"`
		} `json:"list"`
	}
	if err := json.Unmarshal(resp.Data, &data); err != nil {
		t.Fatalf("decode data: %v", err)
	}

	if len(data.List) != 1 {
		t.Fatalf("expected one bank account, got %d", len(data.List))
	}
	if got, want := data.List[0].AccountNo, utils.MaskBankAccount(plainAccountNo); got != want {
		t.Fatalf("expected masked account no %q, got %q", want, got)
	}
}

func TestMerchantWithdrawCreateStoresMaskedBankAccount(t *testing.T) {
	gin.SetMode(gin.TestMode)
	t.Setenv("ENCRYPTION_KEY", base64.StdEncoding.EncodeToString([]byte("12345678901234567890123456789012")))
	t.Setenv("SMS_FIXED_CODE_MODE", "true")
	t.Setenv("SMS_FIXED_CODE", "654321")
	if err := utils.InitCrypto(); err != nil {
		t.Fatalf("init crypto: %v", err)
	}

	db := setupSQLiteDB(t)
	if err := db.AutoMigrate(&model.User{}, &model.Provider{}, &model.MerchantIncome{}, &model.MerchantWithdraw{}, &model.MerchantBankAccount{}); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}

	previousDB := repository.DB
	repository.DB = db
	t.Cleanup(func() {
		repository.DB = previousDB
	})

	user := model.User{
		Base:  model.Base{ID: 301},
		Phone: "13800138000",
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}

	const providerID = uint64(302)
	provider := model.Provider{
		Base:       model.Base{ID: providerID},
		UserID:     user.ID,
		Status:     1,
		SubType:    "personal",
		EntityType: "personal",
	}
	if err := db.Create(&provider).Error; err != nil {
		t.Fatalf("create provider: %v", err)
	}

	const plainAccountNo = "6222021234567890123"
	account := model.MerchantBankAccount{
		Base:        model.Base{ID: 303},
		ProviderID:  providerID,
		AccountName: "测试商家",
		AccountNo:   plainAccountNo,
		BankName:    "中国银行",
		BranchName:  "上海浦东支行",
		IsDefault:   true,
		Status:      1,
	}
	if err := db.Create(&account).Error; err != nil {
		t.Fatalf("create bank account: %v", err)
	}

	income := model.MerchantIncome{
		Base:       model.Base{ID: 304},
		ProviderID: providerID,
		Type:       "construction",
		Amount:     500,
		NetAmount:  500,
		Status:     1,
	}
	if err := db.Create(&income).Error; err != nil {
		t.Fatalf("create income: %v", err)
	}

	body := bytes.NewBufferString(`{"amount":120,"bankAccountId":303,"verificationCode":"654321"}`)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/api/v1/merchant/withdraws", body)
	c.Request.Header.Set("Content-Type", "application/json")
	c.Set("providerId", providerID)

	MerchantWithdrawCreate(c)

	resp := decodeResponse(t, w)
	if resp.Code != 0 {
		t.Fatalf("unexpected code: %d, message=%s", resp.Code, resp.Message)
	}

	var withdraw model.MerchantWithdraw
	if err := db.Where("provider_id = ?", providerID).First(&withdraw).Error; err != nil {
		t.Fatalf("query withdraw: %v", err)
	}
	if got, want := withdraw.BankAccount, utils.MaskBankAccount(plainAccountNo); got != want {
		t.Fatalf("expected stored masked bank account %q, got %q", want, got)
	}
	if withdraw.BankAccount == plainAccountNo {
		t.Fatalf("expected withdraw bank account to avoid plain storage")
	}
}
