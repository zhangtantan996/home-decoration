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
		"http://localhost:5177",        // Admin开发环境备用端口
		"http://127.0.0.1:5173",        // Admin开发环境（本地回环）
		"http://127.0.0.1:5174",        // Admin开发环境备用端口（本地回环）
		"http://127.0.0.1:5175",        // Admin开发环境备用端口（本地回环）
		"http://127.0.0.1:5176",        // Admin开发环境备用端口（本地回环）
		"http://127.0.0.1:5177",        // Admin开发环境备用端口（本地回环）
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
	r.Static("/static/inspiration", "./static/inspiration")

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

		// 公开首页聚合数据
		v1.GET("/homepage", handler.GetHomepageData)

		// 公开的服务商查询
		v1.GET("/providers", handler.ListProviders)

		// 主材门店 (公开)
		materialShops := v1.Group("/material-shops")
		{
			materialShops.GET("", handler.ListMaterialShops)
			materialShops.GET("/:id", handler.GetMaterialShop)
		}

		// 设计师 (公开)
		designers := v1.Group("/designers")
		{
			designers.GET("", handler.ListDesigners)
			designers.GET("/:id", handler.GetDesigner)
			designers.GET("/:id/cases", handler.GetProviderCases)
			designers.GET("/:id/reviews", handler.GetProviderReviews)
			designers.GET("/:id/review-stats", handler.GetReviewStats)
		}

		// 装修公司 (公开)
		companies := v1.Group("/companies")
		{
			companies.GET("", handler.ListCompanies)
			companies.GET("/:id", handler.GetCompany)
			companies.GET("/:id/cases", handler.GetProviderCases)
			companies.GET("/:id/reviews", handler.GetProviderReviews)
			companies.GET("/:id/review-stats", handler.GetReviewStats)
		}

		// 工长 (公开)
		foremen := v1.Group("/foremen")
		{
			foremen.GET("", handler.ListForemen)
			foremen.GET("/:id", handler.GetForeman)
			foremen.GET("/:id/cases", handler.GetProviderCases)
			foremen.GET("/:id/reviews", handler.GetProviderReviews)
			foremen.GET("/:id/review-stats", handler.GetReviewStats)
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
			regions.GET("/cities", handler.GetCities)
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
				// 账号安全
				user.POST("/change-password", handler.ChangePassword)
				user.POST("/change-phone", handler.ChangePhone)
				user.POST("/delete-account", handler.DeleteAccount)
				// 实名认证
				user.GET("/verification", handler.GetVerification)
				user.POST("/verification", handler.SubmitVerification)
				// 登录设备管理
				user.GET("/devices", handler.GetDevices)
				user.DELETE("/devices/:id", handler.RemoveDevice)
				user.DELETE("/devices", handler.RemoveAllDevices)
				// 偏好设置
				user.GET("/settings", handler.GetUserSettings)
				user.PUT("/settings", handler.UpdateUserSettings)
				// 意见反馈
				user.POST("/feedback", handler.SubmitFeedback)
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
				projects.GET("/:id/contract", handler.GetProjectContract)
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

			demands := authorized.Group("/demands")
			{
				demands.POST("", handler.CreateDemand)
				demands.GET("", handler.ListDemands)
				demands.GET("/:id", handler.GetDemand)
				demands.PUT("/:id", handler.UpdateDemand)
				demands.POST("/:id/submit", handler.SubmitDemand)
			}

			complaints := authorized.Group("/complaints")
			{
				complaints.POST("", handler.CreateComplaint)
				complaints.GET("", handler.ListComplaints)
				complaints.GET("/:id", handler.GetComplaint)
			}

			authorized.POST("/contracts/:id/confirm", handler.ConfirmContract)
			authorized.GET("/contracts/:id", handler.GetContract)

			quoteTasks := authorized.Group("/quote-tasks")
			{
				quoteTasks.GET("/my", handler.UserListQuoteTasks)
				quoteTasks.GET("/:id/user-view", handler.UserGetQuoteTask)
			}

			quoteSubmissions := authorized.Group("/quote-submissions")
			{
				quoteSubmissions.POST("/:id/confirm", handler.UserConfirmQuoteSubmission)
				quoteSubmissions.POST("/:id/reject", handler.UserRejectQuoteSubmission)
				quoteSubmissions.GET("/:id/print", handler.UserPrintQuoteSubmission)
			}

			// 订单（用户端）
			orders := authorized.Group("/orders")
			{
				orders.GET("", handler.ListOrders)
				orders.GET("/pending-payments", handler.ListPendingPayments)
				orders.GET("/:id/plans", handler.GetOrderPaymentPlans)
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
			dashboardRead := middleware.RequirePermission("dashboard:view")
			userListPerm := middleware.RequirePermission("system:user:list")
			userViewPerm := middleware.RequirePermission("system:user:view")
			userEditPerm := middleware.RequirePermission("system:user:edit")
			userDeletePerm := middleware.RequirePermission("system:user:delete")
			superAdminOnly := middleware.RequireSuperAdmin()
			adminListPerm := middleware.RequirePermission("system:admin:list")
			adminCreatePerm := middleware.RequirePermission("system:admin:create")
			adminEditPerm := middleware.RequirePermission("system:admin:edit")
			adminDeletePerm := middleware.RequirePermission("system:admin:delete")
			providerListPerm := middleware.RequireAnyPermission("provider:designer:list", "provider:company:list", "provider:foreman:list")
			providerCreatePerm := middleware.RequireAnyPermission("provider:designer:create", "provider:company:create", "provider:foreman:create")
			providerEditPerm := middleware.RequireAnyPermission("provider:designer:edit", "provider:company:edit", "provider:foreman:edit")
			providerAuditListPerm := middleware.RequirePermission("provider:audit:list")
			providerAuditViewPerm := middleware.RequirePermission("provider:audit:view")
			providerAuditApprovePerm := middleware.RequirePermission("provider:audit:approve")
			providerAuditRejectPerm := middleware.RequirePermission("provider:audit:reject")
			materialShopListPerm := middleware.RequirePermission("material:shop:list")
			materialShopCreatePerm := middleware.RequirePermission("material:shop:create")
			materialShopEditPerm := middleware.RequirePermission("material:shop:edit")
			materialShopDeletePerm := middleware.RequirePermission("material:shop:delete")
			materialAuditListPerm := middleware.RequirePermission("material:audit:list")
			materialAuditViewPerm := middleware.RequirePermission("material:audit:view")
			materialAuditApprovePerm := middleware.RequirePermission("material:audit:approve")
			materialAuditRejectPerm := middleware.RequirePermission("material:audit:reject")
			bookingListPerm := middleware.RequirePermission("booking:list")
			bookingEditPerm := middleware.RequirePermission("booking:edit")
			disputeDetailPerm := middleware.RequirePermission("booking:dispute:detail")
			disputeResolvePerm := middleware.RequirePermission("booking:dispute:resolve")
			reviewListPerm := middleware.RequirePermission("review:list")
			reviewDeletePerm := middleware.RequirePermission("review:delete")
			reviewHidePerm := middleware.RequirePermission("review:hide")
			caseListPerm := middleware.RequirePermission("system:case:list")
			caseViewPerm := middleware.RequirePermission("system:case:view")
			settingListPerm := middleware.RequirePermission("system:setting:list")
			settingEditPerm := middleware.RequirePermission("system:setting:edit")
			financeEscrowListPerm := middleware.RequirePermission("finance:escrow:list")
			financeTransactionListPerm := middleware.RequirePermission("finance:transaction:list")
			financeTransactionViewPerm := middleware.RequirePermission("finance:transaction:view")
			financeTransactionApprovePerm := middleware.RequirePermission("finance:transaction:approve")
			riskWarningListPerm := middleware.RequirePermission("risk:warning:list")
			riskWarningHandlePerm := middleware.RequirePermission("risk:warning:handle")
			riskArbitrationListPerm := middleware.RequirePermission("risk:arbitration:list")
			riskArbitrationJudgePerm := middleware.RequirePermission("risk:arbitration:judge")
			logListPerm := middleware.RequirePermission("system:log:list")
			roleListPerm := middleware.RequirePermission("system:role:list")
			roleCreatePerm := middleware.RequirePermission("system:role:create")
			roleEditPerm := middleware.RequirePermission("system:role:edit")
			roleDeletePerm := middleware.RequirePermission("system:role:delete")
			roleAssignPerm := middleware.RequirePermission("system:role:assign")
			menuListPerm := middleware.RequirePermission("system:menu:list")
			menuCreatePerm := middleware.RequirePermission("system:menu:create")
			menuEditPerm := middleware.RequirePermission("system:menu:edit")
			menuDeletePerm := middleware.RequirePermission("system:menu:delete")
			identityAuditPerm := middleware.RequirePermission("identity:application:audit")
			projectListPerm := middleware.RequirePermission("project:list")
			projectViewPerm := middleware.RequirePermission("project:view")
			projectEditPerm := middleware.RequirePermission("project:edit")
			demandListPerm := middleware.RequirePermission("demand:list")
			demandReviewPerm := middleware.RequirePermission("demand:review")
			demandAssignPerm := middleware.RequirePermission("demand:assign")
			complaintListPerm := middleware.RequirePermission("risk:arbitration:list")
			complaintResolvePerm := middleware.RequirePermission("risk:arbitration:judge")

			// 获取当前管理员信息和权限
			admin.GET("/info", handler.AdminGetInfo)
			admin.POST("/upload", caseListPerm, handler.AdminUploadImage)

			// 统计
			admin.GET("/stats/overview", dashboardRead, handler.AdminStatsOverview)
			admin.GET("/stats/trends", dashboardRead, handler.AdminStatsTrends)
			admin.GET("/stats/distribution", dashboardRead, handler.AdminStatsDistribution)

			// 用户管理
			admin.GET("/users", userListPerm, handler.AdminListUsers)
			admin.POST("/users/batch-delete", userDeletePerm, superAdminOnly, handler.AdminBatchDeleteUsers)
			admin.GET("/users/:id", userViewPerm, handler.AdminGetUser)
			admin.POST("/users", userEditPerm, handler.AdminCreateUser)
			admin.PUT("/users/:id", userEditPerm, handler.AdminUpdateUser)
			admin.PATCH("/users/:id/status", userEditPerm, handler.AdminUpdateUserStatus)
			admin.DELETE("/users/:id", userDeletePerm, superAdminOnly, handler.AdminDeleteUser)

			// 管理员管理
			admin.GET("/admins", adminListPerm, handler.AdminListAdmins)
			admin.POST("/admins", adminCreatePerm, handler.AdminCreateAdmin)
			admin.PUT("/admins/:id", adminEditPerm, handler.AdminUpdateAdmin)
			admin.DELETE("/admins/:id", adminDeletePerm, handler.AdminDeleteAdmin)
			admin.PATCH("/admins/:id/status", adminEditPerm, handler.AdminUpdateAdminStatus)

			// 服务商管理
			admin.GET("/providers", providerListPerm, handler.AdminListProviders)
			admin.POST("/providers", providerCreatePerm, handler.AdminCreateProvider)
			admin.PUT("/providers/:id", providerEditPerm, handler.AdminUpdateProvider)
			admin.PATCH("/providers/:id/verify", providerEditPerm, handler.AdminVerifyProvider)
			admin.PATCH("/providers/:id/status", providerEditPerm, handler.AdminUpdateProviderStatus)

			// 预约管理
			admin.GET("/bookings", bookingListPerm, handler.AdminListBookings)
			admin.PATCH("/bookings/:id/status", bookingEditPerm, handler.AdminUpdateBookingStatus)
			admin.GET("/bookings/refundable", financeTransactionApprovePerm, handler.AdminGetRefundableBookings)
			admin.POST("/bookings/:bookingId/refund", financeTransactionApprovePerm, handler.AdminRefundIntentFee)

			// 评价管理
			admin.GET("/reviews", reviewListPerm, handler.AdminListReviews)
			admin.DELETE("/reviews/:id", reviewDeletePerm, handler.AdminDeleteReview)

			// 主材门店管理
			admin.GET("/material-shops", materialShopListPerm, handler.AdminListMaterialShops)
			admin.POST("/material-shops", materialShopCreatePerm, handler.AdminCreateMaterialShop)
			admin.PUT("/material-shops/:id", materialShopEditPerm, handler.AdminUpdateMaterialShop)
			admin.DELETE("/material-shops/:id", materialShopDeletePerm, handler.AdminDeleteMaterialShop)
			admin.PATCH("/material-shops/:id/verify", materialShopEditPerm, handler.AdminVerifyMaterialShop)

			// 审核管理
			admin.GET("/audits/providers", providerAuditListPerm, handler.AdminListProviderAudits)
			admin.GET("/audits/material-shops", materialAuditListPerm, handler.AdminListMaterialShopAudits)
			admin.POST("/audits/:type/:id/approve", middleware.RequireAnyPermission("provider:audit:approve", "material:audit:approve"), handler.AdminApproveAudit)
			admin.POST("/audits/:type/:id/reject", middleware.RequireAnyPermission("provider:audit:reject", "material:audit:reject"), handler.AdminRejectAudit)
			admin.GET("/audits/cases", caseViewPerm, handler.AdminListCaseAudits)
			admin.GET("/audits/cases/:id", caseViewPerm, handler.AdminGetCaseAudit)
			admin.POST("/audits/cases/:id/approve", caseListPerm, handler.AdminApproveCaseAudit)
			admin.POST("/audits/cases/:id/reject", caseListPerm, handler.AdminRejectCaseAudit)

			// 作品管理
			admin.GET("/cases", caseViewPerm, handler.AdminListCases)
			admin.GET("/cases/:id", caseViewPerm, handler.AdminGetCase)
			admin.POST("/cases", caseListPerm, handler.AdminCreateCase)
			admin.PUT("/cases/:id", caseListPerm, handler.AdminUpdateCase)
			admin.DELETE("/cases/:id", caseListPerm, handler.AdminDeleteCase)
			admin.POST("/cases/batch-delete", caseListPerm, handler.AdminBatchDeleteCases)
			admin.PATCH("/cases/:id/inspiration", caseListPerm, handler.AdminToggleCaseInspiration)

			// 评论管理
			admin.GET("/comments", reviewListPerm, handler.AdminListComments)
			admin.PATCH("/comments/:id/status", reviewHidePerm, handler.AdminUpdateCommentStatus)

			// 敏感词管理
			admin.GET("/sensitive-words", settingListPerm, handler.AdminListSensitiveWords)
			admin.POST("/sensitive-words", settingEditPerm, handler.AdminCreateSensitiveWord)
			admin.POST("/sensitive-words/import", settingEditPerm, handler.AdminImportSensitiveWords)
			admin.PUT("/sensitive-words/:id", settingEditPerm, handler.AdminUpdateSensitiveWord)
			admin.DELETE("/sensitive-words/:id", settingEditPerm, handler.AdminDeleteSensitiveWord)

			admin.GET("/dictionaries", settingListPerm, dictHandler.ListDicts)
			admin.POST("/dictionaries", settingEditPerm, dictHandler.CreateDict)
			admin.PUT("/dictionaries/:id", settingEditPerm, dictHandler.UpdateDict)
			admin.DELETE("/dictionaries/:id", settingEditPerm, dictHandler.DeleteDict)
			admin.GET("/dictionaries/categories", settingListPerm, dictHandler.ListCategories)
			admin.POST("/dictionaries/categories", settingEditPerm, dictHandler.CreateCategory)
			admin.PUT("/dictionaries/categories/:code", settingEditPerm, dictHandler.UpdateCategory)
			admin.DELETE("/dictionaries/categories/:code", settingEditPerm, dictHandler.DeleteCategory)

			// 行政区划管理
			admin.GET("/regions", settingListPerm, handler.AdminListRegions)
			admin.GET("/regions/children/:parentCode", settingListPerm, handler.AdminGetChildrenByParentCode)
			admin.PUT("/regions/:id/toggle", settingEditPerm, handler.AdminToggleRegion)

			// 财务管理
			admin.GET("/finance/escrow-accounts", financeEscrowListPerm, handler.AdminListEscrowAccounts)
			admin.GET("/finance/transactions", financeTransactionListPerm, handler.AdminListTransactions)
			admin.POST("/finance/escrow-accounts/:accountId/withdraw", financeTransactionApprovePerm, handler.AdminWithdraw)

			// 风险管理
			admin.GET("/risk/warnings", riskWarningListPerm, handler.AdminListRiskWarnings)
			admin.POST("/risk/warnings/:id/handle", riskWarningHandlePerm, handler.AdminHandleRiskWarning)
			admin.GET("/risk/arbitrations", riskArbitrationListPerm, handler.AdminListArbitrations)
			admin.PUT("/risk/arbitrations/:id", riskArbitrationJudgePerm, handler.AdminUpdateArbitration)

			// 系统设置
			admin.GET("/settings", settingListPerm, handler.AdminGetSettings)
			admin.PUT("/settings", settingEditPerm, handler.AdminUpdateSettings)
			admin.GET("/system-configs", settingListPerm, handler.AdminGetSystemConfigs)
			admin.PUT("/system-configs/:key", settingEditPerm, handler.AdminUpdateSystemConfig)
			admin.PUT("/system-configs/batch", settingEditPerm, handler.AdminBatchUpdateSystemConfigs)

			// 提现审核管理
			admin.GET("/withdraws", financeTransactionListPerm, handler.AdminWithdrawList)
			admin.GET("/withdraws/:id", financeTransactionViewPerm, handler.AdminWithdrawDetail)
			admin.POST("/withdraws/:id/approve", financeTransactionApprovePerm, handler.AdminWithdrawApprove)
			admin.POST("/withdraws/:id/reject", financeTransactionApprovePerm, handler.AdminWithdrawReject)

			// 操作日志
			admin.GET("/logs", logListPerm, handler.AdminListLogs)

			// ========== RBAC 权限管理 ==========
			admin.GET("/roles", roleListPerm, handler.AdminListRoles)
			admin.POST("/roles", roleCreatePerm, handler.AdminCreateRole)
			admin.PUT("/roles/:id", roleEditPerm, handler.AdminUpdateRole)
			admin.DELETE("/roles/:id", roleDeletePerm, handler.AdminDeleteRole)
			admin.GET("/roles/:id/menus", roleAssignPerm, handler.AdminGetRoleMenus)
			admin.POST("/roles/:id/menus", roleAssignPerm, handler.AdminAssignRoleMenus)
			admin.GET("/menus", menuListPerm, handler.AdminListMenus)
			admin.POST("/menus", menuCreatePerm, handler.AdminCreateMenu)
			admin.PUT("/menus/:id", menuEditPerm, handler.AdminUpdateMenu)
			admin.DELETE("/menus/:id", menuDeletePerm, handler.AdminDeleteMenu)

			// 商家入驻审核
			admin.GET("/merchant-applications", providerAuditListPerm, handler.AdminListApplications)
			admin.GET("/merchant-applications/:id", providerAuditViewPerm, handler.AdminGetApplication)
			admin.POST("/merchant-applications/:id/approve", providerAuditApprovePerm, handler.AdminApproveApplication)
			admin.POST("/merchant-applications/:id/reject", providerAuditRejectPerm, handler.AdminRejectApplication)
			admin.GET("/material-shop-applications", materialAuditListPerm, handler.AdminListMaterialShopApplications)
			admin.GET("/material-shop-applications/:id", materialAuditViewPerm, handler.AdminGetMaterialShopApplication)
			admin.POST("/material-shop-applications/:id/approve", materialAuditApprovePerm, handler.AdminApproveMaterialShopApplication)
			admin.POST("/material-shop-applications/:id/reject", materialAuditRejectPerm, handler.AdminRejectMaterialShopApplication)

			// 身份申请审核
			admin.GET("/identity-applications", identityAuditPerm, handler.AdminListIdentityApplications)
			admin.GET("/identity-applications/:id", identityAuditPerm, handler.AdminGetIdentityApplication)
			admin.POST("/identity-applications/:id/approve", identityAuditPerm, handler.AdminApproveIdentityApplication)
			admin.POST("/identity-applications/:id/reject", identityAuditPerm, handler.AdminRejectIdentityApplication)

			// ========== 项目管理 ==========
			admin.GET("/projects", projectListPerm, handler.AdminListProjects)
			admin.GET("/projects/:id", projectViewPerm, handler.AdminGetProject)
			admin.PUT("/projects/:id/status", projectEditPerm, handler.AdminUpdateProjectStatus)
			admin.GET("/projects/:id/phases", projectViewPerm, handler.AdminGetProjectPhases)
			admin.PUT("/projects/:id/phases/:phaseId", projectEditPerm, handler.AdminUpdatePhase)
			admin.GET("/projects/:id/logs", projectViewPerm, handler.AdminGetProjectLogs)
			admin.POST("/projects/:id/phases/:phaseId/logs", projectEditPerm, handler.AdminCreateWorkLog)
			admin.PUT("/logs/:logId", projectEditPerm, handler.AdminUpdateWorkLog)
			admin.DELETE("/logs/:logId", projectEditPerm, handler.AdminDeleteWorkLog)
			admin.POST("/quote-library/import", projectEditPerm, handler.AdminImportQuoteLibrary)
			admin.POST("/quote-library/import-preview", projectEditPerm, handler.AdminImportQuoteLibraryPreview)
			admin.GET("/quote-categories", projectListPerm, handler.AdminListQuoteCategories)
			admin.POST("/quote-categories", projectEditPerm, handler.AdminCreateQuoteCategory)
			admin.GET("/quote-library/items", projectListPerm, handler.AdminListQuoteLibraryItems)
			admin.POST("/quote-library/items", projectEditPerm, handler.AdminCreateQuoteLibraryItem)
			admin.PUT("/quote-library/items/:id", projectEditPerm, handler.AdminUpdateQuoteLibraryItem)

			// Price Tier 阶梯价管理
			admin.GET("/quote-library/items/:itemId/tiers", projectListPerm, handler.AdminListPriceTiers)
			admin.POST("/quote-price-tiers", projectEditPerm, handler.AdminCreatePriceTier)
			admin.PUT("/quote-price-tiers/:id", projectEditPerm, handler.AdminUpdatePriceTier)
			admin.DELETE("/quote-price-tiers/:id", projectEditPerm, handler.AdminDeletePriceTier)

			// 报价模板管理
			admin.GET("/quote-templates", projectListPerm, handler.AdminListQuoteTemplates)
			admin.GET("/quote-templates/:id", projectViewPerm, handler.AdminGetQuoteTemplateDetail)
			admin.POST("/quote-templates", projectEditPerm, handler.AdminCreateQuoteTemplate)
			admin.PUT("/quote-templates/:id", projectEditPerm, handler.AdminUpdateQuoteTemplate)
			admin.POST("/quote-templates/:id/items", projectEditPerm, handler.AdminBatchUpsertTemplateItems)

			admin.GET("/quote-lists", projectListPerm, handler.AdminListQuoteLists)
			admin.GET("/quote-lists/:id", projectViewPerm, handler.AdminGetQuoteListDetail)
			admin.POST("/quote-lists", projectEditPerm, handler.AdminCreateQuoteList)
			admin.POST("/quote-lists/:id/items/batch-upsert", projectEditPerm, handler.AdminBatchUpsertQuoteListItems)
			admin.POST("/quote-lists/:id/invitations", projectEditPerm, handler.AdminCreateQuoteInvitations)
			admin.POST("/quote-lists/:id/start", projectEditPerm, handler.AdminStartQuoteList)
			admin.GET("/quote-lists/:id/comparison", projectViewPerm, handler.AdminGetQuoteComparison)
			admin.POST("/quote-lists/:id/award", projectEditPerm, handler.AdminAwardQuote)
			admin.GET("/providers/:id/price-book", providerListPerm, handler.AdminGetProviderPriceBook)
			admin.GET("/quote-tasks", projectListPerm, handler.AdminListQuoteLists)
			admin.GET("/quote-tasks/:id", projectViewPerm, handler.AdminGetQuoteListDetail)
			admin.POST("/quote-tasks", projectEditPerm, handler.AdminCreateQuoteList)
			admin.POST("/quote-tasks/:id/items/batch-upsert", projectEditPerm, handler.AdminBatchUpsertQuoteListItems)
			admin.PUT("/quote-tasks/:id/prerequisites", projectEditPerm, handler.AdminUpdateQuoteTaskPrerequisites)
			admin.POST("/quote-tasks/:id/validate-prerequisites", projectEditPerm, handler.AdminValidateQuoteTaskPrerequisites)
			admin.POST("/quote-tasks/:id/recommend-foremen", projectEditPerm, handler.AdminRecommendForemen)
			admin.POST("/quote-tasks/:id/select-foremen", projectEditPerm, handler.AdminSelectForemen)
			admin.POST("/quote-tasks/:id/generate-drafts", projectEditPerm, handler.AdminGenerateQuoteDrafts)
			admin.GET("/quote-tasks/:id/comparison", projectViewPerm, handler.AdminGetQuoteComparison)
			admin.POST("/quote-tasks/:id/submit-to-user", projectEditPerm, handler.AdminSubmitQuoteTaskToUser)
			admin.POST("/quote-tasks/:id/requote", projectEditPerm, handler.AdminRequoteTask)
			admin.POST("/quote-tasks/:id/apply-template", projectEditPerm, handler.AdminApplyTemplateToQuoteList)
			admin.POST("/quote-tasks/:id/auto-calculate", projectEditPerm, handler.AdminAutoCalculateQuantities)

			// ========== 需求中心 ==========
			admin.GET("/demands", demandListPerm, handler.AdminListDemands)
			admin.GET("/demands/:id", demandListPerm, handler.AdminGetDemand)
			admin.POST("/demands/:id/review", demandReviewPerm, handler.AdminReviewDemand)
			admin.POST("/demands/:id/assign", demandAssignPerm, handler.AdminAssignDemand)
			admin.GET("/demands/:id/candidates", demandAssignPerm, handler.AdminListDemandCandidates)

			// 投诉处理
			admin.GET("/complaints", complaintListPerm, handler.AdminListComplaints)
			admin.POST("/complaints/:id/resolve", complaintResolvePerm, handler.AdminResolveComplaint)

			// ========== 争议预约管理 ==========
			admin.GET("/disputed-bookings", bookingListPerm, handler.AdminListDisputedBookings)
			admin.GET("/disputed-bookings/:id", disputeDetailPerm, handler.AdminGetDisputedBooking)
			admin.POST("/disputed-bookings/:id/resolve", disputeResolvePerm, handler.AdminResolveDispute)

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
		v1.POST("/merchant/apply/:id/detail-for-resubmit", handler.MerchantApplyDetailForResubmit)
		v1.POST("/merchant/apply/:id/resubmit", handler.MerchantResubmit)
		v1.POST("/merchant/change-application", handler.MerchantApplyIdentityChange)
		v1.POST("/merchant/upload-public", handler.MerchantUploadImage)
		v1.POST("/merchant/onboarding/validate-license", handler.MerchantValidateOnboardingLicense)
		v1.POST("/merchant/onboarding/validate-id-card", handler.MerchantValidateOnboardingIDCard)
		v1.POST("/merchant/onboarding/verify-phone", handler.MerchantVerifyOnboardingPhone)
		v1.POST("/material-shop/apply", handler.MaterialShopApply)
		v1.GET("/material-shop/apply/:phone/status", handler.MaterialShopApplyStatus)
		v1.POST("/material-shop/apply/:id/detail-for-resubmit", handler.MaterialShopApplyDetailForResubmit)
		v1.POST("/material-shop/apply/:id/resubmit", handler.MaterialShopApplyResubmit)

		// 商家登录 (无需认证)
		v1.POST("/merchant/login", middleware.LoginRateLimit(), handler.MerchantLogin(cfg))

		contracts := v1.Group("/contracts")
		contracts.Use(middleware.MerchantJWT(cfg.JWT.Secret))
		{
			contracts.POST("", handler.CreateContract)
		}

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
			merchant.GET("/price-book", handler.MerchantGetPriceBook)
			merchant.PUT("/price-book", handler.MerchantUpdatePriceBook)
			merchant.POST("/price-book/publish", handler.MerchantPublishPriceBook)

			// 预约管理
			merchant.GET("/bookings", handler.MerchantListBookings)
			merchant.GET("/bookings/:id", handler.MerchantGetBookingDetail)
			merchant.PUT("/bookings/:id/handle", handler.MerchantHandleBooking)
			merchant.GET("/quote-lists", handler.MerchantListQuoteLists)
			merchant.GET("/quote-lists/:id", handler.MerchantGetQuoteListDetail)
			merchant.PUT("/quote-lists/:id/submission", handler.MerchantSaveQuoteSubmission)
			merchant.POST("/quote-lists/:id/submission/submit", handler.MerchantSubmitQuoteSubmission)
			merchant.GET("/quote-tasks", handler.MerchantListQuoteTasks)
			merchant.GET("/quote-tasks/:id", handler.MerchantGetQuoteTask)

			// 方案管理
			merchant.POST("/proposals", handler.MerchantSubmitProposal)
			merchant.GET("/proposals", handler.MerchantListProposals)
			merchant.GET("/proposals/:id", handler.MerchantGetProposal)
			merchant.PUT("/proposals/:id", handler.MerchantUpdateProposal)
			merchant.DELETE("/proposals/:id", handler.MerchantCancelProposal)
			merchant.POST("/proposals/:id/reopen", handler.MerchantReopenProposal)
			merchant.POST("/proposals/resubmit", handler.ResubmitProposal)          // 重新提交方案（生成新版本）
			merchant.GET("/proposals/:id/rejection-info", handler.GetRejectionInfo) // 获取拒绝信息

			// 线索管理
			merchant.GET("/leads", handler.MerchantListLeads)
			merchant.POST("/leads/:id/accept", handler.MerchantAcceptLead)
			merchant.POST("/leads/:id/decline", handler.MerchantDeclineLead)

			// 投诉响应
			merchant.GET("/complaints", handler.MerchantListComplaints)
			merchant.POST("/complaints/:id/respond", handler.MerchantRespondComplaint)

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
