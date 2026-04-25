package handler

import (
	"strconv"
	"strings"

	"home-decoration-server/internal/service"
	"home-decoration-server/pkg/response"

	"github.com/gin-gonic/gin"
)

var (
	adminBusinessFlowService = service.NewAdminBusinessFlowService()
	adminProjectDisputeSvc   = &service.ProjectDisputeService{}
)

type adminReasonRequest struct {
	Reason string `json:"reason"`
}

func AdminListBusinessFlows(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))
	filter := service.AdminBusinessFlowFilter{
		Keyword:           strings.TrimSpace(c.Query("keyword")),
		CurrentStage:      strings.TrimSpace(c.Query("currentStage")),
		OwnerUserID:       parseUint64(c.Query("ownerUserId")),
		ProviderID:        parseUint64(c.Query("providerId")),
		BookingID:         parseUint64(c.Query("bookingId")),
		ProjectID:         parseUint64(c.Query("projectId")),
		OrderStatus:       strings.TrimSpace(c.Query("orderStatus")),
		PaymentPlanStatus: strings.TrimSpace(c.Query("paymentPlanStatus")),
		SettlementStatus:  strings.TrimSpace(c.Query("settlementStatus")),
		PayoutStatus:      strings.TrimSpace(c.Query("payoutStatus")),
		RefundStatus:      strings.TrimSpace(c.Query("refundStatus")),
		RiskStatus:        strings.TrimSpace(c.Query("riskStatus")),
		Page:              page,
		PageSize:          pageSize,
	}
	if raw := strings.TrimSpace(c.Query("paymentPaused")); raw != "" {
		parsed, err := strconv.ParseBool(raw)
		if err != nil {
			response.BadRequest(c, "paymentPaused 参数错误")
			return
		}
		filter.PaymentPaused = &parsed
	}

	items, total, err := adminBusinessFlowService.List(filter)
	if err != nil {
		response.ServerError(c, "获取订单控制台列表失败")
		return
	}
	response.PageSuccess(c, items, total, filter.Page, filter.PageSize)
}

func AdminGetBusinessFlow(c *gin.Context) {
	detail, err := adminBusinessFlowService.GetDetail(strings.TrimSpace(c.Param("id")))
	if err != nil {
		respondScopedAccessError(c, err, "获取订单控制台详情失败")
		return
	}
	response.Success(c, detail)
}

func AdminConfirmProposal(c *gin.Context) {
	adminID := c.GetUint64("adminId")
	proposalID := parseUint64(c.Param("id"))
	if proposalID == 0 {
		response.BadRequest(c, "无效方案ID")
		return
	}
	var req adminReasonRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}

	proposal, err := proposalService.AdminConfirmProposal(adminID, proposalID, req.Reason)
	if err != nil {
		respondDomainMutationError(c, err, "方案确认失败")
		return
	}
	response.SuccessWithMessage(c, "平台已确认方案", gin.H{"proposal": proposal})
}

func AdminRejectProposal(c *gin.Context) {
	adminID := c.GetUint64("adminId")
	proposalID := parseUint64(c.Param("id"))
	if proposalID == 0 {
		response.BadRequest(c, "无效方案ID")
		return
	}
	var req service.RejectProposalInput
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}

	result, err := proposalService.AdminRejectProposal(adminID, proposalID, &req)
	if err != nil {
		respondDomainMutationError(c, err, "方案驳回失败")
		return
	}
	messageText := "平台已驳回方案"
	if result != nil && result.EnteredAbnormal {
		messageText = "方案已转异常订单，平台将介入处理"
	}
	response.SuccessWithMessage(c, messageText, gin.H{"result": result})
}

func AdminStartProject(c *gin.Context) {
	adminID := c.GetUint64("adminId")
	projectID := parseUint64(c.Param("id"))
	if projectID == 0 {
		response.BadRequest(c, "无效项目ID")
		return
	}
	var req service.StartProjectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}

	project, err := projectService.AdminStartProject(projectID, adminID, &req)
	if err != nil {
		respondDomainMutationError(c, err, "项目开工失败")
		return
	}
	response.SuccessWithMessage(c, "项目已开工", gin.H{"project": project})
}

func AdminPauseProject(c *gin.Context) {
	adminID := c.GetUint64("adminId")
	projectID := parseUint64(c.Param("id"))
	if projectID == 0 {
		response.BadRequest(c, "无效项目ID")
		return
	}
	var req service.ProjectPauseInput
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}

	project, err := adminProjectDisputeSvc.AdminPauseProject(projectID, adminID, &req)
	if err != nil {
		respondDomainMutationError(c, err, "项目暂停失败")
		return
	}
	response.SuccessWithMessage(c, "项目已暂停", gin.H{"project": project})
}

func AdminResumeProject(c *gin.Context) {
	adminID := c.GetUint64("adminId")
	projectID := parseUint64(c.Param("id"))
	if projectID == 0 {
		response.BadRequest(c, "无效项目ID")
		return
	}
	var req adminReasonRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}

	project, err := adminProjectDisputeSvc.AdminResumeProject(projectID, adminID, req.Reason)
	if err != nil {
		respondDomainMutationError(c, err, "项目恢复失败")
		return
	}
	response.SuccessWithMessage(c, "项目已恢复", gin.H{"project": project})
}

func AdminApproveProjectMilestone(c *gin.Context) {
	adminID := c.GetUint64("adminId")
	projectID := parseUint64(c.Param("id"))
	milestoneID := parseUint64(c.Param("milestoneId"))
	if projectID == 0 || milestoneID == 0 {
		response.BadRequest(c, "无效项目或节点ID")
		return
	}
	var req adminReasonRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}

	milestone, err := projectService.AdminAcceptMilestone(projectID, adminID, milestoneID, req.Reason)
	if err != nil {
		respondDomainMutationError(c, err, "节点验收失败")
		return
	}
	response.SuccessWithMessage(c, "节点验收通过", gin.H{"milestone": milestone})
}

func AdminRejectProjectMilestone(c *gin.Context) {
	adminID := c.GetUint64("adminId")
	projectID := parseUint64(c.Param("id"))
	milestoneID := parseUint64(c.Param("milestoneId"))
	if projectID == 0 || milestoneID == 0 {
		response.BadRequest(c, "无效项目或节点ID")
		return
	}
	var req adminReasonRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}

	milestone, err := projectService.AdminRejectMilestone(projectID, adminID, milestoneID, req.Reason)
	if err != nil {
		respondDomainMutationError(c, err, "节点驳回失败")
		return
	}
	response.SuccessWithMessage(c, "节点已驳回", gin.H{"milestone": milestone})
}

func AdminApproveProjectCompletion(c *gin.Context) {
	adminID := c.GetUint64("adminId")
	projectID := parseUint64(c.Param("id"))
	if projectID == 0 {
		response.BadRequest(c, "无效项目ID")
		return
	}
	var req adminReasonRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}

	result, err := projectService.AdminApproveProjectCompletion(projectID, adminID, req.Reason)
	if err != nil {
		respondDomainMutationError(c, err, "完工审批失败")
		return
	}
	response.SuccessWithMessage(c, "完工已通过", gin.H{
		"completion": result.Detail,
		"auditId":    result.AuditID,
		"project":    result.Project,
	})
}

func AdminRejectProjectCompletion(c *gin.Context) {
	adminID := c.GetUint64("adminId")
	projectID := parseUint64(c.Param("id"))
	if projectID == 0 {
		response.BadRequest(c, "无效项目ID")
		return
	}
	var req adminReasonRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}

	result, err := projectService.AdminRejectProjectCompletion(projectID, adminID, req.Reason)
	if err != nil {
		respondDomainMutationError(c, err, "完工驳回失败")
		return
	}
	response.SuccessWithMessage(c, "已驳回完工提交", gin.H{"completion": result})
}
