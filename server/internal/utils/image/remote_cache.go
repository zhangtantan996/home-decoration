package image

import (
	"context"
	"crypto/sha1"
	"encoding/hex"
	"fmt"
	"io"
	"mime"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"
)

const (
	remoteImageMirrorPublicPrefix = "/uploads/remote-cache"
	remoteImageMirrorMaxBytes     = 8 << 20
)

var (
	remoteImageMirrorStorageDir = filepath.Join(".", "uploads", "remote-cache")
	remoteImageMirrorHTTPClient = &http.Client{Timeout: 4 * time.Second}
)

// MirrorKnownUnstableImageURL 将不稳定外链镜像到本地 uploads，返回可对外访问的相对路径。
// 若镜像失败，返回空字符串，由上层决定是否继续回退。
func MirrorKnownUnstableImageURL(raw string) string {
	value := strings.TrimSpace(raw)
	if value == "" || !IsKnownUnstableImageURL(value) {
		return ""
	}

	parsed, err := url.Parse(value)
	if err != nil {
		return ""
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return ""
	}

	fileKey := sha1.Sum([]byte(value))
	fileBase := hex.EncodeToString(fileKey[:])

	if mirroredPath := findExistingMirroredImage(fileBase); mirroredPath != "" {
		return mirroredPath
	}

	request, err := http.NewRequestWithContext(context.Background(), http.MethodGet, value, nil)
	if err != nil {
		return ""
	}
	request.Header.Set("User-Agent", "home-decoration-server/avatar-mirror")

	response, err := remoteImageMirrorHTTPClient.Do(request)
	if err != nil {
		return ""
	}
	defer response.Body.Close()

	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return ""
	}

	contentType := strings.ToLower(strings.TrimSpace(response.Header.Get("Content-Type")))
	if !strings.HasPrefix(contentType, "image/") {
		return ""
	}

	ext := resolveMirroredImageExtension(parsed, contentType)
	if ext == "" {
		return ""
	}

	if err := os.MkdirAll(remoteImageMirrorStorageDir, 0o755); err != nil {
		return ""
	}

	fileName := fileBase + ext
	publicPath := remoteImageMirrorPublicPrefix + "/" + fileName
	localPath := filepath.Join(remoteImageMirrorStorageDir, fileName)
	tempPath := localPath + ".tmp"

	output, err := os.Create(tempPath)
	if err != nil {
		return ""
	}

	written, copyErr := io.Copy(output, io.LimitReader(response.Body, remoteImageMirrorMaxBytes+1))
	closeErr := output.Close()
	if copyErr != nil || closeErr != nil || written == 0 || written > remoteImageMirrorMaxBytes {
		_ = os.Remove(tempPath)
		return ""
	}

	if err := os.Rename(tempPath, localPath); err != nil {
		_ = os.Remove(tempPath)
		return ""
	}

	return publicPath
}

func findExistingMirroredImage(fileBase string) string {
	pattern := filepath.Join(remoteImageMirrorStorageDir, fileBase+".*")
	matches, err := filepath.Glob(pattern)
	if err != nil || len(matches) == 0 {
		return ""
	}

	fileName := filepath.Base(matches[0])
	return fmt.Sprintf("%s/%s", remoteImageMirrorPublicPrefix, fileName)
}

func resolveMirroredImageExtension(parsed *url.URL, contentType string) string {
	if ext := normalizeMirroredImageExtension(filepath.Ext(parsed.Path)); ext != "" {
		return ext
	}

	if mediaType, _, err := mime.ParseMediaType(contentType); err == nil {
		if exts, extErr := mime.ExtensionsByType(mediaType); extErr == nil {
			for _, ext := range exts {
				if normalized := normalizeMirroredImageExtension(ext); normalized != "" {
					return normalized
				}
			}
		}
	}

	return ".jpg"
}

func normalizeMirroredImageExtension(raw string) string {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case ".jpg", ".jpeg":
		return ".jpg"
	case ".png":
		return ".png"
	case ".gif":
		return ".gif"
	case ".webp":
		return ".webp"
	default:
		return ""
	}
}
