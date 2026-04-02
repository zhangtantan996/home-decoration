package service

import (
	"encoding/json"
	"errors"
	"strings"
	"time"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	imgutil "home-decoration-server/internal/utils/image"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type ProjectCompletionPayload struct {
	Photos []string `json:"photos"`
	Notes  string   `json:"notes"`
}

type ProjectCompletionDetail struct {
	ProjectID                 uint64     `json:"projectId"`
	BusinessStage             string     `json:"businessStage"`
	FlowSummary               string     `json:"flowSummary"`
	AvailableActions          []string   `json:"availableActions"`
	CompletedPhotos           []string   `json:"completedPhotos"`
	CompletionNotes           string     `json:"completionNotes"`
	CompletionSubmittedAt     *time.Time `json:"completionSubmittedAt,omitempty"`
	CompletionRejectionReason string     `json:"completionRejectionReason,omitempty"`
	CompletionRejectedAt      *time.Time `json:"completionRejectedAt,omitempty"`
	InspirationCaseDraftID    uint64     `json:"inspirationCaseDraftId,omitempty"`
}

type ProjectCompletionApprovalResult struct {
	Detail  *ProjectCompletionDetail
	AuditID uint64
	Project *model.Project
}

func isProjectCompletionPending(project *model.Project) bool {
	if project == nil {
		return false
	}
	return project.Status == model.ProjectStatusCompleted &&
		project.BusinessStatus == model.ProjectBusinessStatusCompleted &&
		strings.TrimSpace(project.CurrentPhase) == "已完工待验收"
}

func ensureCompletionSubmissionApprovable(project *model.Project, action string) error {
	if err := ensureProjectExecutionAllowed(project, action); err != nil {
		return err
	}
	if !isProjectCompletionPending(project) {
		return errors.New("当前项目不处于待整体验收状态")
	}
	if project.CompletionSubmittedAt == nil {
		return errors.New("项目尚未提交完工材料")
	}
	if project.CompletionRejectedAt != nil || strings.TrimSpace(project.CompletionRejectionReason) != "" {
		return errors.New("当前完工提交已失效，请等待商家重新提交")
	}
	if project.InspirationCaseDraftID > 0 {
		return errors.New("项目已归档，不能重复处理完工提交")
	}
	return nil
}

func (s *ProjectService) SubmitProjectCompletion(projectID, providerID uint64, req *ProjectCompletionPayload) (*ProjectCompletionDetail, error) {
	if err := validateProjectCompletionPayload(req); err != nil {
		return nil, err
	}

	var detail *ProjectCompletionDetail
	var ownerUserID uint64
	now := time.Now()
	err := repository.DB.Transaction(func(tx *gorm.DB) error {
		var project model.Project
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&project, projectID).Error; err != nil {
			return errors.New("项目不存在")
		}
		if !canProjectProviderOperate(&project, providerID) {
			return errors.New("无权操作此项目")
		}
		if err := ensureProjectExecutionAllowed(&project, "提交完工材料"); err != nil {
			return err
		}
		if project.InspirationCaseDraftID > 0 {
			return errors.New("项目已归档，不能重复提交完工材料")
		}
		ready, err := projectReadyForCompletion(tx, projectID)
		if err != nil {
			return err
		}
		if !ready {
			return errors.New("仍有未完成验收节点，不能提交完工")
		}
		ownerUserID = project.OwnerID

		photosJSON, err := json.Marshal(normalizeStoredAssetSlice(req.Photos))
		if err != nil {
			return err
		}
		if err := tx.Model(&project).Updates(map[string]interface{}{
			"completed_photos":            string(photosJSON),
			"completion_notes":            strings.TrimSpace(req.Notes),
			"completion_submitted_at":     now,
			"completion_rejection_reason": "",
			"completion_rejected_at":      nil,
			"status":                      model.ProjectStatusCompleted,
			"business_status":             model.ProjectBusinessStatusCompleted,
			"current_phase":               "已完工待验收",
			"actual_end":                  now,
		}).Error; err != nil {
			return err
		}
		if err := businessFlowSvc.AdvanceByProject(tx, projectID, map[string]interface{}{
			"current_stage": model.BusinessFlowStageCompleted,
		}); err != nil {
			return err
		}
		reloaded, err := s.getProjectCompletionDetailTx(tx, projectID)
		if err != nil {
			return err
		}
		detail = reloaded
		return nil
	})
	if err != nil {
		return nil, err
	}
	NewNotificationDispatcher().NotifyProjectCompletionSubmitted(ownerUserID, projectID)
	return detail, nil
}

func (s *ProjectService) GetProjectCompletion(projectID, userID uint64) (*ProjectCompletionDetail, error) {
	var project model.Project
	if err := repository.DB.First(&project, projectID).Error; err != nil {
		return nil, errors.New("项目不存在")
	}
	if project.OwnerID != userID {
		return nil, errors.New("无权查看此项目")
	}
	return s.getProjectCompletionDetail(projectID)
}

func (s *ProjectService) ApproveProjectCompletion(projectID, userID uint64) (*ProjectCompletionApprovalResult, error) {
	var (
		detail           *ProjectCompletionDetail
		generatedProject *model.Project
		audit            *model.CaseAudit
		providerUserID   uint64
	)
	err := repository.DB.Transaction(func(tx *gorm.DB) error {
		var project model.Project
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&project, projectID).Error; err != nil {
			return errors.New("项目不存在")
		}
		if project.OwnerID != userID {
			return errors.New("无权操作此项目")
		}
		if err := ensureCompletionSubmissionApprovable(&project, "审批完工材料"); err != nil {
			return err
		}

		providerID := effectiveProjectProviderID(&project)
		providerUserID = getProviderUserIDTx(tx, providerID)
		if err := s.scheduleAllUnreleasedMilestoneSettlementsTx(tx, &project, &ReleaseMilestoneInput{
			ProjectID:    projectID,
			OperatorType: "user",
			OperatorID:   userID,
			Reason:       "整体验收进入待结算",
			Source:       "project.completion_approve",
		}); err != nil {
			return err
		}

		var err error
		generatedProject, audit, err = GenerateCaseDraftFromProjectTx(tx, projectID, providerID, &ProjectCaseDraftInput{})
		if err != nil {
			return err
		}
		detail, err = s.getProjectCompletionDetailTx(tx, projectID)
		return err
	})
	if err != nil {
		return nil, err
	}
	NewNotificationDispatcher().NotifyProjectCompletionDecision(providerUserID, projectID, true, "")
	return &ProjectCompletionApprovalResult{Detail: detail, AuditID: audit.ID, Project: generatedProject}, nil
}

func (s *ProjectService) scheduleAllUnreleasedMilestoneSettlementsTx(tx *gorm.DB, project *model.Project, input *ReleaseMilestoneInput) error {
	if tx == nil {
		return errors.New("事务不能为空")
	}
	if project == nil || project.ID == 0 {
		return errors.New("项目不存在")
	}
	if input == nil {
		return errors.New("结算参数不能为空")
	}
	var milestones []model.Milestone
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
		Where("project_id = ? AND status = ? AND released_at IS NULL", project.ID, model.MilestoneStatusAccepted).
		Order("seq ASC, id ASC").
		Find(&milestones).Error; err != nil {
		return err
	}

	settlementSvc := &SettlementService{}
	for _, milestone := range milestones {
		if _, _, _, _, err := settlementSvc.CreateMilestoneSettlementScheduleTx(tx, &ReleaseMilestoneInput{
			ProjectID:    project.ID,
			MilestoneID:  milestone.ID,
			OperatorType: input.OperatorType,
			OperatorID:   input.OperatorID,
			Reason:       input.Reason,
			Source:       input.Source,
		}); err != nil {
			return err
		}
	}
	return tx.Model(&model.EscrowAccount{}).
		Where("project_id = ? AND status != ?", project.ID, escrowStatusClosed).
		Update("status", escrowStatusClosed).Error
}

func (s *ProjectService) AdminApproveProjectCompletion(projectID, adminID uint64, reason string) (*ProjectCompletionApprovalResult, error) {
	reason = strings.TrimSpace(reason)
	if reason == "" {
		return nil, errors.New("请填写操作原因")
	}

	var (
		detail           *ProjectCompletionDetail
		generatedProject *model.Project
		audit            *model.CaseAudit
		providerUserID   uint64
	)
	err := repository.DB.Transaction(func(tx *gorm.DB) error {
		var project model.Project
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&project, projectID).Error; err != nil {
			return errors.New("项目不存在")
		}
		if err := ensureCompletionSubmissionApprovable(&project, "管理员审批完工材料"); err != nil {
			return err
		}
		providerID := effectiveProjectProviderID(&project)
		providerUserID = getProviderUserIDTx(tx, providerID)

		beforeState := map[string]interface{}{
			"project": map[string]interface{}{
				"id":                     project.ID,
				"status":                 project.Status,
				"businessStatus":         project.BusinessStatus,
				"currentPhase":           project.CurrentPhase,
				"completionSubmittedAt":  project.CompletionSubmittedAt,
				"inspirationCaseDraftId": project.InspirationCaseDraftID,
			},
		}

		if err := s.scheduleAllUnreleasedMilestoneSettlementsTx(tx, &project, &ReleaseMilestoneInput{
			ProjectID:    projectID,
			OperatorType: "admin",
			OperatorID:   adminID,
			Reason:       reason,
			Source:       "admin.project_completion_approve",
		}); err != nil {
			return err
		}

		var err error
		generatedProject, audit, err = GenerateCaseDraftFromProjectTx(tx, projectID, providerID, &ProjectCaseDraftInput{})
		if err != nil {
			return err
		}
		if err := (&AuditLogService{}).CreateBusinessRecordTx(tx, &CreateAuditRecordInput{
			OperatorType:  "admin",
			OperatorID:    adminID,
			OperationType: "approve_project_completion",
			ResourceType:  "project",
			ResourceID:    projectID,
			Reason:        reason,
			Result:        "success",
			BeforeState:   beforeState,
			AfterState: map[string]interface{}{
				"project": map[string]interface{}{
					"id":                     generatedProject.ID,
					"status":                 generatedProject.Status,
					"businessStatus":         generatedProject.BusinessStatus,
					"currentPhase":           generatedProject.CurrentPhase,
					"inspirationCaseDraftId": generatedProject.InspirationCaseDraftID,
				},
				"caseAudit": map[string]interface{}{
					"id":     audit.ID,
					"status": audit.Status,
				},
			},
			Metadata: map[string]interface{}{
				"projectId":   projectID,
				"caseAuditId": audit.ID,
			},
		}); err != nil {
			return err
		}
		detail, err = s.getProjectCompletionDetailTx(tx, projectID)
		return err
	})
	if err != nil {
		return nil, err
	}
	NewNotificationDispatcher().NotifyProjectCompletionDecision(providerUserID, projectID, true, "")
	return &ProjectCompletionApprovalResult{Detail: detail, AuditID: audit.ID, Project: generatedProject}, nil
}

func (s *ProjectService) RejectProjectCompletion(projectID, userID uint64, reason string) (*ProjectCompletionDetail, error) {
	reason = strings.TrimSpace(reason)
	if reason == "" {
		return nil, errors.New("请填写驳回原因")
	}
	var detail *ProjectCompletionDetail
	var providerUserID uint64
	now := time.Now()
	err := repository.DB.Transaction(func(tx *gorm.DB) error {
		var project model.Project
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&project, projectID).Error; err != nil {
			return errors.New("项目不存在")
		}
		if project.OwnerID != userID {
			return errors.New("无权操作此项目")
		}
		if err := ensureCompletionSubmissionApprovable(&project, "驳回完工材料"); err != nil {
			return err
		}
		providerUserID = getProviderUserIDTx(tx, effectiveProjectProviderID(&project))
		if err := tx.Model(&project).Updates(map[string]interface{}{
			"status":                      model.ProjectStatusActive,
			"business_status":             model.ProjectBusinessStatusInProgress,
			"current_phase":               "完工整改中",
			"completion_submitted_at":     nil,
			"completion_rejection_reason": reason,
			"completion_rejected_at":      now,
		}).Error; err != nil {
			return err
		}
		if err := businessFlowSvc.AdvanceByProject(tx, projectID, map[string]interface{}{
			"current_stage": model.BusinessFlowStageInConstruction,
			"closed_reason": "",
		}); err != nil {
			return err
		}
		reloaded, err := s.getProjectCompletionDetailTx(tx, projectID)
		if err != nil {
			return err
		}
		detail = reloaded
		return nil
	})
	if err != nil {
		return nil, err
	}
	NewNotificationDispatcher().NotifyProjectCompletionDecision(providerUserID, projectID, false, reason)
	return detail, nil
}

func (s *ProjectService) AdminRejectProjectCompletion(projectID, adminID uint64, reason string) (*ProjectCompletionDetail, error) {
	reason = strings.TrimSpace(reason)
	if reason == "" {
		return nil, errors.New("请填写驳回原因")
	}

	var detail *ProjectCompletionDetail
	var providerUserID uint64
	now := time.Now()
	auditService := &AuditLogService{}
	err := repository.DB.Transaction(func(tx *gorm.DB) error {
		var project model.Project
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&project, projectID).Error; err != nil {
			return errors.New("项目不存在")
		}
		if err := ensureCompletionSubmissionApprovable(&project, "管理员驳回完工材料"); err != nil {
			return err
		}
		providerUserID = getProviderUserIDTx(tx, effectiveProjectProviderID(&project))
		beforeState := map[string]interface{}{
			"project": map[string]interface{}{
				"id":                    project.ID,
				"status":                project.Status,
				"businessStatus":        project.BusinessStatus,
				"currentPhase":          project.CurrentPhase,
				"completionSubmittedAt": project.CompletionSubmittedAt,
			},
		}
		if err := tx.Model(&project).Updates(map[string]interface{}{
			"status":                      model.ProjectStatusActive,
			"business_status":             model.ProjectBusinessStatusInProgress,
			"current_phase":               "完工整改中",
			"completion_submitted_at":     nil,
			"completion_rejection_reason": reason,
			"completion_rejected_at":      now,
		}).Error; err != nil {
			return err
		}
		if err := businessFlowSvc.AdvanceByProject(tx, projectID, map[string]interface{}{
			"current_stage": model.BusinessFlowStageInConstruction,
			"closed_reason": "",
		}); err != nil {
			return err
		}
		if err := auditService.CreateBusinessRecordTx(tx, &CreateAuditRecordInput{
			OperatorType:  "admin",
			OperatorID:    adminID,
			OperationType: "reject_project_completion",
			ResourceType:  "project",
			ResourceID:    project.ID,
			Reason:        reason,
			Result:        "success",
			BeforeState:   beforeState,
			AfterState: map[string]interface{}{
				"project": map[string]interface{}{
					"id":                        project.ID,
					"status":                    model.ProjectStatusActive,
					"businessStatus":            model.ProjectBusinessStatusInProgress,
					"currentPhase":              "完工整改中",
					"completionRejectedAt":      now,
					"completionRejectionReason": reason,
				},
			},
		}); err != nil {
			return err
		}
		reloaded, err := s.getProjectCompletionDetailTx(tx, projectID)
		if err != nil {
			return err
		}
		detail = reloaded
		return nil
	})
	if err != nil {
		return nil, err
	}
	NewNotificationDispatcher().NotifyProjectCompletionDecision(providerUserID, projectID, false, reason)
	return detail, nil
}

func (s *ProjectService) getProjectCompletionDetail(projectID uint64) (*ProjectCompletionDetail, error) {
	return s.getProjectCompletionDetailTx(repository.DB, projectID)
}

func (s *ProjectService) getProjectCompletionDetailTx(db *gorm.DB, projectID uint64) (*ProjectCompletionDetail, error) {
	var project model.Project
	if err := db.First(&project, projectID).Error; err != nil {
		return nil, err
	}
	var milestones []model.Milestone
	_ = db.Where("project_id = ?", project.ID).Order("seq ASC").Find(&milestones).Error
	flowSummary := s.resolveProjectFlowSummaryTx(db, &project, milestones)
	photos, err := parseProjectImageJSONArray(project.CompletedPhotos)
	if err != nil {
		return nil, err
	}
	photos = imgutil.GetFullImageURLs(photos)
	return &ProjectCompletionDetail{
		ProjectID:                 project.ID,
		BusinessStage:             flowSummary.CurrentStage,
		FlowSummary:               flowSummary.FlowSummary,
		AvailableActions:          flowSummary.AvailableActions,
		CompletedPhotos:           photos,
		CompletionNotes:           project.CompletionNotes,
		CompletionSubmittedAt:     project.CompletionSubmittedAt,
		CompletionRejectionReason: project.CompletionRejectionReason,
		CompletionRejectedAt:      project.CompletionRejectedAt,
		InspirationCaseDraftID:    project.InspirationCaseDraftID,
	}, nil
}

func projectReadyForCompletion(tx *gorm.DB, projectID uint64) (bool, error) {
	var remaining int64
	if err := tx.Model(&model.Milestone{}).
		Where("project_id = ? AND status NOT IN ?", projectID, []int8{model.MilestoneStatusAccepted, model.MilestoneStatusPaid}).
		Count(&remaining).Error; err != nil {
		return false, err
	}
	return remaining == 0, nil
}

func validateProjectCompletionPayload(req *ProjectCompletionPayload) error {
	if req == nil {
		return errors.New("参数不能为空")
	}
	if len(req.Photos) == 0 {
		return errors.New("请至少上传一张完工照片")
	}
	if len(req.Photos) > 30 {
		return errors.New("完工照片最多上传 30 张")
	}
	if len(strings.TrimSpace(req.Notes)) > 2000 {
		return errors.New("完工说明不能超过 2000 字符")
	}
	return nil
}

func parseProjectImageJSONArray(raw string) ([]string, error) {
	if strings.TrimSpace(raw) == "" {
		return []string{}, nil
	}
	var list []string
	if err := json.Unmarshal([]byte(raw), &list); err != nil {
		return nil, err
	}
	return list, nil
}
