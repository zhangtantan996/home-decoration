package handler

import (
	"encoding/json"
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
		respondDomainMutationError(c, err, "提交方案失败")
		return
	}

	response.Success(c, proposal)
}

// GetProposal 获取方案详情
func GetProposal(c *gin.Context) {
	proposalID := parseUint64(c.Param("id"))

	proposal, err := proposalService.GetProposal(proposalID)
	if err != nil {
		respondScopedAccessError(c, err, "获取方案失败")
		return
	}

	// 查询关联的设计费订单
	var order model.Order
	var hasOrder bool
	deliveryUnlocked := false
	if err := repository.DB.Where("proposal_id = ? AND order_type = ?", proposalID, "design").Order("created_at desc").First(&order).Error; err == nil {
		if order.Status == model.OrderStatusPending {
			if _, syncErr := paymentService.SyncLatestPendingBizPayment(model.PaymentBizTypeOrder, order.ID); syncErr == nil {
				_ = repository.DB.First(&order, order.ID).Error
			}
		}
		hasOrder = true
		if order.Status == model.OrderStatusPaid && configSvc.GetDesignFeeUnlockDownload() {
			deliveryUnlocked = true
		}
	}

	responseProposal := *proposal
	responseProposal.InternalDraftJSON = "{}"
	responseProposal.Attachments = "[]"
	if !deliveryUnlocked {
		responseProposal.DeliveryPackageJSON = "{}"
	}

	response.Success(c, gin.H{
		"proposal":         responseProposal,
		"order":            order,
		"hasOrder":         hasOrder,
		"deliveryUnlocked": deliveryUnlocked,
	})
}

// GetProposalByBooking 根据预约获取方案
func GetProposalByBooking(c *gin.Context) {
	bookingID := parseUint64(c.Param("bookingId"))

	proposal, err := proposalService.GetProposalByBooking(bookingID)
	if err != nil {
		respondScopedAccessError(c, err, "获取方案失败")
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
		respondDomainMutationError(c, err, "确认方案失败")
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

	result, err := proposalService.RejectProposal(userID, proposalID, &input)
	if err != nil {
		respondDomainMutationError(c, err, "拒绝方案失败")
		return
	}

	messageText := "方案已拒绝，商家可重新提交"
	if result != nil && result.EnteredAbnormal {
		messageText = "方案已转异常订单，平台将介入处理"
	}

	response.Success(c, gin.H{"message": messageText, "result": result})
}

// GetProposalVersionHistory 获取方案版本历史
func GetProposalVersionHistory(c *gin.Context) {
	bookingID := parseUint64(c.Param("bookingId"))

	proposals, err := proposalService.GetProposalVersionHistory(bookingID)
	if err != nil {
		respondScopedAccessError(c, err, "获取方案历史失败")
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
		respondDomainMutationError(c, err, "重新提交方案失败")
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
		respondScopedAccessError(c, err, "获取拒绝信息失败")
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
	respondLegacyConflict(c, "旧项目账单生成入口已禁用，请改用正式订单与支付计划链路", projectBillLegacyDisabledCode)
}

// GetProjectBill 获取项目账单
func GetProjectBill(c *gin.Context) {
	userID := c.GetUint64("userId")
	projectID := parseUint64(c.Param("id"))

	items, err := orderService.GetProjectBillForOwner(projectID, userID)
	if err != nil {
		respondScopedAccessError(c, err, "获取项目账单失败")
		return
	}

	response.Success(c, items)
}

// PayOrder 支付订单
func PayOrder(c *gin.Context) {
	userID := c.GetUint64("userId")
	orderID := parseUint64(c.Param("id"))
	if orderID == 0 {
		response.BadRequest(c, "无效订单ID")
		return
	}
	req, err := bindPaymentLaunchRequest(c)
	if err != nil {
		response.BadRequest(c, "支付参数错误")
		return
	}

	result, err := paymentService.StartOrderPayment(userID, orderID, req.Channel, req.TerminalType)
	if err != nil {
		respondDomainMutationError(c, err, "发起订单支付失败")
		return
	}

	response.Success(c, result)
}

// CancelOrder 取消订单
func CancelOrder(c *gin.Context) {
	userID := c.GetUint64("userId")
	orderID := parseUint64(c.Param("id"))

	if err := orderService.CancelOrder(userID, orderID); err != nil {
		respondDomainMutationError(c, err, "取消订单失败")
		return
	}

	response.Success(c, gin.H{"message": "订单已取消"})
}

// PayPaymentPlan 支付分期款项
func PayPaymentPlan(c *gin.Context) {
	userID := c.GetUint64("userId")
	planID := parseUint64(c.Param("planId"))
	if planID == 0 {
		response.BadRequest(c, "无效支付计划ID")
		return
	}
	req, err := bindPaymentLaunchRequest(c)
	if err != nil {
		response.BadRequest(c, "支付参数错误")
		return
	}

	result, err := paymentService.StartPaymentPlanPayment(userID, planID, req.Channel, req.TerminalType)
	if err != nil {
		respondDomainMutationError(c, err, "发起分期支付失败")
		return
	}

	response.Success(c, result)
}

// GetProjectFiles 获取项目文件（需验证设计费支付状态）
func GetProjectFiles(c *gin.Context) {
	userID := c.GetUint64("userId")
	projectID := parseUint64(c.Param("id"))

	canAccess, err := orderService.CanAccessDesignFiles(userID, projectID)
	if err != nil {
		respondScopedAccessError(c, err, "校验图纸访问权限失败")
		return
	}

	if !canAccess {
		response.Error(c, 403, "请先支付设计费后查看/下载设计图纸")
		return
	}

	// 获取项目关联的设计方案
	var project model.Project
	if err := repository.DB.First(&project, projectID).Error; err != nil {
		response.Error(c, 404, "项目不存在")
		return
	}

	// 通过 ProposalID 获取方案附件
	var files []string
	if project.ProposalID > 0 {
		var proposal model.Proposal
		if err := repository.DB.Select("attachments").First(&proposal, project.ProposalID).Error; err == nil {
			if proposal.Attachments != "" {
				// 尝试解析 JSON 数组
				if err := json.Unmarshal([]byte(proposal.Attachments), &files); err != nil {
					// 如果不是 JSON 数组，当作单个文件处理
					files = []string{proposal.Attachments}
				}
			}
		}
	}

	response.Success(c, gin.H{
		"message": "设计费已支付，可访问文件",
		"files":   files,
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
		respondDomainMutationError(c, err, "重新发起方案失败")
		return
	}

	response.Success(c, gin.H{"message": "方案已重新发起，等待用户确认"})
}
