package service

import (
	"bytes"
	"fmt"
	"log"
	"os"
	"strings"
	"testing"
	"time"

	"home-decoration-server/internal/config"
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func newSMSAuditTestDB(t *testing.T, withTable bool) *gorm.DB {
	t.Helper()

	dsn := "file:" + strings.ReplaceAll(t.Name(), "/", "_") + "?mode=memory&cache=shared"
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite db: %v", err)
	}
	if withTable {
		if err := db.AutoMigrate(&model.SMSAuditLog{}); err != nil {
			t.Fatalf("auto migrate sms audit log: %v", err)
		}
	}
	return db
}

func withRepositoryDB(t *testing.T, db *gorm.DB) {
	t.Helper()
	oldDB := repository.DB
	repository.DB = db
	t.Cleanup(func() {
		repository.DB = oldDB
	})
}

func captureLogs(t *testing.T) (*bytes.Buffer, func()) {
	t.Helper()
	buf := &bytes.Buffer{}
	oldWriter := log.Writer()
	log.SetOutput(buf)
	return buf, func() {
		log.SetOutput(oldWriter)
	}
}

func resetSMSServiceState(t *testing.T) *SMSService {
	t.Helper()

	service := GetSMSService()
	oldRedis := repository.RedisClient
	oldPhoneRecords := service.phoneRecords
	oldIPRecords := service.ipRecords
	oldWindowRecords := service.windowRecords
	oldPenaltyUntil := service.penaltyUntil
	oldPenaltyStrike := service.penaltyStrike

	repository.RedisClient = nil
	service.mu.Lock()
	service.phoneRecords = make(map[string]*SMSRecord)
	service.ipRecords = make(map[string][]time.Time)
	service.windowRecords = make(map[string][]time.Time)
	service.penaltyUntil = make(map[string]time.Time)
	service.penaltyStrike = make(map[string]int)
	service.mu.Unlock()

	t.Cleanup(func() {
		repository.RedisClient = oldRedis
		service.mu.Lock()
		service.phoneRecords = oldPhoneRecords
		service.ipRecords = oldIPRecords
		service.windowRecords = oldWindowRecords
		service.penaltyUntil = oldPenaltyUntil
		service.penaltyStrike = oldPenaltyStrike
		service.mu.Unlock()
	})

	return service
}

func withSMSConfigForTest(t *testing.T, mutate func(cfg *config.Config)) {
	t.Helper()

	cfg := config.GetConfig()
	oldSMS := cfg.SMS
	mutate(cfg)
	t.Cleanup(func() {
		cfg.SMS = oldSMS
	})
}

func TestVerifySMSCode_FixedMode(t *testing.T) {
	t.Setenv("SMS_FIXED_CODE_MODE", "true")
	t.Setenv("SMS_FIXED_CODE", "123456")

	if err := VerifySMSCode("13800138000", SMSPurposeIdentityApply, "123456"); err != nil {
		t.Fatalf("expected fixed code verification success, got error: %v", err)
	}

	if err := VerifySMSCode("13800138000", SMSPurposeIdentityApply, "000000"); err == nil {
		t.Fatalf("expected fixed code verification failure for wrong code")
	}
}

func TestSendSMSCode_FixedMode(t *testing.T) {
	t.Setenv("SMS_FIXED_CODE_MODE", "true")
	t.Setenv("SMS_FIXED_CODE", "123456")

	result, err := SendSMSCode("13800138000", SMSPurposeMerchantWithdraw, "127.0.0.1", "")
	if err != nil {
		t.Fatalf("expected send code success in fixed mode, got error: %v", err)
	}
	if result == nil {
		t.Fatalf("expected result not nil")
	}
	if !result.DebugOnly {
		t.Fatalf("expected DebugOnly=true in fixed mode")
	}
	if result.DebugCode != "123456" {
		t.Fatalf("expected fixed debug code 123456, got %s", result.DebugCode)
	}
}

func TestNormalizeSMSPurpose_RejectsResetPassword(t *testing.T) {
	if _, err := NormalizeSMSPurpose("reset_password"); err == nil {
		t.Fatalf("expected reset_password to be rejected")
	}
}

func TestSMSProviderUserFacingError_BusinessLimit(t *testing.T) {
	message := smsProviderUserFacingError(&SMSProviderError{
		Code:    "isv.BUSINESS_LIMIT_CONTROL",
		Message: "触发号码天级流控",
	})
	if message != "该手机号今日验证码发送次数已达上限，请明日再试" {
		t.Fatalf("unexpected business limit message: %q", message)
	}
}

func TestSMSProviderUserFacingError_Unknown(t *testing.T) {
	message := smsProviderUserFacingError(&SMSProviderError{
		Code:    "isv.UNKNOWN",
		Message: "unknown",
	})
	if message != "" {
		t.Fatalf("expected empty message for unknown provider error, got %q", message)
	}
}

func TestSMSCodePurposeIsolation_UsesDistinctKeysAndHashes(t *testing.T) {
	phone := "13800138000"
	code := "123456"
	nonce := "nonce"

	if smsCodeKey(phone, SMSPurposeLogin) == smsCodeKey(phone, SMSPurposeRegister) {
		t.Fatalf("expected purpose-specific redis keys")
	}
	if hashSMSCode(phone, SMSPurposeLogin, code, nonce) == hashSMSCode(phone, SMSPurposeRegister, code, nonce) {
		t.Fatalf("expected purpose-specific hashes to differ")
	}
}

func TestSMSRiskTierThresholdsDiffer(t *testing.T) {
	service := resetSMSServiceState(t)
	withSMSConfigForTest(t, func(cfg *config.Config) {
		cfg.SMS.RiskEnabled = true
		cfg.SMS.PhoneDailyLimit = 100
		cfg.SMS.IPDailyLimit = 100
	})

	highLimit := smsRiskThresholdForDimension(SMSRiskTierHigh, riskDimensionIP)
	lowLimit := smsRiskThresholdForDimension(SMSRiskTierLow, riskDimensionIP)
	if lowLimit <= highLimit {
		t.Fatalf("expected low tier threshold > high tier threshold, got low=%d high=%d", lowLimit, highLimit)
	}

	ip := "127.0.0.1"
	for i := 0; i < highLimit; i++ {
		phone := fmt.Sprintf("13800138%03d", i)
		if err := service.CanSendCode(phone, ip, string(SMSPurposeMerchantWithdraw), SMSRiskTierHigh); err != nil {
			t.Fatalf("unexpected high tier pre-limit error at %d: %v", i, err)
		}
		service.RecordSent(phone, ip, string(SMSPurposeMerchantWithdraw), SMSRiskTierHigh)
	}
	if err := service.CanSendCode("13800138999", ip, string(SMSPurposeMerchantWithdraw), SMSRiskTierHigh); err == nil {
		t.Fatalf("expected high tier to hit risk limit")
	}

	service = resetSMSServiceState(t)
	for i := 0; i < highLimit; i++ {
		phone := fmt.Sprintf("13900138%03d", i)
		if err := service.CanSendCode(phone, ip, string(SMSPurposeLogin), SMSRiskTierLow); err != nil {
			t.Fatalf("unexpected low tier error before high tier boundary at %d: %v", i, err)
		}
		service.RecordSent(phone, ip, string(SMSPurposeLogin), SMSRiskTierLow)
	}
	if err := service.CanSendCode("13900138999", ip, string(SMSPurposeLogin), SMSRiskTierLow); err != nil {
		t.Fatalf("expected low tier to remain allowed at high tier boundary, got %v", err)
	}
	service.RecordSent("13900138999", ip, string(SMSPurposeLogin), SMSRiskTierLow)
	for i := highLimit + 1; i < lowLimit; i++ {
		phone := fmt.Sprintf("13700138%03d", i)
		if err := service.CanSendCode(phone, ip, string(SMSPurposeLogin), SMSRiskTierLow); err != nil {
			t.Fatalf("unexpected low tier error at %d: %v", i, err)
		}
		service.RecordSent(phone, ip, string(SMSPurposeLogin), SMSRiskTierLow)
	}
	if err := service.CanSendCode("13700138999", ip, string(SMSPurposeLogin), SMSRiskTierLow); err == nil {
		t.Fatalf("expected low tier to hit risk limit after its own threshold")
	}
}

func TestResolveSMSTemplateContext_FallbackPriority(t *testing.T) {
	withSMSConfigForTest(t, func(cfg *config.Config) {
		cfg.SMS.TemplateCode = "SMS_DEFAULT"
		cfg.SMS.TemplateCodeLow = "SMS_LOW"
		cfg.SMS.TemplateCodeMedium = "SMS_MEDIUM"
		cfg.SMS.TemplateCodeLogin = "SMS_LOGIN"
		cfg.SMS.TemplateCodeHigh = ""
		cfg.SMS.TemplateCodeDeleteAccount = ""
	})

	loginTemplate, err := ResolveSMSTemplateContext(SMSPurposeLogin, &config.GetConfig().SMS)
	if err != nil {
		t.Fatalf("resolve login template: %v", err)
	}
	if loginTemplate.TemplateKey != "purpose.login" || loginTemplate.TemplateCode != "SMS_LOGIN" {
		t.Fatalf("unexpected login template context: %+v", loginTemplate)
	}

	identityTemplate, err := ResolveSMSTemplateContext(SMSPurposeIdentityApply, &config.GetConfig().SMS)
	if err != nil {
		t.Fatalf("resolve identity template: %v", err)
	}
	if identityTemplate.TemplateKey != "risk.medium" || identityTemplate.TemplateCode != "SMS_MEDIUM" {
		t.Fatalf("unexpected identity template context: %+v", identityTemplate)
	}

	deleteTemplate, err := ResolveSMSTemplateContext(SMSPurposeDeleteAccount, &config.GetConfig().SMS)
	if err != nil {
		t.Fatalf("resolve delete template: %v", err)
	}
	if deleteTemplate.TemplateKey != "default" || deleteTemplate.TemplateCode != "SMS_DEFAULT" {
		t.Fatalf("unexpected delete template context: %+v", deleteTemplate)
	}
}

func TestPersistSMSAudit_StoresRecordWhenTableExists(t *testing.T) {
	db := newSMSAuditTestDB(t, true)
	withRepositoryDB(t, db)

	persistSMSAudit(
		"req-success",
		SMSPurposeMerchantWithdraw,
		"13800138000",
		"127.0.0.1",
		SMSTemplateContext{RiskTier: SMSRiskTierHigh, TemplateKey: "purpose.merchant_withdraw", TemplateCode: "SMS_TPL_001"},
		SMSProviderResult{Provider: "aliyun", MessageID: "msg-1", RequestID: "provider-1"},
		"sent",
		"",
		"",
	)

	var record model.SMSAuditLog
	if err := db.Where("request_id = ?", "req-success").First(&record).Error; err != nil {
		t.Fatalf("expected persisted sms audit log, got error: %v", err)
	}
	if record.Provider != "aliyun" {
		t.Fatalf("expected provider aliyun, got %s", record.Provider)
	}
	if record.PhoneHash == "" || record.PhoneHash == "13800138000" {
		t.Fatalf("expected hashed phone number, got %s", record.PhoneHash)
	}
	if record.Status != "sent" {
		t.Fatalf("expected status sent, got %s", record.Status)
	}
	if record.RiskTier != string(SMSRiskTierHigh) || record.TemplateKey != "purpose.merchant_withdraw" || record.TemplateCode != "SMS_TPL_001" {
		t.Fatalf("expected audit context persisted, got %+v", record)
	}
}

func TestPersistSMSAudit_LogsDegradedContextWhenTableMissing(t *testing.T) {
	db := newSMSAuditTestDB(t, false)
	withRepositoryDB(t, db)
	buf, restoreLogs := captureLogs(t)
	defer restoreLogs()
	defer log.SetOutput(os.Stderr)

	persistSMSAudit(
		"req-missing",
		SMSPurposeMerchantWithdraw,
		"13800138000",
		"127.0.0.1",
		SMSTemplateContext{RiskTier: SMSRiskTierHigh, TemplateKey: "risk.high", TemplateCode: "SMS_TPL_HIGH"},
		SMSProviderResult{Provider: "aliyun", MessageID: "msg-2", RequestID: "provider-2"},
		"sent",
		"",
		"",
	)

	output := buf.String()
	for _, fragment := range []string{
		"[SMS-AUDIT] persist failed:",
		"requestId=req-missing",
		"provider=aliyun",
		"status=sent",
		"tableMissing=true",
		"dbErrType=missing_table",
	} {
		if !strings.Contains(output, fragment) {
			t.Fatalf("expected log to contain %q, got %s", fragment, output)
		}
	}
}
