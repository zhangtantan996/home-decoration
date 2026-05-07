package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func buildSignedHMACToken(t *testing.T, claims jwt.MapClaims, secret string) string {
	t.Helper()

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString([]byte(secret))
	if err != nil {
		t.Fatalf("sign token: %v", err)
	}

	return signed
}

func buildNoneToken(t *testing.T, claims jwt.MapClaims) string {
	t.Helper()

	token := jwt.NewWithClaims(jwt.SigningMethodNone, claims)
	signed, err := token.SignedString(jwt.UnsafeAllowNoneSignatureType)
	if err != nil {
		t.Fatalf("sign none token: %v", err)
	}

	return signed
}

func performAuthRequest(t *testing.T, middleware gin.HandlerFunc, token string) *httptest.ResponseRecorder {
	t.Helper()

	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(middleware)
	r.GET("/protected", func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})

	req := httptest.NewRequest(http.MethodGet, "/protected", nil)
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}

	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	return rec
}

func performAuthRequestWithAssertion(t *testing.T, middleware gin.HandlerFunc, token string, assertCtx func(t *testing.T, c *gin.Context)) *httptest.ResponseRecorder {
	t.Helper()

	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(middleware)
	r.GET("/protected", func(c *gin.Context) {
		if assertCtx != nil {
			assertCtx(t, c)
		}
		c.Status(http.StatusNoContent)
	})

	req := httptest.NewRequest(http.MethodGet, "/protected", nil)
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}

	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	return rec
}

func withMiddlewareTestDB(t *testing.T) {
	t.Helper()

	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite db: %v", err)
	}
	if err := db.AutoMigrate(&model.SysAdmin{}); err != nil {
		t.Fatalf("auto migrate sys_admins: %v", err)
	}
	if err := db.Create(&model.SysAdmin{
		ID:       1,
		Username: "admin",
		Password: "test-password",
		Status:   1,
	}).Error; err != nil {
		t.Fatalf("seed sys_admins: %v", err)
	}

	oldDB := repository.DB
	repository.DB = db
	t.Cleanup(func() {
		repository.DB = oldDB
	})
}

func TestJWTMiddleware_RejectsRefreshToken(t *testing.T) {
	secret := "test-secret"
	token := buildSignedHMACToken(t, jwt.MapClaims{
		"userId":     float64(1),
		"activeRole": "owner",
		"token_type": "user",
		"token_use":  "refresh",
	}, secret)

	rec := performAuthRequest(t, JWT(secret), token)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", rec.Code)
	}
}

func TestJWTMiddleware_AllowsUserAccessToken(t *testing.T) {
	secret := "test-secret"
	token := buildSignedHMACToken(t, jwt.MapClaims{
		"userId":     float64(1),
		"activeRole": "owner",
		"providerId": nil,
		"token_type": "user",
		"token_use":  "access",
	}, secret)

	rec := performAuthRequest(t, JWT(secret), token)
	if rec.Code != http.StatusNoContent {
		t.Fatalf("expected 204, got %d", rec.Code)
	}
}

func TestJWTMiddleware_AllowsLegacyUserToken(t *testing.T) {
	secret := "test-secret"
	token := buildSignedHMACToken(t, jwt.MapClaims{
		"userId":   float64(1),
		"userType": float64(1),
	}, secret)

	rec := performAuthRequest(t, JWT(secret), token)
	if rec.Code != http.StatusNoContent {
		t.Fatalf("expected 204, got %d", rec.Code)
	}
}

func TestJWTMiddleware_RejectsNonHMACAlgorithm(t *testing.T) {
	secret := "test-secret"
	token := buildNoneToken(t, jwt.MapClaims{
		"userId":     float64(1),
		"activeRole": "owner",
		"token_type": "user",
		"token_use":  "access",
	})

	rec := performAuthRequest(t, JWT(secret), token)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", rec.Code)
	}
}

func TestAdminJWT_RejectsUserToken(t *testing.T) {
	secret := "test-secret"
	token := buildSignedHMACToken(t, jwt.MapClaims{
		"userId":     float64(1),
		"activeRole": "owner",
		"token_type": "user",
		"token_use":  "access",
	}, secret)

	rec := performAuthRequest(t, AdminJWT(secret), token)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", rec.Code)
	}
}

func TestAdminJWT_AllowsAdminAccessToken(t *testing.T) {
	withMiddlewareTestDB(t)

	secret := "test-secret"
	token := buildSignedHMACToken(t, jwt.MapClaims{
		"admin_id":   float64(1),
		"username":   "admin",
		"is_super":   false,
		"token_type": "admin",
		"token_use":  "access",
	}, secret)

	rec := performAuthRequest(t, AdminJWT(secret), token)
	if rec.Code != http.StatusNoContent {
		t.Fatalf("expected 204, got %d", rec.Code)
	}
}

func TestAdminJWTUsesIdentityMatchingCurrentAdminProfile(t *testing.T) {
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite db: %v", err)
	}
	if err := db.AutoMigrate(&model.SysAdmin{}, &model.User{}, &model.AdminProfile{}, &model.UserIdentity{}); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}
	if err := db.Create(&model.SysAdmin{
		ID:       1,
		Username: "admin",
		Password: "test-password",
		Status:   1,
	}).Error; err != nil {
		t.Fatalf("seed sys_admins: %v", err)
	}
	if err := db.Create(&model.User{Base: model.Base{ID: 901}, Phone: "13800901000", Status: 1}).Error; err != nil {
		t.Fatalf("seed user: %v", err)
	}
	if err := db.Create(&model.AdminProfile{
		Base:       model.Base{ID: 920},
		UserID:     901,
		SysAdminID: 1,
		AdminType:  "regular",
		Status:     1,
	}).Error; err != nil {
		t.Fatalf("seed admin profile: %v", err)
	}
	oldRef := uint64(910)
	currentRef := uint64(920)
	identities := []model.UserIdentity{
		{Base: model.Base{ID: 930}, UserID: 901, IdentityType: "admin", IdentityRefID: &oldRef, Status: 1, Verified: true},
		{Base: model.Base{ID: 931}, UserID: 901, IdentityType: "admin", IdentityRefID: &currentRef, Status: 1, Verified: true},
	}
	if err := db.Create(&identities).Error; err != nil {
		t.Fatalf("seed identities: %v", err)
	}

	oldDB := repository.DB
	repository.DB = db
	t.Cleanup(func() {
		repository.DB = oldDB
	})

	secret := "test-secret"
	token := buildSignedHMACToken(t, jwt.MapClaims{
		"admin_id":   float64(1),
		"username":   "admin",
		"is_super":   false,
		"token_type": "admin",
		"token_use":  "access",
	}, secret)

	rec := performAuthRequestWithAssertion(t, AdminJWT(secret), token, func(t *testing.T, c *gin.Context) {
		t.Helper()
		identityID := c.GetUint64("identityId")
		identityRefID := c.GetUint64("identityRefId")
		if identityID != 931 || identityRefID != currentRef {
			t.Fatalf("expected current admin identity 931/ref 920, got id=%d ref=%d", identityID, identityRefID)
		}
	})
	if rec.Code != http.StatusNoContent {
		t.Fatalf("expected 204, got %d body=%s", rec.Code, rec.Body.String())
	}
}

func TestJWTMiddleware_RejectsAdminToken(t *testing.T) {
	secret := "test-secret"
	token := buildSignedHMACToken(t, jwt.MapClaims{
		"admin_id":   float64(1),
		"username":   "admin",
		"token_type": "admin",
		"token_use":  "access",
	}, secret)

	rec := performAuthRequest(t, JWT(secret), token)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", rec.Code)
	}
}

func TestJWTMiddleware_RejectsMerchantToken(t *testing.T) {
	secret := "test-secret"
	token := buildSignedHMACToken(t, jwt.MapClaims{
		"providerId":   float64(2),
		"providerType": float64(1),
		"userId":       float64(1),
		"role":         "merchant",
		"token_type":   "merchant",
		"token_use":    "access",
	}, secret)

	rec := performAuthRequest(t, JWT(secret), token)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", rec.Code)
	}
}

func TestJWTMiddleware_AllowsProviderScopedUserTokenAndSetsProviderID(t *testing.T) {
	secret := "test-secret"
	token := buildSignedHMACToken(t, jwt.MapClaims{
		"userId":          float64(11),
		"userPublicId":    "user-public-id",
		"activeRole":      "provider",
		"providerId":      float64(22),
		"providerSubType": "foreman",
		"token_type":      "user",
		"token_use":       "access",
	}, secret)

	rec := performAuthRequestWithAssertion(t, JWT(secret), token, func(t *testing.T, c *gin.Context) {
		t.Helper()
		if got := c.GetUint64("userId"); got != 11 {
			t.Fatalf("expected userId=11, got %d", got)
		}
		if got := c.GetUint64("providerId"); got != 22 {
			t.Fatalf("expected providerId=22, got %d", got)
		}
		if got := c.GetString("activeRole"); got != "provider" {
			t.Fatalf("expected activeRole=provider, got %q", got)
		}
	})
	if rec.Code != http.StatusNoContent {
		t.Fatalf("expected 204, got %d", rec.Code)
	}
}

func TestAdminJWT_RejectsRefreshToken(t *testing.T) {
	secret := "test-secret"
	token := buildSignedHMACToken(t, jwt.MapClaims{
		"admin_id":   float64(1),
		"username":   "admin",
		"token_type": "admin",
		"token_use":  "refresh",
	}, secret)

	rec := performAuthRequest(t, AdminJWT(secret), token)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", rec.Code)
	}
}

func TestMerchantJWT_RejectsUserToken(t *testing.T) {
	secret := "test-secret"
	token := buildSignedHMACToken(t, jwt.MapClaims{
		"userId":     float64(1),
		"activeRole": "owner",
		"token_type": "user",
		"token_use":  "access",
	}, secret)

	rec := performAuthRequest(t, MerchantJWT(secret), token)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", rec.Code)
	}
}

func TestMerchantJWT_AllowsMerchantAccessToken(t *testing.T) {
	secret := "test-secret"
	token := buildSignedHMACToken(t, jwt.MapClaims{
		"providerId":   float64(2),
		"providerType": float64(1),
		"userId":       float64(1),
		"phone":        "13800138000",
		"role":         "merchant",
		"token_type":   "merchant",
		"token_use":    "access",
	}, secret)

	rec := performAuthRequest(t, MerchantJWT(secret), token)
	if rec.Code != http.StatusNoContent {
		t.Fatalf("expected 204, got %d", rec.Code)
	}
}

func TestMerchantJWT_AllowsMerchantTokenWithNilUnifiedIdentityClaims(t *testing.T) {
	secret := "test-secret"
	token := buildSignedHMACToken(t, jwt.MapClaims{
		"providerId":    float64(2),
		"providerType":  float64(1),
		"userId":        float64(1),
		"phone":         "13800138000",
		"role":          "merchant",
		"token_type":    "merchant",
		"token_use":     "access",
		"identityId":    nil,
		"identityRefId": nil,
	}, secret)

	rec := performAuthRequestWithAssertion(t, MerchantJWT(secret), token, func(t *testing.T, c *gin.Context) {
		t.Helper()
		if got := c.GetUint64("providerId"); got != 2 {
			t.Fatalf("expected providerId=2, got %d", got)
		}
		if _, exists := c.Get("identityId"); exists {
			t.Fatalf("expected identityId not set when claim is nil")
		}
		if _, exists := c.Get("identityRefId"); exists {
			t.Fatalf("expected identityRefId not set when claim is nil")
		}
	})
	if rec.Code != http.StatusNoContent {
		t.Fatalf("expected 204, got %d", rec.Code)
	}
}

func TestMerchantJWT_RejectsRefreshToken(t *testing.T) {
	secret := "test-secret"
	token := buildSignedHMACToken(t, jwt.MapClaims{
		"providerId":   float64(2),
		"providerType": float64(1),
		"userId":       float64(1),
		"role":         "merchant",
		"token_type":   "merchant",
		"token_use":    "refresh",
	}, secret)

	rec := performAuthRequest(t, MerchantJWT(secret), token)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", rec.Code)
	}
}
