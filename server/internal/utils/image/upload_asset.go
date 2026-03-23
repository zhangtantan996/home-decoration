package image

import (
	"errors"
	"fmt"
	"image"
	"image/color"
	"image/jpeg"
	"image/png"
	"math"
	"os"
	"path/filepath"
	"strings"

	_ "image/gif"
)

type UploadAssetSpec struct {
	MinShortEdge       int
	ThumbnailMaxWidth  int
	ThumbnailMaxHeight int
}

type UploadAssetMeta struct {
	Width         int
	Height        int
	ThumbnailPath string
}

type ImageTooSmallError struct {
	MinShortEdge    int
	ActualShortEdge int
}

func (e *ImageTooSmallError) Error() string {
	return fmt.Sprintf("图片分辨率过低，最短边至少 %dpx，当前 %dpx", e.MinShortEdge, e.ActualShortEdge)
}

func IsImageTooSmallError(err error) (*ImageTooSmallError, bool) {
	var target *ImageTooSmallError
	if errors.As(err, &target) {
		return target, true
	}
	return nil, false
}

func ProcessUploadedImageAsset(localPath string, publicPath string, ext string, spec UploadAssetSpec) (*UploadAssetMeta, error) {
	if !supportsImageProcessing(ext) {
		return nil, nil
	}

	file, err := os.Open(localPath)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	cfg, _, err := image.DecodeConfig(file)
	if err != nil {
		return nil, nil
	}

	meta := &UploadAssetMeta{
		Width:  cfg.Width,
		Height: cfg.Height,
	}
	shortEdge := minInt(cfg.Width, cfg.Height)
	if spec.MinShortEdge > 0 && shortEdge < spec.MinShortEdge {
		return nil, &ImageTooSmallError{
			MinShortEdge:    spec.MinShortEdge,
			ActualShortEdge: shortEdge,
		}
	}

	if spec.ThumbnailMaxWidth <= 0 || spec.ThumbnailMaxHeight <= 0 {
		return meta, nil
	}

	thumbWidth, thumbHeight := fitSize(cfg.Width, cfg.Height, spec.ThumbnailMaxWidth, spec.ThumbnailMaxHeight)
	if thumbWidth <= 0 || thumbHeight <= 0 {
		return meta, nil
	}

	if thumbWidth == cfg.Width && thumbHeight == cfg.Height {
		meta.ThumbnailPath = publicPath
		return meta, nil
	}

	imageFile, err := os.Open(localPath)
	if err != nil {
		return nil, err
	}
	defer imageFile.Close()

	srcImage, _, err := image.Decode(imageFile)
	if err != nil {
		return meta, nil
	}

	resized := resizeImageNearest(srcImage, thumbWidth, thumbHeight)
	thumbExt := thumbnailExtension(ext)
	thumbLocalPath := strings.TrimSuffix(localPath, filepath.Ext(localPath)) + "_thumb" + thumbExt
	thumbPublicPath := strings.TrimSuffix(publicPath, filepath.Ext(publicPath)) + "_thumb" + thumbExt

	out, err := os.Create(thumbLocalPath)
	if err != nil {
		return nil, err
	}
	defer out.Close()

	switch thumbExt {
	case ".png":
		err = png.Encode(out, resized)
	default:
		err = jpeg.Encode(out, resized, &jpeg.Options{Quality: 85})
	}
	if err != nil {
		return nil, err
	}

	meta.ThumbnailPath = thumbPublicPath
	return meta, nil
}

func supportsImageProcessing(ext string) bool {
	switch strings.ToLower(strings.TrimSpace(ext)) {
	case ".jpg", ".jpeg", ".png", ".gif":
		return true
	default:
		return false
	}
}

func thumbnailExtension(ext string) string {
	switch strings.ToLower(strings.TrimSpace(ext)) {
	case ".png":
		return ".png"
	default:
		return ".jpg"
	}
}

func fitSize(srcWidth, srcHeight, maxWidth, maxHeight int) (int, int) {
	if srcWidth <= 0 || srcHeight <= 0 || maxWidth <= 0 || maxHeight <= 0 {
		return 0, 0
	}
	scale := math.Min(float64(maxWidth)/float64(srcWidth), float64(maxHeight)/float64(srcHeight))
	if scale >= 1 {
		return srcWidth, srcHeight
	}
	return maxInt(1, int(math.Round(float64(srcWidth)*scale))), maxInt(1, int(math.Round(float64(srcHeight)*scale)))
}

func resizeImageNearest(src image.Image, targetWidth, targetHeight int) *image.RGBA {
	dst := image.NewRGBA(image.Rect(0, 0, targetWidth, targetHeight))
	srcBounds := src.Bounds()
	srcWidth := srcBounds.Dx()
	srcHeight := srcBounds.Dy()
	for y := 0; y < targetHeight; y++ {
		srcY := srcBounds.Min.Y + (y * srcHeight / targetHeight)
		for x := 0; x < targetWidth; x++ {
			srcX := srcBounds.Min.X + (x * srcWidth / targetWidth)
			dst.Set(x, y, color.RGBAModel.Convert(src.At(srcX, srcY)))
		}
	}
	return dst
}

func minInt(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func maxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}
