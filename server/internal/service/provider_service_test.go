package service

import (
	"encoding/json"
	"errors"
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

func stubMirrorKnownUnstableProviderImage(t *testing.T, fn func(string) string) {
	t.Helper()

	previous := mirrorKnownUnstableProviderImage
	mirrorKnownUnstableProviderImage = fn
	t.Cleanup(func() {
		mirrorKnownUnstableProviderImage = previous
	})
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
		DisplayName:     "思琪设计",
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

func TestProviderServiceListPrefersProviderDisplayNameOverUserNickname(t *testing.T) {
	db := setupProviderServiceDB(t)
	service := &ProviderService{}

	user := model.User{Phone: "13800138191", Nickname: "用户昵称", PublicID: "user_public_provider_display_name"}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}

	provider := model.Provider{
		UserID:       user.ID,
		ProviderType: 1,
		DisplayName:  "服务商品牌名",
		CompanyName:  "服务商公司名",
		Avatar:       "/uploads/provider-avatar.png",
		Verified:     true,
		Status:       1,
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
	if list[0].Nickname != "服务商品牌名" {
		t.Fatalf("expected provider display name, got %q", list[0].Nickname)
	}
	if list[0].Avatar != "http://localhost:8080/uploads/provider-avatar.png" {
		t.Fatalf("expected provider avatar, got %q", list[0].Avatar)
	}
}

func TestProviderServiceListFallsBackToUserAvatarWhenProviderAvatarMissing(t *testing.T) {
	db := setupProviderServiceDB(t)
	service := &ProviderService{}

	user := model.User{
		Phone:    "13800138192",
		Nickname: "用户昵称",
		Avatar:   "/uploads/user-avatar.png",
		PublicID: "user_public_provider_avatar_fallback",
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}

	provider := model.Provider{
		UserID:       user.ID,
		ProviderType: 1,
		DisplayName:  "服务商品牌名",
		CompanyName:  "服务商公司名",
		Verified:     true,
		Status:       1,
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
	if list[0].Avatar != "http://localhost:8080/uploads/user-avatar.png" {
		t.Fatalf("expected user avatar fallback, got %q", list[0].Avatar)
	}
}

func TestProviderServiceListPrefersMirroredAvatarWhenAvatarHostsAreUnstable(t *testing.T) {
	db := setupProviderServiceDB(t)
	service := &ProviderService{}
	stubMirrorKnownUnstableProviderImage(t, func(raw string) string {
		if strings.Contains(raw, "photo-provider") {
			return "/uploads/remote-cache/provider-avatar.jpg"
		}
		return ""
	})

	user := model.User{
		Phone:    "13800138193",
		Nickname: "案例封面回退用户",
		Avatar:   "https://images.unsplash.com/photo-user",
		PublicID: "user_public_case_cover_avatar_fallback",
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}

	provider := model.Provider{
		UserID:       user.ID,
		ProviderType: 1,
		DisplayName:  "案例封面回退服务商",
		CompanyName:  "案例封面回退公司",
		Avatar:       "https://images.unsplash.com/photo-provider",
		CoverImage:   "https://images.unsplash.com/photo-cover",
		Verified:     true,
		Status:       1,
	}
	if err := db.Create(&provider).Error; err != nil {
		t.Fatalf("create provider: %v", err)
	}

	providerCase := model.ProviderCase{
		ProviderID:  provider.ID,
		Title:       "案例封面",
		CoverImage:  "/static/inspiration/new_chinese_style_tea_room.png",
		Description: "案例封面回退",
	}
	if err := db.Create(&providerCase).Error; err != nil {
		t.Fatalf("create provider case: %v", err)
	}

	list, total, err := service.ListProviders(&ProviderQuery{Type: "designer", Page: 1, PageSize: 10})
	if err != nil {
		t.Fatalf("list providers: %v", err)
	}
	if total != 1 || len(list) != 1 {
		t.Fatalf("unexpected list result: total=%d len=%d", total, len(list))
	}
	if list[0].Avatar != "http://localhost:8080/uploads/remote-cache/provider-avatar.jpg" {
		t.Fatalf("expected mirrored avatar, got %q", list[0].Avatar)
	}
}

func TestProviderServiceListFallsBackToProviderCaseCoverWhenMirrorUnavailable(t *testing.T) {
	db := setupProviderServiceDB(t)
	service := &ProviderService{}
	stubMirrorKnownUnstableProviderImage(t, func(string) string { return "" })

	user := model.User{
		Phone:    "138001381931",
		Nickname: "案例封面回退用户",
		Avatar:   "https://images.unsplash.com/photo-user",
		PublicID: "user_public_case_cover_avatar_fallback_when_mirror_unavailable",
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}

	provider := model.Provider{
		UserID:       user.ID,
		ProviderType: 1,
		DisplayName:  "案例封面回退服务商",
		CompanyName:  "案例封面回退公司",
		Avatar:       "https://images.unsplash.com/photo-provider",
		CoverImage:   "https://images.unsplash.com/photo-cover",
		Verified:     true,
		Status:       1,
	}
	if err := db.Create(&provider).Error; err != nil {
		t.Fatalf("create provider: %v", err)
	}

	providerCase := model.ProviderCase{
		ProviderID:  provider.ID,
		Title:       "案例封面",
		CoverImage:  "/static/inspiration/new_chinese_style_tea_room.png",
		Description: "案例封面回退",
	}
	if err := db.Create(&providerCase).Error; err != nil {
		t.Fatalf("create provider case: %v", err)
	}

	list, total, err := service.ListProviders(&ProviderQuery{Type: "designer", Page: 1, PageSize: 10})
	if err != nil {
		t.Fatalf("list providers: %v", err)
	}
	if total != 1 || len(list) != 1 {
		t.Fatalf("unexpected list result: total=%d len=%d", total, len(list))
	}
	if list[0].Avatar != "http://localhost:8080/static/inspiration/new_chinese_style_tea_room.png" {
		t.Fatalf("expected case cover avatar fallback, got %q", list[0].Avatar)
	}
}

func TestProviderServiceDetailPrefersMirroredAvatarAndCoverWhenHostsAreUnstable(t *testing.T) {
	db := setupProviderServiceDB(t)
	service := &ProviderService{}
	stubMirrorKnownUnstableProviderImage(t, func(raw string) string {
		switch {
		case strings.Contains(raw, "photo-provider"):
			return "/uploads/remote-cache/provider-avatar.jpg"
		case strings.Contains(raw, "photo-cover"):
			return "/uploads/remote-cache/provider-cover.jpg"
		case strings.Contains(raw, "photo-user"):
			return "/uploads/remote-cache/user-avatar.jpg"
		default:
			return ""
		}
	})

	user := model.User{
		Phone:    "13800138194",
		Nickname: "详情封面回退用户",
		Avatar:   "https://images.unsplash.com/photo-user",
		PublicID: "user_public_detail_case_cover_avatar_fallback",
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}

	provider := model.Provider{
		UserID:       user.ID,
		ProviderType: 1,
		DisplayName:  "详情封面回退服务商",
		CompanyName:  "详情封面回退公司",
		Avatar:       "https://images.unsplash.com/photo-provider",
		CoverImage:   "https://images.unsplash.com/photo-cover",
		Verified:     true,
		Status:       1,
	}
	if err := db.Create(&provider).Error; err != nil {
		t.Fatalf("create provider: %v", err)
	}

	providerCase := model.ProviderCase{
		ProviderID:  provider.ID,
		Title:       "详情案例封面",
		CoverImage:  "/static/inspiration/industrial_loft_office.png",
		Description: "详情案例封面回退",
	}
	if err := db.Create(&providerCase).Error; err != nil {
		t.Fatalf("create provider case: %v", err)
	}

	detail, err := service.GetProviderDetail(provider.ID)
	if err != nil {
		t.Fatalf("get provider detail: %v", err)
	}
	if detail.Provider == nil {
		t.Fatalf("expected provider detail")
	}
	if detail.Provider.Avatar != "http://localhost:8080/uploads/remote-cache/provider-avatar.jpg" {
		t.Fatalf("expected mirrored detail avatar, got %q", detail.Provider.Avatar)
	}
	if detail.Provider.CoverImage != "http://localhost:8080/uploads/remote-cache/provider-cover.jpg" {
		t.Fatalf("expected mirrored detail cover, got %q", detail.Provider.CoverImage)
	}
	if detail.User.Avatar != "http://localhost:8080/uploads/remote-cache/user-avatar.jpg" {
		t.Fatalf("expected mirrored detail user avatar, got %q", detail.User.Avatar)
	}
}

func TestResolveProviderDisplayNameFallsBackToUserNicknameForDesigner(t *testing.T) {
	provider := model.Provider{
		Base:         model.Base{ID: 501},
		ProviderType: 1,
		CompanyName:  "工作室名称",
	}
	user := model.User{
		Nickname: "设计师昵称",
		Phone:    "13800138001",
	}

	if got := ResolveProviderDisplayName(provider, &user); got != "设计师昵称" {
		t.Fatalf("expected user nickname fallback, got %q", got)
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

func TestProviderServiceGetProviderCaseDetailReturnsSpecificCase(t *testing.T) {
	db := setupProviderServiceDB(t)
	service := &ProviderService{}

	user := model.User{Phone: "13800138188", Nickname: "案例详情测试", PublicID: "user_public_case_detail"}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}

	provider := model.Provider{
		UserID:                 user.ID,
		ProviderType:           1,
		SubType:                "designer",
		CompanyName:            "案例详情工作室",
		Verified:               true,
		Status:                 1,
		IsSettled:              true,
		PlatformDisplayEnabled: true,
		MerchantDisplayEnabled: true,
	}
	if err := db.Create(&provider).Error; err != nil {
		t.Fatalf("create provider: %v", err)
	}

	for index := 1; index <= 6; index++ {
		item := model.ProviderCase{
			ProviderID: provider.ID,
			Title:      "案例",
			SortOrder:  index,
		}
		if index == 6 {
			item.Title = "第六个案例"
		}
		if err := db.Create(&item).Error; err != nil {
			t.Fatalf("create provider case %d: %v", index, err)
		}
	}

	var target model.ProviderCase
	if err := db.Where("provider_id = ? AND title = ?", provider.ID, "第六个案例").First(&target).Error; err != nil {
		t.Fatalf("find target case: %v", err)
	}

	got, err := service.GetProviderCaseDetail(provider.ID, target.ID)
	if err != nil {
		t.Fatalf("get provider case detail: %v", err)
	}
	if got.ID != target.ID {
		t.Fatalf("unexpected case id: got=%d want=%d", got.ID, target.ID)
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

func TestProviderServiceHidesProviderWhenPlatformDisplayDisabled(t *testing.T) {
	db := setupProviderServiceDB(t)
	service := &ProviderService{}

	user := model.User{Phone: "13800138133", Nickname: "平台关闭设计师", PublicID: "user_public_platform_hidden"}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}
	provider := model.Provider{
		UserID:                 user.ID,
		ProviderType:           1,
		SubType:                "designer",
		CompanyName:            "平台关闭设计工作室",
		Verified:               true,
		Status:                 1,
		PlatformDisplayEnabled: true,
		MerchantDisplayEnabled: true,
	}
	if err := db.Create(&provider).Error; err != nil {
		t.Fatalf("create provider: %v", err)
	}
	if err := db.Model(&model.Provider{}).Where("id = ?", provider.ID).Update("platform_display_enabled", false).Error; err != nil {
		t.Fatalf("disable platform display: %v", err)
	}

	list, total, err := service.ListProviders(&ProviderQuery{Type: "designer", Page: 1, PageSize: 10})
	if err != nil {
		t.Fatalf("list providers: %v", err)
	}
	if total != 0 || len(list) != 0 {
		t.Fatalf("expected platform hidden provider excluded, total=%d list=%v", total, list)
	}

	if _, err := service.GetProviderDetail(provider.ID); err == nil {
		t.Fatalf("expected platform hidden provider detail to be blocked")
	}
}

func TestProviderServiceHidesProviderWhenMerchantDisplayDisabled(t *testing.T) {
	db := setupProviderServiceDB(t)
	service := &ProviderService{}

	user := model.User{Phone: "13800138134", Nickname: "商家关闭设计师", PublicID: "user_public_merchant_hidden"}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}
	provider := model.Provider{
		UserID:                 user.ID,
		ProviderType:           1,
		SubType:                "designer",
		CompanyName:            "商家关闭设计工作室",
		Verified:               true,
		Status:                 1,
		PlatformDisplayEnabled: true,
		MerchantDisplayEnabled: true,
	}
	if err := db.Create(&provider).Error; err != nil {
		t.Fatalf("create provider: %v", err)
	}
	if err := db.Model(&model.Provider{}).Where("id = ?", provider.ID).Update("merchant_display_enabled", false).Error; err != nil {
		t.Fatalf("disable merchant display: %v", err)
	}

	list, total, err := service.ListProviders(&ProviderQuery{Type: "designer", Page: 1, PageSize: 10})
	if err != nil {
		t.Fatalf("list providers: %v", err)
	}
	if total != 0 || len(list) != 0 {
		t.Fatalf("expected merchant hidden provider excluded, total=%d list=%v", total, list)
	}

	if _, err := service.GetProviderDetail(provider.ID); err == nil {
		t.Fatalf("expected merchant hidden provider detail to be blocked")
	}
}

func TestProviderServiceGetProviderCases_ReturnsAllProviderCasesForDetail(t *testing.T) {
	db := setupProviderServiceDB(t)
	service := &ProviderService{}

	user := model.User{Phone: "13800138124", Nickname: "可公开商家", PublicID: "user_public_visible"}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}
	provider := model.Provider{
		UserID:       user.ID,
		ProviderType: 3,
		CompanyName:  "可公开工长",
		Verified:     true,
		Status:       1,
	}
	if err := db.Create(&provider).Error; err != nil {
		t.Fatalf("create provider: %v", err)
	}
	craftCase := model.ProviderCase{ProviderID: provider.ID, Title: "水工施工展示", ShowInInspiration: false}
	if err := db.Create(&craftCase).Error; err != nil {
		t.Fatalf("create craft case: %v", err)
	}
	sceneCase := model.ProviderCase{ProviderID: provider.ID, Title: "归档项目案例", ShowInInspiration: false}
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
		t.Fatalf("expected craft-only cases in detail, count=%d cases=%+v", detail.CaseCount, detail.Cases)
	}
	if detail.SceneCount != 1 || len(detail.SceneCases) != 1 || detail.SceneCases[0].CaseID != sceneCase.ID {
		t.Fatalf("expected one project scene in detail, sceneCount=%d sceneCases=%+v", detail.SceneCount, detail.SceneCases)
	}

	cases, total, err := service.GetProviderCases(provider.ID, 1, 10)
	if err != nil {
		t.Fatalf("get provider cases: %v", err)
	}
	if total != 1 || len(cases) != 1 || cases[0].ID != craftCase.ID {
		t.Fatalf("expected only craft cases in provider case list, total=%d cases=%+v", total, cases)
	}

	sceneCases, sceneTotal, err := service.GetProviderSceneCases(provider.ID, 1, 10)
	if err != nil {
		t.Fatalf("get provider scene cases: %v", err)
	}
	if sceneTotal != 1 || len(sceneCases) != 1 || sceneCases[0].ID == 0 {
		t.Fatalf("expected project scenes from case audits, total=%d sceneCases=%+v", sceneTotal, sceneCases)
	}
}

func TestProviderServiceKeepsDesignerCasesUnified(t *testing.T) {
	db := setupProviderServiceDB(t)
	service := &ProviderService{}

	user := model.User{Phone: "13800138129", Nickname: "设计师案例归一", PublicID: "user_public_designer_cases"}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}
	provider := model.Provider{
		UserID:       user.ID,
		ProviderType: 1,
		CompanyName:  "案例归一设计师",
		Verified:     true,
		Status:       1,
	}
	if err := db.Create(&provider).Error; err != nil {
		t.Fatalf("create provider: %v", err)
	}

	regularCase := model.ProviderCase{ProviderID: provider.ID, Title: "常规案例"}
	if err := db.Create(&regularCase).Error; err != nil {
		t.Fatalf("create regular case: %v", err)
	}
	projectCase := model.ProviderCase{ProviderID: provider.ID, Title: "项目归档案例"}
	if err := db.Create(&projectCase).Error; err != nil {
		t.Fatalf("create project case: %v", err)
	}
	if err := db.Create(&model.CaseAudit{
		CaseID:          &projectCase.ID,
		ProviderID:      provider.ID,
		ActionType:      "create",
		SourceType:      "project_completion",
		SourceProjectID: 3001,
		Status:          1,
		Title:           "项目归档案例",
	}).Error; err != nil {
		t.Fatalf("create project audit: %v", err)
	}

	cases, total, err := service.GetProviderCases(provider.ID, 1, 10)
	if err != nil {
		t.Fatalf("get provider cases: %v", err)
	}
	if total != 2 || len(cases) != 2 {
		t.Fatalf("expected designer cases to stay unified, total=%d cases=%+v", total, cases)
	}

	detail, err := service.GetProviderDetail(provider.ID)
	if err != nil {
		t.Fatalf("get provider detail: %v", err)
	}
	if detail.CaseCount != 2 || len(detail.Cases) != 2 {
		t.Fatalf("expected unified cases in detail, count=%d cases=%+v", detail.CaseCount, detail.Cases)
	}
	if detail.SceneCount != 0 || len(detail.SceneCases) != 0 {
		t.Fatalf("expected no scene cases for designer, sceneCount=%d sceneCases=%+v", detail.SceneCount, detail.SceneCases)
	}

	if _, _, err := service.GetProviderSceneCases(provider.ID, 1, 10); !errors.Is(err, gorm.ErrRecordNotFound) {
		t.Fatalf("expected designer scene cases to be unavailable, got %v", err)
	}
	showcaseDetail, err := service.GetProviderShowcaseDetail(regularCase.ID)
	if err != nil {
		t.Fatalf("expected non-foreman showcase detail to be available, got %v", err)
	}
	if showcaseDetail.ID != regularCase.ID || showcaseDetail.ProviderID != provider.ID {
		t.Fatalf("unexpected non-foreman showcase detail payload: %+v", showcaseDetail)
	}
}

func TestProviderServiceGetProviderSceneCasesReturnsApprovedProjectScenes(t *testing.T) {
	db := setupProviderServiceDB(t)
	service := &ProviderService{}

	user := model.User{Phone: "13800138128", Nickname: "场景案例商家", PublicID: "user_public_scene_cases"}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}
	provider := model.Provider{
		UserID:       user.ID,
		ProviderType: 3,
		CompanyName:  "工长场景案例",
		Verified:     true,
		Status:       1,
	}
	if err := db.Create(&provider).Error; err != nil {
		t.Fatalf("create provider: %v", err)
	}

	sceneCase := model.ProviderCase{ProviderID: provider.ID, Title: "项目实景案例", ShowInInspiration: true}
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
		Title:           "项目实景案例",
		CoverImage:      "/uploads/cases/scene-cover.jpg",
		Description:     "来自真实完工项目",
		Images:          `["/uploads/cases/scene-cover.jpg","/uploads/cases/scene-2.jpg"]`,
		Year:            "2026",
	}).Error; err != nil {
		t.Fatalf("create scene audit: %v", err)
	}

	sceneCases, total, err := service.GetProviderSceneCases(provider.ID, 1, 10)
	if err != nil {
		t.Fatalf("get provider scene cases: %v", err)
	}
	if total != 1 || len(sceneCases) != 1 {
		t.Fatalf("expected one scene case, total=%d cases=%+v", total, sceneCases)
	}
	if sceneCases[0].CaseID != sceneCase.ID || sceneCases[0].ProjectID != 2026 {
		t.Fatalf("unexpected scene case payload: %+v", sceneCases[0])
	}
}

func TestProviderSceneDetailUsesLatestApprovedAuditSnapshot(t *testing.T) {
	db := setupProviderServiceDB(t)
	service := &ProviderService{}

	user := model.User{Phone: "13800138129", Nickname: "工长案例详情", PublicID: "user_public_scene_detail"}
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
	sceneCase := model.ProviderCase{ProviderID: provider.ID, Title: "初始案例"}
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

func TestProviderShowcaseDetailHidesForemanSceneCases(t *testing.T) {
	db := setupProviderServiceDB(t)
	service := &ProviderService{}

	user := model.User{Phone: "13800138130", Nickname: "工长案例隔离", PublicID: "user_public_foreman_showcase_hide"}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}
	provider := model.Provider{
		UserID:       user.ID,
		ProviderType: 3,
		CompanyName:  "工长案例隔离",
		Verified:     true,
		Status:       1,
	}
	if err := db.Create(&provider).Error; err != nil {
		t.Fatalf("create provider: %v", err)
	}

	sceneCase := model.ProviderCase{ProviderID: provider.ID, Title: "被项目归档占用的案例"}
	if err := db.Create(&sceneCase).Error; err != nil {
		t.Fatalf("create scene case: %v", err)
	}
	if err := db.Create(&model.CaseAudit{
		CaseID:          &sceneCase.ID,
		ProviderID:      provider.ID,
		ActionType:      "create",
		SourceType:      "project_completion",
		SourceProjectID: 7001,
		Status:          1,
		Title:           "被项目归档占用的案例",
	}).Error; err != nil {
		t.Fatalf("create scene audit: %v", err)
	}

	if _, err := service.GetProviderShowcaseDetail(sceneCase.ID); !errors.Is(err, gorm.ErrRecordNotFound) {
		t.Fatalf("expected linked foreman scene case to be hidden from showcase detail, got %v", err)
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

func TestProviderServiceRecommendSortPrioritizesSettledProviders(t *testing.T) {
	db := setupProviderServiceDB(t)
	service := &ProviderService{}

	settledUser := model.User{Phone: "13800138130", Nickname: "正式公司", PublicID: "user_public_settled_company"}
	referenceUser := model.User{Phone: "13800138131", Nickname: "公开资料公司", PublicID: "user_public_reference_company"}
	if err := db.Create(&settledUser).Error; err != nil {
		t.Fatalf("create settled user: %v", err)
	}
	if err := db.Create(&referenceUser).Error; err != nil {
		t.Fatalf("create reference user: %v", err)
	}

	settledProvider := model.Provider{
		UserID:       settledUser.ID,
		ProviderType: 2,
		CompanyName:  "正式入驻公司",
		Verified:     true,
		Status:       1,
		IsSettled:    true,
		Rating:       3.9,
		ReviewCount:  2,
		CompletedCnt: 1,
	}
	if err := db.Create(&settledProvider).Error; err != nil {
		t.Fatalf("create settled provider: %v", err)
	}

	referenceProvider := model.Provider{
		UserID:       referenceUser.ID,
		ProviderType: 2,
		CompanyName:  "公开资料公司",
		Status:       1,
		Rating:       4.9,
		ReviewCount:  120,
		CompletedCnt: 80,
	}
	if err := db.Create(&referenceProvider).Error; err != nil {
		t.Fatalf("create reference provider: %v", err)
	}
	if err := db.Model(&model.Provider{}).
		Where("id = ?", referenceProvider.ID).
		Updates(map[string]any{
			"is_settled": false,
			"verified":   false,
		}).Error; err != nil {
		t.Fatalf("mark reference provider as unsettled: %v", err)
	}

	list, total, err := service.ListProviders(&ProviderQuery{Type: "company", Page: 1, PageSize: 10})
	if err != nil {
		t.Fatalf("list providers by recommend: %v", err)
	}
	if total != 2 || len(list) != 2 {
		t.Fatalf("unexpected recommend list result: total=%d len=%d", total, len(list))
	}
	if list[0].ID != settledProvider.ID {
		t.Fatalf("expected settled provider first in recommend sort, got order=%d,%d", list[0].ID, list[1].ID)
	}

	ratingList, total, err := service.ListProviders(&ProviderQuery{Type: "company", SortBy: "rating", Page: 1, PageSize: 10})
	if err != nil {
		t.Fatalf("list providers by rating: %v", err)
	}
	if total != 2 || len(ratingList) != 2 {
		t.Fatalf("unexpected rating list result: total=%d len=%d", total, len(ratingList))
	}
	if ratingList[0].ID != referenceProvider.ID {
		t.Fatalf("expected explicit rating sort to honor rating first, got order=%d,%d", ratingList[0].ID, ratingList[1].ID)
	}
}

func TestProviderServicePublicListOmitsSensitiveIdentityFields(t *testing.T) {
	db := setupProviderServiceDB(t)
	service := &ProviderService{}

	user := model.User{Phone: "13800138166", Nickname: "公开服务商", PublicID: "provider_public_identity"}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}
	provider := model.Provider{
		UserID:       user.ID,
		ProviderType: 1,
		CompanyName:  "公开设计工作室",
		Verified:     true,
		Status:       1,
		IsSettled:    true,
		Latitude:     34.2234,
		Longitude:    108.9512,
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

	body, err := json.Marshal(list[0])
	if err != nil {
		t.Fatalf("marshal provider list item: %v", err)
	}
	text := string(body)
	for _, forbidden := range []string{"userId", "userPublicId", "latitude", "longitude", "phone", "publicId"} {
		if strings.Contains(text, forbidden) {
			t.Fatalf("expected provider list payload to omit %s, got %s", forbidden, text)
		}
	}
}

func TestProviderServicePublicDetailOmitsSensitiveIdentityFields(t *testing.T) {
	db := setupProviderServiceDB(t)
	service := &ProviderService{}

	user := model.User{Phone: "13800138167", Nickname: "详情服务商", PublicID: "provider_detail_public_id"}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}
	provider := model.Provider{
		UserID:                    user.ID,
		ProviderType:              2,
		CompanyName:               "详情装修公司",
		DisplayName:               "详情装修公司",
		Verified:                  true,
		Status:                    1,
		IsSettled:                 true,
		Latitude:                  34.2211,
		Longitude:                 108.9333,
		OfficeAddress:             "西安市高新区锦业路",
		SourceApplicationID:       9988,
		CollectedSource:           "招商线索库",
		NeedsOnboardingCompletion: true,
	}
	if err := db.Create(&provider).Error; err != nil {
		t.Fatalf("create provider: %v", err)
	}

	detail, err := service.GetProviderDetail(provider.ID)
	if err != nil {
		t.Fatalf("get provider detail: %v", err)
	}

	body, err := json.Marshal(detail)
	if err != nil {
		t.Fatalf("marshal provider detail: %v", err)
	}
	text := string(body)
	for _, forbidden := range []string{"phone", "publicId", "userId", "latitude", "longitude", "officeAddress", "sourceApplicationId", "collectedSource", "needsOnboardingCompletion"} {
		if strings.Contains(text, forbidden) {
			t.Fatalf("expected provider detail payload to omit %s, got %s", forbidden, text)
		}
	}
}

func TestBuildProviderPriceDisplayUsesSingleValueForEqualRange(t *testing.T) {
	display := buildProviderPriceDisplay(1, "", 330, 330, model.ProviderPriceUnitPerSquareMeter)
	if display.Mode != ProviderPriceDisplayModeSingle {
		t.Fatalf("expected single mode, got %+v", display)
	}
	if display.Primary != "330元/㎡" {
		t.Fatalf("expected single price display, got %+v", display)
	}
}

func TestBuildProviderPriceDisplayKeepsCompanyStructuredLabels(t *testing.T) {
	display := buildProviderPriceDisplay(2, `{"fullPackage":800,"halfPackage":500}`, 500, 800, model.ProviderPriceUnitPerSquareMeter)
	if display.Mode != ProviderPriceDisplayModeStructured {
		t.Fatalf("expected structured mode, got %+v", display)
	}
	if display.Primary != "全包 800元/㎡" || display.Secondary != "半包 500元/㎡" {
		t.Fatalf("expected labeled company pricing, got %+v", display)
	}
	if len(display.Details) != 2 {
		t.Fatalf("expected full company price details, got %+v", display)
	}
}

func TestBuildProviderPriceDisplayNormalizesForemanUnitToSquareMeter(t *testing.T) {
	display := buildProviderPriceDisplay(3, `{"perSqm":599}`, 599, 599, "元/天")
	if display.Primary != "599元/㎡" {
		t.Fatalf("expected foreman pricing to normalize to sqm, got %+v", display)
	}
	if len(display.Details) != 1 || display.Details[0] != "施工报价 599元/㎡" {
		t.Fatalf("unexpected foreman pricing details: %+v", display)
	}
}

func ptrTime(value time.Time) *time.Time {
	return &value
}
