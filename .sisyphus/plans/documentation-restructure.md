# 项目文档重构工作计划

**版本**: 1.0  
**日期**: 2026-01-25  
**规划者**: Prometheus  
**审查者**: 用户确认

---

## Context

### Original Request
用户希望创建一套全新的、结构清晰的项目文档体系，让任何开发人员都能快速了解项目。

### Interview Summary
**Key Discussions**:
- 新建 `documentation/` 目录，不删除现有 `docs/`
- 树状结构，按数字编号分类
- 只整合最新、有效的内容
- 仅中文版本
- API 文档使用 Markdown 格式

**Research Findings**:
- 现有文档 60 篇，35% 最新，40% 缺少时间戳
- 项目正在从腾讯云 IM 迁移到 Tinode（85% 完成）
- React 版本分裂：Admin 18.3.1 / Mobile 19.2.0
- 核心文档：CLAUDE_DEV_GUIDE.md、技术架构设计总览.md、API接口文档.md

---

## Work Objectives

### Core Objective
创建一套结构清晰、内容最新的项目文档体系，让新开发者能在 1-2 小时内了解项目全貌。

### Concrete Deliverables
- `documentation/` 目录，包含 8 个分类、约 25 篇文档
- 清晰的导航入口 `documentation/README.md`
- 从现有文档整合的最新内容

### Definition of Done
- [ ] 创建 `documentation/` 目录结构
- [ ] 完成 01-项目概览（3 篇）
- [ ] 完成 02-快速开始（3 篇）
- [ ] 完成 03-产品设计（3 篇）
- [ ] 完成 04-后端开发（含 API 拆分，6 篇）
- [ ] 完成 05-前端开发（5 篇）
- [ ] 完成 06-即时通讯（4 篇）
- [ ] 完成 07-部署运维（4 篇）
- [ ] 完成 08-开发规范（3 篇）
- [ ] 所有文档可正常阅读，链接有效

### Must Have
- 清晰的目录结构
- 每篇文档有明确的更新时间
- 新人友好的阅读顺序
- 技术栈版本信息准确

### Must NOT Have (Guardrails)
- ❌ 不删除现有 `docs/` 目录
- ❌ 不包含过时信息（如已废弃的 WebSocket 自研方案）
- ❌ 不创建英文版本
- ❌ 不使用 Swagger/OpenAPI 格式

---

## Task Flow

```
Phase 1 (结构) ──> Phase 2 (概览) ──> Phase 3 (快速开始) ──> Phase 4 (产品)
                                                                    │
                                                                    v
Phase 8 (规范) <── Phase 7 (部署) <── Phase 6 (IM) <── Phase 5 (后端+前端)
```

---

## TODOs

### Task 1: 创建目录结构和总入口

**What to do**:
- 创建 `documentation/` 目录及所有子目录
- 创建 `documentation/README.md` 作为总入口
- 包含完整的目录导航和阅读指南

**References**:
- `docs/README.md` - 现有文档索引格式参考

**Acceptance Criteria**:
- [x] 目录结构创建完成
- [x] README.md 包含完整导航
- [x] 包含"新手阅读路径"指南

**Commit**: YES
- Message: `docs: create documentation structure and navigation`
- Files: `documentation/README.md`, 目录结构

---

### Task 2: 01-项目概览/项目简介.md

**What to do**:
- 编写项目简介：项目是什么、解决什么问题、目标用户
- 包含项目愿景和核心价值

**References**:
- `docs/产品需求文档(PRD).md` - 产品定位
- `PROJECT_STRUCTURE.md` - 项目结构

**Acceptance Criteria**:
- [x] 清晰说明项目定位
- [x] 包含目标用户说明
- [x] 新人能在 5 分钟内理解项目是什么

---

### Task 3: 01-项目概览/技术栈.md

**What to do**:
- 整理完整技术栈清单（后端、前端、数据库、部署）
- 明确版本号和版本约束
- 特别说明 React 版本分裂（Admin 18.3.1 / Mobile 19.2.0）

**References**:
- `docs/技术架构设计总览.md:16-100` - 技术栈详情
- `docs/CLAUDE_DEV_GUIDE.md:20-30` - 版本约束

**Acceptance Criteria**:
- [x] 所有技术栈版本准确
- [x] React 版本分裂有明确说明
- [x] 包含版本约束原因

---

### Task 4: 01-项目概览/项目结构.md

**What to do**:
- 说明 monorepo 结构
- 各子项目（server、admin、mobile、mini）的职责
- 目录结构树状图

**References**:
- `PROJECT_STRUCTURE.md` - 项目结构
- `AGENTS.md` - 各模块说明

**Acceptance Criteria**:
- [x] 清晰的目录树
- [x] 每个子项目职责明确
- [x] 新人能快速定位代码位置

---

### Task 5: 02-快速开始/环境准备.md

**What to do**:
- 开发环境要求（Node 20+, Go 1.21+, Docker）
- 必要工具安装指南
- 环境验证命令

**References**:
- `docs/CLAUDE_DEV_GUIDE.md` - 环境要求
- `docs/LOCAL_DEV_GUIDE.md` - 本地开发

**Acceptance Criteria**:
- [x] 环境要求清晰
- [x] 包含安装命令
- [x] 包含验证步骤

---

### Task 6: 02-快速开始/本地运行.md

**What to do**:
- Docker 启动方式
- 各端（server、admin、mobile）启动命令
- 访问地址和默认账号

**References**:
- `docs/LOCAL_DEV_GUIDE.md` - 本地开发
- `docs/LOCAL_RUN_GUIDE.md` - 运行指南

**Acceptance Criteria**:
- [x] 一键启动命令
- [x] 各端启动方式
- [x] 包含测试账号

---

### Task 7: 02-快速开始/常见问题.md

**What to do**:
- 从 TROUBLESHOOTING.md 提取新手常见问题
- 按类别分组（环境、构建、运行）
- 提供解决方案

**References**:
- `docs/TROUBLESHOOTING.md` - 问题排查

**Acceptance Criteria**:
- [x] 覆盖 Top 10 常见问题
- [x] 解决方案可操作
- [x] 按类别组织

---

### Task 8: 03-产品设计/功能模块.md

**What to do**:
- 产品功能清单
- 各模块状态（已完成/开发中/计划中）
- 功能优先级

**References**:
- `docs/产品需求文档(PRD).md` - 产品需求
- `docs/PENDING_TASKS.md` - 待办功能

**Acceptance Criteria**:
- [x] 功能清单完整
- [x] 状态标注准确
- [x] 反映最新开发进度

---

### Task 9: 03-产品设计/用户角色.md

**What to do**:
- 用户类型说明（业主、设计师、装修公司、工长、管理员）
- 各角色权限
- RBAC 权限模型简介

**References**:
- `docs/RBAC权限体系管理.md` - 权限体系
- `docs/产品需求文档(PRD).md` - 用户角色

**Acceptance Criteria**:
- [x] 所有用户角色说明
- [x] 权限矩阵清晰
- [x] 包含角色关系图

---

### Task 10: 03-产品设计/业务流程.md

**What to do**:
- 核心业务流程（项目发布→匹配→施工→验收）
- 资金托管流程
- 状态流转图

**References**:
- `docs/BUSINESS_FLOW.md` - 业务流程

**Acceptance Criteria**:
- [x] 核心流程清晰
- [x] 包含流程图
- [x] 状态说明完整

---

### Task 11: 04-后端开发/架构设计.md

**What to do**:
- 后端分层架构（handler → service → repository）
- 目录结构说明
- 代码组织规范

**References**:
- `docs/技术架构设计总览.md` - 后端架构
- `server/README.md` - 后端说明

**Acceptance Criteria**:
- [x] 分层架构清晰
- [x] 包含代码示例
- [x] 新人能理解代码组织

---

### Task 12: 04-后端开发/API接口/认证模块.md

**What to do**:
- 认证相关 API（登录、注册、验证码、Token 刷新）
- 请求/响应格式
- 错误码说明

**References**:
- `server/docs/API接口文档.md:57-200` - 认证模块

**Acceptance Criteria**:
- [x] API 列表完整
- [x] 请求/响应示例
- [x] 错误处理说明

---

### Task 13: 04-后端开发/API接口/用户模块.md

**What to do**:
- 用户/业主端 API
- 个人信息、项目管理等

**References**:
- `server/docs/API接口文档.md` - 用户模块

**Acceptance Criteria**:
- [x] API 列表完整
- [x] 请求/响应示例

---

### Task 14: 04-后端开发/API接口/商家模块.md

**What to do**:
- 商家端 API（设计师、装修公司、工长）
- 入驻、案例、服务等

**References**:
- `server/docs/API接口文档.md` - 商家模块

**Acceptance Criteria**:
- [x] API 列表完整
- [x] 请求/响应示例

---

### Task 15: 04-后端开发/API接口/项目模块.md

**What to do**:
- 项目管理 API
- 资金托管 API

**References**:
- `server/docs/API接口文档.md` - 项目模块

**Acceptance Criteria**:
- [x] API 列表完整
- [x] 请求/响应示例

---

### Task 16: 04-后端开发/API接口/聊天模块.md

**What to do**:
- Tinode 聊天相关 API
- 消息、图片、语音、在线状态

**References**:
- `server/docs/API接口文档.md` - 聊天模块
- `docs/TINODE_IM_INTEGRATION_GUIDE.md` - Tinode 集成

**Acceptance Criteria**:
- [x] API 列表完整
- [x] Tinode 集成说明

---

### Task 17: 04-后端开发/数据库设计.md

**What to do**:
- 数据库表结构
- 表关系说明
- 重要字段说明
- 从代码中提取 GORM 模型

**References**:
- `docs/DATABASE_MIGRATIONS.md` - 数据库变更
- `server/internal/model/` - GORM 模型

**Acceptance Criteria**:
- [x] 核心表结构完整
- [x] 表关系清晰
- [x] 字段说明准确

---

### Task 18: 05-前端开发/Admin端/架构说明.md

**What to do**:
- Admin 技术栈（React 18.3.1 + Ant Design）
- 目录结构
- 状态管理（Zustand）

**References**:
- `docs/技术架构设计总览.md:39-57` - Admin 技术栈
- `admin/README.md` - Admin 说明

**Acceptance Criteria**:
- [x] 技术栈准确
- [x] 目录结构清晰
- [x] 状态管理说明

---

### Task 19: 05-前端开发/Admin端/组件规范.md

**What to do**:
- Ant Design 使用规范
- 自定义组件说明
- 样式规范

**References**:
- `docs/UI_STANDARDS_MODAL.md` - UI 规范
- `admin/src/components/` - 组件代码

**Acceptance Criteria**:
- [x] 组件使用规范
- [x] 样式规范

---

### Task 20: 05-前端开发/Mobile端/架构说明.md

**What to do**:
- Mobile 技术栈（React Native 0.83 + React 19.2.0）
- 目录结构
- 导航结构（React Navigation）

**References**:
- `docs/技术架构设计总览.md:59-96` - Mobile 技术栈
- `mobile/README.md` - Mobile 说明

**Acceptance Criteria**:
- [x] 技术栈准确
- [x] 导航结构清晰
- [ ] React 19 特殊说明

---

### Task 21: 05-前端开发/Mobile端/原生模块.md

**What to do**:
- 原生模块使用（相机、图片选择、语音录制）
- 权限配置
- 平台差异

**References**:
- `mobile/README.md` - Mobile 说明
- `mobile/android/app/src/main/AndroidManifest.xml` - 权限配置

**Acceptance Criteria**:
- [x] 原生模块清单
- [x] 权限配置说明
- [x] 平台差异说明

---

### Task 22: 05-前端开发/Mini端/开发指南.md

**What to do**:
- 小程序技术栈（Taro）
- 当前状态（延后开发）
- 基本结构说明

**References**:
- `mini/README.md` - Mini 说明
- `docs/WECHAT_MINIPROGRAM_STATUS.md` - 小程序状态

**Acceptance Criteria**:
- [x] 技术栈说明
- [x] 当前状态标注
- [x] 基本结构

---

### Task 23: 06-即时通讯/架构说明.md

**What to do**:
- IM 系统架构（Tinode 为主，腾讯云 IM 为备）
- 选型原因
- 架构图

**References**:
- `docs/IM_SYSTEM_MIGRATION_ANALYSIS.md` - 迁移分析
- `docs/TINODE_IM_INTEGRATION_GUIDE.md` - Tinode 集成

**Acceptance Criteria**:
- [x] 架构清晰
- [x] 选型理由
- [x] 包含架构图

---

### Task 24: 06-即时通讯/Tinode集成.md

**What to do**:
- Tinode 集成指南
- SDK 使用
- 配置说明

**References**:
- `docs/TINODE_IM_INTEGRATION_GUIDE.md` - Tinode 集成

**Acceptance Criteria**:
- [x] 集成步骤清晰
- [x] SDK 使用说明
- [x] 配置完整

---

### Task 25: 06-即时通讯/功能实现.md

**What to do**:
- 消息功能（文本、图片、语音）
- 在线状态
- 打字指示器
- 消息已读

**References**:
- `docs/IM_IMPLEMENTATION_STATUS_2026.md` - 实现状态
- `.sisyphus/notepads/phase-4-voice-messages/` - 语音消息

**Acceptance Criteria**:
- [x] 功能清单完整
- [x] 实现状态准确
- [x] 包含代码示例

---

### Task 26: 06-即时通讯/迁移状态.md

**What to do**:
- 从腾讯云 IM 迁移到 Tinode 的进度
- 已完成/进行中/待完成
- 回滚方案

**References**:
- `docs/IM_IMPLEMENTATION_STATUS_2026.md` - 实现状态
- `.sisyphus/plans/tinode-chat-completion-v1.2.md` - 工作计划

**Acceptance Criteria**:
- [x] 迁移进度准确
- [x] 状态清晰
- [x] 回滚方案

---

### Task 27: 07-部署运维/部署指南.md

**What to do**:
- 生产环境部署流程
- 服务器要求
- 部署步骤

**References**:
- `docs/DEPLOYMENT_GUIDE_ZH.md` - 部署指南
- `docs/全栈部署指南.md` - 全栈部署

**Acceptance Criteria**:
- [x] 部署流程清晰
- [x] 步骤可操作
- [ ] 包含检查清单

---

### Task 28: 07-部署运维/Docker配置.md

**What to do**:
- Docker Compose 配置说明
- 各服务配置
- 数据持久化

**References**:
- `docker-compose.yml` - Docker 配置
- `deploy/README.md` - 部署说明

**Acceptance Criteria**:
- [x] 配置说明完整
- [x] 各服务说明
- [ ] 数据持久化

---

### Task 29: 07-部署运维/环境变量.md

**What to do**:
- 所有环境变量清单
- 必填/可选标注
- 默认值说明

**References**:
- `server/config.yaml.example` - 配置示例
- `.env.example` 文件

**Acceptance Criteria**:
- [x] 环境变量完整
- [x] 必填/可选标注
- [x] 默认值说明

---

### Task 30: 07-部署运维/版本发布.md

**What to do**:
- Git 工作流（dev/main 双分支）
- 版本发布流程
- 回滚方案

**References**:
- `docs/GIT_WORKFLOW.md` - Git 工作流
- `docs/版本发布与回滚指南.md` - 发布指南

**Acceptance Criteria**:
- [x] 工作流清晰
- [x] 发布步骤
- [x] 回滚方案

---

### Task 31: 08-开发规范/代码规范.md

**What to do**:
- Go 代码规范
- TypeScript/React 代码规范
- 命名规范

**References**:
- `docs/CLAUDE_DEV_GUIDE.md` - 开发约束
- `AGENTS.md` - 代码规范

**Acceptance Criteria**:
- [ ] Go 规范完整
- [ ] TS/React 规范完整
- [ ] 命名规范

---

### Task 32: 08-开发规范/Git工作流.md

**What to do**:
- 分支管理
- Commit 规范
- PR 流程

**References**:
- `docs/GIT_WORKFLOW.md` - Git 工作流

**Acceptance Criteria**:
- [ ] 分支策略清晰
- [ ] Commit 规范
- [ ] PR 流程

---

### Task 33: 08-开发规范/安全规范.md

**What to do**:
- 安全开发规范
- JWT 使用
- 密码处理
- SQL 注入防护

**References**:
- `docs/SECURITY.md` - 安全规范
- `SECURITY_QUICKSTART.md` - 安全快速指南

**Acceptance Criteria**:
- [ ] 安全规范完整
- [ ] 包含代码示例
- [ ] 常见漏洞防护

---

## Commit Strategy

| Phase | Message | Files |
|-------|---------|-------|
| 1 | `docs: create documentation structure` | documentation/ 目录结构 |
| 2-4 | `docs: add project overview section` | 01-项目概览/ |
| 5-7 | `docs: add quick start section` | 02-快速开始/ |
| 8-10 | `docs: add product design section` | 03-产品设计/ |
| 11-17 | `docs: add backend development section` | 04-后端开发/ |
| 18-22 | `docs: add frontend development section` | 05-前端开发/ |
| 23-26 | `docs: add instant messaging section` | 06-即时通讯/ |
| 27-30 | `docs: add deployment section` | 07-部署运维/ |
| 31-33 | `docs: add development standards section` | 08-开发规范/ |

---

## Success Criteria

### Final Checklist
- [ ] 所有 33 个任务完成
- [ ] documentation/README.md 导航完整
- [ ] 所有内部链接有效
- [ ] 新人能在 2 小时内了解项目
- [ ] 技术栈版本信息准确
- [ ] IM 系统状态（Tinode）准确

---

## Time Estimate

| Phase | Tasks | Time |
|-------|-------|------|
| Phase 1 | Task 1 | 30 min |
| Phase 2 | Tasks 2-4 | 1 hour |
| Phase 3 | Tasks 5-7 | 1 hour |
| Phase 4 | Tasks 8-10 | 1.5 hours |
| Phase 5 | Tasks 11-17 | 2.5 hours |
| Phase 6 | Tasks 18-22 | 2 hours |
| Phase 7 | Tasks 23-26 | 1.5 hours |
| Phase 8 | Tasks 27-30 | 1.5 hours |
| Phase 9 | Tasks 31-33 | 1 hour |
| **Total** | **33 tasks** | **~12.5 hours** |

---

## Plan Metadata

**Created**: 2026-01-25  
**Version**: 1.0  
**Status**: Ready for execution  
**Estimated Completion**: 2-3 days

---

**计划已就绪。运行 `/start-work` 开始执行。**
