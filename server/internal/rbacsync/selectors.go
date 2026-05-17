package rbacsync

import (
	"bufio"
	"fmt"
	"os"
	"sort"
	"strconv"
	"strings"
)

type MenuSelector struct {
	Path       string `json:"path,omitempty"`
	Permission string `json:"permission,omitempty"`
}

func (s MenuSelector) SelectorType() string {
	if strings.TrimSpace(s.Path) != "" {
		return "path"
	}
	return "permission"
}

func (s MenuSelector) SelectorValue() string {
	if strings.TrimSpace(s.Path) != "" {
		return strings.TrimSpace(s.Path)
	}
	return strings.TrimSpace(s.Permission)
}

func (s MenuSelector) Key() string {
	return s.SelectorType() + ":" + s.SelectorValue()
}

func (s MenuSelector) IsEmpty() bool {
	return strings.TrimSpace(s.Path) == "" && strings.TrimSpace(s.Permission) == ""
}

type RoleSelectorMap map[string][]MenuSelector

func LoadSeedMenuCatalog(seedScriptPath string) (map[string]MenuSelector, error) {
	file, err := os.Open(seedScriptPath)
	if err != nil {
		return nil, fmt.Errorf("open seed script: %w", err)
	}
	defer file.Close()

	catalog := map[string]MenuSelector{}
	scanner := bufio.NewScanner(file)
	lineNo := 0

	for scanner.Scan() {
		lineNo++
		line := strings.TrimSpace(scanner.Text())
		switch {
		case strings.HasPrefix(line, "menuDir("):
			key, selector, err := parseMenuDirLine(line)
			if err != nil {
				return nil, fmt.Errorf("parse menuDir at line %d: %w", lineNo, err)
			}
			if err := setCatalogEntry(catalog, key, selector); err != nil {
				return nil, fmt.Errorf("catalog line %d: %w", lineNo, err)
			}
		case strings.HasPrefix(line, "menuPage("):
			key, selector, err := parseMenuPageLine(line)
			if err != nil {
				return nil, fmt.Errorf("parse menuPage at line %d: %w", lineNo, err)
			}
			if err := setCatalogEntry(catalog, key, selector); err != nil {
				return nil, fmt.Errorf("catalog line %d: %w", lineNo, err)
			}
		case strings.HasPrefix(line, "menuHiddenPage("):
			key, selector, err := parseMenuPageLine(line)
			if err != nil {
				return nil, fmt.Errorf("parse menuHiddenPage at line %d: %w", lineNo, err)
			}
			if err := setCatalogEntry(catalog, key, selector); err != nil {
				return nil, fmt.Errorf("catalog line %d: %w", lineNo, err)
			}
		case strings.HasPrefix(line, "menuButton("):
			key, selector, err := parseButtonMenuLine(line)
			if err != nil {
				return nil, fmt.Errorf("parse menuButton at line %d: %w", lineNo, err)
			}
			if err := setCatalogEntry(catalog, key, selector); err != nil {
				return nil, fmt.Errorf("catalog line %d: %w", lineNo, err)
			}
		}
	}

	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("scan seed script: %w", err)
	}
	return catalog, nil
}

func ResolvePresetRoleSelectors(catalog map[string]MenuSelector) (RoleSelectorMap, error) {
	result := make(RoleSelectorMap, len(presetRoleMenuKeyTemplates))
	templates := PresetRoleMenuKeyTemplates()

	for _, roleKey := range PresetRoleKeys() {
		menuKeys, ok := templates[roleKey]
		if !ok {
			return nil, fmt.Errorf("missing preset role template: %s", roleKey)
		}
		selectors := make([]MenuSelector, 0, len(menuKeys))
		for _, menuKey := range menuKeys {
			selector, ok := catalog[menuKey]
			if !ok {
				return nil, fmt.Errorf("role %s references missing menu key %s", roleKey, menuKey)
			}
			if selector.IsEmpty() {
				return nil, fmt.Errorf("role %s references menu %s without path/permission", roleKey, menuKey)
			}
			selectors = append(selectors, selector)
		}
		result[roleKey] = selectors
	}

	return result, nil
}

func UniqueSelectorKeys(selectors []MenuSelector) []string {
	set := make(map[string]struct{}, len(selectors))
	for _, selector := range selectors {
		if selector.IsEmpty() {
			continue
		}
		set[selector.Key()] = struct{}{}
	}
	keys := make([]string, 0, len(set))
	for key := range set {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	return keys
}

func FlattenRoleSelectors(roleSelectors RoleSelectorMap) []string {
	set := map[string]struct{}{}
	for _, selectors := range roleSelectors {
		for _, selector := range selectors {
			if selector.IsEmpty() {
				continue
			}
			set[selector.Key()] = struct{}{}
		}
	}
	keys := make([]string, 0, len(set))
	for key := range set {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	return keys
}

func parseMenuDirLine(line string) (string, MenuSelector, error) {
	args, err := parseCallArgs(line)
	if err != nil {
		return "", MenuSelector{}, err
	}
	if len(args) < 7 {
		return "", MenuSelector{}, fmt.Errorf("invalid menu call args: %d", len(args))
	}
	key, err := decodeQuoted(args[0])
	if err != nil {
		return "", MenuSelector{}, fmt.Errorf("decode key: %w", err)
	}
	path, err := decodeQuoted(args[3])
	if err != nil {
		return "", MenuSelector{}, fmt.Errorf("decode path: %w", err)
	}
	permission, err := decodeQuoted(args[6])
	if err != nil {
		return "", MenuSelector{}, fmt.Errorf("decode permission: %w", err)
	}
	return key, MenuSelector{
		Path:       path,
		Permission: permission,
	}, nil
}

func parseMenuPageLine(line string) (string, MenuSelector, error) {
	args, err := parseCallArgs(line)
	if err != nil {
		return "", MenuSelector{}, err
	}
	if len(args) < 8 {
		return "", MenuSelector{}, fmt.Errorf("invalid menu call args: %d", len(args))
	}
	key, err := decodeQuoted(args[0])
	if err != nil {
		return "", MenuSelector{}, fmt.Errorf("decode key: %w", err)
	}
	path, err := decodeQuoted(args[3])
	if err != nil {
		return "", MenuSelector{}, fmt.Errorf("decode path: %w", err)
	}
	permission, err := decodeQuoted(args[7])
	if err != nil {
		return "", MenuSelector{}, fmt.Errorf("decode permission: %w", err)
	}
	return key, MenuSelector{
		Path:       path,
		Permission: permission,
	}, nil
}

func parseButtonMenuLine(line string) (string, MenuSelector, error) {
	args, err := parseCallArgs(line)
	if err != nil {
		return "", MenuSelector{}, err
	}
	if len(args) < 4 {
		return "", MenuSelector{}, fmt.Errorf("invalid menuButton args: %d", len(args))
	}
	key, err := decodeQuoted(args[0])
	if err != nil {
		return "", MenuSelector{}, fmt.Errorf("decode key: %w", err)
	}
	permission, err := decodeQuoted(args[3])
	if err != nil {
		return "", MenuSelector{}, fmt.Errorf("decode permission: %w", err)
	}
	return key, MenuSelector{Permission: permission}, nil
}

func parseCallArgs(line string) ([]string, error) {
	openIdx := strings.Index(line, "(")
	closeIdx := strings.LastIndex(line, ")")
	if openIdx < 0 || closeIdx <= openIdx {
		return nil, fmt.Errorf("invalid function call")
	}
	raw := strings.TrimSpace(line[openIdx+1 : closeIdx])
	if raw == "" {
		return nil, nil
	}

	var (
		args    []string
		builder strings.Builder
		inQuote bool
		escape  bool
	)

	for _, ch := range raw {
		switch {
		case escape:
			builder.WriteRune(ch)
			escape = false
		case ch == '\\':
			builder.WriteRune(ch)
			escape = true
		case ch == '"':
			builder.WriteRune(ch)
			inQuote = !inQuote
		case ch == ',' && !inQuote:
			args = append(args, strings.TrimSpace(builder.String()))
			builder.Reset()
		default:
			builder.WriteRune(ch)
		}
	}

	rest := strings.TrimSpace(builder.String())
	if rest != "" {
		args = append(args, rest)
	}
	return args, nil
}

func decodeQuoted(value string) (string, error) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return "", nil
	}
	decoded, err := strconv.Unquote(trimmed)
	if err != nil {
		return "", err
	}
	return decoded, nil
}

func setCatalogEntry(catalog map[string]MenuSelector, key string, selector MenuSelector) error {
	if key == "" {
		return fmt.Errorf("empty menu key")
	}
	if _, exists := catalog[key]; exists {
		return fmt.Errorf("duplicate menu key %s", key)
	}
	catalog[key] = selector
	return nil
}
