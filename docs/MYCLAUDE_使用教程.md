# MyClaude 多智能体工作流系统使用教程

## 📋 目录

1. [项目简介](#项目简介)
2. [核心概念](#核心概念)
3. [前置要求](#前置要求)
4. [安装步骤](#安装步骤)
5. [配置说明](#配置说明)
6. [工作流使用指南](#工作流使用指南)
7. [常见问题解决](#常见问题解决)
8. [最佳实践](#最佳实践)

---

## 项目简介

**MyClaude** 是一个基于 Claude Code 的多智能体开发自动化系统，支持多后端执行（Codex/Claude/Gemini）。它通过双智能体架构实现了高效的代码开发工作流。

### 核心优势

- 🤖 **双智能体架构**：Claude Code 负责规划和协调，Codex/Claude/Gemini 负责代码执行
- 🔄 **多工作流支持**：从快速原型到企业级敏捷开发
- ⚡ **并行执行**：自动任务并行化，提升开发效率
- ✅ **强制测试覆盖**：确保 ≥90% 的测试覆盖率
- 🔌 **可插拔后端**：根据任务选择最合适的 AI 模型

---

## 核心概念

### 双智能体架构

| 角色 | 智能体 | 职责 |
|------|--------|------|
| **协调者** | Claude Code | 规划、上下文收集、验证、用户交互 |
| **执行者** | codeagent-wrapper | 代码编辑、测试执行（支持 Codex/Claude/Gemini 后端）|

**为什么要分离？**
- Claude Code 擅长理解上下文和协调复杂工作流
- 专业后端（Codex 擅长代码，Claude 擅长推理，Gemini 擅长原型）专注于执行
- 通过 `--backend codex|claude|gemini` 选择最适合任务的模型

---

## 前置要求

### 1. 必需软件

#### Windows 系统
- **Python 3.8+**
- **PowerShell 5.1+**（推荐使用 PowerShell 7）
- **Git**

#### 验证安装
```powershell
# 检查 Python 版本
python --version

# 检查 PowerShell 版本
$PSVersionTable.PSVersion

# 检查 Git
git --version
```

### 2. AI CLI 工具（至少安装一个）

#### Codex CLI（推荐）
```powershell
# 安装 Codex CLI
# 访问 https://codex.docs 获取安装说明

# 验证安装
codex --version
```

#### Claude CLI
```powershell
# 安装 Claude CLI
# 访问 https://claude.ai/docs 获取安装说明

# 验证安装
claude --version
```

#### Gemini CLI
```powershell
# 安装 Gemini CLI
# 访问 https://ai.google.dev/docs 获取安装说明

# 验证安装
gemini --version
```

### 3. 配置 Codex（推荐配置）

创建或编辑 `~/.codex/config.yaml`（Windows: `C:\Users\你的用户名\.codex\config.toml`）：

```yaml
model = "gpt-5.1-codex-max"
model_reasoning_effort = "high"
model_reasoning_summary = "detailed"
approval_policy = "never"
sandbox_mode = "workspace-write"
disable_response_storage = true
network_access = true
```

**关键配置说明：**
- `approval_policy = "never"`: 自动批准命令（提高效率）
- `sandbox_mode = "workspace-write"`: 允许在工作区写入
- `network_access = true`: 允许网络访问

---

## 安装步骤

### 方法一：快速安装（推荐）

在 **PowerShell** 中执行：

```powershell
# 1. 克隆项目
git clone https://github.com/cexll/myclaude.git
cd myclaude

# 2. 安装到默认目录 (~/.claude)
python install.py --install-dir $HOME\.claude

# 3. 验证安装
$env:PATH -split ';' | Select-String ".claude"
```

### 方法二：自定义安装目录

```powershell
# 安装到自定义目录
$env:INSTALL_DIR = "D:\tools\myclaude"
python install.py --install-dir $env:INSTALL_DIR

# 添加到 PATH（永久）
[Environment]::SetEnvironmentVariable(
    'PATH',
    "$env:INSTALL_DIR\bin;" + [Environment]::GetEnvironmentVariable('PATH','User'),
    'User'
)

# 添加到 PATH（当前会话）
$env:PATH = "$env:INSTALL_DIR\bin;$env:PATH"
```

### 方法三：模块化安装

```powershell
# 查看可用模块
python install.py --list-modules

# 安装特定模块
python install.py --module dev          # 开发工作流
python install.py --module essentials   # 核心命令
python install.py --module bmad         # BMAD 敏捷工作流
python install.py --module requirements # 需求驱动工作流

# 强制覆盖安装
python install.py --force
```

### 安装后的目录结构

```
~/.claude/
├── bin/
│   └── codeagent-wrapper.exe    # 主执行文件
├── CLAUDE.md                     # 核心指令和角色定义
├── commands/                     # 斜杠命令 (/dev, /code 等)
├── agents/                       # 智能体定义
├── skills/
│   └── codex/
│       └── SKILL.md              # Codex 集成技能
├── config.json                   # 配置文件
└── installed_modules.json        # 安装状态
```

---

## 配置说明

### 1. 基础配置

编辑 `~/.claude/config.json`：

```json
{
  "version": "1.0",
  "install_dir": "~/.claude",
  "modules": {
    "dev": {
      "enabled": true,
      "operations": [
        {"type": "merge_dir", "source": "dev-workflow"},
        {"type": "copy_file", "source": "memorys/CLAUDE.md", "target": "CLAUDE.md"},
        {"type": "copy_file", "source": "skills/codex/SKILL.md", "target": "skills/codex/SKILL.md"},
        {"type": "run_command", "command": "bash install.sh"}
      ]
    },
    "essentials": {
      "enabled": true
    }
  }
}
```

### 2. 操作类型说明

| 类型 | 描述 |
|------|------|
| `merge_dir` | 合并子目录（commands/, agents/）到安装目录 |
| `copy_dir` | 复制整个目录 |
| `copy_file` | 复制单个文件到目标路径 |
| `run_command` | 执行 shell 命令 |

### 3. 环境变量配置

```powershell
# 设置后端选择（可选）
$env:CODEAGENT_BACKEND = "codex"  # 或 "claude" 或 "gemini"

# 禁用自动跳过权限（可选）
$env:CODEAGENT_SKIP_PERMISSIONS = "false"
```

---

## 工作流使用指南

### 1. Dev 工作流（推荐用于日常开发）

**适用场景：** 功能开发、重构、带测试的 bug 修复

```bash
/dev "实现基于 JWT 的用户认证"
```

**6 步流程：**
1. **需求澄清** - 交互式问答明确范围
2. **Codex 深度分析** - 代码库探索和架构决策
3. **开发计划生成** - 结构化任务分解和测试要求
4. **并行执行** - Codex 并发执行任务
5. **覆盖率验证** - 强制 ≥90% 测试覆盖率
6. **完成摘要** - 文件变更和覆盖率统计报告

**关键特性：**
- ✅ Claude Code 协调，Codex 执行所有代码变更
- ⚡ 自动任务并行化提速
- 🛡️ 强制 90% 测试覆盖率门槛
- 🔄 失败时自动回滚

**示例：**
```bash
# 在你的项目目录中
cd G:\AI_engineering\home_decoration

# 使用 /dev 命令
/dev "为 admin 面板添加用户权限管理功能"
```

---

### 2. BMAD 敏捷工作流（企业级大型功能）

**适用场景：** 大型功能、团队协作、企业项目

```bash
/bmad-pilot "构建电商结账系统"
```

**6 个专业智能体：**

| 智能体 | 角色 |
|--------|------|
| Product Owner | 需求和用户故事 |
| Architect | 系统设计和技术决策 |
| Tech Lead | Sprint 规划和任务分解 |
| Developer | 实现 |
| Code Reviewer | 质量保证 |
| QA Engineer | 测试和验证 |

**流程：**
```
需求 → 架构 → Sprint 计划 → 开发 → 审查 → QA
 ↓      ↓        ↓         ↓      ↓      ↓
PRD.md DESIGN.md SPRINT.md Code REVIEW.md TEST.md
```

---

### 3. 需求驱动工作流（快速原型）

**适用场景：** 快速原型、明确定义的功能

```bash
/requirements-pilot "实现 API 速率限制"
```

**流程：**
1. 需求生成（带质量评分）
2. 实现规划
3. 代码生成
4. 审查和测试

---

### 4. 开发基础命令（日常任务）

**适用场景：** 快速任务，无需工作流开销

| 命令 | 用途 |
|------|------|
| `/code` | 实现功能 |
| `/debug` | 调试问题 |
| `/test` | 编写测试 |
| `/review` | 代码审查 |
| `/optimize` | 性能优化 |
| `/refactor` | 代码重构 |
| `/docs` | 文档编写 |

**示例：**
```bash
# 快速修复 bug
/debug "修复用户登录时的 token 过期问题"

# 编写测试
/test "为 user_service.go 添加单元测试"

# 代码审查
/review "审查 admin/src/pages/users/UserList.tsx"
```

---

### 5. GitHub 工作流命令

```bash
# 创建结构化 issue
/gh-create-issue "添加用户导出功能"

# 从 issue 实现功能并准备 PR
/gh-issue-implement 123
```

---

## 工作流选择指南

| 场景 | 推荐工作流 |
|------|-----------|
| 带测试的新功能 | `/dev` |
| 快速 bug 修复 | `/debug` 或 `/code` |
| 大型多 Sprint 功能 | `/bmad-pilot` |
| 原型或 POC | `/requirements-pilot` |
| 代码审查 | `/review` |
| 性能问题 | `/optimize` |

---

## 常见问题解决

### 问题 1：找不到 codeagent-wrapper

**症状：**
```
'codeagent-wrapper' 不是内部或外部命令
```

**解决方案：**
```powershell
# 检查 PATH 配置
$env:PATH -split ';' | Select-String ".claude"

# 如果没有，重新安装
cd myclaude
python install.py --install-dir $HOME\.claude --force

# 手动添加到 PATH（永久）
[Environment]::SetEnvironmentVariable(
    'PATH',
    "$HOME\.claude\bin;" + [Environment]::GetEnvironmentVariable('PATH','User'),
    'User'
)

# 重启 PowerShell 或刷新环境变量
$env:PATH = [Environment]::GetEnvironmentVariable('PATH','User')
```

---

### 问题 2：权限被拒绝

**症状：**
```
Permission denied when executing codex commands
```

**解决方案：**

1. **配置 Codex 自动批准：**

编辑 `~/.codex/config.yaml`：
```yaml
approval_policy = "never"
sandbox_mode = "workspace-write"
```

2. **强制重新安装：**
```powershell
python install.py --install-dir $HOME\.claude --force
```

---

### 问题 3：模块未加载

**症状：**
```
Command /dev not found
```

**解决方案：**
```powershell
# 检查安装状态
Get-Content $HOME\.claude\installed_modules.json

# 重新安装特定模块
python install.py --module dev --force

# 安装所有模块
python install.py --force
```

---

### 问题 4：后端 CLI 未找到

**症状：**
```
codex: command not found
```

**解决方案：**
```powershell
# 检查已安装的后端
where.exe codex
where.exe claude
where.exe gemini

# 如果未安装，访问官方文档安装：
# Codex: https://codex.docs
# Claude: https://claude.ai/docs
# Gemini: https://ai.google.dev/docs
```

---

### 问题 5：JSON 解析错误

**症状：**
```
failed to parse JSON output
```

**解决方案：**
```powershell
# 验证后端输出格式
codex e --json "test task"  # 应输出换行分隔的 JSON
claude --output-format stream-json -p "test"  # 应输出流式 JSON

# 检查后端版本
codex --version
claude --version

# 如果版本过旧，升级到最新版本
```

---

### 问题 6：/dev 命令执行很慢

**症状：**
简单功能使用 `/dev` 命令需要超过 30 分钟

**解决方案：**

1. **检查日志：**
```powershell
# 查看日志文件
Get-Content $env:TEMP\codeagent-wrapper-*.log -Tail 50
```

2. **调整后端：**
```powershell
# 使用更快的模型
$env:CODEAGENT_BACKEND = "codex"

# 在 Codex 配置中使用快速模型
# ~/.codex/config.yaml
model = "gpt-5.1-codex-max"
```

3. **优化工作区：**
- 使用单一仓库而非 monorepo
- 在 WSL 中运行可能更快

---

### 问题 7：Gemini 无法读取 .gitignore 文件

**症状：**
使用 `--backend gemini` 时无法读取 `.claude/` 等被 `.gitignore` 忽略的文件

**解决方案：**

**选项 1：** 从 `.gitignore` 中移除 `.claude/`
```gitignore
# .gitignore
# .claude/  # 注释掉这行
```

**选项 2：** 确保需要读取的文件不在 `.gitignore` 列表中

---

### 问题 8："Unknown event format" 错误

**症状：**
```
Unknown event format: {"type":"turn.started"}
Unknown event format: {"type":"assistant", ...}
```

**解决方案：**
这是日志事件格式显示问题，**不影响实际功能**。可以忽略这些日志输出，将在下一版本修复。

---

## 最佳实践

### 1. 在 home_decoration 项目中使用

```powershell
# 进入项目目录
cd G:\AI_engineering\home_decoration

# 使用 /dev 开发新功能
/dev "为 admin 面板添加字典管理的批量导入功能"

# 使用 /debug 调试问题
/debug "修复 mobile 端地理位置服务的权限问题"

# 使用 /test 添加测试
/test "为 server/internal/service/dictionary_service.go 添加单元测试"

# 使用 /review 审查代码
/review "审查 admin/src/pages/system/DictionaryManagement.tsx 的代码质量"
```

---

### 2. 并行执行任务

```bash
codeagent-wrapper --parallel <<'EOF'
---TASK---
id: backend_api
workdir: G:\AI_engineering\home_decoration\server
---CONTENT---
实现 /api/v1/regions 的 REST 端点

---TASK---
id: frontend_ui
workdir: G:\AI_engineering\home_decoration\admin
dependencies: backend_api
---CONTENT---
创建 RegionManagement.tsx 组件调用 API
EOF
```

---

### 3. 选择合适的后端

```powershell
# 代码生成任务 - 使用 Codex
codeagent-wrapper --backend codex - <<'EOF'
实现用户认证中间件
EOF

# 推理和规划任务 - 使用 Claude
codeagent-wrapper --backend claude - <<'EOF'
分析当前架构并提出优化建议
EOF

# 快速原型 - 使用 Gemini
codeagent-wrapper --backend gemini - <<'EOF'
创建一个简单的 CRUD API 原型
EOF
```

---

### 4. 会话管理

```powershell
# 开始新会话
codeagent-wrapper - <<'EOF'
实现用户注册功能
EOF

# 继续之前的会话（使用返回的 SESSION_ID）
codeagent-wrapper --session <session_id> - <<'EOF'
添加邮箱验证功能
EOF
```

---

### 5. 启用 Hooks 和 Skills

编辑 `~/.claude/settings.json`：
```json
{
  "hooks_enabled": true,
  "skills_auto_suggest": true
}
```

这将激活：
- 自动测试运行
- 代码审查
- 技能自动建议

---

## 高级配置

### 1. 自定义 Codex 配置

`~/.codex/config.yaml`：
```yaml
# 模型配置
model = "gpt-5.1-codex-max"
model_reasoning_effort = "high"
model_reasoning_summary = "detailed"

# 权限配置
approval_policy = "never"
sandbox_mode = "workspace-write"

# 功能配置
disable_response_storage = true
network_access = true
git_operations_enabled = true

# 日志配置
log_level = "info"
log_file = "~/.codex/logs/codex.log"
```

---

### 2. 自定义工作流

创建 `~/.claude/commands/my-workflow.md`：
```markdown
# My Custom Workflow

## Description
自定义工作流描述

## Usage
/my-workflow "任务描述"

## Steps
1. 步骤 1
2. 步骤 2
3. 步骤 3
```

---

### 3. 集成到 VS Code

安装 Claude Code VS Code 扩展后，可以直接在编辑器中使用：

1. 打开命令面板（Ctrl+Shift+P）
2. 输入 "Claude Code: Run Command"
3. 选择工作流（如 `/dev`）
4. 输入任务描述

---

## 总结

### 快速开始检查清单

- [ ] 安装 Python 3.8+
- [ ] 安装 Git
- [ ] 安装至少一个 AI CLI（Codex/Claude/Gemini）
- [ ] 克隆 myclaude 项目
- [ ] 运行 `python install.py --install-dir ~/.claude`
- [ ] 验证 PATH 配置
- [ ] 配置 Codex（`~/.codex/config.yaml`）
- [ ] 测试运行 `/dev "hello world"`

### 推荐工作流程

1. **日常开发：** 使用 `/dev` 命令
2. **快速修复：** 使用 `/debug` 或 `/code`
3. **大型功能：** 使用 `/bmad-pilot`
4. **代码审查：** 使用 `/review`
5. **性能优化：** 使用 `/optimize`

### 获取帮助

- **GitHub Issues：** https://github.com/cexll/myclaude/issues
- **文档：** https://github.com/cexll/myclaude/tree/master/docs
- **示例：** https://github.com/cexll/myclaude/tree/master/examples

---

## 附录：Windows 特定说明

### PowerShell 执行策略

如果遇到脚本执行被阻止：
```powershell
# 临时允许（当前会话）
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass

# 永久允许（当前用户）
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

### 路径分隔符

Windows 使用反斜杠 `\`，但在配置文件中建议使用正斜杠 `/` 或双反斜杠 `\\`：
```json
{
  "install_dir": "C:/Users/zhang/.claude"
}
```

### 环境变量持久化

```powershell
# 查看当前 PATH
$env:PATH

# 永久添加到用户 PATH
[Environment]::SetEnvironmentVariable(
    'PATH',
    "$HOME\.claude\bin;" + [Environment]::GetEnvironmentVariable('PATH','User'),
    'User'
)

# 刷新当前会话
$env:PATH = [Environment]::GetEnvironmentVariable('PATH','User') + ";" + [Environment]::GetEnvironmentVariable('PATH','Machine')
```

---

**祝您使用愉快！如有问题，请参考常见问题解决部分或提交 GitHub Issue。**
