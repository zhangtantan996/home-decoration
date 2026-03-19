package model

import "time"

const (
	MilestoneAcceptanceDecisionApproved = "approved"
	MilestoneAcceptanceDecisionRejected = "rejected"
)

type MilestoneSubmission struct {
	Base
	ProjectID             uint64     `json:"projectId" gorm:"index"`
	MilestoneID           uint64     `json:"milestoneId" gorm:"index"`
	SubmittedByProviderID uint64     `json:"submittedByProviderId" gorm:"index"`
	Description           string     `json:"description" gorm:"type:text"`
	Photos                string     `json:"photos" gorm:"type:text"`
	Version               int        `json:"version" gorm:"default:1"`
	SubmittedAt           *time.Time `json:"submittedAt"`
}

func (MilestoneSubmission) TableName() string {
	return "milestone_submissions"
}

type MilestoneAcceptance struct {
	Base
	ProjectID         uint64     `json:"projectId" gorm:"index"`
	MilestoneID       uint64     `json:"milestoneId" gorm:"index"`
	ReviewedByUserID  uint64     `json:"reviewedByUserId" gorm:"index"`
	Decision          string     `json:"decision" gorm:"size:20;index"`
	Comment           string     `json:"comment" gorm:"type:text"`
	ReviewedAt        *time.Time `json:"reviewedAt"`
}

func (MilestoneAcceptance) TableName() string {
	return "milestone_acceptances"
}
