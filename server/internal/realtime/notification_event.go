package realtime

import (
	"encoding/json"
	"time"
)

type EventType string

const (
	EventTypeNotificationInit    EventType = "notification.init"
	EventTypeNotificationNew     EventType = "notification.new"
	EventTypeNotificationRead    EventType = "notification.read"
	EventTypeNotificationDelete  EventType = "notification.delete"
	EventTypeNotificationAllRead EventType = "notification.all_read"
	EventTypeUnreadCountUpdate   EventType = "notification.unread_count"
	EventTypePing                EventType = "ping"
	EventTypePong                EventType = "pong"
)

type NotificationEvent struct {
	Type      EventType   `json:"type"`
	Timestamp int64       `json:"timestamp"`
	Data      interface{} `json:"data,omitempty"`
}

type NotificationIDData struct {
	NotificationID uint64 `json:"notificationId"`
}

type UnreadCountData struct {
	Count int64 `json:"count"`
}

type NotificationInitData struct {
	Connected           bool  `json:"connected"`
	Count               int64 `json:"count"`
	PingIntervalSeconds int64 `json:"pingIntervalSeconds,omitempty"`
}

func MarshalEvent(event NotificationEvent) ([]byte, error) {
	return json.Marshal(event)
}

func NewEvent(eventType EventType, data interface{}) NotificationEvent {
	return NotificationEvent{
		Type:      eventType,
		Timestamp: time.Now().Unix(),
		Data:      data,
	}
}
