//go:build ignore
// +build ignore

package main

import (
	"fmt"
	"home-decoration-server/internal/config"
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	"log"
)

func main() {
	// 加载配置
	cfg := config.GetConfig()

	// 初始化数据库
	repository.InitDB(&cfg.Database)

	// 查询所有可见菜单
	var menus []model.SysMenu
	repository.DB.Where("visible = true AND status = 1 AND type IN (1, 2)").
		Order("sort ASC, id ASC").
		Find(&menus)

	fmt.Println("\n========== 所有可见菜单 ==========")
	fmt.Printf("共 %d 条记录\n\n", len(menus))
	fmt.Printf("%-5s %-10s %-20s %-6s %-30s %-6s\n", "ID", "ParentID", "Title", "Type", "Path", "Sort")
	fmt.Println("-----------------------------------------------------------------------------------")

	// 用于检测重复
	titleCount := make(map[string]int)
	pathCount := make(map[string]int)

	for _, m := range menus {
		typeStr := "目录"
		if m.Type == 2 {
			typeStr = "菜单"
		}
		fmt.Printf("%-5d %-10d %-20s %-6s %-30s %-6d\n",
			m.ID, m.ParentID, m.Title, typeStr, m.Path, m.Sort)

		titleCount[m.Title]++
		if m.Path != "" {
			pathCount[m.Path]++
		}
	}

	// 检查重复的标题
	fmt.Println("\n========== 重复的菜单标题 ==========")
	hasDuplicate := false
	for title, count := range titleCount {
		if count > 1 {
			fmt.Printf("⚠️  \"%s\" 出现了 %d 次\n", title, count)
			hasDuplicate = true

			// 显示重复项的详细信息
			var duplicates []model.SysMenu
			repository.DB.Where("title = ? AND visible = true AND status = 1", title).
				Order("id ASC").Find(&duplicates)
			for _, dup := range duplicates {
				fmt.Printf("   - ID: %d, ParentID: %d, Type: %d, Path: %s, Sort: %d\n",
					dup.ID, dup.ParentID, dup.Type, dup.Path, dup.Sort)
			}
		}
	}
	if !hasDuplicate {
		fmt.Println("✅ 没有重复的标题")
	}

	// 检查重复的路径
	fmt.Println("\n========== 重复的菜单路径 ==========")
	hasDuplicatePath := false
	for path, count := range pathCount {
		if count > 1 && path != "" {
			fmt.Printf("⚠️  \"%s\" 出现了 %d 次\n", path, count)
			hasDuplicatePath = true

			// 显示重复项的详细信息
			var duplicates []model.SysMenu
			repository.DB.Where("path = ? AND visible = true AND status = 1", path).
				Order("id ASC").Find(&duplicates)
			for _, dup := range duplicates {
				fmt.Printf("   - ID: %d, ParentID: %d, Title: %s, Type: %d, Sort: %d\n",
					dup.ID, dup.ParentID, dup.Title, dup.Type, dup.Sort)
			}
		}
	}
	if !hasDuplicatePath {
		fmt.Println("✅ 没有重复的路径")
	}

	log.Println("\n检查完成")
}
