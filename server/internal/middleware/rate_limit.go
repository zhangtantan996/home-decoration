package middleware

import (
	"home-decoration-server/pkg/response"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// RateLimitConfig 限流配置
type RateLimitConfig struct {
	MaxRequests   int           // 时间窗口内最大请求数
	WindowSize    time.Duration // 时间窗口大小
	CleanupPeriod time.Duration // 清理过期记录的周期
}

// rateLimiter 限流器实例
type rateLimiter struct {
	config   RateLimitConfig
	requests map[string][]time.Time
	mu       sync.RWMutex
}

var defaultLimiter *rateLimiter
var once sync.Once

// initDefaultLimiter 初始化默认限流器
func initDefaultLimiter() {
	defaultLimiter = &rateLimiter{
		config: RateLimitConfig{
			MaxRequests:   100, // 每分钟100次
			WindowSize:    time.Minute,
			CleanupPeriod: 5 * time.Minute,
		},
		requests: make(map[string][]time.Time),
	}
	go defaultLimiter.cleanup()
}

// RateLimit API限流中间件
// 基于滑动窗口算法，按IP限流
func RateLimit() gin.HandlerFunc {
	once.Do(initDefaultLimiter)
	return defaultLimiter.middleware()
}

// RateLimitWithConfig 使用自定义配置的限流中间件
func RateLimitWithConfig(config RateLimitConfig) gin.HandlerFunc {
	limiter := &rateLimiter{
		config:   config,
		requests: make(map[string][]time.Time),
	}
	go limiter.cleanup()
	return limiter.middleware()
}

// middleware 返回gin中间件
func (rl *rateLimiter) middleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 获取客户端标识（IP）
		clientIP := c.ClientIP()

		if !rl.allow(clientIP) {
			response.Error(c, 429, "请求过于频繁，请稍后再试")
			c.Abort()
			return
		}

		c.Next()
	}
}

// allow 检查是否允许请求
func (rl *rateLimiter) allow(clientID string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	windowStart := now.Add(-rl.config.WindowSize)

	// 获取该客户端的请求记录
	requests, exists := rl.requests[clientID]
	if !exists {
		rl.requests[clientID] = []time.Time{now}
		return true
	}

	// 过滤掉窗口外的请求
	var validRequests []time.Time
	for _, t := range requests {
		if t.After(windowStart) {
			validRequests = append(validRequests, t)
		}
	}

	// 检查是否超过限制
	if len(validRequests) >= rl.config.MaxRequests {
		rl.requests[clientID] = validRequests
		return false
	}

	// 添加当前请求
	validRequests = append(validRequests, now)
	rl.requests[clientID] = validRequests
	return true
}

// cleanup 定期清理过期记录
func (rl *rateLimiter) cleanup() {
	ticker := time.NewTicker(rl.config.CleanupPeriod)
	for range ticker.C {
		rl.mu.Lock()
		now := time.Now()
		windowStart := now.Add(-rl.config.WindowSize)

		for clientID, requests := range rl.requests {
			var validRequests []time.Time
			for _, t := range requests {
				if t.After(windowStart) {
					validRequests = append(validRequests, t)
				}
			}
			if len(validRequests) == 0 {
				delete(rl.requests, clientID)
			} else {
				rl.requests[clientID] = validRequests
			}
		}
		rl.mu.Unlock()
	}
}

// SensitiveRateLimit 敏感操作限流（更严格）
// 用于提现、银行账户等敏感操作
func SensitiveRateLimit() gin.HandlerFunc {
	return RateLimitWithConfig(RateLimitConfig{
		MaxRequests:   10, // 每分钟10次
		WindowSize:    time.Minute,
		CleanupPeriod: 5 * time.Minute,
	})
}

// LoginRateLimit 登录限流
// 防止暴力破解
func LoginRateLimit() gin.HandlerFunc {
	return RateLimitWithConfig(RateLimitConfig{
		MaxRequests:   5, // 每分钟5次
		WindowSize:    time.Minute,
		CleanupPeriod: 5 * time.Minute,
	})
}
