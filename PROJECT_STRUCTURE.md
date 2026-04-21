# 项目目录结构文档

## 项目概述

这是一个家装设计一体化平台，连接业主、设计师、施工公司、工头和工人。项目采用前后端分离架构，包含移动端App、管理后台和后端API服务。

## 技术栈

- **后端**: Go + Gin + GORM + PostgreSQL + Redis + WebSocket
- **管理后台**: React 19 + TypeScript + Vite + Ant Design
- **移动端**: React Native 0.83 + TypeScript (支持iOS/Android/Web)
- **部署**: Docker + Docker Compose + Nginx

---

## 根目录结构

```
home_decoration/
├── .git/                      # Git仓库
├── .github/                   # CI / GitHub 配置
├── .vscode/                   # 共享 VSCode 任务配置
├── admin/                     # 管理后台 (React)
├── merchant/                  # 商家端 (React)
├── mini/                      # 微信小程序 (Taro)
├── mobile/                    # 移动端 App (React Native)
├── web/                       # 用户侧 Web
├── website/                   # 官网
├── server/                    # 后端 API 服务 (Go)
├── deploy/                    # 部署配置
├── docs/                      # 项目文档
├── documentation/             # 标准化文档
├── ops/                       # 共享运维与控制面
├── scripts/                   # 辅助脚本
├── tests/                     # 自动化测试
├── .gitignore                 # Git 忽略规则
├── AGENTS.md                  # 仓库级工程规则
├── CLAUDE.md                  # Claude Code 项目指引
├── docker-compose.local.yml   # 本地开发 Docker 配置
├── docker-compose.yml         # Docker Compose 配置
└── PROJECT_STRUCTURE.md       # 本文档
```

---

## 后端服务 (server/)

### 目录结构

```
server/
├── cmd/
│   └── api/
│       └── main.go            # 应用入口点
├── internal/                  # 内部代码
│   ├── config/
│   │   └── config.go         # 配置管理 (Viper)
│   ├── handler/              # HTTP处理器 (控制器层)
│   │   ├── admin_auth_handler.go
│   │   ├── admin_handler.go
│   │   ├── admin_new_handler.go
│   │   ├── chat_handler.go
│   │   ├── create_booking.go
│   │   ├── handler.go
│   │   └── ws_handler.go
│   ├── middleware/           # 中间件
│   │   └── middleware.go     # CORS, JWT, 日志, 恢复
│   ├── model/                # 数据模型
│   │   ├── admin.go          # 管理员模型
│   │   ├── chat.go           # 聊天消息模型
│   │   ├── model.go          # 核心业务模型
│   │   └── rbac.go           # 角色权限模型
│   ├── repository/           # 数据访问层
│   │   ├── database.go       # 数据库连接
│   │   └── redis.go          # Redis连接
│   ├── router/               # 路由定义
│   │   └── router.go         # 路由注册
│   ├── service/              # 业务逻辑层
│   │   ├── booking_service.go
│   │   ├── escrow_service.go
│   │   ├── material_shop_service.go
│   │   ├── project_service.go
│   │   ├── provider_service.go
│   │   ├── sms_service.go
│   │   └── user_service.go
│   └── ws/                   # WebSocket实现
│       ├── client.go         # WebSocket客户端
│       ├── handler.go        # WebSocket处理器
│       ├── hub.go            # WebSocket连接池
│       └── protocol.go       # 消息协议定义
├── migrations/               # 数据库迁移文件
├── pkg/                      # 公共包
│   ├── response/
│   │   └── response.go       # 统一响应格式
│   └── utils/                # 工具函数
├── scripts/                  # 脚本文件
│   ├── migrations/           # 数据库迁移SQL
│   │   ├── add_user_login_lock_fields.sql
│   │   ├── v1.1.0_add_provider_fields.sql
│   │   ├── v1.1.1_add_provider_subtype.sql
│   │   └── v1.2.0_add_project_phases.sql
│   ├── clean_test_data.go    # 清理测试数据
│   ├── cleanup_test_data.sql
│   ├── init_admin_data.sql   # 初始化管理员数据
│   ├── init_db.go           # 数据库初始化
│   ├── migrate_login_lock.sh
│   ├── seed_*.go/sql        # 各种数据种子脚本
│   └── seed_rbac.go         # RBAC数据种子
├── tmp/                      # 临时文件
│   └── main                 # 编译后的可执行文件
├── config.yaml              # 配置文件
├── config.yaml.example      # 配置示例
├── config.docker.yaml       # Docker环境配置
├── Dockerfile               # Docker镜像定义
├── Dockerfile.api.dev       # 开发环境Dockerfile
├── go.mod                   # Go模块定义
├── go.sum                   # Go依赖校验
├── Makefile                 # Make构建脚本
└── README.md                # 后端说明文档
```

### 核心功能模块

**数据模型** (internal/model/model.go):
- User - 用户
- Provider - 服务商 (设计师/公司/工头)
- Worker - 工人
- Project - 项目
- ProjectPhase - 项目阶段
- PhaseTask - 阶段任务
- Milestone - 里程碑
- EscrowAccount - 托管账户
- Transaction - 交易记录
- Booking - 预约
- ProviderCase - 案例
- ProviderReview - 评价
- MaterialShop - 建材店
- Chat - 聊天消息
- Admin, Role, Menu - 管理后台RBAC系统

**API路由** (internal/router/router.go):
- `/api/v1/auth/*` - 用户认证 (公开)
- `/api/v1/providers` - 服务商列表 (公开)
- `/api/v1/material-shops` - 建材店 (公开)
- `/api/v1/ws` - WebSocket连接 (需JWT)
- `/api/v1/admin/*` - 管理后台 (需RBAC)

---

## 管理后台 (admin/)

### 目录结构

```
admin/
├── public/                   # 静态资源
├── src/
│   ├── assets/              # 资源文件
│   │   └── react.svg
│   ├── components/          # 通用组件
│   │   └── PlaceholderPage.tsx
│   ├── layouts/             # 布局组件
│   │   └── BasicLayout.tsx  # 基础布局 (侧边栏+Header)
│   ├── pages/               # 页面组件
│   │   ├── dashboard/       # 仪表盘
│   │   │   └── index.tsx
│   │   ├── user/            # 登录页
│   │   │   └── Login.tsx
│   │   ├── users/           # 用户管理
│   │   │   └── UserList.tsx
│   │   ├── admins/          # 管理员管理
│   │   │   └── AdminList.tsx
│   │   ├── providers/       # 服务商管理
│   │   │   └── ProviderList.tsx
│   │   ├── audits/          # 审核管理
│   │   │   ├── ProviderAudit.tsx
│   │   │   └── MaterialShopAudit.tsx
│   │   ├── materials/       # 建材店管理
│   │   │   └── MaterialShopList.tsx
│   │   ├── projects/        # 项目管理
│   │   │   ├── list.tsx
│   │   │   └── ProjectMap.tsx
│   │   ├── bookings/        # 预约管理
│   │   │   └── BookingList.tsx
│   │   ├── reviews/         # 评价管理
│   │   │   └── ReviewList.tsx
│   │   ├── finance/         # 财务管理
│   │   │   ├── EscrowAccountList.tsx
│   │   │   └── TransactionList.tsx
│   │   ├── risk/            # 风控管理
│   │   │   ├── RiskWarningList.tsx
│   │   │   └── ArbitrationCenter.tsx
│   │   ├── settings/        # 系统设置
│   │   │   └── SystemSettings.tsx
│   │   └── system/          # 系统日志
│   │       └── LogList.tsx
│   ├── services/            # API服务
│   │   └── api.ts          # Axios封装
│   ├── stores/              # 状态管理
│   │   └── authStore.ts    # 认证状态 (Zustand)
│   ├── router.tsx           # 路由配置
│   ├── App.tsx             # 应用根组件
│   ├── App.css             # 应用样式
│   ├── main.tsx            # 应用入口
│   └── index.css           # 全局样式
├── .eslintrc.cjs           # ESLint配置
├── index.html              # HTML模板
├── package.json            # 依赖声明
├── tsconfig.json           # TypeScript配置
├── vite.config.ts          # Vite配置
└── README.md               # 前端说明文档
```

### 功能模块

- **用户管理**: 用户列表、管理员管理
- **服务商管理**: 设计师、公司、工头审核与管理
- **建材店管理**: 建材店审核与品牌管理
- **项目管理**: 项目列表、地图视图
- **预约管理**: 预约审核与调度
- **评价管理**: 评价审核与处理
- **财务管理**: 托管账户、交易流水
- **风控管理**: 风险预警、仲裁中心
- **系统管理**: 系统设置、操作日志
- **RBAC**: 角色权限、菜单管理

---

## 移动端App (mobile/)

### 目录结构

```
mobile/
├── android/                  # Android原生代码
│   ├── app/                 # 应用模块
│   ├── build.gradle         # Gradle构建配置
│   └── ...
├── ios/                      # iOS原生代码 (如果有)
├── src/
│   ├── assets/              # 资源文件
│   │   └── logo.png
│   ├── components/          # 通用组件
│   │   ├── DesignerCard.tsx
│   │   ├── EmptyView.tsx
│   │   ├── LoadingView.tsx
│   │   ├── MaterialShopCard.tsx
│   │   ├── NetworkErrorView.tsx
│   │   ├── PullToRefresh.tsx
│   │   ├── SkeletonCard.tsx
│   │   ├── Toast.tsx
│   │   ├── WorkerCard.tsx
│   │   └── index.ts
│   ├── hooks/               # 自定义Hooks
│   │   └── useRefreshable.ts
│   ├── navigation/          # 导航配置
│   │   └── AppNavigator.tsx # 主导航器
│   ├── screens/             # 页面组件
│   │   ├── HomeScreen.tsx           # 首页 (服务商浏览)
│   │   ├── InspirationScreen.tsx    # 灵感广场
│   │   ├── InspirationDetails.tsx   # 灵感详情
│   │   ├── MessageScreen.tsx        # 消息列表
│   │   ├── MySiteScreen.tsx         # 我的工地
│   │   ├── ProfileScreen.tsx        # 个人中心
│   │   ├── LoginScreen.tsx          # 登录
│   │   ├── ProviderDetails.tsx      # 服务商详情
│   │   ├── BookingScreen.tsx        # 预约
│   │   ├── ProjectTimelineScreen.tsx # 项目时间线
│   │   ├── ChatRoomScreen.tsx       # 聊天室
│   │   ├── ChatSettingsScreen.tsx   # 聊天设置
│   │   ├── ReviewsScreen.tsx        # 评价列表
│   │   ├── CaseScreens.tsx          # 案例浏览
│   │   ├── SettingsScreen.tsx       # 设置
│   │   ├── AccountSecurityScreen.tsx # 账户安全
│   │   ├── ChangePasswordScreen.tsx  # 修改密码
│   │   ├── PersonalInfoScreen.tsx    # 个人信息
│   │   ├── ScanQRScreen.tsx          # 扫码
│   │   └── PullToRefreshDemo.tsx     # 下拉刷新Demo
│   ├── services/            # 服务层
│   │   ├── api.ts          # API封装 (Axios)
│   │   ├── mockData.ts     # Mock数据
│   │   └── WebSocketService.ts # WebSocket服务
│   ├── store/               # 状态管理 (Zustand)
│   │   ├── authStore.ts    # 认证状态
│   │   ├── chatStore.ts    # 聊天状态
│   │   └── providerStore.ts # 服务商数据
│   ├── types/               # TypeScript类型定义
│   │   └── provider.ts
│   ├── utils/               # 工具函数
│   │   ├── alert.ts        # 弹窗工具
│   │   └── SecureStorage.ts # 安全存储 (Keychain)
│   ├── config.ts           # 配置文件
│   └── config.web.ts       # Web配置
├── .bundle/                 # Bundler配置
├── index.js                 # 应用入口
├── app.json                 # Expo配置
├── package.json             # 依赖声明
├── tsconfig.json            # TypeScript配置
├── vite.config.ts           # Vite配置 (Web)
├── index.html               # Web入口HTML
└── README.md                # 移动端说明文档
```

### 核心功能

**底部导航**:
- Home - 浏览服务商
- Inspiration - 设计灵感
- Progress - 项目进度
- Message - 聊天消息
- Profile - 个人中心

**关键特性**:
- WebSocket实时聊天
- 跨平台支持 (iOS/Android/Web)
- 安全令牌存储 (Keychain)
- 下拉刷新
- 骨架屏加载

---

## 部署配置 (deploy/)

```
deploy/
├── nginx/                    # Nginx配置
├── docker-compose.prod.yml   # 生产环境Docker配置
├── Dockerfile.backend        # 后端生产镜像
├── Dockerfile.frontend       # 前端生产镜像
├── Dockerfile.node.dev       # Node开发镜像
├── nginx.conf               # Nginx主配置
├── aliyun_purchase_list.csv # 阿里云采购清单
├── COST_ANALYSIS.md         # 成本分析
└── README.md                # 部署说明
```

---

## 文档 (docs/)

```
docs/
├── PRD.md                   # 产品需求文档
├── Backend_Design.md        # 后端架构设计
├── Frontend_Design.md       # 前端架构设计
├── Database_Design.md       # 数据库设计
├── UI_UX_Design.md          # UI/UX设计规范
├── Mobile_App_Guide.md      # 移动端开发指南
├── DEPLOY.md                # 部署指南
├── DEPLOY_DOCKER.md         # Docker部署指南
├── ANDROID_BUILD_GUIDE.md   # Android构建指南
├── PRE_RELEASE_CHECKLIST.md # 发布前检查清单
├── README.md                # 文档索引
└── 1.md                     # 快速启动指南 (中文)
```

---

## 配置文件

### 根目录配置

- **docker-compose.local.yml** - 本地开发环境，包含数据库、Redis、后端API
- **docker-compose.yml** - 通用Docker配置
- **.gitignore** - 忽略 `node_modules/`, `db_data_local/`, `tmp/`, `dist/` 等
- **CLAUDE.md** - Claude Code项目指引文档

### 后端配置

- **config.yaml** - 默认配置
- **config.docker.yaml** - Docker环境配置
- **go.mod** - Go依赖管理
- **Makefile** - 构建、测试、格式化命令

### 前端配置

- **admin/vite.config.ts** - Vite构建配置，base路径 `/admin`
- **admin/tsconfig.json** - TypeScript严格模式
- **mobile/vite.config.ts** - 支持Web模式
- **mobile/app.json** - React Native配置

---

## 数据库

### 本地开发

- **db_data_local/** - PostgreSQL数据持久化目录 (已忽略Git)
- 数据库: `decoration_db`
- 用户: `postgres`
- 密码: `postgres123`
- 端口: `5432`

### 种子数据

- `server/scripts/init_admin_data.sql` - 管理员初始数据
- `server/scripts/seed_test_data.sql` - 测试数据
- `server/scripts/seed_rbac.go` - RBAC角色菜单

---

## 开发工作流

### 启动本地环境

```bash
# 启动所有服务
docker-compose -f docker-compose.local.yml up -d

# 仅启动数据库和Redis
docker compose up -d db redis
```

### 后端开发

```bash
cd server
make dev      # 热重载开发
make test     # 运行测试
make fmt      # 代码格式化
make build    # 构建可执行文件
```

### 管理后台开发

```bash
cd admin
npm run dev   # 开发服务器 (http://localhost:5173/admin)
npm run build # 构建生产版本
npm run lint  # 代码检查
```

### 移动端开发

```bash
cd mobile
npm run web      # Web开发 (Vite)
npm start        # Metro bundler
npm run android  # Android模拟器
npm run ios      # iOS模拟器
```

### Android调试

```bash
# 使能Metro bundler访问
adb reverse tcp:8081 tcp:8081

# 使能后端API访问
adb reverse tcp:8080 tcp:8080
```

---

## 目录结构评估

### ✅ 优点

1. **清晰的分层架构** - 后端采用标准的Go项目布局 (cmd, internal, pkg)
2. **职责分离** - Handler → Service → Repository 三层分离
3. **前后端分离** - 移动端、管理后台、后端服务独立开发
4. **文档完善** - docs目录包含完整的产品和技术文档
5. **部署友好** - 提供Docker配置和部署脚本
6. **代码复用** - 公共组件和工具函数抽取到独立目录

### ⚠️ 可改进之处

1. **测试覆盖** - 缺少测试文件目录 (建议添加 `server/internal/*/tests/`)
2. ~~**环境变量** - 建议使用 `.env.example` 统一管理环境变量~~ ✅ 已完成
3. **API文档** - 缺少OpenAPI/Swagger规范文档
4. ~~**日志管理** - `backend.log` 在根目录，建议统一到 `logs/` 目录~~ ✅ 已完成
5. ~~**构建产物** - `server/api.exe` 和 `server/tmp/main` 应该在 `.gitignore` 中~~ ✅ 已完成
6. ~~**移动端目录** - `mobile/src/store/` 和 `mobile/src/stores/` 重复~~ ✅ 已清理
7. ~~**数据库迁移** - migrations目录为空，建议使用 `golang-migrate` 工具~~ ✅ 已整理

### 📋 建议补充

1. **CI/CD配置** - 添加 `.github/workflows/` 或 `.gitlab-ci.yml`
2. **Postman集合** - 添加API测试集合到 `docs/api/`
3. **性能测试** - 添加 `server/test/benchmark/`
4. **安全扫描** - 添加依赖扫描和SAST工具配置
5. **监控配置** - 添加Prometheus/Grafana配置
6. **备份脚本** - 添加数据库备份恢复脚本到 `scripts/`

---

## 总结

该项目目录结构整体合理，符合现代全栈应用的最佳实践。采用了清晰的分层架构和职责分离原则。建议进一步完善测试、文档和DevOps流程，以提升项目的可维护性和可靠性。

---

## 更新日志

### v1.1 (2025-12-27)
- ✅ 新增 `.env.example` 环境变量模板
- ✅ 统一日志管理到 `logs/` 目录
- ✅ 整理数据库迁移文件并添加文档
- ✅ 更新 `.gitignore` 规则
- ✅ 清理重复的 `stores` 目录
- 📝 详见 [OPTIMIZATION_SUMMARY.md](OPTIMIZATION_SUMMARY.md)

### v1.0 (2025-12-27)
- 初始版本
- 完整的项目目录结构文档

---

**文档版本**: 1.1
**最后更新**: 2025-12-27
**维护者**: 项目团队
