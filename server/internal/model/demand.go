package model

import "time"

const (
	DemandTypeRenovation = "renovation"
	DemandTypeDesign     = "design"
	DemandTypePartial    = "partial"
	DemandTypeMaterial   = "material"
)

const (
	DemandStatusDraft     = "draft"
	DemandStatusSubmitted = "submitted"
	DemandStatusReviewing = "reviewing"
	DemandStatusApproved  = "approved"
	DemandStatusMatching  = "matching"
	DemandStatusMatched   = "matched"
	DemandStatusClosed    = "closed"
)

const (
	DemandMatchStatusPending  = "pending"
	DemandMatchStatusAccepted = "accepted"
	DemandMatchStatusDeclined = "declined"
	DemandMatchStatusQuoted   = "quoted"
)

const (
	ProposalSourceBooking = "booking"
	ProposalSourceDemand  = "demand"
)

const (
	ContractStatusDraft          = "draft"
	ContractStatusPendingConfirm = "pending_confirm"
	ContractStatusPendingSign    = "pending_sign"
	ContractStatusSigned         = "signed"
	ContractStatusPendingDeposit = "pending_deposit"
	ContractStatusConfirmed      = "confirmed"
	ContractStatusActive         = "active"
	ContractStatusCompleted      = "completed"
	ContractStatusTerminated     = "terminated"
)

const (
	ContractTypeDesign       = "design"
	ContractTypeConstruction = "construction"
)

type Demand struct {
	Base
	UserID       uint64     `json:"userId" gorm:"index"`
	DemandType   string     `json:"demandType" gorm:"size:30;default:'renovation';index"`
	Title        string     `json:"title" gorm:"size:200"`
	City         string     `json:"city" gorm:"size:50;index"`
	District     string     `json:"district" gorm:"size:50;index"`
	Address      string     `json:"address" gorm:"size:300"`
	Area         float64    `json:"area"`
	BudgetMin    float64    `json:"budgetMin"`
	BudgetMax    float64    `json:"budgetMax"`
	Timeline     string     `json:"timeline" gorm:"size:30"`
	StylePref    string     `json:"stylePref" gorm:"size:255"`
	Description  string     `json:"description" gorm:"type:text"`
	Attachments  string     `json:"attachments" gorm:"type:jsonb;default:'[]'"`
	Status       string     `json:"status" gorm:"size:20;default:'draft';index"`
	ReviewerID   uint64     `json:"reviewerId" gorm:"index"`
	ReviewNote   string     `json:"reviewNote" gorm:"type:text"`
	ReviewedAt   *time.Time `json:"reviewedAt"`
	MatchedCount int        `json:"matchedCount" gorm:"default:0"`
	MaxMatch     int        `json:"maxMatch" gorm:"default:3"`
	ClosedReason string     `json:"closedReason" gorm:"size:50"`
}

func (Demand) TableName() string {
	return "demands"
}

type DemandMatch struct {
	Base
	DemandID         uint64     `json:"demandId" gorm:"uniqueIndex:idx_demand_provider;index"`
	ProviderID       uint64     `json:"providerId" gorm:"uniqueIndex:idx_demand_provider;index"`
	Status           string     `json:"status" gorm:"size:20;default:'pending';index"`
	AssignedBy       uint64     `json:"assignedBy" gorm:"index"`
	AssignedAt       *time.Time `json:"assignedAt"`
	ResponseDeadline *time.Time `json:"responseDeadline"`
	RespondedAt      *time.Time `json:"respondedAt"`
	DeclineReason    string     `json:"declineReason" gorm:"size:300"`
	ProposalID       uint64     `json:"proposalId" gorm:"index"`
}

func (DemandMatch) TableName() string {
	return "demand_matches"
}

type Contract struct {
	Base
	ProjectID       uint64  `json:"projectId" gorm:"index"`
	DemandID        uint64  `json:"demandId" gorm:"index"`
	BookingID       uint64  `json:"bookingId" gorm:"index"`
	ProviderID      uint64  `json:"providerId" gorm:"index"`
	UserID          uint64  `json:"userId" gorm:"index"`
	ContractNo      string  `json:"contractNo" gorm:"size:50;index"`
	Title           string  `json:"title" gorm:"size:200"`
	ContractType    string  `json:"contractType" gorm:"size:20;default:'design'"` // design, construction
	TotalAmount     float64 `json:"totalAmount"`
	DepositAmount   float64 `json:"depositAmount" gorm:"default:0"`
	PaymentPlan     string  `json:"paymentPlan" gorm:"type:jsonb;default:'[]'"`
	AttachmentURLs  string  `json:"attachmentUrls" gorm:"type:jsonb;default:'[]'"`
	TermsSnapshot   string  `json:"termsSnapshot" gorm:"type:jsonb;default:'{}'"`
	ContractContent string  `json:"contractContent" gorm:"type:text"`
	Status          string  `json:"status" gorm:"size:20;default:'draft';index"`

	// 电子签章相关
	UserSignedAt     *time.Time `json:"userSignedAt"`
	ProviderSignedAt *time.Time `json:"providerSignedAt"`
	ESignFlowID      string     `json:"esignFlowId" gorm:"column:esign_flow_id;size:100"`
	ESignProvider    string     `json:"esignProvider" gorm:"column:esign_provider;size:20;default:'mock'"` // mock, esign, fadada
	ContractFileURL  string     `json:"contractFileUrl" gorm:"size:500"`

	// 定金支付相关
	DepositPaid      bool       `json:"depositPaid" gorm:"default:false"`
	DepositPaidAt    *time.Time `json:"depositPaidAt"`
	DepositPaymentID uint64     `json:"depositPaymentId" gorm:"index"`

	// 防重放攻击保护
	UserSignToken       string     `json:"-" gorm:"size:64;index"` // 用户签署令牌
	ProviderSignToken   string     `json:"-" gorm:"size:64;index"` // 商家签署令牌
	UserTokenUsedAt     *time.Time `json:"-"`                      // 用户令牌使用时间
	ProviderTokenUsedAt *time.Time `json:"-"`                      // 商家令牌使用时间

	ConfirmedAt     *time.Time `json:"confirmedAt"`
	ActivatedAt     *time.Time `json:"activatedAt"`
	CompletedAt     *time.Time `json:"completedAt"`
	TerminatedAt    *time.Time `json:"terminatedAt"`
	TerminateReason string     `json:"terminateReason" gorm:"size:300"`
}

func (Contract) TableName() string {
	return "contracts"
}
