package service

import (
	"fmt"
	"sort"
	"time"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
)

type ConstructionSubjectComparisonItem struct {
	ProviderID    uint64   `json:"providerId"`
	SubjectType   string   `json:"subjectType"`
	DisplayName   string   `json:"displayName"`
	Rating        float32  `json:"rating"`
	ReviewCount   int      `json:"reviewCount"`
	CompletedCnt  int      `json:"completedCnt"`
	CaseCount     int64    `json:"caseCount"`
	HighlightTags []string `json:"highlightTags,omitempty"`
	PriceHint     string   `json:"priceHint,omitempty"`
	DeliveryHint  string   `json:"deliveryHint,omitempty"`
	TrustSummary  string   `json:"trustSummary,omitempty"`
	Selected      bool     `json:"selected"`
}

type BridgeQuoteBaselineSummary struct {
	Title        string     `json:"title,omitempty"`
	SourceStage  string     `json:"sourceStage,omitempty"`
	SubmittedAt  *time.Time `json:"submittedAt,omitempty"`
	ItemCount    int        `json:"itemCount"`
	Highlights   []string   `json:"highlights,omitempty"`
	ReadyForUser bool       `json:"readyForUser"`
}

type BridgeChecklistSummary struct {
	Title string   `json:"title,omitempty"`
	Items []string `json:"items,omitempty"`
}

type BridgeTrustSignals struct {
	Rating             float32  `json:"rating"`
	ReviewCount        int      `json:"reviewCount"`
	CompletedCnt       int      `json:"completedCnt"`
	CaseCount          int64    `json:"caseCount"`
	HighlightTags      []string `json:"highlightTags,omitempty"`
	OfficialReviewHint string   `json:"officialReviewHint,omitempty"`
}

type BridgeNextStep struct {
	ActionKey    string `json:"actionKey,omitempty"`
	ActionText   string `json:"actionText,omitempty"`
	Title        string `json:"title,omitempty"`
	Owner        string `json:"owner,omitempty"`
	Reason       string `json:"reason,omitempty"`
	ActionHint   string `json:"actionHint,omitempty"`
	BlockingHint string `json:"blockingHint,omitempty"`
}

type BridgeConversionSummary struct {
	ConstructionSubjectComparison []ConstructionSubjectComparisonItem `json:"constructionSubjectComparison,omitempty"`
	QuoteBaselineSummary          *BridgeQuoteBaselineSummary         `json:"quoteBaselineSummary,omitempty"`
	ResponsibilityBoundarySummary *BridgeChecklistSummary             `json:"responsibilityBoundarySummary,omitempty"`
	ScheduleAndAcceptanceSummary  *BridgeChecklistSummary             `json:"scheduleAndAcceptanceSummary,omitempty"`
	PlatformGuaranteeSummary      *BridgeChecklistSummary             `json:"platformGuaranteeSummary,omitempty"`
	TrustSignals                  *BridgeTrustSignals                 `json:"trustSignals,omitempty"`
	BridgeNextStep                *BridgeNextStep                     `json:"bridgeNextStep,omitempty"`
}

func BuildBridgeConversionSummaryByBookingID(bookingID uint64) *BridgeConversionSummary {
	ctx := loadBridgeContext(bookingID, 0, 0, 0)
	return buildBridgeConversionSummary(ctx)
}

func BuildBridgeConversionSummaryByProposalID(proposalID uint64) *BridgeConversionSummary {
	ctx := loadBridgeContext(0, proposalID, 0, 0)
	return buildBridgeConversionSummary(ctx)
}

func BuildBridgeConversionSummaryByQuoteList(quoteList *model.QuoteList) *BridgeConversionSummary {
	if quoteList == nil {
		return nil
	}
	ctx := loadBridgeContext(0, quoteList.ProposalID, quoteList.ID, quoteList.ProjectID)
	return buildBridgeConversionSummary(ctx)
}

func BuildBridgeConversionSummaryByProject(project *model.Project) *BridgeConversionSummary {
	if project == nil {
		return nil
	}
	ctx := loadBridgeContext(0, 0, 0, project.ID)
	return buildBridgeConversionSummary(ctx)
}

func buildBridgeConversionSummary(ctx bridgeContext) *BridgeConversionSummary {
	summary := &BridgeConversionSummary{
		ConstructionSubjectComparison: buildConstructionSubjectComparison(ctx),
		QuoteBaselineSummary:          buildBridgeQuoteBaselineSummary(ctx),
		ResponsibilityBoundarySummary: buildResponsibilityBoundarySummary(ctx),
		ScheduleAndAcceptanceSummary:  buildScheduleAndAcceptanceSummary(ctx),
		PlatformGuaranteeSummary:      buildPlatformGuaranteeSummary(ctx),
		TrustSignals:                  buildBridgeTrustSignals(ctx),
		BridgeNextStep:                buildBridgeNextStep(ctx),
	}
	if len(summary.ConstructionSubjectComparison) == 0 {
		summary.ConstructionSubjectComparison = nil
	}
	return summary
}

func buildConstructionSubjectComparison(ctx bridgeContext) []ConstructionSubjectComparisonItem {
	providerIDs := make([]uint64, 0)
	seen := map[uint64]struct{}{}
	push := func(id uint64) {
		if id == 0 {
			return
		}
		if _, ok := seen[id]; ok {
			return
		}
		seen[id] = struct{}{}
		providerIDs = append(providerIDs, id)
	}
	if ctx.quoteList != nil {
		push(ctx.quoteList.AwardedProviderID)
		var invitations []model.QuoteInvitation
		_ = repository.DB.Where("quote_list_id = ?", ctx.quoteList.ID).Find(&invitations).Error
		for _, invitation := range invitations {
			push(invitation.ProviderID)
		}
		var submissions []model.QuoteSubmission
		_ = repository.DB.Where("quote_list_id = ?", ctx.quoteList.ID).Find(&submissions).Error
		for _, submission := range submissions {
			push(submission.ProviderID)
		}
	}
	if ctx.provider != nil {
		push(ctx.provider.ID)
	}
	if len(providerIDs) == 0 {
		return nil
	}

	var providers []model.Provider
	if err := repository.DB.Where("id IN ?", providerIDs).Find(&providers).Error; err != nil || len(providers) == 0 {
		return nil
	}
	providerByID := make(map[uint64]model.Provider, len(providers))
	userIDs := make([]uint64, 0, len(providers))
	for _, provider := range providers {
		providerByID[provider.ID] = provider
		if provider.UserID > 0 {
			userIDs = append(userIDs, provider.UserID)
		}
	}

	userByID := map[uint64]model.User{}
	if len(userIDs) > 0 {
		var users []model.User
		_ = repository.DB.Select("id", "nickname", "phone").Where("id IN ?", userIDs).Find(&users).Error
		for _, user := range users {
			userByID[user.ID] = user
		}
	}

	caseCounts := map[uint64]int64{}
	rows := []struct {
		ProviderID uint64
		Total      int64
	}{}
	if err := repository.DB.Model(&model.ProviderCase{}).
		Select("provider_id, COUNT(*) AS total").
		Where("provider_id IN ?", providerIDs).
		Group("provider_id").
		Scan(&rows).Error; err == nil {
		for _, row := range rows {
			caseCounts[row.ProviderID] = row.Total
		}
	}

	result := make([]ConstructionSubjectComparisonItem, 0, len(providerIDs))
	for _, providerID := range providerIDs {
		provider, ok := providerByID[providerID]
		if !ok {
			continue
		}
		user := userByID[provider.UserID]
		displayName := ResolveProviderDisplayName(provider, &user)
		tags := parseJSONStringArray(provider.HighlightTags)
		if len(tags) == 0 {
			tags = parseDelimitedString(provider.Specialty)
		}
		subjectType := resolveConstructionSubjectType(&provider)
		priceHint := buildConstructionPriceHint(provider)
		deliveryHint := buildConstructionDeliveryHint(provider)
		trustSummary := fmt.Sprintf("%d 个案例 · %d 条正式评价 · %d 个完工项目", caseCounts[provider.ID], provider.ReviewCount, provider.CompletedCnt)
		result = append(result, ConstructionSubjectComparisonItem{
			ProviderID:    provider.ID,
			SubjectType:   subjectType,
			DisplayName:   displayName,
			Rating:        provider.Rating,
			ReviewCount:   provider.ReviewCount,
			CompletedCnt:  provider.CompletedCnt,
			CaseCount:     caseCounts[provider.ID],
			HighlightTags: tags,
			PriceHint:     priceHint,
			DeliveryHint:  deliveryHint,
			TrustSummary:  trustSummary,
			Selected:      ctx.provider != nil && provider.ID == ctx.provider.ID,
		})
	}
	sort.SliceStable(result, func(i, j int) bool {
		if result[i].Selected != result[j].Selected {
			return result[i].Selected
		}
		if result[i].Rating != result[j].Rating {
			return result[i].Rating > result[j].Rating
		}
		if result[i].CompletedCnt != result[j].CompletedCnt {
			return result[i].CompletedCnt > result[j].CompletedCnt
		}
		return result[i].ProviderID < result[j].ProviderID
	})
	return result
}

func buildConstructionPriceHint(provider model.Provider) string {
	if provider.PriceMin > 0 && provider.PriceMax > 0 {
		return fmt.Sprintf("参考报价区间 %.0f - %.0f %s", provider.PriceMin, provider.PriceMax, firstNonBlank(provider.PriceUnit, model.ProviderPriceUnitPerSquareMeter))
	}
	if provider.PriceMin > 0 {
		return fmt.Sprintf("参考起步价 %.0f %s", provider.PriceMin, firstNonBlank(provider.PriceUnit, model.ProviderPriceUnitPerSquareMeter))
	}
	return "报价以正式施工清单与现场条件为准"
}

func buildConstructionDeliveryHint(provider model.Provider) string {
	subjectType := resolveConstructionSubjectType(&provider)
	switch subjectType {
	case "company":
		return "公司主体承接，适合需要稳定团队协作与项目管理的施工。"
	case "foreman":
		return "独立工长主体承接，适合对班组与现场执行沟通更敏感的施工。"
	default:
		return "施工主体已参与报价，可结合案例与评价继续比对。"
	}
}

func buildBridgeQuoteBaselineSummary(ctx bridgeContext) *BridgeQuoteBaselineSummary {
	itemCount := 0
	highlights := make([]string, 0, 4)
	title := "施工报价基线"
	sourceStage := "正式方案确认后提交"
	submittedAt := resolveBaselineSubmittedAt(ctx)
	readyForUser := resolveBaselineStatus(ctx) == "ready_for_selection"
	if ctx.quantityBase != nil {
		title = firstNonBlank(ctx.quantityBase.Title, title)
	}
	if ctx.quoteList != nil {
		title = firstNonBlank(ctx.quoteList.Title, title)
		sourceStage = firstNonBlank(ctx.quoteList.SourceType, sourceStage)
	}
	if ctx.quantityBase != nil {
		var totalCount int64
		_ = repository.DB.Model(&model.QuantityBaseItem{}).Where("quantity_base_id = ?", ctx.quantityBase.ID).Count(&totalCount).Error
		itemCount = int(totalCount)
		var items []model.QuantityBaseItem
		if err := repository.DB.Where("quantity_base_id = ?", ctx.quantityBase.ID).Order("sort_order ASC, id ASC").Limit(6).Find(&items).Error; err == nil {
			for _, item := range items {
				highlights = append(highlights, fmt.Sprintf("%s：基准量 %.2f%s", firstNonBlank(item.SourceItemName, item.SourceItemCode, fmt.Sprintf("基线项#%d", item.ID)), item.Quantity, firstNonBlank(item.Unit, "项")))
			}
		}
	}
	if itemCount == 0 && ctx.quoteList != nil {
		var count int64
		_ = repository.DB.Model(&model.QuoteListItem{}).Where("quote_list_id = ?", ctx.quoteList.ID).Count(&count).Error
		itemCount = int(count)
	}
	return &BridgeQuoteBaselineSummary{
		Title:        title,
		SourceStage:  sourceStage,
		SubmittedAt:  submittedAt,
		ItemCount:    itemCount,
		Highlights:   highlights,
		ReadyForUser: readyForUser,
	}
}

func buildResponsibilityBoundarySummary(ctx bridgeContext) *BridgeChecklistSummary {
	items := []string{
		"报价以正式工程量基线为准，非基线项或数量偏差项必须在清单里写明原因。",
		"增项、减项、工期变化统一通过变更单留痕，避免口头承诺失真。",
		"平台只对已确认的施工范围、验收节点和争议证据承担治理协同。",
	}
	if ctx.quoteList != nil {
		if ctx.quoteList.MaterialIncluded {
			items = append(items, "当前报价标记为含主材，主材责任边界会在施工清单与后续支付计划中同步体现。")
		} else {
			items = append(items, "当前报价默认为不含主材，主材采购边界需要在确认页和后续合同中再次确认。")
		}
	}
	return &BridgeChecklistSummary{Title: "责任边界", Items: items}
}

func buildScheduleAndAcceptanceSummary(ctx bridgeContext) *BridgeChecklistSummary {
	items := []string{
		"首付款确认后才会进入待监理协调开工，节点款按里程碑激活，尾款以最终验收为准。",
		"每个施工节点都要提交材料并留痕，用户验收不通过时必须回到整改链。",
		"监理登记计划进场时间后，项目才允许进入实际开工动作。",
	}
	if ctx.project != nil && ctx.project.ExpectedEnd != nil {
		items = append(items, fmt.Sprintf("当前项目预计完工时间：%s。", ctx.project.ExpectedEnd.Format("2006-01-02")))
	}
	if ctx.project != nil {
		plans, _ := (&QuoteService{}).loadQuotePaymentPlanSummaries(ctx.project.ID)
		if len(plans) > 0 {
			firstPlan := plans[0]
			items = append(items, fmt.Sprintf("首笔支付计划：%s，金额 %.2f 元。", firstPlan.Name, firstPlan.Amount))
		}
	}
	return &BridgeChecklistSummary{Title: "工期与验收", Items: items}
}

func buildPlatformGuaranteeSummary(ctx bridgeContext) *BridgeChecklistSummary {
	items := []string{
		"平台对待支付、即将过期、支付失效、验收、退款和争议提供统一通知与记录。",
		"关键节点支持后台审计与监理介入，异常不会只停留在聊天承诺。",
		"发生争议时，平台优先依据施工清单、变更单、日志、验收与支付证据进行裁决。",
	}
	if ctx.project != nil && ctx.project.EntryStartDate != nil {
		items = append(items, fmt.Sprintf("当前计划进场时间已登记为 %s，监理会围绕该时间推进待开工协同。", ctx.project.EntryStartDate.Format("2006-01-02")))
	}
	return &BridgeChecklistSummary{Title: "平台保障", Items: items}
}

func buildBridgeTrustSignals(ctx bridgeContext) *BridgeTrustSignals {
	provider := ctx.provider
	if provider == nil && ctx.quoteList != nil && ctx.quoteList.AwardedProviderID > 0 {
		var resolved model.Provider
		if err := repository.DB.First(&resolved, ctx.quoteList.AwardedProviderID).Error; err == nil {
			provider = &resolved
		}
	}
	if provider == nil {
		return nil
	}
	var caseCount int64
	_ = repository.DB.Model(&model.ProviderCase{}).Where("provider_id = ?", provider.ID).Count(&caseCount).Error
	highlightTags := parseJSONStringArray(provider.HighlightTags)
	if len(highlightTags) == 0 {
		highlightTags = parseDelimitedString(provider.Specialty)
	}
	officialHint := fmt.Sprintf("当前施工主体累计 %d 条正式评价、%d 个完工项目、%d 个案例。", provider.ReviewCount, provider.CompletedCnt, caseCount)
	return &BridgeTrustSignals{
		Rating:             provider.Rating,
		ReviewCount:        provider.ReviewCount,
		CompletedCnt:       provider.CompletedCnt,
		CaseCount:          caseCount,
		HighlightTags:      highlightTags,
		OfficialReviewHint: officialHint,
	}
}

func buildBridgeNextStep(ctx bridgeContext) *BridgeNextStep {
	stage := ""
	if ctx.flow != nil {
		stage = model.NormalizeBusinessFlowStage(ctx.flow.CurrentStage)
	}
	switch stage {
	case model.BusinessFlowStageConstructionPartyPending:
		return &BridgeNextStep{
			ActionKey:    "complete_construction_prep",
			ActionText:   "完善施工准备",
			Title:        "等待施工桥接推进",
			Owner:        "设计师 / 平台",
			Reason:       "需要先补齐报价基线并明确施工主体候选。",
			ActionHint:   "先查看基线与施工主体对比，再进入施工报价确认。",
			BlockingHint: "基线、施工主体和报价前置项未齐备前，不会进入项目创建。",
		}
	case model.BusinessFlowStageConstructionQuotePending:
		return &BridgeNextStep{
			ActionKey:    "confirm_construction_quote",
			ActionText:   "确认施工报价",
			Title:        "等待你确认施工报价",
			Owner:        "用户",
			Reason:       "施工主体已给出正式报价，需要你确认价格、工期、责任边界与保障规则。",
			ActionHint:   "确认后会立即生成订单与支付计划，并进入待监理协调开工。",
			BlockingHint: "未确认施工报价前，不会创建项目。",
		}
	case model.BusinessFlowStageReadyToStart:
		return &BridgeNextStep{
			ActionKey:  "view_kickoff_sync",
			ActionText: "查看开工协调",
			Title:      "等待监理协调开工",
			Owner:      "监理",
			Reason:     "施工报价已确认，当前需要登记计划进场时间并同步开工准备。",
			ActionHint: "关注计划进场时间、首笔支付和最新监理同步。",
		}
	default:
		if ctx.project != nil {
			return &BridgeNextStep{
				ActionKey:  "track_project_delivery",
				ActionText: "查看履约进展",
				Title:      "项目已进入履约链",
				Owner:      "商家 / 监理 / 用户",
				Reason:     "当前重点转为阶段执行、验收与支付计划收口。",
				ActionHint: "继续跟踪节点验收、变更单与资金状态。",
			}
		}
		return &BridgeNextStep{
			ActionKey:    "complete_previous_stage",
			ActionText:   "补齐前置阶段",
			Title:        "等待主链推进",
			Owner:        "平台",
			Reason:       "当前桥接链路尚未形成可确认施工报价的完整上下文。",
			ActionHint:   "先补齐设计确认、基线或施工主体信息。",
			BlockingHint: "只有设计确认完成后，施工桥接才会成为主动作。",
		}
	}
}
