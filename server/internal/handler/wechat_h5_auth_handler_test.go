package handler

import "testing"

func TestNormalizeWechatH5BasePath(t *testing.T) {
	tests := []struct {
		name string
		raw  string
		want string
	}{
		{name: "default", raw: "", want: "/app"},
		{name: "already normalized", raw: "/app", want: "/app"},
		{name: "without leading slash", raw: "app", want: "/app"},
		{name: "trim trailing slash", raw: "/app/", want: "/app"},
		{name: "root becomes empty", raw: "/", want: ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := normalizeWechatH5BasePath(tt.raw); got != tt.want {
				t.Fatalf("normalizeWechatH5BasePath(%q) = %q, want %q", tt.raw, got, tt.want)
			}
		})
	}
}

func TestBuildWechatH5RedirectURI(t *testing.T) {
	origin := "https://example.com/"
	got := buildWechatH5RedirectURI(origin, "/app/")
	want := "https://example.com/app/#/pages/auth/wechat-callback/index"
	if got != want {
		t.Fatalf("buildWechatH5RedirectURI() = %q, want %q", got, want)
	}
}
