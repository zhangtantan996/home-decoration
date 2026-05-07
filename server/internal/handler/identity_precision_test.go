package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"

	"github.com/gin-gonic/gin"
)

func setupIdentityPrecisionHandlerDB(t *testing.T) {
	t.Helper()

	db := setupRawSQLiteDB(t)
	migrateHandlerRuntimeTestSchema(t, db, &model.AdminProfile{}, &model.SupervisorProfile{}, &model.Worker{})

	previousDB := repository.DB
	repository.DB = db
	t.Cleanup(func() {
		repository.DB = previousDB
	})
}

func TestEnsureMerchantIdentityUpdatesOnlyMatchingIdentityRef(t *testing.T) {
	setupIdentityPrecisionHandlerDB(t)

	const userID = uint64(7101)
	const adminID = uint64(9101)
	firstRef := uint64(8101)
	secondRef := uint64(8102)

	if err := repository.DB.Create(&model.User{Base: model.Base{ID: userID}, Phone: "13800710100", Status: 1}).Error; err != nil {
		t.Fatalf("seed user: %v", err)
	}
	identities := []model.UserIdentity{
		{Base: model.Base{ID: 7201}, UserID: userID, IdentityType: merchantIdentityTypeProvider, IdentityRefID: &firstRef, Status: 3, Verified: false},
		{Base: model.Base{ID: 7202}, UserID: userID, IdentityType: merchantIdentityTypeProvider, IdentityRefID: &secondRef, Status: 1, Verified: true},
	}
	if err := repository.DB.Create(&identities).Error; err != nil {
		t.Fatalf("seed identities: %v", err)
	}

	if err := ensureMerchantIdentity(repository.DB, userID, merchantIdentityTypeProvider, firstRef, adminID, merchantIdentityStatusActive); err != nil {
		t.Fatalf("ensure merchant identity: %v", err)
	}

	var first, second model.UserIdentity
	if err := repository.DB.First(&first, identities[0].ID).Error; err != nil {
		t.Fatalf("load first identity: %v", err)
	}
	if err := repository.DB.First(&second, identities[1].ID).Error; err != nil {
		t.Fatalf("load second identity: %v", err)
	}
	if first.IdentityRefID == nil || *first.IdentityRefID != firstRef || first.Status != merchantIdentityStatusActive || !first.Verified {
		t.Fatalf("expected first identity activated in place, got %+v", first)
	}
	if second.IdentityRefID == nil || *second.IdentityRefID != secondRef {
		t.Fatalf("expected second identity ref untouched, got %+v", second)
	}
}

func TestGetCurrentIdentityUsesTokenIdentityID(t *testing.T) {
	gin.SetMode(gin.TestMode)
	setupIdentityPrecisionHandlerDB(t)

	const userID = uint64(7301)
	firstProviderRef := uint64(8301)
	secondProviderRef := uint64(8302)
	firstIdentityID := uint64(7401)
	secondIdentityID := uint64(7402)

	if err := repository.DB.Create(&model.User{Base: model.Base{ID: userID}, Phone: "13800730100", Status: 1}).Error; err != nil {
		t.Fatalf("seed user: %v", err)
	}
	providers := []model.Provider{
		{Base: model.Base{ID: firstProviderRef}, UserID: userID, ProviderType: 1, DisplayName: "第一服务商", Status: 1},
		{Base: model.Base{ID: secondProviderRef}, UserID: userID, ProviderType: 3, DisplayName: "第二服务商", Status: 1},
	}
	if err := repository.DB.Create(&providers).Error; err != nil {
		t.Fatalf("seed providers: %v", err)
	}
	identities := []model.UserIdentity{
		{Base: model.Base{ID: firstIdentityID}, UserID: userID, IdentityType: "provider", IdentityRefID: &firstProviderRef, Status: 1, Verified: true},
		{Base: model.Base{ID: secondIdentityID}, UserID: userID, IdentityType: "provider", IdentityRefID: &secondProviderRef, Status: 1, Verified: true},
	}
	if err := repository.DB.Create(&identities).Error; err != nil {
		t.Fatalf("seed identities: %v", err)
	}

	router := gin.New()
	router.GET("/api/v1/identity/current", func(c *gin.Context) {
		c.Set("userId", userID)
		c.Set("activeRole", "provider")
		c.Set("identityId", secondIdentityID)
		c.Set("identityRefId", secondProviderRef)
		GetCurrentIdentity(c)
	})

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/identity/current", nil)
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", rec.Code, rec.Body.String())
	}
	resp := decodeResponse(t, rec)
	if resp.Code != 0 {
		t.Fatalf("expected success code, got=%d message=%s", resp.Code, resp.Message)
	}

	var data struct {
		ID       uint64 `json:"id"`
		RefID    uint64 `json:"refId"`
		Provider struct {
			ID          uint64 `json:"id"`
			DisplayName string `json:"displayName"`
		} `json:"provider"`
	}
	if err := json.Unmarshal(resp.Data, &data); err != nil {
		t.Fatalf("decode current identity data: %v", err)
	}
	if data.ID != secondIdentityID || data.RefID != secondProviderRef || data.Provider.ID != secondProviderRef {
		t.Fatalf("expected second provider identity, got %+v", data)
	}
}

func TestGetCurrentIdentityDoesNotFallbackWhenTokenIdentityIDIsStale(t *testing.T) {
	gin.SetMode(gin.TestMode)
	setupIdentityPrecisionHandlerDB(t)

	const userID = uint64(7501)
	providerRef := uint64(8501)
	identityID := uint64(7601)

	if err := repository.DB.Create(&model.User{Base: model.Base{ID: userID}, Phone: "13800750100", Status: 1}).Error; err != nil {
		t.Fatalf("seed user: %v", err)
	}
	if err := repository.DB.Create(&model.Provider{Base: model.Base{ID: providerRef}, UserID: userID, ProviderType: 1, DisplayName: "服务商", Status: 1}).Error; err != nil {
		t.Fatalf("seed provider: %v", err)
	}
	if err := repository.DB.Create(&model.UserIdentity{
		Base:          model.Base{ID: identityID},
		UserID:        userID,
		IdentityType:  "provider",
		IdentityRefID: &providerRef,
		Status:        1,
		Verified:      true,
	}).Error; err != nil {
		t.Fatalf("seed identity: %v", err)
	}

	router := gin.New()
	router.GET("/api/v1/identity/current", func(c *gin.Context) {
		c.Set("userId", userID)
		c.Set("activeRole", "provider")
		c.Set("identityId", uint64(999999))
		GetCurrentIdentity(c)
	})

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/identity/current", nil)
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404 for stale identityId, got %d body=%s", rec.Code, rec.Body.String())
	}
	resp := decodeResponse(t, rec)
	if resp.Message != "身份不存在" {
		t.Fatalf("expected safe not found message, got %q", resp.Message)
	}
}
