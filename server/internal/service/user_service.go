package service

import (
	"errors"
	"fmt"
	"log"
	"regexp"
	"strconv"
	"strings"
	"time"
	"unicode"

	"home-decoration-server/internal/config"
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	"home-decoration-server/internal/tinode"
	"home-decoration-server/internal/utils/image"
	"home-decoration-server/internal/utils/tencentim"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

var jwtSecret []byte

const (
	tokenUseAccess  = "access"
	tokenUseRefresh = "refresh"

	accessTokenTTL  = 2 * time.Hour
	refreshTokenTTL = 7 * 24 * time.Hour
)

// InitJWT 初始化JWT密钥
func InitJWT(secret string) {
	jwtSecret = []byte(secret)
}

// UserService 用户服务
type UserService struct{}

// RegisterRequest 注册请求
type RegisterRequest struct {
	Phone    string `json:"phone" binding:"required"`
	Code     string `json:"code" binding:"required"`
	Password string `json:"password"`
	Nickname string `json:"nickname"`
	UserType int8   `json:"userType"` // 1业主 2服务商 3工人
}

// LoginRequest 登录请求
type LoginRequest struct {
	Phone    string `json:"phone" binding:"required"`
	Code     string `json:"code"`     // 验证码登录时必填
	Password string `json:"password"` // 密码登录时必填
	Type     string `json:"type"`     // login type: code or password
}

// TokenResponse Token响应
type TokenResponse struct {
	Token        string `json:"token"`
	RefreshToken string `json:"refreshToken"`
	ExpiresIn    int64  `json:"expiresIn"`
	TinodeToken  string `json:"tinodeToken,omitempty"`
	TinodeError  string `json:"tinodeError,omitempty"` // Tinode token 生成错误信息
}

// Register 用户注册
func (s *UserService) Register(req *RegisterRequest, cfg *config.JWTConfig) (*TokenResponse, *model.User, error) {
	// 校验手机号格式
	if err := validatePhone(req.Phone); err != nil {
		return nil, nil, err
	}

	// 验证手机验证码 (TODO: 实际项目需要接入短信服务)
	if err := VerifySMSCode(req.Phone, req.Code); err != nil {
		return nil, nil, err
	}

	// 检查手机号是否已注册
	var existUser model.User
	if err := repository.DB.Where("phone = ?", req.Phone).First(&existUser).Error; err == nil {
		return nil, nil, errors.New("手机号已注册")
	}

	// 校验密码强度（如果提供了密码）
	if req.Password != "" {
		if err := validatePassword(req.Password); err != nil {
			return nil, nil, err
		}
	}

	// 设置默认用户类型
	userType := req.UserType
	if userType == 0 {
		userType = 1 // 默认业主
	}

	// 创建用户
	user := &model.User{
		Phone:    req.Phone,
		Nickname: req.Nickname,
		UserType: userType,
		Status:   1,
	}

	// 如果提供了密码，加密存储
	if req.Password != "" {
		hashedPwd, err := HashPassword(req.Password)
		if err != nil {
			return nil, nil, err
		}
		user.Password = hashedPwd
	}

	// Transaction for main DB user creation
	tx := repository.DB.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
			log.Printf("[Register] Transaction panic recovered: %v", r)
		}
	}()

	if err := tx.Create(user).Error; err != nil {
		tx.Rollback()
		return nil, nil, err
	}

	if err := tx.Commit().Error; err != nil {
		return nil, nil, err
	}

	// 同步用户到腾讯云 IM（异步，失败不影响注册）
	go func(u *model.User) {
		fullAvatar := image.GetFullImageURL(u.Avatar)
		if err := tencentim.SyncUserToIM(u.ID, u.Nickname, fullAvatar); err != nil {
			log.Printf("[TencentIM] 用户同步失败: userID=%d, err=%v", u.ID, err)
		}
	}(user)

	// 注册成功后自动签发 Token
	roleCtx, err := getUserRoleContext(user)
	if err != nil {
		return nil, nil, err
	}

	token, err := generateAccessTokenV2(user.ID, user.PublicID, roleCtx.ActiveRole, roleCtx.ProviderID, roleCtx.ProviderSubType)
	if err != nil {
		return nil, nil, err
	}

	refreshToken, err := generateRefreshTokenV2(user.ID, user.PublicID, roleCtx.ActiveRole, roleCtx.ProviderID, roleCtx.ProviderSubType)
	if err != nil {
		return nil, nil, err
	}

	// Tinode token generation + user sync (best-effort; failures don't block register)
	tinodeToken := ""
	tinodeError := ""
	tinodeTokenResult, err := tinode.GenerateTinodeToken(user.ID, user.Nickname)
	if err != nil {
		log.Printf("[Tinode] Token generation failed (register): userID=%d, err=%v", user.ID, err)
		// 不向客户端暴露内部错误细节
		tinodeError = "聊天服务暂时不可用"
	} else {
		tinodeToken = tinodeTokenResult
	}

	// Sync to Tinode DB with separate transaction (best-effort)
	if repository.TinodeDB != nil {
		tinodeTx := repository.TinodeDB.Begin()
		defer func() {
			if r := recover(); r != nil {
				tinodeTx.Rollback()
				log.Printf("[Tinode] Sync transaction panic recovered: %v", r)
			}
		}()

		if err := tinode.SyncUserToTinodeWithTx(tinodeTx, user); err != nil {
			tinodeTx.Rollback()
			log.Printf("[Tinode] User sync failed (register): userID=%d, err=%v", user.ID, err)
		} else {
			if err := tinodeTx.Commit().Error; err != nil {
				log.Printf("[Tinode] Sync transaction commit failed: userID=%d, err=%v", user.ID, err)
			}
		}
	} else {
		log.Printf("[Tinode] TinodeDB not initialized, skipping sync for userID=%d", user.ID)
	}

	return &TokenResponse{
		Token:        token,
		RefreshToken: refreshToken,
		ExpiresIn:    int64(cfg.ExpireHour * 3600),
		TinodeToken:  tinodeToken,
		TinodeError:  tinodeError,
	}, user, nil
}

// Login 用户登录
func (s *UserService) Login(req *LoginRequest, cfg *config.JWTConfig) (*TokenResponse, *model.User, error) {
	// 校验手机号格式
	if err := validatePhone(req.Phone); err != nil {
		return nil, nil, err
	}

	// 根据登录类型验证
	if req.Type == "password" {
		if req.Password == "" {
			return nil, nil, errors.New("请输入密码")
		}
	} else if req.Code == "" {
		// 默认验证码登录
		return nil, nil, errors.New("请输入验证码")
	}

	// 查找用户
	var user model.User
	userNotFound := false
	if err := repository.DB.Where("phone = ?", req.Phone).First(&user).Error; err != nil {
		userNotFound = true
	}

	// 如果是密码登录但用户不存在，统一返回错误（避免信息泄露）
	if userNotFound && req.Type == "password" {
		return nil, nil, errors.New("手机号或密码错误")
	}

	codeVerified := false
	// 验证码登录时，如果用户不存在，先校验短信验证码，避免无效验证码触发自动创建账号
	if userNotFound && req.Type != "password" {
		if err := VerifySMSCode(req.Phone, req.Code); err != nil {
			return nil, nil, err
		}
		codeVerified = true
	}

	// 如果是验证码登录且用户不存在，自动创建账号
	if userNotFound && req.Type != "password" {
		user = model.User{
			Phone:    req.Phone,
			Nickname: "用户" + req.Phone[7:], // 默认昵称：用户+手机号后4位
			UserType: 1,                    // 默认业主
			Status:   1,
		}

		// Transaction for user creation
		tx := repository.DB.Begin()
		defer func() {
			if r := recover(); r != nil {
				tx.Rollback()
				log.Printf("[Login] User creation transaction panic recovered: %v", r)
			}
		}()

		if err := tx.Create(&user).Error; err != nil {
			tx.Rollback()
			return nil, nil, errors.New("账号创建失败，请稍后重试")
		}

		if err := tx.Commit().Error; err != nil {
			return nil, nil, errors.New("账号创建失败，请稍后重试")
		}
		// 同步新用户到腾讯云 IM（异步）
		go func(u *model.User) {
			fullAvatar := image.GetFullImageURL(u.Avatar)
			if err := tencentim.SyncUserToIM(u.ID, u.Nickname, fullAvatar); err != nil {
				log.Printf("[TencentIM] 用户同步失败: userID=%d, err=%v", u.ID, err)
			}
		}(&user)
		// 新创建的用户直接跳过锁定检查
	} else {
		// 检查账号是否被锁定
		if user.LockedUntil != nil && time.Now().Before(*user.LockedUntil) {
			remainingMinutes := int(time.Until(*user.LockedUntil).Minutes())
			return nil, nil, fmt.Errorf("账号已被锁定，请在 %d 分钟后重试", remainingMinutes)
		}

		// 如果锁定时间已过，重置失败次数
		if user.LockedUntil != nil && time.Now().After(*user.LockedUntil) {
			user.LoginFailedCount = 0
			user.LockedUntil = nil
			user.LastFailedLoginAt = nil
			repository.DB.Model(&user).Updates(map[string]interface{}{
				"login_failed_count":   0,
				"locked_until":         nil,
				"last_failed_login_at": nil,
			})
		}
	}

	// 检查用户状态
	if user.Status != 1 {
		return nil, nil, errors.New("账号已被禁用")
	}

	// 验证码登录：在锁定检查之后再消费验证码（避免账号被锁定时浪费验证码）
	if req.Type != "password" && !codeVerified {
		if err := VerifySMSCode(req.Phone, req.Code); err != nil {
			if errors.Is(err, errSMSCodeInvalid) {
				return nil, nil, s.handleLoginFailure(&user, "code")
			}
			return nil, nil, err
		}
		codeVerified = true
	}

	// 如果是密码登录，验证密码
	if req.Type == "password" {
		if user.Password == "" {
			return nil, nil, errors.New("手机号或密码错误")
		}
		if !CheckPassword(req.Password, user.Password) {
			// 密码错误，记录失败次数
			return nil, nil, s.handleLoginFailure(&user, "password")
		}
	}

	// 登录成功，重置失败次数
	if user.LoginFailedCount > 0 {
		repository.DB.Model(&user).Updates(map[string]interface{}{
			"login_failed_count":   0,
			"last_failed_login_at": nil,
		})
		user.LoginFailedCount = 0
		user.LastFailedLoginAt = nil
	}

	// 生成Token
	roleCtx, err := getUserRoleContext(&user)
	if err != nil {
		return nil, nil, err
	}

	token, err := generateAccessTokenV2(user.ID, user.PublicID, roleCtx.ActiveRole, roleCtx.ProviderID, roleCtx.ProviderSubType)
	if err != nil {
		return nil, nil, err
	}

	// 生成RefreshToken (有效期更长)
	refreshToken, err := generateRefreshTokenV2(user.ID, user.PublicID, roleCtx.ActiveRole, roleCtx.ProviderID, roleCtx.ProviderSubType)
	if err != nil {
		return nil, nil, err
	}

	// Tinode token generation + user sync (best-effort; failures don't block login)
	tinodeToken := ""
	tinodeError := ""
	tinodeTokenResult, err := tinode.GenerateTinodeToken(user.ID, user.Nickname)
	if err != nil {
		log.Printf("[Tinode] Token generation failed (login): userID=%d, err=%v", user.ID, err)
		// 不向客户端暴露内部错误细节
		tinodeError = "聊天服务暂时不可用"
	} else {
		tinodeToken = tinodeTokenResult
	}

	// Sync to Tinode DB with separate transaction (best-effort)
	if repository.TinodeDB != nil {
		tinodeTx := repository.TinodeDB.Begin()
		defer func() {
			if r := recover(); r != nil {
				tinodeTx.Rollback()
				log.Printf("[Tinode] Sync transaction panic recovered (login): %v", r)
			}
		}()

		if err := tinode.SyncUserToTinodeWithTx(tinodeTx, &user); err != nil {
			tinodeTx.Rollback()
			log.Printf("[Tinode] User sync failed (login): userID=%d, err=%v", user.ID, err)
		} else {
			if err := tinodeTx.Commit().Error; err != nil {
				log.Printf("[Tinode] Sync transaction commit failed (login): userID=%d, err=%v", user.ID, err)
			}
		}
	} else {
		log.Printf("[Tinode] TinodeDB not initialized, skipping sync for userID=%d (login)", user.ID)
	}

	return &TokenResponse{
		Token:        token,
		RefreshToken: refreshToken,
		ExpiresIn:    int64(cfg.ExpireHour * 3600),
		TinodeToken:  tinodeToken,
		TinodeError:  tinodeError,
	}, &user, nil
}

// GetUserByID 根据ID获取用户
func (s *UserService) GetUserByID(id uint64) (*model.User, error) {
	var user model.User
	if err := repository.DB.First(&user, id).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

// GetUserByIdentifier 根据用户标识获取用户（支持内部ID或publicId）
func (s *UserService) GetUserByIdentifier(identifier string) (*model.User, error) {
	trimmedIdentifier := strings.TrimSpace(identifier)
	if trimmedIdentifier == "" {
		return nil, fmt.Errorf("用户标识不能为空")
	}

	var user model.User
	if userID, err := strconv.ParseUint(trimmedIdentifier, 10, 64); err == nil && userID > 0 {
		if err := repository.DB.First(&user, userID).Error; err == nil {
			return &user, nil
		}
	}

	if err := repository.DB.Where("public_id = ?", trimmedIdentifier).First(&user).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

// RefreshToken 刷新访问令牌
func (s *UserService) RefreshToken(refreshToken string, cfg *config.JWTConfig) (*TokenResponse, error) {
	// 验证 RefreshToken
	token, err := jwt.Parse(refreshToken, func(token *jwt.Token) (interface{}, error) {
		// 验证签名方法
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("无效的签名方法")
		}
		return jwtSecret, nil
	})

	if err != nil {
		return nil, errors.New("刷新令牌无效或已过期")
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok || !token.Valid {
		return nil, errors.New("刷新令牌无效")
	}

	// 提取用户信息
	userID, ok := claims["userId"].(float64)
	if !ok {
		return nil, errors.New("刷新令牌格式错误")
	}

	// 验证用户是否存在且状态正常
	user, err := s.GetUserByID(uint64(userID))
	if err != nil {
		return nil, errors.New("用户不存在")
	}

	if user.Status != 1 {
		return nil, errors.New("账号已被禁用")
	}

	roleCtx, hasRoleContext := getRoleContextFromClaims(claims)
	if !hasRoleContext {
		resolvedCtx, resolveErr := getUserRoleContext(user)
		if resolveErr != nil {
			return nil, resolveErr
		}
		roleCtx = resolvedCtx
	}

	// 生成新的 Token
	newToken, err := generateAccessTokenV2(uint64(userID), user.PublicID, roleCtx.ActiveRole, roleCtx.ProviderID, roleCtx.ProviderSubType)
	if err != nil {
		return nil, err
	}

	// 生成新的 RefreshToken
	newRefreshToken, err := generateRefreshTokenV2(uint64(userID), user.PublicID, roleCtx.ActiveRole, roleCtx.ProviderID, roleCtx.ProviderSubType)
	if err != nil {
		return nil, err
	}

	return &TokenResponse{
		Token:        newToken,
		RefreshToken: newRefreshToken,
		ExpiresIn:    int64(cfg.ExpireHour * 3600),
	}, nil
}

// RefreshTinodeToken 刷新 Tinode Token
func (s *UserService) RefreshTinodeToken(user *model.User) (string, error) {
	if user == nil {
		return "", errors.New("用户不存在")
	}

	// 生成新的 Tinode token
	tinodeToken, err := tinode.GenerateTinodeToken(user.ID, user.Nickname)
	if err != nil {
		log.Printf("[Tinode] Token refresh failed: userID=%d, err=%v", user.ID, err)
		// 不向客户端暴露内部错误细节
		return "", errors.New("聊天服务暂时不可用")
	}

	// 同步用户到 Tinode DB（如果需要）
	if repository.TinodeDB != nil {
		tinodeTx := repository.TinodeDB.Begin()
		defer func() {
			if r := recover(); r != nil {
				tinodeTx.Rollback()
				log.Printf("[Tinode] Sync transaction panic recovered (refresh): %v", r)
			}
		}()

		if err := tinode.SyncUserToTinodeWithTx(tinodeTx, user); err != nil {
			tinodeTx.Rollback()
			log.Printf("[Tinode] User sync failed (refresh): userID=%d, err=%v", user.ID, err)
			// 同步失败不影响 token 返回
		} else {
			if err := tinodeTx.Commit().Error; err != nil {
				log.Printf("[Tinode] Sync transaction commit failed (refresh): userID=%d, err=%v", user.ID, err)
			}
		}
	}

	return tinodeToken, nil
}

// UpdateUser 更新用户信息
func (s *UserService) UpdateUser(id uint64, nickname, avatar string) error {
	err := repository.DB.Model(&model.User{}).Where("id = ?", id).Updates(map[string]interface{}{
		"nickname": nickname,
		"avatar":   avatar,
	}).Error

	if err != nil {
		return err
	}

	// 异步同步到腾讯云 IM
	go func() {
		// 重新查询用户以获取完整信息（或者直接使用传入的新值）
		// 这里直接使用新值，注意处理avatar可能为空的情况（如果是局部更新）
		// 但为了保险，建议如果为空则查询数据库，或者简单地 assume 传入的就是最新值
		// 这里参数是必传的吗？ handler里是 struct binding，可能是空字符串
		// 为了稳健，查询一次数据库最新的状态
		var user model.User
		if err := repository.DB.First(&user, id).Error; err == nil {
			// 处理默认昵称
			if user.Nickname == "" {
				suffix := ""
				if len(user.Phone) >= 4 {
					suffix = user.Phone[len(user.Phone)-4:]
				}
				user.Nickname = fmt.Sprintf("用户%s", suffix)
			}

			fullAvatar := image.GetFullImageURL(user.Avatar)
			if err := tencentim.SyncUserToIM(user.ID, user.Nickname, fullAvatar); err != nil {
				log.Printf("[TencentIM] 更新用户同步失败: userID=%d, err=%v", user.ID, err)
			}
		}
	}()

	return nil
}

// handleLoginFailure 处理登录失败逻辑
func (s *UserService) handleLoginFailure(user *model.User, loginType string) error {
	now := time.Now()
	user.LoginFailedCount++
	user.LastFailedLoginAt = &now

	updates := map[string]interface{}{
		"login_failed_count":   user.LoginFailedCount,
		"last_failed_login_at": now,
	}

	// 密码登录：5次失败锁定15分钟
	// 验证码登录：10次失败锁定30分钟
	var lockThreshold int
	var lockDuration time.Duration

	if loginType == "password" {
		lockThreshold = 5
		lockDuration = 15 * time.Minute
	} else {
		lockThreshold = 10
		lockDuration = 30 * time.Minute
	}

	if user.LoginFailedCount >= lockThreshold {
		lockedUntil := now.Add(lockDuration)
		user.LockedUntil = &lockedUntil
		updates["locked_until"] = lockedUntil

		// 更新数据库
		repository.DB.Model(user).Updates(updates)

		return fmt.Errorf("登录失败次数过多，账号已被锁定 %d 分钟", int(lockDuration.Minutes()))
	}

	// 更新数据库
	repository.DB.Model(user).Updates(updates)

	remainingAttempts := lockThreshold - user.LoginFailedCount
	if loginType == "password" {
		return fmt.Errorf("手机号或密码错误，还可尝试 %d 次", remainingAttempts)
	}
	return fmt.Errorf("验证码错误，还可尝试 %d 次", remainingAttempts)
}

// generateToken 生成JWT Token
func generateToken(userID uint64, userPublicID string, userType int8, expireHour int) (string, error) {
	resolvedPublicID, err := resolveUserPublicID(userID, userPublicID)
	if err != nil {
		return "", err
	}

	claims := jwt.MapClaims{
		"sub":          resolvedPublicID,
		"userPublicId": resolvedPublicID,
		"userId":       userID,
		"userType":     userType,
		"exp":          time.Now().Add(time.Hour * time.Duration(expireHour)).Unix(),
		"iat":          time.Now().Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(jwtSecret)
}

// generateAccessTokenV2 生成访问令牌 (2小时有效)
func generateAccessTokenV2(userID uint64, userPublicID string, activeRole string, refID *uint64, providerSubType string) (string, error) {
	return generateTokenV2(userID, userPublicID, activeRole, refID, providerSubType, tokenUseAccess, accessTokenTTL)
}

// generateRefreshTokenV2 生成刷新令牌 (7天有效)
func generateRefreshTokenV2(userID uint64, userPublicID string, activeRole string, refID *uint64, providerSubType string) (string, error) {
	return generateTokenV2(userID, userPublicID, activeRole, refID, providerSubType, tokenUseRefresh, refreshTokenTTL)
}

// generateTokenV2 生成JWT Token v2 (支持多身份)
func generateTokenV2(userID uint64, userPublicID string, activeRole string, refID *uint64, providerSubType string, tokenUse string, ttl time.Duration) (string, error) {
	resolvedPublicID, err := resolveUserPublicID(userID, userPublicID)
	if err != nil {
		return "", err
	}

	if activeRole != "provider" {
		providerSubType = ""
		refID = nil
	}

	claims := jwt.MapClaims{
		"sub":             resolvedPublicID,
		"userPublicId":    resolvedPublicID,
		"userId":          userID,
		"activeRole":      activeRole,
		"providerId":      refID,
		"providerSubType": providerSubType,
		"token_type":      "user",
		"token_use":       tokenUse,
		"jti":             uuid.New().String(),
		"sid":             generateSessionID(),
		"exp":             time.Now().Add(ttl).Unix(),
		"iat":             time.Now().Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(jwtSecret)
}

// generateSessionID 生成会话ID
func generateSessionID() string {
	return uuid.New().String()
}

// resolveUserPublicID resolves and backfills user public id when needed.
func resolveUserPublicID(userID uint64, userPublicID string) (string, error) {
	if userPublicID != "" {
		return userPublicID, nil
	}

	var user model.User
	if err := repository.DB.Select("id", "public_id").First(&user, userID).Error; err != nil {
		return "", fmt.Errorf("查询用户public_id失败: %w", err)
	}

	if user.PublicID != "" {
		return user.PublicID, nil
	}

	generatedPublicID := model.GeneratePublicID()
	if err := repository.DB.Model(&model.User{}).Where("id = ?", userID).Update("public_id", generatedPublicID).Error; err != nil {
		return "", fmt.Errorf("补齐用户public_id失败: %w", err)
	}

	return generatedPublicID, nil
}

// getUserActiveRoleAndRefID 根据 UserType 获取 activeRole 和 refID
func getUserActiveRoleAndRefID(user *model.User) (string, *uint64, error) {
	ctx, err := getUserRoleContext(user)
	if err != nil {
		return "", nil, err
	}

	return ctx.ActiveRole, ctx.ProviderID, nil
}

// HashPassword 加密密码
func HashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	return string(bytes), err
}

// CheckPassword 验证密码
func CheckPassword(password, hash string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	return err == nil
}

// validatePhone 校验手机号格式
func validatePhone(phone string) error {
	// 中国大陆手机号：以1开头，第二位是3-9，总共11位数字
	phoneRegex := regexp.MustCompile(`^1[3-9]\d{9}$`)
	if !phoneRegex.MatchString(phone) {
		return errors.New("手机号格式不正确，请输入11位有效手机号")
	}
	return nil
}

// validatePassword 校验密码强度
func validatePassword(password string) error {
	if len(password) < 8 {
		return errors.New("密码长度不能少于8位")
	}
	if len(password) > 20 {
		return errors.New("密码长度不能超过20位")
	}

	var hasUpper, hasLower, hasDigit, hasSpecial bool
	for _, c := range password {
		switch {
		case unicode.IsUpper(c):
			hasUpper = true
		case unicode.IsLower(c):
			hasLower = true
		case unicode.IsDigit(c):
			hasDigit = true
		case unicode.IsPunct(c) || unicode.IsSymbol(c):
			hasSpecial = true
		}
	}

	if !hasUpper {
		return errors.New("密码需包含至少一个大写字母")
	}
	if !hasLower {
		return errors.New("密码需包含至少一个小写字母")
	}
	if !hasDigit {
		return errors.New("密码需包含至少一个数字")
	}
	if !hasSpecial {
		return errors.New("密码需包含至少一个特殊字符")
	}
	return nil
}
