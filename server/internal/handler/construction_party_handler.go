package handler

import (
	"home-decoration-server/internal/service"
	"home-decoration-server/pkg/response"
	"strconv"

	"github.com/gin-gonic/gin"
)

// SelectConstructionParty 用户选择工长
func SelectConstructionParty(c *gin.Context) {
	// 获取用户ID
	userID := c.GetUint64("userId")
	if userID == 0 {
		response.Unauthorized(c, "未登录")
		return
	}

	// 获取 booking ID
	bookingIDStr := c.Param("id")
	bookingID, err := strconv.ParseUint(bookingIDStr, 10, 64)
	if err != nil {
		response.BadRequest(c, "无效的预约ID")
		return
	}

	// 绑定请求参数
	var req service.SelectConstructionPartyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误: "+err.Error())
		return
	}

	// 调用 Service
	if err := projectService.SelectConstructionParty(bookingID, userID, &req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Success(c, gin.H{
		"message": "工长选择成功，等待工长确认",
	})
}

// ConfirmConstructionParty 工长确认
func ConfirmConstructionParty(c *gin.Context) {
	// 获取 provider ID（从 JWT 中间件获取）
	providerID := c.GetUint64("providerId")
	if providerID == 0 {
		response.Unauthorized(c, "未登录或非服务商账号")
		return
	}

	// 获取 booking ID
	bookingIDStr := c.Param("id")
	bookingID, err := strconv.ParseUint(bookingIDStr, 10, 64)
	if err != nil {
		response.BadRequest(c, "无效的预约ID")
		return
	}

	// 绑定请求参数
	var req service.ConfirmConstructionPartyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误: "+err.Error())
		return
	}

	// 调用 Service
	if err := projectService.ConfirmConstructionParty(bookingID, providerID, &req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	message := "工长确认成功"
	if !req.Accept {
		message = "已拒绝施工邀请"
	}

	response.Success(c, gin.H{
		"message": message,
	})
}
