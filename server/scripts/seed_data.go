package main

import (
	"log"

	"home-decoration-server/internal/config"
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
)

func main() {
	// 加载配置
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// 初始化数据库
	if err := repository.InitDB(&cfg.Database); err != nil {
		log.Fatalf("Failed to connect database: %v", err)
	}

	// 1. 创建一个服务商用户
	providerUser := &model.User{
		Phone:    "13900139001",
		Nickname: "金牌设计师",
		UserType: 2, // 服务商
		Status:   1,
	}
	// 忽略错误（如果已存在）
	repository.DB.FirstOrCreate(providerUser, model.User{Phone: "13900139001"})

	// 2. 创建服务商记录
	provider := &model.Provider{
		UserID:       providerUser.ID,
		ProviderType: 1, // 设计师
		CompanyName:  "顶层设计工作室",
		Rating:       4.9,
		Verified:     true,
	}
	repository.DB.FirstOrCreate(provider, model.Provider{UserID: providerUser.ID})

	log.Printf("Created Provider: ID=%d, Name=%s", provider.ID, provider.CompanyName)
}
