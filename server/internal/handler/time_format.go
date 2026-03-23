package handler

import (
	"time"

	"home-decoration-server/pkg/timeutil"
)

const serverDateTimeLayout = "2006/1/2 15:04:05"

func formatServerDateTime(value time.Time) string {
	if value.IsZero() {
		return ""
	}
	return value.In(timeutil.Location()).Format(serverDateTimeLayout)
}

func formatServerDateTimePtr(value *time.Time) string {
	if value == nil {
		return ""
	}
	return formatServerDateTime(*value)
}
