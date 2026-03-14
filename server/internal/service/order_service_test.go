package service

import (
	"testing"

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
		&model.Proposal{},
		&model.Order{},
		&model.PaymentPlan{},
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

	booking := model.Booking{Base: model.Base{ID: 40}, UserID: user.ID, ProviderID: provider.ID, Address: "雁塔区测试地址", Status: 1}
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

	svc := &OrderService{}
	got, total, err := svc.ListOrdersForUser(user.ID, nil, 1, 10)
	if err != nil {
		t.Fatalf("ListOrdersForUser: %v", err)
	}
	if total != 2 {
		t.Fatalf("expected total=2, got %d", total)
	}
	if len(got) != 2 {
		t.Fatalf("expected 2 orders, got %d", len(got))
	}

	first := got[0]
	if first.ProviderName != "拾光设计" {
		t.Fatalf("expected provider nickname, got %q", first.ProviderName)
	}
	if first.Amount != 56000 && first.Amount != 11500 {
		t.Fatalf("unexpected amount in first row: %+v", first)
	}

	var pending int8 = model.OrderStatusPending
	filtered, filteredTotal, err := svc.ListOrdersForUser(user.ID, &pending, 1, 10)
	if err != nil {
		t.Fatalf("ListOrdersForUser filtered: %v", err)
	}
	if filteredTotal != 1 || len(filtered) != 1 {
		t.Fatalf("expected one pending order, got total=%d len=%d", filteredTotal, len(filtered))
	}
	if filtered[0].Address != "雁塔区测试地址" {
		t.Fatalf("expected booking address, got %+v", filtered[0])
	}
	if filtered[0].Amount != 11500 {
		t.Fatalf("expected discounted amount, got %+v", filtered[0])
	}
}
