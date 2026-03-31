package service

import (
	"encoding/json"
	"strings"
	"testing"
	"time"

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

	if err := db.AutoMigrate(&model.User{}, &model.Provider{}, &model.ProviderCase{}, &model.ProviderReview{}, &model.Project{}, &model.Region{}, &model.CaseAudit{}); err != nil {
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
	if strings.TrimSpace(list[0].HighlightTags) == "" {
		t.Fatalf("expected highlight tags in list payload")
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

func TestProviderServiceListFallsBackToSpecialtyWhenHighlightTagsMissing(t *testing.T) {
	db := setupProviderServiceDB(t)
	service := &ProviderService{}

	user := model.User{Phone: "13800138112", Nickname: "李工", PublicID: "user_public_tags_fallback"}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}

	provider := model.Provider{
		UserID:          user.ID,
		ProviderType:    3,
		SubType:         "foreman",
		CompanyName:     "李工施工队",
		Verified:        true,
		Status:          1,
		YearsExperience: 9,
		Specialty:       "旧房改造 · 水电规范",
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
	if list[0].HighlightTags != "旧房改造 · 水电规范" {
		t.Fatalf("expected specialty fallback in highlight tags, got %q", list[0].HighlightTags)
	}
}

func TestProviderServiceListRollsServiceAreaUpToCityNames(t *testing.T) {
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
	if areas != "西安市" {
		t.Fatalf("expected city-only service area, got %v", list[0].ServiceArea)
	}
}

func TestProviderServiceGetProviderDetailRollsServiceAreaUpToCityNames(t *testing.T) {
	db := setupProviderServiceDB(t)
	service := &ProviderService{}

	regions := []model.Region{
		{Code: "610000", Name: "陕西省", Level: 1, Enabled: true},
		{Code: "610100", Name: "西安市", Level: 2, ParentCode: "610000", Enabled: true},
		{Code: "610113", Name: "雁塔区", Level: 3, ParentCode: "610100", Enabled: true},
		{Code: "610104", Name: "莲湖区", Level: 3, ParentCode: "610100", Enabled: true},
	}
	if err := db.Create(&regions).Error; err != nil {
		t.Fatalf("create regions: %v", err)
	}

	user := model.User{Phone: "13800138119", Nickname: "详情设计师", PublicID: "user_public_detail_region"}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}

	provider := model.Provider{
		UserID:       user.ID,
		ProviderType: 1,
		SubType:      "designer",
		CompanyName:  "城市级设计工作室",
		Verified:     true,
		Status:       1,
		ServiceArea:  `["610113","610104"]`,
	}
	if err := db.Create(&provider).Error; err != nil {
		t.Fatalf("create provider: %v", err)
	}

	detail, err := service.GetProviderDetail(provider.ID)
	if err != nil {
		t.Fatalf("get provider detail: %v", err)
	}
	if len(detail.ServiceAreaCodes) != 1 || detail.ServiceAreaCodes[0] != "610100" {
		t.Fatalf("expected rolled city code in detail, got %v", detail.ServiceAreaCodes)
	}
	if len(detail.ServiceArea) != 1 || detail.ServiceArea[0] != "西安市" {
		t.Fatalf("expected city-only service area in detail, got %v", detail.ServiceArea)
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

func TestProviderServiceListSupportsCityRatingAndBudgetFilters(t *testing.T) {
	db := setupProviderServiceDB(t)
	service := &ProviderService{}

	regions := []model.Region{
		{Code: "610100", Name: "西安市", Level: 2, ParentCode: "610000", Enabled: true},
		{Code: "610113", Name: "雁塔区", Level: 3, ParentCode: "610100", Enabled: true},
		{Code: "510100", Name: "成都市", Level: 2, ParentCode: "510000", Enabled: true},
	}
	if err := db.Create(&regions).Error; err != nil {
		t.Fatalf("create regions: %v", err)
	}

	createProvider := func(phone, nickname, companyName, serviceArea string, rating float32, priceMin, priceMax float64) {
		user := model.User{Phone: phone, Nickname: nickname, PublicID: phone}
		if err := db.Create(&user).Error; err != nil {
			t.Fatalf("create user: %v", err)
		}
		provider := model.Provider{
			UserID:       user.ID,
			ProviderType: 1,
			SubType:      "designer",
			CompanyName:  companyName,
			Verified:     true,
			Status:       1,
			ServiceArea:  serviceArea,
			Rating:       rating,
			PriceMin:     priceMin,
			PriceMax:     priceMax,
		}
		if err := db.Create(&provider).Error; err != nil {
			t.Fatalf("create provider: %v", err)
		}
	}

	createProvider("13800138130", "西安高分设计", "西安高分设计工作室", `["610113"]`, 4.9, 400, 600)
	createProvider("13800138131", "西安低分设计", "西安低分设计工作室", `["610113"]`, 4.3, 400, 600)
	createProvider("13800138132", "成都设计", "成都设计工作室", `["510100"]`, 4.9, 400, 600)

	list, total, err := service.ListProviders(&ProviderQuery{
		Type:      "designer",
		City:      "西安",
		RatingMin: 4.5,
		BudgetMin: 300,
		BudgetMax: 800,
		Page:      1,
		PageSize:  10,
	})
	if err != nil {
		t.Fatalf("list providers with filters: %v", err)
	}
	if total != 1 || len(list) != 1 {
		t.Fatalf("expected exactly one filtered provider, total=%d len=%d", total, len(list))
	}
	if list[0].CompanyName != "西安高分设计工作室" {
		t.Fatalf("unexpected provider after filters: %+v", list[0])
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

func TestProviderServiceSeparatesCraftCasesAndProjectScenes(t *testing.T) {
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
	craftCase := model.ProviderCase{ProviderID: provider.ID, Title: "公开工艺", ShowInInspiration: true}
	if err := db.Create(&craftCase).Error; err != nil {
		t.Fatalf("create craft case: %v", err)
	}
	sceneCase := model.ProviderCase{ProviderID: provider.ID, Title: "归档项目案例", ShowInInspiration: true}
	if err := db.Create(&sceneCase).Error; err != nil {
		t.Fatalf("create scene case: %v", err)
	}
	if err := db.Create(&model.CaseAudit{
		CaseID:          &sceneCase.ID,
		ProviderID:      provider.ID,
		ActionType:      "create",
		SourceType:      "project_completion",
		SourceProjectID: 2026,
		Status:          1,
		Title:           "归档项目案例",
		CoverImage:      "/uploads/cases/scene-cover.jpg",
		Description:     "来自真实完工项目",
		Images:          `["/uploads/cases/scene-cover.jpg","/uploads/cases/scene-2.jpg"]`,
		Year:            "2026",
	}).Error; err != nil {
		t.Fatalf("create scene audit: %v", err)
	}

	detail, err := service.GetProviderDetail(provider.ID)
	if err != nil {
		t.Fatalf("get provider detail: %v", err)
	}
	if detail.CaseCount != 1 || len(detail.Cases) != 1 || detail.Cases[0].ID != craftCase.ID {
		t.Fatalf("expected craft-only cases in detail, got count=%d cases=%+v", detail.CaseCount, detail.Cases)
	}
	if detail.SceneCount != 1 || len(detail.SceneCases) != 1 || detail.SceneCases[0].CaseID != sceneCase.ID {
		t.Fatalf("expected scene cases in detail, got sceneCount=%d sceneCases=%+v", detail.SceneCount, detail.SceneCases)
	}

	cases, total, err := service.GetProviderCases(provider.ID, 1, 10)
	if err != nil {
		t.Fatalf("get provider cases: %v", err)
	}
	if total != 1 || len(cases) != 1 || cases[0].ID != craftCase.ID {
		t.Fatalf("expected only craft cases in public list, total=%d cases=%+v", total, cases)
	}

	sceneCases, sceneTotal, err := service.GetProviderSceneCases(provider.ID, 1, 10)
	if err != nil {
		t.Fatalf("get provider scene cases: %v", err)
	}
	if sceneTotal != 1 || len(sceneCases) != 1 || sceneCases[0].ID == 0 {
		t.Fatalf("expected project scenes in public list, total=%d sceneCases=%+v", sceneTotal, sceneCases)
	}
}

func TestProviderSceneDetailUsesLatestApprovedAuditSnapshot(t *testing.T) {
	db := setupProviderServiceDB(t)
	service := &ProviderService{}

	user := model.User{Phone: "13800138128", Nickname: "工长案例详情", PublicID: "user_public_scene_detail"}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}
	provider := model.Provider{
		UserID:       user.ID,
		ProviderType: 3,
		CompanyName:  "工长案例详情",
		Verified:     true,
		Status:       1,
	}
	if err := db.Create(&provider).Error; err != nil {
		t.Fatalf("create provider: %v", err)
	}

	sceneCase := model.ProviderCase{ProviderID: provider.ID, Title: "初始案例", ShowInInspiration: true}
	if err := db.Create(&sceneCase).Error; err != nil {
		t.Fatalf("create scene case: %v", err)
	}

	createAudit := model.CaseAudit{
		CaseID:          &sceneCase.ID,
		ProviderID:      provider.ID,
		ActionType:      "create",
		SourceType:      "project_completion",
		SourceProjectID: 9001,
		Status:          1,
		Title:           "初始案例",
		CoverImage:      "/uploads/cases/initial.jpg",
		Description:     "初始说明",
		Images:          `["/uploads/cases/initial.jpg"]`,
		Year:            "2025",
	}
	if err := db.Create(&createAudit).Error; err != nil {
		t.Fatalf("create audit: %v", err)
	}
	if err := db.Create(&model.CaseAudit{
		CaseID:      &sceneCase.ID,
		ProviderID:  provider.ID,
		ActionType:  "update",
		Status:      1,
		Title:       "更新后的项目案例",
		CoverImage:  "/uploads/cases/latest.jpg",
		Description: "最新说明",
		Images:      `["/uploads/cases/latest.jpg","/uploads/cases/latest-2.jpg"]`,
		Year:        "2026",
	}).Error; err != nil {
		t.Fatalf("create latest audit: %v", err)
	}

	detail, err := service.GetProviderSceneDetail(createAudit.ID)
	if err != nil {
		t.Fatalf("get provider scene detail: %v", err)
	}
	if detail.Title != "更新后的项目案例" || !strings.Contains(detail.Images, "latest-2.jpg") {
		t.Fatalf("expected latest approved audit snapshot, got %+v", detail)
	}
}

func TestProviderServiceExposesUnifiedPriceUnit(t *testing.T) {
	db := setupProviderServiceDB(t)
	service := &ProviderService{}

	user := model.User{Phone: "13800138125", Nickname: "统一报价服务商", PublicID: "user_public_price_unit"}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}

	provider := model.Provider{
		UserID:       user.ID,
		ProviderType: 1,
		CompanyName:  "统一报价设计师",
		Verified:     true,
		Status:       1,
		PriceMin:     300,
		PriceMax:     500,
		PriceUnit:    "元/天",
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
	if list[0].PriceUnit != model.ProviderPriceUnitPerSquareMeter {
		t.Fatalf("unexpected list price unit: %s", list[0].PriceUnit)
	}

	detail, err := service.GetProviderDetail(provider.ID)
	if err != nil {
		t.Fatalf("get provider detail: %v", err)
	}
	if detail.Provider == nil || detail.Provider.PriceUnit != model.ProviderPriceUnitPerSquareMeter {
		t.Fatalf("unexpected detail price unit: %+v", detail.Provider)
	}
}

func TestProviderServiceOfficialReviewReadsAndStats(t *testing.T) {
	db := setupProviderServiceDB(t)
	service := &ProviderService{}

	owner := model.User{Phone: "13800138126", Nickname: "正式评价业主", PublicID: "user_public_official_review_owner"}
	providerUser := model.User{Phone: "13800138127", Nickname: "正式评价设计师", PublicID: "user_public_official_review_provider"}
	if err := db.Create(&owner).Error; err != nil {
		t.Fatalf("create owner: %v", err)
	}
	if err := db.Create(&providerUser).Error; err != nil {
		t.Fatalf("create provider user: %v", err)
	}

	provider := model.Provider{
		UserID:       providerUser.ID,
		ProviderType: 1,
		CompanyName:  "正式评价设计工作室",
		Verified:     true,
		Status:       1,
	}
	if err := db.Create(&provider).Error; err != nil {
		t.Fatalf("create provider: %v", err)
	}

	project := model.Project{
		OwnerID:                owner.ID,
		ProviderID:             provider.ID,
		Name:                   "正式评价项目",
		Status:                 model.ProjectStatusCompleted,
		BusinessStatus:         model.ProjectBusinessStatusCompleted,
		CurrentPhase:           "已归档",
		InspirationCaseDraftID: 1,
		CompletionSubmittedAt:  ptrTime(time.Now()),
		ConstructionProviderID: 0,
	}
	if err := db.Create(&project).Error; err != nil {
		t.Fatalf("create project: %v", err)
	}

	review := model.ProviderReview{
		ProviderID:   provider.ID,
		UserID:       owner.ID,
		ProjectID:    project.ID,
		Rating:       5,
		Content:      "正式评价读链测试",
		Images:       `["/uploads/review-1.jpg"]`,
		ServiceType:  "完工验收",
		Area:         "88㎡",
		Tags:         `["沟通顺畅"]`,
		HelpfulCount: 0,
	}
	if err := db.Create(&review).Error; err != nil {
		t.Fatalf("create review: %v", err)
	}

	reviews, total, err := service.GetProviderReviews(provider.ID, 1, 10, "all")
	if err != nil {
		t.Fatalf("get provider reviews: %v", err)
	}
	if total != 1 || len(reviews) != 1 {
		t.Fatalf("expected one official review, total=%d len=%d", total, len(reviews))
	}

	stats, err := service.GetReviewStats(provider.ID)
	if err != nil {
		t.Fatalf("get review stats: %v", err)
	}
	if stats.Total != 1 || stats.TotalCount != 1 {
		t.Fatalf("unexpected review stats total: %+v", stats)
	}
	if stats.WithImage != 1 || stats.GoodCount != 1 || stats.StarDistribution[5] != 1 {
		t.Fatalf("unexpected review stats buckets: %+v", stats)
	}
	if stats.SampleState != providerReviewSampleStateSmall {
		t.Fatalf("unexpected sample state: %+v", stats)
	}
}

func ptrTime(value time.Time) *time.Time {
	return &value
}
