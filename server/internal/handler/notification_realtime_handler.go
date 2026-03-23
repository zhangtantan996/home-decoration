package handler

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net"
	"net/netip"
	"strconv"
	"strings"
	"sync"
	"time"

	"home-decoration-server/internal/config"
	"home-decoration-server/internal/realtime"
	"home-decoration-server/internal/repository"
	"home-decoration-server/pkg/response"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/net/websocket"
)

var (
	notificationRealtimeGatewayMu sync.RWMutex
	notificationRealtimeGateway   *realtime.NotificationGateway
)

const (
	realtimeMaxMessageSize       = 64 * 1024
	realtimeMaxEventDataSize     = 10 * 1024
	realtimeMessageRateWindow    = time.Minute
	realtimeMaxMessagesPerWindow = 20
)

type realtimeActor struct {
	UserID    uint64
	UserType  string
	ExpiresAt time.Time
	SessionID string
	TokenJTI  string
}

func InitNotificationRealtime(cfg config.NotificationRealtimeConfig) *realtime.NotificationGateway {
	if !cfg.Enabled {
		notificationRealtimeGatewayMu.Lock()
		notificationRealtimeGateway = nil
		notificationRealtimeGatewayMu.Unlock()
		return nil
	}

	gateway := realtime.NewNotificationGateway(realtime.GatewayConfig{
		MaxConnectionsPerUser: cfg.MaxConnectionsPerUser,
		MaxConnectionsPerIP:   cfg.MaxConnectionsPerIP,
		PingInterval:          time.Duration(cfg.PingIntervalSeconds) * time.Second,
		IdleTimeout:           time.Duration(cfg.IdleTimeoutSeconds) * time.Second,
		SendBufferSize:        cfg.SendBufferSize,
	})

	notificationRealtimeGatewayMu.Lock()
	notificationRealtimeGateway = gateway
	notificationRealtimeGatewayMu.Unlock()
	return gateway
}

func getNotificationRealtimeGateway() *realtime.NotificationGateway {
	notificationRealtimeGatewayMu.RLock()
	defer notificationRealtimeGatewayMu.RUnlock()
	return notificationRealtimeGateway
}

func extractRealtimeToken(c *gin.Context) string {
	if token := strings.TrimSpace(c.Query("token")); token != "" {
		return token
	}

	authHeader := strings.TrimSpace(c.GetHeader("Authorization"))
	parts := strings.SplitN(authHeader, " ", 2)
	if len(parts) == 2 && parts[0] == "Bearer" {
		return strings.TrimSpace(parts[1])
	}
	return ""
}

func claimToUint64(raw interface{}) (uint64, bool) {
	switch value := raw.(type) {
	case float64:
		if value < 0 {
			return 0, false
		}
		return uint64(value), true
	case int:
		if value < 0 {
			return 0, false
		}
		return uint64(value), true
	case int64:
		if value < 0 {
			return 0, false
		}
		return uint64(value), true
	case uint64:
		return value, true
	case json.Number:
		parsed, err := value.Int64()
		if err != nil {
			return 0, false
		}
		return uint64(parsed), true
	default:
		return 0, false
	}
}

func claimToString(raw interface{}) string {
	value, ok := raw.(string)
	if !ok {
		return ""
	}
	return strings.TrimSpace(value)
}

func claimToUnix(raw interface{}) (int64, bool) {
	switch value := raw.(type) {
	case float64:
		return int64(value), true
	case int64:
		return value, true
	case int:
		return int64(value), true
	case json.Number:
		parsed, err := value.Int64()
		if err != nil {
			return 0, false
		}
		return parsed, true
	default:
		return 0, false
	}
}

func buildRealtimeActor(userType string, userID uint64, expiresAt time.Time, sessionID, tokenJTI string) *realtimeActor {
	return &realtimeActor{
		UserID:    userID,
		UserType:  userType,
		ExpiresAt: expiresAt,
		SessionID: sessionID,
		TokenJTI:  tokenJTI,
	}
}

func parseRealtimeUserActor(claims jwt.MapClaims, expiresAt time.Time, allowLegacy bool) (*realtimeActor, error) {
	if _, ok := claimToUint64(claims["admin_id"]); ok {
		return nil, errors.New("token type mismatch")
	}
	if claimToString(claims["role"]) == "merchant" {
		return nil, errors.New("token type mismatch")
	}

	userID, ok := claimToUint64(claims["userId"])
	if !ok || userID == 0 {
		return nil, errors.New("user token missing actor id")
	}

	userType := "user"
	if claimToString(claims["activeRole"]) == "provider" {
		userType = "provider"
	} else if !allowLegacy {
		if explicitUserType := claimToString(claims["userType"]); explicitUserType == "provider" {
			userType = "provider"
		}
	}

	return buildRealtimeActor(userType, userID, expiresAt, claimToString(claims["sid"]), claimToString(claims["jti"])), nil
}

func parseRealtimeActor(tokenString string) (*realtimeActor, error) {
	if tokenString == "" {
		return nil, errors.New("missing token")
	}

	cfg := config.GetConfig()
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("invalid signing method")
		}
		return []byte(cfg.JWT.Secret), nil
	})
	if err != nil || !token.Valid {
		return nil, errors.New("token invalid or expired")
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return nil, errors.New("invalid token claims")
	}

	tokenUse := claimToString(claims["token_use"])
	if tokenUse == "refresh" {
		return nil, errors.New("refresh token not allowed")
	}
	if tokenUse != "" && tokenUse != "access" {
		return nil, fmt.Errorf("invalid token_use: %s", tokenUse)
	}

	expUnix, ok := claimToUnix(claims["exp"])
	if !ok || expUnix <= 0 {
		return nil, errors.New("missing exp claim")
	}
	expiresAt := time.Unix(expUnix, 0)
	if !expiresAt.After(time.Now()) {
		return nil, errors.New("token expired")
	}

	tokenType := claimToString(claims["token_type"])
	switch tokenType {
	case "admin":
		adminID, ok := claimToUint64(claims["admin_id"])
		if !ok || adminID == 0 {
			return nil, errors.New("invalid admin token")
		}
		if _, ok := claimToUint64(claims["userId"]); ok {
			return nil, errors.New("token type mismatch")
		}
		if _, ok := claimToUint64(claims["providerId"]); ok {
			return nil, errors.New("token type mismatch")
		}
		if claimToString(claims["role"]) != "" {
			return nil, errors.New("token type mismatch")
		}
		return buildRealtimeActor("admin", adminID, expiresAt, claimToString(claims["sid"]), claimToString(claims["jti"])), nil
	case "merchant":
		if claimToString(claims["role"]) != "merchant" {
			return nil, errors.New("token type mismatch")
		}
		if _, ok := claimToUint64(claims["admin_id"]); ok {
			return nil, errors.New("token type mismatch")
		}
		userID, ok := claimToUint64(claims["userId"])
		if !ok || userID == 0 {
			return nil, errors.New("merchant token missing actor id")
		}
		if _, hasProvider := claimToUint64(claims["providerId"]); !hasProvider {
			if _, hasMaterialShop := claimToUint64(claims["materialShopId"]); !hasMaterialShop {
				return nil, errors.New("merchant token missing merchant scope")
			}
		}
		return buildRealtimeActor("provider", userID, expiresAt, claimToString(claims["sid"]), claimToString(claims["jti"])), nil
	case "user":
		return parseRealtimeUserActor(claims, expiresAt, false)
	case "":
		return parseRealtimeUserActor(claims, expiresAt, true)
	default:
		return nil, fmt.Errorf("unknown token type: %s", tokenType)
	}
}

func HandleNotificationRealtime(c *gin.Context) {
	gateway := getNotificationRealtimeGateway()
	if gateway == nil {
		response.ServiceUnavailable(c, "通知实时推送未启用")
		return
	}

	actor, err := parseRealtimeActor(extractRealtimeToken(c))
	if err != nil {
		realtime.RecordAuthRejected()
		response.Unauthorized(c, "Token无效或已过期")
		return
	}
	if !isRealtimeSessionActive(actor.SessionID, actor.TokenJTI) {
		realtime.RecordSessionRejected()
		response.Unauthorized(c, "会话已失效，请重新登录")
		return
	}

	clientIP := extractRealtimeClientIP(c)
	cfg := gateway.Config()

	websocket.Handler(func(conn *websocket.Conn) {
		client := realtime.NewClient(realtime.ClientKey{UserType: actor.UserType, UserID: actor.UserID}, conn, clientIP, cfg.SendBufferSize, actor.ExpiresAt, actor.SessionID, actor.TokenJTI)
		if err := gateway.Register(client); err != nil {
			realtime.RecordConnectionRejected()
			log.Printf("[NotificationRealtime] reject connection actor=%s ip=%s err=%v", maskRealtimeActor(actor.UserType, actor.UserID), maskRealtimeIP(clientIP), err)
			_ = websocket.Message.Send(conn, `{"type":"error","data":{"message":"连接数已达上限"}}`)
			client.Close()
			return
		}
		realtime.RecordConnectionAccepted()
		defer gateway.Unregister(client)

		log.Printf("[NotificationRealtime] connected actor=%s ip=%s", maskRealtimeActor(actor.UserType, actor.UserID), maskRealtimeIP(clientIP))
		if unreadCount, err := notificationService.GetUnreadCount(actor.UserID, actor.UserType); err == nil {
			if initPayload, marshalErr := realtime.MarshalEvent(realtime.NewEvent(realtime.EventTypeNotificationInit, realtime.NotificationInitData{
				Connected:           true,
				Count:               unreadCount,
				PingIntervalSeconds: int64(cfg.PingInterval / time.Second),
			})); marshalErr == nil {
				if writeErr := writeRealtimeMessage(client.Conn, initPayload, cfg.IdleTimeout); writeErr == nil {
					realtime.RecordInitMessage()
				}
			}
			if payload, marshalErr := realtime.MarshalEvent(realtime.NewEvent(realtime.EventTypeUnreadCountUpdate, realtime.UnreadCountData{Count: unreadCount})); marshalErr == nil {
				_ = writeRealtimeMessage(client.Conn, payload, cfg.IdleTimeout)
			}
		}
		go writeRealtimeLoop(client, gateway)
		readRealtimeLoop(client, gateway)
		log.Printf("[NotificationRealtime] disconnected actor=%s ip=%s", maskRealtimeActor(actor.UserType, actor.UserID), maskRealtimeIP(clientIP))
	}).ServeHTTP(c.Writer, c.Request)
}

func readRealtimeLoop(client *realtime.Client, gateway *realtime.NotificationGateway) {
	cfg := gateway.Config()
	_ = client.Conn.SetDeadline(time.Now().Add(cfg.IdleTimeout))
	windowStartedAt := time.Now()
	messageCount := 0

	for {
		var raw string
		if err := websocket.Message.Receive(client.Conn, &raw); err != nil {
			return
		}
		realtime.RecordInboundMessage()
		if len(raw) > realtimeMaxMessageSize {
			log.Printf("[NotificationRealtime] close oversize message actor=%s ip=%s bytes=%d", maskRealtimeActor(client.Key.UserType, client.Key.UserID), maskRealtimeIP(client.IP), len(raw))
			gateway.Unregister(client)
			return
		}
		if time.Since(windowStartedAt) >= realtimeMessageRateWindow {
			windowStartedAt = time.Now()
			messageCount = 0
		}
		messageCount++
		if messageCount > realtimeMaxMessagesPerWindow {
			log.Printf("[NotificationRealtime] close rate limited actor=%s ip=%s", maskRealtimeActor(client.Key.UserType, client.Key.UserID), maskRealtimeIP(client.IP))
			gateway.Unregister(client)
			return
		}
		client.Touch()
		_ = client.Conn.SetDeadline(time.Now().Add(cfg.IdleTimeout))

		var event realtime.NotificationEvent
		if err := json.Unmarshal([]byte(raw), &event); err != nil {
			log.Printf("[NotificationRealtime] ignore invalid payload actor=%s ip=%s", maskRealtimeActor(client.Key.UserType, client.Key.UserID), maskRealtimeIP(client.IP))
			continue
		}
		if !isAllowedRealtimeClientEvent(event.Type) {
			log.Printf("[NotificationRealtime] ignore invalid event actor=%s ip=%s type=%s", maskRealtimeActor(client.Key.UserType, client.Key.UserID), maskRealtimeIP(client.IP), event.Type)
			continue
		}
		if !isRealtimeEventDataSizeValid(event.Data) {
			log.Printf("[NotificationRealtime] ignore oversize event data actor=%s ip=%s type=%s", maskRealtimeActor(client.Key.UserType, client.Key.UserID), maskRealtimeIP(client.IP), event.Type)
			continue
		}

		switch event.Type {
		case realtime.EventTypePing:
			payload, err := realtime.MarshalEvent(realtime.NewEvent(realtime.EventTypePong, nil))
			if err != nil {
				continue
			}
			select {
			case client.Send <- payload:
			default:
				gateway.Unregister(client)
				return
			}
		case realtime.EventTypePong:
			continue
		default:
			continue
		}
	}
}

func writeRealtimeLoop(client *realtime.Client, gateway *realtime.NotificationGateway) {
	cfg := gateway.Config()
	ticker := time.NewTicker(cfg.PingInterval)
	defer ticker.Stop()

	for {
		select {
		case payload, ok := <-client.Send:
			if !ok {
				return
			}
			if err := writeRealtimeMessage(client.Conn, payload, cfg.IdleTimeout); err != nil {
				gateway.Unregister(client)
				return
			}
		case <-ticker.C:
			if !client.ExpiresAt.IsZero() && !client.ExpiresAt.After(time.Now()) {
				gateway.Unregister(client)
				return
			}
			if !isRealtimeSessionActive(client.SessionID, client.TokenJTI) {
				gateway.Unregister(client)
				return
			}
			if time.Since(client.LastSeenTime()) > cfg.IdleTimeout {
				gateway.Unregister(client)
				return
			}
			payload, err := realtime.MarshalEvent(realtime.NewEvent(realtime.EventTypePing, nil))
			if err != nil {
				continue
			}
			if err := writeRealtimeMessage(client.Conn, payload, cfg.IdleTimeout); err != nil {
				gateway.Unregister(client)
				return
			}
		}
	}
}

func writeRealtimeMessage(conn *websocket.Conn, payload []byte, timeout time.Duration) error {
	if timeout <= 0 {
		timeout = 15 * time.Second
	}
	_ = conn.SetWriteDeadline(time.Now().Add(timeout))
	if err := websocket.Message.Send(conn, string(payload)); err != nil {
		return err
	}
	realtime.RecordOutboundMessage()
	return nil
}

func isAllowedRealtimeClientEvent(eventType realtime.EventType) bool {
	return eventType == realtime.EventTypePing || eventType == realtime.EventTypePong
}

func isRealtimeEventDataSizeValid(data interface{}) bool {
	if data == nil {
		return true
	}
	encoded, err := json.Marshal(data)
	if err != nil {
		return false
	}
	return len(encoded) <= realtimeMaxEventDataSize
}

func isRealtimeSessionActive(sessionID, tokenJTI string) bool {
	sessionID = strings.TrimSpace(sessionID)
	tokenJTI = strings.TrimSpace(tokenJTI)
	if sessionID == "" || tokenJTI == "" {
		return true
	}

	redisClient := repository.GetRedis()
	if redisClient == nil {
		return true
	}

	ctx, cancel := repository.RedisContext()
	defer cancel()

	exists, err := redisClient.Exists(ctx, fmt.Sprintf("session:%s:%s", sessionID, tokenJTI)).Result()
	if err != nil {
		return true
	}
	return exists > 0
}

func extractRealtimeClientIP(c *gin.Context) string {
	remoteIP := normalizeRealtimeIP(c.Request.RemoteAddr)
	if remoteIP != "" && isPrivateOrLoopbackRealtimeIP(remoteIP) {
		if forwardedIP := normalizeRealtimeIP(c.GetHeader("X-Real-IP")); forwardedIP != "" {
			return forwardedIP
		}
	}
	if remoteIP != "" {
		return remoteIP
	}
	return normalizeRealtimeIP(c.ClientIP())
}

func normalizeRealtimeIP(raw string) string {
	value := strings.TrimSpace(raw)
	if value == "" {
		return ""
	}
	if host, _, err := net.SplitHostPort(value); err == nil {
		value = host
	}
	addr, err := netip.ParseAddr(value)
	if err != nil {
		return ""
	}
	return addr.Unmap().String()
}

func isPrivateOrLoopbackRealtimeIP(raw string) bool {
	addr, err := netip.ParseAddr(raw)
	if err != nil {
		return false
	}
	addr = addr.Unmap()
	return addr.IsPrivate() || addr.IsLoopback()
}

func maskRealtimeActor(userType string, userID uint64) string {
	return fmt.Sprintf("%s:%s", userType, maskRealtimeUint64(userID))
}

func maskRealtimeUint64(value uint64) string {
	raw := strconv.FormatUint(value, 10)
	if len(raw) <= 2 {
		return raw
	}
	return strings.Repeat("*", len(raw)-2) + raw[len(raw)-2:]
}

func maskRealtimeIP(raw string) string {
	addr, err := netip.ParseAddr(strings.TrimSpace(raw))
	if err != nil {
		return ""
	}
	addr = addr.Unmap()
	if addr.Is4() {
		bytes := addr.As4()
		return fmt.Sprintf("%d.%d.%d.x", bytes[0], bytes[1], bytes[2])
	}
	if addr.Is6() {
		normalized := addr.String()
		if len(normalized) <= 8 {
			return normalized
		}
		return normalized[:8] + "::"
	}
	return ""
}

func HandleNotificationRealtimeMetrics(c *gin.Context) {
	c.Header("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
	c.String(200, realtime.RenderPrometheusMetrics(getNotificationRealtimeGateway()))
}
