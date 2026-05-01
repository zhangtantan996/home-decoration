package service

import (
	"encoding/json"
	"errors"
	"fmt"
	appconfig "home-decoration-server/internal/config"
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	"os"
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

const configKeyConstructionFeeStagesDeprecated = "order.construction_fee_stages"

type configValueKind string

const (
	configKindString                  configValueKind = "string"
	configKindBool                    configValueKind = "bool"
	configKindOptionalInt             configValueKind = "optional_int"
	configKindNonNegativeNumber       configValueKind = "non_negative_number"
	configKindNonNegativeInt          configValueKind = "non_negative_int"
	configKindPositiveInt             configValueKind = "positive_int"
	configKindRate                    configValueKind = "rate"
	configKindPercent                 configValueKind = "percent"
	configKindJSON                    configValueKind = "json"
	configKindMilestoneStages         configValueKind = "milestone_stages"
	configKindDesignFeePaymentMode    configValueKind = "design_fee_payment_mode"
	configKindConstructionPaymentMode configValueKind = "construction_payment_mode"
	configKindMiniHomePopup           configValueKind = "mini_home_popup"
)

type configDefinition struct {
	Key          string
	DefaultValue string
	Description  string
	Type         string
	Kind         configValueKind
	Editable     bool
	Deprecated   bool
}

func IsSecretSettingKey(key string) bool {
	switch strings.TrimSpace(key) {
	case "sms_access_key", "sms_secret_key", "im_tencent_secret_key", "wechat_api_key", "alipay_private_key":
		return true
	default:
		return false
	}
}

func IsSecretConfigKey(key string) bool {
	switch strings.TrimSpace(key) {
	case model.ConfigKeyTencentIMSecretKey:
		return true
	default:
		return false
	}
}

func defaultConfigDefinitions() []configDefinition {
	return []configDefinition{
		{model.ConfigKeyIntentFee, "99", "预约量房费金额（兼容旧配置）", "number", configKindNonNegativeNumber, true, false},
		{model.ConfigKeySurveyDepositDefault, "500", "量房费默认金额（元）", "number", configKindNonNegativeNumber, true, false},
		{model.ConfigKeySurveyRefundNotice, "量房完成后若不继续设计，默认退回 60% 给用户，剩余 40% 冻结待平台判定；若后续确认设计方案，量房费转为设计费的一部分。", "量房费退款说明文案", "string", configKindString, true, false},
		{model.ConfigKeySurveyRefundUserPercent, "60", "量房后终止时退给用户的百分比", "number", configKindPercent, true, false},
		{model.ConfigKeyIntentFeeRefundable, "false", "量房费是否可退（兼容旧配置）", "boolean", configKindBool, true, false},
		{model.ConfigKeyDesignFeeUnlockDownload, "true", "支付设计费后解锁图纸下载", "boolean", configKindBool, true, false},
		{model.ConfigKeyDesignFeePaymentMode, "onetime", "设计费支付模式：onetime / staged", "string", configKindDesignFeePaymentMode, true, false},
		{model.ConfigKeyDesignFeeStages, `[{"name":"签约款","percentage":50},{"name":"终稿款","percentage":50}]`, "设计费分阶段付款比例", "json", configKindMilestoneStages, true, false},
		{model.ConfigKeyConstructionPaymentMode, "milestone", "施工费支付模式：milestone / onetime", "string", configKindConstructionPaymentMode, true, false},
		{model.ConfigKeyConstructionMilestones, `[{"name":"开工款","percentage":30},{"name":"水电款","percentage":35},{"name":"中期款","percentage":30},{"name":"尾款","percentage":5}]`, "施工分期付款比例", "json", configKindMilestoneStages, true, false},
		{configKeyConstructionFeeStagesDeprecated, "", "已废弃：请使用 order.construction_milestones", "json", configKindMilestoneStages, false, true},
		{model.ConfigKeyIntentFeeRate, "0", "意向金平台抽成比例(0-1)", "number", configKindRate, true, false},
		{model.ConfigKeyDesignFeeRate, "0.1", "设计费平台抽成比例(0-1)", "number", configKindRate, true, false},
		{model.ConfigKeyConstructionFeeRate, "0.1", "施工费平台抽成比例(0-1)", "number", configKindRate, true, false},
		{model.ConfigKeyMaterialFeeRate, "0.05", "主材平台抽成比例(0-1)", "number", configKindRate, true, false},
		{model.ConfigKeyWithdrawMinAmount, "100", "最低提现金额", "number", configKindNonNegativeNumber, true, false},
		{model.ConfigKeyWithdrawFee, "0", "提现手续费", "number", configKindNonNegativeNumber, true, false},
		{model.ConfigKeySettlementAutoDays, "7", "自动结算天数", "number", configKindPositiveInt, true, false},
		{model.ConfigKeyTencentIMEnabled, "false", "是否启用腾讯云 IM", "boolean", configKindBool, true, false},
		{model.ConfigKeyTencentIMSDKAppID, "", "腾讯云 IM SDKAppID", "string", configKindOptionalInt, true, false},
		{model.ConfigKeyTencentIMSecretKey, "", "腾讯云 IM SecretKey 已迁移到运行环境", "string", configKindString, false, true},
		{model.ConfigKeyPublicIDRolloutEnabled, "false", "是否启用 publicId 灰度策略", "boolean", configKindBool, true, false},
		{model.ConfigKeyPublicIDRolloutMobilePercent, "5", "publicId 移动端灰度百分比(0-100)", "number", configKindPercent, true, false},
		{model.ConfigKeyPublicIDRolloutDefaultPercent, "0", "publicId 其他端灰度百分比(0-100)", "number", configKindPercent, true, false},
		{model.ConfigKeyPublicIDRollbackDrillEnabled, "false", "是否启用 publicId 回滚演练观测", "boolean", configKindBool, true, false},
		{model.ConfigKeyPublicIDRollbackForceLegacyLookup, "false", "紧急回滚: 强制仅按内部ID查询", "boolean", configKindBool, true, false},
		{model.ConfigKeySurveyDepositRefundRate, "0.6", "量房费退款比例(不继续时退给用户,0-1)", "number", configKindRate, true, false},
		{model.ConfigKeySurveyDepositMin, "100", "设计师可设量房费最低金额", "number", configKindNonNegativeNumber, true, false},
		{model.ConfigKeySurveyDepositMax, "2000", "设计师可设量房费最高金额", "number", configKindNonNegativeNumber, true, false},
		{model.ConfigKeyBudgetConfirmRejectLimit, "3", "沟通确认可被用户驳回的阈值，达到后才关闭预约", "number", configKindPositiveInt, true, false},
		{model.ConfigKeyDesignFeeQuoteExpireHours, "72", "设计费报价有效期(小时)", "number", configKindPositiveInt, true, false},
		{model.ConfigKeyDeliverableDeadlineDays, "30", "设计交付件截止天数", "number", configKindPositiveInt, true, false},
		{model.ConfigKeyConstructionReleaseDelay, "3", "验收确认后T+N天自动放款", "number", configKindNonNegativeInt, true, false},
		{model.ConfigKeyPaymentReleaseDelayDays, "3", "支付中台统一T+N出款延迟天数", "number", configKindNonNegativeInt, true, false},
		{model.ConfigKeyPaymentPayoutAutoEnabled, "false", "是否启用自动出款", "boolean", configKindBool, true, false},
		{model.ConfigKeyPaymentChannelWechatEnabled, "false", "是否启用微信支付", "boolean", configKindBool, true, false},
		{model.ConfigKeyPaymentChannelAlipayEnabled, strconv.FormatBool(appconfig.GetConfig().Alipay.Enabled), "是否启用支付宝", "boolean", configKindBool, true, false},
		{model.ConfigKeyMiniHomePopup, defaultMiniHomePopupConfigJSON(), "小程序首页运营弹窗配置", "json", configKindMiniHomePopup, true, false},
		{model.ConfigKeyOutboxWorkerEnabled, "true", "是否启用事件任务 worker", "boolean", configKindBool, true, false},
		{model.ConfigKeyOutboxWorkerBatchSize, "20", "事件任务 worker 单批处理数量", "number", configKindPositiveInt, true, false},
		{model.ConfigKeyOutboxWorkerPollIntervalSec, "5", "事件任务 worker 轮询间隔秒数", "number", configKindPositiveInt, true, false},
		{model.ConfigKeyOutboxWorkerLockTTLSec, "60", "事件任务 worker 锁定超时秒数", "number", configKindPositiveInt, true, false},
		{model.ConfigKeyOutboxWorkerMaxRetries, "3", "事件任务默认最大重试次数", "number", configKindPositiveInt, true, false},
		{model.ConfigKeyPublicBrandName, "禾泽云", "对外展示品牌名", "string", configKindString, true, false},
		{model.ConfigKeyPublicCompanyName, "陕西禾泽云创科技有限公司", "对外展示公司全称", "string", configKindString, true, false},
		{model.ConfigKeyPublicCompanyCreditCode, "91610102MAK4U1K51H", "统一社会信用代码", "string", configKindString, true, false},
		{model.ConfigKeyPublicCompanyRegisterAddr, "陕西省西安市新城区解放路166号1幢所住10401室", "注册地址", "string", configKindString, true, false},
		{model.ConfigKeyPublicCompanyContactAddr, "陕西省西安市新城区解放路103号民生百货解放路店F7层7004", "对外联系地址", "string", configKindString, true, false},
		{model.ConfigKeyPublicICP, "陕ICP备2026004441号", "ICP备案号", "string", configKindString, true, false},
		{model.ConfigKeyPublicSecurityBeian, "", "公安备案号，未取得时留空", "string", configKindString, true, false},
		{model.ConfigKeyPublicCustomerPhone, "17764774797", "客服电话", "string", configKindString, true, false},
		{model.ConfigKeyPublicCustomerEmail, "", "客服邮箱，未开通时留空", "string", configKindString, true, false},
		{model.ConfigKeyPublicComplaintEmail, "", "投诉举报邮箱，未开通时留空", "string", configKindString, true, false},
		{model.ConfigKeyPublicPrivacyEmail, "", "隐私与个人信息保护联系邮箱，未开通时留空", "string", configKindString, true, false},
		{model.ConfigKeyPublicUserAgreement, defaultPublicUserAgreement(), "用户服务协议正文", "string", configKindString, true, false},
		{model.ConfigKeyPublicPrivacyPolicy, defaultPublicPrivacyPolicy(), "隐私政策正文", "string", configKindString, true, false},
		{model.ConfigKeyPublicTransactionRules, defaultPublicTransactionRules(), "对外交易规则文案", "string", configKindString, true, false},
		{model.ConfigKeyPublicRefundRules, defaultPublicRefundRules(), "对外退款与售后规则文案", "string", configKindString, true, false},
		{model.ConfigKeyPublicMerchantOnboarding, defaultPublicMerchantOnboardingRules(), "对外商家准入规则文案", "string", configKindString, true, false},
		{model.ConfigKeyPublicThirdPartySharing, defaultPublicThirdPartySharing(), "第三方信息共享清单正文", "string", configKindString, true, false},
		{model.ConfigKeyPublicLegalVersion, "v1.0.0-20260430", "对外协议规则版本号", "string", configKindString, true, false},
		{model.ConfigKeyPublicLegalEffectiveDate, "2026-04-30", "对外协议规则生效日期", "string", configKindString, true, false},
	}
}

func configDefinitionMap() map[string]configDefinition {
	defs := make(map[string]configDefinition)
	for _, def := range defaultConfigDefinitions() {
		defs[def.Key] = def
	}
	return defs
}

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

func (s *ConfigService) normalizeAndValidateConfigValue(key, value string) (string, error) {
	def, ok := configDefinitionMap()[key]
	if !ok {
		return "", fmt.Errorf("未知配置项")
	}
	if def.Deprecated || !def.Editable || IsSecretConfigKey(key) {
		return "", fmt.Errorf("该配置项不允许后台修改")
	}
	value = strings.TrimSpace(value)

	if key == model.ConfigKeyMiniHomePopup {
		normalized, err := normalizeMiniHomePopupConfigPayload(value, time.Now())
		if err != nil {
			return "", err
		}
		bytes, err := json.Marshal(normalized)
		if err != nil {
			return "", err
		}
		return string(bytes), nil
	}

	if err := s.validateConfigValue(def, value); err != nil {
		return "", err
	}
	if err := s.ValidatePaymentChannelToggle(key, value); err != nil {
		return "", err
	}
	return value, nil
}

func (s *ConfigService) validateConfigValue(def configDefinition, value string) error {
	switch def.Kind {
	case configKindString:
		return nil
	case configKindBool:
		if _, err := strconv.ParseBool(value); err != nil {
			return errors.New("配置值必须为布尔值")
		}
	case configKindOptionalInt:
		if value == "" {
			return nil
		}
		parsed, err := strconv.Atoi(value)
		if err != nil || parsed < 0 {
			return errors.New("配置值必须为非负整数")
		}
	case configKindNonNegativeNumber:
		parsed, err := strconv.ParseFloat(value, 64)
		if err != nil || parsed < 0 {
			return errors.New("配置值必须为非负数字")
		}
	case configKindNonNegativeInt:
		parsed, err := strconv.Atoi(value)
		if err != nil || parsed < 0 {
			return errors.New("配置值必须为非负整数")
		}
	case configKindPositiveInt:
		parsed, err := strconv.Atoi(value)
		if err != nil || parsed <= 0 {
			return errors.New("配置值必须为正整数")
		}
	case configKindRate:
		parsed, err := strconv.ParseFloat(value, 64)
		if err != nil || parsed < 0 || parsed > 1 {
			return errors.New("比例配置必须在 0 到 1 之间")
		}
	case configKindPercent:
		parsed, err := strconv.ParseFloat(value, 64)
		if err != nil || parsed < 0 || parsed > 100 {
			return errors.New("百分比配置必须在 0 到 100 之间")
		}
	case configKindJSON:
		if !json.Valid([]byte(value)) {
			return errors.New("配置值必须为合法 JSON")
		}
	case configKindMilestoneStages:
		if err := validateMilestoneStagesJSON(value); err != nil {
			return err
		}
	case configKindDesignFeePaymentMode:
		if value != "onetime" && value != "staged" {
			return errors.New("设计费支付模式只支持一次性或分阶段")
		}
	case configKindConstructionPaymentMode:
		if value != "milestone" && value != "onetime" && value != "staged" {
			return errors.New("施工费支付模式只支持里程碑或一次性")
		}
	case configKindMiniHomePopup:
		return nil
	default:
		return errors.New("配置项缺少校验规则")
	}
	return nil
}

func validateMilestoneStagesJSON(value string) error {
	var milestones []MilestoneConfig
	if err := json.Unmarshal([]byte(value), &milestones); err != nil {
		return errors.New("阶段配置必须为合法 JSON")
	}
	if len(milestones) == 0 {
		return errors.New("阶段配置不能为空")
	}
	var total float32
	for _, item := range milestones {
		if strings.TrimSpace(item.Name) == "" {
			return errors.New("阶段名称不能为空")
		}
		if item.Percentage <= 0 {
			return errors.New("阶段比例必须大于 0")
		}
		total += item.Percentage
	}
	if total < 99.99 || total > 100.01 {
		return fmt.Errorf("阶段比例之和必须等于 100%%")
	}
	return nil
}

func (s *ConfigService) upsertConfigValue(tx *gorm.DB, key, value, description, valueType string, editable bool) error {
	queryDB := repository.DB
	if tx != nil {
		queryDB = tx
	}

	var config model.SystemConfig
	err := queryDB.Where("key = ?", key).First(&config).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		config = model.SystemConfig{
			Key:         key,
			Value:       value,
			Type:        valueType,
			Description: description,
			Editable:    editable,
		}
		return queryDB.Create(&config).Error
	}
	if err != nil {
		return err
	}
	config.Value = value
	config.Editable = editable
	if valueType != "" {
		config.Type = valueType
	}
	if description != "" {
		config.Description = description
	}
	return queryDB.Save(&config).Error
}

func (s *ConfigService) setConfigValue(tx *gorm.DB, key, value, description string) error {
	normalized, err := s.normalizeAndValidateConfigValue(key, value)
	if err != nil {
		return err
	}
	def := configDefinitionMap()[key]
	queryDB := repository.DB
	if tx != nil {
		queryDB = tx
	}

	var config model.SystemConfig
	err = queryDB.Where("key = ?", key).First(&config).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		if err := s.upsertConfigValue(tx, key, normalized, firstNonEmpty(description, def.Description), def.Type, def.Editable); err != nil {
			return err
		}
	} else if err != nil {
		return err
	} else {
		config.Value = normalized
		config.Editable = def.Editable
		if def.Type != "" {
			config.Type = def.Type
		}
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
	configCache[key] = normalized
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
	if err := s.migrateDeprecatedConstructionStages(); err != nil {
		return err
	}
	for _, d := range defaultConfigDefinitions() {
		if d.Deprecated || IsSecretConfigKey(d.Key) {
			continue
		}
		var existing model.SystemConfig
		err := repository.DB.Where("key = ?", d.Key).First(&existing).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			if err := s.upsertConfigValue(nil, d.Key, d.DefaultValue, d.Description, d.Type, d.Editable); err != nil {
				return err
			}
			continue
		}
		if err != nil {
			return err
		}
		updates := map[string]interface{}{
			"type":        d.Type,
			"description": d.Description,
			"editable":    d.Editable,
		}
		if err := repository.DB.Model(&existing).Updates(updates).Error; err != nil {
			return err
		}
	}
	return nil
}

func (s *ConfigService) migrateDeprecatedConstructionStages() error {
	var oldConfig model.SystemConfig
	if err := repository.DB.Where("key = ?", configKeyConstructionFeeStagesDeprecated).First(&oldConfig).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil
		}
		return err
	}
	if strings.TrimSpace(oldConfig.Value) == "" {
		return nil
	}
	var newConfig model.SystemConfig
	err := repository.DB.Where("key = ?", model.ConfigKeyConstructionMilestones).First(&newConfig).Error
	if err == nil && strings.TrimSpace(newConfig.Value) != "" {
		return nil
	}
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}
	def := configDefinitionMap()[model.ConfigKeyConstructionMilestones]
	if validateErr := s.validateConfigValue(def, oldConfig.Value); validateErr != nil {
		return nil
	}
	return s.upsertConfigValue(nil, model.ConfigKeyConstructionMilestones, oldConfig.Value, def.Description, def.Type, def.Editable)
}

type PublicThirdPartyService struct {
	Category string `json:"category"`
	Provider string `json:"provider"`
	Purpose  string `json:"purpose"`
}

type PublicLegalDocument struct {
	Slug          string `json:"slug"`
	Title         string `json:"title"`
	Version       string `json:"version"`
	EffectiveDate string `json:"effectiveDate"`
	Content       string `json:"content"`
}

type PublicSiteConfig struct {
	BrandName              string                    `json:"brandName"`
	CompanyName            string                    `json:"companyName"`
	CompanyCreditCode      string                    `json:"companyCreditCode"`
	CompanyRegisterAddress string                    `json:"companyRegisterAddress"`
	CompanyContactAddress  string                    `json:"companyContactAddress"`
	ICP                    string                    `json:"icp"`
	SecurityBeian          string                    `json:"securityBeian,omitempty"`
	CustomerPhone          string                    `json:"customerPhone"`
	CustomerEmail          string                    `json:"customerEmail,omitempty"`
	ComplaintEmail         string                    `json:"complaintEmail,omitempty"`
	PrivacyEmail           string                    `json:"privacyEmail,omitempty"`
	LegalVersion           string                    `json:"legalVersion"`
	LegalEffectiveDate     string                    `json:"legalEffectiveDate"`
	TransactionRules       string                    `json:"transactionRules"`
	RefundRules            string                    `json:"refundRules"`
	MerchantOnboarding     string                    `json:"merchantOnboardingRules"`
	LegalDocuments         []PublicLegalDocument     `json:"legalDocuments"`
	ThirdPartyServices     []PublicThirdPartyService `json:"thirdPartyServices"`
}

func defaultPublicUserAgreement() string {
	return "本协议由你与陕西禾泽云创科技有限公司共同订立。你登录、浏览服务商、提交预约、确认报价、发起支付、查看项目进度、申请退款或投诉时，表示你已阅读并同意本协议。\n\n1. 服务范围与平台定位\n禾泽云提供家装服务撮合、交易流程管理与履约协同能力，包括服务商展示、预约沟通、报价确认、支付记录、项目进度、售后投诉和通知提醒。具体设计、施工、主材商品或服务由对应服务商承担交付责任。\n\n2. 账号注册与安全\n你应使用本人手机号登录，并妥善保管验证码和登录状态。通过你的账号完成的预约、确认、支付、验收、投诉等操作，平台将视为你本人操作。\n\n3. 交易与线下合同\n用户与服务商如在线下另行签署合同，该合同约定由签署双方自行履行，但不得规避平台已发生的交易记录与争议处理规则。\n\n4. 退款售后与投诉\n未开始服务前可按页面提示申请退款；服务已开始后，将结合实际履约进度、材料成本、双方证据和平台规则处理。客服电话：17764774797。"
}

func defaultPublicPrivacyPolicy() string {
	return "陕西禾泽云创科技有限公司尊重并保护你的个人信息。本政策说明禾泽云在登录、预约、报价、支付、项目协同、售后和投诉等场景中如何处理个人信息。\n\n1. 信息收集范围\n我们会根据业务需要处理手机号、联系人、房屋地址、装修需求、预算、预约记录、报价记录、订单与支付记录、项目进度、退款售后记录、投诉凭证和操作日志。\n\n2. 使用目的\n上述信息用于账号登录、身份验证、服务预约、报价与交易处理、项目履约协同、消息通知、客服支持、退款售后、投诉争议处理、风险审计和法定义务履行。\n\n3. 第三方服务共享\n如平台实际启用短信、支付、实名核验、对象存储、地图定位、即时通信等第三方服务，我们仅在完成对应功能所必需的范围内共享必要字段。\n\n4. 你的权利与联系\n你可以申请查询、更正、删除个人信息或撤回授权。客服电话：17764774797。"
}

func defaultPublicTransactionRules() string {
	return "禾泽云提供家装服务撮合、交易流程管理与履约协同能力。具体设计、施工、主材商品或服务由对应服务商承担交付责任；平台负责信息展示、流程留痕、支付与退款协同、投诉处理和必要的风控管理。用户与服务商如在线下另行签署合同，该合同约定由签署双方自行履行，但不得规避平台已发生的交易记录与争议处理规则。"
}

func defaultPublicRefundRules() string {
	return "未开始服务前，用户可按页面提示申请退款；服务已开始后，将结合实际履约进度、材料成本、双方证据和平台规则处理。平台默认在1-3个工作日内受理退款或售后申请，复杂争议原则上在7个工作日内给出处理意见。出现服务未履约、严重延期、资料不实、费用争议或投诉证据充分等情况时，平台可介入协调并采取退款、整改、下架或限制账号等措施。"
}

func defaultPublicMerchantOnboardingRules() string {
	return "个人设计师、独立工长需提交身份证、实名信息、服务能力证明及案例或工艺材料；个体户需提交经营者身份证和个体工商户营业执照；装修公司、主材商需提交企业营业执照、联系人信息、必要经营资质及服务或商品资料。平台可对资料进行审核、复核、抽查，并对资料不实、服务异常或违规经营主体采取驳回、下架、限权、清退等措施。"
}

func defaultPublicThirdPartySharing() string {
	return "禾泽云仅在实现具体功能所必需的范围内向第三方服务商共享必要信息，且不会出售个人信息。\n\n1. 短信服务\n如启用云短信服务，将向短信服务商提供手机号，用于发送登录、注册、身份核验、商家审核和账户安全验证码或通知。\n\n2. 支付服务\n如启用支付宝或微信支付，将向支付机构提供订单金额、交易标识和支付结果处理所需信息。\n\n3. 实名或企业核验\n如启用实名核验或企业核验服务，将向核验服务商提供姓名、身份证号、公司名称、证照号等核验所需信息。\n\n4. 对象存储、地图和即时通信\n如启用对象存储、地图定位或即时通信服务，将在图片文件存储、地址选择、服务城市、站内沟通等必要范围内处理相关信息。未实际启用的服务不会出现在公开清单中。"
}

func (s *ConfigService) getPublicConfigValue(key, fallback string) string {
	value, err := s.GetConfig(key)
	if err != nil {
		return fallback
	}
	value = strings.TrimSpace(value)
	if value == "" {
		return fallback
	}
	return value
}

func appendPublicService(services []PublicThirdPartyService, category, provider, purpose string) []PublicThirdPartyService {
	provider = strings.TrimSpace(provider)
	if provider == "" || strings.EqualFold(provider, "mock") || strings.EqualFold(provider, "fake") || strings.EqualFold(provider, "manual") {
		return services
	}
	return append(services, PublicThirdPartyService{
		Category: category,
		Provider: provider,
		Purpose:  purpose,
	})
}

func (s *ConfigService) detectPublicThirdPartyServices() []PublicThirdPartyService {
	cfg := appconfig.GetConfig()
	services := make([]PublicThirdPartyService, 0, 8)

	if strings.EqualFold(cfg.SMS.Provider, "aliyun") {
		services = appendPublicService(services, "短信服务", "阿里云短信", "发送登录、注册、身份核验、商家审核和账户安全验证码或通知")
	}
	if cfg.Alipay.Enabled {
		services = appendPublicService(services, "支付服务", "支付宝", "完成订单支付、支付结果通知和交易对账")
	}
	if strings.TrimSpace(cfg.WechatPay.AppID) != "" && strings.TrimSpace(cfg.WechatPay.MchID) != "" {
		services = appendPublicService(services, "支付服务", "微信支付", "完成订单支付、退款通知和交易对账")
	}
	if strings.EqualFold(cfg.Storage.Driver, "oss") || strings.TrimSpace(cfg.Storage.OSSBucket) != "" {
		services = appendPublicService(services, "对象存储", "阿里云 OSS", "存储用户、商家上传的图片、资质、案例、工艺和售后凭证")
	}
	if strings.TrimSpace(os.Getenv("TINODE_SERVER_URL")) != "" || strings.TrimSpace(os.Getenv("TINODE_DATABASE_DSN")) != "" {
		services = appendPublicService(services, "即时通信", "Tinode", "提供平台内沟通、消息同步和会话服务")
	}
	if strings.TrimSpace(os.Getenv("AMAP_API_KEY")) != "" {
		services = appendPublicService(services, "地图定位", "高德地图", "用于地址选择、服务城市和位置相关能力")
	}
	switch strings.ToLower(strings.TrimSpace(os.Getenv("USER_REAL_NAME_VERIFY_PROVIDER"))) {
	case "aliyun":
		services = appendPublicService(services, "个人实名核验", "阿里云实名认证", "用于用户实名信息核验和风控")
	case "tencent":
		services = appendPublicService(services, "个人实名核验", "腾讯云实名认证", "用于用户实名信息核验和风控")
	}
	if strings.EqualFold(strings.TrimSpace(os.Getenv("LICENSE_VERIFY_PROVIDER")), "aliyun") {
		services = appendPublicService(services, "企业核验", "阿里云企业核验", "用于商家主体、营业执照或企业信息核验")
	}

	return services
}

func (s *ConfigService) buildPublicLegalDocuments(version, effectiveDate string) []PublicLegalDocument {
	return []PublicLegalDocument{
		{
			Slug:          "user-agreement",
			Title:         "禾泽云用户服务协议",
			Version:       version,
			EffectiveDate: effectiveDate,
			Content:       s.getPublicConfigValue(model.ConfigKeyPublicUserAgreement, defaultPublicUserAgreement()),
		},
		{
			Slug:          "privacy-policy",
			Title:         "禾泽云隐私政策",
			Version:       version,
			EffectiveDate: effectiveDate,
			Content:       s.getPublicConfigValue(model.ConfigKeyPublicPrivacyPolicy, defaultPublicPrivacyPolicy()),
		},
		{
			Slug:          "transaction-rules",
			Title:         "平台交易规则",
			Version:       version,
			EffectiveDate: effectiveDate,
			Content:       s.getPublicConfigValue(model.ConfigKeyPublicTransactionRules, defaultPublicTransactionRules()),
		},
		{
			Slug:          "refund-rules",
			Title:         "退款与售后规则",
			Version:       version,
			EffectiveDate: effectiveDate,
			Content:       s.getPublicConfigValue(model.ConfigKeyPublicRefundRules, defaultPublicRefundRules()),
		},
		{
			Slug:          "merchant-rules",
			Title:         "商家入驻规则",
			Version:       version,
			EffectiveDate: effectiveDate,
			Content:       s.getPublicConfigValue(model.ConfigKeyPublicMerchantOnboarding, defaultPublicMerchantOnboardingRules()),
		},
		{
			Slug:          "third-party-sharing",
			Title:         "第三方信息共享清单",
			Version:       version,
			EffectiveDate: effectiveDate,
			Content:       s.getPublicConfigValue(model.ConfigKeyPublicThirdPartySharing, defaultPublicThirdPartySharing()),
		},
	}
}

func (s *ConfigService) GetPublicSiteConfig() PublicSiteConfig {
	version := s.getPublicConfigValue(model.ConfigKeyPublicLegalVersion, "v1.0.0-20260430")
	effectiveDate := s.getPublicConfigValue(model.ConfigKeyPublicLegalEffectiveDate, "2026-04-30")
	return PublicSiteConfig{
		BrandName:              s.getPublicConfigValue(model.ConfigKeyPublicBrandName, "禾泽云"),
		CompanyName:            s.getPublicConfigValue(model.ConfigKeyPublicCompanyName, "陕西禾泽云创科技有限公司"),
		CompanyCreditCode:      s.getPublicConfigValue(model.ConfigKeyPublicCompanyCreditCode, "91610102MAK4U1K51H"),
		CompanyRegisterAddress: s.getPublicConfigValue(model.ConfigKeyPublicCompanyRegisterAddr, "陕西省西安市新城区解放路166号1幢所住10401室"),
		CompanyContactAddress:  s.getPublicConfigValue(model.ConfigKeyPublicCompanyContactAddr, "陕西省西安市新城区解放路103号民生百货解放路店F7层7004"),
		ICP:                    s.getPublicConfigValue(model.ConfigKeyPublicICP, "陕ICP备2026004441号"),
		SecurityBeian:          s.getPublicConfigValue(model.ConfigKeyPublicSecurityBeian, ""),
		CustomerPhone:          s.getPublicConfigValue(model.ConfigKeyPublicCustomerPhone, "17764774797"),
		CustomerEmail:          s.getPublicConfigValue(model.ConfigKeyPublicCustomerEmail, ""),
		ComplaintEmail:         s.getPublicConfigValue(model.ConfigKeyPublicComplaintEmail, ""),
		PrivacyEmail:           s.getPublicConfigValue(model.ConfigKeyPublicPrivacyEmail, ""),
		LegalVersion:           version,
		LegalEffectiveDate:     effectiveDate,
		TransactionRules:       s.getPublicConfigValue(model.ConfigKeyPublicTransactionRules, defaultPublicTransactionRules()),
		RefundRules:            s.getPublicConfigValue(model.ConfigKeyPublicRefundRules, defaultPublicRefundRules()),
		MerchantOnboarding:     s.getPublicConfigValue(model.ConfigKeyPublicMerchantOnboarding, defaultPublicMerchantOnboardingRules()),
		LegalDocuments:         s.buildPublicLegalDocuments(version, effectiveDate),
		ThirdPartyServices:     s.detectPublicThirdPartyServices(),
	}
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
	enabledStr, _ := s.GetConfig(model.ConfigKeyTencentIMEnabled)

	sdkAppID, _ := strconv.Atoi(sdkAppIDStr)
	enabled := enabledStr == "true"

	return &TencentIMConfig{
		SDKAppID:  sdkAppID,
		SecretKey: strings.TrimSpace(os.Getenv("TENCENT_IM_SECRET_KEY")),
		Enabled:   enabled,
	}, nil
}
