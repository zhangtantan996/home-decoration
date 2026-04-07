package service

import (
	"strings"
	"testing"

	appconfig "home-decoration-server/internal/config"
	"home-decoration-server/internal/model"
)

func TestValidatePaymentChannelRuntimeConfig_AlipayAllowsServerPublicURLFallback(t *testing.T) {
	cfg := appconfig.GetConfig()
	previous := *cfg
	cfg.Alipay.AppID = "sandbox-app-id"
	cfg.Alipay.AppPrivateKey = "private-key"
	cfg.Alipay.PublicKey = "public-key"
	cfg.Alipay.NotifyURL = ""
	cfg.Alipay.GatewayURL = "https://openapi-sandbox.dl.alipaydev.com/gateway.do"
	cfg.Server.PublicURL = "https://server.example.com"
	t.Cleanup(func() {
		*cfg = previous
	})

	if err := (&ConfigService{}).ValidatePaymentChannelRuntimeConfig(model.PaymentChannelAlipay); err != nil {
		t.Fatalf("expected server public url fallback to pass, got %v", err)
	}
}

func TestValidatePaymentChannelRuntimeConfig_AlipayRequiresNotifyURLWhenNoServerPublicURL(t *testing.T) {
	cfg := appconfig.GetConfig()
	previous := *cfg
	cfg.Alipay.AppID = "sandbox-app-id"
	cfg.Alipay.AppPrivateKey = "private-key"
	cfg.Alipay.PublicKey = "public-key"
	cfg.Alipay.NotifyURL = ""
	cfg.Alipay.GatewayURL = "https://openapi-sandbox.dl.alipaydev.com/gateway.do"
	cfg.Server.PublicURL = ""
	t.Cleanup(func() {
		*cfg = previous
	})

	err := (&ConfigService{}).ValidatePaymentChannelRuntimeConfig(model.PaymentChannelAlipay)
	if err == nil {
		t.Fatal("expected missing notify/public url to fail")
	}
	if !strings.Contains(err.Error(), "支付回调地址") {
		t.Fatalf("expected notify url error, got %v", err)
	}
}

func TestValidatePaymentChannelRuntimeConfig_WechatRejectsIncompletePlatformPublicKeyConfig(t *testing.T) {
	cfg := appconfig.GetConfig()
	previous := *cfg
	cfg.WechatMini.AppID = "mini-app-id"
	cfg.WechatPay.AppID = "mini-app-id"
	cfg.WechatPay.MchID = "1900000109"
	cfg.WechatPay.SerialNo = "SERIAL"
	cfg.WechatPay.PrivateKey = "PRIVATE"
	cfg.WechatPay.APIv3Key = "0123456789abcdef0123456789abcdef"
	cfg.WechatPay.NotifyURL = "https://api.example.com/api/v1/payments/wechat/notify"
	cfg.WechatPay.PlatformPublicKeyID = "PUB_KEY_ID"
	cfg.WechatPay.PlatformPublicKey = ""
	t.Cleanup(func() {
		*cfg = previous
	})

	err := (&ConfigService{}).ValidatePaymentChannelRuntimeConfig(model.PaymentChannelWechat)
	if err == nil {
		t.Fatal("expected incomplete platform public key config to fail")
	}
	if !strings.Contains(err.Error(), "平台公钥配置不完整") {
		t.Fatalf("expected platform public key error, got %v", err)
	}
}
