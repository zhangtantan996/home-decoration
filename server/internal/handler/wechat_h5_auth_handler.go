package handler

import (
	"errors"
	"net/url"
	"path"
	"strings"

	"home-decoration-server/internal/service"
	imgutil "home-decoration-server/internal/utils/image"
	"home-decoration-server/pkg/response"

	"github.com/gin-gonic/gin"
)

func resolveH5Origin(c *gin.Context) (string, error) {
	if origin := strings.TrimSpace(c.GetHeader("Origin")); origin != "" {
		return strings.TrimRight(origin, "/"), nil
	}

	if referer := strings.TrimSpace(c.GetHeader("Referer")); referer != "" {
		u, err := url.Parse(referer)
		if err == nil && u.Scheme != "" && u.Host != "" {
			return strings.TrimRight(u.Scheme+"://"+u.Host, "/"), nil
		}
	}

	return "", errors.New("无法确定回调域名")
}

func normalizeWechatH5BasePath(raw string) string {
	value := strings.TrimSpace(raw)
	if value == "" {
		return "/app"
	}
	if !strings.HasPrefix(value, "/") {
		value = "/" + value
	}
	cleaned := path.Clean(value)
	if cleaned == "." || cleaned == "/" {
		return ""
	}
	return strings.TrimRight(cleaned, "/")
}

func buildWechatH5RedirectURI(origin, basePath string) string {
	return strings.TrimRight(origin, "/") + normalizeWechatH5BasePath(basePath) + "/#/pages/auth/wechat-callback/index"
}

// WechatH5Authorize 获取微信网页授权链接
func WechatH5Authorize(c *gin.Context) {
	if wechatH5AuthService == nil {
		response.ServerError(c, "微信H5登录未初始化")
		return
	}

	origin, err := resolveH5Origin(c)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	redirectURI := buildWechatH5RedirectURI(origin, wechatH5BasePath)
	res, err := wechatH5AuthService.AuthorizeURL(redirectURI)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Success(c, gin.H{
		"url":   res.URL,
		"state": res.State,
	})
}

// WechatH5Login 微信网页授权 code 登录
func WechatH5Login(c *gin.Context) {
	if wechatH5AuthService == nil {
		response.ServerError(c, "微信H5登录未初始化")
		return
	}

	var req struct {
		Code  string `json:"code" binding:"required"`
		State string `json:"state" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请提供code和state")
		return
	}

	origin, err := resolveH5Origin(c)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	redirectURI := buildWechatH5RedirectURI(origin, wechatH5BasePath)

	result, err := wechatH5AuthService.Login(req.Code, req.State, redirectURI, c.ClientIP(), jwtConfig)
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

// WechatH5BindPhone 微信网页授权绑定手机号
func WechatH5BindPhone(c *gin.Context) {
	if wechatH5AuthService == nil {
		response.ServerError(c, "微信H5登录未初始化")
		return
	}

	var req struct {
		BindToken string `json:"bindToken" binding:"required"`
		Phone     string `json:"phone" binding:"required"`
		Code      string `json:"code" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请提供绑定凭证、手机号和验证码")
		return
	}

	tokenResp, user, err := wechatH5AuthService.BindPhone(req.BindToken, req.Phone, req.Code, c.ClientIP(), jwtConfig)
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
