package model

import (
	"fmt"
	"time"
)

// Conversation 会话
type Conversation struct {
	ID                 string    `json:"id" gorm:"primaryKey;size:64"` // 格式: sort(uid1, uid2).join('_')
	User1ID            uint64    `json:"user1Id" gorm:"index"`
	User2ID            uint64    `json:"user2Id" gorm:"index"`
	LastMessageContent string    `json:"lastMessageContent" gorm:"size:500"`
	LastMessageTime    time.Time `json:"lastMessageTime"`
	User1Unread        int       `json:"user1Unread" gorm:"default:0"` // User1 的未读数
	User2Unread        int       `json:"user2Unread" gorm:"default:0"` // User2 的未读数
	CreatedAt          time.Time `json:"createdAt"`
	UpdatedAt          time.Time `json:"updatedAt"`
}

// ChatMessage 聊天消息
type ChatMessage struct {
	ID             uint64    `json:"id" gorm:"primaryKey;autoIncrement"`
	ConversationID string    `json:"conversationId" gorm:"index;size:64"`
	SenderID       uint64    `json:"senderId" gorm:"index"`
	ReceiverID     uint64    `json:"receiverId" gorm:"index"`
	Content        string    `json:"content" gorm:"type:text"`
	MsgType        int       `json:"msgType" gorm:"default:1"` // 1:文本 2:图片 3:系统消息
	IsRead         bool      `json:"isRead" gorm:"default:false"`
	CreatedAt      time.Time `json:"createdAt"`
}

// GetConversationID 生成会话 ID (保证唯一性)
func GetConversationID(uid1, uid2 uint64) string {
	if uid1 > uid2 {
		uid1, uid2 = uid2, uid1
	}
	return fmt.Sprintf("%d_%d", uid1, uid2)
}
