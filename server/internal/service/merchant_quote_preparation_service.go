package service

import (
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"slices"
	"sort"
	"strings"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"

	"gorm.io/gorm"
)

type MerchantQuotePreparation struct {
	QuoteList               model.QuoteList               `json:"quoteList"`
	QuoteListID             uint64                        `json:"quoteListId"`
	PrerequisiteStatus      string                        `json:"prerequisiteStatus"`
	PrerequisiteSnapshot    QuoteTaskPrerequisiteSnapshot `json:"prerequisiteSnapshot"`
	QuantityBase            *model.QuantityBase           `json:"quantityBase,omitempty"`
	QuantityItems           []model.QuantityBaseItem      `json:"quantityItems"`
	MissingFields           []string                      `json:"missingFields"`
	TemplateID              uint64                        `json:"templateId,omitempty"`
	TemplateError           string                        `json:"templateError,omitempty"`
	TemplateSections        []MerchantTemplateSection     `json:"templateSections,omitempty"`
	SelectedForemanID       uint64                        `json:"selectedForemanId,omitempty"`
	RecommendedForemen      []RecommendedForeman          `json:"recommendedForemen,omitempty"`
	Completeness            *MerchantFlowStepCompleteness `json:"completeness,omitempty"`
	UserFacingExplainers    []string                      `json:"userFacingExplainers,omitempty"`
	BridgeConversionSummary *BridgeConversionSummary      `json:"bridgeConversionSummary,omitempty"`
}

type MerchantTemplateSection struct {
	Key   string                     `json:"key"`
	Title string                     `json:"title"`
	Rows  []MerchantTemplateRowInput `json:"rows"`
}

type MerchantTemplateRowInput struct {
	StandardItemID    uint64  `json:"standardItemId"`
	StandardCode      string  `json:"standardCode,omitempty"`
	Name              string  `json:"name"`
	Unit              string  `json:"unit"`
	CategoryL1        string  `json:"categoryL1,omitempty"`
	CategoryL2        string  `json:"categoryL2,omitempty"`
	Required          bool    `json:"required"`
	Applicable        bool    `json:"applicable"`
	SuggestedQuantity float64 `json:"suggestedQuantity,omitempty"`
	InputQuantity     float64 `json:"inputQuantity,omitempty"`
	BaselineNote      string  `json:"baselineNote,omitempty"`
}

type MerchantQuantityItemInput struct {
	StandardItemID uint64  `json:"standardItemId"`
	Quantity       float64 `json:"quantity"`
	BaselineNote   string  `json:"baselineNote,omitempty"`
}

type quotePreparationTemplateResolved struct {
	Template           *model.QuoteTemplate
	Items              []model.QuoteTemplateItem
	LibraryByID        map[uint64]model.QuoteLibraryItem
	RequiredByStandard map[uint64]bool
}

type quotePreparationTemplateState struct {
	TemplateID           uint64
	TemplateError        string
	Sections             []MerchantTemplateSection
	MissingRequiredNames []string
	EffectiveItemCount   int
}

var errNoAvailablePreparationLibraryItems = errors.New("当前未配置可用标准施工项，无法生成施工报价表单")

func (s *QuoteService) StartMerchantConstructionPreparation(providerID, bookingID uint64) (*MerchantQuotePreparation, error) {
	quoteList, err := s.ensureMerchantConstructionQuoteTask(providerID, bookingID)
	if err != nil {
		return nil, err
	}
	return s.buildMerchantQuotePreparation(quoteList)
}

func (s *QuoteService) GetMerchantConstructionPreparation(providerID, quoteListID uint64) (*MerchantQuotePreparation, error) {
	quoteList, err := s.getMerchantDesignerQuoteTask(providerID, quoteListID)
	if err != nil {
		return nil, err
	}
	return s.buildMerchantQuotePreparation(quoteList)
}

func (s *QuoteService) UpdateMerchantConstructionPreparationPrerequisites(providerID, quoteListID uint64, input *QuoteTaskPrerequisiteUpdateInput) (*MerchantQuotePreparation, error) {
	quoteList, err := s.getMerchantEditableDesignerQuoteTask(providerID, quoteListID)
	if err != nil {
		return nil, err
	}
	if _, err := s.UpdateTaskPrerequisites(quoteList.ID, input); err != nil {
		return nil, err
	}
	return s.buildMerchantQuotePreparation(quoteList)
}

func (s *QuoteService) ReplaceMerchantConstructionPreparationItems(providerID, quoteListID uint64, inputs []MerchantQuantityItemInput) (*MerchantQuotePreparation, error) {
	quoteList, err := s.getMerchantEditableDesignerQuoteTask(providerID, quoteListID)
	if err != nil {
		return nil, err
	}
	if quoteList.QuantityBaseID == 0 {
		return nil, errors.New("施工基线不存在")
	}
	snapshot, err := s.getPrerequisiteSnapshot(quoteList)
	if err != nil {
		return nil, err
	}
	templateResolved, err := s.resolvePreparationTemplateWithDB(repository.DB, quoteList, snapshot)
	if err != nil {
		return nil, err
	}
	if templateResolved == nil || templateResolved.Template == nil {
		return nil, errNoAvailablePreparationLibraryItems
	}

	inputByStandardID := make(map[uint64]MerchantQuantityItemInput, len(inputs))
	for _, raw := range inputs {
		if raw.StandardItemID == 0 {
			return nil, errors.New("施工项缺少标准项标识")
		}
		if _, exists := inputByStandardID[raw.StandardItemID]; exists {
			return nil, fmt.Errorf("施工项 %d 重复提交", raw.StandardItemID)
		}
		inputByStandardID[raw.StandardItemID] = raw
	}

	effectiveInputs := make([]MerchantQuantityItemInput, 0, len(templateResolved.Items))
	for _, templateItem := range templateResolved.Items {
		raw, ok := inputByStandardID[templateItem.LibraryItemID]
		if !ok {
			continue
		}
		quantity := roundQuantityByUnit(raw.Quantity, templateResolved.LibraryByID[templateItem.LibraryItemID].Unit)
		if quantity <= 0 {
			continue
		}
		raw.Quantity = quantity
		effectiveInputs = append(effectiveInputs, raw)
	}

	tx := repository.DB.Begin()
	if tx.Error != nil {
		return nil, fmt.Errorf("开启事务失败: %w", tx.Error)
	}

	if err := tx.Where("quote_list_id = ?", quoteList.ID).Delete(&model.QuoteListItem{}).Error; err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("清空报价明细失败: %w", err)
	}
	if err := tx.Where("quantity_base_id = ?", quoteList.QuantityBaseID).Delete(&model.QuantityBaseItem{}).Error; err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("清空施工基线失败: %w", err)
	}

	for idx, raw := range effectiveInputs {
		libraryItem, exists := templateResolved.LibraryByID[raw.StandardItemID]
		if !exists {
			tx.Rollback()
			return nil, fmt.Errorf("标准施工项 %d 不存在", raw.StandardItemID)
		}
		unit := strings.TrimSpace(firstNonBlank(libraryItem.Unit, "项"))
		sourceCode := strings.TrimSpace(firstNonBlank(libraryItem.StandardCode, libraryItem.ERPItemCode))
		row := model.QuantityBaseItem{
			QuantityBaseID: quoteList.QuantityBaseID,
			StandardItemID: raw.StandardItemID,
			SourceLineNo:   idx + 1,
			SourceItemCode: sourceCode,
			SourceItemName: strings.TrimSpace(libraryItem.Name),
			Unit:           unit,
			Quantity:       raw.Quantity,
			BaselineNote:   strings.TrimSpace(raw.BaselineNote),
			CategoryL1:     strings.TrimSpace(libraryItem.CategoryL1),
			CategoryL2:     strings.TrimSpace(libraryItem.CategoryL2),
			SortOrder:      idx + 1,
		}
		if err := tx.Create(&row).Error; err != nil {
			tx.Rollback()
			return nil, fmt.Errorf("保存施工基线失败: %w", err)
		}
	}

	if err := s.syncQuoteListItemsFromQuantityBaseTx(tx, quoteList); err != nil {
		tx.Rollback()
		return nil, err
	}
	if err := s.syncQuoteTaskPrerequisiteStateTx(tx, quoteList); err != nil {
		tx.Rollback()
		return nil, err
	}
	if err := tx.Commit().Error; err != nil {
		return nil, fmt.Errorf("保存施工基线失败: %w", err)
	}
	return s.buildMerchantQuotePreparation(quoteList)
}

func (s *QuoteService) RecommendMerchantConstructionForemen(providerID, quoteListID uint64) ([]RecommendedForeman, error) {
	quoteList, err := s.getMerchantDesignerQuoteTask(providerID, quoteListID)
	if err != nil {
		return nil, err
	}
	if err := s.ensureMerchantPreparationTemplateConfigured(quoteList); err != nil {
		return nil, err
	}
	return s.RecommendForemen(quoteList.ID)
}

func (s *QuoteService) SelectMerchantConstructionForemen(providerID, operatorUserID, quoteListID uint64, providerIDs []uint64) (*MerchantQuotePreparation, error) {
	quoteList, err := s.getMerchantEditableDesignerQuoteTask(providerID, quoteListID)
	if err != nil {
		return nil, err
	}
	if err := s.ensureMerchantPreparationTemplateConfigured(quoteList); err != nil {
		return nil, err
	}
	if len(providerIDs) != 1 || providerIDs[0] == 0 {
		return nil, errors.New("请选择 1 个施工主体")
	}
	if _, err := s.ValidateTaskPrerequisites(quoteList.ID); err != nil {
		return nil, err
	}
	if _, err := s.SelectForemen(quoteList.ID, operatorUserID, providerIDs); err != nil {
		return nil, err
	}
	if _, err := s.GenerateDrafts(quoteList.ID); err != nil {
		return nil, err
	}
	if sourceType, sourceID, err := businessFlowSvc.ResolveSourceFromProposal(nil, quoteList.ProposalID); err == nil && sourceID > 0 {
		_ = businessFlowSvc.AdvanceBySource(nil, sourceType, sourceID, map[string]interface{}{
			"selected_quote_task_id":       quoteList.ID,
			"selected_foreman_provider_id": providerIDs[0],
			"current_stage":                model.BusinessFlowStageConstructionPartyPending,
		})
	}
	return s.buildMerchantQuotePreparation(quoteList)
}

func (s *QuoteService) ensureMerchantPreparationTemplateConfigured(quoteList *model.QuoteList) error {
	if quoteList == nil {
		return errors.New("报价任务不存在")
	}
	snapshot, err := s.getPrerequisiteSnapshot(quoteList)
	if err != nil {
		return err
	}
	templateState, err := s.buildPreparationTemplateStateWithDB(repository.DB, quoteList, snapshot, nil, false)
	if err != nil {
		return err
	}
	if templateState.TemplateError != "" {
		return errors.New(templateState.TemplateError)
	}
	return nil
}

func (s *QuoteService) ensureMerchantConstructionQuoteTask(providerID, bookingID uint64) (*model.QuoteList, error) {
	bookingService := &BookingService{}
	booking, err := bookingService.getBookingForProvider(providerID, bookingID)
	if err != nil {
		return nil, err
	}

	var proposal model.Proposal
	if err := repository.DB.
		Where("booking_id = ? AND designer_id = ? AND status = ?", booking.ID, providerID, model.ProposalStatusConfirmed).
		Order("confirmed_at DESC, id DESC").
		First(&proposal).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("需先完成正式方案确认")
		}
		return nil, fmt.Errorf("查询已确认方案失败: %w", err)
	}

	quantityBase, err := s.EnsureQuantityBaseFromProposal(proposal.ID)
	if err != nil {
		return nil, err
	}

	var quoteList model.QuoteList
	err = repository.DB.
		Where("proposal_id = ? AND designer_provider_id = ?", proposal.ID, providerID).
		Where("status <> ?", model.QuoteListStatusClosed).
		Order("updated_at DESC, id DESC").
		First(&quoteList).Error
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, fmt.Errorf("查询施工报价任务失败: %w", err)
	}

	if errors.Is(err, gorm.ErrRecordNotFound) {
		title := fmt.Sprintf("施工报价任务 #%d", proposal.ID)
		if trimmedAddress := strings.TrimSpace(booking.Address); trimmedAddress != "" {
			title = fmt.Sprintf("%s · 施工报价", trimmedAddress)
		}
		created, createErr := s.CreateQuoteList(&QuoteListCreateInput{
			ProposalID:         proposal.ID,
			ProposalVersion:    proposal.Version,
			QuantityBaseID:     quantityBase.ID,
			DesignerProviderID: providerID,
			OwnerUserID:        booking.UserID,
			CustomerID:         booking.UserID,
			Title:              title,
			Currency:           "CNY",
		})
		if createErr != nil {
			return nil, createErr
		}
		quoteList = *created
	}

	if quoteList.QuantityBaseID == 0 || quoteList.QuantityBaseID != quantityBase.ID {
		if err := repository.DB.Model(&quoteList).Updates(map[string]interface{}{
			"quantity_base_id":      quantityBase.ID,
			"quantity_base_version": quantityBase.Version,
			"proposal_version":      proposal.Version,
		}).Error; err != nil {
			return nil, fmt.Errorf("绑定施工基线失败: %w", err)
		}
		quoteList.QuantityBaseID = quantityBase.ID
		quoteList.QuantityBaseVersion = quantityBase.Version
		quoteList.ProposalVersion = proposal.Version
	}

	if err := s.initializeQuoteTaskPrerequisitesIfEmpty(&quoteList, booking, &proposal); err != nil {
		return nil, err
	}

	if quoteList.Status == model.QuoteListStatusDraft || quoteList.Status == model.QuoteListStatusReadyForSelection {
		if err := s.syncQuoteListItemsFromQuantityBase(&quoteList); err != nil {
			return nil, err
		}
		if err := s.syncQuoteTaskPrerequisiteState(&quoteList); err != nil {
			return nil, err
		}
	}

	return s.getMerchantDesignerQuoteTask(providerID, quoteList.ID)
}

func (s *QuoteService) initializeQuoteTaskPrerequisitesIfEmpty(quoteList *model.QuoteList, booking *model.Booking, proposal *model.Proposal) error {
	if quoteList == nil || booking == nil {
		return nil
	}
	if strings.TrimSpace(quoteList.PrerequisiteSnapshotJSON) != "" && strings.TrimSpace(quoteList.PrerequisiteSnapshotJSON) != "{}" {
		return nil
	}
	snapshot := QuoteTaskPrerequisiteSnapshot{
		Area:              booking.Area,
		Layout:            strings.TrimSpace(booking.HouseLayout),
		RenovationType:    strings.TrimSpace(booking.RenovationType),
		ServiceAreas:      extractProjectRegionHints(strings.TrimSpace(booking.Address)),
		ConstructionScope: "",
	}
	if proposal != nil {
		snapshot.Notes = strings.TrimSpace(firstNonBlank(proposal.Summary, booking.Notes))
	} else {
		snapshot.Notes = strings.TrimSpace(booking.Notes)
	}
	raw, err := json.Marshal(snapshot)
	if err != nil {
		return fmt.Errorf("序列化施工前置资料失败: %w", err)
	}
	result := validateQuoteTaskPrerequisites(snapshot)
	if err := repository.DB.Model(&model.QuoteList{}).Where("id = ?", quoteList.ID).Updates(map[string]interface{}{
		"prerequisite_snapshot_json": string(raw),
		"prerequisite_status":        result.Status,
	}).Error; err != nil {
		return fmt.Errorf("初始化施工前置资料失败: %w", err)
	}
	quoteList.PrerequisiteSnapshotJSON = string(raw)
	quoteList.PrerequisiteStatus = result.Status
	return nil
}

func (s *QuoteService) buildMerchantQuotePreparation(quoteList *model.QuoteList) (*MerchantQuotePreparation, error) {
	if quoteList == nil {
		return nil, errors.New("报价任务不存在")
	}

	var refreshed model.QuoteList
	if err := repository.DB.First(&refreshed, quoteList.ID).Error; err != nil {
		return nil, errors.New("报价任务不存在")
	}

	var quantityBase *model.QuantityBase
	var quantityItems []model.QuantityBaseItem
	if refreshed.QuantityBaseID > 0 {
		var base model.QuantityBase
		if err := repository.DB.First(&base, refreshed.QuantityBaseID).Error; err == nil {
			quantityBase = &base
			_ = repository.DB.Where("quantity_base_id = ?", base.ID).Order("sort_order ASC, id ASC").Find(&quantityItems).Error
		}
	}

	snapshot, err := s.getPrerequisiteSnapshot(&refreshed)
	if err != nil {
		return nil, err
	}
	templateState, err := s.buildPreparationTemplateStateWithDB(repository.DB, &refreshed, snapshot, quantityItems, true)
	if err != nil {
		return nil, err
	}
	validation, err := s.validateQuoteTaskReadinessWithDB(repository.DB, &refreshed, snapshot)
	if err != nil {
		return nil, err
	}
	missingFields := append([]string{}, validation.MissingFields...)
	if templateState.TemplateError != "" {
		missingFields = append(missingFields, "quantityItems")
	}

	recommended := make([]RecommendedForeman, 0)
	if validation.OK {
		if result, recommendErr := s.RecommendForemen(refreshed.ID); recommendErr == nil {
			recommended = result
		}
	}

	selectedForemanID := refreshed.AwardedProviderID
	if selectedForemanID == 0 {
		var invitation model.QuoteInvitation
		if err := repository.DB.Where("quote_list_id = ?", refreshed.ID).Order("id ASC").First(&invitation).Error; err == nil {
			selectedForemanID = invitation.ProviderID
		}
	}

	bridgeConversionSummary := BuildBridgeConversionSummaryByQuoteList(&refreshed)
	result := &MerchantQuotePreparation{
		QuoteList:               refreshed,
		QuoteListID:             refreshed.ID,
		PrerequisiteStatus:      refreshed.PrerequisiteStatus,
		PrerequisiteSnapshot:    snapshot,
		QuantityBase:            quantityBase,
		QuantityItems:           quantityItems,
		MissingFields:           uniqueStringSlice(missingFields),
		TemplateID:              templateState.TemplateID,
		TemplateError:           templateState.TemplateError,
		TemplateSections:        templateState.Sections,
		SelectedForemanID:       selectedForemanID,
		RecommendedForemen:      recommended,
		BridgeConversionSummary: bridgeConversionSummary,
	}
	result.Completeness = buildMerchantPreparationCompleteness(result.MissingFields)
	result.UserFacingExplainers = buildMerchantPreparationExplainers(result)
	return result, nil
}

func buildMerchantPreparationCompleteness(missingFields []string) *MerchantFlowStepCompleteness {
	checkpoints := []string{"area", "layout", "renovationType", "constructionScope", "serviceAreas", "houseUsage", "quantityItems"}
	missingSet := make(map[string]struct{}, len(missingFields))
	for _, field := range missingFields {
		missingSet[strings.TrimSpace(field)] = struct{}{}
	}
	completed := 0
	for _, field := range checkpoints {
		if _, missing := missingSet[field]; !missing {
			completed++
		}
	}
	return &MerchantFlowStepCompleteness{
		Completed: completed,
		Total:     len(checkpoints),
		Summary:   fmt.Sprintf("%d/%d 项施工准备已完善", completed, len(checkpoints)),
	}
}

func buildMerchantPreparationExplainers(preparation *MerchantQuotePreparation) []string {
	if preparation == nil {
		return nil
	}

	items := make([]string, 0, 4)
	if preparation.BridgeConversionSummary != nil && preparation.BridgeConversionSummary.BridgeNextStep != nil {
		items = append(items, firstNonBlank(preparation.BridgeConversionSummary.BridgeNextStep.Reason, preparation.BridgeConversionSummary.BridgeNextStep.ActionHint))
	}
	if len(preparation.MissingFields) > 0 {
		items = append(items, fmt.Sprintf("当前仍缺少：%s。", strings.Join(mapPreparationFieldLabels(preparation.MissingFields), "、")))
	} else {
		items = append(items, "施工报价基础已齐备，可以继续选择施工主体并推进正式施工报价。")
	}
	if preparation.BridgeConversionSummary != nil && preparation.BridgeConversionSummary.ResponsibilityBoundarySummary != nil && len(preparation.BridgeConversionSummary.ResponsibilityBoundarySummary.Items) > 0 {
		items = append(items, fmt.Sprintf("%s：%s", firstNonBlank(preparation.BridgeConversionSummary.ResponsibilityBoundarySummary.Title, "责任边界"), strings.Join(preparation.BridgeConversionSummary.ResponsibilityBoundarySummary.Items, "；")))
	}
	if preparation.BridgeConversionSummary != nil && preparation.BridgeConversionSummary.ScheduleAndAcceptanceSummary != nil && len(preparation.BridgeConversionSummary.ScheduleAndAcceptanceSummary.Items) > 0 {
		items = append(items, fmt.Sprintf("%s：%s", firstNonBlank(preparation.BridgeConversionSummary.ScheduleAndAcceptanceSummary.Title, "工期与验收"), strings.Join(preparation.BridgeConversionSummary.ScheduleAndAcceptanceSummary.Items, "；")))
	}
	return trimExplainers(items)
}

func mapPreparationFieldLabels(missingFields []string) []string {
	labels := map[string]string{
		"area":              "面积",
		"layout":            "户型",
		"renovationType":    "装修类型",
		"constructionScope": "施工范围",
		"serviceAreas":      "施工区域",
		"houseUsage":        "房屋用途",
		"quantityItems":     "施工基线清单",
	}
	result := make([]string, 0, len(missingFields))
	for _, field := range missingFields {
		key := strings.TrimSpace(field)
		if key == "" {
			continue
		}
		result = append(result, firstNonBlank(labels[key], key))
	}
	return uniqueStringSlice(result)
}

func (s *QuoteService) buildPreparationTemplateStateWithDB(
	db *gorm.DB,
	quoteList *model.QuoteList,
	snapshot QuoteTaskPrerequisiteSnapshot,
	quantityItems []model.QuantityBaseItem,
	includeSuggestions bool,
) (*quotePreparationTemplateState, error) {
	state := &quotePreparationTemplateState{
		Sections:             []MerchantTemplateSection{},
		MissingRequiredNames: []string{},
	}
	templateResolved, err := s.resolvePreparationTemplateWithDB(db, quoteList, snapshot)
	if err != nil {
		if errors.Is(err, errNoAvailablePreparationLibraryItems) {
			state.TemplateError = err.Error()
			return state, nil
		}
		return nil, err
	}
	if templateResolved == nil || templateResolved.Template == nil || len(templateResolved.Items) == 0 {
		state.TemplateError = errNoAvailablePreparationLibraryItems.Error()
		return state, nil
	}
	state.TemplateID = templateResolved.Template.ID

	if quantityItems == nil && quoteList != nil && quoteList.QuantityBaseID > 0 {
		_ = db.Where("quantity_base_id = ?", quoteList.QuantityBaseID).Order("sort_order ASC, id ASC").Find(&quantityItems).Error
	}

	existingByStandardID := make(map[uint64]model.QuantityBaseItem, len(quantityItems))
	for _, item := range quantityItems {
		standardID := item.StandardItemID
		if standardID == 0 {
			standardID = s.matchStandardItemIDForQuantityBaseItemTx(db, &item)
		}
		if standardID == 0 {
			continue
		}
		if _, exists := existingByStandardID[standardID]; exists {
			continue
		}
		existingByStandardID[standardID] = item
	}
	existingQuoteItemsByStandardID := make(map[uint64]model.QuoteListItem)
	if quoteList != nil && quoteList.ID > 0 {
		var quoteItems []model.QuoteListItem
		_ = db.Where("quote_list_id = ?", quoteList.ID).Order("sort_order ASC, id ASC").Find(&quoteItems).Error
		for _, item := range quoteItems {
			standardID := item.StandardItemID
			if standardID == 0 {
				standardID = item.MatchedStandardItemID
			}
			if standardID == 0 || item.Quantity <= 0 {
				continue
			}
			if _, exists := existingQuoteItemsByStandardID[standardID]; exists {
				continue
			}
			existingQuoteItemsByStandardID[standardID] = item
		}
	}

	type sectionIndexEntry struct {
		index int
	}
	sectionIndexes := make(map[string]sectionIndexEntry)
	sectionSortOrder := make(map[string]int)
	filteredTemplateItems := filterPreparationTemplateItemsByConstructionScope(
		templateResolved.Items,
		templateResolved.LibraryByID,
		snapshot.ConstructionScope,
	)

	for _, templateItem := range filteredTemplateItems {
		libraryItem, exists := templateResolved.LibraryByID[templateItem.LibraryItemID]
		if !exists {
			continue
		}
		categoryTitle := strings.TrimSpace(firstNonBlank(libraryItem.CategoryL1, "未分类"))
		if _, exists := sectionIndexes[categoryTitle]; !exists {
			sectionIndexes[categoryTitle] = sectionIndexEntry{index: len(state.Sections)}
			sectionSortOrder[categoryTitle] = templateItem.SortOrder
			state.Sections = append(state.Sections, MerchantTemplateSection{
				Key:   categoryTitle,
				Title: categoryTitle,
				Rows:  []MerchantTemplateRowInput{},
			})
		}
		row := MerchantTemplateRowInput{
			StandardItemID: templateItem.LibraryItemID,
			StandardCode:   strings.TrimSpace(firstNonBlank(libraryItem.StandardCode, libraryItem.ERPItemCode)),
			Name:           strings.TrimSpace(libraryItem.Name),
			Unit:           strings.TrimSpace(firstNonBlank(libraryItem.Unit, "项")),
			CategoryL1:     strings.TrimSpace(libraryItem.CategoryL1),
			CategoryL2:     strings.TrimSpace(libraryItem.CategoryL2),
			Required:       templateItem.Required,
			Applicable:     true,
		}
		hasEffectiveInput := false
		if existing, exists := existingByStandardID[templateItem.LibraryItemID]; exists {
			row.InputQuantity = roundQuantityByUnit(existing.Quantity, row.Unit)
			row.BaselineNote = strings.TrimSpace(existing.BaselineNote)
			hasEffectiveInput = row.InputQuantity > 0
		} else if existing, exists := existingQuoteItemsByStandardID[templateItem.LibraryItemID]; exists {
			row.InputQuantity = roundQuantityByUnit(existing.Quantity, row.Unit)
			row.BaselineNote = strings.TrimSpace(existing.PricingNote)
			hasEffectiveInput = row.InputQuantity > 0
		} else if includeSuggestions {
			if suggestedQuantity := suggestPreparationQuantity(libraryItem, snapshot); suggestedQuantity > 0 {
				row.SuggestedQuantity = suggestedQuantity
			}
		}
		if hasEffectiveInput {
			state.EffectiveItemCount++
		} else if templateItem.Required {
			state.MissingRequiredNames = append(state.MissingRequiredNames, row.Name)
		}
		section := &state.Sections[sectionIndexes[categoryTitle].index]
		section.Rows = append(section.Rows, row)
	}

	for idx := range state.Sections {
		rows := state.Sections[idx].Rows
		sort.SliceStable(rows, func(i, j int) bool {
			if rows[i].Required != rows[j].Required {
				return rows[i].Required
			}
			return rows[i].Name < rows[j].Name
		})
		state.Sections[idx].Rows = rows
	}
	sort.SliceStable(state.Sections, func(i, j int) bool {
		return sectionSortOrder[state.Sections[i].Key] < sectionSortOrder[state.Sections[j].Key]
	})
	state.MissingRequiredNames = uniqueStringSlice(state.MissingRequiredNames)
	return state, nil
}

func filterPreparationTemplateItemsByConstructionScope(
	items []model.QuoteTemplateItem,
	libraryByID map[uint64]model.QuoteLibraryItem,
	rawScope string,
) []model.QuoteTemplateItem {
	scopeValues := normalizeConstructionScopeValues(rawScope)
	if len(scopeValues) == 0 {
		return []model.QuoteTemplateItem{}
	}
	filtered := make([]model.QuoteTemplateItem, 0, len(items))
	for _, item := range items {
		libraryItem, exists := libraryByID[item.LibraryItemID]
		if !exists {
			continue
		}
		if quoteLibraryItemMatchesConstructionScopes(libraryItem, scopeValues) {
			filtered = append(filtered, item)
		}
	}
	return filtered
}

func normalizeConstructionScopeValues(raw string) []string {
	normalized := normalizeConstructionScopeText(raw)
	if normalized == "" {
		return nil
	}
	parts := strings.Split(normalized, "、")
	values := make([]string, 0, len(parts))
	for _, part := range parts {
		if trimmed := strings.TrimSpace(part); trimmed != "" {
			values = append(values, trimmed)
		}
	}
	return uniqueStringSlice(values)
}

func quoteLibraryItemMatchesConstructionScopes(item model.QuoteLibraryItem, scopes []string) bool {
	if len(scopes) == 0 {
		return false
	}
	itemScopes := deriveConstructionScopesForQuoteItem(item)
	for _, scope := range scopes {
		if slices.Contains(itemScopes, scope) {
			return true
		}
	}
	return false
}

func deriveConstructionScopesForQuoteItem(item model.QuoteLibraryItem) []string {
	searchText := strings.ToLower(strings.Join([]string{
		strings.TrimSpace(item.CategoryL1),
		strings.TrimSpace(item.CategoryL2),
		strings.TrimSpace(item.Name),
	}, " "))
	scopes := make([]string, 0, 3)
	add := func(scope string) {
		if scope == "" || slices.Contains(scopes, scope) {
			return
		}
		scopes = append(scopes, scope)
	}

	if containsAnyKeyword(searchText, "拆改", "拆除", "拆旧", "铲除", "开槽", "新建墙", "砌墙", "打拆") {
		add("拆改")
	}
	if containsAnyKeyword(searchText, "清运", "保洁", "垃圾", "外运", "成品保护", "清理") {
		add("清运保洁")
	}
	if containsAnyKeyword(searchText, "安装", "洁具", "卫浴", "灯具", "开关", "面板", "五金", "门锁", "厨电", "门窗", "橱柜") {
		add("安装")
	}
	if containsAnyKeyword(searchText, "防水") {
		add("防水")
	}
	if containsAnyKeyword(searchText, "水电", "电路", "强电", "弱电", "给排水", "管道", "水路") {
		add("水电")
	}
	if containsAnyKeyword(searchText, "油工", "油漆", "乳胶漆", "腻子", "刷漆", "壁纸", "墙面拉毛", "修补找补") {
		add("油工")
	}
	if containsAnyKeyword(searchText, "木作", "木工", "吊顶", "吊平顶", "隔墙", "基层板", "柜体", "窗帘盒", "石膏板") {
		add("木作")
	}
	if containsAnyKeyword(searchText, "泥瓦", "瓦工", "墙砖", "地砖", "砌筑", "抹灰", "包管", "石材", "自流平", "地面找平", "找平层", "水泥砂浆") {
		add("泥瓦")
	}
	return scopes
}

func (s *QuoteService) resolvePreparationTemplateWithDB(
	db *gorm.DB,
	quoteList *model.QuoteList,
	snapshot QuoteTaskPrerequisiteSnapshot,
) (*quotePreparationTemplateResolved, error) {
	template, _, _, err := s.ensurePreparationTemplateModelWithDB(
		db,
		parseRoomType(snapshot.Layout),
		strings.TrimSpace(snapshot.RenovationType),
		false,
	)
	if err != nil || template == nil {
		return nil, err
	}
	return s.loadPreparationTemplateResolvedWithDB(db, template)
}

func (s *QuoteService) findPreparationTemplateWithDB(db *gorm.DB, snapshot QuoteTaskPrerequisiteSnapshot) (*model.QuoteTemplate, error) {
	renovationType := strings.TrimSpace(snapshot.RenovationType)
	roomType := strings.TrimSpace(parseRoomType(snapshot.Layout))

	candidates := []struct {
		roomType       string
		renovationType string
	}{
		{roomType: roomType, renovationType: renovationType},
		{roomType: "", renovationType: renovationType},
		{roomType: "", renovationType: ""},
	}
	seen := make(map[string]struct{}, len(candidates))
	for _, candidate := range candidates {
		key := candidate.roomType + "|" + candidate.renovationType
		if _, exists := seen[key]; exists {
			continue
		}
		seen[key] = struct{}{}
		template, err := s.findPreparationTemplateByBucketWithDB(db, candidate.roomType, candidate.renovationType)
		if err != nil {
			return nil, err
		}
		if template != nil {
			return template, nil
		}
	}
	return nil, nil
}

func (s *QuoteService) findPreparationTemplateByBucketWithDB(db *gorm.DB, roomType, renovationType string) (*model.QuoteTemplate, error) {
	query := db.Model(&model.QuoteTemplate{}).Where("status = ?", 1)
	if strings.TrimSpace(roomType) != "" {
		query = query.Where("room_type = ?", strings.TrimSpace(roomType))
	} else {
		query = query.Where("COALESCE(room_type, '') = ''")
	}
	if strings.TrimSpace(renovationType) != "" {
		query = query.Where("renovation_type = ?", strings.TrimSpace(renovationType))
	} else {
		query = query.Where("COALESCE(renovation_type, '') = ''")
	}
	var template model.QuoteTemplate
	if err := query.Order("id DESC").First(&template).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, fmt.Errorf("查询施工报价模板失败: %w", err)
	}
	return &template, nil
}

func (s *QuoteService) ensurePreparationTemplateModelWithDB(
	db *gorm.DB,
	roomType, renovationType string,
	forceRepair bool,
) (*model.QuoteTemplate, bool, bool, error) {
	roomType = strings.TrimSpace(roomType)
	renovationType = strings.TrimSpace(renovationType)

	template, err := s.findPreparationTemplateByBucketWithDB(db, roomType, renovationType)
	if err != nil {
		return nil, false, false, err
	}
	created := false
	repaired := false
	if template == nil {
		template, err = s.createAutoPreparationTemplateWithDB(db, roomType, renovationType)
		if err != nil {
			return nil, false, false, err
		}
		created = true
	}

	needsRepair, err := s.preparationTemplateNeedsRepairWithDB(db, template.ID)
	if err != nil {
		return nil, created, false, err
	}
	if forceRepair || needsRepair {
		if err := s.rebuildPreparationTemplateItemsWithDB(db, template.ID); err != nil {
			return nil, created, false, err
		}
		repaired = true
	}
	return template, created, repaired, nil
}

func (s *QuoteService) createAutoPreparationTemplateWithDB(
	db *gorm.DB,
	roomType, renovationType string,
) (*model.QuoteTemplate, error) {
	enabledItems, err := s.listEnabledPreparationLibraryItemsWithDB(db)
	if err != nil {
		return nil, err
	}
	if len(enabledItems) == 0 {
		return nil, errNoAvailablePreparationLibraryItems
	}

	var template model.QuoteTemplate
	err = db.Transaction(func(tx *gorm.DB) error {
		existing, findErr := s.findPreparationTemplateByBucketWithDB(tx, roomType, renovationType)
		if findErr != nil {
			return findErr
		}
		if existing != nil {
			template = *existing
			return nil
		}

		template = model.QuoteTemplate{
			Name:           buildAutoPreparationTemplateName(roomType, renovationType),
			RoomType:       roomType,
			RenovationType: renovationType,
			Description:    "系统根据标准项库自动生成，可在后台调整",
			Status:         1,
		}
		if err := tx.Create(&template).Error; err != nil {
			return fmt.Errorf("创建施工报价模板失败: %w", err)
		}
		return s.replacePreparationTemplateItemsWithDB(tx, template.ID, enabledItems)
	})
	if err != nil {
		return nil, err
	}
	return &template, nil
}

func (s *QuoteService) rebuildPreparationTemplateItemsWithDB(db *gorm.DB, templateID uint64) error {
	if templateID == 0 {
		return errors.New("施工报价模板不存在")
	}
	enabledItems, err := s.listEnabledPreparationLibraryItemsWithDB(db)
	if err != nil {
		return err
	}
	if len(enabledItems) == 0 {
		return errNoAvailablePreparationLibraryItems
	}
	return db.Transaction(func(tx *gorm.DB) error {
		return s.replacePreparationTemplateItemsWithDB(tx, templateID, enabledItems)
	})
}

func (s *QuoteService) replacePreparationTemplateItemsWithDB(
	db *gorm.DB,
	templateID uint64,
	libraryItems []model.QuoteLibraryItem,
) error {
	if err := db.Where("template_id = ?", templateID).Delete(&model.QuoteTemplateItem{}).Error; err != nil {
		return fmt.Errorf("重置施工报价模板项目失败: %w", err)
	}
	for index, item := range libraryItems {
		row := model.QuoteTemplateItem{
			TemplateID:      templateID,
			LibraryItemID:   item.ID,
			DefaultQuantity: 0,
			SortOrder:       index + 1,
			Required:        parseQuoteRequiredFlag(item.ExtensionsJSON),
		}
		if err := db.Create(&row).Error; err != nil {
			return fmt.Errorf("写入施工报价模板项目失败: %w", err)
		}
	}
	return nil
}

func (s *QuoteService) listEnabledPreparationLibraryItemsWithDB(db *gorm.DB) ([]model.QuoteLibraryItem, error) {
	var libraryItems []model.QuoteLibraryItem
	if err := db.
		Where("status = ?", model.QuoteLibraryItemStatusEnabled).
		Order("category_l1 ASC, category_l2 ASC, id ASC").
		Find(&libraryItems).Error; err != nil {
		return nil, fmt.Errorf("查询施工标准项失败: %w", err)
	}
	return libraryItems, nil
}

func (s *QuoteService) preparationTemplateNeedsRepairWithDB(db *gorm.DB, templateID uint64) (bool, error) {
	if templateID == 0 {
		return true, nil
	}
	var templateItems []model.QuoteTemplateItem
	if err := db.Where("template_id = ?", templateID).Find(&templateItems).Error; err != nil {
		return false, fmt.Errorf("查询施工报价模板失败: %w", err)
	}
	if len(templateItems) == 0 {
		return true, nil
	}
	libraryIDs := make([]uint64, 0, len(templateItems))
	for _, item := range templateItems {
		if item.LibraryItemID > 0 {
			libraryIDs = append(libraryIDs, item.LibraryItemID)
		}
	}
	if len(libraryIDs) == 0 {
		return true, nil
	}
	var count int64
	if err := db.Model(&model.QuoteLibraryItem{}).
		Where("id IN ? AND status = ?", libraryIDs, model.QuoteLibraryItemStatusEnabled).
		Count(&count).Error; err != nil {
		return false, fmt.Errorf("查询施工标准项失败: %w", err)
	}
	return count != int64(len(libraryIDs)), nil
}

func (s *QuoteService) loadPreparationTemplateResolvedWithDB(
	db *gorm.DB,
	template *model.QuoteTemplate,
) (*quotePreparationTemplateResolved, error) {
	if template == nil {
		return nil, nil
	}
	var templateItems []model.QuoteTemplateItem
	if err := db.Where("template_id = ?", template.ID).Order("sort_order ASC, id ASC").Find(&templateItems).Error; err != nil {
		return nil, fmt.Errorf("查询施工报价模板失败: %w", err)
	}
	if len(templateItems) == 0 {
		return nil, nil
	}
	libraryIDs := make([]uint64, 0, len(templateItems))
	for _, item := range templateItems {
		if item.LibraryItemID > 0 {
			libraryIDs = append(libraryIDs, item.LibraryItemID)
		}
	}
	var libraryItems []model.QuoteLibraryItem
	if len(libraryIDs) > 0 {
		if err := db.Where("id IN ? AND status = ?", libraryIDs, model.QuoteLibraryItemStatusEnabled).Find(&libraryItems).Error; err != nil {
			return nil, fmt.Errorf("查询施工标准项失败: %w", err)
		}
	}
	libraryByID := make(map[uint64]model.QuoteLibraryItem, len(libraryItems))
	for _, libraryItem := range libraryItems {
		libraryByID[libraryItem.ID] = libraryItem
	}
	requiredByStandard := make(map[uint64]bool, len(templateItems))
	validItems := make([]model.QuoteTemplateItem, 0, len(templateItems))
	for _, item := range templateItems {
		if _, exists := libraryByID[item.LibraryItemID]; !exists {
			continue
		}
		requiredByStandard[item.LibraryItemID] = item.Required
		validItems = append(validItems, item)
	}
	if len(validItems) == 0 {
		return nil, nil
	}
	return &quotePreparationTemplateResolved{
		Template:           template,
		Items:              validItems,
		LibraryByID:        libraryByID,
		RequiredByStandard: requiredByStandard,
	}, nil
}

func buildAutoPreparationTemplateName(roomType, renovationType string) string {
	return "自动模板｜" + firstNonBlank(strings.TrimSpace(renovationType), "通用") + "｜" + firstNonBlank(strings.TrimSpace(roomType), "通用户型")
}

func unitCategory(unit string) string {
	switch strings.TrimSpace(unit) {
	case "m", "米", "延米", "㎡", "m²", "平米", "平方":
		return "continuous"
	case "个", "处", "项", "套", "樘", "扇", "组":
		return "count"
	default:
		return "other"
	}
}

func roundQuantityByUnit(value float64, unit string) float64 {
	if value < 0 {
		return 0
	}
	if value == 0 {
		return 0
	}
	switch unitCategory(unit) {
	case "continuous":
		return math.Round(value*2) / 2
	case "count":
		return math.Round(value)
	default:
		return math.Round(value*100) / 100
	}
}

func roundPreparationQuantity(value float64) float64 {
	return roundQuantityByUnit(value, "other")
}

func suggestPreparationQuantity(libraryItem model.QuoteLibraryItem, snapshot QuoteTaskPrerequisiteSnapshot) float64 {
	raw := strings.TrimSpace(libraryItem.QuantityFormulaJSON)
	if raw != "" && raw != "{}" {
		var formula QuantityFormula
		if err := json.Unmarshal([]byte(raw), &formula); err == nil && formula.Type != "" {
			var suggested float64
			switch formula.Type {
			case "area_multiplier":
				suggested = snapshot.Area * formula.Factor
			case "fixed_by_room_type":
				roomType := parseRoomType(snapshot.Layout)
				suggested = formula.Values[roomType]
			case "perimeter":
				if snapshot.Area > 0 {
					side := math.Sqrt(snapshot.Area)
					suggested = side * 4 * formula.Factor
				}
			case "fixed":
				suggested = formula.Factor
			}
			if suggested > 0 {
				return roundQuantityByUnit(suggested, libraryItem.Unit)
			}
		}
	}
	return suggestPreparationQuantityByHeuristic(libraryItem, snapshot)
}

func suggestPreparationQuantityByHeuristic(libraryItem model.QuoteLibraryItem, snapshot QuoteTaskPrerequisiteSnapshot) float64 {
	if snapshot.Area <= 0 {
		return 0
	}
	searchText := strings.ToLower(strings.Join([]string{
		strings.TrimSpace(libraryItem.CategoryL1),
		strings.TrimSpace(libraryItem.CategoryL2),
		strings.TrimSpace(libraryItem.Name),
	}, " "))
	scopes := deriveConstructionScopesForQuoteItem(libraryItem)
	hasScope := func(scope string) bool {
		return slices.Contains(scopes, scope)
	}
	unit := strings.ToLower(strings.TrimSpace(firstNonBlank(libraryItem.Unit, "项")))
	area := snapshot.Area
	perimeter := math.Sqrt(area) * 4
	roomCount := guessRoomCountFromLayout(snapshot.Layout)

	switch unit {
	case "㎡", "m²", "m2", "平米", "平方":
		switch {
		case hasScope("防水"):
			return roundQuantityByUnit(area*1.2, libraryItem.Unit)
		case hasScope("油工"):
			if containsAnyKeyword(searchText, "基层处理", "腻子", "乳胶漆", "墙面") {
				return roundQuantityByUnit(area*2.8, libraryItem.Unit)
			}
			return roundQuantityByUnit(area*1.6, libraryItem.Unit)
		case hasScope("木作"):
			if containsAnyKeyword(searchText, "吊顶", "吊平顶", "石膏板") {
				return roundQuantityByUnit(area*0.28, libraryItem.Unit)
			}
			return roundQuantityByUnit(area*0.18, libraryItem.Unit)
		case hasScope("泥瓦"):
			switch {
			case containsAnyKeyword(searchText, "墙砖"):
				return roundQuantityByUnit(area*1.15, libraryItem.Unit)
			case containsAnyKeyword(searchText, "地砖"):
				return roundQuantityByUnit(area*0.9, libraryItem.Unit)
			case containsAnyKeyword(searchText, "找平", "自流平"):
				return roundQuantityByUnit(area*0.35, libraryItem.Unit)
			case containsAnyKeyword(searchText, "石材"):
				return roundQuantityByUnit(area*0.22, libraryItem.Unit)
			default:
				return roundQuantityByUnit(area*0.6, libraryItem.Unit)
			}
		case hasScope("水电"):
			return roundQuantityByUnit(area*0.35, libraryItem.Unit)
		}
	case "m", "米", "延米":
		switch {
		case hasScope("水电"):
			return roundQuantityByUnit(perimeter*0.45, libraryItem.Unit)
		case hasScope("木作") && containsAnyKeyword(searchText, "线", "石膏线", "窗帘盒"):
			return roundQuantityByUnit(perimeter*0.6, libraryItem.Unit)
		case hasScope("泥瓦") && containsAnyKeyword(searchText, "踢脚", "收边", "包管"):
			return roundQuantityByUnit(perimeter*0.3, libraryItem.Unit)
		}
	case "项", "套", "个", "处", "樘", "扇", "组":
		switch {
		case containsAnyKeyword(searchText, "灯具", "面板", "洁具", "卫浴", "厨电"):
			return roundQuantityByUnit(roomCount, libraryItem.Unit)
		case containsAnyKeyword(searchText, "窗帘盒", "吊顶", "地台"):
			return 1
		default:
			return 1
		}
	}
	return 0
}

func guessRoomCountFromLayout(layout string) float64 {
	switch parseRoomType(layout) {
	case "一居":
		return 1
	case "二居":
		return 2
	case "三居":
		return 3
	case "四居":
		return 4
	case "五居":
		return 5
	case "六居":
		return 6
	default:
		return 1
	}
}

func (s *QuoteService) syncQuoteListItemsFromQuantityBase(quoteList *model.QuoteList) error {
	tx := repository.DB.Begin()
	if tx.Error != nil {
		return fmt.Errorf("开启事务失败: %w", tx.Error)
	}
	if err := s.syncQuoteListItemsFromQuantityBaseTx(tx, quoteList); err != nil {
		tx.Rollback()
		return err
	}
	if err := tx.Commit().Error; err != nil {
		return fmt.Errorf("同步施工报价明细失败: %w", err)
	}
	return nil
}

func (s *QuoteService) syncQuoteListItemsFromQuantityBaseTx(tx *gorm.DB, quoteList *model.QuoteList) error {
	if quoteList == nil || quoteList.QuantityBaseID == 0 {
		return nil
	}

	var baseItems []model.QuantityBaseItem
	if err := tx.Where("quantity_base_id = ?", quoteList.QuantityBaseID).Order("sort_order ASC, id ASC").Find(&baseItems).Error; err != nil {
		return fmt.Errorf("查询施工基线失败: %w", err)
	}

	var existing []model.QuoteListItem
	if err := tx.Where("quote_list_id = ?", quoteList.ID).Find(&existing).Error; err != nil {
		return fmt.Errorf("查询报价明细失败: %w", err)
	}
	existingByBaseID := make(map[uint64]model.QuoteListItem, len(existing))
	for _, item := range existing {
		if item.QuantityBaseItemID > 0 {
			existingByBaseID[item.QuantityBaseItemID] = item
		}
	}

	snapshot, err := s.getPrerequisiteSnapshot(quoteList)
	if err != nil {
		return err
	}
	templateResolved, err := s.resolvePreparationTemplateWithDB(tx, quoteList, snapshot)
	if err != nil && !errors.Is(err, errNoAvailablePreparationLibraryItems) {
		return err
	}
	requiredByStandardID := make(map[uint64]bool)
	if templateResolved != nil {
		requiredByStandardID = templateResolved.RequiredByStandard
	}

	keepBaseIDs := make([]uint64, 0, len(baseItems))
	for idx, item := range baseItems {
		keepBaseIDs = append(keepBaseIDs, item.ID)
		standardItemID := item.StandardItemID
		matchedStandardID := uint64(0)
		if standardItemID == 0 {
			matchedStandardID = s.matchStandardItemIDForQuantityBaseItemTx(tx, &item)
		}
		requiredStandardID := standardItemID
		if requiredStandardID == 0 {
			requiredStandardID = matchedStandardID
		}
		extensionsJSON := ""
		if requiredByStandardID[requiredStandardID] {
			extensionsJSON = setQuoteRequiredFlag(extensionsJSON, true)
		}
		updates := map[string]interface{}{
			"source_type":              model.QuoteListItemSourceTypeGenerated,
			"standard_item_id":         standardItemID,
			"matched_standard_item_id": matchedStandardID,
			"name":                     strings.TrimSpace(item.SourceItemName),
			"unit":                     strings.TrimSpace(firstNonBlank(item.Unit, "项")),
			"quantity":                 item.Quantity,
			"pricing_note":             strings.TrimSpace(item.BaselineNote),
			"category_l1":              strings.TrimSpace(item.CategoryL1),
			"category_l2":              strings.TrimSpace(item.CategoryL2),
			"sort_order":               sortOrderOrDefault(item.SortOrder, idx+1),
			"missing_mapping_flag":     standardItemID == 0 && matchedStandardID == 0,
			"extensions_json":          extensionsJSON,
		}

		if current, ok := existingByBaseID[item.ID]; ok {
			if err := tx.Model(&current).Updates(updates).Error; err != nil {
				return fmt.Errorf("更新报价明细失败: %w", err)
			}
			continue
		}

		row := model.QuoteListItem{
			QuoteListID:           quoteList.ID,
			StandardItemID:        standardItemID,
			QuantityBaseItemID:    item.ID,
			SourceType:            model.QuoteListItemSourceTypeGenerated,
			MatchedStandardItemID: matchedStandardID,
			Name:                  strings.TrimSpace(item.SourceItemName),
			Unit:                  strings.TrimSpace(firstNonBlank(item.Unit, "项")),
			Quantity:              item.Quantity,
			PricingNote:           strings.TrimSpace(item.BaselineNote),
			CategoryL1:            strings.TrimSpace(item.CategoryL1),
			CategoryL2:            strings.TrimSpace(item.CategoryL2),
			SortOrder:             sortOrderOrDefault(item.SortOrder, idx+1),
			MissingMappingFlag:    standardItemID == 0 && matchedStandardID == 0,
			ExtensionsJSON:        extensionsJSON,
		}
		if err := tx.Create(&row).Error; err != nil {
			return fmt.Errorf("创建报价明细失败: %w", err)
		}
	}

	query := tx.Where("quote_list_id = ?", quoteList.ID)
	if len(keepBaseIDs) > 0 {
		query = query.Where("quantity_base_item_id NOT IN ?", keepBaseIDs)
	}
	if err := query.Delete(&model.QuoteListItem{}).Error; err != nil {
		return fmt.Errorf("清理过期报价明细失败: %w", err)
	}
	return nil
}

func (s *QuoteService) matchStandardItemIDForQuantityBaseItemTx(tx *gorm.DB, item *model.QuantityBaseItem) uint64 {
	if item == nil {
		return 0
	}
	if code := strings.TrimSpace(item.SourceItemCode); code != "" {
		var matched model.QuoteLibraryItem
		err := tx.
			Where("status = ?", model.QuoteLibraryItemStatusEnabled).
			Where("standard_code = ? OR erp_item_code = ?", code, code).
			Order("id ASC").
			First(&matched).Error
		if err == nil {
			return matched.ID
		}
	}

	name := strings.TrimSpace(item.SourceItemName)
	if name == "" {
		return 0
	}

	var matched model.QuoteLibraryItem
	query := tx.Where("status = ?", model.QuoteLibraryItemStatusEnabled).Where("name = ?", name)
	if categoryL1 := strings.TrimSpace(item.CategoryL1); categoryL1 != "" {
		query = query.Where("category_l1 = ? OR category_l2 = ?", categoryL1, categoryL1)
	}
	if err := query.Order("id ASC").First(&matched).Error; err == nil {
		return matched.ID
	}

	if unit := strings.TrimSpace(item.Unit); unit != "" {
		if err := tx.
			Where("status = ?", model.QuoteLibraryItemStatusEnabled).
			Where("name = ? AND unit = ?", name, unit).
			Order("id ASC").
			First(&matched).Error; err == nil {
			return matched.ID
		}
	}
	return 0
}

func (s *QuoteService) getMerchantDesignerQuoteTask(providerID, quoteListID uint64) (*model.QuoteList, error) {
	if quoteListID == 0 || providerID == 0 {
		return nil, errors.New("报价任务不存在")
	}
	var quoteList model.QuoteList
	if err := repository.DB.First(&quoteList, quoteListID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("报价任务不存在")
		}
		return nil, fmt.Errorf("查询报价任务失败: %w", err)
	}
	if quoteList.DesignerProviderID != providerID {
		return nil, errors.New("无权操作该施工报价任务")
	}
	return &quoteList, nil
}

func (s *QuoteService) getMerchantEditableDesignerQuoteTask(providerID, quoteListID uint64) (*model.QuoteList, error) {
	quoteList, err := s.getMerchantDesignerQuoteTask(providerID, quoteListID)
	if err != nil {
		return nil, err
	}
	switch quoteList.Status {
	case model.QuoteListStatusDraft, model.QuoteListStatusReadyForSelection:
		return quoteList, nil
	default:
		return nil, fmt.Errorf("当前施工报价状态不可编辑: %s", quoteList.Status)
	}
}

func sortOrderOrDefault(value, fallback int) int {
	if value > 0 {
		return value
	}
	return fallback
}

func uniqueStringSlice(values []string) []string {
	if len(values) == 0 {
		return []string{}
	}
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
