# OMO 快速参考指南

## 🚀 5 分钟快速上手

### 1️⃣ 安装 myclaude
```powershell
git clone https://github.com/cexll/myclaude.git
cd myclaude
python3 install.py --install-dir ~/.claude
```

### 2️⃣ 创建配置文件
```powershell
# 创建配置目录
New-Item -ItemType Directory -Force -Path ~/.codeagent

# 创建并编辑配置文件
notepad ~/.codeagent/models.json
```

**粘贴以下配置**:
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

### 3️⃣ 配置 API 密钥
```powershell
$env:ANTHROPIC_API_KEY = "your-claude-api-key"
$env:OPENAI_API_KEY = "your-openai-api-key"
$env:GOOGLE_API_KEY = "your-gemini-api-key"
```

### 4️⃣ 开始使用
在 Claude Code 中输入:
```
/omo 你的任务描述
```

---

## 📝 常用命令示例

| 任务类型 | 命令示例 |
|---------|---------|
| **代码重构** | `/omo 使用新的 API 重构用户认证逻辑` |
| **代码分析** | `/omo 研究代码库并解释订单处理系统的数据流` |
| **UI 开发** | `/omo 创建一个现代化的用户个人资料页面组件` |
| **Bug 修复** | `/omo 修复登录页面的 JWT 令牌过期后未正确重定向的问题` |
| **性能优化** | `/omo 优化数据库查询性能,减少 N+1 查询问题` |
| **文档生成** | `/omo 为整个项目生成 API 文档` |

---

## 🎯 代理职责速查

| 代理 | 职责 | 何时使用 |
|-----|------|---------|
| **sisyphus** | 任务编排 | 自动调用 |
| **oracle** | 深度推理 | 复杂逻辑问题 |
| **librarian** | 知识管理 | 理解项目结构 |
| **explore** | 代码探索 | 快速导航代码 |
| **develop** | 代码生成 | 实际编码工作 |
| **frontend-ui-ux-engineer** | UI/UX | 前端界面开发 |
| **document-writer** | 文档撰写 | 生成文档 |

---

## ⚡ 其他工作流速查

```
/dev "任务描述"              # 标准开发工作流 (推荐)
/bmad-pilot "任务描述"       # 企业敏捷工作流
/requirements-pilot "任务"   # 需求驱动工作流
/code                        # 直接编码
/debug                       # 调试
/test                        # 测试
/review                      # 代码审查
```

---

## 🔧 故障排查速查

| 问题 | 解决方案 |
|-----|---------|
| **codeagent-wrapper 失败** | `python3 install.py --force` |
| **后端连接失败** | 检查 API 密钥和 CLI 工具安装 |
| **配置未生效** | 确认路径 `~/.codeagent/models.json` |

---

## 📚 完整教程

详细内容请参考: [OMO_使用教程.md](./OMO_使用教程.md)
