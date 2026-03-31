package service

import (
	"os"
	"testing"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"

	gormsqlite "gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupBookingServiceNotificationTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	db, err := gorm.Open(gormsqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite db: %v", err)
	}
	if err := db.AutoMigrate(
		&model.User{},
		&model.Provider{},
		&model.Booking{},
		&model.Notification{},
		&model.BusinessFlow{},
		&model.SystemConfig{},
	); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}

	previousDB := repository.DB
	repository.DB = db
	t.Cleanup(func() {
		repository.DB = previousDB
	})

	return db
}

func TestBookingServiceCreateNotifiesProviderForPendingConfirmation(t *testing.T) {
	db := setupBookingServiceNotificationTestDB(t)

	previousKey := os.Getenv("ENCRYPTION_KEY")
	if err := os.Setenv("ENCRYPTION_KEY", "0123456789abcdef0123456789abcdef"); err != nil {
		t.Fatalf("set encryption key: %v", err)
	}
	t.Cleanup(func() {
		_ = os.Setenv("ENCRYPTION_KEY", previousKey)
	})

	providerUser := model.User{Base: model.Base{ID: 11}, Nickname: "设计师A"}
	provider := model.Provider{
		Base:         model.Base{ID: 21},
		UserID:       providerUser.ID,
		ProviderType: 1,
		CompanyName:  "设计师A工作室",
	}
	if err := db.Create(&providerUser).Error; err != nil {
		t.Fatalf("create provider user: %v", err)
	}
	if err := db.Create(&provider).Error; err != nil {
		t.Fatalf("create provider: %v", err)
	}

	svc := &BookingService{}
	booking, err := svc.Create(1001, &CreateBookingRequest{
		ProviderID:     provider.ID,
		ProviderType:   "designer",
		Address:        "西安市高新区科技路 88 号",
		Area:           98,
		RenovationType: "全案设计服务",
		BudgetRange:    "20-30万",
		PreferredDate:  "2026-03-30",
		Phone:          "13800138000",
		Notes:          "希望先沟通需求，再安排量房。",
	})
	if err != nil {
		t.Fatalf("create booking: %v", err)
	}
	if booking.Status != 1 {
		t.Fatalf("expected pending booking status, got %d", booking.Status)
	}

	var notifications []model.Notification
	if err := db.Order("id ASC").Find(&notifications).Error; err != nil {
		t.Fatalf("load notifications: %v", err)
	}
	if len(notifications) != 1 {
		t.Fatalf("expected 1 notification, got %d", len(notifications))
	}

	got := notifications[0]
	if got.UserID != providerUser.ID || got.UserType != "provider" {
		t.Fatalf("unexpected notification receiver: %+v", got)
	}
	if got.Type != model.NotificationTypeBookingCreated {
		t.Fatalf("expected booking created notification, got %s", got.Type)
	}
	if got.ActionURL != "/bookings" {
		t.Fatalf("expected action url /bookings, got %s", got.ActionURL)
	}
}
