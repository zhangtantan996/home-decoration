package service

import (
	"testing"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"

	gormsqlite "gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupMaterialShopServiceDB(t *testing.T) *gorm.DB {
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

	if err := db.AutoMigrate(&model.MaterialShop{}, &model.MaterialShopProduct{}); err != nil {
		t.Fatalf("auto migrate material shop tables: %v", err)
	}

	previousDB := repository.DB
	repository.DB = db
	t.Cleanup(func() {
		repository.DB = previousDB
		_ = sqlDB.Close()
	})

	return db
}

func createMaterialShopForTest(t *testing.T, db *gorm.DB, shop model.MaterialShop, activeProducts int) model.MaterialShop {
	t.Helper()

	shouldStayUnsettled := !shop.IsSettled
	if err := db.Create(&shop).Error; err != nil {
		t.Fatalf("create material shop: %v", err)
	}
	if shouldStayUnsettled {
		if err := db.Model(&shop).Update("is_settled", false).Error; err != nil {
			t.Fatalf("mark material shop unsettled: %v", err)
		}
		shop.IsSettled = false
	}

	for i := 0; i < activeProducts; i++ {
		product := model.MaterialShopProduct{
			ShopID:     shop.ID,
			Name:       "商品",
			ParamsJSON: `{"规格":"默认"}`,
			Price:      100,
			ImagesJSON: `["/product.jpg"]`,
			CoverImage: "/product.jpg",
			Status:     1,
			SortOrder:  i,
		}
		if err := db.Create(&product).Error; err != nil {
			t.Fatalf("create material shop product: %v", err)
		}
	}

	return shop
}

func containsMaterialShopName(items []MaterialShopListItem, name string) bool {
	for _, item := range items {
		if item.Name == name {
			return true
		}
	}
	return false
}

func TestMaterialShopServiceListIncludesVerifiedShopWithoutProducts(t *testing.T) {
	db := setupMaterialShopServiceDB(t)
	service := &MaterialShopService{}

	createMaterialShopForTest(t, db, model.MaterialShop{Name: "零商品已审核店", Type: "showroom", IsVerified: true, IsSettled: true}, 0)
	createMaterialShopForTest(t, db, model.MaterialShop{Name: "五商品已审核店", Type: "showroom", IsVerified: true, IsSettled: true}, 5)

	list, total, err := service.ListMaterialShops(&MaterialShopQuery{Page: 1, PageSize: 10})
	if err != nil {
		t.Fatalf("list material shops: %v", err)
	}
	if total != 2 {
		t.Fatalf("unexpected total: got=%d want=2", total)
	}
	if !containsMaterialShopName(list, "零商品已审核店") {
		t.Fatalf("expected verified shop without products to be visible, got=%v", list)
	}
}

func TestMaterialShopServiceListIncludesVerifiedShopBelowFiveProducts(t *testing.T) {
	db := setupMaterialShopServiceDB(t)
	service := &MaterialShopService{}

	createMaterialShopForTest(t, db, model.MaterialShop{Name: "四商品已审核店", Type: "showroom", IsVerified: true, IsSettled: true}, 4)
	createMaterialShopForTest(t, db, model.MaterialShop{Name: "五商品已审核店", Type: "showroom", IsVerified: true, IsSettled: true}, 5)

	list, total, err := service.ListMaterialShops(&MaterialShopQuery{Page: 1, PageSize: 10})
	if err != nil {
		t.Fatalf("list material shops: %v", err)
	}
	if total != 2 {
		t.Fatalf("unexpected total: got=%d want=2", total)
	}
	if !containsMaterialShopName(list, "四商品已审核店") {
		t.Fatalf("expected verified shop below five products to be visible, got=%v", list)
	}
}

func TestMaterialShopServiceListExcludesUnverifiedShop(t *testing.T) {
	db := setupMaterialShopServiceDB(t)
	service := &MaterialShopService{}

	createMaterialShopForTest(t, db, model.MaterialShop{Name: "六商品未审核店", Type: "showroom", IsVerified: false, IsSettled: true}, 6)
	createMaterialShopForTest(t, db, model.MaterialShop{Name: "五商品已审核店", Type: "showroom", IsVerified: true, IsSettled: true}, 5)

	list, total, err := service.ListMaterialShops(&MaterialShopQuery{Page: 1, PageSize: 10})
	if err != nil {
		t.Fatalf("list material shops: %v", err)
	}
	if total != 1 {
		t.Fatalf("unexpected total: got=%d want=1", total)
	}
	if containsMaterialShopName(list, "六商品未审核店") {
		t.Fatalf("expected unverified shop to stay hidden, got=%v", list)
	}
}

func TestMaterialShopServiceListSupportsKeywordCityAndRatingFilters(t *testing.T) {
	db := setupMaterialShopServiceDB(t)
	service := &MaterialShopService{}

	createMaterialShopForTest(t, db, model.MaterialShop{
		Name:              "西安木作馆",
		Type:              "showroom",
		IsVerified:        true,
		IsSettled:         true,
		Address:           "陕西省西安市雁塔区科技路",
		Rating:            4.9,
		MainProducts:      `["木地板","定制木作"]`,
		ProductCategories: "地板,木作",
		Tags:              `["环保"]`,
	}, 1)
	createMaterialShopForTest(t, db, model.MaterialShop{
		Name:              "成都木作馆",
		Type:              "showroom",
		IsVerified:        true,
		IsSettled:         true,
		Address:           "四川省成都市高新区天府大道",
		Rating:            4.9,
		MainProducts:      `["木地板"]`,
		ProductCategories: "地板",
	}, 1)
	createMaterialShopForTest(t, db, model.MaterialShop{
		Name:              "西安低分店",
		Type:              "showroom",
		IsVerified:        true,
		IsSettled:         true,
		Address:           "陕西省西安市未央区",
		Rating:            4.2,
		MainProducts:      `["木地板"]`,
		ProductCategories: "地板",
	}, 1)

	list, total, err := service.ListMaterialShops(&MaterialShopQuery{
		Keyword:   "木地板",
		City:      "西安",
		RatingMin: 4.5,
		Page:      1,
		PageSize:  10,
	})
	if err != nil {
		t.Fatalf("list material shops with filters: %v", err)
	}
	if total != 1 || len(list) != 1 {
		t.Fatalf("expected exactly one filtered shop, total=%d len=%d", total, len(list))
	}
	if list[0].Name != "西安木作馆" {
		t.Fatalf("unexpected filtered shop: %+v", list[0])
	}
}

func TestMaterialShopServiceDetailAllowsVerifiedShopWithoutEnoughProducts(t *testing.T) {
	db := setupMaterialShopServiceDB(t)
	service := &MaterialShopService{}

	shop := createMaterialShopForTest(t, db, model.MaterialShop{Name: "详情零商品已审核店", Type: "showroom", IsVerified: true, IsSettled: true}, 0)

	if _, err := service.GetMaterialShopByID(shop.ID); err != nil {
		t.Fatalf("expected detail to stay visible for verified shop without enough products: %v", err)
	}
}

func TestMaterialShopServiceDetailReturnsPublicProductsAndUsesProductCoverFallback(t *testing.T) {
	db := setupMaterialShopServiceDB(t)
	service := &MaterialShopService{}

	shop := createMaterialShopForTest(t, db, model.MaterialShop{
		Name:       "公开商品门店",
		Type:       "showroom",
		IsVerified: true,
		IsSettled:  true,
		Cover:      "",
	}, 0)

	product := model.MaterialShopProduct{
		ShopID:      shop.ID,
		Name:        "橡木地板",
		Unit:        "平方米",
		Description: "适合卧室与客厅通铺",
		Price:       299,
		ImagesJSON:  `["/uploads/material/floor.jpg","/uploads/material/floor-2.jpg"]`,
		CoverImage:  "/uploads/material/floor.jpg",
		Status:      1,
		SortOrder:   0,
	}
	if err := db.Create(&product).Error; err != nil {
		t.Fatalf("create material shop product: %v", err)
	}

	detail, err := service.GetMaterialShopByID(shop.ID)
	if err != nil {
		t.Fatalf("get material shop detail: %v", err)
	}
	if detail.Cover == "" {
		t.Fatal("expected detail cover to fallback to first active product cover")
	}
	if len(detail.Products) != 1 {
		t.Fatalf("expected one public product, got=%d", len(detail.Products))
	}
	if detail.Products[0].Name != "橡木地板" {
		t.Fatalf("unexpected public product: %+v", detail.Products[0])
	}
	if len(detail.Products[0].Images) != 2 {
		t.Fatalf("expected product images to be returned, got=%v", detail.Products[0].Images)
	}
	if detail.Description != "" {
		t.Fatalf("expected public detail description to be blank, got=%q", detail.Description)
	}
}

func TestMaterialShopServiceListShowsUnsettledLeadShopsAsReference(t *testing.T) {
	db := setupMaterialShopServiceDB(t)
	service := &MaterialShopService{}

	settledStatus := int8(1)
	createMaterialShopForTest(t, db, model.MaterialShop{
		Name:       "正式入驻门店",
		Type:       "showroom",
		IsVerified: true,
		IsSettled:  true,
		Status:     &settledStatus,
	}, 1)
	createMaterialShopForTest(t, db, model.MaterialShop{
		Name:       "未入驻线索门店",
		Type:       "showroom",
		IsVerified: false,
		IsSettled:  false,
		Status:     &settledStatus,
	}, 1)

	list, total, err := service.ListMaterialShops(&MaterialShopQuery{Page: 1, PageSize: 10})
	if err != nil {
		t.Fatalf("list material shops: %v", err)
	}
	if total != 2 || len(list) != 2 {
		t.Fatalf("expected settled shop and unsettled lead to remain visible, total=%d len=%d", total, len(list))
	}
	if !containsMaterialShopName(list, "未入驻线索门店") {
		t.Fatalf("expected unsettled lead to be visible, got=%v", list)
	}
	for _, item := range list {
		if item.Name == "未入驻线索门店" {
			if item.IsVerified {
				t.Fatalf("unsettled lead must not be exposed as verified: %+v", item)
			}
			if item.IsSettled {
				t.Fatalf("unsettled lead must keep isSettled=false: %+v", item)
			}
		}
		if item.Description != "" {
			t.Fatalf("expected public list description to be blank, got=%q", item.Description)
		}
	}
}

func TestMaterialShopServiceHidesShopWhenPlatformDisplayDisabled(t *testing.T) {
	db := setupMaterialShopServiceDB(t)
	service := &MaterialShopService{}

	shop := createMaterialShopForTest(t, db, model.MaterialShop{
		Name:                   "平台关闭门店",
		Type:                   "showroom",
		IsVerified:             true,
		IsSettled:              true,
		PlatformDisplayEnabled: true,
		MerchantDisplayEnabled: true,
	}, 2)
	if err := db.Model(&model.MaterialShop{}).Where("id = ?", shop.ID).Update("platform_display_enabled", false).Error; err != nil {
		t.Fatalf("disable platform display: %v", err)
	}

	list, total, err := service.ListMaterialShops(&MaterialShopQuery{Page: 1, PageSize: 10})
	if err != nil {
		t.Fatalf("list material shops: %v", err)
	}
	if total != 0 || len(list) != 0 {
		t.Fatalf("expected hidden shop to be excluded from list, total=%d list=%v", total, list)
	}

	if _, err := service.GetMaterialShopByID(shop.ID); err == nil {
		t.Fatalf("expected hidden shop detail to be blocked")
	}
}

func TestMaterialShopServiceHidesShopWhenMerchantDisplayDisabled(t *testing.T) {
	db := setupMaterialShopServiceDB(t)
	service := &MaterialShopService{}

	shop := createMaterialShopForTest(t, db, model.MaterialShop{
		Name:                   "商家关闭门店",
		Type:                   "showroom",
		IsVerified:             true,
		IsSettled:              true,
		PlatformDisplayEnabled: true,
		MerchantDisplayEnabled: true,
	}, 2)
	if err := db.Model(&model.MaterialShop{}).Where("id = ?", shop.ID).Update("merchant_display_enabled", false).Error; err != nil {
		t.Fatalf("disable merchant display: %v", err)
	}

	list, total, err := service.ListMaterialShops(&MaterialShopQuery{Page: 1, PageSize: 10})
	if err != nil {
		t.Fatalf("list material shops: %v", err)
	}
	if total != 0 || len(list) != 0 {
		t.Fatalf("expected hidden shop to be excluded from list, total=%d list=%v", total, list)
	}

	if _, err := service.GetMaterialShopByID(shop.ID); err == nil {
		t.Fatalf("expected hidden shop detail to be blocked")
	}
}
