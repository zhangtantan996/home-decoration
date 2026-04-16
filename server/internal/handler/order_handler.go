package handler

import (
	"fmt"
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	"home-decoration-server/internal/service"
	"home-decoration-server/pkg/response"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

// PendingPaymentItem 待付款项
type PendingPaymentItem struct {
	Type         string     `json:"type"`         // intent_fee, design_fee, construction_fee, material_fee
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

	entries, total, err := orderCenterService.ListEntriesForUser(getCurrentUserID(c), service.OrderCenterQuery{
		StatusGroup: legacyOrderStatusGroup(status),
		EntryKind:   service.OrderCenterEntryKindPayable,
		Page:        page,
		PageSize:    pageSize,
	})
	if err != nil {
		response.ServerError(c, err.Error())
		return
	}

	items := make([]service.UserOrderListItem, 0, len(entries))
	for _, entry := range entries {
		items = append(items, legacyOrderListItemFromEntry(entry))
	}

	response.PageSuccess(c, items, total, page, pageSize)
}

// ListPendingPayments 获取所有待付款项（含量房费+设计费订单）
func ListPendingPayments(c *gin.Context) {
	entries, _, err := orderCenterService.ListEntriesForUser(getCurrentUserID(c), service.OrderCenterQuery{
		StatusGroup: service.OrderCenterStatusPendingPayment,
		EntryKind:   service.OrderCenterEntryKindPayable,
		Page:        1,
		PageSize:    200,
	})
	if err != nil {
		response.ServerError(c, err.Error())
		return
	}

	items := make([]PendingPaymentItem, 0, len(entries))
	for _, entry := range entries {
		items = append(items, legacyPendingPaymentItemFromEntry(entry))
	}

	response.Success(c, gin.H{
		"items": items,
		"total": len(items),
	})
}

func legacyOrderStatusGroup(status *int8) string {
	if status == nil {
		return ""
	}
	switch *status {
	case model.OrderStatusPending:
		return service.OrderCenterStatusPendingPayment
	case model.OrderStatusPaid:
		return service.OrderCenterStatusPaid
	case model.OrderStatusCancelled:
		return service.OrderCenterStatusCancelled
	case model.OrderStatusRefunded:
		return service.OrderCenterStatusRefund
	default:
		return ""
	}
}

func legacyOrderStatusFromEntry(entry service.OrderCenterEntrySummary) int8 {
	switch entry.StatusGroup {
	case service.OrderCenterStatusPendingPayment:
		return model.OrderStatusPending
	case service.OrderCenterStatusPaid:
		return model.OrderStatusPaid
	case service.OrderCenterStatusCancelled:
		return model.OrderStatusCancelled
	case service.OrderCenterStatusRefund:
		return model.OrderStatusRefunded
	default:
		return model.OrderStatusPending
	}
}

func legacyOrderTypeFromEntry(entry service.OrderCenterEntrySummary) string {
	switch entry.SourceKind {
	case service.OrderCenterSourceSurveyDeposit:
		return "survey_deposit"
	case service.OrderCenterSourceDesignOrder:
		return model.OrderTypeDesign
	case service.OrderCenterSourceConstruction:
		return model.OrderTypeConstruction
	case service.OrderCenterSourceMaterial:
		return model.OrderTypeMaterial
	default:
		return ""
	}
}

func legacyOrderListItemFromEntry(entry service.OrderCenterEntrySummary) service.UserOrderListItem {
	item := service.UserOrderListItem{
		ID:            legacyPrimaryID(entry),
		RecordType:    "order",
		OrderNo:       entry.ReferenceNo,
		OrderType:     legacyOrderTypeFromEntry(entry),
		Status:        legacyOrderStatusFromEntry(entry),
		Amount:        entry.Amount,
		TotalAmount:   entry.Amount,
		PaidAmount:    normalizeLegacyPaidAmount(entry),
		Discount:      normalizeLegacyDiscount(entry),
		CreatedAt:     entry.CreatedAt,
		ProviderName:  entryProviderName(entry.Provider),
		Address:       entryBookingAddress(entry.Booking, entry.Project),
		NextPayableAt: entry.ExpireAt,
		ActionPath:    legacyActionPath(entry),
	}
	if entry.SourceKind == service.OrderCenterSourceSurveyDeposit {
		item.RecordType = "payment"
		item.BookingID = legacyPrimaryID(entry)
		item.ProposalID = entryBookingProposalID(entry.Booking)
		if entry.StatusGroup == service.OrderCenterStatusPaid {
			item.PaidAt = entryBookingPaidAt(entry.Booking)
		}
		return item
	}
	item.ProjectID = entryProjectID(entry.Project)
	item.BookingID = entryBookingID(entry.Booking)
	item.ProposalID = entryBookingProposalID(entry.Booking)
	return item
}

func legacyPendingPaymentItemFromEntry(entry service.OrderCenterEntrySummary) PendingPaymentItem {
	return PendingPaymentItem{
		Type:         legacyPendingPaymentType(entry.SourceKind),
		ID:           legacyPrimaryID(entry),
		OrderNo:      entry.ReferenceNo,
		Amount:       payableAmountFromEntry(entry),
		ProviderID:   entryProviderID(entry.Provider),
		ProviderName: entryProviderName(entry.Provider),
		Address:      entryBookingAddress(entry.Booking, entry.Project),
		ExpireAt:     entry.ExpireAt,
		CreatedAt:    legacyCreatedAt(entry.CreatedAt),
	}
}

func legacyPendingPaymentType(sourceKind string) string {
	switch sourceKind {
	case service.OrderCenterSourceSurveyDeposit:
		return "intent_fee"
	case service.OrderCenterSourceDesignOrder:
		return "design_fee"
	case service.OrderCenterSourceMaterial:
		return "material_fee"
	default:
		return "construction_fee"
	}
}

func legacyPrimaryID(entry service.OrderCenterEntrySummary) uint64 {
	if entry.SourceKind == service.OrderCenterSourceSurveyDeposit {
		return entryBookingID(entry.Booking)
	}
	return parseUint64FromEntryKey(entry.EntryKey)
}

func entryProviderID(provider *service.OrderCenterProviderSummary) uint64 {
	if provider == nil {
		return 0
	}
	return provider.ID
}

func entryProviderName(provider *service.OrderCenterProviderSummary) string {
	if provider == nil {
		return ""
	}
	return provider.Name
}

func entryProjectID(project *service.OrderCenterProjectSummary) uint64 {
	if project == nil {
		return 0
	}
	return project.ID
}

func entryBookingID(booking *service.OrderCenterBookingSummary) uint64 {
	if booking == nil {
		return 0
	}
	return booking.ID
}

func entryBookingProposalID(booking *service.OrderCenterBookingSummary) uint64 {
	if booking == nil {
		return 0
	}
	return booking.ProposalID
}

func entryBookingAddress(booking *service.OrderCenterBookingSummary, project *service.OrderCenterProjectSummary) string {
	if booking != nil && booking.Address != "" {
		return booking.Address
	}
	if project != nil {
		return project.Address
	}
	return ""
}

func entryBookingPaidAt(booking *service.OrderCenterBookingSummary) *time.Time {
	if booking == nil || booking.SurveyDepositPaidAt == nil {
		return nil
	}
	paidAt := *booking.SurveyDepositPaidAt
	return &paidAt
}

func payableAmountFromEntry(entry service.OrderCenterEntrySummary) float64 {
	if entry.PayableAmount > 0 {
		return entry.PayableAmount
	}
	return entry.Amount
}

func legacyCreatedAt(createdAt *time.Time) time.Time {
	if createdAt != nil {
		return *createdAt
	}
	return time.Time{}
}

func parseUint64FromEntryKey(entryKey string) uint64 {
	for i := len(entryKey) - 1; i >= 0; i-- {
		if entryKey[i] == ':' {
			value, _ := strconv.ParseUint(entryKey[i+1:], 10, 64)
			return value
		}
	}
	return 0
}

func normalizeLegacyPaidAmount(entry service.OrderCenterEntrySummary) float64 {
	if entry.StatusGroup == service.OrderCenterStatusPaid || entry.StatusGroup == service.OrderCenterStatusRefund {
		return entry.Amount
	}
	return 0
}

func normalizeLegacyDiscount(entry service.OrderCenterEntrySummary) float64 {
	return 0
}

func legacyActionPath(entry service.OrderCenterEntrySummary) string {
	if entry.SourceKind == service.OrderCenterSourceSurveyDeposit {
		if bookingID := entryBookingID(entry.Booking); bookingID > 0 {
			return fmt.Sprintf("/bookings/%d", bookingID)
		}
		return ""
	}
	if entry.SourceKind == service.OrderCenterSourceDesignOrder {
		bookingID := entryBookingID(entry.Booking)
		if bookingID == 0 {
			return ""
		}
		if entry.StatusGroup == service.OrderCenterStatusPendingPayment {
			return fmt.Sprintf("/bookings/%d/design-quote", bookingID)
		}
		if entryBookingProposalID(entry.Booking) > 0 {
			return fmt.Sprintf("/proposals/%d", entryBookingProposalID(entry.Booking))
		}
		return fmt.Sprintf("/bookings/%d", bookingID)
	}
	return ""
}

// GetOrder 获取订单详情
func GetOrder(c *gin.Context) {
	orderID := parseUint64(c.Param("id"))
	if orderID == 0 {
		response.BadRequest(c, "无效订单ID")
		return
	}

	order, err := orderService.GetOrderForUser(c.GetUint64("userId"), orderID)
	if err != nil {
		respondScopedAccessError(c, err, "获取订单失败")
		return
	}

	if order.Status == model.OrderStatusPending {
		if _, syncErr := paymentService.SyncLatestPendingBizPayment(model.PaymentBizTypeOrder, order.ID); syncErr == nil {
			_ = repository.DB.First(order, order.ID).Error
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
