package service

import (
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

func TestPayMilestone(t *testing.T) {
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

	// 测试支付节点
	service := &MilestonePaymentService{}
	input := &PayMilestoneInput{
		ProjectID:   project.ID,
		MilestoneID: milestone.ID,
		UserID:      user.ID,
		PaymentType: "wechat",
	}

	transaction, err := service.PayMilestone(input)
	assert.NoError(t, err)
	assert.NotNil(t, transaction)
	assert.Equal(t, 30000.0, transaction.Amount)
	assert.Equal(t, "deposit", transaction.Type)

	// 验证节点状态更新
	var updatedMilestone model.Milestone
	db.First(&updatedMilestone, milestone.ID)
	assert.Equal(t, int8(1), updatedMilestone.Status)
	assert.NotNil(t, updatedMilestone.PaidAt)

	// 验证托管账户创建
	var escrow model.EscrowAccount
	err = db.Where("project_id = ?", project.ID).First(&escrow).Error
	assert.NoError(t, err)
	assert.Equal(t, 30000.0, escrow.TotalAmount)
	assert.Equal(t, 30000.0, escrow.AvailableAmount)
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

	// 测试获取付款状态
	service := &MilestonePaymentService{}
	status, err := service.GetMilestonePaymentStatus(project.ID)
	assert.NoError(t, err)
	assert.NotNil(t, status)

	assert.Equal(t, 100000.0, status["totalAmount"])
	assert.Equal(t, 30000.0, status["paidAmount"])
	assert.Equal(t, 4, status["milestoneCount"])
	assert.Equal(t, 1, status["paidCount"])
}
