package handler

import (
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	"home-decoration-server/internal/service"
	"home-decoration-server/pkg/response"

	"github.com/gin-gonic/gin"
)

var adminVisibilityResolver = service.NewAdminVisibilityResolver()

func AdminListIdentityApplications(c *gin.Context) {
	page := parseInt(c.Query("page"), 1)
	pageSize := parseInt(c.Query("pageSize"), 20)

	var statusPtr *int8
	if rawStatus := c.Query("status"); rawStatus != "" {
		value := int8(parseInt(rawStatus, -1))
		if value >= 0 {
			statusPtr = &value
		}
	}

	items, total, err := identityService.ListIdentityApplications(statusPtr, page, pageSize)
	if err != nil {
		response.ServerError(c, "查询身份申请失败")
		return
	}

	response.Success(c, gin.H{
		"list":     items,
		"total":    total,
		"page":     page,
		"pageSize": pageSize,
	})
}

func AdminGetIdentityApplication(c *gin.Context) {
	applicationID := parseUint64(c.Param("id"))
	if applicationID == 0 {
		response.BadRequest(c, "ID无效")
		return
	}

	item, err := identityService.GetIdentityApplication(applicationID)
	if err != nil {
		response.NotFound(c, "申请不存在")
		return
	}

	var provider *model.Provider
	var providerRecord model.Provider
	if err := repository.DB.Where("user_id = ?", item.UserID).Order("id DESC").First(&providerRecord).Error; err == nil {
		provider = &providerRecord
	}

	var approvedMerchantCount int64
	repository.DB.Model(&model.MerchantApplication{}).Where("user_id = ? AND status = ?", item.UserID, 1).Count(&approvedMerchantCount)
	visibilityResult := adminVisibilityResolver.ResolveIdentityApplication(model.IdentityApplication{
		Base:         model.Base{ID: item.ID},
		UserID:       item.UserID,
		IdentityType: item.IdentityType,
		Status:       item.Status,
	}, provider, approvedMerchantCount > 0)

	detail := gin.H{
		"id":              item.ID,
		"userId":          item.UserID,
		"identityType":    item.IdentityType,
		"providerSubType": item.ProviderSubType,
		"status":          item.Status,
		"rejectReason":    item.RejectReason,
		"appliedAt":       item.AppliedAt,
		"reviewedAt":      item.ReviewedAt,
		"reviewedBy":      item.ReviewedBy,
		"merchantDetails": item.MerchantDetails,
		"visibility":      visibilityResult.Visibility,
		"actions":         visibilityResult.Actions,
	}
	if visibilityResult.LegacyInfo != nil {
		detail["legacyInfo"] = visibilityResult.LegacyInfo
	}

	response.Success(c, detail)
}

func AdminApproveIdentityApplication(c *gin.Context) {
	applicationID := parseUint64(c.Param("id"))
	if applicationID == 0 {
		response.BadRequest(c, "ID无效")
		return
	}

	adminID := c.GetUint64("admin_id")
	if adminID == 0 {
		response.Unauthorized(c, "未登录")
		return
	}

	if err := identityService.ApproveIdentityApplication(applicationID, adminID); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.SuccessWithMessage(c, "审核通过", nil)
}

func AdminRejectIdentityApplication(c *gin.Context) {
	applicationID := parseUint64(c.Param("id"))
	if applicationID == 0 {
		response.BadRequest(c, "ID无效")
		return
	}

	var req struct {
		Reason string `json:"reason" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}

	adminID := c.GetUint64("admin_id")
	if adminID == 0 {
		response.Unauthorized(c, "未登录")
		return
	}

	if err := identityService.RejectIdentityApplication(applicationID, adminID, req.Reason); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.SuccessWithMessage(c, "已驳回", nil)
}
