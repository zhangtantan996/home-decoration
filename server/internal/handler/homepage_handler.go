package handler

import (
	"home-decoration-server/internal/service"
	"home-decoration-server/pkg/response"

	"github.com/gin-gonic/gin"
)

var homepageService = &service.HomepageService{}

// GetHomepageData 公开首页聚合数据
func GetHomepageData(c *gin.Context) {
	data, err := homepageService.GetHomepageData()
	if err != nil {
		response.ServerError(c, "首页数据加载失败")
		return
	}
	response.Success(c, data)
}
