package service

import (
	"testing"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"

	gormsqlite "gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupProjectCompletionTestDB(t *testing.T) *gorm.DB {
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
		&model.BusinessFlow{},
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

func TestProjectServiceCompleteProjectAdvancesBusinessFlow(t *testing.T) {
	db := setupProjectCompletionTestDB(t)

	user := model.User{Base: model.Base{ID: 10}, Phone: "13900000001", Status: 1}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}

	provider := model.Provider{Base: model.Base{ID: 20}, ProviderType: 1, CompanyName: "测试设计师"}
	if err := db.Create(&provider).Error; err != nil {
		t.Fatalf("create provider: %v", err)
	}

	project := model.Project{
		Base:           model.Base{ID: 100},
		OwnerID:        user.ID,
		ProviderID:     provider.ID,
		Name:           "完工闭环测试",
		Status:         model.ProjectStatusActive,
		BusinessStatus: model.ProjectBusinessStatusInProgress,
		CurrentPhase:   "施工中",
	}
	if err := db.Create(&project).Error; err != nil {
		t.Fatalf("create project: %v", err)
	}

	flow := model.BusinessFlow{
		Base:           model.Base{ID: 200},
		SourceType:     model.BusinessFlowSourceBooking,
		SourceID:       500,
		CustomerUserID: user.ID,
		ProjectID:      project.ID,
		CurrentStage:   model.BusinessFlowStageInConstruction,
	}
	if err := db.Create(&flow).Error; err != nil {
		t.Fatalf("create business flow: %v", err)
	}

	milestones := []model.Milestone{
		{Base: model.Base{ID: 301}, ProjectID: project.ID, Name: "节点 1", Seq: 1, Status: model.MilestoneStatusAccepted},
		{Base: model.Base{ID: 302}, ProjectID: project.ID, Name: "节点 2", Seq: 2, Status: model.MilestoneStatusAccepted},
	}
	if err := db.Create(&milestones).Error; err != nil {
		t.Fatalf("create milestones: %v", err)
	}

	svc := &ProjectService{}
	completed, err := svc.CompleteProject(project.ID, user.ID)
	if err != nil {
		t.Fatalf("CompleteProject: %v", err)
	}
	if completed.Status != model.ProjectStatusCompleted {
		t.Fatalf("expected project status completed, got %v", completed.Status)
	}
	if completed.BusinessStatus != model.ProjectBusinessStatusCompleted {
		t.Fatalf("expected business status completed, got %v", completed.BusinessStatus)
	}

	var updatedFlow model.BusinessFlow
	if err := db.First(&updatedFlow, flow.ID).Error; err != nil {
		t.Fatalf("load business flow: %v", err)
	}
	if updatedFlow.CurrentStage != model.BusinessFlowStageCompleted {
		t.Fatalf("expected business flow stage completed, got %s", updatedFlow.CurrentStage)
	}
}

func TestProjectServiceCompleteProjectRequiresAcceptedMilestones(t *testing.T) {
	db := setupProjectCompletionTestDB(t)

	user := model.User{Base: model.Base{ID: 11}, Phone: "13900000002", Status: 1}
	db.Create(&user)

	project := model.Project{
		Base:           model.Base{ID: 110},
		OwnerID:        user.ID,
		Name:           "待验收项目",
		Status:         model.ProjectStatusActive,
		BusinessStatus: model.ProjectBusinessStatusInProgress,
		CurrentPhase:   "施工中",
	}
	db.Create(&project)

	milestone := model.Milestone{Base: model.Base{ID: 401}, ProjectID: project.ID, Name: "节点不足", Seq: 1, Status: model.MilestoneStatusSubmitted}
	db.Create(&milestone)

	svc := &ProjectService{}
	if _, err := svc.CompleteProject(project.ID, user.ID); err == nil {
		t.Fatalf("expected error when milestones remain unaccepted")
	}
}
