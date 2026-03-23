package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"home-decoration-server/internal/config"
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/realtime"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/net/websocket"
)

func buildRealtimeSignedToken(t *testing.T, claims jwt.MapClaims) string {
	t.Helper()
	cfg := config.GetConfig()
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString([]byte(cfg.JWT.Secret))
	if err != nil {
		t.Fatalf("sign realtime token: %v", err)
	}
	return signed
}

func TestParseRealtimeActorAdminStrict(t *testing.T) {
	token := buildRealtimeSignedToken(t, jwt.MapClaims{
		"admin_id":   float64(9),
		"token_type": "admin",
		"exp":        time.Now().Add(time.Hour).Unix(),
	})

	actor, err := parseRealtimeActor(token)
	if err != nil {
		t.Fatalf("parse admin actor: %v", err)
	}
	if actor.UserType != "admin" || actor.UserID != 9 {
		t.Fatalf("unexpected actor: %+v", actor)
	}
}

func TestParseRealtimeActorRejectsMixedAdminClaims(t *testing.T) {
	token := buildRealtimeSignedToken(t, jwt.MapClaims{
		"admin_id":   float64(9),
		"userId":     float64(1),
		"token_type": "admin",
		"exp":        time.Now().Add(time.Hour).Unix(),
	})

	if _, err := parseRealtimeActor(token); err == nil {
		t.Fatal("expected mixed admin claims to be rejected")
	}
}

func TestParseRealtimeActorRejectsRefreshToken(t *testing.T) {
	token := buildRealtimeSignedToken(t, jwt.MapClaims{
		"userId":     float64(11),
		"token_type": "user",
		"token_use":  "refresh",
		"exp":        time.Now().Add(time.Hour).Unix(),
	})

	if _, err := parseRealtimeActor(token); err == nil {
		t.Fatal("expected refresh token to be rejected")
	}
}

func TestParseRealtimeActorRejectsExpiredToken(t *testing.T) {
	token := buildRealtimeSignedToken(t, jwt.MapClaims{
		"userId":     float64(12),
		"token_type": "user",
		"token_use":  "access",
		"exp":        time.Now().Add(-time.Minute).Unix(),
	})

	if _, err := parseRealtimeActor(token); err == nil {
		t.Fatal("expected expired token to be rejected")
	}
}

func TestParseRealtimeActorSupportsLegacyUserToken(t *testing.T) {
	token := buildRealtimeSignedToken(t, jwt.MapClaims{
		"userId":   float64(21),
		"userType": float64(1),
		"exp":      time.Now().Add(time.Hour).Unix(),
	})

	actor, err := parseRealtimeActor(token)
	if err != nil {
		t.Fatalf("parse legacy user token: %v", err)
	}
	if actor.UserType != "user" || actor.UserID != 21 {
		t.Fatalf("unexpected actor: %+v", actor)
	}
}

func TestParseRealtimeActorMapsProviderRoleFromUserToken(t *testing.T) {
	token := buildRealtimeSignedToken(t, jwt.MapClaims{
		"userId":     float64(31),
		"providerId": float64(7),
		"activeRole": "provider",
		"token_type": "user",
		"token_use":  "access",
		"exp":        time.Now().Add(time.Hour).Unix(),
	})

	actor, err := parseRealtimeActor(token)
	if err != nil {
		t.Fatalf("parse provider user token: %v", err)
	}
	if actor.UserType != "provider" || actor.UserID != 31 {
		t.Fatalf("unexpected actor: %+v", actor)
	}
}

func TestParseRealtimeActorRejectsMerchantWithoutScope(t *testing.T) {
	token := buildRealtimeSignedToken(t, jwt.MapClaims{
		"userId":     float64(41),
		"token_type": "merchant",
		"token_use":  "access",
		"role":       "merchant",
		"exp":        time.Now().Add(time.Hour).Unix(),
	})

	if _, err := parseRealtimeActor(token); err == nil {
		t.Fatal("expected merchant token without scope to be rejected")
	}
}

type realtimeTestEvent struct {
	Type      realtime.EventType `json:"type"`
	Timestamp int64              `json:"timestamp"`
	Data      json.RawMessage    `json:"data"`
}

func setupNotificationRealtimeTestServer(t *testing.T, cfg config.NotificationRealtimeConfig) (*httptest.Server, *realtime.NotificationGateway) {
	t.Helper()
	gin.SetMode(gin.TestMode)

	gateway := InitNotificationRealtime(cfg)
	t.Cleanup(func() {
		InitNotificationRealtime(config.NotificationRealtimeConfig{Enabled: false})
	})

	router := gin.New()
	v1 := router.Group("/api/v1")
	v1.GET("/realtime/notifications", HandleNotificationRealtime)
	v1.GET("/metrics", HandleNotificationRealtimeMetrics)

	server := httptest.NewServer(router)
	t.Cleanup(server.Close)
	return server, gateway
}

func dialNotificationRealtimeTestConn(t *testing.T, serverURL, token string) *websocket.Conn {
	t.Helper()
	wsURL := "ws" + strings.TrimPrefix(serverURL, "http") + "/api/v1/realtime/notifications?token=" + url.QueryEscape(token)
	conn, err := websocket.Dial(wsURL, "", serverURL)
	if err != nil {
		t.Fatalf("dial realtime websocket: %v", err)
	}
	t.Cleanup(func() { _ = conn.Close() })
	return conn
}

func readNotificationRealtimeTestEvent(t *testing.T, conn *websocket.Conn, timeout time.Duration) realtimeTestEvent {
	t.Helper()
	if timeout <= 0 {
		timeout = 2 * time.Second
	}
	_ = conn.SetDeadline(time.Now().Add(timeout))

	var raw string
	if err := websocket.Message.Receive(conn, &raw); err != nil {
		t.Fatalf("receive realtime event: %v", err)
	}

	var event realtimeTestEvent
	if err := json.Unmarshal([]byte(raw), &event); err != nil {
		t.Fatalf("unmarshal realtime event: %v raw=%s", err, raw)
	}
	return event
}

func TestHandleNotificationRealtimeSendsInitUnreadCountAndPong(t *testing.T) {
	db := setupNotificationHandlerTestDB(t)
	if err := db.Create(&model.Notification{
		Base:     model.Base{ID: 101},
		UserID:   21,
		UserType: "user",
		Title:    "待处理通知",
		Content:  "请及时查看",
		Type:     model.NotificationTypeProposalSubmitted,
		IsRead:   false,
	}).Error; err != nil {
		t.Fatalf("seed notification: %v", err)
	}

	server, _ := setupNotificationRealtimeTestServer(t, config.NotificationRealtimeConfig{
		Enabled:               true,
		MaxConnectionsPerUser: 5,
		MaxConnectionsPerIP:   20,
		PingIntervalSeconds:   30,
		IdleTimeoutSeconds:    10,
		SendBufferSize:        8,
	})

	token := buildRealtimeSignedToken(t, jwt.MapClaims{
		"userId":     float64(21),
		"token_type": "user",
		"token_use":  "access",
		"exp":        time.Now().Add(time.Hour).Unix(),
	})

	conn := dialNotificationRealtimeTestConn(t, server.URL, token)

	initEvent := readNotificationRealtimeTestEvent(t, conn, 2*time.Second)
	if initEvent.Type != realtime.EventTypeNotificationInit {
		t.Fatalf("expected init event, got %s", initEvent.Type)
	}

	var initData realtime.NotificationInitData
	if err := json.Unmarshal(initEvent.Data, &initData); err != nil {
		t.Fatalf("unmarshal init data: %v", err)
	}
	if !initData.Connected || initData.Count != 1 || initData.PingIntervalSeconds != 30 {
		t.Fatalf("unexpected init payload: %+v", initData)
	}

	unreadEvent := readNotificationRealtimeTestEvent(t, conn, 2*time.Second)
	if unreadEvent.Type != realtime.EventTypeUnreadCountUpdate {
		t.Fatalf("expected unread_count event, got %s", unreadEvent.Type)
	}

	var unreadData realtime.UnreadCountData
	if err := json.Unmarshal(unreadEvent.Data, &unreadData); err != nil {
		t.Fatalf("unmarshal unread data: %v", err)
	}
	if unreadData.Count != 1 {
		t.Fatalf("expected unread count 1, got %d", unreadData.Count)
	}

	if err := websocket.Message.Send(conn, `{"type":"ping","timestamp":1}`); err != nil {
		t.Fatalf("send ping: %v", err)
	}

	pongEvent := readNotificationRealtimeTestEvent(t, conn, 2*time.Second)
	if pongEvent.Type != realtime.EventTypePong {
		t.Fatalf("expected pong event, got %s", pongEvent.Type)
	}
}

func TestHandleNotificationRealtimeDeliversNotificationEvent(t *testing.T) {
	setupNotificationHandlerTestDB(t)

	server, gateway := setupNotificationRealtimeTestServer(t, config.NotificationRealtimeConfig{
		Enabled:               true,
		MaxConnectionsPerUser: 5,
		MaxConnectionsPerIP:   20,
		PingIntervalSeconds:   30,
		IdleTimeoutSeconds:    10,
		SendBufferSize:        8,
	})
	if gateway == nil {
		t.Fatal("expected realtime gateway")
	}

	token := buildRealtimeSignedToken(t, jwt.MapClaims{
		"userId":     float64(52),
		"token_type": "user",
		"token_use":  "access",
		"exp":        time.Now().Add(time.Hour).Unix(),
	})

	conn := dialNotificationRealtimeTestConn(t, server.URL, token)
	_ = readNotificationRealtimeTestEvent(t, conn, 2*time.Second)
	_ = readNotificationRealtimeTestEvent(t, conn, 2*time.Second)

	payload, err := realtime.MarshalEvent(realtime.NewEvent(realtime.EventTypeNotificationNew, realtime.NotificationIDData{NotificationID: 777}))
	if err != nil {
		t.Fatalf("marshal new notification event: %v", err)
	}

	delivered, err := gateway.SendToUser("user", 52, payload)
	if err != nil {
		t.Fatalf("send to user: %v", err)
	}
	if delivered != 1 {
		t.Fatalf("expected 1 delivered connection, got %d", delivered)
	}

	event := readNotificationRealtimeTestEvent(t, conn, 2*time.Second)
	if event.Type != realtime.EventTypeNotificationNew {
		t.Fatalf("expected notification.new event, got %s", event.Type)
	}

	var data realtime.NotificationIDData
	if err := json.Unmarshal(event.Data, &data); err != nil {
		t.Fatalf("unmarshal notification.new data: %v", err)
	}
	if data.NotificationID != 777 {
		t.Fatalf("expected notification id 777, got %d", data.NotificationID)
	}
}

func TestHandleNotificationRealtimeMetricsEndpoint(t *testing.T) {
	_, gateway := setupNotificationRealtimeTestServer(t, config.NotificationRealtimeConfig{
		Enabled:               true,
		MaxConnectionsPerUser: 5,
		MaxConnectionsPerIP:   20,
		PingIntervalSeconds:   30,
		IdleTimeoutSeconds:    10,
		SendBufferSize:        8,
	})
	if gateway == nil {
		t.Fatal("expected realtime gateway")
	}

	client := realtime.NewClient(
		realtime.ClientKey{UserType: "user", UserID: 88},
		nil,
		"127.0.0.1",
		8,
		time.Now().Add(time.Minute),
		"",
		"",
	)
	if err := gateway.Register(client); err != nil {
		t.Fatalf("register client: %v", err)
	}
	t.Cleanup(func() {
		gateway.Unregister(client)
	})

	req := httptest.NewRequest(http.MethodGet, "/api/v1/metrics", nil)
	w := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(w)
	ctx.Request = req

	HandleNotificationRealtimeMetrics(ctx)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", w.Code, w.Body.String())
	}
	contentType := w.Header().Get("Content-Type")
	if !strings.Contains(contentType, "text/plain") {
		t.Fatalf("expected text/plain metrics content-type, got %s", contentType)
	}
	body := w.Body.String()
	if !strings.Contains(body, "home_decoration_notification_realtime_enabled 1") {
		t.Fatalf("expected enabled metric in body, got %s", body)
	}
	if !strings.Contains(body, "home_decoration_notification_realtime_connections 1") {
		t.Fatalf("expected connections metric in body, got %s", body)
	}
}
