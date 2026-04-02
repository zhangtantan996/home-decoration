package service

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha1"
	"encoding/base32"
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"

	"home-decoration-server/internal/config"
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	pkgutils "home-decoration-server/pkg/utils"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"golang.org/x/crypto/bcrypt"
)

const (
	AdminLoginStageSetupRequired = "setup_required"
	AdminLoginStageOTPRequired   = "otp_required"
	AdminLoginStageActive        = "active"

	adminTokenType              = "admin"
	adminSessionIndexKeyPrefix  = "admin:sessions:"
	adminSessionMetaKeyPrefix   = "admin:session:meta:"
	adminReauthKeyPrefix        = "admin:reauth:"
	adminRecoveryRequestPrefix  = "admin:2fa:recovery:"
	defaultTOTPPeriodSeconds    = 30
	defaultTOTPWindow           = 1
	defaultTOTPSecretByteLength = 20
)

var errAdminReauthRequired = errors.New("缺少最近再认证凭证")

type AdminClaims struct {
	AdminID    uint64
	Username   string
	IsSuper    bool
	TokenUse   string
	SessionID  string
	JTI        string
	LoginStage string
}

type AdminIssuedToken struct {
	Token     string
	JTI       string
	SessionID string
	ExpiresAt time.Time
}

type AdminTokenPair struct {
	AccessToken      string
	AccessJTI        string
	AccessExpiresAt  time.Time
	RefreshToken     string
	RefreshJTI       string
	RefreshExpiresAt time.Time
	SessionID        string
	LoginStage       string
	ExpiresIn        int64
	SecuritySetup    bool
}

type AdminSessionMeta struct {
	SessionID   string    `json:"sessionId"`
	AdminID     uint64    `json:"adminId"`
	Username    string    `json:"username"`
	LoginStage  string    `json:"loginStage"`
	ClientIP    string    `json:"clientIp"`
	UserAgent   string    `json:"userAgent"`
	CreatedAt   time.Time `json:"createdAt"`
	LastSeenAt  time.Time `json:"lastSeenAt"`
	Current     bool      `json:"current,omitempty"`
	SessionName string    `json:"sessionName,omitempty"`
}

type AdminSessionItem struct {
	SessionID  string    `json:"sessionId"`
	ClientIP   string    `json:"clientIp"`
	UserAgent  string    `json:"userAgent"`
	CreatedAt  time.Time `json:"createdAt"`
	LastSeenAt time.Time `json:"lastSeenAt"`
	Current    bool      `json:"current"`
	LoginStage string    `json:"loginStage"`
}

type AdminSecurityStatus struct {
	LoginStage            string `json:"loginStage"`
	SecuritySetupRequired bool   `json:"securitySetupRequired"`
	MustResetPassword     bool   `json:"mustResetPassword"`
	TwoFactorEnabled      bool   `json:"twoFactorEnabled"`
	TwoFactorRequired     bool   `json:"twoFactorRequired"`
	PasswordExpired       bool   `json:"passwordExpired"`
}

type AdminRefreshResult struct {
	Pair  *AdminTokenPair
	Admin *model.SysAdmin
}

type AdminSecurityService struct {
	cfg *config.Config
}

func NewAdminSecurityService() *AdminSecurityService {
	return &AdminSecurityService{cfg: config.GetConfig()}
}

func (s *AdminSecurityService) IsSetupEnforced() bool {
	return !config.IsLocalLikeAppEnv()
}

func (s *AdminSecurityService) AccessTokenTTL() time.Duration {
	minutes := s.cfg.AdminAuth.AccessTokenMinutes
	if minutes <= 0 {
		minutes = 30
	}
	return time.Duration(minutes) * time.Minute
}

func (s *AdminSecurityService) RefreshTokenTTL() time.Duration {
	days := s.cfg.AdminAuth.RefreshTokenDays
	if days <= 0 {
		days = 7
	}
	return time.Duration(days) * 24 * time.Hour
}

func (s *AdminSecurityService) ReauthTTL() time.Duration {
	minutes := s.cfg.AdminAuth.ReauthTTLMinutes
	if minutes <= 0 {
		minutes = 10
	}
	return time.Duration(minutes) * time.Minute
}

func (s *AdminSecurityService) LoginFailLimit() int {
	if s.cfg.AdminAuth.LoginFailLimit <= 0 {
		return 5
	}
	return s.cfg.AdminAuth.LoginFailLimit
}

func (s *AdminSecurityService) LoginLockDuration() time.Duration {
	minutes := s.cfg.AdminAuth.LoginLockMinutes
	if minutes <= 0 {
		minutes = 30
	}
	return time.Duration(minutes) * time.Minute
}

func (s *AdminSecurityService) PasswordMinLength() int {
	if s.cfg.AdminAuth.PasswordMinLength <= 0 {
		return 10
	}
	return s.cfg.AdminAuth.PasswordMinLength
}

func (s *AdminSecurityService) PasswordMaxAge() time.Duration {
	days := s.cfg.AdminAuth.PasswordMaxAgeDays
	if days <= 0 {
		return 0
	}
	return time.Duration(days) * 24 * time.Hour
}

func (s *AdminSecurityService) MaxActiveSessions() int {
	if s.cfg.AdminAuth.MaxActiveSessions <= 0 {
		return 5
	}
	return s.cfg.AdminAuth.MaxActiveSessions
}

func (s *AdminSecurityService) totpIssuer() string {
	issuer := strings.TrimSpace(s.cfg.AdminAuth.TOTPIssuer)
	if issuer == "" {
		return "禾泽云管理后台"
	}
	return issuer
}

func (s *AdminSecurityService) IsAPIIPEnforced() bool {
	return s.cfg.AdminAuth.APIIPEnforced
}

func (s *AdminSecurityService) RequiredRoleKeys() map[string]struct{} {
	raw := strings.TrimSpace(s.cfg.AdminAuth.RequiredRoleKeys)
	result := make(map[string]struct{})
	if raw == "" {
		return result
	}
	for _, part := range strings.Split(raw, ",") {
		key := strings.TrimSpace(part)
		if key == "" {
			continue
		}
		result[key] = struct{}{}
	}
	return result
}

func (s *AdminSecurityService) AdminRequiresTwoFactor(admin *model.SysAdmin) bool {
	if !s.IsSetupEnforced() {
		return false
	}
	if admin == nil || !s.cfg.AdminAuth.TOTPEnabled {
		return false
	}
	required := s.RequiredRoleKeys()
	if len(required) == 0 {
		return false
	}
	if _, ok := required["*"]; ok {
		return true
	}
	if admin.IsSuperAdmin {
		return true
	}
	for _, role := range admin.Roles {
		if _, ok := required[strings.TrimSpace(role.Key)]; ok {
			return true
		}
	}
	return false
}

func (s *AdminSecurityService) ResolveSecurityStatus(admin *model.SysAdmin) AdminSecurityStatus {
	if !s.IsSetupEnforced() {
		return AdminSecurityStatus{
			LoginStage:            AdminLoginStageActive,
			SecuritySetupRequired: false,
			MustResetPassword:     false,
			TwoFactorEnabled:      admin != nil && admin.TwoFactorEnabled,
			TwoFactorRequired:     false,
			PasswordExpired:       false,
		}
	}
	requiresTwoFactor := s.AdminRequiresTwoFactor(admin)
	passwordExpired := s.IsPasswordExpired(admin)
	setupRequired := admin == nil || admin.MustResetPassword || passwordExpired || (requiresTwoFactor && !admin.TwoFactorEnabled)
	stage := AdminLoginStageActive
	if setupRequired {
		stage = AdminLoginStageSetupRequired
	}
	return AdminSecurityStatus{
		LoginStage:            stage,
		SecuritySetupRequired: setupRequired,
		MustResetPassword:     admin != nil && admin.MustResetPassword,
		TwoFactorEnabled:      admin != nil && admin.TwoFactorEnabled,
		TwoFactorRequired:     requiresTwoFactor,
		PasswordExpired:       passwordExpired,
	}
}

func (s *AdminSecurityService) IsPasswordExpired(admin *model.SysAdmin) bool {
	if admin == nil {
		return false
	}
	maxAge := s.PasswordMaxAge()
	if maxAge <= 0 {
		return false
	}
	if admin.PasswordChangedAt == nil {
		return true
	}
	return admin.PasswordChangedAt.Add(maxAge).Before(time.Now())
}

func (s *AdminSecurityService) ValidatePasswordPolicy(password string) error {
	password = strings.TrimSpace(password)
	if len(password) < s.PasswordMinLength() {
		return fmt.Errorf("密码长度不能少于%d位", s.PasswordMinLength())
	}
	return nil
}

func (s *AdminSecurityService) generateAdminToken(admin *model.SysAdmin, loginStage, tokenUse, sessionID string, ttl time.Duration) (*AdminIssuedToken, error) {
	if admin == nil {
		return nil, errors.New("管理员不存在")
	}
	if strings.TrimSpace(sessionID) == "" {
		sessionID = generateSessionID()
	}
	jti := uuid.New().String()
	expiresAt := time.Now().Add(ttl)
	claims := jwt.MapClaims{
		"admin_id":    admin.ID,
		"username":    admin.Username,
		"is_super":    admin.IsSuperAdmin,
		"token_type":  adminTokenType,
		"token_use":   strings.TrimSpace(tokenUse),
		"login_stage": strings.TrimSpace(loginStage),
		"jti":         jti,
		"sid":         sessionID,
		"exp":         expiresAt.Unix(),
		"iat":         time.Now().Unix(),
	}
	if admin.Phone != "" {
		claims["phone"] = admin.Phone
	}
	if admin.Email != "" {
		claims["email"] = admin.Email
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signedToken, err := token.SignedString(jwtSecret)
	if err != nil {
		return nil, err
	}
	return &AdminIssuedToken{Token: signedToken, JTI: jti, SessionID: sessionID, ExpiresAt: expiresAt}, nil
}

func (s *AdminSecurityService) IssueTokenPair(admin *model.SysAdmin, loginStage, sessionID, clientIP, userAgent string) (*AdminTokenPair, error) {
	accessIssued, err := s.generateAdminToken(admin, loginStage, tokenUseAccess, sessionID, s.AccessTokenTTL())
	if err != nil {
		return nil, err
	}
	refreshIssued, err := s.generateAdminToken(admin, loginStage, tokenUseRefresh, accessIssued.SessionID, s.RefreshTokenTTL())
	if err != nil {
		return nil, err
	}
	pair := &tokenPair{
		AccessToken:      accessIssued.Token,
		AccessJTI:        accessIssued.JTI,
		AccessExpiresAt:  accessIssued.ExpiresAt,
		RefreshToken:     refreshIssued.Token,
		RefreshJTI:       refreshIssued.JTI,
		RefreshExpiresAt: refreshIssued.ExpiresAt,
		SessionID:        accessIssued.SessionID,
	}
	if err := registerSessionTokenPair(pair); err != nil {
		return nil, err
	}
	if err := s.storeSessionMeta(admin, accessIssued.SessionID, loginStage, clientIP, userAgent, refreshIssued.ExpiresAt); err != nil {
		return nil, err
	}
	if err := s.enforceSessionLimit(admin.ID, accessIssued.SessionID); err != nil {
		return nil, err
	}
	return &AdminTokenPair{
		AccessToken:      pair.AccessToken,
		AccessJTI:        pair.AccessJTI,
		AccessExpiresAt:  pair.AccessExpiresAt,
		RefreshToken:     pair.RefreshToken,
		RefreshJTI:       pair.RefreshJTI,
		RefreshExpiresAt: pair.RefreshExpiresAt,
		SessionID:        pair.SessionID,
		LoginStage:       loginStage,
		ExpiresIn:        int64(s.AccessTokenTTL().Seconds()),
		SecuritySetup:    loginStage == AdminLoginStageSetupRequired,
	}, nil
}

func (s *AdminSecurityService) storeSessionMeta(admin *model.SysAdmin, sessionID, loginStage, clientIP, userAgent string, expiresAt time.Time) error {
	if admin == nil {
		return nil
	}
	redisClient := repository.GetRedis()
	if redisClient == nil {
		return nil
	}
	ctx, cancel := repository.RedisContext()
	defer cancel()

	meta := AdminSessionMeta{
		SessionID:  sessionID,
		AdminID:    admin.ID,
		Username:   admin.Username,
		LoginStage: loginStage,
		ClientIP:   strings.TrimSpace(clientIP),
		UserAgent:  truncateString(strings.TrimSpace(userAgent), 500),
		CreatedAt:  time.Now(),
		LastSeenAt: time.Now(),
	}
	if existing, err := s.readSessionMeta(ctx, redisClient, sessionID); err == nil && existing != nil {
		meta.CreatedAt = existing.CreatedAt
	}
	payload, err := json.Marshal(meta)
	if err != nil {
		return err
	}
	ttl := time.Until(expiresAt)
	if ttl <= 0 {
		ttl = s.RefreshTokenTTL()
	}
	pipe := redisClient.TxPipeline()
	pipe.SAdd(ctx, adminSessionIndexKey(admin.ID), sessionID)
	pipe.Expire(ctx, adminSessionIndexKey(admin.ID), ttl)
	pipe.Set(ctx, adminSessionMetaKey(sessionID), payload, ttl)
	_, err = pipe.Exec(ctx)
	return err
}

func (s *AdminSecurityService) TouchSession(adminID uint64, sessionID, clientIP, userAgent string) {
	redisClient := repository.GetRedis()
	if redisClient == nil || adminID == 0 || strings.TrimSpace(sessionID) == "" {
		return
	}
	ctx, cancel := repository.RedisContext()
	defer cancel()
	meta, err := s.readSessionMeta(ctx, redisClient, sessionID)
	if err != nil || meta == nil {
		return
	}
	meta.AdminID = adminID
	if strings.TrimSpace(clientIP) != "" {
		meta.ClientIP = strings.TrimSpace(clientIP)
	}
	if strings.TrimSpace(userAgent) != "" {
		meta.UserAgent = truncateString(strings.TrimSpace(userAgent), 500)
	}
	meta.LastSeenAt = time.Now()
	payload, err := json.Marshal(meta)
	if err != nil {
		return
	}
	ttl := s.RefreshTokenTTL()
	_ = redisClient.Set(ctx, adminSessionMetaKey(sessionID), payload, ttl).Err()
	_ = redisClient.Expire(ctx, adminSessionIndexKey(adminID), ttl).Err()
}

func (s *AdminSecurityService) ListSessions(adminID uint64, currentSID string) ([]AdminSessionItem, error) {
	redisClient := repository.GetRedis()
	if redisClient == nil {
		return []AdminSessionItem{}, nil
	}
	ctx, cancel := repository.RedisContext()
	defer cancel()
	members, err := redisClient.SMembers(ctx, adminSessionIndexKey(adminID)).Result()
	if err != nil {
		return nil, err
	}
	items := make([]AdminSessionItem, 0, len(members))
	for _, sid := range members {
		meta, metaErr := s.readSessionMeta(ctx, redisClient, sid)
		if metaErr != nil || meta == nil {
			continue
		}
		items = append(items, AdminSessionItem{
			SessionID:  meta.SessionID,
			ClientIP:   meta.ClientIP,
			UserAgent:  meta.UserAgent,
			CreatedAt:  meta.CreatedAt,
			LastSeenAt: meta.LastSeenAt,
			Current:    sid == currentSID,
			LoginStage: meta.LoginStage,
		})
	}
	sort.Slice(items, func(i, j int) bool {
		return items[i].LastSeenAt.After(items[j].LastSeenAt)
	})
	return items, nil
}

func (s *AdminSecurityService) RevokeSession(sid string) error {
	sid = strings.TrimSpace(sid)
	if sid == "" {
		return errors.New("会话ID不能为空")
	}
	redisClient := repository.GetRedis()
	if redisClient == nil {
		return errors.New("Redis 未初始化")
	}
	ctx, cancel := repository.RedisContext()
	defer cancel()
	meta, _ := s.readSessionMeta(ctx, redisClient, sid)
	if err := (&TokenService{}).revokeSessionWithRedis(ctx, redisClient, sid); err != nil {
		return err
	}
	pipe := redisClient.TxPipeline()
	pipe.Del(ctx, adminSessionMetaKey(sid))
	if meta != nil && meta.AdminID > 0 {
		pipe.SRem(ctx, adminSessionIndexKey(meta.AdminID), sid)
	}
	_, err := pipe.Exec(ctx)
	return err
}

func (s *AdminSecurityService) RevokeAllSessions(adminID uint64) error {
	if adminID == 0 {
		return nil
	}
	sessions, err := s.ListSessions(adminID, "")
	if err != nil {
		return err
	}
	for _, item := range sessions {
		if revokeErr := s.RevokeSession(item.SessionID); revokeErr != nil {
			return revokeErr
		}
	}
	return nil
}

func (s *AdminSecurityService) enforceSessionLimit(adminID uint64, keepSID string) error {
	maxSessions := s.MaxActiveSessions()
	if maxSessions <= 0 {
		return nil
	}
	sessions, err := s.ListSessions(adminID, keepSID)
	if err != nil || len(sessions) <= maxSessions {
		return err
	}
	sort.Slice(sessions, func(i, j int) bool {
		return sessions[i].LastSeenAt.Before(sessions[j].LastSeenAt)
	})
	excess := len(sessions) - maxSessions
	for _, item := range sessions {
		if excess <= 0 {
			break
		}
		if item.SessionID == keepSID {
			continue
		}
		if revokeErr := s.RevokeSession(item.SessionID); revokeErr != nil {
			return revokeErr
		}
		excess--
	}
	return nil
}

func (s *AdminSecurityService) RefreshTokens(refreshToken, clientIP, userAgent string) (*AdminRefreshResult, error) {
	claims, err := s.ParseClaims(refreshToken)
	if err != nil {
		return nil, err
	}
	if claims.TokenUse != tokenUseRefresh {
		return nil, errors.New("请使用刷新令牌")
	}
	redisClient := repository.GetRedis()
	if redisClient != nil {
		ctx, cancel := repository.RedisContext()
		defer cancel()
		exists, existsErr := redisClient.Exists(ctx, sessionTokenKey(claims.SessionID, claims.JTI)).Result()
		if existsErr == nil && exists == 0 {
			return nil, errors.New("会话已失效，请重新登录")
		}
		usedKey := fmt.Sprintf("refresh_token:used:%s", claims.JTI)
		usedMarked, markErr := redisClient.SetNX(ctx, usedKey, "1", s.RefreshTokenTTL()).Result()
		if markErr == nil && !usedMarked {
			_ = s.RevokeSession(claims.SessionID)
			return nil, errors.New("检测到令牌重放攻击，会话已撤销")
		}
		_ = redisClient.Del(ctx, sessionTokenKey(claims.SessionID, claims.JTI)).Err()
	}

	admin, err := s.GetAdminByID(claims.AdminID)
	if err != nil {
		return nil, errors.New("管理员不存在")
	}
	if admin.Status != 1 {
		return nil, errors.New("账号已被禁用")
	}
	status := s.ResolveSecurityStatus(admin)
	pair, err := s.IssueTokenPair(admin, status.LoginStage, claims.SessionID, clientIP, userAgent)
	if err != nil {
		return nil, err
	}
	return &AdminRefreshResult{
		Pair:  pair,
		Admin: admin,
	}, nil
}

func (s *AdminSecurityService) ParseClaims(tokenString string) (*AdminClaims, error) {
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("无效的签名方法")
		}
		return jwtSecret, nil
	})
	if err != nil || !token.Valid {
		return nil, errors.New("令牌无效或已过期")
	}
	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return nil, errors.New("令牌解析失败")
	}
	if tokenType, _ := claims["token_type"].(string); tokenType != adminTokenType {
		return nil, errors.New("令牌类型不匹配")
	}
	adminID, ok := adminClaimToUint64(claims["admin_id"])
	if !ok || adminID == 0 {
		return nil, errors.New("管理员身份无效")
	}
	username, _ := claims["username"].(string)
	isSuper, _ := claims["is_super"].(bool)
	tokenUse, _ := claims["token_use"].(string)
	sessionID, _ := claims["sid"].(string)
	jti, _ := claims["jti"].(string)
	loginStage, _ := claims["login_stage"].(string)
	return &AdminClaims{AdminID: adminID, Username: username, IsSuper: isSuper, TokenUse: tokenUse, SessionID: sessionID, JTI: jti, LoginStage: loginStage}, nil
}

func (s *AdminSecurityService) GetAdminByID(adminID uint64) (*model.SysAdmin, error) {
	var admin model.SysAdmin
	if err := repository.DB.Preload("Roles").First(&admin, adminID).Error; err != nil {
		return nil, err
	}
	return &admin, nil
}

func (s *AdminSecurityService) GenerateOrReuseTOTP(admin *model.SysAdmin) (string, string, error) {
	if admin == nil {
		return "", "", errors.New("管理员不存在")
	}
	secret, err := s.DecryptTOTPSecret(admin)
	if err != nil {
		return "", "", err
	}
	if secret == "" {
		secret, err = s.GenerateTOTPSecret()
		if err != nil {
			return "", "", err
		}
		encrypted, encryptErr := pkgutils.Encrypt(secret)
		if encryptErr != nil {
			return "", "", encryptErr
		}
		if err := repository.DB.Model(&model.SysAdmin{}).Where("id = ?", admin.ID).Update("two_factor_secret", encrypted).Error; err != nil {
			return "", "", err
		}
		admin.TwoFactorSecret = encrypted
	}
	return secret, s.BuildTOTPURI(admin.Username, secret), nil
}

func (s *AdminSecurityService) DecryptTOTPSecret(admin *model.SysAdmin) (string, error) {
	if admin == nil || strings.TrimSpace(admin.TwoFactorSecret) == "" {
		return "", nil
	}
	return pkgutils.Decrypt(admin.TwoFactorSecret)
}

func (s *AdminSecurityService) GenerateTOTPSecret() (string, error) {
	buffer := make([]byte, defaultTOTPSecretByteLength)
	if _, err := rand.Read(buffer); err != nil {
		return "", err
	}
	return base32.StdEncoding.WithPadding(base32.NoPadding).EncodeToString(buffer), nil
}

func (s *AdminSecurityService) BuildTOTPURI(accountName, secret string) string {
	issuer := s.totpIssuer()
	label := url.PathEscape(fmt.Sprintf("%s:%s", issuer, accountName))
	return fmt.Sprintf("otpauth://totp/%s?secret=%s&issuer=%s&period=%d&digits=6", label, url.QueryEscape(secret), url.QueryEscape(issuer), defaultTOTPPeriodSeconds)
}

func (s *AdminSecurityService) VerifyTOTP(admin *model.SysAdmin, code string) error {
	secret, err := s.DecryptTOTPSecret(admin)
	if err != nil {
		return err
	}
	if strings.TrimSpace(secret) == "" {
		return errors.New("尚未绑定 TOTP")
	}
	if !verifyTOTPCode(secret, code, time.Now(), defaultTOTPWindow) {
		return errors.New("OTP 验证失败")
	}
	return nil
}

func (s *AdminSecurityService) EnableTwoFactor(admin *model.SysAdmin, code string) error {
	if err := s.VerifyTOTP(admin, code); err != nil {
		return err
	}
	now := time.Now()
	if err := repository.DB.Model(&model.SysAdmin{}).Where("id = ?", admin.ID).Updates(map[string]interface{}{
		"two_factor_enabled":  true,
		"two_factor_bound_at": now,
	}).Error; err != nil {
		return err
	}
	admin.TwoFactorEnabled = true
	admin.TwoFactorBoundAt = &now
	return nil
}

func (s *AdminSecurityService) ResetTwoFactor(adminID uint64) error {
	now := time.Now()
	if err := repository.DB.Model(&model.SysAdmin{}).Where("id = ?", adminID).Updates(map[string]interface{}{
		"two_factor_enabled":  false,
		"two_factor_secret":   "",
		"two_factor_bound_at": nil,
		"updated_at":          now,
	}).Error; err != nil {
		return err
	}
	return s.RevokeAllSessions(adminID)
}

func (s *AdminSecurityService) ResetInitialPassword(admin *model.SysAdmin, newPassword string) error {
	if err := s.ValidatePasswordPolicy(newPassword); err != nil {
		return err
	}
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	now := time.Now()
	if err := repository.DB.Model(&model.SysAdmin{}).Where("id = ?", admin.ID).Updates(map[string]interface{}{
		"password":            string(hashedPassword),
		"must_reset_password": false,
		"password_changed_at": now,
	}).Error; err != nil {
		return err
	}
	admin.Password = string(hashedPassword)
	admin.MustResetPassword = false
	admin.PasswordChangedAt = &now
	return nil
}

func (s *AdminSecurityService) CreateReauthProof(admin *model.SysAdmin, sid, otpCode, password string) (string, time.Time, error) {
	if admin == nil || admin.ID == 0 {
		return "", time.Time{}, errors.New("管理员不存在")
	}
	otpCode = strings.TrimSpace(otpCode)
	password = strings.TrimSpace(password)
	if admin.TwoFactorEnabled {
		if otpCode == "" {
			return "", time.Time{}, errors.New("请输入动态验证码")
		}
		if err := s.VerifyTOTP(admin, otpCode); err != nil {
			return "", time.Time{}, err
		}
	} else {
		if password == "" {
			return "", time.Time{}, errors.New("请输入当前密码")
		}
		if err := bcrypt.CompareHashAndPassword([]byte(admin.Password), []byte(password)); err != nil {
			return "", time.Time{}, errors.New("当前密码错误")
		}
	}
	proof := uuid.New().String()
	expiresAt := time.Now().Add(s.ReauthTTL())
	redisClient := repository.GetRedis()
	if redisClient == nil {
		return proof, expiresAt, nil
	}
	ctx, cancel := repository.RedisContext()
	defer cancel()
	payload := fmt.Sprintf("%d", admin.ID)
	if err := redisClient.Set(ctx, adminReauthKey(sid, proof), payload, time.Until(expiresAt)).Err(); err != nil {
		return "", time.Time{}, err
	}
	return proof, expiresAt, nil
}

func (s *AdminSecurityService) ValidateReauthProof(adminID uint64, sid, proof string) error {
	proof = strings.TrimSpace(proof)
	sid = strings.TrimSpace(sid)
	if proof == "" || sid == "" {
		return errAdminReauthRequired
	}
	redisClient := repository.GetRedis()
	if redisClient == nil {
		return nil
	}
	ctx, cancel := repository.RedisContext()
	defer cancel()
	stored, err := redisClient.Get(ctx, adminReauthKey(sid, proof)).Result()
	if err != nil {
		if errors.Is(err, redis.Nil) {
			return errAdminReauthRequired
		}
		return err
	}
	if stored != strconv.FormatUint(adminID, 10) {
		return errAdminReauthRequired
	}
	return nil
}

func (s *AdminSecurityService) CreateRecoveryRequest(admin *model.SysAdmin) error {
	if admin == nil || admin.ID == 0 {
		return errors.New("管理员不存在")
	}
	redisClient := repository.GetRedis()
	if redisClient == nil {
		return nil
	}
	ctx, cancel := repository.RedisContext()
	defer cancel()
	return redisClient.Set(ctx, adminRecoveryRequestKey(admin.ID), time.Now().Format(time.RFC3339), 24*time.Hour).Err()
}

func (s *AdminSecurityService) ParseAllowedCIDRs() ([]*net.IPNet, error) {
	raw := strings.TrimSpace(s.cfg.AdminAuth.AllowedCIDRs)
	if raw == "" {
		return nil, nil
	}
	items := strings.Split(raw, ",")
	result := make([]*net.IPNet, 0, len(items))
	for _, item := range items {
		cidr := strings.TrimSpace(item)
		if cidr == "" {
			continue
		}
		if !strings.Contains(cidr, "/") {
			parsed := net.ParseIP(cidr)
			if parsed == nil {
				return nil, fmt.Errorf("无效 CIDR/IP: %s", cidr)
			}
			bits := 32
			if parsed.To4() == nil {
				bits = 128
			}
			cidr = fmt.Sprintf("%s/%d", parsed.String(), bits)
		}
		_, network, err := net.ParseCIDR(cidr)
		if err != nil {
			return nil, fmt.Errorf("无效 CIDR/IP: %s", cidr)
		}
		result = append(result, network)
	}
	return result, nil
}

func (s *AdminSecurityService) IsIPAllowed(clientIP string) (bool, error) {
	clientIP = strings.TrimSpace(clientIP)
	if clientIP == "" {
		return false, errors.New("客户端 IP 为空")
	}
	allowedCIDRs, err := s.ParseAllowedCIDRs()
	if err != nil {
		return false, err
	}
	if len(allowedCIDRs) == 0 {
		return true, nil
	}
	ip := net.ParseIP(clientIP)
	if ip == nil {
		return false, fmt.Errorf("无效客户端 IP: %s", clientIP)
	}
	for _, network := range allowedCIDRs {
		if network.Contains(ip) {
			return true, nil
		}
	}
	return false, nil
}

func (s *AdminSecurityService) readSessionMeta(ctx context.Context, redisClient *redis.Client, sessionID string) (*AdminSessionMeta, error) {
	raw, err := redisClient.Get(ctx, adminSessionMetaKey(sessionID)).Result()
	if err != nil {
		if errors.Is(err, redis.Nil) {
			return nil, nil
		}
		return nil, err
	}
	var meta AdminSessionMeta
	if err := json.Unmarshal([]byte(raw), &meta); err != nil {
		return nil, err
	}
	return &meta, nil
}

func adminSessionIndexKey(adminID uint64) string {
	return fmt.Sprintf("%s%d", adminSessionIndexKeyPrefix, adminID)
}

func adminSessionMetaKey(sessionID string) string {
	return fmt.Sprintf("%s%s", adminSessionMetaKeyPrefix, strings.TrimSpace(sessionID))
}

func adminReauthKey(sessionID, proof string) string {
	return fmt.Sprintf("%s%s:%s", adminReauthKeyPrefix, strings.TrimSpace(sessionID), strings.TrimSpace(proof))
}

func adminRecoveryRequestKey(adminID uint64) string {
	return fmt.Sprintf("%s%d", adminRecoveryRequestPrefix, adminID)
}

func truncateString(value string, max int) string {
	if max <= 0 || len(value) <= max {
		return value
	}
	return value[:max]
}

func verifyTOTPCode(secret, code string, now time.Time, window int) bool {
	secret = strings.TrimSpace(strings.ToUpper(secret))
	code = strings.TrimSpace(code)
	if secret == "" || len(code) != 6 {
		return false
	}
	key, err := base32.StdEncoding.WithPadding(base32.NoPadding).DecodeString(secret)
	if err != nil {
		return false
	}
	counter := now.Unix() / defaultTOTPPeriodSeconds
	for offset := -window; offset <= window; offset++ {
		if generateTOTPCode(key, counter+int64(offset)) == code {
			return true
		}
	}
	return false
}

func generateTOTPCode(secret []byte, counter int64) string {
	buffer := make([]byte, 8)
	binary.BigEndian.PutUint64(buffer, uint64(counter))
	hash := hmac.New(sha1.New, secret)
	_, _ = hash.Write(buffer)
	sum := hash.Sum(nil)
	offset := sum[len(sum)-1] & 0x0f
	binaryCode := (int(sum[offset])&0x7f)<<24 |
		(int(sum[offset+1])&0xff)<<16 |
		(int(sum[offset+2])&0xff)<<8 |
		(int(sum[offset+3]) & 0xff)
	return fmt.Sprintf("%06d", binaryCode%1000000)
}

func adminClaimToUint64(raw interface{}) (uint64, bool) {
	switch value := raw.(type) {
	case uint64:
		return value, true
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
