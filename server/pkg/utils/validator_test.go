package utils

import "testing"

func buildValidUnifiedSocialCreditCode(prefix17 string) string {
	charset := unifiedSocialCreditCharset
	weights := unifiedSocialCreditWeights
	sum := 0
	for index, char := range prefix17 {
		position := -1
		for i, candidate := range charset {
			if candidate == char {
				position = i
				break
			}
		}
		if position < 0 {
			return ""
		}
		sum += position * weights[index]
	}
	checkCode := charset[(31-(sum%31))%31]
	return prefix17 + string(checkCode)
}

func TestValidateBusinessLicenseNo(t *testing.T) {
	validUnified := buildValidUnifiedSocialCreditCode("91350211M000100Y4")
	if !ValidateBusinessLicenseNo(validUnified) {
		t.Fatalf("expected valid unified social credit code, got %s", validUnified)
	}
	if !ValidateBusinessLicenseNo("110105000000123") {
		t.Fatalf("expected 15-digit legacy business license to be valid")
	}
	if ValidateBusinessLicenseNo("91350211M000100Y40") {
		t.Fatalf("expected invalid unified social credit code to fail")
	}
	if ValidateBusinessLicenseNo("ABC123") {
		t.Fatalf("expected short code to fail")
	}
}

func TestValidateIDCardAndNameHelpers(t *testing.T) {
	if !ValidateIDCard("11010519491231002X") {
		t.Fatalf("expected sample id card to be valid")
	}
	if ValidateIDCard("110105194912310021") {
		t.Fatalf("expected invalid checksum to fail")
	}
	if !ValidateRealName("张三") {
		t.Fatalf("expected chinese name to be valid")
	}
	if ValidateRealName("A") {
		t.Fatalf("expected too short name to fail")
	}
}
