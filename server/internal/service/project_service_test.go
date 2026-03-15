package service

import (
	"testing"
	"time"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"

	gormsqlite "gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupProjectServiceTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	db, err := gorm.Open(gormsqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite db: %v", err)
	}

	if err := db.AutoMigrate(
		&model.User{},
		&model.Provider{},
		&model.Proposal{},
		&model.Project{},
		&model.Milestone{},
		&model.ProjectPhase{},
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

func TestProjectServiceGetProjectMilestones(t *testing.T) {
	db := setupProjectServiceTestDB(t)

	project := model.Project{Base: model.Base{ID: 11}, OwnerID: 7, Name: "测试项目", Address: "测试地址"}
	if err := db.Create(&project).Error; err != nil {
		t.Fatalf("create project: %v", err)
	}

	m1 := model.Milestone{ProjectID: project.ID, Name: "节点2", Seq: 2, Status: 0}
	m2 := model.Milestone{ProjectID: project.ID, Name: "节点1", Seq: 1, Status: 0}
	if err := db.Create(&[]model.Milestone{m1, m2}).Error; err != nil {
		t.Fatalf("create milestones: %v", err)
	}

	svc := &ProjectService{}
	milestones, err := svc.GetProjectMilestones(project.ID)
	if err != nil {
		t.Fatalf("GetProjectMilestones: %v", err)
	}

	if len(milestones) != 2 {
		t.Fatalf("expected 2 milestones, got %d", len(milestones))
	}
	if milestones[0].Seq != 1 || milestones[1].Seq != 2 {
		t.Fatalf("milestones not ordered by seq: %+v", milestones)
	}
}

func TestProjectServiceConstructionClosureFlow(t *testing.T) {
	db := setupProjectServiceTestDB(t)

	user := model.User{Base: model.Base{ID: 7}, Phone: "13800138000", Status: 1}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}

	designProvider := model.Provider{Base: model.Base{ID: 77}, ProviderType: 1, CompanyName: "设计师"}
	constructionProvider := model.Provider{Base: model.Base{ID: 88}, ProviderType: 2, CompanyName: "施工公司"}
	foreman := model.Provider{Base: model.Base{ID: 89}, ProviderType: 3, CompanyName: "张工长"}
	for _, provider := range []model.Provider{designProvider, constructionProvider, foreman} {
		if err := db.Create(&provider).Error; err != nil {
			t.Fatalf("create provider: %v", err)
		}
	}

	proposal := model.Proposal{Base: model.Base{ID: 50}, Status: model.ProposalStatusConfirmed}
	if err := db.Create(&proposal).Error; err != nil {
		t.Fatalf("create proposal: %v", err)
	}

	project := model.Project{
		Base:           model.Base{ID: 21},
		OwnerID:        user.ID,
		ProviderID:     designProvider.ID,
		ProposalID:     proposal.ID,
		Name:           "测试项目",
		Address:        "测试地址",
		Status:         model.ProjectStatusActive,
		CurrentPhase:   "待施工确认",
		BusinessStatus: model.ProjectBusinessStatusProposalConfirmed,
	}
	if err := db.Create(&project).Error; err != nil {
		t.Fatalf("create project: %v", err)
	}

	milestones := []model.Milestone{
		{Base: model.Base{ID: 101}, ProjectID: project.ID, Name: "开工交底", Seq: 1, Percentage: 50, Amount: 1000, Status: model.MilestoneStatusPending},
		{Base: model.Base{ID: 102}, ProjectID: project.ID, Name: "竣工验收", Seq: 2, Percentage: 50, Amount: 1000, Status: model.MilestoneStatusPending},
	}
	if err := db.Create(&milestones).Error; err != nil {
		t.Fatalf("create milestones: %v", err)
	}
	phases := []model.ProjectPhase{
		{Base: model.Base{ID: 201}, ProjectID: project.ID, PhaseType: "preparation", Seq: 1, Status: "pending"},
		{Base: model.Base{ID: 202}, ProjectID: project.ID, PhaseType: "electrical", Seq: 2, Status: "pending"},
	}
	if err := db.Create(&phases).Error; err != nil {
		t.Fatalf("create phases: %v", err)
	}

	svc := &ProjectService{}

	confirmedProject, err := svc.ConfirmConstruction(project.ID, user.ID, &ConfirmConstructionRequest{
		ConstructionProviderID: constructionProvider.ID,
		ForemanID:              foreman.ID,
	})
	if err != nil {
		t.Fatalf("ConfirmConstruction: %v", err)
	}
	if confirmedProject.ProviderID != constructionProvider.ID ||
		confirmedProject.ConstructionProviderID != constructionProvider.ID ||
		confirmedProject.ForemanID != foreman.ID {
		t.Fatalf("unexpected construction confirmation result: %+v", confirmedProject)
	}
	if confirmedProject.BusinessStatus != model.ProjectBusinessStatusConstructionConfirmed {
		t.Fatalf("expected construction_confirmed, got %q", confirmedProject.BusinessStatus)
	}

	quotedProject, err := svc.ConfirmConstructionQuote(project.ID, user.ID, &ConfirmConstructionQuoteRequest{
		ConstructionQuote: 30000,
		MaterialMethod:    "self",
		PlannedStartDate:  "2026-03-16",
		ExpectedEnd:       "2026-06-16",
	})
	if err != nil {
		t.Fatalf("ConfirmConstructionQuote: %v", err)
	}
	if quotedProject.BusinessStatus != model.ProjectBusinessStatusConstructionQuoteConfirmed {
		t.Fatalf("expected construction_quote_confirmed, got %q", quotedProject.BusinessStatus)
	}
	var quotedMilestones []model.Milestone
	if err := db.Where("project_id = ?", project.ID).Order("seq ASC").Find(&quotedMilestones).Error; err != nil {
		t.Fatalf("reload milestones: %v", err)
	}
	if quotedMilestones[0].Amount != 15000 || quotedMilestones[1].Amount != 15000 {
		t.Fatalf("expected milestone amounts recalculated to 15000, got %+v", quotedMilestones)
	}

	startedProject, err := svc.StartProject(project.ID, user.ID, &StartProjectRequest{StartDate: "2026-03-18"})
	if err != nil {
		t.Fatalf("StartProject: %v", err)
	}
	if startedProject.BusinessStatus != model.ProjectBusinessStatusInProgress {
		t.Fatalf("expected in_progress, got %q", startedProject.BusinessStatus)
	}
	if startedProject.StartedAt == nil || startedProject.StartDate == nil {
		t.Fatalf("expected startedAt/startDate to be set: %+v", startedProject)
	}

	var startedMilestones []model.Milestone
	if err := db.Where("project_id = ?", project.ID).Order("seq ASC").Find(&startedMilestones).Error; err != nil {
		t.Fatalf("reload started milestones: %v", err)
	}
	if startedMilestones[0].Status != model.MilestoneStatusInProgress || startedMilestones[1].Status != model.MilestoneStatusPending {
		t.Fatalf("unexpected milestone statuses after start: %+v", startedMilestones)
	}

	var startedPhase model.ProjectPhase
	if err := db.First(&startedPhase, phases[0].ID).Error; err != nil {
		t.Fatalf("reload first phase: %v", err)
	}
	if startedPhase.Status != "in_progress" {
		t.Fatalf("expected first phase in_progress, got %q", startedPhase.Status)
	}
}

func TestProjectServiceMilestoneSubmitAcceptAndComplete(t *testing.T) {
	db := setupProjectServiceTestDB(t)

	user := model.User{Base: model.Base{ID: 17}, Phone: "13800138017", Status: 1}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}

	constructionProvider := model.Provider{Base: model.Base{ID: 98}, ProviderType: 2, CompanyName: "施工公司"}
	foreman := model.Provider{Base: model.Base{ID: 99}, ProviderType: 3, CompanyName: "李工长"}
	for _, provider := range []model.Provider{constructionProvider, foreman} {
		if err := db.Create(&provider).Error; err != nil {
			t.Fatalf("create provider: %v", err)
		}
	}

	project := model.Project{
		Base:                   model.Base{ID: 31},
		OwnerID:                user.ID,
		ProviderID:             constructionProvider.ID,
		ConstructionProviderID: constructionProvider.ID,
		ForemanID:              foreman.ID,
		ConstructionQuote:      28000,
		Status:                 model.ProjectStatusActive,
		CurrentPhase:           "开工交底施工中",
		BusinessStatus:         model.ProjectBusinessStatusInProgress,
	}
	if err := db.Create(&project).Error; err != nil {
		t.Fatalf("create project: %v", err)
	}

	milestones := []model.Milestone{
		{Base: model.Base{ID: 301}, ProjectID: project.ID, Name: "开工交底", Seq: 1, Status: model.MilestoneStatusInProgress},
		{Base: model.Base{ID: 302}, ProjectID: project.ID, Name: "竣工验收", Seq: 2, Status: model.MilestoneStatusPending},
	}
	if err := db.Create(&milestones).Error; err != nil {
		t.Fatalf("create milestones: %v", err)
	}

	svc := &ProjectService{}
	if _, err := svc.AcceptMilestone(project.ID, user.ID, milestones[0].ID); err == nil {
		t.Fatalf("expected accept to fail before submit")
	}

	submitted, err := svc.SubmitMilestone(project.ID, constructionProvider.ID, milestones[0].ID)
	if err != nil {
		t.Fatalf("SubmitMilestone: %v", err)
	}
	if submitted.Status != model.MilestoneStatusSubmitted {
		t.Fatalf("expected submitted status, got %d", submitted.Status)
	}
	if submitted.SubmittedAt == nil || time.Since(*submitted.SubmittedAt) > time.Minute {
		t.Fatalf("expected submittedAt to be set recently, got %v", submitted.SubmittedAt)
	}

	accepted, err := svc.AcceptMilestone(project.ID, user.ID, milestones[0].ID)
	if err != nil {
		t.Fatalf("AcceptMilestone: %v", err)
	}
	if accepted.Status != model.MilestoneStatusAccepted {
		t.Fatalf("expected accepted status, got %d", accepted.Status)
	}

	var midProject model.Project
	if err := db.First(&midProject, project.ID).Error; err != nil {
		t.Fatalf("reload project: %v", err)
	}
	if midProject.BusinessStatus != model.ProjectBusinessStatusInProgress {
		t.Fatalf("expected project still in progress, got %q", midProject.BusinessStatus)
	}
	if midProject.CurrentPhase != "竣工验收施工中" {
		t.Fatalf("expected current phase switch to next milestone, got %q", midProject.CurrentPhase)
	}

	var second model.Milestone
	if err := db.First(&second, milestones[1].ID).Error; err != nil {
		t.Fatalf("reload second milestone: %v", err)
	}
	if second.Status != model.MilestoneStatusInProgress {
		t.Fatalf("expected second milestone in progress, got %d", second.Status)
	}

	if _, err := svc.SubmitMilestone(project.ID, foreman.ID, second.ID); err != nil {
		t.Fatalf("SubmitMilestone by foreman: %v", err)
	}
	if _, err := svc.AcceptMilestone(project.ID, user.ID, second.ID); err != nil {
		t.Fatalf("AcceptMilestone final node: %v", err)
	}

	var completedProject model.Project
	if err := db.First(&completedProject, project.ID).Error; err != nil {
		t.Fatalf("reload completed project: %v", err)
	}
	if completedProject.Status != model.ProjectStatusCompleted {
		t.Fatalf("expected coarse completed status, got %d", completedProject.Status)
	}
	if completedProject.BusinessStatus != model.ProjectBusinessStatusCompleted {
		t.Fatalf("expected completed business status, got %q", completedProject.BusinessStatus)
	}
	if completedProject.CurrentPhase != "已完工" {
		t.Fatalf("expected current phase 已完工, got %q", completedProject.CurrentPhase)
	}
	if completedProject.ActualEnd == nil {
		t.Fatalf("expected actual end to be set")
	}
}
