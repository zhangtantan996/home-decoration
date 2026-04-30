package service

import (
	"errors"
	"os"
	"strings"
	"time"

	"home-decoration-server/pkg/utils"
)

type VerificationResult struct {
	Passed            bool
	Reason            string
	Provider          string
	ProviderRequestID string
	Unavailable       bool
}

type IDCardVerifier interface {
	Verify(idNo, realName string) VerificationResult
}

type LicenseVerifier interface {
	Verify(licenseNo, companyName string) VerificationResult
}

type EnterpriseVerificationContext struct {
	ApplicationType string
	ApplicationID   uint64
	ActorKey        string
	CompanyName     string
	LicenseNo       string
	ClientIP        string
}

type EnterpriseVerificationOutcome struct {
	Status            string
	Provider          string
	ProviderRequestID string
	RejectReason      string
	LicenseHash       string
	VerifiedAt        *time.Time
}

func EnterpriseLicenseHash(licenseNo string) string {
	return hashVerificationValue(utils.NormalizeLicenseNo(licenseNo))
}

func CanReuseEnterpriseLicenseVerification(status, storedLicenseHash, storedCompanyName, nextCompanyName, nextLicenseNo string) bool {
	return strings.TrimSpace(status) == "verified" &&
		strings.TrimSpace(storedLicenseHash) != "" &&
		strings.TrimSpace(storedLicenseHash) == EnterpriseLicenseHash(nextLicenseNo) &&
		strings.TrimSpace(storedCompanyName) == strings.TrimSpace(nextCompanyName)
}

var resolveLicenseVerifierFunc = resolveLicenseVerifier

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
	return VerificationResult{Passed: true, Provider: "manual"}
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
			return errors.New(result.Reason)
		}
		return nil
	default:
		result := (ManualIDCardVerifier{}).Verify(idNo, realName)
		if !result.Passed {
			return errors.New(result.Reason)
		}
		return nil
	}
}

func VerifyLicenseForApply(licenseNo, companyName string) error {
	return VerifyLicenseForApplyWithContext(EnterpriseVerificationContext{
		ApplicationType: "apply",
		CompanyName:     companyName,
		LicenseNo:       licenseNo,
	})
}

func ValidateLicenseInputForApply(licenseNo, companyName string) error {
	result := (ManualLicenseVerifier{}).Verify(licenseNo, companyName)
	if !result.Passed {
		return errors.New(result.Reason)
	}
	return nil
}

func VerifyLicenseForApplyWithContext(ctx EnterpriseVerificationContext) error {
	_, err := VerifyLicenseForApplyWithContextResult(ctx)
	return err
}

func VerifyLicenseForApplyWithContextResult(ctx EnterpriseVerificationContext) (*EnterpriseVerificationOutcome, error) {
	licenseNo := utils.NormalizeLicenseNo(ctx.LicenseNo)
	companyName := strings.TrimSpace(ctx.CompanyName)
	localResult := (ManualLicenseVerifier{}).Verify(licenseNo, companyName)
	if !localResult.Passed {
		return nil, errors.New("请填写正确的企业信息")
	}

	inputHash := enterpriseVerificationInputHash(companyName, licenseNo)
	licenseHash := hashVerificationValue(licenseNo)
	if hasEnterpriseVerificationSuccess(inputHash) {
		now := time.Now()
		return &EnterpriseVerificationOutcome{
			Status:      "verified",
			Provider:    "cache",
			LicenseHash: licenseHash,
			VerifiedAt:  &now,
		}, nil
	}
	if err := checkEnterpriseVerificationRisk(strings.TrimSpace(ctx.ApplicationType), ctx.ApplicationID, ctx.ActorKey, licenseHash, inputHash, ctx.ClientIP); err != nil {
		return nil, err
	}

	result := resolveLicenseVerifierFunc().Verify(licenseNo, companyName)
	recordEnterpriseVerificationAttempt(strings.TrimSpace(ctx.ApplicationType), ctx.ApplicationID, ctx.ActorKey, licenseHash, inputHash, ctx.ClientIP, result.Passed, result.Unavailable)
	if result.Passed {
		now := time.Now()
		return &EnterpriseVerificationOutcome{
			Status:            "verified",
			Provider:          strings.TrimSpace(result.Provider),
			ProviderRequestID: strings.TrimSpace(result.ProviderRequestID),
			LicenseHash:       licenseHash,
			VerifiedAt:        &now,
		}, nil
	}
	reason := strings.TrimSpace(result.Reason)
	if reason == "" {
		reason = "认证信息不一致，请核对后重试"
	}
	return &EnterpriseVerificationOutcome{
		Status:            "failed",
		Provider:          strings.TrimSpace(result.Provider),
		ProviderRequestID: strings.TrimSpace(result.ProviderRequestID),
		RejectReason:      reason,
		LicenseHash:       licenseHash,
	}, errors.New(reason)
}

func resolveLicenseVerifier() LicenseVerifier {
	switch resolveVerificationProvider("LICENSE_VERIFY_PROVIDER") {
	case "manual":
		return ManualLicenseVerifier{}
	case "aliyun":
		return newAliyunLicenseVerifier()
	default:
		return ManualLicenseVerifier{}
	}
}
