package handler

import (
	"log"
	"strconv"

	"home-decoration-server/internal/service"
	"home-decoration-server/pkg/response"

	"github.com/gin-gonic/gin"
)

var quotePKService = &service.QuotePKService{}

// CreateQuoteTask 用户发起报价需求
func CreateQuoteTask(c *gin.Context) {
	respondLegacyConflict(c, "该报价入口已停用，请前往施工报价页面处理", legacyQuotePKRetiredCode)
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
		respondQuotePKError(c, "get quote task", err, "获取报价任务失败，请稍后重试")
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
		respondQuotePKError(c, "get quote comparison", err, "获取报价对比失败，请稍后重试")
		return
	}

	response.Success(c, items)
}

// SelectQuote 用户选择报价
func SelectQuote(c *gin.Context) {
	respondLegacyConflict(c, "该报价确认入口已停用，请前往施工报价页面处理", legacyQuotePKRetiredCode)
}

// MerchantSubmitQuote 工长提交报价
func MerchantSubmitQuote(c *gin.Context) {
	respondLegacyConflict(c, "该报价提交入口已停用，请前往施工报价页面处理", legacyQuotePKRetiredCode)
}

// MerchantGetQuoteTasks 商家获取报价任务列表
func MerchantGetQuoteTasks(c *gin.Context) {
	providerID := c.GetUint64("providerId")

	tasks, err := quotePKService.GetMerchantQuoteTasks(providerID)
	if err != nil {
		respondQuotePKError(c, "merchant get quote tasks", err, "获取报价任务失败，请稍后重试")
		return
	}

	response.Success(c, tasks)
}

func respondQuotePKError(c *gin.Context, operation string, err error, fallbackMessage string) {
	if err == nil {
		return
	}

	switch err.Error() {
	case "预约不存在":
		response.NotFound(c, "预约不存在")
	case "报价任务不存在":
		response.NotFound(c, "报价任务不存在")
	case "报价不存在":
		response.NotFound(c, "报价不存在")
	case "报价任务已过期":
		response.Conflict(c, "报价任务已过期")
	case "报价任务已完成":
		response.Conflict(c, "报价任务已完成")
	case "您已提交过报价":
		response.Conflict(c, "已提交过报价")
	case "暂无可用工长":
		response.BadRequest(c, "暂无可用工长")
	default:
		log.Printf("[QuotePK] %s failed: %v", operation, err)
		response.ServerError(c, fallbackMessage)
	}
}
