package service

import (
	"testing"
	"time"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"

	gormsqlite "gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupInspirationServiceDB(t *testing.T) *gorm.DB {
	t.Helper()

	db, err := gorm.Open(gormsqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite db: %v", err)
	}
	if err := db.AutoMigrate(
		&model.User{},
		&model.Provider{},
		&model.ProviderCase{},
		&model.UserLike{},
		&model.UserFavorite{},
		&model.CaseComment{},
	); err != nil {
		t.Fatalf("auto migrate inspiration tables: %v", err)
	}

	previousDB := repository.DB
	repository.DB = db
	t.Cleanup(func() {
		repository.DB = previousDB
	})

	return db
}

func seedInspirationCase(t *testing.T, db *gorm.DB, item model.ProviderCase) model.ProviderCase {
	t.Helper()
	if err := db.Create(&item).Error; err != nil {
		t.Fatalf("create inspiration case %q: %v", item.Title, err)
	}
	return item
}

func fullQualityCase(title string, createdAt time.Time) model.ProviderCase {
	return model.ProviderCase{
		Base:              model.Base{CreatedAt: createdAt},
		Title:             title,
		CoverImage:        "/uploads/cases/cover.jpg",
		Images:            `["/uploads/cases/1.jpg","/uploads/cases/2.jpg","/uploads/cases/3.jpg"]`,
		Style:             "现代简约",
		Layout:            "三居",
		Area:              "120㎡",
		Price:             200000,
		Description:       "这是一个完整的高质量灵感案例说明，用于验证排序质量分。",
		ShowInInspiration: true,
	}
}

func addFavoriteCount(t *testing.T, db *gorm.DB, caseID uint64, count int) {
	t.Helper()
	for idx := 0; idx < count; idx++ {
		if err := db.Create(&model.UserFavorite{UserID: uint64(idx + 1), TargetID: caseID, TargetType: "case"}).Error; err != nil {
			t.Fatalf("create favorite %d for case %d: %v", idx, caseID, err)
		}
	}
}

func addLikeCount(t *testing.T, db *gorm.DB, caseID uint64, count int) {
	t.Helper()
	for idx := 0; idx < count; idx++ {
		if err := db.Create(&model.UserLike{UserID: uint64(idx + 1), TargetID: caseID, TargetType: "case"}).Error; err != nil {
			t.Fatalf("create like %d for case %d: %v", idx, caseID, err)
		}
	}
}

func addCommentCount(t *testing.T, db *gorm.DB, caseID uint64, count int) {
	t.Helper()
	for idx := 0; idx < count; idx++ {
		if err := db.Create(&model.CaseComment{CaseID: caseID, UserID: uint64(idx + 1), Content: "喜欢这个案例"}).Error; err != nil {
			t.Fatalf("create comment %d for case %d: %v", idx, caseID, err)
		}
	}
}

func TestResolveInspirationAuthorNamePrefersUserNickname(t *testing.T) {
	provider := model.Provider{CompanyName: "华美装饰设计公司"}
	user := &model.User{Nickname: "燕归来"}

	got := resolveInspirationAuthorName(provider, user)
	if got != "燕归来" {
		t.Fatalf("expected nickname first, got %q", got)
	}
}

func TestResolveInspirationAuthorNameFallsBackToCompanyName(t *testing.T) {
	provider := model.Provider{CompanyName: "强设计工作室"}

	got := resolveInspirationAuthorName(provider, nil)
	if got != "强设计工作室" {
		t.Fatalf("expected company name fallback, got %q", got)
	}
}

func TestListInspirationRecommendHonorsManualSortOrder(t *testing.T) {
	db := setupInspirationServiceDB(t)
	svc := &InspirationService{}
	now := time.Now()

	newCase := seedInspirationCase(t, db, fullQualityCase("最新普通案例", now))
	recommended := fullQualityCase("平台推荐案例", now.Add(-72*time.Hour))
	recommended.SortOrder = 1
	recommended = seedInspirationCase(t, db, recommended)
	engaged := seedInspirationCase(t, db, fullQualityCase("互动较高案例", now.Add(-24*time.Hour)))
	addFavoriteCount(t, db, engaged.ID, 8)
	addLikeCount(t, db, engaged.ID, 12)
	hidden := fullQualityCase("隐藏案例", now.Add(24*time.Hour))
	hidden.ShowInInspiration = false
	hidden = seedInspirationCase(t, db, hidden)

	items, total, err := svc.ListInspiration(&InspirationQuery{Page: 1, PageSize: 10, Sort: "recommend"}, nil)
	if err != nil {
		t.Fatalf("list recommend inspirations: %v", err)
	}
	if total != 3 {
		t.Fatalf("expected total 3, got %d", total)
	}
	if len(items) < 3 {
		t.Fatalf("expected 3 items, got %+v", items)
	}
	if items[0].ID != recommended.ID {
		t.Fatalf("expected manual recommended case first, got first=%d recommended=%d new=%d", items[0].ID, recommended.ID, newCase.ID)
	}
	for _, item := range items {
		if item.ID == hidden.ID {
			t.Fatalf("expected hidden case to stay invisible, got %+v", items)
		}
	}
}

func TestListInspirationHotUsesWholeListEngagementBeforePagination(t *testing.T) {
	db := setupInspirationServiceDB(t)
	svc := &InspirationService{}
	now := time.Now()

	newCase := seedInspirationCase(t, db, fullQualityCase("最新无互动案例", now))
	hotOldCase := seedInspirationCase(t, db, fullQualityCase("高热度旧案例", now.Add(-30*24*time.Hour)))
	addFavoriteCount(t, db, hotOldCase.ID, 24)
	addCommentCount(t, db, hotOldCase.ID, 8)
	addLikeCount(t, db, hotOldCase.ID, 16)

	items, _, err := svc.ListInspiration(&InspirationQuery{Page: 1, PageSize: 1, Sort: "hot"}, nil)
	if err != nil {
		t.Fatalf("list hot inspirations: %v", err)
	}
	if len(items) != 1 {
		t.Fatalf("expected one page item, got %+v", items)
	}
	if items[0].ID != hotOldCase.ID {
		t.Fatalf("expected old high-engagement case first, got first=%d hot=%d new=%d", items[0].ID, hotOldCase.ID, newCase.ID)
	}
}

func TestListInspirationLatestUsesCreatedAtThenQuality(t *testing.T) {
	db := setupInspirationServiceDB(t)
	svc := &InspirationService{}
	now := time.Now()

	oldHighQuality := seedInspirationCase(t, db, fullQualityCase("旧高质量案例", now.Add(-24*time.Hour)))
	newLowQuality := seedInspirationCase(t, db, model.ProviderCase{
		Base:              model.Base{CreatedAt: now},
		Title:             "新低质量案例",
		ShowInInspiration: true,
	})

	items, _, err := svc.ListInspiration(&InspirationQuery{Page: 1, PageSize: 2, Sort: "latest"}, nil)
	if err != nil {
		t.Fatalf("list latest inspirations: %v", err)
	}
	if len(items) != 2 || items[0].ID != newLowQuality.ID || items[1].ID != oldHighQuality.ID {
		t.Fatalf("expected latest created case first, got %+v", items)
	}

	sameTimeHighQuality := seedInspirationCase(t, db, fullQualityCase("同时间高质量案例", now.Add(2*time.Hour)))
	sameTimeLowQuality := seedInspirationCase(t, db, model.ProviderCase{
		Base:              model.Base{CreatedAt: sameTimeHighQuality.CreatedAt},
		Title:             "同时间低质量案例",
		ShowInInspiration: true,
	})

	items, _, err = svc.ListInspiration(&InspirationQuery{Page: 1, PageSize: 2, Sort: "latest"}, nil)
	if err != nil {
		t.Fatalf("list latest inspirations with quality tie-breaker: %v", err)
	}
	if len(items) != 2 || items[0].ID != sameTimeHighQuality.ID || items[1].ID != sameTimeLowQuality.ID {
		t.Fatalf("expected same-time high quality case first, got %+v", items)
	}
}
