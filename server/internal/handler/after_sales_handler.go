package handler

import (
	"home-decoration-server/internal/service"
	"home-decoration-server/pkg/response"
	"strconv"

	"github.com/gin-gonic/gin"
)

var afterSalesService = &service.AfterSalesService{}

// CreateAfterSales 创建售后申请
func CreateAfterSales(c *gin.Context) {
	userID := c.GetUint64("userId")

	var input service.CreateAfterSalesInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}

	afterSales, err := afterSalesService.Create(userID, &input)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.SuccessWithMessage(c, "售后申请已提交", afterSales)
}

// GetAfterSalesList 获取售后列表
func GetAfterSalesList(c *gin.Context) {
	userID := c.GetUint64("userId")

	// 可选状态过滤：status=0/1/2/3
	var status *int8
	if statusStr := c.Query("status"); statusStr != "" {
		s, err := strconv.ParseInt(statusStr, 10, 8)
		if err == nil {
			st := int8(s)
			status = &st
		}
	}

	list, err := afterSalesService.GetUserAfterSales(userID, status)
	if err != nil {
		response.ServerError(c, "获取售后列表失败")
		return
	}

	response.Success(c, list)
}

// GetAfterSalesDetail 获取售后详情
func GetAfterSalesDetail(c *gin.Context) {
	userID := c.GetUint64("userId")
	idStr := c.Param("id")

	id, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil {
		response.BadRequest(c, "无效的ID")
		return
	}

	detail, err := afterSalesService.GetByID(userID, id)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Success(c, detail)
}

// CancelAfterSales 取消售后申请
func CancelAfterSales(c *gin.Context) {
	userID := c.GetUint64("userId")
	idStr := c.Param("id")

	id, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil {
		response.BadRequest(c, "无效的ID")
		return
	}

	if err := afterSalesService.Cancel(userID, id); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.SuccessWithMessage(c, "售后申请已取消", nil)
}
