package service

// MockSMSProvider is a no-op provider for development/testing.
// It pretends SMS delivery succeeded without contacting any external service.
type MockSMSProvider struct{}

func (p *MockSMSProvider) SendVerificationCode(_ string, _ string) (SMSProviderResult, error) {
	return SMSProviderResult{Provider: "mock"}, nil
}
