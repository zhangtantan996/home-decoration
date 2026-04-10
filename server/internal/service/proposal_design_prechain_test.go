package service

import (
	"database/sql"
	"testing"
	"time"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"

	_ "github.com/mattn/go-sqlite3"
	gormsqlite "gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupProposalDesignPrechainTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	dsn := "file:proposal_design_prechain?mode=memory&cache=shared"
	sqlDB, err := sql.Open("sqlite3", dsn)
	if err != nil {
		t.Fatalf("open sqlite db: %v", err)
	}
	sqlDB.SetConnMaxLifetime(time.Minute)
	sqlDB.SetMaxOpenConns(5)
	sqlDB.SetMaxIdleConns(5)

	db, err := gorm.Open(gormsqlite.New(gormsqlite.Config{Conn: sqlDB}), &gorm.Config{})
	if err != nil {
		t.Fatalf("open gorm db: %v", err)
	}

	if err := db.AutoMigrate(
		&model.User{},
		&model.Provider{},
		&model.Notification{},
		&model.AuditLog{},
		&model.Booking{},
		&model.Proposal{},
		&model.Order{},
		&model.Project{},
		&model.BusinessFlow{},
		&model.SystemConfig{},
		&model.PaymentPlan{},
		&model.RefundApplication{},
		&model.QuantityBase{},
		&model.QuantityBaseItem{},
	); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}

	previousDB := repository.DB
	repository.DB = db
	t.Cleanup(func() {
		repository.DB = previousDB
		configSvc.ClearCache()
		_ = sqlDB.Close()
	})

	return db
}

func TestProposalReject_AllowsThreeRoundsAndFourthEntersAbnormal(t *testing.T) {
	db := setupProposalDesignPrechainTestDB(t)

	user := model.User{Base: model.Base{ID: 101}, Phone: "13800138101", Nickname: "业主", Status: 1}
	providerUser := model.User{Base: model.Base{ID: 102}, Phone: "13800138102", Nickname: "设计师", Status: 1}
	provider := model.Provider{Base: model.Base{ID: 201}, UserID: providerUser.ID, ProviderType: 1, Status: 1}
	booking := model.Booking{Base: model.Base{ID: 301}, UserID: user.ID, ProviderID: provider.ID, Address: "测试地址", IntentFee: 500, IntentFeePaid: true, Status: 2}
	flow := model.BusinessFlow{
		Base:               model.Base{ID: 401},
		SourceType:         model.BusinessFlowSourceBooking,
		SourceID:           booking.ID,
		CustomerUserID:     user.ID,
		DesignerProviderID: provider.ID,
		CurrentStage:       model.BusinessFlowStageDesignPendingConfirmation,
	}
	for _, value := range []interface{}{&user, &providerUser, &provider, &booking, &flow} {
		if err := db.Create(value).Error; err != nil {
			t.Fatalf("seed fixture: %v", err)
		}
	}

	oldRejected := []model.Proposal{
		{Base: model.Base{ID: 501}, BookingID: booking.ID, DesignerID: provider.ID, Summary: "方案v1", Status: model.ProposalStatusRejected, RejectionCount: 1, Version: 1},
		{Base: model.Base{ID: 502}, BookingID: booking.ID, DesignerID: provider.ID, Summary: "方案v2", Status: model.ProposalStatusRejected, RejectionCount: 2, Version: 2},
		{Base: model.Base{ID: 503}, BookingID: booking.ID, DesignerID: provider.ID, Summary: "方案v3", Status: model.ProposalStatusRejected, RejectionCount: 3, Version: 3},
	}
	if err := db.Create(&oldRejected).Error; err != nil {
		t.Fatalf("seed rejected proposals: %v", err)
	}

	current := model.Proposal{
		Base:       model.Base{ID: 504},
		BookingID:  booking.ID,
		DesignerID: provider.ID,
		Summary:    "方案v4",
		Status:     model.ProposalStatusPending,
		Version:    4,
	}
	if err := db.Create(&current).Error; err != nil {
		t.Fatalf("seed current proposal: %v", err)
	}

	result, err := (&ProposalService{}).RejectProposal(user.ID, current.ID, &RejectProposalInput{Reason: "仍不满足需求，需要进入平台处理"})
	if err != nil {
		t.Fatalf("RejectProposal: %v", err)
	}
	if !result.EnteredAbnormal {
		t.Fatalf("expected abnormal result, got %+v", result)
	}
	if result.RejectionCount != 4 || result.CanResubmit {
		t.Fatalf("unexpected rejection result: %+v", result)
	}
	if result.RefundApplicationID == 0 {
		t.Fatalf("expected refund application id, got %+v", result)
	}

	var updatedBooking model.Booking
	if err := db.First(&updatedBooking, booking.ID).Error; err != nil {
		t.Fatalf("reload booking: %v", err)
	}
	if updatedBooking.Status != 5 {
		t.Fatalf("expected booking status 5(disputed), got %d", updatedBooking.Status)
	}

	var refundApp model.RefundApplication
	if err := db.First(&refundApp, result.RefundApplicationID).Error; err != nil {
		t.Fatalf("load refund application: %v", err)
	}
	if refundApp.RefundType != model.RefundTypeIntentFee || refundApp.Status != model.RefundApplicationStatusPending {
		t.Fatalf("unexpected refund application: %+v", refundApp)
	}

	var updatedFlow model.BusinessFlow
	if err := db.Where("source_type = ? AND source_id = ?", model.BusinessFlowSourceBooking, booking.ID).First(&updatedFlow).Error; err != nil {
		t.Fatalf("reload flow: %v", err)
	}
	if updatedFlow.CurrentStage != model.BusinessFlowStageDisputed {
		t.Fatalf("expected flow disputed, got %s", updatedFlow.CurrentStage)
	}
}

func TestRefundApplicationCreate_MarksBookingFlowDisputed(t *testing.T) {
	db := setupProposalDesignPrechainTestDB(t)

	user := model.User{Base: model.Base{ID: 111}, Phone: "13800138111", Nickname: "业主B", Status: 1}
	provider := model.Provider{Base: model.Base{ID: 211}, UserID: 311, ProviderType: 1, Status: 1}
	booking := model.Booking{Base: model.Base{ID: 311}, UserID: user.ID, ProviderID: provider.ID, Address: "退款测试地址", IntentFee: 500, IntentFeePaid: true, Status: 2}
	flow := model.BusinessFlow{
		Base:               model.Base{ID: 411},
		SourceType:         model.BusinessFlowSourceBooking,
		SourceID:           booking.ID,
		CustomerUserID:     user.ID,
		DesignerProviderID: provider.ID,
		CurrentStage:       model.BusinessFlowStageDesignPendingSubmission,
	}
	for _, value := range []interface{}{&user, &provider, &booking, &flow} {
		if err := db.Create(value).Error; err != nil {
			t.Fatalf("seed fixture: %v", err)
		}
	}

	view, err := (&RefundApplicationService{}).CreateApplication(booking.ID, user.ID, &CreateRefundApplicationInput{
		RefundType: model.RefundTypeIntentFee,
		Reason:     "量房后终止合作，申请退款",
	})
	if err != nil {
		t.Fatalf("CreateApplication: %v", err)
	}
	if view == nil || view.ID == 0 {
		t.Fatalf("expected refund application view, got %+v", view)
	}

	var updatedBooking model.Booking
	if err := db.First(&updatedBooking, booking.ID).Error; err != nil {
		t.Fatalf("reload booking: %v", err)
	}
	if updatedBooking.Status != 5 {
		t.Fatalf("expected booking moved to disputed status, got %d", updatedBooking.Status)
	}

	var updatedFlow model.BusinessFlow
	if err := db.Where("source_type = ? AND source_id = ?", model.BusinessFlowSourceBooking, booking.ID).First(&updatedFlow).Error; err != nil {
		t.Fatalf("reload flow: %v", err)
	}
	if updatedFlow.CurrentStage != model.BusinessFlowStageDisputed {
		t.Fatalf("expected disputed flow stage, got %s", updatedFlow.CurrentStage)
	}
}

func TestConfirmProposalRequiresPaidDesignOrderAndAdvancesToConstructionBridge(t *testing.T) {
	db := setupProposalDesignPrechainTestDB(t)
	configSvc.ClearCache()

	user := model.User{Base: model.Base{ID: 121}, Phone: "13800138121", Nickname: "业主C", Status: 1}
	providerUser := model.User{Base: model.Base{ID: 122}, Phone: "13800138122", Nickname: "设计师C", Status: 1}
	provider := model.Provider{Base: model.Base{ID: 221}, UserID: providerUser.ID, ProviderType: 1, Status: 1}
	booking := model.Booking{Base: model.Base{ID: 321}, UserID: user.ID, ProviderID: provider.ID, Address: "设计费测试地址", IntentFee: 500, IntentFeePaid: true, Status: 2}
	proposal := model.Proposal{Base: model.Base{ID: 521}, BookingID: booking.ID, DesignerID: provider.ID, Summary: "正式方案", DesignFee: 10000, Status: model.ProposalStatusPending, Version: 1}
	order := model.Order{
		Base:        model.Base{ID: 621},
		BookingID:   booking.ID,
		OrderNo:     "DESIGN-PAID-321",
		OrderType:   model.OrderTypeDesign,
		TotalAmount: 9500,
		PaidAmount:  9500,
		Status:      model.OrderStatusPaid,
		PaidAt:      ptrProposalTestTime(time.Now()),
	}
	flow := model.BusinessFlow{
		Base:               model.Base{ID: 721},
		SourceType:         model.BusinessFlowSourceBooking,
		SourceID:           booking.ID,
		CustomerUserID:     user.ID,
		DesignerProviderID: provider.ID,
		CurrentStage:       model.BusinessFlowStageDesignDeliveryPending,
	}
	for _, value := range []interface{}{&user, &providerUser, &provider, &booking, &proposal, &order, &flow} {
		if err := db.Create(value).Error; err != nil {
			t.Fatalf("seed fixture: %v", err)
		}
	}

	confirmed, err := (&ProposalService{}).ConfirmProposal(user.ID, proposal.ID)
	if err != nil {
		t.Fatalf("ConfirmProposal: %v", err)
	}
	if confirmed.Status != model.ProposalStatusConfirmed {
		t.Fatalf("expected confirmed proposal status, got %d", confirmed.Status)
	}
	if confirmed.ConfirmedAt == nil {
		t.Fatalf("expected confirmed_at to be populated")
	}

	var orderCount int64
	if err := db.Model(&model.Order{}).Where("booking_id = ? AND order_type = ?", booking.ID, model.OrderTypeDesign).Count(&orderCount).Error; err != nil {
		t.Fatalf("count design orders: %v", err)
	}
	if orderCount != 1 {
		t.Fatalf("expected no extra design order created, got %d", orderCount)
	}

	var planCount int64
	if err := db.Model(&model.PaymentPlan{}).Where("order_id = ?", order.ID).Count(&planCount).Error; err != nil {
		t.Fatalf("count payment plans: %v", err)
	}
	if planCount != 0 {
		t.Fatalf("expected proposal confirmation not to create payment plans, got %d", planCount)
	}

	var updatedFlow model.BusinessFlow
	if err := db.Where("source_type = ? AND source_id = ?", model.BusinessFlowSourceBooking, booking.ID).First(&updatedFlow).Error; err != nil {
		t.Fatalf("reload flow: %v", err)
	}
	if updatedFlow.CurrentStage != model.BusinessFlowStageConstructionPartyPending {
		t.Fatalf("expected flow advanced to construction party pending, got %s", updatedFlow.CurrentStage)
	}
	if updatedFlow.ProjectID != 0 {
		t.Fatalf("expected no project created after proposal confirmation, got %d", updatedFlow.ProjectID)
	}

	var projectCount int64
	if err := db.Model(&model.Project{}).Where("proposal_id = ?", proposal.ID).Count(&projectCount).Error; err != nil {
		t.Fatalf("count proposal projects: %v", err)
	}
	if projectCount != 0 {
		t.Fatalf("expected zero projects after proposal confirmation, got %d", projectCount)
	}

	var quantityBase model.QuantityBase
	if err := db.Where("proposal_id = ? AND status = ?", proposal.ID, model.QuantityBaseStatusActive).First(&quantityBase).Error; err != nil {
		t.Fatalf("expected quantity base created after proposal confirmation: %v", err)
	}
	if quantityBase.SourceType != model.QuantitySourceTypeProposal || quantityBase.SourceID != proposal.ID {
		t.Fatalf("unexpected quantity base source: %+v", quantityBase)
	}

	var quantityItemCount int64
	if err := db.Model(&model.QuantityBaseItem{}).Where("quantity_base_id = ?", quantityBase.ID).Count(&quantityItemCount).Error; err != nil {
		t.Fatalf("count quantity base items: %v", err)
	}
	if quantityItemCount == 0 {
		t.Fatalf("expected quantity base items created after proposal confirmation")
	}
}

func TestConfirmProposalRequiresPaidDesignOrder(t *testing.T) {
	db := setupProposalDesignPrechainTestDB(t)

	user := model.User{Base: model.Base{ID: 131}, Phone: "13800138131", Nickname: "业主D", Status: 1}
	provider := model.Provider{Base: model.Base{ID: 231}, UserID: 331, ProviderType: 1, Status: 1}
	booking := model.Booking{Base: model.Base{ID: 331}, UserID: user.ID, ProviderID: provider.ID, Address: "未支付设计费", IntentFee: 500, IntentFeePaid: true, Status: 2}
	proposal := model.Proposal{Base: model.Base{ID: 531}, BookingID: booking.ID, DesignerID: provider.ID, Summary: "待支付方案", Status: model.ProposalStatusPending, Version: 1}
	flow := model.BusinessFlow{
		Base:               model.Base{ID: 731},
		SourceType:         model.BusinessFlowSourceBooking,
		SourceID:           booking.ID,
		CustomerUserID:     user.ID,
		DesignerProviderID: provider.ID,
		CurrentStage:       model.BusinessFlowStageDesignFeePaying,
	}
	for _, value := range []interface{}{&user, &provider, &booking, &proposal, &flow} {
		if err := db.Create(value).Error; err != nil {
			t.Fatalf("seed fixture: %v", err)
		}
	}

	if _, err := (&ProposalService{}).ConfirmProposal(user.ID, proposal.ID); err == nil || err.Error() != "请先完成设计费支付" {
		t.Fatalf("expected paid design fee requirement, got %v", err)
	}
}

func ptrProposalTestTime(v time.Time) *time.Time {
	return &v
}
