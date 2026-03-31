package service

import (
	"context"
	"net/http"
	"net/url"
	"testing"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"

	gormsqlite "gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

type paymentReconcileTestChannel struct {
	tradeStatus string
}

func (c paymentReconcileTestChannel) Channel() string {
	return model.PaymentChannelAlipay
}

func (c paymentReconcileTestChannel) CreateCollectOrder(context.Context, *model.PaymentOrder) (string, error) {
	return "", nil
}

func (c paymentReconcileTestChannel) CreateCollectQRCode(context.Context, *model.PaymentOrder) ([]byte, error) {
	return nil, nil
}

func (c paymentReconcileTestChannel) CreateMiniProgramPayment(context.Context, *model.PaymentOrder, string) (*PaymentChannelMiniProgramResult, error) {
	return nil, nil
}

func (c paymentReconcileTestChannel) VerifyNotify(values url.Values) (map[string]string, error) {
	result := make(map[string]string, len(values))
	for key := range values {
		result[key] = values.Get(key)
	}
	return result, nil
}

func (c paymentReconcileTestChannel) ParseNotifyRequest(context.Context, *http.Request) (*PaymentChannelNotifyResult, error) {
	return nil, nil
}

func (c paymentReconcileTestChannel) QueryCollectOrder(context.Context, *model.PaymentOrder) (*PaymentChannelTradeResult, error) {
	return &PaymentChannelTradeResult{
		ProviderTradeNo: "ALI-PAID-1",
		TradeStatus:     c.tradeStatus,
		RawJSON:         `{"trade_status":"TRADE_SUCCESS"}`,
	}, nil
}

func (c paymentReconcileTestChannel) RefundCollectOrder(context.Context, *model.PaymentOrder, *model.RefundOrder) (*PaymentChannelRefundResult, error) {
	return &PaymentChannelRefundResult{}, nil
}

func (c paymentReconcileTestChannel) QueryRefundOrder(context.Context, *model.PaymentOrder, *model.RefundOrder) (*PaymentChannelRefundResult, error) {
	return &PaymentChannelRefundResult{}, nil
}

func setupPaymentReconcileDB(t *testing.T) *gorm.DB {
	t.Helper()

	db, err := gorm.Open(gormsqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite db: %v", err)
	}

	if err := db.AutoMigrate(&model.Order{}, &model.PaymentOrder{}); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}

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

	return db
}

func TestSyncLatestPendingBizPaymentMarksOrderPaid(t *testing.T) {
	db := setupPaymentReconcileDB(t)

	order := model.Order{
		Base:        model.Base{ID: 701},
		OrderNo:     "ORD-701",
		OrderType:   model.OrderTypeDesign,
		TotalAmount: 1200,
		Discount:    200,
		Status:      model.OrderStatusPending,
	}
	payment := model.PaymentOrder{
		Base:            model.Base{ID: 801},
		BizType:         model.PaymentBizTypeOrder,
		BizID:           order.ID,
		PayerUserID:     99,
		Channel:         model.PaymentChannelAlipay,
		Scene:           model.PaymentBizTypeOrder,
		FundScene:       model.FundSceneDesignFee,
		TerminalType:    model.PaymentTerminalPCWeb,
		Subject:         "设计费订单",
		Amount:          1000,
		OutTradeNo:      "OUT-801",
		Status:          model.PaymentStatusPending,
		ReturnContext:   "{}",
		ProviderTradeNo: "",
	}

	for _, item := range []any{&order, &payment} {
		if err := db.Create(item).Error; err != nil {
			t.Fatalf("seed fixture: %v", err)
		}
	}

	svc := NewPaymentService(paymentReconcileTestChannel{tradeStatus: alipayTradeSuccess})
	synced, err := svc.SyncLatestPendingBizPayment(model.PaymentBizTypeOrder, order.ID)
	if err != nil {
		t.Fatalf("sync latest pending payment: %v", err)
	}
	if synced == nil {
		t.Fatalf("expected synced payment")
	}
	if synced.Status != model.PaymentStatusPaid {
		t.Fatalf("expected payment status paid, got %s", synced.Status)
	}

	var updated model.Order
	if err := db.First(&updated, order.ID).Error; err != nil {
		t.Fatalf("load updated order: %v", err)
	}
	if updated.Status != model.OrderStatusPaid {
		t.Fatalf("expected order status paid, got %d", updated.Status)
	}
	if updated.PaidAmount != 1000 {
		t.Fatalf("expected paid amount 1000, got %.2f", updated.PaidAmount)
	}
	if updated.PaidAt == nil {
		t.Fatalf("expected paid_at to be populated")
	}
}
