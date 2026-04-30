package service

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"home-decoration-server/internal/config"
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	"home-decoration-server/pkg/utils"

	"gorm.io/gorm"
)

const (
	RealNameRequiredErrorCode = "REAL_NAME_REQUIRED"

	userVerificationStatusPending  int8 = 0
	userVerificationStatusVerified int8 = 1
	userVerificationStatusFailed   int8 = 2
)

var ErrRealNameRequired = errors.New("支付前请先完成实名认证")

type UserVerificationView struct {
	Status         string `json:"status"`
	RealNameMasked string `json:"realNameMasked,omitempty"`
	IDCardLast4    string `json:"idCardLast4,omitempty"`
	VerifiedAt     string `json:"verifiedAt,omitempty"`
	RejectReason   string `json:"rejectReason,omitempty"`
}

type RealNameVerificationResult struct {
	Passed            bool
	Provider          string
	ProviderRequestID string
	Reason            string
	Unavailable       bool
}

type RealNameVerifier interface {
	Verify(realName, idCard string) RealNameVerificationResult
}

var resolveRealNameVerifierFunc = resolveRealNameVerifier

type localRealNameVerifier struct{}

func (localRealNameVerifier) Verify(realName, idCard string) RealNameVerificationResult {
	if !utils.ValidateRealName(realName) {
		return RealNameVerificationResult{Provider: "fake", Reason: "姓名格式不正确"}
	}
	if !utils.ValidateIDCard(idCard) {
		return RealNameVerificationResult{Provider: "fake", Reason: "身份证号格式不正确"}
	}
	return RealNameVerificationResult{
		Passed:            true,
		Provider:          "fake",
		ProviderRequestID: fmt.Sprintf("local-%d", time.Now().UnixNano()),
	}
}

type unavailableRealNameVerifier struct {
	provider string
}

func (v unavailableRealNameVerifier) Verify(_, _ string) RealNameVerificationResult {
	return RealNameVerificationResult{
		Provider:    strings.TrimSpace(v.provider),
		Reason:      "实名核验服务暂不可用，请稍后重试",
		Unavailable: true,
	}
}

type tencentRealNameVerifier struct {
	secretID  string
	secretKey string
	endpoint  string
	host      string
	client    *http.Client
}

type tencentIDCardVerificationResponse struct {
	Response struct {
		Result      string `json:"Result"`
		Description string `json:"Description"`
		RequestID   string `json:"RequestId"`
		Error       *struct {
			Code    string `json:"Code"`
			Message string `json:"Message"`
		} `json:"Error"`
	} `json:"Response"`
}

func newTencentRealNameVerifier() RealNameVerifier {
	secretID := strings.TrimSpace(os.Getenv("TENCENT_REAL_NAME_SECRET_ID"))
	secretKey := strings.TrimSpace(os.Getenv("TENCENT_REAL_NAME_SECRET_KEY"))
	if secretID == "" || secretKey == "" {
		return unavailableRealNameVerifier{provider: "tencent"}
	}
	endpoint := strings.TrimSpace(os.Getenv("TENCENT_REAL_NAME_ENDPOINT"))
	if endpoint == "" {
		endpoint = "https://faceid.tencentcloudapi.com"
	}
	parsedEndpoint, err := url.Parse(endpoint)
	host := "faceid.tencentcloudapi.com"
	if err == nil && strings.TrimSpace(parsedEndpoint.Host) != "" {
		host = strings.TrimSpace(parsedEndpoint.Host)
	}
	return tencentRealNameVerifier{
		secretID:  secretID,
		secretKey: secretKey,
		endpoint:  endpoint,
		host:      host,
		client:    &http.Client{Timeout: 8 * time.Second},
	}
}

func tencentHMACSHA256(key []byte, value string) []byte {
	mac := hmac.New(sha256.New, key)
	_, _ = mac.Write([]byte(value))
	return mac.Sum(nil)
}

func tencentSHA256Hex(value []byte) string {
	sum := sha256.Sum256(value)
	return hex.EncodeToString(sum[:])
}

func (v tencentRealNameVerifier) authorization(payload []byte, timestamp int64) string {
	const (
		algorithm     = "TC3-HMAC-SHA256"
		service       = "faceid"
		signedHeaders = "content-type;host;x-tc-action"
	)
	date := time.Unix(timestamp, 0).UTC().Format("2006-01-02")
	canonicalHeaders := fmt.Sprintf("content-type:application/json; charset=utf-8\nhost:%s\nx-tc-action:idcardverification\n", v.host)
	canonicalRequest := strings.Join([]string{
		http.MethodPost,
		"/",
		"",
		canonicalHeaders,
		signedHeaders,
		tencentSHA256Hex(payload),
	}, "\n")
	credentialScope := fmt.Sprintf("%s/%s/tc3_request", date, service)
	stringToSign := strings.Join([]string{
		algorithm,
		fmt.Sprintf("%d", timestamp),
		credentialScope,
		tencentSHA256Hex([]byte(canonicalRequest)),
	}, "\n")
	secretDate := tencentHMACSHA256([]byte("TC3"+v.secretKey), date)
	secretService := tencentHMACSHA256(secretDate, service)
	secretSigning := tencentHMACSHA256(secretService, "tc3_request")
	signature := hex.EncodeToString(tencentHMACSHA256(secretSigning, stringToSign))
	return fmt.Sprintf(
		"%s Credential=%s/%s, SignedHeaders=%s, Signature=%s",
		algorithm,
		v.secretID,
		credentialScope,
		signedHeaders,
		signature,
	)
}

func (v tencentRealNameVerifier) Verify(realName, idCard string) RealNameVerificationResult {
	payload, err := json.Marshal(map[string]string{
		"IdCard": idCard,
		"Name":   realName,
	})
	if err != nil {
		return RealNameVerificationResult{Provider: "tencent", Reason: "实名核验服务暂不可用，请稍后重试", Unavailable: true}
	}
	timestamp := time.Now().Unix()
	req, err := http.NewRequest(http.MethodPost, v.endpoint, bytes.NewReader(payload))
	if err != nil {
		return RealNameVerificationResult{Provider: "tencent", Reason: "实名核验服务暂不可用，请稍后重试", Unavailable: true}
	}
	req.Header.Set("Authorization", v.authorization(payload, timestamp))
	req.Header.Set("Content-Type", "application/json; charset=utf-8")
	req.Header.Set("Host", v.host)
	req.Header.Set("X-TC-Action", "IdCardVerification")
	req.Header.Set("X-TC-Version", "2018-03-01")
	req.Header.Set("X-TC-Timestamp", fmt.Sprintf("%d", timestamp))

	resp, err := v.client.Do(req)
	if err != nil {
		return RealNameVerificationResult{Provider: "tencent", Reason: "实名核验服务暂不可用，请稍后重试", Unavailable: true}
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return RealNameVerificationResult{Provider: "tencent", Reason: "实名核验服务暂不可用，请稍后重试", Unavailable: true}
	}
	var parsed tencentIDCardVerificationResponse
	if err := json.Unmarshal(body, &parsed); err != nil {
		return RealNameVerificationResult{Provider: "tencent", Reason: "实名核验服务暂不可用，请稍后重试", Unavailable: true}
	}
	response := parsed.Response
	if response.Error != nil {
		return RealNameVerificationResult{
			Provider:          "tencent",
			ProviderRequestID: response.RequestID,
			Reason:            "实名核验服务暂不可用，请稍后重试",
			Unavailable:       true,
		}
	}
	if response.Result == "0" {
		return RealNameVerificationResult{
			Passed:            true,
			Provider:          "tencent",
			ProviderRequestID: response.RequestID,
		}
	}
	reason := strings.TrimSpace(response.Description)
	if reason == "" {
		reason = "姓名与身份证号不一致，请核对后重试"
	}
	return RealNameVerificationResult{
		Provider:          "tencent",
		ProviderRequestID: response.RequestID,
		Reason:            reason,
	}
}

func resolveRealNameVerifier() RealNameVerifier {
	provider := strings.ToLower(strings.TrimSpace(os.Getenv("USER_REAL_NAME_VERIFY_PROVIDER")))
	if provider == "" {
		if config.IsLocalLikeAppEnv() {
			return localRealNameVerifier{}
		}
		return newTencentRealNameVerifier()
	}
	if provider == "fake" || provider == "local" {
		if config.IsLocalLikeAppEnv() {
			return localRealNameVerifier{}
		}
		return unavailableRealNameVerifier{provider: provider}
	}
	if provider == "tencent" {
		return newTencentRealNameVerifier()
	}
	if provider == "aliyun" {
		return newAliyunRealNameVerifier()
	}
	return unavailableRealNameVerifier{provider: provider}
}

func normalizeIDCard(idCard string) string {
	return strings.ToUpper(strings.ReplaceAll(strings.TrimSpace(idCard), " ", ""))
}

func maskRealName(realName string) string {
	runes := []rune(strings.TrimSpace(realName))
	if len(runes) == 0 {
		return ""
	}
	if len(runes) == 1 {
		return string(runes)
	}
	return string(runes[:1]) + strings.Repeat("*", len(runes)-1)
}

func idCardLast4(idCard string) string {
	if len(idCard) <= 4 {
		return idCard
	}
	return idCard[len(idCard)-4:]
}

func hashIDCard(idCard string) string {
	sum := sha256.Sum256([]byte(idCard))
	return hex.EncodeToString(sum[:])
}

func truncateVerificationReason(reason string) string {
	runes := []rune(strings.TrimSpace(reason))
	if len(runes) <= 200 {
		return string(runes)
	}
	return string(runes[:200])
}

func mapVerificationStatus(status int8) string {
	switch status {
	case userVerificationStatusVerified:
		return "verified"
	case userVerificationStatusFailed:
		return "failed"
	case userVerificationStatusPending:
		return "pending"
	default:
		return "unverified"
	}
}

func BuildUserVerificationView(v *model.UserVerification) UserVerificationView {
	if v == nil {
		return UserVerificationView{Status: "unverified"}
	}
	view := UserVerificationView{
		Status:         mapVerificationStatus(v.Status),
		RealNameMasked: strings.TrimSpace(v.RealNameMasked),
		IDCardLast4:    strings.TrimSpace(v.IDCardLast4),
		RejectReason:   strings.TrimSpace(v.RejectReason),
	}
	if view.RealNameMasked == "" {
		view.RealNameMasked = maskRealName(v.RealName)
	}
	if view.IDCardLast4 == "" {
		view.IDCardLast4 = idCardLast4(normalizeIDCard(v.IDCard))
	}
	if v.VerifiedAt != nil {
		view.VerifiedAt = v.VerifiedAt.Format(time.RFC3339)
	}
	return view
}

func (s *UserSettingsService) SubmitRealNameVerification(userID uint64, realName, idCard string) (*UserVerificationView, error) {
	return s.SubmitRealNameVerificationForClient(userID, realName, idCard, "")
}

func (s *UserSettingsService) SubmitRealNameVerificationForClient(userID uint64, realName, idCard, clientIP string) (*UserVerificationView, error) {
	normalizedName := strings.TrimSpace(realName)
	normalizedIDCard := normalizeIDCard(idCard)
	if !utils.ValidateRealName(normalizedName) {
		return nil, errors.New("请填写真实姓名")
	}
	if !utils.ValidateIDCard(normalizedIDCard) {
		return nil, errors.New("身份证号格式不正确")
	}

	idHash := hashIDCard(normalizedIDCard)
	inputHash := hashVerificationValue(normalizedName, normalizedIDCard)

	var existing model.UserVerification
	if err := repository.DB.Where("user_id = ?", userID).Order("updated_at DESC").First(&existing).Error; err == nil {
		if existing.Status == userVerificationStatusVerified {
			view := BuildUserVerificationView(&existing)
			return &view, nil
		}
	}

	if err := checkPersonVerificationRisk(userID, idHash, inputHash, clientIP); err != nil {
		return nil, err
	}

	result := resolveRealNameVerifierFunc().Verify(normalizedName, normalizedIDCard)
	recordPersonVerificationAttempt(userID, idHash, inputHash, clientIP, result.Passed, result.Unavailable)
	status := userVerificationStatusFailed
	rejectReason := truncateVerificationReason(result.Reason)
	var verifiedAt *time.Time
	if result.Passed {
		status = userVerificationStatusVerified
		rejectReason = ""
		now := time.Now()
		verifiedAt = &now
	}
	if rejectReason == "" && !result.Passed {
		rejectReason = "实名认证未通过，请核对后重试"
	}

	record := model.UserVerification{
		UserID:            userID,
		RealName:          maskRealName(normalizedName),
		RealNameMasked:    maskRealName(normalizedName),
		IDCard:            idCardLast4(normalizedIDCard),
		IDCardLast4:       idCardLast4(normalizedIDCard),
		IDCardHash:        idHash,
		Status:            status,
		VerifyMethod:      "id_card_two_factor",
		Provider:          strings.TrimSpace(result.Provider),
		ProviderRequestID: strings.TrimSpace(result.ProviderRequestID),
		RejectReason:      rejectReason,
		VerifiedAt:        verifiedAt,
	}

	err := repository.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("user_id = ?", userID).Delete(&model.UserVerification{}).Error; err != nil {
			return err
		}
		return tx.Create(&record).Error
	})
	if err != nil {
		return nil, err
	}

	view := BuildUserVerificationView(&record)
	return &view, nil
}

func IsUserRealNameVerified(userID uint64) (bool, error) {
	if userID == 0 {
		return false, nil
	}
	var count int64
	err := repository.DB.Model(&model.UserVerification{}).
		Where("user_id = ? AND status = ?", userID, userVerificationStatusVerified).
		Count(&count).Error
	return count > 0, err
}

func RequireUserVerifiedForMoneyAction(userID uint64) error {
	verified, err := IsUserRealNameVerified(userID)
	if err != nil {
		return fmt.Errorf("查询实名认证状态失败: %w", err)
	}
	if !verified {
		return ErrRealNameRequired
	}
	return nil
}
