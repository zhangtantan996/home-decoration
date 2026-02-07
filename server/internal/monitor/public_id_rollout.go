package monitor

import (
	"fmt"
	"hash/fnv"
	"strings"
	"sync"
	"time"

	"home-decoration-server/internal/model"
	"strconv"

	"home-decoration-server/internal/repository"
)

type PublicIDRolloutConfig struct {
	Enabled        bool   `json:"enabled"`
	MobilePercent  int    `json:"mobilePercent"`
	DefaultPercent int    `json:"defaultPercent"`
	Source         string `json:"source"`
}

type PublicIDRolloutDecision struct {
	Scene      string `json:"scene"`
	Platform   string `json:"platform"`
	Percent    int    `json:"percent"`
	Bucket     int    `json:"bucket"`
	Matched    bool   `json:"matched"`
	Configured bool   `json:"configured"`
}

type PublicIDRolloutSnapshot struct {
	Config         PublicIDRolloutConfig `json:"config"`
	TotalEvaluated uint64                `json:"totalEvaluated"`
	TotalMatched   uint64                `json:"totalMatched"`
	ByScene        map[string]uint64     `json:"byScene"`
	MatchedByScene map[string]uint64     `json:"matchedByScene"`
	ByPlatform     map[string]uint64     `json:"byPlatform"`
	UpdatedAt      time.Time             `json:"updatedAt"`
}

var rolloutConfigStore = struct {
	sync.RWMutex
	config     PublicIDRolloutConfig
	loadedAt   time.Time
	loadedOnce bool
}{
	config: PublicIDRolloutConfig{
		Enabled:        false,
		MobilePercent:  5,
		DefaultPercent: 0,
		Source:         "default",
	},
}

var rolloutMetricsStore = struct {
	sync.Mutex
	totalEvaluated uint64
	totalMatched   uint64
	byScene        map[string]uint64
	matchedByScene map[string]uint64
	byPlatform     map[string]uint64
	updatedAt      time.Time
}{
	byScene:        make(map[string]uint64),
	matchedByScene: make(map[string]uint64),
	byPlatform:     make(map[string]uint64),
	updatedAt:      time.Now(),
}

const rolloutConfigRefreshInterval = 30 * time.Second

// DetectClientPlatform normalizes client platform values for rollout targeting.
func DetectClientPlatform(platformHeader string, userAgent string) string {
	normalized := strings.ToLower(strings.TrimSpace(platformHeader))
	if normalized != "" {
		switch {
		case strings.Contains(normalized, "mini") || strings.Contains(normalized, "wechat"):
			return "mini"
		case strings.Contains(normalized, "mobile") || strings.Contains(normalized, "ios") || strings.Contains(normalized, "android") || strings.Contains(normalized, "app"):
			return "mobile"
		default:
			return "web"
		}
	}

	ua := strings.ToLower(strings.TrimSpace(userAgent))
	switch {
	case strings.Contains(ua, "micromessenger") && strings.Contains(ua, "mini"):
		return "mini"
	case strings.Contains(ua, "android"), strings.Contains(ua, "iphone"), strings.Contains(ua, "ipad"), strings.Contains(ua, "okhttp"), strings.Contains(ua, "cfnetwork"), strings.Contains(ua, "reactnative"):
		return "mobile"
	default:
		return "web"
	}
}

func clampPercent(percent int) int {
	if percent < 0 {
		return 0
	}
	if percent > 100 {
		return 100
	}
	return percent
}

func loadSystemConfigValue(key string) (string, bool) {
	var config model.SystemConfig
	if err := repository.DB.Where("key = ?", key).First(&config).Error; err != nil {
		return "", false
	}
	return config.Value, true
}

func computeRolloutBucket(userID uint64, platform string) int {
	h := fnv.New32a()
	_, _ = h.Write([]byte(fmt.Sprintf("%d:%s:public-id-rollout", userID, platform)))
	return int(h.Sum32() % 100)
}

func loadRolloutConfig() PublicIDRolloutConfig {
	rolloutConfigStore.RLock()
	if rolloutConfigStore.loadedOnce && time.Since(rolloutConfigStore.loadedAt) < rolloutConfigRefreshInterval {
		cfg := rolloutConfigStore.config
		rolloutConfigStore.RUnlock()
		return cfg
	}
	rolloutConfigStore.RUnlock()

	cfg := PublicIDRolloutConfig{
		Enabled:        false,
		MobilePercent:  5,
		DefaultPercent: 0,
		Source:         "default",
	}

	if raw, ok := loadSystemConfigValue(model.ConfigKeyPublicIDRolloutEnabled); ok {
		if enabled, err := strconv.ParseBool(strings.TrimSpace(raw)); err == nil {
			cfg.Enabled = enabled
			cfg.Source = "system_configs"
		}
	}
	if raw, ok := loadSystemConfigValue(model.ConfigKeyPublicIDRolloutMobilePercent); ok {
		if percent, err := strconv.Atoi(strings.TrimSpace(raw)); err == nil {
			cfg.MobilePercent = clampPercent(percent)
			cfg.Source = "system_configs"
		}
	}
	if raw, ok := loadSystemConfigValue(model.ConfigKeyPublicIDRolloutDefaultPercent); ok {
		if percent, err := strconv.Atoi(strings.TrimSpace(raw)); err == nil {
			cfg.DefaultPercent = clampPercent(percent)
			cfg.Source = "system_configs"
		}
	}

	rolloutConfigStore.Lock()
	rolloutConfigStore.config = cfg
	rolloutConfigStore.loadedAt = time.Now()
	rolloutConfigStore.loadedOnce = true
	rolloutConfigStore.Unlock()

	return cfg
}

func recordRolloutDecision(decision PublicIDRolloutDecision) {
	rolloutMetricsStore.Lock()
	defer rolloutMetricsStore.Unlock()

	rolloutMetricsStore.totalEvaluated++
	rolloutMetricsStore.byScene[decision.Scene]++
	rolloutMetricsStore.byPlatform[decision.Platform]++
	if decision.Matched {
		rolloutMetricsStore.totalMatched++
		rolloutMetricsStore.matchedByScene[decision.Scene]++
	}
	rolloutMetricsStore.updatedAt = time.Now()
}

// EvaluatePublicIDRollout evaluates whether a request falls into current publicId rollout bucket.
func EvaluatePublicIDRollout(userID uint64, scene string, platform string) PublicIDRolloutDecision {
	if scene == "" {
		scene = "unknown"
	}
	if platform == "" {
		platform = "web"
	}

	cfg := loadRolloutConfig()
	percent := cfg.DefaultPercent
	if platform == "mobile" || platform == "mini" {
		percent = cfg.MobilePercent
	}
	percent = clampPercent(percent)

	bucket := computeRolloutBucket(userID, platform)
	matched := cfg.Enabled && userID > 0 && bucket < percent

	decision := PublicIDRolloutDecision{
		Scene:      scene,
		Platform:   platform,
		Percent:    percent,
		Bucket:     bucket,
		Matched:    matched,
		Configured: cfg.Enabled,
	}
	recordRolloutDecision(decision)
	return decision
}

// SnapshotPublicIDRollout returns the latest rollout config and metrics snapshot.
func SnapshotPublicIDRollout() PublicIDRolloutSnapshot {
	cfg := loadRolloutConfig()

	rolloutMetricsStore.Lock()
	defer rolloutMetricsStore.Unlock()

	byScene := make(map[string]uint64, len(rolloutMetricsStore.byScene))
	for scene, count := range rolloutMetricsStore.byScene {
		byScene[scene] = count
	}
	matchedByScene := make(map[string]uint64, len(rolloutMetricsStore.matchedByScene))
	for scene, count := range rolloutMetricsStore.matchedByScene {
		matchedByScene[scene] = count
	}
	byPlatform := make(map[string]uint64, len(rolloutMetricsStore.byPlatform))
	for platform, count := range rolloutMetricsStore.byPlatform {
		byPlatform[platform] = count
	}

	return PublicIDRolloutSnapshot{
		Config:         cfg,
		TotalEvaluated: rolloutMetricsStore.totalEvaluated,
		TotalMatched:   rolloutMetricsStore.totalMatched,
		ByScene:        byScene,
		MatchedByScene: matchedByScene,
		ByPlatform:     byPlatform,
		UpdatedAt:      rolloutMetricsStore.updatedAt,
	}
}
