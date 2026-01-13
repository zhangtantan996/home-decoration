# Claude 开发参考手册 (CLAUDE_DEV_GUIDE.md)

> **本文档是 Claude Code AI 的开发约束规范，所有代码编辑修改必须遵循此文档。**

## 🎯 文档定位

- **优先级**: P0（最高优先级，与 CLAUDE.md 并列参考）
- **适用范围**: 所有代码生成、修改、重构任务
- **更新频率**: 每次技术选型变更后立即更新
- **最后更新**: 2026-01-07

---

## 📐 项目架构约束

### 1. 技术栈版本（强制遵守）

| 组件 | 版本 | 禁止使用 | 原因 |
|------|------|----------|------|
| **Admin Panel** | React 18.3.1 | React 19.x | Ant Design 5.x 和腾讯云 IM SDK 不兼容 React 19 |
| **Mobile App** | React 19.2.0 | React 18.x | React Native 0.83 支持 React 19，使用最新特性 |
| **Backend** | Go 1.23 + Gin | Echo/Fiber | 项目已使用 Gin 框架，迁移成本高 |
| **Database** | PostgreSQL 15 | MySQL/MongoDB | 已有 GORM PostgreSQL schema，迁移风险大 |
| **Node.js** | ≥ 20 | 18.x | 依赖库要求最低 Node 20 |

**⚠️ 关键提醒**:
- Admin Panel 的 React 版本已锁定在 `18.3.1`（精确版本，无 `^` 符号）
- Mobile App 使用 React 19，两者**完全独立**，不可混用
- 依赖版本变更前必须先咨询并记录原因

---

### 2. 前端状态管理

| 项目 | 使用 | 禁止 | 原因 |
|-----|------|------|------|
| **Admin Panel** | Zustand | Redux/MobX/Recoil | 项目已统一使用 Zustand，轻量级且易维护 |
| **Mobile App** | Zustand | Redux/MobX/Context API（大规模） | 已有 authStore/providerStore/chatStore |

**现有 Store**:
```typescript
// Admin Panel
admin/src/stores/
├── authStore.ts          // 管理员认证状态
├── dictStore.ts          // 字典缓存

// Mobile App
mobile/src/stores/
├── authStore.ts          // 用户认证状态
├── providerStore.ts      // 设计师/工长数据
└── chatStore.ts          // WebSocket 聊天状态
```

**新增 Store 规范**:
```typescript
// 使用 create + persist 模式
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface MyStore {
  data: any;
  setData: (data: any) => void;
}

export const useMyStore = create<MyStore>()(
  persist(
    (set) => ({
      data: null,
      setData: (data) => set({ data }),
    }),
    { name: 'my-store' }
  )
);
```

---

### 3. UI 组件库约束（严格禁止混用）

#### Admin Panel（管理后台）

**✅ 允许使用**:
```json
"antd": "^5.29.2"                        // Ant Design 5.x
"@ant-design/pro-components": "^2.8.10"  // ProTable/ProForm 等高级组件
"@ant-design/charts": "^2.6.7"           // 图表组件
"@ant-design/icons": "^6.1.0"            // 官方图标库
"@tencentcloud/chat-uikit-react": "^4.5.1" // 腾讯云 IM UI 套件
```

**❌ 禁止使用**:
- ❌ Material-UI (MUI)
- ❌ Chakra UI
- ❌ Semantic UI
- ❌ Blueprint.js
- ❌ React Bootstrap

**原因**:
1. **依赖冲突**: 多个 UI 库会导致样式冲突、bundle 体积翻倍（Ant Design 2MB + MUI 1.5MB = 3.5MB）
2. **设计不统一**: 混用多套设计系统会导致 UI 风格混乱
3. **维护成本**: 团队需要学习多套 API，升级时兼容性问题成倍增加
4. **已有依赖**: 腾讯云 IM SDK 基于 Ant Design 设计，无法替换

#### Mobile App（移动端）

**✅ 允许使用**:
```json
"react-native": "0.83.0"                 // 原生组件（优先）
"lucide-react-native": "^0.562.0"        // 图标库
"@tencentcloud/chat-uikit-react-native": "^1.1.0" // 腾讯云 IM UI
"expo-blur": "^15.0.8"                   // 模糊效果
"expo-linear-gradient": "^15.0.8"        // 渐变组件
```

**❌ 禁止使用**:
- ❌ React Native Paper
- ❌ NativeBase
- ❌ React Native Elements
- ❌ UI Kitten

**原因**:
- 项目使用原生组件 + 自定义设计，无需第三方 UI 库
- 已有完整的组件库（见 `mobile/src/components/`）

---

## 🔒 编码架构约束

### 1. 后端分层架构（强制）

**目录结构**（禁止违反）:
```
server/internal/
├── handler/      # HTTP 请求处理（Controller 层）
├── service/      # 业务逻辑层
├── repository/   # 数据访问层（GORM）
├── model/        # 数据模型
├── middleware/   # 中间件（CORS/JWT/日志）
├── router/       # 路由定义
└── ws/           # WebSocket 实现
```

**层级调用规则**:
```
HTTP Request
    ↓
handler (仅处理请求/响应)
    ↓
service (业务逻辑)
    ↓
repository (数据库操作)
    ↓
model (数据模型)
```

**❌ 错误示例**（禁止在 handler 直接操作数据库）:
```go
// ❌ 错误：handler 直接调用 GORM
func (h *UserHandler) CreateUser(c *gin.Context) {
    var user model.User
    c.BindJSON(&user)
    db.Create(&user)  // 禁止！
}
```

**✅ 正确示例**:
```go
// ✅ handler 调用 service
func (h *UserHandler) CreateUser(c *gin.Context) {
    var req CreateUserRequest
    if err := c.BindJSON(&req); err != nil {
        response.Error(c, "invalid request")
        return
    }
    user, err := h.userService.CreateUser(req)
    if err != nil {
        response.Error(c, err.Error())
        return
    }
    response.Success(c, user)
}

// ✅ service 处理业务逻辑
func (s *UserService) CreateUser(req CreateUserRequest) (*model.User, error) {
    // 业务逻辑验证
    if req.Phone == "" {
        return nil, errors.New("手机号不能为空")
    }
    // 调用 repository
    return s.userRepo.Create(&model.User{
        Phone: req.Phone,
        Name:  req.Name,
    })
}
```

---

### 2. 前端路由约束

#### Admin Panel 路由规范

**✅ 所有路由必须有 `/admin` 前缀**:
```tsx
// ✅ 正确
<Route path="/admin/dashboard" element={<Dashboard />} />
<Route path="/admin/users" element={<UserList />} />
<Route path="/admin/merchants/apply" element={<MerchantApply />} />

// ❌ 错误：缺少 /admin 前缀
<Route path="/dashboard" element={<Dashboard />} />  // 禁止！
```

**原因**:
- Nginx 部署时使用 `/admin` 作为反向代理前缀
- 与移动端 Web 路由隔离（未来可能共用域名）

#### Mobile App 路由规范

**使用 React Navigation Stack**:
```tsx
// ✅ 正确：使用 Stack.Screen
<Stack.Navigator>
  <Stack.Screen name="Home" component={HomeScreen} />
  <Stack.Screen name="ProviderDetails" component={ProviderDetailsScreen} />
</Stack.Navigator>

// ❌ 错误：不要使用 react-router
import { BrowserRouter } from 'react-router-dom';  // 禁止在 Mobile 使用
```

---

### 3. API 调用约束

**✅ 使用统一的 API Client**:
```typescript
// ✅ 正确
import api from '@/services/api';

const getUsers = async () => {
  const response = await api.get('/users');
  return response.data;
};

// ❌ 错误：禁止直接使用 fetch 或 axios
fetch('http://localhost:8080/api/v1/users');  // 禁止！
axios.get('http://localhost:8080/api/v1/users');  // 禁止！
```

**API Client 位置**:
- Admin: `admin/src/services/api.ts`
- Mobile: `mobile/src/services/api.ts`

---

## 📁 文件命名规范（基于项目实际）

### Go 后端文件命名（100% snake_case）

**✅ 正确命名**:
```bash
server/internal/handler/
├── user_handler.go              # snake_case
├── merchant_apply_handler.go
├── admin_auth_handler.go

server/internal/service/
├── user_service.go
├── provider_service.go
├── escrow_service.go
```

**❌ 错误命名**:
```bash
├── UserHandler.go               # PascalCase - 禁止
├── merchantApplyHandler.go      # camelCase - 禁止
├── merchant-apply-handler.go    # kebab-case - 禁止
```

**原因**:
- Go 官方风格指南推荐 snake_case 文件名
- 跨平台兼容性好（Windows/Linux）
- 易读性：`merchant_apply_handler.go` 比 `MerchantApplyHandler.go` 更清晰

---

### TypeScript/React 文件命名（混合规范）

#### 组件文件（PascalCase.tsx）

**✅ 正确命名**:
```bash
admin/src/pages/
├── UserList.tsx                 # PascalCase
├── DashboardIndex.tsx
├── MerchantApply.tsx

admin/src/components/
├── DictSelect.tsx
├── RegionCascader.tsx
├── ProtectedRoute.tsx

mobile/src/screens/
├── HomeScreen.tsx               # PascalCase
├── LoginScreen.tsx
├── ProviderDetailsScreen.tsx

mobile/src/components/
├── DesignerCard.tsx
├── EmptyView.tsx
├── LoadingView.tsx
```

**❌ 错误命名**:
```bash
├── userList.tsx                 # camelCase - 禁止
├── user-list.tsx                # kebab-case - 禁止
├── user_list.tsx                # snake_case - 禁止
```

#### 工具/服务文件（camelCase.ts）

**✅ 正确命名**:
```bash
admin/src/services/
├── api.ts                       # camelCase
├── merchantApi.ts
├── dictionaryApi.ts

admin/src/stores/
├── authStore.ts
├── dictStore.ts

admin/src/utils/
├── formatDate.ts
├── validators.ts
```

#### 类/接口文件（PascalCase.ts）

**✅ 正确命名**:
```bash
mobile/src/utils/
├── SecureStorage.ts             # PascalCase (导出类)
├── WebSocketService.ts          # PascalCase (导出类)
```

**原因**:
- React 组件名必须大写开头，文件名与导出名一致
- 工具文件使用 camelCase 是 JavaScript/TypeScript 社区标准
- IDE 友好：VSCode 自动补全会优先识别 PascalCase 组件

---

## 🚫 禁止操作清单

### 1. 依赖管理

**❌ 禁止操作**:
- 安装未经批准的新 npm/go 依赖
- 升级 React 版本（Admin 锁定 18.3.1）
- 使用 `npm install <package> --force`
- 删除 `package-lock.json` 或 `go.sum` 后不重新生成

**✅ 正确流程**:
```bash
# 安装新依赖前必须说明理由
# 1. 检查是否有替代方案
# 2. 评估 bundle 体积影响
# 3. 检查 license 兼容性
# 4. 更新 docs/技术架构设计总览.md

npm install <package>
git add package.json package-lock.json
git commit -m "deps: 添加 <package> 用于 <功能>"
```

---

### 2. 数据库操作

**❌ 禁止操作**:
- 直接修改生产数据库
- 删除现有表结构（无 migration 脚本）
- 使用 `GORM AutoMigrate` 在生产环境
- 修改主键/外键字段类型

**✅ 正确流程**:
```sql
-- 1. 创建 migration SQL
-- server/scripts/migrations/v1.4.0_add_user_avatar.sql
ALTER TABLE users ADD COLUMN avatar VARCHAR(255);

-- 2. 提供回滚 SQL
-- server/scripts/migrations/v1.4.0_add_user_avatar_rollback.sql
ALTER TABLE users DROP COLUMN avatar;

-- 3. 更新 GORM model
type User struct {
    Base
    Avatar string `gorm:"size:255"`
}

-- 4. 更新文档
docs/DATABASE_MIGRATIONS.md
```

---

### 3. 安全约束

**❌ 禁止操作**:
- 提交密钥/密码到 Git（`.env` 文件）
- 使用硬编码密码/Token
- 在日志中打印敏感信息
- 禁用 CORS/CSRF 保护

**✅ 正确做法**:
```go
// ✅ 使用环境变量
jwtSecret := os.Getenv("JWT_SECRET")

// ❌ 硬编码
jwtSecret := "my-secret-key-123"  // 禁止！

// ✅ 日志脱敏
log.Printf("User login: phone=%s", maskPhone(user.Phone))  // 138****5678

// ❌ 打印敏感信息
log.Printf("User login: phone=%s, password=%s", user.Phone, user.Password)  // 禁止！
```

---

### 4. Git 操作

**❌ 禁止操作**:
- 直接推送到 `main` 分支
- 使用 `git push --force` 到共享分支
- Commit 信息不规范（如 "fix bug", "update"）
- 提交未格式化的代码

**✅ 正确流程**:
```bash
# 1. 从 dev 分支开发
git checkout dev
git pull origin dev

# 2. 创建功能分支（可选）
git checkout -b feature/user-avatar

# 3. 格式化代码
cd server && make fmt
cd admin && npm run lint

# 4. 规范的 commit 消息
git add .
git commit -m "feat(user): 添加用户头像上传功能

- 新增头像上传 API
- 支持 JPG/PNG 格式
- 自动压缩到 200KB

Refs: #123"

# 5. 推送到 dev
git push origin dev
```

**Commit 规范**:
```
<type>(<scope>): <subject>

<body>

<footer>

类型:
- feat: 新功能
- fix: Bug 修复
- refactor: 重构
- docs: 文档更新
- style: 代码格式化
- test: 测试
- chore: 构建/配置
```

---

## 🛠️ 常见场景处理规范

### 场景 1: 添加新 API 接口

**完整步骤**:
```bash
# 1. 定义 Model (如果需要新表)
# server/internal/model/user_profile.go
type UserProfile struct {
    Base
    UserID uint   `gorm:"uniqueIndex"`
    Avatar string `gorm:"size:255"`
    Bio    string `gorm:"type:text"`
}

# 2. 创建 Repository
# server/internal/repository/user_profile_repository.go
func (r *UserProfileRepository) GetByUserID(userID uint) (*model.UserProfile, error)

# 3. 实现 Service 业务逻辑
# server/internal/service/user_profile_service.go
func (s *UserProfileService) UpdateAvatar(userID uint, avatar string) error

# 4. 创建 Handler
# server/internal/handler/user_profile_handler.go
func (h *UserProfileHandler) UpdateAvatar(c *gin.Context)

# 5. 注册路由
# server/internal/router/router.go
auth.PUT("/profile/avatar", userProfileHandler.UpdateAvatar)

# 6. 更新文档
# docs/API_CHANGES.md
## [v1.4.0] 2026-01-07
### 新增
- PUT /api/v1/profile/avatar - 更新用户头像
```

---

### 场景 2: 修改数据库 Schema

**完整步骤**:
```bash
# 1. 创建 migration SQL
# server/scripts/migrations/v1.4.0_add_user_profile_table.sql
CREATE TABLE user_profiles (
    id SERIAL PRIMARY KEY,
    user_id INT UNIQUE NOT NULL REFERENCES users(id),
    avatar VARCHAR(255),
    bio TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

# 2. 创建回滚 SQL
# server/scripts/migrations/v1.4.0_add_user_profile_table_rollback.sql
DROP TABLE user_profiles;

# 3. 更新 GORM Model
# server/internal/model/user_profile.go

# 4. 本地测试
docker-compose exec db psql -U postgres -d home_decoration -f /scripts/migrations/v1.4.0_add_user_profile_table.sql

# 5. 验证
\d user_profiles

# 6. 更新文档
# docs/DATABASE_MIGRATIONS.md
```

---

### 场景 3: 添加 Admin Panel 新页面

**完整步骤**:
```bash
# 1. 创建页面组件
# admin/src/pages/users/UserProfileList.tsx
import { ProTable } from '@ant-design/pro-components';

export default function UserProfileList() {
  return <ProTable />;
}

# 2. 注册路由
# admin/src/router.tsx
{
  path: '/admin/users/profiles',
  element: <UserProfileList />,
}

# 3. 添加 API 方法
# admin/src/services/api.ts
export const getUserProfiles = () => api.get('/user-profiles');

# 4. 更新侧边栏菜单
# admin/src/layouts/BasicLayout.tsx
{
  label: '用户资料',
  key: '/admin/users/profiles',
  icon: <UserOutlined />,
}

# 5. （可选）添加 Zustand Store
# admin/src/stores/userProfileStore.ts
```

---

### 场景 4: 添加 Mobile App 新页面

**完整步骤**:
```bash
# 1. 创建 Screen 组件
# mobile/src/screens/UserProfileScreen.tsx
import React from 'react';
import { View, Text } from 'react-native';

export default function UserProfileScreen() {
  return <View><Text>用户资料</Text></View>;
}

# 2. 注册路由
# mobile/src/navigation/AppNavigator.tsx
<Stack.Screen
  name="UserProfile"
  component={UserProfileScreen}
  options={{ title: '用户资料' }}
/>

# 3. 添加导航跳转
navigation.navigate('UserProfile', { userId: 123 });

# 4. （可选）添加 API 集成
# mobile/src/services/api.ts

# 5. （可选）更新 Store
# mobile/src/stores/authStore.ts
```

---

## 🔍 问题排查与解决流程（标准化 SOP）

### 流程总览（5 步闭环）

```
发现问题 → 初步定位 → 深度排查 → 实施修复 → 验证记录
   ↓          ↓          ↓          ↓          ↓
  现象       日志       根因       解决       文档化
```

---

### 第 1 步：问题发现与初步定位（5 分钟）

**1.1 收集问题现象**
```bash
# 记录以下信息
- 问题描述: [用一句话描述]
- 环境: 开发/测试/生产
- 影响范围: 全局/特定模块/单一用户
- 重现步骤: [操作步骤]
- 预期行为: [应该是什么样]
- 实际行为: [现在是什么样]
```

**1.2 快速判断问题类别**

| 问题类型 | 典型症状 | 优先级 | 排查起点 |
|---------|---------|--------|---------|
| **依赖冲突** | `npm ERR!`, `cannot find module` | P0 | `package.json` 版本检查 |
| **构建失败** | `build failed`, `webpack error` | P0 | 构建日志 |
| **运行时错误** | `TypeError`, `ReferenceError` | P1 | 浏览器控制台 |
| **部署问题** | `Docker build failed`, `502 Bad Gateway` | P0 | Docker 日志 |
| **数据库错误** | `connection refused`, `SQL syntax error` | P0 | 数据库日志 |
| **性能问题** | 页面加载慢、内存泄漏 | P2 | Chrome DevTools |

**1.3 查看相关日志**
```bash
# 后端日志
docker-compose -f docker-compose.local.yml logs -f api

# 前端控制台
浏览器 F12 → Console

# 数据库日志
docker-compose -f docker-compose.local.yml logs db

# Nginx 日志（生产环境）
docker-compose -f deploy/docker-compose.prod.yml logs web
```

---

### 第 2 步：深度排查（15-30 分钟）

**2.1 依赖冲突排查**
```bash
# 检查 package.json 版本
cat admin/package.json | grep "react"

# 查看依赖树
cd admin && npm ls react

# 查找重复依赖
npm ls | grep "deduped"

# 清理重装（最后手段）
rm -rf node_modules package-lock.json
npm install
```

**2.2 构建失败排查**
```bash
# 查看详细构建日志
npm run build --verbose

# 检查 Docker 容器内存
docker stats

# 尝试增加内存限制
export NODE_OPTIONS="--max-old-space-size=8192"
npm run build

# 检查磁盘空间
df -h
```

**2.3 运行时错误排查**
```typescript
// 添加调试日志
console.log('[DEBUG] Variable value:', variable);
console.trace('[DEBUG] Call stack');

// 检查 API 响应
axios.get('/api/v1/users').then(res => {
  console.log('[DEBUG] Response:', res.data);
}).catch(err => {
  console.error('[DEBUG] Error:', err.response?.data);
});

// 使用 Chrome DevTools
// F12 → Sources → 设置断点 → 逐步调试
```

**2.4 数据库错误排查**
```bash
# 连接数据库
docker-compose -f docker-compose.local.yml exec db psql -U postgres -d home_decoration

# 检查表结构
\d users

# 查看最近的查询
SELECT pid, query, state FROM pg_stat_activity WHERE datname = 'home_decoration';

# 验证数据
SELECT * FROM users WHERE id = 123;

# 检查索引
\di

# 查看表大小
SELECT pg_size_pretty(pg_total_relation_size('users'));
```

**2.5 网络请求排查**
```bash
# 浏览器 Network 面板
F12 → Network → 过滤 XHR

# cURL 测试 API
curl -X GET http://localhost:8080/api/v1/users \
  -H "Authorization: Bearer <token>"

# 检查 CORS 配置
# server/internal/middleware/cors.go
```

---

### 第 3 步：根因分析（10 分钟）

**3.1 使用 5-Why 分析法**
```
问题: Admin Panel 无法启动

Why 1: 为什么无法启动？
答: 报错 "Cannot read property 'createElement' of undefined"

Why 2: 为什么找不到 createElement？
答: React 版本不兼容

Why 3: 为什么版本不兼容？
答: 升级到了 React 19

Why 4: 为什么升级到 React 19？
答: 运行 npm update 自动升级了

Why 5: 为什么会自动升级？
答: package.json 使用了 ^ 符号，允许自动升级小版本

根因: 依赖版本未锁定，导致自动升级到不兼容版本
```

**3.2 确认影响范围**
```bash
# 检查是否影响其他模块
git grep "react" | wc -l

# 查看是否有其他依赖受影响
npm ls | grep "UNMET"

# 检查是否影响生产环境
git log origin/main..HEAD --oneline
```

**3.3 评估修复方案**

| 方案类型 | 适用场景 | 风险等级 | 预估时间 |
|---------|---------|---------|---------|
| **回退版本** | 依赖冲突 | 低 | 5 分钟 |
| **配置调整** | 环境变量错误 | 低 | 10 分钟 |
| **代码修复** | 业务逻辑错误 | 中 | 30-60 分钟 |
| **架构调整** | 设计缺陷 | 高 | 数小时 |

---

### 第 4 步：实施修复（10-60 分钟）

**4.1 修复步骤示例**

**示例 1: React 版本冲突**
```bash
# 1. 回退到兼容版本
cd admin
npm install react@18.3.1 react-dom@18.3.1

# 2. 锁定版本（移除 ^ 符号）
# 编辑 package.json
{
  "dependencies": {
    "react": "18.3.1",        // 精确版本
    "react-dom": "18.3.1"
  }
}

# 3. 重新安装
rm package-lock.json
npm install

# 4. 验证修复
npm run dev
```

**示例 2: Docker 内存不足**
```dockerfile
# deploy/Dockerfile.frontend
FROM node:20 AS builder

# 添加内存限制
ENV NODE_OPTIONS="--max-old-space-size=8192"

WORKDIR /app
COPY admin/package*.json ./
RUN npm ci
COPY admin/ .
RUN npm run build
```

```bash
# 重新构建
cd deploy
docker-compose build --no-cache web

# 验证
docker-compose up web
```

**示例 3: 数据库连接失败**
```yaml
# docker-compose.local.yml
services:
  api:
    environment:
      - DATABASE_HOST=db          # 使用服务名而非 localhost
      - DATABASE_PORT=5432
      - DATABASE_USER=postgres
      - DATABASE_PASSWORD=${DB_PASSWORD}
```

```bash
# 重启服务
docker-compose -f docker-compose.local.yml restart api

# 验证连接
docker-compose -f docker-compose.local.yml logs api | grep "Database connected"
```

**4.2 测试修复效果**
```bash
# 本地测试
npm run dev

# 构建测试
npm run build

# 端到端测试
npm run test

# Docker 测试
docker-compose -f docker-compose.local.yml up --build
```

---

### 第 5 步：验证与记录（5 分钟）

**5.1 验证清单**
- [ ] 问题已完全解决（重现步骤不再出现问题）
- [ ] 未引入新问题（回归测试通过）
- [ ] 相关文档已更新
- [ ] 代码已提交到 Git
- [ ] 团队已通知（重要问题）

**5.2 记录到 TROUBLESHOOTING.md**
```markdown
### [P0-XXX] 问题简短描述

**发现时间**: 2026-01-07 14:30
**修复时间**: 2026-01-07 15:00
**修复人**: Claude Code AI

**问题描述**:
- 环境: 本地开发环境
- 现象: Admin Panel 启动报错 "Cannot read property 'createElement'"
- 影响: 无法启动前端开发服务器

**排查过程**:
1. 查看浏览器控制台 → 发现 React 错误
2. 检查 package.json → React 版本为 19.2.0
3. 查看 Ant Design 兼容性文档 → 不支持 React 19
4. 5-Why 分析 → 根因是依赖版本未锁定

**根本原因**:
- package.json 使用 `^18.3.1` 导致 npm update 自动升级到 React 19
- Ant Design 5.x 和腾讯云 IM SDK 不兼容 React 19

**解决方案**:
```bash
npm install react@18.3.1 react-dom@18.3.1
```
修改 package.json 移除 ^ 符号锁定精确版本

**预防措施**:
- 所有核心依赖锁定精确版本（移除 ^ 和 ~）
- CI 添加依赖版本检查脚本
- 升级依赖前必须先查阅兼容性文档

**参考 Commit**: `f9edcf6`
**关联文档**: `docs/技术架构设计总览.md#React版本策略`
```

**5.3 更新相关文档**
```bash
# 更新技术架构文档
vim docs/技术架构设计总览.md

# 更新本文档
vim docs/CLAUDE_DEV_GUIDE.md

# 提交 Git
git add .
git commit -m "fix: 锁定 React 18.3.1 版本解决 Ant Design 兼容性问题

- 移除 package.json 中 ^ 符号
- 锁定 react@18.3.1 和 react-dom@18.3.1
- 更新 TROUBLESHOOTING.md 记录问题

Refs: #123"
```

---

### 📊 问题优先级矩阵

| 影响范围 \ 严重程度 | 阻塞开发 | 功能异常 | 性能问题 |
|-------------------|---------|---------|---------|
| **生产环境全局** | P0 (立即处理) | P0 (1小时内) | P1 (当天) |
| **生产环境局部** | P0 (1小时内) | P1 (当天) | P2 (本周) |
| **测试环境** | P1 (当天) | P2 (本周) | P3 (下周) |
| **开发环境** | P1 (当天) | P2 (本周) | P3 (计划中) |

---

### 🛠️ 常用排查工具

**日志查看**:
```bash
# 后端实时日志
docker-compose -f docker-compose.local.yml logs -f api

# 前端网络请求
浏览器 F12 → Network → 过滤 XHR/Fetch

# 数据库查询日志
docker-compose logs -f db | grep "duration"

# Nginx 访问日志
docker-compose exec web cat /var/log/nginx/access.log
```

**性能分析**:
```bash
# Node.js 内存分析
node --inspect server.js
# 浏览器打开 chrome://inspect

# Chrome Performance
F12 → Performance → 录制 → 分析 FPS/内存

# Bundle 体积分析
npm run build -- --report
```

**依赖分析**:
```bash
# 查看依赖树
npm ls --depth=1

# 查找重复依赖
npm dedupe

# 检查过期依赖
npm outdated

# 审计安全漏洞
npm audit
```

**数据库性能**:
```sql
-- 查看慢查询
SELECT * FROM pg_stat_statements
WHERE mean_exec_time > 1000
ORDER BY mean_exec_time DESC
LIMIT 10;

-- 查看表膨胀
SELECT schemaname, tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- 查看锁等待
SELECT * FROM pg_locks WHERE NOT granted;
```

---

## 📚 参考文档优先级

遇到问题时的查阅顺序:

1. **本文档 (CLAUDE_DEV_GUIDE.md)** - 开发约束和规范
2. **TROUBLESHOOTING.md** - 已知问题解决方案
3. **技术架构设计总览.md** - 技术选型和架构设计
4. **BUSINESS_FLOW.md** - 业务流程规范
5. **DEPLOYMENT_GUIDE_ZH.md** - 部署运维指南
6. **CLAUDE.md** - Claude Code 使用指南
7. **产品需求文档(PRD).md** - 产品需求

---

## ⚠️ 重要提醒

1. **版本约束**:
   - Admin 使用 React 18.3.1（精确版本）
   - Mobile 使用 React 19.2.0
   - **两者完全独立，不可混用**

2. **架构原则**:
   - 后端严格遵循分层架构（handler → service → repository）
   - 禁止在 handler 直接操作数据库

3. **安全优先**:
   - 所有敏感信息使用环境变量
   - 禁止硬编码密钥/密码
   - 日志必须脱敏

4. **文档同步**:
   - 代码变更后必须同步更新相关文档
   - 重要问题必须记录到 TROUBLESHOOTING.md

5. **Git 规范**:
   - 使用规范的 commit 消息
   - 禁止直接推送到 main 分支
   - 代码提交前必须格式化

---

## 🔄 文档维护

**更新时机**:
- ✅ 技术选型变更时（如升级 React 版本）
- ✅ 架构调整时（如引入新的中间件）
- ✅ 新增重要约束时（如安全规范）
- ✅ 发现文档错误时

**更新流程**:
```bash
# 1. 编辑文档
vim docs/CLAUDE_DEV_GUIDE.md

# 2. 更新版本号和日期
最后更新: 2026-01-XX

# 3. 提交 Git
git add docs/CLAUDE_DEV_GUIDE.md
git commit -m "docs: 更新 CLAUDE_DEV_GUIDE.md - <变更说明>"
```

---

*最后更新: 2026-01-07*
*维护者: 项目技术负责人*
*文档版本: v1.0.0*
