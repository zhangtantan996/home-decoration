package timeutil

import (
	"testing"
	"time"
)

func TestStartOfDay_UsesShanghaiBoundary(t *testing.T) {
	input := time.Date(2026, 3, 22, 1, 2, 3, 0, time.UTC)

	got := StartOfDay(input)

	if got.Location().String() != Location().String() {
		t.Fatalf("expected server location %q, got %q", Location(), got.Location())
	}
	if got.Format(time.RFC3339) != "2026-03-22T00:00:00+08:00" {
		t.Fatalf("unexpected start of day: %s", got.Format(time.RFC3339))
	}
}

func TestParseDate_UsesShanghaiLocation(t *testing.T) {
	got, err := ParseDate("2026-03-22")
	if err != nil {
		t.Fatalf("parse date failed: %v", err)
	}
	if got.Format(time.RFC3339) != "2026-03-22T00:00:00+08:00" {
		t.Fatalf("unexpected parsed date: %s", got.Format(time.RFC3339))
	}
}
