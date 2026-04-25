package service

import "testing"

func TestNormalizeAmountRoundsByCents(t *testing.T) {
	if got := normalizeAmount(0.1 + 0.2); got != 0.3 {
		t.Fatalf("expected cent-normalized amount 0.3, got %.12f", got)
	}
	if got := normalizeAmount(-0.01); got != 0 {
		t.Fatalf("expected negative amount to normalize to zero, got %.2f", got)
	}
}
