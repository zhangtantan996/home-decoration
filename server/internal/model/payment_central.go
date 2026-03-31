package model

import "time"

const (
	SettlementStatusScheduled        = "scheduled"
	SettlementStatusPayoutProcessing = "payout_processing"
	SettlementStatusPaid             = "paid"
	SettlementStatusRefundFrozen     = "refund_frozen"
	SettlementStatusRefunded         = "refunded"
	SettlementStatusPayoutFailed     = "payout_failed"
	SettlementStatusException        = "exception"
)

const (
	SettlementRecoveryStatusNone       = "none"
	SettlementRecoveryStatusPending    = "pending"
	SettlementRecoveryStatusRecovering = "recovering"
	SettlementRecoveryStatusRecovered  = "recovered"
)

const (
	PayoutBizTypeSettlementOrder = "settlement_order"
)

type SettlementOrder struct {
	Base
	BizType           string     `json:"bizType" gorm:"size:50;index:idx_settlement_orders_biz"`
	BizID             uint64     `json:"bizId" gorm:"index:idx_settlement_orders_biz"`
	ProjectID         uint64     `json:"projectId" gorm:"index"`
	ProviderID        uint64     `json:"providerId" gorm:"index"`
	FundScene         string     `json:"fundScene" gorm:"size:40;index"`
	GrossAmount       float64    `json:"grossAmount"`
	PlatformFee       float64    `json:"platformFee"`
	MerchantNetAmount float64    `json:"merchantNetAmount"`
	AcceptedAt        *time.Time `json:"acceptedAt" gorm:"index"`
	DueAt             *time.Time `json:"dueAt" gorm:"index"`
	PayoutOrderID     uint64     `json:"payoutOrderId" gorm:"index"`
	Status            string     `json:"status" gorm:"size:30;index"`
	FailureReason     string     `json:"failureReason" gorm:"size:500"`
	RecoveryStatus    string     `json:"recoveryStatus" gorm:"size:30;default:'none'"`
	RecoveryAmount    float64    `json:"recoveryAmount" gorm:"default:0"`
	MetadataJSON      string     `json:"metadataJson" gorm:"type:jsonb;default:'{}'"`
}

func (SettlementOrder) TableName() string {
	return "settlement_orders"
}

const (
	MerchantBondRuleTypeFixedAmount       = "fixed_amount"
	MerchantBondRuleTypeRatioWithFloorCap = "ratio_with_floor_cap"
)

const (
	MerchantBondAccountStatusDisabled  = "disabled"
	MerchantBondAccountStatusPending   = "pending"
	MerchantBondAccountStatusActive    = "active"
	MerchantBondAccountStatusRefunding = "refunding"
	MerchantBondAccountStatusForfeited = "forfeited"
)

type MerchantBondRule struct {
	Base
	ProviderType    int8       `json:"providerType" gorm:"default:0;index:idx_merchant_bond_rules_scope,priority:1"`
	ProviderSubType string     `json:"providerSubType" gorm:"size:30;index:idx_merchant_bond_rules_scope,priority:2"`
	Enabled         bool       `json:"enabled" gorm:"default:false"`
	RuleType        string     `json:"ruleType" gorm:"size:30;default:'fixed_amount'"`
	FixedAmount     float64    `json:"fixedAmount" gorm:"default:0"`
	Ratio           float64    `json:"ratio" gorm:"default:0"`
	FloorAmount     float64    `json:"floorAmount" gorm:"default:0"`
	CapAmount       float64    `json:"capAmount" gorm:"default:0"`
	EffectiveFrom   *time.Time `json:"effectiveFrom"`
	EffectiveTo     *time.Time `json:"effectiveTo"`
}

func (MerchantBondRule) TableName() string {
	return "merchant_bond_rules"
}

type MerchantBondAccount struct {
	Base
	ProviderID      uint64  `json:"providerId" gorm:"uniqueIndex;index"`
	RequiredAmount  float64 `json:"requiredAmount" gorm:"default:0"`
	PaidAmount      float64 `json:"paidAmount" gorm:"default:0"`
	FrozenAmount    float64 `json:"frozenAmount" gorm:"default:0"`
	AvailableAmount float64 `json:"availableAmount" gorm:"default:0"`
	Status          string  `json:"status" gorm:"size:30;default:'disabled';index"`
	LastRuleID      uint64  `json:"lastRuleId" gorm:"index"`
}

func (MerchantBondAccount) TableName() string {
	return "merchant_bond_accounts"
}
