package service

import (
	"strings"
	"testing"
	"time"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"

	gormsqlite "gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

type countingRealNameVerifier struct {
	calls  int
	result RealNameVerificationResult
}

func (v *countingRealNameVerifier) Verify(_, _ string) RealNameVerificationResult {
	v.calls++
	return v.result
}

func setupUserRealNameVerificationDB(t *testing.T) *gorm.DB {
	t.Helper()

	db, err := gorm.Open(gormsqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite db: %v", err)
	}
	if err := db.AutoMigrate(&model.User{}, &model.UserVerification{}); err != nil {
		t.Fatalf("migrate sqlite db: %v", err)
	}

	previousDB := repository.DB
	repository.DB = db
	t.Cleanup(func() {
		repository.DB = previousDB
	})
	return db
}

func TestSubmitRealNameVerificationStoresSafeFields(t *testing.T) {
	t.Setenv("APP_ENV", "local")
	t.Setenv("USER_REAL_NAME_VERIFY_PROVIDER", "fake")
	db := setupUserRealNameVerificationDB(t)

	user := model.User{Base: model.Base{ID: 10}, Phone: "13800138000", Status: 1}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}

	view, err := (&UserSettingsService{}).SubmitRealNameVerification(user.ID, "张三", "11010519491231002X")
	if err != nil {
		t.Fatalf("SubmitRealNameVerification: %v", err)
	}
	if view.Status != "verified" || view.RealNameMasked != "张*" || view.IDCardLast4 != "002X" {
		t.Fatalf("unexpected safe view: %+v", view)
	}

	var stored model.UserVerification
	if err := db.First(&stored, "user_id = ?", user.ID).Error; err != nil {
		t.Fatalf("load stored verification: %v", err)
	}
	if stored.RealName == "张三" || stored.IDCard == "11010519491231002X" {
		t.Fatalf("stored raw identity data: %+v", stored)
	}
	if stored.IDCardHash == "" || stored.IDCardLast4 != "002X" || stored.Status != userVerificationStatusVerified {
		t.Fatalf("missing verification fields: %+v", stored)
	}
}

func TestRequireUserVerifiedForMoneyAction(t *testing.T) {
	db := setupUserRealNameVerificationDB(t)
	user := model.User{Base: model.Base{ID: 20}, Phone: "13800138001", Status: 1}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}

	if err := RequireUserVerifiedForMoneyAction(user.ID); err != ErrRealNameRequired {
		t.Fatalf("expected ErrRealNameRequired, got %v", err)
	}

	now := time.Now()
	verified := model.UserVerification{
		UserID:         user.ID,
		RealName:       "李*",
		RealNameMasked: "李*",
		IDCard:         "1234",
		IDCardLast4:    "1234",
		IDCardHash:     "hash",
		Status:         userVerificationStatusVerified,
		VerifyMethod:   "id_card_two_factor",
		Provider:       "fake",
		VerifiedAt:     &now,
	}
	if err := db.Create(&verified).Error; err != nil {
		t.Fatalf("create verification: %v", err)
	}
	if err := RequireUserVerifiedForMoneyAction(user.ID); err != nil {
		t.Fatalf("expected verified user to pass, got %v", err)
	}
}

func TestSubmitRealNameVerificationReusesVerifiedRecordWithoutProviderCall(t *testing.T) {
	db := setupUserRealNameVerificationDB(t)
	resetVerificationRiskLimiterForTest()
	user := model.User{Base: model.Base{ID: 30}, Phone: "13800138002", Status: 1}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}
	now := time.Now()
	verified := model.UserVerification{
		UserID:         user.ID,
		RealNameMasked: "王*",
		IDCardLast4:    "002X",
		IDCardHash:     hashIDCard("11010519491231002X"),
		Status:         userVerificationStatusVerified,
		VerifyMethod:   "id_card_two_factor",
		Provider:       "aliyun",
		VerifiedAt:     &now,
	}
	if err := db.Create(&verified).Error; err != nil {
		t.Fatalf("create verification: %v", err)
	}

	counter := &countingRealNameVerifier{result: RealNameVerificationResult{Passed: true, Provider: "aliyun"}}
	oldResolver := resolveRealNameVerifierFunc
	resolveRealNameVerifierFunc = func() RealNameVerifier { return counter }
	t.Cleanup(func() { resolveRealNameVerifierFunc = oldResolver })

	view, err := (&UserSettingsService{}).SubmitRealNameVerificationForClient(user.ID, "王五", "11010519491231002X", "203.0.113.10")
	if err != nil {
		t.Fatalf("SubmitRealNameVerificationForClient: %v", err)
	}
	if view.Status != "verified" || counter.calls != 0 {
		t.Fatalf("expected verified reuse without provider call, view=%+v calls=%d", view, counter.calls)
	}
}

func TestSubmitRealNameVerificationCoolsDownSameFailedInput(t *testing.T) {
	db := setupUserRealNameVerificationDB(t)
	resetVerificationRiskLimiterForTest()
	user := model.User{Base: model.Base{ID: 31}, Phone: "13800138003", Status: 1}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}

	counter := &countingRealNameVerifier{result: RealNameVerificationResult{Provider: "aliyun", Reason: "认证信息不一致，请核对后重试"}}
	oldResolver := resolveRealNameVerifierFunc
	resolveRealNameVerifierFunc = func() RealNameVerifier { return counter }
	t.Cleanup(func() { resolveRealNameVerifierFunc = oldResolver })

	if _, err := (&UserSettingsService{}).SubmitRealNameVerificationForClient(user.ID, "王五", "11010519491231002X", "203.0.113.11"); err != nil {
		t.Fatalf("first failed verification should persist failed result, got %v", err)
	}
	if _, err := (&UserSettingsService{}).SubmitRealNameVerificationForClient(user.ID, "王五", "11010519491231002X", "203.0.113.11"); err == nil || !strings.Contains(err.Error(), "请核对后稍后再试") {
		t.Fatalf("expected cooldown error, got %v", err)
	}
	if counter.calls != 1 {
		t.Fatalf("expected provider called once, got %d", counter.calls)
	}
}
