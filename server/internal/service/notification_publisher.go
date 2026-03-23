package service

import (
	"errors"
	"sync"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/realtime"
)

type NotificationRealtimePublisher interface {
	PublishNew(notification *model.Notification) error
	PublishRead(userType string, userID, notificationID uint64) error
	PublishDeleted(userType string, userID, notificationID uint64) error
	PublishAllRead(userType string, userID uint64) error
	PublishUnreadCount(userType string, userID uint64, count int64) error
}

var (
	notificationPublisherMu sync.RWMutex
	notificationPublisher   NotificationRealtimePublisher
)

func SetNotificationPublisher(publisher NotificationRealtimePublisher) {
	notificationPublisherMu.Lock()
	defer notificationPublisherMu.Unlock()
	notificationPublisher = publisher
}

func GetNotificationPublisher() NotificationRealtimePublisher {
	notificationPublisherMu.RLock()
	defer notificationPublisherMu.RUnlock()
	return notificationPublisher
}

type NotificationPublisher struct {
	gateway *realtime.NotificationGateway
}

func NewNotificationPublisher(gateway *realtime.NotificationGateway) *NotificationPublisher {
	return &NotificationPublisher{gateway: gateway}
}

func (p *NotificationPublisher) PublishNew(notification *model.Notification) error {
	if notification == nil {
		return errors.New("notification is nil")
	}
	payload, err := realtime.MarshalEvent(realtime.NewEvent(realtime.EventTypeNotificationNew, realtime.NotificationIDData{NotificationID: notification.ID}))
	if err != nil {
		return err
	}
	_, err = p.gateway.SendToUser(notification.UserType, notification.UserID, payload)
	return err
}

func (p *NotificationPublisher) PublishRead(userType string, userID, notificationID uint64) error {
	payload, err := realtime.MarshalEvent(realtime.NewEvent(realtime.EventTypeNotificationRead, realtime.NotificationIDData{NotificationID: notificationID}))
	if err != nil {
		return err
	}
	_, err = p.gateway.SendToUser(userType, userID, payload)
	return err
}

func (p *NotificationPublisher) PublishDeleted(userType string, userID, notificationID uint64) error {
	payload, err := realtime.MarshalEvent(realtime.NewEvent(realtime.EventTypeNotificationDelete, realtime.NotificationIDData{NotificationID: notificationID}))
	if err != nil {
		return err
	}
	_, err = p.gateway.SendToUser(userType, userID, payload)
	return err
}

func (p *NotificationPublisher) PublishAllRead(userType string, userID uint64) error {
	payload, err := realtime.MarshalEvent(realtime.NewEvent(realtime.EventTypeNotificationAllRead, map[string]bool{"allRead": true}))
	if err != nil {
		return err
	}
	_, err = p.gateway.SendToUser(userType, userID, payload)
	return err
}

func (p *NotificationPublisher) PublishUnreadCount(userType string, userID uint64, count int64) error {
	payload, err := realtime.MarshalEvent(realtime.NewEvent(realtime.EventTypeUnreadCountUpdate, realtime.UnreadCountData{Count: count}))
	if err != nil {
		return err
	}
	_, err = p.gateway.SendToUser(userType, userID, payload)
	return err
}
