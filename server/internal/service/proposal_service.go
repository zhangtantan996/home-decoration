package service

import (
	"errors"
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	"strings"
	"time"

	"gorm.io/gorm"
)

// ProposalService 设计方案服务
type ProposalService struct{}

// SubmitProposalInput 提交方案入参
type SubmitProposalInput struct {
	SourceType      string  `json:"sourceType"`
	BookingID       uint64  `json:"bookingId"`
	DemandMatchID   uint64  `json:"demandMatchId"`
	Summary         string  `json:"summary"`
	DesignFee       float64 `json:"designFee" binding:"required"`
	ConstructionFee float64 `json:"constructionFee"`
	MaterialFee     float64 `json:"materialFee"`
	EstimatedDays   int     `json:"estimatedDays"`
	Attachments     string  `json:"attachments"` // JSON array
}

// SubmitProposal 设计师提交方案
func (s *ProposalService) SubmitProposal(designerID uint64, input *SubmitProposalInput) (*model.Proposal, error) {
	sourceType := normalizeProposalSource(input.SourceType)
	now := time.Now()
	deadline := now.Add(14 * 24 * time.Hour) // 14天确认期限
	proposal := &model.Proposal{
		SourceType:           sourceType,
		DesignerID:           designerID,
		Summary:              input.Summary,
		DesignFee:            input.DesignFee,
		ConstructionFee:      input.ConstructionFee,
		MaterialFee:          input.MaterialFee,
		EstimatedDays:        input.EstimatedDays,
		Attachments:          input.Attachments,
		Status:               model.ProposalStatusPending,
		Version:              1,
		SubmittedAt:          &now,
		UserResponseDeadline: &deadline,
	}

	var (
		targetUserID uint64
		bookingID    uint64
		demandID     uint64
	)

	switch sourceType {
	case model.ProposalSourceDemand:
		if input.DemandMatchID == 0 {
			return nil, errors.New("缺少线索ID")
		}
		demandSvc := NewDemandService()
		match, err := demandSvc.GetDemandMatch(input.DemandMatchID)
		if err != nil {
			return nil, err
		}
		if match.ProviderID != designerID {
			return nil, errors.New("无权操作该线索")
		}
		if match.Status == model.DemandMatchStatusPending {
			return nil, errors.New("请先接受线索")
		}
		if match.Status == model.DemandMatchStatusDeclined {
			return nil, errors.New("已拒绝的线索不可提交方案")
		}
		var existing model.Proposal
		if err := repository.DB.Where("demand_match_id = ? AND status <> ?", input.DemandMatchID, model.ProposalStatusSuperseded).First(&existing).Error; err == nil {
			return nil, errors.New("该线索已存在方案，请勿重复提交")
		}
		var demand model.Demand
		if err := repository.DB.First(&demand, match.DemandID).Error; err != nil {
			return nil, errors.New("关联需求不存在")
		}
		proposal.DemandID = demand.ID
		proposal.DemandMatchID = match.ID
		targetUserID = demand.UserID
		demandID = demand.ID
	default:
		if input.BookingID == 0 {
			return nil, errors.New("缺少预约ID")
		}
		var booking model.Booking
		if err := repository.DB.First(&booking, input.BookingID).Error; err != nil {
			return nil, errors.New("预约记录不存在")
		}
		if booking.ProviderID != designerID {
			return nil, errors.New("无权操作此预约")
		}
		if booking.Status != 2 {
			return nil, errors.New("预约状态不正确，需为已确认状态")
		}
		var existing model.Proposal
		if err := repository.DB.Where("booking_id = ?", input.BookingID).First(&existing).Error; err == nil {
			return nil, errors.New("该预约已存在方案，请勿重复提交")
		}
		proposal.BookingID = input.BookingID
		targetUserID = booking.UserID
		bookingID = booking.ID
	}

	if err := repository.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(proposal).Error; err != nil {
			return err
		}
		if proposal.SourceType == model.ProposalSourceDemand {
			return NewDemandService().MarkMatchQuoted(tx, proposal)
		}
		return nil
	}); err != nil {
		return nil, err
	}

	notifService := &NotificationService{}
	proposalData := map[string]interface{}{
		"id":         proposal.ID,
		"bookingId":  bookingID,
		"demandId":   demandID,
		"sourceType": proposal.SourceType,
	}
	_ = notifService.NotifyProposalSubmitted(proposalData, targetUserID)

	return proposal, nil
}

func normalizeProposalSource(value string) string {
	if strings.TrimSpace(strings.ToLower(value)) == model.ProposalSourceDemand {
		return model.ProposalSourceDemand
	}
	return model.ProposalSourceBooking
}

// GetProposal 获取方案详情
func (s *ProposalService) GetProposal(proposalID uint64) (*model.Proposal, error) {
	var proposal model.Proposal
	if err := repository.DB.First(&proposal, proposalID).Error; err != nil {
		return nil, errors.New("方案不存在")
	}
	return &proposal, nil
}

// GetProposalByBooking 根据预约获取方案
func (s *ProposalService) GetProposalByBooking(bookingID uint64) (*model.Proposal, error) {
	var proposal model.Proposal
	if err := repository.DB.Where("booking_id = ?", bookingID).First(&proposal).Error; err != nil {
		return nil, errors.New("方案不存在")
	}
	return &proposal, nil
}

// ConfirmProposal 用户确认方案 -> 创建设计费订单（48小时过期）
func (s *ProposalService) ConfirmProposal(userID, proposalID uint64) (*model.Order, error) {
	var proposal model.Proposal
	if err := repository.DB.First(&proposal, proposalID).Error; err != nil {
		return nil, errors.New("方案不存在")
	}
	if proposal.SourceType == model.ProposalSourceDemand {
		return nil, errors.New("需求报价确认将在下一阶段开放")
	}

	// 验证预约归属
	var booking model.Booking
	if err := repository.DB.First(&booking, proposal.BookingID).Error; err != nil {
		return nil, errors.New("预约记录不存在")
	}
	if booking.UserID != userID {
		return nil, errors.New("无权操作此方案")
	}

	if proposal.Status != model.ProposalStatusPending {
		return nil, errors.New("方案状态不正确")
	}

	// 检查是否已有未支付的设计费订单
	var existingOrder model.Order
	if err := repository.DB.Where("proposal_id = ? AND order_type = ? AND status = ?",
		proposalID, model.OrderTypeDesign, model.OrderStatusPending).First(&existingOrder).Error; err == nil {
		// 已存在未支付订单，检查是否过期
		if existingOrder.ExpireAt != nil && existingOrder.ExpireAt.After(time.Now()) {
			return &existingOrder, nil // 返回现有订单
		}
		// 已过期，取消旧订单
		repository.DB.Model(&existingOrder).Update("status", model.OrderStatusCancelled)
	}

	// 开启事务
	tx := repository.DB.Begin()

	// 1. 更新方案状态为已确认
	now := time.Now()
	expireAt := now.Add(48 * time.Hour) // 48小时过期
	proposal.Status = model.ProposalStatusConfirmed
	proposal.ConfirmedAt = &now
	if err := tx.Save(&proposal).Error; err != nil {
		tx.Rollback()
		return nil, err
	}

	// 2. 创建设计费订单
	discount := 0.0
	// 如果已支付意向金，且未被抵扣过（这里假设每次生成订单都尝试抵扣，支付成功后才标记抵扣）
	// 简化逻辑：只要支付了意向金，设计费就减免
	if booking.IntentFeePaid {
		discount = booking.IntentFee
	}

	// 确保不出现负数
	totalAmount := proposal.DesignFee - discount
	if totalAmount < 0 {
		totalAmount = 0
	}

	order := &model.Order{
		ProposalID:  proposalID,
		BookingID:   proposal.BookingID,
		OrderNo:     generateOrderNo("DF"), // DF = Design Fee
		OrderType:   model.OrderTypeDesign,
		TotalAmount: totalAmount,
		Discount:    discount, // 记录抵扣额
		Status:      model.OrderStatusPending,
		ExpireAt:    &expireAt,
	}
	if err := tx.Create(order).Error; err != nil {
		tx.Rollback()
		return nil, err
	}

	tx.Commit()

	// 发送通知给商家
	notifService := &NotificationService{}
	proposalData := map[string]interface{}{
		"id": proposal.ID,
	}
	// Get provider's user ID
	var provider model.Provider
	if err := repository.DB.First(&provider, booking.ProviderID).Error; err == nil {
		_ = notifService.NotifyProposalConfirmed(proposalData, provider.UserID)
	}

	return order, nil
}

// ResubmitProposalInput 重新提交方案入参
type ResubmitProposalInput struct {
	ProposalID      uint64  `json:"proposalId" binding:"required"`
	Summary         string  `json:"summary"`
	DesignFee       float64 `json:"designFee" binding:"required"`
	ConstructionFee float64 `json:"constructionFee"`
	MaterialFee     float64 `json:"materialFee"`
	EstimatedDays   int     `json:"estimatedDays"`
	Attachments     string  `json:"attachments"` // JSON array
}

// ResubmitProposal 商家重新提交方案（生成新版本）
func (s *ProposalService) ResubmitProposal(designerID uint64, input *ResubmitProposalInput) (*model.Proposal, error) {
	// 1. 验证原方案存在且为已拒绝状态
	var oldProposal model.Proposal
	if err := repository.DB.First(&oldProposal, input.ProposalID).Error; err != nil {
		return nil, errors.New("原方案不存在")
	}

	if oldProposal.DesignerID != designerID {
		return nil, errors.New("无权操作此方案")
	}

	if oldProposal.Status != model.ProposalStatusRejected {
		return nil, errors.New("只能重新提交已被拒绝的方案")
	}

	// 2. 检查拒绝次数是否已达到3次
	if oldProposal.RejectionCount >= 3 {
		return nil, errors.New("该预约已连续拒绝3次，无法再次提交")
	}

	// 3. 开启事务：标记原方案为已替代 + 创建新版本方案
	tx := repository.DB.Begin()

	// 3.1 标记原方案为已替代
	oldProposal.Status = model.ProposalStatusSuperseded
	if err := tx.Save(&oldProposal).Error; err != nil {
		tx.Rollback()
		return nil, err
	}

	// 3.2 创建新版本方案
	now := time.Now()
	deadline := now.Add(14 * 24 * time.Hour) // 14天确认期限

	newProposal := &model.Proposal{
		SourceType:           oldProposal.SourceType,
		BookingID:            oldProposal.BookingID,
		DemandID:             oldProposal.DemandID,
		DemandMatchID:        oldProposal.DemandMatchID,
		DesignerID:           designerID,
		Summary:              input.Summary,
		DesignFee:            input.DesignFee,
		ConstructionFee:      input.ConstructionFee,
		MaterialFee:          input.MaterialFee,
		EstimatedDays:        input.EstimatedDays,
		Attachments:          input.Attachments,
		Status:               model.ProposalStatusPending,
		Version:              oldProposal.Version + 1,    // 版本号递增
		ParentProposalID:     oldProposal.ID,             // 指向上一版本
		RejectionCount:       oldProposal.RejectionCount, // 继承拒绝次数
		SubmittedAt:          &now,
		UserResponseDeadline: &deadline,
	}

	if err := tx.Create(newProposal).Error; err != nil {
		tx.Rollback()
		return nil, err
	}
	if newProposal.SourceType == model.ProposalSourceDemand {
		if err := NewDemandService().MarkMatchQuoted(tx, newProposal); err != nil {
			tx.Rollback()
			return nil, err
		}
	}

	if err := tx.Commit().Error; err != nil {
		return nil, err
	}

	// 4. 发送通知给用户
	notifService := &NotificationService{}
	proposalData := map[string]interface{}{
		"id":         newProposal.ID,
		"bookingId":  newProposal.BookingID,
		"demandId":   newProposal.DemandID,
		"sourceType": newProposal.SourceType,
		"version":    newProposal.Version,
	}
	if newProposal.SourceType == model.ProposalSourceDemand {
		var demand model.Demand
		if err := repository.DB.First(&demand, newProposal.DemandID).Error; err == nil {
			_ = notifService.NotifyProposalSubmitted(proposalData, demand.UserID)
		}
	} else {
		var booking model.Booking
		if err := repository.DB.First(&booking, oldProposal.BookingID).Error; err == nil {
			_ = notifService.NotifyProposalSubmitted(proposalData, booking.UserID)
		}
	}

	return newProposal, nil
}

// GetProposalVersionHistory 获取方案版本历史
func (s *ProposalService) GetProposalVersionHistory(bookingID uint64) ([]model.Proposal, error) {
	var proposals []model.Proposal
	if err := repository.DB.Where("booking_id = ?", bookingID).
		Order("version DESC").
		Find(&proposals).Error; err != nil {
		return nil, err
	}
	return proposals, nil
}

// GetRejectionInfo 获取方案拒绝信息（供商家查看）
func (s *ProposalService) GetRejectionInfo(designerID, proposalID uint64) (map[string]interface{}, error) {
	var proposal model.Proposal
	if err := repository.DB.First(&proposal, proposalID).Error; err != nil {
		return nil, errors.New("方案不存在")
	}

	if proposal.DesignerID != designerID {
		return nil, errors.New("无权查看此方案")
	}

	result := map[string]interface{}{
		"rejectionCount":  proposal.RejectionCount,
		"rejectionReason": proposal.RejectionReason,
		"canResubmit":     proposal.Status == model.ProposalStatusRejected && proposal.RejectionCount < 3,
		"maxRejections":   3,
		"rejectedAt":      proposal.RejectedAt,
	}

	return result, nil
}

// RejectProposalInput 拒绝方案入参
type RejectProposalInput struct {
	Reason string `json:"reason" binding:"required,min=5,max=500"` // 拒绝原因
}

// RejectProposal 用户拒绝方案（支持版本管理）
func (s *ProposalService) RejectProposal(userID, proposalID uint64, input *RejectProposalInput) error {
	var proposal model.Proposal
	if err := repository.DB.First(&proposal, proposalID).Error; err != nil {
		return errors.New("方案不存在")
	}
	var booking model.Booking
	var demand model.Demand
	if proposal.SourceType == model.ProposalSourceDemand {
		if err := repository.DB.First(&demand, proposal.DemandID).Error; err != nil {
			return errors.New("关联需求不存在")
		}
		if demand.UserID != userID {
			return errors.New("无权操作此方案")
		}
	} else {
		if err := repository.DB.First(&booking, proposal.BookingID).Error; err != nil {
			return errors.New("预约记录不存在")
		}
		if booking.UserID != userID {
			return errors.New("无权操作此方案")
		}
	}

	if proposal.Status != model.ProposalStatusPending {
		return errors.New("方案状态不正确")
	}

	// 查询该预约的累计拒绝次数（包括当前版本）
	var totalRejections int64
	query := repository.DB.Model(&model.Proposal{}).Where("status = ?", model.ProposalStatusRejected)
	if proposal.SourceType == model.ProposalSourceDemand {
		query = query.Where("demand_id = ?", proposal.DemandID)
	} else {
		query = query.Where("booking_id = ?", proposal.BookingID)
	}
	query.Count(&totalRejections)

	newRejectionCount := int(totalRejections) + 1

	// 更新方案状态为已拒绝
	now := time.Now()
	proposal.Status = model.ProposalStatusRejected
	proposal.RejectionReason = input.Reason
	proposal.RejectedAt = &now
	proposal.RejectionCount = newRejectionCount

	if err := repository.DB.Save(&proposal).Error; err != nil {
		return err
	}

	if proposal.SourceType == model.ProposalSourceDemand {
		notifService := &NotificationService{}
		var provider model.Provider
		if err := repository.DB.First(&provider, proposal.DesignerID).Error; err == nil {
			proposalData := map[string]interface{}{
				"id":             proposal.ID,
				"version":        proposal.Version,
				"rejectionCount": newRejectionCount,
				"canResubmit":    newRejectionCount < 3,
			}
			_ = notifService.NotifyProposalRejected(proposalData, provider.UserID, input.Reason)
		}
		return nil
	}

	// 如果达到3次拒绝，转入争议处理（不再自动退款）
	if newRejectionCount >= 3 {
		// 更新预约状态为争议中（status=5）
		booking.Status = 5 // Disputed - 争议中
		repository.DB.Save(&booking)

		// 通知商家方案被拒绝且已达上限，等待平台介入
		notifService := &NotificationService{}
		var provider model.Provider
		if err := repository.DB.First(&provider, booking.ProviderID).Error; err == nil {
			proposalData := map[string]interface{}{
				"id":             proposal.ID,
				"rejectionCount": newRejectionCount,
				"canResubmit":    false,
				"disputed":       true,
			}
			_ = notifService.NotifyProposalRejected(proposalData, provider.UserID, "用户连续拒绝3次，预约已转入争议处理，请等待平台客服联系")
		}

		// 通知用户预约已转入争议处理
		userNotification := &model.Notification{
			UserID:  userID,
			Type:    "booking_dispute",
			Title:   "预约已转入争议处理",
			Content: "您已连续拒绝3次设计方案，预约已转入平台争议处理，客服将尽快与您联系协调。",
			IsRead:  false,
		}
		repository.DB.Create(userNotification)
	} else {
		// 通知商家方案被拒绝
		notifService := &NotificationService{}
		var provider model.Provider
		if err := repository.DB.First(&provider, booking.ProviderID).Error; err == nil {
			proposalData := map[string]interface{}{
				"id":             proposal.ID,
				"rejectionCount": newRejectionCount,
				"canResubmit":    newRejectionCount < 3,
			}
			_ = notifService.NotifyProposalRejected(proposalData, provider.UserID, input.Reason)
		}
	}

	return nil
}

// ListProposalsByDesigner 设计师获取自己提交的方案列表
func (s *ProposalService) ListProposalsByDesigner(designerID uint64) ([]model.Proposal, error) {
	var proposals []model.Proposal
	if err := repository.DB.Where("designer_id = ?", designerID).Order("created_at DESC").Find(&proposals).Error; err != nil {
		return nil, err
	}
	return proposals, nil
}

// ListProposalsByUser 用户获取收到的方案列表
func (s *ProposalService) ListProposalsByUser(userID uint64) ([]model.Proposal, error) {
	var bookingIDs []uint64
	if err := repository.DB.Model(&model.Booking{}).Where("user_id = ?", userID).Pluck("id", &bookingIDs).Error; err != nil {
		return nil, err
	}
	var demandIDs []uint64
	if err := repository.DB.Model(&model.Demand{}).Where("user_id = ?", userID).Pluck("id", &demandIDs).Error; err != nil {
		return nil, err
	}
	var proposals []model.Proposal
	query := repository.DB.Model(&model.Proposal{})
	switch {
	case len(bookingIDs) > 0 && len(demandIDs) > 0:
		query = query.Where("(source_type = ? AND booking_id IN ?) OR (source_type = ? AND demand_id IN ?)",
			model.ProposalSourceBooking, bookingIDs, model.ProposalSourceDemand, demandIDs)
	case len(bookingIDs) > 0:
		query = query.Where("source_type = ? AND booking_id IN ?", model.ProposalSourceBooking, bookingIDs)
	case len(demandIDs) > 0:
		query = query.Where("source_type = ? AND demand_id IN ?", model.ProposalSourceDemand, demandIDs)
	default:
		return []model.Proposal{}, nil
	}
	if err := query.Order("created_at DESC").Find(&proposals).Error; err != nil {
		return nil, err
	}
	return proposals, nil
}

// GetPendingCount 获取用户待处理的方案数量
func (s *ProposalService) GetPendingCount(userID uint64) (int64, error) {
	var bookingIDs []uint64
	if err := repository.DB.Model(&model.Booking{}).Where("user_id = ?", userID).Pluck("id", &bookingIDs).Error; err != nil {
		return 0, err
	}
	var demandIDs []uint64
	if err := repository.DB.Model(&model.Demand{}).Where("user_id = ?", userID).Pluck("id", &demandIDs).Error; err != nil {
		return 0, err
	}
	var count int64
	query := repository.DB.Model(&model.Proposal{}).Where("status = ?", model.ProposalStatusPending)
	switch {
	case len(bookingIDs) > 0 && len(demandIDs) > 0:
		query = query.Where("(source_type = ? AND booking_id IN ?) OR (source_type = ? AND demand_id IN ?)",
			model.ProposalSourceBooking, bookingIDs, model.ProposalSourceDemand, demandIDs)
	case len(bookingIDs) > 0:
		query = query.Where("source_type = ? AND booking_id IN ?", model.ProposalSourceBooking, bookingIDs)
	case len(demandIDs) > 0:
		query = query.Where("source_type = ? AND demand_id IN ?", model.ProposalSourceDemand, demandIDs)
	default:
		return 0, nil
	}
	if err := query.Count(&count).Error; err != nil {
		return 0, err
	}
	return count, nil
}

// ReopenProposal 商家重新发起方案（将已确认的方案重置为待确认）
func (s *ProposalService) ReopenProposal(designerID, proposalID uint64) error {
	var proposal model.Proposal
	if err := repository.DB.First(&proposal, proposalID).Error; err != nil {
		return errors.New("方案不存在")
	}

	// 验证归属
	if proposal.DesignerID != designerID {
		return errors.New("无权操作此方案")
	}

	// 只有已确认的方案才能重新发起
	if proposal.Status != model.ProposalStatusConfirmed {
		return errors.New("只有已确认的方案才能重新发起")
	}

	// 检查是否存在有效订单（Pending 或 Paid）
	var activeOrder model.Order
	if err := repository.DB.Where("proposal_id = ? AND status IN ?", proposalID,
		[]int8{model.OrderStatusPending, model.OrderStatusPaid}).First(&activeOrder).Error; err == nil {
		// 存在有效订单
		if activeOrder.Status == model.OrderStatusPending {
			return errors.New("当前存在待支付订单，无法重新发起")
		}
		if activeOrder.Status == model.OrderStatusPaid {
			return errors.New("订单已支付，无法重新发起")
		}
	}

	// 重置方案状态为待确认
	proposal.Status = model.ProposalStatusPending
	proposal.ConfirmedAt = nil

	return repository.DB.Save(&proposal).Error
}
