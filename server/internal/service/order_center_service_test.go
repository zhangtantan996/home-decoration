package service

import (
	"strconv"
	"testing"
	"time"

	"home-decoration-server/internal/model"

	gormsqlite "gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupOrderCenterServiceTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	db, err := gorm.Open(gormsqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite db: %v", err)
	}

	if err := db.AutoMigrate(
		&model.User{},
		&model.Provider{},
		&model.Booking{},
		&model.Proposal{},
		&model.Order{},
		&model.PaymentPlan{},
		&model.SiteSurvey{},
		&model.BudgetConfirmation{},
		&model.RefundApplication{},
		&model.Project{},
		&model.BusinessFlow{},
		&model.SystemConfig{},
	); err != nil {
		t.Fatalf("migrate sqlite db: %v", err)
	}

	bindRepositorySQLiteTestDB(t, db)
	return db
}

func seedOrderCenterBaseFixture(t *testing.T, db *gorm.DB) (user model.User, provider model.Provider, booking model.Booking, proposal model.Proposal) {
	t.Helper()

	user = model.User{Base: model.Base{ID: 1001}, Phone: "13800139001", Status: 1}
	providerUser := model.User{Base: model.Base{ID: 1002}, Phone: "13800139002", Nickname: "测试服务商", Status: 1}
	provider = model.Provider{Base: model.Base{ID: 1003}, UserID: providerUser.ID, CompanyName: "测试服务商"}
	booking = model.Booking{
		Base:          model.Base{ID: 1004},
		UserID:        user.ID,
		ProviderID:    provider.ID,
		Address:       "测试地址 1 号",
		Status:        2,
		SurveyDeposit: 600,
	}
	proposal = model.Proposal{
		Base:       model.Base{ID: 1005},
		BookingID:  booking.ID,
		DesignerID: provider.ID,
		Summary:    "方案A",
		Status:     model.ProposalStatusConfirmed,
	}

	for _, item := range []any{&user, &providerUser, &provider, &booking, &proposal} {
		if err := db.Create(item).Error; err != nil {
			t.Fatalf("seed order center base fixture: %v", err)
		}
	}

	return user, provider, booking, proposal
}

func TestOrderCenterServiceListEntriesForUser(t *testing.T) {
	db := setupOrderCenterServiceTestDB(t)
	user, _, booking, proposal := seedOrderCenterBaseFixture(t, db)

	designOrder := model.Order{
		Base:        model.Base{ID: 1101},
		ProposalID:  proposal.ID,
		BookingID:   booking.ID,
		OrderNo:     "ORD-DESIGN-1101",
		OrderType:   model.OrderTypeDesign,
		TotalAmount: 12000,
		Discount:    500,
		Status:      model.OrderStatusPending,
	}
	constructionOrder := model.Order{
		Base:        model.Base{ID: 1102},
		ProposalID:  proposal.ID,
		BookingID:   booking.ID,
		OrderNo:     "ORD-CON-1102",
		OrderType:   model.OrderTypeConstruction,
		TotalAmount: 36000,
		Status:      model.OrderStatusPending,
	}
	refundApplication := model.RefundApplication{
		Base:            model.Base{ID: 1103},
		BookingID:       booking.ID,
		OrderID:         designOrder.ID,
		UserID:          user.ID,
		RefundType:      model.RefundTypeDesignFee,
		RequestedAmount: 1000,
		Status:          model.RefundApplicationStatusPending,
		Reason:          "计划变更",
	}
	constructionPlan := model.PaymentPlan{
		Base:    model.Base{ID: 1104},
		OrderID: constructionOrder.ID,
		Seq:     1,
		Name:    "首期款",
		Amount:  18000,
		Status:  0,
	}

	for _, item := range []any{&designOrder, &constructionOrder, &constructionPlan, &refundApplication} {
		if err := db.Create(item).Error; err != nil {
			t.Fatalf("seed order center entries: %v", err)
		}
	}

	enableAlipayForPaymentTests(t)
	seedPaymentChannelConfigs(t, db, true)
	svc := NewOrderCenterService(NewPaymentService(paymentServiceTestGateway{}))

	allEntries, total, err := svc.ListEntriesForUser(user.ID, OrderCenterQuery{Page: 1, PageSize: 20})
	if err != nil {
		t.Fatalf("ListEntriesForUser all: %v", err)
	}
	if total != 4 || len(allEntries) != 4 {
		t.Fatalf("expected 4 entries including refund, got total=%d len=%d", total, len(allEntries))
	}

	payableEntries, total, err := svc.ListEntriesForUser(user.ID, OrderCenterQuery{
		EntryKind: OrderCenterEntryKindPayable,
		Page:      1,
		PageSize:  20,
	})
	if err != nil {
		t.Fatalf("ListEntriesForUser payable: %v", err)
	}
	if total != 3 || len(payableEntries) != 3 {
		t.Fatalf("expected 3 payable entries, got total=%d len=%d", total, len(payableEntries))
	}
	for _, entry := range payableEntries {
		if entry.EntryKind != OrderCenterEntryKindPayable {
			t.Fatalf("unexpected non-payable entry: %+v", entry)
		}
	}

	pendingEntries, total, err := svc.ListEntriesForUser(user.ID, OrderCenterQuery{
		StatusGroup: OrderCenterStatusPendingPayment,
		EntryKind:   OrderCenterEntryKindPayable,
		Page:        1,
		PageSize:    20,
	})
	if err != nil {
		t.Fatalf("ListEntriesForUser pending: %v", err)
	}
	if total != 3 || len(pendingEntries) != 3 {
		t.Fatalf("expected 3 pending payable entries, got total=%d len=%d", total, len(pendingEntries))
	}
	for _, entry := range pendingEntries {
		if !entry.CanCancel {
			t.Fatalf("expected pending entry %s to be cancellable", entry.EntryKey)
		}
		if len(entry.AvailablePaymentOptions) == 0 {
			t.Fatalf("expected pending entry %s to expose payment options", entry.EntryKey)
		}
	}
}

func TestOrderCenterServiceGetConstructionDetailIncludesPaymentPlans(t *testing.T) {
	db := setupOrderCenterServiceTestDB(t)
	user, _, booking, proposal := seedOrderCenterBaseFixture(t, db)

	order := model.Order{
		Base:        model.Base{ID: 1201},
		ProposalID:  proposal.ID,
		BookingID:   booking.ID,
		OrderNo:     "ORD-CON-1201",
		OrderType:   model.OrderTypeConstruction,
		TotalAmount: 50000,
		Status:      model.OrderStatusPending,
	}
	paidPlan := model.PaymentPlan{
		Base:    model.Base{ID: 1202},
		OrderID: order.ID,
		Seq:     1,
		Name:    "首期款",
		Amount:  20000,
		Status:  1,
	}
	pendingPlan := model.PaymentPlan{
		Base:    model.Base{ID: 1203},
		OrderID: order.ID,
		Seq:     2,
		Name:    "中期款",
		Amount:  30000,
		Status:  0,
	}

	for _, item := range []any{&order, &paidPlan, &pendingPlan} {
		if err := db.Create(item).Error; err != nil {
			t.Fatalf("seed construction detail fixture: %v", err)
		}
	}

	svc := NewOrderCenterService(NewPaymentService(nil))
	detail, err := svc.GetEntryDetailForUser(user.ID, "construction_order:1201")
	if err != nil {
		t.Fatalf("GetEntryDetailForUser: %v", err)
	}

	if detail == nil || detail.Order == nil || detail.Order.ID != order.ID {
		t.Fatalf("expected order detail for construction order, got %+v", detail)
	}
	if len(detail.PaymentPlans) != 2 {
		t.Fatalf("expected 2 payment plans, got %+v", detail.PaymentPlans)
	}
	if detail.NextPayablePlan == nil || detail.NextPayablePlan.ID != pendingPlan.ID {
		t.Fatalf("expected next payable plan %d, got %+v", pendingPlan.ID, detail.NextPayablePlan)
	}
	if detail.NextPayablePlan.Seq != 2 {
		t.Fatalf("expected next payable seq=2, got %+v", detail.NextPayablePlan)
	}
	if detail.Booking == nil || detail.Booking.ID != booking.ID {
		t.Fatalf("expected booking summary, got %+v", detail.Booking)
	}
	if detail.CanCancel {
		t.Fatalf("expected construction order with paid plan to be non-cancellable")
	}
}

func TestOrderCenterServiceSummaryPreservesCreatedAt(t *testing.T) {
	db := setupOrderCenterServiceTestDB(t)
	user, _, booking, proposal := seedOrderCenterBaseFixture(t, db)

	bookingCreatedAt := time.Date(2026, 3, 1, 10, 0, 0, 0, time.UTC)
	bookingPaidAt := bookingCreatedAt.Add(48 * time.Hour)
	if err := db.Model(&model.Booking{}).
		Where("id = ?", booking.ID).
		Updates(map[string]any{
			"created_at":             bookingCreatedAt,
			"survey_deposit_paid":    true,
			"survey_deposit_paid_at": bookingPaidAt,
		}).Error; err != nil {
		t.Fatalf("update paid booking timestamps: %v", err)
	}

	orderCreatedAt := time.Date(2026, 3, 5, 9, 30, 0, 0, time.UTC)
	orderPaidAt := orderCreatedAt.Add(72 * time.Hour)
	order := model.Order{
		Base:        model.Base{ID: 1301, CreatedAt: orderCreatedAt},
		ProposalID:  proposal.ID,
		BookingID:   booking.ID,
		OrderNo:     "ORD-DESIGN-1301",
		OrderType:   model.OrderTypeDesign,
		TotalAmount: 8800,
		PaidAmount:  8800,
		Status:      model.OrderStatusPaid,
		PaidAt:      &orderPaidAt,
	}
	if err := db.Create(&order).Error; err != nil {
		t.Fatalf("create paid order: %v", err)
	}

	svc := NewOrderCenterService(NewPaymentService(nil))

	surveyDetail, err := svc.GetEntryDetailForUser(user.ID, "survey_deposit:"+strconv.FormatUint(booking.ID, 10))
	if err != nil {
		t.Fatalf("get survey deposit detail: %v", err)
	}
	if surveyDetail.CreatedAt == nil || !surveyDetail.CreatedAt.Equal(bookingCreatedAt) {
		t.Fatalf("expected survey deposit createdAt=%s, got %+v", bookingCreatedAt.Format(time.RFC3339), surveyDetail.CreatedAt)
	}

	orderDetail, err := svc.GetEntryDetailForUser(user.ID, "design_order:"+strconv.FormatUint(order.ID, 10))
	if err != nil {
		t.Fatalf("get design order detail: %v", err)
	}
	if orderDetail.CreatedAt == nil || !orderDetail.CreatedAt.Equal(orderCreatedAt) {
		t.Fatalf("expected order createdAt=%s, got %+v", orderCreatedAt.Format(time.RFC3339), orderDetail.CreatedAt)
	}
}
