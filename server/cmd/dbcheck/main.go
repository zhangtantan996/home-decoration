package main

import (
	"fmt"
	"log"
	"os"
	"strings"

	"home-decoration-server/internal/config"
	"home-decoration-server/internal/repository"
)

func main() {
	log.SetFlags(0)

	cfg, err := config.Load()
	if err != nil {
		fmt.Printf("ERROR: Failed to load config: %v\n", err)
		os.Exit(1)
	}

	if err := repository.InitDB(&cfg.Database); err != nil {
		fmt.Printf("ERROR: Failed to connect database: %v\n", err)
		os.Exit(1)
	}
	defer repository.CloseDB()

	fmt.Println("============================================================")
	fmt.Println("              DB Schema Health Check Report                ")
	fmt.Println("============================================================")
	fmt.Println()

	printMigrationStatus()
	fmt.Println()
	printHighRiskColumnCheck()
	fmt.Println()
	printSmokeResults()

	fmt.Println("============================================================")
	fmt.Println("                      End of Report                         ")
	fmt.Println("============================================================")
}

func printMigrationStatus() {
	fmt.Println("1. Migration / Version Status")
	fmt.Println("------------------------------------------------------------")

	hasSchemaMigrations := repository.DB.Migrator().HasTable("schema_migrations")
	hasSchemaVersions := repository.DB.Migrator().HasTable("schema_versions")

	if hasSchemaMigrations || hasSchemaVersions {
		if hasSchemaMigrations {
			var count int64
			repository.DB.Table("schema_migrations").Count(&count)
			fmt.Printf("  - schema_migrations: FOUND (%d records)\n", count)
		}
		if hasSchemaVersions {
			var count int64
			repository.DB.Table("schema_versions").Count(&count)
			fmt.Printf("  - schema_versions: FOUND (%d records)\n", count)
		}
	} else {
		fmt.Println("  当前项目无统一 migration version 表，按 server/migrations/*.sql 治理")
	}
	fmt.Println()
	fmt.Println("  Canonical repair path: server/migrations/v1.6.9_reconcile_high_risk_schema_guard.sql")
}

func printHighRiskColumnCheck() {
	fmt.Println("2. High-Risk Table Key Columns Check")
	fmt.Println("------------------------------------------------------------")

	results := repository.CheckAllHighRiskTables()
	allPassed := true

	for _, result := range results {
		if !result.Exists {
			fmt.Printf("  [FAIL] Table '%s' does not exist\n", result.Table)
			fmt.Printf("         -> 这可能是更底层的 bootstrap 缺口，不自动回退到 public.sql/local_backup.sql\n")
			fmt.Printf("         -> 请先确认当前仓库已完成全量空库 bootstrap，再执行修复\n")
			allPassed = false
			continue
		}

		if len(result.Missing) > 0 {
			fmt.Printf("  [FAIL] Table '%s' missing columns: %s\n", result.Table, strings.Join(result.Missing, ", "))
			fmt.Printf("         -> 提示：缺列请跑 v1.6.9 补洞\n")
			allPassed = false
		} else {
			fmt.Printf("  [PASS] Table '%s' all key columns present\n", result.Table)
		}
	}

	if allPassed {
		fmt.Println()
		fmt.Println("  All high-risk table columns OK")
	} else {
		fmt.Println()
		fmt.Println("  WARNING: Some columns missing. To fix, run:")
		fmt.Println("    docker exec -i home_decor_db_local psql -U postgres -d home_decoration \\")
		fmt.Println("      < server/migrations/v1.6.9_reconcile_high_risk_schema_guard.sql")
	}
}

func printSmokeResults() {
	fmt.Println("3. High-Risk Smoke Test Results")
	fmt.Println("------------------------------------------------------------")

	results := repository.RunAllSmokeTests()
	allPassed := true

	for _, result := range results {
		if result.Success {
			fmt.Printf("  [PASS] %s\n", result.Operation)
		} else {
			fmt.Printf("  [FAIL] %s: %s\n", result.Operation, result.Error)
			allPassed = false
		}
	}

	if allPassed {
		fmt.Println()
		fmt.Println("  All smoke tests PASSED")
	} else {
		fmt.Println()
		fmt.Println("  WARNING: Some smoke tests FAILED.")

		hasTableMissing := false
		for _, result := range results {
			if !result.Success && (result.Error == "table does not exist" ||
				strings.Contains(result.Error, "table") &&
					strings.Contains(result.Error, "not exist")) {
				hasTableMissing = true
				break
			}
		}

		if hasTableMissing {
			fmt.Println("  -> 检测到缺表：当前仓库可能仍未完成全量空库 bootstrap，本轮仅守高风险增量 schema")
			fmt.Println("  -> 缺表属于更底层 bootstrap 缺口，请先完成全量 bootstrap 再排查")
		} else {
			fmt.Println("  -> 这可能是高风险增量 schema 缺口，请跑 v1.6.9 修复")
		}
		fmt.Println("  Canonical repair path: v1.6.9_reconcile_high_risk_schema_guard.sql")
	}
}
