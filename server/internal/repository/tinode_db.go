package repository

import (
	"fmt"
	"home-decoration-server/internal/config"
	"log"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// TinodeDB is a dedicated GORM connection for Tinode tables.
// It connects to the same database as DB, but is kept separate to avoid
// coupling Tinode schema/migrations with the core app schema.
var TinodeDB *gorm.DB

// InitTinodeDB initializes the Tinode database connection.
// It connects to the separate 'tinode' database where Tinode stores its tables.
func InitTinodeDB(cfg *config.DatabaseConfig) error {
	var err error

	// Create a custom DSN for the tinode database
	tinodeDSN := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=tinode sslmode=%s",
		cfg.Host, cfg.Port, cfg.User, cfg.Password, cfg.SSLMode)

	TinodeDB, err = gorm.Open(postgres.Open(tinodeDSN), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})
	if err != nil {
		return err
	}

	sqlDB, err := TinodeDB.DB()
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

	log.Printf("Tinode database pool configured: max_open_conns=%d max_idle_conns=%d conn_max_lifetime_minutes=%d conn_max_idle_time_minutes=%d",
		maxOpenConns,
		maxIdleConns,
		cfg.ConnMaxLifetimeMinutes,
		cfg.ConnMaxIdleTimeMinutes,
	)

	log.Println("Tinode database connected successfully")
	return nil
}
