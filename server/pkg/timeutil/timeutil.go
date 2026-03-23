package timeutil

import "time"

const (
	ServerTimeZone       = "Asia/Shanghai"
	ServerDateLayout     = "2006-01-02"
	ServerDateTimeLayout = "2006-01-02 15:04:05"
)

var serverLocation = mustLoadServerLocation()

func mustLoadServerLocation() *time.Location {
	location, err := time.LoadLocation(ServerTimeZone)
	if err == nil {
		return location
	}
	return time.FixedZone(ServerTimeZone, 8*60*60)
}

func Location() *time.Location {
	return serverLocation
}

func Now() time.Time {
	return time.Now().In(serverLocation)
}

func StartOfDay(value time.Time) time.Time {
	if value.IsZero() {
		value = Now()
	}
	localValue := value.In(serverLocation)
	return time.Date(localValue.Year(), localValue.Month(), localValue.Day(), 0, 0, 0, 0, serverLocation)
}

func ParseDate(raw string) (time.Time, error) {
	return time.ParseInLocation(ServerDateLayout, raw, serverLocation)
}

func FormatDate(value time.Time) string {
	if value.IsZero() {
		return ""
	}
	return value.In(serverLocation).Format(ServerDateLayout)
}

func FormatDateTime(value time.Time) string {
	if value.IsZero() {
		return ""
	}
	return value.In(serverLocation).Format(ServerDateTimeLayout)
}
