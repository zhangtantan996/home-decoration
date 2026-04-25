package handler

import (
	"errors"
	"log"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	"home-decoration-server/internal/service"
	"home-decoration-server/pkg/response"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// AdminPayoutList 出款单列表
func AdminPayoutList(c *gin.Context) {
	var payouts []model.PayoutOrder
	query := repository.DB.Order("created_at DESC")

	// 筛选条件
	if channel := c.Query("channel"); channel != "" {
		query = query.Where("channel = ?", channel)
	}
	if status := c.Query("status"); status != "" {
		query = query.Where("status = ?", status)
	}
	if providerID := c.Query("providerId"); providerID != "" {
		query = query.Where("provider_id = ?", providerID)
	}

	// 分页
	page := parseIntDefault(c.Query("page"), 1)
	pageSize := parseIntDefault(c.Query("pageSize"), 20)
	offset := (page - 1) * pageSize

	var total int64
	query.Model(&model.PayoutOrder{}).Count(&total)
	query.Offset(offset).Limit(pageSize).Find(&payouts)

	// 查询商家信息
	providerIDs := make([]uint64, 0, len(payouts))
	for _, payout := range payouts {
		providerIDs = append(providerIDs, payout.ProviderID)
	}
	var providers []model.Provider
	if len(providerIDs) > 0 {
		repository.DB.Where("id IN ?", providerIDs).Find(&providers)
	}
	providerMap := make(map[uint64]model.Provider, len(providers))
	for _, provider := range providers {
		providerMap[provider.ID] = provider
	}

	// 序列化
	list := make([]gin.H, len(payouts))
	for i, payout := range payouts {
		provider := providerMap[payout.ProviderID]
		list[i] = serializePayoutOrder(payout, provider)
	}

	response.Success(c, gin.H{
		"list":     list,
		"total":    total,
		"page":     page,
		"pageSize": pageSize,
	})
}

// AdminPayoutDetail 出款单详情
func AdminPayoutDetail(c *gin.Context) {
	payoutID := parseUint64(c.Param("id"))

	var payout model.PayoutOrder
	if err := repository.DB.First(&payout, payoutID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			response.Error(c, 404, "出款单不存在")
			return
		}
		response.Error(c, 500, "查询失败")
		return
	}

	// 查询商家信息
	var provider model.Provider
	repository.DB.First(&provider, payout.ProviderID)

	response.Success(c, gin.H{
		"payout": serializePayoutOrderDetail(payout, provider),
	})
}

// AdminPayoutRetry 重试出款
func AdminPayoutRetry(c *gin.Context) {
	payoutID := parseUint64(c.Param("id"))
	adminID := c.GetUint64("admin_id")

	// 查询出款单
	var payout model.PayoutOrder
	if err := repository.DB.First(&payout, payoutID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			response.Error(c, 404, "出款单不存在")
			return
		}
		response.Error(c, 500, "查询失败")
		return
	}

	// 检查状态
	if payout.Status != model.PayoutStatusFailed {
		response.Error(c, 400, "只有失败的出款单可以重试")
		return
	}

	// 检查重试次数
	if payout.RetryCount >= 3 {
		response.Error(c, 400, "重试次数已达上限（3次），请转人工处理")
		return
	}

	// 执行重试
	payoutService := service.NewPayoutRoutingService()
	result, err := payoutService.RetryFailedPayout(payoutID)
	if err != nil {
		log.Printf("[AdminPayoutRetry] Retry failed for payout #%d: %v", payoutID, err)
		response.Error(c, 500, "重试失败: "+err.Error())
		return
	}

	// 记录审计日志
	auditService := &service.AuditLogService{}
	_ = auditService.CreateBusinessRecord(&service.CreateAuditRecordInput{
		OperatorType:  "admin",
		OperatorID:    adminID,
		OperationType: "retry_payout",
		ResourceType:  "payout_order",
		ResourceID:    payoutID,
		Result:        "success",
		Metadata: map[string]interface{}{
			"payoutId":   payoutID,
			"retryCount": result.RetryCount,
			"status":     result.Status,
		},
	})

	log.Printf("[AdminPayoutRetry] Payout #%d retry succeeded (retry count: %d)", payoutID, result.RetryCount)

	response.Success(c, gin.H{
		"message": "重试成功",
		"payout":  serializePayoutOrderDetail(*result, model.Provider{}),
	})
}

// serializePayoutOrder 序列化出款单（列表）
func serializePayoutOrder(payout model.PayoutOrder, provider model.Provider) gin.H {
	return gin.H{
		"id":               payout.ID,
		"bizType":          payout.BizType,
		"bizId":            payout.BizID,
		"providerId":       payout.ProviderID,
		"providerName":     provider.CompanyName,
		"channel":          payout.Channel,
		"channelText":      getPayoutChannelText(payout.Channel),
		"amount":           payout.Amount,
		"outPayoutNo":      payout.OutPayoutNo,
		"providerPayoutNo": payout.ProviderPayoutNo,
		"status":           payout.Status,
		"statusText":       getPayoutStatusText(payout.Status),
		"failureReason":    payout.FailureReason,
		"retryCount":       payout.RetryCount,
		"paidAt":           payout.PaidAt,
		"createdAt":        payout.CreatedAt,
	}
}

// serializePayoutOrderDetail 序列化出款单（详情）
func serializePayoutOrderDetail(payout model.PayoutOrder, provider model.Provider) gin.H {
	return gin.H{
		"id":               payout.ID,
		"bizType":          payout.BizType,
		"bizId":            payout.BizID,
		"providerId":       payout.ProviderID,
		"providerName":     provider.CompanyName,
		"channel":          payout.Channel,
		"channelText":      getPayoutChannelText(payout.Channel),
		"amount":           payout.Amount,
		"outPayoutNo":      payout.OutPayoutNo,
		"providerPayoutNo": payout.ProviderPayoutNo,
		"status":           payout.Status,
		"statusText":       getPayoutStatusText(payout.Status),
		"failureReason":    payout.FailureReason,
		"retryCount":       payout.RetryCount,
		"scheduledAt":      payout.ScheduledAt,
		"processingAt":     payout.ProcessingAt,
		"paidAt":           payout.PaidAt,
		"rawResponseJson":  payout.RawResponseJSON,
		"createdAt":        payout.CreatedAt,
		"updatedAt":        payout.UpdatedAt,
	}
}

// getPayoutChannelText 获取出款渠道文本
func getPayoutChannelText(channel string) string {
	switch channel {
	case model.PayoutChannelWechatBalance:
		return "微信企业付款"
	case model.PayoutChannelWechatBank:
		return "微信商家转账"
	case model.PayoutChannelBankTransfer:
		return "银行转账"
	case model.PayoutChannelCustody:
		return "托管账户"
	default:
		return "未知"
	}
}

// getPayoutStatusText 获取出款状态文本
func getPayoutStatusText(status string) string {
	switch status {
	case model.PayoutStatusCreated:
		return "已创建"
	case model.PayoutStatusProcessing:
		return "处理中"
	case model.PayoutStatusPaid:
		return "已出款"
	case model.PayoutStatusFailed:
		return "失败"
	default:
		return "未知"
	}
}
