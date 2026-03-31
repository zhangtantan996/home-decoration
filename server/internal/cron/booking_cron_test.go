package cron

import (
	"testing"
	"time"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"

	gormsqlite "gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupBookingCronTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	db, err := gorm.Open(gormsqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite db: %v", err)
	}
	if err := db.AutoMigrate(&model.Notification{}, &model.Provider{}, &model.Booking{}, &model.Proposal{}); err != nil {
		t.Fatalf("migrate sqlite db: %v", err)
	}

	previousDB := repository.DB
	repository.DB = db
	t.Cleanup(func() {
		repository.DB = previousDB
	})

	return db
}

func TestHandleUserConfirmTimeoutUsesRealNotificationRoutes(t *testing.T) {
	db := setupBookingCronTestDB(t)

	provider := &model.Provider{
		Base:            model.Base{ID: 301},
		UserID:          901,
		ProviderType:    2,
		CompanyName:     "测试商家",
		Status:          1,
		EntityType:      "company",
		SubType:         "company",
		EstablishedYear: 2020,
	}
	if err := db.Create(provider).Error; err != nil {
		t.Fatalf("create provider: %v", err)
	}

	booking := &model.Booking{
		Base:       model.Base{ID: 101},
		UserID:     801,
		ProviderID: provider.ID,
		Address:    "测试地址",
		Status:     1,
	}
	if err := db.Create(booking).Error; err != nil {
		t.Fatalf("create booking: %v", err)
	}

	deadline := time.Now().Add(-2 * time.Hour)
	proposal := &model.Proposal{
		Base:                 model.Base{ID: 201},
		BookingID:            booking.ID,
		Status:               model.ProposalStatusPending,
		UserResponseDeadline: &deadline,
	}
	if err := db.Create(proposal).Error; err != nil {
		t.Fatalf("create proposal: %v", err)
	}

	handleUserConfirmTimeout()

	var notifications []model.Notification
	if err := db.Order("id ASC").Find(&notifications).Error; err != nil {
		t.Fatalf("load notifications: %v", err)
	}
	if len(notifications) != 2 {
		t.Fatalf("expected 2 notifications, got %d", len(notifications))
	}

	if notifications[0].ActionURL != "/bookings/101" {
		t.Fatalf("expected user timeout actionUrl=/bookings/101, got %s", notifications[0].ActionURL)
	}
	if notifications[1].ActionURL != "/proposals" {
		t.Fatalf("expected provider timeout actionUrl=/proposals, got %s", notifications[1].ActionURL)
	}
}
