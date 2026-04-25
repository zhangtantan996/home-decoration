package cron

import (
	"testing"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	"home-decoration-server/internal/service"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func TestPaymentTimeoutPaidQueryTriggersPaymentSync(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	if err := db.AutoMigrate(&model.PaymentOrder{}); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	repository.DB = db

	payment := &model.PaymentOrder{
		Channel:    model.PaymentChannelWechat,
		Status:     model.PaymentStatusPending,
		OutTradeNo: "WX-test",
	}
	if err := db.Create(payment).Error; err != nil {
		t.Fatalf("seed payment: %v", err)
	}

	called := false
	original := syncPaymentStateForTimeout
	syncPaymentStateForTimeout = func(paymentID uint64) (*model.PaymentOrder, error) {
		called = true
		if paymentID != payment.ID {
			t.Fatalf("expected sync payment id %d, got %d", payment.ID, paymentID)
		}
		return payment, nil
	}
	defer func() { syncPaymentStateForTimeout = original }()

	err = (&PaymentTimeoutJob{}).handleQueryResult(payment, &service.PaymentChannelTradeResult{
		TradeStatus:     "SUCCESS",
		ProviderTradeNo: "420000-test",
	})
	if err != nil {
		t.Fatalf("handleQueryResult: %v", err)
	}
	if !called {
		t.Fatalf("expected paid query result to trigger payment sync")
	}
}
