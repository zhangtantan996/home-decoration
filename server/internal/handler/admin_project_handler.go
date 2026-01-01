package handler

import (
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	"home-decoration-server/internal/service"
	"net/http"
	"strconv"
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

	var projects []model.Project
	var total int64

	db := repository.DB.Model(&model.Project{})

	if status != "" {
		s, _ := strconv.Atoi(status)
		db = db.Where("status = ?", s)
	}

	if keyword != "" {
		db = db.Where("name LIKE ? OR address LIKE ?", "%"+keyword+"%", "%"+keyword+"%")
	}

	db.Count(&total)

	offset := (page - 1) * pageSize
	if err := db.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&projects).Error; err != nil {
		c.JSON(http.StatusOK, gin.H{"code": 1, "error": "获取项目列表失败"})
		return
	}

	// 补充关联信息
	type ProjectWithNames struct {
		model.Project
		OwnerName    string `json:"ownerName"`
		ProviderName string `json:"providerName"`
	}

	var result []ProjectWithNames
	for _, p := range projects {
		pwn := ProjectWithNames{Project: p}

		var owner model.User
		if err := repository.DB.Select("nickname").First(&owner, p.OwnerID).Error; err == nil {
			pwn.OwnerName = owner.Nickname
		}

		var provider model.Provider
		if err := repository.DB.Select("company_name").First(&provider, p.ProviderID).Error; err == nil {
			pwn.ProviderName = provider.CompanyName
		}

		result = append(result, pwn)
	}

	c.JSON(http.StatusOK, gin.H{
		"code":     0,
		"data":     result,
		"total":    total,
		"page":     page,
		"pageSize": pageSize,
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

	c.JSON(http.StatusOK, gin.H{"code": 0, "data": detail})
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

// AdminGetProjectPhases 获取项目阶段列表
func AdminGetProjectPhases(c *gin.Context) {
	id := c.Param("id")

	phases, err := adminProjectService.GetProjectPhases(parseUint(id))
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

	var req struct {
		Title       string `json:"title" binding:"required"`
		Description string `json:"description"`
		Photos      string `json:"photos"` // JSON 数组字符串
		LogDate     string `json:"logDate"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"code": 1, "error": "标题不能为空"})
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
		c.JSON(http.StatusOK, gin.H{"code": 1, "error": "创建日志失败"})
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
		updates["photos"] = req.Photos
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
