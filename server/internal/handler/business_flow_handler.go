package handler

import (
	"fmt"
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	"home-decoration-server/internal/service"
	"home-decoration-server/pkg/response"

	"github.com/gin-gonic/gin"
)

var (
	proposalService = &service.ProposalService{}
	orderService    = &service.OrderService{}
	configSvc       = &service.ConfigService{}
)

// ========== 设计方案 ==========

// SubmitProposal 设计师提交方案
func SubmitProposal(c *gin.Context) {
	userID := c.GetUint64("userId")

	var input service.SubmitProposalInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.Error(c, 400, "参数错误: "+err.Error())
		return
	}

	proposal, err := proposalService.SubmitProposal(userID, &input)
	if err != nil {
		response.Error(c, 400, err.Error())
		return
	}

	response.Success(c, proposal)
}

// GetProposal 获取方案详情
func GetProposal(c *gin.Context) {
	proposalID := parseUint64(c.Param("id"))

	proposal, err := proposalService.GetProposal(proposalID)
	if err != nil {
		response.Error(c, 404, err.Error())
		return
	}

	// 查询关联的设计费订单
	var order model.Order
	var hasOrder bool
	if err := repository.DB.Where("proposal_id = ? AND order_type = ?", proposalID, "design").Order("created_at desc").First(&order).Error; err == nil {
		hasOrder = true
	}

	response.Success(c, gin.H{
		"proposal": proposal,
		"order":    order,
		"hasOrder": hasOrder,
	})
}

// GetProposalByBooking 根据预约获取方案
func GetProposalByBooking(c *gin.Context) {
	bookingID := parseUint64(c.Param("bookingId"))

	proposal, err := proposalService.GetProposalByBooking(bookingID)
	if err != nil {
		response.Error(c, 404, err.Error())
		return
	}

	response.Success(c, proposal)
}

// ConfirmProposal 用户确认方案 -> 创建设计费订单
func ConfirmProposal(c *gin.Context) {
	userID := c.GetUint64("userId")
	proposalID := parseUint64(c.Param("id"))

	order, err := proposalService.ConfirmProposal(userID, proposalID)
	if err != nil {
		response.Error(c, 400, err.Error())
		return
	}

	response.Success(c, gin.H{
		"order":   order,
		"message": "请在48小时内完成设计费支付",
	})
}

// RejectProposal 用户拒绝方案（支持拒绝原因）
func RejectProposal(c *gin.Context) {
	userID := c.GetUint64("userId")
	proposalID := parseUint64(c.Param("id"))

	var input service.RejectProposalInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.Error(c, 400, "参数错误: "+err.Error())
		return
	}

	if err := proposalService.RejectProposal(userID, proposalID, &input); err != nil {
		response.Error(c, 400, err.Error())
		return
	}

	response.Success(c, gin.H{"message": "方案已拒绝，商家可重新提交"})
}

// GetProposalVersionHistory 获取方案版本历史
func GetProposalVersionHistory(c *gin.Context) {
	bookingID := parseUint64(c.Param("bookingId"))

	proposals, err := proposalService.GetProposalVersionHistory(bookingID)
	if err != nil {
		response.Error(c, 500, err.Error())
		return
	}

	response.Success(c, proposals)
}

// ResubmitProposal 商家重新提交方案（生成新版本）
func ResubmitProposal(c *gin.Context) {
	designerID := c.GetUint64("providerId")

	var input service.ResubmitProposalInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.Error(c, 400, "参数错误: "+err.Error())
		return
	}

	proposal, err := proposalService.ResubmitProposal(designerID, &input)
	if err != nil {
		response.Error(c, 400, err.Error())
		return
	}

	response.Success(c, gin.H{
		"proposal": proposal,
		"message":  fmt.Sprintf("方案 v%d 已提交，等待用户确认", proposal.Version),
	})
}

// GetRejectionInfo 获取方案拒绝信息
func GetRejectionInfo(c *gin.Context) {
	designerID := c.GetUint64("providerId")
	proposalID := parseUint64(c.Param("id"))

	info, err := proposalService.GetRejectionInfo(designerID, proposalID)
	if err != nil {
		response.Error(c, 400, err.Error())
		return
	}

	response.Success(c, info)
}

// ListMyProposals 获取我收到的方案列表 (用户侧)
func ListMyProposals(c *gin.Context) {
	userID := c.GetUint64("userId")

	proposals, err := proposalService.ListProposalsByUser(userID)
	if err != nil {
		response.Error(c, 500, err.Error())
		return
	}

	response.Success(c, proposals)
}

// GetPendingCount 获取用户待处理数量
func GetPendingCount(c *gin.Context) {
	userID := c.GetUint64("userId")

	count, err := proposalService.GetPendingCount(userID)
	if err != nil {
		response.Error(c, 500, err.Error())
		return
	}

	response.Success(c, gin.H{"count": count})
}

// ListDesignerProposals 获取设计师提交的方案列表 (设计师侧)
func ListDesignerProposals(c *gin.Context) {
	userID := c.GetUint64("userId")

	proposals, err := proposalService.ListProposalsByDesigner(userID)
	if err != nil {
		response.Error(c, 500, err.Error())
		return
	}

	response.Success(c, proposals)
}

// ========== 订单与支付 ==========

// GenerateBill 生成项目账单
func GenerateBill(c *gin.Context) {
	userID := c.GetUint64("userId")

	var input service.GenerateBillInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.Error(c, 400, "参数错误: "+err.Error())
		return
	}

	bill, err := orderService.GenerateBill(userID, &input)
	if err != nil {
		response.Error(c, 400, err.Error())
		return
	}

	response.Success(c, bill)
}

// GetProjectBill 获取项目账单
func GetProjectBill(c *gin.Context) {
	projectID := parseUint64(c.Param("id"))

	orders, err := orderService.GetOrdersByProject(projectID)
	if err != nil {
		response.Error(c, 500, err.Error())
		return
	}

	// 获取每个订单的支付计划
	result := make([]gin.H, 0)
	for _, order := range orders {
		plans, _ := orderService.GetPaymentPlansByOrder(order.ID)
		result = append(result, gin.H{
			"order":        order,
			"paymentPlans": plans,
		})
	}

	response.Success(c, result)
}

// PayOrder 支付订单
func PayOrder(c *gin.Context) {
	userID := c.GetUint64("userId")
	orderID := parseUint64(c.Param("id"))

	order, err := orderService.PayOrder(userID, orderID)
	if err != nil {
		response.Error(c, 400, err.Error())
		return
	}

	response.Success(c, order)
}

// CancelOrder 取消订单
func CancelOrder(c *gin.Context) {
	userID := c.GetUint64("userId")
	orderID := parseUint64(c.Param("id"))

	if err := orderService.CancelOrder(userID, orderID); err != nil {
		response.Error(c, 400, err.Error())
		return
	}

	response.Success(c, gin.H{"message": "订单已取消"})
}

// PayPaymentPlan 支付分期款项
func PayPaymentPlan(c *gin.Context) {
	userID := c.GetUint64("userId")
	planID := parseUint64(c.Param("planId"))

	plan, err := orderService.PayPaymentPlan(userID, planID)
	if err != nil {
		response.Error(c, 400, err.Error())
		return
	}

	response.Success(c, plan)
}

// GetProjectFiles 获取项目文件（需验证设计费支付状态）
func GetProjectFiles(c *gin.Context) {
	userID := c.GetUint64("userId")
	projectID := parseUint64(c.Param("id"))

	canAccess, err := orderService.CanAccessDesignFiles(userID, projectID)
	if err != nil {
		response.Error(c, 400, err.Error())
		return
	}

	if !canAccess {
		response.Error(c, 403, "请先支付设计费后查看/下载设计图纸")
		return
	}

	// TODO: 返回实际文件列表
	response.Success(c, gin.H{
		"message": "设计费已支付，可访问文件",
		"files":   []string{}, // 实际项目中从文件存储获取
	})
}

// ========== 系统配置 ==========

// GetIntentFee 获取当前意向金金额
func GetIntentFee(c *gin.Context) {
	fee, err := configSvc.GetIntentFee()
	if err != nil {
		// 默认值
		fee = 99
	}

	response.Success(c, gin.H{
		"intentFee": fee,
	})
}

// AdminUpdateIntentFee 管理后台更新意向金 (仅管理员)
func AdminUpdateIntentFee(c *gin.Context) {
	var input struct {
		Value float64 `json:"value" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		response.Error(c, 400, "参数错误")
		return
	}

	err := configSvc.SetConfig("booking.intent_fee",
		fmt.Sprintf("%.2f", input.Value),
		"预约意向金金额（元）")
	if err != nil {
		response.Error(c, 500, "更新失败: "+err.Error())
		return
	}

	response.Success(c, gin.H{"message": "更新成功"})
}

// MerchantReopenProposal 商家重新发起方案
func MerchantReopenProposal(c *gin.Context) {
	userID := c.GetUint64("userId")
	proposalID := parseUint64(c.Param("id"))

	if err := proposalService.ReopenProposal(userID, proposalID); err != nil {
		response.Error(c, 400, err.Error())
		return
	}

	response.Success(c, gin.H{"message": "方案已重新发起，等待用户确认"})
}
