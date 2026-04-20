package handler

import (
	"home-decoration-server/internal/service"
	"home-decoration-server/pkg/response"

	"github.com/gin-gonic/gin"
)

var quoteEstimateService = &service.QuoteEstimateService{}

// QuoteEstimateRequest 智能报价请求
type QuoteEstimateRequest struct {
	Area   float64 `json:"area" binding:"required"`   // 房屋面积
	Style  string  `json:"style" binding:"required"`  // 装修风格
	Region string  `json:"region" binding:"required"` // 区域
}

// GenerateQuoteEstimate 生成智能报价
func GenerateQuoteEstimate(c *gin.Context) {
	var req QuoteEstimateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误: "+err.Error())
		return
	}

	// 调用服务层生成报价
	result, err := quoteEstimateService.EstimateQuote(req.Area, req.Style, req.Region)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Success(c, result)
}
