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
	"gorm.io/gorm/clause"
)

// DesignPaymentService 设计付款工作流服务
type DesignPaymentService struct{}

var incomeService = &MerchantIncomeService{}
var designPaymentNotificationSvc = &NotificationService{}

type DesignFeeQuoteView struct {
	Quote *model.DesignFeeQuote `json:"quote"`
	Order *model.Order          `json:"order,omitempty"`
}

// ---------------------------------------------------------------------------
// Input structs
// ---------------------------------------------------------------------------

// UploadWorkingDocInput 上传工作文档入参
type UploadWorkingDocInput struct {
	DocType     string `json:"docType" binding:"required"`
	Title       string `json:"title" binding:"required"`
	Description string `json:"description"`
	Files       string `json:"files"` // JSON array
}

// CreateDesignFeeQuoteInput 创建设计费报价入参
type CreateDesignFeeQuoteInput struct {
	TotalFee    float64 `json:"totalFee" binding:"required"`
	Description string  `json:"description"`
	PaymentMode string  `json:"paymentMode"` // onetime | staged
	StagesJSON  string  `json:"stagesJson"`  // [{seq, name, percentage, amount}]
}

// SubmitDeliverableInput 提交设计交付物入参
type SubmitDeliverableInput struct {
	BookingID       uint64 `json:"bookingId" binding:"required"`
	ProjectID       uint64 `json:"projectId"`
	OrderID         uint64 `json:"orderId"`
	ColorFloorPlan  string `json:"colorFloorPlan"`
	Renderings      string `json:"renderings"`
	RenderingLink   string `json:"renderingLink"`
	TextDescription string `json:"textDescription"`
	CADDrawings     string `json:"cadDrawings"`
	Attachments     string `json:"attachments"`
}

// ---------------------------------------------------------------------------
// 1. PaySurveyDeposit 支付量房定金
// ---------------------------------------------------------------------------

func (s *DesignPaymentService) PaySurveyDeposit(userID, bookingID uint64) (*model.Booking, error) {
	var booking model.Booking
	if err := repository.DB.First(&booking, bookingID).Error; err != nil {
		return nil, errors.New("预约不存在")
	}
	if booking.UserID != userID {
		return nil, errors.New("无权操作此预约")
	}

	// 幂等：已支付直接返回
	if booking.SurveyDepositPaid {
		return &booking, nil
	}

	// 计算定金金额：设计师个人价 > 系统默认
	depositAmount, err := configSvc.GetSurveyDepositDefault()
	if err != nil {
		depositAmount = 500
	}
	var provider model.Provider
	if err := repository.DB.First(&provider, booking.ProviderID).Error; err == nil {
		if provider.SurveyDepositPrice > 0 {
			depositAmount = provider.SurveyDepositPrice
		}
	}

	now := time.Now()

	if err := repository.DB.Transaction(func(tx *gorm.DB) error {
		// 更新 booking
		if err := tx.Model(&booking).Updates(map[string]interface{}{
			"survey_deposit":         depositAmount,
			"survey_deposit_paid":    true,
			"survey_deposit_paid_at": now,
		}).Error; err != nil {
			return err
		}

		// 创建交易记录
		txn := model.Transaction{
			OrderID:    fmt.Sprintf("SD-%d-%d", bookingID, now.Unix()),
			Type:       "deposit",
			Amount:     depositAmount,
			FromUserID: userID,
			Status:     1, // 成功
			Remark:     "survey_deposit",
		}
		if err := tx.Create(&txn).Error; err != nil {
			return err
		}

		// 推进业务流到 survey_deposit_pending
		return businessFlowSvc.AdvanceBySource(tx, model.BusinessFlowSourceBooking, bookingID, map[string]interface{}{
			"current_stage": model.BusinessFlowStageSurveyDepositPending,
		})
	}); err != nil {
		return nil, err
	}

	// 重新读取最新状态
	repository.DB.First(&booking, bookingID)
	return &booking, nil
}

// ---------------------------------------------------------------------------
// 2. RefundSurveyDeposit 退还量房费
// ---------------------------------------------------------------------------

func (s *DesignPaymentService) RefundSurveyDeposit(userID, bookingID uint64) (string, error) {
	paymentService := NewPaymentService(nil)
	refundRate := configSvc.GetSurveyDepositRefundRate()
	var refundOrder model.RefundOrder

	err := repository.DB.Transaction(func(tx *gorm.DB) error {
		var booking model.Booking
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&booking, bookingID).Error; err != nil {
			return errors.New("预约不存在")
		}
		if booking.UserID != userID {
			return errors.New("无权操作此预约")
		}
		if !booking.SurveyDepositPaid {
			return errors.New("量房费未支付，无法退款")
		}
		if booking.SurveyDepositRefunded {
			return errors.New("量房费已退款，请勿重复操作")
		}

		paymentOrder, err := paymentService.findPaidPaymentOrderTx(tx, model.PaymentBizTypeBookingSurveyDeposit, booking.ID)
		if err != nil {
			return err
		}

		var existing model.RefundOrder
		if err := tx.Where("payment_order_id = ? AND status IN ?", paymentOrder.ID, []string{
			model.RefundOrderStatusCreated,
			model.RefundOrderStatusProcessing,
			model.RefundOrderStatusSucceeded,
		}).Order("id DESC").First(&existing).Error; err == nil {
			refundOrder = existing
			return nil
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}

		refundAmount := normalizeAmount(booking.SurveyDeposit * refundRate)
		if refundAmount <= 0 || refundAmount > normalizeAmount(booking.SurveyDeposit) {
			return errors.New("量房费退款配置无效")
		}

		created, err := paymentService.createRefundOrderTx(tx, 0, refundExecutionPlan{
			PaymentOrderID: paymentOrder.ID,
			BizType:        model.PaymentBizTypeBookingSurveyDeposit,
			BizID:          booking.ID,
			Amount:         refundAmount,
			Reason:         "用户申请退还量房费",
		})
		if err != nil {
			return err
		}
		refundOrder = *created
		return nil
	})
	if err != nil {
		return "", err
	}

	if refundOrder.ID == 0 {
		return "", errors.New("退款单创建失败")
	}

	switch refundOrder.Status {
	case model.RefundOrderStatusCreated:
		updated, execErr := paymentService.ExecuteRefundOrder(refundOrder.ID)
		if updated != nil {
			refundOrder = *updated
		}
		if execErr != nil && refundOrder.Status != model.RefundOrderStatusProcessing {
			if strings.TrimSpace(refundOrder.FailureReason) != "" {
				return "", errors.New(refundOrder.FailureReason)
			}
			return "", execErr
		}
	case model.RefundOrderStatusFailed:
		if strings.TrimSpace(refundOrder.FailureReason) != "" {
			return "", errors.New(refundOrder.FailureReason)
		}
		return "", errors.New("量房费退款失败")
	}

	if refundOrder.Status == model.RefundOrderStatusSucceeded {
		completed, finalizeErr := paymentService.FinalizeRefundOrderIfReady(refundOrder.ID)
		if finalizeErr != nil {
			return "", finalizeErr
		}
		if completed {
			return "量房费退款成功", nil
		}
	}

	return "量房费退款处理中，请稍后确认", nil
}

// ---------------------------------------------------------------------------
// 3. UploadWorkingDoc 上传设计工作文档
// ---------------------------------------------------------------------------

func (s *DesignPaymentService) UploadWorkingDoc(providerID, bookingID uint64, input *UploadWorkingDocInput) (*model.DesignWorkingDoc, error) {
	var booking model.Booking
	if err := repository.DB.First(&booking, bookingID).Error; err != nil {
		return nil, errors.New("预约不存在")
	}
	if booking.ProviderID != providerID {
		return nil, errors.New("无权操作此预约")
	}

	now := time.Now()
	doc := &model.DesignWorkingDoc{
		BookingID:   bookingID,
		ProviderID:  providerID,
		DocType:     input.DocType,
		Title:       input.Title,
		Description: input.Description,
		Files:       normalizeStoredAssetJSONArray(input.Files),
		SubmittedAt: &now,
	}
	if err := repository.DB.Create(doc).Error; err != nil {
		return nil, errors.New("创建文档记录失败")
	}
	hydrateDesignWorkingDoc(doc)
	return doc, nil
}

// ---------------------------------------------------------------------------
// 4. ListWorkingDocs 列出工作文档
// ---------------------------------------------------------------------------

func (s *DesignPaymentService) ListWorkingDocs(bookingID uint64) ([]model.DesignWorkingDoc, error) {
	var docs []model.DesignWorkingDoc
	if err := repository.DB.Where("booking_id = ?", bookingID).
		Order("created_at DESC").Find(&docs).Error; err != nil {
		return nil, err
	}
	for index := range docs {
		hydrateDesignWorkingDoc(&docs[index])
	}
	return docs, nil
}

// ---------------------------------------------------------------------------
// 5. CreateDesignFeeQuote 创建设计费报价
// ---------------------------------------------------------------------------

func (s *DesignPaymentService) CreateDesignFeeQuote(providerID, bookingID uint64, input *CreateDesignFeeQuoteInput) (*model.DesignFeeQuote, error) {
	var booking model.Booking
	if err := repository.DB.First(&booking, bookingID).Error; err != nil {
		return nil, errors.New("预约不存在")
	}
	if booking.ProviderID != providerID {
		return nil, errors.New("无权操作此预约")
	}

	// 检查是否已有待处理报价
	var existing model.DesignFeeQuote
	err := repository.DB.Where("booking_id = ? AND status = ?", bookingID, model.DesignFeeQuoteStatusPending).First(&existing).Error
	if err == nil {
		return nil, errors.New("该预约已有待确认的报价，请勿重复提交")
	}

	// 计算定金抵扣
	deduction := 0.0
	if booking.SurveyDepositPaid && !booking.SurveyDepositConverted {
		deduction = booking.SurveyDeposit
	}
	netAmount := input.TotalFee - deduction
	if netAmount < 0 {
		netAmount = 0
	}

	// 支付模式
	paymentMode := input.PaymentMode
	if paymentMode == "" {
		paymentMode = configSvc.GetDesignFeePaymentMode()
	}

	// 有效期
	expireHours := configSvc.GetDesignQuoteExpireHours()
	expireAt := time.Now().Add(time.Duration(expireHours) * time.Hour)

	quote := &model.DesignFeeQuote{
		BookingID:        bookingID,
		ProviderID:       providerID,
		TotalFee:         input.TotalFee,
		DepositDeduction: deduction,
		NetAmount:        netAmount,
		PaymentMode:      paymentMode,
		StagesJSON:       input.StagesJSON,
		Description:      input.Description,
		Status:           model.DesignFeeQuoteStatusPending,
		ExpireAt:         &expireAt,
	}
	if err := repository.DB.Create(quote).Error; err != nil {
		return nil, errors.New("创建报价失败")
	}

	// 推进业务流到设计报价待确认
	_ = businessFlowSvc.AdvanceBySource(nil, model.BusinessFlowSourceBooking, bookingID, map[string]interface{}{
		"current_stage": model.BusinessFlowStageDesignQuotePending,
	})
	_ = designPaymentNotificationSvc.NotifyDesignFeeQuoteCreated(
		booking.ID,
		quote.ID,
		booking.UserID,
		readBookingProviderRoleText(booking.ProviderType),
	)

	return quote, nil
}

// ---------------------------------------------------------------------------
// 6. GetDesignFeeQuote 获取最新报价
// ---------------------------------------------------------------------------

func (s *DesignPaymentService) GetDesignFeeQuote(bookingID uint64) (*model.DesignFeeQuote, error) {
	view, err := s.GetDesignFeeQuoteView(bookingID)
	if err != nil {
		return nil, err
	}
	return view.Quote, nil
}

func (s *DesignPaymentService) GetDesignFeeQuoteView(bookingID uint64) (*DesignFeeQuoteView, error) {
	var quote model.DesignFeeQuote
	if err := repository.DB.Where("booking_id = ?", bookingID).
		Order("created_at DESC").First(&quote).Error; err != nil {
		return nil, errors.New("暂无设计费报价")
	}
	view := &DesignFeeQuoteView{Quote: &quote}
	if quote.OrderID > 0 {
		var order model.Order
		if err := repository.DB.First(&order, quote.OrderID).Error; err == nil {
			view.Order = &order
		}
	}
	return view, nil
}

// ---------------------------------------------------------------------------
// 7. ConfirmDesignFeeQuote 确认报价 → 生成订单
// ---------------------------------------------------------------------------

func (s *DesignPaymentService) ConfirmDesignFeeQuote(userID, quoteID uint64) (*model.Order, error) {
	var quote model.DesignFeeQuote
	if err := repository.DB.First(&quote, quoteID).Error; err != nil {
		return nil, errors.New("报价不存在")
	}
	if quote.Status != model.DesignFeeQuoteStatusPending {
		return nil, errors.New("报价状态不正确，无法确认")
	}
	if quote.ExpireAt != nil && time.Now().After(*quote.ExpireAt) {
		return nil, errors.New("报价已过期")
	}

	var booking model.Booking
	if err := repository.DB.First(&booking, quote.BookingID).Error; err != nil {
		return nil, errors.New("关联预约不存在")
	}
	if booking.UserID != userID {
		return nil, errors.New("无权操作此报价")
	}

	var order *model.Order
	now := time.Now()

	if err := repository.DB.Transaction(func(tx *gorm.DB) error {
		// a. 更新报价状态
		if err := tx.Model(&quote).Updates(map[string]interface{}{
			"status":       model.DesignFeeQuoteStatusConfirmed,
			"confirmed_at": now,
		}).Error; err != nil {
			return err
		}

		// b. 如果有定金抵扣，标记已转化
		if quote.DepositDeduction > 0 {
			if err := tx.Model(&booking).Update("survey_deposit_converted", true).Error; err != nil {
				return err
			}
		}

		// c. 创建订单
		orderNo, err := generateDesignOrderNo()
		if err != nil {
			return err
		}
		order = &model.Order{
			BookingID:   quote.BookingID,
			OrderNo:     orderNo,
			OrderType:   model.OrderTypeDesign,
			TotalAmount: quote.TotalFee,
			Discount:    quote.DepositDeduction,
			Status:      model.OrderStatusPending,
		}
		if err := tx.Create(order).Error; err != nil {
			return err
		}

		// d. 创建支付计划
		if quote.PaymentMode == "staged" && quote.StagesJSON != "" {
			var stages []struct {
				Seq        int     `json:"seq"`
				Name       string  `json:"name"`
				Percentage float32 `json:"percentage"`
				Amount     float64 `json:"amount"`
			}
			if err := json.Unmarshal([]byte(quote.StagesJSON), &stages); err == nil {
				for _, st := range stages {
					amount := st.Amount
					if amount <= 0 && st.Percentage > 0 {
						amount = quote.NetAmount * float64(st.Percentage) / 100
					}
					plan := model.PaymentPlan{
						OrderID:    order.ID,
						Type:       "staged",
						Seq:        st.Seq,
						Name:       st.Name,
						Amount:     amount,
						Percentage: st.Percentage,
						Status:     0,
					}
					if err := tx.Create(&plan).Error; err != nil {
						return err
					}
				}
			}
		} else {
			// 一次性支付
			plan := model.PaymentPlan{
				OrderID:    order.ID,
				Type:       "onetime",
				Seq:        1,
				Name:       "设计费",
				Amount:     quote.NetAmount,
				Percentage: 100,
				Status:     0,
			}
			if err := tx.Create(&plan).Error; err != nil {
				return err
			}
		}

		// e. 回写报价的 OrderID
		if err := tx.Model(&quote).Update("order_id", order.ID).Error; err != nil {
			return err
		}

		// 推进业务流
		return businessFlowSvc.AdvanceBySource(tx, model.BusinessFlowSourceBooking, quote.BookingID, map[string]interface{}{
			"current_stage": model.BusinessFlowStageDesignFeePaying,
		})
	}); err != nil {
		return nil, err
	}
	_ = designPaymentNotificationSvc.NotifyDesignFeeOrderCreated(
		booking.ID,
		order.ID,
		booking.UserID,
		quote.NetAmount,
	)

	return order, nil
}

// ---------------------------------------------------------------------------
// 8. RejectDesignFeeQuote 拒绝报价
// ---------------------------------------------------------------------------

func (s *DesignPaymentService) RejectDesignFeeQuote(userID, quoteID uint64, reason string) error {
	var quote model.DesignFeeQuote
	if err := repository.DB.First(&quote, quoteID).Error; err != nil {
		return errors.New("报价不存在")
	}
	if quote.Status != model.DesignFeeQuoteStatusPending {
		return errors.New("报价状态不正确，无法拒绝")
	}

	var booking model.Booking
	if err := repository.DB.First(&booking, quote.BookingID).Error; err != nil {
		return errors.New("关联预约不存在")
	}
	if booking.UserID != userID {
		return errors.New("无权操作此报价")
	}

	now := time.Now()
	return repository.DB.Model(&quote).Updates(map[string]interface{}{
		"status":           model.DesignFeeQuoteStatusRejected,
		"rejected_at":      now,
		"rejection_reason": reason,
	}).Error
}

// ---------------------------------------------------------------------------
// 9. SubmitDesignDeliverable 提交设计交付物
// ---------------------------------------------------------------------------

func (s *DesignPaymentService) SubmitDesignDeliverable(providerID uint64, input *SubmitDeliverableInput) (*model.DesignDeliverable, error) {
	var booking model.Booking
	if err := repository.DB.First(&booking, input.BookingID).Error; err != nil {
		return nil, errors.New("预约不存在")
	}
	if booking.ProviderID != providerID {
		return nil, errors.New("无权操作此预约")
	}

	now := time.Now()

	// 查找已有的交付物记录（支持重新提交）
	var deliverable model.DesignDeliverable
	err := repository.DB.Where("booking_id = ? AND provider_id = ?", input.BookingID, providerID).First(&deliverable).Error

	if errors.Is(err, gorm.ErrRecordNotFound) {
		// 新建
		deliverable = model.DesignDeliverable{
			BookingID:       input.BookingID,
			ProjectID:       input.ProjectID,
			OrderID:         input.OrderID,
			ProviderID:      providerID,
			ColorFloorPlan:  normalizeStoredAssetJSONArray(input.ColorFloorPlan),
			Renderings:      normalizeStoredAssetJSONArray(input.Renderings),
			RenderingLink:   input.RenderingLink,
			TextDescription: input.TextDescription,
			CADDrawings:     normalizeStoredAssetJSONArray(input.CADDrawings),
			Attachments:     normalizeStoredAssetJSONArray(input.Attachments),
			Status:          model.DesignDeliverableStatusSubmitted,
			SubmittedAt:     &now,
		}
		if err := repository.DB.Create(&deliverable).Error; err != nil {
			return nil, errors.New("创建交付物记录失败")
		}
	} else if err != nil {
		return nil, errors.New("查询交付物失败")
	} else {
		// 更新已有记录
		updates := map[string]interface{}{
			"color_floor_plan": normalizeStoredAssetJSONArray(input.ColorFloorPlan),
			"renderings":       normalizeStoredAssetJSONArray(input.Renderings),
			"rendering_link":   input.RenderingLink,
			"text_description": input.TextDescription,
			"cad_drawings":     normalizeStoredAssetJSONArray(input.CADDrawings),
			"attachments":      normalizeStoredAssetJSONArray(input.Attachments),
			"status":           model.DesignDeliverableStatusSubmitted,
			"submitted_at":     now,
			"rejected_at":      nil,
			"rejection_reason": "",
		}
		if input.ProjectID > 0 {
			updates["project_id"] = input.ProjectID
		}
		if input.OrderID > 0 {
			updates["order_id"] = input.OrderID
		}
		if err := repository.DB.Model(&deliverable).Updates(updates).Error; err != nil {
			return nil, errors.New("更新交付物失败")
		}
		repository.DB.First(&deliverable, deliverable.ID)
	}

	// 推进业务流
	_ = businessFlowSvc.AdvanceBySource(nil, model.BusinessFlowSourceBooking, input.BookingID, map[string]interface{}{
		"current_stage": model.BusinessFlowStageDesignAcceptancePending,
	})

	hydrateDesignDeliverable(&deliverable)
	NewNotificationDispatcher().NotifyDesignDeliverableSubmitted(booking.UserID, deliverable.ID, deliverable.BookingID)
	return &deliverable, nil
}

func (s *DesignPaymentService) GetDesignDeliverableByProject(projectID uint64) (*model.DesignDeliverable, error) {
	var deliverable model.DesignDeliverable
	if err := repository.DB.Where("project_id = ?", projectID).Order("created_at DESC").First(&deliverable).Error; err != nil {
		return nil, errors.New("未找到设计交付物")
	}
	hydrateDesignDeliverable(&deliverable)
	return &deliverable, nil
}

func (s *DesignPaymentService) GetDesignDeliverableByBooking(bookingID uint64) (*model.DesignDeliverable, error) {
	var deliverable model.DesignDeliverable
	if err := repository.DB.Where("booking_id = ?", bookingID).Order("created_at DESC, id DESC").First(&deliverable).Error; err != nil {
		return nil, errors.New("未找到设计交付物")
	}
	hydrateDesignDeliverable(&deliverable)
	return &deliverable, nil
}

func (s *DesignPaymentService) GetDesignDeliverableByBookingForUser(userID, bookingID uint64) (*model.DesignDeliverable, error) {
	var booking model.Booking
	if err := repository.DB.Select("id", "user_id").First(&booking, bookingID).Error; err != nil {
		return nil, errors.New("关联预约不存在")
	}
	if booking.UserID != userID {
		return nil, errors.New("无权查看此交付物")
	}
	return s.GetDesignDeliverableByBooking(bookingID)
}

func (s *DesignPaymentService) GetDesignDeliverableByProjectForUser(userID, projectID uint64) (*model.DesignDeliverable, error) {
	var project model.Project
	if err := repository.DB.Select("id", "owner_id").First(&project, projectID).Error; err != nil {
		return nil, errors.New("关联项目不存在")
	}
	if project.OwnerID != userID {
		return nil, errors.New("无权查看此交付物")
	}
	return s.GetDesignDeliverableByProject(projectID)
}

func hydrateDesignWorkingDoc(doc *model.DesignWorkingDoc) {
	if doc == nil {
		return
	}
	doc.Files = hydrateAssetJSONArray(doc.Files)
}

func hydrateDesignDeliverable(deliverable *model.DesignDeliverable) {
	if deliverable == nil {
		return
	}
	deliverable.ColorFloorPlan = hydrateAssetJSONArray(deliverable.ColorFloorPlan)
	deliverable.Renderings = hydrateAssetJSONArray(deliverable.Renderings)
	deliverable.CADDrawings = hydrateAssetJSONArray(deliverable.CADDrawings)
	deliverable.Attachments = hydrateAssetJSONArray(deliverable.Attachments)
}

// ---------------------------------------------------------------------------
// 10. AcceptDesignDeliverable 验收通过
// ---------------------------------------------------------------------------

func (s *DesignPaymentService) AcceptDesignDeliverable(userID, deliverableID uint64) (*model.DesignDeliverable, error) {
	var deliverable model.DesignDeliverable
	if err := repository.DB.First(&deliverable, deliverableID).Error; err != nil {
		return nil, errors.New("交付物不存在")
	}
	if deliverable.Status != model.DesignDeliverableStatusSubmitted {
		return nil, errors.New("交付物状态不正确，无法验收")
	}

	// 验证用户身份：通过 booking 或 project 关联
	var booking model.Booking
	if err := repository.DB.First(&booking, deliverable.BookingID).Error; err != nil {
		return nil, errors.New("关联预约不存在")
	}
	if booking.UserID != userID {
		return nil, errors.New("无权验收此交付物")
	}

	now := time.Now()
	releaseDays := configSvc.GetConstructionReleaseDelayDays()
	releaseAt := now.AddDate(0, 0, releaseDays)

	if err := repository.DB.Transaction(func(tx *gorm.DB) error {
		// a. 更新交付物状态
		if err := tx.Model(&deliverable).Updates(map[string]interface{}{
			"status":      model.DesignDeliverableStatusAccepted,
			"accepted_at": now,
		}).Error; err != nil {
			return err
		}

		// b. 设置 T+N 放款计划（通过关联订单找到 milestone / payment_plan）
		if deliverable.OrderID > 0 {
			tx.Model(&model.PaymentPlan{}).
				Where("order_id = ? AND status = 0", deliverable.OrderID).
				Updates(map[string]interface{}{
					"due_at": releaseAt,
				})
		}

		// c. 创建设计费待结算投影
		if deliverable.OrderID > 0 {
			var order model.Order
			if err := tx.First(&order, deliverable.OrderID).Error; err == nil {
				if _, _, err := (&SettlementService{}).CreateDesignSettlementScheduleTx(tx, &deliverable, &order); err != nil {
					return err
				}
			}
		}

		// 推进业务流
		return businessFlowSvc.AdvanceBySource(tx, model.BusinessFlowSourceBooking, deliverable.BookingID, map[string]interface{}{
			"current_stage": model.BusinessFlowStageDesignDeliveryPending,
		})
	}); err != nil {
		return nil, err
	}

	repository.DB.First(&deliverable, deliverableID)
	return &deliverable, nil
}

// ---------------------------------------------------------------------------
// 11. RejectDesignDeliverable 驳回交付物
// ---------------------------------------------------------------------------

func (s *DesignPaymentService) RejectDesignDeliverable(userID, deliverableID uint64, reason string) (*model.DesignDeliverable, error) {
	if reason == "" {
		return nil, errors.New("驳回原因不能为空")
	}

	var deliverable model.DesignDeliverable
	if err := repository.DB.First(&deliverable, deliverableID).Error; err != nil {
		return nil, errors.New("交付物不存在")
	}
	if deliverable.Status != model.DesignDeliverableStatusSubmitted {
		return nil, errors.New("交付物状态不正确，无法驳回")
	}

	var booking model.Booking
	if err := repository.DB.First(&booking, deliverable.BookingID).Error; err != nil {
		return nil, errors.New("关联预约不存在")
	}
	if booking.UserID != userID {
		return nil, errors.New("无权操作此交付物")
	}

	now := time.Now()
	if err := repository.DB.Model(&deliverable).Updates(map[string]interface{}{
		"status":           model.DesignDeliverableStatusRejected,
		"rejected_at":      now,
		"rejection_reason": reason,
	}).Error; err != nil {
		return nil, errors.New("更新交付物状态失败")
	}

	repository.DB.First(&deliverable, deliverableID)
	return &deliverable, nil
}
