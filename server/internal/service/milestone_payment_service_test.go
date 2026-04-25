package service

import (
	"strconv"
	"strings"
	"testing"
	"time"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"

	"github.com/stretchr/testify/assert"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupTestDB(t *testing.T) *gorm.DB {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	assert.NoError(t, err)

	err = db.AutoMigrate(
		&model.User{},
		&model.Project{},
		&model.Milestone{},
		&model.Order{},
		&model.PaymentPlan{},
		&model.EscrowAccount{},
		&model.Transaction{},
		&model.Provider{},
	)
	assert.NoError(t, err)

	repository.DB = db
	return db
}

func TestCreateMilestonePaymentPlan(t *testing.T) {
	db := setupTestDB(t)

	// 创建测试用户
	user := &model.User{
		Phone:    "13800138000",
		Nickname: "测试用户",
		UserType: 1,
		Status:   1,
	}
	err := db.Create(user).Error
	assert.NoError(t, err)

	// 创建测试项目
	project := &model.Project{
		OwnerID:           user.ID,
		Name:              "测试项目",
		ConstructionQuote: 100000,
		Status:            1,
	}
	err = db.Create(project).Error
	assert.NoError(t, err)

	// 测试创建节点付款计划
	service := &MilestonePaymentService{}
	input := &CreateMilestonePaymentPlanInput{
		ProjectID:         project.ID,
		ConstructionQuote: 100000,
	}

	milestones, err := service.CreateMilestonePaymentPlan(input)
	assert.NoError(t, err)
	assert.Equal(t, 4, len(milestones))

	// 验证节点金额
	assert.Equal(t, 30000.0, milestones[0].Amount)
	assert.Equal(t, 30000.0, milestones[1].Amount)
	assert.Equal(t, 30000.0, milestones[2].Amount)
	assert.Equal(t, 10000.0, milestones[3].Amount)

	// 验证节点百分比
	assert.Equal(t, float32(30), milestones[0].Percentage)
	assert.Equal(t, float32(30), milestones[1].Percentage)
	assert.Equal(t, float32(30), milestones[2].Percentage)
	assert.Equal(t, float32(10), milestones[3].Percentage)
}

func TestPayMilestoneRetiredDoesNotMutateFunds(t *testing.T) {
	db := setupTestDB(t)

	// 创建测试数据
	user := &model.User{
		Phone:    "13800138000",
		Nickname: "测试用户",
		UserType: 1,
		Status:   1,
	}
	db.Create(user)

	project := &model.Project{
		OwnerID:           user.ID,
		Name:              "测试项目",
		ConstructionQuote: 100000,
		Status:            1,
	}
	db.Create(project)

	milestone := &model.Milestone{
		ProjectID:  project.ID,
		Name:       "开工节点",
		Seq:        1,
		Amount:     30000,
		Percentage: 30,
		Status:     0,
	}
	db.Create(milestone)

	service := &MilestonePaymentService{}
	input := &PayMilestoneInput{
		ProjectID:   project.ID,
		MilestoneID: milestone.ID,
		UserID:      user.ID,
		PaymentType: "wechat",
	}

	transaction, err := service.PayMilestone(input)
	assert.Error(t, err)
	assert.Nil(t, transaction)
	if assert.Error(t, err) {
		assert.Contains(t, err.Error(), "订单中心")
	}

	var updatedMilestone model.Milestone
	db.First(&updatedMilestone, milestone.ID)
	assert.Equal(t, model.MilestoneStatusPending, updatedMilestone.Status)
	assert.Nil(t, updatedMilestone.PaidAt)

	var escrowCount int64
	assert.NoError(t, db.Model(&model.EscrowAccount{}).Where("project_id = ?", project.ID).Count(&escrowCount).Error)
	assert.Equal(t, int64(0), escrowCount)

	var txCount int64
	assert.NoError(t, db.Model(&model.Transaction{}).Where("milestone_id = ?", milestone.ID).Count(&txCount).Error)
	assert.Equal(t, int64(0), txCount)
}

func TestReleaseMilestonePaymentRequiresAcceptedAndAllowsUserPaidAt(t *testing.T) {
	db := setupProjectRiskServiceTestDB(t)
	user, _, project, milestone, _ := seedProjectRiskFixture(t, db)
	userPaidAt := time.Now().Add(-2 * time.Hour).Round(time.Second)

	if _, err := (&MilestonePaymentService{}).ReleaseMilestonePayment(project.ID, milestone.ID, user.ID); err == nil || !strings.Contains(err.Error(), "未通过验收") {
		t.Fatalf("expected unaccepted milestone release failure, got %v", err)
	}

	if err := db.Model(&milestone).Updates(map[string]any{
		"status":      model.MilestoneStatusAccepted,
		"accepted_at": time.Now().Add(-time.Hour),
		"paid_at":     &userPaidAt,
	}).Error; err != nil {
		t.Fatalf("mark milestone accepted and user-paid: %v", err)
	}

	result, err := (&MilestonePaymentService{}).ReleaseMilestonePayment(project.ID, milestone.ID, user.ID)
	if err != nil {
		t.Fatalf("ReleaseMilestonePayment: %v", err)
	}
	if result == nil || result.SettlementOrder == nil || result.MerchantIncome == nil {
		t.Fatalf("expected settlement projection, got %+v", result)
	}

	var refreshed model.Milestone
	if err := db.First(&refreshed, milestone.ID).Error; err != nil {
		t.Fatalf("reload milestone: %v", err)
	}
	if refreshed.Status != model.MilestoneStatusAccepted || refreshed.ReleasedAt != nil {
		t.Fatalf("expected accepted milestone waiting for manual payout, got %+v", refreshed)
	}
	if refreshed.PaidAt == nil || !refreshed.PaidAt.Equal(userPaidAt) {
		t.Fatalf("expected user payment paidAt to stay %v, got %+v", userPaidAt, refreshed.PaidAt)
	}

	payoutPaidAt := userPaidAt.Add(3 * time.Hour)
	if err := db.Transaction(func(tx *gorm.DB) error {
		var payout model.PayoutOrder
		if err := tx.First(&payout, result.SettlementOrder.PayoutOrderID).Error; err != nil {
			return err
		}
		if err := tx.Model(&payout).Updates(map[string]any{
			"status":  model.PayoutStatusPaid,
			"paid_at": &payoutPaidAt,
		}).Error; err != nil {
			return err
		}
		payout.Status = model.PayoutStatusPaid
		payout.PaidAt = &payoutPaidAt
		return (&PayoutService{ledger: &LedgerService{}}).applyPayoutProjectionTx(tx, &payout)
	}); err != nil {
		t.Fatalf("apply payout projection: %v", err)
	}

	if err := db.First(&refreshed, milestone.ID).Error; err != nil {
		t.Fatalf("reload paid milestone: %v", err)
	}
	if refreshed.Status != model.MilestoneStatusPaid {
		t.Fatalf("expected milestone settled after payout confirmation, got %+v", refreshed)
	}
	if refreshed.PaidAt == nil || !refreshed.PaidAt.Equal(userPaidAt) {
		t.Fatalf("expected payout confirmation to preserve user paidAt %v, got %+v", userPaidAt, refreshed.PaidAt)
	}
	if refreshed.ReleasedAt == nil || !refreshed.ReleasedAt.Equal(payoutPaidAt) {
		t.Fatalf("expected releasedAt to reflect payout time %v, got %+v", payoutPaidAt, refreshed.ReleasedAt)
	}
}

func TestGetMilestonePaymentStatus(t *testing.T) {
	db := setupTestDB(t)

	// 创建测试数据
	user := &model.User{
		Phone:    "13800138000",
		Nickname: "测试用户",
		UserType: 1,
		Status:   1,
	}
	db.Create(user)

	project := &model.Project{
		OwnerID:           user.ID,
		Name:              "测试项目",
		ConstructionQuote: 100000,
		Status:            1,
	}
	db.Create(project)

	now := time.Now()
	milestones := []model.Milestone{
		{ProjectID: project.ID, Name: "开工节点", Seq: 1, Amount: 30000, Percentage: 30, Status: 1, PaidAt: &now},
		{ProjectID: project.ID, Name: "水电节点", Seq: 2, Amount: 30000, Percentage: 30, Status: 0},
		{ProjectID: project.ID, Name: "中期节点", Seq: 3, Amount: 30000, Percentage: 30, Status: 0},
		{ProjectID: project.ID, Name: "验收节点", Seq: 4, Amount: 10000, Percentage: 10, Status: 0},
	}
	for _, m := range milestones {
		db.Create(&m)
	}
	order := &model.Order{
		ProjectID:   project.ID,
		OrderNo:     "CO202604250001",
		OrderType:   model.OrderTypeConstruction,
		TotalAmount: 100000,
		Status:      model.OrderStatusPending,
	}
	assert.NoError(t, db.Create(order).Error)
	var firstMilestone model.Milestone
	assert.NoError(t, db.Where("project_id = ? AND seq = ?", project.ID, 1).First(&firstMilestone).Error)
	assert.NoError(t, db.Create(&model.PaymentPlan{
		OrderID:     order.ID,
		MilestoneID: firstMilestone.ID,
		Type:        "down_payment",
		Seq:         1,
		Name:        firstMilestone.Name,
		Amount:      firstMilestone.Amount,
		Percentage:  firstMilestone.Percentage,
		Status:      model.PaymentPlanStatusPaid,
		PaidAt:      &now,
	}).Error)

	// 测试获取付款状态
	service := &MilestonePaymentService{}
	status, err := service.GetMilestonePaymentStatus(project.ID)
	assert.NoError(t, err)
	assert.NotNil(t, status)

	assert.Equal(t, 100000.0, status["totalAmount"])
	assert.Equal(t, 30000.0, status["paidAmount"])
	assert.Equal(t, 4, status["milestoneCount"])
	assert.Equal(t, 1, status["paidCount"])
	assert.Equal(t, order.ID, status["constructionOrderId"])
	assert.Equal(t, "construction_order:"+strconv.FormatUint(order.ID, 10), status["constructionOrderEntryKey"])
	assert.NotEmpty(t, status["paymentPlans"])
}
