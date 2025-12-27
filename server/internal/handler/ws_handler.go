package handler

import (
	"log"
	"net/http"

	"home-decoration-server/internal/ws"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	// 允许跨域 (开发阶段)
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

// ServeWS 处理 WebSocket 升级请求
func ServeWS(hub *ws.Hub, handler *ws.Handler) gin.HandlerFunc {
	return func(c *gin.Context) {
		// 从 JWT 中获取用户 ID (中间件已解析)
		userID := uint64(c.GetFloat64("userId"))
		if userID == 0 {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "未认证"})
			return
		}

		conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
		if err != nil {
			log.Printf("[WS] 升级失败: err=%v", err)
			return
		}

		client := ws.NewClient(hub, conn, uint(userID))
		hub.Register(client)

		// 启动读写协程
		go client.WritePump()
		go client.ReadPump(handler)
	}
}
