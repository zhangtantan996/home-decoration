package handler

import (
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	"home-decoration-server/internal/service"
	"home-decoration-server/pkg/response"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

var adminProjectService = &service.ProjectService{}

// ==================== Admin 项目管理 ====================

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
		response.ServerError(c, "获取项目列表失败")
		return
	}

	// 补充关联信息
	type ProjectWithNames struct {
		model.Project
		OwnerName     string `json:"ownerName"`
		ProviderName  string `json:"providerName"`
		BusinessStage string `json:"businessStage,omitempty"`
		FlowSummary   string `json:"flowSummary,omitempty"`
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
		respondScopedAccessError(c, err, "项目不存在")
		return
	}

	response.Success(c, detail)
}

// AdminUpdateProjectStatus 更新项目状态
func AdminUpdateProjectStatus(c *gin.Context) {
	id := c.Param("id")

	var req struct {
		Status       int8   `json:"status"`
		CurrentPhase string `json:"currentPhase"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}

	updates := map[string]interface{}{}
	updates["status"] = req.Status
	if req.CurrentPhase != "" {
		updates["current_phase"] = req.CurrentPhase
	}

	if err := repository.DB.Model(&model.Project{}).Where("id = ?", id).Updates(updates).Error; err != nil {
		response.ServerError(c, "更新失败")
		return
	}

	response.SuccessWithMessage(c, "更新成功", gin.H{"status": "ok"})
}

func AdminConfirmProjectConstruction(c *gin.Context) {
	id := c.Param("id")

	var req service.ConfirmConstructionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}

	project, err := adminProjectService.AdminConfirmConstruction(parseUint(id), &req)
	if err != nil {
		respondDomainMutationError(c, err, "施工方确认失败")
		return
	}

	response.SuccessWithMessage(c, "施工方确认成功", project)
}

func AdminConfirmProjectConstructionQuote(c *gin.Context) {
	id := c.Param("id")

	var req service.ConfirmConstructionQuoteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}

	project, err := adminProjectService.AdminConfirmConstructionQuote(parseUint(id), &req)
	if err != nil {
		respondDomainMutationError(c, err, "施工报价确认失败")
		return
	}

	response.SuccessWithMessage(c, "施工报价确认成功", project)
}

// AdminGetProjectPhases 获取项目阶段列表
func AdminGetProjectPhases(c *gin.Context) {
	id := c.Param("id")

	phases, err := adminProjectService.GetProjectPhases(parseUint(id))
	if err != nil {
		respondScopedAccessError(c, err, "获取阶段列表失败")
		return
	}

	response.Success(c, gin.H{"phases": phases})
}

// AdminUpdatePhase 更新阶段状态（仅管理员）
func AdminUpdatePhase(c *gin.Context) {
	phaseId := c.Param("phaseId")

	var req service.UpdatePhaseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}

	if err := adminProjectService.UpdatePhase(parseUint(phaseId), &req); err != nil {
		respondDomainMutationError(c, err, "更新阶段失败")
		return
	}

	response.SuccessWithMessage(c, "更新成功", gin.H{"status": "ok"})
}

// ==================== 施工日志管理 ====================

// AdminGetProjectLogs 获取项目施工日志
func AdminGetProjectLogs(c *gin.Context) {
	id := c.Param("id")
	phaseId := c.Query("phaseId")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))

	var logs []model.WorkLog
	var total int64

	db := repository.DB.Model(&model.WorkLog{}).Where("project_id = ?", id)

	if phaseId != "" {
		db = db.Where("phase_id = ?", phaseId)
	}

	db.Count(&total)

	offset := (page - 1) * pageSize
	if err := db.Order("log_date DESC, created_at DESC").Offset(offset).Limit(pageSize).Find(&logs).Error; err != nil {
		response.ServerError(c, "获取日志失败")
		return
	}

	response.Success(c, gin.H{
		"list":     logs,
		"total":    total,
		"page":     page,
		"pageSize": pageSize,
	})
}

// AdminCreateWorkLog 创建施工日志（仅管理员）
func AdminCreateWorkLog(c *gin.Context) {
	projectId := c.Param("id")
	phaseId := c.Param("phaseId")

	var req struct {
		Title       string `json:"title" binding:"required"`
		Description string `json:"description"`
		Photos      string `json:"photos"` // JSON 数组字符串
		LogDate     string `json:"logDate"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "标题不能为空")
		return
	}

	// 获取当前管理员ID
	adminID, _ := c.Get("adminId")

	log := &model.WorkLog{
		ProjectID:   parseUint(projectId),
		PhaseID:     parseUint(phaseId),
		Title:       req.Title,
		Description: req.Description,
		Photos:      req.Photos,
		CreatedBy:   adminID.(uint64),
		LogDate:     time.Now(),
	}

	// 解析日期
	if req.LogDate != "" {
		if t, err := time.Parse("2006-01-02", req.LogDate); err == nil {
			log.LogDate = t
		}
	}

	if err := repository.DB.Create(log).Error; err != nil {
		response.ServerError(c, "创建日志失败")
		return
	}

	response.SuccessWithMessage(c, "创建成功", log)
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
		response.BadRequest(c, "参数错误")
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
		updates["photos"] = req.Photos
	}
	if req.LogDate != "" {
		if t, err := time.Parse("2006-01-02", req.LogDate); err == nil {
			updates["log_date"] = t
		}
	}

	if err := repository.DB.Model(&model.WorkLog{}).Where("id = ?", logId).Updates(updates).Error; err != nil {
		response.ServerError(c, "更新失败")
		return
	}

	response.SuccessWithMessage(c, "更新成功", gin.H{"status": "ok"})
}

// AdminDeleteWorkLog 删除施工日志（仅管理员）
func AdminDeleteWorkLog(c *gin.Context) {
	logId := c.Param("logId")

	if err := repository.DB.Delete(&model.WorkLog{}, logId).Error; err != nil {
		response.ServerError(c, "删除失败")
		return
	}

	response.SuccessWithMessage(c, "删除成功", gin.H{"status": "ok"})
}

// parseUint 辅助函数
func parseUint(s string) uint64 {
	v, _ := strconv.ParseUint(s, 10, 64)
	return v
}
