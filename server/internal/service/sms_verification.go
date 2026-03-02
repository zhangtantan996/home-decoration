package service

import (
	"crypto/rand"
	"crypto/subtle"
	"errors"
	"fmt"
	"log"
	"math/big"
	"os"
	"strings"
	"time"

	"home-decoration-server/internal/config"
	"home-decoration-server/internal/repository"
	"home-decoration-server/pkg/utils"

	"github.com/redis/go-redis/v9"
)

const (
	// Development-only bypass code. Must never be accepted in strict production mode.
	devBypassCode = "123456"
	smsCodeTTL    = 5 * time.Minute
)

var (
	errSMSCodeRequired = errors.New("请输入验证码")
	errSMSCodeExpired  = errors.New("验证码已过期或不存在")
	errSMSCodeInvalid  = errors.New("验证码错误")
	errSMSNotReady     = errors.New("验证码服务未就绪")
	errSMSServiceError = errors.New("验证码服务异常")
)

func isReleaseMode() bool {
	cfg := config.GetConfig()
	return strings.EqualFold(strings.TrimSpace(cfg.Server.Mode), "release")
}

func isLocalLikeEnv() bool {
	switch strings.ToLower(strings.TrimSpace(os.Getenv("APP_ENV"))) {
	case "local", "docker", "dev", "development", "test":
		return true
	default:
		return false
	}
}

func isStrictProductionMode() bool {
	return isReleaseMode() && !isLocalLikeEnv()
}

func smsCodeKey(phone string) string {
	return "sms:code:" + strings.TrimSpace(phone)
}

func generateSMSCode() (string, error) {
	n, err := rand.Int(rand.Reader, big.NewInt(1000000))
	if err != nil {
		return "", fmt.Errorf("generate code: %w", err)
	}
	return fmt.Sprintf("%06d", n.Int64()), nil
}

// SendSMSCode generates and sends a verification code, then stores it in Redis with a TTL.
// In non-strict-production mode, it returns the code for debugging convenience.
func SendSMSCode(phone, clientIP string) (string, error) {
	phone = strings.TrimSpace(phone)
	if !utils.ValidatePhone(phone) {
		return "", errors.New("手机号格式不正确")
	}

	if err := smsService.CanSendCode(phone, clientIP); err != nil {
		return "", err
	}

	code, err := generateSMSCode()
	if err != nil {
		return "", errors.New("生成验证码失败，请稍后重试")
	}

	cfg := config.GetConfig()
	providerName := normalizeSMSProviderName(cfg.SMS.Provider)
	if providerName == "" {
		providerName = "mock"
	}
	if isStrictProductionMode() && providerName == "mock" {
		return "", errors.New("短信服务未配置")
	}

	provider, err := GetSMSProvider()
	if err != nil {
		log.Printf("[SMS] provider init failed: %v", err)
		if isStrictProductionMode() {
			return "", errors.New("短信服务未配置")
		}
		return "", err
	}
	if err := provider.SendVerificationCode(phone, code); err != nil {
		log.Printf("[SMS] send failed: %v", err)
		if isStrictProductionMode() {
			return "", errors.New("短信发送失败，请稍后重试")
		}
		return "", err
	}

	rdb := repository.GetRedis()
	if rdb == nil {
		return "", errors.New("验证码服务未就绪")
	}

	ctx, cancel := repository.RedisContext()
	defer cancel()

	if err := rdb.Set(ctx, smsCodeKey(phone), code, smsCodeTTL).Err(); err != nil {
		return "", errors.New("验证码服务异常，请稍后重试")
	}

	smsService.RecordSent(phone, clientIP)

	if isStrictProductionMode() {
		return "", nil
	}
	return code, nil
}

// VerifySMSCode verifies a code for a phone number.
// On success it deletes the code to prevent replay.
func VerifySMSCode(phone, code string) error {
	phone = strings.TrimSpace(phone)
	code = strings.TrimSpace(code)

	if code == "" {
		return errSMSCodeRequired
	}

	// Development bypass (never allowed in strict production).
	if !isStrictProductionMode() && code == devBypassCode {
		return nil
	}

	rdb := repository.GetRedis()
	if rdb == nil {
		return errSMSNotReady
	}

	ctx, cancel := repository.RedisContext()
	defer cancel()

	expected, err := rdb.Get(ctx, smsCodeKey(phone)).Result()
	if err != nil {
		if errors.Is(err, redis.Nil) {
			return errSMSCodeExpired
		}
		return errSMSServiceError
	}

	if subtle.ConstantTimeCompare([]byte(expected), []byte(code)) != 1 {
		return errSMSCodeInvalid
	}

	_ = rdb.Del(ctx, smsCodeKey(phone)).Err()
	return nil
}
