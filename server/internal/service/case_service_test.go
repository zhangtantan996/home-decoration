package service

import (
	"testing"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"

	gormsqlite "gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupCaseServiceDB(t *testing.T) *gorm.DB {
	t.Helper()

	db, err := gorm.Open(gormsqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite db: %v", err)
	}
	if err := db.AutoMigrate(&model.ProviderCase{}); err != nil {
		t.Fatalf("auto migrate provider case: %v", err)
	}

	previousDB := repository.DB
	repository.DB = db
	t.Cleanup(func() {
		repository.DB = previousDB
	})

	return db
}

func TestCaseServiceBlocksHiddenCaseDetailAndQuote(t *testing.T) {
	db := setupCaseServiceDB(t)
	service := &CaseService{}

	visibleCase := model.ProviderCase{
		Title:             "公开案例",
		ShowInInspiration: true,
		QuoteCurrency:     "CNY",
		QuoteTotalCent:    188800,
		QuoteItems:        `[{"category":"基础施工","itemName":"地面找平","amountCent":188800}]`,
	}
	hiddenCase := model.ProviderCase{
		Title:             "隐藏案例",
		ShowInInspiration: false,
		QuoteCurrency:     "CNY",
		QuoteTotalCent:    99900,
		QuoteItems:        `[{"category":"硬装","itemName":"木作","amountCent":99900}]`,
	}
	if err := db.Create(&visibleCase).Error; err != nil {
		t.Fatalf("create visible case: %v", err)
	}
	if err := db.Create(&hiddenCase).Error; err != nil {
		t.Fatalf("create hidden case: %v", err)
	}

	detail, err := service.GetCaseDetail(visibleCase.ID)
	if err != nil || detail == nil || detail.Title != "公开案例" {
		t.Fatalf("expected visible case detail, got detail=%+v err=%v", detail, err)
	}
	if _, err := service.GetCaseDetail(hiddenCase.ID); err == nil {
		t.Fatalf("expected hidden case detail to be blocked")
	}

	quote, err := service.GetCaseQuote(visibleCase.ID)
	if err != nil || quote == nil || quote.TotalCent != 188800 {
		t.Fatalf("expected visible case quote, got quote=%+v err=%v", quote, err)
	}
	if _, err := service.GetCaseQuote(hiddenCase.ID); err == nil {
		t.Fatalf("expected hidden case quote to be blocked")
	}
}
