package service

import (
	"testing"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupSystemAlertTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	db, err := gorm.Open(sqlite.Open("file::memory:?cache=shared"), &gorm.Config{})
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
