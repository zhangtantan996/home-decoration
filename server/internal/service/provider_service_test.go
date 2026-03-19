package service

import (
	"encoding/json"
	"strings"
	"testing"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"

	gormsqlite "gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupProviderServiceDB(t *testing.T) *gorm.DB {
	t.Helper()

	db, err := gorm.Open(gormsqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite db: %v", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		t.Fatalf("get sql db: %v", err)
	}
	sqlDB.SetMaxOpenConns(1)
	sqlDB.SetMaxIdleConns(1)

	if err := db.AutoMigrate(&model.User{}, &model.Provider{}, &model.ProviderCase{}, &model.Region{}); err != nil {
		t.Fatalf("auto migrate provider tables: %v", err)
	}

	previousDB := repository.DB
	repository.DB = db
	t.Cleanup(func() {
		repository.DB = previousDB
		_ = sqlDB.Close()
	})

	return db
}

func TestProviderServiceListOmitsWorkTypesAndKeepsForemanSpecialty(t *testing.T) {
	db := setupProviderServiceDB(t)
	service := &ProviderService{}

	user := model.User{Phone: "13800138066", Nickname: "工长老王", PublicID: "user_public_66"}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}

	provider := model.Provider{
		UserID:          user.ID,
		ProviderType:    3,
		SubType:         "foreman",
		CompanyName:     "老王施工队",
		Verified:        true,
		WorkTypes:       "mason,electrician",
		YearsExperience: 12,
	}
	if err := db.Create(&provider).Error; err != nil {
		t.Fatalf("create provider: %v", err)
	}

	list, total, err := service.ListProviders(&ProviderQuery{Type: "foreman", Page: 1, PageSize: 10})
	if err != nil {
		t.Fatalf("list providers: %v", err)
	}
	if total != 1 || len(list) != 1 {
		t.Fatalf("unexpected list result: total=%d len=%d", total, len(list))
	}
	if list[0].Specialty != "全工种施工" {
		t.Fatalf("unexpected specialty: %s", list[0].Specialty)
	}

	raw, err := json.Marshal(list[0])
	if err != nil {
		t.Fatalf("marshal list item: %v", err)
	}
	if strings.Contains(string(raw), "workTypes") {
		t.Fatalf("workTypes should be removed from public list payload: %s", string(raw))
	}
}

func TestProviderServiceListSupportsKeywordAcrossNicknameAndType(t *testing.T) {
	db := setupProviderServiceDB(t)
	service := &ProviderService{}

	user := model.User{Phone: "13800138111", Nickname: "思琪设计", PublicID: "user_public_search"}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}

	provider := model.Provider{
		UserID:          user.ID,
		ProviderType:    1,
		SubType:         "designer",
		CompanyName:     "拾光设计工作室",
		Verified:        true,
		Status:          1,
		YearsExperience: 6,
		Specialty:       "现代风 · 极简风",
		HighlightTags:   `["快响应","高还原"]`,
		ServiceArea:     `["雁塔区","曲江新区"]`,
	}
	if err := db.Create(&provider).Error; err != nil {
		t.Fatalf("create provider: %v", err)
	}

	list, total, err := service.ListProviders(&ProviderQuery{Keyword: "思琪", Page: 1, PageSize: 10})
	if err != nil {
		t.Fatalf("list providers by nickname keyword: %v", err)
	}
	if total != 1 || len(list) != 1 {
		t.Fatalf("expected nickname keyword match, total=%d len=%d", total, len(list))
	}

	list, total, err = service.ListProviders(&ProviderQuery{Keyword: "设计师", Page: 1, PageSize: 10})
	if err != nil {
		t.Fatalf("list providers by type keyword: %v", err)
	}
	if total != 1 || len(list) != 1 {
		t.Fatalf("expected type keyword match, total=%d len=%d", total, len(list))
	}

	list, total, err = service.ListProviders(&ProviderQuery{Keyword: "现代风", Page: 1, PageSize: 10})
	if err != nil {
		t.Fatalf("list providers by style alias keyword: %v", err)
	}
	if total != 1 || len(list) != 1 {
		t.Fatalf("expected style alias keyword match, total=%d len=%d", total, len(list))
	}
}

func TestProviderServiceListExpandsServiceAreaToCityAndDistrictNames(t *testing.T) {
	db := setupProviderServiceDB(t)
	service := &ProviderService{}

	regions := []model.Region{
		{Code: "610100", Name: "西安市", Level: 2, ParentCode: "610000", Enabled: true},
		{Code: "610113", Name: "雁塔区", Level: 3, ParentCode: "610100", Enabled: true},
		{Code: "610104", Name: "莲湖区", Level: 3, ParentCode: "610100", Enabled: true},
	}
	if err := db.Create(&regions).Error; err != nil {
		t.Fatalf("create regions: %v", err)
	}

	user := model.User{Phone: "13800138118", Nickname: "西安设计师", PublicID: "user_public_region"}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}

	provider := model.Provider{
		UserID:       user.ID,
		ProviderType: 1,
		SubType:      "designer",
		CompanyName:  "西安空间设计",
		Verified:     true,
		Status:       1,
		ServiceArea:  `["610113","610104"]`,
	}
	if err := db.Create(&provider).Error; err != nil {
		t.Fatalf("create provider: %v", err)
	}

	list, total, err := service.ListProviders(&ProviderQuery{Type: "designer", Page: 1, PageSize: 10})
	if err != nil {
		t.Fatalf("list providers: %v", err)
	}
	if total != 1 || len(list) != 1 {
		t.Fatalf("unexpected list result: total=%d len=%d", total, len(list))
	}

	areas := strings.Join(list[0].ServiceArea, ",")
	if !strings.Contains(areas, "西安市") {
		t.Fatalf("expected city name in service area, got %v", list[0].ServiceArea)
	}
	if !strings.Contains(areas, "雁塔区") || !strings.Contains(areas, "莲湖区") {
		t.Fatalf("expected district names in service area, got %v", list[0].ServiceArea)
	}
}

func TestProviderServiceListKeepsLegacyCompanySubtypeInDesignerTab(t *testing.T) {
	db := setupProviderServiceDB(t)
	service := &ProviderService{}

	user := model.User{Phone: "13800138119", Nickname: "华美装饰", PublicID: "user_public_legacy_company"}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}

	legacyCompany := model.Provider{
		UserID:       user.ID,
		ProviderType: 1,
		SubType:      "company",
		CompanyName:  "华美装饰设计公司",
		Verified:     true,
		Status:       1,
		IsSettled:    true,
	}
	if err := db.Create(&legacyCompany).Error; err != nil {
		t.Fatalf("create legacy company provider: %v", err)
	}

	companyList, total, err := service.ListProviders(&ProviderQuery{Type: "company", Page: 1, PageSize: 10})
	if err != nil {
		t.Fatalf("list company providers: %v", err)
	}
	if total != 0 || len(companyList) != 0 {
		t.Fatalf("expected legacy company subtype to stay out of company list, total=%d len=%d", total, len(companyList))
	}

	designerList, total, err := service.ListProviders(&ProviderQuery{Type: "designer", Page: 1, PageSize: 10})
	if err != nil {
		t.Fatalf("list designer providers: %v", err)
	}
	if total != 1 || len(designerList) != 1 {
		t.Fatalf("expected legacy company subtype to remain in designer list, total=%d len=%d", total, len(designerList))
	}
	if designerList[0].ProviderType != 1 {
		t.Fatalf("expected legacy provider type to remain 1 in designer list, got %d", designerList[0].ProviderType)
	}
}

func TestProviderServiceGetProviderDetail_HidesInvisibleProvider(t *testing.T) {
	db := setupProviderServiceDB(t)
	service := &ProviderService{}

	user := model.User{Phone: "13800138123", Nickname: "未公开商家", PublicID: "user_public_hidden"}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}
	provider := model.Provider{
		UserID:       user.ID,
		ProviderType: 2,
		CompanyName:  "隐藏装修公司",
		Verified:     false,
		Status:       1,
	}
	if err := db.Create(&provider).Error; err != nil {
		t.Fatalf("create provider: %v", err)
	}

	if _, err := service.GetProviderDetail(provider.ID); err == nil {
		t.Fatalf("expected hidden provider detail to be blocked")
	}
}

func TestProviderServiceGetProviderCases_OnlyReturnsVisibleCases(t *testing.T) {
	db := setupProviderServiceDB(t)
	service := &ProviderService{}

	user := model.User{Phone: "13800138124", Nickname: "可公开商家", PublicID: "user_public_visible"}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}
	provider := model.Provider{
		UserID:       user.ID,
		ProviderType: 1,
		CompanyName:  "可公开设计师",
		Verified:     true,
		Status:       1,
	}
	if err := db.Create(&provider).Error; err != nil {
		t.Fatalf("create provider: %v", err)
	}
	if err := db.Create(&model.ProviderCase{ProviderID: provider.ID, Title: "公开案例", ShowInInspiration: true}).Error; err != nil {
		t.Fatalf("create public case: %v", err)
	}
	if err := db.Create(&model.ProviderCase{ProviderID: provider.ID, Title: "隐藏案例", ShowInInspiration: false}).Error; err != nil {
		t.Fatalf("create hidden case: %v", err)
	}

	detail, err := service.GetProviderDetail(provider.ID)
	if err != nil {
		t.Fatalf("get provider detail: %v", err)
	}
	if detail.CaseCount != 1 || len(detail.Cases) != 1 || detail.Cases[0].Title != "公开案例" {
		t.Fatalf("expected only visible cases in detail, got count=%d cases=%+v", detail.CaseCount, detail.Cases)
	}

	cases, total, err := service.GetProviderCases(provider.ID, 1, 10)
	if err != nil {
		t.Fatalf("get provider cases: %v", err)
	}
	if total != 1 || len(cases) != 1 || cases[0].Title != "公开案例" {
		t.Fatalf("expected only visible cases in public list, total=%d cases=%+v", total, cases)
	}
}
