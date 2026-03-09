# 装修设计一体化平台 - 后端服务

## 技术栈

- **语言**: Go 1.21+
- **框架**: Gin
- **ORM**: GORM
- **数据库**: PostgreSQL
- **缓存**: Redis

## 项目结构

```
server/
├── cmd/
│   └── api/
│       └── main.go          # 入口文件
├── internal/
│   ├── config/              # 配置管理
│   ├── handler/             # HTTP处理函数
│   ├── middleware/          # 中间件
│   ├── model/               # 数据模型
│   ├── repository/          # 数据库操作
│   ├── router/              # 路由配置
│   └── service/             # 业务逻辑
├── pkg/
│   ├── response/            # 响应封装
│   └── utils/               # 工具函数
├── migrations/              # 数据库迁移
├── config.yaml.example      # 配置模板
├── Dockerfile               # Docker构建
├── Makefile                 # 构建脚本
└── go.mod                   # Go模块文件
```

## 快速开始

### 1. 环境要求

- Go 1.21+
- PostgreSQL 15+
- Redis 7+

### 2. 安装依赖

```bash
cd server
go mod download
```

### 3. 配置

```bash
cp config.yaml.example config.yaml
# 编辑 config.yaml 填入数据库等配置
```

### 4. 运行

```bash
# 开发模式
go run ./cmd/api

# 或使用 Makefile
make run
```

### 5. 访问

- API地址: http://localhost:8080
- 健康检查: http://localhost:8080/api/v1/health（`data.status` 会返回 `ok` 或 `degraded`，并暴露 `smsAuditLog`、`userAuthSchema`、`merchantOnboardingSchema` 自检结果）
- 正式 schema 发布与历史环境补洞统一使用 `server/migrations/`；认证/短信审计/商家入驻优先执行 `server/migrations/v1.6.4_reconcile_auth_and_onboarding_schema.sql`，不要依赖 `AutoMigrate` 自动补表

## API 接口

### 认证
- `POST /api/v1/auth/register` - 注册
- `POST /api/v1/auth/login` - 登录
- `POST /api/v1/auth/send-code` - 发送验证码

### 服务商
- `GET /api/v1/designers` - 设计师列表
- `GET /api/v1/companies` - 装修公司列表
- `GET /api/v1/foremen` - 工长列表

### 项目
- `POST /api/v1/projects` - 创建项目
- `GET /api/v1/projects/:id` - 项目详情
- `GET /api/v1/projects/:id/logs` - 施工日志
- `POST /api/v1/projects/:id/accept` - 验收

### 资金托管
- `GET /api/v1/escrow/:projectId` - 托管账户
- `POST /api/v1/escrow/deposit` - 存入
- `POST /api/v1/escrow/release` - 释放

## Docker

```bash
# 构建镜像
make docker-build

# 运行容器
make docker-run
```
