package handler

import (
	"strings"
	"testing"
)

func sampleImages(prefix string, count int) []string {
	images := make([]string, 0, count)
	for i := 1; i <= count; i++ {
		images = append(images, "https://img.example.com/"+prefix+string(rune('a'+i-1))+".jpg")
	}
	return images
}

func designerCases(imageCount int) []PortfolioCaseInput {
	return []PortfolioCaseInput{
		{Title: "案例A", Description: "案例A说明", Images: sampleImages("a", imageCount), Style: "现代简约", Area: "120㎡"},
		{Title: "案例B", Description: "案例B说明", Images: sampleImages("b", imageCount), Style: "北欧", Area: "95㎡"},
		{Title: "案例C", Description: "案例C说明", Images: sampleImages("c", imageCount), Style: "日式", Area: "88㎡"},
	}
}

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
		Introduction:   "10年家装经验，专注高还原度设计。",
		OfficeAddress:  "西安市雁塔区科技路 1 号",
		PortfolioCases: designerCases(4),
		LegalAcceptance: LegalAcceptanceInput{
			Accepted:                     true,
			OnboardingAgreementVersion:   "v1.0.0-20260305",
			PlatformRulesVersion:         "v1.0.0-20260305",
			PrivacyDataProcessingVersion: "v1.0.0-20260305",
		},
	}
}

func newValidCompanyDesignerApplyInput() MerchantApplyInput {
	input := newValidDesignerApplyInput()
	input.EntityType = "company"
	input.ApplicantType = "studio"
	input.CompanyName = "上海设计事务所有限公司"
	input.LicenseNo = "110105000000123"
	input.LicenseImage = "https://img.example.com/license.jpg"
	input.LegalPersonName = "李四"
	input.LegalPersonIDCardNo = "11010519491231002X"
	input.LegalPersonIDCardFront = "https://img.example.com/legal-front.jpg"
	input.LegalPersonIDCardBack = "https://img.example.com/legal-back.jpg"
	input.PortfolioCases = designerCases(6)
	return input
}

func newValidForemanApplyInput() MerchantApplyInput {
	return MerchantApplyInput{
		Phone:           "13800138008",
		Code:            "123456",
		Role:            "foreman",
		EntityType:      "personal",
		ApplicantType:   "foreman",
		RealName:        "王工",
		Avatar:          "https://img.example.com/avatar.jpg",
		IDCardNo:        "11010519491231002X",
		IDCardFront:     "https://img.example.com/id-front.jpg",
		IDCardBack:      "https://img.example.com/id-back.jpg",
		YearsExperience: 12,
		ServiceArea:     []string{"雁塔区"},
		HighlightTags:   []string{"快响应", "不增项"},
		Pricing:         map[string]float64{"perSqm": 599},
		Introduction:    "专注家装施工管理。",
		OfficeAddress:   "西安市长安中路 8 号",
		PortfolioCases: []PortfolioCaseInput{
			{Category: "water", Description: "水工说明", Images: []string{"/water-1.jpg", "/water-2.jpg"}},
			{Category: "electric", Description: "电工说明", Images: []string{"/electric-1.jpg", "/electric-2.jpg"}},
			{Category: "wood", Description: "木工说明", Images: []string{"/wood-1.jpg", "/wood-2.jpg"}},
			{Category: "masonry", Description: "瓦工说明", Images: []string{"/masonry-1.jpg", "/masonry-2.jpg"}},
			{Category: "paint", Description: "油漆工说明", Images: []string{"/paint-1.jpg", "/paint-2.jpg"}},
		},
		LegalAcceptance: LegalAcceptanceInput{
			Accepted:                     true,
			OnboardingAgreementVersion:   "v1.0.0-20260305",
			PlatformRulesVersion:         "v1.0.0-20260305",
			PrivacyDataProcessingVersion: "v1.0.0-20260305",
		},
	}
}

func TestValidateMerchantApplyBusinessFields_DesignerPersonalRequiresFourToTwelveImages(t *testing.T) {
	input := newValidDesignerApplyInput()
	if err := validateMerchantApplyBusinessFields(&input); err != nil {
		t.Fatalf("expected valid personal designer input, got: %v", err)
	}

	input = newValidDesignerApplyInput()
	input.PortfolioCases[0].Images = sampleImages("few", 3)
	err := validateMerchantApplyBusinessFields(&input)
	if err == nil || !strings.Contains(err.Error(), "4-12张图片") {
		t.Fatalf("expected 4-12 image validation error, got=%v", err)
	}
}

func TestValidateMerchantApplyBusinessFields_DesignerCompanyRequiresSixToTwelveImages(t *testing.T) {
	input := newValidCompanyDesignerApplyInput()
	if err := validateMerchantApplyBusinessFields(&input); err != nil {
		t.Fatalf("expected valid company designer input, got: %v", err)
	}

	input = newValidCompanyDesignerApplyInput()
	input.PortfolioCases[0].Images = sampleImages("few", 5)
	err := validateMerchantApplyBusinessFields(&input)
	if err == nil || !strings.Contains(err.Error(), "6-12张图片") {
		t.Fatalf("expected 6-12 image validation error, got=%v", err)
	}
}

func TestValidateMerchantApplyBusinessFields_ForemanRequiresAllFixedCategories(t *testing.T) {
	input := newValidForemanApplyInput()
	input.PortfolioCases = input.PortfolioCases[:4]

	err := validateMerchantApplyBusinessFields(&input)
	if err == nil || !strings.Contains(err.Error(), "施工展示") {
		t.Fatalf("expected missing foreman category error, got=%v", err)
	}
}

func TestValidateMerchantApplyBusinessFields_ForemanRequiresDescriptionAndTwoToEightImages(t *testing.T) {
	input := newValidForemanApplyInput()
	input.PortfolioCases[0].Description = ""

	err := validateMerchantApplyBusinessFields(&input)
	if err == nil || !strings.Contains(err.Error(), "工艺说明不能为空") {
		t.Fatalf("expected missing description error, got=%v", err)
	}

	input = newValidForemanApplyInput()
	input.PortfolioCases[0].Images = []string{"/water-1.jpg"}
	err = validateMerchantApplyBusinessFields(&input)
	if err == nil || !strings.Contains(err.Error(), "2-8张图片") {
		t.Fatalf("expected image count error, got=%v", err)
	}
}

func TestValidateMerchantApplyBusinessFields_ForemanAllowsEmptyOtherAndRequiresOfficeAddress(t *testing.T) {
	input := newValidForemanApplyInput()
	if err := validateMerchantApplyBusinessFields(&input); err != nil {
		t.Fatalf("expected valid foreman input, got=%v", err)
	}

	input = newValidForemanApplyInput()
	input.OfficeAddress = ""
	err := validateMerchantApplyBusinessFields(&input)
	if err == nil || !strings.Contains(err.Error(), "办公地址") {
		t.Fatalf("expected office address error, got=%v", err)
	}
}
