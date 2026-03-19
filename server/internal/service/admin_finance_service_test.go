package service

import (
	"testing"

	"home-decoration-server/internal/model"

	"gorm.io/gorm"
)

func seedAdditionalFinanceFixture(t *testing.T, db *gorm.DB) {
	t.Helper()

	user := model.User{Base: model.Base{ID: 101}, Phone: "13800138101", Nickname: "业主B", Status: 1}
	providerUser := model.User{Base: model.Base{ID: 102}, Phone: "13800138102", Nickname: "施工方B", Status: 1}
	provider := model.Provider{Base: model.Base{ID: 111}, UserID: providerUser.ID, ProviderType: 2, CompanyName: "施工公司B", Status: 1}
	project := model.Project{
		Base:           model.Base{ID: 131},
		OwnerID:        user.ID,
		ProviderID:     provider.ID,
		Name:           "P2 财务项目",
		Status:         model.ProjectStatusActive,
		BusinessStatus: model.ProjectBusinessStatusInProgress,
	}
	escrow := model.EscrowAccount{
		Base:            model.Base{ID: 161},
		ProjectID:       project.ID,
		UserID:          user.ID,
		ProjectName:     project.Name,
		UserName:        user.Nickname,
		TotalAmount:     20000,
		FrozenAmount:    8000,
		AvailableAmount: 7000,
		ReleasedAmount:  5000,
		Status:          escrowStatusFrozen,
	}
	orderDesign := model.Order{Base: model.Base{ID: 171}, ProjectID: project.ID, BookingID: 0, OrderNo: "ORD-DESIGN-P2", OrderType: model.OrderTypeDesign, TotalAmount: 6000, Status: model.OrderStatusPaid}
	orderConstruction := model.Order{Base: model.Base{ID: 172}, ProjectID: project.ID, BookingID: 0, OrderNo: "ORD-CON-P2", OrderType: model.OrderTypeConstruction, TotalAmount: 14000, Status: model.OrderStatusPaid}
	booking := model.Booking{Base: model.Base{ID: 121}, UserID: user.ID, ProviderID: provider.ID, Address: "次级地址", IntentFee: 600, IntentFeePaid: true}
	releaseTrx := model.Transaction{Base: model.Base{ID: 181}, OrderID: "TRX-REL-P2", EscrowID: escrow.ID, Type: "release", Amount: 3000, Status: 1}

	for _, value := range []interface{}{&user, &providerUser, &provider, &project, &escrow, &orderDesign, &orderConstruction, &booking, &releaseTrx} {
		if err := db.Create(value).Error; err != nil {
			t.Fatalf("seed finance fixture failed: %v", err)
		}
	}
}

func TestAdminFinanceServiceOverviewAggregates(t *testing.T) {
	db := setupProjectRiskServiceTestDB(t)
	_, _, _, _, _ = seedProjectRiskFixture(t, db)
	seedAdditionalFinanceFixture(t, db)

	result, err := NewAdminFinanceService().GetOverview()
	if err != nil {
		t.Fatalf("GetOverview: %v", err)
	}
	if result.TotalBalance <= 0 {
		t.Fatalf("expected positive total balance, got %+v", result)
	}
	if result.PendingRelease <= 0 {
		t.Fatalf("expected pending release from active escrow, got %+v", result)
	}
	if result.FrozenAmount <= 0 {
		t.Fatalf("expected frozen amount from frozen escrow, got %+v", result)
	}
	if result.Statistics["designFee"] <= 0 || result.Statistics["constructionFee"] <= 0 || result.Statistics["intentFee"] <= 0 {
		t.Fatalf("expected statistics to be aggregated, got %+v", result.Statistics)
	}
}

func TestAdminFinanceServiceFreezeUnfreezeWritesAuditAndNotifications(t *testing.T) {
	db := setupProjectRiskServiceTestDB(t)
	user, _, project, _, _ := seedProjectRiskFixture(t, db)

	service := NewAdminFinanceService()
	if _, err := service.FreezeFunds(9001, &FreezeFundsInput{
		ProjectID: project.ID,
		Amount:    1200,
		Reason:    "人工冻结排查",
	}); err != nil {
		t.Fatalf("FreezeFunds: %v", err)
	}

	var escrow model.EscrowAccount
	if err := db.Where("project_id = ?", project.ID).First(&escrow).Error; err != nil {
		t.Fatalf("load escrow: %v", err)
	}
	if escrow.Status != escrowStatusFrozen {
		t.Fatalf("expected frozen escrow, got %+v", escrow)
	}
	if escrow.FrozenAmount != 1200 || escrow.AvailableAmount != 28800 {
		t.Fatalf("expected balances moved on freeze, got %+v", escrow)
	}

	var freezeLog model.AuditLog
	if err := db.Where("operation_type = ?", "freeze_funds").Order("id DESC").First(&freezeLog).Error; err != nil {
		t.Fatalf("expected freeze audit log: %v", err)
	}
	if freezeLog.RecordKind != "business" || freezeLog.ResourceID != project.ID {
		t.Fatalf("unexpected freeze audit log: %+v", freezeLog)
	}

	var notifications []model.Notification
	if err := db.Where("type = ?", "project.finance.frozen").Find(&notifications).Error; err != nil {
		t.Fatalf("load freeze notifications: %v", err)
	}
	if len(notifications) < 2 {
		t.Fatalf("expected user and provider notifications, got %+v", notifications)
	}

	if _, err := service.UnfreezeFunds(9001, &UnfreezeFundsInput{
		ProjectID: project.ID,
		Amount:    1200,
		Reason:    "恢复施工",
	}); err != nil {
		t.Fatalf("UnfreezeFunds: %v", err)
	}
	if err := db.Where("project_id = ?", project.ID).First(&escrow).Error; err != nil {
		t.Fatalf("reload escrow: %v", err)
	}
	if escrow.Status != escrowStatusActive {
		t.Fatalf("expected active escrow after unfreeze, got %+v", escrow)
	}
	if escrow.FrozenAmount != 0 || escrow.AvailableAmount != 30000 {
		t.Fatalf("expected balances restored on unfreeze, got %+v", escrow)
	}

	var userNotification model.Notification
	if err := db.Where("user_id = ? AND type = ?", user.ID, "project.finance.unfrozen").Order("id DESC").First(&userNotification).Error; err != nil {
		t.Fatalf("expected unfreeze user notification: %v", err)
	}
}

func TestAdminFinanceServiceFreezeUnfreezeBoundaryChecks(t *testing.T) {
	db := setupProjectRiskServiceTestDB(t)
	_, _, project, _, _ := seedProjectRiskFixture(t, db)

	service := NewAdminFinanceService()
	if _, err := service.FreezeFunds(9001, &FreezeFundsInput{
		ProjectID: project.ID,
		Amount:    50000,
		Reason:    "超额冻结",
	}); err == nil {
		t.Fatalf("expected freeze over available amount to fail")
	}

	if _, err := service.FreezeFunds(9001, &FreezeFundsInput{
		ProjectID: project.ID,
		Amount:    1000,
		Reason:    "第一次冻结",
	}); err != nil {
		t.Fatalf("FreezeFunds first: %v", err)
	}

	if _, err := service.UnfreezeFunds(9001, &UnfreezeFundsInput{
		ProjectID: project.ID,
		Amount:    2000,
		Reason:    "超额解冻",
	}); err == nil {
		t.Fatalf("expected unfreeze over frozen amount to fail")
	}
}

func TestAdminFinanceServiceManualReleaseWritesAudit(t *testing.T) {
	db := setupProjectRiskServiceTestDB(t)
	_, provider, project, milestone, _ := seedProjectRiskFixture(t, db)

	if err := db.Model(&milestone).Update("status", model.MilestoneStatusAccepted).Error; err != nil {
		t.Fatalf("set milestone accepted: %v", err)
	}

	service := NewAdminFinanceService()
	transaction, err := service.ManualRelease(9002, &ManualReleaseInput{
		ProjectID:   project.ID,
		MilestoneID: milestone.ID,
		Amount:      milestone.Amount,
		Reason:      "人工补放款",
	})
	if err != nil {
		t.Fatalf("ManualRelease: %v", err)
	}
	if transaction == nil || transaction.Type != "release" {
		t.Fatalf("expected release transaction, got %+v", transaction)
	}

	var refreshedMilestone model.Milestone
	if err := db.First(&refreshedMilestone, milestone.ID).Error; err != nil {
		t.Fatalf("reload milestone: %v", err)
	}
	if refreshedMilestone.Status != model.MilestoneStatusPaid {
		t.Fatalf("expected paid milestone, got %+v", refreshedMilestone)
	}
	if refreshedMilestone.ReleasedAt == nil {
		t.Fatalf("expected releasedAt to be written")
	}

	var income model.MerchantIncome
	if err := db.Where("provider_id = ? AND type = ?", provider.ID, "construction").Order("id DESC").First(&income).Error; err != nil {
		t.Fatalf("expected merchant income created: %v", err)
	}
	if income.Status != 1 {
		t.Fatalf("expected settled merchant income, got %+v", income)
	}

	var auditLog model.AuditLog
	if err := db.Where("operation_type = ?", "manual_release_funds").Order("id DESC").First(&auditLog).Error; err != nil {
		t.Fatalf("expected manual release audit log: %v", err)
	}
	if auditLog.ResourceID != project.ID {
		t.Fatalf("unexpected audit log resource: %+v", auditLog)
	}

	var providerNotification model.Notification
	if err := db.Where("user_id = ? AND type = ?", provider.UserID, "project.finance.released").Order("id DESC").First(&providerNotification).Error; err != nil {
		t.Fatalf("expected provider notification: %v", err)
	}
}

func TestAdminFinanceServiceManualReleaseBlockedWhenFrozen(t *testing.T) {
	db := setupProjectRiskServiceTestDB(t)
	_, _, project, milestone, _ := seedProjectRiskFixture(t, db)

	if err := db.Model(&milestone).Update("status", model.MilestoneStatusAccepted).Error; err != nil {
		t.Fatalf("set milestone accepted: %v", err)
	}
	if _, err := freezeEscrowBalanceTx(db, project.ID, 1000); err != nil {
		t.Fatalf("freeze escrow: %v", err)
	}

	service := NewAdminFinanceService()
	if _, err := service.ManualRelease(9002, &ManualReleaseInput{
		ProjectID:   project.ID,
		MilestoneID: milestone.ID,
		Amount:      milestone.Amount,
		Reason:      "冻结状态下放款",
	}); err == nil {
		t.Fatalf("expected manual release to fail when frozen balance exists")
	}
}
