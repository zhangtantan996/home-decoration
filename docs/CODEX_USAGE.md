# Home Decoration AI 开发使用说明

本仓库现在使用 `Aegis + Trellis + Codex` 作为默认 AI 开发工作流。

详细操作文档见：

- `docs/AI_WORKFLOW_OPERATION_GUIDE.md`

## 1. 日常怎么提任务

普通 bug 或小功能，直接描述即可：

```text
修复 merchant 订单详情页状态展示不一致的问题。
```

Codex 会默认按 Aegis 执行纪律处理：

```text
读基线 -> 判断边界 -> 实现/排查 -> 最小验证 -> patch P0/P1 复审 -> 收口
```

如果只想排查不改代码，要明确说：

```text
排查 server 订单状态流转为什么返回 500，先不要改代码。
```

## 2. 什么时候显式使用 Aegis

当你希望先收紧目标、边界和验证方式时，可以这样说：

```text
Aegis goal: 优化 merchant 订单详情页状态展示，不改后端状态定义。
```

适合：

- bug 排查
- 中等范围修复
- 重构前边界确认
- 完成前验证
- 代码审查和复审

## 3. 什么时候使用 Trellis

跨模块、长任务、需要 PRD 或需要沉淀项目记忆时，用 Trellis：

```text
用 Trellis 开一个任务：统一 admin / merchant / mini 的订单状态展示口径。
```

适合：

- 跨 `server/admin/merchant/mini/mobile` 的任务
- 支付、托管、订单状态、通知中心等长链路任务
- 前端规范批量整改
- 发布前回归矩阵
- 需要跨会话恢复上下文的任务

## 4. 什么时候使用 /goal

`/goal` 只用于超长任务执行，不用于日常小修。

推荐方式：

```text
Trellis PRD -> issues/*.csv -> /goal @issues/*.csv -> final REVIEW
```

不要把所有任务都 CSV 化。小 bug、小 UI 文案、小样式调整直接走 Aegis + Codex。

## 5. 提交前默认 gate

功能完成后默认必须满足：

- 最小必要验证已执行。
- 当前 patch 已做 P0/P1 复审。
- 没有未确认高风险项。
- 如果验证或复审发现问题，继续修复并重跑验证。

满足后，Codex 会提示可以提交代码或进入下一个任务。

## 6. 需要先确认的动作

以下动作必须先等用户确认：

- `git push`
- 破坏性删除、回滚、reset
- 破坏性 schema 变更
- 生产影响操作
- 真实账号、真实数据、外部服务写操作
- 涉及 `auth`、`identity`、`payment/escrow`、`deploy`、`rbac`、`sms`、`legal/privacy` 且边界不清的任务

## 7. 推荐短句

```text
修复 <模块> 的 <问题>。
```

```text
排查 <模块> 的 <问题>，先不要改代码。
```

```text
Aegis goal: <目标>，不改 <边界>。
```

```text
用 Trellis 开一个任务：<复杂任务>。
```
