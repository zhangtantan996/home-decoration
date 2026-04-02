package handler

import (
	"encoding/json"
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	"home-decoration-server/internal/service"
	imgutil "home-decoration-server/internal/utils/image"
	"home-decoration-server/pkg/response"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// ==================== 商家作品集管理 Handler (双版本审核机制) ====================

// MerchantCaseList 作品集列表 (合并正式版和审核版)
func MerchantCaseList(c *gin.Context) {
	providerID := c.GetUint64("providerId")

	// 1. 获取所有已发布作品
	var publishedCases []model.ProviderCase
	repository.DB.Where("provider_id = ?", providerID).
		Order("sort_order ASC, created_at DESC").
		Find(&publishedCases)

	// 2. 获取所有待审核和已拒绝记录
	var audits []model.CaseAudit
	repository.DB.Where("provider_id = ? AND status IN (0, 2)", providerID).
		Find(&audits)

	// 3. 构建 Map 以便快速查找 update/delete 类型的审核
	auditMap := make(map[uint64]model.CaseAudit)
	var newAudits []model.CaseAudit // 新增类型的审核
	for _, audit := range audits {
		if audit.ActionType == "create" {
			newAudits = append(newAudits, audit)
		} else if audit.CaseID != nil {
			auditMap[*audit.CaseID] = audit
		}
	}

	// 4. 合并列表
	var resultList []gin.H

	// 先处理待审核/已拒绝的新增作品
	for _, audit := range newAudits {
		var images []string
		json.Unmarshal([]byte(audit.Images), &images)
		images = imgutil.GetFullImageURLs(images)
		resultList = append(resultList, gin.H{
			"id":             0, // 新增暂无 ID
			"auditId":        audit.ID,
			"title":          audit.Title,
			"coverImage":     imgutil.GetFullImageURL(audit.CoverImage),
			"style":          audit.Style,
			"layout":         audit.Layout,
			"area":           audit.Area,
			"price":          audit.Price,
			"quoteTotalCent": audit.QuoteTotalCent,
			"quoteCurrency":  audit.QuoteCurrency,
			"year":           audit.Year,
			"description":    audit.Description,
			"images":         images,
			"sortOrder":      0,
			"createdAt":      audit.CreatedAt,
			"status":         audit.Status, // 0=待审核, 2=已拒绝
			"actionType":     "create",
			"rejectReason":   audit.RejectReason,
		})
	}

	// 处理已发布作品 (检查是否有更新/删除审核)
	for _, pc := range publishedCases {
		item := gin.H{
			"id":             pc.ID,
			"title":          pc.Title,
			"coverImage":     imgutil.GetFullImageURL(pc.CoverImage),
			"style":          pc.Style,
			"layout":         pc.Layout,
			"area":           pc.Area,
			"price":          pc.Price,
			"quoteTotalCent": pc.QuoteTotalCent,
			"quoteCurrency":  pc.QuoteCurrency,
			"year":           pc.Year,
			"description":    pc.Description,
			"sortOrder":      pc.SortOrder,
			"createdAt":      pc.CreatedAt,
			"status":         1, // 已发布
			"actionType":     "",
		}

		var images []string
		json.Unmarshal([]byte(pc.Images), &images)
		item["images"] = imgutil.GetFullImageURLs(images)

		// 检查是否有挂起的审核
		if audit, exists := auditMap[pc.ID]; exists {
			item["auditId"] = audit.ID
			item["status"] = audit.Status // 0=待审核, 2=已拒绝
			item["actionType"] = audit.ActionType
			item["rejectReason"] = audit.RejectReason

			// 如果是修改，优先展示修改后的内容预览
			if audit.ActionType == "update" {
				item["title"] = audit.Title
				item["coverImage"] = imgutil.GetFullImageURL(audit.CoverImage)
				item["style"] = audit.Style
				item["layout"] = audit.Layout
				item["area"] = audit.Area
				item["price"] = audit.Price
				item["quoteTotalCent"] = audit.QuoteTotalCent
				item["quoteCurrency"] = audit.QuoteCurrency
				item["year"] = audit.Year
				item["description"] = audit.Description
				var newImages []string
				json.Unmarshal([]byte(audit.Images), &newImages)
				item["images"] = imgutil.GetFullImageURLs(newImages)
			}
		}

		resultList = append(resultList, item)
	}

	// 简单的排序：待审核在前，然后按原有顺序
	// (前端其实可以自己排，这里后端不强制重排，保持 create 在前即可)

	response.Success(c, gin.H{
		"list":  resultList,
		"total": len(resultList),
	})
}

type merchantCasePayload struct {
	Title          string          `json:"title" binding:"required"`
	CoverImage     string          `json:"coverImage" binding:"required"`
	Style          string          `json:"style" binding:"required"`
	Layout         string          `json:"layout"`
	Area           string          `json:"area"`
	Price          float64         `json:"price"`
	QuoteTotalCent *int64          `json:"quoteTotalCent"`
	QuoteCurrency  string          `json:"quoteCurrency"`
	QuoteItems     json.RawMessage `json:"quoteItems"`
	Year           string          `json:"year"`
	Description    string          `json:"description"`
	Images         []string        `json:"images" binding:"required,min=1"`
}

type merchantCaseUpdatePayload struct {
	Title          string          `json:"title"`
	CoverImage     string          `json:"coverImage"`
	Style          string          `json:"style" binding:"required"`
	Layout         string          `json:"layout"`
	Area           string          `json:"area"`
	Price          float64         `json:"price"`
	QuoteTotalCent *int64          `json:"quoteTotalCent"`
	QuoteCurrency  string          `json:"quoteCurrency"`
	QuoteItems     json.RawMessage `json:"quoteItems"`
	Year           string          `json:"year"`
	Description    string          `json:"description"`
	Images         []string        `json:"images"`
}

func normalizeMerchantCaseFields(title, coverImage, style, layout, area, quoteCurrency, year, description *string, images *[]string) {
	if title != nil {
		*title = strings.TrimSpace(*title)
	}
	if coverImage != nil {
		*coverImage = normalizeStoredAsset(*coverImage)
	}
	if style != nil {
		*style = strings.TrimSpace(*style)
	}
	if layout != nil {
		*layout = strings.TrimSpace(*layout)
	}
	if area != nil {
		*area = strings.TrimSpace(*area)
	}
	if quoteCurrency != nil {
		*quoteCurrency = strings.TrimSpace(*quoteCurrency)
	}
	if year != nil {
		*year = strings.TrimSpace(*year)
	}
	if description != nil {
		*description = strings.TrimSpace(*description)
	}
	if images != nil {
		*images = normalizeStoredAssetSlice(*images)
	}
}

func normalizeMerchantCasePayload(input *merchantCasePayload) {
	if input == nil {
		return
	}
	normalizeMerchantCaseFields(
		&input.Title,
		&input.CoverImage,
		&input.Style,
		&input.Layout,
		&input.Area,
		&input.QuoteCurrency,
		&input.Year,
		&input.Description,
		&input.Images,
	)
}

func normalizeMerchantCaseUpdatePayload(input *merchantCaseUpdatePayload) {
	if input == nil {
		return
	}
	normalizeMerchantCaseFields(
		&input.Title,
		&input.CoverImage,
		&input.Style,
		&input.Layout,
		&input.Area,
		&input.QuoteCurrency,
		&input.Year,
		&input.Description,
		&input.Images,
	)
}

// MerchantCaseCreate 创建作品 (提交审核)
func MerchantCaseCreate(c *gin.Context) {
	providerID := c.GetUint64("providerId")

	var input merchantCasePayload
	if err := c.ShouldBindJSON(&input); err != nil {
		response.Error(c, 400, "参数错误: "+err.Error())
		return
	}
	normalizeMerchantCasePayload(&input)

	if strings.TrimSpace(input.Layout) == "" {
		// Keep layout always present for downstream filtering & display.
		input.Layout = "其他"
	}

	// 检查作品数量限制 (包括待审核的)
	var count int64
	repository.DB.Model(&model.ProviderCase{}).Where("provider_id = ?", providerID).Count(&count)
	var auditCount int64
	repository.DB.Model(&model.CaseAudit{}).Where("provider_id = ? AND action_type = 'create' AND status = 0", providerID).Count(&auditCount)

	if count+auditCount >= 50 {
		response.Error(c, 400, "最多只能添加50个作品")
		return
	}

	imagesJSON, _ := json.Marshal(input.Images)

	quoteItemsJSON := "[]"
	quoteTotalCent := int64(0)
	quoteCurrency := input.QuoteCurrency
	if quoteCurrency == "" {
		quoteCurrency = "CNY"
	}
	if input.QuoteItems != nil {
		var quoteItems []service.CaseQuoteItem
		if err := json.Unmarshal(input.QuoteItems, &quoteItems); err != nil {
			response.Error(c, 400, "报价明细格式错误")
			return
		}
		computedTotal, normalizedItems := service.NormalizeCaseQuote(quoteItems)
		quoteTotalCent = computedTotal
		if input.QuoteTotalCent != nil && *input.QuoteTotalCent > 0 {
			quoteTotalCent = *input.QuoteTotalCent
		}
		if b, err := json.Marshal(normalizedItems); err == nil {
			quoteItemsJSON = string(b)
		}
	} else if input.QuoteTotalCent != nil && *input.QuoteTotalCent > 0 {
		quoteTotalCent = *input.QuoteTotalCent
	}

	audit := model.CaseAudit{
		ProviderID:     providerID,
		ActionType:     "create",
		Status:         0, // Pending
		Title:          input.Title,
		CoverImage:     input.CoverImage,
		Style:          input.Style,
		Layout:         input.Layout,
		Area:           input.Area,
		Price:          input.Price,
		QuoteTotalCent: quoteTotalCent,
		QuoteCurrency:  quoteCurrency,
		QuoteItems:     quoteItemsJSON,
		Year:           input.Year,
		Description:    input.Description,
		Images:         string(imagesJSON),
	}

	if err := repository.DB.Create(&audit).Error; err != nil {
		msg := "提交失败"
		errText := err.Error()
		if strings.Contains(errText, "does not exist") || strings.Contains(errText, "UndefinedColumn") {
			msg = "提交失败，请联系管理员检查数据库是否已升级"
		}
		response.Error(c, 500, msg)
		return
	}

	response.Success(c, gin.H{
		"id":      audit.ID, // 返回 Audit ID
		"message": "已提交审核",
	})
}

func createCaseDraftFromProject(projectID, providerID uint64, req merchantCasePayload) (*model.Project, *model.CaseAudit, error) {
	return service.GenerateCaseDraftFromProject(projectID, providerID, &service.ProjectCaseDraftInput{
		Title:          req.Title,
		CoverImage:     req.CoverImage,
		Style:          req.Style,
		Layout:         req.Layout,
		Area:           req.Area,
		Price:          req.Price,
		QuoteTotalCent: req.QuoteTotalCent,
		QuoteCurrency:  req.QuoteCurrency,
		QuoteItems:     req.QuoteItems,
		Description:    req.Description,
		Images:         req.Images,
	})
}

// MerchantCaseCreateFromProject 保存项目方案数据到灵感案例（生成待审核草稿）
func MerchantCaseCreateFromProject(c *gin.Context) {
	providerID := c.GetUint64("providerId")
	projectID := parseUint64(c.Param("projectId"))
	if projectID == 0 {
		response.Error(c, 400, "无效项目ID")
		return
	}

	var req merchantCasePayload
	_ = c.ShouldBindJSON(&req)
	normalizeMerchantCasePayload(&req)

	project, audit, err := createCaseDraftFromProject(projectID, providerID, req)
	if err != nil {
		response.Error(c, 400, err.Error())
		return
	}

	response.Success(c, gin.H{
		"auditId":   audit.ID,
		"projectId": project.ID,
		"message":   "已保存到灵感案例，等待审核",
	})
}

// CreateProjectInspirationDraft 用户侧从项目生成灵感案例草稿
func CreateProjectInspirationDraft(c *gin.Context) {
	projectID := parseUint64(c.Param("id"))
	if projectID == 0 {
		response.Error(c, 400, "无效项目ID")
		return
	}

	userID := c.GetUint64("userId")
	var project model.Project
	if err := repository.DB.First(&project, projectID).Error; err != nil {
		response.Error(c, 404, "项目不存在")
		return
	}
	if project.OwnerID != userID {
		response.Error(c, 403, "无权操作此项目")
		return
	}
	if project.InspirationCaseDraftID > 0 {
		response.Success(c, gin.H{
			"auditId":   project.InspirationCaseDraftID,
			"projectId": project.ID,
			"message":   "灵感案例草稿已生成",
		})
		return
	}

	providerID := project.ConstructionProviderID
	if providerID == 0 {
		providerID = project.ProviderID
	}
	projectResult, audit, err := createCaseDraftFromProject(projectID, providerID, merchantCasePayload{})
	if err != nil {
		response.Error(c, 400, err.Error())
		return
	}
	response.Success(c, gin.H{
		"auditId":   audit.ID,
		"projectId": projectResult.ID,
		"message":   "已生成灵感案例草稿，等待审核",
	})
}

// MerchantCaseUpdate 更新作品 (提交审核)
func MerchantCaseUpdate(c *gin.Context) {
	providerID := c.GetUint64("providerId")
	caseID := parseUint64(c.Param("id"))

	var input merchantCaseUpdatePayload
	if err := c.ShouldBindJSON(&input); err != nil {
		response.Error(c, 400, "参数错误")
		return
	}
	normalizeMerchantCaseUpdatePayload(&input)

	if strings.TrimSpace(input.Layout) == "" {
		input.Layout = "其他"
	}

	// 1. 检查是否存在 Pending Audit
	var existingAudit model.CaseAudit
	hasPending := repository.DB.Where("case_id = ? AND provider_id = ? AND status = 0", caseID, providerID).First(&existingAudit).Error == nil

	imagesJSON, _ := json.Marshal(input.Images)

	var (
		quoteItemsJSON string
		quoteTotalCent int64
		hasQuoteItems  bool
	)
	if input.QuoteItems != nil {
		hasQuoteItems = true
		var quoteItems []service.CaseQuoteItem
		if err := json.Unmarshal(input.QuoteItems, &quoteItems); err != nil {
			response.Error(c, 400, "报价明细格式错误")
			return
		}
		computedTotal, normalizedItems := service.NormalizeCaseQuote(quoteItems)
		quoteTotalCent = computedTotal
		if input.QuoteTotalCent != nil && *input.QuoteTotalCent > 0 {
			quoteTotalCent = *input.QuoteTotalCent
		}
		if b, err := json.Marshal(normalizedItems); err == nil {
			quoteItemsJSON = string(b)
		} else {
			quoteItemsJSON = "[]"
		}
	} else if input.QuoteTotalCent != nil && *input.QuoteTotalCent > 0 {
		quoteTotalCent = *input.QuoteTotalCent
	}

	if hasPending {
		// 更新现有的 Audit
		updates := map[string]interface{}{
			"title":       input.Title,
			"cover_image": input.CoverImage,
			"style":       input.Style,
			"layout":      input.Layout,
			"area":        input.Area,
			"price":       input.Price,
			"updated_at":  time.Now(),
			"year":        input.Year,
			"description": input.Description,
			"images":      string(imagesJSON),
		}
		if input.QuoteCurrency != "" {
			updates["quote_currency"] = input.QuoteCurrency
		}
		if input.QuoteTotalCent != nil || hasQuoteItems {
			updates["quote_total_cent"] = quoteTotalCent
		}
		if hasQuoteItems {
			updates["quote_items"] = quoteItemsJSON
		}
		repository.DB.Model(&existingAudit).Updates(updates)
	} else {
		// 创建新的 Audit
		newAudit := model.CaseAudit{
			ProviderID:     providerID,
			CaseID:         &caseID,
			ActionType:     "update",
			Status:         0,
			Title:          input.Title,
			CoverImage:     input.CoverImage,
			Style:          input.Style,
			Layout:         input.Layout,
			Area:           input.Area,
			Price:          input.Price,
			QuoteTotalCent: quoteTotalCent,
			QuoteCurrency:  input.QuoteCurrency,
			QuoteItems:     quoteItemsJSON,
			Year:           input.Year,
			Description:    input.Description,
			Images:         string(imagesJSON),
		}
		if newAudit.QuoteCurrency == "" {
			newAudit.QuoteCurrency = "CNY"
		}
		if !hasQuoteItems {
			newAudit.QuoteItems = "[]"
			if input.QuoteTotalCent == nil {
				newAudit.QuoteTotalCent = 0
			}
		}
		if err := repository.DB.Create(&newAudit).Error; err != nil {
			msg := "提交失败"
			errText := err.Error()
			if strings.Contains(errText, "does not exist") || strings.Contains(errText, "UndefinedColumn") {
				msg = "提交失败，请联系管理员检查数据库是否已升级"
			}
			response.Error(c, 500, msg)
			return
		}
	}

	response.Success(c, gin.H{"message": "修改已提交审核"})
}

// MerchantCaseDelete 删除作品 (提交审核)
func MerchantCaseDelete(c *gin.Context) {
	providerID := c.GetUint64("providerId")
	caseID := parseUint64(c.Param("id"))

	// 检查是否已有 Pending Audit
	var existingAudit model.CaseAudit
	hasPending := repository.DB.Where("case_id = ? AND provider_id = ? AND status = 0", caseID, providerID).First(&existingAudit).Error == nil

	if hasPending {
		// 如果是 update 类型的，直接改为 delete 类型
		repository.DB.Model(&existingAudit).Update("action_type", "delete")
	} else {
		// 创建 delete audit
		audit := model.CaseAudit{
			ProviderID: providerID,
			CaseID:     &caseID,
			ActionType: "delete",
			Status:     0,
		}
		repository.DB.Create(&audit)
	}

	response.Success(c, gin.H{"message": "删除申请已提交审核"})
}

// MerchantCaseReorder 作品排序 (直接生效，不审核)
func MerchantCaseReorder(c *gin.Context) {
	providerID := c.GetUint64("providerId")

	var input struct {
		Orders []struct {
			ID        uint64 `json:"id"`
			SortOrder int    `json:"sortOrder"`
		} `json:"orders" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		response.Error(c, 400, "参数错误")
		return
	}

	tx := repository.DB.Begin()
	for _, order := range input.Orders {
		// 只更新已发布的作品
		if order.ID > 0 {
			tx.Model(&model.ProviderCase{}).
				Where("id = ? AND provider_id = ?", order.ID, providerID).
				Update("sort_order", order.SortOrder)
		}
	}
	tx.Commit()

	response.Success(c, gin.H{"message": "排序已更新"})
}

// MerchantCaseGet 获取单个作品详情
func MerchantCaseGet(c *gin.Context) {
	providerID := c.GetUint64("providerId")
	caseID := parseUint64(c.Param("id"))

	// 1. 优先找 Pending Audit
	var audit model.CaseAudit
	if err := repository.DB.Where("case_id = ? AND provider_id = ? AND status = 0", caseID, providerID).First(&audit).Error; err == nil {
		// 返回 Audit 数据
		var images []string
		json.Unmarshal([]byte(audit.Images), &images)
		images = imgutil.GetFullImageURLs(images)
		response.Success(c, gin.H{
			"id":             caseID,
			"auditId":        audit.ID,
			"title":          audit.Title,
			"coverImage":     imgutil.GetFullImageURL(audit.CoverImage),
			"style":          audit.Style,
			"layout":         audit.Layout,
			"area":           audit.Area,
			"price":          audit.Price,
			"quoteTotalCent": audit.QuoteTotalCent,
			"quoteCurrency":  audit.QuoteCurrency,
			"quoteItems":     audit.QuoteItems,
			"year":           audit.Year,
			"description":    audit.Description,
			"images":         images,
			"status":         0,
			"actionType":     audit.ActionType,
		})
		return
	}

	// 2. 找正式数据
	var providerCase model.ProviderCase
	if err := repository.DB.Where("id = ? AND provider_id = ?", caseID, providerID).
		First(&providerCase).Error; err != nil {
		response.Error(c, 404, "作品不存在")
		return
	}

	var images []string
	json.Unmarshal([]byte(providerCase.Images), &images)
	images = imgutil.GetFullImageURLs(images)

	response.Success(c, gin.H{
		"id":             providerCase.ID,
		"title":          providerCase.Title,
		"coverImage":     imgutil.GetFullImageURL(providerCase.CoverImage),
		"style":          providerCase.Style,
		"layout":         providerCase.Layout,
		"area":           providerCase.Area,
		"price":          providerCase.Price,
		"quoteTotalCent": providerCase.QuoteTotalCent,
		"quoteCurrency":  providerCase.QuoteCurrency,
		"quoteItems":     providerCase.QuoteItems,
		"year":           providerCase.Year,
		"description":    providerCase.Description,
		"images":         images,
		"sortOrder":      providerCase.SortOrder,
		"createdAt":      providerCase.CreatedAt,
		"status":         1,
	})
}

// MerchantCaseCancelAudit 取消审核申请
func MerchantCaseCancelAudit(c *gin.Context) {
	providerID := c.GetUint64("providerId")
	auditID := parseUint64(c.Param("auditId"))

	var audit model.CaseAudit
	if err := repository.DB.Where("id = ? AND provider_id = ? AND status IN (0, 2)", auditID, providerID).First(&audit).Error; err != nil {
		response.Error(c, 404, "审核记录不存在")
		return
	}

	// 删除审核记录
	if err := repository.DB.Delete(&audit).Error; err != nil {
		response.Error(c, 500, "取消失败")
		return
	}

	response.Success(c, gin.H{"message": "已取消"})
}
