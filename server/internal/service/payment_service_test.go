package service

import (
	"context"
	"net/url"
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

func (g paymentServiceTestGateway) CreateCollectOrder(ctx context.Context, order *model.PaymentOrder) (string, error) {
	return "<html>redirect</html>", nil
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

func (g paymentServiceTestGateway) QueryCollectOrder(ctx context.Context, order *model.PaymentOrder) (*PaymentChannelTradeResult, error) {
	if g.queryTradeResult != nil {
		return &PaymentChannelTradeResult{
			ProviderTradeNo: g.queryTradeResult.TradeNo,
			TradeStatus:     g.queryTradeResult.TradeStatus,
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

func setupPaymentServiceTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	db, err := gorm.Open(gormsqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite db: %v", err)
	}

	if err := db.AutoMigrate(
		&model.User{},
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
	cfg.Alipay.TimeoutMinutes = 15
	cfg.Server.PublicURL = "https://server.example.com"
	cfg.Alipay.ReturnURLWeb = "https://web.example.com/payments/result"
	cfg.Alipay.ReturnURLH5 = "https://m.example.com/payments/result"
	t.Cleanup(func() {
		*cfg = previous
	})
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
		Subject:         "量房定金",
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

func TestPaymentServiceStartBookingIntentPaymentRejectsUnconfirmedBooking(t *testing.T) {
	db := setupPaymentServiceTestDB(t)
	enableAlipayForPaymentTests(t)
	userID, bookingID := seedPendingBookingIntentFixture(t, db)

	svc := NewPaymentService(paymentServiceTestGateway{})
	_, err := svc.StartBookingIntentPayment(userID, bookingID, model.PaymentTerminalPCWeb)
	if err == nil {
		t.Fatalf("expected unconfirmed booking payment to be rejected")
	}
	if err.Error() != "请等待服务商确认预约后再支付量房定金" {
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
	_, err := svc.StartSurveyDepositPayment(userID, bookingID, model.PaymentTerminalPCWeb)
	if err == nil {
		t.Fatalf("expected unconfirmed survey deposit payment to be rejected")
	}
	if err.Error() != "请等待服务商确认预约后再支付量房定金" {
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
		Subject:      "预约意向金",
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
		Subject:         "量房定金 #804",
		Amount:          500,
		OutTradeNo:      "BOOKINGSURVEY-804-001",
		ProviderTradeNo: "202603260001",
		Status:          model.PaymentStatusPaid,
		PaidAt:          &paidAt,
		ReturnContext:   `{"successPath":"/bookings/804/site-survey","cancelPath":"/bookings/804","bizType":"booking_survey_deposit","bizId":804}`,
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
	if detail.PurposeText != "量房定金 #804" || detail.FundSceneText != "量房定金" {
		t.Fatalf("unexpected purpose detail: %+v", detail)
	}
	if detail.ActionPath != "/bookings/804" {
		t.Fatalf("expected booking action path, got %+v", detail)
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

func TestDesignPaymentServiceRefundSurveyDepositCreatesTrueRefund(t *testing.T) {
	db := setupPaymentServiceTestDB(t)
	enableAlipayForPaymentTests(t)
	userID, bookingID := seedSurveyDepositFixture(t, db)

	previousGatewayFactory := paymentChannelServiceFactory
	paymentChannelServiceFactory = func() PaymentChannelService { return paymentServiceTestGateway{} }
	t.Cleanup(func() {
		paymentChannelServiceFactory = previousGatewayFactory
	})

	message, err := (&DesignPaymentService{}).RefundSurveyDeposit(userID, bookingID)
	if err != nil {
		t.Fatalf("RefundSurveyDeposit: %v", err)
	}
	if message != "量房定金退款成功" {
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
	paymentChannelServiceFactory = func() PaymentChannelService {
		return paymentServiceTestGateway{
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
		}
	}
	t.Cleanup(func() {
		paymentChannelServiceFactory = previousGatewayFactory
	})

	message, err := (&DesignPaymentService{}).RefundSurveyDeposit(userID, bookingID)
	if err != nil {
		t.Fatalf("RefundSurveyDeposit pending: %v", err)
	}
	if message != "量房定金退款处理中，请稍后确认" {
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
