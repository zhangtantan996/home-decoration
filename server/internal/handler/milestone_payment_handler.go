package handler

import (
	"net/http"
	"strconv"

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
		response.Error(c, http.StatusBadRequest, "参数错误: "+err.Error())
		return
	}

	input := &service.CreateMilestonePaymentPlanInput{
		ProjectID:         projectID,
		ConstructionQuote: req.ConstructionQuote,
		CustomPlans:       req.CustomPlans,
	}

	milestones, err := h.service.CreateMilestonePaymentPlan(input)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.Success(c, gin.H{
		"milestones": milestones,
		"message":    "节点付款计划创建成功",
	})
}

// PayMilestoneRequest 支付节点款项请求
type PayMilestoneRequest struct {
	PaymentType string `json:"paymentType" binding:"required,oneof=wechat alipay balance"`
}

// PayMilestone 支付节点款项
// POST /api/v1/milestones/:id/pay
func (h *MilestonePaymentHandler) PayMilestone(c *gin.Context) {
	milestoneIDStr := c.Param("id")
	milestoneID, err := strconv.ParseUint(milestoneIDStr, 10, 64)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "无效的节点ID")
		return
	}

	var req PayMilestoneRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "参数错误: "+err.Error())
		return
	}

	// 从JWT获取用户ID
	userID, exists := c.Get("userID")
	if !exists {
		response.Error(c, http.StatusUnauthorized, "未授权")
		return
	}

	// 从查询参数获取项目ID
	projectIDStr := c.Query("projectId")
	projectID, err := strconv.ParseUint(projectIDStr, 10, 64)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "无效的项目ID")
		return
	}

	input := &service.PayMilestoneInput{
		ProjectID:   projectID,
		MilestoneID: milestoneID,
		UserID:      userID.(uint64),
		PaymentType: req.PaymentType,
	}

	transaction, err := h.service.PayMilestone(input)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.Success(c, gin.H{
		"transaction": transaction,
		"message":     "节点款项支付成功",
	})
}

// ReleaseMilestonePayment 确认节点完成并放款
// POST /api/v1/milestones/:id/release-payment
func (h *MilestonePaymentHandler) ReleaseMilestonePayment(c *gin.Context) {
	milestoneIDStr := c.Param("id")
	milestoneID, err := strconv.ParseUint(milestoneIDStr, 10, 64)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "无效的节点ID")
		return
	}

	// 从JWT获取用户ID
	userID, exists := c.Get("userID")
	if !exists {
		response.Error(c, http.StatusUnauthorized, "未授权")
		return
	}

	// 从查询参数获取项目ID
	projectIDStr := c.Query("projectId")
	projectID, err := strconv.ParseUint(projectIDStr, 10, 64)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "无效的项目ID")
		return
	}

	result, err := h.service.ReleaseMilestonePayment(projectID, milestoneID, userID.(uint64))
	if err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.Success(c, gin.H{
		"result":  result,
		"message": "节点款项已放款给商家",
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

	status, err := h.service.GetMilestonePaymentStatus(projectID)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.Success(c, status)
}
