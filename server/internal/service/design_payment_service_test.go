package service

import (
	"testing"
	"time"

	"home-decoration-server/internal/model"

	gormsqlite "gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupDesignPaymentDB(t *testing.T) *gorm.DB {
	t.Helper()

	db, err := gorm.Open(gormsqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite db: %v", err)
	}

	if err := db.AutoMigrate(withPaymentCentralTestModels(
		&model.User{},
		&model.Provider{},
		&model.Booking{},
		&model.Project{},
		&model.EscrowAccount{},
		&model.Transaction{},
		&model.Order{},
		&model.PaymentPlan{},
		&model.MerchantIncome{},
		&model.MerchantServiceSetting{},
		&model.BusinessFlow{},
		&model.SystemConfig{},
		&model.Notification{},
		&model.AuditLog{},
		&model.RiskWarning{},
		&model.DesignWorkingDoc{},
		&model.DesignFeeQuote{},
		&model.DesignDeliverable{},
	)...); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}
	bindRepositorySQLiteTestDB(t, db)

	return db
}

func seedDesignPaymentFixtures(t *testing.T, db *gorm.DB) (userID, providerID, bookingID uint64) {
	t.Helper()

	user := model.User{Base: model.Base{ID: 1}}
	db.Create(&user)

	provider := model.Provider{Base: model.Base{ID: 10}}
	db.Create(&provider)

	booking := model.Booking{
		Base:              model.Base{ID: 100},
		UserID:            1,
		ProviderID:        10,
		Status:            2, // confirmed
		SurveyDepositPaid: true,
		SurveyDeposit:     500,
	}
	db.Create(&booking)

	// seed default config
	db.Create(&model.SystemConfig{Key: "booking.survey_deposit_default", Value: "500", Type: "number"})
	db.Create(&model.SystemConfig{Key: "booking.survey_deposit_refund_rate", Value: "0.6", Type: "number"})
	db.Create(&model.SystemConfig{Key: "design.fee_quote_expire_hours", Value: "72", Type: "number"})
	db.Create(&model.SystemConfig{Key: "fee.platform.design_fee_rate", Value: "0.1", Type: "number"})
	db.Create(&model.SystemConfig{Key: "construction.release_delay_days", Value: "3", Type: "number"})

	// create escrow
	db.Create(&model.EscrowAccount{
		Base:            model.Base{ID: 1},
		ProjectID:       0,
		UserID:          1,
		TotalAmount:     500,
		AvailableAmount: 500,
		Status:          1,
	})

	return 1, 10, 100
}

func TestUploadWorkingDoc(t *testing.T) {
	db := setupDesignPaymentDB(t)
	_, providerID, bookingID := seedDesignPaymentFixtures(t, db)

	svc := &DesignPaymentService{}

	doc, err := svc.UploadWorkingDoc(providerID, bookingID, &UploadWorkingDocInput{
		DocType:     "sketch",
		Title:       "量房草图v1",
		Description: "初步量房记录",
		Files:       `[{"url":"https://example.com/sketch.jpg","name":"sketch.jpg"}]`,
	})

	if err != nil {
		t.Fatalf("upload working doc: %v", err)
	}
	if doc.ID == 0 {
		t.Fatal("expected doc ID > 0")
	}
	if doc.DocType != "sketch" {
		t.Errorf("expected docType=sketch, got %s", doc.DocType)
	}
}

func TestListWorkingDocs_Empty(t *testing.T) {
	db := setupDesignPaymentDB(t)
	_, _, bookingID := seedDesignPaymentFixtures(t, db)

	svc := &DesignPaymentService{}

	docs, err := svc.ListWorkingDocs(bookingID)
	if err != nil {
		t.Fatalf("list working docs: %v", err)
	}
	if len(docs) != 0 {
		t.Errorf("expected 0 docs, got %d", len(docs))
	}
}

func TestCreateDesignFeeQuote(t *testing.T) {
	db := setupDesignPaymentDB(t)
	_, providerID, bookingID := seedDesignPaymentFixtures(t, db)

	svc := &DesignPaymentService{}

	quote, err := svc.CreateDesignFeeQuote(providerID, bookingID, &CreateDesignFeeQuoteInput{
		TotalFee:    8000,
		PaymentMode: "onetime",
		Description: "全套设计服务",
	})

	if err != nil {
		t.Fatalf("create design fee quote: %v", err)
	}
	if quote.ID == 0 {
		t.Fatal("expected quote ID > 0")
	}
	if quote.NetAmount != 7500 {
		t.Errorf("expected netAmount=7500, got %f", quote.NetAmount)
	}
	if quote.Status != model.DesignFeeQuoteStatusPending {
		t.Errorf("expected status=pending, got %s", quote.Status)
	}

	var notification model.Notification
	if err := db.Where("user_id = ? AND related_id = ? AND type = ?", uint64(1), quote.ID, "proposal.design_fee_quote_created").First(&notification).Error; err != nil {
		t.Fatalf("expected design fee quote notification: %v", err)
	}
	if notification.ActionURL != "/bookings/100/design-quote" {
		t.Fatalf("unexpected notification action url: %s", notification.ActionURL)
	}
}

func TestConfirmDesignFeeQuote(t *testing.T) {
	db := setupDesignPaymentDB(t)
	userID, providerID, bookingID := seedDesignPaymentFixtures(t, db)

	svc := &DesignPaymentService{}

	quote, _ := svc.CreateDesignFeeQuote(providerID, bookingID, &CreateDesignFeeQuoteInput{
		TotalFee:    5000,
		PaymentMode: "onetime",
	})

	order, err := svc.ConfirmDesignFeeQuote(userID, quote.ID)
	if err != nil {
		t.Fatalf("confirm quote: %v", err)
	}
	if order.ID == 0 {
		t.Error("expected order ID > 0 after confirmation")
	}
	if order.BookingID != bookingID {
		t.Fatalf("expected order linked by booking_id=%d, got %d", bookingID, order.BookingID)
	}
	if order.ProposalID != 0 {
		t.Fatalf("expected quote order not to depend on proposal_id, got %d", order.ProposalID)
	}
	// verify quote status in DB
	var updatedQuote model.DesignFeeQuote
	db.First(&updatedQuote, quote.ID)
	if updatedQuote.Status != model.DesignFeeQuoteStatusConfirmed {
		t.Errorf("expected quote status=confirmed, got %s", updatedQuote.Status)
	}

	var notification model.Notification
	if err := db.Where("user_id = ? AND related_id = ? AND type = ?", uint64(1), order.ID, model.NotificationTypeOrderCreated).First(&notification).Error; err != nil {
		t.Fatalf("expected design fee order notification: %v", err)
	}
	if notification.ActionURL != "/bookings/100/design-quote" {
		t.Fatalf("unexpected order notification action url: %s", notification.ActionURL)
	}
}

func TestRejectDesignFeeQuote(t *testing.T) {
	db := setupDesignPaymentDB(t)
	userID, providerID, bookingID := seedDesignPaymentFixtures(t, db)

	svc := &DesignPaymentService{}

	quote, _ := svc.CreateDesignFeeQuote(providerID, bookingID, &CreateDesignFeeQuoteInput{
		TotalFee:    5000,
		PaymentMode: "onetime",
	})

	err := svc.RejectDesignFeeQuote(userID, quote.ID, "价格太高")
	if err != nil {
		t.Fatalf("reject quote: %v", err)
	}

	var updated model.DesignFeeQuote
	db.First(&updated, quote.ID)
	if updated.Status != model.DesignFeeQuoteStatusRejected {
		t.Errorf("expected status=rejected, got %s", updated.Status)
	}
	if updated.RejectionReason != "价格太高" {
		t.Errorf("expected rejection reason, got %s", updated.RejectionReason)
	}
}

func TestSubmitDesignDeliverable(t *testing.T) {
	db := setupDesignPaymentDB(t)
	userID, providerID, bookingID := seedDesignPaymentFixtures(t, db)
	project := model.Project{Base: model.Base{ID: 200}, OwnerID: userID, ProviderID: providerID, Name: "设计交付项目"}
	if err := db.Create(&project).Error; err != nil {
		t.Fatalf("create project: %v", err)
	}

	svc := &DesignPaymentService{}

	deliverable, err := svc.SubmitDesignDeliverable(providerID, &SubmitDeliverableInput{
		BookingID:       bookingID,
		ProjectID:       project.ID,
		ColorFloorPlan:  `["https://example.com/plan.jpg"]`,
		Renderings:      `["https://example.com/render.jpg"]`,
		TextDescription: "设计方案说明",
	})

	if err != nil {
		t.Fatalf("submit deliverable: %v", err)
	}
	if deliverable.ID == 0 {
		t.Fatal("expected deliverable ID > 0")
	}
	if deliverable.Status != model.DesignDeliverableStatusSubmitted {
		t.Errorf("expected status=submitted, got %s", deliverable.Status)
	}
	var notification model.Notification
	if err := db.Where("user_id = ? AND type = ?", userID, NotificationTypeDeliverableSubmitted).Order("id DESC").First(&notification).Error; err != nil {
		t.Fatalf("expected deliverable notification: %v", err)
	}
	if notification.ActionURL != "/bookings/100/design-deliverable" {
		t.Fatalf("unexpected deliverable action url: %+v", notification)
	}
}

func TestGetDesignDeliverableByBookingForUser(t *testing.T) {
	db := setupDesignPaymentDB(t)
	userID, providerID, bookingID := seedDesignPaymentFixtures(t, db)

	deliverable := model.DesignDeliverable{
		Base:            model.Base{ID: 501},
		BookingID:       bookingID,
		ProviderID:      providerID,
		Status:          model.DesignDeliverableStatusSubmitted,
		ColorFloorPlan:  `["/uploads/design/floor-plan.jpg"]`,
		TextDescription: "交付说明",
	}
	if err := db.Create(&deliverable).Error; err != nil {
		t.Fatalf("create deliverable: %v", err)
	}

	result, err := (&DesignPaymentService{}).GetDesignDeliverableByBookingForUser(userID, bookingID)
	if err != nil {
		t.Fatalf("GetDesignDeliverableByBookingForUser: %v", err)
	}
	if result.ID != deliverable.ID {
		t.Fatalf("expected deliverable id=%d, got %d", deliverable.ID, result.ID)
	}
	if result.ColorFloorPlan == deliverable.ColorFloorPlan {
		t.Fatalf("expected deliverable assets to be hydrated, got raw value %s", result.ColorFloorPlan)
	}
}

func TestAcceptDesignDeliverable(t *testing.T) {
	db := setupDesignPaymentDB(t)
	userID, providerID, bookingID := seedDesignPaymentFixtures(t, db)

	svc := &DesignPaymentService{}

	deliverable, _ := svc.SubmitDesignDeliverable(providerID, &SubmitDeliverableInput{
		BookingID:       bookingID,
		ColorFloorPlan:  `["https://example.com/plan.jpg"]`,
		TextDescription: "设计方案",
	})

	accepted, err := svc.AcceptDesignDeliverable(userID, deliverable.ID)
	if err != nil {
		t.Fatalf("accept deliverable: %v", err)
	}
	if accepted.Status != model.DesignDeliverableStatusAccepted {
		t.Errorf("expected status=accepted, got %s", accepted.Status)
	}
}

func TestRejectDesignDeliverable(t *testing.T) {
	db := setupDesignPaymentDB(t)
	userID, providerID, bookingID := seedDesignPaymentFixtures(t, db)

	svc := &DesignPaymentService{}

	deliverable, _ := svc.SubmitDesignDeliverable(providerID, &SubmitDeliverableInput{
		BookingID:      bookingID,
		ColorFloorPlan: `["https://example.com/plan.jpg"]`,
	})

	_, err := svc.RejectDesignDeliverable(userID, deliverable.ID, "效果图不够清晰")
	if err != nil {
		t.Fatalf("reject deliverable: %v", err)
	}

	var updated model.DesignDeliverable
	db.First(&updated, deliverable.ID)
	if updated.Status != model.DesignDeliverableStatusRejected {
		t.Errorf("expected status=rejected, got %s", updated.Status)
	}
}

func TestRejectDesignDeliverable_EmptyReason(t *testing.T) {
	db := setupDesignPaymentDB(t)
	userID, providerID, bookingID := seedDesignPaymentFixtures(t, db)

	svc := &DesignPaymentService{}

	deliverable, _ := svc.SubmitDesignDeliverable(providerID, &SubmitDeliverableInput{
		BookingID:      bookingID,
		ColorFloorPlan: `["https://example.com/plan.jpg"]`,
	})

	_, err := svc.RejectDesignDeliverable(userID, deliverable.ID, "")
	if err == nil {
		t.Fatal("expected error for empty rejection reason")
	}
}

func TestConfirmDesignFeeQuote_AlreadyConfirmed(t *testing.T) {
	db := setupDesignPaymentDB(t)
	userID, providerID, bookingID := seedDesignPaymentFixtures(t, db)

	svc := &DesignPaymentService{}

	quote, _ := svc.CreateDesignFeeQuote(providerID, bookingID, &CreateDesignFeeQuoteInput{
		TotalFee:    5000,
		PaymentMode: "onetime",
	})

	_, _ = svc.ConfirmDesignFeeQuote(userID, quote.ID)
	_, err := svc.ConfirmDesignFeeQuote(userID, quote.ID)
	if err == nil {
		t.Fatal("expected error when confirming already confirmed quote")
	}
}

func TestProcessScheduledReleases_NoDue(t *testing.T) {
	db := setupDesignPaymentDB(t)

	// Milestone not yet due
	if err := db.AutoMigrate(&model.Milestone{}, &model.Project{}); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	future := time.Now().Add(24 * time.Hour)
	db.Create(&model.Milestone{
		Base:               model.Base{ID: 1},
		ProjectID:          999,
		Status:             model.MilestoneStatusAccepted,
		ReleaseScheduledAt: &future,
	})

	svc := &EscrowService{}
	count, err := svc.ProcessScheduledReleases()
	if err != nil {
		t.Fatalf("process: %v", err)
	}
	if count != 0 {
		t.Errorf("expected 0 releases for future milestone, got %d", count)
	}
}
