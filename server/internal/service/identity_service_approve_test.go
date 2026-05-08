package service

import (
	"testing"
	"time"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func TestApproveIdentityApplicationDoesNotOverwriteOtherProviderIdentity(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite failed: %v", err)
	}
	if err := db.AutoMigrate(
		&model.User{},
		&model.Provider{},
		&model.UserIdentity{},
	); err != nil {
		t.Fatalf("auto migrate failed: %v", err)
	}
	if err := db.Exec(`CREATE TABLE identity_applications (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		created_at DATETIME,
		updated_at DATETIME,
		user_id INTEGER NOT NULL,
		identity_type TEXT NOT NULL,
		application_data TEXT NOT NULL,
		status INTEGER DEFAULT 0,
		reject_reason TEXT,
		applied_at DATETIME,
		reviewed_at DATETIME,
		reviewed_by INTEGER
	)`).Error; err != nil {
		t.Fatalf("create identity_applications failed: %v", err)
	}
	if err := db.Exec(`CREATE TABLE identity_audit_logs (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		user_id INTEGER NOT NULL,
		action TEXT NOT NULL,
		from_identity TEXT,
		to_identity TEXT,
		ip_address TEXT,
		user_agent TEXT,
		metadata TEXT,
		created_at DATETIME
	)`).Error; err != nil {
		t.Fatalf("create identity_audit_logs failed: %v", err)
	}

	previousDB := repository.DB
	repository.DB = db
	t.Cleanup(func() {
		repository.DB = previousDB
	})

	user := model.User{
		Base:                model.Base{ID: 1001},
		Phone:               "13800130001",
		Nickname:            "owner-provider",
		UserType:            1,
		Status:              1,
		DefaultIdentityType: "owner",
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("create user failed: %v", err)
	}

	existingProvider := model.Provider{
		Base:         model.Base{ID: 2001},
		UserID:       user.ID,
		ProviderType: 1,
		DisplayName:  "历史设计师",
		SubType:      "designer",
		Status:       1,
		Verified:     true,
	}
	if err := db.Create(&existingProvider).Error; err != nil {
		t.Fatalf("create existing provider failed: %v", err)
	}
	existingProviderRefID := existingProvider.ID
	existingIdentity := model.UserIdentity{
		Base:          model.Base{ID: 3001},
		UserID:        user.ID,
		IdentityType:  "provider",
		IdentityRefID: &existingProviderRefID,
		Status:        1,
		Verified:      true,
	}
	if err := db.Create(&existingIdentity).Error; err != nil {
		t.Fatalf("create existing provider identity failed: %v", err)
	}

	application := model.IdentityApplication{
		Base:            model.Base{ID: 4001},
		UserID:          user.ID,
		IdentityType:    "provider",
		ApplicationData: `{"providerSubType":"foreman"}`,
		Status:          0,
		AppliedAt:       time.Now(),
	}
	if err := db.Create(&application).Error; err != nil {
		t.Fatalf("create identity application failed: %v", err)
	}

	svc := &IdentityService{}
	if err := svc.ApproveIdentityApplication(application.ID, 9001); err != nil {
		t.Fatalf("approve identity application failed: %v", err)
	}

	var updatedExistingProvider model.Provider
	if err := db.First(&updatedExistingProvider, existingProvider.ID).Error; err != nil {
		t.Fatalf("query existing provider failed: %v", err)
	}
	if updatedExistingProvider.SubType != "designer" {
		t.Fatalf("expected existing provider subtype stay designer, got %s", updatedExistingProvider.SubType)
	}

	var newProvider model.Provider
	if err := db.Where("source_application_id = ? AND user_id = ?", application.ID, user.ID).First(&newProvider).Error; err != nil {
		t.Fatalf("query new provider by source_application_id failed: %v", err)
	}
	if newProvider.ID == existingProvider.ID {
		t.Fatalf("expected approved application create/target dedicated provider record")
	}
	if newProvider.SubType != "foreman" {
		t.Fatalf("expected new provider subtype foreman, got %s", newProvider.SubType)
	}

	var oldIdentity model.UserIdentity
	if err := db.First(&oldIdentity, existingIdentity.ID).Error; err != nil {
		t.Fatalf("query old provider identity failed: %v", err)
	}
	if oldIdentity.IdentityRefID == nil || *oldIdentity.IdentityRefID != existingProvider.ID {
		t.Fatalf("expected old identity keep ref=%d, got %v", existingProvider.ID, oldIdentity.IdentityRefID)
	}

	var newIdentity model.UserIdentity
	if err := db.Where("user_id = ? AND identity_type = ? AND identity_ref_id = ?", user.ID, "provider", newProvider.ID).First(&newIdentity).Error; err != nil {
		t.Fatalf("query new provider identity failed: %v", err)
	}
	if newIdentity.Status != 1 || !newIdentity.Verified {
		t.Fatalf("expected new identity active+verified, got status=%d verified=%v", newIdentity.Status, newIdentity.Verified)
	}
}
