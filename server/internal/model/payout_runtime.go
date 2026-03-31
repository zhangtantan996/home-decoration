package model

import "time"

const (
	PayoutChannelCustody = "custody"
)

const (
	PayoutBizTypeMilestoneRelease  = "milestone_release"
	PayoutBizTypeDesignDeliverable = "design_deliverable"
)

const (
	PayoutStatusCreated    = "created"
	PayoutStatusProcessing = "processing"
	PayoutStatusPaid       = "paid"
	PayoutStatusFailed     = "failed"
)

type PayoutOrder struct {
	Base
	BizType          string     `json:"bizType" gorm:"size:50;index:idx_payout_orders_biz"`
	BizID            uint64     `json:"bizId" gorm:"index:idx_payout_orders_biz"`
	ProviderID       uint64     `json:"providerId" gorm:"index"`
	Amount           float64    `json:"amount"`
	Channel          string     `json:"channel" gorm:"size:20;index"`
	FundScene        string     `json:"fundScene" gorm:"size:40;index"`
	OutPayoutNo      string     `json:"outPayoutNo" gorm:"size:64;uniqueIndex"`
	ProviderPayoutNo string     `json:"providerPayoutNo" gorm:"size:64;index"`
	Status           string     `json:"status" gorm:"size:20;index"`
	ScheduledAt      *time.Time `json:"scheduledAt" gorm:"index"`
	ProcessingAt     *time.Time `json:"processingAt"`
	PaidAt           *time.Time `json:"paidAt"`
	FailureReason    string     `json:"failureReason" gorm:"size:500"`
	RawResponseJSON  string     `json:"rawResponseJson" gorm:"type:jsonb;default:'{}'"`
	RetryCount       int        `json:"retryCount" gorm:"default:0"`
}

func (PayoutOrder) TableName() string {
	return "payout_orders"
}
