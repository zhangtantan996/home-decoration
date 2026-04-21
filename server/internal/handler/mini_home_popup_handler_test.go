package handler

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	"home-decoration-server/internal/service"

	"github.com/gin-gonic/gin"
)

func TestGetMiniHomePopupReturnsPopupEnvelope(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db := setupSQLiteDB(t)
	if err := db.AutoMigrate(&model.SystemConfig{}); err != nil {
		t.Fatalf("auto migrate system config: %v", err)
	}

	previousDB := repository.DB
	repository.DB = db
	t.Cleanup(func() { repository.DB = previousDB })

	svc := &service.ConfigService{}
	if err := svc.SetConfig(model.ConfigKeyMiniHomePopup, `{
		"enabled": true,
		"theme": "sunrise",
		"kicker": "免费预估",
		"title": "30 秒生成装修报价",
		"subtitle": "填写几项信息，快速拿到装修预算参考。",
		"primaryAction": {"text": "立即生成", "path": "/pages/quote-inquiry/create/index"},
		"secondaryAction": {"enabled": true, "text": "先看看服务商", "path": "/pages/providers/list/index?type=designer"},
		"frequency": "daily_once"
	}`, "首页运营弹窗"); err != nil {
		t.Fatalf("seed popup config: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/public/mini/home-popup", nil)
	w := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(w)
	ctx.Request = req

	GetMiniHomePopup(ctx)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), `"popup"`) {
		t.Fatalf("expected popup envelope, got %s", w.Body.String())
	}
	if !strings.Contains(w.Body.String(), `"title":"30 秒生成装修报价"`) {
		t.Fatalf("expected popup title in response, got %s", w.Body.String())
	}
}
