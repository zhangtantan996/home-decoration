package service

import (
	"encoding/json"
	"errors"
	"fmt"
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	"time"
)

type NotificationService struct{}

type CreateNotificationInput struct {
	UserID      uint64
	UserType    string
	Title       string
	Content     string
	Type        string
	RelatedID   uint64
	RelatedType string
	ActionURL   string
	Extra       map[string]interface{}
}

// Create 创建通知
func (s *NotificationService) Create(input *CreateNotificationInput) error {
	if input.UserID == 0 {
		return errors.New("用户ID不能为空")
	}
	if input.Title == "" || input.Content == "" {
		return errors.New("标题和内容不能为空")
	}

	extraJSON := ""
	if input.Extra != nil {
		bytes, _ := json.Marshal(input.Extra)
		extraJSON = string(bytes)
	}

	notification := &model.Notification{
		UserID:      input.UserID,
		UserType:    input.UserType,
		Title:       input.Title,
		Content:     input.Content,
		Type:        input.Type,
		RelatedID:   input.RelatedID,
		RelatedType: input.RelatedType,
		ActionURL:   input.ActionURL,
		Extra:       extraJSON,
		IsRead:      false,
	}

	if err := repository.DB.Create(notification).Error; err != nil {
		return err
	}

	s.publishNewNotification(notification)
	return nil
}

// NotifyAdmins 向所有超级管理员发送通知
func (s *NotificationService) NotifyAdmins(input *CreateNotificationInput) error {
	var admins []model.SysAdmin
	// 只通知超级管理员或所有活跃管理员
	if err := repository.DB.Where("status = ?", 1).Find(&admins).Error; err != nil {
		return err
	}

	for _, admin := range admins {
		adminInput := *input
		adminInput.UserID = admin.ID
		adminInput.UserType = "admin"
		_ = s.Create(&adminInput)
	}
	return nil
}

// NotifyBookingIntentPaid 通知商家收到新预约
func (s *NotificationService) NotifyBookingIntentPaid(booking *model.Booking, providerUserID uint64) error {
	// 1. 通知商家
	err := s.Create(&CreateNotificationInput{
		UserID:      providerUserID,
		UserType:    "provider",
		Title:       "新预约通知",
		Content:     "您有一个新的预约请求，请尽快处理",
		Type:        model.NotificationTypeBookingIntentPaid,
		RelatedID:   booking.ID,
		RelatedType: "booking",
		ActionURL:   fmt.Sprintf("/merchant/bookings/%d", booking.ID),
		Extra: map[string]interface{}{
			"bookingId": booking.ID,
			"address":   booking.Address,
			"intentFee": booking.IntentFee,
		},
	})

	// 2. 通知后台管理员 (场景 1)
	_ = s.NotifyAdmins(&CreateNotificationInput{
		Title:   "新支付通知",
		Content: fmt.Sprintf("用户已支付意向金 %.2f 元，对应预约 ID: %d", booking.IntentFee, booking.ID),
		Type:    model.NotificationTypeBookingIntentPaid,
		Extra: map[string]interface{}{
			"bookingId": booking.ID,
			"amount":    booking.IntentFee,
		},
	})

	return err
}

// NotifyBookingConfirmed 通知用户商家已接单
func (s *NotificationService) NotifyBookingConfirmed(booking *model.Booking) error {
	return s.Create(&CreateNotificationInput{
		UserID:      booking.UserID,
		UserType:    "user",
		Title:       "商家已接单",
		Content:     "商家已确认接单，请等待方案提交",
		Type:        model.NotificationTypeBookingConfirmed,
		RelatedID:   booking.ID,
		RelatedType: "booking",
		ActionURL:   fmt.Sprintf("/bookings/%d", booking.ID),
		Extra: map[string]interface{}{
			"bookingId":  booking.ID,
			"providerId": booking.ProviderID,
		},
	})
}

// NotifyProposalSubmitted 通知用户方案已提交
func (s *NotificationService) NotifyProposalSubmitted(proposal interface{}, userID uint64) error {
	// 使用interface{}来处理不同的proposal类型（model.Proposal或business_flow.Proposal）
	proposalMap, ok := proposal.(map[string]interface{})
	if !ok {
		return errors.New("invalid proposal type")
	}

	proposalID, _ := proposalMap["id"].(uint64)
	bookingID, _ := proposalMap["bookingId"].(uint64)
	demandID, _ := proposalMap["demandId"].(uint64)
	sourceType, _ := proposalMap["sourceType"].(string)
	actionURL := fmt.Sprintf("/proposals/%d", proposalID)
	if sourceType == model.ProposalSourceDemand && demandID > 0 {
		actionURL = fmt.Sprintf("/demands/%d/compare", demandID)
	}

	return s.Create(&CreateNotificationInput{
		UserID:      userID,
		UserType:    "user",
		Title:       "设计方案已提交",
		Content:     "商家已提交设计方案，请查看并确认",
		Type:        model.NotificationTypeProposalSubmitted,
		RelatedID:   proposalID,
		RelatedType: "proposal",
		ActionURL:   actionURL,
		Extra: map[string]interface{}{
			"proposalId": proposalID,
			"bookingId":  bookingID,
			"demandId":   demandID,
			"sourceType": sourceType,
		},
	})
}

// NotifyProposalConfirmed 通知商家方案已确认
func (s *NotificationService) NotifyProposalConfirmed(proposal interface{}, providerUserID uint64) error {
	proposalMap, ok := proposal.(map[string]interface{})
	if !ok {
		return errors.New("invalid proposal type")
	}

	proposalID, _ := proposalMap["id"].(uint64)

	return s.Create(&CreateNotificationInput{
		UserID:      providerUserID,
		UserType:    "provider",
		Title:       "方案已确认",
		Content:     "用户已确认设计方案，请等待支付设计费",
		Type:        model.NotificationTypeProposalConfirmed,
		RelatedID:   proposalID,
		RelatedType: "proposal",
		ActionURL:   fmt.Sprintf("/merchant/proposals/%d", proposalID),
		Extra: map[string]interface{}{
			"proposalId": proposalID,
		},
	})
}

// NotifyProposalRejected 通知商家方案被拒绝
func (s *NotificationService) NotifyProposalRejected(proposal interface{}, providerUserID uint64, reason string) error {
	proposalMap, ok := proposal.(map[string]interface{})
	if !ok {
		return errors.New("invalid proposal type")
	}

	proposalID, _ := proposalMap["id"].(uint64)
	version, _ := proposalMap["version"].(int)

	return s.Create(&CreateNotificationInput{
		UserID:      providerUserID,
		UserType:    "provider",
		Title:       "方案被拒绝",
		Content:     fmt.Sprintf("用户拒绝了您的方案v%d，拒绝原因：%s", version, reason),
		Type:        model.NotificationTypeProposalRejected,
		RelatedID:   proposalID,
		RelatedType: "proposal",
		ActionURL:   fmt.Sprintf("/merchant/proposals/%d", proposalID),
		Extra: map[string]interface{}{
			"proposalId": proposalID,
			"version":    version,
			"reason":     reason,
		},
	})
}

// NotifyOrderCreated 通知用户订单已生成
func (s *NotificationService) NotifyOrderCreated(order interface{}, userID uint64) error {
	orderMap, ok := order.(map[string]interface{})
	if !ok {
		return errors.New("invalid order type")
	}

	orderID, _ := orderMap["id"].(uint64)
	amount, _ := orderMap["amount"].(float64)

	return s.Create(&CreateNotificationInput{
		UserID:      userID,
		UserType:    "user",
		Title:       "账单已生成",
		Content:     fmt.Sprintf("您的账单已生成，金额：%.2f元，请尽快支付", amount),
		Type:        model.NotificationTypeOrderCreated,
		RelatedID:   orderID,
		RelatedType: "order",
		ActionURL:   fmt.Sprintf("/orders/%d", orderID),
		Extra: map[string]interface{}{
			"orderId": orderID,
			"amount":  amount,
		},
	})
}

// NotifyOrderPaid 通知商家订单已支付
func (s *NotificationService) NotifyOrderPaid(order interface{}, providerUserID uint64) error {
	orderMap, ok := order.(map[string]interface{})
	if !ok {
		return errors.New("invalid order type")
	}

	orderID, _ := orderMap["id"].(uint64)
	amount, _ := orderMap["amount"].(float64)

	return s.Create(&CreateNotificationInput{
		UserID:      providerUserID,
		UserType:    "provider",
		Title:       "收款通知",
		Content:     fmt.Sprintf("用户已支付订单，金额：%.2f元", amount),
		Type:        model.NotificationTypeOrderPaid,
		RelatedID:   orderID,
		RelatedType: "order",
		ActionURL:   fmt.Sprintf("/merchant/orders/%d", orderID),
		Extra: map[string]interface{}{
			"orderId": orderID,
			"amount":  amount,
		},
	})
}

// NotifyWithdrawApproved 通知商家提现审核通过
func (s *NotificationService) NotifyWithdrawApproved(withdraw *model.MerchantWithdraw, providerUserID uint64) error {
	return s.Create(&CreateNotificationInput{
		UserID:      providerUserID,
		UserType:    "provider",
		Title:       "提现审核通过",
		Content:     fmt.Sprintf("您的提现申请已审核通过，金额：%.2f元，当前待财务线下打款", withdraw.Amount),
		Type:        model.NotificationTypeWithdrawApproved,
		RelatedID:   withdraw.ID,
		RelatedType: "withdraw",
		ActionURL:   fmt.Sprintf("/merchant/withdraws/%d", withdraw.ID),
		Extra: map[string]interface{}{
			"withdrawId": withdraw.ID,
			"amount":     withdraw.Amount,
			"orderNo":    withdraw.OrderNo,
		},
	})
}

// NotifyWithdrawCompleted 通知商家提现已打款
func (s *NotificationService) NotifyWithdrawCompleted(withdraw *model.MerchantWithdraw, providerUserID uint64) error {
	return s.Create(&CreateNotificationInput{
		UserID:      providerUserID,
		UserType:    "provider",
		Title:       "提现已打款",
		Content:     fmt.Sprintf("您的提现申请已完成打款，金额：%.2f元", withdraw.Amount),
		Type:        model.NotificationTypeWithdrawCompleted,
		RelatedID:   withdraw.ID,
		RelatedType: "withdraw",
		ActionURL:   fmt.Sprintf("/merchant/withdraws/%d", withdraw.ID),
		Extra: map[string]interface{}{
			"withdrawId": withdraw.ID,
			"amount":     withdraw.Amount,
			"orderNo":    withdraw.OrderNo,
		},
	})
}

// NotifyWithdrawRejected 通知商家提现审核拒绝
func (s *NotificationService) NotifyWithdrawRejected(withdraw *model.MerchantWithdraw, providerUserID uint64) error {
	return s.Create(&CreateNotificationInput{
		UserID:      providerUserID,
		UserType:    "provider",
		Title:       "提现审核拒绝",
		Content:     fmt.Sprintf("您的提现申请被拒绝，原因：%s", withdraw.FailReason),
		Type:        model.NotificationTypeWithdrawRejected,
		RelatedID:   withdraw.ID,
		RelatedType: "withdraw",
		ActionURL:   fmt.Sprintf("/merchant/withdraws/%d", withdraw.ID),
		Extra: map[string]interface{}{
			"withdrawId": withdraw.ID,
			"amount":     withdraw.Amount,
			"reason":     withdraw.FailReason,
		},
	})
}

// NotifyIntentFeeRefunded 通知用户意向金已退款
func (s *NotificationService) NotifyIntentFeeRefunded(refundData interface{}, userID uint64) error {
	refundMap, ok := refundData.(map[string]interface{})
	if !ok {
		return errors.New("invalid refund data type")
	}

	bookingID, _ := refundMap["bookingId"].(uint64)
	amount, _ := refundMap["amount"].(float64)
	reason, _ := refundMap["reason"].(string)

	return s.Create(&CreateNotificationInput{
		UserID:      userID,
		UserType:    "user",
		Title:       "意向金已退款",
		Content:     fmt.Sprintf("您的意向金已退款，金额：%.2f元\n退款原因：%s", amount, reason),
		Type:        "booking.intent_refunded",
		RelatedID:   bookingID,
		RelatedType: "booking",
		ActionURL:   fmt.Sprintf("/bookings/%d", bookingID),
		Extra: map[string]interface{}{
			"bookingId": bookingID,
			"amount":    amount,
			"reason":    reason,
		},
	})
}

// GetUserNotifications 获取用户通知列表
func (s *NotificationService) GetUserNotifications(userID uint64, userType string, page, pageSize int) ([]model.Notification, int64, error) {
	var notifications []model.Notification
	var total int64

	query := repository.DB.Where("user_id = ? AND user_type = ?", userID, userType).
		Order("created_at DESC")

	query.Model(&model.Notification{}).Count(&total)

	offset := (page - 1) * pageSize
	err := query.Offset(offset).Limit(pageSize).Find(&notifications).Error

	return notifications, total, err
}

// GetUnreadCount 获取未读数量
func (s *NotificationService) GetUnreadCount(userID uint64, userType string) (int64, error) {
	var count int64
	err := repository.DB.Model(&model.Notification{}).
		Where("user_id = ? AND user_type = ? AND is_read = ?", userID, userType, false).
		Count(&count).Error
	return count, err
}

// MarkAsRead 标记已读
func (s *NotificationService) MarkAsRead(notificationID, userID uint64, userType string) error {
	now := time.Now()
	result := repository.DB.Model(&model.Notification{}).
		Where("id = ? AND user_id = ? AND user_type = ?", notificationID, userID, userType).
		Updates(map[string]interface{}{
			"is_read": true,
			"read_at": &now,
		})

	if result.RowsAffected == 0 {
		return errors.New("通知不存在")
	}
	if result.Error != nil {
		return result.Error
	}

	s.publishReadNotification(userType, userID, notificationID)
	s.publishUnreadCount(userType, userID)
	return nil
}

// MarkAllAsRead 全部标记已读
func (s *NotificationService) MarkAllAsRead(userID uint64, userType string) error {
	now := time.Now()
	if err := repository.DB.Model(&model.Notification{}).
		Where("user_id = ? AND user_type = ? AND is_read = ?", userID, userType, false).
		Updates(map[string]interface{}{
			"is_read": true,
			"read_at": &now,
		}).Error; err != nil {
		return err
	}

	s.publishAllReadNotification(userType, userID)
	s.publishUnreadCount(userType, userID)
	return nil
}

// DeleteNotification 删除通知
func (s *NotificationService) DeleteNotification(notificationID, userID uint64, userType string) error {
	result := repository.DB.Where("id = ? AND user_id = ? AND user_type = ?", notificationID, userID, userType).
		Delete(&model.Notification{})

	if result.RowsAffected == 0 {
		return errors.New("通知不存在")
	}
	if result.Error != nil {
		return result.Error
	}

	s.publishDeletedNotification(userType, userID, notificationID)
	s.publishUnreadCount(userType, userID)
	return nil
}

func (s *NotificationService) publishNewNotification(notification *model.Notification) {
	publisher := GetNotificationPublisher()
	if publisher == nil || notification == nil {
		return
	}

	_ = publisher.PublishNew(notification)
	s.publishUnreadCount(notification.UserType, notification.UserID)
}

func (s *NotificationService) publishUnreadCount(userType string, userID uint64) {
	publisher := GetNotificationPublisher()
	if publisher == nil || userID == 0 || userType == "" {
		return
	}

	count, err := s.GetUnreadCount(userID, userType)
	if err != nil {
		return
	}
	_ = publisher.PublishUnreadCount(userType, userID, count)
}

func (s *NotificationService) publishReadNotification(userType string, userID, notificationID uint64) {
	publisher := GetNotificationPublisher()
	if publisher == nil || userID == 0 || userType == "" || notificationID == 0 {
		return
	}
	_ = publisher.PublishRead(userType, userID, notificationID)
}

func (s *NotificationService) publishDeletedNotification(userType string, userID, notificationID uint64) {
	publisher := GetNotificationPublisher()
	if publisher == nil || userID == 0 || userType == "" || notificationID == 0 {
		return
	}
	_ = publisher.PublishDeleted(userType, userID, notificationID)
}

func (s *NotificationService) publishAllReadNotification(userType string, userID uint64) {
	publisher := GetNotificationPublisher()
	if publisher == nil || userID == 0 || userType == "" {
		return
	}
	_ = publisher.PublishAllRead(userType, userID)
}
