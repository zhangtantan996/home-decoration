package realtime

import (
	"strings"
	"testing"
	"time"
)

func TestRenderPrometheusMetricsIncludesRealtimeStats(t *testing.T) {
	gateway := NewNotificationGateway(GatewayConfig{
		MaxConnectionsPerUser: 2,
		MaxConnectionsPerIP:   2,
		SendBufferSize:        2,
	})
	client := NewClient(ClientKey{UserType: "user", UserID: 99}, nil, "127.0.0.1", 2, time.Now().Add(time.Minute), "sid-metric", "jti-metric")
	if err := gateway.Register(client); err != nil {
		t.Fatalf("register client: %v", err)
	}

	body := RenderPrometheusMetrics(gateway)
	if !strings.Contains(body, "home_decoration_notification_realtime_enabled 1") {
		t.Fatalf("expected enabled gauge in metrics body, got: %s", body)
	}
	if !strings.Contains(body, "home_decoration_notification_realtime_connections 1") {
		t.Fatalf("expected connections gauge in metrics body, got: %s", body)
	}
	if !strings.Contains(body, "home_decoration_notification_realtime_users 1") {
		t.Fatalf("expected users gauge in metrics body, got: %s", body)
	}
	if !strings.Contains(body, "home_decoration_notification_realtime_messages_outbound_total") {
		t.Fatalf("expected outbound counter in metrics body, got: %s", body)
	}
}
