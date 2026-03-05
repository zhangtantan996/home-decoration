# 家装平台项目宪法 (Project Constitution)

> 本文档定义了家装平台项目的核心原则、架构约束、技术标准和开发流程。
> 所有代码变更必须遵守本宪法，AI agents 在生成代码时必须严格遵循这些规则。

---

## 🎯 项目愿景 (Vision)

**使命**: 打造一个连接业主、设计师、施工方、工头和工人的装修设计一体化平台

**核心价值**:
- **安全第一**: 托管支付系统涉及真实资金，安全性是最高优先级
- **用户体验**: 多端一致的流畅体验（Web Admin + Mobile App + WeChat Mini Program）
- **代码质量**: 可维护、可测试、可扩展的代码库
- **快速迭代**: 在保证质量的前提下快速响应业务需求

---

## 🏗️ 架构原则 (Architecture Principles)

### 1. 分层架构 (Layered Architecture)

**强制规则**:
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

**禁止操作**:
- ❌ Handler 直接操作数据库
- ❌ Service 直接写 SQL（必须通过 Repository）
- ❌ Repository 包含业务逻辑
- ❌ 跨层调用（Handler → Repository）

### 2. 多端架构 (Multi-Platform Architecture)

**平台矩阵**:

| 平台 | 技术栈 | React 版本 | 用途 |
|------|--------|-----------|------|
| **Admin Panel** | React 18.3.1 + Vite + Ant Design | 18.3.1 | 管理后台 |
| **Mobile App** | React Native 0.83 | 19.2.0 | iOS/Android 原生应用 |
| **WeChat Mini Program** | Taro 3.x + React | 18.3.1 | 微信小程序 |
| **Backend API** | Go 1.23 + Gin + GORM | N/A | RESTful API + WebSocket |

**关键约束**:
- 每个平台有独立的 `package.json`，避免版本冲突
- Admin 和 Mini Program 必须使用 React 18.3.1（Ant Design 和 Taro 兼容性）
- Mobile 使用 React 19.2.0（React Native 0.83 支持）
- 共享 API 接口和数据模型

### 3. 数据一致性 (Data Consistency)

**数据库策略**:
- **主数据库**: PostgreSQL 15（关系型数据，ACID 保证）
- **缓存层**: Redis 6.2（会话、临时数据）
- **消息队列**: 未来考虑（异步任务）

**事务规则**:
- 所有涉及金钱的操作必须使用数据库事务
- 托管账户操作必须使用悲观锁（`FOR UPDATE`）
- 事务失败必须回滚，不允许部分成功

---

## 🔒 安全规范 (Security Standards)

### 1. 托管支付安全 (Escrow Payment Security)

**CRITICAL 级别规则**:

```go
// ✅ 必须：原子事务 + 悲观锁
tx := db.Begin()
defer tx.Rollback()

var account model.EscrowAccount
if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
    Where("user_id = ?", userID).
    First(&account).Error; err != nil {
    return err
}

// 业务逻辑
account.Balance -= amount
if err := tx.Save(&account).Error; err != nil {
    return err
}

// 记录交易
transaction := &model.Transaction{...}
if err := tx.Create(&transaction).Error; err != nil {
    return err
}

tx.Commit()
```

**禁止操作**:
- ❌ 不使用事务的金钱操作
- ❌ 不使用锁的并发操作
- ❌ 浮点数存储金额（必须用 int64 分或 decimal）
- ❌ 缺少审计日志的敏感操作

### 2. 认证与授权 (Authentication & Authorization)

**认证策略**:
- **用户端**: JWT + Refresh Token（7 天 + 30 天）
- **管理端**: AdminJWT + RBAC 权限控制
- **微信小程序**: WeChat Code → OpenID → JWT

**中间件顺序**（强制）:
```go
r := gin.New()
r.Use(middleware.SecurityHeaders())  // 1. 安全响应头
r.Use(middleware.CORS())              // 2. CORS
r.Use(middleware.Logger())            // 3. 日志
r.Use(middleware.Recovery())          // 4. Panic 恢复
r.Use(middleware.RateLimit())         // 5. 限流
r.Use(middleware.AuditLogger())       // 6. 审计日志
```

**敏感数据处理**:
- 密码：bcrypt 哈希（cost=10）
- 身份证号：AES 加密存储
- 银行卡号：AES 加密存储
- JWT Secret：环境变量，不提交代码

### 3. 输入验证 (Input Validation)

**后端验证**:
```go
// ✅ 必须：使用 binding tags
type CreateProjectRequest struct {
    Title      string  `json:"title" binding:"required,min=2,max=100"`
    Budget     float64 `json:"budget" binding:"required,min=0"`
    ProviderID uint    `json:"providerId" binding:"required"`
}

// ✅ 必须：参数化查询（防止 SQL 注入）
db.Where("email = ? AND status = ?", email, status).Find(&users)

// ❌ 禁止：字符串拼接 SQL
query := fmt.Sprintf("email = '%s'", email) // SQL 注入风险！
```

**前端验证**:
```typescript
// ✅ 必须：使用 zod 或 yup 验证
import { z } from 'zod'

const schema = z.object({
  email: z.string().email(),
  budget: z.number().min(0).max(10000000),
})

// ❌ 禁止：dangerouslySetInnerHTML 未消毒的用户输入
<div dangerouslySetInnerHTML={{ __html: userInput }} /> // XSS 风险！
```

### 4. 限流与防护 (Rate Limiting & Protection)

**限流策略**:
- 登录接口：5 次/分钟（防暴力破解）
- 支付接口：10 次/分钟
- 公开 API：100 次/分钟
- WebSocket：1000 消息/分钟

**CORS 白名单**（生产环境）:
```go
AllowOrigins: []string{
    "https://admin.yourdomain.com",
    "https://m.yourdomain.com",
}
// ❌ 禁止：AllowOrigins: []string{"*"}
```

---

## 💻 技术栈标准 (Tech Stack Standards)

### 1. 后端标准 (Go Backend)

**文件命名**: `snake_case`
```
✅ user_service.go
✅ escrow_repository.go
❌ UserService.go
❌ escrowRepository.go
```

**代码组织**:
```
server/
├── cmd/api/main.go              # 入口点
├── internal/
│   ├── handler/                 # HTTP 处理器（薄层）
│   ├── service/                 # 业务逻辑（核心）
│   ├── repository/              # 数据访问
│   ├── model/                   # 数据模型
│   ├── middleware/              # 中间件
│   └── router/                  # 路由定义
├── pkg/                         # 共享工具
└── scripts/                     # SQL 脚本
```

**错误处理**:
```go
// ✅ 必须：包装错误，提供上下文
if err != nil {
    return fmt.Errorf("failed to create user %s: %w", email, err)
}

// ❌ 禁止：忽略错误
user, _ := userService.GetByID(id) // 静默失败！
```

**测试要求**:
- 单元测试覆盖率 ≥ 80%
- 使用 table-driven tests
- Mock 外部依赖（数据库、Redis、第三方 API）

### 2. 前端标准 (React)

**文件命名**: `PascalCase` (组件) / `camelCase` (工具)
```
✅ UserTable.tsx
✅ ProviderCard.tsx
✅ authStore.ts
❌ user-table.tsx
❌ AuthStore.ts
```

**状态管理**: Zustand（强制）
```typescript
// ✅ 必须：使用 Zustand
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      login: async (email, password) => {
        const { token } = await api.login(email, password)
        set({ token })
      },
    }),
    { name: 'auth-storage' }
  )
)

// ❌ 禁止：Redux（过于复杂）
// ❌ 禁止：Context API（用于复杂全局状态）
```

**组件规范**:
```typescript
// ✅ 必须：函数式组件 + TypeScript
interface UserCardProps {
  user: User
  onEdit: (id: number) => void
}

export const UserCard: React.FC<UserCardProps> = ({ user, onEdit }) => {
  return <div>...</div>
}

// ❌ 禁止：类组件
class UserCard extends React.Component { ... }
```

**API 调用**:
```typescript
// ✅ 必须：集中管理 API
// services/api.ts
export const userAPI = {
  list: () => api.get<User[]>('/users'),
  create: (data: CreateUserDTO) => api.post<User>('/users', data),
}

// ❌ 禁止：组件内直接 fetch
fetch('/api/users').then(...) // 分散、难维护
```

### 3. 数据库标准 (Database)

**模型定义**:
```go
// ✅ 必须：嵌入 Base 结构体
type User struct {
    Base  // ID, CreatedAt, UpdatedAt
    Phone    string `json:"phone" gorm:"uniqueIndex"`
    Password string `json:"-" gorm:"not null"` // 不返回前端
}

// ✅ 必须：显式指定表名
func (User) TableName() string {
    return "users"
}
```

**索引策略**:
- 外键字段必须加索引
- 频繁查询的字段加索引
- 唯一约束使用 `uniqueIndex`
- 复合索引优先于多个单列索引

**迁移管理**:
- 使用 GORM AutoMigrate（开发环境）
- 使用 SQL 脚本（生产环境）
- 不允许删除列（使用软删除或状态字段）

---

## 📊 质量标准 (Quality Standards)

### 1. 测试要求 (Testing Requirements)

**最低覆盖率**: 80%

**测试类型**:
- **单元测试**: 所有 service 和 repository 函数
- **集成测试**: API 端点（使用 httptest）
- **E2E 测试**: 关键用户流程（Playwright）

**TDD 工作流**（推荐）:
1. 写测试（RED）
2. 运行测试 - 应该失败
3. 写最小实现（GREEN）
4. 运行测试 - 应该通过
5. 重构（IMPROVE）
6. 验证覆盖率 ≥ 80%

### 2. 代码审查 (Code Review)

**自动审查**（提交前）:
- Go: `go fmt`, `go vet`, `golangci-lint`
- TypeScript: `eslint`, `prettier`
- 安全扫描: `gosec`, `npm audit`

**人工审查**（PR 前）:
- 使用 `code-reviewer` agent
- 修复所有 CRITICAL 和 HIGH 问题
- 修复 MEDIUM 问题（如果可能）

### 3. 性能标准 (Performance Standards)

**后端 API**:
- P95 响应时间 < 200ms
- P99 响应时间 < 500ms
- 数据库查询 < 100ms
- 使用 Redis 缓存热点数据

**前端**:
- First Contentful Paint (FCP) < 1.5s
- Time to Interactive (TTI) < 3.5s
- 使用 React.memo 优化渲染
- 使用 useMemo/useCallback 优化计算

### 4. 文档要求 (Documentation)

**必需文档**:
- `README.md`: 项目概览、快速开始
- `CLAUDE.md`: AI agent 开发指南
- `docs/CLAUDE_DEV_GUIDE.md`: 详细开发规范
- `docs/TROUBLESHOOTING.md`: 常见问题解决
- API 文档: Swagger/OpenAPI（自动生成）

**代码注释**:
- 公开函数必须有注释（Go: godoc 格式）
- 复杂业务逻辑必须有注释
- 不要注释显而易见的代码

---

## 🔄 开发流程 (Development Process)

### 1. 功能开发流程

**使用 spec-kit 工作流**:

```bash
# 1. 定义需求
/speckit.specify "用户可以向托管账户充值"

# 2. 生成技术方案
/speckit.plan

# 3. 生成任务列表
/speckit.tasks

# 4. 执行实现
/speckit.implement

# 5. 代码审查
/code-review

# 6. 安全审查（如果涉及支付）
/security-review

# 7. 测试
/test

# 8. 提交
/commit
```

### 2. Git 工作流

**分支策略**:
- `main`: 生产环境（受保护）
- `dev`: 开发环境（默认分支）
- `feature/*`: 功能分支
- `bugfix/*`: Bug 修复分支
- `hotfix/*`: 紧急修复分支

**提交规范**:
```
<type>: <description>

<optional body>

Types: feat, fix, refactor, docs, test, chore, perf, ci
```

**PR 流程**:
1. 创建功能分支
2. 开发 + 测试
3. 代码审查（agent + 人工）
4. 合并到 dev
5. 测试环境验证
6. 合并到 main（发布）

### 3. 部署流程

**环境**:
- **开发环境**: Docker Compose（本地）
- **测试环境**: Docker Compose（服务器）
- **生产环境**: Kubernetes（未来）

**部署检查清单**:
- [ ] 所有测试通过
- [ ] 代码审查通过
- [ ] 安全扫描通过
- [ ] 性能测试通过
- [ ] 数据库迁移脚本准备
- [ ] 回滚方案准备
- [ ] 监控和告警配置

---

## 🚫 禁止操作清单 (Forbidden Operations)

### 代码层面

- ❌ 硬编码密钥、密码、API Key
- ❌ 提交 `.env` 文件到 Git
- ❌ 直接修改生产数据库
- ❌ 跳过测试直接部署
- ❌ 使用 `console.log` 调试（使用 logger）
- ❌ 忽略 linter 警告
- ❌ 复制粘贴代码（提取公共函数）
- ❌ 使用 `any` 类型（TypeScript）
- ❌ 使用 `interface{}` 类型（Go，除非必要）

### 架构层面

- ❌ 跨层调用（Handler → Repository）
- ❌ 循环依赖
- ❌ 全局变量（除了配置）
- ❌ 单例模式（除了数据库连接）
- ❌ 上帝对象（God Object）
- ❌ 过早优化

### 安全层面

- ❌ SQL 注入（使用参数化查询）
- ❌ XSS 攻击（消毒用户输入）
- ❌ CSRF 攻击（使用 CSRF token）
- ❌ 明文存储密码
- ❌ 不验证用户输入
- ❌ 不使用 HTTPS（生产环境）
- ❌ 暴露敏感信息在错误消息中

### 数据库层面

- ❌ 不使用事务的金钱操作
- ❌ 不使用锁的并发操作
- ❌ N+1 查询问题（使用 Preload）
- ❌ 缺少索引的频繁查询
- ❌ 删除数据（使用软删除）
- ❌ 直接修改生产数据（使用迁移脚本）

---

## 📚 参考文档 (References)

**项目文档**:
- [CLAUDE.md](../CLAUDE.md) - AI agent 开发指南
- [docs/CLAUDE_DEV_GUIDE.md](../docs/CLAUDE_DEV_GUIDE.md) - 详细开发规范
- [docs/TROUBLESHOOTING.md](../docs/TROUBLESHOOTING.md) - 故障排除
- [docs/PRD.md](../docs/PRD.md) - 产品需求文档

**技术规范**:
- [.claude/rules/go-standards.md](../.claude/rules/go-standards.md) - Go 编码标准
- [.claude/rules/react-standards.md](../.claude/rules/react-standards.md) - React 编码标准
- [.claude/rules/security.md](../.claude/rules/security.md) - 安全指南

**外部资源**:
- [Go Code Review Comments](https://github.com/golang/go/wiki/CodeReviewComments)
- [React Best Practices](https://react.dev/learn)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [PostgreSQL Best Practices](https://wiki.postgresql.org/wiki/Don%27t_Do_This)

---

## 🔄 宪法更新 (Constitution Updates)

**更新原则**:
- 本宪法是活文档，随项目演进而更新
- 重大变更需要团队讨论和批准
- 更新后通知所有开发者和 AI agents

**版本历史**:
- v1.0.0 (2026-03-04): 初始版本

**维护者**: 项目技术负责人

---

**⚠️ 重要提醒**: 本宪法是项目的最高技术准则，所有代码变更必须遵守。AI agents 在生成代码时必须严格遵循这些规则，违反宪法的代码将被拒绝。
