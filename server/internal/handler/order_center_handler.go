package handler

import (
	"strconv"
	"strings"

	"home-decoration-server/internal/service"
	"home-decoration-server/pkg/response"

	"github.com/gin-gonic/gin"
)

func ListOrderCenterEntries(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "10"))

	items, total, err := orderCenterService.ListEntriesForUser(getCurrentUserID(c), service.OrderCenterQuery{
		StatusGroup: strings.TrimSpace(c.Query("statusGroup")),
		SourceKind:  strings.TrimSpace(c.Query("sourceKind")),
		Page:        page,
		PageSize:    pageSize,
	})
	if err != nil {
		respondScopedAccessError(c, err, "获取订单中心列表失败")
		return
	}

	response.PageSuccess(c, items, total, page, pageSize)
}

func GetOrderCenterEntry(c *gin.Context) {
	entryKey := strings.TrimSpace(c.Param("entryKey"))
	if entryKey == "" {
		response.BadRequest(c, "无效订单中心条目")
		return
	}

	result, err := orderCenterService.GetEntryDetailForUser(getCurrentUserID(c), entryKey)
	if err != nil {
		respondScopedAccessError(c, err, "获取订单中心详情失败")
		return
	}

	response.Success(c, result)
}

func StartOrderCenterEntryPayment(c *gin.Context) {
	entryKey := strings.TrimSpace(c.Param("entryKey"))
	if entryKey == "" {
		response.BadRequest(c, "无效订单中心条目")
		return
	}

	req, err := bindPaymentLaunchRequest(c)
	if err != nil {
		response.BadRequest(c, "支付参数错误")
		return
	}

	result, err := orderCenterService.StartEntryPaymentForUser(getCurrentUserID(c), entryKey, req.Channel, req.TerminalType)
	if err != nil {
		respondDomainMutationError(c, err, "发起支付失败")
		return
	}

	response.Success(c, result)
}
