package service

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"home-decoration-server/internal/config"
)

type captchaVerifyResponse struct {
	Success    bool     `json:"success"`
	Score      float64  `json:"score"`
	ErrorCodes []string `json:"error-codes"`
}

func defaultCaptchaVerifyURL(provider string) string {
	switch strings.ToLower(strings.TrimSpace(provider)) {
	case "turnstile":
		return "https://challenges.cloudflare.com/turnstile/v0/siteverify"
	case "hcaptcha":
		return "https://hcaptcha.com/siteverify"
	case "recaptcha":
		return "https://www.google.com/recaptcha/api/siteverify"
	default:
		return ""
	}
}

func verifyCaptchaToken(captchaToken, clientIP string) error {
	cfg := config.GetConfig()
	if cfg == nil || !cfg.SMS.CaptchaEnabled {
		return nil
	}

	token := strings.TrimSpace(captchaToken)
	if token == "" {
		return errors.New("请先完成安全验证")
	}

	provider := strings.ToLower(strings.TrimSpace(cfg.SMS.CaptchaProvider))
	if provider == "" {
		provider = "turnstile"
	}
	verifyURL := strings.TrimSpace(cfg.SMS.CaptchaVerifyURL)
	if verifyURL == "" {
		verifyURL = defaultCaptchaVerifyURL(provider)
	}
	if verifyURL == "" {
		return errors.New("安全验证服务未配置")
	}

	secret := strings.TrimSpace(cfg.SMS.CaptchaSecretKey)
	if secret == "" {
		return errors.New("安全验证服务未配置")
	}

	form := url.Values{}
	form.Set("secret", secret)
	form.Set("response", token)
	trimmedIP := strings.TrimSpace(clientIP)
	if trimmedIP != "" {
		form.Set("remoteip", trimmedIP)
	}

	timeoutMs := cfg.SMS.CaptchaTimeoutMs
	if timeoutMs <= 0 {
		timeoutMs = 3000
	}
	client := &http.Client{Timeout: time.Duration(timeoutMs) * time.Millisecond}
	resp, err := client.PostForm(verifyURL, form)
	if err != nil {
		return errors.New("安全验证服务异常，请稍后重试")
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return errors.New("安全验证失败，请稍后重试")
	}

	var verifyResp captchaVerifyResponse
	if err := json.NewDecoder(resp.Body).Decode(&verifyResp); err != nil {
		return errors.New("安全验证失败，请稍后重试")
	}
	if !verifyResp.Success {
		errCode := strings.Join(verifyResp.ErrorCodes, ",")
		if errCode != "" {
			return fmt.Errorf("安全验证未通过，请重试(%s)", errCode)
		}
		return errors.New("安全验证未通过，请重试")
	}

	minScore := cfg.SMS.CaptchaMinScore
	if minScore > 0 && verifyResp.Score > 0 && verifyResp.Score < minScore {
		return errors.New("安全验证分值不足，请重试")
	}

	return nil
}
