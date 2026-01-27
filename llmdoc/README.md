# llmdoc - AI 优化的项目文档

> 本目录包含为 LLM（大语言模型）优化的项目文档，由 cc-plugin 自动维护。

## 📚 文档结构

```
llmdoc/
├── index.md                    # 主索引（从这里开始）
├── overview/                   # 项目概览
│   ├── project-overview.md     # 项目定位、核心功能、用户角色
│   ├── tech-stack.md           # 技术栈、版本约束、依赖关系
│   ├── business-logic.md       # 核心业务流程、关键概念
│   └── development-constraints.md # 必须遵守的开发规范（P0 优先级）
├── guides/                     # 操作指南
│   ├── backend-add-api.md      # 后端：添加 API 端点
│   ├── frontend-add-page.md    # 前端：添加 Admin 页面
│   ├── mobile-add-screen.md    # 移动端：添加 React Native 屏幕
│   ├── mini-add-page.md        # 小程序：添加 Taro 页面
│   ├── database-add-model.md   # 数据库：添加模型和迁移
│   └── full-feature-workflow.md # 完整功能开发流程
├── architecture/               # 架构设计
│   ├── backend-layers.md       # 后端分层架构（Handler → Service → Repository）
│   ├── frontend-routing.md     # 前端路由架构
│   ├── escrow-system.md        # 托管支付系统
│   ├── auth-system.md          # 认证授权系统
│   ├── im-migration.md         # IM 系统迁移
│   └── database-schema.md      # 数据库设计
└── reference/                  # 参考文档
    ├── api-endpoints.md        # API 端点列表
    ├── database-models.md      # 数据库模型
    ├── environment-variables.md # 环境变量
    ├── middlewares.md          # 中间件列表
    ├── cron-jobs.md            # 定时任务
    └── error-codes.md          # 错误代码
```

## 🚀 快速开始

### 1. 新手入门

如果你是第一次接触这个项目：

1. 阅读 [index.md](index.md) - 了解文档结构
2. 阅读 [overview/project-overview.md](overview/project-overview.md) - 了解项目定位
3. 阅读 [overview/tech-stack.md](overview/tech-stack.md) - 了解技术栈
4. 阅读 [overview/development-constraints.md](overview/development-constraints.md) - **必读！** 开发约束

### 2. 开发任务

根据你的任务类型选择对应的指南：

**后端开发**：
- [添加 API 端点](guides/backend-add-api.md)
- [后端分层架构](architecture/backend-layers.md)

**前端开发**：
- [添加 Admin 页面](guides/frontend-add-page.md)
- [前端路由架构](architecture/frontend-routing.md)

**移动端开发**：
- [添加 React Native 屏幕](guides/mobile-add-screen.md)

**小程序开发**：
- [添加 Taro 页面](guides/mini-add-page.md)

**数据库操作**：
- [添加模型和迁移](guides/database-add-model.md)
- [数据库设计](architecture/database-schema.md)

**完整功能开发**：
- [完整功能开发流程](guides/full-feature-workflow.md)

### 3. 架构理解

深入理解系统架构：

- [后端分层架构](architecture/backend-layers.md) - Handler → Service → Repository
- [托管支付系统](architecture/escrow-system.md) - 资金流转、事务管理
- [认证授权系统](architecture/auth-system.md) - JWT、RBAC、微信登录
- [IM 系统迁移](architecture/im-migration.md) - WebSocket → Tinode/腾讯云 IM

## 🤖 cc-plugin 集成

本文档由 [cc-plugin](https://github.com/TokenRollAI/cc-plugin) 自动维护。

### 可用命令

在 Claude Code 中使用以下命令：

```bash
# 阅读项目文档
/read-doc

# 快速调查代码库
/investigate

# 更新文档
/update-doc

# 生成提交消息
/commit
```

### 自动行为

当你使用 Claude Code 时，AI 会：

1. **自动读取 llmdoc**：在执行任何操作前，先读取相关文档
2. **理解项目上下文**：快速获取高密度信息
3. **遵守开发约束**：自动遵守 `development-constraints.md` 中的规范
4. **自动更新文档**：代码变更后自动同步文档

## 📖 文档维护

### 手动更新

如果需要手动更新文档：

```bash
# 在 Claude Code 中
/update-doc
```

### 文档规范

- **高密度信息**：为 LLM 优化，信息密度高
- **人类可读**：同时保持人类可读性
- **结构化**：遵循 Diataxis 框架
- **自动同步**：代码变更后自动更新

## 🔗 相关资源

### 项目文档
- **项目 CLAUDE.md**：`/Volumes/tantan/AI_project/home-decoration/CLAUDE.md`
- **开发指南**：`docs/CLAUDE_DEV_GUIDE.md`
- **故障排除**：`docs/TROUBLESHOOTING.md`

### 编码规范
- **Go 规范**：`.claude/rules/go-standards.md`
- **React 规范**：`.claude/rules/react-standards.md`
- **安全指南**：`.claude/rules/security.md`

### 外部资源
- **cc-plugin**：https://github.com/TokenRollAI/cc-plugin
- **Claude Code**：https://claude.ai/code

## ⚠️ 重要提示

### 必读文档（P0 优先级）

在修改任何代码前，**必须**阅读：

1. [overview/development-constraints.md](overview/development-constraints.md) - 开发约束
2. [architecture/backend-layers.md](architecture/backend-layers.md) - 后端分层架构（如果修改后端）
3. [overview/tech-stack.md](overview/tech-stack.md) - 技术栈版本约束

### 关键约束

- **文件命名**：Go 用 `snake_case`，React 用 `PascalCase`
- **React 版本**：Admin/Mini 用 18.3.1，Mobile 用 19.2.0
- **分层架构**：Handler → Service → Repository
- **托管支付**：必须使用事务 + 悲观锁
- **安全规范**：参数化查询、密码哈希、敏感数据加密

## 📊 文档状态

- **创建日期**：2026-01-26
- **维护方式**：cc-plugin 自动维护
- **覆盖率**：核心模块 100%
- **更新频率**：代码变更时自动更新

## 🎯 下一步

1. 阅读 [index.md](index.md) 开始探索
2. 根据任务选择对应的指南
3. 使用 `/investigate` 快速理解代码
4. 使用 `/update-doc` 保持文档同步

---

**Happy Coding! 🚀**
