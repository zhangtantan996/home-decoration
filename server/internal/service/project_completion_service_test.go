package service

import (
	"testing"
	"time"

	"home-decoration-server/internal/model"

	gormsqlite "gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupProjectCompletionFlowTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(gormsqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite db: %v", err)
	}
	if err := db.AutoMigrate(withPaymentCentralTestModels(
		&model.User{},
		&model.Provider{},
		&model.Project{},
		&model.Notification{},
		&model.AuditLog{},
		&model.ProviderReview{},
		&model.Milestone{},
		&model.WorkLog{},
		&model.Proposal{},
		&model.CaseAudit{},
		&model.BusinessFlow{},
		&model.Order{},
		&model.EscrowAccount{},
		&model.Transaction{},
		&model.MerchantIncome{},
		&model.SystemConfig{},
		&model.QuoteCategory{},
		&model.QuoteLibraryItem{},
		&model.QuoteTemplate{},
		&model.QuoteTemplateItem{},
		&model.QuantityBase{},
		&model.QuantityBaseItem{},
		&model.QuoteList{},
		&model.QuoteListItem{},
		&model.QuoteInvitation{},
		&model.QuoteSubmission{},
		&model.QuoteSubmissionItem{},
		&model.QuoteSubmissionRevision{},
		&model.QuotePriceBook{},
		&model.QuotePriceBookItem{},
	)...); err != nil {
		t.Fatalf("migrate sqlite db: %v", err)
	}
	bindRepositorySQLiteTestDB(t, db)
	return db
}

func seedProjectCompletionFlow(t *testing.T, db *gorm.DB) (*model.User, *model.Provider, *model.Project) {
	t.Helper()
	user := &model.User{Base: model.Base{ID: 2001}, Phone: "13800139001", Status: 1}
	providerUser := &model.User{Base: model.Base{ID: 2000}, Phone: "13800139000", Status: 1}
	provider := &model.Provider{Base: model.Base{ID: 2002}, UserID: providerUser.ID, ProviderType: 2, CompanyName: "施工公司B"}
	project := &model.Project{Base: model.Base{ID: 2003}, OwnerID: user.ID, ProviderID: provider.ID, ConstructionProviderID: provider.ID, Name: "完工测试项目", Address: "测试路 88 号", Budget: 120000, Status: model.ProjectStatusActive, BusinessStatus: model.ProjectBusinessStatusInProgress, CurrentPhase: "待提交完工材料"}
	proposal := &model.Proposal{Base: model.Base{ID: 2004}, BookingID: 1, DesignerID: provider.ID, Summary: "整屋方案", DesignFee: 8000, ConstructionFee: 70000, MaterialFee: 42000}
	flow := &model.BusinessFlow{Base: model.Base{ID: 2005}, SourceType: model.BusinessFlowSourceBooking, SourceID: 1, CustomerUserID: user.ID, DesignerProviderID: provider.ID, ProjectID: project.ID, CurrentStage: model.BusinessFlowStageInConstruction}
	milestones := []model.Milestone{
		{Base: model.Base{ID: 2006}, ProjectID: project.ID, Name: "开工交底", Seq: 1, Amount: 50000, Status: model.MilestoneStatusAccepted},
		{Base: model.Base{ID: 2007}, ProjectID: project.ID, Name: "竣工验收", Seq: 2, Amount: 70000, Status: model.MilestoneStatusAccepted},
	}
	order := &model.Order{Base: model.Base{ID: 2008}, ProjectID: project.ID, BookingID: 1, OrderNo: "ORD-COMPLETE-1", OrderType: model.OrderTypeConstruction, TotalAmount: 120000, PaidAmount: 120000, Status: model.OrderStatusPaid}
	escrow := &model.EscrowAccount{Base: model.Base{ID: 2009}, ProjectID: project.ID, UserID: user.ID, TotalAmount: 120000, AvailableAmount: 120000, Status: escrowStatusActive}
	constructionFeeRate := &model.SystemConfig{Base: model.Base{ID: 2010}, Key: model.ConfigKeyConstructionFeeRate, Value: "0.1", Type: "number"}
	for _, record := range []interface{}{user, providerUser, provider, project, proposal, flow, order, escrow, constructionFeeRate} {
		if err := db.Create(record).Error; err != nil {
			t.Fatalf("seed project completion record: %v", err)
		}
	}
	if err := db.Create(&milestones).Error; err != nil {
		t.Fatalf("create milestones: %v", err)
	}
	return user, provider, project
}

func TestProjectCompletionSubmitRejectApprove(t *testing.T) {
	db := setupProjectCompletionFlowTestDB(t)
	user, provider, project := seedProjectCompletionFlow(t, db)
	svc := &ProjectService{}

	submitted, err := svc.SubmitProjectCompletion(project.ID, provider.ID, &ProjectCompletionPayload{
		Photos: []string{"/uploads/completed-1.jpg", "/uploads/completed-2.jpg"},
		Notes:  "施工范围已全部完成",
	})
	if err != nil {
		t.Fatalf("SubmitProjectCompletion: %v", err)
	}
	if submitted.BusinessStage != model.BusinessFlowStageCompleted {
		t.Fatalf("expected completed stage after submit, got %s", submitted.BusinessStage)
	}
	NewOutboxWorker("project-completion-submit-test").ProcessOnce()
	var submitNotification model.Notification
	if err := db.Where("user_id = ? AND type = ?", user.ID, "project.completion.submitted").Order("id DESC").First(&submitNotification).Error; err != nil {
		t.Fatalf("expected completion submitted notification: %v", err)
	}
	if submitNotification.ActionURL != "/projects/2003/completion" {
		t.Fatalf("expected completion submit actionUrl, got %+v", submitNotification)
	}

	rejected, err := svc.RejectProjectCompletion(project.ID, user.ID, "柜体收口还需要调整")
	if err != nil {
		t.Fatalf("RejectProjectCompletion: %v", err)
	}
	if rejected.BusinessStage != model.BusinessFlowStageInConstruction {
		t.Fatalf("expected in_construction after reject, got %s", rejected.BusinessStage)
	}
	var rejectNotification model.Notification
	if err := db.Where("user_id = ? AND type = ?", provider.UserID, "project.completion.rejected").Order("id DESC").First(&rejectNotification).Error; err != nil {
		t.Fatalf("expected completion rejected notification: %v", err)
	}
	if rejectNotification.ActionURL != "/projects/2003" {
		t.Fatalf("expected completion rejected actionUrl, got %+v", rejectNotification)
	}
	if _, err := svc.ApproveProjectCompletion(project.ID, user.ID); err == nil {
		t.Fatalf("expected approve after reject without resubmit to fail")
	}

	if _, err := svc.SubmitProjectCompletion(project.ID, provider.ID, &ProjectCompletionPayload{
		Photos: []string{"/uploads/completed-3.jpg"},
		Notes:  "整改后重新提交",
	}); err != nil {
		t.Fatalf("re-submit completion: %v", err)
	}
	approved, err := svc.ApproveProjectCompletion(project.ID, user.ID)
	if err != nil {
		t.Fatalf("ApproveProjectCompletion: %v", err)
	}
	NewOutboxWorker("project-completion-approve-test").ProcessOnce()
	if approved.AuditID == 0 {
		t.Fatalf("expected generated case audit id")
	}
	var flow model.BusinessFlow
	if err := db.Where("project_id = ?", project.ID).First(&flow).Error; err != nil {
		t.Fatalf("load project flow: %v", err)
	}
	if flow.CurrentStage != model.BusinessFlowStageArchived {
		t.Fatalf("expected archived stage after approval, got %s", flow.CurrentStage)
	}
	var settlements int64
	if err := db.Model(&model.SettlementOrder{}).Where("project_id = ?", project.ID).Count(&settlements).Error; err != nil {
		t.Fatalf("count settlement orders: %v", err)
	}
	if settlements != 2 {
		t.Fatalf("expected 2 settlement orders, got %d", settlements)
	}
	var incomes int64
	if err := db.Model(&model.MerchantIncome{}).Where("provider_id = ? AND type = ?", provider.ID, "construction").Count(&incomes).Error; err != nil {
		t.Fatalf("count merchant incomes: %v", err)
	}
	if incomes != 2 {
		t.Fatalf("expected 2 merchant incomes, got %d", incomes)
	}
	var paidTransactions int64
	if err := db.Model(&model.Transaction{}).Where("type = ?", "release").Count(&paidTransactions).Error; err != nil {
		t.Fatalf("count release transactions: %v", err)
	}
	if paidTransactions != 0 {
		t.Fatalf("expected 0 release transactions before T+3 payout, got %d", paidTransactions)
	}
	var escrow model.EscrowAccount
	if err := db.Where("project_id = ?", project.ID).First(&escrow).Error; err != nil {
		t.Fatalf("load escrow after approval: %v", err)
	}
	if escrow.Status != escrowStatusClosed {
		t.Fatalf("expected closed escrow after approval, got %+v", escrow)
	}
	var scheduledSettlements []model.SettlementOrder
	if err := db.Where("project_id = ?", project.ID).Order("biz_id ASC").Find(&scheduledSettlements).Error; err != nil {
		t.Fatalf("load settlement orders: %v", err)
	}
	for _, item := range scheduledSettlements {
		if item.Status != model.SettlementStatusScheduled || item.PayoutOrderID != 0 {
			t.Fatalf("expected scheduled settlement without payout runtime, got %+v", item)
		}
	}
	var approveNotification model.Notification
	if err := db.Where("user_id = ? AND type = ?", provider.UserID, "project.completion.approved").Order("id DESC").First(&approveNotification).Error; err != nil {
		t.Fatalf("expected completion approved notification: %v", err)
	}
	if approveNotification.ActionURL != "/projects/2003" {
		t.Fatalf("expected completion approved actionUrl, got %+v", approveNotification)
	}
	if _, err := svc.ApproveProjectCompletion(project.ID, user.ID); err == nil {
		t.Fatalf("expected duplicate approve to fail after archived")
	}
	if _, err := svc.RejectProjectCompletion(project.ID, user.ID, "再次驳回"); err == nil {
		t.Fatalf("expected reject after archived to fail")
	}
}

func TestProjectCompletionSubmitOfficialReviewRecalculatesProviderRating(t *testing.T) {
	db := setupProjectCompletionFlowTestDB(t)
	user, provider, project := seedProjectCompletionFlow(t, db)
	svc := &ProjectService{}

	if _, err := svc.SubmitProjectCompletion(project.ID, provider.ID, &ProjectCompletionPayload{
		Photos: []string{"/uploads/completed-1.jpg"},
		Notes:  "正式完工提交",
	}); err != nil {
		t.Fatalf("SubmitProjectCompletion: %v", err)
	}
	if _, err := svc.ApproveProjectCompletion(project.ID, user.ID); err != nil {
		t.Fatalf("ApproveProjectCompletion: %v", err)
	}

	review, err := svc.SubmitProjectReview(project.ID, user.ID, &ProjectReviewPayload{
		Rating:  5,
		Content: "整体交付满意，沟通顺畅。",
		Images:  []string{"/uploads/review-1.jpg"},
	})
	if err != nil {
		t.Fatalf("SubmitProjectReview: %v", err)
	}
	if review == nil || review.ProjectID != project.ID || review.ProviderID != provider.ID {
		t.Fatalf("unexpected review detail: %+v", review)
	}

	var providerAfter model.Provider
	if err := db.First(&providerAfter, provider.ID).Error; err != nil {
		t.Fatalf("load provider after review: %v", err)
	}
	if providerAfter.ReviewCount != 1 {
		t.Fatalf("expected aggregated review_count=1, got %d", providerAfter.ReviewCount)
	}
	if providerAfter.Rating < 4.5 || providerAfter.Rating > 4.7 {
		t.Fatalf("expected smoothed rating around 4.6, got %.2f", providerAfter.Rating)
	}

	if _, err := svc.SubmitProjectReview(project.ID, user.ID, &ProjectReviewPayload{
		Rating:  4,
		Content: "重复评价",
	}); err == nil {
		t.Fatalf("expected duplicate official review to fail")
	}

	if err := db.Where("project_id = ?", project.ID).Delete(&model.ProviderReview{}).Error; err != nil {
		t.Fatalf("delete official review: %v", err)
	}
	if err := (&ProviderService{}).RecalculateAggregatedRating(provider.ID); err != nil {
		t.Fatalf("RecalculateAggregatedRating: %v", err)
	}

	if err := db.First(&providerAfter, provider.ID).Error; err != nil {
		t.Fatalf("reload provider after delete: %v", err)
	}
	if providerAfter.Rating != 0 || providerAfter.ReviewCount != 0 {
		t.Fatalf("expected cleared aggregate after delete, rating=%.2f reviewCount=%d", providerAfter.Rating, providerAfter.ReviewCount)
	}
}

func TestProjectCompletionDetailTxUsesTransactionalFlowStage(t *testing.T) {
	db := setupProjectCompletionFlowTestDB(t)
	_, provider, project := seedProjectCompletionFlow(t, db)
	svc := &ProjectService{}

	now := time.Now()
	err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&model.Project{}).Where("id = ?", project.ID).Updates(map[string]interface{}{
			"status":                  model.ProjectStatusCompleted,
			"business_status":         model.ProjectBusinessStatusCompleted,
			"current_phase":           "已完工待验收",
			"completion_submitted_at": now,
		}).Error; err != nil {
			return err
		}
		if err := businessFlowSvc.AdvanceByProject(tx, project.ID, map[string]interface{}{
			"current_stage": model.BusinessFlowStageCompleted,
		}); err != nil {
			return err
		}

		detail, err := svc.getProjectCompletionDetailTx(tx, project.ID)
		if err != nil {
			return err
		}
		if detail.BusinessStage != model.BusinessFlowStageCompleted {
			t.Fatalf("expected transactional completion stage, got %s", detail.BusinessStage)
		}
		if detail.FlowSummary == "" {
			t.Fatalf("expected non-empty flow summary")
		}

		return nil
	})
	if err != nil {
		t.Fatalf("transaction failed: %v", err)
	}

	var providerAfter model.Provider
	if err := db.First(&providerAfter, provider.ID).Error; err != nil {
		t.Fatalf("reload provider: %v", err)
	}
}

func TestProjectCompletionApproveRollsBackWhenCaseDraftCreateFails(t *testing.T) {
	db := setupProjectCompletionFlowTestDB(t)
	user, provider, project := seedProjectCompletionFlow(t, db)
	svc := &ProjectService{}

	if _, err := svc.SubmitProjectCompletion(project.ID, provider.ID, &ProjectCompletionPayload{
		Photos: []string{"/uploads/completed-rollback.jpg"},
		Notes:  "准备触发归档失败",
	}); err != nil {
		t.Fatalf("SubmitProjectCompletion: %v", err)
	}
	if err := db.Migrator().DropTable(&model.CaseAudit{}); err != nil {
		t.Fatalf("drop case audits table: %v", err)
	}

	if _, err := svc.ApproveProjectCompletion(project.ID, user.ID); err == nil {
		t.Fatalf("expected approval to fail when case draft create fails")
	}

	var transactions int64
	if err := db.Model(&model.Transaction{}).Where("type = ?", "release").Count(&transactions).Error; err != nil {
		t.Fatalf("count release transactions: %v", err)
	}
	if transactions != 0 {
		t.Fatalf("expected no release transactions after rollback, got %d", transactions)
	}

	var incomes int64
	if err := db.Model(&model.MerchantIncome{}).Where("type = ?", "construction").Count(&incomes).Error; err != nil {
		t.Fatalf("count merchant incomes: %v", err)
	}
	if incomes != 0 {
		t.Fatalf("expected no merchant incomes after rollback, got %d", incomes)
	}

	var milestones []model.Milestone
	if err := db.Where("project_id = ?", project.ID).Order("seq ASC").Find(&milestones).Error; err != nil {
		t.Fatalf("reload milestones: %v", err)
	}
	for _, milestone := range milestones {
		if milestone.ReleasedAt != nil || milestone.Status != model.MilestoneStatusAccepted {
			t.Fatalf("expected accepted unreleased milestone after rollback, got %+v", milestone)
		}
	}

	var refreshedProject model.Project
	if err := db.First(&refreshedProject, project.ID).Error; err != nil {
		t.Fatalf("reload project: %v", err)
	}
	if refreshedProject.InspirationCaseDraftID != 0 || refreshedProject.CurrentPhase != "已完工待验收" {
		t.Fatalf("expected project approval rollback, got %+v", refreshedProject)
	}

	var escrow model.EscrowAccount
	if err := db.Where("project_id = ?", project.ID).First(&escrow).Error; err != nil {
		t.Fatalf("reload escrow: %v", err)
	}
	if escrow.Status != escrowStatusActive || escrow.AvailableAmount != 120000 || escrow.ReleasedAmount != 0 {
		t.Fatalf("expected escrow rollback, got %+v", escrow)
	}
}
