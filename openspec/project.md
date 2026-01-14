# Project Context

## Purpose
家装平台 (Home Decoration Platform) - 连接业主、设计师和工长的综合性家装服务平台

## Tech Stack

### Backend
- **Language**: Go 1.23
- **Framework**: Gin
- **Database**: PostgreSQL 15 + Redis
- **ORM**: GORM

### Admin Panel
- **Framework**: React 18.3.1 (锁定版本)
- **Build Tool**: Vite
- **UI Library**: Ant Design 5.x + Ant Design Pro Components
- **State Management**: Zustand
- **Language**: TypeScript

### Mobile App
- **Framework**: React Native 0.83 + React 19.2.0
- **Target**: iOS, Android, Web
- **State Management**: Zustand
- **Navigation**: React Navigation
- **Language**: TypeScript

## Project Conventions

### Code Style
- **Go**: snake_case 文件名, gofmt 格式化
- **TypeScript**: 
  - 组件文件: PascalCase.tsx
  - 工具文件: camelCase.ts
  - Prettier 格式化

### Architecture Patterns
- **Backend**: 分层架构 (Handler → Service → Repository → Model)
- **Frontend**: 组件化架构 + Zustand 状态管理
- **API**: RESTful API (`/api/v1/`)
- **路由**: Admin Panel 使用 `/admin` 前缀

### Testing Strategy
- **Backend**: 单元测试 (Go test)
- **Frontend**: 组件测试
- **目标覆盖率**: ≥90% (使用 MyClaude 时强制)

### Git Workflow
- **分支策略**: 
  - `main` - 生产环境
  - `dev` - 开发环境
- **Commit 规范**: `<type>(<scope>): <subject>`
  - feat: 新功能
  - fix: Bug 修复
  - refactor: 重构
  - docs: 文档更新

## Domain Context
- **用户角色**: 业主、设计师、工长、管理员
- **核心功能**: 
  - 用户认证 (JWT)
  - 设计师/工长管理
  - 案例展示
  - 聊天系统 (WebSocket)
  - 托管交易

## Important Constraints
- **React 版本**: Admin Panel 必须使用 React 18.3.1 (不兼容 React 19)
- **UI 库**: 禁止混用多个 UI 库 (已使用 Ant Design)
- **数据库**: 已有 PostgreSQL schema,迁移需要 migration 脚本
- **部署**: Docker + Nginx

## External Dependencies
- **阿里云 OSS**: 文件存储
- **腾讯云 IM**: 聊天功能
- **高德地图**: 地理位置服务
