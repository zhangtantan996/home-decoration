package handler

import (
	"encoding/json"
	"fmt"
	"sort"
	"strings"
)

type BusinessHoursRangeInput struct {
	Day   int    `json:"day"`
	Start string `json:"start"`
	End   string `json:"end"`
}

var foremanCategoryDisplayNames = map[string]string{
	"water":    "水工施工展示",
	"electric": "电工施工展示",
	"wood":     "木工施工展示",
	"masonry":  "瓦工施工展示",
	"paint":    "油漆工施工展示",
	"other":    "其他施工展示",
}

var foremanRequiredCategories = []string{"water", "electric", "wood", "masonry", "paint"}
var foremanCategoryOrder = []string{"water", "electric", "wood", "masonry", "paint", "other"}

func normalizeBusinessHoursRanges(ranges []BusinessHoursRangeInput) []BusinessHoursRangeInput {
	result := make([]BusinessHoursRangeInput, 0, len(ranges))
	seen := make(map[string]struct{}, len(ranges))
	for _, item := range ranges {
		normalized := BusinessHoursRangeInput{
			Day:   item.Day,
			Start: strings.TrimSpace(item.Start),
			End:   strings.TrimSpace(item.End),
		}
		if normalized.Day < 1 || normalized.Day > 7 {
			continue
		}
		if normalized.Start == "" || normalized.End == "" {
			continue
		}
		key := fmt.Sprintf("%d-%s-%s", normalized.Day, normalized.Start, normalized.End)
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		result = append(result, normalized)
	}
	sort.SliceStable(result, func(i, j int) bool {
		if result[i].Day == result[j].Day {
			if result[i].Start == result[j].Start {
				return result[i].End < result[j].End
			}
			return result[i].Start < result[j].Start
		}
		return result[i].Day < result[j].Day
	})
	return result
}

func validateBusinessHoursRanges(ranges []BusinessHoursRangeInput) error {
	ranges = normalizeBusinessHoursRanges(ranges)
	if len(ranges) == 0 {
		return fmt.Errorf("请至少填写1条营业时间")
	}
	for idx, item := range ranges {
		if item.Day < 1 || item.Day > 7 {
			return fmt.Errorf("第%d条营业时间日期无效", idx+1)
		}
		if !isValidClockValue(item.Start) || !isValidClockValue(item.End) {
			return fmt.Errorf("第%d条营业时间格式无效", idx+1)
		}
		if item.Start >= item.End {
			return fmt.Errorf("第%d条营业时间开始时间必须早于结束时间", idx+1)
		}
	}
	return nil
}

func isValidClockValue(raw string) bool {
	if len(raw) != 5 || raw[2] != ':' {
		return false
	}
	hour := raw[:2]
	minute := raw[3:]
	if hour < "00" || hour > "23" || minute < "00" || minute > "59" {
		return false
	}
	return true
}

func summarizeBusinessHoursRanges(ranges []BusinessHoursRangeInput) string {
	ranges = normalizeBusinessHoursRanges(ranges)
	if len(ranges) == 0 {
		return ""
	}
	dayLabels := map[int]string{1: "周一", 2: "周二", 3: "周三", 4: "周四", 5: "周五", 6: "周六", 7: "周日"}
	parts := make([]string, 0, len(ranges))
	for _, item := range ranges {
		parts = append(parts, fmt.Sprintf("%s %s-%s", dayLabels[item.Day], item.Start, item.End))
	}
	return strings.Join(parts, "；")
}

func parseBusinessHoursRanges(raw string) []BusinessHoursRangeInput {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return []BusinessHoursRangeInput{}
	}
	var ranges []BusinessHoursRangeInput
	if err := json.Unmarshal([]byte(trimmed), &ranges); err != nil {
		return []BusinessHoursRangeInput{}
	}
	return normalizeBusinessHoursRanges(ranges)
}

func normalizeForemanCategory(raw string) string {
	normalized := strings.ToLower(strings.TrimSpace(raw))
	switch normalized {
	case "water", "electric", "wood", "masonry", "paint", "other":
		return normalized
	}
	title := strings.TrimSpace(raw)
	for key, value := range foremanCategoryDisplayNames {
		if title == value {
			return key
		}
	}
	if strings.Contains(title, "水") {
		return "water"
	}
	if strings.Contains(title, "电") {
		return "electric"
	}
	if strings.Contains(title, "木") {
		return "wood"
	}
	if strings.Contains(title, "瓦") {
		return "masonry"
	}
	if strings.Contains(title, "油") || strings.Contains(title, "漆") {
		return "paint"
	}
	return "other"
}

func normalizeForemanPortfolioCases(cases []PortfolioCaseInput) []PortfolioCaseInput {
	mapped := make(map[string]PortfolioCaseInput, len(cases))
	for _, item := range cases {
		category := normalizeForemanCategory(firstNonEmpty(item.Category, item.Title))
		existing, exists := mapped[category]
		if !exists || strings.TrimSpace(existing.Description) == "" {
			item.Category = category
			item.Title = foremanCategoryDisplayNames[category]
			item.Style = ""
			item.Area = ""
			mapped[category] = item
		}
	}
	result := make([]PortfolioCaseInput, 0, len(mapped))
	for _, category := range foremanCategoryOrder {
		if item, ok := mapped[category]; ok {
			result = append(result, item)
		}
	}
	return result
}

func parseJSONStringSlice(raw string) []string {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return []string{}
	}
	var values []string
	if err := json.Unmarshal([]byte(trimmed), &values); err != nil {
		return []string{}
	}
	return normalizeStringSlice(values)
}
