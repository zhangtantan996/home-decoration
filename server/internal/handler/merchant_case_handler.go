package handler

import (
	"encoding/json"
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	"home-decoration-server/pkg/response"
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
		resultList = append(resultList, gin.H{
			"id":           0, // 新增暂无 ID
			"auditId":      audit.ID,
			"title":        audit.Title,
			"coverImage":   audit.CoverImage,
			"style":        audit.Style,
			"layout":       audit.Layout,
			"area":         audit.Area,
			"price":        audit.Price,
			"year":         audit.Year,
			"description":  audit.Description,
			"images":       images,
			"sortOrder":    0,
			"createdAt":    audit.CreatedAt,
			"status":       audit.Status, // 0=待审核, 2=已拒绝
			"actionType":   "create",
			"rejectReason": audit.RejectReason,
		})
	}

	// 处理已发布作品 (检查是否有更新/删除审核)
	for _, pc := range publishedCases {
		item := gin.H{
			"id":          pc.ID,
			"title":       pc.Title,
			"coverImage":  pc.CoverImage,
			"style":       pc.Style,
			"layout":      pc.Layout,
			"area":        pc.Area,
			"price":       pc.Price,
			"year":        pc.Year,
			"description": pc.Description,
			"sortOrder":   pc.SortOrder,
			"createdAt":   pc.CreatedAt,
			"status":      1, // 已发布
			"actionType":  "",
		}

		var images []string
		json.Unmarshal([]byte(pc.Images), &images)
		item["images"] = images

		// 检查是否有挂起的审核
		if audit, exists := auditMap[pc.ID]; exists {
			item["auditId"] = audit.ID
			item["status"] = audit.Status // 0=待审核, 2=已拒绝
			item["actionType"] = audit.ActionType
			item["rejectReason"] = audit.RejectReason

			// 如果是修改，优先展示修改后的内容预览
			if audit.ActionType == "update" {
				item["title"] = audit.Title
				item["coverImage"] = audit.CoverImage
				item["style"] = audit.Style
				item["layout"] = audit.Layout
				item["area"] = audit.Area
				item["price"] = audit.Price
				item["year"] = audit.Year
				item["description"] = audit.Description
				var newImages []string
				json.Unmarshal([]byte(audit.Images), &newImages)
				item["images"] = newImages
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

// MerchantCaseCreate 创建作品 (提交审核)
func MerchantCaseCreate(c *gin.Context) {
	providerID := c.GetUint64("providerId")

	var input struct {
		Title       string   `json:"title" binding:"required"`
		CoverImage  string   `json:"coverImage" binding:"required"`
		Style       string   `json:"style"`
		Layout      string   `json:"layout"`
		Area        string   `json:"area"`
		Price       float64  `json:"price"`
		Year        string   `json:"year"`
		Description string   `json:"description"`
		Images      []string `json:"images" binding:"required,min=1"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		response.Error(c, 400, "参数错误: "+err.Error())
		return
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

	audit := model.CaseAudit{
		ProviderID:  providerID,
		ActionType:  "create",
		Status:      0, // Pending
		Title:       input.Title,
		CoverImage:  input.CoverImage,
		Style:       input.Style,
		Layout:      input.Layout,
		Area:        input.Area,
		Price:       input.Price,
		Year:        input.Year,
		Description: input.Description,
		Images:      string(imagesJSON),
	}

	if err := repository.DB.Create(&audit).Error; err != nil {
		response.Error(c, 500, "提交失败")
		return
	}

	response.Success(c, gin.H{
		"id":      audit.ID, // 返回 Audit ID
		"message": "已提交审核",
	})
}

// MerchantCaseUpdate 更新作品 (提交审核)
func MerchantCaseUpdate(c *gin.Context) {
	providerID := c.GetUint64("providerId")
	caseID := parseUint64(c.Param("id"))

	var input struct {
		Title       string   `json:"title"`
		CoverImage  string   `json:"coverImage"`
		Style       string   `json:"style"`
		Layout      string   `json:"layout"`
		Area        string   `json:"area"`
		Price       float64  `json:"price"`
		Year        string   `json:"year"`
		Description string   `json:"description"`
		Images      []string `json:"images"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		response.Error(c, 400, "参数错误")
		return
	}

	// 1. 检查是否存在 Pending Audit
	var existingAudit model.CaseAudit
	hasPending := repository.DB.Where("case_id = ? AND provider_id = ? AND status = 0", caseID, providerID).First(&existingAudit).Error == nil

	imagesJSON, _ := json.Marshal(input.Images)

	if hasPending {
		// 更新现有的 Audit
		updates := map[string]interface{}{
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
		repository.DB.Model(&existingAudit).Updates(updates)
	} else {
		// 创建新的 Audit
		newAudit := model.CaseAudit{
			ProviderID:  providerID,
			CaseID:      &caseID,
			ActionType:  "update",
			Status:      0,
			Title:       input.Title,
			CoverImage:  input.CoverImage,
			Style:       input.Style,
			Layout:      input.Layout,
			Area:        input.Area,
			Price:       input.Price,
			Year:        input.Year,
			Description: input.Description,
			Images:      string(imagesJSON),
		}
		if err := repository.DB.Create(&newAudit).Error; err != nil {
			response.Error(c, 500, "提交失败")
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
		response.Success(c, gin.H{
			"id":          caseID,
			"auditId":     audit.ID,
			"title":       audit.Title,
			"coverImage":  audit.CoverImage,
			"style":       audit.Style,
			"layout":      audit.Layout,
			"area":        audit.Area,
			"price":       audit.Price,
			"year":        audit.Year,
			"description": audit.Description,
			"images":      images,
			"status":      0,
			"actionType":  audit.ActionType,
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

	response.Success(c, gin.H{
		"id":          providerCase.ID,
		"title":       providerCase.Title,
		"coverImage":  providerCase.CoverImage,
		"style":       providerCase.Style,
		"layout":      providerCase.Layout,
		"area":        providerCase.Area,
		"price":       providerCase.Price,
		"year":        providerCase.Year,
		"description": providerCase.Description,
		"images":      images,
		"sortOrder":   providerCase.SortOrder,
		"createdAt":   providerCase.CreatedAt,
		"status":      1,
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
