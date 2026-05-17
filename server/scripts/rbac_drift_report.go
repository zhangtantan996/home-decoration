//go:build ignore
// +build ignore

package main

import (
	"encoding/csv"
	"flag"
	"fmt"
	"home-decoration-server/internal/config"
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/rbacsync"
	"home-decoration-server/internal/repository"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

type roleInfo struct {
	ID   uint64
	Key  string
	Name string
}

type driftRow struct {
	Category      string
	RoleKey       string
	RoleName      string
	SelectorType  string
	SelectorValue string
	MenuID        uint64
	MenuPath      string
	MenuPerm      string
	MenuTitle     string
}

func main() {
	var (
		seedPath = flag.String("seed", "scripts/seed_rbac_full.go", "seed script path")
		outDir   = flag.String("out-dir", "", "report output directory")
	)
	flag.Parse()

	cfg, err := config.Load()
	if err != nil {
		failf("加载配置失败: %v", err)
	}
	if err := repository.InitDB(&cfg.Database); err != nil {
		failf("数据库连接失败: %v", err)
	}

	catalog, err := rbacsync.LoadSeedMenuCatalog(*seedPath)
	if err != nil {
		failf("加载 seed 菜单目录失败: %v", err)
	}
	roleSelectors, err := rbacsync.ResolvePresetRoleSelectors(catalog)
	if err != nil {
		failf("解析预置角色模板失败: %v", err)
	}

	menus, err := loadMenus()
	if err != nil {
		failf("读取菜单失败: %v", err)
	}
	roles, err := loadRoles()
	if err != nil {
		failf("读取角色失败: %v", err)
	}
	actualRoleMenuSet, err := loadRoleMenuSet()
	if err != nil {
		failf("读取角色权限失败: %v", err)
	}

	menuByID := make(map[uint64]model.SysMenu, len(menus))
	for _, menu := range menus {
		menuByID[menu.ID] = menu
	}

	expectedByRole, unresolvedByRole := buildExpectedMenuSet(roleSelectors, menus)
	rows := make([]driftRow, 0, 512)

	for _, roleKey := range rbacsync.PresetRoleKeys() {
		role, ok := findRoleByKey(roles, roleKey)
		if !ok {
			rows = append(rows, driftRow{
				Category:      "preset_role_missing",
				RoleKey:       roleKey,
				RoleName:      rbacsync.PresetRoleDisplayName(roleKey),
				SelectorType:  "role",
				SelectorValue: "role-not-found",
			})
			continue
		}

		expectedSet := expectedByRole[roleKey]
		actualSet := actualRoleMenuSet[role.ID]

		for selectorKey := range unresolvedByRole[roleKey] {
			selector, _ := rbacsync.SelectorFromKey(selectorKey)
			rows = append(rows, driftRow{
				Category:      "preset_role_template_unresolved",
				RoleKey:       role.Key,
				RoleName:      role.Name,
				SelectorType:  selector.SelectorType(),
				SelectorValue: selector.SelectorValue(),
			})
		}

		for menuID := range expectedSet {
			if _, ok := actualSet[menuID]; ok {
				continue
			}
			menu := menuByID[menuID]
			selectorType, selectorValue := menuSelectorForReport(menu)
			rows = append(rows, driftRow{
				Category:      "preset_role_missing",
				RoleKey:       role.Key,
				RoleName:      role.Name,
				SelectorType:  selectorType,
				SelectorValue: selectorValue,
				MenuID:        menu.ID,
				MenuPath:      menu.Path,
				MenuPerm:      menu.Permission,
				MenuTitle:     menu.Title,
			})
		}

		for menuID := range actualSet {
			if _, ok := expectedSet[menuID]; ok {
				continue
			}
			menu := menuByID[menuID]
			selectorType, selectorValue := menuSelectorForReport(menu)
			rows = append(rows, driftRow{
				Category:      "preset_role_extra",
				RoleKey:       role.Key,
				RoleName:      role.Name,
				SelectorType:  selectorType,
				SelectorValue: selectorValue,
				MenuID:        menu.ID,
				MenuPath:      menu.Path,
				MenuPerm:      menu.Permission,
				MenuTitle:     menu.Title,
			})
		}
	}

	addedSelectorKeys, err := loadAddedSelectorKeys()
	if err != nil {
		failf("读取快照失败: %v", err)
	}
	if len(addedSelectorKeys) > 0 {
		for _, role := range roles {
			if role.Key == "super_admin" || rbacsync.IsPresetRole(role.Key) {
				continue
			}
			actualSet := actualRoleMenuSet[role.ID]
			for _, selectorKey := range addedSelectorKeys {
				selector, parseErr := rbacsync.SelectorFromKey(selectorKey)
				if parseErr != nil {
					continue
				}
				matchedMenus := findMenusBySelector(menus, selector)
				if len(matchedMenus) == 0 {
					continue
				}
				hasAll := true
				var firstMissing model.SysMenu
				for _, menu := range matchedMenus {
					if _, ok := actualSet[menu.ID]; !ok {
						hasAll = false
						firstMissing = menu
						break
					}
				}
				if hasAll {
					continue
				}
				rows = append(rows, driftRow{
					Category:      "custom_role_new_permission_pending",
					RoleKey:       role.Key,
					RoleName:      role.Name,
					SelectorType:  selector.SelectorType(),
					SelectorValue: selector.SelectorValue(),
					MenuID:        firstMissing.ID,
					MenuPath:      firstMissing.Path,
					MenuPerm:      firstMissing.Permission,
					MenuTitle:     firstMissing.Title,
				})
			}
		}
	}

	sort.Slice(rows, func(i, j int) bool {
		if rows[i].Category != rows[j].Category {
			return rows[i].Category < rows[j].Category
		}
		if rows[i].RoleKey != rows[j].RoleKey {
			return rows[i].RoleKey < rows[j].RoleKey
		}
		if rows[i].SelectorType != rows[j].SelectorType {
			return rows[i].SelectorType < rows[j].SelectorType
		}
		return rows[i].SelectorValue < rows[j].SelectorValue
	})

	targetDir := *outDir
	if strings.TrimSpace(targetDir) == "" {
		targetDir = filepath.Join("..", "test-results", "rbac-drift", time.Now().UTC().Format("20060102T150405Z"))
	}
	if err := os.MkdirAll(targetDir, 0o755); err != nil {
		failf("创建报告目录失败: %v", err)
	}

	csvPath := filepath.Join(targetDir, "rbac_drift.csv")
	if err := writeCSV(csvPath, rows); err != nil {
		failf("写入 CSV 失败: %v", err)
	}
	mdPath := filepath.Join(targetDir, "rbac_drift.md")
	if err := writeMarkdown(mdPath, rows, addedSelectorKeys); err != nil {
		failf("写入 Markdown 失败: %v", err)
	}

	fmt.Printf("✅ RBAC 漂移报告已输出\n- Markdown: %s\n- CSV: %s\n", mdPath, csvPath)
}

func loadMenus() ([]model.SysMenu, error) {
	var menus []model.SysMenu
	if err := repository.DB.Find(&menus).Error; err != nil {
		return nil, err
	}
	return menus, nil
}

func loadRoles() ([]roleInfo, error) {
	var roles []model.SysRole
	if err := repository.DB.Find(&roles).Error; err != nil {
		return nil, err
	}
	items := make([]roleInfo, 0, len(roles))
	for _, role := range roles {
		items = append(items, roleInfo{
			ID:   role.ID,
			Key:  role.Key,
			Name: role.Name,
		})
	}
	return items, nil
}

func loadRoleMenuSet() (map[uint64]map[uint64]struct{}, error) {
	var roleMenus []model.SysRoleMenu
	if err := repository.DB.Find(&roleMenus).Error; err != nil {
		return nil, err
	}
	result := map[uint64]map[uint64]struct{}{}
	for _, rm := range roleMenus {
		if _, ok := result[rm.RoleID]; !ok {
			result[rm.RoleID] = map[uint64]struct{}{}
		}
		result[rm.RoleID][rm.MenuID] = struct{}{}
	}
	return result, nil
}

func buildExpectedMenuSet(roleSelectors rbacsync.RoleSelectorMap, menus []model.SysMenu) (map[string]map[uint64]struct{}, map[string]map[string]struct{}) {
	expected := map[string]map[uint64]struct{}{}
	unresolved := map[string]map[string]struct{}{}
	for _, roleKey := range rbacsync.PresetRoleKeys() {
		expected[roleKey] = map[uint64]struct{}{}
		unresolved[roleKey] = map[string]struct{}{}
		for _, selector := range roleSelectors[roleKey] {
			matched := findMenusBySelector(menus, selector)
			if len(matched) == 0 {
				unresolved[roleKey][selector.Key()] = struct{}{}
				continue
			}
			for _, menu := range matched {
				expected[roleKey][menu.ID] = struct{}{}
			}
		}
	}
	return expected, unresolved
}

func findMenusBySelector(menus []model.SysMenu, selector rbacsync.MenuSelector) []model.SysMenu {
	result := make([]model.SysMenu, 0, 1)
	for _, menu := range menus {
		switch selector.SelectorType() {
		case "path":
			if strings.TrimSpace(menu.Path) == selector.SelectorValue() {
				result = append(result, menu)
			}
		default:
			if strings.TrimSpace(menu.Permission) == selector.SelectorValue() {
				result = append(result, menu)
			}
		}
	}
	return result
}

func menuSelectorForReport(menu model.SysMenu) (string, string) {
	if path := strings.TrimSpace(menu.Path); path != "" {
		return "path", path
	}
	if permission := strings.TrimSpace(menu.Permission); permission != "" {
		return "permission", permission
	}
	return "menu_id", fmt.Sprintf("%d", menu.ID)
}

func loadAddedSelectorKeys() ([]string, error) {
	snapshotPath := filepath.Join("scripts", "rbac", "snapshot.json")
	snapshot, err := rbacsync.LoadSnapshot(snapshotPath)
	if err != nil {
		return nil, err
	}
	if len(snapshot.PreviousTemplateRows) == 0 {
		return selectorKeysFromTemplateRows(snapshot.TemplateRows), nil
	}
	missing, _ := rbacsync.DiffStringSet(snapshot.TemplateRows, snapshot.PreviousTemplateRows)
	return selectorKeysFromTemplateRows(missing), nil
}

func selectorKeysFromTemplateRows(rows []string) []string {
	set := map[string]struct{}{}
	for _, row := range rows {
		parts := strings.SplitN(row, "|", 2)
		if len(parts) != 2 {
			continue
		}
		set[parts[1]] = struct{}{}
	}
	keys := make([]string, 0, len(set))
	for key := range set {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	return keys
}

func findRoleByKey(roles []roleInfo, roleKey string) (roleInfo, bool) {
	for _, role := range roles {
		if role.Key == roleKey {
			return role, true
		}
	}
	return roleInfo{}, false
}

func writeCSV(path string, rows []driftRow) error {
	file, err := os.Create(path)
	if err != nil {
		return err
	}
	defer file.Close()

	writer := csv.NewWriter(file)
	defer writer.Flush()

	header := []string{
		"category", "role_key", "role_name", "selector_type", "selector_value",
		"menu_id", "menu_path", "menu_permission", "menu_title",
	}
	if err := writer.Write(header); err != nil {
		return err
	}

	for _, row := range rows {
		record := []string{
			row.Category,
			row.RoleKey,
			row.RoleName,
			row.SelectorType,
			row.SelectorValue,
			fmt.Sprintf("%d", row.MenuID),
			row.MenuPath,
			row.MenuPerm,
			row.MenuTitle,
		}
		if err := writer.Write(record); err != nil {
			return err
		}
	}
	return writer.Error()
}

func writeMarkdown(path string, rows []driftRow, addedSelectorKeys []string) error {
	categoryCount := map[string]int{}
	for _, row := range rows {
		categoryCount[row.Category]++
	}

	var builder strings.Builder
	builder.WriteString("# RBAC Drift Report\n\n")
	builder.WriteString(fmt.Sprintf("- 生成时间(UTC): `%s`\n", time.Now().UTC().Format(time.RFC3339)))
	builder.WriteString(fmt.Sprintf("- 本次新增模板 selector 数: `%d`\n", len(addedSelectorKeys)))
	builder.WriteString(fmt.Sprintf("- 预置角色缺失权限: `%d`\n", categoryCount["preset_role_missing"]))
	builder.WriteString(fmt.Sprintf("- 预置角色额外权限: `%d`\n", categoryCount["preset_role_extra"]))
	builder.WriteString(fmt.Sprintf("- 自定义角色待处理(本次新增权限): `%d`\n", categoryCount["custom_role_new_permission_pending"]))
	builder.WriteString(fmt.Sprintf("- 模板 unresolved: `%d`\n\n", categoryCount["preset_role_template_unresolved"]))

	builder.WriteString("## 本次新增模板 selector\n")
	if len(addedSelectorKeys) == 0 {
		builder.WriteString("- 无新增\n\n")
	} else {
		for _, key := range addedSelectorKeys {
			builder.WriteString("- `" + key + "`\n")
		}
		builder.WriteString("\n")
	}

	builder.WriteString("## 明细\n")
	if len(rows) == 0 {
		builder.WriteString("- 无漂移项\n")
	} else {
		for _, row := range rows {
			builder.WriteString(fmt.Sprintf(
				"- `%s` | role=`%s` | selector=`%s:%s` | menu=`%d` `%s`\n",
				row.Category,
				row.RoleKey,
				row.SelectorType,
				row.SelectorValue,
				row.MenuID,
				row.MenuTitle,
			))
		}
	}

	return os.WriteFile(path, []byte(builder.String()), 0o644)
}

func failf(format string, args ...any) {
	fmt.Fprintf(os.Stderr, "❌ "+format+"\n", args...)
	os.Exit(1)
}
