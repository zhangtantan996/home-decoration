//go:build ignore
// +build ignore

package main

import (
	"flag"
	"fmt"
	"home-decoration-server/internal/rbacsync"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

func main() {
	var seedPath = flag.String("seed", "scripts/seed_rbac_full.go", "seed script path")
	flag.Parse()

	catalog, err := rbacsync.LoadSeedMenuCatalog(*seedPath)
	if err != nil {
		failf("加载 seed 菜单目录失败: %v", err)
	}
	roleSelectors, err := rbacsync.ResolvePresetRoleSelectors(catalog)
	if err != nil {
		failf("解析预置角色模板失败: %v", err)
	}

	covered := rbacsync.CoveredMenuKeys()
	superAdminOnly := rbacsync.SuperAdminOnlyMenuKeys()
	var uncovered []string
	for menuKey, selector := range catalog {
		if selector.IsEmpty() {
			continue
		}
		if _, ok := covered[menuKey]; ok {
			continue
		}
		if _, ok := superAdminOnly[menuKey]; ok {
			continue
		}
		uncovered = append(uncovered, menuKey)
	}
	if len(uncovered) > 0 {
		sort.Strings(uncovered)
		failf("发现未归类菜单 key（既不在预置角色模板，也不在 super_admin only 清单）: %s", strings.Join(uncovered, ", "))
	}

	snapshotPath := filepath.Join("scripts", "rbac", "snapshot.json")
	snapshot, err := rbacsync.LoadSnapshot(snapshotPath)
	if err != nil {
		failf("读取 RBAC 快照失败: %v。请先运行 npm run rbac:reconcile:generate", err)
	}

	catalogRows := rbacsync.BuildCatalogFingerprint(catalog)
	templateRows := rbacsync.BuildTemplateFingerprint(roleSelectors)
	currentCatalogHash := rbacsync.HashStrings(catalogRows)
	currentTemplateHash := rbacsync.HashStrings(templateRows)
	if currentCatalogHash != snapshot.MenuCatalogHash || currentTemplateHash != snapshot.TemplateHash {
		failf(
			"RBAC 模板/菜单源已变更但快照未同步。请执行 npm run rbac:reconcile:generate 并提交迁移与 snapshot。\ncurrent menu hash=%s\nsnapshot menu hash=%s\ncurrent template hash=%s\nsnapshot template hash=%s",
			currentCatalogHash,
			snapshot.MenuCatalogHash,
			currentTemplateHash,
			snapshot.TemplateHash,
		)
	}

	if strings.TrimSpace(snapshot.LastReconcileMigration) == "" {
		failf("snapshot 缺少 lastReconcileMigration，请执行 npm run rbac:reconcile:generate")
	}

	migrationPath := filepath.Join("migrations", snapshot.LastReconcileMigration)
	if _, err := os.Stat(migrationPath); err != nil {
		failf("snapshot 指向的迁移文件不存在: %s", migrationPath)
	}

	if err := ensureMigrationAllowlisted(snapshot.LastReconcileMigration); err != nil {
		failf("%v", err)
	}

	fmt.Println("✅ RBAC guard passed")
}

func ensureMigrationAllowlisted(migrationFile string) error {
	releaseScript := filepath.Join("..", "deploy", "scripts", "lib", "release_common.sh")
	content, err := os.ReadFile(releaseScript)
	if err != nil {
		return fmt.Errorf("读取 release 脚本失败: %w", err)
	}

	target := "server/migrations/" + strings.TrimSpace(migrationFile)
	if !strings.Contains(string(content), target) {
		return fmt.Errorf("release allowlist 缺少 %s，请更新 deploy/scripts/lib/release_common.sh", target)
	}
	return nil
}

func failf(format string, args ...any) {
	fmt.Fprintf(os.Stderr, "❌ "+format+"\n", args...)
	os.Exit(1)
}
