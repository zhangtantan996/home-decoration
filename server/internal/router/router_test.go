package router

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"home-decoration-server/internal/middleware"

	"github.com/gin-gonic/gin"
)

func containsOrigin(origins []string, target string) bool {
	for _, origin := range origins {
		if origin == target {
			return true
		}
	}
	return false
}

func TestBuildAllowedOriginsKeepsLocalDevPortsOutsideRelease(t *testing.T) {
	origins := buildAllowedOrigins("debug", "http://localhost:5173,http://localhost:3000")

	for _, expected := range []string{
		"http://localhost:5173",
		"http://localhost:5175",
		"http://localhost:5176",
		"http://127.0.0.1:5175",
		"http://127.0.0.1:5176",
		"http://localhost:3000",
	} {
		if !containsOrigin(origins, expected) {
			t.Fatalf("expected dev origin %s to be allowed, got %v", expected, origins)
		}
	}
}

func TestBuildAllowedOriginsUsesExplicitEnvInRelease(t *testing.T) {
	origins := buildAllowedOrigins("release", "https://prod.example.com")

	if len(origins) != 1 || origins[0] != "https://prod.example.com" {
		t.Fatalf("expected release origins to use env only, got %v", origins)
	}
}

func TestDebugCorsAllowsLocalProxyPorts(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(middleware.Cors(buildAllowedOrigins("debug", "http://localhost:5173,http://localhost:3000")))
	r.POST("/probe", func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodPost, "/probe", nil)
	req.Header.Set("Origin", "http://localhost:5175")
	rec := httptest.NewRecorder()

	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 5175 to pass cors in debug mode, got status=%d", rec.Code)
	}
}
