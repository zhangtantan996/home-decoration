package handler

import (
	"home-decoration-server/internal/model"
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
			if value, ok := activeRole.(string); ok {
				req.CurrentRole = value
			}
		} else if userType, exists := c.Get("userType"); exists {
			// 兼容旧 token
			switch convertUserType(userType) {
			case 1:
				req.CurrentRole = "owner"
			case 2:
				req.CurrentRole = "provider"
			case 3:
				req.CurrentRole = "provider"
			case 4:
				req.CurrentRole = "admin"
			}
		}
	}

	result, err := identityService.SwitchIdentity(userID, &req)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Success(c, gin.H{
		"token":           result.AccessToken,
		"refreshToken":    result.RefreshToken,
		"activeRole":      result.ActiveRole,
		"providerSubType": result.ProviderSubType,
		"providerId":      result.ProviderID,
		"expiresIn":       2 * 3600, // 2 hours
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
	identityType := "owner"
	if activeRole, exists := c.Get("activeRole"); exists {
		if value, ok := activeRole.(string); ok {
			identityType = value
		}
	} else if userType, exists := c.Get("userType"); exists {
		// 兼容旧 token
		switch convertUserType(userType) {
		case 1:
			identityType = "owner"
		case 2:
			identityType = "provider"
		case 3:
			identityType = "provider"
		case 4:
			identityType = "admin"
		default:
			identityType = "owner"
		}
	}

	var identity *model.UserIdentity
	var err error
	if identityID, ok := contextUint64(c, "identityId"); ok && identityID > 0 {
		identity, err = identityService.GetIdentityByID(userID, identityID)
		if err != nil {
			response.NotFound(c, "身份不存在")
			return
		}
	} else if identityRefID, ok := contextUint64(c, "identityRefId"); ok && identityRefID > 0 {
		identity, err = identityService.GetIdentityByTypeAndRef(userID, identityType, identityRefID)
		if err != nil {
			response.NotFound(c, "身份不存在")
			return
		}
	}
	if identity == nil {
		identity, err = identityService.GetIdentityByType(userID, identityType)
	}
	if err != nil {
		response.NotFound(c, "身份不存在")
		return
	}

	// 构建响应
	normalizedRole, derivedSubType := service.NormalizeRoleForResponse(identity.IdentityType)

	result := gin.H{
		"id":              identity.ID,
		"identityType":    normalizedRole,
		"providerSubType": derivedSubType,
		"status":          identity.Status,
		"verified":        identity.Verified,
		"refId":           identity.IdentityRefID,
	}

	// 添加关联信息（按 identityType 区分）
	if normalizedRole == "provider" && identity.Provider != nil {
		providerSubType := service.NormalizeProviderSubTypeForResponse(identity.Provider.SubType)
		if providerSubType == "" {
			providerSubType = service.NormalizeProviderSubTypeForResponse(mapProviderTypeToSubType(identity.Provider.ProviderType))
		}
		result["providerSubType"] = providerSubType
		result["refId"] = identity.Provider.ID
		result["provider"] = gin.H{
			"id":          identity.Provider.ID,
			"companyName": identity.Provider.CompanyName,
			"subType":     providerSubType,
		}
	}

	if normalizedRole == "supervisor" && identity.SupervisorProfile != nil {
		result["supervisor"] = gin.H{
			"id":       identity.SupervisorProfile.ID,
			"realName": identity.SupervisorProfile.RealName,
			"phone":    identity.SupervisorProfile.Phone,
			"status":   identity.SupervisorProfile.Status,
			"verified": identity.SupervisorProfile.Verified,
		}
	}

	if normalizedRole == "admin" && identity.AdminProfile != nil {
		result["admin"] = gin.H{
			"id":         identity.AdminProfile.ID,
			"sysAdminId": identity.AdminProfile.SysAdminID,
			"adminType":  identity.AdminProfile.AdminType,
			"status":     identity.AdminProfile.Status,
		}
	}

	if normalizedRole == "provider" && result["providerSubType"] == "" {
		result["providerSubType"] = "designer"
	}

	response.Success(c, result)
}

func contextUint64(c *gin.Context, key string) (uint64, bool) {
	raw, exists := c.Get(key)
	if !exists {
		return 0, false
	}
	switch value := raw.(type) {
	case uint64:
		return value, true
	case *uint64:
		if value == nil {
			return 0, false
		}
		return *value, true
	case uint:
		return uint64(value), true
	case int:
		if value < 0 {
			return 0, false
		}
		return uint64(value), true
	case int64:
		if value < 0 {
			return 0, false
		}
		return uint64(value), true
	case float64:
		if value < 0 {
			return 0, false
		}
		return uint64(value), true
	default:
		return 0, false
	}
}

func mapProviderTypeToSubType(providerType int8) string {
	switch providerType {
	case 1:
		return "designer"
	case 2:
		return "company"
	case 3:
		return "foreman"
	default:
		return ""
	}
}

func convertUserType(value interface{}) int8 {
	switch raw := value.(type) {
	case int8:
		return raw
	case int:
		return int8(raw)
	case int64:
		return int8(raw)
	case float64:
		return int8(raw)
	default:
		return 0
	}
}
