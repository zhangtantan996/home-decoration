package service

import (
	"strings"
	"testing"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"

	gormsqlite "gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupRegionServiceTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	db, err := gorm.Open(gormsqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite db: %v", err)
	}
	if err := db.AutoMigrate(&model.Region{}, &model.DictionaryCategory{}, &model.SystemDictionary{}); err != nil {
		t.Fatalf("migrate sqlite db: %v", err)
	}

	previousDB := repository.DB
	repository.DB = db
	t.Cleanup(func() {
		repository.DB = previousDB
	})

	return db
}

func seedServiceRegionOpenData(t *testing.T, db *gorm.DB) {
	t.Helper()

	records := []interface{}{
		&model.Region{Code: "610000", Name: "陕西省", Level: 1, Enabled: true, SortOrder: 1},
		&model.Region{Code: "610100", Name: "西安市", Level: 2, ParentCode: "610000", Enabled: true, SortOrder: 1},
		&model.Region{Code: "610400", Name: "咸阳市", Level: 2, ParentCode: "610000", Enabled: true, SortOrder: 2},
		&model.Region{Code: "610113", Name: "雁塔区", Level: 3, ParentCode: "610100", Enabled: true, SortOrder: 1},
		&model.Region{Code: "510000", Name: "四川省", Level: 1, Enabled: true, SortOrder: 2},
		&model.Region{Code: "510100", Name: "成都市", Level: 2, ParentCode: "510000", Enabled: true, SortOrder: 1},
		&model.DictionaryCategory{Code: openServiceProvincesCategory, Name: "开放服务省份", Enabled: true},
		&model.DictionaryCategory{Code: openServiceCitiesCategory, Name: "开放服务城市", Enabled: true},
		&model.SystemDictionary{CategoryCode: openServiceProvincesCategory, Value: "610000", Label: "陕西省", Enabled: true, SortOrder: 1},
		&model.SystemDictionary{CategoryCode: openServiceCitiesCategory, Value: "510100", Label: "成都市", Enabled: true, SortOrder: 1},
	}

	for _, record := range records {
		if err := db.Create(record).Error; err != nil {
			t.Fatalf("seed record failed: %v", err)
		}
	}
}

func TestRegionServiceListOpenServiceCities(t *testing.T) {
	db := setupRegionServiceTestDB(t)
	seedServiceRegionOpenData(t, db)

	svc := RegionService{}
	items, err := svc.ListOpenServiceCities()
	if err != nil {
		t.Fatalf("list open service cities: %v", err)
	}
	if len(items) != 3 {
		t.Fatalf("expected 3 open cities, got %d", len(items))
	}
	if items[0].Code != "610100" || items[1].Code != "610400" || items[2].Code != "510100" {
		t.Fatalf("unexpected city order: %+v", items)
	}
}

func TestRegionServiceNormalizeServiceCityCodesRejectDistrict(t *testing.T) {
	db := setupRegionServiceTestDB(t)
	seedServiceRegionOpenData(t, db)

	svc := RegionService{}
	_, err := svc.NormalizeServiceCityCodes([]string{"雁塔区"})
	if err == nil {
		t.Fatal("expected district input to be rejected")
	}
	if !strings.Contains(err.Error(), "不是地级市") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestRegionServiceValidateServiceCityCodesAllowsOpenProvinceAndSingleCity(t *testing.T) {
	db := setupRegionServiceTestDB(t)
	seedServiceRegionOpenData(t, db)

	svc := RegionService{}
	if err := svc.ValidateServiceCityCodes([]string{"610100", "510100"}); err != nil {
		t.Fatalf("expected open cities to pass validation, got %v", err)
	}
	if err := svc.ValidateServiceCityCodes([]string{"610113"}); err == nil {
		t.Fatal("expected district code to fail validation")
	}
	if err := svc.ValidateServiceCityCodes([]string{"999999"}); err == nil {
		t.Fatal("expected missing city code to fail validation")
	}
}

func TestRegionServiceResolveServiceAreaInputsToCityDisplayRollsUpDistrict(t *testing.T) {
	db := setupRegionServiceTestDB(t)
	seedServiceRegionOpenData(t, db)

	svc := RegionService{}
	codes, names, err := svc.ResolveServiceAreaInputsToCityDisplay([]string{"610113", "610100", "雁塔区", "999999"})
	if err != nil {
		t.Fatalf("resolve service area city display: %v", err)
	}
	if len(codes) != 1 || codes[0] != "610100" {
		t.Fatalf("expected rolled city code only, got %v", codes)
	}
	if len(names) != 1 || names[0] != "西安市" {
		t.Fatalf("expected rolled city name only, got %v", names)
	}
}
