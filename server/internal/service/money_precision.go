package service

import (
	"fmt"
	"math"
)

// 金额精度处理说明:
// 当前系统使用 float64 存储金额(元为单位),存在精度丢失风险。
// 生产环境建议使用以下方案之一:
// 1. 使用 int64 存储金额(分为单位) - 需要大规模重构
// 2. 使用 decimal 库(如 shopspring/decimal) - 推荐方案
// 3. 使用本文件提供的安全计算函数 - 临时方案

const (
	// MoneyPrecision 金额精度(小数点后位数)
	MoneyPrecision = 2
	// MoneyScale 金额缩放因子(100 = 分)
	MoneyScale = 100
)

// SafeMoneyAdd 安全的金额加法(防止精度丢失)
// 将金额转换为分(整数)进行计算,然后转回元
func SafeMoneyAdd(amounts ...float64) float64 {
	var totalCents int64
	for _, amount := range amounts {
		totalCents += floatToCents(amount)
	}
	return centsToFloat(totalCents)
}

// SafeMoneySubtract 安全的金额减法(防止精度丢失)
func SafeMoneySubtract(minuend float64, subtrahends ...float64) float64 {
	resultCents := floatToCents(minuend)
	for _, subtrahend := range subtrahends {
		resultCents -= floatToCents(subtrahend)
	}
	return centsToFloat(resultCents)
}

// SafeMoneyMultiply 安全的金额乘法(防止精度丢失)
// amount: 金额(元), multiplier: 乘数
func SafeMoneyMultiply(amount float64, multiplier float64) float64 {
	cents := floatToCents(amount)
	// 乘数保留6位小数精度
	multiplierScaled := int64(math.Round(multiplier * 1000000))
	resultCents := (cents * multiplierScaled) / 1000000
	return centsToFloat(resultCents)
}

// SafeMoneyDivide 安全的金额除法(防止精度丢失)
// amount: 金额(元), divisor: 除数
func SafeMoneyDivide(amount float64, divisor float64) float64 {
	if divisor == 0 {
		return 0
	}
	cents := floatToCents(amount)
	// 除数保留6位小数精度
	divisorScaled := int64(math.Round(divisor * 1000000))
	resultCents := (cents * 1000000) / divisorScaled
	return centsToFloat(resultCents)
}

// SafeMoneyPercentage 安全的百分比计算(防止精度丢失)
// amount: 金额(元), percentage: 百分比(如 30 表示 30%)
func SafeMoneyPercentage(amount float64, percentage float64) float64 {
	return SafeMoneyMultiply(amount, percentage/100)
}

// ValidateMoneyAmount 验证金额有效性
func ValidateMoneyAmount(amount float64) error {
	if math.IsNaN(amount) || math.IsInf(amount, 0) {
		return fmt.Errorf("金额无效: %v", amount)
	}
	if amount < 0 {
		return fmt.Errorf("金额不能为负数: %.2f", amount)
	}
	// 检查精度(不超过2位小数)
	cents := floatToCents(amount)
	reconstructed := centsToFloat(cents)
	if math.Abs(amount-reconstructed) > 0.001 {
		return fmt.Errorf("金额精度超出限制(最多2位小数): %.10f", amount)
	}
	return nil
}

// floatToCents 将元转换为分(整数)
func floatToCents(yuan float64) int64 {
	return int64(math.Round(yuan * MoneyScale))
}

// centsToFloat 将分(整数)转换为元
func centsToFloat(cents int64) float64 {
	return float64(cents) / MoneyScale
}

// NormalizeMoneyAmount 规范化金额(四舍五入到2位小数)
func NormalizeMoneyAmount(amount float64) float64 {
	return centsToFloat(floatToCents(amount))
}

// CompareMoneyAmount 比较两个金额是否相等(考虑精度误差)
func CompareMoneyAmount(a, b float64) int {
	diff := a - b
	if math.Abs(diff) < 0.01 { // 1分以内视为相等
		return 0
	}
	if diff > 0 {
		return 1
	}
	return -1
}
