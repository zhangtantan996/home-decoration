package handler

import (
	"strings"

	"home-decoration-server/internal/service"
	"home-decoration-server/pkg/response"

	"github.com/gin-gonic/gin"
)

func MerchantGetSiteSurvey(c *gin.Context) {
	providerID := c.GetUint64("providerId")
	bookingID := parseUint64(c.Param("id"))
	if bookingID == 0 {
		response.BadRequest(c, "无效预约ID")
		return
	}
	result, err := bookingService.GetMerchantSiteSurvey(providerID, bookingID)
	if err != nil {
		respondScopedAccessError(c, err, "获取量房记录失败")
		return
	}
	response.Success(c, gin.H{"siteSurvey": result})
}

func MerchantGetBookingFlowSummary(c *gin.Context) {
	providerID := c.GetUint64("providerId")
	bookingID := parseUint64(c.Param("id"))
	if bookingID == 0 {
		response.BadRequest(c, "无效预约ID")
		return
	}
	result, err := bookingService.GetMerchantDesignerFlowWorkspace(providerID, bookingID)
	if err != nil {
		respondScopedAccessError(c, err, "获取设计流程失败")
		return
	}
	response.Success(c, result)
}

func MerchantSubmitSiteSurvey(c *gin.Context) {
	providerID := c.GetUint64("providerId")
	bookingID := parseUint64(c.Param("id"))
	if bookingID == 0 {
		response.BadRequest(c, "无效预约ID")
		return
	}
	var req service.SiteSurveyPayload
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}
	result, err := bookingService.SubmitMerchantSiteSurvey(providerID, bookingID, &req)
	if err != nil {
		respondDomainMutationError(c, err, "提交量房记录失败")
		return
	}
	response.SuccessWithMessage(c, "量房记录提交成功", gin.H{"siteSurvey": result})
}

func GetSiteSurvey(c *gin.Context) {
	userID := c.GetUint64("userId")
	bookingID := parseUint64(c.Param("id"))
	if bookingID == 0 {
		response.BadRequest(c, "无效预约ID")
		return
	}
	result, err := bookingService.GetUserSiteSurvey(userID, bookingID)
	if err != nil {
		respondScopedAccessError(c, err, "获取量房记录失败")
		return
	}
	response.Success(c, gin.H{"siteSurvey": result})
}

func MerchantGetBudgetConfirmation(c *gin.Context) {
	providerID := c.GetUint64("providerId")
	bookingID := parseUint64(c.Param("id"))
	if bookingID == 0 {
		response.BadRequest(c, "无效预约ID")
		return
	}
	result, err := bookingService.GetMerchantBudgetConfirmation(providerID, bookingID)
	if err != nil {
		respondScopedAccessError(c, err, "获取预算确认失败")
		return
	}
	response.Success(c, gin.H{"budgetConfirmation": result})
}

func MerchantSubmitBudgetConfirmation(c *gin.Context) {
	providerID := c.GetUint64("providerId")
	bookingID := parseUint64(c.Param("id"))
	if bookingID == 0 {
		response.BadRequest(c, "无效预约ID")
		return
	}
	var req service.BudgetConfirmationPayload
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}
	result, err := bookingService.SubmitMerchantBudgetConfirmation(providerID, bookingID, &req)
	if err != nil {
		respondDomainMutationError(c, err, "提交预算确认失败")
		return
	}
	response.SuccessWithMessage(c, "预算确认提交成功", gin.H{"budgetConfirmation": result})
}

func GetBudgetConfirmation(c *gin.Context) {
	userID := c.GetUint64("userId")
	bookingID := parseUint64(c.Param("id"))
	if bookingID == 0 {
		response.BadRequest(c, "无效预约ID")
		return
	}
	result, err := bookingService.GetUserBudgetConfirmation(userID, bookingID)
	if err != nil {
		respondScopedAccessError(c, err, "获取预算确认失败")
		return
	}
	response.Success(c, gin.H{"budgetConfirmation": result})
}

func AcceptBudgetConfirmation(c *gin.Context) {
	userID := c.GetUint64("userId")
	bookingID := parseUint64(c.Param("id"))
	if bookingID == 0 {
		response.BadRequest(c, "无效预约ID")
		return
	}
	result, err := bookingService.AcceptBudgetConfirmation(userID, bookingID)
	if err != nil {
		respondDomainMutationError(c, err, "确认预算失败")
		return
	}
	response.SuccessWithMessage(c, "预算确认成功，可进入设计方案阶段", gin.H{"budgetConfirmation": result})
}

func RejectBudgetConfirmation(c *gin.Context) {
	userID := c.GetUint64("userId")
	bookingID := parseUint64(c.Param("id"))
	if bookingID == 0 {
		response.BadRequest(c, "无效预约ID")
		return
	}
	var req struct {
		Reason string `json:"reason"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}
	result, err := bookingService.RejectBudgetConfirmation(userID, bookingID, req.Reason)
	if err != nil {
		respondDomainMutationError(c, err, "拒绝预算失败")
		return
	}
	message := "已退回沟通结果，等待商家重新整理后提交"
	if result != nil && result.RejectCount >= result.RejectLimit {
		message = "沟通确认已达到驳回上限，预约已关闭"
	}
	response.SuccessWithMessage(c, message, gin.H{"budgetConfirmation": result})
}

func MerchantCompleteProject(c *gin.Context) {
	providerID := c.GetUint64("providerId")
	projectID := parseUint64(c.Param("projectId"))
	if projectID == 0 {
		response.BadRequest(c, "无效项目ID")
		return
	}
	var req service.ProjectCompletionPayload
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}
	result, err := projectService.SubmitProjectCompletion(projectID, providerID, &req)
	if err != nil {
		respondDomainMutationError(c, err, "提交完工失败")
		return
	}
	response.SuccessWithMessage(c, "项目完工提交成功", gin.H{"completion": result})
}

func GetProjectCompletion(c *gin.Context) {
	userID := c.GetUint64("userId")
	projectID := parseUint64(c.Param("id"))
	if projectID == 0 {
		response.BadRequest(c, "无效项目ID")
		return
	}
	result, err := projectService.GetProjectCompletion(projectID, userID)
	if err != nil {
		respondScopedAccessError(c, err, "获取完工信息失败")
		return
	}
	response.Success(c, gin.H{"completion": result})
}

func ApproveProjectCompletion(c *gin.Context) {
	userID := c.GetUint64("userId")
	projectID := parseUint64(c.Param("id"))
	if projectID == 0 {
		response.BadRequest(c, "无效项目ID")
		return
	}
	result, err := projectService.ApproveProjectCompletion(projectID, userID)
	if err != nil {
		respondDomainMutationError(c, err, "整体验收失败")
		return
	}
	response.SuccessWithMessage(c, "项目验收通过，已自动生成灵感案例草稿", gin.H{
		"completion": result.Detail,
		"auditId":    result.AuditID,
		"project":    result.Project,
	})
}

func RejectProjectCompletion(c *gin.Context) {
	userID := c.GetUint64("userId")
	projectID := parseUint64(c.Param("id"))
	if projectID == 0 {
		response.BadRequest(c, "无效项目ID")
		return
	}
	var req struct {
		Reason string `json:"reason"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}
	result, err := projectService.RejectProjectCompletion(projectID, userID, strings.TrimSpace(req.Reason))
	if err != nil {
		respondDomainMutationError(c, err, "驳回完工失败")
		return
	}
	response.SuccessWithMessage(c, "已驳回完工，项目退回整改", gin.H{"completion": result})
}

func SubmitProjectReview(c *gin.Context) {
	userID := c.GetUint64("userId")
	projectID := parseUint64(c.Param("id"))
	if projectID == 0 {
		response.BadRequest(c, "无效项目ID")
		return
	}

	var req service.ProjectReviewPayload
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}

	result, err := projectService.SubmitProjectReview(projectID, userID, &req)
	if err != nil {
		respondDomainMutationError(c, err, "提交正式评价失败")
		return
	}

	response.SuccessWithMessage(c, "正式评价提交成功", gin.H{"review": result})
}
