package tencentim

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strconv"
	"time"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
)

// IMClient 腾讯云 IM REST API 客户端
type IMClient struct {
	SDKAppID  int
	SecretKey string
	AdminID   string // 管理员账号，用于生成签名
}

// 单例客户端
var defaultClient *IMClient

// InitClient 初始化 IM 客户端（应用启动时调用）
func InitClient() error {
	sdkAppIDStr, _ := getConfig(model.ConfigKeyTencentIMSDKAppID)
	secretKey, _ := getConfig(model.ConfigKeyTencentIMSecretKey)
	enabledStr, _ := getConfig(model.ConfigKeyTencentIMEnabled)

	if enabledStr != "true" {
		log.Println("[TencentIM] IM 服务未启用")
		return nil
	}

	sdkAppID, _ := strconv.Atoi(sdkAppIDStr)
	if sdkAppID == 0 || secretKey == "" {
		log.Println("[TencentIM] IM 配置不完整，跳过初始化")
		return nil
	}

	defaultClient = &IMClient{
		SDKAppID:  sdkAppID,
		SecretKey: secretKey,
		AdminID:   "administrator", // 默认管理员账号
	}

	log.Printf("[TencentIM] 客户端初始化成功，SDKAppID=%d", sdkAppID)
	return nil
}

// getConfig 从数据库获取配置（简化版，避免循环引用）
func getConfig(key string) (string, error) {
	// 优先从 system_configs 表读取（业务配置）
	var config model.SystemConfig
	if err := repository.DB.Where("key = ?", key).First(&config).Error; err == nil {
		return config.Value, nil
	}
	// 降级到 system_settings 表（旧版通用设置）
	var setting model.SystemSettings
	if err := repository.DB.Where("\"key\" = ?", key).First(&setting).Error; err == nil {
		return setting.Value, nil
	}
	return "", fmt.Errorf("config not found: %s", key)
}

// GetClient 获取默认客户端
func GetClient() *IMClient {
	return defaultClient
}

// IsEnabled 检查 IM 是否已启用
func IsEnabled() bool {
	return defaultClient != nil
}

// ImportUserRequest 导入用户请求
type ImportUserRequest struct {
	UserID  string `json:"UserID"`
	Nick    string `json:"Nick,omitempty"`
	FaceURL string `json:"FaceUrl,omitempty"`
}

// ImportUserResponse 导入用户响应
type ImportUserResponse struct {
	ActionStatus string `json:"ActionStatus"`
	ErrorCode    int    `json:"ErrorCode"`
	ErrorInfo    string `json:"ErrorInfo"`
}

// ImportUser 导入单个用户到腾讯云 IM
func (c *IMClient) ImportUser(userID uint64, nickname, avatar string) error {
	if c == nil {
		return fmt.Errorf("IM 客户端未初始化")
	}

	// 生成管理员签名
	adminSig, err := GenUserSig(c.SDKAppID, c.SecretKey, c.AdminID, 86400)
	if err != nil {
		return fmt.Errorf("生成管理员签名失败: %w", err)
	}

	// 构建请求 URL
	url := fmt.Sprintf(
		"https://console.tim.qq.com/v4/im_open_login_svc/account_import?sdkappid=%d&identifier=%s&usersig=%s&random=%d&contenttype=json",
		c.SDKAppID, c.AdminID, adminSig, time.Now().UnixNano(),
	)

	// 构建请求体
	reqBody := ImportUserRequest{
		UserID:  strconv.FormatUint(userID, 10),
		Nick:    nickname,
		FaceURL: avatar,
	}
	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return fmt.Errorf("序列化请求失败: %w", err)
	}

	// 发送请求
	resp, err := http.Post(url, "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("请求失败: %w", err)
	}
	defer resp.Body.Close()

	// 解析响应
	body, _ := io.ReadAll(resp.Body)
	var result ImportUserResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return fmt.Errorf("解析响应失败: %w", err)
	}

	if result.ErrorCode != 0 {
		return fmt.Errorf("导入用户失败: code=%d, info=%s", result.ErrorCode, result.ErrorInfo)
	}

	log.Printf("[TencentIM] 用户导入成功: userID=%d, nickname=%s", userID, nickname)
	return nil
}

// SyncUserToIM 同步用户到腾讯云 IM（便捷方法）
func SyncUserToIM(userID uint64, nickname, avatar string) error {
	client := GetClient()
	if client == nil {
		// IM 未启用，静默跳过
		return nil
	}
	return client.ImportUser(userID, nickname, avatar)
}

// BatchImportUsers 批量导入用户（用于数据迁移）
func (c *IMClient) BatchImportUsers(users []ImportUserRequest) error {
	if c == nil {
		return fmt.Errorf("IM 客户端未初始化")
	}

	for _, user := range users {
		userID, _ := strconv.ParseUint(user.UserID, 10, 64)
		if err := c.ImportUser(userID, user.Nick, user.FaceURL); err != nil {
			log.Printf("[TencentIM] 批量导入失败: userID=%s, err=%v", user.UserID, err)
			// 继续处理下一个，不中断
		}
	}
	return nil
}
