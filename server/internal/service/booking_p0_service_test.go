package service

import (
	"testing"
	"time"

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
	if err := db.AutoMigrate(&model.User{}, &model.Provider{}, &model.Booking{}, &model.SiteSurvey{}, &model.BudgetConfirmation{}, &model.BusinessFlow{}, &model.Notification{}); err != nil {
		t.Fatalf("migrate sqlite db: %v", err)
	}
	if err := db.AutoMigrate(
		&model.Proposal{},
		&model.Order{},
		&model.DesignFeeQuote{},
		&model.DesignDeliverable{},
		&model.QuantityBase{},
		&model.QuantityBaseItem{},
		&model.QuoteList{},
		&model.QuoteListItem{},
		&model.QuoteInvitation{},
		&model.QuoteSubmission{},
		&model.MerchantServiceSetting{},
		&model.QuoteLibraryItem{},
		&model.QuoteTemplate{},
		&model.QuoteTemplateItem{},
		&model.QuotePriceBook{},
		&model.QuotePriceBookItem{},
	); err != nil {
		t.Fatalf("migrate bridge models: %v", err)
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

	summary, err := svc.GetBookingP0Summary(booking.ID)
	if err != nil {
		t.Fatalf("GetBookingP0Summary after survey: %v", err)
	}
	if summary.CurrentStage != model.BusinessFlowStageNegotiating {
		t.Fatalf("expected negotiating stage after survey submit, got %s", summary.CurrentStage)
	}
	if len(summary.AvailableActions) != 1 || summary.AvailableActions[0] != "submit_budget" {
		t.Fatalf("expected submit_budget action after survey submit, got %+v", summary.AvailableActions)
	}

	budget, err := svc.SubmitMerchantBudgetConfirmation(provider.ID, booking.ID, &BudgetConfirmationPayload{
		BudgetMin:            50000,
		BudgetMax:            80000,
		Includes:             BudgetIncludes{DesignFee: true, ConstructionFee: true, MaterialFee: true},
		Notes:                "包含基础施工与主材",
		DesignIntent:         "现代简约、收纳优先",
		StyleDirection:       "现代简约 / 原木",
		SpaceRequirements:    "客厅收纳、儿童房学习区",
		ExpectedDurationDays: 90,
		SpecialRequirements:  "保留老人房通行空间",
	})
	if err != nil {
		t.Fatalf("SubmitMerchantBudgetConfirmation: %v", err)
	}
	if budget.Status != model.BudgetConfirmationStatusSubmitted {
		t.Fatalf("expected submitted budget status, got %s", budget.Status)
	}
	if budget.StyleDirection != "现代简约 / 原木" || budget.ExpectedDurationDays != 90 {
		t.Fatalf("expected structured budget fields to be persisted, got %+v", budget)
	}
	var notification model.Notification
	if err := db.Where("user_id = ? AND type = ?", user.ID, NotificationTypeBudgetConfirmationSubmitted).First(&notification).Error; err != nil {
		t.Fatalf("expected budget confirmation notification: %v", err)
	}
	if notification.ActionURL != "/bookings/1003/budget-confirm" {
		t.Fatalf("unexpected budget notification actionUrl: %+v", notification)
	}

	summary, err = svc.GetBookingP0Summary(booking.ID)
	if err != nil {
		t.Fatalf("GetBookingP0Summary after budget: %v", err)
	}
	if summary.CurrentStage != model.BusinessFlowStageNegotiating {
		t.Fatalf("expected negotiating stage while waiting user confirm, got %s", summary.CurrentStage)
	}
	if len(summary.AvailableActions) != 0 {
		t.Fatalf("expected no merchant actions while waiting user confirm, got %+v", summary.AvailableActions)
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

func TestMerchantDesignerFlowWorkspaceSurveyDirectsToBudget(t *testing.T) {
	db := setupBookingP0TestDB(t)
	_, provider, booking := seedConfirmedBookingFlow(t, db)
	svc := &BookingService{}

	if _, err := svc.SubmitMerchantSiteSurvey(provider.ID, booking.ID, &SiteSurveyPayload{
		Photos: []string{"/uploads/survey-1.jpg"},
		Notes:  "首次量房",
	}); err != nil {
		t.Fatalf("SubmitMerchantSiteSurvey: %v", err)
	}

	workspace, err := svc.GetMerchantDesignerFlowWorkspace(provider.ID, booking.ID)
	if err != nil {
		t.Fatalf("GetMerchantDesignerFlowWorkspace after survey: %v", err)
	}
	if workspace.CurrentStepKey != "budget" {
		t.Fatalf("expected current step budget after survey submit, got %s", workspace.CurrentStepKey)
	}

	surveyStep := findMerchantFlowStep(t, workspace.Steps, "survey")
	if surveyStep.Status != "completed" {
		t.Fatalf("expected survey step completed, got %s", surveyStep.Status)
	}

	budgetStep := findMerchantFlowStep(t, workspace.Steps, "budget")
	if budgetStep.Status != "pending_submit" {
		t.Fatalf("expected budget step pending_submit, got %s", budgetStep.Status)
	}

	if _, err := svc.SubmitMerchantBudgetConfirmation(provider.ID, booking.ID, &BudgetConfirmationPayload{
		BudgetMin:            60000,
		BudgetMax:            90000,
		Includes:             BudgetIncludes{DesignFee: true, ConstructionFee: true},
		DesignIntent:         "现代简约，收纳优先",
		StyleDirection:       "现代简约",
		SpaceRequirements:    "主卧衣帽收纳加强",
		ExpectedDurationDays: 75,
		SpecialRequirements:  "保留儿童房活动区",
		Notes:                "先确认方向再报价",
	}); err != nil {
		t.Fatalf("SubmitMerchantBudgetConfirmation: %v", err)
	}

	workspace, err = svc.GetMerchantDesignerFlowWorkspace(provider.ID, booking.ID)
	if err != nil {
		t.Fatalf("GetMerchantDesignerFlowWorkspace after budget: %v", err)
	}
	if workspace.CurrentStepKey != "budget" {
		t.Fatalf("expected current step remain budget while waiting user, got %s", workspace.CurrentStepKey)
	}

	budgetStep = findMerchantFlowStep(t, workspace.Steps, "budget")
	if budgetStep.Status != "pending_user" {
		t.Fatalf("expected budget step pending_user, got %s", budgetStep.Status)
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
		BudgetMin:            50000,
		BudgetMax:            80000,
		Includes:             BudgetIncludes{DesignFee: true, ConstructionFee: true},
		DesignIntent:         "现代简约",
		StyleDirection:       "现代",
		SpaceRequirements:    "动静分区",
		ExpectedDurationDays: 60,
	}); err == nil || err.Error() != "请等待用户先支付量房费" {
		t.Fatalf("expected budget submit to be blocked before payment, got %v", err)
	}
}

func TestBookingP0RejectBudgetClosesBookingAtRejectLimit(t *testing.T) {
	db := setupBookingP0TestDB(t)
	user, provider, booking := seedConfirmedBookingFlow(t, db)
	svc := &BookingService{}

	if _, err := svc.SubmitMerchantSiteSurvey(provider.ID, booking.ID, &SiteSurveyPayload{
		Photos:     []string{"/uploads/survey-1.jpg"},
		Dimensions: map[string]SurveyDimension{"客厅": {Length: 5.2, Width: 4.6, Height: 2.8, Unit: "m"}},
	}); err != nil {
		t.Fatalf("submit survey: %v", err)
	}
	for round := 1; round <= 3; round++ {
		detail, err := svc.SubmitMerchantBudgetConfirmation(provider.ID, booking.ID, &BudgetConfirmationPayload{
			BudgetMin:            60000,
			BudgetMax:            90000,
			Includes:             BudgetIncludes{DesignFee: true, ConstructionFee: true},
			DesignIntent:         "奶油风",
			StyleDirection:       "奶油原木",
			SpaceRequirements:    "厨房收纳提升",
			ExpectedDurationDays: 70,
			SpecialRequirements:  "保留储物间",
		})
		if err != nil {
			t.Fatalf("submit budget round %d: %v", round, err)
		}
		if detail.RejectLimit != 3 {
			t.Fatalf("expected reject limit 3, got %d", detail.RejectLimit)
		}

		rejected, err := svc.RejectBudgetConfirmation(user.ID, booking.ID, "预算超出承受范围")
		if err != nil {
			t.Fatalf("RejectBudgetConfirmation round %d: %v", round, err)
		}
		if rejected.RejectCount != round {
			t.Fatalf("expected rejectCount %d, got %d", round, rejected.RejectCount)
		}

		var updated model.Booking
		if err := db.First(&updated, booking.ID).Error; err != nil {
			t.Fatalf("reload booking round %d: %v", round, err)
		}
		var flow model.BusinessFlow
		if err := db.Where("source_type = ? AND source_id = ?", model.BusinessFlowSourceBooking, booking.ID).First(&flow).Error; err != nil {
			t.Fatalf("load flow round %d: %v", round, err)
		}

		if round < 3 {
			if updated.Status != 2 {
				t.Fatalf("expected booking stay confirmed before limit, got %d", updated.Status)
			}
			if flow.CurrentStage != model.BusinessFlowStageNegotiating {
				t.Fatalf("expected negotiating stage before limit, got %s", flow.CurrentStage)
			}
			if !rejected.CanResubmit {
				t.Fatalf("expected canResubmit before limit")
			}
			continue
		}

		if updated.Status != 4 {
			t.Fatalf("expected booking cancelled at limit, got %d", updated.Status)
		}
		if flow.CurrentStage != model.BusinessFlowStageCancelled {
			t.Fatalf("expected cancelled stage at limit, got %s", flow.CurrentStage)
		}
		if rejected.CanResubmit {
			t.Fatalf("expected canResubmit=false at limit")
		}
	}
}

func TestBookingP0SiteSurveyActionsAreDeprecated(t *testing.T) {
	db := setupBookingP0TestDB(t)
	user, provider, booking := seedConfirmedBookingFlow(t, db)
	svc := &BookingService{}

	if _, err := svc.SubmitMerchantSiteSurvey(provider.ID, booking.ID, &SiteSurveyPayload{
		Photos: []string{"/uploads/survey-1.jpg"},
		Notes:  "首次量房",
	}); err != nil {
		t.Fatalf("SubmitMerchantSiteSurvey: %v", err)
	}

	if _, err := svc.ConfirmSiteSurvey(user.ID, booking.ID); err == nil || err.Error() != "量房资料仅供查看，无需用户确认，请直接等待沟通确认" {
		t.Fatalf("expected confirm site survey deprecated error, got %v", err)
	}
	if _, err := svc.RejectSiteSurvey(user.ID, booking.ID, "尺寸需补测"); err == nil || err.Error() != "量房资料仅供查看，无需用户退回，请在沟通确认节点填写调整意见" {
		t.Fatalf("expected reject site survey deprecated error, got %v", err)
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

func TestBookingP0SurveyAllowsPhotoOnlyPayload(t *testing.T) {
	db := setupBookingP0TestDB(t)
	_, provider, booking := seedConfirmedBookingFlow(t, db)
	svc := &BookingService{}

	survey, err := svc.SubmitMerchantSiteSurvey(provider.ID, booking.ID, &SiteSurveyPayload{
		Photos: []string{"/uploads/survey-file.pdf"},
		Notes:  "仅上传量房资料附件",
	})
	if err != nil {
		t.Fatalf("SubmitMerchantSiteSurvey photo-only: %v", err)
	}
	if survey == nil || len(survey.Photos) != 1 {
		t.Fatalf("expected photo-only survey saved, got %+v", survey)
	}
	if len(survey.Dimensions) != 0 {
		t.Fatalf("expected empty dimensions, got %+v", survey.Dimensions)
	}
}

func TestMerchantDesignerFlowWorkspace_ConstructionPreparationStages(t *testing.T) {
	db := setupBookingP0TestDB(t)
	user, provider, booking := seedConfirmedBookingFlow(t, db)

	siteSurvey := &model.SiteSurvey{
		Base:       model.Base{ID: 3010},
		BookingID:  booking.ID,
		ProviderID: provider.ID,
		Photos:     `["/uploads/survey.jpg"]`,
		Status:     model.SiteSurveyStatusConfirmed,
	}
	budgetConfirm := &model.BudgetConfirmation{
		Base:                 model.Base{ID: 3011},
		BookingID:            booking.ID,
		ProviderID:           provider.ID,
		Status:               model.BudgetConfirmationStatusAccepted,
		BudgetMin:            60000,
		BudgetMax:            90000,
		DesignIntent:         "现代简约",
		StyleDirection:       "现代简约",
		SpaceRequirements:    "收纳优先",
		ExpectedDurationDays: 90,
	}
	paidAt := func() *time.Time {
		now := time.Now()
		return &now
	}()
	order := &model.Order{
		Base:        model.Base{ID: 3012},
		BookingID:   booking.ID,
		OrderNo:     "TEST-DESIGN-3012",
		OrderType:   model.OrderTypeDesign,
		TotalAmount: 8000,
		PaidAmount:  8000,
		Status:      model.OrderStatusPaid,
		PaidAt:      paidAt,
	}
	designQuote := &model.DesignFeeQuote{
		Base:        model.Base{ID: 3013},
		BookingID:   booking.ID,
		ProviderID:  provider.ID,
		TotalFee:    8000,
		NetAmount:   8000,
		Status:      model.DesignFeeQuoteStatusConfirmed,
		OrderID:     order.ID,
		ConfirmedAt: paidAt,
	}

	proposal := &model.Proposal{
		Base:              model.Base{ID: 3001},
		BookingID:         booking.ID,
		DesignerID:        provider.ID,
		Summary:           "正式方案已确认",
		Status:            model.ProposalStatusConfirmed,
		SourceType:        model.ProposalSourceBooking,
		Version:           1,
		InternalDraftJSON: `{"rooms":[{"name":"客厅","items":[{"name":"墙地面防水","unit":"㎡","quantity":18,"note":"厨房卫生间"}]}]}`,
	}
	deliverable := &model.DesignDeliverable{
		Base:       model.Base{ID: 3002},
		BookingID:  booking.ID,
		ProviderID: provider.ID,
		Status:     model.DesignDeliverableStatusAccepted,
	}
	if err := db.Create(proposal).Error; err != nil {
		t.Fatalf("create proposal: %v", err)
	}
	seedQuotePreparationTemplate(t, db, "三居", "全屋翻新", model.QuoteLibraryItem{
		Base:         model.Base{ID: 3201},
		StandardCode: "STD-WP-3201",
		ERPItemCode:  "ERP-WP-3201",
		Name:         "墙地面防水",
		Unit:         "㎡",
		CategoryL1:   "泥瓦",
		CategoryL2:   "防水",
	}, true)
	for _, record := range []interface{}{siteSurvey, budgetConfirm, order, designQuote} {
		if err := db.Create(record).Error; err != nil {
			t.Fatalf("create design chain record: %v", err)
		}
	}
	if err := db.Create(deliverable).Error; err != nil {
		t.Fatalf("create deliverable: %v", err)
	}
	if err := db.Model(&model.BusinessFlow{}).
		Where("source_type = ? AND source_id = ?", model.BusinessFlowSourceBooking, booking.ID).
		Update("current_stage", model.BusinessFlowStageConstructionPartyPending).Error; err != nil {
		t.Fatalf("update business flow stage: %v", err)
	}

	quoteSvc := &QuoteService{}
	preparation, err := quoteSvc.StartMerchantConstructionPreparation(provider.ID, booking.ID)
	if err != nil {
		t.Fatalf("StartMerchantConstructionPreparation: %v", err)
	}
	if preparation.QuoteListID == 0 {
		t.Fatalf("expected quote list id after start")
	}

	workspace, err := (&BookingService{}).GetMerchantDesignerFlowWorkspace(provider.ID, booking.ID)
	if err != nil {
		t.Fatalf("GetMerchantDesignerFlowWorkspace after construction prep start: %v", err)
	}
	if workspace.CurrentStepKey != "construction_prep" {
		t.Fatalf("expected current step construction_prep, got %s", workspace.CurrentStepKey)
	}
	constructionPrepStep := findMerchantFlowStep(t, workspace.Steps, "construction_prep")
	if constructionPrepStep.Status != "pending_submit" {
		t.Fatalf("expected construction_prep pending_submit, got %s", constructionPrepStep.Status)
	}
	constructionStep := findMerchantFlowStep(t, workspace.Steps, "construction")
	if constructionStep.Status != "not_started" {
		t.Fatalf("expected construction step not_started, got %s", constructionStep.Status)
	}

	if _, err := quoteSvc.UpdateMerchantConstructionPreparationPrerequisites(provider.ID, preparation.QuoteListID, &QuoteTaskPrerequisiteUpdateInput{
		Area:              booking.Area,
		Layout:            "3室2厅",
		RenovationType:    "全屋翻新",
		ConstructionScope: "防水",
		ServiceAreas:      []string{"浦东新区"},
		HouseUsage:        "自住",
		Notes:             "按已确认方案整理",
	}); err != nil {
		t.Fatalf("UpdateMerchantConstructionPreparationPrerequisites: %v", err)
	}

	workspace, err = (&BookingService{}).GetMerchantDesignerFlowWorkspace(provider.ID, booking.ID)
	if err != nil {
		t.Fatalf("GetMerchantDesignerFlowWorkspace after prerequisites: %v", err)
	}
	if workspace.CurrentStepKey != "construction" {
		t.Fatalf("expected current step construction, got %s", workspace.CurrentStepKey)
	}
	constructionPrepStep = findMerchantFlowStep(t, workspace.Steps, "construction_prep")
	if constructionPrepStep.Status != "completed" {
		t.Fatalf("expected construction_prep completed, got %s", constructionPrepStep.Status)
	}
	constructionStep = findMerchantFlowStep(t, workspace.Steps, "construction")
	if constructionStep.Status != "pending_submit" {
		t.Fatalf("expected construction step pending_submit, got %s", constructionStep.Status)
	}
	if workspace.ConstructionPreparation == nil || workspace.ConstructionPreparation.QuoteListID == 0 {
		t.Fatalf("expected construction preparation summary in workspace")
	}
	if workspace.Booking.UserID != user.ID {
		t.Fatalf("expected workspace booking user id=%d, got %d", user.ID, workspace.Booking.UserID)
	}
}

func TestMerchantDesignerFlowWorkspace_DoesNotSkipProposalConfirmation(t *testing.T) {
	db := setupBookingP0TestDB(t)
	_, provider, booking := seedConfirmedBookingFlow(t, db)

	siteSurvey := &model.SiteSurvey{
		Base:       model.Base{ID: 3103},
		BookingID:  booking.ID,
		ProviderID: provider.ID,
		Photos:     `["/uploads/survey.jpg"]`,
		Status:     model.SiteSurveyStatusConfirmed,
	}
	budgetConfirm := &model.BudgetConfirmation{
		Base:              model.Base{ID: 3104},
		BookingID:         booking.ID,
		ProviderID:        provider.ID,
		Status:            model.BudgetConfirmationStatusAccepted,
		BudgetMin:         60000,
		BudgetMax:         90000,
		DesignIntent:      "现代简约",
		StyleDirection:    "现代简约",
		SpaceRequirements: "收纳优先",
	}
	paidAt := func() *time.Time {
		now := time.Now()
		return &now
	}()
	order := &model.Order{
		Base:        model.Base{ID: 3105},
		BookingID:   booking.ID,
		OrderNo:     "TEST-DESIGN-3105",
		OrderType:   model.OrderTypeDesign,
		TotalAmount: 8000,
		PaidAmount:  8000,
		Status:      model.OrderStatusPaid,
		PaidAt:      paidAt,
	}
	designQuote := &model.DesignFeeQuote{
		Base:        model.Base{ID: 3106},
		BookingID:   booking.ID,
		ProviderID:  provider.ID,
		TotalFee:    8000,
		NetAmount:   8000,
		Status:      model.DesignFeeQuoteStatusConfirmed,
		OrderID:     order.ID,
		ConfirmedAt: paidAt,
	}
	proposal := &model.Proposal{
		Base:       model.Base{ID: 3101},
		BookingID:  booking.ID,
		DesignerID: provider.ID,
		Summary:    "正式方案待确认",
		Status:     model.ProposalStatusPending,
		SourceType: model.ProposalSourceBooking,
		Version:    1,
	}
	deliverable := &model.DesignDeliverable{
		Base:       model.Base{ID: 3102},
		BookingID:  booking.ID,
		ProviderID: provider.ID,
		Status:     model.DesignDeliverableStatusAccepted,
	}
	for _, record := range []interface{}{siteSurvey, budgetConfirm, order, designQuote, proposal, deliverable} {
		if err := db.Create(record).Error; err != nil {
			t.Fatalf("create test chain record: %v", err)
		}
	}
	if err := db.Model(&model.BusinessFlow{}).
		Where("source_type = ? AND source_id = ?", model.BusinessFlowSourceBooking, booking.ID).
		Update("current_stage", model.BusinessFlowStageDesignPendingConfirmation).Error; err != nil {
		t.Fatalf("update business flow stage: %v", err)
	}

	workspace, err := (&BookingService{}).GetMerchantDesignerFlowWorkspace(provider.ID, booking.ID)
	if err != nil {
		t.Fatalf("GetMerchantDesignerFlowWorkspace: %v", err)
	}
	if workspace.CurrentStepKey != "confirm" {
		t.Fatalf("expected current step confirm, got %s", workspace.CurrentStepKey)
	}

	confirmStep := findMerchantFlowStep(t, workspace.Steps, "confirm")
	if confirmStep.Status != "pending_user" {
		t.Fatalf("expected confirm step pending_user, got %s", confirmStep.Status)
	}
	constructionPrepStep := findMerchantFlowStep(t, workspace.Steps, "construction_prep")
	if constructionPrepStep.Status != "not_started" {
		t.Fatalf("expected construction_prep not_started, got %s", constructionPrepStep.Status)
	}
	if constructionPrepStep.BlockedReason != "需先完成正式方案确认" {
		t.Fatalf("unexpected construction_prep blocked reason: %s", constructionPrepStep.BlockedReason)
	}
}

func TestMerchantDesignerFlowWorkspace_AcceptedDeliverableWithoutProposalStaysOnConfirm(t *testing.T) {
	db := setupBookingP0TestDB(t)
	_, provider, booking := seedConfirmedBookingFlow(t, db)

	siteSurvey := &model.SiteSurvey{
		Base:       model.Base{ID: 3202},
		BookingID:  booking.ID,
		ProviderID: provider.ID,
		Photos:     `["/uploads/survey.jpg"]`,
		Status:     model.SiteSurveyStatusConfirmed,
	}
	budgetConfirm := &model.BudgetConfirmation{
		Base:              model.Base{ID: 3203},
		BookingID:         booking.ID,
		ProviderID:        provider.ID,
		Status:            model.BudgetConfirmationStatusAccepted,
		BudgetMin:         60000,
		BudgetMax:         90000,
		DesignIntent:      "现代简约",
		StyleDirection:    "现代简约",
		SpaceRequirements: "收纳优先",
	}
	paidAt := func() *time.Time {
		now := time.Now()
		return &now
	}()
	order := &model.Order{
		Base:        model.Base{ID: 3204},
		BookingID:   booking.ID,
		OrderNo:     "TEST-DESIGN-3204",
		OrderType:   model.OrderTypeDesign,
		TotalAmount: 8000,
		PaidAmount:  8000,
		Status:      model.OrderStatusPaid,
		PaidAt:      paidAt,
	}
	designQuote := &model.DesignFeeQuote{
		Base:        model.Base{ID: 3205},
		BookingID:   booking.ID,
		ProviderID:  provider.ID,
		TotalFee:    8000,
		NetAmount:   8000,
		Status:      model.DesignFeeQuoteStatusConfirmed,
		OrderID:     order.ID,
		ConfirmedAt: paidAt,
	}
	deliverable := &model.DesignDeliverable{
		Base:       model.Base{ID: 3201},
		BookingID:  booking.ID,
		ProviderID: provider.ID,
		Status:     model.DesignDeliverableStatusAccepted,
	}
	for _, record := range []interface{}{siteSurvey, budgetConfirm, order, designQuote, deliverable} {
		if err := db.Create(record).Error; err != nil {
			t.Fatalf("create test chain record: %v", err)
		}
	}
	if err := db.Model(&model.BusinessFlow{}).
		Where("source_type = ? AND source_id = ?", model.BusinessFlowSourceBooking, booking.ID).
		Update("current_stage", model.BusinessFlowStageDesignDeliveryPending).Error; err != nil {
		t.Fatalf("update business flow stage: %v", err)
	}

	workspace, err := (&BookingService{}).GetMerchantDesignerFlowWorkspace(provider.ID, booking.ID)
	if err != nil {
		t.Fatalf("GetMerchantDesignerFlowWorkspace: %v", err)
	}
	if workspace.CurrentStepKey != "confirm" {
		t.Fatalf("expected current step confirm, got %s", workspace.CurrentStepKey)
	}

	confirmStep := findMerchantFlowStep(t, workspace.Steps, "confirm")
	if confirmStep.Status != "pending_submit" {
		t.Fatalf("expected confirm step pending_submit, got %s", confirmStep.Status)
	}
	constructionPrepStep := findMerchantFlowStep(t, workspace.Steps, "construction_prep")
	if constructionPrepStep.Status != "not_started" {
		t.Fatalf("expected construction_prep not_started, got %s", constructionPrepStep.Status)
	}
}

func TestMerchantDesignerFlowWorkspace_SubmittedDeliverableDoesNotAdvanceConfirm(t *testing.T) {
	db := setupBookingP0TestDB(t)
	_, provider, booking := seedConfirmedBookingFlow(t, db)

	siteSurvey := &model.SiteSurvey{
		Base:       model.Base{ID: 3302},
		BookingID:  booking.ID,
		ProviderID: provider.ID,
		Photos:     `["/uploads/survey.jpg"]`,
		Status:     model.SiteSurveyStatusConfirmed,
	}
	budgetConfirm := &model.BudgetConfirmation{
		Base:              model.Base{ID: 3303},
		BookingID:         booking.ID,
		ProviderID:        provider.ID,
		Status:            model.BudgetConfirmationStatusAccepted,
		BudgetMin:         60000,
		BudgetMax:         90000,
		DesignIntent:      "现代简约",
		StyleDirection:    "现代简约",
		SpaceRequirements: "收纳优先",
	}
	paidAt := func() *time.Time {
		now := time.Now()
		return &now
	}()
	order := &model.Order{
		Base:        model.Base{ID: 3304},
		BookingID:   booking.ID,
		OrderNo:     "TEST-DESIGN-3304",
		OrderType:   model.OrderTypeDesign,
		TotalAmount: 8000,
		PaidAmount:  8000,
		Status:      model.OrderStatusPaid,
		PaidAt:      paidAt,
	}
	designQuote := &model.DesignFeeQuote{
		Base:        model.Base{ID: 3305},
		BookingID:   booking.ID,
		ProviderID:  provider.ID,
		TotalFee:    8000,
		NetAmount:   8000,
		Status:      model.DesignFeeQuoteStatusConfirmed,
		OrderID:     order.ID,
		ConfirmedAt: paidAt,
	}
	deliverable := &model.DesignDeliverable{
		Base:       model.Base{ID: 3301},
		BookingID:  booking.ID,
		ProviderID: provider.ID,
		Status:     model.DesignDeliverableStatusSubmitted,
	}
	for _, record := range []interface{}{siteSurvey, budgetConfirm, order, designQuote, deliverable} {
		if err := db.Create(record).Error; err != nil {
			t.Fatalf("create test chain record: %v", err)
		}
	}
	if err := db.Model(&model.BusinessFlow{}).
		Where("source_type = ? AND source_id = ?", model.BusinessFlowSourceBooking, booking.ID).
		Update("current_stage", model.BusinessFlowStageDesignAcceptancePending).Error; err != nil {
		t.Fatalf("update business flow stage: %v", err)
	}

	workspace, err := (&BookingService{}).GetMerchantDesignerFlowWorkspace(provider.ID, booking.ID)
	if err != nil {
		t.Fatalf("GetMerchantDesignerFlowWorkspace: %v", err)
	}
	if workspace.CurrentStepKey != "design" {
		t.Fatalf("expected current step design, got %s", workspace.CurrentStepKey)
	}

	confirmStep := findMerchantFlowStep(t, workspace.Steps, "confirm")
	if confirmStep.Status != "not_started" {
		t.Fatalf("expected confirm step not_started, got %s", confirmStep.Status)
	}
	if confirmStep.BlockedReason != "需先完成设计交付确认" {
		t.Fatalf("unexpected confirm blocked reason: %s", confirmStep.BlockedReason)
	}
}

func findMerchantFlowStep(t *testing.T, steps []MerchantFlowStep, key string) MerchantFlowStep {
	t.Helper()
	for _, step := range steps {
		if step.Key == key {
			return step
		}
	}
	t.Fatalf("merchant flow step %s not found", key)
	return MerchantFlowStep{}
}
