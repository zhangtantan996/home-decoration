package router

import (
	"home-decoration-server/internal/config"
	"home-decoration-server/internal/handler"
	"home-decoration-server/internal/middleware"

	"github.com/gin-gonic/gin"
)

func Setup(cfg *config.Config) *gin.Engine {
	r := gin.Default()

	// 全局中间件
	r.Use(middleware.Cors())
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

		// 需要认证的路由
		authorized := v1.Group("")
		authorized.Use(middleware.JWT(cfg.JWT.Secret))
		{
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
			}

			// 装修公司
			companies := authorized.Group("/companies")
			{
				companies.GET("", handler.ListCompanies)
				companies.GET("/:id", handler.GetCompany)
			}

			// 工长
			foremen := authorized.Group("/foremen")
			{
				foremen.GET("", handler.ListForemen)
				foremen.GET("/:id", handler.GetForeman)
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

				// 托管账户 (嵌套路由)
				projects.GET("/:id/escrow", handler.GetEscrowAccount)
				projects.POST("/:id/deposit", handler.Deposit)
				projects.POST("/:id/release", handler.ReleaseFunds)
			}
		}
	}

	return r
}
