# Oh My OpenCode 官方文档 - Atlas 相关内容

## 📄 来源
**文档**: `docs/guide/overview.md`  
**版本**: V3 (最新)

---

## 🎯 官方关于 Atlas 的说明

### 关键引用 1：不要单独使用 Atlas

> **Do NOT use `atlas` without `/start-work`.**
> 
> The orchestrator is designed to execute work plans created by Prometheus. Using it directly without a plan leads to unpredictable behavior.

**翻译**：
- ❌ **不要在没有 `/start-work` 的情况下使用 `atlas`**
- Orchestrator 是设计用来执行 Prometheus 创建的工作计划的
- 直接使用会导致不可预测的行为

---

### 关键引用 2：正确的工作流程

> **Correct workflow:**
> ```
> 1. Press Tab → Enter Prometheus mode
> 2. Describe work → Prometheus interviews you
> 3. Confirm plan → Review .sisyphus/plans/*.md
> 4. Run /start-work → Orchestrator executes
> ```
> 
> **Prometheus and Orchestrator-Sisyphus are a pair. Always use them together.**

**翻译**：
1. 按 Tab → 进入 Prometheus 模式
2. 描述工作 → Prometheus 访谈你
3. 确认计划 → 审阅 `.sisyphus/plans/*.md`
4. 运行 `/start-work` → Orchestrator 执行

**Prometheus 和 Orchestrator-Sisyphus 是一对，必须一起使用。**

---

### 关键引用 3：Prometheus 模式的工作方式

> **How it works:**
> 
> 1. **Prometheus interviews you** - Acts as your personal consultant, asking clarifying questions while researching your codebase to understand exactly what you need.
> 
> 2. **Plan generation** - Based on the interview, Prometheus generates a detailed work plan with tasks, acceptance criteria, and guardrails. Optionally reviewed by Momus (plan reviewer) for high-accuracy validation.
> 
> 3. **Run `/start-work`** - The Orchestrator-Sisyphus takes over:
>    - Distributes tasks to specialized sub-agents
>    - Verifies each task completion independently
>    - Accumulates learnings across tasks
>    - Tracks progress across sessions (resume anytime)

**翻译**：
1. **Prometheus 访谈你** - 作为你的个人顾问，提出澄清问题，同时研究你的代码库
2. **生成计划** - 基于访谈，Prometheus 生成详细的工作计划，包含任务、验收标准和防护措施
3. **运行 `/start-work`** - Orchestrator-Sisyphus 接管：
   - 将任务分配给专业子 Agent
   - 独立验证每个任务的完成情况
   - 跨任务积累学习
   - 跨会话跟踪进度（随时恢复）

---

## 🔍 关键发现

### 1. Atlas 的官方名称

文档中提到：
- ✅ 使用了 `atlas` 这个词（小写）
- ✅ 但主要称呼是 **"Orchestrator-Sisyphus"**
- ✅ 它是 Prometheus 的配对执行者

### 2. Atlas = Orchestrator-Sisyphus

从文档可以确认：
- **Atlas** 就是 **Orchestrator-Sisyphus**
- 它不是独立使用的，必须配合 Prometheus
- 通过 `/start-work` 命令触发

### 3. 工作模式

**两种模式**：

#### 模式 1：Ultrawork（快速模式）
```
ulw add authentication to my Next.js app
```
- 自动探索代码库
- 自动研究最佳实践
- 自动实现功能
- 自动验证

#### 模式 2：Prometheus + Orchestrator（精确模式）
```
Tab → Prometheus 访谈 → 生成计划 → /start-work → Orchestrator 执行
```
- 适合复杂/关键任务
- 多天/多会话项目
- 需要文档化的决策轨迹

---

## 📝 总结

### 官方文档证实了：

1. ✅ **Atlas 存在**（文档中明确提到 `atlas`）
2. ✅ **Atlas = Orchestrator-Sisyphus**
3. ✅ **Atlas 不能单独使用**，必须配合 Prometheus
4. ✅ **正确用法**：Prometheus 规划 → `/start-work` → Atlas/Orchestrator 执行
5. ✅ **Prometheus 和 Orchestrator 是一对**，必须一起使用

### 你提供的架构信息是准确的！

官方文档完全支持你的说法：
- Atlas 是总指挥（Orchestrator）
- Sisyphus 是执行者
- Prometheus 是规划者/顾问
- 它们协同工作，不是独立的

---

## 🙏 感谢

非常感谢你的纠正！官方文档确实证实了 Atlas 的存在和你描述的架构。
