package service

import "strings"

// MockSMSProvider is a no-op provider for development/testing.
// It pretends SMS delivery succeeded without contacting any external service.
type MockSMSProvider struct{}

func (p *MockSMSProvider) SendVerificationCode(req SMSProviderRequest) (SMSProviderResult, error) {
	return SMSProviderResult{
		Provider:     "mock",
		TemplateKey:  strings.TrimSpace(req.Template.TemplateKey),
		TemplateCode: strings.TrimSpace(req.Template.TemplateCode),
	}, nil
}

func (p *MockSMSProvider) SendTemplateMessage(req SMSTemplateMessageRequest) (SMSProviderResult, error) {
	return SMSProviderResult{
		Provider:     "mock",
		TemplateKey:  strings.TrimSpace(req.TemplateKey),
		TemplateCode: strings.TrimSpace(req.TemplateCode),
	}, nil
}
