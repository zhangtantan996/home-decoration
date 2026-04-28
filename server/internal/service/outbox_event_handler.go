package service

import (
	"encoding/json"
	"errors"
	"fmt"
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	"strconv"
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
	registry.Register(OutboxHandlerSMS, OutboxHandlerFunc(handleOutboxSMS))
	registry.Register(OutboxHandlerStats, OutboxHandlerFunc(handleOutboxStats))
	registry.Register(OutboxHandlerGovernance, OutboxHandlerFunc(handleOutboxGovernance))
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

type outboxSMSPayload struct {
	Phone          string            `json:"phone"`
	UserID         uint64            `json:"userId"`
	ProviderUserID uint64            `json:"providerUserId"`
	Purpose        string            `json:"purpose"`
	TemplateKey    string            `json:"templateKey"`
	TemplateCode   string            `json:"templateCode"`
	Params         map[string]string `json:"params"`
	ClientIP       string            `json:"clientIp"`
}

func handleOutboxSMS(event model.OutboxEvent) error {
	var payload outboxSMSPayload
	if strings.TrimSpace(event.Payload) != "" {
		if err := json.Unmarshal([]byte(event.Payload), &payload); err != nil {
			return fmt.Errorf("解析短信 payload 失败: %w", err)
		}
	}
	if exists, err := smsAuditExistsForOutboxEvent(event.EventKey); err != nil {
		return err
	} else if exists {
		return nil
	}
	phone := strings.TrimSpace(payload.Phone)
	if phone == "" {
		phone = lookupOutboxSMSPhone(payload.UserID, payload.ProviderUserID)
	}
	purpose := SMSPurpose(firstNonBlank(payload.Purpose, event.EventType))
	templateCtx := SMSTemplateContext{
		Purpose:      purpose,
		RiskTier:     SMSRiskTierHigh,
		TemplateKey:  strings.TrimSpace(payload.TemplateKey),
		TemplateCode: strings.TrimSpace(payload.TemplateCode),
	}
	if phone == "" {
		logSMSAudit(event.EventKey, purpose, "", firstNonBlank(payload.ClientIP, "outbox"), templateCtx, SMSProviderResult{Provider: "outbox"}, "skipped_missing_phone", "MISSING_PHONE", "短信接收人手机号缺失")
		return nil
	}
	if templateCtx.TemplateCode == "" {
		logSMSAudit(event.EventKey, purpose, phone, firstNonBlank(payload.ClientIP, "outbox"), templateCtx, SMSProviderResult{Provider: "outbox"}, "skipped_missing_template", "MISSING_TEMPLATE", "短信模板未配置")
		return nil
	}
	provider, err := GetSMSProvider()
	if err != nil {
		logSMSAudit(event.EventKey, purpose, phone, firstNonBlank(payload.ClientIP, "outbox"), templateCtx, SMSProviderResult{Provider: "unknown"}, "send_failed", ExtractSMSProviderErrorCode(err), err.Error())
		return err
	}
	messageProvider, ok := provider.(SMSMessageProvider)
	if !ok {
		err := errors.New("短信 provider 不支持模板消息")
		logSMSAudit(event.EventKey, purpose, phone, firstNonBlank(payload.ClientIP, "outbox"), templateCtx, SMSProviderResult{Provider: "unknown"}, "send_failed", "PROVIDER_UNSUPPORTED", err.Error())
		return err
	}
	result, err := messageProvider.SendTemplateMessage(SMSTemplateMessageRequest{
		Phone:        phone,
		TemplateKey:  templateCtx.TemplateKey,
		TemplateCode: templateCtx.TemplateCode,
		Params:       payload.Params,
	})
	if err != nil {
		logSMSAudit(event.EventKey, purpose, phone, firstNonBlank(payload.ClientIP, "outbox"), templateCtx, result, "send_failed", ExtractSMSProviderErrorCode(err), err.Error())
		return err
	}
	logSMSAudit(event.EventKey, purpose, phone, firstNonBlank(payload.ClientIP, "outbox"), templateCtx, result, "sent", "", "")
	return nil
}

func smsAuditExistsForOutboxEvent(eventKey string) (bool, error) {
	eventKey = strings.TrimSpace(eventKey)
	if eventKey == "" {
		return false, nil
	}
	var count int64
	err := repository.DB.Model(&model.SMSAuditLog{}).Where("request_id = ?", trimToMax(eventKey, 64)).Count(&count).Error
	return count > 0, err
}

func lookupOutboxSMSPhone(userID, providerUserID uint64) string {
	targetUserID := firstNonZero(userID, providerUserID)
	if targetUserID == 0 || repository.DB == nil {
		return ""
	}
	var user model.User
	if err := repository.DB.Select("phone").First(&user, targetUserID).Error; err != nil {
		return ""
	}
	return strings.TrimSpace(user.Phone)
}

func handleOutboxStats(event model.OutboxEvent) error {
	if exists, err := auditExistsForOutboxEvent(event.EventKey); err != nil {
		return err
	} else if exists {
		return nil
	}
	return (&AuditLogService{}).CreateBusinessRecord(&CreateAuditRecordInput{
		OperatorType:  "system",
		OperationType: "outbox.stats.refresh",
		ResourceType:  event.AggregateType,
		ResourceID:    event.AggregateID,
		Result:        "success",
		Metadata: map[string]interface{}{
			"eventKey":      event.EventKey,
			"handlerKey":    event.HandlerKey,
			"eventType":     event.EventType,
			"aggregateType": event.AggregateType,
			"aggregateId":   event.AggregateID,
		},
	})
}

func handleOutboxGovernance(event model.OutboxEvent) error {
	providerID := resolveOutboxGovernanceProviderID(event)
	if providerID == 0 {
		return handleOutboxGovernanceAudit(event, "skipped_no_provider", nil)
	}
	summary := (&ProviderGovernanceService{}).BuildSummary(providerID)
	if summary == nil {
		return handleOutboxGovernanceAudit(event, "skipped_no_summary", map[string]interface{}{"providerId": providerID})
	}
	metadata := map[string]interface{}{
		"providerId":        providerID,
		"governanceTier":    summary.GovernanceTier,
		"riskFlags":         summary.RiskFlags,
		"recommendedAction": summary.RecommendedAction,
	}
	if len(summary.RiskFlags) > 0 {
		_, _, err := (&SystemAlertService{}).UpsertAlert(&CreateSystemAlertInput{
			Type:        SystemAlertTypeProviderGovernanceRisk,
			Level:       "medium",
			Scope:       fmt.Sprintf("服务商#%d", providerID),
			Description: fmt.Sprintf("服务商治理进入风险观察：%s", strings.Join(summary.RiskFlags, "、")),
			ActionURL:   fmt.Sprintf("/providers/%d", providerID),
		})
		if err != nil {
			return err
		}
	}
	return handleOutboxGovernanceAudit(event, "success", metadata)
}

func handleOutboxGovernanceAudit(event model.OutboxEvent, result string, metadata map[string]interface{}) error {
	if exists, err := auditExistsForOutboxEvent(event.EventKey); err != nil {
		return err
	} else if exists {
		return nil
	}
	if metadata == nil {
		metadata = map[string]interface{}{}
	}
	metadata["eventKey"] = event.EventKey
	metadata["handlerKey"] = event.HandlerKey
	metadata["eventType"] = event.EventType
	return (&AuditLogService{}).CreateBusinessRecord(&CreateAuditRecordInput{
		OperatorType:  "system",
		OperationType: "outbox.governance.refresh",
		ResourceType:  event.AggregateType,
		ResourceID:    event.AggregateID,
		Result:        result,
		Metadata:      metadata,
	})
}

func resolveOutboxGovernanceProviderID(event model.OutboxEvent) uint64 {
	payload := map[string]interface{}{}
	if json.Valid([]byte(event.Payload)) {
		_ = json.Unmarshal([]byte(event.Payload), &payload)
	}
	for _, key := range []string{"providerId", "providerID", "awardedProviderId"} {
		if id := uint64FromOutboxPayload(payload[key]); id > 0 {
			return id
		}
	}
	if event.AggregateType == "project" && event.AggregateID > 0 {
		var project model.Project
		if err := repository.DB.Select("provider_id", "construction_provider_id").First(&project, event.AggregateID).Error; err == nil {
			return effectiveProjectProviderID(&project)
		}
	}
	return 0
}

func uint64FromOutboxPayload(value interface{}) uint64 {
	switch typed := value.(type) {
	case float64:
		if typed > 0 {
			return uint64(typed)
		}
	case int:
		if typed > 0 {
			return uint64(typed)
		}
	case uint64:
		return typed
	case json.Number:
		parsed, _ := typed.Int64()
		if parsed > 0 {
			return uint64(parsed)
		}
	case string:
		parsed, _ := strconv.ParseUint(strings.TrimSpace(typed), 10, 64)
		return parsed
	}
	return 0
}
