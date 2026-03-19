package handler

import (
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	"home-decoration-server/internal/service"
	"home-decoration-server/pkg/response"

	"github.com/gin-gonic/gin"
)

var designPaymentService = &service.DesignPaymentService{}

// ========== 用户端：设计支付流程 ==========

// PaySurveyDeposit 支付量房押金
func PaySurveyDeposit(c *gin.Context) {
	userID := getCurrentUserID(c)
	bookingID := parseUint64(c.Param("id"))
	if bookingID == 0 {
		response.BadRequest(c, "无效预约ID")
		return
	}

	result, err := designPaymentService.PaySurveyDeposit(userID, bookingID)
	if err != nil {
		response.ServerError(c, err.Error())
		return
	}

	response.Success(c, result)
}

// RefundSurveyDeposit 退还量房押金
func RefundSurveyDeposit(c *gin.Context) {
	userID := getCurrentUserID(c)
	bookingID := parseUint64(c.Param("id"))
	if bookingID == 0 {
		response.BadRequest(c, "无效预约ID")
		return
	}

	err := designPaymentService.RefundSurveyDeposit(userID, bookingID)
	if err != nil {
		response.ServerError(c, err.Error())
		return
	}

	response.SuccessWithMessage(c, "量房定金退款成功", nil)
}

// GetDesignFeeQuoteForUser 用户查看设计费报价
func GetDesignFeeQuoteForUser(c *gin.Context) {
	bookingID := parseUint64(c.Param("id"))
	if bookingID == 0 {
		response.BadRequest(c, "无效预约ID")
		return
	}

	result, err := designPaymentService.GetDesignFeeQuote(bookingID)
	if err != nil {
		response.ServerError(c, err.Error())
		return
	}

	response.Success(c, result)
}

// ConfirmDesignFeeQuote 用户确认设计费报价
func ConfirmDesignFeeQuote(c *gin.Context) {
	userID := getCurrentUserID(c)
	quoteID := parseUint64(c.Param("id"))
	if quoteID == 0 {
		response.BadRequest(c, "无效报价ID")
		return
	}

	result, err := designPaymentService.ConfirmDesignFeeQuote(userID, quoteID)
	if err != nil {
		response.ServerError(c, err.Error())
		return
	}

	response.Success(c, result)
}

// RejectDesignFeeQuote 用户拒绝设计费报价
func RejectDesignFeeQuote(c *gin.Context) {
	userID := getCurrentUserID(c)
	quoteID := parseUint64(c.Param("id"))
	if quoteID == 0 {
		response.BadRequest(c, "无效报价ID")
		return
	}

	var body struct {
		Reason string `json:"reason"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		response.BadRequest(c, "参数错误: "+err.Error())
		return
	}

	err := designPaymentService.RejectDesignFeeQuote(userID, quoteID, body.Reason)
	if err != nil {
		response.ServerError(c, err.Error())
		return
	}

	response.SuccessWithMessage(c, "已拒绝报价", nil)
}

// GetDesignDeliverable 获取设计交付物
func GetDesignDeliverable(c *gin.Context) {
	projectID := parseUint64(c.Param("id"))
	if projectID == 0 {
		response.BadRequest(c, "无效项目ID")
		return
	}

	var deliverable model.DesignDeliverable
	if err := repository.DB.Where("project_id = ?", projectID).Order("created_at DESC").First(&deliverable).Error; err != nil {
		response.BadRequest(c, "未找到设计交付物")
		return
	}

	response.Success(c, deliverable)
}

// AcceptDesignDeliverable 用户验收设计交付物
func AcceptDesignDeliverable(c *gin.Context) {
	userID := getCurrentUserID(c)
	deliverableID := parseUint64(c.Param("id"))
	if deliverableID == 0 {
		response.BadRequest(c, "无效交付物ID")
		return
	}

	result, err := designPaymentService.AcceptDesignDeliverable(userID, deliverableID)
	if err != nil {
		response.ServerError(c, err.Error())
		return
	}

	response.Success(c, result)
}

// RejectDesignDeliverable 用户驳回设计交付物
func RejectDesignDeliverable(c *gin.Context) {
	userID := getCurrentUserID(c)
	deliverableID := parseUint64(c.Param("id"))
	if deliverableID == 0 {
		response.BadRequest(c, "无效交付物ID")
		return
	}

	var body struct {
		Reason string `json:"reason"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		response.BadRequest(c, "参数错误: "+err.Error())
		return
	}

	result, err := designPaymentService.RejectDesignDeliverable(userID, deliverableID, body.Reason)
	if err != nil {
		response.ServerError(c, err.Error())
		return
	}

	response.Success(c, result)
}

// ========== 商家端：设计支付流程 ==========

// MerchantUploadWorkingDoc 商家上传工作文档
func MerchantUploadWorkingDoc(c *gin.Context) {
	providerID := getProviderIDFromContext(c)
	if providerID == 0 {
		response.BadRequest(c, "无法获取商家身份")
		return
	}

	bookingID := parseUint64(c.Param("id"))
	if bookingID == 0 {
		response.BadRequest(c, "无效预约ID")
		return
	}

	var input service.UploadWorkingDocInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, "参数错误: "+err.Error())
		return
	}

	result, err := designPaymentService.UploadWorkingDoc(providerID, bookingID, &input)
	if err != nil {
		response.ServerError(c, err.Error())
		return
	}

	response.Success(c, result)
}

// MerchantListWorkingDocs 商家查看工作文档列表
func MerchantListWorkingDocs(c *gin.Context) {
	bookingID := parseUint64(c.Param("id"))
	if bookingID == 0 {
		response.BadRequest(c, "无效预约ID")
		return
	}

	result, err := designPaymentService.ListWorkingDocs(bookingID)
	if err != nil {
		response.ServerError(c, err.Error())
		return
	}

	response.Success(c, result)
}

// MerchantCreateDesignFeeQuote 商家创建设计费报价
func MerchantCreateDesignFeeQuote(c *gin.Context) {
	providerID := getProviderIDFromContext(c)
	if providerID == 0 {
		response.BadRequest(c, "无法获取商家身份")
		return
	}

	bookingID := parseUint64(c.Param("id"))
	if bookingID == 0 {
		response.BadRequest(c, "无效预约ID")
		return
	}

	var input service.CreateDesignFeeQuoteInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, "参数错误: "+err.Error())
		return
	}

	result, err := designPaymentService.CreateDesignFeeQuote(providerID, bookingID, &input)
	if err != nil {
		response.ServerError(c, err.Error())
		return
	}

	response.Success(c, result)
}

// MerchantGetDesignFeeQuote 商家查看设计费报价
func MerchantGetDesignFeeQuote(c *gin.Context) {
	bookingID := parseUint64(c.Param("id"))
	if bookingID == 0 {
		response.BadRequest(c, "无效预约ID")
		return
	}

	result, err := designPaymentService.GetDesignFeeQuote(bookingID)
	if err != nil {
		response.ServerError(c, err.Error())
		return
	}

	response.Success(c, result)
}

// MerchantSubmitDeliverable 商家提交设计交付物
func MerchantSubmitDeliverable(c *gin.Context) {
	providerID := getProviderIDFromContext(c)
	if providerID == 0 {
		response.BadRequest(c, "无法获取商家身份")
		return
	}

	bookingID := parseUint64(c.Param("id"))
	if bookingID == 0 {
		response.BadRequest(c, "无效预约ID")
		return
	}

	var input service.SubmitDeliverableInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, "参数错误: "+err.Error())
		return
	}

	result, err := designPaymentService.SubmitDesignDeliverable(providerID, &input)
	if err != nil {
		response.ServerError(c, err.Error())
		return
	}

	response.Success(c, result)
}

// ========== 辅助函数 ==========

func getProviderIDFromContext(c *gin.Context) uint64 {
	providerID, exists := c.Get("providerId")
	if !exists {
		return 0
	}
	switch v := providerID.(type) {
	case float64:
		return uint64(v)
	case uint64:
		return v
	default:
		return 0
	}
}
