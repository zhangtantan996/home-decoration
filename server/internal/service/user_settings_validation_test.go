package service

import (
	"testing"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupUserSettingsServiceValidationDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite db: %v", err)
	}
	if err := db.AutoMigrate(&model.UserFeedback{}); err != nil {
		t.Fatalf("auto migrate user feedback: %v", err)
	}
	oldDB := repository.DB
	repository.DB = db
	t.Cleanup(func() {
		repository.DB = oldDB
	})
	return db
}

func TestUserSettingsServiceSubmitFeedbackRejectsInvalidInput(t *testing.T) {
	db := setupUserSettingsServiceValidationDB(t)
	svc := &UserSettingsService{}

	cases := []struct {
		name        string
		feedbackTyp string
		content     string
		contact     string
		images      string
	}{
		{name: "unknown type", feedbackTyp: "SQL错误", content: "页面不好用"},
		{name: "blank content", feedbackTyp: "产品建议", content: "   "},
		{name: "invalid contact", feedbackTyp: "产品建议", content: "页面不好用", contact: "not phone"},
		{name: "external image", feedbackTyp: "产品建议", content: "页面不好用", images: `["https://evil.example/a.png"]`},
	}

	for _, tt := range cases {
		t.Run(tt.name, func(t *testing.T) {
			if err := svc.SubmitFeedback(1001, tt.feedbackTyp, tt.content, tt.contact, tt.images); err == nil {
				t.Fatalf("expected feedback validation error")
			}
		})
	}

	var count int64
	if err := db.Model(&model.UserFeedback{}).Count(&count).Error; err != nil {
		t.Fatalf("count feedback: %v", err)
	}
	if count != 0 {
		t.Fatalf("expected no feedback persisted, got %d", count)
	}
}
