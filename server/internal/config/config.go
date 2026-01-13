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
}

type ServerConfig struct {
	Host      string `mapstructure:"host"`
	Port      string `mapstructure:"port"`
	Mode      string `mapstructure:"mode"` // debug, release
	PublicURL string `mapstructure:"public_url"`
}

type DatabaseConfig struct {
	Host     string `mapstructure:"host"`
	Port     string `mapstructure:"port"`
	User     string `mapstructure:"user"`
	Password string `mapstructure:"password"`
	DBName   string `mapstructure:"dbname"`
	SSLMode  string `mapstructure:"sslmode"`
}

type RedisConfig struct {
	Host     string `mapstructure:"host"`
	Port     string `mapstructure:"port"`
	Password string `mapstructure:"password"`
	DB       int    `mapstructure:"db"`
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

	// 设置默认值
	viper.SetDefault("server.host", "0.0.0.0")
	viper.SetDefault("server.port", "8080")
	viper.SetDefault("server.mode", "debug")
	viper.SetDefault("server.public_url", "http://localhost:8080")
	viper.SetDefault("database.host", "localhost")
	viper.SetDefault("database.port", "5432")
	viper.SetDefault("database.sslmode", "disable")
	viper.SetDefault("redis.host", "localhost")
	viper.SetDefault("redis.port", "6379")
	viper.SetDefault("redis.db", 0)
	viper.SetDefault("jwt.expire_hour", 72)
	viper.SetDefault("log.level", "info")
	viper.SetDefault("log.file", "logs/backend.log")
	viper.SetDefault("wechat_mini.bind_token_expire_minutes", 5)

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
