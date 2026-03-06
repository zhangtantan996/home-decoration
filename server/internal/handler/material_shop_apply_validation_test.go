package handler

import (
	"strings"
	"testing"
)

func newValidMaterialShopApplyInput() materialShopApplyInput {
	return materialShopApplyInput{
		Phone:                  "13800138001",
		Code:                   "123456",
		EntityType:             "company",
		ShopName:               "优选主材馆",
		ShopDescription:        "主营瓷砖、地板与卫浴主材",
		CompanyName:            "上海优选主材有限公司",
		BusinessLicenseNo:      "110105000000123",
		BusinessLicense:        "https://img.example.com/license.jpg",
		LegalPersonName:        "王五",
		LegalPersonIDCardNo:    "11010519491231002X",
		LegalPersonIDCardFront: "https://img.example.com/id-front.jpg",
		LegalPersonIDCardBack:  "https://img.example.com/id-back.jpg",
		BusinessHours:          "09:00-18:00",
		ContactPhone:           "13800138001",
		ContactName:            "王五",
		Address:                "上海市浦东新区XX路88号",
		Products: []materialShopApplyProductInput{
			{Name: "产品1", Price: 100, Images: []string{"https://img.example.com/p1.jpg"}, Params: map[string]interface{}{"品牌": "A", "规格": "100x100"}},
			{Name: "产品2", Price: 120, Images: []string{"https://img.example.com/p2.jpg"}, Params: map[string]interface{}{"品牌": "A", "规格": "120x120"}},
			{Name: "产品3", Price: 130, Images: []string{"https://img.example.com/p3.jpg"}, Params: map[string]interface{}{"品牌": "A", "规格": "130x130"}},
			{Name: "产品4", Price: 140, Images: []string{"https://img.example.com/p4.jpg"}, Params: map[string]interface{}{"品牌": "A", "规格": "140x140"}},
			{Name: "产品5", Price: 150, Images: []string{"https://img.example.com/p5.jpg"}, Params: map[string]interface{}{"品牌": "A", "规格": "150x150"}},
		},
		LegalAcceptance: LegalAcceptanceInput{
			Accepted:                     true,
			OnboardingAgreementVersion:   "v1.0.0-20260305",
			PlatformRulesVersion:         "v1.0.0-20260305",
			PrivacyDataProcessingVersion: "v1.0.0-20260305",
		},
	}
}

func TestValidateMaterialShopApply_RequireLegalAcceptance(t *testing.T) {
	input := newValidMaterialShopApplyInput()
	input.LegalAcceptance.Accepted = false

	err := validateMaterialShopApply(&input)
	if err == nil {
		t.Fatalf("expected error for missing legal acceptance")
	}
	if !strings.Contains(err.Error(), "同意平台入驻相关条款") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestValidateMaterialShopApply_RequireLegalVersions(t *testing.T) {
	input := newValidMaterialShopApplyInput()
	input.LegalAcceptance.PrivacyDataProcessingVersion = ""

	err := validateMaterialShopApply(&input)
	if err == nil {
		t.Fatalf("expected error for missing legal version")
	}
	if !strings.Contains(err.Error(), "隐私与数据处理条款版本") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestValidateMaterialShopApply_RequireCompanyAndLegalPerson(t *testing.T) {
	input := newValidMaterialShopApplyInput()
	input.CompanyName = ""

	err := validateMaterialShopApply(&input)
	if err == nil {
		t.Fatalf("expected error for missing companyName")
	}
	if !strings.Contains(err.Error(), "公司/个体名称") {
		t.Fatalf("unexpected error: %v", err)
	}

	input = newValidMaterialShopApplyInput()
	input.LegalPersonName = ""
	err = validateMaterialShopApply(&input)
	if err == nil {
		t.Fatalf("expected error for missing legalPersonName")
	}
	if !strings.Contains(err.Error(), "法人/经营者姓名") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestValidateMaterialShopApply_RequireBusinessHoursAndAddress(t *testing.T) {
	input := newValidMaterialShopApplyInput()
	input.BusinessHours = ""

	err := validateMaterialShopApply(&input)
	if err == nil {
		t.Fatalf("expected error for missing businessHours")
	}
	if !strings.Contains(err.Error(), "营业时间") {
		t.Fatalf("unexpected error: %v", err)
	}

	input = newValidMaterialShopApplyInput()
	input.Address = ""
	err = validateMaterialShopApply(&input)
	if err == nil {
		t.Fatalf("expected error for missing address")
	}
	if !strings.Contains(err.Error(), "门店地址") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestValidateMaterialShopApply_RequireValidContactPhone(t *testing.T) {
	input := newValidMaterialShopApplyInput()
	input.ContactPhone = "12345"

	err := validateMaterialShopApply(&input)
	if err == nil {
		t.Fatalf("expected error for invalid contactPhone")
	}
	if !strings.Contains(err.Error(), "联系手机号格式不正确") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestValidateMaterialShopApply_ValidInput(t *testing.T) {
	input := newValidMaterialShopApplyInput()
	input.ContactName = ""

	if err := validateMaterialShopApply(&input); err != nil {
		t.Fatalf("expected valid input, got error: %v", err)
	}
	if input.ContactName != input.LegalPersonName {
		t.Fatalf("expected contact name to default to legal person name")
	}
}
