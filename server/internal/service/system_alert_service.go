package service

import (
	"errors"
	"fmt"
	"log"
	"strconv"
	"strings"
	"time"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"

	"gorm.io/gorm"
)

const (
	SystemAlertTypeBackupFailure                   = "system_backup_failure"
	SystemAlertTypeEscrowReleaseFailure            = "system_escrow_release_failure"
	SystemAlertTypeFinanceReconciliationFailed     = "system_finance_reconciliation_failure"
	SystemAlertTypeSettlementReconciliationFailed  = "system_settlement_reconciliation_failure"
	SystemAlertTypeRefundSyncFailure               = "system_refund_sync_failure"
	SystemAlertTypePaymentCallbackFailed           = "payment_callback_failed"
	SystemAlertTypePaymentReconciliationFailed     = "payment_reconciliation_failed"
	SystemAlertTypePaymentReconciliationDifference = "payment_reconciliation_difference"
	SystemAlertTypeRefundFailed                    = "refund_failed"
	SystemAlertTypeRefundReconciliationDifference  = "refund_reconciliation_difference"
	SystemAlertTypeSettlementFailed                = "settlement_failed"
	SystemAlertTypeSettlementReconciliationDiff    = "settlement_reconciliation_difference"
)

type CreateSystemAlertInput struct {
	Type        string
	Level       string
	Scope       string
	ProjectID   uint64
	Description string
	ActionURL   string
}

type ListRiskWarningFilter struct {
	Page     int
	PageSize int
	Level    string
	Type     string
	Status   string
}

type HandleRiskWarningInput struct {
	Status int8   `json:"status"`
	Result string `json:"result"`
}

type SystemAlertService struct{}

func (s *SystemAlertService) UpsertAlert(input *CreateSystemAlertInput) (*model.RiskWarning, bool, error) {
	if input == nil {
		return nil, false, errors.New("告警参数不能为空")
	}

	alertType := strings.TrimSpace(input.Type)
	scope := strings.TrimSpace(input.Scope)
	description := sanitizeSystemAlertDescription(input.Description)
	level := normalizeSystemAlertLevel(input.Level)
	if alertType == "" || scope == "" || description == "" {
		return nil, false, errors.New("告警类型、范围和描述不能为空")
	}

	var (
		warning model.RiskWarning
		created bool
	)
	err := repository.DB.Transaction(func(tx *gorm.DB) error {
		err := tx.Where("type = ? AND project_id = ? AND project_name = ? AND status IN ?", alertType, input.ProjectID, scope, []int8{0, 1}).Order("id DESC").First(&warning).Error
		if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		if errors.Is(err, gorm.ErrRecordNotFound) {
			warning = model.RiskWarning{
				ProjectID:   input.ProjectID,
				ProjectName: scope,
				Type:        alertType,
				Level:       level,
				Description: buildSystemAlertDescription(description, input.ActionURL),
				Status:      0,
			}
			if err := tx.Create(&warning).Error; err != nil {
				return err
			}
			created = true
			return nil
		}

		warning.Level = level
		warning.Description = buildSystemAlertDescription(description, input.ActionURL)
		if warning.Status == 2 || warning.Status == 3 {
			warning.Status = 0
			warning.HandledAt = nil
			warning.HandledBy = nil
			warning.HandleResult = ""
		}
		if err := tx.Save(&warning).Error; err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		return nil, false, err
	}

	if created {
		_ = (&NotificationService{}).NotifyAdmins(&CreateNotificationInput{
			Title:       "系统告警",
			Content:     fmt.Sprintf("%s：%s", scope, description),
			Type:        "system.alert",
			RelatedID:   warning.ID,
			RelatedType: "risk_warning",
			ActionURL:   "/risk/warnings",
			Extra: map[string]interface{}{
				"warningId": warning.ID,
				"alertType": alertType,
				"level":     level,
				"scope":     scope,
			},
		})
	}

	return &warning, created, nil
}

func (s *SystemAlertService) ResolveAlert(alertType, scope, result string) (int64, error) {
	alertType = strings.TrimSpace(alertType)
	scope = strings.TrimSpace(scope)
	result = strings.TrimSpace(result)
	if alertType == "" || scope == "" {
		return 0, errors.New("告警类型和范围不能为空")
	}
	if result == "" {
		result = "系统自动恢复"
	}

	now := time.Now()
	update := map[string]interface{}{
		"status":        2,
		"handle_result": result,
		"handled_at":    &now,
	}

	resultTx := repository.DB.Model(&model.RiskWarning{}).
		Where("type = ? AND project_name = ? AND status IN ?", alertType, scope, []int8{0, 1}).
		Updates(update)
	if resultTx.Error != nil {
		return 0, resultTx.Error
	}
	return resultTx.RowsAffected, nil
}

func (s *SystemAlertService) ListRiskWarnings(filter ListRiskWarningFilter) ([]model.RiskWarning, int64, error) {
	page := filter.Page
	if page <= 0 {
		page = 1
	}
	pageSize := filter.PageSize
	if pageSize <= 0 {
		pageSize = 10
	}

	query := repository.DB.Model(&model.RiskWarning{})
	if level := strings.TrimSpace(filter.Level); level != "" {
		query = query.Where("level = ?", level)
	}
	if warningType := strings.TrimSpace(filter.Type); warningType != "" {
		query = query.Where("type = ?", warningType)
	}
	if statusText := strings.TrimSpace(filter.Status); statusText != "" {
		status, err := parseRiskWarningStatus(statusText)
		if err != nil {
			return nil, 0, err
		}
		query = query.Where("status = ?", status)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var warnings []model.RiskWarning
	if err := query.Order("id DESC").Offset((page - 1) * pageSize).Limit(pageSize).Find(&warnings).Error; err != nil {
		return nil, 0, err
	}

	return warnings, total, nil
}

func (s *SystemAlertService) HandleRiskWarning(id, adminID uint64, input *HandleRiskWarningInput) (*model.RiskWarning, error) {
	if id == 0 || adminID == 0 || input == nil {
		return nil, errors.New("处理参数无效")
	}

	result := strings.TrimSpace(input.Result)
	if result == "" {
		return nil, errors.New("请填写处理说明")
	}
	if input.Status < 1 || input.Status > 3 {
		return nil, errors.New("无效处理状态")
	}

	var warning model.RiskWarning
	err := repository.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.First(&warning, id).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return errors.New("预警不存在")
			}
			return err
		}

		if warning.Status == 2 || warning.Status == 3 {
			return errors.New("预警已处理")
		}
		if warning.Status == input.Status {
			return errors.New("预警当前状态不可再次处理")
		}

		now := time.Now()
		updates := map[string]interface{}{
			"status":        input.Status,
			"handle_result": result,
			"handled_at":    &now,
			"handled_by":    &adminID,
		}
		if err := tx.Model(&warning).Updates(updates).Error; err != nil {
			return err
		}
		return tx.First(&warning, warning.ID).Error
	})
	if err != nil {
		return nil, err
	}
	return &warning, nil
}

func normalizeSystemAlertLevel(level string) string {
	switch strings.ToLower(strings.TrimSpace(level)) {
	case "low", "medium", "high", "critical":
		return strings.ToLower(strings.TrimSpace(level))
	default:
		return "high"
	}
}

func buildSystemAlertDescription(description, _ string) string {
	description = strings.TrimSpace(description)
	if description == "" {
		return "系统任务异常，请进入风险中心查看处理。"
	}
	return description
}

func sanitizeSystemAlertDescription(description string) string {
	description = strings.TrimSpace(description)
	if description == "" {
		return "系统任务异常，请进入风险中心查看处理。"
	}
	lower := strings.ToLower(description)
	technicalMarkers := []string{
		"error:",
		"sqlstate",
		"relation ",
		"does not exist",
		"failed to create",
		"no such table",
		"database",
		"schema",
		"panic",
		"stack trace",
	}
	for _, marker := range technicalMarkers {
		if strings.Contains(lower, marker) {
			return "系统任务异常，请进入风险中心查看处理。"
		}
	}
	return description
}

func parseRiskWarningStatus(raw string) (int8, error) {
	value, err := strconv.ParseInt(strings.TrimSpace(raw), 10, 8)
	if err != nil {
		return 0, errors.New("无效预警状态")
	}
	status := int8(value)
	if status < 0 || status > 3 {
		return 0, errors.New("无效预警状态")
	}
	return status, nil
}

func buildAdminPaymentTransactionActionURL(paymentOrderID uint64) string {
	if paymentOrderID == 0 {
		return "/finance/transactions"
	}
	return fmt.Sprintf("/finance/transactions?paymentOrderId=%d", paymentOrderID)
}

func buildAdminFinanceReconciliationActionURL(reconciliationID uint64) string {
	if reconciliationID == 0 {
		return "/finance/reconciliations"
	}
	return fmt.Sprintf("/finance/reconciliations?reconciliationId=%d", reconciliationID)
}

func buildAdminRefundOrderActionURL(refundOrderID uint64) string {
	if refundOrderID == 0 {
		return "/refunds"
	}
	return fmt.Sprintf("/refunds?refundOrderId=%d", refundOrderID)
}

func buildAdminSettlementOrderActionURL(settlementOrderID uint64) string {
	if settlementOrderID == 0 {
		return "/finance/settlements"
	}
	return fmt.Sprintf("/finance/settlements?settlementOrderId=%d", settlementOrderID)
}

// AlertPaymentCallbackFailed 支付回调验签失败告警
func (s *SystemAlertService) AlertPaymentCallbackFailed(paymentOrderID uint64, reason string) error {
	scope := fmt.Sprintf("支付订单#%d", paymentOrderID)
	description := fmt.Sprintf("支付回调验签失败，原因：%s", reason)
	actionURL := buildAdminPaymentTransactionActionURL(paymentOrderID)

	_, created, err := s.UpsertAlert(&CreateSystemAlertInput{
		Type:        SystemAlertTypePaymentCallbackFailed,
		Level:       "high",
		Scope:       scope,
		ProjectID:   0,
		Description: description,
		ActionURL:   actionURL,
	})
	if err != nil {
		log.Printf("[SystemAlert] 支付回调验签失败告警发送失败: paymentOrderID=%d, error=%v", paymentOrderID, err)
		return err
	}
	if created {
		log.Printf("[SystemAlert] 支付回调验签失败告警已发送: paymentOrderID=%d, reason=%s", paymentOrderID, reason)
	}
	return nil
}

// AlertPaymentReconciliationFailed 支付对账失败告警
func (s *SystemAlertService) AlertPaymentReconciliationFailed(reconciliationID uint64, reason string) error {
	scope := fmt.Sprintf("支付对账任务#%d", reconciliationID)
	description := fmt.Sprintf("支付对账任务执行失败，原因：%s，请检查第三方支付接口或网络连接", reason)
	actionURL := buildAdminFinanceReconciliationActionURL(reconciliationID)

	_, created, err := s.UpsertAlert(&CreateSystemAlertInput{
		Type:        SystemAlertTypePaymentReconciliationFailed,
		Level:       "critical",
		Scope:       scope,
		ProjectID:   0,
		Description: description,
		ActionURL:   actionURL,
	})
	if err != nil {
		log.Printf("[SystemAlert] 支付对账失败告警发送失败: reconciliationID=%d, error=%v", reconciliationID, err)
		return err
	}
	if created {
		log.Printf("[SystemAlert] 支付对账失败告警已发送: reconciliationID=%d, reason=%s", reconciliationID, reason)
	}
	return nil
}

// AlertPaymentReconciliationDifference 支付对账差异告警
func (s *SystemAlertService) AlertPaymentReconciliationDifference(reconciliationID uint64, differenceCount int, differenceAmount float64) error {
	scope := fmt.Sprintf("支付对账任务#%d", reconciliationID)
	description := fmt.Sprintf("支付对账发现差异：差异笔数=%d，差异金额=%.2f元，请人工核对并处理", differenceCount, differenceAmount)
	actionURL := buildAdminFinanceReconciliationActionURL(reconciliationID)

	_, created, err := s.UpsertAlert(&CreateSystemAlertInput{
		Type:        SystemAlertTypePaymentReconciliationDifference,
		Level:       "high",
		Scope:       scope,
		ProjectID:   0,
		Description: description,
		ActionURL:   actionURL,
	})
	if err != nil {
		log.Printf("[SystemAlert] 支付对账差异告警发送失败: reconciliationID=%d, error=%v", reconciliationID, err)
		return err
	}
	if created {
		log.Printf("[SystemAlert] 支付对账差异告警已发送: reconciliationID=%d, count=%d, amount=%.2f", reconciliationID, differenceCount, differenceAmount)
	}
	return nil
}

// AlertRefundFailed 退款失败告警
func (s *SystemAlertService) AlertRefundFailed(refundOrderID uint64, reason string) error {
	scope := fmt.Sprintf("退款订单#%d", refundOrderID)
	description := fmt.Sprintf("退款申请失败，原因：%s，请检查退款参数或联系第三方支付平台", reason)
	actionURL := buildAdminRefundOrderActionURL(refundOrderID)

	_, created, err := s.UpsertAlert(&CreateSystemAlertInput{
		Type:        SystemAlertTypeRefundFailed,
		Level:       "high",
		Scope:       scope,
		ProjectID:   0,
		Description: description,
		ActionURL:   actionURL,
	})
	if err != nil {
		log.Printf("[SystemAlert] 退款失败告警发送失败: refundOrderID=%d, error=%v", refundOrderID, err)
		return err
	}
	if created {
		log.Printf("[SystemAlert] 退款失败告警已发送: refundOrderID=%d, reason=%s", refundOrderID, reason)
	}
	return nil
}

// AlertRefundReconciliationDifference 退款对账差异告警
func (s *SystemAlertService) AlertRefundReconciliationDifference(reconciliationID uint64, differenceCount int) error {
	scope := fmt.Sprintf("退款对账任务#%d", reconciliationID)
	description := fmt.Sprintf("退款对账发现差异：差异笔数=%d，请人工核对退款状态", differenceCount)
	actionURL := buildAdminFinanceReconciliationActionURL(reconciliationID)

	_, created, err := s.UpsertAlert(&CreateSystemAlertInput{
		Type:        SystemAlertTypeRefundReconciliationDifference,
		Level:       "high",
		Scope:       scope,
		ProjectID:   0,
		Description: description,
		ActionURL:   actionURL,
	})
	if err != nil {
		log.Printf("[SystemAlert] 退款对账差异告警发送失败: reconciliationID=%d, error=%v", reconciliationID, err)
		return err
	}
	if created {
		log.Printf("[SystemAlert] 退款对账差异告警已发送: reconciliationID=%d, count=%d", reconciliationID, differenceCount)
	}
	return nil
}

// AlertSettlementFailed 结算出款失败告警
func (s *SystemAlertService) AlertSettlementFailed(settlementOrderID uint64, reason string) error {
	scope := fmt.Sprintf("结算订单#%d", settlementOrderID)
	description := fmt.Sprintf("结算出款失败，原因：%s，请检查商户账户信息或联系第三方支付平台", reason)
	actionURL := buildAdminSettlementOrderActionURL(settlementOrderID)

	_, created, err := s.UpsertAlert(&CreateSystemAlertInput{
		Type:        SystemAlertTypeSettlementFailed,
		Level:       "high",
		Scope:       scope,
		ProjectID:   0,
		Description: description,
		ActionURL:   actionURL,
	})
	if err != nil {
		log.Printf("[SystemAlert] 结算出款失败告警发送失败: settlementOrderID=%d, error=%v", settlementOrderID, err)
		return err
	}
	if created {
		log.Printf("[SystemAlert] 结算出款失败告警已发送: settlementOrderID=%d, reason=%s", settlementOrderID, reason)
	}
	return nil
}

// AlertSettlementReconciliationDifference 结算对账差异告警
func (s *SystemAlertService) AlertSettlementReconciliationDifference(reconciliationID uint64, differenceCount int, differenceAmount float64) error {
	scope := fmt.Sprintf("结算对账任务#%d", reconciliationID)
	description := fmt.Sprintf("结算对账发现差异：差异笔数=%d，差异金额=%.2f元，请人工核对结算状态", differenceCount, differenceAmount)
	actionURL := buildAdminFinanceReconciliationActionURL(reconciliationID)

	_, created, err := s.UpsertAlert(&CreateSystemAlertInput{
		Type:        SystemAlertTypeSettlementReconciliationDiff,
		Level:       "high",
		Scope:       scope,
		ProjectID:   0,
		Description: description,
		ActionURL:   actionURL,
	})
	if err != nil {
		log.Printf("[SystemAlert] 结算对账差异告警发送失败: reconciliationID=%d, error=%v", reconciliationID, err)
		return err
	}
	if created {
		log.Printf("[SystemAlert] 结算对账差异告警已发送: reconciliationID=%d, count=%d, amount=%.2f", reconciliationID, differenceCount, differenceAmount)
	}
	return nil
}
