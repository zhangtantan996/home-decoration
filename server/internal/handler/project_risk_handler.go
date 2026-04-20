package handler

import (
	"strings"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	"home-decoration-server/internal/service"
	"home-decoration-server/pkg/response"

	"github.com/gin-gonic/gin"
)

var (
	projectDisputeService    = &service.ProjectDisputeService{}
	projectAuditService      = &service.ProjectAuditService{}
	refundApplicationService = &service.RefundApplicationService{}
)

func PauseProject(c *gin.Context) {
	projectID := parseUint64(c.Param("id"))
	if projectID == 0 {
		response.BadRequest(c, "无效项目ID")
		return
	}
	userID := c.GetUint64("userId")
	var input service.ProjectPauseInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}
	project, err := projectDisputeService.PauseProject(projectID, userID, &input)
	if err != nil {
		respondDomainMutationError(c, err, "暂停项目失败")
		return
	}
	response.Success(c, gin.H{"project": project})
}

func ResumeProject(c *gin.Context) {
	projectID := parseUint64(c.Param("id"))
	if projectID == 0 {
		response.BadRequest(c, "无效项目ID")
		return
	}
	userID := c.GetUint64("userId")
	project, err := projectDisputeService.ResumeProject(projectID, userID)
	if err != nil {
		respondDomainMutationError(c, err, "恢复项目失败")
		return
	}
	response.Success(c, gin.H{"project": project})
}

func SubmitProjectDispute(c *gin.Context) {
	projectID := parseUint64(c.Param("id"))
	if projectID == 0 {
		response.BadRequest(c, "无效项目ID")
		return
	}
	userID := c.GetUint64("userId")
	var input service.ProjectDisputeInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}
	result, err := projectDisputeService.SubmitProjectDispute(projectID, userID, &input)
	if err != nil {
		respondDomainMutationError(c, err, "提交项目争议失败")
		return
	}
	response.Success(c, result)
}

func CreateBookingRefundApplication(c *gin.Context) {
	bookingID := parseUint64(c.Param("id"))
	if bookingID == 0 {
		response.BadRequest(c, "无效预约ID")
		return
	}
	userID := c.GetUint64("userId")
	var input service.CreateRefundApplicationInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}
	result, err := refundApplicationService.CreateApplication(bookingID, userID, &input)
	if err != nil {
		respondDomainMutationError(c, err, "创建退款申请失败")
		return
	}
	response.Success(c, gin.H{"refundApplication": result})
}

func ListMyRefundApplications(c *gin.Context) {
	userID := c.GetUint64("userId")
	page := parseInt(c.DefaultQuery("page", "1"), 1)
	pageSize := parseInt(c.DefaultQuery("pageSize", "20"), 20)
	bookingID := parseUint64(c.Query("bookingId"))
	status := strings.TrimSpace(c.Query("status"))
	list, total, err := refundApplicationService.ListMyApplications(userID, &service.ListMyRefundApplicationsQuery{
		BookingID: bookingID,
		Status:    status,
		Page:      page,
		PageSize:  pageSize,
	})
	if err != nil {
		response.ServerError(c, "获取退款申请失败")
		return
	}
	response.Success(c, gin.H{
		"list":     list,
		"count":    len(list),
		"total":    total,
		"page":     page,
		"pageSize": pageSize,
	})
}

func AdminCreateProjectAudit(c *gin.Context) {
	projectID := parseUint64(c.Param("id"))
	if projectID == 0 {
		response.BadRequest(c, "无效项目ID")
		return
	}
	adminID := c.GetUint64("admin_id")
	var input service.CreateProjectAuditInput
	if c.Request.ContentLength > 0 {
		if err := c.ShouldBindJSON(&input); err != nil {
			response.BadRequest(c, "参数错误")
			return
		}
	}
	result, err := projectAuditService.EnsureAudit(projectID, adminID, &input)
	if err != nil {
		respondDomainMutationError(c, err, "创建审计单失败")
		return
	}
	response.Success(c, gin.H{"audit": result})
}

func AdminListProjectAudits(c *gin.Context) {
	page := parseInt(c.Query("page"), 1)
	pageSize := parseInt(c.Query("pageSize"), 20)
	status := strings.TrimSpace(c.Query("status"))
	list, total, err := projectAuditService.ListAudits(status, page, pageSize)
	if err != nil {
		response.ServerError(c, "获取审计列表失败")
		return
	}
	response.Success(c, gin.H{"list": list, "total": total, "page": page, "pageSize": pageSize})
}

func AdminGetProjectAudit(c *gin.Context) {
	auditID := parseUint64(c.Param("id"))
	if auditID == 0 {
		response.BadRequest(c, "无效审计ID")
		return
	}
	result, err := projectAuditService.GetAuditDetail(auditID)
	if err != nil {
		respondScopedAccessError(c, err, "获取审计单失败")
		return
	}
	response.Success(c, gin.H{"audit": result})
}

func AdminArbitrateProjectAudit(c *gin.Context) {
	auditID := parseUint64(c.Param("id"))
	if auditID == 0 {
		response.BadRequest(c, "无效审计ID")
		return
	}
	adminID := c.GetUint64("admin_id")
	var input service.ArbitrateProjectAuditInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}
	result, err := projectAuditService.Arbitrate(auditID, adminID, &input)
	if err != nil {
		respondDomainMutationError(c, err, "执行仲裁失败")
		return
	}
	response.Success(c, gin.H{"audit": result})
}

// AdminCloseProject 管理员关闭项目
func AdminCloseProject(c *gin.Context) {
	projectID := parseUint64(c.Param("id"))
	if projectID == 0 {
		response.BadRequest(c, "无效项目ID")
		return
	}
	adminID := c.GetUint64("admin_id")
	var input struct {
		ClosureType string `json:"closureType" binding:"required"`
		Reason      string `json:"reason" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}
	err := projectAuditService.CloseProject(projectID, adminID, input.ClosureType, input.Reason)
	if err != nil {
		respondDomainMutationError(c, err, "关闭项目失败")
		return
	}
	response.Success(c, gin.H{"message": "项目已关闭"})
}

// GetProjectClosure 获取项目关闭信息（用户端）
func GetProjectClosure(c *gin.Context) {
	projectID := parseUint64(c.Param("id"))
	if projectID == 0 {
		response.BadRequest(c, "无效项目ID")
		return
	}
	userID := c.GetUint64("userId")

	var project model.Project
	if err := repository.DB.Select("id, owner_id, name, status, closed_reason, closed_at, closure_type").First(&project, projectID).Error; err != nil {
		response.NotFound(c, "项目不存在")
		return
	}

	if project.OwnerID != userID {
		response.Forbidden(c, "无权查看此项目")
		return
	}

	if project.Status != model.ProjectStatusClosed {
		response.BadRequest(c, "项目未关闭")
		return
	}

	result := gin.H{
		"projectId":    project.ID,
		"projectName":  project.Name,
		"closureType":  project.ClosureType,
		"closedReason": project.ClosedReason,
		"closedAt":     project.ClosedAt,
	}

	// 查询退款信息
	if project.ClosureType == "abnormal" {
		var refundApp model.RefundApplication
		if err := repository.DB.Where("project_id = ?", projectID).Order("id DESC").First(&refundApp).Error; err == nil {
			result["refundAmount"] = refundApp.ApprovedAmount
			result["refundStatus"] = refundApp.Status
		}
	}

	// 查询结算信息
	if project.ClosureType == "normal" {
		var escrow model.EscrowAccount
		if err := repository.DB.Where("project_id = ?", projectID).First(&escrow).Error; err == nil {
			result["settlementAmount"] = escrow.ReleasedAmount
		}
	}

	response.Success(c, result)
}

func AdminListRefundApplications(c *gin.Context) {
	page := parseInt(c.Query("page"), 1)
	pageSize := parseInt(c.Query("pageSize"), 20)
	status := strings.TrimSpace(c.Query("status"))
	list, total, err := refundApplicationService.ListAdminApplications(status, page, pageSize)
	if err != nil {
		response.ServerError(c, "获取退款申请失败")
		return
	}
	response.Success(c, gin.H{"list": list, "total": total, "page": page, "pageSize": pageSize})
}

func AdminGetRefundApplication(c *gin.Context) {
	id := parseUint64(c.Param("id"))
	if id == 0 {
		response.BadRequest(c, "无效退款申请ID")
		return
	}
	result, err := refundApplicationService.GetApplicationDetail(id)
	if err != nil {
		respondScopedAccessError(c, err, "获取退款申请失败")
		return
	}
	response.Success(c, gin.H{"refundApplication": result})
}

func AdminApproveRefundApplication(c *gin.Context) {
	id := parseUint64(c.Param("id"))
	if id == 0 {
		response.BadRequest(c, "无效退款申请ID")
		return
	}
	adminID := c.GetUint64("admin_id")
	var input service.ReviewRefundApplicationInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}
	result, err := refundApplicationService.ApproveApplication(id, adminID, &input)
	if err != nil {
		respondDomainMutationError(c, err, "审核退款申请失败")
		return
	}
	response.Success(c, gin.H{"refundApplication": result})
}

func AdminRejectRefundApplication(c *gin.Context) {
	id := parseUint64(c.Param("id"))
	if id == 0 {
		response.BadRequest(c, "无效退款申请ID")
		return
	}
	adminID := c.GetUint64("admin_id")
	var input service.RejectRefundApplicationInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}
	result, err := refundApplicationService.RejectApplication(id, adminID, &input)
	if err != nil {
		respondDomainMutationError(c, err, "驳回退款申请失败")
		return
	}
	response.Success(c, gin.H{"refundApplication": result})
}

func MerchantGetProjectDispute(c *gin.Context) {
	providerID := c.GetUint64("providerId")
	projectID := parseUint64(c.Param("projectId"))
	if projectID == 0 {
		response.BadRequest(c, "无效项目ID")
		return
	}
	result, err := projectDisputeService.GetMerchantProjectDisputeDetail(projectID, providerID)
	if err != nil {
		respondScopedAccessError(c, err, "获取项目争议失败")
		return
	}
	response.Success(c, result)
}

func MerchantRespondProjectDispute(c *gin.Context) {
	providerID := c.GetUint64("providerId")
	projectID := parseUint64(c.Param("projectId"))
	if projectID == 0 {
		response.BadRequest(c, "无效项目ID")
		return
	}
	var input struct {
		Response string `json:"response"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}
	complaint, err := projectDisputeService.RespondProjectDispute(projectID, providerID, input.Response)
	if err != nil {
		respondDomainMutationError(c, err, "处理项目争议失败")
		return
	}
	response.Success(c, gin.H{"complaint": complaint})
}
