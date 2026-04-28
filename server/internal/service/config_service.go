package service

import (
	"encoding/json"
	"errors"
	appconfig "home-decoration-server/internal/config"
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	"strconv"
	"strings"
	"sync"
	"time"

	"gorm.io/gorm"
)

// ConfigService 系统配置服务
type ConfigService struct{}

var (
	configCache     = make(map[string]string)
	configCacheMu   sync.RWMutex
	configCacheInit sync.Once
)

func (s *ConfigService) getConfigValue(tx *gorm.DB, key string) (string, error) {
	// 先从缓存读取
	configCacheMu.RLock()
	if val, ok := configCache[key]; ok {
		configCacheMu.RUnlock()
		return val, nil
	}
	configCacheMu.RUnlock()

	queryDB := repository.DB
	if tx != nil {
		queryDB = tx
	}

	var config model.SystemConfig
	if err := queryDB.Where("key = ?", key).First(&config).Error; err != nil {
		return "", err
	}

	// 写入缓存
	configCacheMu.Lock()
	configCache[key] = config.Value
	configCacheMu.Unlock()

	return config.Value, nil
}

// GetConfig 获取配置值
func (s *ConfigService) GetConfig(key string) (string, error) {
	return s.getConfigValue(nil, key)
}

func (s *ConfigService) GetConfigTx(tx *gorm.DB, key string) (string, error) {
	return s.getConfigValue(tx, key)
}

// GetConfigFloat 获取浮点数配置
func (s *ConfigService) GetConfigFloat(key string) (float64, error) {
	val, err := s.GetConfig(key)
	if err != nil {
		return 0, err
	}
	return strconv.ParseFloat(val, 64)
}

func (s *ConfigService) GetConfigFloatTx(tx *gorm.DB, key string) (float64, error) {
	val, err := s.GetConfigTx(tx, key)
	if err != nil {
		return 0, err
	}
	return strconv.ParseFloat(val, 64)
}

// GetConfigBool 获取布尔配置
func (s *ConfigService) GetConfigBool(key string) (bool, error) {
	val, err := s.GetConfig(key)
	if err != nil {
		return false, err
	}
	return strconv.ParseBool(val)
}

func (s *ConfigService) GetConfigBoolTx(tx *gorm.DB, key string) (bool, error) {
	val, err := s.GetConfigTx(tx, key)
	if err != nil {
		return false, err
	}
	return strconv.ParseBool(val)
}

// GetConfigInt 获取整数配置
func (s *ConfigService) GetConfigInt(key string) (int, error) {
	val, err := s.GetConfig(key)
	if err != nil {
		return 0, err
	}
	return strconv.Atoi(val)
}

func (s *ConfigService) GetConfigIntTx(tx *gorm.DB, key string) (int, error) {
	val, err := s.GetConfigTx(tx, key)
	if err != nil {
		return 0, err
	}
	return strconv.Atoi(val)
}

// GetConfigJSON 获取 JSON 配置
func (s *ConfigService) GetConfigJSON(key string, target interface{}) error {
	val, err := s.GetConfig(key)
	if err != nil {
		return err
	}
	return json.Unmarshal([]byte(val), target)
}

func (s *ConfigService) setConfigValue(tx *gorm.DB, key, value, description string) error {
	if key == model.ConfigKeyMiniHomePopup {
		normalized, err := normalizeMiniHomePopupConfigPayload(value, time.Now())
		if err != nil {
			return err
		}
		bytes, err := json.Marshal(normalized)
		if err != nil {
			return err
		}
		value = string(bytes)
	}

	queryDB := repository.DB
	if tx != nil {
		queryDB = tx
	}

	var config model.SystemConfig
	err := queryDB.Where("key = ?", key).First(&config).Error
	if err != nil {
		// 不存在则创建
		config = model.SystemConfig{
			Key:         key,
			Value:       value,
			Description: description,
			Editable:    true,
		}
		if err := queryDB.Create(&config).Error; err != nil {
			return err
		}
	} else {
		// 存在则更新
		config.Value = value
		if description != "" {
			config.Description = description
		}
		if err := queryDB.Save(&config).Error; err != nil {
			return err
		}
	}

	if tx != nil {
		return nil
	}

	// 更新缓存
	configCacheMu.Lock()
	configCache[key] = value
	configCacheMu.Unlock()

	return nil
}

// SetConfig 设置配置值（管理后台使用）
func (s *ConfigService) SetConfig(key, value, description string) error {
	return s.setConfigValue(nil, key, value, description)
}

// SetConfigTx 在事务中设置配置值。
func (s *ConfigService) SetConfigTx(tx *gorm.DB, key, value, description string) error {
	return s.setConfigValue(tx, key, value, description)
}

// ClearCache 清除配置缓存
func (s *ConfigService) ClearCache() {
	configCacheMu.Lock()
	configCache = make(map[string]string)
	configCacheMu.Unlock()
}

// InitDefaultConfigs 初始化默认配置
func (s *ConfigService) InitDefaultConfigs() error {
	defaults := []struct {
		Key         string
		Value       string
		Description string
	}{
		{model.ConfigKeyIntentFee, "99", "预约量房费金额（兼容旧配置）"},
		{model.ConfigKeySurveyDepositDefault, "500", "量房费默认金额（元）"},
		{model.ConfigKeySurveyRefundNotice, "量房完成后若不继续设计，默认退回 60% 给用户，剩余 40% 冻结待平台判定；若后续确认设计方案，量房费转为设计费的一部分。", "量房费退款说明文案"},
		{model.ConfigKeySurveyRefundUserPercent, "60", "量房后终止时退给用户的百分比"},
		{model.ConfigKeyIntentFeeRefundable, "false", "量房费是否可退（兼容旧配置）"},
		{model.ConfigKeyDesignFeeUnlockDownload, "true", "支付设计费后解锁图纸下载"},
		{model.ConfigKeyDesignFeePaymentMode, "onetime", "设计费支付模式：onetime / staged"},
		{model.ConfigKeyDesignFeeStages, `[{"name":"签约款","percentage":50},{"name":"终稿款","percentage":50}]`, "设计费分阶段付款比例"},
		{model.ConfigKeyConstructionPaymentMode, "milestone", "施工费支付模式：milestone / onetime"},
		{model.ConfigKeyConstructionMilestones, `[{"name":"开工款","percentage":30},{"name":"水电款","percentage":35},{"name":"中期款","percentage":30},{"name":"尾款","percentage":5}]`, "施工分期付款比例"},
		{model.ConfigKeyPublicIDRolloutEnabled, "false", "是否启用 publicId 灰度策略"},
		{model.ConfigKeyPublicIDRolloutMobilePercent, "5", "publicId 移动端灰度百分比(0-100)"},
		{model.ConfigKeyPublicIDRolloutDefaultPercent, "0", "publicId 其他端灰度百分比(0-100)"},
		{model.ConfigKeyPublicIDRollbackDrillEnabled, "false", "是否启用 publicId 回滚演练观测"},
		{model.ConfigKeyPublicIDRollbackForceLegacyLookup, "false", "紧急回滚: 强制仅按内部ID查询"},
		// 量房费与设计费支付配置
		{model.ConfigKeySurveyDepositRefundRate, "0.6", "量房费退款比例(不继续时退给用户,0-1)"},
		{model.ConfigKeySurveyDepositMin, "100", "设计师可设量房费最低金额"},
		{model.ConfigKeySurveyDepositMax, "2000", "设计师可设量房费最高金额"},
		{model.ConfigKeyBudgetConfirmRejectLimit, "3", "沟通确认可被用户驳回的阈值，达到后才关闭预约"},
		{model.ConfigKeyDesignFeeQuoteExpireHours, "72", "设计费报价有效期(小时)"},
		{model.ConfigKeyDeliverableDeadlineDays, "30", "设计交付件截止天数"},
		{model.ConfigKeyConstructionReleaseDelay, "3", "验收确认后T+N天自动放款"},
		{model.ConfigKeyPaymentReleaseDelayDays, "3", "支付中台统一T+N出款延迟天数"},
		{model.ConfigKeyPaymentPayoutAutoEnabled, "false", "是否启用自动出款"},
		{model.ConfigKeyPaymentChannelWechatEnabled, "false", "是否启用微信支付"},
		{model.ConfigKeyPaymentChannelAlipayEnabled, strconv.FormatBool(appconfig.GetConfig().Alipay.Enabled), "是否启用支付宝"},
		{model.ConfigKeyMiniHomePopup, defaultMiniHomePopupConfigJSON(), "小程序首页运营弹窗配置"},
		{model.ConfigKeyOutboxWorkerEnabled, "true", "是否启用事件任务 worker"},
		{model.ConfigKeyOutboxWorkerBatchSize, "20", "事件任务 worker 单批处理数量"},
		{model.ConfigKeyOutboxWorkerPollIntervalSec, "5", "事件任务 worker 轮询间隔秒数"},
		{model.ConfigKeyOutboxWorkerLockTTLSec, "60", "事件任务 worker 锁定超时秒数"},
		{model.ConfigKeyOutboxWorkerMaxRetries, "3", "事件任务默认最大重试次数"},
	}

	for _, d := range defaults {
		var existing model.SystemConfig
		err := repository.DB.Where("key = ?", d.Key).First(&existing).Error
		if err != nil {
			// 不存在则创建
			config := model.SystemConfig{
				Key:         d.Key,
				Value:       d.Value,
				Description: d.Description,
				Editable:    true,
			}
			if err := repository.DB.Create(&config).Error; err != nil {
				return err
			}
		}
	}
	return nil
}

// GetIntentFee 获取当前意向金金额
func (s *ConfigService) GetIntentFee() (float64, error) {
	return s.GetConfigFloat(model.ConfigKeyIntentFee)
}

func (s *ConfigService) GetSurveyDepositDefault() (float64, error) {
	val, err := s.GetConfigFloat(model.ConfigKeySurveyDepositDefault)
	if err == nil {
		return val, nil
	}
	return s.GetIntentFee()
}

func (s *ConfigService) GetSurveyDepositDefaultTx(tx *gorm.DB) (float64, error) {
	val, err := s.GetConfigFloatTx(tx, model.ConfigKeySurveyDepositDefault)
	if err == nil {
		return val, nil
	}
	return s.GetConfigFloatTx(tx, model.ConfigKeyIntentFee)
}

func (s *ConfigService) GetSurveyRefundNotice() string {
	val, err := s.GetConfig(model.ConfigKeySurveyRefundNotice)
	if err != nil || val == "" {
		return "量房完成后若不继续设计，默认退回 60% 给用户，剩余 40% 冻结待平台判定；若后续确认设计方案，量房费转为设计费的一部分。"
	}
	return val
}

func (s *ConfigService) GetDesignFeePaymentMode() string {
	val, err := s.GetConfig(model.ConfigKeyDesignFeePaymentMode)
	if err != nil || (val != "staged" && val != "onetime") {
		return "onetime"
	}
	return val
}

func (s *ConfigService) GetDesignFeeUnlockDownload() bool {
	val, err := s.GetConfigBool(model.ConfigKeyDesignFeeUnlockDownload)
	if err != nil {
		return true
	}
	return val
}

func (s *ConfigService) GetConstructionPaymentMode() string {
	val, err := s.GetConfig(model.ConfigKeyConstructionPaymentMode)
	if err != nil || (val != "staged" && val != "milestone" && val != "onetime") {
		return "milestone"
	}
	if val == "staged" {
		return "milestone"
	}
	return val
}

func (s *ConfigService) GetDesignFeeStages() ([]MilestoneConfig, error) {
	var milestones []MilestoneConfig
	if err := s.GetConfigJSON(model.ConfigKeyDesignFeeStages, &milestones); err != nil {
		return []MilestoneConfig{
			{Name: "签约款", Percentage: 50},
			{Name: "终稿款", Percentage: 50},
		}, nil
	}
	return milestones, nil
}

func (s *ConfigService) IsPaymentChannelEnabled(channel string) bool {
	key := paymentChannelConfigKey(channel)
	if key == "" {
		return false
	}
	value, err := s.GetConfigBool(key)
	if err == nil {
		return value
	}
	if channel == model.PaymentChannelAlipay {
		return appconfig.GetConfig().Alipay.Enabled
	}
	return false
}

func (s *ConfigService) IsPaymentChannelEnabledTx(tx *gorm.DB, channel string) bool {
	key := paymentChannelConfigKey(channel)
	if key == "" {
		return false
	}
	value, err := s.GetConfigBoolTx(tx, key)
	if err == nil {
		return value
	}
	if channel == model.PaymentChannelAlipay {
		return appconfig.GetConfig().Alipay.Enabled
	}
	return false
}

func (s *ConfigService) ValidatePaymentChannelEnabled(channel string) error {
	if !s.IsPaymentChannelEnabled(channel) {
		return paymentChannelDisabledError(channel)
	}
	return s.ValidatePaymentChannelRuntimeConfig(channel)
}

func (s *ConfigService) ValidatePaymentChannelEnabledTx(tx *gorm.DB, channel string) error {
	if !s.IsPaymentChannelEnabledTx(tx, channel) {
		return paymentChannelDisabledError(channel)
	}
	return s.ValidatePaymentChannelRuntimeConfig(channel)
}

func (s *ConfigService) ValidatePaymentChannelToggle(key, value string) error {
	if !parseBoolLoose(value) {
		return nil
	}
	switch key {
	case model.ConfigKeyPaymentChannelWechatEnabled:
		return s.ValidatePaymentChannelRuntimeConfig(model.PaymentChannelWechat)
	case model.ConfigKeyPaymentChannelAlipayEnabled:
		return s.ValidatePaymentChannelRuntimeConfig(model.PaymentChannelAlipay)
	default:
		return nil
	}
}

func (s *ConfigService) ValidatePaymentChannelRuntimeConfig(channel string) error {
	switch channel {
	case model.PaymentChannelWechat:
		cfg := appconfig.GetConfig()
		appID := strings.TrimSpace(cfg.WechatPay.AppID)
		publicKeyID := strings.TrimSpace(cfg.WechatPay.PlatformPublicKeyID)
		publicKey := strings.TrimSpace(cfg.WechatPay.PlatformPublicKey)
		if appID == "" {
			appID = strings.TrimSpace(cfg.WechatMini.AppID)
		}
		switch {
		case appID == "":
			return errors.New("微信支付未配置小程序 AppID")
		case strings.TrimSpace(cfg.WechatPay.MchID) == "":
			return errors.New("微信支付未配置商户号")
		case strings.TrimSpace(cfg.WechatPay.SerialNo) == "":
			return errors.New("微信支付未配置证书序列号")
		case strings.TrimSpace(cfg.WechatPay.PrivateKey) == "":
			return errors.New("微信支付未配置商户私钥")
		case strings.TrimSpace(cfg.WechatPay.APIv3Key) == "":
			return errors.New("微信支付未配置 APIv3 密钥")
		case strings.TrimSpace(cfg.WechatPay.NotifyURL) == "":
			return errors.New("微信支付未配置支付回调地址")
		case (publicKeyID == "") != (publicKey == ""):
			return errors.New("微信支付平台公钥配置不完整")
		default:
			return nil
		}
	case model.PaymentChannelAlipay:
		runtimeCfg := appconfig.GetConfig()
		cfg := runtimeCfg.Alipay
		switch {
		case strings.TrimSpace(cfg.AppID) == "":
			return errors.New("支付宝未配置 AppID")
		case strings.TrimSpace(cfg.AppPrivateKey) == "":
			return errors.New("支付宝未配置应用私钥")
		case strings.TrimSpace(cfg.PublicKey) == "":
			return errors.New("支付宝未配置平台公钥")
		case strings.TrimSpace(cfg.NotifyURL) == "" && strings.TrimSpace(runtimeCfg.Server.PublicURL) == "":
			return errors.New("支付宝未配置支付回调地址")
		case strings.TrimSpace(cfg.GatewayURL) == "":
			return errors.New("支付宝未配置网关地址")
		default:
			return nil
		}
	default:
		return errors.New("不支持的支付渠道")
	}
}

func paymentChannelConfigKey(channel string) string {
	switch strings.TrimSpace(channel) {
	case model.PaymentChannelWechat:
		return model.ConfigKeyPaymentChannelWechatEnabled
	case model.PaymentChannelAlipay:
		return model.ConfigKeyPaymentChannelAlipayEnabled
	default:
		return ""
	}
}

func parseBoolLoose(value string) bool {
	result, err := strconv.ParseBool(strings.TrimSpace(value))
	return err == nil && result
}

func paymentChannelDisabledError(channel string) error {
	switch strings.TrimSpace(channel) {
	case model.PaymentChannelWechat:
		return errors.New("微信支付未启用")
	case model.PaymentChannelAlipay:
		return errors.New("支付宝支付未启用")
	default:
		return errors.New("支付渠道未启用")
	}
}

// GetConstructionMilestones 获取施工分期配置
type MilestoneConfig struct {
	Name       string  `json:"name"`
	Percentage float32 `json:"percentage"`
}

func (s *ConfigService) GetConstructionMilestones() ([]MilestoneConfig, error) {
	var milestones []MilestoneConfig
	err := s.GetConfigJSON(model.ConfigKeyConstructionMilestones, &milestones)
	return milestones, err
}

// GetSurveyDepositRefundRate 量房定金退款比例(0-1)
func (s *ConfigService) GetSurveyDepositRefundRate() float64 {
	val, err := s.GetConfigFloat(model.ConfigKeySurveyDepositRefundRate)
	if err != nil || val <= 0 || val > 1 {
		return 0.6
	}
	return val
}

func (s *ConfigService) GetBudgetConfirmRejectLimit() int {
	val, err := s.GetConfigInt(model.ConfigKeyBudgetConfirmRejectLimit)
	if err != nil || val <= 0 {
		return 3
	}
	return val
}

func (s *ConfigService) GetBudgetConfirmRejectLimitTx(tx *gorm.DB) int {
	val, err := s.GetConfigIntTx(tx, model.ConfigKeyBudgetConfirmRejectLimit)
	if err != nil || val <= 0 {
		return 3
	}
	return val
}

// GetDesignQuoteExpireHours 设计费报价有效期(小时)
func (s *ConfigService) GetDesignQuoteExpireHours() int {
	val, err := s.GetConfigInt(model.ConfigKeyDesignFeeQuoteExpireHours)
	if err != nil || val <= 0 {
		return 72
	}
	return val
}

// GetConstructionReleaseDelayDays T+N 放款延迟天数
func (s *ConfigService) GetConstructionReleaseDelayDays() int {
	val, err := s.GetConfigInt(model.ConfigKeyConstructionReleaseDelay)
	if err != nil || val < 0 {
		return 3
	}
	return val
}

func (s *ConfigService) GetConstructionReleaseDelayDaysTx(tx *gorm.DB) int {
	val, err := s.GetConfigIntTx(tx, model.ConfigKeyConstructionReleaseDelay)
	if err != nil || val < 0 {
		return 3
	}
	return val
}

func (s *ConfigService) GetPaymentReleaseDelayDays() int {
	val, err := s.GetConfigInt(model.ConfigKeyPaymentReleaseDelayDays)
	if err == nil && val >= 0 {
		return val
	}
	return s.GetConstructionReleaseDelayDays()
}

func (s *ConfigService) GetPaymentPayoutAutoEnabled() bool {
	val, err := s.GetConfigBool(model.ConfigKeyPaymentPayoutAutoEnabled)
	if err != nil {
		return false
	}
	return val
}

func (s *ConfigService) GetOutboxWorkerEnabled() bool {
	val, err := s.GetConfigBool(model.ConfigKeyOutboxWorkerEnabled)
	if err != nil {
		return true
	}
	return val
}

func (s *ConfigService) GetOutboxWorkerBatchSize() int {
	val, err := s.GetConfigInt(model.ConfigKeyOutboxWorkerBatchSize)
	if err != nil || val <= 0 {
		return 20
	}
	if val > 200 {
		return 200
	}
	return val
}

func (s *ConfigService) GetOutboxWorkerPollInterval() time.Duration {
	val, err := s.GetConfigInt(model.ConfigKeyOutboxWorkerPollIntervalSec)
	if err != nil || val <= 0 {
		return 5 * time.Second
	}
	if val > 300 {
		val = 300
	}
	return time.Duration(val) * time.Second
}

func (s *ConfigService) GetOutboxWorkerLockTTL() time.Duration {
	val, err := s.GetConfigInt(model.ConfigKeyOutboxWorkerLockTTLSec)
	if err != nil || val <= 0 {
		return time.Minute
	}
	if val > 3600 {
		val = 3600
	}
	return time.Duration(val) * time.Second
}

func (s *ConfigService) GetOutboxWorkerMaxRetries() int {
	val, err := s.GetConfigInt(model.ConfigKeyOutboxWorkerMaxRetries)
	if err != nil || val <= 0 {
		return defaultOutboxMaxRetries
	}
	if val > 20 {
		return 20
	}
	return val
}

// TencentIMConfig 腾讯云 IM 配置
type TencentIMConfig struct {
	SDKAppID  int    `json:"sdkAppId"`
	SecretKey string `json:"secretKey"`
	Enabled   bool   `json:"enabled"`
}

// GetTencentIMConfig 获取腾讯云 IM 配置
func (s *ConfigService) GetTencentIMConfig() (*TencentIMConfig, error) {
	sdkAppIDStr, _ := s.GetConfig(model.ConfigKeyTencentIMSDKAppID)
	secretKey, _ := s.GetConfig(model.ConfigKeyTencentIMSecretKey)
	enabledStr, _ := s.GetConfig(model.ConfigKeyTencentIMEnabled)

	sdkAppID, _ := strconv.Atoi(sdkAppIDStr)
	enabled := enabledStr == "true"

	return &TencentIMConfig{
		SDKAppID:  sdkAppID,
		SecretKey: secretKey,
		Enabled:   enabled,
	}, nil
}
