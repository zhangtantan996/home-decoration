package handler

import (
	"home-decoration-server/internal/config"
	"home-decoration-server/internal/service"
	imgutil "home-decoration-server/internal/utils/image"
	"home-decoration-server/pkg/response"

	"github.com/gin-gonic/gin"
)

var (
	userService         = &service.UserService{}
	providerService     = &service.ProviderService{}
	caseService         = &service.CaseService{}
	projectService      = &service.ProjectService{}
	escrowService       = &service.EscrowService{}
	bookingService      = &service.BookingService{}
	materialShopService = &service.MaterialShopService{}
	wechatAuthService   *service.WechatAuthService
	wechatH5AuthService *service.WechatH5AuthService
	jwtConfig           *config.JWTConfig
)

// InitHandlers 初始化处理器
func InitHandlers(cfg *config.Config) {
	jwtConfig = &cfg.JWT
	service.InitJWT(cfg.JWT.Secret)
	wechatAuthService = service.NewWechatAuthService(cfg.WechatMini)
	wechatH5AuthService = service.NewWechatH5AuthService(cfg.WechatH5)
}

// HealthCheck 健康检查
func HealthCheck(c *gin.Context) {
	response.Success(c, gin.H{
		"status":  "ok",
		"service": "home-decoration-server",
	})
}

// ========== 认证相关 ==========

// Register 用户注册
func Register(c *gin.Context) {
	var req service.RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误: "+err.Error())
		return
	}

	tokenResp, user, err := userService.Register(&req, jwtConfig)
	if err != nil {
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

	tokenResp, user, err := userService.Login(&req, jwtConfig)
	if err != nil {
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
		Phone string `json:"phone" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请输入手机号")
		return
	}

	// 获取客户端IP
	clientIP := c.ClientIP()

	debugCode, err := service.SendSMSCode(req.Phone, clientIP)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	data := gin.H{
		"expiresIn": 300,
	}
	// 非生产环境返回调试验证码，方便联调（生产环境不会返回）
	if debugCode != "" {
		data["debugCode"] = debugCode
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
	userIdFloat := c.GetFloat64("userId")
	userId := uint64(userIdFloat)

	user, err := userService.GetUserByID(userId)
	if err != nil {
		response.NotFound(c, "用户不存在")
		return
	}

	response.Success(c, gin.H{
		"id":       user.ID,
		"publicId": user.PublicID,
		"phone":    user.Phone,
		"nickname": user.Nickname,
		"avatar":   imgutil.GetFullImageURL(user.Avatar),
		"userType": user.UserType,
	})
}

// UpdateProfile 更新用户信息
func UpdateProfile(c *gin.Context) {
	userIdFloat := c.GetFloat64("userId")
	userId := uint64(userIdFloat)

	var req struct {
		Nickname string `json:"nickname"`
		Avatar   string `json:"avatar"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}

	if err := userService.UpdateUser(userId, req.Nickname, req.Avatar); err != nil {
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
	userId := uint64(c.GetFloat64("userId"))

	var req service.CreateProjectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误: "+err.Error())
		return
	}

	// 如果是业主创建，强制设置ownerId
	req.OwnerID = userId

	project, err := projectService.CreateProject(&req)
	if err != nil {
		response.ServerError(c, err.Error())
		return
	}

	response.SuccessWithMessage(c, "项目创建成功", gin.H{"id": project.ID})
}

// ListProjects 项目列表
func ListProjects(c *gin.Context) {
	userId := c.GetUint64("userId")
	userType := int8(c.GetFloat64("userType"))

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

	detail, err := projectService.GetProjectDetail(id)
	if err != nil {
		response.NotFound(c, "项目不存在")
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

	list, total, err := projectService.GetProjectLogs(projectId, 1, 20)
	if err != nil {
		response.ServerError(c, "查询失败")
		return
	}

	response.PageSuccess(c, list, total, 1, 20)
}

// CreateProjectLog 创建施工日志
func CreateProjectLog(c *gin.Context) {
	userId := uint64(c.GetFloat64("userId"))
	projectId := parseUint64(c.Param("id"))

	var req struct {
		Description string `json:"description"`
		Photos      string `json:"photos"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}

	if err := projectService.CreateWorkLog(projectId, userId, req.Description, req.Photos); err != nil {
		response.ServerError(c, "创建日志失败")
		return
	}

	response.Success(c, gin.H{"message": "日志上传成功"})
}

// GetMilestones 获取验收节点
func GetMilestones(c *gin.Context) {
	// 已经在GetProjectDetail中返回，可以预留为独立接口
	response.Success(c, []gin.H{})
}

// AcceptMilestone 验收节点
func AcceptMilestone(c *gin.Context) {
	// TODO: 实现验收逻辑
	response.Success(c, gin.H{"message": "验收成功"})
}

// ========== 项目阶段 ==========

// GetProjectPhases 获取项目工程阶段
func GetProjectPhases(c *gin.Context) {
	projectId := parseUint64(c.Param("id"))
	if projectId == 0 {
		response.BadRequest(c, "无效项目ID")
		return
	}

	phases, err := projectService.GetProjectPhases(projectId)
	if err != nil {
		response.ServerError(c, "查询失败")
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

	detail, err := escrowService.GetEscrowDetail(projectId)
	if err != nil {
		response.ServerError(c, "查询失败")
		return
	}

	response.Success(c, detail)
}

// Deposit 存入托管
func Deposit(c *gin.Context) {
	userId := uint64(c.GetFloat64("userId"))
	projectId := parseUint64(c.Param("id"))

	var req struct {
		Amount      float64 `json:"amount" binding:"required"`
		MilestoneID uint64  `json:"milestoneId"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}

	if err := escrowService.Deposit(projectId, userId, req.Amount, req.MilestoneID); err != nil {
		response.ServerError(c, err.Error())
		return
	}

	response.Success(c, gin.H{"message": "存入成功"})
}

// ReleaseFunds 释放资金
func ReleaseFunds(c *gin.Context) {
	userId := uint64(c.GetFloat64("userId"))
	projectId := parseUint64(c.Param("id"))

	var req struct {
		MilestoneID uint64 `json:"milestoneId" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}

	if err := escrowService.ReleaseFunds(projectId, userId, req.MilestoneID); err != nil {
		response.ServerError(c, err.Error())
		return
	}

	response.Success(c, gin.H{"message": "资金释放成功"})
}

// ========== 关注/收藏 ==========

// FollowProvider 关注服务商
func FollowProvider(c *gin.Context) {
	userID := c.GetUint64("userId")
	providerID := parseUint64(c.Param("id"))
	targetType := c.Query("type")
	if targetType == "" {
		targetType = "designer"
	}

	if err := providerService.FollowProvider(userID, providerID, targetType); err != nil {
		response.ServerError(c, "关注失败")
		return
	}

	response.Success(c, gin.H{"message": "关注成功"})
}

// UnfollowProvider 取消关注服务商
func UnfollowProvider(c *gin.Context) {
	userID := c.GetUint64("userId")
	providerID := parseUint64(c.Param("id"))
	targetType := c.Query("type")
	if targetType == "" {
		targetType = "designer"
	}

	if err := providerService.UnfollowProvider(userID, providerID, targetType); err != nil {
		response.ServerError(c, "取消关注失败")
		return
	}

	response.Success(c, gin.H{"message": "已取消关注"})
}

// FavoriteProvider 收藏服务商
func FavoriteProvider(c *gin.Context) {
	userID := c.GetUint64("userId")
	providerID := parseUint64(c.Param("id"))
	targetType := c.Query("type")
	if targetType == "" {
		targetType = "provider"
	}

	if err := providerService.FavoriteProvider(userID, providerID, targetType); err != nil {
		response.ServerError(c, "收藏失败")
		return
	}

	response.Success(c, gin.H{"message": "收藏成功"})
}

// UnfavoriteProvider 取消收藏服务商
func UnfavoriteProvider(c *gin.Context) {
	userID := c.GetUint64("userId")
	providerID := parseUint64(c.Param("id"))
	targetType := c.Query("type")
	if targetType == "" {
		targetType = "provider"
	}

	if err := providerService.UnfavoriteProvider(userID, providerID, targetType); err != nil {
		response.ServerError(c, "取消收藏失败")
		return
	}

	response.Success(c, gin.H{"message": "已取消收藏"})
}

// GetProviderUserStatus 获取用户对服务商的关注/收藏状态
func GetProviderUserStatus(c *gin.Context) {
	userID := c.GetUint64("userId")
	providerID := parseUint64(c.Param("id"))

	status, err := providerService.GetUserProviderStatus(userID, providerID)
	if err != nil {
		response.ServerError(c, "查询失败")
		return
	}

	response.Success(c, status)
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
