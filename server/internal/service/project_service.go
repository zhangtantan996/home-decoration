package service

import (
	"errors"
	"time"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	imgutil "home-decoration-server/internal/utils/image"

	"gorm.io/gorm"
)

type ProjectService struct{}

// CreateProjectRequest 创建项目请求
type CreateProjectRequest struct {
	ProposalID     uint64 `json:"proposalId"` // 可选，从方案创建
	MaterialMethod string `json:"materialMethod"`
	CrewID         uint64 `json:"crewId"`
	EntryStartDate string `json:"entryStartDate"` // YYYY-MM-DD
	EntryEndDate   string `json:"entryEndDate"`   // YYYY-MM-DD

	// 原有字段（如不从方案创建，则必填）
	OwnerID     uint64  `json:"ownerId"`
	ProviderID  uint64  `json:"providerId"`
	Name        string  `json:"name"`
	Address     string  `json:"address"`
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

type ConfirmConstructionRequest struct {
	ConstructionProviderID uint64 `json:"constructionProviderId" binding:"required"`
	ForemanID              uint64 `json:"foremanId" binding:"required"`
}

type ConfirmConstructionQuoteRequest struct {
	ConstructionQuote float64 `json:"constructionQuote" binding:"required"`
	MaterialMethod    string  `json:"materialMethod"`
	PlannedStartDate  string  `json:"plannedStartDate"`
	ExpectedEnd       string  `json:"expectedEnd"`
}

type StartProjectRequest struct {
	StartDate string `json:"startDate"`
}

// CreateProject 创建项目
func (s *ProjectService) CreateProject(req *CreateProjectRequest) (*model.Project, error) {
	project := &model.Project{
		OwnerID:        req.OwnerID,
		Status:         model.ProjectStatusActive,
		CurrentPhase:   "准备阶段",
		BusinessStatus: model.ProjectBusinessStatusDraft,
		MaterialMethod: req.MaterialMethod,
		CrewID:         req.CrewID,
	}

	// 如果是从方案创建
	if req.ProposalID > 0 {
		var proposal model.Proposal
		if err := repository.DB.First(&proposal, req.ProposalID).Error; err != nil {
			return nil, errors.New("方案不存在")
		}

		var booking model.Booking
		if err := repository.DB.First(&booking, proposal.BookingID).Error; err != nil {
			return nil, errors.New("关联预约不存在")
		}

		project.ProposalID = req.ProposalID // 关联方案ID
		project.OwnerID = booking.UserID
		project.ProviderID = booking.ProviderID
		project.Name = booking.Address + "装修项目" // 默认项目名
		project.Address = booking.Address
		project.Area = booking.Area
		project.Budget = proposal.DesignFee + proposal.ConstructionFee + proposal.MaterialFee
		if proposal.Status == model.ProposalStatusConfirmed {
			project.BusinessStatus = model.ProjectBusinessStatusProposalConfirmed
			project.CurrentPhase = "待施工确认"
		}

		// 经纬度暂未存储在booking/proposal中，可设为0或后续补充

		// 解析进场时间
		if t, err := time.Parse("2006-01-02", req.EntryStartDate); err == nil {
			project.EntryStartDate = &t
		}
		if t, err := time.Parse("2006-01-02", req.EntryEndDate); err == nil {
			project.EntryEndDate = &t
		}
		// 预估工期默认90天
		if project.EntryStartDate != nil {
			end := project.EntryStartDate.AddDate(0, 0, 90)
			project.ExpectedEnd = &end
		}

	} else {
		// 手动创建逻辑（保持原有）
		if req.Name == "" || req.Address == "" {
			return nil, errors.New("项目名称和地址不能为空")
		}

		project.ProviderID = req.ProviderID
		project.Name = req.Name
		project.Address = req.Address
		project.Latitude = req.Latitude
		project.Longitude = req.Longitude
		project.Area = req.Area
		project.Budget = req.Budget

		if t, err := time.Parse("2006-01-02", req.StartDate); err == nil {
			project.StartDate = &t
		}
		if t, err := time.Parse("2006-01-02", req.ExpectedEnd); err == nil {
			project.ExpectedEnd = &t
		}
	}

	// 验证服务商
	var provider model.Provider
	if err := repository.DB.First(&provider, project.ProviderID).Error; err != nil {
		return nil, errors.New("服务商不存在")
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

		// 只有完整创建的项目才初始化阶段
		if err := s.InitProjectPhases(tx, project.ID); err != nil {
			return err
		}

		// 创建默认验收节点
		milestones := []model.Milestone{
			{ProjectID: project.ID, Name: "开工交底", Seq: 1, Percentage: 20, Status: 0, Criteria: "现场保护完成，图纸确认"},
			{ProjectID: project.ID, Name: "水电验收", Seq: 2, Percentage: 30, Status: 0, Criteria: "水管试压合格，电路通断测试"},
			{ProjectID: project.ID, Name: "泥木验收", Seq: 3, Percentage: 30, Status: 0, Criteria: "瓷砖空鼓率<5%，木工结构牢固"},
			{ProjectID: project.ID, Name: "竣工验收", Seq: 4, Percentage: 20, Status: 0, Criteria: "全屋保洁完成，设备调试正常"},
		}

		// 计算金额
		for i := range milestones {
			milestones[i].Amount = project.Budget * float64(milestones[i].Percentage) / 100
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

	// 如果 userType 为 0（可能 Token 中未包含），查库确认
	if userType == 0 {
		var u model.User
		if err := repository.DB.First(&u, userID).Error; err == nil {
			userType = u.UserType
		}
	}

	db := repository.DB.Model(&model.Project{})

	// 根据用户类型筛选
	if userType == 1 { // 业主
		db = db.Where("owner_id = ?", userID)
	} else if userType == 2 || userType == 3 { // 服务商/工人
		db = db.Where("provider_id = ? OR id IN (SELECT project_id FROM work_logs WHERE worker_id = ?)", userID, userID)
	}

	db.Count(&total)

	offset := (page - 1) * pageSize
	if err := db.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&projects).Error; err != nil {
		return nil, 0, err
	}

	// 针对业主，补充“待完善”的项目（即已生成设计费订单的方案，无论是否支付）
	// 为避免分页复杂性，仅在第一页且用户是业主时加载这些数据
	if userType == 1 && page == 1 {
		var proposalIDs []uint64
		// 1. 查找该用户所有设计费订单关联的 ProposalID
		// 逻辑：User -> Booking -> Order(type=design) -> Proposal
		err := repository.DB.Table("orders").
			Joins("JOIN bookings ON bookings.id = orders.booking_id").
			Where("bookings.user_id = ? AND orders.order_type = ?", userID, "design").
			Pluck("orders.proposal_id", &proposalIDs).Error

		if err == nil && len(proposalIDs) > 0 {
			var proposals []model.Proposal
			// 获取方案详情
			if err := repository.DB.Where("id IN ?", proposalIDs).Find(&proposals).Error; err == nil {
				for _, p := range proposals {
					// 手动获取 Booking 以获取地址
					var booking model.Booking
					if err := repository.DB.First(&booking, p.BookingID).Error; err != nil {
						continue // 如果找不到关联的 Booking，则跳过此方案
					}

					// 检查是否已存在同名/同地址项目
					exists := false

					// 1. 检查当前返回列表中的项目
					for _, proj := range projects {
						if proj.Address == booking.Address {
							exists = true
							break
						}
					}

					// 2. 检查数据库中已存在的项目
					if !exists {
						var count int64
						repository.DB.Model(&model.Project{}).
							Where("owner_id = ? AND address = ?", userID, booking.Address).
							Count(&count)
						if count > 0 {
							exists = true
						}
					}

					if !exists {
						// 构造“待完善”项目
						// 使用 Booking.Address 加上 "(待创建)" 后缀
						// 注意：ProviderID 取自 Proposal.DesignerID
						pendingProject := model.Project{
							Base: model.Base{
								ID:        p.ID, // 使用 ProposalID 作为临时 ID
								CreatedAt: p.CreatedAt,
								UpdatedAt: p.UpdatedAt,
							},
							OwnerID:      userID,
							Name:         booking.Address + " (待创建)",
							Address:      booking.Address,
							Status:       -1, // -1 代表待创建
							CurrentPhase: "待完善信息",
							Budget:       p.DesignFee + p.ConstructionFee + p.MaterialFee,
							ProviderID:   p.DesignerID,
						}

						// 插入到列表头部
						projects = append([]model.Project{pendingProject}, projects...)
						total++
					}
				}
			}
		}
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
	for i := range logs {
		logs[i].Photos = imgutil.NormalizeImageURLsJSON(logs[i].Photos)
	}

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
	for i := range logs {
		logs[i].Photos = imgutil.NormalizeImageURLsJSON(logs[i].Photos)
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

// GetProjectMilestones 获取项目验收节点
func (s *ProjectService) GetProjectMilestones(projectID uint64) ([]model.Milestone, error) {
	var milestones []model.Milestone
	if err := repository.DB.Where("project_id = ?", projectID).Order("seq ASC").Find(&milestones).Error; err != nil {
		return nil, err
	}
	return milestones, nil
}

func (s *ProjectService) ConfirmConstruction(projectID, userID uint64, req *ConfirmConstructionRequest) (*model.Project, error) {
	var updated model.Project

	err := repository.DB.Transaction(func(tx *gorm.DB) error {
		project, err := s.getOwnedProjectForUpdate(tx, projectID, userID)
		if err != nil {
			return err
		}
		if err := s.ensureProjectCanConfirmConstruction(tx, project); err != nil {
			return err
		}
		if err := s.ensureConstructionParticipants(tx, req.ConstructionProviderID, req.ForemanID); err != nil {
			return err
		}

		now := time.Now()
		updates := map[string]interface{}{
			"provider_id":               req.ConstructionProviderID,
			"construction_provider_id":  req.ConstructionProviderID,
			"foreman_id":                req.ForemanID,
			"construction_confirmed_at": now,
			"business_status":           model.ProjectBusinessStatusConstructionConfirmed,
			"current_phase":             "施工方已确认",
		}
		if err := tx.Model(project).Updates(updates).Error; err != nil {
			return err
		}

		return tx.First(&updated, projectID).Error
	})
	if err != nil {
		return nil, err
	}

	return &updated, nil
}

func (s *ProjectService) ConfirmConstructionQuote(projectID, userID uint64, req *ConfirmConstructionQuoteRequest) (*model.Project, error) {
	if req.ConstructionQuote <= 0 {
		return nil, errors.New("施工报价必须大于0")
	}

	var updated model.Project
	err := repository.DB.Transaction(func(tx *gorm.DB) error {
		project, err := s.getOwnedProjectForUpdate(tx, projectID, userID)
		if err != nil {
			return err
		}
		if project.BusinessStatus != model.ProjectBusinessStatusConstructionConfirmed &&
			project.BusinessStatus != model.ProjectBusinessStatusConstructionQuoteConfirmed {
			return errors.New("当前项目状态不允许确认施工报价")
		}
		if project.ConstructionProviderID == 0 || project.ForemanID == 0 {
			return errors.New("请先确认施工方和工长")
		}

		plannedStartDate := project.EntryStartDate
		if req.PlannedStartDate != "" {
			parsed, err := parseProjectDate(req.PlannedStartDate)
			if err != nil {
				return errors.New("计划开工日期格式错误")
			}
			plannedStartDate = parsed
		}
		if plannedStartDate == nil {
			return errors.New("计划开工日期不能为空")
		}

		var expectedEnd *time.Time
		if req.ExpectedEnd != "" {
			parsed, err := parseProjectDate(req.ExpectedEnd)
			if err != nil {
				return errors.New("预计完工日期格式错误")
			}
			expectedEnd = parsed
		}

		now := time.Now()
		updates := map[string]interface{}{
			"construction_quote": req.ConstructionQuote,
			"quote_confirmed_at": now,
			"entry_start_date":   *plannedStartDate,
			"business_status":    model.ProjectBusinessStatusConstructionQuoteConfirmed,
			"current_phase":      "待开工",
		}
		if req.MaterialMethod != "" {
			updates["material_method"] = req.MaterialMethod
		}
		if expectedEnd != nil {
			updates["expected_end"] = *expectedEnd
		}
		if err := tx.Model(project).Updates(updates).Error; err != nil {
			return err
		}
		if err := s.recalculateMilestoneAmounts(tx, projectID, req.ConstructionQuote); err != nil {
			return err
		}

		return tx.First(&updated, projectID).Error
	})
	if err != nil {
		return nil, err
	}

	return &updated, nil
}

func (s *ProjectService) StartProject(projectID, userID uint64, req *StartProjectRequest) (*model.Project, error) {
	var updated model.Project

	err := repository.DB.Transaction(func(tx *gorm.DB) error {
		project, err := s.getOwnedProjectForUpdate(tx, projectID, userID)
		if err != nil {
			return err
		}
		if project.BusinessStatus != model.ProjectBusinessStatusConstructionQuoteConfirmed {
			return errors.New("当前项目状态不允许开工")
		}
		if project.ConstructionProviderID == 0 || project.ForemanID == 0 || project.ConstructionQuote <= 0 {
			return errors.New("施工条件未确认完成，不能开工")
		}

		startedAt := time.Now()
		if req != nil && req.StartDate != "" {
			parsed, err := parseProjectDate(req.StartDate)
			if err != nil {
				return errors.New("开工日期格式错误")
			}
			startedAt = *parsed
		} else if project.EntryStartDate != nil {
			startedAt = *project.EntryStartDate
		}

		currentMilestoneName, err := s.activateCurrentMilestone(tx, projectID)
		if err != nil {
			return err
		}
		if err := s.activateFirstProjectPhase(tx, projectID, startedAt); err != nil {
			return err
		}

		currentPhase := "施工中"
		if currentMilestoneName != "" {
			currentPhase = currentMilestoneName + "施工中"
		}
		updates := map[string]interface{}{
			"status":          model.ProjectStatusActive,
			"business_status": model.ProjectBusinessStatusInProgress,
			"started_at":      startedAt,
			"start_date":      startedAt,
			"current_phase":   currentPhase,
		}
		if err := tx.Model(project).Updates(updates).Error; err != nil {
			return err
		}

		return tx.First(&updated, projectID).Error
	})
	if err != nil {
		return nil, err
	}

	return &updated, nil
}

func (s *ProjectService) SubmitMilestone(projectID, providerID, milestoneID uint64) (*model.Milestone, error) {
	if providerID == 0 {
		return nil, errors.New("无权提交当前节点")
	}

	var updated model.Milestone
	err := repository.DB.Transaction(func(tx *gorm.DB) error {
		var project model.Project
		if err := tx.First(&project, projectID).Error; err != nil {
			return errors.New("项目不存在")
		}
		if project.BusinessStatus != model.ProjectBusinessStatusInProgress {
			return errors.New("项目未开工，不能提交节点")
		}
		if !canProjectProviderOperate(&project, providerID) {
			return errors.New("无权提交当前节点")
		}

		var milestone model.Milestone
		if err := tx.Where("id = ? AND project_id = ?", milestoneID, projectID).First(&milestone).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return errors.New("验收节点不存在")
			}
			return err
		}
		if milestone.Status != model.MilestoneStatusInProgress {
			return errors.New("当前节点未进入可提交状态")
		}

		now := time.Now()
		if err := tx.Model(&milestone).Updates(map[string]interface{}{
			"status":       model.MilestoneStatusSubmitted,
			"submitted_at": now,
		}).Error; err != nil {
			return err
		}
		if err := tx.Model(&project).Updates(map[string]interface{}{
			"current_phase": milestone.Name + "待验收",
		}).Error; err != nil {
			return err
		}

		return tx.First(&updated, milestoneID).Error
	})
	if err != nil {
		return nil, err
	}

	return &updated, nil
}

// AcceptMilestone 业主验收项目节点
func (s *ProjectService) AcceptMilestone(projectID, userID, milestoneID uint64) (*model.Milestone, error) {
	var updated model.Milestone

	err := repository.DB.Transaction(func(tx *gorm.DB) error {
		project, err := s.getOwnedProjectForUpdate(tx, projectID, userID)
		if err != nil {
			return err
		}

		var milestone model.Milestone
		if err := tx.Where("id = ? AND project_id = ?", milestoneID, projectID).First(&milestone).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return errors.New("验收节点不存在")
			}
			return err
		}
		if milestone.Status == model.MilestoneStatusAccepted || milestone.Status == model.MilestoneStatusPaid {
			return errors.New("验收节点已处理")
		}
		if milestone.Status != model.MilestoneStatusSubmitted {
			return errors.New("请先提交节点完成，再进行验收")
		}

		now := time.Now()
		if err := tx.Model(&milestone).Updates(map[string]interface{}{
			"status":      model.MilestoneStatusAccepted,
			"accepted_at": now,
		}).Error; err != nil {
			return err
		}

		nextName, remaining, err := s.advanceMilestoneFlow(tx, projectID, milestone.Seq)
		if err != nil {
			return err
		}

		projectUpdates := map[string]interface{}{
			"status":          model.ProjectStatusActive,
			"business_status": model.ProjectBusinessStatusInProgress,
			"current_phase":   milestone.Name + "已验收",
		}
		if remaining == 0 {
			projectUpdates["status"] = model.ProjectStatusCompleted
			projectUpdates["business_status"] = model.ProjectBusinessStatusCompleted
			projectUpdates["current_phase"] = "已完工"
			projectUpdates["actual_end"] = now
		} else if nextName != "" {
			projectUpdates["current_phase"] = nextName + "施工中"
		}
		if err := tx.Model(project).Updates(projectUpdates).Error; err != nil {
			return err
		}

		return tx.First(&updated, milestoneID).Error
	})
	if err != nil {
		return nil, err
	}

	return &updated, nil
}

func (s *ProjectService) getOwnedProjectForUpdate(tx *gorm.DB, projectID, userID uint64) (*model.Project, error) {
	var project model.Project
	if err := tx.First(&project, projectID).Error; err != nil {
		return nil, errors.New("项目不存在")
	}
	if project.OwnerID != userID {
		return nil, errors.New("无权操作此项目")
	}
	return &project, nil
}

func (s *ProjectService) ensureProjectCanConfirmConstruction(tx *gorm.DB, project *model.Project) error {
	if project.BusinessStatus == model.ProjectBusinessStatusCompleted || project.BusinessStatus == model.ProjectBusinessStatusInProgress {
		return errors.New("项目当前阶段不允许重新确认施工方")
	}
	if project.BusinessStatus == model.ProjectBusinessStatusConstructionQuoteConfirmed {
		return errors.New("施工报价已确认，不能再修改施工方")
	}
	if project.ProposalID == 0 {
		return nil
	}

	var proposal model.Proposal
	if err := tx.First(&proposal, project.ProposalID).Error; err != nil {
		return errors.New("关联方案不存在")
	}
	if proposal.Status != model.ProposalStatusConfirmed {
		return errors.New("设计方案未确认，不能确认施工方")
	}
	return nil
}

func (s *ProjectService) ensureConstructionParticipants(tx *gorm.DB, constructionProviderID, foremanID uint64) error {
	var constructionProvider model.Provider
	if err := tx.First(&constructionProvider, constructionProviderID).Error; err != nil {
		return errors.New("施工方不存在")
	}

	var foreman model.Provider
	if err := tx.First(&foreman, foremanID).Error; err != nil {
		return errors.New("工长不存在")
	}
	if foreman.ProviderType != 3 {
		return errors.New("负责人必须为工长身份")
	}

	return nil
}

func (s *ProjectService) recalculateMilestoneAmounts(tx *gorm.DB, projectID uint64, total float64) error {
	var milestones []model.Milestone
	if err := tx.Where("project_id = ?", projectID).Find(&milestones).Error; err != nil {
		return err
	}
	for _, milestone := range milestones {
		amount := total * float64(milestone.Percentage) / 100
		if err := tx.Model(&model.Milestone{}).Where("id = ?", milestone.ID).Update("amount", amount).Error; err != nil {
			return err
		}
	}
	return nil
}

func (s *ProjectService) activateCurrentMilestone(tx *gorm.DB, projectID uint64) (string, error) {
	var active model.Milestone
	if err := tx.Where("project_id = ? AND status = ?", projectID, model.MilestoneStatusInProgress).
		Order("seq ASC").First(&active).Error; err == nil {
		return active.Name, nil
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return "", err
	}

	var next model.Milestone
	if err := tx.Where("project_id = ? AND status = ?", projectID, model.MilestoneStatusPending).
		Order("seq ASC").First(&next).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return "", nil
		}
		return "", err
	}
	if err := tx.Model(&next).Update("status", model.MilestoneStatusInProgress).Error; err != nil {
		return "", err
	}
	return next.Name, nil
}

func (s *ProjectService) activateFirstProjectPhase(tx *gorm.DB, projectID uint64, startedAt time.Time) error {
	var phase model.ProjectPhase
	if err := tx.Where("project_id = ? AND status = ?", projectID, "in_progress").
		Order("seq ASC").First(&phase).Error; err == nil {
		return nil
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}

	if err := tx.Where("project_id = ? AND status = ?", projectID, "pending").
		Order("seq ASC").First(&phase).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil
		}
		return err
	}

	return tx.Model(&phase).Updates(map[string]interface{}{
		"status":     "in_progress",
		"start_date": startedAt,
	}).Error
}

func (s *ProjectService) advanceMilestoneFlow(tx *gorm.DB, projectID uint64, acceptedSeq int8) (string, int64, error) {
	var next model.Milestone
	nextName := ""
	if err := tx.Where("project_id = ? AND seq > ? AND status = ?", projectID, acceptedSeq, model.MilestoneStatusPending).
		Order("seq ASC").First(&next).Error; err == nil {
		if err := tx.Model(&next).Update("status", model.MilestoneStatusInProgress).Error; err != nil {
			return "", 0, err
		}
		nextName = next.Name
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return "", 0, err
	}

	var remaining int64
	if err := tx.Model(&model.Milestone{}).
		Where("project_id = ? AND status NOT IN ?", projectID, []int8{model.MilestoneStatusAccepted, model.MilestoneStatusPaid}).
		Count(&remaining).Error; err != nil {
		return "", 0, err
	}

	return nextName, remaining, nil
}

func canProjectProviderOperate(project *model.Project, providerID uint64) bool {
	if providerID == 0 {
		return false
	}
	if project.ProviderID == providerID {
		return true
	}
	if project.ConstructionProviderID == providerID {
		return true
	}
	if project.ForemanID == providerID {
		return true
	}
	return false
}

func parseProjectDate(value string) (*time.Time, error) {
	if value == "" {
		return nil, nil
	}
	parsed, err := time.Parse("2006-01-02", value)
	if err != nil {
		return nil, err
	}
	return &parsed, nil
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
