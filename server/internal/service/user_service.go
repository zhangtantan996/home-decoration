package service

import (
	"errors"
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

	// 如果是密码登录但用户不存在，返回错误
	if userNotFound && req.Type == "password" {
		return nil, nil, errors.New("用户不存在，请使用验证码登录")
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
	}

	// 检查用户状态
	if user.Status != 1 {
		return nil, nil, errors.New("账号已被禁用")
	}

	// 如果是密码登录，验证密码
	if req.Type == "password" {
		if user.Password == "" {
			return nil, nil, errors.New("未设置密码，请使用验证码登录")
		}
		if !CheckPassword(req.Password, user.Password) {
			return nil, nil, errors.New("密码错误")
		}
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

// UpdateUser 更新用户信息
func (s *UserService) UpdateUser(id uint64, nickname, avatar string) error {
	return repository.DB.Model(&model.User{}).Where("id = ?", id).Updates(map[string]interface{}{
		"nickname": nickname,
		"avatar":   avatar,
	}).Error
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
	if len(password) < 6 {
		return errors.New("密码长度不能少于6位")
	}
	if len(password) > 20 {
		return errors.New("密码长度不能超过20位")
	}

	var hasLetter, hasDigit bool
	for _, c := range password {
		if unicode.IsLetter(c) {
			hasLetter = true
		}
		if unicode.IsDigit(c) {
			hasDigit = true
		}
	}

	if !hasLetter || !hasDigit {
		return errors.New("密码需包含字母和数字")
	}
	return nil
}
