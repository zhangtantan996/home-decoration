package service

import (
	"fmt"
	"os"
	"strings"

	"home-decoration-server/pkg/utils"
)

type VerificationResult struct {
	Passed bool
	Reason string
}

type IDCardVerifier interface {
	Verify(idNo, realName string) VerificationResult
}

type LicenseVerifier interface {
	Verify(licenseNo, companyName string) VerificationResult
}

type ManualIDCardVerifier struct{}

func (ManualIDCardVerifier) Verify(idNo, _ string) VerificationResult {
	if !utils.ValidateIDCard(strings.TrimSpace(idNo)) {
		return VerificationResult{Passed: false, Reason: "身份证号格式不正确"}
	}
	return VerificationResult{Passed: true}
}

type ManualLicenseVerifier struct{}

func (ManualLicenseVerifier) Verify(licenseNo, companyName string) VerificationResult {
	licenseNo = strings.TrimSpace(licenseNo)
	companyName = strings.TrimSpace(companyName)
	if licenseNo == "" {
		return VerificationResult{Passed: false, Reason: "请填写营业执照号"}
	}
	normalized := utils.NormalizeLicenseNo(licenseNo)
	if !utils.ValidateBusinessLicenseNo(normalized) {
		return VerificationResult{Passed: false, Reason: "统一社会信用代码/营业执照号格式不正确"}
	}
	if companyName != "" && !utils.ValidateCompanyName(companyName) {
		return VerificationResult{Passed: false, Reason: "名称长度应在2-100个字符之间"}
	}
	return VerificationResult{Passed: true}
}

func resolveVerificationProvider(envKey string) string {
	provider := strings.ToLower(strings.TrimSpace(os.Getenv(envKey)))
	if provider == "" {
		return "manual"
	}
	return provider
}

func VerifyIDCardForApply(idNo, realName string) error {
	switch resolveVerificationProvider("ID_CARD_VERIFY_PROVIDER") {
	case "manual":
		result := (ManualIDCardVerifier{}).Verify(idNo, realName)
		if !result.Passed {
			return fmt.Errorf(result.Reason)
		}
		return nil
	default:
		result := (ManualIDCardVerifier{}).Verify(idNo, realName)
		if !result.Passed {
			return fmt.Errorf(result.Reason)
		}
		return nil
	}
}

func VerifyLicenseForApply(licenseNo, companyName string) error {
	switch resolveVerificationProvider("LICENSE_VERIFY_PROVIDER") {
	case "manual":
		result := (ManualLicenseVerifier{}).Verify(licenseNo, companyName)
		if !result.Passed {
			return fmt.Errorf(result.Reason)
		}
		return nil
	default:
		result := (ManualLicenseVerifier{}).Verify(licenseNo, companyName)
		if !result.Passed {
			return fmt.Errorf(result.Reason)
		}
		return nil
	}
}
