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

func (d *NotificationDispatcher) NotifyProjectCompletionSubmitted(ownerUserID, projectID uint64) {
	if ownerUserID == 0 || projectID == 0 {
		return
	}
	_ = d.service.Create(&CreateNotificationInput{
		UserID:      ownerUserID,
		UserType:    "user",
		Title:       "完工材料待验收",
		Content:     "商家已提交完工材料，请尽快查看并确认。",
		Type:        "project.completion.submitted",
		RelatedID:   projectID,
		RelatedType: "project",
		ActionURL:   fmt.Sprintf("/projects/%d/completion", projectID),
		Extra: map[string]interface{}{
			"projectId": projectID,
		},
	})
}

func (d *NotificationDispatcher) NotifyProjectCompletionDecision(providerUserID, projectID uint64, approved bool, reason string) {
	if providerUserID == 0 || projectID == 0 {
		return
	}
	title := "完工验收已通过"
	content := "业主已通过完工验收，项目已进入归档收口。"
	notificationType := "project.completion.approved"
	if !approved {
		title = "完工验收被驳回"
		content = fmt.Sprintf("业主已驳回完工材料。原因：%s", strings.TrimSpace(reason))
		notificationType = "project.completion.rejected"
	}
	_ = d.service.Create(&CreateNotificationInput{
		UserID:      providerUserID,
		UserType:    "provider",
		Title:       title,
		Content:     content,
		Type:        notificationType,
		RelatedID:   projectID,
		RelatedType: "project",
		ActionURL:   fmt.Sprintf("/projects/%d", projectID),
		Extra: map[string]interface{}{
			"projectId": projectID,
			"reason":    strings.TrimSpace(reason),
		},
	})
}

func (d *NotificationDispatcher) NotifyProviderRefundApplicationCreated(providerUserID, refundApplicationID, projectID, bookingID uint64) {
	if providerUserID == 0 || refundApplicationID == 0 {
		return
	}
	_ = d.service.Create(&CreateNotificationInput{
		UserID:      providerUserID,
		UserType:    "provider",
		Title:       "新的退款申请待处理",
		Content:     "业主已发起退款申请，请及时查看并跟进。",
		Type:        "refund.application.created",
		RelatedID:   refundApplicationID,
		RelatedType: "refund_application",
		ActionURL:   buildProviderRefundActionURL(projectID, bookingID),
		Extra: map[string]interface{}{
			"refundApplicationId": refundApplicationID,
			"projectId":           projectID,
			"bookingId":           bookingID,
		},
	})
}

func (d *NotificationDispatcher) NotifyAdminRefundApplicationCreated(refundApplicationID, bookingID, projectID uint64) {
	if refundApplicationID == 0 {
		return
	}
	_ = d.service.NotifyAdmins(&CreateNotificationInput{
		Title:       "新的退款申请待审核",
		Content:     fmt.Sprintf("预约 #%d 提交了退款申请", bookingID),
		Type:        "refund.application.created",
		RelatedID:   refundApplicationID,
		RelatedType: "refund_application",
		ActionURL:   buildAdminRefundActionURL(refundApplicationID),
		Extra: map[string]interface{}{
			"refundApplicationId": refundApplicationID,
			"projectId":           projectID,
			"bookingId":           bookingID,
		},
	})
}

func (d *NotificationDispatcher) NotifyProviderRefundApplicationDecision(providerUserID, refundApplicationID, projectID, bookingID uint64, approved bool) {
	if providerUserID == 0 || refundApplicationID == 0 {
		return
	}
	title := "退款申请已通过"
	content := "平台已通过退款申请，请关注项目或预约后续状态。"
	notificationType := "refund.application.approved"
	if !approved {
		title = "退款申请已驳回"
		content = "平台已驳回退款申请，请关注后续处理。"
		notificationType = "refund.application.rejected"
	}
	_ = d.service.Create(&CreateNotificationInput{
		UserID:      providerUserID,
		UserType:    "provider",
		Title:       title,
		Content:     content,
		Type:        notificationType,
		RelatedID:   refundApplicationID,
		RelatedType: "refund_application",
		ActionURL:   buildProviderRefundActionURL(projectID, bookingID),
		Extra: map[string]interface{}{
			"refundApplicationId": refundApplicationID,
			"projectId":           projectID,
			"bookingId":           bookingID,
		},
	})
}

func (d *NotificationDispatcher) NotifyUserRefundApplicationDecision(userID, refundApplicationID, bookingID uint64, approved bool, content string) {
	if userID == 0 || refundApplicationID == 0 {
		return
	}
	title := "退款申请已处理"
	notificationType := "refund.application.approved"
	if !approved {
		title = "退款申请已驳回"
		notificationType = "refund.application.rejected"
	}
	message := strings.TrimSpace(content)
	if message == "" {
		message = "您的退款申请状态已更新，请查看详情。"
	}
	_ = d.service.Create(&CreateNotificationInput{
		UserID:      userID,
		UserType:    "user",
		Title:       title,
		Content:     message,
		Type:        notificationType,
		RelatedID:   refundApplicationID,
		RelatedType: "refund_application",
		ActionURL:   buildBookingRefundActionURL(bookingID),
		Extra: map[string]interface{}{
			"refundApplicationId": refundApplicationID,
			"bookingId":           bookingID,
		},
	})
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

func buildProviderRefundActionURL(projectID, bookingID uint64) string {
	if projectID > 0 {
		return buildProjectDisputeActionURL(projectID)
	}
	if bookingID > 0 {
		return "/bookings"
	}
	return ""
}
