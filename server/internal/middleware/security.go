package middleware

import "github.com/gin-gonic/gin"

// SecurityHeaders 添加安全响应头中间件
// 防御常见的 Web 攻击：XSS、点击劫持、MIME 嗅探等
func SecurityHeaders() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 防止 MIME 类型嗅探
		c.Header("X-Content-Type-Options", "nosniff")

		// 防止点击劫持攻击
		c.Header("X-Frame-Options", "DENY")

		// 启用浏览器 XSS 防护
		c.Header("X-XSS-Protection", "1; mode=block")

		// Referrer 策略：仅在同源时发送完整 URL
		c.Header("Referrer-Policy", "strict-origin-when-cross-origin")

		// 权限策略：禁用不必要的浏览器功能
		c.Header("Permissions-Policy", "geolocation=(), microphone=(), camera=()")

		// 内容安全策略 (CSP)
		// 注意：根据实际前端需求调整策略
		csp := "default-src 'self'; " +
			"script-src 'self' 'unsafe-inline' 'unsafe-eval'; " + // React 需要 unsafe-inline 和 unsafe-eval
			"style-src 'self' 'unsafe-inline'; " + // CSS-in-JS 需要 unsafe-inline
			"img-src 'self' data: https:; " +
			"font-src 'self' data:; " +
			"connect-src 'self'; " +
			"frame-ancestors 'none'"
		c.Header("Content-Security-Policy", csp)

		// 仅在生产环境启用 HSTS (需要 HTTPS)
		// 建议在 Nginx/Load Balancer 层配置
		// if cfg.Server.Mode == "release" {
		//     c.Header("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload")
		// }

		c.Next()
	}
}
