package service

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"

	"gorm.io/gorm"
)

// ProposalService 设计方案服务
type ProposalService struct{}

type ProposalInternalDraftInput struct {
	CommunicationNotes string   `json:"communicationNotes"`
	SketchImages       []string `json:"sketchImages"`
	InitialBudgetNotes string   `json:"initialBudgetNotes"`
	CadSourceFiles     []string `json:"cadSourceFiles"`
}

type ProposalPreviewPackageInput struct {
	Summary             string   `json:"summary"`
	FloorPlanImages     []string `json:"floorPlanImages"`
	EffectPreviewImages []string `json:"effectPreviewImages"`
	EffectPreviewLinks  []string `json:"effectPreviewLinks"`
	HasCad              bool     `json:"hasCad"`
	HasAttachments      bool     `json:"hasAttachments"`
}

type ProposalDeliveryPackageInput struct {
	Description     string   `json:"description"`
	FloorPlanImages []string `json:"floorPlanImages"`
	EffectImages    []string `json:"effectImages"`
	EffectLinks     []string `json:"effectLinks"`
	CadFiles        []string `json:"cadFiles"`
	Attachments     []string `json:"attachments"`
}

// SubmitProposalInput 提交方案入参
type SubmitProposalInput struct {
	SourceType      string                       `json:"sourceType"`
	BookingID       uint64                       `json:"bookingId"`
	DemandMatchID   uint64                       `json:"demandMatchId"`
	Summary         string                       `json:"summary"`
	DesignFee       float64                      `json:"designFee" binding:"required"`
	ConstructionFee float64                      `json:"constructionFee"`
	MaterialFee     float64                      `json:"materialFee"`
	EstimatedDays   int                          `json:"estimatedDays"`
	Attachments     string                       `json:"attachments"` // JSON array
	InternalDraft   ProposalInternalDraftInput   `json:"internalDraft"`
	PreviewPackage  ProposalPreviewPackageInput  `json:"previewPackage"`
	DeliveryPackage ProposalDeliveryPackageInput `json:"deliveryPackage"`
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
		Attachments:          normalizeStoredAssetJSONArray(input.Attachments),
		InternalDraftJSON:    marshalProposalJSON(buildInternalDraftPayload(input.InternalDraft)),
		PreviewPackageJSON:   marshalProposalJSON(buildPreviewPackagePayload(input.PreviewPackage, input.DeliveryPackage)),
		DeliveryPackageJSON:  marshalProposalJSON(buildDeliveryPackagePayload(input.DeliveryPackage, input.Attachments)),
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
			if err := NewDemandService().MarkMatchQuoted(tx, proposal); err != nil {
				return err
			}
			return businessFlowSvc.AdvanceBySource(tx, model.BusinessFlowSourceDemand, proposal.DemandID, map[string]interface{}{
				"current_stage":         model.BusinessFlowStageDesignPendingConfirmation,
				"confirmed_proposal_id": proposal.ID,
				"designer_provider_id":  designerID,
			})
		}
		_, err := businessFlowSvc.EnsureLeadFlow(tx, model.BusinessFlowSourceBooking, proposal.BookingID, targetUserID, designerID)
		if err != nil {
			return err
		}
		return businessFlowSvc.AdvanceBySource(tx, model.BusinessFlowSourceBooking, proposal.BookingID, map[string]interface{}{
			"current_stage":         model.BusinessFlowStageDesignPendingConfirmation,
			"confirmed_proposal_id": proposal.ID,
			"designer_provider_id":  designerID,
		})
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

func normalizeProposalStringSlice(values []string) []string {
	result := make([]string, 0, len(values))
	seen := make(map[string]struct{}, len(values))
	for _, value := range values {
		trimmed := normalizeStoredAsset(value)
		if trimmed == "" {
			continue
		}
		if _, exists := seen[trimmed]; exists {
			continue
		}
		seen[trimmed] = struct{}{}
		result = append(result, trimmed)
	}
	return result
}

func buildInternalDraftPayload(input ProposalInternalDraftInput) map[string]interface{} {
	return map[string]interface{}{
		"communicationNotes": strings.TrimSpace(input.CommunicationNotes),
		"sketchImages":       normalizeProposalStringSlice(input.SketchImages),
		"initialBudgetNotes": strings.TrimSpace(input.InitialBudgetNotes),
		"cadSourceFiles":     normalizeProposalStringSlice(input.CadSourceFiles),
	}
}

func buildPreviewPackagePayload(preview ProposalPreviewPackageInput, delivery ProposalDeliveryPackageInput) map[string]interface{} {
	floorPlans := normalizeProposalStringSlice(preview.FloorPlanImages)
	if len(floorPlans) == 0 {
		floorPlans = normalizeProposalStringSlice(delivery.FloorPlanImages)
	}
	return map[string]interface{}{
		"summary":             strings.TrimSpace(preview.Summary),
		"floorPlanImages":     floorPlans,
		"effectPreviewImages": normalizeProposalStringSlice(preview.EffectPreviewImages),
		"effectPreviewLinks":  normalizeProposalStringSlice(preview.EffectPreviewLinks),
		"hasCad":              preview.HasCad || len(normalizeProposalStringSlice(delivery.CadFiles)) > 0,
		"hasAttachments":      preview.HasAttachments || len(normalizeProposalStringSlice(delivery.Attachments)) > 0,
	}
}

func buildDeliveryPackagePayload(delivery ProposalDeliveryPackageInput, fallbackAttachments string) map[string]interface{} {
	attachments := normalizeProposalStringSlice(delivery.Attachments)
	if len(attachments) == 0 && strings.TrimSpace(fallbackAttachments) != "" {
		var parsed []string
		if err := json.Unmarshal([]byte(fallbackAttachments), &parsed); err == nil {
			attachments = normalizeProposalStringSlice(parsed)
		}
	}
	return map[string]interface{}{
		"description":     strings.TrimSpace(delivery.Description),
		"floorPlanImages": normalizeProposalStringSlice(delivery.FloorPlanImages),
		"effectImages":    normalizeProposalStringSlice(delivery.EffectImages),
		"effectLinks":     normalizeProposalStringSlice(delivery.EffectLinks),
		"cadFiles":        normalizeProposalStringSlice(delivery.CadFiles),
		"attachments":     attachments,
	}
}

func marshalProposalJSON(value interface{}) string {
	raw, err := json.Marshal(value)
	if err != nil {
		return "{}"
	}
	return string(raw)
}

func hydrateProposalAssets(proposal *model.Proposal) {
	if proposal == nil {
		return
	}

	proposal.Attachments = hydrateAssetJSONArray(proposal.Attachments)
	proposal.InternalDraftJSON = hydrateAssetJSONMap(proposal.InternalDraftJSON, "sketchImages", "cadSourceFiles")
	proposal.PreviewPackageJSON = hydrateAssetJSONMap(proposal.PreviewPackageJSON, "floorPlanImages", "effectPreviewImages", "effectPreviewLinks")
	proposal.DeliveryPackageJSON = hydrateAssetJSONMap(proposal.DeliveryPackageJSON, "floorPlanImages", "effectImages", "effectLinks", "cadFiles", "attachments")
}

// GetProposal 获取方案详情
func (s *ProposalService) GetProposal(proposalID uint64) (*model.Proposal, error) {
	var proposal model.Proposal
	if err := repository.DB.First(&proposal, proposalID).Error; err != nil {
		return nil, errors.New("方案不存在")
	}
	hydrateProposalAssets(&proposal)
	return &proposal, nil
}

// GetProposalByBooking 根据预约获取方案
func (s *ProposalService) GetProposalByBooking(bookingID uint64) (*model.Proposal, error) {
	var proposal model.Proposal
	if err := repository.DB.Where("booking_id = ?", bookingID).First(&proposal).Error; err != nil {
		return nil, errors.New("方案不存在")
	}
	hydrateProposalAssets(&proposal)
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
	auditService := &AuditLogService{}
	beforeState := map[string]interface{}{
		"proposal": map[string]interface{}{
			"id":        proposal.ID,
			"status":    proposal.Status,
			"bookingId": proposal.BookingID,
			"designFee": proposal.DesignFee,
		},
		"booking": map[string]interface{}{
			"id":            booking.ID,
			"status":        booking.Status,
			"intentFeePaid": booking.IntentFeePaid,
			"providerId":    booking.ProviderID,
		},
	}

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

	designPaymentMode := configSvc.GetDesignFeePaymentMode()
	if designPaymentMode == "staged" {
		stages, _ := configSvc.GetDesignFeeStages()
		for index, stage := range stages {
			plan := model.PaymentPlan{
				OrderID:    order.ID,
				Type:       "design_stage",
				Seq:        index + 1,
				Name:       stage.Name,
				Percentage: stage.Percentage,
				Amount:     order.TotalAmount * float64(stage.Percentage) / 100,
				Status:     0,
			}
			if err := tx.Create(&plan).Error; err != nil {
				tx.Rollback()
				return nil, err
			}
		}
	} else {
		plan := model.PaymentPlan{
			OrderID:    order.ID,
			Type:       "onetime",
			Seq:        1,
			Name:       "设计费全款",
			Percentage: 100,
			Amount:     order.TotalAmount,
			Status:     0,
		}
		if err := tx.Create(&plan).Error; err != nil {
			tx.Rollback()
			return nil, err
		}
	}

	if _, err := businessFlowSvc.EnsureLeadFlow(tx, model.BusinessFlowSourceBooking, booking.ID, userID, booking.ProviderID); err != nil {
		tx.Rollback()
		return nil, err
	}
	if err := businessFlowSvc.AdvanceBySource(tx, model.BusinessFlowSourceBooking, booking.ID, map[string]interface{}{
		"current_stage":         model.BusinessFlowStageConstructionPartyPending,
		"confirmed_proposal_id": proposal.ID,
		"designer_provider_id":  booking.ProviderID,
		"project_id":            0,
	}); err != nil {
		tx.Rollback()
		return nil, err
	}
	if err := auditService.CreateBusinessRecordTx(tx, &CreateAuditRecordInput{
		OperatorType:  "user",
		OperatorID:    userID,
		OperationType: "confirm_proposal",
		ResourceType:  "proposal",
		ResourceID:    proposal.ID,
		Result:        "success",
		BeforeState:   beforeState,
		AfterState: map[string]interface{}{
			"proposal": map[string]interface{}{
				"id":          proposal.ID,
				"status":      proposal.Status,
				"confirmedAt": proposal.ConfirmedAt,
			},
			"order": map[string]interface{}{
				"id":          order.ID,
				"orderType":   order.OrderType,
				"totalAmount": order.TotalAmount,
				"projectId":   order.ProjectID,
				"expireAt":    order.ExpireAt,
			},
		},
		Metadata: map[string]interface{}{
			"bookingId":  booking.ID,
			"providerId": booking.ProviderID,
			"projectId":  0,
		},
	}); err != nil {
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

func (s *ProposalService) AdminConfirmProposal(adminID, proposalID uint64, reason string) (*model.Order, error) {
	reason = strings.TrimSpace(reason)
	if reason == "" {
		return nil, errors.New("请填写操作原因")
	}

	var proposal model.Proposal
	if err := repository.DB.First(&proposal, proposalID).Error; err != nil {
		return nil, errors.New("方案不存在")
	}
	if proposal.SourceType == model.ProposalSourceDemand {
		return nil, errors.New("需求报价确认将在下一阶段开放")
	}

	var booking model.Booking
	if err := repository.DB.First(&booking, proposal.BookingID).Error; err != nil {
		return nil, errors.New("预约记录不存在")
	}
	if proposal.Status != model.ProposalStatusPending {
		return nil, errors.New("方案状态不正确")
	}

	var existingOrder model.Order
	if err := repository.DB.Where("proposal_id = ? AND order_type = ? AND status = ?",
		proposalID, model.OrderTypeDesign, model.OrderStatusPending).First(&existingOrder).Error; err == nil {
		if existingOrder.ExpireAt != nil && existingOrder.ExpireAt.After(time.Now()) {
			return &existingOrder, nil
		}
		repository.DB.Model(&existingOrder).Update("status", model.OrderStatusCancelled)
	}

	tx := repository.DB.Begin()
	auditService := &AuditLogService{}
	beforeState := map[string]interface{}{
		"proposal": map[string]interface{}{
			"id":        proposal.ID,
			"status":    proposal.Status,
			"bookingId": proposal.BookingID,
			"designFee": proposal.DesignFee,
		},
		"booking": map[string]interface{}{
			"id":            booking.ID,
			"status":        booking.Status,
			"intentFeePaid": booking.IntentFeePaid,
			"providerId":    booking.ProviderID,
		},
	}

	now := time.Now()
	expireAt := now.Add(48 * time.Hour)
	proposal.Status = model.ProposalStatusConfirmed
	proposal.ConfirmedAt = &now
	if err := tx.Save(&proposal).Error; err != nil {
		tx.Rollback()
		return nil, err
	}

	discount := 0.0
	if booking.IntentFeePaid {
		discount = booking.IntentFee
	}
	totalAmount := proposal.DesignFee - discount
	if totalAmount < 0 {
		totalAmount = 0
	}

	order := &model.Order{
		ProposalID:  proposalID,
		BookingID:   proposal.BookingID,
		OrderNo:     generateOrderNo("DF"),
		OrderType:   model.OrderTypeDesign,
		TotalAmount: totalAmount,
		Discount:    discount,
		Status:      model.OrderStatusPending,
		ExpireAt:    &expireAt,
	}
	if err := tx.Create(order).Error; err != nil {
		tx.Rollback()
		return nil, err
	}

	designPaymentMode := configSvc.GetDesignFeePaymentMode()
	if designPaymentMode == "staged" {
		stages, _ := configSvc.GetDesignFeeStages()
		for index, stage := range stages {
			plan := model.PaymentPlan{
				OrderID:    order.ID,
				Type:       "design_stage",
				Seq:        index + 1,
				Name:       stage.Name,
				Percentage: stage.Percentage,
				Amount:     order.TotalAmount * float64(stage.Percentage) / 100,
				Status:     0,
			}
			if err := tx.Create(&plan).Error; err != nil {
				tx.Rollback()
				return nil, err
			}
		}
	} else {
		plan := model.PaymentPlan{
			OrderID:    order.ID,
			Type:       "onetime",
			Seq:        1,
			Name:       "设计费全款",
			Percentage: 100,
			Amount:     order.TotalAmount,
			Status:     0,
		}
		if err := tx.Create(&plan).Error; err != nil {
			tx.Rollback()
			return nil, err
		}
	}

	if _, err := businessFlowSvc.EnsureLeadFlow(tx, model.BusinessFlowSourceBooking, booking.ID, booking.UserID, booking.ProviderID); err != nil {
		tx.Rollback()
		return nil, err
	}
	if err := businessFlowSvc.AdvanceBySource(tx, model.BusinessFlowSourceBooking, booking.ID, map[string]interface{}{
		"current_stage":         model.BusinessFlowStageConstructionPartyPending,
		"confirmed_proposal_id": proposal.ID,
		"designer_provider_id":  booking.ProviderID,
		"project_id":            0,
	}); err != nil {
		tx.Rollback()
		return nil, err
	}
	if err := auditService.CreateBusinessRecordTx(tx, &CreateAuditRecordInput{
		OperatorType:  "admin",
		OperatorID:    adminID,
		OperationType: "confirm_proposal",
		ResourceType:  "proposal",
		ResourceID:    proposal.ID,
		Reason:        reason,
		Result:        "success",
		BeforeState:   beforeState,
		AfterState: map[string]interface{}{
			"proposal": map[string]interface{}{
				"id":          proposal.ID,
				"status":      proposal.Status,
				"confirmedAt": proposal.ConfirmedAt,
			},
			"order": map[string]interface{}{
				"id":          order.ID,
				"orderType":   order.OrderType,
				"totalAmount": order.TotalAmount,
				"projectId":   order.ProjectID,
				"expireAt":    order.ExpireAt,
			},
		},
		Metadata: map[string]interface{}{
			"bookingId":  booking.ID,
			"providerId": booking.ProviderID,
			"projectId":  0,
		},
	}); err != nil {
		tx.Rollback()
		return nil, err
	}

	tx.Commit()

	notifService := &NotificationService{}
	proposalData := map[string]interface{}{"id": proposal.ID}
	var provider model.Provider
	if err := repository.DB.First(&provider, booking.ProviderID).Error; err == nil {
		_ = notifService.NotifyProposalConfirmed(proposalData, provider.UserID)
	}

	return order, nil
}

// ResubmitProposalInput 重新提交方案入参
type ResubmitProposalInput struct {
	ProposalID      uint64                       `json:"proposalId" binding:"required"`
	Summary         string                       `json:"summary"`
	DesignFee       float64                      `json:"designFee" binding:"required"`
	ConstructionFee float64                      `json:"constructionFee"`
	MaterialFee     float64                      `json:"materialFee"`
	EstimatedDays   int                          `json:"estimatedDays"`
	Attachments     string                       `json:"attachments"` // JSON array
	InternalDraft   ProposalInternalDraftInput   `json:"internalDraft"`
	PreviewPackage  ProposalPreviewPackageInput  `json:"previewPackage"`
	DeliveryPackage ProposalDeliveryPackageInput `json:"deliveryPackage"`
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

	// 2. 检查拒绝次数是否已超过可继续重提的上限
	if !canResubmitRejectedProposal(oldProposal.RejectionCount) {
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
		Attachments:          normalizeStoredAssetJSONArray(input.Attachments),
		InternalDraftJSON:    marshalProposalJSON(buildInternalDraftPayload(input.InternalDraft)),
		PreviewPackageJSON:   marshalProposalJSON(buildPreviewPackagePayload(input.PreviewPackage, input.DeliveryPackage)),
		DeliveryPackageJSON:  marshalProposalJSON(buildDeliveryPackagePayload(input.DeliveryPackage, input.Attachments)),
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
	for index := range proposals {
		hydrateProposalAssets(&proposals[index])
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
		"canResubmit":     proposal.Status == model.ProposalStatusRejected && canResubmitRejectedProposal(proposal.RejectionCount),
		"maxRejections":   proposalMaxNormalRejectRounds,
		"abnormalAfter":   proposalMaxNormalRejectRounds + 1,
		"rejectedAt":      proposal.RejectedAt,
	}

	return result, nil
}

// RejectProposalInput 拒绝方案入参
type RejectProposalInput struct {
	Reason string `json:"reason" binding:"required,min=5,max=500"` // 拒绝原因
}

const proposalMaxNormalRejectRounds = 3

func canResubmitRejectedProposal(rejectionCount int) bool {
	return rejectionCount <= proposalMaxNormalRejectRounds
}

type ProposalRejectResult struct {
	ProposalID          uint64 `json:"proposalId"`
	RejectionCount      int    `json:"rejectionCount"`
	CanResubmit         bool   `json:"canResubmit"`
	EnteredAbnormal     bool   `json:"enteredAbnormal"`
	RefundApplicationID uint64 `json:"refundApplicationId,omitempty"`
}

// RejectProposal 用户拒绝方案（支持版本管理）
func (s *ProposalService) RejectProposal(userID, proposalID uint64, input *RejectProposalInput) (*ProposalRejectResult, error) {
	var proposal model.Proposal
	if err := repository.DB.First(&proposal, proposalID).Error; err != nil {
		return nil, errors.New("方案不存在")
	}
	var booking model.Booking
	var demand model.Demand
	if proposal.SourceType == model.ProposalSourceDemand {
		if err := repository.DB.First(&demand, proposal.DemandID).Error; err != nil {
			return nil, errors.New("关联需求不存在")
		}
		if demand.UserID != userID {
			return nil, errors.New("无权操作此方案")
		}
	} else {
		if err := repository.DB.First(&booking, proposal.BookingID).Error; err != nil {
			return nil, errors.New("预约记录不存在")
		}
		if booking.UserID != userID {
			return nil, errors.New("无权操作此方案")
		}
	}

	if proposal.Status != model.ProposalStatusPending {
		return nil, errors.New("方案状态不正确")
	}

	var totalRejections int64
	query := repository.DB.Model(&model.Proposal{}).Where("status = ?", model.ProposalStatusRejected)
	if proposal.SourceType == model.ProposalSourceDemand {
		query = query.Where("demand_id = ?", proposal.DemandID)
	} else {
		query = query.Where("booking_id = ?", proposal.BookingID)
	}
	query.Count(&totalRejections)

	newRejectionCount := int(totalRejections) + 1
	enteredAbnormal := proposal.SourceType != model.ProposalSourceDemand && !canResubmitRejectedProposal(newRejectionCount)
	result := &ProposalRejectResult{
		ProposalID:      proposal.ID,
		RejectionCount:  newRejectionCount,
		CanResubmit:     canResubmitRejectedProposal(newRejectionCount),
		EnteredAbnormal: enteredAbnormal,
	}

	auditService := &AuditLogService{}
	beforeState := map[string]interface{}{
		"proposal": map[string]interface{}{
			"id":             proposal.ID,
			"status":         proposal.Status,
			"version":        proposal.Version,
			"rejectionCount": proposal.RejectionCount,
		},
	}
	if proposal.SourceType == model.ProposalSourceDemand {
		beforeState["demand"] = map[string]interface{}{
			"id":     demand.ID,
			"userId": demand.UserID,
			"status": demand.Status,
		}
	} else {
		beforeState["booking"] = map[string]interface{}{
			"id":     booking.ID,
			"userId": booking.UserID,
			"status": booking.Status,
		}
	}

	now := time.Now()
	proposal.Status = model.ProposalStatusRejected
	proposal.RejectionReason = input.Reason
	proposal.RejectedAt = &now
	proposal.RejectionCount = newRejectionCount

	if proposal.SourceType == model.ProposalSourceDemand {
		if err := repository.DB.Save(&proposal).Error; err != nil {
			return nil, err
		}
		afterState := map[string]interface{}{
			"proposal": map[string]interface{}{
				"id":             proposal.ID,
				"status":         proposal.Status,
				"version":        proposal.Version,
				"rejectionCount": proposal.RejectionCount,
				"rejectedAt":     proposal.RejectedAt,
			},
		}
		_ = auditService.CreateBusinessRecord(&CreateAuditRecordInput{
			OperatorType:  "user",
			OperatorID:    userID,
			OperationType: "reject_proposal",
			ResourceType:  "proposal",
			ResourceID:    proposal.ID,
			Reason:        input.Reason,
			Result:        "success",
			BeforeState:   beforeState,
			AfterState:    afterState,
			Metadata: map[string]interface{}{
				"demandId":        demand.ID,
				"rejectionCount":  newRejectionCount,
				"enteredAbnormal": false,
			},
		})
		notifService := &NotificationService{}
		var provider model.Provider
		if err := repository.DB.First(&provider, proposal.DesignerID).Error; err == nil {
			proposalData := map[string]interface{}{
				"id":             proposal.ID,
				"version":        proposal.Version,
				"rejectionCount": newRejectionCount,
				"canResubmit":    result.CanResubmit,
			}
			_ = notifService.NotifyProposalRejected(proposalData, provider.UserID, input.Reason)
		}
		return result, nil
	}

	var abnormalRefund *model.RefundApplication
	err := repository.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Save(&proposal).Error; err != nil {
			return err
		}

		afterState := map[string]interface{}{
			"proposal": map[string]interface{}{
				"id":             proposal.ID,
				"status":         proposal.Status,
				"version":        proposal.Version,
				"rejectionCount": proposal.RejectionCount,
				"rejectedAt":     proposal.RejectedAt,
			},
		}
		metadata := map[string]interface{}{
			"bookingId":       booking.ID,
			"providerId":      booking.ProviderID,
			"rejectionCount":  newRejectionCount,
			"enteredAbnormal": enteredAbnormal,
			"proposalVersion": proposal.Version,
		}

		if enteredAbnormal {
			project, err := findProjectByBookingTx(tx, booking.ID)
			if err != nil {
				return err
			}
			abnormalReason := "设计方案改稿超过 3 轮，转入异常订单处理：" + strings.TrimSpace(input.Reason)
			abnormalRefund, err = ensurePendingAbnormalRefundApplicationTx(tx, &booking, project, booking.UserID, abnormalReason)
			if err != nil {
				return err
			}
			if err := markRefundLifecycleDisputedTx(tx, &booking, project, abnormalReason); err != nil {
				return err
			}
			afterState["booking"] = map[string]interface{}{
				"id":     booking.ID,
				"userId": booking.UserID,
				"status": 5,
			}
			if abnormalRefund != nil {
				result.RefundApplicationID = abnormalRefund.ID
				afterState["refundApplication"] = map[string]interface{}{
					"id":              abnormalRefund.ID,
					"refundType":      abnormalRefund.RefundType,
					"requestedAmount": abnormalRefund.RequestedAmount,
					"status":          abnormalRefund.Status,
				}
				metadata["refundApplicationId"] = abnormalRefund.ID
			}
		}

		return auditService.CreateBusinessRecordTx(tx, &CreateAuditRecordInput{
			OperatorType:  "user",
			OperatorID:    userID,
			OperationType: "reject_proposal",
			ResourceType:  "proposal",
			ResourceID:    proposal.ID,
			Reason:        input.Reason,
			Result:        "success",
			BeforeState:   beforeState,
			AfterState:    afterState,
			Metadata:      metadata,
		})
	})
	if err != nil {
		return nil, err
	}

	notifService := &NotificationService{}
	var provider model.Provider
	if err := repository.DB.First(&provider, booking.ProviderID).Error; err == nil {
		proposalData := map[string]interface{}{
			"id":             proposal.ID,
			"rejectionCount": newRejectionCount,
			"canResubmit":    result.CanResubmit,
			"disputed":       enteredAbnormal,
		}
		rejectReason := input.Reason
		if enteredAbnormal {
			rejectReason = "方案修改次数已超上限，订单已转异常处理，等待平台介入"
		}
		_ = notifService.NotifyProposalRejected(proposalData, provider.UserID, rejectReason)
	}
	if enteredAbnormal {
		_ = notifService.Create(&CreateNotificationInput{
			UserID:      userID,
			UserType:    "user",
			Title:       "方案已转异常订单",
			Content:     "当前设计方案已超过可打回次数，平台将介入处理后续退款与履约问题。",
			Type:        "proposal.abnormal",
			RelatedID:   proposal.ID,
			RelatedType: "proposal",
		})
		if abnormalRefund != nil {
			_ = notifService.NotifyAdmins(&CreateNotificationInput{
				Title:       "设计前异常订单待处理",
				Content:     "方案改稿超过 3 轮，已自动创建异常退款申请，待平台审核。",
				Type:        "refund.application.created",
				RelatedID:   abnormalRefund.ID,
				RelatedType: "refund_application",
				ActionURL:   fmt.Sprintf("/admin/refunds/%d", abnormalRefund.ID),
			})
		}
	}

	return result, nil
}

func (s *ProposalService) AdminRejectProposal(adminID, proposalID uint64, input *RejectProposalInput) (*ProposalRejectResult, error) {
	if input == nil {
		return nil, errors.New("参数不能为空")
	}
	reason := strings.TrimSpace(input.Reason)
	if reason == "" {
		return nil, errors.New("请填写驳回原因")
	}

	var proposal model.Proposal
	if err := repository.DB.First(&proposal, proposalID).Error; err != nil {
		return nil, errors.New("方案不存在")
	}
	var booking model.Booking
	var demand model.Demand
	if proposal.SourceType == model.ProposalSourceDemand {
		if err := repository.DB.First(&demand, proposal.DemandID).Error; err != nil {
			return nil, errors.New("关联需求不存在")
		}
	} else {
		if err := repository.DB.First(&booking, proposal.BookingID).Error; err != nil {
			return nil, errors.New("预约记录不存在")
		}
	}
	if proposal.Status != model.ProposalStatusPending {
		return nil, errors.New("方案状态不正确")
	}

	var totalRejections int64
	query := repository.DB.Model(&model.Proposal{}).Where("status = ?", model.ProposalStatusRejected)
	if proposal.SourceType == model.ProposalSourceDemand {
		query = query.Where("demand_id = ?", proposal.DemandID)
	} else {
		query = query.Where("booking_id = ?", proposal.BookingID)
	}
	query.Count(&totalRejections)

	newRejectionCount := int(totalRejections) + 1
	enteredAbnormal := proposal.SourceType != model.ProposalSourceDemand && !canResubmitRejectedProposal(newRejectionCount)
	result := &ProposalRejectResult{
		ProposalID:      proposal.ID,
		RejectionCount:  newRejectionCount,
		CanResubmit:     canResubmitRejectedProposal(newRejectionCount),
		EnteredAbnormal: enteredAbnormal,
	}

	auditService := &AuditLogService{}
	beforeState := map[string]interface{}{
		"proposal": map[string]interface{}{
			"id":             proposal.ID,
			"status":         proposal.Status,
			"version":        proposal.Version,
			"rejectionCount": proposal.RejectionCount,
		},
	}
	if proposal.SourceType == model.ProposalSourceDemand {
		beforeState["demand"] = map[string]interface{}{
			"id":     demand.ID,
			"userId": demand.UserID,
			"status": demand.Status,
		}
	} else {
		beforeState["booking"] = map[string]interface{}{
			"id":     booking.ID,
			"userId": booking.UserID,
			"status": booking.Status,
		}
	}

	now := time.Now()
	proposal.Status = model.ProposalStatusRejected
	proposal.RejectionReason = reason
	proposal.RejectedAt = &now
	proposal.RejectionCount = newRejectionCount

	if proposal.SourceType == model.ProposalSourceDemand {
		if err := repository.DB.Save(&proposal).Error; err != nil {
			return nil, err
		}
		afterState := map[string]interface{}{
			"proposal": map[string]interface{}{
				"id":             proposal.ID,
				"status":         proposal.Status,
				"version":        proposal.Version,
				"rejectionCount": proposal.RejectionCount,
				"rejectedAt":     proposal.RejectedAt,
			},
		}
		_ = auditService.CreateBusinessRecord(&CreateAuditRecordInput{
			OperatorType:  "admin",
			OperatorID:    adminID,
			OperationType: "reject_proposal",
			ResourceType:  "proposal",
			ResourceID:    proposal.ID,
			Reason:        reason,
			Result:        "success",
			BeforeState:   beforeState,
			AfterState:    afterState,
			Metadata: map[string]interface{}{
				"demandId":        demand.ID,
				"rejectionCount":  newRejectionCount,
				"enteredAbnormal": false,
			},
		})
		notifService := &NotificationService{}
		var provider model.Provider
		if err := repository.DB.First(&provider, proposal.DesignerID).Error; err == nil {
			proposalData := map[string]interface{}{
				"id":             proposal.ID,
				"version":        proposal.Version,
				"rejectionCount": newRejectionCount,
				"canResubmit":    result.CanResubmit,
			}
			_ = notifService.NotifyProposalRejected(proposalData, provider.UserID, reason)
		}
		return result, nil
	}

	var abnormalRefund *model.RefundApplication
	err := repository.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Save(&proposal).Error; err != nil {
			return err
		}

		afterState := map[string]interface{}{
			"proposal": map[string]interface{}{
				"id":             proposal.ID,
				"status":         proposal.Status,
				"version":        proposal.Version,
				"rejectionCount": proposal.RejectionCount,
				"rejectedAt":     proposal.RejectedAt,
			},
		}
		metadata := map[string]interface{}{
			"bookingId":       booking.ID,
			"providerId":      booking.ProviderID,
			"rejectionCount":  newRejectionCount,
			"enteredAbnormal": enteredAbnormal,
			"proposalVersion": proposal.Version,
		}

		if enteredAbnormal {
			project, err := findProjectByBookingTx(tx, booking.ID)
			if err != nil {
				return err
			}
			abnormalReason := "设计方案改稿超过 3 轮，转入异常订单处理：" + reason
			abnormalRefund, err = ensurePendingAbnormalRefundApplicationTx(tx, &booking, project, booking.UserID, abnormalReason)
			if err != nil {
				return err
			}
			if err := markRefundLifecycleDisputedTx(tx, &booking, project, abnormalReason); err != nil {
				return err
			}
			afterState["booking"] = map[string]interface{}{
				"id":     booking.ID,
				"userId": booking.UserID,
				"status": 5,
			}
			if abnormalRefund != nil {
				result.RefundApplicationID = abnormalRefund.ID
				afterState["refundApplication"] = map[string]interface{}{
					"id":              abnormalRefund.ID,
					"refundType":      abnormalRefund.RefundType,
					"requestedAmount": abnormalRefund.RequestedAmount,
					"status":          abnormalRefund.Status,
				}
				metadata["refundApplicationId"] = abnormalRefund.ID
			}
		}

		return auditService.CreateBusinessRecordTx(tx, &CreateAuditRecordInput{
			OperatorType:  "admin",
			OperatorID:    adminID,
			OperationType: "reject_proposal",
			ResourceType:  "proposal",
			ResourceID:    proposal.ID,
			Reason:        reason,
			Result:        "success",
			BeforeState:   beforeState,
			AfterState:    afterState,
			Metadata:      metadata,
		})
	})
	if err != nil {
		return nil, err
	}

	notifService := &NotificationService{}
	var provider model.Provider
	if err := repository.DB.First(&provider, booking.ProviderID).Error; err == nil {
		proposalData := map[string]interface{}{
			"id":             proposal.ID,
			"rejectionCount": newRejectionCount,
			"canResubmit":    result.CanResubmit,
			"disputed":       enteredAbnormal,
		}
		_ = notifService.NotifyProposalRejected(proposalData, provider.UserID, reason)
	}

	return result, nil
}

// ListProposalsByDesigner 设计师获取自己提交的方案列表
func (s *ProposalService) ListProposalsByDesigner(designerID uint64) ([]model.Proposal, error) {
	var proposals []model.Proposal
	if err := repository.DB.Where("designer_id = ?", designerID).Order("created_at DESC").Find(&proposals).Error; err != nil {
		return nil, err
	}
	for index := range proposals {
		hydrateProposalAssets(&proposals[index])
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
	for index := range proposals {
		hydrateProposalAssets(&proposals[index])
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
