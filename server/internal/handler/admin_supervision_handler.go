package handler

import (
	"strings"

	"home-decoration-server/internal/service"
	"home-decoration-server/pkg/response"

	"github.com/gin-gonic/gin"
)

var supervisionService = service.NewSupervisionService()

func AdminListSupervisionProjects(c *gin.Context) {
	page := parseInt(c.DefaultQuery("page", "1"), 1)
	pageSize := parseInt(c.DefaultQuery("pageSize", "20"), 20)
	var hasPendingRisk *bool
	if raw := strings.TrimSpace(c.Query("hasPendingRisk")); raw != "" {
		value := raw == "true" || raw == "1"
		hasPendingRisk = &value
	}

	list, total, err := supervisionService.ListProjects(&service.SupervisionProjectListQuery{
		Page:           page,
		PageSize:       pageSize,
		Keyword:        c.Query("keyword"),
		PhaseStatus:    c.Query("phaseStatus"),
		HasPendingRisk: hasPendingRisk,
	})
	if err != nil {
		response.ServerError(c, "获取监理项目列表失败")
		return
	}

	response.PageSuccess(c, list, total, page, pageSize)
}

func AdminGetSupervisionProject(c *gin.Context) {
	projectID := parseUint64(c.Param("id"))
	if projectID == 0 {
		response.BadRequest(c, "无效项目ID")
		return
	}

	workspace, err := supervisionService.GetProjectWorkspace(projectID)
	if err != nil {
		respondScopedAccessError(c, err, "获取监理工作台失败")
		return
	}

	response.Success(c, workspace)
}

func AdminGetSupervisionProjectPhases(c *gin.Context) {
	projectID := parseUint64(c.Param("id"))
	if projectID == 0 {
		response.BadRequest(c, "无效项目ID")
		return
	}

	phases, err := supervisionService.GetProjectPhaseViews(projectID)
	if err != nil {
		response.ServerError(c, "获取施工阶段失败")
		return
	}

	response.Success(c, gin.H{"phases": phases})
}

func AdminGetSupervisionProjectLogs(c *gin.Context) {
	projectID := parseUint64(c.Param("id"))
	if projectID == 0 {
		response.BadRequest(c, "无效项目ID")
		return
	}

	page := parseInt(c.DefaultQuery("page", "1"), 1)
	pageSize := parseInt(c.DefaultQuery("pageSize", "20"), 20)
	phaseID := parseUint64(c.Query("phaseId"))

	list, total, err := supervisionService.GetProjectLogs(projectID, phaseID, page, pageSize)
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

func AdminCreateSupervisionWorkLog(c *gin.Context) {
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

	log, err := supervisionService.CreatePhaseLog(projectID, phaseID, c.GetUint64("admin_id"), &req)
	if err != nil {
		respondDomainMutationError(c, err, "新增施工日志失败")
		return
	}

	response.SuccessWithMessage(c, "日志创建成功", gin.H{"log": log})
}

func AdminUpdateSupervisionPhase(c *gin.Context) {
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

	if err := supervisionService.UpdatePhase(projectID, phaseID, &req); err != nil {
		respondDomainMutationError(c, err, "更新施工阶段失败")
		return
	}

	response.SuccessWithMessage(c, "阶段更新成功", gin.H{"phaseId": phaseID})
}

func AdminUpdateSupervisionPhaseTask(c *gin.Context) {
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

	if err := supervisionService.UpdatePhaseTask(projectID, phaseID, taskID, &req); err != nil {
		respondDomainMutationError(c, err, "更新阶段任务失败")
		return
	}

	response.SuccessWithMessage(c, "任务更新成功", gin.H{"taskId": taskID})
}

func AdminCreateSupervisionRiskWarning(c *gin.Context) {
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

	warning, err := supervisionService.CreateRiskWarning(projectID, &req)
	if err != nil {
		respondDomainMutationError(c, err, "上报风险失败")
		return
	}

	response.SuccessWithMessage(c, "风险上报成功", gin.H{"warning": warning})
}
