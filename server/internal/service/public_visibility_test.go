package service

import (
	"sync"
	"testing"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"

	gormsqlite "gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func materialShopStatusPtr(v int8) *int8 {
	return &v
}

func setupPublicVisibilitySchema(t *testing.T) {
	t.Helper()

	publicVisibilitySchemaCache = sync.Map{}

	db, err := gorm.Open(gormsqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite db: %v", err)
	}
	if err := db.AutoMigrate(&model.Provider{}, &model.MaterialShop{}, &model.ProviderCase{}); err != nil {
		t.Fatalf("auto migrate public visibility schema: %v", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		t.Fatalf("get sql db: %v", err)
	}

	previousDB := repository.DB
	repository.DB = db
	t.Cleanup(func() {
		repository.DB = previousDB
		publicVisibilitySchemaCache = sync.Map{}
		_ = sqlDB.Close()
	})
}

func TestEvaluateProviderPublicVisibility(t *testing.T) {
	setupPublicVisibilitySchema(t)

	visible := EvaluateProviderPublicVisibility(&model.Provider{Verified: true, Status: 1, IsSettled: true})
	if !visible.PublicVisible || len(visible.Blockers) != 0 {
		t.Fatalf("expected visible provider, got %+v", visible)
	}

	hidden := EvaluateProviderPublicVisibility(&model.Provider{Verified: false, Status: 0, IsSettled: true})
	if hidden.PublicVisible {
		t.Fatalf("expected hidden provider")
	}
	if !hasBlockerCode(hidden.Blockers, "provider_unverified") || !hasBlockerCode(hidden.Blockers, "provider_frozen") {
		t.Fatalf("expected provider blockers, got %+v", hidden.Blockers)
	}
}

func TestEvaluateMaterialShopPublicVisibility(t *testing.T) {
	setupPublicVisibilitySchema(t)

	visible := EvaluateMaterialShopPublicVisibility(&model.MaterialShop{IsVerified: true, IsSettled: true}, 0)
	if !visible.PublicVisible || len(visible.Blockers) != 0 {
		t.Fatalf("expected visible material shop, got %+v", visible)
	}

	hidden := EvaluateMaterialShopPublicVisibility(&model.MaterialShop{IsVerified: false, IsSettled: true}, 4)
	if hidden.PublicVisible {
		t.Fatalf("expected hidden material shop")
	}
	if !hasBlockerCode(hidden.Blockers, "shop_unverified") {
		t.Fatalf("expected material shop blockers, got %+v", hidden.Blockers)
	}
}

func TestEvaluateMaterialShopPublicVisibilityFrozen(t *testing.T) {
	setupPublicVisibilitySchema(t)

	hidden := EvaluateMaterialShopPublicVisibility(&model.MaterialShop{IsVerified: true, IsSettled: false, Status: materialShopStatusPtr(0)}, 2)
	if hidden.PublicVisible {
		t.Fatalf("expected frozen material shop hidden")
	}
	if !hasBlockerCode(hidden.Blockers, "shop_frozen") {
		t.Fatalf("expected shop_frozen blocker, got %+v", hidden.Blockers)
	}
}

func TestEvaluateCasePublicVisibility(t *testing.T) {
	setupPublicVisibilitySchema(t)

	visible := EvaluateCasePublicVisibility(&model.ProviderCase{ShowInInspiration: true})
	if !visible.PublicVisible || len(visible.Blockers) != 0 {
		t.Fatalf("expected visible case, got %+v", visible)
	}

	hidden := EvaluateCasePublicVisibility(&model.ProviderCase{ShowInInspiration: false})
	if hidden.PublicVisible {
		t.Fatalf("expected hidden case")
	}
	if !hasBlockerCode(hidden.Blockers, "case_hidden_from_inspiration") {
		t.Fatalf("expected case_hidden_from_inspiration blocker, got %+v", hidden.Blockers)
	}
}
