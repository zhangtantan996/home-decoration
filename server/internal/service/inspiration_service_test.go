package service

import (
	"testing"

	"home-decoration-server/internal/model"
)

func TestResolveInspirationAuthorNamePrefersUserNickname(t *testing.T) {
	provider := model.Provider{CompanyName: "华美装饰设计公司"}
	user := &model.User{Nickname: "燕归来"}

	got := resolveInspirationAuthorName(provider, user)
	if got != "燕归来" {
		t.Fatalf("expected nickname first, got %q", got)
	}
}

func TestResolveInspirationAuthorNameFallsBackToCompanyName(t *testing.T) {
	provider := model.Provider{CompanyName: "强设计工作室"}

	got := resolveInspirationAuthorName(provider, nil)
	if got != "强设计工作室" {
		t.Fatalf("expected company name fallback, got %q", got)
	}
}
