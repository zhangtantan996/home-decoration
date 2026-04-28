package service

import (
	"encoding/json"
	"errors"
	"fmt"
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	"log"
	"strings"
)

type OutboxHandler interface {
	Handle(event model.OutboxEvent) error
}

type OutboxHandlerFunc func(event model.OutboxEvent) error

func (f OutboxHandlerFunc) Handle(event model.OutboxEvent) error { return f(event) }

type OutboxHandlerRegistry struct {
	handlers map[string]OutboxHandler
}

func NewOutboxHandlerRegistry() *OutboxHandlerRegistry {
	registry := &OutboxHandlerRegistry{handlers: map[string]OutboxHandler{}}
	registry.Register(OutboxHandlerNotification, OutboxHandlerFunc(handleOutboxNotification))
	registry.Register(OutboxHandlerAudit, OutboxHandlerFunc(handleOutboxAudit))
	registry.Register(OutboxHandlerSMS, OutboxHandlerFunc(handleOutboxNoop))
	registry.Register(OutboxHandlerStats, OutboxHandlerFunc(handleOutboxNoop))
	registry.Register(OutboxHandlerGovernance, OutboxHandlerFunc(handleOutboxNoop))
	return registry
}

func (r *OutboxHandlerRegistry) Register(key string, handler OutboxHandler) {
	if r == nil || handler == nil {
		return
	}
	key = strings.TrimSpace(key)
	if key == "" {
		return
	}
	r.handlers[key] = handler
}

func (r *OutboxHandlerRegistry) Handle(event model.OutboxEvent) error {
	if r == nil {
		return errors.New("outbox handler registry 未初始化")
	}
	handler, ok := r.handlers[strings.TrimSpace(event.HandlerKey)]
	if !ok {
		return fmt.Errorf("未注册的 outbox handler: %s", event.HandlerKey)
	}
	return handler.Handle(event)
}

type outboxNotificationPayload struct {
	UserID      uint64                 `json:"userId"`
	UserType    string                 `json:"userType"`
	Title       string                 `json:"title"`
	Content     string                 `json:"content"`
	Type        string                 `json:"type"`
	RelatedID   uint64                 `json:"relatedId"`
	RelatedType string                 `json:"relatedType"`
	ActionURL   string                 `json:"actionUrl"`
	Extra       map[string]interface{} `json:"extra"`
	Category    string                 `json:"category"`
}

func handleOutboxNotification(event model.OutboxEvent) error {
	var payload outboxNotificationPayload
	if err := json.Unmarshal([]byte(event.Payload), &payload); err != nil {
		return fmt.Errorf("解析通知 payload 失败: %w", err)
	}
	if strings.TrimSpace(payload.Title) == "" || strings.TrimSpace(payload.Content) == "" || strings.TrimSpace(payload.Type) == "" {
		return errors.New("通知 payload 缺少必要字段")
	}
	if payload.Extra == nil {
		payload.Extra = map[string]interface{}{}
	}
	payload.Extra["eventKey"] = event.EventKey
	payload.Extra["handlerKey"] = event.HandlerKey
	if payload.UserType == "admin" || payload.UserType == "admin_broadcast" {
		if exists, err := notificationExistsForOutboxAdminEvent(event.EventKey); err != nil {
			return err
		} else if exists {
			return nil
		}
		return (&NotificationService{}).NotifyAdmins(&CreateNotificationInput{
			Title:       payload.Title,
			Content:     payload.Content,
			Type:        payload.Type,
			RelatedID:   payload.RelatedID,
			RelatedType: payload.RelatedType,
			ActionURL:   payload.ActionURL,
			Extra:       payload.Extra,
			Category:    payload.Category,
		})
	}
	if payload.UserID == 0 {
		return errors.New("通知 payload 缺少接收人")
	}
	if exists, err := notificationExistsForOutboxEvent(event.EventKey, payload.UserID, payload.UserType); err != nil {
		return err
	} else if exists {
		return nil
	}
	return (&NotificationService{}).Create(&CreateNotificationInput{
		UserID:      payload.UserID,
		UserType:    payload.UserType,
		Title:       payload.Title,
		Content:     payload.Content,
		Type:        payload.Type,
		RelatedID:   payload.RelatedID,
		RelatedType: payload.RelatedType,
		ActionURL:   payload.ActionURL,
		Extra:       payload.Extra,
		Category:    payload.Category,
	})
}

func notificationExistsForOutboxEvent(eventKey string, userID uint64, userType string) (bool, error) {
	eventKey = strings.TrimSpace(eventKey)
	if eventKey == "" {
		return false, nil
	}
	var count int64
	err := repository.DB.Model(&model.Notification{}).
		Where("user_id = ? AND user_type = ? AND extra LIKE ?", userID, strings.TrimSpace(userType), "%\"eventKey\":\""+eventKey+"\"%").
		Count(&count).Error
	return count > 0, err
}

func notificationExistsForOutboxAdminEvent(eventKey string) (bool, error) {
	eventKey = strings.TrimSpace(eventKey)
	if eventKey == "" {
		return false, nil
	}
	var count int64
	err := repository.DB.Model(&model.Notification{}).
		Where("user_type = ? AND extra LIKE ?", "admin", "%\"eventKey\":\""+eventKey+"\"%").
		Count(&count).Error
	return count > 0, err
}

type outboxAuditPayload struct {
	OperatorType  string                 `json:"operatorType"`
	OperatorID    uint64                 `json:"operatorId"`
	OperationType string                 `json:"operationType"`
	ResourceType  string                 `json:"resourceType"`
	ResourceID    uint64                 `json:"resourceId"`
	Reason        string                 `json:"reason"`
	Result        string                 `json:"result"`
	BeforeState   map[string]interface{} `json:"beforeState"`
	AfterState    map[string]interface{} `json:"afterState"`
	Metadata      map[string]interface{} `json:"metadata"`
}

func handleOutboxAudit(event model.OutboxEvent) error {
	if exists, err := auditExistsForOutboxEvent(event.EventKey); err != nil {
		return err
	} else if exists {
		return nil
	}
	var payload outboxAuditPayload
	if strings.TrimSpace(event.Payload) != "" {
		if err := json.Unmarshal([]byte(event.Payload), &payload); err != nil {
			return fmt.Errorf("解析审计 payload 失败: %w", err)
		}
	}
	if payload.OperationType == "" {
		payload.OperationType = event.EventType
	}
	if payload.ResourceType == "" {
		payload.ResourceType = event.AggregateType
	}
	if payload.ResourceID == 0 {
		payload.ResourceID = event.AggregateID
	}
	if payload.Result == "" {
		payload.Result = "success"
	}
	if payload.Metadata == nil {
		payload.Metadata = map[string]interface{}{}
	}
	payload.Metadata["eventKey"] = event.EventKey
	payload.Metadata["handlerKey"] = event.HandlerKey
	return (&AuditLogService{}).CreateBusinessRecord(&CreateAuditRecordInput{
		OperatorType:  payload.OperatorType,
		OperatorID:    payload.OperatorID,
		OperationType: payload.OperationType,
		ResourceType:  payload.ResourceType,
		ResourceID:    payload.ResourceID,
		Reason:        payload.Reason,
		Result:        payload.Result,
		BeforeState:   payload.BeforeState,
		AfterState:    payload.AfterState,
		Metadata:      payload.Metadata,
	})
}

func auditExistsForOutboxEvent(eventKey string) (bool, error) {
	eventKey = strings.TrimSpace(eventKey)
	if eventKey == "" {
		return false, nil
	}
	var count int64
	err := repository.DB.Model(&model.AuditLog{}).
		Where("record_kind = ? AND metadata LIKE ?", auditRecordKindBusiness, "%\"eventKey\":\""+eventKey+"\"%").
		Count(&count).Error
	return count > 0, err
}

func handleOutboxNoop(event model.OutboxEvent) error {
	log.Printf("[Outbox] handler=%s event=%s eventKey=%s marked as no-op in V1", event.HandlerKey, event.EventType, event.EventKey)
	return nil
}
