package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"

	"github.com/gin-gonic/gin"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

type merchantBookingHandleEnvelope struct {
	Code    int             `json:"code"`
	Message string          `json:"message"`
	Data    json.RawMessage `json:"data"`
}

func setupMerchantBookingHandleTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite db: %v", err)
	}
	if err := db.AutoMigrate(
		&model.Booking{},
		&model.Notification{},
		&model.BusinessFlow{},
	); err != nil {
		t.Fatalf("auto migrate merchant booking handle models: %v", err)
	}

	previousDB := repository.DB
	repository.DB = db
	t.Cleanup(func() {
		repository.DB = previousDB
	})

	return db
}

func performMerchantBookingHandleRequest(t *testing.T, bookingID uint64, providerID uint64, payload any) merchantBookingHandleEnvelope {
	t.Helper()

	body, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("marshal payload: %v", err)
	}

	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Request = httptest.NewRequest(http.MethodPut, "/api/v1/merchant/bookings/"+strconv.FormatUint(bookingID, 10)+"/handle", bytes.NewReader(body))
	context.Request.Header.Set("Content-Type", "application/json")
	context.Set("providerId", providerID)
	context.Params = gin.Params{{Key: "id", Value: strconv.FormatUint(bookingID, 10)}}
	MerchantHandleBooking(context)

	var envelope merchantBookingHandleEnvelope
	if err := json.Unmarshal(recorder.Body.Bytes(), &envelope); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	return envelope
}

func TestMerchantHandleBookingRejectCreatesUserNotification(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupMerchantBookingHandleTestDB(t)

	booking := model.Booking{
		Base:         model.Base{ID: 1},
		UserID:       2001,
		ProviderID:   3001,
		ProviderType: "designer",
		Status:       1,
	}
	if err := db.Create(&booking).Error; err != nil {
		t.Fatalf("create booking: %v", err)
	}

	envelope := performMerchantBookingHandleRequest(t, booking.ID, booking.ProviderID, map[string]string{"action": "reject"})
	if envelope.Code != 0 {
		t.Fatalf("expected success response, got code=%d message=%s", envelope.Code, envelope.Message)
	}

	var updated model.Booking
	if err := db.First(&updated, booking.ID).Error; err != nil {
		t.Fatalf("reload booking: %v", err)
	}
	if updated.Status != 4 {
		t.Fatalf("expected booking status 4, got %d", updated.Status)
	}

	var notifications []model.Notification
	if err := db.Order("id ASC").Find(&notifications).Error; err != nil {
		t.Fatalf("load notifications: %v", err)
	}
	if len(notifications) != 1 {
		t.Fatalf("expected 1 notification, got %d", len(notifications))
	}
	if notifications[0].UserID != booking.UserID || notifications[0].Type != model.NotificationTypeBookingCancelled {
		t.Fatalf("unexpected notification: %+v", notifications[0])
	}
	if notifications[0].ActionURL != "/bookings/1" {
		t.Fatalf("expected action url /bookings/1, got %s", notifications[0].ActionURL)
	}
}

func TestMerchantHandleBookingConfirmCreatesUserNotification(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupMerchantBookingHandleTestDB(t)

	booking := model.Booking{
		Base:         model.Base{ID: 1},
		UserID:       2002,
		ProviderID:   3002,
		ProviderType: "company",
		Status:       1,
	}
	if err := db.Create(&booking).Error; err != nil {
		t.Fatalf("create booking: %v", err)
	}

	envelope := performMerchantBookingHandleRequest(t, booking.ID, booking.ProviderID, map[string]string{"action": "confirm"})
	if envelope.Code != 0 {
		t.Fatalf("expected success response, got code=%d message=%s", envelope.Code, envelope.Message)
	}

	var updated model.Booking
	if err := db.First(&updated, booking.ID).Error; err != nil {
		t.Fatalf("reload booking: %v", err)
	}
	if updated.Status != 2 {
		t.Fatalf("expected booking status 2, got %d", updated.Status)
	}

	var notification model.Notification
	if err := db.First(&notification).Error; err != nil {
		t.Fatalf("load notification: %v", err)
	}
	if notification.Type != model.NotificationTypeBookingConfirmed {
		t.Fatalf("expected confirmed notification, got %+v", notification)
	}
	if notification.ActionURL != "/bookings/1" {
		t.Fatalf("expected action url /bookings/1, got %s", notification.ActionURL)
	}
}
