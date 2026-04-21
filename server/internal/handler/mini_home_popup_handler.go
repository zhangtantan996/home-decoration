package handler

import (
	"home-decoration-server/internal/service"
	"home-decoration-server/pkg/response"

	"github.com/gin-gonic/gin"
)

func GetMiniHomePopup(c *gin.Context) {
	popup, err := (&service.ConfigService{}).GetActiveMiniHomePopup()
	if err != nil {
		response.ServerError(c, "获取首页弹窗配置失败")
		return
	}

	response.Success(c, gin.H{
		"popup": popup,
	})
}
