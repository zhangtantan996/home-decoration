package handler

import (
	"errors"
	"home-decoration-server/pkg/response"

	"gorm.io/gorm"

	"github.com/gin-gonic/gin"
)

// GetCaseQuote 获取案例报价明细（必须登录，不提供下载）
func GetCaseQuote(c *gin.Context) {
	caseID := parseUint64(c.Param("id"))
	if caseID == 0 {
		response.BadRequest(c, "ID无效")
		return
	}

	quote, err := caseService.GetCaseQuote(caseID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			response.NotFound(c, "案例不存在")
			return
		}
		response.ServerError(c, "查询失败")
		return
	}

	response.Success(c, quote)
}

func GetCaseDetail(c *gin.Context) {
	caseID := parseUint64(c.Param("id"))
	if caseID == 0 {
		response.BadRequest(c, "ID无效")
		return
	}

	pc, err := caseService.GetCaseDetail(caseID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			response.NotFound(c, "案例不存在")
			return
		}
		response.ServerError(c, "查询失败")
		return
	}

	response.Success(c, pc)
}
