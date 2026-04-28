package main

import (
	"context"
	"log"

	"home-decoration-server/internal/config"
	"home-decoration-server/internal/cron"
	"home-decoration-server/internal/handler"
	"home-decoration-server/internal/repository"
	"home-decoration-server/internal/router"
	"home-decoration-server/internal/service"
	"home-decoration-server/internal/tinode"

	"github.com/gin-gonic/gin"
)

func main() {
	// 加载配置
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	if err := config.ValidateDatabaseSafety(cfg); err != nil {
		log.Fatalf("Database safety check failed: %v", err)
	}
	if err := config.ValidateProductionTransportSafety(cfg); err != nil {
		log.Fatalf("Production transport safety check failed: %v", err)
	}

	// 验证 Tinode 配置（启动时 fail-fast）
	if err := tinode.ValidateConfig(); err != nil {
		log.Printf("[Tinode] Configuration validation failed: %v", err)
		log.Println("[Tinode] Tinode features will be disabled")
		// 不阻塞启动，但记录警告
	}

	// 初始化数据库
	if err := repository.InitDB(&cfg.Database); err != nil {
		log.Fatalf("Failed to connect database: %v", err)
	}
	log.Println("Database connected successfully")
	if err := repository.EnsureCriticalSchema(cfg.Server.Mode); err != nil {
		log.Fatalf("Critical schema preflight failed: %v", err)
	}

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

	// 初始化通知实时推送
	notificationGateway := handler.InitNotificationRealtime(cfg.NotificationRealtime)
	if notificationGateway != nil {
		service.SetNotificationPublisher(service.NewNotificationPublisher(notificationGateway))
		log.Println("Notification realtime gateway enabled")
	} else {
		service.SetNotificationPublisher(nil)
		log.Println("Notification realtime gateway disabled")
	}

	service.StartOutboxWorker(context.Background(), service.BuildOutboxWorkerID("api"))

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

	cron.StartEscrowReleaseCron()
	log.Println("Escrow release cron job started")

	cron.StartAuditLogRetentionCron(cfg.Log.AuditRetentionDays)
	log.Printf("Audit log retention cron job started (retention=%d days)", service.ResolveAuditRetentionDays(cfg.Log.AuditRetentionDays))

	cron.StartFinanceReconciliationCron()
	log.Println("Finance reconciliation cron job started")

	cron.StartSettlementReconciliationCron()
	log.Println("Settlement reconciliation cron job started")

	cron.StartReconciliationAlertCron()
	log.Println("Reconciliation alert escalation cron job started")

	cron.StartPayoutQueryCron()
	log.Println("Payout query cron job started")

	cron.StartPaymentCompensationCron()
	log.Println("Payment compensation cron job started")

	cron.StartRefundReconciliationCron()
	log.Println("Refund reconciliation cron job started")

	cron.StartPaymentTimeoutCron()
	log.Println("Payment timeout cron job started")

	cron.StartPaymentReconciliationCron()
	log.Println("Payment reconciliation cron job started")

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
