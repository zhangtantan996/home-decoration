package ws

import "encoding/json"

// PacketType 消息类型
type PacketType int

const (
	// 客户端 -> 服务端
	PacketTypePing        PacketType = 0 // 心跳
	PacketTypeMessageSend PacketType = 1 // 发送消息
	PacketTypeAckRead     PacketType = 2 // 已读回执

	// 服务端 -> 客户端
	PacketTypePong        PacketType = 10 // 心跳响应
	PacketTypeMessagePush PacketType = 11 // 新消息推送
	PacketTypeAckSend     PacketType = 12 // 发送确认
	PacketTypeError       PacketType = 13 // 错误通知
)

// Packet 协议包结构
type Packet struct {
	Type    PacketType      `json:"type"`    // 消息类型
	Seq     string          `json:"seq"`     // 唯一序列号，用于 ACK
	Payload json.RawMessage `json:"payload"` // 未解析的 JSON 数据
}

// MessagePayload 发送消息的载荷
type MessagePayload struct {
	ConversationID string `json:"conversationId"` // 会话 ID
	ReceiverID     uint   `json:"receiverId"`     // 接收者用户 ID
	Content        string `json:"content"`        // 消息内容
	MsgType        int    `json:"msgType"`        // 消息类型 1:文本 2:图片
}

// PushPayload 推送消息的载荷
type PushPayload struct {
	MessageID      uint64 `json:"messageId"`      // 消息 ID
	ConversationID string `json:"conversationId"` // 会话 ID
	SenderID       uint   `json:"senderId"`       // 发送者 ID
	SenderName     string `json:"senderName"`     // 发送者名称
	SenderAvatar   string `json:"senderAvatar"`   // 发送者头像
	Content        string `json:"content"`        // 消息内容
	MsgType        int    `json:"msgType"`        // 消息类型
	CreatedAt      string `json:"createdAt"`      // 创建时间
}

// AckSendPayload 发送确认的载荷
type AckSendPayload struct {
	Seq       string `json:"seq"`       // 原始序列号
	MessageID uint64 `json:"messageId"` // 服务端生成的消息 ID
}

// AckReadPayload 已读回执的载荷
type AckReadPayload struct {
	ConversationID string `json:"conversationId"` // 会话 ID
	LastReadMsgID  uint64 `json:"lastReadMsgId"`  // 最后读取的消息 ID
}

// ErrorPayload 错误通知的载荷
type ErrorPayload struct {
	Code    int    `json:"code"`    // 错误码
	Message string `json:"message"` // 错误信息
}

// MessageHandler 消息处理接口
type MessageHandler interface {
	HandleMessage(client *Client, packet *Packet)
}
