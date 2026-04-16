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

type ProjectPauseInput struct {
	Reason    string `json:"reason"`
	Initiator string `json:"initiator"`
}

type ProjectDisputeInput struct {
	Reason   string   `json:"reason"`
	Evidence []string `json:"evidence"`
}

type MerchantProjectDisputeDetail struct {
	Project           *model.Project         `json:"project,omitempty"`
	Complaint         *model.Complaint       `json:"complaint,omitempty"`
	Audit             *model.ProjectAudit    `json:"audit,omitempty"`
	Escrow            *model.EscrowAccount   `json:"escrow,omitempty"`
	ProjectID         uint64                 `json:"projectId"`
	ProjectName       string                 `json:"projectName"`
	BusinessStage     string                 `json:"businessStage"`
	FlowSummary       string                 `json:"flowSummary"`
	OwnerName         string                 `json:"ownerName"`
	ProviderName      string                 `json:"providerName"`
	DisputeReason     string                 `json:"disputeReason"`
	DisputeEvidence   []string               `json:"disputeEvidence"`
	ComplaintID       uint64                 `json:"complaintId,omitempty"`
	ComplaintStatus   string                 `json:"complaintStatus,omitempty"`
	MerchantResponse  string                 `json:"merchantResponse,omitempty"`
	ComplaintEvidence []string               `json:"complaintEvidence"`
	AuditStatus       string                 `json:"auditStatus,omitempty"`
	EscrowFrozen      bool                   `json:"escrowFrozen"`
	ExecutionPlan     map[string]interface{} `json:"executionPlan,omitempty"`
}

type ProjectDisputeSubmissionResult struct {
	Project     *model.Project `json:"project"`
	ComplaintID uint64         `json:"complaintId"`
	AuditID     uint64         `json:"auditId"`
}

type ProjectDisputeService struct{}

func (s *ProjectDisputeService) PauseProject(projectID, userID uint64, input *ProjectPauseInput) (*model.Project, error) {
	reason := strings.TrimSpace(input.Reason)
	if reason == "" {
		return nil, errors.New("请填写暂停原因")
	}

	var updated model.Project
	auditService := &AuditLogService{}
	err := repository.DB.Transaction(func(tx *gorm.DB) error {
		project, err := lockProjectByID(tx, projectID)
		if err != nil {
			return err
		}
		if project.OwnerID != userID {
			return errors.New("无权暂停此项目")
		}
		if project.BusinessStatus != model.ProjectBusinessStatusInProgress {
			return errors.New("当前项目状态不允许暂停")
		}
		if isProjectPaused(project) {
			return errors.New("项目已处于暂停状态")
		}
		if isProjectDisputed(project) {
			return errors.New("项目争议处理中，不能再发起暂停")
		}
		beforeState := financeSnapshot(project, nil)

		now := time.Now()
		updates := map[string]interface{}{
			"status":          model.ProjectStatusPaused,
			"paused_at":       now,
			"resumed_at":      nil,
			"pause_reason":    reason,
			"pause_initiator": strings.TrimSpace(input.Initiator),
		}
		if updates["pause_initiator"] == "" {
			updates["pause_initiator"] = "user"
		}
		if err := tx.Model(project).Updates(updates).Error; err != nil {
			return err
		}
		if escrow, err := loadProjectEscrowTx(tx, projectID); err != nil {
			return err
		} else if escrow != nil && escrow.AvailableAmount > 0 {
			if _, err := freezeEscrowBalanceTx(tx, projectID, escrow.AvailableAmount); err != nil {
				return err
			}
		}
		if _, err := setProjectEscrowStatusTx(tx, projectID, escrowStatusFrozen); err != nil {
			return err
		}
		if err := auditService.CreateBusinessRecordTx(tx, &CreateAuditRecordInput{
			OperatorType:  "user",
			OperatorID:    userID,
			OperationType: "pause_project",
			ResourceType:  "project",
			ResourceID:    project.ID,
			Reason:        reason,
			Result:        "success",
			BeforeState:   beforeState,
			AfterState: map[string]interface{}{
				"project": map[string]interface{}{
					"id":             project.ID,
					"status":         model.ProjectStatusPaused,
					"pausedAt":       now,
					"pauseReason":    reason,
					"pauseInitiator": updates["pause_initiator"],
				},
			},
			Metadata: map[string]interface{}{
				"initiator": updates["pause_initiator"],
			},
		}); err != nil {
			return err
		}
		return tx.First(&updated, projectID).Error
	})
	if err != nil {
		return nil, err
	}

	providerUserID := getProviderUserIDTx(repository.DB, updated.ProviderID)
	notificationService := &NotificationService{}
	if providerUserID > 0 {
		_ = notificationService.Create(&CreateNotificationInput{
			UserID:      providerUserID,
			UserType:    "provider",
			Title:       "项目已暂停",
			Content:     fmt.Sprintf("项目 #%d 已被业主暂停，原因：%s", updated.ID, reason),
			Type:        "project.paused",
			RelatedID:   updated.ID,
			RelatedType: "project",
			ActionURL:   buildProjectPauseActionURL(updated.ID),
		})
	}

	return &updated, nil
}

func (s *ProjectDisputeService) ResumeProject(projectID, userID uint64) (*model.Project, error) {
	var updated model.Project
	auditService := &AuditLogService{}
	err := repository.DB.Transaction(func(tx *gorm.DB) error {
		project, err := lockProjectByID(tx, projectID)
		if err != nil {
			return err
		}
		if project.OwnerID != userID {
			return errors.New("无权恢复此项目")
		}
		if !isProjectPaused(project) {
			return errors.New("项目当前未暂停")
		}
		beforeState := financeSnapshot(project, nil)
		now := time.Now()
		if err := tx.Model(project).Updates(map[string]interface{}{
			"status":     model.ProjectStatusActive,
			"resumed_at": now,
		}).Error; err != nil {
			return err
		}
		if !isProjectDisputed(project) {
			if escrow, err := loadProjectEscrowTx(tx, projectID); err != nil {
				return err
			} else if escrow != nil && escrow.FrozenAmount > 0 {
				if _, err := unfreezeEscrowBalanceTx(tx, projectID, escrow.FrozenAmount); err != nil {
					return err
				}
			}
			if _, err := setProjectEscrowStatusTx(tx, projectID, escrowStatusActive); err != nil {
				return err
			}
		}
		if err := auditService.CreateBusinessRecordTx(tx, &CreateAuditRecordInput{
			OperatorType:  "user",
			OperatorID:    userID,
			OperationType: "resume_project",
			ResourceType:  "project",
			ResourceID:    project.ID,
			Result:        "success",
			BeforeState:   beforeState,
			AfterState: map[string]interface{}{
				"project": map[string]interface{}{
					"id":        project.ID,
					"status":    model.ProjectStatusActive,
					"resumedAt": now,
				},
			},
		}); err != nil {
			return err
		}
		return tx.First(&updated, projectID).Error
	})
	if err != nil {
		return nil, err
	}
	return &updated, nil
}

func (s *ProjectDisputeService) AdminPauseProject(projectID, adminID uint64, input *ProjectPauseInput) (*model.Project, error) {
	reason := strings.TrimSpace(input.Reason)
	if reason == "" {
		return nil, errors.New("请填写暂停原因")
	}

	var updated model.Project
	auditService := &AuditLogService{}
	err := repository.DB.Transaction(func(tx *gorm.DB) error {
		project, err := lockProjectByID(tx, projectID)
		if err != nil {
			return err
		}
		if project.BusinessStatus != model.ProjectBusinessStatusInProgress {
			return errors.New("当前项目状态不允许暂停")
		}
		if isProjectPaused(project) {
			return errors.New("项目已处于暂停状态")
		}
		if isProjectDisputed(project) {
			return errors.New("项目争议处理中，不能再发起暂停")
		}
		beforeState := financeSnapshot(project, nil)

		now := time.Now()
		updates := map[string]interface{}{
			"status":          model.ProjectStatusPaused,
			"paused_at":       now,
			"resumed_at":      nil,
			"pause_reason":    reason,
			"pause_initiator": "admin",
		}
		if err := tx.Model(project).Updates(updates).Error; err != nil {
			return err
		}
		if escrow, err := loadProjectEscrowTx(tx, projectID); err != nil {
			return err
		} else if escrow != nil && escrow.AvailableAmount > 0 {
			if _, err := freezeEscrowBalanceTx(tx, projectID, escrow.AvailableAmount); err != nil {
				return err
			}
		}
		if _, err := setProjectEscrowStatusTx(tx, projectID, escrowStatusFrozen); err != nil {
			return err
		}
		if err := auditService.CreateBusinessRecordTx(tx, &CreateAuditRecordInput{
			OperatorType:  "admin",
			OperatorID:    adminID,
			OperationType: "pause_project",
			ResourceType:  "project",
			ResourceID:    project.ID,
			Reason:        reason,
			Result:        "success",
			BeforeState:   beforeState,
			AfterState: map[string]interface{}{
				"project": map[string]interface{}{
					"id":             project.ID,
					"status":         model.ProjectStatusPaused,
					"pausedAt":       now,
					"pauseReason":    reason,
					"pauseInitiator": "admin",
				},
			},
			Metadata: map[string]interface{}{
				"initiator": "admin",
			},
		}); err != nil {
			return err
		}
		return tx.First(&updated, projectID).Error
	})
	if err != nil {
		return nil, err
	}

	return &updated, nil
}

func (s *ProjectDisputeService) AdminResumeProject(projectID, adminID uint64, reason string) (*model.Project, error) {
	reason = strings.TrimSpace(reason)
	if reason == "" {
		return nil, errors.New("请填写恢复原因")
	}

	var updated model.Project
	auditService := &AuditLogService{}
	err := repository.DB.Transaction(func(tx *gorm.DB) error {
		project, err := lockProjectByID(tx, projectID)
		if err != nil {
			return err
		}
		if !isProjectPaused(project) {
			return errors.New("项目当前未暂停")
		}
		beforeState := financeSnapshot(project, nil)
		now := time.Now()
		if err := tx.Model(project).Updates(map[string]interface{}{
			"status":     model.ProjectStatusActive,
			"resumed_at": now,
		}).Error; err != nil {
			return err
		}
		if !isProjectDisputed(project) {
			if escrow, err := loadProjectEscrowTx(tx, projectID); err != nil {
				return err
			} else if escrow != nil && escrow.FrozenAmount > 0 {
				if _, err := unfreezeEscrowBalanceTx(tx, projectID, escrow.FrozenAmount); err != nil {
					return err
				}
			}
			if _, err := setProjectEscrowStatusTx(tx, projectID, escrowStatusActive); err != nil {
				return err
			}
		}
		if err := auditService.CreateBusinessRecordTx(tx, &CreateAuditRecordInput{
			OperatorType:  "admin",
			OperatorID:    adminID,
			OperationType: "resume_project",
			ResourceType:  "project",
			ResourceID:    project.ID,
			Reason:        reason,
			Result:        "success",
			BeforeState:   beforeState,
			AfterState: map[string]interface{}{
				"project": map[string]interface{}{
					"id":        project.ID,
					"status":    model.ProjectStatusActive,
					"resumedAt": now,
				},
			},
		}); err != nil {
			return err
		}
		return tx.First(&updated, projectID).Error
	})
	if err != nil {
		return nil, err
	}
	return &updated, nil
}

func (s *ProjectDisputeService) SubmitProjectDispute(projectID, userID uint64, input *ProjectDisputeInput) (*ProjectDisputeSubmissionResult, error) {
	reason := strings.TrimSpace(input.Reason)
	if reason == "" {
		return nil, errors.New("请填写争议原因")
	}

	result := &ProjectDisputeSubmissionResult{}
	var providerUserID uint64
	var updatedProject model.Project
	auditService := &AuditLogService{}
	err := repository.DB.Transaction(func(tx *gorm.DB) error {
		project, err := lockProjectByID(tx, projectID)
		if err != nil {
			return err
		}
		if project.OwnerID != userID {
			return errors.New("无权对该项目发起争议")
		}
		if isProjectDisputed(project) {
			return errors.New("项目已处于争议处理中")
		}
		beforeState := financeSnapshot(project, nil)
		providerUserID = getProviderUserIDTx(tx, project.ProviderID)
		now := time.Now()
		evidenceJSON := marshalStringList(input.Evidence)
		if err := tx.Model(project).Updates(map[string]interface{}{
			"disputed_at":      now,
			"dispute_reason":   reason,
			"dispute_evidence": evidenceJSON,
			"status":           project.Status,
		}).Error; err != nil {
			return err
		}

		var complaint model.Complaint
		err = tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("project_id = ? AND category = ? AND status IN ?", projectID, "project_dispute", []string{"submitted", "processing"}).
			Order("id DESC").
			First(&complaint).Error
		if err != nil {
			if !errors.Is(err, gorm.ErrRecordNotFound) {
				return err
			}
			complaint = model.Complaint{
				ProjectID:        projectID,
				UserID:           userID,
				ProviderID:       project.ProviderID,
				Category:         "project_dispute",
				Title:            fmt.Sprintf("项目 #%d 争议申请", projectID),
				Description:      reason,
				EvidenceURLs:     evidenceJSON,
				Status:           "submitted",
				FreezePayment:    true,
				MerchantResponse: "",
			}
			if err := tx.Create(&complaint).Error; err != nil {
				return err
			}
		} else {
			if err := tx.Model(&complaint).Updates(map[string]interface{}{
				"description":    reason,
				"evidence_urls":  evidenceJSON,
				"freeze_payment": true,
				"status":         "submitted",
			}).Error; err != nil {
				return err
			}
		}

		audit, err := getOpenProjectAuditTx(tx, projectID, model.ProjectAuditTypeDispute)
		if err != nil {
			return err
		}
		if audit == nil {
			audit = &model.ProjectAudit{
				ProjectID:   projectID,
				AuditType:   model.ProjectAuditTypeDispute,
				Status:      model.ProjectAuditStatusPending,
				ComplaintID: complaint.ID,
				AuditNotes:  "系统已自动创建项目争议审计单",
			}
			if err := tx.Create(audit).Error; err != nil {
				return err
			}
		} else if audit.ComplaintID == 0 {
			if err := tx.Model(audit).Update("complaint_id", complaint.ID).Error; err != nil {
				return err
			}
			audit.ComplaintID = complaint.ID
		}

		if escrow, err := loadProjectEscrowTx(tx, projectID); err != nil {
			return err
		} else if escrow != nil && escrow.AvailableAmount > 0 {
			if _, err := freezeEscrowBalanceTx(tx, projectID, escrow.AvailableAmount); err != nil {
				return err
			}
		}
		if _, err := setProjectEscrowStatusTx(tx, projectID, escrowStatusFrozen); err != nil {
			return err
		}
		if err := businessFlowSvc.AdvanceByProject(tx, projectID, map[string]interface{}{
			"current_stage": model.BusinessFlowStageDisputed,
			"closed_reason": reason,
		}); err != nil {
			return err
		}
		if err := auditService.CreateBusinessRecordTx(tx, &CreateAuditRecordInput{
			OperatorType:  "user",
			OperatorID:    userID,
			OperationType: "submit_project_dispute",
			ResourceType:  "project",
			ResourceID:    project.ID,
			Reason:        reason,
			Result:        "success",
			BeforeState:   beforeState,
			AfterState: map[string]interface{}{
				"project": map[string]interface{}{
					"id":            project.ID,
					"status":        project.Status,
					"disputedAt":    now,
					"disputeReason": reason,
				},
				"complaint": map[string]interface{}{
					"category": "project_dispute",
				},
			},
			Metadata: map[string]interface{}{
				"evidenceCount": len(input.Evidence),
			},
		}); err != nil {
			return err
		}
		if err := tx.First(&updatedProject, projectID).Error; err != nil {
			return err
		}
		result.Project = &updatedProject
		result.ComplaintID = complaint.ID
		result.AuditID = audit.ID
		return nil
	})
	if err != nil {
		return nil, err
	}

	NewNotificationDispatcher().NotifyProjectDisputeCreated(providerUserID, result.AuditID, projectID)

	return result, nil
}

func (s *ProjectDisputeService) GetMerchantProjectDisputeDetail(projectID, providerID uint64) (*MerchantProjectDisputeDetail, error) {
	if providerID == 0 {
		return nil, errors.New("无权查看项目争议")
	}
	var project model.Project
	if err := repository.DB.First(&project, projectID).Error; err != nil {
		return nil, errors.New("项目不存在")
	}
	if !canProjectProviderOperate(&project, providerID) {
		return nil, errors.New("无权查看项目争议")
	}
	return s.loadProjectDisputeDetail(repository.DB, &project)
}

func (s *ProjectDisputeService) RespondProjectDispute(projectID, providerID uint64, responseText string) (*model.Complaint, error) {
	responseText = strings.TrimSpace(responseText)
	if responseText == "" {
		return nil, errors.New("请填写商家说明")
	}
	var updated model.Complaint
	err := repository.DB.Transaction(func(tx *gorm.DB) error {
		var project model.Project
		if err := tx.First(&project, projectID).Error; err != nil {
			return errors.New("项目不存在")
		}
		if !canProjectProviderOperate(&project, providerID) {
			return errors.New("无权处理该项目争议")
		}
		var complaint model.Complaint
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("project_id = ? AND category = ?", projectID, "project_dispute").
			Order("id DESC").
			First(&complaint).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return errors.New("项目暂无争议记录")
			}
			return err
		}
		updates := map[string]interface{}{
			"merchant_response": responseText,
		}
		if complaint.Status == "submitted" {
			updates["status"] = "processing"
		}
		if err := tx.Model(&complaint).Updates(updates).Error; err != nil {
			return err
		}
		if audit, err := getOpenProjectAuditTx(tx, projectID, model.ProjectAuditTypeDispute); err == nil && audit != nil && audit.Status == model.ProjectAuditStatusPending {
			if err := tx.Model(audit).Update("status", model.ProjectAuditStatusInProgress).Error; err != nil {
				return err
			}
		}
		return tx.First(&updated, complaint.ID).Error
	})
	if err != nil {
		return nil, err
	}
	return &updated, nil
}

func (s *ProjectDisputeService) loadProjectDisputeDetail(db *gorm.DB, project *model.Project) (*MerchantProjectDisputeDetail, error) {
	if project == nil {
		return nil, errors.New("项目不存在")
	}
	var complaint *model.Complaint
	var complaintModel model.Complaint
	if err := db.Where("project_id = ? AND category = ?", project.ID, "project_dispute").Order("id DESC").First(&complaintModel).Error; err == nil {
		complaint = &complaintModel
	}

	var audit *model.ProjectAudit
	var auditModel model.ProjectAudit
	if err := db.Where("project_id = ?", project.ID).Order("id DESC").First(&auditModel).Error; err == nil {
		audit = &auditModel
	}

	var escrow *model.EscrowAccount
	var escrowModel model.EscrowAccount
	if err := db.Where("project_id = ?", project.ID).First(&escrowModel).Error; err == nil {
		escrow = &escrowModel
	}

	var owner model.User
	_ = db.Select("nickname").First(&owner, project.OwnerID).Error
	var provider model.Provider
	_ = db.Select("id", "user_id", "company_name").First(&provider, project.ProviderID).Error
	var providerUser model.User
	if provider.UserID > 0 {
		_ = db.Select("nickname", "phone").First(&providerUser, provider.UserID).Error
	}

	detail := &MerchantProjectDisputeDetail{
		Project:       project,
		Complaint:     complaint,
		Audit:         audit,
		Escrow:        escrow,
		ProjectID:     project.ID,
		ProjectName:   project.Name,
		BusinessStage: "",
		FlowSummary:   "",
		OwnerName:     owner.Nickname,
		ProviderName: ResolveProviderDisplayName(provider, func() *model.User {
			if provider.UserID > 0 {
				return &providerUser
			}
			return nil
		}()),
		DisputeReason:     project.DisputeReason,
		DisputeEvidence:   ParseStringList(project.DisputeEvidence),
		ComplaintEvidence: []string{},
		EscrowFrozen:      escrow != nil && escrow.Status == escrowStatusFrozen,
		ExecutionPlan:     map[string]interface{}{},
	}
	var milestones []model.Milestone
	_ = db.Where("project_id = ?", project.ID).Order("seq ASC").Find(&milestones).Error
	flowSummary := (&ProjectService{}).resolveProjectFlowSummary(project, milestones)
	detail.BusinessStage = flowSummary.CurrentStage
	detail.FlowSummary = flowSummary.FlowSummary
	if complaint != nil {
		detail.ComplaintID = complaint.ID
		detail.ComplaintStatus = complaint.Status
		detail.MerchantResponse = complaint.MerchantResponse
		detail.ComplaintEvidence = ParseStringList(complaint.EvidenceURLs)
	}
	if audit != nil {
		detail.AuditStatus = audit.Status
		detail.ExecutionPlan = parseJSONObject(audit.ExecutionPlan)
	}
	return detail, nil
}
