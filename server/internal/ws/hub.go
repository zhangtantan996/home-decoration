package ws

import (
	"log"
	"sync"
)

// Hub 负责管理所有活跃的 WebSocket 连接
type Hub struct {
	// 所有已注册的客户端连接，key 为用户 ID
	clients map[uint]*Client

	// 注册新客户端的通道
	register chan *Client

	// 注销客户端的通道
	unregister chan *Client

	// 广播消息的通道 (用于发送给指定用户)
	broadcast chan *Message

	// 保护 clients map 的互斥锁
	mu sync.RWMutex
}

// Message 表示一条待发送的消息
type Message struct {
	ReceiverID uint   // 接收者用户 ID
	Data       []byte // JSON 编码的消息数据
}

// NewHub 创建一个新的 Hub 实例
func NewHub() *Hub {
	return &Hub{
		clients:    make(map[uint]*Client),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		broadcast:  make(chan *Message, 256), // 带缓冲的通道防止阻塞
	}
}

// Run 启动 Hub 的主循环，处理注册、注销和消息广播
func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			// 如果用户已经有连接，先关闭旧连接 (单端互踢)
			if oldClient, ok := h.clients[client.UserID]; ok {
				close(oldClient.send)
				delete(h.clients, client.UserID)
				log.Printf("[WS] 踢出旧连接: user_id=%d", client.UserID)
			}
			h.clients[client.UserID] = client
			h.mu.Unlock()
			log.Printf("[WS] 用户上线: user_id=%d, total_clients=%d", client.UserID, len(h.clients))

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client.UserID]; ok {
				delete(h.clients, client.UserID)
				close(client.send)
				log.Printf("[WS] 用户下线: user_id=%d, total_clients=%d", client.UserID, len(h.clients))
			}
			h.mu.Unlock()

		case message := <-h.broadcast:
			h.mu.RLock()
			if client, ok := h.clients[message.ReceiverID]; ok {
				select {
				case client.send <- message.Data:
					// 消息发送成功
				default:
					// 发送缓冲区已满，关闭连接
					close(client.send)
					delete(h.clients, message.ReceiverID)
					log.Printf("[WS] 发送缓冲区满, 关闭连接: user_id=%d", message.ReceiverID)
				}
			} else {
				// 用户不在线，消息需要存储供离线拉取
				log.Printf("[WS] 用户离线, 消息暂存: receiver_id=%d", message.ReceiverID)
			}
			h.mu.RUnlock()
		}
	}
}

// SendToUser 向指定用户发送消息
func (h *Hub) SendToUser(userID uint, data []byte) {
	h.broadcast <- &Message{
		ReceiverID: userID,
		Data:       data,
	}
}

// IsOnline 检查用户是否在线
func (h *Hub) IsOnline(userID uint) bool {
	h.mu.RLock()
	defer h.mu.RUnlock()
	_, ok := h.clients[userID]
	return ok
}

// GetOnlineCount 获取在线用户数量
func (h *Hub) GetOnlineCount() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.clients)
}

// Register 注册新客户端
func (h *Hub) Register(client *Client) {
	h.register <- client
}
