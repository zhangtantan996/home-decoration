package handler

import (
	"errors"
	"io"
	"log"
	"math"
	"strings"
	"time"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	"home-decoration-server/internal/service"
	"home-decoration-server/pkg/response"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// AdminWithdrawList 管理员查看提现申请列表
func AdminWithdrawList(c *gin.Context) {
	var withdraws []model.MerchantWithdraw
	query := repository.DB.Order("created_at DESC")

	if status := c.Query("status"); status != "" {
		query = query.Where("status = ?", status)
	}
	if providerID := c.Query("providerId"); providerID != "" {
		query = query.Where("provider_id = ?", providerID)
	}

	page := parseIntDefault(c.Query("page"), 1)
	pageSize := parseIntDefault(c.Query("pageSize"), 20)
	offset := (page - 1) * pageSize

	var total int64
	query.Model(&model.MerchantWithdraw{}).Count(&total)
	query.Offset(offset).Limit(pageSize).Find(&withdraws)

	providerIDs := make([]uint64, 0, len(withdraws))
	for _, withdraw := range withdraws {
		providerIDs = append(providerIDs, withdraw.ProviderID)
	}
	var providers []model.Provider
	if len(providerIDs) > 0 {
		repository.DB.Where("id IN ?", providerIDs).Find(&providers)
	}
	providerMap := make(map[uint64]model.Provider, len(providers))
	for _, provider := range providers {
		providerMap[provider.ID] = provider
	}

	list := make([]gin.H, len(withdraws))
	for i, withdraw := range withdraws {
		provider := providerMap[withdraw.ProviderID]
		list[i] = serializeAdminWithdraw(withdraw, provider)
	}

	response.Success(c, gin.H{
		"list":     list,
		"total":    total,
		"page":     page,
		"pageSize": pageSize,
	})
}

// AdminWithdrawDetail 管理员查看提现详情
func AdminWithdrawDetail(c *gin.Context) {
	withdrawID := parseUint64(c.Param("id"))

	var withdraw model.MerchantWithdraw
	if err := repository.DB.First(&withdraw, withdrawID).Error; err != nil {
		response.Error(c, 404, "提现记录不存在")
		return
	}

	var provider model.Provider
	repository.DB.First(&provider, withdraw.ProviderID)
	var providerUser model.User
	if provider.UserID > 0 {
		_ = repository.DB.Select("nickname", "phone").First(&providerUser, provider.UserID).Error
	}
	providerName := service.ResolveProviderDisplayName(provider, func() *model.User {
		if provider.UserID > 0 {
			return &providerUser
		}
		return nil
	}())

	var incomes []model.MerchantIncome
	repository.DB.Where("provider_id = ? AND status IN ?", withdraw.ProviderID, []int8{1, 2}).
		Order("created_at DESC").
		Find(&incomes)

	response.Success(c, gin.H{
		"withdraw": serializeAdminWithdraw(withdraw, provider),
		"provider": gin.H{
			"id":           provider.ID,
			"companyName":  provider.CompanyName,
			"displayName":  providerName,
			"providerType": provider.ProviderType,
		},
		"incomes": incomes,
	})
}

// AdminWithdrawApprove 管理员审核通过提现
func AdminWithdrawApprove(c *gin.Context) {
	withdrawID := parseUint64(c.Param("id"))
	adminID := c.GetUint64("admin_id")

	var input struct {
		Remark       string `json:"remark"`
		AutoPayout   bool   `json:"autoPayout"`   // 是否启用自动出款
		SettlementID uint64 `json:"settlementId"` // 关联的结算单ID（如果有）
	}
	if err := c.ShouldBindJSON(&input); err != nil && !errors.Is(err, io.EOF) {
		response.Error(c, 400, "参数错误")
		return
	}

	var (
		withdraw model.MerchantWithdraw
		provider model.Provider
	)
	auditService := &service.AuditLogService{}
	err := repository.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&withdraw, withdrawID).Error; err != nil {
			return errors.New("提现记录不存在")
		}
		if withdraw.Status != model.MerchantWithdrawStatusPendingReview {
			return errors.New("只有待审核提现可以审核通过")
		}
		beforeState := map[string]interface{}{
			"withdraw": snapshotWithdrawForAudit(withdraw),
		}
		now := time.Now()
		if err := tx.Model(&withdraw).Updates(map[string]any{
			"status":       model.MerchantWithdrawStatusApprovedPendingTransfer,
			"approved_at":  &now,
			"operator_id":  adminID,
			"audit_remark": strings.TrimSpace(input.Remark),
		}).Error; err != nil {
			return err
		}
		withdraw.Status = model.MerchantWithdrawStatusApprovedPendingTransfer
		withdraw.ApprovedAt = &now
		withdraw.OperatorID = adminID
		withdraw.AuditRemark = strings.TrimSpace(input.Remark)
		if err := tx.First(&provider, withdraw.ProviderID).Error; err != nil {
			return err
		}
		return auditService.CreateBusinessRecordTx(tx, &service.CreateAuditRecordInput{
			OperatorType:  "admin",
			OperatorID:    adminID,
			OperationType: "approve_withdraw_application",
			ResourceType:  "merchant_withdraw",
			ResourceID:    withdraw.ID,
			Reason:        strings.TrimSpace(input.Remark),
			Result:        "success",
			BeforeState:   beforeState,
			AfterState: map[string]interface{}{
				"withdraw": snapshotWithdrawForAudit(withdraw),
			},
			Metadata: map[string]interface{}{
				"providerId": withdraw.ProviderID,
				"orderNo":    withdraw.OrderNo,
				"amount":     withdraw.Amount,
				"autoPayout": input.AutoPayout,
			},
		})
	})
	if err != nil {
		response.Error(c, 400, err.Error())
		return
	}

	if input.AutoPayout {
		log.Printf("[AdminWithdrawApprove] Auto payout ignored for withdraw #%d: phase-1 payout requires manual offline transfer", withdraw.ID)
	}
	payoutMessage := "审核通过，等待线下打款"

	notifService := &service.NotificationService{}
	if err := notifService.NotifyWithdrawApproved(&withdraw, provider.UserID); err != nil {
		log.Printf("[AdminWithdrawApprove] Failed to send notification: %v", err)
	}

	response.Success(c, gin.H{
		"message":  payoutMessage,
		"withdraw": serializeAdminWithdraw(withdraw, provider),
	})
}

// AdminWithdrawMarkPaid 管理员确认线下打款完成
func AdminWithdrawMarkPaid(c *gin.Context) {
	withdrawID := parseUint64(c.Param("id"))
	adminID := c.GetUint64("admin_id")

	var input struct {
		TransferVoucher string `json:"transferVoucher" binding:"required"`
		Remark          string `json:"remark"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		response.Error(c, 400, "请填写打款凭证")
		return
	}

	var (
		withdraw model.MerchantWithdraw
		provider model.Provider
	)
	auditService := &service.AuditLogService{}
	err := repository.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&withdraw, withdrawID).Error; err != nil {
			return errors.New("提现记录不存在")
		}
		if withdraw.Status != model.MerchantWithdrawStatusApprovedPendingTransfer {
			return errors.New("只有待打款提现可以确认完成")
		}
		beforeState := map[string]interface{}{
			"withdraw": snapshotWithdrawForAudit(withdraw),
		}
		if err := markWithdrawIncomesPaidTx(tx, &withdraw); err != nil {
			return err
		}
		now := time.Now()
		if err := tx.Model(&withdraw).Updates(map[string]any{
			"status":           model.MerchantWithdrawStatusPaid,
			"operator_id":      adminID,
			"transferred_at":   &now,
			"completed_at":     &now,
			"transfer_voucher": strings.TrimSpace(input.TransferVoucher),
			"audit_remark":     strings.TrimSpace(input.Remark),
		}).Error; err != nil {
			return err
		}
		withdraw.Status = model.MerchantWithdrawStatusPaid
		withdraw.OperatorID = adminID
		withdraw.TransferVoucher = strings.TrimSpace(input.TransferVoucher)
		withdraw.AuditRemark = strings.TrimSpace(input.Remark)
		withdraw.TransferredAt = &now
		withdraw.CompletedAt = &now
		if err := tx.First(&provider, withdraw.ProviderID).Error; err != nil {
			return err
		}
		return auditService.CreateBusinessRecordTx(tx, &service.CreateAuditRecordInput{
			OperatorType:  "admin",
			OperatorID:    adminID,
			OperationType: "mark_withdraw_paid",
			ResourceType:  "merchant_withdraw",
			ResourceID:    withdraw.ID,
			Reason:        strings.TrimSpace(input.Remark),
			Result:        "success",
			BeforeState:   beforeState,
			AfterState: map[string]interface{}{
				"withdraw": snapshotWithdrawForAudit(withdraw),
			},
			Metadata: map[string]interface{}{
				"providerId":         withdraw.ProviderID,
				"orderNo":            withdraw.OrderNo,
				"amount":             withdraw.Amount,
				"hasTransferVoucher": strings.TrimSpace(input.TransferVoucher) != "",
			},
		})
	})
	if err != nil {
		response.Error(c, 400, err.Error())
		return
	}

	notifService := &service.NotificationService{}
	if err := notifService.NotifyWithdrawCompleted(&withdraw, provider.UserID); err != nil {
		log.Printf("[AdminWithdrawMarkPaid] Failed to send notification: %v", err)
	}

	response.Success(c, gin.H{
		"message":  "已登记线下打款完成",
		"withdraw": serializeAdminWithdraw(withdraw, provider),
	})
}

// AdminWithdrawReject 管理员审核拒绝提现
func AdminWithdrawReject(c *gin.Context) {
	withdrawID := parseUint64(c.Param("id"))
	adminID := c.GetUint64("admin_id")

	var input struct {
		Reason string `json:"reason" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		response.Error(c, 400, "请输入拒绝原因")
		return
	}

	var (
		withdraw model.MerchantWithdraw
		provider model.Provider
	)
	auditService := &service.AuditLogService{}
	err := repository.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&withdraw, withdrawID).Error; err != nil {
			return errors.New("提现记录不存在")
		}
		if withdraw.Status != model.MerchantWithdrawStatusPendingReview {
			return errors.New("只有待审核提现可以拒绝")
		}
		beforeState := map[string]interface{}{
			"withdraw": snapshotWithdrawForAudit(withdraw),
		}
		if err := releaseWithdrawIncomesTx(tx, withdraw.OrderNo); err != nil {
			return err
		}
		if err := tx.Model(&withdraw).Updates(map[string]any{
			"status":       model.MerchantWithdrawStatusRejected,
			"fail_reason":  strings.TrimSpace(input.Reason),
			"operator_id":  adminID,
			"audit_remark": strings.TrimSpace(input.Reason),
		}).Error; err != nil {
			return err
		}
		withdraw.Status = model.MerchantWithdrawStatusRejected
		withdraw.FailReason = strings.TrimSpace(input.Reason)
		withdraw.OperatorID = adminID
		withdraw.AuditRemark = strings.TrimSpace(input.Reason)
		if err := tx.First(&provider, withdraw.ProviderID).Error; err != nil {
			return err
		}
		return auditService.CreateBusinessRecordTx(tx, &service.CreateAuditRecordInput{
			OperatorType:  "admin",
			OperatorID:    adminID,
			OperationType: "reject_withdraw_application",
			ResourceType:  "merchant_withdraw",
			ResourceID:    withdraw.ID,
			Reason:        strings.TrimSpace(input.Reason),
			Result:        "success",
			BeforeState:   beforeState,
			AfterState: map[string]interface{}{
				"withdraw": snapshotWithdrawForAudit(withdraw),
			},
			Metadata: map[string]interface{}{
				"providerId": withdraw.ProviderID,
				"orderNo":    withdraw.OrderNo,
				"amount":     withdraw.Amount,
			},
		})
	})
	if err != nil {
		response.Error(c, 400, err.Error())
		return
	}

	notifService := &service.NotificationService{}
	if err := notifService.NotifyWithdrawRejected(&withdraw, provider.UserID); err != nil {
		log.Printf("[AdminWithdrawReject] Failed to send notification: %v", err)
	}

	response.Success(c, gin.H{
		"message":  "已拒绝该提现申请",
		"withdraw": serializeAdminWithdraw(withdraw, provider),
	})
}

func serializeAdminWithdraw(withdraw model.MerchantWithdraw, provider model.Provider) gin.H {
	var providerUser model.User
	if provider.UserID > 0 {
		_ = repository.DB.Select("nickname", "phone").First(&providerUser, provider.UserID).Error
	}
	providerName := service.ResolveProviderDisplayName(provider, func() *model.User {
		if provider.UserID > 0 {
			return &providerUser
		}
		return nil
	}())
	return gin.H{
		"id":              withdraw.ID,
		"providerId":      withdraw.ProviderID,
		"providerName":    providerName,
		"orderNo":         withdraw.OrderNo,
		"amount":          withdraw.Amount,
		"bankAccount":     withdraw.BankAccount,
		"bankName":        withdraw.BankName,
		"status":          withdraw.Status,
		"statusLabel":     getWithdrawStatusLabel(withdraw.Status),
		"failReason":      withdraw.FailReason,
		"approvedAt":      withdraw.ApprovedAt,
		"transferredAt":   withdraw.TransferredAt,
		"transferVoucher": withdraw.TransferVoucher,
		"completedAt":     withdraw.CompletedAt,
		"createdAt":       withdraw.CreatedAt,
	}
}

func markWithdrawIncomesPaidTx(tx *gorm.DB, withdraw *model.MerchantWithdraw) error {
	if tx == nil || withdraw == nil {
		return errors.New("提现上下文无效")
	}
	remaining := roundMoney(withdraw.Amount)
	if remaining <= 0 {
		return errors.New("提现金额无效")
	}

	var incomes []model.MerchantIncome
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
		Where("provider_id = ? AND status = ? AND withdraw_order_no = ?", withdraw.ProviderID, 1, withdraw.OrderNo).
		Order("created_at ASC, id ASC").
		Find(&incomes).Error; err != nil {
		return err
	}
	useReserved := len(incomes) > 0
	if !useReserved {
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("provider_id = ? AND status = ?", withdraw.ProviderID, 1).
			Order("created_at ASC, id ASC").
			Find(&incomes).Error; err != nil {
			return err
		}
	}

	for _, income := range incomes {
		if remaining <= 0 {
			break
		}
		available := roundMoney(income.NetAmount)
		if available <= 0 {
			continue
		}

		if useReserved || available <= remaining {
			if err := tx.Model(&income).Updates(map[string]any{
				"status":            2,
				"withdraw_order_no": withdraw.OrderNo,
			}).Error; err != nil {
				return err
			}
			remaining = roundMoney(remaining - available)
			continue
		}

		if err := splitWithdrawnIncomeTx(tx, &income, withdraw.OrderNo, remaining); err != nil {
			return err
		}
		remaining = 0
	}

	if remaining > 0 {
		return errors.New("已结算收入不足以匹配本次提现金额")
	}
	return nil
}

func splitWithdrawnIncomeTx(tx *gorm.DB, income *model.MerchantIncome, withdrawOrderNo string, withdrawNetAmount float64) error {
	if tx == nil || income == nil {
		return errors.New("收入拆分上下文无效")
	}
	withdrawNetAmount = roundMoney(withdrawNetAmount)
	if withdrawNetAmount <= 0 || withdrawNetAmount >= roundMoney(income.NetAmount) {
		return errors.New("收入拆分金额无效")
	}

	ratio := withdrawNetAmount / income.NetAmount
	withdrawAmount := roundMoney(income.Amount * ratio)
	withdrawPlatformFee := roundMoney(income.PlatformFee * ratio)

	withdrawnIncome := *income
	withdrawnIncome.Base = model.Base{}
	withdrawnIncome.Amount = withdrawAmount
	withdrawnIncome.PlatformFee = withdrawPlatformFee
	withdrawnIncome.NetAmount = withdrawNetAmount
	withdrawnIncome.Status = 2
	withdrawnIncome.WithdrawOrderNo = withdrawOrderNo
	if err := tx.Create(&withdrawnIncome).Error; err != nil {
		return err
	}

	remainingAmount := roundMoney(income.Amount - withdrawAmount)
	remainingPlatformFee := roundMoney(income.PlatformFee - withdrawPlatformFee)
	remainingNetAmount := roundMoney(income.NetAmount - withdrawNetAmount)
	if remainingNetAmount <= 0 {
		return errors.New("收入拆分后剩余金额无效")
	}

	return tx.Model(income).Updates(map[string]any{
		"amount":       remainingAmount,
		"platform_fee": remainingPlatformFee,
		"net_amount":   remainingNetAmount,
	}).Error
}

func roundMoney(value float64) float64 {
	return math.Round(value*100) / 100
}

func snapshotWithdrawForAudit(withdraw model.MerchantWithdraw) map[string]interface{} {
	return map[string]interface{}{
		"id":              withdraw.ID,
		"providerId":      withdraw.ProviderID,
		"orderNo":         withdraw.OrderNo,
		"amount":          withdraw.Amount,
		"bankName":        withdraw.BankName,
		"status":          withdraw.Status,
		"failReason":      withdraw.FailReason,
		"approvedAt":      withdraw.ApprovedAt,
		"transferredAt":   withdraw.TransferredAt,
		"completedAt":     withdraw.CompletedAt,
		"operatorId":      withdraw.OperatorID,
		"auditRemark":     withdraw.AuditRemark,
		"withdrawVoucher": withdraw.TransferVoucher,
	}
}
