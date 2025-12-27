package ws

import (
	"encoding/json"
	"fmt"
	"log"
	"time"

	"home-decoration-server/internal/model"

	"gorm.io/gorm"
)

// Handler 消息处理器
type Handler struct {
	db  *gorm.DB
	hub *Hub
}

// NewHandler 创建一个消息处理器
func NewHandler(db *gorm.DB, hub *Hub) *Handler {
	return &Handler{
		db:  db,
		hub: hub,
	}
}

// HandleMessage 处理收到的消息包
func (h *Handler) HandleMessage(client *Client, packet *Packet) {
	switch packet.Type {
	case PacketTypePing:
		// 心跳响应
		client.SendPacket(&Packet{
			Type: PacketTypePong,
			Seq:  packet.Seq,
		})

	case PacketTypeMessageSend:
		h.handleMessageSend(client, packet)

	case PacketTypeAckRead:
		h.handleAckRead(client, packet)

	default:
		log.Printf("[WS] 未知消息类型: type=%d, user_id=%d", packet.Type, client.UserID)
	}
}

// handleMessageSend 处理发送消息请求
func (h *Handler) handleMessageSend(client *Client, packet *Packet) {
	var payload MessagePayload
	if err := json.Unmarshal(packet.Payload, &payload); err != nil {
		h.sendError(client, packet.Seq, 1001, "消息格式错误")
		return
	}

	// 验证
	if payload.ReceiverID == 0 || payload.Content == "" {
		h.sendError(client, packet.Seq, 1002, "参数不完整")
		return
	}

	// 生成会话 ID
	conversationID := model.GetConversationID(uint64(client.UserID), uint64(payload.ReceiverID))

	// 创建消息
	msg := model.ChatMessage{
		ConversationID: conversationID,
		SenderID:       uint64(client.UserID),
		ReceiverID:     uint64(payload.ReceiverID),
		Content:        payload.Content,
		MsgType:        payload.MsgType,
		CreatedAt:      time.Now(),
	}
	if msg.MsgType == 0 {
		msg.MsgType = 1 // 默认文本
	}

	// 入库
	if err := h.db.Create(&msg).Error; err != nil {
		log.Printf("[WS] 消息入库失败: err=%v", err)
		h.sendError(client, packet.Seq, 1003, "消息发送失败")
		return
	}

	// 更新会话
	h.updateConversation(conversationID, uint64(client.UserID), uint64(payload.ReceiverID), payload.Content)

	// 发送 ACK 给发送者
	ackPayload, _ := json.Marshal(AckSendPayload{
		Seq:       packet.Seq,
		MessageID: msg.ID,
	})
	client.SendPacket(&Packet{
		Type:    PacketTypeAckSend,
		Seq:     packet.Seq,
		Payload: ackPayload,
	})

	// 获取发送者信息
	var sender model.User
	h.db.First(&sender, client.UserID)

	// 推送给接收者
	pushPayload, _ := json.Marshal(PushPayload{
		MessageID:      msg.ID,
		ConversationID: conversationID,
		SenderID:       uint(client.UserID),
		SenderName:     sender.Nickname,
		SenderAvatar:   sender.Avatar,
		Content:        payload.Content,
		MsgType:        msg.MsgType,
		CreatedAt:      msg.CreatedAt.Format("2006-01-02 15:04:05"),
	})
	pushPacket := &Packet{
		Type:    PacketTypeMessagePush,
		Seq:     fmt.Sprintf("%d", msg.ID),
		Payload: pushPayload,
	}
	pushData, _ := json.Marshal(pushPacket)
	h.hub.SendToUser(uint(payload.ReceiverID), pushData)

	log.Printf("[WS] 消息发送成功: from=%d, to=%d, msg_id=%d", client.UserID, payload.ReceiverID, msg.ID)
}

// handleAckRead 处理已读回执
func (h *Handler) handleAckRead(client *Client, packet *Packet) {
	var payload AckReadPayload
	if err := json.Unmarshal(packet.Payload, &payload); err != nil {
		return
	}

	// 更新消息为已读
	h.db.Model(&model.ChatMessage{}).
		Where("conversation_id = ? AND receiver_id = ? AND id <= ? AND is_read = ?",
			payload.ConversationID, client.UserID, payload.LastReadMsgID, false).
		Update("is_read", true)

	// 清空未读数
	h.clearUnread(payload.ConversationID, uint64(client.UserID))
}

// updateConversation 更新或创建会话
func (h *Handler) updateConversation(conversationID string, senderID, receiverID uint64, content string) {
	var conv model.Conversation
	result := h.db.First(&conv, "id = ?", conversationID)

	if result.Error == gorm.ErrRecordNotFound {
		// 创建新会话
		conv = model.Conversation{
			ID:                 conversationID,
			User1ID:            min(senderID, receiverID),
			User2ID:            max(senderID, receiverID),
			LastMessageContent: truncateString(content, 100),
			LastMessageTime:    time.Now(),
		}
		if conv.User1ID == senderID {
			conv.User2Unread = 1
		} else {
			conv.User1Unread = 1
		}
		h.db.Create(&conv)
	} else {
		// 更新会话
		updates := map[string]interface{}{
			"last_message_content": truncateString(content, 100),
			"last_message_time":    time.Now(),
		}
		if conv.User1ID == senderID {
			updates["user2_unread"] = gorm.Expr("user2_unread + 1")
		} else {
			updates["user1_unread"] = gorm.Expr("user1_unread + 1")
		}
		h.db.Model(&conv).Updates(updates)
	}
}

// clearUnread 清空未读数
func (h *Handler) clearUnread(conversationID string, userID uint64) {
	var conv model.Conversation
	if err := h.db.First(&conv, "id = ?", conversationID).Error; err != nil {
		return
	}
	if conv.User1ID == userID {
		h.db.Model(&conv).Update("user1_unread", 0)
	} else {
		h.db.Model(&conv).Update("user2_unread", 0)
	}
}

// sendError 发送错误消息
func (h *Handler) sendError(client *Client, seq string, code int, message string) {
	payload, _ := json.Marshal(ErrorPayload{
		Code:    code,
		Message: message,
	})
	client.SendPacket(&Packet{
		Type:    PacketTypeError,
		Seq:     seq,
		Payload: payload,
	})
}

// truncateString 截断字符串
func truncateString(s string, maxLen int) string {
	runes := []rune(s)
	if len(runes) <= maxLen {
		return s
	}
	return string(runes[:maxLen]) + "..."
}

// min/max 辅助函数
func min(a, b uint64) uint64 {
	if a < b {
		return a
	}
	return b
}

func max(a, b uint64) uint64 {
	if a > b {
		return a
	}
	return b
}
