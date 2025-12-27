package router

import (
	"home-decoration-server/internal/config"
	"home-decoration-server/internal/handler"
	"home-decoration-server/internal/middleware"
	"home-decoration-server/internal/ws"

	"github.com/gin-gonic/gin"
)

func Setup(cfg *config.Config, hub *ws.Hub, wsHandler *ws.Handler) *gin.Engine {
	r := gin.Default()

	// ✅ CORS白名单配置
	allowedOrigins := []string{
		"http://localhost:5173",        // Admin开发环境
		"http://localhost:5174",        // Admin开发环境备用端口
		"http://localhost:5175",        // Admin开发环境备用端口
		"http://localhost:5176",        // Admin开发环境备用端口
		"http://localhost:3000",        // Mobile开发环境
		"https://admin.yourdomain.com", // 生产环境（需替换）
	}

	// 全局中间件
	r.Use(middleware.Cors(allowedOrigins))
	r.Use(middleware.Logger())
	r.Use(middleware.Recovery())

	// API版本分组
	v1 := r.Group("/api/v1")
	{
		// 健康检查
		v1.GET("/health", handler.HealthCheck)

		// 认证相关 (无需登录)
		auth := v1.Group("/auth")
		{
			auth.POST("/register", handler.Register)
			auth.POST("/login", handler.Login)
			auth.POST("/send-code", handler.SendCode)
			auth.POST("/refresh", handler.RefreshToken)
		}

		// 公开的服务商查询
		v1.GET("/providers", handler.ListProviders)

		// 主材门店 (公开)
		materialShops := v1.Group("/material-shops")
		{
			materialShops.GET("", handler.ListMaterialShops)
			materialShops.GET("/:id", handler.GetMaterialShop)
		}

		// 需要认证的路由（普通用户）
		authorized := v1.Group("")
		authorized.Use(middleware.JWT(cfg.JWT.Secret))
		{
			// WebSocket 连接
			authorized.GET("/ws", handler.ServeWS(hub, wsHandler))

			// 用户相关
			user := authorized.Group("/user")
			{
				user.GET("/profile", handler.GetProfile)
				user.PUT("/profile", handler.UpdateProfile)
			}

			// 设计师
			designers := authorized.Group("/designers")
			{
				designers.GET("", handler.ListDesigners)
				designers.GET("/:id", handler.GetDesigner)
				designers.GET("/:id/cases", handler.GetProviderCases)
				designers.GET("/:id/reviews", handler.GetProviderReviews)
				designers.GET("/:id/review-stats", handler.GetReviewStats)
			}

			// 装修公司
			companies := authorized.Group("/companies")
			{
				companies.GET("", handler.ListCompanies)
				companies.GET("/:id", handler.GetCompany)
				companies.GET("/:id/cases", handler.GetProviderCases)
				companies.GET("/:id/reviews", handler.GetProviderReviews)
				companies.GET("/:id/review-stats", handler.GetReviewStats)
			}

			// 工长
			foremen := authorized.Group("/foremen")
			{
				foremen.GET("", handler.ListForemen)
				foremen.GET("/:id", handler.GetForeman)
				foremen.GET("/:id/cases", handler.GetProviderCases)
				foremen.GET("/:id/reviews", handler.GetProviderReviews)
				foremen.GET("/:id/review-stats", handler.GetReviewStats)
			}

			// 预约
			bookings := authorized.Group("/bookings")
			{
				bookings.POST("", handler.CreateBooking)
			}

			// 项目
			projects := authorized.Group("/projects")
			{
				projects.POST("", handler.CreateProject)
				projects.GET("", handler.ListProjects)
				projects.GET("/:id", handler.GetProject)
				projects.PUT("/:id", handler.UpdateProject)
				projects.GET("/:id/logs", handler.GetProjectLogs)
				projects.POST("/:id/logs", handler.CreateProjectLog)
				projects.GET("/:id/milestones", handler.GetMilestones)
				projects.POST("/:id/accept", handler.AcceptMilestone)

				// 托管账户
				projects.GET("/:id/escrow", handler.GetEscrowAccount)
				projects.POST("/:id/deposit", handler.Deposit)
				projects.POST("/:id/release", handler.ReleaseFunds)

				// 项目阶段
				projects.GET("/:id/phases", handler.GetProjectPhases)
			}

			// 阶段管理
			phases := authorized.Group("/phases")
			{
				phases.PUT("/:phaseId", handler.UpdatePhase)
				phases.PUT("/:phaseId/tasks/:taskId", handler.UpdatePhaseTask)
			}

			// 服务商通用 (关注/收藏)
			providers := authorized.Group("/providers")
			{
				providers.POST("/:id/follow", handler.FollowProvider)
				providers.DELETE("/:id/follow", handler.UnfollowProvider)
				providers.POST("/:id/favorite", handler.FavoriteProvider)
				providers.DELETE("/:id/favorite", handler.UnfavoriteProvider)
				providers.GET("/:id/user-status", handler.GetProviderUserStatus)
			}

			// 聊天 (Chat)
			chat := authorized.Group("/chat")
			{
				chat.GET("/conversations", handler.GetConversations)
				chat.GET("/messages", handler.GetMessages)
				chat.GET("/unread-count", handler.GetUnreadCount)
			}
		}

		// ==================== Admin 管理后台 ====================
		// 管理员登录 (无需认证)
		v1.POST("/admin/login", handler.AdminLogin)

		// ✅ 管理后台路由（使用AdminJWT中间件验证token类型）
		admin := v1.Group("/admin")
		admin.Use(middleware.AdminJWT(cfg.JWT.Secret))
		admin.Use(middleware.AdminLog()) // ✅ 记录操作日志
		{
			// 获取当前管理员信息和权限
			admin.GET("/info", handler.AdminGetInfo)

			// 统计（无需权限）
			admin.GET("/stats/overview", handler.AdminStatsOverview)
			admin.GET("/stats/trends", handler.AdminStatsTrends)
			admin.GET("/stats/distribution", handler.AdminStatsDistribution)

			// 用户管理
			admin.GET("/users", handler.AdminListUsers)
			admin.GET("/users/:id", handler.AdminGetUser)
			admin.POST("/users", handler.AdminCreateUser)
			admin.PUT("/users/:id", handler.AdminUpdateUser)
			admin.PATCH("/users/:id/status", handler.AdminUpdateUserStatus)

			// 管理员管理
			admin.GET("/admins", handler.AdminListAdmins)
			admin.POST("/admins", handler.AdminCreateAdmin)
			admin.PUT("/admins/:id", handler.AdminUpdateAdmin)
			admin.DELETE("/admins/:id", handler.AdminDeleteAdmin)
			admin.PATCH("/admins/:id/status", handler.AdminUpdateAdminStatus)

			// 服务商管理
			admin.GET("/providers", handler.AdminListProviders)
			admin.POST("/providers", handler.AdminCreateProvider)
			admin.PUT("/providers/:id", handler.AdminUpdateProvider)
			admin.PATCH("/providers/:id/verify", handler.AdminVerifyProvider)
			admin.PATCH("/providers/:id/status", handler.AdminUpdateProviderStatus)

			// 预约管理
			admin.GET("/bookings", handler.AdminListBookings)
			admin.PATCH("/bookings/:id/status", handler.AdminUpdateBookingStatus)

			// 评价管理
			admin.GET("/reviews", handler.AdminListReviews)
			admin.DELETE("/reviews/:id", handler.AdminDeleteReview)

			// 主材门店管理
			admin.GET("/material-shops", handler.AdminListMaterialShops)
			admin.POST("/material-shops", handler.AdminCreateMaterialShop)
			admin.PUT("/material-shops/:id", handler.AdminUpdateMaterialShop)
			admin.DELETE("/material-shops/:id", handler.AdminDeleteMaterialShop)
			admin.PATCH("/material-shops/:id/verify", handler.AdminVerifyMaterialShop)

			// 审核管理
			admin.GET("/audits/providers", handler.AdminListProviderAudits)
			admin.GET("/audits/material-shops", handler.AdminListMaterialShopAudits)
			admin.POST("/audits/:type/:id/approve", handler.AdminApproveAudit)
			admin.POST("/audits/:type/:id/reject", handler.AdminRejectAudit)

			// 财务管理
			admin.GET("/finance/escrow-accounts", handler.AdminListEscrowAccounts)
			admin.GET("/finance/transactions", handler.AdminListTransactions)
			admin.POST("/finance/escrow-accounts/:accountId/withdraw", handler.AdminWithdraw)

			// 风险管理
			admin.GET("/risk/warnings", handler.AdminListRiskWarnings)
			admin.POST("/risk/warnings/:id/handle", handler.AdminHandleRiskWarning)
			admin.GET("/risk/arbitrations", handler.AdminListArbitrations)
			admin.PUT("/risk/arbitrations/:id", handler.AdminUpdateArbitration)

			// 系统设置
			admin.GET("/settings", handler.AdminGetSettings)
			admin.PUT("/settings", handler.AdminUpdateSettings)

			// 操作日志
			admin.GET("/logs", handler.AdminListLogs)

			// ========== RBAC 权限管理 ==========
			// 角色管理
			admin.GET("/roles", handler.AdminListRoles)
			admin.POST("/roles", handler.AdminCreateRole)
			admin.PUT("/roles/:id", handler.AdminUpdateRole)
			admin.DELETE("/roles/:id", handler.AdminDeleteRole)
			admin.POST("/roles/:id/menus", handler.AdminAssignRoleMenus)

			// 菜单管理
			admin.GET("/menus", handler.AdminListMenus)
			admin.POST("/menus", handler.AdminCreateMenu)
			admin.PUT("/menus/:id", handler.AdminUpdateMenu)
			admin.DELETE("/menus/:id", handler.AdminDeleteMenu)
		}
	}

	return r
}
