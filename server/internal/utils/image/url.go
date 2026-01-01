package image

import (
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
