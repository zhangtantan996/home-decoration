# AI 工作流操作文档：Aegis + Trellis + Codex

本仓库后续把 AI 开发工作流收敛为三层：

- `Aegis`：默认执行纪律，负责让每次开发先读基线、明确边界、基于证据收口。
- `Trellis`：项目任务与记忆底座，负责长任务 PRD、任务状态、项目规范和工作日志。
- `Codex / /goal`：具体执行器；普通任务由 Codex 直接完成，长任务可用 `/goal` 持续执行。

## 1. 什么时候用哪一个

普通小任务直接描述问题即可：

```text
修复 merchant 订单详情页状态展示不一致的问题。
```

默认走 Aegis 执行纪律：

```text
读基线 -> 判断边界 -> 实现/排查 -> 最小验证 -> patch 级 P0/P1 复审 -> 收口
```

中等风险任务可以显式加 Aegis goal：

```text
Aegis goal: 优化 merchant 订单详情页状态展示，不改后端状态定义。
```

复杂长任务用 Trellis：

```text
用 Trellis 开一个任务：统一 admin / merchant / mini 的订单状态展示口径。
```

超长任务或需要断点续跑时：

```text
用 Trellis 生成任务上下文，再导出 issues/*.csv，最后用 /goal @issues/*.csv 执行。
```

## 2. Aegis 的正确用法

Aegis 是方法层，不是后台服务。它不替代项目规则，也不替代 Codex 执行。

适合：

- bug 排查
- 代码审查
- 重构前边界确认
- 完成前验证
- 中高风险改动的目标框定

常用触发方式：

```text
Aegis goal: 修复订单状态流转 500，不重写订单系统。
```

```text
使用 Aegis systematic-debugging 排查 server 订单状态返回 500。
```

```text
使用 Aegis verification-before-completion 检查这次改动是否可以收口。
```

Aegis 的默认判断标准：

- 简单任务保持轻量，不强行展开大流程。
- 复杂任务先明确目标、范围、影响面和验证方式。
- 未验证不得声称完成。
- 验证失败要继续修复或明确阻塞原因。

## 3. Trellis 的正确用法

Trellis 是项目级任务与记忆系统，适合长任务和跨模块任务。

当前仓库的共享实施稿只保留项目级规范与操作说明：

```text
.trellis/
```

关键目录：

```text
.trellis/spec/
```

放项目规范、工程约束、业务边界和可复用经验。

```text
.trellis/tasks/
```

放具体任务的 PRD、上下文、状态和检查记录。

```text
.trellis/workspace/
```

放个人工作日志和可恢复上下文。

推荐任务入口：

```text
用 Trellis brainstorm 先把这个需求问清楚：<需求>
```

```text
用 Trellis 开任务并生成 PRD：<复杂任务>
```

```text
用 Trellis check 复查当前任务是否满足 PRD 和项目规范。
```

```text
用 Trellis finish-work 收口当前任务，更新 workspace journal。
```

## 4. 和 /goal 的关系

`/goal` 只作为长任务执行器，不作为日常小任务入口。

推荐搭配：

```text
Trellis 负责：PRD、任务上下文、项目记忆、规范沉淀。
Aegis 负责：每一步的执行纪律和证据要求。
/goal 负责：长时间执行 issues/*.csv。
```

不要把所有任务都 CSV 化。只有这些场景才考虑 `/goal`：

- 跨 `server/admin/merchant/mini/mobile` 的大任务
- 支付、托管、订单状态、通知中心等长链路任务
- 前端规范批量整改
- 发布前回归矩阵
- 需要中断后恢复的多小时任务

## 5. 本仓库推荐工作方式

日常开发：

```text
用户描述功能或 bug -> Codex 按 Aegis 执行 -> 最小验证 -> patch 复审 -> 提示提交
```

长任务：

```text
Trellis brainstorm -> 生成 PRD -> Trellis implement/check -> finish-work
```

超长任务：

```text
Trellis PRD -> issues/*.csv -> /goal 执行 -> 最后一条 REVIEW 总验收
```

## 6. 本机能力与仓库边界

Aegis、Trellis CLI、Codex hooks、agent 配置等属于本机执行能力，不作为业务代码运行时依赖。

仓库内只提交团队共享的规范、任务和项目记忆；不要把个人 `.codex/config.toml`、本机授权策略、沙箱策略或 hooks 批准状态当作项目默认配置提交。

如果某个成员本机尚未安装 Aegis 或 Trellis，仍可按 `AGENTS.md` 和本文件的流程手动执行；自动注入 workflow breadcrumb 只是效率增强，不是完成任务的前置条件。

## 7. 下一步迁移原则

后续不要继续在旧流程上叠规则，而是按下面方式收敛：

- `AGENTS.md` 只保留入口规则、安全边界、分支策略和 Aegis/Trellis 路由。
- `docs/CODEX_WORKFLOW.md` 改成 Aegis/Trellis 的项目适配说明。
- `docs/CODE_REVIEW_SOP.md` 保留为项目专属风险表，供 Aegis review/check 使用。
- UI 经验、好的方案、坏的反例沉淀到 `.trellis/spec/` 或 `.trellis/workspace/`。
- 长任务状态沉淀到 `.trellis/tasks/`，必要时再导出 CSV 给 `/goal`。
