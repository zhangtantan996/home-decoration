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
	if err := db.AutoMigrate(&model.User{}, &model.Provider{}, &model.MaterialShop{}, &model.ProviderCase{}); err != nil {
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

func TestEvaluateProviderPublicVisibilityBlocksDisabledAccount(t *testing.T) {
	setupPublicVisibilitySchema(t)

	user := model.User{Phone: "18800000001", Status: 0}
	if err := repository.DB.Create(&user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}
	if err := repository.DB.Model(&user).Update("status", 0).Error; err != nil {
		t.Fatalf("disable user: %v", err)
	}

	result := EvaluateProviderPublicVisibility(&model.Provider{
		UserID:                 user.ID,
		Verified:               true,
		Status:                 1,
		IsSettled:              true,
		PlatformDisplayEnabled: true,
		MerchantDisplayEnabled: true,
	})
	if result.PublicVisible {
		t.Fatalf("expected disabled account provider hidden")
	}
	if !hasBlockerCode(result.Blockers, "account_disabled") {
		t.Fatalf("expected account_disabled blocker, got %+v", result.Blockers)
	}
	if result.DistributionStatus != visibilityDistributionBlockedOperating {
		t.Fatalf("expected blocked_by_operating distribution, got %+v", result)
	}
	if result.PrimaryBlockerCode != "account_disabled" {
		t.Fatalf("expected account_disabled primary blocker, got %+v", result)
	}
}

func TestApplyPublicProviderFilterExcludesDisabledAccount(t *testing.T) {
	setupPublicVisibilitySchema(t)

	activeUser := model.User{Phone: "18800000011", Status: 1}
	disabledUser := model.User{Phone: "18800000012", Status: 1}
	if err := repository.DB.Create(&activeUser).Error; err != nil {
		t.Fatalf("create active user: %v", err)
	}
	if err := repository.DB.Create(&disabledUser).Error; err != nil {
		t.Fatalf("create disabled user: %v", err)
	}
	if err := repository.DB.Model(&disabledUser).Update("status", 0).Error; err != nil {
		t.Fatalf("disable user: %v", err)
	}

	providers := []model.Provider{
		{UserID: activeUser.ID, Verified: true, Status: 1, IsSettled: true, PlatformDisplayEnabled: true, MerchantDisplayEnabled: true},
		{UserID: disabledUser.ID, Verified: true, Status: 1, IsSettled: true, PlatformDisplayEnabled: true, MerchantDisplayEnabled: true},
	}
	if err := repository.DB.Create(&providers).Error; err != nil {
		t.Fatalf("create providers: %v", err)
	}

	var visible []model.Provider
	if err := ApplyPublicProviderFilter(repository.DB.Model(&model.Provider{})).Find(&visible).Error; err != nil {
		t.Fatalf("apply provider filter: %v", err)
	}
	if len(visible) != 1 || visible[0].UserID != activeUser.ID {
		t.Fatalf("expected only active account provider visible, got %+v", visible)
	}
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
	if merchantHidden.DistributionStatus != visibilityDistributionHiddenByMerchant {
		t.Fatalf("expected hidden_by_merchant distribution, got %+v", merchantHidden)
	}
	if merchantHidden.PrimaryBlockerCode != "merchant_hidden" {
		t.Fatalf("expected primary blocker merchant_hidden, got %+v", merchantHidden)
	}
}

func TestEvaluateProviderPublicVisibilityOperatingOverridesPlatformHide(t *testing.T) {
	setupPublicVisibilitySchema(t)

	hidden := EvaluateProviderPublicVisibility(&model.Provider{
		Verified:               true,
		Status:                 0,
		IsSettled:              true,
		PlatformDisplayEnabled: false,
		MerchantDisplayEnabled: true,
	})
	if hidden.PublicVisible {
		t.Fatalf("expected hidden provider")
	}
	if hidden.DistributionStatus != visibilityDistributionBlockedOperating {
		t.Fatalf("expected blocked_by_operating distribution, got %+v", hidden)
	}
	if hidden.PrimaryBlockerCode != "provider_frozen" {
		t.Fatalf("expected provider_frozen as primary blocker, got %+v", hidden)
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

	unsettledLead := EvaluateMaterialShopPublicVisibility(&model.MaterialShop{
		IsVerified:             false,
		IsSettled:              false,
		Status:                 materialShopStatusPtr(1),
		PlatformDisplayEnabled: true,
		MerchantDisplayEnabled: true,
	}, 0)
	if !unsettledLead.PublicVisible || len(unsettledLead.Blockers) != 0 {
		t.Fatalf("expected unsettled material shop lead visible, got %+v", unsettledLead)
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

func TestEvaluateMaterialShopPublicVisibilityBlocksDisabledAccount(t *testing.T) {
	setupPublicVisibilitySchema(t)

	user := model.User{Phone: "18800000002", Status: 0}
	if err := repository.DB.Create(&user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}
	if err := repository.DB.Model(&user).Update("status", 0).Error; err != nil {
		t.Fatalf("disable user: %v", err)
	}

	result := EvaluateMaterialShopPublicVisibility(&model.MaterialShop{
		UserID:                 user.ID,
		IsVerified:             true,
		IsSettled:              true,
		Status:                 materialShopStatusPtr(1),
		PlatformDisplayEnabled: true,
		MerchantDisplayEnabled: true,
	}, 4)
	if result.PublicVisible {
		t.Fatalf("expected disabled account material shop hidden")
	}
	if !hasBlockerCode(result.Blockers, "account_disabled") {
		t.Fatalf("expected account_disabled blocker, got %+v", result.Blockers)
	}
	if result.DistributionStatus != visibilityDistributionBlockedOperating {
		t.Fatalf("expected blocked_by_operating distribution, got %+v", result)
	}
	if result.PrimaryBlockerCode != "account_disabled" {
		t.Fatalf("expected account_disabled primary blocker, got %+v", result)
	}
}

func TestApplyPublicMaterialShopFilterExcludesDisabledAccount(t *testing.T) {
	setupPublicVisibilitySchema(t)

	activeUser := model.User{Phone: "18800000021", Status: 1}
	disabledUser := model.User{Phone: "18800000022", Status: 1}
	if err := repository.DB.Create(&activeUser).Error; err != nil {
		t.Fatalf("create active user: %v", err)
	}
	if err := repository.DB.Create(&disabledUser).Error; err != nil {
		t.Fatalf("create disabled user: %v", err)
	}
	if err := repository.DB.Model(&disabledUser).Update("status", 0).Error; err != nil {
		t.Fatalf("disable user: %v", err)
	}

	activeStatus := int8(1)
	shops := []model.MaterialShop{
		{UserID: activeUser.ID, IsVerified: true, IsSettled: true, Status: &activeStatus, PlatformDisplayEnabled: true, MerchantDisplayEnabled: true},
		{UserID: disabledUser.ID, IsVerified: true, IsSettled: true, Status: &activeStatus, PlatformDisplayEnabled: true, MerchantDisplayEnabled: true},
	}
	if err := repository.DB.Create(&shops).Error; err != nil {
		t.Fatalf("create material shops: %v", err)
	}
	if err := repository.DB.Model(&model.MaterialShop{}).
		Where("id IN ?", []uint64{shops[0].ID, shops[1].ID}).
		Update("is_settled", false).Error; err != nil {
		t.Fatalf("mark material shop unsettled: %v", err)
	}
	var visible []model.MaterialShop
	if err := ApplyPublicMaterialShopFilter(repository.DB.Model(&model.MaterialShop{})).Find(&visible).Error; err != nil {
		t.Fatalf("apply material shop filter: %v", err)
	}
	if len(visible) != 1 || visible[0].UserID != activeUser.ID {
		t.Fatalf("expected only active account material shop visible, got %+v", visible)
	}
}

func TestApplyPublicMaterialShopFilterIncludesUnsettledLeads(t *testing.T) {
	setupPublicVisibilitySchema(t)

	activeStatus := int8(1)
	hiddenStatus := int8(0)
	shops := []model.MaterialShop{
		{IsVerified: false, IsSettled: false, Status: &activeStatus, PlatformDisplayEnabled: true, MerchantDisplayEnabled: true},
		{IsVerified: false, IsSettled: false, Status: &hiddenStatus, PlatformDisplayEnabled: true, MerchantDisplayEnabled: true},
		{IsVerified: false, IsSettled: true, Status: &activeStatus, PlatformDisplayEnabled: true, MerchantDisplayEnabled: true},
	}
	if err := repository.DB.Create(&shops).Error; err != nil {
		t.Fatalf("create material shops: %v", err)
	}
	if err := repository.DB.Model(&model.MaterialShop{}).
		Where("id IN ?", []uint64{shops[0].ID, shops[1].ID}).
		Update("is_settled", false).Error; err != nil {
		t.Fatalf("mark material shop unsettled: %v", err)
	}
	if err := repository.DB.Exec("UPDATE material_shops SET status = ? WHERE id = ?", 0, shops[1].ID).Error; err != nil {
		t.Fatalf("freeze material shop: %v", err)
	}

	var visible []model.MaterialShop
	if err := ApplyPublicMaterialShopFilter(repository.DB.Model(&model.MaterialShop{})).Order("id ASC").Find(&visible).Error; err != nil {
		t.Fatalf("apply material shop filter: %v", err)
	}
	if len(visible) != 1 || visible[0].IsSettled {
		t.Fatalf("expected only active unsettled material lead visible, got %+v", visible)
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
	if platformHidden.DistributionStatus != visibilityDistributionHiddenByPlatform {
		t.Fatalf("expected hidden_by_platform distribution, got %+v", platformHidden)
	}
	if platformHidden.PrimaryBlockerCode != "platform_hidden" {
		t.Fatalf("expected primary blocker platform_hidden, got %+v", platformHidden)
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
	if hidden.DistributionStatus != visibilityDistributionBlockedOperating {
		t.Fatalf("expected blocked_by_operating distribution, got %+v", hidden)
	}
	if hidden.PrimaryBlockerCode != "shop_frozen" {
		t.Fatalf("expected shop_frozen as primary blocker, got %+v", hidden)
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
