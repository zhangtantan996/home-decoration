package repository

import (
	"home-decoration-server/internal/config"
	"home-decoration-server/internal/model"
	"log"

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

	// 自动迁移表结构
	if err := autoMigrate(); err != nil {
		return err
	}

	log.Println("Database connected successfully")
	return nil
}

// autoMigrate 自动迁移数据库表
func autoMigrate() error {
	return DB.AutoMigrate(
		&model.User{},
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
		// Chat
		&model.Conversation{},
		&model.ChatMessage{},
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
	)
}

// GetDB 获取数据库实例
func GetDB() *gorm.DB {
	return DB
}
