package service

import (
	"testing"
	"time"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"

	gormsqlite "gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupAuditLogServiceDB(t *testing.T) *gorm.DB {
	t.Helper()

	db, err := gorm.Open(gormsqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite db: %v", err)
	}

	if err := db.AutoMigrate(&model.AuditLog{}); err != nil {
		t.Fatalf("auto migrate audit log: %v", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		t.Fatalf("get sql db: %v", err)
	}
	sqlDB.SetMaxOpenConns(1)
	sqlDB.SetMaxIdleConns(1)

	previousDB := repository.DB
	repository.DB = db
	t.Cleanup(func() {
		repository.DB = previousDB
		_ = sqlDB.Close()
	})

	return db
}

func TestResolveAuditRetentionDaysHasFloor(t *testing.T) {
	if got := ResolveAuditRetentionDays(0); got != 60 {
		t.Fatalf("expected retention floor 60, got %d", got)
	}
	if got := ResolveAuditRetentionDays(30); got != 60 {
		t.Fatalf("expected retention floor 60, got %d", got)
	}
	if got := ResolveAuditRetentionDays(180); got != 180 {
		t.Fatalf("expected retention 180, got %d", got)
	}
}

func TestCleanupExpiredAuditLogs(t *testing.T) {
	db := setupAuditLogServiceDB(t)

	oldLog := model.AuditLog{
		RecordKind:    "business",
		OperatorType:  "admin",
		OperatorID:    1,
		Action:        "POST /api/v1/admin/withdraws/1/approve",
		OperationType: "approve_withdraw",
		ResourceType:  "withdraw",
		Result:        "success",
	}
	if err := db.Create(&oldLog).Error; err != nil {
		t.Fatalf("create old log: %v", err)
	}

	newLog := model.AuditLog{
		RecordKind:    "business",
		OperatorType:  "admin",
		OperatorID:    2,
		Action:        "POST /api/v1/admin/refunds/1/approve",
		OperationType: "approve_refund",
		ResourceType:  "refund",
		Result:        "success",
	}
	if err := db.Create(&newLog).Error; err != nil {
		t.Fatalf("create new log: %v", err)
	}

	oldCreatedAt := time.Now().Add(-181 * 24 * time.Hour)
	if err := db.Model(&model.AuditLog{}).Where("id = ?", oldLog.ID).Update("created_at", oldCreatedAt).Error; err != nil {
		t.Fatalf("update old log created_at: %v", err)
	}

	svc := &AuditLogService{}
	removed, err := svc.CleanupExpiredAuditLogs(90)
	if err != nil {
		t.Fatalf("cleanup expired audit logs: %v", err)
	}
	if removed != 1 {
		t.Fatalf("expected 1 removed log, got %d", removed)
	}

	var remaining []model.AuditLog
	if err := db.Order("id ASC").Find(&remaining).Error; err != nil {
		t.Fatalf("list remaining logs: %v", err)
	}
	if len(remaining) != 1 {
		t.Fatalf("expected 1 remaining log, got %d", len(remaining))
	}
	if remaining[0].ID != newLog.ID {
		t.Fatalf("expected remaining log id=%d, got %d", newLog.ID, remaining[0].ID)
	}
}
