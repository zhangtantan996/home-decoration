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

	if err := db.AutoMigrate(&model.User{}, &model.Project{}, &model.Milestone{}); err != nil {
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

func TestProjectServiceAcceptMilestone(t *testing.T) {
	db := setupProjectServiceTestDB(t)

	user := model.User{Base: model.Base{ID: 7}, Phone: "13800138000", Status: 1}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}

	project := model.Project{Base: model.Base{ID: 21}, OwnerID: user.ID, Name: "测试项目", Address: "测试地址", Status: 1, CurrentPhase: "施工中"}
	if err := db.Create(&project).Error; err != nil {
		t.Fatalf("create project: %v", err)
	}

	milestones := []model.Milestone{
		{Base: model.Base{ID: 101}, ProjectID: project.ID, Name: "开工交底", Seq: 1, Status: 0},
		{Base: model.Base{ID: 102}, ProjectID: project.ID, Name: "竣工验收", Seq: 2, Status: 0},
	}
	if err := db.Create(&milestones).Error; err != nil {
		t.Fatalf("create milestones: %v", err)
	}

	svc := &ProjectService{}
	accepted, err := svc.AcceptMilestone(project.ID, user.ID, milestones[0].ID)
	if err != nil {
		t.Fatalf("AcceptMilestone: %v", err)
	}
	if accepted.Status != 3 {
		t.Fatalf("expected accepted status 3, got %d", accepted.Status)
	}
	if accepted.AcceptedAt == nil || time.Since(*accepted.AcceptedAt) > time.Minute {
		t.Fatalf("expected acceptedAt to be set recently, got %v", accepted.AcceptedAt)
	}

	var updatedProject model.Project
	if err := db.First(&updatedProject, project.ID).Error; err != nil {
		t.Fatalf("reload project: %v", err)
	}
	if updatedProject.Status != 2 {
		t.Fatalf("expected project status 2 after partial acceptance, got %d", updatedProject.Status)
	}

	_, err = svc.AcceptMilestone(project.ID, user.ID, milestones[1].ID)
	if err != nil {
		t.Fatalf("AcceptMilestone final node: %v", err)
	}
	if err := db.First(&updatedProject, project.ID).Error; err != nil {
		t.Fatalf("reload completed project: %v", err)
	}
	if updatedProject.Status != 3 {
		t.Fatalf("expected project status 3 after all milestones accepted, got %d", updatedProject.Status)
	}
	if updatedProject.CurrentPhase != "已完工" {
		t.Fatalf("expected project current phase 已完工, got %q", updatedProject.CurrentPhase)
	}
}
