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

// ==================== 作品审核管理 ====================

// AdminListCaseAudits 获取待审核作品列表
func AdminListCaseAudits(c *gin.Context) {
	page := parseInt(c.Query("page"), 1)
	pageSize := parseInt(c.Query("pageSize"), 10)
	status := c.DefaultQuery("status", "0") // 默认待审核

	var audits []model.CaseAudit
	var total int64

	query := repository.DB.Model(&model.CaseAudit{})
	if status == "processed" {
		// 查询所有已处理的记录（通过+拒绝）
		query = query.Where("status IN (1, 2)")
	} else if status != "" {
		query = query.Where("status = ?", status)
	}

	query.Count(&total)

	// 预加载 Provider 信息以便展示商家名
	// 由于 Gorm 预加载需要定义关联，这里简化处理：手动查询或前端只展示 ProviderID
	// 为了体验，我们这里简单连表查询或者由前端根据 ID 查（不推荐）。
	// 最好的方式是后端聚合。

	if err := query.Order("created_at ASC").
		Offset((page - 1) * pageSize).Limit(pageSize).
		Find(&audits).Error; err != nil {
		response.Error(c, 500, "查询失败")
		return
	}

	// 聚合商家名称
	var resultList []gin.H
	for _, audit := range audits {
		var provider model.Provider
		var user model.User
		// 简单缓存优化这里略过，直接查
		repository.DB.First(&provider, audit.ProviderID)
		repository.DB.First(&user, provider.UserID)

		providerName := service.ResolveProviderDisplayName(provider, &user)

		var originalCase *model.ProviderCase
		if audit.CaseID != nil {
			var caseRecord model.ProviderCase
			if err := repository.DB.First(&caseRecord, *audit.CaseID).Error; err == nil {
				originalCase = &caseRecord
			}
		}
		visibilityResult := adminVisibilityResolver.ResolveCaseAudit(audit, originalCase)

		item := gin.H{
			"id":               audit.ID,
			"caseId":           audit.CaseID,
			"providerId":       audit.ProviderID,
			"providerName":     providerName,
			"actionType":       audit.ActionType,
			"sourceType":       audit.SourceType,
			"sourceProjectId":  audit.SourceProjectID,
			"sourceProposalId": audit.SourceProposalID,
			"title":            audit.Title,
			"status":           audit.Status,
			"createdAt":        audit.CreatedAt,
			"visibility":       visibilityResult.Visibility,
			"actions":          visibilityResult.Actions,
		}
		if visibilityResult.LegacyInfo != nil {
			item["legacyInfo"] = visibilityResult.LegacyInfo
		}

		resultList = append(resultList, item)
	}

	response.Success(c, gin.H{
		"list":  resultList,
		"total": total,
	})
}

// AdminGetCaseAudit 获取审核详情
func AdminGetCaseAudit(c *gin.Context) {
	auditID := parseUint64(c.Param("id"))

	var audit model.CaseAudit
	if err := repository.DB.First(&audit, auditID).Error; err != nil {
		response.Error(c, 404, "记录不存在")
		return
	}

	// 查询商家名称
	var provider model.Provider
	var user model.User
	repository.DB.First(&provider, audit.ProviderID)
	repository.DB.First(&user, provider.UserID)
	providerName := service.ResolveProviderDisplayName(provider, &user)

	// 解析图片
	var images []string
	json.Unmarshal([]byte(audit.Images), &images)
	images = imgutil.GetFullImageURLs(images)

	// 如果是修改/删除，查询原作品信息用于对比
	var originalCase *model.ProviderCase
	if audit.CaseID != nil {
		var pc model.ProviderCase
		if err := repository.DB.First(&pc, *audit.CaseID).Error; err == nil {
			originalCase = &pc
		}
	}

	visibilityResult := adminVisibilityResolver.ResolveCaseAudit(audit, originalCase)

	// 构造返回数据（包含 providerName）
	auditData := gin.H{
		"id":               audit.ID,
		"caseId":           audit.CaseID,
		"providerId":       audit.ProviderID,
		"providerName":     providerName,
		"actionType":       audit.ActionType,
		"sourceType":       audit.SourceType,
		"sourceProjectId":  audit.SourceProjectID,
		"sourceProposalId": audit.SourceProposalID,
		"title":            audit.Title,
		"coverImage":       imgutil.GetFullImageURL(audit.CoverImage),
		"style":            audit.Style,
		"layout":           audit.Layout,
		"area":             audit.Area,
		"price":            audit.Price,
		"quoteTotalCent":   audit.QuoteTotalCent,
		"quoteCurrency":    audit.QuoteCurrency,
		"quoteItems":       audit.QuoteItems,
		"year":             audit.Year,
		"description":      audit.Description,
		"status":           audit.Status,
		"rejectReason":     audit.RejectReason,
		"createdAt":        audit.CreatedAt,
		"visibility":       visibilityResult.Visibility,
		"actions":          visibilityResult.Actions,
	}
	if originalCase != nil {
		originalCase.CoverImage = imgutil.GetFullImageURL(originalCase.CoverImage)
		originalCase.Images = imgutil.NormalizeImageURLsJSON(originalCase.Images)
	}
	if visibilityResult.LegacyInfo != nil {
		auditData["legacyInfo"] = visibilityResult.LegacyInfo
	}

	response.Success(c, gin.H{
		"audit":        auditData,
		"images":       images,
		"originalCase": originalCase,
	})
}

// AdminApproveCaseAudit 通过审核
func AdminApproveCaseAudit(c *gin.Context) {
	auditID := parseUint64(c.Param("id"))
	adminID := c.GetUint64("adminId")

	tx := repository.DB.Begin()

	var audit model.CaseAudit
	if err := tx.First(&audit, auditID).Error; err != nil {
		tx.Rollback()
		response.Error(c, 404, "记录不存在")
		return
	}

	if audit.Status != 0 {
		tx.Rollback()
		response.Error(c, 400, "该记录已审核")
		return
	}

	quoteCurrency := audit.QuoteCurrency
	if quoteCurrency == "" {
		quoteCurrency = "CNY"
	}

	style := strings.TrimSpace(audit.Style)
	if style == "" {
		tx.Rollback()
		response.Error(c, 400, "作品风格不能为空")
		return
	}

	layout := strings.TrimSpace(audit.Layout)
	if layout == "" {
		layout = "其他"
	}

	price := audit.Price
	if price < 0 {
		price = 0
	}
	normalizedCoverImage := normalizeStoredAsset(audit.CoverImage)
	normalizedImages := normalizeStoredAssetJSONArray(audit.Images)

	// 执行 Action
	switch audit.ActionType {
	case "create":
		// 插入 ProviderCase
		newCase := model.ProviderCase{
			ProviderID:     audit.ProviderID,
			Title:          audit.Title,
			CoverImage:     normalizedCoverImage,
			Style:          style,
			Layout:         layout,
			Area:           audit.Area,
			Price:          price,
			QuoteTotalCent: audit.QuoteTotalCent,
			QuoteCurrency:  quoteCurrency,
			QuoteItems:     audit.QuoteItems,
			Year:           audit.Year,
			Description:    audit.Description,
			Images:         normalizedImages,
			SortOrder:      0, // 默认
			// 商家案例仅在商家详情页展示，不进入独立灵感图库。
			ShowInInspiration: false,
		}
		if err := tx.Create(&newCase).Error; err != nil {
			tx.Rollback()
			response.Error(c, 500, "创建作品失败")
			return
		}
		// 回填 CaseID 到 Audit (方便追踪)
		audit.CaseID = &newCase.ID

	case "update":
		if audit.CaseID == nil {
			tx.Rollback()
			response.Error(c, 500, "数据异常：CaseID为空")
			return
		}
		// 更新 ProviderCase
		updates := map[string]interface{}{
			"title":            audit.Title,
			"cover_image":      normalizedCoverImage,
			"style":            style,
			"layout":           layout,
			"area":             audit.Area,
			"price":            price,
			"quote_total_cent": audit.QuoteTotalCent,
			"quote_currency":   quoteCurrency,
			"quote_items":      audit.QuoteItems,
			"year":             audit.Year,
			"description":      audit.Description,
			"images":           normalizedImages,
			"updated_at":       time.Now(),
		}
		if err := tx.Model(&model.ProviderCase{}).Where("id = ?", *audit.CaseID).Updates(updates).Error; err != nil {
			tx.Rollback()
			response.Error(c, 500, "更新作品失败")
			return
		}

	case "delete":
		if audit.CaseID == nil {
			tx.Rollback()
			response.Error(c, 500, "数据异常：CaseID为空")
			return
		}
		// 物理删除 (或软删除，取决于需求。这里做物理删除)
		if err := tx.Delete(&model.ProviderCase{}, *audit.CaseID).Error; err != nil {
			tx.Rollback()
			response.Error(c, 500, "删除作品失败")
			return
		}
	}

	// 更新 Audit 状态
	now := time.Now()
	updates := map[string]interface{}{
		"status":     1, // Approved
		"audited_by": adminID,
		"audited_at": &now,
	}
	// 如果是 create，还要更新 case_id
	if audit.ActionType == "create" && audit.CaseID != nil {
		updates["case_id"] = *audit.CaseID
	}

	if err := tx.Model(&audit).Updates(updates).Error; err != nil {
		tx.Rollback()
		response.Error(c, 500, "更新审核状态失败")
		return
	}

	tx.Commit()
	response.Success(c, gin.H{"message": "审核已通过"})
}

// AdminRejectCaseAudit 拒绝审核
func AdminRejectCaseAudit(c *gin.Context) {
	auditID := parseUint64(c.Param("id"))
	adminID := c.GetUint64("adminId")

	var input struct {
		Reason string `json:"reason" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		response.Error(c, 400, "请填写拒绝原因")
		return
	}

	tx := repository.DB.Begin()

	var audit model.CaseAudit
	if err := tx.First(&audit, auditID).Error; err != nil {
		tx.Rollback()
		response.Error(c, 404, "记录不存在")
		return
	}

	if audit.Status != 0 {
		tx.Rollback()
		response.Error(c, 400, "该记录已审核")
		return
	}

	// 更新 Audit 状态
	now := time.Now()
	updates := map[string]interface{}{
		"status":        2, // Rejected
		"reject_reason": input.Reason,
		"audited_by":    adminID,
		"audited_at":    &now,
	}

	if err := tx.Model(&audit).Updates(updates).Error; err != nil {
		tx.Rollback()
		response.Error(c, 500, "更新状态失败")
		return
	}

	tx.Commit()
	response.Success(c, gin.H{"message": "已拒绝该申请"})
}
