package service

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"home-decoration-server/internal/model"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	escrowStatusInactive int8 = 0
	escrowStatusActive   int8 = 1
	escrowStatusFrozen   int8 = 2
	escrowStatusClosed   int8 = 3
)

func isProjectPaused(project *model.Project) bool {
	return project != nil && project.Status == model.ProjectStatusPaused
}

func isProjectClosed(project *model.Project) bool {
	return project != nil && project.Status == model.ProjectStatusClosed
}

func isProjectDisputed(project *model.Project) bool {
	return project != nil && project.DisputedAt != nil
}

func ensureProjectExecutionAllowed(project *model.Project, action string) error {
	if project == nil {
		return errors.New("项目不存在")
	}
	if isProjectPaused(project) {
		return fmt.Errorf("项目已暂停，暂不能%s", action)
	}
	if isProjectClosed(project) {
		return fmt.Errorf("项目已关闭，暂不能%s", action)
	}
	if isProjectDisputed(project) {
		return fmt.Errorf("项目争议处理中，暂不能%s", action)
	}
	if project.PaymentPaused {
		return fmt.Errorf("项目施工款待支付，暂不能%s", action)
	}
	return nil
}

func lockProjectByID(tx *gorm.DB, projectID uint64) (*model.Project, error) {
	var project model.Project
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&project, projectID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("项目不存在")
		}
		return nil, err
	}
	return &project, nil
}

func findProjectByBookingTx(tx *gorm.DB, bookingID uint64) (*model.Project, error) {
	var orders []model.Order
	if err := tx.Where("booking_id = ? AND project_id > 0", bookingID).Order("id DESC").Find(&orders).Error; err == nil {
		for _, order := range orders {
			var project model.Project
			if err := tx.First(&project, order.ProjectID).Error; err == nil {
				return &project, nil
			}
		}
	}

	var proposals []model.Proposal
	if err := tx.Where("booking_id = ?", bookingID).Order("id DESC").Find(&proposals).Error; err == nil {
		for _, proposal := range proposals {
			var project model.Project
			if err := tx.Where("proposal_id = ?", proposal.ID).Order("id DESC").First(&project).Error; err == nil {
				return &project, nil
			}
		}
	}

	return nil, nil
}

func findLatestPaidOrderTx(tx *gorm.DB, bookingID, projectID uint64, orderType string) (*model.Order, error) {
	query := tx.Model(&model.Order{}).Where("order_type = ? AND status = ?", orderType, model.OrderStatusPaid)
	if projectID > 0 {
		query = query.Where("project_id = ?", projectID)
	} else if bookingID > 0 {
		query = query.Where("booking_id = ?", bookingID)
	}

	var order model.Order
	if err := query.Order("id DESC").First(&order).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &order, nil
}

func setProjectEscrowStatusTx(tx *gorm.DB, projectID uint64, status int8) (*model.EscrowAccount, error) {
	if projectID == 0 {
		return nil, nil
	}
	escrow, err := loadProjectEscrowTx(tx, projectID)
	if err != nil || escrow == nil {
		return escrow, err
	}
	if escrow.Status == status {
		return escrow, nil
	}
	if err := tx.Model(escrow).Update("status", status).Error; err != nil {
		return nil, err
	}
	escrow.Status = status
	return escrow, nil
}

func reconcileEscrowStatus(escrow *model.EscrowAccount) int8 {
	if escrow == nil {
		return escrowStatusInactive
	}
	if escrow.TotalAmount <= 0 && escrow.AvailableAmount <= 0 && escrow.FrozenAmount <= 0 && escrow.ReleasedAmount <= 0 {
		return escrowStatusInactive
	}
	if escrow.FrozenAmount > 0 {
		return escrowStatusFrozen
	}
	return escrowStatusActive
}

func transferEscrowBalanceTx(tx *gorm.DB, escrow *model.EscrowAccount, fromField, toField string, amount float64) error {
	if escrow == nil {
		return errors.New("托管账户不存在")
	}
	amount = normalizeAmount(amount)
	if amount <= 0 {
		return errors.New("金额必须大于0")
	}

	var fromValue float64
	switch fromField {
	case "available_amount":
		fromValue = escrow.AvailableAmount
	case "frozen_amount":
		fromValue = escrow.FrozenAmount
	default:
		return errors.New("不支持的余额字段")
	}
	if amount > fromValue {
		return errors.New("金额超过可用余额")
	}

	updates := map[string]interface{}{
		fromField: gorm.Expr(fromField+" - ?", amount),
		toField:   gorm.Expr(toField+" + ?", amount),
	}
	if err := tx.Model(escrow).Updates(updates).Error; err != nil {
		return err
	}
	if err := tx.First(escrow, escrow.ID).Error; err != nil {
		return err
	}
	status := reconcileEscrowStatus(escrow)
	if err := tx.Model(escrow).Update("status", status).Error; err != nil {
		return err
	}
	escrow.Status = status
	return nil
}

func freezeEscrowBalanceTx(tx *gorm.DB, projectID uint64, amount float64) (*model.EscrowAccount, error) {
	escrow, err := loadProjectEscrowTx(tx, projectID)
	if err != nil || escrow == nil {
		return escrow, err
	}
	if err := transferEscrowBalanceTx(tx, escrow, "available_amount", "frozen_amount", amount); err != nil {
		return nil, err
	}
	return escrow, nil
}

func unfreezeEscrowBalanceTx(tx *gorm.DB, projectID uint64, amount float64) (*model.EscrowAccount, error) {
	escrow, err := loadProjectEscrowTx(tx, projectID)
	if err != nil || escrow == nil {
		return escrow, err
	}
	if err := transferEscrowBalanceTx(tx, escrow, "frozen_amount", "available_amount", amount); err != nil {
		return nil, err
	}
	return escrow, nil
}

func loadProjectEscrowTx(tx *gorm.DB, projectID uint64) (*model.EscrowAccount, error) {
	var escrow model.EscrowAccount
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("project_id = ?", projectID).First(&escrow).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &escrow, nil
}

func refundableConstructionAmountTx(tx *gorm.DB, projectID uint64) (float64, *model.EscrowAccount, error) {
	if projectID == 0 {
		return 0, nil, nil
	}
	var escrow model.EscrowAccount
	if err := tx.Where("project_id = ?", projectID).First(&escrow).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return 0, nil, nil
		}
		return 0, nil, err
	}
	amount := escrow.FrozenAmount
	if amount < 0 {
		amount = 0
	}
	return amount, &escrow, nil
}

func marshalJSONObject(input map[string]interface{}) string {
	if len(input) == 0 {
		return "{}"
	}
	payload, err := json.Marshal(input)
	if err != nil {
		return "{}"
	}
	return string(payload)
}

func parseJSONObject(raw string) map[string]interface{} {
	if strings.TrimSpace(raw) == "" {
		return map[string]interface{}{}
	}
	var result map[string]interface{}
	if err := json.Unmarshal([]byte(raw), &result); err != nil {
		return map[string]interface{}{}
	}
	if result == nil {
		return map[string]interface{}{}
	}
	return result
}

func createRefundTransactionTx(tx *gorm.DB, projectID, userID, orderID uint64, amount float64, remark string) error {
	if amount <= 0 {
		return nil
	}
	transactionOrderID := fmt.Sprintf("refund-%d-%d", orderID, time.Now().UnixNano())
	var escrowID uint64
	if projectID > 0 {
		var escrow model.EscrowAccount
		if err := tx.Where("project_id = ?", projectID).First(&escrow).Error; err == nil {
			escrowID = escrow.ID
		}
	}
	now := time.Now()
	return tx.Create(&model.Transaction{
		OrderID:     transactionOrderID,
		EscrowID:    escrowID,
		Type:        "refund",
		Amount:      amount,
		FromUserID:  0,
		ToUserID:    userID,
		Status:      1,
		Remark:      remark,
		CompletedAt: &now,
	}).Error
}

func getProviderUserIDTx(tx *gorm.DB, providerID uint64) uint64 {
	if providerID == 0 {
		return 0
	}
	var provider model.Provider
	if err := tx.Select("user_id").First(&provider, providerID).Error; err != nil {
		return 0
	}
	return provider.UserID
}

func getOpenProjectAuditTx(tx *gorm.DB, projectID uint64, auditType string) (*model.ProjectAudit, error) {
	query := tx.Where("project_id = ? AND status IN ?", projectID, []string{model.ProjectAuditStatusPending, model.ProjectAuditStatusInProgress})
	if strings.TrimSpace(auditType) != "" {
		query = query.Where("audit_type = ?", auditType)
	}
	var audit model.ProjectAudit
	if err := query.Order("id DESC").First(&audit).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &audit, nil
}

func normalizeAmount(amount float64) float64 {
	if amount < 0 {
		return 0
	}
	return amount
}

func clearProjectDisputeStateTx(tx *gorm.DB, projectID uint64) error {
	updates := map[string]interface{}{
		"disputed_at":      nil,
		"dispute_reason":   "",
		"dispute_evidence": "[]",
	}
	return tx.Model(&model.Project{}).Where("id = ?", projectID).Updates(updates).Error
}

func buildProjectDisputeActionURL(projectID uint64) string {
	return fmt.Sprintf("/projects/%d/dispute", projectID)
}

func buildProjectPauseActionURL(projectID uint64) string {
	return fmt.Sprintf("/projects/%d/pause", projectID)
}

func buildAdminProjectAuditActionURL(auditID uint64) string {
	return fmt.Sprintf("/admin/project-audits/%d", auditID)
}

func buildBookingRefundActionURL(bookingID uint64) string {
	return fmt.Sprintf("/bookings/%d/refund", bookingID)
}
