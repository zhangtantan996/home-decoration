package handler

import (
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	"home-decoration-server/pkg/response"
	"log"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

// PendingPaymentItem 待付款项
type PendingPaymentItem struct {
	Type         string     `json:"type"`         // intent_fee, design_fee, construction_fee
	ID           uint64     `json:"id"`           // Booking ID 或 Order ID
	OrderNo      string     `json:"orderNo"`      // 订单号
	Amount       float64    `json:"amount"`       // 金额
	ProviderID   uint64     `json:"providerId"`   // 服务商ID
	ProviderName string     `json:"providerName"` // 服务商名称
	Address      string     `json:"address"`      // 地址（仅意向金）
	ExpireAt     *time.Time `json:"expireAt"`     // 过期时间
	CreatedAt    time.Time  `json:"createdAt"`    // 创建时间
}

// ListOrders 获取用户订单列表
func ListOrders(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "10"))

	var status *int8
	if raw := c.Query("status"); raw != "" {
		parsed, err := strconv.ParseInt(raw, 10, 8)
		if err != nil {
			response.BadRequest(c, "无效订单状态")
			return
		}
		value := int8(parsed)
		status = &value
	}

	items, total, err := orderService.ListOrdersForUser(c.GetUint64("userId"), status, page, pageSize)
	if err != nil {
		response.ServerError(c, err.Error())
		return
	}

	response.PageSuccess(c, items, total, page, pageSize)
}

// ListPendingPayments 获取所有待付款项（含意向金+设计费订单）
func ListPendingPayments(c *gin.Context) {
	userID := c.GetUint64("userId")

	var items []PendingPaymentItem

	// 1. 查询未付意向金的 Booking
	var bookings []model.Booking
	if err := repository.DB.Where("user_id = ? AND intent_fee_paid = ? AND status != ?", userID, false, 4).
		Order("created_at DESC").
		Find(&bookings).Error; err == nil {

		for _, b := range bookings {
			// 获取服务商信息
			var provider model.Provider
			var providerName string
			if repository.DB.First(&provider, b.ProviderID).Error == nil {
				var user model.User
				if repository.DB.First(&user, provider.UserID).Error == nil {
					providerName = user.Nickname
					if providerName == "" && provider.CompanyName != "" {
						providerName = provider.CompanyName
					}
				}
			}

			items = append(items, PendingPaymentItem{
				Type:         "intent_fee",
				ID:           b.ID,
				OrderNo:      "BK" + padOrderNo(b.ID),
				Amount:       b.IntentFee,
				ProviderID:   b.ProviderID,
				ProviderName: providerName,
				Address:      b.Address,
				ExpireAt:     nil, // 意向金无过期时间
				CreatedAt:    b.CreatedAt,
			})
		}
	}

	// 2. 查询未付设计费的 Order
	// 首先获取用户所有的 Booking IDs
	var userBookingIDs []uint64
	repository.DB.Model(&model.Booking{}).Where("user_id = ?", userID).Pluck("id", &userBookingIDs)
	log.Printf("[DEBUG] User %d has %d bookings: %v", userID, len(userBookingIDs), userBookingIDs)

	if len(userBookingIDs) > 0 {
		// 获取这些 Booking 关联的 Proposal IDs
		var proposalIDs []uint64
		repository.DB.Model(&model.Proposal{}).Where("booking_id IN ?", userBookingIDs).Pluck("id", &proposalIDs)
		log.Printf("[DEBUG] Found %d proposals: %v", len(proposalIDs), proposalIDs)

		if len(proposalIDs) > 0 {
			// 查询这些 Proposal 关联的未付设计费订单
			var orders []model.Order
			if err := repository.DB.Where("proposal_id IN ? AND status = ? AND order_type = ?",
				proposalIDs, model.OrderStatusPending, model.OrderTypeDesign).
				Order("created_at DESC").
				Find(&orders).Error; err == nil {

				log.Printf("[DEBUG] Found %d pending design orders", len(orders))

				// 也查一下所有的 Order（不管状态）看看数据
				var allOrders []model.Order
				repository.DB.Where("proposal_id IN ?", proposalIDs).Find(&allOrders)
				for _, o := range allOrders {
					log.Printf("[DEBUG] Order ID=%d, ProposalID=%d, Status=%d, Type=%s", o.ID, o.ProposalID, o.Status, o.OrderType)
				}

				for _, o := range orders {
					// 获取服务商信息（通过 Proposal -> Booking）
					var providerName string
					var providerID uint64

					var proposal model.Proposal
					if repository.DB.First(&proposal, o.ProposalID).Error == nil {
						var booking model.Booking
						if repository.DB.First(&booking, proposal.BookingID).Error == nil {
							providerID = booking.ProviderID
							var provider model.Provider
							if repository.DB.First(&provider, booking.ProviderID).Error == nil {
								var user model.User
								if repository.DB.First(&user, provider.UserID).Error == nil {
									providerName = user.Nickname
									if providerName == "" && provider.CompanyName != "" {
										providerName = provider.CompanyName
									}
								}
							}
						}
					}

					items = append(items, PendingPaymentItem{
						Type:         "design_fee",
						ID:           o.ID,
						OrderNo:      o.OrderNo,
						Amount:       o.TotalAmount - o.Discount,
						ProviderID:   providerID,
						ProviderName: providerName,
						ExpireAt:     o.ExpireAt,
						CreatedAt:    o.CreatedAt,
					})
				}
			}
		}
	}

	response.Success(c, gin.H{
		"items": items,
		"total": len(items),
	})
}

// padOrderNo 补齐订单号为8位
func padOrderNo(id uint64) string {
	s := ""
	for i := 0; i < 8; i++ {
		s = string('0'+byte(id%10)) + s
		id /= 10
	}
	return s
}

// GetOrder 获取订单详情
func GetOrder(c *gin.Context) {
	orderID := c.Param("id")
	userID := c.GetUint64("userId")

	var order model.Order
	if err := repository.DB.Where("id = ?", orderID).First(&order).Error; err != nil {
		response.NotFound(c, "订单不存在")
		return
	}

	// 权限验证：通过 Proposal -> Booking -> UserID
	var proposal model.Proposal
	if err := repository.DB.First(&proposal, order.ProposalID).Error; err != nil {
		response.ServerError(c, "关联方案数据异常")
		return
	}

	var booking model.Booking
	if err := repository.DB.First(&booking, proposal.BookingID).Error; err != nil {
		response.ServerError(c, "关联预约数据异常")
		return
	}

	if booking.UserID != userID {
		response.Forbidden(c, "无权查看此订单")
		return
	}

	if order.Status == model.OrderStatusPending {
		if _, syncErr := paymentService.SyncLatestPendingBizPayment(model.PaymentBizTypeOrder, order.ID); syncErr == nil {
			_ = repository.DB.First(&order, order.ID).Error
		}
	}

	response.Success(c, order)
}

// GetOrderPaymentPlans 获取订单分期计划
func GetOrderPaymentPlans(c *gin.Context) {
	orderID := parseUint64(c.Param("id"))
	if orderID == 0 {
		response.BadRequest(c, "无效订单ID")
		return
	}

	userID := getCurrentUserID(c)
	plans, err := orderService.GetPaymentPlansForUser(userID, orderID)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Success(c, gin.H{"plans": plans})
}
