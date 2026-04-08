package service

import (
	"fmt"

	"home-decoration-server/internal/model"
)

type VisibilityBlocker struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

type VisibilityPreview struct {
	PublicVisible bool                `json:"publicVisible"`
	Blockers      []VisibilityBlocker `json:"blockers"`
	Message       string              `json:"message"`
}

type VisibilityEntitySnapshot struct {
	ProviderID        *uint64 `json:"providerId,omitempty"`
	ProviderVerified  *bool   `json:"providerVerified,omitempty"`
	ProviderStatus    *int8   `json:"providerStatus,omitempty"`
	ShopID            *uint64 `json:"shopId,omitempty"`
	ShopVerified      *bool   `json:"shopVerified,omitempty"`
	CaseID            *uint64 `json:"caseId,omitempty"`
	ShowInInspiration *bool   `json:"showInInspiration,omitempty"`
}

type VisibilityData struct {
	CurrentLabel        string                   `json:"currentLabel"`
	PublicVisible       bool                     `json:"publicVisible"`
	Blockers            []VisibilityBlocker      `json:"blockers"`
	DistributionStatus  string                   `json:"distributionStatus,omitempty"`
	PrimaryBlockerCode  string                   `json:"primaryBlockerCode,omitempty"`
	PrimaryBlockerMsg   string                   `json:"primaryBlockerMessage,omitempty"`
	PlatformDisplayEditable bool                 `json:"platformDisplayEditable"`
	MerchantDisplayEditable bool                 `json:"merchantDisplayEditable"`
	PreviewAfterApprove *VisibilityPreview       `json:"previewAfterApprove"`
	EntitySnapshot      VisibilityEntitySnapshot `json:"entitySnapshot"`
}

type VisibilityActions struct {
	RejectResubmittable bool `json:"rejectResubmittable"`
}

type VisibilityLegacyInfo struct {
	IsLegacyPath bool     `json:"isLegacyPath"`
	Notes        []string `json:"notes"`
}

type VisibilityResult struct {
	Visibility VisibilityData        `json:"visibility"`
	Actions    VisibilityActions     `json:"actions"`
	LegacyInfo *VisibilityLegacyInfo `json:"legacyInfo,omitempty"`
}

type AdminVisibilityResolver struct{}

const (
	visibilityDistributionActive           = "active"
	visibilityDistributionHiddenByPlatform = "hidden_by_platform"
	visibilityDistributionHiddenByMerchant = "hidden_by_merchant"
	visibilityDistributionBlockedOperating = "blocked_by_operating"
	visibilityDistributionBlockedQualify   = "blocked_by_qualification"
)

func NewAdminVisibilityResolver() *AdminVisibilityResolver {
	return &AdminVisibilityResolver{}
}

func (r *AdminVisibilityResolver) ResolveMerchantApplication(app model.MerchantApplication, provider *model.Provider) VisibilityResult {
	result := VisibilityResult{
		Visibility: VisibilityData{
			CurrentLabel:        statusLabel(app.Status),
			PublicVisible:       false,
			Blockers:            make([]VisibilityBlocker, 0),
			PreviewAfterApprove: nil,
		},
		Actions: VisibilityActions{RejectResubmittable: isRejectResubmittable(app.Status)},
	}

	if provider != nil {
		result.Visibility.EntitySnapshot.ProviderID = &provider.ID
		result.Visibility.EntitySnapshot.ProviderVerified = &provider.Verified
		result.Visibility.EntitySnapshot.ProviderStatus = &provider.Status
	}

	switch app.Status {
	case 0:
		result.Visibility.Blockers = addBlocker(result.Visibility.Blockers, "application_pending", "申请仍在待审核，当前不会进入公开列表")
		if provider == nil {
			result.Visibility.Blockers = addBlocker(result.Visibility.Blockers, "entity_not_created", "审核通过前尚未生成服务商实体")
		} else {
			result.Visibility.Blockers = addBlocker(result.Visibility.Blockers, "deep_link_visibility_mismatch", "申请待审核期间公开列表不可见，但已生成服务商实体可能仍可通过深链访问")
		}
		previewBlockers := make([]VisibilityBlocker, 0)
		result.Visibility.PreviewAfterApprove = &VisibilityPreview{
			PublicVisible: len(previewBlockers) == 0,
			Blockers:      previewBlockers,
			Message:       "审核通过后将创建并激活服务商，公开列表可见",
		}
	case 1:
		if provider == nil {
			result.Visibility.Blockers = addBlocker(result.Visibility.Blockers, "entity_not_created", "申请已通过但未生成服务商实体")
			result.Visibility.Blockers = addBlocker(result.Visibility.Blockers, "legacy_data_incomplete", "历史数据缺少 provider 关联，公开可见性不完整")
			result.LegacyInfo = &VisibilityLegacyInfo{IsLegacyPath: true, Notes: []string{"申请状态已通过，但 provider_id 为空或记录缺失"}}
			break
		}
		decision := EvaluateProviderPublicVisibility(provider)
		result.Visibility.Blockers = appendVisibilityBlockers(result.Visibility.Blockers, decision.Blockers)
		if decision.PublicVisible {
			result.Visibility.PublicVisible = true
		} else {
			result.Visibility.Blockers = addBlocker(result.Visibility.Blockers, "deep_link_visibility_mismatch", "公开列表不可见，但已生成服务商实体可能仍可通过深链访问")
		}
	case 2:
		result.Visibility.Blockers = addBlocker(result.Visibility.Blockers, "application_rejected", "申请已被拒绝，公开列表不可见")
		if provider != nil {
			result.Visibility.Blockers = addBlocker(result.Visibility.Blockers, "deep_link_visibility_mismatch", "申请已拒绝但已有服务商实体，可能存在深链可访问差异")
		}
	}

	result.Visibility = finalizeProviderVisibilityData(provider, result.Visibility)
	return result
}

func (r *AdminVisibilityResolver) ResolveMaterialShopApplication(app model.MaterialShopApplication, shop *model.MaterialShop, productCount int64) VisibilityResult {
	result := VisibilityResult{
		Visibility: VisibilityData{
			CurrentLabel:        statusLabel(app.Status),
			PublicVisible:       false,
			Blockers:            make([]VisibilityBlocker, 0),
			PreviewAfterApprove: nil,
		},
		Actions: VisibilityActions{RejectResubmittable: isRejectResubmittable(app.Status)},
	}

	if shop != nil {
		result.Visibility.EntitySnapshot.ShopID = &shop.ID
		result.Visibility.EntitySnapshot.ShopVerified = &shop.IsVerified
	}

	switch app.Status {
	case 0:
		result.Visibility.Blockers = addBlocker(result.Visibility.Blockers, "application_pending", "申请仍在待审核，当前不会进入公开列表")
		if shop == nil {
			result.Visibility.Blockers = addBlocker(result.Visibility.Blockers, "entity_not_created", "审核通过前尚未生成主材商实体")
		} else {
			result.Visibility.Blockers = addBlocker(result.Visibility.Blockers, "deep_link_visibility_mismatch", "申请待审核期间公开列表不可见，但店铺详情可能仍可通过深链访问")
		}
		previewBlockers := cloneBlockers(result.Visibility.Blockers)
		previewBlockers = removeBlocker(previewBlockers, "application_pending")
		previewBlockers = removeBlocker(previewBlockers, "entity_not_created")
		previewMessage := "审核通过后将创建并激活主材商，公开列表可见"
		result.Visibility.PreviewAfterApprove = &VisibilityPreview{
			PublicVisible: len(previewBlockers) == 0,
			Blockers:      previewBlockers,
			Message:       previewMessage,
		}
	case 1:
		if shop == nil {
			result.Visibility.Blockers = addBlocker(result.Visibility.Blockers, "entity_not_created", "申请已通过但未生成主材商实体")
			result.Visibility.Blockers = addBlocker(result.Visibility.Blockers, "legacy_data_incomplete", "历史数据缺少 shop 关联，公开可见性不完整")
			result.LegacyInfo = &VisibilityLegacyInfo{IsLegacyPath: true, Notes: []string{"申请状态已通过，但 shop_id 为空或记录缺失"}}
			break
		}
		decision := EvaluateMaterialShopPublicVisibility(shop, productCount)
		result.Visibility.Blockers = appendVisibilityBlockers(result.Visibility.Blockers, decision.Blockers)
		if decision.PublicVisible {
			result.Visibility.PublicVisible = true
		} else {
			result.Visibility.Blockers = addBlocker(result.Visibility.Blockers, "deep_link_visibility_mismatch", "公开列表不可见，但店铺详情可能仍可通过深链访问")
		}
	case 2:
		result.Visibility.Blockers = addBlocker(result.Visibility.Blockers, "application_rejected", "申请已被拒绝，公开列表不可见")
		if shop != nil {
			result.Visibility.Blockers = addBlocker(result.Visibility.Blockers, "deep_link_visibility_mismatch", "申请已拒绝但已有店铺实体，可能存在深链可访问差异")
		}
	}

	result.Visibility = finalizeMaterialShopVisibilityData(shop, result.Visibility)
	return result
}

func (r *AdminVisibilityResolver) ResolveIdentityApplication(app model.IdentityApplication, provider *model.Provider, hasApprovedMerchantProfile bool) VisibilityResult {
	result := VisibilityResult{
		Visibility: VisibilityData{
			CurrentLabel:        statusLabel(app.Status),
			PublicVisible:       false,
			Blockers:            make([]VisibilityBlocker, 0),
			PreviewAfterApprove: nil,
		},
		Actions: VisibilityActions{RejectResubmittable: isRejectResubmittable(app.Status)},
	}

	if provider != nil {
		result.Visibility.EntitySnapshot.ProviderID = &provider.ID
		result.Visibility.EntitySnapshot.ProviderVerified = &provider.Verified
		result.Visibility.EntitySnapshot.ProviderStatus = &provider.Status
	}

	checkProviderVisibility := func(blockers []VisibilityBlocker) []VisibilityBlocker {
		if provider == nil {
			return addBlocker(blockers, "entity_not_created", "尚未生成服务商实体")
		}
		blockers = appendVisibilityBlockers(blockers, EvaluateProviderPublicVisibility(provider).Blockers)
		if !hasApprovedMerchantProfile {
			blockers = addBlocker(blockers, "identity_only_not_profile_complete", "身份审核通过不等于商家资料审核完成，公开列表仍不可见")
		}
		return blockers
	}

	switch app.Status {
	case 0:
		result.Visibility.Blockers = addBlocker(result.Visibility.Blockers, "application_pending", "身份申请仍在待审核")
		result.Visibility.Blockers = checkProviderVisibility(result.Visibility.Blockers)
		if provider != nil {
			result.Visibility.Blockers = addBlocker(result.Visibility.Blockers, "deep_link_visibility_mismatch", "身份待审核期间公开列表不可见，但服务商详情可能仍可通过深链访问")
		}

		previewProvider := provider
		if previewProvider == nil {
			previewProvider = &model.Provider{Verified: true, Status: 1}
		}
		previewBlockers := make([]VisibilityBlocker, 0)
		if !hasApprovedMerchantProfile {
			previewBlockers = addBlocker(previewBlockers, "identity_only_not_profile_complete", "审核通过后会激活服务商身份，但商家资料未完成，仍不可公开")
		}
		if previewProvider.Status != 1 {
			previewBlockers = addBlocker(previewBlockers, "provider_frozen", "审核通过后服务商状态异常，公开列表不可见")
		}
		if !previewProvider.Verified {
			previewBlockers = addBlocker(previewBlockers, "provider_unverified", "审核通过后服务商未实名，公开列表不可见")
		}
		message := "审核通过后将激活服务商身份"
		if len(previewBlockers) == 0 {
			message = "审核通过后将激活服务商身份，且公开列表可见"
		}
		result.Visibility.PreviewAfterApprove = &VisibilityPreview{
			PublicVisible: len(previewBlockers) == 0,
			Blockers:      previewBlockers,
			Message:       message,
		}
	case 1:
		result.Visibility.Blockers = checkProviderVisibility(result.Visibility.Blockers)
		if len(result.Visibility.Blockers) == 0 {
			result.Visibility.PublicVisible = true
		} else if provider != nil {
			result.Visibility.Blockers = addBlocker(result.Visibility.Blockers, "deep_link_visibility_mismatch", "公开列表不可见，但服务商详情可能仍可通过深链访问")
		}
	case 2:
		result.Visibility.Blockers = addBlocker(result.Visibility.Blockers, "application_rejected", "身份申请已被拒绝")
	}

	result.Visibility = finalizeProviderVisibilityData(provider, result.Visibility)
	return result
}

func (r *AdminVisibilityResolver) ResolveCaseAudit(audit model.CaseAudit, originalCase *model.ProviderCase) VisibilityResult {
	currentLabel := fmt.Sprintf("%s（%s）", statusLabel(audit.Status), audit.ActionType)
	result := VisibilityResult{
		Visibility: VisibilityData{
			CurrentLabel:        currentLabel,
			PublicVisible:       false,
			Blockers:            make([]VisibilityBlocker, 0),
			PreviewAfterApprove: nil,
		},
		Actions: VisibilityActions{RejectResubmittable: isRejectResubmittable(audit.Status)},
	}

	if audit.CaseID != nil {
		result.Visibility.EntitySnapshot.CaseID = audit.CaseID
	}
	if originalCase != nil {
		result.Visibility.EntitySnapshot.ShowInInspiration = &originalCase.ShowInInspiration
	}

	if audit.ActionType == "create" {
		result.Visibility.Blockers = addBlocker(result.Visibility.Blockers, "entity_not_created", "新建作品尚未入库，当前不可公开")
	} else {
		if originalCase == nil {
			result.Visibility.Blockers = addBlocker(result.Visibility.Blockers, "case_missing_original", "找不到原作品记录，无法判断或执行可见性变更")
			result.Visibility.Blockers = addBlocker(result.Visibility.Blockers, "legacy_data_incomplete", "审核记录引用的原作品缺失，属于历史数据不完整")
			result.LegacyInfo = &VisibilityLegacyInfo{IsLegacyPath: true, Notes: []string{"case_audits 记录存在，但 provider_cases 原始记录缺失"}}
		} else if !EvaluateCasePublicVisibility(originalCase).PublicVisible {
			result.Visibility.Blockers = appendVisibilityBlockers(result.Visibility.Blockers, EvaluateCasePublicVisibility(originalCase).Blockers)
			result.Visibility.Blockers = addBlocker(result.Visibility.Blockers, "deep_link_visibility_mismatch", "灵感库不可见，但作品详情可能仍可通过深链访问")
		} else {
			result.Visibility.PublicVisible = true
		}
	}

	switch audit.Status {
	case 0:
		result.Visibility.Blockers = addBlocker(result.Visibility.Blockers, "application_pending", "审核未完成，当前状态未生效")
		result.Visibility.PreviewAfterApprove = r.buildCaseApprovePreview(audit, originalCase)
	case 2:
		result.Visibility.Blockers = addBlocker(result.Visibility.Blockers, "application_rejected", "审核被拒绝，本次变更不会生效")
	}

	result.Visibility = finalizeVisibilityData(result.Visibility)
	return result
}

func finalizeProviderVisibilityData(provider *model.Provider, data VisibilityData) VisibilityData {
	data = finalizeVisibilityData(data)
	editable := ProviderDisplayControlEnabled(provider)
	data.PlatformDisplayEditable = editable
	data.MerchantDisplayEditable = editable
	return data
}

func finalizeMaterialShopVisibilityData(shop *model.MaterialShop, data VisibilityData) VisibilityData {
	data = finalizeVisibilityData(data)
	editable := MaterialShopDisplayControlEnabled(shop)
	data.PlatformDisplayEditable = editable
	data.MerchantDisplayEditable = editable
	return data
}

func (r *AdminVisibilityResolver) buildCaseApprovePreview(audit model.CaseAudit, originalCase *model.ProviderCase) *VisibilityPreview {
	switch audit.ActionType {
	case "create":
		return &VisibilityPreview{
			PublicVisible: true,
			Blockers:      []VisibilityBlocker{},
			Message:       "审核通过后将创建作品，默认公开到灵感库",
		}
	case "update":
		if originalCase == nil {
			blockers := []VisibilityBlocker{{Code: "case_missing_original", Message: "找不到原作品记录，审核通过后也无法同步可见性"}}
			return &VisibilityPreview{
				PublicVisible: false,
				Blockers:      blockers,
				Message:       "审核通过后不会自动修改 showInInspiration，但当前缺少原作品记录",
			}
		}
		previewBlockers := make([]VisibilityBlocker, 0)
		if !originalCase.ShowInInspiration {
			previewBlockers = addBlocker(previewBlockers, "case_hidden_from_inspiration", "审核通过后不自动改 showInInspiration，仍保持当前隐藏")
		}
		return &VisibilityPreview{
			PublicVisible: originalCase.ShowInInspiration,
			Blockers:      previewBlockers,
			Message:       "审核通过后只更新内容，不自动改 showInInspiration",
		}
	case "delete":
		return &VisibilityPreview{
			PublicVisible: false,
			Blockers:      []VisibilityBlocker{},
			Message:       "审核通过后作品将下线",
		}
	default:
		return &VisibilityPreview{
			PublicVisible: false,
			Blockers:      []VisibilityBlocker{},
			Message:       "未知审核动作，无法预测公开状态",
		}
	}
}

func statusLabel(status int8) string {
	switch status {
	case 0:
		return "待审核"
	case 1:
		return "审核通过"
	case 2:
		return "审核拒绝"
	default:
		return "未知状态"
	}
}

func addBlocker(blockers []VisibilityBlocker, code, message string) []VisibilityBlocker {
	for _, blocker := range blockers {
		if blocker.Code == code {
			return blockers
		}
	}
	return append(blockers, VisibilityBlocker{Code: code, Message: message})
}

func hasBlocker(blockers []VisibilityBlocker, code string) bool {
	for _, blocker := range blockers {
		if blocker.Code == code {
			return true
		}
	}
	return false
}

func removeBlocker(blockers []VisibilityBlocker, code string) []VisibilityBlocker {
	result := make([]VisibilityBlocker, 0, len(blockers))
	for _, blocker := range blockers {
		if blocker.Code == code {
			continue
		}
		result = append(result, blocker)
	}
	return result
}

func cloneBlockers(blockers []VisibilityBlocker) []VisibilityBlocker {
	cloned := make([]VisibilityBlocker, len(blockers))
	copy(cloned, blockers)
	return cloned
}

func appendVisibilityBlockers(existing, added []VisibilityBlocker) []VisibilityBlocker {
	for _, blocker := range added {
		existing = addBlocker(existing, blocker.Code, blocker.Message)
	}
	return existing
}

func finalizeVisibilityData(data VisibilityData) VisibilityData {
	data.DistributionStatus = resolveVisibilityDistributionStatus(data)
	if data.PublicVisible {
		data.PrimaryBlockerCode = ""
		data.PrimaryBlockerMsg = ""
		return data
	}

	if blocker, ok := pickPrimaryVisibilityBlocker(data.Blockers); ok {
		data.PrimaryBlockerCode = blocker.Code
		data.PrimaryBlockerMsg = blocker.Message
	}
	return data
}

func resolveVisibilityDistributionStatus(data VisibilityData) string {
	if data.PublicVisible {
		return visibilityDistributionActive
	}
	if _, ok := findVisibilityBlocker(data.Blockers, "provider_frozen"); ok {
		return visibilityDistributionBlockedOperating
	}
	if _, ok := findVisibilityBlocker(data.Blockers, "shop_frozen"); ok {
		return visibilityDistributionBlockedOperating
	}
	if _, ok := findVisibilityBlocker(data.Blockers, "platform_hidden"); ok {
		return visibilityDistributionHiddenByPlatform
	}
	if _, ok := findVisibilityBlocker(data.Blockers, "merchant_hidden"); ok {
		return visibilityDistributionHiddenByMerchant
	}
	return visibilityDistributionBlockedQualify
}

func pickPrimaryVisibilityBlocker(blockers []VisibilityBlocker) (VisibilityBlocker, bool) {
	priorities := []string{
		"provider_frozen",
		"shop_frozen",
		"platform_hidden",
		"merchant_hidden",
	}
	for _, code := range priorities {
		if blocker, ok := findVisibilityBlocker(blockers, code); ok {
			return blocker, true
		}
	}
	if len(blockers) == 0 {
		return VisibilityBlocker{}, false
	}
	return blockers[0], true
}

func findVisibilityBlocker(blockers []VisibilityBlocker, code string) (VisibilityBlocker, bool) {
	for _, blocker := range blockers {
		if blocker.Code == code {
			return blocker, true
		}
	}
	return VisibilityBlocker{}, false
}

func isRejectResubmittable(status int8) bool {
	return status == 2
}
