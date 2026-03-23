package image

import (
	"image"
	"image/color"
	"image/jpeg"
	"os"
	"path/filepath"
	"testing"
)

func createTestJPEG(t *testing.T, path string, width int, height int) {
	t.Helper()
	file, err := os.Create(path)
	if err != nil {
		t.Fatalf("create jpeg: %v", err)
	}
	defer file.Close()

	canvas := image.NewRGBA(image.Rect(0, 0, width, height))
	for y := 0; y < height; y++ {
		for x := 0; x < width; x++ {
			canvas.Set(x, y, color.RGBA{R: 40, G: 120, B: 200, A: 255})
		}
	}
	if err := jpeg.Encode(file, canvas, &jpeg.Options{Quality: 90}); err != nil {
		t.Fatalf("encode jpeg: %v", err)
	}
}

func TestProcessUploadedImageAssetRejectsSmallImage(t *testing.T) {
	dir := t.TempDir()
	localPath := filepath.Join(dir, "small.jpg")
	createTestJPEG(t, localPath, 280, 280)

	_, err := ProcessUploadedImageAsset(localPath, "/uploads/cases/small.jpg", ".jpg", UploadAssetSpec{
		MinShortEdge:       300,
		ThumbnailMaxWidth:  320,
		ThumbnailMaxHeight: 320,
	})
	if err == nil {
		t.Fatal("expected small image error")
	}
	if _, ok := IsImageTooSmallError(err); !ok {
		t.Fatalf("expected ImageTooSmallError, got %v", err)
	}
}

func TestProcessUploadedImageAssetGeneratesThumbnail(t *testing.T) {
	dir := t.TempDir()
	localPath := filepath.Join(dir, "origin.jpg")
	createTestJPEG(t, localPath, 1600, 1200)

	meta, err := ProcessUploadedImageAsset(localPath, "/uploads/cases/origin.jpg", ".jpg", UploadAssetSpec{
		MinShortEdge:       600,
		ThumbnailMaxWidth:  960,
		ThumbnailMaxHeight: 960,
	})
	if err != nil {
		t.Fatalf("process uploaded image: %v", err)
	}
	if meta == nil {
		t.Fatal("expected meta")
	}
	if meta.Width != 1600 || meta.Height != 1200 {
		t.Fatalf("unexpected dimensions: %+v", meta)
	}
	if meta.ThumbnailPath == "" {
		t.Fatal("expected thumbnail path")
	}
	thumbLocalPath := filepath.Join(dir, "origin_thumb.jpg")
	if _, statErr := os.Stat(thumbLocalPath); statErr != nil {
		t.Fatalf("expected thumbnail file: %v", statErr)
	}
}
