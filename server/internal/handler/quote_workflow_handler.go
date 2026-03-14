package handler

import (
	"strings"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/service"
	"home-decoration-server/pkg/response"

	"github.com/gin-gonic/gin"
)

func AdminListQuoteCategories(c *gin.Context) {
	categories, err := quoteService.ListQuoteCategories()
	if err != nil {
		response.Error(c, 500, err.Error())
		return
	}
	response.Success(c, gin.H{"list": categories})
}

func AdminCreateQuoteCategory(c *gin.Context) {
	var input service.QuoteCategoryCreateInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, "类目参数错误")
		return
	}
	category, err := quoteService.CreateQuoteCategory(&input)
	if err != nil {
		response.Error(c, 400, err.Error())
		return
	}
	response.Success(c, category)
}

func AdminCreateQuoteLibraryItem(c *gin.Context) {
	var input service.QuoteLibraryItemWriteInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, "标准项参数错误")
		return
	}
	item, err := quoteService.CreateQuoteLibraryItem(&input)
	if err != nil {
		response.Error(c, 400, err.Error())
		return
	}
	response.Success(c, item)
}

func AdminUpdateQuoteLibraryItem(c *gin.Context) {
	var input service.QuoteLibraryItemWriteInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, "标准项参数错误")
		return
	}
	item, err := quoteService.UpdateQuoteLibraryItem(parseUint(c.Param("id")), &input)
	if err != nil {
		response.Error(c, 400, err.Error())
		return
	}
	response.Success(c, item)
}

func AdminGetProviderPriceBook(c *gin.Context) {
	detail, err := quoteService.GetProviderPriceBook(parseUint(c.Param("id")))
	if err != nil {
		response.Error(c, 400, err.Error())
		return
	}
	response.Success(c, detail)
}

func AdminUpdateQuoteTaskPrerequisites(c *gin.Context) {
	var input service.QuoteTaskPrerequisiteUpdateInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, "报价前置数据参数错误")
		return
	}
	task, err := quoteService.UpdateTaskPrerequisites(parseUint(c.Param("id")), &input)
	if err != nil {
		response.Error(c, 400, err.Error())
		return
	}
	response.Success(c, task)
}

func AdminValidateQuoteTaskPrerequisites(c *gin.Context) {
	result, err := quoteService.ValidateTaskPrerequisites(parseUint(c.Param("id")))
	if err != nil {
		response.Error(c, 400, err.Error())
		return
	}
	response.Success(c, result)
}

func AdminRecommendForemen(c *gin.Context) {
	recommendations, err := quoteService.RecommendForemen(parseUint(c.Param("id")))
	if err != nil {
		response.Error(c, 400, err.Error())
		return
	}
	response.Success(c, gin.H{"list": recommendations})
}

func AdminSelectForemen(c *gin.Context) {
	var input struct {
		ProviderIDs []uint64 `json:"providerIds"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, "工长选择参数错误")
		return
	}
	adminID := c.GetUint64("adminId")
	invitations, err := quoteService.SelectForemen(parseUint(c.Param("id")), adminID, input.ProviderIDs)
	if err != nil {
		response.Error(c, 400, err.Error())
		return
	}
	response.Success(c, gin.H{"invitations": invitations})
}

func AdminGenerateQuoteDrafts(c *gin.Context) {
	result, err := quoteService.GenerateDrafts(parseUint(c.Param("id")))
	if err != nil {
		response.Error(c, 400, err.Error())
		return
	}
	response.Success(c, result)
}

func AdminSubmitQuoteTaskToUser(c *gin.Context) {
	var input struct {
		SubmissionID uint64 `json:"submissionId" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, "提交给用户参数错误")
		return
	}
	task, err := quoteService.SubmitTaskToUser(parseUint(c.Param("id")), input.SubmissionID)
	if err != nil {
		response.Error(c, 400, err.Error())
		return
	}
	response.Success(c, task)
}

func AdminRequoteTask(c *gin.Context) {
	task, err := quoteService.RequoteTask(parseUint(c.Param("id")))
	if err != nil {
		response.Error(c, 400, err.Error())
		return
	}
	response.Success(c, task)
}

func MerchantGetPriceBook(c *gin.Context) {
	providerID := c.GetUint64("providerId")
	if providerID == 0 {
		response.Forbidden(c, "无权访问工长价格库")
		return
	}
	detail, err := quoteService.GetProviderPriceBook(providerID)
	if err != nil {
		if strings.Contains(err.Error(), "不存在") {
			response.Success(c, gin.H{"book": model.QuotePriceBook{ProviderID: providerID, Status: model.QuotePriceBookStatusDraft}, "items": []model.QuotePriceBookItem{}})
			return
		}
		response.Error(c, 400, err.Error())
		return
	}
	response.Success(c, detail)
}

func MerchantUpdatePriceBook(c *gin.Context) {
	providerID := c.GetUint64("providerId")
	var input service.QuotePriceBookUpdateInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, "工长价格库参数错误")
		return
	}
	detail, err := quoteService.UpsertProviderPriceBook(providerID, &input)
	if err != nil {
		response.Error(c, 400, err.Error())
		return
	}
	response.Success(c, detail)
}

func MerchantPublishPriceBook(c *gin.Context) {
	providerID := c.GetUint64("providerId")
	detail, err := quoteService.PublishProviderPriceBook(providerID)
	if err != nil {
		response.Error(c, 400, err.Error())
		return
	}
	response.Success(c, detail)
}

func MerchantListQuoteTasks(c *gin.Context) {
	MerchantListQuoteLists(c)
}

func MerchantGetQuoteTask(c *gin.Context) {
	MerchantGetQuoteListDetail(c)
}

func UserListQuoteTasks(c *gin.Context) {
	userID := c.GetUint64("userId")
	if userID == 0 {
		response.Forbidden(c, "无权查看报价任务")
		return
	}
	result, err := quoteService.ListUserQuoteTasks(userID)
	if err != nil {
		response.Error(c, 500, err.Error())
		return
	}
	response.Success(c, gin.H{"list": result})
}

func UserGetQuoteTask(c *gin.Context) {
	userID := c.GetUint64("userId")
	view, err := quoteService.GetUserQuoteTask(parseUint(c.Param("id")), userID)
	if err != nil {
		response.Error(c, 400, err.Error())
		return
	}
	response.Success(c, view)
}

func UserConfirmQuoteSubmission(c *gin.Context) {
	userID := c.GetUint64("userId")
	task, err := quoteService.UserConfirmQuoteSubmission(parseUint(c.Param("id")), userID)
	if err != nil {
		response.Error(c, 400, err.Error())
		return
	}
	response.Success(c, task)
}

func UserRejectQuoteSubmission(c *gin.Context) {
	userID := c.GetUint64("userId")
	var input struct {
		Reason string `json:"reason"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, "拒绝参数错误")
		return
	}
	task, err := quoteService.UserRejectQuoteSubmission(parseUint(c.Param("id")), userID, strings.TrimSpace(input.Reason))
	if err != nil {
		response.Error(c, 400, err.Error())
		return
	}
	response.Success(c, task)
}

func UserPrintQuoteSubmission(c *gin.Context) {
	html, err := quoteService.BuildSubmissionPrintHTML(parseUint(c.Param("id")))
	if err != nil {
		response.Error(c, 400, err.Error())
		return
	}
	c.Data(200, "text/html; charset=utf-8", []byte(html))
}
