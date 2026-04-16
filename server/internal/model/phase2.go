package model

import "time"

const (
	ChangeOrderStatusPendingUserConfirm     = "pending_user_confirm"
	ChangeOrderStatusUserConfirmed          = "user_confirmed"
	ChangeOrderStatusUserRejected           = "user_rejected"
	ChangeOrderStatusAdminSettlementRequired = "admin_settlement_required"
	ChangeOrderStatusSettled                = "settled"
	ChangeOrderStatusCancelled              = "cancelled"
)

type ChangeOrder struct {
	Base
	ProjectID      uint64  `json:"projectId" gorm:"index"`
	ContractID     uint64  `json:"contractId" gorm:"index"`
	InitiatorType  string  `json:"initiatorType" gorm:"size:20"`
	InitiatorID    uint64  `json:"initiatorId" gorm:"index"`
	ChangeType     string  `json:"changeType" gorm:"size:30;default:'scope'"`
	Title          string  `json:"title" gorm:"size:200"`
	Reason         string  `json:"reason" gorm:"type:text"`
	Description    string  `json:"description" gorm:"type:text"`
	Items          string  `json:"items" gorm:"type:jsonb;default:'[]'"`
	AmountImpact   float64 `json:"amountImpact"`
	TimelineImpact int     `json:"timelineImpact"`
	EvidenceURLs   string  `json:"evidenceUrls" gorm:"type:jsonb;default:'[]'"`
	Status         string  `json:"status" gorm:"size:40;default:'pending_user_confirm';index"`
	UserConfirmedAt *time.Time `json:"userConfirmedAt"`
	UserRejectedAt  *time.Time `json:"userRejectedAt"`
	UserRejectReason string    `json:"userRejectReason" gorm:"type:text"`
	SettledAt       *time.Time `json:"settledAt"`
	SettlementReason string    `json:"settlementReason" gorm:"type:text"`
	ResolvedBy     uint64  `json:"resolvedBy" gorm:"index"`
}

func (ChangeOrder) TableName() string {
	return "change_orders"
}

type Complaint struct {
	Base
	ProjectID        uint64 `json:"projectId" gorm:"index"`
	UserID           uint64 `json:"userId" gorm:"index"`
	ProviderID       uint64 `json:"providerId" gorm:"index"`
	Category         string `json:"category" gorm:"size:50;index"`
	Title            string `json:"title" gorm:"size:200"`
	Description      string `json:"description" gorm:"type:text"`
	EvidenceURLs     string `json:"evidenceUrls" gorm:"type:jsonb;default:'[]'"`
	Status           string `json:"status" gorm:"size:20;default:'submitted';index"`
	Resolution       string `json:"resolution" gorm:"type:text"`
	AdminID          uint64 `json:"adminId" gorm:"index"`
	FreezePayment    bool   `json:"freezePayment" gorm:"default:false"`
	MerchantResponse string `json:"merchantResponse" gorm:"type:text"`
}

func (Complaint) TableName() string {
	return "complaints"
}

type Evaluation struct {
	Base
	ProjectID       uint64  `json:"projectId" gorm:"uniqueIndex:idx_project_user_eval;index"`
	UserID          uint64  `json:"userId" gorm:"uniqueIndex:idx_project_user_eval;index"`
	ProviderID      uint64  `json:"providerId" gorm:"index"`
	OverallScore    float64 `json:"overallScore"`
	DimensionScores string  `json:"dimensionScores" gorm:"type:jsonb;default:'{}'"`
	Content         string  `json:"content" gorm:"type:text"`
	ImageURLs       string  `json:"imageUrls" gorm:"type:jsonb;default:'[]'"`
	IsAnonymous     bool    `json:"isAnonymous" gorm:"default:false"`
}

func (Evaluation) TableName() string {
	return "evaluations"
}

type ContractView struct {
	Contract
	PaymentPlanItems []map[string]interface{} `json:"paymentPlanItems"`
	AttachmentItems  []string                 `json:"attachmentItems"`
}

type ComplaintView struct {
	Complaint
	CreatedAtText string `json:"createdAtText"`
	UpdatedAtText string `json:"updatedAtText"`
}
