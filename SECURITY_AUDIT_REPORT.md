# 管理后台安全审计报告

**审计日期**: 2025-12-27
**审计范围**: 装修平台管理后台 (Backend API + Admin Frontend)
**审计人员**: Claude Code Security Audit

---

## 执行摘要

本次安全审计发现了**11个安全问题**，包括：
- 🔴 **高危 (Critical)**: 3个
- 🟠 **中危 (High)**: 4个
- 🟡 **低危 (Medium)**: 4个

**总体评估**: 存在多个严重的安全漏洞，需要立即修复。

---

## 🔴 高危漏洞 (Critical)

### 1. JWT Secret 硬编码且过于简单

**文件**: `server/config.yaml:23`

**问题描述**:
```yaml
jwt:
  secret: "home-decoration-jwt-secret-dev-2024"
  expire_hour: 72
```

- JWT密钥硬编码在配置文件中
- 密钥过于简单，易被猜测
- 生产环境和开发环境使用同一个密钥
- 配置文件可能被提交到版本控制系统

**影响**:
- 攻击者可以伪造任何管理员token
- 可以绕过所有身份验证
- 获得超级管理员权限

**修复建议**:
```yaml
jwt:
  secret: "${JWT_SECRET}"  # 从环境变量读取
  expire_hour: 24  # 缩短过期时间
```

使用强随机密钥（至少64字符）：
```bash
# 生成强密钥
openssl rand -base64 64
```

**严重程度**: 🔴 Critical
**CVSS评分**: 9.8 (Critical)

---

### 2. CORS配置允许任意源 (Access-Control-Allow-Origin: *)

**文件**: `server/internal/middleware/middleware.go:16`

**问题描述**:
```go
func Cors() gin.HandlerFunc {
    return func(c *gin.Context) {
        c.Header("Access-Control-Allow-Origin", "*")  // ❌ 允许所有源
        c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        c.Header("Access-Control-Allow-Headers", "Origin, Content-Type, Authorization")
```

**影响**:
- 任何网站都可以发起跨域请求
- 无法防御CSRF攻击
- 恶意网站可以窃取用户token（如果token存储在localStorage）

**修复建议**:
```go
func Cors(allowedOrigins []string) gin.HandlerFunc {
    return func(c *gin.Context) {
        origin := c.Request.Header.Get("Origin")

        // 白名单验证
        allowed := false
        for _, allowedOrigin := range allowedOrigins {
            if origin == allowedOrigin {
                allowed = true
                break
            }
        }

        if allowed {
            c.Header("Access-Control-Allow-Origin", origin)
            c.Header("Access-Control-Allow-Credentials", "true")  // 允许携带凭证
        }

        c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        c.Header("Access-Control-Allow-Headers", "Origin, Content-Type, Authorization")

        if c.Request.Method == "OPTIONS" {
            c.AbortWithStatus(http.StatusNoContent)
            return
        }

        if !allowed {
            c.AbortWithStatus(http.StatusForbidden)
            return
        }

        c.Next()
    }
}
```

配置示例：
```go
allowedOrigins := []string{
    "http://localhost:5173",           // 开发环境
    "https://admin.yourdomain.com",    // 生产环境
}
r.Use(middleware.Cors(allowedOrigins))
```

**严重程度**: 🔴 Critical
**CVSS评分**: 8.1 (High)

---

### 3. 缺少CSRF防护

**文件**: 所有POST/PUT/DELETE接口

**问题描述**:
- 管理后台所有的修改操作（POST/PUT/DELETE）均未实现CSRF token验证
- 结合CORS漏洞，攻击者可以构造CSRF攻击

**攻击场景**:
```html
<!-- 恶意网站 evil.com -->
<script>
// 窃取localStorage中的token（跨域可访问）
fetch('http://localhost:8080/api/v1/admin/admins', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + stolenToken
    },
    body: JSON.stringify({
        username: 'hacker',
        password: 'hacker123',
        phone: '13800000000',
        role: 'super_admin'
    })
});
</script>
```

**影响**:
- 攻击者可以创建管理员账户
- 修改系统设置
- 删除数据
- 执行任意管理操作

**修复建议**:

1. **实现CSRF Token机制**:
```go
// middleware/csrf.go
func CSRF() gin.HandlerFunc {
    return func(c *gin.Context) {
        if c.Request.Method != "GET" && c.Request.Method != "OPTIONS" {
            csrfToken := c.GetHeader("X-CSRF-Token")
            sessionToken := c.GetHeader("Authorization")

            if !validateCSRFToken(csrfToken, sessionToken) {
                response.Forbidden(c, "CSRF token无效")
                c.Abort()
                return
            }
        }
        c.Next()
    }
}
```

2. **使用SameSite Cookie**（推荐）:
```go
// 将token存储在HttpOnly + SameSite Cookie中
c.SetSameSite(http.SameSiteStrictMode)
c.SetCookie("admin_token", tokenString, 3600*24, "/", "", true, true)
```

**严重程度**: 🔴 Critical
**CVSS评分**: 8.8 (High)

---

## 🟠 中危漏洞 (High)

### 4. 管理后台未实现细粒度权限控制

**文件**: `server/internal/router/router.go:146-223`

**问题描述**:
```go
admin := authorized.Group("/admin")
{
    // 所有管理员接口只验证JWT，未验证权限
    admin.GET("/users", handler.AdminListUsers)        // ❌ 无权限验证
    admin.DELETE("/reviews/:id", handler.AdminDeleteReview)  // ❌ 普通管理员可删除评价
    admin.POST("/finance/escrow-accounts/:accountId/withdraw", handler.AdminWithdraw)  // ❌ 任何管理员可操作财务
}
```

虽然有RBAC模型（`SysRole`, `SysMenu`, `SysRoleMenu`），但**未实际使用**！

**影响**:
- 任何登录的管理员都可以执行所有操作
- 无法实现职责分离
- 客服可以删除用户、操作财务
- 审计员无法追溯谁执行了敏感操作

**修复建议**:

创建权限中间件：
```go
// middleware/rbac.go
func RequirePermission(permission string) gin.HandlerFunc {
    return func(c *gin.Context) {
        adminID := c.GetUint64("admin_id")
        isSuperAdmin := c.GetBool("is_super")

        if isSuperAdmin {
            c.Next()
            return
        }

        // 查询管理员权限
        var admin model.SysAdmin
        repository.DB.Preload("Roles.Menus").First(&admin, adminID)

        hasPermission := false
        for _, role := range admin.Roles {
            for _, menu := range role.Menus {
                if menu.Permission == permission || menu.Permission == "*:*:*" {
                    hasPermission = true
                    break
                }
            }
        }

        if !hasPermission {
            response.Forbidden(c, "无权限执行此操作")
            c.Abort()
            return
        }

        c.Next()
    }
}
```

应用到路由：
```go
admin.DELETE("/users/:id",
    middleware.RequirePermission("system:user:delete"),
    handler.AdminDeleteUser)

admin.POST("/finance/escrow-accounts/:accountId/withdraw",
    middleware.RequirePermission("finance:withdraw:execute"),
    handler.AdminWithdraw)
```

**严重程度**: 🟠 High
**CVSS评分**: 7.5 (High)

---

### 5. JWT中间件未验证token类型

**文件**: `server/internal/middleware/middleware.go:41-80`

**问题描述**:
```go
func JWT(secret string) gin.HandlerFunc {
    return func(c *gin.Context) {
        // ... 解析token ...

        // 将用户ID存入上下文
        c.Set("userId", claims["userId"])      // ❌ 普通用户token
        c.Set("userType", claims["userType"])
        c.Next()
    }
}
```

问题：
- 普通用户token和管理员token使用同一个中间件
- 未验证 `token_type` 字段
- 普通用户可以使用自己的token访问管理接口

**攻击场景**:
```javascript
// 用户在移动端登录后获取token
const userToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...";

// 使用普通用户token访问管理接口
fetch('http://localhost:8080/api/v1/admin/users', {
    headers: {
        'Authorization': `Bearer ${userToken}`
    }
});
// 可能成功访问！
```

**修复建议**:

创建专门的Admin JWT中间件：
```go
// middleware/admin_jwt.go
func AdminJWT(secret string) gin.HandlerFunc {
    return func(c *gin.Context) {
        authHeader := c.GetHeader("Authorization")
        if authHeader == "" {
            response.Unauthorized(c, "请先登录")
            c.Abort()
            return
        }

        parts := strings.SplitN(authHeader, " ", 2)
        if len(parts) != 2 || parts[0] != "Bearer" {
            response.Unauthorized(c, "Token格式错误")
            c.Abort()
            return
        }

        tokenString := parts[1]
        token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
            return []byte(secret), nil
        })

        if err != nil || !token.Valid {
            response.Unauthorized(c, "Token无效或已过期")
            c.Abort()
            return
        }

        claims, ok := token.Claims.(jwt.MapClaims)
        if !ok {
            response.Unauthorized(c, "Token解析失败")
            c.Abort()
            return
        }

        // ✅ 验证token类型
        tokenType, _ := claims["token_type"].(string)
        if tokenType != "admin" {
            response.Forbidden(c, "无权访问管理接口")
            c.Abort()
            return
        }

        // 存储管理员信息
        c.Set("admin_id", uint64(claims["admin_id"].(float64)))
        c.Set("username", claims["username"])
        c.Set("is_super", claims["is_super"])
        c.Next()
    }
}
```

更新路由：
```go
admin := v1.Group("/admin")
admin.Use(middleware.AdminJWT(cfg.JWT.Secret))  // ✅ 使用专门的中间件
{
    admin.GET("/info", handler.AdminGetInfo)
    // ...
}
```

**严重程度**: 🟠 High
**CVSS评分**: 7.3 (High)

---

### 6. 质量存储敏感信息到前端LocalStorage

**文件**: `admin/src/stores/authStore.ts:43-46`, `admin/src/pages/user/Login.tsx:33`

**问题描述**:
```typescript
// ❌ Token存储在localStorage，易被XSS窃取
login: (token, admin) => {
    localStorage.setItem('admin_token', token);
    localStorage.setItem('admin_user', JSON.stringify(admin));
    set({ token, admin, isAuthenticated: true });
},
```

**影响**:
- XSS攻击可以轻易窃取token
- 恶意浏览器插件可以读取token
- Token泄露后可以长期使用（72小时有效期）

**修复建议**:

使用HttpOnly Cookie存储token：

后端：
```go
// handler/admin_auth_handler.go
func AdminLogin(c *gin.Context) {
    // ... 验证密码 ...

    // ✅ 设置HttpOnly Cookie
    c.SetSameSite(http.SameSiteStrictMode)
    c.SetCookie(
        "admin_token",           // name
        tokenString,             // value
        3600 * 24,               // maxAge (24小时)
        "/",                     // path
        "",                      // domain
        true,                    // secure (仅HTTPS)
        true,                    // httpOnly (JS无法访问)
    )

    // 不再返回token
    response.Success(c, gin.H{
        "admin": gin.H{...},
    })
}
```

前端：
```typescript
// ✅ 不再手动存储token，浏览器自动携带Cookie
login: (admin: AdminUser) => {
    localStorage.setItem('admin_user', JSON.stringify(admin));
    set({ admin, isAuthenticated: true });
},

// API请求自动携带Cookie
api.defaults.withCredentials = true;
```

**严重程度**: 🟠 High
**CVSS评分**: 6.8 (Medium)

---

### 7. SQL注入风险（Updates方法）

**文件**: `server/internal/handler/admin_auth_handler.go:263,369`, `admin_new_handler.go:500`

**问题描述**:
```go
// ❌ 直接使用map更新，可能存在注入风险
var updates map[string]interface{}
if err := c.ShouldBindJSON(&updates); err != nil {
    response.BadRequest(c, "参数错误")
    return
}

if err := repository.DB.Model(&role).Updates(updates).Error; err != nil {
    response.ServerError(c, "更新失败")
    return
}
```

**问题**:
- 用户可以更新任意字段，包括敏感字段
- 可能修改 `id`, `created_at` 等不应修改的字段

**攻击示例**:
```json
PUT /admin/roles/1
{
  "name": "普通角色",
  "id": 999,              // ❌ 修改ID
  "created_at": "2000-01-01"  // ❌ 修改创建时间
}
```

**修复建议**:

使用结构体绑定而非map：
```go
// AdminUpdateRole 更新角色
func AdminUpdateRole(c *gin.Context) {
    id := c.Param("id")
    var role model.SysRole
    if err := repository.DB.First(&role, id).Error; err != nil {
        response.NotFound(c, "角色不存在")
        return
    }

    // ✅ 使用结构体，只允许更新指定字段
    var req struct {
        Name   string `json:"name"`
        Key    string `json:"key"`
        Sort   int    `json:"sort"`
        Status int8   `json:"status"`
        Remark string `json:"remark"`
    }
    if err := c.ShouldBindJSON(&req); err != nil {
        response.BadRequest(c, "参数错误")
        return
    }

    // ✅ 显式更新字段
    role.Name = req.Name
    role.Key = req.Key
    role.Sort = req.Sort
    role.Status = req.Status
    role.Remark = req.Remark

    if err := repository.DB.Save(&role).Error; err != nil {
        response.ServerError(c, "更新失败")
        return
    }

    response.Success(c, role)
}
```

**严重程度**: 🟠 High
**CVSS评分**: 6.5 (Medium)

---

## 🟡 低危漏洞 (Medium)

### 8. JWT过期时间过长

**文件**: `server/config.yaml:24`

**问题**:
```yaml
jwt:
  expire_hour: 72  # ❌ 3天过期时间过长
```

**影响**:
- Token泄露后可以长期使用
- 无法及时撤销权限

**修复建议**:
```yaml
jwt:
  expire_hour: 8  # ✅ 缩短至8小时
  refresh_expire_hour: 168  # 7天刷新token
```

实现refresh token机制。

**严重程度**: 🟡 Medium

---

### 9. 缺少登录失败限制

**文件**: `server/internal/handler/admin_auth_handler.go:25-84`

**问题**:
- 无登录失败次数限制
- 可以暴力破解密码

**修复建议**:

使用Redis记录失败次数：
```go
func AdminLogin(c *gin.Context) {
    // ... 绑定参数 ...

    // ✅ 检查失败次数
    failKey := fmt.Sprintf("login_fail:%s", req.Username)
    failCount, _ := repository.Redis.Get(failKey).Int()
    if failCount >= 5 {
        response.Forbidden(c, "登录失败次数过多，请30分钟后重试")
        return
    }

    // 验证密码
    if err := bcrypt.CompareHashAndPassword([]byte(admin.Password), []byte(req.Password)); err != nil {
        // ✅ 记录失败
        repository.Redis.Incr(failKey)
        repository.Redis.Expire(failKey, 30*time.Minute)

        response.Unauthorized(c, "用户名或密码错误")
        return
    }

    // ✅ 登录成功，清除失败记录
    repository.Redis.Del(failKey)

    // ... 生成token ...
}
```

**严重程度**: 🟡 Medium

---

### 10. 缺少操作日志记录

**文件**: 所有管理接口

**问题**:
- 敏感操作未记录日志
- 无法审计和追溯

**需要记录的操作**:
- 用户删除/禁用
- 权限修改
- 财务操作
- 系统设置修改

**修复建议**:

创建日志中间件：
```go
func AdminLog() gin.HandlerFunc {
    return func(c *gin.Context) {
        // 只记录修改操作
        if c.Request.Method == "POST" || c.Request.Method == "PUT" ||
           c.Request.Method == "DELETE" || c.Request.Method == "PATCH" {

            adminID := c.GetUint64("admin_id")

            // 记录请求
            body, _ := io.ReadAll(c.Request.Body)
            c.Request.Body = io.NopCloser(bytes.NewBuffer(body))

            // 执行请求
            c.Next()

            // 记录日志
            log := model.AdminLog{
                AdminID: adminID,
                Action:  c.Request.Method + " " + c.Request.URL.Path,
                IP:      c.ClientIP,
                Request: string(body),
                Status:  c.Writer.Status(),
            }
            repository.DB.Create(&log)
        } else {
            c.Next()
        }
    }
}
```

**严重程度**: 🟡 Medium

---

### 11. 缺少输入验证和数据清理

**文件**: 多个handler

**问题示例**:
```go
// ❌ 未验证分页参数
page := parseInt(c.Query("page"), 1)
pageSize := parseInt(c.Query("pageSize"), 10)
```

如果pageSize传入10000，会导致查询大量数据。

**修复建议**:
```go
func parseInt(s string, defaultVal int) int {
    if s == "" {
        return defaultVal
    }
    var v int
    _, _ = fmt.Sscanf(s, "%d", &v)
    if v <= 0 {
        return defaultVal
    }
    // ✅ 限制最大值
    if v > 100 {
        return 100
    }
    return v
}
```

**严重程度**: 🟡 Medium

---

## 修复优先级

### 立即修复（1-3天）
1. ✅ JWT Secret 更换为强随机密钥
2. ✅ CORS配置改为白名单
3. ✅ 实现CSRF防护
4. ✅ JWT中间件验证token类型

### 近期修复（1-2周）
5. ✅ 实现RBAC权限控制中间件
6. ✅ 改用HttpOnly Cookie存储token
7. ✅ 修复SQL注入风险

### 建议修复（1个月内）
8. ✅ 缩短JWT过期时间，实现refresh token
9. ✅ 添加登录失败限制
10. ✅ 完善操作日志
11. ✅ 加强输入验证

---

## 安全最佳实践建议

### 1. 环境变量管理
使用环境变量存储敏感配置：
```bash
# .env (不要提交到版本控制)
JWT_SECRET=<64字符强随机密钥>
DATABASE_PASSWORD=<强密码>
```

### 2. HTTPS强制
生产环境必须使用HTTPS：
```go
if gin.Mode() == gin.ReleaseMode {
    router.Use(middleware.TLSRequired())
}
```

### 3. 安全响应头
```go
func SecurityHeaders() gin.HandlerFunc {
    return func(c *gin.Context) {
        c.Header("X-Frame-Options", "DENY")
        c.Header("X-Content-Type-Options", "nosniff")
        c.Header("X-XSS-Protection", "1; mode=block")
        c.Header("Strict-Transport-Security", "max-age=31536000")
        c.Next()
    }
}
```

### 4. 依赖安全扫描
定期运行：
```bash
go list -json -m all | nancy sleuth
npm audit
```

### 5. 数据库安全
- 使用最小权限原则
- 定期备份
- 启用SSL连接

---

## 结论

管理后台存在多个严重的安全漏洞，特别是：
- JWT密钥过于简单
- CORS配置不当
- 缺少CSRF防护
- 权限控制未实际使用

**建议立即停止在生产环境使用，直到修复所有高危和中危漏洞。**

---

**审计人员**: Claude Code
**报告版本**: 1.0
**下次审计建议**: 修复完成后1个月
