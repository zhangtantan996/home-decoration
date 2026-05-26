package service

import (
	"encoding/json"
	"errors"
	"regexp"
	"strings"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	imgutil "home-decoration-server/internal/utils/image"
	"home-decoration-server/pkg/utils"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

// UserSettingsService 用户设置相关服务
type UserSettingsService struct{}

// ChangePassword 修改密码
func (s *UserSettingsService) ChangePassword(userID uint64, oldPassword, newPassword string) error {
	var user model.User
	if err := repository.DB.First(&user, userID).Error; err != nil {
		return errors.New("用户不存在")
	}

	// 如果已设密码，需验证旧密码
	if user.Password != "" {
		if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(oldPassword)); err != nil {
			return errors.New("旧密码错误")
		}
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return errors.New("密码加密失败")
	}

	return repository.DB.Model(&user).Update("password", string(hash)).Error
}

// ChangePhone 修改手机号
func (s *UserSettingsService) ChangePhone(userID uint64, newPhone string) error {
	// 检查新手机号是否已被使用
	var count int64
	repository.DB.Model(&model.User{}).Where("phone = ? AND id != ?", newPhone, userID).Count(&count)
	if count > 0 {
		return errors.New("该手机号已被其他账号使用")
	}

	return repository.DB.Model(&model.User{}).Where("id = ?", userID).Update("phone", newPhone).Error
}

// DeleteAccount 注销账号（软删除：状态置为 -1）
func (s *UserSettingsService) DeleteAccount(userID uint64) error {
	return repository.DB.Model(&model.User{}).Where("id = ?", userID).Update("status", -1).Error
}

// GetVerification 获取实名认证信息
func (s *UserSettingsService) GetVerification(userID uint64) (*UserVerificationView, error) {
	var v model.UserVerification
	err := repository.DB.Where("user_id = ?", userID).Order("created_at DESC").First(&v).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		view := BuildUserVerificationView(nil)
		return &view, nil
	}
	if err != nil {
		return nil, err
	}
	view := BuildUserVerificationView(&v)
	return &view, nil
}

// SubmitVerification 提交实名认证
func (s *UserSettingsService) SubmitVerification(userID uint64, realName, idCard, frontImage, backImage string) error {
	_, err := s.SubmitRealNameVerification(userID, realName, idCard)
	return err
}

// GetDevices 获取登录设备列表
func (s *UserSettingsService) GetDevices(userID uint64) ([]model.UserLoginDevice, error) {
	var devices []model.UserLoginDevice
	err := repository.DB.Where("user_id = ?", userID).Order("last_login_at DESC").Find(&devices).Error
	return devices, err
}

// RemoveDevice 移除单个设备
func (s *UserSettingsService) RemoveDevice(userID, deviceID uint64) error {
	result := repository.DB.Where("id = ? AND user_id = ?", deviceID, userID).Delete(&model.UserLoginDevice{})
	if result.RowsAffected == 0 {
		return errors.New("设备不存在")
	}
	return result.Error
}

// RemoveAllOtherDevices 移除所有其他设备
func (s *UserSettingsService) RemoveAllOtherDevices(userID uint64) error {
	return repository.DB.Where("user_id = ? AND is_current = false", userID).Delete(&model.UserLoginDevice{}).Error
}

// GetSettings 获取用户偏好设置
func (s *UserSettingsService) GetSettings(userID uint64) (*model.UserSettings, error) {
	var settings model.UserSettings
	err := repository.DB.Where("user_id = ?", userID).First(&settings).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		// 创建默认设置
		settings = model.UserSettings{UserID: userID}
		if err := repository.DB.Create(&settings).Error; err != nil {
			return nil, err
		}
		return &settings, nil
	}
	return &settings, err
}

// UpdateSettings 更新用户偏好设置
func (s *UserSettingsService) UpdateSettings(userID uint64, updates map[string]interface{}) error {
	var settings model.UserSettings
	err := repository.DB.Where("user_id = ?", userID).First(&settings).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		settings = model.UserSettings{UserID: userID}
		repository.DB.Create(&settings)
	}
	return repository.DB.Model(&settings).Updates(updates).Error
}

// SubmitFeedback 提交意见反馈
func (s *UserSettingsService) SubmitFeedback(userID uint64, feedbackType, content, contact, images string) error {
	feedbackType, content, contact, images, err := normalizeUserFeedbackInput(feedbackType, content, contact, images)
	if err != nil {
		return err
	}
	fb := model.UserFeedback{
		UserID:  userID,
		Type:    feedbackType,
		Content: content,
		Contact: contact,
		Images:  normalizeStoredAssetJSONArray(images),
		Status:  0,
	}
	return repository.DB.Create(&fb).Error
}

var allowedFeedbackTypes = map[string]struct{}{
	"产品建议": {},
	"功能异常": {},
	"体验问题": {},
	"其他":   {},
}

func normalizeUserFeedbackInput(feedbackType, content, contact, images string) (string, string, string, string, error) {
	feedbackType = strings.TrimSpace(feedbackType)
	if _, ok := allowedFeedbackTypes[feedbackType]; !ok {
		return "", "", "", "", errors.New("请选择有效反馈类型")
	}
	content = strings.TrimSpace(content)
	if len([]rune(content)) == 0 || len([]rune(content)) > 300 {
		return "", "", "", "", errors.New("反馈内容需在 1-300 字符之间")
	}
	contact = strings.TrimSpace(contact)
	if contact != "" && !utils.ValidatePhone(contact) && !regexp.MustCompile(`^[A-Za-z][A-Za-z0-9_-]{5,19}$`).MatchString(contact) {
		return "", "", "", "", errors.New("请填写正确的联系方式")
	}
	normalizedImages, err := normalizeLocalAssetJSONArray(images, 4, "反馈图片")
	if err != nil {
		return "", "", "", "", err
	}
	return feedbackType, content, contact, normalizedImages, nil
}

func normalizeLocalAssetJSONArray(raw string, maxCount int, fieldLabel string) (string, error) {
	if strings.TrimSpace(raw) == "" {
		return "[]", nil
	}
	var items []string
	if err := json.Unmarshal([]byte(raw), &items); err != nil {
		return "", errors.New(fieldLabel + "格式错误")
	}
	if len(items) > maxCount {
		return "", errors.New(fieldLabel + "数量超出限制")
	}
	normalized := make([]string, 0, len(items))
	seen := make(map[string]struct{}, len(items))
	for _, item := range items {
		value := imgutil.NormalizeStoredImagePath(item)
		if value == "" {
			continue
		}
		if !imgutil.IsLocalAssetReference(value) {
			return "", errors.New(fieldLabel + "仅支持平台上传文件")
		}
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		normalized = append(normalized, value)
	}
	payload, err := json.Marshal(normalized)
	if err != nil {
		return "", err
	}
	return string(payload), nil
}

// RecordLoginDevice 记录登录设备（在登录时调用）
func (s *UserSettingsService) RecordLoginDevice(userID uint64, deviceName, deviceType, deviceID, ipAddress, location string) error {
	// 先标记所有该用户设备为非当前
	repository.DB.Model(&model.UserLoginDevice{}).Where("user_id = ?", userID).Update("is_current", false)

	// 查找已有设备记录
	var device model.UserLoginDevice
	err := repository.DB.Where("user_id = ? AND device_id = ?", userID, deviceID).First(&device).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		// 新设备
		device = model.UserLoginDevice{
			UserID:     userID,
			DeviceName: deviceName,
			DeviceType: deviceType,
			DeviceID:   deviceID,
			IPAddress:  ipAddress,
			Location:   location,
			IsCurrent:  true,
		}
		return repository.DB.Create(&device).Error
	}

	// 更新已有设备
	return repository.DB.Model(&device).Updates(map[string]interface{}{
		"device_name":   deviceName,
		"ip_address":    ipAddress,
		"location":      location,
		"last_login_at": gorm.Expr("NOW()"),
		"is_current":    true,
	}).Error
}

// HasPassword 检查用户是否已设置密码
func (s *UserSettingsService) HasPassword(userID uint64) (bool, error) {
	var user model.User
	if err := repository.DB.First(&user, userID).Error; err != nil {
		return false, err
	}
	return user.Password != "", nil
}
