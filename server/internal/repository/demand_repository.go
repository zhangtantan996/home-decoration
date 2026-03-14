package repository

import (
	"errors"

	"home-decoration-server/internal/model"

	"gorm.io/gorm"
)

type DemandRepository struct {
	db *gorm.DB
}

func NewDemandRepository() *DemandRepository {
	return &DemandRepository{db: DB}
}

func (r *DemandRepository) withDB(tx *gorm.DB) *gorm.DB {
	if tx != nil {
		return tx
	}
	if r.db == nil {
		return DB
	}
	return r.db
}

func (r *DemandRepository) CreateDemand(tx *gorm.DB, demand *model.Demand) error {
	if demand == nil {
		return errors.New("demand is nil")
	}
	return r.withDB(tx).Create(demand).Error
}

func (r *DemandRepository) SaveDemand(tx *gorm.DB, demand *model.Demand) error {
	if demand == nil {
		return errors.New("demand is nil")
	}
	return r.withDB(tx).Save(demand).Error
}

func (r *DemandRepository) GetDemandByID(id uint64) (*model.Demand, error) {
	var demand model.Demand
	if err := r.withDB(nil).First(&demand, id).Error; err != nil {
		return nil, err
	}
	return &demand, nil
}

func (r *DemandRepository) CreateMatches(tx *gorm.DB, matches []model.DemandMatch) error {
	if len(matches) == 0 {
		return nil
	}
	return r.withDB(tx).Create(&matches).Error
}

func (r *DemandRepository) SaveMatch(tx *gorm.DB, match *model.DemandMatch) error {
	if match == nil {
		return errors.New("match is nil")
	}
	return r.withDB(tx).Save(match).Error
}

func (r *DemandRepository) GetMatchByID(id uint64) (*model.DemandMatch, error) {
	var match model.DemandMatch
	if err := r.withDB(nil).First(&match, id).Error; err != nil {
		return nil, err
	}
	return &match, nil
}

func (r *DemandRepository) FindMatchByDemandAndProvider(demandID, providerID uint64) (*model.DemandMatch, error) {
	var match model.DemandMatch
	if err := r.withDB(nil).Where("demand_id = ? AND provider_id = ?", demandID, providerID).First(&match).Error; err != nil {
		return nil, err
	}
	return &match, nil
}
