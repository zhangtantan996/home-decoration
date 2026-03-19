package service

import (
	"testing"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"

	gormsqlite "gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupProjectCompletionFlowTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(gormsqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite db: %v", err)
	}
	if err := db.AutoMigrate(
		&model.User{},
		&model.Provider{},
		&model.Project{},
		&model.Milestone{},
		&model.WorkLog{},
		&model.Proposal{},
		&model.CaseAudit{},
		&model.BusinessFlow{},
		&model.Order{},
		&model.EscrowAccount{},
		&model.Transaction{},
		&model.MerchantIncome{},
	); err != nil {
		t.Fatalf("migrate sqlite db: %v", err)
	}
	previousDB := repository.DB
	repository.DB = db
	t.Cleanup(func() { repository.DB = previousDB })
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
	for _, record := range []interface{}{user, providerUser, provider, project, proposal, flow, order, escrow} {
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

	rejected, err := svc.RejectProjectCompletion(project.ID, user.ID, "柜体收口还需要调整")
	if err != nil {
		t.Fatalf("RejectProjectCompletion: %v", err)
	}
	if rejected.BusinessStage != model.BusinessFlowStageInConstruction {
		t.Fatalf("expected in_construction after reject, got %s", rejected.BusinessStage)
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
	var transactions int64
	if err := db.Model(&model.Transaction{}).Where("type = ?", "release").Count(&transactions).Error; err != nil {
		t.Fatalf("count release transactions: %v", err)
	}
	if transactions != 2 {
		t.Fatalf("expected 2 release transactions, got %d", transactions)
	}
	var incomes int64
	if err := db.Model(&model.MerchantIncome{}).Where("provider_id = ? AND type = ?", provider.ID, "construction").Count(&incomes).Error; err != nil {
		t.Fatalf("count merchant incomes: %v", err)
	}
	if incomes != 2 {
		t.Fatalf("expected 2 merchant incomes, got %d", incomes)
	}
	if _, err := svc.ApproveProjectCompletion(project.ID, user.ID); err == nil {
		t.Fatalf("expected duplicate approve to fail after archived")
	}
	if _, err := svc.RejectProjectCompletion(project.ID, user.ID, "再次驳回"); err == nil {
		t.Fatalf("expected reject after archived to fail")
	}
}
