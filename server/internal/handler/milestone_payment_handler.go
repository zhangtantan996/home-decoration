package handler

import (
	"log"
	"net/http"
	"strconv"
	"strings"

	"home-decoration-server/internal/service"
	"home-decoration-server/pkg/response"

	"github.com/gin-gonic/gin"
)

type MilestonePaymentHandler struct {
	service *service.MilestonePaymentService
}

func NewMilestonePaymentHandler() *MilestonePaymentHandler {
	return &MilestonePaymentHandler{
		service: &service.MilestonePaymentService{},
	}
}

// CreateMilestonePaymentPlanRequest 创建节点付款计划请求
type CreateMilestonePaymentPlanRequest struct {
	ConstructionQuote float64                        `json:"constructionQuote" binding:"required,gt=0"`
	CustomPlans       []service.MilestonePaymentPlan `json:"customPlans"`
}

// CreateMilestonePaymentPlan 创建节点付款计划
// POST /api/v1/projects/:id/milestone-payment-plan
func (h *MilestonePaymentHandler) CreateMilestonePaymentPlan(c *gin.Context) {
	projectIDStr := c.Param("id")
	projectID, err := strconv.ParseUint(projectIDStr, 10, 64)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "无效的项目ID")
		return
	}

	var req CreateMilestonePaymentPlanRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "参数错误")
		return
	}

	input := &service.CreateMilestonePaymentPlanInput{
		ProjectID:         projectID,
		ConstructionQuote: req.ConstructionQuote,
		CustomPlans:       req.CustomPlans,
	}

	milestones, err := h.service.CreateMilestonePaymentPlan(input)
	if err != nil {
		respondMilestonePaymentError(c, "create milestone payment plan", err)
		return
	}

	response.Success(c, gin.H{
		"milestones": milestones,
		"message":    "节点付款计划创建成功",
	})
}

// PayMilestone 支付节点款项
// POST /api/v1/milestones/:id/pay
func (h *MilestonePaymentHandler) PayMilestone(c *gin.Context) {
	milestoneIDStr := c.Param("id")
	if _, err := strconv.ParseUint(milestoneIDStr, 10, 64); err != nil {
		response.Error(c, http.StatusBadRequest, "无效的节点ID")
		return
	}

	response.Error(c, http.StatusConflict, "节点直付入口已停用，请通过订单中心发起支付")
}

// ReleaseMilestonePayment 确认节点完成并提交结算
// POST /api/v1/milestones/:id/release-payment
func (h *MilestonePaymentHandler) ReleaseMilestonePayment(c *gin.Context) {
	milestoneIDStr := c.Param("id")
	milestoneID, err := strconv.ParseUint(milestoneIDStr, 10, 64)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "无效的节点ID")
		return
	}

	userID := getCurrentUserID(c)
	if userID == 0 {
		response.Error(c, http.StatusUnauthorized, "未授权")
		return
	}

	projectIDStr := c.Query("projectId")
	projectID, err := strconv.ParseUint(projectIDStr, 10, 64)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "无效的项目ID")
		return
	}

	result, err := h.service.ReleaseMilestonePayment(projectID, milestoneID, userID)
	if err != nil {
		respondMilestonePaymentError(c, "release milestone payment", err)
		return
	}

	response.Success(c, gin.H{
		"result":  result,
		"message": "节点结算已生成，等待线下打款确认",
	})
}

// GetMilestonePayments 获取项目节点付款状态
// GET /api/v1/projects/:id/milestone-payments
func (h *MilestonePaymentHandler) GetMilestonePayments(c *gin.Context) {
	projectIDStr := c.Param("id")
	projectID, err := strconv.ParseUint(projectIDStr, 10, 64)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "无效的项目ID")
		return
	}

	userID := getCurrentUserID(c)
	status, err := h.service.GetMilestonePaymentStatus(projectID, userID)
	if err != nil {
		respondMilestonePaymentError(c, "get milestone payments", err)
		return
	}

	response.Success(c, status)
}

func respondMilestonePaymentError(c *gin.Context, operation string, err error) {
	if err == nil {
		return
	}

	message := strings.TrimSpace(err.Error())
	switch {
	case strings.Contains(message, "项目ID不能为空"):
		response.Error(c, http.StatusBadRequest, "项目ID不能为空")
	case strings.Contains(message, "项目不存在"):
		response.Error(c, http.StatusNotFound, "项目不存在")
	case strings.Contains(message, "无权查看") || strings.Contains(message, "只有项目所有者"):
		response.Error(c, http.StatusForbidden, "无权操作此项目")
	case strings.Contains(message, "节点不存在"):
		response.Error(c, http.StatusNotFound, "节点不存在")
	case strings.Contains(message, "节点未通过验收") || strings.Contains(message, "节点已完成结算") || strings.Contains(message, "已创建节点付款计划"):
		response.Error(c, http.StatusConflict, message)
	case strings.Contains(message, "施工报价必须大于0") || strings.Contains(message, "节点百分比总和必须为100"):
		response.Error(c, http.StatusBadRequest, message)
	default:
		log.Printf("[MilestonePayment] %s failed: %v", operation, err)
		response.Error(c, http.StatusInternalServerError, "节点付款处理失败，请稍后重试")
	}
}
