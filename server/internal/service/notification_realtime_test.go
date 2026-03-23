package service

import (
	"encoding/json"
	"testing"
	"time"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/realtime"
	"home-decoration-server/internal/repository"

	gormsqlite "gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupNotificationServiceRealtimeTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	db, err := gorm.Open(gormsqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite db: %v", err)
	}
	if err := db.AutoMigrate(&model.Notification{}); err != nil {
		t.Fatalf("auto migrate notification: %v", err)
	}

	previousDB := repository.DB
	repository.DB = db
	t.Cleanup(func() {
		repository.DB = previousDB
	})

	return db
}

func setupNotificationRealtimePublisherTest(t *testing.T, userType string, userID uint64) (*realtime.NotificationGateway, *realtime.Client) {
	t.Helper()

	gateway := realtime.NewNotificationGateway(realtime.GatewayConfig{
		MaxConnectionsPerUser: 5,
		MaxConnectionsPerIP:   20,
		PingInterval:          30 * time.Second,
		IdleTimeout:           90 * time.Second,
		SendBufferSize:        8,
	})
	client := realtime.NewClient(
		realtime.ClientKey{UserType: userType, UserID: userID},
		nil,
		"127.0.0.1",
		8,
		time.Now().Add(time.Hour),
		"",
		"",
	)
	if err := gateway.Register(client); err != nil {
		t.Fatalf("register realtime client: %v", err)
	}
	t.Cleanup(func() {
		gateway.Unregister(client)
	})

	previousPublisher := GetNotificationPublisher()
	SetNotificationPublisher(NewNotificationPublisher(gateway))
	t.Cleanup(func() {
		SetNotificationPublisher(previousPublisher)
	})

	return gateway, client
}

func readNotificationServiceRealtimeEvent(t *testing.T, client *realtime.Client) realtime.NotificationEvent {
	t.Helper()

	select {
	case payload := <-client.Send:
		var event realtime.NotificationEvent
		if err := json.Unmarshal(payload, &event); err != nil {
			t.Fatalf("unmarshal realtime payload: %v payload=%s", err, string(payload))
		}
		return event
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for realtime payload")
	}

	return realtime.NotificationEvent{}
}

func decodeNotificationIDData(t *testing.T, raw interface{}) realtime.NotificationIDData {
	t.Helper()
	encoded, err := json.Marshal(raw)
	if err != nil {
		t.Fatalf("marshal notification id data: %v", err)
	}
	var data realtime.NotificationIDData
	if err := json.Unmarshal(encoded, &data); err != nil {
		t.Fatalf("unmarshal notification id data: %v", err)
	}
	return data
}

func decodeUnreadCountData(t *testing.T, raw interface{}) realtime.UnreadCountData {
	t.Helper()
	encoded, err := json.Marshal(raw)
	if err != nil {
		t.Fatalf("marshal unread count data: %v", err)
	}
	var data realtime.UnreadCountData
	if err := json.Unmarshal(encoded, &data); err != nil {
		t.Fatalf("unmarshal unread count data: %v", err)
	}
	return data
}

func TestNotificationServiceCreatePublishesNewAndUnreadCount(t *testing.T) {
	db := setupNotificationServiceRealtimeTestDB(t)
	_, client := setupNotificationRealtimePublisherTest(t, "user", 66)

	svc := &NotificationService{}
	if err := svc.Create(&CreateNotificationInput{
		UserID:      66,
		UserType:    "user",
		Title:       "新通知",
		Content:     "请处理",
		Type:        model.NotificationTypeProposalSubmitted,
		RelatedID:   123,
		RelatedType: "proposal",
		ActionURL:   "/proposals/123",
	}); err != nil {
		t.Fatalf("create notification: %v", err)
	}

	var notification model.Notification
	if err := db.First(&notification).Error; err != nil {
		t.Fatalf("load created notification: %v", err)
	}

	newEvent := readNotificationServiceRealtimeEvent(t, client)
	if newEvent.Type != realtime.EventTypeNotificationNew {
		t.Fatalf("expected notification.new, got %s", newEvent.Type)
	}
	newData := decodeNotificationIDData(t, newEvent.Data)
	if newData.NotificationID != notification.ID {
		t.Fatalf("expected notification id %d, got %d", notification.ID, newData.NotificationID)
	}

	unreadEvent := readNotificationServiceRealtimeEvent(t, client)
	if unreadEvent.Type != realtime.EventTypeUnreadCountUpdate {
		t.Fatalf("expected notification.unread_count, got %s", unreadEvent.Type)
	}
	unreadData := decodeUnreadCountData(t, unreadEvent.Data)
	if unreadData.Count != 1 {
		t.Fatalf("expected unread count 1, got %d", unreadData.Count)
	}
}

func TestNotificationServiceMarkAsReadPublishesReadAndUnreadCount(t *testing.T) {
	db := setupNotificationServiceRealtimeTestDB(t)
	_, client := setupNotificationRealtimePublisherTest(t, "provider", 77)

	notification := model.Notification{
		Base:     model.Base{ID: 201},
		UserID:   77,
		UserType: "provider",
		Title:    "待读通知",
		Content:  "请查看",
		Type:     model.NotificationTypeOrderPaid,
		IsRead:   false,
	}
	if err := db.Create(&notification).Error; err != nil {
		t.Fatalf("seed notification: %v", err)
	}

	svc := &NotificationService{}
	if err := svc.MarkAsRead(notification.ID, 77, "provider"); err != nil {
		t.Fatalf("mark as read: %v", err)
	}

	readEvent := readNotificationServiceRealtimeEvent(t, client)
	if readEvent.Type != realtime.EventTypeNotificationRead {
		t.Fatalf("expected notification.read, got %s", readEvent.Type)
	}
	readData := decodeNotificationIDData(t, readEvent.Data)
	if readData.NotificationID != notification.ID {
		t.Fatalf("expected notification id %d, got %d", notification.ID, readData.NotificationID)
	}

	unreadEvent := readNotificationServiceRealtimeEvent(t, client)
	if unreadEvent.Type != realtime.EventTypeUnreadCountUpdate {
		t.Fatalf("expected notification.unread_count, got %s", unreadEvent.Type)
	}
	unreadData := decodeUnreadCountData(t, unreadEvent.Data)
	if unreadData.Count != 0 {
		t.Fatalf("expected unread count 0, got %d", unreadData.Count)
	}
}

func TestNotificationServiceMarkAllAsReadPublishesAllReadAndUnreadCount(t *testing.T) {
	db := setupNotificationServiceRealtimeTestDB(t)
	_, client := setupNotificationRealtimePublisherTest(t, "user", 88)

	notifications := []model.Notification{
		{
			Base:     model.Base{ID: 301},
			UserID:   88,
			UserType: "user",
			Title:    "通知1",
			Content:  "内容1",
			Type:     model.NotificationTypeOrderCreated,
			IsRead:   false,
		},
		{
			Base:     model.Base{ID: 302},
			UserID:   88,
			UserType: "user",
			Title:    "通知2",
			Content:  "内容2",
			Type:     model.NotificationTypeOrderCreated,
			IsRead:   false,
		},
	}
	if err := db.Create(&notifications).Error; err != nil {
		t.Fatalf("seed notifications: %v", err)
	}

	svc := &NotificationService{}
	if err := svc.MarkAllAsRead(88, "user"); err != nil {
		t.Fatalf("mark all as read: %v", err)
	}

	allReadEvent := readNotificationServiceRealtimeEvent(t, client)
	if allReadEvent.Type != realtime.EventTypeNotificationAllRead {
		t.Fatalf("expected notification.all_read, got %s", allReadEvent.Type)
	}

	unreadEvent := readNotificationServiceRealtimeEvent(t, client)
	if unreadEvent.Type != realtime.EventTypeUnreadCountUpdate {
		t.Fatalf("expected notification.unread_count, got %s", unreadEvent.Type)
	}
	unreadData := decodeUnreadCountData(t, unreadEvent.Data)
	if unreadData.Count != 0 {
		t.Fatalf("expected unread count 0, got %d", unreadData.Count)
	}
}

func TestNotificationServiceDeletePublishesDeletedAndUnreadCount(t *testing.T) {
	db := setupNotificationServiceRealtimeTestDB(t)
	_, client := setupNotificationRealtimePublisherTest(t, "user", 99)

	notification := model.Notification{
		Base:     model.Base{ID: 401},
		UserID:   99,
		UserType: "user",
		Title:    "待删除通知",
		Content:  "内容",
		Type:     model.NotificationTypeOrderCreated,
		IsRead:   false,
	}
	if err := db.Create(&notification).Error; err != nil {
		t.Fatalf("seed notification: %v", err)
	}

	svc := &NotificationService{}
	if err := svc.DeleteNotification(notification.ID, 99, "user"); err != nil {
		t.Fatalf("delete notification: %v", err)
	}

	deleteEvent := readNotificationServiceRealtimeEvent(t, client)
	if deleteEvent.Type != realtime.EventTypeNotificationDelete {
		t.Fatalf("expected notification.delete, got %s", deleteEvent.Type)
	}
	deleteData := decodeNotificationIDData(t, deleteEvent.Data)
	if deleteData.NotificationID != notification.ID {
		t.Fatalf("expected notification id %d, got %d", notification.ID, deleteData.NotificationID)
	}

	unreadEvent := readNotificationServiceRealtimeEvent(t, client)
	if unreadEvent.Type != realtime.EventTypeUnreadCountUpdate {
		t.Fatalf("expected notification.unread_count, got %s", unreadEvent.Type)
	}
	unreadData := decodeUnreadCountData(t, unreadEvent.Data)
	if unreadData.Count != 0 {
		t.Fatalf("expected unread count 0, got %d", unreadData.Count)
	}
}
