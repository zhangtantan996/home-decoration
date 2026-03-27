package service

import (
	"encoding/json"
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	"strconv"
	"sync"

	"gorm.io/gorm"
)

// ConfigService 系统配置服务
type ConfigService struct{}

var (
	configCache     = make(map[string]string)
	configCacheMu   sync.RWMutex
	configCacheInit sync.Once
)

// GetConfig 获取配置值
func (s *ConfigService) GetConfig(key string) (string, error) {
	// 先从缓存读取
	configCacheMu.RLock()
	if val, ok := configCache[key]; ok {
		configCacheMu.RUnlock()
		return val, nil
	}
	configCacheMu.RUnlock()

	// 从数据库读取
	var config model.SystemConfig
	if err := repository.DB.Where("key = ?", key).First(&config).Error; err != nil {
		return "", err
	}

	// 写入缓存
	configCacheMu.Lock()
	configCache[key] = config.Value
	configCacheMu.Unlock()

	return config.Value, nil
}

func (s *ConfigService) GetConfigTx(tx *gorm.DB, key string) (string, error) {
	if tx == nil {
		return s.GetConfig(key)
	}

	configCacheMu.RLock()
	if val, ok := configCache[key]; ok {
		configCacheMu.RUnlock()
		return val, nil
	}
	configCacheMu.RUnlock()

	var config model.SystemConfig
	if err := tx.Where("key = ?", key).First(&config).Error; err != nil {
		return "", err
	}

	configCacheMu.Lock()
	configCache[key] = config.Value
	configCacheMu.Unlock()

	return config.Value, nil
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

// SetConfig 设置配置值（管理后台使用）
func (s *ConfigService) SetConfig(key, value, description string) error {
	var config model.SystemConfig
	err := repository.DB.Where("key = ?", key).First(&config).Error
	if err != nil {
		// 不存在则创建
		config = model.SystemConfig{
			Key:         key,
			Value:       value,
			Description: description,
			Editable:    true,
		}
		if err := repository.DB.Create(&config).Error; err != nil {
			return err
		}
	} else {
		// 存在则更新
		config.Value = value
		if err := repository.DB.Save(&config).Error; err != nil {
			return err
		}
	}

	// 更新缓存
	configCacheMu.Lock()
	configCache[key] = value
	configCacheMu.Unlock()

	return nil
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
		{model.ConfigKeyIntentFee, "99", "预约意向金金额（元）"},
		{model.ConfigKeySurveyDepositDefault, "500", "量房定金默认金额（元）"},
		{model.ConfigKeySurveyRefundNotice, "量房完成后若不继续设计，默认退回 60% 给用户，剩余 40% 冻结待平台判定；若后续确认设计方案，量房定金转为设计费的一部分。", "量房定金退款说明文案"},
		{model.ConfigKeySurveyRefundUserPercent, "60", "量房后终止时退给用户的百分比"},
		{model.ConfigKeyIntentFeeRefundable, "false", "意向金是否可退（用户放弃时）"},
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
		// 量房定金与设计费支付配置
		{model.ConfigKeySurveyDepositRefundRate, "0.6", "量房定金退款比例(不继续时退给用户,0-1)"},
		{model.ConfigKeySurveyDepositMin, "100", "设计师可设量房定金最低金额"},
		{model.ConfigKeySurveyDepositMax, "2000", "设计师可设量房定金最高金额"},
		{model.ConfigKeyDesignFeeQuoteExpireHours, "72", "设计费报价有效期(小时)"},
		{model.ConfigKeyDeliverableDeadlineDays, "30", "设计交付件截止天数"},
		{model.ConfigKeyConstructionReleaseDelay, "3", "验收确认后T+N天自动放款"},
		{model.ConfigKeyPaymentReleaseDelayDays, "3", "支付中台统一T+N出款延迟天数"},
		{model.ConfigKeyPaymentPayoutAutoEnabled, "true", "是否启用自动出款"},
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

func (s *ConfigService) GetSurveyRefundNotice() string {
	val, err := s.GetConfig(model.ConfigKeySurveyRefundNotice)
	if err != nil || val == "" {
		return "量房完成后若不继续设计，默认退回 60% 给用户，剩余 40% 冻结待平台判定；若后续确认设计方案，量房定金转为设计费的一部分。"
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
		return true
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
