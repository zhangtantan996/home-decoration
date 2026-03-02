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

func TestMerchantInfoAndUpdateWorkTypes_ForForeman(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db := setupSQLiteDB(t)
	if err := db.AutoMigrate(&model.User{}, &model.Provider{}); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}

	previousDB := repository.DB
	repository.DB = db
	t.Cleanup(func() {
		repository.DB = previousDB
	})

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
		Specialty:       "mason · electrician",
		YearsExperience: 4,
		Status:          1,
	}).Error; err != nil {
		t.Fatalf("seed provider: %v", err)
	}

	getResp := requestMerchantJSON(t, http.MethodGet, "/api/v1/merchant/info", nil, providerID, userID, MerchantGetInfo)
	if getResp.Code != 0 {
		t.Fatalf("unexpected get info code: %d message=%s", getResp.Code, getResp.Message)
	}

	var getData struct {
		ApplicantType   string   `json:"applicantType"`
		ProviderSubType string   `json:"providerSubType"`
		WorkTypes       []string `json:"workTypes"`
	}
	if err := json.Unmarshal(getResp.Data, &getData); err != nil {
		t.Fatalf("decode get info data: %v", err)
	}
	if getData.ApplicantType != "foreman" {
		t.Fatalf("unexpected applicantType: %s", getData.ApplicantType)
	}
	if getData.ProviderSubType != "foreman" {
		t.Fatalf("unexpected providerSubType: %s", getData.ProviderSubType)
	}
	if len(getData.WorkTypes) != 2 {
		t.Fatalf("unexpected workTypes length: %v", getData.WorkTypes)
	}

	updatePayload := map[string]any{
		"name":            "工长王师傅",
		"yearsExperience": 8,
		"workTypes":       []string{"plumber", "mason"},
		"introduction":    "专注旧房改造",
	}
	updateResp := requestMerchantJSON(t, http.MethodPut, "/api/v1/merchant/info", updatePayload, providerID, userID, MerchantUpdateInfo)
	if updateResp.Code != 0 {
		t.Fatalf("unexpected update code: %d message=%s", updateResp.Code, updateResp.Message)
	}

	var provider model.Provider
	if err := db.First(&provider, providerID).Error; err != nil {
		t.Fatalf("query provider: %v", err)
	}

	if provider.WorkTypes != "plumber,mason" {
		t.Fatalf("work_types mismatch: got=%s want=plumber,mason", provider.WorkTypes)
	}
	if provider.Specialty != "plumber · mason" {
		t.Fatalf("specialty mismatch: got=%s want=plumber · mason", provider.Specialty)
	}
	if provider.YearsExperience != 8 {
		t.Fatalf("yearsExperience mismatch: got=%d want=8", provider.YearsExperience)
	}
}

func TestMerchantInfoAndUpdateWorkTypes_ForLegacyForemanSubType(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db := setupSQLiteDB(t)
	if err := db.AutoMigrate(&model.User{}, &model.Provider{}); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}

	previousDB := repository.DB
	repository.DB = db
	t.Cleanup(func() {
		repository.DB = previousDB
	})

	providerID := uint64(203)
	userID := uint64(2003)
	if err := db.Create(&model.User{Base: model.Base{ID: userID}, Phone: "13800000023", Nickname: "老工长"}).Error; err != nil {
		t.Fatalf("seed user: %v", err)
	}
	if err := db.Create(&model.Provider{
		Base:         model.Base{ID: providerID},
		UserID:       userID,
		ProviderType: 3,
		SubType:      "personal", // 兼容历史默认值
		Status:       1,
	}).Error; err != nil {
		t.Fatalf("seed provider: %v", err)
	}

	getResp := requestMerchantJSON(t, http.MethodGet, "/api/v1/merchant/info", nil, providerID, userID, MerchantGetInfo)
	if getResp.Code != 0 {
		t.Fatalf("unexpected get info code: %d message=%s", getResp.Code, getResp.Message)
	}

	var getData struct {
		ApplicantType   string `json:"applicantType"`
		ProviderSubType string `json:"providerSubType"`
	}
	if err := json.Unmarshal(getResp.Data, &getData); err != nil {
		t.Fatalf("decode get info data: %v", err)
	}
	if getData.ApplicantType != "foreman" {
		t.Fatalf("unexpected applicantType: %s", getData.ApplicantType)
	}
	if getData.ProviderSubType != "foreman" {
		t.Fatalf("unexpected providerSubType: %s", getData.ProviderSubType)
	}

	updatePayload := map[string]any{
		"name":            "老工长",
		"yearsExperience": 12,
		"workTypes":       []string{"mason"},
		"introduction":    "老房改造",
	}
	updateResp := requestMerchantJSON(t, http.MethodPut, "/api/v1/merchant/info", updatePayload, providerID, userID, MerchantUpdateInfo)
	if updateResp.Code != 0 {
		t.Fatalf("unexpected update code: %d message=%s", updateResp.Code, updateResp.Message)
	}

	var provider model.Provider
	if err := db.First(&provider, providerID).Error; err != nil {
		t.Fatalf("query provider: %v", err)
	}

	if provider.WorkTypes != "mason" {
		t.Fatalf("work_types mismatch: got=%s want=mason", provider.WorkTypes)
	}
	if provider.Specialty != "mason" {
		t.Fatalf("specialty mismatch: got=%s want=mason", provider.Specialty)
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
