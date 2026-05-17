package rbacsync

import (
	"path/filepath"
	"testing"
)

func TestResolvePresetRoleSelectorsFromSeed(t *testing.T) {
	seedPath := filepath.Join("..", "..", "scripts", "seed_rbac_full.go")
	catalog, err := LoadSeedMenuCatalog(seedPath)
	if err != nil {
		t.Fatalf("load seed catalog: %v", err)
	}
	roleSelectors, err := ResolvePresetRoleSelectors(catalog)
	if err != nil {
		t.Fatalf("resolve role selectors: %v", err)
	}

	for _, roleKey := range PresetRoleKeys() {
		selectors := roleSelectors[roleKey]
		if len(selectors) == 0 {
			t.Fatalf("role %s has no selectors", roleKey)
		}
	}
}

func TestPresetRoleMenuKeysUniquePerRole(t *testing.T) {
	templates := PresetRoleMenuKeyTemplates()
	for roleKey, menuKeys := range templates {
		seen := map[string]struct{}{}
		for _, key := range menuKeys {
			if _, ok := seen[key]; ok {
				t.Fatalf("duplicate menu key in role %s: %s", roleKey, key)
			}
			seen[key] = struct{}{}
		}
	}
}

func TestRolesWithSupervisorAssignmentManageAlsoHaveSupervisorList(t *testing.T) {
	templates := PresetRoleMenuKeyTemplates()
	for _, roleKey := range []string{"operations", "product_manager", "system_admin"} {
		menuKeys := templates[roleKey]
		hasAssignmentManage := false
		hasSupervisorList := false
		for _, key := range menuKeys {
			if key == "supervisors_assignment_manage" {
				hasAssignmentManage = true
			}
			if key == "supervisors_list" {
				hasSupervisorList = true
			}
		}
		if !hasAssignmentManage {
			t.Fatalf("role %s should include supervisors_assignment_manage", roleKey)
		}
		if !hasSupervisorList {
			t.Fatalf("role %s should include supervisors_list when it can assign supervisors", roleKey)
		}
	}
}

func TestOpsManagementRolesOwnSupervisionWorkspacePermissions(t *testing.T) {
	templates := PresetRoleMenuKeyTemplates()
	requiredKeys := []string{
		"supervision_root",
		"supervision_projects",
		"supervision_workspace_edit",
		"supervision_risk_create",
	}
	for _, roleKey := range []string{"operations", "product_manager", "system_admin"} {
		menuKeySet := make(map[string]struct{}, len(templates[roleKey]))
		for _, key := range templates[roleKey] {
			menuKeySet[key] = struct{}{}
		}
		for _, requiredKey := range requiredKeys {
			if _, ok := menuKeySet[requiredKey]; !ok {
				t.Fatalf("role %s should include %s", roleKey, requiredKey)
			}
		}
	}
}

func TestPresetRolesNoLongerIncludeProjectSupervisor(t *testing.T) {
	for _, roleKey := range PresetRoleKeys() {
		if roleKey == "project_supervisor" {
			t.Fatalf("deprecated project_supervisor role should not remain in preset role keys")
		}
	}
	if IsPresetRole("project_supervisor") {
		t.Fatalf("deprecated project_supervisor role should not remain a preset role")
	}
}

func TestDiffStringSet(t *testing.T) {
	missing, extra := DiffStringSet(
		[]string{"a", "b", "c"},
		[]string{"b", "c", "d"},
	)
	if len(missing) != 1 || missing[0] != "a" {
		t.Fatalf("unexpected missing: %#v", missing)
	}
	if len(extra) != 1 || extra[0] != "d" {
		t.Fatalf("unexpected extra: %#v", extra)
	}
}
