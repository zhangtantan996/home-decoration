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

		photosJSON, err := json.Marshal(req.Photos)
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
	var project model.Project
	if err := repository.DB.First(&project, projectID).Error; err != nil {
		return nil, errors.New("项目不存在")
	}
	if project.OwnerID != userID {
		return nil, errors.New("无权操作此项目")
	}
	if err := ensureCompletionSubmissionApprovable(&project, "审批完工材料"); err != nil {
		return nil, err
	}

	// 完工结算：释放所有未放款的已验收里程碑资金
	if err := s.settleAllUnreleasedMilestones(projectID, userID); err != nil {
		return nil, err
	}

	providerID := project.ConstructionProviderID
	if providerID == 0 {
		providerID = project.ProviderID
	}
	generatedProject, audit, err := GenerateCaseDraftFromProject(projectID, providerID, &ProjectCaseDraftInput{})
	if err != nil {
		return nil, err
	}
	detail, err := s.getProjectCompletionDetail(projectID)
	if err != nil {
		return nil, err
	}
	return &ProjectCompletionApprovalResult{Detail: detail, AuditID: audit.ID, Project: generatedProject}, nil
}

// settleAllUnreleasedMilestones 完工时释放所有已验收但未放款的里程碑资金
func (s *ProjectService) settleAllUnreleasedMilestones(projectID, userID uint64) error {
	var milestones []model.Milestone
	if err := repository.DB.Where(
		"project_id = ? AND status = ? AND released_at IS NULL",
		projectID, model.MilestoneStatusAccepted,
	).Find(&milestones).Error; err != nil {
		return err
	}

	if len(milestones) == 0 {
		return nil
	}

	settlementSvc := &SettlementService{}

	for _, ms := range milestones {
		err := repository.DB.Transaction(func(tx *gorm.DB) error {
			_, err := settlementSvc.ReleaseMilestoneTx(tx, &ReleaseMilestoneInput{
				ProjectID:    projectID,
				MilestoneID:  ms.ID,
				OperatorType: "user",
				OperatorID:   userID,
				Reason:       "整体验收一次性放款",
				Source:       "project.completion_approve",
			})
			return err
		})
		if err != nil {
			return err
		}
	}

	// 关闭托管账户
	repository.DB.Model(&model.EscrowAccount{}).
		Where("project_id = ? AND status != ?", projectID, escrowStatusClosed).
		Update("status", escrowStatusClosed)

	return nil
}

func (s *ProjectService) RejectProjectCompletion(projectID, userID uint64, reason string) (*ProjectCompletionDetail, error) {
	reason = strings.TrimSpace(reason)
	if reason == "" {
		return nil, errors.New("请填写驳回原因")
	}
	var detail *ProjectCompletionDetail
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
	flowSummary := s.resolveProjectFlowSummary(&project, milestones)
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
