package service

import (
	"fmt"
	"home-decoration-server/internal/model"
	"strings"

	"gorm.io/gorm"
)

func enqueueOutboxNotificationTx(tx *gorm.DB, eventType, aggregateType string, aggregateID uint64, eventKey string, payload map[string]interface{}) error {
	return (&OutboxEventService{}).EnqueueTx(tx, OutboxEventInput{
		EventType:     eventType,
		AggregateType: aggregateType,
		AggregateID:   aggregateID,
		HandlerKey:    OutboxHandlerNotification,
		EventKey:      eventKey + ":notification",
		Payload:       payload,
		MaxRetries:    defaultOutboxMaxRetries,
	})
}

func enqueueOutboxAuditTx(tx *gorm.DB, eventType, aggregateType string, aggregateID uint64, eventKey string, payload map[string]interface{}) error {
	return (&OutboxEventService{}).EnqueueTx(tx, OutboxEventInput{
		EventType:     eventType,
		AggregateType: aggregateType,
		AggregateID:   aggregateID,
		HandlerKey:    OutboxHandlerAudit,
		EventKey:      eventKey + ":audit",
		Payload:       payload,
		MaxRetries:    defaultOutboxMaxRetries,
	})
}

func enqueueOutboxStatsTx(tx *gorm.DB, eventType, aggregateType string, aggregateID uint64, eventKey string, payload map[string]interface{}) error {
	return (&OutboxEventService{}).EnqueueTx(tx, OutboxEventInput{
		EventType:     eventType,
		AggregateType: aggregateType,
		AggregateID:   aggregateID,
		HandlerKey:    OutboxHandlerStats,
		EventKey:      eventKey + ":stats",
		Payload:       payload,
		MaxRetries:    defaultOutboxMaxRetries,
	})
}

func enqueueOutboxGovernanceTx(tx *gorm.DB, eventType, aggregateType string, aggregateID uint64, eventKey string, payload map[string]interface{}) error {
	return (&OutboxEventService{}).EnqueueTx(tx, OutboxEventInput{
		EventType:     eventType,
		AggregateType: aggregateType,
		AggregateID:   aggregateID,
		HandlerKey:    OutboxHandlerGovernance,
		EventKey:      eventKey + ":governance",
		Payload:       payload,
		MaxRetries:    defaultOutboxMaxRetries,
	})
}

func enqueueOutboxSMSTx(tx *gorm.DB, eventType, aggregateType string, aggregateID uint64, eventKey string, payload map[string]interface{}) error {
	return (&OutboxEventService{}).EnqueueTx(tx, OutboxEventInput{
		EventType:     eventType,
		AggregateType: aggregateType,
		AggregateID:   aggregateID,
		HandlerKey:    OutboxHandlerSMS,
		EventKey:      eventKey + ":sms",
		Payload:       payload,
		MaxRetries:    defaultOutboxMaxRetries,
	})
}

func enqueuePaymentPaidOutboxTx(tx *gorm.DB, payment *model.PaymentOrder, effect *paymentSideEffect) error {
	if payment == nil || payment.ID == 0 || effect == nil {
		return nil
	}
	baseEventKey := fmt.Sprintf("payment.paid:%d", payment.ID)
	basePayload := map[string]interface{}{
		"paymentId":  payment.ID,
		"bizType":    payment.BizType,
		"bizId":      payment.BizID,
		"amount":     payment.Amount,
		"amountCent": payment.AmountCent,
		"projectId":  effect.ProjectID,
		"bookingId":  effect.BookingID,
		"orderId":    effect.OrderID,
		"planName":   effect.PlanName,
	}
	if effect.UserID > 0 {
		title, content := buildPaidOrderReceiptCopy(effect.OrderType, effect.Amount, effect.PlanName)
		if effect.Kind == model.PaymentBizTypeBookingIntent || effect.Kind == model.PaymentBizTypeBookingSurveyDeposit {
			title = "量房定金支付成功"
			content = fmt.Sprintf("量房定金已支付成功，金额 %.2f 元。", effect.Amount)
		}
		payload := map[string]interface{}{
			"userId":      effect.UserID,
			"userType":    "user",
			"title":       title,
			"content":     content,
			"type":        NotificationTypePaymentOrderPaid,
			"relatedId":   paymentOutboxRelatedID(effect, payment.ID),
			"relatedType": paymentOutboxRelatedType(effect),
			"actionUrl":   buildPaymentOutboxActionURL(effect),
			"category":    NotificationCategoryPayment,
			"extra":       basePayload,
		}
		if err := enqueueOutboxNotificationTx(tx, OutboxEventPaymentPaid, "payment_order", payment.ID, baseEventKey+":user", payload); err != nil {
			return err
		}
	}
	if effect.ProviderUserID > 0 {
		payload := map[string]interface{}{
			"userId":      effect.ProviderUserID,
			"userType":    "provider",
			"title":       "款项已支付",
			"content":     fmt.Sprintf("有一笔款项已支付成功，金额 %.2f 元，请在业务详情中查看。", effect.Amount),
			"type":        model.NotificationTypeOrderPaid,
			"relatedId":   paymentOutboxRelatedID(effect, payment.ID),
			"relatedType": paymentOutboxRelatedType(effect),
			"actionUrl":   buildProviderPaymentOutboxActionURL(effect),
			"category":    NotificationCategoryPayment,
			"extra":       basePayload,
		}
		if err := enqueueOutboxNotificationTx(tx, OutboxEventPaymentPaid, "payment_order", payment.ID, baseEventKey+":provider", payload); err != nil {
			return err
		}
	}
	if err := enqueueOutboxAuditTx(tx, OutboxEventPaymentPaid, "payment_order", payment.ID, baseEventKey, map[string]interface{}{
		"operationType": OutboxEventPaymentPaid,
		"resourceType":  "payment_order",
		"resourceId":    payment.ID,
		"result":        "success",
		"metadata":      basePayload,
	}); err != nil {
		return err
	}
	return enqueueOutboxStatsTx(tx, OutboxEventPaymentPaid, "payment_order", payment.ID, baseEventKey, basePayload)
}

func enqueuePaymentClosedOutboxTx(tx *gorm.DB, payment *model.PaymentOrder, reason string) error {
	if payment == nil || payment.ID == 0 {
		return nil
	}
	eventKey := fmt.Sprintf("payment.closed:%d", payment.ID)
	payload := map[string]interface{}{
		"paymentId":  payment.ID,
		"bizType":    payment.BizType,
		"bizId":      payment.BizID,
		"amount":     payment.Amount,
		"amountCent": payment.AmountCent,
		"reason":     strings.TrimSpace(reason),
	}
	if payment.PayerUserID > 0 {
		if err := enqueueOutboxNotificationTx(tx, OutboxEventPaymentClosed, "payment_order", payment.ID, eventKey+":user", map[string]interface{}{
			"userId":      payment.PayerUserID,
			"userType":    "user",
			"title":       "支付单已关闭",
			"content":     "该支付单已关闭，如仍需支付请重新发起。",
			"type":        "payment.closed",
			"relatedId":   payment.ID,
			"relatedType": "payment_order",
			"actionUrl":   "/payments",
			"category":    NotificationCategoryPayment,
			"extra":       payload,
		}); err != nil {
			return err
		}
	}
	if err := enqueueOutboxAuditTx(tx, OutboxEventPaymentClosed, "payment_order", payment.ID, eventKey, map[string]interface{}{
		"operatorType":  "system",
		"operationType": OutboxEventPaymentClosed,
		"resourceType":  "payment_order",
		"resourceId":    payment.ID,
		"reason":        strings.TrimSpace(reason),
		"result":        "success",
		"metadata":      payload,
	}); err != nil {
		return err
	}
	return enqueueOutboxStatsTx(tx, OutboxEventPaymentClosed, "payment_order", payment.ID, eventKey, payload)
}

func EnqueuePaymentClosedOutboxTx(tx *gorm.DB, payment *model.PaymentOrder, reason string) error {
	return enqueuePaymentClosedOutboxTx(tx, payment, reason)
}

func buildPaymentOutboxActionURL(effect *paymentSideEffect) string {
	if effect.ProjectID > 0 {
		return fmt.Sprintf("/projects/%d", effect.ProjectID)
	}
	if effect.OrderID > 0 {
		return fmt.Sprintf("/orders/%d", effect.OrderID)
	}
	if effect.BookingID > 0 {
		return fmt.Sprintf("/bookings/%d", effect.BookingID)
	}
	return "/payments"
}

func paymentOutboxRelatedID(effect *paymentSideEffect, fallback uint64) uint64 {
	if effect.OrderID > 0 {
		return effect.OrderID
	}
	if effect.BookingID > 0 {
		return effect.BookingID
	}
	if effect.ProjectID > 0 {
		return effect.ProjectID
	}
	return fallback
}

func paymentOutboxRelatedType(effect *paymentSideEffect) string {
	if effect.OrderID > 0 {
		return "order"
	}
	if effect.BookingID > 0 {
		return "booking"
	}
	if effect.ProjectID > 0 {
		return "project"
	}
	return "payment"
}

func buildProviderPaymentOutboxActionURL(effect *paymentSideEffect) string {
	if effect.ProjectID > 0 {
		return fmt.Sprintf("/projects/%d/execution", effect.ProjectID)
	}
	if effect.OrderID > 0 {
		return fmt.Sprintf("/orders/%d", effect.OrderID)
	}
	if effect.BookingID > 0 {
		return "/bookings"
	}
	return "/income"
}

func enqueueQuoteAwardedOutboxTx(tx *gorm.DB, quoteList *model.QuoteList, submission *model.QuoteSubmission, projectID, orderID, providerUserID, userID uint64) error {
	if quoteList == nil || submission == nil || quoteList.ID == 0 || submission.ID == 0 {
		return nil
	}
	eventKey := fmt.Sprintf("quote.awarded:%d:%d", quoteList.ID, submission.ID)
	payload := map[string]interface{}{
		"quoteListId":    quoteList.ID,
		"submissionId":   submission.ID,
		"providerId":     submission.ProviderID,
		"projectId":      projectID,
		"orderId":        orderID,
		"totalCent":      submission.TotalCent,
		"ownerUserId":    userID,
		"providerUserId": providerUserID,
	}
	if providerUserID > 0 {
		notificationPayload := map[string]interface{}{
			"userId":      providerUserID,
			"userType":    "provider",
			"title":       "施工报价已确认",
			"content":     "用户已确认你的施工报价，请进入项目履约继续处理。",
			"type":        "quote.awarded",
			"relatedId":   firstNonZero(projectID, quoteList.ID),
			"relatedType": "project",
			"actionUrl":   buildQuoteAwardedProviderActionURL(projectID, quoteList.ID, orderID),
			"category":    NotificationCategoryProject,
			"extra":       payload,
		}
		if err := enqueueOutboxNotificationTx(tx, OutboxEventQuoteAwarded, "quote_list", quoteList.ID, eventKey, notificationPayload); err != nil {
			return err
		}
	}
	if err := enqueueOutboxAuditTx(tx, OutboxEventQuoteAwarded, "quote_list", quoteList.ID, eventKey, map[string]interface{}{
		"operatorType":  "user",
		"operatorId":    userID,
		"operationType": "confirm_construction_quote",
		"resourceType":  "quote_list",
		"resourceId":    quoteList.ID,
		"result":        "success",
		"metadata":      payload,
	}); err != nil {
		return err
	}
	return enqueueOutboxGovernanceTx(tx, OutboxEventQuoteAwarded, "quote_list", quoteList.ID, eventKey, payload)
}

func enqueueQuoteSubmittedOutboxTx(tx *gorm.DB, quoteList *model.QuoteList, submission *model.QuoteSubmission, providerName string) error {
	if quoteList == nil || submission == nil || quoteList.ID == 0 || submission.ID == 0 {
		return nil
	}
	eventKey := fmt.Sprintf("quote.submitted:%d:%d", quoteList.ID, submission.ID)
	payload := map[string]interface{}{
		"quoteListId":  quoteList.ID,
		"submissionId": submission.ID,
		"providerId":   submission.ProviderID,
		"projectId":    quoteList.ProjectID,
		"ownerUserId":  quoteList.OwnerUserID,
		"providerName": strings.TrimSpace(providerName),
	}
	if quoteList.OwnerUserID > 0 {
		content := "施工报价已提交，请尽快查看并确认。"
		if strings.TrimSpace(providerName) != "" {
			content = fmt.Sprintf("%s 已提交施工报价，请尽快查看并确认。", strings.TrimSpace(providerName))
		}
		if err := enqueueOutboxNotificationTx(tx, OutboxEventQuoteSubmitted, "quote_list", quoteList.ID, eventKey+":user", map[string]interface{}{
			"userId":      quoteList.OwnerUserID,
			"userType":    "user",
			"title":       "施工报价待确认",
			"content":     content,
			"type":        "quote.submitted",
			"relatedId":   quoteList.ID,
			"relatedType": "quote_list",
			"actionUrl":   fmt.Sprintf("/quote-tasks/%d", quoteList.ID),
			"category":    NotificationCategoryProject,
			"extra":       payload,
		}); err != nil {
			return err
		}
	}
	if err := enqueueOutboxAuditTx(tx, OutboxEventQuoteSubmitted, "quote_list", quoteList.ID, eventKey, map[string]interface{}{
		"operationType": OutboxEventQuoteSubmitted,
		"resourceType":  "quote_list",
		"resourceId":    quoteList.ID,
		"result":        "success",
		"metadata":      payload,
	}); err != nil {
		return err
	}
	return enqueueOutboxGovernanceTx(tx, OutboxEventQuoteSubmitted, "quote_list", quoteList.ID, eventKey, payload)
}

func enqueueQuoteRejectedOutboxTx(tx *gorm.DB, quoteList *model.QuoteList, submission *model.QuoteSubmission, providerUserID uint64, reason string) error {
	if quoteList == nil || submission == nil || quoteList.ID == 0 || submission.ID == 0 {
		return nil
	}
	eventKey := fmt.Sprintf("quote.rejected:%d:%d", quoteList.ID, submission.ID)
	reason = strings.TrimSpace(reason)
	payload := map[string]interface{}{
		"quoteListId":    quoteList.ID,
		"submissionId":   submission.ID,
		"providerId":     submission.ProviderID,
		"providerUserId": providerUserID,
		"projectId":      quoteList.ProjectID,
		"reason":         reason,
	}
	if providerUserID > 0 {
		if err := enqueueOutboxNotificationTx(tx, OutboxEventQuoteRejected, "quote_list", quoteList.ID, eventKey+":provider", map[string]interface{}{
			"userId":      providerUserID,
			"userType":    "provider",
			"title":       "施工报价被拒绝",
			"content":     fmt.Sprintf("用户已拒绝施工报价。原因：%s", reason),
			"type":        "quote.rejected",
			"relatedId":   quoteList.ID,
			"relatedType": "quote_list",
			"actionUrl":   fmt.Sprintf("/quote-lists/%d", quoteList.ID),
			"category":    NotificationCategoryProject,
			"extra":       payload,
		}); err != nil {
			return err
		}
	}
	if err := enqueueOutboxAuditTx(tx, OutboxEventQuoteRejected, "quote_list", quoteList.ID, eventKey, map[string]interface{}{
		"operationType": OutboxEventQuoteRejected,
		"resourceType":  "quote_list",
		"resourceId":    quoteList.ID,
		"reason":        reason,
		"result":        "success",
		"metadata":      payload,
	}); err != nil {
		return err
	}
	return enqueueOutboxGovernanceTx(tx, OutboxEventQuoteRejected, "quote_list", quoteList.ID, eventKey, payload)
}

func enqueueRefundCreatedOutboxTx(tx *gorm.DB, application *model.RefundApplication, providerUserID uint64) error {
	if application == nil || application.ID == 0 {
		return nil
	}
	eventKey := fmt.Sprintf("refund.created:%d", application.ID)
	payload := map[string]interface{}{
		"refundApplicationId": application.ID,
		"bookingId":           application.BookingID,
		"projectId":           application.ProjectID,
		"userId":              application.UserID,
		"providerUserId":      providerUserID,
		"requestedAmount":     application.RequestedAmount,
		"reason":              strings.TrimSpace(application.Reason),
	}
	if err := enqueueOutboxNotificationTx(tx, OutboxEventRefundCreated, "refund_application", application.ID, eventKey+":admin", map[string]interface{}{
		"userType":    "admin_broadcast",
		"title":       "新的退款申请",
		"content":     fmt.Sprintf("用户提交退款申请，申请金额 %.2f 元，请及时处理。", application.RequestedAmount),
		"type":        "refund.application.created",
		"relatedId":   application.ID,
		"relatedType": "refund_application",
		"actionUrl":   buildAdminRefundActionURL(application.ID),
		"category":    NotificationCategoryPayment,
		"extra":       payload,
	}); err != nil {
		return err
	}
	if providerUserID > 0 {
		if err := enqueueOutboxNotificationTx(tx, OutboxEventRefundCreated, "refund_application", application.ID, eventKey+":provider", map[string]interface{}{
			"userId":      providerUserID,
			"userType":    "provider",
			"title":       "用户发起退款申请",
			"content":     "用户已发起退款申请，请在项目或订单详情中查看。",
			"type":        "refund.application.created",
			"relatedId":   application.ID,
			"relatedType": "refund_application",
			"actionUrl":   buildProviderRefundActionURL(application.ProjectID, application.BookingID),
			"category":    NotificationCategoryPayment,
			"extra":       payload,
		}); err != nil {
			return err
		}
	}
	if err := enqueueOutboxAuditTx(tx, OutboxEventRefundCreated, "refund_application", application.ID, eventKey, map[string]interface{}{
		"operatorType":  "user",
		"operatorId":    application.UserID,
		"operationType": OutboxEventRefundCreated,
		"resourceType":  "refund_application",
		"resourceId":    application.ID,
		"reason":        strings.TrimSpace(application.Reason),
		"result":        "success",
		"metadata":      payload,
	}); err != nil {
		return err
	}
	return enqueueOutboxStatsTx(tx, OutboxEventRefundCreated, "refund_application", application.ID, eventKey, payload)
}

func buildQuoteAwardedProviderActionURL(projectID, quoteListID, orderID uint64) string {
	if projectID > 0 {
		return fmt.Sprintf("/projects/%d/execution", projectID)
	}
	if quoteListID > 0 {
		return fmt.Sprintf("/quotes/%d", quoteListID)
	}
	if orderID > 0 {
		return fmt.Sprintf("/orders/%d", orderID)
	}
	return "/projects"
}

func enqueueRefundSucceededOutboxTx(tx *gorm.DB, application *model.RefundApplication, userID, providerUserID uint64) error {
	if application == nil || application.ID == 0 {
		return nil
	}
	eventKey := fmt.Sprintf("refund.succeeded:%d", application.ID)
	payload := map[string]interface{}{
		"refundApplicationId": application.ID,
		"bookingId":           application.BookingID,
		"projectId":           application.ProjectID,
		"approvedAmount":      application.ApprovedAmount,
		"userId":              userID,
		"providerUserId":      providerUserID,
	}
	if userID > 0 {
		if err := enqueueOutboxNotificationTx(tx, OutboxEventRefundSucceeded, "refund_application", application.ID, eventKey+":user", map[string]interface{}{
			"userId":      userID,
			"userType":    "user",
			"title":       "退款已完成",
			"content":     fmt.Sprintf("您的退款已原路退回，退款金额 %.2f 元。", application.ApprovedAmount),
			"type":        "refund.succeeded",
			"relatedId":   application.ID,
			"relatedType": "refund_application",
			"actionUrl":   buildBookingRefundActionURL(application.BookingID),
			"category":    NotificationCategoryPayment,
			"extra":       payload,
		}); err != nil {
			return err
		}
	}
	if providerUserID > 0 {
		if err := enqueueOutboxNotificationTx(tx, OutboxEventRefundSucceeded, "refund_application", application.ID, eventKey+":provider", map[string]interface{}{
			"userId":      providerUserID,
			"userType":    "provider",
			"title":       "退款已完成",
			"content":     fmt.Sprintf("相关退款已执行完成，退款金额 %.2f 元。", application.ApprovedAmount),
			"type":        "refund.succeeded",
			"relatedId":   application.ID,
			"relatedType": "refund_application",
			"actionUrl":   buildProviderRefundActionURL(application.ProjectID, application.BookingID),
			"category":    NotificationCategoryPayment,
			"extra":       payload,
		}); err != nil {
			return err
		}
	}
	if err := enqueueOutboxAuditTx(tx, OutboxEventRefundSucceeded, "refund_application", application.ID, eventKey, map[string]interface{}{
		"operatorType":  "system",
		"operationType": OutboxEventRefundSucceeded,
		"resourceType":  "refund_application",
		"resourceId":    application.ID,
		"result":        "success",
		"metadata":      payload,
	}); err != nil {
		return err
	}
	return enqueueOutboxStatsTx(tx, OutboxEventRefundSucceeded, "refund_application", application.ID, eventKey, payload)
}

func enqueueRefundFailedOutboxTx(tx *gorm.DB, refund *model.RefundOrder, userID, providerUserID uint64) error {
	if refund == nil || refund.ID == 0 {
		return nil
	}
	eventKey := fmt.Sprintf("refund.failed:%d", refund.ID)
	reason := strings.TrimSpace(refund.FailureReason)
	if reason == "" {
		reason = "退款渠道处理失败"
	}
	payload := map[string]interface{}{
		"refundOrderId":       refund.ID,
		"refundApplicationId": refund.RefundApplicationID,
		"paymentOrderId":      refund.PaymentOrderID,
		"amount":              refund.Amount,
		"amountCent":          refund.AmountCent,
		"userId":              userID,
		"providerUserId":      providerUserID,
		"failureReason":       reason,
	}
	if userID > 0 {
		if err := enqueueOutboxNotificationTx(tx, OutboxEventRefundFailed, "refund_order", refund.ID, eventKey+":user", map[string]interface{}{
			"userId":      userID,
			"userType":    "user",
			"title":       "退款处理异常",
			"content":     "退款处理遇到异常，平台将继续跟进。",
			"type":        "refund.failed",
			"relatedId":   firstNonZero(refund.RefundApplicationID, refund.ID),
			"relatedType": "refund_application",
			"actionUrl":   "/refunds",
			"category":    NotificationCategoryPayment,
			"extra":       payload,
		}); err != nil {
			return err
		}
	}
	if err := enqueueOutboxNotificationTx(tx, OutboxEventRefundFailed, "refund_order", refund.ID, eventKey+":admin", map[string]interface{}{
		"userType":    "admin_broadcast",
		"title":       "退款执行失败",
		"content":     fmt.Sprintf("退款单 #%d 执行失败，请及时处理。", refund.ID),
		"type":        "refund.failed",
		"relatedId":   firstNonZero(refund.RefundApplicationID, refund.ID),
		"relatedType": "refund_application",
		"actionUrl":   "/orders?focus=refund",
		"category":    NotificationCategoryPayment,
		"extra":       payload,
	}); err != nil {
		return err
	}
	if err := enqueueOutboxAuditTx(tx, OutboxEventRefundFailed, "refund_order", refund.ID, eventKey, map[string]interface{}{
		"operatorType":  "system",
		"operationType": OutboxEventRefundFailed,
		"resourceType":  "refund_order",
		"resourceId":    refund.ID,
		"reason":        reason,
		"result":        "failed",
		"metadata":      payload,
	}); err != nil {
		return err
	}
	return enqueueOutboxStatsTx(tx, OutboxEventRefundFailed, "refund_order", refund.ID, eventKey, payload)
}

func enqueueChangeOrderOutboxTx(tx *gorm.DB, eventType string, changeOrder *model.ChangeOrder, project *model.Project, ownerUserID, providerUserID uint64, reason string, plan *model.PaymentPlan, orderID uint64) error {
	if changeOrder == nil || changeOrder.ID == 0 {
		return nil
	}
	projectID := changeOrder.ProjectID
	if project != nil && project.ID > 0 {
		projectID = project.ID
	}
	if ownerUserID == 0 && project != nil {
		ownerUserID = project.OwnerID
	}
	eventKey := fmt.Sprintf("%s:%d", eventType, changeOrder.ID)
	title := strings.TrimSpace(changeOrder.Title)
	if title == "" {
		title = fmt.Sprintf("变更单 #%d", changeOrder.ID)
	}
	payload := map[string]interface{}{
		"changeOrderId":  changeOrder.ID,
		"projectId":      projectID,
		"title":          title,
		"amountImpact":   changeOrder.AmountImpact,
		"timelineImpact": changeOrder.TimelineImpact,
		"status":         changeOrder.Status,
		"ownerUserId":    ownerUserID,
		"providerUserId": providerUserID,
		"reason":         strings.TrimSpace(reason),
	}
	switch eventType {
	case OutboxEventChangeOrderCreated:
		if ownerUserID > 0 {
			if err := enqueueOutboxNotificationTx(tx, eventType, "change_order", changeOrder.ID, eventKey+":user", map[string]interface{}{
				"userId":      ownerUserID,
				"userType":    "user",
				"title":       "项目变更待确认",
				"content":     fmt.Sprintf("商家已发起变更“%s”，请尽快确认或拒绝。", title),
				"type":        "change_order.created",
				"relatedId":   changeOrder.ID,
				"relatedType": "change_order",
				"actionUrl":   fmt.Sprintf("/projects/%d/change-request", projectID),
				"category":    NotificationCategoryProject,
				"extra":       payload,
			}); err != nil {
				return err
			}
		}
		if providerUserID > 0 {
			if err := enqueueOutboxNotificationTx(tx, eventType, "change_order", changeOrder.ID, eventKey+":provider", map[string]interface{}{
				"userId":      providerUserID,
				"userType":    "provider",
				"title":       "变更单已创建",
				"content":     fmt.Sprintf("变更“%s”已发送给业主，等待确认。", title),
				"type":        "change_order.created",
				"relatedId":   changeOrder.ID,
				"relatedType": "change_order",
				"actionUrl":   fmt.Sprintf("/projects/%d", projectID),
				"category":    NotificationCategoryProject,
				"extra":       payload,
			}); err != nil {
				return err
			}
		}
	case OutboxEventChangeOrderConfirmed:
		if providerUserID > 0 {
			if err := enqueueOutboxNotificationTx(tx, eventType, "change_order", changeOrder.ID, eventKey+":provider", map[string]interface{}{
				"userId":      providerUserID,
				"userType":    "provider",
				"title":       "项目变更已确认",
				"content":     "业主已确认该变更，后续将按新约定推进。",
				"type":        "change_order.confirmed",
				"relatedId":   changeOrder.ID,
				"relatedType": "change_order",
				"actionUrl":   fmt.Sprintf("/projects/%d", projectID),
				"category":    NotificationCategoryProject,
				"extra":       payload,
			}); err != nil {
				return err
			}
		}
		if plan != nil && ownerUserID > 0 {
			paymentPayload := copyMap(payload)
			paymentPayload["paymentPlanId"] = plan.ID
			paymentPayload["orderId"] = orderID
			if err := enqueueOutboxNotificationTx(tx, eventType, "change_order", changeOrder.ID, eventKey+":payment:user", map[string]interface{}{
				"userId":      ownerUserID,
				"userType":    "user",
				"title":       "变更款待支付",
				"content":     fmt.Sprintf("变更“%s”已确认，需支付 %.2f 元后生效。", title, plan.Amount),
				"type":        "change_order.payment_pending",
				"relatedId":   orderID,
				"relatedType": "order",
				"actionUrl":   fmt.Sprintf("/orders/%d", orderID),
				"category":    NotificationCategoryPayment,
				"extra":       paymentPayload,
			}); err != nil {
				return err
			}
		}
		if plan != nil && providerUserID > 0 {
			paymentPayload := copyMap(payload)
			paymentPayload["paymentPlanId"] = plan.ID
			paymentPayload["orderId"] = orderID
			if err := enqueueOutboxNotificationTx(tx, eventType, "change_order", changeOrder.ID, eventKey+":payment:provider", map[string]interface{}{
				"userId":      providerUserID,
				"userType":    "provider",
				"title":       "变更款待支付",
				"content":     fmt.Sprintf("变更“%s”已确认，待业主支付后生效。", title),
				"type":        "change_order.payment_pending",
				"relatedId":   orderID,
				"relatedType": "order",
				"actionUrl":   fmt.Sprintf("/projects/%d", projectID),
				"category":    NotificationCategoryPayment,
				"extra":       paymentPayload,
			}); err != nil {
				return err
			}
		}
	case OutboxEventChangeOrderRejected:
		reasonText := strings.TrimSpace(reason)
		if reasonText == "" {
			reasonText = "未填写"
		}
		if providerUserID > 0 {
			if err := enqueueOutboxNotificationTx(tx, eventType, "change_order", changeOrder.ID, eventKey+":provider", map[string]interface{}{
				"userId":      providerUserID,
				"userType":    "provider",
				"title":       "项目变更被拒绝",
				"content":     fmt.Sprintf("业主已拒绝该变更。原因：%s", reasonText),
				"type":        "change_order.rejected",
				"relatedId":   changeOrder.ID,
				"relatedType": "change_order",
				"actionUrl":   fmt.Sprintf("/projects/%d", projectID),
				"category":    NotificationCategoryProject,
				"extra":       payload,
			}); err != nil {
				return err
			}
		}
	case OutboxEventChangeOrderSettlementRequired, OutboxEventChangeOrderSettled:
		notificationTitle := "变更单待人工结算"
		notificationContent := fmt.Sprintf("项目 #%d 的减项变更“%s”待人工结算。", projectID, title)
		notificationType := "change_order.settlement_required"
		if eventType == OutboxEventChangeOrderSettled {
			notificationTitle = "变更单已结算"
			notificationContent = fmt.Sprintf("项目 #%d 的变更“%s”已完成人工结算。", projectID, title)
			notificationType = "change_order.settled"
		}
		if err := enqueueOutboxNotificationTx(tx, eventType, "change_order", changeOrder.ID, eventKey+":admin", map[string]interface{}{
			"userType":    "admin_broadcast",
			"title":       notificationTitle,
			"content":     notificationContent,
			"type":        notificationType,
			"relatedId":   changeOrder.ID,
			"relatedType": "change_order",
			"actionUrl":   buildAdminChangeOrderActionURL(projectID),
			"category":    NotificationCategoryPayment,
			"extra":       payload,
		}); err != nil {
			return err
		}
	}
	if err := enqueueOutboxAuditTx(tx, eventType, "change_order", changeOrder.ID, eventKey, map[string]interface{}{
		"operationType": eventType,
		"resourceType":  "change_order",
		"resourceId":    changeOrder.ID,
		"reason":        strings.TrimSpace(reason),
		"result":        "success",
		"metadata":      payload,
	}); err != nil {
		return err
	}
	return enqueueOutboxGovernanceTx(tx, eventType, "change_order", changeOrder.ID, eventKey, payload)
}

func enqueuePayoutOutboxTx(tx *gorm.DB, eventType string, payout *model.PayoutOrder, reason string) error {
	if payout == nil || payout.ID == 0 {
		return nil
	}
	projectID := resolvePayoutProjectIDTx(tx, payout)
	providerUserID := getProviderUserIDTx(tx, payout.ProviderID)
	eventKey := fmt.Sprintf("%s:%d", eventType, payout.ID)
	payload := map[string]interface{}{
		"payoutId":       payout.ID,
		"bizType":        payout.BizType,
		"bizId":          payout.BizID,
		"providerId":     payout.ProviderID,
		"providerUserId": providerUserID,
		"projectId":      projectID,
		"amount":         payout.Amount,
		"status":         payout.Status,
		"reason":         strings.TrimSpace(reason),
	}
	if providerUserID > 0 {
		title := "项目出款处理中"
		content := "项目结算已进入出款处理，请留意资金中心状态变化。"
		notificationType := NotificationTypeProjectPayoutProcessing
		if eventType == OutboxEventPayoutPaid {
			title = "项目已出款"
			content = "项目结算已完成出款，请在资金中心查看明细。"
			notificationType = NotificationTypeProjectPayoutPaid
		}
		if eventType == OutboxEventPayoutFailed {
			title = "项目出款失败"
			content = "项目出款失败，请在资金中心查看处理结果。"
			if strings.TrimSpace(reason) != "" {
				content = fmt.Sprintf("项目出款失败，原因：%s", strings.TrimSpace(reason))
			}
			notificationType = NotificationTypeProjectPayoutFailed
		}
		if err := enqueueOutboxNotificationTx(tx, eventType, "payout_order", payout.ID, eventKey+":provider", map[string]interface{}{
			"userId":      providerUserID,
			"userType":    "provider",
			"title":       title,
			"content":     content,
			"type":        notificationType,
			"relatedId":   payout.ID,
			"relatedType": "payout_order",
			"actionUrl":   buildProviderClosureActionURL(projectID),
			"category":    NotificationCategoryPayment,
			"extra":       payload,
		}); err != nil {
			return err
		}
	}
	if eventType == OutboxEventPayoutFailed {
		if err := enqueueOutboxNotificationTx(tx, eventType, "payout_order", payout.ID, eventKey+":admin", map[string]interface{}{
			"userType":    "admin_broadcast",
			"title":       "项目出款失败",
			"content":     fmt.Sprintf("出款单 #%d 执行失败，请在资金中心处理。", payout.ID),
			"type":        NotificationTypeProjectPayoutFailed,
			"relatedId":   payout.ID,
			"relatedType": "payout_order",
			"actionUrl":   buildAdminPayoutActionURL(),
			"category":    NotificationCategoryPayment,
			"extra":       payload,
		}); err != nil {
			return err
		}
	}
	if err := enqueueOutboxAuditTx(tx, eventType, "payout_order", payout.ID, eventKey, map[string]interface{}{
		"operatorType":  "system",
		"operationType": eventType,
		"resourceType":  "payout_order",
		"resourceId":    payout.ID,
		"reason":        strings.TrimSpace(reason),
		"result":        firstNonBlank(payoutEventResult(eventType), "success"),
		"metadata":      payload,
	}); err != nil {
		return err
	}
	return enqueueOutboxStatsTx(tx, eventType, "payout_order", payout.ID, eventKey, payload)
}

func enqueueProjectCompletionSubmittedOutboxTx(tx *gorm.DB, project *model.Project, providerUserID uint64) error {
	if project == nil || project.ID == 0 {
		return nil
	}
	eventKey := fmt.Sprintf("project.completion_submitted:%d", project.ID)
	payload := map[string]interface{}{
		"projectId":      project.ID,
		"ownerUserId":    project.OwnerID,
		"providerUserId": providerUserID,
	}
	if project.OwnerID > 0 {
		if err := enqueueOutboxNotificationTx(tx, OutboxEventProjectCompletionSubmitted, "project", project.ID, eventKey+":user", map[string]interface{}{
			"userId":      project.OwnerID,
			"userType":    "user",
			"title":       "完工材料待确认",
			"content":     "商家已提交完工材料，请尽快查看并确认。",
			"type":        "project.completion.submitted",
			"relatedId":   project.ID,
			"relatedType": "project",
			"actionUrl":   fmt.Sprintf("/projects/%d/completion", project.ID),
			"category":    NotificationCategoryProject,
			"extra":       payload,
		}); err != nil {
			return err
		}
	}
	if err := enqueueOutboxAuditTx(tx, OutboxEventProjectCompletionSubmitted, "project", project.ID, eventKey, map[string]interface{}{
		"operatorType":  "provider",
		"operatorId":    providerUserID,
		"operationType": OutboxEventProjectCompletionSubmitted,
		"resourceType":  "project",
		"resourceId":    project.ID,
		"result":        "success",
		"metadata":      payload,
	}); err != nil {
		return err
	}
	return enqueueOutboxGovernanceTx(tx, OutboxEventProjectCompletionSubmitted, "project", project.ID, eventKey, payload)
}

func enqueueProjectAcceptedOutboxTx(tx *gorm.DB, project *model.Project, providerUserID, caseAuditID, activatedPlanID uint64) error {
	if project == nil || project.ID == 0 {
		return nil
	}
	eventKey := fmt.Sprintf("project.accepted:%d", project.ID)
	payload := map[string]interface{}{
		"projectId":       project.ID,
		"ownerUserId":     project.OwnerID,
		"providerUserId":  providerUserID,
		"caseAuditId":     caseAuditID,
		"activatedPlanId": activatedPlanID,
	}
	if providerUserID > 0 {
		if err := enqueueOutboxNotificationTx(tx, OutboxEventProjectAccepted, "project", project.ID, eventKey+":provider", map[string]interface{}{
			"userId":      providerUserID,
			"userType":    "provider",
			"title":       "完工验收已通过",
			"content":     "用户已确认项目完工，项目进入结算与归档流程。",
			"type":        "project.completion.approved",
			"relatedId":   project.ID,
			"relatedType": "project",
			"actionUrl":   fmt.Sprintf("/projects/%d", project.ID),
			"category":    NotificationCategoryProject,
			"extra":       payload,
		}); err != nil {
			return err
		}
	}
	if err := enqueueOutboxAuditTx(tx, OutboxEventProjectAccepted, "project", project.ID, eventKey, map[string]interface{}{
		"operatorType":  "user",
		"operatorId":    project.OwnerID,
		"operationType": OutboxEventProjectAccepted,
		"resourceType":  "project",
		"resourceId":    project.ID,
		"result":        "success",
		"metadata":      payload,
	}); err != nil {
		return err
	}
	return enqueueOutboxGovernanceTx(tx, OutboxEventProjectAccepted, "project", project.ID, eventKey, payload)
}

func enqueueProjectDisputeCreatedOutboxTx(tx *gorm.DB, project *model.Project, providerUserID, auditID uint64, reason string) error {
	if project == nil || project.ID == 0 {
		return nil
	}
	eventKey := fmt.Sprintf("project.dispute.created:%d:%d", project.ID, auditID)
	reason = strings.TrimSpace(reason)
	payload := map[string]interface{}{
		"projectId":      project.ID,
		"ownerUserId":    project.OwnerID,
		"providerUserId": providerUserID,
		"auditId":        auditID,
		"reason":         reason,
	}
	if providerUserID > 0 {
		if err := enqueueOutboxNotificationTx(tx, OutboxEventProjectDisputeCreated, "project", project.ID, eventKey+":provider", map[string]interface{}{
			"userId":      providerUserID,
			"userType":    "provider",
			"title":       "项目进入争议处理",
			"content":     "用户已发起项目争议，请及时查看并配合平台处理。",
			"type":        "project.dispute.created",
			"relatedId":   project.ID,
			"relatedType": "project",
			"actionUrl":   fmt.Sprintf("/projects/%d/dispute", project.ID),
			"category":    NotificationCategoryProject,
			"extra":       payload,
		}); err != nil {
			return err
		}
	}
	if err := enqueueOutboxAuditTx(tx, OutboxEventProjectDisputeCreated, "project", project.ID, eventKey, map[string]interface{}{
		"operatorType":  "user",
		"operatorId":    project.OwnerID,
		"operationType": OutboxEventProjectDisputeCreated,
		"resourceType":  "project",
		"resourceId":    project.ID,
		"reason":        reason,
		"result":        "success",
		"metadata":      payload,
	}); err != nil {
		return err
	}
	if err := enqueueOutboxGovernanceTx(tx, OutboxEventProjectDisputeCreated, "project", project.ID, eventKey, payload); err != nil {
		return err
	}
	return enqueueOutboxSMSTx(tx, OutboxEventProjectDisputeCreated, "project", project.ID, eventKey, payload)
}

func resolvePayoutProjectIDTx(tx *gorm.DB, payout *model.PayoutOrder) uint64 {
	if tx == nil || payout == nil {
		return 0
	}
	switch payout.BizType {
	case model.PayoutBizTypeSettlementOrder:
		var settlement model.SettlementOrder
		if err := tx.Select("project_id").First(&settlement, payout.BizID).Error; err == nil {
			return settlement.ProjectID
		}
	case model.PayoutBizTypeMilestoneRelease:
		var milestone model.Milestone
		if err := tx.Select("project_id").First(&milestone, payout.BizID).Error; err == nil {
			return milestone.ProjectID
		}
	case model.PayoutBizTypeDesignDeliverable:
		var deliverable model.DesignDeliverable
		if err := tx.Select("project_id").First(&deliverable, payout.BizID).Error; err == nil {
			return deliverable.ProjectID
		}
	}
	return 0
}

func payoutEventResult(eventType string) string {
	if eventType == OutboxEventPayoutFailed {
		return "failed"
	}
	return "success"
}

func copyMap(input map[string]interface{}) map[string]interface{} {
	output := make(map[string]interface{}, len(input))
	for key, value := range input {
		output[key] = value
	}
	return output
}

func firstNonZero(values ...uint64) uint64 {
	for _, value := range values {
		if value > 0 {
			return value
		}
	}
	return 0
}
