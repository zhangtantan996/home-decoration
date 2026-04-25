package service

import (
	"testing"
	"time"

	"home-decoration-server/internal/model"

	"github.com/stretchr/testify/assert"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupReconciliationTestDB(t *testing.T) *gorm.DB {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	assert.NoError(t, err)

	err = db.AutoMigrate(&model.ReconciliationRecord{}, &model.ReconciliationDifference{})
	assert.NoError(t, err)

	return db
}

func TestInvestigateDifference(t *testing.T) {
	db := setupReconciliationTestDB(t)
	service := NewReconciliationService(db)

	// 创建测试差异记录
	diff := &model.ReconciliationDifference{
		ReconciliationID: 1,
		DifferenceType:   "amount_mismatch",
		OutTradeNo:       "TEST_ORDER_001",
		PlatformAmount:   100.00,
		ChannelAmount:    99.99,
		HandleStatus:     model.DifferenceStatusPending,
		Resolved:         false,
	}
	err := db.Create(diff).Error
	assert.NoError(t, err)

	// 测试标记为调查中
	err = service.InvestigateDifference(&InvestigateDifferenceInput{
		DifferenceID: diff.ID,
		AdminID:      1,
		Notes:        "正在调查原因",
	})
	assert.NoError(t, err)

	// 验证状态更新
	var updated model.ReconciliationDifference
	err = db.First(&updated, diff.ID).Error
	assert.NoError(t, err)
	assert.Equal(t, model.DifferenceStatusInvestigating, updated.HandleStatus)
	assert.Equal(t, "正在调查原因", updated.ResolveNotes)
	assert.Equal(t, uint64(1), updated.ResolvedBy)
}

func TestIgnoreDifference(t *testing.T) {
	db := setupReconciliationTestDB(t)
	service := NewReconciliationService(db)

	// 创建测试差异记录
	diff := &model.ReconciliationDifference{
		ReconciliationID: 1,
		DifferenceType:   "amount_mismatch",
		OutTradeNo:       "TEST_ORDER_002",
		PlatformAmount:   100.00,
		ChannelAmount:    99.99,
		HandleStatus:     model.DifferenceStatusPending,
		Resolved:         false,
	}
	err := db.Create(diff).Error
	assert.NoError(t, err)

	// 测试忽略差异
	err = service.IgnoreDifference(&IgnoreDifferenceInput{
		DifferenceID: diff.ID,
		AdminID:      1,
		Reason:       "金额差异小于0.01元",
	})
	assert.NoError(t, err)

	// 验证状态更新
	var updated model.ReconciliationDifference
	err = db.First(&updated, diff.ID).Error
	assert.NoError(t, err)
	assert.Equal(t, model.DifferenceStatusIgnored, updated.HandleStatus)
	assert.Equal(t, "金额差异小于0.01元", updated.IgnoreReason)
}

func TestResolveDifferenceEnhanced(t *testing.T) {
	db := setupReconciliationTestDB(t)
	service := NewReconciliationService(db)

	// 创建测试差异记录
	diff := &model.ReconciliationDifference{
		ReconciliationID: 1,
		DifferenceType:   "status_mismatch",
		OutTradeNo:       "TEST_ORDER_003",
		PlatformAmount:   100.00,
		ChannelAmount:    100.00,
		HandleStatus:     model.DifferenceStatusPending,
		Resolved:         false,
	}
	err := db.Create(diff).Error
	assert.NoError(t, err)

	// 测试解决差异
	err = service.ResolveDifferenceEnhanced(&ResolveDifferenceEnhancedInput{
		DifferenceID: diff.ID,
		AdminID:      1,
		Solution:     "已手动调整订单状态",
		Notes:        "用户实际已支付",
	})
	assert.NoError(t, err)

	// 验证状态更新
	var updated model.ReconciliationDifference
	err = db.First(&updated, diff.ID).Error
	assert.NoError(t, err)
	assert.Equal(t, model.DifferenceStatusResolved, updated.HandleStatus)
	assert.True(t, updated.Resolved)
	assert.NotNil(t, updated.ResolvedAt)
	assert.Equal(t, "已手动调整订单状态", updated.Solution)
	assert.Equal(t, "用户实际已支付", updated.ResolveNotes)
}

func TestGetPendingDifferencesOverdue(t *testing.T) {
	db := setupReconciliationTestDB(t)
	service := NewReconciliationService(db)

	// 创建超时差异记录（25小时前）
	oldTime := time.Now().Add(-25 * time.Hour)
	overdueDiff := &model.ReconciliationDifference{
		ReconciliationID: 1,
		DifferenceType:   "amount_mismatch",
		OutTradeNo:       "TEST_ORDER_004",
		PlatformAmount:   100.00,
		ChannelAmount:    99.99,
		HandleStatus:     model.DifferenceStatusPending,
		Resolved:         false,
	}
	overdueDiff.CreatedAt = oldTime
	err := db.Create(overdueDiff).Error
	assert.NoError(t, err)

	// 创建正常差异记录（1小时前）
	recentDiff := &model.ReconciliationDifference{
		ReconciliationID: 1,
		DifferenceType:   "amount_mismatch",
		OutTradeNo:       "TEST_ORDER_005",
		PlatformAmount:   100.00,
		ChannelAmount:    99.99,
		HandleStatus:     model.DifferenceStatusPending,
		Resolved:         false,
	}
	err = db.Create(recentDiff).Error
	assert.NoError(t, err)

	// 查询超时差异
	diffs, err := service.GetPendingDifferencesOverdue(24)
	assert.NoError(t, err)
	assert.Len(t, diffs, 1)
	assert.Equal(t, "TEST_ORDER_004", diffs[0].OutTradeNo)
}

func TestCannotResolveAlreadyResolvedDifference(t *testing.T) {
	db := setupReconciliationTestDB(t)
	service := NewReconciliationService(db)

	// 创建已解决的差异记录
	now := time.Now()
	diff := &model.ReconciliationDifference{
		ReconciliationID: 1,
		DifferenceType:   "amount_mismatch",
		OutTradeNo:       "TEST_ORDER_006",
		PlatformAmount:   100.00,
		ChannelAmount:    99.99,
		HandleStatus:     model.DifferenceStatusResolved,
		Resolved:         true,
		ResolvedAt:       &now,
		ResolvedBy:       1,
	}
	err := db.Create(diff).Error
	assert.NoError(t, err)

	// 尝试再次解决
	err = service.ResolveDifferenceEnhanced(&ResolveDifferenceEnhancedInput{
		DifferenceID: diff.ID,
		AdminID:      2,
		Solution:     "尝试再次解决",
		Notes:        "应该失败",
	})
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "已经处理过了")
}
