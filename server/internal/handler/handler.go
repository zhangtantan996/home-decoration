package handler

import (
	"home-decoration-server/internal/config"
	"home-decoration-server/internal/service"
	"home-decoration-server/pkg/response"

	"github.com/gin-gonic/gin"
)

var (
	userService     = &service.UserService{}
	providerService = &service.ProviderService{}
	projectService  = &service.ProjectService{}
	escrowService   = &service.EscrowService{}
	jwtConfig       *config.JWTConfig
)

// InitHandlers 初始化处理器
func InitHandlers(cfg *config.Config) {
	jwtConfig = &cfg.JWT
	service.InitJWT(cfg.JWT.Secret)
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
		response.Error(c, 400, err.Error())
		return
	}

	response.SuccessWithMessage(c, "注册成功", gin.H{
		"token":        tokenResp.Token,
		"refreshToken": tokenResp.RefreshToken,
		"expiresIn":    tokenResp.ExpiresIn,
		"user": gin.H{
			"id":       user.ID,
			"phone":    user.Phone,
			"nickname": user.Nickname,
			"avatar":   user.Avatar,
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
		response.Error(c, 400, err.Error())
		return
	}

	response.Success(c, gin.H{
		"token":        tokenResp.Token,
		"refreshToken": tokenResp.RefreshToken,
		"expiresIn":    tokenResp.ExpiresIn,
		"user": gin.H{
			"id":       user.ID,
			"phone":    user.Phone,
			"nickname": user.Nickname,
			"avatar":   user.Avatar,
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

	// TODO: 实际项目接入短信服务
	// 测试环境验证码固定为 123456
	response.SuccessWithMessage(c, "验证码已发送", gin.H{
		"message": "测试验证码: 123456",
	})
}

// RefreshToken 刷新Token
func RefreshToken(c *gin.Context) {
	// TODO: 实现刷新Token逻辑
	response.Success(c, gin.H{"token": "xxx"})
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
		"phone":    user.Phone,
		"nickname": user.Nickname,
		"avatar":   user.Avatar,
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

	provider, user, err := providerService.GetProviderByID(id)
	if err != nil {
		response.NotFound(c, "设计师不存在")
		return
	}

	response.Success(c, gin.H{
		"id":            provider.ID,
		"userId":        provider.UserID,
		"companyName":   provider.CompanyName,
		"nickname":      user.Nickname,
		"avatar":        user.Avatar,
		"rating":        provider.Rating,
		"restoreRate":   provider.RestoreRate,
		"budgetControl": provider.BudgetControl,
		"completedCnt":  provider.CompletedCnt,
		"verified":      provider.Verified,
	})
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
	provider, user, err := providerService.GetProviderByID(id)
	if err != nil {
		response.NotFound(c, "公司不存在")
		return
	}

	response.Success(c, gin.H{
		"id":          provider.ID,
		"companyName": provider.CompanyName,
		"nickname":    user.Nickname,
		"avatar":      user.Avatar,
		"rating":      provider.Rating,
	})
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
	provider, user, err := providerService.GetProviderByID(id)
	if err != nil {
		response.NotFound(c, "工长不存在")
		return
	}

	response.Success(c, gin.H{
		"id":          provider.ID,
		"companyName": provider.CompanyName,
		"nickname":    user.Nickname,
		"rating":      provider.Rating,
	})
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
	userId := uint64(c.GetFloat64("userId"))
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
