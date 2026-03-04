package config

import (
	"os"
	"strings"

	"github.com/spf13/viper"
)

type Config struct {
	Server     ServerConfig     `mapstructure:"server"`
	Database   DatabaseConfig   `mapstructure:"database"`
	Redis      RedisConfig      `mapstructure:"redis"`
	JWT        JWTConfig        `mapstructure:"jwt"`
	Log        LogConfig        `mapstructure:"log"`
	WechatMini WechatMiniConfig `mapstructure:"wechat_mini"`
	WechatH5   WechatH5Config   `mapstructure:"wechat_h5"`
	SMS        SMSConfig        `mapstructure:"sms"`
}

type ServerConfig struct {
	Host      string `mapstructure:"host"`
	Port      string `mapstructure:"port"`
	Mode      string `mapstructure:"mode"` // debug, release
	PublicURL string `mapstructure:"public_url"`
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

type LogConfig struct {
	Level string `mapstructure:"level"` // debug, info, warn, error
	File  string `mapstructure:"file"`  // 日志文件路径
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
}

// SMSConfig 短信服务配置（生产环境建议使用云短信服务，如阿里云短信）
type SMSConfig struct {
	Provider         string  `mapstructure:"provider"` // mock | aliyun
	AccessKeyID      string  `mapstructure:"access_key_id"`
	AccessKeySecret  string  `mapstructure:"access_key_secret"`
	SignName         string  `mapstructure:"sign_name"`
	TemplateCode     string  `mapstructure:"template_code"`
	RegionID         string  `mapstructure:"region_id"` // default: cn-hangzhou
	DebugBypass      bool    `mapstructure:"debug_bypass"`
	RiskEnabled      bool    `mapstructure:"risk_enabled"`
	CodeMaxAttempts  int     `mapstructure:"code_max_attempts"`
	PhoneDailyLimit  int     `mapstructure:"phone_daily_limit"`
	IPDailyLimit     int     `mapstructure:"ip_daily_limit"`
	CaptchaEnabled   bool    `mapstructure:"captcha_enabled"`
	CaptchaProvider  string  `mapstructure:"captcha_provider"` // turnstile | hcaptcha | recaptcha
	CaptchaVerifyURL string  `mapstructure:"captcha_verify_url"`
	CaptchaSecretKey string  `mapstructure:"captcha_secret_key"`
	CaptchaTimeoutMs int     `mapstructure:"captcha_timeout_ms"`
	CaptchaMinScore  float64 `mapstructure:"captcha_min_score"`
}

func Load() (*Config, error) {
	// 根据 APP_ENV 环境变量选择配置文件
	// local/docker 环境使用 config.docker.yaml
	appEnv := os.Getenv("APP_ENV")
	if appEnv == "local" || appEnv == "docker" {
		viper.SetConfigName("config.docker")
	} else {
		viper.SetConfigName("config")
	}
	viper.SetConfigType("yaml")
	viper.AddConfigPath(".")
	viper.AddConfigPath("./config")
	viper.AutomaticEnv()
	// 设置环境变量键名替换规则：将 . 替换为 _（如 database.password -> DATABASE_PASSWORD）
	viper.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))

	// 兼容历史/文档环境变量别名（推荐仍使用 DATABASE_* / REDIS_*）
	_ = viper.BindEnv("database.host", "DB_HOST")
	_ = viper.BindEnv("database.port", "DB_PORT")
	_ = viper.BindEnv("database.user", "DB_USER")
	_ = viper.BindEnv("database.password", "DB_PASSWORD")
	_ = viper.BindEnv("database.dbname", "DB_NAME")
	_ = viper.BindEnv("database.dbname", "DATABASE_NAME")

	// 设置默认值
	viper.SetDefault("server.host", "0.0.0.0")
	viper.SetDefault("server.port", "8080")
	viper.SetDefault("server.mode", "debug")
	viper.SetDefault("server.public_url", "http://localhost:8080")
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
	viper.SetDefault("log.level", "info")
	viper.SetDefault("log.file", "logs/backend.log")
	viper.SetDefault("wechat_mini.bind_token_expire_minutes", 5)
	viper.SetDefault("wechat_h5.bind_token_expire_minutes", 5)
	viper.SetDefault("wechat_h5.oauth_scope", "snsapi_base")
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

	if err := viper.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
			return nil, err
		}
	}

	var cfg Config
	if err := viper.Unmarshal(&cfg); err != nil {
		return nil, err
	}

	// 保存到全局变量
	globalConfig = &cfg

	return &cfg, nil
}

// 全局配置
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
