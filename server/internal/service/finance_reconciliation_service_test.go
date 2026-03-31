package service

import (
	"testing"
	"time"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupFinanceReconciliationTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	db, err := gorm.Open(sqlite.Open("file::memory:?cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(
		&model.Transaction{},
		&model.EscrowAccount{},
		&model.MerchantIncome{},
		&model.MerchantWithdraw{},
		&model.PaymentOrder{},
		&model.RefundOrder{},
		&model.PayoutOrder{},
		&model.SettlementOrder{},
		&model.LedgerAccount{},
		&model.LedgerEntry{},
		&model.FinanceReconciliation{},
		&model.FinanceReconciliationItem{},
	); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}

	originalDB := repository.DB
	repository.DB = db
	t.Cleanup(func() {
		repository.DB = originalDB
	})
	return db
}

func TestFinanceReconciliationServiceRunDailyReconciliationDetectsMismatch(t *testing.T) {
	db := setupFinanceReconciliationTestDB(t)
	targetDate := time.Date(2026, 3, 20, 12, 0, 0, 0, time.Local)
	targetMoment := time.Date(2026, 3, 20, 9, 0, 0, 0, time.Local)

	records := []interface{}{
		&model.Transaction{
			Base:        model.Base{ID: 1, CreatedAt: targetMoment, UpdatedAt: targetMoment},
			OrderID:     "REL-1",
			Type:        "release",
			Amount:      1000,
			Status:      1,
			CompletedAt: &targetMoment,
		},
		&model.Transaction{
			Base:        model.Base{ID: 2, CreatedAt: targetMoment, UpdatedAt: targetMoment},
			OrderID:     "REF-1",
			Type:        "refund",
			Amount:      400,
			Status:      1,
			CompletedAt: &targetMoment,
		},
		&model.MerchantIncome{
			Base:      model.Base{ID: 11, CreatedAt: targetMoment, UpdatedAt: targetMoment},
			Type:      "construction",
			Amount:    900,
			NetAmount: 810,
			Status:    1,
			SettledAt: &targetMoment,
		},
		&model.RefundOrder{
			Base:        model.Base{ID: 21, CreatedAt: targetMoment, UpdatedAt: targetMoment},
			OutRefundNo: "RF-1",
			Amount:      500,
			Status:      model.RefundOrderStatusSucceeded,
			SucceededAt: &targetMoment,
		},
		&model.MerchantWithdraw{
			Base:        model.Base{ID: 31, CreatedAt: targetMoment, UpdatedAt: targetMoment},
			OrderNo:     "W-1",
			Amount:      300,
			Status:      model.MerchantWithdrawStatusPaid,
			CompletedAt: &targetMoment,
		},
		&model.MerchantIncome{
			Base:            model.Base{ID: 32, CreatedAt: targetMoment, UpdatedAt: targetMoment},
			Type:            "construction",
			Amount:          300,
			NetAmount:       200,
			Status:          2,
			WithdrawOrderNo: "W-1",
		},
		&model.EscrowAccount{
			Base:            model.Base{ID: 41, CreatedAt: targetMoment, UpdatedAt: targetMoment},
			ProjectID:       99,
			TotalAmount:     1000,
			FrozenAmount:    100,
			AvailableAmount: 100,
			ReleasedAmount:  700,
			Status:          1,
		},
	}
	for _, record := range records {
		if err := db.Create(record).Error; err != nil {
			t.Fatalf("seed record: %v", err)
		}
	}

	result, err := (&FinanceReconciliationService{}).RunDailyReconciliation(targetDate)
	if err != nil {
		t.Fatalf("RunDailyReconciliation: %v", err)
	}
	if result.Status != model.FinanceReconciliationStatusWarning {
		t.Fatalf("expected warning status, got %s", result.Status)
	}
	if result.FindingCount != 4 {
		t.Fatalf("expected 4 findings, got %d", result.FindingCount)
	}
}

func TestFinanceReconciliationServiceClaimAndResolve(t *testing.T) {
	db := setupFinanceReconciliationTestDB(t)
	targetDate := time.Date(2026, 3, 20, 12, 0, 0, 0, time.Local)
	targetMoment := time.Date(2026, 3, 20, 10, 0, 0, 0, time.Local)

	if err := db.Create(&model.Transaction{
		Base:        model.Base{ID: 101, CreatedAt: targetMoment, UpdatedAt: targetMoment},
		OrderID:     "REL-101",
		Type:        "release",
		Amount:      1000,
		Status:      1,
		CompletedAt: &targetMoment,
	}).Error; err != nil {
		t.Fatalf("seed release tx: %v", err)
	}

	result, err := (&FinanceReconciliationService{}).RunDailyReconciliation(targetDate)
	if err != nil {
		t.Fatalf("RunDailyReconciliation: %v", err)
	}
	if result.FindingCount == 0 {
		t.Fatalf("expected findings for claim/resolve flow")
	}

	claimed, err := (&FinanceReconciliationService{}).ClaimFinanceReconciliation(result.ID, 7001, "财务已接手")
	if err != nil {
		t.Fatalf("ClaimFinanceReconciliation: %v", err)
	}
	if claimed.Status != model.FinanceReconciliationStatusProcessing {
		t.Fatalf("expected processing status, got %s", claimed.Status)
	}
	if claimed.OwnerAdminID != 7001 {
		t.Fatalf("expected owner 7001, got %d", claimed.OwnerAdminID)
	}

	resolved, err := (&FinanceReconciliationService{}).ResolveFinanceReconciliation(result.ID, 7002, "已补录缺失收入记录")
	if err != nil {
		t.Fatalf("ResolveFinanceReconciliation: %v", err)
	}
	if resolved.Status != model.FinanceReconciliationStatusResolved {
		t.Fatalf("expected resolved status, got %s", resolved.Status)
	}
	if resolved.ResolvedByAdminID != 7002 {
		t.Fatalf("expected resolver 7002, got %d", resolved.ResolvedByAdminID)
	}
}
