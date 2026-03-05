# CCG-Workflow 快速参考卡

> 一页纸速查表 - 打印或保存到桌面

---

## 🚀 常用命令速查

### 新增功能
```bash
# 复杂功能 (多模块、需规划)
/ccg:spec-research "功能描述"
/ccg:spec-plan
/ccg:spec-impl

# 简单功能 (单模块、快速开发)
/ccg:feat "功能描述"           # 自动路由
/ccg:frontend "前端功能"       # 明确前端
/ccg:backend "后端功能"        # 明确后端
```

### Bug 修复
```bash
# 需要调试
/ccg:debug "问题描述"
/ccg:backend "修复方案"

# 直接修复
/ccg:frontend "修复前端 Bug"
/ccg:backend "修复后端 Bug"
```

### 性能优化
```bash
# 分析 + 优化
/ccg:analyze "性能问题"
/ccg:optimize "优化方案"

# 直接优化
/ccg:frontend "前端优化"
/ccg:backend "后端优化"
```

### 代码质量
```bash
/ccg:review                    # 代码审核
/ccg:test "测试描述"           # 编写测试
/ccg:enhance "重构描述"        # 代码重构
```

### Git 操作
```bash
/ccg:commit                    # 智能提交
/ccg:rollback                  # 回滚代码
/ccg:clean-branches            # 清理分支
```

---

## 📋 工作流模板

### 标准功能开发流程
```bash
1. /ccg:spec-research "功能描述"
2. /ccg:spec-plan
3. /ccg:spec-impl
4. /ccg:test "编写测试"
5. /ccg:review
6. /ccg:commit
```

### 快速 Bug 修复流程
```bash
1. /ccg:debug "问题描述"
2. /ccg:backend "修复方案"
3. /ccg:test "回归测试"
4. /ccg:review
5. /ccg:commit
```

### 性能优化流程
```bash
1. /ccg:analyze "性能问题"
2. /ccg:optimize "优化方案"
3. /ccg:test "性能测试"
4. /ccg:review
5. /ccg:commit
```

---

## 🎯 场景决策

| 我要... | 使用命令 |
|--------|---------|
| 添加新功能 (复杂) | `/ccg:spec-research` |
| 添加新功能 (简单) | `/ccg:feat` |
| 修复前端 Bug | `/ccg:frontend` |
| 修复后端 Bug | `/ccg:backend` |
| 调试问题 | `/ccg:debug` |
| 优化性能 | `/ccg:optimize` |
| 重构代码 | `/ccg:enhance` |
| 编写测试 | `/ccg:test` |
| 审核代码 | `/ccg:review` |
| 提交代码 | `/ccg:commit` |

---

## 🏠 项目特定场景

### IM 系统相关
```bash
# 迁移到 Tinode
/ccg:spec-research "迁移 IM 系统到 Tinode"

# 添加聊天功能
/ccg:backend "添加 Tinode 消息发送 API"
/ccg:frontend "集成 Tinode SDK 到 Mobile"
```

### 托管支付相关
```bash
# 新增支付功能
/ccg:spec-research "实现托管支付系统"

# 修复支付 Bug
/ccg:debug "托管账户余额不一致"
/ccg:backend "修复竞态条件，添加悲观锁"
```

### 商家管理相关
```bash
# 商家入驻
/ccg:spec-research "实现商家入驻审核流程"

# 商家认证
/ccg:backend "添加商家资质验证 API"
/ccg:frontend "实现 Admin 商家审核界面"
```

---

## ⚡ 快捷技巧

### 1. 多模型协作
- 前端任务自动路由到 **Gemini** (本地端点)
- 后端任务自动路由到 **Codex**
- Claude 负责编排和审核

### 2. 规划与执行分离
```bash
# 会话 1: 规划
/ccg:plan "功能描述"

# 会话 2: 执行 (可在新会话中)
/ccg:execute
```

### 3. 提交前必做
```bash
/ccg:review    # 代码审核
/ccg:commit    # 智能提交
```

### 4. 关键功能必测
```bash
/ccg:test "编写单元测试"
/ccg:test "编写集成测试"
```

---

## 🔧 环境配置

### Gemini 本地端点
```bash
# 已配置
GOOGLE_GEMINI_BASE_URL=http://127.0.0.1:8045
GEMINI_API_KEY=sk-4b328e31f3fa491294a0c151e68b512d
GEMINI_MODEL=gemini-3-pro-high
```

### 验证配置
```bash
# 测试 Claude
~/.claude/bin/codeagent-wrapper --backend claude - "$PWD" <<< "echo test"

# 测试 Codex
~/.claude/bin/codeagent-wrapper --backend codex - "$PWD" <<< "echo test"

# 测试 Gemini
~/.claude/bin/codeagent-wrapper --backend gemini - "$PWD" <<< "echo test"
```

---

## 📚 相关文档

- **完整指南**: [docs/CCG_WORKFLOW_GUIDE.md](CCG_WORKFLOW_GUIDE.md)
- **场景详解**: [docs/CCG_WORKFLOW_SCENARIOS.md](CCG_WORKFLOW_SCENARIOS.md)
- **项目规范**: [CLAUDE.md](../CLAUDE.md)
- **开发约束**: [docs/CLAUDE_DEV_GUIDE.md](CLAUDE_DEV_GUIDE.md)

---

## 💡 记住这些

✅ **DO (推荐做)**
- 复杂功能用 OpenSpec 流程
- 提交前必须 `/ccg:review`
- 关键功能必须 `/ccg:test`
- 使用 `/ccg:commit` 生成规范的 commit message

❌ **DON'T (不推荐)**
- 不要跳过代码审核
- 不要忘记编写测试
- 不要手动写 commit message (用 `/ccg:commit`)
- 不要在生产环境直接修改代码

---

## 🆘 遇到问题？

### 命令不工作
```bash
# 检查 CCG 安装
ccg --version

# 重新初始化
ccg init --skip-prompt
```

### Gemini 连接失败
```bash
# 检查本地服务
netstat -an | grep 8045

# 验证环境变量
echo $GOOGLE_GEMINI_BASE_URL
```

### 需要帮助
```bash
# 查看命令帮助
ccg --help

# 查看文档
cat docs/CCG_WORKFLOW_GUIDE.md
```

---

**版本**: CCG-Workflow v1.7.50
**更新日期**: 2026-01-24
**项目**: 家装平台 (home-decoration)
