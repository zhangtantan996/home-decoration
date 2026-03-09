package service

import (
	"bytes"
	"log"
	"os"
	"strings"
	"testing"

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

func TestPersistSMSAudit_StoresRecordWhenTableExists(t *testing.T) {
	db := newSMSAuditTestDB(t, true)
	withRepositoryDB(t, db)

	persistSMSAudit(
		"req-success",
		SMSPurposeMerchantWithdraw,
		"13800138000",
		"127.0.0.1",
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
