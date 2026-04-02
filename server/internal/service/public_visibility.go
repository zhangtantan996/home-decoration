package service

import (
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	"sync"

	"gorm.io/gorm"
)

var publicVisibilitySchemaCache sync.Map

func IsProviderPublicVisible(provider *model.Provider) bool {
	if provider == nil {
		return false
	}
	if !providerPlatformDisplayEnabled(provider) || !providerMerchantDisplayEnabled(provider) {
		return false
	}
	if !supportsProviderSettlementVisibility() {
		return provider.Verified && provider.Status == 1
	}
	if !providerSettlementValue(provider) {
		return provider.Status == 1 // 未入驻：只要未封禁就可见
	}
	return provider.Verified && provider.Status == 1
}

func applyVisibleProviderFilter(db *gorm.DB) *gorm.DB {
	if supportsProviderPlatformDisplayEnabled() {
		db = db.Where("providers.platform_display_enabled = ?", true)
	}
	if supportsProviderMerchantDisplayEnabled() {
		db = db.Where("providers.merchant_display_enabled = ?", true)
	}
	if !supportsProviderSettlementVisibility() {
		return db.Where("providers.verified = ? AND providers.status = ?", true, 1)
	}
	return db.Where(
		"(providers.is_settled = false AND providers.status = ?) OR (providers.is_settled = true AND providers.verified = ? AND providers.status = ?)",
		1, true, 1,
	)
}

func ApplyPublicProviderFilter(db *gorm.DB) *gorm.DB {
	return applyVisibleProviderFilter(db)
}

func EvaluateProviderPublicVisibility(provider *model.Provider) VisibilityData {
	result := VisibilityData{
		PublicVisible: IsProviderPublicVisible(provider),
		Blockers:      make([]VisibilityBlocker, 0),
	}
	if result.PublicVisible {
		return result
	}
	if provider == nil {
		return addPublicVisibilityBlocker(result, "entity_not_created", "尚未生成服务商实体")
	}
	if !providerPlatformDisplayEnabled(provider) {
		result = addPublicVisibilityBlocker(result, "platform_hidden", "平台已下线该服务商")
	}
	if !providerMerchantDisplayEnabled(provider) {
		result = addPublicVisibilityBlocker(result, "merchant_hidden", "商家已手动下线")
	}
	if !supportsProviderSettlementVisibility() {
		if !provider.Verified {
			result = addPublicVisibilityBlocker(result, "provider_unverified", "服务商未实名通过，公开列表不可见")
		}
		if provider.Status != 1 {
			result = addPublicVisibilityBlocker(result, "provider_frozen", "服务商状态异常（冻结/停用），公开列表不可见")
		}
		return result
	}
	if !providerSettlementValue(provider) {
		// 未入驻商家仅检查 status
		if provider.Status != 1 {
			result = addPublicVisibilityBlocker(result, "provider_frozen", "服务商状态异常（冻结/停用），公开列表不可见")
		}
		return result
	}
	if !provider.Verified {
		result = addPublicVisibilityBlocker(result, "provider_unverified", "服务商未实名通过，公开列表不可见")
	}
	if provider.Status != 1 {
		result = addPublicVisibilityBlocker(result, "provider_frozen", "服务商状态异常（冻结/停用），公开列表不可见")
	}
	return result
}

func CountActiveMaterialShopProducts(shopID uint64) (int64, error) {
	var count int64
	err := repository.DB.Model(&model.MaterialShopProduct{}).
		Where("shop_id = ? AND status = ?", shopID, 1).
		Count(&count).Error
	return count, err
}

func MaterialShopStatusValue(shop *model.MaterialShop) int8 {
	if shop == nil || shop.Status == nil {
		return 1
	}
	return *shop.Status
}

func materialShopStatusEnabled(shop *model.MaterialShop) bool {
	return (shop != nil && shop.Status != nil) || supportsMaterialShopStatus()
}

func IsMaterialShopActive(shop *model.MaterialShop) bool {
	return MaterialShopStatusValue(shop) == 1
}

func IsMaterialShopLoginEnabled(shop *model.MaterialShop) bool {
	if shop == nil {
		return false
	}
	return IsMaterialShopActive(shop) && (shop.IsVerified || shop.NeedsOnboardingCompletion)
}

func IsMaterialShopPublicVisible(shop *model.MaterialShop, activeProductCount int64) bool {
	if shop == nil {
		return false
	}
	if !materialShopPlatformDisplayEnabled(shop) || !materialShopMerchantDisplayEnabled(shop) {
		return false
	}
	if materialShopStatusEnabled(shop) && !IsMaterialShopActive(shop) {
		return false
	}
	if !supportsMaterialShopSettlementVisibility() {
		return shop.IsVerified
	}
	if !materialShopSettlementValue(shop) {
		return true // 未入驻：平台收录商家直接可见
	}
	return shop.IsVerified
}

func applyVisibleMaterialShopFilter(db *gorm.DB) *gorm.DB {
	if supportsMaterialShopPlatformDisplayEnabled() {
		db = db.Where("material_shops.platform_display_enabled = ?", true)
	}
	if supportsMaterialShopMerchantDisplayEnabled() {
		db = db.Where("material_shops.merchant_display_enabled = ?", true)
	}
	if !supportsMaterialShopStatus() {
		if !supportsMaterialShopSettlementVisibility() {
			return db.Where("is_verified = ?", true)
		}
		return db.Where("(is_settled = false) OR (is_settled = true AND is_verified = ?)", true)
	}
	if !supportsMaterialShopSettlementVisibility() {
		return db.Where("is_verified = ? AND status = ?", true, 1)
	}
	return db.Where("(is_settled = false AND status = ?) OR (is_settled = true AND is_verified = ? AND status = ?)", 1, true, 1)
}

func ApplyPublicMaterialShopFilter(db *gorm.DB) *gorm.DB {
	return applyVisibleMaterialShopFilter(db)
}

func EvaluateMaterialShopPublicVisibility(shop *model.MaterialShop, activeProductCount int64) VisibilityData {
	result := VisibilityData{
		PublicVisible: IsMaterialShopPublicVisible(shop, activeProductCount),
		Blockers:      make([]VisibilityBlocker, 0),
	}
	if result.PublicVisible {
		return result
	}
	if shop == nil {
		return addPublicVisibilityBlocker(result, "entity_not_created", "尚未生成主材商实体")
	}
	if !materialShopPlatformDisplayEnabled(shop) {
		result = addPublicVisibilityBlocker(result, "platform_hidden", "平台已下线该主材商")
	}
	if !materialShopMerchantDisplayEnabled(shop) {
		result = addPublicVisibilityBlocker(result, "merchant_hidden", "商家已手动下线")
	}
	if materialShopStatusEnabled(shop) && !IsMaterialShopActive(shop) {
		result = addPublicVisibilityBlocker(result, "shop_frozen", "主材门店已被封禁，公开列表不可见")
	}
	if supportsMaterialShopSettlementVisibility() && materialShopSettlementValue(shop) && !shop.IsVerified {
		result = addPublicVisibilityBlocker(result, "shop_unverified", "主材商未完成认证，公开列表不可见")
	}
	if !supportsMaterialShopSettlementVisibility() && !shop.IsVerified {
		result = addPublicVisibilityBlocker(result, "shop_unverified", "主材商未完成认证，公开列表不可见")
	}
	return result
}

func IsCasePublicVisible(providerCase *model.ProviderCase) bool {
	if providerCase == nil {
		return false
	}
	return IsInspirationCasePublicVisible(providerCase)
}

func applyVisibleCaseFilter(db *gorm.DB) *gorm.DB {
	if !supportsCaseInspirationVisibility() {
		return db
	}
	return db.Where("show_in_inspiration = ?", true)
}

func IsInspirationCasePublicVisible(providerCase *model.ProviderCase) bool {
	if providerCase == nil {
		return false
	}
	if !supportsCaseInspirationVisibility() {
		return true
	}
	if !providerCase.ShowInInspiration {
		return false
	}
	if providerCase.ProviderID == 0 {
		return true
	}

	var provider model.Provider
	if err := repository.DB.First(&provider, providerCase.ProviderID).Error; err != nil {
		return false
	}
	return IsProviderPublicVisible(&provider)
}

func applyVisibleInspirationCaseFilter(db *gorm.DB) *gorm.DB {
	if !supportsCaseInspirationVisibility() {
		return db
	}
	filtered := db.Joins("LEFT JOIN providers ON providers.id = provider_cases.provider_id").
		Where("provider_cases.show_in_inspiration = ?", true)
	if supportsProviderPlatformDisplayEnabled() {
		filtered = filtered.Where("(provider_cases.provider_id = 0) OR (providers.platform_display_enabled = ?)", true)
	}
	if supportsProviderMerchantDisplayEnabled() {
		filtered = filtered.Where("(provider_cases.provider_id = 0) OR (providers.merchant_display_enabled = ?)", true)
	}
	if !supportsProviderSettlementVisibility() {
		return filtered.Where("(provider_cases.provider_id = 0) OR (providers.verified = ? AND providers.status = ?)", true, 1)
	}
	return filtered.Where(
		"(provider_cases.provider_id = 0) OR ((providers.is_settled = false AND providers.status = ?) OR (providers.is_settled = true AND providers.verified = ? AND providers.status = ?))",
		1, true, 1,
	)
}

func ApplyPublicCaseFilter(db *gorm.DB) *gorm.DB {
	return applyVisibleCaseFilter(db)
}

func EvaluateCasePublicVisibility(providerCase *model.ProviderCase) VisibilityData {
	result := VisibilityData{
		PublicVisible: IsCasePublicVisible(providerCase),
		Blockers:      make([]VisibilityBlocker, 0),
	}
	if result.PublicVisible {
		return result
	}
	return addPublicVisibilityBlocker(result, "case_hidden_from_inspiration", "原作品当前未在灵感库公开")
}

func addPublicVisibilityBlocker(result VisibilityData, code, message string) VisibilityData {
	result.Blockers = addBlocker(result.Blockers, code, message)
	return result
}

func supportsProviderSettlementVisibility() bool {
	return cachedHasColumn("providers.is_settled", &model.Provider{}, "is_settled")
}

func supportsProviderPlatformDisplayEnabled() bool {
	return cachedHasColumn("providers.platform_display_enabled", &model.Provider{}, "platform_display_enabled")
}

func supportsProviderMerchantDisplayEnabled() bool {
	return cachedHasColumn("providers.merchant_display_enabled", &model.Provider{}, "merchant_display_enabled")
}

func supportsMaterialShopSettlementVisibility() bool {
	return cachedHasColumn("material_shops.is_settled", &model.MaterialShop{}, "is_settled")
}

func supportsMaterialShopPlatformDisplayEnabled() bool {
	return cachedHasColumn("material_shops.platform_display_enabled", &model.MaterialShop{}, "platform_display_enabled")
}

func supportsMaterialShopMerchantDisplayEnabled() bool {
	return cachedHasColumn("material_shops.merchant_display_enabled", &model.MaterialShop{}, "merchant_display_enabled")
}

func supportsMaterialShopStatus() bool {
	return cachedHasColumn("material_shops.status", &model.MaterialShop{}, "status")
}

func supportsCaseInspirationVisibility() bool {
	return cachedHasColumn("provider_cases.show_in_inspiration", &model.ProviderCase{}, "show_in_inspiration")
}

func providerSettlementValue(provider *model.Provider) bool {
	if provider == nil {
		return false
	}
	if !supportsProviderSettlementVisibility() {
		return true
	}
	return provider.IsSettled
}

func providerPlatformDisplayEnabled(provider *model.Provider) bool {
	if provider == nil || !supportsProviderPlatformDisplayEnabled() {
		return true
	}
	return provider.PlatformDisplayEnabled
}

func providerMerchantDisplayEnabled(provider *model.Provider) bool {
	if provider == nil || !supportsProviderMerchantDisplayEnabled() {
		return true
	}
	return provider.MerchantDisplayEnabled
}

func ProviderPlatformDisplayEnabled(provider *model.Provider) bool {
	return providerPlatformDisplayEnabled(provider)
}

func ProviderMerchantDisplayEnabled(provider *model.Provider) bool {
	return providerMerchantDisplayEnabled(provider)
}

func SupportsProviderPlatformDisplayEnabled() bool {
	return supportsProviderPlatformDisplayEnabled()
}

func SupportsProviderMerchantDisplayEnabled() bool {
	return supportsProviderMerchantDisplayEnabled()
}

func materialShopSettlementValue(shop *model.MaterialShop) bool {
	if shop == nil {
		return false
	}
	if !supportsMaterialShopSettlementVisibility() {
		return true
	}
	return shop.IsSettled
}

func materialShopPlatformDisplayEnabled(shop *model.MaterialShop) bool {
	if shop == nil || !supportsMaterialShopPlatformDisplayEnabled() {
		return true
	}
	return shop.PlatformDisplayEnabled
}

func materialShopMerchantDisplayEnabled(shop *model.MaterialShop) bool {
	if shop == nil || !supportsMaterialShopMerchantDisplayEnabled() {
		return true
	}
	return shop.MerchantDisplayEnabled
}

func MaterialShopPlatformDisplayEnabled(shop *model.MaterialShop) bool {
	return materialShopPlatformDisplayEnabled(shop)
}

func MaterialShopMerchantDisplayEnabled(shop *model.MaterialShop) bool {
	return materialShopMerchantDisplayEnabled(shop)
}

func SupportsMaterialShopPlatformDisplayEnabled() bool {
	return supportsMaterialShopPlatformDisplayEnabled()
}

func SupportsMaterialShopMerchantDisplayEnabled() bool {
	return supportsMaterialShopMerchantDisplayEnabled()
}

func cachedHasColumn(cacheKey string, schema any, column string) bool {
	if cached, ok := publicVisibilitySchemaCache.Load(cacheKey); ok {
		return cached.(bool)
	}
	if repository.DB == nil {
		return false
	}
	hasColumn := repository.DB.Migrator().HasColumn(schema, column)
	publicVisibilitySchemaCache.Store(cacheKey, hasColumn)
	return hasColumn
}
