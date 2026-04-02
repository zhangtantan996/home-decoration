package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"

	"github.com/gin-gonic/gin"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

type userProfileEnvelope struct {
	Code int `json:"code"`
	Data struct {
		ID       uint64 `json:"id"`
		Nickname string `json:"nickname"`
		Avatar   string `json:"avatar"`
		Birthday string `json:"birthday"`
		Bio      string `json:"bio"`
	} `json:"data"`
}

func setupUserProfileHandlerDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite db: %v", err)
	}
	if err := db.AutoMigrate(&model.User{}); err != nil {
		t.Fatalf("auto migrate user model: %v", err)
	}
	oldDB := repository.DB
	repository.DB = db
	t.Cleanup(func() {
		repository.DB = oldDB
	})
	return db
}

func decodeUserProfileEnvelope(t *testing.T, recorder *httptest.ResponseRecorder) userProfileEnvelope {
	t.Helper()
	var envelope userProfileEnvelope
	if err := json.Unmarshal(recorder.Body.Bytes(), &envelope); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	return envelope
}

func TestGetProfileReadsUint64UserID(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupUserProfileHandlerDB(t)

	user := model.User{
		Phone:    "13800138000",
		Nickname: "张三",
		Bio:      "喜欢简洁的生活方式",
		UserType: 1,
		Status:   1,
	}
	birthday := time.Date(1992, time.August, 18, 0, 0, 0, 0, time.UTC)
	user.Birthday = &birthday
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodGet, "/api/v1/user/profile", nil)
	c.Set("userId", user.ID)

	GetProfile(c)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", recorder.Code)
	}
	envelope := decodeUserProfileEnvelope(t, recorder)
	if envelope.Code != 0 {
		t.Fatalf("expected business code 0, got %d", envelope.Code)
	}
	if envelope.Data.ID != user.ID {
		t.Fatalf("expected user id %d, got %d", user.ID, envelope.Data.ID)
	}
	if envelope.Data.Birthday != "1992-08-18" {
		t.Fatalf("expected birthday 1992-08-18, got %q", envelope.Data.Birthday)
	}
	if envelope.Data.Bio != "喜欢简洁的生活方式" {
		t.Fatalf("expected bio to be returned, got %q", envelope.Data.Bio)
	}
}

func TestUpdateProfileReadsUint64UserID(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupUserProfileHandlerDB(t)

	user := model.User{
		Phone:    "13800138001",
		Nickname: "旧昵称",
		UserType: 1,
		Status:   1,
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPut, "/api/v1/user/profile", bytes.NewReader([]byte(`{"nickname":"新昵称","avatar":"/uploads/avatar.png","birthday":"1990-05-20","bio":"希望把装修过程管理得更清晰。"}`)))
	c.Request.Header.Set("Content-Type", "application/json")
	c.Set("userId", user.ID)

	UpdateProfile(c)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", recorder.Code)
	}

	var updated model.User
	if err := db.First(&updated, user.ID).Error; err != nil {
		t.Fatalf("load updated user: %v", err)
	}
	if updated.Nickname != "新昵称" {
		t.Fatalf("expected nickname to be updated, got %q", updated.Nickname)
	}
	if updated.Avatar != "/uploads/avatar.png" {
		t.Fatalf("expected avatar to be updated, got %q", updated.Avatar)
	}
	if updated.Birthday == nil || updated.Birthday.Format("2006-01-02") != "1990-05-20" {
		t.Fatalf("expected birthday to be updated, got %+v", updated.Birthday)
	}
	if updated.Bio != "希望把装修过程管理得更清晰。" {
		t.Fatalf("expected bio to be updated, got %q", updated.Bio)
	}
}

func TestUpdateProfileNormalizesAbsoluteAvatarURLToStoredPath(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupUserProfileHandlerDB(t)

	user := model.User{
		Phone:    "13800138011",
		Nickname: "旧昵称",
		UserType: 1,
		Status:   1,
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(
		http.MethodPut,
		"/api/v1/user/profile",
		bytes.NewReader([]byte(`{"nickname":"新昵称","avatar":"https://cdn.example.com/uploads/avatar.png?x=1"}`)),
	)
	c.Request.Header.Set("Content-Type", "application/json")
	c.Set("userId", user.ID)

	UpdateProfile(c)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", recorder.Code)
	}

	var updated model.User
	if err := db.First(&updated, user.ID).Error; err != nil {
		t.Fatalf("load updated user: %v", err)
	}
	if updated.Avatar != "/uploads/avatar.png" {
		t.Fatalf("expected stored avatar path to be normalized, got %q", updated.Avatar)
	}
}

func TestUpdateProfileRejectsInvalidBirthday(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupUserProfileHandlerDB(t)

	user := model.User{
		Phone:    "13800138002",
		Nickname: "旧昵称",
		UserType: 1,
		Status:   1,
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPut, "/api/v1/user/profile", bytes.NewReader([]byte(`{"birthday":"1990/05/20"}`)))
	c.Request.Header.Set("Content-Type", "application/json")
	c.Set("userId", user.ID)

	UpdateProfile(c)

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400, got %d", recorder.Code)
	}
}

func TestUpdateProfileRejectsFutureBirthday(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupUserProfileHandlerDB(t)

	user := model.User{
		Phone:    "13800138003",
		Nickname: "旧昵称",
		UserType: 1,
		Status:   1,
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPut, "/api/v1/user/profile", bytes.NewReader([]byte(`{"birthday":"2999-05-20"}`)))
	c.Request.Header.Set("Content-Type", "application/json")
	c.Set("userId", user.ID)

	UpdateProfile(c)

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400, got %d", recorder.Code)
	}
}
