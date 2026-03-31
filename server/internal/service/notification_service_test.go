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
	if err := db.AutoMigrate(&model.Notification{}, &model.SysAdmin{}); err != nil {
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
	if len(notifications) != 6 {
		t.Fatalf("expected 6 notifications, got %d", len(notifications))
	}

	expected := []struct {
		notificationType string
		actionURL        string
	}{
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

func TestAdminActionURLHelpersUseFrontendRoutes(t *testing.T) {
	if got := buildAdminRefundActionURL(18); got != "/refunds/18" {
		t.Fatalf("expected admin refund route /refunds/18, got %s", got)
	}
	if got := buildAdminProjectAuditActionURL(19); got != "/project-audits/19" {
		t.Fatalf("expected admin project audit route /project-audits/19, got %s", got)
	}
}
