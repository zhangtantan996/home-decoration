package image

import (
	"encoding/json"
	"net/url"
	"strings"

	"home-decoration-server/internal/config"
)

var localAssetPrefixes = []string{
	"/uploads/",
	"/static/",
}

// GetFullImageURL 将相对路径转换为完整的 URL
func GetFullImageURL(path string) string {
	if path == "" {
		return ""
	}

	// 如果已经是绝对路径（http开头），直接返回
	if strings.HasPrefix(path, "http://") || strings.HasPrefix(path, "https://") {
		return path
	}

	// 获取配置中的 PublicURL
	cfg := config.GetConfig()
	baseURL := cfg.Server.PublicURL

	// 确保 baseURL 不以 / 结尾
	baseURL = strings.TrimRight(baseURL, "/")

	// 确保 path 以 / 开头
	if !strings.HasPrefix(path, "/") {
		path = "/" + path
	}

	return baseURL + path
}

// GetFullImageURLs converts each path in the slice to a full URL.
func GetFullImageURLs(paths []string) []string {
	if len(paths) == 0 {
		return paths
	}

	result := make([]string, 0, len(paths))
	for _, p := range paths {
		result = append(result, GetFullImageURL(p))
	}
	return result
}

func isLocalAssetPath(path string) bool {
	for _, prefix := range localAssetPrefixes {
		if strings.HasPrefix(path, prefix) {
			return true
		}
	}
	return false
}

// NormalizeStoredImagePath converts a full image URL back to the stored relative
// asset path when it points to local uploaded/static assets. External URLs are kept.
func NormalizeStoredImagePath(value string) string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return ""
	}

	if isLocalAssetPath(trimmed) {
		return trimmed
	}

	if strings.HasPrefix(trimmed, "http://") || strings.HasPrefix(trimmed, "https://") {
		parsed, err := url.Parse(trimmed)
		if err != nil {
			return trimmed
		}
		if isLocalAssetPath(parsed.Path) {
			return parsed.Path
		}
	}

	return trimmed
}

// NormalizeStoredImagePaths normalizes each item in the slice to a stored path when possible.
func NormalizeStoredImagePaths(values []string) []string {
	if len(values) == 0 {
		return values
	}

	result := make([]string, 0, len(values))
	seen := make(map[string]struct{}, len(values))
	for _, value := range values {
		normalized := NormalizeStoredImagePath(value)
		if normalized == "" {
			continue
		}
		if _, exists := seen[normalized]; exists {
			continue
		}
		seen[normalized] = struct{}{}
		result = append(result, normalized)
	}
	return result
}

// NormalizeStoredImagePathsJSON parses a JSON string array and converts each entry
// into a stored relative asset path when possible.
func NormalizeStoredImagePathsJSON(imagesJSON string) string {
	if strings.TrimSpace(imagesJSON) == "" {
		return imagesJSON
	}

	var images []string
	if err := json.Unmarshal([]byte(imagesJSON), &images); err != nil {
		return imagesJSON
	}

	normalized := NormalizeStoredImagePaths(images)
	b, err := json.Marshal(normalized)
	if err != nil {
		return imagesJSON
	}

	return string(b)
}

// NormalizeStoredImageURLFieldsJSON parses a JSON object array and normalizes the
// configured string fields to stored relative asset paths when possible.
func NormalizeStoredImageURLFieldsJSON(raw string, fields ...string) string {
	if strings.TrimSpace(raw) == "" {
		return raw
	}
	if len(fields) == 0 {
		return raw
	}

	var items []map[string]interface{}
	if err := json.Unmarshal([]byte(raw), &items); err != nil {
		return raw
	}

	for _, item := range items {
		for _, field := range fields {
			if item == nil {
				continue
			}
			value, ok := item[field]
			if !ok {
				continue
			}
			switch typed := value.(type) {
			case string:
				item[field] = NormalizeStoredImagePath(typed)
			case []string:
				item[field] = NormalizeStoredImagePaths(typed)
			case []interface{}:
				images := make([]string, 0, len(typed))
				for _, imageValue := range typed {
					stringValue, ok := imageValue.(string)
					if !ok {
						continue
					}
					if trimmed := strings.TrimSpace(stringValue); trimmed != "" {
						images = append(images, trimmed)
					}
				}
				item[field] = NormalizeStoredImagePaths(images)
			}
		}
	}

	encoded, err := json.Marshal(items)
	if err != nil {
		return raw
	}

	return string(encoded)
}

// NormalizeImageURLsJSON parses a JSON string array and converts each entry
// into a full URL. If parsing fails, the original string is returned.
func NormalizeImageURLsJSON(imagesJSON string) string {
	if imagesJSON == "" {
		return imagesJSON
	}

	var images []string
	if err := json.Unmarshal([]byte(imagesJSON), &images); err != nil {
		return imagesJSON
	}

	images = GetFullImageURLs(images)
	b, err := json.Marshal(images)
	if err != nil {
		return imagesJSON
	}

	return string(b)
}
