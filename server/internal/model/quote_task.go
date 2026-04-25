package model

import "time"

// QuoteTask 报价任务
type QuoteTask struct {
	Base
	BookingID       uint64     `json:"bookingId" gorm:"index"`
	UserID          uint64     `json:"userId" gorm:"index"`
	ProjectID       uint64     `json:"projectId" gorm:"index"`
	Area            float64    `json:"area"`
	Style           string     `json:"style" gorm:"size:50"`
	Region          string     `json:"region" gorm:"size:100"`
	Budget          float64    `json:"budget"`
	Description     string     `json:"description" gorm:"type:text"`
	Status          string     `json:"status" gorm:"size:20;default:'pending';index"` // pending, in_progress, completed, expired
	ExpiredAt       *time.Time `json:"expiredAt" gorm:"index"`
	SelectedQuoteID uint64     `json:"selectedQuoteId" gorm:"index"`
}

// QuotePKSubmission 报价PK提交（使用不同的表名避免与现有quote_submissions冲突）
type QuotePKSubmission struct {
	Base
	QuoteTaskID uint64     `json:"quoteTaskId" gorm:"index"`
	ProviderID  uint64     `json:"providerId" gorm:"index"`
	TotalPrice  float64    `json:"totalPrice"`
	Duration    int        `json:"duration"` // 工期（天）
	Materials   string     `json:"materials" gorm:"type:text"`
	Description string     `json:"description" gorm:"type:text"`
	Status      string     `json:"status" gorm:"size:20;default:'pending'"` // pending, selected, rejected
	SubmittedAt *time.Time `json:"submittedAt"`
}

// TableName 指定表名
func (QuotePKSubmission) TableName() string {
	return "quote_pk_submissions"
}
