package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"

	"github.com/gin-gonic/gin"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

type quoteHandlerEnvelope struct {
	Code    int             `json:"code"`
	Message string          `json:"message"`
	Data    json.RawMessage `json:"data"`
}

func setupQuoteHandlerDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite db: %v", err)
	}
	if err := db.AutoMigrate(
		&model.Provider{},
		&model.QuoteLibraryItem{},
		&model.QuoteList{},
		&model.QuoteListItem{},
		&model.QuoteInvitation{},
		&model.QuoteSubmission{},
		&model.QuoteSubmissionItem{},
		&model.QuoteSubmissionRevision{},
	); err != nil {
		t.Fatalf("auto migrate quote models: %v", err)
	}
	oldDB := repository.DB
	repository.DB = db
	t.Cleanup(func() {
		repository.DB = oldDB
	})
	return db
}

func decodeQuoteHandlerEnvelope(t *testing.T, recorder *httptest.ResponseRecorder) quoteHandlerEnvelope {
	t.Helper()
	var envelope quoteHandlerEnvelope
	if err := json.Unmarshal(recorder.Body.Bytes(), &envelope); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	return envelope
}

func performQuoteHandlerRequest(t *testing.T, method, path string, payload any, providerID uint64, handlerFunc gin.HandlerFunc) quoteHandlerEnvelope {
	t.Helper()
	var body []byte
	if payload != nil {
		encoded, err := json.Marshal(payload)
		if err != nil {
			t.Fatalf("marshal payload: %v", err)
		}
		body = encoded
	}
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(method, path, bytes.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")
	c.Set("providerId", providerID)
	handlerFunc(c)
	return decodeQuoteHandlerEnvelope(t, recorder)
}

func TestMerchantGetQuoteListDetail_RequiresInvitation(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupQuoteHandlerDB(t)

	provider := model.Provider{ProviderType: 2, SubType: "company", CompanyName: "A施工队"}
	if err := db.Create(&provider).Error; err != nil {
		t.Fatalf("create provider: %v", err)
	}
	quoteList := model.QuoteList{Title: "测试清单", Status: model.QuoteListStatusQuoting, Currency: "CNY"}
	if err := db.Create(&quoteList).Error; err != nil {
		t.Fatalf("create quote list: %v", err)
	}

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodGet, "/api/v1/merchant/quote-lists/1", nil)
	c.Set("providerId", provider.ID)
	c.Params = gin.Params{{Key: "id", Value: "1"}}
	MerchantGetQuoteListDetail(c)

	envelope := decodeQuoteHandlerEnvelope(t, recorder)
	if envelope.Code != 403 {
		t.Fatalf("unexpected code: got=%d want=403", envelope.Code)
	}
}

func TestMerchantSubmitQuoteSubmission_BlockedWhenAwarded(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupQuoteHandlerDB(t)

	provider := model.Provider{ProviderType: 3, SubType: "foreman", CompanyName: "工长A"}
	if err := db.Create(&provider).Error; err != nil {
		t.Fatalf("create provider: %v", err)
	}
	quoteList := model.QuoteList{Title: "测试清单", Status: model.QuoteListStatusAwarded, Currency: "CNY"}
	if err := db.Create(&quoteList).Error; err != nil {
		t.Fatalf("create quote list: %v", err)
	}
	item := model.QuoteListItem{QuoteListID: quoteList.ID, Name: "墙地面防水", Unit: "㎡", Quantity: 6}
	if err := db.Create(&item).Error; err != nil {
		t.Fatalf("create item: %v", err)
	}
	invitation := model.QuoteInvitation{QuoteListID: quoteList.ID, ProviderID: provider.ID, Status: model.QuoteInvitationStatusInvited}
	if err := db.Create(&invitation).Error; err != nil {
		t.Fatalf("create invitation: %v", err)
	}

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/api/v1/merchant/quote-lists/1/submission/submit", bytes.NewReader([]byte(`{"items":[{"quoteListItemId":1,"unitPriceCent":1200}]}`)))
	c.Request.Header.Set("Content-Type", "application/json")
	c.Set("providerId", provider.ID)
	c.Params = gin.Params{{Key: "id", Value: "1"}}
	MerchantSubmitQuoteSubmission(c)

	envelope := decodeQuoteHandlerEnvelope(t, recorder)
	if envelope.Code != 400 {
		t.Fatalf("unexpected code: got=%d want=400", envelope.Code)
	}
}
