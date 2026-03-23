//go:build ignore
// +build ignore

package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"strings"

	"home-decoration-server/internal/config"
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
)

type serviceAreaCarrier interface {
	GetID() uint64
	GetServiceArea() string
	SetServiceArea(string)
}

type providerCarrier struct{ model.Provider }

func (p *providerCarrier) GetID() uint64           { return p.ID }
func (p *providerCarrier) GetServiceArea() string  { return p.ServiceArea }
func (p *providerCarrier) SetServiceArea(v string) { p.ServiceArea = v }

type merchantApplicationCarrier struct{ model.MerchantApplication }

func (m *merchantApplicationCarrier) GetID() uint64           { return m.ID }
func (m *merchantApplicationCarrier) GetServiceArea() string  { return m.ServiceArea }
func (m *merchantApplicationCarrier) SetServiceArea(v string) { m.ServiceArea = v }

type migrationStats struct {
	TableName          string
	Total              int
	Updated            int
	Unchanged          int
	DroppedValueCount  int
	RolledUpValueCount int
	Samples            []string
}

func (s *migrationStats) addSample(format string, args ...any) {
	if len(s.Samples) >= 10 {
		return
	}
	s.Samples = append(s.Samples, fmt.Sprintf(format, args...))
}

func main() {
	apply := flag.Bool("apply", false, "写回数据库；默认仅预演")
	flag.Parse()

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("加载配置失败: %v", err)
	}
	if err := repository.InitDB(&cfg.Database); err != nil {
		log.Fatalf("连接数据库失败: %v", err)
	}

	regionByCode, nameToRegion, err := loadRegionLookups()
	if err != nil {
		log.Fatalf("加载行政区划失败: %v", err)
	}

	providerStats, err := migrateProviders(regionByCode, nameToRegion, *apply)
	if err != nil {
		log.Fatalf("迁移 providers 失败: %v", err)
	}
	appStats, err := migrateMerchantApplications(regionByCode, nameToRegion, *apply)
	if err != nil {
		log.Fatalf("迁移 merchant_applications 失败: %v", err)
	}

	printStats(providerStats, *apply)
	printStats(appStats, *apply)
	if *apply {
		log.Println("✅ 服务城市迁移已写回数据库")
	} else {
		log.Println("✅ 服务城市迁移预演完成（未写库）")
	}
}

func loadRegionLookups() (map[string]model.Region, map[string]model.Region, error) {
	var regions []model.Region
	if err := repository.DB.Find(&regions).Error; err != nil {
		return nil, nil, err
	}

	regionByCode := make(map[string]model.Region, len(regions))
	nameToRegion := make(map[string]model.Region, len(regions))
	for _, region := range regions {
		regionByCode[region.Code] = region
		if _, exists := nameToRegion[region.Name]; !exists {
			nameToRegion[region.Name] = region
		}
	}
	return regionByCode, nameToRegion, nil
}

func migrateProviders(regionByCode, nameToRegion map[string]model.Region, apply bool) (*migrationStats, error) {
	var providers []model.Provider
	if err := repository.DB.Where("service_area IS NOT NULL AND TRIM(service_area) != ''").Find(&providers).Error; err != nil {
		return nil, err
	}

	stats := &migrationStats{TableName: "providers", Total: len(providers)}
	for _, item := range providers {
		carrier := &providerCarrier{Provider: item}
		changed, err := migrateOneRecord("providers", carrier, regionByCode, nameToRegion, apply, stats)
		if err != nil {
			return nil, err
		}
		if changed {
			stats.Updated++
		} else {
			stats.Unchanged++
		}
	}
	return stats, nil
}

func migrateMerchantApplications(regionByCode, nameToRegion map[string]model.Region, apply bool) (*migrationStats, error) {
	var items []model.MerchantApplication
	if err := repository.DB.Where("service_area IS NOT NULL AND TRIM(service_area) != ''").Find(&items).Error; err != nil {
		return nil, err
	}

	stats := &migrationStats{TableName: "merchant_applications", Total: len(items)}
	for _, item := range items {
		carrier := &merchantApplicationCarrier{MerchantApplication: item}
		changed, err := migrateOneRecord("merchant_applications", carrier, regionByCode, nameToRegion, apply, stats)
		if err != nil {
			return nil, err
		}
		if changed {
			stats.Updated++
		} else {
			stats.Unchanged++
		}
	}
	return stats, nil
}

func migrateOneRecord(
	tableName string,
	record serviceAreaCarrier,
	regionByCode map[string]model.Region,
	nameToRegion map[string]model.Region,
	apply bool,
	stats *migrationStats,
) (bool, error) {
	originalItems := parseRawServiceArea(record.GetServiceArea())
	nextCodes, rolledUp, dropped, sampleNotes := transformServiceAreaItems(originalItems, regionByCode, nameToRegion)
	stats.RolledUpValueCount += rolledUp
	stats.DroppedValueCount += dropped
	for _, note := range sampleNotes {
		stats.addSample("%s#%d: %s", tableName, record.GetID(), note)
	}

	nextJSONBytes, _ := json.Marshal(nextCodes)
	nextJSON := string(nextJSONBytes)
	changed := normalizeJSONString(record.GetServiceArea()) != nextJSON

	if !apply || !changed {
		return changed, nil
	}

	if err := repository.DB.Table(tableName).
		Where("id = ?", record.GetID()).
		Update("service_area", nextJSON).Error; err != nil {
		return false, err
	}

	record.SetServiceArea(nextJSON)
	return true, nil
}

func parseRawServiceArea(raw string) []string {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return []string{}
	}

	var items []string
	if err := json.Unmarshal([]byte(trimmed), &items); err == nil {
		return normalizeStringSlice(items)
	}

	parts := strings.FieldsFunc(trimmed, func(r rune) bool {
		return r == ',' || r == '，' || r == ';' || r == '；'
	})
	return normalizeStringSlice(parts)
}

func transformServiceAreaItems(
	items []string,
	regionByCode map[string]model.Region,
	nameToRegion map[string]model.Region,
) (codes []string, rolledUp int, dropped int, samples []string) {
	seen := make(map[string]struct{})
	for _, item := range items {
		region, resolved, ok := resolveRegion(item, regionByCode, nameToRegion)
		if !ok {
			dropped++
			samples = append(samples, fmt.Sprintf("丢弃无法识别值 %q", item))
			continue
		}

		targetCode := ""
		switch region.Level {
		case 2:
			targetCode = region.Code
		case 3:
			targetCode = strings.TrimSpace(region.ParentCode)
			rolledUp++
			samples = append(samples, fmt.Sprintf("区县 %q(%s) 回卷到城市 %s", region.Name, resolved, targetCode))
		default:
			dropped++
			samples = append(samples, fmt.Sprintf("丢弃非城市粒度值 %q(%s)", region.Name, resolved))
			continue
		}

		if targetCode == "" {
			dropped++
			samples = append(samples, fmt.Sprintf("丢弃缺少父城市的值 %q(%s)", region.Name, resolved))
			continue
		}
		if _, exists := seen[targetCode]; exists {
			continue
		}
		seen[targetCode] = struct{}{}
		codes = append(codes, targetCode)
	}

	return codes, rolledUp, dropped, samples
}

func resolveRegion(input string, regionByCode map[string]model.Region, nameToRegion map[string]model.Region) (model.Region, string, bool) {
	trimmed := strings.TrimSpace(input)
	if trimmed == "" {
		return model.Region{}, "", false
	}
	if region, ok := regionByCode[trimmed]; ok {
		return region, trimmed, true
	}
	if region, ok := nameToRegion[trimmed]; ok {
		return region, region.Code, true
	}
	return model.Region{}, "", false
}

func normalizeStringSlice(items []string) []string {
	result := make([]string, 0, len(items))
	for _, item := range items {
		trimmed := strings.TrimSpace(item)
		if trimmed != "" {
			result = append(result, trimmed)
		}
	}
	return result
}

func normalizeJSONString(raw string) string {
	items := parseRawServiceArea(raw)
	bytes, _ := json.Marshal(items)
	return string(bytes)
}

func printStats(stats *migrationStats, apply bool) {
	mode := "DRY-RUN"
	if apply {
		mode = "APPLY"
	}
	log.Printf("[%s] %s: total=%d updated=%d unchanged=%d rolled_up=%d dropped=%d",
		mode,
		stats.TableName,
		stats.Total,
		stats.Updated,
		stats.Unchanged,
		stats.RolledUpValueCount,
		stats.DroppedValueCount,
	)
	for _, sample := range stats.Samples {
		log.Printf("[%s] sample: %s", stats.TableName, sample)
	}
}
