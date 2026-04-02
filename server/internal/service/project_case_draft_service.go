package service

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"

	"gorm.io/gorm"
)

type ProjectCaseDraftInput struct {
	Title          string          `json:"title"`
	CoverImage     string          `json:"coverImage"`
	Style          string          `json:"style"`
	Layout         string          `json:"layout"`
	Area           string          `json:"area"`
	Price          float64         `json:"price"`
	QuoteTotalCent *int64          `json:"quoteTotalCent"`
	QuoteCurrency  string          `json:"quoteCurrency"`
	QuoteItems     json.RawMessage `json:"quoteItems"`
	Description    string          `json:"description"`
	Images         []string        `json:"images"`
}

func GenerateCaseDraftFromProject(projectID, providerID uint64, req *ProjectCaseDraftInput) (*model.Project, *model.CaseAudit, error) {
	var (
		project *model.Project
		audit   *model.CaseAudit
	)
	err := repository.DB.Transaction(func(tx *gorm.DB) error {
		loadedProject, loadedAudit, err := GenerateCaseDraftFromProjectTx(tx, projectID, providerID, req)
		if err != nil {
			return err
		}
		project = loadedProject
		audit = loadedAudit
		return nil
	})
	if err != nil {
		return nil, nil, err
	}
	return project, audit, nil
}

func GenerateCaseDraftFromProjectTx(tx *gorm.DB, projectID, providerID uint64, req *ProjectCaseDraftInput) (*model.Project, *model.CaseAudit, error) {
	if projectID == 0 || providerID == 0 {
		return nil, nil, fmt.Errorf("无效项目")
	}
	if req == nil {
		req = &ProjectCaseDraftInput{}
	}
	if tx == nil {
		return nil, nil, fmt.Errorf("事务不能为空")
	}

	flowSvc := &BusinessFlowService{}
	var project model.Project
	if err := tx.First(&project, projectID).Error; err != nil {
		return nil, nil, fmt.Errorf("项目不存在")
	}
	if project.ProviderID != providerID && project.ConstructionProviderID != providerID {
		return nil, nil, fmt.Errorf("无权操作此项目")
	}
	if project.InspirationCaseDraftID > 0 {
		var existing model.CaseAudit
		if err := tx.First(&existing, project.InspirationCaseDraftID).Error; err == nil {
			return &project, &existing, nil
		}
	}

	var proposal model.Proposal
	if project.ProposalID > 0 {
		if err := tx.First(&proposal, project.ProposalID).Error; err != nil {
			return nil, nil, fmt.Errorf("项目缺少关联方案")
		}
	} else {
		tx.Where("designer_id = ?", providerID).Order("created_at DESC").First(&proposal)
	}

	var workLogs []model.WorkLog
	tx.Where("project_id = ?", projectID).Order("created_at DESC").Find(&workLogs)
	images := make([]string, 0, 12)
	for _, logItem := range workLogs {
		var logImages []string
		if err := json.Unmarshal([]byte(logItem.Photos), &logImages); err == nil {
			images = append(images, logImages...)
		}
	}
	if len(req.Images) > 0 {
		images = req.Images
	}
	if len(images) == 0 && strings.TrimSpace(project.CompletedPhotos) != "" {
		var completed []string
		if err := json.Unmarshal([]byte(project.CompletedPhotos), &completed); err == nil {
			images = append(images, completed...)
		}
	}
	if len(images) == 0 {
		var attachments []string
		if err := json.Unmarshal([]byte(proposal.Attachments), &attachments); err == nil {
			images = append(images, attachments...)
		}
	}
	if len(images) == 0 {
		return nil, nil, fmt.Errorf("缺少可保存到灵感案例的图片")
	}
	images = normalizeStoredAssetSlice(images)

	title := strings.TrimSpace(req.Title)
	if title == "" {
		title = strings.TrimSpace(project.Name)
	}
	if title == "" {
		title = fmt.Sprintf("%s装修方案", strings.TrimSpace(project.Address))
	}

	coverImage := strings.TrimSpace(req.CoverImage)
	if coverImage == "" {
		coverImage = images[0]
	}
	coverImage = normalizeStoredAsset(coverImage)

	style := strings.TrimSpace(req.Style)
	if style == "" {
		style = "现代"
	}
	layout := strings.TrimSpace(req.Layout)
	if layout == "" {
		layout = "其他"
	}
	area := strings.TrimSpace(req.Area)
	if area == "" && project.Area > 0 {
		area = fmt.Sprintf("%.0f㎡", project.Area)
	}
	price := req.Price
	if price <= 0 {
		price = project.Budget
	}
	if price <= 0 {
		price = proposal.DesignFee + proposal.ConstructionFee + proposal.MaterialFee
	}
	description := strings.TrimSpace(req.Description)
	if description == "" {
		description = strings.TrimSpace(project.CompletionNotes)
	}
	if description == "" {
		description = strings.TrimSpace(proposal.Summary)
	}
	if description == "" {
		description = fmt.Sprintf("来源于项目 %s 的完工方案沉淀", title)
	}
	quoteCurrency := strings.TrimSpace(req.QuoteCurrency)
	if quoteCurrency == "" {
		quoteCurrency = "CNY"
	}

	quoteItemsJSON := "[]"
	quoteTotalCent := int64(price * 100)
	if req.QuoteItems != nil {
		var quoteItems []CaseQuoteItem
		if err := json.Unmarshal(req.QuoteItems, &quoteItems); err != nil {
			return nil, nil, fmt.Errorf("报价明细格式错误")
		}
		computedTotal, normalizedItems := NormalizeCaseQuote(quoteItems)
		quoteTotalCent = computedTotal
		if b, err := json.Marshal(normalizedItems); err == nil {
			quoteItemsJSON = string(b)
		}
	} else if proposal.ID > 0 {
		fallbackItems := []CaseQuoteItem{
			{Category: "设计费", ItemName: "设计方案", AmountCent: int64(proposal.DesignFee * 100)},
			{Category: "施工费", ItemName: "施工预算", AmountCent: int64(proposal.ConstructionFee * 100)},
			{Category: "主材费", ItemName: "主材预算", AmountCent: int64(proposal.MaterialFee * 100)},
		}
		computedTotal, normalizedItems := NormalizeCaseQuote(fallbackItems)
		quoteTotalCent = computedTotal
		if b, err := json.Marshal(normalizedItems); err == nil {
			quoteItemsJSON = string(b)
		}
	}
	if req.QuoteTotalCent != nil && *req.QuoteTotalCent > 0 {
		quoteTotalCent = *req.QuoteTotalCent
	}

	imagesJSON, _ := json.Marshal(images)
	audit := model.CaseAudit{
		ProviderID:       providerID,
		ActionType:       "create",
		SourceType:       "project_completion",
		SourceProjectID:  project.ID,
		SourceProposalID: project.ProposalID,
		Status:           0,
		Title:            title,
		CoverImage:       coverImage,
		Style:            style,
		Layout:           layout,
		Area:             area,
		Price:            price,
		QuoteTotalCent:   quoteTotalCent,
		QuoteCurrency:    quoteCurrency,
		QuoteItems:       quoteItemsJSON,
		Year:             time.Now().Format("2006"),
		Description:      description,
		Images:           string(imagesJSON),
		SortOrder:        0,
	}

	if err := tx.Create(&audit).Error; err != nil {
		return nil, nil, fmt.Errorf("保存灵感案例草稿失败")
	}
	if err := tx.Model(&model.Project{}).Where("id = ?", project.ID).Updates(map[string]interface{}{
		"inspiration_case_draft_id": audit.ID,
		"current_phase":             "已归档",
	}).Error; err != nil {
		return nil, nil, fmt.Errorf("保存灵感案例草稿失败")
	}
	if err := flowSvc.AdvanceByProject(tx, project.ID, map[string]interface{}{
		"current_stage":             model.BusinessFlowStageArchived,
		"inspiration_case_draft_id": audit.ID,
	}); err != nil {
		return nil, nil, fmt.Errorf("保存灵感案例草稿失败")
	}
	project.InspirationCaseDraftID = audit.ID
	project.CurrentPhase = "已归档"
	return &project, &audit, nil
}
