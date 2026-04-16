package service

import (
	"time"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"

	"gorm.io/gorm"
)

var openComplaintStatuses = []string{"resolved", "closed", "completed"}
var openProjectAuditStatuses = []string{model.ProjectAuditStatusPending, model.ProjectAuditStatusInProgress}
var openArbitrationStatuses = []int8{0, 1}

type majorRiskProjectFilter struct {
	Start         *time.Time
	End           *time.Time
	ProviderID    uint64
	OnlyCompleted bool
}

func countMajorRiskProjects(filter majorRiskProjectFilter) int64 {
	ids, err := loadMajorRiskProjectIDs(filter)
	if err != nil {
		return 0
	}
	return int64(len(ids))
}

func loadMajorRiskProjectIDs(filter majorRiskProjectFilter) ([]uint64, error) {
	projectIDs := make(map[uint64]struct{})

	if err := collectComplaintRiskProjectIDs(projectIDs, filter); err != nil {
		return nil, err
	}
	if err := collectProjectDisputeRiskProjectIDs(projectIDs, filter); err != nil {
		return nil, err
	}
	if err := collectProjectAuditRiskProjectIDs(projectIDs, filter); err != nil {
		return nil, err
	}
	if err := collectArbitrationRiskProjectIDs(projectIDs, filter); err != nil {
		return nil, err
	}

	if len(projectIDs) == 0 {
		return nil, nil
	}

	filtered := make([]uint64, 0, len(projectIDs))
	query := repository.DB.Model(&model.Project{}).Distinct("id")
	if filter.ProviderID > 0 {
		query = query.Where("provider_id = ?", filter.ProviderID)
	}
	if filter.OnlyCompleted {
		query = query.Where("status = ? OR business_status = ?", model.ProjectStatusCompleted, model.ProjectBusinessStatusCompleted)
	}
	query = query.Where("id IN ?", mapKeysToSlice(projectIDs))
	if err := query.Pluck("id", &filtered).Error; err != nil {
		return nil, err
	}
	return filtered, nil
}

func collectComplaintRiskProjectIDs(target map[uint64]struct{}, filter majorRiskProjectFilter) error {
	query := repository.DB.Model(&model.Complaint{}).
		Distinct("project_id").
		Where("project_id > 0").
		Where("status NOT IN ?", openComplaintStatuses)
	if filter.ProviderID > 0 {
		query = query.Where("provider_id = ?", filter.ProviderID)
	}
	query = applyTimeWindow(query, "created_at", filter.Start, filter.End)
	return appendDistinctProjectIDs(query, "project_id", target)
}

func collectProjectDisputeRiskProjectIDs(target map[uint64]struct{}, filter majorRiskProjectFilter) error {
	query := repository.DB.Model(&model.Project{}).
		Distinct("id").
		Where("disputed_at IS NOT NULL")
	if filter.ProviderID > 0 {
		query = query.Where("provider_id = ?", filter.ProviderID)
	}
	query = applyTimeWindow(query, "disputed_at", filter.Start, filter.End)
	return appendDistinctProjectIDs(query, "id", target)
}

func collectProjectAuditRiskProjectIDs(target map[uint64]struct{}, filter majorRiskProjectFilter) error {
	query := repository.DB.Model(&model.ProjectAudit{}).
		Distinct("project_audits.project_id").
		Where("project_audits.project_id > 0").
		Where("project_audits.audit_type = ?", model.ProjectAuditTypeDispute).
		Where("project_audits.status IN ?", openProjectAuditStatuses)
	if filter.ProviderID > 0 {
		query = query.Joins("JOIN projects ON projects.id = project_audits.project_id").
			Where("projects.provider_id = ?", filter.ProviderID)
	}
	query = applyTimeWindow(query, "project_audits.created_at", filter.Start, filter.End)
	return appendDistinctProjectIDs(query, "project_id", target)
}

func collectArbitrationRiskProjectIDs(target map[uint64]struct{}, filter majorRiskProjectFilter) error {
	query := repository.DB.Model(&model.Arbitration{}).
		Distinct("arbitrations.project_id").
		Where("arbitrations.project_id > 0").
		Where("arbitrations.status IN ?", openArbitrationStatuses)
	if filter.ProviderID > 0 {
		query = query.Joins("JOIN projects ON projects.id = arbitrations.project_id").
			Where("projects.provider_id = ?", filter.ProviderID)
	}
	query = applyTimeWindow(query, "arbitrations.created_at", filter.Start, filter.End)
	return appendDistinctProjectIDs(query, "project_id", target)
}

func appendDistinctProjectIDs(query *gorm.DB, column string, target map[uint64]struct{}) error {
	var ids []uint64
	if err := query.Pluck(column, &ids).Error; err != nil {
		return err
	}
	for _, id := range ids {
		if id == 0 {
			continue
		}
		target[id] = struct{}{}
	}
	return nil
}

func applyTimeWindow(query *gorm.DB, column string, start, end *time.Time) *gorm.DB {
	if start != nil {
		query = query.Where(column+" >= ?", *start)
	}
	if end != nil {
		query = query.Where(column+" < ?", *end)
	}
	return query
}

func mapKeysToSlice(items map[uint64]struct{}) []uint64 {
	result := make([]uint64, 0, len(items))
	for id := range items {
		result = append(result, id)
	}
	return result
}
