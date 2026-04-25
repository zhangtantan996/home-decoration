package model

import "time"

const (
	SiteSurveyStatusSubmitted         = "submitted"
	SiteSurveyStatusConfirmed         = "confirmed"
	SiteSurveyStatusRevisionRequested = "revision_requested"
)

const (
	BudgetConfirmationStatusSubmitted = "submitted"
	BudgetConfirmationStatusAccepted  = "accepted"
	BudgetConfirmationStatusRejected  = "rejected"
)

// SiteSurvey stores the latest site survey submission for a booking.
type SiteSurvey struct {
	Base
	BookingID             uint64     `json:"bookingId" gorm:"uniqueIndex"`
	ProviderID            uint64     `json:"providerId" gorm:"index"`
	Photos                string     `json:"-" gorm:"type:jsonb;default:'[]'"`
	Dimensions            string     `json:"-" gorm:"type:jsonb;default:'{}'"`
	Notes                 string     `json:"notes" gorm:"type:text"`
	Status                string     `json:"status" gorm:"size:32;default:'submitted';index"`
	SubmittedAt           *time.Time `json:"submittedAt"`
	ConfirmedAt           *time.Time `json:"confirmedAt"`
	RevisionRequestedAt   *time.Time `json:"revisionRequestedAt"`
	RevisionRequestReason string     `json:"revisionRequestReason" gorm:"type:text"`
}

func (SiteSurvey) TableName() string {
	return "site_surveys"
}

// BudgetConfirmation stores the latest budget/design-intent confirmation for a booking.
type BudgetConfirmation struct {
	Base
	BookingID            uint64     `json:"bookingId" gorm:"uniqueIndex"`
	ProviderID           uint64     `json:"providerId" gorm:"index"`
	BudgetMin            float64    `json:"budgetMin" gorm:"default:0"`
	BudgetMax            float64    `json:"budgetMax" gorm:"default:0"`
	Includes             string     `json:"-" gorm:"type:jsonb;default:'{}'"`
	StyleDirection       string     `json:"styleDirection" gorm:"type:text"`
	SpaceRequirements    string     `json:"spaceRequirements" gorm:"type:text"`
	ExpectedDurationDays int        `json:"expectedDurationDays" gorm:"default:0"`
	SpecialRequirements  string     `json:"specialRequirements" gorm:"type:text"`
	Notes                string     `json:"notes" gorm:"type:text"`
	DesignIntent         string     `json:"designIntent" gorm:"type:text"`
	Status               string     `json:"status" gorm:"size:32;default:'submitted';index"`
	RejectCount          int        `json:"rejectCount" gorm:"default:0"`
	RejectLimit          int        `json:"rejectLimit" gorm:"default:3"`
	SubmittedAt          *time.Time `json:"submittedAt"`
	AcceptedAt           *time.Time `json:"acceptedAt"`
	RejectedAt           *time.Time `json:"rejectedAt"`
	LastRejectedAt       *time.Time `json:"lastRejectedAt"`
	RejectionReason      string     `json:"rejectionReason" gorm:"type:text"`
}

func (BudgetConfirmation) TableName() string {
	return "budget_confirmations"
}
