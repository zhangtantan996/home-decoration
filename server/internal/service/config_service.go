package service

import (
	"encoding/json"
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	"strconv"
	"sync"
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

// GetConfigFloat 获取浮点数配置
func (s *ConfigService) GetConfigFloat(key string) (float64, error) {
	val, err := s.GetConfig(key)
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
		{model.ConfigKeyIntentFeeRefundable, "false", "意向金是否可退（用户放弃时）"},
		{model.ConfigKeyDesignFeeUnlockDownload, "true", "支付设计费后解锁图纸下载"},
		{model.ConfigKeyConstructionMilestones, `[{"name":"开工款","percentage":30},{"name":"水电款","percentage":35},{"name":"中期款","percentage":30},{"name":"尾款","percentage":5}]`, "施工分期付款比例"},
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
