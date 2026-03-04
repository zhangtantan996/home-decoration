package router

import (
	"home-decoration-server/internal/config"
	"home-decoration-server/internal/handler"
	"home-decoration-server/internal/middleware"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
)

func Setup(cfg *config.Config, dictHandler *handler.DictionaryHandler) *gin.Engine {
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
	if raw := strings.TrimSpace(os.Getenv("CORS_ALLOWED_ORIGINS")); raw != "" {
		parts := strings.Split(raw, ",")
		parsed := make([]string, 0, len(parts))
		for _, p := range parts {
			v := strings.TrimSpace(p)
			if v == "" {
				continue
			}
			parsed = append(parsed, v)
		}
		if len(parsed) > 0 {
			allowedOrigins = parsed
		}
	}

	// 全局中间件
	r.Use(middleware.SecurityHeaders()) // 安全响应头
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

		// 认证相关 (无需登录) - 添加限流保护防止暴力破解
		auth := v1.Group("/auth")
		{
			auth.POST("/register", middleware.LoginRateLimit(), handler.Register)
			auth.POST("/login", middleware.LoginRateLimit(), handler.Login)
			auth.POST("/send-code", middleware.LoginRateLimit(), handler.SendCode)
			auth.POST("/wechat/mini/login", middleware.LoginRateLimit(), handler.WechatMiniLogin)
			auth.POST("/wechat/mini/bind-phone", middleware.LoginRateLimit(), handler.WechatMiniBindPhone)
			auth.GET("/wechat/h5/authorize", middleware.LoginRateLimit(), handler.WechatH5Authorize)
			auth.POST("/wechat/h5/login", middleware.LoginRateLimit(), handler.WechatH5Login)
			auth.POST("/wechat/h5/bind-phone", middleware.LoginRateLimit(), handler.WechatH5BindPhone)
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

		v1.GET("/dictionaries/categories", dictHandler.GetAllCategories)
		v1.GET("/dictionaries/:category", dictHandler.GetDictOptions)

		// 案例详情 (公开)
		v1.GET("/cases/:id", middleware.OptionalJWT(cfg.JWT.Secret), handler.GetCaseDetail)

		// 灵感图库 (公开，支持未登录访问)
		v1.GET("/inspiration", middleware.OptionalJWT(cfg.JWT.Secret), handler.GetInspirationList)
		v1.GET("/inspiration/:id/comments", handler.GetCaseComments)

		// 行政区划 API (公开 - 用于级联选择器)
		regions := v1.Group("/regions")
		{
			regions.GET("/provinces", handler.GetProvinces)
			regions.GET("/provinces/:provinceCode/cities", handler.GetCitiesByProvince)
			regions.GET("/cities/:cityCode/districts", handler.GetDistrictsByCity)
			regions.GET("/children/:parentCode", handler.GetChildrenByParentCode) // 懒加载子节点
		}
		// 🔒 调试工具 - 仅在非生产环境启用，且需要管理员权限
		// 生产环境 (SERVER_MODE=release) 完全禁用此端点以防止数据泄露和恶意操作
		if cfg.Server.Mode != "release" {
			debug := v1.Group("/debug")
			debug.Use(middleware.AdminJWT(cfg.JWT.Secret))
			debug.Use(middleware.RequirePermission("system:debug:*"))
			{
				debug.GET("/fix-data", handler.FixData)
				debug.POST("/init-settings", handler.AdminInitSettings)
			}
		}

		// 需要认证的路由（普通用户）
		authorized := v1.Group("")
		authorized.Use(middleware.JWT(cfg.JWT.Secret))
		{
			// 用户相关
			user := authorized.Group("/user")
			{
				user.GET("/profile", handler.GetProfile)
				user.PUT("/profile", handler.UpdateProfile)
				user.GET("/favorites", handler.GetUserFavorites)
			}

			// 身份管理（多身份切换系统）
			identities := authorized.Group("/identities")
			{
				identities.GET("", handler.GetIdentities)              // 获取用户所有身份
				identities.GET("/current", handler.GetCurrentIdentity) // 获取当前激活身份
				identities.POST("/switch", handler.SwitchIdentity)     // 切换身份
				identities.POST("/apply", handler.ApplyIdentity)       // 申请新身份
			}

			// Tinode helper endpoints
			authorized.GET("/tinode/userid/:userId", handler.GetTinodeUserID)
			authorized.DELETE("/tinode/topic/:topic/messages", handler.ClearChatHistory)
			authorized.POST("/tinode/refresh-token", handler.RefreshTinodeToken)

			// 用户举报
			authorized.POST("/reports/chat", handler.SubmitChatReport)

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

			// 案例报价（登录可查看，不提供下载）
			authorized.GET("/cases/:id/quote", handler.GetCaseQuote)

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

				// 项目账单
				projects.GET("/:id/bill", handler.GetProjectBill)
				projects.POST("/:id/bill", handler.GenerateBill)
				projects.GET("/:id/files", handler.GetProjectFiles)
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
				// 分期付款
				orders.POST("/plans/:planId/pay", handler.PayPaymentPlan)
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

			// 灵感图库社交功能
			inspiration := authorized.Group("/inspiration")
			{
				inspiration.POST("/:id/like", handler.LikeCase)
				inspiration.DELETE("/:id/like", handler.UnlikeCase)
				inspiration.POST("/:id/favorite", handler.FavoriteCase)
				inspiration.DELETE("/:id/favorite", handler.UnfavoriteCase)
				inspiration.POST("/:id/comments", handler.CreateCaseComment)
			}

			// 建材门店收藏
			materialShops := authorized.Group("/material-shops")
			{
				materialShops.POST("/:id/favorite", handler.FavoriteMaterialShop)
				materialShops.DELETE("/:id/favorite", handler.UnfavoriteMaterialShop)
			}

			// 腾讯云 IM（新）
			im := authorized.Group("/im")
			{
				im.GET("/usersig", handler.GetIMUserSig)
			}

			// 通用上传
			authorized.POST("/upload", handler.UploadFile)

			// 通知系统
			notifications := authorized.Group("/notifications")
			{
				notifications.GET("", handler.GetNotifications)
				notifications.GET("/unread-count", handler.GetNotificationUnreadCount)
				notifications.PUT("/:id/read", handler.MarkNotificationAsRead)
				notifications.PUT("/read-all", handler.MarkAllNotificationsAsRead)
				notifications.DELETE("/:id", handler.DeleteNotification)
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

			// 作品管理 (CRUD)
			admin.GET("/cases", handler.AdminListCases)
			admin.GET("/cases/:id", handler.AdminGetCase)
			admin.POST("/cases", handler.AdminCreateCase)
			admin.PUT("/cases/:id", handler.AdminUpdateCase)
			admin.DELETE("/cases/:id", handler.AdminDeleteCase)
			admin.POST("/cases/batch-delete", handler.AdminBatchDeleteCases)
			admin.PATCH("/cases/:id/inspiration", handler.AdminToggleCaseInspiration)

			// 评论管理
			admin.GET("/comments", handler.AdminListComments)
			admin.PATCH("/comments/:id/status", handler.AdminUpdateCommentStatus)

			// 敏感词管理
			admin.GET("/sensitive-words", handler.AdminListSensitiveWords)
			admin.POST("/sensitive-words", handler.AdminCreateSensitiveWord)
			admin.POST("/sensitive-words/import", handler.AdminImportSensitiveWords)
			admin.PUT("/sensitive-words/:id", handler.AdminUpdateSensitiveWord)
			admin.DELETE("/sensitive-words/:id", handler.AdminDeleteSensitiveWord)

			admin.GET("/dictionaries", dictHandler.ListDicts)
			admin.POST("/dictionaries", dictHandler.CreateDict)
			admin.PUT("/dictionaries/:id", dictHandler.UpdateDict)
			admin.DELETE("/dictionaries/:id", dictHandler.DeleteDict)
			// 字典分类管理（可选）
			admin.GET("/dictionaries/categories", dictHandler.ListCategories)
			admin.POST("/dictionaries/categories", dictHandler.CreateCategory)
			admin.PUT("/dictionaries/categories/:code", dictHandler.UpdateCategory)
			admin.DELETE("/dictionaries/categories/:code", dictHandler.DeleteCategory)

			// 行政区划管理
			admin.GET("/regions", handler.AdminListRegions)
			admin.GET("/regions/children/:parentCode", handler.AdminGetChildrenByParentCode) // 懒加载子节点（包含已禁用）
			admin.PUT("/regions/:id/toggle", handler.AdminToggleRegion)
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
			admin.GET("/material-shop-applications", handler.AdminListMaterialShopApplications)
			admin.GET("/material-shop-applications/:id", handler.AdminGetMaterialShopApplication)
			admin.POST("/material-shop-applications/:id/approve", handler.AdminApproveMaterialShopApplication)
			admin.POST("/material-shop-applications/:id/reject", handler.AdminRejectMaterialShopApplication)

			// 身份申请审核
			admin.GET("/identity-applications", middleware.RequirePermission("identity:application:audit"), handler.AdminListIdentityApplications)
			admin.GET("/identity-applications/:id", middleware.RequirePermission("identity:application:audit"), handler.AdminGetIdentityApplication)
			admin.POST("/identity-applications/:id/approve", middleware.RequirePermission("identity:application:audit"), handler.AdminApproveIdentityApplication)
			admin.POST("/identity-applications/:id/reject", middleware.RequirePermission("identity:application:audit"), handler.AdminRejectIdentityApplication)

			// ========== 项目管理 ==========
			admin.GET("/projects", handler.AdminListProjects)
			admin.GET("/projects/:id", handler.AdminGetProject)
			admin.PUT("/projects/:id/status", handler.AdminUpdateProjectStatus)
			// 阶段管理
			admin.GET("/projects/:id/phases", handler.AdminGetProjectPhases)
			admin.PUT("/projects/:id/phases/:phaseId", handler.AdminUpdatePhase)
			// 施工日志管理（仅管理员可编辑）
			admin.GET("/projects/:id/logs", handler.AdminGetProjectLogs)
			admin.POST("/projects/:id/phases/:phaseId/logs", handler.AdminCreateWorkLog)
			admin.PUT("/logs/:logId", handler.AdminUpdateWorkLog)
			admin.DELETE("/logs/:logId", handler.AdminDeleteWorkLog)

			// ========== 争议预约管理 ==========
			admin.GET("/disputed-bookings", handler.AdminListDisputedBookings)
			admin.GET("/disputed-bookings/:id", handler.AdminGetDisputedBooking)
			admin.POST("/disputed-bookings/:id/resolve", handler.AdminResolveDispute)

			// 通知系统
			admin.GET("/notifications", handler.GetNotifications)
			admin.GET("/notifications/unread-count", handler.GetNotificationUnreadCount)
			admin.PUT("/notifications/:id/read", handler.MarkNotificationAsRead)
			admin.PUT("/notifications/read-all", handler.MarkAllNotificationsAsRead)
			admin.DELETE("/notifications/:id", handler.DeleteNotification)
		}

		// ==================== Merchant 商家端 ====================
		// 商家入驻 (无需认证)
		v1.POST("/merchant/apply", handler.MerchantApply)
		v1.GET("/merchant/apply/:phone/status", handler.MerchantApplyStatus)
		v1.POST("/merchant/apply/:id/resubmit", handler.MerchantResubmit)
		v1.POST("/merchant/change-application", handler.MerchantApplyIdentityChange)
		v1.POST("/material-shop/apply", handler.MaterialShopApply)
		v1.GET("/material-shop/apply/:phone/status", handler.MaterialShopApplyStatus)
		v1.POST("/material-shop/apply/:id/resubmit", handler.MaterialShopApplyResubmit)

		// 商家登录 (无需认证)
		v1.POST("/merchant/login", middleware.LoginRateLimit(), handler.MerchantLogin(cfg))

		// 商家端路由（使用 MerchantJWT 中间件验证 token 类型）
		merchant := v1.Group("/merchant")
		merchant.Use(middleware.MerchantJWT(cfg.JWT.Secret))
		{
			// Tinode helper endpoints
			merchant.GET("/tinode/userid/:userId", handler.GetTinodeUserID)

			// 获取当前商家信息
			merchant.GET("/info", handler.MerchantGetInfo)
			merchant.PUT("/info", handler.MerchantUpdateInfo)
			merchant.POST("/avatar", handler.MerchantUploadAvatar)
			merchant.POST("/upload", handler.MerchantUploadImage)
			merchant.GET("/service-settings", handler.MerchantGetServiceSettings)
			merchant.PUT("/service-settings", handler.MerchantUpdateServiceSettings)

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

			// 腾讯云 IM
			merchant.GET("/im/usersig", handler.MerchantGetIMUserSig)
		}

		materialShop := v1.Group("/material-shop")
		materialShop.Use(middleware.MerchantJWT(cfg.JWT.Secret))
		{
			materialShop.GET("/me", handler.MaterialShopGetMe)
			materialShop.PUT("/me", handler.MaterialShopUpdateMe)
			materialShop.GET("/me/products", handler.MaterialShopListProducts)
			materialShop.POST("/me/products", handler.MaterialShopCreateProduct)
			materialShop.PUT("/me/products/:id", handler.MaterialShopUpdateProduct)
			materialShop.DELETE("/me/products/:id", handler.MaterialShopDeleteProduct)
		}
	}

	return r
}
