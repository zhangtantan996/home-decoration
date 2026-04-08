package image

import (
	"bytes"
	"context"
	"image"
	"image/color"
	"image/png"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestMirrorKnownUnstableImageURL(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "image/png")
		img := image.NewRGBA(image.Rect(0, 0, 2, 2))
		img.Set(0, 0, color.RGBA{R: 255, A: 255})
		img.Set(1, 1, color.RGBA{B: 255, A: 255})
		if err := png.Encode(w, img); err != nil {
			t.Fatalf("encode png: %v", err)
		}
	}))
	defer server.Close()

	tempDir := t.TempDir()
	previousStorageDir := remoteImageMirrorStorageDir
	previousClient := remoteImageMirrorHTTPClient
	remoteImageMirrorStorageDir = tempDir
	remoteImageMirrorHTTPClient = &http.Client{
		Timeout: 2 * time.Second,
		Transport: &http.Transport{
			DialContext: func(ctx context.Context, network, _ string) (net.Conn, error) {
				return (&net.Dialer{}).DialContext(ctx, network, server.Listener.Addr().String())
			},
		},
	}
	t.Cleanup(func() {
		remoteImageMirrorStorageDir = previousStorageDir
		remoteImageMirrorHTTPClient = previousClient
	})

	publicPath := MirrorKnownUnstableImageURL("http://images.unsplash.com/avatar-seed")
	if publicPath == "" {
		t.Fatalf("expected mirrored public path")
	}
	if filepath.Dir(publicPath) != remoteImageMirrorPublicPrefix {
		t.Fatalf("unexpected public path: %s", publicPath)
	}

	localPath := filepath.Join(tempDir, filepath.Base(publicPath))
	fileBytes, err := os.ReadFile(localPath)
	if err != nil {
		t.Fatalf("read mirrored file: %v", err)
	}
	if len(fileBytes) == 0 {
		t.Fatalf("expected mirrored file content")
	}

	secondPublicPath := MirrorKnownUnstableImageURL("http://images.unsplash.com/avatar-seed")
	if secondPublicPath != publicPath {
		t.Fatalf("expected cached mirrored path, got %s want %s", secondPublicPath, publicPath)
	}

	secondBytes, err := os.ReadFile(localPath)
	if err != nil {
		t.Fatalf("read cached mirrored file: %v", err)
	}
	if !bytes.Equal(fileBytes, secondBytes) {
		t.Fatalf("expected cached file to remain unchanged")
	}
}
