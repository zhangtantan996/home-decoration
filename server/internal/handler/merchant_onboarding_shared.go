package handler

import (
	"encoding/json"
	"errors"
	"fmt"
	"home-decoration-server/internal/config"
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/service"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"gorm.io/gorm"
)

const (
	merchantNextActionApply          = "APPLY"
	merchantNextActionPending        = "PENDING"
	merchantNextActionResubmit       = "RESUBMIT"
	merchantNextActionLogin          = "LOGIN"
	merchantNextActionReapply        = "REAPPLY"
	merchantIdentityTypeProvider     = "provider"
	merchantIdentityTypeMaterial     = "material_shop"
	merchantIdentityStatusActive     = int8(1)
	merchantIdentityStatusFrozen     = int8(3)
	merchantProviderStatusActive     = int8(1)
	merchantProviderStatusFrozen     = int8(0)
	merchantVerificationTokenPurpose = "merchant_phone_verification"
	merchantVerificationModeApply    = "apply"
	merchantVerificationModeResubmit = "resubmit"
	merchantResubmitTokenPurpose     = "merchant_resubmit"
)

type resubmitDetailRequestInput struct {
	Phone string `json:"phone" binding:"required"`
	Code  string `json:"code" binding:"required"`
}

type onboardingVerifyPhoneInput struct {
	Phone         string `json:"phone" binding:"required"`
	Code          string `json:"code" binding:"required"`
	MerchantKind  string `json:"merchantKind" binding:"required"`
	Mode          string `json:"mode" binding:"required"`
	ApplicationID uint64 `json:"applicationId"`
	AllowReapply  bool   `json:"allowReapply"`
}

func issueVerificationToken(mode, kind string, applicationID uint64, phone string, ttl time.Duration, allowReapply bool) (string, error) {
	claims := jwt.MapClaims{
		"application_id": applicationID,
		"allow_reapply":  allowReapply,
		"phone":          strings.TrimSpace(phone),
		"merchant_kind":  strings.TrimSpace(kind),
		"purpose":        merchantVerificationTokenPurpose,
		"mode":           strings.TrimSpace(mode),
		"exp":            time.Now().Add(ttl).Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(config.GetConfig().JWT.Secret))
}

func issueResubmitToken(kind string, applicationID uint64, phone string) (string, error) {
	return issueVerificationToken(merchantVerificationModeResubmit, kind, applicationID, phone, 30*time.Minute, false)
}

func parseVerificationTokenClaims(mode, kind string, applicationID uint64, phone, tokenString string) (jwt.MapClaims, error) {
	tokenString = strings.TrimSpace(tokenString)
	if tokenString == "" {
		return nil, fmt.Errorf("缺少重提授权凭证")
	}

	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		if token.Method != jwt.SigningMethodHS256 {
			return nil, fmt.Errorf("重提授权凭证签名方式无效")
		}
		return []byte(config.GetConfig().JWT.Secret), nil
	})
	if err != nil || !token.Valid {
		return nil, fmt.Errorf("重提授权凭证无效或已过期")
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return nil, fmt.Errorf("重提授权凭证无效")
	}
	purpose, _ := claims["purpose"].(string)
	if strings.TrimSpace(purpose) != merchantVerificationTokenPurpose {
		return nil, fmt.Errorf("重提授权凭证用途无效")
	}
	modeValue, _ := claims["mode"].(string)
	if strings.TrimSpace(modeValue) != strings.TrimSpace(mode) {
		return nil, fmt.Errorf("手机号验证凭证模式不匹配")
	}
	merchantKind, _ := claims["merchant_kind"].(string)
	if strings.TrimSpace(merchantKind) != strings.TrimSpace(kind) {
		return nil, fmt.Errorf("重提授权凭证商家类型不匹配")
	}
	tokenPhone, _ := claims["phone"].(string)
	if strings.TrimSpace(tokenPhone) != strings.TrimSpace(phone) {
		return nil, fmt.Errorf("重提授权凭证手机号不匹配")
	}
	applicationIDValue, ok := claims["application_id"].(float64)
	if !ok || uint64(applicationIDValue) != applicationID {
		return nil, fmt.Errorf("重提授权凭证申请编号不匹配")
	}

	return claims, nil
}

func verifyVerificationToken(mode, kind string, applicationID uint64, phone, tokenString string) error {
	_, err := parseVerificationTokenClaims(mode, kind, applicationID, phone, tokenString)
	return err
}

func verificationTokenAllowsReapply(mode, kind string, applicationID uint64, phone, tokenString string) bool {
	claims, err := parseVerificationTokenClaims(mode, kind, applicationID, phone, tokenString)
	if err != nil {
		return false
	}
	allowed, _ := claims["allow_reapply"].(bool)
	return allowed
}

func authorizeOnboarding(phone, verificationToken string, applicationID uint64, kind, mode, code string) error {
	if strings.TrimSpace(verificationToken) != "" {
		return verifyVerificationToken(mode, kind, applicationID, phone, verificationToken)
	}
	if strings.TrimSpace(code) == "" {
		if mode == merchantVerificationModeResubmit {
			return fmt.Errorf("缺少重提授权信息")
		}
		return fmt.Errorf("缺少手机号验证信息")
	}
	return service.VerifySMSCode(strings.TrimSpace(phone), service.SMSPurposeIdentityApply, strings.TrimSpace(code))
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}

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
