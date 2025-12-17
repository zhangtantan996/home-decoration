package main

import (
	"log"

	"home-decoration-server/internal/config"
	"home-decoration-server/internal/handler"
	"home-decoration-server/internal/repository"
	"home-decoration-server/internal/router"

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

	// 初始化处理器
	handler.InitHandlers(cfg)

	// 设置运行模式
	if cfg.Server.Mode == "release" {
		gin.SetMode(gin.ReleaseMode)
	}

	// 初始化路由
	r := router.Setup(cfg)

	// 启动服务
	addr := cfg.Server.Host + ":" + cfg.Server.Port
	log.Printf("Server starting on %s", addr)
	if err := r.Run(addr); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
