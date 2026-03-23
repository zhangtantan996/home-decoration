package model

import "time"

const (
	FinanceReconciliationStatusSuccess    = "success"
	FinanceReconciliationStatusWarning    = "warning"
	FinanceReconciliationStatusProcessing = "processing"
	FinanceReconciliationStatusResolved   = "resolved"
)

// FinanceReconciliation 日对账结果
type FinanceReconciliation struct {
	Base
	ReconcileDate     time.Time  `json:"reconcileDate" gorm:"type:date;uniqueIndex"`
	Status            string     `json:"status" gorm:"size:20;index;default:'success'"`
	FindingCount      int        `json:"findingCount" gorm:"default:0"`
	SummaryJSON       string     `json:"summaryJson" gorm:"type:jsonb;default:'{}'"`
	FindingsJSON      string     `json:"findingsJson" gorm:"type:jsonb;default:'[]'"`
	OwnerAdminID      uint64     `json:"ownerAdminId" gorm:"index"`
	OwnerNote         string     `json:"ownerNote" gorm:"type:text"`
	ResolvedByAdminID uint64     `json:"resolvedByAdminId" gorm:"index"`
	ResolutionNote    string     `json:"resolutionNote" gorm:"type:text"`
	ResolvedAt        *time.Time `json:"resolvedAt"`
	LastRunAt         time.Time  `json:"lastRunAt"`
}

func (FinanceReconciliation) TableName() string {
	return "finance_reconciliations"
}
