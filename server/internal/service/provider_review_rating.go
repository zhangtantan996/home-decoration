package service

import (
	"math"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"

	"gorm.io/gorm"
)

const (
	providerReviewSampleStateNone   = "none"
	providerReviewSampleStateSmall  = "small"
	providerReviewSampleStateStable = "stable"

	providerRatingPriorSampleCount = 5.0
	providerRatingFallbackPrior    = 4.5
)

type providerReviewAggregate struct {
	Count int64
	Sum   float64
}

func normalizeProviderReviewSampleState(total int64) string {
	switch {
	case total <= 0:
		return providerReviewSampleStateNone
	case total <= 2:
		return providerReviewSampleStateSmall
	default:
		return providerReviewSampleStateStable
	}
}

func effectiveProjectProviderID(project *model.Project) uint64 {
	if project == nil {
		return 0
	}
	if project.ConstructionProviderID > 0 {
		return project.ConstructionProviderID
	}
	return project.ProviderID
}

func projectApprovedForOfficialReview(project *model.Project) bool {
	if project == nil {
		return false
	}
	return project.Status == model.ProjectStatusCompleted &&
		project.BusinessStatus == model.ProjectBusinessStatusCompleted &&
		project.InspirationCaseDraftID > 0
}

func validOfficialProviderReviewScope(db *gorm.DB) *gorm.DB {
	return db.Table("provider_reviews").
		Joins("JOIN projects ON projects.id = provider_reviews.project_id").
		Where("provider_reviews.project_id > 0").
		Where("projects.owner_id = provider_reviews.user_id").
		Where("(projects.construction_provider_id = provider_reviews.provider_id OR (COALESCE(projects.construction_provider_id, 0) = 0 AND projects.provider_id = provider_reviews.provider_id))").
		Where("projects.status = ? AND projects.business_status = ? AND projects.inspiration_case_draft_id > 0", model.ProjectStatusCompleted, model.ProjectBusinessStatusCompleted)
}

func loadValidProviderReviewAggregateTx(tx *gorm.DB, providerID uint64) (providerReviewAggregate, error) {
	result := providerReviewAggregate{}
	err := validOfficialProviderReviewScope(tx).
		Where("provider_reviews.provider_id = ?", providerID).
		Select("COUNT(*) AS count, COALESCE(SUM(provider_reviews.rating), 0) AS sum").
		Scan(&result).Error
	return result, err
}

func loadProviderTypePriorMeanTx(tx *gorm.DB, providerType int8, excludeProviderID uint64) (float64, error) {
	var result struct {
		Avg float64
	}
	db := validOfficialProviderReviewScope(tx).
		Joins("JOIN providers ON providers.id = provider_reviews.provider_id").
		Where("providers.provider_type = ?", providerType)
	if excludeProviderID > 0 {
		db = db.Where("provider_reviews.provider_id <> ?", excludeProviderID)
	}
	if err := db.
		Select("COALESCE(AVG(provider_reviews.rating), 0) AS avg").
		Scan(&result).Error; err != nil {
		return 0, err
	}
	if result.Avg <= 0 {
		return providerRatingFallbackPrior, nil
	}
	return result.Avg, nil
}

func calculateProviderDisplayRating(sum float64, count int64, priorMean float64) float32 {
	if count <= 0 {
		return 0
	}
	score := ((priorMean * providerRatingPriorSampleCount) + sum) / (providerRatingPriorSampleCount + float64(count))
	if score < 0 {
		score = 0
	}
	if score > 5 {
		score = 5
	}
	return float32(math.Round(score*100) / 100)
}

func (s *ProviderService) RecalculateAggregatedRating(providerID uint64) error {
	return repository.DB.Transaction(func(tx *gorm.DB) error {
		return s.recalculateAggregatedRatingTx(tx, providerID)
	})
}

func (s *ProviderService) recalculateAggregatedRatingTx(tx *gorm.DB, providerID uint64) error {
	if providerID == 0 {
		return nil
	}

	var provider model.Provider
	if err := tx.Select("id", "provider_type").First(&provider, providerID).Error; err != nil {
		return err
	}

	agg, err := loadValidProviderReviewAggregateTx(tx, providerID)
	if err != nil {
		return err
	}
	if agg.Count == 0 {
		return tx.Model(&model.Provider{}).Where("id = ?", providerID).Updates(map[string]interface{}{
			"rating":       0,
			"review_count": 0,
		}).Error
	}

	priorMean, err := loadProviderTypePriorMeanTx(tx, provider.ProviderType, provider.ID)
	if err != nil {
		return err
	}
	rating := calculateProviderDisplayRating(agg.Sum, agg.Count, priorMean)

	return tx.Model(&model.Provider{}).Where("id = ?", providerID).Updates(map[string]interface{}{
		"rating":       rating,
		"review_count": agg.Count,
	}).Error
}
