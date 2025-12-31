package service

import (
	"errors"
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	"time"
)

// AfterSalesService 售后服务
type AfterSalesService struct{}

// CreateInput 创建售后申请入参
type CreateAfterSalesInput struct {
	BookingID   uint64  `json:"bookingId" binding:"required"`
	Type        string  `json:"type" binding:"required"`   // refund, complaint, repair
	Reason      string  `json:"reason" binding:"required"` // 申请原因
	Description string  `json:"description"`               // 详细描述
	Images      string  `json:"images"`                    // 图片URL JSON数组
	Amount      float64 `json:"amount"`                    // 涉及金额
}

// Create 创建售后申请
func (s *AfterSalesService) Create(userID uint64, input *CreateAfterSalesInput) (*model.AfterSales, error) {
	// 验证预约是否属于该用户
	var booking model.Booking
	if err := repository.DB.First(&booking, input.BookingID).Error; err != nil {
		return nil, errors.New("预约不存在")
	}
	if booking.UserID != userID {
		return nil, errors.New("无权操作此预约")
	}

	// 检查是否已有进行中的售后申请
	var existingCount int64
	repository.DB.Model(&model.AfterSales{}).
		Where("user_id = ? AND booking_id = ? AND status IN (0, 1)", userID, input.BookingID).
		Count(&existingCount)
	if existingCount > 0 {
		return nil, errors.New("该订单已有进行中的售后申请")
	}

	afterSales := &model.AfterSales{
		UserID:      userID,
		BookingID:   input.BookingID,
		OrderNo:     generateOrderNo("AS"),
		Type:        input.Type,
		Reason:      input.Reason,
		Description: input.Description,
		Images:      input.Images,
		Amount:      input.Amount,
		Status:      0, // 待处理
	}

	if err := repository.DB.Create(afterSales).Error; err != nil {
		return nil, errors.New("创建售后申请失败")
	}

	return afterSales, nil
}

// GetUserAfterSales 获取用户售后列表
func (s *AfterSalesService) GetUserAfterSales(userID uint64, status *int8) ([]model.AfterSales, error) {
	var list []model.AfterSales
	query := repository.DB.Where("user_id = ?", userID)

	if status != nil {
		query = query.Where("status = ?", *status)
	}

	if err := query.Order("created_at DESC").Find(&list).Error; err != nil {
		return nil, err
	}

	return list, nil
}

// GetByID 获取售后详情
func (s *AfterSalesService) GetByID(userID uint64, id uint64) (*model.AfterSales, error) {
	var afterSales model.AfterSales
	if err := repository.DB.First(&afterSales, id).Error; err != nil {
		return nil, errors.New("售后申请不存在")
	}

	if afterSales.UserID != userID {
		return nil, errors.New("无权查看此售后申请")
	}

	return &afterSales, nil
}

// Cancel 取消售后申请（用户主动取消）
func (s *AfterSalesService) Cancel(userID uint64, id uint64) error {
	var afterSales model.AfterSales
	if err := repository.DB.First(&afterSales, id).Error; err != nil {
		return errors.New("售后申请不存在")
	}

	if afterSales.UserID != userID {
		return errors.New("无权操作此售后申请")
	}

	if afterSales.Status != 0 && afterSales.Status != 1 {
		return errors.New("该申请已处理完成，无法取消")
	}

	afterSales.Status = 3 // 已拒绝（用户取消）
	afterSales.Reply = "用户主动取消"
	now := time.Now()
	afterSales.ResolvedAt = &now

	return repository.DB.Save(&afterSales).Error
}

// generateOrderNo 生成售后单号
func generateOrderNo(prefix string) string {
	return prefix + time.Now().Format("20060102150405")
}
