package handler

import (
	"errors"
	"strconv"
	"strings"
	"time"

	"home-decoration-server/internal/model"
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

func AdminImportQuoteLibraryPreview(c *gin.Context) {
	var input struct {
		FilePath string `json:"filePath"`
	}
	_ = c.ShouldBindJSON(&input)

	result, err := quoteService.ImportQuoteLibraryPreview(strings.TrimSpace(input.FilePath))
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
	categoryID := parseUint(c.Query("categoryId"))

	var statusPtr *int8
	if raw := strings.TrimSpace(c.Query("status")); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil {
			status := int8(parsed)
			statusPtr = &status
		}
	}

	result, err := quoteService.ListQuoteLibraryItems(page, pageSize, keyword, categoryL1, categoryID, statusPtr)
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
		respondScopedAccessError(c, err, "获取报价清单失败")
		return
	}
	response.Success(c, result)
}

func AdminCreateQuoteList(c *gin.Context) {
	var input struct {
		ProjectID          uint64 `json:"projectId"`
		ProposalID         uint64 `json:"proposalId"`
		ProposalVersion    int    `json:"proposalVersion"`
		DesignerProviderID uint64 `json:"designerProviderId"`
		CustomerID         uint64 `json:"customerId"`
		HouseID            uint64 `json:"houseId"`
		OwnerUserID        uint64 `json:"ownerUserId"`
		ScenarioType       string `json:"scenarioType"`
		Title              string `json:"title" binding:"required"`
		Currency           string `json:"currency"`
		DeadlineAt         string `json:"deadlineAt"`
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
		ProjectID:          input.ProjectID,
		ProposalID:         input.ProposalID,
		ProposalVersion:    input.ProposalVersion,
		DesignerProviderID: input.DesignerProviderID,
		CustomerID:         input.CustomerID,
		HouseID:            input.HouseID,
		OwnerUserID:        input.OwnerUserID,
		ScenarioType:       input.ScenarioType,
		Title:              input.Title,
		Currency:           input.Currency,
		DeadlineAt:         deadlineAt,
	})
	if err != nil {
		respondDomainMutationError(c, err, "创建报价清单失败")
		return
	}
	response.Success(c, quoteList)
}

func AdminRebuildQuoteListFromLegacy(c *gin.Context) {
	var input service.LegacyQuotePKRebuildInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, "legacy 重建参数错误")
		return
	}
	result, err := quoteService.RebuildQuoteListFromLegacy(&input)
	if err != nil {
		respondDomainMutationError(c, err, "重建 legacy quote-pk 报价单失败")
		return
	}
	response.Success(c, result)
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
		respondDomainMutationError(c, err, "更新报价清单项目失败")
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
		respondDomainMutationError(c, err, "邀请服务商失败")
		return
	}
	response.Success(c, gin.H{"invitations": invitations})
}

func AdminStartQuoteList(c *gin.Context) {
	quoteList, err := quoteService.StartQuoteList(parseUint(c.Param("id")))
	if err != nil {
		respondDomainMutationError(c, err, "启动报价清单失败")
		return
	}
	response.Success(c, quoteList)
}

func AdminGetQuoteComparison(c *gin.Context) {
	result, err := quoteService.GetQuoteComparison(parseUint(c.Param("id")))
	if err != nil {
		respondScopedAccessError(c, err, "获取报价对比失败")
		return
	}
	response.Success(c, result)
}

func AdminListProviderPriceBookInspection(c *gin.Context) {
	list, err := quoteService.ListProviderPriceBookInspection(c.Query("keyword"))
	if err != nil {
		respondScopedAccessError(c, err, "获取施工主体价格库巡检失败")
		return
	}
	response.Success(c, gin.H{"list": list})
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
		respondDomainMutationError(c, err, "定标失败")
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
		respondScopedAccessError(c, err, "获取报价清单失败")
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
		respondScopedAccessError(c, err, "获取报价清单失败")
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
		respondDomainMutationError(c, err, "提交报价失败")
		return
	}
	response.Success(c, submission)
}

// ── Price Tier Handlers ──

func AdminListPriceTiers(c *gin.Context) {
	libraryItemID := parseUint(c.Param("itemId"))
	tiers, err := quoteService.ListPriceTiers(libraryItemID)
	if err != nil {
		response.Error(c, 500, err.Error())
		return
	}
	response.Success(c, gin.H{"tiers": tiers})
}

func AdminCreatePriceTier(c *gin.Context) {
	var input struct {
		LibraryItemID uint64 `json:"libraryItemId" binding:"required"`
		TierKey       string `json:"tierKey" binding:"required"`
		TierLabel     string `json:"tierLabel" binding:"required"`
		ConditionJSON string `json:"conditionJson"`
		SortOrder     int    `json:"sortOrder"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, "阶梯价参数错误")
		return
	}
	tier := &model.QuotePriceTier{
		LibraryItemID: input.LibraryItemID,
		TierKey:       input.TierKey,
		TierLabel:     input.TierLabel,
		ConditionJSON: input.ConditionJSON,
		SortOrder:     input.SortOrder,
	}
	if err := quoteService.CreatePriceTier(tier); err != nil {
		response.Error(c, 400, err.Error())
		return
	}
	response.Success(c, tier)
}

func AdminUpdatePriceTier(c *gin.Context) {
	id := parseUint(c.Param("id"))
	var input map[string]interface{}
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}
	if err := quoteService.UpdatePriceTier(id, input); err != nil {
		response.Error(c, 400, err.Error())
		return
	}
	response.Success(c, gin.H{"id": id})
}

func AdminDeletePriceTier(c *gin.Context) {
	id := parseUint(c.Param("id"))
	if err := quoteService.DeletePriceTier(id); err != nil {
		response.Error(c, 400, err.Error())
		return
	}
	response.Success(c, gin.H{"id": id})
}

// ── Quote Template Handlers ──

func AdminListQuoteTemplates(c *gin.Context) {
	roomType := c.Query("roomType")
	renovationType := c.Query("renovationType")
	templates, err := quoteService.ListQuoteTemplates(roomType, renovationType)
	if err != nil {
		response.Error(c, 500, err.Error())
		return
	}
	response.Success(c, gin.H{"list": templates})
}

func AdminGetQuoteTemplateDetail(c *gin.Context) {
	detail, err := quoteService.GetQuoteTemplateDetail(parseUint(c.Param("id")))
	if err != nil {
		response.Error(c, 400, err.Error())
		return
	}
	response.Success(c, detail)
}

func AdminCreateQuoteTemplate(c *gin.Context) {
	var input struct {
		Name           string `json:"name" binding:"required"`
		RoomType       string `json:"roomType"`
		RenovationType string `json:"renovationType"`
		Description    string `json:"description"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, "模板参数错误")
		return
	}
	tmpl := &model.QuoteTemplate{
		Name:           input.Name,
		RoomType:       input.RoomType,
		RenovationType: input.RenovationType,
		Description:    input.Description,
		Status:         1,
	}
	if err := quoteService.CreateQuoteTemplate(tmpl); err != nil {
		response.Error(c, 400, err.Error())
		return
	}
	response.Success(c, tmpl)
}

func AdminUpdateQuoteTemplate(c *gin.Context) {
	id := parseUint(c.Param("id"))
	var input map[string]interface{}
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}
	if err := quoteService.UpdateQuoteTemplate(id, input); err != nil {
		response.Error(c, 400, err.Error())
		return
	}
	response.Success(c, gin.H{"id": id})
}

func AdminBatchUpsertTemplateItems(c *gin.Context) {
	templateID := parseUint(c.Param("id"))
	var input struct {
		Items []service.QuoteTemplateItemInput `json:"items"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, "模板项目参数错误")
		return
	}
	if err := quoteService.BatchUpsertTemplateItems(templateID, input.Items); err != nil {
		response.Error(c, 400, err.Error())
		return
	}
	response.Success(c, gin.H{"templateId": templateID})
}

func AdminEnsureQuoteTemplate(c *gin.Context) {
	var input struct {
		RoomType       string `json:"roomType"`
		RenovationType string `json:"renovationType"`
		Repair         bool   `json:"repair"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, "模板参数错误")
		return
	}
	result, err := quoteService.EnsurePreparationTemplate(input.RoomType, input.RenovationType, input.Repair)
	if err != nil {
		response.Error(c, 400, err.Error())
		return
	}
	response.Success(c, result)
}

func AdminApplyTemplateToQuoteList(c *gin.Context) {
	quoteListID := parseUint(c.Param("id"))
	var input struct {
		TemplateID uint64 `json:"templateId" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}
	items, err := quoteService.ApplyTemplateToQuoteList(input.TemplateID, quoteListID)
	if err != nil {
		response.Error(c, 400, err.Error())
		return
	}
	response.Success(c, gin.H{"items": items})
}

// ── Smart Quantity Calculation ──

func AdminAutoCalculateQuantities(c *gin.Context) {
	quoteListID := parseUint(c.Param("id"))
	suggestions, err := quoteService.AutoCalculateQuantities(quoteListID)
	if err != nil {
		response.Error(c, 400, err.Error())
		return
	}
	response.Success(c, gin.H{"suggestions": suggestions})
}
