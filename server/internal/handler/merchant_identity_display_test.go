package handler

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/gin-gonic/gin"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
)

func TestMerchantLogin_StudioDesignerCompanyEntity_KeepsDesignerIdentity(t *testing.T) {
	gin.SetMode(gin.TestMode)
	t.Setenv("APP_ENV", "local")
	t.Setenv("SMS_DEBUG_BYPASS", "1")

	db := setupSQLiteDB(t)
	if err := db.AutoMigrate(&model.User{}, &model.Provider{}, &model.MerchantApplication{}); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}

	previousDB := repository.DB
	repository.DB = db
	t.Cleanup(func() { repository.DB = previousDB })

	user := model.User{
		Base:     model.Base{ID: 90003},
		Phone:    "13800000003",
		Nickname: "王建国",
		Status:   1,
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("seed user: %v", err)
	}

	provider := model.Provider{
		Base:         model.Base{ID: 90003},
		UserID:       user.ID,
		ProviderType: 1,
		SubType:      "studio",
		EntityType:   "company",
		CompanyName:  "华美装饰设计公司",
		Status:       1,
		Verified:     true,
	}
	if err := db.Create(&provider).Error; err != nil {
		t.Fatalf("seed provider: %v", err)
	}

	resp := requestMerchantLogin(t, map[string]string{
		"phone": user.Phone,
		"code":  "123456",
	})
	if resp.Code != 0 {
		t.Fatalf("unexpected code: got=%d message=%s", resp.Code, resp.Message)
	}

	var data struct {
		Role     string `json:"role"`
		Provider struct {
			Name            string `json:"name"`
			Role            string `json:"role"`
			ApplicantType   string `json:"applicantType"`
			ProviderSubType string `json:"providerSubType"`
			EntityType      string `json:"entityType"`
		} `json:"provider"`
	}
	if err := json.Unmarshal(resp.Data, &data); err != nil {
		t.Fatalf("decode response data: %v", err)
	}

	if data.Role != "designer" {
		t.Fatalf("unexpected role: got=%s want=designer", data.Role)
	}
	if data.Provider.Name != "王建国" {
		t.Fatalf("unexpected provider name: got=%s want=王建国", data.Provider.Name)
	}
	if data.Provider.Role != "designer" {
		t.Fatalf("unexpected provider.role: got=%s want=designer", data.Provider.Role)
	}
	if data.Provider.ProviderSubType != "designer" {
		t.Fatalf("unexpected providerSubType: got=%s want=designer", data.Provider.ProviderSubType)
	}
	if data.Provider.ApplicantType != "studio" {
		t.Fatalf("unexpected applicantType: got=%s want=studio", data.Provider.ApplicantType)
	}
	if data.Provider.EntityType != "company" {
		t.Fatalf("unexpected entityType: got=%s want=company", data.Provider.EntityType)
	}
}

func TestMerchantGetInfo_StudioDesignerCompanyEntity_KeepsDesignerIdentity(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db := setupSQLiteDB(t)
	if err := db.AutoMigrate(&model.User{}, &model.Provider{}); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}

	previousDB := repository.DB
	repository.DB = db
	t.Cleanup(func() { repository.DB = previousDB })

	providerID := uint64(90003)
	userID := uint64(90003)
	if err := db.Create(&model.User{Base: model.Base{ID: userID}, Phone: "13800000003", Nickname: "王建国"}).Error; err != nil {
		t.Fatalf("seed user: %v", err)
	}
	if err := db.Create(&model.Provider{
		Base:         model.Base{ID: providerID},
		UserID:       userID,
		ProviderType: 1,
		SubType:      "studio",
		EntityType:   "company",
		CompanyName:  "华美装饰设计公司",
		Status:       1,
		Verified:     true,
	}).Error; err != nil {
		t.Fatalf("seed provider: %v", err)
	}

	getResp := requestMerchantJSON(t, http.MethodGet, "/api/v1/merchant/info", nil, providerID, userID, MerchantGetInfo)
	if getResp.Code != 0 {
		t.Fatalf("unexpected get info code: %d message=%s", getResp.Code, getResp.Message)
	}

	var data struct {
		Name            string `json:"name"`
		Role            string `json:"role"`
		ApplicantType   string `json:"applicantType"`
		ProviderSubType string `json:"providerSubType"`
		EntityType      string `json:"entityType"`
		CompanyName     string `json:"companyName"`
	}
	if err := json.Unmarshal(getResp.Data, &data); err != nil {
		t.Fatalf("decode get info data: %v", err)
	}

	if data.Name != "王建国" {
		t.Fatalf("unexpected name: got=%s want=王建国", data.Name)
	}
	if data.Role != "designer" {
		t.Fatalf("unexpected role: got=%s want=designer", data.Role)
	}
	if data.ProviderSubType != "designer" {
		t.Fatalf("unexpected providerSubType: got=%s want=designer", data.ProviderSubType)
	}
	if data.ApplicantType != "studio" {
		t.Fatalf("unexpected applicantType: got=%s want=studio", data.ApplicantType)
	}
	if data.EntityType != "company" {
		t.Fatalf("unexpected entityType: got=%s want=company", data.EntityType)
	}
	if data.CompanyName != "华美装饰设计公司" {
		t.Fatalf("unexpected companyName: got=%s want=华美装饰设计公司", data.CompanyName)
	}
}
