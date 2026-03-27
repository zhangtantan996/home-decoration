package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/gin-gonic/gin"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	"home-decoration-server/internal/service"
)

type handlerPaymentReconcileChannel struct{}

func (handlerPaymentReconcileChannel) CreateCollectOrder(context.Context, *model.PaymentOrder) (string, error) {
	return "", nil
}

func (handlerPaymentReconcileChannel) VerifyNotify(values url.Values) (map[string]string, error) {
	result := make(map[string]string, len(values))
	for key := range values {
		result[key] = values.Get(key)
	}
	return result, nil
}

func (handlerPaymentReconcileChannel) QueryCollectOrder(context.Context, *model.PaymentOrder) (*service.PaymentChannelTradeResult, error) {
	return &service.PaymentChannelTradeResult{
		ProviderTradeNo: "ALI-PAID-2",
		TradeStatus:     "TRADE_SUCCESS",
		RawJSON:         `{"trade_status":"TRADE_SUCCESS"}`,
	}, nil
}

func (handlerPaymentReconcileChannel) RefundCollectOrder(context.Context, *model.PaymentOrder, *model.RefundOrder) (*service.PaymentChannelRefundResult, error) {
	return &service.PaymentChannelRefundResult{}, nil
}

func (handlerPaymentReconcileChannel) QueryRefundOrder(context.Context, *model.PaymentOrder, *model.RefundOrder) (*service.PaymentChannelRefundResult, error) {
	return &service.PaymentChannelRefundResult{}, nil
}

func TestGetProposalRefreshesPendingOrderStatus(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db := setupSQLiteDB(t)
	if err := db.AutoMigrate(&model.Proposal{}, &model.Order{}, &model.PaymentOrder{}, &model.SystemConfig{}); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}

	previousDB := repository.DB
	previousPaymentService := paymentService
	repository.DB = db
	paymentService = service.NewPaymentService(handlerPaymentReconcileChannel{})
	t.Cleanup(func() {
		repository.DB = previousDB
		paymentService = previousPaymentService
		configSvc.ClearCache()
	})
	configSvc.ClearCache()

	proposal := model.Proposal{
		Base:    model.Base{ID: 1001},
		Summary: "支付对账方案",
		Status:  model.ProposalStatusConfirmed,
	}
	order := model.Order{
		Base:        model.Base{ID: 1002},
		ProposalID:  proposal.ID,
		OrderType:   model.OrderTypeDesign,
		Status:      model.OrderStatusPending,
		TotalAmount: 800,
	}
	payment := model.PaymentOrder{
		Base:          model.Base{ID: 1003},
		BizType:       model.PaymentBizTypeOrder,
		BizID:         order.ID,
		PayerUserID:   7,
		Channel:       model.PaymentChannelAlipay,
		Scene:         model.PaymentBizTypeOrder,
		FundScene:     model.FundSceneDesignFee,
		TerminalType:  model.PaymentTerminalPCWeb,
		Subject:       "设计费订单",
		Amount:        800,
		OutTradeNo:    "OUT-1003",
		Status:        model.PaymentStatusPending,
		ReturnContext: "{}",
	}

	for _, value := range []any{&proposal, &order, &payment} {
		if err := db.Create(value).Error; err != nil {
			t.Fatalf("seed fixture: %v", err)
		}
	}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Params = gin.Params{{Key: "id", Value: "1001"}}
	c.Request = httptest.NewRequest(http.MethodGet, "/api/v1/proposals/1001", nil)

	GetProposal(c)

	resp := decodeResponse(t, w)
	if resp.Code != 0 {
		t.Fatalf("unexpected code: %d message=%s", resp.Code, resp.Message)
	}

	var data struct {
		Order struct {
			Status int8 `json:"status"`
		} `json:"order"`
		HasOrder bool `json:"hasOrder"`
	}
	if err := json.Unmarshal(resp.Data, &data); err != nil {
		t.Fatalf("decode response data: %v", err)
	}
	if !data.HasOrder {
		t.Fatalf("expected order to exist")
	}
	if data.Order.Status != model.OrderStatusPaid {
		t.Fatalf("expected order status paid, got %d", data.Order.Status)
	}
}

func TestGetOrderRefreshesPendingOrderStatus(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db := setupSQLiteDB(t)
	if err := db.AutoMigrate(&model.Booking{}, &model.Proposal{}, &model.Order{}, &model.PaymentOrder{}); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}

	previousDB := repository.DB
	previousPaymentService := paymentService
	repository.DB = db
	paymentService = service.NewPaymentService(handlerPaymentReconcileChannel{})
	t.Cleanup(func() {
		repository.DB = previousDB
		paymentService = previousPaymentService
	})

	booking := model.Booking{
		Base:   model.Base{ID: 1101},
		UserID: 77,
	}
	proposal := model.Proposal{
		Base:      model.Base{ID: 1102},
		BookingID: booking.ID,
	}
	order := model.Order{
		Base:        model.Base{ID: 1103},
		ProposalID:  proposal.ID,
		OrderType:   model.OrderTypeDesign,
		Status:      model.OrderStatusPending,
		TotalAmount: 1500,
	}
	payment := model.PaymentOrder{
		Base:          model.Base{ID: 1104},
		BizType:       model.PaymentBizTypeOrder,
		BizID:         order.ID,
		PayerUserID:   booking.UserID,
		Channel:       model.PaymentChannelAlipay,
		Scene:         model.PaymentBizTypeOrder,
		FundScene:     model.FundSceneDesignFee,
		TerminalType:  model.PaymentTerminalPCWeb,
		Subject:       "设计费订单",
		Amount:        1500,
		OutTradeNo:    "OUT-1104",
		Status:        model.PaymentStatusPending,
		ReturnContext: "{}",
	}

	for _, value := range []any{&booking, &proposal, &order, &payment} {
		if err := db.Create(value).Error; err != nil {
			t.Fatalf("seed fixture: %v", err)
		}
	}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Params = gin.Params{{Key: "id", Value: "1103"}}
	c.Request = httptest.NewRequest(http.MethodGet, "/api/v1/orders/1103", nil)
	c.Set("userId", booking.UserID)

	GetOrder(c)

	resp := decodeResponse(t, w)
	if resp.Code != 0 {
		t.Fatalf("unexpected code: %d message=%s", resp.Code, resp.Message)
	}

	var data struct {
		Status int8 `json:"status"`
	}
	if err := json.Unmarshal(resp.Data, &data); err != nil {
		t.Fatalf("decode response data: %v", err)
	}
	if data.Status != model.OrderStatusPaid {
		t.Fatalf("expected order status paid, got %d", data.Status)
	}
}
