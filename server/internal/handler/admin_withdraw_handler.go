package handler

import (
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	"home-decoration-server/internal/service"
	"home-decoration-server/pkg/response"
	"log"
	"time"

	"github.com/gin-gonic/gin"
)

// AdminWithdrawList 管理员查看提现申请列表
func AdminWithdrawList(c *gin.Context) {
	var withdraws []model.MerchantWithdraw
	query := repository.DB.Order("created_at DESC")

	// 筛选状态
	if status := c.Query("status"); status != "" {
		query = query.Where("status = ?", status)
	}

	// 筛选商家
	if providerID := c.Query("providerId"); providerID != "" {
		query = query.Where("provider_id = ?", providerID)
	}

	// 分页
	page := parseIntDefault(c.Query("page"), 1)
	pageSize := parseIntDefault(c.Query("pageSize"), 20)
	offset := (page - 1) * pageSize

	var total int64
	query.Model(&model.MerchantWithdraw{}).Count(&total)
	query.Offset(offset).Limit(pageSize).Find(&withdraws)

	// 查询商家信息
	providerIDs := make([]uint64, 0)
	for _, w := range withdraws {
		providerIDs = append(providerIDs, w.ProviderID)
	}

	var providers []model.Provider
	if len(providerIDs) > 0 {
		repository.DB.Where("id IN ?", providerIDs).Find(&providers)
	}

	providerMap := make(map[uint64]model.Provider)
	for _, p := range providers {
		providerMap[p.ID] = p
	}

	// 组装返回数据
	list := make([]gin.H, len(withdraws))
	for i, w := range withdraws {
		provider := providerMap[w.ProviderID]
		list[i] = gin.H{
			"id":           w.ID,
			"providerId":   w.ProviderID,
			"providerName": provider.CompanyName,
			"orderNo":      w.OrderNo,
			"amount":       w.Amount,
			"bankAccount":  w.BankAccount,
			"bankName":     w.BankName,
			"status":       w.Status,
			"statusLabel":  getWithdrawStatusLabel(w.Status),
			"failReason":   w.FailReason,
			"completedAt":  w.CompletedAt,
			"createdAt":    w.CreatedAt,
		}
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

	// 查询商家信息
	var provider model.Provider
	repository.DB.First(&provider, withdraw.ProviderID)

	// 查询关联的收入记录
	var incomes []model.MerchantIncome
	repository.DB.Where("provider_id = ? AND status = 1", withdraw.ProviderID).
		Order("created_at DESC").
		Find(&incomes)

	response.Success(c, gin.H{
		"withdraw": gin.H{
			"id":          withdraw.ID,
			"orderNo":     withdraw.OrderNo,
			"amount":      withdraw.Amount,
			"bankAccount": withdraw.BankAccount,
			"bankName":    withdraw.BankName,
			"status":      withdraw.Status,
			"statusLabel": getWithdrawStatusLabel(withdraw.Status),
			"failReason":  withdraw.FailReason,
			"completedAt": withdraw.CompletedAt,
			"createdAt":   withdraw.CreatedAt,
		},
		"provider": gin.H{
			"id":           provider.ID,
			"companyName":  provider.CompanyName,
			"providerType": provider.ProviderType,
		},
		"incomes": incomes,
	})
}

// AdminWithdrawApprove 管理员审核通过提现
func AdminWithdrawApprove(c *gin.Context) {
	withdrawID := parseUint64(c.Param("id"))

	// 1. 验证提现记录存在且状态为待审核
	var withdraw model.MerchantWithdraw
	if err := repository.DB.First(&withdraw, withdrawID).Error; err != nil {
		response.Error(c, 404, "提现记录不存在")
		return
	}

	if withdraw.Status != 0 {
		response.Error(c, 400, "该提现申请已处理")
		return
	}

	// 2. 更新提现记录状态
	now := time.Now()
	withdraw.Status = 1 // 成功
	withdraw.CompletedAt = &now

	if err := repository.DB.Save(&withdraw).Error; err != nil {
		log.Printf("[AdminWithdrawApprove] Failed to update withdraw: %v", err)
		response.Error(c, 500, "审核失败")
		return
	}

	// 3. 更新关联的收入记录状态为已提现
	result := repository.DB.Model(&model.MerchantIncome{}).
		Where("provider_id = ? AND status = 1", withdraw.ProviderID).
		Updates(map[string]interface{}{
			"status":           2, // 已提现
			"withdraw_order_no": withdraw.OrderNo,
		})

	if result.Error != nil {
		log.Printf("[AdminWithdrawApprove] Failed to update income status: %v", result.Error)
		// 不回滚提现状态，继续处理
	}

	// 4. TODO: 调用银行API实际打款（暂时模拟）
	log.Printf("[AdminWithdrawApprove] TODO: Transfer %.2f to bank account %s",
		withdraw.Amount, withdraw.BankAccount)

	// 5. 发送通知给商家
	var provider model.Provider
	repository.DB.First(&provider, withdraw.ProviderID)

	notifService := &service.NotificationService{}
	if err := notifService.NotifyWithdrawApproved(&withdraw, provider.UserID); err != nil {
		log.Printf("[AdminWithdrawApprove] Failed to send notification: %v", err)
	}

	response.Success(c, gin.H{
		"message": "审核通过，提现成功",
	})
}

// AdminWithdrawReject 管理员审核拒绝提现
func AdminWithdrawReject(c *gin.Context) {
	withdrawID := parseUint64(c.Param("id"))

	var input struct {
		Reason string `json:"reason" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		response.Error(c, 400, "请输入拒绝原因")
		return
	}

	// 1. 验证提现记录存在且状态为待审核
	var withdraw model.MerchantWithdraw
	if err := repository.DB.First(&withdraw, withdrawID).Error; err != nil {
		response.Error(c, 404, "提现记录不存在")
		return
	}

	if withdraw.Status != 0 {
		response.Error(c, 400, "该提现申请已处理")
		return
	}

	// 2. 更新提现记录状态
	withdraw.Status = 2 // 失败
	withdraw.FailReason = input.Reason

	if err := repository.DB.Save(&withdraw).Error; err != nil {
		log.Printf("[AdminWithdrawReject] Failed to update withdraw: %v", err)
		response.Error(c, 500, "操作失败")
		return
	}

	// 3. 不修改MerchantIncome状态（退回已结算状态，商家可重新申请）

	// 4. 发送通知给商家
	var provider model.Provider
	repository.DB.First(&provider, withdraw.ProviderID)

	notifService := &service.NotificationService{}
	if err := notifService.NotifyWithdrawRejected(&withdraw, provider.UserID); err != nil {
		log.Printf("[AdminWithdrawReject] Failed to send notification: %v", err)
	}

	response.Success(c, gin.H{
		"message": "已拒绝该提现申请",
	})
}
