package handler

import (
	"errors"

	"home-decoration-server/internal/service"
	"home-decoration-server/pkg/response"

	"github.com/gin-gonic/gin"
)

var reportService = service.NewReportService()

// SubmitChatReport handles user chat report submissions.
// POST /api/v1/reports/chat
func SubmitChatReport(c *gin.Context) {
	userID := c.GetUint64("userId")
	if userID == 0 {
		response.Unauthorized(c, "请先登录")
		return
	}

	var req service.SubmitChatReportRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}

	err := reportService.SubmitChatReport(userID, &req)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrInvalidRequest):
			response.BadRequest(c, "参数错误")
		case errors.Is(err, service.ErrTopicRequired):
			response.BadRequest(c, "缺少会话信息")
		case errors.Is(err, service.ErrReasonRequired):
			response.BadRequest(c, "举报原因不能为空")
		case errors.Is(err, service.ErrReasonTooLong):
			response.BadRequest(c, "举报原因不能超过500字")
		default:
			response.ServerError(c, "举报提交失败")
		}
		return
	}

	response.SuccessWithMessage(c, "举报已提交，我们将尽快处理", nil)
}
