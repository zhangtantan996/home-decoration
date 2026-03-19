package config

import (
	"fmt"
	"net"
	"net/url"
	"os"
	"strings"
)

const allowUnsafeDBTargetEnv = "ALLOW_UNSAFE_DB_TARGET"

func ValidateDatabaseSafety(cfg *Config) error {
	if cfg == nil {
		return nil
	}

	if strings.TrimSpace(os.Getenv(allowUnsafeDBTargetEnv)) == "1" {
		return nil
	}

	return validateDatabaseSafety(GetAppEnv(), cfg.Database.Host, cfg.Database.DBName, cfg.Server.PublicURL)
}

func validateDatabaseSafety(appEnv, host, dbName, publicURL string) error {
	env := NormalizeAppEnv(appEnv)
	normalizedHost := normalizeSafetyValue(host)
	normalizedDBName := normalizeSafetyValue(dbName)
	normalizedPublicHost := normalizeSafetyValue(extractHost(publicURL))

	switch env {
	case AppEnvLocal:
		if !isLocalSafeHost(normalizedHost) {
			return fmt.Errorf("safety guard: APP_ENV=local 仅允许连接本地/内网数据库主机，当前 DATABASE_HOST=%q；如确认需要绕过，请设置 %s=1", host, allowUnsafeDBTargetEnv)
		}
		if looksLikeTaggedTarget(normalizedHost, productionTags) || looksLikeTaggedTarget(normalizedDBName, productionTags) {
			return fmt.Errorf("safety guard: APP_ENV=local 不应连接疑似 production 数据库目标，当前 DATABASE_HOST=%q DATABASE_DBNAME=%q", host, dbName)
		}
	case AppEnvTest:
		if !looksLikeTaggedTarget(normalizedHost, testTags) && !looksLikeTaggedTarget(normalizedDBName, testTags) {
			return fmt.Errorf("safety guard: APP_ENV=test 必须使用带 test 标记的数据库主机或库名，当前 DATABASE_HOST=%q DATABASE_DBNAME=%q；如确认需要绕过，请设置 %s=1", host, dbName, allowUnsafeDBTargetEnv)
		}
		if looksLikeTaggedTarget(normalizedHost, stagingTags) || looksLikeTaggedTarget(normalizedDBName, stagingTags) || looksLikeTaggedTarget(normalizedPublicHost, productionTags) {
			return fmt.Errorf("safety guard: APP_ENV=test 不应复用 staging/production 目标，当前 DATABASE_HOST=%q DATABASE_DBNAME=%q SERVER_PUBLIC_URL=%q", host, dbName, publicURL)
		}
	case AppEnvStaging:
		if !looksLikeTaggedTarget(normalizedHost, stagingTags) && !looksLikeTaggedTarget(normalizedDBName, stagingTags) {
			return fmt.Errorf("safety guard: APP_ENV=staging 必须使用带 staging 标记的数据库主机或库名，当前 DATABASE_HOST=%q DATABASE_DBNAME=%q；如确认需要绕过，请设置 %s=1", host, dbName, allowUnsafeDBTargetEnv)
		}
		if looksLikeTaggedTarget(normalizedHost, testTags) || looksLikeTaggedTarget(normalizedDBName, testTags) {
			return fmt.Errorf("safety guard: APP_ENV=staging 不应连接 test 数据库目标，当前 DATABASE_HOST=%q DATABASE_DBNAME=%q", host, dbName)
		}
	case AppEnvProduction:
		if looksLikeTaggedTarget(normalizedHost, append(testTags, stagingTags...)) || looksLikeTaggedTarget(normalizedDBName, append(testTags, stagingTags...)) {
			return fmt.Errorf("safety guard: APP_ENV=production 不应连接 test/staging 数据库目标，当前 DATABASE_HOST=%q DATABASE_DBNAME=%q", host, dbName)
		}
	}

	return nil
}

var (
	testTags       = []string{"test", "_test", "-test"}
	stagingTags    = []string{"staging", "_staging", "-staging", "stage", "_stage", "-stage", "preprod", "pre-production", "uat"}
	productionTags = []string{"prod", "production"}
)

func normalizeSafetyValue(raw string) string {
	return strings.ToLower(strings.TrimSpace(raw))
}

func looksLikeTaggedTarget(value string, tags []string) bool {
	if value == "" {
		return false
	}
	for _, tag := range tags {
		if strings.Contains(value, tag) {
			return true
		}
	}
	return false
}

func extractHost(rawURL string) string {
	rawURL = strings.TrimSpace(rawURL)
	if rawURL == "" {
		return ""
	}

	parsed, err := url.Parse(rawURL)
	if err != nil {
		return ""
	}

	return parsed.Hostname()
}

func isLocalSafeHost(host string) bool {
	if host == "" {
		return false
	}

	switch host {
	case "localhost", "127.0.0.1", "::1", "db", "home_decor_db_local", "decorating_db", "test_db":
		return true
	}

	ip := net.ParseIP(host)
	if ip == nil {
		return strings.HasSuffix(host, ".local") || strings.HasSuffix(host, ".internal")
	}

	return ip.IsLoopback() || ip.IsPrivate()
}
