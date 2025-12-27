package handler

import (
	"fmt"
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	"home-decoration-server/pkg/response"
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

	var admins []model.Admin
	var total int64

	db := repository.DB.Model(&model.Admin{})
	if keyword != "" {
		db = db.Where("username LIKE ? OR phone LIKE ?", "%"+keyword+"%", "%"+keyword+"%")
	}

	db.Count(&total)
	db.Offset((page - 1) * pageSize).Limit(pageSize).Order("id DESC").Find(&admins)

	response.Success(c, gin.H{
		"list":  admins,
		"total": total,
	})
}

// AdminCreateAdmin 创建管理员
func AdminCreateAdmin(c *gin.Context) {
	var req struct {
		Username string `json:"username" binding:"required"`
		Phone    string `json:"phone" binding:"required"`
		Email    string `json:"email"`
		Password string `json:"password" binding:"required,min=6"`
		Role     string `json:"role" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}

	// 检查用户名是否已存在
	var count int64
	repository.DB.Model(&model.Admin{}).Where("username = ? OR phone = ?", req.Username, req.Phone).Count(&count)
	if count > 0 {
		response.BadRequest(c, "用户名或手机号已存在")
		return
	}

	// 密码加密
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		response.ServerError(c, "密码加密失败")
		return
	}

	admin := model.Admin{
		Username: req.Username,
		Phone:    req.Phone,
		Email:    req.Email,
		Password: string(hashedPassword),
		Role:     req.Role,
		Status:   1,
	}

	if err := repository.DB.Create(&admin).Error; err != nil {
		response.ServerError(c, "创建失败")
		return
	}
	response.Success(c, admin)
}

// AdminUpdateAdmin 更新管理员
func AdminUpdateAdmin(c *gin.Context) {
	id := c.Param("id")
	var admin model.Admin
	if err := repository.DB.First(&admin, "id = ?", id).Error; err != nil {
		response.NotFound(c, "管理员不存在")
		return
	}

	var req struct {
		Username string `json:"username"`
		Phone    string `json:"phone"`
		Email    string `json:"email"`
		Role     string `json:"role"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}

	admin.Username = req.Username
	admin.Phone = req.Phone
	admin.Email = req.Email
	admin.Role = req.Role

	if err := repository.DB.Save(&admin).Error; err != nil {
		response.ServerError(c, "更新失败")
		return
	}
	response.Success(c, admin)
}

// AdminDeleteAdmin 删除管理员
func AdminDeleteAdmin(c *gin.Context) {
	id := c.Param("id")
	if err := repository.DB.Delete(&model.Admin{}, "id = ?", id).Error; err != nil {
		response.ServerError(c, "删除失败")
		return
	}
	response.Success(c, nil)
}

// AdminUpdateAdminStatus 更新管理员状态
func AdminUpdateAdminStatus(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		Status int8 `json:"status"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}

	if err := repository.DB.Model(&model.Admin{}).Where("id = ?", id).Update("status", req.Status).Error; err != nil {
		response.ServerError(c, "更新失败")
		return
	}
	response.Success(c, nil)
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
	transType := c.Query("type")

	var transactions []model.Transaction
	var total int64

	db := repository.DB.Model(&model.Transaction{})
	if transType != "" {
		db = db.Where("type = ?", transType)
	}

	db.Count(&total)
	db.Offset((page - 1) * pageSize).Limit(pageSize).Order("id DESC").Find(&transactions)

	response.Success(c, gin.H{
		"list":  transactions,
		"total": total,
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
	level := c.Query("level")

	var warnings []model.RiskWarning
	var total int64

	db := repository.DB.Model(&model.RiskWarning{})
	if level != "" {
		db = db.Where("level = ?", level)
	}

	db.Count(&total)
	db.Offset((page - 1) * pageSize).Limit(pageSize).Order("id DESC").Find(&warnings)

	response.Success(c, gin.H{
		"list":  warnings,
		"total": total,
	})
}

// AdminHandleRiskWarning 处理风险预警
func AdminHandleRiskWarning(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		Status int8   `json:"status" binding:"required"`
		Result string `json:"result" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}

	var warning model.RiskWarning
	if err := repository.DB.First(&warning, id).Error; err != nil {
		response.NotFound(c, "预警不存在")
		return
	}

	now := time.Now()
	warning.Status = req.Status
	warning.HandleResult = req.Result
	warning.HandledAt = &now

	if err := repository.DB.Save(&warning).Error; err != nil {
		response.ServerError(c, "处理失败")
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
		result[setting.Key] = setting.Value
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

	// ✅ 只更新存在的设置项，不允许创建新项
	for key, value := range req {
		var setting model.SystemSettings
		if err := repository.DB.Where("`key` = ?", key).First(&setting).Error; err != nil {
			// 设置项不存在，跳过
			continue
		}

		// ✅ 只更新value字段
		setting.Value = value
		repository.DB.Save(&setting)
	}

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

	response.Success(c, gin.H{
		"list":  logs,
		"total": total,
	})
}
