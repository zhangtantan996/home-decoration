# Legacy Migration Inventory

## Status

仓库已从旧的 repo-local Agent 工作流收敛到当前的团队开发仓库边界：
- `ops/` 继续作为仓库内共享控制面
- 根目录 `AGENTS.md` 继续作为工程规则入口
- 旧的 repo-local Agent 状态目录与个人记忆文件已从仓库移出

## Removed From Repo

以下旧工作流资产已整体移出仓库：
- 根目录的 repo-local Agent 状态与记忆文件
- repo-local 计划、笔记、技能与临时工作目录

这些内容如果仍需本地使用，应保存在个人环境中，不再作为团队共享事实来源。

## Keep

以下仍是当前共享体系的一部分：
- `AGENTS.md`
- `CLAUDE.md`
- `ops/project.yaml`
- `ops/state.yaml`
- `ops/events.ndjson`
- `ops/runbook.md`

## Rule

新任务只能以 `AGENTS.md`、`docs/`、`documentation/`、`ops/` 和可执行配置为准，不再引用已移出的 repo-local Agent 工作流文件。
