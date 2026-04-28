package service

import (
	"testing"
	"time"

	"home-decoration-server/internal/model"
)

func TestOutboxNotificationHandlerIsIdempotentByEventKey(t *testing.T) {
	db := setupOutboxEventTestDB(t)
	event := model.OutboxEvent{
		EventType:     OutboxEventPaymentPaid,
		AggregateType: "payment_order",
		AggregateID:   1,
		HandlerKey:    OutboxHandlerNotification,
		EventKey:      "payment.paid:1:notification",
		Payload:       `{"userId":1,"userType":"user","title":"支付成功","content":"款项已确认","type":"payment.paid","relatedId":1,"relatedType":"payment","actionUrl":"/payments/1"}`,
		Status:        model.OutboxStatusProcessing,
		MaxRetries:    3,
		NextRetryAt:   time.Now(),
	}

	if err := handleOutboxNotification(event); err != nil {
		t.Fatalf("handle notification first: %v", err)
	}
	if err := handleOutboxNotification(event); err != nil {
		t.Fatalf("handle notification duplicate: %v", err)
	}
	var count int64
	if err := db.Model(&model.Notification{}).Count(&count).Error; err != nil {
		t.Fatalf("count notifications: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected one notification, got %d", count)
	}
}

func TestOutboxWorkerContinuesAfterHandlerFailure(t *testing.T) {
	db := setupOutboxEventTestDB(t)
	now := time.Now()
	events := []model.OutboxEvent{
		{EventType: OutboxEventPaymentPaid, AggregateType: "payment_order", AggregateID: 1, HandlerKey: "missing", EventKey: "bad", Payload: `{}`, Status: model.OutboxStatusPending, MaxRetries: 1, NextRetryAt: now},
		{EventType: OutboxEventPaymentPaid, AggregateType: "payment_order", AggregateID: 2, HandlerKey: OutboxHandlerAudit, EventKey: "good", Payload: `{"operationType":"payment.paid","resourceType":"payment_order","resourceId":2}`, Status: model.OutboxStatusPending, MaxRetries: 3, NextRetryAt: now},
	}
	if err := db.Create(&events).Error; err != nil {
		t.Fatalf("seed events: %v", err)
	}

	worker := NewOutboxWorker("test-worker")
	worker.ProcessOnce()

	var failed model.OutboxEvent
	if err := db.Where("event_key = ?", "bad").First(&failed).Error; err != nil {
		t.Fatalf("load failed event: %v", err)
	}
	if failed.Status != model.OutboxStatusDead {
		t.Fatalf("expected failed event dead, got %s", failed.Status)
	}
	var succeeded model.OutboxEvent
	if err := db.Where("event_key = ?", "good").First(&succeeded).Error; err != nil {
		t.Fatalf("load succeeded event: %v", err)
	}
	if succeeded.Status != model.OutboxStatusSucceeded {
		t.Fatalf("expected good event succeeded, got %s", succeeded.Status)
	}
}
