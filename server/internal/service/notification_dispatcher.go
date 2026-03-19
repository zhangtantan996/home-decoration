package service

import (
	"fmt"
	"strings"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
)

type NotificationDispatcher struct {
	service *NotificationService
}

func NewNotificationDispatcher() *NotificationDispatcher {
	return &NotificationDispatcher{service: &NotificationService{}}
}

func (d *NotificationDispatcher) NotifyQuoteSubmittedToUser(ownerUserID, quoteListID, projectID uint64, providerName string) {
	if ownerUserID == 0 {
		return
	}
	content := "施工报价已提交，请尽快查看并确认。"
	if strings.TrimSpace(providerName) != "" {
		content = fmt.Sprintf("%s 已提交施工报价，请尽快查看并确认。", strings.TrimSpace(providerName))
	}
	_ = d.service.Create(&CreateNotificationInput{
		UserID:      ownerUserID,
		UserType:    "user",
		Title:       "施工报价待确认",
		Content:     content,
		Type:        "quote.submitted",
		RelatedID:   quoteListID,
		RelatedType: "quote_list",
		ActionURL:   fmt.Sprintf("/quote-tasks/%d", quoteListID),
		Extra: map[string]interface{}{
			"quoteListId": quoteListID,
			"projectId":   projectID,
		},
	})
}

func (d *NotificationDispatcher) NotifyQuoteDecision(providerUserID, quoteListID, projectID uint64, approved bool, reason string) {
	if providerUserID == 0 {
		return
	}
	title := "施工报价已确认"
	content := "用户已确认施工报价，请按计划推进项目。"
	notificationType := "quote.confirmed"
	if !approved {
		title = "施工报价被拒绝"
		content = fmt.Sprintf("用户已拒绝施工报价。原因：%s", strings.TrimSpace(reason))
		notificationType = "quote.rejected"
	}
	_ = d.service.Create(&CreateNotificationInput{
		UserID:      providerUserID,
		UserType:    "provider",
		Title:       title,
		Content:     content,
		Type:        notificationType,
		RelatedID:   quoteListID,
		RelatedType: "quote_list",
		ActionURL:   fmt.Sprintf("/quote-lists/%d", quoteListID),
		Extra: map[string]interface{}{
			"quoteListId": quoteListID,
			"projectId":   projectID,
			"reason":      strings.TrimSpace(reason),
		},
	})
}

func (d *NotificationDispatcher) NotifyMilestoneDecision(ownerUserID, providerUserID, projectID, milestoneID uint64, milestoneName string, approved bool, reason string) {
	title := "阶段验收结果已更新"
	content := fmt.Sprintf("阶段“%s”验收已通过。", milestoneName)
	notificationType := "project.milestone.approved"
	if !approved {
		content = fmt.Sprintf("阶段“%s”验收未通过。原因：%s", milestoneName, strings.TrimSpace(reason))
		notificationType = "project.milestone.rejected"
	}

	if ownerUserID > 0 {
		_ = d.service.Create(&CreateNotificationInput{
			UserID:      ownerUserID,
			UserType:    "user",
			Title:       title,
			Content:     content,
			Type:        notificationType,
			RelatedID:   milestoneID,
			RelatedType: "milestone",
			ActionURL:   fmt.Sprintf("/projects/%d", projectID),
		})
	}

	if providerUserID > 0 {
		_ = d.service.Create(&CreateNotificationInput{
			UserID:      providerUserID,
			UserType:    "provider",
			Title:       title,
			Content:     content,
			Type:        notificationType,
			RelatedID:   milestoneID,
			RelatedType: "milestone",
			ActionURL:   fmt.Sprintf("/projects/%d", projectID),
		})
	}
}

func (d *NotificationDispatcher) NotifyProjectAuditCompleted(auditID, projectID, ownerUserID, providerUserID uint64, conclusion, reason string) {
	title := "项目仲裁结果已出"
	content := fmt.Sprintf("项目审计已完成，结论：%s。%s", conclusion, reason)
	if ownerUserID > 0 {
		_ = d.service.Create(&CreateNotificationInput{
			UserID:      ownerUserID,
			UserType:    "user",
			Title:       title,
			Content:     content,
			Type:        "project.audit.completed",
			RelatedID:   auditID,
			RelatedType: "project_audit",
			ActionURL:   buildProjectDisputeActionURL(projectID),
		})
	}
	if providerUserID > 0 {
		_ = d.service.Create(&CreateNotificationInput{
			UserID:      providerUserID,
			UserType:    "provider",
			Title:       title,
			Content:     content,
			Type:        "project.audit.completed",
			RelatedID:   auditID,
			RelatedType: "project_audit",
			ActionURL:   buildProjectDisputeActionURL(projectID),
		})
	}
}

func providerUserIDFromProvider(providerID uint64) uint64 {
	if providerID == 0 {
		return 0
	}
	var provider model.Provider
	if err := repository.DB.Select("user_id").First(&provider, providerID).Error; err != nil {
		return 0
	}
	return provider.UserID
}
