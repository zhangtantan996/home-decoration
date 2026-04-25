package service

import (
	"errors"
	"fmt"
	"math"
	"strings"
	"time"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"

	"gorm.io/gorm"
)

const QuoteListSourceTypeLegacyQuotePKRebuild = "legacy_quote_pk_rebuild"

type LegacyQuotePKRebuildInput struct {
	LegacyTaskID   uint64 `json:"legacyTaskId"`
	QuantityBaseID uint64 `json:"quantityBaseId"`
	TemplateID     uint64 `json:"templateId"`
	Title          string `json:"title"`
}

type LegacyQuotePKRebuildResult struct {
	QuoteListID uint64 `json:"quoteListId"`
	Created     bool   `json:"created"`
}

type QuoteTruthSummary struct {
	QuoteListID         uint64     `json:"quoteListId"`
	SourceType          string     `json:"sourceType,omitempty"`
	SourceID            uint64     `json:"sourceId,omitempty"`
	QuantityBaseID      uint64     `json:"quantityBaseId,omitempty"`
	QuantityBaseVersion int        `json:"quantityBaseVersion,omitempty"`
	ActiveSubmissionID  uint64     `json:"activeSubmissionId,omitempty"`
	AwardedProviderID   uint64     `json:"awardedProviderId,omitempty"`
	ConfirmedAt         *time.Time `json:"confirmedAt,omitempty"`
	TotalCent           int64      `json:"totalCent,omitempty"`
	EstimatedDays       int        `json:"estimatedDays,omitempty"`
	RevisionCount       int64      `json:"revisionCount,omitempty"`
}

type CommercialExplanation struct {
	BaselineSummary        *BridgeQuoteBaselineSummary `json:"baselineSummary,omitempty"`
	ScopeIncluded          []string                    `json:"scopeIncluded,omitempty"`
	ScopeExcluded          []string                    `json:"scopeExcluded,omitempty"`
	TeamSize               int                         `json:"teamSize,omitempty"`
	WorkTypes              []string                    `json:"workTypes,omitempty"`
	ConstructionMethodNote string                      `json:"constructionMethodNote,omitempty"`
	SiteVisitRequired      bool                        `json:"siteVisitRequired,omitempty"`
	PaymentPlanSummary     []QuotePaymentPlanSummary   `json:"paymentPlanSummary,omitempty"`
}

type SubmissionHealthSummary struct {
	MissingPriceCount    int      `json:"missingPriceCount"`
	DeviationItemCount   int      `json:"deviationItemCount"`
	PlatformReviewStatus string   `json:"platformReviewStatus,omitempty"`
	LastRevisionNo       int      `json:"lastRevisionNo,omitempty"`
	LastChangeReason     string   `json:"lastChangeReason,omitempty"`
	CanSubmit            bool     `json:"canSubmit"`
	BlockingReasons      []string `json:"blockingReasons,omitempty"`
}

type ChangeOrderSummary struct {
	TotalCount              int    `json:"totalCount"`
	PendingUserConfirmCount int    `json:"pendingUserConfirmCount"`
	PendingSettlementCount  int    `json:"pendingSettlementCount"`
	SettledCount            int    `json:"settledCount"`
	NetAmountCent           int64  `json:"netAmountCent"`
	LatestChangeOrderID     uint64 `json:"latestChangeOrderId,omitempty"`
}

type SettlementSummary struct {
	LatestSettlementID uint64     `json:"latestSettlementId,omitempty"`
	Status             string     `json:"status,omitempty"`
	GrossAmount        float64    `json:"grossAmount,omitempty"`
	NetAmount          float64    `json:"netAmount,omitempty"`
	TotalGrossAmount   float64    `json:"totalGrossAmount,omitempty"`
	TotalNetAmount     float64    `json:"totalNetAmount,omitempty"`
	SettledAmount      float64    `json:"settledAmount,omitempty"`
	PendingAmount      float64    `json:"pendingAmount,omitempty"`
	FailedAmount       float64    `json:"failedAmount,omitempty"`
	ScheduledAt        *time.Time `json:"scheduledAt,omitempty"`
	PaidAt             *time.Time `json:"paidAt,omitempty"`
}

type PayoutSummary struct {
	LatestPayoutID uint64     `json:"latestPayoutId,omitempty"`
	Status         string     `json:"status,omitempty"`
	Channel        string     `json:"channel,omitempty"`
	TotalAmount    float64    `json:"totalAmount,omitempty"`
	PaidAmount     float64    `json:"paidAmount,omitempty"`
	PendingAmount  float64    `json:"pendingAmount,omitempty"`
	FailedAmount   float64    `json:"failedAmount,omitempty"`
	ScheduledAt    *time.Time `json:"scheduledAt,omitempty"`
	PaidAt         *time.Time `json:"paidAt,omitempty"`
	FailureReason  string     `json:"failureReason,omitempty"`
}

type QuoteRuntimeSummaryBundle struct {
	QuoteTruthSummary      *QuoteTruthSummary       `json:"quoteTruthSummary,omitempty"`
	CommercialExplanation  *CommercialExplanation   `json:"commercialExplanation,omitempty"`
	SubmissionHealth       *SubmissionHealthSummary `json:"submissionHealth,omitempty"`
	ChangeOrderSummary     *ChangeOrderSummary      `json:"changeOrderSummary,omitempty"`
	SettlementSummary      *SettlementSummary       `json:"settlementSummary,omitempty"`
	PayoutSummary          *PayoutSummary           `json:"payoutSummary,omitempty"`
	FinancialClosureStatus string                   `json:"financialClosureStatus,omitempty"`
	NextPendingAction      string                   `json:"nextPendingAction,omitempty"`
}

type ProviderPriceBookInspectionItem struct {
	ProviderID           uint64                             `json:"providerId"`
	ProviderName         string                             `json:"providerName"`
	PriceBookStatus      string                             `json:"priceBookStatus"`
	ActiveVersion        int                                `json:"activeVersion,omitempty"`
	PublishedAt          *time.Time                         `json:"publishedAt,omitempty"`
	CoverageRate         float64                            `json:"coverageRate"`
	ApplicableItemCount  int                                `json:"applicableItemCount"`
	PricedItemCount      int                                `json:"pricedItemCount"`
	MissingRequiredCount int                                `json:"missingRequiredCount"`
	AbnormalPriceCount   int                                `json:"abnormalPriceCount"`
	LastQuotedAt         *time.Time                         `json:"lastQuotedAt,omitempty"`
	GovernanceTier       string                             `json:"governanceTier,omitempty"`
	Issues               []ProviderPriceBookInspectionIssue `json:"issues,omitempty"`
}

type ProviderPriceBookInspectionIssue struct {
	IssueType          string  `json:"issueType"`
	StandardItemID     uint64  `json:"standardItemId"`
	ItemName           string  `json:"itemName"`
	Unit               string  `json:"unit"`
	CategoryL1         string  `json:"categoryL1,omitempty"`
	CategoryL2         string  `json:"categoryL2,omitempty"`
	Required           bool    `json:"required"`
	ReferencePriceCent int64   `json:"referencePriceCent,omitempty"`
	UnitPriceCent      int64   `json:"unitPriceCent,omitempty"`
	DiffRate           float64 `json:"diffRate,omitempty"`
	Reason             string  `json:"reason,omitempty"`
}

func (s *QuoteService) RebuildQuoteListFromLegacy(input *LegacyQuotePKRebuildInput) (*LegacyQuotePKRebuildResult, error) {
	if input == nil {
		return nil, errors.New("重建参数不能为空")
	}
	if input.LegacyTaskID == 0 {
		return nil, errors.New("legacyTaskId 不能为空")
	}
	if input.QuantityBaseID == 0 && input.TemplateID == 0 {
		return nil, errors.New("quantityBaseId 或 templateId 至少提供一个")
	}

	var legacyTask model.QuoteTask
	if err := repository.DB.First(&legacyTask, input.LegacyTaskID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("legacy quote-pk 任务不存在")
		}
		return nil, fmt.Errorf("查询 legacy quote-pk 任务失败: %w", err)
	}

	var existing model.QuoteList
	if err := repository.DB.
		Where("source_type = ? AND source_id = ?", QuoteListSourceTypeLegacyQuotePKRebuild, legacyTask.ID).
		Order("id DESC").
		First(&existing).Error; err == nil {
		return &LegacyQuotePKRebuildResult{QuoteListID: existing.ID, Created: false}, nil
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, fmt.Errorf("查询 legacy 重建报价单失败: %w", err)
	}

	tx := repository.DB.Begin()
	if tx.Error != nil {
		return nil, fmt.Errorf("开启重建事务失败: %w", tx.Error)
	}

	quoteList := &model.QuoteList{
		ProjectID:              legacyTask.ProjectID,
		OwnerUserID:            legacyTask.UserID,
		SourceType:             QuoteListSourceTypeLegacyQuotePKRebuild,
		SourceID:               legacyTask.ID,
		Title:                  strings.TrimSpace(input.Title),
		Status:                 model.QuoteListStatusDraft,
		PrerequisiteStatus:     model.QuoteTaskPrerequisiteDraft,
		UserConfirmationStatus: model.QuoteUserConfirmationPending,
		Currency:               "CNY",
		ScenarioType:           "legacy_quote_pk",
	}
	if quoteList.Title == "" {
		quoteList.Title = fmt.Sprintf("legacy quote-pk 重建 #%d", legacyTask.ID)
	}

	if input.QuantityBaseID > 0 {
		var quantityBase model.QuantityBase
		if err := tx.Select("id", "owner_user_id", "designer_provider_id", "version").First(&quantityBase, input.QuantityBaseID).Error; err != nil {
			tx.Rollback()
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return nil, errors.New("施工基线不存在")
			}
			return nil, fmt.Errorf("查询施工基线失败: %w", err)
		}
		quoteList.QuantityBaseID = quantityBase.ID
		quoteList.QuantityBaseVersion = quantityBase.Version
		if quoteList.OwnerUserID == 0 {
			quoteList.OwnerUserID = quantityBase.OwnerUserID
		}
		quoteList.DesignerProviderID = quantityBase.DesignerProviderID
		quoteList.PrerequisiteStatus = model.QuoteTaskPrerequisiteComplete
	}

	if err := tx.Create(quoteList).Error; err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("创建重建报价单失败: %w", err)
	}

	if input.QuantityBaseID > 0 {
		if err := s.syncQuoteListItemsFromQuantityBaseTx(tx, quoteList); err != nil {
			tx.Rollback()
			return nil, err
		}
	} else if input.TemplateID > 0 {
		if err := s.seedQuoteListItemsFromTemplateTx(tx, quoteList, input.TemplateID); err != nil {
			tx.Rollback()
			return nil, err
		}
	}

	if err := tx.Commit().Error; err != nil {
		return nil, fmt.Errorf("提交 legacy 重建报价单失败: %w", err)
	}
	return &LegacyQuotePKRebuildResult{QuoteListID: quoteList.ID, Created: true}, nil
}

func (s *QuoteService) ListProviderPriceBookInspection(keyword string) ([]ProviderPriceBookInspectionItem, error) {
	keyword = strings.TrimSpace(strings.ToLower(keyword))

	var providers []model.Provider
	if err := repository.DB.
		Where("provider_type IN ? AND status = ?", []int8{2, 3}, 1).
		Order("id DESC").
		Find(&providers).Error; err != nil {
		return nil, fmt.Errorf("查询施工主体失败: %w", err)
	}

	userIDs := make([]uint64, 0, len(providers))
	for _, provider := range providers {
		if provider.UserID > 0 {
			userIDs = append(userIDs, provider.UserID)
		}
	}
	userByID := make(map[uint64]model.User)
	if len(userIDs) > 0 {
		var users []model.User
		if err := repository.DB.Select("id", "nickname", "phone").Where("id IN ?", userIDs).Find(&users).Error; err != nil {
			return nil, fmt.Errorf("查询施工主体账号失败: %w", err)
		}
		for _, user := range users {
			userByID[user.ID] = user
		}
	}

	var enabledLibraryItems []model.QuoteLibraryItem
	if err := repository.DB.Where("status = ?", model.QuoteLibraryItemStatusEnabled).Find(&enabledLibraryItems).Error; err != nil {
		return nil, fmt.Errorf("查询标准项失败: %w", err)
	}
	libraryByID := make(map[uint64]model.QuoteLibraryItem, len(enabledLibraryItems))
	referencePriceByID := make(map[uint64]int64, len(enabledLibraryItems))
	for _, item := range enabledLibraryItems {
		libraryByID[item.ID] = item
		referencePriceByID[item.ID] = item.ReferencePriceCent
	}

	governanceSvc := &ProviderGovernanceService{}
	result := make([]ProviderPriceBookInspectionItem, 0, len(providers))
	for _, provider := range providers {
		displayName := ResolveProviderDisplayName(provider, userRef(userByID[provider.UserID]))
		if keyword != "" {
			searchText := strings.ToLower(strings.TrimSpace(displayName + " " + provider.CompanyName + " " + provider.SubType))
			if !strings.Contains(searchText, keyword) {
				continue
			}
		}

		var book model.QuotePriceBook
		bookStatus := "missing"
		if err := repository.DB.
			Where("provider_id = ?", provider.ID).
			Order("CASE WHEN status = 'active' THEN 0 WHEN status = 'draft' THEN 1 ELSE 2 END, version DESC, id DESC").
			First(&book).Error; err == nil {
			bookStatus = strings.TrimSpace(book.Status)
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf("查询施工主体价格库失败: %w", err)
		}

		providerWorkTypes := parseDelimitedString(provider.WorkTypes)
		applicableItems := make([]model.QuoteLibraryItem, 0, len(enabledLibraryItems))
		requiredIDs := make(map[uint64]struct{})
		for _, libraryItem := range enabledLibraryItems {
			if !isQuoteLibraryItemApplicableToProviderWorkTypes(&libraryItem, providerWorkTypes) {
				continue
			}
			applicableItems = append(applicableItems, libraryItem)
			if parseQuoteRequiredFlag(libraryItem.ExtensionsJSON) {
				requiredIDs[libraryItem.ID] = struct{}{}
			}
		}
		applicableIDs := make(map[uint64]struct{}, len(applicableItems))
		for _, libraryItem := range applicableItems {
			applicableIDs[libraryItem.ID] = struct{}{}
		}

		var priceItems []model.QuotePriceBookItem
		if book.ID > 0 {
			if err := repository.DB.Where("price_book_id = ? AND status = ?", book.ID, model.QuoteLibraryItemStatusEnabled).Find(&priceItems).Error; err != nil {
				return nil, fmt.Errorf("查询施工主体价格库明细失败: %w", err)
			}
		}

		pricedIDs := make(map[uint64]struct{})
		issues := make([]ProviderPriceBookInspectionIssue, 0)
		missingRequiredCount := 0
		abnormalPriceCount := 0
		for _, item := range priceItems {
			if _, ok := applicableIDs[item.StandardItemID]; !ok {
				continue
			}
			if item.UnitPriceCent > 0 {
				pricedIDs[item.StandardItemID] = struct{}{}
			}
			if referencePrice, ok := referencePriceByID[item.StandardItemID]; ok && referencePrice > 0 && item.UnitPriceCent > 0 {
				diffRate := math.Abs(float64(item.UnitPriceCent-referencePrice) / float64(referencePrice))
				if diffRate >= quotePriceReviewThreshold {
					abnormalPriceCount++
					libraryItem := libraryByID[item.StandardItemID]
					issues = append(issues, ProviderPriceBookInspectionIssue{
						IssueType:          "abnormal_price",
						StandardItemID:     item.StandardItemID,
						ItemName:           libraryItem.Name,
						Unit:               firstNonBlank(strings.TrimSpace(item.Unit), libraryItem.Unit),
						CategoryL1:         libraryItem.CategoryL1,
						CategoryL2:         libraryItem.CategoryL2,
						Required:           parseQuoteRequiredFlag(libraryItem.ExtensionsJSON),
						ReferencePriceCent: referencePrice,
						UnitPriceCent:      item.UnitPriceCent,
						DiffRate:           diffRate,
						Reason:             "商家单价与平台参考价偏差超过阈值",
					})
				}
			}
		}
		for requiredID := range requiredIDs {
			if _, ok := pricedIDs[requiredID]; !ok {
				missingRequiredCount++
				libraryItem := libraryByID[requiredID]
				issues = append(issues, ProviderPriceBookInspectionIssue{
					IssueType:          "missing_required",
					StandardItemID:     requiredID,
					ItemName:           libraryItem.Name,
					Unit:               libraryItem.Unit,
					CategoryL1:         libraryItem.CategoryL1,
					CategoryL2:         libraryItem.CategoryL2,
					Required:           true,
					ReferencePriceCent: libraryItem.ReferencePriceCent,
					Reason:             "适用必填标准项尚未维护价格",
				})
			}
		}

		coverageRate := 0.0
		if len(applicableItems) > 0 {
			coverageRate = float64(len(pricedIDs)) / float64(len(applicableItems))
		}

		var lastSubmission model.QuoteSubmission
		var lastQuotedAt *time.Time
		if err := repository.DB.Select("created_at").Where("provider_id = ?", provider.ID).Order("created_at DESC").First(&lastSubmission).Error; err == nil {
			lastQuotedAt = &lastSubmission.CreatedAt
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf("查询施工主体最新报价时间失败: %w", err)
		}

		governanceTier := ""
		if summary := governanceSvc.BuildSummary(provider.ID); summary != nil {
			governanceTier = summary.GovernanceTier
		}

		item := ProviderPriceBookInspectionItem{
			ProviderID:           provider.ID,
			ProviderName:         displayName,
			PriceBookStatus:      bookStatus,
			ActiveVersion:        book.Version,
			CoverageRate:         coverageRate,
			ApplicableItemCount:  len(applicableItems),
			PricedItemCount:      len(pricedIDs),
			MissingRequiredCount: missingRequiredCount,
			AbnormalPriceCount:   abnormalPriceCount,
			LastQuotedAt:         lastQuotedAt,
			GovernanceTier:       governanceTier,
			Issues:               issues,
		}
		if book.ID > 0 {
			item.PublishedAt = firstTimePointer(book.EffectiveFrom, &book.UpdatedAt, &book.CreatedAt)
		}
		result = append(result, item)
	}
	return result, nil
}

func (s *QuoteService) seedQuoteListItemsFromTemplateTx(tx *gorm.DB, quoteList *model.QuoteList, templateID uint64) error {
	if tx == nil {
		return errors.New("事务不能为空")
	}
	if quoteList == nil || quoteList.ID == 0 {
		return errors.New("报价单不存在")
	}
	var templateItems []model.QuoteTemplateItem
	if err := tx.Where("template_id = ?", templateID).Order("sort_order ASC, id ASC").Find(&templateItems).Error; err != nil {
		return fmt.Errorf("查询施工报价模板失败: %w", err)
	}
	if len(templateItems) == 0 {
		return errors.New("施工报价模板不存在有效标准项")
	}
	libraryIDs := make([]uint64, 0, len(templateItems))
	for _, item := range templateItems {
		if item.LibraryItemID > 0 {
			libraryIDs = append(libraryIDs, item.LibraryItemID)
		}
	}
	var libraryItems []model.QuoteLibraryItem
	if err := tx.Where("id IN ? AND status = ?", libraryIDs, model.QuoteLibraryItemStatusEnabled).Find(&libraryItems).Error; err != nil {
		return fmt.Errorf("查询模板标准项失败: %w", err)
	}
	libraryByID := make(map[uint64]model.QuoteLibraryItem, len(libraryItems))
	for _, libraryItem := range libraryItems {
		libraryByID[libraryItem.ID] = libraryItem
	}
	for index, item := range templateItems {
		libraryItem, ok := libraryByID[item.LibraryItemID]
		if !ok {
			continue
		}
		extensionsJSON := ""
		if item.Required {
			extensionsJSON = setQuoteRequiredFlag(extensionsJSON, true)
		}
		row := model.QuoteListItem{
			QuoteListID:        quoteList.ID,
			StandardItemID:     libraryItem.ID,
			SourceType:         model.QuoteListItemSourceTypeGenerated,
			Name:               strings.TrimSpace(libraryItem.Name),
			Unit:               strings.TrimSpace(firstNonBlank(libraryItem.Unit, "项")),
			Quantity:           item.DefaultQuantity,
			PricingNote:        strings.TrimSpace(libraryItem.PricingNote),
			CategoryL1:         strings.TrimSpace(libraryItem.CategoryL1),
			CategoryL2:         strings.TrimSpace(libraryItem.CategoryL2),
			SortOrder:          sortOrderOrDefault(item.SortOrder, index+1),
			MissingMappingFlag: false,
			ExtensionsJSON:     extensionsJSON,
		}
		if err := tx.Create(&row).Error; err != nil {
			return fmt.Errorf("创建模板重建报价明细失败: %w", err)
		}
	}
	return nil
}

func buildQuoteRuntimeSummaryBundleWithDB(db *gorm.DB, quoteList *model.QuoteList, submissionOverride *model.QuoteSubmission) (*QuoteRuntimeSummaryBundle, error) {
	if quoteList == nil {
		return &QuoteRuntimeSummaryBundle{}, nil
	}
	if db == nil {
		db = repository.DB
	}

	submission, err := loadPrimaryQuoteSubmissionWithDB(db, quoteList, submissionOverride)
	if err != nil {
		return nil, err
	}
	var submissionItems []model.QuoteSubmissionItem
	if submission != nil {
		if err := db.Where("quote_submission_id = ?", submission.ID).Order("quote_list_item_id ASC").Find(&submissionItems).Error; err != nil {
			return nil, fmt.Errorf("查询报价提交明细失败: %w", err)
		}
	}

	paymentPlans, err := loadQuotePaymentPlanSummariesWithDB(db, quoteList.ProjectID)
	if err != nil {
		return nil, err
	}
	closureSummary := buildProjectClosureSummaryWithDB(db, quoteList.ProjectID)
	changeOrderSummary, err := buildChangeOrderSummaryWithDB(db, quoteList.ProjectID)
	if err != nil {
		return nil, err
	}
	settlementSummary, payoutSummary, err := buildFinanceRuntimeSummaryWithDB(db, quoteList.ProjectID)
	if err != nil {
		return nil, err
	}

	return &QuoteRuntimeSummaryBundle{
		QuoteTruthSummary:      buildQuoteTruthSummaryWithDB(db, quoteList, submission),
		CommercialExplanation:  buildCommercialExplanation(quoteList, submission, paymentPlans),
		SubmissionHealth:       buildSubmissionHealthSummaryWithDB(db, quoteList, submission, submissionItems),
		ChangeOrderSummary:     changeOrderSummary,
		SettlementSummary:      settlementSummary,
		PayoutSummary:          payoutSummary,
		FinancialClosureStatus: firstNonBlank(summaryField(closureSummary, func(v *ProjectClosureSummary) string { return v.FinancialClosureStatus })),
		NextPendingAction:      firstNonBlank(summaryField(closureSummary, func(v *ProjectClosureSummary) string { return v.NextPendingAction })),
	}, nil
}

func loadProjectQuoteRuntimeSummaryWithDB(db *gorm.DB, project *model.Project) (*QuoteRuntimeSummaryBundle, error) {
	if project == nil {
		return &QuoteRuntimeSummaryBundle{}, nil
	}
	if db == nil {
		db = repository.DB
	}
	quoteList, err := loadQuoteListByProjectWithDB(db, project)
	if err != nil {
		if repository.IsSchemaMismatchError(err) {
			return buildProjectQuoteRuntimeFallbackWithDB(db, project), nil
		}
		return nil, err
	}
	bundle, err := buildQuoteRuntimeSummaryBundleWithDB(db, quoteList, nil)
	if err != nil {
		if repository.IsSchemaMismatchError(err) {
			return buildProjectQuoteRuntimeFallbackWithDB(db, project), nil
		}
		return nil, err
	}
	if bundle.FinancialClosureStatus == "" || bundle.NextPendingAction == "" {
		closureSummary := buildProjectClosureSummaryWithDB(db, project.ID)
		bundle.FinancialClosureStatus = firstNonBlank(bundle.FinancialClosureStatus, summaryField(closureSummary, func(v *ProjectClosureSummary) string { return v.FinancialClosureStatus }))
		bundle.NextPendingAction = firstNonBlank(bundle.NextPendingAction, summaryField(closureSummary, func(v *ProjectClosureSummary) string { return v.NextPendingAction }))
	}
	return bundle, nil
}

func buildProjectQuoteRuntimeFallbackWithDB(db *gorm.DB, project *model.Project) *QuoteRuntimeSummaryBundle {
	bundle := &QuoteRuntimeSummaryBundle{}
	if project == nil {
		return bundle
	}
	closureSummary := buildProjectClosureSummaryWithDB(db, project.ID)
	bundle.FinancialClosureStatus = firstNonBlank(summaryField(closureSummary, func(v *ProjectClosureSummary) string { return v.FinancialClosureStatus }))
	bundle.NextPendingAction = firstNonBlank(summaryField(closureSummary, func(v *ProjectClosureSummary) string { return v.NextPendingAction }))
	return bundle
}

func loadQuoteListByProjectWithDB(db *gorm.DB, project *model.Project) (*model.QuoteList, error) {
	if project == nil || project.ID == 0 {
		return nil, nil
	}
	var quoteList model.QuoteList
	if err := db.Where("project_id = ?", project.ID).Order("user_confirmed_at DESC, id DESC").First(&quoteList).Error; err == nil {
		return &quoteList, nil
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, fmt.Errorf("查询项目关联报价单失败: %w", err)
	}
	if project.SelectedQuoteSubmissionID > 0 {
		var submission model.QuoteSubmission
		if err := db.Select("quote_list_id").First(&submission, project.SelectedQuoteSubmissionID).Error; err == nil && submission.QuoteListID > 0 {
			if err := db.First(&quoteList, submission.QuoteListID).Error; err == nil {
				return &quoteList, nil
			}
		}
	}
	return nil, nil
}

func loadPrimaryQuoteSubmissionWithDB(db *gorm.DB, quoteList *model.QuoteList, submissionOverride *model.QuoteSubmission) (*model.QuoteSubmission, error) {
	if submissionOverride != nil && submissionOverride.ID > 0 {
		return submissionOverride, nil
	}
	if quoteList == nil {
		return nil, nil
	}
	candidates := []uint64{quoteList.ActiveSubmissionID, quoteList.AwardedQuoteSubmissionID}
	for _, submissionID := range candidates {
		if submissionID == 0 {
			continue
		}
		var submission model.QuoteSubmission
		if err := db.First(&submission, submissionID).Error; err == nil {
			return &submission, nil
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf("查询主报价版本失败: %w", err)
		}
	}
	return nil, nil
}

func buildQuoteTruthSummaryWithDB(db *gorm.DB, quoteList *model.QuoteList, submission *model.QuoteSubmission) *QuoteTruthSummary {
	if quoteList == nil {
		return nil
	}
	var revisionCount int64
	if submission != nil {
		_ = db.Model(&model.QuoteSubmissionRevision{}).Where("quote_submission_id = ?", submission.ID).Count(&revisionCount).Error
	}
	summary := &QuoteTruthSummary{
		QuoteListID:         quoteList.ID,
		SourceType:          quoteList.SourceType,
		SourceID:            quoteList.SourceID,
		QuantityBaseID:      quoteList.QuantityBaseID,
		QuantityBaseVersion: quoteList.QuantityBaseVersion,
		ActiveSubmissionID:  quoteList.ActiveSubmissionID,
		AwardedProviderID:   quoteList.AwardedProviderID,
		ConfirmedAt:         quoteList.UserConfirmedAt,
		RevisionCount:       revisionCount,
	}
	if submission != nil {
		summary.ActiveSubmissionID = submission.ID
		summary.TotalCent = submission.TotalCent
		summary.EstimatedDays = submission.EstimatedDays
		if summary.AwardedProviderID == 0 {
			summary.AwardedProviderID = submission.ProviderID
		}
		if summary.ConfirmedAt == nil {
			summary.ConfirmedAt = submission.UserConfirmedAt
		}
	}
	return summary
}

func buildCommercialExplanation(quoteList *model.QuoteList, submission *model.QuoteSubmission, paymentPlans []QuotePaymentPlanSummary) *CommercialExplanation {
	if quoteList == nil {
		return nil
	}
	conversionSummary := BuildBridgeConversionSummaryByQuoteList(quoteList)
	explanation := &CommercialExplanation{
		PaymentPlanSummary: paymentPlans,
	}
	if conversionSummary != nil {
		explanation.BaselineSummary = conversionSummary.QuoteBaselineSummary
		if conversionSummary.ResponsibilityBoundarySummary != nil {
			explanation.ScopeIncluded = append([]string{}, conversionSummary.ResponsibilityBoundarySummary.Items...)
		}
	}
	if submission != nil {
		explanation.TeamSize = submission.TeamSize
		explanation.WorkTypes = parseDelimitedString(submission.WorkTypes)
		explanation.ConstructionMethodNote = strings.TrimSpace(submission.ConstructionMethodNote)
		explanation.SiteVisitRequired = submission.SiteVisitRequired
	}
	if len(explanation.ScopeIncluded) == 0 {
		explanation.ScopeIncluded = nil
	}
	return explanation
}

func buildSubmissionHealthSummaryWithDB(db *gorm.DB, quoteList *model.QuoteList, submission *model.QuoteSubmission, submissionItems []model.QuoteSubmissionItem) *SubmissionHealthSummary {
	if quoteList == nil {
		return nil
	}
	summary := &SubmissionHealthSummary{}
	submissionItemByListItemID := make(map[uint64]model.QuoteSubmissionItem, len(submissionItems))
	missingListItemIDs := make(map[uint64]struct{})
	for _, item := range submissionItems {
		submissionItemByListItemID[item.QuoteListItemID] = item
		if item.MissingPriceFlag {
			summary.MissingPriceCount++
			missingListItemIDs[item.QuoteListItemID] = struct{}{}
		}
		if item.DeviationFlag {
			summary.DeviationItemCount++
		}
	}
	var quoteListItems []model.QuoteListItem
	if err := db.Where("quote_list_id = ?", quoteList.ID).Find(&quoteListItems).Error; err == nil {
		for _, listItem := range quoteListItems {
			if !parseQuoteRequiredFlag(listItem.ExtensionsJSON) {
				continue
			}
			submissionItem, ok := submissionItemByListItemID[listItem.ID]
			if !ok || submissionItem.UnitPriceCent <= 0 || submissionItem.MissingPriceFlag {
				if _, counted := missingListItemIDs[listItem.ID]; counted {
					continue
				}
				summary.MissingPriceCount++
				missingListItemIDs[listItem.ID] = struct{}{}
			}
		}
	}
	if submission != nil {
		summary.PlatformReviewStatus = firstNonBlank(strings.TrimSpace(submission.ReviewStatus), model.QuoteSubmissionReviewStatusNotRequired)
		var lastRevision model.QuoteSubmissionRevision
		if err := db.Where("quote_submission_id = ?", submission.ID).Order("revision_no DESC, id DESC").First(&lastRevision).Error; err == nil {
			summary.LastRevisionNo = lastRevision.RevisionNo
			summary.LastChangeReason = strings.TrimSpace(lastRevision.ChangeReason)
		}
	}
	summary.CanSubmit = canMerchantSubmitQuoteList(quoteList, summary.MissingPriceCount)
	summary.BlockingReasons = buildQuoteSubmissionBlockingReasons(quoteList, summary.MissingPriceCount)
	if len(summary.BlockingReasons) == 0 {
		summary.BlockingReasons = nil
	}
	return summary
}

func canMerchantSubmitQuoteList(quoteList *model.QuoteList, missingPriceCount int) bool {
	if quoteList == nil || missingPriceCount > 0 {
		return false
	}
	switch quoteList.Status {
	case model.QuoteListStatusDraft, model.QuoteListStatusRejected, model.QuoteListStatusPricingInProgress, model.QuoteListStatusReadyForSelection:
		return true
	default:
		return false
	}
}

func buildQuoteSubmissionBlockingReasons(quoteList *model.QuoteList, missingPriceCount int) []string {
	reasons := make([]string, 0, 3)
	if missingPriceCount > 0 {
		reasons = append(reasons, fmt.Sprintf("仍有 %d 项未定价", missingPriceCount))
	}
	if quoteList == nil {
		return reasons
	}
	switch quoteList.Status {
	case model.QuoteListStatusSubmittedToUser:
		reasons = append(reasons, "报价已提交给用户，待用户处理后才能继续修改")
	case model.QuoteListStatusUserConfirmed, model.QuoteListStatusAwarded, model.QuoteListStatusLocked:
		reasons = append(reasons, "用户已确认当前报价，后续金额变化只能通过变更单处理")
	case model.QuoteListStatusSuperseded:
		reasons = append(reasons, "该报价版本已被新版本替代")
	case model.QuoteListStatusExpired, model.QuoteListStatusClosed:
		reasons = append(reasons, "该报价任务已关闭，不允许继续提交")
	}
	return reasons
}

func buildChangeOrderSummaryWithDB(db *gorm.DB, projectID uint64) (*ChangeOrderSummary, error) {
	if projectID == 0 {
		return nil, nil
	}
	var changeOrders []model.ChangeOrder
	if err := db.Where("project_id = ?", projectID).Order("id DESC").Find(&changeOrders).Error; err != nil {
		return nil, fmt.Errorf("查询项目变更单失败: %w", err)
	}
	if len(changeOrders) == 0 {
		return nil, nil
	}
	summary := &ChangeOrderSummary{}
	for _, changeOrder := range changeOrders {
		summary.TotalCount++
		summary.NetAmountCent += int64(math.Round(changeOrder.AmountImpact * 100))
		if summary.LatestChangeOrderID == 0 {
			summary.LatestChangeOrderID = changeOrder.ID
		}
		switch strings.TrimSpace(changeOrder.Status) {
		case model.ChangeOrderStatusPendingUserConfirm:
			summary.PendingUserConfirmCount++
		case model.ChangeOrderStatusAdminSettlementRequired:
			summary.PendingSettlementCount++
		case model.ChangeOrderStatusSettled:
			summary.SettledCount++
		}
	}
	return summary, nil
}

func buildFinanceRuntimeSummaryWithDB(db *gorm.DB, projectID uint64) (*SettlementSummary, *PayoutSummary, error) {
	if projectID == 0 {
		return nil, nil, nil
	}
	var settlements []model.SettlementOrder
	if err := db.Where("project_id = ?", projectID).Order("id DESC").Find(&settlements).Error; err != nil {
		return nil, nil, fmt.Errorf("查询项目结算单失败: %w", err)
	}
	if len(settlements) == 0 {
		return nil, nil, nil
	}
	settlement := settlements[0]
	settlementSummary := &SettlementSummary{
		LatestSettlementID: settlement.ID,
		Status:             settlement.Status,
		GrossAmount:        settlement.GrossAmount,
		NetAmount:          settlement.MerchantNetAmount,
		ScheduledAt:        settlement.DueAt,
	}
	payoutIDs := make([]uint64, 0, len(settlements))
	for _, row := range settlements {
		settlementSummary.TotalGrossAmount += row.GrossAmount
		settlementSummary.TotalNetAmount += row.MerchantNetAmount
		switch strings.TrimSpace(row.Status) {
		case model.SettlementStatusPaid, model.SettlementStatusRefunded:
			settlementSummary.SettledAmount += row.MerchantNetAmount
		case model.SettlementStatusPayoutFailed, model.SettlementStatusException:
			settlementSummary.FailedAmount += row.MerchantNetAmount
		default:
			settlementSummary.PendingAmount += row.MerchantNetAmount
		}
		if row.PayoutOrderID > 0 {
			payoutIDs = append(payoutIDs, row.PayoutOrderID)
		}
	}

	var payoutSummary *PayoutSummary
	if len(payoutIDs) > 0 {
		var payouts []model.PayoutOrder
		if err := db.Where("id IN ?", payoutIDs).Order("id DESC").Find(&payouts).Error; err != nil {
			return nil, nil, fmt.Errorf("查询项目出款单失败: %w", err)
		}
		if len(payouts) > 0 {
			latestPayout := payouts[0]
			payoutSummary = &PayoutSummary{
				LatestPayoutID: latestPayout.ID,
				Status:         latestPayout.Status,
				Channel:        latestPayout.Channel,
				ScheduledAt:    latestPayout.ScheduledAt,
				PaidAt:         latestPayout.PaidAt,
				FailureReason:  strings.TrimSpace(latestPayout.FailureReason),
			}
			for _, payout := range payouts {
				payoutSummary.TotalAmount += payout.Amount
				switch strings.TrimSpace(payout.Status) {
				case model.PayoutStatusPaid:
					payoutSummary.PaidAmount += payout.Amount
				case model.PayoutStatusFailed:
					payoutSummary.FailedAmount += payout.Amount
				default:
					payoutSummary.PendingAmount += payout.Amount
				}
			}
		}
	}

	if settlement.PayoutOrderID > 0 && payoutSummary != nil {
		settlementSummary.PaidAt = payoutSummary.PaidAt
	}
	return settlementSummary, payoutSummary, nil
}

func buildProjectClosureSummaryWithDB(db *gorm.DB, projectID uint64) *ProjectClosureSummary {
	if db == nil {
		db = repository.DB
	}
	if projectID == 0 {
		return nil
	}
	var project model.Project
	if err := db.First(&project, projectID).Error; err != nil {
		return nil
	}
	return buildProjectClosureSummaryFromProjectWithDB(db, &project)
}

func loadQuotePaymentPlanSummariesWithDB(db *gorm.DB, projectID uint64) ([]QuotePaymentPlanSummary, error) {
	if projectID == 0 {
		return []QuotePaymentPlanSummary{}, nil
	}
	var order model.Order
	if err := db.
		Where("project_id = ? AND order_type = ?", projectID, model.OrderTypeConstruction).
		Order("id DESC").
		First(&order).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return []QuotePaymentPlanSummary{}, nil
		}
		return nil, err
	}
	var plans []model.PaymentPlan
	if err := db.Where("order_id = ?", order.ID).Order("seq ASC, id ASC").Find(&plans).Error; err != nil {
		return nil, err
	}
	result := make([]QuotePaymentPlanSummary, 0, len(plans))
	for _, plan := range plans {
		result = append(result, QuotePaymentPlanSummary{
			ID:          plan.ID,
			OrderID:     plan.OrderID,
			MilestoneID: plan.MilestoneID,
			Type:        plan.Type,
			Seq:         plan.Seq,
			Name:        plan.Name,
			Amount:      plan.Amount,
			Status:      plan.Status,
			DueAt:       plan.DueAt,
			PaidAt:      plan.PaidAt,
		})
	}
	return result, nil
}

func summaryField[T any](summary *ProjectClosureSummary, fn func(*ProjectClosureSummary) T) T {
	var zero T
	if summary == nil {
		return zero
	}
	return fn(summary)
}

func userRef(user model.User) *model.User {
	if user.ID == 0 {
		return nil
	}
	return &user
}

func firstTimePointer(values ...*time.Time) *time.Time {
	for _, value := range values {
		if value != nil && !value.IsZero() {
			return value
		}
	}
	return nil
}
