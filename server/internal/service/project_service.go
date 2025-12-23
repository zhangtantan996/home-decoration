package service

import (
	"errors"
	"time"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"

	"gorm.io/gorm"
)

type ProjectService struct{}

// CreateProjectRequest 创建项目请求
type CreateProjectRequest struct {
	OwnerID     uint64  `json:"ownerId"`
	ProviderID  uint64  `json:"providerId"`
	Name        string  `json:"name" binding:"required"`
	Address     string  `json:"address" binding:"required"`
	Latitude    float64 `json:"latitude"`
	Longitude   float64 `json:"longitude"`
	Area        float64 `json:"area"`
	Budget      float64 `json:"budget"`
	StartDate   string  `json:"startDate"` // YYYY-MM-DD
	ExpectedEnd string  `json:"expectedEnd"`
}

// ProjectDetail 项目详情响应
type ProjectDetail struct {
	model.Project
	OwnerName     string            `json:"ownerName"`
	ProviderName  string            `json:"providerName"`
	Milestones    []model.Milestone `json:"milestones"`
	RecentLogs    []model.WorkLog   `json:"recentLogs"`
	EscrowBalance float64           `json:"escrowBalance"`
}

// CreateProject 创建项目
func (s *ProjectService) CreateProject(req *CreateProjectRequest) (*model.Project, error) {
	// 验证服务商是否存在
	var provider model.Provider
	if err := repository.DB.First(&provider, req.ProviderID).Error; err != nil {
		return nil, errors.New("服务商不存在")
	}

	// 验证业主是否存在
	var owner model.User
	if err := repository.DB.First(&owner, req.OwnerID).Error; err != nil {
		return nil, errors.New("业主不存在")
	}

	// 解析日期
	start, _ := time.Parse("2006-01-02", req.StartDate)
	end, _ := time.Parse("2006-01-02", req.ExpectedEnd)

	project := &model.Project{
		OwnerID:      req.OwnerID,
		ProviderID:   req.ProviderID,
		Name:         req.Name,
		Address:      req.Address,
		Latitude:     req.Latitude,
		Longitude:    req.Longitude,
		Area:         req.Area,
		Budget:       req.Budget,
		Status:       0, // 待签约
		CurrentPhase: "准备阶段",
		StartDate:    &start,
		ExpectedEnd:  &end,
	}

	// 开启事务
	err := repository.DB.Transaction(func(tx *gorm.DB) error {
		// 创建项目
		if err := tx.Create(project).Error; err != nil {
			return err
		}

		// 创建默认托管账户
		escrow := &model.EscrowAccount{
			ProjectID: project.ID,
			Status:    1,
		}
		if err := tx.Create(escrow).Error; err != nil {
			return err
		}

		// 创建默认验收节点 (示例模板)
		milestones := []model.Milestone{
			{ProjectID: project.ID, Name: "开工交底", Seq: 1, Percentage: 20, Status: 0, Criteria: "现场保护完成，图纸确认"},
			{ProjectID: project.ID, Name: "水电验收", Seq: 2, Percentage: 30, Status: 0, Criteria: "水管试压合格，电路通断测试"},
			{ProjectID: project.ID, Name: "泥木验收", Seq: 3, Percentage: 30, Status: 0, Criteria: "瓷砖空鼓率<5%，木工结构牢固"},
			{ProjectID: project.ID, Name: "竣工验收", Seq: 4, Percentage: 20, Status: 0, Criteria: "全屋保洁完成，设备调试正常"},
		}

		// 计算金额
		for i := range milestones {
			milestones[i].Amount = req.Budget * float64(milestones[i].Percentage) / 100
		}

		if err := tx.Create(&milestones).Error; err != nil {
			return err
		}

		return nil
	})

	if err != nil {
		return nil, err
	}

	return project, nil
}

// ListProjects 获取项目列表
func (s *ProjectService) ListProjects(userID uint64, userType int8, page, pageSize int) ([]model.Project, int64, error) {
	var projects []model.Project
	var total int64

	db := repository.DB.Model(&model.Project{})

	// 根据用户类型筛选
	if userType == 1 { // 业主
		db = db.Where("owner_id = ?", userID)
	} else if userType == 2 || userType == 3 { // 服务商/工人 (TODO: 工人关联项目逻辑较复杂，简化处理)
		db = db.Where("provider_id = ? OR id IN (SELECT project_id FROM work_logs WHERE worker_id = ?)", userID, userID)
	}

	db.Count(&total)

	offset := (page - 1) * pageSize
	if err := db.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&projects).Error; err != nil {
		return nil, 0, err
	}

	return projects, total, nil
}

// GetProjectDetail 获取项目详情
func (s *ProjectService) GetProjectDetail(id uint64) (*ProjectDetail, error) {
	var project model.Project
	if err := repository.DB.First(&project, id).Error; err != nil {
		return nil, err
	}

	// 获取关联信息
	var owner model.User
	repository.DB.Select("nickname").First(&owner, project.OwnerID)

	var provider model.Provider
	repository.DB.Select("company_name").First(&provider, project.ProviderID)

	var milestones []model.Milestone
	repository.DB.Where("project_id = ?", id).Order("seq ASC").Find(&milestones)

	var logs []model.WorkLog
	repository.DB.Where("project_id = ?", id).Order("log_date DESC").Limit(5).Find(&logs)

	var escrow model.EscrowAccount
	repository.DB.Where("project_id = ?", id).First(&escrow)

	return &ProjectDetail{
		Project:       project,
		OwnerName:     owner.Nickname,
		ProviderName:  provider.CompanyName,
		Milestones:    milestones,
		RecentLogs:    logs,
		EscrowBalance: escrow.TotalAmount - escrow.ReleasedAmount,
	}, nil
}

// CreateWorkLog 创建施工日志
func (s *ProjectService) CreateWorkLog(projectID, workerID uint64, description string, photos string) error {
	log := &model.WorkLog{
		ProjectID:   projectID,
		WorkerID:    workerID,
		LogDate:     time.Now(),
		Description: description,
		Photos:      photos,
	}
	// 简单模拟AI分析
	log.AIAnalysis = `{"status": "normal", "detect": ["wall", "pipe"]}`

	return repository.DB.Create(log).Error
}

// GetProjectLogs 获取项目日志
func (s *ProjectService) GetProjectLogs(projectID uint64, page, pageSize int) ([]model.WorkLog, int64, error) {
	var logs []model.WorkLog
	var total int64

	db := repository.DB.Model(&model.WorkLog{}).Where("project_id = ?", projectID)
	db.Count(&total)

	offset := (page - 1) * pageSize
	if err := db.Order("log_date DESC").Offset(offset).Limit(pageSize).Find(&logs).Error; err != nil {
		return nil, 0, err
	}

	return logs, total, nil
}

// ========== 项目阶段相关 ==========

// GetProjectPhases 获取项目所有阶段（含子任务）
func (s *ProjectService) GetProjectPhases(projectID uint64) ([]model.ProjectPhase, error) {
	var phases []model.ProjectPhase
	err := repository.DB.Where("project_id = ?", projectID).
		Preload("Tasks").
		Order("seq ASC").
		Find(&phases).Error
	if err != nil {
		return nil, err
	}
	return phases, nil
}

// UpdatePhaseRequest 更新阶段请求
type UpdatePhaseRequest struct {
	Status            string `json:"status"`
	ResponsiblePerson string `json:"responsiblePerson"`
	StartDate         string `json:"startDate"` // YYYY-MM-DD
	EndDate           string `json:"endDate"`
	EstimatedDays     int    `json:"estimatedDays"`
}

// UpdatePhase 更新阶段状态
func (s *ProjectService) UpdatePhase(phaseID uint64, req *UpdatePhaseRequest) error {
	var phase model.ProjectPhase
	if err := repository.DB.First(&phase, phaseID).Error; err != nil {
		return errors.New("阶段不存在")
	}

	updates := map[string]interface{}{}

	if req.Status != "" {
		updates["status"] = req.Status
	}
	if req.ResponsiblePerson != "" {
		updates["responsible_person"] = req.ResponsiblePerson
	}
	if req.StartDate != "" {
		if t, err := time.Parse("2006-01-02", req.StartDate); err == nil {
			updates["start_date"] = t
		}
	}
	if req.EndDate != "" {
		if t, err := time.Parse("2006-01-02", req.EndDate); err == nil {
			updates["end_date"] = t
		}
	}
	if req.EstimatedDays > 0 {
		updates["estimated_days"] = req.EstimatedDays
	}

	return repository.DB.Model(&phase).Updates(updates).Error
}

// UpdatePhaseTaskRequest 更新子任务请求
type UpdatePhaseTaskRequest struct {
	IsCompleted bool `json:"isCompleted"`
}

// UpdatePhaseTask 更新子任务状态
func (s *ProjectService) UpdatePhaseTask(taskID uint64, req *UpdatePhaseTaskRequest) error {
	var task model.PhaseTask
	if err := repository.DB.First(&task, taskID).Error; err != nil {
		return errors.New("任务不存在")
	}

	updates := map[string]interface{}{
		"is_completed": req.IsCompleted,
	}

	if req.IsCompleted {
		now := time.Now()
		updates["completed_at"] = &now
	} else {
		updates["completed_at"] = nil
	}

	return repository.DB.Model(&task).Updates(updates).Error
}

// InitProjectPhases 创建项目时初始化默认阶段
func (s *ProjectService) InitProjectPhases(tx *gorm.DB, projectID uint64) error {
	defaultPhases := []model.ProjectPhase{
		{ProjectID: projectID, PhaseType: "preparation", Seq: 1, Status: "pending", EstimatedDays: 4},
		{ProjectID: projectID, PhaseType: "demolition", Seq: 2, Status: "pending", EstimatedDays: 7},
		{ProjectID: projectID, PhaseType: "electrical", Seq: 3, Status: "pending", EstimatedDays: 10},
		{ProjectID: projectID, PhaseType: "masonry", Seq: 4, Status: "pending", EstimatedDays: 15},
		{ProjectID: projectID, PhaseType: "painting", Seq: 5, Status: "pending", EstimatedDays: 10},
		{ProjectID: projectID, PhaseType: "installation", Seq: 6, Status: "pending", EstimatedDays: 7},
		{ProjectID: projectID, PhaseType: "inspection", Seq: 7, Status: "pending", EstimatedDays: 3},
	}

	for i := range defaultPhases {
		if err := tx.Create(&defaultPhases[i]).Error; err != nil {
			return err
		}

		// 为每个阶段创建默认子任务
		var tasks []model.PhaseTask
		switch defaultPhases[i].PhaseType {
		case "preparation":
			tasks = []model.PhaseTask{
				{PhaseID: defaultPhases[i].ID, Name: "现场交接确认"},
				{PhaseID: defaultPhases[i].ID, Name: "施工图纸确认"},
				{PhaseID: defaultPhases[i].ID, Name: "材料进场验收"},
			}
		case "demolition":
			tasks = []model.PhaseTask{
				{PhaseID: defaultPhases[i].ID, Name: "墙体拆除"},
				{PhaseID: defaultPhases[i].ID, Name: "地面拆除"},
				{PhaseID: defaultPhases[i].ID, Name: "垃圾清运"},
			}
		case "electrical":
			tasks = []model.PhaseTask{
				{PhaseID: defaultPhases[i].ID, Name: "水管布置"},
				{PhaseID: defaultPhases[i].ID, Name: "电路布线"},
				{PhaseID: defaultPhases[i].ID, Name: "水电验收"},
			}
		case "masonry":
			tasks = []model.PhaseTask{
				{PhaseID: defaultPhases[i].ID, Name: "瓷砖铺贴"},
				{PhaseID: defaultPhases[i].ID, Name: "木工制作"},
				{PhaseID: defaultPhases[i].ID, Name: "吊顶施工"},
			}
		case "painting":
			tasks = []model.PhaseTask{
				{PhaseID: defaultPhases[i].ID, Name: "墙面处理"},
				{PhaseID: defaultPhases[i].ID, Name: "乳胶漆施工"},
			}
		case "installation":
			tasks = []model.PhaseTask{
				{PhaseID: defaultPhases[i].ID, Name: "灯具安装"},
				{PhaseID: defaultPhases[i].ID, Name: "洁具安装"},
				{PhaseID: defaultPhases[i].ID, Name: "五金安装"},
			}
		case "inspection":
			tasks = []model.PhaseTask{
				{PhaseID: defaultPhases[i].ID, Name: "全屋保洁"},
				{PhaseID: defaultPhases[i].ID, Name: "设备调试"},
				{PhaseID: defaultPhases[i].ID, Name: "交付验收"},
			}
		}

		if len(tasks) > 0 {
			if err := tx.Create(&tasks).Error; err != nil {
				return err
			}
		}
	}

	return nil
}
