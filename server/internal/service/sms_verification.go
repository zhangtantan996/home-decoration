package service

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"log"
	"math/big"
	"os"
	"strconv"
	"strings"
	"time"

	"home-decoration-server/internal/config"
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	"home-decoration-server/pkg/utils"

	"github.com/google/uuid"
	pq "github.com/lib/pq"
	"github.com/redis/go-redis/v9"
)

type SMSPurpose string

const (
	// Development-only bypass code. Enabled only with SMS_DEBUG_BYPASS=true and APP_ENV=local.
	devBypassCode = "123456"
	smsCodeTTL    = 5 * time.Minute

	defaultSMSCodeMaxAttempts = 5
	defaultSMSCodeLockWindow  = 15 * time.Minute

	SMSPurposeLogin            SMSPurpose = "login"
	SMSPurposeRegister         SMSPurpose = "register"
	SMSPurposeMerchantWithdraw SMSPurpose = "merchant_withdraw"
	SMSPurposeMerchantBankBind SMSPurpose = "merchant_bank_bind"
	SMSPurposeIdentityApply    SMSPurpose = "identity_apply"
	SMSPurposeChangePhone      SMSPurpose = "change_phone"
	SMSPurposeDeleteAccount    SMSPurpose = "delete_account"
)

var (
	errSMSCodeRequired      = errors.New("请输入验证码")
	errSMSCodeExpired       = errors.New("验证码已过期或不存在")
	errSMSCodeInvalid       = errors.New("验证码错误")
	errSMSCodeLocked        = errors.New("验证码错误次数过多，请稍后重试")
	errSMSNotReady          = errors.New("验证码服务未就绪")
	errSMSServiceError      = errors.New("验证码服务异常")
	errSMSPurposeInvalid    = errors.New("验证码业务场景无效")
	validSMSPurposes        = map[SMSPurpose]struct{}{SMSPurposeLogin: {}, SMSPurposeRegister: {}, SMSPurposeMerchantWithdraw: {}, SMSPurposeMerchantBankBind: {}, SMSPurposeIdentityApply: {}, SMSPurposeChangePhone: {}, SMSPurposeDeleteAccount: {}}
	smsCodeVerifyConsumeLua = redis.NewScript(`
local codeKey = KEYS[1]
local lockKey = KEYS[2]
local expectedHash = ARGV[1]
local maxAttempts = tonumber(ARGV[2])
local lockWindowMs = tonumber(ARGV[3])

if redis.call('EXISTS', lockKey) == 1 then
  return {-2, 0}
end

if redis.call('EXISTS', codeKey) == 0 then
  return {-1, 0}
end

local storedHash = redis.call('HGET', codeKey, 'h')
local attempts = tonumber(redis.call('HGET', codeKey, 'a') or '0')

if attempts >= maxAttempts then
  redis.call('SET', lockKey, '1', 'PX', lockWindowMs)
  return {-2, attempts}
end

if storedHash == expectedHash then
  redis.call('DEL', codeKey)
  redis.call('DEL', lockKey)
  return {1, attempts}
end

attempts = redis.call('HINCRBY', codeKey, 'a', 1)
if attempts >= maxAttempts then
  redis.call('SET', lockKey, '1', 'PX', lockWindowMs)
end

return {0, attempts}
`)
)

type SendSMSCodeResult struct {
	RequestID string `json:"requestId"`
	DebugCode string `json:"debugCode,omitempty"`
	DebugOnly bool   `json:"debugOnly,omitempty"`
}

func isReleaseMode() bool {
	cfg := config.GetConfig()
	return strings.EqualFold(strings.TrimSpace(cfg.Server.Mode), "release")
}

func isLocalLikeEnv() bool {
	return config.IsLocalLikeAppEnv()
}

func isStrictProductionMode() bool {
	return isReleaseMode() && !isLocalLikeEnv()
}

func isDebugBypassEnabled() bool {
	cfg := config.GetConfig()
	enabled := cfg != nil && cfg.SMS.DebugBypass
	if !enabled {
		raw := strings.TrimSpace(os.Getenv("SMS_DEBUG_BYPASS"))
		enabled = strings.EqualFold(raw, "true") || raw == "1"
	}
	return enabled && config.GetAppEnv() == config.AppEnvLocal
}

func isFixedCodeModeEnabled() bool {
	raw := strings.TrimSpace(os.Getenv("SMS_FIXED_CODE_MODE"))
	if raw != "" {
		return strings.EqualFold(raw, "true") || raw == "1"
	}

	return !isReleaseMode() || isLocalLikeEnv()
}

func fixedSMSCodeValue() string {
	code := strings.TrimSpace(os.Getenv("SMS_FIXED_CODE"))
	if code == "" {
		return devBypassCode
	}
	return code
}

func smsCodeKey(phone string, purpose SMSPurpose) string {
	return "sms:code:" + strings.TrimSpace(string(purpose)) + ":" + strings.TrimSpace(phone)
}

func smsCodeLockKey(phone string, purpose SMSPurpose) string {
	return "sms:code:lock:" + strings.TrimSpace(string(purpose)) + ":" + strings.TrimSpace(phone)
}

func smsCodeSecret() string {
	cfg := config.GetConfig()
	base := strings.TrimSpace(cfg.JWT.Secret)
	if base == "" {
		base = "home-decoration-sms-secret"
	}
	return "sms-code:v1:" + base
}

func smsCodeMaxAttempts() int {
	cfg := config.GetConfig()
	if cfg != nil && cfg.SMS.CodeMaxAttempts > 0 {
		return cfg.SMS.CodeMaxAttempts
	}
	return defaultSMSCodeMaxAttempts
}

func smsCodeLockWindow() time.Duration {
	return defaultSMSCodeLockWindow
}

func hashSMSCode(phone string, purpose SMSPurpose, code, nonce string) string {
	mac := hmac.New(sha256.New, []byte(smsCodeSecret()))
	mac.Write([]byte(strings.TrimSpace(string(purpose))))
	mac.Write([]byte("|"))
	mac.Write([]byte(strings.TrimSpace(phone)))
	mac.Write([]byte("|"))
	mac.Write([]byte(strings.TrimSpace(code)))
	mac.Write([]byte("|"))
	mac.Write([]byte(strings.TrimSpace(nonce)))
	return hex.EncodeToString(mac.Sum(nil))
}

func hashPhoneForAudit(phone string) string {
	sum := sha256.Sum256([]byte(strings.TrimSpace(phone)))
	return hex.EncodeToString(sum[:8])
}

func generateSMSNonce() (string, error) {
	b := make([]byte, 12)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

func generateSMSCode() (string, error) {
	n, err := rand.Int(rand.Reader, big.NewInt(1000000))
	if err != nil {
		return "", fmt.Errorf("generate code: %w", err)
	}
	return fmt.Sprintf("%06d", n.Int64()), nil
}

// NormalizeSMSPurpose validates the purpose value for send/verify code flows.
func NormalizeSMSPurpose(raw string) (SMSPurpose, error) {
	purpose := SMSPurpose(strings.ToLower(strings.TrimSpace(raw)))
	if _, ok := validSMSPurposes[purpose]; !ok {
		return "", errSMSPurposeInvalid
	}
	return purpose, nil
}

// ResolveSMSPurpose resolves purpose with backward-compatible fallback.
func ResolveSMSPurpose(raw string, fallback SMSPurpose) (SMSPurpose, error) {
	if strings.TrimSpace(raw) == "" {
		return fallback, nil
	}
	return NormalizeSMSPurpose(raw)
}

func validateSMSPurpose(purpose SMSPurpose) error {
	if _, ok := validSMSPurposes[purpose]; !ok {
		return errSMSPurposeInvalid
	}
	return nil
}

func smsProviderUserFacingError(err error) string {
	switch strings.ToUpper(strings.TrimSpace(ExtractSMSProviderErrorCode(err))) {
	case "ISV.BUSINESS_LIMIT_CONTROL":
		return "该手机号今日验证码发送次数已达上限，请明日再试"
	default:
		return ""
	}
}

func logSMSAudit(requestID string, purpose SMSPurpose, phone, clientIP string, templateCtx SMSTemplateContext, providerResult SMSProviderResult, status, errCode, errMsg string) {
	log.Printf(
		"[SMS-AUDIT] requestId=%s purpose=%s riskTier=%s templateKey=%s templateCode=%s phoneHash=%s ip=%s provider=%s messageId=%s providerRequestId=%s status=%s errorCode=%s error=%s",
		strings.TrimSpace(requestID),
		string(purpose),
		string(templateCtx.RiskTier),
		strings.TrimSpace(templateCtx.TemplateKey),
		strings.TrimSpace(templateCtx.TemplateCode),
		hashPhoneForAudit(phone),
		strings.TrimSpace(clientIP),
		strings.TrimSpace(providerResult.Provider),
		strings.TrimSpace(providerResult.MessageID),
		strings.TrimSpace(providerResult.RequestID),
		strings.TrimSpace(status),
		strings.TrimSpace(errCode),
		strings.TrimSpace(errMsg),
	)

	persistSMSAudit(requestID, purpose, phone, clientIP, templateCtx, providerResult, status, errCode, errMsg)
}

func trimToMax(raw string, max int) string {
	trimmed := strings.TrimSpace(raw)
	if max <= 0 || len(trimmed) <= max {
		return trimmed
	}
	return trimmed[:max]
}

type sqlStateError interface {
	SQLState() string
}

func isSMSAuditLogTableMissingError(err error) bool {
	if err == nil {
		return false
	}

	var pqErr *pq.Error
	if errors.As(err, &pqErr) {
		return string(pqErr.Code) == "42P01"
	}

	var stateErr sqlStateError
	if errors.As(err, &stateErr) {
		return strings.TrimSpace(stateErr.SQLState()) == "42P01"
	}

	errText := strings.ToLower(strings.TrimSpace(err.Error()))
	if strings.Contains(errText, "sms_audit_logs") {
		return strings.Contains(errText, "does not exist") || strings.Contains(errText, "no such table")
	}
	return false
}

func smsAuditDBErrorType(err error) string {
	if err == nil {
		return ""
	}
	if isSMSAuditLogTableMissingError(err) {
		return "missing_table"
	}
	return fmt.Sprintf("%T", err)
}

func persistSMSAudit(requestID string, purpose SMSPurpose, phone, clientIP string, templateCtx SMSTemplateContext, providerResult SMSProviderResult, status, errCode, errMsg string) {
	if repository.DB == nil {
		return
	}

	record := &model.SMSAuditLog{
		RequestID:         trimToMax(requestID, 64),
		Purpose:           trimToMax(string(purpose), 32),
		RiskTier:          trimToMax(string(templateCtx.RiskTier), 16),
		PhoneHash:         trimToMax(hashPhoneForAudit(phone), 64),
		ClientIP:          trimToMax(clientIP, 64),
		Provider:          trimToMax(providerResult.Provider, 32),
		TemplateKey:       trimToMax(firstNonEmptyString(providerResult.TemplateKey, templateCtx.TemplateKey), 64),
		TemplateCode:      trimToMax(firstNonEmptyString(providerResult.TemplateCode, templateCtx.TemplateCode), 128),
		MessageID:         trimToMax(providerResult.MessageID, 128),
		ProviderRequestID: trimToMax(providerResult.RequestID, 128),
		Status:            trimToMax(status, 32),
		ErrorCode:         trimToMax(errCode, 64),
		ErrorMessage:      trimToMax(errMsg, 500),
	}

	if err := repository.DB.Create(record).Error; err != nil {
		errorType := smsAuditDBErrorType(err)
		tableMissing := isSMSAuditLogTableMissingError(err)
		repository.RecordSMSAuditPersistFailure(requestID, providerResult.Provider, status, errorType, tableMissing, err)
		log.Printf(
			"[SMS-AUDIT] persist failed: requestId=%s provider=%s status=%s tableMissing=%t dbErrType=%s err=%v",
			strings.TrimSpace(requestID),
			strings.TrimSpace(providerResult.Provider),
			strings.TrimSpace(status),
			tableMissing,
			errorType,
			err,
		)
		return
	}

	repository.RecordSMSAuditPersistSuccess()
}

// SendSMSCode generates and sends a verification code, then stores hashed code in Redis with purpose isolation.
func SendSMSCode(phone string, purpose SMSPurpose, clientIP, captchaToken string) (*SendSMSCodeResult, error) {
	phone = strings.TrimSpace(phone)
	clientIP = strings.TrimSpace(clientIP)
	captchaToken = strings.TrimSpace(captchaToken)
	requestID := uuid.NewString()

	if err := validateSMSPurpose(purpose); err != nil {
		return nil, err
	}
	if !utils.ValidatePhone(phone) {
		return nil, errors.New("手机号格式不正确")
	}
	cfg := config.GetConfig()
	var smsCfg *config.SMSConfig
	if cfg != nil {
		smsCfg = &cfg.SMS
	}
	templateCtx, err := ResolveSMSTemplateContext(purpose, smsCfg)
	if err != nil {
		return nil, err
	}

	if isFixedCodeModeEnabled() {
		logSMSAudit(requestID, purpose, phone, clientIP, templateCtx, SMSProviderResult{
			Provider:     "fixed_code",
			TemplateKey:  templateCtx.TemplateKey,
			TemplateCode: templateCtx.TemplateCode,
		}, "sent", "", "")
		return &SendSMSCodeResult{
			RequestID: requestID,
			DebugCode: fixedSMSCodeValue(),
			DebugOnly: true,
		}, nil
	}

	if err := smsService.CanSendCode(phone, clientIP, string(purpose), templateCtx.RiskTier); err != nil {
		logSMSAudit(requestID, purpose, phone, clientIP, templateCtx, SMSProviderResult{
			Provider:     "risk_guard",
			TemplateKey:  templateCtx.TemplateKey,
			TemplateCode: templateCtx.TemplateCode,
		}, "risk_blocked", "SMS_RATE_LIMIT", err.Error())
		return nil, err
	}

	if err := verifyCaptchaToken(captchaToken, clientIP); err != nil {
		logSMSAudit(requestID, purpose, phone, clientIP, templateCtx, SMSProviderResult{
			Provider:     "captcha",
			TemplateKey:  templateCtx.TemplateKey,
			TemplateCode: templateCtx.TemplateCode,
		}, "captcha_failed", "CAPTCHA_VERIFY_FAILED", err.Error())
		return nil, err
	}

	code, err := generateSMSCode()
	if err != nil {
		return nil, errors.New("生成验证码失败，请稍后重试")
	}
	nonce, err := generateSMSNonce()
	if err != nil {
		return nil, errors.New("生成验证码失败，请稍后重试")
	}
	codeHash := hashSMSCode(phone, purpose, code, nonce)

	providerCfg := config.GetConfig()
	providerName := normalizeSMSProviderName(providerCfg.SMS.Provider)
	if providerName == "" {
		providerName = "mock"
	}
	if isStrictProductionMode() && providerName == "mock" {
		return nil, errors.New("短信服务未配置")
	}

	provider, err := GetSMSProvider()
	if err != nil {
		log.Printf("[SMS] provider init failed: %v", err)
		if isStrictProductionMode() {
			return nil, errors.New("短信服务未配置")
		}
		return nil, err
	}

	providerResult, err := provider.SendVerificationCode(SMSProviderRequest{
		Phone:    phone,
		Code:     code,
		Template: templateCtx,
	})
	providerResult.TemplateKey = firstNonEmptyString(providerResult.TemplateKey, templateCtx.TemplateKey)
	providerResult.TemplateCode = firstNonEmptyString(providerResult.TemplateCode, templateCtx.TemplateCode)
	if err != nil {
		errCode := ExtractSMSProviderErrorCode(err)
		logSMSAudit(requestID, purpose, phone, clientIP, templateCtx, providerResult, "send_failed", errCode, err.Error())
		if friendly := smsProviderUserFacingError(err); friendly != "" {
			return nil, errors.New(friendly)
		}
		if isStrictProductionMode() {
			return nil, errors.New("短信发送失败，请稍后重试")
		}
		return nil, err
	}

	rdb := repository.GetRedis()
	if rdb == nil {
		return nil, errors.New("验证码服务未就绪")
	}

	ctx, cancel := repository.RedisContext()
	defer cancel()

	codeKey := smsCodeKey(phone, purpose)
	lockKey := smsCodeLockKey(phone, purpose)
	pipe := rdb.TxPipeline()
	pipe.Del(ctx, lockKey)
	pipe.HSet(ctx, codeKey, map[string]interface{}{
		"h": codeHash,
		"n": nonce,
		"a": 0,
	})
	pipe.Expire(ctx, codeKey, smsCodeTTL)
	if _, err := pipe.Exec(ctx); err != nil {
		logSMSAudit(requestID, purpose, phone, clientIP, templateCtx, providerResult, "store_failed", "REDIS_WRITE", err.Error())
		return nil, errors.New("验证码服务异常，请稍后重试")
	}

	smsService.RecordSent(phone, clientIP, string(purpose), templateCtx.RiskTier)
	logSMSAudit(requestID, purpose, phone, clientIP, templateCtx, providerResult, "sent", "", "")

	result := &SendSMSCodeResult{
		RequestID: requestID,
	}
	if isDebugBypassEnabled() {
		result.DebugCode = code
		result.DebugOnly = true
	}
	return result, nil
}

// VerifySMSCode verifies a code for a phone number and purpose, then atomically consumes it on success.
func VerifySMSCode(phone string, purpose SMSPurpose, code string) error {
	phone = strings.TrimSpace(phone)
	code = strings.TrimSpace(code)

	if err := validateSMSPurpose(purpose); err != nil {
		return err
	}
	if code == "" {
		return errSMSCodeRequired
	}

	if isFixedCodeModeEnabled() {
		if code == fixedSMSCodeValue() {
			return nil
		}
		return errSMSCodeInvalid
	}

	if isDebugBypassEnabled() && code == devBypassCode {
		return nil
	}

	rdb := repository.GetRedis()
	if rdb == nil {
		return errSMSNotReady
	}

	ctx, cancel := repository.RedisContext()
	defer cancel()

	codeKey := smsCodeKey(phone, purpose)
	lockKey := smsCodeLockKey(phone, purpose)

	nonceAndHash, err := rdb.HMGet(ctx, codeKey, "h", "n").Result()
	if err != nil {
		return errSMSServiceError
	}

	if len(nonceAndHash) < 2 {
		return errSMSCodeExpired
	}

	storedHash := redisStringValue(nonceAndHash[0])
	nonce := redisStringValue(nonceAndHash[1])
	if storedHash == "" || nonce == "" {
		locked, lockErr := rdb.Exists(ctx, lockKey).Result()
		if lockErr == nil && locked > 0 {
			return errSMSCodeLocked
		}
		return errSMSCodeExpired
	}

	submittedHash := hashSMSCode(phone, purpose, code, nonce)
	rawResult, err := smsCodeVerifyConsumeLua.Run(
		ctx,
		rdb,
		[]string{codeKey, lockKey},
		submittedHash,
		smsCodeMaxAttempts(),
		int(smsCodeLockWindow().Milliseconds()),
	).Result()
	if err != nil {
		return errSMSServiceError
	}

	resultSlice, ok := rawResult.([]interface{})
	if !ok || len(resultSlice) < 1 {
		return errSMSServiceError
	}

	status, ok := int64FromRedisValue(resultSlice[0])
	if !ok {
		return errSMSServiceError
	}

	switch status {
	case 1:
		return nil
	case -2:
		return errSMSCodeLocked
	case -1:
		return errSMSCodeExpired
	case 0:
		if len(resultSlice) >= 2 {
			if attempts, attemptsOK := int64FromRedisValue(resultSlice[1]); attemptsOK && attempts >= int64(smsCodeMaxAttempts()) {
				return errSMSCodeLocked
			}
		}
		return errSMSCodeInvalid
	default:
		return errSMSServiceError
	}
}

func redisStringValue(v interface{}) string {
	switch val := v.(type) {
	case string:
		return strings.TrimSpace(val)
	case []byte:
		return strings.TrimSpace(string(val))
	default:
		return ""
	}
}

func int64FromRedisValue(v interface{}) (int64, bool) {
	switch val := v.(type) {
	case int64:
		return val, true
	case int:
		return int64(val), true
	case string:
		parsed, err := strconv.ParseInt(strings.TrimSpace(val), 10, 64)
		if err != nil {
			return 0, false
		}
		return parsed, true
	default:
		return 0, false
	}
}
