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
	r.Use(middleware.RateLimit())   // API限流
	r.Use(middleware.AuditLogger()) // 审计日志

	// 静态文件服务 (上传文件)
	r.Static("/uploads", "./uploads")

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

		// 调试工具 (后续可移除或加权限)
		debug := v1.Group("/debug")
		{
			debug.GET("/fix-data", handler.FixData)
			debug.POST("/init-settings", handler.AdminInitSettings)
		}

		// 需要认证的路由（普通用户）
		authorized := v1.Group("")
		authorized.Use(middleware.JWT(cfg.JWT.Secret))
		{
			// ==================== 旧版 WebSocket（已废弃，已切换至腾讯云 IM） ====================
			// authorized.GET("/ws", handler.ServeWS(hub, wsHandler))

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
				bookings.GET("", handler.GetUserBookings)
				bookings.POST("", handler.CreateBooking)
				bookings.GET("/:id", handler.GetBooking)
				bookings.POST("/:id/pay-intent", handler.PayIntentFee)
				bookings.DELETE("/:id/cancel", handler.CancelBooking)
				bookings.DELETE("/:id", handler.DeleteBooking)
			}

			// 售后
			afterSales := authorized.Group("/after-sales")
			{
				afterSales.GET("", handler.GetAfterSalesList)
				afterSales.POST("", handler.CreateAfterSales)
				afterSales.GET("/:id", handler.GetAfterSalesDetail)
				afterSales.DELETE("/:id", handler.CancelAfterSales)
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

			// 用户方案管理 (用户查看/确认/拒绝设计师提交的方案)
			proposals := authorized.Group("/proposals")
			{
				proposals.GET("", handler.ListMyProposals)
				proposals.GET("/pending-count", handler.GetPendingCount)
				proposals.GET("/booking/:bookingId/history", handler.GetProposalVersionHistory) // 获取版本历史
				proposals.GET("/:id", handler.GetProposal)
				proposals.POST("/:id/confirm", handler.ConfirmProposal)
				proposals.POST("/:id/reject", handler.RejectProposal) // 支持拒绝原因
			}

			// 订单（用户端）
			orders := authorized.Group("/orders")
			{
				orders.GET("/pending-payments", handler.ListPendingPayments)
				orders.GET("/:id", handler.GetOrder)
				orders.POST("/:id/pay", handler.PayOrder)
				orders.DELETE("/:id", handler.CancelOrder)
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

			// 腾讯云 IM（新）
			im := authorized.Group("/im")
			{
				im.GET("/usersig", handler.GetIMUserSig)
			}

			// 通知系统
			notifications := authorized.Group("/notifications")
			{
				notifications.GET("", handler.GetNotifications)
				notifications.GET("/unread-count", handler.GetNotificationUnreadCount)
				notifications.PUT("/:id/read", handler.MarkNotificationAsRead)
				notifications.PUT("/read-all", handler.MarkAllNotificationsAsRead)
				notifications.DELETE("/:id", handler.DeleteNotification)
			}

			// ==================== 旧版自研聊天（已废弃，保留供回滚） ====================
			// 注：已切换到腾讯云 IM，以下路由不再使用
			// chat := authorized.Group("/chat")
			// {
			// 	chat.GET("/conversations", handler.GetConversations)
			// 	chat.GET("/messages", handler.GetMessages)
			// 	chat.GET("/unread-count", handler.GetUnreadCount)
			// }
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
			admin.GET("/bookings/refundable", handler.AdminGetRefundableBookings)   // 获取可退款预约列表
			admin.POST("/bookings/:bookingId/refund", handler.AdminRefundIntentFee) // 手动退款

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
			// 作品审核
			admin.GET("/audits/cases", handler.AdminListCaseAudits)
			admin.GET("/audits/cases/:id", handler.AdminGetCaseAudit)
			admin.POST("/audits/cases/:id/approve", handler.AdminApproveCaseAudit)
			admin.POST("/audits/cases/:id/reject", handler.AdminRejectCaseAudit)

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

			// 系统配置（平台抽成等）
			admin.GET("/system-configs", handler.AdminGetSystemConfigs)
			admin.PUT("/system-configs/:key", handler.AdminUpdateSystemConfig)
			admin.PUT("/system-configs/batch", handler.AdminBatchUpdateSystemConfigs)

			// 提现审核管理
			admin.GET("/withdraws", handler.AdminWithdrawList)
			admin.GET("/withdraws/:id", handler.AdminWithdrawDetail)
			admin.POST("/withdraws/:id/approve", handler.AdminWithdrawApprove)
			admin.POST("/withdraws/:id/reject", handler.AdminWithdrawReject)

			// 操作日志
			admin.GET("/logs", handler.AdminListLogs)

			// ========== RBAC 权限管理 ==========
			// 角色管理
			admin.GET("/roles", handler.AdminListRoles)
			admin.POST("/roles", handler.AdminCreateRole)
			admin.PUT("/roles/:id", handler.AdminUpdateRole)
			admin.DELETE("/roles/:id", handler.AdminDeleteRole)
			admin.GET("/roles/:id/menus", handler.AdminGetRoleMenus)
			admin.POST("/roles/:id/menus", handler.AdminAssignRoleMenus)

			// 菜单管理
			admin.GET("/menus", handler.AdminListMenus)
			admin.POST("/menus", handler.AdminCreateMenu)
			admin.PUT("/menus/:id", handler.AdminUpdateMenu)
			admin.DELETE("/menus/:id", handler.AdminDeleteMenu)

			// 商家入驻审核
			admin.GET("/merchant-applications", handler.AdminListApplications)
			admin.GET("/merchant-applications/:id", handler.AdminGetApplication)
			admin.POST("/merchant-applications/:id/approve", handler.AdminApproveApplication)
			admin.POST("/merchant-applications/:id/reject", handler.AdminRejectApplication)
		}

		// ==================== Merchant 商家端 ====================
		// 商家入驻 (无需认证)
		v1.POST("/merchant/apply", handler.MerchantApply)
		v1.GET("/merchant/apply/:phone/status", handler.MerchantApplyStatus)
		v1.POST("/merchant/apply/:id/resubmit", handler.MerchantResubmit)

		// 商家登录 (无需认证)
		v1.POST("/merchant/login", handler.MerchantLogin(cfg))

		// 商家端路由（使用 MerchantJWT 中间件验证 token 类型）
		merchant := v1.Group("/merchant")
		merchant.Use(middleware.MerchantJWT(cfg.JWT.Secret))
		{
			// 获取当前商家信息
			merchant.GET("/info", handler.MerchantGetInfo)
			merchant.PUT("/info", handler.MerchantUpdateInfo)
			merchant.POST("/avatar", handler.MerchantUploadAvatar)
			merchant.POST("/upload", handler.MerchantUploadImage)

			// 预约管理
			merchant.GET("/bookings", handler.MerchantListBookings)
			merchant.GET("/bookings/:id", handler.MerchantGetBookingDetail)
			merchant.PUT("/bookings/:id/handle", handler.MerchantHandleBooking)

			// 方案管理
			merchant.POST("/proposals", handler.MerchantSubmitProposal)
			merchant.GET("/proposals", handler.MerchantListProposals)
			merchant.GET("/proposals/:id", handler.MerchantGetProposal)
			merchant.PUT("/proposals/:id", handler.MerchantUpdateProposal)
			merchant.DELETE("/proposals/:id", handler.MerchantCancelProposal)
			merchant.POST("/proposals/:id/reopen", handler.MerchantReopenProposal)
			merchant.POST("/proposals/resubmit", handler.ResubmitProposal)          // 重新提交方案（生成新版本）
			merchant.GET("/proposals/:id/rejection-info", handler.GetRejectionInfo) // 获取拒绝信息

			// 订单管理
			merchant.GET("/orders", handler.MerchantListOrders)

			// 仪表盘
			merchant.GET("/dashboard", handler.MerchantDashboardStats)

			// 收入中心
			merchant.GET("/income/summary", handler.MerchantIncomeSummary)
			merchant.GET("/income/list", handler.MerchantIncomeList)

			// 提现管理
			merchant.GET("/withdraw/list", handler.MerchantWithdrawList)
			merchant.POST("/withdraw", handler.MerchantWithdrawCreate)

			// 银行账户
			merchant.GET("/bank-accounts", handler.MerchantBankAccountList)
			merchant.POST("/bank-accounts", handler.MerchantBankAccountCreate)
			merchant.DELETE("/bank-accounts/:id", handler.MerchantBankAccountDelete)
			merchant.PUT("/bank-accounts/:id/default", handler.MerchantBankAccountSetDefault)

			// 作品集管理
			merchant.GET("/cases", handler.MerchantCaseList)
			merchant.GET("/cases/:id", handler.MerchantCaseGet)
			merchant.POST("/cases", handler.MerchantCaseCreate)
			merchant.PUT("/cases/:id", handler.MerchantCaseUpdate)
			merchant.DELETE("/cases/:id", handler.MerchantCaseDelete)
			merchant.PUT("/cases/reorder", handler.MerchantCaseReorder)
			merchant.DELETE("/cases/audit/:auditId", handler.MerchantCaseCancelAudit) // 取消审核

			// 通知系统
			merchant.GET("/notifications", handler.GetNotifications)
			merchant.GET("/notifications/unread-count", handler.GetNotificationUnreadCount)
			merchant.PUT("/notifications/:id/read", handler.MarkNotificationAsRead)
			merchant.PUT("/notifications/read-all", handler.MarkAllNotificationsAsRead)
			merchant.DELETE("/notifications/:id", handler.DeleteNotification)
		}
	}

	return r
}
