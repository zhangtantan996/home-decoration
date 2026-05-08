package model

import (
	"time"
)

// SupervisorProfile 监理资料表 — 监理角色专业资料
type SupervisorProfile struct {
	Base
	UserID         uint64     `json:"userId" gorm:"index;not null"`
	RealName       string     `json:"realName" gorm:"size:50;default:''"`
	Phone          string     `json:"phone" gorm:"size:20;default:''"`
	CityCode       string     `json:"cityCode" gorm:"size:10;default:''"`
	ServiceArea    string     `json:"serviceArea" gorm:"type:text"`      // JSON 数组：服务城市代码
	Certifications string     `json:"certifications" gorm:"type:text"`   // JSON 数组：资质证书
	Status         int8       `json:"status" gorm:"default:1"`           // 1=正常 0=禁用
	Verified       bool       `json:"verified" gorm:"default:false"`
	VerifiedAt     *time.Time `json:"verifiedAt"`
}

// TableName 指定表名
func (SupervisorProfile) TableName() string {
	return "supervisor_profiles"
}

// AdminProfile 后台人员资料桥接表 — 桥接 users ↔ sys_admins
type AdminProfile struct {
	Base
	UserID      uint64 `json:"userId" gorm:"index;not null"`
	SysAdminID  uint64 `json:"sysAdminId" gorm:"index;not null"`
	AdminType   string `json:"adminType" gorm:"size:20;default:''"` // super_admin / security_admin / audit_admin / regular
	Status      int8   `json:"status" gorm:"default:1"`             // 1=正常 0=禁用

	// 关联
	User     User     `json:"-" gorm:"foreignKey:UserID"`
	SysAdmin SysAdmin `json:"-" gorm:"foreignKey:SysAdminID"`
}

// TableName 指定表名
func (AdminProfile) TableName() string {
	return "admin_profiles"
}

// ProjectSupervisorAssignment 项目监理分配表
type ProjectSupervisorAssignment struct {
	Base
	ProjectID    uint64 `json:"projectId" gorm:"index;not null"`
	SupervisorID uint64 `json:"supervisorId" gorm:"index;not null"`
	AssignedBy   uint64 `json:"assignedBy" gorm:"default:0"`
	Status       int8   `json:"status" gorm:"default:1"` // 1=active 0=inactive
	AssignedAt   time.Time `json:"assignedAt"`

	// 关联
	Project          Project           `json:"-" gorm:"foreignKey:ProjectID"`
	SupervisorProfile SupervisorProfile `json:"-" gorm:"foreignKey:SupervisorID"`
}

// TableName 指定表名
func (ProjectSupervisorAssignment) TableName() string {
	return "project_supervisor_assignments"
}

// SupervisionLog 监理日志表（支持离线草稿）
type SupervisionLog struct {
	Base
	ProjectID        uint64     `json:"projectId" gorm:"index;not null"`
	SupervisorID     uint64     `json:"supervisorId" gorm:"index;not null"`
	Stage            string     `json:"stage" gorm:"size:50;default:''"`
	Content          string     `json:"content" gorm:"type:text"`
	Photos           string     `json:"photos" gorm:"type:text"` // JSON 数组
	OfflineCreatedAt *time.Time `json:"offlineCreatedAt"`
	SyncedAt         *time.Time `json:"syncedAt"` // NULL=离线草稿

	// 关联
	Project           Project            `json:"-" gorm:"foreignKey:ProjectID"`
	SupervisorProfile SupervisorProfile  `json:"-" gorm:"foreignKey:SupervisorID"`
}

// TableName 指定表名
func (SupervisionLog) TableName() string {
	return "supervision_logs"
}

// SupervisionIssue 监理问题整改表
type SupervisionIssue struct {
	Base
	ProjectID          uint64     `json:"projectId" gorm:"index;not null"`
	SupervisorID       uint64     `json:"supervisorId" gorm:"index;not null"`
	LogID              *uint64    `json:"logId" gorm:"index"`                    // 关联 supervision_logs.id
	IssueType          string     `json:"issueType" gorm:"size:50;default:''"`   // quality/safety/progress/material/compliance
	Severity           string     `json:"severity" gorm:"size:20;default:'medium'"` // low/medium/high/critical
	AssigneeProviderID uint64     `json:"assigneeProviderId" gorm:"default:0"`    // 指派给 providers.id
	Status             string     `json:"status" gorm:"size:20;default:'open'"`   // open/in_progress/resolved/closed
	DeadlineAt         *time.Time `json:"deadlineAt"`
	ClosedAt           *time.Time `json:"closedAt"`

	// 关联
	Project           Project            `json:"-" gorm:"foreignKey:ProjectID"`
	SupervisorProfile SupervisorProfile  `json:"-" gorm:"foreignKey:SupervisorID"`
	Log               *SupervisionLog    `json:"-" gorm:"foreignKey:LogID"`
	AssigneeProvider  Provider           `json:"-" gorm:"foreignKey:AssigneeProviderID"`
}

// TableName 指定表名
func (SupervisionIssue) TableName() string {
	return "supervision_issues"
}
