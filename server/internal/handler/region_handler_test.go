package handler

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"

	"github.com/gin-gonic/gin"
)

func setupRegionHandlerTestDB(t *testing.T) {
	t.Helper()

	db := setupRawSQLiteDB(t)
	if err := db.AutoMigrate(
		&model.Region{},
		&model.DictionaryCategory{},
		&model.SystemDictionary{},
		&model.AuditLog{},
	); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}

	seed := []interface{}{
		&model.Region{Code: "610000", Name: "陕西省", Level: 1, Enabled: true, SortOrder: 1},
		&model.Region{Code: "610100", Name: "西安市", Level: 2, ParentCode: "610000", Enabled: true, ServiceEnabled: false, SortOrder: 1},
		&model.Region{Code: "610200", Name: "铜川市", Level: 2, ParentCode: "610000", Enabled: true, ServiceEnabled: true, SortOrder: 2},
		&model.Region{Code: "610113", Name: "雁塔区", Level: 3, ParentCode: "610100", Enabled: true, SortOrder: 1},
	}
	for _, item := range seed {
		if err := db.Create(item).Error; err != nil {
			t.Fatalf("seed data: %v", err)
		}
	}

	prevDB := repository.DB
	repository.DB = db
	t.Cleanup(func() { repository.DB = prevDB })
}

func TestAdminToggleRegionService_City(t *testing.T) {
	gin.SetMode(gin.TestMode)
	setupRegionHandlerTestDB(t)

	req := httptest.NewRequest(http.MethodPut, "/api/v1/admin/regions/2/service-toggle", strings.NewReader(`{"serviceEnabled":true}`))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = req
	c.Params = gin.Params{{Key: "id", Value: "2"}}
	c.Set("admin_id", uint64(11))
	c.Set("admin_reason", "测试开启城市服务")

	AdminToggleRegionService(c)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", w.Code, w.Body.String())
	}

	var city model.Region
	if err := repository.DB.Where("code = ?", "610100").First(&city).Error; err != nil {
		t.Fatalf("query city: %v", err)
	}
	if !city.ServiceEnabled {
		t.Fatalf("expected city service enabled true")
	}

	var audit model.AuditLog
	if err := repository.DB.Where("operation_type = ?", "toggle_region_service").First(&audit).Error; err != nil {
		t.Fatalf("expected audit log: %v", err)
	}
	if audit.Reason != "测试开启城市服务" {
		t.Fatalf("unexpected audit reason: %s", audit.Reason)
	}
}

func TestAdminToggleRegionService_ProvinceBatch(t *testing.T) {
	gin.SetMode(gin.TestMode)
	setupRegionHandlerTestDB(t)

	req := httptest.NewRequest(http.MethodPut, "/api/v1/admin/regions/1/service-toggle", strings.NewReader(`{"serviceEnabled":false}`))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = req
	c.Params = gin.Params{{Key: "id", Value: "1"}}
	c.Set("admin_id", uint64(11))
	c.Set("admin_reason", "测试省级批量关闭")

	AdminToggleRegionService(c)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", w.Code, w.Body.String())
	}

	var cities []model.Region
	if err := repository.DB.Where("level = ? AND parent_code = ?", 2, "610000").Find(&cities).Error; err != nil {
		t.Fatalf("query cities: %v", err)
	}
	for _, city := range cities {
		if city.ServiceEnabled {
			t.Fatalf("expected province batch close to disable all city service flags, city=%s", city.Code)
		}
	}
}

func TestAdminToggleRegionService_RejectDistrict(t *testing.T) {
	gin.SetMode(gin.TestMode)
	setupRegionHandlerTestDB(t)

	req := httptest.NewRequest(http.MethodPut, "/api/v1/admin/regions/4/service-toggle", strings.NewReader(`{"serviceEnabled":true}`))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = req
	c.Params = gin.Params{{Key: "id", Value: "4"}}
	c.Set("admin_id", uint64(11))
	c.Set("admin_reason", "测试区县拒绝")

	AdminToggleRegionService(c)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d body=%s", w.Code, w.Body.String())
	}
}

func TestAdminToggleRegionService_RequireServiceEnabled(t *testing.T) {
	gin.SetMode(gin.TestMode)
	setupRegionHandlerTestDB(t)

	req := httptest.NewRequest(http.MethodPut, "/api/v1/admin/regions/2/service-toggle", strings.NewReader(`{"reason":"缺字段校验"}`))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = req
	c.Params = gin.Params{{Key: "id", Value: "2"}}
	c.Set("admin_id", uint64(11))
	c.Set("admin_reason", "缺字段校验")

	AdminToggleRegionService(c)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d body=%s", w.Code, w.Body.String())
	}
}
