package handler

import (
	"home-decoration-server/internal/service"
	"home-decoration-server/pkg/response"

	"github.com/gin-gonic/gin"
)

var identityService = &service.IdentityService{}

// GetIdentities 获取用户所有身份
func GetIdentities(c *gin.Context) {
	userID := c.GetUint64("userId")

	identities, err := identityService.ListIdentities(userID)
	if err != nil {
		response.ServerError(c, "查询身份失败")
		return
	}

	response.Success(c, gin.H{
		"identities": identities,
	})
}

// SwitchIdentity 切换身份
func SwitchIdentity(c *gin.Context) {
	userID := c.GetUint64("userId")

	var req service.SwitchIdentityRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误: "+err.Error())
		return
	}

	// 从 context 获取 IP 和 User Agent
	req.IP = c.ClientIP()
	req.UserAgent = c.GetHeader("User-Agent")

	// 如果没有提供 currentRole，尝试从 context 获取
	if req.CurrentRole == "" {
		if activeRole, exists := c.Get("activeRole"); exists {
			req.CurrentRole = activeRole.(string)
		} else if userType, exists := c.Get("userType"); exists {
			// 兼容旧 token
			switch int8(userType.(float64)) {
			case 1:
				req.CurrentRole = "owner"
			case 2:
				req.CurrentRole = "provider"
			case 3:
				req.CurrentRole = "worker"
			case 4:
				req.CurrentRole = "admin"
			}
		}
	}

	newToken, err := identityService.SwitchIdentity(userID, &req)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Success(c, gin.H{
		"token":     newToken,
		"expiresIn": 2 * 3600, // 2 hours
	})
}

// ApplyIdentity 申请新身份
func ApplyIdentity(c *gin.Context) {
	userID := c.GetUint64("userId")

	var req service.ApplyIdentityRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误: "+err.Error())
		return
	}

	if err := identityService.ApplyIdentity(userID, &req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.SuccessWithMessage(c, "申请已提交，请等待审核", nil)
}

// GetCurrentIdentity 获取当前激活的身份信息
func GetCurrentIdentity(c *gin.Context) {
	userID := c.GetUint64("userId")

	// 从 context 获取当前身份类型
	var identityType string
	if activeRole, exists := c.Get("activeRole"); exists {
		identityType = activeRole.(string)
	} else if userType, exists := c.Get("userType"); exists {
		// 兼容旧 token
		switch int8(userType.(float64)) {
		case 1:
			identityType = "owner"
		case 2:
			identityType = "provider"
		case 3:
			identityType = "worker"
		case 4:
			identityType = "admin"
		default:
			identityType = "owner"
		}
	} else {
		identityType = "owner" // 默认
	}

	identity, err := identityService.GetIdentityByType(userID, identityType)
	if err != nil {
		response.NotFound(c, "身份不存在")
		return
	}

	// 构建响应
	result := gin.H{
		"id":           identity.ID,
		"identityType": identity.IdentityType,
		"status":       identity.Status,
		"verified":     identity.Verified,
		"refId":        identity.IdentityRefID,
	}

	// 添加关联信息
	if identity.Provider != nil {
		result["provider"] = gin.H{
			"id":          identity.Provider.ID,
			"companyName": identity.Provider.CompanyName,
			"subType":     identity.Provider.SubType,
		}
	}

	if identity.Worker != nil {
		// Worker 没有 Name 字段，使用 SkillType 构建显示名称
		workerName := "工人"
		if identity.Worker.SkillType != "" {
			workerName = identity.Worker.SkillType + "工人"
		}
		result["worker"] = gin.H{
			"id":   identity.Worker.ID,
			"name": workerName,
		}
	}

	response.Success(c, result)
}
