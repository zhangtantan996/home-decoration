package service

import (
	"encoding/json"
	"fmt"
	"math"
	"strings"

	"home-decoration-server/internal/model"

	"gorm.io/gorm"
)

type ProviderPriceDisplayMode string

const (
	ProviderPriceDisplayModeSingle     ProviderPriceDisplayMode = "single"
	ProviderPriceDisplayModeRange      ProviderPriceDisplayMode = "range"
	ProviderPriceDisplayModeStructured ProviderPriceDisplayMode = "structured"
	ProviderPriceDisplayModeNegotiable ProviderPriceDisplayMode = "negotiable"
)

type ProviderPriceDisplay struct {
	Primary   string                   `json:"primary"`
	Secondary string                   `json:"secondary"`
	Details   []string                 `json:"details"`
	Mode      ProviderPriceDisplayMode `json:"mode"`
}

type providerPriceEntry struct {
	Label  string
	Amount float64
}

func buildProviderPriceDisplay(providerType int8, pricingJSON string, priceMin, priceMax float64, priceUnit string) ProviderPriceDisplay {
	unit := normalizeProviderPriceDisplayUnit(priceUnit)
	structuredEntries := parseProviderPriceEntries(providerType, pricingJSON)

	if providerType == 2 && len(structuredEntries) > 0 {
		return buildCompanyProviderPriceDisplay(structuredEntries, unit)
	}

	if len(structuredEntries) > 0 {
		return buildStructuredProviderPriceDisplay(providerType, structuredEntries, unit)
	}

	minAmount := positiveProviderPriceAmount(priceMin)
	maxAmount := positiveProviderPriceAmount(priceMax)

	switch {
	case minAmount > 0 && maxAmount > 0:
		if minAmount > maxAmount {
			minAmount, maxAmount = maxAmount, minAmount
		}
		if almostEqualProviderPrice(minAmount, maxAmount) {
			primary := formatProviderPriceAmount(maxAmount, unit)
			return ProviderPriceDisplay{
				Primary: primary,
				Details: []string{primary},
				Mode:    ProviderPriceDisplayModeSingle,
			}
		}
		primary := fmt.Sprintf("%s-%s", trimProviderPriceNumber(minAmount), formatProviderPriceAmount(maxAmount, unit))
		return ProviderPriceDisplay{
			Primary: primary,
			Details: []string{primary},
			Mode:    ProviderPriceDisplayModeRange,
		}
	case minAmount > 0:
		primary := formatProviderPriceAmount(minAmount, unit)
		return ProviderPriceDisplay{
			Primary: primary,
			Details: []string{primary},
			Mode:    ProviderPriceDisplayModeSingle,
		}
	case maxAmount > 0:
		primary := formatProviderPriceAmount(maxAmount, unit)
		return ProviderPriceDisplay{
			Primary: primary,
			Details: []string{primary},
			Mode:    ProviderPriceDisplayModeSingle,
		}
	default:
		return ProviderPriceDisplay{
			Primary: "按需报价",
			Details: []string{"按需报价"},
			Mode:    ProviderPriceDisplayModeNegotiable,
		}
	}
}

func buildCompanyProviderPriceDisplay(entries []providerPriceEntry, unit string) ProviderPriceDisplay {
	details := make([]string, 0, len(entries))
	for _, entry := range entries {
		details = append(details, fmt.Sprintf("%s %s", entry.Label, formatProviderPriceAmount(entry.Amount, unit)))
	}

	display := ProviderPriceDisplay{
		Primary: details[0],
		Details: details,
		Mode:    ProviderPriceDisplayModeStructured,
	}
	if len(details) > 1 {
		display.Secondary = details[1]
	}
	return display
}

func buildStructuredProviderPriceDisplay(providerType int8, entries []providerPriceEntry, unit string) ProviderPriceDisplay {
	details := make([]string, 0, len(entries))
	for _, entry := range entries {
		details = append(details, fmt.Sprintf("%s %s", entry.Label, formatProviderPriceAmount(entry.Amount, unit)))
	}

	primary := formatProviderPriceAmount(entries[0].Amount, unit)
	secondary := ""
	if len(details) > 1 {
		secondary = strings.Join(details[1:], " · ")
	}

	if providerType == 3 {
		details = []string{fmt.Sprintf("施工报价 %s", formatProviderPriceAmount(entries[0].Amount, unit))}
	}

	return ProviderPriceDisplay{
		Primary:   primary,
		Secondary: secondary,
		Details:   details,
		Mode:      ProviderPriceDisplayModeStructured,
	}
}

func parseProviderPriceEntries(providerType int8, pricingJSON string) []providerPriceEntry {
	text := strings.TrimSpace(pricingJSON)
	if !strings.HasPrefix(text, "{") || !strings.HasSuffix(text, "}") {
		return nil
	}

	var raw map[string]float64
	if err := json.Unmarshal([]byte(text), &raw); err != nil {
		return nil
	}

	var orderedKeys []string
	var labels map[string]string
	switch providerType {
	case 2:
		orderedKeys = []string{"fullPackage", "halfPackage"}
		labels = map[string]string{
			"fullPackage": "全包",
			"halfPackage": "半包",
		}
	case 3:
		orderedKeys = []string{"perSqm"}
		labels = map[string]string{
			"perSqm": "施工报价",
		}
	default:
		orderedKeys = []string{"flat", "duplex", "other"}
		labels = map[string]string{
			"flat":   "平层",
			"duplex": "复式",
			"other":  "其他户型",
		}
	}

	entries := make([]providerPriceEntry, 0, len(orderedKeys))
	for _, key := range orderedKeys {
		amount := positiveProviderPriceAmount(raw[key])
		if amount <= 0 {
			continue
		}
		entries = append(entries, providerPriceEntry{
			Label:  labels[key],
			Amount: amount,
		})
	}
	return entries
}

func normalizeProviderPriceDisplayUnit(_ string) string {
	return model.ProviderPriceUnitPerSquareMeter
}

func applyProviderRecommendOrder(db *gorm.DB) *gorm.DB {
	if db == nil {
		return db
	}
	if supportsProviderSettlementVisibility() {
		return db.Order("is_settled DESC").Order("verified DESC").Order("rating DESC").Order("review_count DESC").Order("completed_cnt DESC")
	}
	return db.Order("verified DESC").Order("rating DESC").Order("review_count DESC").Order("completed_cnt DESC")
}

func positiveProviderPriceAmount(value float64) float64 {
	if value <= 0 || math.IsNaN(value) || math.IsInf(value, 0) {
		return 0
	}
	return value
}

func almostEqualProviderPrice(left, right float64) bool {
	return math.Abs(left-right) < 0.001
}

func trimProviderPriceNumber(value float64) string {
	if almostEqualProviderPrice(value, math.Round(value)) {
		return fmt.Sprintf("%.0f", value)
	}
	return strings.TrimRight(strings.TrimRight(fmt.Sprintf("%.2f", value), "0"), ".")
}

func formatProviderPriceAmount(value float64, unit string) string {
	return fmt.Sprintf("%s%s", trimProviderPriceNumber(value), unit)
}
