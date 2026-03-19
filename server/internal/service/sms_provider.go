package service

import (
	"errors"
	"fmt"
	"strings"
	"sync"

	"home-decoration-server/internal/config"
)

// SMSProvider sends verification codes (e.g. via Aliyun SMS).
// It should NOT store codes; storage is handled separately (Redis).
type SMSProvider interface {
	SendVerificationCode(req SMSProviderRequest) (SMSProviderResult, error)
}

type SMSProviderRequest struct {
	Phone    string
	Code     string
	Template SMSTemplateContext
}

// SMSProviderResult captures provider-level metadata for observability/auditing.
type SMSProviderResult struct {
	Provider     string
	MessageID    string
	RequestID    string
	ErrorCode    string
	TemplateKey  string
	TemplateCode string
}

// SMSProviderError is a typed provider error that can be safely logged by code.
type SMSProviderError struct {
	Code    string
	Message string
}

func (e *SMSProviderError) Error() string {
	msg := strings.TrimSpace(e.Message)
	if msg == "" {
		msg = "sms provider error"
	}
	if strings.TrimSpace(e.Code) == "" {
		return msg
	}
	return fmt.Sprintf("%s (%s)", msg, strings.TrimSpace(e.Code))
}

// ExtractSMSProviderErrorCode returns provider-specific error code when available.
func ExtractSMSProviderErrorCode(err error) string {
	if err == nil {
		return ""
	}
	var providerErr *SMSProviderError
	if errors.As(err, &providerErr) {
		return strings.TrimSpace(providerErr.Code)
	}
	return ""
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
