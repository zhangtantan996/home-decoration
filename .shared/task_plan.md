# 项目全面分析任务计划

## 任务目标
对家装平台项目进行全面的代码库分析和理解，生成完整的项目分析文档，每次更新时保持文档同步。

## 分析范围确认
- ✅ `server/` - Go 后端 API
- ✅ `admin/` - React Admin 管理面板
- ✅ `mobile/` - React Native 移动端
- ⚠️ `mini/` - 小程序（待确认是否纳入）
- ✅ `deploy/` - 部署配置
- ✅ `docs/` - 项目文档

## 任务阶段

### Phase 1: 文档优先级阅读 (P0)
**Status**: completed ✅
**完成时间**: 2026-01-10
**目标**: 理解系统的官方定义和核心约束
**关键文件**:
- [x] `docs/README.md` - 文档索引
- [x] `docs/CLAUDE_DEV_GUIDE.md` - 开发约束（最高优先级）
- [x] `docs/TROUBLESHOOTING.md` - 已知问题
- [x] `docs/SECURITY.md` / `SECURITY_QUICKSTART.md` - 安全规范
- [x] `CLAUDE.md` - 项目说明
**输出**: `findings.md` - 第1章：项目概览与技术栈 ✅

### Phase 2: 后端架构分析 (P1)
**Status**: completed (骨架) ✅ → 待端到端深入
**完成时间**: 2026-01-10
**目标**: 理解后端分层架构和业务链路
**关键路径**: `main.go → router.go → handler → service → repository → model`
**重点分析**:
- [x] `server/cmd/api/main.go` - 入口和依赖初始化
- [x] `server/internal/router/router.go` - 路由定义
- [ ] 端到端业务链路分析（待选择）
- [ ] `server/internal/handler/` - HTTP 处理器
- [ ] `server/internal/service/` - 业务逻辑层
- [ ] `server/internal/repository/` - 数据访问层
- [ ] `server/internal/model/` - 数据模型
- [ ] `server/internal/middleware/` - 中间件（CORS, JWT, RBAC）
- [ ] `server/internal/ws/` - WebSocket 实现
**输出**: `findings.md` - 第2章：后端架构设计（骨架完成，295行）

### Phase 3: 数据库设计分析 (P2)
**Status**: pending
**目标**: 梳理数据模型、迁移策略和缓存使用
**重点分析**:
- [ ] `server/internal/model/model.go` - 核心实体模型
- [ ] `server/scripts/migrations/` - 数据库迁移脚本
- [ ] `server/internal/repository/database.go` - 数据库连接
- [ ] `server/internal/repository/redis.go` - Redis 使用
**输出**: `findings.md` - 第3章：数据库设计和关键模型

### Phase 4: Admin 面板架构分析 (P3)
**Status**: pending
**目标**: 理解管理后台的权限体系和页面模块
**重点分析**:
- [ ] `admin/src/router.tsx` - 路由定义
- [ ] `admin/src/stores/authStore.ts` - 权限状态管理
- [ ] `admin/src/services/api.ts` - API 封装
- [ ] `admin/src/pages/` - 核心业务页面
- [ ] `admin/src/layouts/BasicLayout.tsx` - 布局和菜单
**输出**: `findings.md` - 第4章：Admin 架构与权限体系

### Phase 5: Mobile 应用架构分析 (P4)
**Status**: pending
**目标**: 理解移动端导航、状态管理和关键页面
**重点分析**:
- [ ] `mobile/App.tsx` - 应用入口
- [ ] `mobile/src/navigation/AppNavigator.tsx` - 导航结构
- [ ] `mobile/src/stores/` - 状态管理
- [ ] `mobile/src/services/api.ts` - API 封装
- [ ] `mobile/src/screens/` - 核心页面
**输出**: `findings.md` - 第5章：Mobile 架构设计

### Phase 6: 部署与配置分析 (P5)
**Status**: pending
**目标**: 理解部署架构和配置管理
**重点分析**:
- [ ] `docker-compose.yml` / `docker-compose.local.yml` - 本地开发
- [ ] `deploy/docker-compose.prod.yml` - 生产部署
- [ ] `deploy/Dockerfile.*` - 容器构建
- [ ] `server/config.yaml` / `config.docker.yaml` - 配置文件
**输出**: `findings.md` - 第6章：部署与配置管理

### Phase 7: 核心业务流程分析
**Status**: pending
**目标**: 梳理关键业务流程和状态机
**关键流程**:
- [ ] 用户注册与认证流程
- [ ] 服务商入驻与审核流程
- [ ] 预约（Booking）流程
- [ ] 方案（Proposal）流程
- [ ] 项目（Project）管理流程
- [ ] 托管支付（Escrow）流程
- [ ] WebSocket 聊天流程
**输出**: `findings.md` - 第7章：核心业务流程

### Phase 8: 安全与权限分析
**Status**: pending
**目标**: 分析安全机制和 RBAC 实现
**重点分析**:
- [ ] JWT 认证机制
- [ ] RBAC 权限体系
- [ ] 敏感数据加密
- [ ] API 限流和安全中间件
**输出**: `findings.md` - 第8章：安全与权限机制

### Phase 9: 测试与质量保障
**Status**: pending
**目标**: 了解测试策略和质量保障机制
**重点分析**:
- [ ] `test_security.ps1/sh` - 安全测试脚本
- [ ] E2E 测试配置
- [ ] API 测试覆盖
**输出**: `findings.md` - 第9章：测试与质量保障

### Phase 10: 生成最终分析文档
**Status**: pending
**目标**: 整合所有发现，生成结构化分析文档
**输出**:
- `PROJECT_ANALYSIS.md` - 完整项目分析文档
- API 端点清单
- 数据库表清单
- 权限点清单

## 当前进度
- 总进度: 1/10 (10%)
- 当前阶段: Phase 2 - 后端架构分析

## 错误记录
| 错误 | 尝试次数 | 解决方案 |
|------|---------|---------|
| - | - | - |

## 决策记录
| 决策点 | 选择 | 理由 |
|--------|------|------|
| 分析范围 | 暂不包含 mini/ | 待用户确认小程序是否在范围内 |
| 分析优先级 | 采用 Codex 建议的 P0-P5 | 从最能解释系统到细节逐步深入 |

## 更新历史
- 2026-01-10: 创建任务计划，定义 10 个分析阶段
