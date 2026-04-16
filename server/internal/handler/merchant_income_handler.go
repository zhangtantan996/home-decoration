package handler

import (
	crand "crypto/rand"
	"errors"
	"fmt"
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	"home-decoration-server/internal/service"
	"home-decoration-server/pkg/response"
	"io"
	"time"

	"math/big"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// ==================== 商家收入中心 Handler ====================

func resolveProviderPhone(providerID uint64) (string, error) {
	var provider model.Provider
	if err := repository.DB.Select("user_id").Where("id = ?", providerID).First(&provider).Error; err != nil {
		return "", err
	}

	var user model.User
	if err := repository.DB.Select("phone").Where("id = ?", provider.UserID).First(&user).Error; err != nil {
		return "", err
	}
	if user.Phone == "" {
		return "", errors.New("手机号未绑定")
	}
	return user.Phone, nil
}

// MerchantIncomeSummary 收入概览
func MerchantIncomeSummary(c *gin.Context) {
	providerID := c.GetUint64("providerId")

	var summary struct {
		TotalIncome     float64 `json:"totalIncome"`     // 累计收入
		PendingSettle   float64 `json:"pendingSettle"`   // 待结算
		SettledAmount   float64 `json:"settledAmount"`   // 已结算 (总额)
		WithdrawnAmount float64 `json:"withdrawnAmount"` // 已提现 (总额)
		AvailableAmount float64 `json:"availableAmount"` // 可提现
	}

	// 1. 累计收入 (所有状态)
	repository.DB.Model(&model.MerchantIncome{}).
		Where("provider_id = ?", providerID).
		Select("COALESCE(SUM(net_amount), 0)").
		Scan(&summary.TotalIncome)

	// 2. 待结算 (status=0)
	repository.DB.Model(&model.MerchantIncome{}).
		Where("provider_id = ? AND status = 0", providerID).
		Select("COALESCE(SUM(net_amount), 0)").
		Scan(&summary.PendingSettle)

	// 3. 已结算 (status=1 或 status=2) - 这里视为进入资金池的总金额
	var totalSettled float64
	repository.DB.Model(&model.MerchantIncome{}).
		Where("provider_id = ? AND status IN (1, 2)", providerID).
		Select("COALESCE(SUM(net_amount), 0)").
		Scan(&totalSettled)
	summary.SettledAmount = totalSettled

	// 4. 已出款金额（新主链直接从商家收入投影读取）
	repository.DB.Model(&model.MerchantIncome{}).
		Where("provider_id = ? AND status = 2", providerID).
		Select("COALESCE(SUM(amount), 0)").
		Scan(&summary.WithdrawnAmount)

	// 5. 待出款 = status=1
	repository.DB.Model(&model.MerchantIncome{}).
		Where("provider_id = ? AND status = 1 AND COALESCE(withdraw_order_no, '') = ''", providerID).
		Select("COALESCE(SUM(net_amount), 0)").
		Scan(&summary.AvailableAmount)
	if summary.AvailableAmount < 0 {
		summary.AvailableAmount = 0
	}

	response.Success(c, summary)
}

// MerchantIncomeList 收入记录列表
func MerchantIncomeList(c *gin.Context) {
	providerID := c.GetUint64("providerId")

	var incomes []model.MerchantIncome
	query := repository.DB.Where("provider_id = ?", providerID).
		Order("created_at DESC")

	// 筛选类型
	if incomeType := c.Query("type"); incomeType != "" {
		query = query.Where("type = ?", incomeType)
	}

	// 筛选状态
	if status := c.Query("status"); status != "" {
		query = query.Where("status = ?", status)
	}

	// 分页
	page := parseIntDefault(c.Query("page"), 1)
	pageSize := parseIntDefault(c.Query("pageSize"), 20)
	offset := (page - 1) * pageSize

	var total int64
	query.Model(&model.MerchantIncome{}).Count(&total)
	query.Offset(offset).Limit(pageSize).Find(&incomes)

	// 收入类型文案
	typeLabels := map[string]string{
		"intent_fee":     "量房费",
		"survey_deposit": "量房费",
		"design_fee":     "设计费",
		"construction":   "施工款",
	}

	// 组装返回数据
	list := make([]gin.H, len(incomes))
	for i, income := range incomes {
		list[i] = gin.H{
			"id":          income.ID,
			"orderId":     income.OrderID,
			"bookingId":   income.BookingID,
			"type":        income.Type,
			"typeLabel":   typeLabels[income.Type],
			"amount":      income.Amount,
			"platformFee": income.PlatformFee,
			"netAmount":   income.NetAmount,
			"status":      income.Status,
			"statusLabel": getIncomeStatusLabel(income.Status),
			"settledAt":   income.SettledAt,
			"createdAt":   income.CreatedAt,
		}
	}

	response.Success(c, gin.H{
		"list":     list,
		"total":    total,
		"page":     page,
		"pageSize": pageSize,
	})
}

func getIncomeStatusLabel(status int8) string {
	switch status {
	case 0:
		return "待结算"
	case 1:
		return "待出款"
	case 2:
		return "已出款"
	default:
		return "未知"
	}
}

// MerchantSettlementList 结算/出款记录列表
func MerchantSettlementList(c *gin.Context) {
	providerID := c.GetUint64("providerId")
	page := parseIntDefault(c.Query("page"), 1)
	pageSize := parseIntDefault(c.Query("pageSize"), 20)
	list, total, err := service.NewPayoutService().ListMerchantSettlements(providerID, page, pageSize)
	if err != nil {
		response.ServerError(c, "获取结算记录失败")
		return
	}
	response.Success(c, gin.H{
		"list":     list,
		"total":    total,
		"page":     page,
		"pageSize": pageSize,
	})
}

func MerchantBondAccount(c *gin.Context) {
	providerID := c.GetUint64("providerId")
	item, err := service.NewBondService().GetProviderBondAccount(providerID)
	if err != nil {
		response.ServerError(c, "获取保证金账户失败")
		return
	}
	response.Success(c, item)
}

type merchantBondPaymentLaunchRequest struct {
	TerminalType string `json:"terminalType"`
	ResultPath   string `json:"resultPath"`
}

func bindMerchantBondPaymentLaunchRequest(c *gin.Context) (*merchantBondPaymentLaunchRequest, error) {
	var req merchantBondPaymentLaunchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		if errors.Is(err, io.EOF) {
			return &req, nil
		}
		return nil, err
	}
	return &req, nil
}

func resolveMerchantPaymentResultBaseURL(c *gin.Context, resultPath string) string {
	path := strings.TrimSpace(resultPath)
	if path == "" {
		path = "/payments/result"
	}
	if !strings.HasPrefix(path, "/") {
		path = "/" + path
	}
	if origin := strings.TrimSpace(c.GetHeader("Origin")); origin != "" {
		return strings.TrimRight(origin, "/") + path
	}
	scheme := "http"
	if c.Request.TLS != nil || strings.EqualFold(strings.TrimSpace(c.GetHeader("X-Forwarded-Proto")), "https") {
		scheme = "https"
	}
	if host := strings.TrimSpace(c.Request.Host); host != "" {
		return fmt.Sprintf("%s://%s%s", scheme, host, path)
	}
	return ""
}

func MerchantStartBondPayment(c *gin.Context) {
	providerID := c.GetUint64("providerId")
	userID := getCurrentUserID(c)
	req, err := bindMerchantBondPaymentLaunchRequest(c)
	if err != nil {
		response.BadRequest(c, "支付参数无效")
		return
	}
	result, err := paymentService.StartMerchantBondPayment(userID, providerID, req.TerminalType, resolveMerchantPaymentResultBaseURL(c, req.ResultPath))
	if err != nil {
		respondDomainMutationError(c, err, "发起保证金支付失败")
		return
	}
	response.Success(c, result)
}

func MerchantBondLedger(c *gin.Context) {
	providerID := c.GetUint64("providerId")
	page := parseIntDefault(c.Query("page"), 1)
	pageSize := parseIntDefault(c.Query("pageSize"), 20)
	list, total, err := service.NewBondService().ListProviderBondLedger(providerID, page, pageSize)
	if err != nil {
		response.ServerError(c, "获取保证金流水失败")
		return
	}
	response.Success(c, gin.H{
		"list":     list,
		"total":    total,
		"page":     page,
		"pageSize": pageSize,
	})
}

func MerchantPaymentStatus(c *gin.Context) {
	paymentID := parseUint64(c.Param("id"))
	if paymentID == 0 {
		response.BadRequest(c, "无效支付单ID")
		return
	}
	result, err := paymentService.GetPaymentStatusForPayer(paymentID, getCurrentUserID(c))
	if err != nil {
		respondScopedAccessError(c, err, "获取支付状态失败")
		return
	}
	response.Success(c, result)
}

// ==================== 商家提现 Handler ====================

// MerchantWithdrawList 提现记录列表
func MerchantWithdrawList(c *gin.Context) {
	providerID := c.GetUint64("providerId")

	var withdraws []model.MerchantWithdraw
	query := repository.DB.Where("provider_id = ?", providerID).
		Order("created_at DESC")

	// 筛选状态
	if status := c.Query("status"); status != "" {
		query = query.Where("status = ?", status)
	}

	// 分页
	page := parseIntDefault(c.Query("page"), 1)
	pageSize := parseIntDefault(c.Query("pageSize"), 20)
	offset := (page - 1) * pageSize

	var total int64
	query.Model(&model.MerchantWithdraw{}).Count(&total)
	query.Offset(offset).Limit(pageSize).Find(&withdraws)

	// 组装返回数据
	list := make([]gin.H, len(withdraws))
	for i, w := range withdraws {
		list[i] = gin.H{
			"id":              w.ID,
			"orderNo":         w.OrderNo,
			"amount":          w.Amount,
			"bankAccount":     maskBankAccount(w.BankAccount),
			"bankName":        w.BankName,
			"status":          w.Status,
			"statusLabel":     getWithdrawStatusLabel(w.Status),
			"failReason":      w.FailReason,
			"approvedAt":      w.ApprovedAt,
			"transferredAt":   w.TransferredAt,
			"transferVoucher": w.TransferVoucher,
			"completedAt":     w.CompletedAt,
			"createdAt":       w.CreatedAt,
		}
	}

	response.Success(c, gin.H{
		"list":     list,
		"total":    total,
		"page":     page,
		"pageSize": pageSize,
	})
}

func getWithdrawStatusLabel(status int8) string {
	switch status {
	case model.MerchantWithdrawStatusPendingReview:
		return "待审核"
	case model.MerchantWithdrawStatusApprovedPendingTransfer:
		return "待打款"
	case model.MerchantWithdrawStatusPaid:
		return "已打款"
	case model.MerchantWithdrawStatusRejected:
		return "已拒绝"
	default:
		return "未知"
	}
}

// maskBankAccount 银行账号脱敏
func maskBankAccount(account string) string {
	if len(account) <= 8 {
		return account
	}
	return account[:4] + "****" + account[len(account)-4:]
}

// MerchantWithdrawCreate 申请提现（需要二次验证）
func MerchantWithdrawCreate(c *gin.Context) {
	providerID := c.GetUint64("providerId")

	var input struct {
		Amount           float64 `json:"amount" binding:"required"`
		BankAccountID    uint64  `json:"bankAccountId" binding:"required"`
		VerificationCode string  `json:"verificationCode" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		response.Error(c, 400, "参数错误")
		return
	}

	withdrawAmount := roundMoney(input.Amount)
	if withdrawAmount <= 0 {
		response.Error(c, 400, "提现金额必须大于0")
		return
	}

	phone, err := resolveProviderPhone(providerID)
	if err != nil {
		response.Error(c, 400, "当前账号缺少绑定手机号")
		return
	}
	if err := service.VerifySMSCode(phone, service.SMSPurposeMerchantWithdraw, input.VerificationCode); err != nil {
		response.Error(c, 400, err.Error())
		return
	}

	orderNo, err := generateWithdrawOrderNo()
	if err != nil {
		response.Error(c, 500, "生成提现单号失败")
		return
	}

	var withdraw model.MerchantWithdraw
	err = repository.DB.Transaction(func(tx *gorm.DB) error {
		var account model.MerchantBankAccount
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("id = ? AND provider_id = ? AND status = 1", input.BankAccountID, providerID).
			First(&account).Error; err != nil {
			return errors.New("银行卡不存在")
		}

		var availableAmount float64
		if err := tx.Model(&model.MerchantIncome{}).
			Where("provider_id = ? AND status = 1 AND COALESCE(withdraw_order_no, '') = ''", providerID).
			Select("COALESCE(SUM(net_amount), 0)").
			Scan(&availableAmount).Error; err != nil {
			return err
		}
		if roundMoney(availableAmount) < withdrawAmount {
			return errors.New("可提现金额不足")
		}

		if err := reserveWithdrawIncomesTx(tx, providerID, orderNo, withdrawAmount); err != nil {
			return err
		}

		withdraw = model.MerchantWithdraw{
			ProviderID:  providerID,
			OrderNo:     orderNo,
			Amount:      withdrawAmount,
			BankAccount: maskBankAccount(account.AccountNo),
			BankName:    account.BankName,
			Status:      model.MerchantWithdrawStatusPendingReview,
		}
		return tx.Create(&withdraw).Error
	})
	if err != nil {
		response.Error(c, 400, err.Error())
		return
	}

	response.Success(c, gin.H{
		"withdrawId": withdraw.ID,
		"orderNo":    withdraw.OrderNo,
		"message":    "提现申请已提交，等待平台审核",
	})

	service.NewNotificationDispatcher().NotifyWithdrawAppliedToAdmins(withdraw.ID, providerID, withdraw.Amount, withdraw.OrderNo)
}

func generateWithdrawOrderNo() (string, error) {
	max := big.NewInt(1000000)
	n, err := crand.Int(crand.Reader, max)
	if err != nil {
		return "", err
	}
	return "W" + time.Now().Format("20060102150405") + fmt.Sprintf("%06d", n.Int64()), nil
}

// ==================== 商家银行账户 Handler ====================

// MerchantBankAccountList 银行账户列表
func MerchantBankAccountList(c *gin.Context) {
	providerID := c.GetUint64("providerId")

	var accounts []model.MerchantBankAccount
	repository.DB.Where("provider_id = ? AND status = 1", providerID).
		Order("is_default DESC, created_at DESC").
		Find(&accounts)

	list := make([]gin.H, len(accounts))
	for i, acc := range accounts {
		list[i] = gin.H{
			"id":          acc.ID,
			"accountName": acc.AccountName,
			"accountNo":   maskBankAccount(acc.AccountNo),
			"bankName":    acc.BankName,
			"branchName":  acc.BranchName,
			"isDefault":   acc.IsDefault,
		}
	}

	response.Success(c, gin.H{"list": list})
}

// MerchantBankAccountCreate 添加银行账户（需要二次验证）
func MerchantBankAccountCreate(c *gin.Context) {
	providerID := c.GetUint64("providerId")

	var input struct {
		AccountName      string `json:"accountName" binding:"required"`
		AccountNo        string `json:"accountNo" binding:"required"`
		BankName         string `json:"bankName" binding:"required"`
		BranchName       string `json:"branchName"`
		IsDefault        bool   `json:"isDefault"`
		VerificationCode string `json:"verificationCode" binding:"required"` // 二次验证码
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		response.Error(c, 400, "参数错误")
		return
	}

	// 二次验证：验证码检查（高风险操作）
	phone, err := resolveProviderPhone(providerID)
	if err != nil {
		response.Error(c, 400, "验证码校验失败")
		return
	}
	if err := service.VerifySMSCode(phone, service.SMSPurposeMerchantBankBind, input.VerificationCode); err != nil {
		response.Error(c, 400, err.Error())
		return
	}

	// 如果设为默认，取消其他默认
	if input.IsDefault {
		repository.DB.Model(&model.MerchantBankAccount{}).
			Where("provider_id = ?", providerID).
			Update("is_default", false)
	}

	// 检查账户数量限制 (最多5个)
	var count int64
	repository.DB.Model(&model.MerchantBankAccount{}).
		Where("provider_id = ? AND status = 1", providerID).
		Count(&count)
	if count >= 5 {
		response.Error(c, 400, "最多只能添加5个银行账户")
		return
	}

	account := model.MerchantBankAccount{
		ProviderID:  providerID,
		AccountName: input.AccountName,
		AccountNo:   input.AccountNo, // TODO: 生产环境需要加密
		BankName:    input.BankName,
		BranchName:  input.BranchName,
		IsDefault:   input.IsDefault,
		Status:      1,
	}

	if err := repository.DB.Create(&account).Error; err != nil {
		response.Error(c, 500, "添加失败")
		return
	}

	response.Success(c, gin.H{
		"id":      account.ID,
		"message": "添加成功",
	})
}

// MerchantBankAccountDelete 删除银行账户
func MerchantBankAccountDelete(c *gin.Context) {
	providerID := c.GetUint64("providerId")
	accountID := parseUint64(c.Param("id"))

	// 软删除（设置status=0）
	result := repository.DB.Model(&model.MerchantBankAccount{}).
		Where("id = ? AND provider_id = ?", accountID, providerID).
		Update("status", 0)

	if result.RowsAffected == 0 {
		response.Error(c, 404, "账户不存在")
		return
	}

	response.Success(c, gin.H{"message": "删除成功"})
}

// MerchantBankAccountSetDefault 设为默认账户
func MerchantBankAccountSetDefault(c *gin.Context) {
	providerID := c.GetUint64("providerId")
	accountID := parseUint64(c.Param("id"))

	// 取消其他默认
	repository.DB.Model(&model.MerchantBankAccount{}).
		Where("provider_id = ?", providerID).
		Update("is_default", false)

	// 设置新默认
	result := repository.DB.Model(&model.MerchantBankAccount{}).
		Where("id = ? AND provider_id = ? AND status = 1", accountID, providerID).
		Update("is_default", true)

	if result.RowsAffected == 0 {
		response.Error(c, 404, "账户不存在")
		return
	}

	response.Success(c, gin.H{"message": "设置成功"})
}

// ==================== 辅助函数 ====================

func parseIntDefault(s string, defaultVal int) int {
	v, err := strconv.Atoi(s)
	if err != nil {
		return defaultVal
	}
	return v
}

func parseIntFrom(s string, v *int) (int, error) {
	val, err := strconv.Atoi(s)
	if err != nil {
		return 0, err
	}
	*v = val
	return val, nil
}

func secureRandomString(n int) (string, error) {
	const letters = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
	b := make([]byte, n)
	for i := range b {
		randomIndex, err := crand.Int(crand.Reader, big.NewInt(int64(len(letters))))
		if err != nil {
			return "", err
		}
		b[i] = letters[randomIndex.Int64()]
	}
	return string(b), nil
}
