package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
)

func TestMerchantInfo_ForForeman_HidesWorkTypes(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db := setupSQLiteDB(t)
	if err := db.AutoMigrate(&model.User{}, &model.Provider{}); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}

	previousDB := repository.DB
	repository.DB = db
	t.Cleanup(func() { repository.DB = previousDB })

	providerID := uint64(202)
	userID := uint64(2002)
	if err := db.Create(&model.User{Base: model.Base{ID: userID}, Phone: "13800000022", Nickname: "工长王"}).Error; err != nil {
		t.Fatalf("seed user: %v", err)
	}
	if err := db.Create(&model.Provider{
		Base:            model.Base{ID: providerID},
		UserID:          userID,
		ProviderType:    3,
		SubType:         "foreman",
		WorkTypes:       "mason,electrician",
		Specialty:       "全工种施工",
		YearsExperience: 4,
		Status:          1,
	}).Error; err != nil {
		t.Fatalf("seed provider: %v", err)
	}

	getResp := requestMerchantJSON(t, http.MethodGet, "/api/v1/merchant/info", nil, providerID, userID, MerchantGetInfo)
	if getResp.Code != 0 {
		t.Fatalf("unexpected get info code: %d message=%s", getResp.Code, getResp.Message)
	}

	var getData map[string]json.RawMessage
	if err := json.Unmarshal(getResp.Data, &getData); err != nil {
		t.Fatalf("decode get info data: %v", err)
	}
	if _, ok := getData["workTypes"]; ok {
		t.Fatalf("workTypes should not be returned for foreman")
	}

	var applicantType string
	if err := json.Unmarshal(getData["applicantType"], &applicantType); err != nil || applicantType != "foreman" {
		t.Fatalf("unexpected applicantType: %s err=%v", applicantType, err)
	}
}

func TestMerchantUpdateInfo_ForForeman_ClearsWorkTypesAndKeepsFullSpecialty(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db := setupSQLiteDB(t)
	if err := db.AutoMigrate(&model.User{}, &model.Provider{}); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}

	previousDB := repository.DB
	repository.DB = db
	t.Cleanup(func() { repository.DB = previousDB })

	providerID := uint64(203)
	userID := uint64(2003)
	if err := db.Create(&model.User{Base: model.Base{ID: userID}, Phone: "13800000023", Nickname: "老工长"}).Error; err != nil {
		t.Fatalf("seed user: %v", err)
	}
	if err := db.Create(&model.Provider{
		Base:            model.Base{ID: providerID},
		UserID:          userID,
		ProviderType:    3,
		SubType:         "personal",
		WorkTypes:       "mason",
		Specialty:       "旧 specialty",
		YearsExperience: 6,
		OfficeAddress:   "旧地址",
		Status:          1,
	}).Error; err != nil {
		t.Fatalf("seed provider: %v", err)
	}

	updatePayload := map[string]any{
		"name":            "老工长",
		"yearsExperience": 12,
		"introduction":    "老房改造",
		"officeAddress":   "新办公地址",
	}
	updateResp := requestMerchantJSON(t, http.MethodPut, "/api/v1/merchant/info", updatePayload, providerID, userID, MerchantUpdateInfo)
	if updateResp.Code != 0 {
		t.Fatalf("unexpected update code: %d message=%s", updateResp.Code, updateResp.Message)
	}

	var provider model.Provider
	if err := db.First(&provider, providerID).Error; err != nil {
		t.Fatalf("query provider: %v", err)
	}
	if provider.WorkTypes != "" {
		t.Fatalf("expected work_types cleared, got=%q", provider.WorkTypes)
	}
	if provider.Specialty != "全工种施工" {
		t.Fatalf("unexpected specialty: %s", provider.Specialty)
	}
	if provider.YearsExperience != 12 {
		t.Fatalf("yearsExperience mismatch: got=%d want=12", provider.YearsExperience)
	}
}

func TestMerchantInfo_ForCompany_ReturnsCompanyAlbum(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db := setupSQLiteDB(t)
	if err := db.AutoMigrate(&model.User{}, &model.Provider{}); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}

	previousDB := repository.DB
	repository.DB = db
	t.Cleanup(func() { repository.DB = previousDB })

	providerID := uint64(204)
	userID := uint64(2004)
	if err := db.Create(&model.User{Base: model.Base{ID: userID}, Phone: "13800000024", Nickname: "装修公司"}).Error; err != nil {
		t.Fatalf("seed user: %v", err)
	}
	if err := db.Create(&model.Provider{
		Base:             model.Base{ID: providerID},
		UserID:           userID,
		ProviderType:     2,
		SubType:          "company",
		CompanyName:      "星辰装饰",
		OfficeAddress:    "上海市浦东新区世纪大道 1 号",
		CompanyAlbumJSON: `["/a.jpg","/b.jpg","/c.jpg"]`,
		Status:           1,
	}).Error; err != nil {
		t.Fatalf("seed provider: %v", err)
	}

	getResp := requestMerchantJSON(t, http.MethodGet, "/api/v1/merchant/info", nil, providerID, userID, MerchantGetInfo)
	if getResp.Code != 0 {
		t.Fatalf("unexpected get info code: %d message=%s", getResp.Code, getResp.Message)
	}

	var getData struct {
		OfficeAddress string   `json:"officeAddress"`
		CompanyAlbum  []string `json:"companyAlbum"`
	}
	if err := json.Unmarshal(getResp.Data, &getData); err != nil {
		t.Fatalf("decode get info data: %v", err)
	}
	if getData.OfficeAddress == "" {
		t.Fatalf("expected officeAddress in response")
	}
	if len(getData.CompanyAlbum) != 3 {
		t.Fatalf("unexpected company album length: %v", getData.CompanyAlbum)
	}
}

func TestMerchantInfo_ReadsAndUpdatesDisplayFlags(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db := setupSQLiteDB(t)
	if err := db.AutoMigrate(&model.User{}, &model.Provider{}); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}

	previousDB := repository.DB
	repository.DB = db
	t.Cleanup(func() { repository.DB = previousDB })

	providerID := uint64(205)
	userID := uint64(2005)
	if err := db.Create(&model.User{Base: model.Base{ID: userID}, Phone: "13800000025", Nickname: "展示开关设计师"}).Error; err != nil {
		t.Fatalf("seed user: %v", err)
	}
	if err := db.Create(&model.Provider{
		Base:                   model.Base{ID: providerID},
		UserID:                 userID,
		ProviderType:           1,
		SubType:                "designer",
		CompanyName:            "展示开关工作室",
		Verified:               true,
		Status:                 1,
		PlatformDisplayEnabled: true,
		MerchantDisplayEnabled: false,
		OfficeAddress:          "西安市高新区软件新城",
	}).Error; err != nil {
		t.Fatalf("seed provider: %v", err)
	}
	if err := db.Model(&model.Provider{}).Where("id = ?", providerID).Update("merchant_display_enabled", false).Error; err != nil {
		t.Fatalf("disable merchant display: %v", err)
	}

	getResp := requestMerchantJSON(t, http.MethodGet, "/api/v1/merchant/info", nil, providerID, userID, MerchantGetInfo)
	if getResp.Code != 0 {
		t.Fatalf("unexpected get info code: %d message=%s", getResp.Code, getResp.Message)
	}

	var getData struct {
		MerchantDisplayEnabled bool `json:"merchantDisplayEnabled"`
		PlatformDisplayEnabled bool `json:"platformDisplayEnabled"`
		PublicVisible          bool `json:"publicVisible"`
	}
	if err := json.Unmarshal(getResp.Data, &getData); err != nil {
		t.Fatalf("decode get info data: %v", err)
	}
	if getData.MerchantDisplayEnabled {
		t.Fatalf("expected merchant display disabled in response")
	}
	if !getData.PlatformDisplayEnabled {
		t.Fatalf("expected platform display enabled in response")
	}
	if getData.PublicVisible {
		t.Fatalf("expected provider to stay hidden while merchant display disabled")
	}

	updatePayload := map[string]any{
		"name":                   "展示开关设计师",
		"officeAddress":          "西安市高新区软件新城",
		"merchantDisplayEnabled": true,
	}
	updateResp := requestMerchantJSON(t, http.MethodPut, "/api/v1/merchant/info", updatePayload, providerID, userID, MerchantUpdateInfo)
	if updateResp.Code != 0 {
		t.Fatalf("unexpected update code: %d message=%s", updateResp.Code, updateResp.Message)
	}

	var updated model.Provider
	if err := db.First(&updated, providerID).Error; err != nil {
		t.Fatalf("query provider: %v", err)
	}
	if !updated.MerchantDisplayEnabled {
		t.Fatalf("expected merchant display flag updated")
	}
}

func requestMerchantJSON(
	t *testing.T,
	method string,
	path string,
	payload any,
	providerID uint64,
	userID uint64,
	handlerFunc gin.HandlerFunc,
) responseEnvelope {
	t.Helper()

	var bodyBytes []byte
	if payload != nil {
		encoded, err := json.Marshal(payload)
		if err != nil {
			t.Fatalf("marshal payload: %v", err)
		}
		bodyBytes = encoded
	}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(method, path, bytes.NewReader(bodyBytes))
	c.Request.Header.Set("Content-Type", "application/json")
	c.Set("providerId", providerID)
	c.Set("userId", userID)

	handlerFunc(c)
	return decodeResponse(t, w)
}
