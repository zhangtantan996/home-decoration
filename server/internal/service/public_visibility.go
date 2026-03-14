package service

import (
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"

	"gorm.io/gorm"
)

func IsProviderPublicVisible(provider *model.Provider) bool {
	return provider != nil && provider.Verified && provider.Status == 1
}

func applyVisibleProviderFilter(db *gorm.DB) *gorm.DB {
	return db.Where("providers.verified = ? AND providers.status = ?", true, 1)
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

func IsMaterialShopPublicVisible(shop *model.MaterialShop, activeProductCount int64) bool {
	return shop != nil && shop.IsVerified
}

func applyVisibleMaterialShopFilter(db *gorm.DB) *gorm.DB {
	return db.Where("is_verified = ?", true)
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
	if !shop.IsVerified {
		result = addPublicVisibilityBlocker(result, "shop_unverified", "主材商未完成认证，公开列表不可见")
	}
	return result
}

func IsCasePublicVisible(providerCase *model.ProviderCase) bool {
	return providerCase != nil && providerCase.ShowInInspiration
}

func applyVisibleCaseFilter(db *gorm.DB) *gorm.DB {
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
