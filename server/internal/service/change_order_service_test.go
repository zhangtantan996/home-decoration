package service

import (
	"fmt"
	"testing"
	"time"

	"home-decoration-server/internal/model"

	gormsqlite "gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

type changeOrderFixture struct {
	owner              model.User
	providerUser       model.User
	provider           model.Provider
	admin              model.SysAdmin
	project            model.Project
	order              model.Order
	initialPlan        model.PaymentPlan
	initialExpectedEnd time.Time
}

func setupChangeOrderServiceTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	dsn := fmt.Sprintf("file:change-order-%d?mode=memory&cache=shared", time.Now().UnixNano())
	db, err := gorm.Open(gormsqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite db: %v", err)
	}

	if err := db.AutoMigrate(withPaymentCentralTestModels(
		&model.User{},
		&model.Provider{},
		&model.Project{},
		&model.Order{},
		&model.Notification{},
		&model.SysAdmin{},
	)...); err != nil {
		t.Fatalf("migrate sqlite db: %v", err)
	}

	bindRepositorySQLiteTestDB(t, db)
	return db
}

func seedChangeOrderFixture(t *testing.T, db *gorm.DB) changeOrderFixture {
	t.Helper()

	expectedEnd := time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC)
	fixture := changeOrderFixture{
		owner:        model.User{Base: model.Base{ID: 801}, Phone: "13800138801", Status: 1},
		providerUser: model.User{Base: model.Base{ID: 802}, Phone: "13800138802", Status: 1},
		provider:     model.Provider{Base: model.Base{ID: 803}, UserID: 802, ProviderType: 2, CompanyName: "测试施工方"},
		admin:        model.SysAdmin{ID: 804, Username: "admin", Password: "pwd", Nickname: "管理员", Status: 1},
		project: model.Project{
			Base:                   model.Base{ID: 805},
			OwnerID:                801,
			ProviderID:             803,
			ConstructionProviderID: 803,
			Name:                   "测试施工项目",
			Address:                "测试地址",
			Status:                 model.ProjectStatusActive,
			BusinessStatus:         model.ProjectBusinessStatusInProgress,
			ExpectedEnd:            &expectedEnd,
		},
		order: model.Order{
			Base:        model.Base{ID: 806},
			ProjectID:   805,
			OrderNo:     "ORD-CHANGE-806",
			OrderType:   model.OrderTypeConstruction,
			TotalAmount: 10000,
			PaidAmount:  10000,
			Status:      model.OrderStatusPaid,
		},
		initialPlan: model.PaymentPlan{
			Base:        model.Base{ID: 807},
			OrderID:     806,
			Type:        "first_payment",
			Seq:         1,
			Name:        "首付款",
			Amount:      10000,
			Status:      model.PaymentPlanStatusPaid,
			ActivatedAt: ptrTimeChangeOrder(expectedEnd.AddDate(0, -2, 0)),
			PaidAt:      ptrTimeChangeOrder(expectedEnd.AddDate(0, -2, 1)),
		},
		initialExpectedEnd: expectedEnd,
	}

	for _, item := range []any{
		&fixture.owner,
		&fixture.providerUser,
		&fixture.provider,
		&fixture.admin,
		&fixture.project,
		&fixture.order,
		&fixture.initialPlan,
	} {
		if err := db.Create(item).Error; err != nil {
			t.Fatalf("seed change order fixture: %v", err)
		}
	}

	return fixture
}

func ptrTimeChangeOrder(value time.Time) *time.Time {
	return &value
}

func findNotification(t *testing.T, db *gorm.DB, userID uint64, userType, notificationType string) *model.Notification {
	t.Helper()

	var notification model.Notification
	err := db.Where("user_id = ? AND user_type = ? AND type = ?", userID, userType, notificationType).
		Order("id DESC").
		First(&notification).Error
	if err != nil {
		t.Fatalf("find notification %s for %s:%d: %v", notificationType, userType, userID, err)
	}
	return &notification
}

func TestChangeOrderServiceConfirmPositiveImpactCreatesPaymentPlan(t *testing.T) {
	db := setupChangeOrderServiceTestDB(t)
	fixture := seedChangeOrderFixture(t, db)

	svc := &ChangeOrderService{}
	created, err := svc.CreateByProvider(fixture.project.ID, fixture.provider.ID, &ChangeOrderCreateInput{
		ChangeType:   "scope",
		Title:        "新增定制柜",
		Reason:       "现场确认增加收纳需求",
		Description:  "增加玄关与阳台柜体",
		AmountImpact: 3000,
		Items: []ChangeOrderItemInput{
			{Title: "玄关柜", AmountImpact: 1800},
			{Title: "阳台柜", AmountImpact: 1200},
		},
	})
	if err != nil {
		t.Fatalf("CreateByProvider: %v", err)
	}
	if created.Status != model.ChangeOrderStatusPendingUserConfirm {
		t.Fatalf("expected pending_user_confirm, got %s", created.Status)
	}

	confirmed, err := svc.ConfirmByOwner(created.ID, fixture.owner.ID)
	if err != nil {
		t.Fatalf("ConfirmByOwner: %v", err)
	}
	if confirmed.Status != model.ChangeOrderStatusUserConfirmed {
		t.Fatalf("expected user_confirmed, got %s", confirmed.Status)
	}
	if confirmed.PayablePlanID == 0 {
		t.Fatalf("expected payable plan id to be generated")
	}

	var plans []model.PaymentPlan
	if err := db.Where("order_id = ?", fixture.order.ID).Order("seq ASC").Find(&plans).Error; err != nil {
		t.Fatalf("load payment plans: %v", err)
	}
	if len(plans) != 2 {
		t.Fatalf("expected 2 payment plans, got %d", len(plans))
	}

	changePlan := plans[1]
	if changePlan.Type != "change_order" {
		t.Fatalf("expected change_order plan type, got %s", changePlan.Type)
	}
	if changePlan.Name != "新增定制柜" {
		t.Fatalf("expected change order plan name, got %s", changePlan.Name)
	}
	if changePlan.Status != model.PaymentPlanStatusPending {
		t.Fatalf("expected pending plan status, got %d", changePlan.Status)
	}
	if changePlan.ActivatedAt == nil || changePlan.DueAt == nil {
		t.Fatalf("expected activatedAt and dueAt to be set: %+v", changePlan)
	}

	var order model.Order
	if err := db.First(&order, fixture.order.ID).Error; err != nil {
		t.Fatalf("reload order: %v", err)
	}
	if order.TotalAmount != 13000 {
		t.Fatalf("expected updated order total 13000, got %.2f", order.TotalAmount)
	}
	if order.Status != model.OrderStatusPending {
		t.Fatalf("expected order to return pending after增项, got %d", order.Status)
	}
	if order.ExpireAt == nil {
		t.Fatalf("expected order expireAt to follow latest payable plan")
	}

	findNotification(t, db, fixture.owner.ID, "user", "change_order.created")
	findNotification(t, db, fixture.owner.ID, "user", "change_order.payment_pending")
	findNotification(t, db, fixture.providerUser.ID, "provider", "change_order.confirmed")
	findNotification(t, db, fixture.providerUser.ID, "provider", "change_order.payment_pending")
}

func TestChangeOrderServiceConfirmNegativeImpactRequiresAdminSettlement(t *testing.T) {
	db := setupChangeOrderServiceTestDB(t)
	fixture := seedChangeOrderFixture(t, db)

	svc := &ChangeOrderService{}
	created, err := svc.CreateByProvider(fixture.project.ID, fixture.provider.ID, &ChangeOrderCreateInput{
		ChangeType:     "budget",
		Title:          "减项调整",
		Reason:         "现场确认取消电视背景墙",
		Description:    "取消背景墙基层与饰面",
		AmountImpact:   -1500,
		TimelineImpact: 3,
	})
	if err != nil {
		t.Fatalf("CreateByProvider: %v", err)
	}

	confirmed, err := svc.ConfirmByOwner(created.ID, fixture.owner.ID)
	if err != nil {
		t.Fatalf("ConfirmByOwner: %v", err)
	}
	if confirmed.Status != model.ChangeOrderStatusAdminSettlementRequired {
		t.Fatalf("expected admin_settlement_required, got %s", confirmed.Status)
	}
	if confirmed.PayablePlanID != 0 {
		t.Fatalf("expected no payable plan for negative change, got %d", confirmed.PayablePlanID)
	}

	var plans []model.PaymentPlan
	if err := db.Where("order_id = ?", fixture.order.ID).Order("seq ASC").Find(&plans).Error; err != nil {
		t.Fatalf("load payment plans: %v", err)
	}
	if len(plans) != 1 {
		t.Fatalf("expected original payment plan only, got %d", len(plans))
	}

	var project model.Project
	if err := db.First(&project, fixture.project.ID).Error; err != nil {
		t.Fatalf("reload project: %v", err)
	}
	if project.ExpectedEnd == nil {
		t.Fatalf("expected expectedEnd to remain set")
	}
	if project.ExpectedEnd.Sub(fixture.initialExpectedEnd) != 72*time.Hour {
		t.Fatalf("expected expectedEnd delayed 3 days, got %v", project.ExpectedEnd.Sub(fixture.initialExpectedEnd))
	}

	findNotification(t, db, fixture.admin.ID, "admin", "change_order.settlement_required")

	settled, err := svc.SettleByAdmin(created.ID, fixture.admin.ID, &ChangeOrderSettleInput{Reason: "已登记人工减免处理"})
	if err != nil {
		t.Fatalf("SettleByAdmin: %v", err)
	}
	if settled.Status != model.ChangeOrderStatusSettled {
		t.Fatalf("expected settled status, got %s", settled.Status)
	}
	if settled.SettlementReason != "已登记人工减免处理" {
		t.Fatalf("expected settlement reason to persist, got %s", settled.SettlementReason)
	}

	findNotification(t, db, fixture.admin.ID, "admin", "change_order.settled")
}

func TestChangeOrderServiceConfirmDescriptionOnlyLeavesTrace(t *testing.T) {
	db := setupChangeOrderServiceTestDB(t)
	fixture := seedChangeOrderFixture(t, db)

	svc := &ChangeOrderService{}
	created, err := svc.CreateByProvider(fixture.project.ID, fixture.provider.ID, &ChangeOrderCreateInput{
		ChangeType:   "note",
		Title:        "施工说明补充",
		Reason:       "补充现场成品保护约定",
		Description:  "阳台区域保持通行，材料暂存仅限工作时段。",
		AmountImpact: 0,
	})
	if err != nil {
		t.Fatalf("CreateByProvider: %v", err)
	}

	confirmed, err := svc.ConfirmByOwner(created.ID, fixture.owner.ID)
	if err != nil {
		t.Fatalf("ConfirmByOwner: %v", err)
	}
	if confirmed.Status != model.ChangeOrderStatusUserConfirmed {
		t.Fatalf("expected user_confirmed, got %s", confirmed.Status)
	}
	if confirmed.PayablePlanID != 0 {
		t.Fatalf("expected description-only change to avoid payment plan, got %d", confirmed.PayablePlanID)
	}

	var order model.Order
	if err := db.First(&order, fixture.order.ID).Error; err != nil {
		t.Fatalf("reload order: %v", err)
	}
	if order.TotalAmount != fixture.order.TotalAmount {
		t.Fatalf("expected order total unchanged, got %.2f", order.TotalAmount)
	}

	var plans []model.PaymentPlan
	if err := db.Where("order_id = ?", fixture.order.ID).Find(&plans).Error; err != nil {
		t.Fatalf("load payment plans: %v", err)
	}
	if len(plans) != 1 {
		t.Fatalf("expected no extra payment plan, got %d", len(plans))
	}
}
