package service

import (
	"errors"
	"strconv"
	"strings"
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
	OwnerName                      string                   `json:"ownerName"`
	ProviderName                   string                   `json:"providerName"`
	ProviderAvatar                 string                   `json:"providerAvatar"`
	ProviderPhone                  string                   `json:"providerPhone"`
	ProviderType                   int8                     `json:"providerType"`
	DesignerName                   string                   `json:"designerName"`
	DesignerAvatar                 string                   `json:"designerAvatar"`
	DesignerPhone                  string                   `json:"designerPhone"`
	RiskSummary                    *ProjectRiskSummary      `json:"riskSummary,omitempty"`
	Phases                         []ProjectPhaseView       `json:"phases,omitempty"`
	Milestones                     []model.Milestone        `json:"milestones"`
	RecentLogs                     []model.WorkLog          `json:"recentLogs"`
	EscrowBalance                  float64                  `json:"escrowBalance"`
	BusinessStage                  string                   `json:"businessStage"`
	FlowSummary                    string                   `json:"flowSummary"`
	AvailableActions               []string                 `json:"availableActions"`
	BaselineStatus                 string                   `json:"baselineStatus"`
	BaselineSubmittedAt            *time.Time               `json:"baselineSubmittedAt,omitempty"`
	ConstructionSubjectType        string                   `json:"constructionSubjectType"`
	ConstructionSubjectID          uint64                   `json:"constructionSubjectId,omitempty"`
	ConstructionSubjectDisplayName string                   `json:"constructionSubjectDisplayName,omitempty"`
	KickoffStatus                  string                   `json:"kickoffStatus"`
	PlannedStartDate               *time.Time               `json:"plannedStartDate,omitempty"`
	SupervisorSummary              *BridgeSupervisorSummary `json:"supervisorSummary,omitempty"`
	BridgeConversionSummary        *BridgeConversionSummary `json:"bridgeConversionSummary,omitempty"`
	ClosureSummary                 *ProjectClosureSummary   `json:"closureSummary,omitempty"`
	SelectedQuoteTaskID            uint64                   `json:"selectedQuoteTaskId"`
	SelectedForemanProviderID      uint64                   `json:"selectedForemanProviderId"`
	SelectedQuoteSubmissionID      uint64                   `json:"selectedQuoteSubmissionId"`
	InspirationCaseDraftID         uint64                   `json:"inspirationCaseDraftId"`
	CompletedPhotos                []string                 `json:"completedPhotos"`
	CompletionNotes                string                   `json:"completionNotes"`
	CompletionSubmittedAt          *time.Time               `json:"completionSubmittedAt,omitempty"`
	CompletionRejectionReason      string                   `json:"completionRejectionReason,omitempty"`
	CompletionRejectedAt           *time.Time               `json:"completionRejectedAt,omitempty"`
	PaymentPlans                   []model.PaymentPlan      `json:"paymentPlans,omitempty"`
	NextPayablePlan                *model.PaymentPlan       `json:"nextPayablePlan,omitempty"`
	ChangeOrders                   []ChangeOrderView        `json:"changeOrders,omitempty"`
}

type ProjectRiskSummary struct {
	PausedAt        *time.Time `json:"pausedAt,omitempty"`
	ResumedAt       *time.Time `json:"resumedAt,omitempty"`
	PauseReason     string     `json:"pauseReason,omitempty"`
	PauseInitiator  string     `json:"pauseInitiator,omitempty"`
	DisputedAt      *time.Time `json:"disputedAt,omitempty"`
	DisputeReason   string     `json:"disputeReason,omitempty"`
	DisputeEvidence []string   `json:"disputeEvidence,omitempty"`
	AuditID         uint64     `json:"auditId,omitempty"`
	AuditStatus     string     `json:"auditStatus,omitempty"`
	EscrowFrozen    bool       `json:"escrowFrozen"`
	EscrowStatus    int8       `json:"escrowStatus,omitempty"`
	FrozenAmount    float64    `json:"frozenAmount,omitempty"`
}

type MerchantProjectListItem struct {
	ID            uint64  `json:"id"`
	Name          string  `json:"name"`
	OwnerName     string  `json:"ownerName"`
	ProviderName  string  `json:"providerName"`
	CurrentPhase  string  `json:"currentPhase"`
	Status        int8    `json:"status"`
	Budget        float64 `json:"budget"`
	BusinessStage string  `json:"businessStage"`
	FlowSummary   string  `json:"flowSummary"`
}

type MerchantProjectListQuery struct {
	Keyword       string
	BusinessStage string
	Page          int
	PageSize      int
}

type ConfirmConstructionRequest struct {
	ConstructionProviderID uint64 `json:"constructionProviderId"`
	ForemanID              uint64 `json:"foremanId"`
	Reason                 string `json:"reason"`
}

type ConfirmConstructionQuoteRequest struct {
	ConstructionQuote float64 `json:"constructionQuote" binding:"required"`
	MaterialMethod    string  `json:"materialMethod"`
	PlannedStartDate  string  `json:"plannedStartDate"`
	ExpectedEnd       string  `json:"expectedEnd"`
	Reason            string  `json:"reason"`
}

type StartProjectRequest struct {
	StartDate string `json:"startDate"`
	Reason    string `json:"reason"`
}

type CreateWorkLogRequest struct {
	PhaseID     uint64 `json:"phaseId"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Photos      string `json:"photos"`
	LogDate     string `json:"logDate"`
}

type ProjectPhaseView struct {
	model.ProjectPhase
	Name string `json:"name"`
}

var projectPhaseNameMap = map[string]string{
	"preparation":  "开工准备",
	"demolition":   "拆改阶段",
	"electrical":   "水电阶段",
	"masonry":      "泥木阶段",
	"painting":     "油漆阶段",
	"installation": "安装阶段",
	"inspection":   "竣工验收",
}

func GetProjectPhaseDisplayName(phaseType string) string {
	normalized := strings.TrimSpace(strings.ToLower(phaseType))
	if name, ok := projectPhaseNameMap[normalized]; ok {
		return name
	}
	if normalized != "" {
		return normalized
	}
	return "施工阶段"
}

func buildProjectPhaseViews(phases []model.ProjectPhase) []ProjectPhaseView {
	result := make([]ProjectPhaseView, 0, len(phases))
	for _, phase := range phases {
		result = append(result, ProjectPhaseView{
			ProjectPhase: phase,
			Name:         GetProjectPhaseDisplayName(phase.PhaseType),
		})
	}
	return result
}

// CreateProject 创建项目
func (s *ProjectService) CreateProject(req *CreateProjectRequest) (*model.Project, error) {
	if req == nil {
		return nil, errors.New("参数不能为空")
	}

	var project *model.Project
	err := repository.DB.Transaction(func(tx *gorm.DB) error {
		created, err := s.CreateProjectTx(tx, req)
		if err != nil {
			return err
		}
		project = created
		return nil
	})
	if err != nil {
		return nil, err
	}

	return project, nil
}

func (s *ProjectService) CreateProjectTx(tx *gorm.DB, req *CreateProjectRequest) (*model.Project, error) {
	if tx == nil {
		return nil, errors.New("事务不能为空")
	}
	if req == nil {
		return nil, errors.New("参数不能为空")
	}

	project := &model.Project{
		OwnerID:                 req.OwnerID,
		Status:                  model.ProjectStatusActive,
		CurrentPhase:            "准备阶段",
		BusinessStatus:          model.ProjectBusinessStatusDraft,
		MaterialMethod:          req.MaterialMethod,
		CrewID:                  req.CrewID,
		ConstructionPaymentMode: (&ConfigService{}).GetConstructionPaymentMode(),
	}

	// 如果是从方案创建
	if req.ProposalID > 0 {
		var proposal model.Proposal
		if err := tx.First(&proposal, req.ProposalID).Error; err != nil {
			return nil, errors.New("方案不存在")
		}

		var booking model.Booking
		if err := tx.First(&booking, proposal.BookingID).Error; err != nil {
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
	if err := tx.First(&provider, project.ProviderID).Error; err != nil {
		return nil, errors.New("服务商不存在")
	}
	plainAddress := project.Address
	plainLatitude := project.Latitude
	plainLongitude := project.Longitude

	if err := encryptProjectSensitiveFields(project); err != nil {
		return nil, err
	}

	if err := tx.Create(project).Error; err != nil {
		return nil, err
	}

	escrow := &model.EscrowAccount{
		ProjectID: project.ID,
		Status:    escrowStatusActive,
	}
	if err := tx.Create(escrow).Error; err != nil {
		return nil, err
	}

	if err := s.InitProjectPhases(tx, project.ID); err != nil {
		return nil, err
	}
	if err := s.InitProjectMilestones(tx, project.ID, project.Budget); err != nil {
		return nil, err
	}

	project.Address = plainAddress
	project.Latitude = plainLatitude
	project.Longitude = plainLongitude

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
						var ownerProjects []model.Project
						if err := repository.DB.Where("owner_id = ?", userID).Find(&ownerProjects).Error; err == nil {
							for _, ownerProject := range ownerProjects {
								if ownerProject.Address == booking.Address {
									exists = true
									break
								}
							}
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
	project, err := s.getProjectByID(id)
	if err != nil {
		return nil, err
	}

	// 获取关联信息
	var owner model.User
	repository.DB.Select("nickname").First(&owner, project.OwnerID)

	providerProfile := loadProjectParticipantProfile(repository.DB, project.ProviderID)
	designerProfile := loadProjectParticipantProfile(repository.DB, resolveProjectDesignerProviderID(repository.DB, project))

	var milestones []model.Milestone
	repository.DB.Where("project_id = ?", id).Order("seq ASC").Find(&milestones)
	phases, err := s.GetProjectPhaseViews(id)
	if err != nil {
		return nil, err
	}

	var logs []model.WorkLog
	repository.DB.Where("project_id = ?", id).Order("log_date DESC").Limit(5).Find(&logs)
	for i := range logs {
		logs[i].Photos = imgutil.NormalizeImageURLsJSON(logs[i].Photos)
	}

	var escrow model.EscrowAccount
	repository.DB.Where("project_id = ?", id).First(&escrow)
	changeOrders, err := (&ChangeOrderService{}).listByProject(id)
	if err != nil {
		return nil, err
	}
	orderService := &OrderService{}
	var paymentPlans []model.PaymentPlan
	var nextPayablePlan *model.PaymentPlan
	var constructionOrder model.Order
	if err := repository.DB.Where("project_id = ? AND order_type = ?", id, model.OrderTypeConstruction).Order("id DESC").First(&constructionOrder).Error; err == nil {
		paymentPlans, err = orderService.GetPaymentPlansByOrder(constructionOrder.ID)
		if err != nil {
			return nil, err
		}
		for idx := range paymentPlans {
			if nextPayablePlan == nil && paymentPlans[idx].Payable {
				copyPlan := paymentPlans[idx]
				nextPayablePlan = &copyPlan
			}
		}
	}

	flowSummary := s.resolveProjectFlowSummary(project, milestones)
	completedPhotos, err := parseProjectImageJSONArray(project.CompletedPhotos)
	if err != nil {
		return nil, err
	}
	completedPhotos = imgutil.GetFullImageURLs(completedPhotos)
	riskSummary := s.buildProjectRiskSummary(project)
	bridgeSummary := BuildBridgeReadModelByProject(project)
	conversionSummary := BuildBridgeConversionSummaryByProject(project)
	closureSummary := BuildProjectClosureSummary(project)

	return &ProjectDetail{
		Project:                        *project,
		OwnerName:                      owner.Nickname,
		ProviderName:                   providerProfile.Name,
		ProviderAvatar:                 providerProfile.Avatar,
		ProviderPhone:                  providerProfile.Phone,
		ProviderType:                   providerProfile.ProviderType,
		DesignerName:                   designerProfile.Name,
		DesignerAvatar:                 designerProfile.Avatar,
		DesignerPhone:                  designerProfile.Phone,
		RiskSummary:                    riskSummary,
		Phases:                         phases,
		Milestones:                     milestones,
		RecentLogs:                     logs,
		EscrowBalance:                  escrow.TotalAmount - escrow.ReleasedAmount,
		BusinessStage:                  flowSummary.CurrentStage,
		FlowSummary:                    flowSummary.FlowSummary,
		AvailableActions:               flowSummary.AvailableActions,
		BaselineStatus:                 bridgeSummary.BaselineStatus,
		BaselineSubmittedAt:            bridgeSummary.BaselineSubmittedAt,
		ConstructionSubjectType:        bridgeSummary.ConstructionSubjectType,
		ConstructionSubjectID:          bridgeSummary.ConstructionSubjectID,
		ConstructionSubjectDisplayName: bridgeSummary.ConstructionSubjectDisplayName,
		KickoffStatus:                  bridgeSummary.KickoffStatus,
		PlannedStartDate:               bridgeSummary.PlannedStartDate,
		SupervisorSummary:              bridgeSummary.SupervisorSummary,
		BridgeConversionSummary:        conversionSummary,
		ClosureSummary:                 closureSummary,
		SelectedQuoteTaskID:            flowSummary.SelectedQuoteTaskID,
		SelectedForemanProviderID:      flowSummary.SelectedForemanProviderID,
		SelectedQuoteSubmissionID:      flowSummary.SelectedQuoteSubmissionID,
		InspirationCaseDraftID:         flowSummary.InspirationCaseDraftID,
		CompletedPhotos:                completedPhotos,
		CompletionNotes:                project.CompletionNotes,
		CompletionSubmittedAt:          project.CompletionSubmittedAt,
		CompletionRejectionReason:      project.CompletionRejectionReason,
		CompletionRejectedAt:           project.CompletionRejectedAt,
		PaymentPlans:                   paymentPlans,
		NextPayablePlan:                nextPayablePlan,
		ChangeOrders:                   changeOrders,
	}, nil
}

type projectParticipantProfile struct {
	ProviderID   uint64
	Name         string
	Avatar       string
	Phone        string
	ProviderType int8
}

func loadProjectParticipantProfile(db *gorm.DB, providerID uint64) projectParticipantProfile {
	if db == nil || providerID == 0 {
		return projectParticipantProfile{}
	}

	var provider model.Provider
	if err := db.Select("id", "user_id", "company_name", "provider_type", "avatar").First(&provider, providerID).Error; err != nil {
		return projectParticipantProfile{}
	}

	var providerUser model.User
	var providerUserRef *model.User
	if provider.UserID > 0 {
		if err := db.Select("nickname", "phone", "avatar").First(&providerUser, provider.UserID).Error; err == nil {
			providerUserRef = &providerUser
		}
	}

	avatar := imgutil.GetFullImageURL(ResolveProviderAvatarPathWithUser(provider, providerUserRef))

	return projectParticipantProfile{
		ProviderID:   provider.ID,
		Name:         ResolveProviderDisplayName(provider, providerUserRef),
		Avatar:       avatar,
		Phone:        providerUser.Phone,
		ProviderType: provider.ProviderType,
	}
}

func resolveProjectDesignerProviderID(db *gorm.DB, project *model.Project) uint64 {
	if db == nil || project == nil {
		return 0
	}
	if project.ProposalID > 0 {
		var proposal model.Proposal
		if err := db.Select("designer_id").First(&proposal, project.ProposalID).Error; err == nil && proposal.DesignerID > 0 {
			return proposal.DesignerID
		}
	}
	if flow, err := businessFlowSvc.GetByProjectIDTx(db, project.ID); err == nil && flow != nil && flow.DesignerProviderID > 0 {
		return flow.DesignerProviderID
	}
	if project.ConstructionProviderID == 0 && project.ForemanID == 0 {
		return project.ProviderID
	}
	return 0
}

func (s *ProjectService) buildProjectRiskSummary(project *model.Project) *ProjectRiskSummary {
	if project == nil {
		return nil
	}

	summary := &ProjectRiskSummary{
		PausedAt:        project.PausedAt,
		ResumedAt:       project.ResumedAt,
		PauseReason:     project.PauseReason,
		PauseInitiator:  project.PauseInitiator,
		DisputedAt:      project.DisputedAt,
		DisputeReason:   project.DisputeReason,
		DisputeEvidence: ParseStringList(project.DisputeEvidence),
	}

	var audit model.ProjectAudit
	if err := repository.DB.
		Where("project_id = ?", project.ID).
		Order("id DESC").
		First(&audit).Error; err == nil {
		summary.AuditID = audit.ID
		summary.AuditStatus = audit.Status
	}

	var escrow model.EscrowAccount
	if err := repository.DB.
		Where("project_id = ?", project.ID).
		First(&escrow).Error; err == nil {
		summary.EscrowStatus = escrow.Status
		summary.FrozenAmount = escrow.FrozenAmount
		summary.EscrowFrozen = escrow.Status == escrowStatusFrozen || escrow.FrozenAmount > 0
	}

	return summary
}

func (s *ProjectService) GetProjectDetailForOwner(projectID, userID uint64) (*ProjectDetail, error) {
	if _, err := s.getOwnedProject(projectID, userID); err != nil {
		return nil, err
	}
	return s.GetProjectDetail(projectID)
}

func (s *ProjectService) GetProjectDetailForProvider(projectID, providerID uint64) (*ProjectDetail, error) {
	if _, err := s.getProviderProject(projectID, providerID); err != nil {
		return nil, err
	}
	return s.GetProjectDetail(projectID)
}

func (s *ProjectService) GetMerchantProjectDetail(projectID, providerID uint64) (*ProjectDetail, error) {
	return s.GetProjectDetailForProvider(projectID, providerID)
}

func (s *ProjectService) ListMerchantProjects(providerID uint64, query *MerchantProjectListQuery) ([]MerchantProjectListItem, int64, error) {
	if providerID == 0 {
		return nil, 0, errors.New("无权访问项目列表")
	}

	var projects []model.Project
	if err := repository.DB.
		Where("provider_id = ? OR construction_provider_id = ? OR foreman_id = ?", providerID, providerID, providerID).
		Order("updated_at DESC").
		Find(&projects).Error; err != nil {
		return nil, 0, err
	}

	keyword := ""
	stage := ""
	page := 1
	pageSize := 10
	if query != nil {
		keyword = strings.ToLower(strings.TrimSpace(query.Keyword))
		if rawStage := strings.TrimSpace(query.BusinessStage); rawStage != "" {
			stage = model.NormalizeBusinessFlowStage(rawStage)
		}
		if query.Page > 0 {
			page = query.Page
		}
		if query.PageSize > 0 {
			pageSize = query.PageSize
		}
	}

	filtered := make([]MerchantProjectListItem, 0, len(projects))
	for _, project := range projects {
		var owner model.User
		_ = repository.DB.Select("nickname").First(&owner, project.OwnerID).Error

		var provider model.Provider
		_ = repository.DB.Select("id", "user_id", "company_name").First(&provider, project.ProviderID).Error
		var providerUser model.User
		if provider.UserID > 0 {
			_ = repository.DB.Select("nickname", "phone").First(&providerUser, provider.UserID).Error
		}

		var milestones []model.Milestone
		_ = repository.DB.Where("project_id = ?", project.ID).Order("seq ASC").Find(&milestones).Error
		flowSummary := s.resolveProjectFlowSummary(&project, milestones)

		item := MerchantProjectListItem{
			ID:        project.ID,
			Name:      project.Name,
			OwnerName: owner.Nickname,
			ProviderName: ResolveProviderDisplayName(provider, func() *model.User {
				if provider.UserID > 0 {
					return &providerUser
				}
				return nil
			}()),
			CurrentPhase:  project.CurrentPhase,
			Status:        project.Status,
			Budget:        project.Budget,
			BusinessStage: flowSummary.CurrentStage,
			FlowSummary:   flowSummary.FlowSummary,
		}

		if stage != "" && model.NormalizeBusinessFlowStage(item.BusinessStage) != stage {
			continue
		}
		if keyword != "" &&
			!strings.Contains(strings.ToLower(item.Name), keyword) &&
			!strings.Contains(strings.ToLower(item.OwnerName), keyword) &&
			!strings.Contains(strings.ToLower(item.ProviderName), keyword) &&
			!strings.Contains(strings.ToLower(item.CurrentPhase), keyword) &&
			!strings.Contains(strings.ToLower(item.FlowSummary), keyword) &&
			!strings.Contains(strings.ToLower(item.BusinessStage), keyword) &&
			!strings.Contains(strconv.FormatUint(item.ID, 10), keyword) {
			continue
		}

		filtered = append(filtered, item)
	}

	total := int64(len(filtered))
	start := (page - 1) * pageSize
	if start >= len(filtered) {
		return []MerchantProjectListItem{}, total, nil
	}
	end := start + pageSize
	if end > len(filtered) {
		end = len(filtered)
	}

	return filtered[start:end], total, nil
}

func (s *ProjectService) CreateMerchantProjectLog(projectID, providerID uint64, req *CreateWorkLogRequest) error {
	return s.CreateWorkLogForProvider(projectID, providerID, req)
}

// CreateWorkLog 创建施工日志
func (s *ProjectService) CreateWorkLog(projectID, workerID uint64, req *CreateWorkLogRequest) error {
	_, err := s.createWorkLog(projectID, workerID, 0, req)
	return err
}

func (s *ProjectService) CreateWorkLogForProvider(projectID, providerID uint64, req *CreateWorkLogRequest) error {
	if _, err := s.getProviderProject(projectID, providerID); err != nil {
		return err
	}
	_, err := s.createWorkLog(projectID, providerID, 0, req)
	return err
}

func (s *ProjectService) CreateAdminWorkLog(projectID, adminID uint64, req *CreateWorkLogRequest) (*model.WorkLog, error) {
	return s.createWorkLog(projectID, 0, adminID, req)
}

func (s *ProjectService) createWorkLog(projectID, workerID, adminID uint64, req *CreateWorkLogRequest) (*model.WorkLog, error) {
	if req == nil {
		req = &CreateWorkLogRequest{}
	}
	var project model.Project
	if err := repository.DB.First(&project, projectID).Error; err != nil {
		return nil, errors.New("项目不存在")
	}
	if err := ensureProjectExecutionAllowed(&project, "创建施工日志"); err != nil {
		return nil, err
	}
	phaseID := req.PhaseID
	if phaseID == 0 {
		return nil, errors.New("请选择所属施工阶段")
	}
	var phase model.ProjectPhase
	if err := repository.DB.Where("id = ? AND project_id = ?", phaseID, projectID).First(&phase).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("施工阶段不存在")
		}
		return nil, err
	}
	logDate := time.Now()
	if strings.TrimSpace(req.LogDate) != "" {
		parsed, err := time.Parse("2006-01-02", strings.TrimSpace(req.LogDate))
		if err != nil {
			return nil, errors.New("日志日期格式错误")
		}
		logDate = parsed
	}
	log := &model.WorkLog{
		ProjectID:   projectID,
		PhaseID:     phaseID,
		WorkerID:    workerID,
		CreatedBy:   adminID,
		Title:       strings.TrimSpace(req.Title),
		LogDate:     logDate,
		Description: strings.TrimSpace(req.Description),
		Photos:      normalizeStoredAssetJSONArray(strings.TrimSpace(req.Photos)),
		Issues:      "[]",
	}
	if log.Photos == "" {
		log.Photos = "[]"
	}
	// 简单模拟AI分析
	log.AIAnalysis = `{"status": "normal", "detect": ["wall", "pipe"]}`

	if err := repository.DB.Create(log).Error; err != nil {
		return nil, err
	}

	return log, nil
}

// GetProjectLogs 获取项目日志
func (s *ProjectService) GetProjectLogs(projectID uint64, page, pageSize int, phaseIDs ...uint64) ([]model.WorkLog, int64, error) {
	var logs []model.WorkLog
	var total int64

	db := repository.DB.Model(&model.WorkLog{}).Where("project_id = ?", projectID)
	if len(phaseIDs) > 0 && phaseIDs[0] > 0 {
		db = db.Where("phase_id = ?", phaseIDs[0])
	}
	db.Count(&total)

	offset := (page - 1) * pageSize
	if err := db.Order("log_date DESC, created_at DESC").Offset(offset).Limit(pageSize).Find(&logs).Error; err != nil {
		return nil, 0, err
	}
	for i := range logs {
		logs[i].Photos = imgutil.NormalizeImageURLsJSON(logs[i].Photos)
	}

	return logs, total, nil
}

func (s *ProjectService) GetProjectLogsForOwner(projectID, userID uint64, page, pageSize int) ([]model.WorkLog, int64, error) {
	if _, err := s.getOwnedProject(projectID, userID); err != nil {
		return nil, 0, err
	}
	return s.GetProjectLogs(projectID, page, pageSize)
}

func (s *ProjectService) GetProjectLogsForProvider(projectID, providerID uint64, page, pageSize int) ([]model.WorkLog, int64, error) {
	if _, err := s.getProviderProject(projectID, providerID); err != nil {
		return nil, 0, err
	}
	return s.GetProjectLogs(projectID, page, pageSize)
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

func (s *ProjectService) GetProjectPhaseViews(projectID uint64) ([]ProjectPhaseView, error) {
	phases, err := s.GetProjectPhases(projectID)
	if err != nil {
		return nil, err
	}
	return buildProjectPhaseViews(phases), nil
}

func (s *ProjectService) GetProjectPhasesForOwner(projectID, userID uint64) ([]model.ProjectPhase, error) {
	if _, err := s.getOwnedProject(projectID, userID); err != nil {
		return nil, err
	}
	return s.GetProjectPhases(projectID)
}

func (s *ProjectService) GetProjectPhaseViewsForOwner(projectID, userID uint64) ([]ProjectPhaseView, error) {
	if _, err := s.getOwnedProject(projectID, userID); err != nil {
		return nil, err
	}
	return s.GetProjectPhaseViews(projectID)
}

func (s *ProjectService) GetProjectPhasesForProvider(projectID, providerID uint64) ([]model.ProjectPhase, error) {
	if _, err := s.getProviderProject(projectID, providerID); err != nil {
		return nil, err
	}
	return s.GetProjectPhases(projectID)
}

func (s *ProjectService) GetProjectPhaseViewsForProvider(projectID, providerID uint64) ([]ProjectPhaseView, error) {
	if _, err := s.getProviderProject(projectID, providerID); err != nil {
		return nil, err
	}
	return s.GetProjectPhaseViews(projectID)
}

// GetProjectMilestones 获取项目验收节点
func (s *ProjectService) GetProjectMilestones(projectID uint64) ([]model.Milestone, error) {
	var milestones []model.Milestone
	if err := repository.DB.Where("project_id = ?", projectID).Order("seq ASC").Find(&milestones).Error; err != nil {
		return nil, err
	}
	return milestones, nil
}

func (s *ProjectService) GetProjectMilestonesForOwner(projectID, userID uint64) ([]model.Milestone, error) {
	if _, err := s.getOwnedProject(projectID, userID); err != nil {
		return nil, err
	}
	return s.GetProjectMilestones(projectID)
}

func (s *ProjectService) GetProjectMilestonesForProvider(projectID, providerID uint64) ([]model.Milestone, error) {
	if _, err := s.getProviderProject(projectID, providerID); err != nil {
		return nil, err
	}
	return s.GetProjectMilestones(projectID)
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
		selectedPartyID, err := s.ensureConstructionParticipants(tx, req.ConstructionProviderID, req.ForemanID)
		if err != nil {
			return err
		}

		now := time.Now()
		updates := map[string]interface{}{
			"provider_id":               selectedPartyID,
			"construction_provider_id":  req.ConstructionProviderID,
			"foreman_id":                req.ForemanID,
			"construction_confirmed_at": now,
			"business_status":           model.ProjectBusinessStatusConstructionConfirmed,
			"current_phase":             "施工方已确认",
		}
		if err := tx.Model(project).Updates(updates).Error; err != nil {
			return err
		}
		if err := businessFlowSvc.AdvanceByProject(tx, projectID, map[string]interface{}{
			"current_stage":                model.BusinessFlowStageConstructorPending,
			"selected_foreman_provider_id": selectedPartyID,
			"project_id":                   projectID,
		}); err != nil {
			return err
		}

		return tx.First(&updated, projectID).Error
	})
	if err != nil {
		return nil, err
	}

	return &updated, nil
}

func (s *ProjectService) AdminConfirmConstruction(projectID, adminID uint64, req *ConfirmConstructionRequest) (*model.Project, error) {
	reason := strings.TrimSpace(req.Reason)
	if reason == "" {
		return nil, errors.New("请填写操作原因")
	}
	var updated model.Project
	auditService := &AuditLogService{}

	err := repository.DB.Transaction(func(tx *gorm.DB) error {
		project, err := s.getProjectForUpdate(tx, projectID)
		if err != nil {
			return err
		}
		if err := s.ensureProjectCanConfirmConstruction(tx, project); err != nil {
			return err
		}
		selectedPartyID, err := s.ensureConstructionParticipants(tx, req.ConstructionProviderID, req.ForemanID)
		if err != nil {
			return err
		}
		beforeState := map[string]interface{}{
			"project": map[string]interface{}{
				"id":                     project.ID,
				"providerId":             project.ProviderID,
				"constructionProviderId": project.ConstructionProviderID,
				"foremanId":              project.ForemanID,
				"businessStatus":         project.BusinessStatus,
				"currentPhase":           project.CurrentPhase,
			},
		}

		now := time.Now()
		updates := map[string]interface{}{
			"provider_id":               selectedPartyID,
			"construction_provider_id":  req.ConstructionProviderID,
			"foreman_id":                req.ForemanID,
			"construction_confirmed_at": now,
			"business_status":           model.ProjectBusinessStatusConstructionConfirmed,
			"current_phase":             "施工方已确认",
		}
		if err := tx.Model(project).Updates(updates).Error; err != nil {
			return err
		}
		if err := businessFlowSvc.AdvanceByProject(tx, projectID, map[string]interface{}{
			"current_stage":                model.BusinessFlowStageConstructorPending,
			"selected_foreman_provider_id": selectedPartyID,
			"project_id":                   projectID,
		}); err != nil {
			return err
		}
		if err := auditService.CreateBusinessRecordTx(tx, &CreateAuditRecordInput{
			OperatorType:  "admin",
			OperatorID:    adminID,
			OperationType: "confirm_construction",
			ResourceType:  "project",
			ResourceID:    project.ID,
			Reason:        reason,
			Result:        "success",
			BeforeState:   beforeState,
			AfterState: map[string]interface{}{
				"project": map[string]interface{}{
					"id":                      project.ID,
					"providerId":              selectedPartyID,
					"constructionProviderId":  req.ConstructionProviderID,
					"foremanId":               req.ForemanID,
					"businessStatus":          model.ProjectBusinessStatusConstructionConfirmed,
					"currentPhase":            "施工方已确认",
					"constructionConfirmedAt": now,
				},
			},
			Metadata: map[string]interface{}{
				"selectedPartyId":        selectedPartyID,
				"constructionProviderId": req.ConstructionProviderID,
				"foremanId":              req.ForemanID,
			},
		}); err != nil {
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
	auditService := &AuditLogService{}
	err := repository.DB.Transaction(func(tx *gorm.DB) error {
		project, err := s.getOwnedProjectForUpdate(tx, projectID, userID)
		if err != nil {
			return err
		}
		if project.BusinessStatus != model.ProjectBusinessStatusConstructionConfirmed &&
			project.BusinessStatus != model.ProjectBusinessStatusConstructionQuoteConfirmed {
			return errors.New("当前项目状态不允许确认施工报价")
		}
		if !hasConfirmedConstructionParty(project) {
			return errors.New("请先确认施工主体")
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
		beforeState := map[string]interface{}{
			"project": map[string]interface{}{
				"id":                project.ID,
				"businessStatus":    project.BusinessStatus,
				"currentPhase":      project.CurrentPhase,
				"constructionQuote": project.ConstructionQuote,
			},
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
			"current_phase":      "待监理协调开工",
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
		if err := businessFlowSvc.AdvanceByProject(tx, projectID, map[string]interface{}{
			"current_stage": model.BusinessFlowStageReadyToStart,
		}); err != nil {
			return err
		}
		if err := auditService.CreateBusinessRecordTx(tx, &CreateAuditRecordInput{
			OperatorType:  "user",
			OperatorID:    userID,
			OperationType: "confirm_construction_quote",
			ResourceType:  "project",
			ResourceID:    project.ID,
			Result:        "success",
			BeforeState:   beforeState,
			AfterState: map[string]interface{}{
				"project": map[string]interface{}{
					"id":                project.ID,
					"businessStatus":    model.ProjectBusinessStatusConstructionQuoteConfirmed,
					"currentPhase":      "待监理协调开工",
					"constructionQuote": req.ConstructionQuote,
					"quoteConfirmedAt":  now,
				},
			},
			Metadata: map[string]interface{}{
				"plannedStartDate": plannedStartDate,
				"expectedEnd":      expectedEnd,
				"materialMethod":   req.MaterialMethod,
			},
		}); err != nil {
			return err
		}

		return tx.First(&updated, projectID).Error
	})
	if err != nil {
		return nil, err
	}

	providerID := updated.ConstructionProviderID
	if providerID == 0 {
		providerID = updated.ForemanID
	}
	if providerUserID := providerUserIDFromProvider(providerID); providerUserID > 0 {
		NewNotificationDispatcher().NotifyProjectConstructionQuoteAwarded(providerUserID, updated.ID)
	}
	NewNotificationDispatcher().NotifyPlannedStartDateUpdated(updated.OwnerID, providerUserIDFromProvider(providerID), updated.ID, updated.EntryStartDate)
	return &updated, nil
}

func (s *ProjectService) AdminConfirmConstructionQuote(projectID, adminID uint64, req *ConfirmConstructionQuoteRequest) (*model.Project, error) {
	if req.ConstructionQuote <= 0 {
		return nil, errors.New("施工报价必须大于0")
	}
	reason := strings.TrimSpace(req.Reason)
	if reason == "" {
		return nil, errors.New("请填写操作原因")
	}

	var updated model.Project
	auditService := &AuditLogService{}
	err := repository.DB.Transaction(func(tx *gorm.DB) error {
		project, err := s.getProjectForUpdate(tx, projectID)
		if err != nil {
			return err
		}
		if project.BusinessStatus != model.ProjectBusinessStatusConstructionConfirmed &&
			project.BusinessStatus != model.ProjectBusinessStatusConstructionQuoteConfirmed {
			return errors.New("当前项目状态不允许确认施工报价")
		}
		if !hasConfirmedConstructionParty(project) {
			return errors.New("请先确认施工主体")
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
		beforeState := map[string]interface{}{
			"project": map[string]interface{}{
				"id":                project.ID,
				"businessStatus":    project.BusinessStatus,
				"currentPhase":      project.CurrentPhase,
				"constructionQuote": project.ConstructionQuote,
			},
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
			"current_phase":      "待监理协调开工",
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
		if err := businessFlowSvc.AdvanceByProject(tx, projectID, map[string]interface{}{
			"current_stage": model.BusinessFlowStageReadyToStart,
		}); err != nil {
			return err
		}
		if err := auditService.CreateBusinessRecordTx(tx, &CreateAuditRecordInput{
			OperatorType:  "admin",
			OperatorID:    adminID,
			OperationType: "confirm_construction_quote",
			ResourceType:  "project",
			ResourceID:    project.ID,
			Reason:        reason,
			Result:        "success",
			BeforeState:   beforeState,
			AfterState: map[string]interface{}{
				"project": map[string]interface{}{
					"id":                project.ID,
					"businessStatus":    model.ProjectBusinessStatusConstructionQuoteConfirmed,
					"currentPhase":      "待监理协调开工",
					"constructionQuote": req.ConstructionQuote,
					"quoteConfirmedAt":  now,
				},
			},
			Metadata: map[string]interface{}{
				"plannedStartDate": plannedStartDate,
				"expectedEnd":      expectedEnd,
				"materialMethod":   req.MaterialMethod,
			},
		}); err != nil {
			return err
		}

		return tx.First(&updated, projectID).Error
	})
	if err != nil {
		return nil, err
	}

	providerID := updated.ConstructionProviderID
	if providerID == 0 {
		providerID = updated.ForemanID
	}
	NewNotificationDispatcher().NotifyPlannedStartDateUpdated(updated.OwnerID, providerUserIDFromProvider(providerID), updated.ID, updated.EntryStartDate)
	return &updated, nil
}

func (s *ProjectService) AdminStartProject(projectID, adminID uint64, req *StartProjectRequest) (*model.Project, error) {
	reason := strings.TrimSpace(req.Reason)
	if reason == "" {
		return nil, errors.New("请填写操作原因")
	}

	var updated model.Project
	auditService := &AuditLogService{}

	err := repository.DB.Transaction(func(tx *gorm.DB) error {
		project, err := s.getProjectForUpdate(tx, projectID)
		if err != nil {
			return err
		}
		if project.BusinessStatus != model.ProjectBusinessStatusConstructionQuoteConfirmed {
			return errors.New("当前项目状态不允许开工")
		}
		if !hasConfirmedConstructionParty(project) || project.ConstructionQuote <= 0 {
			return errors.New("施工条件未确认完成，不能开工")
		}
		if project.EntryStartDate == nil {
			return errors.New("请先登记计划进场时间，再发起开工")
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

		beforeState := map[string]interface{}{
			"project": map[string]interface{}{
				"id":             project.ID,
				"businessStatus": project.BusinessStatus,
				"currentPhase":   project.CurrentPhase,
			},
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
		if err := businessFlowSvc.AdvanceByProject(tx, projectID, map[string]interface{}{
			"current_stage": model.BusinessFlowStageInProgress,
		}); err != nil {
			return err
		}
		if err := auditService.CreateBusinessRecordTx(tx, &CreateAuditRecordInput{
			OperatorType:  "admin",
			OperatorID:    adminID,
			OperationType: "start_project",
			ResourceType:  "project",
			ResourceID:    project.ID,
			Reason:        reason,
			Result:        "success",
			BeforeState:   beforeState,
			AfterState: map[string]interface{}{
				"project": map[string]interface{}{
					"id":             project.ID,
					"businessStatus": model.ProjectBusinessStatusInProgress,
					"currentPhase":   currentPhase,
					"startedAt":      startedAt,
				},
			},
		}); err != nil {
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
		if !hasConfirmedConstructionParty(project) || project.ConstructionQuote <= 0 {
			return errors.New("施工条件未确认完成，不能开工")
		}
		if project.EntryStartDate == nil {
			return errors.New("请先登记计划进场时间，再发起开工")
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
		if err := businessFlowSvc.AdvanceByProject(tx, projectID, map[string]interface{}{
			"current_stage": model.BusinessFlowStageInProgress,
		}); err != nil {
			return err
		}

		return tx.First(&updated, projectID).Error
	})
	if err != nil {
		return nil, err
	}

	return &updated, nil
}

func (s *ProjectService) MerchantStartProject(projectID, providerID uint64, req *StartProjectRequest) (*model.Project, error) {
	if providerID == 0 {
		return nil, errors.New("无权发起开工")
	}

	var updated model.Project
	err := repository.DB.Transaction(func(tx *gorm.DB) error {
		project, err := s.getProjectForUpdate(tx, projectID)
		if err != nil {
			return err
		}
		if !canProjectProviderOperate(project, providerID) {
			return errors.New("无权发起开工")
		}
		if project.BusinessStatus != model.ProjectBusinessStatusConstructionQuoteConfirmed {
			return errors.New("当前项目状态不允许开工")
		}
		if !hasConfirmedConstructionParty(project) || project.ConstructionQuote <= 0 {
			return errors.New("施工条件未确认完成，不能开工")
		}
		if project.EntryStartDate == nil {
			return errors.New("请先登记计划进场时间，再发起开工")
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
		if err := businessFlowSvc.AdvanceByProject(tx, projectID, map[string]interface{}{
			"current_stage": model.BusinessFlowStageInProgress,
		}); err != nil {
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
	var ownerUserID uint64
	var milestoneName string
	err := repository.DB.Transaction(func(tx *gorm.DB) error {
		var project model.Project
		if err := tx.First(&project, projectID).Error; err != nil {
			return errors.New("项目不存在")
		}
		if project.BusinessStatus != model.ProjectBusinessStatusInProgress {
			return errors.New("项目未开工，不能提交节点")
		}
		if err := ensureProjectExecutionAllowed(&project, "提交节点"); err != nil {
			return err
		}
		if !canProjectProviderOperate(&project, providerID) {
			return errors.New("无权提交当前节点")
		}
		ownerUserID = project.OwnerID

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
		milestoneName = milestone.Name

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
		if err := businessFlowSvc.AdvanceByProject(tx, projectID, map[string]interface{}{
			"current_stage": model.BusinessFlowStageMilestoneReview,
		}); err != nil {
			return err
		}

		return tx.First(&updated, milestoneID).Error
	})
	if err != nil {
		return nil, err
	}
	NewNotificationDispatcher().NotifyMilestoneSubmitted(ownerUserID, projectID, milestoneID, milestoneName)

	return &updated, nil
}

// AcceptMilestone 业主验收项目节点
func (s *ProjectService) AcceptMilestone(projectID, userID, milestoneID uint64) (*model.Milestone, error) {
	var updated model.Milestone
	var providerUserID uint64
	var projectOwnerID uint64
	var projectPhaseName string
	var activatedPlan *model.PaymentPlan

	auditService := &AuditLogService{}
	err := repository.DB.Transaction(func(tx *gorm.DB) error {
		project, err := s.getOwnedProjectForUpdate(tx, projectID, userID)
		if err != nil {
			return err
		}
		if err := ensureProjectExecutionAllowed(project, "验收节点"); err != nil {
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
		projectOwnerID = project.OwnerID
		projectPhaseName = milestone.Name
		providerID := project.ConstructionProviderID
		if providerID == 0 {
			providerID = project.ProviderID
		}
		providerUserID = getProviderUserIDTx(tx, providerID)
		beforeState := map[string]interface{}{
			"project": map[string]interface{}{
				"id":             project.ID,
				"businessStatus": project.BusinessStatus,
				"currentPhase":   project.CurrentPhase,
			},
			"milestone": map[string]interface{}{
				"id":          milestone.ID,
				"name":        milestone.Name,
				"status":      milestone.Status,
				"amount":      milestone.Amount,
				"submittedAt": milestone.SubmittedAt,
			},
		}

		now := time.Now()
		if err := tx.Model(&milestone).Updates(map[string]interface{}{
			"status":      model.MilestoneStatusAccepted,
			"accepted_at": now,
		}).Error; err != nil {
			return err
		}

		// T+N 放款调度
		cfgSvc := &ConfigService{}
		delayDays := cfgSvc.GetConstructionReleaseDelayDays()
		releaseAt := time.Now().Add(time.Duration(delayDays) * 24 * time.Hour)
		if err := tx.Model(&milestone).Update("release_scheduled_at", releaseAt).Error; err != nil {
			return err
		}

		activateNext := true
		paymentPaused := false
		if usesMilestonePaymentMode(project) {
			nextPlan, err := findNextConstructionPaymentPlanTx(tx, project.ID, milestone.Seq)
			if err != nil {
				return err
			}
			if nextPlan != nil && nextPlan.Status != 1 {
				activateNext = false
				paymentPaused = true
				if err := activatePaymentPlanTx(tx, nextPlan, now); err != nil {
					return err
				}
				activatedPlan = nextPlan
			}
		}

		nextName, remaining, err := s.advanceMilestoneFlow(tx, projectID, milestone.Seq, activateNext)
		if err != nil {
			return err
		}

		projectUpdates := map[string]interface{}{
			"status":                model.ProjectStatusActive,
			"business_status":       model.ProjectBusinessStatusInProgress,
			"current_phase":         milestone.Name + "已验收",
			"payment_paused":        false,
			"payment_paused_at":     nil,
			"payment_paused_reason": "",
		}
		if remaining == 0 {
			projectUpdates["status"] = model.ProjectStatusActive
			projectUpdates["business_status"] = model.ProjectBusinessStatusInProgress
			projectUpdates["current_phase"] = "待提交完工材料"
			projectUpdates["actual_end"] = nil
		} else if paymentPaused {
			projectUpdates["payment_paused"] = true
			projectUpdates["payment_paused_at"] = &now
			projectUpdates["payment_paused_reason"] = "等待支付下一期施工款"
			projectUpdates["current_phase"] = "等待支付下一期施工款"
		} else if nextName != "" {
			projectUpdates["current_phase"] = nextName + "施工中"
		}
		if err := tx.Model(project).Updates(projectUpdates).Error; err != nil {
			return err
		}
		nextStage := model.BusinessFlowStageInProgress
		if err := businessFlowSvc.AdvanceByProject(tx, projectID, map[string]interface{}{
			"current_stage": nextStage,
		}); err != nil {
			return err
		}
		if err := auditService.CreateBusinessRecordTx(tx, &CreateAuditRecordInput{
			OperatorType:  "user",
			OperatorID:    userID,
			OperationType: "approve_milestone",
			ResourceType:  "milestone",
			ResourceID:    milestone.ID,
			Result:        "success",
			BeforeState:   beforeState,
			AfterState: map[string]interface{}{
				"project": map[string]interface{}{
					"id":             project.ID,
					"businessStatus": model.ProjectBusinessStatusInProgress,
					"currentPhase":   projectUpdates["current_phase"],
				},
				"milestone": map[string]interface{}{
					"id":         milestone.ID,
					"name":       milestone.Name,
					"status":     model.MilestoneStatusAccepted,
					"acceptedAt": now,
				},
			},
			Metadata: map[string]interface{}{
				"projectId": project.ID,
				"remaining": remaining,
				"nextPhase": nextName,
			},
		}); err != nil {
			return err
		}

		return tx.First(&updated, milestoneID).Error
	})
	if err != nil {
		return nil, err
	}

	NewNotificationDispatcher().NotifyMilestoneDecision(projectOwnerID, providerUserID, projectID, milestoneID, projectPhaseName, true, "")
	if activatedPlan != nil {
		NewNotificationDispatcher().NotifyConstructionStagePaymentActivated(projectOwnerID, providerUserID, projectID, activatedPlan.OrderID, *activatedPlan)
	}
	return &updated, nil
}

func (s *ProjectService) AdminAcceptMilestone(projectID, adminID, milestoneID uint64, reason string) (*model.Milestone, error) {
	reason = strings.TrimSpace(reason)
	if reason == "" {
		return nil, errors.New("请填写操作原因")
	}

	var updated model.Milestone
	var providerUserID uint64
	var projectOwnerID uint64
	var projectPhaseName string
	var activatedPlan *model.PaymentPlan

	auditService := &AuditLogService{}
	err := repository.DB.Transaction(func(tx *gorm.DB) error {
		project, err := s.getProjectForUpdate(tx, projectID)
		if err != nil {
			return err
		}
		if err := ensureProjectExecutionAllowed(project, "管理员验收节点"); err != nil {
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

		projectOwnerID = project.OwnerID
		projectPhaseName = milestone.Name
		providerID := project.ConstructionProviderID
		if providerID == 0 {
			providerID = project.ProviderID
		}
		providerUserID = getProviderUserIDTx(tx, providerID)
		beforeState := map[string]interface{}{
			"project": map[string]interface{}{
				"id":             project.ID,
				"businessStatus": project.BusinessStatus,
				"currentPhase":   project.CurrentPhase,
			},
			"milestone": map[string]interface{}{
				"id":          milestone.ID,
				"name":        milestone.Name,
				"status":      milestone.Status,
				"amount":      milestone.Amount,
				"submittedAt": milestone.SubmittedAt,
			},
		}

		now := time.Now()
		if err := tx.Model(&milestone).Updates(map[string]interface{}{
			"status":      model.MilestoneStatusAccepted,
			"accepted_at": now,
		}).Error; err != nil {
			return err
		}

		cfgSvc := &ConfigService{}
		delayDays := cfgSvc.GetConstructionReleaseDelayDays()
		releaseAt := time.Now().Add(time.Duration(delayDays) * 24 * time.Hour)
		if err := tx.Model(&milestone).Update("release_scheduled_at", releaseAt).Error; err != nil {
			return err
		}

		activateNext := true
		paymentPaused := false
		if usesMilestonePaymentMode(project) {
			nextPlan, err := findNextConstructionPaymentPlanTx(tx, project.ID, milestone.Seq)
			if err != nil {
				return err
			}
			if nextPlan != nil && nextPlan.Status != 1 {
				activateNext = false
				paymentPaused = true
				if err := activatePaymentPlanTx(tx, nextPlan, now); err != nil {
					return err
				}
				activatedPlan = nextPlan
			}
		}

		nextName, remaining, err := s.advanceMilestoneFlow(tx, projectID, milestone.Seq, activateNext)
		if err != nil {
			return err
		}

		projectUpdates := map[string]interface{}{
			"status":                model.ProjectStatusActive,
			"business_status":       model.ProjectBusinessStatusInProgress,
			"current_phase":         milestone.Name + "已验收",
			"payment_paused":        false,
			"payment_paused_at":     nil,
			"payment_paused_reason": "",
		}
		if remaining == 0 {
			projectUpdates["status"] = model.ProjectStatusActive
			projectUpdates["business_status"] = model.ProjectBusinessStatusInProgress
			projectUpdates["current_phase"] = "待提交完工材料"
			projectUpdates["actual_end"] = nil
		} else if paymentPaused {
			projectUpdates["payment_paused"] = true
			projectUpdates["payment_paused_at"] = &now
			projectUpdates["payment_paused_reason"] = "等待支付下一期施工款"
			projectUpdates["current_phase"] = "等待支付下一期施工款"
		} else if nextName != "" {
			projectUpdates["current_phase"] = nextName + "施工中"
		}
		if err := tx.Model(project).Updates(projectUpdates).Error; err != nil {
			return err
		}
		if err := businessFlowSvc.AdvanceByProject(tx, projectID, map[string]interface{}{
			"current_stage": model.BusinessFlowStageInProgress,
		}); err != nil {
			return err
		}
		if err := auditService.CreateBusinessRecordTx(tx, &CreateAuditRecordInput{
			OperatorType:  "admin",
			OperatorID:    adminID,
			OperationType: "approve_milestone",
			ResourceType:  "milestone",
			ResourceID:    milestone.ID,
			Reason:        reason,
			Result:        "success",
			BeforeState:   beforeState,
			AfterState: map[string]interface{}{
				"project": map[string]interface{}{
					"id":             project.ID,
					"businessStatus": model.ProjectBusinessStatusInProgress,
					"currentPhase":   projectUpdates["current_phase"],
				},
				"milestone": map[string]interface{}{
					"id":         milestone.ID,
					"name":       milestone.Name,
					"status":     model.MilestoneStatusAccepted,
					"acceptedAt": now,
				},
			},
			Metadata: map[string]interface{}{
				"projectId": project.ID,
				"remaining": remaining,
				"nextPhase": nextName,
			},
		}); err != nil {
			return err
		}

		return tx.First(&updated, milestoneID).Error
	})
	if err != nil {
		return nil, err
	}

	NewNotificationDispatcher().NotifyMilestoneDecision(projectOwnerID, providerUserID, projectID, milestoneID, projectPhaseName, true, reason)
	if activatedPlan != nil {
		NewNotificationDispatcher().NotifyConstructionStagePaymentActivated(projectOwnerID, providerUserID, projectID, activatedPlan.OrderID, *activatedPlan)
	}
	return &updated, nil
}

func (s *ProjectService) RejectMilestone(projectID, userID, milestoneID uint64, reason string) (*model.Milestone, error) {
	var updated model.Milestone
	var providerUserID uint64
	var projectOwnerID uint64
	var milestoneName string

	auditService := &AuditLogService{}
	err := repository.DB.Transaction(func(tx *gorm.DB) error {
		project, err := s.getOwnedProjectForUpdate(tx, projectID, userID)
		if err != nil {
			return err
		}
		if err := ensureProjectExecutionAllowed(project, "驳回验收节点"); err != nil {
			return err
		}

		var milestone model.Milestone
		if err := tx.Where("id = ? AND project_id = ?", milestoneID, projectID).First(&milestone).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return errors.New("验收节点不存在")
			}
			return err
		}
		if milestone.Status != model.MilestoneStatusSubmitted {
			return errors.New("当前节点未提交验收，不能驳回")
		}
		projectOwnerID = project.OwnerID
		milestoneName = milestone.Name
		providerID := project.ConstructionProviderID
		if providerID == 0 {
			providerID = project.ProviderID
		}
		providerUserID = getProviderUserIDTx(tx, providerID)
		beforeState := map[string]interface{}{
			"project": map[string]interface{}{
				"id":             project.ID,
				"businessStatus": project.BusinessStatus,
				"currentPhase":   project.CurrentPhase,
			},
			"milestone": map[string]interface{}{
				"id":          milestone.ID,
				"name":        milestone.Name,
				"status":      milestone.Status,
				"submittedAt": milestone.SubmittedAt,
			},
		}

		if err := tx.Model(&milestone).Updates(map[string]interface{}{
			"status":           model.MilestoneStatusRejected,
			"rejection_reason": strings.TrimSpace(reason),
		}).Error; err != nil {
			return err
		}

		if err := tx.Model(project).Updates(map[string]interface{}{
			"business_status": model.ProjectBusinessStatusInProgress,
			"current_phase":   milestone.Name + "待整改",
		}).Error; err != nil {
			return err
		}

		if err := businessFlowSvc.AdvanceByProject(tx, projectID, map[string]interface{}{
			"current_stage": model.BusinessFlowStageMilestoneReview,
			"closed_reason": strings.TrimSpace(reason),
		}); err != nil {
			return err
		}
		if err := auditService.CreateBusinessRecordTx(tx, &CreateAuditRecordInput{
			OperatorType:  "user",
			OperatorID:    userID,
			OperationType: "reject_milestone",
			ResourceType:  "milestone",
			ResourceID:    milestone.ID,
			Reason:        strings.TrimSpace(reason),
			Result:        "success",
			BeforeState:   beforeState,
			AfterState: map[string]interface{}{
				"project": map[string]interface{}{
					"id":             project.ID,
					"businessStatus": model.ProjectBusinessStatusInProgress,
					"currentPhase":   milestone.Name + "待整改",
				},
				"milestone": map[string]interface{}{
					"id":              milestone.ID,
					"name":            milestone.Name,
					"status":          model.MilestoneStatusRejected,
					"rejectionReason": strings.TrimSpace(reason),
				},
			},
			Metadata: map[string]interface{}{
				"projectId": project.ID,
			},
		}); err != nil {
			return err
		}

		return tx.First(&updated, milestoneID).Error
	})
	if err != nil {
		return nil, err
	}

	NewNotificationDispatcher().NotifyMilestoneDecision(projectOwnerID, providerUserID, projectID, milestoneID, milestoneName, false, reason)
	return &updated, nil
}

func (s *ProjectService) AdminRejectMilestone(projectID, adminID, milestoneID uint64, reason string) (*model.Milestone, error) {
	reason = strings.TrimSpace(reason)
	if reason == "" {
		return nil, errors.New("请填写驳回原因")
	}

	var updated model.Milestone
	var providerUserID uint64
	var projectOwnerID uint64
	var milestoneName string

	auditService := &AuditLogService{}
	err := repository.DB.Transaction(func(tx *gorm.DB) error {
		project, err := s.getProjectForUpdate(tx, projectID)
		if err != nil {
			return err
		}
		if err := ensureProjectExecutionAllowed(project, "管理员驳回验收节点"); err != nil {
			return err
		}

		var milestone model.Milestone
		if err := tx.Where("id = ? AND project_id = ?", milestoneID, projectID).First(&milestone).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return errors.New("验收节点不存在")
			}
			return err
		}
		if milestone.Status != model.MilestoneStatusSubmitted {
			return errors.New("当前节点未提交验收，不能驳回")
		}

		projectOwnerID = project.OwnerID
		milestoneName = milestone.Name
		providerID := project.ConstructionProviderID
		if providerID == 0 {
			providerID = project.ProviderID
		}
		providerUserID = getProviderUserIDTx(tx, providerID)
		beforeState := map[string]interface{}{
			"project": map[string]interface{}{
				"id":             project.ID,
				"businessStatus": project.BusinessStatus,
				"currentPhase":   project.CurrentPhase,
			},
			"milestone": map[string]interface{}{
				"id":          milestone.ID,
				"name":        milestone.Name,
				"status":      milestone.Status,
				"submittedAt": milestone.SubmittedAt,
			},
		}

		if err := tx.Model(&milestone).Updates(map[string]interface{}{
			"status":           model.MilestoneStatusRejected,
			"rejection_reason": reason,
		}).Error; err != nil {
			return err
		}

		if err := tx.Model(project).Updates(map[string]interface{}{
			"business_status": model.ProjectBusinessStatusInProgress,
			"current_phase":   milestone.Name + "待整改",
		}).Error; err != nil {
			return err
		}

		if err := businessFlowSvc.AdvanceByProject(tx, projectID, map[string]interface{}{
			"current_stage": model.BusinessFlowStageMilestoneReview,
			"closed_reason": reason,
		}); err != nil {
			return err
		}
		if err := auditService.CreateBusinessRecordTx(tx, &CreateAuditRecordInput{
			OperatorType:  "admin",
			OperatorID:    adminID,
			OperationType: "reject_milestone",
			ResourceType:  "milestone",
			ResourceID:    milestone.ID,
			Reason:        reason,
			Result:        "success",
			BeforeState:   beforeState,
			AfterState: map[string]interface{}{
				"project": map[string]interface{}{
					"id":             project.ID,
					"businessStatus": model.ProjectBusinessStatusInProgress,
					"currentPhase":   milestone.Name + "待整改",
				},
				"milestone": map[string]interface{}{
					"id":              milestone.ID,
					"name":            milestone.Name,
					"status":          model.MilestoneStatusRejected,
					"rejectionReason": reason,
				},
			},
			Metadata: map[string]interface{}{
				"projectId": project.ID,
			},
		}); err != nil {
			return err
		}

		return tx.First(&updated, milestoneID).Error
	})
	if err != nil {
		return nil, err
	}

	NewNotificationDispatcher().NotifyMilestoneDecision(projectOwnerID, providerUserID, projectID, milestoneID, milestoneName, false, reason)
	return &updated, nil
}

func (s *ProjectService) CompleteProject(projectID, userID uint64) (*model.Project, error) {
	var updated model.Project

	err := repository.DB.Transaction(func(tx *gorm.DB) error {
		project, err := s.getOwnedProjectForUpdate(tx, projectID, userID)
		if err != nil {
			return err
		}
		if err := ensureProjectExecutionAllowed(project, "完工项目"); err != nil {
			return err
		}

		var remaining int64
		if err := tx.Model(&model.Milestone{}).
			Where("project_id = ? AND status <> ?", projectID, model.MilestoneStatusAccepted).
			Count(&remaining).Error; err != nil {
			return err
		}
		if remaining > 0 {
			return errors.New("仍有未完成验收节点，不能完工")
		}

		now := time.Now()
		if err := tx.Model(project).Updates(map[string]interface{}{
			"status":          model.ProjectStatusCompleted,
			"business_status": model.ProjectBusinessStatusCompleted,
			"current_phase":   "已完工",
			"actual_end":      now,
		}).Error; err != nil {
			return err
		}
		if err := businessFlowSvc.AdvanceByProject(tx, projectID, map[string]interface{}{
			"current_stage": model.BusinessFlowStageCompleted,
		}); err != nil {
			return err
		}
		return tx.First(&updated, projectID).Error
	})
	if err != nil {
		return nil, err
	}

	return &updated, nil
}

func (s *ProjectService) getOwnedProjectForUpdate(tx *gorm.DB, projectID, userID uint64) (*model.Project, error) {
	project, err := s.getProjectForUpdate(tx, projectID)
	if err != nil {
		return nil, err
	}
	if project.OwnerID != userID {
		return nil, errors.New("无权操作此项目")
	}
	return project, nil
}

func (s *ProjectService) getOwnedProject(projectID, userID uint64) (*model.Project, error) {
	project, err := s.getProjectByID(projectID)
	if err != nil {
		return nil, err
	}
	if project.OwnerID != userID {
		return nil, errors.New("无权访问此项目")
	}
	return project, nil
}

func (s *ProjectService) getProviderProjectForUpdate(tx *gorm.DB, projectID, providerID uint64) (*model.Project, error) {
	project, err := s.getProjectForUpdate(tx, projectID)
	if err != nil {
		return nil, err
	}
	if !canProjectProviderOperate(project, providerID) {
		return nil, errors.New("无权操作此项目")
	}
	return project, nil
}

func (s *ProjectService) getProviderProject(projectID, providerID uint64) (*model.Project, error) {
	if providerID == 0 {
		return nil, errors.New("无权访问此项目")
	}
	project, err := s.getProjectByID(projectID)
	if err != nil {
		return nil, err
	}
	if !canProjectProviderOperate(project, providerID) {
		return nil, errors.New("无权访问此项目")
	}
	return project, nil
}

func (s *ProjectService) getProjectForUpdate(tx *gorm.DB, projectID uint64) (*model.Project, error) {
	var project model.Project
	if err := tx.First(&project, projectID).Error; err != nil {
		return nil, errors.New("项目不存在")
	}
	return &project, nil
}

func (s *ProjectService) getProjectByID(projectID uint64) (*model.Project, error) {
	var project model.Project
	if err := repository.DB.First(&project, projectID).Error; err != nil {
		return nil, errors.New("项目不存在")
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

func (s *ProjectService) ensureConstructionParticipants(tx *gorm.DB, constructionProviderID, foremanID uint64) (uint64, error) {
	if (constructionProviderID > 0 && foremanID > 0) || (constructionProviderID == 0 && foremanID == 0) {
		return 0, errors.New("请在装修公司和独立工长之间二选一")
	}

	if constructionProviderID > 0 {
		var constructionProvider model.Provider
		if err := tx.First(&constructionProvider, constructionProviderID).Error; err != nil {
			return 0, errors.New("施工公司不存在")
		}
		if constructionProvider.ProviderType != 2 {
			return 0, errors.New("施工公司必须选择装修公司类型")
		}
		return constructionProviderID, nil
	}

	var foreman model.Provider
	if err := tx.First(&foreman, foremanID).Error; err != nil {
		return 0, errors.New("工长不存在")
	}
	if foreman.ProviderType != 3 {
		return 0, errors.New("独立施工方必须为工长身份")
	}

	return foremanID, nil
}

func hasConfirmedConstructionParty(project *model.Project) bool {
	if project == nil {
		return false
	}
	return project.ConstructionProviderID > 0 || project.ForemanID > 0
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

func (s *ProjectService) advanceMilestoneFlow(tx *gorm.DB, projectID uint64, acceptedSeq int8, activateNext bool) (string, int64, error) {
	var next model.Milestone
	nextName := ""
	if err := tx.Where("project_id = ? AND seq > ? AND status = ?", projectID, acceptedSeq, model.MilestoneStatusPending).
		Order("seq ASC").First(&next).Error; err == nil {
		if activateNext {
			if err := tx.Model(&next).Update("status", model.MilestoneStatusInProgress).Error; err != nil {
				return "", 0, err
			}
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

func usesMilestonePaymentMode(project *model.Project) bool {
	if project == nil {
		return false
	}
	switch strings.TrimSpace(project.ConstructionPaymentMode) {
	case "", "staged", "milestone":
		return true
	default:
		return false
	}
}

func findNextConstructionPaymentPlanTx(tx *gorm.DB, projectID uint64, currentSeq int8) (*model.PaymentPlan, error) {
	var plan model.PaymentPlan
	err := tx.
		Joins("JOIN orders ON orders.id = payment_plans.order_id").
		Where("orders.project_id = ? AND orders.order_type = ? AND payment_plans.seq = ?", projectID, model.OrderTypeConstruction, int(currentSeq)+1).
		First(&plan).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &plan, nil
}

func (s *ProjectService) resumeProjectExecutionAfterPaymentTx(tx *gorm.DB, project *model.Project) error {
	if project == nil || !project.PaymentPaused {
		return nil
	}

	nextName, err := s.activateCurrentMilestone(tx, project.ID)
	if err != nil {
		return err
	}

	updates := map[string]interface{}{
		"payment_paused":        false,
		"payment_paused_at":     nil,
		"payment_paused_reason": "",
	}
	if nextName != "" {
		updates["current_phase"] = nextName + "施工中"
	}
	if err := tx.Model(project).Updates(updates).Error; err != nil {
		return err
	}
	project.PaymentPaused = false
	project.PaymentPausedAt = nil
	project.PaymentPausedReason = ""
	if nextName != "" {
		project.CurrentPhase = nextName + "施工中"
	}
	return nil
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

func (s *ProjectService) resolveProjectFlowSummary(project *model.Project, milestones []model.Milestone) BusinessFlowSummary {
	return s.resolveProjectFlowSummaryTx(repository.DB, project, milestones)
}

func (s *ProjectService) resolveProjectFlowSummaryTx(queryDB *gorm.DB, project *model.Project, milestones []model.Milestone) BusinessFlowSummary {
	flow, _ := businessFlowSvc.GetByProjectIDTx(queryDB, project.ID)
	allAccepted := len(milestones) > 0
	for _, milestone := range milestones {
		if milestone.Status != model.MilestoneStatusAccepted && milestone.Status != model.MilestoneStatusPaid {
			allAccepted = false
			break
		}
	}
	if isProjectPaused(project) {
		return BusinessFlowSummary{
			CurrentStage:           model.BusinessFlowStageInConstruction,
			FlowSummary:            "项目已暂停，待业主恢复施工后再继续推进",
			AvailableActions:       []string{},
			InspirationCaseDraftID: project.InspirationCaseDraftID,
		}
	}
	if flow != nil {
		summary := businessFlowSvc.BuildSummary(flow)
		summary.AvailableActions = filterProjectStartAction(project, summary.AvailableActions)
		if summary.CurrentStage == model.BusinessFlowStageInConstruction && allAccepted && (project.CompletionSubmittedAt == nil || project.CompletionRejectedAt != nil) && project.InspirationCaseDraftID == 0 {
			summary.FlowSummary = "全部节点已验收，待施工方提交完工材料"
			summary.AvailableActions = []string{"submit_completion"}
		}
		return summary
	}
	summary := businessFlowSvc.BuildProjectFallbackSummary(project, milestones)
	summary.AvailableActions = filterProjectStartAction(project, summary.AvailableActions)
	return summary
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

// InitProjectMilestones 创建项目默认里程碑
func (s *ProjectService) InitProjectMilestones(tx *gorm.DB, projectID uint64, total float64) error {
	milestones := []model.Milestone{
		{ProjectID: projectID, Name: "开工交底", Seq: 1, Percentage: 20, Status: model.MilestoneStatusPending, Criteria: "现场保护完成，图纸确认"},
		{ProjectID: projectID, Name: "水电验收", Seq: 2, Percentage: 30, Status: model.MilestoneStatusPending, Criteria: "水管试压合格，电路通断测试"},
		{ProjectID: projectID, Name: "泥木验收", Seq: 3, Percentage: 30, Status: model.MilestoneStatusPending, Criteria: "瓷砖空鼓率<5%，木工结构牢固"},
		{ProjectID: projectID, Name: "竣工验收", Seq: 4, Percentage: 20, Status: model.MilestoneStatusPending, Criteria: "全屋保洁完成，设备调试正常"},
	}

	for i := range milestones {
		milestones[i].Amount = total * float64(milestones[i].Percentage) / 100
	}

	return tx.Create(&milestones).Error
}
