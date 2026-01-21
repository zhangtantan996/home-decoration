package image

import (
	"encoding/json"
	"strings"

	"home-decoration-server/internal/config"
)

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
