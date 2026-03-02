package service

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"home-decoration-server/internal/config"
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	"home-decoration-server/internal/utils/image"
	"home-decoration-server/internal/utils/tencentim"

	"github.com/golang-jwt/jwt/v5"
	"gorm.io/gorm"
)

// WechatH5AuthService 微信网页授权（公众号）登录/绑定
type WechatH5AuthService struct {
	client *wechatH5Client
}

type WechatH5AuthorizeResult struct {
	URL   string
	State string
}

type WechatH5LoginResult struct {
	Token              *TokenResponse
	User               *model.User
	NeedBindPhone      bool
	BindToken          string
	BindTokenExpiresIn int64
}

func NewWechatH5AuthService(cfg config.WechatH5Config) *WechatH5AuthService {
	return &WechatH5AuthService{
		client: newWechatH5Client(cfg),
	}
}

func (s *WechatH5AuthService) AuthorizeURL(redirectURI string) (*WechatH5AuthorizeResult, error) {
	if s.client == nil || s.client.unconfiguredForAuthorize() {
		return nil, errors.New("微信H5未配置")
	}

	redirectURI = strings.TrimSpace(redirectURI)
	if redirectURI == "" {
		return nil, errors.New("缺少回调地址")
	}

	state, err := s.client.generateState(redirectURI)
	if err != nil {
		return nil, err
	}

	u, err := s.client.buildAuthorizeURL(redirectURI, state)
	if err != nil {
		return nil, err
	}

	return &WechatH5AuthorizeResult{
		URL:   u,
		State: state,
	}, nil
}

func (s *WechatH5AuthService) Login(code, state, redirectURI string, jwtCfg *config.JWTConfig) (*WechatH5LoginResult, error) {
	if s.client == nil || s.client.unconfiguredForLogin() {
		return nil, errors.New("微信H5未配置")
	}

	code = strings.TrimSpace(code)
	state = strings.TrimSpace(state)
	redirectURI = strings.TrimSpace(redirectURI)
	if code == "" {
		return nil, errors.New("请提供code")
	}
	if state == "" {
		return nil, errors.New("请提供state")
	}
	if redirectURI == "" {
		return nil, errors.New("缺少回调地址")
	}

	if err := s.client.verifyState(state, redirectURI); err != nil {
		return nil, err
	}

	session, err := s.client.exchangeCode(code)
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

		return &WechatH5LoginResult{
			Token: tokenResp,
			User:  &user,
		}, nil
	}

	bindToken, expiresIn, err := s.client.generateBindToken(session.OpenID, session.UnionID)
	if err != nil {
		return nil, err
	}

	return &WechatH5LoginResult{
		NeedBindPhone:      true,
		BindToken:          bindToken,
		BindTokenExpiresIn: expiresIn,
	}, nil
}

func (s *WechatH5AuthService) BindPhone(bindToken, phone, smsCode string, jwtCfg *config.JWTConfig) (*TokenResponse, *model.User, error) {
	if s.client == nil || s.client.unconfiguredForLogin() {
		return nil, nil, errors.New("微信H5未配置")
	}

	bindToken = strings.TrimSpace(bindToken)
	phone = strings.TrimSpace(phone)
	smsCode = strings.TrimSpace(smsCode)

	if bindToken == "" {
		return nil, nil, errors.New("缺少绑定凭证")
	}
	if err := validatePhone(phone); err != nil {
		return nil, nil, err
	}
	if smsCode == "" {
		return nil, nil, errors.New("请输入验证码")
	}

	claims, err := s.client.parseBindToken(bindToken)
	if err != nil {
		return nil, nil, err
	}

	if err := VerifySMSCode(phone, smsCode); err != nil {
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

func (s *WechatH5AuthService) findBindingByOpenID(openID string) (*model.UserWechatBinding, error) {
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

func (s *WechatH5AuthService) findBindingByUser(userID uint64) (*model.UserWechatBinding, error) {
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

func (s *WechatH5AuthService) findOrCreateUserByPhone(phone string) (*model.User, error) {
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

type wechatH5Client struct {
	appID      string
	appSecret  string
	oauthScope string

	bindTokenTTL time.Duration

	stateSecret []byte
	stateTTL    time.Duration

	httpClient  *http.Client
	apiBaseURL  string
	openBaseURL string
}

type wechatH5Session struct {
	OpenID  string
	UnionID string
}

type wechatH5AccessTokenResponse struct {
	AccessToken  string `json:"access_token"`
	ExpiresIn    int    `json:"expires_in"`
	RefreshToken string `json:"refresh_token"`
	OpenID       string `json:"openid"`
	Scope        string `json:"scope"`
	UnionID      string `json:"unionid"`
	ErrCode      int    `json:"errcode"`
	ErrMsg       string `json:"errmsg"`
}

type wechatH5BindClaims struct {
	OpenID  string `json:"openId"`
	UnionID string `json:"unionId"`
	AppID   string `json:"appId"`
	jwt.RegisteredClaims
}

type wechatH5StatePayload struct {
	IssuedAt     int64  `json:"iat"`
	Nonce        string `json:"nonce"`
	RedirectHash string `json:"r"`
}

func newWechatH5Client(cfg config.WechatH5Config) *wechatH5Client {
	ttlMinutes := cfg.BindTokenExpireMinutes
	if ttlMinutes <= 0 {
		ttlMinutes = 5
	}

	scope := strings.TrimSpace(cfg.OAuthScope)
	if scope == "" {
		scope = "snsapi_base"
	}

	return &wechatH5Client{
		appID:        strings.TrimSpace(cfg.AppID),
		appSecret:    strings.TrimSpace(cfg.AppSecret),
		oauthScope:   scope,
		bindTokenTTL: time.Duration(ttlMinutes) * time.Minute,
		stateSecret:  []byte(strings.TrimSpace(cfg.StateSigningSecret)),
		stateTTL:     10 * time.Minute,
		httpClient:   &http.Client{Timeout: 10 * time.Second},
		apiBaseURL:   "https://api.weixin.qq.com",
		openBaseURL:  "https://open.weixin.qq.com",
	}
}

func (c *wechatH5Client) unconfiguredForAuthorize() bool {
	return c == nil || c.appID == "" || len(c.stateSecret) == 0
}

func (c *wechatH5Client) unconfiguredForLogin() bool {
	return c == nil || c.appID == "" || c.appSecret == "" || len(c.stateSecret) == 0
}

func (c *wechatH5Client) buildAuthorizeURL(redirectURI, state string) (string, error) {
	if c.unconfiguredForAuthorize() {
		return "", errors.New("微信H5未配置")
	}

	u, err := url.Parse(c.openBaseURL + "/connect/oauth2/authorize")
	if err != nil {
		return "", errors.New("生成授权链接失败")
	}

	q := u.Query()
	q.Set("appid", c.appID)
	q.Set("redirect_uri", redirectURI)
	q.Set("response_type", "code")
	q.Set("scope", c.oauthScope)
	q.Set("state", state)
	u.RawQuery = q.Encode()

	return u.String() + "#wechat_redirect", nil
}

func (c *wechatH5Client) exchangeCode(code string) (*wechatH5Session, error) {
	code = strings.TrimSpace(code)
	if code == "" {
		return nil, errors.New("请提供code")
	}
	if c.unconfiguredForLogin() {
		return nil, errors.New("微信H5未配置")
	}

	u, err := url.Parse(c.apiBaseURL + "/sns/oauth2/access_token")
	if err != nil {
		return nil, errors.New("微信授权失败")
	}

	q := u.Query()
	q.Set("appid", c.appID)
	q.Set("secret", c.appSecret)
	q.Set("code", code)
	q.Set("grant_type", "authorization_code")
	u.RawQuery = q.Encode()

	resp, err := c.httpClient.Get(u.String())
	if err != nil {
		return nil, errors.New("微信授权失败，请稍后重试")
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, errors.New("微信授权失败，请稍后重试")
	}

	var data wechatH5AccessTokenResponse
	if err := json.Unmarshal(raw, &data); err != nil {
		return nil, errors.New("微信授权失败")
	}

	if data.ErrCode != 0 {
		return nil, errors.New("微信授权失败")
	}

	if strings.TrimSpace(data.OpenID) == "" {
		return nil, errors.New("微信返回数据缺失")
	}

	return &wechatH5Session{
		OpenID:  data.OpenID,
		UnionID: data.UnionID,
	}, nil
}

func (c *wechatH5Client) generateBindToken(openID, unionID string) (string, int64, error) {
	openID = strings.TrimSpace(openID)
	if openID == "" {
		return "", 0, errors.New("微信返回数据缺失")
	}

	now := time.Now()
	claims := wechatH5BindClaims{
		OpenID:  openID,
		UnionID: strings.TrimSpace(unionID),
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

func (c *wechatH5Client) parseBindToken(tokenStr string) (*wechatH5BindClaims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &wechatH5BindClaims{}, func(token *jwt.Token) (interface{}, error) {
		return jwtSecret, nil
	})
	if err != nil {
		return nil, errors.New("绑定凭证无效或已过期，请重新登录")
	}

	claims, ok := token.Claims.(*wechatH5BindClaims)
	if !ok || !token.Valid {
		return nil, errors.New("绑定凭证解析失败")
	}

	if claims.AppID != c.appID {
		return nil, errors.New("绑定凭证与当前应用不匹配")
	}

	if strings.TrimSpace(claims.OpenID) == "" {
		return nil, errors.New("绑定凭证缺少必要信息")
	}

	return claims, nil
}

func (c *wechatH5Client) generateState(redirectURI string) (string, error) {
	if len(c.stateSecret) == 0 {
		return "", errors.New("微信H5未配置")
	}

	nonceBytes := make([]byte, 12)
	if _, err := rand.Read(nonceBytes); err != nil {
		return "", errors.New("生成授权参数失败")
	}

	payload := wechatH5StatePayload{
		IssuedAt:     time.Now().Unix(),
		Nonce:        base64.RawURLEncoding.EncodeToString(nonceBytes),
		RedirectHash: sha256Hex(redirectURI),
	}
	raw, err := json.Marshal(payload)
	if err != nil {
		return "", errors.New("生成授权参数失败")
	}

	payloadB64 := base64.RawURLEncoding.EncodeToString(raw)
	sig := hmacSHA256(c.stateSecret, payloadB64)
	sigB64 := base64.RawURLEncoding.EncodeToString(sig)
	return payloadB64 + "." + sigB64, nil
}

func (c *wechatH5Client) verifyState(state, redirectURI string) error {
	state = strings.TrimSpace(state)
	if state == "" {
		return errors.New("state无效，请重新登录")
	}
	parts := strings.Split(state, ".")
	if len(parts) != 2 {
		return errors.New("state无效，请重新登录")
	}
	payloadB64 := parts[0]
	sigB64 := parts[1]

	sig, err := base64.RawURLEncoding.DecodeString(sigB64)
	if err != nil {
		return errors.New("state无效，请重新登录")
	}

	expected := hmacSHA256(c.stateSecret, payloadB64)
	if subtle.ConstantTimeCompare(sig, expected) != 1 {
		return errors.New("state无效，请重新登录")
	}

	payloadRaw, err := base64.RawURLEncoding.DecodeString(payloadB64)
	if err != nil {
		return errors.New("state无效，请重新登录")
	}

	var payload wechatH5StatePayload
	if err := json.Unmarshal(payloadRaw, &payload); err != nil {
		return errors.New("state无效，请重新登录")
	}

	if payload.RedirectHash != sha256Hex(redirectURI) {
		return errors.New("state无效，请重新登录")
	}

	iat := time.Unix(payload.IssuedAt, 0)
	if payload.IssuedAt == 0 || time.Since(iat) > c.stateTTL {
		return errors.New("state已过期，请重新登录")
	}

	return nil
}

func hmacSHA256(secret []byte, data string) []byte {
	mac := hmac.New(sha256.New, secret)
	_, _ = mac.Write([]byte(data))
	return mac.Sum(nil)
}

func sha256Hex(s string) string {
	sum := sha256.Sum256([]byte(strings.TrimSpace(s)))
	return fmt.Sprintf("%x", sum[:])
}
