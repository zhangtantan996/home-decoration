package service

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"

	"gorm.io/gorm"
)

type SupervisionService struct {
	projectService *ProjectService
}

type SupervisionProjectListQuery struct {
	Page           int
	PageSize       int
	Keyword        string
	PhaseStatus    string
	BusinessStage  string
	HasPendingRisk *bool
}

type SupervisionProjectListItem struct {
	ID                 uint64     `json:"id"`
	Name               string     `json:"name"`
	Address            string     `json:"address"`
	OwnerName          string     `json:"ownerName"`
	ProviderName       string     `json:"providerName"`
	BusinessStage      string     `json:"businessStage,omitempty"`
	KickoffStatus      string     `json:"kickoffStatus,omitempty"`
	PlannedStartDate   *time.Time `json:"plannedStartDate,omitempty"`
	CurrentResponsible string     `json:"currentResponsible,omitempty"`
	CurrentPhase       string     `json:"currentPhase"`
	CurrentPhaseStatus string     `json:"currentPhaseStatus"`
	LastLogAt          *time.Time `json:"lastLogAt,omitempty"`
	LatestLogTitle     string     `json:"latestLogTitle,omitempty"`
	UnhandledRiskCount int64      `json:"unhandledRiskCount"`
}

type SupervisionProjectWorkspace struct {
	ProjectID          uint64                   `json:"projectId"`
	Name               string                   `json:"name"`
	Address            string                   `json:"address"`
	OwnerName          string                   `json:"ownerName"`
	ProviderName       string                   `json:"providerName"`
	BusinessStage      string                   `json:"businessStage,omitempty"`
	KickoffStatus      string                   `json:"kickoffStatus,omitempty"`
	PlannedStartDate   *time.Time               `json:"plannedStartDate,omitempty"`
	CurrentResponsible string                   `json:"currentResponsible,omitempty"`
	CurrentPhase       string                   `json:"currentPhase"`
	CurrentPhaseStatus string                   `json:"currentPhaseStatus"`
	LastInspectionAt   *time.Time               `json:"lastInspectionAt,omitempty"`
	LatestLogTitle     string                   `json:"latestLogTitle,omitempty"`
	UnhandledRiskCount int64                    `json:"unhandledRiskCount"`
	SupervisorSummary  *BridgeSupervisorSummary `json:"supervisorSummary,omitempty"`
	RiskWarnings       []model.RiskWarning      `json:"riskWarnings"`
}

type CreateSupervisionRiskWarningInput struct {
	Type        string `json:"type"`
	Level       string `json:"level"`
	Description string `json:"description"`
	PhaseID     uint64 `json:"phaseId"`
}

func NewSupervisionService() *SupervisionService {
	return &SupervisionService{projectService: &ProjectService{}}
}

func (s *SupervisionService) ListProjects(query *SupervisionProjectListQuery) ([]SupervisionProjectListItem, int64, error) {
	page := 1
	pageSize := 20
	keyword := ""
	phaseStatus := ""
	businessStage := ""
	var hasPendingRisk *bool
	if query != nil {
		if query.Page > 0 {
			page = query.Page
		}
		if query.PageSize > 0 {
			pageSize = query.PageSize
		}
		keyword = strings.ToLower(strings.TrimSpace(query.Keyword))
		phaseStatus = strings.ToLower(strings.TrimSpace(query.PhaseStatus))
		businessStage = strings.ToLower(strings.TrimSpace(query.BusinessStage))
		hasPendingRisk = query.HasPendingRisk
	}

	var projects []model.Project
	if err := repository.DB.Order("updated_at DESC, id DESC").Find(&projects).Error; err != nil {
		return nil, 0, err
	}

	filtered := make([]SupervisionProjectListItem, 0, len(projects))
	for _, project := range projects {
		item, err := s.buildProjectListItem(&project)
		if err != nil {
			return nil, 0, err
		}

		if keyword != "" && !matchesSupervisionKeyword(item, keyword) {
			continue
		}
		if phaseStatus != "" && strings.ToLower(strings.TrimSpace(item.CurrentPhaseStatus)) != phaseStatus {
			continue
		}
		if businessStage != "" && strings.ToLower(strings.TrimSpace(item.BusinessStage)) != businessStage {
			continue
		}
		if hasPendingRisk != nil {
			if *hasPendingRisk && item.UnhandledRiskCount == 0 {
				continue
			}
			if !*hasPendingRisk && item.UnhandledRiskCount > 0 {
				continue
			}
		}

		filtered = append(filtered, item)
	}

	total := int64(len(filtered))
	start := (page - 1) * pageSize
	if start >= len(filtered) {
		return []SupervisionProjectListItem{}, total, nil
	}
	end := start + pageSize
	if end > len(filtered) {
		end = len(filtered)
	}

	return filtered[start:end], total, nil
}

func (s *SupervisionService) GetProjectWorkspace(projectID uint64) (*SupervisionProjectWorkspace, error) {
	if projectID == 0 {
		return nil, errors.New("无效项目ID")
	}

	detail, err := s.projectService.GetProjectDetail(projectID)
	if err != nil {
		return nil, err
	}

	phases, err := s.projectService.GetProjectPhases(projectID)
	if err != nil {
		return nil, err
	}
	currentPhase := pickCurrentProjectPhase(phases)
	lastLogAt, err := getProjectLastLogTime(projectID)
	if err != nil {
		return nil, err
	}
	riskWarnings, riskCount, err := listProjectRiskWarnings(projectID)
	if err != nil {
		return nil, err
	}
	bridgeSummary := BuildBridgeReadModelByProject(&detail.Project)
	currentResponsible := ""
	if currentPhase != nil {
		currentResponsible = strings.TrimSpace(currentPhase.ResponsiblePerson)
	}
	latestLogTitle := ""
	if bridgeSummary.SupervisorSummary != nil {
		latestLogTitle = bridgeSummary.SupervisorSummary.LatestLogTitle
	}

	return &SupervisionProjectWorkspace{
		ProjectID:          detail.ID,
		Name:               detail.Name,
		Address:            detail.Address,
		OwnerName:          detail.OwnerName,
		ProviderName:       detail.ProviderName,
		BusinessStage:      detail.BusinessStage,
		KickoffStatus:      bridgeSummary.KickoffStatus,
		PlannedStartDate:   bridgeSummary.PlannedStartDate,
		CurrentResponsible: currentResponsible,
		CurrentPhase:       resolvePhaseName(currentPhase),
		CurrentPhaseStatus: resolvePhaseStatus(currentPhase),
		LastInspectionAt:   lastLogAt,
		LatestLogTitle:     latestLogTitle,
		UnhandledRiskCount: riskCount,
		SupervisorSummary:  bridgeSummary.SupervisorSummary,
		RiskWarnings:       riskWarnings,
	}, nil
}

func (s *SupervisionService) GetProjectPhaseViews(projectID uint64) ([]ProjectPhaseView, error) {
	return s.projectService.GetProjectPhaseViews(projectID)
}

func (s *SupervisionService) GetProjectLogs(projectID, phaseID uint64, page, pageSize int) ([]model.WorkLog, int64, error) {
	if projectID == 0 {
		return nil, 0, errors.New("无效项目ID")
	}
	if phaseID > 0 {
		if _, err := s.getProjectPhase(projectID, phaseID); err != nil {
			return nil, 0, err
		}
	}
	return s.projectService.GetProjectLogs(projectID, page, pageSize, phaseID)
}

func (s *SupervisionService) CreatePhaseLog(projectID, phaseID, adminID uint64, req *CreateWorkLogRequest) (*model.WorkLog, error) {
	if projectID == 0 || phaseID == 0 {
		return nil, errors.New("无效项目或阶段ID")
	}
	if adminID == 0 {
		return nil, errors.New("无效管理员ID")
	}
	if _, err := s.getProjectPhase(projectID, phaseID); err != nil {
		return nil, err
	}
	if req == nil {
		req = &CreateWorkLogRequest{}
	}
	req.PhaseID = phaseID
	return s.projectService.CreateAdminWorkLog(projectID, adminID, req)
}

func (s *SupervisionService) UpdatePhase(projectID, phaseID uint64, req *UpdatePhaseRequest) error {
	if _, err := s.getProjectPhase(projectID, phaseID); err != nil {
		return err
	}
	return s.projectService.UpdatePhase(phaseID, req)
}

func (s *SupervisionService) UpdatePhaseTask(projectID, phaseID, taskID uint64, req *UpdatePhaseTaskRequest) error {
	if _, err := s.getProjectPhase(projectID, phaseID); err != nil {
		return err
	}
	var task model.PhaseTask
	if err := repository.DB.Where("id = ? AND phase_id = ?", taskID, phaseID).First(&task).Error; err != nil {
		return errors.New("阶段任务不存在")
	}
	return s.projectService.UpdatePhaseTask(taskID, req)
}

func (s *SupervisionService) CreateRiskWarning(projectID uint64, input *CreateSupervisionRiskWarningInput) (*model.RiskWarning, error) {
	if projectID == 0 {
		return nil, errors.New("无效项目ID")
	}
	if input == nil {
		return nil, errors.New("风险参数不能为空")
	}

	var project model.Project
	if err := repository.DB.First(&project, projectID).Error; err != nil {
		return nil, errors.New("项目不存在")
	}

	warningType := normalizeSupervisionRiskType(input.Type)
	if warningType == "" {
		return nil, errors.New("无效风险类型")
	}
	level := normalizeSupervisionRiskLevel(input.Level)
	if level == "" {
		return nil, errors.New("无效风险等级")
	}
	description := strings.TrimSpace(input.Description)
	if description == "" {
		return nil, errors.New("请填写风险描述")
	}

	phaseName := ""
	if input.PhaseID > 0 {
		phase, err := s.getProjectPhase(projectID, input.PhaseID)
		if err != nil {
			return nil, err
		}
		phaseName = resolvePhaseName(phase)
	} else {
		phases, err := s.projectService.GetProjectPhases(projectID)
		if err != nil {
			return nil, err
		}
		phaseName = resolvePhaseName(pickCurrentProjectPhase(phases))
	}

	if phaseName != "" {
		description = fmt.Sprintf("【阶段：%s】%s", phaseName, description)
	}

	warning := &model.RiskWarning{
		ProjectID:   projectID,
		ProjectName: project.Name,
		Type:        warningType,
		Level:       level,
		Description: description,
		Status:      0,
	}
	if err := repository.DB.Create(warning).Error; err != nil {
		return nil, err
	}
	NewNotificationDispatcher().NotifySupervisionRiskEscalated(projectID, providerUserIDFromProvider(project.ProviderID), warning.Type)
	return warning, nil
}

func (s *SupervisionService) buildProjectListItem(project *model.Project) (SupervisionProjectListItem, error) {
	item := SupervisionProjectListItem{}
	if project == nil {
		return item, errors.New("项目不存在")
	}

	item.ID = project.ID
	item.Name = project.Name
	item.Address = project.Address

	var owner model.User
	if err := repository.DB.Select("nickname").First(&owner, project.OwnerID).Error; err == nil {
		item.OwnerName = owner.Nickname
	}

	var provider model.Provider
	if err := repository.DB.Select("id", "user_id", "company_name", "provider_type").First(&provider, project.ProviderID).Error; err == nil {
		var providerUser model.User
		if provider.UserID > 0 {
			_ = repository.DB.Select("nickname", "phone").First(&providerUser, provider.UserID).Error
			item.ProviderName = ResolveProviderDisplayName(provider, &providerUser)
		} else {
			item.ProviderName = ResolveProviderDisplayName(provider, nil)
		}
	}

	phases, err := s.projectService.GetProjectPhases(project.ID)
	if err != nil {
		return item, err
	}
	var milestones []model.Milestone
	_ = repository.DB.Where("project_id = ?", project.ID).Order("seq ASC").Find(&milestones).Error
	flowSummary := s.projectService.resolveProjectFlowSummary(project, milestones)
	currentPhase := pickCurrentProjectPhase(phases)
	bridgeSummary := BuildBridgeReadModelByProject(project)
	item.CurrentPhase = resolvePhaseName(currentPhase)
	item.CurrentPhaseStatus = resolvePhaseStatus(currentPhase)
	item.BusinessStage = flowSummary.CurrentStage
	item.KickoffStatus = bridgeSummary.KickoffStatus
	item.PlannedStartDate = bridgeSummary.PlannedStartDate
	if currentPhase != nil {
		item.CurrentResponsible = strings.TrimSpace(currentPhase.ResponsiblePerson)
	}
	if bridgeSummary.SupervisorSummary != nil {
		item.LatestLogTitle = bridgeSummary.SupervisorSummary.LatestLogTitle
	}

	lastLogAt, err := getProjectLastLogTime(project.ID)
	if err != nil {
		return item, err
	}
	item.LastLogAt = lastLogAt

	_, riskCount, err := listProjectRiskWarnings(project.ID)
	if err != nil {
		return item, err
	}
	item.UnhandledRiskCount = riskCount

	return item, nil
}

func (s *SupervisionService) getProjectPhase(projectID, phaseID uint64) (*model.ProjectPhase, error) {
	var phase model.ProjectPhase
	if err := repository.DB.Where("id = ? AND project_id = ?", phaseID, projectID).First(&phase).Error; err != nil {
		return nil, errors.New("施工阶段不存在")
	}
	return &phase, nil
}

func pickCurrentProjectPhase(phases []model.ProjectPhase) *model.ProjectPhase {
	if len(phases) == 0 {
		return nil
	}
	for i := range phases {
		if strings.EqualFold(phases[i].Status, "in_progress") {
			return &phases[i]
		}
	}
	for i := range phases {
		if strings.EqualFold(phases[i].Status, "pending") {
			return &phases[i]
		}
	}
	return &phases[len(phases)-1]
}

func resolvePhaseName(phase *model.ProjectPhase) string {
	if phase == nil {
		return "阶段待同步"
	}
	return GetProjectPhaseDisplayName(phase.PhaseType)
}

func resolvePhaseStatus(phase *model.ProjectPhase) string {
	if phase == nil {
		return "pending"
	}
	return strings.TrimSpace(phase.Status)
}

func listProjectRiskWarnings(projectID uint64) ([]model.RiskWarning, int64, error) {
	var warnings []model.RiskWarning
	query := repository.DB.Where("project_id = ?", projectID).Order("status ASC, id DESC")
	if err := query.Limit(20).Find(&warnings).Error; err != nil {
		return nil, 0, err
	}

	var count int64
	if err := repository.DB.Model(&model.RiskWarning{}).
		Where("project_id = ? AND status IN ?", projectID, []int8{0, 1}).
		Count(&count).Error; err != nil {
		return nil, 0, err
	}

	return warnings, count, nil
}

func getProjectLastLogTime(projectID uint64) (*time.Time, error) {
	var log model.WorkLog
	if err := repository.DB.Where("project_id = ?", projectID).Order("log_date DESC, created_at DESC").First(&log).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}

	timestamp := log.LogDate
	return &timestamp, nil
}

func matchesSupervisionKeyword(item SupervisionProjectListItem, keyword string) bool {
	targets := []string{
		strings.ToLower(item.Name),
		strings.ToLower(item.Address),
		strings.ToLower(item.OwnerName),
		strings.ToLower(item.ProviderName),
	}
	for _, target := range targets {
		if strings.Contains(target, keyword) {
			return true
		}
	}
	return false
}

func normalizeSupervisionRiskType(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "delay", "quality", "payment", "dispute":
		return strings.ToLower(strings.TrimSpace(value))
	default:
		return ""
	}
}

func normalizeSupervisionRiskLevel(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "low", "medium", "high", "critical":
		return strings.ToLower(strings.TrimSpace(value))
	default:
		return ""
	}
}
