//go:build ignore
// +build ignore

package main

import (
	"fmt"
	"log"

	"home-decoration-server/internal/config"
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
)

// 测试数据标记前缀 - 与 seed_test_data.go 保持一致
const TEST_PREFIX = "[TEST]"

func main() {
	// 加载配置
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("配置加载失败: %v", err)
	}

	// 连接数据库
	if err := repository.InitDB(&cfg.Database); err != nil {
		log.Fatalf("数据库连接失败: %v", err)
	}

	db := repository.DB

	fmt.Println("========================================")
	fmt.Println("开始清理测试数据...")
	fmt.Println("测试数据前缀:", TEST_PREFIX)
	fmt.Println("========================================")

	// 注意：按照外键依赖的反向顺序删除

	// 1. 删除测试施工日志 (description 包含 TEST_PREFIX)
	result := db.Where("description LIKE ?", "%"+TEST_PREFIX+"%").Delete(&model.WorkLog{})
	fmt.Printf("🗑️ 删除 %d 条施工日志\n", result.RowsAffected)

	// 2. 获取测试项目ID
	var testProjects []model.Project
	db.Where("name LIKE ?", TEST_PREFIX+"%").Find(&testProjects)
	projectIDs := make([]uint64, len(testProjects))
	for i, p := range testProjects {
		projectIDs[i] = p.ID
	}

	if len(projectIDs) > 0 {
		// 3. 删除测试交易记录
		var escrowIDs []uint64
		db.Model(&model.EscrowAccount{}).Where("project_id IN ?", projectIDs).Pluck("id", &escrowIDs)
		if len(escrowIDs) > 0 {
			result = db.Where("escrow_id IN ?", escrowIDs).Delete(&model.Transaction{})
			fmt.Printf("🗑️ 删除 %d 条交易记录\n", result.RowsAffected)
		}

		// 4. 删除测试托管账户
		result = db.Where("project_id IN ?", projectIDs).Delete(&model.EscrowAccount{})
		fmt.Printf("🗑️ 删除 %d 个托管账户\n", result.RowsAffected)

		// 5. 删除测试里程碑
		result = db.Where("project_id IN ?", projectIDs).Delete(&model.Milestone{})
		fmt.Printf("🗑️ 删除 %d 个里程碑\n", result.RowsAffected)
	}

	// 6. 删除测试项目
	result = db.Where("name LIKE ?", TEST_PREFIX+"%").Delete(&model.Project{})
	fmt.Printf("🗑️ 删除 %d 个项目\n", result.RowsAffected)

	// 7. 获取测试用户ID
	var testUsers []model.User
	db.Where("nickname LIKE ?", TEST_PREFIX+"%").Find(&testUsers)
	userIDs := make([]uint64, len(testUsers))
	for i, u := range testUsers {
		userIDs[i] = u.ID
	}

	if len(userIDs) > 0 {
		// 8. 删除测试工人
		result = db.Where("user_id IN ?", userIDs).Delete(&model.Worker{})
		fmt.Printf("🗑️ 删除 %d 个工人\n", result.RowsAffected)

		// 9. 删除测试服务商
		result = db.Where("company_name LIKE ?", TEST_PREFIX+"%").Delete(&model.Provider{})
		fmt.Printf("🗑️ 删除 %d 个服务商\n", result.RowsAffected)
	}

	// 10. 删除测试用户
	result = db.Where("nickname LIKE ?", TEST_PREFIX+"%").Delete(&model.User{})
	fmt.Printf("🗑️ 删除 %d 个用户\n", result.RowsAffected)

	fmt.Println("========================================")
	fmt.Println("✅ 测试数据清理完成！")
	fmt.Println("========================================")
}
