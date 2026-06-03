package model

import "time"

const (
	LegalComplianceReleaseStatusDraft     = "draft"
	LegalComplianceReleaseStatusPublished = "published"
)

// LegalComplianceRelease stores an immutable legal document package once published.
// Draft rows are mutable and are deleted after publishing.
type LegalComplianceRelease struct {
	Base
	Version            string     `json:"version" gorm:"size:40;index"`
	EffectiveAt        *time.Time `json:"effectiveAt" gorm:"index"`
	PublishedAt        *time.Time `json:"publishedAt" gorm:"index"`
	PublishedByAdminID uint64     `json:"publishedByAdminId" gorm:"index"`
	DocumentsJSON      string     `json:"documentsJson" gorm:"type:text"`
	ContentHash        string     `json:"contentHash" gorm:"size:64;index"`
	ChangeSummary      string     `json:"changeSummary" gorm:"type:text"`
	Reason             string     `json:"reason" gorm:"type:text"`
	Status             string     `json:"status" gorm:"size:20;index;default:'draft'"`
	LegacyImported     bool       `json:"legacyImported" gorm:"default:false;index"`
}

func (LegalComplianceRelease) TableName() string {
	return "legal_compliance_releases"
}
