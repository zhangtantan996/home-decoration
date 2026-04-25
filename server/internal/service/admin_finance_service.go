package service

import (
	"bytes"
	"encoding/csv"
	"errors"
	"fmt"
	"math"
	"strings"
	"time"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	"home-decoration-server/pkg/timeutil"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type FinanceOverviewResponse struct {
	TotalBalance   float64            `json:"totalBalance"`
	PendingRelease float64            `json:"pendingRelease"`
	FrozenAmount   float64            `json:"frozenAmount"`
	ReleasedToday  float64            `json:"releasedToday"`
	Statistics     map[string]float64 `json:"statistics"`
}

type AdminFinanceTransactionFilter struct {
	Type      string
	ProjectID uint64
	StartDate string
	EndDate   string
	Page      int
	PageSize  int
}

type AdminFinanceTransactionItem struct {
	ID           uint64     `json:"id"`
	OrderID      string     `json:"orderId"`
	EscrowID     uint64     `json:"escrowId"`
	MilestoneID  uint64     `json:"milestoneId"`
	ProjectID    uint64     `json:"projectId"`
	ProjectName  string     `json:"projectName"`
	Type         string     `json:"type"`
	Amount       float64    `json:"amount"`
	FromUserID   uint64     `json:"fromUserId"`
	FromAccount  string     `json:"fromAccount"`
	ToUserID     uint64     `json:"toUserId"`
	ToAccount    string     `json:"toAccount"`
	Status       int8       `json:"status"`
	Remark       string     `json:"remark"`
	EscrowStatus int8       `json:"escrowStatus"`
	CreatedAt    time.Time  `json:"createdAt"`
	CompletedAt  *time.Time `json:"completedAt"`
}

type AdminPaymentOrderFilter struct {
	Channel      string
	Status       string
	BizType      string
	FundScene    string
	RefundStatus string
	OutTradeNo   string
	StartDate    string
	EndDate      string
	Page         int
	PageSize     int
}

type AdminPaymentOrderItem struct {
	ID                   uint64     `json:"id"`
	BizType              string     `json:"bizType"`
	BizID                uint64     `json:"bizId"`
	PayerUserID          uint64     `json:"payerUserId"`
	Channel              string     `json:"channel"`
	FundScene            string     `json:"fundScene"`
	TerminalType         string     `json:"terminalType"`
	Subject              string     `json:"subject"`
	Amount               float64    `json:"amount"`
	AmountCent           int64      `json:"amountCent"`
	RefundedAmount       float64    `json:"refundedAmount"`
	RefundedAmountCent   int64      `json:"refundedAmountCent"`
	RefundStatus         string     `json:"refundStatus"`
	OutTradeNo           string     `json:"outTradeNo"`
	ProviderTradeNo      string     `json:"providerTradeNo"`
	Status               string     `json:"status"`
	ExpiredAt            *time.Time `json:"expiredAt"`
	PaidAt               *time.Time `json:"paidAt"`
	CreatedAt            time.Time  `json:"createdAt"`
	UpdatedAt            time.Time  `json:"updatedAt"`
	LaunchTokenSet       bool       `json:"launchTokenSet"`
	RefundOrderCount     int64      `json:"refundOrderCount"`
	RefundSucceededCount int64      `json:"refundSucceededCount"`
}

type AdminRefundOrderItem struct {
	ID                  uint64     `json:"id"`
	PaymentOrderID      uint64     `json:"paymentOrderId"`
	BizType             string     `json:"bizType"`
	BizID               uint64     `json:"bizId"`
	FundScene           string     `json:"fundScene"`
	RefundApplicationID uint64     `json:"refundApplicationId"`
	OutRefundNo         string     `json:"outRefundNo"`
	Amount              float64    `json:"amount"`
	AmountCent          int64      `json:"amountCent"`
	Reason              string     `json:"reason"`
	Status              string     `json:"status"`
	FailureReason       string     `json:"failureReason"`
	SucceededAt         *time.Time `json:"succeededAt"`
	CreatedAt           time.Time  `json:"createdAt"`
	UpdatedAt           time.Time  `json:"updatedAt"`
}

type AdminPaymentOrderDetail struct {
	Payment AdminPaymentOrderItem  `json:"payment"`
	Refunds []AdminRefundOrderItem `json:"refunds"`
}

type FreezeFundsInput struct {
	ProjectID uint64  `json:"projectId"`
	Amount    float64 `json:"amount"`
	Reason    string  `json:"reason"`
}

type UnfreezeFundsInput struct {
	ProjectID uint64  `json:"projectId"`
	Amount    float64 `json:"amount"`
	Reason    string  `json:"reason"`
}

type ManualReleaseInput struct {
	ProjectID   uint64  `json:"projectId"`
	MilestoneID uint64  `json:"milestoneId"`
	Amount      float64 `json:"amount"`
	Reason      string  `json:"reason"`
}

type AdminFinanceService struct {
	auditService      *AuditLogService
	settlementService *SettlementService
}

func NewAdminFinanceService() *AdminFinanceService {
	return &AdminFinanceService{
		auditService:      &AuditLogService{},
		settlementService: &SettlementService{},
	}
}

func (s *AdminFinanceService) GetOverview() (*FinanceOverviewResponse, error) {
	type escrowSummaryRow struct {
		TotalBalance   float64
		PendingRelease float64
		FrozenAmount   float64
	}
	var summary escrowSummaryRow
	if err := repository.DB.Model(&model.EscrowAccount{}).
		Select(`
			COALESCE(SUM(total_amount), 0) AS total_balance,
			COALESCE(SUM(available_amount), 0) AS pending_release,
			COALESCE(SUM(frozen_amount), 0) AS frozen_amount
		`).
		Scan(&summary).Error; err != nil {
		return nil, err
	}

	var releasedToday float64
	startOfDay := timeutil.StartOfDay(timeutil.Now())
	if err := repository.DB.Model(&model.Transaction{}).
		Where("type = ? AND created_at >= ?", "release", startOfDay).
		Select("COALESCE(SUM(amount), 0)").
		Scan(&releasedToday).Error; err != nil {
		return nil, err
	}

	statistics := map[string]float64{
		"intentFee":       0,
		"designFee":       0,
		"constructionFee": 0,
	}

	var intentFee float64
	if err := repository.DB.Model(&model.Booking{}).
		Where("intent_fee_paid = ?", true).
		Select("COALESCE(SUM(intent_fee), 0)").
		Scan(&intentFee).Error; err != nil {
		return nil, err
	}
	statistics["intentFee"] = intentFee
	var designFee float64
	if err := repository.DB.Model(&model.Order{}).
		Where("status = ? AND order_type = ?", model.OrderStatusPaid, model.OrderTypeDesign).
		Select("COALESCE(SUM(total_amount), 0)").
		Scan(&designFee).Error; err != nil {
		return nil, err
	}
	statistics["designFee"] = designFee
	var constructionFee float64
	if err := repository.DB.Model(&model.Order{}).
		Where("status = ? AND order_type = ?", model.OrderStatusPaid, model.OrderTypeConstruction).
		Select("COALESCE(SUM(total_amount), 0)").
		Scan(&constructionFee).Error; err != nil {
		return nil, err
	}
	statistics["constructionFee"] = constructionFee

	return &FinanceOverviewResponse{
		TotalBalance:   summary.TotalBalance,
		PendingRelease: summary.PendingRelease,
		FrozenAmount:   summary.FrozenAmount,
		ReleasedToday:  releasedToday,
		Statistics:     statistics,
	}, nil
}

func (s *AdminFinanceService) ListTransactions(filter AdminFinanceTransactionFilter) ([]AdminFinanceTransactionItem, int64, error) {
	page := filter.Page
	if page <= 0 {
		page = 1
	}
	pageSize := filter.PageSize
	if pageSize <= 0 {
		pageSize = 20
	}

	baseQuery := repository.DB.Table("transactions AS t").
		Joins("LEFT JOIN escrow_accounts AS ea ON ea.id = t.escrow_id").
		Select(`
			t.id, t.order_id, t.escrow_id, t.milestone_id, t.type, t.amount, t.from_user_id, t.from_account,
			t.to_user_id, t.to_account, t.status, t.remark, t.created_at, t.completed_at,
			COALESCE(ea.project_id, 0) AS project_id, COALESCE(ea.project_name, '') AS project_name,
			COALESCE(ea.status, 0) AS escrow_status
		`)

	baseQuery = applyFinanceTransactionFilters(baseQuery, filter)

	var total int64
	if err := baseQuery.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var items []AdminFinanceTransactionItem
	if err := baseQuery.Order("t.created_at DESC").Offset((page - 1) * pageSize).Limit(pageSize).Scan(&items).Error; err != nil {
		return nil, 0, err
	}

	return items, total, nil
}

func (s *AdminFinanceService) ListPaymentOrders(filter AdminPaymentOrderFilter) ([]AdminPaymentOrderItem, int64, error) {
	page := filter.Page
	if page <= 0 {
		page = 1
	}
	pageSize := filter.PageSize
	if pageSize <= 0 {
		pageSize = 20
	}
	if pageSize > 100 {
		pageSize = 100
	}

	query := repository.DB.Model(&model.PaymentOrder{})
	query = applyPaymentOrderFilters(query, filter)

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var payments []model.PaymentOrder
	if err := query.Order("created_at DESC, id DESC").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Find(&payments).Error; err != nil {
		return nil, 0, err
	}

	refundStats, err := loadPaymentRefundStats(payments)
	if err != nil {
		return nil, 0, err
	}
	items := make([]AdminPaymentOrderItem, 0, len(payments))
	for _, payment := range payments {
		item := serializeAdminPaymentOrder(payment)
		if stat, ok := refundStats[payment.ID]; ok {
			item.RefundOrderCount = stat.TotalCount
			item.RefundSucceededCount = stat.SucceededCount
		}
		items = append(items, item)
	}
	return items, total, nil
}

func (s *AdminFinanceService) GetPaymentOrderDetail(paymentOrderID uint64) (*AdminPaymentOrderDetail, error) {
	if paymentOrderID == 0 {
		return nil, errors.New("支付单不存在")
	}
	var payment model.PaymentOrder
	if err := repository.DB.First(&payment, paymentOrderID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("支付单不存在")
		}
		return nil, err
	}
	var refunds []model.RefundOrder
	if err := repository.DB.Where("payment_order_id = ?", payment.ID).Order("created_at DESC, id DESC").Find(&refunds).Error; err != nil {
		return nil, err
	}
	item := serializeAdminPaymentOrder(payment)
	item.RefundOrderCount = int64(len(refunds))
	for _, refund := range refunds {
		if refund.Status == model.RefundOrderStatusSucceeded {
			item.RefundSucceededCount++
		}
	}
	refundItems := make([]AdminRefundOrderItem, 0, len(refunds))
	for _, refund := range refunds {
		refundItems = append(refundItems, serializeAdminRefundOrder(refund))
	}
	return &AdminPaymentOrderDetail{
		Payment: item,
		Refunds: refundItems,
	}, nil
}

func (s *AdminFinanceService) ExportTransactions(filter AdminFinanceTransactionFilter) ([]byte, error) {
	filter.Page = 1
	filter.PageSize = 5000
	items, _, err := s.ListTransactions(filter)
	if err != nil {
		return nil, err
	}

	var buffer bytes.Buffer
	writer := csv.NewWriter(&buffer)
	if err := writer.Write([]string{
		"id", "order_id", "project_id", "project_name", "type", "amount", "status", "remark", "created_at",
	}); err != nil {
		return nil, err
	}
	for _, item := range items {
		if err := writer.Write([]string{
			fmt.Sprintf("%d", item.ID),
			item.OrderID,
			fmt.Sprintf("%d", item.ProjectID),
			item.ProjectName,
			item.Type,
			fmt.Sprintf("%.2f", item.Amount),
			fmt.Sprintf("%d", item.Status),
			item.Remark,
			item.CreatedAt.Format(time.RFC3339),
		}); err != nil {
			return nil, err
		}
	}
	writer.Flush()
	if err := writer.Error(); err != nil {
		return nil, err
	}
	return buffer.Bytes(), nil
}

func (s *AdminFinanceService) FreezeFunds(adminID uint64, input *FreezeFundsInput) (*model.EscrowAccount, error) {
	if input == nil || input.ProjectID == 0 {
		return nil, errors.New("无效项目ID")
	}
	if input.Amount <= 0 {
		return nil, errors.New("冻结金额必须大于0")
	}
	if strings.TrimSpace(input.Reason) == "" {
		return nil, errors.New("请填写冻结原因")
	}

	var updated *model.EscrowAccount
	err := repository.DB.Transaction(func(tx *gorm.DB) error {
		project, escrow, err := loadProjectAndEscrowForFinanceTx(tx, input.ProjectID)
		if err != nil {
			return err
		}
		if escrow.Status == escrowStatusClosed {
			return errors.New("托管账户已关闭")
		}
		if input.Amount > escrow.AvailableAmount {
			return errors.New("冻结金额超过可用余额")
		}

		before := financeSnapshot(project, escrow)
		if _, err := freezeEscrowBalanceTx(tx, input.ProjectID, input.Amount); err != nil {
			return err
		}
		if err := tx.First(escrow, escrow.ID).Error; err != nil {
			return err
		}

		now := time.Now()
		trx := &model.Transaction{
			OrderID:     fmt.Sprintf("FRZ-%d-%d", input.ProjectID, now.UnixNano()),
			EscrowID:    escrow.ID,
			Type:        "freeze",
			Amount:      input.Amount,
			FromUserID:  adminID,
			FromAccount: "admin",
			ToUserID:    project.OwnerID,
			ToAccount:   "escrow",
			Status:      1,
			Remark:      strings.TrimSpace(input.Reason),
			CompletedAt: &now,
		}
		if err := tx.Create(trx).Error; err != nil {
			return err
		}

		after := financeSnapshot(project, escrow)
		if err := s.auditService.CreateBusinessRecordTx(tx, &CreateAuditRecordInput{
			OperatorType:  "admin",
			OperatorID:    adminID,
			OperationType: "freeze_funds",
			ResourceType:  "project",
			ResourceID:    project.ID,
			Reason:        strings.TrimSpace(input.Reason),
			Result:        "success",
			BeforeState:   before,
			AfterState:    after,
			Metadata: map[string]interface{}{
				"amount":      input.Amount,
				"escrowId":    escrow.ID,
				"projectId":   project.ID,
				"projectName": project.Name,
			},
		}); err != nil {
			return err
		}

		updated = escrow
		return notifyFinanceParticipantsTx(tx, project, "project.finance.frozen", "项目资金已冻结", fmt.Sprintf("项目 #%d 资金已被冻结，涉及金额 %.2f 元。原因：%s", project.ID, input.Amount, strings.TrimSpace(input.Reason)), buildProjectDisputeActionURL(project.ID))
	})
	if err != nil {
		return nil, err
	}

	return updated, nil
}

func (s *AdminFinanceService) UnfreezeFunds(adminID uint64, input *UnfreezeFundsInput) (*model.EscrowAccount, error) {
	if input == nil || input.ProjectID == 0 {
		return nil, errors.New("无效项目ID")
	}
	if input.Amount <= 0 {
		return nil, errors.New("解冻金额必须大于0")
	}
	if strings.TrimSpace(input.Reason) == "" {
		return nil, errors.New("请填写解冻原因")
	}

	var updated *model.EscrowAccount
	err := repository.DB.Transaction(func(tx *gorm.DB) error {
		project, escrow, err := loadProjectAndEscrowForFinanceTx(tx, input.ProjectID)
		if err != nil {
			return err
		}
		if escrow.Status == escrowStatusClosed {
			return errors.New("托管账户已关闭")
		}
		if input.Amount > escrow.FrozenAmount {
			return errors.New("解冻金额超过已冻结余额")
		}

		before := financeSnapshot(project, escrow)
		if _, err := unfreezeEscrowBalanceTx(tx, input.ProjectID, input.Amount); err != nil {
			return err
		}
		if err := tx.First(escrow, escrow.ID).Error; err != nil {
			return err
		}

		now := time.Now()
		trx := &model.Transaction{
			OrderID:     fmt.Sprintf("UNF-%d-%d", input.ProjectID, now.UnixNano()),
			EscrowID:    escrow.ID,
			Type:        "unfreeze",
			Amount:      input.Amount,
			FromUserID:  adminID,
			FromAccount: "admin",
			ToUserID:    project.OwnerID,
			ToAccount:   "escrow",
			Status:      1,
			Remark:      strings.TrimSpace(input.Reason),
			CompletedAt: &now,
		}
		if err := tx.Create(trx).Error; err != nil {
			return err
		}

		after := financeSnapshot(project, escrow)
		if err := s.auditService.CreateBusinessRecordTx(tx, &CreateAuditRecordInput{
			OperatorType:  "admin",
			OperatorID:    adminID,
			OperationType: "unfreeze_funds",
			ResourceType:  "project",
			ResourceID:    project.ID,
			Reason:        strings.TrimSpace(input.Reason),
			Result:        "success",
			BeforeState:   before,
			AfterState:    after,
			Metadata: map[string]interface{}{
				"amount":      input.Amount,
				"escrowId":    escrow.ID,
				"projectId":   project.ID,
				"projectName": project.Name,
			},
		}); err != nil {
			return err
		}

		updated = escrow
		return notifyFinanceParticipantsTx(tx, project, "project.finance.unfrozen", "项目资金已解冻", fmt.Sprintf("项目 #%d 资金已解除冻结，涉及金额 %.2f 元。原因：%s", project.ID, input.Amount, strings.TrimSpace(input.Reason)), buildProjectDisputeActionURL(project.ID))
	})
	if err != nil {
		return nil, err
	}

	return updated, nil
}

func (s *AdminFinanceService) ManualRelease(adminID uint64, input *ManualReleaseInput) (*model.Transaction, error) {
	if input == nil || input.ProjectID == 0 || input.MilestoneID == 0 {
		return nil, errors.New("项目和节点不能为空")
	}
	if input.Amount <= 0 {
		return nil, errors.New("放款金额必须大于0")
	}
	if strings.TrimSpace(input.Reason) == "" {
		return nil, errors.New("请填写放款原因")
	}

	var released *model.Transaction
	err := repository.DB.Transaction(func(tx *gorm.DB) error {
		project, escrow, err := loadProjectAndEscrowForFinanceTx(tx, input.ProjectID)
		if err != nil {
			return err
		}
		if escrow.Status == escrowStatusFrozen {
			return errors.New("项目资金已冻结，无法手动放款")
		}

		var milestone model.Milestone
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("id = ? AND project_id = ?", input.MilestoneID, input.ProjectID).
			First(&milestone).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return errors.New("验收节点不存在")
			}
			return err
		}
		if math.Abs(milestone.Amount-input.Amount) > 0.01 {
			return fmt.Errorf("放款金额必须与节点金额一致，当前节点金额为 %.2f", milestone.Amount)
		}
		if escrow.FrozenAmount > 0 {
			return errors.New("当前存在冻结资金，请先解冻后再放款")
		}
		if escrow.AvailableAmount < input.Amount {
			return errors.New("可释放资金不足")
		}

		releasedResult, err := s.settlementService.ReleaseMilestoneTx(tx, &ReleaseMilestoneInput{
			ProjectID:    input.ProjectID,
			MilestoneID:  input.MilestoneID,
			OperatorType: "admin",
			OperatorID:   adminID,
			Reason:       strings.TrimSpace(input.Reason),
			Source:       "admin.manual_release",
		})
		if err != nil {
			return err
		}
		if err := tx.First(escrow, escrow.ID).Error; err != nil {
			return err
		}
		released = releasedResult.Transaction
		return notifyFinanceParticipantsTx(tx, project, "project.finance.released", "节点结算已提交", fmt.Sprintf("项目 #%d 的节点“%s”已生成结算记录，等待线下打款确认，金额 %.2f 元。原因：%s", project.ID, releasedResult.Milestone.Name, input.Amount, strings.TrimSpace(input.Reason)), fmt.Sprintf("/projects/%d", project.ID))
	})
	if err != nil {
		return nil, err
	}

	return released, nil
}

func loadProjectAndEscrowForFinanceTx(tx *gorm.DB, projectID uint64) (*model.Project, *model.EscrowAccount, error) {
	var project model.Project
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&project, projectID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil, errors.New("项目不存在")
		}
		return nil, nil, err
	}

	var escrow model.EscrowAccount
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("project_id = ?", projectID).First(&escrow).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil, errors.New("托管账户不存在")
		}
		return nil, nil, err
	}

	return &project, &escrow, nil
}

func financeSnapshot(project *model.Project, escrow *model.EscrowAccount) map[string]interface{} {
	result := map[string]interface{}{}
	if project != nil {
		result["project"] = map[string]interface{}{
			"id":             project.ID,
			"name":           project.Name,
			"status":         project.Status,
			"businessStatus": project.BusinessStatus,
			"currentPhase":   project.CurrentPhase,
		}
	}
	if escrow != nil {
		result["escrow"] = map[string]interface{}{
			"id":              escrow.ID,
			"status":          escrow.Status,
			"totalAmount":     escrow.TotalAmount,
			"frozenAmount":    escrow.FrozenAmount,
			"releasedAmount":  escrow.ReleasedAmount,
			"availableAmount": escrow.AvailableAmount,
		}
	}
	return result
}

func notifyFinanceParticipantsTx(tx *gorm.DB, project *model.Project, notificationType, title, content, actionURL string) error {
	if project == nil {
		return nil
	}
	if project.OwnerID > 0 {
		if err := createNotificationTx(tx, &CreateNotificationInput{
			UserID:      project.OwnerID,
			UserType:    "user",
			Title:       title,
			Content:     content,
			Type:        notificationType,
			RelatedID:   project.ID,
			RelatedType: "project",
			ActionURL:   actionURL,
		}); err != nil {
			return err
		}
	}
	if providerUserID := getProviderUserIDTx(tx, project.ProviderID); providerUserID > 0 {
		if err := createNotificationTx(tx, &CreateNotificationInput{
			UserID:      providerUserID,
			UserType:    "provider",
			Title:       title,
			Content:     content,
			Type:        notificationType,
			RelatedID:   project.ID,
			RelatedType: "project",
			ActionURL:   actionURL,
		}); err != nil {
			return err
		}
	}
	return nil
}

func createNotificationTx(tx *gorm.DB, input *CreateNotificationInput) error {
	if input == nil || tx == nil {
		return nil
	}
	if input.UserID == 0 || strings.TrimSpace(input.Title) == "" || strings.TrimSpace(input.Content) == "" {
		return nil
	}
	shouldCreate, err := shouldCreateNotificationTx(tx, input)
	if err != nil || !shouldCreate {
		return err
	}

	notification := buildNotificationRecord(input)
	return tx.Create(notification).Error
}

func applyFinanceTransactionFilters(query *gorm.DB, filter AdminFinanceTransactionFilter) *gorm.DB {
	if transType := strings.TrimSpace(filter.Type); transType != "" {
		query = query.Where("t.type = ?", transType)
	}
	if filter.ProjectID > 0 {
		query = query.Where("ea.project_id = ?", filter.ProjectID)
	}
	if startAt, ok := parseAuditFilterTime(filter.StartDate, false); ok {
		query = query.Where("t.created_at >= ?", startAt)
	}
	if endAt, ok := parseAuditFilterTime(filter.EndDate, true); ok {
		query = query.Where("t.created_at < ?", endAt)
	}
	return query
}

func applyPaymentOrderFilters(query *gorm.DB, filter AdminPaymentOrderFilter) *gorm.DB {
	if channel := strings.TrimSpace(filter.Channel); channel != "" {
		query = query.Where("channel = ?", channel)
	}
	if status := strings.TrimSpace(filter.Status); status != "" {
		query = query.Where("status = ?", status)
	}
	if bizType := strings.TrimSpace(filter.BizType); bizType != "" {
		query = query.Where("biz_type = ?", bizType)
	}
	if fundScene := strings.TrimSpace(filter.FundScene); fundScene != "" {
		query = query.Where("fund_scene = ?", fundScene)
	}
	if refundStatus := strings.TrimSpace(filter.RefundStatus); refundStatus != "" {
		query = query.Where("refund_status = ?", refundStatus)
	}
	if outTradeNo := strings.TrimSpace(filter.OutTradeNo); outTradeNo != "" {
		query = query.Where("LOWER(out_trade_no) LIKE LOWER(?)", "%"+outTradeNo+"%")
	}
	if startAt, ok := parseAuditFilterTime(filter.StartDate, false); ok {
		query = query.Where("created_at >= ?", startAt)
	}
	if endAt, ok := parseAuditFilterTime(filter.EndDate, true); ok {
		query = query.Where("created_at < ?", endAt)
	}
	return query
}

type paymentRefundStat struct {
	PaymentOrderID uint64
	TotalCount     int64
	SucceededCount int64
}

func loadPaymentRefundStats(payments []model.PaymentOrder) (map[uint64]paymentRefundStat, error) {
	result := make(map[uint64]paymentRefundStat, len(payments))
	if len(payments) == 0 {
		return result, nil
	}
	ids := make([]uint64, 0, len(payments))
	for _, payment := range payments {
		ids = append(ids, payment.ID)
	}
	var rows []paymentRefundStat
	if err := repository.DB.Model(&model.RefundOrder{}).
		Select(`
			payment_order_id,
			COUNT(*) AS total_count,
			SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) AS succeeded_count
		`, model.RefundOrderStatusSucceeded).
		Where("payment_order_id IN ?", ids).
		Group("payment_order_id").
		Scan(&rows).Error; err != nil {
		return nil, err
	}
	for _, row := range rows {
		result[row.PaymentOrderID] = row
	}
	return result, nil
}

func serializeAdminPaymentOrder(payment model.PaymentOrder) AdminPaymentOrderItem {
	return AdminPaymentOrderItem{
		ID:                 payment.ID,
		BizType:            payment.BizType,
		BizID:              payment.BizID,
		PayerUserID:        payment.PayerUserID,
		Channel:            payment.Channel,
		FundScene:          payment.FundScene,
		TerminalType:       payment.TerminalType,
		Subject:            payment.Subject,
		Amount:             payment.Amount,
		AmountCent:         payment.AmountCent,
		RefundedAmount:     payment.RefundedAmount,
		RefundedAmountCent: payment.RefundedAmountCent,
		RefundStatus:       payment.RefundStatus,
		OutTradeNo:         payment.OutTradeNo,
		ProviderTradeNo:    payment.ProviderTradeNo,
		Status:             payment.Status,
		ExpiredAt:          payment.ExpiredAt,
		PaidAt:             payment.PaidAt,
		CreatedAt:          payment.CreatedAt,
		UpdatedAt:          payment.UpdatedAt,
		LaunchTokenSet:     strings.TrimSpace(payment.LaunchTokenHash) != "",
	}
}

func serializeAdminRefundOrder(refund model.RefundOrder) AdminRefundOrderItem {
	return AdminRefundOrderItem{
		ID:                  refund.ID,
		PaymentOrderID:      refund.PaymentOrderID,
		BizType:             refund.BizType,
		BizID:               refund.BizID,
		FundScene:           refund.FundScene,
		RefundApplicationID: refund.RefundApplicationID,
		OutRefundNo:         refund.OutRefundNo,
		Amount:              refund.Amount,
		AmountCent:          refund.AmountCent,
		Reason:              refund.Reason,
		Status:              refund.Status,
		FailureReason:       refund.FailureReason,
		SucceededAt:         refund.SucceededAt,
		CreatedAt:           refund.CreatedAt,
		UpdatedAt:           refund.UpdatedAt,
	}
}
