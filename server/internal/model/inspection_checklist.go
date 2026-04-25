package model

import "time"

// InspectionChecklist 验收清单
type InspectionChecklist struct {
	Base
	MilestoneID uint64     `json:"milestoneId" gorm:"index"`
	ProjectID   uint64     `json:"projectId" gorm:"index"`
	Category    string     `json:"category" gorm:"size:50"` // 水电、瓦工、木工、油漆
	Items       string     `json:"items" gorm:"type:jsonb;default:'[]'"`
	Status      string     `json:"status" gorm:"size:20;default:'pending'"` // pending, passed, failed, resubmitted
	SubmittedBy uint64     `json:"submittedBy" gorm:"index"`
	SubmittedAt *time.Time `json:"submittedAt"`
	ReviewedBy  uint64     `json:"reviewedBy"`
	ReviewedAt  *time.Time `json:"reviewedAt"`
	Notes       string     `json:"notes" gorm:"type:text"`
	// 整改相关字段
	RectificationNotes string     `json:"rectificationNotes" gorm:"type:text"` // 整改说明（商家填写）
	ResubmitCount      int        `json:"resubmitCount" gorm:"default:0"`      // 重新提交次数
	InspectionNotes    string     `json:"inspectionNotes" gorm:"type:text"`    // 验收意见（用户填写）
	RejectedAt         *time.Time `json:"rejectedAt"`                          // 拒绝时间
	ResubmittedAt      *time.Time `json:"resubmittedAt"`                       // 重新提交时间
}

// TableName 指定表名
func (InspectionChecklist) TableName() string {
	return "inspection_checklists"
}

// InspectionItem 验收清单项
type InspectionItem struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Required    bool   `json:"required"`
	Passed      bool   `json:"passed"`
	Note        string `json:"note"`
}

// InspectionTemplate 验收清单模板
type InspectionTemplate struct {
	Base
	Category    string `json:"category" gorm:"size:50;uniqueIndex"` // 水电、瓦工、木工、油漆
	Name        string `json:"name" gorm:"size:100"`
	Description string `json:"description" gorm:"type:text"`
	Items       string `json:"items" gorm:"type:jsonb;default:'[]'"` // JSON数组
	IsDefault   bool   `json:"isDefault" gorm:"default:false"`
	Status      int8   `json:"status" gorm:"default:1"` // 1:启用 0:禁用
}

// TableName 指定表名
func (InspectionTemplate) TableName() string {
	return "inspection_templates"
}
