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

// ==================== 管理员作品管理 ====================

func buildAdminCaseProviderName(providerID uint64) string {
	if providerID == 0 {
		return "官方"
	}

	var provider model.Provider
	if err := repository.DB.First(&provider, providerID).Error; err != nil {
		return ""
	}

	var user model.User
	_ = repository.DB.First(&user, provider.UserID).Error

	if name := strings.TrimSpace(user.Nickname); name != "" {
		return name
	}
	if name := strings.TrimSpace(provider.CompanyName); name != "" {
		return name
	}
	if phone := strings.TrimSpace(user.Phone); phone != "" {
		return phone
	}

	return ""
}

// AdminListCases 获取所有作品列表
func AdminListCases(c *gin.Context) {
	page := parseInt(c.Query("page"), 1)
	pageSize := parseInt(c.Query("pageSize"), 10)
	providerID := c.Query("providerId") // 可选筛选
	style := c.Query("style")           // 可选筛选

	var cases []model.ProviderCase
	var total int64

	query := repository.DB.Model(&model.ProviderCase{})

	// 筛选条件
	if providerID != "" {
		query = query.Where("provider_id = ?", providerID)
	}
	if style != "" {
		query = query.Where("style = ?", style)
	}

	query.Count(&total)

	if err := query.Order("created_at DESC").
		Offset((page - 1) * pageSize).Limit(pageSize).
		Find(&cases).Error; err != nil {
		response.Error(c, 500, "查询失败")
		return
	}

	// 聚合商家名称
	var resultList []gin.H
	for _, caseItem := range cases {
		providerName := buildAdminCaseProviderName(caseItem.ProviderID)

		// 解析图片
		var images []string
		json.Unmarshal([]byte(caseItem.Images), &images)
		images = imgutil.GetFullImageURLs(images)

		resultList = append(resultList, gin.H{
			"id":                caseItem.ID,
			"providerId":        caseItem.ProviderID,
			"providerName":      providerName,
			"title":             caseItem.Title,
			"coverImage":        imgutil.GetFullImageURL(caseItem.CoverImage),
			"style":             caseItem.Style,
			"layout":            caseItem.Layout,
			"area":              caseItem.Area,
			"price":             caseItem.Price,
			"quoteTotalCent":    caseItem.QuoteTotalCent,
			"quoteCurrency":     caseItem.QuoteCurrency,
			"year":              caseItem.Year,
			"description":       caseItem.Description,
			"images":            images,
			"sortOrder":         caseItem.SortOrder,
			"showInInspiration": caseItem.ShowInInspiration,
			"createdAt":         caseItem.CreatedAt,
			"updatedAt":         caseItem.UpdatedAt,
		})
	}

	response.Success(c, gin.H{
		"list":  resultList,
		"total": total,
	})
}

func AdminGetCase(c *gin.Context) {
	caseID := parseUint64(c.Param("id"))
	if caseID == 0 {
		response.Error(c, 400, "ID无效")
		return
	}

	var caseItem model.ProviderCase
	if err := repository.DB.First(&caseItem, caseID).Error; err != nil {
		response.Error(c, 404, "作品不存在")
		return
	}

	providerName := buildAdminCaseProviderName(caseItem.ProviderID)

	var images []string
	json.Unmarshal([]byte(caseItem.Images), &images)
	images = imgutil.GetFullImageURLs(images)

	response.Success(c, gin.H{
		"id":                caseItem.ID,
		"providerId":        caseItem.ProviderID,
		"providerName":      providerName,
		"title":             caseItem.Title,
		"coverImage":        imgutil.GetFullImageURL(caseItem.CoverImage),
		"style":             caseItem.Style,
		"layout":            caseItem.Layout,
		"area":              caseItem.Area,
		"price":             caseItem.Price,
		"quoteTotalCent":    caseItem.QuoteTotalCent,
		"quoteCurrency":     caseItem.QuoteCurrency,
		"quoteItems":        caseItem.QuoteItems,
		"year":              caseItem.Year,
		"description":       caseItem.Description,
		"images":            images,
		"sortOrder":         caseItem.SortOrder,
		"showInInspiration": caseItem.ShowInInspiration,
		"createdAt":         caseItem.CreatedAt,
		"updatedAt":         caseItem.UpdatedAt,
	})
}

// AdminCreateCase 官方添加作品
func AdminCreateCase(c *gin.Context) {
	var input struct {
		ProviderID        *uint64         `json:"providerId"`
		Title             string          `json:"title" binding:"required"`
		CoverImage        string          `json:"coverImage" binding:"required"`
		Style             string          `json:"style" binding:"required"`
		Layout            string          `json:"layout"`
		Area              string          `json:"area"`
		Price             float64         `json:"price"`
		QuoteTotalCent    *int64          `json:"quoteTotalCent"`
		QuoteCurrency     string          `json:"quoteCurrency"`
		QuoteItems        json.RawMessage `json:"quoteItems"`
		Year              string          `json:"year"`
		Description       string          `json:"description"`
		Images            []string        `json:"images"`
		ShowInInspiration *bool           `json:"showInInspiration"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		response.Error(c, 400, "参数错误: "+err.Error())
		return
	}

	if strings.TrimSpace(input.Layout) == "" {
		// Keep layout always present for downstream filtering & display.
		input.Layout = "其他"
	}

	// 序列化图片数组
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

	// 确定 ProviderID（官方作品为 0）
	var providerID uint64
	if input.ProviderID != nil {
		providerID = *input.ProviderID
	} else {
		providerID = 0
	}

	newCase := model.ProviderCase{
		ProviderID:     providerID,
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
		SortOrder:      0,
		// 管理员创建的作品默认展示到灵感库；如需不展示，前端显式传 false。
		ShowInInspiration: func() bool {
			if input.ShowInInspiration != nil {
				return *input.ShowInInspiration
			}
			return true
		}(),
	}

	if err := repository.DB.Create(&newCase).Error; err != nil {
		response.Error(c, 500, "创建失败")
		return
	}

	response.Success(c, gin.H{
		"id":      newCase.ID,
		"message": "创建成功",
	})
}

// AdminUpdateCase 官方编辑作品
func AdminUpdateCase(c *gin.Context) {
	caseID := parseUint64(c.Param("id"))

	var input struct {
		ProviderID        *uint64         `json:"providerId"`
		Title             string          `json:"title" binding:"required"`
		CoverImage        string          `json:"coverImage" binding:"required"`
		Style             string          `json:"style" binding:"required"`
		Layout            string          `json:"layout"`
		Area              string          `json:"area"`
		Price             float64         `json:"price"`
		QuoteTotalCent    *int64          `json:"quoteTotalCent"`
		QuoteCurrency     string          `json:"quoteCurrency"`
		QuoteItems        json.RawMessage `json:"quoteItems"`
		Year              string          `json:"year"`
		Description       string          `json:"description"`
		Images            []string        `json:"images"`
		ShowInInspiration *bool           `json:"showInInspiration"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		response.Error(c, 400, "参数错误: "+err.Error())
		return
	}

	if strings.TrimSpace(input.Layout) == "" {
		input.Layout = "其他"
	}

	// 检查作品是否存在
	var existingCase model.ProviderCase
	if err := repository.DB.First(&existingCase, caseID).Error; err != nil {
		response.Error(c, 404, "作品不存在")
		return
	}

	// 序列化图片数组
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

	// 确定 ProviderID
	var providerID uint64
	if input.ProviderID != nil {
		providerID = *input.ProviderID
	} else {
		providerID = 0
	}

	// 更新数据
	updates := map[string]interface{}{
		"provider_id": providerID,
		"title":       input.Title,
		"cover_image": input.CoverImage,
		"style":       input.Style,
		"layout":      input.Layout,
		"area":        input.Area,
		"price":       input.Price,
		"year":        input.Year,
		"description": input.Description,
		"images":      string(imagesJSON),
		"updated_at":  time.Now(),
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
	if input.ShowInInspiration != nil {
		updates["show_in_inspiration"] = *input.ShowInInspiration
	}

	if err := repository.DB.Model(&model.ProviderCase{}).Where("id = ?", caseID).Updates(updates).Error; err != nil {
		response.Error(c, 500, "更新失败")
		return
	}

	response.Success(c, gin.H{"message": "更新成功"})
}

// AdminDeleteCase 官方删除作品
func AdminDeleteCase(c *gin.Context) {
	caseID := parseUint64(c.Param("id"))

	// 检查作品是否存在
	var existingCase model.ProviderCase
	if err := repository.DB.First(&existingCase, caseID).Error; err != nil {
		response.Error(c, 404, "作品不存在")
		return
	}

	// 物理删除
	if err := repository.DB.Delete(&model.ProviderCase{}, caseID).Error; err != nil {
		response.Error(c, 500, "删除失败")
		return
	}

	response.Success(c, gin.H{"message": "删除成功"})
}

func AdminToggleCaseInspiration(c *gin.Context) {
	caseID := parseUint64(c.Param("id"))
	var input struct {
		ShowInInspiration bool `json:"showInInspiration"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}

	if err := repository.DB.Model(&model.ProviderCase{}).
		Where("id = ?", caseID).
		Update("show_in_inspiration", input.ShowInInspiration).Error; err != nil {
		response.ServerError(c, "更新失败")
		return
	}

	response.Success(c, gin.H{"message": "更新成功"})
}

func AdminBatchDeleteCases(c *gin.Context) {
	var input struct {
		IDs []uint64 `json:"ids" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}

	if len(input.IDs) == 0 {
		response.BadRequest(c, "请选择要删除的作品")
		return
	}

	if err := repository.DB.Where("id IN ?", input.IDs).Delete(&model.ProviderCase{}).Error; err != nil {
		response.ServerError(c, "批量删除失败")
		return
	}

	response.Success(c, gin.H{
		"message": "批量删除成功",
		"count":   len(input.IDs),
	})
}
