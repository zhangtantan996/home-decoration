package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"time"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type PayoutService struct {
	gateway CustodyGateway
	ledger  *LedgerService
}

type PayoutListFilter struct {
	Status     string
	ProviderID uint64
	Page       int
	PageSize   int
}

type PayoutOrderView struct {
	ID               uint64     `json:"id"`
	BizType          string     `json:"bizType"`
	BizID            uint64     `json:"bizId"`
	ProviderID       uint64     `json:"providerId"`
	ProviderName     string     `json:"providerName"`
	Amount           float64    `json:"amount"`
	Channel          string     `json:"channel"`
	FundScene        string     `json:"fundScene"`
	OutPayoutNo      string     `json:"outPayoutNo"`
	ProviderPayoutNo string     `json:"providerPayoutNo"`
	Status           string     `json:"status"`
	FailureReason    string     `json:"failureReason"`
	ScheduledAt      *time.Time `json:"scheduledAt"`
	PaidAt           *time.Time `json:"paidAt"`
	RetryCount       int        `json:"retryCount"`
	CreatedAt        time.Time  `json:"createdAt"`
	UpdatedAt        time.Time  `json:"updatedAt"`
}

type PayoutOrderDetail struct {
	Payout         *PayoutOrderView      `json:"payout"`
	MerchantIncome *model.MerchantIncome `json:"merchantIncome,omitempty"`
}

func NewPayoutService() *PayoutService {
	return &PayoutService{
		gateway: NewCustodyGateway(),
		ledger:  &LedgerService{},
	}
}

func (s *PayoutService) CreateSettlementPayoutTx(tx *gorm.DB, settlement *model.SettlementOrder) (*model.PayoutOrder, error) {
	if tx == nil {
		tx = repository.DB
	}
	if settlement == nil || settlement.ID == 0 {
		return nil, errors.New("结算单不存在")
	}
	amount := normalizeAmount(settlement.MerchantNetAmount)
	if amount <= 0 {
		amount = normalizeAmount(settlement.GrossAmount)
	}
	if amount <= 0 {
		return nil, errors.New("结算单金额无效")
	}
	outPayoutNo, err := generateOutPayoutNo(settlement.FundScene)
	if err != nil {
		return nil, err
	}
	scheduledAt := time.Now()
	if settlement.DueAt != nil {
		scheduledAt = *settlement.DueAt
	}

	// 生成幂等性键（防止重复出款）
	idempotencyKey := generatePayoutIdempotencyKey(model.PayoutBizTypeSettlementOrder, settlement.ID, settlement.ProviderID)

	payout, _, err := s.createOrReusePayoutOrderTx(tx, &model.PayoutOrder{
		BizType:        model.PayoutBizTypeSettlementOrder,
		BizID:          settlement.ID,
		ProviderID:     settlement.ProviderID,
		Amount:         amount,
		Channel:        model.PayoutChannelCustody,
		FundScene:      settlement.FundScene,
		OutPayoutNo:    outPayoutNo,
		Status:         model.PayoutStatusCreated,
		ScheduledAt:    &scheduledAt,
		IdempotencyKey: idempotencyKey,
	})
	return payout, err
}

func (s *PayoutService) CreateMilestonePayoutScheduleTx(tx *gorm.DB, project *model.Project, milestone *model.Milestone, scheduledAt time.Time) (*model.PayoutOrder, *model.MerchantIncome, error) {
	if tx == nil {
		tx = repository.DB
	}
	if project == nil || project.ID == 0 || milestone == nil || milestone.ID == 0 {
		return nil, nil, errors.New("项目或节点不存在")
	}
	providerID := project.ConstructionProviderID
	if providerID == 0 {
		providerID = project.ProviderID
	}
	if providerID == 0 {
		return nil, nil, errors.New("项目未绑定施工服务方")
	}

	outPayoutNo, err := generateOutPayoutNo(model.FundSceneSettlementPayout)
	if err != nil {
		return nil, nil, err
	}
	payout, created, err := s.createOrReusePayoutOrderTx(tx, &model.PayoutOrder{
		BizType:     model.PayoutBizTypeMilestoneRelease,
		BizID:       milestone.ID,
		ProviderID:  providerID,
		Amount:      normalizeAmount(milestone.Amount),
		Channel:     model.PayoutChannelCustody,
		FundScene:   model.FundSceneSettlementPayout,
		OutPayoutNo: outPayoutNo,
		Status:      model.PayoutStatusCreated,
		ScheduledAt: &scheduledAt,
	})
	if err != nil {
		return nil, nil, err
	}
	income, err := s.ensureConstructionIncomeProjectionTx(tx, payout, project)
	if err != nil {
		return nil, nil, err
	}
	if created && income != nil {
		if err := s.ledger.RecordSettlementPendingTx(tx, providerID, project.ID, payout.Amount, income.NetAmount, income.PlatformFee, payout.BizType, payout.BizID, "payout_order", payout.ID, "施工节点进入待出款"); err != nil {
			return nil, nil, err
		}
	}
	return payout, income, nil
}

func (s *PayoutService) CreateDesignDeliverablePayoutScheduleTx(tx *gorm.DB, deliverable *model.DesignDeliverable, order *model.Order, scheduledAt time.Time) (*model.PayoutOrder, *model.MerchantIncome, error) {
	if tx == nil {
		tx = repository.DB
	}
	if deliverable == nil || deliverable.ID == 0 || order == nil || order.ID == 0 {
		return nil, nil, errors.New("设计交付或订单不存在")
	}
	amount := normalizeAmount(order.PaidAmount)
	if amount <= 0 {
		amount = normalizeAmount(order.TotalAmount - order.Discount)
	}
	outPayoutNo, err := generateOutPayoutNo(model.FundSceneSettlementPayout)
	if err != nil {
		return nil, nil, err
	}
	payout, created, err := s.createOrReusePayoutOrderTx(tx, &model.PayoutOrder{
		BizType:     model.PayoutBizTypeDesignDeliverable,
		BizID:       deliverable.ID,
		ProviderID:  deliverable.ProviderID,
		Amount:      amount,
		Channel:     model.PayoutChannelCustody,
		FundScene:   model.FundSceneSettlementPayout,
		OutPayoutNo: outPayoutNo,
		Status:      model.PayoutStatusCreated,
		ScheduledAt: &scheduledAt,
	})
	if err != nil {
		return nil, nil, err
	}
	income, err := s.ensureDesignIncomeProjectionTx(tx, payout, deliverable, order)
	if err != nil {
		return nil, nil, err
	}
	if created && income != nil {
		if err := s.ledger.RecordSettlementPendingTx(tx, deliverable.ProviderID, deliverable.ProjectID, payout.Amount, income.NetAmount, income.PlatformFee, payout.BizType, payout.BizID, "payout_order", payout.ID, "设计成果进入待出款"); err != nil {
			return nil, nil, err
		}
	}
	return payout, income, nil
}

func (s *PayoutService) createOrReusePayoutOrderTx(tx *gorm.DB, draft *model.PayoutOrder) (*model.PayoutOrder, bool, error) {
	if draft == nil {
		return nil, false, errors.New("出款单不能为空")
	}

	// 优先使用幂等性键查询（防止重复出款）
	if draft.IdempotencyKey != "" {
		var existing model.PayoutOrder
		err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("idempotency_key = ?", draft.IdempotencyKey).
			First(&existing).Error
		if err == nil {
			// 幂等性键已存在，返回已有记录
			return &existing, false, nil
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, false, err
		}
	}

	// 降级到业务键查询
	var existing model.PayoutOrder
	err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
		Where("biz_type = ? AND biz_id = ?", draft.BizType, draft.BizID).
		Order("id DESC").
		First(&existing).Error
	if err == nil {
		if draft.ScheduledAt != nil && (existing.ScheduledAt == nil || existing.ScheduledAt.Before(*draft.ScheduledAt)) {
			if err := tx.Model(&existing).Updates(map[string]any{
				"scheduled_at": draft.ScheduledAt,
				"amount":       draft.Amount,
			}).Error; err != nil {
				return nil, false, err
			}
			existing.ScheduledAt = draft.ScheduledAt
			existing.Amount = draft.Amount
		}
		return &existing, false, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, false, err
	}

	// 创建新记录（数据库唯一约束会防止并发重复）
	if err := tx.Create(draft).Error; err != nil {
		// 检查是否是幂等性键冲突
		if strings.Contains(err.Error(), "idempotency_key") || strings.Contains(err.Error(), "duplicate") {
			// 重新查询已存在的记录
			var retry model.PayoutOrder
			if retryErr := tx.Where("idempotency_key = ?", draft.IdempotencyKey).First(&retry).Error; retryErr == nil {
				return &retry, false, nil
			}
		}
		return nil, false, err
	}
	return draft, true, nil
}

func (s *PayoutService) ensureConstructionIncomeProjectionTx(tx *gorm.DB, payout *model.PayoutOrder, project *model.Project) (*model.MerchantIncome, error) {
	var existing model.MerchantIncome
	if err := tx.Where("payout_order_id = ?", payout.ID).First(&existing).Error; err == nil {
		return &existing, nil
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	orderID, bookingID := loadSettlementOrderMetaTx(tx, project.ID)
	platformFee, netAmount := calculateConstructionSettlementTx(tx, payout.Amount)
	income := &model.MerchantIncome{
		ProviderID:         payout.ProviderID,
		OrderID:            orderID,
		BookingID:          bookingID,
		Type:               "construction",
		Amount:             payout.Amount,
		PlatformFee:        platformFee,
		NetAmount:          netAmount,
		Status:             1,
		SettledAt:          payout.ScheduledAt,
		PayoutOrderID:      payout.ID,
		PayoutStatus:       payout.Status,
		PayoutFailedReason: payout.FailureReason,
	}
	if err := tx.Create(income).Error; err != nil {
		return nil, err
	}
	return income, nil
}

func (s *PayoutService) ensureDesignIncomeProjectionTx(tx *gorm.DB, payout *model.PayoutOrder, deliverable *model.DesignDeliverable, order *model.Order) (*model.MerchantIncome, error) {
	var existing model.MerchantIncome
	if err := tx.Where("payout_order_id = ?", payout.ID).First(&existing).Error; err == nil {
		return &existing, nil
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	platformFee, netAmount := calculateProjectedIncomeByTypeTx(tx, "design_fee", payout.Amount)
	income := &model.MerchantIncome{
		ProviderID:         deliverable.ProviderID,
		OrderID:            order.ID,
		BookingID:          deliverable.BookingID,
		Type:               "design_fee",
		Amount:             payout.Amount,
		PlatformFee:        platformFee,
		NetAmount:          netAmount,
		Status:             1,
		SettledAt:          payout.ScheduledAt,
		PayoutOrderID:      payout.ID,
		PayoutStatus:       payout.Status,
		PayoutFailedReason: payout.FailureReason,
	}
	if err := tx.Create(income).Error; err != nil {
		return nil, err
	}
	return income, nil
}

func (s *PayoutService) ProcessDuePayouts(limit int) (int, error) {
	if !(&ConfigService{}).GetPaymentPayoutAutoEnabled() {
		return 0, nil
	}
	query := repository.DB.Where("scheduled_at IS NOT NULL AND scheduled_at <= ? AND status IN ?", time.Now(), []string{
		model.PayoutStatusCreated,
		model.PayoutStatusFailed,
	}).Order("scheduled_at ASC, id ASC")
	if limit > 0 {
		query = query.Limit(limit)
	}
	var payouts []model.PayoutOrder
	if err := query.Find(&payouts).Error; err != nil {
		return 0, err
	}
	successCount := 0
	for _, payout := range payouts {
		if _, err := s.ExecutePayout(payout.ID); err != nil {
			continue
		}
		successCount++
	}
	return successCount, nil
}

func (s *PayoutService) ExecutePayout(payoutID uint64) (*model.PayoutOrder, error) {
	var result *model.PayoutOrder
	err := repository.DB.Transaction(func(tx *gorm.DB) error {
		updated, err := s.ExecutePayoutTx(tx, payoutID)
		if updated != nil {
			result = updated
		}
		return err
	})
	if err != nil {
		return result, err
	}
	return result, nil
}

func (s *PayoutService) ExecutePayoutTx(tx *gorm.DB, payoutID uint64) (*model.PayoutOrder, error) {
	if tx == nil {
		tx = repository.DB
	}
	var payout model.PayoutOrder
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&payout, payoutID).Error; err != nil {
		return nil, errors.New("出款单不存在")
	}
	if payout.Status == model.PayoutStatusPaid {
		return &payout, nil
	}
	now := time.Now()
	if payout.Status != model.PayoutStatusProcessing {
		if err := tx.Model(&payout).Updates(map[string]any{
			"status":        model.PayoutStatusProcessing,
			"processing_at": &now,
			"retry_count":   payout.RetryCount + 1,
		}).Error; err != nil {
			return nil, err
		}
		payout.Status = model.PayoutStatusProcessing
		payout.ProcessingAt = &now
		payout.RetryCount++
		if err := enqueuePayoutOutboxTx(tx, OutboxEventPayoutProcessing, &payout, ""); err != nil {
			return nil, err
		}
	}

	execResult, err := s.gateway.CreatePayout(context.Background(), &payout)
	if err != nil {
		if saveErr := s.markPayoutFailedTx(tx, &payout, err.Error(), "{}"); saveErr != nil {
			return nil, saveErr
		}
		return &payout, err
	}
	switch execResult.Status {
	case model.PayoutStatusPaid:
		if err := s.markPayoutPaidTx(tx, &payout, execResult); err != nil {
			return nil, err
		}
		if err := s.applyPayoutProjectionTx(tx, &payout); err != nil {
			return nil, err
		}
	case model.PayoutStatusFailed:
		if err := s.markPayoutFailedTx(tx, &payout, execResult.FailureReason, execResult.RawJSON); err != nil {
			return nil, err
		}
	default:
		if err := tx.Model(&payout).Updates(map[string]any{
			"provider_payout_no": execResult.ProviderPayoutNo,
			"raw_response_json":  execResult.RawJSON,
		}).Error; err != nil {
			return nil, err
		}
		payout.ProviderPayoutNo = execResult.ProviderPayoutNo
		payout.RawResponseJSON = execResult.RawJSON
	}
	return &payout, nil
}

func (s *PayoutService) RetryPayout(payoutID uint64) (*model.PayoutOrder, error) {
	return s.ExecutePayout(payoutID)
}

func (s *PayoutService) markPayoutPaidTx(tx *gorm.DB, payout *model.PayoutOrder, result *CustodyPayoutResult) error {
	now := time.Now()
	paidAt := result.PaidAt
	if paidAt == nil {
		paidAt = &now
	}
	if err := tx.Model(payout).Updates(map[string]any{
		"status":             model.PayoutStatusPaid,
		"provider_payout_no": result.ProviderPayoutNo,
		"paid_at":            paidAt,
		"failure_reason":     "",
		"raw_response_json":  result.RawJSON,
	}).Error; err != nil {
		return err
	}
	payout.Status = model.PayoutStatusPaid
	payout.ProviderPayoutNo = result.ProviderPayoutNo
	payout.PaidAt = paidAt
	payout.FailureReason = ""
	payout.RawResponseJSON = result.RawJSON
	return enqueuePayoutOutboxTx(tx, OutboxEventPayoutPaid, payout, "")
}

func (s *PayoutService) markPayoutFailedTx(tx *gorm.DB, payout *model.PayoutOrder, reason, rawJSON string) error {
	reason = strings.TrimSpace(reason)
	if err := tx.Model(payout).Updates(map[string]any{
		"status":            model.PayoutStatusFailed,
		"failure_reason":    reason,
		"raw_response_json": rawJSON,
	}).Error; err != nil {
		return err
	}
	payout.Status = model.PayoutStatusFailed
	payout.FailureReason = reason
	payout.RawResponseJSON = rawJSON
	if payout.ID > 0 {
		if err := tx.Model(&model.MerchantIncome{}).Where("payout_order_id = ?", payout.ID).Updates(map[string]any{
			"payout_status":        model.PayoutStatusFailed,
			"payout_failed_reason": reason,
		}).Error; err != nil {
			return err
		}
	}
	if payout.BizType == model.PayoutBizTypeSettlementOrder {
		if err := tx.Model(&model.SettlementOrder{}).Where("id = ?", payout.BizID).Updates(map[string]any{
			"status":         model.SettlementStatusPayoutFailed,
			"failure_reason": reason,
		}).Error; err != nil {
			return err
		}
		if err := tx.Model(&model.MerchantIncome{}).Where("settlement_order_id = ?", payout.BizID).Updates(map[string]any{
			"settlement_status":    model.SettlementStatusPayoutFailed,
			"payout_status":        model.PayoutStatusFailed,
			"payout_failed_reason": reason,
		}).Error; err != nil {
			return err
		}
	}
	return enqueuePayoutOutboxTx(tx, OutboxEventPayoutFailed, payout, reason)
}

func (s *PayoutService) applyPayoutProjectionTx(tx *gorm.DB, payout *model.PayoutOrder) error {
	switch payout.BizType {
	case model.PayoutBizTypeSettlementOrder:
		return s.applySettlementPayoutTx(tx, payout)
	case model.PayoutBizTypeMilestoneRelease:
		return s.applyMilestonePayoutTx(tx, payout)
	case model.PayoutBizTypeDesignDeliverable:
		return s.applyDesignDeliverablePayoutTx(tx, payout)
	default:
		return fmt.Errorf("不支持的出款类型: %s", payout.BizType)
	}
}

func (s *PayoutService) applySettlementPayoutTx(tx *gorm.DB, payout *model.PayoutOrder) error {
	var settlement model.SettlementOrder
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&settlement, payout.BizID).Error; err != nil {
		return errors.New("结算单不存在")
	}
	if settlement.Status == model.SettlementStatusPaid {
		return nil
	}

	var income model.MerchantIncome
	if err := tx.Where("settlement_order_id = ?", settlement.ID).First(&income).Error; err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}

	if settlement.ProjectID > 0 && settlement.GrossAmount > 0 {
		var escrow model.EscrowAccount
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("project_id = ?", settlement.ProjectID).First(&escrow).Error; err != nil {
			return errors.New("托管账户不存在")
		}
		if escrow.AvailableAmount < settlement.GrossAmount {
			return errors.New("托管账户余额不足")
		}
		escrow.AvailableAmount = normalizeAmount(escrow.AvailableAmount - settlement.GrossAmount)
		escrow.ReleasedAmount = normalizeAmount(escrow.ReleasedAmount + settlement.GrossAmount)
		escrow.Status = reconcileEscrowStatus(&escrow)
		if err := tx.Save(&escrow).Error; err != nil {
			return err
		}
		transaction := &model.Transaction{
			OrderID:     fmt.Sprintf("PAYOUT-%d", payout.ID),
			EscrowID:    escrow.ID,
			Type:        "release",
			Amount:      payout.Amount,
			FromUserID:  0,
			ToUserID:    getProviderUserIDTx(tx, settlement.ProviderID),
			Status:      1,
			Remark:      resolveSettlementPayoutRemark(settlement.BizType),
			CompletedAt: payout.PaidAt,
		}
		if settlement.BizType == model.PayoutBizTypeMilestoneRelease {
			transaction.MilestoneID = settlement.BizID
		}
		if err := tx.Where("order_id = ?", transaction.OrderID).FirstOrCreate(transaction).Error; err != nil {
			return err
		}
	}

	if settlement.BizType == model.PayoutBizTypeMilestoneRelease {
		if err := tx.Model(&model.Milestone{}).Where("id = ?", settlement.BizID).Updates(map[string]any{
			"status":      model.MilestoneStatusPaid,
			"paid_at":     gorm.Expr("COALESCE(paid_at, ?)", payout.PaidAt),
			"released_at": payout.PaidAt,
		}).Error; err != nil {
			return err
		}
	}

	if income.ID > 0 {
		if err := tx.Model(&income).Updates(map[string]any{
			"status":               2,
			"settlement_status":    model.SettlementStatusPaid,
			"payout_order_id":      payout.ID,
			"payout_status":        model.PayoutStatusPaid,
			"payout_failed_reason": "",
			"payouted_at":          payout.PaidAt,
		}).Error; err != nil {
			return err
		}
	}

	if err := tx.Model(&settlement).Updates(map[string]any{
		"status":          model.SettlementStatusPaid,
		"payout_order_id": payout.ID,
		"failure_reason":  "",
	}).Error; err != nil {
		return err
	}

	return s.ledger.RecordSettlementPayoutTx(tx, settlement.ProviderID, settlement.ProjectID, settlement.GrossAmount, settlement.MerchantNetAmount, settlement.BizType, settlement.BizID, "payout_order", payout.ID, "结算单出款成功")
}

func (s *PayoutService) applyMilestonePayoutTx(tx *gorm.DB, payout *model.PayoutOrder) error {
	var milestone model.Milestone
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&milestone, payout.BizID).Error; err != nil {
		return errors.New("验收节点不存在")
	}
	var project model.Project
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&project, milestone.ProjectID).Error; err != nil {
		return errors.New("项目不存在")
	}
	if milestone.ReleasedAt != nil {
		return nil
	}
	var escrow model.EscrowAccount
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("project_id = ?", project.ID).First(&escrow).Error; err != nil {
		return errors.New("托管账户不存在")
	}
	if escrow.AvailableAmount < payout.Amount {
		return errors.New("托管账户余额不足")
	}
	providerUserID := getProviderUserIDTx(tx, payout.ProviderID)
	if providerUserID == 0 {
		providerUserID = payout.ProviderID
	}
	now := time.Now()
	escrow.AvailableAmount = normalizeAmount(escrow.AvailableAmount - payout.Amount)
	escrow.ReleasedAmount = normalizeAmount(escrow.ReleasedAmount + payout.Amount)
	escrow.Status = reconcileEscrowStatus(&escrow)
	if err := tx.Save(&escrow).Error; err != nil {
		return err
	}
	transaction := &model.Transaction{
		OrderID:     fmt.Sprintf("PAYOUT-%d", payout.ID),
		EscrowID:    escrow.ID,
		MilestoneID: milestone.ID,
		Type:        "release",
		Amount:      payout.Amount,
		FromUserID:  0,
		ToUserID:    providerUserID,
		Status:      1,
		Remark:      "自动出款",
		CompletedAt: &now,
	}
	if err := tx.Where("order_id = ?", transaction.OrderID).FirstOrCreate(transaction).Error; err != nil {
		return err
	}
	var income model.MerchantIncome
	if err := tx.Where("payout_order_id = ?", payout.ID).First(&income).Error; err != nil {
		return err
	}
	if err := tx.Model(&income).Updates(map[string]any{
		"status":               2,
		"payout_status":        model.PayoutStatusPaid,
		"payout_failed_reason": "",
		"payouted_at":          payout.PaidAt,
	}).Error; err != nil {
		return err
	}
	if err := tx.Model(&milestone).Updates(map[string]any{
		"status":      model.MilestoneStatusPaid,
		"paid_at":     gorm.Expr("COALESCE(paid_at, ?)", payout.PaidAt),
		"released_at": payout.PaidAt,
	}).Error; err != nil {
		return err
	}
	return s.ledger.RecordSettlementPayoutTx(tx, payout.ProviderID, project.ID, payout.Amount, income.NetAmount, payout.BizType, payout.BizID, "payout_order", payout.ID, "施工节点出款成功")
}

func (s *PayoutService) applyDesignDeliverablePayoutTx(tx *gorm.DB, payout *model.PayoutOrder) error {
	var deliverable model.DesignDeliverable
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&deliverable, payout.BizID).Error; err != nil {
		return errors.New("设计交付物不存在")
	}
	var income model.MerchantIncome
	if err := tx.Where("payout_order_id = ?", payout.ID).First(&income).Error; err != nil {
		return err
	}
	projectID := deliverable.ProjectID
	if projectID > 0 {
		var escrow model.EscrowAccount
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("project_id = ?", projectID).First(&escrow).Error; err == nil {
			if escrow.AvailableAmount < payout.Amount {
				return errors.New("托管账户余额不足")
			}
			escrow.AvailableAmount = normalizeAmount(escrow.AvailableAmount - payout.Amount)
			escrow.ReleasedAmount = normalizeAmount(escrow.ReleasedAmount + payout.Amount)
			escrow.Status = reconcileEscrowStatus(&escrow)
			if err := tx.Save(&escrow).Error; err != nil {
				return err
			}
			transaction := &model.Transaction{
				OrderID:     fmt.Sprintf("PAYOUT-%d", payout.ID),
				EscrowID:    escrow.ID,
				Type:        "release",
				Amount:      payout.Amount,
				FromUserID:  0,
				ToUserID:    getProviderUserIDTx(tx, payout.ProviderID),
				Status:      1,
				Remark:      "设计费自动出款",
				CompletedAt: payout.PaidAt,
			}
			if err := tx.Where("order_id = ?", transaction.OrderID).FirstOrCreate(transaction).Error; err != nil {
				return err
			}
		}
	}
	if err := tx.Model(&income).Updates(map[string]any{
		"status":               2,
		"payout_status":        model.PayoutStatusPaid,
		"payout_failed_reason": "",
		"payouted_at":          payout.PaidAt,
	}).Error; err != nil {
		return err
	}
	return s.ledger.RecordSettlementPayoutTx(tx, payout.ProviderID, projectID, payout.Amount, income.NetAmount, payout.BizType, payout.BizID, "payout_order", payout.ID, "设计成果出款成功")
}

func (s *PayoutService) ListPayouts(filter PayoutListFilter) ([]PayoutOrderView, int64, error) {
	page := filter.Page
	if page <= 0 {
		page = 1
	}
	pageSize := filter.PageSize
	if pageSize <= 0 {
		pageSize = 20
	}
	query := repository.DB.Table("payout_orders AS po").
		Joins("LEFT JOIN providers AS p ON p.id = po.provider_id").
		Select(`po.id, po.biz_type, po.biz_id, po.provider_id, COALESCE(NULLIF(p.company_name, ''), '服务商 #' || CAST(po.provider_id AS TEXT)) AS provider_name,
			po.amount, po.channel, po.fund_scene, po.out_payout_no, po.provider_payout_no, po.status,
			po.failure_reason, po.scheduled_at, po.paid_at, po.retry_count, po.created_at, po.updated_at`)
	if strings.TrimSpace(filter.Status) != "" {
		query = query.Where("po.status = ?", strings.TrimSpace(filter.Status))
	}
	if filter.ProviderID > 0 {
		query = query.Where("po.provider_id = ?", filter.ProviderID)
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var list []PayoutOrderView
	if err := query.Order("po.created_at DESC").Offset((page - 1) * pageSize).Limit(pageSize).Scan(&list).Error; err != nil {
		return nil, 0, err
	}
	return list, total, nil
}

func (s *PayoutService) GetPayoutDetail(id uint64) (*PayoutOrderDetail, error) {
	if id == 0 {
		return nil, errors.New("出款单不存在")
	}
	var list []PayoutOrderView
	if err := repository.DB.Table("payout_orders AS po").
		Joins("LEFT JOIN providers AS p ON p.id = po.provider_id").
		Select(`po.id, po.biz_type, po.biz_id, po.provider_id, COALESCE(NULLIF(p.company_name, ''), '服务商 #' || CAST(po.provider_id AS TEXT)) AS provider_name,
			po.amount, po.channel, po.fund_scene, po.out_payout_no, po.provider_payout_no, po.status,
			po.failure_reason, po.scheduled_at, po.paid_at, po.retry_count, po.created_at, po.updated_at`).
		Where("po.id = ?", id).
		Scan(&list).Error; err != nil {
		return nil, err
	}
	if len(list) == 0 {
		return nil, errors.New("出款单不存在")
	}
	var income model.MerchantIncome
	if err := repository.DB.Where("payout_order_id = ?", id).First(&income).Error; err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	detail := &PayoutOrderDetail{Payout: &list[0]}
	if income.ID > 0 {
		detail.MerchantIncome = &income
	}
	return detail, nil
}

func (s *PayoutService) ListMerchantSettlements(providerID uint64, page, pageSize int) ([]map[string]any, int64, error) {
	if providerID == 0 {
		return nil, 0, errors.New("服务商不存在")
	}
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 20
	}
	query := repository.DB.Table("settlement_orders AS so").
		Joins("LEFT JOIN merchant_incomes AS mi ON mi.settlement_order_id = so.id").
		Joins("LEFT JOIN payout_orders AS po ON po.id = so.payout_order_id").
		Where("so.provider_id = ?", providerID).
		Select(`so.id AS id,
			mi.order_id AS orderId,
			mi.booking_id AS bookingId,
			mi.type AS type,
			so.gross_amount AS amount,
			so.platform_fee AS platformFee,
			so.merchant_net_amount AS netAmount,
			COALESCE(mi.status, 0) AS status,
			so.status AS settlementStatus,
			COALESCE(mi.settled_at, so.accepted_at) AS settledAt,
			so.payout_order_id AS payoutOrderId,
			COALESCE(mi.payout_status, '') AS payoutStatus,
			COALESCE(mi.payout_failed_reason, so.failure_reason, '') AS payoutFailedReason,
			mi.payouted_at AS payoutedAt,
			po.out_payout_no AS outPayoutNo,
			po.provider_payout_no AS providerPayoutNo,
			po.status AS payoutRuntimeStatus,
			so.due_at AS scheduledAt,
			po.paid_at AS paidAt,
			COALESCE(po.failure_reason, so.failure_reason, '') AS failureReason`)
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	rows := make([]map[string]any, 0, pageSize)
	if err := query.Order("mi.created_at DESC").Offset((page - 1) * pageSize).Limit(pageSize).Find(&rows).Error; err != nil {
		return nil, 0, err
	}
	return rows, total, nil
}

func resolveSettlementPayoutRemark(bizType string) string {
	switch bizType {
	case model.PayoutBizTypeMilestoneRelease:
		return "施工节点自动出款"
	case model.PayoutBizTypeDesignDeliverable:
		return "设计成果自动出款"
	default:
		return "结算单自动出款"
	}
}

func calculateProjectedIncomeByTypeTx(tx *gorm.DB, incomeType string, amount float64) (float64, float64) {
	cfgSvc := &ConfigService{}
	rate := 0.0
	switch incomeType {
	case "design_fee":
		rate, _ = cfgSvc.GetConfigFloatTx(tx, model.ConfigKeyDesignFeeRate)
		if rate <= 0 {
			rate = 0.10
		}
	case "construction":
		rate, _ = cfgSvc.GetConfigFloatTx(tx, model.ConfigKeyConstructionFeeRate)
		if rate <= 0 {
			rate = 0.10
		}
	case "material":
		rate, _ = cfgSvc.GetConfigFloatTx(tx, model.ConfigKeyMaterialFeeRate)
		if rate <= 0 {
			rate = 0.05
		}
	}
	platformFee := normalizeAmount(amount * rate)
	netAmount := normalizeAmount(amount - platformFee)
	if netAmount < 0 {
		netAmount = 0
		platformFee = normalizeAmount(amount)
	}
	return platformFee, netAmount
}

// generatePayoutIdempotencyKey 生成出款幂等性键（防止重复出款）
// 格式: SHA256(bizType:bizID:providerID)
func generatePayoutIdempotencyKey(bizType string, bizID, providerID uint64) string {
	data := fmt.Sprintf("%s:%d:%d", bizType, bizID, providerID)
	hash := sha256.Sum256([]byte(data))
	return hex.EncodeToString(hash[:])
}
