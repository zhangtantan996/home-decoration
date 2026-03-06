package config

import "testing"

func TestNormalizeAppEnv(t *testing.T) {
	testCases := map[string]string{
		"":            AppEnvLocal,
		"local":       AppEnvLocal,
		"docker":      AppEnvLocal,
		"dev":         AppEnvLocal,
		"development": AppEnvLocal,
		"test":        AppEnvTest,
		"testing":     AppEnvTest,
		"staging":     AppEnvStaging,
		"stage":       AppEnvStaging,
		"prod":        AppEnvProduction,
		"production":  AppEnvProduction,
		"release":     AppEnvProduction,
		"unknown":     AppEnvLocal,
	}

	for input, expected := range testCases {
		if got := NormalizeAppEnv(input); got != expected {
			t.Fatalf("NormalizeAppEnv(%q) = %q, want %q", input, got, expected)
		}
	}
}
