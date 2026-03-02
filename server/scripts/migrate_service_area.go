//go:build ignore
// +build ignore

package main

import (
	"encoding/json"
	"fmt"
	"log"
	"os"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

// Region 区域模型（简化版）
type Region struct {
	ID         uint64 `json:"id" gorm:"primaryKey"`
	Code       string `json:"code"`
	Name       string `json:"name"`
	Level      int    `json:"level"`
	ParentCode string `json:"parentCode"`
	Enabled    bool   `json:"enabled"`
}

// Provider 服务商模型（简化版）
type Provider struct {
	ID          uint64 `gorm:"primaryKey"`
	ServiceArea string `gorm:"type:text"`
}

// MerchantApplication 商家入驻申请模型（简化版）
type MerchantApplication struct {
	ID          uint64 `gorm:"primaryKey"`
	ServiceArea string `gorm:"type:text"`
}

func main() {
	// 数据库连接配置（请根据实际情况修改）
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		dsn = "host=localhost user=postgres password=postgres dbname=home_decoration port=5432 sslmode=disable"
	}

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatal("连接数据库失败:", err)
	}

	// 1. 加载所有区域数据，构建名称到代码的映射
	var regions []Region
	if err := db.Find(&regions).Error; err != nil {
		log.Fatal("查询区域数据失败:", err)
	}

	nameToCode := make(map[string]string)
	for _, r := range regions {
		nameToCode[r.Name] = r.Code
	}

	fmt.Printf("加载了 %d 个区域映射\n", len(nameToCode))

	// 2. 迁移 providers 表
	migrateProviders(db, nameToCode)

	// 3. 迁移 merchant_applications 表
	migrateMerchantApplications(db, nameToCode)

	fmt.Println("✅ 数据迁移完成！")
}

func migrateProviders(db *gorm.DB, nameToCode map[string]string) {
	var providers []Provider
	if err := db.Where("service_area IS NOT NULL AND service_area != ''").Find(&providers).Error; err != nil {
		log.Fatal("查询 providers 失败:", err)
	}

	successCount := 0
	failCount := 0

	for _, provider := range providers {
		// 解析现有的 service_area
		var names []string
		if err := json.Unmarshal([]byte(provider.ServiceArea), &names); err != nil {
			// 如果解析失败，可能是旧格式或空字符串
			fmt.Printf("⚠️  Provider ID %d: 解析失败 - %s\n", provider.ID, provider.ServiceArea)
			failCount++
			continue
		}

		// 转换名称为代码
		codes := make([]string, 0)
		allFound := true
		for _, name := range names {
			if code, ok := nameToCode[name]; ok {
				codes = append(codes, code)
			} else {
				fmt.Printf("⚠️  Provider ID %d: 未找到区域 '%s' 的代码\n", provider.ID, name)
				allFound = false
			}
		}

		if !allFound {
			failCount++
			continue
		}

		// 序列化为 JSON
		codesJSON, _ := json.Marshal(codes)

		// 更新数据库
		if err := db.Model(&Provider{}).Where("id = ?", provider.ID).
			Update("service_area", string(codesJSON)).Error; err != nil {
			fmt.Printf("❌ Provider ID %d: 更新失败 - %v\n", provider.ID, err)
			failCount++
			continue
		}

		fmt.Printf("✅ Provider ID %d: %v → %v\n", provider.ID, names, codes)
		successCount++
	}

	fmt.Printf("\n📊 Providers 迁移统计: 成功 %d, 失败 %d, 总计 %d\n\n",
		successCount, failCount, len(providers))
}

func migrateMerchantApplications(db *gorm.DB, nameToCode map[string]string) {
	var applications []MerchantApplication
	if err := db.Where("service_area IS NOT NULL AND service_area != ''").
		Find(&applications).Error; err != nil {
		log.Fatal("查询 merchant_applications 失败:", err)
	}

	successCount := 0
	failCount := 0

	for _, app := range applications {
		// 解析现有的 service_area
		var names []string
		if err := json.Unmarshal([]byte(app.ServiceArea), &names); err != nil {
			fmt.Printf("⚠️  Application ID %d: 解析失败 - %s\n", app.ID, app.ServiceArea)
			failCount++
			continue
		}

		// 转换名称为代码
		codes := make([]string, 0)
		allFound := true
		for _, name := range names {
			if code, ok := nameToCode[name]; ok {
				codes = append(codes, code)
			} else {
				fmt.Printf("⚠️  Application ID %d: 未找到区域 '%s' 的代码\n", app.ID, name)
				allFound = false
			}
		}

		if !allFound {
			failCount++
			continue
		}

		// 序列化为 JSON
		codesJSON, _ := json.Marshal(codes)

		// 更新数据库
		if err := db.Model(&MerchantApplication{}).Where("id = ?", app.ID).
			Update("service_area", string(codesJSON)).Error; err != nil {
			fmt.Printf("❌ Application ID %d: 更新失败 - %v\n", app.ID, err)
			failCount++
			continue
		}

		fmt.Printf("✅ Application ID %d: %v → %v\n", app.ID, names, codes)
		successCount++
	}

	fmt.Printf("\n📊 MerchantApplications 迁移统计: 成功 %d, 失败 %d, 总计 %d\n\n",
		successCount, failCount, len(applications))
}
