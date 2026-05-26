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

func TestGetFullImageURL_LeavesUntrustedExternalURLUntouched(t *testing.T) {
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

func TestGetFullImageURL_BlocksJavascriptScheme(t *testing.T) {
	if got := GetFullImageURL("javascript:alert(1)"); got != "" {
		t.Fatalf("GetFullImageURL() = %q, want empty (blocked javascript:)", got)
	}
}

func TestGetFullImageURL_BlocksDataScheme(t *testing.T) {
	if got := GetFullImageURL("data:text/html,<script>alert(1)</script>"); got != "" {
		t.Fatalf("GetFullImageURL() = %q, want empty (blocked data:)", got)
	}
}

func TestGetFullImageURL_AllowsConfiguredPublicAssetHost(t *testing.T) {
	t.Setenv("APP_ENV", config.AppEnvProduction)

	cfg := config.GetConfig()
	previous := *cfg
	cfg.Server.PublicURL = "https://api.hezeyunchuang.com"
	cfg.Storage.PublicBaseURL = ""
	t.Cleanup(func() {
		*cfg = previous
	})

	input := "https://api.hezeyunchuang.com/uploads/cases/demo.jpg"
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

func TestIsSafeEvidenceURLBlocksDangerousSchemes(t *testing.T) {
	for _, value := range []string{
		"javascript:alert(1)",
		"data:text/html,<script>alert(1)</script>",
		"vbscript:msgbox(1)",
		"file:///etc/passwd",
		"about:blank",
	} {
		if IsSafeEvidenceURL(value) {
			t.Fatalf("expected %q to be rejected as evidence URL", value)
		}
	}
}

func TestIsSafeEvidenceURLAllowsHTTPAndLocalAssets(t *testing.T) {
	for _, value := range []string{
		"https://example.com/evidence/1",
		"http://example.com/evidence/1",
		"/uploads/evidence/a.png",
		"/static/docs/a.pdf",
	} {
		if !IsSafeEvidenceURL(value) {
			t.Fatalf("expected %q to be accepted as evidence URL", value)
		}
	}
}

func TestIsLocalAssetReferenceRejectsExternalHTTP(t *testing.T) {
	cfg := config.GetConfig()
	previous := *cfg
	cfg.Server.PublicURL = "https://api.hezeyunchuang.com"
	cfg.Storage.PublicBaseURL = ""
	t.Cleanup(func() {
		*cfg = previous
	})

	if !IsLocalAssetReference("/uploads/providers/avatar.png") {
		t.Fatalf("expected local upload path to be accepted")
	}
	if !IsLocalAssetReference("https://api.hezeyunchuang.com/uploads/providers/avatar.png") {
		t.Fatalf("expected configured public asset host to be accepted")
	}
	if IsLocalAssetReference("https://third-party.example.com/uploads/providers/avatar.png") {
		t.Fatalf("expected external upload-looking URL to be rejected")
	}
	if IsLocalAssetReference("https://third-party.example.com/avatar.png") {
		t.Fatalf("expected external http asset reference to be rejected")
	}
}

func TestNormalizeStoredImagePathDoesNotConvertUntrustedUploadURL(t *testing.T) {
	cfg := config.GetConfig()
	previous := *cfg
	cfg.Server.PublicURL = "https://api.hezeyunchuang.com"
	cfg.Storage.PublicBaseURL = ""
	t.Cleanup(func() {
		*cfg = previous
	})

	trusted := "https://api.hezeyunchuang.com/uploads/providers/avatar.png"
	if got := NormalizeStoredImagePath(trusted); got != "/uploads/providers/avatar.png" {
		t.Fatalf("expected trusted local asset URL to normalize to path, got %q", got)
	}

	untrusted := "https://third-party.example.com/uploads/providers/avatar.png"
	if got := NormalizeStoredImagePath(untrusted); got != untrusted {
		t.Fatalf("expected untrusted upload-looking URL to stay external, got %q", got)
	}
}
