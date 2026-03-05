# 多身份切换系统 - Home Decoration Platform

## 🎯 系统概述

多身份切换系统允许用户在同一账户下拥有多个身份（业主、服务商、工人等），并可以在不同身份之间无缝切换。

### 核心特性

- **一账户多身份**：用户可以同时是业主和服务商
- **身份隔离**：不同身份有独立的数据和权限
- **无缝切换**：切换身份后自动更新 Token 和权限
- **审计追踪**：所有身份切换操作都有审计日志

## 🏗️ 架构设计

### 数据模型

```
┌─────────────────────────────────────────────────────────────┐
│                        users                                 │
│  id | phone | username | user_type | ...                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ 1:N
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    user_identities                           │
│  id | user_id | identity_type | identity_ref_id | status    │
│     | verified | verified_at | verified_by                  │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
              ▼               ▼               ▼
        ┌──────────┐   ┌──────────┐   ┌──────────┐
        │ providers│   │ workers  │   │  (none)  │
        │ (服务商) │   │  (工人)  │   │  (业主)  │
        └──────────┘   └──────────┘   └──────────┘
```

### 身份类型

| 身份类型 | 标识符 | 关联表 | 说明 |
|---------|--------|--------|------|
| 业主 | `owner` | 无 | 默认身份，所有用户都有 |
| 服务商 | `provider` | `providers` | 设计师、装修公司、工长 |
| 工人 | `worker` | `workers` | 施工工人 |
| 管理员 | `admin` | `admins` | 后台管理员 |

### 身份状态

| 状态码 | 含义 | 说明 |
|--------|------|------|
| 0 | pending | 待审核 |
| 1 | approved | 已激活 |
| 2 | rejected | 已拒绝 |
| 3 | suspended | 已暂停 |

## 📁 文件结构

### 后端 (Go)

```
server/internal/
├── model/
│   └── user_identity.go          # 数据模型定义
│       ├── UserIdentity          # 用户身份表
│       ├── IdentityApplication   # 身份申请表
│       └── IdentityAuditLog      # 审计日志表
├── handler/
│   └── identity_handler.go       # HTTP 处理器
│       ├── GetIdentities         # 获取身份列表
│       ├── GetCurrentIdentity    # 获取当前身份
│       ├── SwitchIdentity        # 切换身份
│       └── ApplyIdentity         # 申请新身份
├── service/
│   └── identity_service.go       # 业务逻辑
│       ├── ListIdentities        # 查询身份列表
│       ├── SwitchIdentity        # 切换身份逻辑
│       ├── ApplyIdentity         # 申请身份逻辑
│       └── GetIdentityByType     # 按类型查询身份
└── router/
    └── router.go                 # 路由注册
```

### Admin Panel (React 18.3.1)

```
admin/src/
├── stores/
│   └── identityStore.ts          # Zustand 状态管理
├── components/
│   └── IdentitySwitcher/
│       ├── IdentitySwitcher.tsx  # 身份切换组件
│       └── index.ts              # 导出
├── services/
│   └── api.ts                    # identityApi 定义
└── layouts/
    └── BasicLayout.tsx           # 集成身份切换器
```

### Mobile App (React Native 19.2.0)

```
mobile/src/
├── store/
│   └── identityStore.ts          # Zustand 状态管理
├── components/
│   └── IdentitySwitcher.tsx      # 身份切换组件
├── screens/
│   └── IdentityApplicationScreen.tsx  # 身份申请页面
├── services/
│   └── api.ts                    # identityApi 定义
└── navigation/
    └── AppNavigator.tsx          # 路由注册
```

### WeChat Mini Program (Taro 3.x + React 18.3.1)

```
mini/src/
├── store/
│   └── identity.ts               # Zustand 状态管理
├── services/
│   └── identity.ts               # 身份 API 服务
├── components/
│   └── IdentitySwitcher/
│       └── index.tsx             # 身份切换组件
├── pages/
│   └── identity/
│       └── apply/
│           ├── index.tsx         # 身份申请页面
│           ├── index.config.ts   # 页面配置
│           └── index.scss        # 样式
└── utils/
    └── request.ts                # 添加 X-Active-Role 请求头
```

## 🔌 API 端点

### 身份管理 API

| 方法 | 端点 | 说明 | 认证 |
|------|------|------|------|
| GET | `/api/v1/identities` | 获取用户所有身份 | JWT |
| GET | `/api/v1/identities/current` | 获取当前激活身份 | JWT |
| POST | `/api/v1/identities/switch` | 切换身份 | JWT |
| POST | `/api/v1/identities/apply` | 申请新身份 | JWT |

### 请求/响应示例

#### 获取身份列表

```http
GET /api/v1/identities
Authorization: Bearer <token>
```

```json
{
  "code": 0,
  "message": "OK",
  "data": {
    "identities": [
      {
        "id": 1,
        "identityType": "owner",
        "status": 1,
        "verified": true,
        "displayName": "业主",
        "createdAt": "2026-01-20T10:00:00Z"
      },
      {
        "id": 2,
        "identityType": "provider",
        "status": 1,
        "verified": true,
        "refId": 123,
        "displayName": "XX装修公司",
        "createdAt": "2026-01-21T10:00:00Z"
      }
    ]
  }
}
```

#### 切换身份

```http
POST /api/v1/identities/switch
Authorization: Bearer <token>
Content-Type: application/json

{
  "targetRole": "provider",
  "currentRole": "owner"
}
```

```json
{
  "code": 0,
  "message": "OK",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 7200
  }
}
```

#### 申请新身份

```http
POST /api/v1/identities/apply
Authorization: Bearer <token>
Content-Type: application/json

{
  "identityType": "provider",
  "applicationData": "{\"companyName\":\"XX装修\",\"license\":\"xxx\"}"
}
```

```json
{
  "code": 0,
  "message": "申请已提交，请等待审核",
  "data": null
}
```

## 🔐 Token 结构

### JWT Payload (v2)

```json
{
  "user_id": 123,
  "username": "张三",
  "active_role": "provider",
  "identity_ref_id": 456,
  "exp": 1704067200
}
```

### 新增字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `active_role` | string | 当前激活的身份类型 |
| `identity_ref_id` | uint64 | 关联的 provider.id 或 worker.id |

## 🔄 状态管理

### Admin Panel (identityStore.ts)

```typescript
interface IdentityState {
  identities: Identity[];
  currentIdentity: Identity | null;
  loading: boolean;
  error: string | null;

  fetchIdentities: () => Promise<void>;
  fetchCurrentIdentity: () => Promise<void>;
  switchIdentity: (targetRole: string, currentRole?: string) => Promise<string>;
  clearError: () => void;
}
```

### Mobile App (identityStore.ts)

```typescript
interface IdentityState {
  identities: Identity[];
  currentIdentity: Identity | null;
  loading: boolean;
  error: string | null;

  fetchIdentities: () => Promise<void>;
  switchIdentity: (identityId: number) => Promise<void>;
  applyIdentity: (identityType: string, documents?: string[]) => Promise<void>;
  clearError: () => void;
}
```

### WeChat Mini Program (identity.ts)

```typescript
interface IdentityState {
  identities: Identity[];
  currentIdentity?: Identity;
  loading: boolean;
  error: string | null;

  fetchIdentities: () => Promise<void>;
  switchIdentity: (identityId: number) => Promise<void>;
  applyIdentity: (identityType: string, documents?: string[]) => Promise<void>;
  clear: () => void;
}
```

## 🛡️ 安全机制

### 1. 切换限流

- **限制**：5 次/分钟
- **实现**：Redis INCR + EXPIRE
- **Key 格式**：`identity_switch:{userId}`

### 2. 审计日志

所有身份切换操作都会记录到 `identity_audit_logs` 表：

```sql
CREATE TABLE identity_audit_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  action VARCHAR(64) NOT NULL,      -- switch, apply, approve, reject, suspend
  from_identity VARCHAR(32),
  to_identity VARCHAR(32),
  ip_address VARCHAR(50),
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 3. 身份验证

- 切换前验证目标身份存在且状态为 `approved`
- Token 中包含 `active_role` 用于后续请求的权限验证

## 📱 前端集成

### Admin Panel

身份切换器集成在 `BasicLayout.tsx` 的头部导航栏：

```tsx
import { IdentitySwitcher } from '@/components/IdentitySwitcher';

// 在 Header 中使用
<Header>
  <IdentitySwitcher />
  {/* 其他组件 */}
</Header>
```

### Mobile App

身份切换器集成在 `ProfileScreen.tsx`：

```tsx
import IdentitySwitcher from '@/components/IdentitySwitcher';

// 在个人中心页面使用
<View>
  <IdentitySwitcher />
  {/* 其他内容 */}
</View>
```

### WeChat Mini Program

身份切换器集成在 `pages/profile/index.tsx`：

```tsx
import IdentitySwitcher from '@/components/IdentitySwitcher';

// 在个人中心页面使用
<View>
  <IdentitySwitcher />
  {/* 其他内容 */}
</View>
```

## 🔗 相关文档

- [后端分层架构](backend-layers.md)
- [认证授权系统](auth-system.md)（待创建）
- [API 端点列表](../reference/api-endpoints.md)（待创建）

---

**最后更新**：2026-01-26
**Phase**：Phase 6 - Frontend Identity Switching Integration
