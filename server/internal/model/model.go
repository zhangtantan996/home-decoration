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
