package service

import (
	"errors"
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	"log"
	"time"
)

// MerchantIncomeService 商家收入服务
type MerchantIncomeService struct{}

// CreateIncomeInput 创建收入记录入参
type CreateIncomeInput struct {
	ProviderID  uint64  // 商家ID
	OrderID     uint64  // 订单ID
	BookingID   uint64  // 预约ID（用于追踪意向金）
	Type        string  // 收入类型：design_fee, construction, material
	Amount      float64 // 订单总金额
	Description string  // 描述
}

// CreateIncome 创建商家收入记录（订单支付成功时调用）
func (s *MerchantIncomeService) CreateIncome(input *CreateIncomeInput) (*model.MerchantIncome, error) {
	// 1. 根据类型获取对应的抽成比例
	configSvc := &ConfigService{}
	feeRate := 0.0
	var err error

	switch input.Type {
	case "design_fee":
		feeRate, err = configSvc.GetConfigFloat(model.ConfigKeyDesignFeeRate)
		if err != nil {
			log.Printf("[MerchantIncomeService] Failed to get design fee rate, using default 0.10: %v", err)
			feeRate = 0.10 // 默认10%
		}
	case "construction":
		feeRate, err = configSvc.GetConfigFloat(model.ConfigKeyConstructionFeeRate)
		if err != nil {
			log.Printf("[MerchantIncomeService] Failed to get construction fee rate, using default 0.10: %v", err)
			feeRate = 0.10
		}
	case "material":
		feeRate, err = configSvc.GetConfigFloat(model.ConfigKeyMaterialFeeRate)
		if err != nil {
			log.Printf("[MerchantIncomeService] Failed to get material fee rate, using default 0.05: %v", err)
			feeRate = 0.05
		}
	case "intent_fee":
		feeRate, err = configSvc.GetConfigFloat(model.ConfigKeyIntentFeeRate)
		if err != nil {
			log.Printf("[MerchantIncomeService] Failed to get intent fee rate, using default 0: %v", err)
			feeRate = 0 // 意向金默认不抽成
		}
	default:
		return nil, errors.New("无效的收入类型")
	}

	// 2. 计算平台抽成和商家净收入
	platformFee := input.Amount * feeRate
	netAmount := input.Amount - platformFee

	// 确保不会出现负数
	if netAmount < 0 {
		netAmount = 0
		platformFee = input.Amount
	}

	// 3. 创建收入记录
	income := &model.MerchantIncome{
		ProviderID:  input.ProviderID,
		OrderID:     input.OrderID,
		BookingID:   input.BookingID,
		Type:        input.Type,
		Amount:      input.Amount,
		PlatformFee: platformFee,
		NetAmount:   netAmount,
		Status:      0, // 待结算
	}

	if err := repository.DB.Create(income).Error; err != nil {
		log.Printf("[MerchantIncomeService] Failed to create income: %v", err)
		return nil, errors.New("创建收入记录失败")
	}

	log.Printf("[MerchantIncomeService] Created income %d for provider %d: %.2f元 (平台抽成 %.2f%%, 净收入 %.2f元)",
		income.ID, input.ProviderID, input.Amount, feeRate*100, netAmount)

	return income, nil
}

// SettleIncome 结算收入（订单完成后N天自动结算，或手动结算）
func (s *MerchantIncomeService) SettleIncome(incomeID uint64) error {
	var income model.MerchantIncome
	if err := repository.DB.First(&income, incomeID).Error; err != nil {
		return errors.New("收入记录不存在")
	}

	if income.Status != 0 {
		return errors.New("收入已结算，不可重复操作")
	}

	now := time.Now()
	income.Status = 1 // 已结算
	income.SettledAt = &now

	if err := repository.DB.Save(&income).Error; err != nil {
		return errors.New("结算失败")
	}

	log.Printf("[MerchantIncomeService] Settled income %d: %.2f元", incomeID, income.NetAmount)
	return nil
}

// BatchSettleExpiredIncomes 批量结算到期的收入（定时任务调用）
func (s *MerchantIncomeService) BatchSettleExpiredIncomes() (int, error) {
	// 获取自动结算天数配置
	configSvc := &ConfigService{}
	autoDays, err := configSvc.GetConfigInt(model.ConfigKeySettlementAutoDays)
	if err != nil {
		log.Printf("[MerchantIncomeService] Failed to get auto settlement days, using default 7: %v", err)
		autoDays = 7
	}

	// 查询：status=0（待结算）且创建时间 >= N天前
	deadline := time.Now().Add(-time.Duration(autoDays) * 24 * time.Hour)
	var incomes []model.MerchantIncome

	if err := repository.DB.Where("status = ? AND created_at <= ?", 0, deadline).Find(&incomes).Error; err != nil {
		return 0, err
	}

	if len(incomes) == 0 {
		return 0, nil
	}

	successCount := 0
	for _, income := range incomes {
		if err := s.SettleIncome(income.ID); err != nil {
			log.Printf("[MerchantIncomeService] Failed to settle income %d: %v", income.ID, err)
			continue
		}
		successCount++
	}

	log.Printf("[MerchantIncomeService] Batch settled %d/%d incomes", successCount, len(incomes))
	return successCount, nil
}

// GetProviderAvailableBalance 获取商家可提现余额
func (s *MerchantIncomeService) GetProviderAvailableBalance(providerID uint64) (float64, error) {
	var totalAvailable float64

	// 查询已结算且未提现的收入
	err := repository.DB.Model(&model.MerchantIncome{}).
		Where("provider_id = ? AND status = 1", providerID).
		Select("COALESCE(SUM(net_amount), 0)").
		Scan(&totalAvailable).Error

	if err != nil {
		return 0, err
	}

	return totalAvailable, nil
}

// GetProviderIncomeStats 获取商家收入统计
func (s *MerchantIncomeService) GetProviderIncomeStats(providerID uint64) (map[string]interface{}, error) {
	var stats struct {
		TotalAmount      float64 // 总收入（含平台抽成）
		TotalPlatformFee float64 // 总平台抽成
		TotalNetAmount   float64 // 总净收入
		SettledAmount    float64 // 已结算金额
		WithdrawnAmount  float64 // 已提现金额
		AvailableAmount  float64 // 可提现金额
	}

	// 总收入统计
	repository.DB.Model(&model.MerchantIncome{}).
		Where("provider_id = ?", providerID).
		Select("COALESCE(SUM(amount), 0) as total_amount, COALESCE(SUM(platform_fee), 0) as total_platform_fee, COALESCE(SUM(net_amount), 0) as total_net_amount").
		Scan(&stats)

	// 已结算金额
	repository.DB.Model(&model.MerchantIncome{}).
		Where("provider_id = ? AND status = 1", providerID).
		Select("COALESCE(SUM(net_amount), 0)").
		Scan(&stats.SettledAmount)

	// 已提现金额
	repository.DB.Model(&model.MerchantIncome{}).
		Where("provider_id = ? AND status = 2", providerID).
		Select("COALESCE(SUM(net_amount), 0)").
		Scan(&stats.WithdrawnAmount)

	// 可提现金额 = 已结算 - 已提现
	stats.AvailableAmount = stats.SettledAmount - stats.WithdrawnAmount

	return map[string]interface{}{
		"totalAmount":      stats.TotalAmount,
		"totalPlatformFee": stats.TotalPlatformFee,
		"totalNetAmount":   stats.TotalNetAmount,
		"settledAmount":    stats.SettledAmount,
		"withdrawnAmount":  stats.WithdrawnAmount,
		"availableAmount":  stats.AvailableAmount,
	}, nil
}
