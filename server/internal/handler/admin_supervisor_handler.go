package handler

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"home-decoration-server/internal/middleware"
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	"home-decoration-server/internal/service"
	"home-decoration-server/pkg/response"
	"home-decoration-server/pkg/utils"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// ==================== Admin 监理管理 ====================

type adminSupervisorListRow struct {
	model.SupervisorProfile
	AssignmentCount     int64      `json:"assignmentCount"`
	SupervisorAccountID *uint64    `json:"supervisorAccountId,omitempty"`
	AccountStatus       string     `json:"accountStatus"`
	ProfileStatus       string     `json:"profileStatus"`
	LastLoginAt         *time.Time `json:"lastLoginAt,omitempty"`
	LastLoginIP         string     `json:"lastLoginIp,omitempty"`
	ActiveSessionCount  int        `json:"activeSessionCount"`
}

// AdminListSupervisors 监理列表
func AdminListSupervisors(c *gin.Context) {
	page := parseInt(c.DefaultQuery("page", "1"), 1)
	pageSize := parseInt(c.DefaultQuery("pageSize", "10"), 10)
	keyword := strings.TrimSpace(c.Query("keyword"))
	status := c.Query("status")
	cityCode := strings.TrimSpace(c.Query("cityCode"))

	db := repository.DB.Model(&model.SupervisorProfile{})

	if keyword != "" {
		db = db.Where("supervisor_profiles.real_name LIKE ? OR supervisor_profiles.phone LIKE ?", "%"+keyword+"%", "%"+keyword+"%")
	}
	if status != "" {
		db = db.Joins("LEFT JOIN supervisor_accounts ON supervisor_accounts.id = supervisor_profiles.supervisor_account_id").
			Where("supervisor_accounts.status = ?", status)
	}
	if cityCode != "" {
		db = db.Where("supervisor_profiles.city_code = ?", cityCode)
	}

	var total int64
	if err := db.Session(&gorm.Session{}).Count(&total).Error; err != nil {
		response.ServerError(c, "加载失败")
		return
	}

	var profiles []model.SupervisorProfile
	if err := db.Order("supervisor_profiles.id DESC").Offset((page - 1) * pageSize).Limit(pageSize).Find(&profiles).Error; err != nil {
		response.ServerError(c, "加载失败")
		return
	}

	if len(profiles) == 0 {
		response.Success(c, gin.H{"list": make([]adminSupervisorListRow, 0), "total": total})
		return
	}

	supervisorIDs := make([]uint64, len(profiles))
	for i, p := range profiles {
		supervisorIDs[i] = p.ID
	}

	// 统计每个监理的分配项目数
	type assignmentCount struct {
		SupervisorID uint64
		Count        int64
	}
	var counts []assignmentCount
	repository.DB.Model(&model.ProjectSupervisorAssignment{}).
		Select("supervisor_id, COUNT(*) as count").
		Where("supervisor_id IN ? AND status = 1", supervisorIDs).
		Group("supervisor_id").
		Find(&counts)

	countMap := make(map[uint64]int64, len(counts))
	for _, c := range counts {
		countMap[c.SupervisorID] = c.Count
	}

	accountIDs := make([]uint64, 0, len(profiles))
	for _, p := range profiles {
		if p.SupervisorAccountID != nil && *p.SupervisorAccountID > 0 {
			accountIDs = append(accountIDs, *p.SupervisorAccountID)
		}
	}
	accountMap := make(map[uint64]model.SupervisorAccount, len(accountIDs))
	if len(accountIDs) > 0 {
		var accounts []model.SupervisorAccount
		repository.DB.Where("id IN ?", accountIDs).Find(&accounts)
		for _, account := range accounts {
			accountMap[account.ID] = account
		}
	}

	list := make([]adminSupervisorListRow, len(profiles))
	for i, p := range profiles {
		p.Phone = maskPhoneValue(p.Phone)
		row := adminSupervisorListRow{
			SupervisorProfile:   p,
			SupervisorAccountID: p.SupervisorAccountID,
			AssignmentCount:     countMap[p.ID],
			ProfileStatus:       supervisorStatusLabel(p.Status),
			AccountStatus:       "unbound",
		}
		if p.SupervisorAccountID != nil {
			if account, ok := accountMap[*p.SupervisorAccountID]; ok {
				row.AccountStatus = supervisorStatusLabel(account.Status)
				row.LastLoginAt = account.LastLoginAt
				row.LastLoginIP = account.LastLoginIP
				row.ActiveSessionCount = service.CountSupervisorActiveSessions(account.ID)
			}
		}
		list[i] = row
	}

	response.Success(c, gin.H{"list": list, "total": total})
}

// AdminGetSupervisor 监理详情
func AdminGetSupervisor(c *gin.Context) {
	id := parseUint64(c.Param("id"))
	if id == 0 {
		response.BadRequest(c, "无效ID")
		return
	}

	var profile model.SupervisorProfile
	if err := repository.DB.First(&profile, id).Error; err != nil {
		response.NotFound(c, "监理不存在")
		return
	}
	profile.Phone = visiblePhoneForAdmin(c, profile.Phone)

	response.Success(c, profile)
}

// AdminCreateSupervisor 手动创建监理（兼容入口；新主链仍会创建 supervisor_account）
func AdminCreateSupervisor(c *gin.Context) {
	adminID := c.GetUint64("adminId")
	var req struct {
		Phone          string `json:"phone" binding:"required"`
		RealName       string `json:"realName" binding:"required"`
		CityCode       string `json:"cityCode"`
		ServiceArea    string `json:"serviceArea"`
		Certifications string `json:"certifications"`
		Reason         string `json:"reason"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}

	phone := strings.TrimSpace(req.Phone)
	realName := strings.TrimSpace(req.RealName)
	if !utils.ValidatePhone(phone) {
		response.BadRequest(c, "手机号格式不正确")
		return
	}
	if realName == "" {
		response.BadRequest(c, "姓名不能为空")
		return
	}

	tx := repository.DB.Begin()

	var existingProfile model.SupervisorProfile
	if err := tx.Where("phone = ?", phone).First(&existingProfile).Error; err == nil {
		tx.Rollback()
		response.BadRequest(c, "该手机号已是监理")
		return
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		tx.Rollback()
		response.ServerError(c, "校验监理资料失败")
		return
	}

	compatUser, err := findOrCreateSupervisorCompatibilityUser(tx, phone, realName)
	if err != nil {
		tx.Rollback()
		response.ServerError(c, "创建兼容用户失败")
		return
	}

	var account model.SupervisorAccount
	if err := tx.Where("phone = ?", phone).First(&account).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			account = model.SupervisorAccount{Phone: phone, Status: 1}
			if err := tx.Create(&account).Error; err != nil {
				tx.Rollback()
				response.ServerError(c, "创建监理账号失败")
				return
			}
		} else {
			tx.Rollback()
			response.ServerError(c, "校验监理账号失败")
			return
		}
	} else if account.Status != 1 {
		if err := tx.Model(&account).Updates(map[string]interface{}{
			"status":             1,
			"login_failed_count": 0,
			"locked_until":       nil,
		}).Error; err != nil {
			tx.Rollback()
			response.ServerError(c, "激活监理账号失败")
			return
		}
		account.Status = 1
	}

	profile := model.SupervisorProfile{
		UserID:              compatUser.ID,
		SupervisorAccountID: &account.ID,
		RealName:            realName,
		Phone:               phone,
		CityCode:            strings.TrimSpace(req.CityCode),
		ServiceArea:         strings.TrimSpace(req.ServiceArea),
		Certifications:      strings.TrimSpace(req.Certifications),
		Status:              1,
		Verified:            true,
	}
	if err := tx.Create(&profile).Error; err != nil {
		tx.Rollback()
		response.ServerError(c, "创建监理资料失败")
		return
	}

	// 创建监理身份
	identity := model.UserIdentity{
		UserID:        compatUser.ID,
		IdentityType:  "supervisor",
		Status:        1,
		IdentityRefID: &profile.ID,
	}
	if err := tx.Create(&identity).Error; err != nil {
		tx.Rollback()
		response.ServerError(c, "创建监理身份失败")
		return
	}

	if err := tx.Commit().Error; err != nil {
		response.ServerError(c, "创建失败")
		return
	}

	reason := readAdminReason(c, req.Reason, "手动创建监理账号")
	_ = (&service.AuditLogService{}).CreateBusinessRecord(&service.CreateAuditRecordInput{
		OperatorType:  "admin",
		OperatorID:    adminID,
		OperationType: "create_supervisor",
		ResourceType:  "supervisor_profile",
		ResourceID:    profile.ID,
		Reason:        reason,
		Result:        "success",
		AfterState: map[string]interface{}{
			"phone":     phone,
			"accountId": account.ID,
		},
		ClientIP:  c.ClientIP(),
		UserAgent: c.Request.UserAgent(),
	})

	response.Success(c, adminSupervisorListRow{
		SupervisorProfile:   profile,
		SupervisorAccountID: &account.ID,
		AccountStatus:       supervisorStatusLabel(account.Status),
		ProfileStatus:       supervisorStatusLabel(profile.Status),
	})
}

// AdminUpdateSupervisor 更新监理资料
func AdminUpdateSupervisor(c *gin.Context) {
	adminID := c.GetUint64("adminId")
	id := parseUint64(c.Param("id"))
	if id == 0 {
		response.BadRequest(c, "无效ID")
		return
	}

	var req struct {
		RealName       string `json:"realName"`
		CityCode       string `json:"cityCode"`
		ServiceArea    string `json:"serviceArea"`
		Certifications string `json:"certifications"`
		Reason         string `json:"reason"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}

	updates := map[string]interface{}{}
	if v := strings.TrimSpace(req.RealName); v != "" {
		updates["real_name"] = v
	}
	if v := strings.TrimSpace(req.CityCode); v != "" {
		updates["city_code"] = v
	}
	if v := strings.TrimSpace(req.ServiceArea); v != "" {
		updates["service_area"] = v
	}
	if v := strings.TrimSpace(req.Certifications); v != "" {
		updates["certifications"] = v
	}

	if len(updates) == 0 {
		response.BadRequest(c, "无更新内容")
		return
	}

	if err := repository.DB.Model(&model.SupervisorProfile{}).Where("id = ?", id).Updates(updates).Error; err != nil {
		response.ServerError(c, "更新失败")
		return
	}

	reason := readAdminReason(c, req.Reason, "更新监理资料")
	_ = (&service.AuditLogService{}).CreateBusinessRecord(&service.CreateAuditRecordInput{
		OperatorType:  "admin",
		OperatorID:    adminID,
		OperationType: "update_supervisor_profile",
		ResourceType:  "supervisor_profile",
		ResourceID:    id,
		Reason:        reason,
		Result:        "success",
		AfterState:    updates,
		ClientIP:      c.ClientIP(),
		UserAgent:     c.Request.UserAgent(),
	})

	response.Success(c, nil)
}

// AdminUpdateSupervisorStatus 更新监理状态
func AdminUpdateSupervisorStatus(c *gin.Context) {
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
	if req.Status == nil || (*req.Status != 0 && *req.Status != 1) {
		response.BadRequest(c, "状态值无效")
		return
	}
	statusVal := *req.Status

	tx := repository.DB.Begin()

	var profile model.SupervisorProfile
	if err := tx.First(&profile, id).Error; err != nil {
		tx.Rollback()
		response.NotFound(c, "监理不存在")
		return
	}
	beforeProfileStatus := profile.Status

	if err := tx.Model(&profile).Update("status", statusVal).Error; err != nil {
		tx.Rollback()
		response.ServerError(c, "更新失败")
		return
	}

	beforeAccountStatus := int8(-1)
	if profile.SupervisorAccountID != nil && *profile.SupervisorAccountID > 0 {
		var account model.SupervisorAccount
		if err := tx.First(&account, *profile.SupervisorAccountID).Error; err != nil {
			tx.Rollback()
			response.ServerError(c, "监理账号不存在")
			return
		}
		beforeAccountStatus = account.Status
		if err := tx.Model(&account).Update("status", statusVal).Error; err != nil {
			tx.Rollback()
			response.ServerError(c, "更新监理账号失败")
			return
		}
		if statusVal == 0 {
			_ = service.RevokeAllSupervisorSessions(account.ID)
		}
	}

	if err := tx.Commit().Error; err != nil {
		response.ServerError(c, "更新失败")
		return
	}

	reason := readAdminReason(c, req.Reason, "更新监理状态")
	_ = (&service.AuditLogService{}).CreateBusinessRecord(&service.CreateAuditRecordInput{
		OperatorType:  "admin",
		OperatorID:    adminID,
		OperationType: "update_supervisor_status",
		ResourceType:  "supervisor_profile",
		ResourceID:    profile.ID,
		Reason:        reason,
		Result:        "success",
		BeforeState: map[string]interface{}{
			"profileStatus": beforeProfileStatus,
			"accountStatus": beforeAccountStatus,
		},
		AfterState: map[string]interface{}{
			"profileStatus": statusVal,
			"accountStatus": statusVal,
		},
		ClientIP:  c.ClientIP(),
		UserAgent: c.Request.UserAgent(),
	})

	response.Success(c, nil)
}

// AdminDeleteSupervisor 停用监理（兼容旧删除入口，不硬删账号/资料）
func AdminDeleteSupervisor(c *gin.Context) {
	adminID := c.GetUint64("adminId")
	id := parseUint64(c.Param("id"))
	if id == 0 {
		response.BadRequest(c, "无效ID")
		return
	}

	tx := repository.DB.Begin()

	var profile model.SupervisorProfile
	if err := tx.First(&profile, id).Error; err != nil {
		tx.Rollback()
		response.NotFound(c, "监理不存在")
		return
	}

	beforeProfileStatus := profile.Status
	if err := tx.Model(&profile).Update("status", 0).Error; err != nil {
		tx.Rollback()
		response.ServerError(c, "停用监理资料失败")
		return
	}

	if err := tx.Model(&model.UserIdentity{}).
		Where("user_id = ? AND identity_type = ? AND identity_ref_id = ?", profile.UserID, "supervisor", profile.ID).
		Update("status", 0).Error; err != nil {
		tx.Rollback()
		response.ServerError(c, "停用监理身份失败")
		return
	}

	if err := tx.Model(&model.ProjectSupervisorAssignment{}).Where("supervisor_id = ?", id).Update("status", 0).Error; err != nil {
		tx.Rollback()
		response.ServerError(c, "移除分配记录失败")
		return
	}

	accountID := uint64(0)
	beforeAccountStatus := int8(-1)
	if profile.SupervisorAccountID != nil && *profile.SupervisorAccountID > 0 {
		var account model.SupervisorAccount
		if err := tx.First(&account, *profile.SupervisorAccountID).Error; err != nil {
			tx.Rollback()
			response.ServerError(c, "监理账号不存在")
			return
		}
		accountID = account.ID
		beforeAccountStatus = account.Status
		if err := tx.Model(&account).Update("status", 0).Error; err != nil {
			tx.Rollback()
			response.ServerError(c, "停用监理账号失败")
			return
		}
	}

	if err := tx.Commit().Error; err != nil {
		response.ServerError(c, "停用失败")
		return
	}

	if accountID > 0 {
		_ = service.RevokeAllSupervisorSessions(accountID)
	}

	reason := readAdminReason(c, "停用监理账号")
	_ = (&service.AuditLogService{}).CreateBusinessRecord(&service.CreateAuditRecordInput{
		OperatorType:  "admin",
		OperatorID:    adminID,
		OperationType: "disable_supervisor",
		ResourceType:  "supervisor_profile",
		ResourceID:    profile.ID,
		Reason:        reason,
		Result:        "success",
		BeforeState: map[string]interface{}{
			"profileStatus": beforeProfileStatus,
			"accountStatus": beforeAccountStatus,
		},
		AfterState: map[string]interface{}{
			"profileStatus": int8(0),
			"accountStatus": int8(0),
		},
		ClientIP:  c.ClientIP(),
		UserAgent: c.Request.UserAgent(),
	})

	response.Success(c, nil)
}

// AdminListAvailableSupervisors 获取可分配监理列表
func AdminListAvailableSupervisors(c *gin.Context) {
	projectID := parseUint64(c.Query("projectId"))
	cityCode := strings.TrimSpace(c.Query("cityCode"))

	// 已分配到该项目的监理ID
	var assignedIDs []uint64
	if projectID > 0 {
		repository.DB.Model(&model.ProjectSupervisorAssignment{}).
			Where("project_id = ? AND status = 1", projectID).
			Pluck("supervisor_id", &assignedIDs)
	}

	db := repository.DB.Model(&model.SupervisorProfile{}).
		Joins("JOIN supervisor_accounts ON supervisor_accounts.id = supervisor_profiles.supervisor_account_id").
		Where("supervisor_profiles.status = 1 AND supervisor_accounts.status = 1")
	if cityCode != "" {
		db = db.Where("city_code = ?", cityCode)
	}
	if len(assignedIDs) > 0 {
		db = db.Where("id NOT IN ?", assignedIDs)
	}

	var profiles []model.SupervisorProfile
	if err := db.Order("supervisor_profiles.id DESC").Find(&profiles).Error; err != nil {
		response.ServerError(c, "加载失败")
		return
	}

	if len(profiles) == 0 {
		response.Success(c, gin.H{"list": make([]model.SupervisorProfile, 0), "total": 0})
		return
	}
	for i := range profiles {
		profiles[i].Phone = maskPhoneValue(profiles[i].Phone)
	}

	response.Success(c, gin.H{"list": profiles, "total": len(profiles)})
}

// ==================== Admin 监理分配管理 ====================

// AdminListSupervisorAssignments 监理分配列表
func AdminListSupervisorAssignments(c *gin.Context) {
	page := parseInt(c.DefaultQuery("page", "1"), 1)
	pageSize := parseInt(c.DefaultQuery("pageSize", "10"), 10)
	supervisorID := parseUint64(c.Query("supervisorId"))
	projectID := parseUint64(c.Query("projectId"))

	db := repository.DB.Model(&model.ProjectSupervisorAssignment{})

	if supervisorID > 0 {
		db = db.Where("supervisor_id = ?", supervisorID)
	}
	if projectID > 0 {
		db = db.Where("project_id = ?", projectID)
	}

	var total int64
	if err := db.Session(&gorm.Session{}).Count(&total).Error; err != nil {
		response.ServerError(c, "加载失败")
		return
	}

	var assignments []model.ProjectSupervisorAssignment
	if err := db.Order("id DESC").Offset((page - 1) * pageSize).Limit(pageSize).Find(&assignments).Error; err != nil {
		response.ServerError(c, "加载失败")
		return
	}

	if len(assignments) == 0 {
		response.Success(c, gin.H{"list": make([]map[string]interface{}, 0), "total": total})
		return
	}

	supervisorIDs := make([]uint64, len(assignments))
	projectIDs := make([]uint64, len(assignments))
	for i, a := range assignments {
		supervisorIDs[i] = a.SupervisorID
		projectIDs[i] = a.ProjectID
	}

	supervisorMap := make(map[uint64]model.SupervisorProfile)
	if len(supervisorIDs) > 0 {
		var supervisors []model.SupervisorProfile
		repository.DB.Where("id IN ?", supervisorIDs).Find(&supervisors)
		for _, s := range supervisors {
			supervisorMap[s.ID] = s
		}
	}

	projectMap := make(map[uint64]model.Project)
	if len(projectIDs) > 0 {
		var projects []model.Project
		repository.DB.Select("id, name").Where("id IN ?", projectIDs).Find(&projects)
		for _, p := range projects {
			projectMap[p.ID] = p
		}
	}

	type assignmentRow struct {
		model.ProjectSupervisorAssignment
		ProjectName     string `json:"projectName"`
		SupervisorName  string `json:"supervisorName"`
		SupervisorPhone string `json:"supervisorPhone"`
	}

	list := make([]assignmentRow, len(assignments))
	for i, a := range assignments {
		row := assignmentRow{ProjectSupervisorAssignment: a}
		if s, ok := supervisorMap[a.SupervisorID]; ok {
			row.SupervisorName = s.RealName
			row.SupervisorPhone = maskPhoneValue(s.Phone)
		}
		if p, ok := projectMap[a.ProjectID]; ok {
			row.ProjectName = p.Name
		}
		list[i] = row
	}

	response.Success(c, gin.H{"list": list, "total": total})
}

// AdminCreateSupervisorAssignment 创建监理分配
func AdminCreateSupervisorAssignment(c *gin.Context) {
	var req struct {
		ProjectID    uint64 `json:"projectId" binding:"required"`
		SupervisorID uint64 `json:"supervisorId" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}

	var project model.Project
	if err := repository.DB.Select("id").First(&project, req.ProjectID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			response.NotFound(c, "项目不存在")
			return
		}
		response.ServerError(c, "校验项目失败")
		return
	}

	var supervisor model.SupervisorProfile
	if err := repository.DB.First(&supervisor, req.SupervisorID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			response.NotFound(c, "监理不存在")
			return
		}
		response.ServerError(c, "校验监理失败")
		return
	}
	if supervisor.Status != 1 {
		response.BadRequest(c, "监理资料已禁用，不能分配")
		return
	}
	if supervisor.SupervisorAccountID == nil || *supervisor.SupervisorAccountID == 0 {
		response.BadRequest(c, "监理尚未绑定登录账号，不能分配")
		return
	}
	var account model.SupervisorAccount
	if err := repository.DB.First(&account, *supervisor.SupervisorAccountID).Error; err != nil {
		response.BadRequest(c, "监理账号不存在，不能分配")
		return
	}
	if account.Status != 1 {
		response.BadRequest(c, "监理账号已禁用，不能分配")
		return
	}

	// 检查是否已分配；软删除记录要复活，避免撞历史唯一索引。
	var existing model.ProjectSupervisorAssignment
	if err := repository.DB.Where("project_id = ? AND supervisor_id = ?", req.ProjectID, req.SupervisorID).First(&existing).Error; err == nil {
		if existing.Status == 1 {
			response.BadRequest(c, "该监理已分配到该项目")
			return
		}
		assignedAt := time.Now()
		beforeState := map[string]interface{}{
			"projectId":    existing.ProjectID,
			"supervisorId": existing.SupervisorID,
			"status":       existing.Status,
			"assignedBy":   existing.AssignedBy,
			"assignedAt":   existing.AssignedAt,
		}
		if err := repository.DB.Model(&existing).Updates(map[string]interface{}{
			"status":      int8(1),
			"assigned_by": c.GetUint64("adminId"),
			"assigned_at": assignedAt,
		}).Error; err != nil {
			response.ServerError(c, "分配失败")
			return
		}
		existing.Status = 1
		existing.AssignedBy = c.GetUint64("adminId")
		existing.AssignedAt = assignedAt
		_ = (&service.AuditLogService{}).CreateBusinessRecord(&service.CreateAuditRecordInput{
			OperatorType:  "admin",
			OperatorID:    c.GetUint64("adminId"),
			OperationType: "assign_supervisor",
			ResourceType:  "project_supervisor_assignment",
			ResourceID:    existing.ID,
			Reason:        readAdminReason(c, "分配监理"),
			Result:        "success",
			BeforeState:   beforeState,
			AfterState: map[string]interface{}{
				"projectId":    existing.ProjectID,
				"supervisorId": existing.SupervisorID,
				"status":       existing.Status,
				"assignedBy":   existing.AssignedBy,
				"assignedAt":   existing.AssignedAt,
			},
			ClientIP:  c.ClientIP(),
			UserAgent: c.Request.UserAgent(),
		})
		response.Success(c, existing)
		return
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		response.ServerError(c, "校验失败")
		return
	}

	assignment := model.ProjectSupervisorAssignment{
		ProjectID:    req.ProjectID,
		SupervisorID: req.SupervisorID,
		AssignedBy:   c.GetUint64("adminId"),
		Status:       1,
		AssignedAt:   time.Now(),
	}
	if err := repository.DB.Create(&assignment).Error; err != nil {
		response.ServerError(c, "分配失败")
		return
	}
	_ = (&service.AuditLogService{}).CreateBusinessRecord(&service.CreateAuditRecordInput{
		OperatorType:  "admin",
		OperatorID:    c.GetUint64("adminId"),
		OperationType: "assign_supervisor",
		ResourceType:  "project_supervisor_assignment",
		ResourceID:    assignment.ID,
		Reason:        readAdminReason(c, "分配监理"),
		Result:        "success",
		AfterState: map[string]interface{}{
			"projectId":    assignment.ProjectID,
			"supervisorId": assignment.SupervisorID,
			"status":       assignment.Status,
			"assignedBy":   assignment.AssignedBy,
			"assignedAt":   assignment.AssignedAt,
		},
		ClientIP:  c.ClientIP(),
		UserAgent: c.Request.UserAgent(),
	})

	response.Success(c, assignment)
}

// AdminDeleteSupervisorAssignment 移除监理分配
func AdminDeleteSupervisorAssignment(c *gin.Context) {
	id := parseUint64(c.Param("id"))
	if id == 0 {
		response.BadRequest(c, "无效ID")
		return
	}

	var assignment model.ProjectSupervisorAssignment
	if err := repository.DB.First(&assignment, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			response.NotFound(c, "分配记录不存在")
			return
		}
		response.ServerError(c, "移除失败")
		return
	}
	beforeState := map[string]interface{}{
		"projectId":    assignment.ProjectID,
		"supervisorId": assignment.SupervisorID,
		"status":       assignment.Status,
		"assignedBy":   assignment.AssignedBy,
		"assignedAt":   assignment.AssignedAt,
	}
	result := repository.DB.Model(&assignment).Update("status", 0)
	if result.Error != nil {
		response.ServerError(c, "移除失败")
		return
	}
	if result.RowsAffected == 0 {
		response.NotFound(c, "分配记录不存在")
		return
	}
	assignment.Status = 0
	_ = (&service.AuditLogService{}).CreateBusinessRecord(&service.CreateAuditRecordInput{
		OperatorType:  "admin",
		OperatorID:    c.GetUint64("adminId"),
		OperationType: "remove_supervisor",
		ResourceType:  "project_supervisor_assignment",
		ResourceID:    assignment.ID,
		Reason:        readAdminReason(c, "移除监理"),
		Result:        "success",
		BeforeState:   beforeState,
		AfterState: map[string]interface{}{
			"projectId":    assignment.ProjectID,
			"supervisorId": assignment.SupervisorID,
			"status":       assignment.Status,
			"assignedBy":   assignment.AssignedBy,
			"assignedAt":   assignment.AssignedAt,
		},
		ClientIP:  c.ClientIP(),
		UserAgent: c.Request.UserAgent(),
	})

	response.Success(c, nil)
}

// ==================== Admin 监理申请审核 ====================

type adminSupervisorApplicationRow struct {
	model.SupervisorApplication
	WhitelistNote string `json:"whitelistNote,omitempty"`
}

// AdminListSupervisorApplications 监理申请列表
func AdminListSupervisorApplications(c *gin.Context) {
	page := parseInt(c.DefaultQuery("page", "1"), 1)
	pageSize := parseInt(c.DefaultQuery("pageSize", "10"), 10)
	keyword := strings.TrimSpace(c.Query("keyword"))
	status := c.Query("status")

	db := repository.DB.Model(&model.SupervisorApplication{})

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

	var apps []model.SupervisorApplication
	if err := db.Order("id DESC").Offset((page - 1) * pageSize).Limit(pageSize).Find(&apps).Error; err != nil {
		response.ServerError(c, "加载失败")
		return
	}

	if len(apps) == 0 {
		response.Success(c, gin.H{"list": make([]adminSupervisorApplicationRow, 0), "total": total})
		return
	}

	// 关联白名单备注
	whitelistIDs := make([]uint64, len(apps))
	for i, a := range apps {
		whitelistIDs[i] = a.WhitelistID
	}
	noteMap := make(map[uint64]string)
	if len(whitelistIDs) > 0 {
		var whitelists []model.SupervisorPhoneWhitelist
		repository.DB.Select("id, note").Where("id IN ?", whitelistIDs).Find(&whitelists)
		for _, w := range whitelists {
			noteMap[w.ID] = w.Note
		}
	}

	canReview := middleware.CurrentAdminHasAnyPermission(c, "supervision:supervisor:edit")
	list := make([]adminSupervisorApplicationRow, len(apps))
	for i, a := range apps {
		a.Phone = maskPhoneValue(a.Phone)
		if !canReview {
			a.FormJSON = sanitizeSupervisorApplicationFormJSONForList(a.FormJSON)
		}
		list[i] = adminSupervisorApplicationRow{
			SupervisorApplication: a,
			WhitelistNote:         noteMap[a.WhitelistID],
		}
	}

	response.Success(c, gin.H{"list": list, "total": total})
}

func sanitizeSupervisorApplicationFormJSONForList(raw string) string {
	var payload map[string]interface{}
	if err := json.Unmarshal([]byte(raw), &payload); err != nil {
		return "{}"
	}
	delete(payload, "idNo")
	delete(payload, "idNumber")
	delete(payload, "identityNo")
	delete(payload, "identityNumber")
	cleaned, err := json.Marshal(payload)
	if err != nil {
		return "{}"
	}
	return string(cleaned)
}

// AdminApproveSupervisorApplication 审批通过监理申请
func AdminApproveSupervisorApplication(c *gin.Context) {
	adminID := c.GetUint64("adminId")
	appID := parseUint64(c.Param("id"))
	if appID == 0 {
		response.BadRequest(c, "无效申请ID")
		return
	}

	var req struct {
		Reason string `json:"reason"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		// reason optional
	}

	tx := repository.DB.Begin()

	var app model.SupervisorApplication
	if err := tx.First(&app, appID).Error; err != nil {
		tx.Rollback()
		response.NotFound(c, "申请不存在")
		return
	}

	if app.Status != supervisorApplicationStatusPending {
		tx.Rollback()
		response.BadRequest(c, "该申请已处理")
		return
	}

	// 检查该手机号是否已有 supervisor_account
	var existingAccount model.SupervisorAccount
	accountExists := false
	if err := tx.Where("phone = ?", app.Phone).First(&existingAccount).Error; err == nil {
		accountExists = true
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		tx.Rollback()
		response.ServerError(c, "校验监理账号失败")
		return
	}
	if accountExists && existingAccount.Status == 1 {
		tx.Rollback()
		response.BadRequest(c, "该手机号已有生效的监理账号")
		return
	}

	now := time.Now()

	// 创建/激活 supervisor_account
	var account model.SupervisorAccount
	if accountExists {
		account = existingAccount
		if err := tx.Model(&account).Updates(map[string]interface{}{
			"status":             1,
			"login_failed_count": 0,
			"locked_until":       nil,
		}).Error; err != nil {
			tx.Rollback()
			response.ServerError(c, "激活账号失败")
			return
		}
		account.Status = 1
	} else {
		account = model.SupervisorAccount{
			Phone:  app.Phone,
			Status: 1,
		}
		if err := tx.Create(&account).Error; err != nil {
			tx.Rollback()
			response.ServerError(c, "创建账号失败")
			return
		}
	}

	// 解析并校验申请资料，避免空资料被审批成可登录账号。
	formData, _, formErr := parseAndValidateSupervisorOnboardingForm(json.RawMessage(app.FormJSON))
	if formErr != "" {
		tx.Rollback()
		response.BadRequest(c, "申请资料不完整，请驳回后让监理重新提交")
		return
	}

	serviceAreaJSON, _ := json.Marshal(formData.ServiceArea)
	certificationsJSON, _ := json.Marshal(formData.Certifications)

	// 创建或更新 supervisor_profile
	var profile model.SupervisorProfile
	profileExists := false
	if err := tx.Where("phone = ?", app.Phone).First(&profile).Error; err == nil {
		profileExists = true
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		tx.Rollback()
		response.ServerError(c, "校验监理资料失败")
		return
	}
	compatUser, err := findOrCreateSupervisorCompatibilityUser(tx, app.Phone, strings.TrimSpace(formData.RealName))
	if err != nil {
		tx.Rollback()
		response.ServerError(c, "创建兼容用户失败")
		return
	}

	profileData := map[string]interface{}{
		"user_id":               compatUser.ID,
		"real_name":             strings.TrimSpace(formData.RealName),
		"phone":                 app.Phone,
		"city_code":             strings.TrimSpace(formData.CityCode),
		"service_area":          string(serviceAreaJSON),
		"certifications":        string(certificationsJSON),
		"status":                1,
		"verified":              true,
		"verified_at":           now,
		"supervisor_account_id": account.ID,
	}

	if profileExists {
		if err := tx.Model(&profile).Updates(profileData).Error; err != nil {
			tx.Rollback()
			response.ServerError(c, "更新监理资料失败")
			return
		}
	} else {
		profile = model.SupervisorProfile{
			UserID:              compatUser.ID,
			SupervisorAccountID: &account.ID,
			RealName:            strings.TrimSpace(formData.RealName),
			Phone:               app.Phone,
			CityCode:            strings.TrimSpace(formData.CityCode),
			ServiceArea:         string(serviceAreaJSON),
			Certifications:      string(certificationsJSON),
			Status:              1,
			Verified:            true,
			VerifiedAt:          &now,
		}
		if err := tx.Create(&profile).Error; err != nil {
			tx.Rollback()
			response.ServerError(c, "创建监理资料失败")
			return
		}
	}

	// 更新申请状态
	reviewedAt := now
	if err := tx.Model(&app).Updates(map[string]interface{}{
		"status":                supervisorApplicationStatusApproved,
		"reviewed_by_admin_id":  adminID,
		"reviewed_at":           reviewedAt,
		"supervisor_account_id": account.ID,
	}).Error; err != nil {
		tx.Rollback()
		response.ServerError(c, "更新申请状态失败")
		return
	}

	if err := tx.Commit().Error; err != nil {
		response.ServerError(c, "审批失败")
		return
	}

	reason := readAdminReason(c, req.Reason, "审批通过监理入驻申请")
	_ = (&service.AuditLogService{}).CreateBusinessRecord(&service.CreateAuditRecordInput{
		OperatorType:  "admin",
		OperatorID:    adminID,
		OperationType: "approve_supervisor_application",
		ResourceType:  "supervisor_application",
		ResourceID:    app.ID,
		Reason:        reason,
		Result:        "success",
		AfterState: map[string]interface{}{
			"phone":               app.Phone,
			"accountId":           account.ID,
			"supervisorProfileId": profile.ID,
		},
		ClientIP:  c.ClientIP(),
		UserAgent: c.Request.UserAgent(),
	})

	response.Success(c, gin.H{
		"applicationId":       app.ID,
		"accountId":           account.ID,
		"supervisorProfileId": profile.ID,
	})
}

func findOrCreateSupervisorCompatibilityUser(tx *gorm.DB, phone string, nickname string) (*model.User, error) {
	phone = strings.TrimSpace(phone)
	var user model.User
	if err := tx.Where("phone = ?", phone).First(&user).Error; err == nil {
		return &user, nil
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	if strings.TrimSpace(nickname) == "" {
		nickname = "监理"
	}
	user = model.User{
		Phone:               phone,
		Nickname:            nickname,
		UserType:            1,
		DefaultIdentityType: "owner",
		Status:              1,
	}
	if err := tx.Create(&user).Error; err != nil {
		return nil, fmt.Errorf("create compatibility user: %w", err)
	}
	return &user, nil
}

func supervisorStatusLabel(status int8) string {
	if status == 1 {
		return "active"
	}
	return "disabled"
}

// AdminRejectSupervisorApplication 审批拒绝监理申请
func AdminRejectSupervisorApplication(c *gin.Context) {
	adminID := c.GetUint64("adminId")
	appID := parseUint64(c.Param("id"))
	if appID == 0 {
		response.BadRequest(c, "无效申请ID")
		return
	}

	var req struct {
		RejectReason string `json:"rejectReason" binding:"required"`
		Reason       string `json:"reason"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请填写拒绝原因")
		return
	}

	var app model.SupervisorApplication
	if err := repository.DB.First(&app, appID).Error; err != nil {
		response.NotFound(c, "申请不存在")
		return
	}

	if app.Status != supervisorApplicationStatusPending {
		response.BadRequest(c, "该申请已处理")
		return
	}

	now := time.Now()
	if err := repository.DB.Model(&app).Updates(map[string]interface{}{
		"status":               supervisorApplicationStatusRejected,
		"reject_reason":        strings.TrimSpace(req.RejectReason),
		"reviewed_by_admin_id": adminID,
		"reviewed_at":          now,
	}).Error; err != nil {
		response.ServerError(c, "操作失败")
		return
	}

	reason := readAdminReason(c, req.Reason, "审批拒绝监理入驻申请")
	_ = (&service.AuditLogService{}).CreateBusinessRecord(&service.CreateAuditRecordInput{
		OperatorType:  "admin",
		OperatorID:    adminID,
		OperationType: "reject_supervisor_application",
		ResourceType:  "supervisor_application",
		ResourceID:    app.ID,
		Reason:        reason,
		Result:        "success",
		AfterState: map[string]interface{}{
			"phone":        app.Phone,
			"rejectReason": req.RejectReason,
		},
		ClientIP:  c.ClientIP(),
		UserAgent: c.Request.UserAgent(),
	})

	response.Success(c, gin.H{"message": "已拒绝"})
}

// AdminUpdateSupervisorAccountStatus 启用/禁用监理账号（禁用时撤销所有 session）
func AdminUpdateSupervisorAccountStatus(c *gin.Context) {
	adminID := c.GetUint64("adminId")
	accountID := parseUint64(c.Param("id"))
	if accountID == 0 {
		response.BadRequest(c, "无效账号ID")
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
	if req.Status == nil || (*req.Status != 0 && *req.Status != 1) {
		response.BadRequest(c, "状态值无效")
		return
	}
	statusVal := *req.Status

	var account model.SupervisorAccount
	if err := repository.DB.First(&account, accountID).Error; err != nil {
		response.NotFound(c, "账号不存在")
		return
	}

	beforeStatus := account.Status
	if err := repository.DB.Model(&account).Update("status", statusVal).Error; err != nil {
		response.ServerError(c, "更新失败")
		return
	}

	// 同步 supervisor_profile 状态
	if err := repository.DB.Model(&model.SupervisorProfile{}).
		Where("supervisor_account_id = ?", accountID).
		Update("status", statusVal).Error; err != nil {
		// 非致命，只记日志
		_ = err
	}

	// 禁用时撤销所有 session
	if statusVal == 0 {
		_ = service.RevokeAllSupervisorSessions(accountID)
	}

	reason := readAdminReason(c, req.Reason, "更新监理账号状态")
	_ = (&service.AuditLogService{}).CreateBusinessRecord(&service.CreateAuditRecordInput{
		OperatorType:  "admin",
		OperatorID:    adminID,
		OperationType: "update_supervisor_account_status",
		ResourceType:  "supervisor_account",
		ResourceID:    account.ID,
		Reason:        reason,
		Result:        "success",
		BeforeState:   map[string]interface{}{"status": beforeStatus},
		AfterState:    map[string]interface{}{"status": statusVal, "phone": account.Phone},
		ClientIP:      c.ClientIP(),
		UserAgent:     c.Request.UserAgent(),
	})

	response.Success(c, nil)
}
