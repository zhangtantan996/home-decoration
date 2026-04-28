package handler

import (
	"encoding/json"
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/service"
	"home-decoration-server/pkg/response"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

type adminOutboxEventDTO struct {
	ID            uint64                 `json:"id"`
	EventType     string                 `json:"eventType"`
	AggregateType string                 `json:"aggregateType"`
	AggregateID   uint64                 `json:"aggregateId"`
	HandlerKey    string                 `json:"handlerKey"`
	EventKey      string                 `json:"eventKey"`
	Payload       map[string]interface{} `json:"payload,omitempty"`
	Status        string                 `json:"status"`
	RetryCount    int                    `json:"retryCount"`
	MaxRetries    int                    `json:"maxRetries"`
	NextRetryAt   time.Time              `json:"nextRetryAt"`
	LockedBy      string                 `json:"lockedBy,omitempty"`
	LockedUntil   *time.Time             `json:"lockedUntil,omitempty"`
	ProcessedAt   *time.Time             `json:"processedAt,omitempty"`
	LastError     string                 `json:"lastError,omitempty"`
	IgnoredBy     uint64                 `json:"ignoredBy,omitempty"`
	IgnoredReason string                 `json:"ignoredReason,omitempty"`
	IgnoredAt     *time.Time             `json:"ignoredAt,omitempty"`
	CreatedAt     time.Time              `json:"createdAt"`
	UpdatedAt     time.Time              `json:"updatedAt"`
}

func AdminListOutboxEvents(c *gin.Context) {
	filter := service.ListOutboxEventsFilter{
		Status:        c.Query("status"),
		EventType:     c.Query("eventType"),
		HandlerKey:    c.Query("handlerKey"),
		AggregateType: c.Query("aggregateType"),
		Page:          parseInt(c.Query("page"), 1),
		PageSize:      parseInt(c.Query("pageSize"), 20),
	}
	if id, err := strconv.ParseUint(strings.TrimSpace(c.Query("aggregateId")), 10, 64); err == nil {
		filter.AggregateID = id
	}
	filter.StartTime = parseAdminOutboxTime(c.Query("startTime"))
	filter.EndTime = parseAdminOutboxTime(c.Query("endTime"))

	events, total, err := (&service.OutboxEventService{}).List(filter)
	if err != nil {
		response.Error(c, 500, "事件任务列表加载失败")
		return
	}
	items := make([]adminOutboxEventDTO, 0, len(events))
	for _, event := range events {
		items = append(items, buildAdminOutboxEventDTO(event, false))
	}
	response.Success(c, gin.H{"list": items, "total": total, "page": filter.Page, "pageSize": filter.PageSize})
}

func AdminGetOutboxEvent(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil || id == 0 {
		response.Error(c, 400, "事件ID无效")
		return
	}
	event, err := (&service.OutboxEventService{}).GetByID(id)
	if err != nil {
		response.Error(c, 404, "事件任务不存在")
		return
	}
	response.Success(c, buildAdminOutboxEventDTO(*event, true))
}

func AdminRetryOutboxEvent(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil || id == 0 {
		response.Error(c, 400, "事件ID无效")
		return
	}
	if err := (&service.OutboxEventService{}).RetryEvent(id); err != nil {
		response.Error(c, 400, "事件重试失败")
		return
	}
	response.Success(c, gin.H{"message": "已重新加入待处理队列"})
}

func AdminIgnoreOutboxEvent(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil || id == 0 {
		response.Error(c, 400, "事件ID无效")
		return
	}
	var input struct {
		Reason string `json:"reason" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		response.Error(c, 400, "请填写忽略原因")
		return
	}
	if err := (&service.OutboxEventService{}).MarkIgnored(id, c.GetUint64("admin_id"), input.Reason); err != nil {
		response.Error(c, 400, err.Error())
		return
	}
	response.Success(c, gin.H{"message": "事件已忽略"})
}

func buildAdminOutboxEventDTO(event model.OutboxEvent, includePayload bool) adminOutboxEventDTO {
	dto := adminOutboxEventDTO{
		ID:            event.ID,
		EventType:     event.EventType,
		AggregateType: event.AggregateType,
		AggregateID:   event.AggregateID,
		HandlerKey:    event.HandlerKey,
		EventKey:      event.EventKey,
		Status:        event.Status,
		RetryCount:    event.RetryCount,
		MaxRetries:    event.MaxRetries,
		NextRetryAt:   event.NextRetryAt,
		LockedBy:      event.LockedBy,
		LockedUntil:   event.LockedUntil,
		ProcessedAt:   event.ProcessedAt,
		LastError:     sanitizeAdminOutboxText(event.LastError),
		IgnoredBy:     event.IgnoredBy,
		IgnoredReason: sanitizeAdminOutboxText(event.IgnoredReason),
		IgnoredAt:     event.IgnoredAt,
		CreatedAt:     event.CreatedAt,
		UpdatedAt:     event.UpdatedAt,
	}
	if includePayload {
		payload := map[string]interface{}{}
		if json.Valid([]byte(event.Payload)) {
			_ = json.Unmarshal([]byte(event.Payload), &payload)
		}
		dto.Payload = sanitizeAdminOutboxPayload(payload)
	}
	return dto
}

func parseAdminOutboxTime(raw string) *time.Time {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil
	}
	for _, layout := range []string{time.RFC3339, "2006-01-02 15:04:05", "2006-01-02"} {
		if parsed, err := time.Parse(layout, raw); err == nil {
			return &parsed
		}
	}
	return nil
}

func sanitizeAdminOutboxPayload(payload map[string]interface{}) map[string]interface{} {
	if payload == nil {
		return map[string]interface{}{}
	}
	blocked := map[string]struct{}{
		"sql": {}, "stack": {}, "stackTrace": {}, "dsn": {}, "password": {}, "secret": {}, "token": {}, "jwt": {}, "accessKey": {}, "connectionString": {},
	}
	result := make(map[string]interface{}, len(payload))
	for key, value := range payload {
		if _, ok := blocked[key]; ok {
			continue
		}
		if text, ok := value.(string); ok {
			result[key] = sanitizeAdminOutboxText(text)
			continue
		}
		result[key] = value
	}
	return result
}

func sanitizeAdminOutboxText(text string) string {
	text = strings.TrimSpace(text)
	if text == "" {
		return ""
	}
	lower := strings.ToLower(text)
	for _, marker := range []string{"select ", "insert ", "update ", "delete ", "panic:", "stack trace", "postgres://", "password=", "jwt"} {
		if strings.Contains(lower, marker) {
			return "处理失败，请查看服务日志"
		}
	}
	if len(text) > 240 {
		return text[:240]
	}
	return text
}
