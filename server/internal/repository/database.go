package repository

import (
	"home-decoration-server/internal/config"
	"home-decoration-server/internal/model"
	"log"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

// InitDB 初始化数据库连接
func InitDB(cfg *config.DatabaseConfig) error {
	var err error

	DB, err = gorm.Open(postgres.Open(cfg.GetDSN()), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})

	if err != nil {
		return err
	}

	// Configure sql.DB connection pool (production safety default; configurable via config/env).
	sqlDB, err := DB.DB()
	if err != nil {
		return err
	}

	maxOpenConns := cfg.MaxOpenConns
	if maxOpenConns <= 0 {
		maxOpenConns = 25
	}
	maxIdleConns := cfg.MaxIdleConns
	if maxIdleConns < 0 {
		maxIdleConns = 0
	}
	if maxIdleConns > maxOpenConns {
		maxIdleConns = maxOpenConns
	}

	sqlDB.SetMaxOpenConns(maxOpenConns)
	sqlDB.SetMaxIdleConns(maxIdleConns)

	if cfg.ConnMaxLifetimeMinutes > 0 {
		sqlDB.SetConnMaxLifetime(time.Duration(cfg.ConnMaxLifetimeMinutes) * time.Minute)
	}
	if cfg.ConnMaxIdleTimeMinutes > 0 {
		sqlDB.SetConnMaxIdleTime(time.Duration(cfg.ConnMaxIdleTimeMinutes) * time.Minute)
	}

	log.Printf("Database pool configured: max_open_conns=%d max_idle_conns=%d conn_max_lifetime_minutes=%d conn_max_idle_time_minutes=%d",
		maxOpenConns,
		maxIdleConns,
		cfg.ConnMaxLifetimeMinutes,
		cfg.ConnMaxIdleTimeMinutes,
	)

	// 自动迁移表结构
	// FIXME: GORM 1.30.0 与 PostgreSQL 驱动存在兼容性问题
	// 错误信息："insufficient arguments" 发生在检查表结构时
	// 临时解决方案：默认禁用 AutoMigrate，通过配置开关控制
	//
	// 迁移策略：
	// 1. 开发环境：可以启用 AutoMigrate（设置 database.auto_migrate=true）
	// 2. 生产环境：使用手动迁移脚本或迁移工具（如 golang-migrate）
	// 3. 新环境部署：先手动执行 SQL 脚本创建表结构
	if cfg.AutoMigrate {
		log.Println("AutoMigrate enabled, running database migrations...")
		if err := autoMigrate(); err != nil {
			log.Printf("AutoMigrate failed: %v", err)
			log.Println("Continuing without AutoMigrate. Please ensure database schema is up to date.")
			// 不阻塞启动，但记录警告
		} else {
			log.Println("AutoMigrate completed successfully")
		}
	} else {
		log.Println("AutoMigrate disabled. Please ensure database schema is up to date manually.")
	}

	log.Println("Database connected successfully")
	return nil
}

// autoMigrate 自动迁移数据库表
func autoMigrate() error {
	return DB.AutoMigrate(
		&model.User{},
		&model.UserWechatBinding{},
		&model.Provider{},
		&model.ProviderCase{},
		&model.ProviderReview{},
		&model.Worker{},
		&model.Project{},
		&model.Milestone{},
		&model.WorkLog{},
		&model.EscrowAccount{},
		&model.Transaction{},
		&model.Booking{},
		&model.ProjectPhase{},
		&model.PhaseTask{},
		&model.UserFollow{},
		&model.UserFavorite{},
		// MaterialShop
		&model.MaterialShop{},
		// RBAC 权限系统
		&model.SysAdmin{},
		&model.SysRole{},
		&model.SysMenu{},
		&model.SysAdminRole{},
		&model.SysRoleMenu{},
		&model.SysOperationLog{},
		// 管理后台新增
		&model.Admin{},
		&model.ProviderAudit{},
		&model.MaterialShopAudit{},
		&model.RiskWarning{},
		&model.Arbitration{},
		&model.SystemSettings{},
		&model.AdminLog{},
		// 业务流程扩展 (2025-12-28)
		&model.SystemConfig{},
		&model.Proposal{},
		&model.Order{},
		&model.PaymentPlan{},
		// 商家中心 (2025-12-29)
		&model.MerchantApplication{},
		&model.MerchantIncome{},
		&model.MerchantWithdraw{},
		&model.MerchantBankAccount{},
		&model.MerchantServiceSetting{},
		// 售后
		&model.AfterSales{},
		// 安全审计 (2025-12-29)
		&model.AuditLog{},
		// 社交功能 (2026-01-21)
		&model.UserLike{},
		&model.CaseComment{},
		&model.SensitiveWord{},
	)
}

// GetDB 获取数据库实例
func GetDB() *gorm.DB {
	return DB
}
