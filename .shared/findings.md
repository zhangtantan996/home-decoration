# 项目分析发现文档

## 最后更新
2026-01-10

---

## 第1章：项目概览与技术栈

### 1.1 项目基本信息
- **项目名称**: 家装平台（装修设计一体化平台）
- **项目类型**: 多端应用（后端API + 管理面板 + 移动端 + 小程序）
- **主要功能**: 连接业主与设计师、施工公司、工长、工人
- **仓库结构**: Monorepo（单仓库多项目）
- **文档总数**: 31篇（截至 2026-01-07）
- **安全评分**: 9.2/10（已修复所有P0/P1高危问题）

### 1.2 技术栈版本锁定（强制遵守）

#### React 版本策略（混合版本）
这是项目的**关键约束**，必须严格遵守：

| 组件 | React 版本 | 禁止使用 | 原因 |
|------|-----------|----------|------|
| **Admin Panel** | 18.3.1（精确版本） | React 19.x | Ant Design 5.x 和腾讯云 IM SDK 不兼容 React 19 |
| **Mobile App** | 19.2.0 | React 18.x | React Native 0.83 支持 React 19，使用最新特性 |

**重要说明**:
- Admin 和 Mobile 是**完全独立**的项目，各有独立的 package.json
- Admin 的 React 版本已锁定（无 `^` 符号），禁止自动升级
- 两个项目互不影响，不会发生版本冲突

#### 完整技术栈

| 类别 | 技术 | 版本 | 说明 |
|------|------|------|------|
| **后端** | Go + Gin | 1.23 | RESTful API + WebSocket |
| **数据库** | PostgreSQL | 15 | 主数据库 |
| **缓存** | Redis | 6.2 | 缓存 + 限流 + 会话 |
| **ORM** | GORM | - | 数据访问层 |
| **Admin** | React + Vite | 18.3.1 | 管理后台 |
| **Admin UI** | Ant Design | 5.29.2 | UI 组件库 |
| **Mobile** | React Native | 0.83.0 | 原生移动端（iOS/Android） |
| **状态管理** | Zustand | - | Admin + Mobile 统一使用 |
| **Node.js** | ≥ 20 | - | 依赖库最低要求 |
| **容器化** | Docker Compose | - | 本地开发 + 生产部署 |

### 1.3 系统架构组件

```
┌─────────────────────────────────────────────────────────┐
│                    用户端（多端接入）                      │
├─────────────────────────────────────────────────────────┤
│  Mobile App (iOS/Android)  │  小程序  │  Admin Panel   │
│   React Native 0.83        │   待确认  │  React 18.3.1  │
└─────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────┐
│                   Nginx 反向代理                          │
│  - Admin: /admin/*                                      │
│  - API: /api/v1/*                                       │
│  - WebSocket: /api/v1/ws                                │
└─────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────┐
│              Go Backend API (Gin Framework)             │
├─────────────────────────────────────────────────────────┤
│  Middleware 层                                           │
│  - CORS 跨域                                             │
│  - JWT 认证                                              │
│  - RBAC 权限                                             │
│  - 限流保护（登录 5次/分钟）                               │
│  - 安全响应头（X-Frame-Options, CSP 等）                  │
├─────────────────────────────────────────────────────────┤
│  分层架构（强制）                                         │
│  Handler → Service → Repository → Model                 │
├─────────────────────────────────────────────────────────┤
│  WebSocket Hub（实时聊天）                               │
└─────────────────────────────────────────────────────────┘
                    ↓                    ↓
        ┌───────────────────┐  ┌──────────────────┐
        │   PostgreSQL 15   │  │    Redis 6.2     │
        │   - 主数据存储     │  │  - 缓存          │
        │   - 事务支持       │  │  - 限流          │
        │   - 全文搜索       │  │  - 会话          │
        └───────────────────┘  └──────────────────┘
```

### 1.4 仓库目录结构

```
home_decoration/
├── server/               # Go 后端
│   ├── cmd/api/         # 入口文件
│   ├── internal/        # 核心业务代码
│   │   ├── handler/     # HTTP 处理器
│   │   ├── service/     # 业务逻辑层
│   │   ├── repository/  # 数据访问层
│   │   ├── model/       # 数据模型
│   │   ├── middleware/  # 中间件
│   │   ├── router/      # 路由定义
│   │   └── ws/          # WebSocket
│   ├── pkg/             # 公共工具包
│   ├── config.yaml      # 配置文件（环境变量）
│   └── scripts/         # SQL 脚本和迁移
├── admin/               # React Admin 管理面板
│   ├── src/
│   │   ├── pages/       # 页面组件（PascalCase.tsx）
│   │   ├── components/  # 公共组件
│   │   ├── stores/      # Zustand 状态管理
│   │   ├── services/    # API 封装（camelCase.ts）
│   │   └── router.tsx   # 路由配置（/admin 前缀）
│   └── package.json     # React 18.3.1（精确版本）
├── mobile/              # React Native 移动端
│   ├── src/
│   │   ├── screens/     # 页面组件
│   │   ├── components/  # 公共组件
│   │   ├── stores/      # 状态管理
│   │   ├── navigation/  # 导航配置
│   │   └── services/    # API + WebSocket
│   └── package.json     # React 19.2.0
├── mini/                # 小程序（待确认是否纳入分析）
├── deploy/              # 部署配置
│   ├── Dockerfile.backend
│   ├── Dockerfile.frontend
│   ├── docker-compose.prod.yml
│   └── nginx/
├── docs/                # 项目文档（31篇）
└── .shared/             # 规划文件（本次分析）
    ├── task_plan.md
    ├── findings.md
    └── progress.md
```

### 1.5 核心开发约束（P0优先级）

#### 1.5.1 架构约束
1. **后端分层架构（强制）**:
   - 禁止在 Handler 直接操作数据库
   - 必须遵循: Handler → Service → Repository → Model
   - 所有业务逻辑放在 Service 层

2. **前端路由约束**:
   - Admin 所有路由必须有 `/admin` 前缀
   - Mobile 使用 React Navigation Stack（禁止 react-router）

3. **API 调用约束**:
   - 必须使用统一的 API Client（`src/services/api.ts`）
   - 禁止直接使用 `fetch` 或 `axios`

#### 1.5.2 文件命名规范
- **Go 后端**: 100% snake_case（例: `user_handler.go`, `provider_service.go`）
- **React 组件**: PascalCase.tsx（例: `UserList.tsx`, `DashboardIndex.tsx`）
- **工具/服务文件**: camelCase.ts（例: `api.ts`, `authStore.ts`）
- **类/接口文件**: PascalCase.ts（例: `SecureStorage.ts`, `WebSocketService.ts`）

#### 1.5.3 UI 组件库约束（严格禁止混用）
- **Admin Panel**: 仅允许 Ant Design 5.x 生态
  - ✅ antd, @ant-design/pro-components, @ant-design/charts
  - ❌ 禁止: Material-UI, Chakra UI, Semantic UI
- **Mobile App**: 原生组件 + lucide-react-native
  - ❌ 禁止: React Native Paper, NativeBase

### 1.6 安全机制（已完成修复）

#### 高危问题修复（P0级别）
1. ✅ JWT 密钥泄露 - 移除 .env.example 真实密钥
2. ✅ 调试端点暴露 - 生产环境完全禁用 `/api/v1/debug/*`
3. ✅ 加密密钥默认值 - 强制设置 `ENCRYPTION_KEY`
4. ✅ Docker 默认弱密码 - 强制设置环境变量
5. ✅ 配置硬编码密码 - config.yaml 使用环境变量

#### 安全机制
- **认证**: JWT Token（8小时有效期）
- **授权**: RBAC 权限体系（角色-菜单-权限）
- **限流**: 登录接口 5次/分钟
- **加密**: AES-256-GCM 加密敏感数据
- **安全响应头**: X-Frame-Options, CSP, X-Content-Type-Options 等
- **移动端**: iOS Keychain 存储 Token

### 1.7 已知问题与解决方案

根据 TROUBLESHOOTING.md，项目已记录并修复以下问题：

| 问题ID | 问题描述 | 优先级 | 状态 |
|--------|---------|--------|------|
| P0-001 | Admin Panel React 19 不兼容 | P0 | ✅ 已修复（锁定 18.3.1） |
| P0-002 | Docker 构建内存不足 | P0 | ✅ 已修复（NODE_OPTIONS=8192MB） |
| P0-003 | TUIKit 缺失依赖 | P0 | ✅ 已修复（补充 peerDependencies） |
| P1-001 | Android APK 签名失败 | P1 | 📋 已记录解决方案 |

### 1.8 文档体系

项目拥有完善的文档体系（31篇），按优先级分类：

#### P0 核心文档（必读）
1. **CLAUDE_DEV_GUIDE.md** - AI 开发约束手册
2. **TROUBLESHOOTING.md** - 问题排查和解决方案
3. **技术架构设计总览.md** - 完整技术栈和架构设计
4. **产品需求文档(PRD).md** - 产品蓝图和功能定义
5. **DEPLOYMENT_GUIDE_ZH.md** - 完整部署指南

#### 功能文档
- 字典系统完整指南.md
- REGION_MANAGEMENT_GUIDE.md
- SERVICE_AREA_MIGRATION_GUIDE.md

#### 部署运维文档（12篇）
- 包含 Docker、Git、Android 打包等完整指南

### 1.9 待确认事项
- ❓ `mini/` 小程序目录是否纳入分析范围（需用户确认）

---

## 第2章：后端架构设计

### 2.1 运行时架构

#### 2.1.1 启动初始化流程
后端启动遵循严格的依赖初始化顺序（server/cmd/api/main.go:17-77）：

```
1. 加载配置 (config.Load)
   ↓
2. 初始化数据库 (repository.InitDB)
   ↓
3. 初始化 Redis (repository.InitRedis)
   ↓
4. 启动 WebSocket Hub (ws.NewHub → go hub.Run)
   ↓
5. 初始化处理器 (handler.InitHandlers)
   ↓
6. 初始化字典服务 (DictRepo → DictCache → DictService)
   ↓
7. 启动定时任务 (3个 Cron Jobs)
   ↓
8. 设置运行模式 (gin.SetMode)
   ↓
9. 初始化路由 (router.Setup)
   ↓
10. 启动 HTTP 服务器 (r.Run)
```

**关键依赖**:
- **数据库**: PostgreSQL（GORM ORM）
- **缓存**: Redis（用于字典缓存、限流、会话）
- **实时通信**: WebSocket Hub（独立 goroutine）
- **定时任务**: 3个 Cron Jobs（订单、预约、收入结算）

#### 2.1.2 定时任务清单
| Cron Job | 文件 | 功能 | 启动位置 |
|---------|------|------|---------|
| OrderCron | internal/cron/ | 订单超时处理 | main.go:54 |
| BookingCron | internal/cron/ | 预约超时处理 | main.go:57 |
| IncomeCron | internal/cron/ | 收入结算 | main.go:60 |

#### 2.1.3 WebSocket 架构
- **Hub 模式**: 中心化消息分发器（ws.Hub）
- **独立 goroutine**: `go hub.Run()` 在后台运行
- **鉴权**: 通过 JWT 中间件保护（已切换到腾讯云 IM）
- **状态**: 旧版 WebSocket 已废弃，保留供回滚（router.go:91, 234-241）

#### 2.1.4 依赖注入示例
字典服务采用完整的依赖注入模式（main.go:47-51）：

```go
dictRepo := repository.NewDictionaryRepository(repository.DB)
dictCache := service.NewDictCacheService()
dictService := service.NewDictionaryService(dictRepo, dictCache)
dictHandler := handler.NewDictionaryHandler(dictService)
```

遵循分层架构：Repository → Service → Handler

### 2.2 API 表面与路由分组

#### 2.2.1 路由统计
- **总端点数**: ~150+ 个 API 端点
- **代码行数**: router.go 483行
- **路由前缀**: `/api/v1`
- **主要分组**: 3个（普通用户、Admin、Merchant）

#### 2.2.2 全局中间件栈（按顺序执行）
| 中间件 | 文件 | 功能 | 优先级 |
|--------|------|------|--------|
| SecurityHeaders | middleware/security.go | 安全响应头（CSP, X-Frame-Options 等） | P0 |
| Cors | middleware/cors.go | CORS 白名单（6个允许域名） | P0 |
| Logger | middleware/ | 请求日志 | P1 |
| Recovery | middleware/ | Panic 恢复 | P0 |
| RateLimit | middleware/ | API 全局限流 | P1 |
| AuditLogger | middleware/ | 审计日志 | P2 |

**CORS 白名单**（router.go:16-23）:
```
- http://localhost:5173-5176  // Admin 开发环境
- http://localhost:3000       // Mobile 开发环境
- https://admin.yourdomain.com // 生产环境（待替换）
```

#### 2.2.3 路由分组架构

##### A. 公开端点（无需认证）
| 路由组 | 端点数 | 主要功能 |
|--------|--------|---------|
| `/auth` | 6个 | 注册、登录、发送验证码、微信小程序登录、刷新Token |
| `/providers` | 1个 | 公开查询服务商列表 |
| `/material-shops` | 2个 | 主材门店列表和详情 |
| `/dictionaries` | 2个 | 字典分类和选项（公开） |
| `/regions` | 4个 | 行政区划 API（级联选择器） |
| `/health` | 1个 | 健康检查 |

**安全增强**（router.go:42-50）:
- 登录相关端点全部添加 `LoginRateLimit()` 中间件（5次/分钟）
- 防止暴力破解和短信轰炸

##### B. 普通用户端点（需要 JWT 认证）
使用 `middleware.JWT(cfg.JWT.Secret)` 保护（router.go:88）

**核心业务域**:
| 域 | 路由前缀 | 端点数 | 主要功能 |
|---|---------|--------|---------|
| 用户管理 | `/user` | 2个 | 个人资料 CRUD |
| 服务商查询 | `/designers`, `/companies`, `/foremen` | 各5个 | 查询设计师/公司/工长，查看作品和评价 |
| 预约管理 | `/bookings` | 6个 | 创建预约、支付意向金、取消预约 |
| 售后管理 | `/after-sales` | 4个 | 售后工单 CRUD |
| 项目管理 | `/projects` | 15个 | 项目全生命周期、托管账户、账单 |
| 阶段管理 | `/phases` | 2个 | 更新阶段和任务 |
| 方案管理 | `/proposals` | 6个 | 查看方案、确认/拒绝、版本历史 |
| 订单管理 | `/orders` | 4个 | 订单查询、支付、取消、分期 |
| 关注收藏 | `/providers/:id/follow` | 4个 | 关注/取消关注、收藏/取消收藏 |
| 腾讯云 IM | `/im` | 1个 | 获取 UserSig |
| 文件上传 | `/upload` | 1个 | 通用上传接口 |
| 通知系统 | `/notifications` | 5个 | 通知列表、未读数、已读、删除 |

**已废弃功能**（router.go:90-91, 234-241）:
- 旧版 WebSocket 聊天（已切换到腾讯云 IM）
- 旧版聊天路由已注释，保留供回滚

##### C. Admin 管理后台端点
使用 `middleware.AdminJWT(cfg.JWT.Secret)` 保护（router.go:250）

**额外中间件**:
- `AdminLog()` - 记录所有管理员操作（router.go:251）

**功能模块**（约80+个端点）:
| 模块 | 端点数 | 主要功能 |
|------|--------|---------|
| 统计面板 | 3个 | 数据概览、趋势、分布 |
| 用户管理 | 5个 | 用户 CRUD、状态管理 |
| 管理员管理 | 5个 | 管理员 CRUD、状态管理 |
| 服务商管理 | 5个 | 服务商 CRUD、认证、状态 |
| 预约管理 | 4个 | 预约列表、状态更新、退款 |
| 评价管理 | 2个 | 评价列表、删除 |
| 主材门店 | 5个 | 门店 CRUD、认证 |
| 审核管理 | 8个 | 服务商审核、门店审核、作品审核 |
| 作品管理 | 4个 | 作品 CRUD |
| 字典管理 | 7个 | 字典 CRUD、分类管理 |
| 行政区划 | 3个 | 地区管理、启用/禁用 |
| 财务管理 | 3个 | 托管账户、交易记录、提现 |
| 风险管理 | 4个 | 风险预警、仲裁 |
| 系统设置 | 2个 | 系统配置 CRUD |
| 系统配置 | 3个 | 平台抽成等配置 |
| 提现审核 | 4个 | 提现列表、审批/拒绝 |
| 操作日志 | 1个 | 日志查询 |
| RBAC 权限 | 9个 | 角色、菜单管理 |
| 商家入驻审核 | 4个 | 申请审核 |
| 项目管理 | 8个 | 项目监控、阶段管理、日志 |
| 争议预约 | 3个 | 争议处理 |
| 通知系统 | 5个 | 与普通用户共用 |

##### D. Merchant 商家端端点
使用 `middleware.MerchantJWT(cfg.JWT.Secret)` 保护（router.go:417）

**入驻流程**（无需认证）:
- `/merchant/apply` - 商家入驻申请
- `/merchant/apply/:phone/status` - 查询申请状态
- `/merchant/apply/:id/resubmit` - 重新提交
- `/merchant/login` - 商家登录

**商家端功能**（约30+个端点）:
| 模块 | 端点数 | 主要功能 |
|------|--------|---------|
| 个人信息 | 4个 | 信息查询/更新、头像上传、图片上传 |
| 预约管理 | 3个 | 预约列表、详情、处理 |
| 方案管理 | 8个 | 方案 CRUD、重新提交、重新开放 |
| 订单管理 | 1个 | 订单列表 |
| 仪表盘 | 1个 | 商家统计数据 |
| 收入中心 | 2个 | 收入汇总、明细列表 |
| 提现管理 | 2个 | 提现列表、创建提现 |
| 银行账户 | 4个 | 账户 CRUD、设置默认 |
| 作品集管理 | 7个 | 作品 CRUD、排序、取消审核 |
| 通知系统 | 5个 | 与普通用户共用 |
| 腾讯云 IM | 1个 | 获取 UserSig |

#### 2.2.4 调试端点安全策略
**位置**: router.go:74-84

**保护机制**（三重防护）:
1. ✅ **环境检查**: `if cfg.Server.Mode != "release"` - 生产环境完全禁用
2. ✅ **管理员认证**: `middleware.AdminJWT(cfg.JWT.Secret)`
3. ✅ **权限验证**: `middleware.RequirePermission("system:debug:*")`

**调试端点**:
- `GET /debug/fix-data` - 数据修复
- `POST /debug/init-settings` - 初始化设置

**安全评分**: ✅ P0 高危问题已修复（见 SECURITY.md P0-002）

### 2.3 分层架构关键发现

#### 2.3.1 严格的分层约束
项目强制遵循以下调用链（CLAUDE_DEV_GUIDE.md:129-154）:
```
HTTP Request → Handler → Service → Repository → Model
```

**禁止操作**:
- ❌ Handler 直接操作数据库（GORM）
- ❌ Handler 包含业务逻辑
- ❌ 跨层调用

#### 2.3.2 文件命名规范
- **Go 文件**: 100% snake_case（例: `user_handler.go`, `provider_service.go`）
- **目录结构**: internal/handler/, internal/service/, internal/repository/

### 2.4 待深入分析的模块

根据 router.go 的端点分布，以下模块需要端到端分析：

#### 优先级 P0（核心业务闭环）
1. **预约-方案-支付-托管-项目** 闭环
   - 涉及文件: booking_handler.go, proposal_handler.go, order_handler.go, escrow_service.go, project_handler.go
   - 涉及定时任务: OrderCron, BookingCron, IncomeCron
   - 状态机: Booking Status, Proposal Status, Order Status, Project Status

2. **RBAC 权限体系**
   - 涉及文件: admin_handler.go, role/menu models, permission middleware
   - 涉及文档: docs/RBAC权限体系管理.md

#### 优先级 P1（重要功能）
3. **商家入驻审核流程**
   - merchant_apply_handler.go → admin approve/reject → provider creation

4. **字典系统**
   - dictionary_handler.go, dict_cache_service.go
   - 涉及文档: docs/字典系统完整指南.md

#### 优先级 P2（可选）
5. **WebSocket 聊天**（已废弃，但代码保留）
   - ws/hub.go, ws/handler.go

### 2.5 关键技术特性

#### 2.5.1 安全机制汇总
- ✅ JWT 三分离策略（普通用户/Admin/Merchant 不同中间件）
- ✅ 登录限流（5次/分钟）
- ✅ CORS 白名单（6个域名）
- ✅ 安全响应头（X-Frame-Options, CSP 等）
- ✅ 审计日志（所有 Admin 操作）
- ✅ 调试端点三重保护

#### 2.5.2 特殊路由模式
- **懒加载**: `/regions/children/:parentCode` - 级联选择器懒加载
- **版本历史**: `/proposals/booking/:bookingId/history` - 方案版本管理
- **批量操作**: `/system-configs/batch` - 批量更新配置

#### 2.5.3 已废弃但保留的功能
1. 旧版 WebSocket 聊天（router.go:90-91, 234-241）
2. 旧版聊天路由注释（chat conversations/messages/unread-count）

### 2.6 数据流关键节点

根据路由定义，识别出以下关键数据流：

```
用户注册/登录
    ↓
浏览服务商（designers/companies/foremen）
    ↓
创建预约（bookings） + 支付意向金
    ↓
商家处理预约 → 提交方案（proposals）
    ↓
用户确认方案 → 生成订单（orders）
    ↓
支付订单 → 创建项目（projects）
    ↓
项目分阶段交付（phases） + 托管账户（escrow）
    ↓
里程碑验收（milestones） → 资金释放
    ↓
项目完成 → 评价（reviews）
```

### 2.7 未解问题清单
- ❓ Handler/Service/Repository 具体实现细节（待端到端分析）
- ❓ 3个定时任务的具体逻辑和触发时机
- ❓ WebSocket Hub 的消息协议和存储机制
- ❓ 托管账户的资金流转和安全控制
- ❓ RBAC 权限的实际执行机制（菜单 vs 按钮级别）

---

## 第3章：数据库设计和关键模型

### 3.1 数据库概览

#### 3.1.1 数据库架构

- **数据库类型**: PostgreSQL 15
- **ORM**: GORM（Go ORM）
- **表总数**: 40+ 张表
- **模型文件**: 7个文件（约900行代码）
- **字段数量**: 200+ 个核心业务字段

#### 3.1.2 表分类统计

| 分类 | 表数量 | 主要表 |
|------|--------|-------|
| **用户与认证** | 4张 | users, user_wechat_bindings, admins, sys_admins |
| **服务商生态** | 6张 | providers, provider_cases, provider_reviews, workers, material_shops |
| **核心业务流程** | 8张 | bookings, proposals, orders, payment_plans, projects, project_phases, phase_tasks, milestones |
| **资金与托管** | 5张 | escrow_accounts, transactions, merchant_incomes, merchant_withdraws, merchant_bank_accounts |
| **审核与审批** | 5张 | merchant_applications, case_audits, provider_audits, material_shop_audits, after_sales |
| **权限与RBAC** | 7张 | sys_admins, sys_roles, sys_menus, sys_admin_roles, sys_role_menus |
| **系统配置** | 5张 | system_configs, system_dictionaries, dictionary_categories, regions, notifications |
| **其他** | 5张 | work_logs, user_follows, user_favorites, chat_conversations (废弃), chat_messages (废弃) |

#### 3.1.3 命名规范

- **表名**: 蛇形命名（snake_case），复数形式（例: `provider_cases`, `merchant_incomes`）
- **字段名**: 驼峰命名（camelCase），GORM 自动转换为蛇形
- **主键**: 统一使用 `id` (uint64 类型)
- **时间戳**: `created_at`, `updated_at` (自动维护)

### 3.2 核心表结构详解

#### 3.2.1 用户与认证模块

##### users（用户表）

**文件**: `server/internal/model/model.go:14-26`

| 字段名 | 类型 | 约束 | 说明 |
|-------|------|------|------|
| id | uint64 | PK | 主键 |
| phone | string(20) | UniqueIndex | 手机号（唯一） |
| nickname | string(50) | - | 昵称 |
| avatar | string(500) | - | 头像URL |
| password | string(255) | - | 密码哈希（不返回给前端） |
| user_type | int8 | - | 用户类型：1业主 2服务商 3工人 4管理员 |
| status | int8 | Default: 1 | 状态：1正常 0封禁 |
| login_failed_count | int | Default: 0 | 登录失败次数（防暴力破解） |
| locked_until | *time.Time | - | 锁定到期时间 |
| last_failed_login_at | *time.Time | - | 最后失败登录时间 |
| created_at | time.Time | Auto | 创建时间 |
| updated_at | time.Time | Auto | 更新时间 |

**关键索引**:
- `phone`: UniqueIndex（唯一索引）

**安全机制**:
- `json:"-"` 标签：password, login_failed_count, locked_until, last_failed_login_at 不返回给前端
- 登录失败计数：超过阈值自动锁定账户

##### user_wechat_bindings（微信绑定关系）

**文件**: `server/internal/model/model.go:28-37`

| 字段名 | 类型 | 约束 | 说明 |
|-------|------|------|------|
| id | uint64 | PK | 主键 |
| user_id | uint64 | Index, UniqueIndex(user_app) | 用户ID |
| app_id | string(64) | UniqueIndex(user_app, app_openid) | 小程序AppID |
| open_id | string(128) | UniqueIndex(app_openid) | 微信OpenID |
| union_id | string(128) | Index | 微信UnionID（同一主体多个应用共享） |
| bound_at | *time.Time | - | 绑定时间 |
| last_login_at | *time.Time | - | 最后登录时间 |

**关键索引**:
- `idx_user_wechat_user_app`: (user_id, app_id) 联合唯一索引
- `idx_user_wechat_app_openid`: (app_id, open_id) 联合唯一索引
- `union_id`: 普通索引

**设计要点**:
- 支持多小程序绑定同一用户（通过 UnionID 关联）
- AppID + OpenID 联合唯一（防止重复绑定）

#### 3.2.2 服务商生态模块

##### providers（服务商表）

**文件**: `server/internal/model/model.go:39-72`

| 字段名 | 类型 | 约束 | 说明 |
|-------|------|------|------|
| id | uint64 | PK | 主键 |
| user_id | uint64 | Index | 关联用户ID |
| provider_type | int8 | - | 服务商类型：1设计师 2公司 3工长 |
| sub_type | string(20) | Default: 'personal' | 子类型：personal, studio, company |
| company_name | string(100) | - | 公司名称 |
| license_no | string(50) | - | 营业执照号 |
| rating | float32 | Default: 0 | 综合评分 |
| restore_rate | float32 | - | 还原度评分 |
| budget_control | float32 | - | 预算控制力评分 |
| completed_cnt | int | Default: 0 | 完成案例数 |
| verified | bool | Default: false | 是否已认证 |
| status | int8 | Default: 1 | 状态：1正常 0封禁 |
| latitude | float64 | - | 纬度（用于地理位置搜索） |
| longitude | float64 | - | 经度 |
| years_experience | int | Default: 0 | 从业年限 |
| specialty | string(200) | - | 专长/风格描述 |
| work_types | string(100) | - | 工种类型（逗号分隔） |
| review_count | int | Default: 0 | 评价数量 |
| price_min | float64 | Default: 0 | 最低价格 |
| price_max | float64 | Default: 0 | 最高价格 |
| price_unit | string(20) | Default: '元/天' | 价格单位 |
| cover_image | string(500) | - | 封面背景图 |
| followers_count | int | Default: 0 | 粉丝/关注数 |
| service_intro | text | - | 服务介绍 |
| team_size | int | Default: 1 | 团队规模 |
| established_year | int | Default: 2020 | 成立年份 |
| certifications | text | - | 资质认证（JSON数组） |
| service_area | text | - | 服务区域（JSON数组） |
| office_address | string(200) | - | 办公地址 |

**关键索引**:
- `user_id`: Index（用于快速查询用户关联的服务商）

**设计要点**:
- 支持地理位置搜索（latitude + longitude）
- JSON字段存储：certifications, service_area（PostgreSQL JSONB类型）
- 多维度评分：rating, restore_rate, budget_control

##### provider_cases（服务商案例）

**文件**: `server/internal/model/model.go:74-88`

| 字段名 | 类型 | 约束 | 说明 |
|-------|------|------|------|
| id | uint64 | PK | 主键 |
| provider_id | uint64 | Index | 服务商ID（外键） |
| title | string(100) | - | 案例标题 |
| cover_image | string(500) | - | 封面图 |
| style | string(50) | - | 风格标签 |
| layout | string(50) | - | 户型（例: 3室2厅） |
| area | string(20) | - | 面积（例: 120㎡） |
| price | float64 | Default: 0 | 总价（万元） |
| year | string(10) | - | 年份 |
| description | text | - | 案例描述 |
| images | text | - | 案例图片（JSON数组） |
| sort_order | int | Default: 0 | 排序权重 |

**关键索引**:
- `provider_id`: Index

**设计要点**:
- sort_order 支持手动排序
- images 存储多张图片URL（JSON数组）

##### provider_reviews（服务商评价）

**文件**: `server/internal/model/model.go:90-105`

| 字段名 | 类型 | 约束 | 说明 |
|-------|------|------|------|
| id | uint64 | PK | 主键 |
| provider_id | uint64 | Index | 服务商ID |
| user_id | uint64 | Index | 评价用户ID |
| rating | float32 | - | 评分（1-5星） |
| content | text | - | 评价内容 |
| images | text | - | 评价图片（JSON数组） |
| service_type | string(20) | - | 服务类型：全包、半包、局部 |
| area | string(20) | - | 面积 |
| style | string(50) | - | 风格 |
| tags | string(200) | - | 评价标签（JSON数组） |
| helpful_count | int | Default: 0 | 有用数（点赞） |
| reply | text | - | 商家回复 |
| reply_at | *time.Time | - | 回复时间 |

**关键索引**:
- `provider_id`: Index
- `user_id`: Index

**设计要点**:
- 支持商家回复评价
- helpful_count 用于评价排序

#### 3.2.3 核心业务流程模块

##### bookings（预约记录）

**文件**: `server/internal/model/model.go:210-232`

| 字段名 | 类型 | 约束 | 说明 |
|-------|------|------|------|
| id | uint64 | PK | 主键 |
| user_id | uint64 | Index | 用户ID |
| provider_id | uint64 | Index | 服务商ID |
| provider_type | string(20) | - | 服务商类型：designer, worker, company |
| address | string(200) | - | 装修地址 |
| area | float64 | - | 面积（平方米） |
| renovation_type | string(50) | - | 装修类型 |
| budget_range | string(50) | - | 预算范围 |
| preferred_date | string(100) | - | 期望上门时间 |
| phone | string(20) | - | 联系电话 |
| notes | text | - | 备注说明 |
| house_layout | string(50) | - | 户型（例: 3室2厅2卫） |
| status | int8 | Default: 1 | 状态：1pending, 2confirmed, 3completed, 4cancelled, 5disputed |
| intent_fee | float64 | Default: 0 | 意向金金额（从SystemConfig读取） |
| intent_fee_paid | bool | Default: false | 是否已支付意向金 |
| intent_fee_deducted | bool | Default: false | 是否已抵扣至设计费 |
| intent_fee_refunded | bool | Default: false | 是否已退款 |
| intent_fee_refund_reason | string(200) | - | 退款原因 |
| intent_fee_refunded_at | *time.Time | - | 退款时间 |
| merchant_response_deadline | *time.Time | - | 商家响应截止时间（48小时） |

**关键索引**:
- `user_id`: Index
- `provider_id`: Index

**业务逻辑字段**:
- `intent_fee_paid`: 控制商家响应期限启动
- `intent_fee_deducted`: 防止意向金重复抵扣
- `merchant_response_deadline`: 超时触发自动退款（BookingCron）

##### proposals（设计方案）

**文件**: `server/internal/model/business_flow.go:45-70`

| 字段名 | 类型 | 约束 | 说明 |
|-------|------|------|------|
| id | uint64 | PK | 主键 |
| booking_id | uint64 | Index | 预约ID（外键） |
| provider_id | uint64 | Index | 服务商ID |
| user_id | uint64 | Index | 用户ID |
| version | int | Default: 1 | 方案版本号（v1, v2, v3...） |
| parent_proposal_id | uint64 | Index | 上一版本方案ID（链表结构） |
| title | string(100) | - | 方案标题 |
| description | text | - | 方案描述 |
| design_fee | float64 | Default: 0 | 设计费 |
| construction_fee | float64 | Default: 0 | 施工费 |
| material_fee | float64 | Default: 0 | 主材费 |
| images | text | - | 方案图片（JSON数组） |
| files | text | - | 附件文件（JSON数组） |
| status | int8 | Default: 1 | 状态：1pending, 2confirmed, 3rejected, 4superseded |
| rejection_count | int | Default: 0 | 累计拒绝次数（达到3次转入争议） |
| rejection_reason | string(500) | - | 拒绝原因 |
| rejected_at | *time.Time | - | 拒绝时间 |
| confirmed_at | *time.Time | - | 确认时间 |
| user_response_deadline | *time.Time | - | 用户响应截止时间（14天） |

**关键索引**:
- `booking_id`: Index
- `provider_id`: Index
- `user_id`: Index
- `parent_proposal_id`: Index（支持版本链查询）

**版本管理字段**:
- `version`: 版本号递增
- `parent_proposal_id`: 指向上一版本（支持版本历史查询）
- `rejection_count`: 继承自上一版本，用于3次拒绝限制

##### orders（订单）

**文件**: `server/internal/model/business_flow.go:72-91`

| 字段名 | 类型 | 约束 | 说明 |
|-------|------|------|------|
| id | uint64 | PK | 主键 |
| order_no | string(32) | UniqueIndex | 订单号（唯一） |
| user_id | uint64 | Index | 用户ID |
| provider_id | uint64 | Index | 服务商ID |
| proposal_id | uint64 | Index | 关联方案ID |
| order_type | string(20) | Index | 订单类型：design, construction, material |
| total_amount | float64 | - | 订单总额 |
| discount | float64 | Default: 0 | 优惠金额（意向金抵扣） |
| final_amount | float64 | - | 实际支付金额 |
| status | int8 | Default: 0 | 状态：0pending, 1paid, 2cancelled |
| paid_at | *time.Time | - | 支付时间 |
| expire_at | *time.Time | - | 支付过期时间（48小时） |

**关键索引**:
- `order_no`: UniqueIndex
- `user_id`, `provider_id`, `proposal_id`: Index
- `order_type`: Index（按类型查询）

**业务逻辑字段**:
- `discount`: 意向金抵扣金额（仅设计费订单）
- `expire_at`: 超时触发自动取消（OrderCron）

##### payment_plans（支付计划）

**文件**: `server/internal/model/business_flow.go:93-110`

| 字段名 | 类型 | 约束 | 说明 |
|-------|------|------|------|
| id | uint64 | PK | 主键 |
| order_id | uint64 | Index | 关联订单ID |
| type | string(20) | - | 分期类型：milestone, onetime |
| seq | int | - | 期数顺序（1, 2, 3, 4） |
| name | string(50) | - | 分期名称（例: "开工款", "水电款"） |
| percentage | float32 | - | 比例（例: 30, 35, 30, 5） |
| amount | float64 | - | 金额 |
| milestone_id | uint64 | - | 关联验收节点ID |
| status | int8 | Default: 0 | 状态：0pending, 1paid |
| paid_at | *time.Time | - | 支付时间 |

**关键索引**:
- `order_id`: Index

**默认分期方案**:
1. 开工款：30%
2. 水电款：35%
3. 中期款：30%
4. 尾款：5%

**支付顺序控制**:
- `seq` 字段控制支付顺序
- 必须按顺序支付（检查前置期是否已支付）

#### 3.2.4 资金与托管模块

##### escrow_accounts（托管账户）

**文件**: `server/internal/model/model.go:179-191`

| 字段名 | 类型 | 约束 | 说明 |
|-------|------|------|------|
| id | uint64 | PK | 主键 |
| project_id | uint64 | UniqueIndex, Index | 项目ID（一对一） |
| user_id | uint64 | Index | 账户所有者ID |
| project_name | string(100) | - | 项目名称 |
| user_name | string(50) | - | 用户名称 |
| total_amount | float64 | - | 总存入金额 |
| frozen_amount | float64 | Default: 0 | 冻结金额（已存入未释放） |
| available_amount | float64 | Default: 0 | 可用余额 |
| released_amount | float64 | Default: 0 | 已释放金额 |
| status | int8 | Default: 1 | 状态：0待激活, 1正常, 2冻结, 3已清算 |

**关键索引**:
- `project_id`: UniqueIndex（一个项目一个托管账户）
- `user_id`: Index

**资金状态计算**:
```
TotalAmount = 所有充值的累计总额
FrozenAmount = 已充值但未释放的金额
ReleasedAmount = 验收通过后释放的总额
AvailableAmount = TotalAmount - FrozenAmount - ReleasedAmount
```

##### transactions（交易记录）

**文件**: `server/internal/model/model.go:193-208`

| 字段名 | 类型 | 约束 | 说明 |
|-------|------|------|------|
| id | uint64 | PK | 主键 |
| order_id | string(50) | UniqueIndex | 订单号（支付平台） |
| escrow_id | uint64 | Index | 托管账户ID |
| milestone_id | uint64 | Index | 验收节点ID |
| type | string(20) | Index | 交易类型：deposit, withdraw, transfer, refund, release |
| amount | float64 | - | 交易金额 |
| from_user_id | uint64 | Index | 付款用户ID（0表示系统） |
| from_account | string(200) | - | 付款账户 |
| to_user_id | uint64 | Index | 收款用户ID（0表示系统） |
| to_account | string(200) | - | 收款账户 |
| status | int8 | Default: 0 | 状态：0处理中, 1成功, 2失败 |
| remark | text | - | 备注 |
| completed_at | *time.Time | - | 完成时间 |

**关键索引**:
- `order_id`: UniqueIndex
- `escrow_id`, `milestone_id`: Index
- `type`: Index（按类型查询）
- `from_user_id`, `to_user_id`: Index

**交易类型定义**:
| Type | 说明 | FromUserID | ToUserID |
|------|------|-----------|----------|
| deposit | 用户充值 | UserID | 0 (系统托管) |
| release | 释放给商家 | 0 (系统) | ProviderID |
| refund | 退款给用户 | 0 (系统) | UserID |
| withdraw | 商家提现 | ProviderID | 0 (外部账户) |

##### merchant_incomes（商家收入）

**文件**: `server/internal/model/model.go:455-473`

| 字段名 | 类型 | 约束 | 说明 |
|-------|------|------|------|
| id | uint64 | PK | 主键 |
| provider_id | uint64 | Index | 服务商ID |
| order_id | uint64 | Index | 关联订单ID |
| booking_id | uint64 | Index | 关联预约ID |
| type | string(20) | - | 收入类型：intent_fee, design_fee, construction |
| amount | float64 | - | 原始金额 |
| platform_fee | float64 | - | 平台抽成 |
| net_amount | float64 | - | 实际到账金额 |
| status | int8 | Default: 0 | 状态：0待结算, 1已结算, 2已提现 |
| settled_at | *time.Time | - | 结算时间 |
| withdraw_order_no | string(50) | - | 提现订单号 |

**关键索引**:
- `provider_id`, `order_id`, `booking_id`: Index

**平台抽成计算**:
```
NetAmount = Amount * (1 - PlatformFeeRate)
PlatformFee = Amount * PlatformFeeRate
```

**状态流转**:
```
创建收入 → Status=0 (待结算)
    ↓ (IncomeCron 每天2点检查)
自动结算 → Status=1 (已结算, 可提现)
    ↓
商家提现 → Status=2 (已提现)
```

#### 3.2.5 审核与审批模块

##### merchant_applications（商家入驻申请）

**文件**: `server/internal/model/model.go:382-417`

| 字段名 | 类型 | 约束 | 说明 |
|-------|------|------|------|
| id | uint64 | PK | 主键 |
| phone | string(20) | Index | 申请人手机号 |
| applicant_type | string(20) | - | 申请类型：personal, studio, company |
| real_name | string(50) | - | 真实姓名 |
| id_card_no | string(100) | - | 身份证号（AES加密） |
| id_card_front | string(500) | - | 身份证正面照 |
| id_card_back | string(500) | - | 身份证反面照 |
| company_name | string(100) | - | 公司名称 |
| license_no | string(50) | - | 营业执照号 |
| license_image | string(500) | - | 营业执照照片 |
| team_size | int | Default: 1 | 团队规模 |
| office_address | string(200) | - | 办公地址 |
| service_area | text | - | 服务区域（JSON数组） |
| styles | text | - | 擅长风格（JSON数组） |
| introduction | text | - | 个人/公司简介 |
| portfolio_cases | text | - | 作品集（JSON数组） |
| status | int8 | Default: 0 | 审核状态：0待审核, 1审核通过, 2审核拒绝 |
| reject_reason | string(500) | - | 拒绝原因 |
| audited_by | uint64 | - | 审核人ID |
| audited_at | *time.Time | - | 审核时间 |
| user_id | uint64 | Index | 关联用户ID（审核通过后创建） |
| provider_id | uint64 | Index | 关联服务商ID（审核通过后创建） |

**关键索引**:
- `phone`: Index
- `user_id`, `provider_id`: Index

**审核流程**:
```
提交申请 → Status=0 (待审核)
    ↓
管理员审核
    ↓                    ↓
[通过]              [拒绝]
Status=1            Status=2
创建 User           填写 RejectReason
创建 Provider       允许重新提交
```

##### case_audits（作品审核）

**文件**: `server/internal/model/model.go:424-453`

| 字段名 | 类型 | 约束 | 说明 |
|-------|------|------|------|
| id | uint64 | PK | 主键 |
| case_id | *uint64 | Index | 关联主表ID（新增时为空） |
| provider_id | uint64 | Index | 服务商ID |
| action_type | string(20) | - | 操作类型：create, update, delete |
| title | string(100) | - | 作品标题（数据快照） |
| cover_image | string(500) | - | 封面图（数据快照） |
| style | string(50) | - | 风格（数据快照） |
| layout | string(50) | - | 户型（数据快照） |
| area | string(20) | - | 面积（数据快照） |
| price | float64 | Default: 0 | 总价（数据快照） |
| year | string(10) | - | 年份（数据快照） |
| description | text | - | 描述（数据快照） |
| images | text | - | 图片（数据快照） |
| sort_order | int | Default: 0 | 排序（数据快照） |
| status | int8 | Default: 0 | 审核状态：0pending, 1approved, 2rejected |
| reject_reason | string(500) | - | 拒绝原因 |
| audited_by | uint64 | - | 审核人ID |
| audited_at | *time.Time | - | 审核时间 |

**关键索引**:
- `case_id`: Index
- `provider_id`: Index

**设计要点**:
- 采用**数据快照**模式：审核表保存完整数据副本
- 审核通过后才同步到主表 `provider_cases`
- 支持新增、修改、删除三种操作类型

#### 3.2.6 权限与RBAC模块

##### sys_admins（系统管理员）

**文件**: `server/internal/model/rbac.go:8-23`

| 字段名 | 类型 | 约束 | 说明 |
|-------|------|------|------|
| id | uint64 | PK | 主键 |
| username | string(50) | UniqueIndex | 用户名（唯一） |
| password | string(255) | - | 密码哈希 |
| name | string(50) | - | 显示名称 |
| avatar | string(500) | - | 头像URL |
| phone | string(20) | - | 联系电话 |
| email | string(100) | - | 邮箱 |
| is_super_admin | bool | Default: false | 是否超级管理员 |
| status | int8 | Default: 1 | 状态：1正常 0禁用 |
| last_login_at | *time.Time | - | 最后登录时间 |
| last_login_ip | string(50) | - | 最后登录IP |

**关联关系**:
- `Roles`: 多对多关联 `sys_roles`（通过 `sys_admin_roles` 中间表）

**关键索引**:
- `username`: UniqueIndex

##### sys_roles（角色表）

**文件**: `server/internal/model/rbac.go:30-43`

| 字段名 | 类型 | 约束 | 说明 |
|-------|------|------|------|
| id | uint64 | PK | 主键 |
| key | string(50) | UniqueIndex | 角色标识（例: system_admin, merchant_admin） |
| name | string(50) | - | 角色名称（例: 系统管理员） |
| description | string(200) | - | 角色描述 |
| status | int8 | Default: 1 | 状态：1正常 0禁用 |
| sort_order | int | Default: 0 | 排序权重 |

**关联关系**:
- `Menus`: 多对多关联 `sys_menus`（通过 `sys_role_menus` 中间表）

**关键索引**:
- `key`: UniqueIndex

##### sys_menus（菜单/权限表）

**文件**: `server/internal/model/rbac.go:50-75`

| 字段名 | 类型 | 约束 | 说明 |
|-------|------|------|------|
| id | uint64 | PK | 主键 |
| parent_id | uint64 | Default: 0 | 父菜单ID（0表示根菜单） |
| type | int8 | - | 类型：1目录 2菜单 3按钮 |
| name | string(50) | - | 菜单名称 |
| path | string(200) | - | 路由路径 |
| component | string(200) | - | 前端组件路径 |
| permission | string(100) | Index | 权限标识（例: system:user:list） |
| icon | string(100) | - | 图标名称 |
| sort_order | int | Default: 0 | 排序权重 |
| visible | bool | Default: true | 是否可见 |
| status | int8 | Default: 1 | 状态：1正常 0禁用 |

**关联关系**:
- `Children`: 自关联（树形结构）

**关键索引**:
- `permission`: Index

**权限标识规范**:
```
{module}:{resource}:{action}

例如:
- system:user:list     # 用户列表
- system:user:create   # 创建用户
- system:user:delete   # 删除用户
- merchant:case:audit  # 审核作品
```

#### 3.2.7 系统配置模块

##### system_dictionaries（系统字典）

**文件**: `server/internal/model/dictionary.go:36-53`

| 字段名 | 类型 | 约束 | 说明 |
|-------|------|------|------|
| id | uint64 | PK | 主键 |
| category_code | string(50) | Index | 字典分类代码（外键） |
| value | string(100) | - | 字典值（唯一标识） |
| label | string(100) | - | 显示文本 |
| description | string(200) | - | 描述说明 |
| sort_order | int | Default: 0 | 排序权重 |
| extra_data | map[string]interface{} | JSONB | 扩展数据（JSON对象） |
| parent_value | string(100) | - | 父字典值（支持层级字典） |
| is_enabled | bool | Default: true | 是否启用 |

**关键索引**:
- `category_code`: Index
- 联合唯一索引: (category_code, value)

**设计要点**:
- 支持层级字典（parent_value 字段）
- extra_data 存储扩展属性（例: 图标、颜色等）
- PostgreSQL JSONB 类型，支持JSON查询

##### dictionary_categories（字典分类）

**文件**: `server/internal/model/dictionary.go:8-17`

| 字段名 | 类型 | 约束 | 说明 |
|-------|------|------|------|
| id | uint64 | PK | 主键 |
| code | string(50) | UniqueIndex | 分类代码（唯一） |
| name | string(100) | - | 分类名称 |
| description | string(200) | - | 描述说明 |
| is_enabled | bool | Default: true | 是否启用 |

**关键索引**:
- `code`: UniqueIndex

**典型字典分类**:
- `renovation_type`: 装修类型（新房、老房、局部）
- `design_style`: 设计风格（现代、中式、北欧等）
- `house_layout`: 户型（1室、2室、3室等）
- `service_area`: 服务区域

##### regions（行政区划）

**文件**: `server/internal/model/region.go:8-18`

| 字段名 | 类型 | 约束 | 说明 |
|-------|------|------|------|
| id | uint64 | PK | 主键 |
| code | string(20) | UniqueIndex | 区划代码（国标码） |
| name | string(100) | - | 区划名称 |
| level | int8 | - | 层级：1省 2市 3区县 |
| parent_code | string(20) | Index | 父区划代码 |
| is_enabled | bool | Default: true | 是否启用 |

**关键索引**:
- `code`: UniqueIndex
- `parent_code`: Index

**设计要点**:
- 支持级联选择器（省-市-区三级联动）
- 采用国家标准行政区划代码

### 3.3 实体关系图（ER图）

#### 3.3.1 核心业务闭环 ER 图

```
┌──────────┐
│  User    │
│ (用户表)  │
└────┬─────┘
     │ 1:N
     ▼
┌──────────────┐       1:N        ┌──────────────┐
│  Booking     │◄─────────────────┤  Provider    │
│ (预约记录)    │                  │ (服务商)      │
└──────┬───────┘                  └──────────────┘
       │ 1:N                           │ 1:N
       ▼                               ▼
┌──────────────┐                  ┌──────────────┐
│  Proposal    │                  │ ProviderCase │
│ (设计方案)    │                  │ (服务商案例)  │
└──────┬───────┘                  └──────────────┘
       │ version chain
       │ (parent_proposal_id)
       ▼
┌──────────────┐
│  Proposal v2 │
└──────┬───────┘
       │ 1:1
       ▼
┌──────────────┐       1:N        ┌──────────────┐
│    Order     │─────────────────→│ PaymentPlan  │
│   (订单)      │                  │ (支付计划)    │
└──────┬───────┘                  └──────────────┘
       │ 1:1                           │ N:1
       ▼                               ▼
┌──────────────┐                  ┌──────────────┐
│   Project    │                  │  Milestone   │
│   (项目)      │─────────────────→│ (验收节点)    │
└──────┬───────┘       1:N        └──────────────┘
       │ 1:1
       ▼
┌──────────────┐       1:N        ┌──────────────┐
│EscrowAccount │─────────────────→│ Transaction  │
│ (托管账户)    │                  │ (交易记录)    │
└──────────────┘                  └──────────────┘
       │ release funds
       ▼
┌──────────────┐       1:N        ┌──────────────┐
│MerchantIncome│─────────────────→│MerchantWithdraw│
│ (商家收入)    │                  │ (商家提现)    │
└──────────────┘                  └──────────────┘
```

#### 3.3.2 用户与认证 ER 图

```
┌──────────┐       1:N        ┌──────────────────┐
│  User    │◄────────────────┤UserWechatBinding │
│ (用户表)  │                  │ (微信绑定)        │
└────┬─────┘                  └──────────────────┘
     │
     │ 1:1 (user_type = 2)
     ▼
┌──────────┐       1:N        ┌──────────────┐
│ Provider │◄────────────────┤ProviderReview│
│ (服务商)  │                  │ (商家评价)    │
└────┬─────┘                  └──────────────┘
     │ 1:N
     ▼
┌──────────────┐
│ProviderCase  │
│ (商家案例)    │
└──────────────┘
```

#### 3.3.3 RBAC 权限体系 ER 图

```
┌────────────┐       N:M        ┌───────────┐
│ SysAdmin   │◄───────────────→│  SysRole  │
│ (管理员)    │   sys_admin_roles│  (角色)    │
└────────────┘                  └─────┬─────┘
                                      │ N:M
                                      │ sys_role_menus
                                      ▼
                                ┌───────────┐
                                │ SysMenu   │
                                │ (菜单)     │
                                └─────┬─────┘
                                      │ self-reference
                                      │ (parent_id)
                                      ▼
                                ┌───────────┐
                                │ Children  │
                                └───────────┘
```

#### 3.3.4 审核流程 ER 图

```
┌──────────────────┐       1:1        ┌──────────────┐
│MerchantApplication│─────────────────→│   Provider   │
│ (商家入驻申请)     │   (审核通过创建)  │  (服务商)     │
└──────────────────┘                  └──────────────┘
                                           │ 1:N
                                           ▼
┌──────────────┐       N:1          ┌──────────────┐
│  CaseAudit   │◄───────────────────┤ProviderCase  │
│ (作品审核)    │   (审核通过同步)    │ (服务商案例)  │
└──────────────┘                    └──────────────┘
```

### 3.4 索引策略分析

#### 3.4.1 索引类型统计

| 索引类型 | 数量 | 占比 | 主要用途 |
|---------|------|------|---------|
| **UniqueIndex** | 15+ | 20% | 防止重复（phone, username, order_no等） |
| **Index** | 50+ | 70% | 查询优化（user_id, provider_id等） |
| **联合索引** | 8+ | 10% | 复杂查询（多字段组合） |

#### 3.4.2 关键唯一索引

| 表名 | 字段 | 用途 |
|------|------|------|
| users | phone | 手机号唯一性 |
| sys_admins | username | 管理员用户名唯一 |
| orders | order_no | 订单号唯一 |
| sys_roles | key | 角色标识唯一 |
| dictionary_categories | code | 字典分类代码唯一 |
| regions | code | 行政区划代码唯一 |
| escrow_accounts | project_id | 一个项目一个托管账户 |

#### 3.4.3 联合索引

| 表名 | 联合索引 | 用途 |
|------|---------|------|
| user_wechat_bindings | (user_id, app_id) | 防止同一用户重复绑定同一小程序 |
| user_wechat_bindings | (app_id, open_id) | 防止同一OpenID重复绑定 |
| user_follows | (user_id, target_id, target_type) | 防止重复关注 |
| user_favorites | (user_id, target_id, target_type) | 防止重复收藏 |

#### 3.4.4 查询优化索引

| 业务场景 | 索引字段 | 受益查询 |
|---------|---------|---------|
| 查询用户的预约记录 | bookings.user_id | `WHERE user_id = ?` |
| 查询服务商的预约记录 | bookings.provider_id | `WHERE provider_id = ?` |
| 查询预约的方案列表 | proposals.booking_id | `WHERE booking_id = ?` |
| 查询方案版本历史 | proposals.parent_proposal_id | `WHERE parent_proposal_id = ?` |
| 查询托管账户交易记录 | transactions.escrow_id | `WHERE escrow_id = ?` |
| 查询商家收入明细 | merchant_incomes.provider_id | `WHERE provider_id = ?` |
| 权限查询 | sys_menus.permission | `WHERE permission = ?` |
| 字典查询 | system_dictionaries.category_code | `WHERE category_code = ?` |

### 3.5 数据完整性约束

#### 3.5.1 外键关系映射

**注意**: GORM 不强制外键约束（数据库层面无 FOREIGN KEY），通过应用层控制。

| 子表 | 外键字段 | 父表 | 父表字段 | 关系类型 |
|------|---------|------|---------|---------|
| user_wechat_bindings | user_id | users | id | N:1 |
| providers | user_id | users | id | 1:1 |
| bookings | user_id | users | id | N:1 |
| bookings | provider_id | providers | id | N:1 |
| proposals | booking_id | bookings | id | N:1 |
| proposals | provider_id | providers | id | N:1 |
| proposals | parent_proposal_id | proposals | id | N:1 (自关联) |
| orders | proposal_id | proposals | id | 1:1 |
| payment_plans | order_id | orders | id | N:1 |
| escrow_accounts | project_id | projects | id | 1:1 |
| transactions | escrow_id | escrow_accounts | id | N:1 |
| merchant_incomes | provider_id | providers | id | N:1 |
| merchant_incomes | order_id | orders | id | N:1 |
| case_audits | provider_id | providers | id | N:1 |
| case_audits | case_id | provider_cases | id | 1:1 (可空) |

#### 3.5.2 级联删除策略

**GORM 默认行为**: 不执行数据库级别的级联删除，需在应用层手动处理。

**建议策略**:
| 场景 | 删除策略 | 原因 |
|------|---------|------|
| 删除 User | ❌ 禁止直接删除 | 可能有关联订单和项目，改为软删除（status=0） |
| 删除 Provider | ❌ 禁止直接删除 | 可能有正在进行的项目 |
| 删除 Booking | ❌ 禁止直接删除 | 保留历史记录，改为 status=4 (Cancelled) |
| 删除 Proposal | ❌ 禁止直接删除 | 版本链依赖，改为 status=4 (Superseded) |
| 删除 Order | ❌ 禁止直接删除 | 财务数据，仅允许 status=2 (Cancelled) |

#### 3.5.3 数据验证规则

| 验证类型 | 实现位置 | 示例 |
|---------|---------|------|
| **必填字段** | GORM 标签 | `gorm:"not null"` |
| **唯一性** | UniqueIndex | phone, username, order_no |
| **长度限制** | GORM 标签 | `gorm:"size:50"` |
| **默认值** | GORM 标签 | `gorm:"default:1"` |
| **枚举值** | 应用层 | OrderType: design/construction/material |
| **金额非负** | 应用层 | `if amount < 0 { return error }` |
| **状态机** | 应用层 | Booking: 1→2→3/4, Proposal: 1→2/3/4 |

### 3.6 JSON 字段设计

#### 3.6.1 JSON 字段清单

| 表名 | 字段名 | 存储类型 | 数据结构 | 示例 |
|------|-------|---------|---------|------|
| providers | certifications | text/JSONB | Array | `["ISO9001", "AAA信用"]` |
| providers | service_area | text/JSONB | Array | `["浦东新区", "徐汇区"]` |
| provider_cases | images | text | Array | `["url1.jpg", "url2.jpg"]` |
| provider_reviews | images | text | Array | `["review1.jpg"]` |
| provider_reviews | tags | text | Array | `["专业", "负责"]` |
| proposals | images | text | Array | `["design1.jpg"]` |
| proposals | files | text | Array | `[{name, url, size}]` |
| system_dictionaries | extra_data | JSONB | Object | `{icon: "icon-name", color: "#fff"}` |
| merchant_applications | service_area | text | Array | `["上海市", "杭州市"]` |
| merchant_applications | styles | text | Array | `["现代", "中式"]` |
| merchant_applications | portfolio_cases | text | Array | `[{title, images, style, area}]` |
| notifications | extra | text | Object | `{bookingId: 123, proposalId: 456}` |

#### 3.6.2 JSON 查询优化

**PostgreSQL JSONB 优势**:
- 支持索引（GIN索引）
- 支持 JSON 路径查询

**示例查询**（system_dictionaries.extra_data）:
```sql
-- 查询包含特定图标的字典项
SELECT * FROM system_dictionaries
WHERE extra_data->>'icon' = 'icon-home';

-- 查询颜色为红色的字典项
SELECT * FROM system_dictionaries
WHERE extra_data->>'color' = '#ff0000';
```

### 3.7 数据库设计亮点

#### 3.7.1 版本管理机制

**Proposal 版本链表结构**:
- `Version`: 版本号递增（v1, v2, v3）
- `ParentProposalID`: 指向上一版本
- 支持版本历史查询：递归查询 `parent_proposal_id`

**优势**:
- 完整保留修改历史
- 支持版本回溯
- 拒绝次数累计控制

#### 3.7.2 审核快照模式

**CaseAudit 数据快照**:
- 审核表保存完整数据副本
- 审核通过后同步到主表
- 拒绝时不影响主表数据

**优势**:
- 审核与业务解耦
- 支持对比审核前后差异
- 回滚方便

#### 3.7.3 托管账户设计

**EscrowAccount 多状态金额**:
- `TotalAmount`: 总存入金额
- `FrozenAmount`: 冻结金额
- `ReleasedAmount`: 已释放金额
- `AvailableAmount`: 可用余额

**优势**:
- 资金状态清晰
- 防止超额释放
- 支持分阶段付款

#### 3.7.4 RBAC 三层权限模型

**权限粒度**:
1. **目录级别** (Type=1): 导航菜单
2. **页面级别** (Type=2): 路由访问权限
3. **按钮级别** (Type=3): 操作权限（增删改查）

**优势**:
- 细粒度权限控制
- 支持动态菜单
- 前后端权限一致

### 3.8 潜在优化点

#### 3.8.1 缺失的索引

| 表名 | 建议索引 | 原因 |
|------|---------|------|
| transactions | (type, status, created_at) | 支持按类型和状态筛选交易记录 |
| merchant_incomes | (provider_id, status, created_at) | 优化商家收入查询 |
| bookings | (status, merchant_response_deadline) | 优化定时任务查询 |
| proposals | (status, user_response_deadline) | 优化定时任务查询 |
| orders | (status, expire_at) | 优化定时任务查询 |

#### 3.8.2 数据冗余

| 表名 | 冗余字段 | 说明 |
|------|---------|------|
| escrow_accounts | project_name, user_name | 可通过关联查询获取，但保留提升查询性能 |
| proposals | user_id | 可通过 `booking_id` 关联获取，冗余减少 JOIN |
| merchant_incomes | booking_id | 可通过 `order_id` 关联获取，冗余减少 JOIN |

**建议**: 保留冗余字段，优先考虑查询性能。

#### 3.8.3 分区表建议

**建议对以下表进行分区**（数据量大时）:
| 表名 | 分区键 | 分区策略 | 原因 |
|------|-------|---------|------|
| transactions | created_at | 按月分区 | 交易记录增长快，历史数据查询少 |
| notifications | created_at | 按月分区 | 通知数据量大，历史数据可归档 |
| audit_logs | created_at | 按月分区 | 审计日志持续增长 |

### 3.9 数据库初始化脚本

根据代码推断，项目包含以下初始化脚本:

| 脚本文件 | 功能 | 优先级 |
|---------|------|--------|
| `server/scripts/init_dictionaries.sql` | 初始化系统字典数据 | P0 |
| `server/scripts/migrate_dictionaries.sql` | 字典数据迁移 | P1 |
| `server/scripts/add_region_menu.sql` | 添加行政区划菜单 | P1 |
| `server/scripts/migrations/v1.3.0_add_regions_table.sql` | 创建行政区划表 | P0 |
| `server/scripts/migrations/v1.4.0_add_user_wechat_bindings.sql` | 创建微信绑定表 | P0 |
| `server/scripts/migrations/seed_regions_shaanxi.sql` | 陕西省区划数据 | P2 |
| `server/scripts/migrations/seed_all_provinces_level1.sql` | 全国省级数据 | P1 |

### 3.10 未解问题清单

根据数据库设计分析，以下问题需要进一步确认：
- ❓ `Project.CurrentPhase` 的完整枚举值（代码中未明确定义）
- ❓ `Milestone` 模型的完整字段定义（仅在 `model.go:148-161` 部分定义）
- ❓ `Worker` 模型的使用场景（当前未发现关联业务流程）
- ❓ `MaterialShop` 的审核流程（是否有 `MaterialShopAudit` 表）
- ❓ 数据库是否启用了 JSONB GIN 索引（优化 JSON 查询）
- ❓ PostgreSQL 全文搜索配置（providers.service_intro, proposals.description）

---

## 第4章：Admin 架构与权限体系

### 4.1 技术栈与架构概览

#### 4.1.1 核心技术栈

| 技术 | 版本 | 用途 | 关键约束 |
|------|------|------|---------|
| **React** | 18.3.1 | 前端框架 | 精确锁定版本（无 `^` 符号） |
| **Vite** | 最新 | 构建工具 | 开发服务器 + 生产构建 |
| **React Router** | v7 | 路由管理 | createBrowserRouter API |
| **Ant Design** | 5.29.2 | UI 组件库 | 完整生态（Charts, Pro Components） |
| **Ant Design Pro Components** | 最新 | 高级组件 | ProLayout, PageContainer |
| **Zustand** | 最新 | 状态管理 | 轻量级，localStorage 持久化 |
| **Axios** | 最新 | HTTP 客户端 | 拦截器 + 统一错误处理 |
| **TypeScript** | 最新 | 类型系统 | 强类型约束 |

#### 4.1.2 架构分层

```
┌─────────────────────────────────────────────────────────┐
│                   前端应用架构（Admin）                    │
├─────────────────────────────────────────────────────────┤
│  视图层 (View Layer)                                     │
│  - pages/        # 页面组件（41个）                       │
│  - layouts/      # 布局组件（BasicLayout）                │
│  - components/   # 公共组件                               │
├─────────────────────────────────────────────────────────┤
│  路由层 (Router Layer)                                   │
│  - router.tsx    # React Router v7 配置（basename: /admin）│
│  - 107个路由定义 # 嵌套路由 + 默认重定向                   │
├─────────────────────────────────────────────────────────┤
│  状态层 (State Layer)                                    │
│  - stores/authStore.ts   # 认证状态（Zustand）            │
│  - localStorage 持久化   # Token, User, Permissions, Menus │
├─────────────────────────────────────────────────────────┤
│  服务层 (Service Layer)                                  │
│  - services/api.ts       # Axios 实例 + 拦截器            │
│  - 15+ API 模块化封装    # adminUserApi, adminProjectApi... │
├─────────────────────────────────────────────────────────┤
│  后端 API                                                 │
│  - /api/v1/admin/*       # Admin JWT 认证                 │
│  - RBAC 权限控制         # 角色-菜单-权限三层模型          │
└─────────────────────────────────────────────────────────┘
```

### 4.2 路由系统设计

#### 4.2.1 路由配置总览

**文件**: `admin/src/router.tsx` (108行)

**路由总数**: 107个路由定义
- 1个公开路由（/login）
- 106个受保护路由（嵌套在 BasicLayout 下）

**basename**: `/admin` - 所有 Admin 路由强制前缀

#### 4.2.2 路由分组架构

```
/admin/login (公开)
    ↓
/admin (BasicLayout 布局)
    ├── /dashboard (首页默认重定向)
    ├── /users (用户管理模块)
    │   ├── /users/list - 用户列表
    │   └── /users/admins - 管理员列表
    ├── /providers (服务商管理模块)
    │   ├── /providers/designers - 设计师列表
    │   ├── /providers/companies - 装修公司列表
    │   ├── /providers/foremen - 工长列表
    │   └── /providers/audit - 服务商审核
    ├── /materials (主材门店模块)
    │   ├── /materials/list - 门店列表
    │   └── /materials/audit - 门店审核
    ├── /cases (作品管理模块)
    │   └── /cases/manage - 作品管理（整合审核）
    ├── /projects (项目管理模块)
    │   ├── /projects/list - 项目列表
    │   ├── /projects/detail/:id - 项目详情
    │   └── /projects/map - 项目地图视图
    ├── /bookings (预约管理模块)
    │   ├── /bookings/list - 预约列表
    │   └── /bookings/disputed - 争议预约处理
    ├── /finance (财务管理模块)
    │   ├── /finance/escrow - 托管账户
    │   └── /finance/transactions - 交易记录
    ├── /reviews (评价管理模块)
    │   └── /reviews/list - 评价列表
    ├── /risk (风险管理模块)
    │   ├── /risk/warnings - 风险预警
    │   └── /risk/arbitration - 仲裁中心
    ├── /logs (日志管理模块)
    │   └── /logs/list - 操作日志
    ├── /settings (系统设置模块)
    │   ├── /settings/config - 系统配置
    │   └── /settings/regions - 行政区划管理
    ├── /system (系统管理模块)
    │   └── /system/dictionary - 字典管理
    └── /permission (权限管理模块 - 单数形式)
        ├── /permission/roles - 角色管理
        └── /permission/menus - 菜单管理
```

#### 4.2.3 路由配置特点

**默认重定向策略**:
```tsx
// 示例：用户访问 /admin/users，自动重定向到 /admin/users/list
{ path: 'users', element: <Navigate to="/users/list" replace /> }
```

**嵌套路由模式**:
```tsx
{
    path: '/',
    element: <BasicLayout />,
    children: [
        { index: true, element: <Navigate to="/dashboard" replace /> },
        { path: 'dashboard', element: <Dashboard /> },
        // ... 其他106个子路由
    ]
}
```

**动态路由参数**:
- `/projects/detail/:id` - 项目详情（动态ID）

**basename 配置**:
```tsx
createBrowserRouter([...routes], {
    basename: '/admin'  // 强制所有路由带 /admin 前缀
})
```

### 4.3 权限状态管理（Zustand）

#### 4.3.1 authStore 核心结构

**文件**: `admin/src/stores/authStore.ts` (89行)

**状态定义**:
```typescript
interface AuthState {
    // 认证信息
    token: string | null;                  // JWT Token
    admin: AdminUser | null;               // 管理员信息
    isAuthenticated: boolean;              // 认证状态

    // 权限数据
    permissions: string[];                 // 权限标识数组
    menus: MenuItem[];                     // 菜单树结构

    // Actions
    login: (token, admin) => void;
    setPermissions: (permissions, menus) => void;
    logout: () => void;
    checkAuth: () => boolean;
    hasPermission: (permission) => boolean; // 权限检查函数
}
```

**AdminUser 接口**:
```typescript
interface AdminUser {
    id: number;
    username: string;
    nickname: string;
    avatar?: string;
    isSuperAdmin: boolean;    // 超级管理员标记
    roles: string[];          // 角色列表
}
```

**MenuItem 接口**:
```typescript
interface MenuItem {
    id: number;
    parentId: number;
    title: string;
    type: number;             // 1目录 2菜单 3按钮
    permission: string;       // 权限标识（例: system:user:list）
    path: string;             // 路由路径
    component: string;        // 组件路径
    icon: string;             // 图标名称
    sort: number;             // 排序
    children?: MenuItem[];    // 子菜单
}
```

#### 4.3.2 localStorage 持久化策略

**存储键名**:
| 键名 | 数据类型 | 说明 |
|------|---------|------|
| `admin_token` | string | JWT Token（8小时有效期） |
| `admin_user` | JSON | 管理员用户信息 |
| `admin_permissions` | JSON Array | 权限标识数组（例: ["system:user:list", "system:user:create"]） |
| `admin_menus` | JSON Array | 菜单树结构（后端返回） |

**初始化流程**:
```typescript
// 从 localStorage 恢复状态（页面刷新不丢失）
token: localStorage.getItem('admin_token'),
admin: JSON.parse(localStorage.getItem('admin_user') || 'null'),
permissions: JSON.parse(localStorage.getItem('admin_permissions') || '[]'),
menus: JSON.parse(localStorage.getItem('admin_menus') || '[]'),
isAuthenticated: !!localStorage.getItem('admin_token'),
```

#### 4.3.3 权限检查逻辑

**超级管理员特权**:
```typescript
hasPermission: (permission) => {
    const { admin, permissions } = get();
    if (!admin) return false;

    // 超级管理员拥有所有权限
    if (admin.isSuperAdmin || permissions.includes('*:*:*')) {
        return true;
    }

    // 普通管理员检查权限数组
    return permissions.includes(permission);
}
```

**权限标识规范**:
```
{module}:{resource}:{action}

例如:
- system:user:list     # 用户列表
- system:user:create   # 创建用户
- system:user:delete   # 删除用户
- merchant:case:audit  # 审核作品
- finance:escrow:view  # 查看托管账户
```

#### 4.3.4 登录流程

**登录时序**:
```
用户提交表单 → adminAuthApi.login()
    ↓
后端返回: { token, admin, permissions, menus }
    ↓
authStore.login(token, admin)
    ↓
authStore.setPermissions(permissions, menus)
    ↓
localStorage 同步存储
    ↓
navigate('/dashboard')
```

**登出流程**:
```
authStore.logout()
    ↓
清除 localStorage 4个键
    ↓
重置状态: { token: null, admin: null, permissions: [], menus: [], isAuthenticated: false }
    ↓
navigate('/login')
```

### 4.4 API 服务层设计

#### 4.4.1 Axios 实例配置

**文件**: `admin/src/services/api.ts` (282行)

**baseURL 动态配置**:
```typescript
const API_BASE_URL = import.meta.env.VITE_API_URL ||
    (window.location.hostname === 'localhost'
        ? 'http://localhost:8080/api/v1'
        : '/api/v1');
```

**优先级**:
1. 环境变量 `VITE_API_URL`（开发环境）
2. 动态判断 hostname（生产环境）

**实例配置**:
```typescript
const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 10000,           // 10秒超时
    headers: {
        'Content-Type': 'application/json',
    },
});
```

#### 4.4.2 请求拦截器

**Token 注入**:
```typescript
api.interceptors.request.use(
    (config) => {
        // 优先使用 admin_token
        const adminToken = localStorage.getItem('admin_token');
        const token = adminToken || localStorage.getItem('token');

        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);
```

#### 4.4.3 响应拦截器

**统一错误处理**:
```typescript
api.interceptors.response.use(
    (response) => response.data,  // 直接返回 data，简化调用
    (error) => {
        // 401 未授权 - 自动跳转登录
        if (error.response?.status === 401) {
            // 避免在登录页面循环跳转
            if (!window.location.pathname.includes('/login')) {
                // 清除认证信息
                localStorage.removeItem('admin_token');
                localStorage.removeItem('admin_user');
                localStorage.removeItem('admin_permissions');
                localStorage.removeItem('admin_menus');

                // 跳转登录页
                window.location.href = '/admin/login';
            }
        }
        return Promise.reject(error);
    }
);
```

#### 4.4.4 API 模块化封装

**15+ API 模块**（按业务域分组）:

| API 模块 | 端点前缀 | 主要功能 |
|---------|---------|---------|
| **adminAuthApi** | `/admin/login`, `/admin/info` | 管理员登录、获取信息 |
| **adminStatsApi** | `/admin/stats/*` | 统计数据（overview, trends, distribution） |
| **adminUserApi** | `/admin/users` | 用户管理 CRUD |
| **adminProviderApi** | `/admin/providers` | 服务商管理、认证 |
| **adminMaterialShopApi** | `/admin/material-shops` | 主材门店管理 |
| **adminBookingApi** | `/admin/bookings` | 预约管理 |
| **adminDisputeApi** | `/admin/disputed-bookings` | 争议预约处理 |
| **adminProjectApi** | `/admin/projects` | 项目管理、阶段管理、日志 |
| **adminReviewApi** | `/admin/reviews` | 评价管理 |
| **adminManageApi** | `/admin/admins` | 管理员账号管理 |
| **adminRoleApi** | `/admin/roles` | 角色管理、分配菜单 |
| **adminMenuApi** | `/admin/menus` | 菜单管理 CRUD |
| **adminAuditApi** | `/admin/audits/*` | 审核管理（服务商、门店、作品） |
| **adminFinanceApi** | `/admin/finance/*` | 财务管理（托管账户、交易） |
| **adminRiskApi** | `/admin/risk/*` | 风险管理（预警、仲裁） |
| **adminSettingsApi** | `/admin/settings` | 系统设置 |
| **adminExportApi** | `/admin/export/*` | 数据导出（Excel） |
| **caseAuditApi** | `/admin/audits/cases` | 作品审核 |
| **caseApi** | `/admin/cases` | 作品管理 |
| **notificationApi** | `/admin/notifications` | 通知系统 |

**API 封装示例**（CRUD 标准模式）:
```typescript
export const adminUserApi = {
    list: (params?: { page, pageSize, keyword, userType }) =>
        api.get('/admin/users', { params }),
    detail: (id: number) =>
        api.get(`/admin/users/${id}`),
    create: (data: any) =>
        api.post('/admin/users', data),
    update: (id: number, data: any) =>
        api.put(`/admin/users/${id}`, data),
    updateStatus: (id: number, status: number) =>
        api.patch(`/admin/users/${id}/status`, { status }),
};
```

### 4.5 布局系统（ProLayout）

#### 4.5.1 BasicLayout 核心功能

**文件**: `admin/src/layouts/BasicLayout.tsx` (136行)

**使用组件**:
- `ProLayout` - Ant Design Pro 高级布局组件
- `PageContainer` - 页面容器（面包屑 + 内容区域）
- `Outlet` - React Router v7 子路由渲染点

**布局模式**: `layout="mix"` - 混合模式（顶部导航 + 侧边菜单）

#### 4.5.2 动态菜单渲染

**菜单数据转换**:
```typescript
const transformMenuData = (data: MenuItem[]): any[] => {
    return data.map(item => ({
        path: item.path,
        name: item.title,
        icon: item.icon ? iconMap[item.icon] : null,
        children: item.children ? transformMenuData(item.children) : undefined,
        hideInMenu: !item.visible,  // 控制菜单可见性
    }));
};
```

**图标映射表**（15个 Ant Design 图标）:
```typescript
const iconMap: Record<string, React.ReactNode> = {
    'DashboardOutlined': <DashboardOutlined />,
    'UserOutlined': <UserOutlined />,
    'TeamOutlined': <TeamOutlined />,
    'ShopOutlined': <ShopOutlined />,
    'ProjectOutlined': <ProjectOutlined />,
    'CalendarOutlined': <CalendarOutlined />,
    'BankOutlined': <BankOutlined />,
    'StarOutlined': <StarOutlined />,
    'SafetyOutlined': <SafetyOutlined />,
    'FileTextOutlined': <FileTextOutlined />,
    'SettingOutlined': <SettingOutlined />,
    'LockOutlined': <LockOutlined />,
    'ExclamationCircleOutlined': <ExclamationCircleOutlined />,
    'WarningOutlined': <WarningOutlined />,
    'FileImageOutlined': <FileImageOutlined />,
    'UnorderedListOutlined': <UnorderedListOutlined />,
};
```

#### 4.5.3 菜单点击导航

**自定义菜单项渲染**:
```typescript
menuItemRender={(item, dom) => (
    <div onClick={() => item.path && navigate(item.path)}>{dom}</div>
)}
```

**当前路由高亮**:
```typescript
location={{ pathname: location.pathname }}
```

#### 4.5.4 顶部工具栏

**右侧操作区**:
```typescript
actionsRender={() => [
    <NotificationDropdown key="notification" />,  // 通知下拉菜单
]}
```

**用户头像下拉菜单**:
```typescript
avatarProps={{
    src: admin?.avatar || 'https://gw.alipayobjects.com/...',
    title: admin?.nickname || admin?.username || '管理员',
    size: 'small',
    render: (_, avatarDom) => (
        <Dropdown
            menu={{
                items: [
                    {
                        key: 'logout',
                        icon: <LogoutOutlined />,
                        label: '退出登录',
                        onClick: handleLogout,
                    },
                ],
            }}
        >
            {avatarDom}
        </Dropdown>
    ),
}}
```

#### 4.5.5 面包屑导航

**自定义面包屑渲染**:
```typescript
breadcrumbProps={{
    itemRender: (route, _params, routes, _paths) => {
        const last = routes.indexOf(route) === routes.length - 1;
        return last || !route.path ? (
            <span>{route.breadcrumbName}</span>
        ) : (
            <Link to={route.path}>{route.breadcrumbName}</Link>
        );
    },
}}
```

### 4.6 核心页面架构模式

#### 4.6.1 页面组件统计

**总页面数**: 41个页面组件

**按模块分类**:
| 模块 | 页面数 | 主要页面 |
|------|--------|---------|
| Dashboard | 1个 | 统计面板 |
| User | 2个 | Login, UserList |
| Admin | 1个 | AdminList |
| Provider | 1个 | ProviderList（3种类型复用） |
| Material | 1个 | MaterialShopList |
| Booking | 2个 | BookingList, DisputedBookings |
| Project | 3个 | ProjectList, ProjectDetail, ProjectMap |
| Finance | 2个 | EscrowAccountList, TransactionList |
| Risk | 2个 | RiskWarningList, ArbitrationCenter |
| Review | 1个 | ReviewList |
| Audit | 3个 | ProviderAudit, MaterialShopAudit, CaseAudits |
| Case | 1个 | CaseManagement |
| Permission | 2个 | RoleList, MenuList |
| System | 3个 | LogList, DictionaryManagement, RegionManagement |
| Settings | 1个 | SystemSettings |
| Merchant | 15个 | 商家端页面（入驻、订单、收入等） |

#### 4.6.2 标准页面模式（CRUD）

以 **UserList.tsx** 为例（231行）:

**标准结构**:
```tsx
const UserList: React.FC = () => {
    // 1. 状态管理
    const [loading, setLoading] = useState(false);
    const [users, setUsers] = useState<User[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pageSize] = useState(10);
    const [keyword, setKeyword] = useState('');
    const [modalVisible, setModalVisible] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [form] = Form.useForm();

    // 2. 数据加载
    useEffect(() => {
        loadData();
    }, [page, userType]);

    const loadData = async () => {
        setLoading(true);
        try {
            const res = await adminUserApi.list({ page, pageSize, keyword, userType });
            if (res.code === 0) {
                setUsers(res.data.list || []);
                setTotal(res.data.total || 0);
            }
        } catch (error) {
            message.error('加载失败');
        } finally {
            setLoading(false);
        }
    };

    // 3. CRUD 操作
    const handleStatusChange = async (id, status) => {
        await adminUserApi.updateStatus(id, status);
        message.success('状态更新成功');
        loadData();
    };

    const handleSubmit = async () => {
        const values = await form.validateFields();
        if (editingUser) {
            await adminUserApi.update(editingUser.id, values);
            message.success('更新成功');
        } else {
            await adminUserApi.create(values);
            message.success('创建成功');
        }
        setModalVisible(false);
        loadData();
    };

    // 4. 表格列定义
    const columns = [
        { title: 'ID', dataIndex: 'id', width: 80 },
        { title: '手机号', dataIndex: 'phone' },
        { title: '昵称', dataIndex: 'nickname' },
        {
            title: '用户类型',
            dataIndex: 'userType',
            render: (val) => <Tag color={...}>{userTypeMap[val].text}</Tag>
        },
        {
            title: '状态',
            dataIndex: 'status',
            render: (val, record) => (
                <Switch
                    checked={val === 1}
                    onChange={(checked) => handleStatusChange(record.id, checked ? 1 : 0)}
                />
            )
        },
        {
            title: '操作',
            render: (_, record) => (
                <Button type="link" onClick={() => openModal(record)}>编辑</Button>
            )
        },
    ];

    // 5. 渲染
    return (
        <Card>
            {/* 搜索栏 */}
            <Space>
                <Input placeholder="搜索" value={keyword} onChange={...} />
                <Select placeholder="用户类型" options={...} />
                <Button type="primary" onClick={handleSearch}>搜索</Button>
                <Button onClick={() => openModal()}>新增用户</Button>
            </Space>

            {/* 数据表格 */}
            <Table
                columns={columns}
                dataSource={users}
                rowKey="id"
                loading={loading}
                pagination={{
                    current: page,
                    pageSize,
                    total,
                    onChange: setPage,
                }}
            />

            {/* 编辑弹窗 */}
            <Modal title={editingUser ? '编辑' : '新增'} open={modalVisible} onOk={handleSubmit}>
                <Form form={form} layout="vertical">
                    <Form.Item name="phone" label="手机号" rules={...}>
                        <Input />
                    </Form.Item>
                    {/* ... 其他表单项 */}
                </Form>
            </Modal>
        </Card>
    );
};
```

#### 4.6.3 Dashboard 统计面板

**文件**: `admin/src/pages/dashboard/index.tsx` (463行)

**核心功能**:
1. **8个核心指标卡片**（渐变背景 + 实时数据）
2. **3个数据可视化图表**（Line, Pie, Column）
3. **7天趋势数据表格**

**统计指标**:
```typescript
interface OverviewStats {
    userCount: number;          // 用户总数
    todayNewUsers: number;      // 今日新增
    providerCount: number;      // 服务商总数
    designerCount: number;      // 设计师数量
    companyCount: number;       // 装修公司数量
    foremanCount: number;       // 工长数量
    projectCount: number;       // 项目总数
    activeProjects: number;     // 进行中项目
    completedProjects: number;  // 已完成项目
    bookingCount: number;       // 预约总数
    pendingBookings: number;    // 待处理预约
    materialShopCount: number;  // 主材门店数
    monthlyGMV: number;         // 本月成交额
}
```

**数据可视化**:
- **用户增长趋势** - Line 图（@ant-design/charts）
- **服务商分布** - Pie 图（饼图）
- **成交额趋势** - Column 图（柱状图）

**渐变卡片设计**:
```css
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%)  /* 用户卡片 */
background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%)  /* 服务商卡片 */
background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)  /* 项目卡片 */
background: linear-gradient(135deg, #fa709a 0%, #fee140 100%)  /* 成交额卡片 */
```

#### 4.6.4 登录页面

**文件**: `admin/src/pages/user/Login.tsx` (105行)

**登录流程**:
```
用户输入账号密码 → 表单验证
    ↓
调用 adminAuthApi.login()
    ↓
后端返回: { code: 0, data: { token, admin, permissions, menus } }
    ↓
authStore.login(token, admin)
authStore.setPermissions(permissions, menus)
    ↓
localStorage 同步存储 4个键
    ↓
navigate('/dashboard')
```

**表单验证**:
```tsx
<Form.Item
    name="username"
    rules={[{ required: true, message: '请输入用户名' }]}
>
    <Input prefix={<UserOutlined />} placeholder="用户名" />
</Form.Item>

<Form.Item
    name="password"
    rules={[{ required: true, message: '请输入密码' }]}
>
    <Input.Password prefix={<LockOutlined />} placeholder="密码" />
</Form.Item>
```

**渐变背景设计**:
```css
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%)
```

#### 4.6.5 角色管理页面（RBAC 核心）

**文件**: `admin/src/pages/permissions/RoleList.tsx` (641行)

**核心功能**:
1. **角色 CRUD**（创建、编辑、删除）
2. **权限分配**（树形结构选择器）
3. **文件夹风格菜单树**（可展开/收起）

**权限分配流程**:
```
点击"分配权限" → 加载角色已有权限
    ↓
加载所有菜单树 (adminMenuApi.list())
加载角色已分配菜单 (adminRoleApi.getMenus(roleId))
    ↓
渲染树形选择器（文件夹风格）
    ↓
用户勾选/取消权限
    ↓
保存 (adminRoleApi.assignMenus(roleId, menuIds))
```

**菜单树节点类型**:
```typescript
interface MenuNode {
    id: number;
    parentId: number;
    title: string;
    type: number;           // 1目录 2菜单 3按钮
    permission: string;     // system:user:list
    path: string;
    icon: string;
    children: MenuNode[];
    expanded: boolean;      // 展开状态
}
```

**权限树渲染特点**:
- **图标区分**: 目录（文件夹图标）、菜单（文件图标）、按钮（API图标）
- **颜色区分**: 目录（蓝色）、菜单（绿色）、按钮（橙色）
- **级联选择**: 勾选父节点自动勾选所有子节点
- **半选状态**: 部分子节点勾选时显示 indeterminate
- **展开/收起**: 点击箭头或文件夹图标

**图标映射**:
```tsx
switch (node.type) {
    case 1: // 目录
        icon = node.expanded ? <FolderOpenOutlined /> : <FolderOutlined />;
        break;
    case 2: // 菜单
        icon = <FileOutlined style={{ color: '#52c41a' }} />;
        break;
    case 3: // 按钮
        icon = <ApiOutlined style={{ color: '#fa8c16' }} />;
        break;
}
```

### 4.7 RBAC 权限体系完整流程

#### 4.7.1 权限数据流

```
管理员登录
    ↓
后端查询 sys_admin_roles (管理员-角色关联)
    ↓
后端查询 sys_role_menus (角色-菜单关联)
    ↓
后端构建菜单树 (递归查询 sys_menus)
    ↓
后端提取所有 permissions (菜单表的 permission 字段)
    ↓
返回前端: { token, admin, permissions: [...], menus: [...] }
    ↓
authStore 保存到 localStorage
    ↓
BasicLayout 渲染动态菜单
    ↓
页面组件调用 hasPermission() 检查权限
```

#### 4.7.2 权限控制粒度

| 粒度 | 控制方式 | 实现位置 | 示例 |
|------|---------|---------|------|
| **路由级别** | 菜单 type=2 | BasicLayout 动态菜单 | 用户列表菜单是否显示 |
| **按钮级别** | 菜单 type=3 | 页面组件 hasPermission() | "编辑"按钮是否可见 |
| **API级别** | 后端中间件 | RequirePermission() | 后端拦截未授权请求 |

**前端按钮权限示例**:
```tsx
const { hasPermission } = useAuthStore();

{hasPermission('system:user:create') && (
    <Button type="primary" onClick={handleAdd}>新增用户</Button>
)}
```

#### 4.7.3 超级管理员特权

**判断逻辑**:
```typescript
// 超级管理员绕过所有权限检查
if (admin.isSuperAdmin || permissions.includes('*:*:*')) {
    return true;  // 拥有所有权限
}
```

**特权范围**:
- 查看所有菜单
- 执行所有操作
- 管理所有角色和权限

### 4.8 未解问题清单

根据 Admin 架构分析，以下问题需要进一步确认：

- ❓ 菜单树如何同步到数据库（是否有初始化脚本）
- ❓ 权限标识（permission）的完整枚举列表
- ❓ 通知系统（NotificationDropdown）的 WebSocket 推送机制
- ❓ 数据导出（adminExportApi）的 Excel 生成库（是否使用 exceljs）
- ❓ 商家端（Merchant）15个页面是否复用 Admin 布局
- ❓ 地图视图（ProjectMap）使用的地图库（高德地图 / 百度地图）
- ❓ 图表库（@ant-design/charts）的具体配置和主题定制

### 4.9 Admin 架构亮点

1. **模块化 API 封装** - 15+ API 模块，清晰职责划分
2. **统一状态管理** - Zustand + localStorage 持久化
3. **动态权限菜单** - 后端返回菜单树，前端动态渲染
4. **文件夹风格权限树** - 直观的权限分配界面
5. **标准 CRUD 模式** - 所有列表页面复用相同架构
6. **渐变卡片设计** - Dashboard 视觉冲击力强
7. **统一错误处理** - Axios 拦截器 + 401 自动登出
8. **TypeScript 类型安全** - 完整的接口定义

---

## 第7章：核心业务流程（端到端分析）

### 7.1 核心业务闭环总览

**完整数据流**：用户注册/登录 → 浏览服务商 → 创建预约(Booking) → 支付意向金 → 商家提交方案(Proposal) → 用户确认方案 → 生成订单(Order) → 支付设计费 → 创建项目(Project) → 托管账户(EscrowAccount) → 分阶段验收(Milestone) → 资金释放(Transaction) → 商家收入(MerchantIncome) → 提现(Withdraw)

**核心模型依赖关系**：
```
Booking (预约)
  ↓ BookingID
Proposal (方案) ← Version (版本管理)
  ↓ ProposalID
Order (订单) → PaymentPlan (分期)
  ↓ ProjectID
Project (项目) → EscrowAccount (托管) → Transaction (交易)
                → ProjectPhase (阶段) → Milestone (节点)
                → MerchantIncome (收入) → Withdraw (提现)
```

### 7.2 Booking（预约）状态机

#### 7.2.1 状态定义

| 状态值 | 状态名称 | 说明 | 超时控制 |
|--------|---------|------|---------|
| 1 | Pending | 待商家响应 | 48小时商家响应期限 |
| 2 | Confirmed | 商家已确认 | - |
| 4 | Cancelled | 已取消 | - |
| 5 | Disputed | 争议中 | 方案拒绝3次后自动转入 |

#### 7.2.2 状态流转

```
[用户创建预约] → Status=1 (Pending, IntentFeePaid=false)
    ↓
[用户支付意向金] → IntentFeePaid=true, MerchantResponseDeadline=now+48h
    ↓
┌───────────────────────────────────┐
│ 商家响应（48小时倒计时）           │
└───────────────────────────────────┘
    ↓                    ↓
[商家确认]          [超时未响应]
Status=2            自动退款（BookingCron每5分钟检查）
                    Status=4, IntentFeeRefunded=true

[方案被拒绝3次] → Status=5 (Disputed, 等待平台介入)
```

#### 7.2.3 核心字段

| 字段 | 类型 | 说明 | 用途 |
|------|------|------|------|
| IntentFee | float64 | 意向金金额（从SystemConfig读取，默认99） | 用于后续抵扣设计费 |
| IntentFeePaid | bool | 是否已支付意向金 | 控制商家响应期限启动 |
| IntentFeeDeducted | bool | 是否已抵扣至设计费 | 避免重复抵扣 |
| IntentFeeRefunded | bool | 是否已退款 | 超时自动退款标记 |
| MerchantResponseDeadline | *time.Time | 商家响应截止时间（48小时） | BookingCron定时任务检查 |

#### 7.2.4 关键业务逻辑

**文件**: `server/internal/service/booking_service.go:98-138`

**意向金支付流程**：
1. 幂等性检查：`if booking.IntentFeePaid { return }`
2. 设置商家响应截止时间：`deadline := now.Add(48 * time.Hour)`
3. 发送通知给商家：`NotifyBookingIntentPaid()`

**超时退款机制**（`server/internal/cron/booking_cron.go:27-41`）：
- **触发频率**: 每5分钟检查一次
- **执行逻辑**: `RefundService.BatchRefundTimeoutBookings()`
- **退款条件**: `MerchantResponseDeadline < now AND IntentFeePaid=true AND Status=1`

### 7.3 Proposal（方案）状态机与版本管理

#### 7.3.1 状态定义

| 状态值 | 状态名称 | 说明 | 超时控制 |
|--------|---------|------|---------|
| 1 | Pending | 待用户确认 | 14天确认期限 |
| 2 | Confirmed | 用户已确认 | - |
| 3 | Rejected | 用户已拒绝 | 可重新提交（≤3次） |
| 4 | Superseded | 已被新版本替代 | 版本控制 |

#### 7.3.2 版本管理机制

**核心字段**：
- `Version`: 版本号（v1, v2, v3...）
- `ParentProposalID`: 上一版本方案ID（链表结构）
- `RejectionCount`: 累计拒绝次数（达到3次转入争议）

**版本控制流程**（`proposal_service.go:197-268`）：
```
初始提交 → Proposal v1 (Status=Pending, Version=1)
    ↓
[用户拒绝] → Status=Rejected, RejectionCount=1
    ↓
[商家重新提交] →
    事务开始
    1. 标记 v1 为 Superseded (Status=4)
    2. 创建 v2 (ParentProposalID=v1.ID, Version=2, RejectionCount=1)
    事务提交
    ↓
[用户再次拒绝] → Status=Rejected, RejectionCount=2
    ↓
[商家第3次提交] → v3 (ParentProposalID=v2.ID, Version=3, RejectionCount=2)
    ↓
[用户第3次拒绝] →
    Status=Rejected, RejectionCount=3
    Booking.Status = 5 (Disputed)
    不再允许重新提交
```

#### 7.3.3 拒绝次数限制

**业务规则**（`proposal_service.go:213-216`）：
```go
if oldProposal.RejectionCount >= 3 {
    return errors.New("该预约已连续拒绝3次，无法再次提交")
}
```

**争议转入逻辑**（`proposal_service.go:348-365`）：
```go
if newRejectionCount >= 3 {
    booking.Status = 5 // Disputed
    通知商家："用户连续拒绝3次，预约已转入争议处理"
    通知用户："预约已转入平台争议处理，客服将联系协调"
}
```

#### 7.3.4 超时处理

**定时任务**（`booking_cron.go:43-122`）：
- **触发频率**: 每5分钟检查一次
- **查询条件**: `Status=Pending AND UserResponseDeadline < now`
- **处理逻辑**:
  ```
  Proposal.Status = Rejected
  Proposal.RejectionReason = "用户超时未确认（14天期限）"
  Booking.Status = 4 (Cancelled)
  意向金不退款（用户超时视为违约）
  ```

### 7.4 Order（订单）与支付流程

#### 7.4.1 订单类型

| OrderType | 说明 | 金额计算 | 意向金抵扣 |
|-----------|------|---------|-----------|
| design | 设计费订单 | 方案.DesignFee - 意向金 | ✅ 抵扣 |
| construction | 施工费订单 | 方案.ConstructionFee + MaterialFee | ❌ 不抵扣 |
| material | 主材费订单 | 单独主材费 | ❌ 不抵扣 |

#### 7.4.2 订单状态机

```
[用户确认方案] → ProposalService.ConfirmProposal()
    ↓
创建设计费订单 (Status=0 Pending, ExpireAt=now+48h)
    ↓
┌───────────────────────────────────┐
│ 用户支付（48小时倒计时）           │
└───────────────────────────────────┘
    ↓                    ↓
[用户支付成功]      [超时未支付]
Status=1 Paid       自动取消（OrderCron每1分钟检查）
                    Status=2 Cancelled

[用户主动取消] → Status=2 (仅待支付状态可取消)
```

#### 7.4.3 意向金抵扣机制

**抵扣时机**（`proposal_service.go:141-147`）：
```go
discount := 0.0
if booking.IntentFeePaid {
    discount = booking.IntentFee // 99元
}
totalAmount := proposal.DesignFee - discount
```

**抵扣标记**（`order_service.go:63-89`）：
```go
if booking.IntentFeePaid && !booking.IntentFeeDeducted {
    intentFeeDiscount = booking.IntentFee
    booking.IntentFeeDeducted = true // 标记已抵扣，避免重复
}
```

#### 7.4.4 分期付款机制

**PaymentPlan 模型**（`business_flow.go:94-110`）：
| 字段 | 说明 | 示例 |
|------|------|------|
| Type | 分期类型：milestone/onetime | milestone |
| Seq | 期数顺序 | 1, 2, 3, 4 |
| Name | 分期名称 | "开工款", "水电款", "中期款", "尾款" |
| Percentage | 比例 | 30, 35, 30, 5 |

**默认分期方案**（`order_service.go:116-122`）：
```
开工款: 30%
水电款: 35%
中期款: 30%
尾款: 5%
```

**支付顺序控制**（`order_service.go:341-348`）：
```go
// 检查前置期是否已支付
if plan.Seq > 1 {
    var prevPlan PaymentPlan
    if prevPlan.Status == 0 {
        return errors.New("请先支付上一期款项")
    }
}
```

#### 7.4.5 订单超时自动取消

**定时任务**（`order_cron.go:24-40`）：
- **触发频率**: 每1分钟检查一次（最高频率）
- **查询条件**: `Status=Pending AND ExpireAt < now`
- **执行SQL**: `UPDATE orders SET status=2 WHERE ...`
- **日志记录**: `Cancelled %d expired orders`

### 7.5 EscrowAccount（托管账户）与资金流转

#### 7.5.1 托管账户结构

| 字段 | 说明 | 计算规则 |
|------|------|---------|
| TotalAmount | 总存入金额 | 累计充值金额 |
| FrozenAmount | 冻结金额 | 已存入但未释放的金额 |
| AvailableAmount | 可用余额 | TotalAmount - FrozenAmount - ReleasedAmount |
| ReleasedAmount | 已释放金额 | 验收通过后释放的总额 |

#### 7.5.2 资金流转流程

**充值流程**（`escrow_service.go:38-77`）：
```
用户充值 → Deposit(projectID, amount, milestoneID)
    ↓
事务开始
1. EscrowAccount.TotalAmount += amount
2. EscrowAccount.FrozenAmount += amount （冻结资金）
3. 创建 Transaction (Type=deposit, Status=1)
4. 更新 Milestone.Status = 1 (施工中)
事务提交
```

**资金释放流程**（`escrow_service.go:81-136`）：
```
验收通过 → ReleaseFunds(projectID, milestoneID)
    ↓
检查 Milestone.Status == 3 (已通过验收)
    ↓
事务开始
1. EscrowAccount.FrozenAmount -= amount
2. EscrowAccount.ReleasedAmount += amount
3. 创建 Transaction (Type=release, ToUserID=ProviderID)
4. Milestone.Status = 4 (已支付), Milestone.PaidAt = now
事务提交
    ↓
资金进入商家收入账户（MerchantIncome）
```

#### 7.5.3 Transaction 交易记录

| Type | 说明 | FromUserID | ToUserID |
|------|------|-----------|----------|
| deposit | 用户充值 | UserID | 0 (系统托管) |
| release | 释放给商家 | 0 (系统) | ProviderID |
| refund | 退款给用户 | 0 (系统) | UserID |
| withdraw | 商家提现 | ProviderID | 0 (外部账户) |

### 7.6 Project（项目）生命周期

#### 7.6.1 项目阶段

**CurrentPhase 可能值**（从代码推断）：
| 阶段 | 说明 | 触发条件 |
|------|------|---------|
| selecting | 选择服务商阶段 | 项目创建初期 |
| billing | 账单生成阶段 | GenerateBill() 后 |
| design_paid | 设计费已支付 | 设计费订单支付后 |
| in_progress | 施工中 | 开工款支付后 |
| completed | 已完成 | 所有节点验收通过 |

#### 7.6.2 ProjectPhase 施工阶段

**标准阶段定义**（`model.go:234-246`）：
| PhaseType | 阶段名称 | 顺序 |
|-----------|---------|-----|
| preparation | 准备阶段 | 1 |
| demolition | 拆改阶段 | 2 |
| electrical | 水电阶段 | 3 |
| masonry | 泥瓦阶段 | 4 |
| painting | 油漆阶段 | 5 |
| installation | 安装阶段 | 6 |
| inspection | 验收阶段 | 7 |

**PhaseTask 任务模型**：
每个阶段包含多个任务（Tasks），任务状态控制工程进度。

### 7.7 MerchantIncome（商家收入）与提现

#### 7.7.1 收入类型

| Type | 说明 | 来源 | 平台抽成 |
|------|------|------|---------|
| intent_fee | 意向金收入 | 用户支付意向金 | ConfigKeyIntentFeeRate |
| design_fee | 设计费收入 | 用户支付设计费订单 | ConfigKeyDesignFeeRate |
| construction | 施工费收入 | 托管账户释放资金 | ConfigKeyConstructionFeeRate |

#### 7.7.2 收入计算

**创建收入记录**（`order_service.go:237-245`）：
```go
CreateIncome(&CreateIncomeInput{
    ProviderID:  provider.ID,
    OrderID:     order.ID,
    Type:        order.OrderType,
    Amount:      order.TotalAmount - order.Discount,
    Description: "订单支付",
})
```

**平台抽成计算**（推测逻辑）：
```
NetAmount = Amount * (1 - PlatformFeeRate)
PlatformFee = Amount * PlatformFeeRate
```

#### 7.7.3 自动结算机制

**定时任务**（`income_cron.go:9-55`）：
- **触发时间**: 每天凌晨2点
- **执行逻辑**: `MerchantIncomeService.BatchSettleExpiredIncomes()`
- **结算条件**:
  - Status = 0 (待结算)
  - 满足自动结算天数（ConfigKeySettlementAutoDays）
- **结算后状态**: Status = 1 (已结算，可提现)

### 7.8 关键业务场景时序图

#### 场景1：预约-方案-订单完整流程

```
用户                 系统                商家               定时任务
│
├─1. 创建预约────→ Booking(Status=1)
│                        │
├─2. 支付意向金──→ IntentFeePaid=true
│                    MerchantResponseDeadline=+48h
│                        │
│                        ├─通知商家────→ 📧
│                        │
│                        │            ┌────48小时倒计时────┐
│                        │            │                    │
│                        │            ←──3. 商家确认────────┤
│                        │            │ Status=2           │
│                        │            │                    │
│                        │            ←──4. 提交方案────────┤
│                        │            Proposal(v1,Pending) │
│                        │                                 │
│                   ┌────────────────────────────────────┐ │
│                   │ 超时未响应？                        │ │
│                   │ BookingCron每5分钟检查             │ │
│                   │ → 自动退款                         │ │
│                   └────────────────────────────────────┘ │
│
├─5. 确认方案────→ Proposal.Status=Confirmed
│                    Order(设计费, Status=Pending)
│                    ExpireAt=+48h
│
├─6. 支付订单────→ Order.Status=Paid
│                    意向金抵扣 99元
│                        │
│                        ├─创建收入──→ MerchantIncome
│                        │
│                        ├─通知商家──→ 📧
│
│                   ┌────────────────────────────────────┐
│                   │ 超时未支付？                        │
│                   │ OrderCron每1分钟检查               │
│                   │ → 自动取消订单                     │
│                   └────────────────────────────────────┘
```

#### 场景2：方案3次拒绝争议流程

```
用户                 系统                商家
│
├─1. 拒绝方案v1──→ Proposal.Status=Rejected
│                    RejectionCount=1
│                        │
│                        ←──2. 重新提交────┤
│                    Proposal v2(Pending)
│                    (ParentProposalID=v1.ID)
│
├─3. 拒绝方案v2──→ Status=Rejected
│                    RejectionCount=2
│                        │
│                        ←──4. 第3次提交───┤
│                    Proposal v3(Pending)
│
├─5. 拒绝方案v3──→ Status=Rejected
│                    RejectionCount=3
│                    🚨 自动触发争议流程
│                        │
│                        ├─ Booking.Status=5 (Disputed)
│                        ├─ 通知用户："转入争议处理"
│                        ├─ 通知商家："无法再次提交"
│                        └─ 等待客服介入
```

#### 场景3：托管账户分阶段付款

```
用户                 系统                商家              验收节点
│
├─1. 支付开工款──→ Deposit(30%)
│                    EscrowAccount:
│                      FrozenAmount += 30%
│                        │
│                        ├─Milestone[开工]──→ Status=1(施工中)
│                        │
│                        │            ←──2. 施工中────────┤
│                        │                               │
│                        │            ←──3. 提交验收─────┤
│                        │                               │
├─4. 确认验收────→ Milestone.Status=3(已通过)
│                        │
│                    ReleaseFunds()
│                    EscrowAccount:
│                      FrozenAmount -= 30%
│                      ReleasedAmount += 30%
│                        │
│                        ├─创建Transaction─→ Type=release
│                        ├─创建Income───────→ MerchantIncome
│                        ├─通知商家────────→ 📧 "资金已释放"
│
├─5. 支付水电款──→ Deposit(35%)
│                    (重复上述流程)
│
...中期款、尾款...
```

### 7.9 定时任务汇总

| 任务名称 | 文件 | 触发频率 | 主要职责 | 查询条件 |
|---------|------|---------|---------|---------|
| **BookingCron** | booking_cron.go | 每5分钟 | ① 商家超时退款 <br> ② 用户超时取消 | ① `Status=1 AND MerchantResponseDeadline < now` <br> ② `ProposalStatus=Pending AND UserResponseDeadline < now` |
| **OrderCron** | order_cron.go | 每1分钟 | 自动取消过期订单 | `Status=Pending AND ExpireAt < now` |
| **IncomeCron** | income_cron.go | 每天2点 | 批量结算到期收入 | `Status=0 (待结算) AND 满足结算天数` |

### 7.10 关键业务指标

#### 超时时间控制

| 业务场景 | 超时时长 | 超时后果 | 定时任务 |
|---------|---------|---------|---------|
| 商家响应预约 | 48小时 | 自动退款意向金 | BookingCron (5min) |
| 用户确认方案 | 14天 | 视为拒绝，不退款 | BookingCron (5min) |
| 订单支付 | 48小时 | 自动取消订单 | OrderCron (1min) |

#### 拒绝限制

| 业务 | 最大拒绝次数 | 达到上限后处理 |
|------|------------|---------------|
| 用户拒绝方案 | 3次 | 转入争议处理（Status=5），不允许重新提交 |

#### 金额控制

| 配置项 | 配置键 | 默认值 | 说明 |
|--------|--------|--------|------|
| 意向金金额 | booking.intent_fee | 99元 | 从 SystemConfig 读取 |
| 意向金抵扣设计费 | - | ✅ 抵扣 | 仅抵扣一次（IntentFeeDeducted 标记） |
| 最小提现金额 | withdraw.min_amount | 配置值 | - |
| 提现手续费 | withdraw.fee | 配置值 | - |

### 7.11 未解问题清单

根据端到端分析，以下问题需要进一步确认：
- ❓ RefundService.BatchRefundTimeoutBookings() 的具体实现逻辑
- ❓ MerchantIncomeService.BatchSettleExpiredIncomes() 的结算规则
- ❓ Milestone 模型的完整定义（验收节点字段）
- ❓ Project 的 CurrentPhase 完整状态列表
- ❓ 平台抽成比例的实际计算公式（ConfigKeyDesignFeeRate 等）
- ❓ 争议处理（Disputed）的人工介入流程和数据模型

---

## 第5章：Mobile 架构与用户体验设计

### 5.1 技术栈与架构概览

#### 5.1.1 核心技术栈

**前端框架**:
- **React Native 0.83.0** - 最新稳定版本
- **React 19.2.0** - 使用最新 React 版本（与 Admin 的 18.3.1 不同）
- **TypeScript** - 类型安全

**导航系统**:
- `@react-navigation/native 7.0.14`
- `@react-navigation/native-stack` - 原生堆栈导航
- `@react-navigation/bottom-tabs` - 底部标签栏

**状态管理**:
- **Zustand 5.0.2** - 轻量级状态管理
- `@react-native-async-storage/async-storage` - 数据持久化
- `react-native-keychain` - iOS Keychain 安全存储

**UI 组件库**:
- `lucide-react-native 0.363.0` - 图标库（原生兼容）
- 自定义组件（Modal, Toast, Picker 等）

**网络请求**:
- `axios 1.7.9` - HTTP 客户端（带 Token 自动刷新）

**第三方集成**:
- `@tencentcloud/chat-uikit-react-native 3.4.3` - 腾讯云 IM SDK
- `react-native-webview` - WebView 组件

**应用部署**:
- **仅原生平台**：iOS 和 Android（无 Web 支持）
- Metro bundler 开发服务器

#### 5.1.2 架构特点对比

| 特性 | Admin (Web) | Mobile (Native) | 说明 |
|-----|------------|----------------|------|
| React 版本 | 18.3.1 | 19.2.0 | Mobile 使用最新版本 |
| 路由库 | React Router v7 | React Navigation | 原生导航体验 |
| 状态管理 | Zustand (localStorage) | Zustand (AsyncStorage + Keychain) | Mobile 增加安全存储 |
| UI 框架 | Ant Design Pro | 自定义组件 | Mobile 更轻量 |
| 部署平台 | Web (浏览器) | iOS + Android | 仅原生应用 |
| Token 存储 | localStorage (明文) | iOS Keychain (加密) | Mobile 更安全 |
| Token 刷新 | 401 自动登出 | 多路径尝试 + 请求队列 | Mobile 机制更复杂 |

### 5.2 导航系统设计

#### 5.2.1 双层导航架构

**文件**: `mobile/src/navigation/AppNavigator.tsx` (365行)

**架构层级**:
```
AppNavigator (根导航)
    ├── isAuthenticated == false
    │   └── LoginScreen
    └── isAuthenticated == true
        └── MainTabs (底部 Tab 导航 - 5个)
            ├── HomeScreen (首页)
            ├── InspirationScreen (灵感)
            ├── MySiteScreen (进度)
            ├── MessageScreen (消息)
            └── ProfileScreen (我的)
        └── Stack Screens (30+ 业务页面)
```

#### 5.2.2 底部 Tab 导航

**5个核心 Tab**:
```typescript
const MainTabs = () => (
    <Tab.Navigator>
        <Tab.Screen
            name="Home"
            component={HomeScreen}
            options={{
                tabBarIcon: ({ focused }) => (
                    <Home size={24} color={focused ? '#000' : '#666'} />
                ),
                tabBarLabel: '首页',
            }}
        />
        <Tab.Screen name="Inspiration" component={InspirationScreen} />
        <Tab.Screen name="Progress" component={MySiteScreen} />
        <Tab.Screen name="Message" component={MessageScreen} />
        <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
);
```

**Tab 样式定制**:
- **激活态**: 黑色图标 + 下划线装饰
- **未激活**: 灰色图标
- **图标库**: lucide-react-native（轻量级）

#### 5.2.3 Stack 导航（30+ 页面）

**核心业务页面** (部分):
| 页面名称 | 组件 | 说明 | 路由参数 |
|---------|------|------|---------|
| ProviderDetails | ProviderDetailsScreen | 服务商详情 | provider, providerType |
| Booking | BookingScreen | 预约服务 | provider, providerType |
| Payment | PaymentScreen | 支付页面 | bookingId, amount, providerName |
| ProposalPaidDetail | ProposalPaidDetailScreen | 方案详情（已付费） | proposalId, fromProject |
| ProjectDetail | ProjectDetailScreen | 项目详情 | projectId |
| ProjectTimeline | ProjectTimelineScreen | 施工进度 | project |
| Bill | BillScreen | 账单费用 | projectId |
| ChatRoom | ChatRoomScreen | 聊天室 | conversationID, targetUserId |
| OrderList | OrderListScreen | 订单列表 | - |
| BookingList | BookingListScreen | 预约列表 | - |
| Settings | SettingsScreen | 设置 | - |

**导航参数类型定义**:
```typescript
export type RootStackParamList = {
    Login: undefined;
    Main: undefined;
    ProviderDetails: { provider: any; providerType: 'designer' | 'worker' | 'company' };
    Booking: { provider: any; providerType: string };
    Payment: { bookingId: number; amount: number; providerName: string };
    ProposalPaidDetail: { proposalId: number; fromProject?: boolean };
    ProjectDetail: { projectId: number };
    // ...30+ 路由定义
};
```

#### 5.2.4 条件路由（认证保护）

**根据登录状态切换导航**:
```typescript
const AppNavigator = () => {
    const { isAuthenticated, isLoading } = useAuthStore();

    useEffect(() => {
        if (isAuthenticated) {
            // 登录后初始化腾讯云 IM（后台静默）
            TencentIMService.init();
        }
    }, [isAuthenticated]);

    return (
        <NavigationContainer>
            <Stack.Navigator screenOptions={{ headerShown: false }}>
                {isAuthenticated ? (
                    <>
                        <Stack.Screen name="Main" component={MainTabs} />
                        {/* 30+ 业务页面 */}
                    </>
                ) : (
                    <Stack.Screen name="Login" component={LoginScreen} />
                )}
            </Stack.Navigator>
        </NavigationContainer>
    );
};
```

**特点**:
- **统一入口**: 未登录强制跳转 LoginScreen
- **腾讯 IM 自动初始化**: 登录成功后后台静默初始化
- **无 Header**: 所有页面自定义 Header（设计一致性）

### 5.3 状态管理（Zustand）

#### 5.3.1 authStore 认证状态

**文件**: `mobile/src/store/authStore.ts` (109行)

**核心状态**:
```typescript
interface AuthState {
    token: string | null;
    refreshToken: string | null;
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;

    // Actions
    setAuth: (token, refreshToken, user) => void;
    logout: () => void;
    updateUser: (user) => void;
    checkAuth: () => Promise<void>;
}
```

**状态持久化**:
```typescript
// 登录时保存
setAuth: async (token, refreshToken, user) => {
    await SecureStorage.saveToken(token);
    await SecureStorage.saveRefreshToken(refreshToken);
    await AsyncStorage.setItem('@user', JSON.stringify(user));
    set({ token, refreshToken, user, isAuthenticated: true });
},

// 登出时清除
logout: async () => {
    await SecureStorage.deleteToken();
    await SecureStorage.deleteRefreshToken();
    await AsyncStorage.removeItem('@user');
    set({ token: null, refreshToken: null, user: null, isAuthenticated: false });
},
```

**关键特性**:
- **Token 双层存储**: iOS Keychain（加密） + AsyncStorage（用户信息）
- **启动时自动检查**: `checkAuth()` 从安全存储恢复 Token
- **刷新机制**: refreshToken 单独存储，用于 Token 过期时刷新

#### 5.3.2 providerStore 服务商状态

**文件**: `mobile/src/store/providerStore.ts` (216行)

**核心状态**:
```typescript
interface ProviderState {
    designers: Designer[];
    companies: Company[];
    foremen: Foreman[];
    loading: boolean;
    error: string | null;

    // Actions
    loadDesigners: () => Promise<void>;
    loadCompanies: () => Promise<void>;
    loadForemen: () => Promise<void>;
}
```

**数据加载流程**:
```typescript
loadDesigners: async () => {
    set({ loading: true, error: null });
    try {
        const res = await providerApi.designers({ page: 1, pageSize: 100 });
        set({ designers: res.data.list || [], loading: false });
    } catch (error: any) {
        set({ error: error.message, loading: false });
    }
},
```

**特点**:
- **分类存储**: 设计师、装修公司、工长分别存储
- **统一加载状态**: loading + error 统一管理
- **首页预加载**: HomeScreen 初始化时调用 `loadDesigners()`

### 5.4 API 服务层设计

#### 5.4.1 API 层架构

**文件**: `mobile/src/services/api.ts` (359行)

**baseURL 动态配置**:
```typescript
const BASE_URL = __DEV__
    ? 'http://10.0.2.2:8080/api/v1'  // Android 模拟器
    : 'https://api.yourdomain.com/api/v1';
```

**请求拦截器（Token 注入）**:
```typescript
api.interceptors.request.use(
    async (config) => {
        const token = await SecureStorage.getToken();
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);
```

#### 5.4.2 Token 自动刷新机制（核心）

**多路径尝试刷新**:
```typescript
const tryRefreshToken = async (refreshToken: string) => {
    const candidates = [
        '/auth/refresh-token',   // 标准路径
        '/auth/refreshToken',    // 驼峰路径
        '/auth/refresh'          // 简化路径
    ];

    for (const path of candidates) {
        try {
            const response = await axios.post(`${BASE_URL}${path}`, { refreshToken });
            const data = response.data?.data ?? response.data;
            const token = data?.token;
            if (!token) throw new Error('Empty token');
            return { token, refreshToken: data?.refreshToken };
        } catch (err) {
            const status = err?.response?.status;
            // 404/405/501 继续尝试下一条路径
            if (status && ![404, 405, 501].includes(status)) {
                throw err; // 其他错误直接抛出
            }
        }
    }
    throw new Error('Refresh token failed');
};
```

**响应拦截器（401 自动刷新）**:
```typescript
// 请求队列管理
let isRefreshing = false;
let requestsQueue: Array<{ resolve: Function; reject: Function }> = [];

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        // 401 错误且未重试过
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            const refreshToken = await SecureStorage.getRefreshToken();
            if (!refreshToken) {
                // 无 refreshToken，直接登出
                authEventEmitter.emit('session_expired', {
                    reason: 'no_refresh_token',
                    message: '登录已过期，请重新登录',
                });
                return Promise.reject(error);
            }

            if (isRefreshing) {
                // 等待刷新完成（请求队列）
                return new Promise((resolve, reject) => {
                    requestsQueue.push({ resolve, reject });
                }).then(token => {
                    originalRequest.headers.Authorization = `Bearer ${token}`;
                    return api(originalRequest);
                });
            }

            isRefreshing = true;

            try {
                const { token, refreshToken: newRefreshToken } = await tryRefreshToken(refreshToken);

                // 更新安全存储
                await SecureStorage.saveToken(token);
                if (newRefreshToken) {
                    await SecureStorage.saveRefreshToken(newRefreshToken);
                }

                // 更新 authStore
                useAuthStore.getState().setAuth(token, newRefreshToken || refreshToken, useAuthStore.getState().user);

                // 处理队列中的请求
                requestsQueue.forEach(({ resolve }) => resolve(token));
                requestsQueue = [];

                // 重试原请求
                originalRequest.headers.Authorization = `Bearer ${token}`;
                return api(originalRequest);
            } catch (refreshError) {
                // Token 刷新失败 - 触发会话过期事件
                requestsQueue.forEach(({ reject }) => reject(refreshError));
                requestsQueue = [];

                authEventEmitter.emit('session_expired', {
                    reason: 'refresh_token_failed',
                    message: '登录已过期，请重新登录',
                });

                return Promise.reject(refreshError);
            } finally {
                isRefreshing = false;
            }
        }

        return Promise.reject(error);
    }
);
```

**关键特性**:
1. **多路径容错**: 3条路径尝试（向后兼容不同后端版本）
2. **请求队列**: 刷新期间暂存其他请求，刷新成功后批量重试
3. **幂等性保证**: `_retry` 标记避免无限循环
4. **事件驱动**: 使用 `authEventEmitter` 通知应用层登录过期
5. **Token 双更新**: 同步更新 SecureStorage + authStore

#### 5.4.3 API 模块化

**15+ API 模块**:
```typescript
// 认证相关
export const authApi = {
    login: (data) => api.post('/auth/login', data),
    sendCode: (phone) => api.post('/auth/send-code', { phone }),
};

// 服务商相关
export const providerApi = {
    designers: (params) => api.get('/designers', { params }),
    companies: (params) => api.get('/companies', { params }),
    foremen: (params) => api.get('/foremen', { params }),
};

// 预约相关
export const bookingApi = {
    create: (data) => api.post('/bookings', data),
    list: (params) => api.get('/bookings', { params }),
    detail: (id) => api.get(`/bookings/${id}`),
};

// 项目相关
export const projectApi = {
    list: (params) => api.get('/projects', { params }),
    detail: (id) => api.get(`/projects/${id}`),
    timeline: (id) => api.get(`/projects/${id}/timeline`),
};

// 方案相关
export const proposalApi = {
    list: (params) => api.get('/proposals', { params }),
    detail: (id) => api.get(`/proposals/${id}`),
    confirm: (id) => api.post(`/proposals/${id}/confirm`),
    reject: (id, reason) => api.post(`/proposals/${id}/reject`, { reason }),
};

// ...10+ 其他模块
```

### 5.5 安全存储（iOS Keychain）

**文件**: `mobile/src/utils/SecureStorage.ts`

**核心方法**:
```typescript
import * as Keychain from 'react-native-keychain';

const TOKEN_KEY = 'user_token';
const REFRESH_TOKEN_KEY = 'user_refresh_token';

export const SecureStorage = {
    saveToken: async (token: string) => {
        await Keychain.setGenericPassword(TOKEN_KEY, token);
    },

    getToken: async (): Promise<string | null> => {
        const credentials = await Keychain.getGenericPassword();
        return credentials ? credentials.password : null;
    },

    deleteToken: async () => {
        await Keychain.resetGenericPassword();
    },

    // refreshToken 同理...
};
```

**安全特性**:
- **iOS Keychain**: 系统级加密存储（Face ID/Touch ID 保护）
- **Android Keystore**: 硬件级密钥存储
- **自动加密**: 框架自动处理加密/解密

### 5.6 核心页面架构模式

#### 5.6.1 LoginScreen（登录页面）

**文件**: `mobile/src/screens/LoginScreen.tsx` (542行)

**核心功能**:
1. **双登录模式**: 验证码登录 / 密码登录（切换）
2. **手机号格式化**: 自动格式化为 `138 0013 8000`
3. **实时验证**: useMemo 计算手机号/验证码有效性
4. **协议勾选**: 强制勾选用户协议（Modal 提示）
5. **未注册自动注册**: 后端自动处理

**验证码登录流程**:
```
用户输入手机号 → 实时格式化 (138 0013 8000)
    ↓
点击"获取验证码" → 60秒倒计时
    ↓
后端发送验证码（测试码固定 123456）
    ↓
用户输入验证码 → 6位数字验证
    ↓
点击"进入平台" → 检查协议勾选
    ↓
调用 authApi.login({ phone, code, type: 'code' })
    ↓
后端返回 { token, refreshToken, user }
    ↓
setAuth(token, refreshToken, user)
    ↓
自动跳转 Main（条件路由）
```

**表单验证**:
```typescript
const isPhoneValid = useMemo(() => /^1[3-9]\d{9}$/.test(phone), [phone]);
const isCodeValid = useMemo(() => /^\d{6}$/.test(code), [code]);
const canSubmit = useMemo(() => {
    if (!isPhoneValid) return false;
    if (loginMethod === 'code') {
        return isCodeValid;
    } else {
        return password.length >= 6;
    }
}, [isPhoneValid, isCodeValid, loginMethod, password]);
```

**UI 特点**:
- **极简风格**: 黑白灰配色 + 细线设计
- **响应式反馈**: 手机号正确显示绿色 ✓
- **无障碍设计**: 大按钮 + 清晰提示

#### 5.6.2 BookingScreen（预约页面）

**文件**: `mobile/src/screens/BookingScreen.tsx` (1501行)

**复杂度**: Mobile 端最复杂的表单页面

**核心功能**:
1. **9个表单字段**: 地址、面积、户型、装修类型、预算、期望时间、手机号、备注
2. **4个自定义 Picker**: 户型（滚动选择器）、预算（下拉菜单）、日期时间（双列选择器）
3. **实时验证**: 地址 ≥5字符、面积 10-9999㎡
4. **动态 Provider 信息**: 从路由参数获取服务商数据
5. **表单状态管理**: 所有字段 useState + 联动验证

**表单验证链**:
```typescript
const handleSubmit = async () => {
    if (!address.trim()) { setFormError('请输入房屋地址'); return; }
    if (address.trim().length < 5) { setFormError('地址至少输入5个字符'); return; }
    if (!area.trim()) { setFormError('请输入房屋面积'); return; }
    const areaNum = parseFloat(area);
    if (isNaN(areaNum) || areaNum < 10 || areaNum > 9999) {
        setFormError('房屋面积必须在 10-9999 ㎡ 之间');
        return;
    }
    if (!renovationType) { setFormError('请选择装修类型'); return; }
    if (!budget) { setFormError('请选择预算范围'); return; }
    if (!preferredDate) { setFormError('请选择期望上门时间'); return; }
    if (!phone.trim()) { setFormError('请填写联系电话'); return; }

    // 提交预约
    const result = await bookingApi.create({
        providerId: Number(provider.id),
        providerType: providerType,
        address,
        area: areaNum,
        renovationType,
        budgetRange: budget,
        preferredDate,
        phone: user?.phone || phone,
        notes,
        houseLayout: `${room}室${hall}厅${toilet}卫`
    });

    // 跳转到支付页面（使用 replace 避免返回）
    navigation.replace('Payment', {
        bookingId: bookingData.id,
        amount: bookingData.intentFee || 99,
        providerName: provider.name,
    });
};
```

**户型选择器**（滚动 Picker）:
```tsx
<Modal visible={showLayoutPicker} ...>
    <View style={styles.pickerContainer}>
        {/* 3列滚动选择器 */}
        <View style={styles.pickerColumn}>
            <Text>室</Text>
            <ScrollView>
                {[1,2,3,4,5,6,7,8,9].map(num => (
                    <TouchableOpacity onPress={() => setRoom(num)}>
                        <Text>{num}</Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </View>
        <View style={styles.pickerColumn}>
            <Text>厅</Text>
            {/* 同理 */}
        </View>
        <View style={styles.pickerColumn}>
            <Text>卫</Text>
            {/* 同理 */}
        </View>
    </View>
</Modal>
```

**日期时间选择器**（双列布局）:
```tsx
<Modal visible={showDatePicker} ...>
    <View style={styles.pickerBody}>
        {/* 左列：日期（未来7天） */}
        <View style={styles.pickerColumnLeft}>
            <ScrollView>
                {weekDays.map(day => (
                    <TouchableOpacity
                        style={[selectedDayId === day.id && styles.active]}
                        onPress={() => setSelectedDayId(day.id)}
                    >
                        <Text>{day.fullDate}</Text> {/* 01-15 [周一] */}
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </View>

        {/* 右列：时间段 */}
        <View style={styles.pickerColumnRight}>
            <ScrollView>
                <TouchableOpacity>
                    <Text>09:00-12:00 上午</Text>
                </TouchableOpacity>
                <TouchableOpacity>
                    <Text>14:00-18:00 下午</Text>
                </TouchableOpacity>
                <TouchableOpacity>
                    <Text>19:00-21:00 晚上</Text>
                </TouchableOpacity>
            </ScrollView>
        </View>
    </View>
</Modal>
```

**UI 特点**:
- **沉浸式设计**: 无 Header，全屏表单
- **浮动 Footer**: 定金 + 确认按钮悬浮底部
- **错误提示**: 字段级错误提示（红色文字）
- **表单状态**: 禁用状态显示灰色（手机号预填充）

#### 5.6.3 ProjectDetailScreen（项目详情）

**文件**: `mobile/src/screens/ProjectDetailScreen.tsx` (528行)

**核心功能**:
1. **项目状态卡片**: 动态颜色标签 + 创建时间
2. **基本信息网格**: 地址、面积、预算、当前阶段
3. **时间节点时间轴**: 开始日期 + 预计完工
4. **3个快捷入口**: 设计方案、账单费用、进度跟踪

**项目状态映射**:
```typescript
const PROJECT_STATUS_MAP: Record<number, { label: string; color: string }> = {
    0: { label: '准备阶段', color: '#F59E0B' },
    1: { label: '施工中', color: '#3B82F6' },
    2: { label: '已完工', color: '#10B981' },
    3: { label: '已取消', color: '#EF4444' },
};
```

**设计方案入口特殊设计**:
```tsx
{project.proposalId && (
    <TouchableOpacity
        style={[styles.actionCard, styles.proposalCard]}
        onPress={() => navigation.navigate('ProposalPaidDetail', {
            proposalId: project.proposalId,
            fromProject: true
        })}
    >
        <View style={[styles.actionIcon, styles.proposalIcon]}>
            <FileText size={24} color="#059669" />
        </View>
        <View style={styles.actionTextContainer}>
            <Text style={styles.actionLabel}>设计方案</Text>
            <Text style={styles.actionSubLabel}>查看图纸与方案详情</Text>
        </View>
        <ChevronRight size={16} color="#059669" />
    </TouchableOpacity>
)}
```

**特点**:
- **有方案才显示**: `proposalId` 存在时渲染绿色卡片
- **视觉突出**: 绿色边框 + 绿色背景区分其他入口
- **导航参数**: `fromProject: true` 标记来源

### 5.7 腾讯 IM 集成

**初始化时机**:
```typescript
// AppNavigator.tsx:53-57
useEffect(() => {
    if (isAuthenticated) {
        // 登录后初始化腾讯云 IM（后台静默）
        TencentIMService.init();
    }
}, [isAuthenticated]);
```

**特点**:
- **静默初始化**: 无 UI 阻塞
- **依赖认证**: 只有登录后才初始化
- **全局单例**: TencentIMService 维护 IM 连接

### 5.8 Mobile 架构亮点

#### 5.8.1 安全性亮点

1. **Token 三层保护**:
   - iOS Keychain 硬件级加密
   - 自动刷新机制（多路径容错）
   - 请求队列避免并发刷新

2. **手机号脱敏**:
   ```typescript
   const maskPhone = (phone: string): string => {
       return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
   };
   ```

3. **会话过期事件驱动**:
   - 解耦 API 层 和 UI 层
   - 统一处理登录过期（authEventEmitter）

#### 5.8.2 用户体验亮点

1. **表单实时验证**:
   - useMemo 优化计算性能
   - 视觉反馈（绿色 ✓、红色错误提示）

2. **无缝登录流程**:
   - 条件路由自动跳转
   - 腾讯 IM 后台静默初始化

3. **原生级交互**:
   - 自定义 Picker Modal（滚动选择器）
   - 双列日期时间选择器
   - 浮动 Footer 设计

#### 5.8.3 技术亮点

1. **React 19 最新特性**:
   - Mobile 端使用最新版本（Admin 受限于 Ant Design）

2. **模块化架构**:
   - 15+ API 模块分离
   - 导航层、状态层、UI 层清晰分层

3. **多路径 Token 刷新**:
   - 容错性强（3条路径尝试）
   - 请求队列机制（避免竞态条件）

### 5.9 未解问题清单

根据 Mobile 架构分析，以下问题需要进一步确认：
- ❓ TencentIMService.init() 的具体实现（SDK 初始化参数）
- ❓ authEventEmitter 的完整实现（事件类型、监听器注册）
- ❓ SecureStorage 在 Android 端的加密实现
- ❓ Token 刷新失败后的用户引导流程（跳转登录页？）
- ❓ HomeScreen 的服务商列表分页加载机制
- ❓ WebView 组件的使用场景（方案 PDF 预览？）

---

## 第6章：部署与配置管理

### 6.1 部署架构概览

#### 6.1.1 部署环境划分

| 环境 | 配置文件 | 用途 | 特点 |
|-----|---------|------|------|
| **本地开发** | docker-compose.local.yml | 开发调试 | 热更新、明文密码、暴露端口 |
| **生产环境** | deploy/docker-compose.prod.yml | 正式部署 | 强制环境变量、重启策略、数据卷持久化 |
| **测试环境** | （未配置） | 预发布测试 | - |

#### 6.1.2 部署架构对比

**本地开发架构**:
```
┌─────────────────────────────────────────────┐
│ 本地开发环境 (docker-compose.local.yml)     │
├─────────────────────────────────────────────┤
│ ┌─────────┐  ┌─────────┐  ┌─────────────┐ │
│ │ db      │  │ redis   │  │ api (热更新) │ │
│ │ PG 15   │  │ 6.2     │  │ Go + Air    │ │
│ │ 5432    │  │ 6380    │  │ 8080        │ │
│ └─────────┘  └─────────┘  └─────────────┘ │
│                                             │
│ ┌─────────────────────────────────────────┐ │
│ │ admin (Vite Dev Server)                 │ │
│ │ React 18.3.1 + HMR                      │ │
│ │ 5173                                    │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ ⚠️ Mobile 不在 Docker 中（原生开发）         │
└─────────────────────────────────────────────┘
```

**生产部署架构**:
```
┌─────────────────────────────────────────────┐
│ 生产环境 (deploy/docker-compose.prod.yml)   │
├─────────────────────────────────────────────┤
│ ┌─────────┐  ┌─────────┐  ┌─────────────┐ │
│ │ db      │  │ redis   │  │ api         │ │
│ │ PG 15   │  │ 6.2     │  │ Go Binary   │ │
│ │ 内网    │  │ 内网    │  │ 内网        │ │
│ └─────────┘  └─────────┘  └─────────────┘ │
│      ↑            ↑              ↑         │
│      └────────────┴──────────────┘         │
│                   │                        │
│         ┌─────────▼─────────┐              │
│         │ web (Nginx)       │              │
│         │ 静态文件 + 反向代理 │              │
│         │ 8888 (HTTP)       │              │
│         │ 443  (HTTPS)      │              │
│         └───────────────────┘              │
│                   │                        │
└───────────────────┼────────────────────────┘
                    ▼
              公网访问入口
```

### 6.2 Docker Compose 配置分析

#### 6.2.1 本地开发环境（docker-compose.local.yml）

**文件**: `docker-compose.local.yml` (78行)

**核心服务**:

**1. PostgreSQL 数据库**:
```yaml
db:
  image: postgres:15-alpine
  container_name: home_decor_db_local
  environment:
    POSTGRES_USER: postgres
    POSTGRES_PASSWORD: "IXwUBjxFia33XltiY0wFch8n3N68hptI"  # ⚠️ 开发环境明文密码
    POSTGRES_DB: home_decoration
  ports:
    - "5432:5432"  # 暴露到宿主机，方便本地连接
  volumes:
    - ./db_data_local:/var/lib/postgresql/data  # 本地持久化
  networks:
    - dev-net
```

**关键设计**:
- **端口暴露**: 5432 映射到宿主机，方便 DBeaver/TablePlus 连接
- **数据持久化**: `db_data_local/` 目录（已在 .gitignore）
- **明文密码**: 开发环境可接受，**生产环境禁止**

**2. Redis 缓存**:
```yaml
redis:
  image: redis:6.2-alpine
  command: redis-server --requirepass kXTSG3Q7yjug7I60JgOmWo6w9OIJrFUf
  ports:
    - "6380:6379"  # 避免与本地 Redis 冲突
```

**关键设计**:
- **端口映射**: 宿主机 6380 → 容器 6379（避免冲突）
- **密码保护**: `--requirepass` 参数设置密码

**3. 后端 API（热更新）**:
```yaml
api:
  build:
    context: ./server
    dockerfile: Dockerfile.api.dev  # 开发专用 Dockerfile
  depends_on:
    - db
    - redis
  volumes:
    - ./server:/app  # 代码挂载，实现热更新
  environment:
    - APP_ENV=local
    - DATABASE_HOST=db  # 容器内服务名解析
    - DATABASE_PASSWORD=IXwUBjxFia33XltiY0wFch8n3N68hptI
    - REDIS_HOST=redis
  ports:
    - "8080:8080"
```

**关键设计**:
- **代码热更新**: 挂载 `./server:/app`，使用 Air 自动重启
- **服务依赖**: `depends_on` 确保 db/redis 先启动
- **环境变量注入**: 直接在 compose 文件配置

**4. Admin 管理后台（Vite Dev Server）**:
```yaml
admin:
  build:
    context: .
    dockerfile: deploy/Dockerfile.node.dev
  working_dir: /app/admin
  volumes:
    - .:/app  # 挂载整个项目（包含 admin/）
  ports:
    - "5173:5173"
  environment:
    - VITE_API_URL=http://localhost:8080/api/v1
  command: |
    sh -c "npm install --registry=https://registry.npmmirror.com/ --legacy-peer-deps && npm run dev -- --host"
```

**关键设计**:
- **HMR 支持**: Vite Dev Server，代码修改即时刷新
- **国内镜像**: `--registry=https://registry.npmmirror.com/`
- **--legacy-peer-deps**: 兼容 Ant Design 依赖冲突
- **--host**: 允许容器外部访问（0.0.0.0）

**5. Mobile 端说明**:
```yaml
# 注意: Mobile 端仅用于原生 App 开发
# 使用 React Native Metro (npm start) 和 Android Studio/Xcode
# Web 版本已禁用，无需 Docker 容器
```

**设计考虑**: 原生应用无需容器化

#### 6.2.2 生产环境（deploy/docker-compose.prod.yml）

**文件**: `deploy/docker-compose.prod.yml` (74行)

**核心差异**:

**1. 强制环境变量（安全）**:
```yaml
db:
  environment:
    POSTGRES_USER: ${DB_USER:-postgres}  # 默认值 postgres
    POSTGRES_PASSWORD: ${DB_PASSWORD:?DB_PASSWORD not set}  # 强制设置
    POSTGRES_DB: ${DB_NAME:-home_decoration}

redis:
  command: redis-server --requirepass ${REDIS_PASSWORD:?REDIS_PASSWORD not set}

api:
  environment:
    - SERVER_MODE=release  # 生产模式
    - JWT_SECRET=${JWT_SECRET:?JWT_SECRET not set}
    - ENCRYPTION_KEY=${ENCRYPTION_KEY:?ENCRYPTION_KEY not set}
```

**语法解释**:
- `${VAR:-default}`: 变量未设置时使用默认值
- `${VAR:?error message}`: 变量未设置时报错退出

**2. 重启策略**:
```yaml
db:
  restart: always  # 容器异常退出自动重启

redis:
  restart: always

api:
  restart: always

web:
  restart: always
```

**3. 数据卷持久化（命名卷）**:
```yaml
volumes:
  db_data_prod:  # Docker 管理的命名卷
  redis_data_prod:

db:
  volumes:
    - db_data_prod:/var/lib/postgresql/data

redis:
  volumes:
    - redis_data_prod:/data
```

**命名卷 vs 绑定挂载**:
- **命名卷**: Docker 管理，备份方便（生产推荐）
- **绑定挂载**: 本地目录，调试方便（开发环境）

**4. Nginx 前端服务**:
```yaml
web:
  build:
    context: ../
    dockerfile: deploy/Dockerfile.frontend
  ports:
    - "8888:8888"  # HTTP
    - "443:443"    # HTTPS
  depends_on:
    - api
```

**职责**:
- 静态文件服务（Admin 管理后台）
- API 反向代理（/api/ → api:8080）

**5. 数据库建议**:
```yaml
# ⚠️ 生产环境数据库配置说明
# 推荐使用云数据库服务（如 AWS RDS, 阿里云 RDS, 腾讯云 CDB）
# 如需自托管，请务必：
# 1. 设置强密码环境变量（至少16字符，包含大小写字母、数字、特殊字符）
# 2. 限制数据库端口仅对内网开放，不要暴露到公网
# 3. 定期备份数据库
```

### 6.3 容器化构建策略

#### 6.3.1 后端构建（Dockerfile.backend）

**文件**: `deploy/Dockerfile.backend` (38行)

**多阶段构建**:
```dockerfile
# ==========================================
# Stage 1: 构建阶段
# ==========================================
FROM golang:1.23-alpine AS builder

ENV GOPROXY=https://goproxy.cn,direct
ENV CGO_ENABLED=0
ENV GOOS=linux
ENV GOARCH=amd64

WORKDIR /app

# 缓存依赖层（优化构建速度）
COPY server/go.mod ./
COPY server/go.su[m] ./  # 可选文件（[]语法）
RUN go mod download

# 构建二进制
COPY server/ .
RUN go build -ldflags="-s -w" -o api-server cmd/api/main.go

# ==========================================
# Stage 2: 运行阶段
# ==========================================
FROM alpine:latest

WORKDIR /app

# 安装时区数据
RUN apk add --no-cache tzdata
ENV TZ=Asia/Shanghai

COPY --from=builder /app/api-server .

EXPOSE 8080

CMD ["./api-server"]
```

**关键优化**:
1. **多阶段构建**: 构建阶段 500MB+ → 运行阶段 20MB
2. **依赖缓存**: `go.mod` 单独拷贝，依赖变化时才重新下载
3. **二进制优化**: `-ldflags="-s -w"` 去除调试信息（减小 30%）
4. **国内镜像**: `GOPROXY=https://goproxy.cn`
5. **时区设置**: Asia/Shanghai（日志时间正确）

**镜像大小对比**:
- **开发镜像**（golang:1.23-alpine）: 约 450MB
- **生产镜像**（alpine + 二进制）: 约 20MB

#### 6.3.2 前端构建（Dockerfile.frontend）

**文件**: `deploy/Dockerfile.frontend` (42行)

**多阶段构建**:
```dockerfile
# ==========================================
# Stage 1: 构建 Admin Panel (React 18.3.1)
# ==========================================
FROM node:20-alpine AS admin-builder
WORKDIR /app/admin

# 国内镜像加速
RUN npm config set registry https://registry.npmmirror.com

COPY admin/package.json ./
RUN npm install --legacy-peer-deps

COPY admin/ ./

# 增加 Node.js 堆内存（2GB 服务器优化）
ENV NODE_OPTIONS="--max-old-space-size=1536"
RUN npm run build

# ==========================================
# Stage 2: Nginx 静态文件服务器
# ==========================================
FROM nginx:alpine

# 时区设置
RUN apk add --no-cache tzdata
ENV TZ=Asia/Shanghai

# 复制 Nginx 配置
COPY deploy/nginx/nginx.conf /etc/nginx/nginx.conf

# 复制 Admin 构建产物
# Admin 部署到 /usr/share/nginx/html/admin
COPY --from=admin-builder /app/admin/dist /usr/share/nginx/html/admin

# Note: Mobile app is native-only (React Native)
# No web build needed. Use Android Studio or Xcode for mobile deployment.

EXPOSE 80
EXPOSE 443

CMD ["nginx", "-g", "daemon off;"]
```

**关键优化**:
1. **内存限制**: `NODE_OPTIONS="--max-old-space-size=1536"`（防止 OOM）
2. **国内镜像**: npm 淘宝镜像加速
3. **--legacy-peer-deps**: 兼容 Ant Design 依赖
4. **静态路径**: Admin 部署到 `/admin` 子路径

**构建内存说明**:
- Vite 构建 Admin 大约需要 1.5GB 内存
- 2GB 服务器：1536MB（留出系统内存）
- 4GB 服务器：3072MB

#### 6.3.3 开发环境构建（Dockerfile.api.dev）

**文件**: `server/Dockerfile.api.dev` (29行)

```dockerfile
FROM golang:1.23-alpine

# 安装 git (air 依赖)
RUN apk add --no-cache git

# 设置 Go 代理
ENV GOPROXY=https://goproxy.cn,direct

# 安装 air (热更新工具)
RUN go install github.com/cosmtrek/air@v1.51.0

WORKDIR /app

# 预拷贝依赖
COPY go.mod go.sum ./
RUN go mod download

# 复制源码
COPY . .

EXPOSE 8080

# 使用 air 运行（热更新）
CMD ["air", "-c", ".air.linux.toml"]
```

**Air 热更新原理**:
- 监听源码变化
- 自动重新编译
- 自动重启进程
- 开发体验类似 Nodemon

### 6.4 配置管理机制

#### 6.4.1 配置文件层次

```
配置优先级（从高到低）:
1. 环境变量（最高优先级）
2. .env 文件（未提交到 Git）
3. config.docker.yaml（Docker 环境）
4. config.yaml（默认配置）
```

#### 6.4.2 config.yaml（本地开发）

**文件**: `server/config.yaml` (38行)

```yaml
server:
  host: "0.0.0.0"
  port: "8080"
  mode: "debug"  # 开发模式
  public_url: "http://localhost:8080"

database:
  host: "localhost"
  port: "5432"
  user: "postgres"
  password: "${DATABASE_PASSWORD}"  # 环境变量占位符
  dbname: "home_decoration"
  sslmode: "disable"

redis:
  host: "localhost"
  port: "6380"
  password: "${REDIS_PASSWORD}"
  db: 0

jwt:
  secret: "${JWT_SECRET}"
  expire_hour: 8

log:
  level: "info"
  file: "logs/backend.log"

wechat_mini:
  app_id: "${WECHAT_MINI_APPID}"
  app_secret: "${WECHAT_MINI_SECRET}"
  bind_token_expire_minutes: 5
```

**关键特性**:
- **环境变量占位符**: `${VAR_NAME}` 由 Viper 自动替换
- **本地默认值**: localhost、6380 端口

#### 6.4.3 config.docker.yaml（Docker 环境）

**文件**: `server/config.docker.yaml` (34行)

```yaml
server:
  host: "0.0.0.0"
  port: "8080"
  mode: "release"  # 生产模式

database:
  host: "db"  # Docker 服务名
  port: "5432"
  user: "postgres"
  password: ""  # 从环境变量 DATABASE_PASSWORD 读取
  dbname: "home_decoration"
  sslmode: "disable"

redis:
  host: "redis"  # Docker 服务名
  port: "6379"
  password: ""  # 从环境变量 REDIS_PASSWORD 读取
  db: 0

jwt:
  secret: ""  # 从环境变量 JWT_SECRET 读取
  expire_hour: 8
```

**关键差异**:
- **服务发现**: `db`、`redis` 容器名（Docker 内部 DNS）
- **空密码**: 强制从环境变量读取

#### 6.4.4 环境变量管理

**文件**: `.env.example` (102行) 和 `server/.env.example` (36行)

**核心环境变量分类**:

**1. 应用环境**:
```bash
APP_ENV=local  # local, docker, production
```

**2. 服务器配置**:
```bash
SERVER_HOST=0.0.0.0
SERVER_PORT=8080
SERVER_MODE=debug  # debug, release
```

**3. 数据库配置**:
```bash
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=postgres
DATABASE_PASSWORD=your_db_password_here  # ⚠️ 必须修改
DATABASE_NAME=home_decoration
DATABASE_SSLMODE=disable
```

**4. Redis 配置**:
```bash
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=  # 可选
REDIS_DB=0
```

**5. JWT 认证**:
```bash
# 重要: 生产环境必须使用强随机字符串!
# 生成方法: openssl rand -base64 32
JWT_SECRET=your_jwt_secret_key_here_please_change_in_production
JWT_EXPIRE_HOUR=8
```

**6. 敏感数据加密**:
```bash
# 用于加密身份证号、银行卡号等
# 生成命令: openssl rand -base64 32
ENCRYPTION_KEY=REPLACE_WITH_YOUR_32_BYTE_KEY_HERE
```

**7. 第三方服务**:
```bash
# 短信服务 (阿里云)
SMS_ACCESS_KEY_ID=
SMS_ACCESS_KEY_SECRET=
SMS_SIGN_NAME=
SMS_TEMPLATE_CODE=

# 对象存储 (阿里云 OSS)
OSS_ENDPOINT=
OSS_ACCESS_KEY_ID=
OSS_ACCESS_KEY_SECRET=
OSS_BUCKET_NAME=

# 地图服务 (高德地图)
AMAP_API_KEY=

# 支付配置
ALIPAY_APP_ID=
ALIPAY_PRIVATE_KEY=
WECHAT_APP_ID=
WECHAT_MCH_ID=
WECHAT_MINI_APPID=
WECHAT_MINI_SECRET=
```

**8. 前端配置**:
```bash
# Admin
VITE_API_URL=http://localhost:8080/api/v1

# Mobile
METRO_PORT=8081
```

### 6.5 Nginx 反向代理配置

**文件**: `deploy/nginx/nginx.conf` (65行)

#### 6.5.1 核心配置

```nginx
worker_processes  auto;  # 根据 CPU 核心数自动设置

events {
    worker_connections  1024;  # 每个进程最大连接数
}

http {
    # Gzip 压缩
    gzip  on;
    gzip_min_length 1k;
    gzip_comp_level 6;
    gzip_types text/plain application/javascript text/css application/json;

    # 后端负载均衡
    upstream backend {
        server api:8080;  # Docker 服务名
    }

    server {
        listen 8888;
        server_name localhost;

        # 前端 Web（预留，当前未构建）
        location / {
            root /usr/share/nginx/html/web;
            index index.html;
            try_files $uri $uri/ /index.html;  # SPA 路由
        }

        # Admin 管理后台
        location /admin/ {
            alias /usr/share/nginx/html/admin/;
            index index.html;
            try_files $uri $uri/ /admin/index.html;  # SPA 路由
        }

        # API 反向代理
        location /api/ {
            proxy_pass http://backend/api/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        }
    }
}
```

#### 6.5.2 路由规则

| 请求路径 | 后端处理 | 说明 |
|---------|---------|------|
| `/` | Nginx 静态文件 | 前端 Web（预留） |
| `/admin/` | Nginx 静态文件 | Admin 管理后台 |
| `/api/` | 反向代理 → api:8080 | 后端 API |

**SPA 路由处理**:
```nginx
try_files $uri $uri/ /admin/index.html;
```
- 先尝试文件 `$uri`
- 再尝试目录 `$uri/`
- 最后回退到 `index.html`（SPA 路由接管）

#### 6.5.3 反向代理 Header

```nginx
proxy_set_header Host $host;                      # 原始 Host
proxy_set_header X-Real-IP $remote_addr;          # 客户端真实 IP
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;  # 代理链
```

**用途**: 后端获取真实客户端 IP（日志、限流）

### 6.6 部署流程

#### 6.6.1 本地开发流程

**启动所有服务**:
```bash
docker-compose -f docker-compose.local.yml up -d
```

**查看日志**:
```bash
# 所有服务
docker-compose -f docker-compose.local.yml logs -f

# 指定服务
docker-compose -f docker-compose.local.yml logs -f api
```

**重新构建 API**:
```bash
docker-compose -f docker-compose.local.yml build --no-cache api
docker-compose -f docker-compose.local.yml up -d api
```

**停止服务**:
```bash
docker-compose -f docker-compose.local.yml down
```

**清理数据卷（⚠️ 删除数据库）**:
```bash
docker-compose -f docker-compose.local.yml down -v
```

#### 6.6.2 生产部署流程

**1. 准备环境变量**:
```bash
# 创建 .env 文件
cp .env.example .env

# 编辑敏感配置
vi .env
```

**必需配置**:
```bash
DB_PASSWORD=<strong_password>
REDIS_PASSWORD=<strong_password>
JWT_SECRET=$(openssl rand -base64 64)
ENCRYPTION_KEY=$(openssl rand -base64 32)
```

**2. 构建镜像**:
```bash
cd deploy
docker-compose -f docker-compose.prod.yml build
```

**3. 启动服务**:
```bash
docker-compose -f docker-compose.prod.yml up -d
```

**4. 验证部署**:
```bash
# 检查容器状态
docker-compose -f docker-compose.prod.yml ps

# 检查日志
docker-compose -f docker-compose.prod.yml logs api

# 测试 API
curl http://localhost:8888/api/v1/health
```

**5. 数据库迁移**:
```bash
# 进入 API 容器
docker exec -it prod_api sh

# 运行迁移脚本（手动）
# psql 连接数据库执行 SQL
```

### 6.7 安全配置考虑

#### 6.7.1 密码管理

**生产环境强制环境变量**:
```yaml
POSTGRES_PASSWORD: ${DB_PASSWORD:?DB_PASSWORD not set}
```
- 未设置时容器启动失败
- 避免硬编码密码

**密码强度要求**:
```bash
# 至少 16 字符，包含大小写字母、数字、特殊字符
DB_PASSWORD=$(openssl rand -base64 24)
```

#### 6.7.2 网络隔离

**本地开发环境**:
- 所有端口暴露到宿主机（方便调试）

**生产环境**:
- 仅 Nginx 暴露 80/443
- 数据库、Redis、API 内网通信
- 使用 Docker 内部网络（prod-net）

```yaml
# 生产环境不暴露数据库端口
db:
  # 无 ports 配置
  networks:
    - prod-net  # 仅内网
```

#### 6.7.3 日志管理

```nginx
access_log  /var/log/nginx/access.log  main;
error_log   /var/log/nginx/error.log notice;
```

**日志格式**:
```nginx
log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                '$status $body_bytes_sent "$http_referer" '
                '"$http_user_agent" "$http_x_forwarded_for"';
```

#### 6.7.4 HTTPS 配置（待补充）

**当前状态**: Nginx 暴露 443 端口，但未配置 SSL 证书

**生产部署建议**:
```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
}
```

### 6.8 部署架构亮点

1. **多阶段构建优化**:
   - 后端镜像从 450MB 压缩到 20MB（95% 减小）
   - 前端使用 Nginx Alpine（轻量化）

2. **开发体验**:
   - 热更新支持（Air + Vite HMR）
   - 一键启动 4 个服务
   - 端口映射方便调试

3. **配置管理**:
   - 环境变量优先级明确
   - 生产环境强制安全配置
   - 占位符机制（Viper）

4. **安全设计**:
   - 生产环境网络隔离
   - 密码强制环境变量
   - 数据卷持久化

5. **国内优化**:
   - Go 代理：goproxy.cn
   - npm 镜像：registry.npmmirror.com
   - 时区设置：Asia/Shanghai

### 6.9 未解问题清单

根据部署配置分析，以下问题需要进一步确认：
- ❓ 生产环境是否需要独立的测试环境（Staging）？
- ❓ HTTPS 证书管理方案（Let's Encrypt 自动续期？）
- ❓ 数据库备份策略（定时任务 + OSS 存储？）
- ❓ 日志收集方案（ELK Stack / 阿里云 SLS？）
- ❓ 监控告警方案（Prometheus + Grafana？）
- ❓ CI/CD 流程（GitHub Actions / Jenkins？）
- ❓ 云数据库 vs 自托管数据库的选择依据
- ❓ API 限流策略（Nginx limit_req / Go middleware？）

---

## 第8章：安全与权限机制

### 8.1 JWT 认证体系

#### 8.1.1 三分离认证策略

**设计理念**: 用户、管理员、商家使用不同的 Token 类型，避免权限混淆

| Token 类型 | 标识字段 | 有效期 | Claims | 中间件 |
|-----------|---------|--------|--------|--------|
| **User Token** | `userId`, `userType` | 8小时 | userId, userType | `JWT()` |
| **Admin Token** | `admin_id`, `token_type: "admin"` | 60分钟 | admin_id, username, is_super | `AdminJWT()` |
| **Merchant Token** | `providerId`, `role: "merchant"` | 8小时 | providerId, providerType, userId, phone | `MerchantJWT()` |

#### 8.1.2 JWT 中间件实现

**文件**: `server/internal/middleware/middleware.go` (252行)

**通用 JWT 中间件** (支持 User + Admin 混合):
```go
func JWT(secret string) gin.HandlerFunc {
    return func(c *gin.Context) {
        authHeader := c.GetHeader("Authorization")
        if authHeader == "" {
            response.Unauthorized(c, "请先登录")
            c.Abort()
            return
        }

        // 验证格式: Bearer <token>
        parts := strings.SplitN(authHeader, " ", 2)
        if len(parts) != 2 || parts[0] != "Bearer" {
            response.Unauthorized(c, "Token格式错误")
            c.Abort()
            return
        }

        // 解析 Token
        token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
            return []byte(secret), nil
        })

        if err != nil || !token.Valid {
            response.Unauthorized(c, "Token无效或已过期")
            c.Abort()
            return
        }

        claims, ok := token.Claims.(jwt.MapClaims)

        // 判断 Token 类型并存储上下文
        if adminID, ok := claims["admin_id"]; ok {
            // 管理员 Token
            c.Set("admin_id", uint64(adminID.(float64)))
            c.Set("username", claims["username"])
            c.Set("is_super", claims["is_super"])
        }
        if userID, ok := claims["userId"]; ok {
            // 普通用户 Token
            c.Set("userId", uint64(userID.(float64)))
            c.Set("userType", claims["userType"])
        }
        c.Next()
    }
}
```

**管理员专用中间件** (强制验证 token_type):
```go
func AdminJWT(secret string) gin.HandlerFunc {
    return func(c *gin.Context) {
        // ... Token 解析逻辑 ...

        claims, ok := token.Claims.(jwt.MapClaims)

        // ✅ 验证 token 类型（必须是 admin）
        tokenType, _ := claims["token_type"].(string)
        if tokenType != "admin" {
            response.Forbidden(c, "无权访问管理接口")
            c.Abort()
            return
        }

        // 存储管理员信息到上下文
        c.Set("admin_id", uint64(claims["admin_id"].(float64)))
        c.Set("username", claims["username"])
        c.Set("is_super", claims["is_super"])
        c.Next()
    }
}
```

**商家专用中间件**:
```go
func MerchantJWT(secret string) gin.HandlerFunc {
    return func(c *gin.Context) {
        // ... Token 解析逻辑 ...

        // 验证是商家 Token
        role, _ := claims["role"].(string)
        if role != "merchant" {
            response.Forbidden(c, "无权访问商家接口")
            c.Abort()
            return
        }

        // 存储商家信息到上下文
        c.Set("providerId", uint64(claims["providerId"].(float64)))
        c.Set("providerType", int8(claims["providerType"].(float64)))
        c.Set("userId", uint64(claims["userId"].(float64)))
        c.Set("phone", claims["phone"])
        c.Next()
    }
}
```

#### 8.1.3 Token 生成机制

**管理员 Token 生成** (`admin_auth_handler.go:97-109`):
```go
token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
    "admin_id":   admin.ID,
    "username":   admin.Username,
    "is_super":   admin.IsSuperAdmin,
    "exp":        time.Now().Add(60 * time.Minute).Unix(), // 60分钟过期
    "token_type": "admin",  // ✅ 类型标识
})

tokenString, err := token.SignedString([]byte(cfg.JWT.Secret))
```

**用户 Token 生成** (`user_service.go:230-240`):
```go
func generateToken(userID uint64, userType int8, expireHour int) (string, error) {
    token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
        "userId":   userID,
        "userType": userType,
        "exp":      time.Now().Add(time.Duration(expireHour) * time.Hour).Unix(),
    })
    return token.SignedString(jwtSecret)
}

// Access Token: 8小时
token, _ := generateToken(user.ID, user.UserType, cfg.ExpireHour)

// Refresh Token: 192小时（8天）
refreshToken, _ := generateToken(user.ID, user.UserType, cfg.ExpireHour*24)
```

**Token 响应结构**:
```go
type TokenResponse struct {
    Token        string `json:"token"`         // Access Token
    RefreshToken string `json:"refreshToken"`  // Refresh Token
    ExpiresIn    int64  `json:"expiresIn"`     // 过期时间（秒）
}
```

### 8.2 RBAC 权限体系

#### 8.2.1 权限模型

**三层权限结构**:
```
Admin (管理员) → Role (角色) → Menu (权限点)
    1              N             N

Permission 格式: "模块:操作:范围"
示例:
  - system:user:list    (用户列表)
  - system:user:create  (创建用户)
  - system:user:edit    (编辑用户)
  - system:user:delete  (删除用户)
  - *:*:*               (超级权限)
```

**数据库关系**:
```sql
sys_admins (管理员表)
    ↓ (多对多)
sys_admin_roles (管理员角色关联表)
    ↓
sys_roles (角色表)
    ↓ (多对多)
sys_role_menus (角色菜单关联表)
    ↓
sys_menus (菜单/权限表)
    - permission 字段存储权限标识
```

#### 8.2.2 权限检查中间件

**文件**: `middleware/middleware.go:173-221`

```go
func RequirePermission(permission string) gin.HandlerFunc {
    return func(c *gin.Context) {
        // 1. 获取管理员ID
        adminID, exists := c.Get("admin_id")
        if !exists {
            response.Unauthorized(c, "未登录")
            c.Abort()
            return
        }

        // 2. 超级管理员直接放行
        isSuperAdmin, _ := c.Get("is_super")
        if isSuperAdmin == true {
            c.Next()
            return
        }

        // 3. 查询管理员权限（预加载角色和菜单）
        var admin model.SysAdmin
        if err := repository.DB.Preload("Roles.Menus").First(&admin, adminID).Error; err != nil {
            response.Forbidden(c, "无权限")
            c.Abort()
            return
        }

        // 4. 检查是否有该权限
        hasPermission := false
        for _, role := range admin.Roles {
            for _, menu := range role.Menus {
                if menu.Permission == permission || menu.Permission == "*:*:*" {
                    hasPermission = true
                    break
                }
            }
            if hasPermission {
                break
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

**使用示例**:
```go
// 路由配置
adminRoutes.DELETE("/users/:id",
    middleware.RequirePermission("system:user:delete"),
    handler.DeleteUser)
```

#### 8.2.3 权限数据流

**登录时获取权限** (`admin_auth_handler.go:86-93`):
```go
// 1. 加载管理员角色
repository.DB.Preload("Roles").First(&admin, admin.ID)

// 2. 获取权限列表（扁平化）
permissions := getAdminPermissions(&admin)
// 返回: ["system:user:list", "system:user:create", ...]

// 3. 获取菜单树（前端动态渲染）
menus := getAdminMenuTree(&admin)
// 返回树形结构（目录 → 菜单 → 按钮）

// 4. 返回给前端
response.Success(c, gin.H{
    "token":       tokenString,
    "admin":       admin,
    "permissions": permissions,  // 前端权限检查
    "menus":       menus,         // 前端菜单渲染
})
```

**前端权限使用** (参考 Admin 第4章):
```typescript
// authStore 中存储
localStorage.setItem('admin_permissions', JSON.stringify(permissions))

// 按钮级权限检查
const hasPermission = (permission: string) => {
    if (admin.isSuperAdmin || permissions.includes('*:*:*')) {
        return true
    }
    return permissions.includes(permission)
}
```

### 8.3 敏感数据加密

#### 8.3.1 AES-256-GCM 加密实现

**文件**: `server/pkg/utils/crypto.go` (158行)

**初始化流程**:
```go
func InitCrypto() error {
    keyStr := os.Getenv("ENCRYPTION_KEY")
    if keyStr == "" {
        errMsg := fmt.Sprintf(
            "❌ 安全错误：ENCRYPTION_KEY 环境变量未设置！\n\n" +
            "敏感数据（身份证号、银行卡号）需要加密存储，必须设置32字节加密密钥。\n\n" +
            "生成密钥命令:\n" +
            "  Linux/macOS: openssl rand -base64 32\n" +
            "  Windows:     使用在线生成器或 Git Bash 执行上述命令\n\n" +
            "⚠️  服务器拒绝启动以保护数据安全。",
        )
        log.Fatal(errMsg)  // 🔒 强制退出
        return errors.New("ENCRYPTION_KEY not set")
    }

    key := []byte(keyStr)
    if len(key) != 32 {
        return fmt.Errorf("ENCRYPTION_KEY 长度必须为32字节，当前为 %d 字节", len(key))
    }

    defaultCrypto = &Crypto{key: key}
    log.Println("✅ 加密工具初始化成功 (AES-256-GCM)")
    return nil
}
```

**加密流程** (AES-256-GCM 模式):
```go
func (c *Crypto) Encrypt(plaintext string) (string, error) {
    if plaintext == "" {
        return "", nil
    }

    // 1. 创建 AES Cipher
    block, err := aes.NewCipher(c.key)  // 32字节密钥 → AES-256

    // 2. 使用 GCM 模式（Galois/Counter Mode）
    gcm, err := cipher.NewGCM(block)

    // 3. 生成随机 nonce（Number used ONCE）
    nonce := make([]byte, gcm.NonceSize())
    io.ReadFull(rand.Reader, nonce)

    // 4. 加密并附加 nonce
    ciphertext := gcm.Seal(nonce, nonce, []byte(plaintext), nil)

    // 5. Base64 编码（便于数据库存储）
    return base64.StdEncoding.EncodeToString(ciphertext), nil
}
```

**解密流程**:
```go
func (c *Crypto) Decrypt(ciphertext string) (string, error) {
    if ciphertext == "" {
        return "", nil
    }

    // 1. Base64 解码
    data, _ := base64.StdEncoding.DecodeString(ciphertext)

    // 2. 创建 GCM
    block, _ := aes.NewCipher(c.key)
    gcm, _ := cipher.NewGCM(block)

    // 3. 提取 nonce 和密文
    nonce, ciphertextBytes := data[:gcm.NonceSize()], data[gcm.NonceSize():]

    // 4. 解密
    plaintext, err := gcm.Open(nil, nonce, ciphertextBytes, nil)
    return string(plaintext), nil
}
```

**GCM 模式优势**:
- **认证加密** (Authenticated Encryption): 防止篡改
- **随机 nonce**: 每次加密结果不同（同一明文 → 不同密文）
- **NIST 推荐**: 符合美国国家标准

#### 8.3.2 敏感字段脱敏

**脱敏函数** (`crypto.go:132-157`):
```go
// 身份证号脱敏: 110101199003071234 => 1101**********1234
func MaskIDCard(idCard string) string {
    if len(idCard) < 10 {
        return idCard
    }
    return idCard[:4] + "**********" + idCard[len(idCard)-4:]
}

// 银行账号脱敏: 6222021234567890123 => 6222****0123
func MaskBankAccount(account string) string {
    if len(account) < 8 {
        return account
    }
    return account[:4] + "****" + account[len(account)-4:]
}

// 手机号脱敏: 13812345678 => 138****5678
func MaskPhone(phone string) string {
    if len(phone) < 7 {
        return phone
    }
    return phone[:3] + "****" + phone[len(phone)-4:]
}
```

**使用场景**:
- API 响应（返回给前端时脱敏）
- 审计日志（避免日志泄露敏感信息）
- 管理员查看（部分场景需要脱敏显示）

**加密字段示例**:
```go
// 商家银行账户保存
account.AccountNo = utils.Encrypt(req.AccountNo)     // 加密存储
account.IDCardNo = utils.Encrypt(req.IDCardNo)       // 加密存储
repository.DB.Create(&account)

// 查询时解密
accountNo, _ := utils.Decrypt(account.AccountNo)

// API 返回时脱敏
response.Success(c, gin.H{
    "accountNo": utils.MaskBankAccount(accountNo),    // 脱敏显示
    "idCardNo":  utils.MaskIDCard(idCardNo),
})
```

### 8.4 API 限流机制

#### 8.4.1 滑动窗口限流实现

**文件**: `middleware/rate_limit.go` (153行)

**核心数据结构**:
```go
type RateLimitConfig struct {
    MaxRequests   int           // 时间窗口内最大请求数
    WindowSize    time.Duration // 时间窗口大小
    CleanupPeriod time.Duration // 清理过期记录的周期
}

type rateLimiter struct {
    config   RateLimitConfig
    requests map[string][]time.Time  // clientID → 请求时间列表
    mu       sync.RWMutex            // 并发安全锁
}
```

**限流算法** (滑动窗口):
```go
func (rl *rateLimiter) allow(clientID string) bool {
    rl.mu.Lock()
    defer rl.mu.Unlock()

    now := time.Now()
    windowStart := now.Add(-rl.config.WindowSize)

    // 1. 获取该客户端的请求记录
    requests, exists := rl.requests[clientID]
    if !exists {
        rl.requests[clientID] = []time.Time{now}
        return true  // 首次请求直接放行
    }

    // 2. 过滤掉窗口外的请求（滑动窗口核心）
    var validRequests []time.Time
    for _, t := range requests {
        if t.After(windowStart) {
            validRequests = append(validRequests, t)
        }
    }

    // 3. 检查是否超过限制
    if len(validRequests) >= rl.config.MaxRequests {
        rl.requests[clientID] = validRequests
        return false  // 拒绝请求
    }

    // 4. 添加当前请求
    validRequests = append(validRequests, now)
    rl.requests[clientID] = validRequests
    return true
}
```

**中间件应用**:
```go
func RateLimit() gin.HandlerFunc {
    once.Do(initDefaultLimiter)
    return defaultLimiter.middleware()
}

func (rl *rateLimiter) middleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        clientIP := c.ClientIP()

        if !rl.allow(clientIP) {
            response.Error(c, 429, "请求过于频繁，请稍后再试")
            c.Abort()
            return
        }

        c.Next()
    }
}
```

#### 8.4.2 分级限流策略

**默认限流** (通用 API):
```go
initDefaultLimiter() {
    defaultLimiter = &rateLimiter{
        config: RateLimitConfig{
            MaxRequests:   100,               // 每分钟100次
            WindowSize:    time.Minute,
            CleanupPeriod: 5 * time.Minute,
        },
    }
}
```

**敏感操作限流** (提现、银行账户):
```go
func SensitiveRateLimit() gin.HandlerFunc {
    return RateLimitWithConfig(RateLimitConfig{
        MaxRequests:   10,  // 每分钟10次
        WindowSize:    time.Minute,
        CleanupPeriod: 5 * time.Minute,
    })
}
```

**登录限流** (防暴力破解):
```go
func LoginRateLimit() gin.HandlerFunc {
    return RateLimitWithConfig(RateLimitConfig{
        MaxRequests:   5,  // 每分钟5次
        WindowSize:    time.Minute,
        CleanupPeriod: 5 * time.Minute,
    })
}
```

#### 8.4.3 内存管理

**定期清理过期记录**:
```go
func (rl *rateLimiter) cleanup() {
    ticker := time.NewTicker(rl.config.CleanupPeriod)  // 每5分钟
    for range ticker.C {
        rl.mu.Lock()
        now := time.Now()
        windowStart := now.Add(-rl.config.WindowSize)

        for clientID, requests := range rl.requests {
            var validRequests []time.Time
            for _, t := range requests {
                if t.After(windowStart) {
                    validRequests = append(validRequests, t)
                }
            }
            if len(validRequests) == 0 {
                delete(rl.requests, clientID)  // 删除无效记录
            } else {
                rl.requests[clientID] = validRequests
            }
        }
        rl.mu.Unlock()
    }
}
```

### 8.5 登录安全防护

#### 8.5.1 管理员登录失败锁定

**文件**: `admin_auth_handler.go:33-74`

**Redis 记录失败次数**:
```go
func AdminLogin(c *gin.Context) {
    // 1. 检查失败次数
    failKey := fmt.Sprintf("admin_login_fail:%s", req.Username)
    failCountStr, _ := repository.RedisClient.Get(repository.Ctx, failKey).Result()
    failCount := 0
    if failCountStr != "" {
        fmt.Sscanf(failCountStr, "%d", &failCount)
    }

    // 2. 失败5次锁定30分钟
    if failCount >= 5 {
        response.Forbidden(c, "登录失败次数过多，请30分钟后重试")
        return
    }

    // 3. 验证失败 → 记录失败
    if err := bcrypt.CompareHashAndPassword([]byte(admin.Password), []byte(req.Password)); err != nil {
        repository.RedisClient.Incr(repository.Ctx, failKey)
        repository.RedisClient.Expire(repository.Ctx, failKey, 30*time.Minute)
        response.Unauthorized(c, "用户名或密码错误")
        return
    }

    // 4. 登录成功 → 清除失败记录
    repository.RedisClient.Del(repository.Ctx, failKey)
}
```

#### 8.5.2 用户登录失败锁定

**文件**: `user_service.go:186-201`

**数据库字段**:
```go
type User struct {
    LoginFailedCount  int        // 登录失败次数
    LastFailedLoginAt *time.Time // 最后失败时间
    LockedUntil       *time.Time // 锁定截止时间
}
```

**锁定逻辑**:
```go
func (s *UserService) Login(req *LoginRequest) {
    // 1. 检查账号是否被锁定
    if user.LockedUntil != nil && time.Now().Before(*user.LockedUntil) {
        remainingMinutes := int(time.Until(*user.LockedUntil).Minutes())
        return fmt.Errorf("账号已被锁定，请在 %d 分钟后重试", remainingMinutes)
    }

    // 2. 如果锁定时间已过，重置失败次数
    if user.LockedUntil != nil && time.Now().After(*user.LockedUntil) {
        user.LoginFailedCount = 0
        user.LockedUntil = nil
        user.LastFailedLoginAt = nil
        repository.DB.Model(&user).Updates(map[string]interface{}{
            "login_failed_count":   0,
            "locked_until":         nil,
            "last_failed_login_at": nil,
        })
    }

    // 3. 密码错误 → 记录失败
    if !CheckPassword(req.Password, user.Password) {
        return s.handleLoginFailure(&user, "password")
    }

    // 4. 登录成功 → 重置失败次数
    if user.LoginFailedCount > 0 {
        repository.DB.Model(&user).Updates(map[string]interface{}{
            "login_failed_count":   0,
            "last_failed_login_at": nil,
        })
    }
}
```

**失败处理逻辑** (推测):
```go
func (s *UserService) handleLoginFailure(user *model.User, reason string) error {
    user.LoginFailedCount++
    user.LastFailedLoginAt = time.Now()

    // 失败3次锁定30分钟
    if user.LoginFailedCount >= 3 {
        lockedUntil := time.Now().Add(30 * time.Minute)
        user.LockedUntil = &lockedUntil
    }

    repository.DB.Model(user).Updates(map[string]interface{}{
        "login_failed_count":   user.LoginFailedCount,
        "last_failed_login_at": user.LastFailedLoginAt,
        "locked_until":         user.LockedUntil,
    })

    return errors.New("手机号或密码错误")
}
```

### 8.6 审计日志系统

#### 8.6.1 审计日志中间件

**文件**: `middleware/audit_logger.go` (156行)

**核心功能**:
```go
func AuditLogger() gin.HandlerFunc {
    return func(c *gin.Context) {
        // 1. 只记录敏感操作（POST/PUT/DELETE）
        if c.Request.Method == "GET" {
            c.Next()
            return
        }

        // 2. 检查是否是需要审计的路径
        path := c.Request.URL.Path
        if !shouldAudit(path) {
            c.Next()
            return
        }

        // 3. 记录请求开始时间
        startTime := time.Now()

        // 4. 读取请求体（脱敏敏感字段）
        bodyBytes, _ := io.ReadAll(c.Request.Body)
        requestBody := string(bodyBytes)
        requestBody = maskSensitiveFields(requestBody)  // 脱敏
        c.Request.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))

        // 5. 处理请求
        c.Next()

        // 6. 异步保存审计日志
        go saveAuditLog(c, path, requestBody, startTime)
    }
}
```

**审计路径配置**:
```go
func shouldAudit(path string) bool {
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
```

**敏感字段脱敏**:
```go
func maskSensitiveFields(body string) string {
    var data map[string]interface{}
    json.Unmarshal([]byte(body), &data)

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
```

#### 8.6.2 审计日志数据模型

**AuditLog 模型** (推测):
```go
type AuditLog struct {
    ID           uint64    `gorm:"primaryKey"`
    OperatorType string    `gorm:"type:varchar(20)"` // admin/merchant/user/anonymous
    OperatorID   uint64    // 操作者ID
    Action       string    `gorm:"type:varchar(200)"` // POST /api/v1/merchant/withdraw
    Resource     string    `gorm:"type:varchar(100)"` // withdraw
    RequestBody  string    `gorm:"type:text"`         // 请求体（脱敏）
    ClientIP     string    `gorm:"type:varchar(45)"`
    UserAgent    string    `gorm:"type:varchar(500)"`
    StatusCode   int       // HTTP 状态码
    Duration     int64     // 请求耗时（毫秒）
    CreatedAt    time.Time
}
```

**保存逻辑**:
```go
func saveAuditLog(c *gin.Context, path, requestBody string, startTime time.Time) {
    // 确定操作者类型
    var operatorType string
    var operatorID uint64
    if adminID := c.GetUint64("adminId"); adminID > 0 {
        operatorType = "admin"
        operatorID = adminID
    } else if providerID := c.GetUint64("providerId"); providerID > 0 {
        operatorType = "merchant"
        operatorID = providerID
    } else if userID := c.GetUint64("userId"); userID > 0 {
        operatorType = "user"
        operatorID = userID
    } else {
        operatorType = "anonymous"
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
```

### 8.7 安全 Headers

#### 8.7.1 SecurityHeaders 中间件

**文件**: `middleware/security.go` (44行)

```go
func SecurityHeaders() gin.HandlerFunc {
    return func(c *gin.Context) {
        // 1. 防止 MIME 类型嗅探
        c.Header("X-Content-Type-Options", "nosniff")

        // 2. 防止点击劫持攻击
        c.Header("X-Frame-Options", "DENY")

        // 3. 启用浏览器 XSS 防护
        c.Header("X-XSS-Protection", "1; mode=block")

        // 4. Referrer 策略：仅在同源时发送完整 URL
        c.Header("Referrer-Policy", "strict-origin-when-cross-origin")

        // 5. 权限策略：禁用不必要的浏览器功能
        c.Header("Permissions-Policy", "geolocation=(), microphone=(), camera=()")

        // 6. 内容安全策略 (CSP)
        csp := "default-src 'self'; " +
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +  // React 需要
            "style-src 'self' 'unsafe-inline'; " +                 // CSS-in-JS 需要
            "img-src 'self' data: https:; " +
            "font-src 'self' data:; " +
            "connect-src 'self'; " +
            "frame-ancestors 'none'"
        c.Header("Content-Security-Policy", csp)

        // 7. HSTS (仅 HTTPS 环境启用，建议在 Nginx 配置)
        // if cfg.Server.Mode == "release" {
        //     c.Header("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload")
        // }

        c.Next()
    }
}
```

### 8.8 CORS 白名单策略

**文件**: `middleware/middleware.go:16-50`

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

        // 只对白名单中的 Origin 设置响应头
        if allowed {
            c.Header("Access-Control-Allow-Origin", origin)
            c.Header("Access-Control-Allow-Credentials", "true")
        }

        c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH")
        c.Header("Access-Control-Allow-Headers", "Origin, Content-Type, Authorization, X-CSRF-Token")
        c.Header("Access-Control-Max-Age", "86400")

        // OPTIONS 预检请求
        if c.Request.Method == "OPTIONS" {
            c.AbortWithStatus(http.StatusNoContent)
            return
        }

        // 非白名单 Origin 拒绝请求
        if !allowed && origin != "" {
            c.AbortWithStatus(http.StatusForbidden)
            return
        }

        c.Next()
    }
}
```

**配置示例** (推测):
```go
allowedOrigins := []string{
    "http://localhost:5173",       // Admin 开发环境
    "http://localhost:3000",       // 其他前端
    "https://admin.yourdomain.com", // 生产环境
}
router.Use(middleware.Cors(allowedOrigins))
```

### 8.9 密码安全

**bcrypt 哈希存储**:
```go
import "golang.org/x/crypto/bcrypt"

// 密码哈希
func HashPassword(password string) (string, error) {
    hashedPwd, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
    return string(hashedPwd), err
}

// 密码验证
func CheckPassword(password, hashedPassword string) bool {
    err := bcrypt.CompareHashAndPassword([]byte(hashedPassword), []byte(password))
    return err == nil
}
```

**密码强度验证** (`user_service.go` 推测):
```go
func validatePassword(password string) error {
    if len(password) < 6 {
        return errors.New("密码长度至少6位")
    }
    // 可扩展：大小写字母 + 数字 + 特殊字符
    return nil
}
```

### 8.10 安全机制亮点

1. **JWT 三分离设计**:
   - User/Admin/Merchant 独立 Token 类型
   - `token_type` 和 `role` 字段强制验证
   - 防止权限混淆和越权访问

2. **AES-256-GCM 加密**:
   - 认证加密模式（防篡改）
   - 随机 nonce（同一明文不同密文）
   - 环境变量强制设置（未设置拒绝启动）

3. **多层限流策略**:
   - 通用 API: 100次/分钟
   - 敏感操作: 10次/分钟
   - 登录接口: 5次/分钟

4. **登录失败锁定**:
   - 管理员: Redis 计数，5次锁定30分钟
   - 用户: 数据库持久化，3次锁定30分钟

5. **审计日志**:
   - 敏感操作全记录
   - 请求体自动脱敏
   - 异步保存（不阻塞请求）

6. **安全 Headers**:
   - XSS 防护
   - 点击劫持防护
   - CSP 内容安全策略

7. **CORS 白名单**:
   - 仅允许配置的 Origin
   - 支持 Credentials
   - 非白名单 403 拒绝

### 8.11 未解问题清单

根据安全机制分析，以下问题需要进一步确认：
- ❓ Token Refresh 机制的完整实现（Mobile 端已实现，后端呢？）
- ❓ CSRF Token 验证机制（Headers 包含 X-CSRF-Token，但未见实现）
- ❓ HSTS 生产环境是否启用？
- ❓ SQL 注入防护（GORM 预编译查询）
- ❓ 文件上传安全（文件类型、大小、病毒扫描）
- ❓ 验证码服务集成（当前硬编码 123456）
- ❓ 双因素认证（2FA）是否需要？
- ❓ IP 白名单/黑名单机制

---

## 第9章：测试与质量保障

### 9.1 测试策略概览

#### 9.1.1 测试体系架构

项目采用**多层次测试策略**，覆盖从配置安全到业务流程的完整测试链：

```
┌─────────────────────────────────────────────────────────┐
│                   测试金字塔                              │
├─────────────────────────────────────────────────────────┤
│  E2E 业务流程测试                                        │
│  - 项目流程测试（预约 → 支付 → 托管 → 完工）              │
│  - 托管账户测试（充值 → 释放 → 结算）                     │
│  - 登录验证测试（验证码、限流）                           │
├─────────────────────────────────────────────────────────┤
│  安全测试自动化                                          │
│  - 配置文件安全性（无硬编码密码）                          │
│  - 环境变量验证（JWT_SECRET, ENCRYPTION_KEY）             │
│  - 源代码修复验证（debug endpoint, rate limit, headers）  │
│  - 功能安全测试（限流、安全响应头）                        │
├─────────────────────────────────────────────────────────┤
│  测试数据管理                                            │
│  - 种子数据生成（9用户 + 4服务商 + 3项目 + 18里程碑）      │
│  - 数据隔离策略（TEST_PREFIX 标记）                       │
│  - 清理脚本（按依赖关系逆序删除）                          │
├─────────────────────────────────────────────────────────┤
│  前端测试                                                │
│  - React Native 基础渲染测试                             │
│  - （后续扩展：组件测试、快照测试）                        │
└─────────────────────────────────────────────────────────┘
```

#### 9.1.2 测试脚本统计

| 类别 | 脚本文件 | 行数 | 平台 | 测试类型 |
|------|---------|------|------|---------|
| **安全测试** | test_security.ps1 | 150 | Windows | 自动化测试 |
| **安全测试** | test_security.sh | 233 | Linux/macOS | 自动化测试 |
| **流程测试** | test_project_flow.ps1 | 55 | Windows | E2E 测试 |
| **流程测试** | test_escrow_flow.ps1 | 58 | Windows | E2E 测试 |
| **验证测试** | test_login_verification.ps1 | 39 | Windows | 负面测试 |
| **数据管理** | server/scripts/seed_test_data.go | 279 | Go | 测试数据生成 |
| **数据管理** | server/scripts/clean_test_data.go | 96 | Go | 测试数据清理 |
| **前端测试** | mobile/__tests__/App.test.tsx | 14 | React Native | 单元测试 |
| **总计** | 8个脚本 | 924行 | 跨平台 | 多维度覆盖 |

#### 9.1.3 测试执行环境

```yaml
测试环境:
  本地开发环境:
    - Docker Compose (db + redis + api)
    - 服务地址: http://localhost:8080/api/v1
    - 测试账号: 13900001001 (业主), 13900002001 (设计师)
    - 测试数据: seed_test_data.go 一键生成

  CI/CD环境:
    - （待补充）GitHub Actions 自动化测试
    - （待补充）代码覆盖率报告

测试工具:
  PowerShell:
    - Invoke-RestMethod (API 测试)
    - Select-String (配置验证)
    - 自定义测试框架（Test-Case, Pass, Fail）

  Bash:
    - curl (API 测试)
    - grep (配置验证)
    - 颜色输出（GREEN, RED, YELLOW）

  Go:
    - GORM (数据库操作)
    - 事务控制（seed/clean 原子性）

  React Native:
    - react-test-renderer (组件渲染测试)
```

### 9.2 安全测试自动化

#### 9.2.1 test_security.ps1/sh 脚本分析

**文件**:
- `test_security.ps1` (150行) - Windows PowerShell
- `test_security.sh` (233行) - Linux/macOS Bash

**设计理念**:
- 双平台支持（Windows + Unix），功能完全一致
- 自动化验证所有 P0/P1 级别的安全修复
- 非侵入式测试（只读检查 + API 功能测试）

#### 9.2.2 测试步骤详解

**Step 1: 检查配置文件安全性**

| 测试项 | 检查逻辑 | 通过条件 | 失败后果 |
|--------|---------|---------|---------|
| config.yaml 无硬编码密码 | 检查是否包含 `password.*123456` | 不包含 | P0 安全问题 |
| config.yaml 使用环境变量 | 检查是否包含 `${DATABASE_PASSWORD}` | 包含 | 配置错误 |
| .env.example 无真实密钥 | 检查是否包含真实 JWT 密钥 | 不包含 | 密钥泄露风险 |

**PowerShell 实现**:
```powershell
Test-Case "Check config.yaml no hardcoded password"
if (-not (Select-String -Path "server\config.yaml" -Pattern "password.*123456" -Quiet)) {
    Pass "config.yaml no hardcoded password"
} else {
    Fail "config.yaml contains hardcoded password"
}
```

**Bash 实现**:
```bash
test_case "检查 config.yaml 无硬编码密码"
if ! grep -q "password.*123456" server/config.yaml 2>/dev/null; then
    pass "config.yaml 无硬编码密码 123456"
else
    fail "config.yaml 仍包含硬编码密码"
fi
```

**Step 2: 检查环境变量配置**

| 测试项 | 检查逻辑 | 通过条件 | 安全要求 |
|--------|---------|---------|---------|
| .env 文件存在 | 检查文件路径 | 文件存在 | 必需 |
| JWT_SECRET 已设置 | 检查 `^JWT_SECRET=` 且不含 "REPLACE" | 已配置 | 至少64字符 |
| ENCRYPTION_KEY 已设置 | 检查 `^ENCRYPTION_KEY=` 且不含 "REPLACE" | 已配置 | 必须32字节 |

**PowerShell 实现**:
```powershell
Test-Case "Check .env file exists"
if (Test-Path "server\.env") {
    Pass "server\.env file exists"

    Test-Case "Check JWT_SECRET is set"
    $jwtLine = Select-String -Path "server\.env" -Pattern "^JWT_SECRET=" | Select-Object -First 1
    if ($jwtLine -and $jwtLine.Line -notmatch "REPLACE") {
        Pass "JWT_SECRET is configured"
    } else {
        Fail "JWT_SECRET not configured"
    }
} else {
    Fail "server\.env file does not exist"
}
```

**Step 3: 检查源代码修复**

| 测试项 | 检查文件 | 检查模式 | 验证内容 |
|--------|---------|---------|---------|
| 调试端点保护 | router.go | `cfg.Server.Mode != "release"` | 生产环境禁用 /debug/* |
| 登录限流 | router.go | `LoginRateLimit` | 5次/分钟限流 |
| 安全响应头中间件 | security.go | 文件存在 | 中间件已创建 |
| 加密密钥验证 | crypto.go | `log.Fatal.*ENCRYPTION_KEY` | 未设置强制退出 |

**检查示例**:
```powershell
Test-Case "Check debug endpoint protection"
if (Select-String -Path "server\internal\router\router.go" -Pattern 'cfg.Server.Mode != "release"' -Quiet) {
    Pass "Debug endpoint protection added"
} else {
    Fail "Debug endpoint protection missing"
}
```

**Step 4: API 服务测试（仅当服务运行时）**

| 测试项 | 测试方法 | 预期结果 | 验证要点 |
|--------|---------|---------|---------|
| 健康检查接口 | `GET /api/v1/health` | 返回 "ok" | 服务正常运行 |
| 安全响应头 | 检查 HTTP Headers | 包含 `X-Frame-Options` | 安全头已启用 |
| 登录限流（Bash 特有） | 连续6次登录请求 | 第6次返回 429 | 限流正常工作 |
| 调试端点保护（Bash 特有） | `GET /debug/fix-data` | 返回 404 或 401 | 端点已保护 |

**Bash 登录限流测试**:
```bash
test_case "测试登录限流（连续6次请求）"
LIMIT_TEST=0
for i in {1..6}; do
    RESPONSE=$(curl -s -w "%{http_code}" -X POST http://localhost:8080/api/v1/auth/login \
        -H "Content-Type: application/json" \
        -d '{"phone":"13800138000","code":"123456"}' -o /dev/null)
    if [ $i -eq 6 ] && [ "$RESPONSE" -eq 429 ]; then
        LIMIT_TEST=1
    fi
done
if [ $LIMIT_TEST -eq 1 ]; then
    pass "登录限流正常（第6次请求返回429）"
else
    fail "登录限流未生效"
fi
```

#### 9.2.3 测试覆盖清单

**安全修复验证**:
```
✅ P0-001: config.yaml 密码硬编码 → 已修复（使用环境变量）
✅ P0-002: 调试端点暴露 → 已修复（release 模式禁用）
✅ P0-003: JWT 密钥泄露 → 已修复（.env.example 无真实密钥）
✅ P1-001: 登录限流缺失 → 已修复（5次/分钟）
✅ P1-002: 安全响应头缺失 → 已修复（X-Frame-Options, CSP 等）
✅ P1-003: 加密密钥默认值 → 已修复（强制环境变量）
```

**测试结果示例**:
```
================================
Test Results Summary
================================
Total Tests: 12
Passed: 12
Failed: 0

Congratulations! All tests passed!

Services running:
  - API: http://localhost:8080/api/v1/health
  - Admin: http://localhost:5173
```

### 9.3 业务流程测试

#### 9.3.1 项目流程测试（test_project_flow.ps1）

**文件**: `test_project_flow.ps1` (55行)

**测试场景**: E2E 项目管理流程

**测试步骤**:
```
1. 登录获取 Token
   POST /api/v1/auth/login
   Body: { phone: "13800138001", code: "123456" }
   ↓
2. 创建项目
   POST /api/v1/projects
   Headers: Authorization: Bearer {token}
   Body: {
     name: "我的新家装修",
     address: "北京市朝阳区xx小区1号楼",
     providerId: 1,
     area: 120,
     budget: 500000,
     startDate: "2025-01-01",
     expectedEnd: "2025-06-01"
   }
   ↓
3. 查询项目列表
   GET /api/v1/projects?page=1&pageSize=10
   ↓
4. 查询项目详情
   GET /api/v1/projects/{projectId}
   ↓
验证: 创建的项目是否正确返回
```

**核心代码**:
```powershell
# 登录
$loginBody = @{
    phone = "13800138001"
    code = "123456"
} | ConvertTo-Json
$loginResp = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -ContentType "application/json" -Body $loginBody
$token = $loginResp.data.token

# 创建项目
$headers = @{ Authorization = "Bearer $token" }
$projectBody = @{
    name = "我的新家装修"
    address = "北京市朝阳区xx小区1号楼"
    providerId = 1
    area = 120
    budget = 500000
    startDate = "2025-01-01"
    expectedEnd = "2025-06-01"
} | ConvertTo-Json
$createResp = Invoke-RestMethod -Uri "$baseUrl/projects" -Method Post -Headers $headers -ContentType "application/json" -Body $projectBody

Write-Host "Project Created: $($createResp.data.name), ID: $($createResp.data.id)" -ForegroundColor Green
```

**验证点**:
- ✅ JWT Token 认证正常
- ✅ 项目创建成功
- ✅ 项目列表查询正常
- ✅ 项目详情查询正常

#### 9.3.2 托管流程测试（test_escrow_flow.ps1）

**文件**: `test_escrow_flow.ps1` (58行)

**测试场景**: 托管账户充值和释放流程

**测试步骤**:
```
1. 登录
   POST /api/v1/auth/login
   ↓
2. 获取托管账户详情
   GET /api/v1/projects/{projectId}/escrow
   验证: TotalAmount, FrozenAmount, ReleasedAmount
   ↓
3. 存入资金（充值 50000元到里程碑1）
   POST /api/v1/projects/{projectId}/deposit
   Body: { amount: 50000, milestoneId: 1 }
   ↓
4. 再次查询托管账户
   验证: FrozenAmount 增加 50000
   ↓
5. 尝试释放资金（预期失败）
   POST /api/v1/projects/{projectId}/release
   Body: { milestoneId: 1 }
   预期: 失败（里程碑未通过验收）
```

**核心代码**:
```powershell
# 获取托管详情
$escrow = Invoke-RestMethod -Uri "$baseUrl/projects/$projectId/escrow" -Method Get -Headers $headers
Write-Host "Escrow Before: Total=$($escrow.data.totalAmount), Frozen=$($escrow.data.frozenAmount)"

# 存入资金
$depositBody = @{
    amount      = 50000
    milestoneId = 1
} | ConvertTo-Json
$depResp = Invoke-RestMethod -Uri "$baseUrl/projects/$projectId/deposit" -Method Post -Headers $headers -ContentType "application/json" -Body $depositBody
Write-Host "Deposit SUCCESS: 50000 yuan" -ForegroundColor Green

# 再次查询
$escrow2 = Invoke-RestMethod -Uri "$baseUrl/projects/$projectId/escrow" -Method Get -Headers $headers
Write-Host "Escrow After: Total=$($escrow2.data.totalAmount), Frozen=$($escrow2.data.frozenAmount)"

# 尝试释放（预期失败）
$releaseBody = @{ milestoneId = 1 } | ConvertTo-Json
try {
    $relResp = Invoke-RestMethod -Uri "$baseUrl/projects/$projectId/release" -Method Post -Headers $headers -ContentType "application/json" -Body $releaseBody
    Write-Host "Release UNEXPECTED SUCCESS (milestone not verified)" -ForegroundColor Red
} catch {
    Write-Host "Release Failed (Expected): Milestone not passed" -ForegroundColor Green
}
```

**验证点**:
- ✅ 托管账户查询正常
- ✅ 充值功能正常（FrozenAmount 增加）
- ✅ 资金释放受验收状态控制（未验收拒绝释放）

#### 9.3.3 登录验证测试（test_login_verification.ps1）

**文件**: `test_login_verification.ps1` (39行)

**测试场景**: 负面测试 - 错误验证码拒绝登录

**测试逻辑**:
```
输入错误验证码（111111）
   ↓
POST /api/v1/auth/login
Body: { phone: "13800138000", code: "111111", type: "code" }
   ↓
预期结果: 返回 400/401 错误
   ↓
验证: 后端正确拒绝了错误验证码
```

**核心代码**:
```powershell
$body = @{
    "phone" = "13800138000"
    "code"  = "111111"  # 错误的验证码
    "type"  = "code"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri $url -Method Post -Headers $headers -Body $body -ErrorAction Stop
    Write-Host "Login SUCCESS (FAILURE! Backend did NOT block wrong code)" -ForegroundColor Red
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    if ($statusCode -eq 400 -or $statusCode -eq 401) {
        Write-Host "Login Refused (SUCCESS)" -ForegroundColor Green
        Write-Host "  Status Code: $statusCode"
        Write-Host "  Backend correctly rejected the invalid verification code."
    } else {
        Write-Host "Unexpected Error: $statusCode" -ForegroundColor Yellow
    }
}
```

**验证点**:
- ✅ 错误验证码被拒绝（400/401 错误）
- ✅ 安全验证机制正常工作

### 9.4 测试数据管理

#### 9.4.1 测试数据种子（seed_test_data.go）

**文件**: `server/scripts/seed_test_data.go` (279行)

**数据结构设计**:

```
测试数据集 (TEST_PREFIX = "[TEST]")
├── 9个测试用户
│   ├── 3个业主 (UserType=1)
│   │   ├── 13900001001 - [TEST]业主张三
│   │   ├── 13900001002 - [TEST]业主李四
│   │   └── 13900001003 - [TEST]业主王五
│   ├── 4个服务商 (UserType=2)
│   │   ├── 13900002001 - [TEST]设计师小王
│   │   ├── 13900002002 - [TEST]设计师小李
│   │   ├── 13900002003 - [TEST]公司经理老张
│   │   └── 13900002004 - [TEST]工长小刘
│   └── 2个工人 (UserType=3)
│       ├── 13900003001 - [TEST]水电工小赵
│       └── 13900003002 - [TEST]木工小钱
│
├── 4个测试服务商 (Providers)
│   ├── 2个设计师 (ProviderType=1)
│   ├── 1个装修公司 (ProviderType=2)
│   └── 1个工长 (ProviderType=3)
│
├── 2个测试工人 (Workers)
│   ├── 水电工 (WorkType="水电")
│   └── 木工 (WorkType="木工")
│
├── 3个测试项目 (Projects)
│   ├── 项目1: [TEST]西溪诚园 A栋1201 (Status=1, 进行中)
│   ├── 项目2: [TEST]滨江区江南里 B栋302 (Status=0, 待开工)
│   └── 项目3: [TEST]萧山区恒大帝景 C栋1501 (Status=2, 已完工)
│
├── 18个里程碑 (Milestones, 每个项目6个)
│   ├── 设计定稿 (10%)
│   ├── 水电验收 (20%)
│   ├── 泥木验收 (25%)
│   ├── 油漆验收 (20%)
│   ├── 安装验收 (15%)
│   └── 竣工验收 (10%)
│
├── 3个托管账户 (EscrowAccounts)
│   └── 项目1托管: 已充值30%预算
│
└── 5条施工日志 (WorkLogs)
    └── 项目1日志（水电工、木工的施工记录）
```

**核心代码片段**:
```go
const TEST_PREFIX = "[TEST]"

// 创建测试用户
testUsers := []model.User{
    // 业主
    {Phone: "13900001001", Nickname: TEST_PREFIX + "业主张三", UserType: 1, Status: 1},
    {Phone: "13900001002", Nickname: TEST_PREFIX + "业主李四", UserType: 1, Status: 1},
    {Phone: "13900001003", Nickname: TEST_PREFIX + "业主王五", UserType: 1, Status: 1},
    // 服务商
    {Phone: "13900002001", Nickname: TEST_PREFIX + "设计师小王", UserType: 2, Status: 1},
    {Phone: "13900002002", Nickname: TEST_PREFIX + "设计师小李", UserType: 2, Status: 1},
    {Phone: "13900002003", Nickname: TEST_PREFIX + "公司经理老张", UserType: 2, Status: 1},
    {Phone: "13900002004", Nickname: TEST_PREFIX + "工长小刘", UserType: 2, Status: 1},
    // 工人
    {Phone: "13900003001", Nickname: TEST_PREFIX + "水电工小赵", UserType: 3, Status: 1},
    {Phone: "13900003002", Nickname: TEST_PREFIX + "木工小钱", UserType: 3, Status: 1},
}

// 批量创建
result := db.Create(&testUsers)
fmt.Printf("✅ 创建 %d 个测试用户\n", result.RowsAffected)

// 创建里程碑模板
milestoneTemplates := []struct {
    Name       string
    Seq        int8
    Percentage float32
}{
    {"设计定稿", 1, 10},
    {"水电验收", 2, 20},
    {"泥木验收", 3, 25},
    {"油漆验收", 4, 20},
    {"安装验收", 5, 15},
    {"竣工验收", 6, 10},
}

// 为每个项目创建里程碑
for _, proj := range testProjects {
    for _, tpl := range milestoneTemplates {
        milestone := model.Milestone{
            ProjectID:   proj.ID,
            Name:        tpl.Name,
            Seq:         tpl.Seq,
            Percentage:  tpl.Percentage,
            Amount:      proj.Budget * float64(tpl.Percentage) / 100,
            Status:      0, // 待验收
        }
        db.Create(&milestone)
    }
}
```

**数据特点**:
1. **真实场景**: 3个不同状态的项目（进行中、待开工、已完工）
2. **完整链路**: 用户 → 服务商 → 项目 → 里程碑 → 托管账户 → 施工日志
3. **数据隔离**: 所有测试数据都有 `[TEST]` 前缀，方便识别和清理

#### 9.4.2 测试数据清理（clean_test_data.go）

**文件**: `server/scripts/clean_test_data.go` (96行)

**清理策略**: 按外键依赖的反向顺序删除

**删除顺序**:
```
1. 施工日志 (WorkLogs)
   WHERE description LIKE '%[TEST]%'
   ↓
2. 交易记录 (Transactions)
   WHERE escrow_id IN (测试托管账户ID)
   ↓
3. 托管账户 (EscrowAccounts)
   WHERE project_id IN (测试项目ID)
   ↓
4. 里程碑 (Milestones)
   WHERE project_id IN (测试项目ID)
   ↓
5. 项目 (Projects)
   WHERE name LIKE '[TEST]%'
   ↓
6. 工人 (Workers)
   WHERE user_id IN (测试用户ID)
   ↓
7. 服务商 (Providers)
   WHERE company_name LIKE '[TEST]%'
   ↓
8. 用户 (Users)
   WHERE nickname LIKE '[TEST]%'
```

**核心代码**:
```go
const TEST_PREFIX = "[TEST]"

func CleanTestData() error {
    // 按外键依赖的反向顺序删除

    // 1. 删除施工日志
    result := db.Where("description LIKE ?", "%"+TEST_PREFIX+"%").Delete(&model.WorkLog{})
    fmt.Printf("🗑️ 删除 %d 条施工日志\n", result.RowsAffected)

    // 2. 获取测试项目ID
    var testProjects []model.Project
    db.Where("name LIKE ?", TEST_PREFIX+"%").Find(&testProjects)
    projectIDs := make([]uint64, len(testProjects))
    for i, p := range testProjects {
        projectIDs[i] = p.ID
    }

    if len(projectIDs) > 0 {
        // 3. 删除托管账户的交易记录
        var escrowIDs []uint64
        db.Model(&model.EscrowAccount{}).
            Where("project_id IN ?", projectIDs).
            Pluck("id", &escrowIDs)

        if len(escrowIDs) > 0 {
            result = db.Where("escrow_id IN ?", escrowIDs).Delete(&model.Transaction{})
            fmt.Printf("🗑️ 删除 %d 条交易记录\n", result.RowsAffected)
        }

        // 4. 删除托管账户
        result = db.Where("project_id IN ?", projectIDs).Delete(&model.EscrowAccount{})
        fmt.Printf("🗑️ 删除 %d 个托管账户\n", result.RowsAffected)

        // 5. 删除里程碑
        result = db.Where("project_id IN ?", projectIDs).Delete(&model.Milestone{})
        fmt.Printf("🗑️ 删除 %d 个里程碑\n", result.RowsAffected)
    }

    // 6. 删除项目
    result = db.Where("name LIKE ?", TEST_PREFIX+"%").Delete(&model.Project{})
    fmt.Printf("🗑️ 删除 %d 个项目\n", result.RowsAffected)

    // 7-8. 删除工人、服务商、用户（同理）
    // ...

    fmt.Println("✅ 测试数据清理完成")
    return nil
}
```

**安全保障**:
- ✅ 仅删除带 `[TEST]` 前缀的数据
- ✅ 按依赖关系逆序删除（避免外键约束错误）
- ✅ 打印删除数量（便于确认）

#### 9.4.3 数据隔离策略

**TEST_PREFIX 标记机制**:

| 表 | 标记字段 | 标记值 | 识别模式 |
|----|---------|-------|---------|
| users | nickname | `[TEST]业主张三` | `LIKE '[TEST]%'` |
| providers | company_name | `[TEST]西湖设计工作室` | `LIKE '[TEST]%'` |
| projects | name | `[TEST]西溪诚园 A栋1201` | `LIKE '[TEST]%'` |
| work_logs | description | `水电工完成了客厅布线（测试项目）` | `LIKE '%[TEST]%'` |

**优势**:
1. **可视化**: 在数据库中一眼识别测试数据
2. **安全性**: 清理脚本只删除带标记的数据，避免误删生产数据
3. **可追溯**: 所有测试数据统一前缀，便于调试

**使用流程**:
```bash
# 1. 生成测试数据
go run server/scripts/seed_test_data.go

# 2. 运行测试
./test_security.sh
./test_project_flow.ps1

# 3. 清理测试数据
go run server/scripts/clean_test_data.go
```

### 9.5 前端测试

#### 9.5.1 Mobile App 测试

**文件**: `mobile/__tests__/App.test.tsx` (14行)

**测试框架**:
- `react-test-renderer` - React 组件渲染测试

**测试内容**:
```typescript
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

test('renders correctly', async () => {
  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<App />);
  });
});
```

**验证点**:
- ✅ App 组件可正常渲染
- ✅ 无运行时错误
- ✅ React 19 兼容性验证

**运行方式**:
```bash
cd mobile
npm test
```

**待扩展**:
- ❓ 组件单元测试（LoginScreen, BookingScreen 等）
- ❓ 快照测试（UI 回归测试）
- ❓ 导航测试（React Navigation）
- ❓ 状态管理测试（Zustand store）

### 9.6 测试覆盖率分析

#### 9.6.1 测试覆盖维度

| 测试维度 | 覆盖率 | 测试方法 | 覆盖内容 |
|---------|-------|---------|---------|
| **配置安全** | 100% | 静态检查 | 无硬编码密码、环境变量使用 |
| **环境变量** | 100% | 静态检查 | JWT_SECRET, ENCRYPTION_KEY 必需性 |
| **源代码修复** | 100% | 静态检查 | debug endpoint, rate limit, security headers |
| **功能安全** | 80% | API 测试 | 限流、安全响应头、健康检查 |
| **业务流程** | 30% | E2E 测试 | 项目流程、托管流程、登录验证 |
| **数据管理** | 100% | 工具脚本 | seed/clean 原子性操作 |
| **前端组件** | <5% | 单元测试 | 仅 App 基础渲染 |
| **API 接口** | 15% | E2E 测试 | 3个流程测试覆盖10+个端点 |

#### 9.6.2 测试场景覆盖清单

**已覆盖场景** ✅:
- [x] 登录流程（验证码验证）
- [x] 登录限流（5次/分钟）
- [x] 项目 CRUD（创建、查询、详情）
- [x] 托管账户充值
- [x] 托管账户余额查询
- [x] 资金释放权限控制（验收状态检查）
- [x] 配置文件安全
- [x] 环境变量验证
- [x] debug 端点保护
- [x] 安全响应头

**未覆盖场景** ❌:
- [ ] 预约流程（创建 → 支付意向金 → 商家确认）
- [ ] 方案流程（提交 → 拒绝 → 重新提交 → 确认）
- [ ] 订单流程（创建 → 支付 → 取消）
- [ ] 评价流程（创建评价 → 商家回复）
- [ ] Admin RBAC 权限测试
- [ ] Admin 审核流程测试
- [ ] WebSocket 实时消息测试
- [ ] 商家入驻审核流程
- [ ] 工人派单流程
- [ ] 售后工单流程

#### 9.6.3 代码覆盖率（推测）

**后端代码覆盖率** (估计):
- **Handler 层**: 15% - 仅3个流程测试覆盖部分handler
- **Service 层**: 10% - 部分业务逻辑未测试
- **Middleware 层**: 60% - 限流、认证、安全头已测试
- **Repository 层**: 20% - 数据库操作部分覆盖
- **总覆盖率**: ~20%

**前端代码覆盖率** (估计):
- **Admin Panel**: 0% - 无自动化测试
- **Mobile App**: <5% - 仅基础渲染测试
- **总覆盖率**: ~2%

### 9.7 测试执行流程

#### 9.7.1 本地测试流程

**准备环境**:
```bash
# 1. 启动 Docker 服务
docker-compose -f docker-compose.local.yml up -d

# 2. 生成测试数据
go run server/scripts/seed_test_data.go

# 3. 等待服务就绪
curl http://localhost:8080/api/v1/health
```

**执行测试**:
```powershell
# Windows 环境
.\test_security.ps1          # 安全测试（约10秒）
.\test_project_flow.ps1      # 项目流程测试（约5秒）
.\test_escrow_flow.ps1       # 托管流程测试（约5秒）
.\test_login_verification.ps1 # 登录验证测试（约2秒）
```

```bash
# Linux/macOS 环境
bash test_security.sh        # 安全测试（约15秒，含限流测试）
```

**清理数据**:
```bash
# 清理测试数据
go run server/scripts/clean_test_data.go
```

#### 9.7.2 测试失败处理

**test_security 测试失败排查**:

| 失败提示 | 可能原因 | 解决方案 |
|---------|---------|---------|
| "config.yaml contains hardcoded password" | config.yaml 包含明文密码 | 修改为 `${DATABASE_PASSWORD}` |
| "JWT_SECRET not configured" | .env 文件未设置密钥 | `cp server/.env.example server/.env` 并填入密钥 |
| "Debug endpoint protection missing" | router.go 未添加 release 检查 | 添加 `if cfg.Server.Mode != "release"` |
| "API service not running" | 服务未启动 | `docker-compose up -d` |
| "Login rate limiting missing" | 未添加限流中间件 | router.go 添加 `LoginRateLimit()` |

**test_project_flow 测试失败排查**:

| 失败提示 | 可能原因 | 解决方案 |
|---------|---------|---------|
| "Login failed" | 测试账号不存在 | 运行 `seed_test_data.go` |
| "Create project failed" | providerId 不存在 | 检查测试数据中的 provider ID |
| "401 Unauthorized" | Token 过期 | 重新登录获取新 Token |

**test_escrow_flow 测试失败排查**:

| 失败提示 | 可能原因 | 解决方案 |
|---------|---------|---------|
| "Escrow not found" | projectId 错误 | 使用 seed_test_data.go 生成的项目ID |
| "Release SUCCESS (Expected FAIL)" | 验收状态检查逻辑缺失 | 检查 `escrow_service.go` 验收状态验证 |

#### 9.7.3 测试报告示例

**test_security.sh 输出**:
```
🔒 开始本地安全测试...
================================

📋 步骤 1: 检查配置文件安全性
--------------------------------
[测试 1] 检查 config.yaml 无硬编码密码
✅ 通过: config.yaml 无硬编码密码 123456

[测试 2] 检查 config.yaml 使用环境变量
✅ 通过: config.yaml 使用 ${DATABASE_PASSWORD}

[测试 3] 检查 .env.example 无真实密钥
✅ 通过: .env.example 无真实 JWT 密钥

📋 步骤 2: 检查环境变量配置
--------------------------------
[测试 4] 检查 .env 文件是否存在
✅ 通过: server/.env 文件存在

[测试 5] 检查 JWT_SECRET 是否设置
✅ 通过: JWT_SECRET 已设置

[测试 6] 检查 ENCRYPTION_KEY 是否设置
✅ 通过: ENCRYPTION_KEY 已设置

📋 步骤 3: 检查源代码修复
--------------------------------
[测试 7] 检查调试端点保护
✅ 通过: 调试端点已添加 release 模式检查

[测试 8] 检查登录限流
✅ 通过: 登录接口已添加限流

[测试 9] 检查安全响应头中间件
✅ 通过: 安全响应头中间件已创建

[测试 10] 检查加密密钥强制验证
✅ 通过: 加密密钥已添加强制验证

📋 步骤 5: API 服务测试
--------------------------------
检测到 API 服务正在运行，开始功能测试...

[测试 11] 测试健康检查接口
✅ 通过: 健康检查接口正常

[测试 12] 测试安全响应头
✅ 通过: 安全响应头已启用

[测试 13] 测试登录限流（连续6次请求）
✅ 通过: 登录限流正常（第6次请求返回429）

================================
📊 测试结果汇总
================================
总测试数: 13
通过: 13
失败: 0

🎉 恭喜！所有测试通过！
```

### 9.8 测试亮点

#### 9.8.1 自动化测试亮点

1. **双平台支持**:
   - PowerShell 和 Bash 脚本功能一致
   - Windows + Linux/macOS 全覆盖
   - 自动化测试不依赖特定平台

2. **非侵入式测试**:
   - 静态配置检查（无需修改代码）
   - API 功能测试（只读操作）
   - 安全验证无副作用

3. **完整的测试报告**:
   - 实时彩色输出（GREEN/RED/YELLOW）
   - 统计通过/失败数量
   - 失败时提供修复建议

4. **测试隔离**:
   - TEST_PREFIX 标记机制
   - seed/clean 配套脚本
   - 测试数据不污染生产数据

#### 9.8.2 测试数据亮点

1. **真实业务场景**:
   - 3个不同状态的项目（进行中、待开工、已完工）
   - 完整的里程碑模板（6个阶段）
   - 真实的施工日志数据

2. **完整依赖链路**:
   - 用户 → 服务商 → 项目 → 里程碑 → 托管账户 → 工作日志
   - 数据关联完整，可测试复杂场景

3. **原子性操作**:
   - seed 脚本使用事务（全成功或全失败）
   - clean 脚本按依赖关系逆序删除
   - 避免数据残留

#### 9.8.3 安全测试亮点

1. **多维度验证**:
   - 配置文件安全（硬编码检查）
   - 环境变量验证（密钥存在性）
   - 源代码修复验证（静态检查）
   - 功能安全测试（API 测试）

2. **P0/P1 安全问题全覆盖**:
   - 100% 验证所有高危安全修复
   - 自动化回归测试（防止修复失效）

3. **限流测试创新**:
   - 连续6次请求测试登录限流
   - 验证429状态码返回
   - 真实模拟攻击场景

### 9.9 未解问题清单

根据测试体系分析，以下问题需要进一步确认或补充：

**测试覆盖缺口**:
- ❓ Admin Panel 无任何自动化测试（0%覆盖率）
- ❓ Mobile App 测试不足（仅基础渲染测试）
- ❓ WebSocket 实时消息测试缺失
- ❓ RBAC 权限测试未覆盖
- ❓ 审核流程测试未覆盖（服务商审核、作品审核）
- ❓ 核心业务流程测试不足（预约、方案、订单）

**测试工具和框架**:
- ❓ 是否引入 Go 单元测试框架（testify, gomock）？
- ❓ 是否引入前端测试框架（Jest, Testing Library）？
- ❓ 是否需要 E2E 测试框架（Playwright, Cypress）？
- ❓ 是否需要性能测试工具（K6, JMeter）？
- ❓ 是否需要 API 集成测试框架（Postman, Newman）？

**CI/CD 集成**:
- ❓ GitHub Actions 自动化测试流程？
- ❓ 代码覆盖率报告生成？
- ❓ 测试失败时的通知机制？
- ❓ 测试数据自动清理策略？

**测试数据管理**:
- ❓ 测试数据版本控制策略？
- ❓ 多环境测试数据隔离？
- ❓ 测试数据敏感信息脱敏？
- ❓ 测试数据量级扩展（压力测试）？

**性能测试**:
- ❓ API 响应时间测试？
- ❓ 并发压力测试？
- ❓ 数据库查询性能测试？
- ❓ 前端加载性能测试？

**安全测试**:
- ❓ SQL 注入测试？
- ❓ XSS 攻击测试？
- ❓ CSRF 攻击测试？
- ❓ 权限越权测试？
- ❓ 文件上传安全测试？

**测试文档**:
- ❓ 测试用例文档？
- ❓ 测试执行手册？
- ❓ 测试数据说明文档？
- ❓ 测试报告模板？

---

---

## 关键发现汇总
（在分析过程中不断更新）

### 技术架构亮点
- 待补充

### 潜在风险点
- 待补充

### 文档不一致性
- 待补充

### 改进建议
- 待补充
