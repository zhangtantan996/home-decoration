package service

import (
	"errors"
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	"log"
	"time"
)

// RefundService 退款服务
type RefundService struct{}

// RefundScenario 退款场景
type RefundScenario string

const (
	RefundScenarioMerchantTimeout   RefundScenario = "merchant_timeout"   // 商家48小时超时
	RefundScenarioMerchantReject    RefundScenario = "merchant_reject"    // 商家拒单
	RefundScenarioProposalRejected3 RefundScenario = "proposal_rejected3" // 方案连续拒绝3次
	RefundScenarioAdminManual       RefundScenario = "admin_manual"       // 管理员手动退款
)

// RefundIntentFee 退还意向金
func (s *RefundService) RefundIntentFee(bookingID uint64, scenario RefundScenario, additionalReason string) error {
	var booking model.Booking
	if err := repository.DB.First(&booking, bookingID).Error; err != nil {
		return errors.New("预约记录不存在")
	}

	// 验证退款条件
	canRefund, reason := s.CanRefundIntentFee(&booking)
	if !canRefund {
		log.Printf("[RefundService] Cannot refund booking %d: %s", bookingID, reason)
		return errors.New(reason)
	}

	// 构建退款原因
	refundReason := s.buildRefundReason(scenario, additionalReason)

	// 执行退款（暂时模拟，P1阶段接入真实支付网关）
	now := time.Now()
	booking.IntentFeeRefunded = true
	booking.IntentFeeRefundReason = refundReason
	booking.IntentFeeRefundedAt = &now

	if err := repository.DB.Save(&booking).Error; err != nil {
		log.Printf("[RefundService] Failed to update booking %d: %v", bookingID, err)
		return errors.New("退款处理失败")
	}

	log.Printf("[RefundService] Refunded intent fee for booking %d (%.2f元): %s",
		bookingID, booking.IntentFee, refundReason)

	// 发送退款通知给用户
	notifService := &NotificationService{}
	refundData := map[string]interface{}{
		"bookingId":    booking.ID,
		"amount":       booking.IntentFee,
		"reason":       refundReason,
		"refundedAt":   now,
	}
	_ = notifService.NotifyIntentFeeRefunded(refundData, booking.UserID)

	// TODO: 调用支付网关退款API
	// paymentGateway.Refund(booking.IntentFeeTransactionID, booking.IntentFee)

	return nil
}

// CanRefundIntentFee 判断是否可以退款
func (s *RefundService) CanRefundIntentFee(booking *model.Booking) (bool, string) {
	// 未支付意向金
	if !booking.IntentFeePaid {
		return false, "意向金未支付"
	}

	// 已退款
	if booking.IntentFeeRefunded {
		return false, "意向金已退款，不可重复退款"
	}

	// 已抵扣
	if booking.IntentFeeDeducted {
		return false, "意向金已抵扣至设计费，不可退款"
	}

	// 预约已完成或已取消（正常流程），默认不退款
	// 但如果是管理员手动退款，可以允许
	if booking.Status == 3 || booking.Status == 4 {
		// 需要额外权限检查（管理员操作）
		// 这里暂时允许，实际应由调用方控制
	}

	return true, ""
}

// buildRefundReason 构建退款原因文本
func (s *RefundService) buildRefundReason(scenario RefundScenario, additionalReason string) string {
	reasonMap := map[RefundScenario]string{
		RefundScenarioMerchantTimeout:   "商家超时未响应（48小时），系统自动退款",
		RefundScenarioMerchantReject:    "商家拒绝接单",
		RefundScenarioProposalRejected3: "方案连续被拒绝3次，系统自动退款",
		RefundScenarioAdminManual:       "管理员手动退款",
	}

	baseReason := reasonMap[scenario]
	if baseReason == "" {
		baseReason = "系统退款"
	}

	if additionalReason != "" {
		return baseReason + "：" + additionalReason
	}

	return baseReason
}

// GetRefundableBookings 获取可退款的预约列表（用于定时任务扫描）
func (s *RefundService) GetRefundableBookings() ([]model.Booking, error) {
	var bookings []model.Booking

	// 查询条件：已支付意向金、未退款、未抵扣、状态为待确认、超过48小时截止时间
	now := time.Now()
	if err := repository.DB.Where(
		"intent_fee_paid = ? AND intent_fee_refunded = ? AND intent_fee_deducted = ? AND status = ? AND merchant_response_deadline < ?",
		true, false, false, 1, now,
	).Find(&bookings).Error; err != nil {
		return nil, err
	}

	return bookings, nil
}

// BatchRefundTimeoutBookings 批量退款超时预约（定时任务调用）
func (s *RefundService) BatchRefundTimeoutBookings() (int, error) {
	bookings, err := s.GetRefundableBookings()
	if err != nil {
		log.Printf("[RefundService] Failed to get refundable bookings: %v", err)
		return 0, err
	}

	if len(bookings) == 0 {
		return 0, nil
	}

	successCount := 0
	for _, booking := range bookings {
		if err := s.RefundIntentFee(booking.ID, RefundScenarioMerchantTimeout, ""); err != nil {
			log.Printf("[RefundService] Failed to refund booking %d: %v", booking.ID, err)
			continue
		}

		// 更新预约状态为已取消
		booking.Status = 4 // Cancelled
		repository.DB.Save(&booking)

		successCount++
	}

	log.Printf("[RefundService] Batch refunded %d/%d timeout bookings", successCount, len(bookings))
	return successCount, nil
}
