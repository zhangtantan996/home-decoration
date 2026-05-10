package handler

import (
	"strings"
	"time"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	"home-decoration-server/internal/service"
	"home-decoration-server/pkg/response"
	"home-decoration-server/pkg/utils"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// ==================== Admin 监理白名单管理 ====================

// AdminListSupervisorWhitelists 白名单列表
func AdminListSupervisorWhitelists(c *gin.Context) {
	page := parseInt(c.DefaultQuery("page", "1"), 1)
	pageSize := parseInt(c.DefaultQuery("pageSize", "10"), 10)
	keyword := strings.TrimSpace(c.Query("keyword"))
	status := c.Query("status")

	db := repository.DB.Model(&model.SupervisorPhoneWhitelist{})

	if keyword != "" {
		db = db.Where("phone LIKE ?", "%"+keyword+"%")
	}
	if status != "" {
		db = db.Where("status = ?", status)
	}

	var total int64
	if err := db.Session(&gorm.Session{}).Count(&total).Error; err != nil {
		response.ServerError(c, "加载失败")
		return
	}

	var list []model.SupervisorPhoneWhitelist
	if err := db.Order("id DESC").Offset((page - 1) * pageSize).Limit(pageSize).Find(&list).Error; err != nil {
		response.ServerError(c, "加载失败")
		return
	}

	if list == nil {
		list = make([]model.SupervisorPhoneWhitelist, 0)
	}
	for i := range list {
		list[i].Phone = maskPhoneValue(list[i].Phone)
	}

	response.Success(c, gin.H{"list": list, "total": total})
}

// AdminCreateSupervisorWhitelist 新增白名单
func AdminCreateSupervisorWhitelist(c *gin.Context) {
	adminID := c.GetUint64("adminId")

	var req struct {
		Phone     string     `json:"phone" binding:"required"`
		ExpiresAt *time.Time `json:"expiresAt"`
		Note      string     `json:"note"`
		Reason    string     `json:"reason"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}

	phone := strings.TrimSpace(req.Phone)
	if !utils.ValidatePhone(phone) {
		response.BadRequest(c, "手机号格式不正确")
		return
	}

	// 检查是否已存在
	var existing model.SupervisorPhoneWhitelist
	if err := repository.DB.Where("phone = ?", phone).First(&existing).Error; err == nil {
		response.BadRequest(c, "该手机号已在白名单中")
		return
	}

	whitelist := model.SupervisorPhoneWhitelist{
		Phone:            phone,
		Status:           1,
		ExpiresAt:        req.ExpiresAt,
		Note:             strings.TrimSpace(req.Note),
		CreatedByAdminID: adminID,
	}

	if err := repository.DB.Create(&whitelist).Error; err != nil {
		response.ServerError(c, "创建失败")
		return
	}

	reason := readAdminReason(c, req.Reason, "新增监理白名单")
	_ = (&service.AuditLogService{}).CreateBusinessRecord(&service.CreateAuditRecordInput{
		OperatorType:  "admin",
		OperatorID:    adminID,
		OperationType: "add_supervisor_whitelist",
		ResourceType:  "supervisor_phone_whitelist",
		ResourceID:    whitelist.ID,
		Reason:        reason,
		Result:        "success",
		AfterState: map[string]interface{}{
			"phone":     phone,
			"expiresAt": whitelist.ExpiresAt,
			"note":      whitelist.Note,
		},
		ClientIP:  c.ClientIP(),
		UserAgent: c.Request.UserAgent(),
	})

	response.Success(c, whitelist)
}

// AdminUpdateSupervisorWhitelistStatus 启用/禁用白名单
func AdminUpdateSupervisorWhitelistStatus(c *gin.Context) {
	adminID := c.GetUint64("adminId")
	id := parseUint64(c.Param("id"))
	if id == 0 {
		response.BadRequest(c, "无效ID")
		return
	}

	var req struct {
		Status *int8  `json:"status" binding:"required"`
		Reason string `json:"reason"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}
	if req.Status == nil {
		response.BadRequest(c, "状态值无效")
		return
	}
	if *req.Status != 0 && *req.Status != 1 {
		response.BadRequest(c, "状态值无效")
		return
	}

	var whitelist model.SupervisorPhoneWhitelist
	if err := repository.DB.First(&whitelist, id).Error; err != nil {
		response.NotFound(c, "白名单不存在")
		return
	}

	beforeStatus := whitelist.Status
	if err := repository.DB.Model(&whitelist).Update("status", *req.Status).Error; err != nil {
		response.ServerError(c, "更新失败")
		return
	}

	reason := readAdminReason(c, req.Reason, "更新监理白名单状态")
	_ = (&service.AuditLogService{}).CreateBusinessRecord(&service.CreateAuditRecordInput{
		OperatorType:  "admin",
		OperatorID:    adminID,
		OperationType: "update_supervisor_whitelist_status",
		ResourceType:  "supervisor_phone_whitelist",
		ResourceID:    whitelist.ID,
		Reason:        reason,
		Result:        "success",
		BeforeState:   map[string]interface{}{"status": beforeStatus},
		AfterState:    map[string]interface{}{"status": *req.Status, "phone": whitelist.Phone},
		ClientIP:      c.ClientIP(),
		UserAgent:     c.Request.UserAgent(),
	})

	response.Success(c, nil)
}
