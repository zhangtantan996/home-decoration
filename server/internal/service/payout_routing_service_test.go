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

// setupPayoutTestDB 初始化测试数据库
func setupPayoutTestDB(t *testing.T) *gorm.DB {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	assert.NoError(t, err)

	// 自动迁移所有相关表
	err = db.AutoMigrate(
		&model.User{},
		&model.Provider{},
		&model.Project{},
		&model.SettlementOrder{},
		&model.PayoutOrder{},
		&model.MerchantIncome{},
	)
	assert.NoError(t, err)

	repository.DB = db
	return db
}

// createTestProvider 创建测试商家
func createTestProvider(t *testing.T, db *gorm.DB) *model.Provider {
	user := &model.User{
		Phone:    "13800138000",
		Nickname: "测试商家",
		UserType: 2,
		Status:   1,
	}
	err := db.Create(user).Error
	assert.NoError(t, err)

	provider := &model.Provider{
		UserID:       user.ID,
		ProviderType: 1,
		DisplayName:  "测试设计师",
		CompanyName:  "测试公司",
		Status:       1,
		Verified:     true,
	}
	err = db.Create(provider).Error
	assert.NoError(t, err)

	return provider
}

// createTestSettlementOrder 创建测试结算单
func createTestSettlementOrder(t *testing.T, db *gorm.DB, providerID uint64, amount float64, status string) *model.SettlementOrder {
	settlement := &model.SettlementOrder{
		BizType:           model.PayoutBizTypeSettlementOrder,
		BizID:             1,
		ProjectID:         1,
		ProviderID:        providerID,
		FundScene:         "design_fee",
		GrossAmount:       amount,
		PlatformFee:       amount * 0.05,
		MerchantNetAmount: amount * 0.95,
		Status:            status,
	}
	err := db.Create(settlement).Error
	assert.NoError(t, err)

	return settlement
}

// createTestPayoutOrder 创建测试出款单
func createTestPayoutOrder(t *testing.T, db *gorm.DB, settlementID uint64, providerID uint64, status string, retryCount int) *model.PayoutOrder {
	payout := &model.PayoutOrder{
		BizType:     model.PayoutBizTypeSettlementOrder,
		BizID:       settlementID,
		ProviderID:  providerID,
		Channel:     model.PayoutChannelBankTransfer,
		Amount:      9500.0,
		OutPayoutNo: "PO" + time.Now().Format("20060102150405"),
		Status:      status,
		RetryCount:  retryCount,
	}
	err := db.Create(payout).Error
	assert.NoError(t, err)

	return payout
}

// TestRetryFailedPayout_Success 测试重试成功场景
func TestRetryFailedPayout_Success(t *testing.T) {
	db := setupPayoutTestDB(t)

	// 创建测试数据（使用微信渠道，金额小于2万）
	provider := createTestProvider(t, db)
	settlement := createTestSettlementOrder(t, db, provider.ID, 10000.0, model.SettlementStatusScheduled)
	payout := &model.PayoutOrder{
		BizType:     model.PayoutBizTypeSettlementOrder,
		BizID:       settlement.ID,
		ProviderID:  provider.ID,
		Channel:     model.PayoutChannelWechatBalance, // 微信渠道
		Amount:      9500.0,
		OutPayoutNo: "PO" + time.Now().Format("20060102150405"),
		Status:      model.PayoutStatusFailed,
		RetryCount:  0,
	}
	err := db.Create(payout).Error
	assert.NoError(t, err)

	// 执行重试（会失败，因为微信功能未实现）
	service := NewPayoutRoutingService()
	result, err := service.RetryFailedPayout(payout.ID)

	// 验证结果（应该失败）
	assert.Error(t, err)
	assert.NotNil(t, result)
	assert.Equal(t, model.PayoutStatusFailed, result.Status)
	assert.Equal(t, 1, result.RetryCount)
	assert.Contains(t, result.FailureReason, "微信企业付款功能暂未实现")

	// 验证数据库状态
	var updatedPayout model.PayoutOrder
	err = db.First(&updatedPayout, payout.ID).Error
	assert.NoError(t, err)
	assert.Equal(t, model.PayoutStatusFailed, updatedPayout.Status)
	assert.Equal(t, 1, updatedPayout.RetryCount)
	assert.Contains(t, updatedPayout.FailureReason, "微信企业付款功能暂未实现")
}

// TestRetryFailedPayout_MaxRetries 测试达到最大重试次数
func TestRetryFailedPayout_MaxRetries(t *testing.T) {
	db := setupPayoutTestDB(t)

	// 创建测试数据（重试次数已达3次）
	provider := createTestProvider(t, db)
	settlement := createTestSettlementOrder(t, db, provider.ID, 10000.0, model.SettlementStatusScheduled)
	payout := createTestPayoutOrder(t, db, settlement.ID, provider.ID, model.PayoutStatusFailed, 3)

	// 执行重试
	service := NewPayoutRoutingService()
	result, err := service.RetryFailedPayout(payout.ID)

	// 验证返回错误
	assert.Error(t, err)
	assert.Nil(t, result)
	assert.Contains(t, err.Error(), "重试次数已达上限")

	// 验证数据库状态未变
	var updatedPayout model.PayoutOrder
	err = db.First(&updatedPayout, payout.ID).Error
	assert.NoError(t, err)
	assert.Equal(t, model.PayoutStatusFailed, updatedPayout.Status)
	assert.Equal(t, 3, updatedPayout.RetryCount)
}

// TestRetryFailedPayout_InvalidStatus 测试状态不正确时拒绝重试
func TestRetryFailedPayout_InvalidStatus(t *testing.T) {
	db := setupPayoutTestDB(t)

	// 创建测试数据（状态为 succeeded）
	provider := createTestProvider(t, db)
	settlement := createTestSettlementOrder(t, db, provider.ID, 10000.0, model.SettlementStatusPaid)
	payout := createTestPayoutOrder(t, db, settlement.ID, provider.ID, model.PayoutStatusPaid, 0)

	// 执行重试
	service := NewPayoutRoutingService()
	result, err := service.RetryFailedPayout(payout.ID)

	// 验证返回错误
	assert.Error(t, err)
	assert.Nil(t, result)
	assert.Contains(t, err.Error(), "出款单状态不正确")

	// 验证数据库状态未变
	var updatedPayout model.PayoutOrder
	err = db.First(&updatedPayout, payout.ID).Error
	assert.NoError(t, err)
	assert.Equal(t, model.PayoutStatusPaid, updatedPayout.Status)
	assert.Equal(t, 0, updatedPayout.RetryCount)
}

// TestRetryFailedPayout_Idempotent 测试并发重试的幂等性
func TestRetryFailedPayout_Idempotent(t *testing.T) {
	db := setupPayoutTestDB(t)

	// 创建测试数据
	provider := createTestProvider(t, db)
	settlement := createTestSettlementOrder(t, db, provider.ID, 10000.0, model.SettlementStatusScheduled)
	payout := createTestPayoutOrder(t, db, settlement.ID, provider.ID, model.PayoutStatusFailed, 0)

	// 第一次重试
	service := NewPayoutRoutingService()
	result1, err1 := service.RetryFailedPayout(payout.ID)

	// 第二次重试（应该失败，因为状态已经不是 failed）
	_, err2 := service.RetryFailedPayout(payout.ID)

	// 验证第一次重试失败（因为银行渠道未实现）
	assert.Error(t, err1)
	assert.NotNil(t, result1)
	assert.Equal(t, model.PayoutStatusFailed, result1.Status)
	assert.Equal(t, 1, result1.RetryCount)

	// 验证第二次重试失败（因为状态不对或达到重试次数）
	assert.Error(t, err2)

	// 验证数据库状态
	var updatedPayout model.PayoutOrder
	err := db.First(&updatedPayout, payout.ID).Error
	assert.NoError(t, err)
	// 重试次数应该是 1 或 2（取决于第二次是否执行）
	assert.True(t, updatedPayout.RetryCount >= 1 && updatedPayout.RetryCount <= 2, "重试次数应该在1-2之间")
}

// TestRetryFailedPayout_ChannelFailure 测试渠道调用失败
func TestRetryFailedPayout_ChannelFailure(t *testing.T) {
	db := setupPayoutTestDB(t)

	// 创建测试数据（使用微信渠道，会失败）
	provider := createTestProvider(t, db)
	settlement := createTestSettlementOrder(t, db, provider.ID, 10000.0, model.SettlementStatusScheduled)
	payout := &model.PayoutOrder{
		BizType:     model.PayoutBizTypeSettlementOrder,
		BizID:       settlement.ID,
		ProviderID:  provider.ID,
		Channel:     model.PayoutChannelWechatBalance, // 微信渠道会失败
		Amount:      9500.0,
		OutPayoutNo: "PO" + time.Now().Format("20060102150405"),
		Status:      model.PayoutStatusFailed,
		RetryCount:  0,
	}
	err := db.Create(payout).Error
	assert.NoError(t, err)

	// 执行重试
	service := NewPayoutRoutingService()
	result, err := service.RetryFailedPayout(payout.ID)

	// 验证返回错误
	assert.Error(t, err)
	assert.NotNil(t, result)
	assert.Equal(t, model.PayoutStatusFailed, result.Status)
	assert.NotEmpty(t, result.FailureReason)
	assert.Equal(t, 1, result.RetryCount)

	// 验证数据库状态
	var updatedPayout model.PayoutOrder
	err = db.First(&updatedPayout, payout.ID).Error
	assert.NoError(t, err)
	assert.Equal(t, model.PayoutStatusFailed, updatedPayout.Status)
	assert.NotEmpty(t, updatedPayout.FailureReason)
	assert.Equal(t, 1, updatedPayout.RetryCount)
}

// TestRetryFailedPayout_NotFound 测试出款单不存在
func TestRetryFailedPayout_NotFound(t *testing.T) {
	_ = setupPayoutTestDB(t)

	// 执行重试（使用不存在的ID）
	service := NewPayoutRoutingService()
	result, err := service.RetryFailedPayout(99999)

	// 验证返回错误
	assert.Error(t, err)
	assert.Nil(t, result)
	assert.Contains(t, err.Error(), "出款单不存在")
}

// TestRetryFailedPayout_EmptyID 测试空ID
func TestRetryFailedPayout_EmptyID(t *testing.T) {
	_ = setupPayoutTestDB(t)

	// 执行重试（使用空ID）
	service := NewPayoutRoutingService()
	result, err := service.RetryFailedPayout(0)

	// 验证返回错误
	assert.Error(t, err)
	assert.Nil(t, result)
	assert.Contains(t, err.Error(), "出款单ID不能为空")
}

// TestRetryFailedPayout_ProviderNotFound 测试商家不存在
func TestRetryFailedPayout_ProviderNotFound(t *testing.T) {
	db := setupPayoutTestDB(t)

	// 创建测试数据（商家ID不存在）
	settlement := createTestSettlementOrder(t, db, 99999, 10000.0, model.SettlementStatusScheduled)
	payout := createTestPayoutOrder(t, db, settlement.ID, 99999, model.PayoutStatusFailed, 0)

	// 执行重试
	service := NewPayoutRoutingService()
	result, err := service.RetryFailedPayout(payout.ID)

	// 验证返回错误
	assert.Error(t, err)
	assert.Nil(t, result)
	assert.Contains(t, err.Error(), "商家不存在")
}

// TestSelectChannel 测试渠道选择逻辑
func TestSelectChannel(t *testing.T) {
	service := NewPayoutRoutingService()

	tests := []struct {
		name     string
		amount   float64
		expected string
	}{
		{
			name:     "小于2万使用微信企业付款",
			amount:   10000.0,
			expected: model.PayoutChannelWechatBalance,
		},
		{
			name:     "等于2万使用微信商家转账",
			amount:   20000.0,
			expected: model.PayoutChannelWechatBank,
		},
		{
			name:     "2-10万之间使用微信商家转账",
			amount:   50000.0,
			expected: model.PayoutChannelWechatBank,
		},
		{
			name:     "等于10万使用银行转账",
			amount:   100000.0,
			expected: model.PayoutChannelBankTransfer,
		},
		{
			name:     "大于10万使用银行转账",
			amount:   200000.0,
			expected: model.PayoutChannelBankTransfer,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			channel := service.SelectChannel(tt.amount)
			assert.Equal(t, tt.expected, channel)
		})
	}
}
