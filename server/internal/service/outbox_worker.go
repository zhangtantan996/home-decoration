package service

import (
	"context"
	"fmt"
	"log"
	"time"
)

type OutboxWorker struct {
	WorkerID string
	Service  *OutboxEventService
	Registry *OutboxHandlerRegistry
}

func NewOutboxWorker(workerID string) *OutboxWorker {
	return &OutboxWorker{
		WorkerID: workerID,
		Service:  &OutboxEventService{},
		Registry: NewOutboxHandlerRegistry(),
	}
}

func StartOutboxWorker(ctx context.Context, workerID string) {
	cfgSvc := &ConfigService{}
	_ = cfgSvc.InitDefaultConfigs()
	if !cfgSvc.GetOutboxWorkerEnabled() {
		log.Println("[Outbox] worker disabled by config")
		return
	}
	worker := NewOutboxWorker(workerID)
	pollInterval := cfgSvc.GetOutboxWorkerPollInterval()
	if pollInterval <= 0 {
		pollInterval = 5 * time.Second
	}
	go worker.Run(ctx, pollInterval)
	log.Printf("[Outbox] worker started: workerID=%s pollInterval=%s", workerID, pollInterval)
}

func (w *OutboxWorker) Run(ctx context.Context, pollInterval time.Duration) {
	if pollInterval <= 0 {
		pollInterval = 5 * time.Second
	}
	ticker := time.NewTicker(pollInterval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			log.Printf("[Outbox] worker stopped: workerID=%s", w.WorkerID)
			return
		default:
			w.ProcessOnce()
		}
		select {
		case <-ctx.Done():
			log.Printf("[Outbox] worker stopped: workerID=%s", w.WorkerID)
			return
		case <-ticker.C:
		}
	}
}

func (w *OutboxWorker) ProcessOnce() {
	if w == nil {
		return
	}
	cfgSvc := &ConfigService{}
	batchSize := cfgSvc.GetOutboxWorkerBatchSize()
	lockTTL := cfgSvc.GetOutboxWorkerLockTTL()
	if w.Service == nil {
		w.Service = &OutboxEventService{}
	}
	if w.Registry == nil {
		w.Registry = NewOutboxHandlerRegistry()
	}
	events, err := w.Service.ClaimBatch(w.WorkerID, batchSize, lockTTL)
	if err != nil {
		log.Printf("[Outbox] claim failed: workerID=%s error=%v", w.WorkerID, err)
		return
	}
	for i := range events {
		event := events[i]
		if err := w.Registry.Handle(event); err != nil {
			log.Printf("[Outbox] handler failed: eventID=%d eventType=%s handler=%s error=%v", event.ID, event.EventType, event.HandlerKey, err)
			_ = w.Service.MarkFailed(&event, err)
			continue
		}
		if err := w.Service.MarkSucceeded(&event); err != nil {
			log.Printf("[Outbox] mark succeeded failed: eventID=%d error=%v", event.ID, err)
		}
	}
}

func BuildOutboxWorkerID(prefix string) string {
	if prefix == "" {
		prefix = "api"
	}
	return fmt.Sprintf("%s-%d", prefix, time.Now().UnixNano())
}
