package handler

import (
	"fmt"
	"home-decoration-server/internal/config"
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	"home-decoration-server/internal/service"
	imgutil "home-decoration-server/internal/utils/image"
	"home-decoration-server/pkg/response"
	"sort"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

// ==================== 管理员认证 ====================

// AdminLoginRequest 管理员登录请求
type AdminLoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
	OTPCode  string `json:"otpCode"`
}

// AdminLogin 管理员登录
func AdminLogin(c *gin.Context) {
	var req AdminLoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}

	securitySvc := service.NewAdminSecurityService()
	failKey := fmt.Sprintf("admin_login_fail:%s", req.Username)
	failCount := 0
	rdb := repository.GetRedis()
	if rdb != nil {
		ctx, cancel := repository.RedisContext()
		defer cancel()

		failCountStr, _ := rdb.Get(ctx, failKey).Result()
		if failCountStr != "" {
			fmt.Sscanf(failCountStr, "%d", &failCount)
		}
	}

	if failCount >= securitySvc.LoginFailLimit() {
		response.Forbidden(c, fmt.Sprintf("登录失败次数过多，请%d分钟后重试", int(securitySvc.LoginLockDuration().Minutes())))
		return
	}

	var admin model.SysAdmin
	if err := repository.DB.Preload("Roles").Where("username = ?", strings.TrimSpace(req.Username)).First(&admin).Error; err != nil {
		increaseAdminLoginFail(failKey, securitySvc.LoginLockDuration())
		auditAdminSecurityEvent(0, "login_failed", "sys_admin", 0, "invalid_username", getAdminClientIP(c), c.Request.UserAgent(), map[string]interface{}{
			"username": strings.TrimSpace(req.Username),
		})
		response.Unauthorized(c, "用户名或密码错误")
		return
	}

	if admin.Status != 1 {
		auditAdminSecurityEvent(admin.ID, "login_blocked", "sys_admin", admin.ID, "disabled", getAdminClientIP(c), c.Request.UserAgent(), nil)
		response.Forbidden(c, "账号已被禁用")
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(admin.Password), []byte(req.Password)); err != nil {
		increaseAdminLoginFail(failKey, securitySvc.LoginLockDuration())
		auditAdminSecurityEvent(admin.ID, "login_failed", "sys_admin", admin.ID, "invalid_password", getAdminClientIP(c), c.Request.UserAgent(), nil)
		response.Unauthorized(c, "用户名或密码错误")
		return
	}

	if rdb != nil {
		ctx, cancel := repository.RedisContext()
		defer cancel()
		rdb.Del(ctx, failKey)
	}

	securityStatus := securitySvc.ResolveSecurityStatus(&admin)
	if securityStatus.SecuritySetupRequired {
		pair, err := securitySvc.IssueTokenPair(&admin, service.AdminLoginStageSetupRequired, "", getAdminClientIP(c), c.Request.UserAgent())
		if err != nil {
			response.ServerError(c, "生成安全初始化会话失败")
			return
		}
		updateAdminLastLogin(admin.ID, getAdminClientIP(c))
		auditAdminSecurityEvent(admin.ID, "login_setup_required", "sys_admin", admin.ID, "success", getAdminClientIP(c), c.Request.UserAgent(), nil)
		response.Success(c, buildAdminLoginPayload(&admin, pair, securityStatus))
		return
	}

	if securitySvc.AdminRequiresTwoFactor(&admin) {
		if strings.TrimSpace(req.OTPCode) == "" {
			response.Success(c, buildAdminLoginPayload(&admin, nil, service.AdminSecurityStatus{
				LoginStage:            service.AdminLoginStageOTPRequired,
				SecuritySetupRequired: false,
				MustResetPassword:     false,
				TwoFactorEnabled:      admin.TwoFactorEnabled,
				TwoFactorRequired:     true,
			}))
			return
		}
		if err := securitySvc.VerifyTOTP(&admin, req.OTPCode); err != nil {
			increaseAdminLoginFail(failKey, securitySvc.LoginLockDuration())
			auditAdminSecurityEvent(admin.ID, "login_failed", "sys_admin", admin.ID, "invalid_otp", getAdminClientIP(c), c.Request.UserAgent(), nil)
			response.Unauthorized(c, "动态验证码错误")
			return
		}
	}

	pair, err := securitySvc.IssueTokenPair(&admin, service.AdminLoginStageActive, "", getAdminClientIP(c), c.Request.UserAgent())
	if err != nil {
		response.ServerError(c, "生成登录会话失败")
		return
	}
	updateAdminLastLogin(admin.ID, getAdminClientIP(c))
	auditAdminSecurityEvent(admin.ID, "login_success", "sys_admin", admin.ID, "success", getAdminClientIP(c), c.Request.UserAgent(), map[string]interface{}{
		"sessionId": pair.SessionID,
	})
	response.Success(c, buildAdminLoginPayload(&admin, pair, securityStatus))
}

// AdminGetInfo 获取当前管理员信息及权限
func AdminGetInfo(c *gin.Context) {
	adminID := c.GetUint64("admin_id")
	if adminID == 0 {
		response.Unauthorized(c, "未登录")
		return
	}

	// 获取管理员及角色
	var admin model.SysAdmin
	if err := repository.DB.Preload("Roles").First(&admin, adminID).Error; err != nil {
		response.NotFound(c, "管理员不存在")
		return
	}

	response.Success(c, buildAdminLoginPayload(&admin, nil, service.NewAdminSecurityService().ResolveSecurityStatus(&admin)))
}

func AdminLogout(c *gin.Context) {
	sid := c.GetString("admin_sid")
	if sid == "" {
		response.Success(c, nil)
		return
	}
	if err := service.NewAdminSecurityService().RevokeSession(sid); err != nil {
		response.ServerError(c, "退出登录失败")
		return
	}
	auditAdminSecurityEvent(c.GetUint64("admin_id"), "logout", "sys_admin", c.GetUint64("admin_id"), "success", getAdminClientIP(c), c.Request.UserAgent(), map[string]interface{}{
		"sessionId": sid,
	})
	response.Success(c, nil)
}

func AdminRefreshToken(c *gin.Context) {
	var req struct {
		RefreshToken string `json:"refreshToken" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "缺少刷新令牌")
		return
	}
	result, err := service.NewAdminSecurityService().RefreshTokens(req.RefreshToken, getAdminClientIP(c), c.Request.UserAgent())
	if err != nil {
		response.Unauthorized(c, err.Error())
		return
	}
	response.Success(c, buildAdminLoginPayload(result.Admin, result.Pair, service.NewAdminSecurityService().ResolveSecurityStatus(result.Admin)))
}

func AdminGetSecurityStatus(c *gin.Context) {
	admin, ok := loadCurrentAdmin(c)
	if !ok {
		return
	}
	securityStatus := service.NewAdminSecurityService().ResolveSecurityStatus(admin)
	sessionItems, err := service.NewAdminSecurityService().ListSessions(admin.ID, c.GetString("admin_sid"))
	if err != nil {
		response.ServerError(c, "查询安全状态失败")
		return
	}
	response.Success(c, gin.H{
		"admin":        buildAdminProfile(admin),
		"security":     securityStatus,
		"sessions":     sessionItems,
		"sessionCount": len(sessionItems),
	})
}

func AdminResetInitialPassword(c *gin.Context) {
	admin, ok := loadCurrentAdmin(c)
	if !ok {
		return
	}
	var req struct {
		NewPassword string `json:"newPassword" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请输入新密码")
		return
	}
	securitySvc := service.NewAdminSecurityService()
	if err := securitySvc.ResetInitialPassword(admin, req.NewPassword); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	if err := repository.DB.Preload("Roles").First(admin, admin.ID).Error; err != nil {
		response.ServerError(c, "加载管理员失败")
		return
	}
	securityStatus := securitySvc.ResolveSecurityStatus(admin)
	payload := gin.H{
		"security": securityStatus,
	}
	if securityStatus.LoginStage == service.AdminLoginStageActive {
		_ = securitySvc.RevokeSession(c.GetString("admin_sid"))
		pair, err := securitySvc.IssueTokenPair(admin, service.AdminLoginStageActive, "", getAdminClientIP(c), c.Request.UserAgent())
		if err != nil {
			response.ServerError(c, "切换安全会话失败")
			return
		}
		payload = buildAdminLoginPayload(admin, pair, securityStatus)
	}
	auditAdminSecurityEvent(admin.ID, "password_reset_initial", "sys_admin", admin.ID, "success", getAdminClientIP(c), c.Request.UserAgent(), nil)
	response.Success(c, payload)
}

func AdminBeginBind2FA(c *gin.Context) {
	admin, ok := loadCurrentAdmin(c)
	if !ok {
		return
	}
	securitySvc := service.NewAdminSecurityService()
	secret, otpauthURL, err := securitySvc.GenerateOrReuseTOTP(admin)
	if err != nil {
		response.ServerError(c, "生成 TOTP 绑定信息失败")
		return
	}
	response.Success(c, gin.H{
		"secret":     secret,
		"otpauthUrl": otpauthURL,
		"issuer":     config.GetConfig().AdminAuth.TOTPIssuer,
	})
}

func AdminVerify2FA(c *gin.Context) {
	admin, ok := loadCurrentAdmin(c)
	if !ok {
		return
	}
	var req struct {
		OTPCode string `json:"otpCode" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请输入动态验证码")
		return
	}
	securitySvc := service.NewAdminSecurityService()
	if err := securitySvc.EnableTwoFactor(admin, req.OTPCode); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	if err := repository.DB.Preload("Roles").First(admin, admin.ID).Error; err != nil {
		response.ServerError(c, "加载管理员失败")
		return
	}
	securityStatus := securitySvc.ResolveSecurityStatus(admin)
	payload := gin.H{"security": securityStatus}
	if securityStatus.LoginStage == service.AdminLoginStageActive {
		_ = securitySvc.RevokeSession(c.GetString("admin_sid"))
		pair, err := securitySvc.IssueTokenPair(admin, service.AdminLoginStageActive, "", getAdminClientIP(c), c.Request.UserAgent())
		if err != nil {
			response.ServerError(c, "切换安全会话失败")
			return
		}
		payload = buildAdminLoginPayload(admin, pair, securityStatus)
	}
	auditAdminSecurityEvent(admin.ID, "two_factor_bound", "sys_admin", admin.ID, "success", getAdminClientIP(c), c.Request.UserAgent(), nil)
	response.Success(c, payload)
}

func AdminReset2FA(c *gin.Context) {
	admin, ok := loadCurrentAdmin(c)
	if !ok {
		return
	}
	reason := readAdminReason(c, "重置管理员 2FA")
	beforeState := map[string]interface{}{
		"twoFactorEnabled": admin.TwoFactorEnabled,
		"twoFactorBoundAt": admin.TwoFactorBoundAt,
	}
	if err := service.NewAdminSecurityService().ResetTwoFactor(admin.ID); err != nil {
		response.ServerError(c, "重置 2FA 失败")
		return
	}
	_ = (&service.AuditLogService{}).CreateBusinessRecord(&service.CreateAuditRecordInput{
		OperatorType:  "admin",
		OperatorID:    admin.ID,
		OperationType: "two_factor_reset",
		ResourceType:  "sys_admin",
		ResourceID:    admin.ID,
		Reason:        reason,
		Result:        "success",
		BeforeState:   beforeState,
		AfterState: map[string]interface{}{
			"twoFactorEnabled": false,
			"twoFactorBoundAt": nil,
		},
		ClientIP:  getAdminClientIP(c),
		UserAgent: c.Request.UserAgent(),
	})
	response.SuccessWithMessage(c, "2FA 已重置，请重新登录并完成绑定", nil)
}

func AdminRequest2FARecovery(c *gin.Context) {
	admin, ok := loadCurrentAdmin(c)
	if !ok {
		return
	}
	roleKeys := getRoleKeys(admin.Roles)
	for _, roleKey := range roleKeys {
		switch roleKey {
		case service.ReservedRoleSystemAdmin, service.ReservedRoleSecurityAdmin, service.ReservedRoleSecurityAudit:
			response.Forbidden(c, "高权限管理员不支持自助恢复，请联系安全管理员处理")
			return
		}
	}
	if err := service.NewAdminSecurityService().CreateRecoveryRequest(admin); err != nil {
		response.ServerError(c, "提交恢复申请失败")
		return
	}
	auditAdminSecurityEvent(admin.ID, "two_factor_recovery_request", "sys_admin", admin.ID, "success", getAdminClientIP(c), c.Request.UserAgent(), nil)
	response.SuccessWithMessage(c, "恢复申请已提交，请联系安全管理员人工处理", nil)
}

func AdminListSecuritySessions(c *gin.Context) {
	admin, ok := loadCurrentAdmin(c)
	if !ok {
		return
	}
	items, err := service.NewAdminSecurityService().ListSessions(admin.ID, c.GetString("admin_sid"))
	if err != nil {
		response.ServerError(c, "查询在线会话失败")
		return
	}
	response.Success(c, gin.H{"list": items})
}

func AdminRevokeSecuritySession(c *gin.Context) {
	adminID := c.GetUint64("admin_id")
	admin, ok := loadCurrentAdmin(c)
	if !ok {
		return
	}
	sid := strings.TrimSpace(c.Param("sid"))
	if sid == "" {
		response.BadRequest(c, "会话ID无效")
		return
	}
	items, err := service.NewAdminSecurityService().ListSessions(admin.ID, "")
	if err != nil {
		response.ServerError(c, "校验会话归属失败")
		return
	}
	owned := false
	for _, item := range items {
		if item.SessionID == sid {
			owned = true
			break
		}
	}
	if !owned {
		response.Forbidden(c, "只能撤销当前管理员自己的在线会话")
		return
	}
	if err := service.NewAdminSecurityService().RevokeSession(sid); err != nil {
		response.ServerError(c, "撤销会话失败")
		return
	}
	_ = (&service.AuditLogService{}).CreateBusinessRecord(&service.CreateAuditRecordInput{
		OperatorType:  "admin",
		OperatorID:    adminID,
		OperationType: "session_revoked",
		ResourceType:  "sys_admin",
		ResourceID:    adminID,
		Reason:        readAdminReason(c, "撤销管理员会话"),
		Result:        "success",
		Metadata: map[string]interface{}{
			"sessionId": sid,
		},
		ClientIP:  getAdminClientIP(c),
		UserAgent: c.Request.UserAgent(),
	})
	response.Success(c, nil)
}

func AdminReauth(c *gin.Context) {
	admin, ok := loadCurrentAdmin(c)
	if !ok {
		return
	}
	var req struct {
		OTPCode  string `json:"otpCode"`
		Password string `json:"password"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}
	proof, expiresAt, err := service.NewAdminSecurityService().CreateReauthProof(admin, c.GetString("admin_sid"), req.OTPCode, req.Password)
	if err != nil {
		auditAdminSecurityEvent(admin.ID, "reauth_failed", "sys_admin", admin.ID, "failed", getAdminClientIP(c), c.Request.UserAgent(), map[string]interface{}{
			"message": err.Error(),
		})
		response.BadRequest(c, err.Error())
		return
	}
	auditAdminSecurityEvent(admin.ID, "reauth_success", "sys_admin", admin.ID, "success", getAdminClientIP(c), c.Request.UserAgent(), map[string]interface{}{
		"expiresAt": expiresAt.Format(time.RFC3339),
	})
	response.Success(c, gin.H{
		"proof":     proof,
		"expiresAt": expiresAt,
	})
}

func buildAdminLoginPayload(admin *model.SysAdmin, pair *service.AdminTokenPair, security service.AdminSecurityStatus) gin.H {
	payload := gin.H{
		"token":                 "",
		"accessToken":           "",
		"refreshToken":          "",
		"expiresIn":             int64(0),
		"admin":                 buildAdminProfile(admin),
		"permissions":           getAdminPermissions(admin),
		"menus":                 getAdminMenuTree(admin),
		"security":              security,
		"securitySetupRequired": security.SecuritySetupRequired,
		"loginStage":            security.LoginStage,
	}
	if pair != nil {
		payload["token"] = pair.AccessToken
		payload["accessToken"] = pair.AccessToken
		payload["refreshToken"] = pair.RefreshToken
		payload["expiresIn"] = pair.ExpiresIn
	}
	return payload
}

func buildAdminProfile(admin *model.SysAdmin) gin.H {
	if admin == nil {
		return gin.H{}
	}
	return gin.H{
		"id":                admin.ID,
		"username":          admin.Username,
		"nickname":          admin.Nickname,
		"avatar":            imgutil.GetFullImageURL(admin.Avatar),
		"isSuperAdmin":      admin.IsSuperAdmin,
		"roles":             getRoleKeys(activeAdminRoles(admin.Roles)),
		"mustResetPassword": admin.MustResetPassword,
		"twoFactorEnabled":  admin.TwoFactorEnabled,
		"twoFactorBoundAt":  admin.TwoFactorBoundAt,
		"lastLoginAt":       admin.LastLoginAt,
		"lastLoginIp":       admin.LastLoginIP,
	}
}

func loadCurrentAdmin(c *gin.Context) (*model.SysAdmin, bool) {
	adminID := c.GetUint64("admin_id")
	if adminID == 0 {
		response.Unauthorized(c, "未登录")
		return nil, false
	}
	admin, err := service.NewAdminSecurityService().GetAdminByID(adminID)
	if err != nil {
		response.NotFound(c, "管理员不存在")
		return nil, false
	}
	return admin, true
}

func getAdminClientIP(c *gin.Context) string {
	if ip, ok := c.Get("admin_client_ip"); ok {
		if value, ok := ip.(string); ok && strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return strings.TrimSpace(c.ClientIP())
}

func readAdminReason(c *gin.Context, fallbacks ...string) string {
	if c != nil {
		if value, ok := c.Get("admin_reason"); ok {
			if reason, ok := value.(string); ok && strings.TrimSpace(reason) != "" {
				return strings.TrimSpace(reason)
			}
		}
	}
	for _, fallback := range fallbacks {
		if strings.TrimSpace(fallback) != "" {
			return strings.TrimSpace(fallback)
		}
	}
	return ""
}

func increaseAdminLoginFail(key string, ttl time.Duration) {
	rdb := repository.GetRedis()
	if rdb == nil {
		return
	}
	ctx, cancel := repository.RedisContext()
	defer cancel()
	rdb.Incr(ctx, key)
	rdb.Expire(ctx, key, ttl)
}

func updateAdminLastLogin(adminID uint64, clientIP string) {
	now := time.Now()
	_ = repository.DB.Model(&model.SysAdmin{}).Where("id = ?", adminID).Updates(map[string]interface{}{
		"last_login_at": now,
		"last_login_ip": strings.TrimSpace(clientIP),
	}).Error
}

func auditAdminSecurityEvent(operatorID uint64, operationType, resourceType string, resourceID uint64, result, clientIP, userAgent string, metadata map[string]interface{}) {
	_ = (&service.AuditLogService{}).CreateBusinessRecord(&service.CreateAuditRecordInput{
		OperatorType:  "admin",
		OperatorID:    operatorID,
		OperationType: strings.TrimSpace(operationType),
		ResourceType:  strings.TrimSpace(resourceType),
		ResourceID:    resourceID,
		Result:        strings.TrimSpace(result),
		ClientIP:      strings.TrimSpace(clientIP),
		UserAgent:     strings.TrimSpace(userAgent),
		Metadata:      metadata,
	})
}

// getAdminPermissions 获取管理员权限列表
func getAdminPermissions(admin *model.SysAdmin) []string {
	if admin.IsSuperAdmin {
		return []string{"*:*:*"} // 超级管理员拥有所有权限
	}

	var permissions []string
	roleIDs := activeAdminRoleIDs(admin.Roles)
	if len(roleIDs) == 0 {
		return permissions
	}

	// 查询角色拥有的菜单权限
	var menus []model.SysMenu
	repository.DB.
		Joins("JOIN sys_role_menus ON sys_role_menus.menu_id = sys_menus.id").
		Where("sys_role_menus.role_id IN ? AND sys_menus.permission != '' AND sys_menus.status = 1", roleIDs).
		Find(&menus)

	permSet := make(map[string]bool)
	for _, menu := range menus {
		if menu.Permission != "" {
			permSet[menu.Permission] = true
		}
	}

	for perm := range permSet {
		permissions = append(permissions, perm)
	}
	return permissions
}

// getAdminMenuTree 获取管理员菜单树
func getAdminMenuTree(admin *model.SysAdmin) []*model.SysMenu {
	var menus []model.SysMenu

	if admin.IsSuperAdmin {
		// 超级管理员获取所有菜单
		repository.DB.Where("type IN (1, 2) AND status = 1 AND visible = true").
			Order("sort ASC, id ASC").Find(&menus)
	} else {
		// 普通管理员根据角色获取菜单
		roleIDs := activeAdminRoleIDs(admin.Roles)
		if len(roleIDs) == 0 {
			return nil
		}

		repository.DB.
			Joins("JOIN sys_role_menus ON sys_role_menus.menu_id = sys_menus.id").
			Where("sys_role_menus.role_id IN ? AND sys_menus.type IN (1, 2) AND sys_menus.status = 1 AND sys_menus.visible = true", roleIDs).
			Order("sys_menus.sort ASC, sys_menus.id ASC").
			Find(&menus)
	}

	uniqueMenus := uniqueAdminMenuNodes(menus)

	// 构建树
	return buildMenuTree(uniqueMenus, 0)
}

func activeAdminRoleIDs(roles []model.SysRole) []uint64 {
	activeRoles := activeAdminRoles(roles)
	roleIDs := make([]uint64, 0, len(activeRoles))
	for _, role := range activeRoles {
		roleIDs = append(roleIDs, role.ID)
	}
	return roleIDs
}

func activeAdminRoles(roles []model.SysRole) []model.SysRole {
	activeRoles := make([]model.SysRole, 0, len(roles))
	for _, role := range roles {
		if role.ID > 0 && role.Status == 1 {
			activeRoles = append(activeRoles, role)
		}
	}
	return activeRoles
}

func uniqueAdminMenuNodes(menus []model.SysMenu) []*model.SysMenu {
	seenIDs := make(map[uint64]bool)
	seenKeys := make(map[string]bool)
	var uniqueMenus []*model.SysMenu

	for i := range menus {
		menu := &menus[i]
		if seenIDs[menu.ID] {
			continue
		}
		seenIDs[menu.ID] = true

		if key := adminMenuDedupKey(menu); key != "" {
			if seenKeys[key] {
				continue
			}
			seenKeys[key] = true
		}

		uniqueMenus = append(uniqueMenus, menu)
	}

	return uniqueMenus
}

func adminMenuDedupKey(menu *model.SysMenu) string {
	if menu == nil {
		return ""
	}
	if path := strings.TrimSpace(menu.Path); path != "" {
		return "path:" + path
	}
	if permission := strings.TrimSpace(menu.Permission); permission != "" {
		return "permission:" + permission
	}
	return ""
}

// buildMenuTree 构建菜单树
func buildMenuTree(menus []*model.SysMenu, parentID uint64) []*model.SysMenu {
	var tree []*model.SysMenu
	for _, menu := range menus {
		if menu.ParentID == parentID {
			menu.Children = buildMenuTree(menus, menu.ID)
			tree = append(tree, menu)
		}
	}
	// 按 Sort 排序
	sort.Slice(tree, func(i, j int) bool {
		if tree[i].Sort == tree[j].Sort {
			return tree[i].ID < tree[j].ID
		}
		return tree[i].Sort < tree[j].Sort
	})
	return tree
}

// getRoleKeys 获取角色标识列表
func getRoleKeys(roles []model.SysRole) []string {
	keys := make([]string, len(roles))
	for i, role := range roles {
		keys[i] = role.Key
	}
	return keys
}

// ==================== 角色管理 ====================

// AdminListRoles 获取角色列表
func AdminListRoles(c *gin.Context) {
	var roles []model.SysRole
	repository.DB.Order("sort ASC, id ASC").Find(&roles)
	response.Success(c, gin.H{"list": roles})
}

// AdminCreateRole 创建角色
func AdminCreateRole(c *gin.Context) {
	adminID := c.GetUint64("admin_id")
	var role model.SysRole
	if err := c.ShouldBindJSON(&role); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}

	auditService := &service.AuditLogService{}
	if err := repository.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&role).Error; err != nil {
			return err
		}
		return auditService.CreateBusinessRecordTx(tx, &service.CreateAuditRecordInput{
			OperatorType:  "admin",
			OperatorID:    adminID,
			OperationType: "create_role",
			ResourceType:  "sys_role",
			ResourceID:    role.ID,
			Reason:        readAdminReason(c, role.Remark, "创建角色"),
			Result:        "success",
			AfterState: map[string]interface{}{
				"role": snapshotSysRoleForAudit(role),
			},
		})
	}); err != nil {
		response.ServerError(c, "创建失败")
		return
	}

	response.Success(c, role)
}

// AdminUpdateRole 更新角色
func AdminUpdateRole(c *gin.Context) {
	roleID := parseUint64(c.Param("id"))
	adminID := c.GetUint64("admin_id")
	var role model.SysRole
	if err := repository.DB.First(&role, roleID).Error; err != nil {
		response.NotFound(c, "角色不存在")
		return
	}

	// ✅ 使用结构体，只允许更新指定字段
	var req struct {
		Name   string `json:"name"`
		Key    string `json:"key"`
		Sort   int    `json:"sort"`
		Status int8   `json:"status"`
		Remark string `json:"remark"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}
	if service.IsReservedSeparationRoleKey(role.Key) && req.Key != "" && req.Key != role.Key {
		response.BadRequest(c, "三员分立保留角色不允许修改标识")
		return
	}
	if !service.IsReservedSeparationRoleKey(role.Key) && service.IsReservedSeparationRoleKey(req.Key) {
		response.BadRequest(c, "不能把普通角色修改为三员分立保留角色")
		return
	}
	existingRole := role

	// ✅ 显式更新字段
	role.Name = req.Name
	role.Key = req.Key
	role.Sort = req.Sort
	role.Status = req.Status
	role.Remark = req.Remark

	beforeState := map[string]interface{}{
		"role": snapshotSysRoleForAudit(existingRole),
	}

	auditService := &service.AuditLogService{}
	if err := repository.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Save(&role).Error; err != nil {
			return err
		}
		return auditService.CreateBusinessRecordTx(tx, &service.CreateAuditRecordInput{
			OperatorType:  "admin",
			OperatorID:    adminID,
			OperationType: "update_role",
			ResourceType:  "sys_role",
			ResourceID:    role.ID,
			Reason:        readAdminReason(c, req.Remark, "更新角色"),
			Result:        "success",
			BeforeState:   beforeState,
			AfterState: map[string]interface{}{
				"role": snapshotSysRoleForAudit(role),
			},
		})
	}); err != nil {
		response.ServerError(c, "更新失败")
		return
	}
	_ = revokeSessionsByRoleID(role.ID)

	response.Success(c, role)
}

// AdminDeleteRole 删除角色
func AdminDeleteRole(c *gin.Context) {
	roleID := parseUint64(c.Param("id"))
	adminID := c.GetUint64("admin_id")

	var role model.SysRole
	if err := repository.DB.First(&role, roleID).Error; err != nil {
		response.NotFound(c, "角色不存在")
		return
	}
	if service.IsReservedSeparationRoleKey(role.Key) {
		response.BadRequest(c, "三员分立保留角色不允许删除")
		return
	}

	// 检查是否有管理员使用此角色
	var count int64
	repository.DB.Model(&model.SysAdminRole{}).Where("role_id = ?", roleID).Count(&count)
	if count > 0 {
		response.BadRequest(c, "该角色下存在管理员，无法删除")
		return
	}

	beforeMenus, err := loadRoleMenuAuditSnapshotTx(repository.DB, roleID)
	if err != nil {
		response.ServerError(c, "加载角色权限失败")
		return
	}
	// 删除角色及其菜单关联
	auditService := &service.AuditLogService{}
	tx := repository.DB.Begin()
	tx.Where("role_id = ?", roleID).Delete(&model.SysRoleMenu{})
	if err := tx.Delete(&role).Error; err != nil {
		tx.Rollback()
		response.ServerError(c, "删除失败")
		return
	}
	if err := auditService.CreateBusinessRecordTx(tx, &service.CreateAuditRecordInput{
		OperatorType:  "admin",
		OperatorID:    adminID,
		OperationType: "delete_role",
		ResourceType:  "sys_role",
		ResourceID:    role.ID,
		Reason:        readAdminReason(c, role.Remark, "删除角色"),
		Result:        "success",
		BeforeState: map[string]interface{}{
			"role":      snapshotSysRoleForAudit(role),
			"menuScope": beforeMenus,
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

	response.Success(c, nil)
}

// AdminGetRoleMenus 获取角色已分配的菜单权限
func AdminGetRoleMenus(c *gin.Context) {
	roleID := c.Param("id")

	var roleMenus []model.SysRoleMenu
	repository.DB.Where("role_id = ?", roleID).Find(&roleMenus)

	menuIds := make([]uint64, len(roleMenus))
	for i, rm := range roleMenus {
		menuIds[i] = rm.MenuID
	}

	response.Success(c, gin.H{"menuIds": menuIds})
}

// AdminAssignRoleMenus 给角色分配菜单权限
func AdminAssignRoleMenus(c *gin.Context) {
	roleID := parseUint64(c.Param("id"))
	adminID := c.GetUint64("admin_id")

	var req struct {
		MenuIDs []uint64 `json:"menuIds"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}
	if _, role, err := service.ValidateRoleMenuAssignment(roleID, req.MenuIDs); err != nil {
		respondAdminRBACMutationError(c, err, "角色权限分配不合法")
		return
	} else if role == nil {
		response.NotFound(c, "角色不存在")
		return
	}

	beforeState, err := loadRoleMenuAuditSnapshotTx(repository.DB, roleID)
	if err != nil {
		response.ServerError(c, "加载角色权限失败")
		return
	}

	tx := repository.DB.Begin()

	// 删除原有关联
	tx.Where("role_id = ?", roleID).Delete(&model.SysRoleMenu{})

	// 创建新关联
	for _, menuID := range req.MenuIDs {
		if err := tx.Create(&model.SysRoleMenu{
			RoleID: roleID,
			MenuID: menuID,
		}).Error; err != nil {
			tx.Rollback()
			response.ServerError(c, "分配菜单失败")
			return
		}
	}

	afterState, err := loadRoleMenuAuditSnapshotTx(tx, roleID)
	if err != nil {
		tx.Rollback()
		response.ServerError(c, "加载角色权限失败")
		return
	}
	if err := (&service.AuditLogService{}).CreateBusinessRecordTx(tx, &service.CreateAuditRecordInput{
		OperatorType:  "admin",
		OperatorID:    adminID,
		OperationType: "assign_role_menus",
		ResourceType:  "sys_role",
		ResourceID:    roleID,
		Reason:        readAdminReason(c, "", "更新角色菜单权限"),
		Result:        "success",
		BeforeState: map[string]interface{}{
			"menuScope": beforeState,
		},
		AfterState: map[string]interface{}{
			"menuScope": afterState,
		},
		Metadata: map[string]interface{}{
			"menuCount": len(req.MenuIDs),
		},
	}); err != nil {
		tx.Rollback()
		response.ServerError(c, "分配菜单失败")
		return
	}
	if err := tx.Commit().Error; err != nil {
		response.ServerError(c, "分配菜单失败")
		return
	}
	_ = revokeSessionsByRoleID(roleID)
	response.Success(c, nil)
}

// ==================== 菜单管理 ====================

// AdminListMenus 获取菜单列表（树形）
func AdminListMenus(c *gin.Context) {
	var menus []model.SysMenu
	repository.DB.Order("sort ASC, id ASC").Find(&menus)

	// 转换为指针切片
	menuPtrs := make([]*model.SysMenu, len(menus))
	for i := range menus {
		menuPtrs[i] = &menus[i]
	}

	tree := buildMenuTree(menuPtrs, 0)
	response.Success(c, gin.H{"list": tree})
}

// AdminCreateMenu 创建菜单
func AdminCreateMenu(c *gin.Context) {
	adminID := c.GetUint64("admin_id")
	var menu model.SysMenu
	if err := c.ShouldBindJSON(&menu); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}

	if err := repository.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&menu).Error; err != nil {
			return err
		}
		return (&service.AuditLogService{}).CreateBusinessRecordTx(tx, &service.CreateAuditRecordInput{
			OperatorType:  "admin",
			OperatorID:    adminID,
			OperationType: "create_menu",
			ResourceType:  "sys_menu",
			ResourceID:    menu.ID,
			Reason:        readAdminReason(c, menu.Title, "创建菜单"),
			Result:        "success",
			AfterState: map[string]interface{}{
				"menu": menu,
			},
		})
	}); err != nil {
		response.ServerError(c, "创建失败")
		return
	}

	response.Success(c, menu)
}

// AdminUpdateMenu 更新菜单
func AdminUpdateMenu(c *gin.Context) {
	adminID := c.GetUint64("admin_id")
	id := c.Param("id")
	var menu model.SysMenu
	if err := repository.DB.First(&menu, id).Error; err != nil {
		response.NotFound(c, "菜单不存在")
		return
	}

	// ✅ 使用结构体，只允许更新指定字段
	var req struct {
		ParentID   uint64 `json:"parentId"`
		Title      string `json:"title"`
		Type       int8   `json:"type"`
		Permission string `json:"permission"`
		Path       string `json:"path"`
		Component  string `json:"component"`
		Icon       string `json:"icon"`
		Sort       int    `json:"sort"`
		Status     int8   `json:"status"`
		Visible    bool   `json:"visible"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}

	beforeState := map[string]interface{}{
		"menu": menu,
	}

	// ✅ 显式更新字段
	menu.ParentID = req.ParentID
	menu.Title = req.Title
	menu.Type = req.Type
	menu.Permission = req.Permission
	menu.Path = req.Path
	menu.Component = req.Component
	menu.Icon = req.Icon
	menu.Sort = req.Sort
	menu.Status = req.Status
	menu.Visible = req.Visible

	if err := repository.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Save(&menu).Error; err != nil {
			return err
		}
		return (&service.AuditLogService{}).CreateBusinessRecordTx(tx, &service.CreateAuditRecordInput{
			OperatorType:  "admin",
			OperatorID:    adminID,
			OperationType: "update_menu",
			ResourceType:  "sys_menu",
			ResourceID:    menu.ID,
			Reason:        readAdminReason(c, menu.Title, "更新菜单"),
			Result:        "success",
			BeforeState:   beforeState,
			AfterState: map[string]interface{}{
				"menu": menu,
			},
		})
	}); err != nil {
		response.ServerError(c, "更新失败")
		return
	}
	_ = revokeSessionsByMenuID(menu.ID)

	response.Success(c, menu)
}

// AdminDeleteMenu 删除菜单
func AdminDeleteMenu(c *gin.Context) {
	adminID := c.GetUint64("admin_id")
	id := c.Param("id")

	// 检查是否有子菜单
	var count int64
	repository.DB.Model(&model.SysMenu{}).Where("parent_id = ?", id).Count(&count)
	if count > 0 {
		response.BadRequest(c, "存在子菜单，无法删除")
		return
	}

	var menu model.SysMenu
	_ = repository.DB.First(&menu, id).Error

	tx := repository.DB.Begin()
	tx.Where("menu_id = ?", id).Delete(&model.SysRoleMenu{})
	if err := tx.Delete(&model.SysMenu{}, id).Error; err != nil {
		tx.Rollback()
		response.ServerError(c, "删除失败")
		return
	}
	if err := (&service.AuditLogService{}).CreateBusinessRecordTx(tx, &service.CreateAuditRecordInput{
		OperatorType:  "admin",
		OperatorID:    adminID,
		OperationType: "delete_menu",
		ResourceType:  "sys_menu",
		ResourceID:    menu.ID,
		Reason:        readAdminReason(c, menu.Title, "删除菜单"),
		Result:        "success",
		BeforeState: map[string]interface{}{
			"menu": menu,
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
	_ = revokeSessionsByMenuID(menu.ID)

	response.Success(c, nil)
}

func snapshotSysRoleForAudit(role model.SysRole) map[string]interface{} {
	return map[string]interface{}{
		"id":     role.ID,
		"name":   role.Name,
		"key":    role.Key,
		"remark": role.Remark,
		"sort":   role.Sort,
		"status": role.Status,
	}
}

func snapshotSysAdminForAudit(admin model.SysAdmin) map[string]interface{} {
	roleIDs := make([]uint64, 0, len(admin.Roles))
	for _, role := range admin.Roles {
		roleIDs = append(roleIDs, role.ID)
	}
	sort.Slice(roleIDs, func(i, j int) bool { return roleIDs[i] < roleIDs[j] })
	roleKeys := getRoleKeys(admin.Roles)
	sort.Strings(roleKeys)

	return map[string]interface{}{
		"id":                admin.ID,
		"username":          admin.Username,
		"nickname":          admin.Nickname,
		"phone":             admin.Phone,
		"email":             admin.Email,
		"status":            admin.Status,
		"isSuperAdmin":      admin.IsSuperAdmin,
		"mustResetPassword": admin.MustResetPassword,
		"twoFactorEnabled":  admin.TwoFactorEnabled,
		"twoFactorBoundAt":  admin.TwoFactorBoundAt,
		"disabledReason":    admin.DisabledReason,
		"roleIds":           roleIDs,
		"roleKeys":          roleKeys,
	}
}

func loadAdminWithRolesTx(tx *gorm.DB, adminID uint64) (*model.SysAdmin, error) {
	var admin model.SysAdmin
	if err := tx.Preload("Roles").First(&admin, adminID).Error; err != nil {
		return nil, err
	}
	return &admin, nil
}

func loadRolesByIDsTx(tx *gorm.DB, roleIDs []uint64) ([]model.SysRole, error) {
	if len(roleIDs) == 0 {
		return []model.SysRole{}, nil
	}
	var roles []model.SysRole
	if err := tx.Where("id IN ?", roleIDs).Order("sort ASC, id ASC").Find(&roles).Error; err != nil {
		return nil, err
	}
	return roles, nil
}

func loadRoleMenuAuditSnapshotTx(tx *gorm.DB, roleID uint64) (map[string]interface{}, error) {
	var role model.SysRole
	if err := tx.First(&role, roleID).Error; err != nil {
		return nil, err
	}

	var menus []model.SysMenu
	if err := tx.Joins("JOIN sys_role_menus ON sys_role_menus.menu_id = sys_menus.id").
		Where("sys_role_menus.role_id = ?", roleID).
		Order("sys_menus.sort ASC, sys_menus.id ASC").
		Find(&menus).Error; err != nil {
		return nil, err
	}

	menuIDs := make([]uint64, 0, len(menus))
	permissions := make([]string, 0, len(menus))
	for _, menu := range menus {
		menuIDs = append(menuIDs, menu.ID)
		if menu.Permission != "" {
			permissions = append(permissions, menu.Permission)
		}
	}
	sort.Slice(menuIDs, func(i, j int) bool { return menuIDs[i] < menuIDs[j] })
	sort.Strings(permissions)

	return map[string]interface{}{
		"role":        snapshotSysRoleForAudit(role),
		"menuIds":     menuIDs,
		"permissions": permissions,
	}, nil
}

func revokeSessionsByRoleID(roleID uint64) error {
	if roleID == 0 {
		return nil
	}
	var adminIDs []uint64
	if err := repository.DB.Model(&model.SysAdminRole{}).Where("role_id = ?", roleID).Pluck("admin_id", &adminIDs).Error; err != nil {
		return err
	}
	return revokeAdminSessions(adminIDs)
}

func revokeSessionsByMenuID(menuID uint64) error {
	if menuID == 0 {
		return nil
	}
	var roleIDs []uint64
	if err := repository.DB.Model(&model.SysRoleMenu{}).Where("menu_id = ?", menuID).Pluck("role_id", &roleIDs).Error; err != nil {
		return err
	}
	if len(roleIDs) == 0 {
		return nil
	}
	var adminIDs []uint64
	if err := repository.DB.Model(&model.SysAdminRole{}).Where("role_id IN ?", roleIDs).Pluck("admin_id", &adminIDs).Error; err != nil {
		return err
	}
	return revokeAdminSessions(adminIDs)
}

func revokeAdminSessions(adminIDs []uint64) error {
	if len(adminIDs) == 0 {
		return nil
	}
	securitySvc := service.NewAdminSecurityService()
	seen := make(map[uint64]struct{}, len(adminIDs))
	for _, adminID := range adminIDs {
		if adminID == 0 {
			continue
		}
		if _, ok := seen[adminID]; ok {
			continue
		}
		seen[adminID] = struct{}{}
		if err := securitySvc.RevokeAllSessions(adminID); err != nil {
			return err
		}
	}
	return nil
}
