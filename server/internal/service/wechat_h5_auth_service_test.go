package service

import (
	"net/url"
	"strings"
	"testing"

	"home-decoration-server/internal/config"
)

func TestWechatH5AuthorizeURL_StateValid(t *testing.T) {
	InitJWT("test-jwt-secret")

	svc := NewWechatH5AuthService(config.WechatH5Config{
		AppID:                  "wx_test_appid",
		AppSecret:              "wx_test_secret",
		OAuthScope:             "snsapi_base",
		StateSigningSecret:     "test-state-secret",
		BindTokenExpireMinutes: 5,
	})

	redirectURI := "https://example.com/#/pages/auth/wechat-callback/index"
	res, err := svc.AuthorizeURL(redirectURI)
	if err != nil {
		t.Fatalf("AuthorizeURL err: %v", err)
	}
	if res == nil || res.URL == "" || res.State == "" {
		t.Fatalf("unexpected authorize result: %#v", res)
	}

	u, err := url.Parse(res.URL)
	if err != nil {
		t.Fatalf("parse authorize url: %v", err)
	}
	if !strings.Contains(u.Host, "open.weixin.qq.com") {
		t.Fatalf("unexpected authorize host: %s", u.Host)
	}
	if got := u.Query().Get("appid"); got != "wx_test_appid" {
		t.Fatalf("unexpected appid: %q", got)
	}
	if got := u.Query().Get("state"); got == "" {
		t.Fatalf("missing state in authorize url")
	}

	if err := svc.client.verifyState(res.State, redirectURI); err != nil {
		t.Fatalf("verifyState should succeed: %v", err)
	}
}

func TestWechatH5AuthorizeURL_StateRedirectMismatch(t *testing.T) {
	InitJWT("test-jwt-secret")

	svc := NewWechatH5AuthService(config.WechatH5Config{
		AppID:                  "wx_test_appid",
		AppSecret:              "wx_test_secret",
		OAuthScope:             "snsapi_base",
		StateSigningSecret:     "test-state-secret",
		BindTokenExpireMinutes: 5,
	})

	redirect1 := "https://example.com/#/pages/auth/wechat-callback/index"
	redirect2 := "https://evil.example.com/#/pages/auth/wechat-callback/index"

	res, err := svc.AuthorizeURL(redirect1)
	if err != nil {
		t.Fatalf("AuthorizeURL err: %v", err)
	}

	if err := svc.client.verifyState(res.State, redirect2); err == nil {
		t.Fatalf("verifyState should fail for mismatched redirect")
	}
}

func TestWechatH5BindToken_RoundTrip(t *testing.T) {
	InitJWT("test-jwt-secret")

	svc := NewWechatH5AuthService(config.WechatH5Config{
		AppID:                  "wx_test_appid",
		AppSecret:              "wx_test_secret",
		StateSigningSecret:     "test-state-secret",
		BindTokenExpireMinutes: 5,
	})

	token, _, err := svc.client.generateBindToken("openid_1", "union_1")
	if err != nil {
		t.Fatalf("generateBindToken err: %v", err)
	}

	claims, err := svc.client.parseBindToken(token)
	if err != nil {
		t.Fatalf("parseBindToken err: %v", err)
	}
	if claims.OpenID != "openid_1" {
		t.Fatalf("unexpected openid: %q", claims.OpenID)
	}
	if claims.AppID != "wx_test_appid" {
		t.Fatalf("unexpected appid: %q", claims.AppID)
	}
}

func TestWechatH5AuthorizeURL_StateTampered(t *testing.T) {
	InitJWT("test-jwt-secret")

	svc := NewWechatH5AuthService(config.WechatH5Config{
		AppID:                  "wx_test_appid",
		AppSecret:              "wx_test_secret",
		OAuthScope:             "snsapi_base",
		StateSigningSecret:     "test-state-secret",
		BindTokenExpireMinutes: 5,
	})

	redirectURI := "https://example.com/#/pages/auth/wechat-callback/index"
	res, err := svc.AuthorizeURL(redirectURI)
	if err != nil {
		t.Fatalf("AuthorizeURL err: %v", err)
	}

	tampered := res.State + "x"
	if err := svc.client.verifyState(tampered, redirectURI); err == nil {
		t.Fatalf("verifyState should fail for tampered state")
	}
}
