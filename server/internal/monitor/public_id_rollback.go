package monitor

import (
	"strconv"
	"strings"
	"sync"
	"time"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
)

type PublicIDRollbackConfig struct {
	DrillEnabled      bool   `json:"drillEnabled"`
	ForceLegacyLookup bool   `json:"forceLegacyLookup"`
	Source            string `json:"source"`
}

type PublicIDRollbackDecision struct {
	Scene             string `json:"scene"`
	Identifier        string `json:"identifier"`
	LegacyCapable     bool   `json:"legacyCapable"`
	LegacyUserID      uint64 `json:"legacyUserId,omitempty"`
	DrillEnabled      bool   `json:"drillEnabled"`
	ForceLegacyLookup bool   `json:"forceLegacyLookup"`
}

type PublicIDRollbackSnapshot struct {
	Config           PublicIDRollbackConfig `json:"config"`
	TotalChecked     uint64                 `json:"totalChecked"`
	LegacyCapable    uint64                 `json:"legacyCapable"`
	LegacyIncapable  uint64                 `json:"legacyIncapable"`
	ForcedLegacyHits uint64                 `json:"forcedLegacyHits"`
	ByScene          map[string]uint64      `json:"byScene"`
	UpdatedAt        time.Time              `json:"updatedAt"`
}

var rollbackConfigStore = struct {
	sync.RWMutex
	config     PublicIDRollbackConfig
	loadedAt   time.Time
	loadedOnce bool
}{
	config: PublicIDRollbackConfig{
		DrillEnabled:      false,
		ForceLegacyLookup: false,
		Source:            "default",
	},
}

var rollbackMetricsStore = struct {
	sync.Mutex
	totalChecked     uint64
	legacyCapable    uint64
	legacyIncapable  uint64
	forcedLegacyHits uint64
	byScene          map[string]uint64
	updatedAt        time.Time
}{
	byScene:   make(map[string]uint64),
	updatedAt: time.Now(),
}

const rollbackConfigRefreshInterval = 30 * time.Second

func loadRollbackConfigValue(key string) (string, bool) {
	var config model.SystemConfig
	if err := repository.DB.Where("key = ?", key).First(&config).Error; err != nil {
		return "", false
	}
	return config.Value, true
}

func loadRollbackConfig() PublicIDRollbackConfig {
	rollbackConfigStore.RLock()
	if rollbackConfigStore.loadedOnce && time.Since(rollbackConfigStore.loadedAt) < rollbackConfigRefreshInterval {
		cfg := rollbackConfigStore.config
		rollbackConfigStore.RUnlock()
		return cfg
	}
	rollbackConfigStore.RUnlock()

	cfg := PublicIDRollbackConfig{
		DrillEnabled:      false,
		ForceLegacyLookup: false,
		Source:            "default",
	}

	if raw, ok := loadRollbackConfigValue(model.ConfigKeyPublicIDRollbackDrillEnabled); ok {
		if enabled, err := strconv.ParseBool(strings.TrimSpace(raw)); err == nil {
			cfg.DrillEnabled = enabled
			cfg.Source = "system_configs"
		}
	}
	if raw, ok := loadRollbackConfigValue(model.ConfigKeyPublicIDRollbackForceLegacyLookup); ok {
		if enabled, err := strconv.ParseBool(strings.TrimSpace(raw)); err == nil {
			cfg.ForceLegacyLookup = enabled
			cfg.Source = "system_configs"
		}
	}

	rollbackConfigStore.Lock()
	rollbackConfigStore.config = cfg
	rollbackConfigStore.loadedAt = time.Now()
	rollbackConfigStore.loadedOnce = true
	rollbackConfigStore.Unlock()

	return cfg
}

func recordRollbackDecision(decision PublicIDRollbackDecision) {
	rollbackMetricsStore.Lock()
	defer rollbackMetricsStore.Unlock()

	rollbackMetricsStore.totalChecked++
	rollbackMetricsStore.byScene[decision.Scene]++
	if decision.LegacyCapable {
		rollbackMetricsStore.legacyCapable++
	} else {
		rollbackMetricsStore.legacyIncapable++
	}
	if decision.ForceLegacyLookup && decision.LegacyCapable {
		rollbackMetricsStore.forcedLegacyHits++
	}
	rollbackMetricsStore.updatedAt = time.Now()
}

// EvaluatePublicIDRollback evaluates rollback-drill readiness for an identifier.
func EvaluatePublicIDRollback(identifier string, scene string) PublicIDRollbackDecision {
	trimmedIdentifier := strings.TrimSpace(identifier)
	if scene == "" {
		scene = "unknown"
	}

	legacyCapable := false
	var legacyUserID uint64
	if userID, err := strconv.ParseUint(trimmedIdentifier, 10, 64); err == nil && userID > 0 {
		legacyCapable = true
		legacyUserID = userID
	}

	cfg := loadRollbackConfig()
	decision := PublicIDRollbackDecision{
		Scene:             scene,
		Identifier:        trimmedIdentifier,
		LegacyCapable:     legacyCapable,
		LegacyUserID:      legacyUserID,
		DrillEnabled:      cfg.DrillEnabled,
		ForceLegacyLookup: cfg.ForceLegacyLookup,
	}
	recordRollbackDecision(decision)
	return decision
}

// SnapshotPublicIDRollback returns rollback-drill config and metrics snapshot.
func SnapshotPublicIDRollback() PublicIDRollbackSnapshot {
	cfg := loadRollbackConfig()

	rollbackMetricsStore.Lock()
	defer rollbackMetricsStore.Unlock()

	byScene := make(map[string]uint64, len(rollbackMetricsStore.byScene))
	for scene, count := range rollbackMetricsStore.byScene {
		byScene[scene] = count
	}

	return PublicIDRollbackSnapshot{
		Config:           cfg,
		TotalChecked:     rollbackMetricsStore.totalChecked,
		LegacyCapable:    rollbackMetricsStore.legacyCapable,
		LegacyIncapable:  rollbackMetricsStore.legacyIncapable,
		ForcedLegacyHits: rollbackMetricsStore.forcedLegacyHits,
		ByScene:          byScene,
		UpdatedAt:        rollbackMetricsStore.updatedAt,
	}
}

// ResetPublicIDRollbackForTest clears in-memory rollback cache and metrics.
func ResetPublicIDRollbackForTest() {
	rollbackConfigStore.Lock()
	rollbackConfigStore.config = PublicIDRollbackConfig{
		DrillEnabled:      false,
		ForceLegacyLookup: false,
		Source:            "default",
	}
	rollbackConfigStore.loadedAt = time.Time{}
	rollbackConfigStore.loadedOnce = false
	rollbackConfigStore.Unlock()

	rollbackMetricsStore.Lock()
	rollbackMetricsStore.totalChecked = 0
	rollbackMetricsStore.legacyCapable = 0
	rollbackMetricsStore.legacyIncapable = 0
	rollbackMetricsStore.forcedLegacyHits = 0
	rollbackMetricsStore.byScene = make(map[string]uint64)
	rollbackMetricsStore.updatedAt = time.Now()
	rollbackMetricsStore.Unlock()
}
