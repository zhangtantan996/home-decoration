# OMO 多代理协作系统使用教程

## 📖 教程概述

本教程将指导你如何使用 **myclaude** 项目中的 **OMO (Oh-my-opencode)** 功能，实现多代理协作的智能开发工作流。

> **⚠️ 重要说明: 使用环境**
> 
> `/omo` 命令是为 **Claude Code** (Anthropic 的 AI 编程助手) 设计的**斜杠命令 (Slash Command)**。
> 
> - ✅ **可以使用**: 在 Claude Code 对话界面中
> - ❌ **不能使用**: 在普通 VS Code 插件、命令行终端或其他 IDE 中
> - 💡 **替代方案**: 可以通过 `codeagent-wrapper` CLI 工具间接调用相关功能
> 
> 如果你使用的是其他 AI 编程助手 (如 Gemini Code, GitHub Copilot 等)，你需要适配相应的工作流系统，或者直接使用 `codeagent-wrapper` 命令行工具。

### 什么是 OMO？

OMO 是一个将 Oh-my-opencode 的多代理协作能力移植到 Claude Code 的高级技能系统。它通过以下架构实现复杂任务的自动化处理：

- **Sisyphus (编排者)**: 核心大脑，负责任务分解、代理分配和进度监控
- **专业代理团队**: 各司其职的 AI 代理，包括推理、文档、开发、UI/UX 等专家

---

## 🎯 核心优势

### 1. **成本效率**
- 探索和文档任务使用低成本模型
- 推理和开发任务使用高性能模型
- 智能分配资源，降低整体成本

### 2. **质量提升**
- 专业代理在各自领域表现优于通用模型
- 任务分工明确，输出质量更高

### 3. **自动化工作流**
- Sisyphus 自动处理任务管理的"重活"
- 无需手动协调多个 AI 工具

---

## 🚀 快速开始

### 第一步: 安装 myclaude 项目

#### 1.1 克隆项目
```powershell
git clone https://github.com/cexll/myclaude.git
cd myclaude
```

#### 1.2 运行安装脚本
```powershell
# 使用 Python 安装 (推荐)
python3 install.py --install-dir ~/.claude

# 或者使用默认安装目录
python3 install.py
```

#### 1.3 验证安装
安装完成后，你的 `~/.claude` 目录应包含以下结构：
```
~/.claude/
├── bin/
│   └── codeagent-wrapper      # 主执行文件
├── CLAUDE.md                   # 核心指令和角色定义
├── commands/                   # 斜杠命令 (/dev, /code 等)
├── agents/                     # 代理定义
├── skills/
│   └── codex/
│       └── SKILL.md           # Codex 集成技能
├── config.json                 # 配置文件
└── installed_modules.json      # 安装状态
```

---

### 第二步: 配置 OMO 系统

#### 2.1 创建模型配置文件

在 `~/.codeagent/models.json` 创建配置文件（如果目录不存在，请先创建）:

```powershell
# 创建配置目录
New-Item -ItemType Directory -Force -Path ~/.codeagent

# 创建配置文件
New-Item -ItemType File -Force -Path ~/.codeagent/models.json
```

#### 2.2 编辑配置文件

将以下配置写入 `~/.codeagent/models.json`:

```json
{
  "default_backend": "opencode",
  "default_model": "opencode/grok-code",
  "agents": {
    "sisyphus": {
      "backend": "claude",
      "model": "claude-3-5-sonnet-20241022",
      "yolo": true
    },
    "oracle": {
      "backend": "claude",
      "model": "claude-opus-4-5-20251101"
    },
    "librarian": {
      "backend": "claude",
      "model": "claude-sonnet-4-5-20250514"
    },
    "explore": {
      "backend": "opencode",
      "model": "opencode/grok-code"
    },
    "develop": {
      "backend": "codex",
      "model": "gpt-5.2",
      "yolo": true
    },
    "frontend-ui-ux-engineer": {
      "backend": "gemini",
      "model": "gemini-3-pro-preview"
    },
    "document-writer": {
      "backend": "gemini",
      "model": "gemini-3-flash-preview"
    }
  }
}
```

#### 2.3 配置说明

| 代理名称 | 职责 | 推荐模型 | 说明 |
|---------|------|---------|------|
| **sisyphus** | 任务编排和监控 | Claude Sonnet | 核心大脑，负责分解任务 |
| **oracle** | 深度推理和问题解决 | Claude Opus | 处理复杂逻辑问题 |
| **librarian** | 文档和代码库知识管理 | Claude Sonnet | 理解项目结构 |
| **explore** | 代码库导航和理解 | Grok Code | 快速探索代码 |
| **develop** | 编写和重构代码 | GPT-5.2 (Codex) | 实际代码生成 |
| **frontend-ui-ux-engineer** | UI/UX 专项任务 | Gemini Pro | 前端界面开发 |
| **document-writer** | 生成文档 | Gemini Flash | 文档撰写 |

> **💡 提示**: `yolo` 模式表示该代理可以自动执行操作，无需每次确认。

---

### 第三步: 安装必要的后端 CLI 工具

OMO 系统需要以下命令行工具来与不同的 AI 后端通信：

#### 3.1 安装 Claude CLI
```powershell
# 根据官方文档安装 Claude CLI
# 参考: https://docs.anthropic.com/claude/docs/cli
```

#### 3.2 安装 Codex CLI
```powershell
# 安装 OpenAI Codex CLI
# 参考: https://platform.openai.com/docs/guides/code
```

#### 3.3 安装 Gemini CLI
```powershell
# 安装 Google Gemini CLI
# 参考: https://ai.google.dev/gemini-api/docs/cli
```

#### 3.4 安装 OpenCode CLI (可选)
```powershell
# 如果使用 Grok 或其他 OpenCode 后端
```

#### 3.5 配置 API 密钥

确保为每个服务配置了正确的环境变量或配置文件：

```powershell
# 示例: 设置环境变量
$env:ANTHROPIC_API_KEY = "your-claude-api-key"
$env:OPENAI_API_KEY = "your-openai-api-key"
$env:GOOGLE_API_KEY = "your-gemini-api-key"
```

---

## 🎮 使用 OMO 功能

### 使用环境说明

#### 方式 1: 在 Claude Code 中使用 (推荐)

在 **Claude Code** 对话界面中，使用 `/omo` 斜杠命令调用多代理系统：

```
/omo <你的任务描述>
```

**适用场景**: 你已经安装并使用 Anthropic 的 Claude Code 产品。

#### 方式 2: 使用 CLI 工具 (通用方式)

如果你使用的是其他 AI 编程助手或想在命令行中使用，可以直接调用 `codeagent-wrapper`:

```powershell
# 通过 codeagent-wrapper 执行任务
codeagent-wrapper --agent sisyphus <<'EOF'
你的任务描述
EOF
```

**适用场景**: 
- 在任何终端环境中使用
- 集成到自定义脚本或工作流中
- 在其他 IDE 或编辑器中使用

#### 方式 3: 适配到其他 AI 助手

如果你使用 Gemini Code、GitHub Copilot 等其他 AI 编程助手，你可以：

1. **研究命令定义**: 查看 `~/.claude/commands/` 目录中的命令定义
2. **创建自定义工作流**: 在你的 AI 助手中创建类似的工作流
3. **封装 CLI 调用**: 将 `codeagent-wrapper` 封装为你的 AI 助手可以调用的命令

### 实际示例

#### 示例 1: 重构用户认证逻辑
```
/omo 使用新的 API 重构用户认证逻辑
```

**执行流程**:
1. **Sisyphus** 分析任务，识别需要重构的模块
2. **explore** 探索现有代码库，找到认证相关代码
3. **librarian** 提供相关文档和最佳实践
4. **oracle** 设计新的认证架构
5. **develop** 实施代码重构
6. **document-writer** 更新相关文档

#### 示例 2: 研究代码库并解释数据流
```
/omo 研究代码库并解释订单处理系统的数据流
```

**执行流程**:
1. **Sisyphus** 规划研究路径
2. **explore** 导航代码库，定位订单处理模块
3. **librarian** 收集相关文档和注释
4. **oracle** 分析数据流逻辑
5. **document-writer** 生成详细的数据流文档

#### 示例 3: 创建新的 UI 组件
```
/omo 创建一个现代化的用户个人资料页面组件
```

**执行流程**:
1. **Sisyphus** 分解 UI 任务
2. **frontend-ui-ux-engineer** 设计组件结构和样式
3. **develop** 实现组件代码
4. **document-writer** 生成组件使用文档

---

## 🔧 高级配置

### 自定义代理配置

你可以根据项目需求调整代理配置：

#### 调整模型选择
```json
{
  "agents": {
    "develop": {
      "backend": "claude",
      "model": "claude-3-5-sonnet-20241022",
      "yolo": false
    }
  }
}
```

#### 添加自定义代理
```json
{
  "agents": {
    "security-auditor": {
      "backend": "claude",
      "model": "claude-opus-4-5-20251101",
      "yolo": false
    }
  }
}
```

### 配置 YOLO 模式

YOLO (You Only Live Once) 模式允许代理自动执行操作：

- `"yolo": true` - 自动执行，适合开发和探索代理
- `"yolo": false` - 需要确认，适合关键操作

---

## 📋 技术要求

### 必需组件

1. **codeagent-wrapper**
   - 必须支持 `--agent` 参数
   - 用于任务委派

2. **后端 CLI 工具**
   - Claude CLI (用于 Claude 模型)
   - Codex CLI (用于 OpenAI 模型)
   - Gemini CLI (用于 Google 模型)
   - OpenCode CLI (可选)

3. **API 密钥**
   - 为每个使用的服务配置有效的 API 密钥

### 版本要求

根据 myclaude 项目文档：

- **Codex CLI**: 最新版本
- **Claude CLI**: 最新版本
- **Gemini CLI**: 最新版本

---

## 🛠️ 故障排查

### 常见问题

#### 问题 1: codeagent-wrapper 执行失败
**错误**: "Unknown event format"

**解决方案**:
```powershell
# 重新安装 codeagent-wrapper
cd myclaude
python3 install.py --force
```

#### 问题 2: 代理无法连接到后端
**错误**: "Backend connection failed"

**解决方案**:
1. 检查 API 密钥是否正确配置
2. 验证 CLI 工具是否正确安装
3. 测试网络连接

```powershell
# 测试 Claude CLI
claude --version

# 测试 Codex CLI
codex --version
```

#### 问题 3: 配置文件未生效
**解决方案**:
1. 确认配置文件路径: `~/.codeagent/models.json`
2. 验证 JSON 格式是否正确
3. 重启 Claude Code

---

## 📚 其他工作流

除了 OMO，myclaude 还提供其他强大的工作流：

### 1. Dev Workflow (推荐)
```
/dev "实现 JWT 用户认证"
```

**6 步流程**:
1. 需求澄清 - 交互式问答
2. Codex 深度分析 - 代码库探索
3. 开发计划生成 - 结构化任务分解
4. 并行执行 - Codex 并发执行任务
5. 覆盖率验证 - 强制 ≥90% 测试覆盖率
6. 完成总结 - 文件变更和覆盖率报告

### 2. BMAD 敏捷工作流
```
/bmad-pilot "构建电商结账系统"
```

**6 个专业代理**:
- Business Analyst → PRD.md
- Architect → DESIGN.md
- Manager → SPRINT.md
- Developer → Code
- Reviewer → REVIEW.md
- QA → TEST.md

### 3. 需求驱动工作流
```
/requirements-pilot "实现 API 速率限制"
```

### 4. 开发基础命令
```
/code      # 直接编码
/debug     # 调试
/test      # 测试
/review    # 代码审查
/optimize  # 优化
/refactor  # 重构
/docs      # 文档生成
```

---

## 🎓 最佳实践

### 1. 任务描述清晰
```
❌ 不好: /omo 修复登录
✅ 好: /omo 修复登录页面的 JWT 令牌过期后未正确重定向到登录页的问题
```

### 2. 选择合适的工作流
- **简单任务**: 使用 `/code`, `/debug` 等基础命令
- **中等复杂度**: 使用 `/dev` 工作流
- **复杂项目**: 使用 `/omo` 或 `/bmad-pilot`

### 3. 合理配置 YOLO 模式
- 开发环境: 可以启用 YOLO
- 生产环境: 建议关闭 YOLO，手动确认

### 4. 监控成本
- 定期检查 API 使用情况
- 根据预算调整模型选择

---

## 📖 参考资源

### 官方文档
- [myclaude GitHub 仓库](https://github.com/cexll/myclaude)
- [Claude Code 文档](https://docs.anthropic.com/claude/docs)
- [OpenAI Codex 文档](https://platform.openai.com/docs/guides/code)
- [Google Gemini 文档](https://ai.google.dev/gemini-api/docs)

### 社区资源
- [微信文章: OMO skills 移植教程](https://mp.weixin.qq.com/s/0-O-DJMbfLPbQZl96uZMIw)

---

## 🎉 总结

通过本教程，你应该已经掌握了：

1. ✅ 安装和配置 myclaude 项目
2. ✅ 设置 OMO 多代理系统
3. ✅ 配置各个专业代理
4. ✅ 使用 `/omo` 命令执行复杂任务
5. ✅ 故障排查和最佳实践

现在你可以开始使用 OMO 功能来提升开发效率了！

---

## 💬 获取帮助

如果遇到问题，可以：
1. 查看 [myclaude 项目的 Issues](https://github.com/cexll/myclaude/issues)
2. 参考项目文档中的 FAQ 部分
3. 在社区论坛提问

祝你使用愉快！🚀
