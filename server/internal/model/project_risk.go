package model

import "time"

const (
	RefundTypeIntentFee       = "intent_fee"
	RefundTypeDesignFee       = "design_fee"
	RefundTypeConstructionFee = "construction_fee"
	RefundTypeFull            = "full"
)

const (
	RefundApplicationStatusPending   = "pending"
	RefundApplicationStatusApproved  = "approved"
	RefundApplicationStatusRejected  = "rejected"
	RefundApplicationStatusCompleted = "completed"
)

const (
	ProjectAuditTypeDispute = "dispute"
	ProjectAuditTypeRefund  = "refund"
	ProjectAuditTypeClose   = "close"
)

const (
	ProjectAuditStatusPending    = "pending"
	ProjectAuditStatusInProgress = "in_progress"
	ProjectAuditStatusCompleted  = "completed"
)

const (
	ProjectAuditConclusionContinue      = "continue"
	ProjectAuditConclusionRefund        = "refund"
	ProjectAuditConclusionPartialRefund = "partial_refund"
	ProjectAuditConclusionClose         = "close"
)

type RefundApplication struct {
	Base
	BookingID       uint64     `json:"bookingId" gorm:"index"`
	ProjectID       uint64     `json:"projectId" gorm:"index"`
	OrderID         uint64     `json:"orderId" gorm:"index"`
	UserID          uint64     `json:"userId" gorm:"index"`
	RefundType      string     `json:"refundType" gorm:"size:30;index"`
	RequestedAmount float64    `json:"requestedAmount"`
	ApprovedAmount  float64    `json:"approvedAmount"`
	Reason          string     `json:"reason" gorm:"type:text"`
	Evidence        string     `json:"evidence" gorm:"type:jsonb;default:'[]'"`
	Status          string     `json:"status" gorm:"size:20;default:'pending';index"`
	AdminID         uint64     `json:"adminId" gorm:"index"`
	AdminNotes      string     `json:"adminNotes" gorm:"type:text"`
	ApprovedAt      *time.Time `json:"approvedAt"`
	RejectedAt      *time.Time `json:"rejectedAt"`
	CompletedAt     *time.Time `json:"completedAt"`
}

func (RefundApplication) TableName() string {
	return "refund_applications"
}

type ProjectAudit struct {
	Base
	ProjectID           uint64     `json:"projectId" gorm:"index"`
	AuditType           string     `json:"auditType" gorm:"size:20;index"`
	Status              string     `json:"status" gorm:"size:20;default:'pending';index"`
	ComplaintID         uint64     `json:"complaintId" gorm:"index"`
	RefundApplicationID uint64     `json:"refundApplicationId" gorm:"index"`
	AuditNotes          string     `json:"auditNotes" gorm:"type:text"`
	Conclusion          string     `json:"conclusion" gorm:"size:30"`
	ConclusionReason    string     `json:"conclusionReason" gorm:"type:text"`
	ExecutionPlan       string     `json:"executionPlan" gorm:"type:jsonb;default:'{}'"`
	AdminID             uint64     `json:"adminId" gorm:"index"`
	CompletedAt         *time.Time `json:"completedAt"`
}

func (ProjectAudit) TableName() string {
	return "project_audits"
}
