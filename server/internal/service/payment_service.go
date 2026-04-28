package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"home-decoration-server/internal/config"
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	imgutil "home-decoration-server/internal/utils/image"
)

type PaymentLaunchResponse struct {
	PaymentID       uint64               `json:"paymentId"`
	Channel         string               `json:"channel"`
	LaunchMode      string               `json:"launchMode"`
	LaunchURL       string               `json:"launchUrl,omitempty"`
	QRCodeImageURL  string               `json:"qrCodeImageUrl,omitempty"`
	WechatPayParams *WechatMiniPayParams `json:"wechatPayParams,omitempty"`
	ExpiresAt       *time.Time           `json:"expiresAt"`
}

type WechatMiniPayParams struct {
	TimeStamp string `json:"timeStamp"`
	NonceStr  string `json:"nonceStr"`
	Package   string `json:"package"`
	SignType  string `json:"signType"`
	PaySign   string `json:"paySign"`
}

type SurveyDepositPaymentOption struct {
	Channel    string `json:"channel"`
	Label      string `json:"label"`
	LaunchMode string `json:"launchMode"`
}

type PaymentStatusResponse struct {
	PaymentID     uint64         `json:"paymentId"`
	Status        string         `json:"status"`
	StatusText    string         `json:"statusText"`
	Channel       string         `json:"channel"`
	Amount        float64        `json:"amount"`
	Subject       string         `json:"subject"`
	PaidAt        *time.Time     `json:"paidAt,omitempty"`
	ExpiresAt     *time.Time     `json:"expiresAt,omitempty"`
	TerminalType  string         `json:"terminalType"`
	ReturnContext map[string]any `json:"returnContext,omitempty"`
}

type PaymentDetailProvider struct {
	ID       uint64 `json:"id"`
	Name     string `json:"name"`
	RoleText string `json:"roleText"`
	Avatar   string `json:"avatar"`
	Verified bool   `json:"verified"`
}

type PaymentDetailBooking struct {
	ID      uint64 `json:"id"`
	Address string `json:"address"`
}

type PaymentDetailResponse struct {
	PaymentID        uint64                 `json:"paymentId"`
	Status           string                 `json:"status"`
	StatusText       string                 `json:"statusText"`
	Channel          string                 `json:"channel"`
	ChannelText      string                 `json:"channelText"`
	Amount           float64                `json:"amount"`
	Subject          string                 `json:"subject"`
	PurposeText      string                 `json:"purposeText"`
	BizType          string                 `json:"bizType"`
	BizTypeText      string                 `json:"bizTypeText"`
	FundScene        string                 `json:"fundScene"`
	FundSceneText    string                 `json:"fundSceneText"`
	TerminalType     string                 `json:"terminalType"`
	TerminalTypeText string                 `json:"terminalTypeText"`
	ReferenceNo      string                 `json:"referenceNo,omitempty"`
	ReferenceLabel   string                 `json:"referenceLabel,omitempty"`
	OutTradeNo       string                 `json:"outTradeNo"`
	ProviderTradeNo  string                 `json:"providerTradeNo,omitempty"`
	CreatedAt        time.Time              `json:"createdAt"`
	PaidAt           *time.Time             `json:"paidAt,omitempty"`
	ExpiresAt        *time.Time             `json:"expiresAt,omitempty"`
	UsageDescription string                 `json:"usageDescription"`
	ActionPath       string                 `json:"actionPath,omitempty"`
	Provider         *PaymentDetailProvider `json:"provider,omitempty"`
	Booking          *PaymentDetailBooking  `json:"booking,omitempty"`
}

type paymentCreateSpec struct {
	BizType      string
	BizID        uint64
	PayerUserID  uint64
	Channel      string
	Scene        string
	FundScene    string
	TerminalType string
	Subject      string
	Amount       float64
	ReturnCtx    map[string]any
}

type paymentSideEffect struct {
	Kind           string
	UserID         uint64
	BookingID      uint64
	OrderID        uint64
	ProjectID      uint64
	PaymentID      uint64
	ProviderID     uint64
	ProviderUserID uint64
	MilestoneID    uint64
	Amount         float64
	OrderType      string
	PlanName       string
}

type refundExecutionPlan struct {
	PaymentOrderID uint64
	BizType        string
	BizID          uint64
	Amount         float64
	Reason         string
}

type PaymentService struct {
	channels map[string]PaymentChannelService
}

const constructionPaymentPlanActiveWindow = 48 * time.Hour

var paymentChannelServiceFactory = func() map[string]PaymentChannelService {
	return NewPaymentChannels()
}

func NewPaymentService(channel PaymentChannelService) *PaymentService {
	if channel == nil {
		return NewPaymentServiceWithChannels(paymentChannelServiceFactory())
	}
	return NewPaymentServiceWithChannels(map[string]PaymentChannelService{
		model.PaymentChannelAlipay: channel,
	})
}

func NewPaymentServiceWithChannels(channels map[string]PaymentChannelService) *PaymentService {
	cloned := make(map[string]PaymentChannelService, len(channels))
	for key, value := range channels {
		if value != nil {
			cloned[key] = value
		}
	}
	return &PaymentService{channels: cloned}
}

func (s *PaymentService) StartBookingIntentPayment(userID, bookingID uint64, terminalType string) (*PaymentLaunchResponse, error) {
	return s.StartSurveyDepositPayment(userID, bookingID, defaultPaymentChannelForTerminal(terminalType), terminalType)
}

func (s *PaymentService) StartSurveyDepositPayment(userID, bookingID uint64, channel, terminalType string) (*PaymentLaunchResponse, error) {
	channel, terminalType, err := normalizePaymentChannelAndTerminal(channel, terminalType)
	if err != nil {
		return nil, err
	}
	if channel == model.PaymentChannelAlipay && terminalType == model.PaymentTerminalMobileH5 {
		if err := validateMiniAlipayH5Runtime(); err != nil {
			return nil, err
		}
	}
	var payment *model.PaymentOrder
	var miniProgramPay *PaymentChannelMiniProgramResult
	err = repository.DB.Transaction(func(tx *gorm.DB) error {
		var booking model.Booking
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&booking, bookingID).Error; err != nil {
			return errors.New("预约不存在")
		}
		if booking.UserID != userID {
			return errors.New("无权操作此预约")
		}
		if booking.SurveyDepositPaid {
			return errors.New("量房费已支付")
		}
		if err := ensureBookingReadyForDepositPayment(&booking); err != nil {
			return err
		}
		depositAmount, amountErr := resolveBookingSurveyDepositAmountTx(tx, &booking)
		if amountErr != nil {
			return amountErr
		}
		payment, err = s.createOrReusePaymentOrderTx(tx, &paymentCreateSpec{
			BizType:      model.PaymentBizTypeBookingSurveyDeposit,
			BizID:        booking.ID,
			PayerUserID:  userID,
			Channel:      channel,
			Scene:        model.PaymentBizTypeBookingSurveyDeposit,
			FundScene:    model.FundSceneSurveyDeposit,
			TerminalType: terminalType,
			Subject:      fmt.Sprintf("量房费 #%d", booking.ID),
			Amount:       depositAmount,
			ReturnCtx: map[string]any{
				"successPath": fmt.Sprintf("/bookings/%d", booking.ID),
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
	if channel == model.PaymentChannelWechat && terminalType == model.PaymentTerminalMiniWechatJSAPI {
		openID, openIDErr := s.resolveMiniWechatOpenID(userID)
		if openIDErr != nil {
			return nil, openIDErr
		}
		miniProgramPay, err = s.createMiniProgramLaunch(payment, openID)
		if err != nil {
			return nil, err
		}
	}
	return s.buildLaunchResponse(payment, miniProgramPay), nil
}

func (s *PaymentService) StartOrderPayment(userID, orderID uint64, channel, terminalType string) (*PaymentLaunchResponse, error) {
	channel, terminalType, err := normalizePaymentChannelAndTerminal(channel, terminalType)
	if err != nil {
		return nil, err
	}
	if channel == model.PaymentChannelAlipay && terminalType == model.PaymentTerminalMobileH5 {
		if err := validateMiniAlipayH5Runtime(); err != nil {
			return nil, err
		}
	}
	var payment *model.PaymentOrder
	var miniProgramPay *PaymentChannelMiniProgramResult
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
			Channel:      channel,
			Scene:        model.PaymentBizTypeOrder,
			FundScene:    resolveOrderFundScene(order),
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
		if err != nil {
			return err
		}
		if channel == model.PaymentChannelWechat && terminalType == model.PaymentTerminalMiniWechatJSAPI {
			openID, err := s.resolveMiniWechatOpenIDTx(tx, userID)
			if err != nil {
				return err
			}
			miniProgramPay, err = s.createMiniProgramLaunchTx(tx, payment, openID)
			if err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return s.buildLaunchResponse(payment, miniProgramPay), nil
}

func (s *PaymentService) StartPaymentPlanPayment(userID, planID uint64, channel, terminalType string) (*PaymentLaunchResponse, error) {
	channel, terminalType, err := normalizePaymentChannelAndTerminal(channel, terminalType)
	if err != nil {
		return nil, err
	}
	if channel == model.PaymentChannelAlipay && terminalType == model.PaymentTerminalMobileH5 {
		if err := validateMiniAlipayH5Runtime(); err != nil {
			return nil, err
		}
	}
	var payment *model.PaymentOrder
	var miniProgramPay *PaymentChannelMiniProgramResult
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
			Channel:      channel,
			Scene:        model.PaymentBizTypePaymentPlan,
			FundScene:    resolveOrderFundScene(order),
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
		if err != nil {
			return err
		}
		if channel == model.PaymentChannelWechat && terminalType == model.PaymentTerminalMiniWechatJSAPI {
			openID, err := s.resolveMiniWechatOpenIDTx(tx, userID)
			if err != nil {
				return err
			}
			miniProgramPay, err = s.createMiniProgramLaunchTx(tx, payment, openID)
			if err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return s.buildLaunchResponse(payment, miniProgramPay), nil
}

func (s *PaymentService) StartMerchantBondPayment(userID, providerID uint64, terminalType, returnBaseURL string) (*PaymentLaunchResponse, error) {
	_, terminalType, err := normalizePaymentChannelAndTerminal(model.PaymentChannelAlipay, terminalType)
	if err != nil {
		return nil, err
	}
	var payment *model.PaymentOrder
	err = repository.DB.Transaction(func(tx *gorm.DB) error {
		var provider model.Provider
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&provider, providerID).Error; err != nil {
			return errors.New("服务商不存在")
		}
		if provider.UserID != userID {
			return errors.New("无权操作该保证金账户")
		}

		account, err := NewBondService().SyncProviderBondAccountTx(tx, providerID)
		if err != nil {
			return err
		}
		if account == nil || account.RequiredAmount <= 0 {
			return errors.New("当前无需缴纳保证金")
		}
		remaining := normalizeAmount(account.RequiredAmount - account.PaidAmount)
		if remaining <= 0 {
			return errors.New("保证金已缴清")
		}

		returnCtx := map[string]any{
			"successPath": "/bond",
			"cancelPath":  "/bond",
			"bizType":     model.PaymentBizTypeMerchantBond,
			"bizId":       providerID,
		}
		if normalized := normalizeReturnBaseURL(returnBaseURL); normalized != "" {
			returnCtx["returnBaseUrl"] = normalized
		}

		payment, err = s.createOrReusePaymentOrderTx(tx, &paymentCreateSpec{
			BizType:      model.PaymentBizTypeMerchantBond,
			BizID:        providerID,
			PayerUserID:  userID,
			Channel:      model.PaymentChannelAlipay,
			Scene:        model.PaymentBizTypeMerchantBond,
			FundScene:    model.FundSceneMerchantDeposit,
			TerminalType: terminalType,
			Subject:      fmt.Sprintf("商家保证金 #%d", providerID),
			Amount:       remaining,
			ReturnCtx:    returnCtx,
		})
		return err
	})
	if err != nil {
		return nil, err
	}
	return s.buildLaunchResponse(payment, nil), nil
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
	channel, err := s.getChannelService(payment.Channel)
	if err != nil {
		return "", err
	}
	html, err := channel.CreateCollectOrder(context.Background(), &payment)
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

func (s *PaymentService) BuildQRCodeImage(paymentID uint64, token string) ([]byte, error) {
	if strings.TrimSpace(token) == "" {
		return nil, errors.New("支付二维码参数缺失")
	}
	var payment model.PaymentOrder
	err := repository.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&payment, paymentID).Error; err != nil {
			return errors.New("支付单不存在")
		}
		if payment.TerminalType != model.PaymentTerminalMiniQR {
			return errors.New("当前支付单不支持二维码支付")
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
			return errors.New("支付二维码已失效")
		}
		if hashLaunchToken(token) != payment.LaunchTokenHash {
			return errors.New("支付二维码无效")
		}
		if payment.Status == model.PaymentStatusCreated || payment.Status == model.PaymentStatusLaunching {
			if err := tx.Model(&payment).Update("status", model.PaymentStatusPending).Error; err != nil {
				return err
			}
			payment.Status = model.PaymentStatusPending
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	channel, err := s.getChannelService(payment.Channel)
	if err != nil {
		return nil, err
	}
	return channel.CreateCollectQRCode(context.Background(), &payment)
}

func (s *PaymentService) GetPaymentStatusForPayer(paymentID, payerUserID uint64) (*PaymentStatusResponse, error) {
	var payment model.PaymentOrder
	if err := repository.DB.First(&payment, paymentID).Error; err != nil {
		return nil, errors.New("支付单不存在")
	}
	if payment.PayerUserID != payerUserID {
		return nil, errors.New("无权查看该支付单")
	}
	if shouldSyncPaymentState(payment.Status) {
		synced, err := s.SyncPaymentState(payment.ID)
		if err == nil && synced != nil {
			payment = *synced
		}
	}
	return &PaymentStatusResponse{
		PaymentID:     payment.ID,
		Status:        payment.Status,
		StatusText:    paymentStatusText(payment.Status),
		Channel:       payment.Channel,
		Amount:        payment.Amount,
		Subject:       payment.Subject,
		PaidAt:        payment.PaidAt,
		ExpiresAt:     payment.ExpiredAt,
		TerminalType:  payment.TerminalType,
		ReturnContext: decodePaymentReturnContext(payment.ReturnContext),
	}, nil
}

func (s *PaymentService) GetPaymentStatusForUser(paymentID, userID uint64) (*PaymentStatusResponse, error) {
	return s.GetPaymentStatusForPayer(paymentID, userID)
}

func (s *PaymentService) GetPaymentDetailForPayer(paymentID, payerUserID uint64) (*PaymentDetailResponse, error) {
	var payment model.PaymentOrder
	if err := repository.DB.First(&payment, paymentID).Error; err != nil {
		return nil, errors.New("支付单不存在")
	}
	if payment.PayerUserID != payerUserID {
		return nil, errors.New("无权查看该支付单")
	}
	if shouldSyncPaymentState(payment.Status) {
		synced, err := s.SyncPaymentState(payment.ID)
		if err == nil && synced != nil {
			payment = *synced
		}
	}

	detail := &PaymentDetailResponse{
		PaymentID:        payment.ID,
		Status:           payment.Status,
		StatusText:       paymentStatusText(payment.Status),
		Channel:          payment.Channel,
		ChannelText:      paymentChannelText(payment.Channel),
		Amount:           payment.Amount,
		Subject:          strings.TrimSpace(payment.Subject),
		PurposeText:      paymentPurposeText(&payment),
		BizType:          payment.BizType,
		BizTypeText:      paymentBizTypeText(payment.BizType),
		FundScene:        payment.FundScene,
		FundSceneText:    paymentFundSceneText(payment.FundScene),
		TerminalType:     payment.TerminalType,
		TerminalTypeText: paymentTerminalText(payment.TerminalType),
		OutTradeNo:       payment.OutTradeNo,
		ProviderTradeNo:  payment.ProviderTradeNo,
		CreatedAt:        payment.CreatedAt,
		PaidAt:           payment.PaidAt,
		ExpiresAt:        payment.ExpiredAt,
		UsageDescription: paymentUsageDescription(&payment),
		ActionPath:       paymentDetailActionPath(&payment),
	}

	if err := s.enrichPaymentDetail(detail, &payment); err != nil {
		return nil, err
	}
	return detail, nil
}

func (s *PaymentService) GetPaymentDetailForUser(paymentID, userID uint64) (*PaymentDetailResponse, error) {
	return s.GetPaymentDetailForPayer(paymentID, userID)
}

func (s *PaymentService) SyncLatestPendingBizPayment(bizType string, bizID uint64) (*model.PaymentOrder, error) {
	if bizID == 0 || strings.TrimSpace(bizType) == "" {
		return nil, errors.New("支付业务参数无效")
	}

	var payment model.PaymentOrder
	err := repository.DB.
		Where("biz_type = ? AND biz_id = ? AND status IN ?", bizType, bizID, syncablePaymentStatuses()).
		Order("id DESC").
		First(&payment).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	return s.SyncPaymentState(payment.ID)
}

func (s *PaymentService) SyncPaymentState(paymentID uint64) (*model.PaymentOrder, error) {
	var current model.PaymentOrder
	if err := repository.DB.First(&current, paymentID).Error; err != nil {
		return nil, errors.New("支付单不存在")
	}
	if current.Status == model.PaymentStatusPaid || current.Status == model.PaymentStatusClosed || current.Status == model.PaymentStatusFailed {
		return &current, nil
	}
	channel, err := s.getChannelService(current.Channel)
	if err != nil {
		return &current, err
	}
	result, err := channel.QueryCollectOrder(context.Background(), &current)
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
		nextStatus := resolveQueriedPaymentStatus(&current, result)
		switch nextStatus {
		case model.PaymentStatusPaid:
			effect, err = s.confirmPaymentSuccessTx(tx, &current, result.ProviderTradeNo, result.RawJSON)
			if err != nil {
				return err
			}
		case model.PaymentStatusClosed, model.PaymentStatusFailed:
			if err := tx.Model(&current).Updates(map[string]any{
				"status":              nextStatus,
				"provider_trade_no":   firstNonEmpty(current.ProviderTradeNo, result.ProviderTradeNo),
				"raw_response_digest": digestString(result.RawJSON),
			}).Error; err != nil {
				return err
			}
			current.Status = nextStatus
			current.ProviderTradeNo = firstNonEmpty(current.ProviderTradeNo, result.ProviderTradeNo)
			current.RawResponseDigest = digestString(result.RawJSON)
			if err := enqueuePaymentClosedOutboxTx(tx, &current, nextStatus); err != nil {
				return err
			}
		default:
			updates := map[string]any{
				"status":              nextStatus,
				"provider_trade_no":   firstNonEmpty(current.ProviderTradeNo, result.ProviderTradeNo),
				"raw_response_digest": digestString(result.RawJSON),
			}
			if err := tx.Model(&current).Updates(updates).Error; err != nil {
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
	channel, err := s.getChannelService(model.PaymentChannelAlipay)
	if err != nil {
		return err
	}
	payload, err := channel.VerifyNotify(values)
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
				payment.Status = model.PaymentStatusClosed
				payment.ProviderTradeNo = firstNonEmpty(payment.ProviderTradeNo, payload["trade_no"])
				payment.RawResponseDigest = digestString(mustMarshalJSON(payload))
				if err := enqueuePaymentClosedOutboxTx(tx, &payment, alipayTradeClosed); err != nil {
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

func (s *PaymentService) HandleWechatNotify(request *http.Request) error {
	channel, err := s.getChannelService(model.PaymentChannelWechat)
	if err != nil {
		return err
	}
	notifyResult, err := channel.ParseNotifyRequest(context.Background(), request)
	if err != nil {
		return err
	}
	if strings.TrimSpace(notifyResult.OutTradeNo) == "" {
		return errors.New("微信支付回调缺少 out_trade_no")
	}
	var effect *paymentSideEffect
	err = repository.DB.Transaction(func(tx *gorm.DB) error {
		var payment model.PaymentOrder
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("out_trade_no = ?", notifyResult.OutTradeNo).First(&payment).Error; err != nil {
			return errors.New("支付单不存在")
		}
		callback, err := upsertPaymentCallbackTx(tx, &payment, notifyResult.NotifyID, notifyResult.EventType, map[string]string{
			"out_trade_no": notifyResult.OutTradeNo,
			"trade_state":  notifyResult.TradeStatus,
			"trade_no":     notifyResult.ProviderTradeNo,
		})
		if err != nil {
			return err
		}
		if callback.Processed {
			return nil
		}

		switch interpretPaymentTradeState(payment.Channel, notifyResult.TradeStatus) {
		case model.PaymentStatusPaid:
			effect, err = s.confirmPaymentSuccessTx(tx, &payment, notifyResult.ProviderTradeNo, notifyResult.RawJSON)
			if err != nil {
				_ = tx.Model(callback).Updates(map[string]any{"error_message": err.Error()}).Error
				return err
			}
		case model.PaymentStatusClosed, model.PaymentStatusFailed:
			if payment.Status != model.PaymentStatusPaid {
				nextStatus := interpretPaymentTradeState(payment.Channel, notifyResult.TradeStatus)
				if err := tx.Model(&payment).Updates(map[string]any{
					"status":              nextStatus,
					"provider_trade_no":   firstNonEmpty(payment.ProviderTradeNo, notifyResult.ProviderTradeNo),
					"raw_response_digest": digestString(notifyResult.RawJSON),
				}).Error; err != nil {
					return err
				}
				payment.Status = nextStatus
				payment.ProviderTradeNo = firstNonEmpty(payment.ProviderTradeNo, notifyResult.ProviderTradeNo)
				payment.RawResponseDigest = digestString(notifyResult.RawJSON)
				if err := enqueuePaymentClosedOutboxTx(tx, &payment, notifyResult.TradeStatus); err != nil {
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

func (s *PaymentService) HandleWechatRefundNotify(request *http.Request) error {
	channel, err := s.getChannelService(model.PaymentChannelWechat)
	if err != nil {
		return err
	}
	parser, ok := channel.(PaymentChannelRefundNotifyParser)
	if !ok {
		return errors.New("微信退款回调解析器未配置")
	}
	notifyResult, err := parser.ParseRefundNotifyRequest(context.Background(), request)
	if err != nil {
		return err
	}
	outRefundNo := strings.TrimSpace(notifyResult.OutRefundNo)
	if outRefundNo == "" {
		return errors.New("微信退款回调缺少 out_refund_no")
	}

	var refundID uint64
	var succeeded bool
	err = repository.DB.Transaction(func(tx *gorm.DB) error {
		var refund model.RefundOrder
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("out_refund_no = ?", outRefundNo).First(&refund).Error; err != nil {
			return errors.New("退款单不存在")
		}
		refundID = refund.ID

		var payment model.PaymentOrder
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&payment, refund.PaymentOrderID).Error; err != nil {
			return errors.New("关联支付单不存在")
		}

		callbackNotifyID := buildRefundNotifyID(outRefundNo, notifyResult.RawJSON)
		callback, err := upsertPaymentCallbackTx(tx, &payment, callbackNotifyID, "wechat_refund_notify", map[string]string{
			"out_refund_no": outRefundNo,
			"out_trade_no":  notifyResult.OutTradeNo,
			"trade_no":      notifyResult.ProviderTradeNo,
			"success":       fmt.Sprintf("%t", notifyResult.Success),
			"pending":       fmt.Sprintf("%t", notifyResult.Pending),
		})
		if err != nil {
			return err
		}
		if callback.Processed {
			succeeded = refund.Status == model.RefundOrderStatusSucceeded
			return nil
		}

		updates := map[string]any{
			"provider_response_json": notifyResult.RawJSON,
			"failure_reason":         notifyResult.FailureReason,
		}
		now := time.Now()
		switch {
		case notifyResult.Success:
			updates["status"] = model.RefundOrderStatusSucceeded
			if refund.SucceededAt == nil {
				updates["succeeded_at"] = &now
			}
			refund.Status = model.RefundOrderStatusSucceeded
			succeeded = true
		case notifyResult.Pending:
			updates["status"] = model.RefundOrderStatusProcessing
			refund.Status = model.RefundOrderStatusProcessing
		default:
			updates["status"] = model.RefundOrderStatusFailed
			refund.Status = model.RefundOrderStatusFailed
		}
		if err := tx.Model(&refund).Updates(updates).Error; err != nil {
			_ = tx.Model(callback).Updates(map[string]any{"error_message": err.Error()}).Error
			return err
		}
		if refund.Status == model.RefundOrderStatusSucceeded {
			if err := s.refreshRefundProjectionTx(tx, refund.PaymentOrderID); err != nil {
				_ = tx.Model(callback).Updates(map[string]any{"error_message": err.Error()}).Error
				return err
			}
		} else if refund.Status == model.RefundOrderStatusFailed {
			userID, providerUserID := resolveRefundParticipantUsersTx(tx, &refund)
			if err := enqueueRefundFailedOutboxTx(tx, &refund, userID, providerUserID); err != nil {
				_ = tx.Model(callback).Updates(map[string]any{"error_message": err.Error()}).Error
				return err
			}
		}

		return tx.Model(callback).Updates(map[string]any{
			"processed":    true,
			"processed_at": &now,
			"verified":     true,
		}).Error
	})
	if err != nil {
		return err
	}
	if succeeded && refundID > 0 {
		if _, finalizeErr := s.FinalizeRefundOrderIfReady(refundID); finalizeErr != nil && !strings.Contains(finalizeErr.Error(), "未支持的独立退款单类型") {
			return finalizeErr
		}
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
	if ctxBase := normalizeReturnBaseURL(stringMapValue(ctx, "returnBaseUrl")); ctxBase != "" {
		base = ctxBase
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
	if refund.Status == model.RefundOrderStatusSucceeded {
		_ = s.refreshRefundProjectionByRefundOrderID(refund.ID)
		return &refund, nil
	}
	if refund.Status == model.RefundOrderStatusFailed {
		return &refund, nil
	}

	var payment model.PaymentOrder
	if err := repository.DB.First(&payment, refund.PaymentOrderID).Error; err != nil {
		return nil, errors.New("关联支付单不存在")
	}

	channel, err := s.getChannelService(payment.Channel)
	if err != nil {
		return nil, err
	}
	result, err := channel.RefundCollectOrder(context.Background(), &payment, &refund)
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
	if err := repository.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&refund).Updates(updates).Error; err != nil {
			return err
		}
		if refund.Status == model.RefundOrderStatusSucceeded {
			if err := s.refreshRefundProjectionTx(tx, refund.PaymentOrderID); err != nil {
				return err
			}
		}
		if refund.Status == model.RefundOrderStatusFailed {
			userID, providerUserID := resolveRefundParticipantUsersTx(tx, &refund)
			if err := enqueueRefundFailedOutboxTx(tx, &refund, userID, providerUserID); err != nil {
				return err
			}
		}
		return nil
	}); err != nil {
		return nil, err
	}
	if refund.RefundApplicationID > 0 && refund.Status == model.RefundOrderStatusFailed {
		_ = s.writeRefundExecutionFailureAudit(refund.RefundApplicationID, result.FailureReason, []model.RefundOrder{refund})
	}
	return &refund, nil
}

func (s *PaymentService) SyncRefundOrder(refundOrderID uint64) (*model.RefundOrder, error) {
	var refund model.RefundOrder
	if err := repository.DB.First(&refund, refundOrderID).Error; err != nil {
		return nil, errors.New("退款单不存在")
	}
	if refund.Status == model.RefundOrderStatusSucceeded {
		_ = s.refreshRefundProjectionByRefundOrderID(refund.ID)
		return &refund, nil
	}
	if refund.Status == model.RefundOrderStatusFailed {
		return &refund, nil
	}

	var payment model.PaymentOrder
	if err := repository.DB.First(&payment, refund.PaymentOrderID).Error; err != nil {
		return nil, errors.New("关联支付单不存在")
	}

	channel, err := s.getChannelService(payment.Channel)
	if err != nil {
		return nil, err
	}
	result, err := channel.QueryRefundOrder(context.Background(), &payment, &refund)
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
	if err := repository.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&refund).Updates(updates).Error; err != nil {
			return err
		}
		if refund.Status == model.RefundOrderStatusSucceeded {
			if err := s.refreshRefundProjectionTx(tx, refund.PaymentOrderID); err != nil {
				return err
			}
		}
		if refund.Status == model.RefundOrderStatusFailed {
			userID, providerUserID := resolveRefundParticipantUsersTx(tx, &refund)
			if err := enqueueRefundFailedOutboxTx(tx, &refund, userID, providerUserID); err != nil {
				return err
			}
		}
		return nil
	}); err != nil {
		return nil, err
	}
	if refund.RefundApplicationID > 0 && refund.Status == model.RefundOrderStatusFailed {
		_ = s.writeRefundExecutionFailureAudit(refund.RefundApplicationID, result.FailureReason, []model.RefundOrder{refund})
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
			if _, finalizeErr := s.FinalizeRefundOrderIfReady(updated.ID); finalizeErr != nil {
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

func (s *PaymentService) FinalizeRefundOrderIfReady(refundOrderID uint64) (bool, error) {
	if refundOrderID == 0 {
		return false, errors.New("退款单不存在")
	}

	var refund model.RefundOrder
	if err := repository.DB.First(&refund, refundOrderID).Error; err != nil {
		return false, errors.New("退款单不存在")
	}
	if refund.RefundApplicationID > 0 {
		return s.FinalizeRefundApplicationIfReady(refund.RefundApplicationID)
	}

	switch refund.BizType {
	case model.PaymentBizTypeBookingSurveyDeposit:
		return s.finalizeSurveyDepositRefundIfReady(refund.ID)
	default:
		if refund.Status == model.RefundOrderStatusSucceeded {
			return false, errors.New("未支持的独立退款单类型")
		}
		return false, nil
	}
}

func (s *PaymentService) FinalizeRefundApplicationIfReady(applicationID uint64) (bool, error) {
	if applicationID == 0 {
		return false, errors.New("退款申请不存在")
	}
	completed := false
	completedNow := false
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
		bookingScope, projectScope, err := loadRefundExecutionScopeTx(tx, &application)
		if err != nil {
			return err
		}
		beforeState := refundExecutionSnapshot(&application, bookingScope, projectScope)
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
		application.Status = model.RefundApplicationStatusCompleted
		application.CompletedAt = &now
		completedNow = true
		bookingScope, projectScope, err = loadRefundExecutionScopeTx(tx, &application)
		if err != nil {
			return err
		}
		if err := createRefundExecutionAuditTx(tx, "system", 0, &application, bookingScope, projectScope, refundOrders, beforeState, "success", application.AdminNotes); err != nil {
			return err
		}
		providerID := uint64(0)
		if projectScope != nil {
			providerID = effectiveProjectProviderID(projectScope)
		}
		if providerID == 0 && bookingScope != nil {
			providerID = bookingScope.ProviderID
		}
		if err := enqueueRefundSucceededOutboxTx(tx, &application, application.UserID, getProviderUserIDTx(tx, providerID)); err != nil {
			return err
		}
		completed = true
		return nil
	})
	_ = completedNow
	return completed, err
}

func (s *PaymentService) writeRefundExecutionFailureAudit(applicationID uint64, reason string, refundOrders []model.RefundOrder) error {
	if applicationID == 0 {
		return nil
	}
	var application model.RefundApplication
	if err := repository.DB.First(&application, applicationID).Error; err != nil {
		return err
	}
	bookingScope, projectScope, err := loadRefundExecutionScopeTx(repository.DB, &application)
	if err != nil {
		return err
	}
	return createRefundExecutionAuditTx(repository.DB, "system", 0, &application, bookingScope, projectScope, refundOrders, nil, "failed", reason)
}

func resolveRefundParticipantUsersTx(tx *gorm.DB, refund *model.RefundOrder) (uint64, uint64) {
	if tx == nil || refund == nil || refund.RefundApplicationID == 0 {
		return 0, 0
	}
	var application model.RefundApplication
	if err := tx.First(&application, refund.RefundApplicationID).Error; err != nil {
		return 0, 0
	}
	bookingScope, projectScope, err := loadRefundExecutionScopeTx(tx, &application)
	if err != nil {
		return application.UserID, 0
	}
	providerID := uint64(0)
	if projectScope != nil {
		providerID = effectiveProjectProviderID(projectScope)
	}
	if providerID == 0 && bookingScope != nil {
		providerID = bookingScope.ProviderID
	}
	return application.UserID, getProviderUserIDTx(tx, providerID)
}

func (s *PaymentService) finalizeSurveyDepositRefundIfReady(refundOrderID uint64) (bool, error) {
	if refundOrderID == 0 {
		return false, errors.New("退款单不存在")
	}

	completed := false
	err := repository.DB.Transaction(func(tx *gorm.DB) error {
		var refund model.RefundOrder
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&refund, refundOrderID).Error; err != nil {
			return errors.New("退款单不存在")
		}
		if refund.BizType != model.PaymentBizTypeBookingSurveyDeposit {
			return errors.New("退款单类型不匹配")
		}
		if refund.Status == model.RefundOrderStatusFailed {
			return errors.New("存在退款失败记录")
		}
		if refund.Status != model.RefundOrderStatusSucceeded {
			return nil
		}

		var booking model.Booking
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&booking, refund.BizID).Error; err != nil {
			return errors.New("预约不存在")
		}
		if booking.SurveyDepositRefunded {
			completed = true
			return nil
		}

		now := time.Now()
		if err := tx.Model(&booking).Updates(map[string]any{
			"survey_deposit_refunded":   true,
			"survey_deposit_refund_amt": refund.Amount,
			"survey_deposit_refund_at":  &now,
		}).Error; err != nil {
			return err
		}

		refundTxn := model.Transaction{
			OrderID:     fmt.Sprintf("SDR-%d-%d", booking.ID, now.Unix()),
			Type:        "refund",
			Amount:      refund.Amount,
			ToUserID:    booking.UserID,
			Status:      1,
			Remark:      "survey_deposit_refund",
			CompletedAt: &now,
		}
		if err := tx.Create(&refundTxn).Error; err != nil {
			return err
		}

		merchantAmount := normalizeAmount(booking.SurveyDeposit - refund.Amount)
		if merchantAmount > 0 {
			income := model.MerchantIncome{
				ProviderID:  booking.ProviderID,
				BookingID:   booking.ID,
				Type:        "survey_deposit",
				Amount:      merchantAmount,
				PlatformFee: 0,
				NetAmount:   merchantAmount,
				Status:      0,
			}
			if err := tx.Create(&income).Error; err != nil {
				return err
			}
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
	channel := strings.TrimSpace(spec.Channel)
	if channel == "" {
		channel = model.PaymentChannelAlipay
	}
	if err := s.ensurePaymentChannelAvailableTx(tx, channel); err != nil {
		return nil, err
	}
	if spec.Amount <= 0 {
		return nil, errors.New("支付金额无效")
	}
	now := time.Now()
	expiresAt := now.Add(time.Duration(resolvePaymentExpiryMinutes(channel)) * time.Minute)
	rawToken, tokenHash := generateLaunchToken()
	returnJSON := mustMarshalJSON(spec.ReturnCtx)

	var existing model.PaymentOrder
	err := tx.Where("biz_type = ? AND biz_id = ? AND payer_user_id = ? AND channel = ? AND status IN ?",
		spec.BizType, spec.BizID, spec.PayerUserID, channel,
		[]string{model.PaymentStatusCreated, model.PaymentStatusLaunching, model.PaymentStatusPending}).
		Order("id DESC").
		First(&existing).Error
	if err == nil {
		if existing.ExpiredAt != nil && existing.ExpiredAt.Before(now) {
			if err := tx.Model(&existing).Update("status", model.PaymentStatusClosed).Error; err != nil {
				return nil, err
			}
			existing.Status = model.PaymentStatusClosed
			if err := enqueuePaymentClosedOutboxTx(tx, &existing, "expired_before_relaunch"); err != nil {
				return nil, err
			}
		} else {
			if floatToCents(existing.Amount) != floatToCents(spec.Amount) {
				return nil, errors.New("已有待支付支付单金额与当前业务金额不一致，请等待原支付单关闭后重新发起")
			}
			if err := tx.Model(&existing).Updates(map[string]any{
				"scene":                   spec.Scene,
				"fund_scene":              spec.FundScene,
				"terminal_type":           spec.TerminalType,
				"subject":                 spec.Subject,
				"amount":                  spec.Amount,
				"amount_cent":             floatToCents(spec.Amount),
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
			existing.FundScene = spec.FundScene
			existing.Subject = spec.Subject
			existing.Amount = spec.Amount
			existing.ReturnContext = returnJSON
			if channel == model.PaymentChannelWechat {
				return &existing, nil
			}
			return decorateLaunchURL(&existing, rawToken), nil
		}
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	outTradeNo, err := generateOutTradeNo(spec.FundScene)
	if err != nil {
		return nil, err
	}

	order := &model.PaymentOrder{
		BizType:              spec.BizType,
		BizID:                spec.BizID,
		PayerUserID:          spec.PayerUserID,
		Channel:              channel,
		Scene:                spec.Scene,
		FundScene:            spec.FundScene,
		TerminalType:         spec.TerminalType,
		Subject:              spec.Subject,
		Amount:               spec.Amount,
		AmountCent:           floatToCents(spec.Amount),
		RefundStatus:         model.PaymentRefundStatusNone,
		OutTradeNo:           outTradeNo,
		Status:               model.PaymentStatusLaunching,
		LaunchTokenHash:      tokenHash,
		LaunchTokenExpiredAt: &expiresAt,
		ExpiredAt:            &expiresAt,
		ReturnContext:        returnJSON,
	}
	if err := tx.Create(order).Error; err != nil {
		return nil, err
	}
	if channel == model.PaymentChannelWechat {
		return order, nil
	}
	return decorateLaunchURL(order, rawToken), nil
}

func decorateLaunchURL(order *model.PaymentOrder, rawToken string) *model.PaymentOrder {
	cloned := *order
	cloned.ReturnContext = rawToken
	return &cloned
}

func (s *PaymentService) buildLaunchResponse(payment *model.PaymentOrder, wechatParams *PaymentChannelMiniProgramResult) *PaymentLaunchResponse {
	if payment == nil {
		return nil
	}
	if payment.Channel == model.PaymentChannelWechat && payment.TerminalType == model.PaymentTerminalMiniWechatJSAPI {
		if wechatParams == nil {
			return &PaymentLaunchResponse{
				PaymentID:  payment.ID,
				Channel:    payment.Channel,
				LaunchMode: "wechat_jsapi",
				ExpiresAt:  payment.ExpiredAt,
			}
		}
		return &PaymentLaunchResponse{
			PaymentID:  payment.ID,
			Channel:    payment.Channel,
			LaunchMode: "wechat_jsapi",
			WechatPayParams: &WechatMiniPayParams{
				TimeStamp: wechatParams.TimeStamp,
				NonceStr:  wechatParams.NonceStr,
				Package:   wechatParams.Package,
				SignType:  wechatParams.SignType,
				PaySign:   wechatParams.PaySign,
			},
			ExpiresAt: payment.ExpiredAt,
		}
	}
	launchToken := payment.ReturnContext
	payment.ReturnContext = ""
	if payment.TerminalType == model.PaymentTerminalMiniQR {
		return &PaymentLaunchResponse{
			PaymentID:      payment.ID,
			Channel:        payment.Channel,
			LaunchMode:     "qr_code",
			QRCodeImageURL: buildQRCodeURL(payment.ID, launchToken),
			ExpiresAt:      payment.ExpiredAt,
		}
	}
	return &PaymentLaunchResponse{
		PaymentID:  payment.ID,
		Channel:    payment.Channel,
		LaunchMode: "redirect",
		LaunchURL:  buildLaunchURL(payment.ID, launchToken),
		ExpiresAt:  payment.ExpiredAt,
	}
}

func (s *PaymentService) getChannelService(channel string) (PaymentChannelService, error) {
	normalized := strings.TrimSpace(channel)
	service, ok := s.channels[normalized]
	if ok && service != nil {
		return service, nil
	}
	return nil, errors.New("支付渠道未接入")
}

func (s *PaymentService) ensurePaymentChannelAvailable(channel string) error {
	return (&ConfigService{}).ValidatePaymentChannelEnabled(channel)
}

func (s *PaymentService) ensurePaymentChannelAvailableTx(tx *gorm.DB, channel string) error {
	return (&ConfigService{}).ValidatePaymentChannelEnabledTx(tx, channel)
}

func (s *PaymentService) createMiniProgramLaunch(payment *model.PaymentOrder, openID string) (*PaymentChannelMiniProgramResult, error) {
	return s.createMiniProgramLaunchTx(repository.DB, payment, openID)
}

func (s *PaymentService) createMiniProgramLaunchTx(tx *gorm.DB, payment *model.PaymentOrder, openID string) (*PaymentChannelMiniProgramResult, error) {
	channel, err := s.getChannelService(model.PaymentChannelWechat)
	if err != nil {
		return nil, err
	}
	result, err := channel.CreateMiniProgramPayment(context.Background(), payment, openID)
	if err != nil {
		return nil, err
	}
	_ = tx.Model(&model.PaymentOrder{}).
		Where("id = ? AND status IN ?", payment.ID, []string{model.PaymentStatusCreated, model.PaymentStatusLaunching}).
		Updates(map[string]any{
			"status":              model.PaymentStatusPending,
			"raw_response_digest": digestString(result.RawJSON),
		}).Error
	payment.Status = model.PaymentStatusPending
	payment.RawResponseDigest = digestString(result.RawJSON)
	return result, nil
}

func (s *PaymentService) resolveMiniWechatOpenID(userID uint64) (string, error) {
	return s.resolveMiniWechatOpenIDTx(repository.DB, userID)
}

func (s *PaymentService) resolveMiniWechatOpenIDTx(tx *gorm.DB, userID uint64) (string, error) {
	if userID == 0 {
		return "", errors.New("用户未登录")
	}
	appID := strings.TrimSpace(config.GetConfig().WechatPay.AppID)
	if appID == "" {
		appID = strings.TrimSpace(config.GetConfig().WechatMini.AppID)
	}
	if appID == "" {
		return "", errors.New("微信支付未配置小程序 AppID")
	}
	var binding model.UserWechatBinding
	if err := tx.Where("user_id = ? AND app_id = ?", userID, appID).First(&binding).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return "", errors.New("当前账号未绑定小程序微信，请先使用微信快捷登录")
		}
		return "", err
	}
	if strings.TrimSpace(binding.OpenID) == "" {
		return "", errors.New("当前账号未绑定小程序 OpenID")
	}
	return strings.TrimSpace(binding.OpenID), nil
}

func (s *PaymentService) GetOrderCenterPaymentOptions() []SurveyDepositPaymentOption {
	options := make([]SurveyDepositPaymentOption, 0, 2)
	if s.ensurePaymentChannelAvailable(model.PaymentChannelWechat) == nil {
		options = append(options, SurveyDepositPaymentOption{
			Channel:    model.PaymentChannelWechat,
			Label:      "微信支付",
			LaunchMode: "wechat_jsapi",
		})
	}
	if s.ensurePaymentChannelAvailable(model.PaymentChannelAlipay) == nil {
		options = append(options, SurveyDepositPaymentOption{
			Channel:    model.PaymentChannelAlipay,
			Label:      "支付宝扫码支付",
			LaunchMode: "qr_code",
		})
	}
	return options
}

func (s *PaymentService) GetSurveyDepositPaymentOptions(booking *model.Booking) []SurveyDepositPaymentOption {
	if booking == nil || booking.ID == 0 || booking.SurveyDepositPaid || booking.IntentFeePaid || ensureBookingReadyForDepositPayment(booking) != nil {
		return nil
	}
	return s.GetOrderCenterPaymentOptions()
}

func (s *PaymentService) GetLatestSurveyDepositPaymentID(bookingID uint64) (uint64, error) {
	if bookingID == 0 {
		return 0, nil
	}

	var payment model.PaymentOrder
	if err := repository.DB.
		Select("id").
		Where("biz_id = ? AND biz_type IN ? AND status = ?", bookingID, []string{
			model.PaymentBizTypeBookingIntent,
			model.PaymentBizTypeBookingSurveyDeposit,
		}, model.PaymentStatusPaid).
		Order("paid_at DESC NULLS LAST, id DESC").
		First(&payment).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return 0, nil
		}
		return 0, err
	}

	return payment.ID, nil
}

func validateMiniAlipayH5Runtime() error {
	cfg := config.GetConfig()
	if isMiniAlipayH5SandboxRuntime(cfg.Alipay) {
		return errors.New("支付宝 H5 沙箱环境不支持小程序真机拉起，请改用二维码支付")
	}
	publicURL := strings.TrimSpace(cfg.Server.PublicURL)
	if err := validateMiniAlipayH5URL(publicURL, "SERVER_PUBLIC_URL"); err != nil {
		return err
	}
	returnURL := strings.TrimSpace(cfg.Alipay.ReturnURLH5)
	if err := validateMiniAlipayH5URL(returnURL, "ALIPAY_RETURN_URL_H5"); err != nil {
		return err
	}
	publicHost, err := parsePublicHTTPSHost(publicURL)
	if err != nil {
		return err
	}
	returnHost, err := parsePublicHTTPSHost(returnURL)
	if err != nil {
		return err
	}
	if !sameTrustedRootDomain(publicHost, returnHost) {
		return errors.New("支付宝 H5 返回页域名与服务端公网域名不一致")
	}
	return nil
}

func isMiniAlipayH5SandboxRuntime(cfg config.AlipayConfig) bool {
	if cfg.Sandbox {
		return true
	}
	gatewayURL := strings.ToLower(strings.TrimSpace(cfg.GatewayURL))
	return strings.Contains(gatewayURL, "openapi-sandbox.") || strings.Contains(gatewayURL, "alipaydev.com")
}

func validateMiniAlipayH5URL(rawURL, envName string) error {
	if strings.TrimSpace(rawURL) == "" {
		return fmt.Errorf("支付宝 H5 未配置 %s", envName)
	}
	_, err := parsePublicHTTPSHost(rawURL)
	if err != nil {
		return fmt.Errorf("支付宝 H5 配置无效（%s）: %w", envName, err)
	}
	return nil
}

func parsePublicHTTPSHost(rawURL string) (string, error) {
	parsed, err := url.Parse(strings.TrimSpace(rawURL))
	if err != nil {
		return "", errors.New("URL 解析失败")
	}
	if parsed.Scheme != "https" {
		return "", errors.New("必须使用 HTTPS")
	}
	host := strings.TrimSpace(parsed.Hostname())
	if host == "" {
		return "", errors.New("域名不能为空")
	}
	if parsed.Host == "" {
		return "", errors.New("Host 不能为空")
	}
	if host == "localhost" || host == "127.0.0.1" {
		return "", errors.New("不能使用本地域名")
	}
	if ip := net.ParseIP(host); ip != nil {
		return "", errors.New("不能使用 IP 地址")
	}
	return strings.ToLower(host), nil
}

func sameTrustedRootDomain(leftHost, rightHost string) bool {
	left := rootDomain(leftHost)
	right := rootDomain(rightHost)
	return left != "" && right != "" && left == right
}

func rootDomain(host string) string {
	parts := strings.Split(strings.ToLower(strings.TrimSpace(host)), ".")
	if len(parts) < 2 {
		return ""
	}
	return parts[len(parts)-2] + "." + parts[len(parts)-1]
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
		effect, err = confirmSurveyDepositPaidTx(tx, payment)
	case model.PaymentBizTypeOrder:
		effect, err = confirmOrderPaidTx(tx, payment.BizID)
	case model.PaymentBizTypePaymentPlan:
		effect, err = confirmPaymentPlanPaidTx(tx, payment.BizID)
	case model.PaymentBizTypeMerchantBond:
		err = confirmMerchantBondPaidTx(tx, payment.BizID)
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
	if effect != nil {
		effect.PaymentID = payment.ID
	}
	if err := s.recordPaymentSuccessProjectionTx(tx, payment, effect); err != nil {
		return nil, err
	}
	if err := enqueuePaymentPaidOutboxTx(tx, payment, effect); err != nil {
		return nil, err
	}
	return effect, nil
}

func (s *PaymentService) runPaymentSideEffect(effect *paymentSideEffect) {
	if effect == nil {
		return
	}
	incomeService := &MerchantIncomeService{}
	switch effect.Kind {
	case model.PaymentBizTypeOrder:
		if effect.ProviderID > 0 && effect.OrderType == model.OrderTypeMaterial {
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
		"intent_fee":                 booking.IntentFee,
		"intent_fee_paid":            true,
		"survey_deposit":             booking.IntentFee,
		"survey_deposit_paid":        true,
		"survey_deposit_paid_at":     &now,
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
		UserID:         booking.UserID,
		BookingID:      booking.ID,
		Amount:         booking.IntentFee,
		ProviderUserID: providerUserID,
	}, nil
}

func confirmSurveyDepositPaidTx(tx *gorm.DB, payment *model.PaymentOrder) (*paymentSideEffect, error) {
	var booking model.Booking
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&booking, payment.BizID).Error; err != nil {
		return nil, errors.New("预约不存在")
	}
	if booking.SurveyDepositPaid {
		var provider model.Provider
		providerUserID := uint64(0)
		if err := tx.First(&provider, booking.ProviderID).Error; err == nil {
			providerUserID = provider.UserID
		}
		return &paymentSideEffect{
			Kind:           model.PaymentBizTypeBookingSurveyDeposit,
			UserID:         booking.UserID,
			BookingID:      booking.ID,
			Amount:         payment.Amount,
			ProviderUserID: providerUserID,
		}, nil
	}
	now := time.Now()
	if err := tx.Model(&booking).Updates(map[string]any{
		"intent_fee":                 payment.Amount,
		"intent_fee_paid":            true,
		"survey_deposit":             payment.Amount,
		"survey_deposit_paid":        true,
		"survey_deposit_paid_at":     &now,
		"merchant_response_deadline": now.Add(48 * time.Hour),
	}).Error; err != nil {
		return nil, err
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
		return nil, err
	}
	if err := businessFlowSvc.AdvanceBySource(tx, model.BusinessFlowSourceBooking, booking.ID, map[string]any{
		"current_stage": model.BusinessFlowStageSurveyDepositPending,
	}); err != nil {
		return nil, err
	}
	var provider model.Provider
	providerUserID := uint64(0)
	if err := tx.First(&provider, booking.ProviderID).Error; err == nil {
		providerUserID = provider.UserID
	}
	return &paymentSideEffect{
		Kind:           model.PaymentBizTypeBookingSurveyDeposit,
		UserID:         booking.UserID,
		BookingID:      booking.ID,
		Amount:         payment.Amount,
		ProviderUserID: providerUserID,
	}, nil
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
	order.Status = model.OrderStatusPaid
	order.PaidAmount = amount
	order.PaidAt = &now
	if err := syncPaidOrderPlansTx(tx, &order); err != nil {
		return nil, err
	}
	effect := &paymentSideEffect{Kind: model.PaymentBizTypeOrder, OrderID: order.ID, Amount: amount, OrderType: order.OrderType}
	if order.BookingID > 0 {
		var booking model.Booking
		if err := tx.First(&booking, order.BookingID).Error; err == nil {
			effect.UserID = booking.UserID
			effect.BookingID = booking.ID
			var provider model.Provider
			if err := tx.First(&provider, booking.ProviderID).Error; err == nil {
				effect.ProviderID = provider.ID
				effect.ProviderUserID = provider.UserID
			}
			if order.OrderType == model.OrderTypeDesign {
				if err := businessFlowSvc.AdvanceBySource(tx, model.BusinessFlowSourceBooking, booking.ID, map[string]any{
					"current_stage": model.BusinessFlowStageDesignDeliveryPending,
				}); err != nil {
					return nil, err
				}
			}
		}
	}
	if effect.BookingID == 0 && order.ProposalID > 0 {
		var proposal model.Proposal
		if err := tx.First(&proposal, order.ProposalID).Error; err == nil {
			var booking model.Booking
			if err := tx.First(&booking, proposal.BookingID).Error; err == nil {
				effect.UserID = booking.UserID
				effect.BookingID = booking.ID
				var provider model.Provider
				if err := tx.First(&provider, booking.ProviderID).Error; err == nil {
					effect.ProviderID = provider.ID
					effect.ProviderUserID = provider.UserID
				}
			}
		}
	}
	if order.ProjectID > 0 {
		var project model.Project
		if err := tx.First(&project, order.ProjectID).Error; err == nil {
			effect.UserID = project.OwnerID
			effect.ProjectID = project.ID
			if effect.ProviderID == 0 {
				var provider model.Provider
				if err := tx.First(&provider, project.ProviderID).Error; err == nil {
					effect.ProviderID = provider.ID
					effect.ProviderUserID = provider.UserID
				}
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

func confirmPaymentPlanPaidTx(tx *gorm.DB, planID uint64) (*paymentSideEffect, error) {
	var plan model.PaymentPlan
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&plan, planID).Error; err != nil {
		return nil, errors.New("支付计划不存在")
	}
	if plan.Status != 0 {
		return &paymentSideEffect{
			Kind:     model.PaymentBizTypePaymentPlan,
			OrderID:  plan.OrderID,
			Amount:   plan.Amount,
			PlanName: strings.TrimSpace(plan.Name),
		}, nil
	}
	var order model.Order
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&order, plan.OrderID).Error; err != nil {
		return nil, errors.New("订单不存在")
	}
	var project model.Project
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&project, order.ProjectID).Error; err != nil {
		return nil, errors.New("项目不存在")
	}
	if plan.Seq > 1 {
		var prevPlan model.PaymentPlan
		if err := tx.Where("order_id = ? AND seq = ?", plan.OrderID, plan.Seq-1).First(&prevPlan).Error; err == nil && prevPlan.Status == 0 {
			return nil, errors.New("请先支付上一期款项")
		}
	}
	if payable, reason := evaluatePaymentPlanState(&plan, &project, nil, time.Now()); !payable {
		return nil, errors.New(reason)
	}
	now := time.Now()
	if err := tx.Model(&plan).Updates(map[string]any{"status": 1, "paid_at": &now}).Error; err != nil {
		return nil, err
	}
	if plan.MilestoneID > 0 {
		var milestone model.Milestone
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&milestone, plan.MilestoneID).Error; err != nil {
			return nil, errors.New("验收节点不存在")
		}
		milestoneUpdates := map[string]any{}
		if milestone.PaidAt == nil {
			milestoneUpdates["paid_at"] = &now
		}
		if milestone.Status == model.MilestoneStatusPending {
			milestoneUpdates["status"] = model.MilestoneStatusInProgress
		}
		if len(milestoneUpdates) > 0 {
			if err := tx.Model(&milestone).Updates(milestoneUpdates).Error; err != nil {
				return nil, err
			}
		}
	}
	newPaidAmount := normalizeAmount(order.PaidAmount + plan.Amount)
	updates := map[string]any{"paid_amount": newPaidAmount}
	if newPaidAmount >= normalizeAmount(order.TotalAmount) {
		updates["status"] = model.OrderStatusPaid
		updates["paid_at"] = &now
	}
	if err := tx.Model(&order).Updates(updates).Error; err != nil {
		return nil, err
	}
	if order.OrderType == model.OrderTypeConstruction && project.PaymentPaused {
		if err := (&ProjectService{}).resumeProjectExecutionAfterPaymentTx(tx, &project); err != nil {
			return nil, err
		}
	}
	providerID := effectiveProjectProviderID(&project)
	providerUserID := getProviderUserIDTx(tx, providerID)
	return &paymentSideEffect{
		Kind:           model.PaymentBizTypePaymentPlan,
		UserID:         project.OwnerID,
		OrderID:        order.ID,
		ProjectID:      project.ID,
		ProviderID:     providerID,
		ProviderUserID: providerUserID,
		MilestoneID:    plan.MilestoneID,
		Amount:         plan.Amount,
		OrderType:      order.OrderType,
		PlanName:       strings.TrimSpace(plan.Name),
	}, nil
}

func buildPaidOrderReceiptCopy(orderType string, amount float64, planName string) (string, string) {
	label := "订单"
	switch orderType {
	case model.OrderTypeDesign:
		label = "设计费"
	case model.OrderTypeConstruction:
		label = "施工款"
	case model.OrderTypeMaterial:
		label = "主材款"
	}
	if strings.TrimSpace(planName) != "" {
		return "支付成功", fmt.Sprintf("%s已支付成功，金额 %.2f 元。", strings.TrimSpace(planName), amount)
	}
	return "支付成功", fmt.Sprintf("%s支付成功，金额 %.2f 元。", label, amount)
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

func buildRefundNotifyID(outRefundNo, rawPayload string) string {
	key := strings.TrimSpace(outRefundNo)
	if key == "" {
		key = "unknown"
	}
	digest := digestString(rawPayload)
	if digest == "" {
		digest = digestString(key)
	}
	if len(digest) > 32 {
		digest = digest[:32]
	}
	return fmt.Sprintf("wechat_refund:%s:%s", key, digest)
}

func refundProjectionStatus(amount, refundedAmount float64) string {
	amountCent := floatToCents(amount)
	refundedCent := floatToCents(refundedAmount)
	if refundedCent <= 0 {
		return model.PaymentRefundStatusNone
	}
	if amountCent > 0 && refundedCent >= amountCent {
		return model.PaymentRefundStatusRefunded
	}
	return model.PaymentRefundStatusPartialRefunded
}

func (s *PaymentService) refreshRefundProjectionByRefundOrderID(refundOrderID uint64) error {
	if refundOrderID == 0 {
		return nil
	}
	return repository.DB.Transaction(func(tx *gorm.DB) error {
		var refund model.RefundOrder
		if err := tx.First(&refund, refundOrderID).Error; err != nil {
			return err
		}
		return s.refreshRefundProjectionTx(tx, refund.PaymentOrderID)
	})
}

func (s *PaymentService) refreshRefundProjectionTx(tx *gorm.DB, paymentOrderID uint64) error {
	if tx == nil {
		tx = repository.DB
	}
	if paymentOrderID == 0 {
		return nil
	}
	var payment model.PaymentOrder
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&payment, paymentOrderID).Error; err != nil {
		return err
	}
	var refundedAmount float64
	if err := tx.Model(&model.RefundOrder{}).
		Where("payment_order_id = ? AND status = ?", payment.ID, model.RefundOrderStatusSucceeded).
		Select("COALESCE(SUM(amount), 0)").
		Scan(&refundedAmount).Error; err != nil {
		return err
	}
	refundedAmount = normalizeAmount(refundedAmount)
	if err := tx.Model(&payment).Updates(map[string]any{
		"refunded_amount":      refundedAmount,
		"refunded_amount_cent": floatToCents(refundedAmount),
		"refund_status":        refundProjectionStatus(payment.Amount, refundedAmount),
	}).Error; err != nil {
		return err
	}

	if payment.BizType != model.PaymentBizTypePaymentPlan || payment.BizID == 0 {
		return nil
	}
	var plan model.PaymentPlan
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&plan, payment.BizID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil
		}
		return err
	}
	var planRefundedAmount float64
	if err := tx.Table("refund_orders AS r").
		Joins("JOIN payment_orders AS p ON p.id = r.payment_order_id").
		Where("p.biz_type = ? AND p.biz_id = ? AND r.status = ?", model.PaymentBizTypePaymentPlan, plan.ID, model.RefundOrderStatusSucceeded).
		Select("COALESCE(SUM(r.amount), 0)").
		Scan(&planRefundedAmount).Error; err != nil {
		return err
	}
	planRefundedAmount = normalizeAmount(planRefundedAmount)
	return tx.Model(&plan).Updates(map[string]any{
		"refunded_amount":      planRefundedAmount,
		"refunded_amount_cent": floatToCents(planRefundedAmount),
		"refund_status":        refundProjectionStatus(plan.Amount, planRefundedAmount),
	}).Error
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
		return &order, nil
	}
	if order.BookingID > 0 {
		var booking model.Booking
		if err := tx.First(&booking, order.BookingID).Error; err != nil {
			return nil, errors.New("关联预约不存在")
		}
		if booking.UserID != userID {
			return nil, errors.New("无权操作此订单")
		}
		return &order, nil
	}
	if order.ProposalID > 0 {
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
		return &order, nil
	}
	return nil, errors.New("订单数据异常")
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
	var milestone *model.Milestone
	if plan.MilestoneID > 0 {
		var current model.Milestone
		if err := tx.First(&current, plan.MilestoneID).Error; err == nil {
			milestone = &current
		}
	}
	applyPaymentPlanState(&plan, &project, milestone)
	if !plan.Payable {
		return nil, nil, nil, errors.New(plan.PayableReason)
	}
	return &plan, &order, &project, nil
}

func applyPaymentPlanState(plan *model.PaymentPlan, project *model.Project, milestone *model.Milestone) {
	if plan == nil {
		return
	}
	plan.PlanType = plan.Type
	plan.ExpiresAt = plan.DueAt
	plan.Payable, plan.PayableReason = evaluatePaymentPlanState(plan, project, milestone, time.Now())
}

func evaluatePaymentPlanState(plan *model.PaymentPlan, project *model.Project, milestone *model.Milestone, now time.Time) (bool, string) {
	if plan == nil {
		return false, "支付计划不存在"
	}
	switch plan.Status {
	case model.PaymentPlanStatusPaid:
		return false, "该期款项已支付"
	case model.PaymentPlanStatusExpired:
		return false, "该期款项已失效"
	}
	if plan.ActivatedAt == nil {
		if project == nil && milestone == nil && strings.TrimSpace(plan.Type) == "" {
			// 兼容历史施工计划数据：旧数据没有激活时间和节点绑定时，仍按待支付处理。
			return true, ""
		}
		switch strings.TrimSpace(plan.Type) {
		case "down_payment":
			return false, "首付款尚未激活"
		case "final_payment":
			return false, "最终验收通过后方可支付尾款"
		case "change_order":
			return false, "待变更确认后生成支付"
		default:
			if milestone != nil && strings.TrimSpace(milestone.Name) != "" {
				return false, fmt.Sprintf("节点“%s”通过后方可支付", milestone.Name)
			}
			return false, "当前款项尚未激活"
		}
	}
	if plan.DueAt != nil && now.After(*plan.DueAt) {
		return false, "该期款项已失效"
	}
	if strings.TrimSpace(plan.Type) == "final_payment" && project != nil && project.BusinessStatus != model.ProjectBusinessStatusCompleted {
		return false, "最终验收通过后方可支付尾款"
	}
	return true, ""
}

func activatePaymentPlanTx(tx *gorm.DB, plan *model.PaymentPlan, activatedAt time.Time) error {
	if tx == nil || plan == nil || plan.ID == 0 {
		return errors.New("支付计划不存在")
	}
	dueAt := activatedAt.Add(constructionPaymentPlanActiveWindow)
	updates := map[string]any{
		"activated_at": &activatedAt,
		"due_at":       &dueAt,
		"status":       model.PaymentPlanStatusPending,
	}
	if err := tx.Model(&model.PaymentPlan{}).Where("id = ?", plan.ID).Updates(updates).Error; err != nil {
		return err
	}
	plan.ActivatedAt = &activatedAt
	plan.DueAt = &dueAt
	plan.Status = model.PaymentPlanStatusPending
	return tx.Model(&model.Order{}).Where("id = ?", plan.OrderID).Update("expire_at", &dueAt).Error
}

func expirePendingPaymentPlansByOrderTx(tx *gorm.DB, orderID uint64) ([]model.PaymentPlan, error) {
	if tx == nil || orderID == 0 {
		return nil, nil
	}
	var plans []model.PaymentPlan
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
		Where("order_id = ? AND status = ?", orderID, model.PaymentPlanStatusPending).
		Find(&plans).Error; err != nil {
		return nil, err
	}
	if len(plans) == 0 {
		return []model.PaymentPlan{}, nil
	}
	ids := make([]uint64, 0, len(plans))
	for _, plan := range plans {
		ids = append(ids, plan.ID)
	}
	if err := tx.Model(&model.PaymentPlan{}).
		Where("id IN ?", ids).
		Updates(map[string]any{"status": model.PaymentPlanStatusExpired}).Error; err != nil {
		return nil, err
	}
	for idx := range plans {
		plans[idx].Status = model.PaymentPlanStatusExpired
	}
	return plans, nil
}

func ExpirePendingPaymentPlansForCron(tx *gorm.DB, orderID uint64) ([]model.PaymentPlan, error) {
	return expirePendingPaymentPlansByOrderTx(tx, orderID)
}

func findFinalConstructionPaymentPlanTx(tx *gorm.DB, projectID uint64) (*model.PaymentPlan, error) {
	if tx == nil || projectID == 0 {
		return nil, nil
	}
	var plan model.PaymentPlan
	err := tx.
		Joins("JOIN orders ON orders.id = payment_plans.order_id").
		Where("orders.project_id = ? AND orders.order_type = ? AND payment_plans.type = ?", projectID, model.OrderTypeConstruction, "final_payment").
		Order("payment_plans.seq DESC, payment_plans.id DESC").
		First(&plan).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &plan, nil
}

func resolveBookingSurveyDepositAmountTx(tx *gorm.DB, booking *model.Booking) (float64, error) {
	if booking == nil || booking.ID == 0 {
		return 0, errors.New("预约不存在")
	}
	depositAmount := normalizeAmount(booking.SurveyDeposit)
	if depositAmount <= 0 {
		var provider model.Provider
		if err := tx.First(&provider, booking.ProviderID).Error; err == nil && provider.SurveyDepositPrice > 0 {
			depositAmount = normalizeAmount(provider.SurveyDepositPrice)
		}
	}
	if depositAmount <= 0 {
		fallbackAmount, err := configSvc.GetSurveyDepositDefaultTx(tx)
		if err != nil {
			fallbackAmount = 500
		}
		depositAmount = normalizeAmount(fallbackAmount)
	}
	return normalizeAmount(depositAmount), nil
}

func normalizePaymentChannelAndTerminal(channel, terminalType string) (string, string, error) {
	normalizedTerminal := strings.TrimSpace(terminalType)
	normalizedChannel := strings.TrimSpace(channel)
	if normalizedChannel == "" {
		normalizedChannel = defaultPaymentChannelForTerminal(normalizedTerminal)
	}
	switch normalizedChannel {
	case model.PaymentChannelAlipay:
		switch normalizedTerminal {
		case "", model.PaymentTerminalPCWeb:
			return normalizedChannel, model.PaymentTerminalPCWeb, nil
		case model.PaymentTerminalMobileH5:
			return normalizedChannel, model.PaymentTerminalMobileH5, nil
		case model.PaymentTerminalMiniQR:
			return normalizedChannel, model.PaymentTerminalMiniQR, nil
		default:
			return "", "", errors.New("支付宝不支持当前支付终端")
		}
	case model.PaymentChannelWechat:
		switch normalizedTerminal {
		case "", model.PaymentTerminalMiniWechatJSAPI:
			return normalizedChannel, model.PaymentTerminalMiniWechatJSAPI, nil
		default:
			return "", "", errors.New("微信支付仅支持小程序内支付")
		}
	default:
		return "", "", errors.New("不支持的支付渠道")
	}
}

func defaultPaymentChannelForTerminal(terminalType string) string {
	switch strings.TrimSpace(terminalType) {
	case model.PaymentTerminalMiniWechatJSAPI:
		return model.PaymentChannelWechat
	case model.PaymentTerminalMiniQR, model.PaymentTerminalMobileH5, model.PaymentTerminalPCWeb, "":
		return model.PaymentChannelAlipay
	default:
		return model.PaymentChannelAlipay
	}
}

func ensureBookingReadyForDepositPayment(booking *model.Booking) error {
	if booking == nil || booking.ID == 0 {
		return errors.New("预约不存在")
	}
	if booking.Status == 2 {
		return nil
	}
	if booking.Status == 4 {
		return errors.New("预约已关闭，不能支付量房费")
	}
	return errors.New("请等待服务商确认预约后再支付量房费")
}

func confirmMerchantBondPaidTx(tx *gorm.DB, providerID uint64) error {
	var provider model.Provider
	if err := tx.Select("id").First(&provider, providerID).Error; err != nil {
		return errors.New("服务商不存在")
	}
	return nil
}

func resolvePaymentExpiryMinutes(channel string) int {
	switch strings.TrimSpace(channel) {
	case model.PaymentChannelWechat:
		return maxInt(config.GetConfig().WechatPay.TimeoutMinutes, 15)
	default:
		return maxInt(config.GetConfig().Alipay.TimeoutMinutes, 15)
	}
}

func interpretPaymentTradeState(channel, tradeStatus string) string {
	switch strings.TrimSpace(channel) {
	case model.PaymentChannelWechat:
		switch strings.ToUpper(strings.TrimSpace(tradeStatus)) {
		case "SUCCESS":
			return model.PaymentStatusPaid
		case "CLOSED", "REVOKED":
			return model.PaymentStatusClosed
		case "PAYERROR":
			return model.PaymentStatusFailed
		default:
			return model.PaymentStatusPending
		}
	default:
		switch strings.TrimSpace(tradeStatus) {
		case alipayTradeSuccess, alipayTradeFinished:
			return model.PaymentStatusPaid
		case alipayTradeClosed:
			return model.PaymentStatusClosed
		default:
			return model.PaymentStatusPending
		}
	}
}

func resolveQueriedPaymentStatus(order *model.PaymentOrder, result *PaymentChannelTradeResult) string {
	if order == nil || result == nil {
		return model.PaymentStatusPending
	}
	if strings.TrimSpace(order.Channel) == model.PaymentChannelAlipay {
		switch strings.TrimSpace(result.TradeStatus) {
		case alipayTradeSuccess, alipayTradeFinished:
			return model.PaymentStatusPaid
		case alipayTradeClosed:
			return model.PaymentStatusClosed
		case alipayTradeWaitBuyerPay:
			if strings.TrimSpace(result.ProviderTradeNo) != "" || strings.TrimSpace(result.BuyerLogonID) != "" {
				return model.PaymentStatusScanPending
			}
			return model.PaymentStatusPending
		default:
			return model.PaymentStatusPending
		}
	}
	return interpretPaymentTradeState(order.Channel, result.TradeStatus)
}

func normalizeReturnBaseURL(raw string) string {
	value := strings.TrimSpace(raw)
	if value == "" {
		return ""
	}
	parsed, err := url.Parse(value)
	if err != nil {
		return ""
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return ""
	}
	if parsed.Host == "" {
		return ""
	}
	parsed.RawQuery = ""
	parsed.Fragment = ""
	return strings.TrimRight(parsed.String(), "?")
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

func buildQRCodeURL(paymentID uint64, token string) string {
	base := "/api/v1/payments/%d/qr?token=%s"
	serverPublic := strings.TrimSpace(config.GetConfig().Server.PublicURL)
	path := fmt.Sprintf(base, paymentID, url.QueryEscape(token))
	if serverPublic == "" {
		return path
	}
	return strings.TrimRight(serverPublic, "/") + path
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
	if order.BookingID > 0 && order.OrderType == model.OrderTypeDesign {
		return fmt.Sprintf("/bookings/%d", order.BookingID)
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
	if order.BookingID > 0 && order.OrderType == model.OrderTypeDesign {
		return fmt.Sprintf("/bookings/%d/design-quote", order.BookingID)
	}
	if order.ProjectID > 0 {
		return fmt.Sprintf("/projects/%d", order.ProjectID)
	}
	return "/me/orders"
}

func paymentStatusText(status string) string {
	switch strings.TrimSpace(status) {
	case model.PaymentStatusPaid:
		return "已支付"
	case model.PaymentStatusClosed:
		return "已关闭"
	case model.PaymentStatusFailed:
		return "支付失败"
	case model.PaymentStatusLaunching:
		return "拉起中"
	case model.PaymentStatusPending:
		return "待支付"
	case model.PaymentStatusScanPending:
		return "已扫码待支付"
	default:
		return "待支付"
	}
}

func shouldSyncPaymentState(status string) bool {
	switch strings.TrimSpace(status) {
	case model.PaymentStatusCreated, model.PaymentStatusLaunching, model.PaymentStatusPending, model.PaymentStatusScanPending:
		return true
	default:
		return false
	}
}

func syncablePaymentStatuses() []string {
	return []string{
		model.PaymentStatusCreated,
		model.PaymentStatusLaunching,
		model.PaymentStatusPending,
		model.PaymentStatusScanPending,
	}
}

func paymentChannelText(channel string) string {
	switch strings.TrimSpace(channel) {
	case model.PaymentChannelAlipay:
		return "支付宝"
	case model.PaymentChannelWechat:
		return "微信支付"
	case "bank_transfer":
		return "银行转账"
	default:
		if strings.TrimSpace(channel) == "" {
			return "待分配"
		}
		return strings.TrimSpace(channel)
	}
}

func paymentTerminalText(terminalType string) string {
	switch strings.TrimSpace(terminalType) {
	case model.PaymentTerminalPCWeb:
		return "网页端"
	case model.PaymentTerminalMobileH5:
		return "手机网页"
	case model.PaymentTerminalMiniQR:
		return "小程序扫码"
	case model.PaymentTerminalMiniWechatJSAPI:
		return "小程序微信支付"
	default:
		if strings.TrimSpace(terminalType) == "" {
			return "待补充"
		}
		return strings.TrimSpace(terminalType)
	}
}

func paymentBizTypeText(bizType string) string {
	switch strings.TrimSpace(bizType) {
	case model.PaymentBizTypeBookingIntent:
		return "量房费"
	case model.PaymentBizTypeBookingSurveyDeposit:
		return "量房费"
	case model.PaymentBizTypeOrder:
		return "订单支付"
	case model.PaymentBizTypePaymentPlan:
		return "阶段款支付"
	case model.PaymentBizTypeMerchantBond:
		return "保证金"
	default:
		if strings.TrimSpace(bizType) == "" {
			return "支付记录"
		}
		return strings.TrimSpace(bizType)
	}
}

func paymentFundSceneText(fundScene string) string {
	switch strings.TrimSpace(fundScene) {
	case model.FundSceneSurveyDeposit:
		return "量房费"
	case model.FundSceneDesignFee:
		return "设计费"
	case model.FundSceneConstructionStage:
		return "施工阶段款"
	case model.FundSceneEntryFee:
		return "入驻费用"
	case model.FundSceneMerchantDeposit:
		return "商家保证金"
	case model.FundSceneRefund:
		return "退款"
	case model.FundSceneSettlementPayout:
		return "结算打款"
	default:
		if strings.TrimSpace(fundScene) == "" {
			return "支付款项"
		}
		return strings.TrimSpace(fundScene)
	}
}

func paymentPurposeText(payment *model.PaymentOrder) string {
	if payment == nil {
		return "支付记录"
	}
	if subject := strings.TrimSpace(payment.Subject); subject != "" {
		return subject
	}
	return paymentBizTypeText(payment.BizType)
}

func paymentUsageDescription(payment *model.PaymentOrder) string {
	if payment == nil {
		return "这笔款项用于当前业务流程的支付确认。"
	}
	switch payment.BizType {
	case model.PaymentBizTypeBookingSurveyDeposit:
		return "这笔款项用于确认本次量房安排。支付成功后，服务商可继续推进上门量房、预算沟通和后续方案服务。"
	case model.PaymentBizTypeBookingIntent:
		return "这笔款项用于锁定当前预约意向，便于服务商继续跟进需求沟通与服务安排。"
	case model.PaymentBizTypePaymentPlan:
		return "这笔款项对应项目阶段支付，用于推进当前施工节点或合同约定的阶段结算。"
	case model.PaymentBizTypeOrder:
		return "这笔款项对应正式订单支付，平台会按项目流程记录支付状态并同步后续进度。"
	case model.PaymentBizTypeMerchantBond:
		return "这笔款项对应商家保证金支付，用于平台准入和履约保障。"
	default:
		return "这笔款项用于当前业务流程的支付确认。"
	}
}

func paymentDetailActionPath(payment *model.PaymentOrder) string {
	if payment == nil {
		return "/me/orders"
	}
	switch payment.BizType {
	case model.PaymentBizTypeBookingIntent, model.PaymentBizTypeBookingSurveyDeposit:
		if payment.BizID > 0 {
			return fmt.Sprintf("/bookings/%d", payment.BizID)
		}
	case model.PaymentBizTypeOrder:
		if payment.BizID > 0 {
			var order model.Order
			if err := repository.DB.Select("id", "project_id").First(&order, payment.BizID).Error; err == nil {
				return resolveOrderSuccessPath(&order)
			}
		}
	case model.PaymentBizTypePaymentPlan:
		if payment.BizID > 0 {
			var plan model.PaymentPlan
			if err := repository.DB.Select("id", "order_id").First(&plan, payment.BizID).Error; err == nil && plan.OrderID > 0 {
				var order model.Order
				if err := repository.DB.Select("id", "project_id").First(&order, plan.OrderID).Error; err == nil {
					return resolveOrderSuccessPath(&order)
				}
			}
		}
	}
	return "/me/orders"
}

func paymentProviderRoleText(bookingProviderType, providerSubType string, providerType int8) string {
	switch strings.TrimSpace(bookingProviderType) {
	case "company":
		return "装修公司"
	case "worker", "foreman":
		return "工长"
	case "designer":
		return "设计师"
	}

	switch strings.TrimSpace(providerSubType) {
	case "company":
		return "装修公司"
	case "foreman", "worker":
		return "工长"
	case "designer":
		return "设计师"
	}

	switch providerType {
	case 2:
		return "装修公司"
	case 3:
		return "工长"
	default:
		return "设计师"
	}
}

func (s *PaymentService) enrichPaymentDetail(detail *PaymentDetailResponse, payment *model.PaymentOrder) error {
	if detail == nil || payment == nil {
		return nil
	}

	switch payment.BizType {
	case model.PaymentBizTypeBookingIntent, model.PaymentBizTypeBookingSurveyDeposit:
		var booking model.Booking
		if err := repository.DB.Select("id", "provider_id", "provider_type", "address").First(&booking, payment.BizID).Error; err != nil {
			return errors.New("关联预约不存在")
		}
		detail.ReferenceNo = fmt.Sprintf("BK%08d", booking.ID)
		detail.ReferenceLabel = "预约编号"
		detail.Booking = &PaymentDetailBooking{
			ID:      booking.ID,
			Address: booking.Address,
		}
		detail.ActionPath = fmt.Sprintf("/bookings/%d", booking.ID)
		provider, err := loadPaymentProviderDetail(booking.ProviderID, booking.ProviderType)
		if err != nil {
			return err
		}
		detail.Provider = provider
	case model.PaymentBizTypeOrder, model.PaymentBizTypePaymentPlan:
		order, booking, project, err := loadOrderContextForPayment(payment)
		if err != nil {
			return err
		}
		if order != nil {
			detail.ReferenceNo = strings.TrimSpace(order.OrderNo)
			detail.ReferenceLabel = "订单编号"
			detail.ActionPath = resolveOrderSuccessPath(order)
		}
		if booking != nil {
			detail.Booking = &PaymentDetailBooking{
				ID:      booking.ID,
				Address: booking.Address,
			}
		}

		var providerID uint64
		if booking != nil {
			providerID = booking.ProviderID
		}
		if providerID == 0 && project != nil {
			providerID = project.ProviderID
		}
		if providerID > 0 {
			bookingProviderType := ""
			if booking != nil {
				bookingProviderType = booking.ProviderType
			}
			provider, err := loadPaymentProviderDetail(providerID, bookingProviderType)
			if err != nil {
				return err
			}
			detail.Provider = provider
		}
	}

	return nil
}

func loadOrderContextForPayment(payment *model.PaymentOrder) (*model.Order, *model.Booking, *model.Project, error) {
	if payment == nil {
		return nil, nil, nil, nil
	}

	var order model.Order
	switch payment.BizType {
	case model.PaymentBizTypeOrder:
		if err := repository.DB.First(&order, payment.BizID).Error; err != nil {
			return nil, nil, nil, errors.New("关联订单不存在")
		}
	case model.PaymentBizTypePaymentPlan:
		var plan model.PaymentPlan
		if err := repository.DB.First(&plan, payment.BizID).Error; err != nil {
			return nil, nil, nil, errors.New("关联付款计划不存在")
		}
		if err := repository.DB.First(&order, plan.OrderID).Error; err != nil {
			return nil, nil, nil, errors.New("关联订单不存在")
		}
	default:
		return nil, nil, nil, nil
	}

	orderService := &OrderService{}
	booking, project, err := orderService.resolveBookingAndProject(&order)
	if err != nil {
		return &order, nil, nil, err
	}
	return &order, booking, project, nil
}

func loadPaymentProviderDetail(providerID uint64, bookingProviderType string) (*PaymentDetailProvider, error) {
	if providerID == 0 {
		return nil, nil
	}

	var provider model.Provider
	if err := repository.DB.Select("id", "user_id", "company_name", "avatar", "provider_type", "sub_type", "verified").First(&provider, providerID).Error; err != nil {
		return nil, errors.New("关联服务商不存在")
	}

	var user model.User
	_ = repository.DB.Select("id", "nickname", "avatar").First(&user, provider.UserID).Error

	name := strings.TrimSpace(user.Nickname)
	if name == "" {
		name = ResolveProviderDisplayName(provider, &user)
	}
	avatar := strings.TrimSpace(user.Avatar)
	if avatar == "" {
		avatar = ResolveProviderAvatarPath(provider)
	}

	return &PaymentDetailProvider{
		ID:       provider.ID,
		Name:     name,
		RoleText: paymentProviderRoleText(bookingProviderType, provider.SubType, provider.ProviderType),
		Avatar:   imgutil.GetFullImageURL(avatar),
		Verified: provider.Verified,
	}, nil
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
			return nil, errors.New("量房费退款金额必须等于可退金额")
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
				return nil, errors.New("全额退款不能对量房费做部分退款")
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

	outRefundNo, err := generateOutRefundNo(payment.FundScene)
	if err != nil {
		return nil, err
	}

	refund := &model.RefundOrder{
		PaymentOrderID:      payment.ID,
		BizType:             plan.BizType,
		BizID:               plan.BizID,
		FundScene:           payment.FundScene,
		RefundApplicationID: refundApplicationID,
		OutRefundNo:         outRefundNo,
		Amount:              plan.Amount,
		AmountCent:          floatToCents(plan.Amount),
		Reason:              strings.TrimSpace(plan.Reason),
		Status:              model.RefundOrderStatusCreated,
	}
	if err := tx.Create(refund).Error; err != nil {
		return nil, err
	}
	return refund, nil
}

func resolveOrderFundScene(order *model.Order) string {
	if order == nil {
		return ""
	}
	switch order.OrderType {
	case model.OrderTypeDesign:
		return model.FundSceneDesignFee
	case model.OrderTypeConstruction:
		return model.FundSceneConstructionStage
	default:
		return ""
	}
}

func (s *PaymentService) recordPaymentSuccessProjectionTx(tx *gorm.DB, payment *model.PaymentOrder, effect *paymentSideEffect) error {
	if tx == nil || payment == nil || strings.TrimSpace(payment.FundScene) == "" {
		return nil
	}
	projectID, providerID, milestoneID, err := resolvePaymentProjectionScopeTx(tx, payment, effect)
	if err != nil {
		return err
	}
	if err := (&LedgerService{}).RecordPaymentReceivedTx(tx, payment, projectID, providerID); err != nil {
		return err
	}
	if strings.TrimSpace(payment.FundScene) == model.FundSceneMerchantDeposit && providerID > 0 {
		if _, err := NewBondService().SyncProviderBondAccountTx(tx, providerID); err != nil {
			return err
		}
	}
	if projectID == 0 || !shouldProjectToEscrow(payment.FundScene) {
		return nil
	}
	return syncEscrowDepositProjectionTx(tx, projectID, payment, milestoneID)
}

func resolvePaymentProjectionScopeTx(tx *gorm.DB, payment *model.PaymentOrder, effect *paymentSideEffect) (uint64, uint64, uint64, error) {
	if payment == nil {
		return 0, 0, 0, nil
	}
	if effect != nil && effect.ProjectID > 0 {
		return effect.ProjectID, effect.ProviderID, effect.MilestoneID, nil
	}
	switch payment.BizType {
	case model.PaymentBizTypeOrder:
		var order model.Order
		if err := tx.Select("id, project_id").First(&order, payment.BizID).Error; err != nil {
			return 0, 0, 0, err
		}
		if order.ProjectID == 0 {
			return 0, 0, 0, nil
		}
		var project model.Project
		if err := tx.Select("id, provider_id, construction_provider_id").First(&project, order.ProjectID).Error; err != nil {
			return 0, 0, 0, err
		}
		providerID := project.ConstructionProviderID
		if providerID == 0 {
			providerID = project.ProviderID
		}
		return project.ID, providerID, 0, nil
	case model.PaymentBizTypePaymentPlan:
		var plan model.PaymentPlan
		if err := tx.Select("id, order_id, milestone_id").First(&plan, payment.BizID).Error; err != nil {
			return 0, 0, 0, err
		}
		var order model.Order
		if err := tx.Select("id, project_id").First(&order, plan.OrderID).Error; err != nil {
			return 0, 0, 0, err
		}
		if order.ProjectID == 0 {
			return 0, 0, plan.MilestoneID, nil
		}
		var project model.Project
		if err := tx.Select("id, provider_id, construction_provider_id").First(&project, order.ProjectID).Error; err != nil {
			return 0, 0, 0, err
		}
		providerID := project.ConstructionProviderID
		if providerID == 0 {
			providerID = project.ProviderID
		}
		return project.ID, providerID, plan.MilestoneID, nil
	case model.PaymentBizTypeMerchantBond:
		var provider model.Provider
		if err := tx.Select("id").First(&provider, payment.BizID).Error; err != nil {
			return 0, 0, 0, err
		}
		return 0, provider.ID, 0, nil
	default:
		return 0, 0, 0, nil
	}
}

func shouldProjectToEscrow(fundScene string) bool {
	switch strings.TrimSpace(fundScene) {
	case model.FundSceneDesignFee, model.FundSceneConstructionStage:
		return true
	default:
		return false
	}
}

func syncEscrowDepositProjectionTx(tx *gorm.DB, projectID uint64, payment *model.PaymentOrder, milestoneID uint64) error {
	if projectID == 0 || payment == nil || payment.ID == 0 || payment.Amount <= 0 {
		return nil
	}
	orderID := fmt.Sprintf("PAY-%d", payment.ID)
	var existing model.Transaction
	if err := tx.Where("order_id = ?", orderID).First(&existing).Error; err == nil {
		return nil
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}
	escrow, err := ensureProjectEscrowAccountTx(tx, projectID)
	if err != nil {
		return err
	}
	if escrow == nil {
		return errors.New("托管账户不存在")
	}
	escrow.TotalAmount = normalizeAmount(escrow.TotalAmount + payment.Amount)
	escrow.AvailableAmount = normalizeAmount(escrow.AvailableAmount + payment.Amount)
	escrow.Status = reconcileEscrowStatus(escrow)
	if err := tx.Save(escrow).Error; err != nil {
		return err
	}
	completedAt := payment.PaidAt
	if completedAt == nil {
		now := time.Now()
		completedAt = &now
	}
	return tx.Create(&model.Transaction{
		OrderID:     orderID,
		EscrowID:    escrow.ID,
		MilestoneID: milestoneID,
		Type:        "deposit",
		Amount:      payment.Amount,
		FromUserID:  payment.PayerUserID,
		Status:      1,
		Remark:      payment.FundScene,
		CompletedAt: completedAt,
	}).Error
}

func ensureProjectEscrowAccountTx(tx *gorm.DB, projectID uint64) (*model.EscrowAccount, error) {
	if projectID == 0 {
		return nil, nil
	}
	escrow, err := loadProjectEscrowTx(tx, projectID)
	if err != nil {
		return nil, err
	}
	if escrow != nil {
		return escrow, nil
	}

	var project model.Project
	if err := tx.Select("id", "owner_id", "name").First(&project, projectID).Error; err != nil {
		return nil, err
	}

	created := &model.EscrowAccount{
		ProjectID:   project.ID,
		UserID:      project.OwnerID,
		ProjectName: strings.TrimSpace(project.Name),
		Status:      escrowStatusActive,
	}
	if err := tx.Create(created).Error; err != nil {
		return nil, err
	}
	return created, nil
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
