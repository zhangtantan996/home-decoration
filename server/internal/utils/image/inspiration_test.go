package image

import (
	"encoding/json"
	"reflect"
	"testing"
)

func TestIsFirstPartyAbsoluteImageURL(t *testing.T) {
	if !IsFirstPartyAbsoluteImageURL("https://api.example.com/static/inspiration/modern-minimal.png", "https://api.example.com") {
		t.Fatal("expected first-party static URL to be recognized")
	}
	if IsFirstPartyAbsoluteImageURL("https://cdn.example.com/static/inspiration/modern-minimal.png", "https://api.example.com") {
		t.Fatal("expected third-party host to be rejected")
	}
}

func TestShouldRepairInspirationCover(t *testing.T) {
	if !ShouldRepairInspirationCover("", "https://api.example.com") {
		t.Fatal("expected empty cover to require repair")
	}
	if !ShouldRepairInspirationCover("https://images.unsplash.com/photo-1", "https://api.example.com") {
		t.Fatal("expected unstable cover URL to require repair")
	}
	if ShouldRepairInspirationCover("/static/inspiration/modern-minimal.png", "https://api.example.com") {
		t.Fatal("expected local cover path to remain unchanged")
	}
	if ShouldRepairInspirationCover("https://api.example.com/static/inspiration/modern-minimal.png", "https://api.example.com") {
		t.Fatal("expected first-party absolute cover URL to remain unchanged")
	}
}

func TestShouldRepairInspirationImagesJSON(t *testing.T) {
	cases := []struct {
		name       string
		imagesJSON string
		want       bool
	}{
		{name: "empty", imagesJSON: "", want: true},
		{name: "bad json", imagesJSON: "[", want: true},
		{name: "unstable host", imagesJSON: `["https://placehold.co/600x400"]`, want: true},
		{name: "relative local", imagesJSON: `["/static/inspiration/modern-minimal.png","/static/inspiration/nordic-fresh.png"]`, want: false},
		{name: "first party absolute", imagesJSON: `["https://api.example.com/static/inspiration/modern-minimal.png"]`, want: false},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := ShouldRepairInspirationImagesJSON(tc.imagesJSON, "https://api.example.com")
			if got != tc.want {
				t.Fatalf("expected %v, got %v", tc.want, got)
			}
		})
	}
}

func TestControlledInspirationGalleryIsDeterministic(t *testing.T) {
	want := []string{
		"/static/inspiration/new-chinese.png",
		"/static/inspiration/japanese-wood.png",
		"/static/inspiration/light-luxury.png",
	}
	if got := ControlledInspirationGallery(2); !reflect.DeepEqual(got, want) {
		t.Fatalf("unexpected gallery: %#v", got)
	}
}

func TestRepairInspirationCaseAssets(t *testing.T) {
	cover, imagesJSON, changed := RepairInspirationCaseAssets(
		11,
		"https://images.unsplash.com/photo-1",
		`["https://via.placeholder.com/600x400","/static/inspiration/modern-minimal.png"]`,
		"https://api.example.com",
	)
	if !changed {
		t.Fatal("expected repair to report changes")
	}
	if cover != ControlledInspirationCover(11) {
		t.Fatalf("unexpected repaired cover: %s", cover)
	}

	var images []string
	if err := json.Unmarshal([]byte(imagesJSON), &images); err != nil {
		t.Fatalf("expected valid repaired images JSON: %v", err)
	}
	if want := ControlledInspirationGallery(11); !reflect.DeepEqual(images, want) {
		t.Fatalf("unexpected repaired gallery: %#v", images)
	}
}

func TestRepairInspirationCaseAssetsKeepsStableRefs(t *testing.T) {
	imagesJSON := `["/static/inspiration/modern-minimal.png","https://api.example.com/static/inspiration/nordic-fresh.png"]`
	cover, repairedImagesJSON, changed := RepairInspirationCaseAssets(
		3,
		"/static/inspiration/new-chinese.png",
		imagesJSON,
		"https://api.example.com",
	)
	if changed {
		t.Fatal("expected stable refs to stay untouched")
	}
	if cover != "/static/inspiration/new-chinese.png" {
		t.Fatalf("unexpected cover: %s", cover)
	}
	if repairedImagesJSON != imagesJSON {
		t.Fatalf("unexpected images JSON: %s", repairedImagesJSON)
	}
}
