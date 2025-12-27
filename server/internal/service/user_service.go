package service

import (
	"errors"
	"fmt"
	"regexp"
	"time"
	"unicode"

	"home-decoration-server/internal/config"
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

var jwtSecret []byte

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
}

// Register 用户注册
func (s *UserService) Register(req *RegisterRequest, cfg *config.JWTConfig) (*TokenResponse, *model.User, error) {
	// 校验手机号格式
	if err := validatePhone(req.Phone); err != nil {
		return nil, nil, err
	}

	// 验证手机验证码 (TODO: 实际项目需要接入短信服务)
	if req.Code != "123456" { // 测试验证码
		return nil, nil, errors.New("验证码错误")
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

	if err := repository.DB.Create(user).Error; err != nil {
		return nil, nil, err
	}

	// 注册成功后自动签发 Token
	token, err := generateToken(user.ID, user.UserType, cfg.ExpireHour)
	if err != nil {
		return nil, nil, err
	}

	refreshToken, err := generateToken(user.ID, user.UserType, cfg.ExpireHour*24)
	if err != nil {
		return nil, nil, err
	}

	return &TokenResponse{
		Token:        token,
		RefreshToken: refreshToken,
		ExpiresIn:    int64(cfg.ExpireHour * 3600),
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
	} else {
		// 默认验证码登录
		// 验证手机验证码
		if req.Code != "123456" { // 测试验证码
			return nil, nil, errors.New("验证码错误")
		}
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

	// 如果是验证码登录且用户不存在，自动创建账号
	if userNotFound && req.Type != "password" {
		user = model.User{
			Phone:    req.Phone,
			Nickname: "用户" + req.Phone[7:], // 默认昵称：用户+手机号后4位
			UserType: 1,                    // 默认业主
			Status:   1,
		}
		if err := repository.DB.Create(&user).Error; err != nil {
			return nil, nil, errors.New("账号创建失败，请稍后重试")
		}
		// 新创建的用户直接跳过锁定检查
	} else {
		// 检查账号是否被锁定
		if user.LockedUntil != nil && time.Now().Before(*user.LockedUntil) {
			remainingMinutes := int(time.Until(*user.LockedUntil).Minutes())
			return nil, nil, errors.New(fmt.Sprintf("账号已被锁定，请在 %d 分钟后重试", remainingMinutes))
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
	token, err := generateToken(user.ID, user.UserType, cfg.ExpireHour)
	if err != nil {
		return nil, nil, err
	}

	// 生成RefreshToken (有效期更长)
	refreshToken, err := generateToken(user.ID, user.UserType, cfg.ExpireHour*24)
	if err != nil {
		return nil, nil, err
	}

	return &TokenResponse{
		Token:        token,
		RefreshToken: refreshToken,
		ExpiresIn:    int64(cfg.ExpireHour * 3600),
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

	userType, ok := claims["userType"].(float64)
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

	// 生成新的 Token
	newToken, err := generateToken(uint64(userID), int8(userType), cfg.ExpireHour)
	if err != nil {
		return nil, err
	}

	// 生成新的 RefreshToken
	newRefreshToken, err := generateToken(uint64(userID), int8(userType), cfg.ExpireHour*24)
	if err != nil {
		return nil, err
	}

	return &TokenResponse{
		Token:        newToken,
		RefreshToken: newRefreshToken,
		ExpiresIn:    int64(cfg.ExpireHour * 3600),
	}, nil
}

// UpdateUser 更新用户信息
func (s *UserService) UpdateUser(id uint64, nickname, avatar string) error {
	return repository.DB.Model(&model.User{}).Where("id = ?", id).Updates(map[string]interface{}{
		"nickname": nickname,
		"avatar":   avatar,
	}).Error
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

		return errors.New(fmt.Sprintf("登录失败次数过多，账号已被锁定 %d 分钟", int(lockDuration.Minutes())))
	}

	// 更新数据库
	repository.DB.Model(user).Updates(updates)

	remainingAttempts := lockThreshold - user.LoginFailedCount
	if loginType == "password" {
		return errors.New(fmt.Sprintf("手机号或密码错误，还可尝试 %d 次", remainingAttempts))
	}
	return errors.New(fmt.Sprintf("验证码错误，还可尝试 %d 次", remainingAttempts))
}

// generateToken 生成JWT Token
func generateToken(userID uint64, userType int8, expireHour int) (string, error) {
	claims := jwt.MapClaims{
		"userId":   userID,
		"userType": userType,
		"exp":      time.Now().Add(time.Hour * time.Duration(expireHour)).Unix(),
		"iat":      time.Now().Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(jwtSecret)
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
