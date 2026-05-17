package handler

import (
	"encoding/json"
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	"home-decoration-server/internal/service"
	"home-decoration-server/pkg/response"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

var adminProjectService = &service.ProjectService{}

type adminProjectCurrentSupervisor struct {
	AssignmentID   uint64     `json:"assignmentId"`
	SupervisorID   uint64     `json:"supervisorId"`
	Name           string     `json:"name"`
	Phone          string     `json:"phone,omitempty"`
	AssignedAt     *time.Time `json:"assignedAt,omitempty"`
	AssignedBy     uint64     `json:"assignedBy"`
	AssignedByName string     `json:"assignedByName,omitempty"`
}

type adminProjectCreationSource struct {
	Source    string `json:"source"`
	Label     string `json:"label"`
	BookingID uint64 `json:"bookingId,omitempty"`
}

type adminProjectDetailResponse struct {
	*service.ProjectDetail
	CurrentSupervisor     *adminProjectCurrentSupervisor  `json:"currentSupervisor,omitempty"`
	SupervisorAssignments []adminProjectCurrentSupervisor `json:"supervisorAssignments,omitempty"`
	CreationSource        string                          `json:"creationSource,omitempty"`
	CreationSourceLabel   string                          `json:"creationSourceLabel,omitempty"`
	CreationBookingID     uint64                          `json:"creationBookingId,omitempty"`
}

// ==================== Admin 项目管理 ====================

func AdminCreateProject(c *gin.Context) {
	var req struct {
		BookingID uint64 `json:"bookingId"`
		Reason    string `json:"reason"`
		service.CreateProjectRequest
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}
	if strings.TrimSpace(req.MaterialMethod) == "" {
		req.MaterialMethod = "platform"
	}

	source := "manual"
	var bookingMetaID uint64
	if req.BookingID > 0 {
		var booking model.Booking
		if err := repository.DB.First(&booking, req.BookingID).Error; err != nil {
			response.NotFound(c, "预约不存在")
			return
		}
		bookingMetaID = booking.ID
		source = "booking_prefill"
		if req.OwnerID == 0 {
			req.OwnerID = booking.UserID
		}
		if req.ProviderID == 0 {
			req.ProviderID = booking.ProviderID
		}
		if strings.TrimSpace(req.Name) == "" {
			req.Name = strings.TrimSpace(booking.Address) + "装修项目"
		}
		if strings.TrimSpace(req.Address) == "" {
			req.Address = booking.Address
		}
		if req.Area <= 0 {
			req.Area = booking.Area
		}
		if strings.TrimSpace(req.EntryStartDate) == "" {
			req.EntryStartDate = strings.TrimSpace(booking.PreferredDate)
		}
	}
	if req.ProposalID > 0 && source == "manual" {
		source = "proposal"
	}

	project, err := adminProjectService.CreateProject(&req.CreateProjectRequest)
	if err != nil {
		respondSchemaAwareDomainMutationError(c, err, "创建项目失败", "创建项目失败，请联系管理员检查数据库是否已升级")
		return
	}

	afterState := map[string]interface{}{
		"ownerId":        project.OwnerID,
		"providerId":     project.ProviderID,
		"name":           project.Name,
		"coverImage":     project.CoverImage,
		"materialMethod": project.MaterialMethod,
		"entryStartDate": formatProjectDatePointer(project.EntryStartDate),
		"entryEndDate":   formatProjectDatePointer(project.EntryEndDate),
		"source":         source,
	}
	metadata := map[string]interface{}{
		"source": source,
	}
	if bookingMetaID > 0 {
		metadata["bookingId"] = bookingMetaID
	}
	_ = (&service.AuditLogService{}).CreateBusinessRecord(&service.CreateAuditRecordInput{
		OperatorType:  "admin",
		OperatorID:    c.GetUint64("adminId"),
		OperationType: "project_create",
		ResourceType:  "project",
		ResourceID:    project.ID,
		Reason:        readAdminReason(c, req.Reason, "Ops 新建项目"),
		Result:        "success",
		AfterState:    afterState,
		Metadata:      metadata,
		ClientIP:      c.ClientIP(),
		UserAgent:     c.Request.UserAgent(),
	})

	response.SuccessWithMessage(c, "项目创建成功", project)
}

// AdminListProjects 获取项目列表
func AdminListProjects(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))
	status := c.Query("status")
	keyword := c.Query("keyword")
	businessStage := ""
	if rawBusinessStage := strings.TrimSpace(c.Query("businessStage")); rawBusinessStage != "" {
		businessStage = model.NormalizeBusinessFlowStage(rawBusinessStage)
	}

	var projects []model.Project
	var total int64

	db := repository.DB.Model(&model.Project{})

	if status != "" {
		s, _ := strconv.Atoi(status)
		db = db.Where("status = ?", s)
	}

	if err := db.Order("created_at DESC").Find(&projects).Error; err != nil {
		c.JSON(http.StatusOK, gin.H{"code": 1, "error": "获取项目列表失败"})
		return
	}
	currentSupervisorMap, _, err := loadAdminProjectSupervisorSummaries(projects)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"code": 1, "error": "获取项目列表失败"})
		return
	}
	creationSourceMap := loadAdminProjectCreationSourceMap(projects)

	// 补充关联信息
	type ProjectWithNames struct {
		model.Project
		OwnerName           string                         `json:"ownerName"`
		ProviderName        string                         `json:"providerName"`
		BusinessStage       string                         `json:"businessStage,omitempty"`
		FlowSummary         string                         `json:"flowSummary,omitempty"`
		CurrentSupervisor   *adminProjectCurrentSupervisor `json:"currentSupervisor,omitempty"`
		CreationSource      string                         `json:"creationSource,omitempty"`
		CreationSourceLabel string                         `json:"creationSourceLabel,omitempty"`
		CreationBookingID   uint64                         `json:"creationBookingId,omitempty"`
	}

	var result []ProjectWithNames
	stageStats := map[string]int64{}
	flowSvc := &service.BusinessFlowService{}
	for _, p := range projects {
		pwn := ProjectWithNames{Project: p}

		var owner model.User
		if err := repository.DB.Select("nickname").First(&owner, p.OwnerID).Error; err == nil {
			pwn.OwnerName = owner.Nickname
		}

		var provider model.Provider
		if err := repository.DB.Select("id", "user_id", "company_name").First(&provider, p.ProviderID).Error; err == nil {
			var providerUser model.User
			if provider.UserID > 0 {
				_ = repository.DB.Select("nickname", "phone").First(&providerUser, provider.UserID).Error
				pwn.ProviderName = service.ResolveProviderDisplayName(provider, &providerUser)
			} else {
				pwn.ProviderName = service.ResolveProviderDisplayName(provider, nil)
			}
		}
		var milestones []model.Milestone
		_ = repository.DB.Where("project_id = ?", p.ID).Order("seq ASC").Find(&milestones).Error
		summary := flowSvc.BuildProjectFallbackSummary(&p, milestones)
		if flow, err := flowSvc.GetByProjectID(p.ID); err == nil && flow != nil {
			summary = flowSvc.BuildSummary(flow)
		}
		pwn.BusinessStage = summary.CurrentStage
		pwn.FlowSummary = summary.FlowSummary
		pwn.CurrentSupervisor = currentSupervisorMap[p.ID]
		if sourceSummary, ok := creationSourceMap[p.ID]; ok {
			pwn.CreationSource = sourceSummary.Source
			pwn.CreationSourceLabel = sourceSummary.Label
			pwn.CreationBookingID = sourceSummary.BookingID
		}
		stageStats[pwn.BusinessStage]++

		if businessStage != "" && model.NormalizeBusinessFlowStage(pwn.BusinessStage) != businessStage {
			continue
		}
		if keyword != "" &&
			!strings.Contains(strings.ToLower(pwn.Name), strings.ToLower(keyword)) &&
			!strings.Contains(strings.ToLower(pwn.Address), strings.ToLower(keyword)) {
			continue
		}

		result = append(result, pwn)
	}

	total = int64(len(result))
	offset := (page - 1) * pageSize
	if offset > len(result) {
		offset = len(result)
	}
	end := offset + pageSize
	if end > len(result) {
		end = len(result)
	}

	response.Success(c, gin.H{
		"list":       result[offset:end],
		"total":      total,
		"stageStats": stageStats,
		"page":       page,
		"pageSize":   pageSize,
	})
}

// AdminGetProject 获取项目详情
func AdminGetProject(c *gin.Context) {
	id := c.Param("id")

	detail, err := adminProjectService.GetProjectDetail(parseUint(id))
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"code": 1, "error": "项目不存在"})
		return
	}

	projectStub := model.Project{Base: model.Base{ID: detail.ID}, ProposalID: detail.ProposalID}
	currentSupervisorMap, assignmentMap, err := loadAdminProjectSupervisorSummaries([]model.Project{projectStub})
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"code": 1, "error": "项目不存在"})
		return
	}
	sourceSummary := resolveAdminProjectCreationSource(&projectStub, loadProjectCreateAuditMetadata(detail.ID))

	response.Success(c, adminProjectDetailResponse{
		ProjectDetail:         detail,
		CurrentSupervisor:     currentSupervisorMap[detail.ID],
		SupervisorAssignments: assignmentMap[detail.ID],
		CreationSource:        sourceSummary.Source,
		CreationSourceLabel:   sourceSummary.Label,
		CreationBookingID:     sourceSummary.BookingID,
	})
}

func AdminUpdateProject(c *gin.Context) {
	projectID := parseUint(c.Param("id"))
	if projectID == 0 {
		response.BadRequest(c, "无效项目ID")
		return
	}
	var req struct {
		Reason string `json:"reason"`
		service.UpdateProjectBasicsRequest
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}

	before, err := adminProjectService.GetProjectDetail(projectID)
	if err != nil {
		response.NotFound(c, "项目不存在")
		return
	}
	updated, err := adminProjectService.UpdateProjectBasics(projectID, &req.UpdateProjectBasicsRequest)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	_ = (&service.AuditLogService{}).CreateBusinessRecord(&service.CreateAuditRecordInput{
		OperatorType:  "admin",
		OperatorID:    c.GetUint64("adminId"),
		OperationType: "project_update",
		ResourceType:  "project",
		ResourceID:    updated.ID,
		Reason:        readAdminReason(c, req.Reason, "Ops 更新项目"),
		Result:        "success",
		BeforeState: map[string]interface{}{
			"ownerId":        before.OwnerID,
			"providerId":     before.ProviderID,
			"name":           before.Name,
			"address":        before.Address,
			"coverImage":     before.CoverImage,
			"area":           before.Area,
			"budget":         before.Budget,
			"materialMethod": before.MaterialMethod,
			"entryStartDate": formatProjectDatePointer(before.EntryStartDate),
			"entryEndDate":   formatProjectDatePointer(before.EntryEndDate),
		},
		AfterState: map[string]interface{}{
			"ownerId":        updated.OwnerID,
			"providerId":     updated.ProviderID,
			"name":           updated.Name,
			"address":        updated.Address,
			"coverImage":     updated.CoverImage,
			"area":           updated.Area,
			"budget":         updated.Budget,
			"materialMethod": updated.MaterialMethod,
			"entryStartDate": formatProjectDatePointer(updated.EntryStartDate),
			"entryEndDate":   formatProjectDatePointer(updated.EntryEndDate),
		},
		ClientIP:  c.ClientIP(),
		UserAgent: c.Request.UserAgent(),
	})

	response.SuccessWithMessage(c, "项目更新成功", updated)
}

// AdminUpdateProjectStatus 更新项目状态
func AdminUpdateProjectStatus(c *gin.Context) {
	id := c.Param("id")

	var req struct {
		Status       int8   `json:"status"`
		CurrentPhase string `json:"currentPhase"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"code": 1, "error": "参数错误"})
		return
	}

	updates := map[string]interface{}{}
	updates["status"] = req.Status
	if req.CurrentPhase != "" {
		updates["current_phase"] = req.CurrentPhase
	}

	if err := repository.DB.Model(&model.Project{}).Where("id = ?", id).Updates(updates).Error; err != nil {
		c.JSON(http.StatusOK, gin.H{"code": 1, "error": "更新失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "更新成功"})
}

func formatProjectDatePointer(value *time.Time) string {
	if value == nil {
		return ""
	}
	return value.Format("2006-01-02")
}

func loadAdminProjectSupervisorSummaries(projects []model.Project) (map[uint64]*adminProjectCurrentSupervisor, map[uint64][]adminProjectCurrentSupervisor, error) {
	projectIDs := make([]uint64, 0, len(projects))
	for _, project := range projects {
		if project.ID > 0 {
			projectIDs = append(projectIDs, project.ID)
		}
	}
	currentMap := make(map[uint64]*adminProjectCurrentSupervisor)
	assignmentsMap := make(map[uint64][]adminProjectCurrentSupervisor)
	if len(projectIDs) == 0 {
		return currentMap, assignmentsMap, nil
	}

	var assignments []model.ProjectSupervisorAssignment
	if err := repository.DB.Where("project_id IN ? AND status = 1", projectIDs).
		Order("project_id ASC, assigned_at DESC, id DESC").
		Find(&assignments).Error; err != nil {
		return nil, nil, err
	}
	if len(assignments) == 0 {
		return currentMap, assignmentsMap, nil
	}

	supervisorIDs := make([]uint64, 0, len(assignments))
	adminIDs := make([]uint64, 0, len(assignments))
	for _, assignment := range assignments {
		supervisorIDs = append(supervisorIDs, assignment.SupervisorID)
		if assignment.AssignedBy > 0 {
			adminIDs = append(adminIDs, assignment.AssignedBy)
		}
	}

	profileMap := make(map[uint64]model.SupervisorProfile, len(supervisorIDs))
	if len(supervisorIDs) > 0 {
		var profiles []model.SupervisorProfile
		if err := repository.DB.Where("id IN ?", supervisorIDs).Find(&profiles).Error; err != nil {
			return nil, nil, err
		}
		for _, profile := range profiles {
			profileMap[profile.ID] = profile
		}
	}

	adminMap := make(map[uint64]model.SysAdmin, len(adminIDs))
	if len(adminIDs) > 0 {
		var admins []model.SysAdmin
		if err := repository.DB.Select("id", "username", "nickname").Where("id IN ?", adminIDs).Find(&admins).Error; err != nil {
			return nil, nil, err
		}
		for _, admin := range admins {
			adminMap[admin.ID] = admin
		}
	}

	for _, assignment := range assignments {
		profile := profileMap[assignment.SupervisorID]
		admin := adminMap[assignment.AssignedBy]
		assignedByName := strings.TrimSpace(admin.Nickname)
		if assignedByName == "" {
			assignedByName = strings.TrimSpace(admin.Username)
		}
		assignedAt := assignment.AssignedAt
		item := adminProjectCurrentSupervisor{
			AssignmentID:   assignment.ID,
			SupervisorID:   assignment.SupervisorID,
			Name:           strings.TrimSpace(profile.RealName),
			Phone:          maskPhoneValue(profile.Phone),
			AssignedAt:     &assignedAt,
			AssignedBy:     assignment.AssignedBy,
			AssignedByName: assignedByName,
		}
		assignmentsMap[assignment.ProjectID] = append(assignmentsMap[assignment.ProjectID], item)
		if _, exists := currentMap[assignment.ProjectID]; !exists {
			itemCopy := item
			currentMap[assignment.ProjectID] = &itemCopy
		}
	}

	return currentMap, assignmentsMap, nil
}

func loadAdminProjectCreationSourceMap(projects []model.Project) map[uint64]adminProjectCreationSource {
	projectIDs := make([]uint64, 0, len(projects))
	projectMap := make(map[uint64]model.Project, len(projects))
	for _, project := range projects {
		if project.ID == 0 {
			continue
		}
		projectIDs = append(projectIDs, project.ID)
		projectMap[project.ID] = project
	}
	result := make(map[uint64]adminProjectCreationSource, len(projectIDs))
	if len(projectIDs) == 0 {
		return result
	}

	var logs []model.AuditLog
	if err := repository.DB.Select("resource_id", "metadata").
		Where("operation_type = ? AND resource_type = ? AND resource_id IN ?", "project_create", "project", projectIDs).
		Order("id DESC").
		Find(&logs).Error; err == nil {
		for _, log := range logs {
			if _, exists := result[log.ResourceID]; exists {
				continue
			}
			project := projectMap[log.ResourceID]
			result[log.ResourceID] = resolveAdminProjectCreationSource(&project, parseProjectCreateAuditMetadata(log.Metadata))
		}
	}
	for _, project := range projects {
		if _, exists := result[project.ID]; exists {
			continue
		}
		result[project.ID] = resolveAdminProjectCreationSource(&project, nil)
	}
	return result
}

func loadProjectCreateAuditMetadata(projectID uint64) map[string]interface{} {
	if projectID == 0 {
		return nil
	}
	var log model.AuditLog
	if err := repository.DB.Select("metadata").
		Where("operation_type = ? AND resource_type = ? AND resource_id = ?", "project_create", "project", projectID).
		Order("id DESC").
		First(&log).Error; err != nil {
		return nil
	}
	return parseProjectCreateAuditMetadata(log.Metadata)
}

func parseProjectCreateAuditMetadata(raw string) map[string]interface{} {
	payload := make(map[string]interface{})
	if strings.TrimSpace(raw) == "" {
		return payload
	}
	if err := json.Unmarshal([]byte(raw), &payload); err != nil {
		return map[string]interface{}{}
	}
	return payload
}

func resolveAdminProjectCreationSource(project *model.Project, metadata map[string]interface{}) adminProjectCreationSource {
	source := strings.TrimSpace(toStringValue(metadata["source"]))
	bookingID := toUint64Value(metadata["bookingId"])
	if source == "" {
		if project != nil && project.ProposalID > 0 {
			source = "proposal"
		} else {
			source = "manual"
		}
	}
	label := "手工建档"
	switch source {
	case "booking_prefill":
		label = "预约转项目"
	case "proposal":
		label = "方案转项目"
	}
	return adminProjectCreationSource{
		Source:    source,
		Label:     label,
		BookingID: bookingID,
	}
}

func toStringValue(value interface{}) string {
	switch v := value.(type) {
	case string:
		return strings.TrimSpace(v)
	default:
		return ""
	}
}

func toUint64Value(value interface{}) uint64 {
	switch v := value.(type) {
	case float64:
		return uint64(v)
	case int:
		return uint64(v)
	case int64:
		return uint64(v)
	case uint64:
		return v
	case json.Number:
		parsed, _ := v.Int64()
		return uint64(parsed)
	default:
		return 0
	}
}

func AdminConfirmProjectConstruction(c *gin.Context) {
	id := c.Param("id")
	adminID := c.GetUint64("adminId")

	var req service.ConfirmConstructionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"code": 1, "error": "参数错误"})
		return
	}

	project, err := adminProjectService.AdminConfirmConstruction(parseUint(id), adminID, &req)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"code": 1, "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "data": project, "message": "施工方确认成功"})
}

func AdminConfirmProjectConstructionQuote(c *gin.Context) {
	id := c.Param("id")
	adminID := c.GetUint64("adminId")

	var req service.ConfirmConstructionQuoteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"code": 1, "error": "参数错误"})
		return
	}

	project, err := adminProjectService.AdminConfirmConstructionQuote(parseUint(id), adminID, &req)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"code": 1, "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "data": project, "message": "施工报价确认成功"})
}

// AdminGetProjectPhases 获取项目阶段列表
func AdminGetProjectPhases(c *gin.Context) {
	id := c.Param("id")

	phases, err := adminProjectService.GetProjectPhaseViews(parseUint(id))
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"code": 1, "error": "获取阶段列表失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "data": gin.H{"phases": phases}})
}

// AdminUpdatePhase 更新阶段状态（仅管理员）
func AdminUpdatePhase(c *gin.Context) {
	phaseId := c.Param("phaseId")

	var req service.UpdatePhaseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"code": 1, "error": "参数错误"})
		return
	}

	if err := adminProjectService.UpdatePhase(parseUint(phaseId), &req); err != nil {
		c.JSON(http.StatusOK, gin.H{"code": 1, "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "更新成功"})
}

// ==================== 施工日志管理 ====================

// AdminGetProjectLogs 获取项目施工日志
func AdminGetProjectLogs(c *gin.Context) {
	id := c.Param("id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))
	phaseID := parseUint(c.Query("phaseId"))

	logs, total, err := adminProjectService.GetProjectLogs(parseUint(id), page, pageSize, phaseID)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"code": 1, "error": "获取日志失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code":     0,
		"data":     logs,
		"total":    total,
		"page":     page,
		"pageSize": pageSize,
	})
}

// AdminCreateWorkLog 创建施工日志（仅管理员）
func AdminCreateWorkLog(c *gin.Context) {
	projectId := c.Param("id")
	phaseId := c.Param("phaseId")

	var req service.CreateWorkLogRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"code": 1, "error": "标题不能为空"})
		return
	}

	req.PhaseID = parseUint(phaseId)
	adminID := c.GetUint64("admin_id")

	log, err := adminProjectService.CreateAdminWorkLog(parseUint(projectId), adminID, &req)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"code": 1, "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "data": log, "message": "创建成功"})
}

// AdminUpdateWorkLog 更新施工日志（仅管理员）
func AdminUpdateWorkLog(c *gin.Context) {
	logId := c.Param("logId")

	var req struct {
		Title       string `json:"title"`
		Description string `json:"description"`
		Photos      string `json:"photos"`
		LogDate     string `json:"logDate"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"code": 1, "error": "参数错误"})
		return
	}

	updates := map[string]interface{}{}
	if req.Title != "" {
		updates["title"] = req.Title
	}
	if req.Description != "" {
		updates["description"] = req.Description
	}
	if req.Photos != "" {
		updates["photos"] = normalizeStoredAssetJSONArray(req.Photos)
	}
	if req.LogDate != "" {
		if t, err := time.Parse("2006-01-02", req.LogDate); err == nil {
			updates["log_date"] = t
		}
	}

	if err := repository.DB.Model(&model.WorkLog{}).Where("id = ?", logId).Updates(updates).Error; err != nil {
		c.JSON(http.StatusOK, gin.H{"code": 1, "error": "更新失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "更新成功"})
}

// AdminDeleteWorkLog 删除施工日志（仅管理员）
func AdminDeleteWorkLog(c *gin.Context) {
	logId := c.Param("logId")

	if err := repository.DB.Delete(&model.WorkLog{}, logId).Error; err != nil {
		c.JSON(http.StatusOK, gin.H{"code": 1, "error": "删除失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "删除成功"})
}

// parseUint 辅助函数
func parseUint(s string) uint64 {
	v, _ := strconv.ParseUint(s, 10, 64)
	return v
}
