package handler

import (
	"context"
	"fmt"
	imgutil "home-decoration-server/internal/utils/image"
	"mime/multipart"
	"os"
	"path/filepath"
	"strings"

	"home-decoration-server/internal/service"
)

type storedUploadAsset struct {
	Path          string
	URL           string
	ThumbnailPath string
	ThumbnailURL  string
	Width         int
	Height        int
}

func persistUploadedFile(file *multipart.FileHeader, publicPath string) (*storedUploadAsset, error) {
	return persistUploadedFileWithSpec(file, publicPath, nil)
}

func persistUploadedFileWithSpec(file *multipart.FileHeader, publicPath string, spec *imgutil.UploadAssetSpec) (*storedUploadAsset, error) {
	localPath, cleanup, err := writeUploadedFileToTemp(file, filepath.Ext(publicPath))
	if err != nil {
		return nil, err
	}
	defer cleanup()

	var meta *imgutil.UploadAssetMeta
	if spec != nil {
		meta, err = imgutil.ProcessUploadedImageAsset(localPath, publicPath, filepath.Ext(publicPath), *spec)
		if err != nil {
			return nil, err
		}
	}

	storage := service.NewUploadStorageService()
	if err := storage.Save(context.Background(), localPath, publicPath); err != nil {
		return nil, err
	}

	thumbnailPath := resolveUploadThumbnailPath(meta, publicPath)
	if meta != nil && thumbnailPath != publicPath {
		thumbLocalPath := deriveLocalThumbnailPath(localPath, thumbnailPath)
		if err := storage.Save(context.Background(), thumbLocalPath, thumbnailPath); err != nil {
			return nil, err
		}
	}

	return &storedUploadAsset{
		Path:          publicPath,
		URL:           imgutil.GetFullImageURL(publicPath),
		ThumbnailPath: thumbnailPath,
		ThumbnailURL:  imgutil.GetFullImageURL(thumbnailPath),
		Width:         resolveUploadAssetWidth(meta),
		Height:        resolveUploadAssetHeight(meta),
	}, nil
}

func writeUploadedFileToTemp(file *multipart.FileHeader, ext string) (string, func(), error) {
	tempFile, err := os.CreateTemp("", "upload-*"+ext)
	if err != nil {
		return "", nil, err
	}

	cleanup := func() {
		_ = os.Remove(tempFile.Name())
		base := strings.TrimSuffix(tempFile.Name(), filepath.Ext(tempFile.Name()))
		_ = os.Remove(base + "_thumb" + filepath.Ext(tempFile.Name()))
		_ = os.Remove(base + "_thumb.jpg")
		_ = os.Remove(base + "_thumb.png")
	}

	src, err := file.Open()
	if err != nil {
		_ = tempFile.Close()
		cleanup()
		return "", nil, err
	}
	defer src.Close()

	if _, err := tempFile.ReadFrom(src); err != nil {
		_ = tempFile.Close()
		cleanup()
		return "", nil, err
	}
	if err := tempFile.Close(); err != nil {
		cleanup()
		return "", nil, err
	}

	return tempFile.Name(), cleanup, nil
}

func deriveLocalThumbnailPath(localPath string, thumbnailPath string) string {
	return strings.TrimSuffix(localPath, filepath.Ext(localPath)) + "_thumb" + filepath.Ext(thumbnailPath)
}

func buildUploadPublicPath(dir string, filename string) string {
	cleanDir := strings.Trim(strings.ReplaceAll(dir, "\\", "/"), "/")
	cleanName := strings.TrimPrefix(strings.ReplaceAll(filename, "\\", "/"), "/")
	if cleanDir == "" {
		return fmt.Sprintf("/uploads/%s", cleanName)
	}
	return fmt.Sprintf("/uploads/%s/%s", cleanDir, cleanName)
}
