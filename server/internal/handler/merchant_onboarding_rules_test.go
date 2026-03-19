package handler

import "testing"

func TestBusinessHoursRanges_AllowSundayAndNormalizeSummary(t *testing.T) {
	ranges := []BusinessHoursRangeInput{
		{Day: 7, Start: "10:00", End: "18:00"},
		{Day: 1, Start: "09:00", End: "17:00"},
		{Day: 7, Start: "10:00", End: "18:00"},
	}

	if err := validateBusinessHoursRanges(ranges); err != nil {
		t.Fatalf("expected sunday business hours to be valid, got %v", err)
	}

	summary := summarizeBusinessHoursRanges(ranges)
	if summary != "周一 09:00-17:00；周日 10:00-18:00" {
		t.Fatalf("unexpected summary: %s", summary)
	}
}
