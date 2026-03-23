package realtime

import (
	"fmt"
	"strings"
	"sync/atomic"
)

type MetricsSnapshot struct {
	AcceptedConnections int64
	RejectedConnections int64
	AuthRejected        int64
	SessionRejected     int64
	InboundMessages     int64
	OutboundMessages    int64
	InitMessages        int64
}

var notificationMetrics struct {
	acceptedConnections atomic.Int64
	rejectedConnections atomic.Int64
	authRejected        atomic.Int64
	sessionRejected     atomic.Int64
	inboundMessages     atomic.Int64
	outboundMessages    atomic.Int64
	initMessages        atomic.Int64
}

func RecordConnectionAccepted() {
	notificationMetrics.acceptedConnections.Add(1)
}

func RecordConnectionRejected() {
	notificationMetrics.rejectedConnections.Add(1)
}

func RecordAuthRejected() {
	notificationMetrics.authRejected.Add(1)
}

func RecordSessionRejected() {
	notificationMetrics.sessionRejected.Add(1)
}

func RecordInboundMessage() {
	notificationMetrics.inboundMessages.Add(1)
}

func RecordOutboundMessage() {
	notificationMetrics.outboundMessages.Add(1)
}

func RecordInitMessage() {
	notificationMetrics.initMessages.Add(1)
}

func SnapshotMetrics() MetricsSnapshot {
	return MetricsSnapshot{
		AcceptedConnections: notificationMetrics.acceptedConnections.Load(),
		RejectedConnections: notificationMetrics.rejectedConnections.Load(),
		AuthRejected:        notificationMetrics.authRejected.Load(),
		SessionRejected:     notificationMetrics.sessionRejected.Load(),
		InboundMessages:     notificationMetrics.inboundMessages.Load(),
		OutboundMessages:    notificationMetrics.outboundMessages.Load(),
		InitMessages:        notificationMetrics.initMessages.Load(),
	}
}

func RenderPrometheusMetrics(gateway *NotificationGateway) string {
	stats := GatewayStats{}
	enabled := 0
	if gateway != nil {
		enabled = 1
		stats = gateway.GetStats()
	}

	snapshot := SnapshotMetrics()
	var builder strings.Builder

	writeMetricHeader(&builder, "home_decoration_notification_realtime_enabled", "gauge", "Whether notification realtime gateway is enabled.")
	writeMetricValue(&builder, "home_decoration_notification_realtime_enabled", enabled)

	writeMetricHeader(&builder, "home_decoration_notification_realtime_connections", "gauge", "Current active notification realtime connections.")
	writeMetricValue(&builder, "home_decoration_notification_realtime_connections", stats.TotalConnections)

	writeMetricHeader(&builder, "home_decoration_notification_realtime_users", "gauge", "Current active notification realtime users.")
	writeMetricValue(&builder, "home_decoration_notification_realtime_users", stats.TotalUsers)

	writeMetricHeader(&builder, "home_decoration_notification_realtime_dropped_messages_total", "counter", "Total dropped notification realtime messages.")
	writeMetricValue(&builder, "home_decoration_notification_realtime_dropped_messages_total", stats.DroppedMessages)

	writeMetricHeader(&builder, "home_decoration_notification_realtime_connections_accepted_total", "counter", "Total accepted notification realtime connections.")
	writeMetricValue(&builder, "home_decoration_notification_realtime_connections_accepted_total", snapshot.AcceptedConnections)

	writeMetricHeader(&builder, "home_decoration_notification_realtime_connections_rejected_total", "counter", "Total rejected notification realtime connections.")
	writeMetricValue(&builder, "home_decoration_notification_realtime_connections_rejected_total", snapshot.RejectedConnections)

	writeMetricHeader(&builder, "home_decoration_notification_realtime_auth_rejected_total", "counter", "Total notification realtime authentication rejections.")
	writeMetricValue(&builder, "home_decoration_notification_realtime_auth_rejected_total", snapshot.AuthRejected)

	writeMetricHeader(&builder, "home_decoration_notification_realtime_session_rejected_total", "counter", "Total notification realtime session rejections.")
	writeMetricValue(&builder, "home_decoration_notification_realtime_session_rejected_total", snapshot.SessionRejected)

	writeMetricHeader(&builder, "home_decoration_notification_realtime_messages_inbound_total", "counter", "Total inbound notification realtime messages.")
	writeMetricValue(&builder, "home_decoration_notification_realtime_messages_inbound_total", snapshot.InboundMessages)

	writeMetricHeader(&builder, "home_decoration_notification_realtime_messages_outbound_total", "counter", "Total outbound notification realtime messages.")
	writeMetricValue(&builder, "home_decoration_notification_realtime_messages_outbound_total", snapshot.OutboundMessages)

	writeMetricHeader(&builder, "home_decoration_notification_realtime_init_messages_total", "counter", "Total notification realtime init messages.")
	writeMetricValue(&builder, "home_decoration_notification_realtime_init_messages_total", snapshot.InitMessages)

	return builder.String()
}

func writeMetricHeader(builder *strings.Builder, name, metricType, help string) {
	builder.WriteString(fmt.Sprintf("# HELP %s %s\n", name, help))
	builder.WriteString(fmt.Sprintf("# TYPE %s %s\n", name, metricType))
}

func writeMetricValue(builder *strings.Builder, name string, value interface{}) {
	builder.WriteString(fmt.Sprintf("%s %v\n", name, value))
}
