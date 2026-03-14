package service

import (
	"testing"

	"home-decoration-server/internal/model"
)

func TestEvaluateProviderPublicVisibility(t *testing.T) {
	visible := EvaluateProviderPublicVisibility(&model.Provider{Verified: true, Status: 1})
	if !visible.PublicVisible || len(visible.Blockers) != 0 {
		t.Fatalf("expected visible provider, got %+v", visible)
	}

	hidden := EvaluateProviderPublicVisibility(&model.Provider{Verified: false, Status: 0})
	if hidden.PublicVisible {
		t.Fatalf("expected hidden provider")
	}
	if !hasBlockerCode(hidden.Blockers, "provider_unverified") || !hasBlockerCode(hidden.Blockers, "provider_frozen") {
		t.Fatalf("expected provider blockers, got %+v", hidden.Blockers)
	}
}

func TestEvaluateMaterialShopPublicVisibility(t *testing.T) {
	visible := EvaluateMaterialShopPublicVisibility(&model.MaterialShop{IsVerified: true}, 0)
	if !visible.PublicVisible || len(visible.Blockers) != 0 {
		t.Fatalf("expected visible material shop, got %+v", visible)
	}

	hidden := EvaluateMaterialShopPublicVisibility(&model.MaterialShop{IsVerified: false}, 4)
	if hidden.PublicVisible {
		t.Fatalf("expected hidden material shop")
	}
	if !hasBlockerCode(hidden.Blockers, "shop_unverified") {
		t.Fatalf("expected material shop blockers, got %+v", hidden.Blockers)
	}
}

func TestEvaluateCasePublicVisibility(t *testing.T) {
	visible := EvaluateCasePublicVisibility(&model.ProviderCase{ShowInInspiration: true})
	if !visible.PublicVisible || len(visible.Blockers) != 0 {
		t.Fatalf("expected visible case, got %+v", visible)
	}

	hidden := EvaluateCasePublicVisibility(&model.ProviderCase{ShowInInspiration: false})
	if hidden.PublicVisible {
		t.Fatalf("expected hidden case")
	}
	if !hasBlockerCode(hidden.Blockers, "case_hidden_from_inspiration") {
		t.Fatalf("expected case_hidden_from_inspiration blocker, got %+v", hidden.Blockers)
	}
}
