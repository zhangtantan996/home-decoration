package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

func TestRateLimitBypassesInLocalEnv(t *testing.T) {
	t.Setenv("APP_ENV", "local")

	limiter := &rateLimiter{
		name: "api",
		config: RateLimitConfig{
			MaxRequests:   1,
			WindowSize:    time.Minute,
			CleanupPeriod: time.Minute,
		},
		requests: make(map[string][]time.Time),
	}

	gin.SetMode(gin.TestMode)
	router := gin.New()
	called := false
	router.Use(limiter.middleware())
	router.GET("/api/v1/user/profile", func(c *gin.Context) {
		called = true
		c.Status(http.StatusOK)
	})

	recorder := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/user/profile", nil)
	req.RemoteAddr = "127.0.0.1:12345"
	router.ServeHTTP(recorder, req)

	if !called {
		t.Fatalf("expected request to pass through limiter in local env")
	}
	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", recorder.Code)
	}
}

func TestRateLimitBlocksInProduction(t *testing.T) {
	t.Setenv("APP_ENV", "production")

	limiter := &rateLimiter{
		name: "api",
		config: RateLimitConfig{
			MaxRequests:   1,
			WindowSize:    time.Minute,
			CleanupPeriod: time.Minute,
		},
		requests: make(map[string][]time.Time),
	}

	first := limiter.allowInMemory("127.0.0.1")
	second := limiter.allowInMemory("127.0.0.1")

	if !first {
		t.Fatalf("expected first request to pass")
	}
	if second {
		t.Fatalf("expected second request to be blocked")
	}
}
