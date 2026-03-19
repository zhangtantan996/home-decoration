package model

import (
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Base 基础模型
type Base struct {
	ID        uint64    `json:"id" gorm:"primaryKey"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// User 用户
type User struct {
	Base
	PublicID          string     `json:"publicId" gorm:"size:36;uniqueIndex"`
	Phone             string     `json:"phone" gorm:"uniqueIndex;size:20"`
	Nickname          string     `json:"nickname" gorm:"size:50"`
	Avatar            string     `json:"avatar" gorm:"size:500"`
	Password          string     `json:"-" gorm:"size:255"` // 密码，不返回给前端
	UserType          int8       `json:"userType"`          // 1业主 2服务商 3工人 4管理员
	Status            int8       `json:"status" gorm:"default:1"`
	LastLoginAt       *time.Time `json:"-"`
	LastLoginIP       string     `json:"-" gorm:"size:50"`
	LoginFailedCount  int        `json:"-" gorm:"default:0"` // 登录失败次数
	LockedUntil       *time.Time `json:"-"`                  // 锁定到期时间
	LastFailedLoginAt *time.Time `json:"-"`                  // 最后失败登录时间
}

// GeneratePublicID 生成对外公开的用户标识
func GeneratePublicID() string {
	return uuid.NewString()
}

// BeforeCreate 确保用户创建时存在 public_id
func (u *User) BeforeCreate(_ *gorm.DB) error {
	if strings.TrimSpace(u.PublicID) == "" {
		u.PublicID = GeneratePublicID()
	}
	return nil
}

// UserWechatBinding 微信小程序绑定关系
type UserWechatBinding struct {
	Base
	UserID      uint64     `json:"userId" gorm:"index;uniqueIndex:idx_user_wechat_user_app"`
	AppID       string     `json:"appId" gorm:"size:64;uniqueIndex:idx_user_wechat_user_app;uniqueIndex:idx_user_wechat_app_openid"`
	OpenID      string     `json:"openId" gorm:"size:128;uniqueIndex:idx_user_wechat_app_openid"`
	UnionID     string     `json:"unionId" gorm:"size:128;index"`
	BoundAt     *time.Time `json:"boundAt"`
	LastLoginAt *time.Time `json:"lastLoginAt"`
}

// Provider 服务商
type Provider struct {
	Base
	UserID              uint64  `json:"userId" gorm:"index"`
	ProviderType        int8    `json:"providerType"` // 1设计师 2公司 3工长
	CompanyName         string  `json:"companyName" gorm:"size:100"`
	SourceApplicationID uint64  `json:"sourceApplicationId" gorm:"index"`
	Avatar              string  `json:"avatar" gorm:"size:500"`
	LicenseNo           string  `json:"licenseNo" gorm:"size:50"`
	Rating              float32 `json:"rating" gorm:"default:0"`
	RestoreRate         float32 `json:"restoreRate"`   // 还原度
	BudgetControl       float32 `json:"budgetControl"` // 预算控制力
	CompletedCnt        int     `json:"completedCnt" gorm:"default:0"`
	Verified            bool    `json:"verified" gorm:"default:false"`
	Status              int8    `json:"status" gorm:"default:1"` // 1:正常 0:封禁
	Latitude            float64 `json:"latitude"`
	Longitude           float64 `json:"longitude"`
	// 新增字段
	SubType          string  `json:"subType" gorm:"size:20;default:'personal'"` // 子类型：personal, studio, company
	EntityType       string  `json:"entityType" gorm:"size:20;default:'personal'"`
	YearsExperience  int     `json:"yearsExperience" gorm:"default:0"`       // 从业年限
	Specialty        string  `json:"specialty" gorm:"size:200"`              // 专长/风格描述
	WorkTypes        string  `json:"workTypes" gorm:"type:text"`             // 工种类型，逗号分隔：mason,electrician,carpenter,painter,plumber
	HighlightTags    string  `json:"highlightTags" gorm:"type:text"`         // JSON数组：亮点标签
	PricingJSON      string  `json:"pricingJson" gorm:"type:text"`           // JSON对象：结构化报价
	GraduateSchool   string  `json:"graduateSchool" gorm:"size:100"`         // 毕业院校（选填）
	DesignPhilosophy string  `json:"designPhilosophy" gorm:"type:text"`      // 设计理念（选填）
	ReviewCount      int     `json:"reviewCount" gorm:"default:0"`           // 评价数量
	PriceMin         float64 `json:"priceMin" gorm:"default:0"`              // 最低价格
	PriceMax         float64 `json:"priceMax" gorm:"default:0"`              // 最高价格
	PriceUnit        string  `json:"priceUnit" gorm:"size:20;default:'元/天'"` // 价格单位
	// 详情页扩展字段
	CoverImage         string  `json:"coverImage" gorm:"size:500"`          // 封面背景图
	FollowersCount     int     `json:"followersCount" gorm:"default:0"`     // 粉丝/关注数
	ServiceIntro       string  `json:"serviceIntro" gorm:"type:text"`       // 服务介绍
	TeamSize           int     `json:"teamSize" gorm:"default:1"`           // 团队规模
	EstablishedYear    int     `json:"establishedYear" gorm:"default:2020"` // 成立年份
	Certifications     string  `json:"certifications" gorm:"type:text"`     // 资质认证 (JSON数组)
	ServiceArea        string  `json:"serviceArea" gorm:"type:text"`        // 服务区域 (JSON数组，如 ["浦东新区", "徐汇区"])
	OfficeAddress      string  `json:"officeAddress" gorm:"size:200"`       // 办公地址
	CompanyAlbumJSON   string  `json:"companyAlbumJson" gorm:"type:text"`   // 企业相册 (JSON数组)
	SurveyDepositPrice float64 `json:"surveyDepositPrice" gorm:"default:0"`
	// 入驻状态
	IsSettled       bool   `json:"isSettled" gorm:"default:true"`   // true=已入驻 false=平台收录
	CollectedSource string `json:"collectedSource" gorm:"size:200"` // 收录来源
}

// ProviderCase 服务商案例/作品
type ProviderCase struct {
	Base
	ProviderID        uint64  `json:"providerId" gorm:"index"`
	Title             string  `json:"title" gorm:"size:100"`
	CoverImage        string  `json:"coverImage" gorm:"size:500"`
	Style             string  `json:"style" gorm:"size:50"`
	Layout            string  `json:"layout" gorm:"size:50"`
	Area              string  `json:"area" gorm:"size:20"`
	Price             float64 `json:"price" gorm:"default:0"`
	QuoteTotalCent    int64   `json:"quoteTotalCent" gorm:"default:0"`
	QuoteCurrency     string  `json:"quoteCurrency" gorm:"size:10;default:'CNY'"`
	QuoteItems        string  `json:"-" gorm:"type:jsonb;default:'[]'"`
	Year              string  `json:"year" gorm:"size:10"`
	Description       string  `json:"description" gorm:"type:text"`
	Images            string  `json:"images" gorm:"type:text"`
	SortOrder         int     `json:"sortOrder" gorm:"default:0"`
	ShowInInspiration bool    `json:"showInInspiration" gorm:"default:false"`
}

// ProviderReview 服务商评价
type ProviderReview struct {
	Base
	ProviderID   uint64     `json:"providerId" gorm:"index"`
	UserID       uint64     `json:"userId" gorm:"index"`
	Rating       float32    `json:"rating"`                        // 评分 1-5
	Content      string     `json:"content" gorm:"type:text"`      // 评价内容
	Images       string     `json:"images" gorm:"type:text"`       // 评价图片 JSON数组
	ServiceType  string     `json:"serviceType" gorm:"size:20"`    // 服务类型：全包、半包、局部
	Area         string     `json:"area" gorm:"size:20"`           // 面积
	Style        string     `json:"style" gorm:"size:50"`          // 风格
	Tags         string     `json:"tags" gorm:"size:200"`          // 评价标签 JSON数组
	HelpfulCount int        `json:"helpfulCount" gorm:"default:0"` // 有用数
	Reply        string     `json:"reply" gorm:"type:text"`        // 商家回复
	ReplyAt      *time.Time `json:"replyAt"`                       // 回复时间
}

// Worker 工人
type Worker struct {
	Base
	UserID     uint64  `json:"userId" gorm:"index"`
	SkillType  string  `json:"skillType" gorm:"size:50"`
	Origin     string  `json:"origin" gorm:"size:50"` // 籍贯
	CertWater  bool    `json:"certWater"`             // 水电证
	CertHeight bool    `json:"certHeight"`            // 高空证
	HourlyRate float64 `json:"hourlyRate"`
	Insured    bool    `json:"insured"`
	Latitude   float64 `json:"latitude"`
	Longitude  float64 `json:"longitude"`
	Available  bool    `json:"available" gorm:"default:true"`
}

const (
	ProjectStatusActive    int8 = 0
	ProjectStatusCompleted int8 = 1
	ProjectStatusPaused    int8 = 2
	ProjectStatusClosed    int8 = 3
)

const (
	ProjectBusinessStatusDraft                      = "draft"
	ProjectBusinessStatusProposalConfirmed          = "proposal_confirmed"
	ProjectBusinessStatusConstructionConfirmed      = "construction_confirmed"
	ProjectBusinessStatusConstructionQuoteConfirmed = "construction_quote_confirmed"
	ProjectBusinessStatusInProgress                 = "in_progress"
	ProjectBusinessStatusCompleted                  = "completed"
	ProjectBusinessStatusCancelled                  = "cancelled"
)

const (
	MilestoneStatusPending    int8 = 0
	MilestoneStatusInProgress int8 = 1
	MilestoneStatusSubmitted  int8 = 2
	MilestoneStatusAccepted   int8 = 3
	MilestoneStatusPaid       int8 = 4
	MilestoneStatusRejected   int8 = 5
)

// Project 项目
type Project struct {
	Base
	OwnerID        uint64  `json:"ownerId" gorm:"index"`
	ProviderID     uint64  `json:"providerId" gorm:"index"`
	ProposalID     uint64  `json:"proposalId" gorm:"index"` // 关联的设计方案ID
	Name           string  `json:"name" gorm:"size:100"`
	Address        string  `json:"address" gorm:"size:200"`
	Latitude       float64 `json:"latitude"`
	Longitude      float64 `json:"longitude"`
	Area           float64 `json:"area"`   // 面积
	Budget         float64 `json:"budget"` // 预算
	Status         int8    `json:"status" gorm:"default:0"`
	CurrentPhase   string  `json:"currentPhase" gorm:"size:50"`
	BusinessStatus string  `json:"businessStatus" gorm:"size:40;default:'draft';index"`

	// 项目创建信息
	MaterialMethod string     `json:"materialMethod" gorm:"size:20"` // self, platform
	CrewID         uint64     `json:"crewId"`
	EntryStartDate *time.Time `json:"entryStartDate"` // 进场开始时间
	EntryEndDate   *time.Time `json:"entryEndDate"`   // 进场结束时间

	// 施工付款模式与暂停状态
	ConstructionPaymentMode string     `json:"constructionPaymentMode" gorm:"size:20;default:'staged'"` // onetime | staged
	PaymentPaused           bool       `json:"paymentPaused" gorm:"default:false"`                      // 因未付款暂停施工
	PaymentPausedAt         *time.Time `json:"paymentPausedAt"`
	PaymentPausedReason     string     `json:"paymentPausedReason" gorm:"size:200"`

	ConstructionProviderID    uint64     `json:"constructionProviderId" gorm:"index"`
	ForemanID                 uint64     `json:"foremanId" gorm:"index"`
	SelectedQuoteSubmissionID uint64     `json:"selectedQuoteSubmissionId" gorm:"index"`
	InspirationCaseDraftID    uint64     `json:"inspirationCaseDraftId" gorm:"index"`
	ConstructionQuote         float64    `json:"constructionQuote" gorm:"default:0"`
	ConstructionQuoteSnapshot string     `json:"constructionQuoteSnapshot" gorm:"type:text"`
	ConstructionConfirmedAt   *time.Time `json:"constructionConfirmedAt"`
	QuoteConfirmedAt          *time.Time `json:"quoteConfirmedAt"`
	StartedAt                 *time.Time `json:"startedAt"`
	StartDate                 *time.Time `json:"startDate"`
	ExpectedEnd               *time.Time `json:"expectedEnd"`
	ActualEnd                 *time.Time `json:"actualEnd"`
	PausedAt                  *time.Time `json:"pausedAt"`
	ResumedAt                 *time.Time `json:"resumedAt"`
	PauseReason               string     `json:"pauseReason" gorm:"type:text"`
	PauseInitiator            string     `json:"pauseInitiator" gorm:"size:20"`
	DisputedAt                *time.Time `json:"disputedAt"`
	DisputeReason             string     `json:"disputeReason" gorm:"type:text"`
	DisputeEvidence           string     `json:"disputeEvidence" gorm:"type:jsonb;default:'[]'"`
	CompletedPhotos           string     `json:"-" gorm:"type:jsonb;default:'[]'"`
	CompletionNotes           string     `json:"completionNotes" gorm:"type:text"`
	CompletionSubmittedAt     *time.Time `json:"completionSubmittedAt"`
	CompletionRejectionReason string     `json:"completionRejectionReason" gorm:"type:text"`
	CompletionRejectedAt      *time.Time `json:"completionRejectedAt"`
}

// Milestone 验收节点
type Milestone struct {
	Base
	ProjectID          uint64     `json:"projectId" gorm:"index"`
	Name               string     `json:"name" gorm:"size:50"`
	Seq                int8       `json:"seq"` // 顺序
	Amount             float64    `json:"amount"`
	Percentage         float32    `json:"percentage"`
	Status             int8       `json:"status" gorm:"default:0"`
	Criteria           string     `json:"criteria" gorm:"type:text"` // 验收标准
	RejectionReason    string     `json:"rejectionReason" gorm:"type:text"`
	SubmittedAt        *time.Time `json:"submittedAt"`
	AcceptedAt         *time.Time `json:"acceptedAt"`
	PaidAt             *time.Time `json:"paidAt"`
	ReleaseScheduledAt *time.Time `json:"releaseScheduledAt"` // T+N 放款计划时间
	ReleasedAt         *time.Time `json:"releasedAt"`         // 实际放款时间
}

// WorkLog 施工日志
type WorkLog struct {
	Base
	ProjectID   uint64    `json:"projectId" gorm:"index"`
	PhaseID     uint64    `json:"phaseId" gorm:"index"`   // 关联的阶段ID
	WorkerID    uint64    `json:"workerId" gorm:"index"`  // 工人ID（可选）
	CreatedBy   uint64    `json:"createdBy" gorm:"index"` // 创建人（管理员ID）
	Title       string    `json:"title" gorm:"size:100"`  // 日志标题
	LogDate     time.Time `json:"logDate" gorm:"type:date;index"`
	Description string    `json:"description" gorm:"type:text"`
	Photos      string    `json:"photos" gorm:"type:jsonb"` // JSON数组
	AIAnalysis  string    `json:"aiAnalysis" gorm:"type:jsonb"`
	IsCompliant *bool     `json:"isCompliant"`
	Issues      string    `json:"issues" gorm:"type:jsonb"`
}

// EscrowAccount 托管账户
type EscrowAccount struct {
	Base
	ProjectID       uint64  `json:"projectId" gorm:"uniqueIndex;index"`
	UserID          uint64  `json:"userId" gorm:"index"` // 账户所有者
	ProjectName     string  `json:"projectName" gorm:"size:100"`
	UserName        string  `json:"userName" gorm:"size:50"`
	TotalAmount     float64 `json:"totalAmount"`
	FrozenAmount    float64 `json:"frozenAmount" gorm:"default:0"`
	AvailableAmount float64 `json:"availableAmount" gorm:"default:0"`
	ReleasedAmount  float64 `json:"releasedAmount" gorm:"default:0"`
	Status          int8    `json:"status" gorm:"default:1"` // 0:待激活 1:正常 2:冻结 3:已清算
}

// Transaction 交易记录
type Transaction struct {
	Base
	OrderID     string     `json:"orderId" gorm:"uniqueIndex;size:50"` // 订单号
	EscrowID    uint64     `json:"escrowId" gorm:"index"`
	MilestoneID uint64     `json:"milestoneId" gorm:"index"`
	Type        string     `json:"type" gorm:"size:20;index"` // deposit, withdraw, transfer, refund
	Amount      float64    `json:"amount"`
	FromUserID  uint64     `json:"fromUserId" gorm:"index"`
	FromAccount string     `json:"fromAccount" gorm:"size:200"` // 付款账户
	ToUserID    uint64     `json:"toUserId" gorm:"index"`
	ToAccount   string     `json:"toAccount" gorm:"size:200"` // 收款账户
	Status      int8       `json:"status" gorm:"default:0"`   // 0:处理中 1:成功 2:失败
	Remark      string     `json:"remark" gorm:"type:text"`   // 备注
	CompletedAt *time.Time `json:"completedAt"`
}

// Booking 预约记录
type Booking struct {
	Base
	UserID                   uint64     `json:"userId" gorm:"index"`
	ProviderID               uint64     `json:"providerId" gorm:"index"`
	ProviderType             string     `json:"providerType" gorm:"size:20"` // designer, worker, company
	Address                  string     `json:"address" gorm:"size:200"`
	Area                     float64    `json:"area"`
	RenovationType           string     `json:"renovationType" gorm:"size:50"`
	BudgetRange              string     `json:"budgetRange" gorm:"size:50"`
	PreferredDate            string     `json:"preferredDate" gorm:"size:100"`
	Phone                    string     `json:"phone" gorm:"size:20"`
	Notes                    string     `json:"notes" gorm:"type:text"`
	HouseLayout              string     `json:"houseLayout" gorm:"size:50"`             // e.g., "3室2厅2卫"
	Status                   int8       `json:"status" gorm:"default:1"`                // 1:pending, 2:confirmed, 3:completed, 4:cancelled
	IntentFee                float64    `json:"intentFee" gorm:"default:0"`             // 意向金金额 (从系统配置读取)
	IntentFeePaid            bool       `json:"intentFeePaid" gorm:"default:false"`     // 是否已支付意向金
	IntentFeeDeducted        bool       `json:"intentFeeDeducted" gorm:"default:false"` // 是否已抵扣至设计费
	IntentFeeRefunded        bool       `json:"intentFeeRefunded" gorm:"default:false"` // 意向金是否已退款
	IntentFeeRefundReason    string     `json:"intentFeeRefundReason" gorm:"size:200"`  // 退款原因
	IntentFeeRefundedAt      *time.Time `json:"intentFeeRefundedAt"`                    // 退款时间
	SurveyDepositSource      string     `json:"surveyDepositSource" gorm:"size:50"`
	SurveyRefundNotice       string     `json:"surveyRefundNotice" gorm:"type:text"`
	MerchantResponseDeadline *time.Time `json:"merchantResponseDeadline"` // 商家响应截止时间 (48小时)

	// 量房定金（替代意向金的新流程）
	SurveyDeposit          float64    `json:"surveyDeposit" gorm:"default:0"`              // 量房定金金额
	SurveyDepositPaid      bool       `json:"surveyDepositPaid" gorm:"default:false"`      // 是否已支付
	SurveyDepositPaidAt    *time.Time `json:"surveyDepositPaidAt"`                         // 支付时间
	SurveyDepositConverted bool       `json:"surveyDepositConverted" gorm:"default:false"` // 是否已转化为设计费抵扣
	SurveyDepositRefunded  bool       `json:"surveyDepositRefunded" gorm:"default:false"`  // 是否已退款
	SurveyDepositRefundAmt float64    `json:"surveyDepositRefundAmt" gorm:"default:0"`     // 退款金额
	SurveyDepositRefundAt  *time.Time `json:"surveyDepositRefundAt"`                       // 退款时间
}

// ProjectPhase 项目工程阶段
type ProjectPhase struct {
	Base
	ProjectID         uint64      `json:"projectId" gorm:"index"`
	PhaseType         string      `json:"phaseType" gorm:"size:20"`              // preparation, demolition, electrical, masonry, painting, installation, inspection
	Seq               int         `json:"seq"`                                   // 阶段顺序 1-7
	Status            string      `json:"status" gorm:"size:20;default:pending"` // pending, in_progress, completed
	ResponsiblePerson string      `json:"responsiblePerson" gorm:"size:50"`
	StartDate         *time.Time  `json:"startDate" gorm:"type:date"`
	EndDate           *time.Time  `json:"endDate" gorm:"type:date"`
	EstimatedDays     int         `json:"estimatedDays"`
	Tasks             []PhaseTask `json:"tasks" gorm:"foreignKey:PhaseID"` // 子任务
}

// TableName 指定表名
func (ProjectPhase) TableName() string {
	return "project_phases"
}

// PhaseTask 阶段子任务
type PhaseTask struct {
	Base
	PhaseID     uint64     `json:"phaseId" gorm:"index"`
	Name        string     `json:"name" gorm:"size:100"`
	IsCompleted bool       `json:"isCompleted" gorm:"default:false"`
	CompletedAt *time.Time `json:"completedAt"`
}

// TableName 指定表名
func (PhaseTask) TableName() string {
	return "phase_tasks"
}

// UserFollow 用户关注关系
type UserFollow struct {
	Base
	UserID     uint64 `json:"userId" gorm:"index;uniqueIndex:idx_user_follow"`
	TargetID   uint64 `json:"targetId" gorm:"uniqueIndex:idx_user_follow"`
	TargetType string `json:"targetType" gorm:"size:20;uniqueIndex:idx_user_follow"` // designer, company, foreman
}

// TableName 指定表名
func (UserFollow) TableName() string {
	return "user_follows"
}

// UserFavorite 用户收藏
type UserFavorite struct {
	Base
	UserID     uint64 `json:"userId" gorm:"index;uniqueIndex:idx_user_favorite"`
	TargetID   uint64 `json:"targetId" gorm:"uniqueIndex:idx_user_favorite"`
	TargetType string `json:"targetType" gorm:"size:20;uniqueIndex:idx_user_favorite"` // provider, case
}

// TableName 指定表名
func (UserFavorite) TableName() string {
	return "user_favorites"
}

// MaterialShop 主材门店
type MaterialShop struct {
	Base
	UserID                 uint64  `json:"userId" gorm:"index"`
	Type                   string  `json:"type" gorm:"size:20"` // showroom | brand
	Name                   string  `json:"name" gorm:"size:100"`
	CompanyName            string  `json:"companyName" gorm:"size:100"`
	SourceApplicationID    uint64  `json:"sourceApplicationId" gorm:"index"`
	Description            string  `json:"description" gorm:"type:text"`
	BusinessLicenseNo      string  `json:"businessLicenseNo" gorm:"size:50"`
	BusinessLicense        string  `json:"businessLicense" gorm:"size:500"`
	LegalPersonName        string  `json:"legalPersonName" gorm:"size:50"`
	LegalPersonIDCardNo    string  `json:"legalPersonIdCardNo" gorm:"size:100"`
	LegalPersonIDCardFront string  `json:"legalPersonIdCardFront" gorm:"size:500"`
	LegalPersonIDCardBack  string  `json:"legalPersonIdCardBack" gorm:"size:500"`
	ContactPhone           string  `json:"contactPhone" gorm:"size:20"`
	ContactName            string  `json:"contactName" gorm:"size:50"`
	Cover                  string  `json:"cover" gorm:"size:500"`     // 封面图
	BrandLogo              string  `json:"brandLogo" gorm:"size:500"` // 品牌 Logo
	Rating                 float32 `json:"rating" gorm:"default:0"`
	ReviewCount            int     `json:"reviewCount" gorm:"default:0"`
	MainProducts           string  `json:"mainProducts" gorm:"type:text"`     // JSON 数组
	ProductCategories      string  `json:"productCategories" gorm:"size:200"` // 逗号分隔
	Address                string  `json:"address" gorm:"size:300"`
	Latitude               float64 `json:"latitude"`
	Longitude              float64 `json:"longitude"`
	OpenTime               string  `json:"openTime" gorm:"size:50"`
	BusinessHoursJSON      string  `json:"businessHoursJson" gorm:"type:text"`
	ServiceArea            string  `json:"serviceArea" gorm:"type:text"`
	MainBrands             string  `json:"mainBrands" gorm:"type:text"`
	MainCategories         string  `json:"mainCategories" gorm:"type:text"`
	DeliveryCapability     string  `json:"deliveryCapability" gorm:"size:200"`
	InstallationCapability string  `json:"installationCapability" gorm:"size:200"`
	AfterSalesPolicy       string  `json:"afterSalesPolicy" gorm:"size:500"`
	InvoiceCapability      string  `json:"invoiceCapability" gorm:"size:200"`
	Tags                   string  `json:"tags" gorm:"type:text"` // JSON 数组
	IsVerified             bool    `json:"isVerified" gorm:"default:false"`
	Status                 *int8   `json:"status" gorm:"column:status;default:1;->;<-:false"` // 1:正常 0:封禁
	// 入驻状态
	IsSettled       bool   `json:"isSettled" gorm:"default:true"`   // true=已入驻 false=平台收录
	CollectedSource string `json:"collectedSource" gorm:"size:200"` // 收录来源
}

// TableName 指定表名
func (MaterialShop) TableName() string {
	return "material_shops"
}

// MaterialShopApplication 主材商入驻申请
type MaterialShopApplication struct {
	Base
	UserID                 uint64     `json:"userId" gorm:"index"`
	Phone                  string     `json:"phone" gorm:"index;size:20"`
	EntityType             string     `json:"entityType" gorm:"size:20;default:'company'"` // company
	ShopName               string     `json:"shopName" gorm:"size:100"`
	ShopDescription        string     `json:"shopDescription" gorm:"type:text"`
	CompanyName            string     `json:"companyName" gorm:"size:100"`
	BusinessLicenseNo      string     `json:"businessLicenseNo" gorm:"size:50"`
	BusinessLicense        string     `json:"businessLicense" gorm:"size:500"`
	LegalPersonName        string     `json:"legalPersonName" gorm:"size:50"`
	LegalPersonIDCardNo    string     `json:"legalPersonIdCardNo" gorm:"size:100"`
	LegalPersonIDCardFront string     `json:"legalPersonIdCardFront" gorm:"size:500"`
	LegalPersonIDCardBack  string     `json:"legalPersonIdCardBack" gorm:"size:500"`
	BusinessHours          string     `json:"businessHours" gorm:"size:100"`
	BusinessHoursJSON      string     `json:"businessHoursJson" gorm:"type:text"`
	ContactPhone           string     `json:"contactPhone" gorm:"size:20"`
	ContactName            string     `json:"contactName" gorm:"size:50"`
	Address                string     `json:"address" gorm:"size:300"`
	LegalAcceptanceJSON    string     `json:"legalAcceptanceJson" gorm:"type:text"`
	LegalAcceptedAt        *time.Time `json:"legalAcceptedAt"`
	LegalAcceptSource      string     `json:"legalAcceptSource" gorm:"size:50;default:'merchant_web'"`
	Status                 int8       `json:"status" gorm:"default:0"` // 0:待审核 1:审核通过 2:审核拒绝
	RejectReason           string     `json:"rejectReason" gorm:"size:500"`
	AuditedBy              uint64     `json:"auditedBy"`
	AuditedAt              *time.Time `json:"auditedAt"`
	ShopID                 uint64     `json:"shopId" gorm:"index"`
}

func (MaterialShopApplication) TableName() string {
	return "material_shop_applications"
}

// MaterialShopApplicationProduct 主材商入驻申请商品
type MaterialShopApplicationProduct struct {
	Base
	ApplicationID uint64  `json:"applicationId" gorm:"index"`
	Name          string  `json:"name" gorm:"size:120"`
	Unit          string  `json:"unit" gorm:"size:20"`
	ParamsJSON    string  `json:"paramsJson" gorm:"type:text"` // JSON对象
	Price         float64 `json:"price"`
	ImagesJSON    string  `json:"imagesJson" gorm:"type:text"` // JSON数组
	SortOrder     int     `json:"sortOrder" gorm:"default:0"`
}

func (MaterialShopApplicationProduct) TableName() string {
	return "material_shop_application_products"
}

// MaterialShopProduct 主材商品
type MaterialShopProduct struct {
	Base
	ShopID      uint64  `json:"shopId" gorm:"index"`
	Name        string  `json:"name" gorm:"size:120"`
	Unit        string  `json:"unit" gorm:"size:20"`
	Description string  `json:"description" gorm:"type:text"`
	ParamsJSON  string  `json:"paramsJson" gorm:"type:text"` // JSON对象
	Price       float64 `json:"price"`
	ImagesJSON  string  `json:"imagesJson" gorm:"type:text"` // JSON数组
	CoverImage  string  `json:"coverImage" gorm:"size:500"`
	Status      int8    `json:"status" gorm:"default:1"` // 1=on 0=off
	SortOrder   int     `json:"sortOrder" gorm:"default:0"`
}

func (MaterialShopProduct) TableName() string {
	return "material_shop_products"
}

// AfterSales 售后申请
type AfterSales struct {
	Base
	UserID      uint64     `json:"userId" gorm:"index"`
	BookingID   uint64     `json:"bookingId" gorm:"index"`       // 关联的预约ID
	OrderNo     string     `json:"orderNo" gorm:"size:32;index"` // 关联的订单号
	Type        string     `json:"type" gorm:"size:20"`          // refund(退款), complaint(投诉), repair(返修)
	Reason      string     `json:"reason" gorm:"size:200"`       // 申请原因
	Description string     `json:"description" gorm:"type:text"` // 详细描述
	Images      string     `json:"images" gorm:"type:text"`      // 图片URL，JSON数组
	Amount      float64    `json:"amount"`                       // 涉及金额
	Status      int8       `json:"status" gorm:"default:0"`      // 0:待处理 1:处理中 2:已完成 3:已拒绝
	Reply       string     `json:"reply" gorm:"type:text"`       // 客服回复
	ResolvedAt  *time.Time `json:"resolvedAt"`                   // 解决时间
}

// TableName 指定表名
func (AfterSales) TableName() string {
	return "after_sales"
}

// Notification 站内通知
type Notification struct {
	Base
	UserID      uint64     `json:"userId" gorm:"index"`
	UserType    string     `json:"userType" gorm:"size:20;index"`
	Title       string     `json:"title" gorm:"size:100;not null"`
	Content     string     `json:"content" gorm:"type:text;not null"`
	Type        string     `json:"type" gorm:"size:30;index"`
	RelatedID   uint64     `json:"relatedId" gorm:"default:0;index"`
	RelatedType string     `json:"relatedType" gorm:"size:30"`
	IsRead      bool       `json:"isRead" gorm:"default:false;index"`
	ReadAt      *time.Time `json:"readAt"`
	ActionURL   string     `json:"actionUrl" gorm:"size:200"`
	Extra       string     `json:"extra" gorm:"type:text"`
}

// TableName 指定表名
func (Notification) TableName() string {
	return "notifications"
}

// 通知类型常量
const (
	NotificationTypeBookingIntentPaid = "booking.intent_paid"
	NotificationTypeBookingConfirmed  = "booking.confirmed"
	NotificationTypeBookingCancelled  = "booking.cancelled"
	NotificationTypeProposalSubmitted = "proposal.submitted"
	NotificationTypeProposalConfirmed = "proposal.confirmed"
	NotificationTypeProposalRejected  = "proposal.rejected"
	NotificationTypeOrderCreated      = "order.created"
	NotificationTypeOrderPaid         = "order.paid"
	NotificationTypeOrderExpiring     = "order.expiring"
	NotificationTypeOrderExpired      = "order.expired"
	NotificationTypeWithdrawApproved  = "withdraw.approved"
	NotificationTypeWithdrawRejected  = "withdraw.rejected"
	NotificationTypeWithdrawCompleted = "withdraw.completed"
	NotificationTypeAuditApproved     = "audit.approved"
	NotificationTypeAuditRejected     = "audit.rejected"
	NotificationTypeCaseAuditApproved = "case_audit.approved"
	NotificationTypeCaseAuditRejected = "case_audit.rejected"
)

// ==================== 商家中心模型 ====================

// MerchantApplication 商家入驻申请
type MerchantApplication struct {
	Base
	// 基础信息
	Phone         string `json:"phone" gorm:"index;size:20"`
	ApplicantType string `json:"applicantType" gorm:"size:20"` // personal, studio, company, foreman
	Role          string `json:"role" gorm:"size:20"`          // designer, foreman, company
	EntityType    string `json:"entityType" gorm:"size:20"`    // personal, company

	// 个人/负责人信息
	RealName    string `json:"realName" gorm:"size:50"`
	Avatar      string `json:"avatar" gorm:"size:500"`
	IDCardNo    string `json:"idCardNo" gorm:"size:100"`    // AES加密存储
	IDCardFront string `json:"idCardFront" gorm:"size:500"` // 身份证正面
	IDCardBack  string `json:"idCardBack" gorm:"size:500"`  // 身份证反面

	// 工作室/公司信息
	CompanyName            string `json:"companyName" gorm:"size:100"`
	LicenseNo              string `json:"licenseNo" gorm:"size:50"`     // 营业执照号
	LicenseImage           string `json:"licenseImage" gorm:"size:500"` // 营业执照照片
	LegalPersonName        string `json:"legalPersonName" gorm:"size:50"`
	LegalPersonIDCardNo    string `json:"legalPersonIdCardNo" gorm:"size:100"`
	LegalPersonIDCardFront string `json:"legalPersonIdCardFront" gorm:"size:500"`
	LegalPersonIDCardBack  string `json:"legalPersonIdCardBack" gorm:"size:500"`
	TeamSize               int    `json:"teamSize" gorm:"default:1"`
	OfficeAddress          string `json:"officeAddress" gorm:"size:200"`
	CompanyAlbumJSON       string `json:"companyAlbumJson" gorm:"type:text"`
	// 工长扩展信息
	YearsExperience int    `json:"yearsExperience" gorm:"default:0"`
	WorkTypes       string `json:"workTypes" gorm:"type:text;default:'[]'"` // JSON数组：工种类型

	// 服务信息
	ServiceArea         string     `json:"serviceArea" gorm:"type:text"`      // JSON数组：服务区域
	Styles              string     `json:"styles" gorm:"type:text"`           // JSON数组：擅长风格
	HighlightTags       string     `json:"highlightTags" gorm:"type:text"`    // JSON数组：亮点标签
	PricingJSON         string     `json:"pricingJson" gorm:"type:text"`      // JSON对象：结构化报价
	Introduction        string     `json:"introduction" gorm:"type:text"`     // 个人/公司简介
	GraduateSchool      string     `json:"graduateSchool" gorm:"size:100"`    // 毕业院校（选填）
	DesignPhilosophy    string     `json:"designPhilosophy" gorm:"type:text"` // 设计理念（选填）
	PortfolioCases      string     `json:"portfolioCases" gorm:"type:text"`   // JSON数组：[{title, images, style, area}]
	LegalAcceptanceJSON string     `json:"legalAcceptanceJson" gorm:"type:text"`
	LegalAcceptedAt     *time.Time `json:"legalAcceptedAt"`
	LegalAcceptSource   string     `json:"legalAcceptSource" gorm:"size:50;default:'merchant_web'"`

	// 审核状态
	Status       int8       `json:"status" gorm:"default:0"` // 0:待审核 1:审核通过 2:审核拒绝
	RejectReason string     `json:"rejectReason" gorm:"size:500"`
	AuditedBy    uint64     `json:"auditedBy"`
	AuditedAt    *time.Time `json:"auditedAt"`

	// 关联（审核通过后生成）
	UserID     uint64 `json:"userId" gorm:"index"`
	ProviderID uint64 `json:"providerId" gorm:"index"`
}

// TableName 指定表名
func (MerchantApplication) TableName() string {
	return "merchant_applications"
}

// MerchantIdentityChangeApplication 商家角色变更申请
type MerchantIdentityChangeApplication struct {
	Base
	UserID          uint64     `json:"userId" gorm:"index"`
	Phone           string     `json:"phone" gorm:"size:20;index"`
	CurrentRole     string     `json:"currentRole" gorm:"size:20"`
	TargetRole      string     `json:"targetRole" gorm:"size:20"`
	TargetEntity    string     `json:"targetEntity" gorm:"size:20"`
	ApplicationData string     `json:"applicationData" gorm:"type:text"` // JSON 申请材料
	Status          int8       `json:"status" gorm:"default:0"`          // 0:待审核 1:通过 2:拒绝
	RejectReason    string     `json:"rejectReason" gorm:"size:500"`
	ReviewedBy      uint64     `json:"reviewedBy"`
	ReviewedAt      *time.Time `json:"reviewedAt"`
}

func (MerchantIdentityChangeApplication) TableName() string {
	return "merchant_identity_change_applications"
}

// CaseAudit 作品审核/草稿
type CaseAudit struct {
	Base
	CaseID           *uint64 `json:"caseId" gorm:"index"` // 关联的主表ID，新增时为空
	ProviderID       uint64  `json:"providerId" gorm:"index"`
	ActionType       string  `json:"actionType" gorm:"size:20"` // create, update, delete
	SourceType       string  `json:"sourceType" gorm:"size:30;index"`
	SourceProjectID  uint64  `json:"sourceProjectId" gorm:"index"`
	SourceProposalID uint64  `json:"sourceProposalId" gorm:"index"`

	// 作品数据快照
	Title          string  `json:"title" gorm:"size:100"`
	CoverImage     string  `json:"coverImage" gorm:"size:500"`
	Style          string  `json:"style" gorm:"size:50"`
	Layout         string  `json:"layout" gorm:"size:50"`
	Area           string  `json:"area" gorm:"size:20"`
	Price          float64 `json:"price" gorm:"default:0"`
	QuoteTotalCent int64   `json:"quoteTotalCent" gorm:"default:0"`            // 报价总计（分）
	QuoteCurrency  string  `json:"quoteCurrency" gorm:"size:10;default:'CNY'"` // 币种
	QuoteItems     string  `json:"quoteItems" gorm:"type:jsonb;default:'[]'"`  // 报价明细（JSONB 数组）
	Year           string  `json:"year" gorm:"size:10"`
	Description    string  `json:"description" gorm:"type:text"`
	Images         string  `json:"images" gorm:"type:text"`
	SortOrder      int     `json:"sortOrder" gorm:"default:0"`

	// 审核状态
	Status       int8       `json:"status" gorm:"default:0"` // 0:pending, 1:approved, 2:rejected
	RejectReason string     `json:"rejectReason" gorm:"size:500"`
	AuditedBy    uint64     `json:"auditedBy"`
	AuditedAt    *time.Time `json:"auditedAt"`
}

// TableName 指定表名
func (CaseAudit) TableName() string {
	return "case_audits"
}

// MerchantIncome 商家收入记录
type MerchantIncome struct {
	Base
	ProviderID      uint64     `json:"providerId" gorm:"index"`
	OrderID         uint64     `json:"orderId" gorm:"index"`
	BookingID       uint64     `json:"bookingId" gorm:"index"`
	Type            string     `json:"type" gorm:"size:20"`     // intent_fee, design_fee, construction
	Amount          float64    `json:"amount"`                  // 原始金额
	PlatformFee     float64    `json:"platformFee"`             // 平台抽成
	NetAmount       float64    `json:"netAmount"`               // 实际到账
	Status          int8       `json:"status" gorm:"default:0"` // 0:待结算 1:已结算 2:已提现
	SettledAt       *time.Time `json:"settledAt"`
	WithdrawOrderNo string     `json:"withdrawOrderNo" gorm:"size:50"`
}

// TableName 指定表名
func (MerchantIncome) TableName() string {
	return "merchant_incomes"
}

// MerchantWithdraw 商家提现记录
type MerchantWithdraw struct {
	Base
	ProviderID  uint64     `json:"providerId" gorm:"index"`
	OrderNo     string     `json:"orderNo" gorm:"uniqueIndex;size:32"`
	Amount      float64    `json:"amount"`
	BankAccount string     `json:"bankAccount" gorm:"size:100"` // 收款账户（脱敏存储）
	BankName    string     `json:"bankName" gorm:"size:50"`
	Status      int8       `json:"status" gorm:"default:0"` // 0:处理中 1:成功 2:失败
	FailReason  string     `json:"failReason" gorm:"size:200"`
	CompletedAt *time.Time `json:"completedAt"`
	OperatorID  uint64     `json:"operatorId"` // 审核人
	AuditRemark string     `json:"auditRemark" gorm:"type:text"`
}

// TableName 指定表名
func (MerchantWithdraw) TableName() string {
	return "merchant_withdraws"
}

// MerchantBankAccount 商家银行账户
type MerchantBankAccount struct {
	Base
	ProviderID  uint64 `json:"providerId" gorm:"index"`
	AccountName string `json:"accountName" gorm:"size:100"` // 户名
	AccountNo   string `json:"accountNo" gorm:"size:100"`   // 账号（加密存储）
	BankName    string `json:"bankName" gorm:"size:50"`     // 银行名称
	BranchName  string `json:"branchName" gorm:"size:100"`  // 支行名称
	IsDefault   bool   `json:"isDefault" gorm:"default:false"`
	Status      int8   `json:"status" gorm:"default:1"` // 1:正常 0:禁用
}

// TableName 指定表名
func (MerchantBankAccount) TableName() string {
	return "merchant_bank_accounts"
}

// MaterialShopServiceSetting 主材商服务设置
type MaterialShopServiceSetting struct {
	Base
	ShopID                 uint64  `json:"shopId" gorm:"uniqueIndex"`
	AcceptBooking          bool    `json:"acceptBooking" gorm:"default:true"`
	AutoConfirmHours       int     `json:"autoConfirmHours" gorm:"default:24"`
	ServiceStyles          string  `json:"serviceStyles" gorm:"type:text"`
	ServicePackages        string  `json:"servicePackages" gorm:"type:text"`
	PriceRangeMin          float64 `json:"priceRangeMin"`
	PriceRangeMax          float64 `json:"priceRangeMax"`
	ResponseTimeDesc       string  `json:"responseTimeDesc" gorm:"size:50"`
	ServiceArea            string  `json:"serviceArea" gorm:"type:text"`
	MainBrands             string  `json:"mainBrands" gorm:"type:text"`
	MainCategories         string  `json:"mainCategories" gorm:"type:text"`
	DeliveryCapability     string  `json:"deliveryCapability" gorm:"size:200"`
	InstallationCapability string  `json:"installationCapability" gorm:"size:200"`
	AfterSalesPolicy       string  `json:"afterSalesPolicy" gorm:"size:500"`
	InvoiceCapability      string  `json:"invoiceCapability" gorm:"size:200"`
}

func (MaterialShopServiceSetting) TableName() string {
	return "material_shop_service_settings"
}

// MerchantServiceSetting 商家服务设置
type MerchantServiceSetting struct {
	Base
	ProviderID          uint64  `json:"providerId" gorm:"uniqueIndex"`
	AcceptBooking       bool    `json:"acceptBooking" gorm:"default:true"` // 是否接单
	AutoConfirmHours    int     `json:"autoConfirmHours" gorm:"default:24"`
	ServiceStyles       string  `json:"serviceStyles" gorm:"type:text"`   // 擅长风格 JSON
	ServicePackages     string  `json:"servicePackages" gorm:"type:text"` // 服务套餐 JSON
	PriceRangeMin       float64 `json:"priceRangeMin"`
	PriceRangeMax       float64 `json:"priceRangeMax"`
	ResponseTimeDesc    string  `json:"responseTimeDesc" gorm:"size:50"`             // 响应时间描述
	SurveyDepositAmount float64 `json:"surveyDepositAmount" gorm:"default:0"`        // 自定义量房定金（0=使用系统默认）
	DesignPaymentMode   string  `json:"designPaymentMode" gorm:"size:20;default:''"` // onetime | staged（空=跟随系统）
}

// TableName 指定表名
func (MerchantServiceSetting) TableName() string {
	return "merchant_service_settings"
}

// AuditLog 审计日志
type AuditLog struct {
	Base
	RecordKind    string `json:"recordKind" gorm:"size:20;index;default:'request'"` // request/business
	OperatorType  string `json:"operatorType" gorm:"size:20;index"`                 // admin/merchant/user
	OperatorID    uint64 `json:"operatorId" gorm:"index"`
	Action        string `json:"action" gorm:"size:100;index"`        // POST /api/v1/merchant/withdraw
	OperationType string `json:"operationType" gorm:"size:100;index"` // freeze_funds/confirm_proposal
	Resource      string `json:"resource" gorm:"size:50;index"`       // legacy resource label
	ResourceType  string `json:"resourceType" gorm:"size:50;index"`
	ResourceID    uint64 `json:"resourceId" gorm:"index"`
	Reason        string `json:"reason" gorm:"type:text"`
	Result        string `json:"result" gorm:"size:50;index"`
	RequestBody   string `json:"requestBody" gorm:"type:text"` // 脱敏后的请求体
	BeforeState   string `json:"beforeState" gorm:"type:jsonb;default:'{}'"`
	AfterState    string `json:"afterState" gorm:"type:jsonb;default:'{}'"`
	Metadata      string `json:"metadata" gorm:"type:jsonb;default:'{}'"`
	ClientIP      string `json:"clientIp" gorm:"size:50"`
	UserAgent     string `json:"userAgent" gorm:"size:500"`
	StatusCode    int    `json:"statusCode"`
	Duration      int64  `json:"duration"` // 请求耗时(ms)
}

// TableName 指定表名
func (AuditLog) TableName() string {
	return "audit_logs"
}

// SMSAuditLog 短信发送审计日志
type SMSAuditLog struct {
	Base
	RequestID         string `json:"requestId" gorm:"size:64;uniqueIndex"`
	Purpose           string `json:"purpose" gorm:"size:32;index"`
	RiskTier          string `json:"riskTier" gorm:"size:16"`
	PhoneHash         string `json:"phoneHash" gorm:"size:64;index"`
	ClientIP          string `json:"clientIp" gorm:"size:64"`
	Provider          string `json:"provider" gorm:"size:32"`
	TemplateKey       string `json:"templateKey" gorm:"size:64"`
	TemplateCode      string `json:"templateCode" gorm:"size:128"`
	MessageID         string `json:"messageId" gorm:"size:128"`
	ProviderRequestID string `json:"providerRequestId" gorm:"size:128"`
	Status            string `json:"status" gorm:"size:32;index"`
	ErrorCode         string `json:"errorCode" gorm:"size:64"`
	ErrorMessage      string `json:"errorMessage" gorm:"size:500"`
}

func (SMSAuditLog) TableName() string {
	return "sms_audit_logs"
}

// UserLike 用户点赞
type UserLike struct {
	Base
	UserID     uint64 `json:"userId" gorm:"index"`
	TargetID   uint64 `json:"targetId" gorm:"index"`
	TargetType string `json:"targetType" gorm:"size:50;default:'case'"`
}

func (UserLike) TableName() string {
	return "user_likes"
}

// CaseComment 案例评论
type CaseComment struct {
	Base
	CaseID       uint64     `json:"caseId" gorm:"index"`
	UserID       uint64     `json:"userId" gorm:"index"`
	Content      string     `json:"content" gorm:"type:text"`
	Status       string     `json:"status" gorm:"size:20;default:'approved'"`
	RejectReason string     `json:"rejectReason" gorm:"size:200"`
	ModeratedBy  *uint64    `json:"moderatedBy"`
	ModeratedAt  *time.Time `json:"moderatedAt"`
	ReportCount  int        `json:"reportCount" gorm:"default:0"`
}

func (CaseComment) TableName() string {
	return "case_comments"
}

// SensitiveWord 敏感词
type SensitiveWord struct {
	Base
	Word     string `json:"word" gorm:"size:100;uniqueIndex"`
	Category string `json:"category" gorm:"size:20"`
	Level    string `json:"level" gorm:"size:20;default:'normal'"`
	Action   string `json:"action" gorm:"size:20;default:'block'"`
	IsRegex  bool   `json:"isRegex" gorm:"default:false"`
}

func (SensitiveWord) TableName() string {
	return "sensitive_words"
}

// UserSettings 用户偏好设置
type UserSettings struct {
	Base
	UserID                uint64 `json:"userId" gorm:"uniqueIndex"`
	PersonalizedRecommend bool   `json:"personalizedRecommend" gorm:"default:true"`
	LocationTracking      bool   `json:"locationTracking" gorm:"default:false"`
	PhoneVisible          bool   `json:"phoneVisible" gorm:"default:false"`
	NotifySystem          bool   `json:"notifySystem" gorm:"default:true"`
	NotifyProject         bool   `json:"notifyProject" gorm:"default:true"`
	NotifyPayment         bool   `json:"notifyPayment" gorm:"default:true"`
	NotifyPromo           bool   `json:"notifyPromo" gorm:"default:false"`
	NotifySound           bool   `json:"notifySound" gorm:"default:true"`
	NotifyVibrate         bool   `json:"notifyVibrate" gorm:"default:true"`
	DarkMode              bool   `json:"darkMode" gorm:"default:false"`
	FontSize              string `json:"fontSize" gorm:"size:10;default:'medium'"`
	Language              string `json:"language" gorm:"size:5;default:'zh'"`
}

func (UserSettings) TableName() string {
	return "user_settings"
}

// UserVerification 实名认证
type UserVerification struct {
	Base
	UserID       uint64     `json:"userId" gorm:"index"`
	RealName     string     `json:"realName" gorm:"size:50"`
	IDCard       string     `json:"idCard" gorm:"size:20"`
	IDFrontImage string     `json:"idFrontImage" gorm:"size:500"`
	IDBackImage  string     `json:"idBackImage" gorm:"size:500"`
	Status       int8       `json:"status" gorm:"default:0"` // 0=待审核 1=已通过 2=已拒绝
	RejectReason string     `json:"rejectReason" gorm:"size:200"`
	VerifiedAt   *time.Time `json:"verifiedAt"`
}

func (UserVerification) TableName() string {
	return "user_verifications"
}

// UserLoginDevice 登录设备记录
type UserLoginDevice struct {
	Base
	UserID      uint64     `json:"userId" gorm:"index"`
	DeviceName  string     `json:"deviceName" gorm:"size:100"`
	DeviceType  string     `json:"deviceType" gorm:"size:20"`
	DeviceID    string     `json:"deviceId" gorm:"size:200"`
	IPAddress   string     `json:"ipAddress" gorm:"size:50"`
	Location    string     `json:"location" gorm:"size:100"`
	LastLoginAt *time.Time `json:"lastLoginAt"`
	IsCurrent   bool       `json:"isCurrent" gorm:"default:false"`
}

func (UserLoginDevice) TableName() string {
	return "user_login_devices"
}

// UserFeedback 用户反馈
type UserFeedback struct {
	Base
	UserID     uint64 `json:"userId" gorm:"index"`
	Type       string `json:"type" gorm:"size:20"`
	Content    string `json:"content" gorm:"type:text"`
	Contact    string `json:"contact" gorm:"size:100"`
	Images     string `json:"images" gorm:"type:text"`
	Status     int8   `json:"status" gorm:"default:0"` // 0=待处理 1=处理中 2=已处理
	AdminReply string `json:"adminReply" gorm:"type:text"`
}

func (UserFeedback) TableName() string {
	return "user_feedbacks"
}
