package service

import (
	"os"
	"strings"

	"home-decoration-server/internal/config"
)

type SMSRiskTier string

const (
	SMSRiskTierLow    SMSRiskTier = "low"
	SMSRiskTierMedium SMSRiskTier = "medium"
	SMSRiskTierHigh   SMSRiskTier = "high"
)

type smsPurposePolicy struct {
	RiskTier SMSRiskTier
}

type smsRiskThresholdConfig struct {
	IP      int
	Phone   int
	Combo   int
	Purpose int
}

type SMSTemplateContext struct {
	Purpose      SMSPurpose
	RiskTier     SMSRiskTier
	TemplateKey  string
	TemplateCode string
}

var smsPurposePolicies = map[SMSPurpose]smsPurposePolicy{
	SMSPurposeLogin:            {RiskTier: SMSRiskTierLow},
	SMSPurposeRegister:         {RiskTier: SMSRiskTierLow},
	SMSPurposeIdentityApply:    {RiskTier: SMSRiskTierMedium},
	SMSPurposeChangePhone:      {RiskTier: SMSRiskTierMedium},
	SMSPurposeMerchantWithdraw: {RiskTier: SMSRiskTierHigh},
	SMSPurposeMerchantBankBind: {RiskTier: SMSRiskTierHigh},
	SMSPurposeDeleteAccount:    {RiskTier: SMSRiskTierHigh},
}

var smsRiskThresholds = map[SMSRiskTier]smsRiskThresholdConfig{
	SMSRiskTierLow: {
		IP:      14,
		Phone:   7,
		Combo:   5,
		Purpose: 4,
	},
	SMSRiskTierMedium: {
		IP:      12,
		Phone:   6,
		Combo:   4,
		Purpose: 3,
	},
	SMSRiskTierHigh: {
		IP:      10,
		Phone:   4,
		Combo:   3,
		Purpose: 2,
	},
}

func normalizeSMSRiskTier(tier SMSRiskTier) SMSRiskTier {
	switch tier {
	case SMSRiskTierLow, SMSRiskTierMedium, SMSRiskTierHigh:
		return tier
	default:
		return SMSRiskTierMedium
	}
}

func resolveSMSPurposePolicy(purpose SMSPurpose) (smsPurposePolicy, error) {
	if err := validateSMSPurpose(purpose); err != nil {
		return smsPurposePolicy{}, err
	}

	policy, ok := smsPurposePolicies[purpose]
	if !ok {
		return smsPurposePolicy{}, errSMSPurposeInvalid
	}

	policy.RiskTier = normalizeSMSRiskTier(policy.RiskTier)
	return policy, nil
}

func smsRiskTierForPurpose(purpose SMSPurpose) (SMSRiskTier, error) {
	policy, err := resolveSMSPurposePolicy(purpose)
	if err != nil {
		return "", err
	}
	return policy.RiskTier, nil
}

func smsRiskThresholdForDimension(tier SMSRiskTier, dimension string) int {
	thresholds, ok := smsRiskThresholds[normalizeSMSRiskTier(tier)]
	if !ok {
		thresholds = smsRiskThresholds[SMSRiskTierMedium]
	}

	switch dimension {
	case riskDimensionIP:
		return thresholds.IP
	case riskDimensionPhone:
		return thresholds.Phone
	case riskDimensionCombo:
		return thresholds.Combo
	case riskDimensionPurpose:
		return thresholds.Purpose
	default:
		return thresholds.Combo
	}
}

func ResolveSMSTemplateContext(purpose SMSPurpose, cfg *config.SMSConfig) (SMSTemplateContext, error) {
	policy, err := resolveSMSPurposePolicy(purpose)
	if err != nil {
		return SMSTemplateContext{}, err
	}

	templateKey, templateCode := resolveSMSTemplateCode(cfg, purpose, policy.RiskTier)
	return SMSTemplateContext{
		Purpose:      purpose,
		RiskTier:     policy.RiskTier,
		TemplateKey:  templateKey,
		TemplateCode: templateCode,
	}, nil
}

func resolveSMSTemplateCode(cfg *config.SMSConfig, purpose SMSPurpose, tier SMSRiskTier) (string, string) {
	if code := strings.TrimSpace(smsTemplateCodeForPurpose(cfg, purpose)); code != "" {
		return "purpose." + string(purpose), code
	}
	if code := strings.TrimSpace(smsTemplateCodeForRiskTier(cfg, tier)); code != "" {
		return "risk." + string(tier), code
	}
	if cfg != nil && strings.TrimSpace(cfg.TemplateCode) != "" {
		return "default", strings.TrimSpace(cfg.TemplateCode)
	}
	return "default", ""
}

func smsTemplateCodeForPurpose(cfg *config.SMSConfig, purpose SMSPurpose) string {
	if cfg == nil {
		cfg = &config.SMSConfig{}
	}

	switch purpose {
	case SMSPurposeLogin:
		return firstNonEmptyString(cfg.TemplateCodeLogin, os.Getenv("SMS_TEMPLATE_CODE_LOGIN"))
	case SMSPurposeRegister:
		return firstNonEmptyString(cfg.TemplateCodeRegister, os.Getenv("SMS_TEMPLATE_CODE_REGISTER"))
	case SMSPurposeIdentityApply:
		return firstNonEmptyString(cfg.TemplateCodeIdentityApply, os.Getenv("SMS_TEMPLATE_CODE_IDENTITY_APPLY"))
	case SMSPurposeMerchantWithdraw:
		return firstNonEmptyString(cfg.TemplateCodeMerchantWithdraw, os.Getenv("SMS_TEMPLATE_CODE_MERCHANT_WITHDRAW"))
	case SMSPurposeMerchantBankBind:
		return firstNonEmptyString(cfg.TemplateCodeMerchantBankBind, os.Getenv("SMS_TEMPLATE_CODE_MERCHANT_BANK_BIND"))
	case SMSPurposeChangePhone:
		return firstNonEmptyString(cfg.TemplateCodeChangePhone, os.Getenv("SMS_TEMPLATE_CODE_CHANGE_PHONE"))
	case SMSPurposeDeleteAccount:
		return firstNonEmptyString(cfg.TemplateCodeDeleteAccount, os.Getenv("SMS_TEMPLATE_CODE_DELETE_ACCOUNT"))
	default:
		return ""
	}
}

func smsTemplateCodeForRiskTier(cfg *config.SMSConfig, tier SMSRiskTier) string {
	if cfg == nil {
		cfg = &config.SMSConfig{}
	}

	switch normalizeSMSRiskTier(tier) {
	case SMSRiskTierLow:
		return firstNonEmptyString(cfg.TemplateCodeLow, os.Getenv("SMS_TEMPLATE_CODE_LOW"))
	case SMSRiskTierMedium:
		return firstNonEmptyString(cfg.TemplateCodeMedium, os.Getenv("SMS_TEMPLATE_CODE_MEDIUM"))
	case SMSRiskTierHigh:
		return firstNonEmptyString(cfg.TemplateCodeHigh, os.Getenv("SMS_TEMPLATE_CODE_HIGH"))
	default:
		return ""
	}
}

func firstNonEmptyString(values ...string) string {
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed != "" {
			return trimmed
		}
	}
	return ""
}
