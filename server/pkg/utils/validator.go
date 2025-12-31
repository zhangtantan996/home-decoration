package utils

import (
	"regexp"
	"strconv"
	"strings"
)

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

	// 权重因子
	weight := []int{7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2}
	// 校验码映射
	checkCode := []byte{'1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2'}

	sum := 0
	for i := 0; i < 17; i++ {
		n, _ := strconv.Atoi(string(id[i]))
		sum += n * weight[i]
	}

	if checkCode[sum%11] != id[17] {
		return false
	}

	return true
}

// ValidateRealName 验证姓名 (2-20位)
func ValidateRealName(name string) bool {
	n := len([]rune(name))
	return n >= 2 && n <= 20
}

// ValidateCompanyName 验证公司名 (2-100位)
func ValidateCompanyName(name string) bool {
	n := len([]rune(name))
	return n >= 2 && n <= 100
}
