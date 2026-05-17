package rbacsync

import (
	"crypto/sha256"
	"encoding/hex"
	"sort"
	"strings"
)

func CoveredMenuKeys() map[string]struct{} {
	covered := map[string]struct{}{}
	for _, menuKeys := range presetRoleMenuKeyTemplates {
		for _, menuKey := range menuKeys {
			covered[menuKey] = struct{}{}
		}
	}
	return covered
}

func BuildCatalogFingerprint(catalog map[string]MenuSelector) []string {
	keys := make([]string, 0, len(catalog))
	for menuKey, selector := range catalog {
		keys = append(keys, menuKey+"|"+selector.Path+"|"+selector.Permission)
	}
	sort.Strings(keys)
	return keys
}

func BuildTemplateFingerprint(roleSelectors RoleSelectorMap) []string {
	rows := []string{}
	for roleKey, selectors := range roleSelectors {
		for _, selector := range selectors {
			rows = append(rows, roleKey+"|"+selector.Key())
		}
	}
	sort.Strings(rows)
	return rows
}

func HashStrings(rows []string) string {
	sum := sha256.Sum256([]byte(strings.Join(rows, "\n")))
	return hex.EncodeToString(sum[:])
}

func DiffStringSet(expected []string, actual []string) (missing []string, extra []string) {
	expectedSet := make(map[string]struct{}, len(expected))
	actualSet := make(map[string]struct{}, len(actual))
	for _, value := range expected {
		expectedSet[value] = struct{}{}
	}
	for _, value := range actual {
		actualSet[value] = struct{}{}
	}
	for value := range expectedSet {
		if _, ok := actualSet[value]; !ok {
			missing = append(missing, value)
		}
	}
	for value := range actualSet {
		if _, ok := expectedSet[value]; !ok {
			extra = append(extra, value)
		}
	}
	sort.Strings(missing)
	sort.Strings(extra)
	return missing, extra
}
