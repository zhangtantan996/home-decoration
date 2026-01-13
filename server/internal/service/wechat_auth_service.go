package service

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"sync"
	"time"

	"home-decoration-server/internal/config"
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	"home-decoration-server/internal/utils/image"
	"home-decoration-server/internal/utils/tencentim"

	"github.com/golang-jwt/jwt/v5"
	"gorm.io/gorm"
)

// WechatAuthService 微信小程序登录/绑定
type WechatAuthService struct {
	client *wechatMiniClient
}

// WechatLoginResult 登录返回
type WechatLoginResult struct {
	Token              *TokenResponse
	User               *model.User
	NeedBindPhone      bool
	BindToken          string
	BindTokenExpiresIn int64
}

// NewWechatAuthService 创建实例
func NewWechatAuthService(cfg config.WechatMiniConfig) *WechatAuthService {
	return &WechatAuthService{
		client: newWechatMiniClient(cfg),
	}
}

// Login 使用 wx.login code 登录
func (s *WechatAuthService) Login(code string, jwtCfg *config.JWTConfig) (*WechatLoginResult, error) {
	if s.client == nil || s.client.unconfigured() {
		return nil, errors.New("微信小程序未配置")
	}

	session, err := s.client.code2Session(code)
	if err != nil {
		return nil, err
	}

	now := time.Now()
	binding, err := s.findBindingByOpenID(session.OpenID)
	if err != nil {
		return nil, err
	}

	if binding != nil {
		var user model.User
		if err := repository.DB.First(&user, binding.UserID).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return nil, errors.New("绑定的用户不存在，请重新绑定手机号")
			}
			return nil, err
		}

		if user.Status != 1 {
			return nil, errors.New("账号已被禁用")
		}

		tokenResp, err := issueTokenResponse(&user, jwtCfg)
		if err != nil {
			return nil, err
		}

		_ = repository.DB.Model(&model.UserWechatBinding{}).
			Where("id = ?", binding.ID).
			Updates(map[string]interface{}{
				"union_id":      session.UnionID,
				"last_login_at": now,
			}).Error

		return &WechatLoginResult{
			Token: tokenResp,
			User:  &user,
		}, nil
	}

	bindToken, expiresIn, err := s.client.generateBindToken(session.OpenID, session.UnionID)
	if err != nil {
		return nil, err
	}

	return &WechatLoginResult{
		NeedBindPhone:      true,
		BindToken:          bindToken,
		BindTokenExpiresIn: expiresIn,
	}, nil
}

// BindPhone 绑定手机号并登录
func (s *WechatAuthService) BindPhone(bindToken, phoneCode string, jwtCfg *config.JWTConfig) (*TokenResponse, *model.User, error) {
	if s.client == nil || s.client.unconfigured() {
		return nil, nil, errors.New("微信小程序未配置")
	}

	claims, err := s.client.parseBindToken(bindToken)
	if err != nil {
		return nil, nil, err
	}

	phone, err := s.client.getPhoneNumber(phoneCode)
	if err != nil {
		return nil, nil, err
	}

	user, err := s.findOrCreateUserByPhone(phone)
	if err != nil {
		return nil, nil, err
	}

	if user.Status != 1 {
		return nil, nil, errors.New("账号已被禁用")
	}

	existingBinding, err := s.findBindingByOpenID(claims.OpenID)
	if err != nil {
		return nil, nil, err
	}
	if existingBinding != nil && existingBinding.UserID != user.ID {
		return nil, nil, errors.New("该微信号已绑定其他账号")
	}

	userBinding, err := s.findBindingByUser(user.ID)
	if err != nil {
		return nil, nil, err
	}
	if userBinding != nil && userBinding.OpenID != claims.OpenID {
		return nil, nil, errors.New("当前账号已绑定其他微信号")
	}

	now := time.Now()
	if userBinding == nil && existingBinding == nil {
		newBinding := model.UserWechatBinding{
			UserID:      user.ID,
			AppID:       s.client.appID,
			OpenID:      claims.OpenID,
			UnionID:     claims.UnionID,
			BoundAt:     &now,
			LastLoginAt: &now,
		}
		if err := repository.DB.Create(&newBinding).Error; err != nil {
			return nil, nil, err
		}
	} else {
		targetID := uint64(0)
		if existingBinding != nil {
			targetID = existingBinding.ID
		} else if userBinding != nil {
			targetID = userBinding.ID
		}
		updates := map[string]interface{}{
			"user_id":       user.ID,
			"open_id":       claims.OpenID,
			"union_id":      claims.UnionID,
			"bound_at":      now,
			"last_login_at": now,
			"app_id":        s.client.appID,
		}
		if err := repository.DB.Model(&model.UserWechatBinding{}).Where("id = ?", targetID).Updates(updates).Error; err != nil {
			return nil, nil, err
		}
	}

	tokenResp, err := issueTokenResponse(user, jwtCfg)
	if err != nil {
		return nil, nil, err
	}

	return tokenResp, user, nil
}

func (s *WechatAuthService) findBindingByOpenID(openID string) (*model.UserWechatBinding, error) {
	var binding model.UserWechatBinding
	err := repository.DB.Where("app_id = ? AND open_id = ?", s.client.appID, openID).First(&binding).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &binding, nil
}

func (s *WechatAuthService) findBindingByUser(userID uint64) (*model.UserWechatBinding, error) {
	var binding model.UserWechatBinding
	err := repository.DB.Where("app_id = ? AND user_id = ?", s.client.appID, userID).First(&binding).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &binding, nil
}

func (s *WechatAuthService) findOrCreateUserByPhone(phone string) (*model.User, error) {
	var user model.User
	err := repository.DB.Where("phone = ?", phone).First(&user).Error
	if err == nil {
		return &user, nil
	}

	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	nickname := "微信用户"
	if len(phone) >= 4 {
		nickname = fmt.Sprintf("微信用户%s", phone[len(phone)-4:])
	}

	user = model.User{
		Phone:    phone,
		Nickname: nickname,
		UserType: 1,
		Status:   1,
	}

	if err := repository.DB.Create(&user).Error; err != nil {
		return nil, err
	}

	go func(u model.User) {
		fullAvatar := image.GetFullImageURL(u.Avatar)
		if err := tencentim.SyncUserToIM(u.ID, u.Nickname, fullAvatar); err != nil {
			// 不记录敏感数据，静默失败
		}
	}(user)

	return &user, nil
}

func issueTokenResponse(user *model.User, cfg *config.JWTConfig) (*TokenResponse, error) {
	token, err := generateToken(user.ID, user.UserType, cfg.ExpireHour)
	if err != nil {
		return nil, err
	}

	refreshToken, err := generateToken(user.ID, user.UserType, cfg.ExpireHour*24)
	if err != nil {
		return nil, err
	}

	return &TokenResponse{
		Token:        token,
		RefreshToken: refreshToken,
		ExpiresIn:    int64(cfg.ExpireHour * 3600),
	}, nil
}

// ====== 微信客户端封装 ======
type wechatMiniClient struct {
	appID        string
	appSecret    string
	httpClient   *http.Client
	bindTokenTTL time.Duration
	tokenCache   wechatAccessTokenCache
	mu           sync.Mutex
}

type wechatAccessTokenCache struct {
	token     string
	expiresAt time.Time
}

type wechatSessionResponse struct {
	OpenID     string `json:"openid"`
	UnionID    string `json:"unionid"`
	SessionKey string `json:"session_key"`
	ErrCode    int    `json:"errcode"`
	ErrMsg     string `json:"errmsg"`
}

type wechatPhoneResponse struct {
	ErrCode   int    `json:"errcode"`
	ErrMsg    string `json:"errmsg"`
	PhoneInfo struct {
		PhoneNumber     string `json:"phoneNumber"`
		PurePhoneNumber string `json:"purePhoneNumber"`
	} `json:"phone_info"`
}

type wechatAccessTokenResponse struct {
	AccessToken string `json:"access_token"`
	ExpiresIn   int    `json:"expires_in"`
	ErrCode     int    `json:"errcode"`
	ErrMsg      string `json:"errmsg"`
}

type wechatBindClaims struct {
	OpenID  string `json:"openId"`
	UnionID string `json:"unionId,omitempty"`
	AppID   string `json:"appId"`
	jwt.RegisteredClaims
}

func newWechatMiniClient(cfg config.WechatMiniConfig) *wechatMiniClient {
	ttl := time.Duration(cfg.BindTokenExpireMinutes) * time.Minute
	if ttl <= 0 {
		ttl = 5 * time.Minute
	}

	return &wechatMiniClient{
		appID:        cfg.AppID,
		appSecret:    cfg.AppSecret,
		httpClient:   &http.Client{Timeout: 5 * time.Second},
		bindTokenTTL: ttl,
	}
}

func (c *wechatMiniClient) unconfigured() bool {
	return c.appID == "" || c.appSecret == ""
}

func (c *wechatMiniClient) code2Session(code string) (*wechatSessionResponse, error) {
	endpoint := fmt.Sprintf("https://api.weixin.qq.com/sns/jscode2session?appid=%s&secret=%s&js_code=%s&grant_type=authorization_code",
		url.QueryEscape(c.appID), url.QueryEscape(c.appSecret), url.QueryEscape(code))

	resp, err := c.httpClient.Get(endpoint)
	if err != nil {
		return nil, errors.New("微信登录失败，请稍后重试")
	}
	defer resp.Body.Close()

	var session wechatSessionResponse
	if err := json.NewDecoder(resp.Body).Decode(&session); err != nil {
		return nil, errors.New("微信登录响应解析失败")
	}

	if session.ErrCode != 0 {
		return nil, errors.New("微信登录失败，请重新发起")
	}

	if session.OpenID == "" {
		return nil, errors.New("微信登录返回数据异常")
	}

	return &session, nil
}

func (c *wechatMiniClient) getPhoneNumber(phoneCode string) (string, error) {
	accessToken, err := c.getAccessToken()
	if err != nil {
		return "", err
	}

	endpoint := fmt.Sprintf("https://api.weixin.qq.com/wxa/business/getuserphonenumber?access_token=%s", url.QueryEscape(accessToken))
	payload, _ := json.Marshal(map[string]string{
		"code": phoneCode,
	})

	req, err := http.NewRequest(http.MethodPost, endpoint, bytes.NewReader(payload))
	if err != nil {
		return "", errors.New("获取手机号请求失败")
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", errors.New("获取手机号失败，请重试")
	}
	defer resp.Body.Close()

	var result wechatPhoneResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", errors.New("手机号响应解析失败")
	}

	if result.ErrCode != 0 {
		return "", errors.New("获取手机号失败，请重新授权")
	}

	if result.PhoneInfo.PhoneNumber == "" {
		return "", errors.New("微信未返回手机号")
	}

	return result.PhoneInfo.PhoneNumber, nil
}

func (c *wechatMiniClient) getAccessToken() (string, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.tokenCache.token != "" && time.Now().Before(c.tokenCache.expiresAt.Add(-time.Minute)) {
		return c.tokenCache.token, nil
	}

	endpoint := fmt.Sprintf("https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=%s&secret=%s",
		url.QueryEscape(c.appID), url.QueryEscape(c.appSecret))
	resp, err := c.httpClient.Get(endpoint)
	if err != nil {
		return "", errors.New("获取微信凭证失败，请稍后再试")
	}
	defer resp.Body.Close()

	var tokenResp wechatAccessTokenResponse
	if err := json.NewDecoder(resp.Body).Decode(&tokenResp); err != nil {
		return "", errors.New("微信凭证解析失败")
	}

	if tokenResp.ErrCode != 0 || tokenResp.AccessToken == "" {
		return "", errors.New("获取微信凭证失败")
	}

	expires := time.Duration(tokenResp.ExpiresIn) * time.Second
	if expires <= 0 {
		expires = time.Hour
	}

	c.tokenCache = wechatAccessTokenCache{
		token:     tokenResp.AccessToken,
		expiresAt: time.Now().Add(expires),
	}

	return tokenResp.AccessToken, nil
}

func (c *wechatMiniClient) generateBindToken(openID, unionID string) (string, int64, error) {
	if openID == "" {
		return "", 0, errors.New("微信返回数据缺失")
	}

	now := time.Now()
	claims := wechatBindClaims{
		OpenID:  openID,
		UnionID: unionID,
		AppID:   c.appID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(now.Add(c.bindTokenTTL)),
			IssuedAt:  jwt.NewNumericDate(now),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString(jwtSecret)
	if err != nil {
		return "", 0, errors.New("生成绑定令牌失败")
	}

	return signed, int64(c.bindTokenTTL.Seconds()), nil
}

func (c *wechatMiniClient) parseBindToken(tokenStr string) (*wechatBindClaims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &wechatBindClaims{}, func(token *jwt.Token) (interface{}, error) {
		return jwtSecret, nil
	})
	if err != nil {
		return nil, errors.New("绑定凭证无效或已过期，请重新登录")
	}

	claims, ok := token.Claims.(*wechatBindClaims)
	if !ok || !token.Valid {
		return nil, errors.New("绑定凭证解析失败")
	}

	if claims.AppID != c.appID {
		return nil, errors.New("绑定凭证与当前小程序不匹配")
	}

	if claims.OpenID == "" {
		return nil, errors.New("绑定凭证缺少必要信息")
	}

	return claims, nil
}
