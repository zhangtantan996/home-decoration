package service

import (
	"errors"
	"testing"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"

	gormsqlite "gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupDictionaryServiceTestDB(t *testing.T) (*gorm.DB, *DictionaryService) {
	t.Helper()

	db, err := gorm.Open(gormsqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite db: %v", err)
	}
	if err := db.AutoMigrate(&model.DictionaryCategory{}, &model.SystemDictionary{}); err != nil {
		t.Fatalf("migrate sqlite db: %v", err)
	}

	prevDB := repository.DB
	repository.DB = db
	t.Cleanup(func() { repository.DB = prevDB })

	repo := repository.NewDictionaryRepository(db)
	return db, NewDictionaryService(repo, nil)
}

func TestDictionaryServiceCreateDictRejectsOpenServiceCategory(t *testing.T) {
	db, svc := setupDictionaryServiceTestDB(t)
	if err := db.Create(&model.DictionaryCategory{Code: openServiceCitiesCategory, Name: "开放服务城市", Enabled: true}).Error; err != nil {
		t.Fatalf("seed category: %v", err)
	}

	_, err := svc.CreateDict(&model.CreateDictRequest{
		CategoryCode: openServiceCitiesCategory,
		Value:        "610100",
		Label:        "西安市",
	})
	if !errors.Is(err, ErrDictionaryCategoryReadOnly) {
		t.Fatalf("expected readonly error, got %v", err)
	}
}

func TestDictionaryServiceUpdateAndDeleteRejectOpenServiceCategory(t *testing.T) {
	db, svc := setupDictionaryServiceTestDB(t)
	if err := db.Create(&model.DictionaryCategory{Code: openServiceCitiesCategory, Name: "开放服务城市", Enabled: true}).Error; err != nil {
		t.Fatalf("seed category: %v", err)
	}
	dict := model.SystemDictionary{
		CategoryCode: openServiceCitiesCategory,
		Value:        "610100",
		Label:        "西安市",
		Enabled:      true,
	}
	if err := db.Create(&dict).Error; err != nil {
		t.Fatalf("seed dict: %v", err)
	}

	_, err := svc.UpdateDict(dict.ID, &model.UpdateDictRequest{
		CategoryCode: openServiceCitiesCategory,
		Value:        "610100",
		Label:        "西安",
		Enabled:      true,
	})
	if !errors.Is(err, ErrDictionaryCategoryReadOnly) {
		t.Fatalf("expected update readonly error, got %v", err)
	}

	err = svc.DeleteDict(dict.ID)
	if !errors.Is(err, ErrDictionaryCategoryReadOnly) {
		t.Fatalf("expected delete readonly error, got %v", err)
	}
}
