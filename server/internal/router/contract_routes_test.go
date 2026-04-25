package router

import (
	"net/http"
	"testing"

	"github.com/gin-gonic/gin"
)

func hasRoute(routes gin.RoutesInfo, method, path string) bool {
	for _, route := range routes {
		if route.Method == method && route.Path == path {
			return true
		}
	}
	return false
}

func TestContractRoutesDoNotConflict(t *testing.T) {
	gin.SetMode(gin.TestMode)

	router := setupAdminSecurityRouter(t)
	routes := router.Routes()

	if !hasRoute(routes, http.MethodGet, "/api/v1/contracts/:id") {
		t.Fatalf("expected user contract detail route to exist")
	}

	if !hasRoute(routes, http.MethodPost, "/api/v1/merchant/contracts") {
		t.Fatalf("expected merchant contract create route to exist under /api/v1/merchant/contracts")
	}

	if !hasRoute(routes, http.MethodPost, "/api/v1/merchant/contracts/:id/sign") {
		t.Fatalf("expected merchant contract sign route to exist under /api/v1/merchant/contracts/:id/sign")
	}
}
