package service

import (
	"encoding/base64"
	"fmt"
	"testing"
	"time"

	"home-decoration-server/internal/config"
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"

	gormsqlite "gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupProjectServiceTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	dsn := fmt.Sprintf("file:project-service-%d?mode=memory&cache=shared", time.Now().UnixNano())
	db, err := gorm.Open(gormsqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite db: %v", err)
	}

	if err := db.AutoMigrate(withPaymentCentralTestModels(
		&model.User{},
		&model.Provider{},
		&model.SysAdmin{},
		&model.Notification{},
		&model.AuditLog{},
		&model.RiskWarning{},
		&model.SystemConfig{},
		&model.Booking{},
		&model.Proposal{},
		&model.Project{},
		&model.SupervisorProfile{},
		&model.ProjectSupervisorAssignment{},
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

	sqlDB, err := db.DB()
	if err != nil {
		t.Fatalf("get sql db: %v", err)
	}
	sqlDB.SetMaxOpenConns(4)
	sqlDB.SetMaxIdleConns(4)

	previousDB := repository.DB
	repository.DB = db
	t.Cleanup(func() {
		repository.DB = previousDB
		_ = sqlDB.Close()
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

func TestProjectServiceCreateWorkLog(t *testing.T) {
	db := setupProjectServiceTestDB(t)

	project := model.Project{Base: model.Base{ID: 61}, OwnerID: 1, ProviderID: 2, Name: "日志测试项目", Address: "日志测试地址"}
	if err := db.Create(&project).Error; err != nil {
		t.Fatalf("create project: %v", err)
	}
	phase := model.ProjectPhase{Base: model.Base{ID: 91}, ProjectID: project.ID, PhaseType: "preparation", Seq: 1, Status: "in_progress"}
	if err := db.Create(&phase).Error; err != nil {
		t.Fatalf("create phase: %v", err)
	}

	svc := &ProjectService{}
	if err := svc.CreateWorkLog(project.ID, 2, &CreateWorkLogRequest{
		PhaseID:     phase.ID,
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

func TestProjectServiceCreateProjectManualPersistsEntryWindow(t *testing.T) {
	t.Setenv("ENCRYPTION_KEY", base64.StdEncoding.EncodeToString([]byte("12345678901234567890123456789012")))
	cfg := config.GetConfig()
	previousCfg := *cfg
	cfg.Server.PublicURL = "https://api.hezeyunchuang.com"
	cfg.Storage.PublicBaseURL = ""
	t.Cleanup(func() {
		*cfg = previousCfg
	})

	db := setupProjectServiceTestDB(t)

	owner := model.User{Base: model.Base{ID: 501}, Phone: "13800138501", Status: 1, Nickname: "业主D"}
	provider := model.Provider{Base: model.Base{ID: 502}, ProviderType: 2, CompanyName: "测试装修公司"}
	if err := db.Create(&owner).Error; err != nil {
		t.Fatalf("create owner: %v", err)
	}
	if err := db.Create(&provider).Error; err != nil {
		t.Fatalf("create provider: %v", err)
	}

	project, err := (&ProjectService{}).CreateProject(&CreateProjectRequest{
		OwnerID:        owner.ID,
		ProviderID:     provider.ID,
		Name:           "Ops 手工建档项目",
		Address:        "西安市高新区锦业路 66 号",
		CoverImage:     "https://api.hezeyunchuang.com/uploads/projects/hero-a.png",
		Area:           118,
		Budget:         260000,
		MaterialMethod: "platform",
		EntryStartDate: "2026-05-20",
		EntryEndDate:   "2026-05-30",
	})
	if err != nil {
		t.Fatalf("CreateProject: %v", err)
	}

	var stored model.Project
	if err := db.First(&stored, project.ID).Error; err != nil {
		t.Fatalf("load stored project: %v", err)
	}
	if stored.EntryStartDate == nil || stored.EntryStartDate.Format("2006-01-02") != "2026-05-20" {
		t.Fatalf("expected entryStartDate persisted, got %#v", stored.EntryStartDate)
	}
	if stored.EntryEndDate == nil || stored.EntryEndDate.Format("2006-01-02") != "2026-05-30" {
		t.Fatalf("expected entryEndDate persisted, got %#v", stored.EntryEndDate)
	}
	if stored.CoverImage != "/uploads/projects/hero-a.png" {
		t.Fatalf("expected normalized coverImage, got %q", stored.CoverImage)
	}
	supervisor := model.SupervisorProfile{Base: model.Base{ID: 503}, UserID: 504, RealName: "张监理", Phone: "13800138503", Status: 1, Verified: true}
	if err := db.Create(&supervisor).Error; err != nil {
		t.Fatalf("create supervisor: %v", err)
	}
	assignedAt := time.Date(2026, 5, 19, 10, 0, 0, 0, time.Local)
	assignment := model.ProjectSupervisorAssignment{
		Base:         model.Base{ID: 505},
		ProjectID:    project.ID,
		SupervisorID: supervisor.ID,
		Status:       1,
		AssignedAt:   assignedAt,
	}
	if err := db.Create(&assignment).Error; err != nil {
		t.Fatalf("create assignment: %v", err)
	}

	detail, err := (&ProjectService{}).GetProjectDetail(project.ID)
	if err != nil {
		t.Fatalf("GetProjectDetail: %v", err)
	}
	if detail.EntryStartDate == nil || detail.EntryStartDate.Format("2006-01-02") != "2026-05-20" {
		t.Fatalf("expected detail entryStartDate, got %#v", detail.EntryStartDate)
	}
	if detail.EntryEndDate == nil || detail.EntryEndDate.Format("2006-01-02") != "2026-05-30" {
		t.Fatalf("expected detail entryEndDate, got %#v", detail.EntryEndDate)
	}
	if detail.CoverImage != "/uploads/projects/hero-a.png" {
		t.Fatalf("expected detail coverImage, got %q", detail.CoverImage)
	}
	if detail.CurrentSupervisor == nil || detail.CurrentSupervisor.Name != "张监理" {
		t.Fatalf("expected current supervisor summary, got %#v", detail.CurrentSupervisor)
	}
	if detail.CurrentSupervisor.Phone != "138****8503" {
		t.Fatalf("expected masked supervisor phone, got %q", detail.CurrentSupervisor.Phone)
	}
}

func TestProjectServiceCreateProjectAppliesPhaseSelection(t *testing.T) {
	t.Setenv("ENCRYPTION_KEY", base64.StdEncoding.EncodeToString([]byte("12345678901234567890123456789012")))
	db := setupProjectServiceTestDB(t)

	owner := model.User{Base: model.Base{ID: 511}, Phone: "13800138511", Status: 1, Nickname: "业主阶段"}
	provider := model.Provider{Base: model.Base{ID: 512}, ProviderType: 2, CompanyName: "阶段装修公司"}
	if err := db.Create(&owner).Error; err != nil {
		t.Fatalf("create owner: %v", err)
	}
	if err := db.Create(&provider).Error; err != nil {
		t.Fatalf("create provider: %v", err)
	}

	project, err := (&ProjectService{}).CreateProject(&CreateProjectRequest{
		OwnerID:           owner.ID,
		ProviderID:        provider.ID,
		Name:              "阶段裁剪项目",
		Address:           "西安市高新区阶段路 1 号",
		Area:              98,
		Budget:            180000,
		MaterialMethod:    "platform",
		EnabledPhaseTypes: []string{"preparation", "electrical", "inspection"},
	})
	if err != nil {
		t.Fatalf("CreateProject: %v", err)
	}

	phases, err := (&ProjectService{}).GetProjectPhases(project.ID)
	if err != nil {
		t.Fatalf("GetProjectPhases: %v", err)
	}
	got := make([]string, 0, len(phases))
	for _, phase := range phases {
		got = append(got, phase.PhaseType)
	}
	want := []string{"preparation", "electrical", "inspection"}
	if fmt.Sprint(got) != fmt.Sprint(want) {
		t.Fatalf("expected enabled phases %v, got %v", want, got)
	}

	var disabled model.ProjectPhase
	if err := db.Where("project_id = ? AND phase_type = ?", project.ID, "demolition").First(&disabled).Error; err != nil {
		t.Fatalf("expected disabled phase kept for audit/history: %v", err)
	}
	if disabled.Enabled {
		t.Fatalf("expected demolition phase disabled")
	}
}

func TestProjectServiceCreateProjectRejectsPhaseSelectionWithoutExecutionPhase(t *testing.T) {
	t.Setenv("ENCRYPTION_KEY", base64.StdEncoding.EncodeToString([]byte("12345678901234567890123456789012")))
	db := setupProjectServiceTestDB(t)

	owner := model.User{Base: model.Base{ID: 521}, Phone: "13800138521", Status: 1, Nickname: "业主无阶段"}
	provider := model.Provider{Base: model.Base{ID: 522}, ProviderType: 2, CompanyName: "无阶段装修公司"}
	if err := db.Create(&owner).Error; err != nil {
		t.Fatalf("create owner: %v", err)
	}
	if err := db.Create(&provider).Error; err != nil {
		t.Fatalf("create provider: %v", err)
	}

	_, err := (&ProjectService{}).CreateProject(&CreateProjectRequest{
		OwnerID:           owner.ID,
		ProviderID:        provider.ID,
		Name:              "无执行阶段项目",
		Address:           "西安市高新区阶段路 2 号",
		Area:              88,
		Budget:            160000,
		MaterialMethod:    "platform",
		EnabledPhaseTypes: []string{"preparation", "inspection"},
	})
	if err == nil {
		t.Fatalf("expected CreateProject to reject phase selection without execution phase")
	}
	if got := err.Error(); got != "至少保留一个施工执行阶段" {
		t.Fatalf("expected execution phase error, got %q", got)
	}
}

func TestProjectServiceCreateProjectRejectsInvalidManualInput(t *testing.T) {
	t.Setenv("ENCRYPTION_KEY", base64.StdEncoding.EncodeToString([]byte("12345678901234567890123456789012")))
	db := setupProjectServiceTestDB(t)

	owner := model.User{Base: model.Base{ID: 531}, Phone: "13800138531", Status: 1, Nickname: "业主校验"}
	provider := model.Provider{Base: model.Base{ID: 532}, ProviderType: 2, CompanyName: "校验装修公司"}
	if err := db.Create(&owner).Error; err != nil {
		t.Fatalf("create owner: %v", err)
	}
	if err := db.Create(&provider).Error; err != nil {
		t.Fatalf("create provider: %v", err)
	}

	testCases := []struct {
		name    string
		req     CreateProjectRequest
		wantErr string
	}{
		{
			name: "面积超过两位小数",
			req: CreateProjectRequest{
				OwnerID: owner.ID, ProviderID: provider.ID, Name: "校验项目", Address: "西安市高新区测试路 1 号",
				Area: 88.123, Budget: 200000, MaterialMethod: "platform",
			},
			wantErr: "面积最多保留两位小数",
		},
		{
			name: "预算超过上限",
			req: CreateProjectRequest{
				OwnerID: owner.ID, ProviderID: provider.ID, Name: "校验项目", Address: "西安市高新区测试路 1 号",
				Area: 88.12, Budget: projectBudgetMax + 1, MaterialMethod: "platform",
			},
			wantErr: "预算不能超过100000000元",
		},
		{
			name: "进场结束日期早于开始日期",
			req: CreateProjectRequest{
				OwnerID: owner.ID, ProviderID: provider.ID, Name: "校验项目", Address: "西安市高新区测试路 1 号",
				Area: 88.12, Budget: 200000, MaterialMethod: "platform",
				EntryStartDate: "2026-05-20", EntryEndDate: "2026-05-19",
			},
			wantErr: "进场结束日期不能早于进场开始日期",
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			_, err := (&ProjectService{}).CreateProject(&testCase.req)
			if err == nil {
				t.Fatalf("expected create project to fail")
			}
			if got := err.Error(); got != testCase.wantErr {
				t.Fatalf("unexpected error: got=%q want=%q", got, testCase.wantErr)
			}
		})
	}
}

func TestProjectServiceUpdatePhaseRequiresLogBeforeCompleted(t *testing.T) {
	db := setupProjectServiceTestDB(t)

	project := model.Project{Base: model.Base{ID: 531}, OwnerID: 1, ProviderID: 2, Name: "阶段完成项目", Address: "阶段完成地址"}
	if err := db.Create(&project).Error; err != nil {
		t.Fatalf("create project: %v", err)
	}
	phase := model.ProjectPhase{Base: model.Base{ID: 532}, ProjectID: project.ID, PhaseType: "electrical", Seq: 3, Status: "in_progress", Enabled: true}
	if err := db.Create(&phase).Error; err != nil {
		t.Fatalf("create phase: %v", err)
	}

	svc := &ProjectService{}
	err := svc.UpdatePhase(phase.ID, &UpdatePhaseRequest{Status: "completed"})
	if err == nil {
		t.Fatalf("expected completed phase without log to fail")
	}
	if got := err.Error(); got != "阶段完成前至少需要一条巡检日志" {
		t.Fatalf("expected missing log error, got %q", got)
	}

	if err := svc.CreateWorkLog(project.ID, 2, &CreateWorkLogRequest{
		PhaseID:     phase.ID,
		Title:       "阶段巡检",
		Description: "阶段完成前巡检记录",
	}); err != nil {
		t.Fatalf("CreateWorkLog: %v", err)
	}
	if err := svc.UpdatePhase(phase.ID, &UpdatePhaseRequest{Status: "completed"}); err != nil {
		t.Fatalf("expected completed phase with log to pass: %v", err)
	}
}

func TestProjectServiceUpdatePhaseForOwnerRejectsForeignOwner(t *testing.T) {
	db := setupProjectServiceTestDB(t)

	project := model.Project{Base: model.Base{ID: 533}, OwnerID: 101, ProviderID: 2, Name: "归属校验项目", Address: "归属校验地址"}
	if err := db.Create(&project).Error; err != nil {
		t.Fatalf("create project: %v", err)
	}
	phase := model.ProjectPhase{Base: model.Base{ID: 534}, ProjectID: project.ID, PhaseType: "preparation", Seq: 1, Status: "pending", Enabled: true}
	if err := db.Create(&phase).Error; err != nil {
		t.Fatalf("create phase: %v", err)
	}

	err := (&ProjectService{}).UpdatePhaseForOwner(phase.ID, 202, &UpdatePhaseRequest{Status: "in_progress"})
	if err == nil || err.Error() != "无权操作此阶段" {
		t.Fatalf("expected owner check to reject foreign user, got %v", err)
	}
	if err := (&ProjectService{}).UpdatePhaseForOwner(phase.ID, project.OwnerID, &UpdatePhaseRequest{Status: "in_progress"}); err != nil {
		t.Fatalf("expected owner to update phase: %v", err)
	}
}

func TestProjectServiceUpdatePhaseTaskForOwnerRejectsForeignOwner(t *testing.T) {
	db := setupProjectServiceTestDB(t)

	project := model.Project{Base: model.Base{ID: 535}, OwnerID: 301, ProviderID: 2, Name: "任务归属校验项目", Address: "任务归属校验地址"}
	if err := db.Create(&project).Error; err != nil {
		t.Fatalf("create project: %v", err)
	}
	phase := model.ProjectPhase{Base: model.Base{ID: 536}, ProjectID: project.ID, PhaseType: "preparation", Seq: 1, Status: "pending", Enabled: true}
	if err := db.Create(&phase).Error; err != nil {
		t.Fatalf("create phase: %v", err)
	}
	task := model.PhaseTask{Base: model.Base{ID: 537}, PhaseID: phase.ID, Name: "现场交接确认"}
	if err := db.Create(&task).Error; err != nil {
		t.Fatalf("create task: %v", err)
	}

	err := (&ProjectService{}).UpdatePhaseTaskForOwner(task.ID, 302, &UpdatePhaseTaskRequest{IsCompleted: true})
	if err == nil || err.Error() != "无权操作此任务" {
		t.Fatalf("expected owner check to reject foreign user, got %v", err)
	}
	if err := (&ProjectService{}).UpdatePhaseTaskForOwner(task.ID, project.OwnerID, &UpdatePhaseTaskRequest{IsCompleted: true}); err != nil {
		t.Fatalf("expected owner to update task: %v", err)
	}
}

func TestProjectServiceUpdatePhaseRejectsStartDateBeforeProjectKickoff(t *testing.T) {
	db := setupProjectServiceTestDB(t)

	projectKickoff := time.Date(2026, 5, 20, 0, 0, 0, 0, time.Local)
	project := model.Project{
		Base:       model.Base{ID: 551},
		OwnerID:    1,
		ProviderID: 2,
		Name:       "阶段时间校验项目",
		Address:    "阶段时间校验地址",
		StartDate:  &projectKickoff,
	}
	if err := db.Create(&project).Error; err != nil {
		t.Fatalf("create project: %v", err)
	}
	phase := model.ProjectPhase{Base: model.Base{ID: 552}, ProjectID: project.ID, PhaseType: "preparation", Seq: 1, Status: "pending", Enabled: true}
	if err := db.Create(&phase).Error; err != nil {
		t.Fatalf("create phase: %v", err)
	}

	err := (&ProjectService{}).UpdatePhase(phase.ID, &UpdatePhaseRequest{StartDate: "2026-05-19"})
	if err == nil {
		t.Fatalf("expected start date before kickoff to fail")
	}
	if got := err.Error(); got != "阶段计划开始时间不能早于项目开工日期" {
		t.Fatalf("unexpected error: %q", got)
	}
}

func TestProjectServiceUpdatePhaseRejectsEndDateBeforeStartDate(t *testing.T) {
	db := setupProjectServiceTestDB(t)

	startDate := time.Date(2026, 5, 21, 0, 0, 0, 0, time.Local)
	project := model.Project{
		Base:       model.Base{ID: 561},
		OwnerID:    1,
		ProviderID: 2,
		Name:       "阶段完成时间校验项目",
		Address:    "阶段完成时间校验地址",
		StartDate:  &startDate,
	}
	if err := db.Create(&project).Error; err != nil {
		t.Fatalf("create project: %v", err)
	}
	phase := model.ProjectPhase{
		Base:      model.Base{ID: 562},
		ProjectID: project.ID,
		PhaseType: "electrical",
		Seq:       3,
		Status:    "in_progress",
		Enabled:   true,
		StartDate: &startDate,
	}
	if err := db.Create(&phase).Error; err != nil {
		t.Fatalf("create phase: %v", err)
	}

	err := (&ProjectService{}).UpdatePhase(phase.ID, &UpdatePhaseRequest{EndDate: "2026-05-20"})
	if err == nil {
		t.Fatalf("expected end date before start date to fail")
	}
	if got := err.Error(); got != "计划完成时间不能早于计划开始时间" {
		t.Fatalf("unexpected error: %q", got)
	}
}

func TestProjectServiceUpdatePhaseRejectsStartDateBeforePreviousPhaseEndDate(t *testing.T) {
	db := setupProjectServiceTestDB(t)

	projectStart := time.Date(2026, 5, 15, 0, 0, 0, 0, time.Local)
	project := model.Project{
		Base:       model.Base{ID: 571},
		OwnerID:    1,
		ProviderID: 2,
		Name:       "阶段前序时间校验项目",
		Address:    "阶段前序时间校验地址",
		StartDate:  &projectStart,
	}
	if err := db.Create(&project).Error; err != nil {
		t.Fatalf("create project: %v", err)
	}
	previousEnd := time.Date(2026, 5, 20, 0, 0, 0, 0, time.Local)
	previousPhase := model.ProjectPhase{Base: model.Base{ID: 572}, ProjectID: project.ID, PhaseType: "preparation", Seq: 1, Status: "completed", Enabled: true, EndDate: &previousEnd}
	currentPhase := model.ProjectPhase{Base: model.Base{ID: 573}, ProjectID: project.ID, PhaseType: "demolition", Seq: 2, Status: "in_progress", Enabled: true}
	if err := db.Create(&[]model.ProjectPhase{previousPhase, currentPhase}).Error; err != nil {
		t.Fatalf("create phases: %v", err)
	}

	err := (&ProjectService{}).UpdatePhase(currentPhase.ID, &UpdatePhaseRequest{StartDate: "2026-05-19"})
	if err == nil {
		t.Fatalf("expected start date before previous phase end date to fail")
	}
	if got := err.Error(); got != "阶段计划开始时间不能早于上一阶段计划完成时间" {
		t.Fatalf("unexpected error: %q", got)
	}
}

func TestProjectServiceUpdatePhaseShiftsPendingFuturePhasesAfterDelayedEndDate(t *testing.T) {
	db := setupProjectServiceTestDB(t)

	projectStart := time.Date(2026, 5, 15, 0, 0, 0, 0, time.Local)
	project := model.Project{
		Base:       model.Base{ID: 581},
		OwnerID:    1,
		ProviderID: 2,
		Name:       "阶段后续时间校验项目",
		Address:    "阶段后续时间校验地址",
		StartDate:  &projectStart,
	}
	if err := db.Create(&project).Error; err != nil {
		t.Fatalf("create project: %v", err)
	}
	currentStart := time.Date(2026, 5, 18, 0, 0, 0, 0, time.Local)
	nextStart := time.Date(2026, 5, 24, 0, 0, 0, 0, time.Local)
	nextEnd := time.Date(2026, 5, 28, 0, 0, 0, 0, time.Local)
	thirdStart := time.Date(2026, 5, 29, 0, 0, 0, 0, time.Local)
	thirdEnd := time.Date(2026, 6, 2, 0, 0, 0, 0, time.Local)
	currentPhase := model.ProjectPhase{Base: model.Base{ID: 582}, ProjectID: project.ID, PhaseType: "demolition", Seq: 2, Status: "in_progress", Enabled: true, StartDate: &currentStart}
	nextPhase := model.ProjectPhase{Base: model.Base{ID: 583}, ProjectID: project.ID, PhaseType: "electrical", Seq: 3, Status: "pending", Enabled: true, StartDate: &nextStart, EndDate: &nextEnd}
	thirdPhase := model.ProjectPhase{Base: model.Base{ID: 584}, ProjectID: project.ID, PhaseType: "masonry", Seq: 4, Status: "pending", Enabled: true, StartDate: &thirdStart, EndDate: &thirdEnd}
	if err := db.Create(&[]model.ProjectPhase{currentPhase, nextPhase, thirdPhase}).Error; err != nil {
		t.Fatalf("create phases: %v", err)
	}

	err := (&ProjectService{}).UpdatePhase(currentPhase.ID, &UpdatePhaseRequest{EndDate: "2026-05-25"})
	if err != nil {
		t.Fatalf("expected delayed end date to shift pending future phases: %v", err)
	}

	var shiftedNext model.ProjectPhase
	if err := db.First(&shiftedNext, nextPhase.ID).Error; err != nil {
		t.Fatalf("load next phase: %v", err)
	}
	if shiftedNext.StartDate == nil || shiftedNext.StartDate.Format("2006-01-02") != "2026-05-25" {
		t.Fatalf("unexpected shifted next start date: %v", shiftedNext.StartDate)
	}
	if shiftedNext.EndDate == nil || shiftedNext.EndDate.Format("2006-01-02") != "2026-05-29" {
		t.Fatalf("unexpected shifted next end date: %v", shiftedNext.EndDate)
	}
	var shiftedThird model.ProjectPhase
	if err := db.First(&shiftedThird, thirdPhase.ID).Error; err != nil {
		t.Fatalf("load third phase: %v", err)
	}
	if shiftedThird.StartDate == nil || shiftedThird.StartDate.Format("2006-01-02") != "2026-05-30" {
		t.Fatalf("unexpected shifted third start date: %v", shiftedThird.StartDate)
	}
	if shiftedThird.EndDate == nil || shiftedThird.EndDate.Format("2006-01-02") != "2026-06-03" {
		t.Fatalf("unexpected shifted third end date: %v", shiftedThird.EndDate)
	}
}

func TestProjectServiceUpdatePhaseRejectsDelayedEndDateWhenFuturePhaseStarted(t *testing.T) {
	db := setupProjectServiceTestDB(t)

	project := model.Project{Base: model.Base{ID: 585}, OwnerID: 1, ProviderID: 2, Name: "已开始后续阶段项目", Address: "阶段时间地址"}
	if err := db.Create(&project).Error; err != nil {
		t.Fatalf("create project: %v", err)
	}
	currentStart := time.Date(2026, 5, 18, 0, 0, 0, 0, time.Local)
	nextStart := time.Date(2026, 5, 24, 0, 0, 0, 0, time.Local)
	currentPhase := model.ProjectPhase{Base: model.Base{ID: 586}, ProjectID: project.ID, PhaseType: "demolition", Seq: 2, Status: "in_progress", Enabled: true, StartDate: &currentStart}
	nextPhase := model.ProjectPhase{Base: model.Base{ID: 587}, ProjectID: project.ID, PhaseType: "electrical", Seq: 3, Status: "in_progress", Enabled: true, StartDate: &nextStart}
	if err := db.Create(&[]model.ProjectPhase{currentPhase, nextPhase}).Error; err != nil {
		t.Fatalf("create phases: %v", err)
	}

	err := (&ProjectService{}).UpdatePhase(currentPhase.ID, &UpdatePhaseRequest{EndDate: "2026-05-25"})
	if err == nil {
		t.Fatalf("expected delayed end date after started future phase to fail")
	}
	if got := err.Error(); got != "后续阶段已开始，不能自动顺延" {
		t.Fatalf("unexpected error: %q", got)
	}
}

func TestProjectServiceUpdatePhaseAllowsDelayedDatesAfterProjectExpectedEnd(t *testing.T) {
	db := setupProjectServiceTestDB(t)

	projectStart := time.Date(2026, 5, 15, 0, 0, 0, 0, time.Local)
	expectedEnd := time.Date(2026, 5, 30, 0, 0, 0, 0, time.Local)
	project := model.Project{
		Base:        model.Base{ID: 591},
		OwnerID:     1,
		ProviderID:  2,
		Name:        "延期阶段时间项目",
		Address:     "延期阶段时间地址",
		StartDate:   &projectStart,
		ExpectedEnd: &expectedEnd,
	}
	if err := db.Create(&project).Error; err != nil {
		t.Fatalf("create project: %v", err)
	}
	phase := model.ProjectPhase{Base: model.Base{ID: 592}, ProjectID: project.ID, PhaseType: "installation", Seq: 6, Status: "in_progress", Enabled: true}
	if err := db.Create(&phase).Error; err != nil {
		t.Fatalf("create phase: %v", err)
	}

	err := (&ProjectService{}).UpdatePhase(phase.ID, &UpdatePhaseRequest{
		StartDate: "2026-06-01",
		EndDate:   "2026-06-05",
	})
	if err != nil {
		t.Fatalf("expected delayed phase dates after project expected end to pass: %v", err)
	}
}

func TestProjectServiceUpdateProjectRejectsPhaseSelectionAfterStart(t *testing.T) {
	t.Setenv("ENCRYPTION_KEY", base64.StdEncoding.EncodeToString([]byte("12345678901234567890123456789012")))
	db := setupProjectServiceTestDB(t)

	owner := model.User{Base: model.Base{ID: 543}, Phone: "13800138543", Status: 1, Nickname: "开工业主"}
	provider := model.Provider{Base: model.Base{ID: 544}, ProviderType: 2, CompanyName: "开工装修公司"}
	if err := db.Create(&owner).Error; err != nil {
		t.Fatalf("create owner: %v", err)
	}
	if err := db.Create(&provider).Error; err != nil {
		t.Fatalf("create provider: %v", err)
	}
	project := model.Project{Base: model.Base{ID: 541}, OwnerID: 1, ProviderID: 2, Name: "已开工项目", Address: "已开工地址"}
	if err := db.Create(&project).Error; err != nil {
		t.Fatalf("create project: %v", err)
	}
	phase := model.ProjectPhase{Base: model.Base{ID: 542}, ProjectID: project.ID, PhaseType: "preparation", Seq: 1, Status: "in_progress", Enabled: true}
	if err := db.Create(&phase).Error; err != nil {
		t.Fatalf("create phase: %v", err)
	}

	_, err := (&ProjectService{}).UpdateProjectBasics(project.ID, &UpdateProjectBasicsRequest{
		OwnerID:           owner.ID,
		ProviderID:        provider.ID,
		Name:              "已开工项目",
		Address:           "已开工地址",
		Area:              100,
		Budget:            200000,
		MaterialMethod:    "platform",
		EnabledPhaseTypes: []string{"preparation", "electrical", "inspection"},
	})
	if err == nil {
		t.Fatalf("expected phase selection update after start to fail")
	}
	if got := err.Error(); got != "项目开工后不可调整阶段结构" {
		t.Fatalf("expected phase structure locked error, got %q", got)
	}
}

func TestProjectServiceConstructionClosureFlow(t *testing.T) {
	db := setupProjectServiceTestDB(t)

	user := model.User{Base: model.Base{ID: 7}, Phone: "13800138000", Status: 1}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}
	constructionProviderUser := model.User{Base: model.Base{ID: 8}, Phone: "13800138008", Status: 1}
	if err := db.Create(&constructionProviderUser).Error; err != nil {
		t.Fatalf("create construction provider user: %v", err)
	}
	admin := model.SysAdmin{ID: 9, Username: "admin", Password: "pwd", Nickname: "管理员", Status: 1}
	if err := db.Create(&admin).Error; err != nil {
		t.Fatalf("create admin: %v", err)
	}

	designProvider := model.Provider{Base: model.Base{ID: 77}, ProviderType: 1, CompanyName: "设计师"}
	constructionProvider := model.Provider{Base: model.Base{ID: 88}, UserID: constructionProviderUser.ID, ProviderType: 2, CompanyName: "施工公司"}
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
	var providerNotification model.Notification
	if err := db.Where("user_id = ? AND user_type = ? AND type = ?", constructionProviderUser.ID, "provider", "quote.awarded").
		Order("id DESC").
		First(&providerNotification).Error; err != nil {
		t.Fatalf("expected canonical quote.awarded notification for provider: %v", err)
	}
	if providerNotification.ActionURL != fmt.Sprintf("/projects/%d", project.ID) {
		t.Fatalf("expected provider quote-awarded notification to jump project detail, got %s", providerNotification.ActionURL)
	}
	var adminNotification model.Notification
	if err := db.Where("user_id = ? AND user_type = ? AND type = ?", admin.ID, "admin", "quote.awarded").
		Order("id DESC").
		First(&adminNotification).Error; err != nil {
		t.Fatalf("expected canonical quote.awarded notification for admin: %v", err)
	}
	var legacyNotificationCount int64
	if err := db.Model(&model.Notification{}).Where("type = ?", "project.construction_quote.confirmed").Count(&legacyNotificationCount).Error; err != nil {
		t.Fatalf("count legacy quote-confirmed notifications: %v", err)
	}
	if legacyNotificationCount != 0 {
		t.Fatalf("expected legacy project.construction_quote.confirmed notifications to be removed, got %d", legacyNotificationCount)
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
		CurrentPhase:           "待监理协调开工",
		BusinessStatus:         model.ProjectBusinessStatusConstructionQuoteConfirmed,
	}
	if err := db.Create(&project).Error; err != nil {
		t.Fatalf("create project: %v", err)
	}

	detail, err := (&ProjectService{}).GetProjectDetail(project.ID)
	if err != nil {
		t.Fatalf("GetProjectDetail: %v", err)
	}
	if detail.ProviderName != "施工公司C" {
		t.Fatalf("expected construction provider display name, got %q", detail.ProviderName)
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
		CurrentPhase:   "待监理协调开工",
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
