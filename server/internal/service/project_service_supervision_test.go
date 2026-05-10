package service

import (
	"strings"
	"testing"

	"home-decoration-server/internal/model"
)

func TestProjectServiceCreateSupervisorWorkLogRejectsExternalPhotos(t *testing.T) {
	db := setupProjectServiceTestDB(t)

	project := model.Project{Base: model.Base{ID: 71}, OwnerID: 1, ProviderID: 2, Name: "监理日志项目", Address: "测试地址"}
	if err := db.Create(&project).Error; err != nil {
		t.Fatalf("create project: %v", err)
	}
	phase := model.ProjectPhase{Base: model.Base{ID: 72}, ProjectID: project.ID, PhaseType: "preparation", Seq: 1, Status: "in_progress"}
	if err := db.Create(&phase).Error; err != nil {
		t.Fatalf("create phase: %v", err)
	}

	svc := &ProjectService{}
	_, err := svc.CreateSupervisorWorkLog(project.ID, 901, &CreateWorkLogRequest{
		PhaseID:     phase.ID,
		Title:       "外链图片日志",
		Description: "检查外链是否被拒绝",
		Photos:      `["https://picsum.photos/400/300","/uploads/worklog/a.jpg"]`,
	})
	if err == nil {
		t.Fatalf("expected external photo validation error")
	}
	if !strings.Contains(err.Error(), "仅支持平台上传图片") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestProjectServiceCreateSupervisorWorkLogUsesWorkerActor(t *testing.T) {
	db := setupProjectServiceTestDB(t)

	project := model.Project{Base: model.Base{ID: 81}, OwnerID: 1, ProviderID: 2, Name: "监理日志项目", Address: "测试地址"}
	if err := db.Create(&project).Error; err != nil {
		t.Fatalf("create project: %v", err)
	}
	phase := model.ProjectPhase{Base: model.Base{ID: 82}, ProjectID: project.ID, PhaseType: "preparation", Seq: 1, Status: "in_progress"}
	if err := db.Create(&phase).Error; err != nil {
		t.Fatalf("create phase: %v", err)
	}

	svc := &ProjectService{}
	log, err := svc.CreateSupervisorWorkLog(project.ID, 901, &CreateWorkLogRequest{
		PhaseID:     phase.ID,
		Title:       "监理巡检",
		Description: "监理日志应记在 worker 侧",
		Photos:      `["/uploads/worklog/a.jpg","/uploads/worklog/b.jpg"]`,
	})
	if err != nil {
		t.Fatalf("CreateSupervisorWorkLog: %v", err)
	}
	if log.WorkerID != 901 {
		t.Fatalf("expected worker id 901, got %d", log.WorkerID)
	}
	if log.CreatedBy != 0 {
		t.Fatalf("expected created_by 0 for supervisor log, got %d", log.CreatedBy)
	}
}
