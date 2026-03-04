package handler

import (
	"home-decoration-server/internal/service"
	imgutil "home-decoration-server/internal/utils/image"
	"home-decoration-server/pkg/response"

	"github.com/gin-gonic/gin"
)

// WechatMiniLogin 微信小程序code登录
func WechatMiniLogin(c *gin.Context) {
	if wechatAuthService == nil {
		response.ServerError(c, "微信登录未初始化")
		return
	}

	var req struct {
		Code string `json:"code" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请提供code")
		return
	}

	result, err := wechatAuthService.Login(req.Code, c.ClientIP(), jwtConfig)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	if result.NeedBindPhone {
		response.Success(c, gin.H{
			"needBindPhone": true,
			"bindToken":     result.BindToken,
			"expiresIn":     result.BindTokenExpiresIn,
		})
		return
	}

	roleCtx, _ := service.GetRoleContextForResponse(result.User)
	providerID := uint64(0)
	if roleCtx.ProviderID != nil {
		providerID = *roleCtx.ProviderID
	}

	response.Success(c, gin.H{
		"token":           result.Token.Token,
		"refreshToken":    result.Token.RefreshToken,
		"expiresIn":       result.Token.ExpiresIn,
		"activeRole":      roleCtx.ActiveRole,
		"providerSubType": roleCtx.ProviderSubType,
		"providerId":      providerID,
		"user": gin.H{
			"id":       result.User.ID,
			"publicId": result.User.PublicID,
			"phone":    result.User.Phone,
			"nickname": result.User.Nickname,
			"avatar":   imgutil.GetFullImageURL(result.User.Avatar),
			"userType": result.User.UserType,
		},
	})
}

// WechatMiniBindPhone 微信手机号绑定
func WechatMiniBindPhone(c *gin.Context) {
	if wechatAuthService == nil {
		response.ServerError(c, "微信登录未初始化")
		return
	}

	var req struct {
		BindToken string `json:"bindToken" binding:"required"`
		PhoneCode string `json:"phoneCode" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请提供绑定凭证和手机号code")
		return
	}

	tokenResp, user, err := wechatAuthService.BindPhone(req.BindToken, req.PhoneCode, c.ClientIP(), jwtConfig)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	roleCtx, _ := service.GetRoleContextForResponse(user)
	providerID := uint64(0)
	if roleCtx.ProviderID != nil {
		providerID = *roleCtx.ProviderID
	}

	response.Success(c, gin.H{
		"token":           tokenResp.Token,
		"refreshToken":    tokenResp.RefreshToken,
		"expiresIn":       tokenResp.ExpiresIn,
		"activeRole":      roleCtx.ActiveRole,
		"providerSubType": roleCtx.ProviderSubType,
		"providerId":      providerID,
		"user": gin.H{
			"id":       user.ID,
			"publicId": user.PublicID,
			"phone":    user.Phone,
			"nickname": user.Nickname,
			"avatar":   imgutil.GetFullImageURL(user.Avatar),
			"userType": user.UserType,
		},
	})
}
