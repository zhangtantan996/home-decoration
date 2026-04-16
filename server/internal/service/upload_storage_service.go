package service

import (
	"context"
	"crypto/hmac"
	"crypto/sha1"
	"encoding/base64"
	"errors"
	"fmt"
	"home-decoration-server/internal/config"
	"io"
	"mime"
	"net/http"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"strings"
	"time"
)

type UploadStorageService struct {
	cfg config.StorageConfig
}

func NewUploadStorageService() *UploadStorageService {
	return &UploadStorageService{cfg: config.GetConfig().Storage}
}

func (s *UploadStorageService) Save(ctx context.Context, localPath, publicPath string) error {
	return s.SaveWithContentType(ctx, localPath, publicPath, detectUploadContentType(publicPath))
}

func (s *UploadStorageService) SaveWithContentType(ctx context.Context, localPath, publicPath, contentType string) error {
	cleanPath, err := normalizeUploadPublicPath(publicPath)
	if err != nil {
		return err
	}

	driver := strings.ToLower(strings.TrimSpace(s.cfg.Driver))
	if driver == "" {
		driver = "local"
	}

	switch driver {
	case "local":
		return saveUploadToLocal(localPath, cleanPath)
	case "oss":
		return s.saveUploadToOSS(ctx, localPath, cleanPath, contentType)
	default:
		return fmt.Errorf("不支持的存储驱动: %s", driver)
	}
}

func detectUploadContentType(publicPath string) string {
	contentType := mime.TypeByExtension(strings.ToLower(filepath.Ext(publicPath)))
	if strings.TrimSpace(contentType) == "" {
		return "application/octet-stream"
	}
	return contentType
}

func normalizeUploadPublicPath(publicPath string) (string, error) {
	cleanPath := strings.TrimSpace(publicPath)
	if cleanPath == "" {
		return "", errors.New("上传路径不能为空")
	}
	if !strings.HasPrefix(cleanPath, "/") {
		cleanPath = "/" + cleanPath
	}
	cleanPath = path.Clean(cleanPath)
	if !strings.HasPrefix(cleanPath, "/uploads/") && cleanPath != "/uploads" {
		return "", errors.New("仅支持 uploads 路径")
	}
	return cleanPath, nil
}

func saveUploadToLocal(localPath, publicPath string) error {
	relPath := strings.TrimPrefix(publicPath, "/")
	dstPath := filepath.Join(".", filepath.FromSlash(relPath))
	if filepath.Clean(localPath) == filepath.Clean(dstPath) {
		return nil
	}
	if err := os.MkdirAll(filepath.Dir(dstPath), 0o750); err != nil {
		return err
	}

	src, err := os.Open(localPath)
	if err != nil {
		return err
	}
	defer src.Close()

	dst, err := os.Create(dstPath)
	if err != nil {
		return err
	}
	defer dst.Close()

	if _, err := io.Copy(dst, src); err != nil {
		return err
	}
	return nil
}

func (s *UploadStorageService) saveUploadToOSS(ctx context.Context, localPath, publicPath, contentType string) error {
	cfg := s.cfg
	if strings.TrimSpace(cfg.OSSEndpoint) == "" || strings.TrimSpace(cfg.OSSAccessKeyID) == "" || strings.TrimSpace(cfg.OSSAccessKeySecret) == "" || strings.TrimSpace(cfg.OSSBucket) == "" {
		return errors.New("OSS 存储未配置完整")
	}

	file, err := os.Open(localPath)
	if err != nil {
		return err
	}
	defer file.Close()

	info, err := file.Stat()
	if err != nil {
		return err
	}

	objectKey := strings.TrimPrefix(publicPath, "/")
	uploadURL, canonicalResource, err := buildOSSUploadURL(cfg.OSSEndpoint, cfg.OSSBucket, objectKey)
	if err != nil {
		return err
	}

	date := time.Now().UTC().Format(http.TimeFormat)
	signature := signOSSAuthorization(http.MethodPut, contentType, date, canonicalResource, cfg.OSSAccessKeySecret)

	req, err := http.NewRequestWithContext(ctx, http.MethodPut, uploadURL, file)
	if err != nil {
		return err
	}
	req.ContentLength = info.Size()
	req.Header.Set("Date", date)
	req.Header.Set("Content-Type", contentType)
	req.Header.Set("Authorization", fmt.Sprintf("OSS %s:%s", cfg.OSSAccessKeyID, signature))

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		return nil
	}

	body, _ := io.ReadAll(io.LimitReader(resp.Body, 2048))
	return fmt.Errorf("OSS 上传失败: status=%d body=%s", resp.StatusCode, strings.TrimSpace(string(body)))
}

func buildOSSUploadURL(endpoint, bucket, objectKey string) (string, string, error) {
	raw := strings.TrimSpace(endpoint)
	if raw == "" {
		return "", "", errors.New("OSS endpoint 未配置")
	}
	if !strings.HasPrefix(raw, "http://") && !strings.HasPrefix(raw, "https://") {
		raw = "https://" + raw
	}
	parsed, err := url.Parse(raw)
	if err != nil {
		return "", "", err
	}
	if parsed.Host == "" {
		return "", "", errors.New("OSS endpoint 无效")
	}
	parsed.Host = bucket + "." + parsed.Host
	parsed.Path = "/" + strings.TrimLeft(objectKey, "/")
	return parsed.String(), "/" + bucket + "/" + strings.TrimLeft(objectKey, "/"), nil
}

func signOSSAuthorization(method, contentType, date, canonicalResource, accessKeySecret string) string {
	stringToSign := strings.Join([]string{method, "", contentType, date, canonicalResource}, "\n")
	mac := hmac.New(sha1.New, []byte(accessKeySecret))
	_, _ = mac.Write([]byte(stringToSign))
	return base64.StdEncoding.EncodeToString(mac.Sum(nil))
}
