package service

import (
	"encoding/json"
	"errors"
	"fmt"
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	"math"
)

// QuoteEstimateService 智能报价服务
type QuoteEstimateService struct{}

// MaterialBudgetItem 材料预算项
type MaterialBudgetItem struct {
	Category string  `json:"category"` // 类别
	Budget   float64 `json:"budget"`   // 预算金额
}

// RiskItem 风险项
type RiskItem struct {
	Item        string `json:"item"`        // 风险项名称
	Description string `json:"description"` // 风险描述
}

// QuoteEstimateResult 报价估算结果
type QuoteEstimateResult struct {
	HalfPackMin float64              `json:"halfPackMin"` // 半包最低价
	HalfPackMax float64              `json:"halfPackMax"` // 半包最高价
	FullPackMin float64              `json:"fullPackMin"` // 全包最低价
	FullPackMax float64              `json:"fullPackMax"` // 全包最高价
	Duration    int                  `json:"duration"`    // 工期（天）
	Materials   []MaterialBudgetItem `json:"materials"`   // 材料预算明细
	RiskItems   []RiskItem           `json:"riskItems"`   // 风险项提醒
}

// EstimateQuote 根据面积、风格、区域生成报价区间
func (s *QuoteEstimateService) EstimateQuote(area float64, style string, region string) (*QuoteEstimateResult, error) {
	// 输入校验
	if area < 10 || area > 9999 {
		return nil, errors.New("房屋面积需在 10-9999 ㎡ 之间")
	}
	if style == "" {
		return nil, errors.New("装修风格不能为空")
	}
	if region == "" {
		return nil, errors.New("区域不能为空")
	}

	// 1. 查找匹配的报价模板
	template, err := s.GetQuoteTemplate(area, style, region)
	if err != nil {
		return nil, fmt.Errorf("未找到匹配的报价模板: %w", err)
	}

	// 2. 计算报价区间
	halfPackMin := template.HalfPackMin * area
	halfPackMax := template.HalfPackMax * area
	fullPackMin := template.FullPackMin * area
	fullPackMax := template.FullPackMax * area

	// 3. 计算工期
	duration := s.CalculateDuration(area, template.Duration)

	// 4. 获取材料预算明细
	materials, err := s.GetMaterialsBudget(area, template.Materials)
	if err != nil {
		materials = []MaterialBudgetItem{} // 降级处理
	}

	// 5. 获取风险项提醒
	riskItems, err := s.GetRiskItems(template.RiskItems)
	if err != nil {
		riskItems = []RiskItem{} // 降级处理
	}

	return &QuoteEstimateResult{
		HalfPackMin: math.Round(halfPackMin),
		HalfPackMax: math.Round(halfPackMax),
		FullPackMin: math.Round(fullPackMin),
		FullPackMax: math.Round(fullPackMax),
		Duration:    duration,
		Materials:   materials,
		RiskItems:   riskItems,
	}, nil
}

// GetQuoteTemplate 获取匹配的报价模板
func (s *QuoteEstimateService) GetQuoteTemplate(area float64, style string, region string) (*model.QuoteEstimateTemplate, error) {
	var template model.QuoteEstimateTemplate

	// 优先精确匹配：风格 + 区域 + 面积区间
	err := repository.DB.Where("style = ? AND region = ? AND min_area <= ? AND max_area >= ? AND status = 1",
		style, region, area, area).
		Order("created_at DESC").
		First(&template).Error

	if err == nil {
		return &template, nil
	}

	// 降级1：匹配风格 + 面积区间（忽略区域）
	err = repository.DB.Where("style = ? AND min_area <= ? AND max_area >= ? AND status = 1",
		style, area, area).
		Order("created_at DESC").
		First(&template).Error

	if err == nil {
		return &template, nil
	}

	// 降级2：匹配区域 + 面积区间（忽略风格）
	err = repository.DB.Where("region = ? AND min_area <= ? AND max_area >= ? AND status = 1",
		region, area, area).
		Order("created_at DESC").
		First(&template).Error

	if err == nil {
		return &template, nil
	}

	// 降级3：仅匹配面积区间
	err = repository.DB.Where("min_area <= ? AND max_area >= ? AND status = 1",
		area, area).
		Order("created_at DESC").
		First(&template).Error

	if err == nil {
		return &template, nil
	}

	return nil, errors.New("未找到匹配的报价模板，请联系客服获取报价")
}

// CalculateDuration 计算工期
func (s *QuoteEstimateService) CalculateDuration(area float64, baseDuration int) int {
	// 基础工期 + 面积调整
	// 每增加 20 平米，工期增加 5 天
	extraDays := int(math.Floor((area - 80) / 20 * 5))
	if extraDays < 0 {
		extraDays = 0
	}

	duration := baseDuration + extraDays

	// 工期上下限
	if duration < 30 {
		duration = 30
	}
	if duration > 180 {
		duration = 180
	}

	return duration
}

// GetMaterialsBudget 获取材料预算明细
func (s *QuoteEstimateService) GetMaterialsBudget(area float64, materialsJSON string) ([]MaterialBudgetItem, error) {
	if materialsJSON == "" {
		return []MaterialBudgetItem{}, nil
	}

	var baseMaterials []MaterialBudgetItem
	if err := json.Unmarshal([]byte(materialsJSON), &baseMaterials); err != nil {
		return nil, fmt.Errorf("解析材料预算失败: %w", err)
	}

	// 根据面积调整预算
	// 基准面积 100 平米
	ratio := area / 100.0

	materials := make([]MaterialBudgetItem, len(baseMaterials))
	for i, item := range baseMaterials {
		materials[i] = MaterialBudgetItem{
			Category: item.Category,
			Budget:   math.Round(item.Budget * ratio),
		}
	}

	return materials, nil
}

// GetRiskItems 获取风险项提醒
func (s *QuoteEstimateService) GetRiskItems(riskItemsJSON string) ([]RiskItem, error) {
	if riskItemsJSON == "" {
		return []RiskItem{}, nil
	}

	var riskItems []RiskItem
	if err := json.Unmarshal([]byte(riskItemsJSON), &riskItems); err != nil {
		return nil, fmt.Errorf("解析风险项失败: %w", err)
	}

	return riskItems, nil
}
