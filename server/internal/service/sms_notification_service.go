package service

import (
	"fmt"
	"strings"
	"time"

	"home-decoration-server/internal/config"
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
)

const (
	smsBusinessPurposeMerchantApplyApproved = "merchant_apply_approved"
	smsBusinessPurposeMerchantApplyRejected = "merchant_apply_rejected"
)

func SendMerchantApplicationReviewSMS(phone string, approved bool, reason string) error {
	phone = strings.TrimSpace(phone)
	if phone == "" {
		return nil
	}

	cfg := config.GetConfig()
	if cfg == nil {
		return nil
	}

	provider, err := GetSMSProvider()
	if err != nil {
		return err
	}
	sender, ok := provider.(SMSMessageProvider)
	if !ok {
		return fmt.Errorf("当前短信服务商不支持业务短信")
	}

	templateCode := strings.TrimSpace(cfg.SMS.TemplateCodeMerchantApplyRejected)
	templateKey := smsBusinessPurposeMerchantApplyRejected
	params := map[string]string{
		"status": "未通过",
		"reason": strings.TrimSpace(reason),
	}
	if approved {
		templateCode = strings.TrimSpace(cfg.SMS.TemplateCodeMerchantApplyApproved)
		templateKey = smsBusinessPurposeMerchantApplyApproved
		params = map[string]string{
			"status": "通过",
		}
	}

	result, sendErr := sender.SendTemplateMessage(SMSTemplateMessageRequest{
		Phone:        phone,
		TemplateKey:  templateKey,
		TemplateCode: templateCode,
		Params:       params,
	})
	persistBusinessSMSAudit(templateKey, phone, result, sendErr)
	return sendErr
}

func persistBusinessSMSAudit(purpose string, phone string, providerResult SMSProviderResult, sendErr error) {
	if repository.DB == nil {
		return
	}
	status := "success"
	errCode := ""
	errMsg := ""
	if sendErr != nil {
		status = "failed"
		errCode = ExtractSMSProviderErrorCode(sendErr)
		errMsg = strings.TrimSpace(sendErr.Error())
	}
	requestID := strings.TrimSpace(providerResult.RequestID)
	if requestID == "" {
		requestID = fmt.Sprintf("biz-sms-%d", time.Now().UnixNano())
	}
	record := &model.SMSAuditLog{
		RequestID:         trimToMax(requestID, 64),
		Purpose:           trimToMax(purpose, 32),
		RiskTier:          "business",
		PhoneHash:         trimToMax(hashPhoneForAudit(phone), 64),
		ClientIP:          "system",
		Provider:          trimToMax(providerResult.Provider, 32),
		TemplateKey:       trimToMax(firstNonEmptyString(providerResult.TemplateKey, purpose), 64),
		TemplateCode:      trimToMax(providerResult.TemplateCode, 128),
		MessageID:         trimToMax(providerResult.MessageID, 128),
		ProviderRequestID: trimToMax(providerResult.RequestID, 128),
		Status:            trimToMax(status, 32),
		ErrorCode:         trimToMax(errCode, 64),
		ErrorMessage:      trimToMax(errMsg, 500),
	}
	_ = repository.DB.Create(record).Error
}
