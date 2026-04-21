package handler

import (
	"strings"

	"home-decoration-server/internal/service"
	"home-decoration-server/pkg/response"

	"github.com/gin-gonic/gin"
)

var quoteInquiryService = &service.QuoteInquiryService{}

// CreateQuoteInquiryRequest 创建询价请求
type CreateQuoteInquiryRequest struct {
	Address        string  `json:"address" binding:"required"`
	Area           float64 `json:"area" binding:"required,min=10,max=2000"`
	HouseLayout    string  `json:"houseLayout"`
	RenovationType string  `json:"renovationType" binding:"required"`
	Style          string  `json:"style" binding:"required"`
	BudgetRange    string  `json:"budgetRange"`
	Phone          string  `json:"phone"`
	Source         string  `json:"source"`
	WechatCode     string  `json:"wechatCode"`
}

// CreateQuoteInquiry 创建询价（用户端）
func CreateQuoteInquiry(c *gin.Context) {
	var req CreateQuoteInquiryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误: "+err.Error())
		return
	}

	userIDValue := c.GetUint64("userId")
	var userID *uint64
	if userIDValue > 0 {
		userID = &userIDValue
	}

	openID := ""
	if userID == nil && strings.TrimSpace(req.WechatCode) != "" {
		resolved, err := wechatAuthService.ResolveOpenID(req.WechatCode)
		if err != nil {
			response.BadRequest(c, "微信身份校验失败: "+err.Error())
			return
		}
		openID = resolved
	}

	inquiry, _, err := quoteInquiryService.CreateInquiry(&service.CreateInquiryRequest{
		UserID:         userID,
		OpenID:         openID,
		Phone:          req.Phone,
		Address:        req.Address,
		Area:           req.Area,
		HouseLayout:    req.HouseLayout,
		RenovationType: req.RenovationType,
		Style:          req.Style,
		BudgetRange:    req.BudgetRange,
		Source:         req.Source,
	})
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	accessToken, err := quoteInquiryService.IssueAccessToken(inquiry.ID)
	if err != nil {
		response.ServerError(c, "生成访问凭证失败")
		return
	}

	detail, err := quoteInquiryService.GetInquiryDetailForPublic(inquiry.ID, userIDValue, accessToken)
	if err != nil {
		response.ServerError(c, "生成报价详情失败")
		return
	}
	detail.AccessToken = accessToken

	response.Success(c, detail)
}

// GetQuoteInquiry 获取公开结果页详情
func GetQuoteInquiry(c *gin.Context) {
	inquiryID := parseUint64(c.Param("id"))
	if inquiryID == 0 {
		response.BadRequest(c, "无效报价ID")
		return
	}

	detail, err := quoteInquiryService.GetInquiryDetailForPublic(
		inquiryID,
		c.GetUint64("userId"),
		c.Query("accessToken"),
	)
	if err != nil {
		respondScopedAccessError(c, err, "获取报价详情失败")
		return
	}

	response.Success(c, detail)
}
