package main

import (
	"log"
	"strings"

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

	counter := 0

	// 1. users.avatar
	var users []model.User
	repository.DB.Find(&users)
	for _, u := range users {
		if strings.Contains(u.Avatar, "unsplash.com") {
			repository.DB.Model(&u).Update("avatar", "/static/inspiration/default-avatar.png")
			counter++
		}
	}

	// 2. material_shops.cover and logo
	var shops []model.MaterialShop
	repository.DB.Find(&shops)
	for _, s := range shops {
		updates := make(map[string]interface{})
		if strings.Contains(s.Cover, "unsplash.com") {
			updates["cover"] = "/static/inspiration/default-cover.png"
			counter++
		}
		if strings.Contains(s.BrandLogo, "unsplash.com") {
			updates["brand_logo"] = "/static/inspiration/default-avatar.png"
			counter++
		}
		if len(updates) > 0 {
			repository.DB.Model(&s).Updates(updates)
		}
	}

	// 3. case_audits / provider cases（项目 Project 模型已无 cover_image 字段）
	var cases []model.ProviderCase
	repository.DB.Find(&cases)
	for _, c := range cases {
		if strings.Contains(c.CoverImage, "unsplash.com") {
			repository.DB.Model(&c).Update("cover_image", "/static/inspiration/default-cover.png")
			counter++
		}
	}

	log.Printf("Unsplash links removed from DB successfully! Updates: %d\n", counter)
}
