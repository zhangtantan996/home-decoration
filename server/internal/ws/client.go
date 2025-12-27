package ws

import (
	"encoding/json"
	"log"
	"time"

	"github.com/gorilla/websocket"
)

const (
	// 写入超时时间
	writeWait = 10 * time.Second

	// 读取 pong 的等待时间
	pongWait = 60 * time.Second

	// ping 发送间隔，必须小于 pongWait
	pingPeriod = (pongWait * 9) / 10

	// 消息最大大小
	maxMessageSize = 512 * 1024 // 512KB
)

// Client 表示一个 WebSocket 客户端连接
type Client struct {
	hub    *Hub
	conn   *websocket.Conn
	send   chan []byte
	UserID uint // 关联的用户 ID
}

// NewClient 创建一个新的客户端
func NewClient(hub *Hub, conn *websocket.Conn, userID uint) *Client {
	return &Client{
		hub:    hub,
		conn:   conn,
		send:   make(chan []byte, 256),
		UserID: userID,
	}
}

// ReadPump 从 WebSocket 连接读取消息
func (c *Client) ReadPump(handler MessageHandler) {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()

	c.conn.SetReadLimit(maxMessageSize)
	c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("[WS] 读取错误: user_id=%d, err=%v", c.UserID, err)
			}
			break
		}

		// 解析消息包
		var packet Packet
		if err := json.Unmarshal(message, &packet); err != nil {
			log.Printf("[WS] 解析消息失败: user_id=%d, err=%v", c.UserID, err)
			continue
		}

		// 交给业务层处理
		handler.HandleMessage(c, &packet)
	}
}

// WritePump 向 WebSocket 连接写入消息
func (c *Client) WritePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				// Hub 关闭了通道
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)

			// 如果队列中还有消息，合并发送
			n := len(c.send)
			for i := 0; i < n; i++ {
				w.Write([]byte{'\n'})
				w.Write(<-c.send)
			}

			if err := w.Close(); err != nil {
				return
			}

		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// SendPacket 发送一个协议包给客户端
func (c *Client) SendPacket(packet *Packet) error {
	data, err := json.Marshal(packet)
	if err != nil {
		return err
	}
	c.send <- data
	return nil
}
