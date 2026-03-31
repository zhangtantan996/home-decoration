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

type SettlementService struct{}

type ReleaseMilestoneInput struct {
	ProjectID    uint64
	MilestoneID  uint64
	OperatorType string
	OperatorID   uint64
	Reason       string
	Source       string
}

type ReleaseMilestoneResult struct {
	Project         *model.Project
	Escrow          *model.EscrowAccount
	Milestone       *model.Milestone
	Transaction     *model.Transaction
	MerchantIncome  *model.MerchantIncome
	SettlementOrder *model.SettlementOrder
}

type SettlementListFilter struct {
	Status     string
	ProviderID uint64
	Page       int
	PageSize   int
}

type SettlementOrderView struct {
	ID                uint64     `json:"id"`
	BizType           string     `json:"bizType"`
	BizID             uint64     `json:"bizId"`
	ProjectID         uint64     `json:"projectId"`
	ProjectName       string     `json:"projectName"`
	ProviderID        uint64     `json:"providerId"`
	ProviderName      string     `json:"providerName"`
	FundScene         string     `json:"fundScene"`
	GrossAmount       float64    `json:"grossAmount"`
	PlatformFee       float64    `json:"platformFee"`
	MerchantNetAmount float64    `json:"merchantNetAmount"`
	AcceptedAt        *time.Time `json:"acceptedAt"`
	DueAt             *time.Time `json:"dueAt"`
	PayoutOrderID     uint64     `json:"payoutOrderId"`
	PayoutStatus      string     `json:"payoutStatus"`
	Status            string     `json:"status"`
	FailureReason     string     `json:"failureReason"`
	RecoveryStatus    string     `json:"recoveryStatus"`
	RecoveryAmount    float64    `json:"recoveryAmount"`
	CreatedAt         time.Time  `json:"createdAt"`
	UpdatedAt         time.Time  `json:"updatedAt"`
}

func (s *SettlementService) ReleaseMilestone(input *ReleaseMilestoneInput) (*ReleaseMilestoneResult, error) {
	var result *ReleaseMilestoneResult
	err := repository.DB.Transaction(func(tx *gorm.DB) error {
		released, err := s.ReleaseMilestoneTx(tx, input)
		if err != nil {
			return err
		}
		result = released
		return nil
	})
	if err != nil {
		return nil, err
	}
	return result, nil
}

func (s *SettlementService) CreateMilestoneSettlementScheduleTx(tx *gorm.DB, input *ReleaseMilestoneInput) (*model.SettlementOrder, *model.MerchantIncome, *model.Project, *model.Milestone, error) {
	if tx == nil {
		return nil, nil, nil, nil, errors.New("事务不能为空")
	}
	project, milestone, escrow, providerID, err := s.validateMilestoneSettlementScopeTx(tx, input)
	if err != nil {
		return nil, nil, nil, nil, err
	}
	if escrow.Status == escrowStatusFrozen {
		return nil, nil, nil, nil, errors.New("项目资金当前已冻结，无法进入结算")
	}
	if escrow.Status == escrowStatusClosed {
		return nil, nil, nil, nil, errors.New("托管账户已关闭")
	}
	settlement, income, err := s.createOrUpdateSettlementOrderTx(tx, milestoneSettlementDraft(tx, project, milestone, providerID), project, input)
	if err != nil {
		return nil, nil, nil, nil, err
	}
	return settlement, income, project, milestone, nil
}

func (s *SettlementService) CreateDesignSettlementScheduleTx(tx *gorm.DB, deliverable *model.DesignDeliverable, order *model.Order) (*model.SettlementOrder, *model.MerchantIncome, error) {
	if tx == nil {
		return nil, nil, errors.New("事务不能为空")
	}
	if deliverable == nil || deliverable.ID == 0 || order == nil || order.ID == 0 {
		return nil, nil, errors.New("设计交付物或订单不存在")
	}
	var project model.Project
	if deliverable.ProjectID > 0 {
		if err := tx.First(&project, deliverable.ProjectID).Error; err != nil {
			return nil, nil, errors.New("项目不存在")
		}
	}
	acceptedAt := deliverable.AcceptedAt
	if acceptedAt == nil {
		now := time.Now()
		acceptedAt = &now
	}
	dueAt := acceptedAt.AddDate(0, 0, s.getPaymentReleaseDelayDaysTx(tx))
	platformFee, merchantNetAmount := calculateProjectedIncomeByTypeTx(tx, "design_fee", normalizeAmount(order.PaidAmount))
	grossAmount := normalizeAmount(order.PaidAmount)
	if grossAmount <= 0 {
		grossAmount = normalizeAmount(order.TotalAmount - order.Discount)
		platformFee, merchantNetAmount = calculateProjectedIncomeByTypeTx(tx, "design_fee", grossAmount)
	}
	settlement, created, err := s.createOrReuseSettlementOrderTx(tx, &model.SettlementOrder{
		BizType:           model.PayoutBizTypeDesignDeliverable,
		BizID:             deliverable.ID,
		ProjectID:         deliverable.ProjectID,
		ProviderID:        deliverable.ProviderID,
		FundScene:         model.FundSceneSettlementPayout,
		GrossAmount:       grossAmount,
		PlatformFee:       platformFee,
		MerchantNetAmount: merchantNetAmount,
		AcceptedAt:        acceptedAt,
		DueAt:             &dueAt,
		Status:            model.SettlementStatusScheduled,
		RecoveryStatus:    model.SettlementRecoveryStatusNone,
		MetadataJSON:      mustMarshalJSON(map[string]any{"orderId": order.ID, "bookingId": deliverable.BookingID}),
	})
	if err != nil {
		return nil, nil, err
	}
	income, err := s.ensureDesignSettlementIncomeProjectionTx(tx, settlement, deliverable, order)
	if err != nil {
		return nil, nil, err
	}
	if created {
		if err := (&LedgerService{}).RecordSettlementPendingTx(tx, deliverable.ProviderID, deliverable.ProjectID, settlement.GrossAmount, settlement.MerchantNetAmount, settlement.PlatformFee, settlement.BizType, settlement.BizID, "settlement_order", settlement.ID, "设计成果进入待结算"); err != nil {
			return nil, nil, err
		}
	}
	return settlement, income, nil
}

func (s *SettlementService) ReleaseMilestoneTx(tx *gorm.DB, input *ReleaseMilestoneInput) (*ReleaseMilestoneResult, error) {
	if tx == nil {
		return nil, errors.New("事务不能为空")
	}
	if input == nil || input.ProjectID == 0 || input.MilestoneID == 0 {
		return nil, errors.New("项目和节点不能为空")
	}
	if strings.TrimSpace(input.OperatorType) == "" {
		return nil, errors.New("操作主体不能为空")
	}

	settlement, income, project, milestone, err := s.CreateMilestoneSettlementScheduleTx(tx, input)
	if err != nil {
		return nil, err
	}
	if settlement == nil {
		return nil, errors.New("结算单创建失败")
	}
	payout, transaction, err := s.executeSettlementNowTx(tx, settlement)
	if err != nil {
		return nil, err
	}
	var escrow model.EscrowAccount
	if err := tx.Where("project_id = ?", project.ID).First(&escrow).Error; err != nil {
		return nil, err
	}
	if err := tx.First(&milestone, milestone.ID).Error; err != nil {
		return nil, err
	}
	if err := tx.First(&settlement, settlement.ID).Error; err != nil {
		return nil, err
	}
	if income != nil && income.ID > 0 {
		if err := tx.First(income, income.ID).Error; err != nil {
			return nil, err
		}
	}
	beforeState := settlementSnapshot(project, milestone, &escrow)
	afterState := settlementSnapshot(project, milestone, &escrow)
	afterState["settlementOrder"] = map[string]any{
		"id":         settlement.ID,
		"status":     settlement.Status,
		"payoutId":   settlement.PayoutOrderID,
		"gross":      settlement.GrossAmount,
		"net":        settlement.MerchantNetAmount,
		"acceptedAt": settlement.AcceptedAt,
		"dueAt":      settlement.DueAt,
	}
	if payout != nil {
		afterState["payout"] = map[string]any{
			"id":               payout.ID,
			"status":           payout.Status,
			"outPayoutNo":      payout.OutPayoutNo,
			"providerPayoutNo": payout.ProviderPayoutNo,
			"paidAt":           payout.PaidAt,
		}
	}
	if transaction != nil {
		afterState["transaction"] = map[string]any{
			"id":          transaction.ID,
			"type":        transaction.Type,
			"amount":      transaction.Amount,
			"milestoneId": transaction.MilestoneID,
			"completedAt": transaction.CompletedAt,
		}
	}
	if income != nil {
		afterState["merchantIncome"] = map[string]any{
			"id":                income.ID,
			"providerId":        income.ProviderID,
			"amount":            income.Amount,
			"netAmount":         income.NetAmount,
			"status":            income.Status,
			"settlementOrderId": income.SettlementOrderID,
		}
	}
	if err := (&AuditLogService{}).CreateBusinessRecordTx(tx, &CreateAuditRecordInput{
		OperatorType:  strings.TrimSpace(input.OperatorType),
		OperatorID:    settlementFromUserID(input.OperatorType, input.OperatorID),
		OperationType: "release_milestone_funds",
		ResourceType:  "project",
		ResourceID:    project.ID,
		Reason:        strings.TrimSpace(input.Reason),
		Result:        "success",
		BeforeState:   beforeState,
		AfterState:    afterState,
		Metadata: map[string]any{
			"projectId":         project.ID,
			"projectName":       project.Name,
			"milestoneId":       milestone.ID,
			"milestoneName":     milestone.Name,
			"escrowId":          escrow.ID,
			"transactionId":     firstTransactionID(transaction),
			"payoutOrderId":     settlement.PayoutOrderID,
			"merchantIncomeId":  firstIncomeID(income),
			"settlementOrderId": settlement.ID,
			"operatorType":      strings.TrimSpace(input.OperatorType),
			"source":            strings.TrimSpace(input.Source),
		},
	}); err != nil {
		return nil, err
	}
	return &ReleaseMilestoneResult{
		Project:         project,
		Escrow:          &escrow,
		Milestone:       milestone,
		Transaction:     transaction,
		MerchantIncome:  income,
		SettlementOrder: settlement,
	}, nil
}

func (s *SettlementService) ProcessDueSettlements(limit int) (int, error) {
	query := repository.DB.Where("due_at IS NOT NULL AND due_at <= ? AND status IN ?", time.Now(), []string{
		model.SettlementStatusScheduled,
		model.SettlementStatusPayoutFailed,
	}).Order("due_at ASC, id ASC")
	if limit > 0 {
		query = query.Limit(limit)
	}
	var items []model.SettlementOrder
	if err := query.Find(&items).Error; err != nil {
		return 0, err
	}
	count := 0
	for _, item := range items {
		if _, err := s.ExecuteSettlement(item.ID); err != nil {
			continue
		}
		count++
	}
	return count, nil
}

func (s *SettlementService) ExecuteSettlement(id uint64) (*model.SettlementOrder, error) {
	var result *model.SettlementOrder
	err := repository.DB.Transaction(func(tx *gorm.DB) error {
		updated, err := s.ExecuteSettlementTx(tx, id)
		if updated != nil {
			result = updated
		}
		return err
	})
	return result, err
}

func (s *SettlementService) ExecuteSettlementTx(tx *gorm.DB, id uint64) (*model.SettlementOrder, error) {
	if id == 0 {
		return nil, errors.New("结算单不存在")
	}
	var settlement model.SettlementOrder
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&settlement, id).Error; err != nil {
		return nil, errors.New("结算单不存在")
	}
	if settlement.Status == model.SettlementStatusPaid {
		return &settlement, nil
	}
	if settlement.Status == model.SettlementStatusRefunded || settlement.Status == model.SettlementStatusException {
		return nil, errors.New("当前结算单不可出款")
	}
	payoutSvc := NewPayoutService()
	payout, err := payoutSvc.CreateSettlementPayoutTx(tx, &settlement)
	if err != nil {
		return nil, err
	}
	updates := map[string]any{
		"status":          model.SettlementStatusPayoutProcessing,
		"payout_order_id": payout.ID,
		"failure_reason":  "",
	}
	if err := tx.Model(&settlement).Updates(updates).Error; err != nil {
		return nil, err
	}
	settlement.Status = model.SettlementStatusPayoutProcessing
	settlement.PayoutOrderID = payout.ID
	if err := tx.Model(&model.MerchantIncome{}).Where("settlement_order_id = ?", settlement.ID).Updates(map[string]any{
		"status":            1,
		"settlement_status": settlement.Status,
		"payout_order_id":   payout.ID,
		"payout_status":     payout.Status,
	}).Error; err != nil {
		return nil, err
	}
	if _, err := payoutSvc.ExecutePayoutTx(tx, payout.ID); err != nil {
		if errReload := tx.First(&settlement, settlement.ID).Error; errReload == nil {
			return &settlement, err
		}
		return nil, err
	}
	if err := tx.First(&settlement, settlement.ID).Error; err != nil {
		return nil, err
	}
	return &settlement, nil
}

func (s *SettlementService) RetrySettlement(id uint64) (*model.SettlementOrder, error) {
	return s.ExecuteSettlement(id)
}

func (s *SettlementService) ListSettlements(filter SettlementListFilter) ([]SettlementOrderView, int64, error) {
	page := filter.Page
	if page <= 0 {
		page = 1
	}
	pageSize := filter.PageSize
	if pageSize <= 0 {
		pageSize = 20
	}
	query := repository.DB.Table("settlement_orders AS so").
		Joins("LEFT JOIN providers AS p ON p.id = so.provider_id").
		Joins("LEFT JOIN projects AS pr ON pr.id = so.project_id").
		Joins("LEFT JOIN payout_orders AS po ON po.id = so.payout_order_id").
		Select(`so.id, so.biz_type, so.biz_id, so.project_id, COALESCE(pr.name, '') AS project_name,
			so.provider_id, COALESCE(NULLIF(p.company_name, ''), '服务商 #' || CAST(so.provider_id AS TEXT)) AS provider_name,
			so.fund_scene, so.gross_amount, so.platform_fee, so.merchant_net_amount,
			so.accepted_at, so.due_at, so.payout_order_id, COALESCE(po.status, '') AS payout_status,
			so.status, so.failure_reason, so.recovery_status, so.recovery_amount, so.created_at, so.updated_at`)
	if status := strings.TrimSpace(filter.Status); status != "" {
		query = query.Where("so.status = ?", status)
	}
	if filter.ProviderID > 0 {
		query = query.Where("so.provider_id = ?", filter.ProviderID)
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var list []SettlementOrderView
	if err := query.Order("COALESCE(so.due_at, so.created_at) DESC, so.id DESC").Offset((page - 1) * pageSize).Limit(pageSize).Scan(&list).Error; err != nil {
		return nil, 0, err
	}
	return list, total, nil
}

func (s *SettlementService) ListMerchantSettlements(providerID uint64, page, pageSize int) ([]SettlementOrderView, int64, error) {
	return s.ListSettlements(SettlementListFilter{ProviderID: providerID, Page: page, PageSize: pageSize})
}

func (s *SettlementService) createOrUpdateSettlementOrderTx(tx *gorm.DB, draft *model.SettlementOrder, project *model.Project, input *ReleaseMilestoneInput) (*model.SettlementOrder, *model.MerchantIncome, error) {
	settlement, created, err := s.createOrReuseSettlementOrderTx(tx, draft)
	if err != nil {
		return nil, nil, err
	}
	income, err := s.ensureConstructionSettlementIncomeProjectionTx(tx, settlement, project)
	if err != nil {
		return nil, nil, err
	}
	if created {
		if err := (&LedgerService{}).RecordSettlementPendingTx(tx, settlement.ProviderID, settlement.ProjectID, settlement.GrossAmount, settlement.MerchantNetAmount, settlement.PlatformFee, settlement.BizType, settlement.BizID, "settlement_order", settlement.ID, buildSettlementRemark(input)); err != nil {
			return nil, nil, err
		}
	}
	return settlement, income, nil
}

func (s *SettlementService) createOrReuseSettlementOrderTx(tx *gorm.DB, draft *model.SettlementOrder) (*model.SettlementOrder, bool, error) {
	if draft == nil {
		return nil, false, errors.New("结算单不能为空")
	}
	var existing model.SettlementOrder
	err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
		Where("biz_type = ? AND biz_id = ?", draft.BizType, draft.BizID).
		First(&existing).Error
	if err == nil {
		updates := map[string]any{}
		if draft.DueAt != nil && (existing.DueAt == nil || existing.DueAt.Before(*draft.DueAt)) {
			updates["due_at"] = draft.DueAt
			existing.DueAt = draft.DueAt
		}
		if existing.Status == "" {
			updates["status"] = model.SettlementStatusScheduled
			existing.Status = model.SettlementStatusScheduled
		}
		if len(updates) > 0 {
			if err := tx.Model(&existing).Updates(updates).Error; err != nil {
				return nil, false, err
			}
		}
		return &existing, false, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, false, err
	}
	if draft.Status == "" {
		draft.Status = model.SettlementStatusScheduled
	}
	if draft.RecoveryStatus == "" {
		draft.RecoveryStatus = model.SettlementRecoveryStatusNone
	}
	if err := tx.Create(draft).Error; err != nil {
		return nil, false, err
	}
	return draft, true, nil
}

func (s *SettlementService) ensureConstructionSettlementIncomeProjectionTx(tx *gorm.DB, settlement *model.SettlementOrder, project *model.Project) (*model.MerchantIncome, error) {
	var existing model.MerchantIncome
	if err := tx.Where("settlement_order_id = ?", settlement.ID).First(&existing).Error; err == nil {
		return &existing, nil
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	orderID, bookingID := loadSettlementOrderMetaTx(tx, settlement.ProjectID)
	income := &model.MerchantIncome{
		ProviderID:        settlement.ProviderID,
		OrderID:           orderID,
		BookingID:         bookingID,
		Type:              "construction",
		Amount:            settlement.GrossAmount,
		PlatformFee:       settlement.PlatformFee,
		NetAmount:         settlement.MerchantNetAmount,
		Status:            0,
		SettledAt:         settlement.AcceptedAt,
		SettlementOrderID: settlement.ID,
		SettlementStatus:  settlement.Status,
	}
	if err := tx.Create(income).Error; err != nil {
		return nil, err
	}
	return income, nil
}

func (s *SettlementService) ensureDesignSettlementIncomeProjectionTx(tx *gorm.DB, settlement *model.SettlementOrder, deliverable *model.DesignDeliverable, order *model.Order) (*model.MerchantIncome, error) {
	var existing model.MerchantIncome
	if err := tx.Where("settlement_order_id = ?", settlement.ID).First(&existing).Error; err == nil {
		return &existing, nil
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	income := &model.MerchantIncome{
		ProviderID:        settlement.ProviderID,
		OrderID:           order.ID,
		BookingID:         deliverable.BookingID,
		Type:              "design_fee",
		Amount:            settlement.GrossAmount,
		PlatformFee:       settlement.PlatformFee,
		NetAmount:         settlement.MerchantNetAmount,
		Status:            0,
		SettledAt:         settlement.AcceptedAt,
		SettlementOrderID: settlement.ID,
		SettlementStatus:  settlement.Status,
	}
	if err := tx.Create(income).Error; err != nil {
		return nil, err
	}
	return income, nil
}

func (s *SettlementService) executeSettlementNowTx(tx *gorm.DB, settlement *model.SettlementOrder) (*model.PayoutOrder, *model.Transaction, error) {
	if settlement == nil {
		return nil, nil, errors.New("结算单不存在")
	}
	updated, err := s.ExecuteSettlementTx(tx, settlement.ID)
	if err != nil {
		return nil, nil, err
	}
	var payout model.PayoutOrder
	if updated.PayoutOrderID > 0 {
		if err := tx.First(&payout, updated.PayoutOrderID).Error; err != nil {
			return nil, nil, err
		}
	}
	var transaction model.Transaction
	if payout.ID > 0 {
		if err := tx.Where("order_id = ?", fmt.Sprintf("PAYOUT-%d", payout.ID)).Order("id DESC").First(&transaction).Error; err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return &payout, nil, err
		}
	}
	if transaction.ID == 0 {
		return &payout, nil, nil
	}
	return &payout, &transaction, nil
}

func (s *SettlementService) validateMilestoneSettlementScopeTx(tx *gorm.DB, input *ReleaseMilestoneInput) (*model.Project, *model.Milestone, *model.EscrowAccount, uint64, error) {
	if input == nil || input.ProjectID == 0 || input.MilestoneID == 0 {
		return nil, nil, nil, 0, errors.New("项目和节点不能为空")
	}
	operatorType := strings.TrimSpace(input.OperatorType)
	if operatorType == "" {
		operatorType = "system"
	}
	var project model.Project
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&project, input.ProjectID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil, nil, 0, errors.New("项目不存在")
		}
		return nil, nil, nil, 0, err
	}
	if operatorType == "user" && project.OwnerID != input.OperatorID {
		return nil, nil, nil, 0, errors.New("无权释放此项目款项")
	}
	var milestone model.Milestone
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&milestone, input.MilestoneID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil, nil, 0, errors.New("验收节点不存在")
		}
		return nil, nil, nil, 0, err
	}
	if milestone.ProjectID != input.ProjectID {
		return nil, nil, nil, 0, errors.New("验收节点不属于当前项目")
	}
	if milestone.Status != model.MilestoneStatusAccepted {
		return nil, nil, nil, 0, errors.New("节点未通过验收，无法放款")
	}
	if milestone.PaidAt != nil || milestone.ReleasedAt != nil {
		return nil, nil, nil, 0, errors.New("当前节点已完成放款")
	}
	var escrow model.EscrowAccount
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("project_id = ?", input.ProjectID).First(&escrow).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil, nil, 0, errors.New("托管账户不存在")
		}
		return nil, nil, nil, 0, err
	}
	providerID := project.ConstructionProviderID
	if providerID == 0 {
		providerID = project.ProviderID
	}
	if providerID == 0 {
		return nil, nil, nil, 0, errors.New("项目未绑定施工服务方")
	}
	if milestone.Amount <= 0 {
		return nil, nil, nil, 0, errors.New("节点金额无效")
	}
	return &project, &milestone, &escrow, providerID, nil
}

func milestoneSettlementDraft(tx *gorm.DB, project *model.Project, milestone *model.Milestone, providerID uint64) *model.SettlementOrder {
	platformFee, merchantNetAmount := calculateConstructionSettlementTx(tx, milestone.Amount)
	acceptedAt := milestone.AcceptedAt
	if acceptedAt == nil {
		now := time.Now()
		acceptedAt = &now
	}
	dueAt := acceptedAt.AddDate(0, 0, (&SettlementService{}).getPaymentReleaseDelayDaysTx(tx))
	return &model.SettlementOrder{
		BizType:           model.PayoutBizTypeMilestoneRelease,
		BizID:             milestone.ID,
		ProjectID:         project.ID,
		ProviderID:        providerID,
		FundScene:         model.FundSceneSettlementPayout,
		GrossAmount:       normalizeAmount(milestone.Amount),
		PlatformFee:       platformFee,
		MerchantNetAmount: merchantNetAmount,
		AcceptedAt:        acceptedAt,
		DueAt:             &dueAt,
		Status:            model.SettlementStatusScheduled,
		RecoveryStatus:    model.SettlementRecoveryStatusNone,
		MetadataJSON:      mustMarshalJSON(map[string]any{"milestoneId": milestone.ID, "projectId": project.ID}),
	}
}

func (s *SettlementService) getPaymentReleaseDelayDaysTx(tx *gorm.DB) int {
	cfgSvc := &ConfigService{}
	if days, err := cfgSvc.GetConfigIntTx(tx, model.ConfigKeyPaymentReleaseDelayDays); err == nil && days > 0 {
		return days
	}
	if days, err := cfgSvc.GetConfigIntTx(tx, model.ConfigKeyConstructionReleaseDelay); err == nil && days > 0 {
		return days
	}
	return 3
}

func settlementFromUserID(operatorType string, operatorID uint64) uint64 {
	if strings.TrimSpace(operatorType) == "system" {
		return 0
	}
	return operatorID
}

func buildSettlementRemark(input *ReleaseMilestoneInput) string {
	if input == nil {
		return ""
	}
	parts := make([]string, 0, 2)
	if source := strings.TrimSpace(input.Source); source != "" {
		parts = append(parts, "source="+source)
	}
	if reason := strings.TrimSpace(input.Reason); reason != "" {
		parts = append(parts, reason)
	}
	return strings.Join(parts, " | ")
}

func calculateConstructionSettlementTx(tx *gorm.DB, amount float64) (float64, float64) {
	feeRate, err := (&ConfigService{}).GetConfigFloatTx(tx, model.ConfigKeyConstructionFeeRate)
	if err != nil || feeRate <= 0 {
		feeRate = 0.10
	}
	platformFee := normalizeAmount(amount * feeRate)
	netAmount := normalizeAmount(amount - platformFee)
	if netAmount < 0 {
		netAmount = 0
		platformFee = normalizeAmount(amount)
	}
	return platformFee, netAmount
}

func loadSettlementOrderMetaTx(tx *gorm.DB, projectID uint64) (uint64, uint64) {
	var order model.Order
	if err := tx.Where("project_id = ? AND order_type = ?", projectID, model.OrderTypeConstruction).
		Order("id DESC").First(&order).Error; err == nil {
		return order.ID, order.BookingID
	}
	if err := tx.Where("project_id = ?", projectID).Order("id DESC").First(&order).Error; err == nil {
		return order.ID, order.BookingID
	}
	return 0, 0
}

func settlementSnapshot(project *model.Project, milestone *model.Milestone, escrow *model.EscrowAccount) map[string]any {
	result := financeSnapshot(project, escrow)
	if milestone != nil {
		result["milestone"] = map[string]any{
			"id":          milestone.ID,
			"name":        milestone.Name,
			"projectId":   milestone.ProjectID,
			"status":      milestone.Status,
			"amount":      milestone.Amount,
			"acceptedAt":  milestone.AcceptedAt,
			"paidAt":      milestone.PaidAt,
			"releasedAt":  milestone.ReleasedAt,
			"scheduledAt": milestone.ReleaseScheduledAt,
		}
	}
	return result
}

func firstTransactionID(transaction *model.Transaction) uint64 {
	if transaction == nil {
		return 0
	}
	return transaction.ID
}

func firstIncomeID(income *model.MerchantIncome) uint64 {
	if income == nil {
		return 0
	}
	return income.ID
}
