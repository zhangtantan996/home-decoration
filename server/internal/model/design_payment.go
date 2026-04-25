package model

import "time"

// DesignWorkingDoc 设计内部沟通材料（量房草图、预算报价等，仅平台留存）
type DesignWorkingDoc struct {
	Base
	BookingID   uint64     `json:"bookingId" gorm:"index"`
	ProviderID  uint64     `json:"providerId" gorm:"index"`
	DocType     string     `json:"docType" gorm:"size:30"` // sketch | budget_quote | site_photo | measurement
	Title       string     `json:"title" gorm:"size:100"`
	Description string     `json:"description" gorm:"type:text"`
	Files       string     `json:"files" gorm:"type:jsonb;default:'[]'"` // [{url, name, type, size}]
	SubmittedAt *time.Time `json:"submittedAt"`
}

func (DesignWorkingDoc) TableName() string {
	return "design_working_docs"
}

// DesignFeeQuote 设计费报价（设计师发起→用户确认→生成订单）
type DesignFeeQuote struct {
	Base
	BookingID        uint64     `json:"bookingId" gorm:"index"`
	ProviderID       uint64     `json:"providerId" gorm:"index"`
	TotalFee         float64    `json:"totalFee"`                                  // 设计费总额
	DepositDeduction float64    `json:"depositDeduction" gorm:"default:0"`         // 量房定金抵扣额
	NetAmount        float64    `json:"netAmount"`                                 // 用户实付
	PaymentMode      string     `json:"paymentMode" gorm:"size:20"`                // onetime | staged
	StagesJSON       string     `json:"stagesJson" gorm:"type:jsonb;default:'[]'"` // [{seq, name, percentage, amount}]
	Description      string     `json:"description" gorm:"type:text"`
	Status           string     `json:"status" gorm:"size:20;default:'pending'"` // pending → confirmed | rejected | expired
	ExpireAt         *time.Time `json:"expireAt"`
	ConfirmedAt      *time.Time `json:"confirmedAt"`
	RejectedAt       *time.Time `json:"rejectedAt"`
	RejectionReason  string     `json:"rejectionReason" gorm:"size:500"`
	OrderID          uint64     `json:"orderId" gorm:"index"` // 确认后生成的订单ID
}

func (DesignFeeQuote) TableName() string {
	return "design_fee_quotes"
}

// DesignFeeQuote 状态常量
const (
	DesignFeeQuoteStatusPending   = "pending"
	DesignFeeQuoteStatusConfirmed = "confirmed"
	DesignFeeQuoteStatusRejected  = "rejected"
	DesignFeeQuoteStatusExpired   = "expired"
)

// DesignDeliverable 设计成果交付物
type DesignDeliverable struct {
	Base
	BookingID       uint64     `json:"bookingId" gorm:"index"`
	ProjectID       uint64     `json:"projectId" gorm:"index"`
	OrderID         uint64     `json:"orderId" gorm:"index"`
	ProviderID      uint64     `json:"providerId" gorm:"index"`
	ColorFloorPlan  string     `json:"colorFloorPlan" gorm:"type:jsonb;default:'[]'"` // 彩平图
	Renderings      string     `json:"renderings" gorm:"type:jsonb;default:'[]'"`     // 效果图
	RenderingLink   string     `json:"renderingLink" gorm:"size:500"`                 // 效果图外链
	TextDescription string     `json:"textDescription" gorm:"type:text"`              // 文字描述
	CADDrawings     string     `json:"cadDrawings" gorm:"type:jsonb;default:'[]'"`    // CAD施工图
	Attachments     string     `json:"attachments" gorm:"type:jsonb;default:'[]'"`    // 其他附件
	Status          string     `json:"status" gorm:"size:20;default:'draft'"`         // draft → submitted → accepted | rejected
	SubmittedAt     *time.Time `json:"submittedAt"`
	AcceptedAt      *time.Time `json:"acceptedAt"`
	RejectedAt      *time.Time `json:"rejectedAt"`
	RejectionReason string     `json:"rejectionReason" gorm:"size:500"`
}

func (DesignDeliverable) TableName() string {
	return "design_deliverables"
}

// DesignDeliverable 状态常量
const (
	DesignDeliverableStatusDraft     = "draft"
	DesignDeliverableStatusSubmitted = "submitted"
	DesignDeliverableStatusAccepted  = "accepted"
	DesignDeliverableStatusRejected  = "rejected"
)
