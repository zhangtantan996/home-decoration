package model

import (
	"time"
)

// UserIdentity 用户身份表 - 支持一个用户拥有多个身份
type UserIdentity struct {
	Base
	UserID        uint64     `json:"userId" gorm:"index;not null"`
	IdentityType  string     `json:"identityType" gorm:"size:32;not null"` // owner, designer, worker, company, supplier
	IdentityRefID *uint64    `json:"identityRefId" gorm:"index"`           // 关联 providers.id 或 workers.id
	Status        int8       `json:"status" gorm:"default:0"`              // 0=pending, 1=approved, 2=rejected, 3=suspended
	Verified      bool       `json:"verified" gorm:"default:false"`        // 是否已验证
	VerifiedAt    *time.Time `json:"verifiedAt"`                           // 验证时间
	VerifiedBy    *uint64    `json:"verifiedBy" gorm:"index"`              // 验证人（管理员ID）

	// 关联关系
	User     User      `json:"-" gorm:"foreignKey:UserID"`
	Provider *Provider `json:"provider,omitempty" gorm:"foreignKey:IdentityRefID"`
	Worker   *Worker   `json:"worker,omitempty" gorm:"foreignKey:IdentityRefID"`
}

// TableName 指定表名
func (UserIdentity) TableName() string {
	return "user_identities"
}

// IdentityApplication 身份申请表 - 记录用户申请新身份的流程
type IdentityApplication struct {
	Base
	UserID          uint64     `json:"userId" gorm:"index;not null"`
	IdentityType    string     `json:"identityType" gorm:"size:32;not null"`
	ApplicationData string     `json:"applicationData" gorm:"type:jsonb;not null"` // JSONB格式存储申请材料
	Status          int8       `json:"status" gorm:"default:0"`                    // 0=pending, 1=approved, 2=rejected
	RejectReason    string     `json:"rejectReason" gorm:"type:text"`
	AppliedAt       time.Time  `json:"appliedAt" gorm:"default:now()"`
	ReviewedAt      *time.Time `json:"reviewedAt"`
	ReviewedBy      *uint64    `json:"reviewedBy" gorm:"index"` // 审核人（管理员ID）

	// 关联关系
	User User `json:"-" gorm:"foreignKey:UserID"`
}

// TableName 指定表名
func (IdentityApplication) TableName() string {
	return "identity_applications"
}

// IdentityAuditLog 身份审计日志表 - 记录所有身份相关操作
type IdentityAuditLog struct {
	ID           uint64    `json:"id" gorm:"primaryKey"`
	UserID       uint64    `json:"userId" gorm:"index;not null"`
	Action       string    `json:"action" gorm:"size:64;not null"` // switch, apply, approve, reject, suspend
	FromIdentity string    `json:"fromIdentity" gorm:"size:32"`
	ToIdentity   string    `json:"toIdentity" gorm:"size:32"`
	IPAddress    string    `json:"ipAddress" gorm:"size:50"`
	UserAgent    string    `json:"userAgent" gorm:"type:text"`
	Metadata     string    `json:"metadata" gorm:"type:jsonb"` // JSONB格式存储额外元数据
	CreatedAt    time.Time `json:"createdAt" gorm:"default:now()"`

	// 关联关系
	User User `json:"-" gorm:"foreignKey:UserID"`
}

// TableName 指定表名
func (IdentityAuditLog) TableName() string {
	return "identity_audit_logs"
}
