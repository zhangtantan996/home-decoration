# CODEX_WORKFLOW.md

本仓库不再以“原生 Codex 文档流”作为主工作流。当前默认工作流已经收敛为：

```text
Aegis = 执行纪律
Trellis = 任务与项目记忆
Codex = 实现宿主
/goal = 长任务执行器
```

详细使用方式见：

- `docs/AI_WORKFLOW_OPERATION_GUIDE.md`
- `.trellis/spec/ai-workflow-routing.md`
- `.trellis/spec/home-decoration-baseline.md`
- `docs/CODE_REVIEW_SOP.md`

## 1. 默认流程

普通任务：

```text
用户描述功能或 bug -> Aegis 执行纪律 -> Codex 实现 -> 最小验证 -> patch P0/P1 复审 -> 收口
```

长任务：

```text
Trellis brainstorm/start -> PRD -> task context -> implement/check -> finish-work
```

超长任务：

```text
Trellis PRD/task context -> issues/*.csv -> /goal @issues/*.csv -> final REVIEW
```

## 2. 什么时候停下来问

遇到以下情况先停下来确认：

- 需求边界不清，且合理假设会影响实现方向。
- 涉及 `auth`、`identity`、`payment/escrow`、`deploy`、`rbac`、`sms`、`legal/privacy`。
- 需要破坏性 schema 变更、生产影响动作、真实账号或外部服务写操作。
- 需要 `git push`。
- 当前改动会覆盖或回退用户已有未提交变更。

## 3. 完成标准

任务完成前必须满足：

- 最小必要验证已执行，或明确说明未执行原因。
- 当前 patch 已按 P0/P1 风险复审。
- 没有未确认的高风险边界。
- 若验证或复审失败，继续修复并重跑最小验证，直到收口或进入需要用户确认的边界。

## 4. 文档职责

- `AGENTS.md`：短入口规则、安全边界、项目硬约束。
- `.trellis/spec/`：项目事实、工程基线、AI 工作流路由、可复用经验。
- `.trellis/tasks/`：长任务 PRD、任务状态、检查记录。
- `.trellis/workspace/`：个人工作日志和可恢复上下文。
- `docs/CODE_REVIEW_SOP.md`：项目专属代码审查风险表。

不要继续把新流程细则堆进 `AGENTS.md`。需要长期沉淀的规则优先进入 `.trellis/spec/`。
