package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
)

func TestAdminListProviders_DerivedStatusesAndFilters(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db := setupSQLiteDB(t)
	if err := db.AutoMigrate(&model.User{}, &model.Provider{}, &model.MerchantApplication{}); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}

	previousDB := repository.DB
	repository.DB = db
	t.Cleanup(func() { repository.DB = previousDB })

	users := []model.User{
		{Base: model.Base{ID: 2001}, Phone: "13800002001", Nickname: "账号正常", Status: 1},
		{Base: model.Base{ID: 2002}, Phone: "13800002002", Nickname: "账号禁用", Status: 1},
		{Base: model.Base{ID: 2003}, Phone: "13800002003", Nickname: "主体封禁", Status: 1},
		{Base: model.Base{ID: 2004}, Phone: "13800002004", Nickname: "待补全", Status: 1},
	}
	for _, user := range users {
		if err := db.Create(&user).Error; err != nil {
			t.Fatalf("seed user %d: %v", user.ID, err)
		}
	}
	if err := db.Model(&model.User{}).Where("id = ?", 2002).Update("status", 0).Error; err != nil {
		t.Fatalf("disable user: %v", err)
	}

	providers := []model.Provider{
		{Base: model.Base{ID: 3001}, CompanyName: "平台收录公司", ProviderType: 2, Status: 1, IsSettled: false},
		{Base: model.Base{ID: 3002}, UserID: 2002, CompanyName: "账号禁用公司", ProviderType: 2, Status: 1, IsSettled: true, Verified: true},
		{Base: model.Base{ID: 3003}, UserID: 2003, CompanyName: "主体封禁公司", ProviderType: 2, Status: 1, IsSettled: true, Verified: true},
		{Base: model.Base{ID: 3004}, UserID: 2004, CompanyName: "待补全公司", ProviderType: 2, Status: 1, IsSettled: true, NeedsOnboardingCompletion: true},
	}
	for _, provider := range providers {
		if err := db.Create(&provider).Error; err != nil {
			t.Fatalf("seed provider %d: %v", provider.ID, err)
		}
	}
	if err := db.Model(&model.Provider{}).Where("id = ?", 3003).Update("status", 0).Error; err != nil {
		t.Fatalf("freeze provider: %v", err)
	}

	if err := db.Create(&model.MerchantApplication{
		Base:             model.Base{ID: 4001},
		UserID:           2004,
		ProviderID:       3004,
		Phone:            "13800002004",
		ApplicationScene: model.MerchantApplicationSceneClaimedCompletion,
		Status:           0,
	}).Error; err != nil {
		t.Fatalf("seed completion app: %v", err)
	}

	resp := requestAdminProviderList(t, "/api/v1/admin/providers?page=1&pageSize=10")
	if resp.Code != 0 {
		t.Fatalf("unexpected code: got=%d message=%s", resp.Code, resp.Message)
	}

	var data struct {
		List []struct {
			ID               uint64 `json:"id"`
			AccountStatus    string `json:"accountStatus"`
			LoginStatus      string `json:"loginStatus"`
			OperatingStatus  string `json:"operatingStatus"`
			OnboardingStatus string `json:"onboardingStatus"`
			LoginEnabled     bool   `json:"loginEnabled"`
			OperatingEnabled bool   `json:"operatingEnabled"`
		} `json:"list"`
		Total int64 `json:"total"`
	}
	if err := json.Unmarshal(resp.Data, &data); err != nil {
		t.Fatalf("decode data: %v", err)
	}
	if data.Total != 4 {
		t.Fatalf("unexpected total: got=%d want=4", data.Total)
	}
	expectedOrder := []uint64{3004, 3003, 3002, 3001}
	if len(data.List) != len(expectedOrder) {
		t.Fatalf("unexpected list length: got=%d want=%d", len(data.List), len(expectedOrder))
	}
	for index, expectedID := range expectedOrder {
		if data.List[index].ID != expectedID {
			t.Fatalf("unexpected provider order at %d: got=%d want=%d", index, data.List[index].ID, expectedID)
		}
	}

	rows := make(map[uint64]struct {
		AccountStatus    string
		LoginStatus      string
		OperatingStatus  string
		OnboardingStatus string
		LoginEnabled     bool
		OperatingEnabled bool
	}, len(data.List))
	for _, item := range data.List {
		rows[item.ID] = struct {
			AccountStatus    string
			LoginStatus      string
			OperatingStatus  string
			OnboardingStatus string
			LoginEnabled     bool
			OperatingEnabled bool
		}{
			AccountStatus:    item.AccountStatus,
			LoginStatus:      item.LoginStatus,
			OperatingStatus:  item.OperatingStatus,
			OnboardingStatus: item.OnboardingStatus,
			LoginEnabled:     item.LoginEnabled,
			OperatingEnabled: item.OperatingEnabled,
		}
	}

	if got := rows[3001]; got.AccountStatus != adminAccountStatusUnbound || got.LoginStatus != adminLoginStatusUnbound || got.OperatingStatus != adminOperatingStatusUnopened || got.OnboardingStatus != adminOnboardingStatusNone {
		t.Fatalf("unexpected unbound row: %+v", got)
	}
	if got := rows[3002]; got.AccountStatus != adminAccountStatusDisabled || got.LoginStatus != adminLoginStatusDisabledByAccount || got.OperatingStatus != adminOperatingStatusActive || got.OnboardingStatus != merchantOnboardingStatusApproved || got.LoginEnabled || !got.OperatingEnabled {
		t.Fatalf("unexpected disabled account row: %+v", got)
	}
	if got := rows[3003]; got.AccountStatus != adminAccountStatusActive || got.LoginStatus != adminLoginStatusDisabledByEntity || got.OperatingStatus != adminOperatingStatusFrozen || got.OnboardingStatus != merchantOnboardingStatusApproved || got.LoginEnabled || got.OperatingEnabled {
		t.Fatalf("unexpected frozen entity row: %+v", got)
	}
	if got := rows[3004]; got.AccountStatus != adminAccountStatusActive || got.LoginStatus != adminLoginStatusEnabled || got.OperatingStatus != adminOperatingStatusRestricted || got.OnboardingStatus != merchantOnboardingStatusPendingReview || !got.LoginEnabled || got.OperatingEnabled {
		t.Fatalf("unexpected restricted row: %+v", got)
	}

	filteredResp := requestAdminProviderList(t, "/api/v1/admin/providers?page=1&pageSize=1&accountStatus=disabled")
	if filteredResp.Code != 0 {
		t.Fatalf("unexpected filtered code: got=%d message=%s", filteredResp.Code, filteredResp.Message)
	}
	var filtered struct {
		List []struct {
			ID uint64 `json:"id"`
		} `json:"list"`
		Total int64 `json:"total"`
	}
	if err := json.Unmarshal(filteredResp.Data, &filtered); err != nil {
		t.Fatalf("decode filtered data: %v", err)
	}
	if filtered.Total != 1 || len(filtered.List) != 1 || filtered.List[0].ID != 3002 {
		t.Fatalf("unexpected filtered result: %+v", filtered)
	}

	pagedResp := requestAdminProviderList(t, "/api/v1/admin/providers?page=2&pageSize=1")
	if pagedResp.Code != 0 {
		t.Fatalf("unexpected paged code: got=%d message=%s", pagedResp.Code, pagedResp.Message)
	}
	var paged struct {
		List []struct {
			ID uint64 `json:"id"`
		} `json:"list"`
		Total int64 `json:"total"`
	}
	if err := json.Unmarshal(pagedResp.Data, &paged); err != nil {
		t.Fatalf("decode paged data: %v", err)
	}
	if paged.Total != 4 || len(paged.List) != 1 || paged.List[0].ID != 3003 {
		t.Fatalf("unexpected paged provider result: %+v", paged)
	}
}

func TestAdminListMaterialShops_DerivedStatusesAndFilters(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db := setupSQLiteDB(t)
	if err := db.AutoMigrate(&model.User{}, &model.MaterialShop{}, &model.MaterialShopApplication{}, &model.MaterialShopProduct{}); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}

	previousDB := repository.DB
	repository.DB = db
	t.Cleanup(func() { repository.DB = previousDB })

	users := []model.User{
		{Base: model.Base{ID: 5001}, Phone: "13800005001", Nickname: "门店正常", Status: 1},
		{Base: model.Base{ID: 5002}, Phone: "13800005002", Nickname: "门店账号禁用", Status: 1},
		{Base: model.Base{ID: 5003}, Phone: "13800005003", Nickname: "门店待补全", Status: 1},
	}
	for _, user := range users {
		if err := db.Create(&user).Error; err != nil {
			t.Fatalf("seed user %d: %v", user.ID, err)
		}
	}
	if err := db.Model(&model.User{}).Where("id = ?", 5002).Update("status", 0).Error; err != nil {
		t.Fatalf("disable shop user: %v", err)
	}

	active := int8(1)
	frozen := int8(0)
	shops := []model.MaterialShop{
		{Base: model.Base{ID: 6001}, Name: "平台收录门店", IsSettled: false, Status: &active},
		{Base: model.Base{ID: 6002}, UserID: 5002, Name: "账号禁用门店", IsSettled: true, IsVerified: true, Status: &active},
		{Base: model.Base{ID: 6003}, UserID: 5003, Name: "待补全门店", IsSettled: true, NeedsOnboardingCompletion: true, Status: &active},
		{Base: model.Base{ID: 6004}, UserID: 5001, Name: "主体封禁门店", IsSettled: true, IsVerified: true, Status: &active},
	}
	for _, shop := range shops {
		if err := db.Create(&shop).Error; err != nil {
			t.Fatalf("seed shop %d: %v", shop.ID, err)
		}
	}
	if err := db.Exec("UPDATE material_shops SET status = ? WHERE id = ?", frozen, 6004).Error; err != nil {
		t.Fatalf("freeze material shop: %v", err)
	}
	var frozenShop model.MaterialShop
	if err := db.First(&frozenShop, 6004).Error; err != nil {
		t.Fatalf("reload frozen shop: %v", err)
	}
	if frozenShop.Status == nil || *frozenShop.Status != 0 {
		t.Fatalf("expected frozen shop status=0, got=%v", frozenShop.Status)
	}

	if err := db.Create(&model.MaterialShopApplication{
		Base:             model.Base{ID: 7001},
		UserID:           5003,
		ShopID:           6003,
		Phone:            "13800005003",
		ApplicationScene: model.MerchantApplicationSceneClaimedCompletion,
		Status:           0,
	}).Error; err != nil {
		t.Fatalf("seed shop completion app: %v", err)
	}

	resp := requestAdminMaterialShopList(t, "/api/v1/admin/material-shops?page=1&pageSize=10")
	if resp.Code != 0 {
		t.Fatalf("unexpected code: got=%d message=%s", resp.Code, resp.Message)
	}

	var data struct {
		List []struct {
			ID               uint64 `json:"id"`
			AccountStatus    string `json:"accountStatus"`
			LoginStatus      string `json:"loginStatus"`
			OperatingStatus  string `json:"operatingStatus"`
			OnboardingStatus string `json:"onboardingStatus"`
			LoginEnabled     bool   `json:"loginEnabled"`
			OperatingEnabled bool   `json:"operatingEnabled"`
		} `json:"list"`
		Total int64 `json:"total"`
	}
	if err := json.Unmarshal(resp.Data, &data); err != nil {
		t.Fatalf("decode data: %v", err)
	}
	if data.Total != 4 {
		t.Fatalf("unexpected total: got=%d want=4", data.Total)
	}
	expectedOrder := []uint64{6003, 6004, 6002, 6001}
	if len(data.List) != len(expectedOrder) {
		t.Fatalf("unexpected shop list length: got=%d want=%d", len(data.List), len(expectedOrder))
	}
	for index, expectedID := range expectedOrder {
		if data.List[index].ID != expectedID {
			t.Fatalf("unexpected shop order at %d: got=%d want=%d", index, data.List[index].ID, expectedID)
		}
	}

	rows := make(map[uint64]struct {
		AccountStatus    string
		LoginStatus      string
		OperatingStatus  string
		OnboardingStatus string
		LoginEnabled     bool
		OperatingEnabled bool
	}, len(data.List))
	for _, item := range data.List {
		rows[item.ID] = struct {
			AccountStatus    string
			LoginStatus      string
			OperatingStatus  string
			OnboardingStatus string
			LoginEnabled     bool
			OperatingEnabled bool
		}{
			AccountStatus:    item.AccountStatus,
			LoginStatus:      item.LoginStatus,
			OperatingStatus:  item.OperatingStatus,
			OnboardingStatus: item.OnboardingStatus,
			LoginEnabled:     item.LoginEnabled,
			OperatingEnabled: item.OperatingEnabled,
		}
	}

	if got := rows[6001]; got.AccountStatus != adminAccountStatusUnbound || got.LoginStatus != adminLoginStatusUnbound || got.OperatingStatus != adminOperatingStatusUnopened || got.OnboardingStatus != adminOnboardingStatusNone {
		t.Fatalf("unexpected unbound shop row: %+v", got)
	}
	if got := rows[6002]; got.AccountStatus != adminAccountStatusDisabled || got.LoginStatus != adminLoginStatusDisabledByAccount || got.OperatingStatus != adminOperatingStatusActive || got.OnboardingStatus != merchantOnboardingStatusApproved || got.LoginEnabled || !got.OperatingEnabled {
		t.Fatalf("unexpected disabled shop account row: %+v", got)
	}
	if got := rows[6003]; got.AccountStatus != adminAccountStatusActive || got.LoginStatus != adminLoginStatusEnabled || got.OperatingStatus != adminOperatingStatusRestricted || got.OnboardingStatus != merchantOnboardingStatusPendingReview || !got.LoginEnabled || got.OperatingEnabled {
		t.Fatalf("unexpected restricted shop row: %+v", got)
	}
	if got := rows[6004]; got.AccountStatus != adminAccountStatusActive || got.LoginStatus != adminLoginStatusDisabledByEntity || got.OperatingStatus != adminOperatingStatusFrozen || got.OnboardingStatus != merchantOnboardingStatusApproved || got.LoginEnabled || got.OperatingEnabled {
		t.Fatalf("unexpected frozen shop row: %+v", got)
	}

	filteredResp := requestAdminMaterialShopList(t, "/api/v1/admin/material-shops?page=1&pageSize=1&operatingStatus=frozen")
	if filteredResp.Code != 0 {
		t.Fatalf("unexpected filtered code: got=%d message=%s", filteredResp.Code, filteredResp.Message)
	}
	var filtered struct {
		List []struct {
			ID uint64 `json:"id"`
		} `json:"list"`
		Total int64 `json:"total"`
	}
	if err := json.Unmarshal(filteredResp.Data, &filtered); err != nil {
		t.Fatalf("decode filtered data: %v", err)
	}
	if filtered.Total != 1 || len(filtered.List) != 1 || filtered.List[0].ID != 6004 {
		t.Fatalf("unexpected filtered result: %+v", filtered)
	}

	pagedResp := requestAdminMaterialShopList(t, "/api/v1/admin/material-shops?page=2&pageSize=1")
	if pagedResp.Code != 0 {
		t.Fatalf("unexpected paged code: got=%d message=%s", pagedResp.Code, pagedResp.Message)
	}
	var paged struct {
		List []struct {
			ID uint64 `json:"id"`
		} `json:"list"`
		Total int64 `json:"total"`
	}
	if err := json.Unmarshal(pagedResp.Data, &paged); err != nil {
		t.Fatalf("decode paged data: %v", err)
	}
	if paged.Total != 4 || len(paged.List) != 1 || paged.List[0].ID != 6004 {
		t.Fatalf("unexpected paged material shop result: %+v", paged)
	}
}

func requestAdminProviderList(t *testing.T, path string) responseEnvelope {
	t.Helper()

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, path, nil)
	AdminListProviders(c)
	return decodeResponse(t, w)
}

func requestAdminMaterialShopList(t *testing.T, path string) responseEnvelope {
	t.Helper()

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, path, nil)
	AdminListMaterialShops(c)
	return decodeResponse(t, w)
}
