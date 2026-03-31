package service

import (
	"testing"
	"time"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupSystemAlertTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	dsn := "file:" + t.Name() + "?mode=memory&cache=shared"
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&model.RiskWarning{}, &model.SysAdmin{}, &model.Notification{}); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}

	originalDB := repository.DB
	repository.DB = db
	t.Cleanup(func() {
		repository.DB = originalDB
	})
	return db
}

func TestSystemAlertServiceUpsertAndResolve(t *testing.T) {
	db := setupSystemAlertTestDB(t)
	if err := db.Create(&model.SysAdmin{ID: 7001, Username: "root", Password: "x", Status: 1}).Error; err != nil {
		t.Fatalf("create admin: %v", err)
	}

	svc := &SystemAlertService{}
	first, created, err := svc.UpsertAlert(&CreateSystemAlertInput{
		Type:        SystemAlertTypeRefundSyncFailure,
		Level:       "critical",
		Scope:       "退款同步/申请1/退款单2",
		Description: "第一次失败",
		ActionURL:   "/risk/warnings",
	})
	if err != nil {
		t.Fatalf("UpsertAlert first: %v", err)
	}
	if !created || first.ID == 0 {
		t.Fatalf("expected first alert to be created")
	}

	second, created, err := svc.UpsertAlert(&CreateSystemAlertInput{
		Type:        SystemAlertTypeRefundSyncFailure,
		Level:       "high",
		Scope:       "退款同步/申请1/退款单2",
		Description: "第二次失败",
	})
	if err != nil {
		t.Fatalf("UpsertAlert second: %v", err)
	}
	if created {
		t.Fatalf("expected second alert to refresh existing record")
	}
	if second.ID != first.ID {
		t.Fatalf("expected same alert record, got %d vs %d", second.ID, first.ID)
	}

	var warnings []model.RiskWarning
	if err := db.Find(&warnings).Error; err != nil {
		t.Fatalf("find warnings: %v", err)
	}
	if len(warnings) != 1 {
		t.Fatalf("expected 1 warning, got %d", len(warnings))
	}

	affected, err := svc.ResolveAlert(SystemAlertTypeRefundSyncFailure, "退款同步/申请1/退款单2", "已恢复")
	if err != nil {
		t.Fatalf("ResolveAlert: %v", err)
	}
	if affected != 1 {
		t.Fatalf("expected 1 resolved warning, got %d", affected)
	}

	var warning model.RiskWarning
	if err := db.First(&warning, first.ID).Error; err != nil {
		t.Fatalf("reload warning: %v", err)
	}
	if warning.Status != 2 || warning.HandleResult != "已恢复" {
		t.Fatalf("unexpected warning after resolve: %+v", warning)
	}
}

func TestSystemAlertServiceListRiskWarningsFiltersStatusAndLevel(t *testing.T) {
	db := setupSystemAlertTestDB(t)
	records := []model.RiskWarning{
		{Base: model.Base{ID: 1, CreatedAt: time.Now(), UpdatedAt: time.Now()}, ProjectID: 11, ProjectName: "项目A", Type: "refund", Level: "high", Description: "高风险退款", Status: 0},
		{Base: model.Base{ID: 2, CreatedAt: time.Now(), UpdatedAt: time.Now()}, ProjectID: 12, ProjectName: "项目B", Type: "quality", Level: "medium", Description: "质量问题", Status: 1},
		{Base: model.Base{ID: 3, CreatedAt: time.Now(), UpdatedAt: time.Now()}, ProjectID: 13, ProjectName: "项目C", Type: "refund", Level: "high", Description: "已处理退款", Status: 2},
	}
	for i := range records {
		if err := db.Create(&records[i]).Error; err != nil {
			t.Fatalf("seed warning: %v", err)
		}
	}

	list, total, err := (&SystemAlertService{}).ListRiskWarnings(ListRiskWarningFilter{
		Page:     1,
		PageSize: 10,
		Level:    "high",
		Status:   "0",
	})
	if err != nil {
		t.Fatalf("ListRiskWarnings: %v", err)
	}
	if total != 1 {
		t.Fatalf("expected total 1, got %d", total)
	}
	if len(list) != 1 || list[0].ID != 1 {
		t.Fatalf("unexpected list result: %+v", list)
	}
}

func TestSystemAlertServiceHandleRiskWarning(t *testing.T) {
	db := setupSystemAlertTestDB(t)
	if err := db.Create(&model.RiskWarning{
		Base:        model.Base{ID: 10, CreatedAt: time.Now(), UpdatedAt: time.Now()},
		ProjectID:   21,
		ProjectName: "项目D",
		Type:        "payment",
		Level:       "critical",
		Description: "放款失败",
		Status:      0,
	}).Error; err != nil {
		t.Fatalf("seed warning: %v", err)
	}

	view, err := (&SystemAlertService{}).HandleRiskWarning(10, 7001, &HandleRiskWarningInput{
		Status: 2,
		Result: "已完成人工核查",
	})
	if err != nil {
		t.Fatalf("HandleRiskWarning: %v", err)
	}
	if view.Status != 2 || view.HandleResult != "已完成人工核查" {
		t.Fatalf("unexpected warning view: %+v", view)
	}
	if view.HandledBy == nil || *view.HandledBy != 7001 {
		t.Fatalf("expected handledBy=7001, got %+v", view.HandledBy)
	}

	if _, err := (&SystemAlertService{}).HandleRiskWarning(10, 7001, &HandleRiskWarningInput{
		Status: 2,
		Result: "重复处理",
	}); err == nil || err.Error() != "预警已处理" {
		t.Fatalf("expected handled conflict, got %v", err)
	}
}
