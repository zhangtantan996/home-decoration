package service

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type ProjectAuditView struct {
	ID                  uint64                 `json:"id"`
	ProjectID           uint64                 `json:"projectId"`
	ProjectName         string                 `json:"projectName"`
	AuditType           string                 `json:"auditType"`
	Status              string                 `json:"status"`
	ComplaintID         uint64                 `json:"complaintId"`
	RefundApplicationID uint64                 `json:"refundApplicationId"`
	AuditNotes          string                 `json:"auditNotes"`
	Conclusion          string                 `json:"conclusion"`
	ConclusionReason    string                 `json:"conclusionReason"`
	ExecutionPlan       map[string]interface{} `json:"executionPlan"`
	AdminID             uint64                 `json:"adminId"`
	CreatedAt           time.Time              `json:"createdAt"`
	UpdatedAt           time.Time              `json:"updatedAt"`
	CompletedAt         *time.Time             `json:"completedAt,omitempty"`
	Project             map[string]interface{} `json:"project,omitempty"`
	Complaint           map[string]interface{} `json:"complaint,omitempty"`
	Escrow              map[string]interface{} `json:"escrow,omitempty"`
	RefundApplication   *RefundApplicationView `json:"refundApplication,omitempty"`
	User                map[string]interface{} `json:"user,omitempty"`
	Provider            map[string]interface{} `json:"provider,omitempty"`
}

type CreateProjectAuditInput struct {
	AuditType  string `json:"auditType"`
	AuditNotes string `json:"auditNotes"`
}

type ArbitrateProjectAuditInput struct {
	Conclusion       string                 `json:"conclusion"`
	ConclusionReason string                 `json:"conclusionReason"`
	ExecutionPlan    map[string]interface{} `json:"executionPlan"`
}

type ProjectAuditService struct{}

func (s *ProjectAuditService) EnsureAudit(projectID, adminID uint64, input *CreateProjectAuditInput) (*ProjectAuditView, error) {
	auditType := model.ProjectAuditTypeDispute
	auditNotes := ""
	if input != nil {
		if normalized := strings.TrimSpace(input.AuditType); normalized != "" {
			auditType = normalized
		}
		auditNotes = strings.TrimSpace(input.AuditNotes)
	}
	if auditType != model.ProjectAuditTypeDispute && auditType != model.ProjectAuditTypeRefund && auditType != model.ProjectAuditTypeClose {
		return nil, errors.New("无效的审计类型")
	}

	var view *ProjectAuditView
	auditService := &AuditLogService{}
	err := repository.DB.Transaction(func(tx *gorm.DB) error {
		project, err := lockProjectByID(tx, projectID)
		if err != nil {
			return err
		}
		audit, err := getOpenProjectAuditTx(tx, projectID, auditType)
		if err != nil {
			return err
		}
		if audit == nil {
			beforeState := financeSnapshot(project, nil)
			audit = &model.ProjectAudit{
				ProjectID:  project.ID,
				AuditType:  auditType,
				Status:     model.ProjectAuditStatusPending,
				AuditNotes: auditNotes,
				AdminID:    adminID,
			}
			if complaintID, err := latestProjectComplaintIDTx(tx, projectID); err == nil {
				audit.ComplaintID = complaintID
			} else {
				return err
			}
			if auditType == model.ProjectAuditTypeRefund {
				refundID, err := latestPendingRefundApplicationIDTx(tx, projectID)
				if err != nil {
					return err
				}
				audit.RefundApplicationID = refundID
			}
			if err := tx.Create(audit).Error; err != nil {
				return err
			}
			if err := auditService.CreateBusinessRecordTx(tx, &CreateAuditRecordInput{
				OperatorType:  "admin",
				OperatorID:    adminID,
				OperationType: "create_project_audit",
				ResourceType:  "project",
				ResourceID:    project.ID,
				Reason:        auditNotes,
				Result:        "success",
				BeforeState:   beforeState,
				AfterState: map[string]interface{}{
					"projectAudit": map[string]interface{}{
						"id":                  audit.ID,
						"projectId":           project.ID,
						"auditType":           audit.AuditType,
						"status":              audit.Status,
						"complaintId":         audit.ComplaintID,
						"refundApplicationId": audit.RefundApplicationID,
					},
				},
			}); err != nil {
				return err
			}
		}
		loaded, err := s.buildProjectAuditViewTx(tx, audit)
		if err != nil {
			return err
		}
		view = loaded
		return nil
	})
	if err != nil {
		return nil, err
	}
	return view, nil
}

func (s *ProjectAuditService) ListAudits(status string, page, pageSize int) ([]ProjectAuditView, int64, error) {
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 20
	}
	query := repository.DB.Model(&model.ProjectAudit{})
	if strings.TrimSpace(status) != "" {
		query = query.Where("status = ?", strings.TrimSpace(status))
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var audits []model.ProjectAudit
	if err := query.Order("created_at DESC").Offset((page - 1) * pageSize).Limit(pageSize).Find(&audits).Error; err != nil {
		return nil, 0, err
	}
	result := make([]ProjectAuditView, 0, len(audits))
	for i := range audits {
		view, err := s.buildProjectAuditViewTx(repository.DB, &audits[i])
		if err != nil {
			return nil, 0, err
		}
		result = append(result, *view)
	}
	return result, total, nil
}

func (s *ProjectAuditService) GetAuditDetail(id uint64) (*ProjectAuditView, error) {
	var audit model.ProjectAudit
	if err := repository.DB.First(&audit, id).Error; err != nil {
		return nil, errors.New("审计单不存在")
	}
	return s.buildProjectAuditViewTx(repository.DB, &audit)
}

func (s *ProjectAuditService) Arbitrate(id, adminID uint64, input *ArbitrateProjectAuditInput) (*ProjectAuditView, error) {
	if input == nil {
		input = &ArbitrateProjectAuditInput{}
	}
	conclusion := strings.TrimSpace(input.Conclusion)
	if conclusion == "" {
		return nil, errors.New("请填写仲裁结论")
	}
	switch conclusion {
	case model.ProjectAuditConclusionContinue, model.ProjectAuditConclusionRefund, model.ProjectAuditConclusionPartialRefund, model.ProjectAuditConclusionClose:
	default:
		return nil, errors.New("无效的仲裁结论")
	}
	conclusionReason := strings.TrimSpace(input.ConclusionReason)
	if conclusionReason == "" {
		return nil, errors.New("请填写仲裁理由")
	}

	var view *ProjectAuditView
	var notifyUserID uint64
	var notifyProviderUserID uint64
	auditService := &AuditLogService{}
	err := repository.DB.Transaction(func(tx *gorm.DB) error {
		var audit model.ProjectAudit
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&audit, id).Error; err != nil {
			return errors.New("审计单不存在")
		}
		if audit.Status == model.ProjectAuditStatusCompleted {
			return errors.New("审计单已完成")
		}
		project, err := lockProjectByID(tx, audit.ProjectID)
		if err != nil {
			return err
		}
		beforeState := map[string]interface{}{
			"project": financeSnapshot(project, nil)["project"],
			"projectAudit": map[string]interface{}{
				"id":         audit.ID,
				"status":     audit.Status,
				"conclusion": audit.Conclusion,
			},
		}
		notifyUserID = project.OwnerID
		notifyProviderUserID = getProviderUserIDTx(tx, project.ProviderID)

		executionPlan := input.ExecutionPlan
		if executionPlan == nil {
			executionPlan = map[string]interface{}{}
		}
		if err := tx.Model(&audit).Updates(map[string]interface{}{
			"status":            model.ProjectAuditStatusInProgress,
			"admin_id":          adminID,
			"conclusion":        conclusion,
			"conclusion_reason": conclusionReason,
			"execution_plan":    marshalJSONObject(executionPlan),
		}).Error; err != nil {
			return err
		}

		switch conclusion {
		case model.ProjectAuditConclusionContinue:
			if err := resolveAuditContinueTx(tx, &audit, project, adminID, conclusionReason); err != nil {
				return err
			}
		case model.ProjectAuditConclusionRefund, model.ProjectAuditConclusionPartialRefund:
			if err := resolveAuditRefundTx(tx, &audit, project, adminID, conclusion, conclusionReason, executionPlan); err != nil {
				return err
			}
		case model.ProjectAuditConclusionClose:
			if err := resolveAuditCloseTx(tx, &audit, project, adminID, conclusionReason); err != nil {
				return err
			}
		}

		now := time.Now()
		if err := tx.Model(&audit).Updates(map[string]interface{}{
			"status":       model.ProjectAuditStatusCompleted,
			"completed_at": now,
		}).Error; err != nil {
			return err
		}
		var refreshed model.ProjectAudit
		if err := tx.First(&refreshed, audit.ID).Error; err != nil {
			return err
		}
		loaded, err := s.buildProjectAuditViewTx(tx, &refreshed)
		if err != nil {
			return err
		}
		view = loaded
		return auditService.CreateBusinessRecordTx(tx, &CreateAuditRecordInput{
			OperatorType:  "admin",
			OperatorID:    adminID,
			OperationType: "arbitrate_project_audit",
			ResourceType:  "project_audit",
			ResourceID:    audit.ID,
			Reason:        conclusionReason,
			Result:        "success",
			BeforeState:   beforeState,
			AfterState: map[string]interface{}{
				"projectAudit": map[string]interface{}{
					"id":            refreshed.ID,
					"status":        refreshed.Status,
					"conclusion":    refreshed.Conclusion,
					"completedAt":   refreshed.CompletedAt,
					"executionPlan": parseJSONObject(refreshed.ExecutionPlan),
				},
			},
			Metadata: map[string]interface{}{
				"projectId":   project.ID,
				"conclusion":  conclusion,
				"projectName": project.Name,
			},
		})
	})
	if err != nil {
		return nil, err
	}

	NewNotificationDispatcher().NotifyProjectAuditCompleted(view.ID, view.ProjectID, notifyUserID, notifyProviderUserID, view.Conclusion, view.ConclusionReason)
	return view, nil
}

func resolveAuditContinueTx(tx *gorm.DB, audit *model.ProjectAudit, project *model.Project, adminID uint64, conclusionReason string) error {
	if err := clearProjectDisputeStateTx(tx, project.ID); err != nil {
		return err
	}
	if err := tx.Model(project).Updates(map[string]interface{}{
		"status": model.ProjectStatusActive,
	}).Error; err != nil {
		return err
	}
	if _, err := setProjectEscrowStatusTx(tx, project.ID, escrowStatusActive); err != nil {
		return err
	}
	if err := businessFlowSvc.AdvanceByProject(tx, project.ID, map[string]interface{}{
		"current_stage": model.BusinessFlowStageInProgress,
		"closed_reason": "",
	}); err != nil {
		return err
	}
	return resolveLinkedComplaintTx(tx, audit.ComplaintID, adminID, conclusionReason, false)
}

func resolveAuditRefundTx(tx *gorm.DB, audit *model.ProjectAudit, project *model.Project, adminID uint64, conclusion, conclusionReason string, executionPlan map[string]interface{}) error {
	refundAmount := extractRefundAmount(executionPlan)
	if refundAmount <= 0 {
		constructionAmount, _, err := refundableConstructionAmountTx(tx, project.ID)
		if err != nil {
			return err
		}
		refundAmount = constructionAmount
	}
	if refundAmount <= 0 {
		return errors.New("当前项目没有可执行退款金额")
	}
	continueConstruction := extractContinueConstruction(executionPlan)

	var complaint model.Complaint
	if audit.ComplaintID > 0 {
		_ = tx.First(&complaint, audit.ComplaintID).Error
	}
	constructionOrder, err := findLatestPaidOrderTx(tx, 0, project.ID, model.OrderTypeConstruction)
	if err != nil {
		return err
	}
	if constructionOrder == nil || constructionOrder.ID == 0 {
		return errors.New("未找到施工支付订单")
	}
	application := &model.RefundApplication{
		BookingID:       0,
		ProjectID:       project.ID,
		OrderID:         constructionOrder.ID,
		UserID:          project.OwnerID,
		RefundType:      model.RefundTypeConstructionFee,
		RequestedAmount: refundAmount,
		ApprovedAmount:  refundAmount,
		Reason:          conclusionReason,
		Evidence:        marshalStringList(ParseStringList(project.DisputeEvidence)),
		Status:          model.RefundApplicationStatusPending,
	}
	if complaint.ID > 0 {
		bookingID, err := bookingIDFromProjectComplaintTx(tx, complaint.ProjectID)
		if err == nil {
			application.BookingID = bookingID
		}
		if complaint.EvidenceURLs != "" {
			application.Evidence = complaint.EvidenceURLs
		}
	}
	if err := tx.Create(application).Error; err != nil {
		return err
	}
	paymentService := NewPaymentService(nil)
	refundOrders, err := paymentService.CreateRefundOrdersForApplicationTx(tx, application, refundAmount)
	if err != nil {
		return err
	}
	now := time.Now()
	for i := range refundOrders {
		if err := tx.Model(&refundOrders[i]).Updates(map[string]interface{}{
			"status":       model.RefundOrderStatusSucceeded,
			"succeeded_at": now,
		}).Error; err != nil {
			return err
		}
		refundOrders[i].Status = model.RefundOrderStatusSucceeded
		refundOrders[i].SucceededAt = &now
	}
	bookingScope, projectScope, err := loadRefundExecutionScopeTx(tx, application)
	if err != nil {
		return err
	}
	beforeState := refundExecutionSnapshot(application, bookingScope, projectScope)
	if err := applyConstructionRefundTx(tx, project.ID, project.OwnerID, application.OrderID, application.ID, refundAmount); err != nil {
		return err
	}
	if err := tx.Model(application).Updates(map[string]interface{}{
		"status":          model.RefundApplicationStatusCompleted,
		"admin_id":        adminID,
		"admin_notes":     conclusionReason,
		"approved_amount": refundAmount,
		"approved_at":     now,
		"completed_at":    now,
	}).Error; err != nil {
		return err
	}
	application.Status = model.RefundApplicationStatusCompleted
	application.AdminID = adminID
	application.AdminNotes = conclusionReason
	application.ApprovedAmount = refundAmount
	application.ApprovedAt = &now
	application.CompletedAt = &now
	bookingScope, projectScope, err = loadRefundExecutionScopeTx(tx, application)
	if err != nil {
		return err
	}
	if err := createRefundExecutionAuditTx(tx, "admin", adminID, application, bookingScope, projectScope, refundOrders, beforeState, "success", conclusionReason); err != nil {
		return err
	}
	if err := tx.Model(audit).Update("refund_application_id", application.ID).Error; err != nil {
		return err
	}
	if continueConstruction && conclusion == model.ProjectAuditConclusionPartialRefund {
		if err := clearProjectDisputeStateTx(tx, project.ID); err != nil {
			return err
		}
		if escrow, err := loadProjectEscrowTx(tx, project.ID); err != nil {
			return err
		} else if escrow != nil && escrow.FrozenAmount > 0 {
			if _, err := unfreezeEscrowBalanceTx(tx, project.ID, escrow.FrozenAmount); err != nil {
				return err
			}
		}
		if _, err := setProjectEscrowStatusTx(tx, project.ID, escrowStatusActive); err != nil {
			return err
		}
		if err := businessFlowSvc.AdvanceByProject(tx, project.ID, map[string]interface{}{
			"current_stage": model.BusinessFlowStageInProgress,
			"closed_reason": "",
		}); err != nil {
			return err
		}
	} else {
		if err := clearProjectDisputeStateTx(tx, project.ID); err != nil {
			return err
		}
		if err := tx.Model(project).Updates(map[string]interface{}{
			"current_phase":   "退款关闭",
			"status":          model.ProjectStatusClosed,
			"business_status": model.ProjectBusinessStatusCancelled,
		}).Error; err != nil {
			return err
		}
		if err := businessFlowSvc.AdvanceByProject(tx, project.ID, map[string]interface{}{
			"current_stage": model.BusinessFlowStageCancelled,
			"closed_reason": conclusionReason,
		}); err != nil {
			return err
		}
	}
	return resolveLinkedComplaintTx(tx, audit.ComplaintID, adminID, conclusionReason, false)
}

func resolveAuditCloseTx(tx *gorm.DB, audit *model.ProjectAudit, project *model.Project, adminID uint64, conclusionReason string) error {
	if err := clearProjectDisputeStateTx(tx, project.ID); err != nil {
		return err
	}
	now := time.Now()
	if err := tx.Model(project).Updates(map[string]interface{}{
		"current_phase":   "仲裁关闭",
		"status":          model.ProjectStatusClosed,
		"business_status": model.ProjectBusinessStatusCancelled,
		"closed_reason":   conclusionReason,
		"closed_at":       now,
		"closure_type":    "abnormal",
	}).Error; err != nil {
		return err
	}
	if err := businessFlowSvc.AdvanceByProject(tx, project.ID, map[string]interface{}{
		"current_stage": model.BusinessFlowStageCancelled,
		"closed_reason": conclusionReason,
	}); err != nil {
		return err
	}
	return resolveLinkedComplaintTx(tx, audit.ComplaintID, adminID, conclusionReason, false)
}

// CloseProject 关闭项目（正常关闭或异常关闭）
func (s *ProjectAuditService) CloseProject(projectID, adminID uint64, closureType, reason string) error {
	if closureType != "normal" && closureType != "abnormal" {
		return errors.New("无效的关闭类型")
	}
	if strings.TrimSpace(reason) == "" {
		return errors.New("请填写关闭原因")
	}

	var notifyUserID uint64
	var notifyProviderUserID uint64
	auditService := &AuditLogService{}

	err := repository.DB.Transaction(func(tx *gorm.DB) error {
		project, err := lockProjectByID(tx, projectID)
		if err != nil {
			return err
		}
		if project.Status == model.ProjectStatusClosed {
			return errors.New("项目已关闭")
		}

		notifyUserID = project.OwnerID
		notifyProviderUserID = getProviderUserIDTx(tx, project.ProviderID)

		beforeState := financeSnapshot(project, nil)
		now := time.Now()

		// 更新项目状态
		updates := map[string]interface{}{
			"status":          model.ProjectStatusClosed,
			"business_status": model.ProjectBusinessStatusCancelled,
			"closed_reason":   reason,
			"closed_at":       now,
			"closure_type":    closureType,
		}

		if closureType == "normal" {
			updates["current_phase"] = "正常关闭"
		} else {
			updates["current_phase"] = "异常关闭"
		}

		if err := tx.Model(project).Updates(updates).Error; err != nil {
			return err
		}

		// 处理资金
		if closureType == "abnormal" {
			// 异常关闭：冻结托管账户
			if _, err := setProjectEscrowStatusTx(tx, project.ID, 2); err != nil {
				return err
			}
		} else {
			// 正常关闭：结算剩余资金
			escrow, err := loadProjectEscrowTx(tx, project.ID)
			if err == nil && escrow != nil && escrow.AvailableAmount > 0 {
				// 将剩余资金放款给商家
				if err := releaseEscrowBalanceTx(tx, project.ID, escrow.AvailableAmount, "项目正常关闭结算"); err != nil {
					return err
				}
			}
		}

		// 更新业务流程状态
		if err := businessFlowSvc.AdvanceByProject(tx, project.ID, map[string]interface{}{
			"current_stage": model.BusinessFlowStageCancelled,
			"closed_reason": reason,
		}); err != nil {
			return err
		}

		// 记录审计日志
		return auditService.CreateBusinessRecordTx(tx, &CreateAuditRecordInput{
			OperatorType:  "admin",
			OperatorID:    adminID,
			OperationType: "close_project",
			ResourceType:  "project",
			ResourceID:    project.ID,
			Reason:        reason,
			Result:        "success",
			BeforeState:   beforeState,
			AfterState: map[string]interface{}{
				"project": map[string]interface{}{
					"id":            project.ID,
					"status":        model.ProjectStatusClosed,
					"businessStatus": model.ProjectBusinessStatusCancelled,
					"closedReason":  reason,
					"closedAt":      now,
					"closureType":   closureType,
				},
			},
			Metadata: map[string]interface{}{
				"projectName": project.Name,
				"closureType": closureType,
			},
		})
	})

	if err != nil {
		return err
	}

	// 发送通知
	NewNotificationDispatcher().NotifyProjectClosed(projectID, notifyUserID, notifyProviderUserID, closureType, reason)
	return nil
}

func resolveLinkedComplaintTx(tx *gorm.DB, complaintID, adminID uint64, resolution string, freezePayment bool) error {
	if complaintID == 0 {
		return nil
	}
	return tx.Model(&model.Complaint{}).Where("id = ?", complaintID).Updates(map[string]interface{}{
		"status":         "resolved",
		"admin_id":       adminID,
		"resolution":     resolution,
		"freeze_payment": freezePayment,
	}).Error
}

func latestProjectComplaintIDTx(tx *gorm.DB, projectID uint64) (uint64, error) {
	var complaint model.Complaint
	if err := tx.Where("project_id = ?", projectID).Order("id DESC").First(&complaint).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return 0, nil
		}
		return 0, err
	}
	return complaint.ID, nil
}

func latestPendingRefundApplicationIDTx(tx *gorm.DB, projectID uint64) (uint64, error) {
	var application model.RefundApplication
	if err := tx.Where("project_id = ? AND status IN ?", projectID, []string{model.RefundApplicationStatusPending, model.RefundApplicationStatusApproved}).Order("id DESC").First(&application).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return 0, nil
		}
		return 0, err
	}
	return application.ID, nil
}

func bookingIDFromProjectComplaintTx(tx *gorm.DB, projectID uint64) (uint64, error) {
	var order model.Order
	if err := tx.Where("project_id = ? AND booking_id > 0", projectID).Order("id ASC").First(&order).Error; err == nil {
		return order.BookingID, nil
	}
	return 0, nil
}

func extractRefundAmount(plan map[string]interface{}) float64 {
	if len(plan) == 0 {
		return 0
	}
	for _, key := range []string{"refundAmount", "refund_amount", "amount"} {
		if value, ok := plan[key]; ok {
			switch typed := value.(type) {
			case float64:
				return normalizeAmount(typed)
			case int:
				return normalizeAmount(float64(typed))
			case int64:
				return normalizeAmount(float64(typed))
			case string:
				parsed := strings.TrimSpace(typed)
				if parsed == "" {
					continue
				}
				var amount float64
				fmt.Sscanf(parsed, "%f", &amount)
				return normalizeAmount(amount)
			}
		}
	}
	return 0
}

func extractContinueConstruction(plan map[string]interface{}) bool {
	if len(plan) == 0 {
		return false
	}
	if value, ok := plan["continueConstruction"]; ok {
		switch typed := value.(type) {
		case bool:
			return typed
		case string:
			return strings.EqualFold(strings.TrimSpace(typed), "true")
		}
	}
	if value, ok := plan["continue_construction"]; ok {
		switch typed := value.(type) {
		case bool:
			return typed
		case string:
			return strings.EqualFold(strings.TrimSpace(typed), "true")
		}
	}
	return false
}

func (s *ProjectAuditService) buildProjectAuditViewTx(db *gorm.DB, audit *model.ProjectAudit) (*ProjectAuditView, error) {
	if audit == nil {
		return nil, errors.New("审计单不存在")
	}
	view := &ProjectAuditView{
		ID:                  audit.ID,
		ProjectID:           audit.ProjectID,
		AuditType:           audit.AuditType,
		Status:              audit.Status,
		ComplaintID:         audit.ComplaintID,
		RefundApplicationID: audit.RefundApplicationID,
		AuditNotes:          audit.AuditNotes,
		Conclusion:          audit.Conclusion,
		ConclusionReason:    audit.ConclusionReason,
		ExecutionPlan:       parseJSONObject(audit.ExecutionPlan),
		AdminID:             audit.AdminID,
		CreatedAt:           audit.CreatedAt,
		UpdatedAt:           audit.UpdatedAt,
		CompletedAt:         audit.CompletedAt,
	}

	var project model.Project
	if err := db.First(&project, audit.ProjectID).Error; err == nil {
		view.ProjectName = project.Name
		view.Project = map[string]interface{}{
			"id":             project.ID,
			"name":           project.Name,
			"status":         project.Status,
			"businessStatus": project.BusinessStatus,
			"currentPhase":   project.CurrentPhase,
			"disputedAt":     project.DisputedAt,
			"disputeReason":  project.DisputeReason,
		}
		var owner model.User
		_ = db.Select("id, nickname, phone").First(&owner, project.OwnerID).Error
		view.User = map[string]interface{}{
			"id":       owner.ID,
			"nickname": owner.Nickname,
			"phone":    owner.Phone,
		}
		var provider model.Provider
		_ = db.Select("id, company_name, user_id").First(&provider, project.ProviderID).Error
		view.Provider = map[string]interface{}{
			"id":          provider.ID,
			"companyName": provider.CompanyName,
			"userId":      provider.UserID,
		}
		var escrow model.EscrowAccount
		if err := db.Where("project_id = ?", project.ID).First(&escrow).Error; err == nil {
			view.Escrow = map[string]interface{}{
				"id":              escrow.ID,
				"status":          escrow.Status,
				"totalAmount":     escrow.TotalAmount,
				"frozenAmount":    escrow.FrozenAmount,
				"releasedAmount":  escrow.ReleasedAmount,
				"availableAmount": escrow.AvailableAmount,
			}
		}
	}
	if audit.ComplaintID > 0 {
		var complaint model.Complaint
		if err := db.First(&complaint, audit.ComplaintID).Error; err == nil {
			view.Complaint = map[string]interface{}{
				"id":               complaint.ID,
				"category":         complaint.Category,
				"title":            complaint.Title,
				"description":      complaint.Description,
				"status":           complaint.Status,
				"resolution":       complaint.Resolution,
				"freezePayment":    complaint.FreezePayment,
				"merchantResponse": complaint.MerchantResponse,
				"evidence":         ParseStringList(complaint.EvidenceURLs),
			}
		}
	}
	if audit.RefundApplicationID > 0 {
		var application model.RefundApplication
		if err := db.First(&application, audit.RefundApplicationID).Error; err == nil {
			refundView, err := (&RefundApplicationService{}).buildRefundApplicationViewTx(db, &application)
			if err != nil {
				return nil, err
			}
			view.RefundApplication = refundView
		}
	}
	return view, nil
}
