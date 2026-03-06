package image

import (
	"encoding/json"
	"net/url"
	"strings"
)

var unstableImageHostFragments = []string{
	"images.unsplash.com",
	"via.placeholder.com",
	"placehold.co",
}

const DefaultInspirationCoverPath = "/static/inspiration/default-cover.png"
const DefaultInspirationAvatarPath = "/static/inspiration/default-avatar.png"

var controlledInspirationAssetPaths = []string{
	"/static/inspiration/modern-minimal.png",
	"/static/inspiration/nordic-fresh.png",
	"/static/inspiration/new-chinese.png",
	"/static/inspiration/japanese-wood.png",
	"/static/inspiration/light-luxury.png",
}

const controlledInspirationGallerySize = 3

func IsRelativeLocalImagePath(raw string) bool {
	value := strings.TrimSpace(raw)
	if value == "" || strings.HasPrefix(value, "//") {
		return false
	}

	parsed, err := url.Parse(value)
	if err != nil {
		return false
	}

	return parsed.Scheme == "" && parsed.Host == ""
}

func IsFirstPartyAbsoluteImageURL(raw string, publicURL string) bool {
	value := strings.TrimSpace(raw)
	base := strings.TrimSpace(publicURL)
	if value == "" || base == "" {
		return false
	}

	imageURL, err := url.Parse(value)
	if err != nil || imageURL.Scheme == "" || imageURL.Host == "" {
		return false
	}

	baseURL, err := url.Parse(base)
	if err != nil || baseURL.Host == "" {
		return false
	}

	if !strings.EqualFold(imageURL.Host, baseURL.Host) {
		return false
	}

	return strings.HasPrefix(imageURL.Path, "/uploads/") || strings.HasPrefix(imageURL.Path, "/static/")
}

func IsKnownUnstableImageURL(raw string) bool {
	value := strings.ToLower(strings.TrimSpace(raw))
	if value == "" {
		return false
	}

	for _, fragment := range unstableImageHostFragments {
		if strings.Contains(value, fragment) {
			return true
		}
	}

	return false
}

func IsStableFirstPartyImageRef(raw string, publicURL string) bool {
	return IsRelativeLocalImagePath(raw) || IsFirstPartyAbsoluteImageURL(raw, publicURL)
}

func ControlledInspirationCover(seed uint64) string {
	if len(controlledInspirationAssetPaths) == 0 {
		return DefaultInspirationCoverPath
	}

	return controlledInspirationAssetPaths[int(seed%uint64(len(controlledInspirationAssetPaths)))]
}

func ControlledInspirationGallery(seed uint64) []string {
	if len(controlledInspirationAssetPaths) == 0 {
		return []string{DefaultInspirationCoverPath}
	}

	gallerySize := controlledInspirationGallerySize
	if gallerySize > len(controlledInspirationAssetPaths) {
		gallerySize = len(controlledInspirationAssetPaths)
	}

	start := int(seed % uint64(len(controlledInspirationAssetPaths)))
	gallery := make([]string, 0, gallerySize)
	for i := 0; i < gallerySize; i++ {
		gallery = append(gallery, controlledInspirationAssetPaths[(start+i)%len(controlledInspirationAssetPaths)])
	}

	return gallery
}

func ShouldRepairInspirationCover(coverImage string, publicURL string) bool {
	value := strings.TrimSpace(coverImage)
	if value == "" {
		return true
	}

	if IsStableFirstPartyImageRef(value, publicURL) {
		return false
	}

	return IsKnownUnstableImageURL(value)
}

func ShouldRepairInspirationImagesJSON(imagesJSON string, publicURL string) bool {
	trimmed := strings.TrimSpace(imagesJSON)
	if trimmed == "" {
		return true
	}

	var images []string
	if err := json.Unmarshal([]byte(trimmed), &images); err != nil {
		return true
	}
	if len(images) == 0 {
		return true
	}

	for _, image := range images {
		if IsKnownUnstableImageURL(image) {
			return true
		}
		if strings.TrimSpace(image) == "" {
			return true
		}
		if IsStableFirstPartyImageRef(image, publicURL) {
			continue
		}
	}

	return false
}

func RepairInspirationCaseAssets(caseID uint64, coverImage string, imagesJSON string, publicURL string) (string, string, bool) {
	updatedCover := coverImage
	updatedImagesJSON := imagesJSON
	changed := false

	if ShouldRepairInspirationCover(coverImage, publicURL) {
		updatedCover = ControlledInspirationCover(caseID)
		changed = true
	}

	if ShouldRepairInspirationImagesJSON(imagesJSON, publicURL) {
		galleryJSON, err := json.Marshal(ControlledInspirationGallery(caseID))
		if err == nil {
			updatedImagesJSON = string(galleryJSON)
			changed = true
		}
	}

	return updatedCover, updatedImagesJSON, changed
}
