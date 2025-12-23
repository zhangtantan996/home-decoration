package service

import (
	"errors"
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	"strings"
)

// BookingService 预约服务
type BookingService struct{}

// CreateBookingRequest 创建预约请求
type CreateBookingRequest struct {
	ProviderID     uint64  `json:"providerId" binding:"required"`
	ProviderType   string  `json:"providerType" binding:"required"` // designer, worker, company
	Address        string  `json:"address" binding:"required"`
	Area           float64 `json:"area" binding:"required"`
	RenovationType string  `json:"renovationType"`
	BudgetRange    string  `json:"budgetRange"`
	PreferredDate  string  `json:"preferredDate"`
	Phone          string  `json:"phone" binding:"required"`
	Notes          string  `json:"notes"`
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

	booking := &model.Booking{
		UserID:         userID,
		ProviderID:     req.ProviderID,
		ProviderType:   req.ProviderType,
		Address:        req.Address,
		Area:           req.Area,
		RenovationType: req.RenovationType,
		BudgetRange:    req.BudgetRange,
		PreferredDate:  req.PreferredDate,
		Phone:          req.Phone,
		Notes:          req.Notes,
		Status:         1, // Pending
	}

	if err := repository.DB.Create(booking).Error; err != nil {
		return nil, err
	}

	return booking, nil
}
