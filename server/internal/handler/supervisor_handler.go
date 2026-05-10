package handler

import (
	"encoding/json"
	"strings"

	"home-decoration-server/internal/service"
	"home-decoration-server/pkg/response"

	"github.com/gin-gonic/gin"
)

var supervisorScopedService = service.NewSupervisorScopedService()

// SupervisorDashboard 监理工作台概览
func SupervisorDashboard(c *gin.Context) {
	supervisorID := c.GetUint64("supervisorId")

	// 获取分配的项目列表（取前 5 个活跃项目）
	list, total, err := supervisorScopedService.ListAssignedProjects(supervisorID, &service.SupervisionProjectListQuery{
		Page:     1,
		PageSize: 5,
	})
	if err != nil {
		response.ServerError(c, "获取工作台数据失败")
		return
	}

	response.Success(c, gin.H{
		"totalProjects":    total,
		"recentProjects":   list,
	})
}

// SupervisorListProjects 获取分配给监理的项目列表
func SupervisorListProjects(c *gin.Context) {
	supervisorID := c.GetUint64("supervisorId")
	page := parseInt(c.DefaultQuery("page", "1"), 1)
	pageSize := parseInt(c.DefaultQuery("pageSize", "20"), 20)

	var hasPendingRisk *bool
	if raw := strings.TrimSpace(c.Query("hasPendingRisk")); raw != "" {
		value := raw == "true" || raw == "1"
		hasPendingRisk = &value
	}

	list, total, err := supervisorScopedService.ListAssignedProjects(supervisorID, &service.SupervisionProjectListQuery{
		Page:           page,
		PageSize:       pageSize,
		Keyword:        c.Query("keyword"),
		PhaseStatus:    c.Query("phaseStatus"),
		BusinessStage:  c.Query("businessStage"),
		HasPendingRisk: hasPendingRisk,
	})
	if err != nil {
		response.ServerError(c, "获取项目列表失败")
		return
	}

	response.PageSuccess(c, list, total, page, pageSize)
}

// SupervisorGetProject 获取项目工作台详情
func SupervisorGetProject(c *gin.Context) {
	supervisorID := c.GetUint64("supervisorId")
	projectID := parseUint64(c.Param("id"))
	if projectID == 0 {
		response.BadRequest(c, "无效项目ID")
		return
	}

	workspace, err := supervisorScopedService.GetProjectWorkspace(supervisorID, projectID)
	if err != nil {
		respondScopedAccessError(c, err, "获取项目详情失败")
		return
	}

	response.Success(c, workspace)
}

// SupervisorGetProjectPhases 获取项目施工阶段
func SupervisorGetProjectPhases(c *gin.Context) {
	supervisorID := c.GetUint64("supervisorId")
	projectID := parseUint64(c.Param("id"))
	if projectID == 0 {
		response.BadRequest(c, "无效项目ID")
		return
	}

	phases, err := supervisorScopedService.GetProjectPhases(supervisorID, projectID)
	if err != nil {
		respondScopedAccessError(c, err, "获取施工阶段失败")
		return
	}

	response.Success(c, gin.H{"phases": phases})
}

// SupervisorListLogs 获取施工日志
func SupervisorListLogs(c *gin.Context) {
	supervisorID := c.GetUint64("supervisorId")
	projectID := parseUint64(c.Param("id"))
	if projectID == 0 {
		response.BadRequest(c, "无效项目ID")
		return
	}

	page := parseInt(c.DefaultQuery("page", "1"), 1)
	pageSize := parseInt(c.DefaultQuery("pageSize", "20"), 20)
	phaseID := parseUint64(c.Query("phaseId"))

	list, total, err := supervisorScopedService.GetProjectLogs(supervisorID, projectID, phaseID, page, pageSize)
	if err != nil {
		respondScopedAccessError(c, err, "获取施工日志失败")
		return
	}

	response.Success(c, gin.H{
		"list":     list,
		"total":    total,
		"page":     page,
		"pageSize": pageSize,
	})
}

// SupervisorCreateLog 创建施工日志
func SupervisorCreateLog(c *gin.Context) {
	supervisorID := c.GetUint64("supervisorId")
	projectID := parseUint64(c.Param("id"))
	phaseID := parseUint64(c.Param("phaseId"))
	if projectID == 0 || phaseID == 0 {
		response.BadRequest(c, "无效项目或阶段ID")
		return
	}

	var req service.CreateWorkLogRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}

	log, err := supervisorScopedService.CreatePhaseLog(supervisorID, projectID, phaseID, &req)
	if err != nil {
		respondDomainMutationError(c, err, "新增施工日志失败")
		return
	}

	response.SuccessWithMessage(c, "日志创建成功", gin.H{"log": log})
}

// SupervisorSyncOfflineLogs 批量同步离线日志
func SupervisorSyncOfflineLogs(c *gin.Context) {
	supervisorID := c.GetUint64("supervisorId")
	projectID := parseUint64(c.Param("id"))
	if projectID == 0 {
		response.BadRequest(c, "无效项目ID")
		return
	}

	var input struct {
		Drafts []struct {
			PhaseID          uint64   `json:"phaseId"`
			Description      string   `json:"description"`
			Photos           []string `json:"photos"`
			OfflineCreatedAt string   `json:"offlineCreatedAt"`
		} `json:"drafts"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}

	type syncResult struct {
		Index   int    `json:"index"`
		Success bool   `json:"success"`
		Error   string `json:"error,omitempty"`
	}

	results := make([]syncResult, len(input.Drafts))
	for i, draft := range input.Drafts {
		photoBytes, _ := json.Marshal(draft.Photos)
		req := &service.CreateWorkLogRequest{
			Title:       "离线日志同步",
			Description: draft.Description,
			Photos:      string(photoBytes),
		}
		_, err := supervisorScopedService.CreatePhaseLog(supervisorID, projectID, draft.PhaseID, req)
		if err != nil {
			results[i] = syncResult{Index: i, Success: false, Error: err.Error()}
		} else {
			results[i] = syncResult{Index: i, Success: true}
		}
	}

	response.Success(c, gin.H{"results": results})
}

// SupervisorUpdatePhase 更新施工阶段
func SupervisorUpdatePhase(c *gin.Context) {
	supervisorID := c.GetUint64("supervisorId")
	projectID := parseUint64(c.Param("id"))
	phaseID := parseUint64(c.Param("phaseId"))
	if projectID == 0 || phaseID == 0 {
		response.BadRequest(c, "无效项目或阶段ID")
		return
	}

	var req service.UpdatePhaseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}

	if err := supervisorScopedService.UpdatePhase(supervisorID, projectID, phaseID, &req); err != nil {
		respondDomainMutationError(c, err, "更新施工阶段失败")
		return
	}

	response.SuccessWithMessage(c, "阶段更新成功", gin.H{"phaseId": phaseID})
}

// SupervisorUpdatePhaseTask 更新阶段任务
func SupervisorUpdatePhaseTask(c *gin.Context) {
	supervisorID := c.GetUint64("supervisorId")
	projectID := parseUint64(c.Param("id"))
	phaseID := parseUint64(c.Param("phaseId"))
	taskID := parseUint64(c.Param("taskId"))
	if projectID == 0 || phaseID == 0 || taskID == 0 {
		response.BadRequest(c, "无效参数")
		return
	}

	var req service.UpdatePhaseTaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}

	if err := supervisorScopedService.UpdatePhaseTask(supervisorID, projectID, phaseID, taskID, &req); err != nil {
		respondDomainMutationError(c, err, "更新阶段任务失败")
		return
	}

	response.SuccessWithMessage(c, "任务更新成功", gin.H{"taskId": taskID})
}

// SupervisorCreateRiskWarning 上报风险预警
func SupervisorCreateRiskWarning(c *gin.Context) {
	supervisorID := c.GetUint64("supervisorId")
	projectID := parseUint64(c.Param("id"))
	if projectID == 0 {
		response.BadRequest(c, "无效项目ID")
		return
	}

	var req service.CreateSupervisionRiskWarningInput
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}

	warning, err := supervisorScopedService.CreateRiskWarning(supervisorID, projectID, &req)
	if err != nil {
		respondDomainMutationError(c, err, "上报风险失败")
		return
	}

	response.SuccessWithMessage(c, "风险上报成功", gin.H{"warning": warning})
}
