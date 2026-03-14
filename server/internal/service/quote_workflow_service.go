package service

import (
	"encoding/json"
	"errors"
	"fmt"
	"html/template"
	"math"
	"sort"
	"strings"
	"time"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"

	"gorm.io/gorm"
)

type QuoteCategoryCreateInput struct {
	Code      string `json:"code"`
	Name      string `json:"name"`
	ParentID  uint64 `json:"parentId"`
	SortOrder int    `json:"sortOrder"`
	Status    int8   `json:"status"`
}

type QuoteLibraryItemWriteInput struct {
	CategoryID         uint64   `json:"categoryId"`
	StandardCode       string   `json:"standardCode"`
	ERPItemCode        string   `json:"erpItemCode"`
	Name               string   `json:"name"`
	Unit               string   `json:"unit"`
	ReferencePriceCent int64    `json:"referencePriceCent"`
	PricingNote        string   `json:"pricingNote"`
	Status             int8     `json:"status"`
	Keywords           []string `json:"keywords"`
	ERPMapping         any      `json:"erpMapping"`
	SourceMeta         any      `json:"sourceMeta"`
}

type QuotePriceBookItemInput struct {
	StandardItemID uint64 `json:"standardItemId"`
	Unit           string `json:"unit"`
	UnitPriceCent  int64  `json:"unitPriceCent"`
	MinChargeCent  int64  `json:"minChargeCent"`
	Remark         string `json:"remark"`
	Status         int8   `json:"status"`
}

type QuotePriceBookUpdateInput struct {
	Remark string                    `json:"remark"`
	Items  []QuotePriceBookItemInput `json:"items"`
}

type QuotePriceBookDetail struct {
	Book  model.QuotePriceBook       `json:"book"`
	Items []model.QuotePriceBookItem `json:"items"`
}

type QuoteTaskPrerequisiteSnapshot struct {
	Area           float64  `json:"area"`
	Layout         string   `json:"layout"`
	RenovationType string   `json:"renovationType"`
	ConstructionScope string `json:"constructionScope"`
	ServiceAreas   []string `json:"serviceAreas"`
	WorkTypes      []string `json:"workTypes"`
	HouseUsage     string   `json:"houseUsage"`
	Notes          string   `json:"notes"`
}

type QuoteTaskPrerequisiteUpdateInput struct {
	Area             float64  `json:"area"`
	Layout           string   `json:"layout"`
	RenovationType   string   `json:"renovationType"`
	ConstructionScope string  `json:"constructionScope"`
	ServiceAreas     []string `json:"serviceAreas"`
	WorkTypes        []string `json:"workTypes"`
	HouseUsage       string   `json:"houseUsage"`
	Notes            string   `json:"notes"`
}

type QuoteTaskValidationResult struct {
	OK            bool     `json:"ok"`
	Status        string   `json:"status"`
	MissingFields []string `json:"missingFields"`
}

type RecommendedForeman struct {
	ProviderID         uint64   `json:"providerId"`
	ProviderName       string   `json:"providerName"`
	ProviderType       int8     `json:"providerType"`
	ProviderSubType    string   `json:"providerSubType"`
	RegionMatched      bool     `json:"regionMatched"`
	WorkTypeMatched    bool     `json:"workTypeMatched"`
	AcceptBooking      bool     `json:"acceptBooking"`
	PriceCoverageRate  float64  `json:"priceCoverageRate"`
	MatchedItemCount   int      `json:"matchedItemCount"`
	MissingItemCount   int      `json:"missingItemCount"`
	Reasons            []string `json:"reasons"`
}

type QuoteTaskUserView struct {
	QuoteList   model.QuoteList           `json:"quoteList"`
	Submission  model.QuoteSubmission     `json:"submission"`
	Items       []model.QuoteSubmissionItem `json:"items"`
	TaskSummary QuoteTaskPrerequisiteSnapshot `json:"taskSummary"`
}

type UserQuoteTaskSummary struct {
	ID                     uint64 `json:"id"`
	Title                  string `json:"title"`
	Status                 string `json:"status"`
	UserConfirmationStatus string `json:"userConfirmationStatus"`
	DeadlineAt             string `json:"deadlineAt,omitempty"`
	ActiveSubmissionID     uint64 `json:"activeSubmissionId"`
}

func (s *QuoteService) ListQuoteCategories() ([]model.QuoteCategory, error) {
	var categories []model.QuoteCategory
	if err := repository.DB.Order("sort_order ASC, id ASC").Find(&categories).Error; err != nil {
		return nil, fmt.Errorf("查询报价类目失败: %w", err)
	}
	return categories, nil
}

func (s *QuoteService) CreateQuoteCategory(input *QuoteCategoryCreateInput) (*model.QuoteCategory, error) {
	name := strings.TrimSpace(input.Name)
	if name == "" {
		return nil, errors.New("类目名称不能为空")
	}
	code := strings.TrimSpace(input.Code)
	if code == "" {
		code = strings.ToUpper(strings.ReplaceAll(name, " ", "_"))
	}
	status := input.Status
	if status == 0 {
		status = model.QuoteLibraryItemStatusEnabled
	}
	category := &model.QuoteCategory{
		Code:      code,
		Name:      name,
		ParentID:  input.ParentID,
		SortOrder: input.SortOrder,
		Status:    status,
	}
	if err := repository.DB.Create(category).Error; err != nil {
		return nil, fmt.Errorf("创建报价类目失败: %w", err)
	}
	return category, nil
}

func (s *QuoteService) CreateQuoteLibraryItem(input *QuoteLibraryItemWriteInput) (*model.QuoteLibraryItem, error) {
	item := &model.QuoteLibraryItem{}
	if err := applyQuoteLibraryItemInput(item, input); err != nil {
		return nil, err
	}
	if err := repository.DB.Create(item).Error; err != nil {
		return nil, fmt.Errorf("创建标准项失败: %w", err)
	}
	return item, nil
}

func (s *QuoteService) UpdateQuoteLibraryItem(itemID uint64, input *QuoteLibraryItemWriteInput) (*model.QuoteLibraryItem, error) {
	var item model.QuoteLibraryItem
	if err := repository.DB.First(&item, itemID).Error; err != nil {
		return nil, errors.New("标准项不存在")
	}
	if err := applyQuoteLibraryItemInput(&item, input); err != nil {
		return nil, err
	}
	if err := repository.DB.Save(&item).Error; err != nil {
		return nil, fmt.Errorf("更新标准项失败: %w", err)
	}
	return &item, nil
}

func applyQuoteLibraryItemInput(item *model.QuoteLibraryItem, input *QuoteLibraryItemWriteInput) error {
	name := strings.TrimSpace(input.Name)
	if name == "" {
		return errors.New("标准项名称不能为空")
	}
	item.CategoryID = input.CategoryID
	item.StandardCode = strings.TrimSpace(input.StandardCode)
	item.ERPItemCode = strings.TrimSpace(input.ERPItemCode)
	item.Name = name
	item.Unit = strings.TrimSpace(input.Unit)
	if item.Unit == "" {
		item.Unit = "项"
	}
	item.ReferencePriceCent = input.ReferencePriceCent
	item.PricingNote = strings.TrimSpace(input.PricingNote)
	if input.Status == 0 {
		item.Status = model.QuoteLibraryItemStatusEnabled
	} else {
		item.Status = input.Status
	}
	keywords, _ := json.Marshal(normalizeStringSlice(input.Keywords))
	erpMapping, _ := json.Marshal(input.ERPMapping)
	sourceMeta, _ := json.Marshal(input.SourceMeta)
	item.KeywordsJSON = string(keywords)
	item.ERPMappingJSON = string(erpMapping)
	item.SourceMetaJSON = string(sourceMeta)
	if item.SourceFingerprint == "" {
		item.SourceFingerprint = hashString(strings.Join([]string{item.StandardCode, item.ERPItemCode, item.Name, item.Unit}, "|"))
	}
	return nil
}

func (s *QuoteService) GetProviderPriceBook(providerID uint64) (*QuotePriceBookDetail, error) {
	book, err := s.getCurrentPriceBook(providerID)
	if err != nil {
		return nil, err
	}
	var items []model.QuotePriceBookItem
	if err := repository.DB.Where("price_book_id = ?", book.ID).Order("id ASC").Find(&items).Error; err != nil {
		return nil, fmt.Errorf("查询价格簿明细失败: %w", err)
	}
	return &QuotePriceBookDetail{Book: *book, Items: items}, nil
}

func (s *QuoteService) UpsertProviderPriceBook(providerID uint64, input *QuotePriceBookUpdateInput) (*QuotePriceBookDetail, error) {
	book, err := s.ensureDraftPriceBook(providerID)
	if err != nil {
		return nil, err
	}

	tx := repository.DB.Begin()
	if err := tx.Where("price_book_id = ?", book.ID).Delete(&model.QuotePriceBookItem{}).Error; err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("清空价格簿明细失败: %w", err)
	}

	for _, item := range input.Items {
		if item.StandardItemID == 0 {
			tx.Rollback()
			return nil, errors.New("价格项缺少标准项")
		}
		row := model.QuotePriceBookItem{
			PriceBookID:    book.ID,
			StandardItemID: item.StandardItemID,
			Unit:           strings.TrimSpace(item.Unit),
			UnitPriceCent:  item.UnitPriceCent,
			MinChargeCent:  item.MinChargeCent,
			Remark:         strings.TrimSpace(item.Remark),
			Status:         item.Status,
		}
		if row.Unit == "" {
			row.Unit = "项"
		}
		if row.Status == 0 {
			row.Status = model.QuoteLibraryItemStatusEnabled
		}
		if err := tx.Create(&row).Error; err != nil {
			tx.Rollback()
			return nil, fmt.Errorf("保存价格簿项失败: %w", err)
		}
	}

	if err := tx.Model(book).Updates(map[string]interface{}{
		"remark": input.Remark,
	}).Error; err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("更新价格簿失败: %w", err)
	}

	if err := tx.Commit().Error; err != nil {
		return nil, fmt.Errorf("保存价格簿失败: %w", err)
	}
	return s.GetProviderPriceBook(providerID)
}

func (s *QuoteService) PublishProviderPriceBook(providerID uint64) (*QuotePriceBookDetail, error) {
	book, err := s.ensureDraftPriceBook(providerID)
	if err != nil {
		return nil, err
	}
	now := time.Now()

	tx := repository.DB.Begin()
	if err := tx.Model(&model.QuotePriceBook{}).Where("provider_id = ? AND status = ?", providerID, model.QuotePriceBookStatusActive).Updates(map[string]interface{}{
		"status":       model.QuotePriceBookStatusArchived,
		"effective_to": &now,
	}).Error; err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("归档旧价格簿失败: %w", err)
	}
	var maxVersion int
	tx.Model(&model.QuotePriceBook{}).Where("provider_id = ?", providerID).Select("COALESCE(MAX(version),0)").Scan(&maxVersion)
	if err := tx.Model(book).Updates(map[string]interface{}{
		"status":         model.QuotePriceBookStatusActive,
		"version":        maxVersion + 1,
		"effective_from": &now,
		"effective_to":   nil,
	}).Error; err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("发布价格簿失败: %w", err)
	}
	if err := tx.Commit().Error; err != nil {
		return nil, fmt.Errorf("发布价格簿失败: %w", err)
	}
	return s.GetProviderPriceBook(providerID)
}

func (s *QuoteService) ensureDraftPriceBook(providerID uint64) (*model.QuotePriceBook, error) {
	var draft model.QuotePriceBook
	err := repository.DB.Where("provider_id = ? AND status = ?", providerID, model.QuotePriceBookStatusDraft).Order("id DESC").First(&draft).Error
	if err == nil {
		return &draft, nil
	}
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, fmt.Errorf("查询草稿价格簿失败: %w", err)
	}

	book := &model.QuotePriceBook{
		ProviderID: providerID,
		Status:     model.QuotePriceBookStatusDraft,
		Version:    0,
	}
	if err := repository.DB.Create(book).Error; err != nil {
		return nil, fmt.Errorf("创建草稿价格簿失败: %w", err)
	}
	return book, nil
}

func (s *QuoteService) getCurrentPriceBook(providerID uint64) (*model.QuotePriceBook, error) {
	return s.getCurrentPriceBookWithDB(repository.DB, providerID)
}

func (s *QuoteService) getCurrentPriceBookWithDB(db *gorm.DB, providerID uint64) (*model.QuotePriceBook, error) {
	var book model.QuotePriceBook
	if err := db.Where("provider_id = ? AND status = ?", providerID, model.QuotePriceBookStatusActive).Order("version DESC, id DESC").First(&book).Error; err == nil {
		return &book, nil
	}
	if err := db.Where("provider_id = ? AND status = ?", providerID, model.QuotePriceBookStatusDraft).Order("id DESC").First(&book).Error; err == nil {
		return &book, nil
	}
	return nil, errors.New("工长价格库不存在")
}

func (s *QuoteService) UpdateTaskPrerequisites(quoteListID uint64, input *QuoteTaskPrerequisiteUpdateInput) (*model.QuoteList, error) {
	quoteList, err := s.getQuoteListForMutation(quoteListID, model.QuoteListStatusDraft, model.QuoteListStatusReadyForSelection, model.QuoteListStatusRejected)
	if err != nil {
		return nil, err
	}

	snapshot := QuoteTaskPrerequisiteSnapshot{
		Area:              input.Area,
		Layout:            strings.TrimSpace(input.Layout),
		RenovationType:    strings.TrimSpace(input.RenovationType),
		ConstructionScope: strings.TrimSpace(input.ConstructionScope),
		ServiceAreas:      normalizeStringSlice(input.ServiceAreas),
		WorkTypes:         normalizeStringSlice(input.WorkTypes),
		HouseUsage:        strings.TrimSpace(input.HouseUsage),
		Notes:             strings.TrimSpace(input.Notes),
	}
	raw, _ := json.Marshal(snapshot)
	result := validateQuoteTaskPrerequisites(snapshot)
	nextStatus := model.QuoteListStatusDraft
	if result.OK {
		nextStatus = model.QuoteListStatusReadyForSelection
	}
	if err := repository.DB.Model(quoteList).Updates(map[string]interface{}{
		"prerequisite_snapshot_json": string(raw),
		"prerequisite_status":        result.Status,
		"status":                     nextStatus,
	}).Error; err != nil {
		return nil, fmt.Errorf("更新报价前置数据失败: %w", err)
	}
	quoteList.PrerequisiteSnapshotJSON = string(raw)
	quoteList.PrerequisiteStatus = result.Status
	quoteList.Status = nextStatus
	return quoteList, nil
}

func (s *QuoteService) ValidateTaskPrerequisites(quoteListID uint64) (*QuoteTaskValidationResult, error) {
	var quoteList model.QuoteList
	if err := repository.DB.First(&quoteList, quoteListID).Error; err != nil {
		return nil, errors.New("报价任务不存在")
	}
	snapshot, err := s.getPrerequisiteSnapshot(&quoteList)
	if err != nil {
		return nil, err
	}
	result := validateQuoteTaskPrerequisites(snapshot)
	nextStatus := quoteList.Status
	if result.OK {
		nextStatus = model.QuoteListStatusReadyForSelection
	} else if quoteList.Status == model.QuoteListStatusReadyForSelection {
		nextStatus = model.QuoteListStatusDraft
	}
	if err := repository.DB.Model(&quoteList).Updates(map[string]interface{}{
		"prerequisite_status": result.Status,
		"status":              nextStatus,
	}).Error; err != nil {
		return nil, fmt.Errorf("更新报价任务状态失败: %w", err)
	}
	return result, nil
}

func validateQuoteTaskPrerequisites(snapshot QuoteTaskPrerequisiteSnapshot) *QuoteTaskValidationResult {
	missing := make([]string, 0, 4)
	if snapshot.Area <= 0 {
		missing = append(missing, "area")
	}
	if strings.TrimSpace(snapshot.Layout) == "" {
		missing = append(missing, "layout")
	}
	if strings.TrimSpace(snapshot.RenovationType) == "" {
		missing = append(missing, "renovationType")
	}
	if strings.TrimSpace(snapshot.ConstructionScope) == "" {
		missing = append(missing, "constructionScope")
	}
	status := model.QuoteTaskPrerequisiteDraft
	if len(missing) == 0 {
		status = model.QuoteTaskPrerequisiteComplete
	}
	return &QuoteTaskValidationResult{
		OK:            len(missing) == 0,
		Status:        status,
		MissingFields: missing,
	}
}

func (s *QuoteService) RecommendForemen(quoteListID uint64) ([]RecommendedForeman, error) {
	var quoteList model.QuoteList
	if err := repository.DB.First(&quoteList, quoteListID).Error; err != nil {
		return nil, errors.New("报价任务不存在")
	}
	snapshot, err := s.getPrerequisiteSnapshot(&quoteList)
	if err != nil {
		return nil, err
	}
	validation := validateQuoteTaskPrerequisites(snapshot)
	if !validation.OK {
		return nil, errors.New("报价前置数据未完成，不能推荐工长")
	}
	var taskItems []model.QuoteListItem
	if err := repository.DB.Where("quote_list_id = ?", quoteListID).Find(&taskItems).Error; err != nil {
		return nil, fmt.Errorf("查询报价任务明细失败: %w", err)
	}

	var providers []model.Provider
	if err := repository.DB.Where("provider_type = ? AND status = ?", 3, 1).Find(&providers).Error; err != nil {
		return nil, fmt.Errorf("查询工长失败: %w", err)
	}

	recommendations := make([]RecommendedForeman, 0, len(providers))
	for _, provider := range providers {
		acceptBooking := true
		var setting model.MerchantServiceSetting
		if err := repository.DB.Where("provider_id = ?", provider.ID).First(&setting).Error; err == nil {
			acceptBooking = setting.AcceptBooking
		}
		book, err := s.getCurrentPriceBook(provider.ID)
		if err != nil {
			continue
		}
		var priceItems []model.QuotePriceBookItem
		if err := repository.DB.Where("price_book_id = ? AND status = ?", book.ID, model.QuoteLibraryItemStatusEnabled).Find(&priceItems).Error; err != nil {
			return nil, fmt.Errorf("查询工长价格项失败: %w", err)
		}
		priceByStandardID := make(map[uint64]model.QuotePriceBookItem, len(priceItems))
		for _, item := range priceItems {
			priceByStandardID[item.StandardItemID] = item
		}

		matchedItems := 0
		for _, taskItem := range taskItems {
			standardID := taskItem.StandardItemID
			if standardID == 0 {
				standardID = taskItem.MatchedStandardItemID
			}
			if standardID == 0 {
				continue
			}
			if _, ok := priceByStandardID[standardID]; ok {
				matchedItems++
			}
		}
		totalItems := len(taskItems)
		coverage := 0.0
		if totalItems > 0 {
			coverage = float64(matchedItems) / float64(totalItems)
		}

		providerAreas := parseJSONStringArray(provider.ServiceArea)
		regionMatched := overlapExists(snapshot.ServiceAreas, providerAreas)
		workTypesMatched := overlapExists(snapshot.WorkTypes, parseDelimitedString(provider.WorkTypes))
		reasons := make([]string, 0, 4)
		if regionMatched {
			reasons = append(reasons, "服务区域匹配")
		}
		if workTypesMatched {
			reasons = append(reasons, "工种匹配")
		}
		if acceptBooking {
			reasons = append(reasons, "当前可接单")
		}
		if coverage > 0 {
			reasons = append(reasons, fmt.Sprintf("价格覆盖率 %.0f%%", coverage*100))
		}
		recommendations = append(recommendations, RecommendedForeman{
			ProviderID:        provider.ID,
			ProviderName:      provider.CompanyName,
			ProviderType:      provider.ProviderType,
			ProviderSubType:   provider.SubType,
			RegionMatched:     regionMatched,
			WorkTypeMatched:   workTypesMatched,
			AcceptBooking:     acceptBooking,
			PriceCoverageRate: coverage,
			MatchedItemCount:  matchedItems,
			MissingItemCount:  totalItems - matchedItems,
			Reasons:           reasons,
		})
	}

	sort.SliceStable(recommendations, func(i, j int) bool {
		left := recommendations[i]
		right := recommendations[j]
		if left.AcceptBooking != right.AcceptBooking {
			return left.AcceptBooking
		}
		if left.RegionMatched != right.RegionMatched {
			return left.RegionMatched
		}
		if left.WorkTypeMatched != right.WorkTypeMatched {
			return left.WorkTypeMatched
		}
		if math.Abs(left.PriceCoverageRate-right.PriceCoverageRate) > 0.0001 {
			return left.PriceCoverageRate > right.PriceCoverageRate
		}
		return left.ProviderID < right.ProviderID
	})
	return recommendations, nil
}

func (s *QuoteService) SelectForemen(quoteListID, operatorID uint64, providerIDs []uint64) ([]model.QuoteInvitation, error) {
	var quoteList model.QuoteList
	if err := repository.DB.First(&quoteList, quoteListID).Error; err != nil {
		return nil, errors.New("报价任务不存在")
	}
	if quoteList.Status != model.QuoteListStatusReadyForSelection && quoteList.Status != model.QuoteListStatusRejected {
		return nil, fmt.Errorf("当前报价任务状态不允许选择工长: %s", quoteList.Status)
	}
	return s.InviteProviders(quoteListID, operatorID, providerIDs)
}

func (s *QuoteService) GenerateDrafts(quoteListID uint64) (*QuoteComparisonResponse, error) {
	var quoteList model.QuoteList
	if err := repository.DB.First(&quoteList, quoteListID).Error; err != nil {
		return nil, errors.New("报价任务不存在")
	}
	if quoteList.PrerequisiteStatus != model.QuoteTaskPrerequisiteComplete {
		return nil, errors.New("报价前置数据未完成，不能生成报价草稿")
	}

	var taskItems []model.QuoteListItem
	if err := repository.DB.Where("quote_list_id = ?", quoteListID).Order("sort_order ASC, id ASC").Find(&taskItems).Error; err != nil {
		return nil, fmt.Errorf("查询报价任务明细失败: %w", err)
	}
	if len(taskItems) == 0 {
		return nil, errors.New("报价任务没有明细项")
	}

	var invitations []model.QuoteInvitation
	if err := repository.DB.Where("quote_list_id = ?", quoteListID).Find(&invitations).Error; err != nil {
		return nil, fmt.Errorf("查询参与工长失败: %w", err)
	}
	if len(invitations) == 0 {
		return nil, errors.New("尚未选择工长")
	}

	tx := repository.DB.Begin()
	for _, invitation := range invitations {
		var provider model.Provider
		if err := tx.First(&provider, invitation.ProviderID).Error; err != nil {
			tx.Rollback()
			return nil, fmt.Errorf("工长不存在: %d", invitation.ProviderID)
		}
		priceBook, err := s.getCurrentPriceBookWithDB(tx, provider.ID)
		if err != nil {
			tx.Rollback()
			return nil, fmt.Errorf("工长 %d 缺少价格库", provider.ID)
		}
		var priceItems []model.QuotePriceBookItem
		if err := tx.Where("price_book_id = ? AND status = ?", priceBook.ID, model.QuoteLibraryItemStatusEnabled).Find(&priceItems).Error; err != nil {
			tx.Rollback()
			return nil, fmt.Errorf("查询工长价格库明细失败: %w", err)
		}
		priceByStandardID := make(map[uint64]model.QuotePriceBookItem, len(priceItems))
		for _, item := range priceItems {
			priceByStandardID[item.StandardItemID] = item
		}

		var submission model.QuoteSubmission
		err = tx.Where("quote_list_id = ? AND provider_id = ?", quoteListID, provider.ID).First(&submission).Error
		if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			tx.Rollback()
			return nil, fmt.Errorf("查询报价草稿失败: %w", err)
		}
		if errors.Is(err, gorm.ErrRecordNotFound) {
			submission = model.QuoteSubmission{
				QuoteListID:              quoteListID,
				ProviderID:               provider.ID,
				ProviderType:             provider.ProviderType,
				ProviderSubType:          provider.SubType,
				Status:                   model.QuoteSubmissionStatusGenerated,
				TaskStatus:               model.QuoteListStatusPricingInProgress,
				GenerationStatus:         model.QuoteGenerationStatusGenerated,
				Currency:                 quoteList.Currency,
				GeneratedFromPriceBookID: priceBook.ID,
			}
			if err := tx.Create(&submission).Error; err != nil {
				tx.Rollback()
				return nil, fmt.Errorf("创建报价草稿失败: %w", err)
			}
		} else {
			if err := tx.Where("quote_submission_id = ?", submission.ID).Delete(&model.QuoteSubmissionItem{}).Error; err != nil {
				tx.Rollback()
				return nil, fmt.Errorf("清空旧报价草稿失败: %w", err)
			}
		}

		var totalCent int64
		missing := false
		for _, taskItem := range taskItems {
			standardID := taskItem.StandardItemID
			if standardID == 0 {
				standardID = taskItem.MatchedStandardItemID
			}
			priceItem, ok := priceByStandardID[standardID]
			unitPrice := int64(0)
			generatedUnitPrice := int64(0)
			amount := int64(0)
			minChargeApplied := false
			missingPrice := false
			if ok {
				generatedUnitPrice = priceItem.UnitPriceCent
				unitPrice = priceItem.UnitPriceCent
				amount = quoteAmountCent(taskItem.Quantity, unitPrice)
				if priceItem.MinChargeCent > 0 && amount > 0 && amount < priceItem.MinChargeCent {
					amount = priceItem.MinChargeCent
					minChargeApplied = true
				}
			} else {
				missing = true
				missingPrice = true
			}
			submissionItem := model.QuoteSubmissionItem{
				QuoteSubmissionID:     submission.ID,
				QuoteListItemID:       taskItem.ID,
				GeneratedUnitPriceCent: generatedUnitPrice,
				UnitPriceCent:         unitPrice,
				AmountCent:            amount,
				AdjustedFlag:          false,
				MissingPriceFlag:      missingPrice,
				MissingMappingFlag:    taskItem.MissingMappingFlag || standardID == 0,
				MinChargeAppliedFlag:  minChargeApplied,
			}
			if err := tx.Create(&submissionItem).Error; err != nil {
				tx.Rollback()
				return nil, fmt.Errorf("保存报价草稿明细失败: %w", err)
			}
			totalCent += amount
		}

		generationStatus := model.QuoteGenerationStatusGenerated
		if missing {
			generationStatus = model.QuoteGenerationStatusPartialMissing
		}
		if err := tx.Model(&submission).Updates(map[string]interface{}{
			"status":                    model.QuoteSubmissionStatusGenerated,
			"task_status":               model.QuoteListStatusPricingInProgress,
			"generation_status":         generationStatus,
			"generated_from_price_book_id": priceBook.ID,
			"total_cent":                totalCent,
		}).Error; err != nil {
			tx.Rollback()
			return nil, fmt.Errorf("更新报价草稿失败: %w", err)
		}
	}

	if err := tx.Model(&quoteList).Updates(map[string]interface{}{
		"status": model.QuoteListStatusPricingInProgress,
	}).Error; err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("更新报价任务状态失败: %w", err)
	}

	if err := tx.Commit().Error; err != nil {
		return nil, fmt.Errorf("生成报价草稿失败: %w", err)
	}
	return s.GetQuoteComparison(quoteListID)
}

func (s *QuoteService) SubmitTaskToUser(quoteListID, submissionID uint64) (*model.QuoteList, error) {
	var quoteList model.QuoteList
	if err := repository.DB.First(&quoteList, quoteListID).Error; err != nil {
		return nil, errors.New("报价任务不存在")
	}
	if quoteList.Status != model.QuoteListStatusPricingInProgress {
		return nil, fmt.Errorf("当前报价任务状态不允许提交给用户: %s", quoteList.Status)
	}
	var submission model.QuoteSubmission
	if err := repository.DB.Where("quote_list_id = ? AND id = ?", quoteListID, submissionID).First(&submission).Error; err != nil {
		return nil, errors.New("报价版本不存在")
	}
	if submission.Status != model.QuoteSubmissionStatusSubmitted {
		return nil, errors.New("只能提交已由工长正式提交的报价版本")
	}
	now := time.Now()
	if err := repository.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&model.QuoteSubmission{}).Where("quote_list_id = ?", quoteListID).Update("submitted_to_user", false).Error; err != nil {
			return err
		}
		if err := tx.Model(&submission).Updates(map[string]interface{}{
			"submitted_to_user": true,
			"task_status":       model.QuoteListStatusSubmittedToUser,
		}).Error; err != nil {
			return err
		}
		return tx.Model(&quoteList).Updates(map[string]interface{}{
			"status":                   model.QuoteListStatusSubmittedToUser,
			"user_confirmation_status": model.QuoteUserConfirmationPending,
			"active_submission_id":     submission.ID,
			"submitted_to_user_at":     &now,
			"awarded_quote_submission_id": submission.ID,
			"awarded_provider_id":      submission.ProviderID,
		}).Error
	}); err != nil {
		return nil, fmt.Errorf("提交给用户确认失败: %w", err)
	}
	quoteList.Status = model.QuoteListStatusSubmittedToUser
	quoteList.UserConfirmationStatus = model.QuoteUserConfirmationPending
	quoteList.ActiveSubmissionID = submission.ID
	quoteList.SubmittedToUserAt = &now
	quoteList.AwardedQuoteSubmissionID = submission.ID
	quoteList.AwardedProviderID = submission.ProviderID
	return &quoteList, nil
}

func (s *QuoteService) RequoteTask(quoteListID uint64) (*model.QuoteList, error) {
	var quoteList model.QuoteList
	if err := repository.DB.First(&quoteList, quoteListID).Error; err != nil {
		return nil, errors.New("报价任务不存在")
	}
	if quoteList.Status != model.QuoteListStatusUserConfirmed && quoteList.Status != model.QuoteListStatusRejected && quoteList.Status != model.QuoteListStatusSubmittedToUser {
		return nil, fmt.Errorf("当前报价任务状态不允许重报价: %s", quoteList.Status)
	}

	var items []model.QuoteListItem
	if err := repository.DB.Where("quote_list_id = ?", quoteListID).Order("sort_order ASC, id ASC").Find(&items).Error; err != nil {
		return nil, fmt.Errorf("查询任务明细失败: %w", err)
	}

	tx := repository.DB.Begin()
	newTask := model.QuoteList{
		ProjectID:                quoteList.ProjectID,
		ProposalID:               quoteList.ProposalID,
		ProposalVersion:          quoteList.ProposalVersion + 1,
		DesignerProviderID:       quoteList.DesignerProviderID,
		CustomerID:               quoteList.CustomerID,
		HouseID:                  quoteList.HouseID,
		OwnerUserID:              quoteList.OwnerUserID,
		ScenarioType:             quoteList.ScenarioType,
		Title:                    fmt.Sprintf("%s（重报价）", quoteList.Title),
		Status:                   model.QuoteListStatusDraft,
		Currency:                 quoteList.Currency,
		DeadlineAt:               quoteList.DeadlineAt,
		PrerequisiteSnapshotJSON: quoteList.PrerequisiteSnapshotJSON,
		PrerequisiteStatus:       quoteList.PrerequisiteStatus,
		UserConfirmationStatus:   model.QuoteUserConfirmationPending,
	}
	if err := tx.Create(&newTask).Error; err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("创建重报价任务失败: %w", err)
	}
	for _, item := range items {
		item.ID = 0
		item.QuoteListID = newTask.ID
		if err := tx.Create(&item).Error; err != nil {
			tx.Rollback()
			return nil, fmt.Errorf("复制重报价明细失败: %w", err)
		}
	}
	if err := tx.Model(&quoteList).Updates(map[string]interface{}{
		"status": model.QuoteListStatusSuperseded,
	}).Error; err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("更新旧任务状态失败: %w", err)
	}
	if err := tx.Model(&model.QuoteSubmission{}).Where("quote_list_id = ?", quoteListID).Updates(map[string]interface{}{
		"status":       model.QuoteSubmissionStatusSuperseded,
		"superseded_by": newTask.ID,
	}).Error; err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("更新旧报价版本失败: %w", err)
	}
	if err := tx.Commit().Error; err != nil {
		return nil, fmt.Errorf("重报价失败: %w", err)
	}
	return &newTask, nil
}

func (s *QuoteService) GetUserQuoteTask(quoteListID, userID uint64) (*QuoteTaskUserView, error) {
	var quoteList model.QuoteList
	if err := repository.DB.First(&quoteList, quoteListID).Error; err != nil {
		return nil, errors.New("报价任务不存在")
	}
	if quoteList.OwnerUserID != userID {
		return nil, errors.New("无权查看该报价任务")
	}
	if quoteList.ActiveSubmissionID == 0 {
		return nil, errors.New("当前报价任务尚未提交给用户")
	}

	var submission model.QuoteSubmission
	if err := repository.DB.First(&submission, quoteList.ActiveSubmissionID).Error; err != nil {
		return nil, errors.New("报价版本不存在")
	}
	var items []model.QuoteSubmissionItem
	if err := repository.DB.Where("quote_submission_id = ?", submission.ID).Order("quote_list_item_id ASC").Find(&items).Error; err != nil {
		return nil, fmt.Errorf("查询报价明细失败: %w", err)
	}
	snapshot, err := s.getPrerequisiteSnapshot(&quoteList)
	if err != nil {
		return nil, err
	}
	return &QuoteTaskUserView{
		QuoteList:   quoteList,
		Submission:  submission,
		Items:       items,
		TaskSummary: snapshot,
	}, nil
}

func (s *QuoteService) ListUserQuoteTasks(userID uint64) ([]UserQuoteTaskSummary, error) {
	var tasks []model.QuoteList
	if err := repository.DB.Where("owner_user_id = ?", userID).Order("updated_at DESC").Find(&tasks).Error; err != nil {
		return nil, fmt.Errorf("查询用户报价任务失败: %w", err)
	}
	result := make([]UserQuoteTaskSummary, 0, len(tasks))
	for _, task := range tasks {
		row := UserQuoteTaskSummary{
			ID:                     task.ID,
			Title:                  task.Title,
			Status:                 task.Status,
			UserConfirmationStatus: task.UserConfirmationStatus,
			ActiveSubmissionID:     task.ActiveSubmissionID,
		}
		if task.DeadlineAt != nil {
			row.DeadlineAt = task.DeadlineAt.Format(time.RFC3339)
		}
		result = append(result, row)
	}
	return result, nil
}

func (s *QuoteService) UserConfirmQuoteSubmission(submissionID, userID uint64) (*model.QuoteList, error) {
	var submission model.QuoteSubmission
	if err := repository.DB.First(&submission, submissionID).Error; err != nil {
		return nil, errors.New("报价版本不存在")
	}
	var quoteList model.QuoteList
	if err := repository.DB.First(&quoteList, submission.QuoteListID).Error; err != nil {
		return nil, errors.New("报价任务不存在")
	}
	if quoteList.OwnerUserID != userID {
		return nil, errors.New("无权确认该报价")
	}
	if quoteList.Status != model.QuoteListStatusSubmittedToUser {
		return nil, fmt.Errorf("当前报价任务状态不允许确认: %s", quoteList.Status)
	}
	now := time.Now()
	if err := repository.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&model.QuoteSubmission{}).Where("quote_list_id = ?", quoteList.ID).Updates(map[string]interface{}{
			"submitted_to_user": false,
		}).Error; err != nil {
			return err
		}
		if err := tx.Model(&submission).Updates(map[string]interface{}{
			"status":             model.QuoteSubmissionStatusUserConfirmed,
			"task_status":        model.QuoteListStatusUserConfirmed,
			"submitted_to_user":  true,
			"locked_at":          &now,
			"user_confirmed_at":  &now,
		}).Error; err != nil {
			return err
		}
		return tx.Model(&quoteList).Updates(map[string]interface{}{
			"status":                   model.QuoteListStatusUserConfirmed,
			"user_confirmation_status": model.QuoteUserConfirmationConfirmed,
			"user_confirmed_at":        &now,
			"active_submission_id":     submission.ID,
			"awarded_provider_id":      submission.ProviderID,
			"awarded_quote_submission_id": submission.ID,
		}).Error
	}); err != nil {
		return nil, fmt.Errorf("确认报价失败: %w", err)
	}
	quoteList.Status = model.QuoteListStatusUserConfirmed
	quoteList.UserConfirmationStatus = model.QuoteUserConfirmationConfirmed
	quoteList.UserConfirmedAt = &now
	quoteList.ActiveSubmissionID = submission.ID
	return &quoteList, nil
}

func (s *QuoteService) UserRejectQuoteSubmission(submissionID, userID uint64, reason string) (*model.QuoteList, error) {
	var submission model.QuoteSubmission
	if err := repository.DB.First(&submission, submissionID).Error; err != nil {
		return nil, errors.New("报价版本不存在")
	}
	var quoteList model.QuoteList
	if err := repository.DB.First(&quoteList, submission.QuoteListID).Error; err != nil {
		return nil, errors.New("报价任务不存在")
	}
	if quoteList.OwnerUserID != userID {
		return nil, errors.New("无权拒绝该报价")
	}
	now := time.Now()
	if err := repository.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&submission).Updates(map[string]interface{}{
			"status":      model.QuoteSubmissionStatusSubmitted,
			"task_status": model.QuoteListStatusRejected,
			"remark":      strings.TrimSpace(strings.Join([]string{submission.Remark, reason}, "\n用户拒绝：")),
		}).Error; err != nil {
			return err
		}
		return tx.Model(&quoteList).Updates(map[string]interface{}{
			"status":                   model.QuoteListStatusRejected,
			"user_confirmation_status": model.QuoteUserConfirmationRejected,
			"rejected_at":              &now,
		}).Error
	}); err != nil {
		return nil, fmt.Errorf("拒绝报价失败: %w", err)
	}
	quoteList.Status = model.QuoteListStatusRejected
	quoteList.UserConfirmationStatus = model.QuoteUserConfirmationRejected
	quoteList.RejectedAt = &now
	return &quoteList, nil
}

func (s *QuoteService) BuildSubmissionPrintHTML(submissionID uint64) (string, error) {
	var submission model.QuoteSubmission
	if err := repository.DB.First(&submission, submissionID).Error; err != nil {
		return "", errors.New("报价版本不存在")
	}
	var quoteList model.QuoteList
	if err := repository.DB.First(&quoteList, submission.QuoteListID).Error; err != nil {
		return "", errors.New("报价任务不存在")
	}
	var items []model.QuoteSubmissionItem
	if err := repository.DB.Where("quote_submission_id = ?", submissionID).Order("quote_list_item_id ASC").Find(&items).Error; err != nil {
		return "", fmt.Errorf("查询报价明细失败: %w", err)
	}
	var taskItems []model.QuoteListItem
	if err := repository.DB.Where("quote_list_id = ?", quoteList.ID).Order("id ASC").Find(&taskItems).Error; err != nil {
		return "", fmt.Errorf("查询任务明细失败: %w", err)
	}
	taskItemByID := make(map[uint64]model.QuoteListItem, len(taskItems))
	for _, item := range taskItems {
		taskItemByID[item.ID] = item
	}
	type printItem struct {
		Name       string
		Unit       string
		Quantity   float64
		UnitPrice  string
		Amount     string
		Remark     string
	}
	rows := make([]printItem, 0, len(items))
	for _, item := range items {
		taskItem := taskItemByID[item.QuoteListItemID]
		rows = append(rows, printItem{
			Name:      taskItem.Name,
			Unit:      taskItem.Unit,
			Quantity:  taskItem.Quantity,
			UnitPrice: formatCentCurrency(item.UnitPriceCent),
			Amount:    formatCentCurrency(item.AmountCent),
			Remark:    item.Remark,
		})
	}
	tpl := template.Must(template.New("quote-print").Parse(`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>{{.Title}}</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#111}table{width:100%;border-collapse:collapse;margin-top:16px}th,td{border:1px solid #ddd;padding:8px;font-size:14px;text-align:left}th{background:#f5f5f5}.meta{margin-bottom:16px;color:#555}</style></head><body><h1>{{.Title}}</h1><div class="meta">状态：{{.Status}} ｜ 币种：{{.Currency}} ｜ 总价：{{.Total}}</div><table><thead><tr><th>项目</th><th>单位</th><th>数量</th><th>单价</th><th>小计</th><th>备注</th></tr></thead><tbody>{{range .Items}}<tr><td>{{.Name}}</td><td>{{.Unit}}</td><td>{{printf "%.2f" .Quantity}}</td><td>{{.UnitPrice}}</td><td>{{.Amount}}</td><td>{{.Remark}}</td></tr>{{end}}</tbody></table></body></html>`))
	var builder strings.Builder
	if err := tpl.Execute(&builder, map[string]any{
		"Title":    quoteList.Title,
		"Status":   submission.Status,
		"Currency": submission.Currency,
		"Total":    formatCentCurrency(submission.TotalCent),
		"Items":    rows,
	}); err != nil {
		return "", fmt.Errorf("生成打印版失败: %w", err)
	}
	return builder.String(), nil
}

func (s *QuoteService) getPrerequisiteSnapshot(quoteList *model.QuoteList) (QuoteTaskPrerequisiteSnapshot, error) {
	if strings.TrimSpace(quoteList.PrerequisiteSnapshotJSON) == "" {
		return QuoteTaskPrerequisiteSnapshot{}, nil
	}
	var snapshot QuoteTaskPrerequisiteSnapshot
	if err := json.Unmarshal([]byte(quoteList.PrerequisiteSnapshotJSON), &snapshot); err != nil {
		return QuoteTaskPrerequisiteSnapshot{}, errors.New("报价前置数据格式错误")
	}
	return snapshot, nil
}

func parseJSONStringArray(raw string) []string {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return nil
	}
	var values []string
	if strings.HasPrefix(trimmed, "[") && strings.HasSuffix(trimmed, "]") {
		if err := json.Unmarshal([]byte(trimmed), &values); err == nil {
			return normalizeStringSlice(values)
		}
	}
	return normalizeStringSlice([]string{trimmed})
}

func parseDelimitedString(raw string) []string {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return nil
	}
	if strings.Contains(trimmed, ",") {
		return normalizeStringSlice(strings.Split(trimmed, ","))
	}
	if strings.Contains(trimmed, " · ") {
		return normalizeStringSlice(strings.Split(trimmed, " · "))
	}
	return normalizeStringSlice([]string{trimmed})
}

func overlapExists(left, right []string) bool {
	if len(left) == 0 || len(right) == 0 {
		return false
	}
	lookup := make(map[string]struct{}, len(left))
	for _, item := range left {
		lookup[strings.ToLower(strings.TrimSpace(item))] = struct{}{}
	}
	for _, item := range right {
		if _, ok := lookup[strings.ToLower(strings.TrimSpace(item))]; ok {
			return true
		}
	}
	return false
}

func formatCentCurrency(value int64) string {
	if value <= 0 {
		return "-"
	}
	return fmt.Sprintf("¥%.2f", float64(value)/100)
}
