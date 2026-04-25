package main

import (
	"encoding/json"
	"fmt"
	"home-decoration-server/internal/service"
)

// 演示智能报价算法的使用
func main() {
	svc := &service.QuoteInquiryService{}

	// 示例1: 标准户型 - 现代简约 - 二线城市
	req1 := &service.CreateInquiryRequest{
		Address:        "杭州市西湖区文一路",
		CityCode:       "330100",
		Area:           100,
		HouseLayout:    "3室2厅2卫",
		RenovationType: "新房装修",
		Style:          "现代简约",
	}

	result1, err := svc.Calculate(req1)
	if err != nil {
		fmt.Printf("计算失败: %v\n", err)
		return
	}

	fmt.Println("=== 示例1: 标准户型 - 现代简约 - 二线城市 ===")
	printQuoteResult(req1, result1)

	// 示例2: 小户型 - 北欧 - 一线城市
	req2 := &service.CreateInquiryRequest{
		Address:        "北京市朝阳区",
		CityCode:       "110000",
		Area:           50,
		HouseLayout:    "1室1厅1卫",
		RenovationType: "新房装修",
		Style:          "北欧",
	}

	result2, err := svc.Calculate(req2)
	if err != nil {
		fmt.Printf("计算失败: %v\n", err)
		return
	}

	fmt.Println("\n=== 示例2: 小户型 - 北欧 - 一线城市 ===")
	printQuoteResult(req2, result2)

	// 示例3: 大户型 - 欧式 - 三线城市
	req3 := &service.CreateInquiryRequest{
		Address:        "某三线城市",
		CityCode:       "999999",
		Area:           200,
		HouseLayout:    "5室3厅3卫",
		RenovationType: "老房翻新",
		Style:          "欧式",
	}

	result3, err := svc.Calculate(req3)
	if err != nil {
		fmt.Printf("计算失败: %v\n", err)
		return
	}

	fmt.Println("\n=== 示例3: 大户型 - 欧式 - 三线城市 ===")
	printQuoteResult(req3, result3)
}

func printQuoteResult(req *service.CreateInquiryRequest, result *service.QuoteResult) {
	fmt.Printf("房屋信息:\n")
	fmt.Printf("  地址: %s\n", req.Address)
	fmt.Printf("  面积: %.0f㎡\n", req.Area)
	fmt.Printf("  户型: %s\n", req.HouseLayout)
	fmt.Printf("  装修类型: %s\n", req.RenovationType)
	fmt.Printf("  装修风格: %s\n", req.Style)
	fmt.Printf("\n")

	fmt.Printf("报价结果:\n")
	fmt.Printf("  总价区间: %.0f - %.0f 元 (%.2f - %.2f 万元)\n",
		result.TotalMin, result.TotalMax,
		result.TotalMin/10000, result.TotalMax/10000)
	fmt.Printf("  设计费: %.0f - %.0f 元\n", result.DesignFee.Min, result.DesignFee.Max)
	fmt.Printf("  施工费: %.0f - %.0f 元\n", result.ConstructionFee.Min, result.ConstructionFee.Max)
	fmt.Printf("  主材费: %.0f - %.0f 元\n", result.MaterialFee.Min, result.MaterialFee.Max)
	fmt.Printf("  预计工期: %d 天\n", result.EstimatedDuration)
	fmt.Printf("\n")

	fmt.Printf("计算系数:\n")
	fmt.Printf("  城市系数: %.2f\n", result.CityCoefficient)
	fmt.Printf("  面积系数: %.2f\n", result.AreaCoefficient)
	fmt.Printf("  风格系数: %.2f\n", result.StyleCoefficient)
	fmt.Printf("  复杂度系数: %.2f\n", result.ComplexityCoefficient)
	fmt.Printf("\n")

	fmt.Printf("费用明细:\n")
	for _, item := range result.Breakdown {
		fmt.Printf("  %s: %.0f - %.0f 元\n", item.Category, item.Min, item.Max)
		fmt.Printf("    说明: %s\n", item.Description)
	}

	// 输出JSON格式（用于API返回）
	jsonData, _ := json.MarshalIndent(result, "", "  ")
	fmt.Printf("\nJSON格式:\n%s\n", string(jsonData))
}
