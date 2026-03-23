package service

import (
	"errors"
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	"log"
	"strconv"
	"strings"
	"time"
)

// BookingService 预约服务
type BookingService struct{}

// configSvc 配置服务实例
var configSvc = &ConfigService{}
var businessFlowSvc = &BusinessFlowService{}

// CreateBookingRequest 创建预约请求
type CreateBookingRequest struct {
	ProviderID     uint64  `json:"providerId" binding:"required"`
	ProviderType   string  `json:"providerType" binding:"required"` // designer, worker, company
	Address        string  `json:"address" binding:"required"`
	Area           float64 `json:"area" binding:"required"`
	RenovationType string  `json:"renovationType"`
	BudgetRange    string  `json:"budgetRange"`
	PreferredDate  string  `json:"preferredDate" binding:"required"`
	Phone          string  `json:"phone" binding:"required"`
	Notes          string  `json:"notes"`
	HouseLayout    string  `json:"houseLayout"`
}

// Create 创建预约
func (s *BookingService) Create(userID uint64, req *CreateBookingRequest) (*model.Booking, error) {
	// 输入校验
	addressLen := len(strings.TrimSpace(req.Address))
	if addressLen < 5 || addressLen > 100 {
		return nil, errors.New("地址长度需在 5-100 字符之间")
	}
	if req.Area < 10 || req.Area > 9999 {
		return nil, errors.New("房屋面积需在 10-9999 ㎡ 之间")
	}
	if len(req.Notes) > 500 {
		return nil, errors.New("补充说明不能超过 500 字符")
	}

	// 获取量房定金金额：设计师个人价 > 后台默认价 > 旧意向金fallback
	intentFee, err := configSvc.GetSurveyDepositDefault()
	if err != nil {
		intentFee = 99
	}
	surveyDepositSource := "system_default"
	var provider model.Provider
	if err := repository.DB.First(&provider, req.ProviderID).Error; err == nil {
		if provider.SurveyDepositPrice > 0 {
			intentFee = provider.SurveyDepositPrice
			surveyDepositSource = "provider_override"
		}
	}
	surveyRefundNotice := configSvc.GetSurveyRefundNotice()

	booking := &model.Booking{
		UserID:              userID,
		ProviderID:          req.ProviderID,
		ProviderType:        req.ProviderType,
		Address:             req.Address,
		Area:                req.Area,
		RenovationType:      req.RenovationType,
		BudgetRange:         req.BudgetRange,
		PreferredDate:       req.PreferredDate,
		Phone:               req.Phone,
		Notes:               req.Notes,
		HouseLayout:         req.HouseLayout,
		Status:              1,         // Pending
		IntentFee:           intentFee, // 从配置读取的意向金金额
		IntentFeePaid:       false,     // 默认未支付
		SurveyDepositSource: surveyDepositSource,
		SurveyRefundNotice:  surveyRefundNotice,
	}
	plainAddress := booking.Address
	plainPhone := booking.Phone
	plainNotes := booking.Notes

	if err := encryptBookingSensitiveFields(booking); err != nil {
		return nil, err
	}

	if err := repository.DB.Create(booking).Error; err != nil {
		return nil, err
	}
	booking.Address = plainAddress
	booking.Phone = plainPhone
	booking.Notes = plainNotes
	if _, err := businessFlowSvc.EnsureLeadFlow(nil, model.BusinessFlowSourceBooking, booking.ID, userID, req.ProviderID); err != nil {
		log.Printf("[business_flow] ensure booking flow failed: %v", err)
	}

	return booking, nil
}

// GetByID 根据ID获取预约详情
func (s *BookingService) GetByID(userID uint64, bookingID string) (*model.Booking, error) {
	id, err := strconv.ParseUint(bookingID, 10, 64)
	if err != nil {
		return nil, errors.New("无效的预约ID")
	}

	var booking model.Booking
	if err := repository.DB.First(&booking, id).Error; err != nil {
		return nil, errors.New("预约不存在")
	}

	// 权限校验：只能查看自己的预约
	if booking.UserID != userID {
		return nil, errors.New("无权查看此预约")
	}

	return &booking, nil
}

// PayIntentFee 支付意向金（模拟支付）
func (s *BookingService) PayIntentFee(userID uint64, bookingID string) (*model.Booking, error) {
	id, err := strconv.ParseUint(bookingID, 10, 64)
	if err != nil {
		return nil, errors.New("无效的预约ID")
	}

	var booking model.Booking
	if err := repository.DB.First(&booking, id).Error; err != nil {
		return nil, errors.New("预约不存在")
	}

	// 权限校验
	if booking.UserID != userID {
		return nil, errors.New("无权操作此预约")
	}

	// 幂等性检查
	if booking.IntentFeePaid {
		return &booking, nil // 已支付，直接返回
	}

	// 模拟支付成功，更新状态
	now := time.Now()
	deadline := now.Add(48 * time.Hour) // 48小时商家响应期限

	booking.IntentFeePaid = true
	booking.MerchantResponseDeadline = &deadline

	if err := repository.DB.Save(&booking).Error; err != nil {
		return nil, errors.New("支付处理失败")
	}

	// 发送通知给商家
	notifService := &NotificationService{}
	var provider model.Provider
	if err := repository.DB.First(&provider, booking.ProviderID).Error; err == nil {
		_ = notifService.NotifyBookingIntentPaid(&booking, provider.UserID)
	}

	return &booking, nil
}

// GetUserBookings 获取用户的预约列表
func (s *BookingService) GetUserBookings(userID uint64, paid *bool) ([]model.Booking, error) {
	var bookings []model.Booking
	query := repository.DB.Where("user_id = ?", userID)

	if paid != nil {
		query = query.Where("intent_fee_paid = ?", *paid)
	}

	if err := query.Order("created_at DESC").Find(&bookings).Error; err != nil {
		return nil, err
	}

	return bookings, nil
}

// CancelBooking 取消预约（仅限待付款状态）
func (s *BookingService) CancelBooking(userID uint64, bookingID string) error {
	id, err := strconv.ParseUint(bookingID, 10, 64)
	if err != nil {
		return errors.New("无效的预约ID")
	}

	var booking model.Booking
	if err := repository.DB.First(&booking, id).Error; err != nil {
		return errors.New("预约不存在")
	}

	log.Printf("[CancelBooking] Found booking - ID: %d, UserID: %d, Status: %d, IntentFeePaid: %v",
		booking.ID, booking.UserID, booking.Status, booking.IntentFeePaid)
	log.Printf("[CancelBooking] Request userID: %d", userID)

	// 权限校验
	if booking.UserID != userID {
		return errors.New("无权操作此预约")
	}

	// 只有待付款状态才能取消
	if booking.IntentFeePaid {
		return errors.New("已付款订单不能直接取消，请联系客服")
	}

	// 更新状态为已取消 (status = 4)
	booking.Status = 4
	result := repository.DB.Save(&booking)
	if result.Error != nil {
		return errors.New("取消失败，请重试")
	}

	log.Printf("[CancelBooking] Updated booking - RowsAffected: %d", result.RowsAffected)

	return nil
}

// DeleteBooking 删除预约（仅限已取消状态）
func (s *BookingService) DeleteBooking(userID uint64, bookingID string) error {
	id, err := strconv.ParseUint(bookingID, 10, 64)
	if err != nil {
		return errors.New("无效的预约ID")
	}

	var booking model.Booking
	if err := repository.DB.First(&booking, id).Error; err != nil {
		return errors.New("预约不存在")
	}

	log.Printf("[DeleteBooking] Found booking - ID: %d, UserID: %d, Status: %d",
		booking.ID, booking.UserID, booking.Status)

	// 权限校验
	if booking.UserID != userID {
		return errors.New("无权操作此预约")
	}

	// 只有已取消状态才能删除
	if booking.Status != 4 {
		return errors.New("只能删除已取消的订单")
	}

	// 物理删除订单
	if err := repository.DB.Delete(&booking).Error; err != nil {
		return errors.New("删除失败，请重试")
	}

	log.Printf("[DeleteBooking] Deleted booking - ID: %d", id)

	return nil
}
