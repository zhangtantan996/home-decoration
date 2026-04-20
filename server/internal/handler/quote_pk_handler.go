package handler

import (
	"home-decoration-server/internal/service"
	"home-decoration-server/pkg/response"
	"strconv"

	"github.com/gin-gonic/gin"
)

var quotePKService = &service.QuotePKService{}

// CreateQuoteTask 用户发起报价需求
func CreateQuoteTask(c *gin.Context) {
	userID := c.GetUint64("userId")

	var req service.CreateQuoteTaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误: "+err.Error())
		return
	}

	task, err := quotePKService.CreateQuoteTask(userID, req)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Success(c, task)
}

// GetQuoteTask 获取报价任务详情
func GetQuoteTask(c *gin.Context) {
	userID := c.GetUint64("userId")
	taskIDStr := c.Param("id")

	taskID, err := strconv.ParseUint(taskIDStr, 10, 64)
	if err != nil {
		response.BadRequest(c, "任务ID格式错误")
		return
	}

	task, err := quotePKService.GetQuoteTaskByID(userID, taskID)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Success(c, task)
}

// GetQuoteComparison 获取报价对比表
func GetQuoteComparison(c *gin.Context) {
	userID := c.GetUint64("userId")
	taskIDStr := c.Param("id")

	taskID, err := strconv.ParseUint(taskIDStr, 10, 64)
	if err != nil {
		response.BadRequest(c, "任务ID格式错误")
		return
	}

	items, err := quotePKService.GetQuoteComparison(userID, taskID)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Success(c, items)
}

// SelectQuote 用户选择报价
func SelectQuote(c *gin.Context) {
	userID := c.GetUint64("userId")
	taskIDStr := c.Param("id")

	taskID, err := strconv.ParseUint(taskIDStr, 10, 64)
	if err != nil {
		response.BadRequest(c, "任务ID格式错误")
		return
	}

	var req struct {
		SubmissionID uint64 `json:"submissionId" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误: "+err.Error())
		return
	}

	if err := quotePKService.SelectQuote(userID, taskID, req.SubmissionID); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Success(c, gin.H{"message": "选择成功"})
}

// MerchantSubmitQuote 工长提交报价
func MerchantSubmitQuote(c *gin.Context) {
	providerID := c.GetUint64("providerId")
	taskIDStr := c.Param("id")

	taskID, err := strconv.ParseUint(taskIDStr, 10, 64)
	if err != nil {
		response.BadRequest(c, "任务ID格式错误")
		return
	}

	var req service.SubmitQuoteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误: "+err.Error())
		return
	}

	submission, err := quotePKService.SubmitQuote(providerID, taskID, req)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Success(c, submission)
}

// MerchantGetQuoteTasks 商家获取报价任务列表
func MerchantGetQuoteTasks(c *gin.Context) {
	providerID := c.GetUint64("providerId")

	tasks, err := quotePKService.GetMerchantQuoteTasks(providerID)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Success(c, tasks)
}
