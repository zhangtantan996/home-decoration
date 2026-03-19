package handler

import (
	"home-decoration-server/internal/service"
	"home-decoration-server/pkg/response"

	"github.com/gin-gonic/gin"
)

var complaintService = &service.ComplaintService{}

func CreateComplaint(c *gin.Context) {
	userID := c.GetUint64("userId")
	var input service.CreateComplaintInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, "参数错误: "+err.Error())
		return
	}
	item, err := complaintService.CreateComplaint(userID, &input)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Success(c, item)
}

func ListComplaints(c *gin.Context) {
	userID := c.GetUint64("userId")
	items, err := complaintService.ListUserComplaints(userID)
	if err != nil {
		response.ServerError(c, "获取投诉列表失败")
		return
	}
	response.Success(c, items)
}

func GetComplaint(c *gin.Context) {
	userID := c.GetUint64("userId")
	complaintID := parseUint64(c.Param("id"))
	item, err := complaintService.GetUserComplaint(userID, complaintID)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Success(c, item)
}

func AdminListComplaints(c *gin.Context) {
	items, err := complaintService.ListAdminComplaints()
	if err != nil {
		response.ServerError(c, "获取投诉列表失败")
		return
	}
	response.Success(c, items)
}

func AdminResolveComplaint(c *gin.Context) {
	adminID := c.GetUint64("admin_id")
	complaintID := parseUint64(c.Param("id"))
	var input struct {
		Resolution    string `json:"resolution"`
		FreezePayment bool   `json:"freezePayment"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, "参数错误: "+err.Error())
		return
	}
	item, err := complaintService.ResolveComplaint(adminID, complaintID, input.Resolution, input.FreezePayment)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Success(c, item)
}

func MerchantListComplaints(c *gin.Context) {
	providerID := c.GetUint64("providerId")
	items, err := complaintService.ListMerchantComplaints(providerID)
	if err != nil {
		response.ServerError(c, "获取投诉列表失败")
		return
	}
	response.Success(c, items)
}

func MerchantRespondComplaint(c *gin.Context) {
	providerID := c.GetUint64("providerId")
	complaintID := parseUint64(c.Param("id"))
	var input struct {
		Response string `json:"response"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, "参数错误: "+err.Error())
		return
	}
	item, err := complaintService.RespondComplaint(providerID, complaintID, input.Response)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Success(c, item)
}
