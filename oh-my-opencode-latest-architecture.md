# Oh My OpenCode V3 - 最新代理架构（2026）

## 🎭 三个核心代理

### 1️⃣ Atlas - Master Orchestrator（总指挥）

**角色**：项目经理 / 总指挥

**职责**：
- ✅ 解析用户需求
- ✅ 制定执行计划（创建 todo list）
- ✅ 委托任务给 Sisyphus 或其他专业代理
- ✅ 验证所有工作质量（QA gate）
- ✅ 协调并行执行

**特点**：
- ❌ **不写代码**，只编排和验证
- ✅ 负责整体协调和质量把控

**使用场景**：
- 复杂多步骤任务
- 需要协调多个代理的工作
- 需要质量验证的项目

**命名由来**：
- 旧名：Orchestrator（编排器）
- 新名：Atlas（希腊神话中托举天空的泰坦神）
- 象征：托举整个工作流，就像托举天空

---

### 2️⃣ Sisyphus - 执行者（西西弗斯）

**角色**：实际干活的工程师

**职责**：
- ✅ 接收 Atlas 委托的具体任务
- ✅ 写代码、修 bug、写测试
- ✅ 执行具体的技术实现

**变体（Sisyphus-Junior）**：
- `Sisyphus-Junior-visual-engineering` - 前端/UI 开发
- `Sisyphus-Junior-ultrabrain` - 复杂架构实现
- `Sisyphus-Junior-quick` - 简单快速修改
- 等等...

**使用场景**：
- 具体的编码任务
- Bug 修复
- 功能实现
- 测试编写

---

### 3️⃣ Prometheus (Oracle) - 高级顾问（普罗米修斯）

**角色**：资深架构师 / 顾问

**职责**：
- ✅ 复杂架构设计咨询
- ✅ 疑难问题诊断
- ✅ 只读分析

**特点**：
- ❌ **不直接修改代码**
- ✅ 高质量推理模型（昂贵）
- ✅ 深度分析和建议

**使用场景**：
- 2 次失败后的调试
- 架构决策
- 复杂问题诊断
- 技术方案评估

---

## 🔄 工作流示例

```
用户："实现用户登录功能"
    ↓
Atlas（总指挥）：
  1. 分析需求 → 创建 todo list
     - 前端登录表单
     - 后端 API
     - 测试
    ↓
  2. 委托 Task 1 → delegate_task(category="visual-engineering")
     → Sisyphus-Junior（前端）
    ↓
  3. 委托 Task 2 → delegate_task(category="quick")
     → Sisyphus-Junior（后端）
    ↓
  4. 验证所有任务
     - lsp_diagnostics
     - 构建检查
     - 测试运行
    ↓
  5. 如果失败 2 次 → 咨询 Prometheus (Oracle)
    ↓
  6. 生成完成报告
```

---

## 📊 代理对比表

| 代理 | 角色 | 做什么 | 不做什么 |
|------|------|--------|----------|
| **Atlas** | 总指挥 | 规划、委托、验证 | ❌ 不写代码 |
| **Sisyphus** | 工程师 | 写代码、改代码、测试 | ❌ 不做架构决策 |
| **Prometheus** | 顾问 | 分析、建议、诊断 | ❌ 不直接改代码 |

---

## 🎯 什么时候用哪个？

### 用 Atlas（你正在用的）
- ✅ 复杂项目，需要多步骤协调
- ✅ 需要质量验证
- ✅ 不确定如何分解任务

### 用 Sisyphus
- ✅ 具体的编码任务
- ✅ 简单的 Bug 修复
- ✅ 已经明确的实现需求

### 用 Prometheus
- ✅ 遇到复杂问题需要诊断
- ✅ 需要架构设计建议
- ✅ Sisyphus 失败 2 次后

---

## 💡 关键理解

1. **Atlas = 旧的 Orchestrator**
   - 只是改名，功能相同
   - 更有辨识度和象征意义

2. **当前对话**
   - 你正在和 **Atlas** 对话
   - Atlas 会委托任务给 Sisyphus
   - 必要时会咨询 Prometheus

3. **工作模式**
   - Atlas：规划 → 委托 → 验证
   - Sisyphus：执行具体任务
   - Prometheus：提供专家建议

---

## 🙏 感谢纠正

之前我的理解有误：
- ❌ 我说 Orchestrator 是独立的
- ✅ 实际上 Atlas = Orchestrator（改名）

- ❌ 我说 Prometheus 只读
- ✅ 实际上 Prometheus 确实是只读顾问（这点我说对了）

现在理解正确了！感谢你的耐心纠正。
