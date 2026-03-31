package service

import (
	"testing"
	"time"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"

	gormsqlite "gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupOrderServiceTestDB(t *testing.T) *gorm.DB {
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
		&model.Milestone{},
		&model.Proposal{},
		&model.Order{},
		&model.PaymentPlan{},
		&model.PaymentOrder{},
	); err != nil {
		t.Fatalf("migrate sqlite db: %v", err)
	}

	previousDB := repository.DB
	repository.DB = db
	t.Cleanup(func() {
		repository.DB = previousDB
	})

	return db
}

func TestOrderServiceGetPaymentPlansForUser(t *testing.T) {
	db := setupOrderServiceTestDB(t)

	user := model.User{Base: model.Base{ID: 9}, Phone: "13800138001", Status: 1}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}

	booking := model.Booking{Base: model.Base{ID: 31}, UserID: user.ID, ProviderID: 88, Address: "测试地址", Status: 1}
	if err := db.Create(&booking).Error; err != nil {
		t.Fatalf("create booking: %v", err)
	}

	proposal := model.Proposal{Base: model.Base{ID: 41}, BookingID: booking.ID, DesignerID: 88, Summary: "方案", Status: model.ProposalStatusConfirmed}
	if err := db.Create(&proposal).Error; err != nil {
		t.Fatalf("create proposal: %v", err)
	}

	order := model.Order{Base: model.Base{ID: 51}, ProposalID: proposal.ID, BookingID: booking.ID, OrderNo: "ORD-51", OrderType: model.OrderTypeConstruction, Status: model.OrderStatusPending}
	if err := db.Create(&order).Error; err != nil {
		t.Fatalf("create order: %v", err)
	}

	plans := []model.PaymentPlan{
		{Base: model.Base{ID: 61}, OrderID: order.ID, Seq: 2, Name: "尾款", Status: 0},
		{Base: model.Base{ID: 62}, OrderID: order.ID, Seq: 1, Name: "首款", Status: 1},
	}
	if err := db.Create(&plans).Error; err != nil {
		t.Fatalf("create plans: %v", err)
	}

	svc := &OrderService{}
	got, err := svc.GetPaymentPlansForUser(user.ID, order.ID)
	if err != nil {
		t.Fatalf("GetPaymentPlansForUser: %v", err)
	}

	if len(got) != 2 {
		t.Fatalf("expected 2 plans, got %d", len(got))
	}
	if got[0].Seq != 1 || got[1].Seq != 2 {
		t.Fatalf("plans not ordered by seq: %+v", got)
	}
}

func TestOrderServiceListOrdersForUser(t *testing.T) {
	db := setupOrderServiceTestDB(t)

	user := model.User{Base: model.Base{ID: 10}, Phone: "13800138010", Status: 1}
	providerUser := model.User{Base: model.Base{ID: 20}, Phone: "13800138020", Nickname: "拾光设计", Status: 1}
	provider := model.Provider{Base: model.Base{ID: 30}, UserID: providerUser.ID, CompanyName: "拾光设计工作室"}

	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}
	if err := db.Create(&providerUser).Error; err != nil {
		t.Fatalf("create provider user: %v", err)
	}
	if err := db.Create(&provider).Error; err != nil {
		t.Fatalf("create provider: %v", err)
	}

	booking := model.Booking{
		Base:          model.Base{ID: 40},
		UserID:        user.ID,
		ProviderID:    provider.ID,
		Address:       "雁塔区测试地址",
		Status:        2,
		SurveyDeposit: 800,
	}
	project := model.Project{Base: model.Base{ID: 50}, OwnerID: user.ID, ProviderID: provider.ID, Address: "高新区项目地址", CurrentPhase: "construction"}
	proposal := model.Proposal{Base: model.Base{ID: 60}, BookingID: booking.ID, DesignerID: provider.ID, Summary: "方案 A", Status: model.ProposalStatusConfirmed}

	for _, record := range []interface{}{&booking, &project, &proposal} {
		if err := db.Create(record).Error; err != nil {
			t.Fatalf("seed order context: %v", err)
		}
	}

	orders := []model.Order{
		{
			Base:        model.Base{ID: 70},
			ProposalID:  proposal.ID,
			BookingID:   booking.ID,
			OrderNo:     "ORD-70",
			OrderType:   model.OrderTypeDesign,
			TotalAmount: 12000,
			Discount:    500,
			Status:      model.OrderStatusPending,
		},
		{
			Base:        model.Base{ID: 71},
			ProjectID:   project.ID,
			OrderNo:     "ORD-71",
			OrderType:   model.OrderTypeConstruction,
			TotalAmount: 56000,
			Status:      model.OrderStatusPaid,
		},
	}
	if err := db.Create(&orders).Error; err != nil {
		t.Fatalf("create orders: %v", err)
	}

	paidAt := orders[1].CreatedAt.Add(2 * time.Minute)
	payment := model.PaymentOrder{
		Base:          model.Base{ID: 72},
		BizType:       model.PaymentBizTypeBookingSurveyDeposit,
		BizID:         booking.ID,
		PayerUserID:   user.ID,
		Channel:       model.PaymentChannelAlipay,
		Scene:         model.PaymentBizTypeBookingSurveyDeposit,
		FundScene:     model.FundSceneSurveyDeposit,
		TerminalType:  model.PaymentTerminalPCWeb,
		Subject:       "量房定金 #40",
		Amount:        500,
		OutTradeNo:    "PAY-72",
		Status:        model.PaymentStatusPaid,
		PaidAt:        &paidAt,
		ReturnContext: `{"successPath":"/bookings/40/site-survey","cancelPath":"/bookings/40","bizType":"booking_survey_deposit","bizId":40}`,
	}
	if err := db.Create(&payment).Error; err != nil {
		t.Fatalf("create payment: %v", err)
	}

	svc := &OrderService{}
	got, total, err := svc.ListOrdersForUser(user.ID, nil, 1, 10)
	if err != nil {
		t.Fatalf("ListOrdersForUser: %v", err)
	}
	if total != 4 {
		t.Fatalf("expected total=4, got %d", total)
	}
	if len(got) != 4 {
		t.Fatalf("expected 4 orders, got %d", len(got))
	}

	first := got[0]
	if first.OrderNo != "量房定金 #40" {
		t.Fatalf("expected latest item to be payment record, got %+v", first)
	}
	if first.ProviderName != "拾光设计" {
		t.Fatalf("expected provider nickname, got %q", first.ProviderName)
	}
	if first.Amount != 500 {
		t.Fatalf("unexpected amount in first row: %+v", first)
	}
	if first.ActionPath != "/payments/72" {
		t.Fatalf("expected payment action path, got %+v", first)
	}

	var pending int8 = model.OrderStatusPending
	filtered, filteredTotal, err := svc.ListOrdersForUser(user.ID, &pending, 1, 10)
	if err != nil {
		t.Fatalf("ListOrdersForUser filtered: %v", err)
	}
	if filteredTotal != 2 || len(filtered) != 2 {
		t.Fatalf("expected two pending records, got total=%d len=%d", filteredTotal, len(filtered))
	}

	var foundSurveyDeposit bool
	var foundPendingDesign bool
	for _, item := range filtered {
		switch item.OrderType {
		case "survey_deposit":
			foundSurveyDeposit = true
			if item.Status != model.OrderStatusPending || item.Address != "雁塔区测试地址" || item.Amount != 800 {
				t.Fatalf("unexpected survey deposit record: %+v", item)
			}
		case model.OrderTypeDesign:
			foundPendingDesign = true
			if item.Amount != 11500 {
				t.Fatalf("expected discounted design order amount, got %+v", item)
			}
		}
	}
	if !foundSurveyDeposit || !foundPendingDesign {
		t.Fatalf("missing pending records, got %+v", filtered)
	}

	var paid int8 = model.OrderStatusPaid
	paidItems, paidTotal, err := svc.ListOrdersForUser(user.ID, &paid, 1, 10)
	if err != nil {
		t.Fatalf("ListOrdersForUser paid: %v", err)
	}
	if paidTotal != 2 || len(paidItems) != 2 {
		t.Fatalf("expected two paid records, got total=%d len=%d", paidTotal, len(paidItems))
	}
}

func TestOrderServiceGetOrderForUserSupportsProjectAndBookingOnlyOrders(t *testing.T) {
	db := setupOrderServiceTestDB(t)

	user := model.User{Base: model.Base{ID: 101}, Phone: "13800138101", Status: 1}
	providerUser := model.User{Base: model.Base{ID: 102}, Phone: "13800138102", Nickname: "工地服务商", Status: 1}
	provider := model.Provider{Base: model.Base{ID: 103}, UserID: providerUser.ID, CompanyName: "工地服务商"}
	project := model.Project{Base: model.Base{ID: 104}, OwnerID: user.ID, ProviderID: provider.ID, Address: "项目地址"}
	booking := model.Booking{Base: model.Base{ID: 105}, UserID: user.ID, ProviderID: provider.ID, Address: "预约地址", Status: 2}

	for _, record := range []any{&user, &providerUser, &provider, &project, &booking} {
		if err := db.Create(record).Error; err != nil {
			t.Fatalf("seed order owner fixture: %v", err)
		}
	}

	projectOrder := model.Order{
		Base:        model.Base{ID: 106},
		ProjectID:   project.ID,
		OrderNo:     "ORD-PROJECT-106",
		OrderType:   model.OrderTypeConstruction,
		TotalAmount: 3999,
		Status:      model.OrderStatusPaid,
	}
	bookingOrder := model.Order{
		Base:        model.Base{ID: 107},
		BookingID:   booking.ID,
		OrderNo:     "ORD-BOOKING-107",
		OrderType:   model.OrderTypeDesign,
		TotalAmount: 1999,
		Status:      model.OrderStatusPending,
	}

	for _, record := range []any{&projectOrder, &bookingOrder} {
		if err := db.Create(record).Error; err != nil {
			t.Fatalf("create order fixture: %v", err)
		}
	}

	svc := &OrderService{}

	gotProjectOrder, err := svc.GetOrderForUser(user.ID, projectOrder.ID)
	if err != nil {
		t.Fatalf("GetOrderForUser project order: %v", err)
	}
	if gotProjectOrder.ID != projectOrder.ID {
		t.Fatalf("expected project order %d, got %+v", projectOrder.ID, gotProjectOrder)
	}

	gotBookingOrder, err := svc.GetOrderForUser(user.ID, bookingOrder.ID)
	if err != nil {
		t.Fatalf("GetOrderForUser booking order: %v", err)
	}
	if gotBookingOrder.ID != bookingOrder.ID {
		t.Fatalf("expected booking order %d, got %+v", bookingOrder.ID, gotBookingOrder)
	}
}

func TestPayPaymentPlanResumesPausedProjectExecution(t *testing.T) {
	db := setupOrderServiceTestDB(t)

	user := model.User{Base: model.Base{ID: 1001}, Phone: "13800138111", Status: 1}
	provider := model.Provider{Base: model.Base{ID: 1002}, ProviderType: 2, CompanyName: "施工公司恢复测试"}
	project := model.Project{
		Base:                    model.Base{ID: 1003},
		OwnerID:                 user.ID,
		ProviderID:              provider.ID,
		ConstructionProviderID:  provider.ID,
		Name:                    "付款恢复项目",
		Address:                 "付款恢复地址",
		Status:                  model.ProjectStatusActive,
		BusinessStatus:          model.ProjectBusinessStatusInProgress,
		ConstructionPaymentMode: "milestone",
		PaymentPaused:           true,
		PaymentPausedReason:     "等待支付下一期施工款",
		CurrentPhase:            "等待支付下一期施工款",
	}
	order := model.Order{
		Base:        model.Base{ID: 1004},
		ProjectID:   project.ID,
		OrderNo:     "ORD-RESUME-1",
		OrderType:   model.OrderTypeConstruction,
		TotalAmount: 50000,
		PaidAmount:  15000,
		Status:      model.OrderStatusPending,
	}
	plans := []model.PaymentPlan{
		{Base: model.Base{ID: 1005}, OrderID: order.ID, Seq: 1, Name: "首款", Amount: 15000, Status: 1},
		{Base: model.Base{ID: 1006}, OrderID: order.ID, Seq: 2, Name: "二期款", Amount: 20000, Status: 0},
	}
	milestones := []model.Milestone{
		{Base: model.Base{ID: 1007}, ProjectID: project.ID, Name: "开工交底", Seq: 1, Status: model.MilestoneStatusAccepted},
		{Base: model.Base{ID: 1008}, ProjectID: project.ID, Name: "水电验收", Seq: 2, Status: model.MilestoneStatusPending},
	}

	for _, record := range []interface{}{&user, &provider, &project, &order} {
		if err := db.Create(record).Error; err != nil {
			t.Fatalf("seed resume project record: %v", err)
		}
	}
	if err := db.Create(&plans).Error; err != nil {
		t.Fatalf("seed payment plans: %v", err)
	}
	if err := db.Create(&milestones).Error; err != nil {
		t.Fatalf("seed milestones: %v", err)
	}

	paidPlan, err := (&OrderService{}).PayPaymentPlan(user.ID, plans[1].ID)
	if err != nil {
		t.Fatalf("PayPaymentPlan: %v", err)
	}
	if paidPlan.Status != 1 {
		t.Fatalf("expected paid plan status, got %+v", paidPlan)
	}

	var refreshedProject model.Project
	if err := db.First(&refreshedProject, project.ID).Error; err != nil {
		t.Fatalf("reload project: %v", err)
	}
	if refreshedProject.PaymentPaused {
		t.Fatalf("expected project payment pause cleared, got %+v", refreshedProject)
	}
	if refreshedProject.CurrentPhase != "水电验收施工中" {
		t.Fatalf("expected project moved back to executable phase, got %q", refreshedProject.CurrentPhase)
	}

	var refreshedMilestone model.Milestone
	if err := db.First(&refreshedMilestone, milestones[1].ID).Error; err != nil {
		t.Fatalf("reload next milestone: %v", err)
	}
	if refreshedMilestone.Status != model.MilestoneStatusInProgress {
		t.Fatalf("expected next milestone activated, got %+v", refreshedMilestone)
	}
}

func TestOrderServiceGetProjectBillForOwner(t *testing.T) {
	db := setupOrderServiceTestDB(t)

	owner := model.User{Base: model.Base{ID: 2001}, Phone: "13800138201", Status: 1}
	other := model.User{Base: model.Base{ID: 2002}, Phone: "13800138202", Status: 1}
	project := model.Project{Base: model.Base{ID: 2003}, OwnerID: owner.ID, ProviderID: 30, Name: "账单项目", Address: "账单地址"}
	order := model.Order{Base: model.Base{ID: 2004}, ProjectID: project.ID, OrderNo: "ORD-BILL-1", OrderType: model.OrderTypeConstruction, TotalAmount: 8888, Status: model.OrderStatusPending}
	plan := model.PaymentPlan{Base: model.Base{ID: 2005}, OrderID: order.ID, Seq: 1, Name: "首款", Amount: 4000, Status: 0}

	for _, record := range []interface{}{&owner, &other, &project, &order, &plan} {
		if err := db.Create(record).Error; err != nil {
			t.Fatalf("seed bill data: %v", err)
		}
	}

	svc := &OrderService{}
	items, err := svc.GetProjectBillForOwner(project.ID, owner.ID)
	if err != nil {
		t.Fatalf("GetProjectBillForOwner: %v", err)
	}
	if len(items) != 1 || items[0].Order.ID != order.ID || len(items[0].PaymentPlans) != 1 {
		t.Fatalf("unexpected project bill items: %+v", items)
	}

	if _, err := svc.GetProjectBillForOwner(project.ID, other.ID); err == nil {
		t.Fatalf("expected foreign owner access to fail")
	}
}
