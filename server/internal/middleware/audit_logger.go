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
		go saveAuditLog(c, path, requestBody, startTime)
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

// saveAuditLog 保存审计日志
func saveAuditLog(c *gin.Context, path, requestBody string, startTime time.Time) {
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

	// 创建审计日志
	auditLog := model.AuditLog{
		OperatorType: operatorType,
		OperatorID:   operatorID,
		Action:       c.Request.Method + " " + path,
		Resource:     extractResource(path),
		RequestBody:  truncateString(requestBody, 2000),
		ClientIP:     c.ClientIP(),
		UserAgent:    truncateString(c.Request.UserAgent(), 500),
		StatusCode:   c.Writer.Status(),
		Duration:     time.Since(startTime).Milliseconds(),
	}

	repository.DB.Create(&auditLog)
}

// extractResource 提取资源类型
func extractResource(path string) string {
	parts := strings.Split(path, "/")
	if len(parts) >= 4 {
		return parts[3] // e.g., /api/v1/merchant/withdraw -> withdraw
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
