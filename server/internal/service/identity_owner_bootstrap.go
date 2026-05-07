package service

import (
	"errors"
	"strings"
	"time"

	"home-decoration-server/internal/model"

	"gorm.io/gorm"
)

// ensureOwnerIdentityRecord 确保用户存在 owner 身份（统一身份中心最小兜底）
func ensureOwnerIdentityRecord(tx *gorm.DB, userID uint64) error {
	if tx == nil || userID == 0 {
		return nil
	}

	var identity model.UserIdentity
	err := tx.Where("user_id = ? AND identity_type = ?", userID, "owner").
		Order("id ASC").
		First(&identity).Error
	if err == nil {
		if identity.Status == 1 && identity.Verified {
			return nil
		}
		now := time.Now()
		updates := map[string]interface{}{
			"status":      1,
			"verified":    true,
			"verified_at": &now,
		}
		if updateErr := tx.Model(&model.UserIdentity{}).Where("id = ?", identity.ID).Updates(updates).Error; updateErr != nil {
			if isMissingTableError(updateErr) {
				return nil
			}
			return updateErr
		}
		return nil
	}
	if isMissingTableError(err) {
		return nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}

	now := time.Now()
	record := model.UserIdentity{
		UserID:       userID,
		IdentityType: "owner",
		Status:       1,
		Verified:     true,
		VerifiedAt:   &now,
	}
	if createErr := tx.Create(&record).Error; createErr != nil {
		if isMissingTableError(createErr) || isDuplicateConstraintError(createErr) {
			return nil
		}
		return createErr
	}

	return nil
}

func isDuplicateConstraintError(err error) bool {
	if err == nil {
		return false
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "duplicate key") ||
		strings.Contains(msg, "unique constraint") ||
		strings.Contains(msg, "constraint failed")
}
