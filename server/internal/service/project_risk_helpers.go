package service

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"

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

func buildRefundTransactionRemark(base string, projectID, orderID, refundApplicationID uint64) string {
	parts := make([]string, 0, 4)
	if trimmed := strings.TrimSpace(base); trimmed != "" {
		parts = append(parts, trimmed)
	}
	if projectID > 0 {
		parts = append(parts, fmt.Sprintf("projectId=%d", projectID))
	}
	if orderID > 0 {
		parts = append(parts, fmt.Sprintf("orderId=%d", orderID))
	}
	if refundApplicationID > 0 {
		parts = append(parts, fmt.Sprintf("refundApplicationId=%d", refundApplicationID))
	}
	return strings.Join(parts, " | ")
}

func loadRefundExecutionScopeTx(tx *gorm.DB, application *model.RefundApplication) (*model.Booking, *model.Project, error) {
	if application == nil {
		return nil, nil, errors.New("退款申请不存在")
	}
	if tx == nil {
		tx = repository.DB
	}

	var booking *model.Booking
	if application.BookingID > 0 {
		var loaded model.Booking
		if err := tx.First(&loaded, application.BookingID).Error; err != nil {
			if !errors.Is(err, gorm.ErrRecordNotFound) {
				return nil, nil, err
			}
		} else {
			booking = &loaded
		}
	}

	var project *model.Project
	if application.ProjectID > 0 {
		var loaded model.Project
		if err := tx.First(&loaded, application.ProjectID).Error; err != nil {
			if !errors.Is(err, gorm.ErrRecordNotFound) {
				return nil, nil, err
			}
		} else {
			project = &loaded
		}
	}

	return booking, project, nil
}

func refundExecutionSnapshot(application *model.RefundApplication, booking *model.Booking, project *model.Project) map[string]interface{} {
	state := map[string]interface{}{}
	if application != nil {
		state["refundApplication"] = map[string]interface{}{
			"id":              application.ID,
			"bookingId":       application.BookingID,
			"projectId":       application.ProjectID,
			"orderId":         application.OrderID,
			"refundType":      application.RefundType,
			"requestedAmount": application.RequestedAmount,
			"approvedAmount":  application.ApprovedAmount,
			"status":          application.Status,
			"approvedAt":      application.ApprovedAt,
			"completedAt":     application.CompletedAt,
		}
	}
	if booking != nil {
		state["booking"] = map[string]interface{}{
			"id":                    booking.ID,
			"status":                booking.Status,
			"intentFeeRefunded":     booking.IntentFeeRefunded,
			"surveyDepositRefunded": booking.SurveyDepositRefunded,
		}
	}
	if project != nil {
		state["project"] = map[string]interface{}{
			"id":             project.ID,
			"status":         project.Status,
			"businessStatus": project.BusinessStatus,
			"currentPhase":   project.CurrentPhase,
		}
	}
	return state
}

func createRefundExecutionAuditTx(tx *gorm.DB, operatorType string, operatorID uint64, application *model.RefundApplication, booking *model.Booking, project *model.Project, refundOrders []model.RefundOrder, beforeState map[string]interface{}, result, reason string) error {
	if application == nil {
		return nil
	}
	if tx == nil {
		tx = repository.DB
	}
	if beforeState == nil {
		beforeState = refundExecutionSnapshot(application, booking, project)
	}

	orderIDs := make([]uint64, 0, len(refundOrders))
	paymentOrderIDs := make([]uint64, 0, len(refundOrders))
	statuses := make([]string, 0, len(refundOrders))
	for _, refundOrder := range refundOrders {
		orderIDs = append(orderIDs, refundOrder.ID)
		paymentOrderIDs = append(paymentOrderIDs, refundOrder.PaymentOrderID)
		statuses = append(statuses, refundOrder.Status)
	}

	return (&AuditLogService{}).CreateBusinessRecordTx(tx, &CreateAuditRecordInput{
		OperatorType:  strings.TrimSpace(operatorType),
		OperatorID:    operatorID,
		OperationType: "execute_refund_application",
		ResourceType:  "refund_application",
		ResourceID:    application.ID,
		Reason:        strings.TrimSpace(reason),
		Result:        strings.TrimSpace(result),
		BeforeState:   beforeState,
		AfterState:    refundExecutionSnapshot(application, booking, project),
		Metadata: map[string]interface{}{
			"bookingId":        application.BookingID,
			"projectId":        application.ProjectID,
			"orderId":          application.OrderID,
			"refundType":       application.RefundType,
			"refundOrderIds":   orderIDs,
			"paymentOrderIds":  paymentOrderIDs,
			"refundOrderCount": len(refundOrders),
			"refundStatuses":   statuses,
		},
	})
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
	return fmt.Sprintf("/project-audits/%d", auditID)
}

func buildAdminRefundActionURL(refundApplicationID uint64) string {
	return fmt.Sprintf("/refunds/%d", refundApplicationID)
}

func buildBookingRefundActionURL(bookingID uint64) string {
	return fmt.Sprintf("/bookings/%d/refund", bookingID)
}
