package service

import (
	"fmt"
	"strings"
	"sync"

	"home-decoration-server/internal/config"
)

// SMSProvider sends verification codes (e.g. via Aliyun SMS).
// It should NOT store codes; storage is handled separately (Redis).
type SMSProvider interface {
	SendVerificationCode(phone, code string) error
}

var (
	smsProviderOnce sync.Once
	smsProvider     SMSProvider
	smsProviderErr  error
)

func normalizeSMSProviderName(raw string) string {
	return strings.ToLower(strings.TrimSpace(raw))
}

// GetSMSProvider returns the configured SMS provider singleton.
// Defaults to "mock" provider unless explicitly configured.
func GetSMSProvider() (SMSProvider, error) {
	smsProviderOnce.Do(func() {
		cfg := config.GetConfig()
		provider := normalizeSMSProviderName(cfg.SMS.Provider)
		if provider == "" {
			provider = "mock"
		}

		switch provider {
		case "mock":
			smsProvider = &MockSMSProvider{}
			return
		case "aliyun":
			smsProvider, smsProviderErr = NewAliyunSMSProvider(cfg.SMS)
			return
		default:
			smsProviderErr = fmt.Errorf("unknown sms provider: %s", provider)
			return
		}
	})
	return smsProvider, smsProviderErr
}
