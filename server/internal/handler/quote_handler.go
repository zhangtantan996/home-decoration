package handler

import (
	"errors"
	"strconv"
	"strings"
	"time"

	"home-decoration-server/internal/service"
	"home-decoration-server/pkg/response"

	"github.com/gin-gonic/gin"
)

var quoteService = &service.QuoteService{}

func AdminImportQuoteLibrary(c *gin.Context) {
	var input struct {
		FilePath string `json:"filePath"`
	}
	_ = c.ShouldBindJSON(&input)

	result, err := quoteService.ImportQuoteLibraryFromERP(strings.TrimSpace(input.FilePath))
	if err != nil {
		response.Error(c, 400, err.Error())
		return
	}
	response.Success(c, result)
}

func AdminListQuoteLibraryItems(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))
	keyword := c.Query("keyword")
	categoryL1 := c.Query("categoryL1")

	var statusPtr *int8
	if raw := strings.TrimSpace(c.Query("status")); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil {
			status := int8(parsed)
			statusPtr = &status
		}
	}

	result, err := quoteService.ListQuoteLibraryItems(page, pageSize, keyword, categoryL1, statusPtr)
	if err != nil {
		response.Error(c, 500, err.Error())
		return
	}
	response.Success(c, result)
}

func AdminListQuoteLists(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))
	status := c.Query("status")
	keyword := c.Query("keyword")

	result, err := quoteService.ListQuoteLists(page, pageSize, status, keyword)
	if err != nil {
		response.Error(c, 500, err.Error())
		return
	}
	response.Success(c, result)
}

func AdminGetQuoteListDetail(c *gin.Context) {
	result, err := quoteService.GetAdminQuoteListDetail(parseUint(c.Param("id")))
	if err != nil {
		response.Error(c, 400, err.Error())
		return
	}
	response.Success(c, result)
}

func AdminCreateQuoteList(c *gin.Context) {
	var input struct {
		ProjectID    uint64 `json:"projectId"`
		CustomerID   uint64 `json:"customerId"`
		HouseID      uint64 `json:"houseId"`
		OwnerUserID  uint64 `json:"ownerUserId"`
		ScenarioType string `json:"scenarioType"`
		Title        string `json:"title" binding:"required"`
		Currency     string `json:"currency"`
		DeadlineAt   string `json:"deadlineAt"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, "报价清单参数错误")
		return
	}
	var deadlineAt *time.Time
	if strings.TrimSpace(input.DeadlineAt) != "" {
		parsed, err := time.Parse(time.RFC3339, input.DeadlineAt)
		if err != nil {
			response.BadRequest(c, "deadlineAt 必须是 RFC3339 时间")
			return
		}
		deadlineAt = &parsed
	}
	quoteList, err := quoteService.CreateQuoteList(&service.QuoteListCreateInput{
		ProjectID:    input.ProjectID,
		CustomerID:   input.CustomerID,
		HouseID:      input.HouseID,
		OwnerUserID:  input.OwnerUserID,
		ScenarioType: input.ScenarioType,
		Title:        input.Title,
		Currency:     input.Currency,
		DeadlineAt:   deadlineAt,
	})
	if err != nil {
		response.Error(c, 400, err.Error())
		return
	}
	response.Success(c, quoteList)
}

func AdminBatchUpsertQuoteListItems(c *gin.Context) {
	quoteListID := parseUint(c.Param("id"))
	var input struct {
		Items []service.QuoteListItemUpsertInput `json:"items"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, "清单项目参数错误")
		return
	}
	items, err := quoteService.BatchUpsertQuoteListItems(quoteListID, input.Items)
	if err != nil {
		response.Error(c, 400, err.Error())
		return
	}
	response.Success(c, gin.H{"items": items})
}

func AdminCreateQuoteInvitations(c *gin.Context) {
	quoteListID := parseUint(c.Param("id"))
	adminID := c.GetUint64("adminId")
	var input struct {
		ProviderIDs []uint64 `json:"providerIds"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, "邀请参数错误")
		return
	}
	invitations, err := quoteService.InviteProviders(quoteListID, adminID, input.ProviderIDs)
	if err != nil {
		response.Error(c, 400, err.Error())
		return
	}
	response.Success(c, gin.H{"invitations": invitations})
}

func AdminStartQuoteList(c *gin.Context) {
	quoteList, err := quoteService.StartQuoteList(parseUint(c.Param("id")))
	if err != nil {
		response.Error(c, 400, err.Error())
		return
	}
	response.Success(c, quoteList)
}

func AdminGetQuoteComparison(c *gin.Context) {
	result, err := quoteService.GetQuoteComparison(parseUint(c.Param("id")))
	if err != nil {
		response.Error(c, 400, err.Error())
		return
	}
	response.Success(c, result)
}

func AdminAwardQuote(c *gin.Context) {
	quoteListID := parseUint(c.Param("id"))
	var input struct {
		SubmissionID uint64 `json:"submissionId" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, "定标参数错误")
		return
	}
	quoteList, err := quoteService.AwardQuote(quoteListID, input.SubmissionID)
	if err != nil {
		response.Error(c, 400, err.Error())
		return
	}
	response.Success(c, quoteList)
}

func MerchantListQuoteLists(c *gin.Context) {
	providerID := c.GetUint64("providerId")
	if providerID == 0 {
		response.Forbidden(c, "无权访问报价清单")
		return
	}
	list, err := quoteService.ListMerchantQuoteLists(providerID)
	if err != nil {
		response.Error(c, 500, err.Error())
		return
	}
	response.Success(c, gin.H{"list": list})
}

func MerchantGetQuoteListDetail(c *gin.Context) {
	providerID := c.GetUint64("providerId")
	if providerID == 0 {
		response.Forbidden(c, "无权访问报价清单")
		return
	}
	detail, err := quoteService.GetMerchantQuoteListDetail(parseUint(c.Param("id")), providerID)
	if err != nil {
		if errors.Is(err, errors.New("未被邀请参与该报价清单")) {
			response.Forbidden(c, err.Error())
			return
		}
		if strings.Contains(err.Error(), "未被邀请") {
			response.Forbidden(c, err.Error())
			return
		}
		response.Error(c, 400, err.Error())
		return
	}
	response.Success(c, detail)
}

func MerchantSaveQuoteSubmission(c *gin.Context) {
	handleMerchantQuoteSubmission(c, false)
}

func MerchantSubmitQuoteSubmission(c *gin.Context) {
	handleMerchantQuoteSubmission(c, true)
}

func handleMerchantQuoteSubmission(c *gin.Context, submit bool) {
	providerID := c.GetUint64("providerId")
	if providerID == 0 {
		response.Forbidden(c, "无权报价")
		return
	}
	var input service.QuoteSubmissionSaveInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, "报价参数错误")
		return
	}
	submission, err := quoteService.SaveMerchantSubmission(parseUint(c.Param("id")), providerID, &input, submit)
	if err != nil {
		if strings.Contains(err.Error(), "未被邀请") {
			response.Forbidden(c, err.Error())
			return
		}
		response.Error(c, 400, err.Error())
		return
	}
	response.Success(c, submission)
}
