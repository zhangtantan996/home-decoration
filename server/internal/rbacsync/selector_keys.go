package rbacsync

import (
	"fmt"
	"strings"
)

func SelectorFromKey(selectorKey string) (MenuSelector, error) {
	parts := strings.SplitN(selectorKey, ":", 2)
	if len(parts) != 2 {
		return MenuSelector{}, fmt.Errorf("invalid selector key: %s", selectorKey)
	}
	switch parts[0] {
	case "path":
		return MenuSelector{Path: parts[1]}, nil
	case "permission":
		return MenuSelector{Permission: parts[1]}, nil
	default:
		return MenuSelector{}, fmt.Errorf("unsupported selector type: %s", parts[0])
	}
}
