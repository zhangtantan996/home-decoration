package service

import (
	"context"
	"errors"
	"fmt"
	"log"
	"time"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// PayoutRoutingService 智能出款路由服务
type PayoutRoutingService struct {
	wechatGateway *WechatPayGateway
	bankGateway   *MockBankTransferGateway
}

// PayeeInfo 收款人信息
type PayeeInfo struct {
	OpenID         string `json:"openid,omitempty"`         // 微信openid（企业付款用）
	Name           string `json:"name"`                     // 收款人姓名
	BankCardNumber string `json:"bankCardNumber,omitempty"` // 银行卡号
	BankName       string `json:"bankName,omitempty"`       // 银行名称
	BankBranch     string `json:"bankBranch,omitempty"`     // 支行名称
}

// NewPayoutRoutingService 创建智能出款路由服务实例
func NewPayoutRoutingService() *PayoutRoutingService {
	return &PayoutRoutingService{
		wechatGateway: &WechatPayGateway{},
		bankGateway:   NewMockBankTransferGateway(),
	}
}

// SelectChannel 智能选择出款渠道
// 规则：<2万用微信企业付款，2-10万用微信商家转账，≥10万用银行转账
func (s *PayoutRoutingService) SelectChannel(amount float64) string {
	if amount < 20000 {
		return model.PayoutChannelWechatBalance // <2万：微信企业付款
	} else if amount < 100000 {
		return model.PayoutChannelWechatBank // 2-10万：微信商家转账
	} else {
		return model.PayoutChannelBankTransfer // ≥10万：银行转账
	}
}

// ExecutePayout 执行出款
func (s *PayoutRoutingService) ExecutePayout(settlementOrderID uint64) (*model.PayoutOrder, error) {
	var result *model.PayoutOrder
	err := repository.DB.Transaction(func(tx *gorm.DB) error {
		payout, err := s.ExecutePayoutTx(tx, settlementOrderID)
		if err != nil {
			return err
		}
		result = payout
		return nil
	})
	return result, err
}

// ExecutePayoutTx 执行出款（事务内）
func (s *PayoutRoutingService) ExecutePayoutTx(tx *gorm.DB, settlementOrderID uint64) (*model.PayoutOrder, error) {
	if settlementOrderID == 0 {
		return nil, errors.New("结算单ID不能为空")
	}

	// 1. 查询结算单
	var settlement model.SettlementOrder
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&settlement, settlementOrderID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("结算单不存在")
		}
		return nil, err
	}

	// 2. 检查结算单状态（必须是 scheduled）
	if settlement.Status != model.SettlementStatusScheduled {
		return nil, fmt.Errorf("结算单状态不正确，当前状态: %s", settlement.Status)
	}

	// 3. 查询商家信息（获取收款账户）
	var provider model.Provider
	if err := tx.First(&provider, settlement.ProviderID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("商家不存在")
		}
		return nil, err
	}

	// 4. 根据金额选择出款渠道
	channel := s.SelectChannel(settlement.MerchantNetAmount)
	log.Printf("[PayoutRouting] 结算单 #%d 金额 %.2f 元，选择渠道: %s", settlementOrderID, settlement.MerchantNetAmount, channel)

	// 5. 生成出款单（status: created）
	outTradeNo, err := generateOutPayoutNo(settlement.FundScene)
	if err != nil {
		return nil, err
	}

	payout := &model.PayoutOrder{
		BizType:     model.PayoutBizTypeSettlementOrder,
		BizID:       settlementOrderID,
		ProviderID:  settlement.ProviderID,
		Channel:     channel,
		Amount:      settlement.MerchantNetAmount,
		OutPayoutNo: outTradeNo,
		Status:      model.PayoutStatusCreated,
	}

	if err := tx.Create(payout).Error; err != nil {
		return nil, err
	}

	// 6. 调用对应渠道的出款API
	payeeInfo := &PayeeInfo{
		Name: provider.CompanyName,
	}

	ctx := context.Background()
	var execErr error

	switch channel {
	case model.PayoutChannelWechatBalance:
		execErr = s.executeWechatBalanceTransfer(ctx, payout, payeeInfo)
	case model.PayoutChannelWechatBank:
		execErr = s.executeWechatBankTransfer(ctx, payout, payeeInfo)
	case model.PayoutChannelBankTransfer:
		execErr = s.executeBankTransfer(ctx, payout, payeeInfo)
	default:
		execErr = fmt.Errorf("不支持的出款渠道: %s", channel)
	}

	// 7. 更新出款单状态（status: processing）
	if execErr != nil {
		// 出款失败，更新状态为 failed
		if err := tx.Model(payout).Updates(map[string]any{
			"status":         model.PayoutStatusFailed,
			"failure_reason": execErr.Error(),
		}).Error; err != nil {
			return nil, err
		}
		payout.Status = model.PayoutStatusFailed
		payout.FailureReason = execErr.Error()
		return payout, execErr
	}

	// 出款成功，更新状态为 processing
	if err := tx.Model(payout).Updates(map[string]any{
		"status": model.PayoutStatusProcessing,
	}).Error; err != nil {
		return nil, err
	}
	payout.Status = model.PayoutStatusProcessing

	log.Printf("[PayoutRouting] 出款单 #%d 已提交，渠道: %s, 金额: %.2f 元", payout.ID, channel, payout.Amount)

	// 8. 返回出款单
	return payout, nil
}

// QueryPayoutStatus 查询出款状态
func (s *PayoutRoutingService) QueryPayoutStatus(payoutOrderID uint64) (*model.PayoutOrder, error) {
	var result *model.PayoutOrder
	err := repository.DB.Transaction(func(tx *gorm.DB) error {
		payout, err := s.QueryPayoutStatusTx(tx, payoutOrderID)
		if err != nil {
			return err
		}
		result = payout
		return nil
	})
	return result, err
}

// QueryPayoutStatusTx 查询出款状态（事务内）
func (s *PayoutRoutingService) QueryPayoutStatusTx(tx *gorm.DB, payoutOrderID uint64) (*model.PayoutOrder, error) {
	if payoutOrderID == 0 {
		return nil, errors.New("出款单ID不能为空")
	}

	// 1. 查询出款单
	var payout model.PayoutOrder
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&payout, payoutOrderID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("出款单不存在")
		}
		return nil, err
	}

	// 如果已经是成功或失败状态，直接返回
	if payout.Status == model.PayoutStatusPaid || payout.Status == model.PayoutStatusFailed {
		return &payout, nil
	}

	// 2. 根据渠道调用对应的查询API
	ctx := context.Background()
	var queryErr error
	var succeeded bool
	var failureReason string

	switch payout.Channel {
	case model.PayoutChannelWechatBalance:
		succeeded, failureReason, queryErr = s.queryWechatBalanceTransfer(ctx, &payout)
	case model.PayoutChannelWechatBank:
		succeeded, failureReason, queryErr = s.queryWechatBankTransfer(ctx, &payout)
	case model.PayoutChannelBankTransfer:
		succeeded, failureReason, queryErr = s.queryBankTransfer(ctx, &payout)
	default:
		return nil, fmt.Errorf("不支持的出款渠道: %s", payout.Channel)
	}

	if queryErr != nil {
		log.Printf("[PayoutRouting] 查询出款单 #%d 失败: %v", payoutOrderID, queryErr)
		return &payout, queryErr
	}

	// 3. 更新出款单状态
	if succeeded {
		now := time.Now()
		if err := tx.Model(&payout).Updates(map[string]any{
			"status":  model.PayoutStatusPaid,
			"paid_at": &now,
		}).Error; err != nil {
			return nil, err
		}
		payout.Status = model.PayoutStatusPaid
		payout.PaidAt = &now

		// 4. 如果成功，更新结算单和商家收入
		if err := s.updateSettlementAndIncome(tx, &payout); err != nil {
			return nil, err
		}

		log.Printf("[PayoutRouting] 出款单 #%d 已成功", payoutOrderID)
	} else if failureReason != "" {
		if err := tx.Model(&payout).Updates(map[string]any{
			"status":         model.PayoutStatusFailed,
			"failure_reason": failureReason,
		}).Error; err != nil {
			return nil, err
		}
		payout.Status = model.PayoutStatusFailed
		payout.FailureReason = failureReason

		log.Printf("[PayoutRouting] 出款单 #%d 失败: %s", payoutOrderID, failureReason)
	}

	// 5. 返回出款单
	return &payout, nil
}

// RetryFailedPayout 重试失败出款
func (s *PayoutRoutingService) RetryFailedPayout(payoutOrderID uint64) (*model.PayoutOrder, error) {
	var result *model.PayoutOrder
	var retryErr error
	err := repository.DB.Transaction(func(tx *gorm.DB) error {
		payout, err := s.RetryFailedPayoutTx(tx, payoutOrderID)
		result = payout
		retryErr = err
		// 如果是渠道调用失败，仍然提交事务（因为已经更新了重试次数和失败原因）
		if err != nil && payout != nil {
			return nil
		}
		return err
	})
	if err != nil {
		return result, err
	}
	return result, retryErr
}

// RetryFailedPayoutTx 重试失败出款（事务内）
func (s *PayoutRoutingService) RetryFailedPayoutTx(tx *gorm.DB, payoutOrderID uint64) (*model.PayoutOrder, error) {
	if payoutOrderID == 0 {
		return nil, errors.New("出款单ID不能为空")
	}

	// 1. 查询出款单
	var payout model.PayoutOrder
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&payout, payoutOrderID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("出款单不存在")
		}
		return nil, err
	}

	// 2. 检查状态（必须是 failed）
	if payout.Status != model.PayoutStatusFailed {
		return nil, fmt.Errorf("出款单状态不正确，当前状态: %s", payout.Status)
	}

	// 3. 检查重试次数（最多3次）
	if payout.RetryCount >= 3 {
		return nil, errors.New("重试次数已达上限（3次）")
	}

	// 4. 重新调用出款API
	var provider model.Provider
	if err := tx.First(&provider, payout.ProviderID).Error; err != nil {
		return nil, errors.New("商家不存在")
	}

	payeeInfo := &PayeeInfo{
		Name: provider.CompanyName,
	}

	ctx := context.Background()
	var execErr error

	switch payout.Channel {
	case model.PayoutChannelWechatBalance:
		execErr = s.executeWechatBalanceTransfer(ctx, &payout, payeeInfo)
	case model.PayoutChannelWechatBank:
		execErr = s.executeWechatBankTransfer(ctx, &payout, payeeInfo)
	case model.PayoutChannelBankTransfer:
		execErr = s.executeBankTransfer(ctx, &payout, payeeInfo)
	default:
		execErr = fmt.Errorf("不支持的出款渠道: %s", payout.Channel)
	}

	// 5. 更新出款单状态和重试次数
	if execErr != nil {
		// 重试失败
		newRetryCount := payout.RetryCount + 1
		if err := tx.Model(&payout).Updates(map[string]any{
			"status":         model.PayoutStatusFailed,
			"failure_reason": execErr.Error(),
			"retry_count":    newRetryCount,
		}).Error; err != nil {
			return nil, err
		}
		payout.Status = model.PayoutStatusFailed
		payout.FailureReason = execErr.Error()
		payout.RetryCount = newRetryCount

		log.Printf("[PayoutRouting] 出款单 #%d 重试失败（第%d次）: %v", payoutOrderID, payout.RetryCount, execErr)
		return &payout, execErr
	}

	// 重试成功，更新状态为 processing
	newRetryCount := payout.RetryCount + 1
	if err := tx.Model(&payout).Updates(map[string]any{
		"status":      model.PayoutStatusProcessing,
		"retry_count": newRetryCount,
	}).Error; err != nil {
		return nil, err
	}
	payout.Status = model.PayoutStatusProcessing
	payout.RetryCount = newRetryCount

	log.Printf("[PayoutRouting] 出款单 #%d 重试成功（第%d次）", payoutOrderID, payout.RetryCount)

	// 6. 返回出款单
	return &payout, nil
}

// executeWechatBalanceTransfer 微信企业付款
func (s *PayoutRoutingService) executeWechatBalanceTransfer(ctx context.Context, payout *model.PayoutOrder, payeeInfo *PayeeInfo) error {
	log.Printf("[PayoutRouting] 微信企业付款功能暂未实现，出款单 #%d", payout.ID)
	return errors.New("微信企业付款功能暂未实现")
}

// executeWechatBankTransfer 微信商家转账
func (s *PayoutRoutingService) executeWechatBankTransfer(ctx context.Context, payout *model.PayoutOrder, payeeInfo *PayeeInfo) error {
	log.Printf("[PayoutRouting] 微信商家转账功能暂未实现，出款单 #%d", payout.ID)
	return errors.New("微信商家转账功能暂未实现")
}

// executeBankTransfer 银行转账
func (s *PayoutRoutingService) executeBankTransfer(ctx context.Context, payout *model.PayoutOrder, payeeInfo *PayeeInfo) error {
	input := &BankTransferInput{
		OutTradeNo:   payout.OutPayoutNo,
		Amount:       payout.Amount,
		PayeeName:    payeeInfo.Name,
		PayeeAccount: payeeInfo.BankCardNumber,
		PayeeBank:    payeeInfo.BankName,
		PayeeBranch:  payeeInfo.BankBranch,
		Remark:       fmt.Sprintf("结算单 #%d 出款", payout.BizID),
	}

	result, err := s.bankGateway.Transfer(ctx, input)
	if err != nil {
		return err
	}

	log.Printf("[PayoutRouting] 银行转账已提交，出款单 #%d, 银行订单号: %s", payout.ID, result.BankTradeNo)
	return nil
}

// queryWechatBalanceTransfer 查询微信企业付款状态
func (s *PayoutRoutingService) queryWechatBalanceTransfer(ctx context.Context, payout *model.PayoutOrder) (bool, string, error) {
	log.Printf("[PayoutRouting] 微信企业付款查询功能暂未实现，出款单 #%d", payout.ID)
	return false, "", errors.New("微信企业付款查询功能暂未实现")
}

// queryWechatBankTransfer 查询微信商家转账状态
func (s *PayoutRoutingService) queryWechatBankTransfer(ctx context.Context, payout *model.PayoutOrder) (bool, string, error) {
	log.Printf("[PayoutRouting] 微信商家转账查询功能暂未实现，出款单 #%d", payout.ID)
	return false, "", errors.New("微信商家转账查询功能暂未实现")
}

// queryBankTransfer 查询银行转账状态
func (s *PayoutRoutingService) queryBankTransfer(ctx context.Context, payout *model.PayoutOrder) (bool, string, error) {
	result, err := s.bankGateway.QueryTransfer(ctx, payout.OutPayoutNo)
	if err != nil {
		return false, "", err
	}

	switch result.Status {
	case "succeeded":
		return true, "", nil
	case "failed":
		return false, result.FailureReason, nil
	default:
		return false, "", nil
	}
}

// updateSettlementAndIncome 更新结算单和商家收入
func (s *PayoutRoutingService) updateSettlementAndIncome(tx *gorm.DB, payout *model.PayoutOrder) error {
	if payout.BizType != model.PayoutBizTypeSettlementOrder {
		return nil
	}

	// 更新结算单状态
	if err := tx.Model(&model.SettlementOrder{}).Where("id = ?", payout.BizID).Updates(map[string]any{
		"status":          model.SettlementStatusPaid,
		"payout_order_id": payout.ID,
	}).Error; err != nil {
		return err
	}

	// 更新商家收入
	var settlement model.SettlementOrder
	if err := tx.First(&settlement, payout.BizID).Error; err != nil {
		return err
	}

	if err := tx.Model(&model.MerchantIncome{}).Where("settlement_order_id = ?", payout.BizID).Updates(map[string]any{
		"status":               2, // 已出款
		"settlement_status":    model.SettlementStatusPaid,
		"payout_order_id":      payout.ID,
		"payout_status":        model.PayoutStatusPaid,
		"payout_failed_reason": "",
		"payouted_at":          payout.PaidAt,
	}).Error; err != nil {
		return err
	}

	log.Printf("[PayoutRouting] 结算单 #%d 已更新为已支付状态", payout.BizID)
	return nil
}

