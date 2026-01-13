package service

import (
	"encoding/json"
	"fmt"
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
)

// RegionService 行政区划服务
type RegionService struct{}

// ValidateRegionCodes 验证区域代码数组是否有效（存在且已启用）
func (s *RegionService) ValidateRegionCodes(codes []string) error {
	if len(codes) == 0 {
		return fmt.Errorf("服务区域不能为空")
	}

	var regions []model.Region
	if err := repository.DB.Where("code IN ?", codes).Find(&regions).Error; err != nil {
		return fmt.Errorf("查询区域失败: %v", err)
	}

	// 检查是否所有代码都找到了
	if len(regions) != len(codes) {
		foundCodes := make(map[string]bool)
		for _, r := range regions {
			foundCodes[r.Code] = true
		}

		var invalidCodes []string
		for _, code := range codes {
			if !foundCodes[code] {
				invalidCodes = append(invalidCodes, code)
			}
		}
		return fmt.Errorf("以下区域代码不存在: %v", invalidCodes)
	}

	// 检查是否所有区域都已启用
	var disabledRegions []string
	for _, r := range regions {
		if !r.Enabled {
			disabledRegions = append(disabledRegions, r.Name)
		}
	}
	if len(disabledRegions) > 0 {
		return fmt.Errorf("以下区域已被禁用: %v", disabledRegions)
	}

	return nil
}

// ConvertCodesToNames 将区域代码数组转换为名称数组
func (s *RegionService) ConvertCodesToNames(codes []string) ([]string, error) {
	if len(codes) == 0 {
		return []string{}, nil
	}

	var regions []model.Region
	if err := repository.DB.Where("code IN ?", codes).Find(&regions).Error; err != nil {
		return nil, fmt.Errorf("查询区域失败: %v", err)
	}

	// 保持原始顺序
	codeToName := make(map[string]string)
	for _, r := range regions {
		codeToName[r.Code] = r.Name
	}

	names := make([]string, 0, len(codes))
	for _, code := range codes {
		if name, ok := codeToName[code]; ok {
			names = append(names, name)
		}
	}

	return names, nil
}

// ConvertNamesToCodes 将区域名称数组转换为代码数组（用于数据迁移）
func (s *RegionService) ConvertNamesToCodes(names []string) ([]string, error) {
	if len(names) == 0 {
		return []string{}, nil
	}

	var regions []model.Region
	if err := repository.DB.Where("name IN ?", names).Find(&regions).Error; err != nil {
		return nil, fmt.Errorf("查询区域失败: %v", err)
	}

	// 保持原始顺序
	nameToCode := make(map[string]string)
	for _, r := range regions {
		nameToCode[r.Name] = r.Code
	}

	codes := make([]string, 0, len(names))
	for _, name := range names {
		if code, ok := nameToCode[name]; ok {
			codes = append(codes, code)
		} else {
			// 如果找不到对应的区域，记录警告但继续（容错处理）
			fmt.Printf("[WARN] 区域名称未找到: %s\n", name)
		}
	}

	return codes, nil
}

// ParseServiceAreaJSON 解析 ServiceArea JSON 字符串为代码数组
func (s *RegionService) ParseServiceAreaJSON(serviceAreaJSON string) ([]string, error) {
	if serviceAreaJSON == "" {
		return []string{}, nil
	}

	var codes []string
	if err := json.Unmarshal([]byte(serviceAreaJSON), &codes); err != nil {
		return nil, fmt.Errorf("解析服务区域失败: %v", err)
	}

	return codes, nil
}

// GetRegionsByCodesBatch 批量获取区域信息（用于展示）
func (s *RegionService) GetRegionsByCodesBatch(codes []string) (map[string]model.Region, error) {
	if len(codes) == 0 {
		return make(map[string]model.Region), nil
	}

	var regions []model.Region
	if err := repository.DB.Where("code IN ?", codes).Find(&regions).Error; err != nil {
		return nil, err
	}

	result := make(map[string]model.Region)
	for _, r := range regions {
		result[r.Code] = r
	}

	return result, nil
}
