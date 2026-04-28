package service

import (
	"encoding/json"
	"errors"
	"fmt"
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	"strings"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	OutboxHandlerNotification = "notification"
	OutboxHandlerSMS          = "sms"
	OutboxHandlerAudit        = "audit"
	OutboxHandlerStats        = "stats"
	OutboxHandlerGovernance   = "governance"
)

const (
	OutboxEventPaymentPaid                   = "payment.paid"
	OutboxEventPaymentClosed                 = "payment.closed"
	OutboxEventRefundCreated                 = "refund.created"
	OutboxEventRefundSucceeded               = "refund.succeeded"
	OutboxEventRefundFailed                  = "refund.failed"
	OutboxEventPayoutProcessing              = "payout.processing"
	OutboxEventPayoutPaid                    = "payout.paid"
	OutboxEventPayoutFailed                  = "payout.failed"
	OutboxEventQuoteSubmitted                = "quote.submitted"
	OutboxEventQuoteRejected                 = "quote.rejected"
	OutboxEventQuoteAwarded                  = "quote.awarded"
	OutboxEventChangeOrderCreated            = "change_order.created"
	OutboxEventChangeOrderConfirmed          = "change_order.confirmed"
	OutboxEventChangeOrderRejected           = "change_order.rejected"
	OutboxEventChangeOrderSettlementRequired = "change_order.settlement_required"
	OutboxEventChangeOrderSettled            = "change_order.settled"
	OutboxEventProjectCompletionSubmitted    = "project.completion_submitted"
	OutboxEventProjectAccepted               = "project.accepted"
	OutboxEventProjectDisputeCreated         = "project.dispute.created"
)

const defaultOutboxMaxRetries = 3

type OutboxEventInput struct {
	EventType     string
	AggregateType string
	AggregateID   uint64
	HandlerKey    string
	EventKey      string
	Payload       interface{}
	MaxRetries    int
	NextRetryAt   *time.Time
}

type ListOutboxEventsFilter struct {
	Status        string
	EventType     string
	HandlerKey    string
	AggregateType string
	AggregateID   uint64
	StartTime     *time.Time
	EndTime       *time.Time
	Page          int
	PageSize      int
}

type OutboxEventService struct{}

func (s *OutboxEventService) EnqueueTx(tx *gorm.DB, input OutboxEventInput) error {
	if tx == nil {
		return errors.New("outbox enqueue requires transaction")
	}
	event, err := buildOutboxEvent(input)
	if err != nil {
		return err
	}
	return tx.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "event_key"}, {Name: "handler_key"}},
		DoNothing: true,
	}).Create(event).Error
}

func (s *OutboxEventService) EnqueueManyTx(tx *gorm.DB, inputs []OutboxEventInput) error {
	for _, input := range inputs {
		if err := s.EnqueueTx(tx, input); err != nil {
			return err
		}
	}
	return nil
}

func (s *OutboxEventService) ClaimBatch(workerID string, limit int, lockTTL time.Duration) ([]model.OutboxEvent, error) {
	workerID = strings.TrimSpace(workerID)
	if workerID == "" {
		return nil, errors.New("workerID 不能为空")
	}
	if limit <= 0 {
		limit = 20
	}
	if lockTTL <= 0 {
		lockTTL = time.Minute
	}
	if repository.DB == nil {
		return nil, errors.New("database not initialized")
	}

	now := time.Now()
	lockedUntil := now.Add(lockTTL)
	var claimed []model.OutboxEvent
	err := repository.DB.Transaction(func(tx *gorm.DB) error {
		query := tx.Where("status IN ? AND next_retry_at <= ? AND (locked_until IS NULL OR locked_until <= ?)", []string{model.OutboxStatusPending, model.OutboxStatusFailed}, now, now).
			Order("next_retry_at ASC, id ASC").
			Limit(limit)
		if tx.Dialector.Name() == "postgres" {
			query = query.Clauses(clause.Locking{Strength: "UPDATE", Options: "SKIP LOCKED"})
		}
		if err := query.Find(&claimed).Error; err != nil {
			return err
		}
		if len(claimed) == 0 {
			return nil
		}
		ids := make([]uint64, 0, len(claimed))
		for _, event := range claimed {
			ids = append(ids, event.ID)
		}
		updates := map[string]interface{}{
			"status":       model.OutboxStatusProcessing,
			"locked_by":    workerID,
			"locked_until": &lockedUntil,
			"updated_at":   now,
		}
		if err := tx.Model(&model.OutboxEvent{}).Where("id IN ?", ids).Updates(updates).Error; err != nil {
			return err
		}
		return tx.Where("id IN ?", ids).Order("next_retry_at ASC, id ASC").Find(&claimed).Error
	})
	return claimed, err
}

func (s *OutboxEventService) MarkSucceeded(event *model.OutboxEvent) error {
	if event == nil || event.ID == 0 {
		return errors.New("outbox event 不能为空")
	}
	now := time.Now()
	return repository.DB.Model(&model.OutboxEvent{}).Where("id = ?", event.ID).Updates(map[string]interface{}{
		"status":       model.OutboxStatusSucceeded,
		"processed_at": &now,
		"locked_by":    "",
		"locked_until": nil,
		"last_error":   "",
		"updated_at":   now,
	}).Error
}

func (s *OutboxEventService) MarkFailed(event *model.OutboxEvent, cause error) error {
	if event == nil || event.ID == 0 {
		return errors.New("outbox event 不能为空")
	}
	now := time.Now()
	retryCount := event.RetryCount + 1
	maxRetries := event.MaxRetries
	if maxRetries <= 0 {
		maxRetries = defaultOutboxMaxRetries
	}
	status := model.OutboxStatusFailed
	if retryCount >= maxRetries {
		status = model.OutboxStatusDead
	}
	updates := map[string]interface{}{
		"status":        status,
		"retry_count":   retryCount,
		"next_retry_at": nextOutboxRetryAt(now, retryCount),
		"locked_by":     "",
		"locked_until":  nil,
		"last_error":    sanitizeOutboxError(cause),
		"updated_at":    now,
	}
	if err := repository.DB.Model(&model.OutboxEvent{}).Where("id = ?", event.ID).Updates(updates).Error; err != nil {
		return err
	}
	if status == model.OutboxStatusDead {
		_ = (&SystemAlertService{}).UpsertOutboxDeadEventAlert(event.ID, event.EventType, event.HandlerKey, sanitizeOutboxError(cause))
	}
	return nil
}

func (s *OutboxEventService) MarkDead(event *model.OutboxEvent, cause error) error {
	if event == nil || event.ID == 0 {
		return errors.New("outbox event 不能为空")
	}
	now := time.Now()
	if err := repository.DB.Model(&model.OutboxEvent{}).Where("id = ?", event.ID).Updates(map[string]interface{}{
		"status":       model.OutboxStatusDead,
		"locked_by":    "",
		"locked_until": nil,
		"last_error":   sanitizeOutboxError(cause),
		"updated_at":   now,
	}).Error; err != nil {
		return err
	}
	return (&SystemAlertService{}).UpsertOutboxDeadEventAlert(event.ID, event.EventType, event.HandlerKey, sanitizeOutboxError(cause))
}

func (s *OutboxEventService) MarkIgnored(eventID, adminID uint64, reason string) error {
	reason = strings.TrimSpace(reason)
	if eventID == 0 {
		return errors.New("事件ID不能为空")
	}
	if adminID == 0 {
		return errors.New("操作者不能为空")
	}
	if reason == "" {
		return errors.New("忽略原因不能为空")
	}
	now := time.Now()
	return repository.DB.Model(&model.OutboxEvent{}).Where("id = ?", eventID).Updates(map[string]interface{}{
		"status":         model.OutboxStatusIgnored,
		"ignored_by":     adminID,
		"ignored_reason": reason,
		"ignored_at":     &now,
		"locked_by":      "",
		"locked_until":   nil,
		"updated_at":     now,
	}).Error
}

func (s *OutboxEventService) RetryEvent(eventID uint64) error {
	if eventID == 0 {
		return errors.New("事件ID不能为空")
	}
	now := time.Now()
	return repository.DB.Model(&model.OutboxEvent{}).Where("id = ?", eventID).Updates(map[string]interface{}{
		"status":        model.OutboxStatusPending,
		"retry_count":   0,
		"next_retry_at": now,
		"locked_by":     "",
		"locked_until":  nil,
		"last_error":    "",
		"updated_at":    now,
	}).Error
}

func (s *OutboxEventService) List(filter ListOutboxEventsFilter) ([]model.OutboxEvent, int64, error) {
	query := repository.DB.Model(&model.OutboxEvent{})
	query = applyOutboxEventFilter(query, filter)
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	page := filter.Page
	if page <= 0 {
		page = 1
	}
	pageSize := filter.PageSize
	if pageSize <= 0 || pageSize > 100 {
		pageSize = 20
	}
	var events []model.OutboxEvent
	err := applyOutboxEventFilter(repository.DB.Model(&model.OutboxEvent{}), filter).
		Order("created_at DESC, id DESC").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Find(&events).Error
	return events, total, err
}

func (s *OutboxEventService) GetByID(id uint64) (*model.OutboxEvent, error) {
	if id == 0 {
		return nil, errors.New("事件ID不能为空")
	}
	var event model.OutboxEvent
	if err := repository.DB.First(&event, id).Error; err != nil {
		return nil, err
	}
	return &event, nil
}

func buildOutboxEvent(input OutboxEventInput) (*model.OutboxEvent, error) {
	eventType := strings.TrimSpace(input.EventType)
	aggregateType := strings.TrimSpace(input.AggregateType)
	handlerKey := strings.TrimSpace(input.HandlerKey)
	eventKey := strings.TrimSpace(input.EventKey)
	if eventType == "" || aggregateType == "" || handlerKey == "" || eventKey == "" {
		return nil, errors.New("outbox event 缺少必要字段")
	}
	payload, err := marshalOutboxPayload(input.Payload)
	if err != nil {
		return nil, err
	}
	nextRetryAt := time.Now()
	if input.NextRetryAt != nil {
		nextRetryAt = *input.NextRetryAt
	}
	maxRetries := input.MaxRetries
	if maxRetries <= 0 {
		maxRetries = defaultOutboxMaxRetries
	}
	return &model.OutboxEvent{
		EventType:     eventType,
		AggregateType: aggregateType,
		AggregateID:   input.AggregateID,
		HandlerKey:    handlerKey,
		EventKey:      eventKey,
		Payload:       payload,
		Status:        model.OutboxStatusPending,
		MaxRetries:    maxRetries,
		NextRetryAt:   nextRetryAt,
	}, nil
}

func marshalOutboxPayload(payload interface{}) (string, error) {
	if payload == nil {
		return "{}", nil
	}
	switch v := payload.(type) {
	case string:
		if strings.TrimSpace(v) == "" {
			return "{}", nil
		}
		if !json.Valid([]byte(v)) {
			return "", fmt.Errorf("outbox payload 不是合法 JSON")
		}
		return v, nil
	case []byte:
		if len(v) == 0 {
			return "{}", nil
		}
		if !json.Valid(v) {
			return "", fmt.Errorf("outbox payload 不是合法 JSON")
		}
		return string(v), nil
	default:
		bytes, err := json.Marshal(v)
		if err != nil {
			return "", err
		}
		return string(bytes), nil
	}
}

func nextOutboxRetryAt(now time.Time, retryCount int) time.Time {
	if retryCount < 1 {
		retryCount = 1
	}
	seconds := 30 * (1 << min(retryCount-1, 6))
	return now.Add(time.Duration(seconds) * time.Second)
}

func sanitizeOutboxError(err error) string {
	if err == nil {
		return ""
	}
	text := strings.TrimSpace(err.Error())
	if len(text) > 500 {
		text = text[:500]
	}
	return text
}

func applyOutboxEventFilter(query *gorm.DB, filter ListOutboxEventsFilter) *gorm.DB {
	if status := strings.TrimSpace(filter.Status); status != "" {
		query = query.Where("status = ?", status)
	}
	if eventType := strings.TrimSpace(filter.EventType); eventType != "" {
		query = query.Where("event_type = ?", eventType)
	}
	if handlerKey := strings.TrimSpace(filter.HandlerKey); handlerKey != "" {
		query = query.Where("handler_key = ?", handlerKey)
	}
	if aggregateType := strings.TrimSpace(filter.AggregateType); aggregateType != "" {
		query = query.Where("aggregate_type = ?", aggregateType)
	}
	if filter.AggregateID > 0 {
		query = query.Where("aggregate_id = ?", filter.AggregateID)
	}
	if filter.StartTime != nil {
		query = query.Where("created_at >= ?", *filter.StartTime)
	}
	if filter.EndTime != nil {
		query = query.Where("created_at <= ?", *filter.EndTime)
	}
	return query
}
