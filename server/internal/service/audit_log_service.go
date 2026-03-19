package service

import (
	"bytes"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"

	"gorm.io/gorm"
)

const (
	auditRecordKindRequest  = "request"
	auditRecordKindBusiness = "business"
)

type CreateAuditRecordInput struct {
	RecordKind    string
	OperatorType  string
	OperatorID    uint64
	Action        string
	OperationType string
	Resource      string
	ResourceType  string
	ResourceID    uint64
	Reason        string
	Result        string
	RequestBody   string
	BeforeState   interface{}
	AfterState    interface{}
	Metadata      map[string]interface{}
	ClientIP      string
	UserAgent     string
	StatusCode    int
	Duration      int64
}

type AdminAuditLogFilter struct {
	RecordKind    string
	OperationType string
	ResourceType  string
	StartDate     string
	EndDate       string
	Page          int
	PageSize      int
}

type AdminAuditLogItem struct {
	ID            uint64                 `json:"id"`
	RecordKind    string                 `json:"recordKind"`
	OperatorType  string                 `json:"operatorType"`
	OperatorID    uint64                 `json:"operatorId"`
	Action        string                 `json:"action"`
	OperationType string                 `json:"operationType"`
	Resource      string                 `json:"resource"`
	ResourceType  string                 `json:"resourceType"`
	ResourceID    uint64                 `json:"resourceId"`
	Reason        string                 `json:"reason"`
	Result        string                 `json:"result"`
	RequestBody   string                 `json:"requestBody"`
	BeforeState   map[string]interface{} `json:"beforeState"`
	AfterState    map[string]interface{} `json:"afterState"`
	Metadata      map[string]interface{} `json:"metadata"`
	ClientIP      string                 `json:"clientIp"`
	UserAgent     string                 `json:"userAgent"`
	StatusCode    int                    `json:"statusCode"`
	Duration      int64                  `json:"duration"`
	CreatedAt     time.Time              `json:"createdAt"`
}

type AuditLogService struct{}

func (s *AuditLogService) CreateRecord(input *CreateAuditRecordInput) error {
	return s.CreateRecordTx(repository.DB, input)
}

func (s *AuditLogService) CreateRecordTx(tx *gorm.DB, input *CreateAuditRecordInput) error {
	if input == nil {
		return nil
	}
	if tx == nil {
		tx = repository.DB
	}

	recordKind := strings.TrimSpace(input.RecordKind)
	if recordKind == "" {
		recordKind = auditRecordKindBusiness
	}

	entry := &model.AuditLog{
		RecordKind:    recordKind,
		OperatorType:  strings.TrimSpace(input.OperatorType),
		OperatorID:    input.OperatorID,
		Action:        strings.TrimSpace(input.Action),
		OperationType: strings.TrimSpace(input.OperationType),
		Resource:      normalizeAuditResource(input.Resource, input.ResourceType),
		ResourceType:  normalizeAuditResourceType(input.ResourceType, input.Resource),
		ResourceID:    input.ResourceID,
		Reason:        strings.TrimSpace(input.Reason),
		Result:        normalizeAuditResult(input.Result, input.StatusCode),
		RequestBody:   strings.TrimSpace(input.RequestBody),
		BeforeState:   marshalAuditJSON(input.BeforeState),
		AfterState:    marshalAuditJSON(input.AfterState),
		Metadata:      marshalAuditJSON(input.Metadata),
		ClientIP:      strings.TrimSpace(input.ClientIP),
		UserAgent:     strings.TrimSpace(input.UserAgent),
		StatusCode:    input.StatusCode,
		Duration:      input.Duration,
	}

	return tx.Create(entry).Error
}

func (s *AuditLogService) CreateBusinessRecord(input *CreateAuditRecordInput) error {
	return s.CreateBusinessRecordTx(repository.DB, input)
}

func (s *AuditLogService) CreateBusinessRecordTx(tx *gorm.DB, input *CreateAuditRecordInput) error {
	if input == nil {
		return nil
	}
	cloned := *input
	cloned.RecordKind = auditRecordKindBusiness
	return s.CreateRecordTx(tx, &cloned)
}

func (s *AuditLogService) ListAdminAuditLogs(filter AdminAuditLogFilter) ([]AdminAuditLogItem, int64, error) {
	page := filter.Page
	if page <= 0 {
		page = 1
	}
	pageSize := filter.PageSize
	if pageSize <= 0 {
		pageSize = 20
	}

	query := buildAdminAuditLogQuery(repository.DB.Model(&model.AuditLog{}), filter)

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var logs []model.AuditLog
	if err := query.Order("created_at DESC").Offset((page - 1) * pageSize).Limit(pageSize).Find(&logs).Error; err != nil {
		return nil, 0, err
	}

	return buildAdminAuditLogItems(logs), total, nil
}

func (s *AuditLogService) ExportAdminAuditLogs(filter AdminAuditLogFilter) ([]byte, error) {
	filter.Page = 1
	filter.PageSize = 5000

	query := buildAdminAuditLogQuery(repository.DB.Model(&model.AuditLog{}), filter)

	var logs []model.AuditLog
	if err := query.Order("created_at DESC").Find(&logs).Error; err != nil {
		return nil, err
	}

	var buffer bytes.Buffer
	writer := csv.NewWriter(&buffer)
	if err := writer.Write([]string{
		"id", "record_kind", "operator_type", "operator_id", "operation_type",
		"resource_type", "resource_id", "reason", "result", "created_at",
		"before_state", "after_state", "metadata",
	}); err != nil {
		return nil, err
	}

	for _, log := range logs {
		row := []string{
			fmt.Sprintf("%d", log.ID),
			log.RecordKind,
			log.OperatorType,
			fmt.Sprintf("%d", log.OperatorID),
			log.OperationType,
			log.ResourceType,
			fmt.Sprintf("%d", log.ResourceID),
			log.Reason,
			log.Result,
			log.CreatedAt.Format(time.RFC3339),
			log.BeforeState,
			log.AfterState,
			log.Metadata,
		}
		if err := writer.Write(row); err != nil {
			return nil, err
		}
	}
	writer.Flush()
	if err := writer.Error(); err != nil {
		return nil, err
	}

	return buffer.Bytes(), nil
}

func buildAdminAuditLogQuery(query *gorm.DB, filter AdminAuditLogFilter) *gorm.DB {
	recordKind := strings.TrimSpace(filter.RecordKind)
	if recordKind == "" {
		recordKind = auditRecordKindBusiness
	}
	query = query.Where("record_kind = ?", recordKind)

	if operationType := strings.TrimSpace(filter.OperationType); operationType != "" {
		query = query.Where("operation_type = ?", operationType)
	}
	if resourceType := strings.TrimSpace(filter.ResourceType); resourceType != "" {
		query = query.Where("resource_type = ?", resourceType)
	}

	if startAt, ok := parseAuditFilterTime(filter.StartDate, false); ok {
		query = query.Where("created_at >= ?", startAt)
	}
	if endAt, ok := parseAuditFilterTime(filter.EndDate, true); ok {
		query = query.Where("created_at < ?", endAt)
	}

	return query
}

func buildAdminAuditLogItems(logs []model.AuditLog) []AdminAuditLogItem {
	items := make([]AdminAuditLogItem, 0, len(logs))
	for _, log := range logs {
		items = append(items, AdminAuditLogItem{
			ID:            log.ID,
			RecordKind:    log.RecordKind,
			OperatorType:  log.OperatorType,
			OperatorID:    log.OperatorID,
			Action:        log.Action,
			OperationType: log.OperationType,
			Resource:      log.Resource,
			ResourceType:  log.ResourceType,
			ResourceID:    log.ResourceID,
			Reason:        log.Reason,
			Result:        log.Result,
			RequestBody:   log.RequestBody,
			BeforeState:   parseAuditJSON(log.BeforeState),
			AfterState:    parseAuditJSON(log.AfterState),
			Metadata:      parseAuditJSON(log.Metadata),
			ClientIP:      log.ClientIP,
			UserAgent:     log.UserAgent,
			StatusCode:    log.StatusCode,
			Duration:      log.Duration,
			CreatedAt:     log.CreatedAt,
		})
	}
	return items
}

func marshalAuditJSON(value interface{}) string {
	if value == nil {
		return "{}"
	}

	switch typed := value.(type) {
	case string:
		trimmed := strings.TrimSpace(typed)
		if trimmed == "" {
			return "{}"
		}
		if json.Valid([]byte(trimmed)) {
			return trimmed
		}
	case map[string]interface{}:
		if len(typed) == 0 {
			return "{}"
		}
	}

	payload, err := json.Marshal(value)
	if err != nil || string(payload) == "null" {
		return "{}"
	}
	return string(payload)
}

func parseAuditJSON(raw string) map[string]interface{} {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return map[string]interface{}{}
	}
	var result map[string]interface{}
	if err := json.Unmarshal([]byte(trimmed), &result); err != nil || result == nil {
		return map[string]interface{}{}
	}
	return result
}

func parseAuditFilterTime(raw string, endOfDay bool) (time.Time, bool) {
	value := strings.TrimSpace(raw)
	if value == "" {
		return time.Time{}, false
	}
	layouts := []string{
		time.RFC3339,
		"2006-01-02 15:04:05",
		"2006-01-02",
	}
	for _, layout := range layouts {
		if parsed, err := time.ParseInLocation(layout, value, time.Local); err == nil {
			if layout == "2006-01-02" && endOfDay {
				return parsed.Add(24 * time.Hour), true
			}
			return parsed, true
		}
	}
	return time.Time{}, false
}

func normalizeAuditResource(resource, resourceType string) string {
	resource = strings.TrimSpace(resource)
	if resource != "" {
		return resource
	}
	return strings.TrimSpace(resourceType)
}

func normalizeAuditResourceType(resourceType, resource string) string {
	resourceType = strings.TrimSpace(resourceType)
	if resourceType != "" {
		return resourceType
	}
	return strings.TrimSpace(resource)
}

func normalizeAuditResult(result string, statusCode int) string {
	result = strings.TrimSpace(result)
	if result != "" {
		return result
	}
	if statusCode >= 500 {
		return "error"
	}
	if statusCode >= 400 {
		return "rejected"
	}
	if statusCode > 0 {
		return "success"
	}
	return ""
}
