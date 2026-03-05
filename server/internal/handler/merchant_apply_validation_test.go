package handler

import (
	"strings"
	"testing"
)

func newValidDesignerApplyInput() MerchantApplyInput {
	return MerchantApplyInput{
		Phone:           "13800138000",
		Code:            "123456",
		Role:            "designer",
		EntityType:      "personal",
		ApplicantType:   "personal",
		RealName:        "张三",
		Avatar:          "https://img.example.com/avatar.jpg",
		IDCardNo:        "11010519491231002X",
		IDCardFront:     "https://img.example.com/id-front.jpg",
		IDCardBack:      "https://img.example.com/id-back.jpg",
		YearsExperience: 8,
		ServiceArea:     []string{"雁塔区", "曲江新区"},
		Styles:          []string{"现代简约", "北欧"},
		Pricing: map[string]float64{
			"flat":   1200,
			"duplex": 1500,
			"other":  1000,
		},
		Introduction: "10年家装经验，专注高还原度设计。",
		PortfolioCases: []PortfolioCaseInput{
			{
				Title:       "案例A",
				Description: "案例A说明",
				Images:      []string{"https://img.example.com/a1.jpg", "https://img.example.com/a2.jpg", "https://img.example.com/a3.jpg"},
				Style:       "现代简约",
				Area:        "120㎡",
			},
			{
				Title:       "案例B",
				Description: "案例B说明",
				Images:      []string{"https://img.example.com/b1.jpg", "https://img.example.com/b2.jpg", "https://img.example.com/b3.jpg"},
				Style:       "北欧",
				Area:        "95㎡",
			},
			{
				Title:       "案例C",
				Description: "案例C说明",
				Images:      []string{"https://img.example.com/c1.jpg", "https://img.example.com/c2.jpg", "https://img.example.com/c3.jpg"},
				Style:       "日式",
				Area:        "88㎡",
			},
		},
		LegalAcceptance: LegalAcceptanceInput{
			Accepted:                     true,
			OnboardingAgreementVersion:   "v1.0.0-20260305",
			PlatformRulesVersion:         "v1.0.0-20260305",
			PrivacyDataProcessingVersion: "v1.0.0-20260305",
		},
	}
}

func TestValidateMerchantApplyBusinessFields_RequireLegalAcceptance(t *testing.T) {
	input := newValidDesignerApplyInput()
	input.LegalAcceptance.Accepted = false

	err := validateMerchantApplyBusinessFields(&input)
	if err == nil {
		t.Fatalf("expected validation error for legal acceptance")
	}
	if !strings.Contains(err.Error(), "同意平台入驻相关条款") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestValidateMerchantApplyBusinessFields_RequireLegalVersions(t *testing.T) {
	input := newValidDesignerApplyInput()
	input.LegalAcceptance.PlatformRulesVersion = ""

	err := validateMerchantApplyBusinessFields(&input)
	if err == nil {
		t.Fatalf("expected validation error for missing legal version")
	}
	if !strings.Contains(err.Error(), "平台规则版本") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestValidateMerchantApplyBusinessFields_RequireAvatar(t *testing.T) {
	input := newValidDesignerApplyInput()
	input.Avatar = ""

	err := validateMerchantApplyBusinessFields(&input)
	if err == nil {
		t.Fatalf("expected validation error for missing avatar")
	}
	if !strings.Contains(err.Error(), "请上传头像") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestValidateMerchantApplyBusinessFields_DesignerYearsExperienceRequired(t *testing.T) {
	input := newValidDesignerApplyInput()
	input.YearsExperience = 0

	err := validateMerchantApplyBusinessFields(&input)
	if err == nil {
		t.Fatalf("expected validation error for missing yearsExperience")
	}
	if !strings.Contains(err.Error(), "从业经验") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestValidateMerchantApplyBusinessFields_CaseDescriptionRequired(t *testing.T) {
	input := newValidDesignerApplyInput()
	input.PortfolioCases[0].Description = ""

	err := validateMerchantApplyBusinessFields(&input)
	if err == nil {
		t.Fatalf("expected validation error for missing case description")
	}
	if !strings.Contains(err.Error(), "缺少说明") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestValidateMerchantApplyBusinessFields_ValidDesignerInput(t *testing.T) {
	input := newValidDesignerApplyInput()

	if err := validateMerchantApplyBusinessFields(&input); err != nil {
		t.Fatalf("expected valid input, got error: %v", err)
	}
}
