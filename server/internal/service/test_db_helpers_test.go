package service

import (
	"testing"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"

	"gorm.io/gorm"
)

func withPaymentCentralTestModels(models ...any) []any {
	extra := []any{
		&model.PaymentOrder{},
		&model.PaymentCallback{},
		&model.RefundOrder{},
		&model.PayoutOrder{},
		&model.PaymentPlan{},
		&model.ChangeOrder{},
		&model.SettlementOrder{},
		&model.LedgerAccount{},
		&model.LedgerEntry{},
		&model.MerchantBondRule{},
		&model.MerchantBondAccount{},
		&model.UserSettings{},
	}
	all := make([]any, 0, len(models)+len(extra))
	all = append(all, models...)
	all = append(all, extra...)
	return all
}

func bindRepositorySQLiteTestDB(t *testing.T, db *gorm.DB) {
	t.Helper()

	sqlDB, err := db.DB()
	if err != nil {
		t.Fatalf("get sql db: %v", err)
	}
	sqlDB.SetMaxOpenConns(1)
	sqlDB.SetMaxIdleConns(1)

	previousDB := repository.DB
	repository.DB = db
	t.Cleanup(func() {
		repository.DB = previousDB
		_ = sqlDB.Close()
	})
}
