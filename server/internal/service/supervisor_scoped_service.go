package service

import (
	"errors"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
)

// SupervisorScopedService 数据隔离层 — 监理只能访问分配给自己的项目
type SupervisorScopedService struct {
	supervision *SupervisionService
}

func NewSupervisorScopedService() *SupervisorScopedService {
	return &SupervisorScopedService{supervision: NewSupervisionService()}
}

// VerifyAssignment 验证监理是否被分配到指定项目
func (s *SupervisorScopedService) VerifyAssignment(supervisorID, projectID uint64) error {
	if supervisorID == 0 || projectID == 0 {
		return errors.New("无效参数")
	}
	var count int64
	if err := repository.DB.Model(&model.ProjectSupervisorAssignment{}).
		Where("supervisor_id = ? AND project_id = ? AND status = 1", supervisorID, projectID).
		Count(&count).Error; err != nil {
		return errors.New("验证分配关系失败")
	}
	if count == 0 {
		return errors.New("无权访问该项目")
	}
	return nil
}

// ListAssignedProjects 只返回分配给该监理的项目（SQL层过滤）
func (s *SupervisorScopedService) ListAssignedProjects(supervisorID uint64, query *SupervisionProjectListQuery) ([]SupervisionProjectListItem, int64, error) {
	var assignments []model.ProjectSupervisorAssignment
	if err := repository.DB.
		Where("supervisor_id = ? AND status = 1", supervisorID).
		Find(&assignments).Error; err != nil {
		return nil, 0, err
	}

	if len(assignments) == 0 {
		return []SupervisionProjectListItem{}, 0, nil
	}

	projectIDs := make([]uint64, len(assignments))
	for i, a := range assignments {
		projectIDs[i] = a.ProjectID
	}

	if query == nil {
		query = &SupervisionProjectListQuery{}
	}
	query.ProjectIDs = projectIDs

	return s.supervision.ListProjects(query)
}

// GetProjectWorkspace 获取项目工作台（需验证分配）
func (s *SupervisorScopedService) GetProjectWorkspace(supervisorID, projectID uint64) (*SupervisionProjectWorkspace, error) {
	if err := s.VerifyAssignment(supervisorID, projectID); err != nil {
		return nil, err
	}
	return s.supervision.GetProjectWorkspace(projectID)
}

// GetProjectPhases 获取项目施工阶段（需验证分配）
func (s *SupervisorScopedService) GetProjectPhases(supervisorID, projectID uint64) ([]ProjectPhaseView, error) {
	if err := s.VerifyAssignment(supervisorID, projectID); err != nil {
		return nil, err
	}
	return s.supervision.GetProjectPhaseViews(projectID)
}

// GetProjectLogs 获取施工日志（需验证分配）
func (s *SupervisorScopedService) GetProjectLogs(supervisorID, projectID, phaseID uint64, page, pageSize int) ([]model.WorkLog, int64, error) {
	if err := s.VerifyAssignment(supervisorID, projectID); err != nil {
		return nil, 0, err
	}
	return s.supervision.GetProjectLogs(projectID, phaseID, page, pageSize)
}

// CreatePhaseLog 创建施工日志（需验证分配）
func (s *SupervisorScopedService) CreatePhaseLog(supervisorID, projectID, phaseID uint64, req *CreateWorkLogRequest) (*model.WorkLog, error) {
	if err := s.VerifyAssignment(supervisorID, projectID); err != nil {
		return nil, err
	}
	return s.supervision.CreateSupervisorPhaseLog(projectID, phaseID, supervisorID, req)
}

// UpdatePhase 更新施工阶段（需验证分配）
func (s *SupervisorScopedService) UpdatePhase(supervisorID, projectID, phaseID uint64, req *UpdatePhaseRequest) error {
	if err := s.VerifyAssignment(supervisorID, projectID); err != nil {
		return err
	}
	return s.supervision.UpdatePhase(projectID, phaseID, req)
}

// UpdatePhaseTask 更新阶段任务（需验证分配）
func (s *SupervisorScopedService) UpdatePhaseTask(supervisorID, projectID, phaseID, taskID uint64, req *UpdatePhaseTaskRequest) error {
	if err := s.VerifyAssignment(supervisorID, projectID); err != nil {
		return err
	}
	return s.supervision.UpdatePhaseTask(projectID, phaseID, taskID, req)
}

// CreateRiskWarning 上报风险预警（需验证分配）
func (s *SupervisorScopedService) CreateRiskWarning(supervisorID, projectID uint64, input *CreateSupervisionRiskWarningInput) (*model.RiskWarning, error) {
	if err := s.VerifyAssignment(supervisorID, projectID); err != nil {
		return nil, err
	}
	return s.supervision.CreateRiskWarning(projectID, input)
}
