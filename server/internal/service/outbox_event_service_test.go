package service

import (
	"errors"
	"fmt"
	"testing"
	"time"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"

	gormsqlite "gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupOutboxEventTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(gormsqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite db: %v", err)
	}
	if err := db.AutoMigrate(
		&model.OutboxEvent{},
		&model.Notification{},
		&model.RiskWarning{},
		&model.AuditLog{},
		&model.SMSAuditLog{},
		&model.User{},
		&model.Provider{},
		&model.Booking{},
		&model.Proposal{},
		&model.Project{},
		&model.Milestone{},
		&model.ProviderCase{},
		&model.ProviderReview{},
		&model.RefundApplication{},
		&model.Complaint{},
		&model.ProjectAudit{},
	); err != nil {
		t.Fatalf("migrate sqlite db: %v", err)
	}
	previousDB := repository.DB
	repository.DB = db
	t.Cleanup(func() {
		repository.DB = previousDB
	})
	return db
}

func TestOutboxEnqueueIsIdempotentByEventKeyAndHandler(t *testing.T) {
	db := setupOutboxEventTestDB(t)
	svc := &OutboxEventService{}

	err := db.Transaction(func(tx *gorm.DB) error {
		input := OutboxEventInput{EventType: OutboxEventPaymentPaid, AggregateType: "payment_order", AggregateID: 1001, HandlerKey: OutboxHandlerNotification, EventKey: "payment.paid:1001:notification", Payload: map[string]any{"paymentId": 1001}}
		if err := svc.EnqueueTx(tx, input); err != nil {
			return err
		}
		return svc.EnqueueTx(tx, input)
	})
	if err != nil {
		t.Fatalf("enqueue duplicate: %v", err)
	}

	var count int64
	if err := db.Model(&model.OutboxEvent{}).Count(&count).Error; err != nil {
		t.Fatalf("count events: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected one idempotent event, got %d", count)
	}
}

func TestOutboxClaimBatchSkipsLockedEvents(t *testing.T) {
	db := setupOutboxEventTestDB(t)
	svc := &OutboxEventService{}
	now := time.Now()
	items := []model.OutboxEvent{
		{EventType: OutboxEventPaymentPaid, AggregateType: "payment_order", AggregateID: 1, HandlerKey: OutboxHandlerNotification, EventKey: "a", Payload: `{}`, Status: model.OutboxStatusPending, MaxRetries: 3, NextRetryAt: now},
		{EventType: OutboxEventPaymentPaid, AggregateType: "payment_order", AggregateID: 2, HandlerKey: OutboxHandlerNotification, EventKey: "b", Payload: `{}`, Status: model.OutboxStatusPending, MaxRetries: 3, NextRetryAt: now, LockedBy: "other", LockedUntil: ptrOutboxTime(now.Add(time.Minute))},
	}
	if err := db.Create(&items).Error; err != nil {
		t.Fatalf("seed events: %v", err)
	}

	claimed, err := svc.ClaimBatch("worker-1", 10, time.Minute)
	if err != nil {
		t.Fatalf("claim batch: %v", err)
	}
	if len(claimed) != 1 || claimed[0].EventKey != "a" || claimed[0].Status != model.OutboxStatusProcessing {
		t.Fatalf("unexpected claimed events: %+v", claimed)
	}
}

func TestOutboxMarkFailedMovesToDeadAfterMaxRetries(t *testing.T) {
	db := setupOutboxEventTestDB(t)
	svc := &OutboxEventService{}
	event := model.OutboxEvent{EventType: OutboxEventPaymentPaid, AggregateType: "payment_order", AggregateID: 1, HandlerKey: OutboxHandlerNotification, EventKey: "dead", Payload: `{}`, Status: model.OutboxStatusProcessing, RetryCount: 2, MaxRetries: 3, LockedBy: "worker", LockedUntil: ptrOutboxTime(time.Now().Add(time.Minute))}
	if err := db.Create(&event).Error; err != nil {
		t.Fatalf("seed event: %v", err)
	}

	if err := svc.MarkFailed(&event, errors.New("boom")); err != nil {
		t.Fatalf("mark failed: %v", err)
	}
	var got model.OutboxEvent
	if err := db.First(&got, event.ID).Error; err != nil {
		t.Fatalf("load event: %v", err)
	}
	if got.Status != model.OutboxStatusDead || got.RetryCount != 3 || got.LastError == "" {
		t.Fatalf("expected dead event after max retries, got %+v", got)
	}
}

func TestOutboxPublishersCoverRetainedFirstWaveEvents(t *testing.T) {
	db := setupOutboxEventTestDB(t)

	err := db.Transaction(func(tx *gorm.DB) error {
		if err := enqueuePaymentClosedOutboxTx(tx, &model.PaymentOrder{Base: model.Base{ID: 11}, BizType: model.PaymentBizTypeOrder, BizID: 22, PayerUserID: 41, Amount: 88, AmountCent: 8800}, "expired"); err != nil {
			return err
		}
		if err := enqueueRefundCreatedOutboxTx(tx, &model.RefundApplication{Base: model.Base{ID: 12}, BookingID: 21, ProjectID: 31, UserID: 41, RequestedAmount: 66, Reason: "质量问题"}, 51); err != nil {
			return err
		}
		if err := enqueueRefundFailedOutboxTx(tx, &model.RefundOrder{Base: model.Base{ID: 13}, RefundApplicationID: 12, PaymentOrderID: 11, Amount: 12.5, AmountCent: 1250, FailureReason: "channel rejected"}, 41, 51); err != nil {
			return err
		}
		if err := enqueueProjectCompletionSubmittedOutboxTx(tx, &model.Project{Base: model.Base{ID: 14}, OwnerID: 42}, 52); err != nil {
			return err
		}
		if err := enqueueProjectAcceptedOutboxTx(tx, &model.Project{Base: model.Base{ID: 15}, OwnerID: 43}, 53, 61, 71); err != nil {
			return err
		}
		return enqueueProjectDisputeCreatedOutboxTx(tx, &model.Project{Base: model.Base{ID: 16}, OwnerID: 44}, 54, 62, "争议说明")
	})
	if err != nil {
		t.Fatalf("enqueue first wave events: %v", err)
	}

	expectOutboxHandlers(t, OutboxEventPaymentClosed, []string{OutboxHandlerNotification, OutboxHandlerAudit, OutboxHandlerStats})
	expectOutboxHandlers(t, OutboxEventRefundCreated, []string{OutboxHandlerNotification, OutboxHandlerAudit, OutboxHandlerStats})
	expectOutboxHandlers(t, OutboxEventRefundFailed, []string{OutboxHandlerNotification, OutboxHandlerAudit, OutboxHandlerStats})
	expectOutboxHandlers(t, OutboxEventProjectCompletionSubmitted, []string{OutboxHandlerNotification, OutboxHandlerAudit, OutboxHandlerGovernance})
	expectOutboxHandlers(t, OutboxEventProjectAccepted, []string{OutboxHandlerNotification, OutboxHandlerAudit, OutboxHandlerGovernance})
	expectOutboxHandlers(t, OutboxEventProjectDisputeCreated, []string{OutboxHandlerNotification, OutboxHandlerAudit, OutboxHandlerGovernance, OutboxHandlerSMS})
}

func expectOutboxHandlers(t *testing.T, eventType string, handlers []string) {
	t.Helper()
	for _, handler := range handlers {
		var count int64
		if err := repository.DB.Model(&model.OutboxEvent{}).Where("event_type = ? AND handler_key = ?", eventType, handler).Count(&count).Error; err != nil {
			t.Fatalf("count %s/%s: %v", eventType, handler, err)
		}
		if count == 0 {
			t.Fatalf("expected %s handler for %s", handler, eventType)
		}
	}
	var total int64
	if err := repository.DB.Model(&model.OutboxEvent{}).Where("event_type = ?", eventType).Count(&total).Error; err != nil {
		t.Fatalf("count %s: %v", eventType, err)
	}
	if total < int64(len(handlers)) {
		t.Fatalf("expected at least %d handlers for %s, got %d", len(handlers), eventType, total)
	}
	for _, handler := range handlers {
		var duplicate int64
		prefix := fmt.Sprintf("%s%%", eventType)
		if err := repository.DB.Model(&model.OutboxEvent{}).Where("event_type = ? AND handler_key = ? AND event_key LIKE ?", eventType, handler, prefix).Count(&duplicate).Error; err != nil {
			t.Fatalf("count keyed %s/%s: %v", eventType, handler, err)
		}
		if duplicate == 0 {
			t.Fatalf("expected idempotency key for %s/%s to include event type", eventType, handler)
		}
	}
}

func ptrOutboxTime(t time.Time) *time.Time { return &t }
