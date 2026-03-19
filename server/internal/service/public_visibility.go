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
	if !supportsProviderSettlementVisibility() {
		return provider.Verified && provider.Status == 1
	}
	if !providerSettlementValue(provider) {
		return provider.Status == 1 // 未入驻：只要未封禁就可见
	}
	return provider.Verified && provider.Status == 1
}

func applyVisibleProviderFilter(db *gorm.DB) *gorm.DB {
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
	return shop.IsVerified && IsMaterialShopActive(shop)
}

func IsMaterialShopPublicVisible(shop *model.MaterialShop, activeProductCount int64) bool {
	if shop == nil {
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
	if !supportsCaseInspirationVisibility() {
		return true
	}
	return providerCase.ShowInInspiration
}

func applyVisibleCaseFilter(db *gorm.DB) *gorm.DB {
	if !supportsCaseInspirationVisibility() {
		return db
	}
	return db.Where("show_in_inspiration = ?", true)
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

func supportsMaterialShopSettlementVisibility() bool {
	return cachedHasColumn("material_shops.is_settled", &model.MaterialShop{}, "is_settled")
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

func materialShopSettlementValue(shop *model.MaterialShop) bool {
	if shop == nil {
		return false
	}
	if !supportsMaterialShopSettlementVisibility() {
		return true
	}
	return shop.IsSettled
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
