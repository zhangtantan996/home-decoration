package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
)

func TestAdminPaymentOrderGovernanceListAndDetailExposeRefundProjection(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db := setupSQLiteDB(t)
	if err := db.AutoMigrate(&model.PaymentOrder{}, &model.RefundOrder{}); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}
	previousDB := repository.DB
	repository.DB = db
	t.Cleanup(func() {
		repository.DB = previousDB
	})

	paidAt := time.Now()
	payment := model.PaymentOrder{
		Base:                 model.Base{ID: 9101},
		BizType:              model.PaymentBizTypePaymentPlan,
		BizID:                9201,
		PayerUserID:          9301,
		Channel:              model.PaymentChannelWechat,
		FundScene:            model.FundSceneConstructionStage,
		TerminalType:         model.PaymentTerminalMiniWechatJSAPI,
		Subject:              "施工阶段款",
		Amount:               1200,
		AmountCent:           120000,
		RefundedAmount:       300,
		RefundedAmountCent:   30000,
		RefundStatus:         model.PaymentRefundStatusPartialRefunded,
		OutTradeNo:           "WX-PAY-9101",
		ProviderTradeNo:      "WX-TXN-9101",
		Status:               model.PaymentStatusPaid,
		PaidAt:               &paidAt,
		RawResponseDigest:    "digest",
		LaunchTokenHash:      "hidden",
		LaunchTokenExpiredAt: &paidAt,
	}
	if err := db.Create(&payment).Error; err != nil {
		t.Fatalf("create payment: %v", err)
	}
	refund := model.RefundOrder{
		Base:           model.Base{ID: 9102},
		PaymentOrderID: payment.ID,
		BizType:        payment.BizType,
		BizID:          payment.BizID,
		FundScene:      payment.FundScene,
		OutRefundNo:    "WX-RF-9102",
		Amount:         300,
		AmountCent:     30000,
		Status:         model.RefundOrderStatusSucceeded,
		SucceededAt:    &paidAt,
	}
	if err := db.Create(&refund).Error; err != nil {
		t.Fatalf("create refund: %v", err)
	}

	listRecorder := httptest.NewRecorder()
	listCtx, _ := gin.CreateTestContext(listRecorder)
	listCtx.Request = httptest.NewRequest(http.MethodGet, "/api/v1/admin/finance/payment-orders?status=paid&channel=wechat", nil)
	AdminListPaymentOrders(listCtx)

	listResp := decodeResponse(t, listRecorder)
	if listResp.Code != 0 {
		t.Fatalf("unexpected list code: %d, message=%s", listResp.Code, listResp.Message)
	}
	var listData struct {
		List []struct {
			ID                   uint64  `json:"id"`
			OutTradeNo           string  `json:"outTradeNo"`
			AmountCent           int64   `json:"amountCent"`
			RefundedAmount       float64 `json:"refundedAmount"`
			RefundedAmountCent   int64   `json:"refundedAmountCent"`
			RefundStatus         string  `json:"refundStatus"`
			RefundOrderCount     int64   `json:"refundOrderCount"`
			RefundSucceededCount int64   `json:"refundSucceededCount"`
		} `json:"list"`
		Total int64 `json:"total"`
	}
	if err := json.Unmarshal(listResp.Data, &listData); err != nil {
		t.Fatalf("decode list: %v", err)
	}
	if listData.Total != 1 || len(listData.List) != 1 {
		t.Fatalf("expected one payment order, got %+v", listData)
	}
	item := listData.List[0]
	if item.OutTradeNo != payment.OutTradeNo || item.AmountCent != 120000 || item.RefundedAmount != 300 || item.RefundedAmountCent != 30000 || item.RefundStatus != model.PaymentRefundStatusPartialRefunded {
		t.Fatalf("unexpected payment list projection: %+v", item)
	}
	if item.RefundOrderCount != 1 || item.RefundSucceededCount != 1 {
		t.Fatalf("expected refund counts, got %+v", item)
	}

	detailRecorder := httptest.NewRecorder()
	detailCtx, _ := gin.CreateTestContext(detailRecorder)
	detailCtx.Params = gin.Params{{Key: "id", Value: "9101"}}
	detailCtx.Request = httptest.NewRequest(http.MethodGet, "/api/v1/admin/finance/payment-orders/9101", nil)
	AdminGetPaymentOrderDetail(detailCtx)

	detailResp := decodeResponse(t, detailRecorder)
	if detailResp.Code != 0 {
		t.Fatalf("unexpected detail code: %d, message=%s", detailResp.Code, detailResp.Message)
	}
	var detailData struct {
		Payment struct {
			ID             uint64 `json:"id"`
			LaunchTokenSet bool   `json:"launchTokenSet"`
		} `json:"payment"`
		Refunds []struct {
			ID          uint64 `json:"id"`
			OutRefundNo string `json:"outRefundNo"`
		} `json:"refunds"`
	}
	if err := json.Unmarshal(detailResp.Data, &detailData); err != nil {
		t.Fatalf("decode detail: %v", err)
	}
	if detailData.Payment.ID != payment.ID || !detailData.Payment.LaunchTokenSet || len(detailData.Refunds) != 1 || detailData.Refunds[0].OutRefundNo != refund.OutRefundNo {
		t.Fatalf("unexpected detail data: %+v", detailData)
	}
}
