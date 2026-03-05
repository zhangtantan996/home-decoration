package tinode

import (
	"context"
	"errors"
	"fmt"
	"log"

	"gorm.io/gorm"
)

// Sentinel errors for message deletion
var (
	ErrNotAuthorized          = errors.New("user not authorized to access topic")
	ErrInsufficientPermission = errors.New("user does not have permission to delete messages")
)

// MessageDeleter handles deletion of chat messages.
// Current implementation uses direct database access.
// TODO: Migrate to Tinode REST API or WebSocket API for proper message deletion.
type MessageDeleter struct {
	db *gorm.DB
}

// NewMessageDeleter creates a new message deleter.
func NewMessageDeleter(db *gorm.DB) *MessageDeleter {
	return &MessageDeleter{db: db}
}

// DeleteMessages deletes all messages in a topic.
// This implementation directly modifies the Tinode database.
//
// IMPORTANT: This is a temporary solution. Tinode recommends using their
// REST API or WebSocket API for message operations to ensure proper
// cleanup of related data (subscriptions, notifications, etc.).
//
// Reference: https://github.com/tinode/chat/blob/master/docs/API.md#del
//
// Security: Only users with Owner ('O') or Delete ('D') permissions can delete all messages.
// Regular participants can only delete their own messages (not implemented yet).
func (d *MessageDeleter) DeleteMessages(ctx context.Context, topic string, userID uint64) error {
	if d.db == nil {
		return fmt.Errorf("database connection not initialized")
	}

	// Verify the user has permission to delete messages
	var subscription struct {
		ModeGiven string `gorm:"column:modegiven"`
	}
	err := d.db.WithContext(ctx).
		Table("subscriptions").
		Select("modegiven").
		Where("topic = ? AND userid = ? AND deletedat IS NULL", topic, userID).
		First(&subscription).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return ErrNotAuthorized
		}
		return fmt.Errorf("failed to verify topic access: %w", err)
	}

	// Check if user has Owner or Delete permission
	// Tinode permissions: 'O' = Owner, 'D' = Delete, 'W' = Write, 'R' = Read
	hasOwnerPermission := containsRune(subscription.ModeGiven, 'O')
	hasDeletePermission := containsRune(subscription.ModeGiven, 'D')

	if !hasOwnerPermission && !hasDeletePermission {
		log.Printf("[Tinode] User %d attempted to delete messages without permission in topic %s (mode: %s)",
			userID, topic, subscription.ModeGiven)
		return ErrInsufficientPermission
	}

	// Delete all messages in the topic
	result := d.db.WithContext(ctx).
		Exec("DELETE FROM messages WHERE topic = ?", topic)
	if result.Error != nil {
		return fmt.Errorf("failed to delete messages: %w", result.Error)
	}

	log.Printf("[Tinode] User %d deleted %d messages from topic %s (permission: %s)",
		userID, result.RowsAffected, topic, subscription.ModeGiven)

	return nil
}

// containsRune checks if a string contains a specific rune
func containsRune(s string, r rune) bool {
	for _, c := range s {
		if c == r {
			return true
		}
	}
	return false
}

// GetMessageCount returns the number of messages in a topic.
func (d *MessageDeleter) GetMessageCount(ctx context.Context, topic string) (int64, error) {
	var count int64
	err := d.db.WithContext(ctx).
		Table("messages").
		Where("topic = ?", topic).
		Count(&count).Error
	return count, err
}

