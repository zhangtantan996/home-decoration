package service

import (
	"testing"

	"home-decoration-server/internal/model"
)

func hasBlockerCode(blockers []VisibilityBlocker, code string) bool {
	for _, blocker := range blockers {
		if blocker.Code == code {
			return true
		}
	}
	return false
}

func uint64Ptr(v uint64) *uint64 { return &v }

func TestAdminVisibilityResolver_MerchantApplication(t *testing.T) {
	setupPublicVisibilitySchema(t)
	resolver := NewAdminVisibilityResolver()

	t.Run("approved no blocker", func(t *testing.T) {
		result := resolver.ResolveMerchantApplication(model.MerchantApplication{Status: 1}, &model.Provider{Base: model.Base{ID: 101}, Verified: true, Status: 1})
		if !result.Visibility.PublicVisible {
			t.Fatalf("expected public visible")
		}
		if len(result.Visibility.Blockers) != 0 {
			t.Fatalf("expected no blockers, got %v", result.Visibility.Blockers)
		}
		if result.Actions.RejectResubmittable {
			t.Fatalf("approved should not be reject-resubmittable")
		}
	})

	t.Run("pending single blocker with preview", func(t *testing.T) {
		result := resolver.ResolveMerchantApplication(model.MerchantApplication{Status: 0}, nil)
		if !hasBlockerCode(result.Visibility.Blockers, "application_pending") || !hasBlockerCode(result.Visibility.Blockers, "entity_not_created") {
			t.Fatalf("expected pending/entity blockers, got %v", result.Visibility.Blockers)
		}
		if result.Visibility.PreviewAfterApprove == nil || !result.Visibility.PreviewAfterApprove.PublicVisible {
			t.Fatalf("expected preview visible")
		}
		if result.Actions.RejectResubmittable {
			t.Fatalf("pending should not be reject-resubmittable")
		}
	})

	t.Run("approved multiple blockers includes deep link mismatch", func(t *testing.T) {
		result := resolver.ResolveMerchantApplication(model.MerchantApplication{Status: 1}, &model.Provider{Base: model.Base{ID: 103}, Verified: false, Status: 2, IsSettled: true})
		if result.Visibility.PublicVisible {
			t.Fatalf("expected not public visible")
		}
		if !hasBlockerCode(result.Visibility.Blockers, "provider_unverified") || !hasBlockerCode(result.Visibility.Blockers, "provider_frozen") {
			t.Fatalf("expected multiple blockers, got %v", result.Visibility.Blockers)
		}
		if !hasBlockerCode(result.Visibility.Blockers, "deep_link_visibility_mismatch") {
			t.Fatalf("expected deep_link_visibility_mismatch")
		}
	})

	t.Run("rejected resubmittable true", func(t *testing.T) {
		result := resolver.ResolveMerchantApplication(model.MerchantApplication{Status: 2}, &model.Provider{Base: model.Base{ID: 102}, Verified: true, Status: 1})
		if !result.Actions.RejectResubmittable {
			t.Fatalf("rejected should be reject-resubmittable")
		}
		if !hasBlockerCode(result.Visibility.Blockers, "application_rejected") {
			t.Fatalf("expected application_rejected")
		}
	})

	t.Run("preview consistency with approved path", func(t *testing.T) {
		pending := resolver.ResolveMerchantApplication(model.MerchantApplication{Status: 0}, nil)
		approved := resolver.ResolveMerchantApplication(model.MerchantApplication{Status: 1}, &model.Provider{Verified: true, Status: 1})
		if pending.Visibility.PreviewAfterApprove == nil {
			t.Fatalf("missing preview")
		}
		if pending.Visibility.PreviewAfterApprove.PublicVisible != approved.Visibility.PublicVisible {
			t.Fatalf("preview visibility (%v) != approved visibility (%v)", pending.Visibility.PreviewAfterApprove.PublicVisible, approved.Visibility.PublicVisible)
		}
	})
}

func TestAdminVisibilityResolver_MaterialShopApplication(t *testing.T) {
	setupPublicVisibilitySchema(t)
	resolver := NewAdminVisibilityResolver()

	t.Run("pending preview visible even when products are below five", func(t *testing.T) {
		result := resolver.ResolveMaterialShopApplication(model.MaterialShopApplication{Status: 0}, nil, 3)
		if result.Visibility.PreviewAfterApprove == nil || !result.Visibility.PreviewAfterApprove.PublicVisible {
			t.Fatalf("expected preview visible")
		}
		if result.Actions.RejectResubmittable {
			t.Fatalf("pending should not be reject-resubmittable")
		}
	})

	t.Run("approved unverified shop has deep link mismatch", func(t *testing.T) {
		result := resolver.ResolveMaterialShopApplication(model.MaterialShopApplication{Status: 1}, &model.MaterialShop{Base: model.Base{ID: 301}, IsVerified: false, IsSettled: true}, 8)
		if !hasBlockerCode(result.Visibility.Blockers, "shop_unverified") || !hasBlockerCode(result.Visibility.Blockers, "deep_link_visibility_mismatch") {
			t.Fatalf("expected shop_unverified and deep_link_visibility_mismatch, got %v", result.Visibility.Blockers)
		}
	})

	t.Run("rejected resubmittable true", func(t *testing.T) {
		result := resolver.ResolveMaterialShopApplication(model.MaterialShopApplication{Status: 2}, &model.MaterialShop{Base: model.Base{ID: 302}, IsVerified: true}, 10)
		if !result.Actions.RejectResubmittable {
			t.Fatalf("rejected should be reject-resubmittable")
		}
	})
}

func TestAdminVisibilityResolver_IdentityApplication(t *testing.T) {
	setupPublicVisibilitySchema(t)
	resolver := NewAdminVisibilityResolver()

	t.Run("approved identity only not enough", func(t *testing.T) {
		result := resolver.ResolveIdentityApplication(model.IdentityApplication{Status: 1, IdentityType: "provider"}, &model.Provider{Base: model.Base{ID: 401}, Verified: true, Status: 1}, false)
		if !hasBlockerCode(result.Visibility.Blockers, "identity_only_not_profile_complete") {
			t.Fatalf("expected identity_only_not_profile_complete")
		}
		if result.Visibility.PublicVisible {
			t.Fatalf("should not be public visible")
		}
	})

	t.Run("pending preview present", func(t *testing.T) {
		result := resolver.ResolveIdentityApplication(model.IdentityApplication{Status: 0, IdentityType: "provider"}, nil, false)
		if result.Visibility.PreviewAfterApprove == nil {
			t.Fatalf("expected preview")
		}
		if !hasBlockerCode(result.Visibility.PreviewAfterApprove.Blockers, "identity_only_not_profile_complete") {
			t.Fatalf("expected identity_only_not_profile_complete in preview")
		}
		if result.Actions.RejectResubmittable {
			t.Fatalf("pending should not be reject-resubmittable")
		}
	})
}

func TestAdminVisibilityResolver_CaseAudit(t *testing.T) {
	setupPublicVisibilitySchema(t)
	resolver := NewAdminVisibilityResolver()

	t.Run("create pending preview visible", func(t *testing.T) {
		result := resolver.ResolveCaseAudit(model.CaseAudit{Status: 0, ActionType: "create"}, nil)
		if !hasBlockerCode(result.Visibility.Blockers, "application_pending") {
			t.Fatalf("expected application_pending")
		}
		if result.Visibility.PreviewAfterApprove == nil || !result.Visibility.PreviewAfterApprove.PublicVisible {
			t.Fatalf("expected preview visible for create")
		}
	})

	t.Run("update pending keeps hidden", func(t *testing.T) {
		result := resolver.ResolveCaseAudit(model.CaseAudit{Status: 0, ActionType: "update", CaseID: uint64Ptr(9001)}, &model.ProviderCase{ShowInInspiration: false})
		if !hasBlockerCode(result.Visibility.Blockers, "case_hidden_from_inspiration") {
			t.Fatalf("expected case_hidden_from_inspiration")
		}
		if result.Visibility.PreviewAfterApprove == nil || result.Visibility.PreviewAfterApprove.PublicVisible {
			t.Fatalf("expected preview not visible for hidden update")
		}
	})

	t.Run("delete pending preview invisible", func(t *testing.T) {
		result := resolver.ResolveCaseAudit(model.CaseAudit{Status: 0, ActionType: "delete", CaseID: uint64Ptr(9002)}, &model.ProviderCase{ShowInInspiration: true})
		if result.Visibility.PreviewAfterApprove == nil || result.Visibility.PreviewAfterApprove.PublicVisible {
			t.Fatalf("expected delete preview invisible")
		}
	})

	t.Run("missing original legacy", func(t *testing.T) {
		result := resolver.ResolveCaseAudit(model.CaseAudit{Status: 0, ActionType: "update", CaseID: uint64Ptr(9003)}, nil)
		if !hasBlockerCode(result.Visibility.Blockers, "case_missing_original") || !hasBlockerCode(result.Visibility.Blockers, "legacy_data_incomplete") {
			t.Fatalf("expected legacy blockers, got %v", result.Visibility.Blockers)
		}
		if result.LegacyInfo == nil || !result.LegacyInfo.IsLegacyPath {
			t.Fatalf("expected legacy info")
		}
	})

	t.Run("case reject resubmittable semantics", func(t *testing.T) {
		pending := resolver.ResolveCaseAudit(model.CaseAudit{Status: 0, ActionType: "create"}, nil)
		if pending.Actions.RejectResubmittable {
			t.Fatalf("pending case audit should not be reject-resubmittable")
		}
		rejected := resolver.ResolveCaseAudit(model.CaseAudit{Status: 2, ActionType: "create"}, nil)
		if !rejected.Actions.RejectResubmittable {
			t.Fatalf("rejected case audit should be reject-resubmittable")
		}
	})
}
