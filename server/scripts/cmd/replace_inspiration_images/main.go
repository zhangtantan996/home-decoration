package main

import (
	"encoding/json"
	"fmt"
	"log"

	"home-decoration-server/internal/config"
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("load config: %v", err)
	}

	if err := repository.InitDB(&cfg.Database); err != nil {
		log.Fatalf("init db: %v", err)
	}

	// 1. 我们有5张新生成的图片
	images := []string{
		"/static/inspiration/modern_minimalist_living_room.png",
		"/static/inspiration/nordic_style_bedroom.png",
		"/static/inspiration/new_chinese_style_tea_room.png",
		"/static/inspiration/luxury_open_kitchen.png",
		"/static/inspiration/industrial_loft_office.png",
	}

	var cases []model.ProviderCase
	if err := repository.DB.Find(&cases).Error; err != nil {
		log.Fatalf("query cases: %v", err)
	}

	updated := 0
	for i, c := range cases {
		// 分配一张图片作为封面，循环使用
		coverImgUrl := images[i%len(images)]

		// 构造一个包含这五张图的 JSON 数组用于详情页图库展示
		imagesArrayBytes, _ := json.Marshal(images)

		fmt.Printf("Updating Case %d: %s -> %s\n", c.ID, c.Title, coverImgUrl)

		if err := repository.DB.Model(&model.ProviderCase{}).
			Where("id = ?", c.ID).
			Updates(map[string]interface{}{
				"cover_image": coverImgUrl,
				"images":      string(imagesArrayBytes),
			}).Error; err != nil {
			log.Printf("Failed to update case %d: %v", c.ID, err)
		} else {
			updated++
		}
	}

	fmt.Printf("\nSuccessfully updated %d records!\n", updated)
}
