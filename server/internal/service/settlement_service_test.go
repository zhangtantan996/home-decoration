package service

import (
	"strings"
	"testing"

	"home-decoration-server/internal/model"
)

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
