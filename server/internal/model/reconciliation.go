package model

import "time"

// ReconciliationRecord 对账记录主表
type ReconciliationRecord struct {
	Base
	ReconcileDate    time.Time  `json:"reconcileDate" gorm:"index"`
	ReconcileType    string     `json:"reconcileType" gorm:"size:30;index"` // payment/refund/settlement
	Channel          string     `json:"channel" gorm:"size:20"`
	TotalCount       int        `json:"totalCount"`
	MatchedCount     int        `json:"matchedCount"`
	DifferenceCount  int        `json:"differenceCount"`
	TotalAmount      float64    `json:"totalAmount"`
	DifferenceAmount float64    `json:"differenceAmount"`
	Status           string     `json:"status" gorm:"size:20;index"` // processing/completed/failed
	ErrorMessage     string     `json:"errorMessage" gorm:"size:500"`
	CompletedAt      *time.Time `json:"completedAt"`
}

// TableName 指定表名
func (ReconciliationRecord) TableName() string {
	return "reconciliation_records"
}

// ReconciliationDifference 对账差异明细表
type ReconciliationDifference struct {
	Base
	ReconciliationID uint64     `json:"reconciliationId" gorm:"index"`
	DifferenceType   string     `json:"differenceType" gorm:"size:30"` // missing_in_platform/missing_in_channel/amount_mismatch/status_mismatch
	OutTradeNo       string     `json:"outTradeNo" gorm:"size:64;index"`
	ProviderTradeNo  string     `json:"providerTradeNo" gorm:"size:64;index"`
	PlatformAmount   float64    `json:"platformAmount"`
	ChannelAmount    float64    `json:"channelAmount"`
	PlatformStatus   string     `json:"platformStatus" gorm:"size:30"`
	ChannelStatus    string     `json:"channelStatus" gorm:"size:30"`
	HandleStatus     string     `json:"handleStatus" gorm:"size:20;default:'pending';index"` // pending/investigating/resolved/ignored
	Resolved         bool       `json:"resolved" gorm:"default:false"`
	ResolvedAt       *time.Time `json:"resolvedAt"`
	ResolvedBy       uint64     `json:"resolvedBy"`
	ResolveNotes     string     `json:"resolveNotes" gorm:"size:500"`
	IgnoreReason     string     `json:"ignoreReason" gorm:"size:500"`
	Solution         string     `json:"solution" gorm:"size:500"`
}

// TableName 指定表名
func (ReconciliationDifference) TableName() string {
	return "reconciliation_differences"
}

// 差异处理状态常量
const (
	DifferenceStatusPending       = "pending"       // 待处理
	DifferenceStatusInvestigating = "investigating" // 调查中
	DifferenceStatusResolved      = "resolved"      // 已解决
	DifferenceStatusIgnored       = "ignored"       // 已忽略
)
