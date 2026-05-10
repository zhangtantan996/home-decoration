package service

import (
	"fmt"
	"strings"
	"time"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"

	"gorm.io/gorm"
)

type NotificationDispatcher struct {
	service *NotificationService
	tx      *gorm.DB
}

func NewNotificationDispatcher() *NotificationDispatcher {
	return &NotificationDispatcher{service: &NotificationService{}}
}

func NewNotificationDispatcherTx(tx *gorm.DB) *NotificationDispatcher {
	return &NotificationDispatcher{service: &NotificationService{}, tx: tx}
}

func (d *NotificationDispatcher) create(input *CreateNotificationInput) error {
	if d.tx != nil {
		return d.service.CreateTx(d.tx, input)
	}
	return d.service.Create(input)
}

func (d *NotificationDispatcher) providerUserIDFromProvider(providerID uint64) uint64 {
	if d.tx != nil {
		return providerUserIDFromProviderTx(d.tx, providerID)
	}
	return providerUserIDFromProvider(providerID)
}

func (d *NotificationDispatcher) NotifySiteSurveySubmitted(userID, bookingID, surveyID uint64) {
	if userID == 0 || bookingID == 0 || surveyID == 0 {
		return
	}
	_ = d.create(&CreateNotificationInput{
		UserID:      userID,
		UserType:    "user",
		Title:       "量房资料已上传",
		Content:     "商家已上传量房照片、尺寸和备注，你可先查看，下一步会进入沟通确认。",
		Type:        NotificationTypeSiteSurveySubmitted,
		RelatedID:   surveyID,
		RelatedType: "site_survey",
		ActionURL:   fmt.Sprintf("/bookings/%d/site-survey", bookingID),
		Category:    NotificationCategoryProject,
		Extra: map[string]interface{}{
			"bookingId": bookingID,
			"surveyId":  surveyID,
		},
	})
}

func (d *NotificationDispatcher) NotifyBudgetConfirmationSubmitted(userID, bookingID, confirmationID uint64) {
	if userID == 0 || bookingID == 0 || confirmationID == 0 {
		return
	}
	_ = d.create(&CreateNotificationInput{
		UserID:      userID,
		UserType:    "user",
		Title:       "沟通确认待处理",
		Content:     "服务商已提交沟通确认，请尽快确认或退回。",
		Type:        NotificationTypeBudgetConfirmationSubmitted,
		RelatedID:   confirmationID,
		RelatedType: "budget_confirmation",
		ActionURL:   fmt.Sprintf("/bookings/%d/budget-confirm", bookingID),
		Category:    NotificationCategoryProject,
		Extra: map[string]interface{}{
			"bookingId":      bookingID,
			"confirmationId": confirmationID,
		},
	})
}

func (d *NotificationDispatcher) NotifyBudgetConfirmationResubmitted(userID, bookingID, confirmationID uint64, rejectCount, rejectLimit int) {
	if userID == 0 || bookingID == 0 || confirmationID == 0 {
		return
	}
	_ = d.create(&CreateNotificationInput{
		UserID:      userID,
		UserType:    "user",
		Title:       "沟通确认已重提",
		Content:     fmt.Sprintf("商家已根据你的反馈重提沟通确认，请再次查看。当前驳回次数 %d/%d。", rejectCount, rejectLimit),
		Type:        NotificationTypeBudgetConfirmationResubmitted,
		RelatedID:   confirmationID,
		RelatedType: "budget_confirmation",
		ActionURL:   fmt.Sprintf("/bookings/%d/budget-confirm", bookingID),
		Category:    NotificationCategoryProject,
		Extra: map[string]interface{}{
			"bookingId":      bookingID,
			"confirmationId": confirmationID,
			"rejectCount":    rejectCount,
			"rejectLimit":    rejectLimit,
		},
	})
}

func (d *NotificationDispatcher) NotifyBudgetConfirmationRejected(providerUserID, bookingID, confirmationID uint64, rejectCount, rejectLimit int, reason string) {
	if providerUserID == 0 || bookingID == 0 || confirmationID == 0 {
		return
	}
	content := fmt.Sprintf("用户已退回沟通确认，当前驳回次数 %d/%d，请根据反馈重新整理后提交。", rejectCount, rejectLimit)
	if strings.TrimSpace(reason) != "" {
		content = fmt.Sprintf("%s 退回原因：%s", content, strings.TrimSpace(reason))
	}
	_ = d.service.Create(&CreateNotificationInput{
		UserID:      providerUserID,
		UserType:    "provider",
		Title:       "沟通确认被退回",
		Content:     content,
		Type:        NotificationTypeBudgetConfirmationRejected,
		RelatedID:   confirmationID,
		RelatedType: "budget_confirmation",
		ActionURL:   fmt.Sprintf("/bookings/%d/flow?step=budget&mode=edit", bookingID),
		Category:    NotificationCategoryProject,
		Extra: map[string]interface{}{
			"bookingId":      bookingID,
			"confirmationId": confirmationID,
			"rejectCount":    rejectCount,
			"rejectLimit":    rejectLimit,
			"reason":         strings.TrimSpace(reason),
		},
	})
}

func (d *NotificationDispatcher) NotifyDesignDeliverableSubmitted(userID, deliverableID, bookingID uint64) {
	if userID == 0 || deliverableID == 0 || bookingID == 0 {
		return
	}
	_ = d.service.Create(&CreateNotificationInput{
		UserID:      userID,
		UserType:    "user",
		Title:       "设计交付待确认",
		Content:     "设计师已提交设计交付件，请尽快查看并确认。",
		Type:        NotificationTypeDeliverableSubmitted,
		RelatedID:   deliverableID,
		RelatedType: "design_deliverable",
		ActionURL:   fmt.Sprintf("/bookings/%d/design-deliverable", bookingID),
		Category:    NotificationCategoryProject,
		Extra: map[string]interface{}{
			"bookingId":     bookingID,
			"deliverableId": deliverableID,
		},
	})
}

func (d *NotificationDispatcher) NotifyContractPendingConfirm(userID, contractID, projectID uint64) {
	if userID == 0 || contractID == 0 || projectID == 0 {
		return
	}
	_ = d.service.Create(&CreateNotificationInput{
		UserID:      userID,
		UserType:    "user",
		Title:       "合同待确认",
		Content:     "服务商已发起合同，请尽快确认。",
		Type:        NotificationTypeContractPendingConfirm,
		RelatedID:   contractID,
		RelatedType: "contract",
		ActionURL:   fmt.Sprintf("/projects/%d/contract", projectID),
		Category:    NotificationCategoryProject,
		Extra: map[string]interface{}{
			"projectId":  projectID,
			"contractId": contractID,
		},
	})
}

func (d *NotificationDispatcher) NotifyConstructionBridgePending(userID, bookingID, projectID, quoteListID uint64) {
	if userID == 0 {
		return
	}
	content := "正式方案已确认，项目已进入施工桥接阶段，待查看报价基线、施工主体选择与施工报价。"
	actionURL := "/progress"
	if quoteListID > 0 {
		content = "报价基线已准备完成，项目即将进入施工主体选择与施工报价。"
		actionURL = fmt.Sprintf("/quote-tasks/%d", quoteListID)
	} else if bookingID > 0 {
		actionURL = fmt.Sprintf("/bookings/%d", bookingID)
	} else if projectID > 0 {
		actionURL = fmt.Sprintf("/projects/%d", projectID)
	}
	_ = d.service.Create(&CreateNotificationInput{
		UserID:      userID,
		UserType:    "user",
		Title:       "进入施工桥接阶段",
		Content:     content,
		Type:        NotificationTypeConstructionBridgePending,
		RelatedID:   quoteListID,
		RelatedType: "quote_list",
		ActionURL:   actionURL,
		Category:    NotificationCategoryProject,
		Extra: map[string]interface{}{
			"projectId":   projectID,
			"bookingId":   bookingID,
			"quoteListId": quoteListID,
		},
	})
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
		Category:    NotificationCategoryProject,
		Extra: map[string]interface{}{
			"quoteListId": quoteListID,
			"projectId":   projectID,
		},
	})
}

func (d *NotificationDispatcher) NotifyLegacyQuoteTaskCreated(providerUserID, quoteTaskID, bookingID uint64) {
	if providerUserID == 0 || quoteTaskID == 0 {
		return
	}
	_ = d.service.Create(&CreateNotificationInput{
		UserID:      providerUserID,
		UserType:    "provider",
		Title:       "新的报价任务待处理",
		Content:     "有新的报价记录已分配，请尽快查看。",
		Type:        "quote.submitted",
		RelatedID:   quoteTaskID,
		RelatedType: "quote_task",
		ActionURL:   buildLegacyQuotePKProviderActionURL(quoteTaskID),
		Category:    NotificationCategoryProject,
		Extra: map[string]interface{}{
			"quoteTaskId": quoteTaskID,
			"bookingId":   bookingID,
			"sourceType":  "legacy_quote_pk",
		},
	})
}

func (d *NotificationDispatcher) NotifyLegacyQuoteSubmittedToUser(ownerUserID, quoteTaskID, submissionID uint64, providerName string) {
	if ownerUserID == 0 || quoteTaskID == 0 {
		return
	}
	content := "已有商家提交报价记录，请尽快查看。"
	if strings.TrimSpace(providerName) != "" {
		content = fmt.Sprintf("%s 已提交报价，请尽快查看。", strings.TrimSpace(providerName))
	}
	_ = d.service.Create(&CreateNotificationInput{
		UserID:      ownerUserID,
		UserType:    "user",
		Title:       "报价待确认",
		Content:     content,
		Type:        "quote.submitted",
		RelatedID:   quoteTaskID,
		RelatedType: "quote_task",
		ActionURL:   buildLegacyQuotePKUserActionURL(quoteTaskID),
		Category:    NotificationCategoryProject,
		Extra: map[string]interface{}{
			"quoteTaskId":         quoteTaskID,
			"quotePKSubmissionId": submissionID,
			"sourceType":          "legacy_quote_pk",
		},
	})
}

func (d *NotificationDispatcher) NotifyLegacyQuoteSelected(providerUserID, quoteTaskID, submissionID uint64) {
	if providerUserID == 0 || quoteTaskID == 0 {
		return
	}
	_ = d.service.Create(&CreateNotificationInput{
		UserID:      providerUserID,
		UserType:    "provider",
		Title:       "报价已中选",
		Content:     "用户已选择你的报价记录，请及时跟进后续沟通。",
		Type:        "quote.awarded",
		RelatedID:   quoteTaskID,
		RelatedType: "quote_task",
		ActionURL:   buildLegacyQuotePKProviderActionURL(quoteTaskID),
		Category:    NotificationCategoryProject,
		Extra: map[string]interface{}{
			"quoteTaskId":         quoteTaskID,
			"quotePKSubmissionId": submissionID,
			"sourceType":          "legacy_quote_pk",
		},
	})
}

func (d *NotificationDispatcher) NotifyLegacyQuoteRejected(providerUserID, quoteTaskID, submissionID uint64) {
	if providerUserID == 0 || quoteTaskID == 0 {
		return
	}
	_ = d.service.Create(&CreateNotificationInput{
		UserID:      providerUserID,
		UserType:    "provider",
		Title:       "报价未中选",
		Content:     "该报价记录已完成，当前方案未被用户选择。",
		Type:        "quote.rejected",
		RelatedID:   quoteTaskID,
		RelatedType: "quote_task",
		ActionURL:   buildLegacyQuotePKProviderActionURL(quoteTaskID),
		Category:    NotificationCategoryProject,
		Extra: map[string]interface{}{
			"quoteTaskId":         quoteTaskID,
			"quotePKSubmissionId": submissionID,
			"sourceType":          "legacy_quote_pk",
		},
	})
}

func (d *NotificationDispatcher) NotifyQuoteDecision(providerUserID, quoteListID, projectID uint64, approved bool, reason string) {
	if providerUserID == 0 {
		return
	}
	if approved {
		d.NotifyConstructionQuoteAwarded(providerUserID, quoteListID, projectID, 0)
		return
	}
	title := "施工报价被拒绝"
	content := fmt.Sprintf("用户已拒绝施工报价。原因：%s", strings.TrimSpace(reason))
	notificationType := "quote.rejected"
	_ = d.service.Create(&CreateNotificationInput{
		UserID:      providerUserID,
		UserType:    "provider",
		Title:       title,
		Content:     content,
		Type:        notificationType,
		RelatedID:   quoteListID,
		RelatedType: "quote_list",
		ActionURL:   fmt.Sprintf("/quote-lists/%d", quoteListID),
		Category:    NotificationCategoryProject,
		Extra: map[string]interface{}{
			"quoteListId": quoteListID,
			"projectId":   projectID,
			"reason":      strings.TrimSpace(reason),
		},
	})
}

func (d *NotificationDispatcher) NotifyConstructionQuoteAwarded(providerUserID, quoteListID, projectID, orderID uint64) {
	d.notifyConstructionQuoteAwarded(providerUserID, quoteListID, projectID, orderID)
}

func (d *NotificationDispatcher) NotifyProjectConstructionQuoteAwarded(providerUserID, projectID uint64) {
	d.notifyConstructionQuoteAwarded(providerUserID, 0, projectID, 0)
}

func (d *NotificationDispatcher) notifyConstructionQuoteAwarded(providerUserID, quoteListID, projectID, orderID uint64) {
	relatedID := quoteListID
	relatedType := "quote_list"
	actionURL := ""
	if projectID > 0 {
		relatedID = projectID
		relatedType = "project"
		actionURL = fmt.Sprintf("/projects/%d", projectID)
	} else if quoteListID > 0 {
		actionURL = fmt.Sprintf("/quote-tasks/%d", quoteListID)
	}
	if providerUserID > 0 {
		extra := map[string]interface{}{}
		if quoteListID > 0 {
			extra["quoteListId"] = quoteListID
		}
		if projectID > 0 {
			extra["projectId"] = projectID
		}
		if orderID > 0 {
			extra["orderId"] = orderID
		}
		_ = d.create(&CreateNotificationInput{
			UserID:      providerUserID,
			UserType:    "provider",
			Title:       "施工报价已中标",
			Content:     "用户已确认施工报价，施工订单与支付计划已生成，下一步由监理协调进场时间并推进开工。",
			Type:        "quote.awarded",
			RelatedID:   relatedID,
			RelatedType: relatedType,
			ActionURL:   actionURL,
			Category:    NotificationCategoryProject,
			Extra:       extra,
		})
	}
	if projectID == 0 {
		return
	}
	_ = d.service.NotifyAdmins(&CreateNotificationInput{
		Title:       "施工报价已确认",
		Content:     "用户已确认施工报价，项目已进入待监理协调开工阶段。",
		Type:        "quote.awarded",
		RelatedID:   projectID,
		RelatedType: "project",
		ActionURL:   fmt.Sprintf("/supervision/projects/%d", projectID),
		Category:    NotificationCategoryProject,
	})
}

func buildLegacyQuotePKUserActionURL(quoteTaskID uint64) string {
	return fmt.Sprintf("/quote-pk/tasks/%d", quoteTaskID)
}

func buildLegacyQuotePKProviderActionURL(quoteTaskID uint64) string {
	return fmt.Sprintf("/quote-pk/tasks?quoteTaskId=%d", quoteTaskID)
}

func (d *NotificationDispatcher) NotifyPlannedStartDateUpdated(userID, providerUserID, projectID uint64, plannedStartDate *time.Time) {
	if projectID == 0 || plannedStartDate == nil {
		return
	}
	formatted := plannedStartDate.Format("2006-01-02")
	if userID > 0 {
		_ = d.create(&CreateNotificationInput{
			UserID:      userID,
			UserType:    "user",
			Title:       "计划进场时间已更新",
			Content:     fmt.Sprintf("监理已同步项目计划进场时间：%s。", formatted),
			Type:        NotificationTypeProjectPlannedStartUpdated,
			RelatedID:   projectID,
			RelatedType: "project",
			ActionURL:   fmt.Sprintf("/projects/%d", projectID),
			Category:    NotificationCategoryProject,
		})
	}
	if providerUserID > 0 {
		_ = d.service.Create(&CreateNotificationInput{
			UserID:      providerUserID,
			UserType:    "provider",
			Title:       "计划进场时间已更新",
			Content:     fmt.Sprintf("监理已同步项目计划进场时间：%s，请按此准备开工。", formatted),
			Type:        NotificationTypeProjectPlannedStartUpdated,
			RelatedID:   projectID,
			RelatedType: "project",
			ActionURL:   fmt.Sprintf("/projects/%d", projectID),
			Category:    NotificationCategoryProject,
		})
	}
}

func (d *NotificationDispatcher) NotifySupervisionRiskEscalated(projectID, providerUserID uint64, title string) {
	if projectID == 0 {
		return
	}
	message := "监理已上报施工风险，请尽快查看并处理。"
	if strings.TrimSpace(title) != "" {
		message = fmt.Sprintf("监理已上报施工风险：%s，请尽快查看并处理。", strings.TrimSpace(title))
	}
	if providerUserID > 0 {
		_ = d.service.Create(&CreateNotificationInput{
			UserID:      providerUserID,
			UserType:    "provider",
			Title:       "监理风险升级",
			Content:     message,
			Type:        NotificationTypeSupervisionRiskEscalated,
			RelatedID:   projectID,
			RelatedType: "project",
			ActionURL:   fmt.Sprintf("/projects/%d", projectID),
			Category:    NotificationCategoryProject,
		})
	}
	_ = d.service.NotifyAdmins(&CreateNotificationInput{
		Title:       "监理风险升级",
		Content:     message,
		Type:        NotificationTypeSupervisionRiskEscalated,
		RelatedID:   projectID,
		RelatedType: "project",
		ActionURL:   fmt.Sprintf("/supervision/projects/%d", projectID),
		Category:    NotificationCategoryProject,
	})
}

func (d *NotificationDispatcher) NotifyConstructionStagePaymentActivated(userID, providerUserID, projectID, orderID uint64, plan model.PaymentPlan) {
	d.notifyConstructionPlanPayment(userID, providerUserID, projectID, orderID, plan, "节点进度款待支付", "payment.construction.stage_pending")
}

func (d *NotificationDispatcher) NotifyConstructionFinalPaymentActivated(userID, providerUserID, projectID, orderID uint64, plan model.PaymentPlan) {
	d.notifyConstructionPlanPayment(userID, providerUserID, projectID, orderID, plan, "尾款待支付", "payment.construction.final_pending")
}

func (d *NotificationDispatcher) NotifyConstructionPaymentExpiring(userID, providerUserID, projectID, orderID uint64, plan model.PaymentPlan) {
	if userID > 0 {
		_ = d.service.Create(&CreateNotificationInput{
			UserID:      userID,
			UserType:    "user",
			Title:       "施工付款即将失效",
			Content:     fmt.Sprintf("%s即将失效，金额 %.2f 元，请尽快完成支付。", strings.TrimSpace(plan.Name), plan.Amount),
			Type:        "payment.construction.expiring",
			RelatedID:   orderID,
			RelatedType: "order",
			ActionURL:   fmt.Sprintf("/orders/%d", orderID),
			Category:    NotificationCategoryPayment,
		})
	}
	if providerUserID > 0 {
		_ = d.service.Create(&CreateNotificationInput{
			UserID:      providerUserID,
			UserType:    "provider",
			Title:       "业主付款即将失效",
			Content:     fmt.Sprintf("项目 #%d 的%s即将失效，请及时跟进业主付款。", projectID, strings.TrimSpace(plan.Name)),
			Type:        "payment.construction.expiring",
			RelatedID:   orderID,
			RelatedType: "order",
			ActionURL:   fmt.Sprintf("/projects/%d", projectID),
			Category:    NotificationCategoryPayment,
		})
	}
}

func (d *NotificationDispatcher) NotifyConstructionPaymentExpired(userID, providerUserID, projectID, orderID uint64, plan model.PaymentPlan) {
	if userID > 0 {
		_ = d.service.Create(&CreateNotificationInput{
			UserID:      userID,
			UserType:    "user",
			Title:       "施工付款已失效",
			Content:     fmt.Sprintf("%s已失效，金额 %.2f 元，如需继续请重新发起。", strings.TrimSpace(plan.Name), plan.Amount),
			Type:        "payment.construction.expired",
			RelatedID:   orderID,
			RelatedType: "order",
			ActionURL:   fmt.Sprintf("/orders/%d", orderID),
			Category:    NotificationCategoryPayment,
		})
	}
	if providerUserID > 0 {
		_ = d.service.Create(&CreateNotificationInput{
			UserID:      providerUserID,
			UserType:    "provider",
			Title:       "业主付款已失效",
			Content:     fmt.Sprintf("项目 #%d 的%s已失效，施工推进将暂停。", projectID, strings.TrimSpace(plan.Name)),
			Type:        "payment.construction.expired",
			RelatedID:   orderID,
			RelatedType: "order",
			ActionURL:   fmt.Sprintf("/projects/%d", projectID),
			Category:    NotificationCategoryPayment,
		})
	}
}

func (d *NotificationDispatcher) notifyConstructionPlanPayment(userID, providerUserID, projectID, orderID uint64, plan model.PaymentPlan, title, notificationType string) {
	if userID > 0 {
		_ = d.service.Create(&CreateNotificationInput{
			UserID:      userID,
			UserType:    "user",
			Title:       title,
			Content:     fmt.Sprintf("%s已激活，金额 %.2f 元，请尽快支付。", strings.TrimSpace(plan.Name), plan.Amount),
			Type:        notificationType,
			RelatedID:   orderID,
			RelatedType: "order",
			ActionURL:   fmt.Sprintf("/orders/%d", orderID),
			Category:    NotificationCategoryPayment,
			Extra: map[string]interface{}{
				"projectId":     projectID,
				"paymentPlanId": plan.ID,
			},
		})
	}
	if providerUserID > 0 {
		_ = d.service.Create(&CreateNotificationInput{
			UserID:      providerUserID,
			UserType:    "provider",
			Title:       title,
			Content:     fmt.Sprintf("项目 #%d 的%s已进入待支付，请跟进业主付款。", projectID, strings.TrimSpace(plan.Name)),
			Type:        notificationType,
			RelatedID:   orderID,
			RelatedType: "order",
			ActionURL:   fmt.Sprintf("/projects/%d", projectID),
			Category:    NotificationCategoryPayment,
			Extra: map[string]interface{}{
				"projectId":     projectID,
				"paymentPlanId": plan.ID,
			},
		})
	}
}

func (d *NotificationDispatcher) NotifyChangeOrderCreated(ownerUserID, providerUserID, projectID, changeOrderID uint64, title string) {
	if ownerUserID > 0 {
		_ = d.service.Create(&CreateNotificationInput{
			UserID:      ownerUserID,
			UserType:    "user",
			Title:       "项目变更待确认",
			Content:     fmt.Sprintf("商家已发起变更“%s”，请尽快确认或拒绝。", strings.TrimSpace(title)),
			Type:        "change_order.created",
			RelatedID:   changeOrderID,
			RelatedType: "change_order",
			ActionURL:   fmt.Sprintf("/projects/%d/change-request", projectID),
			Category:    NotificationCategoryProject,
		})
	}
	if providerUserID > 0 {
		_ = d.service.Create(&CreateNotificationInput{
			UserID:      providerUserID,
			UserType:    "provider",
			Title:       "变更单已创建",
			Content:     fmt.Sprintf("变更“%s”已发送给业主，等待确认。", strings.TrimSpace(title)),
			Type:        "change_order.created",
			RelatedID:   changeOrderID,
			RelatedType: "change_order",
			ActionURL:   fmt.Sprintf("/projects/%d", projectID),
			Category:    NotificationCategoryProject,
		})
	}
}

func (d *NotificationDispatcher) NotifyChangeOrderDecision(ownerUserID, providerUserID, projectID, changeOrderID uint64, approved bool, reason string) {
	title := "项目变更已确认"
	content := "业主已确认该变更，后续将按新约定推进。"
	notificationType := "change_order.confirmed"
	if !approved {
		reasonText := strings.TrimSpace(reason)
		if reasonText == "" {
			reasonText = "未填写"
		}
		title = "项目变更被拒绝"
		content = fmt.Sprintf("业主已拒绝该变更。原因：%s", reasonText)
		notificationType = "change_order.rejected"
	}
	if providerUserID > 0 {
		_ = d.service.Create(&CreateNotificationInput{
			UserID:      providerUserID,
			UserType:    "provider",
			Title:       title,
			Content:     content,
			Type:        notificationType,
			RelatedID:   changeOrderID,
			RelatedType: "change_order",
			ActionURL:   fmt.Sprintf("/projects/%d", projectID),
			Category:    NotificationCategoryProject,
		})
	}
	_ = d.service.NotifyAdmins(&CreateNotificationInput{
		Title:       title,
		Content:     fmt.Sprintf("项目 #%d 的变更单已更新，请按需跟进。", projectID),
		Type:        notificationType,
		RelatedID:   changeOrderID,
		RelatedType: "change_order",
		ActionURL:   buildAdminChangeOrderActionURL(projectID),
		Category:    NotificationCategoryProject,
	})
	if !approved && ownerUserID > 0 {
		_ = d.service.Create(&CreateNotificationInput{
			UserID:      ownerUserID,
			UserType:    "user",
			Title:       title,
			Content:     content,
			Type:        notificationType,
			RelatedID:   changeOrderID,
			RelatedType: "change_order",
			ActionURL:   fmt.Sprintf("/projects/%d/change-request", projectID),
			Category:    NotificationCategoryProject,
		})
	}
}

func (d *NotificationDispatcher) NotifyChangeOrderPaymentActivated(ownerUserID, providerUserID, projectID, orderID uint64, plan model.PaymentPlan, title string) {
	if ownerUserID > 0 {
		_ = d.service.Create(&CreateNotificationInput{
			UserID:      ownerUserID,
			UserType:    "user",
			Title:       "变更款待支付",
			Content:     fmt.Sprintf("变更“%s”已确认，需支付 %.2f 元后生效。", strings.TrimSpace(title), plan.Amount),
			Type:        "change_order.payment_pending",
			RelatedID:   orderID,
			RelatedType: "order",
			ActionURL:   fmt.Sprintf("/orders/%d", orderID),
			Category:    NotificationCategoryPayment,
		})
	}
	if providerUserID > 0 {
		_ = d.service.Create(&CreateNotificationInput{
			UserID:      providerUserID,
			UserType:    "provider",
			Title:       "变更款待支付",
			Content:     fmt.Sprintf("变更“%s”已确认，待业主支付后生效。", strings.TrimSpace(title)),
			Type:        "change_order.payment_pending",
			RelatedID:   orderID,
			RelatedType: "order",
			ActionURL:   fmt.Sprintf("/projects/%d", projectID),
			Category:    NotificationCategoryPayment,
		})
	}
}

func (d *NotificationDispatcher) NotifyChangeOrderSettlementRequired(projectID, changeOrderID uint64, title string) {
	_ = d.service.NotifyAdmins(&CreateNotificationInput{
		Title:       "变更单待人工结算",
		Content:     fmt.Sprintf("项目 #%d 的减项变更“%s”待人工结算。", projectID, strings.TrimSpace(title)),
		Type:        "change_order.settlement_required",
		RelatedID:   changeOrderID,
		RelatedType: "change_order",
		ActionURL:   buildAdminChangeOrderActionURL(projectID),
		Category:    NotificationCategoryPayment,
	})
}

func (d *NotificationDispatcher) NotifyChangeOrderSettled(projectID, changeOrderID uint64, title string) {
	_ = d.service.NotifyAdmins(&CreateNotificationInput{
		Title:       "变更单已结算",
		Content:     fmt.Sprintf("项目 #%d 的变更“%s”已完成人工结算。", projectID, strings.TrimSpace(title)),
		Type:        "change_order.settled",
		RelatedID:   changeOrderID,
		RelatedType: "change_order",
		ActionURL:   buildAdminChangeOrderActionURL(projectID),
		Category:    NotificationCategoryPayment,
	})
}

func (d *NotificationDispatcher) NotifyConstructionPaymentPlanCreated(userID, quoteListID, projectID, orderID uint64, plan model.PaymentPlan) {
	if userID == 0 || orderID == 0 {
		return
	}
	_ = d.create(&CreateNotificationInput{
		UserID:      userID,
		UserType:    "user",
		Title:       "施工首付款待支付",
		Content:     fmt.Sprintf("%s已生成，金额 %.2f 元，请尽快完成支付后开工。", strings.TrimSpace(plan.Name), plan.Amount),
		Type:        "payment.construction.pending",
		RelatedID:   orderID,
		RelatedType: "order",
		ActionURL:   fmt.Sprintf("/orders/%d", orderID),
		Category:    NotificationCategoryPayment,
		Extra: map[string]interface{}{
			"quoteListId":   quoteListID,
			"projectId":     projectID,
			"orderId":       orderID,
			"paymentPlanId": plan.ID,
			"seq":           plan.Seq,
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
			Category:    NotificationCategoryProject,
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
			Category:    NotificationCategoryProject,
		})
	}
}

func (d *NotificationDispatcher) NotifyMilestoneSubmitted(ownerUserID, projectID, milestoneID uint64, milestoneName string) {
	if ownerUserID == 0 || projectID == 0 || milestoneID == 0 {
		return
	}
	name := strings.TrimSpace(milestoneName)
	if name == "" {
		name = "当前节点"
	}
	_ = d.create(&CreateNotificationInput{
		UserID:      ownerUserID,
		UserType:    "user",
		Title:       "阶段验收待处理",
		Content:     fmt.Sprintf("工长已提交“%s”验收，请尽快查看并确认。", name),
		Type:        "project.milestone.submitted",
		RelatedID:   milestoneID,
		RelatedType: "milestone",
		ActionURL:   fmt.Sprintf("/projects/%d", projectID),
		Category:    NotificationCategoryProject,
		Extra: map[string]interface{}{
			"projectId":     projectID,
			"milestoneId":   milestoneID,
			"milestoneName": name,
		},
	})
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
			Category:    NotificationCategoryProject,
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
			Category:    NotificationCategoryProject,
		})
	}
}

func (d *NotificationDispatcher) NotifyProjectDisputeCreated(providerUserID, auditID, projectID uint64) {
	if auditID == 0 || projectID == 0 {
		return
	}
	_ = d.service.NotifyAdmins(&CreateNotificationInput{
		Title:       "新的项目争议待处理",
		Content:     fmt.Sprintf("项目 #%d 已提交争议，等待平台处理", projectID),
		Type:        "project.dispute.created",
		RelatedID:   auditID,
		RelatedType: "project_audit",
		ActionURL:   buildAdminProjectAuditActionURL(auditID),
		Category:    NotificationCategoryProject,
		Extra: map[string]interface{}{
			"auditId":   auditID,
			"projectId": projectID,
		},
	})
	if providerUserID > 0 {
		_ = d.service.Create(&CreateNotificationInput{
			UserID:      providerUserID,
			UserType:    "provider",
			Title:       "项目进入争议处理",
			Content:     fmt.Sprintf("项目 #%d 已被业主发起争议，请尽快补充说明。", projectID),
			Type:        "project.dispute.created",
			RelatedID:   projectID,
			RelatedType: "project",
			ActionURL:   buildProjectDisputeActionURL(projectID),
			Category:    NotificationCategoryProject,
		})
	}
}

func (d *NotificationDispatcher) NotifyProjectCompletionSubmitted(ownerUserID, projectID uint64) {
	if ownerUserID == 0 || projectID == 0 {
		return
	}
	_ = d.create(&CreateNotificationInput{
		UserID:      ownerUserID,
		UserType:    "user",
		Title:       "完工材料待验收",
		Content:     "商家已提交完工材料，请尽快查看并确认。",
		Type:        "project.completion.submitted",
		RelatedID:   projectID,
		RelatedType: "project",
		ActionURL:   fmt.Sprintf("/projects/%d/completion", projectID),
		Category:    NotificationCategoryProject,
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
	_ = d.create(&CreateNotificationInput{
		UserID:      providerUserID,
		UserType:    "provider",
		Title:       title,
		Content:     content,
		Type:        notificationType,
		RelatedID:   projectID,
		RelatedType: "project",
		ActionURL:   fmt.Sprintf("/projects/%d", projectID),
		Category:    NotificationCategoryProject,
		Extra: map[string]interface{}{
			"projectId": projectID,
			"reason":    strings.TrimSpace(reason),
		},
	})
}

func (d *NotificationDispatcher) NotifyProjectSettlementScheduled(providerUserID, projectID, settlementID uint64, dueAt *time.Time) {
	if providerUserID == 0 {
		return
	}
	content := "平台已记录当前项目的结算计划，后续将按排期推进出款。"
	if dueAt != nil {
		content = fmt.Sprintf("平台已记录当前项目的结算计划，预计 %s 进入出款处理。", dueAt.Format("2006-01-02"))
	}
	relatedID := settlementID
	relatedType := "settlement_order"
	if relatedID == 0 {
		relatedID = projectID
		relatedType = "project"
	}
	_ = d.service.Create(&CreateNotificationInput{
		UserID:      providerUserID,
		UserType:    "provider",
		Title:       "项目已进入待结算",
		Content:     content,
		Type:        NotificationTypeProjectSettlementScheduled,
		RelatedID:   relatedID,
		RelatedType: relatedType,
		ActionURL:   buildProviderClosureActionURL(projectID),
		Category:    NotificationCategoryPayment,
		Extra: map[string]interface{}{
			"projectId":     projectID,
			"settlementId":  settlementID,
			"settlementDue": dueAt,
		},
	})
}

func (d *NotificationDispatcher) NotifyProjectPayoutProcessing(providerUserID, projectID, payoutID uint64) {
	if providerUserID == 0 || payoutID == 0 {
		return
	}
	_ = d.service.Create(&CreateNotificationInput{
		UserID:      providerUserID,
		UserType:    "provider",
		Title:       "项目出款处理中",
		Content:     "项目结算已进入出款处理，请留意资金中心状态变化。",
		Type:        NotificationTypeProjectPayoutProcessing,
		RelatedID:   payoutID,
		RelatedType: "payout_order",
		ActionURL:   buildProviderClosureActionURL(projectID),
		Category:    NotificationCategoryPayment,
		Extra: map[string]interface{}{
			"projectId": projectID,
			"payoutId":  payoutID,
		},
	})
}

func (d *NotificationDispatcher) NotifyProjectPayoutPaid(providerUserID, projectID, payoutID uint64) {
	if providerUserID == 0 || payoutID == 0 {
		return
	}
	_ = d.service.Create(&CreateNotificationInput{
		UserID:      providerUserID,
		UserType:    "provider",
		Title:       "项目已出款",
		Content:     "项目结算已完成出款，请在资金中心查看明细。",
		Type:        NotificationTypeProjectPayoutPaid,
		RelatedID:   payoutID,
		RelatedType: "payout_order",
		ActionURL:   buildProviderClosureActionURL(projectID),
		Category:    NotificationCategoryPayment,
		Extra: map[string]interface{}{
			"projectId": projectID,
			"payoutId":  payoutID,
		},
	})
}

func (d *NotificationDispatcher) NotifyProjectPayoutFailed(providerUserID, projectID, payoutID uint64, reason string) {
	reason = strings.TrimSpace(reason)
	if providerUserID > 0 && payoutID > 0 {
		content := "项目出款失败，请在资金中心查看处理结果。"
		if reason != "" {
			content = fmt.Sprintf("项目出款失败，原因：%s", reason)
		}
		_ = d.service.Create(&CreateNotificationInput{
			UserID:      providerUserID,
			UserType:    "provider",
			Title:       "项目出款失败",
			Content:     content,
			Type:        NotificationTypeProjectPayoutFailed,
			RelatedID:   payoutID,
			RelatedType: "payout_order",
			ActionURL:   buildProviderClosureActionURL(projectID),
			Category:    NotificationCategoryPayment,
			Extra: map[string]interface{}{
				"projectId": projectID,
				"payoutId":  payoutID,
				"reason":    reason,
			},
		})
	}
	if payoutID == 0 {
		return
	}
	adminContent := fmt.Sprintf("项目 #%d 的出款处理失败。", projectID)
	if reason != "" {
		adminContent = fmt.Sprintf("%s 原因：%s", adminContent, reason)
	}
	_ = d.service.NotifyAdmins(&CreateNotificationInput{
		Title:       "项目出款失败待处理",
		Content:     adminContent,
		Type:        NotificationTypeProjectPayoutFailed,
		RelatedID:   payoutID,
		RelatedType: "payout_order",
		ActionURL:   buildAdminPayoutActionURL(),
		Category:    NotificationCategoryPayment,
		Extra: map[string]interface{}{
			"projectId": projectID,
			"payoutId":  payoutID,
			"reason":    reason,
		},
	})
}

func (d *NotificationDispatcher) NotifyProjectCaseDraftGenerated(providerUserID, projectID, caseAuditID uint64) {
	if providerUserID > 0 && caseAuditID > 0 {
		_ = d.service.Create(&CreateNotificationInput{
			UserID:      providerUserID,
			UserType:    "provider",
			Title:       "完工案例草稿已生成",
			Content:     "项目完工资料已沉淀为案例草稿，可继续在案例资产中补充与维护。",
			Type:        NotificationTypeProjectCaseDraftGenerated,
			RelatedID:   caseAuditID,
			RelatedType: "case_audit",
			ActionURL:   buildProviderCaseDraftActionURL(projectID),
			Category:    NotificationCategoryProject,
			Extra: map[string]interface{}{
				"projectId":   projectID,
				"caseAuditId": caseAuditID,
			},
		})
	}
	if caseAuditID == 0 {
		return
	}
	_ = d.service.NotifyAdmins(&CreateNotificationInput{
		Title:       "新的案例草稿待审核",
		Content:     fmt.Sprintf("项目 #%d 已生成案例草稿，请进入案例审核工作面处理。", projectID),
		Type:        NotificationTypeCaseAuditCreated,
		RelatedID:   caseAuditID,
		RelatedType: "case_audit",
		ActionURL:   buildAdminCaseManagementActionURL(),
		Category:    NotificationCategoryProject,
		Extra: map[string]interface{}{
			"projectId":   projectID,
			"caseAuditId": caseAuditID,
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
		Category:    NotificationCategoryPayment,
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
		Category:    NotificationCategoryPayment,
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
		Category:    NotificationCategoryPayment,
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
		Category:    NotificationCategoryPayment,
		Extra: map[string]interface{}{
			"refundApplicationId": refundApplicationID,
			"bookingId":           bookingID,
		},
	})
}

func (d *NotificationDispatcher) NotifyRefundCompleted(userID, providerUserID, refundApplicationID, bookingID, projectID uint64, approvedAmount float64) {
	if refundApplicationID == 0 {
		return
	}
	if userID > 0 {
		_ = d.service.Create(&CreateNotificationInput{
			UserID:      userID,
			UserType:    "user",
			Title:       "退款已完成",
			Content:     fmt.Sprintf("您的退款已原路退回，退款金额 %.2f 元。", approvedAmount),
			Type:        "refund.succeeded",
			RelatedID:   refundApplicationID,
			RelatedType: "refund_application",
			ActionURL:   buildBookingRefundActionURL(bookingID),
			Category:    NotificationCategoryPayment,
		})
	}
	if providerUserID > 0 {
		_ = d.service.Create(&CreateNotificationInput{
			UserID:      providerUserID,
			UserType:    "provider",
			Title:       "退款已完成",
			Content:     fmt.Sprintf("相关退款已执行完成，退款金额 %.2f 元。", approvedAmount),
			Type:        "refund.succeeded",
			RelatedID:   refundApplicationID,
			RelatedType: "refund_application",
			ActionURL:   buildProviderRefundActionURL(projectID, bookingID),
			Category:    NotificationCategoryPayment,
		})
	}
}

func (d *NotificationDispatcher) NotifyWithdrawAppliedToAdmins(withdrawID, providerID uint64, amount float64, orderNo string) {
	if withdrawID == 0 {
		return
	}
	content := fmt.Sprintf("商家 #%d 提交了提现申请，金额 %.2f 元。", providerID, amount)
	if trimmed := strings.TrimSpace(orderNo); trimmed != "" {
		content = fmt.Sprintf("%s 提现单号：%s", content, trimmed)
	}
	_ = d.service.NotifyAdmins(&CreateNotificationInput{
		Title:       "新的提现申请待审核",
		Content:     content,
		Type:        "withdraw.created",
		RelatedID:   withdrawID,
		RelatedType: "withdraw",
		ActionURL:   buildAdminWithdrawActionURL(withdrawID),
		Category:    NotificationCategoryPayment,
		Extra: map[string]interface{}{
			"withdrawId": withdrawID,
			"providerId": providerID,
			"amount":     amount,
			"orderNo":    strings.TrimSpace(orderNo),
		},
	})
}

func (d *NotificationDispatcher) NotifyMerchantApplicationSubmittedToAdmins(applicationID uint64, role, applicantName string) {
	if applicationID == 0 {
		return
	}
	roleText := strings.TrimSpace(role)
	if roleText == "" {
		roleText = "商家"
	}
	content := fmt.Sprintf("新的%s入驻申请待审核。", roleText)
	if strings.TrimSpace(applicantName) != "" {
		content = fmt.Sprintf("%s 申请了%s入驻，请尽快审核。", strings.TrimSpace(applicantName), roleText)
	}
	_ = d.service.NotifyAdmins(&CreateNotificationInput{
		Title:       "新的入驻申请待审核",
		Content:     content,
		Type:        "merchant.application.submitted",
		RelatedID:   applicationID,
		RelatedType: "merchant_application",
		ActionURL:   buildAdminMerchantApplicationActionURL(),
		Category:    NotificationCategorySystem,
	})
}

func (d *NotificationDispatcher) NotifyMerchantApplicationApproved(providerUserID, applicationID uint64, providerName string) {
	if providerUserID == 0 || applicationID == 0 {
		return
	}
	content := "你的入驻申请已审核通过，可登录商家中心开始接单。"
	if strings.TrimSpace(providerName) != "" {
		content = fmt.Sprintf("%s 的入驻申请已审核通过，可登录商家中心开始接单。", strings.TrimSpace(providerName))
	}
	_ = d.service.Create(&CreateNotificationInput{
		UserID:      providerUserID,
		UserType:    "provider",
		Title:       "入驻审核已通过",
		Content:     content,
		Type:        "merchant.application.approved",
		RelatedID:   applicationID,
		RelatedType: "merchant_application",
		ActionURL:   "/dashboard",
		Category:    NotificationCategorySystem,
	})
}

func (d *NotificationDispatcher) NotifyMerchantApplicationRejected(userID, applicationID uint64, reason string) {
	if userID == 0 || applicationID == 0 {
		return
	}
	content := "你的入驻申请未通过审核，请根据原因修改后重新提交。"
	if strings.TrimSpace(reason) != "" {
		content = fmt.Sprintf("你的入驻申请未通过审核，原因：%s", strings.TrimSpace(reason))
	}
	_ = d.service.Create(&CreateNotificationInput{
		UserID:      userID,
		UserType:    "user",
		Title:       "入驻审核未通过",
		Content:     content,
		Type:        "merchant.application.rejected",
		RelatedID:   applicationID,
		RelatedType: "merchant_application",
		ActionURL:   "/me/notifications",
		Category:    NotificationCategorySystem,
	})
}

func (d *NotificationDispatcher) NotifyCaseAuditDecision(providerUserID, auditID uint64, approved bool, reason string) {
	if providerUserID == 0 || auditID == 0 {
		return
	}
	title := "案例审核已通过"
	content := "你的案例审核已通过，内容资产已更新。"
	notificationType := model.NotificationTypeCaseAuditApproved
	if !approved {
		title = "案例审核未通过"
		content = "你的案例审核未通过，请根据审核意见调整后重新提交。"
		if strings.TrimSpace(reason) != "" {
			content = fmt.Sprintf("你的案例审核未通过，原因：%s", strings.TrimSpace(reason))
		}
		notificationType = model.NotificationTypeCaseAuditRejected
	}
	_ = d.service.Create(&CreateNotificationInput{
		UserID:      providerUserID,
		UserType:    "provider",
		Title:       title,
		Content:     content,
		Type:        notificationType,
		RelatedID:   auditID,
		RelatedType: "case_audit",
		ActionURL:   "/cases",
		Category:    NotificationCategorySystem,
	})
}

func (d *NotificationDispatcher) NotifyComplaintCreated(providerUserID, complaintID, projectID uint64, title string) {
	if complaintID == 0 {
		return
	}
	content := "业主已发起投诉，请及时查看并响应。"
	if strings.TrimSpace(title) != "" {
		content = fmt.Sprintf("业主发起了投诉“%s”，请及时查看并响应。", strings.TrimSpace(title))
	}
	_ = d.service.NotifyAdmins(&CreateNotificationInput{
		Title:       "新的投诉待处理",
		Content:     content,
		Type:        "complaint.created",
		RelatedID:   complaintID,
		RelatedType: "complaint",
		ActionURL:   buildAdminComplaintActionURL(),
		Category:    NotificationCategoryProject,
	})
	if providerUserID > 0 {
		_ = d.service.Create(&CreateNotificationInput{
			UserID:      providerUserID,
			UserType:    "provider",
			Title:       "新的投诉待处理",
			Content:     content,
			Type:        "complaint.created",
			RelatedID:   complaintID,
			RelatedType: "complaint",
			ActionURL:   buildProviderComplaintActionURL(projectID),
			Category:    NotificationCategoryProject,
		})
	}
}

func (d *NotificationDispatcher) NotifyComplaintResolved(userID, providerUserID, complaintID, projectID uint64, resolution string) {
	content := "投诉处理结果已更新，请查看详情。"
	if strings.TrimSpace(resolution) != "" {
		content = fmt.Sprintf("投诉处理结果已更新：%s", strings.TrimSpace(resolution))
	}
	if userID > 0 {
		_ = d.service.Create(&CreateNotificationInput{
			UserID:      userID,
			UserType:    "user",
			Title:       "投诉处理结果已更新",
			Content:     content,
			Type:        "complaint.resolved",
			RelatedID:   complaintID,
			RelatedType: "complaint",
			ActionURL:   buildProjectDisputeActionURL(projectID),
			Category:    NotificationCategoryProject,
		})
	}
	if providerUserID > 0 {
		_ = d.service.Create(&CreateNotificationInput{
			UserID:      providerUserID,
			UserType:    "provider",
			Title:       "投诉处理结果已更新",
			Content:     content,
			Type:        "complaint.resolved",
			RelatedID:   complaintID,
			RelatedType: "complaint",
			ActionURL:   buildProviderComplaintActionURL(projectID),
			Category:    NotificationCategoryProject,
		})
	}
}

func (d *NotificationDispatcher) NotifyOrderExpiring(userID uint64, orderID uint64, orderType string, amount float64) {
	if userID == 0 || orderID == 0 {
		return
	}
	_ = d.service.Create(&CreateNotificationInput{
		UserID:      userID,
		UserType:    "user",
		Title:       "订单即将失效",
		Content:     fmt.Sprintf("%s待支付订单即将失效，金额 %.2f 元，请尽快完成支付。", resolveOrderTypeText(orderType), amount),
		Type:        model.NotificationTypeOrderExpiring,
		RelatedID:   orderID,
		RelatedType: "order",
		ActionURL:   fmt.Sprintf("/orders/%d", orderID),
		Category:    NotificationCategoryPayment,
	})
}

func (d *NotificationDispatcher) NotifyOrderExpired(userID uint64, orderID uint64, orderType string, amount float64) {
	if userID == 0 || orderID == 0 {
		return
	}
	_ = d.service.Create(&CreateNotificationInput{
		UserID:      userID,
		UserType:    "user",
		Title:       "订单已失效",
		Content:     fmt.Sprintf("%s待支付订单已失效，金额 %.2f 元，如需继续请重新发起。", resolveOrderTypeText(orderType), amount),
		Type:        model.NotificationTypeOrderExpired,
		RelatedID:   orderID,
		RelatedType: "order",
		ActionURL:   fmt.Sprintf("/orders/%d", orderID),
		Category:    NotificationCategoryPayment,
	})
}

func providerUserIDFromProvider(providerID uint64) uint64 {
	return providerUserIDFromProviderTx(repository.DB, providerID)
}

func providerUserIDFromProviderTx(tx *gorm.DB, providerID uint64) uint64 {
	if providerID == 0 {
		return 0
	}
	if tx == nil {
		tx = repository.DB
	}
	var provider model.Provider
	if err := tx.Select("user_id").First(&provider, providerID).Error; err != nil {
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

func buildAdminWithdrawActionURL(withdrawID uint64) string {
	return fmt.Sprintf("/withdraws/%d", withdrawID)
}

func buildAdminChangeOrderActionURL(projectID uint64) string {
	if projectID > 0 {
		return fmt.Sprintf("/orders?projectId=%d&focus=change-order", projectID)
	}
	return "/orders?focus=change-order"
}

func buildProviderClosureActionURL(projectID uint64) string {
	if projectID > 0 {
		return fmt.Sprintf("/income?projectId=%d", projectID)
	}
	return "/income"
}

func buildAdminMerchantApplicationActionURL() string {
	return "/providers/audit"
}

func buildAdminPayoutActionURL() string {
	return "/finance/payouts"
}

func buildAdminSettlementActionURL() string {
	return "/finance/settlements"
}

func buildProviderCaseDraftActionURL(projectID uint64) string {
	if projectID > 0 {
		return "/cases"
	}
	return "/cases"
}

func buildAdminCaseManagementActionURL() string {
	return "/cases/manage"
}

func buildAdminComplaintActionURL() string {
	return "/complaints"
}

func buildProviderComplaintActionURL(projectID uint64) string {
	if projectID > 0 {
		return buildProjectDisputeActionURL(projectID)
	}
	return "/complaints"
}

func resolveOrderTypeText(orderType string) string {
	switch strings.TrimSpace(orderType) {
	case model.OrderTypeDesign:
		return "设计费"
	case model.OrderTypeConstruction:
		return "施工费"
	case model.OrderTypeMaterial:
		return "主材费"
	default:
		return "待支付"
	}
}

// NotifyProjectClosed 通知项目关闭
func (d *NotificationDispatcher) NotifyProjectClosed(projectID, ownerUserID, providerUserID uint64, closureType, reason string) {
	var title, content string
	if closureType == "normal" {
		title = "项目已正常关闭"
		content = fmt.Sprintf("项目已正常关闭。关闭原因：%s", reason)
	} else {
		title = "项目已异常关闭"
		content = fmt.Sprintf("项目已异常关闭。关闭原因：%s", reason)
	}

	if ownerUserID > 0 {
		_ = d.service.Create(&CreateNotificationInput{
			UserID:      ownerUserID,
			UserType:    "user",
			Title:       title,
			Content:     content,
			Type:        "project.closed",
			RelatedID:   projectID,
			RelatedType: "project",
			ActionURL:   fmt.Sprintf("/projects/%d/closure", projectID),
			Category:    NotificationCategoryProject,
			Extra: map[string]interface{}{
				"closureType": closureType,
			},
		})
	}
	if providerUserID > 0 {
		_ = d.service.Create(&CreateNotificationInput{
			UserID:      providerUserID,
			UserType:    "provider",
			Title:       title,
			Content:     content,
			Type:        "project.closed",
			RelatedID:   projectID,
			RelatedType: "project",
			ActionURL:   fmt.Sprintf("/projects/%d", projectID),
			Category:    NotificationCategoryProject,
			Extra: map[string]interface{}{
				"closureType": closureType,
			},
		})
	}
}

// NotifyMilestoneAccepted 通知商家验收通过
func (d *NotificationDispatcher) NotifyMilestoneAccepted(providerID, projectID, milestoneID uint64) {
	if providerID == 0 || projectID == 0 || milestoneID == 0 {
		return
	}
	providerUserID := d.providerUserIDFromProvider(providerID)
	if providerUserID == 0 {
		return
	}
	_ = d.create(&CreateNotificationInput{
		UserID:      providerUserID,
		UserType:    "provider",
		Title:       "阶段验收已通过",
		Content:     "业主已通过阶段验收，款项已自动放款。",
		Type:        "project.milestone.accepted",
		RelatedID:   milestoneID,
		RelatedType: "milestone",
		ActionURL:   fmt.Sprintf("/projects/%d", projectID),
		Category:    NotificationCategoryProject,
		Extra: map[string]interface{}{
			"projectId":   projectID,
			"milestoneId": milestoneID,
		},
	})
}

// NotifyMilestoneRejected 通知商家验收被拒
func (d *NotificationDispatcher) NotifyMilestoneRejected(providerID, projectID, milestoneID uint64, reason string) {
	if providerID == 0 || projectID == 0 || milestoneID == 0 {
		return
	}
	providerUserID := d.providerUserIDFromProvider(providerID)
	if providerUserID == 0 {
		return
	}
	content := "业主已驳回阶段验收，请根据反馈整改后重新提交。"
	if strings.TrimSpace(reason) != "" {
		content = fmt.Sprintf("业主已驳回阶段验收。驳回原因：%s", strings.TrimSpace(reason))
	}
	_ = d.create(&CreateNotificationInput{
		UserID:      providerUserID,
		UserType:    "provider",
		Title:       "阶段验收被驳回",
		Content:     content,
		Type:        "project.milestone.rejected",
		RelatedID:   milestoneID,
		RelatedType: "milestone",
		ActionURL:   fmt.Sprintf("/projects/%d", projectID),
		Category:    NotificationCategoryProject,
		Extra: map[string]interface{}{
			"projectId":   projectID,
			"milestoneId": milestoneID,
			"reason":      strings.TrimSpace(reason),
		},
	})
}

// NotifyMilestoneResubmitted 通知用户重新提交
func (d *NotificationDispatcher) NotifyMilestoneResubmitted(userID, projectID, milestoneID uint64) {
	if userID == 0 || projectID == 0 || milestoneID == 0 {
		return
	}
	_ = d.create(&CreateNotificationInput{
		UserID:      userID,
		UserType:    "user",
		Title:       "阶段验收已重新提交",
		Content:     "商家已根据你的反馈整改完成并重新提交验收，请再次查看。",
		Type:        "project.milestone.resubmitted",
		RelatedID:   milestoneID,
		RelatedType: "milestone",
		ActionURL:   fmt.Sprintf("/projects/%d", projectID),
		Category:    NotificationCategoryProject,
		Extra: map[string]interface{}{
			"projectId":   projectID,
			"milestoneId": milestoneID,
		},
	})
}
