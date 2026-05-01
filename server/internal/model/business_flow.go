package model

import "time"

// SystemConfig 系统配置 - 支持管理后台动态修改
type SystemConfig struct {
	Base
	Key         string `json:"key" gorm:"uniqueIndex;size:50"`     // 配置键，如 "booking.intent_fee"
	Value       string `json:"value" gorm:"type:text"`             // 配置值
	Type        string `json:"type" gorm:"size:20;default:string"` // string, number, boolean, json
	Description string `json:"description" gorm:"size:200"`        // 配置说明
	Editable    bool   `json:"editable" gorm:"default:true"`       // 是否允许后台修改
}

// TableName 指定表名
func (SystemConfig) TableName() string {
	return "system_configs"
}

// ============================================
// 默认配置键常量
// ============================================

const (
	ConfigKeyIntentFee               = "booking.intent_fee"             // 意向金金额
	ConfigKeySurveyDepositDefault    = "booking.survey_deposit_default" // 量房定金默认金额
	ConfigKeySurveyRefundNotice      = "booking.survey_refund_notice"   // 量房定金退款说明
	ConfigKeySurveyRefundUserPercent = "booking.survey_refund_user_percent"
	ConfigKeyIntentFeeRefundable     = "booking.intent_fee_refundable"    // 意向金是否可退
	ConfigKeyDesignFeeUnlockDownload = "order.design_fee_unlock_download" // 支付设计费后解锁下载
	ConfigKeyDesignFeePaymentMode    = "order.design_fee_payment_mode"
	ConfigKeyDesignFeeStages         = "order.design_fee_stages"
	ConfigKeyConstructionPaymentMode = "order.construction_payment_mode"
	ConfigKeyConstructionMilestones  = "order.construction_milestones" // 施工分期比例 JSON

	// 平台抽成配置
	ConfigKeyIntentFeeRate       = "fee.platform.intent_fee_rate"       // 意向金抽成比例
	ConfigKeyDesignFeeRate       = "fee.platform.design_fee_rate"       // 设计费抽成比例
	ConfigKeyConstructionFeeRate = "fee.platform.construction_fee_rate" // 施工费抽成比例
	ConfigKeyMaterialFeeRate     = "fee.platform.material_fee_rate"     // 材料费抽成比例
	ConfigKeyWithdrawMinAmount   = "withdraw.min_amount"                // 最小提现金额
	ConfigKeyWithdrawFee         = "withdraw.fee"                       // 提现手续费
	ConfigKeySettlementAutoDays  = "settlement.auto_days"               // 自动结算天数

	// 腾讯云 IM 配置
	ConfigKeyTencentIMSDKAppID  = "im.tencent_sdk_app_id" // 腾讯云 IM SDKAppID
	ConfigKeyTencentIMSecretKey = "im.tencent_secret_key" // 腾讯云 IM SecretKey
	ConfigKeyTencentIMEnabled   = "im.tencent_enabled"    // 是否启用腾讯云 IM

	// publicId 灰度策略配置
	ConfigKeyPublicIDRolloutEnabled        = "id.public_id_rollout_enabled"         // 是否启用 publicId 灰度
	ConfigKeyPublicIDRolloutMobilePercent  = "id.public_id_rollout_mobile_percent"  // 移动端灰度百分比 (0-100)
	ConfigKeyPublicIDRolloutDefaultPercent = "id.public_id_rollout_default_percent" // 其他端灰度百分比 (0-100)

	// publicId 回滚演练配置
	ConfigKeyPublicIDRollbackDrillEnabled      = "id.public_id_rollback_drill_enabled"       // 是否启用回滚演练观测
	ConfigKeyPublicIDRollbackForceLegacyLookup = "id.public_id_rollback_force_legacy_lookup" // 紧急回滚: 强制仅按内部ID查询

	// 量房定金与设计费支付配置
	ConfigKeySurveyDepositRefundRate     = "booking.survey_deposit_refund_rate" // 退款比例(0-1)
	ConfigKeySurveyDepositMin            = "booking.survey_deposit_min"         // 设计师可设最低
	ConfigKeySurveyDepositMax            = "booking.survey_deposit_max"         // 设计师可设最高
	ConfigKeyBudgetConfirmRejectLimit    = "booking.budget_confirm_reject_limit"
	ConfigKeyDesignFeeQuoteExpireHours   = "design.fee_quote_expire_hours"    // 报价有效期(小时)
	ConfigKeyDeliverableDeadlineDays     = "design.deliverable_deadline_days" // 交付截止天数
	ConfigKeyConstructionReleaseDelay    = "construction.release_delay_days"  // T+N 放款延迟天数
	ConfigKeyMerchantDepositRules        = "payment.merchant_deposit_rules"
	ConfigKeyPaymentReleaseDelayDays     = "payment.release_delay_days"
	ConfigKeyPaymentPayoutAutoEnabled    = "payment.payout_auto_enabled"
	ConfigKeyPaymentChannelWechatEnabled = "payment.channel.wechat.enabled"
	ConfigKeyPaymentChannelAlipayEnabled = "payment.channel.alipay.enabled"
	ConfigKeyMiniHomePopup               = "mini.home_popup.config"
	ConfigKeyOutboxWorkerEnabled         = "outbox.worker.enabled"
	ConfigKeyOutboxWorkerBatchSize       = "outbox.worker.batch_size"
	ConfigKeyOutboxWorkerPollIntervalSec = "outbox.worker.poll_interval_seconds"
	ConfigKeyOutboxWorkerLockTTLSec      = "outbox.worker.lock_ttl_seconds"
	ConfigKeyOutboxWorkerMaxRetries      = "outbox.worker.max_retries"

	// 对外内容与合规信息配置（仅白名单字段允许公开读取）
	ConfigKeyPublicBrandName           = "public.brand_name"
	ConfigKeyPublicCompanyName         = "public.company_name"
	ConfigKeyPublicCompanyCreditCode   = "public.company_credit_code"
	ConfigKeyPublicCompanyRegisterAddr = "public.company_register_addr"
	ConfigKeyPublicCompanyContactAddr  = "public.company_contact_addr"
	ConfigKeyPublicICP                 = "public.icp"
	ConfigKeyPublicSecurityBeian       = "public.security_beian"
	ConfigKeyPublicCustomerPhone       = "public.customer_phone"
	ConfigKeyPublicCustomerEmail       = "public.customer_email"
	ConfigKeyPublicComplaintEmail      = "public.complaint_email"
	ConfigKeyPublicPrivacyEmail        = "public.privacy_email"
	ConfigKeyPublicUserAgreement       = "public.user_agreement"
	ConfigKeyPublicPrivacyPolicy       = "public.privacy_policy"
	ConfigKeyPublicTransactionRules    = "public.transaction_rules"
	ConfigKeyPublicRefundRules         = "public.refund_rules"
	ConfigKeyPublicMerchantOnboarding  = "public.merchant_onboarding"
	ConfigKeyPublicThirdPartySharing   = "public.third_party_sharing"
	ConfigKeyPublicLegalVersion        = "public.legal_version"
	ConfigKeyPublicLegalEffectiveDate  = "public.legal_effective_date"
)

// Proposal 设计方案
type Proposal struct {
	Base
	SourceType           string     `json:"sourceType" gorm:"size:20;default:'booking';index"`
	BookingID            uint64     `json:"bookingId" gorm:"index"`
	DemandID             uint64     `json:"demandId" gorm:"index"`
	DemandMatchID        uint64     `json:"demandMatchId" gorm:"index"`
	DesignerID           uint64     `json:"designerId" gorm:"index"`      // Provider ID
	Summary              string     `json:"summary" gorm:"type:text"`     // 方案概述
	DesignFee            float64    `json:"designFee"`                    // 设计费
	ConstructionFee      float64    `json:"constructionFee"`              // 施工费预估
	MaterialFee          float64    `json:"materialFee"`                  // 主材费预估
	EstimatedDays        int        `json:"estimatedDays"`                // 预计工期
	Attachments          string     `json:"attachments" gorm:"type:text"` // JSON: 附件列表
	InternalDraftJSON    string     `json:"internalDraftJson" gorm:"type:text;default:'{}'"`
	PreviewPackageJSON   string     `json:"previewPackageJson" gorm:"type:text;default:'{}'"`
	DeliveryPackageJSON  string     `json:"deliveryPackageJson" gorm:"type:text;default:'{}'"`
	Status               int8       `json:"status" gorm:"default:1"` // 1:待确认 2:已确认 3:已拒绝 4:已被新版本替代
	ConfirmedAt          *time.Time `json:"confirmedAt"`
	Version              int        `json:"version" gorm:"default:1"`         // 版本号（v1, v2, v3...）
	ParentProposalID     uint64     `json:"parentProposalId" gorm:"index"`    // 上一版本方案ID
	RejectionCount       int        `json:"rejectionCount" gorm:"default:0"`  // 该来源链路的累计拒绝次数
	RejectionReason      string     `json:"rejectionReason" gorm:"type:text"` // 拒绝原因
	RejectedAt           *time.Time `json:"rejectedAt"`                       // 拒绝时间
	SubmittedAt          *time.Time `json:"submittedAt"`                      // 提交时间
	UserResponseDeadline *time.Time `json:"userResponseDeadline"`             // 用户确认/拒绝的截止时间（14天）
}

// TableName 指定表名
func (Proposal) TableName() string {
	return "proposals"
}

// Order 订单
type Order struct {
	Base
	ProjectID   uint64     `json:"projectId" gorm:"index"`
	ProposalID  uint64     `json:"proposalId" gorm:"index"`    // 关联方案ID（设计费订单）
	BookingID   uint64     `json:"bookingId" gorm:"index"`     // 追踪意向金
	OrderNo     string     `json:"orderNo" gorm:"uniqueIndex"` // 订单号
	OrderType   string     `json:"orderType" gorm:"size:20"`   // design, construction, material
	TotalAmount float64    `json:"totalAmount"`
	PaidAmount  float64    `json:"paidAmount" gorm:"default:0"`
	Discount    float64    `json:"discount" gorm:"default:0"` // 意向金抵扣额
	Status      int8       `json:"status" gorm:"default:0"`   // 0:待支付 1:已支付 2:已取消 3:已退款
	ExpireAt    *time.Time `json:"expireAt"`                  // 支付过期时间（48小时）
	PaidAt      *time.Time `json:"paidAt"`
}

// TableName 指定表名
func (Order) TableName() string {
	return "orders"
}

// PaymentPlan 支付计划
type PaymentPlan struct {
	Base
	OrderID            uint64     `json:"orderId" gorm:"index"`
	Type               string     `json:"type" gorm:"size:20"` // milestone, onetime
	Seq                int        `json:"seq"`                 // 期数顺序
	Name               string     `json:"name" gorm:"size:50"` // e.g., "开工款"
	Amount             float64    `json:"amount"`
	AmountCent         int64      `json:"amountCent" gorm:"default:0"`
	Percentage         float32    `json:"percentage"`
	Status             int8       `json:"status" gorm:"default:0"` // 0:待支付 1:已支付 2:已失效
	RefundedAmount     float64    `json:"refundedAmount" gorm:"default:0"`
	RefundedAmountCent int64      `json:"refundedAmountCent" gorm:"default:0"`
	RefundStatus       string     `json:"refundStatus" gorm:"size:30;default:'none';index"`
	ActivatedAt        *time.Time `json:"activatedAt"`
	DueAt              *time.Time `json:"dueAt"` // 应付日期
	PaidAt             *time.Time `json:"paidAt"`
	MilestoneID        uint64     `json:"milestoneId" gorm:"index"` // 关联里程碑ID（施工费分期）
	ChangeOrderID      *uint64    `json:"changeOrderId,omitempty" gorm:"index"`
	Payable            bool       `json:"payable" gorm:"-"`
	PayableReason      string     `json:"payableReason,omitempty" gorm:"-"`
	ExpiresAt          *time.Time `json:"expiresAt,omitempty" gorm:"-"`
	PlanType           string     `json:"planType,omitempty" gorm:"-"`
}

// TableName 指定表名
func (PaymentPlan) TableName() string {
	return "payment_plans"
}

// ============================================
// 订单状态常量
// ============================================

const (
	OrderStatusPending   int8 = 0 // 待支付
	OrderStatusPaid      int8 = 1 // 已支付
	OrderStatusCancelled int8 = 2 // 已取消
	OrderStatusRefunded  int8 = 3 // 已退款
)

const (
	PaymentPlanStatusPending int8 = 0
	PaymentPlanStatusPaid    int8 = 1
	PaymentPlanStatusExpired int8 = 2
)

const (
	OrderTypeDesign       = "design"       // 设计费订单
	OrderTypeConstruction = "construction" // 施工费订单
	OrderTypeMaterial     = "material"     // 主材费订单
)

const (
	ProposalStatusPending    int8 = 1 // 待确认
	ProposalStatusConfirmed  int8 = 2 // 已确认
	ProposalStatusRejected   int8 = 3 // 已拒绝
	ProposalStatusSuperseded int8 = 4 // 已被新版本替代
)
