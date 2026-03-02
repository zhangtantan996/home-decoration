package middleware

import (
	"bytes"
	"encoding/json"
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	"io"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

type auditLogEntry struct {
	operatorType string
	operatorID   uint64
	action       string
	resource     string
	requestBody  string
	clientIP     string
	userAgent    string
	statusCode   int
	durationMs   int64
}

// AuditLogger 敏感操作审计日志中间件
// 记录关键业务操作，便于事后追溯和安全审计
func AuditLogger() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 只记录敏感操作（POST/PUT/DELETE）
		if c.Request.Method == "GET" {
			c.Next()
			return
		}

		// 检查是否是需要审计的路径
		path := c.Request.URL.Path
		if !shouldAudit(path) {
			c.Next()
			return
		}

		// 记录请求开始时间
		startTime := time.Now()

		// 读取请求体（需要重新写回）
		var requestBody string
		if c.Request.Body != nil {
			bodyBytes, _ := io.ReadAll(c.Request.Body)
			requestBody = string(bodyBytes)
			// 脱敏敏感字段
			requestBody = maskSensitiveFields(requestBody)
			c.Request.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))
		}

		// 处理请求
		c.Next()

		// 记录审计日志
		entry := buildAuditLogEntry(c, path, requestBody, startTime)
		go saveAuditLog(entry)
	}
}

// shouldAudit 判断是否需要审计的路径
func shouldAudit(path string) bool {
	// 商家敏感操作
	auditPaths := []string{
		"/merchant/withdraw",           // 提现
		"/merchant/bank-accounts",      // 银行账户
		"/merchant/apply",              // 入驻申请
		"/admin/merchant-applications", // Admin审核
	}

	for _, p := range auditPaths {
		if strings.Contains(path, p) {
			return true
		}
	}
	return false
}

// maskSensitiveFields 脱敏敏感字段
func maskSensitiveFields(body string) string {
	if body == "" {
		return body
	}

	// 尝试解析JSON
	var data map[string]interface{}
	if err := json.Unmarshal([]byte(body), &data); err != nil {
		return body
	}

	// 需要脱敏的字段
	sensitiveFields := []string{
		"idCardNo", "accountNo", "password", "code",
	}

	for _, field := range sensitiveFields {
		if v, ok := data[field]; ok {
			if str, isStr := v.(string); isStr && len(str) > 4 {
				data[field] = str[:2] + "****" + str[len(str)-2:]
			}
		}
	}

	maskedBody, _ := json.Marshal(data)
	return string(maskedBody)
}

func buildAuditLogEntry(c *gin.Context, path, requestBody string, startTime time.Time) auditLogEntry {
	// 获取用户信息
	userID := c.GetUint64("userId")
	providerID := c.GetUint64("providerId")
	adminID := c.GetUint64("adminId")

	// 确定操作者类型
	var operatorType string
	var operatorID uint64
	if adminID > 0 {
		operatorType = "admin"
		operatorID = adminID
	} else if providerID > 0 {
		operatorType = "merchant"
		operatorID = providerID
	} else if userID > 0 {
		operatorType = "user"
		operatorID = userID
	} else {
		operatorType = "anonymous"
		operatorID = 0
	}

	return auditLogEntry{
		operatorType: operatorType,
		operatorID:   operatorID,
		action:       c.Request.Method + " " + path,
		resource:     extractResource(path),
		requestBody:  truncateString(requestBody, 2000),
		clientIP:     c.ClientIP(),
		userAgent:    truncateString(c.Request.UserAgent(), 500),
		statusCode:   c.Writer.Status(),
		durationMs:   time.Since(startTime).Milliseconds(),
	}
}

// saveAuditLog 保存审计日志（异步，不要依赖 gin.Context 生命周期）
func saveAuditLog(entry auditLogEntry) {
	auditLog := model.AuditLog{
		OperatorType: entry.operatorType,
		OperatorID:   entry.operatorID,
		Action:       entry.action,
		Resource:     entry.resource,
		RequestBody:  entry.requestBody,
		ClientIP:     entry.clientIP,
		UserAgent:    entry.userAgent,
		StatusCode:   entry.statusCode,
		Duration:     entry.durationMs,
	}

	repository.DB.Create(&auditLog)
}

// extractResource 提取资源类型
func extractResource(path string) string {
	parts := strings.Split(path, "/")
	// e.g., /api/v1/merchant/withdraw -> withdraw
	if len(parts) >= 5 && parts[1] == "api" && parts[2] == "v1" {
		return parts[4]
	}

	for i := len(parts) - 1; i >= 0; i-- {
		if parts[i] != "" {
			return parts[i]
		}
	}
	return path
}

// truncateString 截断字符串
func truncateString(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen] + "..."
}
