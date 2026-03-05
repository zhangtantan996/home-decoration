# 开发约束 - Home Decoration Platform

> ⚠️ **P0 优先级** - 所有代码修改前必须阅读本文档

## 🚨 文件命名规范（强制）

### Go 文件：snake_case

```
✅ CORRECT:
server/internal/service/user_service.go
server/internal/handler/provider_handler.go
server/internal/repository/escrow_repository.go

❌ WRONG:
server/internal/service/UserService.go
server/internal/handler/ProviderHandler.go
```

### React 组件：PascalCase

```
✅ CORRECT:
admin/src/pages/Dashboard/Dashboard.tsx
admin/src/components/UserTable/UserTable.tsx
mobile/src/screens/HomeScreen.tsx

❌ WRONG:
admin/src/pages/dashboard.tsx
admin/src/components/user-table.tsx
mobile/src/screens/home-screen.tsx
```

## 🔒 React 版本约束（强制）

**严禁跨项目混用 React 版本！**

| 项目 | React 版本 | 原因 |
|------|-----------|------|
| admin/ | 18.3.1 | Ant Design 5.x 兼容性 |
| mobile/ | 19.2.0 | React Native 0.83 支持 |
| mini/ | 18.3.1 | Taro 3.x 要求 |

**检查方法**：
```bash
# Admin
cd admin && cat package.json | grep '"react"'

# Mobile
cd mobile && cat package.json | grep '"react"'

# Mini
cd mini && cat package.json | grep '"react"'
```

## 🏗️ 后端分层架构（强制）

### 调用链路
```
HTTP Request
    ↓
Handler (HTTP 层)
    ├── 绑定请求参数
    ├── 调用 Service
    └── 返回响应
    ↓
Service (业务逻辑层)
    ├── 业务规则验证
    ├── 编排多个 Repository
    ├── 事务管理
    └── 错误处理
    ↓
Repository (数据访问层)
    ├── GORM 查询
    ├── Redis 操作
    └── 返回数据
    ↓
Model (数据模型)
    └── GORM 结构体定义
```

### 禁止操作

- ❌ Handler 直接操作数据库
- ❌ Service 直接写 SQL（必须通过 Repository）
- ❌ Repository 包含业务逻辑
- ❌ 跨层调用（Handler → Repository）

### 示例

```go
// ✅ CORRECT: 分层清晰
// Handler
func (h *UserHandler) CreateUser(c *gin.Context) {
    var req CreateUserRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        response.Error(c, http.StatusBadRequest, err.Error())
        return
    }
    user, err := h.userService.Create(req)
    if err != nil {
        response.Error(c, http.StatusInternalServerError, err.Error())
        return
    }
    response.Success(c, user)
}

// Service
func (s *UserService) Create(req CreateUserRequest) (*model.User, error) {
    // 业务逻辑
    hashedPassword, _ := bcrypt.GenerateFromPassword([]byte(req.Password), 10)
    user := &model.User{Email: req.Email, Password: string(hashedPassword)}
    return s.userRepo.Create(user)
}

// Repository
func (r *UserRepository) Create(user *model.User) (*model.User, error) {
    err := r.db.Create(user).Error
    return user, err
}

// ❌ WRONG: Handler 直接操作数据库
func (h *UserHandler) CreateUser(c *gin.Context) {
    var user model.User
    c.ShouldBindJSON(&user)
    db.Create(&user) // 禁止！
    c.JSON(200, user)
}
```

## 💰 托管支付安全约束（强制）

### 1. 必须使用事务

```go
// ✅ CORRECT: 事务 + 悲观锁
tx := db.Begin()
defer tx.Rollback()

var account model.EscrowAccount
if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
    Where("user_id = ?", userID).
    First(&account).Error; err != nil {
    return err
}

account.Balance -= amount
if err := tx.Save(&account).Error; err != nil {
    return err
}

tx.Commit()

// ❌ CRITICAL: 无事务（竞态条件）
account.Balance -= amount
db.Save(&account) // 危险！
```

### 2. 必须记录审计日志

```go
// ✅ CORRECT: 记录所有财务操作
db.Create(&AuditLog{
    OperatorType: "user",
    OperatorID:   userID,
    Action:       "escrow.withdraw",
    Resource:     "escrow_account",
    Amount:       amount,
})
```

### 3. 禁止浮点数

```go
// ❌ WRONG: 浮点数精度问题
type EscrowAccount struct {
    Balance float64 // 危险！
}

// ✅ CORRECT: 使用整数（分）或 decimal
type EscrowAccount struct {
    Balance int64 // 单位：分
}
```

## 🔐 安全约束（强制）

### 1. 密码处理

```go
// ✅ CORRECT: bcrypt 哈希
import "golang.org/x/crypto/bcrypt"

hashedPassword, _ := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)

// ❌ WRONG: 明文存储
user.Password = password // 禁止！
```

### 2. SQL 注入防护

```go
// ✅ CORRECT: 参数化查询
db.Where("email = ?", email).First(&user)

// ❌ CRITICAL: SQL 注入漏洞
query := fmt.Sprintf("SELECT * FROM users WHERE email = '%s'", email)
db.Raw(query).Scan(&user) // 危险！
```

### 3. 敏感数据加密

```go
// ✅ CORRECT: AES 加密
type MerchantBankAccount struct {
    AccountNo string `json:"accountNo" gorm:"type:text"` // AES 加密存储
}

// ❌ WRONG: 明文存储
type MerchantBankAccount struct {
    AccountNo string `json:"accountNo"` // 禁止！
}
```

### 4. 密码字段不返回前端

```go
// ✅ CORRECT: json:"-" 标签
type User struct {
    Password string `json:"-"` // 不返回前端
}

// ❌ WRONG: 密码泄露
type User struct {
    Password string `json:"password"` // 危险！
}
```

## 🚫 禁止操作清单

### 依赖管理
- ❌ 禁止修改 Go 版本（锁定 1.23）
- ❌ 禁止修改 React 版本（见上文约束）
- ❌ 禁止添加未经审核的第三方库
- ❌ 禁止使用 `go get -u`（可能破坏依赖）

### 数据库操作
- ❌ 禁止直接执行 SQL（必须通过 GORM）
- ❌ 禁止删除表（使用软删除或状态字段）
- ❌ 禁止在生产环境执行 `db.AutoMigrate()`
- ❌ 禁止在事务外修改 Escrow 余额

### 代码修改
- ❌ 禁止删除旧 WebSocket 代码（兼容性保留）
- ❌ 禁止写入 Chat 表（已废弃，只读）
- ❌ 禁止在 Handler 中写业务逻辑
- ❌ 禁止跨层调用

### 安全操作
- ❌ 禁止硬编码密钥（使用环境变量）
- ❌ 禁止提交 .env 文件
- ❌ 禁止在日志中输出密码/Token
- ❌ 禁止在生产环境开放调试端点

## ✅ 必须操作清单

### 代码提交前
- ✅ 运行 `go fmt`（Go 代码）
- ✅ 运行 `npm run lint`（前端代码）
- ✅ 运行测试（`go test ./...` 或 `npm test`）
- ✅ 检查文件命名规范
- ✅ 检查是否有 console.log（前端）
- ✅ 检查是否有硬编码的密钥

### 新增 API 端点
- ✅ 必须添加到 `router.go`
- ✅ 必须使用正确的中间件（JWT/AdminJWT）
- ✅ 必须添加限流保护
- ✅ 必须验证请求参数
- ✅ 必须记录审计日志（关键操作）

### 新增数据库模型
- ✅ 必须嵌入 `Base` 结构体
- ✅ 必须显式指定表名（`TableName()` 方法）
- ✅ 必须使用参数化查询
- ✅ 必须添加索引（高频查询字段）
- ✅ 必须考虑数据迁移脚本

### 新增前端页面
- ✅ 必须使用 PascalCase 命名
- ✅ 必须使用 TypeScript
- ✅ 必须使用 Zustand（全局状态）
- ✅ 必须处理 loading/error 状态
- ✅ 必须添加路由配置

## 📋 代码审查清单

提交 PR 前自查：

- [ ] 文件命名符合规范（Go: snake_case, React: PascalCase）
- [ ] React 版本正确（Admin/Mini: 18.3.1, Mobile: 19.2.0）
- [ ] 遵循分层架构（Handler → Service → Repository）
- [ ] 所有 Escrow 操作使用事务 + 悲观锁
- [ ] 所有 GORM 查询使用参数化查询
- [ ] 密码使用 bcrypt 哈希
- [ ] 敏感数据使用 AES 加密
- [ ] 密码字段使用 `json:"-"` 标签
- [ ] 关键操作记录审计日志
- [ ] 无硬编码密钥
- [ ] 无 console.log 语句
- [ ] 测试通过

## 🔗 相关文档

- [项目概览](project-overview.md)
- [技术栈](tech-stack.md)
- [后端分层架构](../architecture/backend-layers.md)
- [托管支付系统](../architecture/escrow-system.md)
- [Go 编码规范](../../.claude/rules/go-standards.md)
- [React 编码规范](../../.claude/rules/react-standards.md)
- [安全指南](../../.claude/rules/security.md)

---

**最后更新**：2026-01-26
**优先级**：P0（最高）
