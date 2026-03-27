package handler

import (
	"errors"
	"home-decoration-server/internal/config"
	"home-decoration-server/internal/repository"
	"home-decoration-server/internal/service"
	imgutil "home-decoration-server/internal/utils/image"
	"home-decoration-server/pkg/response"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

var (
	userService         = &service.UserService{}
	providerService     = &service.ProviderService{}
	caseService         = &service.CaseService{}
	projectService      = &service.ProjectService{}
	escrowService       = &service.EscrowService{}
	bookingService      = &service.BookingService{}
	paymentService      = service.NewPaymentService(nil)
	materialShopService = &service.MaterialShopService{}
	demandService       = service.NewDemandService()
	wechatAuthService   *service.WechatAuthService
	wechatH5AuthService *service.WechatH5AuthService
	jwtConfig           *config.JWTConfig
	wechatH5BasePath    string
)

const (
	projectCreateLegacyDisabledCode           = "PROJECT_CREATE_LEGACY_DISABLED"
	projectBillLegacyDisabledCode             = "PROJECT_BILL_LEGACY_DISABLED"
	projectConstructionConfirmLegacyCode      = "PROJECT_CONSTRUCTION_CONFIRM_LEGACY_DISABLED"
	projectConstructionQuoteConfirmLegacyCode = "PROJECT_CONSTRUCTION_QUOTE_CONFIRM_LEGACY_DISABLED"
	projectCompleteLegacyDisabledCode         = "PROJECT_COMPLETE_LEGACY_DISABLED"
)

// InitHandlers 初始化处理器
func InitHandlers(cfg *config.Config) {
	jwtConfig = &cfg.JWT
	wechatH5BasePath = cfg.WechatH5.BasePath
	service.InitJWT(cfg.JWT.Secret)
	wechatAuthService = service.NewWechatAuthService(cfg.WechatMini)
	wechatH5AuthService = service.NewWechatH5AuthService(cfg.WechatH5)
}

func getCurrentUserID(c *gin.Context) uint64 {
	if userID := c.GetUint64("userId"); userID > 0 {
		return userID
	}
	return uint64(c.GetFloat64("userId"))
}

func getCurrentUserType(c *gin.Context) int8 {
	if raw, ok := c.Get("userType"); ok {
		switch value := raw.(type) {
		case int8:
			return value
		case int:
			return int8(value)
		case uint8:
			return int8(value)
		case uint:
			return int8(value)
		case float64:
			return int8(value)
		}
	}
	return int8(c.GetFloat64("userType"))
}

func respondScopedAccessError(c *gin.Context, err error, fallback string) {
	if err == nil {
		return
	}
	message := err.Error()
	if strings.TrimSpace(message) == "" {
		message = fallback
	}
	switch {
	case strings.Contains(message, "无权"):
		response.Forbidden(c, message)
	case strings.Contains(message, "不存在"), strings.Contains(message, "未找到"):
		response.NotFound(c, message)
	default:
		response.ServerError(c, message)
	}
}

func respondDomainMutationError(c *gin.Context, err error, fallback string) {
	if err == nil {
		return
	}
	message := strings.TrimSpace(err.Error())
	if message == "" {
		message = fallback
	}
	switch {
	case strings.Contains(message, "无权"):
		response.Forbidden(c, message)
	case strings.Contains(message, "不存在"), strings.Contains(message, "未找到"):
		response.NotFound(c, message)
	case strings.Contains(message, "冲突"),
		strings.Contains(message, "不匹配"),
		strings.Contains(message, "不属于"),
		strings.Contains(message, "当前状态"),
		strings.Contains(message, "状态不正确"),
		strings.Contains(message, "状态不允许"),
		strings.Contains(message, "已发送"),
		strings.Contains(message, "已存在"),
		strings.Contains(message, "已锁定"),
		strings.Contains(message, "已归档"),
		strings.Contains(message, "已关闭"),
		strings.Contains(message, "已处理"),
		strings.Contains(message, "不能重复"),
		(strings.Contains(message, "不可") && !strings.Contains(message, "参数")):
		response.Conflict(c, message)
	default:
		response.BadRequest(c, message)
	}
}

func respondAdminRBACMutationError(c *gin.Context, err error, fallback string) {
	if err == nil {
		return
	}
	message := strings.TrimSpace(err.Error())
	if message == "" {
		message = fallback
	}
	switch {
	case strings.Contains(message, "不存在"), strings.Contains(message, "未找到"):
		response.NotFound(c, message)
	case strings.Contains(message, "必须独立分配"),
		strings.Contains(message, "不能同时分配"),
		strings.Contains(message, "已禁用"),
		strings.Contains(message, "只能分配只读权限"):
		response.Conflict(c, message)
	default:
		response.BadRequest(c, message)
	}
}

func respondLegacyConflict(c *gin.Context, message, errorCode string) {
	c.JSON(http.StatusConflict, response.Response{
		Code:    409,
		Message: message,
		Data: gin.H{
			"errorCode": errorCode,
		},
	})
}

// HealthCheck 健康检查
func HealthCheck(c *gin.Context) {
	smsAuditHealth := repository.RefreshSMSAuditLogHealth()
	userAuthHealth := repository.RefreshUserAuthSchemaHealth()
	merchantOnboardingHealth := repository.RefreshMerchantOnboardingSchemaHealth()
	bookingP0Health := repository.RefreshBookingP0SchemaHealth()
	projectRiskHealth := repository.RefreshProjectRiskSchemaHealth()
	auditLogHealth := repository.RefreshAuditLogSchemaHealth()
	commerceRuntimeHealth := repository.RefreshCommerceRuntimeSchemaHealth()
	alerts := repository.CurrentOperationalAlerts()
	overallStatus := "ok"
	if len(alerts) > 0 ||
		smsAuditHealth.Status != "ok" ||
		userAuthHealth.Status != "ok" ||
		merchantOnboardingHealth.Status != "ok" ||
		bookingP0Health.Status != "ok" ||
		projectRiskHealth.Status != "ok" ||
		auditLogHealth.Status != "ok" ||
		commerceRuntimeHealth.Status != "ok" {
		overallStatus = "degraded"
	}

	response.Success(c, gin.H{
		"status":               overallStatus,
		"service":              "home-decoration-server",
		"alertCount":           len(alerts),
		"alerts":               alerts,
		"notificationRealtime": getNotificationRealtimeHealth(),
		"checks": gin.H{
			"smsAuditLog":              smsAuditHealth,
			"userAuthSchema":           userAuthHealth,
			"merchantOnboardingSchema": merchantOnboardingHealth,
			"bookingP0Schema":          bookingP0Health,
			"projectRiskSchema":        projectRiskHealth,
			"auditLogSchema":           auditLogHealth,
			"commerceRuntimeSchema":    commerceRuntimeHealth,
		},
	})
}

func getNotificationRealtimeHealth() gin.H {
	gateway := getNotificationRealtimeGateway()
	if gateway == nil {
		return gin.H{
			"enabled": false,
		}
	}

	stats := gateway.GetStats()
	return gin.H{
		"enabled":          true,
		"totalConnections": stats.TotalConnections,
		"totalUsers":       stats.TotalUsers,
		"droppedMessages":  stats.DroppedMessages,
	}
}

// ========== 认证相关 ==========

// Register 用户注册
func Register(c *gin.Context) {
	var req service.RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误: "+err.Error())
		return
	}
	req.ClientIP = c.ClientIP()

	tokenResp, user, err := userService.Register(&req, jwtConfig)
	if err != nil {
		if repository.IsSchemaMismatchError(err) {
			response.ServiceUnavailable(c, repository.SchemaServiceUnavailableMessage("认证服务"))
			return
		}
		response.BadRequest(c, err.Error())
		return
	}

	roleCtx, _ := service.GetRoleContextForResponse(user)
	providerID := uint64(0)
	if roleCtx.ProviderID != nil {
		providerID = *roleCtx.ProviderID
	}

	response.SuccessWithMessage(c, "注册成功", gin.H{
		"token":           tokenResp.Token,
		"refreshToken":    tokenResp.RefreshToken,
		"expiresIn":       tokenResp.ExpiresIn,
		"tinodeToken":     tokenResp.TinodeToken,
		"tinodeError":     tokenResp.TinodeError,
		"activeRole":      roleCtx.ActiveRole,
		"providerId":      providerID,
		"providerSubType": roleCtx.ProviderSubType,
		"user": gin.H{
			"id":       user.ID,
			"publicId": user.PublicID,
			"phone":    user.Phone,
			"nickname": user.Nickname,
			"avatar":   imgutil.GetFullImageURL(user.Avatar),
			"userType": user.UserType,
		},
	})
}

// Login 用户登录
func Login(c *gin.Context) {
	var req service.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误: "+err.Error())
		return
	}
	req.ClientIP = c.ClientIP()

	tokenResp, user, err := userService.Login(&req, jwtConfig)
	if err != nil {
		if repository.IsSchemaMismatchError(err) {
			response.ServiceUnavailable(c, repository.SchemaServiceUnavailableMessage("认证服务"))
			return
		}
		response.BadRequest(c, err.Error())
		return
	}

	roleCtx, _ := service.GetRoleContextForResponse(user)
	providerID := uint64(0)
	if roleCtx.ProviderID != nil {
		providerID = *roleCtx.ProviderID
	}

	response.Success(c, gin.H{
		"token":           tokenResp.Token,
		"refreshToken":    tokenResp.RefreshToken,
		"expiresIn":       tokenResp.ExpiresIn,
		"tinodeToken":     tokenResp.TinodeToken,
		"tinodeError":     tokenResp.TinodeError,
		"activeRole":      roleCtx.ActiveRole,
		"providerId":      providerID,
		"providerSubType": roleCtx.ProviderSubType,
		"user": gin.H{
			"id":       user.ID,
			"publicId": user.PublicID,
			"phone":    user.Phone,
			"nickname": user.Nickname,
			"avatar":   imgutil.GetFullImageURL(user.Avatar),
			"userType": user.UserType,
		},
	})
}

// SendCode 发送验证码
func SendCode(c *gin.Context) {
	var req struct {
		Phone        string `json:"phone" binding:"required"`
		Purpose      string `json:"purpose" binding:"required"`
		CaptchaToken string `json:"captchaToken"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请输入手机号和验证码用途")
		return
	}

	purpose, err := service.NormalizeSMSPurpose(req.Purpose)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	// 获取客户端IP
	clientIP := c.ClientIP()

	sendResult, err := service.SendSMSCode(req.Phone, purpose, clientIP, req.CaptchaToken)
	if err != nil {
		if repository.IsSchemaMismatchError(err) {
			response.ServiceUnavailable(c, repository.SchemaServiceUnavailableMessage("认证服务"))
			return
		}
		response.BadRequest(c, err.Error())
		return
	}

	data := gin.H{
		"expiresIn": 300,
		"requestId": sendResult.RequestID,
	}
	if sendResult.DebugOnly && sendResult.DebugCode != "" {
		data["debugCode"] = sendResult.DebugCode
		data["debugOnly"] = true
	}

	response.SuccessWithMessage(c, "验证码已发送", data)
}

// RefreshToken 刷新Token（带重放检测）
func RefreshToken(c *gin.Context) {
	var req struct {
		RefreshToken string `json:"refreshToken" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "缺少刷新令牌")
		return
	}

	// 使用新的 TokenService（带 Redis 重放检测）
	tokenService := &service.TokenService{}
	tokenResp, err := tokenService.RefreshTokens(req.RefreshToken)
	if err != nil {
		response.Unauthorized(c, err.Error())
		return
	}

	activeRole := "owner"
	providerSubType := ""
	providerID := uint64(0)

	if roleContext, ok := service.GetRoleContextFromClaimsForResponse(tokenResp.AccessToken); ok {
		activeRole = roleContext.ActiveRole
		providerSubType = roleContext.ProviderSubType
		if roleContext.ProviderID != nil {
			providerID = *roleContext.ProviderID
		}
	} else if roleContext, ok := service.GetRoleContextFromClaimsForResponse(req.RefreshToken); ok {
		activeRole = roleContext.ActiveRole
		providerSubType = roleContext.ProviderSubType
		if roleContext.ProviderID != nil {
			providerID = *roleContext.ProviderID
		}
	}

	if activeRole != "provider" {
		providerSubType = ""
		providerID = 0
	}

	response.Success(c, gin.H{
		"token":           tokenResp.AccessToken,
		"refreshToken":    tokenResp.RefreshToken,
		"expiresIn":       tokenResp.ExpiresIn,
		"activeRole":      activeRole,
		"providerSubType": providerSubType,
		"providerId":      providerID,
	})
}

// RefreshTinodeToken 刷新 Tinode Token
func RefreshTinodeToken(c *gin.Context) {
	userId := c.GetUint64("userId")
	if userId == 0 {
		response.Unauthorized(c, "请先登录")
		return
	}

	user, err := userService.GetUserByID(userId)
	if err != nil {
		response.NotFound(c, "用户不存在")
		return
	}

	tinodeToken, tinodeErr := userService.RefreshTinodeToken(user)
	if tinodeErr != nil {
		response.Success(c, gin.H{
			"tinodeToken": "",
			"tinodeError": tinodeErr.Error(),
		})
		return
	}

	response.Success(c, gin.H{
		"tinodeToken": tinodeToken,
		"tinodeError": "",
	})
}

// ========== 用户相关 ==========

// GetProfile 获取用户信息
func GetProfile(c *gin.Context) {
	userID := getCurrentUserID(c)
	if userID == 0 {
		response.Unauthorized(c, "请先登录")
		return
	}

	user, err := userService.GetUserByID(userID)
	if err != nil {
		response.NotFound(c, "用户不存在")
		return
	}

	birthday := ""
	if user.Birthday != nil {
		birthday = user.Birthday.Format("2006-01-02")
	}

	response.Success(c, gin.H{
		"id":       user.ID,
		"publicId": user.PublicID,
		"phone":    user.Phone,
		"nickname": user.Nickname,
		"avatar":   imgutil.GetFullImageURL(user.Avatar),
		"birthday": birthday,
		"bio":      user.Bio,
		"userType": user.UserType,
	})
}

// UpdateProfile 更新用户信息
func UpdateProfile(c *gin.Context) {
	userID := getCurrentUserID(c)
	if userID == 0 {
		response.Unauthorized(c, "请先登录")
		return
	}

	var req struct {
		Nickname string `json:"nickname"`
		Avatar   string `json:"avatar"`
		Birthday string `json:"birthday"`
		Bio      string `json:"bio"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}

	var birthday *time.Time
	if trimmedBirthday := strings.TrimSpace(req.Birthday); trimmedBirthday != "" {
		parsedBirthday, err := time.Parse("2006-01-02", trimmedBirthday)
		if err != nil {
			response.BadRequest(c, "生日格式错误，请使用 YYYY-MM-DD")
			return
		}
		if parsedBirthday.After(time.Now()) {
			response.BadRequest(c, "生日不能晚于今天")
			return
		}
		birthday = &parsedBirthday
	}

	bio := strings.TrimSpace(req.Bio)
	if len([]rune(bio)) > 200 {
		response.BadRequest(c, "个人简介不能超过200个字符")
		return
	}

	if err := userService.UpdateUser(userID, req.Nickname, req.Avatar, birthday, bio); err != nil {
		response.ServerError(c, "更新失败")
		return
	}

	response.SuccessWithMessage(c, "更新成功", nil)
}

// ========== 设计师 ==========

// ListDesigners 设计师列表
func ListDesigners(c *gin.Context) {
	var query service.ProviderQuery
	if err := c.ShouldBindQuery(&query); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}

	list, total, err := providerService.ListDesigners(&query)
	if err != nil {
		response.ServerError(c, "查询失败")
		return
	}

	response.PageSuccess(c, list, total, query.Page, query.PageSize)
}

// GetDesigner 设计师详情
func GetDesigner(c *gin.Context) {
	id := parseUint64(c.Param("id"))
	if id == 0 {
		response.BadRequest(c, "ID无效")
		return
	}

	detail, err := providerService.GetProviderDetail(id)
	if err != nil {
		response.NotFound(c, "设计师不存在")
		return
	}

	response.Success(c, detail)
}

// ========== 装修公司 ==========

// ListCompanies 装修公司列表
func ListCompanies(c *gin.Context) {
	var query service.ProviderQuery
	c.ShouldBindQuery(&query)

	list, total, err := providerService.ListCompanies(&query)
	if err != nil {
		response.ServerError(c, "查询失败")
		return
	}

	response.PageSuccess(c, list, total, query.Page, query.PageSize)
}

// GetCompany 装修公司详情
func GetCompany(c *gin.Context) {
	id := parseUint64(c.Param("id"))
	if id == 0 {
		response.BadRequest(c, "ID无效")
		return
	}

	detail, err := providerService.GetProviderDetail(id)
	if err != nil {
		response.NotFound(c, "公司不存在")
		return
	}

	response.Success(c, detail)
}

// ========== 工长 ==========

// ListForemen 工长列表
func ListForemen(c *gin.Context) {
	var query service.ProviderQuery
	c.ShouldBindQuery(&query)

	list, total, err := providerService.ListForemen(&query)
	if err != nil {
		response.ServerError(c, "查询失败")
		return
	}

	response.PageSuccess(c, list, total, query.Page, query.PageSize)
}

// GetForeman 工长详情
func GetForeman(c *gin.Context) {
	id := parseUint64(c.Param("id"))
	if id == 0 {
		response.BadRequest(c, "ID无效")
		return
	}

	detail, err := providerService.GetProviderDetail(id)
	if err != nil {
		response.NotFound(c, "工长不存在")
		return
	}

	response.Success(c, detail)
}

// ========== 服务商通用 (关注/收藏) ==========

// ListProviders 统一服务商列表
func ListProviders(c *gin.Context) {
	var query service.ProviderQuery
	// 这里忽略绑定错误，因为 Type 是字符串，其他字段（如 Page）有默认值或手动处理更稳妥
	_ = c.ShouldBindQuery(&query)

	list, total, err := providerService.ListProviders(&query)
	if err != nil {
		response.ServerError(c, "查询失败")
		return
	}

	response.PageSuccess(c, list, total, query.Page, query.PageSize)
}

// ========== 服务商案例、评价 ==========

// GetProviderCases 获取服务商案例列表
func GetProviderCases(c *gin.Context) {
	id := parseUint64(c.Param("id"))
	if id == 0 {
		response.BadRequest(c, "ID无效")
		return
	}

	page := 1
	pageSize := 10
	// 从 Query 获取分页参数
	if p := c.Query("page"); p != "" {
		page = int(parseUint64(p))
	}
	if ps := c.Query("pageSize"); ps != "" {
		pageSize = int(parseUint64(ps))
	}

	list, total, err := providerService.GetProviderCases(id, page, pageSize)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			response.NotFound(c, "服务商不存在")
			return
		}
		response.ServerError(c, "查询失败")
		return
	}

	response.PageSuccess(c, list, total, page, pageSize)
}

// GetProviderReviews 获取服务商评价列表
func GetProviderReviews(c *gin.Context) {
	id := parseUint64(c.Param("id"))
	if id == 0 {
		response.BadRequest(c, "ID无效")
		return
	}

	page := 1
	pageSize := 10
	if p := c.Query("page"); p != "" {
		page = int(parseUint64(p))
	}
	if ps := c.Query("pageSize"); ps != "" {
		pageSize = int(parseUint64(ps))
	}
	filter := c.Query("filter") // all, pic, good, 或标签名

	list, total, err := providerService.GetProviderReviews(id, page, pageSize, filter)
	if err != nil {
		response.ServerError(c, "查询失败")
		return
	}

	response.PageSuccess(c, list, total, page, pageSize)
}

// GetReviewStats 获取评价统计
func GetReviewStats(c *gin.Context) {
	id := parseUint64(c.Param("id"))
	if id == 0 {
		response.BadRequest(c, "ID无效")
		return
	}

	stats, err := providerService.GetReviewStats(id)
	if err != nil {
		response.ServerError(c, "查询失败")
		return
	}

	response.Success(c, stats)
}

// ========== 项目 ==========

// CreateProject 创建项目
func CreateProject(c *gin.Context) {
	respondLegacyConflict(c, "旧项目创建入口已禁用，请改用施工确认成交链路创建项目", projectCreateLegacyDisabledCode)
}

// ListProjects 项目列表
func ListProjects(c *gin.Context) {
	userId := getCurrentUserID(c)
	userType := getCurrentUserType(c)

	page := 1
	pageSize := 10
	// TODO: 从Query获取分页参数

	list, total, err := projectService.ListProjects(userId, userType, page, pageSize)
	if err != nil {
		response.ServerError(c, "查询失败")
		return
	}

	response.PageSuccess(c, list, total, page, pageSize)
}

// GetProject 项目详情
func GetProject(c *gin.Context) {
	id := parseUint64(c.Param("id"))
	if id == 0 {
		response.BadRequest(c, "无效ID")
		return
	}

	detail, err := projectService.GetProjectDetailForOwner(id, getCurrentUserID(c))
	if err != nil {
		respondScopedAccessError(c, err, "查询项目失败")
		return
	}

	response.Success(c, detail)
}

// UpdateProject 更新项目
func UpdateProject(c *gin.Context) {
	// TODO: 实现更新逻辑
	response.Success(c, gin.H{"message": "项目更新成功"})
}

// GetProjectLogs 获取施工日志
func GetProjectLogs(c *gin.Context) {
	projectId := parseUint64(c.Param("id"))

	list, total, err := projectService.GetProjectLogsForOwner(projectId, getCurrentUserID(c), 1, 20)
	if err != nil {
		respondScopedAccessError(c, err, "查询日志失败")
		return
	}

	response.PageSuccess(c, list, total, 1, 20)
}

// CreateProjectLog 创建施工日志
func CreateProjectLog(c *gin.Context) {
	response.Forbidden(c, "业主侧施工日志入口已禁用，请使用商家侧施工日志入口")
}

// GetMilestones 获取验收节点
func GetMilestones(c *gin.Context) {
	projectID := parseUint64(c.Param("id"))
	if projectID == 0 {
		response.BadRequest(c, "无效项目ID")
		return
	}

	milestones, err := projectService.GetProjectMilestonesForOwner(projectID, getCurrentUserID(c))
	if err != nil {
		respondScopedAccessError(c, err, "查询节点失败")
		return
	}

	response.Success(c, gin.H{"milestones": milestones})
}

// ConfirmProjectConstruction 确认施工方与工长
func ConfirmProjectConstruction(c *gin.Context) {
	respondLegacyConflict(c, "业主侧旧施工方确认入口已禁用，请改用施工报价确认主链", projectConstructionConfirmLegacyCode)
}

// ConfirmProjectConstructionQuote 确认施工报价
func ConfirmProjectConstructionQuote(c *gin.Context) {
	respondLegacyConflict(c, "业主侧旧施工报价确认入口已禁用，请改用报价确认主链", projectConstructionQuoteConfirmLegacyCode)
}

// StartProject 显式开工
func StartProject(c *gin.Context) {
	projectID := parseUint64(c.Param("id"))
	if projectID == 0 {
		response.BadRequest(c, "无效项目ID")
		return
	}

	userID := getCurrentUserID(c)
	var req service.StartProjectRequest
	if c.Request.ContentLength > 0 {
		if err := c.ShouldBindJSON(&req); err != nil {
			response.BadRequest(c, "参数错误")
			return
		}
	}

	project, err := projectService.StartProject(projectID, userID, &req)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Success(c, gin.H{
		"message": "项目已开工",
		"project": project,
	})
}

// SubmitMilestone 提交节点完成，进入待验收
func SubmitMilestone(c *gin.Context) {
	projectID := parseUint64(c.Param("id"))
	if projectID == 0 {
		response.BadRequest(c, "无效项目ID")
		return
	}

	milestoneID := parseUint64(c.Param("milestoneId"))
	if milestoneID == 0 {
		response.BadRequest(c, "无效节点ID")
		return
	}

	providerID := c.GetUint64("providerId")
	milestone, err := projectService.SubmitMilestone(projectID, providerID, milestoneID)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Success(c, gin.H{
		"message":   "节点已提交验收",
		"milestone": milestone,
	})
}

// AcceptMilestone 验收节点
func AcceptMilestone(c *gin.Context) {
	projectID := parseUint64(c.Param("id"))
	if projectID == 0 {
		response.BadRequest(c, "无效项目ID")
		return
	}

	userID := getCurrentUserID(c)
	milestoneID := parseUint64(c.Param("milestoneId"))
	if milestoneID == 0 {
		var req struct {
			MilestoneID uint64 `json:"milestoneId" binding:"required"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			response.BadRequest(c, "参数错误")
			return
		}
		milestoneID = req.MilestoneID
	}
	if milestoneID == 0 {
		response.BadRequest(c, "无效节点ID")
		return
	}

	milestone, err := projectService.AcceptMilestone(projectID, userID, milestoneID)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Success(c, gin.H{
		"message":   "验收成功",
		"milestone": milestone,
	})
}

// RejectMilestone 驳回节点验收
func RejectMilestone(c *gin.Context) {
	projectID := parseUint64(c.Param("id"))
	if projectID == 0 {
		response.BadRequest(c, "无效项目ID")
		return
	}

	milestoneID := parseUint64(c.Param("milestoneId"))
	if milestoneID == 0 {
		response.BadRequest(c, "无效节点ID")
		return
	}

	userID := getCurrentUserID(c)
	var req struct {
		Reason string `json:"reason"`
	}
	if c.Request.ContentLength > 0 {
		if err := c.ShouldBindJSON(&req); err != nil {
			response.BadRequest(c, "参数错误")
			return
		}
	}

	milestone, err := projectService.RejectMilestone(projectID, userID, milestoneID, req.Reason)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Success(c, gin.H{
		"message":   "节点已驳回",
		"milestone": milestone,
	})
}

// CompleteProject 显式收口项目为完工
func CompleteProject(c *gin.Context) {
	respondLegacyConflict(c, "旧项目完工入口已禁用，请改用商家提交完工材料并由业主在整体验收页处理", projectCompleteLegacyDisabledCode)
}

// ========== 项目阶段 ==========

// GetProjectPhases 获取项目工程阶段
func GetProjectPhases(c *gin.Context) {
	projectId := parseUint64(c.Param("id"))
	if projectId == 0 {
		response.BadRequest(c, "无效项目ID")
		return
	}

	phases, err := projectService.GetProjectPhasesForOwner(projectId, getCurrentUserID(c))
	if err != nil {
		respondScopedAccessError(c, err, "查询阶段失败")
		return
	}

	response.Success(c, gin.H{"phases": phases})
}

// UpdatePhase 更新阶段状态
func UpdatePhase(c *gin.Context) {
	phaseId := parseUint64(c.Param("phaseId"))
	if phaseId == 0 {
		response.BadRequest(c, "无效阶段ID")
		return
	}

	var req service.UpdatePhaseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}

	if err := projectService.UpdatePhase(phaseId, &req); err != nil {
		response.ServerError(c, err.Error())
		return
	}

	response.Success(c, gin.H{"message": "更新成功"})
}

// UpdatePhaseTask 更新子任务状态
func UpdatePhaseTask(c *gin.Context) {
	taskId := parseUint64(c.Param("taskId"))
	if taskId == 0 {
		response.BadRequest(c, "无效任务ID")
		return
	}

	var req service.UpdatePhaseTaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}

	if err := projectService.UpdatePhaseTask(taskId, &req); err != nil {
		response.ServerError(c, err.Error())
		return
	}

	response.Success(c, gin.H{"message": "更新成功"})
}

// ========== 托管账户 ==========

// GetEscrowAccount 获取托管账户详情
func GetEscrowAccount(c *gin.Context) {
	projectId := parseUint64(c.Param("id"))

	detail, err := escrowService.GetEscrowDetailForOwner(projectId, getCurrentUserID(c))
	if err != nil {
		respondScopedAccessError(c, err, "查询托管账户失败")
		return
	}

	response.Success(c, detail)
}

// Deposit 存入托管
func Deposit(c *gin.Context) {
	userId := getCurrentUserID(c)
	projectId := parseUint64(c.Param("id"))

	var req struct {
		Amount      float64 `json:"amount" binding:"required"`
		MilestoneID uint64  `json:"milestoneId"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}

	if err := escrowService.DepositForOwner(projectId, userId, req.Amount, req.MilestoneID); err != nil {
		respondDomainMutationError(c, err, "充值失败")
		return
	}

	response.Success(c, gin.H{"message": "存入成功"})
}

// ReleaseFunds 释放资金
func ReleaseFunds(c *gin.Context) {
	response.Forbidden(c, "业主侧直接放款入口已禁用，请改用验收结算链路")
}

// ========== 关注/收藏 ==========

func blockProviderSocialFeature(c *gin.Context) bool {
	response.Forbidden(c, "服务商关注/收藏功能暂未上线")
	return true
}

// FollowProvider 关注服务商
func FollowProvider(c *gin.Context) {
	if blockProviderSocialFeature(c) {
		return
	}
}

// UnfollowProvider 取消关注服务商
func UnfollowProvider(c *gin.Context) {
	if blockProviderSocialFeature(c) {
		return
	}
}

// FavoriteProvider 收藏服务商
func FavoriteProvider(c *gin.Context) {
	if blockProviderSocialFeature(c) {
		return
	}
}

// UnfavoriteProvider 取消收藏服务商
func UnfavoriteProvider(c *gin.Context) {
	if blockProviderSocialFeature(c) {
		return
	}
}

// GetProviderUserStatus 获取用户对服务商的关注/收藏状态
func GetProviderUserStatus(c *gin.Context) {
	if blockProviderSocialFeature(c) {
		return
	}
}

// ========== 主材门店 ==========

// ListMaterialShops 获取门店列表
func ListMaterialShops(c *gin.Context) {
	var query service.MaterialShopQuery
	_ = c.ShouldBindQuery(&query)

	list, total, err := materialShopService.ListMaterialShops(&query)
	if err != nil {
		response.ServerError(c, "查询失败")
		return
	}

	response.PageSuccess(c, list, total, query.Page, query.PageSize)
}

// GetMaterialShop 获取门店详情
func GetMaterialShop(c *gin.Context) {
	id := parseUint64(c.Param("id"))
	if id == 0 {
		response.BadRequest(c, "ID无效")
		return
	}

	detail, err := materialShopService.GetMaterialShopByID(id)
	if err != nil {
		response.NotFound(c, "门店不存在")
		return
	}

	response.Success(c, detail)
}

// ========== 工具函数 ==========

func parseUint64(s string) uint64 {
	var id uint64
	for _, c := range s {
		if c >= '0' && c <= '9' {
			id = id*10 + uint64(c-'0')
		}
	}
	return id
}
