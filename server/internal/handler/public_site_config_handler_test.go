package handler

import (
	"encoding/json"
	"net/http/httptest"
	"strings"
	"testing"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"

	"github.com/gin-gonic/gin"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

type publicSiteConfigResponse struct {
	Code int `json:"code"`
	Data struct {
		SiteConfig struct {
			BrandName              string `json:"brandName"`
			CompanyName            string `json:"companyName"`
			CompanyCreditCode      string `json:"companyCreditCode"`
			CompanyRegisterAddress string `json:"companyRegisterAddress"`
			CompanyContactAddress  string `json:"companyContactAddress"`
			ICP                    string `json:"icp"`
			CustomerPhone          string `json:"customerPhone"`
			CustomerEmail          string `json:"customerEmail,omitempty"`
			ComplaintEmail         string `json:"complaintEmail,omitempty"`
			PrivacyEmail           string `json:"privacyEmail,omitempty"`
			TransactionRules       string `json:"transactionRules"`
			RefundRules            string `json:"refundRules"`
			MerchantOnboarding     string `json:"merchantOnboardingRules"`
			LegalDocuments         []struct {
				Slug    string `json:"slug"`
				Title   string `json:"title"`
				Content string `json:"content"`
			} `json:"legalDocuments"`
		} `json:"siteConfig"`
	} `json:"data"`
}

func withPublicSiteConfigDB(t *testing.T) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open test db: %v", err)
	}
	if err := db.AutoMigrate(&model.SystemConfig{}); err != nil {
		t.Fatalf("migrate test db: %v", err)
	}
	repository.DB = db
}

func TestGetPublicSiteConfigReturnsOnlyPublicDefaults(t *testing.T) {
	gin.SetMode(gin.TestMode)
	withPublicSiteConfigDB(t)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	GetPublicSiteConfig(c)

	var payload publicSiteConfigResponse
	if err := json.Unmarshal(w.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode response: %v\nbody=%s", err, w.Body.String())
	}
	if payload.Code != 0 {
		t.Fatalf("expected success response, got code=%d body=%s", payload.Code, w.Body.String())
	}
	config := payload.Data.SiteConfig
	if config.BrandName != "禾泽云" {
		t.Fatalf("unexpected brand name: %q", config.BrandName)
	}
	if config.CompanyName != "陕西禾泽云创科技有限公司" {
		t.Fatalf("unexpected company name: %q", config.CompanyName)
	}
	if config.ICP != "陕ICP备2026004441号" {
		t.Fatalf("unexpected icp: %q", config.ICP)
	}
	if config.CustomerPhone != "17764774797" {
		t.Fatalf("unexpected phone: %q", config.CustomerPhone)
	}
	if len(config.LegalDocuments) != 6 {
		t.Fatalf("expected 6 public legal documents, got %d", len(config.LegalDocuments))
	}
	seenDocs := map[string]bool{}
	for _, doc := range config.LegalDocuments {
		if doc.Slug == "" || doc.Title == "" || strings.TrimSpace(doc.Content) == "" {
			t.Fatalf("legal document should include slug/title/content: %+v", doc)
		}
		seenDocs[doc.Slug] = true
	}
	for _, slug := range []string{"user-agreement", "privacy-policy", "transaction-rules", "refund-rules", "merchant-rules", "third-party-sharing"} {
		if !seenDocs[slug] {
			t.Fatalf("missing public legal document slug %q: %+v", slug, config.LegalDocuments)
		}
	}
	body := w.Body.String()
	for _, forbidden := range []string{"accessKey", "secret", "privateKey", "templateCode", "JWT", "Redis"} {
		if strings.Contains(strings.ToLower(body), strings.ToLower(forbidden)) {
			t.Fatalf("public config leaked sensitive marker %q: %s", forbidden, body)
		}
	}

	var count int64
	if err := repository.DB.Model(&model.SystemConfig{}).Count(&count).Error; err != nil {
		t.Fatalf("count system configs: %v", err)
	}
	if count != 0 {
		t.Fatalf("public config GET must be read-only, inserted %d system_configs rows", count)
	}
}

func TestGetPublicSiteConfigOmitsBlankEmails(t *testing.T) {
	gin.SetMode(gin.TestMode)
	withPublicSiteConfigDB(t)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	GetPublicSiteConfig(c)

	body := w.Body.String()
	for _, key := range []string{"customerEmail", "complaintEmail", "privacyEmail"} {
		if strings.Contains(body, key) {
			t.Fatalf("blank %s should be omitted from public response: %s", key, body)
		}
	}
}
