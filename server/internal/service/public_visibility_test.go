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

	visible := EvaluateProviderPublicVisibility(&model.Provider{
		Verified:               true,
		Status:                 1,
		IsSettled:              true,
		PlatformDisplayEnabled: true,
		MerchantDisplayEnabled: true,
	})
	if !visible.PublicVisible || len(visible.Blockers) != 0 {
		t.Fatalf("expected visible provider, got %+v", visible)
	}

	hidden := EvaluateProviderPublicVisibility(&model.Provider{
		Verified:               false,
		Status:                 0,
		IsSettled:              true,
		PlatformDisplayEnabled: true,
		MerchantDisplayEnabled: true,
	})
	if hidden.PublicVisible {
		t.Fatalf("expected hidden provider")
	}
	if !hasBlockerCode(hidden.Blockers, "provider_unverified") || !hasBlockerCode(hidden.Blockers, "provider_frozen") {
		t.Fatalf("expected provider blockers, got %+v", hidden.Blockers)
	}
}

func TestEvaluateProviderPublicVisibilityAddsDisplayBlockers(t *testing.T) {
	setupPublicVisibilitySchema(t)

	platformHidden := EvaluateProviderPublicVisibility(&model.Provider{
		Verified:               true,
		Status:                 1,
		IsSettled:              true,
		PlatformDisplayEnabled: false,
		MerchantDisplayEnabled: true,
	})
	if platformHidden.PublicVisible {
		t.Fatalf("expected provider hidden when platform display disabled")
	}
	if !hasBlockerCode(platformHidden.Blockers, "platform_hidden") {
		t.Fatalf("expected platform_hidden blocker, got %+v", platformHidden.Blockers)
	}

	merchantHidden := EvaluateProviderPublicVisibility(&model.Provider{
		Verified:               true,
		Status:                 1,
		IsSettled:              true,
		PlatformDisplayEnabled: true,
		MerchantDisplayEnabled: false,
	})
	if merchantHidden.PublicVisible {
		t.Fatalf("expected provider hidden when merchant display disabled")
	}
	if !hasBlockerCode(merchantHidden.Blockers, "merchant_hidden") {
		t.Fatalf("expected merchant_hidden blocker, got %+v", merchantHidden.Blockers)
	}
}

func TestEvaluateMaterialShopPublicVisibility(t *testing.T) {
	setupPublicVisibilitySchema(t)

	visible := EvaluateMaterialShopPublicVisibility(&model.MaterialShop{
		IsVerified:             true,
		IsSettled:              true,
		PlatformDisplayEnabled: true,
		MerchantDisplayEnabled: true,
	}, 0)
	if !visible.PublicVisible || len(visible.Blockers) != 0 {
		t.Fatalf("expected visible material shop, got %+v", visible)
	}

	hidden := EvaluateMaterialShopPublicVisibility(&model.MaterialShop{
		IsVerified:             false,
		IsSettled:              true,
		PlatformDisplayEnabled: true,
		MerchantDisplayEnabled: true,
	}, 4)
	if hidden.PublicVisible {
		t.Fatalf("expected hidden material shop")
	}
	if !hasBlockerCode(hidden.Blockers, "shop_unverified") {
		t.Fatalf("expected material shop blockers, got %+v", hidden.Blockers)
	}
}

func TestEvaluateMaterialShopPublicVisibilityAddsDisplayBlockers(t *testing.T) {
	setupPublicVisibilitySchema(t)

	platformHidden := EvaluateMaterialShopPublicVisibility(&model.MaterialShop{
		IsVerified:             true,
		IsSettled:              true,
		PlatformDisplayEnabled: false,
		MerchantDisplayEnabled: true,
	}, 4)
	if platformHidden.PublicVisible {
		t.Fatalf("expected material shop hidden when platform display disabled")
	}
	if !hasBlockerCode(platformHidden.Blockers, "platform_hidden") {
		t.Fatalf("expected platform_hidden blocker, got %+v", platformHidden.Blockers)
	}

	merchantHidden := EvaluateMaterialShopPublicVisibility(&model.MaterialShop{
		IsVerified:             true,
		IsSettled:              true,
		PlatformDisplayEnabled: true,
		MerchantDisplayEnabled: false,
	}, 4)
	if merchantHidden.PublicVisible {
		t.Fatalf("expected material shop hidden when merchant display disabled")
	}
	if !hasBlockerCode(merchantHidden.Blockers, "merchant_hidden") {
		t.Fatalf("expected merchant_hidden blocker, got %+v", merchantHidden.Blockers)
	}
}

func TestEvaluateMaterialShopPublicVisibilityFrozen(t *testing.T) {
	setupPublicVisibilitySchema(t)

	hidden := EvaluateMaterialShopPublicVisibility(&model.MaterialShop{
		IsVerified:             true,
		IsSettled:              false,
		Status:                 materialShopStatusPtr(0),
		PlatformDisplayEnabled: true,
		MerchantDisplayEnabled: true,
	}, 2)
	if hidden.PublicVisible {
		t.Fatalf("expected frozen material shop hidden")
	}
	if !hasBlockerCode(hidden.Blockers, "shop_frozen") {
		t.Fatalf("expected shop_frozen blocker, got %+v", hidden.Blockers)
	}
}

func TestEvaluateCasePublicVisibility(t *testing.T) {
	setupPublicVisibilitySchema(t)

	visible := EvaluateCasePublicVisibility(&model.ProviderCase{ProviderID: 0, ShowInInspiration: true})
	if !visible.PublicVisible || len(visible.Blockers) != 0 {
		t.Fatalf("expected visible case, got %+v", visible)
	}

	provider := model.Provider{Verified: true, Status: 1, IsSettled: true}
	if err := repository.DB.Create(&provider).Error; err != nil {
		t.Fatalf("create provider: %v", err)
	}

	visible = EvaluateCasePublicVisibility(&model.ProviderCase{ProviderID: provider.ID, ShowInInspiration: true})
	if !visible.PublicVisible || len(visible.Blockers) != 0 {
		t.Fatalf("expected visible provider case, got %+v", visible)
	}

	hidden := EvaluateCasePublicVisibility(&model.ProviderCase{ProviderID: 99, ShowInInspiration: true})
	if hidden.PublicVisible {
		t.Fatalf("expected unknown provider case hidden from inspiration")
	}
	if !hasBlockerCode(hidden.Blockers, "case_hidden_from_inspiration") {
		t.Fatalf("expected case_hidden_from_inspiration blocker, got %+v", hidden.Blockers)
	}

	hidden = EvaluateCasePublicVisibility(&model.ProviderCase{ProviderID: 0, ShowInInspiration: false})
	if hidden.PublicVisible {
		t.Fatalf("expected hidden case")
	}
	if !hasBlockerCode(hidden.Blockers, "case_hidden_from_inspiration") {
		t.Fatalf("expected case_hidden_from_inspiration blocker, got %+v", hidden.Blockers)
	}
}

func TestApplyVisibleInspirationCaseFilterRespectsProviderDisplaySwitches(t *testing.T) {
	setupPublicVisibilitySchema(t)

	visibleProvider := model.Provider{
		Verified:               true,
		Status:                 1,
		IsSettled:              true,
		PlatformDisplayEnabled: true,
		MerchantDisplayEnabled: true,
	}
	if err := repository.DB.Create(&visibleProvider).Error; err != nil {
		t.Fatalf("create visible provider: %v", err)
	}

	hiddenProvider := model.Provider{
		Verified:               true,
		Status:                 1,
		IsSettled:              true,
		PlatformDisplayEnabled: true,
		MerchantDisplayEnabled: true,
	}
	if err := repository.DB.Create(&hiddenProvider).Error; err != nil {
		t.Fatalf("create hidden provider: %v", err)
	}
	if err := repository.DB.Model(&model.Provider{}).Where("id = ?", hiddenProvider.ID).Update("merchant_display_enabled", false).Error; err != nil {
		t.Fatalf("hide provider: %v", err)
	}

	cases := []model.ProviderCase{
		{ProviderID: 0, Title: "灵感公海案例", ShowInInspiration: true},
		{ProviderID: visibleProvider.ID, Title: "公开服务商案例", ShowInInspiration: true},
		{ProviderID: hiddenProvider.ID, Title: "已下线服务商案例", ShowInInspiration: true},
	}
	if err := repository.DB.Create(&cases).Error; err != nil {
		t.Fatalf("create provider cases: %v", err)
	}

	var got []model.ProviderCase
	if err := applyVisibleInspirationCaseFilter(repository.DB.Model(&model.ProviderCase{})).
		Order("provider_cases.id ASC").
		Find(&got).Error; err != nil {
		t.Fatalf("query visible inspiration cases: %v", err)
	}

	if len(got) != 2 {
		t.Fatalf("expected 2 visible inspiration cases, got %d", len(got))
	}
	for _, item := range got {
		if item.ProviderID == hiddenProvider.ID {
			t.Fatalf("expected hidden provider case to be filtered out")
		}
	}
}
