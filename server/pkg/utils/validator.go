package utils

import (
	"regexp"
	"strconv"
	"strings"
)

var unifiedSocialCreditCharset = "0123456789ABCDEFGHJKLMNPQRTUWXY"
var unifiedSocialCreditWeights = []int{1, 3, 9, 27, 19, 26, 16, 17, 20, 29, 25, 13, 8, 24, 10, 30, 28}

// ValidatePhone 验证手机号
func ValidatePhone(phone string) bool {
	reg := regexp.MustCompile(`^1[3-9]\d{9}$`)
	return reg.MatchString(phone)
}

// ValidateIDCard 验证身份证号 (18位)
func ValidateIDCard(id string) bool {
	if len(id) != 18 {
		return false
	}

	id = strings.ToUpper(id)
	reg := regexp.MustCompile(`^\d{17}[\dX]$`)
	if !reg.MatchString(id) {
		return false
	}

	weight := []int{7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2}
	checkCode := []byte{'1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2'}

	sum := 0
	for i := 0; i < 17; i++ {
		n, _ := strconv.Atoi(string(id[i]))
		sum += n * weight[i]
	}

	return checkCode[sum%11] == id[17]
}

// ValidateRealName 验证姓名 (2-20位)
func ValidateRealName(name string) bool {
	trimmed := strings.TrimSpace(name)
	n := len([]rune(trimmed))
	if n < 2 || n > 20 {
		return false
	}
	return regexp.MustCompile(`^[\p{Han}·]+$`).MatchString(trimmed)
}

// ValidateCompanyName 验证公司名 (2-100位)
func ValidateCompanyName(name string) bool {
	trimmed := strings.TrimSpace(name)
	n := len([]rune(trimmed))
	if n < 2 || n > 100 {
		return false
	}
	return regexp.MustCompile(`[\p{Han}A-Za-z0-9]`).MatchString(trimmed)
}

func NormalizeLicenseNo(value string) string {
	return strings.ToUpper(strings.ReplaceAll(strings.TrimSpace(value), " ", ""))
}

func ValidateUnifiedSocialCreditCode(value string) bool {
	code := NormalizeLicenseNo(value)
	if len(code) != 18 {
		return false
	}
	if !regexp.MustCompile(`^[0-9A-Z]{18}$`).MatchString(code) {
		return false
	}

	sum := 0
	for index, char := range code[:17] {
		position := strings.IndexRune(unifiedSocialCreditCharset, char)
		if position < 0 {
			return false
		}
		sum += position * unifiedSocialCreditWeights[index]
	}

	checkCode := unifiedSocialCreditCharset[(31-(sum%31))%31]
	return rune(checkCode) == rune(code[17])
}

func ValidateLegacyBusinessLicenseNo(value string) bool {
	return regexp.MustCompile(`^\d{15}$`).MatchString(NormalizeLicenseNo(value))
}

func ValidateBusinessLicenseNo(value string) bool {
	code := NormalizeLicenseNo(value)
	if code == "" {
		return false
	}
	return ValidateUnifiedSocialCreditCode(code) || ValidateLegacyBusinessLicenseNo(code)
}
