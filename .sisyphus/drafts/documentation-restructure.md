# Draft: 项目文档重构计划

## Requirements (confirmed)
- **目标**: 创建一套全新的、结构清晰的项目文档体系
- **位置**: 新建 `documentation/` 目录，不删除现有 `docs/`
- **原则**: 只整合最新、有效的内容，标注过时文档
- **受众**: 任何新加入的开发人员都能快速上手

## 文档分析结果

### 现有文档状态统计
| 类别 | 数量 | 占比 |
|------|------|------|
| **CURRENT** (2026-01) | 21 篇 | 35% |
| **RECENT** (2025-12) | 12 篇 | 20% |
| **OUTDATED** (2024-12 / 2025-11) | 3 篇 | 5% |
| **UNKNOWN** (需审查) | 24 篇 | 40% |
| **总计** | 60 篇 | 100% |

### 关键发现
1. **IM 系统迁移**: 项目正在从腾讯云 IM 迁移到 Tinode（85% 完成）
2. **React 版本分裂**: Admin 使用 React 18.3.1，Mobile 使用 React 19.2.0
3. **文档分散**: 文档分布在 `docs/`、`server/docs/`、各子项目 README
4. **时间戳缺失**: 约 40% 的文档缺少明确的更新时间

### 核心文档（最新、可用）
| 文档 | 更新时间 | 状态 |
|------|----------|------|
| CLAUDE_DEV_GUIDE.md | 2026-01-07 | ✅ 核心 |
| TROUBLESHOOTING.md | 2026-01-21 | ✅ 核心 |
| 技术架构设计总览.md | 2025-12-29 | ✅ 核心 |
| API接口文档.md | 2026-01-17 | ✅ 核心 |
| LOCAL_DEV_GUIDE.md | 2026-01-17 | ✅ 核心 |
| DEPLOYMENT_GUIDE_ZH.md | 2026-01-17 | ✅ 核心 |
| TINODE_IM_INTEGRATION_GUIDE.md | 2026-01-22 | ✅ 新增 |
| IM_IMPLEMENTATION_STATUS_2026.md | 2026-01-23 | ✅ 新增 |

### 过时文档
| 文档 | 问题 |
|------|------|
| 产品需求文档(PRD).md | 2024-12 创建，未反映 Tinode 迁移 |
| 文档目录说明.md | 已被 README.md 替代 |
| IM_WORKPLAN_2026.md | 空文件 |

## 新文档结构设计

```
documentation/                    # 新的文档根目录
├── README.md                     # 文档总入口（导航页）
│
├── 01-项目概览/
│   ├── 项目简介.md              # 项目是什么、解决什么问题
│   ├── 技术栈.md                # 使用的技术和版本（含 React 版本说明）
│   └── 项目结构.md              # monorepo 结构说明
│
├── 02-快速开始/
│   ├── 环境准备.md              # 开发环境要求（Node 20+, Go 1.21+）
│   ├── 本地运行.md              # 如何启动项目（Docker + 各端）
│   └── 常见问题.md              # 新手常见问题（从 TROUBLESHOOTING 提取）
│
├── 03-产品设计/
│   ├── 功能模块.md              # 产品功能清单
│   ├── 用户角色.md              # 用户类型和权限（业主、设计师、工长等）
│   └── 业务流程.md              # 核心业务流程（项目流程、资金托管）
│
├── 04-后端开发/
│   ├── 架构设计.md              # 后端架构（handler→service→repository）
│   ├── API接口/
│   │   ├── 认证模块.md          # Auth API
│   │   ├── 用户模块.md          # User API
│   │   ├── 商家模块.md          # Merchant API
│   │   ├── 项目模块.md          # Project API
│   │   └── 聊天模块.md          # Chat API (Tinode)
│   └── 数据库设计.md            # 表结构、ER图、字段说明
│
├── 05-前端开发/
│   ├── Admin端/
│   │   ├── 架构说明.md          # React 18.3.1 + Ant Design
│   │   ├── 状态管理.md          # Zustand 使用
│   │   └── 组件规范.md          # 组件开发规范
│   ├── Mobile端/
│   │   ├── 架构说明.md          # React Native 0.83 + React 19.2.0
│   │   ├── 导航结构.md          # React Navigation
│   │   └── 原生模块.md          # 相机、图片选择等
│   └── Mini端/
│       └── 开发指南.md          # Taro 小程序（状态：延后）
│
├── 06-即时通讯/
│   ├── 架构说明.md              # Tinode 为主，腾讯云 IM 为备
│   ├── Tinode集成.md            # Tinode 集成指南
│   ├── 功能实现.md              # 消息、图片、语音、在线状态
│   └── 迁移状态.md              # 从腾讯云 IM 迁移进度
│
├── 07-部署运维/
│   ├── 部署指南.md              # 如何部署到生产
│   ├── Docker配置.md            # Docker Compose 配置
│   ├── 环境变量.md              # 配置项说明
│   └── 版本发布.md              # Git 工作流、发布流程
│
└── 08-开发规范/
    ├── 代码规范.md              # Go/TypeScript 编码规范
    ├── Git工作流.md             # 分支管理（dev/main）
    └── 安全规范.md              # 安全相关（JWT、密码、SQL注入）
```

## 内容来源映射

| 新文档 | 来源 |
|--------|------|
| 01-项目概览/项目简介.md | 新编写 + PROJECT_STRUCTURE.md |
| 01-项目概览/技术栈.md | 技术架构设计总览.md (1.1节) |
| 01-项目概览/项目结构.md | PROJECT_STRUCTURE.md + AGENTS.md |
| 02-快速开始/环境准备.md | CLAUDE_DEV_GUIDE.md + LOCAL_DEV_GUIDE.md |
| 02-快速开始/本地运行.md | LOCAL_DEV_GUIDE.md + LOCAL_RUN_GUIDE.md |
| 02-快速开始/常见问题.md | TROUBLESHOOTING.md (精选) |
| 03-产品设计/功能模块.md | 产品需求文档(PRD).md (更新) |
| 03-产品设计/用户角色.md | RBAC权限体系管理.md |
| 03-产品设计/业务流程.md | BUSINESS_FLOW.md |
| 04-后端开发/架构设计.md | 技术架构设计总览.md (后端部分) |
| 04-后端开发/API接口/*.md | server/docs/API接口文档.md (拆分) |
| 04-后端开发/数据库设计.md | DATABASE_MIGRATIONS.md + 代码分析 |
| 05-前端开发/Admin端/*.md | 技术架构设计总览.md + 代码分析 |
| 05-前端开发/Mobile端/*.md | 技术架构设计总览.md + mobile/README.md |
| 06-即时通讯/*.md | TINODE_IM_INTEGRATION_GUIDE.md + IM_IMPLEMENTATION_STATUS_2026.md |
| 07-部署运维/*.md | DEPLOYMENT_GUIDE_ZH.md + 全栈部署指南.md |
| 08-开发规范/*.md | CLAUDE_DEV_GUIDE.md + GIT_WORKFLOW.md + SECURITY.md |

## 工作量估算

| 阶段 | 任务 | 预计时间 |
|------|------|----------|
| Phase 1 | 创建目录结构 + README | 30 分钟 |
| Phase 2 | 01-项目概览（3篇） | 1 小时 |
| Phase 3 | 02-快速开始（3篇） | 1 小时 |
| Phase 4 | 03-产品设计（3篇） | 1.5 小时 |
| Phase 5 | 04-后端开发（API拆分+数据库） | 2 小时 |
| Phase 6 | 05-前端开发（Admin+Mobile+Mini） | 2 小时 |
| Phase 7 | 06-即时通讯（Tinode整合） | 1.5 小时 |
| Phase 8 | 07-部署运维（4篇） | 1 小时 |
| Phase 9 | 08-开发规范（3篇） | 1 小时 |
| **总计** | **约 25 篇文档** | **~11.5 小时** |

## 决策记录

### 已确认
- ✅ 新建 `documentation/` 目录，不删除 `docs/`
- ✅ 树状结构，按数字编号
- ✅ 只整合最新内容
- ✅ 标注过时文档

### 待确认
- 是否需要英文版本？
- API 文档是否需要 Swagger/OpenAPI 格式？
- 数据库 ER 图用什么工具生成？

## 下一步
1. 用户确认计划
2. 生成详细工作计划到 `.sisyphus/plans/`
3. 执行文档整理
