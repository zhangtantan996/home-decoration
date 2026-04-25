package handler

import (
	"errors"

	"home-decoration-server/internal/service"
	"home-decoration-server/pkg/response"

	"github.com/gin-gonic/gin"
)

var changeOrderService = &service.ChangeOrderService{}

func ListProjectChangeOrders(c *gin.Context) {
	projectID := parseUint64(c.Param("id"))
	if projectID == 0 {
		response.BadRequest(c, "无效项目ID")
		return
	}
	items, err := changeOrderService.ListForOwner(projectID, getCurrentUserID(c))
	if err != nil {
		respondScopedAccessError(c, err, "获取变更单失败")
		return
	}
	response.Success(c, gin.H{"list": items})
}

func ConfirmChangeOrder(c *gin.Context) {
	changeOrderID := parseUint64(c.Param("id"))
	if changeOrderID == 0 {
		response.BadRequest(c, "无效变更单ID")
		return
	}
	item, err := changeOrderService.ConfirmByOwner(changeOrderID, getCurrentUserID(c))
	if err != nil {
		respondDomainMutationError(c, err, "确认变更单失败")
		return
	}
	response.SuccessWithMessage(c, "变更单已确认", gin.H{"changeOrder": item})
}

func RejectChangeOrder(c *gin.Context) {
	changeOrderID := parseUint64(c.Param("id"))
	if changeOrderID == 0 {
		response.BadRequest(c, "无效变更单ID")
		return
	}
	var req service.ChangeOrderDecisionInput
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}
	item, err := changeOrderService.RejectByOwner(changeOrderID, getCurrentUserID(c), &req)
	if err != nil {
		respondDomainMutationError(c, err, "拒绝变更单失败")
		return
	}
	response.SuccessWithMessage(c, "已拒绝变更单", gin.H{"changeOrder": item})
}

func MerchantListProjectChangeOrders(c *gin.Context) {
	projectID := parseUint64(c.Param("projectId"))
	if projectID == 0 {
		response.BadRequest(c, "无效项目ID")
		return
	}
	items, err := changeOrderService.ListForProvider(projectID, c.GetUint64("providerId"))
	if err != nil {
		respondScopedAccessError(c, err, "获取变更单失败")
		return
	}
	response.Success(c, gin.H{"list": items})
}

func MerchantCreateProjectChangeOrder(c *gin.Context) {
	projectID := parseUint64(c.Param("projectId"))
	if projectID == 0 {
		response.BadRequest(c, "无效项目ID")
		return
	}
	var req service.ChangeOrderCreateInput
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}
	if _, err := changeOrderService.ListForProvider(projectID, c.GetUint64("providerId")); err != nil {
		respondScopedAccessError(c, err, "创建变更单失败")
		return
	}
	respondDomainMutationError(c, errors.New("当前阶段未开放商家端变更单操作"), "创建变更单失败")
}

func MerchantCancelChangeOrder(c *gin.Context) {
	changeOrderID := parseUint64(c.Param("id"))
	if changeOrderID == 0 {
		response.BadRequest(c, "无效变更单ID")
		return
	}
	var req service.ChangeOrderDecisionInput
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}
	item, err := changeOrderService.CancelByProvider(changeOrderID, c.GetUint64("providerId"), &req)
	if err != nil {
		respondDomainMutationError(c, err, "取消变更单失败")
		return
	}
	response.SuccessWithMessage(c, "变更单已取消", gin.H{"changeOrder": item})
}

func AdminListProjectChangeOrders(c *gin.Context) {
	projectID := parseUint64(c.Param("id"))
	if projectID == 0 {
		response.BadRequest(c, "无效项目ID")
		return
	}
	items, err := changeOrderService.ListForAdmin(projectID)
	if err != nil {
		respondScopedAccessError(c, err, "获取变更单失败")
		return
	}
	response.Success(c, gin.H{"list": items})
}

func AdminCreateProjectChangeOrder(c *gin.Context) {
	projectID := parseUint64(c.Param("id"))
	if projectID == 0 {
		response.BadRequest(c, "无效项目ID")
		return
	}
	var req service.ChangeOrderCreateInput
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}
	adminID := c.GetUint64("adminId")
	item, err := changeOrderService.CreateByAdmin(projectID, adminID, &req)
	if err != nil {
		respondDomainMutationError(c, err, "创建变更单失败")
		return
	}
	response.SuccessWithMessage(c, "变更单已创建", gin.H{"changeOrder": item})
}

func AdminSettleChangeOrder(c *gin.Context) {
	changeOrderID := parseUint64(c.Param("id"))
	if changeOrderID == 0 {
		response.BadRequest(c, "无效变更单ID")
		return
	}
	var req service.ChangeOrderSettleInput
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}
	item, err := changeOrderService.SettleByAdmin(changeOrderID, c.GetUint64("adminId"), &req)
	if err != nil {
		respondDomainMutationError(c, err, "变更单结算失败")
		return
	}
	response.SuccessWithMessage(c, "变更单已结算", gin.H{"changeOrder": item})
}
