package main

import (
	"log"

	"home-decoration-server/internal/config"
	"home-decoration-server/internal/cron"
	"home-decoration-server/internal/handler"
	"home-decoration-server/internal/repository"
	"home-decoration-server/internal/router"
	"home-decoration-server/internal/service"

	"github.com/gin-gonic/gin"
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
	log.Println("Database connected successfully")

	// 初始化 Tinode 数据库（失败不阻塞主流程）
	if err := repository.InitTinodeDB(&cfg.Database); err != nil {
		log.Printf("[Tinode] Failed to connect Tinode database: %v", err)
	} else {
		log.Println("[Tinode] Tinode database connected successfully")
	}

	// 初始化Redis
	if err := repository.InitRedis(&cfg.Redis); err != nil {
		log.Fatalf("Failed to connect Redis: %v", err)
	}
	log.Println("Redis connected successfully")

	// 初始化处理器
	handler.InitHandlers(cfg)

	// 初始化数据字典相关
	dictRepo := repository.NewDictionaryRepository(repository.DB)
	dictCache := service.NewDictCacheService()
	dictService := service.NewDictionaryService(dictRepo, dictCache)
	dictHandler := handler.NewDictionaryHandler(dictService)

	// 启动定时任务
	cron.StartOrderCron()
	log.Println("Order cron job started")

	cron.StartBookingCron()
	log.Println("Booking cron job started")

	cron.StartIncomeCron()
	log.Println("Income settlement cron job started")

	// 设置运行模式
	if cfg.Server.Mode == "release" {
		gin.SetMode(gin.ReleaseMode)
	}

	// 初始化路由
	r := router.Setup(cfg, dictHandler)

	// 启动服务
	addr := cfg.Server.Host + ":" + cfg.Server.Port
	log.Printf("Server starting on %s", addr)
	if err := r.Run(addr); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
