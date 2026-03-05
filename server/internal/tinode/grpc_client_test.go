package tinode

import (
	"context"
	"testing"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupTestDB(t *testing.T) *gorm.DB {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to open test database: %v", err)
	}

	// Create test tables
	err = db.Exec(`
			CREATE TABLE subscriptions (
				topic TEXT,
				userid INTEGER,
				modegiven TEXT,
				deletedat DATETIME
			)
		`).Error
	if err != nil {
		t.Fatalf("failed to create subscriptions table: %v", err)
	}

	err = db.Exec(`
		CREATE TABLE messages (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			topic TEXT,
			content TEXT
		)
	`).Error
	if err != nil {
		t.Fatalf("failed to create messages table: %v", err)
	}

	return db
}

func TestMessageDeleter_DeleteMessages_Success(t *testing.T) {
	db := setupTestDB(t)
	deleter := NewMessageDeleter(db)

	// Setup: Create a subscription and messages
	topic := "usr123_usr456"
	userID := uint64(123)

	db.Exec("INSERT INTO subscriptions (topic, userid, modegiven, deletedat) VALUES (?, ?, ?, NULL)", topic, userID, "O")
	db.Exec("INSERT INTO messages (topic, content) VALUES (?, ?)", topic, "message 1")
	db.Exec("INSERT INTO messages (topic, content) VALUES (?, ?)", topic, "message 2")
	db.Exec("INSERT INTO messages (topic, content) VALUES (?, ?)", topic, "message 3")

	// Verify messages exist
	count, err := deleter.GetMessageCount(context.Background(), topic)
	if err != nil {
		t.Fatalf("failed to get message count: %v", err)
	}
	if count != 3 {
		t.Errorf("expected 3 messages, got %d", count)
	}

	// Delete messages
	err = deleter.DeleteMessages(context.Background(), topic, userID)
	if err != nil {
		t.Fatalf("failed to delete messages: %v", err)
	}

	// Verify messages deleted
	count, err = deleter.GetMessageCount(context.Background(), topic)
	if err != nil {
		t.Fatalf("failed to get message count after deletion: %v", err)
	}
	if count != 0 {
		t.Errorf("expected 0 messages after deletion, got %d", count)
	}
}

func TestMessageDeleter_DeleteMessages_Unauthorized(t *testing.T) {
	db := setupTestDB(t)
	deleter := NewMessageDeleter(db)

	// Setup: Create messages but no subscription for the user
	topic := "usr123_usr456"
	userID := uint64(999) // Different user

	db.Exec("INSERT INTO subscriptions (topic, userid, modegiven, deletedat) VALUES (?, ?, ?, NULL)", topic, 123, "O")
	db.Exec("INSERT INTO messages (topic, content) VALUES (?, ?)", topic, "message 1")

	// Attempt to delete messages
	err := deleter.DeleteMessages(context.Background(), topic, userID)
	if err == nil {
		t.Fatal("expected error for unauthorized user, got nil")
	}

	// Verify messages not deleted
	count, err := deleter.GetMessageCount(context.Background(), topic)
	if err != nil {
		t.Fatalf("failed to get message count: %v", err)
	}
	if count != 1 {
		t.Errorf("expected 1 message (not deleted), got %d", count)
	}
}

func TestMessageDeleter_DeleteMessages_EmptyTopic(t *testing.T) {
	db := setupTestDB(t)
	deleter := NewMessageDeleter(db)

	// Setup: Create subscription but no messages
	topic := "usr123_usr456"
	userID := uint64(123)

	db.Exec("INSERT INTO subscriptions (topic, userid, modegiven, deletedat) VALUES (?, ?, ?, NULL)", topic, userID, "O")

	// Delete messages (should succeed even if no messages)
	err := deleter.DeleteMessages(context.Background(), topic, userID)
	if err != nil {
		t.Fatalf("failed to delete messages from empty topic: %v", err)
	}

	// Verify count is still 0
	count, err := deleter.GetMessageCount(context.Background(), topic)
	if err != nil {
		t.Fatalf("failed to get message count: %v", err)
	}
	if count != 0 {
		t.Errorf("expected 0 messages, got %d", count)
	}
}
