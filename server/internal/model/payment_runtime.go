package model

import "time"

const (
	PaymentChannelAlipay = "alipay"
	PaymentChannelWechat = "wechat"
)

const (
	PaymentBizTypeBookingIntent        = "booking_intent"
	PaymentBizTypeBookingSurveyDeposit = "booking_survey_deposit"
	PaymentBizTypeOrder                = "order"
	PaymentBizTypePaymentPlan          = "payment_plan"
	PaymentBizTypeMerchantBond         = "merchant_bond"
)

const (
	FundSceneEntryFee          = "entry_fee"
	FundSceneMerchantDeposit   = "merchant_deposit"
	FundSceneSurveyDeposit     = "survey_deposit"
	FundSceneDesignFee         = "design_fee"
	FundSceneConstructionStage = "construction_stage"
	FundSceneRefund            = "refund"
	FundSceneSettlementPayout  = "settlement_payout"
)

const (
	PaymentTerminalPCWeb           = "pc_web"
	PaymentTerminalMobileH5        = "mobile_h5"
	PaymentTerminalMiniQR          = "mini_qr"
	PaymentTerminalMiniWechatJSAPI = "mini_wechat_jsapi"
)

const (
	PaymentStatusCreated   = "created"
	PaymentStatusLaunching = "launching"
	PaymentStatusPending   = "pending"
	PaymentStatusPaid      = "paid"
	PaymentStatusClosed    = "closed"
	PaymentStatusFailed    = "failed"
)

const (
	RefundOrderStatusCreated    = "created"
	RefundOrderStatusProcessing = "processing"
	RefundOrderStatusSucceeded  = "succeeded"
	RefundOrderStatusFailed     = "failed"
)

// PaymentOrder 外部支付单
// 一个业务对象在同一通道下对应一个或多个支付单，但任意时刻只应存在一个活跃支付单。
type PaymentOrder struct {
	Base
	BizType              string     `json:"bizType" gorm:"size:50;index:idx_payment_orders_biz"`
	BizID                uint64     `json:"bizId" gorm:"index:idx_payment_orders_biz"`
	PayerUserID          uint64     `json:"payerUserId" gorm:"index"`
	Channel              string     `json:"channel" gorm:"size:20;index"`
	Scene                string     `json:"scene" gorm:"size:50"`
	FundScene            string     `json:"fundScene" gorm:"size:40;index"`
	TerminalType         string     `json:"terminalType" gorm:"size:20"`
	Subject              string     `json:"subject" gorm:"size:128"`
	Amount               float64    `json:"amount"`
	OutTradeNo           string     `json:"outTradeNo" gorm:"size:64;uniqueIndex"`
	ProviderTradeNo      string     `json:"providerTradeNo" gorm:"size:64;index"`
	Status               string     `json:"status" gorm:"size:20;index"`
	LaunchTokenHash      string     `json:"-" gorm:"size:64"`
	LaunchTokenExpiredAt *time.Time `json:"-"`
	ExpiredAt            *time.Time `json:"expiredAt" gorm:"index"`
	PaidAt               *time.Time `json:"paidAt"`
	ReturnContext        string     `json:"returnContext" gorm:"type:jsonb;default:'{}'"`
	RawResponseDigest    string     `json:"rawResponseDigest" gorm:"size:64"`
}

func (PaymentOrder) TableName() string {
	return "payment_orders"
}

// PaymentCallback 第三方回调审计记录。
type PaymentCallback struct {
	Base
	PaymentOrderID uint64     `json:"paymentOrderId" gorm:"index"`
	NotifyID       string     `json:"notifyId" gorm:"size:128;uniqueIndex"`
	EventType      string     `json:"eventType" gorm:"size:50"`
	Verified       bool       `json:"verified" gorm:"default:false"`
	Processed      bool       `json:"processed" gorm:"default:false"`
	PayloadJSON    string     `json:"payloadJson" gorm:"type:jsonb;default:'{}'"`
	ReceivedAt     time.Time  `json:"receivedAt"`
	ProcessedAt    *time.Time `json:"processedAt"`
	ErrorMessage   string     `json:"errorMessage" gorm:"size:500"`
}

func (PaymentCallback) TableName() string {
	return "payment_callbacks"
}

// RefundOrder 外部退款单。
type RefundOrder struct {
	Base
	PaymentOrderID       uint64     `json:"paymentOrderId" gorm:"index"`
	BizType              string     `json:"bizType" gorm:"size:50;index"`
	BizID                uint64     `json:"bizId" gorm:"index"`
	FundScene            string     `json:"fundScene" gorm:"size:40;index"`
	RefundApplicationID  uint64     `json:"refundApplicationId" gorm:"index"`
	OutRefundNo          string     `json:"outRefundNo" gorm:"size:64;uniqueIndex"`
	Amount               float64    `json:"amount"`
	Reason               string     `json:"reason" gorm:"size:200"`
	Status               string     `json:"status" gorm:"size:20;index"`
	ProviderResponseJSON string     `json:"providerResponseJson" gorm:"type:jsonb;default:'{}'"`
	FailureReason        string     `json:"failureReason" gorm:"size:500"`
	SucceededAt          *time.Time `json:"succeededAt"`
}

func (RefundOrder) TableName() string {
	return "refund_orders"
}
