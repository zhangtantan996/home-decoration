package model

import "time"

const (
	QuoteLibraryItemStatusDisabled int8 = 0
	QuoteLibraryItemStatusEnabled  int8 = 1
)

const (
	QuoteTaskPrerequisiteDraft    = "draft"
	QuoteTaskPrerequisiteComplete = "complete"
)

const (
	QuoteListStatusDraft             = "draft"
	QuoteListStatusReadyForSelection = "ready_for_selection"
	QuoteListStatusPricingInProgress = "pricing_in_progress"
	QuoteListStatusSubmittedToUser   = "submitted_to_user"
	QuoteListStatusUserConfirmed     = "user_confirmed"
	QuoteListStatusRejected          = "rejected"
	QuoteListStatusSuperseded        = "superseded"
	QuoteListStatusExpired           = "expired"
	QuoteListStatusQuoting           = QuoteListStatusPricingInProgress
	QuoteListStatusLocked            = "locked"
	QuoteListStatusAwarded           = "awarded"
	QuoteListStatusClosed            = "closed"
)

const (
	QuoteInvitationStatusInvited  = "invited"
	QuoteInvitationStatusDeclined = "declined"
	QuoteInvitationStatusQuoted   = "quoted"
)

const (
	QuoteSubmissionStatusDraft             = "draft"
	QuoteSubmissionStatusGenerated         = "generated"
	QuoteSubmissionStatusMerchantReviewing = "merchant_reviewing"
	QuoteSubmissionStatusSubmitted         = "submitted"
	QuoteSubmissionStatusUserConfirmed     = "user_confirmed"
	QuoteSubmissionStatusSuperseded        = "superseded"
	QuoteSubmissionStatusLocked            = "locked"
	QuoteSubmissionStatusWithdrawn         = "withdrawn"
)

const (
	QuotePriceBookStatusDraft    = "draft"
	QuotePriceBookStatusActive   = "active"
	QuotePriceBookStatusArchived = "archived"
)

const (
	QuoteGenerationStatusPending        = "pending"
	QuoteGenerationStatusGenerated      = "generated"
	QuoteGenerationStatusPartialMissing = "partial_missing"
)

const (
	QuoteUserConfirmationPending   = "pending"
	QuoteUserConfirmationConfirmed = "confirmed"
	QuoteUserConfirmationRejected  = "rejected"
)

const (
	QuoteListItemSourceTypeStandard  = "standard"
	QuoteListItemSourceTypeManual    = "manual"
	QuoteListItemSourceTypeGenerated = "generated"
)

const (
	QuantitySourceTypeProposal              = "proposal"
	QuantitySourceTypeProposalInternalDraft = "proposal_internal_draft"
	QuantitySourceTypeAdminImported         = "admin_imported"
)

const (
	QuantityBaseStatusDraft      = "draft"
	QuantityBaseStatusActive     = "active"
	QuantityBaseStatusSuperseded = "superseded"
	QuantityBaseStatusArchived   = "archived"
)

type QuoteCategory struct {
	Base
	Code      string `json:"code" gorm:"size:64;uniqueIndex"`
	Name      string `json:"name" gorm:"size:100;index"`
	ParentID  uint64 `json:"parentId" gorm:"index"`
	SortOrder int    `json:"sortOrder" gorm:"default:0"`
	Status    int8   `json:"status" gorm:"default:1;index"`
}

func (QuoteCategory) TableName() string {
	return "quote_categories"
}

type QuoteLibraryItem struct {
	Base
	CategoryID          uint64 `json:"categoryId" gorm:"index"`
	ERPItemCode         string `json:"erpItemCode" gorm:"size:100;uniqueIndex"`
	StandardCode        string `json:"standardCode" gorm:"size:100;index"`
	Name                string `json:"name" gorm:"size:255;index"`
	Unit                string `json:"unit" gorm:"size:20"`
	CategoryL1          string `json:"categoryL1" gorm:"size:50;index"`
	CategoryL2          string `json:"categoryL2" gorm:"size:50;index"`
	CategoryL3          string `json:"categoryL3" gorm:"size:50;index"`
	ERPSeqNo            string `json:"erpSeqNo" gorm:"size:20"`
	ReferencePriceCent  int64  `json:"referencePriceCent" gorm:"default:0"`
	PricingNote         string `json:"pricingNote" gorm:"type:text"`
	HasTiers            bool   `json:"hasTiers" gorm:"default:false"`
	QuantityFormulaJSON string `json:"quantityFormulaJson" gorm:"type:text"`
	Status              int8   `json:"status" gorm:"default:1;index"`
	KeywordsJSON        string `json:"keywordsJson" gorm:"type:text"`
	ERPMappingJSON      string `json:"erpMappingJson" gorm:"type:text"`
	SourceMetaJSON      string `json:"sourceMetaJson" gorm:"type:text"`
	SourceFingerprint   string `json:"sourceFingerprint" gorm:"size:64;index"`
	ExtensionsJSON      string `json:"extensionsJson" gorm:"type:text"`
}

func (QuoteLibraryItem) TableName() string {
	return "quote_library_items"
}

type QuoteList struct {
	Base
	ProjectID                uint64     `json:"projectId" gorm:"index"`
	ProposalID               uint64     `json:"proposalId" gorm:"index"`
	ProposalVersion          int        `json:"proposalVersion" gorm:"default:1"`
	QuantityBaseID           uint64     `json:"quantityBaseId" gorm:"index"`
	QuantityBaseVersion      int        `json:"quantityBaseVersion" gorm:"default:0"`
	SourceType               string     `json:"sourceType" gorm:"size:40;default:'proposal';index"`
	SourceID                 uint64     `json:"sourceId" gorm:"index"`
	DesignerProviderID       uint64     `json:"designerProviderId" gorm:"index"`
	CustomerID               uint64     `json:"customerId" gorm:"index"`
	HouseID                  uint64     `json:"houseId" gorm:"index"`
	OwnerUserID              uint64     `json:"ownerUserId" gorm:"index"`
	ScenarioType             string     `json:"scenarioType" gorm:"size:50;index"`
	Title                    string     `json:"title" gorm:"size:200;index"`
	Status                   string     `json:"status" gorm:"size:20;default:'draft';index"`
	Currency                 string     `json:"currency" gorm:"size:10;default:'CNY'"`
	DeadlineAt               *time.Time `json:"deadlineAt"`
	PrerequisiteSnapshotJSON string     `json:"prerequisiteSnapshotJson" gorm:"type:text"`
	PrerequisiteStatus       string     `json:"prerequisiteStatus" gorm:"size:20;default:'draft';index"`
	UserConfirmationStatus   string     `json:"userConfirmationStatus" gorm:"size:20;default:'pending';index"`
	ActiveSubmissionID       uint64     `json:"activeSubmissionId" gorm:"index"`
	AwardedProviderID        uint64     `json:"awardedProviderId" gorm:"index"`
	AwardedQuoteSubmissionID uint64     `json:"awardedQuoteSubmissionId" gorm:"index"`
	SubmittedToUserAt        *time.Time `json:"submittedToUserAt"`
	UserConfirmedAt          *time.Time `json:"userConfirmedAt"`
	RejectedAt               *time.Time `json:"rejectedAt"`
	ExtensionsJSON           string     `json:"extensionsJson" gorm:"type:text"`
}

func (QuoteList) TableName() string {
	return "quote_lists"
}

type QuantityBase struct {
	Base
	ProposalID         uint64     `json:"proposalId" gorm:"index"`
	ProposalVersion    int        `json:"proposalVersion" gorm:"default:1"`
	OwnerUserID        uint64     `json:"ownerUserId" gorm:"index"`
	DesignerProviderID uint64     `json:"designerProviderId" gorm:"index"`
	SourceType         string     `json:"sourceType" gorm:"size:40;default:'proposal';index"`
	SourceID           uint64     `json:"sourceId" gorm:"index"`
	Status             string     `json:"status" gorm:"size:20;default:'draft';index"`
	Version            int        `json:"version" gorm:"default:1"`
	Title              string     `json:"title" gorm:"size:200"`
	SnapshotJSON       string     `json:"snapshotJson" gorm:"type:text"`
	ActivatedAt        *time.Time `json:"activatedAt"`
}

func (QuantityBase) TableName() string {
	return "quantity_bases"
}

type QuantityBaseItem struct {
	Base
	QuantityBaseID    uint64  `json:"quantityBaseId" gorm:"index"`
	StandardItemID    uint64  `json:"standardItemId" gorm:"index"`
	SourceLineNo      int     `json:"sourceLineNo" gorm:"default:0"`
	SourceItemCode    string  `json:"sourceItemCode" gorm:"size:100;index"`
	SourceItemName    string  `json:"sourceItemName" gorm:"size:255"`
	Unit              string  `json:"unit" gorm:"size:20"`
	Quantity          float64 `json:"quantity" gorm:"default:0"`
	BaselineNote      string  `json:"baselineNote" gorm:"type:text"`
	CategoryL1        string  `json:"categoryL1" gorm:"size:50;index"`
	CategoryL2        string  `json:"categoryL2" gorm:"size:50;index"`
	SortOrder         int     `json:"sortOrder" gorm:"default:0"`
	ExtensionsJSON    string  `json:"extensionsJson" gorm:"type:text"`
}

func (QuantityBaseItem) TableName() string {
	return "quantity_base_items"
}

type QuoteListItem struct {
	Base
	QuoteListID           uint64  `json:"quoteListId" gorm:"index"`
	StandardItemID        uint64  `json:"standardItemId" gorm:"index"`
	MatchedStandardItemID uint64  `json:"matchedStandardItemId" gorm:"index"`
	SelectedTierID        uint64  `json:"selectedTierId" gorm:"index;default:0"`
	LineNo                int     `json:"lineNo" gorm:"default:0"`
	SourceType            string  `json:"sourceType" gorm:"size:20;default:'standard'"`
	Name                  string  `json:"name" gorm:"size:255"`
	Unit                  string  `json:"unit" gorm:"size:20"`
	Quantity              float64 `json:"quantity" gorm:"default:0"`
	PricingNote           string  `json:"pricingNote" gorm:"type:text"`
	CategoryL1            string  `json:"categoryL1" gorm:"size:50;index"`
	CategoryL2            string  `json:"categoryL2" gorm:"size:50;index"`
	SortOrder             int     `json:"sortOrder" gorm:"default:0"`
	MissingMappingFlag    bool    `json:"missingMappingFlag" gorm:"default:false"`
	ExtensionsJSON        string  `json:"extensionsJson" gorm:"type:text"`
}

func (QuoteListItem) TableName() string {
	return "quote_list_items"
}

type QuoteInvitation struct {
	Base
	QuoteListID     uint64     `json:"quoteListId" gorm:"uniqueIndex:idx_quote_invitation_list_provider;index"`
	ProviderID      uint64     `json:"providerId" gorm:"uniqueIndex:idx_quote_invitation_list_provider;index"`
	Status          string     `json:"status" gorm:"size:20;default:'invited';index"`
	InvitedByUserID uint64     `json:"invitedByUserId" gorm:"index"`
	InvitedAt       *time.Time `json:"invitedAt"`
	RespondedAt     *time.Time `json:"respondedAt"`
}

func (QuoteInvitation) TableName() string {
	return "quote_invitations"
}

type QuoteSubmission struct {
	Base
	QuoteListID              uint64     `json:"quoteListId" gorm:"uniqueIndex:idx_quote_submission_list_provider;index"`
	ProviderID               uint64     `json:"providerId" gorm:"uniqueIndex:idx_quote_submission_list_provider;index"`
	ProviderType             int8       `json:"providerType"`
	ProviderSubType          string     `json:"providerSubType" gorm:"size:20"`
	Status                   string     `json:"status" gorm:"size:20;default:'draft';index"`
	TaskStatus               string     `json:"taskStatus" gorm:"size:20;default:'draft';index"`
	GenerationStatus         string     `json:"generationStatus" gorm:"size:30;default:'pending';index"`
	Currency                 string     `json:"currency" gorm:"size:10;default:'CNY'"`
	GeneratedFromPriceBookID uint64     `json:"generatedFromPriceBookId" gorm:"index"`
	TotalCent                int64      `json:"totalCent" gorm:"default:0"`
	EstimatedDays            int        `json:"estimatedDays" gorm:"default:0"`
	Remark                   string     `json:"remark" gorm:"type:text"`
	AttachmentsJSON          string     `json:"attachmentsJson" gorm:"type:text"`
	TeamSize                 int        `json:"teamSize" gorm:"default:0"`
	WorkTypes                string     `json:"workTypes" gorm:"type:text"`
	ConstructionMethodNote   string     `json:"constructionMethodNote" gorm:"type:text"`
	SiteVisitRequired        bool       `json:"siteVisitRequired" gorm:"default:false"`
	SubmittedToUser          bool       `json:"submittedToUser" gorm:"default:false"`
	LockedAt                 *time.Time `json:"lockedAt"`
	UserConfirmedAt          *time.Time `json:"userConfirmedAt"`
	SupersededBy             uint64     `json:"supersededBy" gorm:"index"`
}

func (QuoteSubmission) TableName() string {
	return "quote_submissions"
}

type QuoteSubmissionItem struct {
	Base
	QuoteSubmissionID      uint64 `json:"quoteSubmissionId" gorm:"uniqueIndex:idx_quote_submission_item;index"`
	QuoteListItemID        uint64 `json:"quoteListItemId" gorm:"uniqueIndex:idx_quote_submission_item;index"`
	PriceTierID            uint64 `json:"priceTierId" gorm:"index;default:0"`
	GeneratedUnitPriceCent int64  `json:"generatedUnitPriceCent" gorm:"default:0"`
	UnitPriceCent          int64  `json:"unitPriceCent" gorm:"default:0"`
	AmountCent             int64  `json:"amountCent" gorm:"default:0"`
	AdjustedFlag           bool   `json:"adjustedFlag" gorm:"default:false"`
	MissingPriceFlag       bool   `json:"missingPriceFlag" gorm:"default:false"`
	MissingMappingFlag     bool   `json:"missingMappingFlag" gorm:"default:false"`
	MinChargeAppliedFlag   bool   `json:"minChargeAppliedFlag" gorm:"default:false"`
	Remark                 string `json:"remark" gorm:"type:text"`
}

func (QuoteSubmissionItem) TableName() string {
	return "quote_submission_items"
}

type QuoteSubmissionRevision struct {
	Base
	QuoteSubmissionID uint64 `json:"quoteSubmissionId" gorm:"index"`
	QuoteListID       uint64 `json:"quoteListId" gorm:"index"`
	ProviderID        uint64 `json:"providerId" gorm:"index"`
	RevisionNo        int    `json:"revisionNo" gorm:"index"`
	Action            string `json:"action" gorm:"size:30;index"`
	PreviousStatus    string `json:"previousStatus" gorm:"size:30"`
	NextStatus        string `json:"nextStatus" gorm:"size:30"`
	PreviousTotalCent int64  `json:"previousTotalCent"`
	NextTotalCent     int64  `json:"nextTotalCent"`
	PreviousItemsJSON string `json:"previousItemsJson" gorm:"type:text"`
	NextItemsJSON     string `json:"nextItemsJson" gorm:"type:text"`
	ChangeReason      string `json:"changeReason" gorm:"type:text"`
}

func (QuoteSubmissionRevision) TableName() string {
	return "quote_submission_revisions"
}

type QuotePriceBook struct {
	Base
	ProviderID    uint64     `json:"providerId" gorm:"index"`
	Status        string     `json:"status" gorm:"size:20;default:'draft';index"`
	Version       int        `json:"version" gorm:"default:1"`
	EffectiveFrom *time.Time `json:"effectiveFrom"`
	EffectiveTo   *time.Time `json:"effectiveTo"`
	Remark        string     `json:"remark" gorm:"type:text"`
}

func (QuotePriceBook) TableName() string {
	return "quote_price_books"
}

type QuotePriceBookItem struct {
	Base
	PriceBookID    uint64 `json:"priceBookId" gorm:"uniqueIndex:idx_quote_price_book_item;index"`
	StandardItemID uint64 `json:"standardItemId" gorm:"uniqueIndex:idx_quote_price_book_item;index"`
	PriceTierID    uint64 `json:"priceTierId" gorm:"index;default:0"`
	Unit           string `json:"unit" gorm:"size:20"`
	UnitPriceCent  int64  `json:"unitPriceCent" gorm:"default:0"`
	MinChargeCent  int64  `json:"minChargeCent" gorm:"default:0"`
	Remark         string `json:"remark" gorm:"type:text"`
	Status         int8   `json:"status" gorm:"default:1;index"`
}

func (QuotePriceBookItem) TableName() string {
	return "quote_price_book_items"
}

// QuotePriceTier 阶梯价档位（如瓷砖尺寸档、房型档）
type QuotePriceTier struct {
	Base
	LibraryItemID uint64 `json:"libraryItemId" gorm:"index"`
	TierKey       string `json:"tierKey" gorm:"size:100;index"`
	TierLabel     string `json:"tierLabel" gorm:"size:200"`
	ConditionJSON string `json:"conditionJson" gorm:"type:text"`
	SortOrder     int    `json:"sortOrder" gorm:"default:0"`
}

func (QuotePriceTier) TableName() string {
	return "quote_price_tiers"
}

// QuoteCategoryRule 分类规则（关键词匹配）
type QuoteCategoryRule struct {
	Base
	CategoryID uint64 `json:"categoryId" gorm:"index"`
	Keywords   string `json:"keywords" gorm:"type:text"`
	Priority   int    `json:"priority" gorm:"default:0;index"`
}

func (QuoteCategoryRule) TableName() string {
	return "quote_category_rules"
}

// QuoteTemplate 报价模板
type QuoteTemplate struct {
	Base
	Name           string `json:"name" gorm:"size:200;index"`
	RoomType       string `json:"roomType" gorm:"size:50;index"`
	RenovationType string `json:"renovationType" gorm:"size:50;index"`
	Description    string `json:"description" gorm:"type:text"`
	Status         int8   `json:"status" gorm:"default:1;index"`
}

func (QuoteTemplate) TableName() string {
	return "quote_templates"
}

// QuoteTemplateItem 报价模板明细
type QuoteTemplateItem struct {
	Base
	TemplateID      uint64  `json:"templateId" gorm:"index"`
	LibraryItemID   uint64  `json:"libraryItemId" gorm:"index"`
	DefaultQuantity float64 `json:"defaultQuantity" gorm:"default:0"`
	SortOrder       int     `json:"sortOrder" gorm:"default:0"`
	Required        bool    `json:"required" gorm:"default:true"`
}

func (QuoteTemplateItem) TableName() string {
	return "quote_template_items"
}
