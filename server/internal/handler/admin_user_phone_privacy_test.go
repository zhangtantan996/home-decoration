package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"

	gormsqlite "gorm.io/driver/sqlite"
	"gorm.io/gorm"

	"github.com/gin-gonic/gin"
)

func setupAdminUserPhonePrivacyDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(gormsqlite.Open("file:admin_user_phone_privacy?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite db: %v", err)
	}
	if err := db.AutoMigrate(&model.User{}); err != nil {
		t.Fatalf("auto migrate user: %v", err)
	}
	oldDB := repository.DB
	repository.DB = db
	t.Cleanup(func() {
		repository.DB = oldDB
	})
	return db
}

func decodeAdminUserPhonePrivacyEnvelope(t *testing.T, recorder *httptest.ResponseRecorder) map[string]any {
	t.Helper()
	var envelope struct {
		Code int            `json:"code"`
		Data map[string]any `json:"data"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &envelope); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if envelope.Code != 0 {
		t.Fatalf("unexpected business code: %d body=%s", envelope.Code, recorder.Body.String())
	}
	return envelope.Data
}

func TestAdminGetUserMasksPhoneWithoutPrivilegeAndShowsFullForSuperAdmin(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupAdminUserPhonePrivacyDB(t)

	user := model.User{
		Base:     model.Base{ID: 101},
		Phone:    "13800138000",
		Nickname: "测试用户",
		Status:   1,
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}

	maskedRecorder := httptest.NewRecorder()
	maskedCtx, _ := gin.CreateTestContext(maskedRecorder)
	maskedCtx.Request = httptest.NewRequest(http.MethodGet, "/api/v1/admin/users/101", nil)
	maskedCtx.Params = gin.Params{{Key: "id", Value: "101"}}
	AdminGetUser(maskedCtx)
	maskedData := decodeAdminUserPhonePrivacyEnvelope(t, maskedRecorder)
	if got := maskedData["phone"]; got != "138****8000" {
		t.Fatalf("expected masked phone, got %#v", got)
	}

	fullRecorder := httptest.NewRecorder()
	fullCtx, _ := gin.CreateTestContext(fullRecorder)
	fullCtx.Request = httptest.NewRequest(http.MethodGet, "/api/v1/admin/users/101", nil)
	fullCtx.Params = gin.Params{{Key: "id", Value: "101"}}
	fullCtx.Set("is_super", true)
	AdminGetUser(fullCtx)
	fullData := decodeAdminUserPhonePrivacyEnvelope(t, fullRecorder)
	if got := fullData["phone"]; got != user.Phone {
		t.Fatalf("expected full phone, got %#v", got)
	}
}
