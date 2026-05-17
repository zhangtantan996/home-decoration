package service

import (
	"strings"
	"testing"
	"time"

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

func TestSupervisionServiceCreateSupervisorPhaseLogRejectsFuturePhase(t *testing.T) {
	db := setupProjectServiceTestDB(t)

	project := model.Project{Base: model.Base{ID: 83}, OwnerID: 1, ProviderID: 2, Name: "监理阶段日志项目", Address: "测试地址"}
	if err := db.Create(&project).Error; err != nil {
		t.Fatalf("create project: %v", err)
	}
	currentPhase := model.ProjectPhase{Base: model.Base{ID: 84}, ProjectID: project.ID, PhaseType: "preparation", Seq: 1, Status: "in_progress", Enabled: true}
	futurePhase := model.ProjectPhase{Base: model.Base{ID: 85}, ProjectID: project.ID, PhaseType: "electrical", Seq: 3, Status: "pending", Enabled: true}
	if err := db.Create(&[]model.ProjectPhase{currentPhase, futurePhase}).Error; err != nil {
		t.Fatalf("create phases: %v", err)
	}

	_, err := NewSupervisionService().CreateSupervisorPhaseLog(project.ID, futurePhase.ID, 901, &CreateWorkLogRequest{
		Title:       "未来阶段巡检",
		Description: "不能提前记录未到阶段",
		Photos:      `["/uploads/worklog/a.jpg","/uploads/worklog/b.jpg"]`,
	})
	if err == nil {
		t.Fatalf("expected future phase log to fail")
	}
	if got := err.Error(); got != "只能为当前阶段记录巡检日志" {
		t.Fatalf("unexpected error: %q", got)
	}
}

func TestSupervisionServiceCreateSupervisorPhaseLogRejectsPendingCurrentPhase(t *testing.T) {
	db := setupProjectServiceTestDB(t)

	project := model.Project{Base: model.Base{ID: 86}, OwnerID: 1, ProviderID: 2, Name: "监理未开工日志项目", Address: "测试地址"}
	if err := db.Create(&project).Error; err != nil {
		t.Fatalf("create project: %v", err)
	}
	phase := model.ProjectPhase{Base: model.Base{ID: 87}, ProjectID: project.ID, PhaseType: "preparation", Seq: 1, Status: "pending", Enabled: true}
	if err := db.Create(&phase).Error; err != nil {
		t.Fatalf("create phase: %v", err)
	}

	_, err := NewSupervisionService().CreateSupervisorPhaseLog(project.ID, phase.ID, 901, &CreateWorkLogRequest{
		Title:       "未开始巡检",
		Description: "阶段未开始不能记录",
		Photos:      `["/uploads/worklog/a.jpg","/uploads/worklog/b.jpg"]`,
	})
	if err == nil {
		t.Fatalf("expected pending current phase log to fail")
	}
	if got := err.Error(); got != "当前阶段尚未开始，不能记录巡检日志" {
		t.Fatalf("unexpected error: %q", got)
	}
}

func TestSupervisionServiceUpdateSupervisorPhaseStartsCurrentPhase(t *testing.T) {
	db := setupProjectServiceTestDB(t)

	project := model.Project{Base: model.Base{ID: 93}, OwnerID: 1, ProviderID: 2, Name: "监理开始阶段项目", Address: "测试地址"}
	if err := db.Create(&project).Error; err != nil {
		t.Fatalf("create project: %v", err)
	}
	phase := model.ProjectPhase{Base: model.Base{ID: 94}, ProjectID: project.ID, PhaseType: "preparation", Seq: 1, Status: "pending", Enabled: true}
	if err := db.Create(&phase).Error; err != nil {
		t.Fatalf("create phase: %v", err)
	}

	err := NewSupervisionService().UpdateSupervisorPhase(project.ID, phase.ID, &UpdatePhaseRequest{
		Status:    "in_progress",
		StartDate: "2026-05-20",
		EndDate:   "2026-05-22",
	})
	if err != nil {
		t.Fatalf("UpdateSupervisorPhase: %v", err)
	}

	var updated model.ProjectPhase
	if err := db.First(&updated, phase.ID).Error; err != nil {
		t.Fatalf("load phase: %v", err)
	}
	if updated.Status != "in_progress" {
		t.Fatalf("expected in_progress, got %q", updated.Status)
	}
	if updated.StartDate == nil || updated.StartDate.Format("2006-01-02") != "2026-05-20" {
		t.Fatalf("unexpected start date: %v", updated.StartDate)
	}
}

func TestSupervisionServiceUpdateSupervisorPhaseRejectsFuturePhase(t *testing.T) {
	db := setupProjectServiceTestDB(t)

	project := model.Project{Base: model.Base{ID: 95}, OwnerID: 1, ProviderID: 2, Name: "监理未来阶段更新项目", Address: "测试地址"}
	if err := db.Create(&project).Error; err != nil {
		t.Fatalf("create project: %v", err)
	}
	currentPhase := model.ProjectPhase{Base: model.Base{ID: 96}, ProjectID: project.ID, PhaseType: "preparation", Seq: 1, Status: "in_progress", Enabled: true}
	futurePhase := model.ProjectPhase{Base: model.Base{ID: 97}, ProjectID: project.ID, PhaseType: "electrical", Seq: 3, Status: "pending", Enabled: true}
	if err := db.Create(&[]model.ProjectPhase{currentPhase, futurePhase}).Error; err != nil {
		t.Fatalf("create phases: %v", err)
	}

	err := NewSupervisionService().UpdateSupervisorPhase(project.ID, futurePhase.ID, &UpdatePhaseRequest{
		Status:    "in_progress",
		StartDate: "2026-05-20",
	})
	if err == nil {
		t.Fatalf("expected future phase update to fail")
	}
	if got := err.Error(); got != "只能更新当前阶段" {
		t.Fatalf("unexpected error: %q", got)
	}
}

func TestSupervisionServiceUpdateSupervisorPhaseRejectsInvalidTransition(t *testing.T) {
	db := setupProjectServiceTestDB(t)

	project := model.Project{Base: model.Base{ID: 98}, OwnerID: 1, ProviderID: 2, Name: "监理阶段流转项目", Address: "测试地址"}
	if err := db.Create(&project).Error; err != nil {
		t.Fatalf("create project: %v", err)
	}
	phase := model.ProjectPhase{Base: model.Base{ID: 99}, ProjectID: project.ID, PhaseType: "preparation", Seq: 1, Status: "pending", Enabled: true}
	if err := db.Create(&phase).Error; err != nil {
		t.Fatalf("create phase: %v", err)
	}

	err := NewSupervisionService().UpdateSupervisorPhase(project.ID, phase.ID, &UpdatePhaseRequest{Status: "completed"})
	if err == nil {
		t.Fatalf("expected invalid transition to fail")
	}
	if got := err.Error(); got != "待开始阶段只能执行开始操作" {
		t.Fatalf("unexpected error: %q", got)
	}
}

func TestSupervisionServiceGetProjectWorkspaceKeepsPausedPhaseCurrent(t *testing.T) {
	db := setupProjectServiceTestDB(t)

	project := model.Project{Base: model.Base{ID: 101}, OwnerID: 1, ProviderID: 2, Name: "监理暂停阶段项目", Address: "测试地址"}
	if err := db.Create(&project).Error; err != nil {
		t.Fatalf("create project: %v", err)
	}
	pausedPhase := model.ProjectPhase{Base: model.Base{ID: 102}, ProjectID: project.ID, PhaseType: "demolition", Seq: 2, Status: "paused", Enabled: true}
	nextPhase := model.ProjectPhase{Base: model.Base{ID: 103}, ProjectID: project.ID, PhaseType: "electrical", Seq: 3, Status: "pending", Enabled: true}
	if err := db.Create(&[]model.ProjectPhase{pausedPhase, nextPhase}).Error; err != nil {
		t.Fatalf("create phases: %v", err)
	}

	workspace, err := NewSupervisionService().GetProjectWorkspace(project.ID)
	if err != nil {
		t.Fatalf("GetProjectWorkspace: %v", err)
	}
	if workspace.CurrentPhase != "拆改阶段" {
		t.Fatalf("expected paused phase to remain current, got %q", workspace.CurrentPhase)
	}
	if workspace.CurrentPhaseStatus != "paused" {
		t.Fatalf("expected paused status, got %q", workspace.CurrentPhaseStatus)
	}
}

func TestSupervisionServiceUpdateSupervisorPhaseResumesPausedCurrentPhase(t *testing.T) {
	db := setupProjectServiceTestDB(t)

	project := model.Project{Base: model.Base{ID: 104}, OwnerID: 1, ProviderID: 2, Name: "监理恢复阶段项目", Address: "测试地址"}
	if err := db.Create(&project).Error; err != nil {
		t.Fatalf("create project: %v", err)
	}
	pausedPhase := model.ProjectPhase{Base: model.Base{ID: 105}, ProjectID: project.ID, PhaseType: "demolition", Seq: 2, Status: "paused", Enabled: true}
	nextPhase := model.ProjectPhase{Base: model.Base{ID: 106}, ProjectID: project.ID, PhaseType: "electrical", Seq: 3, Status: "pending", Enabled: true}
	if err := db.Create(&[]model.ProjectPhase{pausedPhase, nextPhase}).Error; err != nil {
		t.Fatalf("create phases: %v", err)
	}

	err := NewSupervisionService().UpdateSupervisorPhase(project.ID, pausedPhase.ID, &UpdatePhaseRequest{Status: "in_progress"})
	if err != nil {
		t.Fatalf("expected paused current phase to resume: %v", err)
	}

	var updated model.ProjectPhase
	if err := db.First(&updated, pausedPhase.ID).Error; err != nil {
		t.Fatalf("load phase: %v", err)
	}
	if updated.Status != "in_progress" {
		t.Fatalf("expected in_progress, got %q", updated.Status)
	}
}

func TestSupervisorScopedServiceGetProjectLogsDefaultsToCurrentPhase(t *testing.T) {
	db := setupProjectServiceTestDB(t)

	project := model.Project{Base: model.Base{ID: 107}, OwnerID: 1, ProviderID: 2, Name: "监理日志筛选项目", Address: "测试地址"}
	if err := db.Create(&project).Error; err != nil {
		t.Fatalf("create project: %v", err)
	}
	currentPhase := model.ProjectPhase{Base: model.Base{ID: 108}, ProjectID: project.ID, PhaseType: "demolition", Seq: 2, Status: "paused", Enabled: true}
	futurePhase := model.ProjectPhase{Base: model.Base{ID: 109}, ProjectID: project.ID, PhaseType: "electrical", Seq: 3, Status: "pending", Enabled: true}
	if err := db.Create(&[]model.ProjectPhase{currentPhase, futurePhase}).Error; err != nil {
		t.Fatalf("create phases: %v", err)
	}
	assignment := model.ProjectSupervisorAssignment{
		Base:         model.Base{ID: 110},
		ProjectID:    project.ID,
		SupervisorID: 901,
		Status:       1,
		AssignedAt:   time.Now(),
	}
	if err := db.Create(&assignment).Error; err != nil {
		t.Fatalf("create assignment: %v", err)
	}
	currentLog := model.WorkLog{Base: model.Base{ID: 111}, ProjectID: project.ID, PhaseID: currentPhase.ID, Title: "当前阶段日志", Description: "当前阶段"}
	futureLog := model.WorkLog{Base: model.Base{ID: 112}, ProjectID: project.ID, PhaseID: futurePhase.ID, Title: "未来阶段日志", Description: "未来阶段"}
	if err := db.Create(&[]model.WorkLog{currentLog, futureLog}).Error; err != nil {
		t.Fatalf("create logs: %v", err)
	}

	logs, total, err := NewSupervisorScopedService().GetProjectLogs(901, project.ID, 0, 1, 20)
	if err != nil {
		t.Fatalf("GetProjectLogs: %v", err)
	}
	if total != 1 || len(logs) != 1 {
		t.Fatalf("expected only current phase log, got total=%d len=%d", total, len(logs))
	}
	if logs[0].PhaseID != currentPhase.ID {
		t.Fatalf("expected current phase log, got phase id %d", logs[0].PhaseID)
	}
}

func TestSupervisionServiceCreateRiskWarningPersistsPhaseID(t *testing.T) {
	db := setupProjectServiceTestDB(t)

	project := model.Project{Base: model.Base{ID: 91}, OwnerID: 1, ProviderID: 2, Name: "监理风险项目", Address: "测试地址"}
	if err := db.Create(&project).Error; err != nil {
		t.Fatalf("create project: %v", err)
	}
	phase := model.ProjectPhase{Base: model.Base{ID: 92}, ProjectID: project.ID, PhaseType: "electrical", Seq: 3, Status: "in_progress", Enabled: true}
	if err := db.Create(&phase).Error; err != nil {
		t.Fatalf("create phase: %v", err)
	}

	warning, err := NewSupervisionService().CreateRiskWarning(project.ID, &CreateSupervisionRiskWarningInput{
		Type:        "quality",
		Level:       "high",
		Description: "水电点位存在偏差",
		PhaseID:     phase.ID,
	})
	if err != nil {
		t.Fatalf("CreateRiskWarning: %v", err)
	}
	if warning.PhaseID != phase.ID {
		t.Fatalf("expected phase id %d, got %d", phase.ID, warning.PhaseID)
	}
	if !strings.Contains(warning.Description, "阶段") {
		t.Fatalf("expected phase label in description, got %q", warning.Description)
	}
}
