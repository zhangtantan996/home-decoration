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
