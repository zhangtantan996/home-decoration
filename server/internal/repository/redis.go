package repository

import (
	"context"
	"home-decoration-server/internal/config"
	"log"

	"github.com/redis/go-redis/v9"
)

var RedisClient *redis.Client
var Ctx = context.Background()

// InitRedis 初始化Redis连接
func InitRedis(cfg *config.RedisConfig) error {
	RedisClient = redis.NewClient(&redis.Options{
		Addr:     cfg.Host + ":" + cfg.Port,
		Password: cfg.Password,
		DB:       cfg.DB,
	})

	// 测试连接
	if err := RedisClient.Ping(Ctx).Err(); err != nil {
		log.Printf("Redis connection failed: %v", err)
		return err
	}

	log.Println("Redis connected successfully")
	return nil
}

// GetRedis 获取Redis客户端实例
func GetRedis() *redis.Client {
	return RedisClient
}
