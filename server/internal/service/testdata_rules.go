package service

import "strings"

var DirtyDataTextKeywords = []string{
	"[TEST]",
	"测试",
	"验收",
	"联调",
	"fixture",
	"acceptance",
	"smoke",
	"demo",
}

var DirtyDataPhonePrefixes = []string{
	"19999",
}

func IsDirtyTextCandidate(value string) bool {
	normalized := strings.ToLower(strings.TrimSpace(value))
	if normalized == "" {
		return false
	}

	for _, keyword := range DirtyDataTextKeywords {
		if strings.Contains(normalized, strings.ToLower(keyword)) {
			return true
		}
	}

	return false
}

func IsDirtyPhoneCandidate(value string) bool {
	normalized := strings.TrimSpace(value)
	if normalized == "" {
		return false
	}

	for _, prefix := range DirtyDataPhonePrefixes {
		if strings.HasPrefix(normalized, prefix) {
			return true
		}
	}

	return false
}
