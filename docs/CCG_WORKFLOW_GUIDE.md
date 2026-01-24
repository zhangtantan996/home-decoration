# CCG-Workflow 使用指南

> 多模型 AI 协作开发系统 - Claude + Codex + Gemini

---

## 安装状态

### ✅ 已安装组件

| 组件 | 版本 | 状态 |
|------|------|------|
| **ccg-workflow** | v1.7.50 | ✅ 已安装 |
| **OpenSpec CLI** | v0.23.0 | ✅ 已安装 |
| **codeagent-wrapper** | v5.7.1 | ✅ 已安装 |
| **Codex backend** | - | ✅ 可用 |
| **Gemini backend** | - | ⚠️ 需要配置 API Key |
| **ace-tool MCP** | - | ⚠️ 可选 (需要 Token) |

### 配置位置

- **全局命令**: `~/.claude/commands/ccg/` (22 个命令)
- **二进制文件**: `~/.claude/bin/codeagent-wrapper`
- **项目配置**: `.claude/settings.local.json`
- **OpenSpec 目录**: `openspec/` (已存在)

---

## 核心理念

### 多模型协作架构

```
Claude Code (编排器)
     │
 ┌───┴───┐
 ↓       ↓
Codex   Gemini
(后端)   (前端)
 │       │
 └───┬───┘
     ↓
Unified Patch (Claude 审核后应用)
```

**关键特性：**
- ✅ Claude 负责编排决策和代码审核
- ✅ Codex 处理后端任务 (Go, API, 数据库)
- ✅ Gemini 处理前端任务 (React, UI, 样式)
- ✅ 外部模型无写入权限，只返回 Patch
- ✅ 规划与执行分离，可跨会话

---

## 可用命令 (22 个)

### 1. 工作流命令

#### `/ccg:workflow` - 完整 6 阶段工作流
```bash
# 适用场景：复杂功能开发，需要完整流程
# 包含：需求分析 → 规划 → 实现 → 测试 → 审核 → 提交
```

#### `/ccg:plan` - 多模型协作规划 (Phase 1-2)
```bash
# 适用场景：制定实现计划，生成任务清单
# 输出：保存到 .claude/plan/ 目录
```

#### `/ccg:execute` - 多模型协作执行 (Phase 3-5)
```bash
# 适用场景：执行已批准的计划
# 可在新会话中运行（规划与执行分离）
```

---

### 2. 开发命令

#### `/ccg:feat` - 功能开发
```bash
# 适用场景：新功能开发，自动路由到合适的模型
# 示例：/ccg:feat "Add user profile editing"
```

#### `/ccg:frontend` - 前端专项
```bash
# 适用场景：React/UI 优化，路由到 Gemini
# 示例：/ccg:frontend "Optimize Admin panel performance"
```

#### `/ccg:backend` - 后端专项
```bash
# 适用场景：Go/API 开发，路由到 Codex
# 示例：/ccg:backend "Fix escrow race condition"
```

#### `/ccg:analyze` - 代码分析
```bash
# 适用场景：代码质量分析，架构评估
```

#### `/ccg:debug` - 调试
```bash
# 适用场景：Bug 排查，错误诊断
```

#### `/ccg:optimize` - 性能优化
```bash
# 适用场景：性能瓶颈分析和优化
```

#### `/ccg:test` - 测试
```bash
# 适用场景：生成和运行测试
```

#### `/ccg:review` - 代码审核
```bash
# 适用场景：代码审核，安全检查
```

#### `/ccg:enhance` - 增强
```bash
# 适用场景：代码改进，重构建议
```

#### `/ccg:init` - 初始化
```bash
# 适用场景：项目初始化，脚手架生成
```

---

### 3. Git 工具

#### `/ccg:commit` - 智能提交
```bash
# 适用场景：生成规范的 commit message
```

#### `/ccg:rollback` - 回滚
```bash
# 适用场景：撤销提交，恢复代码
```

#### `/ccg:clean-branches` - 清理分支
```bash
# 适用场景：删除已合并的本地分支
```

#### `/ccg:worktree` - Worktree 管理
```bash
# 适用场景：管理 Git worktree
```

---

### 4. OpenSpec 集成 (推荐)

#### `/ccg:spec-init` - 初始化 OpenSpec 环境
```bash
# 功能：
# - 检查 OpenSpec CLI 安装
# - 验证多模型 MCP 工具
# - 生成状态报告
```

#### `/ccg:spec-research` - 需求研究 → 约束集
```bash
# 功能：
# - 将需求转化为结构化约束
# - 多模型并行分析
# - 防止 AI 自由发挥
```

#### `/ccg:spec-plan` - 生成零决策计划
```bash
# 功能：
# - 并行分析需求
# - 生成详细实现计划
# - 无需人工决策
```

#### `/ccg:spec-impl` - 执行计划
```bash
# 功能：
# - 多模型协作实现
# - 按照批准的规范编码
# - 自动路由任务
```

#### `/ccg:spec-review` - 独立审核
```bash
# 功能：
# - 代码审核
# - 规范符合性检查
# - 生成审核报告
```

---

## 使用场景示例

### 场景 1：新功能开发 (推荐使用 OpenSpec 流程)

```bash
# Step 1: 需求研究
/ccg:spec-research "Add Tinode IM integration"

# Step 2: 生成计划
/ccg:spec-plan

# Step 3: 审核计划 (人工)
# 查看 openspec/changes/ 目录下的提案

# Step 4: 执行实现
/ccg:spec-impl

# Step 5: 代码审核
/ccg:spec-review

# Step 6: 提交代码
/ccg:commit
```

### 场景 2：前端性能优化

```bash
# 直接使用前端专项命令
/ccg:frontend "Optimize Admin panel React component rendering"

# 或使用完整工作流
/ccg:workflow "Optimize Admin panel performance"
```

### 场景 3：后端 Bug 修复

```bash
# 使用后端专项命令
/ccg:backend "Fix race condition in escrow service"

# 或先调试再修复
/ccg:debug "Investigate escrow race condition"
/ccg:backend "Apply fix for escrow race condition"
```

### 场景 4：代码审核和优化

```bash
# 代码审核
/ccg:review

# 性能分析
/ccg:analyze

# 优化建议
/ccg:optimize
```

---

## 配置 Gemini Backend (可选)

### 方式 1: 使用 Google 官方 API

```bash
# 方法 1: 环境变量
export GEMINI_API_KEY="your-api-key"

# 方法 2: .env 文件
echo "GEMINI_API_KEY=your-api-key" >> ~/.gemini/.env

# 验证
~/.claude/bin/codeagent-wrapper --backend gemini - "$PWD" <<< "echo test"
```

**获取 API Key:**
- Google AI Studio: https://makersuite.google.com/app/apikey

---

### 方式 2: 使用自定义端点 (本地代理/CCSwitch)

✅ **Gemini CLI 支持自定义 API endpoint**，可以配合本地代理服务使用。

#### 配置步骤

**1. 创建配置文件** (推荐)

```bash
# 创建 Gemini 配置目录
mkdir -p ~/.gemini

# 编辑配置文件
cat > ~/.gemini/.env << 'EOF'
# 自定义 API 端点 (你的 CCSwitch 或本地代理地址)
GOOGLE_GEMINI_BASE_URL="http://localhost:8000"

# API Key (如果本地服务需要)
GEMINI_API_KEY="your-api-key-or-local"

# 模型名称
GEMINI_MODEL="gemini-2.5-pro"
EOF
```

**2. 或使用环境变量**

```bash
# 添加到 ~/.zshrc 或 ~/.bashrc
export GOOGLE_GEMINI_BASE_URL="http://localhost:8000"
export GEMINI_API_KEY="local"
export GEMINI_MODEL="gemini-2.5-pro"

# 重新加载配置
source ~/.zshrc
```

**3. 验证配置**

```bash
# 重启终端后测试
gemini "你好，请介绍一下自己"

# 或使用 codeagent-wrapper 测试
~/.claude/bin/codeagent-wrapper --backend gemini - "$PWD" <<< "echo test"
```

#### 常见本地端点配置

```bash
# 本地代理服务 (如 CCSwitch)
GOOGLE_GEMINI_BASE_URL="http://localhost:8000"

# 本地 LLM 服务 (如 Ollama + OpenAI 兼容层)
GOOGLE_GEMINI_BASE_URL="http://localhost:11434/v1"

# 自建 API 网关
GOOGLE_GEMINI_BASE_URL="http://your-gateway.local:8080"
```

#### 故障排除

```bash
# 问题 1: 配置不生效
# 解决：确认配置文件路径
ls -la ~/.gemini/.env

# 清除缓存
rm -rf ~/.gemini/.cache

# 验证环境变量
echo $GOOGLE_GEMINI_BASE_URL

# 问题 2: 连接失败
# 检查本地服务是否运行
curl http://localhost:8000/health

# 问题 3: API Key 错误
# 如果本地服务不需要 API Key，可以设置为任意值
GEMINI_API_KEY="local"
```

**配置优先级:** 环境变量 > `~/.gemini/.env` > 默认配置

---

## 配置 ace-tool MCP (可选)

ace-tool 提供代码检索和 Prompt 增强功能。

```bash
# 配置 ace-tool
npx ccg config mcp

# 或访问
# https://augmentcode.com/ (推荐)
# https://linux.do/t/topic/1291730 (免费中转服务)
```

---

## 与 OpenSpec 的关系

### OpenSpec (规范框架)
- 提供约束驱动开发方法论
- Delta-based 变更追踪
- 轻量级文件系统

### CCG-Workflow (执行引擎)
- 多模型协作编排
- 任务智能路由
- 完整开发工具链

### 搭配使用 (推荐)
```
OpenSpec 管理需求 + CCG 执行实现 = 高效开发
```

---

## 最佳实践

### 1. 使用 OpenSpec 流程管理复杂功能
```bash
/ccg:spec-research → /ccg:spec-plan → /ccg:spec-impl → /ccg:spec-review
```

### 2. 使用专项命令处理简单任务
```bash
/ccg:frontend "Fix button alignment"
/ccg:backend "Add API endpoint"
```

### 3. 规划与执行分离
```bash
# 会话 1: 规划
/ccg:plan "Implement payment system"

# 会话 2: 执行 (可在新会话中)
/ccg:execute
```

### 4. 代码审核后再提交
```bash
/ccg:review  # 审核代码
/ccg:commit  # 提交代码
```

---

## 故障排除

### 问题 1: Gemini backend 不可用
```bash
# 错误: GEMINI_API_KEY environment variable not set
# 解决: 配置 API Key (见上文)
```

### 问题 2: codeagent-wrapper 找不到
```bash
# 错误: command not found: codeagent-wrapper
# 解决: 重新初始化
ccg init --skip-prompt
```

### 问题 3: OpenSpec 命令不工作
```bash
# 检查 OpenSpec CLI
openspec --version

# 重新安装
npm install -g @fission-ai/openspec@latest
```

---

## 相关文档

- **OpenSpec 指南**: `openspec/AGENTS.md`
- **项目规范**: `CLAUDE.md`
- **开发约束**: `docs/CLAUDE_DEV_GUIDE.md`
- **故障排除**: `docs/TROUBLESHOOTING.md`

---

## 命令速查表

| 任务类型 | 推荐命令 |
|---------|---------|
| 复杂功能开发 | `/ccg:spec-research` → `/ccg:spec-plan` → `/ccg:spec-impl` |
| 前端优化 | `/ccg:frontend` |
| 后端开发 | `/ccg:backend` |
| Bug 调试 | `/ccg:debug` |
| 代码审核 | `/ccg:review` |
| 性能优化 | `/ccg:optimize` |
| 测试生成 | `/ccg:test` |
| Git 提交 | `/ccg:commit` |
| 完整流程 | `/ccg:workflow` |

---

**安装日期**: 2026-01-24
**版本**: ccg-workflow v1.7.50
**状态**: ✅ 已集成到项目
