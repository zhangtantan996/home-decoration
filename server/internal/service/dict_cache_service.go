package service

import (
	"encoding/json"
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	"time"

	"github.com/redis/go-redis/v9"
)

const (
	// 缓存Key前缀
	DictCacheKeyPrefix = "dict:"

	// 缓存TTL
	DictCacheTTL = 3600 // 1小时（秒）
)

// DictCacheService 字典缓存服务
type DictCacheService struct {
	rdb *redis.Client
}

// NewDictCacheService 创建字典缓存服务实例
func NewDictCacheService() *DictCacheService {
	return &DictCacheService{
		rdb: repository.GetRedis(),
	}
}

// GetDictCache 获取字典缓存
func (s *DictCacheService) GetDictCache(categoryCode string) ([]model.DictDTO, error) {
	if s.rdb == nil {
		return nil, redis.Nil // Redis 不可用
	}

	ctx, cancel := repository.RedisContext()
	defer cancel()

	key := DictCacheKeyPrefix + categoryCode
	val, err := s.rdb.Get(ctx, key).Result()
	if err == redis.Nil {
		return nil, nil // 缓存不存在
	}
	if err != nil {
		return nil, err
	}

	var result []model.DictDTO
	if err := json.Unmarshal([]byte(val), &result); err != nil {
		return nil, err
	}

	return result, nil
}

// SetDictCache 设置字典缓存
func (s *DictCacheService) SetDictCache(categoryCode string, data []model.DictDTO) error {
	if s.rdb == nil {
		return nil // Redis 不可用，不影响业务
	}

	ctx, cancel := repository.RedisContext()
	defer cancel()

	key := DictCacheKeyPrefix + categoryCode
	jsonData, err := json.Marshal(data)
	if err != nil {
		return err
	}

	return s.rdb.Set(ctx, key, jsonData, time.Duration(DictCacheTTL)*time.Second).Err()
}

// DeleteDictCache 删除字典缓存
func (s *DictCacheService) DeleteDictCache(categoryCode string) error {
	if s.rdb == nil {
		return nil // Redis 不可用，不影响业务
	}

	ctx, cancel := repository.RedisContext()
	defer cancel()

	key := DictCacheKeyPrefix + categoryCode
	return s.rdb.Del(ctx, key).Err()
}

// DeleteAllDictCache 删除所有字典缓存
func (s *DictCacheService) DeleteAllDictCache() error {
	if s.rdb == nil {
		return nil
	}

	ctx, cancel := repository.RedisContext()
	defer cancel()

	pattern := DictCacheKeyPrefix + "*"
	iter := s.rdb.Scan(ctx, 0, pattern, 0).Iterator()
	var keys []string

	for iter.Next(ctx) {
		keys = append(keys, iter.Val())
	}

	if err := iter.Err(); err != nil {
		return err
	}

	if len(keys) > 0 {
		return s.rdb.Del(ctx, keys...).Err()
	}

	return nil
}
