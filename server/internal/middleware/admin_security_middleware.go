package middleware

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"strings"

	"home-decoration-server/internal/config"
	"home-decoration-server/internal/service"
	"home-decoration-server/pkg/response"

	"github.com/gin-gonic/gin"
)

var defaultAdminReasonFields = []string{"reason", "remark", "note", "adminNotes", "disabledReason"}

func AdminNetworkGate() gin.HandlerFunc {
	return func(c *gin.Context) {
		securitySvc := service.NewAdminSecurityService()
		if !securitySvc.IsAPIIPEnforced() || config.IsLocalLikeAppEnv() {
			c.Next()
			return
		}
		clientIP := ExtractRealClientIP(c)
		allowed, err := securitySvc.IsIPAllowed(clientIP)
		if err != nil {
			response.Error(c, http.StatusForbidden, "管理员网络访问策略未就绪")
			c.Abort()
			return
		}
		if !allowed {
			response.Error(c, http.StatusForbidden, "当前网络不允许访问管理接口")
			c.Abort()
			return
		}
		c.Set("admin_client_ip", clientIP)
		c.Next()
	}
}

func RequireActiveAdminSession() gin.HandlerFunc {
	return func(c *gin.Context) {
		stage, _ := c.Get("admin_login_stage")
		if stageStr, _ := stage.(string); strings.TrimSpace(stageStr) != "" && stageStr != service.AdminLoginStageActive {
			response.Error(c, http.StatusForbidden, "请先完成管理员安全初始化")
			c.Abort()
			return
		}
		c.Next()
	}
}

func RequireAdminReauth() gin.HandlerFunc {
	return func(c *gin.Context) {
		adminID := c.GetUint64("admin_id")
		sid, _ := c.Get("admin_sid")
		proof := strings.TrimSpace(c.GetHeader("X-Admin-Reauth"))
		if proof == "" {
			proof = extractStringFieldFromRequestBody(c, "recentReauthProof")
		}
		if err := service.NewAdminSecurityService().ValidateReauthProof(adminID, stringifyContextValue(sid), proof); err != nil {
			response.Error(c, http.StatusForbidden, "缺少有效的再认证凭证")
			c.Abort()
			return
		}
		c.Set("admin_reauth_proof", proof)
		c.Next()
	}
}

func RequireAdminReason(fields ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		candidates := fields
		if len(candidates) == 0 {
			candidates = defaultAdminReasonFields
		}
		reason := extractStringFieldFromRequestBody(c, candidates...)
		if strings.TrimSpace(reason) == "" {
			response.BadRequest(c, "请填写操作原因")
			c.Abort()
			return
		}
		c.Set("admin_reason", reason)
		c.Next()
	}
}

func ExtractRealClientIP(c *gin.Context) string {
	for _, raw := range []string{c.ClientIP(), c.GetHeader("X-Forwarded-For"), c.GetHeader("X-Real-IP")} {
		if strings.TrimSpace(raw) == "" {
			continue
		}
		parts := strings.Split(raw, ",")
		for _, part := range parts {
			candidate := strings.TrimSpace(part)
			if candidate != "" {
				return candidate
			}
		}
	}
	return ""
}

func extractStringFieldFromRequestBody(c *gin.Context, fields ...string) string {
	if c == nil || c.Request == nil || c.Request.Body == nil {
		return ""
	}
	contentType := c.ContentType()
	if contentType != "application/json" && !strings.HasPrefix(contentType, "application/json") {
		return ""
	}
	rawBody, err := io.ReadAll(c.Request.Body)
	if err != nil {
		return ""
	}
	c.Request.Body = io.NopCloser(bytes.NewBuffer(rawBody))
	if len(rawBody) == 0 {
		return ""
	}
	var payload map[string]interface{}
	if err := json.Unmarshal(rawBody, &payload); err != nil {
		return ""
	}
	for _, field := range fields {
		if value, ok := payload[field]; ok {
			if text, ok := value.(string); ok {
				return strings.TrimSpace(text)
			}
		}
	}
	return ""
}

func stringifyContextValue(value interface{}) string {
	if value == nil {
		return ""
	}
	if text, ok := value.(string); ok {
		return strings.TrimSpace(text)
	}
	return ""
}
