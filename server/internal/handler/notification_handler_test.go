package handler

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"

	"github.com/gin-gonic/gin"
	gormsqlite "gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupNotificationHandlerTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(gormsqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite db: %v", err)
	}
	if err := db.AutoMigrate(&model.Notification{}); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}
	previousDB := repository.DB
	repository.DB = db
	t.Cleanup(func() { repository.DB = previousDB })
	return db
}

func TestGetNotificationsUsesProviderContext(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupNotificationHandlerTestDB(t)

	notification := model.Notification{
		Base:     model.Base{ID: 1},
		UserID:   88,
		UserType: "provider",
		Title:    "商家通知",
		Content:  "测试通知",
		Type:     "project.paused",
		IsRead:   false,
	}
	if err := db.Create(&notification).Error; err != nil {
		t.Fatalf("create notification: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/merchant/notifications?page=1&pageSize=20", nil)
	w := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(w)
	ctx.Request = req
	ctx.Set("providerId", uint64(88))

	GetNotifications(ctx)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", w.Code, w.Body.String())
	}
	if body := w.Body.String(); body == "" || !strings.Contains(body, "商家通知") {
		t.Fatalf("expected provider notification in response, got %s", body)
	}
}
