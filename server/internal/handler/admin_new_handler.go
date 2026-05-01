package handler

import (
	"fmt"
	appconfig "home-decoration-server/internal/config"
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	"home-decoration-server/internal/service"
	"home-decoration-server/pkg/response"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

// ==================== 管理员管理 API ====================

// AdminListAdmins 管理员列表
func AdminListAdmins(c *gin.Context) {
	page := parseInt(c.Query("page"), 1)
	pageSize := parseInt(c.Query("pageSize"), 10)
	keyword := c.Query("keyword")

	var admins []model.SysAdmin
	var total int64

	db := repository.DB.Model(&model.SysAdmin{}).Preload("Roles")
	if keyword != "" {
		db = db.Where("username LIKE ? OR phone LIKE ? OR nickname LIKE ?", "%"+keyword+"%", "%"+keyword+"%", "%"+keyword+"%")
	}

	db.Count(&total)
	db.Offset((page - 1) * pageSize).Limit(pageSize).Order("id DESC").Find(&admins)

	securitySvc := service.NewAdminSecurityService()
	items := make([]gin.H, 0, len(admins))
	for i := range admins {
		sessionItems, _ := securitySvc.ListSessions(admins[i].ID, "")
		securityStatus := securitySvc.ResolveSecurityStatus(&admins[i])
		items = append(items, buildAdminListItem(&admins[i], securityStatus, len(sessionItems)))
	}

	response.Success(c, gin.H{
		"list":  items,
		"total": total,
	})
}

// AdminCreateAdmin 创建管理员
func AdminCreateAdmin(c *gin.Context) {
	operatorID := c.GetUint64("admin_id")
	var req struct {
		Username string   `json:"username" binding:"required"`
		Phone    string   `json:"phone"`
		Email    string   `json:"email"`
		Password string   `json:"password" binding:"required"`
		Nickname string   `json:"nickname"`
		RoleIDs  []uint64 `json:"roleIds" binding:"required"` // 角色ID列表
		Reason   string   `json:"reason"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误: "+err.Error())
		return
	}
	securitySvc := service.NewAdminSecurityService()
	if err := securitySvc.ValidatePasswordPolicy(req.Password); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	if _, err := service.ValidateAdminRoleAssignment(req.RoleIDs); err != nil {
		respondAdminRBACMutationError(c, err, "角色分配不合法")
		return
	}

	// 检查用户名是否已存在
	var count int64
	repository.DB.Model(&model.SysAdmin{}).Where("username = ?", req.Username).Count(&count)
	if count > 0 {
		response.BadRequest(c, "用户名已存在")
		return
	}

	// 检查手机号是否已存在(如果提供了)
	if req.Phone != "" {
		repository.DB.Model(&model.SysAdmin{}).Where("phone = ?", req.Phone).Count(&count)
		if count > 0 {
			response.BadRequest(c, "手机号已存在")
			return
		}
	}

	// 密码加密
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		response.ServerError(c, "密码加密失败")
		return
	}

	// 创建管理员
	admin := model.SysAdmin{
		Username:          req.Username,
		Phone:             req.Phone,
		Email:             req.Email,
		Password:          string(hashedPassword),
		Nickname:          req.Nickname,
		Status:            1,
		IsSuperAdmin:      false,
		MustResetPassword: true,
	}

	// 使用事务创建管理员并分配角色
	auditService := &service.AuditLogService{}
	tx := repository.DB.Begin()
	if err := tx.Create(&admin).Error; err != nil {
		tx.Rollback()
		response.ServerError(c, "创建失败: "+err.Error())
		return
	}

	// 分配角色
	for _, roleID := range req.RoleIDs {
		if err := tx.Create(&model.SysAdminRole{
			AdminID: admin.ID,
			RoleID:  roleID,
		}).Error; err != nil {
			tx.Rollback()
			response.ServerError(c, "分配角色失败")
			return
		}
	}

	roles, err := loadRolesByIDsTx(tx, req.RoleIDs)
	if err != nil {
		tx.Rollback()
		response.ServerError(c, "加载角色失败")
		return
	}
	admin.Roles = roles
	if err := auditService.CreateBusinessRecordTx(tx, &service.CreateAuditRecordInput{
		OperatorType:  "admin",
		OperatorID:    operatorID,
		OperationType: "create_admin",
		ResourceType:  "sys_admin",
		ResourceID:    admin.ID,
		Reason:        readAdminReason(c, req.Reason, "创建管理员账号"),
		Result:        "success",
		AfterState: map[string]interface{}{
			"admin": snapshotSysAdminForAudit(admin),
		},
	}); err != nil {
		tx.Rollback()
		response.ServerError(c, "创建失败")
		return
	}
	if err := tx.Commit().Error; err != nil {
		response.ServerError(c, "创建失败")
		return
	}

	// 加载角色信息返回
	repository.DB.Preload("Roles").First(&admin, admin.ID)
	response.Success(c, admin)
}

// AdminUpdateAdmin 更新管理员
func AdminUpdateAdmin(c *gin.Context) {
	id := parseUint64(c.Param("id"))
	operatorID := c.GetUint64("admin_id")
	var admin model.SysAdmin
	if err := repository.DB.Preload("Roles").First(&admin, "id = ?", id).Error; err != nil {
		response.NotFound(c, "管理员不存在")
		return
	}

	var req struct {
		Username string   `json:"username"`
		Phone    string   `json:"phone"`
		Email    string   `json:"email"`
		Nickname string   `json:"nickname"`
		Password string   `json:"password"` // 可选,如果提供则更新密码
		RoleIDs  []uint64 `json:"roleIds"`  // 角色ID列表
		Reason   string   `json:"reason"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}
	securitySvc := service.NewAdminSecurityService()
	if len(req.RoleIDs) > 0 {
		if _, err := service.ValidateAdminRoleAssignment(req.RoleIDs); err != nil {
			respondAdminRBACMutationError(c, err, "角色分配不合法")
			return
		}
	}
	existingAdmin := admin

	// 检查用户名是否被其他管理员占用
	if req.Username != "" && req.Username != admin.Username {
		var count int64
		repository.DB.Model(&model.SysAdmin{}).Where("username = ? AND id != ?", req.Username, id).Count(&count)
		if count > 0 {
			response.BadRequest(c, "用户名已被占用")
			return
		}
		admin.Username = req.Username
	}

	// 检查手机号是否被其他管理员占用
	if req.Phone != "" && req.Phone != admin.Phone {
		var count int64
		repository.DB.Model(&model.SysAdmin{}).Where("phone = ? AND id != ?", req.Phone, id).Count(&count)
		if count > 0 {
			response.BadRequest(c, "手机号已被占用")
			return
		}
		admin.Phone = req.Phone
	}

	// 更新基本信息
	if req.Email != "" {
		admin.Email = req.Email
	}
	if req.Nickname != "" {
		admin.Nickname = req.Nickname
	}

	// 如果提供了密码,则更新密码
	if req.Password != "" {
		if err := securitySvc.ValidatePasswordPolicy(req.Password); err != nil {
			response.BadRequest(c, err.Error())
			return
		}
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
		if err != nil {
			response.ServerError(c, "密码加密失败")
			return
		}
		admin.Password = string(hashedPassword)
		admin.MustResetPassword = true
		admin.PasswordChangedAt = nil
	}

	beforeState := map[string]interface{}{
		"admin": snapshotSysAdminForAudit(existingAdmin),
	}

	// 使用事务更新管理员信息和角色
	auditService := &service.AuditLogService{}
	tx := repository.DB.Begin()

	// 更新管理员基本信息
	if err := tx.Save(&admin).Error; err != nil {
		tx.Rollback()
		response.ServerError(c, "更新失败")
		return
	}

	// 如果提供了角色列表,则更新角色
	if len(req.RoleIDs) > 0 {
		// 删除旧角色关联
		tx.Where("admin_id = ?", id).Delete(&model.SysAdminRole{})

		// 创建新角色关联
		for _, roleID := range req.RoleIDs {
			if err := tx.Create(&model.SysAdminRole{
				AdminID: admin.ID,
				RoleID:  roleID,
			}).Error; err != nil {
				tx.Rollback()
				response.ServerError(c, "更新角色失败")
				return
			}
		}
	}

	updatedAdmin, err := loadAdminWithRolesTx(tx, admin.ID)
	if err != nil {
		tx.Rollback()
		response.ServerError(c, "更新失败")
		return
	}
	if err := auditService.CreateBusinessRecordTx(tx, &service.CreateAuditRecordInput{
		OperatorType:  "admin",
		OperatorID:    operatorID,
		OperationType: "update_admin",
		ResourceType:  "sys_admin",
		ResourceID:    admin.ID,
		Reason:        readAdminReason(c, req.Reason, "更新管理员账号"),
		Result:        "success",
		BeforeState:   beforeState,
		AfterState: map[string]interface{}{
			"admin": snapshotSysAdminForAudit(*updatedAdmin),
		},
		Metadata: map[string]interface{}{
			"passwordUpdated": req.Password != "",
		},
	}); err != nil {
		tx.Rollback()
		response.ServerError(c, "更新失败")
		return
	}
	if err := tx.Commit().Error; err != nil {
		response.ServerError(c, "更新失败")
		return
	}
	if req.Password != "" || len(req.RoleIDs) > 0 {
		_ = securitySvc.RevokeAllSessions(admin.ID)
	}

	// 重新加载角色信息返回
	repository.DB.Preload("Roles").First(&admin, admin.ID)
	response.Success(c, admin)
}

// AdminDeleteAdmin 删除管理员
func AdminDeleteAdmin(c *gin.Context) {
	id := parseUint64(c.Param("id"))
	operatorID := c.GetUint64("admin_id")

	// 检查管理员是否存在
	var admin model.SysAdmin
	if err := repository.DB.Preload("Roles").First(&admin, "id = ?", id).Error; err != nil {
		response.NotFound(c, "管理员不存在")
		return
	}

	// 防止删除超级管理员
	if admin.IsSuperAdmin {
		response.BadRequest(c, "不能删除超级管理员")
		return
	}
	if operatorID == admin.ID {
		response.BadRequest(c, "不能删除当前登录账号")
		return
	}

	// 使用事务删除管理员及其角色关联
	auditService := &service.AuditLogService{}
	tx := repository.DB.Begin()

	// 删除角色关联
	tx.Where("admin_id = ?", id).Delete(&model.SysAdminRole{})

	// 删除管理员
	if err := tx.Delete(&model.SysAdmin{}, "id = ?", id).Error; err != nil {
		tx.Rollback()
		response.ServerError(c, "删除失败")
		return
	}

	if err := auditService.CreateBusinessRecordTx(tx, &service.CreateAuditRecordInput{
		OperatorType:  "admin",
		OperatorID:    operatorID,
		OperationType: "delete_admin",
		ResourceType:  "sys_admin",
		ResourceID:    admin.ID,
		Reason:        readAdminReason(c, "", "删除管理员账号"),
		Result:        "success",
		BeforeState: map[string]interface{}{
			"admin": snapshotSysAdminForAudit(admin),
		},
		AfterState: map[string]interface{}{
			"deleted": true,
		},
	}); err != nil {
		tx.Rollback()
		response.ServerError(c, "删除失败")
		return
	}
	if err := tx.Commit().Error; err != nil {
		response.ServerError(c, "删除失败")
		return
	}
	_ = service.NewAdminSecurityService().RevokeAllSessions(admin.ID)
	response.Success(c, nil)
}

// AdminUpdateAdminStatus 更新管理员状态
func AdminUpdateAdminStatus(c *gin.Context) {
	id := parseUint64(c.Param("id"))
	operatorID := c.GetUint64("admin_id")
	var req struct {
		Status         int8   `json:"status"`
		Reason         string `json:"reason"`
		DisabledReason string `json:"disabledReason"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}

	// 检查管理员是否存在
	var admin model.SysAdmin
	if err := repository.DB.First(&admin, "id = ?", id).Error; err != nil {
		response.NotFound(c, "管理员不存在")
		return
	}

	// 防止禁用超级管理员
	if admin.IsSuperAdmin && req.Status == 0 {
		response.BadRequest(c, "不能禁用超级管理员")
		return
	}
	if operatorID == admin.ID && req.Status == 0 {
		response.BadRequest(c, "不能禁用当前登录账号")
		return
	}

	beforeState := map[string]interface{}{
		"admin": snapshotSysAdminForAudit(admin),
	}

	tx := repository.DB.Begin()
	updates := map[string]interface{}{
		"status": req.Status,
	}
	if req.Status == 0 {
		updates["disabled_reason"] = req.DisabledReason
	} else {
		updates["disabled_reason"] = ""
	}
	if err := tx.Model(&model.SysAdmin{}).Where("id = ?", id).Updates(updates).Error; err != nil {
		tx.Rollback()
		response.ServerError(c, "更新失败")
		return
	}
	admin.Status = req.Status
	admin.DisabledReason = req.DisabledReason
	if err := (&service.AuditLogService{}).CreateBusinessRecordTx(tx, &service.CreateAuditRecordInput{
		OperatorType:  "admin",
		OperatorID:    operatorID,
		OperationType: "update_admin_status",
		ResourceType:  "sys_admin",
		ResourceID:    admin.ID,
		Reason:        readAdminReason(c, req.Reason, "更新管理员状态"),
		Result:        "success",
		BeforeState:   beforeState,
		AfterState: map[string]interface{}{
			"admin": snapshotSysAdminForAudit(admin),
		},
	}); err != nil {
		tx.Rollback()
		response.ServerError(c, "更新失败")
		return
	}
	if err := tx.Commit().Error; err != nil {
		response.ServerError(c, "更新失败")
		return
	}
	_ = service.NewAdminSecurityService().RevokeAllSessions(admin.ID)
	response.Success(c, nil)
}

func buildAdminListItem(admin *model.SysAdmin, securityStatus service.AdminSecurityStatus, sessionCount int) gin.H {
	if admin == nil {
		return gin.H{}
	}
	return gin.H{
		"id":                admin.ID,
		"username":          admin.Username,
		"nickname":          admin.Nickname,
		"phone":             admin.Phone,
		"email":             admin.Email,
		"isSuperAdmin":      admin.IsSuperAdmin,
		"status":            admin.Status,
		"roles":             admin.Roles,
		"createdAt":         admin.CreatedAt,
		"updatedAt":         admin.UpdatedAt,
		"lastLoginAt":       admin.LastLoginAt,
		"lastLoginIp":       admin.LastLoginIP,
		"mustResetPassword": admin.MustResetPassword,
		"twoFactorEnabled":  admin.TwoFactorEnabled,
		"twoFactorBoundAt":  admin.TwoFactorBoundAt,
		"securityStatus":    securityStatus.LoginStage,
		"twoFactorRequired": securityStatus.TwoFactorRequired,
		"sessionCount":      sessionCount,
		"disabledReason":    admin.DisabledReason,
	}
}

// ==================== 审核管理 API ====================

// AdminListProviderAudits 服务商资质审核列表
func AdminListProviderAudits(c *gin.Context) {
	page := parseInt(c.Query("page"), 1)
	pageSize := parseInt(c.Query("pageSize"), 10)
	status := c.Query("status")

	var audits []model.ProviderAudit
	var total int64

	db := repository.DB.Model(&model.ProviderAudit{})
	if status != "" {
		db = db.Where("status = ?", status)
	}

	db.Count(&total)
	db.Offset((page - 1) * pageSize).Limit(pageSize).Order("id DESC").Find(&audits)

	response.Success(c, gin.H{
		"list":  audits,
		"total": total,
	})
}

// AdminListMaterialShopAudits 门店认证审核列表
func AdminListMaterialShopAudits(c *gin.Context) {
	page := parseInt(c.Query("page"), 1)
	pageSize := parseInt(c.Query("pageSize"), 10)
	status := c.Query("status")

	var audits []model.MaterialShopAudit
	var total int64

	db := repository.DB.Model(&model.MaterialShopAudit{})
	if status != "" {
		db = db.Where("status = ?", status)
	}

	db.Count(&total)
	db.Offset((page - 1) * pageSize).Limit(pageSize).Order("id DESC").Find(&audits)

	response.Success(c, gin.H{
		"list":  audits,
		"total": total,
	})
}

// AdminApproveAudit 审核通过
func AdminApproveAudit(c *gin.Context) {
	auditType := c.Param("type") // providers 或 material-shops
	id := c.Param("id")

	now := time.Now()

	if auditType == "providers" {
		audit := model.ProviderAudit{}
		if err := repository.DB.First(&audit, id).Error; err != nil {
			response.NotFound(c, "审核记录不存在")
			return
		}
		audit.Status = 1
		audit.AuditTime = &now
		repository.DB.Save(&audit)

		// 更新Provider的verified状态
		repository.DB.Model(&model.Provider{}).Where("id = ?", audit.ProviderID).Update("verified", true)

	} else if auditType == "material-shops" {
		audit := model.MaterialShopAudit{}
		if err := repository.DB.First(&audit, id).Error; err != nil {
			response.NotFound(c, "审核记录不存在")
			return
		}
		audit.Status = 1
		audit.AuditTime = &now
		repository.DB.Save(&audit)

		// 更新MaterialShop的is_verified状态
		repository.DB.Model(&model.MaterialShop{}).Where("id = ?", audit.ShopID).Update("is_verified", true)
	}

	response.Success(c, nil)
}

// AdminRejectAudit 审核拒绝
func AdminRejectAudit(c *gin.Context) {
	auditType := c.Param("type")
	id := c.Param("id")

	var req struct {
		Reason string `json:"reason" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请填写拒绝原因")
		return
	}

	now := time.Now()

	if auditType == "providers" {
		audit := model.ProviderAudit{}
		if err := repository.DB.First(&audit, id).Error; err != nil {
			response.NotFound(c, "审核记录不存在")
			return
		}
		audit.Status = 2
		audit.AuditTime = &now
		audit.RejectReason = req.Reason
		repository.DB.Save(&audit)

	} else if auditType == "material-shops" {
		audit := model.MaterialShopAudit{}
		if err := repository.DB.First(&audit, id).Error; err != nil {
			response.NotFound(c, "审核记录不存在")
			return
		}
		audit.Status = 2
		audit.AuditTime = &now
		audit.RejectReason = req.Reason
		repository.DB.Save(&audit)
	}

	response.Success(c, nil)
}

// ==================== 财务管理 API ====================

// AdminListEscrowAccounts 托管账户列表
func AdminListEscrowAccounts(c *gin.Context) {
	page := parseInt(c.Query("page"), 1)
	pageSize := parseInt(c.Query("pageSize"), 10)

	var accounts []model.EscrowAccount
	var total int64

	db := repository.DB.Model(&model.EscrowAccount{})
	db.Count(&total)
	db.Offset((page - 1) * pageSize).Limit(pageSize).Order("id DESC").Find(&accounts)

	response.Success(c, gin.H{
		"list":  accounts,
		"total": total,
	})
}

// AdminListTransactions 交易记录列表
func AdminListTransactions(c *gin.Context) {
	page := parseInt(c.Query("page"), 1)
	pageSize := parseInt(c.Query("pageSize"), 10)

	list, total, err := adminFinanceService.ListTransactions(service.AdminFinanceTransactionFilter{
		Type:      c.Query("type"),
		ProjectID: parseUint64(c.Query("projectId")),
		StartDate: c.Query("startDate"),
		EndDate:   c.Query("endDate"),
		Page:      page,
		PageSize:  pageSize,
	})
	if err != nil {
		response.ServerError(c, "获取交易流水失败")
		return
	}

	response.Success(c, gin.H{
		"list":     list,
		"total":    total,
		"page":     page,
		"pageSize": pageSize,
	})
}

// AdminWithdraw 账户提现
func AdminWithdraw(c *gin.Context) {
	accountId := c.Param("accountId")
	var req struct {
		Amount float64 `json:"amount" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}

	var account model.EscrowAccount
	if err := repository.DB.First(&account, accountId).Error; err != nil {
		response.NotFound(c, "账户不存在")
		return
	}

	if account.AvailableAmount < req.Amount {
		response.BadRequest(c, "余额不足")
		return
	}

	// 创建提现交易记录
	transaction := model.Transaction{
		OrderID:     fmt.Sprintf("WD%d%d", time.Now().Unix(), account.ID),
		EscrowID:    account.ID,
		Type:        "withdraw",
		Amount:      req.Amount,
		FromUserID:  account.UserID,
		FromAccount: "托管账户",
		ToUserID:    account.UserID,
		ToAccount:   "用户账户",
		Status:      1, // 直接标记为成功
		Remark:      "管理员操作提现",
	}
	now := time.Now()
	transaction.CompletedAt = &now

	if err := repository.DB.Create(&transaction).Error; err != nil {
		response.ServerError(c, "创建交易记录失败")
		return
	}

	// 更新账户余额
	account.AvailableAmount -= req.Amount
	repository.DB.Save(&account)

	response.Success(c, nil)
}

// ==================== 风险管理 API ====================

// AdminListRiskWarnings 风险预警列表
func AdminListRiskWarnings(c *gin.Context) {
	page := parseInt(c.Query("page"), 1)
	pageSize := parseInt(c.Query("pageSize"), 10)
	alertService := &service.SystemAlertService{}
	warnings, total, err := alertService.ListRiskWarnings(service.ListRiskWarningFilter{
		Page:     page,
		PageSize: pageSize,
		Level:    c.Query("level"),
		Type:     c.Query("type"),
		Status:   c.Query("status"),
	})
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Success(c, gin.H{
		"list":     warnings,
		"total":    total,
		"page":     page,
		"pageSize": pageSize,
	})
}

// AdminHandleRiskWarning 处理风险预警
func AdminHandleRiskWarning(c *gin.Context) {
	id := parseUint64(c.Param("id"))
	if id == 0 {
		response.BadRequest(c, "无效预警ID")
		return
	}
	adminID := c.GetUint64("admin_id")
	var req service.HandleRiskWarningInput
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}

	alertService := &service.SystemAlertService{}
	if _, err := alertService.HandleRiskWarning(id, adminID, &req); err != nil {
		respondDomainMutationError(c, err, "处理预警失败")
		return
	}

	response.Success(c, nil)
}

// AdminListArbitrations 仲裁列表
func AdminListArbitrations(c *gin.Context) {
	page := parseInt(c.Query("page"), 1)
	pageSize := parseInt(c.Query("pageSize"), 10)
	status := c.Query("status")

	var arbitrations []model.Arbitration
	var total int64

	db := repository.DB.Model(&model.Arbitration{})
	if status != "" {
		db = db.Where("status = ?", status)
	}

	db.Count(&total)
	db.Offset((page - 1) * pageSize).Limit(pageSize).Order("id DESC").Find(&arbitrations)

	response.Success(c, gin.H{
		"list":  arbitrations,
		"total": total,
	})
}

// AdminUpdateArbitration 更新仲裁
func AdminUpdateArbitration(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		Status int8   `json:"status" binding:"required"`
		Result string `json:"result" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}

	var arbitration model.Arbitration
	if err := repository.DB.First(&arbitration, id).Error; err != nil {
		response.NotFound(c, "仲裁不存在")
		return
	}

	arbitration.Status = req.Status
	arbitration.Result = req.Result

	if err := repository.DB.Save(&arbitration).Error; err != nil {
		response.ServerError(c, "更新失败")
		return
	}

	response.Success(c, nil)
}

// ==================== 系统设置 API ====================

// AdminGetSettings 获取系统设置
func AdminGetSettings(c *gin.Context) {
	var settings []model.SystemSettings
	repository.DB.Find(&settings)

	// 转换为 map 格式
	result := make(map[string]interface{})
	for _, setting := range settings {
		if service.IsSecretSettingKey(setting.Key) {
			continue
		}
		result[setting.Key] = setting.Value
	}
	cfg := appconfig.GetConfig()
	result["sms_runtime_ready"] = strings.TrimSpace(cfg.SMS.AccessKeyID) != "" && strings.TrimSpace(cfg.SMS.AccessKeySecret) != ""
	result["im_tencent_secret_ready"] = strings.TrimSpace(os.Getenv("TENCENT_IM_SECRET_KEY")) != ""
	configSvc := &service.ConfigService{}
	if value, err := configSvc.GetConfig(model.ConfigKeyTencentIMEnabled); err == nil {
		result["im_tencent_enabled"] = value
	}
	if value, err := configSvc.GetConfig(model.ConfigKeyTencentIMSDKAppID); err == nil {
		result["im_tencent_sdk_app_id"] = value
	}

	response.Success(c, result)
}

// AdminUpdateSettings 更新系统设置
func AdminUpdateSettings(c *gin.Context) {
	var req map[string]string
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}
	delete(req, "reason")
	delete(req, "remark")
	delete(req, "note")
	delete(req, "adminNotes")
	delete(req, "recentReauthProof")

	updatedKeys := make([]string, 0, len(req))
	configSvc := &service.ConfigService{}

	for key, value := range req {
		// ✅ 前端使用 im_tencent_* 格式，后端使用 im.tencent_* 格式，自动转换
		dbKey := key
		if len(key) > 3 && key[:3] == "im_" {
			dbKey = "im." + key[3:] // im_tencent_enabled -> im.tencent_enabled
		}
		if service.IsSecretSettingKey(key) || service.IsSecretSettingKey(dbKey) || service.IsSecretConfigKey(dbKey) {
			response.BadRequest(c, "密钥类配置由运行环境托管，后台不允许读取或写入")
			return
		}

		// 1. 尝试更新 system_settings 表（旧版通用设置）
		var setting model.SystemSettings
		if err := repository.DB.Where("\"key\" = ?", dbKey).First(&setting).Error; err == nil {
			setting.Value = value
			repository.DB.Save(&setting)
			continue
		}

		// 2. 尝试更新 system_configs 表（业务配置，包括腾讯云 IM）
		var config model.SystemConfig
		if err := repository.DB.Where("key = ?", dbKey).First(&config).Error; err == nil {
			if err := configSvc.SetConfig(dbKey, value, config.Description); err != nil {
				response.BadRequest(c, err.Error())
				return
			}
			continue
		}

		// 3. 如果两表都不存在，只允许注册过的 im.* 非密钥配置创建到 system_configs
		if len(dbKey) > 3 && dbKey[:3] == "im." {
			if err := configSvc.SetConfig(dbKey, value, ""); err != nil {
				response.BadRequest(c, err.Error())
				return
			}
		}
		updatedKeys = append(updatedKeys, dbKey)
	}

	_ = (&service.AuditLogService{}).CreateBusinessRecord(&service.CreateAuditRecordInput{
		OperatorType:  "admin",
		OperatorID:    c.GetUint64("admin_id"),
		OperationType: "update_settings",
		ResourceType:  "system_settings",
		ResourceID:    0,
		Reason:        readAdminReason(c, "更新系统设置"),
		Result:        "success",
		Metadata: map[string]interface{}{
			"keys": updatedKeys,
		},
	})

	response.Success(c, nil)
}

// ==================== 操作日志 API ====================

// AdminListLogs 操作日志列表
func AdminListLogs(c *gin.Context) {
	page := parseInt(c.Query("page"), 1)
	pageSize := parseInt(c.Query("pageSize"), 10)
	adminId := c.Query("adminId")
	action := c.Query("action")

	var logs []model.AdminLog
	var total int64

	db := repository.DB.Model(&model.AdminLog{})
	if adminId != "" {
		db = db.Where("admin_id = ?", adminId)
	}
	if action != "" {
		db = db.Where("action LIKE ?", "%"+action+"%")
	}

	db.Count(&total)
	db.Offset((page - 1) * pageSize).Limit(pageSize).Order("id DESC").Find(&logs)

	// 转换为前端需要的格式
	type LogResponse struct {
		ID         uint64 `json:"id"`
		AdminID    uint64 `json:"adminId"`
		AdminName  string `json:"adminName"`
		Action     string `json:"action"`
		TargetType string `json:"targetType"` // 映射自 resource
		TargetID   uint64 `json:"targetId"`   // 映射自 resource_id
		IP         string `json:"ip"`
		CreatedAt  string `json:"createdAt"`
	}

	var result []LogResponse
	for _, log := range logs {
		result = append(result, LogResponse{
			ID:         log.ID,
			AdminID:    log.AdminID,
			AdminName:  log.AdminName,
			Action:     log.Action,
			TargetType: log.Resource,
			TargetID:   log.ResourceID,
			IP:         log.IP,
			CreatedAt:  log.CreatedAt.Format("2006-01-02 15:04:05"),
		})
	}

	response.Success(c, gin.H{
		"list":  result,
		"total": total,
	})
}
