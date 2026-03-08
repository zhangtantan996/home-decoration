package handler

import (
	"encoding/json"
	"errors"
	"fmt"
	"home-decoration-server/internal/model"
	"strings"
	"time"

	"gorm.io/gorm"
)

const (
	merchantNextActionApply      = "APPLY"
	merchantNextActionPending    = "PENDING"
	merchantNextActionResubmit   = "RESUBMIT"
	merchantNextActionLogin      = "LOGIN"
	merchantNextActionReapply    = "REAPPLY"
	merchantIdentityTypeProvider = "provider"
	merchantIdentityTypeMaterial = "material_shop"
	merchantIdentityStatusActive = int8(1)
	merchantIdentityStatusFrozen = int8(3)
	merchantProviderStatusActive = int8(1)
	merchantProviderStatusFrozen = int8(0)
)

type merchantActiveIdentity struct {
	kind      string
	id        uint64
	createdAt time.Time
}

func resolveMerchantNextAction(status int8, hasApprovedIdentity bool) string {
	switch status {
	case 0:
		return merchantNextActionPending
	case 1:
		if hasApprovedIdentity {
			return merchantNextActionLogin
		}
		return merchantNextActionPending
	case 2:
		if hasApprovedIdentity {
			return merchantNextActionReapply
		}
		return merchantNextActionResubmit
	default:
		return merchantNextActionApply
	}
}

func findLatestActiveMerchantIdentity(tx *gorm.DB, userID uint64, excludeKind string, excludeID uint64) (*merchantActiveIdentity, error) {
	var latest *merchantActiveIdentity

	var provider model.Provider
	if err := tx.Where("user_id = ? AND status = ?", userID, merchantProviderStatusActive).Order("created_at DESC, id DESC").First(&provider).Error; err != nil {
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf("query active provider failed: %w", err)
		}
	} else if !(excludeKind == merchantIdentityTypeProvider && excludeID > 0 && provider.ID == excludeID) {
		latest = &merchantActiveIdentity{kind: merchantIdentityTypeProvider, id: provider.ID, createdAt: provider.CreatedAt}
	}

	var shop model.MaterialShop
	if err := tx.Where("user_id = ? AND is_verified = ?", userID, true).Order("created_at DESC, id DESC").First(&shop).Error; err != nil {
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf("query active material shop failed: %w", err)
		}
	} else if !(excludeKind == merchantIdentityTypeMaterial && excludeID > 0 && shop.ID == excludeID) {
		if latest == nil || shop.CreatedAt.After(latest.createdAt) {
			latest = &merchantActiveIdentity{kind: merchantIdentityTypeMaterial, id: shop.ID, createdAt: shop.CreatedAt}
		}
	}

	return latest, nil
}

func ensureMerchantIdentity(tx *gorm.DB, userID uint64, identityType string, refID uint64, adminID uint64, status int8) error {
	var identity model.UserIdentity
	now := time.Now()
	err := tx.Where("user_id = ? AND identity_type = ?", userID, identityType).Order("id DESC").First(&identity).Error
	if err != nil {
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return fmt.Errorf("load identity failed: %w", err)
		}
		identity = model.UserIdentity{
			UserID:        userID,
			IdentityType:  identityType,
			IdentityRefID: &refID,
			Status:        status,
			Verified:      status == merchantIdentityStatusActive,
		}
		if status == merchantIdentityStatusActive {
			identity.VerifiedAt = &now
			identity.VerifiedBy = &adminID
		}
		if err := tx.Create(&identity).Error; err != nil {
			return fmt.Errorf("create identity failed: %w", err)
		}
		return nil
	}

	identity.IdentityRefID = &refID
	identity.Status = status
	identity.Verified = status == merchantIdentityStatusActive
	if status == merchantIdentityStatusActive {
		identity.VerifiedAt = &now
		identity.VerifiedBy = &adminID
	} else {
		identity.Verified = false
	}
	if err := tx.Save(&identity).Error; err != nil {
		return fmt.Errorf("save identity failed: %w", err)
	}
	return nil
}

func freezeMerchantIdentity(tx *gorm.DB, userID uint64, identity *merchantActiveIdentity) error {
	if identity == nil || identity.id == 0 {
		return nil
	}

	switch identity.kind {
	case merchantIdentityTypeProvider:
		if err := tx.Model(&model.Provider{}).Where("id = ? AND user_id = ?", identity.id, userID).Updates(map[string]interface{}{"status": merchantProviderStatusFrozen, "verified": false}).Error; err != nil {
			return fmt.Errorf("freeze provider failed: %w", err)
		}
	case merchantIdentityTypeMaterial:
		if err := tx.Model(&model.MaterialShop{}).Where("id = ? AND user_id = ?", identity.id, userID).Updates(map[string]interface{}{"is_verified": false}).Error; err != nil {
			return fmt.Errorf("freeze material shop failed: %w", err)
		}
	default:
		return nil
	}

	if err := tx.Model(&model.UserIdentity{}).Where("user_id = ? AND identity_type = ?", userID, identity.kind).Updates(map[string]interface{}{"status": merchantIdentityStatusFrozen, "verified": false}).Error; err != nil {
		return fmt.Errorf("freeze user identity failed: %w", err)
	}
	return nil
}

func canSubmitProviderApplication(tx *gorm.DB, userID uint64) (bool, string, error) {
	var existingProvider model.Provider
	if err := tx.Where("user_id = ? AND status = ?", userID, merchantProviderStatusActive).Order("created_at DESC, id DESC").First(&existingProvider).Error; err == nil {
		return false, merchantNextActionLogin, nil
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return false, "", fmt.Errorf("query provider failed: %w", err)
	}

	var existingShop model.MaterialShop
	if err := tx.Where("user_id = ? AND is_verified = ?", userID, true).Order("created_at DESC, id DESC").First(&existingShop).Error; err == nil {
		return false, merchantNextActionReapply, nil
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return false, "", fmt.Errorf("query material shop failed: %w", err)
	}

	return true, "", nil
}

func canSubmitMaterialShopApplication(tx *gorm.DB, userID uint64) (bool, string, error) {
	var existingProvider model.Provider
	if err := tx.Where("user_id = ? AND status = ?", userID, merchantProviderStatusActive).Order("created_at DESC, id DESC").First(&existingProvider).Error; err == nil {
		return false, merchantNextActionReapply, nil
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return false, "", fmt.Errorf("query provider failed: %w", err)
	}

	var existingShop model.MaterialShop
	if err := tx.Where("user_id = ? AND is_verified = ?", userID, true).Order("created_at DESC, id DESC").First(&existingShop).Error; err == nil {
		return false, merchantNextActionLogin, nil
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return false, "", fmt.Errorf("query material shop failed: %w", err)
	}

	return true, "", nil
}

func parseLegalAcceptanceJSON(raw string) map[string]interface{} {
	result := map[string]interface{}{}
	if strings.TrimSpace(raw) == "" {
		return result
	}
	_ = json.Unmarshal([]byte(raw), &result)
	return result
}
