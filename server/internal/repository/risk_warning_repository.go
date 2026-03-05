package repository

import (
	"errors"

	"home-decoration-server/internal/model"
)

// RiskWarningRepository provides persistence operations for risk warnings.
type RiskWarningRepository struct{}

func NewRiskWarningRepository() *RiskWarningRepository {
	return &RiskWarningRepository{}
}

func (r *RiskWarningRepository) Create(warning *model.RiskWarning) error {
	if warning == nil {
		return errors.New("warning is nil")
	}
	return DB.Create(warning).Error
}
