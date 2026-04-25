package handler

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"

	"github.com/gin-gonic/gin"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupUserSettingsHandlerDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite db: %v", err)
	}
	if err := db.AutoMigrate(&model.UserSettings{}); err != nil {
		t.Fatalf("auto migrate user settings: %v", err)
	}
	oldDB := repository.DB
	repository.DB = db
	t.Cleanup(func() {
		repository.DB = oldDB
	})
	return db
}

func TestUpdateUserSettingsMapsCamelCasePayload(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupUserSettingsHandlerDB(t)

	settings := model.UserSettings{
		UserID:        7101,
		NotifySystem:  true,
		NotifyProject: true,
		NotifyPayment: true,
		FontSize:      "medium",
		Language:      "zh",
	}
	if err := db.Create(&settings).Error; err != nil {
		t.Fatalf("create user settings: %v", err)
	}

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(
		http.MethodPut,
		"/api/v1/user/settings",
		bytes.NewReader([]byte(`{"notifyProject":false,"notifyPayment":false,"fontSize":"large","userId":999,"unknown":true}`)),
	)
	c.Request.Header.Set("Content-Type", "application/json")
	c.Set("userId", settings.UserID)

	UpdateUserSettings(c)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}

	var updated model.UserSettings
	if err := db.Where("user_id = ?", settings.UserID).First(&updated).Error; err != nil {
		t.Fatalf("load updated settings: %v", err)
	}
	if updated.NotifyProject {
		t.Fatalf("expected notify project to be disabled")
	}
	if updated.NotifyPayment {
		t.Fatalf("expected notify payment to be disabled")
	}
	if !updated.NotifySystem {
		t.Fatalf("expected notify system to be unchanged")
	}
	if updated.FontSize != "large" {
		t.Fatalf("expected font size large, got %q", updated.FontSize)
	}
	if updated.UserID != settings.UserID {
		t.Fatalf("expected user id unchanged, got %d", updated.UserID)
	}
}
