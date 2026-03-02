package handler

import (
	"encoding/json"
	"errors"
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	"home-decoration-server/pkg/response"
	"strings"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type merchantServiceSettingInput struct {
	AcceptBooking    bool             `json:"acceptBooking"`
	AutoConfirmHours int              `json:"autoConfirmHours"`
	ResponseTimeDesc string           `json:"responseTimeDesc"`
	PriceRangeMin    float64          `json:"priceRangeMin"`
	PriceRangeMax    float64          `json:"priceRangeMax"`
	ServiceStyles    []string         `json:"serviceStyles"`
	ServicePackages  []map[string]any `json:"servicePackages"`
}

func parseMerchantServiceStyles(raw string) []string {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return []string{}
	}

	var values []string
	if strings.HasPrefix(trimmed, "[") && strings.HasSuffix(trimmed, "]") {
		if err := json.Unmarshal([]byte(trimmed), &values); err == nil {
			return normalizeStringSlice(values)
		}
	}

	if strings.Contains(trimmed, " · ") {
		return normalizeStringSlice(strings.Split(trimmed, " · "))
	}

	if strings.Contains(trimmed, ",") {
		return normalizeStringSlice(strings.Split(trimmed, ","))
	}

	return normalizeStringSlice([]string{trimmed})
}

func parseMerchantServicePackages(raw string) []map[string]any {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return []map[string]any{}
	}

	var values []map[string]any
	if err := json.Unmarshal([]byte(trimmed), &values); err != nil {
		return []map[string]any{}
	}
	return values
}

func getOrCreateMerchantServiceSetting(providerID uint64) (*model.MerchantServiceSetting, error) {
	var setting model.MerchantServiceSetting
	err := repository.DB.Where("provider_id = ?", providerID).First(&setting).Error
	if err == nil {
		return &setting, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	setting = model.MerchantServiceSetting{
		ProviderID:       providerID,
		AcceptBooking:    true,
		AutoConfirmHours: 24,
		ServiceStyles:    "[]",
		ServicePackages:  "[]",
	}
	if createErr := repository.DB.Create(&setting).Error; createErr != nil {
		return nil, createErr
	}
	return &setting, nil
}

func MerchantGetServiceSettings(c *gin.Context) {
	providerID := c.GetUint64("providerId")
	setting, err := getOrCreateMerchantServiceSetting(providerID)
	if err != nil {
		response.Error(c, 500, "获取服务设置失败")
		return
	}

	response.Success(c, gin.H{
		"acceptBooking":    setting.AcceptBooking,
		"autoConfirmHours": setting.AutoConfirmHours,
		"responseTimeDesc": setting.ResponseTimeDesc,
		"priceRangeMin":    setting.PriceRangeMin,
		"priceRangeMax":    setting.PriceRangeMax,
		"serviceStyles":    parseMerchantServiceStyles(setting.ServiceStyles),
		"servicePackages":  parseMerchantServicePackages(setting.ServicePackages),
	})
}

func MerchantUpdateServiceSettings(c *gin.Context) {
	providerID := c.GetUint64("providerId")

	var input merchantServiceSettingInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.Error(c, 400, "参数错误")
		return
	}

	if input.AutoConfirmHours < 1 || input.AutoConfirmHours > 168 {
		response.Error(c, 400, "自动确认时间需在1-168小时之间")
		return
	}
	if len([]rune(input.ResponseTimeDesc)) > 50 {
		response.Error(c, 400, "响应时间描述最多50个字符")
		return
	}
	if input.PriceRangeMin < 0 || input.PriceRangeMax < 0 {
		response.Error(c, 400, "价格区间不能为负数")
		return
	}
	if input.PriceRangeMax > 0 && input.PriceRangeMax < input.PriceRangeMin {
		response.Error(c, 400, "价格区间上限不能小于下限")
		return
	}

	setting, err := getOrCreateMerchantServiceSetting(providerID)
	if err != nil {
		response.Error(c, 500, "更新服务设置失败")
		return
	}

	styles := normalizeStringSlice(input.ServiceStyles)
	stylesJSON, _ := json.Marshal(styles)

	servicePackages := input.ServicePackages
	if servicePackages == nil {
		servicePackages = []map[string]any{}
	}
	packagesJSON, _ := json.Marshal(servicePackages)

	setting.AcceptBooking = input.AcceptBooking
	setting.AutoConfirmHours = input.AutoConfirmHours
	setting.ResponseTimeDesc = strings.TrimSpace(input.ResponseTimeDesc)
	setting.PriceRangeMin = input.PriceRangeMin
	setting.PriceRangeMax = input.PriceRangeMax
	setting.ServiceStyles = string(stylesJSON)
	setting.ServicePackages = string(packagesJSON)

	if err := repository.DB.Save(setting).Error; err != nil {
		response.Error(c, 500, "更新服务设置失败")
		return
	}

	response.Success(c, gin.H{"status": "ok"})
}
