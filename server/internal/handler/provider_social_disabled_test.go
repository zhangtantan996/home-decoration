package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func requestProviderSocialDisabled(t *testing.T, method, path string, handlerFunc gin.HandlerFunc) responseEnvelope {
	t.Helper()

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(method, path, nil)
	c.Params = []gin.Param{{Key: "id", Value: "100"}}
	c.Set("userId", uint64(200))

	handlerFunc(c)
	return decodeResponse(t, w)
}

func TestProviderSocialEndpointsDisabled(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name        string
		method      string
		path        string
		handlerFunc gin.HandlerFunc
	}{
		{name: "follow", method: http.MethodPost, path: "/api/v1/providers/100/follow?type=designer", handlerFunc: FollowProvider},
		{name: "unfollow", method: http.MethodDelete, path: "/api/v1/providers/100/follow?type=designer", handlerFunc: UnfollowProvider},
		{name: "favorite", method: http.MethodPost, path: "/api/v1/providers/100/favorite?type=provider", handlerFunc: FavoriteProvider},
		{name: "unfavorite", method: http.MethodDelete, path: "/api/v1/providers/100/favorite?type=provider", handlerFunc: UnfavoriteProvider},
		{name: "user-status", method: http.MethodGet, path: "/api/v1/providers/100/user-status", handlerFunc: GetProviderUserStatus},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			resp := requestProviderSocialDisabled(t, tt.method, tt.path, tt.handlerFunc)
			if resp.Code != 403 {
				t.Fatalf("unexpected code: got=%d want=403 body=%s", resp.Code, string(resp.Data))
			}
			if resp.Message != "服务商关注/收藏功能暂未上线" {
				t.Fatalf("unexpected message: %s", resp.Message)
			}
		})
	}
}
