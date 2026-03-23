//go:build ignore
// +build ignore

package main

import (
	"encoding/json"
	"fmt"
	"log"
	"strings"

	"home-decoration-server/internal/config"
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
)

type auditRecord struct {
	ID          uint64
	ServiceArea string
}

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("加载配置失败: %v", err)
	}
	if err := repository.InitDB(&cfg.Database); err != nil {
		log.Fatalf("连接数据库失败: %v", err)
	}

	regionByCode, err := loadRegions()
	if err != nil {
		log.Fatalf("加载行政区划失败: %v", err)
	}

	auditTable("providers", regionByCode)
	auditTable("merchant_applications", regionByCode)
}

func loadRegions() (map[string]model.Region, error) {
	var regions []model.Region
	if err := repository.DB.Find(&regions).Error; err != nil {
		return nil, err
	}
	result := make(map[string]model.Region, len(regions))
	for _, region := range regions {
		result[region.Code] = region
	}
	return result, nil
}

func auditTable(tableName string, regionByCode map[string]model.Region) {
	var records []auditRecord
	if err := repository.DB.Table(tableName).
		Select("id, service_area").
		Where("service_area IS NOT NULL AND TRIM(service_area) != ''").
		Order("id ASC").
		Find(&records).Error; err != nil {
		log.Printf("[%s] 查询失败: %v", tableName, err)
		return
	}

	total := len(records)
	valid := 0
	invalid := 0
	samples := make([]string, 0, 10)

	for _, record := range records {
		items, err := parseJSON(record.ServiceArea)
		if err != nil {
			invalid++
			if len(samples) < 10 {
				samples = append(samples, fmt.Sprintf("%s#%d: 非 JSON 数组 -> %s", tableName, record.ID, record.ServiceArea))
			}
			continue
		}

		recordValid := true
		for _, code := range items {
			region, ok := regionByCode[code]
			if !ok || !region.Enabled || region.Level != 2 {
				recordValid = false
				if len(samples) < 10 {
					samples = append(samples, fmt.Sprintf("%s#%d: 非法城市代码 %q", tableName, record.ID, code))
				}
				break
			}
		}

		if recordValid {
			valid++
		} else {
			invalid++
		}
	}

	log.Printf("[%s] total=%d valid=%d invalid=%d", tableName, total, valid, invalid)
	for _, sample := range samples {
		log.Printf("[%s] sample: %s", tableName, sample)
	}
}

func parseJSON(raw string) ([]string, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return []string{}, nil
	}
	var items []string
	if err := json.Unmarshal([]byte(trimmed), &items); err != nil {
		return nil, err
	}
	return items, nil
}
