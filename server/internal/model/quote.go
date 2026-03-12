package model

import "time"

const (
	QuoteLibraryItemStatusDisabled int8 = 0
	QuoteLibraryItemStatusEnabled  int8 = 1
)

const (
	QuoteListStatusDraft    = "draft"
	QuoteListStatusQuoting  = "quoting"
	QuoteListStatusLocked   = "locked"
	QuoteListStatusAwarded  = "awarded"
	QuoteListStatusClosed   = "closed"
)

const (
	QuoteInvitationStatusInvited  = "invited"
	QuoteInvitationStatusDeclined = "declined"
	QuoteInvitationStatusQuoted   = "quoted"
)

const (
	QuoteSubmissionStatusDraft     = "draft"
	QuoteSubmissionStatusSubmitted = "submitted"
	QuoteSubmissionStatusWithdrawn = "withdrawn"
)

type QuoteLibraryItem struct {
	Base
	ERPItemCode         string `json:"erpItemCode" gorm:"size:100;uniqueIndex"`
	Name                string `json:"name" gorm:"size:255;index"`
	Unit                string `json:"unit" gorm:"size:20"`
	CategoryL1          string `json:"categoryL1" gorm:"size:50;index"`
	CategoryL2          string `json:"categoryL2" gorm:"size:50;index"`
	ReferencePriceCent  int64  `json:"referencePriceCent" gorm:"default:0"`
	PricingNote         string `json:"pricingNote" gorm:"type:text"`
	Status              int8   `json:"status" gorm:"default:1;index"`
	SourceFingerprint   string `json:"sourceFingerprint" gorm:"size:64;index"`
	ExtensionsJSON      string `json:"extensionsJson" gorm:"type:text"`
}

func (QuoteLibraryItem) TableName() string {
	return "quote_library_items"
}

type QuoteList struct {
	Base
	ProjectID                uint64     `json:"projectId" gorm:"index"`
	CustomerID               uint64     `json:"customerId" gorm:"index"`
	HouseID                  uint64     `json:"houseId" gorm:"index"`
	OwnerUserID              uint64     `json:"ownerUserId" gorm:"index"`
	ScenarioType             string     `json:"scenarioType" gorm:"size:50;index"`
	Title                    string     `json:"title" gorm:"size:200;index"`
	Status                   string     `json:"status" gorm:"size:20;default:'draft';index"`
	Currency                 string     `json:"currency" gorm:"size:10;default:'CNY'"`
	DeadlineAt               *time.Time `json:"deadlineAt"`
	AwardedProviderID        uint64     `json:"awardedProviderId" gorm:"index"`
	AwardedQuoteSubmissionID uint64     `json:"awardedQuoteSubmissionId" gorm:"index"`
	ExtensionsJSON           string     `json:"extensionsJson" gorm:"type:text"`
}

func (QuoteList) TableName() string {
	return "quote_lists"
}

type QuoteListItem struct {
	Base
	QuoteListID     uint64  `json:"quoteListId" gorm:"index"`
	StandardItemID  uint64  `json:"standardItemId" gorm:"index"`
	LineNo          int     `json:"lineNo" gorm:"default:0"`
	Name            string  `json:"name" gorm:"size:255"`
	Unit            string  `json:"unit" gorm:"size:20"`
	Quantity        float64 `json:"quantity" gorm:"default:0"`
	PricingNote     string  `json:"pricingNote" gorm:"type:text"`
	CategoryL1      string  `json:"categoryL1" gorm:"size:50;index"`
	CategoryL2      string  `json:"categoryL2" gorm:"size:50;index"`
	SortOrder       int     `json:"sortOrder" gorm:"default:0"`
	ExtensionsJSON  string  `json:"extensionsJson" gorm:"type:text"`
}

func (QuoteListItem) TableName() string {
	return "quote_list_items"
}

type QuoteInvitation struct {
	Base
	QuoteListID      uint64     `json:"quoteListId" gorm:"uniqueIndex:idx_quote_invitation_list_provider;index"`
	ProviderID       uint64     `json:"providerId" gorm:"uniqueIndex:idx_quote_invitation_list_provider;index"`
	Status           string     `json:"status" gorm:"size:20;default:'invited';index"`
	InvitedByUserID  uint64     `json:"invitedByUserId" gorm:"index"`
	InvitedAt        *time.Time `json:"invitedAt"`
	RespondedAt      *time.Time `json:"respondedAt"`
}

func (QuoteInvitation) TableName() string {
	return "quote_invitations"
}

type QuoteSubmission struct {
	Base
	QuoteListID             uint64 `json:"quoteListId" gorm:"uniqueIndex:idx_quote_submission_list_provider;index"`
	ProviderID              uint64 `json:"providerId" gorm:"uniqueIndex:idx_quote_submission_list_provider;index"`
	ProviderType            int8   `json:"providerType"`
	ProviderSubType         string `json:"providerSubType" gorm:"size:20"`
	Status                  string `json:"status" gorm:"size:20;default:'draft';index"`
	Currency                string `json:"currency" gorm:"size:10;default:'CNY'"`
	TotalCent               int64  `json:"totalCent" gorm:"default:0"`
	EstimatedDays           int    `json:"estimatedDays" gorm:"default:0"`
	Remark                  string `json:"remark" gorm:"type:text"`
	AttachmentsJSON         string `json:"attachmentsJson" gorm:"type:text"`
	TeamSize                int    `json:"teamSize" gorm:"default:0"`
	WorkTypes               string `json:"workTypes" gorm:"type:text"`
	ConstructionMethodNote  string `json:"constructionMethodNote" gorm:"type:text"`
	SiteVisitRequired       bool   `json:"siteVisitRequired" gorm:"default:false"`
}

func (QuoteSubmission) TableName() string {
	return "quote_submissions"
}

type QuoteSubmissionItem struct {
	Base
	QuoteSubmissionID uint64 `json:"quoteSubmissionId" gorm:"uniqueIndex:idx_quote_submission_item;index"`
	QuoteListItemID   uint64 `json:"quoteListItemId" gorm:"uniqueIndex:idx_quote_submission_item;index"`
	UnitPriceCent     int64  `json:"unitPriceCent" gorm:"default:0"`
	AmountCent        int64  `json:"amountCent" gorm:"default:0"`
	Remark            string `json:"remark" gorm:"type:text"`
}

func (QuoteSubmissionItem) TableName() string {
	return "quote_submission_items"
}
