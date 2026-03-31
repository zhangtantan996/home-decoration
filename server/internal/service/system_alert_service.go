package service

import (
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"

	"gorm.io/gorm"
)

const (
	SystemAlertTypeBackupFailure               = "system_backup_failure"
	SystemAlertTypeEscrowReleaseFailure        = "system_escrow_release_failure"
	SystemAlertTypeFinanceReconciliationFailed = "system_finance_reconciliation_failure"
	SystemAlertTypeRefundSyncFailure           = "system_refund_sync_failure"
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
	description := strings.TrimSpace(input.Description)
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

func buildSystemAlertDescription(description, actionURL string) string {
	description = strings.TrimSpace(description)
	actionURL = strings.TrimSpace(actionURL)
	if actionURL == "" {
		return description
	}
	return fmt.Sprintf("%s | action=%s", description, actionURL)
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
