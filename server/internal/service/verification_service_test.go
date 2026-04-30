package service

import (
	"strings"
	"testing"
)

type countingLicenseVerifier struct {
	calls  int
	result VerificationResult
}

func (v *countingLicenseVerifier) Verify(_, _ string) VerificationResult {
	v.calls++
	return v.result
}

func TestVerifyLicenseForApplyRejectsInvalidInputBeforeProvider(t *testing.T) {
	resetVerificationRiskLimiterForTest()
	counter := &countingLicenseVerifier{result: VerificationResult{Passed: true}}
	oldResolver := resolveLicenseVerifierFunc
	resolveLicenseVerifierFunc = func() LicenseVerifier { return counter }
	t.Cleanup(func() { resolveLicenseVerifierFunc = oldResolver })

	err := VerifyLicenseForApplyWithContext(EnterpriseVerificationContext{
		ApplicationType: "merchant",
		ApplicationID:   1,
		CompanyName:     "A",
		LicenseNo:       "bad-license",
		ClientIP:        "203.0.113.20",
	})
	if err == nil || !strings.Contains(err.Error(), "企业信息") {
		t.Fatalf("expected business input error, got %v", err)
	}
	if counter.calls != 0 {
		t.Fatalf("provider should not be called for invalid input, got %d", counter.calls)
	}
}

func TestVerifyLicenseForApplyCoolsDownSameFailedInput(t *testing.T) {
	resetVerificationRiskLimiterForTest()
	counter := &countingLicenseVerifier{result: VerificationResult{Reason: "认证信息不一致，请核对后重试"}}
	oldResolver := resolveLicenseVerifierFunc
	resolveLicenseVerifierFunc = func() LicenseVerifier { return counter }
	t.Cleanup(func() { resolveLicenseVerifierFunc = oldResolver })

	ctx := EnterpriseVerificationContext{
		ApplicationType: "merchant",
		ApplicationID:   2,
		CompanyName:     "西安示例装饰有限公司",
		LicenseNo:       "110105000000123",
		ClientIP:        "203.0.113.21",
	}
	if err := VerifyLicenseForApplyWithContext(ctx); err == nil {
		t.Fatalf("expected first mismatch to fail")
	}
	if err := VerifyLicenseForApplyWithContext(ctx); err == nil || !strings.Contains(err.Error(), "频繁") {
		t.Fatalf("expected cooldown error, got %v", err)
	}
	if counter.calls != 1 {
		t.Fatalf("expected provider called once, got %d", counter.calls)
	}
}

func TestCanReuseEnterpriseLicenseVerification(t *testing.T) {
	hash := EnterpriseLicenseHash("110105000000123")
	if !CanReuseEnterpriseLicenseVerification("verified", hash, "西安示例装饰有限公司", "西安示例装饰有限公司", "110105000000123") {
		t.Fatalf("expected unchanged verified license to be reusable")
	}
	if CanReuseEnterpriseLicenseVerification("failed", hash, "西安示例装饰有限公司", "西安示例装饰有限公司", "110105000000123") {
		t.Fatalf("failed verification must not be reused")
	}
	if CanReuseEnterpriseLicenseVerification("verified", hash, "西安示例装饰有限公司", "西安其他装饰有限公司", "110105000000123") {
		t.Fatalf("changed company name must not be reused")
	}
}
