# CCG-Workflow 实战场景指南

> 基于家装平台项目的实际使用场景

---

## 目录

1. [新增功能开发](#1-新增功能开发)
2. [Bug 修复](#2-bug-修复)
3. [性能优化](#3-性能优化)
4. [代码重构](#4-代码重构)
5. [文档更新](#5-文档更新)
6. [代码审核](#6-代码审核)
7. [测试编写](#7-测试编写)
8. [Git 操作](#8-git-操作)

---

## 1. 新增功能开发

### 场景 A: 复杂功能 (推荐 OpenSpec 流程)

**适用场景：**
- 涉及多个模块的功能
- 需要前后端协作
- 业务逻辑复杂
- 需要详细规划

**示例：实现 Tinode IM 集成**

```bash
# Step 1: 需求研究 → 约束集
/ccg:spec-research "实现 Tinode IM 集成，替换现有 WebSocket 聊天系统"

# 输出：openspec/changes/tinode-im-integration/
#   ├── proposal.md      # 变更提案
#   ├── tasks.md         # 任务清单
#   └── specs/           # 需求规范 (Delta 格式)

# Step 2: 审核提案 (人工)
# 查看 openspec/changes/tinode-im-integration/ 目录
# 确认需求理解正确，修改 specs/ 如有偏差

# Step 3: 生成实施计划
/ccg:spec-plan

# 输出：详细的实施计划，包含：
#   - 前端任务 (React Native, Taro, Admin)
#   - 后端任务 (Go API, 数据库迁移)
#   - 测试任务
#   - 部署任务

# Step 4: 执行实施
/ccg:spec-impl

# CCG 会自动：
#   - 前端任务路由到 Gemini
#   - 后端任务路由到 Codex
#   - Claude 负责审核和决策

# Step 5: 代码审核
/ccg:spec-review

# Step 6: 提交代码
/ccg:commit
```

**实际项目示例：**

```bash
# 示例 1: 添加托管支付功能
/ccg:spec-research "实现托管支付系统，支持分阶段付款和自动结算"
/ccg:spec-plan
/ccg:spec-impl
/ccg:spec-review
/ccg:commit

# 示例 2: 添加商家入驻审核流程
/ccg:spec-research "实现商家入驻审核流程，包含资质验证和人工审核"
/ccg:spec-plan
/ccg:spec-impl
```

---

### 场景 B: 简单功能 (快速开发)

**适用场景：**
- 单一模块的小功能
- 逻辑简单明确
- 不需要详细规划

**示例：添加用户头像上传**

```bash
# 方式 1: 使用 feat 命令 (自动路由)
/ccg:feat "添加用户头像上传功能，支持裁剪和压缩"

# 方式 2: 明确指定前端或后端
/ccg:frontend "在 Profile 页面添加头像上传组件"
/ccg:backend "添加头像上传 API 端点和文件存储"

# 方式 3: 使用完整工作流
/ccg:workflow "添加用户头像上传功能"
```

**实际项目示例：**

```bash
# 前端功能
/ccg:frontend "在 Admin 面板添加数据导出按钮"
/ccg:frontend "优化 Mobile 端项目进度时间轴显示"

# 后端功能
/ccg:backend "添加订单超时自动取消功能"
/ccg:backend "实现 Redis 缓存层"

# 全栈功能
/ccg:feat "添加用户收藏设计师功能"
```

---

## 2. Bug 修复

### 场景 A: 复杂 Bug (需要调试)

**适用场景：**
- 问题原因不明确
- 涉及多个模块
- 需要深入分析

**示例：修复托管账户竞态条件**

```bash
# Step 1: 调试分析
/ccg:debug "托管账户余额更新时出现竞态条件，导致余额不一致"

# CCG 会：
#   - 分析相关代码
#   - 识别潜在问题
#   - 提供诊断报告

# Step 2: 修复问题 (路由到后端)
/ccg:backend "修复托管账户竞态条件，使用悲观锁"

# Step 3: 代码审核
/ccg:review

# Step 4: 提交
/ccg:commit
```

**实际项目示例：**

```bash
# 后端 Bug
/ccg:debug "订单状态更新失败，事务回滚"
/ccg:backend "修复订单状态更新事务问题"

# 前端 Bug
/ccg:debug "Admin 面板数据表格分页异常"
/ccg:frontend "修复 Ant Design Table 分页问题"

# 全栈 Bug
/ccg:debug "WebSocket 连接频繁断开"
/ccg:workflow "修复 WebSocket 连接稳定性问题"
```

---

### 场景 B: 简单 Bug (直接修复)

**适用场景：**
- 问题原因明确
- 修复范围小
- 不需要调试

**示例：修复按钮样式错误**

```bash
# 直接修复
/ccg:frontend "修复 Profile 页面退出按钮样式错位"

# 或
/ccg:backend "修复用户登录时的密码验证逻辑"
```

---

## 3. 性能优化

### 场景 A: 前端性能优化

**适用场景：**
- React 组件渲染慢
- 页面加载慢
- 内存泄漏

**示例：优化 Admin 面板性能**

```bash
# 方式 1: 使用 optimize 命令
/ccg:optimize "优化 Admin 面板用户列表页面性能"

# 方式 2: 使用 frontend 命令
/ccg:frontend "优化 UserList 组件渲染性能，减少不必要的 re-render"

# 方式 3: 先分析再优化
/ccg:analyze "分析 Admin 面板性能瓶颈"
/ccg:frontend "根据分析结果优化性能"
```

**实际项目示例：**

```bash
# React 优化
/ccg:frontend "优化 ProviderCard 组件，使用 React.memo 和 useMemo"
/ccg:frontend "优化 Mobile 端图片加载，实现懒加载"

# 状态管理优化
/ccg:frontend "优化 Zustand store，减少不必要的状态更新"
```

---

### 场景 B: 后端性能优化

**适用场景：**
- API 响应慢
- 数据库查询慢
- 内存占用高

**示例：优化数据库查询**

```bash
# 方式 1: 使用 optimize 命令
/ccg:optimize "优化项目列表 API 的数据库查询性能"

# 方式 2: 使用 backend 命令
/ccg:backend "优化 GetProjects 查询，添加索引和分页"

# 方式 3: 先分析再优化
/ccg:analyze "分析后端 API 性能瓶颈"
/ccg:backend "根据分析结果优化数据库查询"
```

**实际项目示例：**

```bash
# 数据库优化
/ccg:backend "优化 escrow_accounts 表查询，添加复合索引"
/ccg:backend "实现 Redis 缓存，减少数据库查询"

# API 优化
/ccg:backend "优化 GetProviders API，使用 Preload 避免 N+1 查询"
```

---

## 4. 代码重构

### 场景 A: 大规模重构

**适用场景：**
- 架构调整
- 模块拆分
- 技术栈升级

**示例：重构认证系统**

```bash
# 使用 OpenSpec 流程
/ccg:spec-research "重构认证系统，统一 JWT 和 RefreshToken 逻辑"
/ccg:spec-plan
/ccg:spec-impl
/ccg:spec-review
```

---

### 场景 B: 局部重构

**适用场景：**
- 单个模块重构
- 代码清理
- 提取公共逻辑

**示例：重构用户服务**

```bash
# 使用 enhance 命令
/ccg:enhance "重构 user_service.go，提取公共验证逻辑"

# 或使用 backend 命令
/ccg:backend "重构 UserService，拆分为多个小函数"
```

---

## 5. 文档更新

### 场景 A: API 文档更新

**适用场景：**
- 新增 API 端点
- 修改 API 参数
- 更新 API 响应格式

**示例：更新 API 文档**

```bash
# 方式 1: 直接更新
# 使用 Claude Code 的 Edit 工具直接编辑文档

# 方式 2: 使用 feat 命令生成文档
/ccg:feat "为新增的托管支付 API 生成文档"
```

---

### 场景 B: 项目文档更新

**适用场景：**
- README 更新
- 开发指南更新
- 架构文档更新

**示例：更新 README**

```bash
# 直接使用 Claude Code 编辑
# 或使用 feat 命令
/ccg:feat "更新 README，添加 Tinode IM 集成说明"
```

---

## 6. 代码审核

### 场景 A: 提交前审核 (推荐)

**适用场景：**
- 完成功能开发后
- 提交代码前
- 确保代码质量

**示例：审核代码**

```bash
# 方式 1: 使用 review 命令
/ccg:review

# CCG 会：
#   - 分析 git diff
#   - 检查代码质量
#   - 识别潜在问题
#   - 提供改进建议

# 方式 2: 使用 spec-review (OpenSpec 流程)
/ccg:spec-review

# 方式 3: 审核特定文件
# 使用 Claude Code 直接审核
```

**实际项目示例：**

```bash
# 审核后端代码
/ccg:review  # 自动检测 Go 代码

# 审核前端代码
/ccg:review  # 自动检测 React 代码

# 审核安全性
# 使用项目内置的 /security-review 命令
```

---

### 场景 B: PR 审核

**适用场景：**
- 审核他人的 PR
- 代码 Review

**示例：审核 PR**

```bash
# 切换到 PR 分支
git checkout feature/tinode-im

# 审核代码
/ccg:review

# 提供反馈
```

---

## 7. 测试编写

### 场景 A: 单元测试

**适用场景：**
- 新增功能需要测试
- 修复 Bug 需要回归测试

**示例：编写单元测试**

```bash
# 方式 1: 使用 test 命令
/ccg:test "为 escrow_service.go 编写单元测试"

# 方式 2: 使用 backend/frontend 命令
/ccg:backend "为 EscrowService.Deposit 方法编写单元测试"
/ccg:frontend "为 UserCard 组件编写单元测试"
```

**实际项目示例：**

```bash
# 后端测试
/ccg:test "为 user_service.go 编写单元测试，覆盖率 80%+"
/ccg:test "为 escrow_service.go 编写事务测试"

# 前端测试
/ccg:test "为 Admin 面板 UserList 组件编写测试"
/ccg:test "为 Mobile 端 ChatRoom 组件编写测试"
```

---

### 场景 B: 集成测试

**适用场景：**
- 测试多个模块协作
- 测试 API 端点

**示例：编写集成测试**

```bash
# 使用 test 命令
/ccg:test "为托管支付流程编写集成测试"

# 或使用 backend 命令
/ccg:backend "编写托管支付 API 集成测试"
```

---

## 8. Git 操作

### 场景 A: 提交代码

**适用场景：**
- 完成功能开发
- 需要提交代码

**示例：智能提交**

```bash
# 方式 1: 使用 commit 命令 (推荐)
/ccg:commit

# CCG 会：
#   - 分析 git diff
#   - 生成规范的 commit message
#   - 自动 stage 相关文件
#   - 创建 commit

# 方式 2: 手动提交
git add .
git commit -m "feat: add user avatar upload"
```

**实际项目示例：**

```bash
# 功能提交
/ccg:commit  # 自动生成: "feat(im): integrate Tinode IM system"

# Bug 修复提交
/ccg:commit  # 自动生成: "fix(escrow): resolve race condition in balance update"

# 文档更新提交
/ccg:commit  # 自动生成: "docs: update API documentation"
```

---

### 场景 B: 分支管理

**适用场景：**
- 清理已合并分支
- 管理 worktree

**示例：清理分支**

```bash
# 清理已合并的本地分支
/ccg:clean-branches

# 管理 worktree
/ccg:worktree
```

---

### 场景 C: 回滚代码

**适用场景：**
- 提交错误需要回滚
- 撤销更改

**示例：回滚提交**

```bash
# 交互式回滚
/ccg:rollback

# CCG 会：
#   - 显示最近的提交
#   - 让你选择回滚方式 (reset/revert)
#   - 执行回滚
```

---

## 工作流决策树

```
开始
  │
  ├─ 新增功能？
  │   ├─ 复杂功能 → /ccg:spec-research → /ccg:spec-plan → /ccg:spec-impl
  │   └─ 简单功能 → /ccg:feat 或 /ccg:frontend 或 /ccg:backend
  │
  ├─ 修复 Bug？
  │   ├─ 需要调试 → /ccg:debug → /ccg:backend 或 /ccg:frontend
  │   └─ 直接修复 → /ccg:backend 或 /ccg:frontend
  │
  ├─ 性能优化？
  │   ├─ 需要分析 → /ccg:analyze → /ccg:optimize
  │   └─ 直接优化 → /ccg:optimize 或 /ccg:frontend 或 /ccg:backend
  │
  ├─ 代码重构？
  │   ├─ 大规模重构 → /ccg:spec-research → /ccg:spec-plan → /ccg:spec-impl
  │   └─ 局部重构 → /ccg:enhance 或 /ccg:backend 或 /ccg:frontend
  │
  ├─ 编写测试？
  │   └─ /ccg:test
  │
  ├─ 代码审核？
  │   └─ /ccg:review 或 /ccg:spec-review
  │
  └─ 提交代码？
      └─ /ccg:commit
```

---

## 最佳实践

### 1. 功能开发流程

```bash
# 推荐流程
/ccg:spec-research "功能描述"  # 需求分析
/ccg:spec-plan                 # 生成计划
/ccg:spec-impl                 # 实施开发
/ccg:test "编写测试"           # 编写测试
/ccg:review                    # 代码审核
/ccg:commit                    # 提交代码
```

### 2. Bug 修复流程

```bash
# 推荐流程
/ccg:debug "问题描述"          # 调试分析
/ccg:backend "修复问题"        # 修复代码
/ccg:test "编写回归测试"       # 编写测试
/ccg:review                    # 代码审核
/ccg:commit                    # 提交代码
```

### 3. 性能优化流程

```bash
# 推荐流程
/ccg:analyze "性能问题"        # 性能分析
/ccg:optimize "优化方案"       # 实施优化
/ccg:test "性能测试"           # 性能测试
/ccg:review                    # 代码审核
/ccg:commit                    # 提交代码
```

---

## 常见问题

### Q1: 什么时候使用 OpenSpec 流程？

**A:** 当功能满足以下条件时：
- 涉及多个模块 (前端 + 后端)
- 业务逻辑复杂
- 需要详细规划
- 需要团队协作

### Q2: 什么时候使用 /ccg:feat？

**A:** 当功能满足以下条件时：
- 单一模块的功能
- 逻辑简单明确
- 不需要详细规划
- 快速开发

### Q3: /ccg:frontend 和 /ccg:backend 的区别？

**A:**
- `/ccg:frontend`: 明确指定前端任务，路由到 Gemini
- `/ccg:backend`: 明确指定后端任务，路由到 Codex
- `/ccg:feat`: 自动判断任务类型，智能路由

### Q4: 是否每次都需要 /ccg:review？

**A:** 推荐每次提交前都进行代码审核，特别是：
- 复杂功能
- 关键业务逻辑
- 安全相关代码
- 性能敏感代码

### Q5: 如何选择合适的命令？

**A:** 参考上面的"工作流决策树"，根据任务类型选择合适的命令。

---

## 项目特定场景

### 场景 1: IM 系统迁移

```bash
# 当前状态：WebSocket → 目标：Tinode/腾讯云 IM
/ccg:spec-research "迁移 IM 系统从 WebSocket 到 Tinode"
/ccg:spec-plan
/ccg:spec-impl
/ccg:spec-review
/ccg:commit
```

### 场景 2: 托管支付功能

```bash
# 涉及金融交易，需要严格测试
/ccg:spec-research "实现托管支付系统"
/ccg:spec-plan
/ccg:spec-impl
/ccg:test "编写托管支付单元测试和集成测试"
/ccg:review  # 重点审核安全性
/ccg:commit
```

### 场景 3: 商家入驻审核

```bash
# 涉及多个角色和状态流转
/ccg:spec-research "实现商家入驻审核流程"
/ccg:spec-plan
/ccg:spec-impl
/ccg:test "编写审核流程测试"
/ccg:review
/ccg:commit
```

---

## 总结

### 命令选择速查表

| 场景 | 推荐命令 | 备注 |
|------|---------|------|
| 复杂功能开发 | `/ccg:spec-research` → `/ccg:spec-plan` → `/ccg:spec-impl` | OpenSpec 流程 |
| 简单功能开发 | `/ccg:feat` 或 `/ccg:frontend` 或 `/ccg:backend` | 快速开发 |
| 复杂 Bug 修复 | `/ccg:debug` → `/ccg:backend` 或 `/ccg:frontend` | 需要调试 |
| 简单 Bug 修复 | `/ccg:backend` 或 `/ccg:frontend` | 直接修复 |
| 前端性能优化 | `/ccg:optimize` 或 `/ccg:frontend` | React 优化 |
| 后端性能优化 | `/ccg:optimize` 或 `/ccg:backend` | 数据库/API 优化 |
| 代码重构 | `/ccg:enhance` 或 `/ccg:spec-research` | 根据规模选择 |
| 编写测试 | `/ccg:test` | 单元测试/集成测试 |
| 代码审核 | `/ccg:review` 或 `/ccg:spec-review` | 提交前必做 |
| 提交代码 | `/ccg:commit` | 智能生成 commit message |
| 分支清理 | `/ccg:clean-branches` | 清理已合并分支 |
| 代码回滚 | `/ccg:rollback` | 撤销提交 |

---

**记住：**
- 复杂任务用 OpenSpec 流程
- 简单任务用专项命令
- 提交前必须审核
- 关键功能必须测试

**下一步：** 开始使用 CCG-Workflow 开发你的第一个功能！
