package middleware

import (
	"strings"
	"testing"
)

func TestShouldAuditOpsDisplayContentMutations(t *testing.T) {
	paths := []string{
		"/api/v1/admin/providers/12",
		"/api/v1/admin/providers/12/availability",
		"/api/v1/admin/material-shops/8",
		"/api/v1/admin/material-shops/8/products/3",
		"/api/v1/admin/cases/66/inspiration",
		"/api/v1/admin/bookings/21/status",
	}

	for _, path := range paths {
		if !shouldAudit(path) {
			t.Fatalf("expected path to be audited: %s", path)
		}
	}
}

func TestMaskSensitiveFieldsRecursivelyMasksOpsPII(t *testing.T) {
	body := `{
		"phone":"13800138000",
		"contactPhone":"18612345678",
		"contactName":"张三",
		"contactEmail":"ops@example.com",
		"idCardNo":"110101199001011234",
		"officeAddress":"西安市新城区长乐路 1 号",
		"recentReauthProof":"reauth-token",
		"profile":{"businessLicenseNo":"91610100MA6ABCDEF1","captchaToken":"captcha-token"},
		"certifications":["/uploads/certs/license.png"],
		"items":[{"bankAccount":"6222020202020202020"}]
	}`

	masked := maskSensitiveFields(body)
	for _, forbidden := range []string{
		"13800138000",
		"18612345678",
		"张三",
		"ops@example.com",
		"110101199001011234",
		"西安市新城区长乐路",
		"reauth-token",
		"captcha-token",
		"91610100MA6ABCDEF1",
		"/uploads/certs/license.png",
		"6222020202020202020",
	} {
		if strings.Contains(masked, forbidden) {
			t.Fatalf("expected sensitive value %q to be masked, got %s", forbidden, masked)
		}
	}
	if !strings.Contains(masked, `"phone":"138****8000"`) {
		t.Fatalf("expected phone to be partially masked, got %s", masked)
	}
	if !strings.Contains(masked, `"officeAddress":"已脱敏"`) {
		t.Fatalf("expected address to be redacted, got %s", masked)
	}
}
