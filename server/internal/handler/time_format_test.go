package handler

import (
	"testing"
	"time"
)

func TestFormatServerDateTime_UsesFixedShanghaiLocation(t *testing.T) {
	input := time.Date(2026, 3, 22, 7, 53, 44, 0, time.UTC)

	if got, want := formatServerDateTime(input), "2026/3/22 15:53:44"; got != want {
		t.Fatalf("expected shanghai time, got=%q want=%q", got, want)
	}
}

func TestFormatServerDateTimePtr_NilSafe(t *testing.T) {
	if got := formatServerDateTimePtr(nil); got != "" {
		t.Fatalf("expected empty string for nil time, got=%q", got)
	}
}
