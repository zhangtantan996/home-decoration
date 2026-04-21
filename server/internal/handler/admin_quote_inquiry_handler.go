package handler

import (
	"home-decoration-server/internal/service"
	"home-decoration-server/pkg/response"

	"github.com/gin-gonic/gin"
)

// AdminQuoteInquiryQuery 管理后台查询参数
type AdminQuoteInquiryQuery struct {
	Page             int    `form:"page" binding:"omitempty,min=1"`
	PageSize         int    `form:"pageSize" binding:"omitempty,min=1,max=100"`
	Keyword          string `form:"keyword"`
	ConversionStatus string `form:"conversionStatus"`
	City             string `form:"city"`
	CityCode         string `form:"cityCode"`
	StartDate        string `form:"startDate"`
	EndDate          string `form:"endDate"`
	HasPhone         *bool  `form:"hasPhone"`
}

// AdminListQuoteInquiries 管理后台查询询价列表
func AdminListQuoteInquiries(c *gin.Context) {
	var query AdminQuoteInquiryQuery
	if err := c.ShouldBindQuery(&query); err != nil {
		response.BadRequest(c, "参数错误: "+err.Error())
		return
	}
	if query.Page <= 0 {
		query.Page = 1
	}
	if query.PageSize <= 0 {
		query.PageSize = 10
	}

	items, total, err := quoteInquiryService.AdminListInquiries(service.AdminQuoteInquiryListFilter{
		Page:             query.Page,
		PageSize:         query.PageSize,
		Keyword:          query.Keyword,
		City:             query.City,
		CityCode:         query.CityCode,
		ConversionStatus: query.ConversionStatus,
		StartDate:        query.StartDate,
		EndDate:          query.EndDate,
		HasPhone:         query.HasPhone,
	})
	if err != nil {
		response.ServerError(c, "查询失败: "+err.Error())
		return
	}

	response.PageSuccess(c, items, total, query.Page, query.PageSize)
}

// AdminGetQuoteInquiry 获取管理后台详情
func AdminGetQuoteInquiry(c *gin.Context) {
	inquiryID := parseUint64(c.Param("id"))
	if inquiryID == 0 {
		response.BadRequest(c, "无效报价ID")
		return
	}

	detail, err := quoteInquiryService.GetInquiryDetailForAdmin(inquiryID)
	if err != nil {
		respondScopedAccessError(c, err, "获取报价详情失败")
		return
	}

	response.Success(c, detail)
}
