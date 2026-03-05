package repository

import (
	"context"
	"home-decoration-server/internal/config"
	"log"
	"time"

	"github.com/redis/go-redis/v9"
)

var RedisClient *redis.Client
var Ctx = context.Background()
var redisOperationTimeout = 3 * time.Second

// InitRedis 初始化Redis连接
func InitRedis(cfg *config.RedisConfig) error {
	if cfg != nil && cfg.OperationTimeoutMs > 0 {
		redisOperationTimeout = time.Duration(cfg.OperationTimeoutMs) * time.Millisecond
	}

	RedisClient = redis.NewClient(&redis.Options{
		Addr:     cfg.Host + ":" + cfg.Port,
		Password: cfg.Password,
		DB:       cfg.DB,
	})

	// 测试连接
	ctx, cancel := RedisContext()
	defer cancel()

	if err := RedisClient.Ping(ctx).Err(); err != nil {
		log.Printf("Redis connection failed: %v", err)
		return err
	}

	log.Println("Redis connected successfully")
	return nil
}

func RedisContext() (context.Context, context.CancelFunc) {
	timeout := redisOperationTimeout
	if timeout <= 0 {
		timeout = 3 * time.Second
	}
	return context.WithTimeout(context.Background(), timeout)
}

// GetRedis 获取Redis客户端实例
func GetRedis() *redis.Client {
	return RedisClient
}
