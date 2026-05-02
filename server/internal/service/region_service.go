package service

import (
	"encoding/json"
	"fmt"
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	"strings"

	"gorm.io/gorm"
)

// RegionService 行政区划服务
type RegionService struct{}

const (
	openServiceProvincesCategory = "open_service_provinces"
	openServiceCitiesCategory    = "open_service_cities"
)

// ServiceRegionDTO 开放服务地区返回结构
type ServiceRegionDTO struct {
	Code       string `json:"code"`
	Name       string `json:"name"`
	ParentCode string `json:"parentCode"`
	ParentName string `json:"parentName"`
}

type serviceCityRecord struct {
	Code              string
	Name              string
	ParentCode        string
	ParentName        string
	ProvinceSortOrder int
	CitySortOrder     int
	ServiceEnabled    bool
}

// ValidateRegionCodes 验证区域代码数组是否有效（存在且已启用）
func (s *RegionService) ValidateRegionCodes(codes []string) error {
	if len(codes) == 0 {
		return fmt.Errorf("服务城市不能为空")
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

// NormalizeServiceCityCodes 将输入统一解析为开放的地级市代码数组
func (s *RegionService) NormalizeServiceCityCodes(inputs []string) ([]string, error) {
	normalizedInputs := normalizeRegionInputs(inputs)
	if len(normalizedInputs) == 0 {
		return nil, fmt.Errorf("服务城市不能为空")
	}

	var regions []model.Region
	if err := repository.DB.
		Where("code IN ? OR name IN ?", normalizedInputs, normalizedInputs).
		Find(&regions).Error; err != nil {
		return nil, fmt.Errorf("查询服务城市失败: %v", err)
	}

	codeSet := make(map[string]struct{}, len(regions))
	nameToCode := make(map[string]string, len(regions))
	for _, region := range regions {
		codeSet[region.Code] = struct{}{}
		if _, exists := nameToCode[region.Name]; !exists {
			nameToCode[region.Name] = region.Code
		}
	}

	resolved := make([]string, 0, len(normalizedInputs))
	var unresolved []string
	for _, input := range normalizedInputs {
		if _, ok := codeSet[input]; ok {
			resolved = append(resolved, input)
			continue
		}
		if code, ok := nameToCode[input]; ok {
			resolved = append(resolved, code)
			continue
		}
		unresolved = append(unresolved, input)
	}

	if len(unresolved) > 0 {
		return nil, fmt.Errorf("以下地区不存在: %v", unresolved)
	}

	resolved = dedupeRegionCodes(resolved)
	if err := s.ValidateServiceCityCodes(resolved); err != nil {
		return nil, err
	}
	return resolved, nil
}

// ValidateServiceCityCodes 验证服务城市代码数组是否有效且已开放
func (s *RegionService) ValidateServiceCityCodes(codes []string) error {
	normalizedCodes := normalizeRegionInputs(codes)
	if len(normalizedCodes) == 0 {
		return fmt.Errorf("服务城市不能为空")
	}

	var regions []model.Region
	if err := repository.DB.Where("code IN ?", normalizedCodes).Find(&regions).Error; err != nil {
		return fmt.Errorf("查询服务城市失败: %v", err)
	}

	regionMap := make(map[string]model.Region, len(regions))
	for _, region := range regions {
		regionMap[region.Code] = region
	}

	openCities, err := s.ListOpenServiceCities()
	if err != nil {
		return fmt.Errorf("查询开放服务城市失败: %v", err)
	}

	openCityMap := make(map[string]ServiceRegionDTO, len(openCities))
	for _, city := range openCities {
		openCityMap[city.Code] = city
	}

	var notFound []string
	var disabled []string
	var invalidLevel []string
	var notOpen []string

	for _, code := range normalizedCodes {
		region, ok := regionMap[code]
		if !ok {
			notFound = append(notFound, code)
			continue
		}
		if !region.Enabled {
			disabled = append(disabled, region.Name)
			continue
		}
		if region.Level != 2 {
			invalidLevel = append(invalidLevel, region.Name)
			continue
		}
		if _, ok := openCityMap[code]; !ok {
			notOpen = append(notOpen, region.Name)
		}
	}

	if len(notFound) > 0 {
		return fmt.Errorf("以下地区代码不存在: %v", notFound)
	}
	if len(disabled) > 0 {
		return fmt.Errorf("以下服务城市已被禁用: %v", disabled)
	}
	if len(invalidLevel) > 0 {
		return fmt.Errorf("以下地区不是地级市: %v", invalidLevel)
	}
	if len(notOpen) > 0 {
		return fmt.Errorf("以下服务城市暂未开放: %v", notOpen)
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
		return nil, fmt.Errorf("解析服务城市失败: %v", err)
	}

	return codes, nil
}

// RollupServiceAreaInputsToCityCodes 将服务区域输入回卷到地级市代码。
// 输入既可为区域代码，也可为区域名称；区县级会回卷到所属城市。
func (s *RegionService) RollupServiceAreaInputsToCityCodes(inputs []string) ([]string, error) {
	normalizedInputs := normalizeRegionInputs(inputs)
	if len(normalizedInputs) == 0 {
		return []string{}, nil
	}

	var regions []model.Region
	if err := repository.DB.
		Where("code IN ? OR name IN ?", normalizedInputs, normalizedInputs).
		Find(&regions).Error; err != nil {
		return nil, fmt.Errorf("查询服务城市失败: %v", err)
	}

	codeToRegion := make(map[string]model.Region, len(regions))
	nameToRegion := make(map[string]model.Region, len(regions))
	for _, region := range regions {
		codeToRegion[region.Code] = region
		if _, exists := nameToRegion[region.Name]; !exists {
			nameToRegion[region.Name] = region
		}
	}

	cityCodes := make([]string, 0, len(normalizedInputs))
	seen := make(map[string]struct{}, len(normalizedInputs))
	for _, input := range normalizedInputs {
		region, ok := codeToRegion[input]
		if !ok {
			region, ok = nameToRegion[input]
		}
		if !ok {
			continue
		}

		targetCode := ""
		switch region.Level {
		case 2:
			targetCode = region.Code
		case 3:
			targetCode = strings.TrimSpace(region.ParentCode)
		default:
			continue
		}
		if targetCode == "" {
			continue
		}
		if _, exists := seen[targetCode]; exists {
			continue
		}
		seen[targetCode] = struct{}{}
		cityCodes = append(cityCodes, targetCode)
	}

	return cityCodes, nil
}

// ResolveServiceAreaInputsToCityDisplay 将服务区域输入统一转换成地级市代码与名称。
func (s *RegionService) ResolveServiceAreaInputsToCityDisplay(inputs []string) ([]string, []string, error) {
	cityCodes, err := s.RollupServiceAreaInputsToCityCodes(inputs)
	if err != nil {
		return nil, nil, err
	}

	cityNames, err := s.ConvertCodesToNames(cityCodes)
	if err != nil {
		return cityCodes, nil, err
	}

	return cityCodes, cityNames, nil
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

// ListOpenServiceProvinces 返回当前有开放服务城市的省份
func (s *RegionService) ListOpenServiceProvinces() ([]ServiceRegionDTO, error) {
	cities, err := s.ListOpenServiceCities()
	if err != nil {
		return nil, err
	}

	provinceMap := make(map[string]ServiceRegionDTO)
	ordered := make([]ServiceRegionDTO, 0)
	for _, city := range cities {
		if _, exists := provinceMap[city.ParentCode]; exists {
			continue
		}
		item := ServiceRegionDTO{
			Code: city.ParentCode,
			Name: city.ParentName,
		}
		provinceMap[city.ParentCode] = item
		ordered = append(ordered, item)
	}

	return ordered, nil
}

// ListOpenServiceCities 返回当前开放可选的服务城市
func (s *RegionService) ListOpenServiceCities() ([]ServiceRegionDTO, error) {
	records, err := s.listServiceEnabledCityRecords()
	if err != nil {
		return nil, err
	}

	items := make([]ServiceRegionDTO, 0, len(records))
	for _, record := range records {
		items = append(items, ServiceRegionDTO{
			Code:       record.Code,
			Name:       record.Name,
			ParentCode: record.ParentCode,
			ParentName: record.ParentName,
		})
	}

	return items, nil
}

// SyncOpenServiceDictionariesFromRegionsTx 按 regions.service_enabled 重建开放省市字典（兼容期双写）
func (s *RegionService) SyncOpenServiceDictionariesFromRegionsTx(tx *gorm.DB) error {
	if tx == nil {
		tx = repository.DB
	}

	records, err := s.listEnabledCityRecordsTx(tx)
	if err != nil {
		return err
	}

	provinceRows := make([]model.SystemDictionary, 0)
	cityRows := make([]model.SystemDictionary, 0)

	type provinceStats struct {
		totalEnabled int
		openEnabled  int
	}

	provinceOrder := make([]string, 0)
	provinceSeen := make(map[string]struct{})
	provinceStatsMap := make(map[string]*provinceStats)
	openCityByProvince := make(map[string][]serviceCityRecord)

	for _, record := range records {
		if _, ok := provinceSeen[record.ParentCode]; !ok {
			provinceSeen[record.ParentCode] = struct{}{}
			provinceOrder = append(provinceOrder, record.ParentCode)
		}
		stats := provinceStatsMap[record.ParentCode]
		if stats == nil {
			stats = &provinceStats{}
			provinceStatsMap[record.ParentCode] = stats
		}
		stats.totalEnabled++
		if record.ServiceEnabled {
			stats.openEnabled++
			openCityByProvince[record.ParentCode] = append(openCityByProvince[record.ParentCode], record)
		}
	}

	provinceSortOrder := 1
	citySortOrder := 1
	for _, provinceCode := range provinceOrder {
		stats := provinceStatsMap[provinceCode]
		if stats == nil || stats.totalEnabled == 0 || stats.openEnabled == 0 {
			continue
		}
		if stats.openEnabled == stats.totalEnabled {
			provinceRows = append(provinceRows, model.SystemDictionary{
				CategoryCode: openServiceProvincesCategory,
				Value:        provinceCode,
				Label:        openCityByProvince[provinceCode][0].ParentName,
				Description:  "由行政区划服务开放状态自动同步",
				SortOrder:    provinceSortOrder,
				Enabled:      true,
			})
			provinceSortOrder++
			continue
		}
		for _, city := range openCityByProvince[provinceCode] {
			cityRows = append(cityRows, model.SystemDictionary{
				CategoryCode: openServiceCitiesCategory,
				Value:        city.Code,
				Label:        city.Name,
				Description:  "由行政区划服务开放状态自动同步",
				SortOrder:    citySortOrder,
				Enabled:      true,
			})
			citySortOrder++
		}
	}

	if err := s.ensureOpenServiceDictionaryCategoriesTx(tx); err != nil {
		return err
	}
	if err := tx.Where("category_code IN ?", []string{openServiceProvincesCategory, openServiceCitiesCategory}).
		Delete(&model.SystemDictionary{}).Error; err != nil {
		return err
	}
	if len(provinceRows) > 0 {
		if err := tx.Create(&provinceRows).Error; err != nil {
			return err
		}
	}
	if len(cityRows) > 0 {
		if err := tx.Create(&cityRows).Error; err != nil {
			return err
		}
	}

	cache := NewDictCacheService()
	_ = cache.DeleteDictCache(openServiceProvincesCategory)
	_ = cache.DeleteDictCache(openServiceCitiesCategory)
	return nil
}

func (s *RegionService) listEnabledCityRecords() ([]serviceCityRecord, error) {
	return s.listEnabledCityRecordsTx(repository.DB)
}

func (s *RegionService) listEnabledCityRecordsTx(tx *gorm.DB) ([]serviceCityRecord, error) {
	if tx == nil {
		tx = repository.DB
	}
	var records []serviceCityRecord
	err := tx.Table("regions AS city").
		Select(`
			city.code AS code,
			city.name AS name,
			city.parent_code AS parent_code,
			province.name AS parent_name,
			province.sort_order AS province_sort_order,
			city.sort_order AS city_sort_order,
			city.service_enabled AS service_enabled
		`).
		Joins("JOIN regions AS province ON province.code = city.parent_code").
		Where("city.level = ? AND city.enabled = ? AND province.enabled = ?", 2, true, true).
		Order("province.sort_order ASC, province.code ASC, city.sort_order ASC, city.code ASC").
		Scan(&records).Error
	if err != nil {
		return nil, err
	}
	return records, nil
}

func (s *RegionService) listServiceEnabledCityRecords() ([]serviceCityRecord, error) {
	var records []serviceCityRecord
	err := repository.DB.Table("regions AS city").
		Select(`
			city.code AS code,
			city.name AS name,
			city.parent_code AS parent_code,
			province.name AS parent_name,
			province.sort_order AS province_sort_order,
			city.sort_order AS city_sort_order,
			city.service_enabled AS service_enabled
		`).
		Joins("JOIN regions AS province ON province.code = city.parent_code").
		Where("city.level = ? AND city.enabled = ? AND city.service_enabled = ? AND province.enabled = ?", 2, true, true, true).
		Order("province.sort_order ASC, province.code ASC, city.sort_order ASC, city.code ASC").
		Scan(&records).Error
	if err != nil {
		return nil, err
	}
	return records, nil
}

func (s *RegionService) ensureOpenServiceDictionaryCategoriesTx(tx *gorm.DB) error {
	if tx == nil {
		tx = repository.DB
	}
	rows := []model.DictionaryCategory{
		{
			Code:        openServiceProvincesCategory,
			Name:        "开放服务省份",
			Description: "控制哪些省份下的已启用地级市对外开放",
			SortOrder:   13,
			Enabled:     true,
		},
		{
			Code:        openServiceCitiesCategory,
			Name:        "开放服务城市",
			Description: "补充追加开放单个地级市",
			SortOrder:   14,
			Enabled:     true,
		},
	}
	for _, row := range rows {
		if err := tx.Where("code = ?", row.Code).
			Assign(map[string]interface{}{
				"name":        row.Name,
				"description": row.Description,
				"sort_order":  row.SortOrder,
				"enabled":     true,
			}).
			FirstOrCreate(&model.DictionaryCategory{Code: row.Code}).Error; err != nil {
			return err
		}
	}
	return nil
}

func normalizeRegionInputs(items []string) []string {
	result := make([]string, 0, len(items))
	for _, item := range items {
		trimmed := strings.TrimSpace(item)
		if trimmed != "" {
			result = append(result, trimmed)
		}
	}
	return result
}

func dedupeRegionCodes(items []string) []string {
	seen := make(map[string]struct{}, len(items))
	result := make([]string, 0, len(items))
	for _, item := range items {
		if _, exists := seen[item]; exists {
			continue
		}
		seen[item] = struct{}{}
		result = append(result, item)
	}
	return result
}
