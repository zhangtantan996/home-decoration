package service

import "testing"

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
