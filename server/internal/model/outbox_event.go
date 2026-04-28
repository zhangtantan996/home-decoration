package model

import "time"

const (
	OutboxStatusPending    = "pending"
	OutboxStatusProcessing = "processing"
	OutboxStatusSucceeded  = "succeeded"
	OutboxStatusFailed     = "failed"
	OutboxStatusDead       = "dead"
	OutboxStatusIgnored    = "ignored"
)

// OutboxEvent is the durable side-effect task record for notifications, audits, stats and governance refreshes.
type OutboxEvent struct {
	Base
	EventType     string     `json:"eventType" gorm:"size:80;not null;index:idx_outbox_events_event_type"`
	AggregateType string     `json:"aggregateType" gorm:"size:80;not null;index:idx_outbox_events_aggregate"`
	AggregateID   uint64     `json:"aggregateId" gorm:"not null;index:idx_outbox_events_aggregate"`
	HandlerKey    string     `json:"handlerKey" gorm:"size:40;not null;uniqueIndex:idx_outbox_events_event_handler;index:idx_outbox_events_handler"`
	EventKey      string     `json:"eventKey" gorm:"size:160;not null;uniqueIndex:idx_outbox_events_event_handler"`
	Payload       string     `json:"payload" gorm:"type:jsonb;not null;default:'{}'"`
	Status        string     `json:"status" gorm:"size:20;not null;default:'pending';index:idx_outbox_events_status_retry"`
	RetryCount    int        `json:"retryCount" gorm:"not null;default:0"`
	MaxRetries    int        `json:"maxRetries" gorm:"not null;default:3"`
	NextRetryAt   time.Time  `json:"nextRetryAt" gorm:"not null;index:idx_outbox_events_status_retry"`
	LockedBy      string     `json:"lockedBy" gorm:"size:80;index"`
	LockedUntil   *time.Time `json:"lockedUntil" gorm:"index"`
	ProcessedAt   *time.Time `json:"processedAt"`
	LastError     string     `json:"lastError" gorm:"type:text"`
	IgnoredBy     uint64     `json:"ignoredBy" gorm:"default:0"`
	IgnoredReason string     `json:"ignoredReason" gorm:"type:text"`
	IgnoredAt     *time.Time `json:"ignoredAt"`
}

func (OutboxEvent) TableName() string { return "outbox_events" }
