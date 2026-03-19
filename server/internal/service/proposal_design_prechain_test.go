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

func TestConfirmProposalCreatesConfiguredDesignStages(t *testing.T) {
	db := setupProposalDesignPrechainTestDB(t)
	configSvc.ClearCache()

	for _, cfg := range []model.SystemConfig{
		{Key: model.ConfigKeyDesignFeePaymentMode, Value: "staged", Editable: true},
		{Key: model.ConfigKeyDesignFeeStages, Value: `[{"name":"签约款","percentage":40},{"name":"终稿款","percentage":60}]`, Editable: true},
	} {
		if err := db.Create(&cfg).Error; err != nil {
			t.Fatalf("seed config: %v", err)
		}
	}
	configSvc.ClearCache()

	user := model.User{Base: model.Base{ID: 121}, Phone: "13800138121", Nickname: "业主C", Status: 1}
	providerUser := model.User{Base: model.Base{ID: 122}, Phone: "13800138122", Nickname: "设计师C", Status: 1}
	provider := model.Provider{Base: model.Base{ID: 221}, UserID: providerUser.ID, ProviderType: 1, Status: 1}
	booking := model.Booking{Base: model.Base{ID: 321}, UserID: user.ID, ProviderID: provider.ID, Address: "设计费测试地址", IntentFee: 500, IntentFeePaid: true, Status: 2}
	proposal := model.Proposal{Base: model.Base{ID: 521}, BookingID: booking.ID, DesignerID: provider.ID, Summary: "正式方案", DesignFee: 10000, Status: model.ProposalStatusPending, Version: 1}
	flow := model.BusinessFlow{
		Base:               model.Base{ID: 721},
		SourceType:         model.BusinessFlowSourceBooking,
		SourceID:           booking.ID,
		CustomerUserID:     user.ID,
		DesignerProviderID: provider.ID,
		CurrentStage:       model.BusinessFlowStageDesignPendingConfirmation,
	}
	for _, value := range []interface{}{&user, &providerUser, &provider, &booking, &proposal, &flow} {
		if err := db.Create(value).Error; err != nil {
			t.Fatalf("seed fixture: %v", err)
		}
	}

	order, err := (&ProposalService{}).ConfirmProposal(user.ID, proposal.ID)
	if err != nil {
		t.Fatalf("ConfirmProposal: %v", err)
	}
	if order.TotalAmount != 9500 {
		t.Fatalf("expected discounted design amount 9500, got %.2f", order.TotalAmount)
	}

	var plans []model.PaymentPlan
	if err := db.Where("order_id = ?", order.ID).Order("seq ASC").Find(&plans).Error; err != nil {
		t.Fatalf("load payment plans: %v", err)
	}
	if len(plans) != 2 {
		t.Fatalf("expected 2 payment plans, got %d", len(plans))
	}
	if plans[0].Name != "签约款" || plans[0].Amount != 3800 {
		t.Fatalf("unexpected first plan: %+v", plans[0])
	}
	if plans[1].Name != "终稿款" || plans[1].Amount != 5700 {
		t.Fatalf("unexpected second plan: %+v", plans[1])
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
}
