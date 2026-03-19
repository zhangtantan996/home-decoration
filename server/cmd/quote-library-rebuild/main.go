package main

import (
	"flag"
	"fmt"
	"log"
	"os"

	"home-decoration-server/internal/config"
	"home-decoration-server/internal/repository"
	"home-decoration-server/internal/service"

	"gorm.io/gorm"
)

func main() {
	var filePath string
	var allowStaging bool
	flag.StringVar(&filePath, "file", "", "报价 Excel 文件路径，默认自动查找项目根目录下的 erp报价.xlsx")
	flag.BoolVar(&allowStaging, "allow-staging", false, "允许在 staging 环境执行重建")
	flag.Parse()

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("加载配置失败: %v", err)
	}
	if err := config.ValidateDatabaseSafety(cfg); err != nil {
		log.Fatalf("数据库环境安全校验失败: %v", err)
	}

	appEnv := config.GetAppEnv()
	if appEnv == config.AppEnvProduction {
		log.Fatalf("安全保护：禁止在 production 环境重建报价库")
	}
	if appEnv == config.AppEnvStaging && !allowStaging {
		log.Fatalf("安全保护：staging 环境默认禁止重建；如确认执行，请显式追加 --allow-staging")
	}

	if err := repository.InitDB(&cfg.Database); err != nil {
		log.Fatalf("数据库连接失败: %v", err)
	}

	if err := rebuildQuoteSubsystem(repository.DB); err != nil {
		log.Fatalf("清理旧报价数据失败: %v", err)
	}

	result, err := (&service.QuoteService{}).ImportQuoteLibraryFromERP(filePath)
	if err != nil {
		log.Fatalf("重新导入报价库失败: %v", err)
	}

	fmt.Println("========================================")
	fmt.Println("报价库重建完成")
	fmt.Println("========================================")
	fmt.Printf("文件: %s\n", result.FilePath)
	fmt.Printf("新增: %d\n", result.Imported)
	fmt.Printf("更新: %d\n", result.Updated)
	fmt.Printf("跳过: %d\n", result.Skipped)
}

func rebuildQuoteSubsystem(db *gorm.DB) error {
	return db.Transaction(func(tx *gorm.DB) error {
		steps := []string{
			"quote_submission_items",
			"quote_submissions",
			"quote_invitations",
			"quote_list_items",
			"quote_lists",
			"quote_price_book_items",
			"quote_price_books",
			"quote_library_items",
			"quote_categories",
		}

		for _, table := range steps {
			if tx.Migrator().HasTable(table) {
				if err := tx.Exec("TRUNCATE TABLE " + table + " RESTART IDENTITY CASCADE").Error; err != nil {
					return err
				}
			}
		}

		return nil
	})
}

func init() {
	log.SetFlags(0)
	log.SetOutput(os.Stderr)
}
