//go:build ignore
// +build ignore

package main

import (
	"fmt"
	"log"
	"strings"
	"time"

	"home-decoration-server/internal/config"
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	"home-decoration-server/internal/service"

	"gorm.io/gorm/clause"
)

type sourceRef struct {
	SourceType string
	SourceID   uint64
}

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("加载配置失败: %v", err)
	}
	if err := repository.InitDB(&cfg.Database); err != nil {
		log.Fatalf("数据库连接失败: %v", err)
	}

	refs, err := loadMissingSourceRefs()
	if err != nil {
		log.Fatalf("查询待回填链路失败: %v", err)
	}
	if len(refs) == 0 {
		fmt.Println("business_flows 已完整，无需回填")
		return
	}

	flowSvc := service.NewAdminBusinessFlowService()
	upserted := 0
	for _, ref := range refs {
		legacyID := fmt.Sprintf("legacy-%s-%d", ref.SourceType, ref.SourceID)
		detail, err := flowSvc.GetDetail(legacyID)
		if err != nil {
			log.Printf("跳过 %s: %v", legacyID, err)
			continue
		}

		record := buildBusinessFlowRecord(detail)
		now := time.Now()
		if err := repository.DB.Clauses(clause.OnConflict{
			Columns: []clause.Column{
				{Name: "source_type"},
				{Name: "source_id"},
			},
			DoUpdates: clause.Assignments(map[string]interface{}{
				"customer_user_id":             record.CustomerUserID,
				"designer_provider_id":         record.DesignerProviderID,
				"confirmed_proposal_id":        record.ConfirmedProposalID,
				"selected_foreman_provider_id": record.SelectedForemanProviderID,
				"selected_quote_task_id":       record.SelectedQuoteTaskID,
				"selected_quote_submission_id": record.SelectedQuoteSubmissionID,
				"project_id":                   record.ProjectID,
				"inspiration_case_draft_id":    record.InspirationCaseDraftID,
				"current_stage":                record.CurrentStage,
				"stage_changed_at":             record.StageChangedAt,
				"closed_reason":                record.ClosedReason,
				"updated_at":                   now,
			}),
		}).Create(&record).Error; err != nil {
			log.Printf("回填失败 %s: %v", legacyID, err)
			continue
		}

		upserted++
		fmt.Printf("已回填 %s -> stage=%s project=%d\n", legacyID, record.CurrentStage, record.ProjectID)
	}

	fmt.Printf("回填完成，共处理 %d/%d 条缺失链路\n", upserted, len(refs))
}

func loadMissingSourceRefs() ([]sourceRef, error) {
	refs := make([]sourceRef, 0, 128)

	var bookingIDs []uint64
	if err := repository.DB.Table("bookings b").
		Select("b.id").
		Where("NOT EXISTS (SELECT 1 FROM business_flows bf WHERE bf.source_type = ? AND bf.source_id = b.id)", model.BusinessFlowSourceBooking).
		Scan(&bookingIDs).Error; err != nil {
		return nil, err
	}
	for _, id := range bookingIDs {
		refs = append(refs, sourceRef{SourceType: model.BusinessFlowSourceBooking, SourceID: id})
	}

	var demandIDs []uint64
	if err := repository.DB.Table("demands d").
		Select("d.id").
		Where("NOT EXISTS (SELECT 1 FROM business_flows bf WHERE bf.source_type = ? AND bf.source_id = d.id)", model.BusinessFlowSourceDemand).
		Scan(&demandIDs).Error; err != nil {
		return nil, err
	}
	for _, id := range demandIDs {
		refs = append(refs, sourceRef{SourceType: model.BusinessFlowSourceDemand, SourceID: id})
	}

	return refs, nil
}

func buildBusinessFlowRecord(detail *service.AdminBusinessFlowDetail) model.BusinessFlow {
	record := model.BusinessFlow{
		SourceType:     detail.SourceType,
		SourceID:       detail.SourceID,
		CurrentStage:   model.NormalizeBusinessFlowStage(detail.CurrentStage),
		StageChangedAt: detail.StageChangedAt,
		ClosedReason:   deriveClosedReason(detail),
	}
	if record.CurrentStage == "" {
		record.CurrentStage = model.BusinessFlowStageLeadPending
	}

	if detail.OwnerUser != nil {
		record.CustomerUserID = detail.OwnerUser.UserID
	}
	if detail.DesignerProvider != nil && detail.DesignerProvider.ProviderID > 0 {
		record.DesignerProviderID = detail.DesignerProvider.ProviderID
	} else if detail.Proposal != nil && detail.Proposal.DesignerID > 0 {
		record.DesignerProviderID = detail.Proposal.DesignerID
	} else if detail.Booking != nil && detail.Booking.ProviderID > 0 {
		record.DesignerProviderID = detail.Booking.ProviderID
	}
	if detail.Proposal != nil && detail.Proposal.Status == model.ProposalStatusConfirmed {
		record.ConfirmedProposalID = detail.Proposal.ID
	}
	if detail.QuoteTask != nil {
		record.SelectedQuoteTaskID = detail.QuoteTask.ID
	}
	if detail.SelectedQuoteSubmission != nil {
		record.SelectedQuoteSubmissionID = detail.SelectedQuoteSubmission.ID
	}
	if detail.Project != nil {
		record.ProjectID = detail.Project.ID
		record.InspirationCaseDraftID = detail.Project.InspirationCaseDraftID
		if detail.Project.ForemanID > 0 {
			record.SelectedForemanProviderID = detail.Project.ForemanID
		} else if detail.Project.ConstructionProviderID > 0 {
			record.SelectedForemanProviderID = detail.Project.ConstructionProviderID
		} else if detail.SelectedQuoteSubmission != nil && detail.SelectedQuoteSubmission.ProviderID > 0 {
			record.SelectedForemanProviderID = detail.SelectedQuoteSubmission.ProviderID
		}
		if record.SelectedQuoteSubmissionID == 0 {
			record.SelectedQuoteSubmissionID = detail.Project.SelectedQuoteSubmissionID
		}
	}

	return record
}

func deriveClosedReason(detail *service.AdminBusinessFlowDetail) string {
	if detail == nil {
		return ""
	}
	if detail.Project != nil {
		if reason := strings.TrimSpace(detail.Project.CompletionRejectionReason); reason != "" {
			return reason
		}
		if reason := strings.TrimSpace(detail.Project.DisputeReason); reason != "" {
			return reason
		}
		if reason := strings.TrimSpace(detail.Project.PauseReason); reason != "" {
			return reason
		}
		if reason := strings.TrimSpace(detail.Project.PaymentPausedReason); reason != "" {
			return reason
		}
	}
	if detail.Proposal != nil {
		return strings.TrimSpace(detail.Proposal.RejectionReason)
	}
	return ""
}
