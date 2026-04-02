package service

import (
	"encoding/json"
	"strings"

	imgutil "home-decoration-server/internal/utils/image"
)

func normalizeStoredAsset(value string) string {
	return imgutil.NormalizeStoredImagePath(value)
}

func normalizeStoredAssetSlice(values []string) []string {
	return imgutil.NormalizeStoredImagePaths(values)
}

func normalizeStoredAssetJSONArray(raw string) string {
	return imgutil.NormalizeStoredImagePathsJSON(raw)
}

func normalizeStoredAssetJSONArrayField(raw string, fields ...string) string {
	return imgutil.NormalizeStoredImageURLFieldsJSON(raw, fields...)
}

func normalizeStoredAssetJSONMap(raw string, fields ...string) string {
	if strings.TrimSpace(raw) == "" {
		return raw
	}
	if len(fields) == 0 {
		return raw
	}

	var payload map[string]interface{}
	if err := json.Unmarshal([]byte(raw), &payload); err != nil {
		return raw
	}

	for _, field := range fields {
		value, ok := payload[field]
		if !ok {
			continue
		}
		switch typed := value.(type) {
		case string:
			payload[field] = normalizeStoredAsset(typed)
		case []string:
			payload[field] = normalizeStoredAssetSlice(typed)
		case []interface{}:
			values := make([]string, 0, len(typed))
			for _, item := range typed {
				stringValue, ok := item.(string)
				if !ok {
					continue
				}
				if trimmed := strings.TrimSpace(stringValue); trimmed != "" {
					values = append(values, trimmed)
				}
			}
			payload[field] = normalizeStoredAssetSlice(values)
		}
	}

	encoded, err := json.Marshal(payload)
	if err != nil {
		return raw
	}

	return string(encoded)
}

func hydrateAssetSlice(values []string) []string {
	return imgutil.GetFullImageURLs(values)
}

func hydrateAssetJSONArray(raw string) string {
	return imgutil.NormalizeImageURLsJSON(raw)
}

func hydrateAssetJSONMap(raw string, fields ...string) string {
	if strings.TrimSpace(raw) == "" {
		return raw
	}
	if len(fields) == 0 {
		return raw
	}

	var payload map[string]interface{}
	if err := json.Unmarshal([]byte(raw), &payload); err != nil {
		return raw
	}

	for _, field := range fields {
		value, ok := payload[field]
		if !ok {
			continue
		}
		switch typed := value.(type) {
		case string:
			payload[field] = imgutil.GetFullImageURL(typed)
		case []string:
			payload[field] = imgutil.GetFullImageURLs(typed)
		case []interface{}:
			items := make([]string, 0, len(typed))
			for _, item := range typed {
				stringValue, ok := item.(string)
				if !ok {
					continue
				}
				if trimmed := strings.TrimSpace(stringValue); trimmed != "" {
					items = append(items, trimmed)
				}
			}
			payload[field] = imgutil.GetFullImageURLs(items)
		}
	}

	encoded, err := json.Marshal(payload)
	if err != nil {
		return raw
	}

	return string(encoded)
}
