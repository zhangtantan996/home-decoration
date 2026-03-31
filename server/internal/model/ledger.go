package model

import "time"

const (
	LedgerAccountTypePlatformRevenue           = "platform_revenue"
	LedgerAccountTypeMerchantDeposit           = "merchant_deposit"
	LedgerAccountTypeProjectEscrow             = "project_escrow"
	LedgerAccountTypeMerchantSettlementPending = "merchant_settlement_pending"
	LedgerAccountTypeMerchantSettlementPaid    = "merchant_settlement_paid"
)

type LedgerAccount struct {
	Base
	AccountType string     `json:"accountType" gorm:"size:50;index:idx_ledger_accounts_scope,priority:1"`
	ProviderID  uint64     `json:"providerId" gorm:"index:idx_ledger_accounts_scope,priority:2;default:0"`
	ProjectID   uint64     `json:"projectId" gorm:"index:idx_ledger_accounts_scope,priority:3;default:0"`
	Balance     float64    `json:"balance" gorm:"default:0"`
	Currency    string     `json:"currency" gorm:"size:10;default:'CNY'"`
	LastEntryAt *time.Time `json:"lastEntryAt"`
}

func (LedgerAccount) TableName() string {
	return "ledger_accounts"
}

type LedgerEntry struct {
	Base
	FundScene       string    `json:"fundScene" gorm:"size:40;index"`
	DebitAccountID  uint64    `json:"debitAccountId" gorm:"index"`
	CreditAccountID uint64    `json:"creditAccountId" gorm:"index"`
	Amount          float64   `json:"amount"`
	BizType         string    `json:"bizType" gorm:"size:50;index"`
	BizID           uint64    `json:"bizId" gorm:"index"`
	RuntimeType     string    `json:"runtimeType" gorm:"size:50;index"`
	RuntimeID       uint64    `json:"runtimeId" gorm:"index"`
	Remark          string    `json:"remark" gorm:"type:text"`
	MetadataJSON    string    `json:"metadataJson" gorm:"type:jsonb;default:'{}'"`
	OccurredAt      time.Time `json:"occurredAt" gorm:"index"`
}

func (LedgerEntry) TableName() string {
	return "ledger_entries"
}
