package realtime

import (
	"testing"
	"time"
)

func TestNotificationGatewayRegisterSendAndUnregister(t *testing.T) {
	gateway := NewNotificationGateway(GatewayConfig{
		MaxConnectionsPerUser: 2,
		MaxConnectionsPerIP:   2,
		SendBufferSize:        4,
	})
	client := NewClient(ClientKey{UserType: "user", UserID: 7}, nil, "127.0.0.1", 4, time.Now().Add(time.Minute), "sid-1", "jti-1")

	if err := gateway.Register(client); err != nil {
		t.Fatalf("register client: %v", err)
	}

	payload := []byte(`{"type":"notification.new"}`)
	sent, err := gateway.SendToUser("user", 7, payload)
	if err != nil {
		t.Fatalf("send to user: %v", err)
	}
	if sent != 1 {
		t.Fatalf("expected 1 client, got %d", sent)
	}

	select {
	case got := <-client.Send:
		if string(got) != string(payload) {
			t.Fatalf("unexpected payload: %s", string(got))
		}
	default:
		t.Fatal("expected payload in client channel")
	}

	gateway.Unregister(client)
	stats := gateway.GetStats()
	if stats.TotalConnections != 0 || stats.TotalUsers != 0 {
		t.Fatalf("unexpected stats after unregister: %+v", stats)
	}
}

func TestNotificationGatewayLimits(t *testing.T) {
	gateway := NewNotificationGateway(GatewayConfig{
		MaxConnectionsPerUser: 1,
		MaxConnectionsPerIP:   1,
		SendBufferSize:        2,
	})

	first := NewClient(ClientKey{UserType: "admin", UserID: 1}, nil, "127.0.0.1", 2, time.Now().Add(time.Minute), "sid-0", "jti-0")
	if err := gateway.Register(first); err != nil {
		t.Fatalf("register first client: %v", err)
	}

	secondSameUser := NewClient(ClientKey{UserType: "admin", UserID: 1}, nil, "127.0.0.2", 2, time.Now().Add(time.Minute), "sid-2", "jti-2")
	if err := gateway.Register(secondSameUser); err == nil {
		t.Fatal("expected user connection limit error")
	}

	secondSameIP := NewClient(ClientKey{UserType: "admin", UserID: 2}, nil, "127.0.0.1", 2, time.Now().Add(time.Minute), "sid-3", "jti-3")
	if err := gateway.Register(secondSameIP); err == nil {
		t.Fatal("expected ip connection limit error")
	}
}

func TestNotificationGatewayBackpressureRequiresRepeatedDrops(t *testing.T) {
	gateway := NewNotificationGateway(GatewayConfig{
		MaxConnectionsPerUser: 1,
		MaxConnectionsPerIP:   5,
		SendBufferSize:        1,
	})

	client := NewClient(ClientKey{UserType: "user", UserID: 8}, nil, "127.0.0.1", 1, time.Now().Add(time.Minute), "sid-4", "jti-4")
	if err := gateway.Register(client); err != nil {
		t.Fatalf("register client: %v", err)
	}

	if ok := client.TrySend([]byte("first")); !ok {
		t.Fatal("expected initial buffered send")
	}

	for i := 0; i < 2; i++ {
		sent, err := gateway.SendToUser("user", 8, []byte("overflow"))
		if err != nil {
			t.Fatalf("send overflow payload: %v", err)
		}
		if sent != 0 {
			t.Fatalf("expected zero delivered messages on overflow, got %d", sent)
		}
	}

	stats := gateway.GetStats()
	if stats.TotalConnections != 1 {
		t.Fatalf("expected client to remain connected after transient backpressure, got %+v", stats)
	}

	if _, err := gateway.SendToUser("user", 8, []byte("overflow-3")); err != nil {
		t.Fatalf("third overflow send: %v", err)
	}

	stats = gateway.GetStats()
	if stats.TotalConnections != 0 {
		t.Fatalf("expected client to be disconnected after repeated backpressure, got %+v", stats)
	}
	if stats.DroppedMessages < 3 {
		t.Fatalf("expected dropped message stats to increase, got %+v", stats)
	}
}
