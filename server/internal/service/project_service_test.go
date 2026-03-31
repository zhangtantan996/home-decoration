package service

import (
	"testing"
	"time"

	"home-decoration-server/internal/model"

	gormsqlite "gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupProjectServiceTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	db, err := gorm.Open(gormsqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite db: %v", err)
	}

	if err := db.AutoMigrate(withPaymentCentralTestModels(
		&model.User{},
		&model.Provider{},
		&model.Notification{},
		&model.AuditLog{},
		&model.SystemConfig{},
		&model.Booking{},
		&model.Proposal{},
		&model.Project{},
		&model.Milestone{},
		&model.WorkLog{},
		&model.ProjectPhase{},
		&model.PhaseTask{},
		&model.BusinessFlow{},
		&model.EscrowAccount{},
		&model.Transaction{},
		&model.MerchantIncome{},
		&model.Order{},
		&model.PaymentPlan{},
	)...); err != nil {
		t.Fatalf("migrate sqlite db: %v", err)
	}
	bindRepositorySQLiteTestDB(t, db)

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

func TestProjectServiceCreateWorkLog(t *testing.T) {
	db := setupProjectServiceTestDB(t)

	project := model.Project{Base: model.Base{ID: 61}, OwnerID: 1, ProviderID: 2, Name: "日志测试项目", Address: "日志测试地址"}
	if err := db.Create(&project).Error; err != nil {
		t.Fatalf("create project: %v", err)
	}

	svc := &ProjectService{}
	if err := svc.CreateWorkLog(project.ID, 2, &CreateWorkLogRequest{
		Title:       "施工日志",
		Description: "日志描述",
	}); err != nil {
		t.Fatalf("CreateWorkLog: %v", err)
	}

	var log model.WorkLog
	if err := db.First(&log).Error; err != nil {
		t.Fatalf("load work log: %v", err)
	}
	if log.Photos != "[]" {
		t.Fatalf("expected default photos json array, got %s", log.Photos)
	}
	if log.Issues != "[]" {
		t.Fatalf("expected default issues json array, got %s", log.Issues)
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
	})
	if err != nil {
		t.Fatalf("ConfirmConstruction: %v", err)
	}
	if confirmedProject.ProviderID != constructionProvider.ID ||
		confirmedProject.ConstructionProviderID != constructionProvider.ID ||
		confirmedProject.ForemanID != 0 {
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

func TestProjectServiceConfirmConstruction_WithCompanyOnly(t *testing.T) {
	db := setupProjectServiceTestDB(t)

	user := model.User{Base: model.Base{ID: 71}, Phone: "13800138071", Status: 1}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}

	designProvider := model.Provider{Base: model.Base{ID: 171}, ProviderType: 1, CompanyName: "设计师"}
	constructionProvider := model.Provider{Base: model.Base{ID: 172}, ProviderType: 2, CompanyName: "施工公司A"}
	for _, provider := range []model.Provider{designProvider, constructionProvider} {
		if err := db.Create(&provider).Error; err != nil {
			t.Fatalf("create provider: %v", err)
		}
	}

	proposal := model.Proposal{Base: model.Base{ID: 173}, Status: model.ProposalStatusConfirmed}
	if err := db.Create(&proposal).Error; err != nil {
		t.Fatalf("create proposal: %v", err)
	}

	project := model.Project{
		Base:           model.Base{ID: 174},
		OwnerID:        user.ID,
		ProviderID:     designProvider.ID,
		ProposalID:     proposal.ID,
		Name:           "公司施工项目",
		BusinessStatus: model.ProjectBusinessStatusProposalConfirmed,
	}
	if err := db.Create(&project).Error; err != nil {
		t.Fatalf("create project: %v", err)
	}

	svc := &ProjectService{}
	confirmedProject, err := svc.ConfirmConstruction(project.ID, user.ID, &ConfirmConstructionRequest{
		ConstructionProviderID: constructionProvider.ID,
	})
	if err != nil {
		t.Fatalf("ConfirmConstruction with company only: %v", err)
	}
	if confirmedProject.ConstructionProviderID != constructionProvider.ID || confirmedProject.ForemanID != 0 || confirmedProject.ProviderID != constructionProvider.ID {
		t.Fatalf("unexpected company-only result: %+v", confirmedProject)
	}
}

func TestProjectServiceConfirmConstruction_WithForemanOnly(t *testing.T) {
	db := setupProjectServiceTestDB(t)

	user := model.User{Base: model.Base{ID: 81}, Phone: "13800138081", Status: 1}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}

	designProvider := model.Provider{Base: model.Base{ID: 181}, ProviderType: 1, CompanyName: "设计师"}
	foreman := model.Provider{Base: model.Base{ID: 182}, ProviderType: 3, CompanyName: "独立工长"}
	for _, provider := range []model.Provider{designProvider, foreman} {
		if err := db.Create(&provider).Error; err != nil {
			t.Fatalf("create provider: %v", err)
		}
	}

	proposal := model.Proposal{Base: model.Base{ID: 183}, Status: model.ProposalStatusConfirmed}
	if err := db.Create(&proposal).Error; err != nil {
		t.Fatalf("create proposal: %v", err)
	}

	project := model.Project{
		Base:           model.Base{ID: 184},
		OwnerID:        user.ID,
		ProviderID:     designProvider.ID,
		ProposalID:     proposal.ID,
		Name:           "工长施工项目",
		BusinessStatus: model.ProjectBusinessStatusProposalConfirmed,
	}
	if err := db.Create(&project).Error; err != nil {
		t.Fatalf("create project: %v", err)
	}

	svc := &ProjectService{}
	confirmedProject, err := svc.ConfirmConstruction(project.ID, user.ID, &ConfirmConstructionRequest{
		ForemanID: foreman.ID,
	})
	if err != nil {
		t.Fatalf("ConfirmConstruction with foreman only: %v", err)
	}
	if confirmedProject.ConstructionProviderID != 0 || confirmedProject.ForemanID != foreman.ID || confirmedProject.ProviderID != foreman.ID {
		t.Fatalf("unexpected foreman-only result: %+v", confirmedProject)
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
	escrow := model.EscrowAccount{
		Base:            model.Base{ID: 311},
		ProjectID:       project.ID,
		UserID:          user.ID,
		TotalAmount:     28000,
		AvailableAmount: 28000,
		Status:          escrowStatusActive,
	}
	if err := db.Create(&escrow).Error; err != nil {
		t.Fatalf("create escrow: %v", err)
	}

	milestones := []model.Milestone{
		{Base: model.Base{ID: 301}, ProjectID: project.ID, Name: "开工交底", Seq: 1, Amount: 14000, Status: model.MilestoneStatusInProgress},
		{Base: model.Base{ID: 302}, ProjectID: project.ID, Name: "竣工验收", Seq: 2, Amount: 14000, Status: model.MilestoneStatusPending},
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
	if completedProject.Status != model.ProjectStatusActive {
		t.Fatalf("expected project remain active until completion submission, got %d", completedProject.Status)
	}
	if completedProject.BusinessStatus != model.ProjectBusinessStatusInProgress {
		t.Fatalf("expected in-progress business status before completion submission, got %q", completedProject.BusinessStatus)
	}
	if completedProject.CurrentPhase != "待提交完工材料" {
		t.Fatalf("expected current phase 待提交完工材料, got %q", completedProject.CurrentPhase)
	}
	if completedProject.ActualEnd != nil {
		t.Fatalf("expected actual end stay unset before completion submission")
	}
}

func TestProjectServiceGetProjectDetail_FallbackWhenBusinessFlowMissing(t *testing.T) {
	db := setupProjectServiceTestDB(t)

	user := model.User{Base: model.Base{ID: 71}, Phone: "13800138071", Status: 1, Nickname: "业主A"}
	provider := model.Provider{Base: model.Base{ID: 72}, ProviderType: 2, CompanyName: "施工公司A"}
	for _, record := range []interface{}{&user, &provider} {
		if err := db.Create(record).Error; err != nil {
			t.Fatalf("seed record: %v", err)
		}
	}

	project := model.Project{
		Base:           model.Base{ID: 81},
		OwnerID:        user.ID,
		ProviderID:     provider.ID,
		Name:           "无 flow 项目",
		Address:        "测试地址",
		Status:         model.ProjectStatusActive,
		CurrentPhase:   "泥木验收待验收",
		BusinessStatus: model.ProjectBusinessStatusInProgress,
	}
	if err := db.Create(&project).Error; err != nil {
		t.Fatalf("create project: %v", err)
	}
	milestones := []model.Milestone{
		{Base: model.Base{ID: 811}, ProjectID: project.ID, Name: "水电验收", Seq: 1, Status: model.MilestoneStatusAccepted},
		{Base: model.Base{ID: 812}, ProjectID: project.ID, Name: "泥木验收", Seq: 2, Status: model.MilestoneStatusSubmitted},
	}
	if err := db.Create(&milestones).Error; err != nil {
		t.Fatalf("create milestones: %v", err)
	}

	svc := &ProjectService{}
	detail, err := svc.GetProjectDetail(project.ID)
	if err != nil {
		t.Fatalf("GetProjectDetail: %v", err)
	}
	if detail.BusinessStage != model.BusinessFlowStageNodeAcceptanceInProgress {
		t.Fatalf("unexpected fallback business stage: %s", detail.BusinessStage)
	}
	if detail.FlowSummary == "" || detail.FlowSummary == "业务主链待初始化" {
		t.Fatalf("unexpected fallback flow summary: %s", detail.FlowSummary)
	}
}

func TestProjectServiceGetProjectDetailIncludesDesignerProfile(t *testing.T) {
	db := setupProjectServiceTestDB(t)

	owner := model.User{Base: model.Base{ID: 701}, Phone: "13800138701", Status: 1, Nickname: "业主C"}
	designerUser := model.User{Base: model.Base{ID: 702}, Phone: "13800138702", Status: 1, Nickname: "设计师李"}
	designer := model.Provider{Base: model.Base{ID: 703}, UserID: designerUser.ID, ProviderType: 1, CompanyName: "李设计工作室"}
	constructionUser := model.User{Base: model.Base{ID: 704}, Phone: "13800138703", Status: 1, Nickname: "施工经理"}
	construction := model.Provider{Base: model.Base{ID: 705}, UserID: constructionUser.ID, ProviderType: 2, CompanyName: "施工公司C"}
	proposal := model.Proposal{Base: model.Base{ID: 706}, DesignerID: designer.ID, Summary: "设计方案"}
	for _, record := range []interface{}{&owner, &designerUser, &designer, &constructionUser, &construction, &proposal} {
		if err := db.Create(record).Error; err != nil {
			t.Fatalf("seed record: %v", err)
		}
	}

	project := model.Project{
		Base:                   model.Base{ID: 707},
		OwnerID:                owner.ID,
		ProviderID:             construction.ID,
		ConstructionProviderID: construction.ID,
		ProposalID:             proposal.ID,
		Name:                   "团队展示项目",
		Address:                "测试地址 707",
		Status:                 model.ProjectStatusActive,
		CurrentPhase:           "待开工",
		BusinessStatus:         model.ProjectBusinessStatusConstructionQuoteConfirmed,
	}
	if err := db.Create(&project).Error; err != nil {
		t.Fatalf("create project: %v", err)
	}

	detail, err := (&ProjectService{}).GetProjectDetail(project.ID)
	if err != nil {
		t.Fatalf("GetProjectDetail: %v", err)
	}
	if detail.ProviderName != "施工经理" {
		t.Fatalf("expected current provider name from construction provider, got %q", detail.ProviderName)
	}
	if detail.DesignerName != "设计师李" {
		t.Fatalf("expected designer name, got %q", detail.DesignerName)
	}
	if detail.DesignerPhone != "13800138702" {
		t.Fatalf("expected designer phone, got %q", detail.DesignerPhone)
	}
}

func TestProjectServiceListMerchantProjects(t *testing.T) {
	db := setupProjectServiceTestDB(t)

	owner := model.User{Base: model.Base{ID: 91}, Phone: "13800138091", Status: 1, Nickname: "业主B"}
	provider := model.Provider{Base: model.Base{ID: 92}, ProviderType: 2, CompanyName: "施工公司B"}
	if err := db.Create(&owner).Error; err != nil {
		t.Fatalf("create owner: %v", err)
	}
	if err := db.Create(&provider).Error; err != nil {
		t.Fatalf("create provider: %v", err)
	}

	project := model.Project{
		Base:           model.Base{ID: 93},
		OwnerID:        owner.ID,
		ProviderID:     provider.ID,
		Name:           "项目执行列表测试",
		Address:        "测试地址",
		Status:         model.ProjectStatusActive,
		CurrentPhase:   "待开工",
		BusinessStatus: model.ProjectBusinessStatusConstructionQuoteConfirmed,
	}
	if err := db.Create(&project).Error; err != nil {
		t.Fatalf("create project: %v", err)
	}

	projectCompleted := model.Project{
		Base:           model.Base{ID: 94},
		OwnerID:        owner.ID,
		ProviderID:     provider.ID,
		Name:           "另一个归档项目",
		Address:        "测试地址2",
		Status:         model.ProjectStatusCompleted,
		CurrentPhase:   "已完工",
		BusinessStatus: model.ProjectBusinessStatusCompleted,
	}
	if err := db.Create(&projectCompleted).Error; err != nil {
		t.Fatalf("create completed project: %v", err)
	}

	svc := &ProjectService{}
	items, total, err := svc.ListMerchantProjects(provider.ID, nil)
	if err != nil {
		t.Fatalf("ListMerchantProjects: %v", err)
	}
	if total != 2 || len(items) != 2 {
		t.Fatalf("expected 2 projects, got total=%d len=%d", total, len(items))
	}
	readyCount := 0
	completedCount := 0
	for _, item := range items {
		switch item.BusinessStage {
		case model.BusinessFlowStageReadyToStart:
			readyCount++
		case model.BusinessFlowStageCompleted:
			completedCount++
		}
	}
	if readyCount != 1 || completedCount != 1 {
		t.Fatalf("unexpected stage counts: ready=%d completed=%d", readyCount, completedCount)
	}

	filteredByKeyword, keywordTotal, err := svc.ListMerchantProjects(provider.ID, &MerchantProjectListQuery{
		Keyword: "93",
	})
	if err != nil {
		t.Fatalf("ListMerchantProjects by keyword: %v", err)
	}
	if keywordTotal != 1 || len(filteredByKeyword) != 1 {
		t.Fatalf("expected 1 keyword project, got total=%d len=%d", keywordTotal, len(filteredByKeyword))
	}
	if filteredByKeyword[0].ID != project.ID {
		t.Fatalf("unexpected keyword project id: %d", filteredByKeyword[0].ID)
	}

	filteredByStage, stageTotal, err := svc.ListMerchantProjects(provider.ID, &MerchantProjectListQuery{
		BusinessStage: model.BusinessFlowStageCompleted,
	})
	if err != nil {
		t.Fatalf("ListMerchantProjects by stage: %v", err)
	}
	if stageTotal != 1 || len(filteredByStage) != 1 {
		t.Fatalf("expected 1 completed project, got total=%d len=%d", stageTotal, len(filteredByStage))
	}
	if filteredByStage[0].ID != projectCompleted.ID {
		t.Fatalf("unexpected completed project id: %d", filteredByStage[0].ID)
	}
}
