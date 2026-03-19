package repository

import (
	"testing"

	"home-decoration-server/internal/model"
)

func TestEnsureRuntimeSchemaColumnsCreatesUserRuntimeTables(t *testing.T) {
	setupSchemaHealthDB(t)

	if err := ensureRuntimeSchemaColumns(); err != nil {
		t.Fatalf("ensure runtime schema columns: %v", err)
	}

	for name, runtimeModel := range map[string]interface{}{
		"user_settings":      &model.UserSettings{},
		"user_verifications": &model.UserVerification{},
		"user_login_devices": &model.UserLoginDevice{},
		"user_feedbacks":     &model.UserFeedback{},
	} {
		if !DB.Migrator().HasTable(runtimeModel) {
			t.Fatalf("expected table %s to exist", name)
		}
	}
}
