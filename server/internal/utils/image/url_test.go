package image

import (
	"testing"

	"home-decoration-server/internal/config"
)

func TestGetFullImageURL_NormalizesProductionLocalAssetAbsoluteURL(t *testing.T) {
	t.Setenv("APP_ENV", config.AppEnvProduction)

	cfg := config.GetConfig()
	previous := *cfg
	cfg.Server.PublicURL = "https://api.hezeyunchuang.com"
	cfg.Storage.PublicBaseURL = ""
	t.Cleanup(func() {
		*cfg = previous
	})

	got := GetFullImageURL("http://api.hezeyunchuang.com/uploads/cases/demo.jpg")
	want := "https://api.hezeyunchuang.com/uploads/cases/demo.jpg"
	if got != want {
		t.Fatalf("GetFullImageURL() = %q, want %q", got, want)
	}
}

func TestGetFullImageURL_NormalizesStoragePublicBaseURLToHTTPSInProduction(t *testing.T) {
	t.Setenv("APP_ENV", config.AppEnvProduction)

	cfg := config.GetConfig()
	previous := *cfg
	cfg.Server.PublicURL = "https://api.hezeyunchuang.com"
	cfg.Storage.PublicBaseURL = "http://api.hezeyunchuang.com"
	t.Cleanup(func() {
		*cfg = previous
	})

	got := GetFullImageURL("/uploads/providers/avatar.png")
	want := "https://api.hezeyunchuang.com/uploads/providers/avatar.png"
	if got != want {
		t.Fatalf("GetFullImageURL() = %q, want %q", got, want)
	}
}

func TestGetFullImageURL_LeavesExternalHTTPURLUntouched(t *testing.T) {
	t.Setenv("APP_ENV", config.AppEnvProduction)

	cfg := config.GetConfig()
	previous := *cfg
	cfg.Server.PublicURL = "https://api.hezeyunchuang.com"
	cfg.Storage.PublicBaseURL = ""
	t.Cleanup(func() {
		*cfg = previous
	})

	input := "http://third-party.example.com/assets/demo.jpg"
	if got := GetFullImageURL(input); got != input {
		t.Fatalf("GetFullImageURL() = %q, want %q", got, input)
	}
}

func TestGetFullImageURL_IgnoresUnresolvedStoragePublicBaseURLPlaceholder(t *testing.T) {
	cfg := config.GetConfig()
	previous := *cfg
	cfg.Server.PublicURL = "http://localhost:8080"
	cfg.Storage.PublicBaseURL = "${STORAGE_PUBLIC_BASE_URL}"
	t.Cleanup(func() {
		*cfg = previous
	})

	got := GetFullImageURL("/uploads/remote-cache/avatar.jpg")
	want := "http://localhost:8080/uploads/remote-cache/avatar.jpg"
	if got != want {
		t.Fatalf("GetFullImageURL() = %q, want %q", got, want)
	}
}
