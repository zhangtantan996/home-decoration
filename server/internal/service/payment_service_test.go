package service

import (
	"context"
	"net/http"
	"net/url"
	"strconv"
	"testing"
	"time"

	"home-decoration-server/internal/config"
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"

	gormsqlite "gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

type paymentServiceTestGateway struct {
	notifyPayload     map[string]string
	queryTradeResult  *AlipayTradeQueryResult
	refundResult      *AlipayRefundResult
	queryRefundResult *AlipayRefundResult
}

type paymentServiceTestWechatGateway struct{}

func (g paymentServiceTestGateway) Channel() string {
	return model.PaymentChannelAlipay
}

func (g paymentServiceTestGateway) CreateCollectOrder(ctx context.Context, order *model.PaymentOrder) (string, error) {
	return "<html>redirect</html>", nil
}

func (g paymentServiceTestGateway) CreateCollectQRCode(ctx context.Context, order *model.PaymentOrder) ([]byte, error) {
	return []byte("png"), nil
}

func (g paymentServiceTestGateway) CreateMiniProgramPayment(context.Context, *model.PaymentOrder, string) (*PaymentChannelMiniProgramResult, error) {
	return nil, nil
}

func (g paymentServiceTestGateway) VerifyNotify(values url.Values) (map[string]string, error) {
	if g.notifyPayload != nil {
		return g.notifyPayload, nil
	}
	result := make(map[string]string, len(values))
	for key := range values {
		result[key] = values.Get(key)
	}
	return result, nil
}

func (g paymentServiceTestGateway) ParseNotifyRequest(context.Context, *http.Request) (*PaymentChannelNotifyResult, error) {
	return nil, nil
}

func (g paymentServiceTestGateway) QueryCollectOrder(ctx context.Context, order *model.PaymentOrder) (*PaymentChannelTradeResult, error) {
	if g.queryTradeResult != nil {
		return &PaymentChannelTradeResult{
			ProviderTradeNo: g.queryTradeResult.TradeNo,
			TradeStatus:     g.queryTradeResult.TradeStatus,
			BuyerLogonID:    g.queryTradeResult.BuyerLogonID,
			BuyerAmount:     g.queryTradeResult.BuyerAmount,
			RawJSON:         g.queryTradeResult.RawJSON,
		}, nil
	}
	return &PaymentChannelTradeResult{}, nil
}

func (g paymentServiceTestGateway) RefundCollectOrder(ctx context.Context, order *model.PaymentOrder, refund *model.RefundOrder) (*PaymentChannelRefundResult, error) {
	if g.refundResult != nil {
		return &PaymentChannelRefundResult{
			ProviderTradeNo: g.refundResult.TradeNo,
			OutTradeNo:      g.refundResult.OutTradeNo,
			OutRefundNo:     g.refundResult.OutRefundNo,
			Success:         g.refundResult.Success,
			Pending:         g.refundResult.Pending,
			RawJSON:         g.refundResult.RawJSON,
			FailureReason:   g.refundResult.FailureReason,
		}, nil
	}
	return &PaymentChannelRefundResult{
		ProviderTradeNo: "TRADE-REFUND",
		OutTradeNo:      order.OutTradeNo,
		OutRefundNo:     refund.OutRefundNo,
		Success:         true,
		RawJSON:         `{"code":"10000"}`,
	}, nil
}

func (g paymentServiceTestGateway) QueryRefundOrder(ctx context.Context, order *model.PaymentOrder, refund *model.RefundOrder) (*PaymentChannelRefundResult, error) {
	if g.queryRefundResult != nil {
		return &PaymentChannelRefundResult{
			ProviderTradeNo: g.queryRefundResult.TradeNo,
			OutTradeNo:      g.queryRefundResult.OutTradeNo,
			OutRefundNo:     g.queryRefundResult.OutRefundNo,
			Success:         g.queryRefundResult.Success,
			Pending:         g.queryRefundResult.Pending,
			RawJSON:         g.queryRefundResult.RawJSON,
			FailureReason:   g.queryRefundResult.FailureReason,
		}, nil
	}
	return &PaymentChannelRefundResult{
		ProviderTradeNo: "TRADE-REFUND",
		OutTradeNo:      order.OutTradeNo,
		OutRefundNo:     refund.OutRefundNo,
		Success:         true,
		RawJSON:         `{"code":"10000"}`,
	}, nil
}

func (paymentServiceTestWechatGateway) Channel() string {
	return model.PaymentChannelWechat
}

func (paymentServiceTestWechatGateway) CreateCollectOrder(context.Context, *model.PaymentOrder) (string, error) {
	return "", nil
}

func (paymentServiceTestWechatGateway) CreateCollectQRCode(context.Context, *model.PaymentOrder) ([]byte, error) {
	return nil, nil
}

func (paymentServiceTestWechatGateway) CreateMiniProgramPayment(context.Context, *model.PaymentOrder, string) (*PaymentChannelMiniProgramResult, error) {
	return &PaymentChannelMiniProgramResult{
		TimeStamp: "1712476800",
		NonceStr:  "nonce",
		Package:   "prepay_id=test",
		SignType:  "RSA",
		PaySign:   "sign",
	}, nil
}

func (paymentServiceTestWechatGateway) VerifyNotify(url.Values) (map[string]string, error) {
	return map[string]string{}, nil
}

func (paymentServiceTestWechatGateway) ParseNotifyRequest(context.Context, *http.Request) (*PaymentChannelNotifyResult, error) {
	return nil, nil
}

func (paymentServiceTestWechatGateway) QueryCollectOrder(context.Context, *model.PaymentOrder) (*PaymentChannelTradeResult, error) {
	return &PaymentChannelTradeResult{}, nil
}

func (paymentServiceTestWechatGateway) RefundCollectOrder(context.Context, *model.PaymentOrder, *model.RefundOrder) (*PaymentChannelRefundResult, error) {
	return &PaymentChannelRefundResult{}, nil
}

func (paymentServiceTestWechatGateway) QueryRefundOrder(context.Context, *model.PaymentOrder, *model.RefundOrder) (*PaymentChannelRefundResult, error) {
	return &PaymentChannelRefundResult{}, nil
}

func setupPaymentServiceTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	db, err := gorm.Open(gormsqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite db: %v", err)
	}

	if err := db.AutoMigrate(
		&model.User{},
		&model.UserWechatBinding{},
		&model.Provider{},
		&model.Booking{},
		&model.Project{},
		&model.Proposal{},
		&model.Order{},
		&model.PaymentPlan{},
		&model.BusinessFlow{},
		&model.Transaction{},
		&model.MerchantIncome{},
		&model.Notification{},
		&model.SystemConfig{},
		&model.PaymentOrder{},
		&model.PaymentCallback{},
		&model.RefundOrder{},
		&model.LedgerAccount{},
		&model.LedgerEntry{},
		&model.MerchantBondRule{},
		&model.MerchantBondAccount{},
		&model.RiskWarning{},
	); err != nil {
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

func enableAlipayForPaymentTests(t *testing.T) {
	t.Helper()

	cfg := config.GetConfig()
	previous := *cfg
	cfg.Alipay.Enabled = true
	cfg.Alipay.AppID = "test-app-id"
	cfg.Alipay.AppPrivateKey = "test-private-key"
	cfg.Alipay.PublicKey = "test-public-key"
	cfg.Alipay.GatewayURL = "https://openapi.alipay.com/gateway.do"
	cfg.Alipay.NotifyURL = "https://server.example.com/api/v1/payments/alipay/notify"
	cfg.Alipay.TimeoutMinutes = 15
	cfg.Server.PublicURL = "https://server.example.com"
	cfg.Alipay.ReturnURLWeb = "https://web.example.com/payments/result"
	cfg.Alipay.ReturnURLH5 = "https://m.example.com/payments/result"
	t.Cleanup(func() {
		*cfg = previous
	})
}

func enableWechatForPaymentTests(t *testing.T) {
	t.Helper()

	cfg := config.GetConfig()
	previous := *cfg
	cfg.WechatPay.AppID = "wx-test-app-id"
	cfg.WechatPay.MchID = "1900000109"
	cfg.WechatPay.SerialNo = "serial-test"
	cfg.WechatPay.PrivateKey = "private-key"
	cfg.WechatPay.APIv3Key = "12345678901234567890123456789012"
	cfg.WechatPay.NotifyURL = "https://server.example.com/api/v1/payments/wechat/notify"
	cfg.WechatMini.AppID = "wx-test-app-id"
	t.Cleanup(func() {
		*cfg = previous
	})
}

func seedPaymentChannelConfigs(t *testing.T, db *gorm.DB, alipayEnabled bool) {
	t.Helper()

	for _, item := range []model.SystemConfig{
		{Key: model.ConfigKeyPaymentChannelWechatEnabled, Value: "false", Type: "bool"},
		{Key: model.ConfigKeyPaymentChannelAlipayEnabled, Value: strconv.FormatBool(alipayEnabled), Type: "bool"},
	} {
		if err := db.Create(&item).Error; err != nil {
			t.Fatalf("seed payment channel config: %v", err)
		}
	}
	(&ConfigService{}).ClearCache()
}

func seedPaymentIntentFixture(t *testing.T, db *gorm.DB) (userID, bookingID uint64) {
	t.Helper()

	user := model.User{Base: model.Base{ID: 1}}
	provider := model.Provider{Base: model.Base{ID: 11}}
	booking := model.Booking{
		Base:       model.Base{ID: 21},
		UserID:     user.ID,
		ProviderID: provider.ID,
		Status:     2,
		IntentFee:  99,
	}

	for _, item := range []any{&user, &provider, &booking} {
		if err := db.Create(item).Error; err != nil {
			t.Fatalf("seed intent fixture: %v", err)
		}
	}

	return user.ID, booking.ID
}

func seedPendingBookingIntentFixture(t *testing.T, db *gorm.DB) (userID, bookingID uint64) {
	t.Helper()

	user := model.User{Base: model.Base{ID: 31}}
	provider := model.Provider{Base: model.Base{ID: 41}}
	booking := model.Booking{
		Base:       model.Base{ID: 51},
		UserID:     user.ID,
		ProviderID: provider.ID,
		Status:     1,
		IntentFee:  199,
	}

	for _, item := range []any{&user, &provider, &booking} {
		if err := db.Create(item).Error; err != nil {
			t.Fatalf("seed pending intent fixture: %v", err)
		}
	}

	return user.ID, booking.ID
}

func seedSurveyDepositFixture(t *testing.T, db *gorm.DB) (userID, bookingID uint64) {
	t.Helper()

	user := model.User{Base: model.Base{ID: 2}}
	provider := model.Provider{Base: model.Base{ID: 12}}
	paidAt := time.Now().Add(-2 * time.Hour)
	booking := model.Booking{
		Base:                model.Base{ID: 22},
		UserID:              user.ID,
		ProviderID:          provider.ID,
		SurveyDeposit:       500,
		SurveyDepositPaid:   true,
		SurveyDepositPaidAt: &paidAt,
		SurveyDepositSource: "alipay",
		SurveyRefundNotice:  "测试退款",
	}
	payment := model.PaymentOrder{
		Base:            model.Base{ID: 301},
		BizType:         model.PaymentBizTypeBookingSurveyDeposit,
		BizID:           booking.ID,
		PayerUserID:     user.ID,
		Channel:         model.PaymentChannelAlipay,
		Scene:           model.PaymentBizTypeBookingSurveyDeposit,
		TerminalType:    model.PaymentTerminalMobileH5,
		Subject:         "量房费",
		Amount:          500,
		OutTradeNo:      "survey-trade-001",
		ProviderTradeNo: "provider-trade-001",
		Status:          model.PaymentStatusPaid,
		PaidAt:          &paidAt,
	}

	for _, item := range []any{&user, &provider, &booking, &payment} {
		if err := db.Create(item).Error; err != nil {
			t.Fatalf("seed survey fixture: %v", err)
		}
	}
	if err := db.Create(&model.SystemConfig{Key: "booking.survey_deposit_refund_rate", Value: "0.6", Type: "number"}).Error; err != nil {
		t.Fatalf("seed survey refund rate: %v", err)
	}

	return user.ID, booking.ID
}

func seedPendingOrderFixture(t *testing.T, db *gorm.DB) (userID, orderID uint64) {
	t.Helper()

	user := model.User{Base: model.Base{ID: 61}}
	project := model.Project{Base: model.Base{ID: 62}, OwnerID: user.ID, Name: "测试项目"}
	order := model.Order{
		Base:        model.Base{ID: 63},
		ProjectID:   project.ID,
		OrderNo:     "ORD-WX-0063",
		OrderType:   model.OrderTypeDesign,
		TotalAmount: 1888,
		Status:      model.OrderStatusPending,
	}

	for _, item := range []any{&user, &project, &order} {
		if err := db.Create(item).Error; err != nil {
			t.Fatalf("seed pending order fixture: %v", err)
		}
	}

	return user.ID, order.ID
}

func seedPendingBookingDesignOrderFixture(t *testing.T, db *gorm.DB) (userID, bookingID, orderID uint64) {
	t.Helper()

	user := model.User{Base: model.Base{ID: 71}}
	provider := model.Provider{Base: model.Base{ID: 72}}
	booking := model.Booking{
		Base:              model.Base{ID: 73},
		UserID:            user.ID,
		ProviderID:        provider.ID,
		Status:            2,
		SurveyDepositPaid: true,
		SurveyDeposit:     500,
	}
	order := model.Order{
		Base:        model.Base{ID: 74},
		BookingID:   booking.ID,
		OrderNo:     "ORD-BOOKING-0074",
		OrderType:   model.OrderTypeDesign,
		TotalAmount: 2888,
		Status:      model.OrderStatusPending,
	}
	flow := model.BusinessFlow{
		Base:               model.Base{ID: 75},
		SourceType:         model.BusinessFlowSourceBooking,
		SourceID:           booking.ID,
		CustomerUserID:     user.ID,
		DesignerProviderID: provider.ID,
		CurrentStage:       model.BusinessFlowStageDesignFeePaying,
	}

	for _, item := range []any{&user, &provider, &booking, &order, &flow} {
		if err := db.Create(item).Error; err != nil {
			t.Fatalf("seed booking design order fixture: %v", err)
		}
	}

	return user.ID, booking.ID, order.ID
}

func seedWechatBinding(t *testing.T, db *gorm.DB, userID uint64, appID string) {
	t.Helper()

	boundAt := time.Now()
	binding := model.UserWechatBinding{
		Base:    model.Base{ID: 91},
		UserID:  userID,
		AppID:   appID,
		OpenID:  "openid-test",
		BoundAt: &boundAt,
	}
	if err := db.Create(&binding).Error; err != nil {
		t.Fatalf("seed wechat binding: %v", err)
	}
}

func seedMerchantBondFixture(t *testing.T, db *gorm.DB) (userID, providerID uint64) {
	t.Helper()

	user := model.User{Base: model.Base{ID: 61}}
	provider := model.Provider{
		Base:         model.Base{ID: 71},
		UserID:       user.ID,
		ProviderType: 1,
		SubType:      "designer",
	}
	rule := model.MerchantBondRule{
		Base:            model.Base{ID: 81},
		ProviderType:    1,
		ProviderSubType: "designer",
		Enabled:         true,
		RuleType:        model.MerchantBondRuleTypeFixedAmount,
		FixedAmount:     3000,
	}

	for _, item := range []any{&user, &provider, &rule} {
		if err := db.Create(item).Error; err != nil {
			t.Fatalf("seed merchant bond fixture: %v", err)
		}
	}

	return user.ID, provider.ID
}

func launchTokenFromURL(t *testing.T, launchURL string) string {
	t.Helper()

	parsed, err := url.Parse(launchURL)
	if err != nil {
		t.Fatalf("parse launch url: %v", err)
	}
	token := parsed.Query().Get("token")
	if token == "" {
		t.Fatalf("launch url missing token: %s", launchURL)
	}
	return token
}

func TestPaymentServiceStartBookingIntentPaymentReusesActiveOrder(t *testing.T) {
	db := setupPaymentServiceTestDB(t)
	enableAlipayForPaymentTests(t)
	userID, bookingID := seedPaymentIntentFixture(t, db)

	svc := NewPaymentService(paymentServiceTestGateway{})
	first, err := svc.StartBookingIntentPayment(userID, bookingID, model.PaymentTerminalPCWeb)
	if err != nil {
		t.Fatalf("StartBookingIntentPayment first: %v", err)
	}
	second, err := svc.StartBookingIntentPayment(userID, bookingID, model.PaymentTerminalPCWeb)
	if err != nil {
		t.Fatalf("StartBookingIntentPayment second: %v", err)
	}

	if first.PaymentID == 0 || second.PaymentID == 0 {
		t.Fatalf("expected payment ids, got first=%+v second=%+v", first, second)
	}
	if first.PaymentID != second.PaymentID {
		t.Fatalf("expected active payment order reuse, got %d and %d", first.PaymentID, second.PaymentID)
	}

	var count int64
	if err := db.Model(&model.PaymentOrder{}).Count(&count).Error; err != nil {
		t.Fatalf("count payment orders: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected one payment order, got %d", count)
	}
}

func TestNormalizePaymentChannelAndTerminalDefaultsByTerminal(t *testing.T) {
	testCases := []struct {
		name         string
		channel      string
		terminalType string
		wantChannel  string
		wantTerminal string
	}{
		{name: "mini wechat uses wechat", terminalType: model.PaymentTerminalMiniWechatJSAPI, wantChannel: model.PaymentChannelWechat, wantTerminal: model.PaymentTerminalMiniWechatJSAPI},
		{name: "mini qr uses alipay", terminalType: model.PaymentTerminalMiniQR, wantChannel: model.PaymentChannelAlipay, wantTerminal: model.PaymentTerminalMiniQR},
		{name: "mobile h5 uses alipay", terminalType: model.PaymentTerminalMobileH5, wantChannel: model.PaymentChannelAlipay, wantTerminal: model.PaymentTerminalMobileH5},
		{name: "pc web uses alipay", terminalType: model.PaymentTerminalPCWeb, wantChannel: model.PaymentChannelAlipay, wantTerminal: model.PaymentTerminalPCWeb},
		{name: "empty terminal falls back pc web alipay", terminalType: "", wantChannel: model.PaymentChannelAlipay, wantTerminal: model.PaymentTerminalPCWeb},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			channel, terminal, err := normalizePaymentChannelAndTerminal(tc.channel, tc.terminalType)
			if err != nil {
				t.Fatalf("normalizePaymentChannelAndTerminal: %v", err)
			}
			if channel != tc.wantChannel || terminal != tc.wantTerminal {
				t.Fatalf("expected %s/%s, got %s/%s", tc.wantChannel, tc.wantTerminal, channel, terminal)
			}
		})
	}
}

func TestPaymentServiceStartBookingIntentPaymentRejectsUnconfirmedBooking(t *testing.T) {
	db := setupPaymentServiceTestDB(t)
	enableAlipayForPaymentTests(t)
	userID, bookingID := seedPendingBookingIntentFixture(t, db)

	svc := NewPaymentService(paymentServiceTestGateway{})
	_, err := svc.StartBookingIntentPayment(userID, bookingID, model.PaymentTerminalPCWeb)
	if err == nil {
		t.Fatalf("expected unconfirmed booking payment to be rejected")
	}
	if err.Error() != "请等待服务商确认预约后再支付量房费" {
		t.Fatalf("unexpected error: %v", err)
	}

	var count int64
	if err := db.Model(&model.PaymentOrder{}).Count(&count).Error; err != nil {
		t.Fatalf("count payment orders: %v", err)
	}
	if count != 0 {
		t.Fatalf("expected no payment order created, got %d", count)
	}
}

func TestPaymentServiceStartSurveyDepositPaymentRejectsUnconfirmedBooking(t *testing.T) {
	db := setupPaymentServiceTestDB(t)
	enableAlipayForPaymentTests(t)
	userID, bookingID := seedPendingBookingIntentFixture(t, db)

	svc := NewPaymentService(paymentServiceTestGateway{})
	_, err := svc.StartSurveyDepositPayment(userID, bookingID, model.PaymentChannelAlipay, model.PaymentTerminalPCWeb)
	if err == nil {
		t.Fatalf("expected unconfirmed survey deposit payment to be rejected")
	}
	if err.Error() != "请等待服务商确认预约后再支付量房费" {
		t.Fatalf("unexpected error: %v", err)
	}

	var count int64
	if err := db.Model(&model.PaymentOrder{}).Count(&count).Error; err != nil {
		t.Fatalf("count payment orders: %v", err)
	}
	if count != 0 {
		t.Fatalf("expected no survey deposit payment order created, got %d", count)
	}
}

func TestPaymentServiceGetSurveyDepositPaymentOptionsReturnsQRCodeForAlipay(t *testing.T) {
	db := setupPaymentServiceTestDB(t)
	enableAlipayForPaymentTests(t)
	seedPaymentChannelConfigs(t, db, true)
	_, bookingID := seedPaymentIntentFixture(t, db)

	var booking model.Booking
	if err := db.First(&booking, bookingID).Error; err != nil {
		t.Fatalf("load booking: %v", err)
	}

	svc := NewPaymentService(paymentServiceTestGateway{})
	options := svc.GetSurveyDepositPaymentOptions(&booking)
	if len(options) != 1 {
		t.Fatalf("expected single payment option, got %+v", options)
	}
	if options[0].Channel != model.PaymentChannelAlipay || options[0].LaunchMode != "qr_code" {
		t.Fatalf("expected alipay qr option, got %+v", options[0])
	}
}

func TestPaymentServiceGetLatestSurveyDepositPaymentIDReturnsLatestPaidRecord(t *testing.T) {
	db := setupPaymentServiceTestDB(t)
	userID, bookingID := seedSurveyDepositFixture(t, db)

	olderPaidAt := time.Now().Add(-4 * time.Hour)
	older := model.PaymentOrder{
		Base:            model.Base{ID: 302},
		BizType:         model.PaymentBizTypeBookingIntent,
		BizID:           bookingID,
		PayerUserID:     userID,
		Channel:         model.PaymentChannelAlipay,
		Scene:           model.PaymentBizTypeBookingIntent,
		FundScene:       model.FundSceneSurveyDeposit,
		TerminalType:    model.PaymentTerminalPCWeb,
		Subject:         "旧量房费",
		Amount:          500,
		OutTradeNo:      "survey-trade-002",
		ProviderTradeNo: "provider-trade-002",
		Status:          model.PaymentStatusPaid,
		PaidAt:          &olderPaidAt,
	}
	if err := db.Create(&older).Error; err != nil {
		t.Fatalf("create older paid payment: %v", err)
	}

	pending := model.PaymentOrder{
		Base:         model.Base{ID: 303},
		BizType:      model.PaymentBizTypeBookingSurveyDeposit,
		BizID:        bookingID,
		PayerUserID:  userID,
		Channel:      model.PaymentChannelAlipay,
		Scene:        model.PaymentBizTypeBookingSurveyDeposit,
		FundScene:    model.FundSceneSurveyDeposit,
		TerminalType: model.PaymentTerminalMiniQR,
		Subject:      "待支付量房费",
		Amount:       500,
		OutTradeNo:   "survey-trade-003",
		Status:       model.PaymentStatusPending,
	}
	if err := db.Create(&pending).Error; err != nil {
		t.Fatalf("create pending payment: %v", err)
	}

	svc := NewPaymentService(paymentServiceTestGateway{})
	paymentID, err := svc.GetLatestSurveyDepositPaymentID(bookingID)
	if err != nil {
		t.Fatalf("GetLatestSurveyDepositPaymentID: %v", err)
	}
	if paymentID != 301 {
		t.Fatalf("expected latest paid payment id 301, got %d", paymentID)
	}
}

func TestPaymentServiceGetSurveyDepositPaymentOptionsFallsBackToQRCodeWhenMiniH5Unavailable(t *testing.T) {
	db := setupPaymentServiceTestDB(t)
	enableAlipayForPaymentTests(t)
	seedPaymentChannelConfigs(t, db, true)
	_, bookingID := seedPaymentIntentFixture(t, db)

	cfg := config.GetConfig()
	cfg.Alipay.ReturnURLH5 = ""

	var booking model.Booking
	if err := db.First(&booking, bookingID).Error; err != nil {
		t.Fatalf("load booking: %v", err)
	}

	svc := NewPaymentService(paymentServiceTestGateway{})
	options := svc.GetSurveyDepositPaymentOptions(&booking)
	if len(options) != 1 {
		t.Fatalf("expected single payment option, got %+v", options)
	}
	if options[0].Channel != model.PaymentChannelAlipay || options[0].LaunchMode != "qr_code" {
		t.Fatalf("expected alipay qr fallback option, got %+v", options[0])
	}
}

func TestPaymentServiceGetSurveyDepositPaymentOptionsFallsBackToQRCodeWhenMiniH5SandboxEnabled(t *testing.T) {
	db := setupPaymentServiceTestDB(t)
	enableAlipayForPaymentTests(t)
	seedPaymentChannelConfigs(t, db, true)
	_, bookingID := seedPaymentIntentFixture(t, db)

	cfg := config.GetConfig()
	cfg.Alipay.Sandbox = true
	cfg.Alipay.GatewayURL = "https://openapi-sandbox.dl.alipaydev.com/gateway.do"

	var booking model.Booking
	if err := db.First(&booking, bookingID).Error; err != nil {
		t.Fatalf("load booking: %v", err)
	}

	svc := NewPaymentService(paymentServiceTestGateway{})
	options := svc.GetSurveyDepositPaymentOptions(&booking)
	if len(options) != 1 {
		t.Fatalf("expected single payment option, got %+v", options)
	}
	if options[0].Channel != model.PaymentChannelAlipay || options[0].LaunchMode != "qr_code" {
		t.Fatalf("expected alipay qr fallback option in sandbox, got %+v", options[0])
	}
}

func TestPaymentServiceStartSurveyDepositPaymentRejectsMiniH5WithoutRuntime(t *testing.T) {
	db := setupPaymentServiceTestDB(t)
	enableAlipayForPaymentTests(t)
	seedPaymentChannelConfigs(t, db, true)
	userID, bookingID := seedPaymentIntentFixture(t, db)

	cfg := config.GetConfig()
	cfg.Alipay.ReturnURLH5 = ""

	svc := NewPaymentService(paymentServiceTestGateway{})
	_, err := svc.StartSurveyDepositPayment(userID, bookingID, model.PaymentChannelAlipay, model.PaymentTerminalMobileH5)
	if err == nil {
		t.Fatal("expected mobile h5 launch to be rejected when runtime config is incomplete")
	}
	if err.Error() == "" {
		t.Fatal("expected explicit runtime config error")
	}
}

func TestPaymentServiceStartSurveyDepositPaymentRejectsMiniH5InSandbox(t *testing.T) {
	db := setupPaymentServiceTestDB(t)
	enableAlipayForPaymentTests(t)
	seedPaymentChannelConfigs(t, db, true)
	userID, bookingID := seedPaymentIntentFixture(t, db)

	cfg := config.GetConfig()
	cfg.Alipay.Sandbox = true
	cfg.Alipay.GatewayURL = "https://openapi-sandbox.dl.alipaydev.com/gateway.do"

	svc := NewPaymentService(paymentServiceTestGateway{})
	_, err := svc.StartSurveyDepositPayment(userID, bookingID, model.PaymentChannelAlipay, model.PaymentTerminalMobileH5)
	if err == nil {
		t.Fatal("expected mobile h5 launch to be rejected in sandbox")
	}
	if err.Error() != "支付宝 H5 沙箱环境不支持小程序真机拉起，请改用二维码支付" {
		t.Fatalf("unexpected sandbox runtime error: %v", err)
	}
}

func TestPaymentServiceBuildLaunchDocumentConsumesToken(t *testing.T) {
	db := setupPaymentServiceTestDB(t)
	enableAlipayForPaymentTests(t)
	userID, bookingID := seedPaymentIntentFixture(t, db)

	svc := NewPaymentService(paymentServiceTestGateway{})
	launch, err := svc.StartBookingIntentPayment(userID, bookingID, model.PaymentTerminalPCWeb)
	if err != nil {
		t.Fatalf("StartBookingIntentPayment: %v", err)
	}

	html, err := svc.BuildLaunchDocument(launch.PaymentID, launchTokenFromURL(t, launch.LaunchURL))
	if err != nil {
		t.Fatalf("BuildLaunchDocument: %v", err)
	}
	if html != "<html>redirect</html>" {
		t.Fatalf("unexpected launch html: %s", html)
	}

	var payment model.PaymentOrder
	if err := db.First(&payment, launch.PaymentID).Error; err != nil {
		t.Fatalf("reload payment: %v", err)
	}
	if payment.Status != model.PaymentStatusPending {
		t.Fatalf("expected pending payment after launch, got %+v", payment)
	}
	if payment.LaunchTokenHash != "" || payment.LaunchTokenExpiredAt != nil {
		t.Fatalf("expected launch token to be consumed, got %+v", payment)
	}
}

func TestPaymentServiceStartSurveyDepositPaymentReturnsQRCodeLaunch(t *testing.T) {
	db := setupPaymentServiceTestDB(t)
	enableAlipayForPaymentTests(t)
	userID, bookingID := seedPaymentIntentFixture(t, db)

	svc := NewPaymentService(paymentServiceTestGateway{})
	launch, err := svc.StartSurveyDepositPayment(userID, bookingID, model.PaymentChannelAlipay, model.PaymentTerminalMiniQR)
	if err != nil {
		t.Fatalf("StartSurveyDepositPayment: %v", err)
	}
	if launch.LaunchMode != "qr_code" {
		t.Fatalf("expected qr_code launch mode, got %+v", launch)
	}
	if launch.QRCodeImageURL == "" {
		t.Fatalf("expected qrCodeImageUrl, got %+v", launch)
	}
	token := launchTokenFromURL(t, launch.QRCodeImageURL)
	png, err := svc.BuildQRCodeImage(launch.PaymentID, token)
	if err != nil {
		t.Fatalf("BuildQRCodeImage: %v", err)
	}
	if string(png) != "png" {
		t.Fatalf("unexpected qr image payload: %q", string(png))
	}

	var payment model.PaymentOrder
	if err := db.First(&payment, launch.PaymentID).Error; err != nil {
		t.Fatalf("reload payment: %v", err)
	}
	if payment.Status != model.PaymentStatusPending {
		t.Fatalf("expected pending payment after qr generation, got %+v", payment)
	}
	if payment.TerminalType != model.PaymentTerminalMiniQR {
		t.Fatalf("unexpected terminal type: %+v", payment)
	}
}

func TestPaymentServiceStartSurveyDepositPaymentReturnsRedirectLaunchForMobileH5(t *testing.T) {
	db := setupPaymentServiceTestDB(t)
	enableAlipayForPaymentTests(t)
	userID, bookingID := seedPaymentIntentFixture(t, db)

	svc := NewPaymentService(paymentServiceTestGateway{})
	launch, err := svc.StartSurveyDepositPayment(userID, bookingID, model.PaymentChannelAlipay, model.PaymentTerminalMobileH5)
	if err != nil {
		t.Fatalf("StartSurveyDepositPayment: %v", err)
	}
	if launch.LaunchMode != "redirect" {
		t.Fatalf("expected redirect launch mode, got %+v", launch)
	}
	if launch.LaunchURL == "" {
		t.Fatalf("expected launchUrl, got %+v", launch)
	}
}

func TestPaymentServiceResolveReturnURLUsesConfiguredWebAndH5Targets(t *testing.T) {
	db := setupPaymentServiceTestDB(t)
	enableAlipayForPaymentTests(t)
	userID, bookingID := seedPaymentIntentFixture(t, db)

	svc := NewPaymentService(paymentServiceTestGateway{})
	launch, err := svc.StartSurveyDepositPayment(userID, bookingID, model.PaymentChannelAlipay, model.PaymentTerminalMobileH5)
	if err != nil {
		t.Fatalf("StartSurveyDepositPayment: %v", err)
	}

	h5URL, err := svc.ResolveReturnURL(launch.PaymentID, model.PaymentTerminalMobileH5)
	if err != nil {
		t.Fatalf("ResolveReturnURL mobile_h5: %v", err)
	}
	parsedH5URL, err := url.Parse(h5URL)
	if err != nil {
		t.Fatalf("parse h5 return url: %v", err)
	}
	if parsedH5URL.Scheme != "https" || parsedH5URL.Host != "m.example.com" || parsedH5URL.Path != "/payments/result" {
		t.Fatalf("unexpected h5 return target: %s", h5URL)
	}
	if parsedH5URL.Query().Get("paymentId") != strconv.FormatUint(launch.PaymentID, 10) {
		t.Fatalf("unexpected h5 paymentId: %s", h5URL)
	}
	if parsedH5URL.Query().Get("next") != "/bookings/"+strconv.FormatUint(bookingID, 10) {
		t.Fatalf("unexpected h5 next path: %s", h5URL)
	}

	webURL, err := svc.ResolveReturnURL(launch.PaymentID, model.PaymentTerminalPCWeb)
	if err != nil {
		t.Fatalf("ResolveReturnURL pc_web: %v", err)
	}
	parsedWebURL, err := url.Parse(webURL)
	if err != nil {
		t.Fatalf("parse web return url: %v", err)
	}
	if parsedWebURL.Scheme != "https" || parsedWebURL.Host != "web.example.com" || parsedWebURL.Path != "/payments/result" {
		t.Fatalf("unexpected web return target: %s", webURL)
	}
	if parsedWebURL.Query().Get("paymentId") != strconv.FormatUint(launch.PaymentID, 10) {
		t.Fatalf("unexpected web paymentId: %s", webURL)
	}
	if parsedWebURL.Query().Get("next") != "/bookings/"+strconv.FormatUint(bookingID, 10) {
		t.Fatalf("unexpected web next path: %s", webURL)
	}
}

func TestPaymentServiceGetSurveyDepositPaymentOptionsPrefersAlipayQRCode(t *testing.T) {
	db := setupPaymentServiceTestDB(t)
	enableAlipayForPaymentTests(t)
	_, bookingID := seedPaymentIntentFixture(t, db)

	var booking model.Booking
	if err := db.First(&booking, bookingID).Error; err != nil {
		t.Fatalf("load booking: %v", err)
	}

	svc := NewPaymentService(paymentServiceTestGateway{})
	options := svc.GetSurveyDepositPaymentOptions(&booking)
	if len(options) != 1 {
		t.Fatalf("expected one payment option, got %+v", options)
	}
	if options[0].Channel != model.PaymentChannelAlipay || options[0].LaunchMode != "qr_code" {
		t.Fatalf("expected alipay qr option, got %+v", options[0])
	}
}

func TestPaymentServiceGetSurveyDepositPaymentOptionsFallsBackToQRCodeWhenH5Unavailable(t *testing.T) {
	db := setupPaymentServiceTestDB(t)
	enableAlipayForPaymentTests(t)
	_, bookingID := seedPaymentIntentFixture(t, db)

	cfg := config.GetConfig()
	previous := cfg.Alipay.ReturnURLH5
	cfg.Alipay.ReturnURLH5 = ""
	t.Cleanup(func() {
		cfg.Alipay.ReturnURLH5 = previous
	})

	var booking model.Booking
	if err := db.First(&booking, bookingID).Error; err != nil {
		t.Fatalf("load booking: %v", err)
	}

	svc := NewPaymentService(paymentServiceTestGateway{})
	options := svc.GetSurveyDepositPaymentOptions(&booking)
	if len(options) != 1 {
		t.Fatalf("expected one payment option, got %+v", options)
	}
	if options[0].Channel != model.PaymentChannelAlipay || options[0].LaunchMode != "qr_code" {
		t.Fatalf("expected alipay qr_code option, got %+v", options[0])
	}
}

func TestPaymentServiceStartMerchantBondPaymentAndNotifySyncsBondAccount(t *testing.T) {
	db := setupPaymentServiceTestDB(t)
	enableAlipayForPaymentTests(t)
	userID, providerID := seedMerchantBondFixture(t, db)

	svc := NewPaymentService(paymentServiceTestGateway{})

	launch, err := svc.StartMerchantBondPayment(userID, providerID, model.PaymentTerminalPCWeb, "https://merchant.example.com/merchant/payments/result")
	if err != nil {
		t.Fatalf("StartMerchantBondPayment: %v", err)
	}
	if launch.PaymentID == 0 {
		t.Fatalf("expected payment id, got %+v", launch)
	}

	var payment model.PaymentOrder
	if err := db.First(&payment, launch.PaymentID).Error; err != nil {
		t.Fatalf("load payment: %v", err)
	}
	if payment.BizType != model.PaymentBizTypeMerchantBond || payment.FundScene != model.FundSceneMerchantDeposit {
		t.Fatalf("unexpected payment order: %+v", payment)
	}

	notifyValues := url.Values{}
	notifyValues.Set("out_trade_no", payment.OutTradeNo)
	notifyValues.Set("trade_status", alipayTradeSuccess)
	notifyValues.Set("notify_id", "notify-bond-001")
	notifyValues.Set("trade_no", "trade-bond-001")
	if err := svc.HandleAlipayNotify(notifyValues); err != nil {
		t.Fatalf("HandleAlipayNotify: %v", err)
	}

	var account model.MerchantBondAccount
	if err := db.Where("provider_id = ?", providerID).First(&account).Error; err != nil {
		t.Fatalf("load bond account: %v", err)
	}
	if account.RequiredAmount != 3000 || account.PaidAmount != 3000 || account.FrozenAmount != 3000 || account.AvailableAmount != 0 {
		t.Fatalf("unexpected bond account: %+v", account)
	}
	if account.Status != model.MerchantBondAccountStatusActive {
		t.Fatalf("expected active bond account, got %+v", account)
	}

	var ledgerCount int64
	if err := db.Model(&model.LedgerEntry{}).Where("fund_scene = ?", model.FundSceneMerchantDeposit).Count(&ledgerCount).Error; err != nil {
		t.Fatalf("count ledger entries: %v", err)
	}
	if ledgerCount != 1 {
		t.Fatalf("expected one merchant bond ledger entry, got %d", ledgerCount)
	}

	status, err := svc.GetPaymentStatusForPayer(payment.ID, userID)
	if err != nil {
		t.Fatalf("GetPaymentStatusForPayer: %v", err)
	}
	if status.Status != model.PaymentStatusPaid {
		t.Fatalf("expected paid status, got %+v", status)
	}
	if got := status.ReturnContext["returnBaseUrl"]; got != "https://merchant.example.com/merchant/payments/result" {
		t.Fatalf("unexpected return base url: %#v", got)
	}
}

func TestPaymentServiceHandleAlipayNotifyIsIdempotent(t *testing.T) {
	db := setupPaymentServiceTestDB(t)
	enableAlipayForPaymentTests(t)
	userID, bookingID := seedPaymentIntentFixture(t, db)

	payment := model.PaymentOrder{
		Base:         model.Base{ID: 401},
		BizType:      model.PaymentBizTypeBookingIntent,
		BizID:        bookingID,
		PayerUserID:  userID,
		Channel:      model.PaymentChannelAlipay,
		Scene:        model.PaymentBizTypeBookingIntent,
		TerminalType: model.PaymentTerminalPCWeb,
		Subject:      "量房费",
		Amount:       99,
		OutTradeNo:   "intent-trade-001",
		Status:       model.PaymentStatusPending,
	}
	if err := db.Create(&payment).Error; err != nil {
		t.Fatalf("create payment order: %v", err)
	}

	svc := NewPaymentService(paymentServiceTestGateway{
		notifyPayload: map[string]string{
			"out_trade_no": "intent-trade-001",
			"trade_status": alipayTradeSuccess,
			"notify_id":    "notify-001",
			"trade_no":     "trade-001",
		},
	})

	if err := svc.HandleAlipayNotify(url.Values{}); err != nil {
		t.Fatalf("HandleAlipayNotify first: %v", err)
	}
	if err := svc.HandleAlipayNotify(url.Values{}); err != nil {
		t.Fatalf("HandleAlipayNotify second: %v", err)
	}

	var booking model.Booking
	if err := db.First(&booking, bookingID).Error; err != nil {
		t.Fatalf("reload booking: %v", err)
	}
	if !booking.IntentFeePaid || booking.MerchantResponseDeadline == nil {
		t.Fatalf("expected intent fee paid booking, got %+v", booking)
	}

	var updated model.PaymentOrder
	if err := db.First(&updated, payment.ID).Error; err != nil {
		t.Fatalf("reload payment: %v", err)
	}
	if updated.Status != model.PaymentStatusPaid || updated.ProviderTradeNo != "trade-001" {
		t.Fatalf("expected paid payment, got %+v", updated)
	}

	var callbackCount int64
	if err := db.Model(&model.PaymentCallback{}).Count(&callbackCount).Error; err != nil {
		t.Fatalf("count callbacks: %v", err)
	}
	if callbackCount != 1 {
		t.Fatalf("expected one callback record, got %d", callbackCount)
	}
}

func TestPaymentServiceHandleAlipayNotifyCreatesUserPaidReceipt(t *testing.T) {
	db := setupPaymentServiceTestDB(t)
	enableAlipayForPaymentTests(t)
	userID, _, orderID := seedPendingBookingDesignOrderFixture(t, db)

	payment := model.PaymentOrder{
		Base:         model.Base{ID: 402},
		BizType:      model.PaymentBizTypeOrder,
		BizID:        orderID,
		PayerUserID:  userID,
		Channel:      model.PaymentChannelAlipay,
		Scene:        model.PaymentBizTypeOrder,
		TerminalType: model.PaymentTerminalPCWeb,
		Subject:      "设计费订单",
		Amount:       2888,
		OutTradeNo:   "design-order-trade-001",
		Status:       model.PaymentStatusPending,
	}
	if err := db.Create(&payment).Error; err != nil {
		t.Fatalf("create payment order: %v", err)
	}

	svc := NewPaymentService(paymentServiceTestGateway{
		notifyPayload: map[string]string{
			"out_trade_no": "design-order-trade-001",
			"trade_status": alipayTradeSuccess,
			"notify_id":    "notify-order-001",
			"trade_no":     "trade-order-001",
		},
	})

	if err := svc.HandleAlipayNotify(url.Values{}); err != nil {
		t.Fatalf("HandleAlipayNotify: %v", err)
	}

	var notification model.Notification
	if err := db.Where("user_id = ? AND type = ?", userID, NotificationTypePaymentOrderPaid).Order("id DESC").First(&notification).Error; err != nil {
		t.Fatalf("expected user paid receipt notification: %v", err)
	}
	if notification.RelatedID != orderID || notification.RelatedType != "order" {
		t.Fatalf("unexpected paid receipt relation: %+v", notification)
	}
	if notification.ActionURL != "/orders/"+strconv.FormatUint(orderID, 10) {
		t.Fatalf("unexpected paid receipt action url: %+v", notification)
	}
	if notification.Title != "支付成功" || notification.Content == "" {
		t.Fatalf("unexpected paid receipt copy: %+v", notification)
	}
}

func TestPaymentServiceGetPaymentDetailForUser(t *testing.T) {
	db := setupPaymentServiceTestDB(t)

	user := model.User{Base: model.Base{ID: 801}, Phone: "13800138801", Status: 1}
	providerUser := model.User{Base: model.Base{ID: 802}, Phone: "13800138802", Nickname: "张明远", Avatar: "/uploads/provider-user.png", Status: 1}
	provider := model.Provider{
		Base:         model.Base{ID: 803},
		UserID:       providerUser.ID,
		ProviderType: 1,
		SubType:      "designer",
		CompanyName:  "明远设计工作室",
		Avatar:       "/uploads/provider-card.png",
		Verified:     true,
	}
	booking := model.Booking{
		Base:         model.Base{ID: 804},
		UserID:       user.ID,
		ProviderID:   provider.ID,
		ProviderType: "designer",
		Address:      "西安市新城区幸福南路 88 号",
		Status:       2,
	}
	paidAt := time.Now().Add(-90 * time.Minute).UTC()
	payment := model.PaymentOrder{
		Base:            model.Base{ID: 805},
		BizType:         model.PaymentBizTypeBookingSurveyDeposit,
		BizID:           booking.ID,
		PayerUserID:     user.ID,
		Channel:         model.PaymentChannelAlipay,
		Scene:           model.PaymentBizTypeBookingSurveyDeposit,
		FundScene:       model.FundSceneSurveyDeposit,
		TerminalType:    model.PaymentTerminalPCWeb,
		Subject:         "量房费 #804",
		Amount:          500,
		OutTradeNo:      "BOOKINGSURVEY-804-001",
		ProviderTradeNo: "202603260001",
		Status:          model.PaymentStatusPaid,
		PaidAt:          &paidAt,
		ReturnContext:   `{"successPath":"/bookings/804","cancelPath":"/bookings/804","bizType":"booking_survey_deposit","bizId":804}`,
	}

	for _, item := range []any{&user, &providerUser, &provider, &booking, &payment} {
		if err := db.Create(item).Error; err != nil {
			t.Fatalf("seed payment detail fixture: %v", err)
		}
	}

	svc := NewPaymentService(paymentServiceTestGateway{})
	detail, err := svc.GetPaymentDetailForUser(payment.ID, user.ID)
	if err != nil {
		t.Fatalf("GetPaymentDetailForUser: %v", err)
	}

	if detail.Status != model.PaymentStatusPaid || detail.StatusText != "已支付" {
		t.Fatalf("unexpected payment status detail: %+v", detail)
	}
	if detail.ChannelText != "支付宝" || detail.TerminalTypeText != "网页端" {
		t.Fatalf("unexpected payment channel detail: %+v", detail)
	}
	if detail.PurposeText != "量房费 #804" || detail.FundSceneText != "量房费" {
		t.Fatalf("unexpected purpose detail: %+v", detail)
	}
	if detail.ActionPath != "/bookings/804" {
		t.Fatalf("expected booking action path, got %+v", detail)
	}
	if detail.ReferenceLabel != "预约编号" || detail.ReferenceNo != "BK00000804" {
		t.Fatalf("unexpected reference detail: %+v", detail)
	}
	if detail.Booking == nil || detail.Booking.Address != "西安市新城区幸福南路 88 号" {
		t.Fatalf("unexpected booking detail: %+v", detail.Booking)
	}
	if detail.Provider == nil {
		t.Fatalf("expected provider detail, got nil")
	}
	if detail.Provider.Name != "张明远" || detail.Provider.RoleText != "设计师" || !detail.Provider.Verified {
		t.Fatalf("unexpected provider detail: %+v", detail.Provider)
	}
	if detail.Provider.Avatar != "http://localhost:8080/uploads/provider-user.png" {
		t.Fatalf("expected provider avatar from user profile, got %+v", detail.Provider)
	}
	if detail.ProviderTradeNo != "202603260001" || detail.OutTradeNo != "BOOKINGSURVEY-804-001" {
		t.Fatalf("unexpected trade numbers: %+v", detail)
	}
	if detail.UsageDescription == "" {
		t.Fatalf("expected usage description, got %+v", detail)
	}
}

func TestPaymentServiceGetPaymentStatusForUserReturnsScanPendingAfterAlipayScan(t *testing.T) {
	db := setupPaymentServiceTestDB(t)

	user := model.User{Base: model.Base{ID: 901}, Phone: "13800138901", Status: 1}
	payment := model.PaymentOrder{
		Base:         model.Base{ID: 902},
		BizType:      model.PaymentBizTypeOrder,
		BizID:        903,
		PayerUserID:  user.ID,
		Channel:      model.PaymentChannelAlipay,
		FundScene:    model.FundSceneDesignFee,
		TerminalType: model.PaymentTerminalPCWeb,
		Subject:      "订单支付 #DF202604120001",
		Amount:       4500,
		OutTradeNo:   "ORDER-902",
		Status:       model.PaymentStatusPending,
	}

	for _, item := range []any{&user, &payment} {
		if err := db.Create(item).Error; err != nil {
			t.Fatalf("seed scan pending fixture: %v", err)
		}
	}

	previousFactory := paymentChannelServiceFactory
	paymentChannelServiceFactory = func() map[string]PaymentChannelService {
		return map[string]PaymentChannelService{
			model.PaymentChannelAlipay: paymentServiceTestGateway{
				queryTradeResult: &AlipayTradeQueryResult{
					TradeNo:      "2026041200000001",
					TradeStatus:  alipayTradeWaitBuyerPay,
					BuyerLogonID: "buyer@example.com",
					RawJSON:      `{"trade_status":"WAIT_BUYER_PAY","trade_no":"2026041200000001","buyer_logon_id":"buyer@example.com"}`,
				},
			},
		}
	}
	t.Cleanup(func() {
		paymentChannelServiceFactory = previousFactory
	})

	svc := NewPaymentService(nil)
	status, err := svc.GetPaymentStatusForUser(payment.ID, user.ID)
	if err != nil {
		t.Fatalf("GetPaymentStatusForUser: %v", err)
	}

	if status.Status != model.PaymentStatusScanPending || status.StatusText != "已扫码待支付" {
		t.Fatalf("expected scan pending status, got %+v", status)
	}

	var stored model.PaymentOrder
	if err := db.First(&stored, payment.ID).Error; err != nil {
		t.Fatalf("load stored payment: %v", err)
	}
	if stored.Status != model.PaymentStatusScanPending || stored.ProviderTradeNo != "2026041200000001" {
		t.Fatalf("expected stored payment updated to scan pending, got %+v", stored)
	}
}

func TestPaymentServiceGetPaymentStatusForUserSyncsPaidFromScanPending(t *testing.T) {
	db := setupPaymentServiceTestDB(t)

	user := model.User{Base: model.Base{ID: 911}, Phone: "13800138911", Status: 1}
	order := model.Order{
		Base:        model.Base{ID: 913},
		OrderNo:     "ORD-913",
		OrderType:   model.OrderTypeDesign,
		TotalAmount: 4500,
		Status:      model.OrderStatusPending,
	}
	payment := model.PaymentOrder{
		Base:            model.Base{ID: 912},
		BizType:         model.PaymentBizTypeOrder,
		BizID:           order.ID,
		PayerUserID:     user.ID,
		Channel:         model.PaymentChannelAlipay,
		FundScene:       model.FundSceneDesignFee,
		TerminalType:    model.PaymentTerminalMiniQR,
		Subject:         "订单支付 #DF202604120009",
		Amount:          4500,
		OutTradeNo:      "ORDER-912",
		ProviderTradeNo: "2026041200000001",
		Status:          model.PaymentStatusScanPending,
	}

	for _, item := range []any{&user, &order, &payment} {
		if err := db.Create(item).Error; err != nil {
			t.Fatalf("seed paid-from-scan fixture: %v", err)
		}
	}

	previousFactory := paymentChannelServiceFactory
	paymentChannelServiceFactory = func() map[string]PaymentChannelService {
		return map[string]PaymentChannelService{
			model.PaymentChannelAlipay: paymentServiceTestGateway{
				queryTradeResult: &AlipayTradeQueryResult{
					TradeNo:     "2026041200000001",
					TradeStatus: alipayTradeSuccess,
					BuyerAmount: 4500,
					RawJSON:     `{"trade_status":"TRADE_SUCCESS","trade_no":"2026041200000001"}`,
				},
			},
		}
	}
	t.Cleanup(func() {
		paymentChannelServiceFactory = previousFactory
	})

	svc := NewPaymentService(nil)
	status, err := svc.GetPaymentStatusForUser(payment.ID, user.ID)
	if err != nil {
		t.Fatalf("GetPaymentStatusForUser: %v", err)
	}
	if status.Status != model.PaymentStatusPaid || status.StatusText != "已支付" {
		t.Fatalf("expected paid status, got %+v", status)
	}

	var stored model.PaymentOrder
	if err := db.First(&stored, payment.ID).Error; err != nil {
		t.Fatalf("load stored payment: %v", err)
	}
	if stored.Status != model.PaymentStatusPaid {
		t.Fatalf("expected stored payment updated to paid, got %+v", stored)
	}
}

func TestPaymentServiceGetPaymentDetailForUserSyncsPaidFromScanPending(t *testing.T) {
	db := setupPaymentServiceTestDB(t)

	user := model.User{Base: model.Base{ID: 921}, Phone: "13800138921", Status: 1}
	order := model.Order{
		Base:        model.Base{ID: 923},
		OrderNo:     "ORD-923",
		OrderType:   model.OrderTypeDesign,
		TotalAmount: 5200,
		Status:      model.OrderStatusPending,
	}
	payment := model.PaymentOrder{
		Base:            model.Base{ID: 922},
		BizType:         model.PaymentBizTypeOrder,
		BizID:           order.ID,
		PayerUserID:     user.ID,
		Channel:         model.PaymentChannelAlipay,
		FundScene:       model.FundSceneDesignFee,
		TerminalType:    model.PaymentTerminalMiniQR,
		Subject:         "订单支付 #DF202604120010",
		Amount:          5200,
		OutTradeNo:      "ORDER-922",
		ProviderTradeNo: "2026041200000002",
		Status:          model.PaymentStatusScanPending,
	}

	for _, item := range []any{&user, &order, &payment} {
		if err := db.Create(item).Error; err != nil {
			t.Fatalf("seed detail-from-scan fixture: %v", err)
		}
	}

	previousFactory := paymentChannelServiceFactory
	paymentChannelServiceFactory = func() map[string]PaymentChannelService {
		return map[string]PaymentChannelService{
			model.PaymentChannelAlipay: paymentServiceTestGateway{
				queryTradeResult: &AlipayTradeQueryResult{
					TradeNo:     "2026041200000002",
					TradeStatus: alipayTradeSuccess,
					BuyerAmount: 5200,
					RawJSON:     `{"trade_status":"TRADE_SUCCESS","trade_no":"2026041200000002"}`,
				},
			},
		}
	}
	t.Cleanup(func() {
		paymentChannelServiceFactory = previousFactory
	})

	svc := NewPaymentService(nil)
	detail, err := svc.GetPaymentDetailForUser(payment.ID, user.ID)
	if err != nil {
		t.Fatalf("GetPaymentDetailForUser: %v", err)
	}
	if detail.Status != model.PaymentStatusPaid || detail.StatusText != "已支付" {
		t.Fatalf("expected paid detail, got %+v", detail)
	}
}

func TestDesignPaymentServiceRefundSurveyDepositCreatesTrueRefund(t *testing.T) {
	db := setupPaymentServiceTestDB(t)
	enableAlipayForPaymentTests(t)
	userID, bookingID := seedSurveyDepositFixture(t, db)

	previousGatewayFactory := paymentChannelServiceFactory
	paymentChannelServiceFactory = func() map[string]PaymentChannelService {
		return map[string]PaymentChannelService{
			model.PaymentChannelAlipay: paymentServiceTestGateway{},
		}
	}
	t.Cleanup(func() {
		paymentChannelServiceFactory = previousGatewayFactory
	})

	message, err := (&DesignPaymentService{}).RefundSurveyDeposit(userID, bookingID)
	if err != nil {
		t.Fatalf("RefundSurveyDeposit: %v", err)
	}
	if message != "量房费退款成功" {
		t.Fatalf("expected success message, got %q", message)
	}

	var booking model.Booking
	if err := db.First(&booking, bookingID).Error; err != nil {
		t.Fatalf("reload booking: %v", err)
	}
	if !booking.SurveyDepositRefunded || booking.SurveyDepositRefundAmt != 300 || booking.SurveyDepositRefundAt == nil {
		t.Fatalf("expected refunded booking, got %+v", booking)
	}

	var refund model.RefundOrder
	if err := db.First(&refund).Error; err != nil {
		t.Fatalf("load refund order: %v", err)
	}
	if refund.Status != model.RefundOrderStatusSucceeded || refund.Amount != 300 {
		t.Fatalf("expected succeeded refund order, got %+v", refund)
	}

	var refundTxn model.Transaction
	if err := db.Where("remark = ?", "survey_deposit_refund").First(&refundTxn).Error; err != nil {
		t.Fatalf("load refund transaction: %v", err)
	}
	if refundTxn.Amount != 300 || refundTxn.CompletedAt == nil {
		t.Fatalf("expected completed refund transaction, got %+v", refundTxn)
	}

	var income model.MerchantIncome
	if err := db.Where("booking_id = ?", bookingID).First(&income).Error; err != nil {
		t.Fatalf("load merchant income: %v", err)
	}
	if income.Type != "survey_deposit" || income.Amount != 200 || income.NetAmount != 200 {
		t.Fatalf("expected survey deposit income, got %+v", income)
	}
}

func TestPaymentServiceSyncPendingRefundOrdersFinalizesSurveyDeposit(t *testing.T) {
	db := setupPaymentServiceTestDB(t)
	enableAlipayForPaymentTests(t)
	userID, bookingID := seedSurveyDepositFixture(t, db)

	previousGatewayFactory := paymentChannelServiceFactory
	paymentChannelServiceFactory = func() map[string]PaymentChannelService {
		return map[string]PaymentChannelService{
			model.PaymentChannelAlipay: paymentServiceTestGateway{
				refundResult: &AlipayRefundResult{
					TradeNo:     "TRADE-PENDING",
					OutTradeNo:  "survey-trade-001",
					OutRefundNo: "RF-PENDING",
					Pending:     true,
					RawJSON:     `{"code":"10000","pending":true}`,
				},
				queryRefundResult: &AlipayRefundResult{
					TradeNo:     "TRADE-SUCCESS",
					OutTradeNo:  "survey-trade-001",
					OutRefundNo: "RF-PENDING",
					Success:     true,
					RawJSON:     `{"code":"10000","refund_amount":"300.00"}`,
				},
			},
		}
	}
	t.Cleanup(func() {
		paymentChannelServiceFactory = previousGatewayFactory
	})

	message, err := (&DesignPaymentService{}).RefundSurveyDeposit(userID, bookingID)
	if err != nil {
		t.Fatalf("RefundSurveyDeposit pending: %v", err)
	}
	if message != "量房费退款处理中，请稍后确认" {
		t.Fatalf("expected pending message, got %q", message)
	}

	var booking model.Booking
	if err := db.First(&booking, bookingID).Error; err != nil {
		t.Fatalf("reload booking before sync: %v", err)
	}
	if booking.SurveyDepositRefunded {
		t.Fatalf("expected booking not finalized before sync, got %+v", booking)
	}

	count, err := NewPaymentService(nil).SyncPendingRefundOrders(10)
	if err != nil {
		t.Fatalf("SyncPendingRefundOrders: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected one synced refund order, got %d", count)
	}

	if err := db.First(&booking, bookingID).Error; err != nil {
		t.Fatalf("reload booking after sync: %v", err)
	}
	if !booking.SurveyDepositRefunded || booking.SurveyDepositRefundAmt != 300 {
		t.Fatalf("expected finalized survey deposit refund, got %+v", booking)
	}

	var refundTxnCount int64
	if err := db.Model(&model.Transaction{}).Where("remark = ?", "survey_deposit_refund").Count(&refundTxnCount).Error; err != nil {
		t.Fatalf("count refund transactions: %v", err)
	}
	if refundTxnCount != 1 {
		t.Fatalf("expected one refund transaction after sync, got %d", refundTxnCount)
	}
}

func TestPaymentServiceStartOrderPaymentSupportsMiniWechatJSAPI(t *testing.T) {
	db := setupPaymentServiceTestDB(t)
	enableWechatForPaymentTests(t)
	userID, orderID := seedPendingOrderFixture(t, db)
	seedWechatBinding(t, db, userID, "wx-test-app-id")
	for _, item := range []model.SystemConfig{
		{Key: model.ConfigKeyPaymentChannelWechatEnabled, Value: "true", Type: "bool"},
		{Key: model.ConfigKeyPaymentChannelAlipayEnabled, Value: "false", Type: "bool"},
	} {
		if err := db.Create(&item).Error; err != nil {
			t.Fatalf("seed wechat payment config: %v", err)
		}
	}
	(&ConfigService{}).ClearCache()

	svc := NewPaymentServiceWithChannels(map[string]PaymentChannelService{
		model.PaymentChannelWechat: paymentServiceTestWechatGateway{},
	})

	launch, err := svc.StartOrderPayment(userID, orderID, model.PaymentChannelWechat, model.PaymentTerminalMiniWechatJSAPI)
	if err != nil {
		t.Fatalf("StartOrderPayment wechat: %v", err)
	}
	if launch.Channel != model.PaymentChannelWechat {
		t.Fatalf("expected wechat channel, got %+v", launch)
	}
	if launch.LaunchMode != "wechat_jsapi" {
		t.Fatalf("expected wechat_jsapi launch, got %+v", launch)
	}
	if launch.WechatPayParams == nil || launch.WechatPayParams.Package == "" {
		t.Fatalf("expected wechat pay params, got %+v", launch.WechatPayParams)
	}
}

func TestPaymentServiceStartOrderPaymentSupportsBookingLinkedDesignOrder(t *testing.T) {
	db := setupPaymentServiceTestDB(t)
	enableAlipayForPaymentTests(t)
	seedPaymentChannelConfigs(t, db, true)
	userID, _, orderID := seedPendingBookingDesignOrderFixture(t, db)

	svc := NewPaymentService(paymentServiceTestGateway{})
	launch, err := svc.StartOrderPayment(userID, orderID, model.PaymentChannelAlipay, model.PaymentTerminalMiniQR)
	if err != nil {
		t.Fatalf("StartOrderPayment booking-linked design order: %v", err)
	}
	if launch.PaymentID == 0 {
		t.Fatalf("expected payment launch response with payment id, got %+v", launch)
	}
	if launch.LaunchMode != "qr_code" {
		t.Fatalf("expected qr_code launch for web qr payment, got %+v", launch)
	}
}

func TestConfirmOrderPaidTxAdvancesBookingDesignFlowToDeliveryPending(t *testing.T) {
	db := setupPaymentServiceTestDB(t)
	_, bookingID, orderID := seedPendingBookingDesignOrderFixture(t, db)

	tx := db.Begin()
	effect, err := confirmOrderPaidTx(tx, orderID)
	if err != nil {
		tx.Rollback()
		t.Fatalf("confirmOrderPaidTx: %v", err)
	}
	if err := tx.Commit().Error; err != nil {
		t.Fatalf("commit confirmOrderPaidTx: %v", err)
	}

	if effect == nil || effect.BookingID != bookingID {
		t.Fatalf("expected payment side effect to bind booking %d, got %+v", bookingID, effect)
	}

	var order model.Order
	if err := db.First(&order, orderID).Error; err != nil {
		t.Fatalf("reload order: %v", err)
	}
	if order.Status != model.OrderStatusPaid {
		t.Fatalf("expected order paid, got status=%d", order.Status)
	}

	var flow model.BusinessFlow
	if err := db.Where("source_type = ? AND source_id = ?", model.BusinessFlowSourceBooking, bookingID).First(&flow).Error; err != nil {
		t.Fatalf("reload business flow: %v", err)
	}
	if flow.CurrentStage != model.BusinessFlowStageDesignDeliveryPending {
		t.Fatalf("expected booking flow advanced to %s, got %s", model.BusinessFlowStageDesignDeliveryPending, flow.CurrentStage)
	}
}

func TestConfirmOrderPaidTxSyncsPendingPaymentPlans(t *testing.T) {
	db := setupPaymentServiceTestDB(t)
	_, _, orderID := seedPendingBookingDesignOrderFixture(t, db)

	plan := model.PaymentPlan{
		Base:    model.Base{ID: 176},
		OrderID: orderID,
		Type:    "onetime",
		Seq:     1,
		Name:    "设计费",
		Amount:  2888,
		Status:  model.PaymentPlanStatusPending,
	}
	if err := db.Create(&plan).Error; err != nil {
		t.Fatalf("seed payment plan: %v", err)
	}

	if err := db.Transaction(func(tx *gorm.DB) error {
		_, err := confirmOrderPaidTx(tx, orderID)
		return err
	}); err != nil {
		t.Fatalf("confirmOrderPaidTx: %v", err)
	}

	var refreshed model.PaymentPlan
	if err := db.First(&refreshed, plan.ID).Error; err != nil {
		t.Fatalf("reload payment plan: %v", err)
	}
	if refreshed.Status != model.PaymentPlanStatusPaid {
		t.Fatalf("expected payment plan status=paid, got %+v", refreshed)
	}
	if refreshed.PaidAt == nil {
		t.Fatalf("expected payment plan paidAt to be set, got %+v", refreshed)
	}
}
