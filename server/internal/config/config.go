package config

import (
	"bufio"
	"os"
	"strings"

	"github.com/spf13/viper"
)

type Config struct {
	Server               ServerConfig               `mapstructure:"server"`
	Database             DatabaseConfig             `mapstructure:"database"`
	Redis                RedisConfig                `mapstructure:"redis"`
	JWT                  JWTConfig                  `mapstructure:"jwt"`
	AdminAuth            AdminAuthConfig            `mapstructure:"admin_auth"`
	Log                  LogConfig                  `mapstructure:"log"`
	WechatMini           WechatMiniConfig           `mapstructure:"wechat_mini"`
	WechatH5             WechatH5Config             `mapstructure:"wechat_h5"`
	WechatPay            WechatPayConfig            `mapstructure:"wechat_pay"`
	Alipay               AlipayConfig               `mapstructure:"alipay"`
	SMS                  SMSConfig                  `mapstructure:"sms"`
	NotificationRealtime NotificationRealtimeConfig `mapstructure:"notification_realtime"`
}

type ServerConfig struct {
	Host           string `mapstructure:"host"`
	Port           string `mapstructure:"port"`
	Mode           string `mapstructure:"mode"` // debug, release
	PublicURL      string `mapstructure:"public_url"`
	TrustedProxies string `mapstructure:"trusted_proxies"`
}

type DatabaseConfig struct {
	Host        string `mapstructure:"host"`
	Port        string `mapstructure:"port"`
	User        string `mapstructure:"user"`
	Password    string `mapstructure:"password"`
	DBName      string `mapstructure:"dbname"`
	SSLMode     string `mapstructure:"sslmode"`
	AutoMigrate bool   `mapstructure:"auto_migrate"` // 是否启用自动迁移（默认 false）

	MaxOpenConns           int `mapstructure:"max_open_conns"`
	MaxIdleConns           int `mapstructure:"max_idle_conns"`
	ConnMaxLifetimeMinutes int `mapstructure:"conn_max_lifetime_minutes"`
	ConnMaxIdleTimeMinutes int `mapstructure:"conn_max_idle_time_minutes"`
}

type RedisConfig struct {
	Host               string `mapstructure:"host"`
	Port               string `mapstructure:"port"`
	Password           string `mapstructure:"password"`
	DB                 int    `mapstructure:"db"`
	OperationTimeoutMs int    `mapstructure:"operation_timeout_ms"`
}

type JWTConfig struct {
	Secret     string `mapstructure:"secret"`
	ExpireHour int    `mapstructure:"expire_hour"`
}

type AdminAuthConfig struct {
	AccessTokenMinutes int    `mapstructure:"access_token_minutes"`
	RefreshTokenDays   int    `mapstructure:"refresh_token_days"`
	LoginFailLimit     int    `mapstructure:"login_fail_limit"`
	LoginLockMinutes   int    `mapstructure:"login_lock_minutes"`
	PasswordMinLength  int    `mapstructure:"password_min_length"`
	PasswordMaxAgeDays int    `mapstructure:"password_max_age_days"`
	TOTPEnabled        bool   `mapstructure:"totp_enabled"`
	TOTPIssuer         string `mapstructure:"totp_issuer"`
	RequiredRoleKeys   string `mapstructure:"required_role_keys"`
	ReauthTTLMinutes   int    `mapstructure:"reauth_ttl_minutes"`
	MaxActiveSessions  int    `mapstructure:"max_active_sessions"`
	APIIPEnforced      bool   `mapstructure:"api_ip_enforced"`
	AllowedCIDRs       string `mapstructure:"allowed_cidrs"`
}

type LogConfig struct {
	Level              string `mapstructure:"level"`                // debug, info, warn, error
	File               string `mapstructure:"file"`                 // 日志文件路径
	AuditRetentionDays int    `mapstructure:"audit_retention_days"` // 审计日志保留天数（生产环境最少 180 天）
}

// WechatMiniConfig 微信小程序配置
type WechatMiniConfig struct {
	AppID                  string `mapstructure:"app_id"`
	AppSecret              string `mapstructure:"app_secret"`
	BindTokenExpireMinutes int    `mapstructure:"bind_token_expire_minutes"`
}

// WechatH5Config 微信网页授权（公众号）配置
type WechatH5Config struct {
	AppID                  string `mapstructure:"app_id"`
	AppSecret              string `mapstructure:"app_secret"`
	BindTokenExpireMinutes int    `mapstructure:"bind_token_expire_minutes"`
	OAuthScope             string `mapstructure:"oauth_scope"`
	StateSigningSecret     string `mapstructure:"state_signing_secret"`
	BasePath               string `mapstructure:"base_path"`
}

type WechatPayConfig struct {
	AppID          string `mapstructure:"app_id"`
	MchID          string `mapstructure:"mch_id"`
	SerialNo       string `mapstructure:"serial_no"`
	PrivateKey     string `mapstructure:"private_key"`
	APIv3Key       string `mapstructure:"api_v3_key"`
	NotifyURL      string `mapstructure:"notify_url"`
	TimeoutMinutes int    `mapstructure:"timeout_minutes"`
}

type AlipayConfig struct {
	Enabled        bool   `mapstructure:"enabled"`
	GatewayURL     string `mapstructure:"gateway_url"`
	AppID          string `mapstructure:"app_id"`
	AppPrivateKey  string `mapstructure:"app_private_key"`
	PublicKey      string `mapstructure:"public_key"`
	NotifyURL      string `mapstructure:"notify_url"`
	ReturnURLWeb   string `mapstructure:"return_url_web"`
	ReturnURLH5    string `mapstructure:"return_url_h5"`
	TimeoutMinutes int    `mapstructure:"timeout_minutes"`
	Sandbox        bool   `mapstructure:"sandbox"`
}

// SMSConfig 短信服务配置（生产环境建议使用云短信服务，如阿里云短信）
type SMSConfig struct {
	Provider                     string  `mapstructure:"provider"` // mock | aliyun
	AccessKeyID                  string  `mapstructure:"access_key_id"`
	AccessKeySecret              string  `mapstructure:"access_key_secret"`
	SignName                     string  `mapstructure:"sign_name"`
	TemplateCode                 string  `mapstructure:"template_code"`
	TemplateCodeLow              string  `mapstructure:"template_code_low"`
	TemplateCodeMedium           string  `mapstructure:"template_code_medium"`
	TemplateCodeHigh             string  `mapstructure:"template_code_high"`
	TemplateCodeLogin            string  `mapstructure:"template_code_login"`
	TemplateCodeRegister         string  `mapstructure:"template_code_register"`
	TemplateCodeIdentityApply    string  `mapstructure:"template_code_identity_apply"`
	TemplateCodeMerchantWithdraw string  `mapstructure:"template_code_merchant_withdraw"`
	TemplateCodeMerchantBankBind string  `mapstructure:"template_code_merchant_bank_bind"`
	TemplateCodeChangePhone      string  `mapstructure:"template_code_change_phone"`
	TemplateCodeDeleteAccount    string  `mapstructure:"template_code_delete_account"`
	RegionID                     string  `mapstructure:"region_id"` // default: cn-hangzhou
	DebugBypass                  bool    `mapstructure:"debug_bypass"`
	RiskEnabled                  bool    `mapstructure:"risk_enabled"`
	CodeMaxAttempts              int     `mapstructure:"code_max_attempts"`
	PhoneDailyLimit              int     `mapstructure:"phone_daily_limit"`
	IPDailyLimit                 int     `mapstructure:"ip_daily_limit"`
	CaptchaEnabled               bool    `mapstructure:"captcha_enabled"`
	CaptchaProvider              string  `mapstructure:"captcha_provider"` // turnstile | hcaptcha | recaptcha
	CaptchaVerifyURL             string  `mapstructure:"captcha_verify_url"`
	CaptchaSecretKey             string  `mapstructure:"captcha_secret_key"`
	CaptchaTimeoutMs             int     `mapstructure:"captcha_timeout_ms"`
	CaptchaMinScore              float64 `mapstructure:"captcha_min_score"`
}

type NotificationRealtimeConfig struct {
	Enabled               bool `mapstructure:"enabled"`
	MaxConnectionsPerUser int  `mapstructure:"max_connections_per_user"`
	MaxConnectionsPerIP   int  `mapstructure:"max_connections_per_ip"`
	PingIntervalSeconds   int  `mapstructure:"ping_interval_seconds"`
	IdleTimeoutSeconds    int  `mapstructure:"idle_timeout_seconds"`
	SendBufferSize        int  `mapstructure:"send_buffer_size"`
}

func Load() (*Config, error) {
	loadOptionalEnvFiles("../.env", ".env", "server/.env")

	if UsesLegacyDockerConfig() {
		viper.SetConfigName("config.docker")
	} else {
		viper.SetConfigName("config")
	}
	viper.SetConfigType("yaml")
	viper.AddConfigPath(".")
	viper.AddConfigPath("./config")
	viper.AutomaticEnv()
	viper.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))

	_ = viper.BindEnv("server.host", "SERVER_HOST")
	_ = viper.BindEnv("server.port", "SERVER_PORT")
	_ = viper.BindEnv("server.mode", "SERVER_MODE")
	_ = viper.BindEnv("server.public_url", "SERVER_PUBLIC_URL")
	_ = viper.BindEnv("server.trusted_proxies", "SERVER_TRUSTED_PROXIES")

	_ = viper.BindEnv("database.host", "DATABASE_HOST")
	_ = viper.BindEnv("database.port", "DATABASE_PORT")
	_ = viper.BindEnv("database.user", "DATABASE_USER")
	_ = viper.BindEnv("database.password", "DATABASE_PASSWORD")
	_ = viper.BindEnv("database.dbname", "DATABASE_DBNAME")
	_ = viper.BindEnv("database.sslmode", "DATABASE_SSLMODE")

	// 兼容历史/文档环境变量别名（推荐仍使用 DATABASE_* / REDIS_*）
	_ = viper.BindEnv("database.host", "DB_HOST")
	_ = viper.BindEnv("database.port", "DB_PORT")
	_ = viper.BindEnv("database.user", "DB_USER")
	_ = viper.BindEnv("database.password", "DB_PASSWORD")
	_ = viper.BindEnv("database.dbname", "DB_NAME")
	_ = viper.BindEnv("database.dbname", "DATABASE_NAME")

	_ = viper.BindEnv("redis.host", "REDIS_HOST")
	_ = viper.BindEnv("redis.port", "REDIS_PORT")
	_ = viper.BindEnv("redis.password", "REDIS_PASSWORD")
	_ = viper.BindEnv("redis.db", "REDIS_DB")

	_ = viper.BindEnv("jwt.secret", "JWT_SECRET")
	_ = viper.BindEnv("jwt.expire_hour", "JWT_EXPIRE_HOUR")
	_ = viper.BindEnv("admin_auth.access_token_minutes", "ADMIN_AUTH_ACCESS_TOKEN_MINUTES")
	_ = viper.BindEnv("admin_auth.refresh_token_days", "ADMIN_AUTH_REFRESH_TOKEN_DAYS")
	_ = viper.BindEnv("admin_auth.login_fail_limit", "ADMIN_AUTH_LOGIN_FAIL_LIMIT")
	_ = viper.BindEnv("admin_auth.login_lock_minutes", "ADMIN_AUTH_LOGIN_LOCK_MINUTES")
	_ = viper.BindEnv("admin_auth.password_min_length", "ADMIN_AUTH_PASSWORD_MIN_LENGTH")
	_ = viper.BindEnv("admin_auth.password_max_age_days", "ADMIN_AUTH_PASSWORD_MAX_AGE_DAYS")
	_ = viper.BindEnv("admin_auth.totp_enabled", "ADMIN_AUTH_TOTP_ENABLED")
	_ = viper.BindEnv("admin_auth.totp_issuer", "ADMIN_AUTH_TOTP_ISSUER")
	_ = viper.BindEnv("admin_auth.required_role_keys", "ADMIN_AUTH_2FA_REQUIRED_ROLE_KEYS")
	_ = viper.BindEnv("admin_auth.reauth_ttl_minutes", "ADMIN_AUTH_REAUTH_TTL_MINUTES")
	_ = viper.BindEnv("admin_auth.max_active_sessions", "ADMIN_AUTH_MAX_ACTIVE_SESSIONS")
	_ = viper.BindEnv("admin_auth.api_ip_enforced", "ADMIN_AUTH_API_IP_ENFORCED")
	_ = viper.BindEnv("admin_auth.allowed_cidrs", "ADMIN_AUTH_ALLOWED_CIDRS")
	_ = viper.BindEnv("log.audit_retention_days", "LOG_AUDIT_RETENTION_DAYS")

	_ = viper.BindEnv("sms.provider", "SMS_PROVIDER")
	_ = viper.BindEnv("alipay.enabled", "ALIPAY_ENABLED")
	_ = viper.BindEnv("alipay.gateway_url", "ALIPAY_GATEWAY_URL")
	_ = viper.BindEnv("alipay.app_id", "ALIPAY_APP_ID")
	_ = viper.BindEnv("alipay.app_private_key", "ALIPAY_APP_PRIVATE_KEY")
	_ = viper.BindEnv("alipay.public_key", "ALIPAY_PUBLIC_KEY")
	_ = viper.BindEnv("alipay.notify_url", "ALIPAY_NOTIFY_URL")
	_ = viper.BindEnv("alipay.return_url_web", "ALIPAY_RETURN_URL_WEB")
	_ = viper.BindEnv("alipay.return_url_h5", "ALIPAY_RETURN_URL_H5")
	_ = viper.BindEnv("alipay.timeout_minutes", "ALIPAY_TIMEOUT_MINUTES")
	_ = viper.BindEnv("alipay.sandbox", "ALIPAY_SANDBOX")
	_ = viper.BindEnv("sms.access_key_id", "SMS_ACCESS_KEY_ID")
	_ = viper.BindEnv("sms.access_key_secret", "SMS_ACCESS_KEY_SECRET")
	_ = viper.BindEnv("sms.sign_name", "SMS_SIGN_NAME")
	_ = viper.BindEnv("sms.template_code", "SMS_TEMPLATE_CODE")
	_ = viper.BindEnv("sms.template_code_low", "SMS_TEMPLATE_CODE_LOW")
	_ = viper.BindEnv("sms.template_code_medium", "SMS_TEMPLATE_CODE_MEDIUM")
	_ = viper.BindEnv("sms.template_code_high", "SMS_TEMPLATE_CODE_HIGH")
	_ = viper.BindEnv("sms.template_code_login", "SMS_TEMPLATE_CODE_LOGIN")
	_ = viper.BindEnv("sms.template_code_register", "SMS_TEMPLATE_CODE_REGISTER")
	_ = viper.BindEnv("sms.template_code_identity_apply", "SMS_TEMPLATE_CODE_IDENTITY_APPLY")
	_ = viper.BindEnv("sms.template_code_merchant_withdraw", "SMS_TEMPLATE_CODE_MERCHANT_WITHDRAW")
	_ = viper.BindEnv("sms.template_code_merchant_bank_bind", "SMS_TEMPLATE_CODE_MERCHANT_BANK_BIND")
	_ = viper.BindEnv("sms.template_code_change_phone", "SMS_TEMPLATE_CODE_CHANGE_PHONE")
	_ = viper.BindEnv("sms.template_code_delete_account", "SMS_TEMPLATE_CODE_DELETE_ACCOUNT")
	_ = viper.BindEnv("sms.region_id", "SMS_REGION_ID")
	_ = viper.BindEnv("wechat_h5.base_path", "WECHAT_H5_BASE_PATH")
	_ = viper.BindEnv("wechat_pay.app_id", "WECHAT_PAY_APP_ID")
	_ = viper.BindEnv("wechat_pay.mch_id", "WECHAT_PAY_MCH_ID")
	_ = viper.BindEnv("wechat_pay.serial_no", "WECHAT_PAY_SERIAL_NO")
	_ = viper.BindEnv("wechat_pay.private_key", "WECHAT_PAY_PRIVATE_KEY")
	_ = viper.BindEnv("wechat_pay.api_v3_key", "WECHAT_PAY_API_V3_KEY")
	_ = viper.BindEnv("wechat_pay.notify_url", "WECHAT_PAY_NOTIFY_URL")
	_ = viper.BindEnv("wechat_pay.timeout_minutes", "WECHAT_PAY_TIMEOUT_MINUTES")
	_ = viper.BindEnv("notification_realtime.enabled", "NOTIFICATION_REALTIME_ENABLED")
	_ = viper.BindEnv("notification_realtime.max_connections_per_user", "NOTIFICATION_WS_MAX_CONN_PER_USER")
	_ = viper.BindEnv("notification_realtime.max_connections_per_ip", "NOTIFICATION_WS_MAX_CONN_PER_IP")
	_ = viper.BindEnv("notification_realtime.ping_interval_seconds", "NOTIFICATION_WS_PING_INTERVAL_SECONDS")
	_ = viper.BindEnv("notification_realtime.idle_timeout_seconds", "NOTIFICATION_WS_IDLE_TIMEOUT_SECONDS")
	_ = viper.BindEnv("notification_realtime.send_buffer_size", "NOTIFICATION_WS_SEND_BUFFER_SIZE")

	// 设置默认值
	viper.SetDefault("server.host", "0.0.0.0")
	viper.SetDefault("server.port", "8080")
	viper.SetDefault("server.mode", "debug")
	viper.SetDefault("server.public_url", "http://localhost:8080")
	viper.SetDefault("server.trusted_proxies", "127.0.0.1,::1,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16")
	viper.SetDefault("database.host", "localhost")
	viper.SetDefault("database.port", "5432")
	viper.SetDefault("database.sslmode", "disable")
	viper.SetDefault("database.max_open_conns", 25)
	viper.SetDefault("database.max_idle_conns", 10)
	viper.SetDefault("database.conn_max_lifetime_minutes", 30)
	viper.SetDefault("database.conn_max_idle_time_minutes", 5)
	viper.SetDefault("redis.host", "localhost")
	viper.SetDefault("redis.port", "6379")
	viper.SetDefault("redis.db", 0)
	viper.SetDefault("redis.operation_timeout_ms", 3000)
	viper.SetDefault("jwt.expire_hour", 72)
	viper.SetDefault("admin_auth.access_token_minutes", 30)
	viper.SetDefault("admin_auth.refresh_token_days", 7)
	viper.SetDefault("admin_auth.login_fail_limit", 5)
	viper.SetDefault("admin_auth.login_lock_minutes", 30)
	viper.SetDefault("admin_auth.password_min_length", 10)
	viper.SetDefault("admin_auth.password_max_age_days", 90)
	viper.SetDefault("admin_auth.totp_enabled", !IsLocalLikeAppEnv())
	viper.SetDefault("admin_auth.totp_issuer", "禾泽云管理后台")
	if IsLocalLikeAppEnv() {
		viper.SetDefault("admin_auth.required_role_keys", "")
	} else {
		viper.SetDefault("admin_auth.required_role_keys", "*")
	}
	viper.SetDefault("admin_auth.reauth_ttl_minutes", 10)
	viper.SetDefault("admin_auth.max_active_sessions", 5)
	viper.SetDefault("admin_auth.api_ip_enforced", false)
	viper.SetDefault("admin_auth.allowed_cidrs", "")
	viper.SetDefault("log.level", "info")
	viper.SetDefault("log.file", "logs/backend.log")
	viper.SetDefault("log.audit_retention_days", 180)
	viper.SetDefault("wechat_mini.bind_token_expire_minutes", 5)
	viper.SetDefault("wechat_h5.bind_token_expire_minutes", 5)
	viper.SetDefault("wechat_h5.oauth_scope", "snsapi_base")
	viper.SetDefault("wechat_h5.base_path", "/app")
	viper.SetDefault("wechat_pay.timeout_minutes", 15)
	viper.SetDefault("alipay.enabled", false)
	viper.SetDefault("alipay.gateway_url", "https://openapi.alipay.com/gateway.do")
	viper.SetDefault("alipay.notify_url", "")
	viper.SetDefault("alipay.return_url_web", "")
	viper.SetDefault("alipay.return_url_h5", "")
	viper.SetDefault("alipay.timeout_minutes", 15)
	viper.SetDefault("alipay.sandbox", false)
	viper.SetDefault("sms.provider", "mock")
	viper.SetDefault("sms.region_id", "cn-hangzhou")
	viper.SetDefault("sms.debug_bypass", false)
	viper.SetDefault("sms.risk_enabled", true)
	viper.SetDefault("sms.code_max_attempts", 5)
	viper.SetDefault("sms.phone_daily_limit", 10)
	viper.SetDefault("sms.ip_daily_limit", 20)
	viper.SetDefault("sms.captcha_enabled", false)
	viper.SetDefault("sms.captcha_provider", "turnstile")
	viper.SetDefault("sms.captcha_verify_url", "")
	viper.SetDefault("sms.captcha_secret_key", "")
	viper.SetDefault("sms.captcha_timeout_ms", 3000)
	viper.SetDefault("sms.captcha_min_score", 0.0)
	viper.SetDefault("notification_realtime.enabled", true)
	viper.SetDefault("notification_realtime.max_connections_per_user", 5)
	viper.SetDefault("notification_realtime.max_connections_per_ip", 50)
	viper.SetDefault("notification_realtime.ping_interval_seconds", 30)
	viper.SetDefault("notification_realtime.idle_timeout_seconds", 90)
	viper.SetDefault("notification_realtime.send_buffer_size", 32)

	if err := viper.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
			return nil, err
		}
	}

	var cfg Config
	if err := viper.Unmarshal(&cfg); err != nil {
		return nil, err
	}
	if NormalizeAppEnv(cfg.Server.Mode) == AppEnvProduction && cfg.Log.AuditRetentionDays < 180 {
		cfg.Log.AuditRetentionDays = 180
	}

	globalConfig = &cfg
	return &cfg, nil
}

func loadOptionalEnvFiles(paths ...string) {
	for _, path := range paths {
		file, err := os.Open(path)
		if err != nil {
			continue
		}

		scanner := bufio.NewScanner(file)
		for scanner.Scan() {
			line := strings.TrimSpace(scanner.Text())
			if line == "" || strings.HasPrefix(line, "#") {
				continue
			}
			if strings.HasPrefix(line, "export ") {
				line = strings.TrimSpace(strings.TrimPrefix(line, "export "))
			}

			key, value, ok := strings.Cut(line, "=")
			if !ok {
				continue
			}

			key = strings.TrimSpace(key)
			if key == "" {
				continue
			}
			if _, exists := os.LookupEnv(key); exists {
				continue
			}

			value = strings.TrimSpace(value)
			if len(value) >= 2 {
				if (strings.HasPrefix(value, "\"") && strings.HasSuffix(value, "\"")) ||
					(strings.HasPrefix(value, "'") && strings.HasSuffix(value, "'")) {
					value = value[1 : len(value)-1]
				}
			}
			if key == "ALIPAY_APP_PRIVATE_KEY" || key == "ALIPAY_PUBLIC_KEY" || key == "WECHAT_PAY_PRIVATE_KEY" {
				value = strings.ReplaceAll(value, "\\n", "\n")
			}

			_ = os.Setenv(key, value)
		}

		_ = file.Close()
	}
}

var globalConfig *Config

// GetConfig 获取全局配置
func GetConfig() *Config {
	if globalConfig == nil {
		cfg, _ := Load()
		globalConfig = cfg
	}
	return globalConfig
}

// GetDSN 返回数据库连接字符串
func (c *DatabaseConfig) GetDSN() string {
	return "host=" + c.Host +
		" port=" + c.Port +
		" user=" + c.User +
		" password=" + c.Password +
		" dbname=" + c.DBName +
		" sslmode=" + c.SSLMode
}
