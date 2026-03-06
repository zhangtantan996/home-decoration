package config

import (
	"os"
	"strings"
)

const (
	AppEnvLocal      = "local"
	AppEnvTest       = "test"
	AppEnvStaging    = "staging"
	AppEnvProduction = "production"
)

func NormalizeAppEnv(raw string) string {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "", "local", "docker", "dev", "development":
		return AppEnvLocal
	case "test", "testing":
		return AppEnvTest
	case "stage", "staging", "pre", "preprod", "pre-prod":
		return AppEnvStaging
	case "prod", "production", "release":
		return AppEnvProduction
	default:
		return AppEnvLocal
	}
}

func GetAppEnv() string {
	return NormalizeAppEnv(os.Getenv("APP_ENV"))
}

func IsLocalLikeAppEnv() bool {
	switch GetAppEnv() {
	case AppEnvLocal, AppEnvTest:
		return true
	default:
		return false
	}
}

func UsesLegacyDockerConfig() bool {
	return strings.EqualFold(strings.TrimSpace(os.Getenv("APP_ENV")), "docker")
}
