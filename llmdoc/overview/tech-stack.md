# 技术栈 - Home Decoration Platform

## ⚠️ 关键约束：混合 React 版本策略

本项目使用**不同的 React 版本**以适应不同平台的生态系统要求：

| 平台 | React 版本 | 原因 |
|------|-----------|------|
| **Admin Panel** | **18.3.1** | Ant Design 5.x 和腾讯云 IM SDK 兼容性 |
| **Mobile App** | **19.2.0** | React Native 0.83 支持 React 19 |
| **WeChat Mini** | **18.3.1** | Taro 3.x 要求 React 18 |

**严禁跨项目混用 React 版本！** 每个项目有独立的 `package.json`。

## 🔧 后端技术栈

### 核心框架
- **语言**：Go 1.23
- **Web 框架**：Gin（高性能 HTTP 框架）
- **ORM**：GORM（PostgreSQL）
- **配置管理**：Viper
- **日志**：zap（结构化日志）

### 数据存储
- **主数据库**：PostgreSQL 15
  - 关系型数据存储
  - JSONB 字段支持（报价明细、服务区域等）
  - 全文搜索（待实现）
- **缓存**：Redis 6.2
  - Session 存储
  - 限流计数器
  - 热点数据缓存

### 认证授权
- **JWT**：用户端认证
- **Refresh Token**：自动刷新机制
- **bcrypt**：密码哈希
- **RBAC**：基于角色的权限控制

### 中间件
- **CORS**：跨域资源共享
- **Logger**：请求日志记录
- **Recovery**：Panic 恢复
- **RateLimit**：限流保护
- **SecurityHeaders**：安全响应头
- **AuditLogger**：审计日志

### 定时任务
- **Cron**：robfig/cron/v3
  - 订单超时检查（每小时）
  - 预约超时检查（每小时）
  - 商家收入结算（每天凌晨 2 点）

### IM 系统（迁移中）
- **旧系统**：自研 WebSocket Hub（已废弃）
- **新系统 1**：Tinode 开源 IM
  - 路径：`server/internal/tinode/`
  - 数据库：独立的 Tinode 数据库
- **新系统 2**：腾讯云 IM SDK
  - 路径：`server/utils/tencentim/`
  - 配置：`TENCENT_IM_SDKAPPID`, `TENCENT_IM_SECRET`

### 第三方集成
- **微信小程序**：
  - `wx.login` → 后端验证 → JWT
  - `wx.getPhoneNumber` → 手机号绑定
- **待集成**：
  - 微信支付
  - 支付宝支付
  - 短信验证码
  - 高德地图

## 🎨 前端技术栈

### Admin Panel（管理后台）

**框架**：
- React 18.3.1
- TypeScript 5.x
- Vite 5.x（构建工具）

**UI 库**：
- Ant Design 5.x
- Ant Design Pro Components
- lucide-react（图标）

**路由**：
- React Router v7
- basename: `/admin`

**状态管理**：
- Zustand（全局状态）
- persist 中间件（localStorage 持久化）
- authStore（认证状态）
- identityStore（身份切换状态）

**API 客户端**：
- Axios
- 自动 token 注入
- 401 自动登出

**开发工具**：
- ESLint
- Prettier
- TypeScript

### Mobile App（移动应用）

**框架**：
- React Native 0.83
- React 19.2.0
- TypeScript 5.x

**导航**：
- @react-navigation/native-stack
- @react-navigation/bottom-tabs
- 5 个主 Tab：Home, Inspiration, Progress, Message, Profile

**状态管理**：
- Zustand
- AsyncStorage 持久化
- react-native-keychain（安全存储 token）
- authStore（认证状态）
- identityStore（身份切换状态）

**UI 组件**：
- React Native 内置组件
- lucide-react-native（图标）
- 自定义组件库

**网络**：
- Axios
- WebSocket（实时聊天）
- 自动 token 刷新

**平台**：
- ✅ iOS（原生）
- ✅ Android（原生）
- ❌ Web（已禁用，仅原生）

### WeChat Mini Program（微信小程序）

**框架**：
- Taro 3.x
- React 18.3.1
- TypeScript 5.x

**状态管理**：
- Zustand
- Taro.setStorage 持久化
- authStore（认证状态）
- identityStore（身份切换状态）

**UI 组件**：
- Taro 内置组件
- 自定义组件

**网络**：
- Taro.request 封装
- 自动 token 刷新
- 微信 API 集成

**认证**：
- wx.login（微信登录）
- wx.getPhoneNumber（手机号绑定）
- 共享后端 JWT 系统

**状态**：
- 🔄 MVP 阶段
- 基础认证已完成
- 核心功能开发中

## 📦 依赖管理

### 后端（Go）
```bash
# 主要依赖
github.com/gin-gonic/gin v1.9.1
gorm.io/gorm v1.25.5
gorm.io/driver/postgres v1.5.4
github.com/spf13/viper v1.17.0
github.com/golang-jwt/jwt/v5 v5.2.0
golang.org/x/crypto v0.17.0
github.com/robfig/cron/v3 v3.0.1
```

### Admin Panel
```json
{
  "react": "18.3.1",
  "react-dom": "18.3.1",
  "antd": "^5.12.0",
  "@ant-design/pro-components": "^2.6.0",
  "react-router-dom": "^7.0.0",
  "zustand": "^4.4.0",
  "axios": "^1.6.0"
}
```

### Mobile App
```json
{
  "react": "19.2.0",
  "react-native": "0.83.0",
  "@react-navigation/native": "^7.0.0",
  "@react-navigation/native-stack": "^7.0.0",
  "@react-navigation/bottom-tabs": "^7.0.0",
  "zustand": "^4.4.0",
  "axios": "^1.6.0",
  "react-native-keychain": "^8.1.0"
}
```

### WeChat Mini Program
```json
{
  "@tarojs/taro": "^3.6.0",
  "react": "18.3.1",
  "react-dom": "18.3.1",
  "zustand": "^4.4.0"
}
```

## 🔧 开发工具

### 代码质量
- **Go**：
  - gofmt（格式化）
  - golangci-lint（静态分析）
  - go test（单元测试）
- **TypeScript**：
  - ESLint（代码检查）
  - Prettier（格式化）
  - TypeScript Compiler（类型检查）

### 版本控制
- Git
- Conventional Commits（提交规范）
- GitHub（代码托管）

### CI/CD
- Docker（容器化）
- Docker Compose（本地开发）
- GitHub Actions（待配置）

### 开发环境
- **后端**：
  - Go 1.23
  - PostgreSQL 15
  - Redis 6.2
  - Air（热重载）
- **前端**：
  - Node.js 20+
  - pnpm（包管理器）
  - Vite（开发服务器）
- **移动端**：
  - Android Studio（Android）
  - Xcode（iOS）
  - Metro Bundler（React Native）
- **小程序**：
  - 微信开发者工具

## 🌐 环境变量

### 后端必需变量
```bash
# 数据库
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=postgres
DATABASE_PASSWORD=your_password
DATABASE_NAME=home_decoration

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=your_jwt_secret

# 微信小程序
WECHAT_MINI_APPID=wx1234567890abcdef
WECHAT_MINI_SECRET=your_wechat_secret

# 腾讯云 IM
TENCENT_IM_SDKAPPID=1400000000
TENCENT_IM_SECRET=your_im_secret

# 服务器模式
SERVER_MODE=debug  # debug/release
```

### 前端环境变量
```bash
# Admin Panel
VITE_API_URL=http://localhost:8080/api/v1

# Mobile App（硬编码在 api.ts）
API_URL=http://localhost:8080/api/v1

# WeChat Mini Program
TARO_APP_API_BASE=http://localhost:8080/api/v1
```

## 📊 性能指标

### 后端
- **响应时间**：< 100ms（P95）
- **并发支持**：1000+ QPS
- **数据库连接池**：最大 100 连接

### 前端
- **首屏加载**：< 2s
- **路由切换**：< 300ms
- **API 请求**：< 500ms

### 移动端
- **启动时间**：< 3s
- **页面切换**：< 200ms
- **内存占用**：< 150MB

## 🔄 版本兼容性

### 最低支持版本
- **iOS**：13.0+
- **Android**：API 21（Android 5.0）+
- **微信小程序**：基础库 2.10.0+
- **浏览器**（Admin）：Chrome 90+, Safari 14+, Edge 90+

## 🚀 构建产物

### 后端
- 单一二进制文件（Go 编译）
- Docker 镜像（Alpine Linux）

### Admin Panel
- 静态文件（HTML + JS + CSS）
- Nginx 服务

### Mobile App
- APK（Android）
- IPA（iOS）

### WeChat Mini Program
- 微信小程序包（上传到微信平台）

## 🔗 相关文档

- [项目概览](project-overview.md)
- [开发约束](development-constraints.md)
- [后端分层架构](../architecture/backend-layers.md)
- [前端路由架构](../architecture/frontend-routing.md)

---

**最后更新**：2026-01-26
