package service

import (
	"strings"
	"testing"

	"home-decoration-server/internal/model"
)

func TestSettlementServiceReleaseMilestoneSchedulesManualPayoutAndAudit(t *testing.T) {
	db := setupProjectRiskServiceTestDB(t)
	user, provider, project, milestone, _ := seedProjectRiskFixture(t, db)

	if err := db.Model(&milestone).Update("status", model.MilestoneStatusAccepted).Error; err != nil {
		t.Fatalf("set milestone accepted: %v", err)
	}

	result, err := (&SettlementService{}).ReleaseMilestone(&ReleaseMilestoneInput{
		ProjectID:    project.ID,
		MilestoneID:  milestone.ID,
		OperatorType: "user",
		OperatorID:   user.ID,
		Reason:       "阶段验收后正常放款",
		Source:       "test.stage_release",
	})
	if err != nil {
		t.Fatalf("ReleaseMilestone: %v", err)
	}
	if result == nil || result.SettlementOrder == nil || result.MerchantIncome == nil {
		t.Fatalf("expected release artifacts, got %+v", result)
	}
	if result.Transaction != nil {
		t.Fatalf("manual payout projection must not create release transaction before transfer confirmation, got %+v", result.Transaction)
	}

	var refreshedMilestone model.Milestone
	if err := db.First(&refreshedMilestone, milestone.ID).Error; err != nil {
		t.Fatalf("reload milestone: %v", err)
	}
	if refreshedMilestone.Status != model.MilestoneStatusAccepted || refreshedMilestone.ReleasedAt != nil {
		t.Fatalf("expected accepted milestone waiting for manual payout, got %+v", refreshedMilestone)
	}

	var escrow model.EscrowAccount
	if err := db.Where("project_id = ?", project.ID).First(&escrow).Error; err != nil {
		t.Fatalf("reload escrow: %v", err)
	}
	if escrow.AvailableAmount != 30000 || escrow.ReleasedAmount != 0 {
		t.Fatalf("unexpected escrow balances: %+v", escrow)
	}

	var incomes int64
	if err := db.Model(&model.MerchantIncome{}).Where("provider_id = ? AND type = ?", provider.ID, "construction").Count(&incomes).Error; err != nil {
		t.Fatalf("count merchant incomes: %v", err)
	}
	if incomes != 1 {
		t.Fatalf("expected 1 merchant income, got %d", incomes)
	}
	var payout model.PayoutOrder
	if err := db.First(&payout, result.SettlementOrder.PayoutOrderID).Error; err != nil {
		t.Fatalf("expected payout order: %v", err)
	}
	if payout.Status != model.PayoutStatusProcessing {
		t.Fatalf("expected manual payout to wait in processing, got %+v", payout)
	}
	if result.SettlementOrder.Status != model.SettlementStatusPayoutProcessing {
		t.Fatalf("expected settlement payout_processing, got %+v", result.SettlementOrder)
	}

	var auditLog model.AuditLog
	if err := db.Where("operation_type = ?", "release_milestone_funds").Order("id DESC").First(&auditLog).Error; err != nil {
		t.Fatalf("expected release audit log: %v", err)
	}
	if auditLog.OperatorType != "user" || auditLog.ResourceID != project.ID {
		t.Fatalf("unexpected release audit log: %+v", auditLog)
	}
	if !strings.Contains(auditLog.Metadata, "test.stage_release") {
		t.Fatalf("expected release source in audit metadata, got %+v", auditLog)
	}
}

func TestSettlementServiceRejectsCrossProjectMilestoneRelease(t *testing.T) {
	db := setupProjectRiskServiceTestDB(t)
	user, provider, _, milestoneA, _ := seedProjectRiskFixture(t, db)

	if err := db.Model(&milestoneA).Update("status", model.MilestoneStatusAccepted).Error; err != nil {
		t.Fatalf("set milestone accepted: %v", err)
	}

	projectB := model.Project{
		Base:           model.Base{ID: 131},
		OwnerID:        user.ID,
		ProviderID:     provider.ID,
		Name:           "项目B",
		Address:        "另一个地址",
		Status:         model.ProjectStatusActive,
		BusinessStatus: model.ProjectBusinessStatusInProgress,
	}
	escrowB := model.EscrowAccount{
		Base:            model.Base{ID: 161},
		ProjectID:       projectB.ID,
		UserID:          user.ID,
		TotalAmount:     20000,
		AvailableAmount: 20000,
		Status:          escrowStatusActive,
	}
	for _, record := range []interface{}{&projectB, &escrowB} {
		if err := db.Create(record).Error; err != nil {
			t.Fatalf("seed project B: %v", err)
		}
	}

	_, err := (&SettlementService{}).ReleaseMilestone(&ReleaseMilestoneInput{
		ProjectID:    projectB.ID,
		MilestoneID:  milestoneA.ID,
		OperatorType: "user",
		OperatorID:   user.ID,
		Reason:       "跨项目串账测试",
		Source:       "test.cross_project",
	})
	if err == nil || !strings.Contains(err.Error(), "不属于当前项目") {
		t.Fatalf("expected cross-project release to fail, got %v", err)
	}
}

func TestSettlementServiceRejectsInvalidReleaseMatrixWithoutArtifacts(t *testing.T) {
	db := setupProjectRiskServiceTestDB(t)
	user, _, project, milestone, _ := seedProjectRiskFixture(t, db)

	otherUser := model.User{Base: model.Base{ID: 993}, Phone: "13800138993", Status: 1}
	if err := db.Create(&otherUser).Error; err != nil {
		t.Fatalf("create other user: %v", err)
	}

	svc := &SettlementService{}
	if _, err := svc.ReleaseMilestone(&ReleaseMilestoneInput{
		ProjectID:    project.ID,
		MilestoneID:  milestone.ID,
		OperatorType: "user",
		OperatorID:   otherUser.ID,
		Reason:       "越权放款",
		Source:       "test.invalid_owner",
	}); err == nil || !strings.Contains(err.Error(), "无权") {
		t.Fatalf("expected foreign owner release failure, got %v", err)
	}

	if _, err := svc.ReleaseMilestone(&ReleaseMilestoneInput{
		ProjectID:    project.ID,
		MilestoneID:  milestone.ID,
		OperatorType: "user",
		OperatorID:   user.ID,
		Reason:       "未验收放款",
		Source:       "test.invalid_status",
	}); err == nil || !strings.Contains(err.Error(), "未通过验收") {
		t.Fatalf("expected unaccepted milestone release failure, got %v", err)
	}

	if err := db.Model(&milestone).Update("status", model.MilestoneStatusAccepted).Error; err != nil {
		t.Fatalf("set milestone accepted: %v", err)
	}
	if _, err := svc.ReleaseMilestone(&ReleaseMilestoneInput{
		ProjectID:    project.ID,
		MilestoneID:  milestone.ID,
		OperatorType: "user",
		OperatorID:   user.ID,
		Reason:       "首次放款",
		Source:       "test.first_release",
	}); err != nil {
		t.Fatalf("first release: %v", err)
	}
	if _, err := svc.ReleaseMilestone(&ReleaseMilestoneInput{
		ProjectID:    project.ID,
		MilestoneID:  milestone.ID,
		OperatorType: "user",
		OperatorID:   user.ID,
		Reason:       "重复放款",
		Source:       "test.duplicate_release",
	}); err == nil || !strings.Contains(err.Error(), "已存在待处理结算") {
		t.Fatalf("expected duplicate release failure, got %v", err)
	}

	var transactions int64
	if err := db.Model(&model.Transaction{}).Where("type = ?", "release").Count(&transactions).Error; err != nil {
		t.Fatalf("count release transactions: %v", err)
	}
	if transactions != 0 {
		t.Fatalf("expected no release transaction before manual payout confirmation, got %d", transactions)
	}

	var incomes int64
	if err := db.Model(&model.MerchantIncome{}).Where("type = ?", "construction").Count(&incomes).Error; err != nil {
		t.Fatalf("count merchant incomes: %v", err)
	}
	if incomes != 1 {
		t.Fatalf("expected exactly 1 construction income, got %d", incomes)
	}
}

func TestLocalCustodyGatewayCreatePayoutRequiresManualTransfer(t *testing.T) {
	payout := &model.PayoutOrder{
		OutPayoutNo: "PO-test",
		Status:      model.PayoutStatusProcessing,
	}
	result, err := NewCustodyGateway().CreatePayout(nil, payout)
	if err != nil {
		t.Fatalf("CreatePayout: %v", err)
	}
	if result == nil || result.Status != model.PayoutStatusProcessing {
		t.Fatalf("expected local custody payout to remain processing, got %+v", result)
	}
	if result.PaidAt != nil {
		t.Fatalf("manual transfer projection must not set paidAt before voucher confirmation")
	}
	if result.ProviderPayoutNo != "" {
		t.Fatalf("manual transfer projection must not synthesize provider payout number, got %q", result.ProviderPayoutNo)
	}
	queried, err := NewCustodyGateway().QueryPayout(nil, payout)
	if err != nil {
		t.Fatalf("QueryPayout: %v", err)
	}
	if queried == nil || queried.ProviderPayoutNo != "" {
		t.Fatalf("manual transfer query must not synthesize provider payout number, got %+v", queried)
	}
}

func TestEscrowServiceGetEscrowDetailForOwnerRejectsForeignUser(t *testing.T) {
	db := setupProjectRiskServiceTestDB(t)
	_, _, project, _, _ := seedProjectRiskFixture(t, db)

	otherUser := model.User{Base: model.Base{ID: 991}, Phone: "13800138991", Status: 1}
	if err := db.Create(&otherUser).Error; err != nil {
		t.Fatalf("create other user: %v", err)
	}

	_, err := (&EscrowService{}).GetEscrowDetailForOwner(project.ID, otherUser.ID)
	if err == nil || !strings.Contains(err.Error(), "无权") {
		t.Fatalf("expected owner scope check failure, got %v", err)
	}
}

func TestEscrowServiceDepositForOwnerRejectsForeignUserAndCrossProjectMilestone(t *testing.T) {
	db := setupProjectRiskServiceTestDB(t)
	user, provider, project, milestone, _ := seedProjectRiskFixture(t, db)

	otherUser := model.User{Base: model.Base{ID: 992}, Phone: "13800138992", Status: 1}
	if err := db.Create(&otherUser).Error; err != nil {
		t.Fatalf("create other user: %v", err)
	}

	otherProject := model.Project{
		Base:           model.Base{ID: 132},
		OwnerID:        user.ID,
		ProviderID:     provider.ID,
		Name:           "项目B",
		Address:        "其他地址",
		Status:         model.ProjectStatusActive,
		BusinessStatus: model.ProjectBusinessStatusInProgress,
	}
	otherMilestone := model.Milestone{
		Base:      model.Base{ID: 142},
		ProjectID: otherProject.ID,
		Name:      "木工验收",
		Seq:       2,
		Amount:    8000,
		Status:    model.MilestoneStatusPending,
	}
	otherEscrow := model.EscrowAccount{
		Base:            model.Base{ID: 162},
		ProjectID:       otherProject.ID,
		UserID:          user.ID,
		TotalAmount:     10000,
		AvailableAmount: 10000,
		Status:          escrowStatusActive,
	}
	for _, record := range []interface{}{&otherProject, &otherMilestone, &otherEscrow} {
		if err := db.Create(record).Error; err != nil {
			t.Fatalf("seed other project: %v", err)
		}
	}

	svc := &EscrowService{}
	if err := svc.DepositForOwner(project.ID, otherUser.ID, 1000, 0); err == nil || !strings.Contains(err.Error(), "无权") {
		t.Fatalf("expected foreign owner deposit failure, got %v", err)
	}
	if err := svc.DepositForOwner(project.ID, user.ID, 1000, otherMilestone.ID); err == nil || !strings.Contains(err.Error(), "不属于当前项目") {
		t.Fatalf("expected cross-project milestone failure, got %v", err)
	}

	if err := svc.DepositForOwner(project.ID, user.ID, 1200, milestone.ID); err != nil {
		t.Fatalf("DepositForOwner: %v", err)
	}

	var refreshedMilestone model.Milestone
	if err := db.First(&refreshedMilestone, milestone.ID).Error; err != nil {
		t.Fatalf("reload milestone: %v", err)
	}
	if refreshedMilestone.Status != model.MilestoneStatusInProgress {
		t.Fatalf("deposit should not mutate milestone status, got %+v", refreshedMilestone)
	}
}
