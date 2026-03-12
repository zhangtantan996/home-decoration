package service

import (
	"crypto/sha1"
	"encoding/hex"
	"errors"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
	"unicode"
	"unicode/utf16"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"

	"gorm.io/gorm"
)

type QuoteService struct{}

type QuoteLibraryImportResult struct {
	Imported int    `json:"imported"`
	Updated  int    `json:"updated"`
	Skipped  int    `json:"skipped"`
	FilePath string `json:"filePath"`
}

type QuoteListCreateInput struct {
	ProjectID    uint64     `json:"projectId"`
	CustomerID   uint64     `json:"customerId"`
	HouseID      uint64     `json:"houseId"`
	OwnerUserID  uint64     `json:"ownerUserId"`
	ScenarioType string     `json:"scenarioType"`
	Title        string     `json:"title"`
	Currency     string     `json:"currency"`
	DeadlineAt   *time.Time `json:"deadlineAt"`
}

type QuoteListItemUpsertInput struct {
	ID             uint64   `json:"id"`
	StandardItemID uint64   `json:"standardItemId"`
	LineNo         int      `json:"lineNo"`
	Name           string   `json:"name"`
	Unit           string   `json:"unit"`
	Quantity       float64  `json:"quantity"`
	PricingNote    string   `json:"pricingNote"`
	CategoryL1     string   `json:"categoryL1"`
	CategoryL2     string   `json:"categoryL2"`
	SortOrder      int      `json:"sortOrder"`
}

type QuoteLibraryListResult struct {
	List     []model.QuoteLibraryItem `json:"list"`
	Total    int64                    `json:"total"`
	Page     int                      `json:"page"`
	PageSize int                      `json:"pageSize"`
}

type QuoteListSummary struct {
	ID              uint64    `json:"id"`
	ProjectID       uint64    `json:"projectId"`
	CustomerID      uint64    `json:"customerId"`
	HouseID         uint64    `json:"houseId"`
	OwnerUserID     uint64    `json:"ownerUserId"`
	ScenarioType    string    `json:"scenarioType"`
	Title           string    `json:"title"`
	Status          string    `json:"status"`
	Currency        string    `json:"currency"`
	DeadlineAt      *time.Time `json:"deadlineAt,omitempty"`
	AwardedProviderID uint64  `json:"awardedProviderId"`
	ItemCount       int64     `json:"itemCount"`
	InvitationCount int64     `json:"invitationCount"`
	SubmissionCount int64     `json:"submissionCount"`
	UpdatedAt       time.Time `json:"updatedAt"`
}

type QuoteListListResult struct {
	List     []QuoteListSummary `json:"list"`
	Total    int64              `json:"total"`
	Page     int                `json:"page"`
	PageSize int                `json:"pageSize"`
}

type AdminQuoteListDetail struct {
	QuoteList     model.QuoteList        `json:"quoteList"`
	Items         []model.QuoteListItem   `json:"items"`
	Invitations   []model.QuoteInvitation `json:"invitations"`
	SubmissionCount int64                 `json:"submissionCount"`
}

type QuoteMerchantListItem struct {
	ID                 uint64 `json:"id"`
	Title              string `json:"title"`
	Status             string `json:"status"`
	DeadlineAt         string `json:"deadlineAt,omitempty"`
	Currency           string `json:"currency,omitempty"`
	UpdatedAt          string `json:"updatedAt,omitempty"`
	MySubmissionStatus string `json:"mySubmissionStatus,omitempty"`
	MyTotalCent        int64  `json:"myTotalCent,omitempty"`
}

type QuoteSubmissionItemInput struct {
	QuoteListItemID uint64 `json:"quoteListItemId"`
	UnitPriceCent   int64  `json:"unitPriceCent"`
	Remark          string `json:"remark"`
}

type QuoteSubmissionSaveInput struct {
	Items                  []QuoteSubmissionItemInput `json:"items"`
	EstimatedDays          int                        `json:"estimatedDays"`
	Remark                 string                     `json:"remark"`
	TeamSize               int                        `json:"teamSize"`
	WorkTypes              []string                   `json:"workTypes"`
	ConstructionMethodNote string                     `json:"constructionMethodNote"`
	SiteVisitRequired      bool                       `json:"siteVisitRequired"`
}

type QuoteCategoryTotal struct {
	Category  string `json:"category"`
	TotalCent int64  `json:"totalCent"`
}

type QuoteComparisonSubmission struct {
	SubmissionID     uint64              `json:"submissionId"`
	ProviderID       uint64              `json:"providerId"`
	ProviderName     string              `json:"providerName"`
	ProviderType     int8                `json:"providerType"`
	ProviderSubType  string              `json:"providerSubType"`
	Status           string              `json:"status"`
	TotalCent        int64               `json:"totalCent"`
	MissingItemIDs   []uint64            `json:"missingItemIds"`
	AbnormalItemIDs  []uint64            `json:"abnormalItemIds"`
	CategoryTotals   []QuoteCategoryTotal `json:"categoryTotals"`
}

type QuoteComparisonResponse struct {
	QuoteList   model.QuoteList            `json:"quoteList"`
	Items       []model.QuoteListItem      `json:"items"`
	Submissions []QuoteComparisonSubmission `json:"submissions"`
}

type MerchantQuoteListDetail struct {
	QuoteList  model.QuoteList      `json:"quoteList"`
	Items      []model.QuoteListItem `json:"items"`
	Invitation model.QuoteInvitation `json:"invitation"`
	Submission *MerchantSubmission   `json:"submission,omitempty"`
}

type MerchantSubmission struct {
	Status        string                       `json:"status"`
	TotalCent     int64                        `json:"totalCent"`
	Currency      string                       `json:"currency"`
	Items         []model.QuoteSubmissionItem  `json:"items"`
	EstimatedDays int                          `json:"estimatedDays"`
	Remark        string                       `json:"remark"`
}

func (s *QuoteService) ImportQuoteLibraryFromERP(filePath string) (*QuoteLibraryImportResult, error) {
	resolvedPath, err := resolveERPQuotePath(filePath)
	if err != nil {
		return nil, err
	}

	content, err := os.ReadFile(resolvedPath)
	if err != nil {
		return nil, fmt.Errorf("读取 ERP 报价文件失败: %w", err)
	}

	names := extractERPQuoteItemNames(content)
	if len(names) == 0 {
		return nil, errors.New("未从 ERP 报价文件中提取到有效项目")
	}

	result := &QuoteLibraryImportResult{FilePath: resolvedPath}
	for _, name := range names {
		unit := guessQuoteUnit(name)
		categoryL1, categoryL2 := classifyQuoteCategory(name)
		code := buildERPItemCode(name)
		fingerprint := hashString(name)

		var existing model.QuoteLibraryItem
		err := repository.DB.Where("erp_item_code = ?", code).First(&existing).Error
		if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf("查询报价库项目失败: %w", err)
		}

		if errors.Is(err, gorm.ErrRecordNotFound) {
			item := model.QuoteLibraryItem{
				ERPItemCode:        code,
				Name:               name,
				Unit:               unit,
				CategoryL1:         categoryL1,
				CategoryL2:         categoryL2,
				ReferencePriceCent: 0,
				PricingNote:        buildPricingNote(name),
				Status:             model.QuoteLibraryItemStatusEnabled,
				SourceFingerprint:  fingerprint,
			}
			if err := repository.DB.Create(&item).Error; err != nil {
				return nil, fmt.Errorf("创建报价库项目失败: %w", err)
			}
			result.Imported++
			continue
		}

		updates := map[string]interface{}{
			"name":                name,
			"unit":                unit,
			"category_l1":         categoryL1,
			"category_l2":         categoryL2,
			"pricing_note":        buildPricingNote(name),
			"status":              model.QuoteLibraryItemStatusEnabled,
			"source_fingerprint":  fingerprint,
		}
		if err := repository.DB.Model(&existing).Updates(updates).Error; err != nil {
			return nil, fmt.Errorf("更新报价库项目失败: %w", err)
		}
		result.Updated++
	}

	return result, nil
}

func (s *QuoteService) ListQuoteLibraryItems(page, pageSize int, keyword, categoryL1 string, status *int8) (*QuoteLibraryListResult, error) {
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 20
	}
	db := repository.DB.Model(&model.QuoteLibraryItem{})
	if strings.TrimSpace(keyword) != "" {
		like := "%" + strings.TrimSpace(keyword) + "%"
		db = db.Where("name LIKE ? OR erp_item_code LIKE ?", like, like)
	}
	if strings.TrimSpace(categoryL1) != "" {
		db = db.Where("category_l1 = ?", strings.TrimSpace(categoryL1))
	}
	if status != nil {
		db = db.Where("status = ?", *status)
	}

	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, fmt.Errorf("统计报价库失败: %w", err)
	}

	var list []model.QuoteLibraryItem
	if err := db.Order("category_l1 ASC, id ASC").Offset((page-1)*pageSize).Limit(pageSize).Find(&list).Error; err != nil {
		return nil, fmt.Errorf("查询报价库失败: %w", err)
	}

	return &QuoteLibraryListResult{
		List:     list,
		Total:    total,
		Page:     page,
		PageSize: pageSize,
	}, nil
}

func (s *QuoteService) CreateQuoteList(input *QuoteListCreateInput) (*model.QuoteList, error) {
	title := strings.TrimSpace(input.Title)
	if title == "" {
		return nil, errors.New("清单标题不能为空")
	}
	currency := strings.TrimSpace(input.Currency)
	if currency == "" {
		currency = "CNY"
	}
	quoteList := &model.QuoteList{
		ProjectID:    input.ProjectID,
		CustomerID:   input.CustomerID,
		HouseID:      input.HouseID,
		OwnerUserID:  input.OwnerUserID,
		ScenarioType: strings.TrimSpace(input.ScenarioType),
		Title:        title,
		Status:       model.QuoteListStatusDraft,
		Currency:     currency,
		DeadlineAt:   input.DeadlineAt,
	}
	if err := repository.DB.Create(quoteList).Error; err != nil {
		return nil, fmt.Errorf("创建报价清单失败: %w", err)
	}
	return quoteList, nil
}

func (s *QuoteService) ListQuoteLists(page, pageSize int, status, keyword string) (*QuoteListListResult, error) {
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 20
	}

	db := repository.DB.Model(&model.QuoteList{})
	if strings.TrimSpace(status) != "" {
		db = db.Where("status = ?", strings.TrimSpace(status))
	}
	if strings.TrimSpace(keyword) != "" {
		like := "%" + strings.TrimSpace(keyword) + "%"
		db = db.Where("title LIKE ?", like)
	}

	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, fmt.Errorf("统计报价清单失败: %w", err)
	}

	var quoteLists []model.QuoteList
	if err := db.Order("updated_at DESC").Offset((page-1)*pageSize).Limit(pageSize).Find(&quoteLists).Error; err != nil {
		return nil, fmt.Errorf("查询报价清单失败: %w", err)
	}

	summaries := make([]QuoteListSummary, 0, len(quoteLists))
	for _, quoteList := range quoteLists {
		var itemCount int64
		var invitationCount int64
		var submissionCount int64
		repository.DB.Model(&model.QuoteListItem{}).Where("quote_list_id = ?", quoteList.ID).Count(&itemCount)
		repository.DB.Model(&model.QuoteInvitation{}).Where("quote_list_id = ?", quoteList.ID).Count(&invitationCount)
		repository.DB.Model(&model.QuoteSubmission{}).Where("quote_list_id = ?", quoteList.ID).Count(&submissionCount)
		summaries = append(summaries, QuoteListSummary{
			ID:                quoteList.ID,
			ProjectID:         quoteList.ProjectID,
			CustomerID:        quoteList.CustomerID,
			HouseID:           quoteList.HouseID,
			OwnerUserID:       quoteList.OwnerUserID,
			ScenarioType:      quoteList.ScenarioType,
			Title:             quoteList.Title,
			Status:            quoteList.Status,
			Currency:          quoteList.Currency,
			DeadlineAt:        quoteList.DeadlineAt,
			AwardedProviderID: quoteList.AwardedProviderID,
			ItemCount:         itemCount,
			InvitationCount:   invitationCount,
			SubmissionCount:   submissionCount,
			UpdatedAt:         quoteList.UpdatedAt,
		})
	}

	return &QuoteListListResult{
		List:     summaries,
		Total:    total,
		Page:     page,
		PageSize: pageSize,
	}, nil
}

func (s *QuoteService) GetAdminQuoteListDetail(quoteListID uint64) (*AdminQuoteListDetail, error) {
	var quoteList model.QuoteList
	if err := repository.DB.First(&quoteList, quoteListID).Error; err != nil {
		return nil, errors.New("报价清单不存在")
	}

	var items []model.QuoteListItem
	if err := repository.DB.Where("quote_list_id = ?", quoteListID).Order("sort_order ASC, id ASC").Find(&items).Error; err != nil {
		return nil, fmt.Errorf("查询清单项目失败: %w", err)
	}

	var invitations []model.QuoteInvitation
	if err := repository.DB.Where("quote_list_id = ?", quoteListID).Order("created_at ASC").Find(&invitations).Error; err != nil {
		return nil, fmt.Errorf("查询邀请列表失败: %w", err)
	}

	var submissionCount int64
	if err := repository.DB.Model(&model.QuoteSubmission{}).Where("quote_list_id = ?", quoteListID).Count(&submissionCount).Error; err != nil {
		return nil, fmt.Errorf("统计报价单失败: %w", err)
	}

	return &AdminQuoteListDetail{
		QuoteList:       quoteList,
		Items:           items,
		Invitations:     invitations,
		SubmissionCount: submissionCount,
	}, nil
}

func (s *QuoteService) BatchUpsertQuoteListItems(quoteListID uint64, items []QuoteListItemUpsertInput) ([]model.QuoteListItem, error) {
	quoteList, err := s.getQuoteListForMutation(quoteListID, model.QuoteListStatusDraft)
	if err != nil {
		return nil, err
	}
	_ = quoteList

	tx := repository.DB.Begin()
	for _, input := range items {
		name := strings.TrimSpace(input.Name)
		unit := strings.TrimSpace(input.Unit)
		note := strings.TrimSpace(input.PricingNote)
		categoryL1 := strings.TrimSpace(input.CategoryL1)
		categoryL2 := strings.TrimSpace(input.CategoryL2)

		if input.StandardItemID > 0 {
			var standardItem model.QuoteLibraryItem
			if err := tx.First(&standardItem, input.StandardItemID).Error; err == nil {
				if name == "" {
					name = standardItem.Name
				}
				if unit == "" {
					unit = standardItem.Unit
				}
				if note == "" {
					note = standardItem.PricingNote
				}
				if categoryL1 == "" {
					categoryL1 = standardItem.CategoryL1
				}
				if categoryL2 == "" {
					categoryL2 = standardItem.CategoryL2
				}
			}
		}
		if name == "" {
			tx.Rollback()
			return nil, errors.New("清单项目名称不能为空")
		}
		if unit == "" {
			unit = "项"
		}
		if input.ID > 0 {
			var existing model.QuoteListItem
			if err := tx.Where("quote_list_id = ? AND id = ?", quoteListID, input.ID).First(&existing).Error; err != nil {
				tx.Rollback()
				return nil, errors.New("待更新的清单项目不存在")
			}
			updates := map[string]interface{}{
				"standard_item_id": input.StandardItemID,
				"line_no":          input.LineNo,
				"name":             name,
				"unit":             unit,
				"quantity":         input.Quantity,
				"pricing_note":     note,
				"category_l1":      categoryL1,
				"category_l2":      categoryL2,
				"sort_order":       input.SortOrder,
			}
			if err := tx.Model(&existing).Updates(updates).Error; err != nil {
				tx.Rollback()
				return nil, fmt.Errorf("更新清单项目失败: %w", err)
			}
			continue
		}
		row := model.QuoteListItem{
			QuoteListID:    quoteListID,
			StandardItemID: input.StandardItemID,
			LineNo:         input.LineNo,
			Name:           name,
			Unit:           unit,
			Quantity:       input.Quantity,
			PricingNote:    note,
			CategoryL1:     categoryL1,
			CategoryL2:     categoryL2,
			SortOrder:      input.SortOrder,
		}
		if err := tx.Create(&row).Error; err != nil {
			tx.Rollback()
			return nil, fmt.Errorf("创建清单项目失败: %w", err)
		}
	}
	if err := tx.Commit().Error; err != nil {
		return nil, fmt.Errorf("保存清单项目失败: %w", err)
	}

	var result []model.QuoteListItem
	if err := repository.DB.Where("quote_list_id = ?", quoteListID).Order("sort_order ASC, id ASC").Find(&result).Error; err != nil {
		return nil, fmt.Errorf("查询清单项目失败: %w", err)
	}
	return result, nil
}

func (s *QuoteService) InviteProviders(quoteListID, invitedByUserID uint64, providerIDs []uint64) ([]model.QuoteInvitation, error) {
	if _, err := s.getQuoteListForMutation(quoteListID, model.QuoteListStatusDraft); err != nil {
		return nil, err
	}
	now := time.Now()
	tx := repository.DB.Begin()
	for _, providerID := range providerIDs {
		var provider model.Provider
		if err := tx.First(&provider, providerID).Error; err != nil {
			tx.Rollback()
			return nil, fmt.Errorf("服务商 %d 不存在", providerID)
		}
		var invitation model.QuoteInvitation
		err := tx.Where("quote_list_id = ? AND provider_id = ?", quoteListID, providerID).First(&invitation).Error
		if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			tx.Rollback()
			return nil, fmt.Errorf("查询邀请失败: %w", err)
		}
		if errors.Is(err, gorm.ErrRecordNotFound) {
			invitation = model.QuoteInvitation{
				QuoteListID:     quoteListID,
				ProviderID:      providerID,
				Status:          model.QuoteInvitationStatusInvited,
				InvitedByUserID: invitedByUserID,
				InvitedAt:       &now,
			}
			if err := tx.Create(&invitation).Error; err != nil {
				tx.Rollback()
				return nil, fmt.Errorf("创建邀请失败: %w", err)
			}
			continue
		}
		if err := tx.Model(&invitation).Updates(map[string]interface{}{
			"status":            model.QuoteInvitationStatusInvited,
			"invited_by_user_id": invitedByUserID,
			"invited_at":        &now,
		}).Error; err != nil {
			tx.Rollback()
			return nil, fmt.Errorf("更新邀请失败: %w", err)
		}
	}
	if err := tx.Commit().Error; err != nil {
		return nil, fmt.Errorf("保存邀请失败: %w", err)
	}

	var invitations []model.QuoteInvitation
	if err := repository.DB.Where("quote_list_id = ?", quoteListID).Order("id ASC").Find(&invitations).Error; err != nil {
		return nil, fmt.Errorf("查询邀请列表失败: %w", err)
	}
	return invitations, nil
}

func (s *QuoteService) StartQuoteList(quoteListID uint64) (*model.QuoteList, error) {
	quoteList, err := s.getQuoteListForMutation(quoteListID, model.QuoteListStatusDraft)
	if err != nil {
		return nil, err
	}
	var itemCount int64
	if err := repository.DB.Model(&model.QuoteListItem{}).Where("quote_list_id = ?", quoteListID).Count(&itemCount).Error; err != nil {
		return nil, fmt.Errorf("统计清单项目失败: %w", err)
	}
	if itemCount == 0 {
		return nil, errors.New("清单项目为空，不能发起报价")
	}
	if err := repository.DB.Model(quoteList).Update("status", model.QuoteListStatusQuoting).Error; err != nil {
		return nil, fmt.Errorf("更新报价清单状态失败: %w", err)
	}
	quoteList.Status = model.QuoteListStatusQuoting
	return quoteList, nil
}

func (s *QuoteService) GetQuoteComparison(quoteListID uint64) (*QuoteComparisonResponse, error) {
	var quoteList model.QuoteList
	if err := repository.DB.First(&quoteList, quoteListID).Error; err != nil {
		return nil, errors.New("报价清单不存在")
	}

	var items []model.QuoteListItem
	if err := repository.DB.Where("quote_list_id = ?", quoteListID).Order("sort_order ASC, id ASC").Find(&items).Error; err != nil {
		return nil, fmt.Errorf("查询清单项目失败: %w", err)
	}

	var submissions []model.QuoteSubmission
	if err := repository.DB.Where("quote_list_id = ?", quoteListID).Order("total_cent ASC, id ASC").Find(&submissions).Error; err != nil {
		return nil, fmt.Errorf("查询报价单失败: %w", err)
	}

	submissionIDs := make([]uint64, 0, len(submissions))
	providerIDs := make([]uint64, 0, len(submissions))
	for _, submission := range submissions {
		submissionIDs = append(submissionIDs, submission.ID)
		providerIDs = append(providerIDs, submission.ProviderID)
	}

	var submissionItems []model.QuoteSubmissionItem
	if len(submissionIDs) > 0 {
		if err := repository.DB.Where("quote_submission_id IN ?", submissionIDs).Find(&submissionItems).Error; err != nil {
			return nil, fmt.Errorf("查询报价明细失败: %w", err)
		}
	}

	var providers []model.Provider
	if len(providerIDs) > 0 {
		_ = repository.DB.Where("id IN ?", providerIDs).Find(&providers).Error
	}
	providerNames := make(map[uint64]string, len(providers))
	for _, provider := range providers {
		name := strings.TrimSpace(provider.CompanyName)
		if name == "" {
			name = fmt.Sprintf("服务商#%d", provider.ID)
		}
		providerNames[provider.ID] = name
	}

	itemsBySubmission := make(map[uint64]map[uint64]model.QuoteSubmissionItem)
	priceSamples := make(map[uint64][]int64)
	for _, item := range submissionItems {
		if _, ok := itemsBySubmission[item.QuoteSubmissionID]; !ok {
			itemsBySubmission[item.QuoteSubmissionID] = map[uint64]model.QuoteSubmissionItem{}
		}
		itemsBySubmission[item.QuoteSubmissionID][item.QuoteListItemID] = item
		if item.UnitPriceCent > 0 {
			priceSamples[item.QuoteListItemID] = append(priceSamples[item.QuoteListItemID], item.UnitPriceCent)
		}
	}

	referenceByItem := make(map[uint64]int64, len(items))
	categoryByItem := make(map[uint64]string, len(items))
	itemNameByItem := make(map[uint64]string, len(items))
	for _, item := range items {
		categoryByItem[item.ID] = item.CategoryL1
		itemNameByItem[item.ID] = item.Name
		if item.StandardItemID > 0 {
			var standard model.QuoteLibraryItem
			if err := repository.DB.Select("reference_price_cent").First(&standard, item.StandardItemID).Error; err == nil {
				referenceByItem[item.ID] = standard.ReferencePriceCent
			}
		}
	}

	resp := &QuoteComparisonResponse{
		QuoteList: quoteList,
		Items:     items,
	}
	for _, submission := range submissions {
		itemMap := itemsBySubmission[submission.ID]
		missing := make([]uint64, 0)
		abnormal := make([]uint64, 0)
		categoryTotalsMap := make(map[string]int64)
		for _, item := range items {
			subItem, exists := itemMap[item.ID]
			if !exists || subItem.UnitPriceCent <= 0 {
				missing = append(missing, item.ID)
				continue
			}
			category := strings.TrimSpace(categoryByItem[item.ID])
			if category == "" {
				category = "未分类"
			}
			categoryTotalsMap[category] += subItem.AmountCent
			if isAbnormalQuoteItem(subItem.UnitPriceCent, referenceByItem[item.ID], priceSamples[item.ID]) {
				abnormal = append(abnormal, item.ID)
			}
		}
		categoryTotals := make([]QuoteCategoryTotal, 0, len(categoryTotalsMap))
		for category, total := range categoryTotalsMap {
			categoryTotals = append(categoryTotals, QuoteCategoryTotal{Category: category, TotalCent: total})
		}
		sort.Slice(categoryTotals, func(i, j int) bool { return categoryTotals[i].Category < categoryTotals[j].Category })
		resp.Submissions = append(resp.Submissions, QuoteComparisonSubmission{
			SubmissionID:    submission.ID,
			ProviderID:      submission.ProviderID,
			ProviderName:    providerNames[submission.ProviderID],
			ProviderType:    submission.ProviderType,
			ProviderSubType: submission.ProviderSubType,
			Status:          submission.Status,
			TotalCent:       submission.TotalCent,
			MissingItemIDs:  missing,
			AbnormalItemIDs: abnormal,
			CategoryTotals:  categoryTotals,
		})
	}
	return resp, nil
}

func (s *QuoteService) AwardQuote(quoteListID, submissionID uint64) (*model.QuoteList, error) {
	quoteList, err := s.getQuoteListForMutation(quoteListID, model.QuoteListStatusQuoting, model.QuoteListStatusLocked)
	if err != nil {
		return nil, err
	}
	var submission model.QuoteSubmission
	if err := repository.DB.Where("quote_list_id = ? AND id = ?", quoteListID, submissionID).First(&submission).Error; err != nil {
		return nil, errors.New("报价单不存在")
	}
	if submission.Status != model.QuoteSubmissionStatusSubmitted {
		return nil, errors.New("只能定标已提交报价")
	}
	updates := map[string]interface{}{
		"status":                     model.QuoteListStatusAwarded,
		"awarded_provider_id":        submission.ProviderID,
		"awarded_quote_submission_id": submission.ID,
	}
	if err := repository.DB.Model(quoteList).Updates(updates).Error; err != nil {
		return nil, fmt.Errorf("定标失败: %w", err)
	}
	quoteList.Status = model.QuoteListStatusAwarded
	quoteList.AwardedProviderID = submission.ProviderID
	quoteList.AwardedQuoteSubmissionID = submission.ID
	return quoteList, nil
}

func (s *QuoteService) ListMerchantQuoteLists(providerID uint64) ([]QuoteMerchantListItem, error) {
	var invitations []model.QuoteInvitation
	if err := repository.DB.Where("provider_id = ?", providerID).Order("created_at DESC").Find(&invitations).Error; err != nil {
		return nil, fmt.Errorf("查询报价清单邀请失败: %w", err)
	}
	if len(invitations) == 0 {
		return []QuoteMerchantListItem{}, nil
	}
	listIDs := make([]uint64, 0, len(invitations))
	for _, invitation := range invitations {
		listIDs = append(listIDs, invitation.QuoteListID)
	}
	var quoteLists []model.QuoteList
	if err := repository.DB.Where("id IN ?", listIDs).Order("updated_at DESC").Find(&quoteLists).Error; err != nil {
		return nil, fmt.Errorf("查询报价清单失败: %w", err)
	}
	var submissions []model.QuoteSubmission
	if err := repository.DB.Where("provider_id = ? AND quote_list_id IN ?", providerID, listIDs).Find(&submissions).Error; err != nil {
		return nil, fmt.Errorf("查询我的报价失败: %w", err)
	}
	submissionByList := make(map[uint64]model.QuoteSubmission, len(submissions))
	for _, submission := range submissions {
		submissionByList[submission.QuoteListID] = submission
	}
	results := make([]QuoteMerchantListItem, 0, len(quoteLists))
	for _, quoteList := range quoteLists {
		row := QuoteMerchantListItem{
			ID:        quoteList.ID,
			Title:     quoteList.Title,
			Status:    quoteList.Status,
			Currency:  quoteList.Currency,
			UpdatedAt: quoteList.UpdatedAt.Format(time.RFC3339),
		}
		if quoteList.DeadlineAt != nil {
			row.DeadlineAt = quoteList.DeadlineAt.Format(time.RFC3339)
		}
		if submission, ok := submissionByList[quoteList.ID]; ok {
			row.MySubmissionStatus = submission.Status
			row.MyTotalCent = submission.TotalCent
		}
		results = append(results, row)
	}
	sort.Slice(results, func(i, j int) bool { return results[i].ID > results[j].ID })
	return results, nil
}

func (s *QuoteService) GetMerchantQuoteListDetail(quoteListID, providerID uint64) (*MerchantQuoteListDetail, error) {
	quoteList, invitation, err := s.ensureInvitedQuoteList(quoteListID, providerID)
	if err != nil {
		return nil, err
	}
	var items []model.QuoteListItem
	if err := repository.DB.Where("quote_list_id = ?", quoteListID).Order("sort_order ASC, id ASC").Find(&items).Error; err != nil {
		return nil, fmt.Errorf("查询清单项目失败: %w", err)
	}
	var submission model.QuoteSubmission
	err = repository.DB.Where("quote_list_id = ? AND provider_id = ?", quoteListID, providerID).First(&submission).Error
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, fmt.Errorf("查询报价单失败: %w", err)
	}
	resp := &MerchantQuoteListDetail{
		QuoteList:  *quoteList,
		Items:      items,
		Invitation: *invitation,
	}
	if err == nil {
		var submissionItems []model.QuoteSubmissionItem
		if err := repository.DB.Where("quote_submission_id = ?", submission.ID).Order("quote_list_item_id ASC").Find(&submissionItems).Error; err != nil {
			return nil, fmt.Errorf("查询报价明细失败: %w", err)
		}
		resp.Submission = &MerchantSubmission{
			Status:        submission.Status,
			TotalCent:     submission.TotalCent,
			Currency:      submission.Currency,
			Items:         submissionItems,
			EstimatedDays: submission.EstimatedDays,
			Remark:        submission.Remark,
		}
	}
	return resp, nil
}

func (s *QuoteService) SaveMerchantSubmission(quoteListID, providerID uint64, input *QuoteSubmissionSaveInput, submit bool) (*model.QuoteSubmission, error) {
	quoteList, invitation, err := s.ensureInvitedQuoteList(quoteListID, providerID)
	if err != nil {
		return nil, err
	}
	if quoteList.Status != model.QuoteListStatusQuoting {
		return nil, errors.New("当前清单状态不可报价")
	}

	var provider model.Provider
	if err := repository.DB.First(&provider, providerID).Error; err != nil {
		return nil, errors.New("服务商不存在")
	}

	var listItems []model.QuoteListItem
	if err := repository.DB.Where("quote_list_id = ?", quoteListID).Find(&listItems).Error; err != nil {
		return nil, fmt.Errorf("查询清单项目失败: %w", err)
	}
	itemByID := make(map[uint64]model.QuoteListItem, len(listItems))
	for _, item := range listItems {
		itemByID[item.ID] = item
	}

	tx := repository.DB.Begin()
	var submission model.QuoteSubmission
	err = tx.Where("quote_list_id = ? AND provider_id = ?", quoteListID, providerID).First(&submission).Error
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		tx.Rollback()
		return nil, fmt.Errorf("查询报价单失败: %w", err)
	}
	if errors.Is(err, gorm.ErrRecordNotFound) {
		submission = model.QuoteSubmission{
			QuoteListID:            quoteListID,
			ProviderID:             providerID,
			ProviderType:           provider.ProviderType,
			ProviderSubType:        strings.TrimSpace(provider.SubType),
			Status:                 model.QuoteSubmissionStatusDraft,
			Currency:               quoteList.Currency,
			EstimatedDays:          input.EstimatedDays,
			Remark:                 strings.TrimSpace(input.Remark),
			TeamSize:               input.TeamSize,
			WorkTypes:              strings.Join(normalizeStringSlice(input.WorkTypes), ","),
			ConstructionMethodNote: strings.TrimSpace(input.ConstructionMethodNote),
			SiteVisitRequired:      input.SiteVisitRequired,
		}
		if submission.ProviderSubType == "" {
			submission.ProviderSubType = "designer"
		}
		if err := tx.Create(&submission).Error; err != nil {
			tx.Rollback()
			return nil, fmt.Errorf("创建报价单失败: %w", err)
		}
	} else {
		updates := map[string]interface{}{
			"estimated_days":           input.EstimatedDays,
			"remark":                   strings.TrimSpace(input.Remark),
			"team_size":                input.TeamSize,
			"work_types":               strings.Join(normalizeStringSlice(input.WorkTypes), ","),
			"construction_method_note": strings.TrimSpace(input.ConstructionMethodNote),
			"site_visit_required":      input.SiteVisitRequired,
		}
		if err := tx.Model(&submission).Updates(updates).Error; err != nil {
			tx.Rollback()
			return nil, fmt.Errorf("更新报价单失败: %w", err)
		}
	}

	if err := tx.Where("quote_submission_id = ?", submission.ID).Delete(&model.QuoteSubmissionItem{}).Error; err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("重置报价明细失败: %w", err)
	}

	var totalCent int64
	for _, itemInput := range input.Items {
		listItem, ok := itemByID[itemInput.QuoteListItemID]
		if !ok {
			tx.Rollback()
			return nil, fmt.Errorf("清单项目 %d 不存在", itemInput.QuoteListItemID)
		}
		unitPriceCent := itemInput.UnitPriceCent
		if unitPriceCent < 0 {
			tx.Rollback()
			return nil, errors.New("报价单价不能为负数")
		}
		amountCent := quoteAmountCent(listItem.Quantity, unitPriceCent)
		submissionItem := model.QuoteSubmissionItem{
			QuoteSubmissionID: submission.ID,
			QuoteListItemID:   listItem.ID,
			UnitPriceCent:     unitPriceCent,
			AmountCent:        amountCent,
			Remark:            strings.TrimSpace(itemInput.Remark),
		}
		if err := tx.Create(&submissionItem).Error; err != nil {
			tx.Rollback()
			return nil, fmt.Errorf("保存报价明细失败: %w", err)
		}
		totalCent += amountCent
	}

	submissionStatus := model.QuoteSubmissionStatusDraft
	invitationStatus := invitation.Status
	if submit {
		submissionStatus = model.QuoteSubmissionStatusSubmitted
		invitationStatus = model.QuoteInvitationStatusQuoted
	}
	if err := tx.Model(&submission).Updates(map[string]interface{}{
		"status":     submissionStatus,
		"total_cent": totalCent,
	}).Error; err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("更新报价单汇总失败: %w", err)
	}
	if err := tx.Model(invitation).Updates(map[string]interface{}{
		"status":       invitationStatus,
		"responded_at": time.Now(),
	}).Error; err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("更新邀请状态失败: %w", err)
	}
	if err := tx.Commit().Error; err != nil {
		return nil, fmt.Errorf("保存报价失败: %w", err)
	}
	submission.TotalCent = totalCent
	submission.Status = submissionStatus
	return &submission, nil
}

func (s *QuoteService) getQuoteListForMutation(quoteListID uint64, allowedStatuses ...string) (*model.QuoteList, error) {
	var quoteList model.QuoteList
	if err := repository.DB.First(&quoteList, quoteListID).Error; err != nil {
		return nil, errors.New("报价清单不存在")
	}
	if len(allowedStatuses) == 0 {
		return &quoteList, nil
	}
	for _, status := range allowedStatuses {
		if quoteList.Status == status {
			return &quoteList, nil
		}
	}
	return nil, fmt.Errorf("当前清单状态不允许此操作: %s", quoteList.Status)
}

func (s *QuoteService) ensureInvitedQuoteList(quoteListID, providerID uint64) (*model.QuoteList, *model.QuoteInvitation, error) {
	var invitation model.QuoteInvitation
	if err := repository.DB.Where("quote_list_id = ? AND provider_id = ?", quoteListID, providerID).First(&invitation).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil, errors.New("未被邀请参与该报价清单")
		}
		return nil, nil, fmt.Errorf("查询报价邀请失败: %w", err)
	}
	var quoteList model.QuoteList
	if err := repository.DB.First(&quoteList, quoteListID).Error; err != nil {
		return nil, nil, errors.New("报价清单不存在")
	}
	return &quoteList, &invitation, nil
}

func resolveERPQuotePath(rawPath string) (string, error) {
	candidates := make([]string, 0, 4)
	if strings.TrimSpace(rawPath) != "" {
		candidates = append(candidates, rawPath)
	}
	candidates = append(candidates,
		"erp报价.xls",
		filepath.Join("..", "erp报价.xls"),
		filepath.Join("..", "..", "erp报价.xls"),
	)
	for _, candidate := range candidates {
		if candidate == "" {
			continue
		}
		if _, err := os.Stat(candidate); err == nil {
			abs, absErr := filepath.Abs(candidate)
			if absErr == nil {
				return abs, nil
			}
			return candidate, nil
		}
	}
	return "", errors.New("未找到 ERP 报价文件")
}

func extractERPQuoteItemNames(content []byte) []string {
	fragments := extractUTF16Fragments(content)
	seen := make(map[string]struct{})
	names := make([]string, 0, len(fragments))
	for _, fragment := range fragments {
		name := normalizeERPName(fragment)
		if !isERPProjectName(name) {
			continue
		}
		if _, ok := seen[name]; ok {
			continue
		}
		seen[name] = struct{}{}
		names = append(names, name)
	}
	sort.Strings(names)
	return names
}

func extractUTF16Fragments(content []byte) []string {
	results := make([]string, 0, 512)
	seen := make(map[string]struct{})
	for offset := 0; offset < 2; offset++ {
		current := make([]uint16, 0, 64)
		flush := func() {
			if len(current) < 2 {
				current = current[:0]
				return
			}
			text := strings.TrimSpace(string(utf16.Decode(current)))
			current = current[:0]
			if text == "" {
				return
			}
			if _, ok := seen[text]; ok {
				return
			}
			seen[text] = struct{}{}
			results = append(results, text)
		}
		for i := offset; i+1 < len(content); i += 2 {
			value := uint16(content[i]) | uint16(content[i+1])<<8
			r := rune(value)
			if isAllowedERPChar(r) {
				current = append(current, value)
				continue
			}
			flush()
		}
		flush()
	}
	return results
}

func isAllowedERPChar(r rune) bool {
	if r == 0 {
		return false
	}
	if r == '\n' || r == '\r' || r == '\t' {
		return false
	}
	if unicode.Is(unicode.Han, r) || unicode.IsDigit(r) || unicode.IsLetter(r) {
		return true
	}
	switch r {
	case '-', '_', '(', ')', '（', '）', '、', '，', ',', '。', '.', '≤', '≥', '<', '>', '=', '+', '/', '㎡', 'm', 'M', '樘', '套', '项', '件', '块', ' ': 
		return true
	default:
		return false
	}
}

func normalizeERPName(text string) string {
	replacer := strings.NewReplacer("\u0000", "", "\ufeff", "", "\ufffd", "", "Ā", "", "Ȁ", "", "ఁ", "", "㐁", "", "度", "", "渁", "", "⥏", "", "撔", "")
	text = replacer.Replace(text)
	text = strings.TrimSpace(text)
	text = strings.Join(strings.Fields(text), " ")
	return text
}

func isERPProjectName(name string) bool {
	if name == "" {
		return false
	}
	skip := []string{
		"项目名称", "序号", "单位", "合计", "参考价", "水路", "电路", "输入", "输出", "计算", "标题", "标题 1", "标题 2", "标题 3", "标题 4", "警告文本", "注释", "检查单元格", "链接单元格", "汇总",
	}
	for _, token := range skip {
		if name == token {
			return false
		}
	}
	if len([]rune(name)) < 4 {
		return false
	}
	if !containsHan(name) {
		return false
	}
	keywords := []string{
		"拆除", "砖墙", "石膏板", "浴缸", "五金", "垃圾清扫", "墙漆", "防水", "找平", "贴墙砖", "大理石", "吊顶", "铺地砖", "踢脚", "地台", "灯具", "拉毛", "素灰", "放样", "墙面", "地面",
	}
	for _, keyword := range keywords {
		if strings.Contains(name, keyword) {
			return true
		}
	}
	return false
}

func containsHan(s string) bool {
	for _, r := range s {
		if unicode.Is(unicode.Han, r) {
			return true
		}
	}
	return false
}

func buildERPItemCode(name string) string {
	sum := sha1.Sum([]byte(name))
	return "ERP-" + strings.ToUpper(hex.EncodeToString(sum[:6]))
}

func hashString(value string) string {
	sum := sha1.Sum([]byte(value))
	return hex.EncodeToString(sum[:])
}

func guessQuoteUnit(name string) string {
	switch {
	case strings.Contains(name, "腰线"), strings.Contains(name, "踢脚"), strings.Contains(name, "阳角条"):
		return "m"
	case strings.Contains(name, "墙"), strings.Contains(name, "砖"), strings.Contains(name, "漆"), strings.Contains(name, "吊顶"), strings.Contains(name, "防水"), strings.Contains(name, "找平"):
		return "㎡"
	case strings.Contains(name, "五金"), strings.Contains(name, "灯具"):
		return "件"
	case strings.Contains(name, "浴缸"), strings.Contains(name, "垃圾清扫"), strings.Contains(name, "门洞"), strings.Contains(name, "地台"), strings.Contains(name, "放样"):
		return "项"
	default:
		return "项"
	}
}

func classifyQuoteCategory(name string) (string, string) {
	switch {
	case strings.Contains(name, "拆除"):
		return "拆除", "拆旧"
	case strings.Contains(name, "墙砖"), strings.Contains(name, "地砖"), strings.Contains(name, "大理石"), strings.Contains(name, "过门石"), strings.Contains(name, "地台"), strings.Contains(name, "砌"):
		return "泥瓦", "铺贴"
	case strings.Contains(name, "墙漆"), strings.Contains(name, "底漆"), strings.Contains(name, "刷漆"), strings.Contains(name, "腻子"), strings.Contains(name, "拉毛"):
		return "油工", "墙顶面"
	case strings.Contains(name, "吊顶"), strings.Contains(name, "石膏线"), strings.Contains(name, "窗帘盒"):
		return "吊顶", "顶面"
	case strings.Contains(name, "防水"):
		return "防水", "防水"
	case strings.Contains(name, "灯具"), strings.Contains(name, "五金"), strings.Contains(name, "浴缸"):
		return "安装", "安装"
	case strings.Contains(name, "水路"):
		return "水路", "给排水"
	case strings.Contains(name, "电路"):
		return "电路", "强弱电"
	default:
		return "基础施工", "其他"
	}
}

func buildPricingNote(name string) string {
	parts := make([]string, 0, 2)
	if strings.Contains(name, "工费") || strings.Contains(name, "辅料") {
		parts = append(parts, "含工费/辅料")
	}
	if strings.Contains(name, "≤") || strings.Contains(name, "≥") || strings.Contains(name, "<") || strings.Contains(name, ">") {
		parts = append(parts, "含规格条件")
	}
	return strings.Join(parts, "；")
}

func quoteAmountCent(quantity float64, unitPriceCent int64) int64 {
	if quantity <= 0 || unitPriceCent <= 0 {
		return 0
	}
	return int64(math.Round(quantity * float64(unitPriceCent)))
}

func isAbnormalQuoteItem(unitPriceCent, referencePriceCent int64, samples []int64) bool {
	if unitPriceCent <= 0 {
		return false
	}
	if referencePriceCent > 0 {
		diffRatio := math.Abs(float64(unitPriceCent-referencePriceCent)) / float64(referencePriceCent)
		if diffRatio >= 0.5 {
			return true
		}
	}
	if len(samples) < 2 {
		return false
	}
	var sum int64
	for _, sample := range samples {
		sum += sample
	}
	avg := float64(sum) / float64(len(samples))
	if avg <= 0 {
		return false
	}
	diffRatio := math.Abs(float64(unitPriceCent)-avg) / avg
	return diffRatio >= 0.5
}

func normalizeStringSlice(values []string) []string {
	seen := make(map[string]struct{}, len(values))
	result := make([]string, 0, len(values))
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed == "" {
			continue
		}
		if _, ok := seen[trimmed]; ok {
			continue
		}
		seen[trimmed] = struct{}{}
		result = append(result, trimmed)
	}
	return result
}
