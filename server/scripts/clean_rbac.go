package main

import (
	"fmt"
	"home-decoration-server/internal/config"
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
)

func main() {
	// 加载配置
	cfg := config.GetConfig()

	// 初始化数据库
	repository.InitDB(&cfg.Database)

	fmt.Println("\n========== 开始清理重复菜单 ==========\n")

	// 1. 删除所有菜单和相关数据
	fmt.Println("🗑️  删除所有旧菜单数据...")

	// 删除角色-菜单关联
	result := repository.DB.Exec("DELETE FROM sys_role_menus")
	fmt.Printf("   删除 %d 条角色-菜单关联记录\n", result.RowsAffected)

	// 删除所有菜单
	result = repository.DB.Exec("DELETE FROM sys_menus")
	fmt.Printf("   删除 %d 条菜单记录\n", result.RowsAffected)

	// 删除所有角色
	result = repository.DB.Exec("DELETE FROM sys_roles")
	fmt.Printf("   删除 %d 条角色记录\n", result.RowsAffected)

	// 删除管理员-角色关联
	result = repository.DB.Exec("DELETE FROM sys_admin_roles")
	fmt.Printf("   删除 %d 条管理员-角色关联记录\n", result.RowsAffected)

	// 删除非超级管理员的管理员账号
	result = repository.DB.Where("is_super_admin = false").Delete(&model.SysAdmin{})
	fmt.Printf("   删除 %d 个普通管理员账号\n", result.RowsAffected)

	fmt.Println("\n✅ 清理完成！")
	fmt.Println("\n💡 请重新运行初始化脚本: go run scripts/seed_rbac_full.go")
}
