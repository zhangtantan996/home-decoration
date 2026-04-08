package service

import (
	"testing"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"

	gormsqlite "gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupBookingP0TestDB(t *testing.T) *gorm.DB {
	t.Helper()

	db, err := gorm.Open(gormsqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite db: %v", err)
	}
	if err := db.AutoMigrate(&model.User{}, &model.Provider{}, &model.Booking{}, &model.SiteSurvey{}, &model.BudgetConfirmation{}, &model.BusinessFlow{}); err != nil {
		t.Fatalf("migrate sqlite db: %v", err)
	}
	previousDB := repository.DB
	repository.DB = db
	t.Cleanup(func() { repository.DB = previousDB })
	return db
}

func seedConfirmedBookingFlow(t *testing.T, db *gorm.DB) (*model.User, *model.Provider, *model.Booking) {
	t.Helper()
	user := &model.User{Base: model.Base{ID: 1001}, Phone: "13800138001", Status: 1}
	provider := &model.Provider{Base: model.Base{ID: 1002}, ProviderType: 1, CompanyName: "设计师A"}
	booking := &model.Booking{
		Base:              model.Base{ID: 1003},
		UserID:            user.ID,
		ProviderID:        provider.ID,
		ProviderType:      "designer",
		Address:           "测试小区 1-1",
		Area:              98,
		Status:            2,
		SurveyDeposit:     500,
		SurveyDepositPaid: true,
	}
	flow := &model.BusinessFlow{Base: model.Base{ID: 1004}, SourceType: model.BusinessFlowSourceBooking, SourceID: booking.ID, CustomerUserID: user.ID, DesignerProviderID: provider.ID, CurrentStage: model.BusinessFlowStageNegotiating}
	for _, record := range []interface{}{user, provider, booking, flow} {
		if err := db.Create(record).Error; err != nil {
			t.Fatalf("seed booking p0 record: %v", err)
		}
	}
	return user, provider, booking
}

func TestBookingP0SurveyAndBudgetFlow(t *testing.T) {
	db := setupBookingP0TestDB(t)
	user, provider, booking := seedConfirmedBookingFlow(t, db)
	svc := &BookingService{}

	survey, err := svc.SubmitMerchantSiteSurvey(provider.ID, booking.ID, &SiteSurveyPayload{
		Photos: []string{"/uploads/survey-1.jpg"},
		Dimensions: map[string]SurveyDimension{
			"客厅": {Length: 5.2, Width: 4.6, Height: 2.8, Unit: "m"},
		},
		Notes: "首次量房",
	})
	if err != nil {
		t.Fatalf("SubmitMerchantSiteSurvey: %v", err)
	}
	if survey.Status != model.SiteSurveyStatusSubmitted {
		t.Fatalf("expected submitted survey status, got %s", survey.Status)
	}

	revision, err := svc.RejectSiteSurvey(user.ID, booking.ID, "尺寸需补测")
	if err != nil {
		t.Fatalf("RejectSiteSurvey: %v", err)
	}
	if revision.Status != model.SiteSurveyStatusRevisionRequested {
		t.Fatalf("expected revision_requested, got %s", revision.Status)
	}

	survey, err = svc.SubmitMerchantSiteSurvey(provider.ID, booking.ID, &SiteSurveyPayload{
		Photos: []string{"/uploads/survey-2.jpg"},
		Dimensions: map[string]SurveyDimension{
			"客厅": {Length: 5.2, Width: 4.6, Height: 2.8, Unit: "m"},
			"主卧": {Length: 4.0, Width: 3.6, Height: 2.8, Unit: "m"},
		},
		Notes: "补测完成",
	})
	if err != nil {
		t.Fatalf("re-submit survey: %v", err)
	}
	confirmed, err := svc.ConfirmSiteSurvey(user.ID, booking.ID)
	if err != nil {
		t.Fatalf("ConfirmSiteSurvey: %v", err)
	}
	if confirmed.Status != model.SiteSurveyStatusConfirmed {
		t.Fatalf("expected confirmed survey status, got %s", confirmed.Status)
	}

	budget, err := svc.SubmitMerchantBudgetConfirmation(provider.ID, booking.ID, &BudgetConfirmationPayload{
		BudgetMin:    50000,
		BudgetMax:    80000,
		Includes:     BudgetIncludes{DesignFee: true, ConstructionFee: true, MaterialFee: true},
		Notes:        "包含基础施工与主材",
		DesignIntent: "现代简约、收纳优先",
	})
	if err != nil {
		t.Fatalf("SubmitMerchantBudgetConfirmation: %v", err)
	}
	if budget.Status != model.BudgetConfirmationStatusSubmitted {
		t.Fatalf("expected submitted budget status, got %s", budget.Status)
	}

	accepted, err := svc.AcceptBudgetConfirmation(user.ID, booking.ID)
	if err != nil {
		t.Fatalf("AcceptBudgetConfirmation: %v", err)
	}
	if accepted.Status != model.BudgetConfirmationStatusAccepted {
		t.Fatalf("expected accepted budget status, got %s", accepted.Status)
	}
	var flow model.BusinessFlow
	if err := db.Where("source_type = ? AND source_id = ?", model.BusinessFlowSourceBooking, booking.ID).First(&flow).Error; err != nil {
		t.Fatalf("load business flow: %v", err)
	}
	if flow.CurrentStage != model.BusinessFlowStageDesignPendingSubmission {
		t.Fatalf("expected flow stage design_pending_submission, got %s", flow.CurrentStage)
	}
}

func TestBookingP0RequiresSurveyDepositPaidBeforeMerchantSubmission(t *testing.T) {
	db := setupBookingP0TestDB(t)
	user := &model.User{Base: model.Base{ID: 2001}, Phone: "13800138002", Status: 1}
	provider := &model.Provider{Base: model.Base{ID: 2002}, ProviderType: 1, CompanyName: "设计师B"}
	booking := &model.Booking{
		Base:          model.Base{ID: 2003},
		UserID:        user.ID,
		ProviderID:    provider.ID,
		ProviderType:  "designer",
		Address:       "测试小区 2-1",
		Area:          86,
		Status:        2,
		SurveyDeposit: 500,
	}
	flow := &model.BusinessFlow{Base: model.Base{ID: 2004}, SourceType: model.BusinessFlowSourceBooking, SourceID: booking.ID, CustomerUserID: user.ID, DesignerProviderID: provider.ID, CurrentStage: model.BusinessFlowStageSurveyDepositPending}
	for _, record := range []interface{}{user, provider, booking, flow} {
		if err := db.Create(record).Error; err != nil {
			t.Fatalf("seed booking p0 unpaid record: %v", err)
		}
	}

	svc := &BookingService{}
	if _, err := svc.SubmitMerchantSiteSurvey(provider.ID, booking.ID, &SiteSurveyPayload{
		Photos:     []string{"/uploads/survey-1.jpg"},
		Dimensions: map[string]SurveyDimension{"客厅": {Length: 5.2, Width: 4.6, Height: 2.8, Unit: "m"}},
	}); err == nil || err.Error() != "请等待用户先支付量房费" {
		t.Fatalf("expected survey submit to be blocked before payment, got %v", err)
	}

	if _, err := svc.SubmitMerchantBudgetConfirmation(provider.ID, booking.ID, &BudgetConfirmationPayload{
		BudgetMin:    50000,
		BudgetMax:    80000,
		Includes:     BudgetIncludes{DesignFee: true, ConstructionFee: true},
		DesignIntent: "现代简约",
	}); err == nil || err.Error() != "请等待用户先支付量房费" {
		t.Fatalf("expected budget submit to be blocked before payment, got %v", err)
	}
}

func TestBookingP0RejectBudgetClosesBooking(t *testing.T) {
	db := setupBookingP0TestDB(t)
	user, provider, booking := seedConfirmedBookingFlow(t, db)
	svc := &BookingService{}

	if _, err := svc.SubmitMerchantSiteSurvey(provider.ID, booking.ID, &SiteSurveyPayload{
		Photos:     []string{"/uploads/survey-1.jpg"},
		Dimensions: map[string]SurveyDimension{"客厅": {Length: 5.2, Width: 4.6, Height: 2.8, Unit: "m"}},
	}); err != nil {
		t.Fatalf("submit survey: %v", err)
	}
	if _, err := svc.ConfirmSiteSurvey(user.ID, booking.ID); err != nil {
		t.Fatalf("confirm survey: %v", err)
	}
	if _, err := svc.SubmitMerchantBudgetConfirmation(provider.ID, booking.ID, &BudgetConfirmationPayload{
		BudgetMin:    60000,
		BudgetMax:    90000,
		Includes:     BudgetIncludes{DesignFee: true, ConstructionFee: true},
		DesignIntent: "奶油风",
	}); err != nil {
		t.Fatalf("submit budget: %v", err)
	}
	if _, err := svc.RejectBudgetConfirmation(user.ID, booking.ID, "预算超出承受范围"); err != nil {
		t.Fatalf("RejectBudgetConfirmation: %v", err)
	}

	var updated model.Booking
	if err := db.First(&updated, booking.ID).Error; err != nil {
		t.Fatalf("reload booking: %v", err)
	}
	if updated.Status != 4 {
		t.Fatalf("expected booking cancelled, got %d", updated.Status)
	}
	var flow model.BusinessFlow
	if err := db.Where("source_type = ? AND source_id = ?", model.BusinessFlowSourceBooking, booking.ID).First(&flow).Error; err != nil {
		t.Fatalf("load flow: %v", err)
	}
	if flow.CurrentStage != model.BusinessFlowStageCancelled {
		t.Fatalf("expected cancelled stage, got %s", flow.CurrentStage)
	}
}

func TestBookingP0EmptySurveyAndBudgetReturnNil(t *testing.T) {
	db := setupBookingP0TestDB(t)
	user, provider, booking := seedConfirmedBookingFlow(t, db)
	svc := &BookingService{}

	survey, err := svc.GetMerchantSiteSurvey(provider.ID, booking.ID)
	if err != nil {
		t.Fatalf("GetMerchantSiteSurvey empty: %v", err)
	}
	if survey != nil {
		t.Fatalf("expected nil survey for empty state, got %+v", survey)
	}

	userSurvey, err := svc.GetUserSiteSurvey(user.ID, booking.ID)
	if err != nil {
		t.Fatalf("GetUserSiteSurvey empty: %v", err)
	}
	if userSurvey != nil {
		t.Fatalf("expected nil user survey for empty state, got %+v", userSurvey)
	}

	budget, err := svc.GetMerchantBudgetConfirmation(provider.ID, booking.ID)
	if err != nil {
		t.Fatalf("GetMerchantBudgetConfirmation empty: %v", err)
	}
	if budget != nil {
		t.Fatalf("expected nil budget for empty state, got %+v", budget)
	}

	userBudget, err := svc.GetUserBudgetConfirmation(user.ID, booking.ID)
	if err != nil {
		t.Fatalf("GetUserBudgetConfirmation empty: %v", err)
	}
	if userBudget != nil {
		t.Fatalf("expected nil user budget for empty state, got %+v", userBudget)
	}
}
