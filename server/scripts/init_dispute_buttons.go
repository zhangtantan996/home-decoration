//go:build ignore
// +build ignore

package main

import (
	"fmt"
	"home-decoration-server/internal/model"
	"log"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func main() {
	dsn := "host=localhost user=postgres password=123456 dbname=home_decoration port=5432 sslmode=disable TimeZone=Asia/Shanghai"
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	// 1. 查找 "争议预约" 菜单
	var parentMenu model.SysMenu
	if err := db.Where("path = ?", "/bookings/disputed").First(&parentMenu).Error; err != nil {
		log.Fatalf("错误：找不到路径为 '/bookings/disputed' 的菜单。请确认您已在菜单管理中添加了'争议预约'菜单，并且路由路径填写正确。", err)
	}

	fmt.Printf("找到父菜单: %s (ID: %d)\n", parentMenu.Title, parentMenu.ID)

	// 2. 定义要添加的按钮
	buttons := []model.SysMenu{
		{
			ParentID:   parentMenu.ID,
			Title:      "查看详情",
			Type:       3, // 按钮
			Permission: "booking:dispute:detail",
			Sort:       1,
			Status:     1,
			Visible:    true,
			CreatedAt:  time.Now(),
			UpdatedAt:  time.Now(),
		},
		{
			ParentID:   parentMenu.ID,
			Title:      "处理争议",
			Type:       3, // 按钮
			Permission: "booking:dispute:resolve",
			Sort:       2,
			Status:     1,
			Visible:    true,
			CreatedAt:  time.Now(),
			UpdatedAt:  time.Now(),
		},
	}

	// 3. 插入按钮
	for _, btn := range buttons {
		var count int64
		db.Model(&model.SysMenu{}).Where("parent_id = ? AND permission = ?", btn.ParentID, btn.Permission).Count(&count)
		if count > 0 {
			fmt.Printf("按钮已存在: %s (%s)\n", btn.Title, btn.Permission)
			continue
		}

		if err := db.Create(&btn).Error; err != nil {
			log.Printf("创建按钮失败 %s: %v\n", btn.Title, err)
		} else {
			fmt.Printf("成功创建按钮: %s\n", btn.Title)
		}
	}

	fmt.Println("完成！请刷新菜单管理页面查看。")
}
