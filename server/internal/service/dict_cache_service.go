package service

import (
	"context"
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
	ctx context.Context
}

// NewDictCacheService 创建字典缓存服务实例
func NewDictCacheService() *DictCacheService {
	return &DictCacheService{
		rdb: repository.GetRedis(),
		ctx: repository.Ctx,
	}
}

// GetDictCache 获取字典缓存
func (s *DictCacheService) GetDictCache(categoryCode string) ([]model.DictDTO, error) {
	if s.rdb == nil {
		return nil, redis.Nil // Redis 不可用
	}

	key := DictCacheKeyPrefix + categoryCode
	val, err := s.rdb.Get(s.ctx, key).Result()
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

	key := DictCacheKeyPrefix + categoryCode
	jsonData, err := json.Marshal(data)
	if err != nil {
		return err
	}

	return s.rdb.Set(s.ctx, key, jsonData, time.Duration(DictCacheTTL)*time.Second).Err()
}

// DeleteDictCache 删除字典缓存
func (s *DictCacheService) DeleteDictCache(categoryCode string) error {
	if s.rdb == nil {
		return nil // Redis 不可用，不影响业务
	}

	key := DictCacheKeyPrefix + categoryCode
	return s.rdb.Del(s.ctx, key).Err()
}

// DeleteAllDictCache 删除所有字典缓存
func (s *DictCacheService) DeleteAllDictCache() error {
	if s.rdb == nil {
		return nil
	}

	pattern := DictCacheKeyPrefix + "*"
	iter := s.rdb.Scan(s.ctx, 0, pattern, 0).Iterator()
	var keys []string

	for iter.Next(s.ctx) {
		keys = append(keys, iter.Val())
	}

	if err := iter.Err(); err != nil {
		return err
	}

	if len(keys) > 0 {
		return s.rdb.Del(s.ctx, keys...).Err()
	}

	return nil
}
