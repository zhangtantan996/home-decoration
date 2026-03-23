package config

import (
	"fmt"
	"net/url"
	"os"
	"strings"
)

var secureDatabaseSSLModes = map[string]struct{}{
	"require":     {},
	"verify-ca":   {},
	"verify-full": {},
}

// ValidateProductionTransportSafety enforces production transport constraints.
// 1. production/release 必须对外暴露 HTTPS 入口
// 2. production 核心存储必须走内网/私网/容器内目标
// 3. 若配置了公网数据库 DSN，至少要求 TLS
func ValidateProductionTransportSafety(cfg *Config) error {
	if cfg == nil {
		return nil
	}

	appEnv := GetAppEnv()
	if isProductionLikeRuntime(appEnv, cfg.Server.Mode) {
		if !isHTTPSURL(cfg.Server.PublicURL) {
			return fmt.Errorf("transport safety: production/release 环境要求 SERVER_PUBLIC_URL 使用 https，当前值=%q", cfg.Server.PublicURL)
		}
	}

	if NormalizeAppEnv(appEnv) != AppEnvProduction {
		return nil
	}

	if err := validatePrivateHost("DATABASE_HOST", cfg.Database.Host); err != nil {
		return err
	}
	if err := validatePrivateHost("REDIS_HOST", cfg.Redis.Host); err != nil {
		return err
	}
	if err := validateTinodeTransport(os.Getenv("TINODE_DATABASE_DSN")); err != nil {
		return err
	}

	return nil
}

func isProductionLikeRuntime(appEnv, serverMode string) bool {
	return NormalizeAppEnv(appEnv) == AppEnvProduction || strings.EqualFold(strings.TrimSpace(serverMode), "release")
}

func isHTTPSURL(raw string) bool {
	parsed, err := url.Parse(strings.TrimSpace(raw))
	if err != nil {
		return false
	}
	return strings.EqualFold(parsed.Scheme, "https") && strings.TrimSpace(parsed.Host) != ""
}

func validatePrivateHost(label, host string) error {
	normalizedHost := normalizeSafetyValue(host)
	if normalizedHost == "" {
		return fmt.Errorf("transport safety: production 环境要求显式配置 %s，当前为空", label)
	}
	if isLocalSafeHost(normalizedHost) {
		return nil
	}
	return fmt.Errorf("transport safety: production 环境要求 %s 使用内网/私网/容器内主机，当前值=%q", label, host)
}

func validateTinodeTransport(rawDSN string) error {
	rawDSN = strings.TrimSpace(rawDSN)
	if rawDSN == "" {
		return nil
	}

	host, sslmode, err := parsePostgresDSNHostAndSSLMode(rawDSN)
	if err != nil {
		return fmt.Errorf("transport safety: 解析 TINODE_DATABASE_DSN 失败: %w", err)
	}

	normalizedHost := normalizeSafetyValue(host)
	if normalizedHost == "" {
		return fmt.Errorf("transport safety: TINODE_DATABASE_DSN 缺少 host")
	}
	if isLocalSafeHost(normalizedHost) {
		return nil
	}
	if !isSecureDatabaseSSLMode(sslmode) {
		return fmt.Errorf("transport safety: production 环境下公网 Tinode 数据库必须启用 TLS，当前 host=%q sslmode=%q", host, sslmode)
	}
	return nil
}

func parsePostgresDSNHostAndSSLMode(raw string) (string, string, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return "", "", nil
	}

	if strings.Contains(raw, "://") {
		parsed, err := url.Parse(raw)
		if err != nil {
			return "", "", err
		}
		return parsed.Hostname(), parsed.Query().Get("sslmode"), nil
	}

	values := map[string]string{}
	for _, part := range strings.Fields(raw) {
		key, value, ok := strings.Cut(part, "=")
		if !ok {
			continue
		}
		values[strings.ToLower(strings.TrimSpace(key))] = strings.Trim(strings.TrimSpace(value), `"'`)
	}

	if len(values) == 0 {
		return "", "", fmt.Errorf("unsupported dsn format")
	}

	return values["host"], values["sslmode"], nil
}

func isSecureDatabaseSSLMode(raw string) bool {
	_, ok := secureDatabaseSSLModes[normalizeSafetyValue(raw)]
	return ok
}
