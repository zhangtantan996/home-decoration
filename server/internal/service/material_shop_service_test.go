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

	if err := db.Create(&shop).Error; err != nil {
		t.Fatalf("create material shop: %v", err)
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

	createMaterialShopForTest(t, db, model.MaterialShop{Name: "零商品已审核店", Type: "showroom", IsVerified: true}, 0)
	createMaterialShopForTest(t, db, model.MaterialShop{Name: "五商品已审核店", Type: "showroom", IsVerified: true}, 5)

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

	createMaterialShopForTest(t, db, model.MaterialShop{Name: "四商品已审核店", Type: "showroom", IsVerified: true}, 4)
	createMaterialShopForTest(t, db, model.MaterialShop{Name: "五商品已审核店", Type: "showroom", IsVerified: true}, 5)

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

	createMaterialShopForTest(t, db, model.MaterialShop{Name: "六商品未审核店", Type: "showroom", IsVerified: false}, 6)
	createMaterialShopForTest(t, db, model.MaterialShop{Name: "五商品已审核店", Type: "showroom", IsVerified: true}, 5)

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

func TestMaterialShopServiceDetailAllowsVerifiedShopWithoutProducts(t *testing.T) {
	db := setupMaterialShopServiceDB(t)
	service := &MaterialShopService{}

	shop := createMaterialShopForTest(t, db, model.MaterialShop{Name: "详情零商品已审核店", Type: "showroom", IsVerified: true}, 0)

	detail, err := service.GetMaterialShopByID(shop.ID)
	if err != nil {
		t.Fatalf("get material shop detail: %v", err)
	}
	if detail == nil || detail.Name != "详情零商品已审核店" {
		t.Fatalf("unexpected detail: %+v", detail)
	}
}
