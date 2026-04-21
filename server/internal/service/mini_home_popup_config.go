package service

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"gorm.io/gorm"
	"home-decoration-server/internal/model"
	imgutil "home-decoration-server/internal/utils/image"
)

const (
	MiniHomePopupThemeSunrise  = "sunrise"
	MiniHomePopupThemeGraphite = "graphite"

	MiniHomePopupFrequencyEveryTime       = "every_time"
	MiniHomePopupFrequencyDailyOnce       = "daily_once"
	MiniHomePopupFrequencyDailyTwice      = "daily_twice"
	MiniHomePopupFrequencyDailyThreeTimes = "daily_three_times"
	MiniHomePopupFrequencyCampaignOnce    = "campaign_once"
)

type MiniHomePopupAction struct {
	Text string `json:"text"`
	Path string `json:"path"`
}

type MiniHomePopupSecondaryAction struct {
	Enabled bool   `json:"enabled"`
	Text    string `json:"text"`
	Path    string `json:"path"`
}

type MiniHomePopupConfig struct {
	Enabled         bool                         `json:"enabled"`
	CampaignVersion string                       `json:"campaignVersion"`
	Theme           string                       `json:"theme"`
	Kicker          string                       `json:"kicker"`
	Title           string                       `json:"title"`
	Subtitle        string                       `json:"subtitle"`
	HeroImageURL    string                       `json:"heroImageUrl,omitempty"`
	PrimaryAction   MiniHomePopupAction          `json:"primaryAction"`
	SecondaryAction MiniHomePopupSecondaryAction `json:"secondaryAction"`
	Frequency       string                       `json:"frequency"`
	StartAt         string                       `json:"startAt,omitempty"`
	EndAt           string                       `json:"endAt,omitempty"`
}

func defaultMiniHomePopupConfig() MiniHomePopupConfig {
	return MiniHomePopupConfig{
		Enabled:         true,
		CampaignVersion: "builtin-home-popup-v1",
		Theme:           MiniHomePopupThemeSunrise,
		Kicker:          "免费预估",
		Title:           "30 秒生成装修报价",
		Subtitle:        "填写几项信息，快速拿到装修预算参考。",
		HeroImageURL:    "/static/home-popup/default-quote-hero.svg",
		PrimaryAction: MiniHomePopupAction{
			Text: "立即生成",
			Path: "/pages/quote-inquiry/create/index",
		},
		SecondaryAction: MiniHomePopupSecondaryAction{
			Enabled: true,
			Text:    "先看看服务商",
			Path:    "/pages/providers/list/index?type=designer",
		},
		Frequency: MiniHomePopupFrequencyDailyOnce,
	}
}

func defaultMiniHomePopupConfigJSON() string {
	bytes, err := json.Marshal(defaultMiniHomePopupConfig())
	if err != nil {
		return "{}"
	}
	return string(bytes)
}

func normalizeMiniHomePopupActionPath(value string) (string, error) {
	path := strings.TrimSpace(value)
	if path == "" {
		return "", errors.New("弹窗跳转路径不能为空")
	}
	if strings.Contains(path, "://") || strings.HasPrefix(path, "//") {
		return "", errors.New("弹窗跳转路径只允许小程序内部路径")
	}
	if strings.HasPrefix(path, "pages/") {
		path = "/" + path
	}
	if !strings.HasPrefix(path, "/pages/") {
		return "", errors.New("弹窗跳转路径必须以 /pages/ 开头")
	}
	return path, nil
}

func parseMiniHomePopupTime(value string) (time.Time, error) {
	return time.Parse(time.RFC3339, value)
}

func normalizeMiniHomePopupHeroImageURL(value string) string {
	return imgutil.NormalizeStoredImagePath(strings.TrimSpace(value))
}

func validateMiniHomePopupConfig(config MiniHomePopupConfig) error {
	if strings.TrimSpace(config.Title) == "" {
		return errors.New("首页弹窗标题不能为空")
	}
	if strings.TrimSpace(config.PrimaryAction.Text) == "" {
		return errors.New("首页弹窗主按钮文案不能为空")
	}
	if _, err := normalizeMiniHomePopupActionPath(config.PrimaryAction.Path); err != nil {
		return err
	}
	if config.Theme != MiniHomePopupThemeSunrise && config.Theme != MiniHomePopupThemeGraphite {
		return errors.New("首页弹窗主题不支持")
	}
	switch config.Frequency {
	case MiniHomePopupFrequencyEveryTime,
		MiniHomePopupFrequencyDailyOnce,
		MiniHomePopupFrequencyDailyTwice,
		MiniHomePopupFrequencyDailyThreeTimes,
		MiniHomePopupFrequencyCampaignOnce:
	default:
		return errors.New("首页弹窗频控不支持")
	}
	if config.SecondaryAction.Enabled {
		if strings.TrimSpace(config.SecondaryAction.Text) == "" {
			return errors.New("首页弹窗次按钮文案不能为空")
		}
		if _, err := normalizeMiniHomePopupActionPath(config.SecondaryAction.Path); err != nil {
			return err
		}
	}
	if strings.TrimSpace(config.StartAt) != "" {
		if _, err := parseMiniHomePopupTime(config.StartAt); err != nil {
			return errors.New("首页弹窗开始时间格式不正确")
		}
	}
	if strings.TrimSpace(config.EndAt) != "" {
		if _, err := parseMiniHomePopupTime(config.EndAt); err != nil {
			return errors.New("首页弹窗结束时间格式不正确")
		}
	}
	if strings.TrimSpace(config.StartAt) != "" && strings.TrimSpace(config.EndAt) != "" {
		startAt, _ := parseMiniHomePopupTime(config.StartAt)
		endAt, _ := parseMiniHomePopupTime(config.EndAt)
		if endAt.Before(startAt) {
			return errors.New("首页弹窗结束时间不能早于开始时间")
		}
	}
	return nil
}

func normalizeMiniHomePopupConfigPayload(raw string, now time.Time) (MiniHomePopupConfig, error) {
	config := defaultMiniHomePopupConfig()
	if strings.TrimSpace(raw) != "" {
		if err := json.Unmarshal([]byte(raw), &config); err != nil {
			return MiniHomePopupConfig{}, errors.New("首页弹窗配置格式不正确")
		}
	}

	if strings.TrimSpace(config.Theme) == "" {
		config.Theme = MiniHomePopupThemeSunrise
	}
	if strings.TrimSpace(config.Kicker) == "" {
		config.Kicker = defaultMiniHomePopupConfig().Kicker
	}
	if strings.TrimSpace(config.HeroImageURL) == "" {
		config.HeroImageURL = defaultMiniHomePopupConfig().HeroImageURL
	}
	if strings.TrimSpace(config.Frequency) == "" {
		config.Frequency = MiniHomePopupFrequencyDailyOnce
	}
	config.HeroImageURL = normalizeMiniHomePopupHeroImageURL(config.HeroImageURL)

	normalizedPrimaryPath, err := normalizeMiniHomePopupActionPath(config.PrimaryAction.Path)
	if err != nil {
		return MiniHomePopupConfig{}, err
	}
	config.PrimaryAction.Path = normalizedPrimaryPath

	if strings.TrimSpace(config.SecondaryAction.Path) != "" {
		normalizedSecondaryPath, err := normalizeMiniHomePopupActionPath(config.SecondaryAction.Path)
		if err != nil {
			return MiniHomePopupConfig{}, err
		}
		config.SecondaryAction.Path = normalizedSecondaryPath
	}

	config.CampaignVersion = fmt.Sprintf("home-popup-%d", now.UnixNano())

	if err := validateMiniHomePopupConfig(config); err != nil {
		return MiniHomePopupConfig{}, err
	}

	return config, nil
}

func (s *ConfigService) GetActiveMiniHomePopup() (*MiniHomePopupConfig, error) {
	return s.GetActiveMiniHomePopupAt(time.Now())
}

func (s *ConfigService) GetActiveMiniHomePopupAt(now time.Time) (*MiniHomePopupConfig, error) {
	if err := s.InitDefaultConfigs(); err != nil {
		return nil, err
	}

	raw, err := s.GetConfig(model.ConfigKeyMiniHomePopup)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}

	var config MiniHomePopupConfig
	if err := json.Unmarshal([]byte(raw), &config); err != nil {
		return nil, nil
	}
	if !config.Enabled {
		return nil, nil
	}
	if err := validateMiniHomePopupConfig(config); err != nil {
		return nil, nil
	}
	if strings.TrimSpace(config.StartAt) != "" {
		startAt, err := parseMiniHomePopupTime(config.StartAt)
		if err != nil || now.Before(startAt) {
			return nil, nil
		}
	}
	if strings.TrimSpace(config.EndAt) != "" {
		endAt, err := parseMiniHomePopupTime(config.EndAt)
		if err != nil || now.After(endAt) {
			return nil, nil
		}
	}
	config.HeroImageURL = imgutil.GetFullImageURL(config.HeroImageURL)
	return &config, nil
}
