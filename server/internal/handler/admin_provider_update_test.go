package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
)

func requestAdminCreateProvider(t *testing.T, path string, payload string) responseEnvelope {
	t.Helper()

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, path, strings.NewReader(payload))
	ctx.Request.Header.Set("Content-Type", "application/json")
	AdminCreateProvider(ctx)

	var envelope responseEnvelope
	if err := json.Unmarshal(recorder.Body.Bytes(), &envelope); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	return envelope
}

func requestAdminUpdateProvider(t *testing.T, path string, payload string) responseEnvelope {
	t.Helper()

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPut, path, strings.NewReader(payload))
	ctx.Request.Header.Set("Content-Type", "application/json")
	ctx.Params = gin.Params{{Key: "id", Value: "92001"}}
	AdminUpdateProvider(ctx)

	var envelope responseEnvelope
	if err := json.Unmarshal(recorder.Body.Bytes(), &envelope); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	return envelope
}

func TestAdminUpdateProvider_RejectsEmptyServiceAreaAndKeepsExistingValue(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db := setupSQLiteDB(t)
	if err := db.AutoMigrate(&model.Provider{}); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}

	previousDB := repository.DB
	repository.DB = db
	t.Cleanup(func() { repository.DB = previousDB })

	provider := model.Provider{
		Base:         model.Base{ID: 92001},
		ProviderType: 1,
		DisplayName:  "后台服务商",
		CompanyName:  "后台服务商",
		ServiceArea:  `["610100"]`,
		Status:       1,
	}
	if err := db.Create(&provider).Error; err != nil {
		t.Fatalf("seed provider: %v", err)
	}

	resp := requestAdminUpdateProvider(t, "/api/v1/admin/providers/92001", `{"companyName":"后台服务商","serviceArea":[]}`)
	if resp.Code == 0 {
		t.Fatalf("expected empty service area to be rejected")
	}

	var stored model.Provider
	if err := db.First(&stored, provider.ID).Error; err != nil {
		t.Fatalf("load provider: %v", err)
	}
	if stored.ServiceArea != `["610100"]` {
		t.Fatalf("service area should remain unchanged, got %s", stored.ServiceArea)
	}
}

func TestAdminCreateProvider_PersistsAdminFormFields(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db := setupSQLiteDB(t)
	if err := db.AutoMigrate(&model.Region{}, &model.Provider{}); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}

	previousDB := repository.DB
	repository.DB = db
	t.Cleanup(func() { repository.DB = previousDB })

	regions := []model.Region{
		{Code: "610000", Name: "陕西省", Level: 1, Enabled: true},
		{Code: "610100", Name: "西安市", Level: 2, ParentCode: "610000", Enabled: true, ServiceEnabled: true},
	}
	for _, region := range regions {
		if err := db.Create(&region).Error; err != nil {
			t.Fatalf("seed region %s: %v", region.Code, err)
		}
	}

	resp := requestAdminCreateProvider(t, "/api/v1/admin/providers", `{
		"providerType":3,
		"companyName":"测试工长",
		"realName":"张工",
		"subType":"personal",
		"specialty":"水电 · 木作",
		"workTypes":"水电",
		"avatar":"/uploads/providers/foreman-avatar.jpg",
		"coverImage":"/uploads/providers/foreman-cover.jpg",
		"priceMin":400,
		"priceMax":900,
		"officeAddress":"西安市雁塔区测试路 1 号",
		"yearsExperience":12,
		"status":1,
		"serviceArea":["610100"]
	}`)
	if resp.Code != 0 {
		t.Fatalf("expected create provider success, got code=%d message=%s", resp.Code, resp.Message)
	}

	var stored model.Provider
	if err := db.Where("company_name = ?", "测试工长").First(&stored).Error; err != nil {
		t.Fatalf("load provider: %v", err)
	}
	if stored.DisplayName != "张工" {
		t.Fatalf("expected display name from realName, got %q", stored.DisplayName)
	}
	if stored.Specialty != "水电 · 木作" {
		t.Fatalf("expected specialty persisted, got %q", stored.Specialty)
	}
	if stored.YearsExperience != 12 {
		t.Fatalf("expected years experience 12, got %d", stored.YearsExperience)
	}
}

func TestAdminCreateProvider_RejectsInvalidMetrics(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db := setupSQLiteDB(t)
	if err := db.AutoMigrate(&model.Region{}, &model.Provider{}); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}

	previousDB := repository.DB
	repository.DB = db
	t.Cleanup(func() { repository.DB = previousDB })

	if err := db.Create(&model.Region{Code: "610100", Name: "西安市", Level: 2, Enabled: true, ServiceEnabled: true}).Error; err != nil {
		t.Fatalf("seed region: %v", err)
	}

	resp := requestAdminCreateProvider(t, "/api/v1/admin/providers", `{
		"providerType":1,
		"companyName":"异常服务商",
		"subType":"personal",
		"specialty":"现代简约",
		"workTypes":"设计服务",
		"avatar":"/uploads/providers/avatar.jpg",
		"coverImage":"/uploads/providers/cover.jpg",
		"priceMin":300,
		"priceMax":800,
		"officeAddress":"西安市雁塔区测试路 2 号",
		"yearsExperience":-1,
		"followersCount":-2,
		"teamSize":-3,
		"establishedYear":1800,
		"status":1,
		"serviceArea":["610100"]
	}`)
	if resp.Code == 0 {
		t.Fatalf("expected invalid metrics to be rejected")
	}

	var count int64
	if err := db.Model(&model.Provider{}).Where("company_name = ?", "异常服务商").Count(&count).Error; err != nil {
		t.Fatalf("count providers: %v", err)
	}
	if count != 0 {
		t.Fatalf("invalid provider should not be persisted")
	}
}

func TestAdminUpdateProvider_PreservesExplicitPriceUnit(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db := setupSQLiteDB(t)
	if err := db.AutoMigrate(&model.Provider{}); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}

	previousDB := repository.DB
	repository.DB = db
	t.Cleanup(func() { repository.DB = previousDB })

	provider := model.Provider{
		Base:          model.Base{ID: 92001},
		ProviderType:  3,
		DisplayName:   "测试工长",
		CompanyName:   "测试工长",
		Specialty:     "水电",
		WorkTypes:     "水电工",
		Avatar:        "/uploads/providers/old-avatar.jpg",
		CoverImage:    "/uploads/providers/old-cover.jpg",
		OfficeAddress: "西安市雁塔区测试路 5 号",
		PriceUnit:     "元/天",
		Status:        1,
		ServiceArea:   `["610100"]`,
	}
	if err := db.Create(&provider).Error; err != nil {
		t.Fatalf("seed provider: %v", err)
	}

	resp := requestAdminUpdateProvider(t, "/api/v1/admin/providers/92001", `{
		"companyName":"测试工长",
		"priceMin":400,
		"priceMax":800,
		"priceUnit":"元/天"
	}`)
	if resp.Code != 0 {
		t.Fatalf("expected update success, got code=%d message=%s", resp.Code, resp.Message)
	}

	var stored model.Provider
	if err := db.First(&stored, provider.ID).Error; err != nil {
		t.Fatalf("load provider: %v", err)
	}
	if stored.PriceUnit != "元/天" {
		t.Fatalf("expected price unit preserved as 元/天, got %q", stored.PriceUnit)
	}
}

func TestAdminUpdateProvider_RejectsProfileEditWhenDisplayFieldsIncomplete(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db := setupSQLiteDB(t)
	if err := db.AutoMigrate(&model.Provider{}); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}

	previousDB := repository.DB
	repository.DB = db
	t.Cleanup(func() { repository.DB = previousDB })

	provider := model.Provider{
		Base:         model.Base{ID: 92001},
		ProviderType: 1,
		DisplayName:  "缺资料设计师",
		CompanyName:  "缺资料设计师",
		Status:       1,
	}
	if err := db.Create(&provider).Error; err != nil {
		t.Fatalf("seed provider: %v", err)
	}

	resp := requestAdminUpdateProvider(t, "/api/v1/admin/providers/92001", `{
		"serviceIntro":"补充小程序展示介绍"
	}`)
	if resp.Code == 0 {
		t.Fatalf("expected profile edit to require complete display fields")
	}

	var stored model.Provider
	if err := db.First(&stored, provider.ID).Error; err != nil {
		t.Fatalf("load provider: %v", err)
	}
	if stored.ServiceIntro != "" {
		t.Fatalf("serviceIntro should remain unchanged, got %q", stored.ServiceIntro)
	}
}

func TestAdminUpdateProvider_RejectsProfileEditWhenServiceAreaMissing(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db := setupSQLiteDB(t)
	if err := db.AutoMigrate(&model.Provider{}); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}

	previousDB := repository.DB
	repository.DB = db
	t.Cleanup(func() { repository.DB = previousDB })

	provider := model.Provider{
		Base:          model.Base{ID: 92001},
		ProviderType:  1,
		DisplayName:   "缺城市设计师",
		CompanyName:   "缺城市设计师",
		Specialty:     "现代简约",
		WorkTypes:     "全案设计",
		Avatar:        "/uploads/providers/designer-avatar.jpg",
		CoverImage:    "/uploads/providers/designer-cover.jpg",
		OfficeAddress: "西安市雁塔区测试路 8 号",
		PriceMin:      300,
		PriceMax:      900,
		Status:        1,
	}
	if err := db.Create(&provider).Error; err != nil {
		t.Fatalf("seed provider: %v", err)
	}

	resp := requestAdminUpdateProvider(t, "/api/v1/admin/providers/92001", `{
		"serviceIntro":"补充小程序展示介绍"
	}`)
	if resp.Code == 0 {
		t.Fatalf("expected profile edit to require service area")
	}

	var stored model.Provider
	if err := db.First(&stored, provider.ID).Error; err != nil {
		t.Fatalf("load provider: %v", err)
	}
	if stored.ServiceIntro != "" {
		t.Fatalf("serviceIntro should remain unchanged, got %q", stored.ServiceIntro)
	}
}

func TestValidateProviderCoreFields_AllowsAdminPriceUnits(t *testing.T) {
	for _, unit := range []string{"元/㎡", "元/天", "元/套", "元/全包", "元/半包"} {
		if err := validateProviderCoreFields(2, 1, "company", "company", unit, 0, 100); err != nil {
			t.Fatalf("expected price unit %q to be allowed, got %v", unit, err)
		}
	}
}

func TestAdminUpdateProvider_RejectsInvalidMetricsAndKeepsExistingValue(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db := setupSQLiteDB(t)
	if err := db.AutoMigrate(&model.Provider{}); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}

	previousDB := repository.DB
	repository.DB = db
	t.Cleanup(func() { repository.DB = previousDB })

	provider := model.Provider{
		Base:            model.Base{ID: 92001},
		ProviderType:    1,
		DisplayName:     "设计师B",
		CompanyName:     "设计师B",
		YearsExperience: 8,
		FollowersCount:  20,
		RestoreRate:     4.5,
		Status:          1,
		ServiceArea:     `["610100"]`,
	}
	if err := db.Create(&provider).Error; err != nil {
		t.Fatalf("seed provider: %v", err)
	}

	resp := requestAdminUpdateProvider(t, "/api/v1/admin/providers/92001", `{
		"yearsExperience":81,
		"restoreRate":101
	}`)
	if resp.Code == 0 {
		t.Fatalf("expected invalid metrics to be rejected")
	}

	var stored model.Provider
	if err := db.First(&stored, provider.ID).Error; err != nil {
		t.Fatalf("load provider: %v", err)
	}
	if stored.YearsExperience != 8 || stored.RestoreRate != 4.5 {
		t.Fatalf("metrics should remain unchanged, got years=%d restore=%v", stored.YearsExperience, stored.RestoreRate)
	}
}

func TestAdminUpdateProvider_DoesNotResetOmittedGovernanceScores(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db := setupSQLiteDB(t)
	if err := db.AutoMigrate(&model.Provider{}); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}

	previousDB := repository.DB
	repository.DB = db
	t.Cleanup(func() { repository.DB = previousDB })

	provider := model.Provider{
		Base:          model.Base{ID: 92001},
		ProviderType:  1,
		DisplayName:   "设计师A",
		CompanyName:   "设计师A",
		Specialty:     "现代简约",
		WorkTypes:     "全案设计",
		Avatar:        "/uploads/providers/designer-a-avatar.jpg",
		CoverImage:    "/uploads/providers/designer-a-cover.jpg",
		OfficeAddress: "西安市雁塔区测试路 6 号",
		PriceMin:      300,
		PriceMax:      900,
		RestoreRate:   4.6,
		BudgetControl: 4.2,
		Status:        1,
		ServiceArea:   `["610100"]`,
	}
	if err := db.Create(&provider).Error; err != nil {
		t.Fatalf("seed provider: %v", err)
	}

	resp := requestAdminUpdateProvider(t, "/api/v1/admin/providers/92001", `{
		"companyName":"设计师A-更新",
		"status":1
	}`)
	if resp.Code != 0 {
		t.Fatalf("expected update success, got code=%d message=%s", resp.Code, resp.Message)
	}

	var stored model.Provider
	if err := db.First(&stored, provider.ID).Error; err != nil {
		t.Fatalf("load provider: %v", err)
	}
	if stored.RestoreRate != 4.6 {
		t.Fatalf("expected restore rate unchanged, got %v", stored.RestoreRate)
	}
	if stored.BudgetControl != 4.2 {
		t.Fatalf("expected budget control unchanged, got %v", stored.BudgetControl)
	}
}
