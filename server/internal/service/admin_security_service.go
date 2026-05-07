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
	"gorm.io/gorm"
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

	// 统一身份中心：查找已有的 admin_profiles 映射信息
	var userID uint64
	var userPublicID string
	var adminProfileID uint64
	var identityID uint64
	var identityRefID uint64

	var adminProfile model.AdminProfile
	if err := repository.DB.Where("sys_admin_id = ? AND status = 1", admin.ID).First(&adminProfile).Error; err == nil {
		adminProfileID = adminProfile.ID
		userID = adminProfile.UserID
		identityRefID = adminProfileID

		var identity model.UserIdentity
		if err := repository.DB.
			Where("user_id = ? AND identity_type = ? AND identity_ref_id = ? AND status = ?", userID, "admin", adminProfileID, 1).
			First(&identity).Error; err == nil {
			identityID = identity.ID
		}

		var user model.User
		if err := repository.DB.Select("public_id").First(&user, userID).Error; err == nil {
			userPublicID = user.PublicID
		}
	}

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
		// 统一身份中心 claims（兼容过渡）
		"userId":         userID,
		"userPublicId":   userPublicID,
		"activeRole":     "admin",
		"adminProfileId": adminProfileID,
		"identityId":     identityID,
		"identityRefId":  identityRefID,
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
	if loginStage == AdminLoginStageActive {
		if err := s.EnsureAdminUnifiedIdentity(admin); err != nil {
			return nil, fmt.Errorf("确保管理员统一身份失败: %w", err)
		}
	}

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

// EnsureAdminUnifiedIdentity 确保管理员拥有统一的 users + admin_profiles + user_identities(admin)
// 幂等操作：在登录成功后调用，保证统一身份中心有对应记录
func (s *AdminSecurityService) EnsureAdminUnifiedIdentity(admin *model.SysAdmin) error {
	if admin == nil {
		return errors.New("管理员不存在")
	}

	adminType := "regular"
	if admin.IsSuperAdmin {
		adminType = "super_admin"
	}

	// 1. 检查是否已有 admin_profiles 桥接记录
	var existingProfile model.AdminProfile
	profileErr := repository.DB.Where("sys_admin_id = ?", admin.ID).First(&existingProfile).Error

	// 2. 若已有桥接且 user 仍存在，补齐身份记录后即可返回
	if profileErr == nil {
		var linkedUser model.User
		if err := repository.DB.First(&linkedUser, existingProfile.UserID).Error; err == nil {
			if existingProfile.Status != 1 || existingProfile.AdminType != adminType {
				if err := repository.DB.Model(&model.AdminProfile{}).
					Where("id = ?", existingProfile.ID).
					Updates(map[string]interface{}{
						"status":     1,
						"admin_type": adminType,
					}).Error; err != nil {
					return fmt.Errorf("更新 admin_profiles 状态失败: %w", err)
				}
			}
			return ensureAdminIdentityLink(linkedUser.ID, existingProfile.ID, admin.ID)
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			return fmt.Errorf("查询 admin_profiles 关联用户失败: %w", err)
		}
	}

	if profileErr != nil && !errors.Is(profileErr, gorm.ErrRecordNotFound) {
		return fmt.Errorf("查询 admin_profiles 失败: %w", profileErr)
	}

	// 3. 查找或创建 users 记录
	var user model.User
	excludeProfileID := uint64(0)
	if profileErr == nil {
		excludeProfileID = existingProfile.ID
	}
	phone := strings.TrimSpace(admin.Phone)
	if phone == "" {
		phone = fmt.Sprintf("admin_%d", admin.ID)
	}

	userErr := repository.DB.Where("phone = ? AND status = ?", phone, 1).First(&user).Error
	if userErr == nil {
		reservedByOtherAdmin, err := adminUserReservedByOtherProfile(user.ID, admin.ID, excludeProfileID)
		if err != nil {
			return fmt.Errorf("校验管理员账号占用失败: %w", err)
		}
		if reservedByOtherAdmin {
			userErr = gorm.ErrRecordNotFound
		}
	}

	if errors.Is(userErr, gorm.ErrRecordNotFound) {
		nickname := strings.TrimSpace(admin.Nickname)
		if nickname == "" {
			nickname = admin.Username
		}
		dedicatedUser, err := getOrCreateDedicatedAdminUser(admin.ID, nickname)
		if err != nil {
			return err
		}
		if dedicatedUser == nil {
			return errors.New("创建管理员专属账号失败")
		}
		user = *dedicatedUser
	} else if userErr != nil {
		return fmt.Errorf("查找管理员关联用户失败: %w", userErr)
	}

	// 4. 创建或修复 admin_profiles 桥接记录
	adminProfile := model.AdminProfile{
		UserID:     user.ID,
		SysAdminID: admin.ID,
		AdminType:  adminType,
		Status:     1,
	}
	if profileErr == nil {
		if err := repository.DB.Model(&model.AdminProfile{}).
			Where("id = ?", existingProfile.ID).
			Updates(map[string]interface{}{
				"user_id":    user.ID,
				"admin_type": adminType,
				"status":     1,
			}).Error; err != nil {
			return fmt.Errorf("修复 admin_profiles 失败: %w", err)
		}
		adminProfile.ID = existingProfile.ID
	} else {
		if err := repository.DB.Create(&adminProfile).Error; err != nil {
			return fmt.Errorf("创建 admin_profiles 失败: %w", err)
		}
	}

	return ensureAdminIdentityLink(user.ID, adminProfile.ID, admin.ID)
}

func adminUserReservedByOtherProfile(userID, sysAdminID, excludeProfileID uint64) (bool, error) {
	if userID == 0 {
		return false, nil
	}

	query := repository.DB.Model(&model.AdminProfile{}).Where("user_id = ? AND sys_admin_id <> ?", userID, sysAdminID)
	if excludeProfileID > 0 {
		query = query.Where("id <> ?", excludeProfileID)
	}

	var count int64
	if err := query.Count(&count).Error; err != nil {
		return false, err
	}
	return count > 0, nil
}

func getOrCreateDedicatedAdminUser(adminID uint64, nickname string) (*model.User, error) {
	phone := fmt.Sprintf("admin_%d", adminID)
	var user model.User

	if err := repository.DB.Where("phone = ? AND status = ?", phone, 1).First(&user).Error; err == nil {
		reservedByOtherAdmin, checkErr := adminUserReservedByOtherProfile(user.ID, adminID, 0)
		if checkErr != nil {
			return nil, fmt.Errorf("校验管理员专属账号占用失败: %w", checkErr)
		}
		if reservedByOtherAdmin {
			return nil, fmt.Errorf("管理员专属账号已被其他管理员占用: admin_id=%d", adminID)
		}
		return &user, nil
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, fmt.Errorf("查找管理员专属账号失败: %w", err)
	}

	// 命中同手机号但非启用账号：修复并激活，避免创建时撞唯一键。
	var inactiveUser model.User
	if err := repository.DB.Where("phone = ?", phone).First(&inactiveUser).Error; err == nil {
		reservedByOtherAdmin, checkErr := adminUserReservedByOtherProfile(inactiveUser.ID, adminID, 0)
		if checkErr != nil {
			return nil, fmt.Errorf("校验管理员专属账号占用失败: %w", checkErr)
		}
		if reservedByOtherAdmin {
			return nil, fmt.Errorf("管理员专属账号已被其他管理员占用: admin_id=%d", adminID)
		}

		updates := map[string]interface{}{}
		if inactiveUser.Status != 1 {
			updates["status"] = 1
		}
		if inactiveUser.UserType != 4 {
			updates["user_type"] = 4
		}
		if strings.TrimSpace(inactiveUser.DefaultIdentityType) != "admin" {
			updates["default_identity_type"] = "admin"
		}
		if strings.TrimSpace(inactiveUser.Nickname) == "" && strings.TrimSpace(nickname) != "" {
			updates["nickname"] = strings.TrimSpace(nickname)
		}
		if len(updates) > 0 {
			if err := repository.DB.Model(&model.User{}).Where("id = ?", inactiveUser.ID).Updates(updates).Error; err != nil {
				return nil, fmt.Errorf("修复管理员专属账号失败: %w", err)
			}
			if status, ok := updates["status"].(int); ok {
				inactiveUser.Status = int8(status)
			}
			if userType, ok := updates["user_type"].(int); ok {
				inactiveUser.UserType = int8(userType)
			}
			if defaultIdentityType, ok := updates["default_identity_type"].(string); ok {
				inactiveUser.DefaultIdentityType = defaultIdentityType
			}
			if updatedNickname, ok := updates["nickname"].(string); ok {
				inactiveUser.Nickname = updatedNickname
			}
		}
		return &inactiveUser, nil
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, fmt.Errorf("查找管理员专属账号失败: %w", err)
	}

	if strings.TrimSpace(nickname) == "" {
		nickname = fmt.Sprintf("管理员%d", adminID)
	}
	user = model.User{
		Phone:               phone,
		Nickname:            nickname,
		UserType:            4,
		Status:              1,
		DefaultIdentityType: "admin",
	}
	if err := repository.DB.Create(&user).Error; err != nil {
		return nil, fmt.Errorf("创建管理员专属账号失败: %w", err)
	}
	return &user, nil
}

func ensureAdminIdentityLink(userID, adminProfileID, sysAdminID uint64) error {
	if userID == 0 || adminProfileID == 0 {
		return errors.New("管理员身份关联参数无效")
	}

	var identity model.UserIdentity
	err := repository.DB.
		Where("user_id = ? AND identity_type = ? AND identity_ref_id = ?", userID, "admin", adminProfileID).
		First(&identity).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		err = repository.DB.
			Where("user_id = ? AND identity_type = ? AND identity_ref_id IS NULL", userID, "admin").
			First(&identity).Error
	}
	if errors.Is(err, gorm.ErrRecordNotFound) {
		// 历史兼容：同用户可能已有旧 admin identity（ref 指向旧 profile），优先复用该记录并修正 ref，
		// 避免继续新增 active identity 造成多条 admin 身份并存。
		err = repository.DB.
			Where("user_id = ? AND identity_type = ?", userID, "admin").
			Order("id ASC").
			First(&identity).Error
	}
	now := time.Now()
	shouldAudit := false
	var targetIdentityID uint64

	if errors.Is(err, gorm.ErrRecordNotFound) {
		adminRefID := adminProfileID
		identity = model.UserIdentity{
			UserID:        userID,
			IdentityType:  "admin",
			IdentityRefID: &adminRefID,
			Status:        1,
			Verified:      true,
			VerifiedAt:    &now,
		}
		if createErr := repository.DB.Create(&identity).Error; createErr != nil {
			return fmt.Errorf("创建 admin 身份失败: %w", createErr)
		}
		targetIdentityID = identity.ID
		shouldAudit = true
	} else if err != nil {
		return fmt.Errorf("查询 admin 身份失败: %w", err)
	} else {
		updates := map[string]interface{}{}
		if identity.IdentityRefID == nil || *identity.IdentityRefID != adminProfileID {
			updates["identity_ref_id"] = adminProfileID
		}
		if identity.Status != 1 {
			updates["status"] = 1
		}
		if !identity.Verified {
			updates["verified"] = true
		}
		if identity.VerifiedAt == nil {
			updates["verified_at"] = &now
		}
		if len(updates) > 0 {
			if updateErr := repository.DB.Model(&model.UserIdentity{}).Where("id = ?", identity.ID).Updates(updates).Error; updateErr != nil {
				return fmt.Errorf("修复 admin 身份失败: %w", updateErr)
			}
			shouldAudit = true
		}
		targetIdentityID = identity.ID
	}

	// 同一用户只保留一条 active admin identity，避免历史残留导致身份歧义。
	if targetIdentityID > 0 {
		suspendResult := repository.DB.Model(&model.UserIdentity{}).
			Where("user_id = ? AND identity_type = ? AND id <> ? AND status = ?", userID, "admin", targetIdentityID, 1).
			Updates(map[string]interface{}{
				"status":   3, // suspended
				"verified": false,
			})
		if suspendResult.Error != nil {
			return fmt.Errorf("收敛重复 admin 身份失败: %w", suspendResult.Error)
		}
		if suspendResult.RowsAffected > 0 {
			shouldAudit = true
		}
	}

	if shouldAudit {
		_ = repository.DB.Create(&model.IdentityAuditLog{
			UserID:       userID,
			Action:       "approve",
			FromIdentity: "",
			ToIdentity:   "admin",
			Metadata:     fmt.Sprintf(`{"sys_admin_id":%d}`, sysAdminID),
			CreatedAt:    time.Now(),
		}).Error
	}

	return nil
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
