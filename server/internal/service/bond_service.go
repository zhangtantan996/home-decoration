package service

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type BondRuleView struct {
	ID               uint64     `json:"id"`
	ProviderType     int8       `json:"providerType"`
	ProviderSubType  string     `json:"providerSubType"`
	ProviderSubLabel string     `json:"providerSubLabel"`
	Enabled          bool       `json:"enabled"`
	RuleType         string     `json:"ruleType"`
	FixedAmount      float64    `json:"fixedAmount"`
	Ratio            float64    `json:"ratio"`
	FloorAmount      float64    `json:"floorAmount"`
	CapAmount        float64    `json:"capAmount"`
	EffectiveFrom    *time.Time `json:"effectiveFrom"`
	EffectiveTo      *time.Time `json:"effectiveTo"`
}

type BondAccountFilter struct {
	Status     string
	ProviderID uint64
	Page       int
	PageSize   int
}

type BondAccountView struct {
	ID              uint64    `json:"id"`
	ProviderID      uint64    `json:"providerId"`
	ProviderName    string    `json:"providerName"`
	RequiredAmount  float64   `json:"requiredAmount"`
	PaidAmount      float64   `json:"paidAmount"`
	FrozenAmount    float64   `json:"frozenAmount"`
	AvailableAmount float64   `json:"availableAmount"`
	Status          string    `json:"status"`
	LastRuleID      uint64    `json:"lastRuleId"`
	UpdatedAt       time.Time `json:"updatedAt"`
}

type BondLedgerItem struct {
	ID          uint64         `json:"id"`
	FundScene   string         `json:"fundScene"`
	Direction   string         `json:"direction"`
	Amount      float64        `json:"amount"`
	BizType     string         `json:"bizType"`
	BizID       uint64         `json:"bizId"`
	RuntimeType string         `json:"runtimeType"`
	RuntimeID   uint64         `json:"runtimeId"`
	Remark      string         `json:"remark"`
	Metadata    map[string]any `json:"metadata"`
	OccurredAt  time.Time      `json:"occurredAt"`
}

type UpdateBondRuleInput struct {
	Enabled       bool
	RuleType      string
	FixedAmount   float64
	Ratio         float64
	FloorAmount   float64
	CapAmount     float64
	EffectiveFrom *time.Time
	EffectiveTo   *time.Time
}

type BondAdjustInput struct {
	Amount float64
	Reason string
}

type BondService struct {
	ledger *LedgerService
}

func NewBondService() *BondService {
	return &BondService{ledger: &LedgerService{}}
}

func (s *BondService) EnsureRuleSeeds() error {
	return repository.DB.Transaction(func(tx *gorm.DB) error {
		return s.ensureRuleSeedsTx(tx)
	})
}

func (s *BondService) ensureRuleSeedsTx(tx *gorm.DB) error {
	subtypes := make([]model.SystemDictionary, 0, 8)
	if err := tx.Model(&model.SystemDictionary{}).
		Where("category_code = ?", "provider_sub_type").
		Order("sort_order ASC, id ASC").
		Find(&subtypes).Error; err != nil {
		subtypes = nil
	}
	if len(subtypes) == 0 {
		subtypes = []model.SystemDictionary{
			{Value: "designer", Label: "设计师"},
			{Value: "company", Label: "装修公司"},
			{Value: "foreman", Label: "工长"},
			{Value: "material_shop", Label: "主材商"},
		}
	}

	for _, item := range subtypes {
		scopeType := providerTypeFromSubtype(item.Value)
		var existing model.MerchantBondRule
		err := tx.Where("provider_type = ? AND provider_sub_type = ?", scopeType, strings.TrimSpace(item.Value)).First(&existing).Error
		if err == nil {
			continue
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		record := model.MerchantBondRule{
			ProviderType:    scopeType,
			ProviderSubType: strings.TrimSpace(item.Value),
			Enabled:         false,
			RuleType:        model.MerchantBondRuleTypeFixedAmount,
		}
		if err := tx.Create(&record).Error; err != nil {
			return err
		}
	}
	return nil
}

func (s *BondService) ListRules() ([]BondRuleView, error) {
	if err := s.EnsureRuleSeeds(); err != nil {
		return nil, err
	}
	var items []model.MerchantBondRule
	if err := repository.DB.Order("provider_type ASC, provider_sub_type ASC, id ASC").Find(&items).Error; err != nil {
		return nil, err
	}
	labels := s.loadSubtypeLabels()
	result := make([]BondRuleView, 0, len(items))
	for i := range items {
		result = append(result, BondRuleView{
			ID:               items[i].ID,
			ProviderType:     items[i].ProviderType,
			ProviderSubType:  items[i].ProviderSubType,
			ProviderSubLabel: labels[items[i].ProviderSubType],
			Enabled:          items[i].Enabled,
			RuleType:         items[i].RuleType,
			FixedAmount:      items[i].FixedAmount,
			Ratio:            items[i].Ratio,
			FloorAmount:      items[i].FloorAmount,
			CapAmount:        items[i].CapAmount,
			EffectiveFrom:    items[i].EffectiveFrom,
			EffectiveTo:      items[i].EffectiveTo,
		})
	}
	return result, nil
}

func (s *BondService) UpdateRule(id uint64, input *UpdateBondRuleInput) (*BondRuleView, error) {
	if id == 0 || input == nil {
		return nil, errors.New("保证金规则不存在")
	}
	ruleType := strings.TrimSpace(input.RuleType)
	if ruleType == "" {
		ruleType = model.MerchantBondRuleTypeFixedAmount
	}
	if ruleType != model.MerchantBondRuleTypeFixedAmount && ruleType != model.MerchantBondRuleTypeRatioWithFloorCap {
		return nil, errors.New("保证金规则类型不支持")
	}
	if input.FixedAmount < 0 || input.Ratio < 0 || input.FloorAmount < 0 || input.CapAmount < 0 {
		return nil, errors.New("保证金规则金额不能为负数")
	}

	var result *BondRuleView
	err := repository.DB.Transaction(func(tx *gorm.DB) error {
		var rule model.MerchantBondRule
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&rule, id).Error; err != nil {
			return errors.New("保证金规则不存在")
		}
		rule.Enabled = input.Enabled
		rule.RuleType = ruleType
		rule.FixedAmount = normalizeAmount(input.FixedAmount)
		rule.Ratio = input.Ratio
		rule.FloorAmount = normalizeAmount(input.FloorAmount)
		rule.CapAmount = normalizeAmount(input.CapAmount)
		rule.EffectiveFrom = input.EffectiveFrom
		rule.EffectiveTo = input.EffectiveTo
		if err := tx.Save(&rule).Error; err != nil {
			return err
		}

		var providerIDs []uint64
		if err := tx.Model(&model.Provider{}).
			Where("provider_type = ? AND sub_type = ?", rule.ProviderType, rule.ProviderSubType).
			Pluck("id", &providerIDs).Error; err == nil {
			for _, providerID := range providerIDs {
				if _, err := s.SyncProviderBondAccountTx(tx, providerID); err != nil {
					return err
				}
			}
		}
		result = &BondRuleView{
			ID:               rule.ID,
			ProviderType:     rule.ProviderType,
			ProviderSubType:  rule.ProviderSubType,
			ProviderSubLabel: s.loadSubtypeLabels()[rule.ProviderSubType],
			Enabled:          rule.Enabled,
			RuleType:         rule.RuleType,
			FixedAmount:      rule.FixedAmount,
			Ratio:            rule.Ratio,
			FloorAmount:      rule.FloorAmount,
			CapAmount:        rule.CapAmount,
			EffectiveFrom:    rule.EffectiveFrom,
			EffectiveTo:      rule.EffectiveTo,
		}
		return nil
	})
	return result, err
}

func (s *BondService) ListAccounts(filter BondAccountFilter) ([]BondAccountView, int64, error) {
	page := filter.Page
	if page <= 0 {
		page = 1
	}
	pageSize := filter.PageSize
	if pageSize <= 0 {
		pageSize = 20
	}
	if err := s.EnsureRuleSeeds(); err != nil {
		return nil, 0, err
	}
	var providerIDs []uint64
	queryProviders := repository.DB.Model(&model.Provider{})
	if filter.ProviderID > 0 {
		queryProviders = queryProviders.Where("id = ?", filter.ProviderID)
	}
	if err := queryProviders.Pluck("id", &providerIDs).Error; err == nil {
		for _, providerID := range providerIDs {
			if _, err := s.SyncProviderBondAccount(providerID); err != nil {
				return nil, 0, err
			}
		}
	}

	query := repository.DB.Table("merchant_bond_accounts AS mba").
		Joins("LEFT JOIN providers AS p ON p.id = mba.provider_id").
		Select(`mba.id, mba.provider_id,
			COALESCE(NULLIF(p.company_name, ''), '服务商 #' || CAST(mba.provider_id AS TEXT)) AS provider_name,
			mba.required_amount, mba.paid_amount, mba.frozen_amount, mba.available_amount, mba.status, mba.last_rule_id, mba.updated_at`)
	if filter.ProviderID > 0 {
		query = query.Where("mba.provider_id = ?", filter.ProviderID)
	}
	if status := strings.TrimSpace(filter.Status); status != "" {
		query = query.Where("mba.status = ?", status)
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var result []BondAccountView
	if err := query.Order("mba.updated_at DESC, mba.id DESC").Offset((page - 1) * pageSize).Limit(pageSize).Scan(&result).Error; err != nil {
		return nil, 0, err
	}
	return result, total, nil
}

func (s *BondService) GetProviderBondAccount(providerID uint64) (*BondAccountView, error) {
	if providerID == 0 {
		return nil, errors.New("服务商不存在")
	}
	account, err := s.SyncProviderBondAccount(providerID)
	if err != nil {
		return nil, err
	}
	var provider model.Provider
	_ = repository.DB.Select("id, company_name").First(&provider, providerID).Error
	return &BondAccountView{
		ID:              account.ID,
		ProviderID:      providerID,
		ProviderName:    providerDisplayName(&provider),
		RequiredAmount:  account.RequiredAmount,
		PaidAmount:      account.PaidAmount,
		FrozenAmount:    account.FrozenAmount,
		AvailableAmount: account.AvailableAmount,
		Status:          account.Status,
		LastRuleID:      account.LastRuleID,
		UpdatedAt:       account.UpdatedAt,
	}, nil
}

func (s *BondService) ListProviderBondLedger(providerID uint64, page, pageSize int) ([]BondLedgerItem, int64, error) {
	if providerID == 0 {
		return nil, 0, errors.New("服务商不存在")
	}
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 20
	}
	account, err := s.ledger.ensureAccountTx(repository.DB, model.LedgerAccountTypeMerchantDeposit, providerID, 0)
	if err != nil {
		return nil, 0, err
	}
	query := repository.DB.Model(&model.LedgerEntry{}).
		Where("debit_account_id = ? OR credit_account_id = ?", account.ID, account.ID)
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var rows []model.LedgerEntry
	if err := query.Order("occurred_at DESC, id DESC").Offset((page - 1) * pageSize).Limit(pageSize).Find(&rows).Error; err != nil {
		return nil, 0, err
	}
	result := make([]BondLedgerItem, 0, len(rows))
	for i := range rows {
		direction := "in"
		if rows[i].DebitAccountID == account.ID {
			direction = "out"
		}
		result = append(result, BondLedgerItem{
			ID:          rows[i].ID,
			FundScene:   rows[i].FundScene,
			Direction:   direction,
			Amount:      rows[i].Amount,
			BizType:     rows[i].BizType,
			BizID:       rows[i].BizID,
			RuntimeType: rows[i].RuntimeType,
			RuntimeID:   rows[i].RuntimeID,
			Remark:      rows[i].Remark,
			Metadata:    parseJSONObject(rows[i].MetadataJSON),
			OccurredAt:  rows[i].OccurredAt,
		})
	}
	return result, total, nil
}

func (s *BondService) SyncProviderBondAccount(providerID uint64) (*model.MerchantBondAccount, error) {
	var result *model.MerchantBondAccount
	err := repository.DB.Transaction(func(tx *gorm.DB) error {
		account, err := s.SyncProviderBondAccountTx(tx, providerID)
		if err != nil {
			return err
		}
		result = account
		return nil
	})
	return result, err
}

func (s *BondService) SyncProviderBondAccountTx(tx *gorm.DB, providerID uint64) (*model.MerchantBondAccount, error) {
	if providerID == 0 {
		return nil, errors.New("服务商不存在")
	}
	if err := s.ensureRuleSeedsTx(tx); err != nil {
		return nil, err
	}
	var provider model.Provider
	if err := tx.First(&provider, providerID).Error; err != nil {
		return nil, errors.New("服务商不存在")
	}
	rule, err := s.loadMatchingRuleTx(tx, &provider)
	if err != nil {
		return nil, err
	}
	account, err := s.ensureBondAccountTx(tx, providerID)
	if err != nil {
		return nil, err
	}

	requiredAmount := 0.0
	lastRuleID := uint64(0)
	status := model.MerchantBondAccountStatusDisabled
	if rule != nil {
		requiredAmount = s.computeRequiredAmount(rule, &provider)
		lastRuleID = rule.ID
		if requiredAmount > 0 {
			status = model.MerchantBondAccountStatusPending
		}
	}

	ledgerAccount, err := s.ledger.ensureAccountTx(tx, model.LedgerAccountTypeMerchantDeposit, providerID, 0)
	if err != nil {
		return nil, err
	}
	paidAmount := normalizeAmount(ledgerAccount.Balance)
	frozenAmount := paidAmount
	availableAmount := 0.0
	if status != model.MerchantBondAccountStatusDisabled {
		if paidAmount >= requiredAmount && requiredAmount > 0 {
			status = model.MerchantBondAccountStatusActive
		} else if paidAmount > 0 {
			status = model.MerchantBondAccountStatusPending
		}
	}

	account.RequiredAmount = requiredAmount
	account.PaidAmount = paidAmount
	account.FrozenAmount = frozenAmount
	account.AvailableAmount = availableAmount
	account.Status = status
	account.LastRuleID = lastRuleID
	if err := tx.Save(account).Error; err != nil {
		return nil, err
	}
	return account, nil
}

func (s *BondService) RefundBond(adminID, providerID uint64, input *BondAdjustInput) (*BondAccountView, error) {
	return s.adjustBondBalance(adminID, providerID, input, "refund", "保证金退还", false)
}

func (s *BondService) RefundBondByAccountID(adminID, accountID uint64, input *BondAdjustInput) (*BondAccountView, error) {
	account, err := s.loadBondAccountByID(accountID)
	if err != nil {
		return nil, err
	}
	return s.RefundBond(adminID, account.ProviderID, input)
}

func (s *BondService) ForfeitBond(adminID, providerID uint64, input *BondAdjustInput) (*BondAccountView, error) {
	return s.adjustBondBalance(adminID, providerID, input, "forfeit", "保证金扣罚", true)
}

func (s *BondService) ForfeitBondByAccountID(adminID, accountID uint64, input *BondAdjustInput) (*BondAccountView, error) {
	account, err := s.loadBondAccountByID(accountID)
	if err != nil {
		return nil, err
	}
	return s.ForfeitBond(adminID, account.ProviderID, input)
}

func (s *BondService) adjustBondBalance(adminID, providerID uint64, input *BondAdjustInput, bizType, remark string, toRevenue bool) (*BondAccountView, error) {
	if providerID == 0 {
		return nil, errors.New("服务商不存在")
	}
	if input == nil || input.Amount <= 0 {
		return nil, errors.New("金额必须大于0")
	}
	if strings.TrimSpace(input.Reason) == "" {
		return nil, errors.New("请填写原因")
	}

	var result *BondAccountView
	err := repository.DB.Transaction(func(tx *gorm.DB) error {
		account, err := s.SyncProviderBondAccountTx(tx, providerID)
		if err != nil {
			return err
		}
		if account.PaidAmount < input.Amount {
			return errors.New("保证金余额不足")
		}
		depositLedger, err := s.ledger.ensureAccountTx(tx, model.LedgerAccountTypeMerchantDeposit, providerID, 0)
		if err != nil {
			return err
		}
		var creditLedger *model.LedgerAccount
		if toRevenue {
			creditLedger, err = s.ledger.ensureAccountTx(tx, model.LedgerAccountTypePlatformRevenue, 0, 0)
			if err != nil {
				return err
			}
			if _, err := s.ledger.adjustBalanceTx(tx, model.LedgerAccountTypePlatformRevenue, 0, 0, input.Amount); err != nil {
				return err
			}
		}
		if _, err := s.ledger.adjustBalanceTx(tx, model.LedgerAccountTypeMerchantDeposit, providerID, 0, -input.Amount); err != nil {
			return err
		}
		entry := ledgerEntryRecord{
			FundScene:      model.FundSceneMerchantDeposit,
			DebitAccountID: depositLedger.ID,
			Amount:         normalizeAmount(input.Amount),
			BizType:        bizType,
			BizID:          providerID,
			RuntimeType:    "bond_adjustment",
			RuntimeID:      adminID,
			Remark:         fmt.Sprintf("%s：%s", remark, strings.TrimSpace(input.Reason)),
			Metadata:       map[string]any{"providerId": providerID, "adminId": adminID, "reason": strings.TrimSpace(input.Reason)},
		}
		if creditLedger != nil {
			entry.CreditAccountID = creditLedger.ID
		}
		if err := s.ledger.appendEntryTx(tx, entry); err != nil {
			return err
		}
		updated, err := s.SyncProviderBondAccountTx(tx, providerID)
		if err != nil {
			return err
		}
		if toRevenue {
			updated.Status = model.MerchantBondAccountStatusForfeited
		} else {
			updated.Status = model.MerchantBondAccountStatusRefunding
		}
		if err := tx.Model(updated).Update("status", updated.Status).Error; err != nil {
			return err
		}
		view, err := s.GetProviderBondAccount(providerID)
		if err != nil {
			return err
		}
		result = view
		return nil
	})
	return result, err
}

func (s *BondService) loadMatchingRuleTx(tx *gorm.DB, provider *model.Provider) (*model.MerchantBondRule, error) {
	if provider == nil {
		return nil, nil
	}
	var rule model.MerchantBondRule
	err := tx.Where("provider_type = ? AND provider_sub_type = ?", provider.ProviderType, strings.TrimSpace(provider.SubType)).
		First(&rule).Error
	if err == nil {
		if !rule.Enabled {
			return nil, nil
		}
		return &rule, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	err = tx.Where("provider_sub_type = ?", strings.TrimSpace(provider.SubType)).Order("provider_type DESC").First(&rule).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	if !rule.Enabled {
		return nil, nil
	}
	return &rule, nil
}

func (s *BondService) loadBondAccountByID(accountID uint64) (*model.MerchantBondAccount, error) {
	if accountID == 0 {
		return nil, errors.New("保证金账户不存在")
	}
	var account model.MerchantBondAccount
	if err := repository.DB.First(&account, accountID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("保证金账户不存在")
		}
		return nil, err
	}
	return &account, nil
}

func (s *BondService) ensureBondAccountTx(tx *gorm.DB, providerID uint64) (*model.MerchantBondAccount, error) {
	var account model.MerchantBondAccount
	err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("provider_id = ?", providerID).First(&account).Error
	if err == nil {
		return &account, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	account = model.MerchantBondAccount{ProviderID: providerID, Status: model.MerchantBondAccountStatusDisabled}
	if err := tx.Create(&account).Error; err != nil {
		return nil, err
	}
	return &account, nil
}

func (s *BondService) computeRequiredAmount(rule *model.MerchantBondRule, provider *model.Provider) float64 {
	if rule == nil || provider == nil || !rule.Enabled {
		return 0
	}
	switch rule.RuleType {
	case model.MerchantBondRuleTypeRatioWithFloorCap:
		baseAmount := provider.PriceMin
		if baseAmount <= 0 {
			baseAmount = provider.PriceMax
		}
		amount := normalizeAmount(baseAmount * rule.Ratio)
		if amount <= 0 {
			amount = rule.FloorAmount
		}
		if rule.FloorAmount > 0 && amount < rule.FloorAmount {
			amount = rule.FloorAmount
		}
		if rule.CapAmount > 0 && amount > rule.CapAmount {
			amount = rule.CapAmount
		}
		return normalizeAmount(amount)
	default:
		return normalizeAmount(rule.FixedAmount)
	}
}

func (s *BondService) loadSubtypeLabels() map[string]string {
	result := map[string]string{
		"designer":      "设计师",
		"company":       "装修公司",
		"foreman":       "工长",
		"material_shop": "主材商",
	}
	var items []model.SystemDictionary
	if err := repository.DB.Where("category_code = ?", "provider_sub_type").Find(&items).Error; err != nil {
		return result
	}
	for _, item := range items {
		if strings.TrimSpace(item.Value) == "" || strings.TrimSpace(item.Label) == "" {
			continue
		}
		result[item.Value] = item.Label
	}
	return result
}

func providerTypeFromSubtype(subType string) int8 {
	switch strings.TrimSpace(subType) {
	case "designer":
		return 1
	case "company":
		return 2
	case "foreman":
		return 3
	default:
		return 0
	}
}

func providerDisplayName(provider *model.Provider) string {
	if provider == nil {
		return ""
	}
	if strings.TrimSpace(provider.CompanyName) != "" {
		return provider.CompanyName
	}
	return fmt.Sprintf("服务商 #%d", provider.ID)
}
