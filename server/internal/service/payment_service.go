package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"home-decoration-server/internal/config"
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
)

type PaymentLaunchResponse struct {
	PaymentID  uint64     `json:"paymentId"`
	Channel    string     `json:"channel"`
	LaunchMode string     `json:"launchMode"`
	LaunchURL  string     `json:"launchUrl"`
	ExpiresAt  *time.Time `json:"expiresAt"`
}

type PaymentStatusResponse struct {
	PaymentID     uint64         `json:"paymentId"`
	Status        string         `json:"status"`
	Channel       string         `json:"channel"`
	Amount        float64        `json:"amount"`
	Subject       string         `json:"subject"`
	PaidAt        *time.Time     `json:"paidAt,omitempty"`
	ExpiresAt     *time.Time     `json:"expiresAt,omitempty"`
	TerminalType  string         `json:"terminalType"`
	ReturnContext map[string]any `json:"returnContext,omitempty"`
}

type paymentCreateSpec struct {
	BizType      string
	BizID        uint64
	PayerUserID  uint64
	Scene        string
	TerminalType string
	Subject      string
	Amount       float64
	ReturnCtx    map[string]any
}

type paymentSideEffect struct {
	Kind           string
	BookingID      uint64
	OrderID        uint64
	ProviderID     uint64
	ProviderUserID uint64
	Amount         float64
	OrderType      string
}

type refundExecutionPlan struct {
	PaymentOrderID uint64
	BizType        string
	BizID          uint64
	Amount         float64
	Reason         string
}

type PaymentService struct {
	gateway paymentGateway
}

var paymentGatewayFactory = func() paymentGateway {
	return NewAlipayGateway()
}

func NewPaymentService(gateway paymentGateway) *PaymentService {
	if gateway == nil {
		gateway = paymentGatewayFactory()
	}
	return &PaymentService{gateway: gateway}
}

func (s *PaymentService) StartBookingIntentPayment(userID, bookingID uint64, terminalType string) (*PaymentLaunchResponse, error) {
	terminalType, err := normalizeTerminalType(terminalType)
	if err != nil {
		return nil, err
	}
	var payment *model.PaymentOrder
	err = repository.DB.Transaction(func(tx *gorm.DB) error {
		var booking model.Booking
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&booking, bookingID).Error; err != nil {
			return errors.New("预约不存在")
		}
		if booking.UserID != userID {
			return errors.New("无权操作此预约")
		}
		if booking.IntentFeePaid {
			return errors.New("量房定金已支付")
		}
		payment, err = s.createOrReusePaymentOrderTx(tx, &paymentCreateSpec{
			BizType:      model.PaymentBizTypeBookingIntent,
			BizID:        booking.ID,
			PayerUserID:  userID,
			Scene:        model.PaymentBizTypeBookingIntent,
			TerminalType: terminalType,
			Subject:      fmt.Sprintf("预约量房定金 #%d", booking.ID),
			Amount:       normalizeAmount(booking.IntentFee),
			ReturnCtx: map[string]any{
				"successPath": fmt.Sprintf("/bookings/%d", booking.ID),
				"cancelPath":  fmt.Sprintf("/bookings/%d", booking.ID),
				"bizType":     model.PaymentBizTypeBookingIntent,
				"bizId":       booking.ID,
			},
		})
		return err
	})
	if err != nil {
		return nil, err
	}
	return s.buildLaunchResponse(payment), nil
}

func (s *PaymentService) StartSurveyDepositPayment(userID, bookingID uint64, terminalType string) (*PaymentLaunchResponse, error) {
	terminalType, err := normalizeTerminalType(terminalType)
	if err != nil {
		return nil, err
	}
	var payment *model.PaymentOrder
	err = repository.DB.Transaction(func(tx *gorm.DB) error {
		var booking model.Booking
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&booking, bookingID).Error; err != nil {
			return errors.New("预约不存在")
		}
		if booking.UserID != userID {
			return errors.New("无权操作此预约")
		}
		if booking.SurveyDepositPaid {
			return errors.New("量房定金已支付")
		}
		depositAmount, amountErr := resolveBookingSurveyDepositAmountTx(tx, &booking)
		if amountErr != nil {
			return amountErr
		}
		payment, err = s.createOrReusePaymentOrderTx(tx, &paymentCreateSpec{
			BizType:      model.PaymentBizTypeBookingSurveyDeposit,
			BizID:        booking.ID,
			PayerUserID:  userID,
			Scene:        model.PaymentBizTypeBookingSurveyDeposit,
			TerminalType: terminalType,
			Subject:      fmt.Sprintf("量房定金 #%d", booking.ID),
			Amount:       depositAmount,
			ReturnCtx: map[string]any{
				"successPath": fmt.Sprintf("/bookings/%d/site-survey", booking.ID),
				"cancelPath":  fmt.Sprintf("/bookings/%d", booking.ID),
				"bizType":     model.PaymentBizTypeBookingSurveyDeposit,
				"bizId":       booking.ID,
			},
		})
		return err
	})
	if err != nil {
		return nil, err
	}
	return s.buildLaunchResponse(payment), nil
}

func (s *PaymentService) StartOrderPayment(userID, orderID uint64, terminalType string) (*PaymentLaunchResponse, error) {
	terminalType, err := normalizeTerminalType(terminalType)
	if err != nil {
		return nil, err
	}
	var payment *model.PaymentOrder
	err = repository.DB.Transaction(func(tx *gorm.DB) error {
		order, err := lockOrderForUserTx(tx, userID, orderID)
		if err != nil {
			return err
		}
		if order.Status != model.OrderStatusPending {
			return errors.New("订单状态不正确")
		}
		amount := normalizeAmount(order.TotalAmount - order.Discount)
		payment, err = s.createOrReusePaymentOrderTx(tx, &paymentCreateSpec{
			BizType:      model.PaymentBizTypeOrder,
			BizID:        order.ID,
			PayerUserID:  userID,
			Scene:        model.PaymentBizTypeOrder,
			TerminalType: terminalType,
			Subject:      fmt.Sprintf("订单支付 #%s", order.OrderNo),
			Amount:       amount,
			ReturnCtx: map[string]any{
				"successPath": resolveOrderSuccessPath(order),
				"cancelPath":  resolveOrderCancelPath(order),
				"bizType":     model.PaymentBizTypeOrder,
				"bizId":       order.ID,
			},
		})
		return err
	})
	if err != nil {
		return nil, err
	}
	return s.buildLaunchResponse(payment), nil
}

func (s *PaymentService) StartPaymentPlanPayment(userID, planID uint64, terminalType string) (*PaymentLaunchResponse, error) {
	terminalType, err := normalizeTerminalType(terminalType)
	if err != nil {
		return nil, err
	}
	var payment *model.PaymentOrder
	err = repository.DB.Transaction(func(tx *gorm.DB) error {
		plan, order, _, err := lockPaymentPlanForUserTx(tx, userID, planID)
		if err != nil {
			return err
		}
		if plan.Status != 0 {
			return errors.New("该期款项已支付")
		}
		payment, err = s.createOrReusePaymentOrderTx(tx, &paymentCreateSpec{
			BizType:      model.PaymentBizTypePaymentPlan,
			BizID:        plan.ID,
			PayerUserID:  userID,
			Scene:        model.PaymentBizTypePaymentPlan,
			TerminalType: terminalType,
			Subject:      fmt.Sprintf("%s %s", order.OrderNo, plan.Name),
			Amount:       normalizeAmount(plan.Amount),
			ReturnCtx: map[string]any{
				"successPath": resolveOrderSuccessPath(order),
				"cancelPath":  resolveOrderCancelPath(order),
				"bizType":     model.PaymentBizTypePaymentPlan,
				"bizId":       plan.ID,
			},
		})
		return err
	})
	if err != nil {
		return nil, err
	}
	return s.buildLaunchResponse(payment), nil
}

func (s *PaymentService) BuildLaunchDocument(paymentID uint64, token string) (string, error) {
	if strings.TrimSpace(token) == "" {
		return "", errors.New("支付启动参数缺失")
	}
	var payment model.PaymentOrder
	markPendingAfterLaunch := false
	err := repository.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&payment, paymentID).Error; err != nil {
			return errors.New("支付单不存在")
		}
		if payment.Status == model.PaymentStatusPaid {
			return errors.New("支付单已完成")
		}
		if payment.Status == model.PaymentStatusClosed || payment.Status == model.PaymentStatusFailed {
			return errors.New("支付单已关闭")
		}
		now := time.Now()
		if payment.ExpiredAt != nil && payment.ExpiredAt.Before(now) {
			if err := tx.Model(&payment).Update("status", model.PaymentStatusClosed).Error; err != nil {
				return err
			}
			return errors.New("支付单已过期")
		}
		if payment.LaunchTokenHash == "" || payment.LaunchTokenExpiredAt == nil || payment.LaunchTokenExpiredAt.Before(now) {
			return errors.New("支付启动链接已失效")
		}
		if hashLaunchToken(token) != payment.LaunchTokenHash {
			return errors.New("支付启动链接无效")
		}
		nextStatus := model.PaymentStatusPending
		if payment.Status == model.PaymentStatusCreated {
			nextStatus = model.PaymentStatusLaunching
			markPendingAfterLaunch = true
		}
		updates := map[string]any{
			"status":                  nextStatus,
			"launch_token_hash":       "",
			"launch_token_expired_at": nil,
		}
		return tx.Model(&payment).Updates(updates).Error
	})
	if err != nil {
		return "", err
	}
	html, err := s.gateway.BuildLaunchHTML(&payment)
	if err != nil {
		return "", err
	}
	if markPendingAfterLaunch {
		_ = repository.DB.Model(&model.PaymentOrder{}).
			Where("id = ? AND status = ?", payment.ID, model.PaymentStatusLaunching).
			Update("status", model.PaymentStatusPending).Error
	}
	return html, nil
}

func (s *PaymentService) GetPaymentStatusForUser(paymentID, userID uint64) (*PaymentStatusResponse, error) {
	var payment model.PaymentOrder
	if err := repository.DB.First(&payment, paymentID).Error; err != nil {
		return nil, errors.New("支付单不存在")
	}
	if payment.PayerUserID != userID {
		return nil, errors.New("无权查看该支付单")
	}
	if payment.Status == model.PaymentStatusCreated || payment.Status == model.PaymentStatusLaunching || payment.Status == model.PaymentStatusPending {
		synced, err := s.SyncPaymentState(payment.ID)
		if err == nil && synced != nil {
			payment = *synced
		}
	}
	return &PaymentStatusResponse{
		PaymentID:     payment.ID,
		Status:        payment.Status,
		Channel:       payment.Channel,
		Amount:        payment.Amount,
		Subject:       payment.Subject,
		PaidAt:        payment.PaidAt,
		ExpiresAt:     payment.ExpiredAt,
		TerminalType:  payment.TerminalType,
		ReturnContext: decodePaymentReturnContext(payment.ReturnContext),
	}, nil
}

func (s *PaymentService) SyncPaymentState(paymentID uint64) (*model.PaymentOrder, error) {
	var current model.PaymentOrder
	if err := repository.DB.First(&current, paymentID).Error; err != nil {
		return nil, errors.New("支付单不存在")
	}
	if current.Status == model.PaymentStatusPaid || current.Status == model.PaymentStatusClosed || current.Status == model.PaymentStatusFailed {
		return &current, nil
	}
	result, err := s.gateway.QueryTrade(context.Background(), &current)
	if err != nil {
		return &current, err
	}
	var (
		updated model.PaymentOrder
		effect  *paymentSideEffect
	)
	err = repository.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&current, paymentID).Error; err != nil {
			return err
		}
		if current.Status == model.PaymentStatusPaid || current.Status == model.PaymentStatusClosed || current.Status == model.PaymentStatusFailed {
			updated = current
			return nil
		}
		switch result.TradeStatus {
		case alipayTradeSuccess, alipayTradeFinished:
			effect, err = s.confirmPaymentSuccessTx(tx, &current, result.TradeNo, result.RawJSON)
			if err != nil {
				return err
			}
		case alipayTradeClosed:
			if err := tx.Model(&current).Updates(map[string]any{
				"status":              model.PaymentStatusClosed,
				"provider_trade_no":   firstNonEmpty(current.ProviderTradeNo, result.TradeNo),
				"raw_response_digest": digestString(result.RawJSON),
			}).Error; err != nil {
				return err
			}
		}
		return tx.First(&updated, current.ID).Error
	})
	if err != nil {
		return nil, err
	}
	if effect != nil {
		s.runPaymentSideEffect(effect)
	}
	return &updated, nil
}

func (s *PaymentService) HandleAlipayNotify(values url.Values) error {
	payload, err := s.gateway.VerifyNotify(values)
	if err != nil {
		return err
	}
	outTradeNo := strings.TrimSpace(payload["out_trade_no"])
	if outTradeNo == "" {
		return errors.New("支付宝回调缺少 out_trade_no")
	}
	tradeStatus := strings.TrimSpace(payload["trade_status"])
	notifyID := strings.TrimSpace(payload["notify_id"])
	var effect *paymentSideEffect
	err = repository.DB.Transaction(func(tx *gorm.DB) error {
		var payment model.PaymentOrder
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("out_trade_no = ?", outTradeNo).First(&payment).Error; err != nil {
			return errors.New("支付单不存在")
		}
		callback, err := upsertPaymentCallbackTx(tx, &payment, notifyID, tradeStatus, payload)
		if err != nil {
			return err
		}
		if callback.Processed {
			return nil
		}
		switch tradeStatus {
		case alipayTradeSuccess, alipayTradeFinished:
			effect, err = s.confirmPaymentSuccessTx(tx, &payment, payload["trade_no"], mustMarshalJSON(payload))
			if err != nil {
				_ = tx.Model(callback).Updates(map[string]any{"error_message": err.Error()}).Error
				return err
			}
		case alipayTradeClosed:
			if payment.Status != model.PaymentStatusPaid {
				if err := tx.Model(&payment).Updates(map[string]any{
					"status":              model.PaymentStatusClosed,
					"provider_trade_no":   firstNonEmpty(payment.ProviderTradeNo, payload["trade_no"]),
					"raw_response_digest": digestString(mustMarshalJSON(payload)),
				}).Error; err != nil {
					return err
				}
			}
		default:
			if payment.Status == model.PaymentStatusCreated || payment.Status == model.PaymentStatusLaunching {
				if err := tx.Model(&payment).Update("status", model.PaymentStatusPending).Error; err != nil {
					return err
				}
			}
		}
		now := time.Now()
		return tx.Model(callback).Updates(map[string]any{
			"processed":    true,
			"processed_at": &now,
			"verified":     true,
		}).Error
	})
	if err != nil {
		return err
	}
	if effect != nil {
		s.runPaymentSideEffect(effect)
	}
	return nil
}

func (s *PaymentService) ResolveReturnURL(paymentID uint64, terminalType string) (string, error) {
	var payment model.PaymentOrder
	if err := repository.DB.First(&payment, paymentID).Error; err != nil {
		return "", errors.New("支付单不存在")
	}
	ctx := decodePaymentReturnContext(payment.ReturnContext)
	cfg := config.GetConfig().Alipay
	base := strings.TrimSpace(cfg.ReturnURLWeb)
	if terminalType == model.PaymentTerminalMobileH5 {
		base = strings.TrimSpace(cfg.ReturnURLH5)
	}
	if base == "" {
		base = "/payments/result"
	}
	query := url.Values{}
	query.Set("paymentId", fmt.Sprintf("%d", paymentID))
	if next := stringMapValue(ctx, "successPath"); next != "" {
		query.Set("next", next)
	}
	if strings.Contains(base, "?") {
		return base + "&" + query.Encode(), nil
	}
	return base + "?" + query.Encode(), nil
}

func (s *PaymentService) CreateRefundOrdersForApplicationTx(tx *gorm.DB, application *model.RefundApplication, approvedAmount float64) ([]model.RefundOrder, error) {
	plans, err := s.buildRefundExecutionPlansTx(tx, application, approvedAmount)
	if err != nil {
		return nil, err
	}
	refunds := make([]model.RefundOrder, 0, len(plans))
	for _, plan := range plans {
		refund, err := s.createRefundOrderTx(tx, application.ID, plan)
		if err != nil {
			return nil, err
		}
		refunds = append(refunds, *refund)
	}
	return refunds, nil
}

func (s *PaymentService) ExecuteRefundOrder(refundOrderID uint64) (*model.RefundOrder, error) {
	var refund model.RefundOrder
	if err := repository.DB.First(&refund, refundOrderID).Error; err != nil {
		return nil, errors.New("退款单不存在")
	}
	if refund.Status == model.RefundOrderStatusSucceeded || refund.Status == model.RefundOrderStatusFailed {
		return &refund, nil
	}

	var payment model.PaymentOrder
	if err := repository.DB.First(&payment, refund.PaymentOrderID).Error; err != nil {
		return nil, errors.New("关联支付单不存在")
	}

	result, err := s.gateway.Refund(context.Background(), &payment, &refund)
	if err != nil {
		_ = repository.DB.Model(&refund).Updates(map[string]any{
			"status":         model.RefundOrderStatusProcessing,
			"failure_reason": err.Error(),
		}).Error
		refund.Status = model.RefundOrderStatusProcessing
		refund.FailureReason = err.Error()
		return &refund, err
	}

	updates := map[string]any{
		"provider_response_json": result.RawJSON,
		"failure_reason":         result.FailureReason,
	}
	now := time.Now()
	switch {
	case result.Success:
		updates["status"] = model.RefundOrderStatusSucceeded
		updates["succeeded_at"] = &now
		refund.Status = model.RefundOrderStatusSucceeded
		refund.SucceededAt = &now
	case result.Pending:
		updates["status"] = model.RefundOrderStatusProcessing
		refund.Status = model.RefundOrderStatusProcessing
	default:
		updates["status"] = model.RefundOrderStatusFailed
		refund.Status = model.RefundOrderStatusFailed
	}
	refund.ProviderResponseJSON = result.RawJSON
	refund.FailureReason = result.FailureReason
	if err := repository.DB.Model(&refund).Updates(updates).Error; err != nil {
		return nil, err
	}
	return &refund, nil
}

func (s *PaymentService) SyncRefundOrder(refundOrderID uint64) (*model.RefundOrder, error) {
	var refund model.RefundOrder
	if err := repository.DB.First(&refund, refundOrderID).Error; err != nil {
		return nil, errors.New("退款单不存在")
	}
	if refund.Status == model.RefundOrderStatusSucceeded || refund.Status == model.RefundOrderStatusFailed {
		return &refund, nil
	}

	var payment model.PaymentOrder
	if err := repository.DB.First(&payment, refund.PaymentOrderID).Error; err != nil {
		return nil, errors.New("关联支付单不存在")
	}

	result, err := s.gateway.QueryRefund(context.Background(), &payment, &refund)
	if err != nil {
		return &refund, err
	}

	updates := map[string]any{
		"provider_response_json": result.RawJSON,
		"failure_reason":         result.FailureReason,
	}
	now := time.Now()
	switch {
	case result.Success:
		updates["status"] = model.RefundOrderStatusSucceeded
		updates["succeeded_at"] = &now
		refund.Status = model.RefundOrderStatusSucceeded
		refund.SucceededAt = &now
	case result.Pending:
		updates["status"] = model.RefundOrderStatusProcessing
		refund.Status = model.RefundOrderStatusProcessing
	default:
		updates["status"] = model.RefundOrderStatusFailed
		refund.Status = model.RefundOrderStatusFailed
	}
	refund.ProviderResponseJSON = result.RawJSON
	refund.FailureReason = result.FailureReason
	if err := repository.DB.Model(&refund).Updates(updates).Error; err != nil {
		return nil, err
	}
	return &refund, nil
}

func (s *PaymentService) SyncPendingRefundOrders(limit int) (int, error) {
	query := repository.DB.Where("status = ?", model.RefundOrderStatusProcessing).Order("id ASC")
	if limit > 0 {
		query = query.Limit(limit)
	}
	var refunds []model.RefundOrder
	if err := query.Find(&refunds).Error; err != nil {
		return 0, err
	}

	successCount := 0
	alertSvc := &SystemAlertService{}
	for _, refund := range refunds {
		scope := fmt.Sprintf("退款同步/申请%d/退款单%d", refund.RefundApplicationID, refund.ID)
		updated, err := s.SyncRefundOrder(refund.ID)
		if err != nil {
			_, _, _ = alertSvc.UpsertAlert(&CreateSystemAlertInput{
				Type:        SystemAlertTypeRefundSyncFailure,
				Level:       "high",
				Scope:       scope,
				Description: err.Error(),
				ActionURL:   "/risk/warnings",
			})
			continue
		}
		if updated != nil {
			if _, finalizeErr := s.FinalizeRefundApplicationIfReady(updated.RefundApplicationID); finalizeErr != nil {
				_, _, _ = alertSvc.UpsertAlert(&CreateSystemAlertInput{
					Type:        SystemAlertTypeRefundSyncFailure,
					Level:       "high",
					Scope:       scope,
					Description: finalizeErr.Error(),
					ActionURL:   "/risk/warnings",
				})
				continue
			}
			_, _ = alertSvc.ResolveAlert(SystemAlertTypeRefundSyncFailure, scope, "退款同步恢复成功")
			successCount++
		}
	}
	return successCount, nil
}

func (s *PaymentService) FinalizeRefundApplicationIfReady(applicationID uint64) (bool, error) {
	if applicationID == 0 {
		return false, errors.New("退款申请不存在")
	}
	completed := false
	err := repository.DB.Transaction(func(tx *gorm.DB) error {
		var application model.RefundApplication
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&application, applicationID).Error; err != nil {
			return errors.New("退款申请不存在")
		}
		if application.Status == model.RefundApplicationStatusCompleted {
			completed = true
			return nil
		}

		var refundOrders []model.RefundOrder
		if err := tx.Where("refund_application_id = ?", application.ID).Order("id ASC").Find(&refundOrders).Error; err != nil {
			return err
		}
		if len(refundOrders) == 0 {
			return errors.New("退款单不存在")
		}
		for _, refund := range refundOrders {
			if refund.Status == model.RefundOrderStatusFailed {
				return errors.New("存在退款失败记录")
			}
			if refund.Status != model.RefundOrderStatusSucceeded {
				return nil
			}
		}

		if err := applyRefundApplicationTx(tx, &application, application.ApprovedAmount); err != nil {
			return err
		}
		now := time.Now()
		if err := tx.Model(&application).Updates(map[string]any{
			"status":       model.RefundApplicationStatusCompleted,
			"completed_at": &now,
		}).Error; err != nil {
			return err
		}
		completed = true
		return nil
	})
	return completed, err
}

func (s *PaymentService) createOrReusePaymentOrderTx(tx *gorm.DB, spec *paymentCreateSpec) (*model.PaymentOrder, error) {
	if spec == nil {
		return nil, errors.New("支付参数不能为空")
	}
	if err := ensureAlipayEnabled(); err != nil {
		return nil, err
	}
	if spec.Amount <= 0 {
		return nil, errors.New("支付金额无效")
	}
	now := time.Now()
	expiresAt := now.Add(time.Duration(maxInt(config.GetConfig().Alipay.TimeoutMinutes, 15)) * time.Minute)
	rawToken, tokenHash := generateLaunchToken()
	returnJSON := mustMarshalJSON(spec.ReturnCtx)

	var existing model.PaymentOrder
	err := tx.Where("biz_type = ? AND biz_id = ? AND payer_user_id = ? AND channel = ? AND status IN ?",
		spec.BizType, spec.BizID, spec.PayerUserID, model.PaymentChannelAlipay,
		[]string{model.PaymentStatusCreated, model.PaymentStatusLaunching, model.PaymentStatusPending}).
		Order("id DESC").
		First(&existing).Error
	if err == nil {
		if existing.ExpiredAt != nil && existing.ExpiredAt.Before(now) {
			if err := tx.Model(&existing).Update("status", model.PaymentStatusClosed).Error; err != nil {
				return nil, err
			}
		} else {
			if err := tx.Model(&existing).Updates(map[string]any{
				"scene":                   spec.Scene,
				"terminal_type":           spec.TerminalType,
				"subject":                 spec.Subject,
				"amount":                  spec.Amount,
				"status":                  model.PaymentStatusLaunching,
				"launch_token_hash":       tokenHash,
				"launch_token_expired_at": expiresAt,
				"expired_at":              expiresAt,
				"return_context":          returnJSON,
			}).Error; err != nil {
				return nil, err
			}
			existing.LaunchTokenHash = tokenHash
			existing.LaunchTokenExpiredAt = &expiresAt
			existing.ExpiredAt = &expiresAt
			existing.Status = model.PaymentStatusLaunching
			existing.TerminalType = spec.TerminalType
			existing.Scene = spec.Scene
			existing.Subject = spec.Subject
			existing.Amount = spec.Amount
			existing.ReturnContext = returnJSON
			return decorateLaunchURL(&existing, rawToken), nil
		}
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	order := &model.PaymentOrder{
		BizType:              spec.BizType,
		BizID:                spec.BizID,
		PayerUserID:          spec.PayerUserID,
		Channel:              model.PaymentChannelAlipay,
		Scene:                spec.Scene,
		TerminalType:         spec.TerminalType,
		Subject:              spec.Subject,
		Amount:               spec.Amount,
		OutTradeNo:           generateOutTradeNo(spec.BizType, spec.BizID),
		Status:               model.PaymentStatusLaunching,
		LaunchTokenHash:      tokenHash,
		LaunchTokenExpiredAt: &expiresAt,
		ExpiredAt:            &expiresAt,
		ReturnContext:        returnJSON,
	}
	if err := tx.Create(order).Error; err != nil {
		return nil, err
	}
	return decorateLaunchURL(order, rawToken), nil
}

func decorateLaunchURL(order *model.PaymentOrder, rawToken string) *model.PaymentOrder {
	cloned := *order
	cloned.ReturnContext = rawToken
	return &cloned
}

func (s *PaymentService) buildLaunchResponse(payment *model.PaymentOrder) *PaymentLaunchResponse {
	launchToken := payment.ReturnContext
	payment.ReturnContext = ""
	return &PaymentLaunchResponse{
		PaymentID:  payment.ID,
		Channel:    payment.Channel,
		LaunchMode: "redirect",
		LaunchURL:  buildLaunchURL(payment.ID, launchToken),
		ExpiresAt:  payment.ExpiredAt,
	}
}

func (s *PaymentService) confirmPaymentSuccessTx(tx *gorm.DB, payment *model.PaymentOrder, providerTradeNo, rawPayload string) (*paymentSideEffect, error) {
	if payment.Status == model.PaymentStatusPaid {
		return nil, nil
	}
	now := time.Now()
	var effect *paymentSideEffect
	var err error
	switch payment.BizType {
	case model.PaymentBizTypeBookingIntent:
		effect, err = confirmBookingIntentPaidTx(tx, payment.BizID)
	case model.PaymentBizTypeBookingSurveyDeposit:
		err = confirmSurveyDepositPaidTx(tx, payment)
	case model.PaymentBizTypeOrder:
		effect, err = confirmOrderPaidTx(tx, payment.BizID)
	case model.PaymentBizTypePaymentPlan:
		err = confirmPaymentPlanPaidTx(tx, payment.BizID)
	default:
		return nil, errors.New("未知支付单类型")
	}
	if err != nil {
		return nil, err
	}
	if err := tx.Model(payment).Updates(map[string]any{
		"status":                  model.PaymentStatusPaid,
		"provider_trade_no":       firstNonEmpty(payment.ProviderTradeNo, providerTradeNo),
		"paid_at":                 &now,
		"launch_token_hash":       "",
		"launch_token_expired_at": nil,
		"raw_response_digest":     digestString(rawPayload),
	}).Error; err != nil {
		return nil, err
	}
	payment.Status = model.PaymentStatusPaid
	payment.ProviderTradeNo = firstNonEmpty(payment.ProviderTradeNo, providerTradeNo)
	payment.PaidAt = &now
	payment.RawResponseDigest = digestString(rawPayload)
	return effect, nil
}

func (s *PaymentService) runPaymentSideEffect(effect *paymentSideEffect) {
	if effect == nil {
		return
	}
	notifService := &NotificationService{}
	incomeService := &MerchantIncomeService{}
	switch effect.Kind {
	case model.PaymentBizTypeBookingIntent:
		if effect.ProviderUserID > 0 && effect.BookingID > 0 {
			var booking model.Booking
			if err := repository.DB.First(&booking, effect.BookingID).Error; err == nil {
				_ = notifService.NotifyBookingIntentPaid(&booking, effect.ProviderUserID)
			}
		}
	case model.PaymentBizTypeOrder:
		if effect.ProviderUserID > 0 && effect.OrderID > 0 {
			_ = notifService.NotifyOrderPaid(map[string]any{"id": effect.OrderID, "amount": effect.Amount}, effect.ProviderUserID)
		}
		if effect.ProviderID > 0 && effect.OrderType != model.OrderTypeConstruction {
			_, _ = incomeService.CreateIncome(&CreateIncomeInput{
				ProviderID:  effect.ProviderID,
				OrderID:     effect.OrderID,
				BookingID:   effect.BookingID,
				Type:        effect.OrderType,
				Amount:      effect.Amount,
				Description: "订单支付",
			})
		}
	}
}

func confirmBookingIntentPaidTx(tx *gorm.DB, bookingID uint64) (*paymentSideEffect, error) {
	var booking model.Booking
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&booking, bookingID).Error; err != nil {
		return nil, errors.New("预约不存在")
	}
	if booking.IntentFeePaid {
		return nil, nil
	}
	now := time.Now()
	deadline := now.Add(48 * time.Hour)
	if err := tx.Model(&booking).Updates(map[string]any{
		"intent_fee_paid":            true,
		"merchant_response_deadline": &deadline,
	}).Error; err != nil {
		return nil, err
	}
	var provider model.Provider
	providerUserID := uint64(0)
	if err := tx.First(&provider, booking.ProviderID).Error; err == nil {
		providerUserID = provider.UserID
	}
	return &paymentSideEffect{
		Kind:           model.PaymentBizTypeBookingIntent,
		BookingID:      booking.ID,
		ProviderUserID: providerUserID,
	}, nil
}

func confirmSurveyDepositPaidTx(tx *gorm.DB, payment *model.PaymentOrder) error {
	var booking model.Booking
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&booking, payment.BizID).Error; err != nil {
		return errors.New("预约不存在")
	}
	if booking.SurveyDepositPaid {
		return nil
	}
	now := time.Now()
	if err := tx.Model(&booking).Updates(map[string]any{
		"survey_deposit":         payment.Amount,
		"survey_deposit_paid":    true,
		"survey_deposit_paid_at": &now,
	}).Error; err != nil {
		return err
	}
	txn := model.Transaction{
		OrderID:    fmt.Sprintf("SD-%d-%d", booking.ID, now.Unix()),
		Type:       "deposit",
		Amount:     payment.Amount,
		FromUserID: booking.UserID,
		Status:     1,
		Remark:     "survey_deposit",
	}
	if err := tx.Create(&txn).Error; err != nil {
		return err
	}
	return businessFlowSvc.AdvanceBySource(tx, model.BusinessFlowSourceBooking, booking.ID, map[string]any{
		"current_stage": model.BusinessFlowStageSurveyDepositPending,
	})
}

func confirmOrderPaidTx(tx *gorm.DB, orderID uint64) (*paymentSideEffect, error) {
	var order model.Order
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&order, orderID).Error; err != nil {
		return nil, errors.New("订单不存在")
	}
	if order.Status == model.OrderStatusPaid {
		return nil, nil
	}
	if order.Status != model.OrderStatusPending {
		return nil, errors.New("订单状态不正确")
	}
	now := time.Now()
	amount := normalizeAmount(order.TotalAmount - order.Discount)
	if err := tx.Model(&order).Updates(map[string]any{
		"status":      model.OrderStatusPaid,
		"paid_amount": amount,
		"paid_at":     &now,
	}).Error; err != nil {
		return nil, err
	}
	effect := &paymentSideEffect{Kind: model.PaymentBizTypeOrder, OrderID: order.ID, Amount: amount, OrderType: order.OrderType}
	if order.ProposalID > 0 {
		var proposal model.Proposal
		if err := tx.First(&proposal, order.ProposalID).Error; err == nil {
			var booking model.Booking
			if err := tx.First(&booking, proposal.BookingID).Error; err == nil {
				effect.BookingID = booking.ID
				var provider model.Provider
				if err := tx.First(&provider, booking.ProviderID).Error; err == nil {
					effect.ProviderID = provider.ID
					effect.ProviderUserID = provider.UserID
				}
			}
		}
	} else if order.ProjectID > 0 {
		var project model.Project
		if err := tx.First(&project, order.ProjectID).Error; err == nil {
			var provider model.Provider
			if err := tx.First(&provider, project.ProviderID).Error; err == nil {
				effect.ProviderID = provider.ID
				effect.ProviderUserID = provider.UserID
			}
			if order.OrderType == model.OrderTypeDesign {
				if err := tx.Model(&model.Project{}).Where("id = ?", order.ProjectID).Update("current_phase", "design_paid").Error; err != nil {
					return nil, err
				}
			}
		}
	}
	return effect, nil
}

func confirmPaymentPlanPaidTx(tx *gorm.DB, planID uint64) error {
	var plan model.PaymentPlan
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&plan, planID).Error; err != nil {
		return errors.New("支付计划不存在")
	}
	if plan.Status != 0 {
		return nil
	}
	var order model.Order
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&order, plan.OrderID).Error; err != nil {
		return errors.New("订单不存在")
	}
	var project model.Project
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&project, order.ProjectID).Error; err != nil {
		return errors.New("项目不存在")
	}
	if plan.Seq > 1 {
		var prevPlan model.PaymentPlan
		if err := tx.Where("order_id = ? AND seq = ?", plan.OrderID, plan.Seq-1).First(&prevPlan).Error; err == nil && prevPlan.Status == 0 {
			return errors.New("请先支付上一期款项")
		}
	}
	now := time.Now()
	if err := tx.Model(&plan).Updates(map[string]any{"status": 1, "paid_at": &now}).Error; err != nil {
		return err
	}
	newPaidAmount := normalizeAmount(order.PaidAmount + plan.Amount)
	updates := map[string]any{"paid_amount": newPaidAmount}
	if newPaidAmount >= normalizeAmount(order.TotalAmount) {
		updates["status"] = model.OrderStatusPaid
		updates["paid_at"] = &now
	}
	if err := tx.Model(&order).Updates(updates).Error; err != nil {
		return err
	}
	if order.OrderType == model.OrderTypeConstruction && project.PaymentPaused {
		if err := (&ProjectService{}).resumeProjectExecutionAfterPaymentTx(tx, &project); err != nil {
			return err
		}
	}
	return nil
}

func upsertPaymentCallbackTx(tx *gorm.DB, payment *model.PaymentOrder, notifyID, eventType string, payload map[string]string) (*model.PaymentCallback, error) {
	var callback model.PaymentCallback
	if notifyID != "" {
		if err := tx.Where("notify_id = ?", notifyID).First(&callback).Error; err == nil {
			return &callback, nil
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, err
		}
	}
	callback = model.PaymentCallback{
		PaymentOrderID: payment.ID,
		NotifyID:       notifyID,
		EventType:      eventType,
		Verified:       true,
		Processed:      false,
		PayloadJSON:    mustMarshalJSON(payload),
		ReceivedAt:     time.Now(),
	}
	if err := tx.Create(&callback).Error; err != nil {
		return nil, err
	}
	return &callback, nil
}

func lockOrderForUserTx(tx *gorm.DB, userID, orderID uint64) (*model.Order, error) {
	var order model.Order
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&order, orderID).Error; err != nil {
		return nil, errors.New("订单不存在")
	}
	if order.ProjectID > 0 {
		var project model.Project
		if err := tx.First(&project, order.ProjectID).Error; err != nil {
			return nil, errors.New("项目不存在")
		}
		if project.OwnerID != userID {
			return nil, errors.New("无权操作此订单")
		}
	} else {
		var proposal model.Proposal
		if err := tx.First(&proposal, order.ProposalID).Error; err != nil {
			return nil, errors.New("关联方案不存在")
		}
		var booking model.Booking
		if err := tx.First(&booking, proposal.BookingID).Error; err != nil {
			return nil, errors.New("关联预约不存在")
		}
		if booking.UserID != userID {
			return nil, errors.New("无权操作此订单")
		}
	}
	return &order, nil
}

func lockPaymentPlanForUserTx(tx *gorm.DB, userID, planID uint64) (*model.PaymentPlan, *model.Order, *model.Project, error) {
	var plan model.PaymentPlan
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&plan, planID).Error; err != nil {
		return nil, nil, nil, errors.New("支付计划不存在")
	}
	var order model.Order
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&order, plan.OrderID).Error; err != nil {
		return nil, nil, nil, errors.New("订单不存在")
	}
	var project model.Project
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&project, order.ProjectID).Error; err != nil {
		return nil, nil, nil, errors.New("项目不存在")
	}
	if project.OwnerID != userID {
		return nil, nil, nil, errors.New("无权操作")
	}
	if plan.Seq > 1 {
		var prevPlan model.PaymentPlan
		if err := tx.Where("order_id = ? AND seq = ?", plan.OrderID, plan.Seq-1).First(&prevPlan).Error; err == nil && prevPlan.Status == 0 {
			return nil, nil, nil, errors.New("请先支付上一期款项")
		}
	}
	return &plan, &order, &project, nil
}

func resolveBookingSurveyDepositAmountTx(tx *gorm.DB, booking *model.Booking) (float64, error) {
	if booking == nil || booking.ID == 0 {
		return 0, errors.New("预约不存在")
	}
	depositAmount, err := configSvc.GetSurveyDepositDefault()
	if err != nil {
		depositAmount = 500
	}
	var provider model.Provider
	if err := tx.First(&provider, booking.ProviderID).Error; err == nil && provider.SurveyDepositPrice > 0 {
		depositAmount = provider.SurveyDepositPrice
	}
	return normalizeAmount(depositAmount), nil
}

func normalizeTerminalType(terminalType string) (string, error) {
	switch strings.TrimSpace(terminalType) {
	case "", model.PaymentTerminalPCWeb:
		return model.PaymentTerminalPCWeb, nil
	case model.PaymentTerminalMobileH5:
		return model.PaymentTerminalMobileH5, nil
	default:
		return "", errors.New("不支持的支付终端")
	}
}

func ensureAlipayEnabled() error {
	if !config.GetConfig().Alipay.Enabled {
		return errors.New("支付宝支付未启用")
	}
	return nil
}

func buildLaunchURL(paymentID uint64, token string) string {
	base := "/api/v1/payments/%d/launch?token=%s"
	serverPublic := strings.TrimSpace(config.GetConfig().Server.PublicURL)
	path := fmt.Sprintf(base, paymentID, url.QueryEscape(token))
	if serverPublic == "" {
		return path
	}
	return strings.TrimRight(serverPublic, "/") + path
}

func generateOutTradeNo(bizType string, bizID uint64) string {
	prefix := strings.ToUpper(strings.ReplaceAll(bizType, "_", ""))
	if len(prefix) > 10 {
		prefix = prefix[:10]
	}
	return fmt.Sprintf("%s-%d-%s", prefix, bizID, uuid.NewString()[:12])
}

func generateOutRefundNo(paymentOrderID, refundApplicationID uint64) string {
	return fmt.Sprintf("RF-%d-%d-%s", paymentOrderID, refundApplicationID, uuid.NewString()[:8])
}

func generateLaunchToken() (string, string) {
	raw := uuid.NewString() + uuid.NewString()
	return raw, hashLaunchToken(raw)
}

func hashLaunchToken(raw string) string {
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}

func digestString(value string) string {
	sum := sha256.Sum256([]byte(strings.TrimSpace(value)))
	return hex.EncodeToString(sum[:])
}

func decodePaymentReturnContext(raw string) map[string]any {
	if strings.TrimSpace(raw) == "" {
		return map[string]any{}
	}
	var result map[string]any
	if err := json.Unmarshal([]byte(raw), &result); err != nil {
		return map[string]any{}
	}
	return result
}

func stringMapValue(m map[string]any, key string) string {
	if m == nil {
		return ""
	}
	value, ok := m[key]
	if !ok || value == nil {
		return ""
	}
	return strings.TrimSpace(fmt.Sprint(value))
}

func resolveOrderSuccessPath(order *model.Order) string {
	if order == nil {
		return "/me/orders"
	}
	if order.ProjectID > 0 {
		return fmt.Sprintf("/projects/%d", order.ProjectID)
	}
	return "/me/orders"
}

func resolveOrderCancelPath(order *model.Order) string {
	if order == nil {
		return "/me/orders"
	}
	if order.ProjectID > 0 {
		return fmt.Sprintf("/projects/%d", order.ProjectID)
	}
	return "/me/orders"
}

func (s *PaymentService) buildRefundExecutionPlansTx(tx *gorm.DB, application *model.RefundApplication, approvedAmount float64) ([]refundExecutionPlan, error) {
	if tx == nil {
		tx = repository.DB
	}
	if application == nil || application.ID == 0 {
		return nil, errors.New("退款申请不存在")
	}
	if approvedAmount <= 0 {
		return nil, errors.New("批准金额无效")
	}

	var booking model.Booking
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&booking, application.BookingID).Error; err != nil {
		return nil, errors.New("预约不存在")
	}
	var project *model.Project
	if application.ProjectID > 0 {
		loadedProject, err := lockProjectByID(tx, application.ProjectID)
		if err != nil {
			return nil, err
		}
		project = loadedProject
	}
	breakdown, err := calculateRefundBreakdownTx(tx, &booking, project)
	if err != nil {
		return nil, err
	}
	remaining := normalizeAmount(approvedAmount)
	reason := strings.TrimSpace(application.Reason)
	plans := make([]refundExecutionPlan, 0)

	appendSinglePlan := func(bizType string, bizID uint64, fullAmount float64, allowPartial bool) error {
		fullAmount = normalizeAmount(fullAmount)
		if fullAmount <= 0 || remaining <= 0 {
			return nil
		}
		targetAmount := fullAmount
		if allowPartial && remaining < targetAmount {
			targetAmount = remaining
		}
		if !allowPartial && remaining < targetAmount {
			return errors.New("批准金额与退款范围不匹配")
		}

		paymentOrder, err := s.findPaidPaymentOrderTx(tx, bizType, bizID)
		if err != nil {
			return err
		}
		availableAmount, err := s.remainingRefundableAmountTx(tx, paymentOrder.ID)
		if err != nil {
			return err
		}
		if targetAmount > availableAmount {
			return errors.New("原支付单可退余额不足")
		}
		plans = append(plans, refundExecutionPlan{
			PaymentOrderID: paymentOrder.ID,
			BizType:        bizType,
			BizID:          bizID,
			Amount:         targetAmount,
			Reason:         reason,
		})
		remaining = normalizeAmount(remaining - targetAmount)
		return nil
	}

	switch application.RefundType {
	case model.RefundTypeIntentFee:
		if remaining != normalizeAmount(breakdown.IntentFee) {
			return nil, errors.New("意向金退款金额必须等于可退金额")
		}
		if err := appendSinglePlan(model.PaymentBizTypeBookingIntent, booking.ID, breakdown.IntentFee, false); err != nil {
			return nil, err
		}
	case model.RefundTypeDesignFee:
		if remaining > normalizeAmount(breakdown.DesignFee) {
			return nil, errors.New("设计费退款金额超过可退范围")
		}
		if err := appendSinglePlan(model.PaymentBizTypeOrder, breakdown.DesignOrderID, breakdown.DesignFee, true); err != nil {
			return nil, err
		}
	case model.RefundTypeConstructionFee:
		if remaining > normalizeAmount(breakdown.ConstructionFee) {
			return nil, errors.New("施工费退款金额超过可退范围")
		}
		constructionPlans, err := s.buildConstructionRefundPlansTx(tx, application.ProjectID, remaining, reason)
		if err != nil {
			return nil, err
		}
		plans = append(plans, constructionPlans...)
		remaining = 0
	case model.RefundTypeFull:
		totalAmount := normalizeAmount(breakdown.IntentFee + breakdown.DesignFee + breakdown.ConstructionFee)
		if remaining > totalAmount {
			return nil, errors.New("全额退款金额超过可退范围")
		}
		if breakdown.IntentFee > 0 && remaining > 0 {
			if remaining < normalizeAmount(breakdown.IntentFee) {
				return nil, errors.New("全额退款不能对意向金做部分退款")
			}
			if err := appendSinglePlan(model.PaymentBizTypeBookingIntent, booking.ID, breakdown.IntentFee, false); err != nil {
				return nil, err
			}
		}
		if breakdown.DesignFee > 0 && remaining > 0 {
			if remaining < normalizeAmount(breakdown.DesignFee) {
				return nil, errors.New("全额退款不能对设计费做部分退款")
			}
			if err := appendSinglePlan(model.PaymentBizTypeOrder, breakdown.DesignOrderID, breakdown.DesignFee, false); err != nil {
				return nil, err
			}
		}
		if remaining > 0 {
			constructionPlans, err := s.buildConstructionRefundPlansTx(tx, application.ProjectID, remaining, reason)
			if err != nil {
				return nil, err
			}
			plans = append(plans, constructionPlans...)
			remaining = 0
		}
	default:
		return nil, errors.New("不支持的退款类型")
	}

	if remaining > 0 {
		return nil, errors.New("退款支付单匹配失败")
	}
	return plans, nil
}

func (s *PaymentService) buildConstructionRefundPlansTx(tx *gorm.DB, projectID uint64, amount float64, reason string) ([]refundExecutionPlan, error) {
	if projectID == 0 {
		return nil, errors.New("项目不存在")
	}
	remaining := normalizeAmount(amount)
	if remaining <= 0 {
		return nil, nil
	}

	var orders []model.Order
	if err := tx.Where("project_id = ? AND order_type = ?", projectID, model.OrderTypeConstruction).Order("id DESC").Find(&orders).Error; err != nil {
		return nil, err
	}
	if len(orders) == 0 {
		return nil, errors.New("未找到施工支付订单")
	}
	orderIDs := make([]uint64, 0, len(orders))
	for _, order := range orders {
		orderIDs = append(orderIDs, order.ID)
	}

	var paymentPlans []model.PaymentPlan
	if err := tx.Where("order_id IN ?", orderIDs).Order("id DESC").Find(&paymentPlans).Error; err != nil {
		return nil, err
	}
	planIDs := make([]uint64, 0, len(paymentPlans))
	for _, plan := range paymentPlans {
		planIDs = append(planIDs, plan.ID)
	}

	candidates := make([]model.PaymentOrder, 0)
	var orderPayments []model.PaymentOrder
	if err := tx.Where("biz_type = ? AND biz_id IN ? AND status = ?", model.PaymentBizTypeOrder, orderIDs, model.PaymentStatusPaid).
		Order("paid_at DESC, id DESC").
		Find(&orderPayments).Error; err != nil {
		return nil, err
	}
	candidates = append(candidates, orderPayments...)
	if len(planIDs) > 0 {
		var planPayments []model.PaymentOrder
		if err := tx.Where("biz_type = ? AND biz_id IN ? AND status = ?", model.PaymentBizTypePaymentPlan, planIDs, model.PaymentStatusPaid).
			Order("paid_at DESC, id DESC").
			Find(&planPayments).Error; err != nil {
			return nil, err
		}
		candidates = append(candidates, planPayments...)
	}
	if len(candidates) == 0 {
		return nil, errors.New("未找到可退款的施工支付单")
	}

	result := make([]refundExecutionPlan, 0)
	for _, candidate := range candidates {
		if remaining <= 0 {
			break
		}
		availableAmount, err := s.remainingRefundableAmountTx(tx, candidate.ID)
		if err != nil {
			return nil, err
		}
		if availableAmount <= 0 {
			continue
		}
		useAmount := availableAmount
		if useAmount > remaining {
			useAmount = remaining
		}
		result = append(result, refundExecutionPlan{
			PaymentOrderID: candidate.ID,
			BizType:        candidate.BizType,
			BizID:          candidate.BizID,
			Amount:         useAmount,
			Reason:         reason,
		})
		remaining = normalizeAmount(remaining - useAmount)
	}
	if remaining > 0 {
		return nil, errors.New("施工支付单可退余额不足")
	}
	return result, nil
}

func (s *PaymentService) createRefundOrderTx(tx *gorm.DB, refundApplicationID uint64, plan refundExecutionPlan) (*model.RefundOrder, error) {
	if tx == nil {
		tx = repository.DB
	}
	var payment model.PaymentOrder
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&payment, plan.PaymentOrderID).Error; err != nil {
		return nil, errors.New("支付单不存在")
	}
	if payment.Status != model.PaymentStatusPaid {
		return nil, errors.New("支付单未完成，不能退款")
	}
	availableAmount, err := s.remainingRefundableAmountTx(tx, payment.ID)
	if err != nil {
		return nil, err
	}
	if plan.Amount <= 0 || plan.Amount > availableAmount {
		return nil, errors.New("退款金额超过可退余额")
	}

	refund := &model.RefundOrder{
		PaymentOrderID:      payment.ID,
		BizType:             plan.BizType,
		BizID:               plan.BizID,
		RefundApplicationID: refundApplicationID,
		OutRefundNo:         generateOutRefundNo(payment.ID, refundApplicationID),
		Amount:              plan.Amount,
		Reason:              strings.TrimSpace(plan.Reason),
		Status:              model.RefundOrderStatusCreated,
	}
	if err := tx.Create(refund).Error; err != nil {
		return nil, err
	}
	return refund, nil
}

func (s *PaymentService) findPaidPaymentOrderTx(tx *gorm.DB, bizType string, bizID uint64) (*model.PaymentOrder, error) {
	if bizID == 0 {
		return nil, errors.New("退款业务标识不存在")
	}
	var payment model.PaymentOrder
	if err := tx.Where("biz_type = ? AND biz_id = ? AND status = ?", bizType, bizID, model.PaymentStatusPaid).
		Order("paid_at DESC, id DESC").
		First(&payment).Error; err != nil {
		return nil, errors.New("未找到已支付记录")
	}
	return &payment, nil
}

func (s *PaymentService) remainingRefundableAmountTx(tx *gorm.DB, paymentOrderID uint64) (float64, error) {
	var payment model.PaymentOrder
	if err := tx.Select("amount").First(&payment, paymentOrderID).Error; err != nil {
		return 0, err
	}
	var refundedAmount float64
	if err := tx.Model(&model.RefundOrder{}).
		Where("payment_order_id = ? AND status IN ?", paymentOrderID, []string{
			model.RefundOrderStatusCreated,
			model.RefundOrderStatusProcessing,
			model.RefundOrderStatusSucceeded,
		}).
		Select("COALESCE(SUM(amount), 0)").
		Scan(&refundedAmount).Error; err != nil {
		return 0, err
	}
	remaining := normalizeAmount(payment.Amount - refundedAmount)
	if remaining < 0 {
		return 0, nil
	}
	return remaining, nil
}
