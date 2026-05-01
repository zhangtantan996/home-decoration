package handler

import (
	"home-decoration-server/internal/service"
	"home-decoration-server/pkg/response"

	"github.com/gin-gonic/gin"
)

func GetPublicSiteConfig(c *gin.Context) {
	configSvc := &service.ConfigService{}
	response.Success(c, gin.H{
		"siteConfig": configSvc.GetPublicSiteConfig(),
	})
}
