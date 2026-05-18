package router

import (
	"home-decoration-server/internal/config"
	"home-decoration-server/internal/handler"
	"home-decoration-server/internal/middleware"
	"log"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
)

var defaultDevAllowedOrigins = []string{
	"http://localhost:5173", // Admin开发环境
	"http://localhost:5174", // Admin开发环境备用端口
	"http://localhost:5175", // Admin开发环境备用端口
	"http://localhost:5176", // Admin开发环境备用端口
	"http://localhost:5177", // Admin开发环境备用端口
	"http://localhost:5178", // Supervisor开发环境
	"http://127.0.0.1:5173", // Admin开发环境（本地回环）
	"http://127.0.0.1:5174", // Admin开发环境备用端口（本地回环）
	"http://127.0.0.1:5175", // Admin开发环境备用端口（本地回环）
	"http://127.0.0.1:5176", // Admin开发环境备用端口（本地回环）
	"http://127.0.0.1:5177", // Admin开发环境备用端口（本地回环）
	"http://127.0.0.1:5178", // Supervisor开发环境（本地回环）
	"http://localhost:3000", // Mobile开发环境
}

const defaultReleaseAllowedOrigin = "https://admin.yourdomain.com"

var defaultTrustedProxies = []string{
	"127.0.0.1",
	"::1",
	"10.0.0.0/8",
	"172.16.0.0/12",
	"192.168.0.0/16",
}

func buildAllowedOrigins(serverMode string, raw string) []string {
	parsed := parseAllowedOrigins(raw)
	if strings.EqualFold(serverMode, "release") {
		filtered := make([]string, 0, len(parsed))
		for _, origin := range parsed {
			if origin == "*" {
				continue
			}
			filtered = append(filtered, origin)
		}
		if len(filtered) > 0 {
			return filtered
		}
		if len(parsed) > 0 {
			log.Printf("[router] ignored wildcard CORS origin in release mode")
		}
		return []string{defaultReleaseAllowedOrigin}
	}

	origins := append([]string{}, defaultDevAllowedOrigins...)
	for _, origin := range parsed {
		if !containsString(origins, origin) {
			origins = append(origins, origin)
		}
	}
	return origins
}

func parseAllowedOrigins(raw string) []string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil
	}

	parts := strings.Split(raw, ",")
	parsed := make([]string, 0, len(parts))
	for _, part := range parts {
		origin := strings.TrimSpace(part)
		if origin == "" || containsString(parsed, origin) {
			continue
		}
		parsed = append(parsed, origin)
	}
	return parsed
}

func buildTrustedProxies(raw string) []string {
	parsed := parseAllowedOrigins(raw)
	if len(parsed) == 0 {
		return append([]string{}, defaultTrustedProxies...)
	}
	return parsed
}

func containsString(items []string, target string) bool {
	for _, item := range items {
		if item == target {
			return true
		}
	}
	return false
}

func Setup(cfg *config.Config, dictHandler *handler.DictionaryHandler) *gin.Engine {
	r := gin.Default()
	if err := r.SetTrustedProxies(buildTrustedProxies(cfg.Server.TrustedProxies)); err != nil {
		log.Printf("[router] invalid trusted proxies config, fallback to defaults: %v", err)
		_ = r.SetTrustedProxies(defaultTrustedProxies)
	}

	// ✅ CORS白名单配置
	allowedOrigins := buildAllowedOrigins(cfg.Server.Mode, os.Getenv("CORS_ALLOWED_ORIGINS"))

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
	r.Static("/static/home-popup", "./static/home-popup")
	r.GET("/metrics", handler.HandleNotificationRealtimeMetrics)

	// API版本分组
	v1 := r.Group("/api/v1")
	{
		// 健康检查
		v1.GET("/health", handler.HealthCheck)
		v1.GET("/metrics", handler.HandleNotificationRealtimeMetrics)
		v1.GET("/realtime/notifications", handler.HandleNotificationRealtime)

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

		// 支付回调与跳转（不依赖 SPA Authorization 头）
		payments := v1.Group("/payments")
		{
			payments.GET("/:id/launch", handler.PaymentLaunch)
			payments.GET("/:id/qr", handler.PaymentQRCode)
			payments.HEAD("/:id/qr", handler.PaymentQRCode)
			payments.POST("/alipay/notify", handler.PaymentAlipayNotify)
			payments.POST("/wechat/notify", handler.PaymentWechatNotify)
			payments.POST("/wechat/refund/notify", handler.PaymentWechatRefundNotify)
			payments.GET("/alipay/return", handler.PaymentAlipayReturn)
		}

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
			designers.GET("/:id/cases/:caseId", handler.GetProviderCaseDetail)
			designers.GET("/:id/reviews", handler.GetProviderReviews)
			designers.GET("/:id/review-stats", handler.GetReviewStats)
		}

		// 装修公司 (公开)
		companies := v1.Group("/companies")
		{
			companies.GET("", handler.ListCompanies)
			companies.GET("/:id", handler.GetCompany)
			companies.GET("/:id/cases", handler.GetProviderCases)
			companies.GET("/:id/cases/:caseId", handler.GetProviderCaseDetail)
			companies.GET("/:id/reviews", handler.GetProviderReviews)
			companies.GET("/:id/review-stats", handler.GetReviewStats)
		}

		// 工长 (公开)
		foremen := v1.Group("/foremen")
		{
			foremen.GET("", handler.ListForemen)
			foremen.GET("/:id", handler.GetForeman)
			foremen.GET("/:id/cases", handler.GetProviderCases)
			foremen.GET("/:id/cases/:caseId", handler.GetProviderCaseDetail)
			foremen.GET("/:id/scene-cases", handler.GetProviderSceneCases)
			foremen.GET("/:id/reviews", handler.GetProviderReviews)
			foremen.GET("/:id/review-stats", handler.GetReviewStats)
		}

		v1.GET("/dictionaries/categories", dictHandler.GetAllCategories)
		v1.GET("/dictionaries/:category", dictHandler.GetDictOptions)

		// 智能报价 (公开)
		v1.POST("/quote-estimate", handler.GenerateQuoteEstimate)

		// 智能报价询价 (公开接口，支持未登录用户)
		v1.POST("/quote-inquiries", middleware.OptionalJWT(cfg.JWT.Secret), handler.CreateQuoteInquiry)
		v1.GET("/quote-inquiries/:id", middleware.OptionalJWT(cfg.JWT.Secret), handler.GetQuoteInquiry)
		v1.GET("/public/site-config", handler.GetPublicSiteConfig)
		v1.GET("/public/mini/home-popup", handler.GetMiniHomePopup)

		// 案例详情 (公开)
		v1.GET("/cases/:id", middleware.OptionalJWT(cfg.JWT.Secret), handler.GetCaseDetail)
		v1.GET("/provider-cases/:id", handler.GetProviderShowcaseDetail)
		v1.GET("/provider-scenes/:id", handler.GetProviderSceneDetail)

		// 灵感图库 (公开，支持未登录访问)
		v1.GET("/inspiration", middleware.OptionalJWT(cfg.JWT.Secret), handler.GetInspirationList)
		v1.GET("/inspiration/:id/comments", handler.GetCaseComments)

		// 行政区划 API (公开 - 用于级联选择器)
		regions := v1.Group("/regions")
		{
			regions.GET("/provinces", handler.GetProvinces)
			regions.GET("/cities", handler.GetCities)
			regions.GET("/service-provinces", handler.GetServiceProvinces)
			regions.GET("/service-cities", handler.GetServiceCities)
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
				bookings.GET("/:id/site-survey", handler.GetSiteSurvey)
				bookings.GET("/:id/budget-confirm", handler.GetBudgetConfirmation)
				bookings.POST("/:id/budget-confirm/accept", middleware.RequireTransactionFlowEnabled(), handler.AcceptBudgetConfirmation)
				bookings.POST("/:id/budget-confirm/reject", middleware.RequireTransactionFlowEnabled(), handler.RejectBudgetConfirmation)
				bookings.POST("/:id/pay-intent", middleware.RequireTransactionFlowEnabled(), handler.PayIntentFee)
				bookings.POST("/:id/refund", middleware.RequireTransactionFlowEnabled(), handler.CreateBookingRefundApplication)
				bookings.DELETE("/:id/cancel", handler.CancelBooking)
				bookings.DELETE("/:id", handler.DeleteBooking)
				bookings.POST("/:id/pay-survey-deposit", middleware.RequireTransactionFlowEnabled(), handler.PaySurveyDeposit)
				bookings.POST("/:id/survey-deposit/refund", middleware.RequireTransactionFlowEnabled(), handler.RefundSurveyDeposit)
				bookings.GET("/:id/design-fee-quote", handler.GetDesignFeeQuoteForUser)
				bookings.GET("/:id/design-deliverable", handler.GetBookingDesignDeliverable)
				bookings.POST("/:id/select-crew", middleware.RequireTransactionFlowEnabled(), handler.SelectConstructionParty)
			}

			// 设计费报价
			designQuotes := authorized.Group("/design-quotes")
			{
				designQuotes.POST("/:id/confirm", middleware.RequireTransactionFlowEnabled(), handler.ConfirmDesignFeeQuote)
				designQuotes.POST("/:id/reject", middleware.RequireTransactionFlowEnabled(), handler.RejectDesignFeeQuote)
			}

			// 设计交付物
			designDeliverables := authorized.Group("/design-deliverables")
			{
				designDeliverables.POST("/:id/accept", middleware.RequireTransactionFlowEnabled(), handler.AcceptDesignDeliverable)
				designDeliverables.POST("/:id/reject", middleware.RequireTransactionFlowEnabled(), handler.RejectDesignDeliverable)
			}

			// 售后
			afterSales := authorized.Group("/after-sales")
			{
				afterSales.GET("", handler.GetAfterSalesList)
				afterSales.POST("", middleware.RequireTransactionFlowEnabled(), handler.CreateAfterSales)
				afterSales.GET("/:id", handler.GetAfterSalesDetail)
				afterSales.DELETE("/:id", handler.CancelAfterSales)
			}

			refunds := authorized.Group("/refunds")
			{
				refunds.GET("/my", handler.ListMyRefundApplications)
			}

			userPayments := authorized.Group("/payments")
			{
				userPayments.GET("/:id", handler.PaymentDetail)
				userPayments.GET("/:id/status", handler.PaymentStatus)
			}

			orderCenter := authorized.Group("/order-center")
			{
				orderCenter.GET("/entries", handler.ListOrderCenterEntries)
				orderCenter.GET("/entries/:entryKey", handler.GetOrderCenterEntry)
				orderCenter.POST("/entries/:entryKey/payments", middleware.RequireTransactionFlowEnabled(), handler.StartOrderCenterEntryPayment)
				orderCenter.POST("/entries/:entryKey/cancel", middleware.RequireTransactionFlowEnabled(), handler.CancelOrderCenterEntry)
			}

			// 项目
			projects := authorized.Group("/projects")
			{
				projects.POST("", middleware.RequireTransactionFlowEnabled(), handler.CreateProject)
				projects.GET("", handler.ListProjects)
				projects.GET("/:id", handler.GetProject)
				projects.PUT("/:id", middleware.RequireTransactionFlowEnabled(), handler.UpdateProject)
				projects.GET("/:id/logs", handler.GetProjectLogs)
				projects.POST("/:id/logs", middleware.RequireTransactionFlowEnabled(), handler.CreateProjectLog)
				projects.POST("/:id/construction/confirm", middleware.RequireTransactionFlowEnabled(), handler.ConfirmProjectConstruction)
				projects.POST("/:id/construction/quote/confirm", middleware.RequireTransactionFlowEnabled(), handler.ConfirmProjectConstructionQuote)
				projects.POST("/:id/start", middleware.RequireTransactionFlowEnabled(), handler.StartProject)
				projects.POST("/:id/pause", middleware.RequireTransactionFlowEnabled(), handler.PauseProject)
				projects.POST("/:id/resume", middleware.RequireTransactionFlowEnabled(), handler.ResumeProject)
				projects.GET("/:id/closure", handler.GetProjectClosure)
				projects.GET("/:id/change-orders", handler.ListProjectChangeOrders)
				projects.POST("/:id/dispute", middleware.RequireTransactionFlowEnabled(), handler.SubmitProjectDispute)
				projects.GET("/:id/milestones", handler.GetMilestones)
				projects.POST("/:id/milestones/:milestoneId/submit", middleware.RequireTransactionFlowEnabled(), handler.SubmitMilestone)
				projects.POST("/:id/milestones/:milestoneId/approve", middleware.RequireTransactionFlowEnabled(), handler.AcceptMilestone)
				projects.POST("/:id/milestones/:milestoneId/accept", middleware.RequireTransactionFlowEnabled(), handler.AcceptMilestone)
				projects.POST("/:id/milestones/:milestoneId/reject", middleware.RequireTransactionFlowEnabled(), handler.RejectMilestone)
				projects.POST("/:id/accept", middleware.RequireTransactionFlowEnabled(), handler.AcceptMilestone)
				projects.POST("/:id/complete", middleware.RequireTransactionFlowEnabled(), handler.CompleteProject)
				projects.POST("/:id/inspiration-draft", middleware.RequireTransactionFlowEnabled(), handler.CreateProjectInspirationDraft)
				projects.GET("/:id/completion", handler.GetProjectCompletion)
				projects.POST("/:id/completion/approve", middleware.RequireTransactionFlowEnabled(), handler.ApproveProjectCompletion)
				projects.POST("/:id/completion/reject", middleware.RequireTransactionFlowEnabled(), handler.RejectProjectCompletion)

				// 托管账户
				projects.GET("/:id/escrow", handler.GetEscrowAccount)
				projects.POST("/:id/deposit", middleware.RequireTransactionFlowEnabled(), handler.Deposit)
				projects.POST("/:id/release", middleware.RequireTransactionFlowEnabled(), handler.ReleaseFunds)

				// 节点付款系统
				milestonePaymentHandler := handler.NewMilestonePaymentHandler()
				projects.POST("/:id/milestone-payment-plan", middleware.RequireTransactionFlowEnabled(), milestonePaymentHandler.CreateMilestonePaymentPlan)
				projects.GET("/:id/milestone-payments", milestonePaymentHandler.GetMilestonePayments)

				// 项目阶段
				projects.GET("/:id/phases", handler.GetProjectPhases)

				// 验收清单
				projects.POST("/:id/inspections", middleware.RequireTransactionFlowEnabled(), handler.CreateInspectionChecklist)
				projects.GET("/:id/inspections", handler.GetInspectionChecklist)
				projects.PUT("/:id/inspections/:inspection_id", middleware.RequireTransactionFlowEnabled(), handler.UpdateInspectionChecklist)
				projects.POST("/:id/accept-all-milestones", middleware.RequireTransactionFlowEnabled(), handler.AcceptAllMilestones)
				projects.GET("/inspection-template", handler.GetInspectionTemplate)

				// 节点验收
				milestones := authorized.Group("/milestones")
				{
					milestones.POST("/:id/submit-inspection", middleware.RequireTransactionFlowEnabled(), handler.SubmitInspection)         // 商家提交验收申请
					milestones.POST("/:id/inspect", middleware.RequireTransactionFlowEnabled(), handler.InspectMilestone)                   // 用户验收节点
					milestones.POST("/:id/request-rectification", middleware.RequireTransactionFlowEnabled(), handler.RequestRectification) // 用户要求整改
					milestones.POST("/:id/resubmit-inspection", middleware.RequireTransactionFlowEnabled(), handler.ResubmitInspection)     // 商家重新提交

					// 节点付款
					milestones.POST("/:id/pay", middleware.RequireTransactionFlowEnabled(), milestonePaymentHandler.PayMilestone)
					milestones.POST("/:id/release-payment", middleware.RequireTransactionFlowEnabled(), milestonePaymentHandler.ReleaseMilestonePayment)
				}

				// 项目账单
				projects.GET("/:id/bill", handler.GetProjectBill)
				projects.POST("/:id/bill", middleware.RequireTransactionFlowEnabled(), handler.GenerateBill)
				projects.GET("/:id/files", handler.GetProjectFiles)
				projects.GET("/:id/contract", handler.GetProjectContract)
				projects.GET("/:id/design-deliverable", handler.GetDesignDeliverable)
			}

			// 阶段管理
			phases := authorized.Group("/phases")
			{
				phases.PUT("/:phaseId", middleware.RequireTransactionFlowEnabled(), handler.UpdatePhase)
				phases.PUT("/:phaseId/tasks/:taskId", middleware.RequireTransactionFlowEnabled(), handler.UpdatePhaseTask)
			}

			// 用户方案管理 (用户查看/确认/拒绝设计师提交的方案)
			proposals := authorized.Group("/proposals")
			{
				proposals.GET("", handler.ListMyProposals)
				proposals.GET("/pending-count", handler.GetPendingCount)
				proposals.GET("/booking/:bookingId/history", handler.GetProposalVersionHistory) // 获取版本历史
				proposals.GET("/:id", handler.GetProposal)
				proposals.POST("/:id/confirm", middleware.RequireTransactionFlowEnabled(), handler.ConfirmProposal)
				proposals.POST("/:id/reject", middleware.RequireTransactionFlowEnabled(), handler.RejectProposal) // 支持拒绝原因
			}

			demands := authorized.Group("/demands")
			{
				demands.POST("", middleware.RequireTransactionFlowEnabled(), handler.CreateDemand)
				demands.GET("", handler.ListDemands)
				demands.GET("/:id", handler.GetDemand)
				demands.PUT("/:id", middleware.RequireTransactionFlowEnabled(), handler.UpdateDemand)
				demands.POST("/:id/submit", middleware.RequireTransactionFlowEnabled(), handler.SubmitDemand)
			}

			complaints := authorized.Group("/complaints")
			{
				complaints.POST("", middleware.RequireTransactionFlowEnabled(), handler.CreateComplaint)
				complaints.GET("", handler.ListComplaints)
				complaints.GET("/:id", handler.GetComplaint)
			}

			authorized.POST("/contracts/:id/confirm", middleware.RequireTransactionFlowEnabled(), handler.ConfirmContract)
			authorized.GET("/contracts/:id", handler.GetContract)
			authorized.POST("/contracts/:id/sign", middleware.RequireTransactionFlowEnabled(), handler.SignContractByUser)
			authorized.GET("/contracts/:id/status", handler.GetContractStatus)
			authorized.GET("/contracts/:id/download", handler.DownloadContract)
			authorized.POST("/contracts/:id/pay-deposit", middleware.RequireTransactionFlowEnabled(), handler.StartContractDepositPayment)

			quoteTasks := authorized.Group("/quote-tasks")
			{
				quoteTasks.GET("/my", handler.UserListQuoteTasks)
				quoteTasks.GET("/:id/user-view", handler.UserGetQuoteTask)
			}

			// Legacy quote-pk 历史兼容只读区：写入口保留路由但固定返回 retired 冲突，不再承接现行主链。
			quotePK := authorized.Group("/quote-pk")
			{
				quotePK.POST("/tasks", middleware.RequireTransactionFlowEnabled(), handler.CreateQuoteTask)        // 用户发起报价需求
				quotePK.GET("/tasks/:id", handler.GetQuoteTask)                                                    // 获取报价任务详情
				quotePK.GET("/tasks/:id/submissions", handler.GetQuoteComparison)                                  // 获取报价对比表
				quotePK.POST("/tasks/:id/select", middleware.RequireTransactionFlowEnabled(), handler.SelectQuote) // 用户选择报价
			}

			quoteSubmissions := authorized.Group("/quote-submissions")
			{
				quoteSubmissions.POST("/:id/confirm", middleware.RequireTransactionFlowEnabled(), handler.UserConfirmQuoteSubmission)
				quoteSubmissions.POST("/:id/reject", middleware.RequireTransactionFlowEnabled(), handler.UserRejectQuoteSubmission)
				quoteSubmissions.GET("/:id/print", handler.UserPrintQuoteSubmission)
			}

			changeOrders := authorized.Group("/change-orders")
			{
				changeOrders.POST("/:id/confirm", middleware.RequireTransactionFlowEnabled(), handler.ConfirmChangeOrder)
				changeOrders.POST("/:id/reject", middleware.RequireTransactionFlowEnabled(), handler.RejectChangeOrder)
			}

			// 订单（用户端）
			orders := authorized.Group("/orders")
			{
				orders.GET("", handler.ListOrders)
				orders.GET("/pending-payments", handler.ListPendingPayments)
				orders.GET("/:id/plans", handler.GetOrderPaymentPlans)
				orders.GET("/:id", handler.GetOrder)
				orders.POST("/:id/pay", middleware.RequireTransactionFlowEnabled(), handler.PayOrder)
				orders.DELETE("/:id", middleware.RequireTransactionFlowEnabled(), handler.CancelOrder)
				// 分期付款
				orders.POST("/plans/:planId/pay", middleware.RequireTransactionFlowEnabled(), handler.PayPaymentPlan)
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
		adminPublic := v1.Group("/admin")
		adminPublic.Use(middleware.AdminNetworkGate())
		{
			adminPublic.POST("/login", middleware.LoginRateLimit(), handler.AdminLogin)
			adminPublic.POST("/ops/login", middleware.LoginRateLimit(), handler.AdminOpsLogin)
			adminPublic.POST("/token/refresh", middleware.LoginRateLimit(), handler.AdminRefreshToken)
		}

		adminSecurity := v1.Group("/admin")
		adminSecurity.Use(middleware.AdminNetworkGate())
		adminSecurity.Use(middleware.AdminJWT(cfg.JWT.Secret))
		{
			adminSecurity.GET("/info", handler.AdminGetInfo)
			adminSecurity.POST("/logout", handler.AdminLogout)
			adminSecurity.GET("/security/status", handler.AdminGetSecurityStatus)
			adminSecurity.POST("/security/password/reset-initial", handler.AdminResetInitialPassword)
			adminSecurity.POST("/security/2fa/bind", handler.AdminBeginBind2FA)
			adminSecurity.POST("/security/2fa/verify", handler.AdminVerify2FA)
			adminSecurity.POST("/security/2fa/reset", middleware.RequireActiveAdminSession(), middleware.RequireAdminReason(), middleware.RequireAdminReauth(), handler.AdminReset2FA)
			adminSecurity.POST("/security/2fa/recovery/request", middleware.LoginRateLimit(), handler.AdminRequest2FARecovery)
			adminSecurity.GET("/security/sessions", middleware.RequireActiveAdminSession(), handler.AdminListSecuritySessions)
			adminSecurity.POST("/security/sessions/:sid/revoke", middleware.RequireActiveAdminSession(), middleware.RequireAdminReason(), middleware.RequireAdminReauth(), handler.AdminRevokeSecuritySession)
			adminSecurity.POST("/security/reauth", middleware.RequireActiveAdminSession(), handler.AdminReauth)
		}

		// ✅ 管理后台路由（使用AdminJWT中间件验证token类型）
		admin := v1.Group("/admin")
		admin.Use(middleware.AdminNetworkGate())
		admin.Use(middleware.AdminJWT(cfg.JWT.Secret))
		admin.Use(middleware.RequireActiveAdminSession())
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
			financeEscrowFreezePerm := middleware.RequirePermission("finance:escrow:freeze")
			financeEscrowUnfreezePerm := middleware.RequirePermission("finance:escrow:unfreeze")
			financeTransactionListPerm := middleware.RequirePermission("finance:transaction:list")
			financeTransactionViewPerm := middleware.RequirePermission("finance:transaction:view")
			financeTransactionApprovePerm := middleware.RequirePermission("finance:transaction:approve")
			financeTransactionExportPerm := middleware.RequirePermission("finance:transaction:export")
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
			supervisionWorkspaceViewPerm := middleware.RequirePermission("supervision:workspace:view")
			supervisionWorkspaceEditPerm := middleware.RequirePermission("supervision:workspace:edit")
			supervisionRiskCreatePerm := middleware.RequirePermission("supervision:risk:create")
			supervisorListPerm := middleware.RequirePermission("supervision:supervisor:list")
			supervisorEditPerm := middleware.RequirePermission("supervision:supervisor:edit")
			supervisorAssignPerm := middleware.RequirePermission("supervision:assignment:manage")
			orderCenterListPerm := middleware.RequirePermission("order:center:list")
			orderCenterViewPerm := middleware.RequirePermission("order:center:view")
			proposalReviewPerm := middleware.RequirePermission("proposal:review")
			demandListPerm := middleware.RequirePermission("demand:list")
			demandReviewPerm := middleware.RequirePermission("demand:review")
			demandAssignPerm := middleware.RequirePermission("demand:assign")
			complaintListPerm := middleware.RequirePermission("risk:arbitration:list")
			complaintResolvePerm := middleware.RequirePermission("risk:arbitration:judge")

			admin.POST("/upload", caseListPerm, handler.AdminUploadImage)

			// 统计
			admin.GET("/health", dashboardRead, handler.HealthCheckDetailed)
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
			admin.POST("/admins", adminCreatePerm, middleware.RequireAdminReason(), middleware.RequireAdminReauth(), handler.AdminCreateAdmin)
			admin.PUT("/admins/:id", adminEditPerm, middleware.RequireAdminReason(), middleware.RequireAdminReauth(), handler.AdminUpdateAdmin)
			admin.DELETE("/admins/:id", adminDeletePerm, middleware.RequireAdminReason(), middleware.RequireAdminReauth(), handler.AdminDeleteAdmin)
			admin.PATCH("/admins/:id/status", adminEditPerm, middleware.RequireAdminReason(), middleware.RequireAdminReauth(), handler.AdminUpdateAdminStatus)

			// 服务商管理
			admin.GET("/providers", providerListPerm, handler.AdminListProviders)
			admin.POST("/providers", providerCreatePerm, handler.AdminCreateProvider)
			admin.PUT("/providers/:id", providerEditPerm, handler.AdminUpdateProvider)
			admin.PATCH("/providers/:id/verify", providerEditPerm, handler.AdminVerifyProvider)
			admin.PATCH("/providers/:id/status", providerEditPerm, handler.AdminUpdateProviderStatus)
			admin.PATCH("/providers/:id/platform-display", providerEditPerm, middleware.RequireAdminReason(), middleware.RequireAdminReauth(), handler.AdminUpdateProviderPlatformDisplay)
			admin.PATCH("/providers/:id/availability", providerEditPerm, middleware.RequireAdminReason(), middleware.RequireAdminReauth(), handler.AdminSetProviderAvailability)
			admin.POST("/providers/:id/claim-account", providerEditPerm, middleware.RequireAdminReason(), middleware.RequireAdminReauth(), handler.AdminClaimProviderAccount)
			admin.POST("/providers/:id/complete-settlement", providerEditPerm, handler.AdminCompleteProviderSettlement)

			// 预约管理
			admin.GET("/bookings", bookingListPerm, handler.AdminListBookings)
			admin.GET("/bookings/:id", bookingListPerm, handler.AdminGetBooking)
			admin.PATCH("/bookings/:id/status", bookingEditPerm, handler.AdminUpdateBookingStatus)
			admin.GET("/bookings/refundable", financeTransactionApprovePerm, handler.AdminGetRefundableBookings)
			admin.POST("/bookings/:bookingId/refund", financeTransactionApprovePerm, middleware.RequireAdminReason("reason"), middleware.RequireAdminReauth(), handler.AdminRefundIntentFee)

			// 评价管理
			admin.GET("/reviews", reviewListPerm, handler.AdminListReviews)
			admin.DELETE("/reviews/:id", reviewDeletePerm, handler.AdminDeleteReview)

			// 主材门店管理
			admin.GET("/material-shops", materialShopListPerm, handler.AdminListMaterialShops)
			admin.GET("/material-shops/:id", materialShopListPerm, handler.AdminGetMaterialShop)
			admin.POST("/material-shops", materialShopCreatePerm, handler.AdminCreateMaterialShop)
			admin.PUT("/material-shops/:id", materialShopEditPerm, handler.AdminUpdateMaterialShop)
			admin.DELETE("/material-shops/:id", materialShopDeletePerm, handler.AdminDeleteMaterialShop)
			admin.GET("/material-shops/:id/products", materialShopListPerm, handler.AdminListMaterialShopProducts)
			admin.POST("/material-shops/:id/products", materialShopEditPerm, handler.AdminCreateMaterialShopProduct)
			admin.PUT("/material-shops/:id/products/:productId", materialShopEditPerm, handler.AdminUpdateMaterialShopProduct)
			admin.DELETE("/material-shops/:id/products/:productId", materialShopEditPerm, handler.AdminDeleteMaterialShopProduct)
			admin.PATCH("/material-shops/:id/verify", materialShopEditPerm, handler.AdminVerifyMaterialShop)
			admin.PATCH("/material-shops/:id/status", materialShopEditPerm, handler.AdminUpdateMaterialShopStatus)
			admin.PATCH("/material-shops/:id/platform-display", materialShopEditPerm, middleware.RequireAdminReason(), middleware.RequireAdminReauth(), handler.AdminUpdateMaterialShopPlatformDisplay)
			admin.PATCH("/material-shops/:id/availability", materialShopEditPerm, middleware.RequireAdminReason(), middleware.RequireAdminReauth(), handler.AdminSetMaterialShopAvailability)
			admin.POST("/material-shops/:id/complete-account", materialShopEditPerm, middleware.RequireAdminReason(), middleware.RequireAdminReauth(), handler.AdminCompleteMaterialShopAccount)

			// 审核管理
			admin.GET("/project-audits", complaintListPerm, handler.AdminListProjectAudits)
			admin.GET("/project-audits/:id", complaintListPerm, handler.AdminGetProjectAudit)
			admin.POST("/project-audits/:id/arbitrate", complaintResolvePerm, middleware.RequireAdminReason("conclusionReason", "reason"), middleware.RequireAdminReauth(), handler.AdminArbitrateProjectAudit)
			admin.POST("/projects/:id/close", complaintResolvePerm, middleware.RequireAdminReason("reason"), middleware.RequireAdminReauth(), handler.AdminCloseProject)
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
			admin.PUT("/regions/:id/service-toggle", settingEditPerm, middleware.RequireAdminReason(), middleware.RequireAdminReauth(), handler.AdminToggleRegionService)

			// 财务管理
			admin.GET("/finance/overview", financeEscrowListPerm, handler.AdminGetFinanceOverview)
			admin.GET("/finance/escrow-accounts", financeEscrowListPerm, handler.AdminListEscrowAccounts)
			admin.GET("/finance/payment-orders", financeTransactionListPerm, handler.AdminListPaymentOrders)
			admin.GET("/finance/payment-orders/:id", financeTransactionViewPerm, handler.AdminGetPaymentOrderDetail)
			admin.GET("/finance/transactions", financeTransactionListPerm, handler.AdminListTransactions)
			admin.GET("/finance/transactions/export", financeTransactionExportPerm, handler.AdminExportTransactions)
			admin.GET("/finance/reconciliations", financeTransactionListPerm, handler.AdminListFinanceReconciliations)
			admin.POST("/finance/reconciliations/run", financeTransactionApprovePerm, handler.AdminRunFinanceReconciliation)
			admin.POST("/finance/reconciliations/:id/claim", financeTransactionApprovePerm, handler.AdminClaimFinanceReconciliation)
			admin.POST("/finance/reconciliations/:id/resolve", financeTransactionApprovePerm, handler.AdminResolveFinanceReconciliation)
			admin.POST("/finance/freeze", financeEscrowFreezePerm, middleware.RequireAdminReason(), middleware.RequireAdminReauth(), handler.AdminFreezeFunds)
			admin.POST("/finance/unfreeze", financeEscrowUnfreezePerm, middleware.RequireAdminReason(), middleware.RequireAdminReauth(), handler.AdminUnfreezeFunds)
			admin.POST("/finance/manual-release", financeTransactionApprovePerm, middleware.RequireAdminReason(), middleware.RequireAdminReauth(), handler.AdminManualReleaseFunds)
			admin.POST("/finance/escrow-accounts/:accountId/withdraw", financeTransactionApprovePerm, middleware.RequireAdminReason(), middleware.RequireAdminReauth(), handler.AdminWithdraw)

			// 对账报表管理
			admin.GET("/reconciliation/list", financeTransactionListPerm, handler.AdminReconciliationList)
			admin.GET("/reconciliation/:id", financeTransactionViewPerm, handler.AdminReconciliationDetail)
			admin.GET("/reconciliation/:id/differences", financeTransactionListPerm, handler.AdminReconciliationDifferences)
			admin.POST("/reconciliation/differences/:id/resolve", financeTransactionApprovePerm, middleware.RequireAdminReason("resolveNotes"), middleware.RequireAdminReauth(), handler.AdminReconciliationResolve)
			admin.POST("/reconciliation/differences/:id/investigate", financeTransactionApprovePerm, middleware.RequireAdminReauth(), handler.AdminReconciliationDifferenceInvestigate)
			admin.POST("/reconciliation/differences/:id/ignore", financeTransactionApprovePerm, middleware.RequireAdminReason("reason"), middleware.RequireAdminReauth(), handler.AdminReconciliationDifferenceIgnore)
			admin.POST("/reconciliation/differences/:id/resolve-enhanced", financeTransactionApprovePerm, middleware.RequireAdminReason("solution"), middleware.RequireAdminReauth(), handler.AdminReconciliationDifferenceResolve)

			// 风险管理
			admin.GET("/risk/warnings", riskWarningListPerm, handler.AdminListRiskWarnings)
			admin.POST("/risk/warnings/:id/handle", riskWarningHandlePerm, middleware.RequireAdminReason("result", "reason"), middleware.RequireAdminReauth(), handler.AdminHandleRiskWarning)
			admin.GET("/risk/arbitrations", riskArbitrationListPerm, handler.AdminListArbitrations)
			admin.PUT("/risk/arbitrations/:id", riskArbitrationJudgePerm, middleware.RequireAdminReason("result", "reason"), middleware.RequireAdminReauth(), handler.AdminUpdateArbitration)

			// 系统设置
			admin.GET("/settings", settingListPerm, handler.AdminGetSettings)
			admin.PUT("/settings", settingEditPerm, middleware.RequireAdminReason(), middleware.RequireAdminReauth(), handler.AdminUpdateSettings)
			admin.GET("/system-configs", settingListPerm, handler.AdminGetSystemConfigs)
			admin.PUT("/system-configs/:key", settingEditPerm, middleware.RequireAdminReason(), middleware.RequireAdminReauth(), handler.AdminUpdateSystemConfig)
			admin.PUT("/system-configs/batch", settingEditPerm, middleware.RequireAdminReason(), middleware.RequireAdminReauth(), handler.AdminBatchUpdateSystemConfigs)
			admin.GET("/outbox-events", logListPerm, handler.AdminListOutboxEvents)
			admin.GET("/outbox-events/:id", logListPerm, handler.AdminGetOutboxEvent)
			admin.POST("/outbox-events/:id/retry", settingEditPerm, middleware.RequireAdminReason(), middleware.RequireAdminReauth(), handler.AdminRetryOutboxEvent)
			admin.POST("/outbox-events/:id/ignore", settingEditPerm, middleware.RequireAdminReason(), handler.AdminIgnoreOutboxEvent)

			// 提现审核管理
			admin.GET("/withdraws", financeTransactionListPerm, handler.AdminWithdrawList)
			admin.GET("/withdraws/:id", financeTransactionViewPerm, handler.AdminWithdrawDetail)
			admin.POST("/withdraws/:id/approve", financeTransactionApprovePerm, middleware.RequireAdminReason("remark", "reason"), middleware.RequireAdminReauth(), handler.AdminWithdrawApprove)
			admin.POST("/withdraws/:id/mark-paid", financeTransactionApprovePerm, middleware.RequireAdminReason("remark", "reason"), middleware.RequireAdminReauth(), handler.AdminWithdrawMarkPaid)
			admin.POST("/withdraws/:id/reject", financeTransactionApprovePerm, middleware.RequireAdminReason("reason", "remark"), middleware.RequireAdminReauth(), handler.AdminWithdrawReject)

			// 出款报表管理
			admin.GET("/payout/list", financeTransactionListPerm, handler.AdminPayoutList)
			admin.GET("/payout/:id", financeTransactionViewPerm, handler.AdminPayoutDetail)
			admin.POST("/payout/:id/retry", financeTransactionApprovePerm, middleware.RequireAdminReason("reason", "remark"), middleware.RequireAdminReauth(), handler.AdminPayoutRetry)

			// 操作日志
			admin.GET("/logs", logListPerm, handler.AdminListLogs)
			admin.GET("/audit-logs", logListPerm, handler.AdminListAuditLogs)
			admin.GET("/audit-logs/export", logListPerm, handler.AdminExportAuditLogs)

			// ========== RBAC 权限管理 ==========
			admin.GET("/roles", roleListPerm, handler.AdminListRoles)
			admin.POST("/roles", roleCreatePerm, middleware.RequireAdminReason(), middleware.RequireAdminReauth(), handler.AdminCreateRole)
			admin.PUT("/roles/:id", roleEditPerm, middleware.RequireAdminReason(), middleware.RequireAdminReauth(), handler.AdminUpdateRole)
			admin.DELETE("/roles/:id", roleDeletePerm, middleware.RequireAdminReason(), middleware.RequireAdminReauth(), handler.AdminDeleteRole)
			admin.GET("/roles/:id/menus", roleAssignPerm, handler.AdminGetRoleMenus)
			admin.POST("/roles/:id/menus", roleAssignPerm, middleware.RequireAdminReason("reason", "remark", "note", "adminNotes"), middleware.RequireAdminReauth(), handler.AdminAssignRoleMenus)
			admin.GET("/menus", menuListPerm, handler.AdminListMenus)
			admin.POST("/menus", menuCreatePerm, superAdminOnly, middleware.RequireAdminReason(), middleware.RequireAdminReauth(), handler.AdminCreateMenu)
			admin.PUT("/menus/:id", menuEditPerm, superAdminOnly, middleware.RequireAdminReason(), middleware.RequireAdminReauth(), handler.AdminUpdateMenu)
			admin.DELETE("/menus/:id", menuDeletePerm, superAdminOnly, middleware.RequireAdminReason(), middleware.RequireAdminReauth(), handler.AdminDeleteMenu)

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
			admin.GET("/business-flows", orderCenterListPerm, handler.AdminListBusinessFlows)
			admin.GET("/business-flows/:id", orderCenterViewPerm, handler.AdminGetBusinessFlow)
			admin.POST("/proposals/:id/confirm", proposalReviewPerm, middleware.RequireAdminReason("reason", "remark", "note", "adminNotes"), handler.AdminConfirmProposal)
			admin.POST("/proposals/:id/reject", proposalReviewPerm, middleware.RequireAdminReason("reason", "remark", "note", "adminNotes"), handler.AdminRejectProposal)
			admin.GET("/projects", projectListPerm, handler.AdminListProjects)
			admin.POST("/projects", projectEditPerm, handler.AdminCreateProject)
			admin.GET("/projects/:id", projectViewPerm, handler.AdminGetProject)
			admin.PUT("/projects/:id", projectEditPerm, handler.AdminUpdateProject)
			admin.GET("/projects/:id/change-orders", projectViewPerm, handler.AdminListProjectChangeOrders)
			admin.POST("/projects/:id/change-orders", projectEditPerm, handler.AdminCreateProjectChangeOrder)
			admin.POST("/projects/:id/audit", complaintResolvePerm, handler.AdminCreateProjectAudit)
			admin.PUT("/projects/:id/status", projectEditPerm, handler.AdminUpdateProjectStatus)
			admin.POST("/projects/:id/construction/confirm", projectEditPerm, middleware.RequireAdminReason("reason", "remark", "note", "adminNotes"), handler.AdminConfirmProjectConstruction)
			admin.POST("/projects/:id/construction/quote/confirm", projectEditPerm, middleware.RequireAdminReason("reason", "remark", "note", "adminNotes"), handler.AdminConfirmProjectConstructionQuote)
			admin.POST("/projects/:id/start", projectEditPerm, middleware.RequireAdminReason("reason", "remark", "note", "adminNotes"), handler.AdminStartProject)
			admin.POST("/projects/:id/pause", projectEditPerm, middleware.RequireAdminReason("reason", "remark", "note", "adminNotes"), handler.AdminPauseProject)
			admin.POST("/projects/:id/resume", projectEditPerm, middleware.RequireAdminReason("reason", "remark", "note", "adminNotes"), handler.AdminResumeProject)
			admin.POST("/projects/:id/milestones/:milestoneId/approve", projectEditPerm, middleware.RequireAdminReason("reason", "remark", "note", "adminNotes"), handler.AdminApproveProjectMilestone)
			admin.POST("/projects/:id/milestones/:milestoneId/reject", projectEditPerm, middleware.RequireAdminReason("reason", "remark", "note", "adminNotes"), handler.AdminRejectProjectMilestone)
			admin.POST("/projects/:id/completion/approve", projectEditPerm, middleware.RequireAdminReason("reason", "remark", "note", "adminNotes"), handler.AdminApproveProjectCompletion)
			admin.POST("/projects/:id/completion/reject", projectEditPerm, middleware.RequireAdminReason("reason", "remark", "note", "adminNotes"), handler.AdminRejectProjectCompletion)
			admin.GET("/projects/:id/phases", projectViewPerm, handler.AdminGetProjectPhases)
			admin.PUT("/projects/:id/phases/:phaseId", projectEditPerm, handler.AdminUpdatePhase)
			admin.GET("/projects/:id/logs", projectViewPerm, handler.AdminGetProjectLogs)
			admin.POST("/projects/:id/phases/:phaseId/logs", projectEditPerm, handler.AdminCreateWorkLog)
			admin.PUT("/logs/:logId", projectEditPerm, handler.AdminUpdateWorkLog)
			admin.DELETE("/logs/:logId", projectEditPerm, handler.AdminDeleteWorkLog)

			// ========== 监理工作台 ==========
			admin.GET("/supervision/projects", supervisionWorkspaceViewPerm, handler.AdminListSupervisionProjects)
			admin.GET("/supervision/projects/:id", supervisionWorkspaceViewPerm, handler.AdminGetSupervisionProject)
			admin.GET("/supervision/projects/:id/phases", supervisionWorkspaceViewPerm, handler.AdminGetSupervisionProjectPhases)
			admin.GET("/supervision/projects/:id/logs", supervisionWorkspaceViewPerm, handler.AdminGetSupervisionProjectLogs)
			admin.POST("/supervision/projects/:id/phases/:phaseId/logs", supervisionWorkspaceEditPerm, handler.AdminCreateSupervisionWorkLog)
			admin.PUT("/supervision/projects/:id/phases/:phaseId", supervisionWorkspaceEditPerm, handler.AdminUpdateSupervisionPhase)
			admin.PUT("/supervision/projects/:id/phases/:phaseId/tasks/:taskId", supervisionWorkspaceEditPerm, handler.AdminUpdateSupervisionPhaseTask)
			admin.POST("/supervision/projects/:id/risk-warnings", supervisionRiskCreatePerm, handler.AdminCreateSupervisionRiskWarning)

			// ========== 监理白名单管理 ==========
			admin.GET("/supervisor-whitelists", supervisorListPerm, handler.AdminListSupervisorWhitelists)
			admin.POST("/supervisor-whitelists", supervisorEditPerm, middleware.RequireAdminReason(), middleware.RequireAdminReauth(), handler.AdminCreateSupervisorWhitelist)
			admin.PATCH("/supervisor-whitelists/:id/status", supervisorEditPerm, middleware.RequireAdminReason(), middleware.RequireAdminReauth(), handler.AdminUpdateSupervisorWhitelistStatus)

			// ========== 监理申请审核 ==========
			admin.GET("/supervisor-applications", supervisorListPerm, handler.AdminListSupervisorApplications)
			admin.POST("/supervisor-applications/:id/approve", supervisorEditPerm, middleware.RequireAdminReason(), middleware.RequireAdminReauth(), handler.AdminApproveSupervisorApplication)
			admin.POST("/supervisor-applications/:id/reject", supervisorEditPerm, middleware.RequireAdminReason("reason", "rejectReason", "remark", "note", "adminNotes"), middleware.RequireAdminReauth(), handler.AdminRejectSupervisorApplication)

			// ========== 监理账号启停 ==========
			admin.PATCH("/supervisor-accounts/:id/status", supervisorEditPerm, middleware.RequireAdminReason(), middleware.RequireAdminReauth(), handler.AdminUpdateSupervisorAccountStatus)

			// ========== 监理人员管理 ==========
			admin.GET("/supervisors", supervisorListPerm, handler.AdminListSupervisors)
			admin.POST("/supervisors", supervisorEditPerm, middleware.RequireAdminReason(), middleware.RequireAdminReauth(), handler.AdminCreateSupervisor)
			admin.GET("/supervisors/available", supervisorListPerm, handler.AdminListAvailableSupervisors)
			admin.GET("/supervisors/:id", supervisorListPerm, handler.AdminGetSupervisor)
			admin.PUT("/supervisors/:id", supervisorEditPerm, middleware.RequireAdminReason(), middleware.RequireAdminReauth(), handler.AdminUpdateSupervisor)
			admin.PATCH("/supervisors/:id/status", supervisorEditPerm, middleware.RequireAdminReason(), middleware.RequireAdminReauth(), handler.AdminUpdateSupervisorStatus)
			admin.DELETE("/supervisors/:id", supervisorEditPerm, middleware.RequireAdminReason(), middleware.RequireAdminReauth(), handler.AdminDeleteSupervisor)

			// ========== 监理分配管理 ==========
			admin.GET("/supervisor-assignments", supervisorAssignPerm, handler.AdminListSupervisorAssignments)
			admin.POST("/supervisor-assignments", supervisorAssignPerm, middleware.RequireAdminReason(), handler.AdminCreateSupervisorAssignment)
			admin.DELETE("/supervisor-assignments/:id", supervisorAssignPerm, middleware.RequireAdminReason(), handler.AdminDeleteSupervisorAssignment)
			admin.POST("/quote-library/import", projectEditPerm, handler.AdminImportQuoteLibrary)
			admin.POST("/quote-library/import-preview", projectEditPerm, handler.AdminImportQuoteLibraryPreview)
			admin.GET("/quote-categories", projectListPerm, handler.AdminListQuoteCategories)
			admin.POST("/quote-categories", projectEditPerm, handler.AdminCreateQuoteCategory)
			admin.DELETE("/quote-categories/:id", projectEditPerm, handler.AdminDeleteQuoteCategory)
			admin.GET("/quote-library/items", projectListPerm, handler.AdminListQuoteLibraryItems)
			admin.POST("/quote-library/items", projectEditPerm, handler.AdminCreateQuoteLibraryItem)
			admin.PUT("/quote-library/items/:id", projectEditPerm, handler.AdminUpdateQuoteLibraryItem)
			admin.DELETE("/quote-library/items/:id", projectEditPerm, handler.AdminDeleteQuoteLibraryItem)

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
			admin.POST("/quote-templates/ensure", projectEditPerm, handler.AdminEnsureQuoteTemplate)

			admin.GET("/quote-lists", projectListPerm, handler.AdminListQuoteLists)
			admin.GET("/quote-lists/:id", projectViewPerm, handler.AdminGetQuoteListDetail)
			admin.POST("/quote-lists", projectEditPerm, handler.AdminCreateQuoteList)
			admin.POST("/quote-lists/rebuild-from-legacy", projectEditPerm, handler.AdminRebuildQuoteListFromLegacy)
			admin.POST("/quote-lists/:id/items/batch-upsert", projectEditPerm, handler.AdminBatchUpsertQuoteListItems)
			admin.POST("/quote-lists/:id/invitations", projectEditPerm, handler.AdminCreateQuoteInvitations)
			admin.POST("/quote-lists/:id/start", projectEditPerm, handler.AdminStartQuoteList)
			admin.GET("/quote-lists/:id/comparison", projectViewPerm, handler.AdminGetQuoteComparison)
			admin.POST("/quote-lists/:id/award", projectEditPerm, handler.AdminAwardQuote)
			admin.GET("/providers/:id/price-book", providerListPerm, handler.AdminGetProviderPriceBook)
			admin.GET("/provider-price-books/inspection", providerListPerm, handler.AdminListProviderPriceBookInspection)
			admin.GET("/quote-tasks", projectListPerm, handler.AdminListQuoteLists)
			admin.GET("/quote-tasks/:id", projectViewPerm, handler.AdminGetQuoteListDetail)
			admin.POST("/quote-tasks", projectEditPerm, handler.AdminCreateQuoteList)
			admin.POST("/quote-tasks/:id/items/batch-upsert", projectEditPerm, handler.AdminBatchUpsertQuoteListItems)
			admin.PUT("/quote-tasks/:id/prerequisites", projectEditPerm, handler.AdminUpdateQuoteTaskPrerequisites)
			admin.POST("/quote-tasks/:id/validate-prerequisites", projectEditPerm, handler.AdminValidateQuoteTaskPrerequisites)
			admin.POST("/quote-tasks/:id/recommend-foremen", projectEditPerm, handler.AdminRecommendForemen)
			admin.POST("/quote-tasks/:id/select-foremen", projectEditPerm, handler.AdminSelectForemen)
			admin.POST("/quote-tasks/:id/generate-drafts", projectEditPerm, handler.AdminGenerateQuoteDrafts)
			admin.GET("/quote-submissions/:id/revisions", projectViewPerm, handler.AdminListQuoteSubmissionRevisions)
			admin.POST("/quote-submissions/:id/review", projectEditPerm, handler.AdminReviewQuoteSubmission)
			admin.POST("/change-orders/:id/settle", projectEditPerm, handler.AdminSettleChangeOrder)
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

			// 退款申请审核
			admin.GET("/refunds", financeTransactionApprovePerm, handler.AdminListRefundApplications)
			admin.GET("/refunds/:id", financeTransactionApprovePerm, handler.AdminGetRefundApplication)
			admin.POST("/refunds/:id/approve", financeTransactionApprovePerm, middleware.RequireAdminReason("adminNotes", "reason"), middleware.RequireAdminReauth(), handler.AdminApproveRefundApplication)
			admin.POST("/refunds/:id/reject", financeTransactionApprovePerm, middleware.RequireAdminReason("adminNotes", "reason"), middleware.RequireAdminReauth(), handler.AdminRejectRefundApplication)

			// ========== 智能报价询价管理 ==========
			admin.GET("/quote-inquiries", demandListPerm, handler.AdminListQuoteInquiries)
			admin.GET("/quote-inquiries/:id", demandListPerm, handler.AdminGetQuoteInquiry)

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
		v1.POST("/merchant/apply", middleware.RequireMerchantPortalEnabled(), handler.MerchantApply)
		v1.GET("/merchant/apply/:phone/status", middleware.RequireMerchantPortalEnabled(), handler.MerchantApplyStatus)
		v1.POST("/merchant/apply/:id/detail-for-resubmit", middleware.RequireMerchantPortalEnabled(), handler.MerchantApplyDetailForResubmit)
		v1.POST("/merchant/apply/:id/resubmit", middleware.RequireMerchantPortalEnabled(), handler.MerchantResubmit)
		v1.POST("/merchant/change-application", middleware.RequireMerchantPortalEnabled(), handler.MerchantApplyIdentityChange)
		v1.POST("/merchant/upload-public", middleware.RequireMerchantPortalEnabled(), handler.MerchantUploadImage)
		v1.POST("/merchant/onboarding/validate-license", middleware.RequireMerchantPortalEnabled(), handler.MerchantValidateOnboardingLicense)
		v1.POST("/merchant/onboarding/validate-id-card", middleware.RequireMerchantPortalEnabled(), handler.MerchantValidateOnboardingIDCard)
		v1.POST("/merchant/onboarding/verify-phone", middleware.RequireMerchantPortalEnabled(), handler.MerchantVerifyOnboardingPhone)
		v1.POST("/material-shop/apply", middleware.RequireMerchantPortalEnabled(), handler.MaterialShopApply)
		v1.GET("/material-shop/apply/:phone/status", middleware.RequireMerchantPortalEnabled(), handler.MaterialShopApplyStatus)
		v1.POST("/material-shop/apply/:id/detail-for-resubmit", middleware.RequireMerchantPortalEnabled(), handler.MaterialShopApplyDetailForResubmit)
		v1.POST("/material-shop/apply/:id/resubmit", middleware.RequireMerchantPortalEnabled(), handler.MaterialShopApplyResubmit)

		// 商家登录 (无需认证)
		v1.POST("/merchant/login/send-code", middleware.RequireMerchantPortalEnabled(), middleware.LoginRateLimit(), handler.MerchantSendLoginCode)
		v1.POST("/merchant/login", middleware.RequireMerchantPortalEnabled(), middleware.LoginRateLimit(), handler.MerchantLogin(cfg))

		// 商家端路由（使用 MerchantJWT 中间件验证 token 类型）
		merchant := v1.Group("/merchant")
		merchant.Use(middleware.MerchantJWT(cfg.JWT.Secret))
		merchant.Use(middleware.RequireMerchantPortalEnabled())
		{
			transactionGate := middleware.RequireTransactionFlowEnabled()

			// Tinode helper endpoints
			merchant.GET("/tinode/userid/:userId", handler.GetTinodeUserID)

			// 合同管理
			merchant.POST("/contracts", transactionGate, handler.MerchantRequireCompletedOnboarding(), handler.CreateContract)
			merchant.POST("/contracts/:id/sign", transactionGate, handler.SignContractByProvider)

			// 获取当前商家信息
			merchant.GET("/info", handler.MerchantGetInfo)
			merchant.GET("/onboarding/completion", handler.MerchantGetOnboardingCompletion)
			merchant.POST("/onboarding/completion", handler.MerchantSubmitOnboardingCompletion)
			merchant.PUT("/info", handler.MerchantRequireCompletedOnboarding(), handler.MerchantUpdateInfo)
			merchant.POST("/avatar", handler.MerchantUploadAvatar)
			merchant.POST("/upload", handler.MerchantUploadImage)
			merchant.GET("/service-settings", handler.MerchantGetServiceSettings)
			merchant.PUT("/service-settings", handler.MerchantRequireCompletedOnboarding(), handler.MerchantUpdateServiceSettings)
			merchant.GET("/price-book", handler.MerchantGetPriceBook)
			merchant.PUT("/price-book", handler.MerchantRequireCompletedOnboarding(), handler.MerchantUpdatePriceBook)
			merchant.POST("/price-book/publish", handler.MerchantRequireCompletedOnboarding(), handler.MerchantPublishPriceBook)

			// 预约管理
			merchant.GET("/bookings", handler.MerchantListBookings)
			merchant.GET("/bookings/:id", handler.MerchantGetBookingDetail)
			merchant.GET("/bookings/:id/flow-summary", handler.MerchantGetBookingFlowSummary)
			merchant.PUT("/bookings/:id/handle", transactionGate, handler.MerchantRequireCompletedOnboarding(), handler.MerchantHandleBooking)
			merchant.GET("/bookings/:id/site-survey", handler.MerchantGetSiteSurvey)
			merchant.POST("/bookings/:id/site-survey", transactionGate, handler.MerchantRequireCompletedOnboarding(), handler.MerchantSubmitSiteSurvey)
			merchant.GET("/bookings/:id/budget-confirm", handler.MerchantGetBudgetConfirmation)
			merchant.POST("/bookings/:id/budget-confirm", transactionGate, handler.MerchantRequireCompletedOnboarding(), handler.MerchantSubmitBudgetConfirmation)
			merchant.POST("/bookings/:id/confirm-crew", transactionGate, handler.ConfirmConstructionParty)
			merchant.GET("/quote-lists", handler.MerchantListQuoteLists)
			merchant.GET("/quote-lists/:id", handler.MerchantGetQuoteListDetail)
			merchant.PUT("/quote-lists/:id/submission", transactionGate, handler.MerchantRequireCompletedOnboarding(), handler.MerchantSaveQuoteSubmission)
			merchant.POST("/quote-lists/:id/submission/submit", transactionGate, handler.MerchantRequireCompletedOnboarding(), handler.MerchantSubmitQuoteSubmission)
			merchant.GET("/quote-tasks", handler.MerchantListQuoteTasks)
			merchant.GET("/quote-tasks/:id", handler.MerchantGetQuoteTask)
			merchant.GET("/quote-tasks/:id/preparation", handler.MerchantGetQuoteTaskPreparation)
			merchant.PUT("/quote-tasks/:id/prerequisites", transactionGate, handler.MerchantRequireCompletedOnboarding(), handler.MerchantUpdateQuoteTaskPrerequisites)
			merchant.PUT("/quote-tasks/:id/quantity-items", transactionGate, handler.MerchantRequireCompletedOnboarding(), handler.MerchantUpdateQuoteTaskQuantityItems)
			merchant.POST("/quote-tasks/:id/recommend-foremen", transactionGate, handler.MerchantRecommendForemen)
			merchant.POST("/quote-tasks/:id/select-foremen", transactionGate, handler.MerchantRequireCompletedOnboarding(), handler.MerchantSelectForemen)

			// Legacy quote-pk 历史兼容区：保留商家历史深链和补交流程，不再作为现行主链扩展入口。
			merchant.GET("/quote-pk/tasks", handler.MerchantGetQuoteTasks)                                                                          // 商家获取报价任务列表
			merchant.POST("/quote-pk/tasks/:id/submit", transactionGate, handler.MerchantRequireCompletedOnboarding(), handler.MerchantSubmitQuote) // 商家提交报价
			merchant.POST("/bookings/:id/working-docs", transactionGate, handler.MerchantRequireCompletedOnboarding(), handler.MerchantUploadWorkingDoc)
			merchant.GET("/bookings/:id/working-docs", handler.MerchantListWorkingDocs)
			merchant.POST("/bookings/:id/design-fee-quote", transactionGate, handler.MerchantRequireCompletedOnboarding(), handler.MerchantCreateDesignFeeQuote)
			merchant.GET("/bookings/:id/design-fee-quote", handler.MerchantGetDesignFeeQuote)
			merchant.POST("/bookings/:id/deliverable", transactionGate, handler.MerchantRequireCompletedOnboarding(), handler.MerchantSubmitDeliverable)
			merchant.POST("/bookings/:id/construction-prep/start", transactionGate, handler.MerchantRequireCompletedOnboarding(), handler.MerchantStartConstructionPreparation)

			// 方案管理
			merchant.POST("/proposals", transactionGate, handler.MerchantRequireCompletedOnboarding(), handler.MerchantSubmitProposal)
			merchant.GET("/proposals", handler.MerchantListProposals)
			merchant.GET("/proposals/:id", handler.MerchantGetProposal)
			merchant.PUT("/proposals/:id", transactionGate, handler.MerchantRequireCompletedOnboarding(), handler.MerchantUpdateProposal)
			merchant.DELETE("/proposals/:id", transactionGate, handler.MerchantRequireCompletedOnboarding(), handler.MerchantCancelProposal)
			merchant.POST("/proposals/:id/reopen", transactionGate, handler.MerchantRequireCompletedOnboarding(), handler.MerchantReopenProposal)
			merchant.POST("/proposals/resubmit", transactionGate, handler.MerchantRequireCompletedOnboarding(), handler.ResubmitProposal) // 重新提交方案（生成新版本）
			merchant.GET("/proposals/:id/rejection-info", handler.GetRejectionInfo)                                                       // 获取拒绝信息

			// 线索管理
			merchant.GET("/leads", handler.MerchantListLeads)
			merchant.POST("/leads/:id/accept", handler.MerchantRequireCompletedOnboarding(), handler.MerchantAcceptLead)
			merchant.POST("/leads/:id/decline", handler.MerchantRequireCompletedOnboarding(), handler.MerchantDeclineLead)

			// 投诉响应
			merchant.GET("/complaints", handler.MerchantListComplaints)
			merchant.POST("/complaints/:id/respond", handler.MerchantRespondComplaint)

			// 订单管理
			merchant.GET("/orders", handler.MerchantListOrders)
			merchant.GET("/projects", handler.MerchantListProjects)
			merchant.GET("/projects/:projectId", handler.MerchantGetProjectDetail)
			merchant.GET("/projects/:projectId/change-orders", handler.MerchantListProjectChangeOrders)
			merchant.POST("/projects/:projectId/change-orders", transactionGate, handler.MerchantRequireCompletedOnboarding(), handler.MerchantCreateProjectChangeOrder)
			merchant.GET("/projects/:projectId/dispute", handler.MerchantGetProjectDispute)
			merchant.POST("/projects/:projectId/dispute/respond", transactionGate, handler.MerchantRequireCompletedOnboarding(), handler.MerchantRespondProjectDispute)
			merchant.POST("/projects/:projectId/logs", transactionGate, handler.MerchantRequireCompletedOnboarding(), handler.MerchantCreateProjectLog)
			merchant.POST("/projects/:projectId/start", transactionGate, handler.MerchantRequireCompletedOnboarding(), handler.MerchantStartProject)
			merchant.POST("/projects/:projectId/milestones/:milestoneId/submit", transactionGate, handler.MerchantRequireCompletedOnboarding(), handler.MerchantSubmitProjectMilestone)
			merchant.POST("/projects/:projectId/complete", transactionGate, handler.MerchantRequireCompletedOnboarding(), handler.MerchantCompleteProject)

			// 仪表盘
			merchant.GET("/dashboard", handler.MerchantDashboardStats)

			// 收入中心
			merchant.GET("/income/summary", handler.MerchantIncomeSummary)
			merchant.GET("/income/list", handler.MerchantIncomeList)

			// 提现管理
			merchant.GET("/withdraw/list", handler.MerchantWithdrawList)
			merchant.POST("/withdraw", handler.MerchantRequireCompletedOnboarding(), handler.MerchantWithdrawCreate)

			// 银行账户
			merchant.GET("/bank-accounts", handler.MerchantBankAccountList)
			merchant.POST("/bank-accounts", handler.MerchantRequireCompletedOnboarding(), handler.MerchantBankAccountCreate)
			merchant.DELETE("/bank-accounts/:id", handler.MerchantRequireCompletedOnboarding(), handler.MerchantBankAccountDelete)
			merchant.PUT("/bank-accounts/:id/default", handler.MerchantRequireCompletedOnboarding(), handler.MerchantBankAccountSetDefault)

			// 作品集管理
			merchant.GET("/cases", handler.MerchantCaseList)
			merchant.GET("/cases/:id", handler.MerchantCaseGet)
			merchant.POST("/cases", handler.MerchantRequireCompletedOnboarding(), handler.MerchantCaseCreate)
			merchant.POST("/projects/:projectId/cases", transactionGate, handler.MerchantRequireCompletedOnboarding(), handler.MerchantCaseCreateFromProject)
			merchant.POST("/change-orders/:id/cancel", transactionGate, handler.MerchantRequireCompletedOnboarding(), handler.MerchantCancelChangeOrder)
			merchant.PUT("/cases/:id", handler.MerchantRequireCompletedOnboarding(), handler.MerchantCaseUpdate)
			merchant.DELETE("/cases/:id", handler.MerchantRequireCompletedOnboarding(), handler.MerchantCaseDelete)
			merchant.PUT("/cases/reorder", handler.MerchantRequireCompletedOnboarding(), handler.MerchantCaseReorder)
			merchant.DELETE("/cases/audit/:auditId", handler.MerchantRequireCompletedOnboarding(), handler.MerchantCaseCancelAudit) // 取消审核

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
		materialShop.Use(middleware.RequireMerchantPortalEnabled())
		{
			materialShop.GET("/me", handler.MaterialShopGetMe)
			materialShop.GET("/onboarding/completion", handler.MaterialShopGetOnboardingCompletion)
			materialShop.POST("/onboarding/completion", handler.MaterialShopSubmitOnboardingCompletion)
			materialShop.PUT("/me", handler.MaterialShopRequireCompletedOnboarding(), handler.MaterialShopUpdateMe)
			materialShop.GET("/service-settings", handler.MerchantGetServiceSettings)
			materialShop.PUT("/service-settings", handler.MaterialShopRequireCompletedOnboarding(), handler.MerchantUpdateServiceSettings)
			materialShop.GET("/me/products", handler.MaterialShopListProducts)
			materialShop.POST("/me/products", handler.MaterialShopRequireCompletedOnboarding(), handler.MaterialShopCreateProduct)
			materialShop.PUT("/me/products/:id", handler.MaterialShopRequireCompletedOnboarding(), handler.MaterialShopUpdateProduct)
			materialShop.DELETE("/me/products/:id", handler.MaterialShopRequireCompletedOnboarding(), handler.MaterialShopDeleteProduct)
		}
	}

	// ==================== Supervisor 监理端 ====================
	// 监理登录 (无需认证)
	v1.POST("/supervisor/login", middleware.RequireSupervisorPortalEnabled(), middleware.LoginRateLimit(), handler.SupervisorLogin(cfg))
	v1.POST("/supervisor/send-code", middleware.RequireSupervisorPortalEnabled(), middleware.LoginRateLimit(), handler.SendCode)
	v1.POST("/supervisor/token/refresh", middleware.RequireSupervisorPortalEnabled(), handler.SupervisorRefreshToken)

	// ========== 监理入驻申请（公网，无需登录） ==========
	v1.POST("/supervisor/onboarding/send-code", middleware.RequireSupervisorPortalEnabled(), middleware.LoginRateLimit(), handler.SendSupervisorOnboardingCode)
	v1.GET("/supervisor/onboarding/status", middleware.RequireSupervisorPortalEnabled(), handler.GetSupervisorOnboardingStatus)
	v1.GET("/supervisor/onboarding/check-eligibility", middleware.RequireSupervisorPortalEnabled(), handler.CheckSupervisorOnboardingEligibility)
	v1.POST("/supervisor/onboarding/upload", middleware.RequireSupervisorPortalEnabled(), middleware.LoginRateLimit(), handler.SupervisorOnboardingUploadImage)
	v1.POST("/supervisor/onboarding/submit", middleware.RequireSupervisorPortalEnabled(), middleware.LoginRateLimit(), handler.SubmitSupervisorOnboardingApplication)

	// 监理端路由（使用 SupervisorJWT 中间件验证 token 类型）
	supervisor := v1.Group("/supervisor")
	supervisor.Use(middleware.SupervisorJWT(cfg.JWT.Secret))
	supervisor.Use(middleware.RequireSupervisorPortalEnabled())
	{
		// 会话治理
		supervisor.POST("/logout", handler.SupervisorLogout)
		supervisor.POST("/logout-all", handler.SupervisorLogoutAll)
		supervisor.GET("/sessions", handler.SupervisorListSessions)
		supervisor.POST("/sessions/:sid/revoke", handler.SupervisorRevokeSession)

		// 监理资料
		supervisor.GET("/info", handler.SupervisorGetInfo)
		supervisor.GET("/dashboard", handler.SupervisorDashboard)
		supervisor.POST("/upload", handler.SupervisorUploadImage)

		// 分配的项目
		supervisor.GET("/projects", handler.SupervisorListProjects)
		supervisor.GET("/projects/:id", handler.SupervisorGetProject)
		supervisor.GET("/projects/:id/phases", handler.SupervisorGetProjectPhases)

		// 施工日志
		supervisor.GET("/projects/:id/logs", handler.SupervisorListLogs)
		supervisor.POST("/projects/:id/phases/:phaseId/logs", handler.SupervisorCreateLog)
		supervisor.POST("/projects/:id/logs/sync", handler.SupervisorSyncOfflineLogs)

		// 阶段操作
		supervisor.PUT("/projects/:id/phases/:phaseId", handler.SupervisorUpdatePhase)
		supervisor.PUT("/projects/:id/phases/:phaseId/tasks/:taskId", handler.SupervisorUpdatePhaseTask)

		// 风险预警
		supervisor.POST("/projects/:id/risk-warnings", handler.SupervisorCreateRiskWarning)
	}

	return r
}
