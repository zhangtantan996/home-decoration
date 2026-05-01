package service

import (
	"encoding/json"
	"os"
	"strings"
	"testing"
	"time"

	appconfig "home-decoration-server/internal/config"
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"

	gormsqlite "gorm.io/driver/sqlite"
	"gorm.io/gorm"
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

func TestSetConfigRejectsUnknownAndDeprecatedKeys(t *testing.T) {
	setupConfigServiceTestDB(t)
	svc := &ConfigService{}

	if err := svc.SetConfig("unknown.typo", "1", "bad"); err == nil {
		t.Fatal("expected unknown config key to be rejected")
	}
	if err := svc.SetConfig("order.construction_fee_stages", `[{"name":"开工款","percentage":100}]`, "旧施工分期"); err == nil {
		t.Fatal("expected deprecated construction fee stages key to be rejected")
	}
}

func TestSetConfigValidatesConstructionMilestonePercentages(t *testing.T) {
	setupConfigServiceTestDB(t)
	svc := &ConfigService{}

	err := svc.SetConfig(model.ConfigKeyConstructionMilestones, `[{"name":"开工款","percentage":30},{"name":"尾款","percentage":30}]`, "施工分期")
	if err == nil {
		t.Fatal("expected construction milestones with non-100 total to fail")
	}

	valid := `[{"name":"开工款","percentage":30},{"name":"尾款","percentage":70}]`
	if err := svc.SetConfig(model.ConfigKeyConstructionMilestones, valid, "施工分期"); err != nil {
		t.Fatalf("expected valid construction milestones to pass, got %v", err)
	}
	milestones, err := svc.GetConstructionMilestones()
	if err != nil {
		t.Fatalf("get construction milestones: %v", err)
	}
	if len(milestones) != 2 || milestones[1].Percentage != 70 {
		t.Fatalf("unexpected milestones: %+v", milestones)
	}
}

func TestGetTencentIMConfigReadsSecretFromEnvOnly(t *testing.T) {
	setupConfigServiceTestDB(t)
	svc := &ConfigService{}
	t.Setenv("TENCENT_IM_SECRET_KEY", "env-secret")

	if err := repository.DB.Create(&[]model.SystemConfig{
		{Key: model.ConfigKeyTencentIMSDKAppID, Value: "140001", Editable: true},
		{Key: model.ConfigKeyTencentIMEnabled, Value: "true", Editable: true},
		{Key: model.ConfigKeyTencentIMSecretKey, Value: "db-secret", Editable: true},
	}).Error; err != nil {
		t.Fatalf("seed configs: %v", err)
	}
	svc.ClearCache()

	cfg, err := svc.GetTencentIMConfig()
	if err != nil {
		t.Fatalf("get im config: %v", err)
	}
	if cfg.SecretKey != "env-secret" {
		t.Fatalf("expected env secret, got %q", cfg.SecretKey)
	}

	_ = os.Unsetenv("TENCENT_IM_SECRET_KEY")
	svc.ClearCache()
	cfg, err = svc.GetTencentIMConfig()
	if err != nil {
		t.Fatalf("get im config without env: %v", err)
	}
	if cfg.SecretKey != "" {
		t.Fatalf("expected DB secret to be ignored, got %q", cfg.SecretKey)
	}
}

func setupConfigServiceTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	db, err := gorm.Open(gormsqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite db: %v", err)
	}
	if err := db.AutoMigrate(&model.SystemConfig{}); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}

	previousDB := repository.DB
	repository.DB = db
	t.Cleanup(func() { repository.DB = previousDB })

	return db
}

func TestSetConfigMiniHomePopupNormalizesPayloadAndAssignsCampaignVersion(t *testing.T) {
	setupConfigServiceTestDB(t)
	svc := &ConfigService{}

	raw := `{
		"enabled": true,
		"theme": "sunrise",
		"kicker": "免费预估",
		"title": "30 秒生成装修报价",
		"subtitle": "填写几项信息，快速拿到装修预算参考。",
		"primaryAction": {"text": "立即生成", "path": "/pages/quote-inquiry/create/index"},
		"secondaryAction": {"enabled": true, "text": "先看看服务商", "path": "/pages/home/index"},
		"frequency": "daily_once"
	}`

	if err := svc.SetConfig(model.ConfigKeyMiniHomePopup, raw, "首页运营弹窗"); err != nil {
		t.Fatalf("set config: %v", err)
	}

	var stored model.SystemConfig
	if err := repository.DB.Where("key = ?", model.ConfigKeyMiniHomePopup).First(&stored).Error; err != nil {
		t.Fatalf("load stored config: %v", err)
	}

	var popup MiniHomePopupConfig
	if err := json.Unmarshal([]byte(stored.Value), &popup); err != nil {
		t.Fatalf("unmarshal stored popup: %v", err)
	}

	if popup.CampaignVersion == "" {
		t.Fatal("expected campaignVersion to be assigned")
	}
	if popup.HeroImageURL != "/static/home-popup/default-quote-hero.svg" {
		t.Fatalf("unexpected hero image url: %s", popup.HeroImageURL)
	}
	if popup.PrimaryAction.Path != "/pages/quote-inquiry/create/index" {
		t.Fatalf("unexpected primary path: %s", popup.PrimaryAction.Path)
	}
	if popup.SecondaryAction.Path != "/pages/home/index" {
		t.Fatalf("unexpected secondary path: %s", popup.SecondaryAction.Path)
	}
}

func TestSetConfigMiniHomePopupRejectsInvalidActionPath(t *testing.T) {
	setupConfigServiceTestDB(t)
	svc := &ConfigService{}

	raw := `{
		"enabled": true,
		"title": "30 秒生成装修报价",
		"primaryAction": {"text": "立即生成", "path": "https://example.com"},
		"frequency": "daily_once"
	}`

	err := svc.SetConfig(model.ConfigKeyMiniHomePopup, raw, "首页运营弹窗")
	if err == nil {
		t.Fatal("expected invalid path to fail")
	}
	if !strings.Contains(err.Error(), "路径") {
		t.Fatalf("expected path validation error, got %v", err)
	}
}

func TestSetConfigMiniHomePopupAcceptsExpandedFrequencies(t *testing.T) {
	setupConfigServiceTestDB(t)
	svc := &ConfigService{}

	frequencies := []string{
		MiniHomePopupFrequencyEveryTime,
		MiniHomePopupFrequencyDailyOnce,
		MiniHomePopupFrequencyDailyTwice,
		MiniHomePopupFrequencyDailyThreeTimes,
		MiniHomePopupFrequencyCampaignOnce,
	}

	for _, frequency := range frequencies {
		raw := `{
			"enabled": true,
			"title": "30 秒生成装修报价",
			"primaryAction": {"text": "立即生成", "path": "/pages/quote-inquiry/create/index"},
			"frequency": "` + frequency + `"
		}`

		if err := svc.SetConfig(model.ConfigKeyMiniHomePopup, raw, "首页运营弹窗"); err != nil {
			t.Fatalf("frequency %s should pass, got %v", frequency, err)
		}
	}
}

func TestGetActiveMiniHomePopupHonorsEnabledAndTimeWindow(t *testing.T) {
	setupConfigServiceTestDB(t)
	svc := &ConfigService{}

	now := time.Date(2026, 4, 20, 10, 0, 0, 0, time.UTC)
	activeJSON := `{
		"enabled": true,
		"campaignVersion": "campaign-active",
		"theme": "sunrise",
		"kicker": "免费预估",
		"title": "30 秒生成装修报价",
		"subtitle": "填写几项信息，快速拿到装修预算参考。",
		"primaryAction": {"text": "立即生成", "path": "/pages/quote-inquiry/create/index"},
		"secondaryAction": {"enabled": true, "text": "先看看服务商", "path": "/pages/home/index"},
		"frequency": "daily_once",
		"startAt": "2026-04-20T09:00:00Z",
		"endAt": "2026-04-20T12:00:00Z"
	}`

	if err := svc.SetConfig(model.ConfigKeyMiniHomePopup, activeJSON, "首页运营弹窗"); err != nil {
		t.Fatalf("seed active popup: %v", err)
	}

	popup, err := svc.GetActiveMiniHomePopupAt(now)
	if err != nil {
		t.Fatalf("get active popup: %v", err)
	}
	if popup == nil {
		t.Fatal("expected active popup")
	}

	disabledJSON := `{
		"enabled": false,
		"campaignVersion": "campaign-disabled",
		"theme": "sunrise",
		"title": "30 秒生成装修报价",
		"primaryAction": {"text": "立即生成", "path": "/pages/quote-inquiry/create/index"},
		"frequency": "daily_once"
	}`
	if err := svc.SetConfig(model.ConfigKeyMiniHomePopup, disabledJSON, "首页运营弹窗"); err != nil {
		t.Fatalf("seed disabled popup: %v", err)
	}

	popup, err = svc.GetActiveMiniHomePopupAt(now)
	if err != nil {
		t.Fatalf("get disabled popup: %v", err)
	}
	if popup != nil {
		t.Fatalf("expected disabled popup to be filtered, got %+v", popup)
	}

	expiredJSON := `{
		"enabled": true,
		"campaignVersion": "campaign-expired",
		"theme": "sunrise",
		"title": "30 秒生成装修报价",
		"primaryAction": {"text": "立即生成", "path": "/pages/quote-inquiry/create/index"},
		"frequency": "daily_once",
		"startAt": "2026-04-19T09:00:00Z",
		"endAt": "2026-04-19T12:00:00Z"
	}`
	if err := svc.SetConfig(model.ConfigKeyMiniHomePopup, expiredJSON, "首页运营弹窗"); err != nil {
		t.Fatalf("seed expired popup: %v", err)
	}

	popup, err = svc.GetActiveMiniHomePopupAt(now)
	if err != nil {
		t.Fatalf("get expired popup: %v", err)
	}
	if popup != nil {
		t.Fatalf("expected expired popup to be filtered, got %+v", popup)
	}
}
