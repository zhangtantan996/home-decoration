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

func TestOutboxSMSHandlerWritesAuditIdempotently(t *testing.T) {
	db := setupOutboxEventTestDB(t)
	event := model.OutboxEvent{
		EventType:     OutboxEventProjectDisputeCreated,
		AggregateType: "project",
		AggregateID:   16,
		HandlerKey:    OutboxHandlerSMS,
		EventKey:      "project.dispute.created:16:1:sms",
		Payload:       `{"phone":"13800138000","purpose":"project_dispute","templateKey":"risk.project_dispute","templateCode":"SMS_TPL_RISK","params":{"projectId":"16"}}`,
		Status:        model.OutboxStatusProcessing,
		MaxRetries:    3,
		NextRetryAt:   time.Now(),
	}

	if err := handleOutboxSMS(event); err != nil {
		t.Fatalf("handle sms first: %v", err)
	}
	if err := handleOutboxSMS(event); err != nil {
		t.Fatalf("handle sms duplicate: %v", err)
	}
	var count int64
	if err := db.Model(&model.SMSAuditLog{}).Where("request_id = ?", event.EventKey).Count(&count).Error; err != nil {
		t.Fatalf("count sms audits: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected one sms audit, got %d", count)
	}
}

func TestOutboxStatsHandlerWritesRefreshAudit(t *testing.T) {
	db := setupOutboxEventTestDB(t)
	event := model.OutboxEvent{
		EventType:     OutboxEventPaymentPaid,
		AggregateType: "payment_order",
		AggregateID:   1001,
		HandlerKey:    OutboxHandlerStats,
		EventKey:      "payment.paid:1001:stats",
		Payload:       `{"paymentId":1001,"projectId":2001}`,
		Status:        model.OutboxStatusProcessing,
		MaxRetries:    3,
		NextRetryAt:   time.Now(),
	}

	if err := handleOutboxStats(event); err != nil {
		t.Fatalf("handle stats: %v", err)
	}
	var count int64
	if err := db.Model(&model.AuditLog{}).Where("operation_type = ? AND metadata LIKE ?", "outbox.stats.refresh", "%payment.paid:1001:stats%").Count(&count).Error; err != nil {
		t.Fatalf("count stats audits: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected one stats refresh audit, got %d", count)
	}
}

func TestOutboxGovernanceHandlerCreatesProviderRiskAlert(t *testing.T) {
	db := setupOutboxEventTestDB(t)
	provider := model.Provider{Base: model.Base{ID: 91}, UserID: 191, ProviderType: 3, Status: 1}
	bookings := []model.Booking{
		{Base: model.Base{ID: 1}, ProviderID: provider.ID, Status: 1},
		{Base: model.Base{ID: 2}, ProviderID: provider.ID, Status: 1},
		{Base: model.Base{ID: 3}, ProviderID: provider.ID, Status: 1},
	}
	if err := db.Create(&provider).Error; err != nil {
		t.Fatalf("seed provider: %v", err)
	}
	if err := db.Create(&bookings).Error; err != nil {
		t.Fatalf("seed bookings: %v", err)
	}
	event := model.OutboxEvent{
		EventType:     OutboxEventQuoteSubmitted,
		AggregateType: "quote_list",
		AggregateID:   301,
		HandlerKey:    OutboxHandlerGovernance,
		EventKey:      "quote.submitted:301:governance",
		Payload:       `{"providerId":91}`,
		Status:        model.OutboxStatusProcessing,
		MaxRetries:    3,
		NextRetryAt:   time.Now(),
	}

	if err := handleOutboxGovernance(event); err != nil {
		t.Fatalf("handle governance: %v", err)
	}
	var warning model.RiskWarning
	if err := db.Where("type = ? AND project_name = ?", SystemAlertTypeProviderGovernanceRisk, "服务商#91").First(&warning).Error; err != nil {
		t.Fatalf("expected provider governance risk warning: %v", err)
	}
	if warning.Level != "medium" {
		t.Fatalf("expected medium governance warning, got %+v", warning)
	}
}
