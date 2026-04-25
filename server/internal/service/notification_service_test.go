package service

import (
	"testing"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"

	gormsqlite "gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupNotificationServiceTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	db, err := gorm.Open(gormsqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite db: %v", err)
	}
	if err := db.AutoMigrate(
		&model.Notification{},
		&model.SysAdmin{},
		&model.UserSettings{},
		&model.BudgetConfirmation{},
		&model.DesignFeeQuote{},
		&model.DesignDeliverable{},
		&model.Proposal{},
		&model.Contract{},
		&model.Order{},
		&model.QuoteList{},
		&model.Milestone{},
		&model.Project{},
		&model.ChangeOrder{},
	); err != nil {
		t.Fatalf("migrate sqlite db: %v", err)
	}

	previousDB := repository.DB
	repository.DB = db
	t.Cleanup(func() {
		repository.DB = previousDB
	})

	return db
}

func TestNotificationServiceMerchantActionURLsUseRealRoutes(t *testing.T) {
	db := setupNotificationServiceTestDB(t)
	svc := &NotificationService{}

	booking := &model.Booking{Base: model.Base{ID: 101}, Address: "测试地址", IntentFee: 500, ProviderID: 501, ProviderType: "designer", UserID: 7001}
	if err := svc.NotifyBookingCreated(booking, 9001); err != nil {
		t.Fatalf("NotifyBookingCreated: %v", err)
	}
	if err := svc.NotifyBookingIntentPaid(booking, 9001); err != nil {
		t.Fatalf("NotifyBookingIntentPaid: %v", err)
	}
	if err := svc.NotifyBookingConfirmed(booking); err != nil {
		t.Fatalf("NotifyBookingConfirmed: %v", err)
	}
	if err := svc.NotifyBookingRejected(booking); err != nil {
		t.Fatalf("NotifyBookingRejected: %v", err)
	}
	if err := svc.NotifyProposalConfirmed(map[string]interface{}{"id": uint64(102)}, 9001); err != nil {
		t.Fatalf("NotifyProposalConfirmed: %v", err)
	}
	if err := svc.NotifyProposalRejected(map[string]interface{}{"id": uint64(103), "version": 2}, 9001, "需要重做"); err != nil {
		t.Fatalf("NotifyProposalRejected: %v", err)
	}
	if err := svc.NotifyOrderPaid(map[string]interface{}{"id": uint64(104), "amount": 8888.0}, 9001); err != nil {
		t.Fatalf("NotifyOrderPaid: %v", err)
	}
	withdraw := &model.MerchantWithdraw{Base: model.Base{ID: 105}, Amount: 3200, OrderNo: "WD-001", FailReason: "资料不全"}
	if err := svc.NotifyWithdrawApproved(withdraw, 9001); err != nil {
		t.Fatalf("NotifyWithdrawApproved: %v", err)
	}
	if err := svc.NotifyWithdrawCompleted(withdraw, 9001); err != nil {
		t.Fatalf("NotifyWithdrawCompleted: %v", err)
	}
	if err := svc.NotifyWithdrawRejected(withdraw, 9001); err != nil {
		t.Fatalf("NotifyWithdrawRejected: %v", err)
	}

	var notifications []model.Notification
	if err := db.Order("id ASC").Find(&notifications).Error; err != nil {
		t.Fatalf("load notifications: %v", err)
	}
	if len(notifications) != 10 {
		t.Fatalf("expected 10 notifications, got %d", len(notifications))
	}

	expected := []string{"/bookings", "/bookings", "/bookings/101", "/bookings/101", "/proposals", "/proposals", "/orders", "/withdraw", "/withdraw", "/withdraw"}
	for idx, actionURL := range expected {
		if notifications[idx].ActionURL != actionURL {
			t.Fatalf("expected notification %d actionUrl=%s, got %s", idx, actionURL, notifications[idx].ActionURL)
		}
	}

	if notifications[0].Type != model.NotificationTypeBookingCreated {
		t.Fatalf("expected created notification type, got %s", notifications[0].Type)
	}
	if notifications[2].Type != model.NotificationTypeBookingConfirmed {
		t.Fatalf("expected confirmed notification type, got %s", notifications[2].Type)
	}
	if notifications[3].Type != model.NotificationTypeBookingCancelled {
		t.Fatalf("expected cancelled notification type, got %s", notifications[3].Type)
	}
}

func TestNotificationDispatcherRefundAndCompletionActionURLsUseRealRoutes(t *testing.T) {
	db := setupNotificationServiceTestDB(t)
	dispatcher := NewNotificationDispatcher()

	admin := &model.SysAdmin{
		ID:       7001,
		Username: "admin_route_test",
		Password: "hashed",
		Status:   1,
	}
	if err := db.Create(admin).Error; err != nil {
		t.Fatalf("create admin: %v", err)
	}

	dispatcher.NotifySiteSurveySubmitted(2006, 5006, 6006)
	dispatcher.NotifyProjectCompletionSubmitted(2001, 3001)
	dispatcher.NotifyProjectCompletionDecision(2002, 3001, false, "资料不完整")
	dispatcher.NotifyAdminRefundApplicationCreated(4001, 5001, 3001)
	dispatcher.NotifyUserRefundApplicationDecision(2003, 4001, 5001, true, "您的退款申请已审核通过")
	dispatcher.NotifyProviderRefundApplicationCreated(2004, 4002, 3002, 0)
	dispatcher.NotifyProviderRefundApplicationDecision(2005, 4003, 0, 5002, false)

	var notifications []model.Notification
	if err := db.Order("id ASC").Find(&notifications).Error; err != nil {
		t.Fatalf("load notifications: %v", err)
	}
	if len(notifications) != 7 {
		t.Fatalf("expected 7 notifications, got %d", len(notifications))
	}

	expected := []struct {
		notificationType string
		actionURL        string
	}{
		{NotificationTypeSiteSurveySubmitted, "/bookings/5006/site-survey"},
		{"project.completion.submitted", "/projects/3001/completion"},
		{"project.completion.rejected", "/projects/3001"},
		{"refund.application.created", "/refunds/4001"},
		{"refund.application.approved", "/bookings/5001/refund"},
		{"refund.application.created", "/projects/3002/dispute"},
		{"refund.application.rejected", "/bookings"},
	}

	for idx, item := range notifications {
		if item.Type != expected[idx].notificationType {
			t.Fatalf("expected notification %d type=%s, got %s", idx, expected[idx].notificationType, item.Type)
		}
		if item.ActionURL != expected[idx].actionURL {
			t.Fatalf("expected notification %d actionUrl=%s, got %s", idx, expected[idx].actionURL, item.ActionURL)
		}
	}
}

func TestNotificationDispatcherClosureLifecycleActionURLsUseRealRoutes(t *testing.T) {
	db := setupNotificationServiceTestDB(t)
	dispatcher := NewNotificationDispatcher()

	admin := &model.SysAdmin{
		ID:       7002,
		Username: "admin_closure_test",
		Password: "hashed",
		Status:   1,
	}
	if err := db.Create(admin).Error; err != nil {
		t.Fatalf("create admin: %v", err)
	}

	dispatcher.NotifyProjectSettlementScheduled(2001, 3001, 4001, nil)
	dispatcher.NotifyProjectPayoutProcessing(2001, 3001, 5001)
	dispatcher.NotifyProjectPayoutFailed(2001, 3001, 5001, "银行卡校验失败")
	dispatcher.NotifyProjectCaseDraftGenerated(2001, 3001, 6001)

	var notifications []model.Notification
	if err := db.Order("id ASC").Find(&notifications).Error; err != nil {
		t.Fatalf("load notifications: %v", err)
	}
	if len(notifications) != 6 {
		t.Fatalf("expected 6 notifications, got %d", len(notifications))
	}

	expected := []struct {
		notificationType string
		actionURL        string
	}{
		{NotificationTypeProjectSettlementScheduled, "/income?projectId=3001"},
		{NotificationTypeProjectPayoutProcessing, "/income?projectId=3001"},
		{NotificationTypeProjectPayoutFailed, "/income?projectId=3001"},
		{NotificationTypeProjectPayoutFailed, "/finance/payouts"},
		{NotificationTypeProjectCaseDraftGenerated, "/cases"},
		{NotificationTypeCaseAuditCreated, "/cases/manage"},
	}

	for idx, item := range notifications {
		if item.Type != expected[idx].notificationType {
			t.Fatalf("expected notification %d type=%s, got %s", idx, expected[idx].notificationType, item.Type)
		}
		if item.ActionURL != expected[idx].actionURL {
			t.Fatalf("expected notification %d actionUrl=%s, got %s", idx, expected[idx].actionURL, item.ActionURL)
		}
	}
}

func TestNotificationDispatcherChangeOrderAdminActionURLsUseOrderCenterFilters(t *testing.T) {
	db := setupNotificationServiceTestDB(t)
	dispatcher := NewNotificationDispatcher()

	admin := &model.SysAdmin{
		ID:       7102,
		Username: "admin_change_order_route_test",
		Password: "hashed",
		Status:   1,
	}
	if err := db.Create(admin).Error; err != nil {
		t.Fatalf("create admin: %v", err)
	}

	dispatcher.NotifyChangeOrderDecision(0, 0, 901, 1001, true, "")
	dispatcher.NotifyChangeOrderSettlementRequired(901, 1002, "减项结算")
	dispatcher.NotifyChangeOrderSettled(901, 1003, "减项结算")

	var notifications []model.Notification
	if err := db.Where("user_type = ?", "admin").Order("id ASC").Find(&notifications).Error; err != nil {
		t.Fatalf("load notifications: %v", err)
	}
	if len(notifications) != 3 {
		t.Fatalf("expected 3 admin notifications, got %d", len(notifications))
	}

	for idx, item := range notifications {
		if item.ActionURL != "/orders?projectId=901&focus=change-order" {
			t.Fatalf("expected notification %d actionUrl to target filtered order center, got %s", idx, item.ActionURL)
		}
	}
}

func TestNotificationDispatcherQuoteDecisionApprovedUsesCanonicalAwardedRoute(t *testing.T) {
	db := setupNotificationServiceTestDB(t)
	dispatcher := NewNotificationDispatcher()

	dispatcher.NotifyQuoteDecision(101, 202, 303, true, "")

	var notifications []model.Notification
	if err := db.Where("user_id = ? AND user_type = ?", 101, "provider").Find(&notifications).Error; err != nil {
		t.Fatalf("load provider notifications: %v", err)
	}
	if len(notifications) != 1 {
		t.Fatalf("expected one provider notification, got %d", len(notifications))
	}
	if notifications[0].Type != "quote.awarded" {
		t.Fatalf("expected canonical quote.awarded, got %s", notifications[0].Type)
	}
	if notifications[0].RelatedType != "project" || notifications[0].RelatedID != 303 {
		t.Fatalf("expected project-related awarded notification, got type=%s id=%d", notifications[0].RelatedType, notifications[0].RelatedID)
	}
	if notifications[0].ActionURL != "/projects/303" {
		t.Fatalf("expected awarded notification to jump project execution, got %s", notifications[0].ActionURL)
	}
}

func TestAdminActionURLHelpersUseFrontendRoutes(t *testing.T) {
	if got := buildAdminRefundActionURL(18); got != "/refunds/18" {
		t.Fatalf("expected admin refund route /refunds/18, got %s", got)
	}
	if got := buildAdminProjectAuditActionURL(19); got != "/project-audits/19" {
		t.Fatalf("expected admin project audit route /project-audits/19, got %s", got)
	}
	if got := buildAdminWithdrawActionURL(20); got != "/withdraws/20" {
		t.Fatalf("expected admin withdraw route /withdraws/20, got %s", got)
	}
}

func TestNotificationListItemUsesUnifiedTypeLabelAndRoleAwareActionLabel(t *testing.T) {
	db := setupNotificationServiceTestDB(t)
	svc := &NotificationService{}

	order := &model.Order{Base: model.Base{ID: 1001}, Status: model.OrderStatusPending}
	if err := db.Create(order).Error; err != nil {
		t.Fatalf("create order: %v", err)
	}
	changeOrder := &model.ChangeOrder{
		Base:   model.Base{ID: 2001},
		Status: model.ChangeOrderStatusPendingUserConfirm,
	}
	if err := db.Create(changeOrder).Error; err != nil {
		t.Fatalf("create change order: %v", err)
	}

	providerItem := svc.buildNotificationListItem(model.Notification{
		Type:      "payment.construction.expiring",
		UserType:  "provider",
		RelatedID: 1001,
		ActionURL: "/projects/3001",
	})
	if providerItem.TypeLabel != "施工付款" {
		t.Fatalf("expected provider typeLabel=施工付款, got %s", providerItem.TypeLabel)
	}
	if providerItem.ActionLabel != "查看项目" {
		t.Fatalf("expected provider actionLabel=查看项目, got %s", providerItem.ActionLabel)
	}

	userItem := svc.buildNotificationListItem(model.Notification{
		Type:      "payment.construction.expiring",
		UserType:  "user",
		RelatedID: 1001,
		ActionURL: "/orders/1001",
	})
	if userItem.ActionLabel != "去支付" {
		t.Fatalf("expected user actionLabel=去支付, got %s", userItem.ActionLabel)
	}

	startItem := svc.buildNotificationListItem(model.Notification{
		Type:      NotificationTypeProjectPlannedStartUpdated,
		UserType:  "user",
		ActionURL: "/projects/3001",
	})
	if startItem.TypeLabel != "待开工" {
		t.Fatalf("expected planned-start typeLabel=待开工, got %s", startItem.TypeLabel)
	}
	if startItem.ActionLabel != "查看项目" {
		t.Fatalf("expected planned-start actionLabel=查看项目, got %s", startItem.ActionLabel)
	}

	quoteAwardedItem := svc.buildNotificationListItem(model.Notification{
		Type:      "quote.awarded",
		UserType:  "provider",
		ActionURL: "/projects/3001",
	})
	if quoteAwardedItem.TypeLabel != "施工报价" {
		t.Fatalf("expected quote-awarded typeLabel=施工报价, got %s", quoteAwardedItem.TypeLabel)
	}
	if quoteAwardedItem.ActionLabel != "查看详情" {
		t.Fatalf("expected quote-awarded actionLabel=查看详情, got %s", quoteAwardedItem.ActionLabel)
	}

	budgetRejectedItem := svc.buildNotificationListItem(model.Notification{
		Type:      NotificationTypeBudgetConfirmationRejected,
		UserType:  "provider",
		ActionURL: "/bookings/5001/flow?step=budget&mode=edit",
	})
	if budgetRejectedItem.SupportsMini {
		t.Fatalf("expected rejected budget confirmation to remain unsupported in mini, got %+v", budgetRejectedItem)
	}

	changeOrderUserItem := svc.buildNotificationListItem(model.Notification{
		Type:      "change_order.created",
		UserType:  "user",
		RelatedID: changeOrder.ID,
		ActionURL: "/projects/3001/change-request",
	})
	if !changeOrderUserItem.ActionRequired || changeOrderUserItem.ActionStatus != NotificationActionStatusPending || changeOrderUserItem.ActionLabel != "处理变更" {
		t.Fatalf("expected owner change-order notification to stay actionable, got %+v", changeOrderUserItem)
	}

	changeOrderProviderItem := svc.buildNotificationListItem(model.Notification{
		Type:      "change_order.created",
		UserType:  "provider",
		RelatedID: changeOrder.ID,
		ActionURL: "/projects/3001",
	})
	if changeOrderProviderItem.ActionRequired || changeOrderProviderItem.ActionStatus != NotificationActionStatusNone || changeOrderProviderItem.ActionLabel != "查看项目" {
		t.Fatalf("expected provider change-order notification to be informational, got %+v", changeOrderProviderItem)
	}
}

func TestNotificationServiceRespectsUserPaymentPreference(t *testing.T) {
	db := setupNotificationServiceTestDB(t)
	if err := db.Model(&model.UserSettings{}).Create(map[string]any{
		"user_id":        9001,
		"notify_system":  true,
		"notify_project": true,
		"notify_payment": false,
	}).Error; err != nil {
		t.Fatalf("create user settings: %v", err)
	}

	svc := &NotificationService{}
	if err := svc.Create(&CreateNotificationInput{
		UserID:      9001,
		UserType:    "user",
		Title:       "订单待支付",
		Content:     "请尽快支付",
		Type:        model.NotificationTypeOrderCreated,
		RelatedID:   1001,
		RelatedType: "order",
		ActionURL:   "/orders/1001",
	}); err != nil {
		t.Fatalf("create payment notification: %v", err)
	}
	if err := svc.Create(&CreateNotificationInput{
		UserID:      9001,
		UserType:    "user",
		Title:       "方案已提交",
		Content:     "请确认方案",
		Type:        model.NotificationTypeProposalSubmitted,
		RelatedID:   1002,
		RelatedType: "proposal",
		ActionURL:   "/proposals/1002",
	}); err != nil {
		t.Fatalf("create project notification: %v", err)
	}

	var notifications []model.Notification
	if err := db.Order("id ASC").Find(&notifications).Error; err != nil {
		t.Fatalf("load notifications: %v", err)
	}
	if len(notifications) != 1 {
		t.Fatalf("expected 1 notification after filtering, got %d", len(notifications))
	}
	if notifications[0].Type != model.NotificationTypeProposalSubmitted {
		t.Fatalf("expected project notification to remain, got %+v", notifications[0])
	}
}

func TestNotificationServiceGetUserNotificationsBuildsActionMetadata(t *testing.T) {
	db := setupNotificationServiceTestDB(t)
	if err := db.Create(&model.BudgetConfirmation{
		Base:       model.Base{ID: 101},
		BookingID:  88,
		ProviderID: 77,
		Status:     model.BudgetConfirmationStatusSubmitted,
	}).Error; err != nil {
		t.Fatalf("create budget confirmation: %v", err)
	}
	if err := db.Create(&model.Order{
		Base:        model.Base{ID: 202},
		OrderNo:     "20260414112233000001",
		OrderType:   model.OrderTypeDesign,
		TotalAmount: 1888,
		Status:      model.OrderStatusPaid,
	}).Error; err != nil {
		t.Fatalf("create order: %v", err)
	}
	for _, notification := range []model.Notification{
		{
			Base:        model.Base{ID: 301},
			UserID:      9001,
			UserType:    "user",
			Title:       "沟通确认待处理",
			Content:     "请确认",
			Type:        NotificationTypeBudgetConfirmationSubmitted,
			RelatedID:   101,
			RelatedType: "budget_confirmation",
			ActionURL:   "/bookings/88/budget-confirm",
		},
		{
			Base:        model.Base{ID: 302},
			UserID:      9001,
			UserType:    "user",
			Title:       "支付成功",
			Content:     "设计费已支付",
			Type:        NotificationTypePaymentOrderPaid,
			RelatedID:   202,
			RelatedType: "order",
			ActionURL:   "/orders/202",
		},
	} {
		if err := db.Create(&notification).Error; err != nil {
			t.Fatalf("create notification: %v", err)
		}
	}

	svc := &NotificationService{}
	items, total, err := svc.GetUserNotifications(9001, "user", 1, 10)
	if err != nil {
		t.Fatalf("GetUserNotifications: %v", err)
	}
	if total != 2 || len(items) != 2 {
		t.Fatalf("expected 2 notifications, got total=%d len=%d", total, len(items))
	}

	byType := make(map[string]NotificationListItem, len(items))
	for _, item := range items {
		byType[item.Type] = item
	}

	budgetItem := byType[NotificationTypeBudgetConfirmationSubmitted]
	if budgetItem.Kind != NotificationKindTodo || !budgetItem.ActionRequired || budgetItem.ActionStatus != NotificationActionStatusPending {
		t.Fatalf("unexpected budget notification metadata: %+v", budgetItem)
	}
	if budgetItem.ActionLabel != "去确认" || !budgetItem.SupportsMini {
		t.Fatalf("unexpected budget notification action info: %+v", budgetItem)
	}

	paidItem := byType[NotificationTypePaymentOrderPaid]
	if paidItem.Kind != NotificationKindResult || paidItem.ActionStatus != NotificationActionStatusNone || paidItem.Category != NotificationCategoryPayment {
		t.Fatalf("unexpected paid notification metadata: %+v", paidItem)
	}
}

func TestNotificationRouteSupportedInMiniCoversMainFlowRoutes(t *testing.T) {
	cases := []struct {
		route    string
		expected bool
	}{
		{"/bookings/1001/site-survey", true},
		{"/bookings/1001/design-quote", true},
		{"/projects/2002/completion", true},
		{"/orders/3003", true},
		{"/refunds/10", false},
		{"/admin/quotes/88", false},
	}

	for _, item := range cases {
		got := notificationRouteSupportedInMini(item.route)
		if got != item.expected {
			t.Fatalf("route %s expected mini support=%v, got %v", item.route, item.expected, got)
		}
	}
}
