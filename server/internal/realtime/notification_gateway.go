package realtime

import (
	"errors"
	"fmt"
	"sync"
	"sync/atomic"
	"time"

	"golang.org/x/net/websocket"
)

type ClientKey struct {
	UserType string
	UserID   uint64
}

type GatewayConfig struct {
	MaxConnectionsPerUser int
	MaxConnectionsPerIP   int
	PingInterval          time.Duration
	IdleTimeout           time.Duration
	SendBufferSize        int
}

type GatewayStats struct {
	TotalConnections int `json:"totalConnections"`
	TotalUsers       int `json:"totalUsers"`
	DroppedMessages  int `json:"droppedMessages"`
}

type Client struct {
	Key       ClientKey
	Conn      *websocket.Conn
	IP        string
	Send      chan []byte
	LastSeen  atomic.Int64
	ExpiresAt time.Time
	SessionID string
	TokenJTI  string

	sendMu    sync.Mutex
	isClosed  bool
	closeOnce sync.Once
	dropCount atomic.Int32
}

func NewClient(key ClientKey, conn *websocket.Conn, ip string, sendBufferSize int, expiresAt time.Time, sessionID, tokenJTI string) *Client {
	client := &Client{
		Key:       key,
		Conn:      conn,
		IP:        ip,
		Send:      make(chan []byte, sendBufferSize),
		ExpiresAt: expiresAt,
		SessionID: sessionID,
		TokenJTI:  tokenJTI,
	}
	client.Touch()
	return client
}

func (c *Client) Touch() {
	c.LastSeen.Store(time.Now().Unix())
}

func (c *Client) LastSeenTime() time.Time {
	return time.Unix(c.LastSeen.Load(), 0)
}

func (c *Client) ResetDropCount() {
	c.dropCount.Store(0)
}

func (c *Client) IncrementDropCount() int32 {
	return c.dropCount.Add(1)
}

func (c *Client) Close() {
	c.closeOnce.Do(func() {
		c.sendMu.Lock()
		c.isClosed = true
		close(c.Send)
		c.sendMu.Unlock()
		if c.Conn != nil {
			_ = c.Conn.Close()
		}
	})
}

func (c *Client) TrySend(payload []byte) bool {
	c.sendMu.Lock()
	defer c.sendMu.Unlock()

	if c.isClosed {
		return false
	}

	select {
	case c.Send <- payload:
		return true
	default:
		return false
	}
}

type NotificationGateway struct {
	cfg GatewayConfig

	mu      sync.RWMutex
	clients map[ClientKey]map[*Client]struct{}
	ipCount map[string]int
	stats   gatewayCounters
}

type gatewayCounters struct {
	droppedMessages atomic.Int64
}

func NewNotificationGateway(cfg GatewayConfig) *NotificationGateway {
	if cfg.MaxConnectionsPerUser <= 0 {
		cfg.MaxConnectionsPerUser = 5
	}
	if cfg.MaxConnectionsPerIP <= 0 {
		cfg.MaxConnectionsPerIP = 50
	}
	if cfg.PingInterval <= 0 {
		cfg.PingInterval = 30 * time.Second
	}
	if cfg.IdleTimeout <= 0 {
		cfg.IdleTimeout = 90 * time.Second
	}
	if cfg.SendBufferSize <= 0 {
		cfg.SendBufferSize = 32
	}

	return &NotificationGateway{
		cfg:     cfg,
		clients: make(map[ClientKey]map[*Client]struct{}),
		ipCount: make(map[string]int),
	}
}

func (g *NotificationGateway) Config() GatewayConfig {
	return g.cfg
}

func (g *NotificationGateway) Register(client *Client) error {
	g.mu.Lock()
	defer g.mu.Unlock()

	currentClients := g.clients[client.Key]
	if len(currentClients) >= g.cfg.MaxConnectionsPerUser {
		return fmt.Errorf("user connection limit exceeded: %d", g.cfg.MaxConnectionsPerUser)
	}
	if client.IP != "" && g.ipCount[client.IP] >= g.cfg.MaxConnectionsPerIP {
		return fmt.Errorf("ip connection limit exceeded: %d", g.cfg.MaxConnectionsPerIP)
	}
	if currentClients == nil {
		currentClients = make(map[*Client]struct{})
		g.clients[client.Key] = currentClients
	}
	currentClients[client] = struct{}{}
	if client.IP != "" {
		g.ipCount[client.IP]++
	}
	return nil
}

func (g *NotificationGateway) Unregister(client *Client) {
	g.mu.Lock()
	defer g.mu.Unlock()

	currentClients, ok := g.clients[client.Key]
	if !ok {
		client.Close()
		return
	}
	if _, exists := currentClients[client]; !exists {
		client.Close()
		return
	}
	delete(currentClients, client)
	if len(currentClients) == 0 {
		delete(g.clients, client.Key)
	}
	if client.IP != "" && g.ipCount[client.IP] > 0 {
		g.ipCount[client.IP]--
		if g.ipCount[client.IP] == 0 {
			delete(g.ipCount, client.IP)
		}
	}
	client.Close()
}

func (g *NotificationGateway) SendToUser(userType string, userID uint64, payload []byte) (int, error) {
	if userID == 0 || userType == "" {
		return 0, errors.New("invalid target user")
	}

	key := ClientKey{UserType: userType, UserID: userID}

	g.mu.RLock()
	clientsMap := g.clients[key]
	clients := make([]*Client, 0, len(clientsMap))
	for client := range clientsMap {
		clients = append(clients, client)
	}
	g.mu.RUnlock()

	delivered := 0
	for _, client := range clients {
		if client.TrySend(payload) {
			client.ResetDropCount()
			delivered++
			continue
		}
		g.stats.droppedMessages.Add(1)
		if client.IncrementDropCount() >= 3 {
			g.Unregister(client)
		}
	}

	return delivered, nil
}

func (g *NotificationGateway) GetStats() GatewayStats {
	g.mu.RLock()
	defer g.mu.RUnlock()

	totalConnections := 0
	for _, clients := range g.clients {
		totalConnections += len(clients)
	}

	return GatewayStats{
		TotalConnections: totalConnections,
		TotalUsers:       len(g.clients),
		DroppedMessages:  int(g.stats.droppedMessages.Load()),
	}
}
