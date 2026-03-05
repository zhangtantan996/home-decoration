# Home Decoration Platform - llmdoc Index

> 装修设计一体化平台 - AI 优化的项目文档索引

## 🎯 Quick Start

**新手必读**：
1. 阅读 [项目概览](overview/project-overview.md) 了解整体架构
2. 查看 [技术栈](overview/tech-stack.md) 了解技术选型
3. 根据你的角色选择对应的指南：
   - 后端开发：[添加 API 端点](guides/backend-add-api.md)
   - 前端开发：[添加页面](guides/frontend-add-page.md)
   - 全栈开发：[完整功能开发](guides/full-feature-workflow.md)

## 📖 文档结构

### Overview（概览）
- [项目概览](overview/project-overview.md) - 项目定位、核心功能、用户角色
- [技术栈](overview/tech-stack.md) - 技术选型、版本约束、依赖关系
- [业务逻辑](overview/business-logic.md) - 核心业务流程、关键概念
- [开发约束](overview/development-constraints.md) - 必须遵守的开发规范

### Guides（操作指南）
- [后端：添加 API 端点](guides/backend-add-api.md)
- [前端：添加 Admin 页面](guides/frontend-add-page.md)
- [移动端：添加 React Native 屏幕](guides/mobile-add-screen.md)
- [小程序：添加 Taro 页面](guides/mini-add-page.md)
- [数据库：添加模型和迁移](guides/database-add-model.md)
- [完整功能开发流程](guides/full-feature-workflow.md)

### Architecture（架构设计）
- [后端分层架构](architecture/backend-layers.md) - Handler → Service → Repository
- [前端路由架构](architecture/frontend-routing.md) - Admin/Mobile/Mini 路由设计
- [托管支付系统](architecture/escrow-system.md) - 资金流转、事务管理
- [认证授权系统](architecture/auth-system.md) - JWT、RBAC、微信登录
- [多身份切换系统](architecture/identity-system.md) - 一账户多身份、身份切换、审计日志
- [IM 系统迁移](architecture/im-migration.md) - WebSocket → Tinode/腾讯云 IM
- [数据库设计](architecture/database-schema.md) - 表结构、关系、索引

### Reference（参考文档）
- [API 端点列表](reference/api-endpoints.md)
- [数据库模型](reference/database-models.md)
- [环境变量](reference/environment-variables.md)
- [中间件列表](reference/middlewares.md)
- [定时任务](reference/cron-jobs.md)
- [错误代码](reference/error-codes.md)

## 🚨 关键约束（必读）

### 文件命名规范
- **Go 文件**：`snake_case`（如 `user_service.go`）
- **React 组件**：`PascalCase`（如 `UserList.tsx`）

### React 版本策略
- **Admin Panel**：React 18.3.1（Ant Design 兼容性）
- **Mobile App**：React 19.2.0（React Native 0.83）
- **WeChat Mini**：React 18.3.1（Taro 3.x 要求）

### 安全约束
- 所有 Escrow 操作必须使用事务 + 悲观锁
- 所有 GORM 查询必须使用参数化查询
- 密码必须使用 bcrypt 哈希
- 敏感数据使用 AES 加密存储

### 架构约束
- Handler 层只处理 HTTP 请求/响应
- Service 层包含所有业务逻辑
- Repository 层只做数据访问
- 禁止跨层调用

## 🔄 文档维护

本文档由 cc-plugin 自动维护，每次代码变更后会同步更新。

**手动更新**：使用 `/update-doc` 命令
**查看文档**：使用 `/read-doc` 命令
**快速调查**：使用 `/investigate` 命令

## 📞 相关资源

- **项目 CLAUDE.md**：`/Volumes/tantan/AI_project/home-decoration/CLAUDE.md`
- **开发指南**：`docs/CLAUDE_DEV_GUIDE.md`
- **故障排除**：`docs/TROUBLESHOOTING.md`
- **API 文档**：`docs/API_DOCUMENTATION.md`

---

**最后更新**：2026-01-26
**维护者**：cc-plugin + Claude Code
