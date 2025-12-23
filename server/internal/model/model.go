package model

import (
	"time"
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
	Phone    string `json:"phone" gorm:"uniqueIndex;size:20"`
	Nickname string `json:"nickname" gorm:"size:50"`
	Avatar   string `json:"avatar" gorm:"size:500"`
	Password string `json:"-" gorm:"size:255"` // 密码，不返回给前端
	UserType int8   `json:"userType"`          // 1业主 2服务商 3工人 4管理员
	Status   int8   `json:"status" gorm:"default:1"`
}

// Provider 服务商
type Provider struct {
	Base
	UserID        uint64  `json:"userId" gorm:"index"`
	ProviderType  int8    `json:"providerType"` // 1设计师 2公司 3工长
	CompanyName   string  `json:"companyName" gorm:"size:100"`
	LicenseNo     string  `json:"licenseNo" gorm:"size:50"`
	Rating        float32 `json:"rating" gorm:"default:0"`
	RestoreRate   float32 `json:"restoreRate"`   // 还原度
	BudgetControl float32 `json:"budgetControl"` // 预算控制力
	CompletedCnt  int     `json:"completedCnt" gorm:"default:0"`
	Verified      bool    `json:"verified" gorm:"default:false"`
	Latitude      float64 `json:"latitude"`
	Longitude     float64 `json:"longitude"`
	// 新增字段
	SubType         string  `json:"subType" gorm:"size:20;default:'personal'"` // 子类型：personal, studio, company
	YearsExperience int     `json:"yearsExperience" gorm:"default:0"`          // 从业年限
	Specialty       string  `json:"specialty" gorm:"size:200"`                 // 专长/风格描述
	WorkTypes       string  `json:"workTypes" gorm:"size:100"`                 // 工种类型，逗号分隔：mason,electrician,carpenter,painter,plumber
	ReviewCount     int     `json:"reviewCount" gorm:"default:0"`              // 评价数量
	PriceMin        float64 `json:"priceMin" gorm:"default:0"`                 // 最低价格
	PriceMax        float64 `json:"priceMax" gorm:"default:0"`                 // 最高价格
	PriceUnit       string  `json:"priceUnit" gorm:"size:20;default:'元/天'"`    // 价格单位
	// 详情页扩展字段
	CoverImage      string `json:"coverImage" gorm:"size:500"`          // 封面背景图
	FollowersCount  int    `json:"followersCount" gorm:"default:0"`     // 粉丝/关注数
	ServiceIntro    string `json:"serviceIntro" gorm:"type:text"`       // 服务介绍
	TeamSize        int    `json:"teamSize" gorm:"default:1"`           // 团队规模
	EstablishedYear int    `json:"establishedYear" gorm:"default:2020"` // 成立年份
	Certifications  string `json:"certifications" gorm:"type:text"`     // 资质认证 (JSON数组)
}

// ProviderCase 服务商案例/作品
type ProviderCase struct {
	Base
	ProviderID  uint64 `json:"providerId" gorm:"index"`
	Title       string `json:"title" gorm:"size:100"`
	CoverImage  string `json:"coverImage" gorm:"size:500"`
	Style       string `json:"style" gorm:"size:50"` // 风格
	Area        string `json:"area" gorm:"size:20"`  // 面积
	Year        string `json:"year" gorm:"size:10"`  // 年份
	Description string `json:"description" gorm:"type:text"`
	Images      string `json:"images" gorm:"type:text"` // JSON数组
	SortOrder   int    `json:"sortOrder" gorm:"default:0"`
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

// Project 项目
type Project struct {
	Base
	OwnerID      uint64     `json:"ownerId" gorm:"index"`
	ProviderID   uint64     `json:"providerId" gorm:"index"`
	Name         string     `json:"name" gorm:"size:100"`
	Address      string     `json:"address" gorm:"size:200"`
	Latitude     float64    `json:"latitude"`
	Longitude    float64    `json:"longitude"`
	Area         float64    `json:"area"`   // 面积
	Budget       float64    `json:"budget"` // 预算
	Status       int8       `json:"status" gorm:"default:0"`
	CurrentPhase string     `json:"currentPhase" gorm:"size:50"`
	StartDate    *time.Time `json:"startDate"`
	ExpectedEnd  *time.Time `json:"expectedEnd"`
	ActualEnd    *time.Time `json:"actualEnd"`
}

// Milestone 验收节点
type Milestone struct {
	Base
	ProjectID   uint64     `json:"projectId" gorm:"index"`
	Name        string     `json:"name" gorm:"size:50"`
	Seq         int8       `json:"seq"` // 顺序
	Amount      float64    `json:"amount"`
	Percentage  float32    `json:"percentage"`
	Status      int8       `json:"status" gorm:"default:0"`
	Criteria    string     `json:"criteria" gorm:"type:text"` // 验收标准
	SubmittedAt *time.Time `json:"submittedAt"`
	AcceptedAt  *time.Time `json:"acceptedAt"`
	PaidAt      *time.Time `json:"paidAt"`
}

// WorkLog 施工日志
type WorkLog struct {
	Base
	ProjectID   uint64    `json:"projectId" gorm:"index"`
	WorkerID    uint64    `json:"workerId" gorm:"index"`
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
	ProjectID      uint64  `json:"projectId" gorm:"uniqueIndex"`
	TotalAmount    float64 `json:"totalAmount"`
	FrozenAmount   float64 `json:"frozenAmount" gorm:"default:0"`
	ReleasedAmount float64 `json:"releasedAmount" gorm:"default:0"`
	Status         int8    `json:"status" gorm:"default:1"`
}

// Transaction 交易记录
type Transaction struct {
	Base
	EscrowID    uint64     `json:"escrowId" gorm:"index"`
	MilestoneID uint64     `json:"milestoneId" gorm:"index"`
	Type        string     `json:"type" gorm:"size:20"` // deposit, release, refund
	Amount      float64    `json:"amount"`
	FromUserID  uint64     `json:"fromUserId"`
	ToUserID    uint64     `json:"toUserId"`
	Status      int8       `json:"status" gorm:"default:0"`
	CompletedAt *time.Time `json:"completedAt"`
}

// Booking 预约记录
type Booking struct {
	Base
	UserID         uint64  `json:"userId" gorm:"index"`
	ProviderID     uint64  `json:"providerId" gorm:"index"`
	ProviderType   string  `json:"providerType" gorm:"size:20"` // designer, worker, company
	Address        string  `json:"address" gorm:"size:200"`
	Area           float64 `json:"area"`
	RenovationType string  `json:"renovationType" gorm:"size:50"`
	BudgetRange    string  `json:"budgetRange" gorm:"size:50"`
	PreferredDate  string  `json:"preferredDate" gorm:"size:100"`
	Phone          string  `json:"phone" gorm:"size:20"`
	Notes          string  `json:"notes" gorm:"type:text"`
	Status         int8    `json:"status" gorm:"default:1"` // 1:pending, 2:confirmed, 3:completed, 4:cancelled
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
