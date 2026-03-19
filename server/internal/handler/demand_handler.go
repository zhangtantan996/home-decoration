package handler

import (
	"strconv"

	"home-decoration-server/internal/service"
	"home-decoration-server/pkg/response"

	"github.com/gin-gonic/gin"
)

func parsePageParams(c *gin.Context) (int, int) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", c.DefaultQuery("page_size", "10")))
	return page, pageSize
}

func CreateDemand(c *gin.Context) {
	userID := c.GetUint64("userId")
	var input service.UpsertDemandInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, "参数错误: "+err.Error())
		return
	}
	demand, err := demandService.CreateDemand(userID, &input)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Success(c, demand)
}

func ListDemands(c *gin.Context) {
	userID := c.GetUint64("userId")
	page, pageSize := parsePageParams(c)
	items, total, err := demandService.ListUserDemands(userID, service.DemandListFilter{
		Status:   c.Query("status"),
		Page:     page,
		PageSize: pageSize,
	})
	if err != nil {
		response.ServerError(c, "获取需求列表失败")
		return
	}
	response.PageSuccess(c, items, total, page, pageSize)
}

func GetDemand(c *gin.Context) {
	userID := c.GetUint64("userId")
	demandID := parseUint64(c.Param("id"))
	detail, err := demandService.GetDemandDetailForUser(userID, demandID)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Success(c, detail)
}

func UpdateDemand(c *gin.Context) {
	userID := c.GetUint64("userId")
	demandID := parseUint64(c.Param("id"))
	var input service.UpsertDemandInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, "参数错误: "+err.Error())
		return
	}
	demand, err := demandService.UpdateDemand(userID, demandID, &input)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Success(c, demand)
}

func SubmitDemand(c *gin.Context) {
	userID := c.GetUint64("userId")
	demandID := parseUint64(c.Param("id"))
	demand, err := demandService.SubmitDemand(userID, demandID)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Success(c, gin.H{
		"id":     demand.ID,
		"status": demand.Status,
	})
}

func AdminListDemands(c *gin.Context) {
	page, pageSize := parsePageParams(c)
	items, total, err := demandService.ListAdminDemands(service.AdminDemandListFilter{
		Status:   c.Query("status"),
		Page:     page,
		PageSize: pageSize,
	})
	if err != nil {
		response.ServerError(c, "获取需求列表失败")
		return
	}
	response.PageSuccess(c, items, total, page, pageSize)
}

func AdminGetDemand(c *gin.Context) {
	demandID := parseUint64(c.Param("id"))
	detail, err := demandService.GetDemandDetailForAdmin(demandID)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Success(c, detail)
}

func AdminReviewDemand(c *gin.Context) {
	adminID := c.GetUint64("admin_id")
	demandID := parseUint64(c.Param("id"))
	var input service.ReviewDemandInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, "参数错误: "+err.Error())
		return
	}
	demand, err := demandService.ReviewDemand(adminID, demandID, &input)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Success(c, demand)
}

func AdminAssignDemand(c *gin.Context) {
	adminID := c.GetUint64("admin_id")
	demandID := parseUint64(c.Param("id"))
	var input service.AssignDemandInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, "参数错误: "+err.Error())
		return
	}
	matches, err := demandService.AssignDemand(adminID, demandID, &input)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Success(c, gin.H{
		"count":   len(matches),
		"matches": matches,
	})
}

func AdminListDemandCandidates(c *gin.Context) {
	demandID := parseUint64(c.Param("id"))
	page, pageSize := parsePageParams(c)
	items, total, err := demandService.ListDemandCandidates(demandID, page, pageSize)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.PageSuccess(c, items, total, page, pageSize)
}

func MerchantListLeads(c *gin.Context) {
	providerID := c.GetUint64("providerId")
	page, pageSize := parsePageParams(c)
	items, total, err := demandService.ListMerchantLeads(providerID, c.Query("status"), page, pageSize)
	if err != nil {
		response.ServerError(c, "获取线索列表失败")
		return
	}
	response.PageSuccess(c, items, total, page, pageSize)
}

func MerchantAcceptLead(c *gin.Context) {
	providerID := c.GetUint64("providerId")
	matchID := parseUint64(c.Param("id"))
	match, err := demandService.AcceptLead(providerID, matchID)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Success(c, gin.H{
		"id":     match.ID,
		"status": match.Status,
	})
}

func MerchantDeclineLead(c *gin.Context) {
	providerID := c.GetUint64("providerId")
	matchID := parseUint64(c.Param("id"))
	var input service.LeadActionInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, "参数错误: "+err.Error())
		return
	}
	match, err := demandService.DeclineLead(providerID, matchID, input.Reason)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Success(c, gin.H{
		"id":            match.ID,
		"status":        match.Status,
		"declineReason": match.DeclineReason,
	})
}
